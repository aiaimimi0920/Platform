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

if (!databaseUrl) {
  test("opinion-hub integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for opinion-hub integration coverage");
  });
} else {
  test("opinion topics consume tickets, track support and oppose votes, and settle into the development queue", { timeout: 120_000 }, async () => {
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
          ('opinion-creator', 'opinion-creator', 'opinion-creator@example.test', null, 4, now(), now(), now()),
          ('opinion-supporter', 'opinion-supporter', 'opinion-supporter@example.test', null, 1, now(), now(), now()),
          ('opinion-opposer', 'opinion-opposer', 'opinion-opposer@example.test', null, 1, now(), now(), now())
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
          'opinion-progress-task',
          'opinion-creator',
          null,
          'Progress unlock task',
          'Unlocks opinion creation level.',
          '[]'::jsonb,
          'flat_task',
          null,
          null,
          null,
          'manual',
          'obsidian',
          1,
          0,
          'open',
          null,
          now()
        )
      `);

      const opinionService = resolveModuleExports(await import("../service"));
      const {
        createOpinionTopic,
        opposeOpinionTopic,
        runOpinionMonthlyLeaderSettlement,
        supportOpinionTopic,
      } = opinionService as typeof import("../service");
      const walletModule = resolveModuleExports(
        await import("../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js"),
      ) as typeof import("../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js");
      const { getWalletSummary, grantBalance } = walletModule;
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

      await grantBalance("opinion-creator", "opinionTickets", 40, "seed creator tickets");
      await grantBalance("opinion-supporter", "opinionTickets", 5, "seed supporter tickets");
      await grantBalance("opinion-opposer", "opinionTickets", 5, "seed opposer tickets");

      const qualifiedTopic = await createOpinionTopic("opinion-creator", {
        title: "Qualified queue candidate",
        description: "This topic should settle into the queue.",
        tag: "newFeature",
      });
      assert.equal(qualifiedTopic.reviewStatus, "published");
      assert.equal(qualifiedTopic.status, "collecting");

      await pool.query(
        `
          update opinion_topics
             set target_support_count = 1,
                 created_at = now() - interval '40 days',
                 updated_at = now() - interval '40 days'
           where id = $1
        `,
        [qualifiedTopic.id],
      );

      const supportedTopic = await supportOpinionTopic("opinion-supporter", qualifiedTopic.id, 1);
      assert.equal(supportedTopic.status, "qualified");
      assert.equal(supportedTopic.supportTicketTotal, 1);
      assert.equal(supportedTopic.opposeTicketTotal, 0);
      assert.equal(supportedTopic.uniqueSupporterCount, 1);

      const settlement = await runOpinionMonthlyLeaderSettlement(1);
      assert.equal(settlement.skipped, false);
      assert.equal(settlement.queuedCount, 1);
      assert.equal(settlement.queueItemIds.length, 1);

      const queueItemResult = await pool.query<{
        source_id: string;
        source_type: string;
        status: string;
      }>(
        `
          select source_id, source_type, status
            from development_queue_items
           where id = $1
        `,
        [settlement.queueItemIds[0]],
      );
      assert.deepEqual(queueItemResult.rows[0], {
        source_id: qualifiedTopic.id,
        source_type: "opinionTopic",
        status: "queued",
      });

      const opposedTopic = await createOpinionTopic("opinion-creator", {
        title: "Opposed topic",
        description: "This topic should stay collecting after an oppose vote.",
        tag: "flowOptimization",
      });
      await pool.query("update opinion_topics set target_support_count = 2 where id = $1", [opposedTopic.id]);

      const opposedResult = await opposeOpinionTopic("opinion-opposer", opposedTopic.id, 1);
      assert.equal(opposedResult.status, "collecting");
      assert.equal(opposedResult.supportTicketTotal, 0);
      assert.equal(opposedResult.opposeTicketTotal, 1);
      assert.equal(opposedResult.uniqueOpposerCount, 1);

      const creatorWallet = await getWalletSummary("opinion-creator");
      const supporterWallet = await getWalletSummary("opinion-supporter");
      const opposerWallet = await getWalletSummary("opinion-opposer");
      const poolWallet = await getWalletSummary("platform:opinion_ticket_pool");

      assert.deepEqual(creatorWallet.balances.opinionTickets, { available: 20, frozen: 0 });
      assert.deepEqual(supporterWallet.balances.opinionTickets, { available: 4, frozen: 0 });
      assert.deepEqual(opposerWallet.balances.opinionTickets, { available: 4, frozen: 0 });
      assert.deepEqual(poolWallet.balances.opinionTickets, { available: 22, frozen: 0 });
    } finally {
      coreRedis?.disconnect();
      accountRedis?.disconnect();
      await corePool?.end().catch(() => undefined);
      await accountPool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
