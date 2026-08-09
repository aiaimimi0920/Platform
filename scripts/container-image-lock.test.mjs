import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  PLATFORM_CONTAINER_IMAGES,
  aggregateContainerImageLockEntries,
  createContainerImageLockEntry,
  selectContainerImageLockWorkflowRun,
  validateContainerImageLock,
  validateContainerImageLockEntryFileNames,
} from "./container-image-lock.mjs";

const revision = "1".repeat(40);
const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function buildEntry(image, overrides = {}) {
  return createContainerImageLockEntry({
    image,
    reference: `ghcr.io/aiaimimi0920/neuro-platform-${image}`,
    digest: `sha256:${String(PLATFORM_CONTAINER_IMAGES.indexOf(image) + 1).repeat(64)}`,
    revision,
    repository: "aiaimimi0920/Platform",
    refName: "main",
    runId: "12345",
    runAttempt: "1",
    platform: "linux/amd64",
    ...overrides,
  });
}

test("container image lock entries validate and expose immutable references", () => {
  const entry = buildEntry("core");
  assert.equal(entry.image, "core");
  assert.equal(entry.source.revision, revision);
  assert.equal(entry.immutableReference, `${entry.reference}@${entry.digest}`);
  assert.throws(() => buildEntry("core", { digest: "sha256:bad" }), /digest is invalid/);
  assert.throws(() => buildEntry("unknown"), /Unknown Platform image/);
});

test("container image lock aggregation requires all six images and preserves canonical order", () => {
  const entries = PLATFORM_CONTAINER_IMAGES.map((image) => buildEntry(image)).reverse();
  const lock = aggregateContainerImageLockEntries(entries);

  assert.deepEqual(lock.images.map((entry) => entry.image), PLATFORM_CONTAINER_IMAGES);
  assert.equal(lock.source.revision, revision);
  assert.equal(lock.workflow.runId, "12345");
  assert.throws(() => aggregateContainerImageLockEntries(entries.slice(1)), /Expected 6 image lock entries/);
});

test("container image lock aggregation rejects duplicate and cross-run entries", () => {
  const entries = PLATFORM_CONTAINER_IMAGES.map((image) => buildEntry(image));
  assert.throws(
    () => aggregateContainerImageLockEntries([...entries.slice(0, -1), entries[0]]),
    /Duplicate image lock entry/,
  );
  assert.throws(
    () => aggregateContainerImageLockEntries([...entries.slice(0, -1), buildEntry("web", { runId: "99999" })]),
    /workflow runId does not match/,
  );
});

test("container image lock validation binds canonical content to release provenance", () => {
  const lock = aggregateContainerImageLockEntries(PLATFORM_CONTAINER_IMAGES.map((image) => buildEntry(image, {
    refName: "V0.1.0",
  })));

  assert.deepEqual(validateContainerImageLock(lock, {
    repository: "aiaimimi0920/Platform",
    revision,
    refName: "V0.1.0",
    runId: "12345",
    runAttempt: "1",
    platform: "linux/amd64",
  }), lock);
  assert.throws(
    () => validateContainerImageLock(lock, { revision: "2".repeat(40) }),
    /revision does not match the release/,
  );

  const reorderedLock = structuredClone(lock);
  [reorderedLock.images[0], reorderedLock.images[1]] = [reorderedLock.images[1], reorderedLock.images[0]];
  assert.throws(() => validateContainerImageLock(reorderedLock), /canonical order/);

  const mutableReferenceLock = structuredClone(lock);
  mutableReferenceLock.images[0].immutableReference = mutableReferenceLock.images[0].reference;
  assert.throws(() => validateContainerImageLock(mutableReferenceLock), /is not canonical/);

  const extendedLock = structuredClone(lock);
  extendedLock.untrusted = true;
  assert.throws(() => validateContainerImageLock(extendedLock), /fields are invalid/);
});

test("container image lock aggregation accepts only the six named entry files", () => {
  const fileNames = PLATFORM_CONTAINER_IMAGES.map((image) => `image-lock-${image}.json`);
  assert.deepEqual(validateContainerImageLockEntryFileNames(fileNames), [...fileNames].sort());
  assert.throws(
    () => validateContainerImageLockEntryFileNames([...fileNames, "image-lock.json"]),
    /must be exactly/,
  );
  assert.throws(
    () => validateContainerImageLockEntryFileNames(fileNames.slice(1)),
    /must be exactly/,
  );
});

test("container image lock workflow selection requires one successful tag run at the exact revision", () => {
  const pendingRun = {
    id: 12345,
    run_attempt: 2,
    event: "push",
    head_sha: revision,
    head_branch: "V0.1.0",
    path: ".github/workflows/container-images.yml@V0.1.0",
    status: "in_progress",
    conclusion: null,
  };
  assert.equal(selectContainerImageLockWorkflowRun([pendingRun], {
    revision,
    refName: "V0.1.0",
  }), null);

  assert.deepEqual(selectContainerImageLockWorkflowRun([{
    ...pendingRun,
    status: "completed",
    conclusion: "success",
  }], {
    revision,
    refName: "V0.1.0",
  }), {
    runId: "12345",
    runAttempt: "2",
    artifactName: "platform-container-image-lock-12345-2",
  });

  assert.throws(() => selectContainerImageLockWorkflowRun([{
    ...pendingRun,
    status: "completed",
    conclusion: "failure",
  }], {
    revision,
    refName: "V0.1.0",
  }), /completed with failure/);

  assert.throws(() => selectContainerImageLockWorkflowRun([
    pendingRun,
    { ...pendingRun, id: 67890 },
  ], {
    revision,
    refName: "V0.1.0",
  }), /Multiple Container Images workflow runs/);

  assert.equal(selectContainerImageLockWorkflowRun([{
    ...pendingRun,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
  }], {
    revision,
    refName: "V0.1.0",
  }), null);

  assert.equal(selectContainerImageLockWorkflowRun([{
    ...pendingRun,
    head_branch: "V0.1.0",
    path: ".github/workflows/container-images.yml@main",
    status: "completed",
    conclusion: "success",
  }], {
    revision,
    refName: "V0.1.0",
  }), null);
});

test("container image lock entry provenance rejects unsafe refs and zero workflow identifiers", () => {
  assert.throws(() => buildEntry("core", { refName: "V0.1.0\nforged=true" }), /refName is invalid/);
  assert.throws(() => buildEntry("core", { runId: "0" }), /runId is invalid/);
  assert.throws(() => buildEntry("core", { runAttempt: "0" }), /runAttempt is invalid/);
});

test("container image lock run resolver calls the scoped GitHub API and writes exact action outputs", async () => {
  let requestUrl;
  let authorization;
  const server = createServer((request, response) => {
    requestUrl = request.url;
    authorization = request.headers.authorization;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      workflow_runs: [{
        id: 12345,
        run_attempt: 2,
        event: "push",
        head_sha: revision,
        head_branch: "main",
        path: ".github/workflows/container-images.yml@V0.1.0",
        status: "completed",
        conclusion: "success",
      }],
    }));
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "platform-image-lock-"));
  const outputPath = join(temporaryDirectory, "github-output.txt");
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    await execFileAsync(process.execPath, [
      "scripts/container-image-lock.mjs",
      "resolve-run",
      "--repository", "aiaimimi0920/Platform",
      "--revision", revision,
      "--refName", "V0.1.0",
      "--timeoutSeconds", "2",
      "--pollSeconds", "1",
      "--output", outputPath,
    ], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        GITHUB_API_URL: `http://127.0.0.1:${address.port}`,
        GITHUB_TOKEN: "test-token",
      },
      timeout: 10_000,
    });

    assert.equal(
      requestUrl,
      "/repos/aiaimimi0920/Platform/actions/workflows/container-images.yml/runs?event=push&per_page=100",
    );
    assert.equal(authorization, "Bearer test-token");
    assert.equal(
      await readFile(outputPath, "utf8"),
      "runId=12345\nrunAttempt=2\nartifactName=platform-container-image-lock-12345-2\n",
    );
  } finally {
    await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
