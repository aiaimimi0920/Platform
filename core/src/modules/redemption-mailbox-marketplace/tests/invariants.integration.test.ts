import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

if (!databaseUrl) {
  test("redemption-mailbox-marketplace integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for redemption-mailbox-marketplace integration coverage");
  });
} else {
  test("mailbox attachment claiming is concurrency-safe and idempotent", { timeout: 120_000 }, async () => {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 1,
    });
    pool.on("error", () => undefined);

    let corePool: { end: () => Promise<void> } | null = null;
    let coreRedis: { disconnect: () => void } | null = null;
    let walletModule:
      | {
          getWalletSummary: (userId: string) => Promise<{
            balances: Record<string, { available: number; frozen: number }>;
          }>;
        }
      | null = null;
    let accountPool: { end: () => Promise<void> } | null = null;
    let accountRedis: { disconnect: () => void } | null = null;

    try {
      await pool.query(`
        insert into users (id, username, email, avatar_url, trust_level, created_at, updated_at, last_login_at)
        values ('mail-owner', 'mail-owner', 'mail-owner@example.test', null, 3, now(), now(), now())
      `);

      const serviceModule = await import("../service");
      walletModule = await import("../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js");
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

      await serviceModule.createMailboxMessage({
        userId: "mail-owner",
        title: "Concurrency-safe reward delivery",
        body: "Claim me once even if multiple tabs retry together.",
        type: "reward",
        attachments: [{ kind: "currency", currency: "obsidian", amount: 15 }],
      });

      const mailboxBeforeClaim = await serviceModule.listMailbox("mail-owner");
      assert.equal(mailboxBeforeClaim.length, 1);
      assert.equal(mailboxBeforeClaim[0]?.pendingAttachmentCount, 1);

      const messageId = mailboxBeforeClaim[0]?.id;
      const attachmentId = mailboxBeforeClaim[0]?.attachments[0]?.id;
      assert.ok(messageId);
      assert.ok(attachmentId);

      const concurrentClaims = await Promise.all(
        Array.from({ length: 4 }, () =>
          serviceModule.claimAttachment("mail-owner", messageId, attachmentId),
        ),
      );

      assert.equal(new Set(concurrentClaims.map((attachment) => attachment.id)).size, 1);
      assert.equal(concurrentClaims.every((attachment) => attachment.claimedAt !== null), true);

      const wallet = await walletModule.getWalletSummary("mail-owner");
      assert.ok(wallet);
      assert.deepEqual(wallet.balances.obsidian, { available: 15, frozen: 0 });

      const mailboxAfterClaim = await serviceModule.listMailbox("mail-owner");
      assert.equal(mailboxAfterClaim.length, 1);
      assert.equal(mailboxAfterClaim[0]?.pendingAttachmentCount, 0);
      assert.equal(mailboxAfterClaim[0]?.claimedAttachmentCount, 1);
    } finally {
      coreRedis?.disconnect();
      accountRedis?.disconnect();
      await corePool?.end().catch(() => undefined);
      await accountPool?.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  });
}
