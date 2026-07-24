import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

if (!databaseUrl) {
  test("wallet-ledger integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for wallet-ledger integration coverage");
  });
} else {
  test(
    "wallet ledger preserves balance invariants across grant, deduct, freeze, and unfreeze",
    { timeout: 120_000 },
    async () => {
    const pool = new Pool({
        connectionString: databaseUrl,
      max: 1,
    });
    pool.on("error", () => undefined);
    let accountPool: { end: () => Promise<void> } | null = null;

    try {
      const {
        deductBalance,
        ensureUserWallet,
        freezeBalance,
        getWalletSummary,
        grantBalance,
        unfreezeBalance,
      } = await import("../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js");
      ({ pgPool: accountPool } = await import("../../../../../packages/account-domain/dist/db/client.js"));

      const accountPoolWithEvents = accountPool as { on?: (event: string, listener: () => void) => unknown } | null;
      if (typeof accountPoolWithEvents?.on === "function") {
        accountPoolWithEvents.on("error", () => undefined);
      }

      const userId = "wallet-owner";

      await ensureUserWallet(userId);

      const initialSummary = await getWalletSummary(userId);
      assert.deepEqual(initialSummary.balances, {
        obsidian: { available: 0, frozen: 0 },
        mira: { available: 0, frozen: 0 },
        opinionTickets: { available: 0, frozen: 0 },
      });
      assert.equal(initialSummary.recentEntries.length, 0);

      await grantBalance(userId, "obsidian", 120, "integration grant");
      await deductBalance(userId, "obsidian", 30, "integration deduct");
      await freezeBalance(userId, "obsidian", 40, "integration freeze");
      await unfreezeBalance(userId, "obsidian", 10, "integration unfreeze");

      const summary = await getWalletSummary(userId);
      assert.deepEqual(summary.balances.obsidian, {
        available: 60,
        frozen: 30,
      });
      assert.deepEqual(
        summary.recentEntries.map((entry) => entry.entryType),
        ["unfreeze", "freeze", "deduct", "grant"],
      );

      await assert.rejects(
        () => deductBalance(userId, "obsidian", -5, "negative deduct must fail"),
        /greater than 0/i,
      );

      await assert.rejects(
        () => deductBalance(userId, "obsidian", 10_000, "overspend must fail"),
        /insufficient balance/i,
      );

      const unchangedSummary = await getWalletSummary(userId);
      assert.deepEqual(unchangedSummary.balances.obsidian, {
        available: 60,
        frozen: 30,
      });

      const outboxCounts = await pool.query<{ event_name: string; count: string }>(
        `select event_name, count(*)::text as count
           from outbox_events
          where event_name like 'wallet.%'
          group by event_name
          order by event_name`,
      );
      assert.deepEqual(outboxCounts.rows, [
        {
          event_name: "wallet.changed",
          count: "4",
        },
      ]);
    } finally {
      await accountPool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
    },
  );
}
