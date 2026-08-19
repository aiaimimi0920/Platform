import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

function isHttpError(error: unknown, statusCode: number, pattern: RegExp) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === statusCode &&
    "message" in error &&
    pattern.test(String((error as { message?: unknown }).message))
  );
}

if (!databaseUrl) {
  test("agent-execution integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for agent-execution integration coverage");
  });
} else {
  test("agent executions enforce owner-only updates, legal status transitions, disabled-agent rejection, and requeue recovery", { timeout: 120_000 }, async () => {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
    });
    pool.on("error", () => undefined);

    let corePool: { end: () => Promise<void> } | null = null;
    let coreRedis: { disconnect: () => void } | null = null;
    let accountPool: { end: () => Promise<void> } | null = null;
    let accountRedis: { disconnect: () => void } | null = null;

    try {
      await pool.query(`
        insert into users (id, username, email, avatar_url, trust_level, created_at, updated_at, last_login_at)
        values
          ('operator-1', 'operator-1', 'operator-1@example.test', null, 4, now(), now(), now()),
          ('owner-b', 'owner-b', 'owner-b@example.test', null, 3, now(), now(), now()),
          ('system:agent-execution-treasury', 'agent-execution-treasury', null, null, 4, now(), now(), now())
      `);

      const { createOwnedAgent } = await import("../../agent-registry/service");
      const {
        addOwnedAgentExecutionArtifact,
        createOwnedAgentExecution,
        getCallbackAuditSummaryForOperator,
        getCallbackRemediationSummaryForOperator,
        listCallbackAuditsForOperator,
        requeueOwnedAgentExecution,
        updateOwnedAgentExecutionStatus,
      } = await import("../service");
      const { ensureActivePlatformRun } = await import("../service/platform-executor");
      const { settleExecutionById } = await import("../service/settlement");
      const { buildExternalCallbackPayloadHash } = await import("../service/callback-audit");
      const { runExternalCallbackWithIdempotency } = await import("../service/external-runtime");
      const { buildStoredExternalCallbackReplayEnvelope } = await import("../callback-governance");
      const { getWalletSummary, grantBalance } = await import(
        "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js"
      );
      ({ pgPool: corePool } = await import("../../../db/client"));
      ({ redis: coreRedis } = await import("../../../db/redis"));
      ({ pgPool: accountPool } = await import("../../../../../packages/account-domain/dist/db/client.js"));
      ({ redis: accountRedis } = await import("../../../../../packages/account-domain/dist/db/redis.js"));

      const platformAgent = await createOwnedAgent("operator-1", {
        name: "Execution owner agent",
        description: "Platform execution owner",
        sourceType: "platform",
      });
      const disabledAgent = await createOwnedAgent("operator-1", {
        name: "Disabled execution agent",
        description: "Should reject execution creation",
        sourceType: "platform",
        enabled: false,
      });

      const execution = await createOwnedAgentExecution("operator-1", {
        agentId: platformAgent.id,
        title: "Run planner",
        objective: "Produce one scoped execution plan.",
      });
      assert.equal(execution.status, "queued");
      assert.equal(execution.agentId, platformAgent.id);

      await pool.query(
        `insert into agent_execution_callbacks (
           id,
           execution_id,
           agent_id,
           callback_id,
           callback_type,
           status,
           replay_payload,
           received_at
         )
         select
           'callback-audit-' || lpad(sequence::text, 3, '0'),
           $1,
           $2,
           'callback-' || sequence::text,
           'heartbeat',
           case when sequence = 201 then 'rejected' else 'accepted' end,
           case when sequence = 201 then '{"type":"heartbeat"}'::jsonb else null end,
           timestamptz '2026-08-09T00:00:00.000Z' - sequence * interval '1 second'
         from generate_series(1, 201) as sequence`,
        [execution.id, platformAgent.id],
      );

      const replayableCallbacks = await listCallbackAuditsForOperator({
        replayPayloadReplayable: true,
        limit: 1,
      });
      assert.deepEqual(replayableCallbacks.map((callback) => callback.id), ["callback-audit-201"]);

      const replayableSummary = await getCallbackAuditSummaryForOperator({
        replayPayloadReplayable: true,
        limit: 1,
      });
      assert.equal(replayableSummary.totalCount, 1);

      const replayableRemediationSummary = await getCallbackRemediationSummaryForOperator({
        replayPayloadReplayable: true,
      });
      assert.equal(replayableRemediationSummary.candidateCount, 1);
      assert.equal(replayableRemediationSummary.replayPayloadStoredCount, 1);
      assert.equal(replayableRemediationSummary.replayPayloadReplayableCount, 1);

      await assert.rejects(
        () =>
          updateOwnedAgentExecutionStatus("owner-b", execution.id, {
            status: "running",
          }),
        (error: unknown) => isHttpError(error, 404, /not found/i),
      );

      await assert.rejects(
        () =>
          updateOwnedAgentExecutionStatus("operator-1", execution.id, {
            status: "completed",
          }),
        (error: unknown) => isHttpError(error, 409, /queued to completed/i),
      );

      await assert.rejects(
        () =>
          createOwnedAgentExecution("operator-1", {
            agentId: disabledAgent.id,
            title: "Disabled run",
            objective: "This should not be allowed.",
          }),
        (error: unknown) => isHttpError(error, 409, /disabled/i),
      );

      const runningExecution = await updateOwnedAgentExecutionStatus("operator-1", execution.id, {
        status: "running",
        statusNote: "Worker claimed the execution.",
      });
      assert.equal(runningExecution.status, "running");

      const failedExecution = await updateOwnedAgentExecutionStatus("operator-1", execution.id, {
        status: "failed",
        statusNote: "First attempt failed.",
        resultSummary: "Temporary runtime failure",
      });
      assert.equal(failedExecution.status, "failed");

      const requeuedExecution = await requeueOwnedAgentExecution("operator-1", execution.id);
      assert.equal(requeuedExecution.status, "queued");
      assert.equal(requeuedExecution.startedAt, null);
      assert.equal(requeuedExecution.completedAt, null);
      assert.equal(requeuedExecution.autoRecoveryCount, 0);
      assert.equal(requeuedExecution.statusNote, "Execution requeued by owner.");

      const activeRunExecution = await createOwnedAgentExecution("operator-1", {
        agentId: platformAgent.id,
        title: "Concurrent platform run",
        objective: "Create only one active platform executor run.",
      });
      await updateOwnedAgentExecutionStatus("operator-1", activeRunExecution.id, { status: "running" });
      const activeRunIds = await Promise.all(
        Array.from({ length: 8 }, () =>
          ensureActivePlatformRun({
            executionId: activeRunExecution.id,
            ownerUserId: "operator-1",
            agentId: platformAgent.id,
          }),
        ),
      );
      assert.equal(new Set(activeRunIds).size, 1, "concurrent platform run creation must return one run id");
      const activeRunCount = await pool.query<{ count: string }>(
        `select count(*)::text as count
           from agent_execution_runs
          where execution_id = $1
            and run_kind = 'platform_executor'
            and status = 'running'`,
        [activeRunExecution.id],
      );
      assert.equal(activeRunCount.rows[0]?.count, "1");

      const artifactLimitExecution = await createOwnedAgentExecution("operator-1", {
        agentId: platformAgent.id,
        title: "Artifact quota",
        objective: "Reject unbounded artifact metadata.",
      });
      await assert.rejects(
        () =>
          addOwnedAgentExecutionArtifact("operator-1", artifactLimitExecution.id, {
            kind: "link",
            title: "Oversized artifact metadata",
            url: `https://example.test/${"a".repeat(512 * 1024)}`,
          }),
        (error: unknown) => isHttpError(error, 409, /512 KiB/i),
      );
      await pool.query(
        `insert into agent_execution_artifacts (id, execution_id, kind, title, created_at)
         select 'artifact-limit-' || sequence::text, $1, 'note', 'Bounded artifact ' || sequence::text, now()
           from generate_series(1, 100) as sequence`,
        [artifactLimitExecution.id],
      );
      await assert.rejects(
        () =>
          addOwnedAgentExecutionArtifact("operator-1", artifactLimitExecution.id, {
            kind: "note",
            title: "Artifact one hundred and one",
          }),
        (error: unknown) => isHttpError(error, 409, /more than 100 artifacts/i),
      );

      const replayPayload = buildStoredExternalCallbackReplayEnvelope({
        type: "heartbeat",
        statusNote: "durable callback",
      });
      assert.ok(replayPayload);
      const callbackPayloadHash = buildExternalCallbackPayloadHash(replayPayload);
      await pool.query(
        `insert into agent_execution_callbacks (
           id, execution_id, agent_id, callback_id, callback_type, status,
           payload_hash, replay_payload, received_at
         ) values ($1, $2, $3, $4, 'heartbeat', 'accepted', $5, $6::jsonb, now())`,
        [
          "durable-callback-audit-1",
          activeRunExecution.id,
          platformAgent.id,
          "durable-callback-1",
          callbackPayloadHash,
          JSON.stringify(replayPayload),
        ],
      );
      let durableOperationCalls = 0;
      let durableDuplicateCalls = 0;
      const durableDuplicateResult = await runExternalCallbackWithIdempotency(
        activeRunExecution.id,
        "durable-callback-1",
        { callbackType: "heartbeat", payloadHash: callbackPayloadHash },
        async () => {
          durableOperationCalls += 1;
          return "operation";
        },
        async () => {
          durableDuplicateCalls += 1;
          return "duplicate";
        },
      );
      assert.equal(durableDuplicateResult, "duplicate");
      assert.equal(durableOperationCalls, 0);
      assert.equal(durableDuplicateCalls, 1);
      await pool.query(
        "update agent_execution_callbacks set payload_hash = null where id = $1",
        ["durable-callback-audit-1"],
      );
      const legacyDuplicateResult = await runExternalCallbackWithIdempotency(
        activeRunExecution.id,
        "durable-callback-1",
        { callbackType: "heartbeat", payloadHash: callbackPayloadHash },
        async () => {
          durableOperationCalls += 1;
          return "operation";
        },
        async () => {
          durableDuplicateCalls += 1;
          return "duplicate";
        },
      );
      assert.equal(legacyDuplicateResult, "duplicate");
      assert.equal(durableOperationCalls, 0);
      assert.equal(durableDuplicateCalls, 2);
      await assert.rejects(
        () =>
          runExternalCallbackWithIdempotency(
            activeRunExecution.id,
            "durable-callback-1",
            { callbackType: "heartbeat", payloadHash: "different-payload-hash" },
            async () => "operation",
            async () => "duplicate",
          ),
        (error: unknown) => isHttpError(error, 409, /different type or payload/i),
      );

      const settlementExecution = await createOwnedAgentExecution("operator-1", {
        agentId: platformAgent.id,
        title: "Concurrent settlement",
        objective: "Settle one bill exactly once.",
      });
      await grantBalance("operator-1", "obsidian", 100, "settlement test funding");
      await pool.query(
        `insert into agent_execution_settlements (
           id,
           execution_id,
           owner_user_id,
           agent_id,
           currency,
           billed_cost_units,
           billed_amount,
           revenue_recipient_user_id,
           revenue_amount,
           status,
           created_at,
           updated_at
         ) values ($1, $2, $3, $4, 'obsidian', 10, 10, null, 0, 'pending', now(), now())`,
        ["settlement-concurrency-1", settlementExecution.id, "operator-1", platformAgent.id],
      );

      await Promise.all(Array.from({ length: 8 }, () => settleExecutionById(settlementExecution.id)));

      const [ownerWallet, treasuryWallet] = await Promise.all([
        getWalletSummary("operator-1"),
        getWalletSummary("system:agent-execution-treasury"),
      ]);
      assert.equal(ownerWallet.balances.obsidian.available, 90);
      assert.equal(treasuryWallet.balances.obsidian.available, 10);
      const settlementCounts = await pool.query<{
        attempts: string;
        entries: string;
        status: string;
      }>(
        `select
           (select count(*)::text from agent_execution_settlement_attempts where settlement_id = $1) as attempts,
           (select count(*)::text from ledger_entries where reference_id = $1) as entries,
           (select status from agent_execution_settlements where id = $1) as status`,
        ["settlement-concurrency-1"],
      );
      assert.deepEqual(settlementCounts.rows[0], {
        attempts: "1",
        entries: "2",
        status: "settled",
      });
    } finally {
      coreRedis?.disconnect();
      accountRedis?.disconnect();
      await corePool?.end().catch(() => undefined);
      await accountPool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
