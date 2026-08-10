import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PLATFORM_CONTAINER_IMAGES } from "../../container-image-lock.mjs";
import {
  assertCanonicalReleaseRoot,
  buildCompletePlatformRelease,
  createMigrationInventory,
  validateAcceptanceForRelease,
  validateOciImageLayouts,
} from "../release-build.mjs";

const REVISION = "a".repeat(40);
const REAL_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function createOciFixture(ociRoot) {
  for (const [index, image] of PLATFORM_CONTAINER_IMAGES.entries()) {
    const imageRoot = path.join(ociRoot, image);
    const payload = Buffer.from(`manifest-${image}-${index}`, "utf8");
    const digestHex = createHash("sha256").update(payload).digest("hex");
    await mkdir(path.join(imageRoot, "blobs", "sha256"), { recursive: true });
    await writeFile(path.join(imageRoot, "oci-layout"), '{"imageLayoutVersion":"1.0.0"}\n');
    await writeFile(path.join(imageRoot, "blobs", "sha256", digestHex), payload);
    await writeFile(
      path.join(imageRoot, "index.json"),
      `${JSON.stringify({
        schemaVersion: 2,
        manifests: [{
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          digest: `sha256:${digestHex}`,
          size: payload.length,
          platform: { architecture: "amd64", os: "linux" },
        }],
      }, null, 2)}\n`,
    );
  }
}

function passingCounters({ passed = 1, notApplicable = 0 } = {}) {
  return {
    discovered: passed + notApplicable,
    executed: passed + notApplicable,
    passed,
    failed: 0,
    skipped: 0,
    externalBlocked: 0,
    notApplicable,
  };
}

function createPassingAcceptance(evidenceDir) {
  return {
    schemaVersion: 1,
    runId: "release-fixture",
    evidenceDir,
    status: "passed",
    git: { commit: REVISION, dirty: false },
    suites: {
      required: passingCounters(),
      externalBoundary: passingCounters({ passed: 0, notApplicable: 1 }),
      conditionalLive: passingCounters({ passed: 0 }),
    },
    results: [],
    failureReasons: [],
  };
}

test("complete release output is constrained to the canonical sibling release root", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "platform-release-root-"));
  const repoRoot = path.join(workspace, "Platform");
  const canonicalRoot = path.join(workspace, "release", "Platform");
  await mkdir(repoRoot, { recursive: true });

  assert.equal(
    await assertCanonicalReleaseRoot(canonicalRoot, repoRoot),
    path.resolve(canonicalRoot),
  );
  await assert.rejects(
    assertCanonicalReleaseRoot(path.join(repoRoot, "release", "Platform"), repoRoot),
    /canonical|outside/i,
  );
  await assert.rejects(
    assertCanonicalReleaseRoot(path.join(workspace, "release", "Platform-escape"), repoRoot),
    /canonical|outside/i,
  );
});

test("release acceptance must be passed, clean, current, complete, and evidence-contained", () => {
  const evidenceDir = path.resolve(os.tmpdir(), "platform-release-evidence");
  const manifestPath = path.join(evidenceDir, "acceptance-manifest.json");
  const manifest = createPassingAcceptance(evidenceDir);
  manifest.results.push({
    id: "unit",
    layer: "required",
    status: "passed",
    evidencePath: path.join(evidenceDir, "unit.json"),
    stdoutPath: null,
    stderrPath: null,
  });
  manifest.results.push({
    id: "external-inventory",
    layer: "externalBoundary",
    status: "not-applicable",
    evidencePath: path.join(evidenceDir, "external.json"),
    stdoutPath: null,
    stderrPath: null,
    skipReason: "No external fixture",
  });

  const validated = validateAcceptanceForRelease(manifest, {
    manifestPath,
    currentGit: { commit: REVISION, dirty: false },
  });
  assert.equal(validated.runId, "release-fixture");

  assert.throws(
    () => validateAcceptanceForRelease({ ...manifest, status: "failed" }, {
      manifestPath,
      currentGit: { commit: REVISION, dirty: false },
    }),
    /passed/i,
  );
  assert.throws(
    () => validateAcceptanceForRelease(manifest, {
      manifestPath,
      currentGit: { commit: "b".repeat(40), dirty: false },
    }),
    /commit|current/i,
  );
  assert.throws(
    () => validateAcceptanceForRelease(manifest, {
      manifestPath,
      currentGit: { commit: REVISION, dirty: true },
    }),
    /dirty|clean/i,
  );

  const escaped = structuredClone(manifest);
  escaped.results[0].evidencePath = path.join(path.dirname(evidenceDir), "escaped.json");
  assert.throws(
    () => validateAcceptanceForRelease(escaped, {
      manifestPath,
      currentGit: { commit: REVISION, dirty: false },
    }),
    /evidence/i,
  );
});

test("complete release rejects acceptance evidence that escapes through filesystem links", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "platform-release-evidence-link-"));
  const evidenceDir = path.join(fixtureRoot, "evidence");
  const outsideDir = path.join(fixtureRoot, "outside");
  const linkedDir = path.join(evidenceDir, "linked");
  const hardLinkedEvidence = path.join(evidenceDir, "hard-linked.json");
  const outputRoot = path.resolve(REAL_REPO_ROOT, "..", "release", "Platform");
  const versionId = `p5-03-evidence-link-${process.pid}-${Date.now()}`;
  const destination = path.join(outputRoot, versionId);
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeFile(path.join(outsideDir, "outside.json"), '{"credential":"outside-evidence-root"}\n');
  await writeFile(path.join(evidenceDir, "external.json"), '{"status":"not-applicable"}\n');
  await symlink(outsideDir, linkedDir, process.platform === "win32" ? "junction" : "dir");
  await link(path.join(outsideDir, "outside.json"), hardLinkedEvidence);

  const acceptance = createPassingAcceptance(evidenceDir);
  acceptance.results = [
    {
      id: "required",
      layer: "required",
      status: "passed",
      evidencePath: path.join(linkedDir, "outside.json"),
      stdoutPath: null,
      stderrPath: null,
    },
    {
      id: "external",
      layer: "externalBoundary",
      status: "not-applicable",
      evidencePath: path.join(evidenceDir, "external.json"),
      stdoutPath: null,
      stderrPath: null,
      skipReason: "No fixture endpoint",
    },
  ];
  const acceptanceManifestPath = path.join(evidenceDir, "acceptance-manifest.json");
  await writeFile(acceptanceManifestPath, `${JSON.stringify(acceptance, null, 2)}\n`);

  try {
    await assert.rejects(
      buildCompletePlatformRelease({
        repoRoot: REAL_REPO_ROOT,
        outputRoot,
        versionId,
        acceptanceManifestPath,
        ociLayoutRoot: path.join(fixtureRoot, "unused-oci"),
        currentGit: {
          commit: REVISION,
          dirty: false,
          repository: "aiaimimi0920/Platform",
          sourceDateEpoch: 1_780_876_800,
        },
      }),
      /symbolic link|resolves outside the acceptance evidence directory/i,
    );

    acceptance.results[0].evidencePath = hardLinkedEvidence;
    await writeFile(acceptanceManifestPath, `${JSON.stringify(acceptance, null, 2)}\n`);
    await assert.rejects(
      buildCompletePlatformRelease({
        repoRoot: REAL_REPO_ROOT,
        outputRoot,
        versionId,
        acceptanceManifestPath,
        ociLayoutRoot: path.join(fixtureRoot, "unused-oci"),
        currentGit: {
          commit: REVISION,
          dirty: false,
          repository: "aiaimimi0920/Platform",
          sourceDateEpoch: 1_780_876_800,
        },
      }),
      /hard-linked file/i,
    );
  } finally {
    await rm(destination, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("offline image source requires six valid linux-amd64 OCI layouts", async () => {
  const ociRoot = await mkdtemp(path.join(os.tmpdir(), "platform-release-oci-"));
  await createOciFixture(ociRoot);

  const inventory = await validateOciImageLayouts(ociRoot);
  assert.deepEqual(inventory.map(({ image }) => image), PLATFORM_CONTAINER_IMAGES);
  assert.equal(inventory.every(({ platform }) => platform === "linux/amd64"), true);

  await rm(path.join(ociRoot, "worker", "index.json"));
  await assert.rejects(validateOciImageLayouts(ociRoot), /worker|index/i);
});

test("migration inventory preserves runtime lexical order and explicit domain order", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "platform-release-migrations-"));
  const fixtures = [
    ["core/migrations", ["0002_second.sql", "0001_first.sql", "0002_a_parallel.sql"]],
    ["packages/ai-gateway-domain/migrations", ["0002_gateway.sql", "0001_gateway.sql"]],
    ["packages/account-domain/migrations", ["0001_account.sql"]],
  ];
  for (const [directory, files] of fixtures) {
    const absoluteDirectory = path.join(repoRoot, directory);
    await mkdir(absoluteDirectory, { recursive: true });
    await Promise.all(files.map((file) => writeFile(path.join(absoluteDirectory, file), "select 1;\n")));
  }

  const inventory = await createMigrationInventory(repoRoot);
  assert.deepEqual(inventory.domains.map(({ id }) => id), [
    "core",
    "ai-gateway-domain",
    "account-domain",
  ]);
  assert.deepEqual(inventory.domains[0].files, [
    "0001_first.sql",
    "0002_a_parallel.sql",
    "0002_second.sql",
  ]);
  assert.equal(inventory.totalFiles, 6);
  assert.match(await readFile(path.join(repoRoot, "core", "migrations", "0001_first.sql"), "utf8"), /select 1/);
});

test("complete release assembly is atomic, relocatable, redacted, and artifact-only", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "platform-complete-release-"));
  const evidenceDir = path.join(fixtureRoot, "evidence");
  const ociRoot = path.join(fixtureRoot, "oci");
  const outputRoot = path.resolve(REAL_REPO_ROOT, "..", "release", "Platform");
  const versionId = `p5-03-test-${process.pid}-${Date.now()}`;
  const destination = path.join(outputRoot, versionId);
  const secretCanary = "p5-03-super-secret-canary";
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(ociRoot, { recursive: true });
  await createOciFixture(ociRoot);

  const acceptance = createPassingAcceptance(evidenceDir);
  const requiredEvidence = path.join(evidenceDir, "required.json");
  const externalEvidence = path.join(evidenceDir, "external.json");
  acceptance.results = [
    {
      id: "required",
      layer: "required",
      status: "passed",
      evidencePath: requiredEvidence,
      stdoutPath: null,
      stderrPath: null,
    },
    {
      id: "external",
      layer: "externalBoundary",
      status: "not-applicable",
      evidencePath: externalEvidence,
      stdoutPath: null,
      stderrPath: null,
      skipReason: "No fixture endpoint",
    },
  ];
  await writeFile(requiredEvidence, `${JSON.stringify({ token: secretCanary, status: "passed" })}\n`);
  await writeFile(externalEvidence, '{"status":"not-applicable"}\n');
  const acceptanceManifestPath = path.join(evidenceDir, "acceptance-manifest.json");
  await writeFile(acceptanceManifestPath, `${JSON.stringify(acceptance, null, 2)}\n`);

  try {
    const result = await buildCompletePlatformRelease({
      repoRoot: REAL_REPO_ROOT,
      outputRoot,
      versionId,
      acceptanceManifestPath,
      ociLayoutRoot: ociRoot,
      currentGit: {
        commit: REVISION,
        dirty: false,
        repository: "aiaimimi0920/Platform",
        sourceDateEpoch: 1_780_876_800,
      },
      secretCanaries: [secretCanary],
    }, {
      async buildWebPackage({ stagingRoot, versionId: webVersionId }) {
        await mkdir(path.join(stagingRoot, "packages"), { recursive: true });
        await mkdir(path.join(stagingRoot, "web"), { recursive: true });
        await writeFile(path.join(stagingRoot, "web", "server.js"), "console.log('fixture');\n");
        await writeFile(path.join(stagingRoot, "packages", `Platform-${webVersionId}-web-next.zip`), "zip");
        await writeFile(path.join(stagingRoot, "packages", `Platform-${webVersionId}-web-next.zip.sha256`), "fixture\n");
        await writeFile(path.join(stagingRoot, "BUILD_INFO.txt"), "fixture\n");
        await writeFile(path.join(stagingRoot, "manifest.json"), `${JSON.stringify({
          schemaVersion: 2,
          app: "Platform",
          component: "web",
          versionId: webVersionId,
          gitHead: REVISION,
          gitDirty: false,
        }, null, 2)}\n`);
      },
    });

    assert.equal(result.destination, destination);
    const releaseManifest = JSON.parse(await readFile(path.join(destination, "release-manifest.json"), "utf8"));
    assert.equal(releaseManifest.schemaVersion, "neuro-platform-release/v1");
    assert.equal(releaseManifest.images.count, 6);
    assert.equal(releaseManifest.migrations.domainCount, 3);
    assert.equal(releaseManifest.migrations.fileCount > 200, true);
    assert.equal(releaseManifest.source.revision, REVISION);
    assert.equal(JSON.stringify(releaseManifest).includes(REAL_REPO_ROOT), false);

    const compose = await readFile(path.join(destination, "deployment", "docker-compose.yml"), "utf8");
    assert.doesNotMatch(compose, /^\s*build\s*:/m);
    assert.doesNotMatch(compose, /@@/);
    assert.match(compose, /neuro-platform-core@sha256:[0-9a-f]{64}/);
    for (const serviceName of ["core-migrate", "gateway-domain-migrate", "account-domain-migrate"]) {
      assert.match(
        compose,
        new RegExp(`  ${serviceName}:[\\s\\S]*?healthcheck:\\n      disable: true`),
      );
    }
    const kustomization = await readFile(
      path.join(destination, "deployment", "k8s", "overlays", "production", "kustomization.yaml"),
      "utf8",
    );
    assert.match(kustomization, /neuro-platform-core/);
    assert.doesNotMatch(kustomization, /neuroloom-platform-core/);

    const copiedEvidence = await readFile(path.join(destination, "evidence", "required.json"), "utf8");
    assert.equal(copiedEvidence.includes(secretCanary), false);
    assert.match(copiedEvidence, /\[REDACTED\]/);
    assert.equal((await readFile(path.join(destination, "checksums.sha256"), "ascii")).includes("release-manifest.json"), true);
  } finally {
    await rm(destination, { recursive: true, force: true });
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
