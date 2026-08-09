import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PLATFORM_CONTAINER_IMAGES } from "../../container-image-lock.mjs";
import {
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

function createImageInventory(mode = "fixed-digest") {
  return {
    schemaVersion: "neuro-platform-release-images/v1",
    mode,
    source: { revision: REVISION },
    workflow: null,
    platform: "linux/amd64",
    images: PLATFORM_CONTAINER_IMAGES.map((image, index) => {
      const digest = `sha256:${(index + 1).toString(16).repeat(64)}`;
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
  const inventory = createImageInventory(mode);
  await mkdir(path.join(packageDir, "images"), { recursive: true });
  await mkdir(path.join(packageDir, "deployment"), { recursive: true });
  await writeFile(
    path.join(packageDir, "images", "inventory.json"),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );
  await writeFile(path.join(packageDir, "deployment", "docker-compose.yml"), createCompose(inventory));
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
