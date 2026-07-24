import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

function resolveModuleExports<T extends object>(loadedModule: T) {
  if ("default" in loadedModule && typeof loadedModule.default === "object" && loadedModule.default !== null) {
    return loadedModule.default as T;
  }
  return loadedModule;
}

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
  test("arbitration integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for arbitration integration coverage");
  });
} else {
  test("arbitration cases enforce participant-only creation, evidence capture, and claimer-owned review flow", { timeout: 120_000 }, async () => {
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
          ('arb-creator', 'arb-creator', 'arb-creator@example.test', null, 3, now(), now(), now()),
          ('arb-worker', 'arb-worker', 'arb-worker@example.test', null, 3, now(), now(), now()),
          ('arb-outsider', 'arb-outsider', 'arb-outsider@example.test', null, 1, now(), now(), now()),
          ('operator-1', 'operator-1', 'operator-1@example.test', null, 4, now(), now(), now()),
          ('operator-2', 'operator-2', 'operator-2@example.test', null, 4, now(), now(), now())
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
        ) values (
          'arb-task-1',
          'arb-creator',
          'arb-worker',
          'Arbitrated task',
          'A task used to verify arbitration review flow.',
          '[]'::jsonb,
          'flat_task',
          null,
          null,
          null,
          'manual',
          'obsidian',
          10,
          0,
          'submitted',
          null,
          now()
        )
      `);

      const arbitrationService = resolveModuleExports(await import("../service"));
      const {
        addArbitrationEvidence,
        advanceArbitrationReviewRound,
        claimArbitrationCase,
        createArbitrationCase,
        releaseArbitrationCase,
        updateArbitrationCaseStatus,
      } = arbitrationService as typeof import("../service");
      const coreDbClient = resolveModuleExports(await import("../../../db/client")) as typeof import("../../../db/client");
      const coreRedisClient = resolveModuleExports(await import("../../../db/redis")) as typeof import("../../../db/redis");
      const accountDbClient = resolveModuleExports(
        await import("../../../../../packages/account-domain/dist/db/client.js"),
      ) as typeof import("../../../../../packages/account-domain/dist/db/client.js");
      const accountRedisClient = resolveModuleExports(
        await import("../../../../../packages/account-domain/dist/db/redis.js"),
      ) as typeof import("../../../../../packages/account-domain/dist/db/redis.js");
      corePool = coreDbClient.pgPool;
      coreRedis = coreRedisClient.redis;
      accountPool = accountDbClient.pgPool;
      accountRedis = accountRedisClient.redis;
      const corePoolWithEvents = corePool as { on?: (event: string, listener: () => void) => unknown } | null;
      const accountPoolWithEvents = accountPool as { on?: (event: string, listener: () => void) => unknown } | null;
      if (typeof corePoolWithEvents?.on === "function") {
        corePoolWithEvents.on("error", () => undefined);
      }
      if (typeof accountPoolWithEvents?.on === "function") {
        accountPoolWithEvents.on("error", () => undefined);
      }

      await assert.rejects(
        () =>
          createArbitrationCase("arb-outsider", {
            entityType: "task",
            entityId: "arb-task-1",
            reason: "No standing",
          }),
        (error: unknown) => isHttpError(error, 401, /participants/i),
      );

      const arbitrationCase = await createArbitrationCase("arb-creator", {
        entityType: "task",
        entityId: "arb-task-1",
        reason: "The submitted artifact is disputed.",
        evidenceSummary: "Initial screenshots from the creator.",
      });
      assert.equal(arbitrationCase.status, "open");
      assert.equal(arbitrationCase.evidences.length, 1);
      assert.equal(arbitrationCase.reviewRounds.length, 1);
      assert.equal(arbitrationCase.reviewRounds[0]?.roundNumber, 1);

      const withWorkerEvidence = await addArbitrationEvidence("arb-worker", arbitrationCase.id, {
        kind: "text_note",
        title: "Worker evidence",
        content: "The worker attached additional context for the dispute.",
      });
      assert.equal(withWorkerEvidence.evidences.length, 2);

      const claimed = await claimArbitrationCase("operator-1", arbitrationCase.id);
      assert.equal(claimed.assignedOperatorUserId, "operator-1");
      assert.equal(claimed.reviewRounds[0]?.assignedOperatorUserId, "operator-1");

      const underReview = await updateArbitrationCaseStatus("operator-1", arbitrationCase.id, {
        status: "under_review",
      });
      assert.equal(underReview.status, "under_review");

      const secondRound = await advanceArbitrationReviewRound("operator-1", arbitrationCase.id, {
        summary: "Escalate to a second operator review round.",
        assignToOperatorUserId: "operator-2",
      });
      assert.equal(secondRound.currentReviewRoundNumber, 2);
      assert.equal(secondRound.assignedOperatorUserId, "operator-2");
      assert.equal(secondRound.reviewRounds.length, 2);
      assert.equal(secondRound.reviewRounds[0]?.status, "completed");
      assert.equal(secondRound.reviewRounds[1]?.status, "open");
      assert.equal(secondRound.reviewRounds[1]?.assignedOperatorUserId, "operator-2");

      await assert.rejects(
        () => releaseArbitrationCase("operator-1", arbitrationCase.id),
        (error: unknown) => isHttpError(error, 409, /claimed by another operator/i),
      );

      const released = await releaseArbitrationCase("operator-2", arbitrationCase.id);
      assert.equal(released.assignedOperatorUserId, null);
      assert.equal(released.reviewRounds[1]?.assignedOperatorUserId, null);
    } finally {
      coreRedis?.disconnect();
      accountRedis?.disconnect();
      await accountPool?.end().catch(() => undefined);
      await corePool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
