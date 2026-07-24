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

test("atomic manifest writes use collision-free temporary paths under concurrency", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-atomic-concurrency-"));
  const outputPath = path.join(evidenceDir, "latest.json");
  const outcomes = await Promise.allSettled(
    Array.from({ length: 64 }, (_, index) => writeManifestAtomic(outputPath, { index })),
  );
  const persisted = JSON.parse(await readFile(outputPath, "utf8"));
  const temporaryFiles = (await readdir(evidenceDir)).filter((entry) => entry.endsWith(".tmp"));

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 64);
  assert.equal(Number.isInteger(persisted.index), true);
  assert.equal(persisted.index >= 0 && persisted.index < 64, true);
  assert.deepEqual(temporaryFiles, []);
});

test("required skipped or undiscovered suites make the manifest fail", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-2",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
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
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-3",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
  });
  recordSuiteResult(manifest, {
    id: "gateway-contract",
    layer: "externalBoundary",
    status: "external-blocked",
    command: "node",
    args: ["boundary.mjs"],
    exitCode: 1,
    evidencePath: path.join(os.tmpdir(), "platform-evidence", "gateway-contract.json"),
    skipReason: "external test endpoint unavailable",
  });
  const result = finalizeAcceptanceManifest(manifest, { requiredLayers: ["externalBoundary"] });
  assert.equal(result.exitCode, 1);
  assert.match(result.manifest.failureReasons.join("\n"), /externalBlocked/i);
});

test("not-applicable is an executed classification while required skipped and not-run still fail", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-classifications",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
  });

  recordSuiteResult(manifest, {
    id: "hook-inventory",
    layer: "externalBoundary",
    status: "not-applicable",
    command: "node",
    args: ["hook-inventory.mjs"],
    exitCode: 0,
    evidencePath: path.join(manifest.evidenceDir, "hook-inventory.json"),
    skipReason: "Source inventory found no Platform-owned Hook call point",
  });
  assert.equal(manifest.suites.externalBoundary.executed, 1);
  assert.equal(
    finalizeAcceptanceManifest(manifest, { requiredLayers: ["externalBoundary"] }).exitCode,
    0,
  );

  const skipped = createAcceptanceManifest({
    runId: "run-manifest-skipped-required",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
  });
  recordSuiteResult(skipped, {
    id: "required-skip",
    layer: "required",
    status: "skipped",
    command: "node",
    args: [],
    exitCode: 0,
    evidencePath: path.join(skipped.evidenceDir, "required-skip.json"),
    skipReason: "fixture unavailable",
  });
  assert.equal(finalizeAcceptanceManifest(skipped, { requiredLayers: ["required"] }).exitCode, 1);

  const notRun = createAcceptanceManifest({
    runId: "run-manifest-not-run-external",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
  });
  recordSuiteResult(notRun, {
    id: "external-not-run",
    layer: "externalBoundary",
    status: "not-run",
    command: "node",
    args: [],
    exitCode: null,
    evidencePath: path.join(notRun.evidenceDir, "external-not-run.json"),
    skipReason: "probe was not invoked",
  });
  assert.equal(
    finalizeAcceptanceManifest(notRun, { requiredLayers: ["externalBoundary"] }).exitCode,
    1,
  );
});

test("required not-applicable results fail finalization while external-boundary ones may pass", () => {
  const required = createAcceptanceManifest({
    runId: "run-manifest-required-not-applicable",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
  });
  recordSuiteResult(required, {
    id: "required-inventory",
    layer: "required",
    status: "not-applicable",
    command: "source-inventory",
    args: [],
    exitCode: 0,
    evidencePath: path.join(required.evidenceDir, "required-inventory.json"),
    skipReason: "Required inventory has no applicable implementation",
  });

  const requiredResult = finalizeAcceptanceManifest(required, { requiredLayers: ["required"] });
  assert.equal(requiredResult.exitCode, 1);
  assert.match(requiredResult.manifest.failureReasons.join("\n"), /not.?applicable/i);

  const external = createAcceptanceManifest({
    runId: "run-manifest-external-not-applicable",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
  });
  recordSuiteResult(external, {
    id: "external-hook-inventory",
    layer: "externalBoundary",
    status: "not-applicable",
    command: "source-inventory",
    args: [],
    exitCode: 0,
    evidencePath: path.join(external.evidenceDir, "external-hook-inventory.json"),
    skipReason: "Source inventory has no Platform-owned Hook call point",
  });
  assert.equal(
    finalizeAcceptanceManifest(external, { requiredLayers: ["externalBoundary"] }).exitCode,
    0,
  );
});

test("every not-applicable result requires evidence metadata and an explicit reason", () => {
  for (const layer of ["required", "externalBoundary", "conditionalLive"]) {
    const manifest = createAcceptanceManifest({
      runId: `run-manifest-not-applicable-${layer.toLowerCase()}`,
      evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
    });

    assert.throws(
      () =>
        recordSuiteResult(manifest, {
          id: `${layer}-missing-evidence`,
          layer,
          status: "not-applicable",
          command: "source-inventory",
          args: [],
          exitCode: 0,
          skipReason: "No applicable implementation",
        }),
      /evidence/i,
    );
    assert.throws(
      () =>
        recordSuiteResult(manifest, {
          id: `${layer}-missing-reason`,
          layer,
          status: "not-applicable",
          command: "source-inventory",
          args: [],
          exitCode: 0,
          evidencePath: path.join(manifest.evidenceDir, `${layer}-missing-reason.json`),
        }),
      /reason|skip/i,
    );
  }
});

test("external-blocked requires explicit blocker evidence metadata", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-blocker-evidence",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
  });

  assert.throws(
    () =>
      recordSuiteResult(manifest, {
        id: "missing-evidence",
        layer: "conditionalLive",
        status: "external-blocked",
        command: "environment-preflight",
        args: [],
        exitCode: 1,
        skipReason: "Missing live acceptance environment: TOKEN",
      }),
    /evidence/i,
  );
  assert.throws(
    () =>
      recordSuiteResult(manifest, {
        id: "missing-reason",
        layer: "conditionalLive",
        status: "external-blocked",
        command: "environment-preflight",
        args: [],
        exitCode: 1,
        evidencePath: path.join(manifest.evidenceDir, "missing-reason.json"),
      }),
    /reason|blocker/i,
  );

  const recorded = recordSuiteResult(manifest, {
    id: "valid-blocker",
    layer: "conditionalLive",
    status: "external-blocked",
    command: "environment-preflight",
    args: [],
    exitCode: 1,
    evidencePath: path.join(manifest.evidenceDir, "valid-blocker.json"),
    skipReason: "Missing live acceptance environment: TOKEN",
  });
  assert.equal(recorded.status, "external-blocked");
});

test("requires a zero exit code for passed results and fails nonzero skipped results", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-nonzero-pass",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
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
  const recordedMissingExit = recordSuiteResult(manifest, {
    id: "missing-exit-pass",
    layer: "required",
    status: "passed",
    command: "node",
    args: ["missing-exit-pass.mjs"],
    exitCode: null,
  });

  const result = finalizeAcceptanceManifest(manifest);
  assert.equal(recorded.status, "failed");
  assert.equal(recordedSkip.status, "failed");
  assert.equal(recordedMissingExit.status, "failed");
  assert.equal(manifest.suites.required.passed, 0);
  assert.equal(manifest.suites.required.failed, 3);
  assert.equal(manifest.suites.required.skipped, 0);
  assert.equal(result.exitCode, 1);
  assert.equal(result.manifest.status, "failed");
});

test("records conditional-live counters separately", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-conditional-live",
    evidenceDir: path.join(os.tmpdir(), "platform-evidence"),
  });
  recordSuiteResult(manifest, {
    id: "linuxdo-live",
    layer: "conditionalLive",
    status: "external-blocked",
    command: "node",
    args: ["linuxdo-live.mjs"],
    exitCode: 1,
    evidencePath: path.join(manifest.evidenceDir, "linuxdo-live.json"),
    skipReason: "external preflight blocked",
  });
  recordSuiteResult(manifest, {
    id: "tea-live",
    layer: "conditionalLive",
    status: "not-applicable",
    command: "node",
    args: ["tea-live.mjs"],
    exitCode: null,
    evidencePath: path.join(manifest.evidenceDir, "tea-live.json"),
    skipReason: "The conditional-live Tea probe is not applicable in this fixture",
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
    executed: 3,
    passed: 1,
    failed: 0,
    skipped: 0,
    externalBlocked: 1,
    notApplicable: 1,
  });
  assert.equal(manifest.suites.required.discovered, 0);
  assert.equal(manifest.suites.externalBoundary.discovered, 0);
});

test("rejects unsafe run ids", () => {
  for (const runId of [
    "../escape",
    "nested/run",
    "nested\\run",
    "UPPER",
    "run id",
    ".",
    "-leading",
    "con",
    "nul",
    "com1",
  ]) {
    assert.throws(
      () => createAcceptanceManifest({ runId, evidenceDir: path.join(os.tmpdir(), "evidence") }),
      /run.?id/i,
    );
  }
});

test("rejects invalid or duplicate suite metadata without partial mutation", () => {
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-validation",
    evidenceDir: path.join(os.tmpdir(), "evidence"),
  });
  recordSuiteResult(manifest, {
    id: "unit",
    layer: "required",
    status: "passed",
    command: "node",
    args: ["--test"],
    exitCode: 0,
  });
  const snapshot = structuredClone(manifest);

  for (const invalidResult of [
    {
      id: "unit",
      layer: "externalBoundary",
      status: "passed",
      command: "node",
      exitCode: 0,
    },
    {
      id: "unknown-status",
      layer: "required",
      status: "green",
      command: "node",
      exitCode: 0,
    },
    {
      id: "   ",
      layer: "required",
      status: "failed",
      command: "node",
      exitCode: 1,
    },
  ]) {
    assert.throws(() => recordSuiteResult(manifest, invalidResult), /suite|status|id|duplicate/i);
    assert.deepEqual(manifest, snapshot);
  }

  const explosiveArg = {
    toString() {
      throw new Error("argument normalization exploded");
    },
  };
  assert.throws(
    () =>
      recordSuiteResult(manifest, {
        id: "normalization-error",
        layer: "required",
        status: "failed",
        command: "node",
        args: [explosiveArg],
        exitCode: 1,
      }),
    /normalization exploded/i,
  );
  assert.deepEqual(manifest, snapshot);
});

test("redacts credentials from evidence text", () => {
  const input = [
    'token=secret-token cookie=session-cookie apiKey=secret-key code=123456 key=secret access_token=access-secret client_secret=client-secret "token":"quoted-token" Authorization: Bearer bearer-secret',
    "Cookie: sid=multi-cookie-sid; csrf=multi-cookie-csrf; theme=multi-cookie-theme",
    "request cookie = sid=equals-cookie-sid; csrf=equals-cookie-csrf; theme=equals-cookie-theme",
    "upstream rejected raw Bearer raw-bearer-secret",
    "Authorization: Basic basic-authorization-secret",
    "DATABASE_URL=postgres://db-user:url-userinfo-secret@db.internal/platform",
    "UPSTREAM_URL=https://url-user-only@api.internal/path",
    'password=field-password-secret credential=field-credential-secret "credentials":"json-credentials-secret"',
    '{"password":"json-password-secret","credential":"json-credential-secret"}',
    'credentials={"username":"public","secretAccessKey":"credential-object-secret"}',
    'credentials={\n  "username":"public",\n  "secretAccessKey":"multiline-credential-secret"\n}',
    'email_code=987654 oauth_code=oauth-code-secret verification-code: verification-code-secret sk-canary-secret',
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
  assert.equal(output.includes("equals-cookie-sid"), false);
  assert.equal(output.includes("equals-cookie-csrf"), false);
  assert.equal(output.includes("equals-cookie-theme"), false);
  assert.equal(output.includes("raw-bearer-secret"), false);
  assert.equal(output.includes("basic-authorization-secret"), false);
  assert.equal(output.includes("db-user"), false);
  assert.equal(output.includes("url-userinfo-secret"), false);
  assert.equal(output.includes("url-user-only"), false);
  assert.equal(output.includes("field-password-secret"), false);
  assert.equal(output.includes("field-credential-secret"), false);
  assert.equal(output.includes("json-credentials-secret"), false);
  assert.equal(output.includes("json-password-secret"), false);
  assert.equal(output.includes("json-credential-secret"), false);
  assert.equal(output.includes("credential-object-secret"), false);
  assert.equal(output.includes("multiline-credential-secret"), false);
  assert.equal(output.includes("987654"), false);
  assert.equal(output.includes("oauth-code-secret"), false);
  assert.equal(output.includes("verification-code-secret"), false);
  assert.equal(output.includes("sk-canary-secret"), false);
  assert.match(output, /Cookie\s*[:=]\s*\[REDACTED\]/i);
  assert.match(output, /Authorization\s*[:=]\s*\[REDACTED\]/i);
  assert.match(output, /postgres:\/\/\[REDACTED\]@db\.internal\/platform/i);
  assert.match(output, /\[REDACTED\]/);
});

test("redacts values following credential-like CLI flags", () => {
  assert.deepEqual(redactArgs([
    "--api-key",
    "secret-key",
    "--password",
    "cli-password-secret",
    "--credential",
    "cli-credential-secret",
    "--db-password",
    "namespaced-password-secret",
    "--service-credential",
    "namespaced-credential-secret",
    "--db-password=inline-password-secret",
    "--dsn",
    "postgres://cli-user:cli-url-secret@db.internal/platform",
    "--mode",
    "ci",
  ]), [
    "--api-key",
    "[REDACTED]",
    "--password",
    "[REDACTED]",
    "--credential",
    "[REDACTED]",
    "--db-password",
    "[REDACTED]",
    "--service-credential",
    "[REDACTED]",
    "--db-password=[REDACTED]",
    "--dsn",
    "postgres://[REDACTED]@db.internal/platform",
    "--mode",
    "ci",
  ]);
});

test("recordSuiteResult preserves separate stdout and stderr evidence paths", () => {
  const evidenceDir = path.resolve(os.tmpdir(), "platform-evidence-paths");
  const manifest = createAcceptanceManifest({
    runId: "run-manifest-evidence-paths",
    evidenceDir,
  });
  const result = recordSuiteResult(manifest, {
    id: "unit",
    layer: "required",
    status: "passed",
    command: "node",
    args: ["--test"],
    exitCode: 0,
    evidencePath: path.join(evidenceDir, "unit.json"),
    stdoutPath: path.join(evidenceDir, "unit.json.stdout.log"),
    stderrPath: path.join(evidenceDir, "unit.json.stderr.log"),
  });

  assert.equal(result.stdoutPath, path.resolve(evidenceDir, "unit.json.stdout.log"));
  assert.equal(result.stderrPath, path.resolve(evidenceDir, "unit.json.stderr.log"));
  assert.equal(manifest.results[0].stdoutPath, result.stdoutPath);
  assert.equal(manifest.results[0].stderrPath, result.stderrPath);
});
