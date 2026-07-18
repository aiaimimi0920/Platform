import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createAcceptanceManifest,
  finalizeAcceptanceManifest,
  recordSuiteResult,
  redactArgs,
  redactText,
  writeManifestAtomic,
} from "../manifest.mjs";

test("manifest records suite counters and writes an atomic machine-readable file", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-acceptance-"));
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-1",
    evidenceDir,
    git: { commit: "abc123", dirty: false },
  });

  recordSuiteResult(manifest, {
    id: "unit",
    layer: "required",
    status: "passed",
    command: "node",
    args: ["--test"],
    exitCode: 0,
    evidencePath: path.join(evidenceDir, "unit.json"),
  });
  recordSuiteResult(manifest, {
    id: "gateway-boundary",
    layer: "externalBoundary",
    status: "passed",
    command: "node",
    args: ["boundary.mjs"],
    exitCode: 0,
    evidencePath: path.join(evidenceDir, "gateway.json"),
  });

  const outputPath = path.join(evidenceDir, "acceptance-manifest.json");
  const result = finalizeAcceptanceManifest(manifest);
  await writeManifestAtomic(outputPath, result.manifest);
  const persisted = JSON.parse(await readFile(outputPath, "utf8"));

  assert.equal(result.exitCode, 0);
  assert.equal(persisted.runId, "run-manifest-1");
  assert.equal(persisted.status, "passed");
  assert.equal(persisted.suites.required.passed, 1);
  assert.equal(persisted.suites.externalBoundary.passed, 1);
  assert.equal(persisted.suites.required.skipped, 0);
});

test("required skipped or undiscovered suites make the manifest fail", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-2",
    evidenceDir: "C:/evidence",
  });
  recordSuiteResult(manifest, {
    id: "integration",
    layer: "required",
    status: "skipped",
    command: "npm",
    args: ["run", "test:integration"],
    exitCode: 0,
    skipReason: "fixture unavailable",
  });

  const result = finalizeAcceptanceManifest(manifest);
  assert.equal(result.exitCode, 1);
  assert.equal(result.manifest.status, "failed");
  assert.equal(result.manifest.suites.required.skipped, 1);
  assert.match(result.manifest.failureReasons.join("\n"), /skipped/i);
});

test("required external-blocked results do not count as an acceptance pass", () => {
  const manifest = createAcceptanceManifest({ runId: "run-manifest-3", evidenceDir: "C:/evidence" });
  recordSuiteResult(manifest, {
    id: "gateway-contract",
    layer: "externalBoundary",
    status: "external-blocked",
    command: "node",
    args: ["boundary.mjs"],
    exitCode: 1,
    skipReason: "external test endpoint unavailable",
  });
  const result = finalizeAcceptanceManifest(manifest, { requiredLayers: ["externalBoundary"] });
  assert.equal(result.exitCode, 1);
  assert.match(result.manifest.failureReasons.join("\n"), /externalBlocked/i);
});

test("redacts credentials from evidence text", () => {
  const input = 'token=secret-token cookie=session-cookie apiKey=secret-key code=123456 key=secret access_token=access-secret client_secret=client-secret "token":"quoted-token" Authorization: Bearer bearer-secret';
  const output = redactText(input);
  assert.equal(output.includes("secret-token"), false);
  assert.equal(output.includes("session-cookie"), false);
  assert.equal(output.includes("secret-key"), false);
  assert.equal(output.includes("123456"), false);
  assert.equal(output.includes("key=secret"), false);
  assert.equal(output.includes("quoted-token"), false);
  assert.equal(output.includes("bearer-secret"), false);
  assert.equal(output.includes("access-secret"), false);
  assert.equal(output.includes("client-secret"), false);
  assert.match(output, /\[REDACTED\]/);
});

test("redacts values following credential-like CLI flags", () => {
  assert.deepEqual(redactArgs(["--api-key", "secret-key", "--mode", "ci"]), [
    "--api-key",
    "[REDACTED]",
    "--mode",
    "ci",
  ]);
});

test("recordSuiteResult preserves separate stdout and stderr evidence paths", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-evidence-paths",
    evidenceDir: "C:/evidence",
  });
  const result = recordSuiteResult(manifest, {
    id: "unit",
    layer: "required",
    status: "passed",
    command: "node",
    args: ["--test"],
    exitCode: 0,
    evidencePath: "C:/evidence/unit.json",
    stdoutPath: "C:/evidence/unit.json.stdout.log",
    stderrPath: "C:/evidence/unit.json.stderr.log",
  });

  assert.equal(result.stdoutPath, "C:\\evidence\\unit.json.stdout.log");
  assert.equal(result.stderrPath, "C:\\evidence\\unit.json.stderr.log");
  assert.equal(manifest.results[0].stdoutPath, result.stdoutPath);
  assert.equal(manifest.results[0].stderrPath, result.stderrPath);
});
