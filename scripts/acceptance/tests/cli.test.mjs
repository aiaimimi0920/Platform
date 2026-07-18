import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseAcceptanceArgs, runAcceptanceCli } from "../cli.mjs";

const claimRoot = path.resolve(".runtime/acceptance/.claims");
let runSequence = 0;

function uniqueRunId(prefix) {
  runSequence += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${runSequence}`;
}

function cleanupClaimAfterTest(t, runId) {
  t.after(() => rm(path.join(claimRoot, `${runId}.json`), { force: true }));
}

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
  const result = await runAcceptanceCli([
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
  await runAcceptanceCli(argv);
  const manifestPath = path.join(evidenceDir, "acceptance-manifest.json");
  const original = await readFile(manifestPath, "utf8");

  await assert.rejects(runAcceptanceCli(argv), /already exists|duplicate|reuse/i);
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
    runAcceptanceCli([
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
    runAcceptanceCli(firstArgv),
    runAcceptanceCli(secondArgv),
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
    runAcceptanceCli(argvFor(firstRunId)),
    runAcceptanceCli(argvFor(secondRunId)),
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
      path.resolve("scripts/acceptance/cli.mjs"),
      "--mode",
      "ci",
      "--run-id",
      runId,
      "--evidence-dir",
      evidenceDir,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /acceptance-manifest\.json/);
});
