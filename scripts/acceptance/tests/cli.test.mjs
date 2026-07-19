import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  parseAcceptanceArgs,
  resolveAcceptanceGitMetadata,
  runAcceptanceCli,
} from "../cli.mjs";
import { recordSuiteResult } from "../manifest.mjs";

const claimRoot = path.resolve(".runtime/acceptance/.claims");
const latestPath = path.resolve(".runtime/acceptance/latest.json");
let runSequence = 0;

function uniqueRunId(prefix) {
  runSequence += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${runSequence}`;
}

function cleanupClaimAfterTest(t, runId) {
  t.after(() => rm(path.join(claimRoot, `${runId}.json`), { force: true }));
}

function runCliWithoutExecution(argv) {
  return runAcceptanceCli(argv, { execute: false });
}

function readPlatformGitMetadata() {
  const commit = spawnSync("git", ["-C", path.resolve("."), "rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const status = spawnSync("git", ["-C", path.resolve("."), "status", "--porcelain", "--", "."], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return {
    commit: commit.status === 0 ? commit.stdout.trim() : null,
    dirty: status.status === 0 ? status.stdout.trim().length > 0 : null,
  };
}

test("runAcceptanceCli probes Platform-only git metadata when overrides are absent", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-git-probe-"));
  const runId = uniqueRunId("run-cli-git-probe");
  cleanupClaimAfterTest(t, runId);
  const previousCommit = process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT;
  const previousDirty = process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY;
  delete process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT;
  delete process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY;
  t.after(() => {
    if (previousCommit === undefined) delete process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT;
    else process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT = previousCommit;
    if (previousDirty === undefined) delete process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY;
    else process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY = previousDirty;
  });

  const result = await runCliWithoutExecution([
    "--mode",
    "ci",
    "--run-id",
    runId,
    "--evidence-dir",
    evidenceDir,
  ]);
  const expected = readPlatformGitMetadata();
  assert.equal(result.manifest.git.commit, expected.commit);
  assert.equal(result.manifest.git.dirty, expected.dirty);
});

test("git metadata probing ignores dirty sibling projects and reports unknown on probe failure", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "platform-cli-git-scope-"));
  const platformRoot = path.join(repoRoot, "Platform");
  await mkdir(platformRoot, { recursive: true });
  await writeFile(path.join(platformRoot, "tracked.txt"), "platform clean\n", "utf8");
  await writeFile(path.join(repoRoot, "sibling.txt"), "sibling clean\n", "utf8");
  for (const args of [
    ["init"],
    ["config", "user.email", "platform-acceptance@example.test"],
    ["config", "user.name", "Platform Acceptance"],
    ["add", "."],
    ["commit", "-m", "fixture baseline"],
  ]) {
    const result = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  await writeFile(path.join(repoRoot, "sibling.txt"), "sibling dirty\n", "utf8");

  const metadata = resolveAcceptanceGitMetadata({ env: {}, platformRoot });
  assert.match(metadata.commit ?? "", /^[0-9a-f]{40}$/);
  assert.equal(metadata.dirty, false);
  assert.deepEqual(
    resolveAcceptanceGitMetadata({ env: {}, platformRoot: path.join(repoRoot, "not-a-repo") }),
    { commit: null, dirty: null },
  );
});

test("runAcceptanceCli keeps explicit git metadata overrides ahead of probing", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-git-override-"));
  const runId = uniqueRunId("run-cli-git-override");
  cleanupClaimAfterTest(t, runId);
  const previousCommit = process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT;
  const previousDirty = process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY;
  process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT = "fixture-commit-override";
  process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY = "false";
  t.after(() => {
    if (previousCommit === undefined) delete process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT;
    else process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT = previousCommit;
    if (previousDirty === undefined) delete process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY;
    else process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY = previousDirty;
  });

  const result = await runCliWithoutExecution([
    "--mode",
    "ci",
    "--run-id",
    runId,
    "--evidence-dir",
    evidenceDir,
  ]);
  assert.deepEqual(result.manifest.git, {
    commit: "fixture-commit-override",
    dirty: false,
  });
});

test("parseAcceptanceArgs supports explicit run and evidence paths", () => {
  const evidenceDir = path.join(os.tmpdir(), "evidence", "cli");
  const parsed = parseAcceptanceArgs([
    "--mode",
    "ci",
    "--run-id",
    "run-cli-1",
    "--evidence-dir",
    evidenceDir,
  ]);
  assert.deepEqual(parsed, {
    mode: "ci",
    runId: "run-cli-1",
    evidenceDir: path.resolve(evidenceDir),
  });
});

test("parseAcceptanceArgs rejects traversal and non-Compose run ids", () => {
  for (const runId of [
    "../escape",
    "..\\escape",
    "nested/run",
    "nested\\run",
    "UPPER",
    "run id",
    ".",
    "-leading",
    "con",
    "nul",
    "com1",
    "a".repeat(64),
  ]) {
    assert.throws(
      () =>
        parseAcceptanceArgs([
          "--mode",
          "ci",
          "--run-id",
          runId,
          "--evidence-dir",
          path.join(os.tmpdir(), "explicit-evidence"),
        ]),
      /run.?id/i,
    );
  }

  const parsed = parseAcceptanceArgs([
    "--mode",
    "ci",
    "--run-id",
    "safe_run-01",
    "--evidence-dir",
    path.join(os.tmpdir(), "explicit-evidence"),
  ]);
  assert.equal(parsed.runId, "safe_run-01");
  assert.equal(parsed.evidenceDir, path.resolve(os.tmpdir(), "explicit-evidence"));
});

test("runAcceptanceCli writes a failed manifest until suites are registered", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-"));
  const runId = uniqueRunId("run-cli-empty");
  cleanupClaimAfterTest(t, runId);
  const result = await runCliWithoutExecution([
    "--mode",
    "ci",
    "--run-id",
    runId,
    "--evidence-dir",
    evidenceDir,
  ]);
  const manifest = JSON.parse(await readFile(path.join(evidenceDir, "acceptance-manifest.json"), "utf8"));
  assert.equal(result.exitCode, 1);
  assert.equal(manifest.status, "failed");
  assert.match(manifest.failureReasons.join("\n"), /no required suites/i);
});

test("runAcceptanceCli executes the required orchestrator before finalizing CI", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-required-runner-"));
  const runId = uniqueRunId("run-cli-required-runner");
  cleanupClaimAfterTest(t, runId);
  let called = false;
  const result = await runAcceptanceCli(
    ["--mode", "ci", "--run-id", runId, "--evidence-dir", evidenceDir],
    {
      runRequired: async ({ manifest }) => {
        called = true;
        recordSuiteResult(manifest, {
          id: "required-fixture",
          layer: "required",
          status: "passed",
          command: "fixture",
          args: [],
          exitCode: 0,
        });
        recordSuiteResult(manifest, {
          id: "external-fixture",
          layer: "externalBoundary",
          status: "passed",
          command: "fixture",
          args: [],
          exitCode: 0,
        });
      },
    },
  );

  assert.equal(called, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.manifest.status, "passed");
});

test("runAcceptanceCli persists a failed manifest when either acceptance orchestrator throws", async (t) => {
  for (const [mode, runnerKey] of [["ci", "runRequired"], ["live", "runLive"]]) {
    const evidenceDir = await mkdtemp(path.join(os.tmpdir(), `platform-cli-${mode}-orchestrator-throw-`));
    const runId = uniqueRunId(`run-cli-${mode}-orchestrator-throw`);
    cleanupClaimAfterTest(t, runId);
    const secret = `${mode}-orchestrator-secret-7f38c93b`;
    const orchestratorError = new Error(`orchestrator exploded token=${secret}`);

    await assert.rejects(
      runAcceptanceCli(
        ["--mode", mode, "--run-id", runId, "--evidence-dir", evidenceDir],
        {
          [runnerKey]: async () => {
            throw orchestratorError;
          },
        },
      ),
      (error) => error === orchestratorError,
    );

    const persisted = JSON.parse(
      await readFile(path.join(evidenceDir, "acceptance-manifest.json"), "utf8"),
    );
    assert.equal(persisted.status, "failed");
    assert.equal(typeof persisted.finishedAt, "string");
    assert.notEqual(persisted.finishedAt, "");
    const failureReasons = persisted.failureReasons.join("\n");
    assert.match(failureReasons, /orchestrator exploded token=\[REDACTED\]/i);
    assert.equal(failureReasons.includes(secret), false);
  }
});

test("external test evidence does not overwrite the canonical latest acceptance pointer", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-latest-isolation-"));
  const runId = uniqueRunId("run-cli-latest-isolation");
  cleanupClaimAfterTest(t, runId);
  const original = await readFile(latestPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  t.after(async () => {
    if (original === null) await rm(latestPath, { force: true });
    else await writeFile(latestPath, original, "utf8");
  });

  await runCliWithoutExecution([
    "--mode",
    "ci",
    "--run-id",
    runId,
    "--evidence-dir",
    evidenceDir,
  ]);

  const current = await readFile(latestPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  assert.equal(current, original);
});

test("runAcceptanceCli rejects duplicate run manifests without overwriting evidence", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-duplicate-"));
  const runId = uniqueRunId("run-cli-duplicate");
  cleanupClaimAfterTest(t, runId);
  const argv = [
    "--mode",
    "ci",
    "--run-id",
    runId,
    "--evidence-dir",
    evidenceDir,
  ];
  await runCliWithoutExecution(argv);
  const manifestPath = path.join(evidenceDir, "acceptance-manifest.json");
  const original = await readFile(manifestPath, "utf8");

  await assert.rejects(runCliWithoutExecution(argv), /already exists|duplicate|reuse/i);
  assert.equal(await readFile(manifestPath, "utf8"), original);
});

test("runAcceptanceCli preserves legacy existing-manifest detection without an owner claim", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-existing-manifest-"));
  const runId = uniqueRunId("run-cli-existing-manifest");
  cleanupClaimAfterTest(t, runId);
  const manifestPath = path.join(evidenceDir, "acceptance-manifest.json");
  const original = '{"legacy":true}\n';
  await writeFile(manifestPath, original, "utf8");

  await assert.rejects(
    runCliWithoutExecution([
      "--mode",
      "ci",
      "--run-id",
      runId,
      "--evidence-dir",
      evidenceDir,
    ]),
    /manifest already exists/i,
  );
  assert.equal(await readFile(manifestPath, "utf8"), original);
  await assert.rejects(
    readFile(path.join(evidenceDir, ".acceptance-owner.json"), "utf8"),
    { code: "ENOENT" },
  );
});

test("runAcceptanceCli atomically claims a run across different evidence directories", async (t) => {
  const firstEvidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-concurrent-a-"));
  const secondEvidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-concurrent-b-"));
  const runId = uniqueRunId("run-cli-concurrent");
  cleanupClaimAfterTest(t, runId);
  const firstArgv = [
    "--mode",
    "ci",
    "--run-id",
    runId,
    "--evidence-dir",
    firstEvidenceDir,
  ];
  const secondArgv = [
    "--mode",
    "ci",
    "--run-id",
    runId,
    "--evidence-dir",
    secondEvidenceDir,
  ];
  const outcomes = await Promise.allSettled([
    runCliWithoutExecution(firstArgv),
    runCliWithoutExecution(secondArgv),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
  assert.match(
    String(outcomes.find((outcome) => outcome.status === "rejected").reason),
    /already exists|duplicate|claimed|reuse/i,
  );
  const fulfilled = outcomes.find((outcome) => outcome.status === "fulfilled");
  assert.equal(JSON.parse(await readFile(fulfilled.value.manifestPath, "utf8")).runId, runId);
});

test("runAcceptanceCli atomically claims an evidence directory across different run ids", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-shared-evidence-"));
  const firstRunId = uniqueRunId("run-cli-shared-a");
  const secondRunId = uniqueRunId("run-cli-shared-b");
  cleanupClaimAfterTest(t, firstRunId);
  cleanupClaimAfterTest(t, secondRunId);
  const argvFor = (runId) => [
    "--mode",
    "ci",
    "--run-id",
    runId,
    "--evidence-dir",
    evidenceDir,
  ];

  const outcomes = await Promise.allSettled([
    runCliWithoutExecution(argvFor(firstRunId)),
    runCliWithoutExecution(argvFor(secondRunId)),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
  assert.match(
    String(outcomes.find((outcome) => outcome.status === "rejected").reason),
    /evidence.*already.*claimed|already.*owned|reuse/i,
  );

  const fulfilled = outcomes.find((outcome) => outcome.status === "fulfilled");
  const manifest = JSON.parse(await readFile(fulfilled.value.manifestPath, "utf8"));
  const owner = JSON.parse(
    await readFile(path.join(evidenceDir, ".acceptance-owner.json"), "utf8"),
  );
  assert.equal(manifest.runId, fulfilled.value.options.runId);
  assert.equal(owner.runId, fulfilled.value.options.runId);
  assert.equal(owner.evidenceDir, path.resolve(evidenceDir));
  assert.equal(owner.manifestPath, fulfilled.value.manifestPath);
});

test("direct CLI execution returns its manifest failure exit code", async (t) => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-process-"));
  const runId = uniqueRunId("run-cli-process");
  cleanupClaimAfterTest(t, runId);
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { runAcceptanceCli } from ${JSON.stringify(pathToFileURL(path.resolve("scripts/acceptance/cli.mjs")).href)}; const result = await runAcceptanceCli(${JSON.stringify([
        "--mode",
        "ci",
        "--run-id",
        runId,
        "--evidence-dir",
        evidenceDir,
      ])}, { execute: false }); console.log(JSON.stringify({ manifestPath: result.manifestPath })); process.exitCode = result.exitCode;`,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  await readFile(path.join(evidenceDir, "acceptance-manifest.json"), "utf8");
});

test("direct CLI execution redacts secrets from top-level stderr", () => {
  const secret = "cli-top-level-canary-7f38c93b";
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/acceptance/cli.mjs"), `--token=${secret}`],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 2);
  assert.equal(result.stderr.includes(secret), false);
  assert.match(result.stderr, /--token=\[REDACTED\]/i);
});
