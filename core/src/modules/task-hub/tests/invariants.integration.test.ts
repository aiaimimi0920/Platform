import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

if (!databaseUrl) {
  test("task-hub integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for task-hub integration coverage");
  });
} else {
  test("task hub preserves escrow, settlement, default, and cancel invariants", { timeout: 120_000 }, async () => {
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
      const {
        advanceTaskLifecycle,
        applyToTask,
        createTask,
        createTaskDraft,
        getTaskSummary,
        listTasks,
      } = await import("../service");
      const { getWalletSummary, grantBalance } = await import(
        "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js"
      );
      ({ pgPool: corePool } = await import("../../../db/client"));
      ({ redis: coreRedis } = await import("../../../db/redis"));
      ({ pgPool: accountPool } = await import("../../../../../packages/account-domain/dist/db/client.js"));
      ({ redis: accountRedis } = await import("../../../../../packages/account-domain/dist/db/redis.js"));

      const corePoolWithEvents = corePool as { on?: (event: string, listener: () => void) => unknown } | null;
      const accountPoolWithEvents = accountPool as { on?: (event: string, listener: () => void) => unknown } | null;
      if (typeof corePoolWithEvents?.on === "function") {
        corePoolWithEvents.on("error", () => undefined);
      }
      if (typeof accountPoolWithEvents?.on === "function") {
        accountPoolWithEvents.on("error", () => undefined);
      }

      await pool.query(`
        insert into users (id, username, email, avatar_url, trust_level, created_at, updated_at, last_login_at)
        values
          ('creator-1', 'creator-1', 'creator-1@example.test', null, 3, now(), now(), now()),
          ('worker-a', 'worker-a', 'worker-a@example.test', null, 2, now(), now(), now()),
          ('worker-b', 'worker-b', 'worker-b@example.test', null, 2, now(), now(), now()),
          ('worker-c', 'worker-c', 'worker-c@example.test', null, 2, now(), now(), now()),
          ('worker-d', 'worker-d', 'worker-d@example.test', null, 2, now(), now(), now()),
          ('worker-e', 'worker-e', 'worker-e@example.test', null, 2, now(), now(), now()),
          ('worker-f', 'worker-f', 'worker-f@example.test', null, 2, now(), now(), now())
      `);

      for (const [userId, amount] of [
        ["creator-1", 500],
        ["worker-a", 100],
        ["worker-b", 100],
        ["worker-c", 100],
        ["worker-d", 100],
        ["worker-e", 100],
        ["worker-f", 100],
      ] as const) {
        await grantBalance(userId, "obsidian", amount, "task-hub integration seed");
      }

      const acceptedTask = await createTask("creator-1", {
        title: "Accepted task",
        description: "Covers reward escrow and happy-path settlement.",
        preferredCapabilityCodes: [],
        pricingMode: "flat_task",
        billingUnit: null,
        meterKey: null,
        meterQuantity: null,
        operationMode: "manual",
        rewardCurrency: "obsidian",
        rewardAmount: 120,
        requiredBondAmount: 30,
      });
      await applyToTask("worker-a", acceptedTask.id, "I can do it first", 24);
      await applyToTask("worker-b", acceptedTask.id, "I am slower", 48);

      let acceptedSummary = await getTaskSummary(acceptedTask.id);
      assert.ok(acceptedSummary);
      assert.equal(acceptedSummary.status, "assigned");
      assert.equal(acceptedSummary.assignedUserId, "worker-a");

      await advanceTaskLifecycle("worker-a", acceptedTask.id, "start");
      await advanceTaskLifecycle("worker-a", acceptedTask.id, "submit");
      acceptedSummary = await advanceTaskLifecycle("creator-1", acceptedTask.id, "accept");
      assert.equal(acceptedSummary.status, "accepted");

      const defaultedTask = await createTask("creator-1", {
        title: "Defaulted task",
        description: "Covers bond forfeiture and reward refund.",
        preferredCapabilityCodes: [],
        pricingMode: "flat_task",
        billingUnit: null,
        meterKey: null,
        meterQuantity: null,
        operationMode: "manual",
        rewardCurrency: "obsidian",
        rewardAmount: 90,
        requiredBondAmount: 20,
      });
      await applyToTask("worker-c", defaultedTask.id, "I should win", 12);
      await applyToTask("worker-d", defaultedTask.id, "I should lose", 72);

      let defaultedSummary = await getTaskSummary(defaultedTask.id);
      assert.ok(defaultedSummary);
      assert.equal(defaultedSummary.status, "assigned");
      assert.equal(defaultedSummary.assignedUserId, "worker-c");
      defaultedSummary = await advanceTaskLifecycle("creator-1", defaultedTask.id, "default");
      assert.equal(defaultedSummary.status, "defaulted");

      const cancelledTask = await createTask("creator-1", {
        title: "Cancelled task",
        description: "Covers reward refund and bond release on cancel.",
        preferredCapabilityCodes: [],
        pricingMode: "flat_task",
        billingUnit: null,
        meterKey: null,
        meterQuantity: null,
        operationMode: "manual",
        rewardCurrency: "obsidian",
        rewardAmount: 50,
        requiredBondAmount: 10,
      });
      await applyToTask("worker-e", cancelledTask.id, "I can do it", 18);
      await applyToTask("worker-f", cancelledTask.id, "Backup option", 36);

      let cancelledSummary = await getTaskSummary(cancelledTask.id);
      assert.ok(cancelledSummary);
      assert.equal(cancelledSummary.status, "assigned");
      assert.equal(cancelledSummary.assignedUserId, "worker-e");
      cancelledSummary = await advanceTaskLifecycle("creator-1", cancelledTask.id, "cancel");
      assert.equal(cancelledSummary.status, "cancelled");

      const draftResult = await createTaskDraft("creator-1", {
        title: "Private draft",
        description: "Remains outside the public task directory.",
        preferredCapabilityCodes: ["release"],
        idempotencyKey: "task-hub-integration-private-draft",
      });
      const listedTasks = await listTasks();
      const acceptedListItem = listedTasks.find((task) => task.id === acceptedTask.id);
      assert.equal(acceptedListItem?.applicationCount, 2);
      assert.equal(acceptedListItem?.arbitrationCaseCount, 0);
      assert.equal(listedTasks.some((task) => task.id === draftResult.task.id), false);

      const creatorWallet = await getWalletSummary("creator-1");
      const workerAWallet = await getWalletSummary("worker-a");
      const workerBWallet = await getWalletSummary("worker-b");
      const workerCWallet = await getWalletSummary("worker-c");
      const workerDWallet = await getWalletSummary("worker-d");
      const workerEWallet = await getWalletSummary("worker-e");
      const workerFWallet = await getWalletSummary("worker-f");
      const escrowWallet = await getWalletSummary("platform:task_reward_escrow");

      assert.deepEqual(creatorWallet.balances.obsidian, { available: 400, frozen: 0 });
      assert.deepEqual(workerAWallet.balances.obsidian, { available: 220, frozen: 0 });
      assert.deepEqual(workerBWallet.balances.obsidian, { available: 100, frozen: 0 });
      assert.deepEqual(workerCWallet.balances.obsidian, { available: 80, frozen: 0 });
      assert.deepEqual(workerDWallet.balances.obsidian, { available: 100, frozen: 0 });
      assert.deepEqual(workerEWallet.balances.obsidian, { available: 100, frozen: 0 });
      assert.deepEqual(workerFWallet.balances.obsidian, { available: 100, frozen: 0 });
      assert.deepEqual(escrowWallet.balances.obsidian, { available: 0, frozen: 0 });

      const holdStatuses = await pool.query<{
        hold_type: string;
        status: string;
        task_id: string;
      }>(
        `select 'bond' as hold_type, status, task_id from bond_holds
         union all
         select 'reward' as hold_type, status, task_id from task_reward_holds
         order by hold_type, task_id`,
      );
      assert.deepEqual(
        holdStatuses.rows.map((row) => `${row.hold_type}:${row.task_id}:${row.status}`).sort(),
        [
          `bond:${acceptedTask.id}:released`,
          `bond:${acceptedTask.id}:released`,
          `bond:${cancelledTask.id}:released`,
          `bond:${cancelledTask.id}:released`,
          `bond:${defaultedTask.id}:forfeited`,
          `bond:${defaultedTask.id}:released`,
          `reward:${acceptedTask.id}:paid`,
          `reward:${cancelledTask.id}:refunded`,
          `reward:${defaultedTask.id}:refunded`,
        ].sort(),
      );
    } finally {
      coreRedis?.disconnect();
      accountRedis?.disconnect();
      await corePool?.end().catch(() => undefined);
      await accountPool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
