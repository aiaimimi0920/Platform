import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runAcceptanceCommand } from "../run-command.mjs";

test("runAcceptanceCommand captures a passing command and redacts output", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-"));
  const evidencePath = path.join(evidenceDir, "command.json");
  const result = await runAcceptanceCommand({
    id: "command-pass",
    layer: "required",
    command: process.execPath,
    args: ["-e", "console.log('token=hidden-value')"],
    cwd: process.cwd(),
    evidencePath,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.exitCode, 0);
  assert.equal(Number.isFinite(result.durationMs), true);
  assert.equal(result.durationMs >= 0, true);
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  assert.equal(evidence.id, "command-pass");
  assert.equal(evidence.durationMs, result.durationMs);
  assert.equal(evidence.stdout.includes("hidden-value"), false);
  assert.equal(evidence.stdoutPath.endsWith("command.json.stdout.log"), true);
  assert.equal(evidence.stderrPath.endsWith("command.json.stderr.log"), true);
  assert.equal((await readFile(evidence.stdoutPath, "utf8")).includes("hidden-value"), false);
});

test("runAcceptanceCommand redacts cookie fields and raw bearer tokens from persisted evidence", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-redaction-"));
  const evidencePath = path.join(evidenceDir, "command.json");
  const result = await runAcceptanceCommand({
    id: "command-redaction",
    layer: "required",
    command: process.execPath,
    args: [
      "-e",
      "console.log('request cookie = sid=persisted-cookie-sid; csrf=persisted-cookie-csrf; theme=persisted-cookie-theme'); console.error('Bearer persisted-bearer-token')",
    ],
    cwd: process.cwd(),
    evidencePath,
  });

  const persisted = [
    await readFile(evidencePath, "utf8"),
    await readFile(result.stdoutPath, "utf8"),
    await readFile(result.stderrPath, "utf8"),
  ].join("\n");
  for (const canary of [
    "persisted-cookie-sid",
    "persisted-cookie-csrf",
    "persisted-cookie-theme",
    "persisted-bearer-token",
  ]) {
    assert.equal(persisted.includes(canary), false, `${canary} leaked into persisted evidence`);
  }
});

test("runAcceptanceCommand reports a nonzero command as failed", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-"));
  const result = await runAcceptanceCommand({
    id: "command-fail",
    layer: "externalBoundary",
    command: process.execPath,
    args: ["-e", "process.exit(7)"],
    cwd: process.cwd(),
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 7);
});

test("runAcceptanceCommand classifies gated skip output as skipped", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-skip-"));
  const result = await runAcceptanceCommand({
    id: "command-skip",
    layer: "required",
    command: process.execPath,
    args: ["-e", "console.log('Skipping gated tests: set FLAG=1 to run this integration layer.')"],
    cwd: process.cwd(),
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.exitCode, 0);
  assert.match(result.skipReason, /Skipping gated tests/i);
});

test("runAcceptanceCommand keeps required-mode skip enforcement as failed", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-skip-failed-"));
  const result = await runAcceptanceCommand({
    id: "command-skip-failed",
    layer: "required",
    command: process.execPath,
    args: ["-e", "console.log('Skipping gated tests is forbidden in required acceptance mode'); process.exit(1)"],
    cwd: process.cwd(),
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
});

test("runAcceptanceCommand bounds captured output", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-limit-"));
  const result = await runAcceptanceCommand({
    id: "command-limit",
    layer: "required",
    command: process.execPath,
    args: ["-e", "process.stdout.write('x'.repeat(200))"],
    cwd: process.cwd(),
    maxOutputBytes: 32,
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "passed");
  assert.equal(result.outputTruncated, true);
  const evidence = JSON.parse(await readFile(path.join(evidenceDir, "command.json"), "utf8"));
  assert.equal((await readFile(evidence.stdoutPath, "utf8")).length <= 32, true);
});
