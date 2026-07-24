import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.ACCOUNT_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || null;

async function getTaskStatuses(pool: Pool) {
  const result = await pool.query<{ id: string; status: string }>(
    "select id, status from tasks order by id",
  );
  return result.rows;
}

async function getSnapshot(pool: Pool, userId: string) {
  const result = await pool.query<{
    reputation_score: number;
    completed_task_count: number;
    defaulted_task_count: number;
    cancelled_task_count: number;
    active_task_count: number;
    favorable_arbitration_count: number;
    unfavorable_arbitration_count: number;
    trust_level: number;
    completion_rate: number;
    default_rate: number;
    tier: string;
  }>(
    `select
        reputation_score,
        completed_task_count,
        defaulted_task_count,
        cancelled_task_count,
        active_task_count,
        favorable_arbitration_count,
        unfavorable_arbitration_count,
        trust_level,
        completion_rate,
        default_rate,
        tier
       from reputation_snapshots
      where user_id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

async function getHistoryCount(pool: Pool, userId: string) {
  const result = await pool.query<{ count: string }>(
    "select count(*)::text as count from reputation_history where user_id = $1",
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

if (!databaseUrl) {
  test("reputation integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for reputation integration coverage");
  });
} else {
  test("reputation services refresh from live task/arbitration state without mutating task records", { timeout: 120_000 }, async () => {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
    });
    pool.on("error", () => undefined);

    let accountPool: { end: () => Promise<void> } | null = null;
    let accountRedis: { disconnect: () => void } | null = null;
    let accountDb: { transaction: <T>(callback: (tx: unknown) => Promise<T>) => Promise<T> } | null = null;

    try {
      const {
        getReputationBreakdown,
        getReputationHistory,
        getReputationSummary,
        refreshReputationUsersInTx,
      } = await import("../service");
      ({ pgPool: accountPool } = await import("../../../db/client"));
      ({ db: accountDb } = await import("../../../db/client"));
      ({ redis: accountRedis } = await import("../../../db/redis"));

      const accountPoolWithEvents = accountPool as { on?: (event: string, listener: () => void) => unknown } | null;
      if (typeof accountPoolWithEvents?.on === "function") {
        accountPoolWithEvents.on("error", () => undefined);
      }

      await pool.query(`
        insert into users (id, username, email, avatar_url, trust_level, created_at, updated_at, last_login_at)
        values
          ('rep-user-a', 'rep-user-a', 'rep-user-a@example.test', null, 2, now(), now(), now()),
          ('rep-user-b', 'rep-user-b', 'rep-user-b@example.test', null, 1, now(), now(), now())
      `);

      await pool.query(`
        insert into tasks (
          id,
          creator_user_id,
          assigned_user_id,
          title,
          description,
          preferred_capability_codes,
          pricing_mode,
          billing_unit,
          meter_key,
          meter_quantity,
          operation_mode,
          reward_currency,
          reward_amount,
          required_bond_amount,
          status,
          idempotency_key,
          created_at
        ) values
          (
            'rep-task-completed',
            'rep-user-b',
            'rep-user-a',
            'Completed task',
            'Completed task for reputation',
            '[]'::jsonb,
            'flat_task',
            null,
            null,
            null,
            'manual',
            'obsidian',
            10,
            0,
            'accepted',
            null,
            now()
          ),
          (
            'rep-task-defaulted',
            'rep-user-b',
            'rep-user-a',
            'Defaulted task',
            'Defaulted task for reputation',
            '[]'::jsonb,
            'flat_task',
            null,
            null,
            null,
            'manual',
            'obsidian',
            10,
            0,
            'defaulted',
            null,
            now()
          ),
          (
            'rep-task-cancelled',
            'rep-user-a',
            null,
            'Cancelled task',
            'Cancelled task for reputation',
            '[]'::jsonb,
            'flat_task',
            null,
            null,
            null,
            'manual',
            'obsidian',
            10,
            0,
            'cancelled',
            null,
            now()
          ),
          (
            'rep-task-active',
            'rep-user-a',
            'rep-user-b',
            'Active task',
            'Active task for reputation',
            '[]'::jsonb,
            'flat_task',
            null,
            null,
            null,
            'manual',
            'obsidian',
            10,
            0,
            'in_progress',
            null,
            now()
          )
      `);

      await pool.query(`
        insert into arbitration_cases (
          id,
          entity_type,
          entity_id,
          requester_user_id,
          respondent_user_id,
          assigned_operator_user_id,
          status,
          reason,
          evidence_summary,
          resolution_summary,
          task_resolution_action,
          created_at,
          updated_at,
          claimed_at,
          resolved_at,
          effects_applied_at
        ) values
          (
            'rep-case-favorable',
            'task',
            'rep-task-completed',
            'rep-user-b',
            'rep-user-a',
            null,
            'resolved',
            'favorable resolution',
            null,
            null,
            'accept',
            now(),
            now(),
            null,
            now(),
            now()
          ),
          (
            'rep-case-unfavorable',
            'task',
            'rep-task-defaulted',
            'rep-user-b',
            'rep-user-a',
            null,
            'resolved',
            'unfavorable resolution',
            null,
            null,
            'default',
            now(),
            now(),
            null,
            now(),
            now()
          )
      `);

      await pool.query(`
        insert into reputation_snapshots (
          user_id,
          reputation_score,
          completed_task_count,
          defaulted_task_count,
          cancelled_task_count,
          active_task_count,
          favorable_arbitration_count,
          unfavorable_arbitration_count,
          trust_level,
          base_score,
          trust_bonus,
          completed_contribution,
          defaulted_penalty,
          cancelled_penalty,
          active_contribution,
          arbitration_win_bonus,
          arbitration_loss_penalty,
          completion_rate,
          default_rate,
          tier,
          updated_at
        ) values (
          'rep-user-a',
          999,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          100,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          'platinum',
          timestamp '2020-01-01 00:00:00+00'
        )
      `);

      const statusesBefore = await getTaskStatuses(pool);

      const userASummary = await getReputationSummary("rep-user-a");
      assert.equal(typeof userASummary.updatedAt, "string");
      assert.deepEqual(
        {
          ...userASummary,
          updatedAt: "<dynamic>",
        },
        {
          userId: "rep-user-a",
          reputationScore: 93,
          completedTaskCount: 1,
          defaultedTaskCount: 1,
          cancelledTaskCount: 1,
          activeTaskCount: 1,
          favorableArbitrationCount: 1,
          unfavorableArbitrationCount: 1,
          completionRate: 0.5,
          defaultRate: 0.5,
          tier: "bronze",
          updatedAt: "<dynamic>",
        },
      );

      const snapshotAfterFirstRead = await getSnapshot(pool, "rep-user-a");
      assert.deepEqual(snapshotAfterFirstRead, {
        reputation_score: 93,
        completed_task_count: 1,
        defaulted_task_count: 1,
        cancelled_task_count: 1,
        active_task_count: 1,
        favorable_arbitration_count: 1,
        unfavorable_arbitration_count: 1,
        trust_level: 2,
        completion_rate: 0.5,
        default_rate: 0.5,
        tier: "bronze",
      });
      assert.equal(await getHistoryCount(pool, "rep-user-a"), 1);
      assert.deepEqual(await getTaskStatuses(pool), statusesBefore);

      const userBBreakdown = await getReputationBreakdown("rep-user-b");
      assert.equal(userBBreakdown.userId, "rep-user-b");
      assert.deepEqual(userBBreakdown.inputs, {
        completedTaskCount: 0,
        defaultedTaskCount: 0,
        cancelledTaskCount: 0,
        activeTaskCount: 1,
        favorableArbitrationCount: 1,
        unfavorableArbitrationCount: 1,
        trustLevel: 1,
      });

      await pool.query("update tasks set status = 'accepted' where id = 'rep-task-active'");

      const userASecondSummary = await getReputationSummary("rep-user-a");
      assert.equal(userASecondSummary.activeTaskCount, 0);

      const userAHistory = await getReputationHistory("rep-user-a", 5);
      assert.equal(userAHistory.length, 2);
      assert.equal(userAHistory.every((entry) => entry.userId === "rep-user-a"), true);

      const snapshotAfterSecondRead = await getSnapshot(pool, "rep-user-a");
      assert.equal(snapshotAfterSecondRead?.active_task_count, 0);
      assert.equal(await getHistoryCount(pool, "rep-user-a"), 2);

      assert.ok(accountDb);
      await accountDb.transaction(async (tx) => {
        await refreshReputationUsersInTx(tx as never, ["rep-user-b", "rep-user-b"]);
      });

      const userBSnapshot = await getSnapshot(pool, "rep-user-b");
      assert.equal(userBSnapshot?.active_task_count, 0);
      assert.equal(await getHistoryCount(pool, "rep-user-b"), 2);

      await assert.rejects(
        () => getReputationHistory("rep-user-a", 0),
        /between 1 and 100/i,
      );
    } finally {
      accountRedis?.disconnect();
      await accountPool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
