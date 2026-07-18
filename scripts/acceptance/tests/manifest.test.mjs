import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
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
  await writeFile(outputPath, '{"stale":true}\n', "utf8");
  const result = finalizeAcceptanceManifest(manifest);
  await writeManifestAtomic(outputPath, result.manifest);
  const persisted = JSON.parse(await readFile(outputPath, "utf8"));
  const temporaryFiles = (await readdir(evidenceDir)).filter(
    (entry) => entry.startsWith("acceptance-manifest.json.") && entry.endsWith(".tmp"),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(persisted.runId, "run-manifest-1");
  assert.equal(persisted.status, "passed");
  assert.equal("stale" in persisted, false);
  assert.equal(persisted.suites.required.passed, 1);
  assert.equal(persisted.suites.externalBoundary.passed, 1);
  assert.equal(persisted.suites.required.skipped, 0);
  assert.deepEqual(temporaryFiles, []);
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

test("normalizes nonzero passed or skipped results to failed", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-nonzero-pass",
    evidenceDir: "C:/evidence",
  });
  const recorded = recordSuiteResult(manifest, {
    id: "false-pass",
    layer: "required",
    status: "passed",
    command: "node",
    args: ["false-pass.mjs"],
    exitCode: 7,
  });
  const recordedSkip = recordSuiteResult(manifest, {
    id: "false-skip",
    layer: "required",
    status: "skipped",
    command: "node",
    args: ["false-skip.mjs"],
    exitCode: 9,
  });

  const result = finalizeAcceptanceManifest(manifest);
  assert.equal(recorded.status, "failed");
  assert.equal(recordedSkip.status, "failed");
  assert.equal(manifest.suites.required.passed, 0);
  assert.equal(manifest.suites.required.failed, 2);
  assert.equal(manifest.suites.required.skipped, 0);
  assert.equal(result.exitCode, 1);
  assert.equal(result.manifest.status, "failed");
});

test("records conditional-live counters separately", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-conditional-live",
    evidenceDir: "C:/evidence",
  });
  recordSuiteResult(manifest, {
    id: "linuxdo-live",
    layer: "conditionalLive",
    status: "external-blocked",
    command: "node",
    args: ["linuxdo-live.mjs"],
    exitCode: 1,
  });
  recordSuiteResult(manifest, {
    id: "tea-live",
    layer: "conditionalLive",
    status: "not-applicable",
    command: "node",
    args: ["tea-live.mjs"],
    exitCode: null,
  });
  recordSuiteResult(manifest, {
    id: "gateway-live",
    layer: "conditionalLive",
    status: "passed",
    command: "node",
    args: ["gateway-live.mjs"],
    exitCode: 0,
  });

  assert.deepEqual(manifest.suites.conditionalLive, {
    discovered: 3,
    executed: 2,
    passed: 1,
    failed: 0,
    skipped: 0,
    externalBlocked: 1,
    notApplicable: 1,
  });
  assert.equal(manifest.suites.required.discovered, 0);
  assert.equal(manifest.suites.externalBoundary.discovered, 0);
});

test("redacts credentials from evidence text", () => {
  const input = [
    'token=secret-token cookie=session-cookie apiKey=secret-key code=123456 key=secret access_token=access-secret client_secret=client-secret "token":"quoted-token" Authorization: Bearer bearer-secret',
    "Cookie: sid=multi-cookie-sid; csrf=multi-cookie-csrf; theme=multi-cookie-theme",
    "upstream rejected raw Bearer raw-bearer-secret",
  ].join("\n");
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
  assert.equal(output.includes("multi-cookie-sid"), false);
  assert.equal(output.includes("multi-cookie-csrf"), false);
  assert.equal(output.includes("multi-cookie-theme"), false);
  assert.equal(output.includes("raw-bearer-secret"), false);
  assert.match(output, /Cookie\s*[:=]\s*\[REDACTED\]/i);
  assert.match(output, /Bearer \[REDACTED\]/i);
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
