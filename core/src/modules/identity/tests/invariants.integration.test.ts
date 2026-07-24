import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

if (!databaseUrl) {
  test("identity integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for identity integration coverage");
  });
} else {
  test("linux.do identity upsert creates once and updates in place on repeat login", { timeout: 120_000 }, async () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });
  pool.on("error", () => undefined);

  let corePool: { end: () => Promise<void> } | null = null;
  let accountPool: { end: () => Promise<void> } | null = null;

  try {
    const { getUserSummary, upsertLinuxDoUser } = await import("../service");
    ({ pgPool: corePool } = await import("../../../db/client"));
    ({ pgPool: accountPool } = await import("../../../../../packages/account-domain/dist/db/client.js"));

    const corePoolWithEvents = corePool as { on?: (event: string, listener: () => void) => unknown } | null;
    const accountPoolWithEvents = accountPool as { on?: (event: string, listener: () => void) => unknown } | null;
    if (typeof corePoolWithEvents?.on === "function") {
      corePoolWithEvents.on("error", () => undefined);
    }
    if (typeof accountPoolWithEvents?.on === "function") {
      accountPoolWithEvents.on("error", () => undefined);
    }

    const first = await upsertLinuxDoUser({
      id: "linuxdo-owner-1",
      username: "owner_one",
      email: "first@example.test",
      avatar_url: "https://example.test/avatar-1.png",
      trust_level: 2,
    });

    assert.equal(first.providerUserId, "linuxdo-owner-1");
    assert.equal(first.username, "owner_one");
    assert.equal(first.email, "first@example.test");
    assert.equal(first.avatarUrl, "https://example.test/avatar-1.png");
    assert.ok(first.snapshot?.wallet);
    assert.equal(first.snapshot.wallet.balances.obsidian.available, 0);
    assert.equal(first.snapshot.wallet.balances.mira.available, 0);

    const persisted = await getUserSummary(first.id);
    assert.ok(persisted);
    assert.equal(persisted.id, first.id);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const second = await upsertLinuxDoUser({
      id: "linuxdo-owner-1",
      username: "owner_one_renamed",
      email: "updated@example.test",
      avatar_url: "https://example.test/avatar-2.png",
      trust_level: 4,
    });

    assert.equal(second.id, first.id);
    assert.equal(second.providerUserId, first.providerUserId);
    assert.equal(second.username, "owner_one_renamed");
    assert.equal(second.email, "updated@example.test");
    assert.equal(second.avatarUrl, "https://example.test/avatar-2.png");
    assert.equal(second.trustLevel, 4);
    assert.ok(new Date(second.lastLoginAt).getTime() >= new Date(first.lastLoginAt).getTime());

    const counts = await pool.query<{
      identity_count: string;
      outbox_count: string;
      user_count: string;
    }>(
      `select
          (select count(*)::text from users) as user_count,
          (select count(*)::text from auth_identities where provider = 'linuxdo' and provider_user_id = $1) as identity_count,
          (select count(*)::text from outbox_events where event_name = 'user.registered') as outbox_count`,
      ["linuxdo-owner-1"],
    );

    assert.deepEqual(counts.rows[0], {
      user_count: "1",
      identity_count: "1",
      outbox_count: "1",
    });

    assert.equal(await getUserSummary("missing-user"), null);
  } finally {
    await corePool?.end().catch(() => undefined);
    await accountPool?.end().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
  });
}
