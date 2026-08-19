import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const serviceRoot = resolve(__dirname, "service");
const settlementSource = readFileSync(resolve(serviceRoot, "settlement.ts"), "utf8");
const executorSource = readFileSync(resolve(serviceRoot, "platform-executor.ts"), "utf8");
const callbackSource = readFileSync(resolve(serviceRoot, "external-runtime.ts"), "utf8");
const artifactSource = readFileSync(resolve(serviceRoot, "executions.ts"), "utf8");
const migrationSource = readFileSync(
  resolve(__dirname, "../../../migrations/0143_agent_execution_concurrency_guards.sql"),
  "utf8",
);

test("settlement and platform run creation hold their database ownership rows", () => {
  assert.match(settlementSource, /agentExecutionSettlements[\s\S]*?\.for\("update"\)/);
  assert.match(executorSource, /agentExecutions[\s\S]*?\.for\("update"\)/);
  assert.match(executorSource, /eq\(agentExecutionRuns\.runKind, "platform_executor"\)/);
  assert.match(executorSource, /startEphemeralLockRenewal/);
  assert.match(migrationSource, /agent_execution_runs_one_active_platform_idx/);
});

test("external callbacks use a durable payload fingerprint", () => {
  assert.match(callbackSource, /findAcceptedCallback/);
  assert.match(callbackSource, /buildExternalCallbackPayloadHash/);
  assert.match(callbackSource, /normalizeStoredExternalCallbackReplayEnvelope/);
  assert.match(callbackSource, /startEphemeralLockRenewal/);
  assert.match(callbackSource, /different type or payload/);
  assert.match(migrationSource, /agent_execution_callbacks_accepted_idempotency_idx/);
  assert.match(migrationSource, /add column if not exists payload_hash text/);
});

test("artifact aggregation has count and metadata byte ceilings", () => {
  assert.match(artifactSource, /maxArtifactsPerExecution = 100/);
  assert.match(artifactSource, /maxArtifactMetadataBytesPerExecution = 512 \* 1024/);
  assert.match(artifactSource, /octet_length/);
});
