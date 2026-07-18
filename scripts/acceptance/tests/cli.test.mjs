import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseAcceptanceArgs, runAcceptanceCli } from "../cli.mjs";

test("parseAcceptanceArgs supports explicit run and evidence paths", () => {
  const parsed = parseAcceptanceArgs([
    "--mode",
    "ci",
    "--run-id",
    "run-cli-1",
    "--evidence-dir",
    "C:/evidence/cli",
  ]);
  assert.deepEqual(parsed, {
    mode: "ci",
    runId: "run-cli-1",
    evidenceDir: path.resolve("C:/evidence/cli"),
  });
});

test("runAcceptanceCli writes a failed manifest until suites are registered", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-"));
  const result = await runAcceptanceCli([
    "--mode",
    "ci",
    "--run-id",
    "run-cli-2",
    "--evidence-dir",
    evidenceDir,
  ]);
  const manifest = JSON.parse(await readFile(path.join(evidenceDir, "acceptance-manifest.json"), "utf8"));
  assert.equal(result.exitCode, 1);
  assert.equal(manifest.status, "failed");
  assert.match(manifest.failureReasons.join("\n"), /no required suites/i);
});

test("direct CLI execution returns its manifest failure exit code", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-cli-process-"));
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("scripts/acceptance/cli.mjs"),
      "--mode",
      "ci",
      "--run-id",
      "run-cli-process",
      "--evidence-dir",
      evidenceDir,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /acceptance-manifest\.json/);
});
