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
          ('owner-b', 'owner-b', 'owner-b@example.test', null, 3, now(), now(), now())
      `);

      const { createOwnedAgent } = await import("../../agent-registry/service");
      const {
        createOwnedAgentExecution,
        getCallbackAuditSummaryForOperator,
        getCallbackRemediationSummaryForOperator,
        listCallbackAuditsForOperator,
        requeueOwnedAgentExecution,
        updateOwnedAgentExecutionStatus,
      } = await import("../service");
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
    } finally {
      coreRedis?.disconnect();
      accountRedis?.disconnect();
      await corePool?.end().catch(() => undefined);
      await accountPool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
