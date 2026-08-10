import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PLATFORM_CONTAINER_IMAGES } from "../../container-image-lock.mjs";
import {
  createOciLayoutUri,
  createReleaseRuntimeOverride,
  inspectCompleteRelease,
  runArtifactOnlyReleaseSmoke,
  validateArtifactOnlyCompose,
} from "../release-smoke.mjs";

const REVISION = "a".repeat(40);
const SERVICE_IMAGES = [
  ["core-migrate", "core"],
  ["gateway-domain-migrate", "account-api"],
  ["account-domain-migrate", "account-api"],
  ["core", "core"],
  ["account-api", "account-api"],
  ["account-worker", "account-worker"],
  ["worker", "worker"],
  ["executor", "executor"],
  ["web", "web"],
];

function createImageInventory(mode = "fixed-digest", ociDigest = null) {
  return {
    schemaVersion: "neuro-platform-release-images/v1",
    mode,
    source: { revision: REVISION },
    workflow: null,
    platform: "linux/amd64",
    images: PLATFORM_CONTAINER_IMAGES.map((image, index) => {
      const digest = ociDigest ?? `sha256:${(index + 1).toString(16).repeat(64)}`;
      const reference = `ghcr.io/aiaimimi0920/neuro-platform-${image}`;
      return {
        image,
        reference,
        digest,
        immutableReference: `${reference}@${digest}`,
        platform: "linux/amd64",
        ...(mode === "oci-layout" ? { layoutPath: `oci/${image}` } : {}),
      };
    }),
  };
}

function createCompose(inventory) {
  const images = new Map(inventory.images.map((image) => [image.image, image.immutableReference]));
  return `${[
    "name: neuro-platform",
    "services:",
    ...SERVICE_IMAGES.flatMap(([service, image]) => [
      `  ${service}:`,
      `    image: ${JSON.stringify(images.get(image))}`,
      "    env_file:",
      "      - \"${PLATFORM_RUNTIME_ENV_FILE}\"",
    ]),
    "",
  ].join("\n")}`;
}

async function listFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await import("node:fs/promises").then(({ readdir }) => readdir(directory, { withFileTypes: true }));
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filePath);
      else files.push(filePath);
    }
  }
  await visit(root);
  return files;
}

async function writeChecksums(packageDir) {
  const lines = [];
  for (const filePath of (await listFiles(packageDir)).sort()) {
    const relativePath = path.relative(packageDir, filePath).replaceAll("\\", "/");
    if (relativePath === "checksums.sha256") continue;
    const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
    lines.push(`${digest}  ${relativePath}`);
  }
  await writeFile(path.join(packageDir, "checksums.sha256"), `${lines.join("\n")}\n`, "ascii");
}

async function createReleaseFixture(root, mode = "fixed-digest") {
  const packageDir = path.join(root, "release-fixture");
  const ociManifest = Buffer.from("{}\n", "utf8");
  const ociDigest = `sha256:${createHash("sha256").update(ociManifest).digest("hex")}`;
  const inventory = createImageInventory(mode, mode === "oci-layout" ? ociDigest : null);
  await mkdir(path.join(packageDir, "images"), { recursive: true });
  await mkdir(path.join(packageDir, "deployment"), { recursive: true });
  await writeFile(
    path.join(packageDir, "images", "inventory.json"),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  await writeFile(path.join(packageDir, "deployment", "docker-compose.yml"), createCompose(inventory));
  if (mode === "oci-layout") {
    for (const image of inventory.images) {
      const imageRoot = path.join(packageDir, "oci", image.image);
      await mkdir(path.join(imageRoot, "blobs", "sha256"), { recursive: true });
      await writeFile(path.join(imageRoot, "oci-layout"), '{"imageLayoutVersion":"1.0.0"}\n');
      await writeFile(
        path.join(imageRoot, "index.json"),
        `${JSON.stringify({
          schemaVersion: 2,
          manifests: [{
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            digest: ociDigest,
            size: ociManifest.length,
            platform: { os: "linux", architecture: "amd64" },
          }],
        })}\n`,
      );
      await writeFile(path.join(imageRoot, "blobs", "sha256", ociDigest.slice("sha256:".length)), ociManifest);
    }
  }
  await writeFile(
    path.join(packageDir, "release-manifest.json"),
    `${JSON.stringify({
      schemaVersion: "neuro-platform-release/v1",
      product: "Platform",
      versionId: "release-fixture",
      source: { repository: "aiaimimi0920/Platform", revision: REVISION, dirty: false },
      images: {
        inventory: "images/inventory.json",
        mode,
        count: PLATFORM_CONTAINER_IMAGES.length,
        platform: "linux/amd64",
      },
      deployment: { compose: "deployment/docker-compose.yml" },
      checksums: "checksums.sha256",
    }, null, 2)}\n`,
  );
  await writeChecksums(packageDir);
  return { packageDir, inventory };
}

test("artifact-only Compose requires all immutable Platform images and rejects source input", () => {
  const inventory = createImageInventory();
  const compose = createCompose(inventory);
  const contract = validateArtifactOnlyCompose(compose, inventory);
  assert.equal(contract.mode, "fixed-digest");
  assert.equal(contract.services.size, SERVICE_IMAGES.length);

  assert.throws(
    () => validateArtifactOnlyCompose(`${compose}\n  source-build:\n    build: ..\n`, inventory),
    /source builds|bind mounts/i,
  );
  assert.throws(
    () => validateArtifactOnlyCompose(compose.replace(
      "    env_file:",
      "    volumes:\n      - type: bind\n        source: ../Platform\n        target: /source\n    env_file:",
    ), inventory),
    /source builds|bind mounts|mount release or source/i,
  );
  assert.throws(
    () => validateArtifactOnlyCompose(
      compose.replace(inventory.images[0].immutableReference, "ghcr.io/example/core:latest"),
      inventory,
    ),
    /immutable image/i,
  );
  assert.throws(
    () => validateArtifactOnlyCompose(`${compose.trimEnd()}\n  source-sidecar:\n    image: \"busybox@sha256:${"f".repeat(64)}\"\n    volumes:\n      - ../Platform:/source\n`, inventory),
    /exactly|mount release or source/i,
  );
});

test("complete release inspection verifies exact checksum coverage before runtime", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "platform-release-smoke-inspect-"));
  try {
    const { packageDir } = await createReleaseFixture(root);
    const inspected = await inspectCompleteRelease(packageDir);
    assert.equal(inspected.manifest.versionId, "release-fixture");
    assert.equal(inspected.checksum.fileCount, 3);

    await writeFile(path.join(packageDir, "deployment", "docker-compose.yml"), "tampered\n");
    await assert.rejects(inspectCompleteRelease(packageDir), /checksum mismatch/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("OCI runtime override consumes temporary artifact tags without build contexts or bind mounts", () => {
  const override = createReleaseRuntimeOverride({
    runId: "release-smoke-fixture",
    runKey: "0123456789abcdef",
    imageInventory: createImageInventory("oci-layout"),
  });
  assert.doesNotMatch(override, /^\s*build\s*:/m);
  assert.doesNotMatch(override, /^\s*type\s*:\s*bind/m);
  assert.match(override, /neuro-platform-release-smoke-0123456789abcdef\/core:artifact/);
  assert.match(override, /pull_policy: never/);
  assert.match(override, /postgres:16-bookworm@sha256:[0-9a-f]{64}/);
  assert.match(
    override,
    /  executor:[\s\S]*?    depends_on:\n      core-migrate:\n        condition: service_completed_successfully\n      core:\n        condition: service_healthy\n  web:/,
  );
});

test("OCI layout URI is drive-free and relative to the smoke resources on Windows", () => {
  const cwd = "C:\\workspace\\Platform\\.runtime\\acceptance\\smoke\\resources";
  const layoutPath = "C:\\workspace\\release\\Platform\\V0.1.0\\oci\\core";
  const digest = `sha256:${"a".repeat(64)}`;
  const relative = path.win32.relative(cwd, layoutPath).replaceAll("\\", "/");

  assert.equal(
    createOciLayoutUri(layoutPath, digest, { cwd, platform: "win32" }),
    `oci-layout://${relative}@${digest}`,
  );
  assert.throws(
    () => createOciLayoutUri("D:\\release\\oci\\core", digest, { cwd, platform: "win32" }),
    /share a drive/i,
  );
});

test("failed OCI import cleans the project without removing images that were not imported", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "platform-release-smoke-oci-failure-"));
  const evidencePath = path.join(root, "evidence", "release-smoke.json");
  const resourcesDir = path.join(path.dirname(evidencePath), "release-smoke-oci-failure-release-resources");
  const calls = [];
  try {
    const { packageDir } = await createReleaseFixture(root, "oci-layout");
    await assert.rejects(
      runArtifactOnlyReleaseSmoke({
        packageDir,
        runId: "release-smoke-oci-failure",
        evidencePath,
      }, {
        allocatePorts: async () => [45301, 45302, 45303],
        executeCommand: async (input) => {
          calls.push(input);
          if (input.args[0] === "buildx") {
            return { exitCode: 1, durationMs: 1, timedOut: false, stdout: "", stderr: "import failed" };
          }
          return { exitCode: 0, durationMs: 1, timedOut: false, stdout: "", stderr: "" };
        },
      }),
      /OCI import for core failed/i,
    );

    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    assert.equal(evidence.status, "failed");
    assert.equal(evidence.cleanup.completed, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].args[0], "buildx");
    assert.deepEqual(calls[1].args.slice(-3), ["down", "--volumes", "--remove-orphans"]);
    const context = calls[0].args[calls[0].args.indexOf("--build-context") + 1];
    assert.match(context, /^artifact=oci-layout:\/\//);
    if (process.platform === "win32") assert.doesNotMatch(context, /oci-layout:\/\/[A-Za-z]:\//);
    await assert.rejects(readFile(path.join(resourcesDir, "owner.json")), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release smoke starts, probes, inventories, and cleans only its unique Compose project", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "platform-release-smoke-run-"));
  const evidencePath = path.join(root, "evidence", "release-smoke.json");
  const calls = [];
  try {
    const { packageDir } = await createReleaseFixture(root);
    const result = await runArtifactOnlyReleaseSmoke({
      packageDir,
      runId: "release-smoke-fixture",
      evidencePath,
    }, {
      allocatePorts: async () => [45101, 45102, 45103],
      executeCommand: async (input) => {
        calls.push(input);
        return { exitCode: 0, durationMs: 1, timedOut: false, stdout: "[]", stderr: null, error: null };
      },
      fetchImpl: async (url) => {
        if (url.endsWith("/ready")) {
          const service = url.includes(":45101") ? "core" : url.includes(":45102") ? "account-api" : "web";
          return new Response(JSON.stringify({ ok: true, ready: true, service }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("<button>使用 Linux.do 授权登录</button>", { status: 200 });
      },
    });

    assert.equal(result.evidence.status, "passed");
    assert.equal(result.evidence.cleanup.completed, true);
    assert.equal(result.evidence.probes.length, 4);
    assert.equal(calls.length, 3);
    const [up, ps, down] = calls.map((call) => call.args);
    assert.equal(up.includes("--build"), false);
    assert.equal(up.at(-5), "up");
    assert.deepEqual(ps.slice(-3), ["ps", "--format", "json"]);
    assert.deepEqual(down.slice(-3), ["down", "--volumes", "--remove-orphans"]);
    const projectIndex = up.indexOf("-p");
    assert.match(up[projectIndex + 1], /^platform-release-[0-9a-f]{16}$/);
    const evidenceText = await readFile(evidencePath, "utf8");
    assert.equal(JSON.parse(evidenceText).status, "passed");
    assert.doesNotMatch(evidenceText, /RELEASE_POSTGRES_PASSWORD|postgres:\/\/neuroloom:|NEXTAUTH_SECRET/);
    await assert.rejects(
      readFile(path.join(path.dirname(evidencePath), "release-smoke-fixture-release-resources", "runtime.env")),
      /ENOENT/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed release startup captures redacted Compose diagnostics before cleanup", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "platform-release-smoke-diagnostics-"));
  const evidencePath = path.join(root, "evidence", "release-smoke.json");
  const calls = [];
  const secret = "should-not-leak";
  try {
    const { packageDir } = await createReleaseFixture(root);
    await assert.rejects(
      runArtifactOnlyReleaseSmoke({
        packageDir,
        runId: "release-smoke-diagnostics",
        evidencePath,
      }, {
        allocatePorts: async () => [45401, 45402, 45403],
        executeCommand: async (input) => {
          calls.push(input);
          const action = input.args.at(-1);
          if (action === "900") {
            return { exitCode: 1, durationMs: 1, timedOut: false, stdout: "", stderr: `Bearer ${secret}` };
          }
          if (input.args.includes("ps")) {
            return {
              exitCode: 0,
              durationMs: 1,
              timedOut: false,
              stdout: JSON.stringify({ Service: "executor", State: "running", Health: "unhealthy", ExitCode: 0 }),
              stderr: "",
            };
          }
          if (input.args.includes("logs")) {
            return { exitCode: 0, durationMs: 1, timedOut: false, stdout: `Authorization: Bearer ${secret}`, stderr: "" };
          }
          return { exitCode: 0, durationMs: 1, timedOut: false, stdout: "", stderr: "" };
        },
      }),
      /startup failed/i,
    );

    const evidenceText = await readFile(evidencePath, "utf8");
    const evidence = JSON.parse(evidenceText);
    assert.equal(evidence.status, "failed");
    assert.equal(evidence.cleanup.completed, true);
    assert.equal(evidence.commands.up.exitCode, 1);
    assert.deepEqual(evidence.startupDiagnostics.services, ["executor"]);
    assert.equal(evidence.startupDiagnostics.ps.exitCode, 0);
    assert.equal(evidence.startupDiagnostics.logs.exitCode, 0);
    assert.match(evidenceText, /\[REDACTED\]/);
    assert.doesNotMatch(evidenceText, new RegExp(secret));
    assert.equal(calls.length, 4);
    assert.equal(calls.find((call) => call.args.includes("logs")).args.includes("executor"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed cleanup retains the exact owner record without leaking command secrets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "platform-release-smoke-recovery-"));
  const evidencePath = path.join(root, "evidence", "release-smoke.json");
  const resourcesDir = path.join(path.dirname(evidencePath), "release-smoke-recovery-release-resources");
  try {
    const { packageDir } = await createReleaseFixture(root);
    await assert.rejects(
      runArtifactOnlyReleaseSmoke({
        packageDir,
        runId: "release-smoke-recovery",
        evidencePath,
      }, {
        allocatePorts: async () => [45201, 45202, 45203],
        executeCommand: async () => ({
          exitCode: 1,
          durationMs: 1,
          timedOut: false,
          stdout: "",
          stderr: "",
          error: "postgres://neuroloom:should-not-leak@postgres/neuroloom",
        }),
      }),
      /startup failed/i,
    );

    const evidenceText = await readFile(evidencePath, "utf8");
    const evidence = JSON.parse(evidenceText);
    assert.equal(evidence.status, "failed");
    assert.equal(evidence.cleanup.completed, false);
    assert.doesNotMatch(evidenceText, /should-not-leak|postgres:\/\/neuroloom:/);
    const owner = JSON.parse(await readFile(path.join(resourcesDir, "owner.json"), "utf8"));
    assert.equal(owner.projectName, evidence.projectName);
    assert.equal(owner.resourcesDir, resourcesDir);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
