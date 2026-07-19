import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createAcceptanceManifest, finalizeAcceptanceManifest } from "../manifest.mjs";
import { LIVE_SUITE_IDS, runLiveAcceptance } from "../run-live.mjs";

function npmInvocation(args) {
  const npmCliPath = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].find((candidate) => typeof candidate === "string" && existsSync(candidate));
  if (!npmCliPath) throw new Error("Unable to locate npm-cli.js for live script regression test");
  return { command: process.execPath, args: [npmCliPath, ...args] };
}

test("workspace test:live scripts register a real test and fail clearly without Tea environment", async (t) => {
  const env = { ...process.env };
  for (const name of [
    "TEA_PLATFORM_REAL_SMOKE",
    "TEA_WEB_REAL_SMOKE",
    "TEA_SERVER_URL",
    "TEA_AUTH_TOKEN",
    "INTERNAL_API_TOKEN",
  ]) {
    delete env[name];
  }
  delete env.NODE_TEST_CONTEXT;

  for (const fixture of [
    { workspace: "@neuro/core", error: /TEA_SERVER_URL is required for Platform Tea real smoke/ },
    { workspace: "@neuro/web", error: /TEA_SERVER_URL is required for Platform Web Tea real smoke/ },
  ]) {
    await t.test(fixture.workspace, () => {
      const invocation = npmInvocation(["run", "test:live", "--workspace", fixture.workspace]);
      const result = spawnSync(invocation.command, invocation.args, {
        cwd: path.resolve("."),
        encoding: "utf8",
        env,
        timeout: 120_000,
      });
      const output = `${result.stdout || ""}\n${result.stderr || ""}`;
      assert.notEqual(result.status, 0, output);
      assert.match(output, fixture.error);
      assert.doesNotMatch(output, /# tests 0\b/);
    });
  }
});

test("live acceptance executes a secret-free preflight and records external blockers when authorization is missing", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-live-orchestration-"));
  const manifest = createAcceptanceManifest({
    runId: "live-orchestration-test",
    evidenceDir,
  });

  const secretCanary = "must-not-leak-live-client-id";
  const result = await runLiveAcceptance({
    manifest,
    evidenceDir,
    env: { OAUTH_CLIENT_ID: secretCanary },
  });
  assert.deepEqual(result.results.map((item) => item.id), LIVE_SUITE_IDS);
  assert.equal(manifest.suites.conditionalLive.discovered, 5);
  assert.equal(manifest.suites.conditionalLive.externalBlocked, 4);
  assert.equal(manifest.suites.conditionalLive.executed, 5);
  assert.equal(manifest.suites.conditionalLive.notApplicable, 1);
  assert.equal(manifest.suites.required.discovered, 0);
  assert.equal(manifest.suites.externalBoundary.discovered, 0);

  for (const id of LIVE_SUITE_IDS.slice(0, 4)) {
    const evidenceContents = await readFile(path.join(evidenceDir, "suites", `${id}.json`), "utf8");
    const evidence = JSON.parse(evidenceContents);
    assert.equal(evidence.status, "external-blocked");
    assert.equal(evidence.preflight?.executed, true);
    assert.equal("value" in evidence.preflight, false);
    assert.equal(Array.isArray(evidence.preflight.missingEnvironment), true);
    assert.equal(evidenceContents.includes(secretCanary), false);
  }

  const finalized = finalizeAcceptanceManifest(manifest, {
    requiredLayers: ["conditionalLive"],
  });
  assert.equal(finalized.exitCode, 0);
  const persisted = JSON.parse(
    await readFile(path.join(evidenceDir, "acceptance-manifest.json"), "utf8"),
  );
  assert.equal(persisted.results.length, 5);
});

test("live acceptance records not-run when live environment is present but probes are not implemented", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-live-not-run-"));
  const manifest = createAcceptanceManifest({
    runId: "live-not-run-test",
    evidenceDir,
  });
  const env = {
    OAUTH_CLIENT_ID: "fixture-client-id",
    OAUTH_CLIENT_SECRET: "fixture-client-secret",
    AI_GATEWAY_LIVE_URL: "https://gateway.example.test",
    AI_GATEWAY_LIVE_TOKEN: "fixture-gateway-token",
    LOOM_LIVE_URL: "https://loom.example.test",
    LOOM_LIVE_TOKEN: "fixture-loom-token",
    TEA_LIVE_URL: "https://tea.example.test",
    TEA_LIVE_TOKEN: "fixture-tea-token",
  };

  const result = await runLiveAcceptance({ manifest, evidenceDir, env });
  assert.deepEqual(result.results.slice(0, 4).map((item) => item.status), [
    "not-run",
    "not-run",
    "not-run",
    "not-run",
  ]);
  assert.equal(manifest.suites.conditionalLive.skipped, 4);
  assert.equal(manifest.suites.conditionalLive.externalBlocked, 0);
  const finalized = finalizeAcceptanceManifest(manifest, { requiredLayers: ["conditionalLive"] });
  assert.equal(finalized.exitCode, 1);
  const gatewayEvidence = JSON.parse(
    await readFile(path.join(evidenceDir, "suites", "live-gateway.json"), "utf8"),
  );
  assert.equal(gatewayEvidence.status, "not-run");
  assert.match(gatewayEvidence.skipReason, /probe implementation/i);
});
