import assert from "node:assert/strict";
import test from "node:test";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

async function seedUser(
  pool: Pool,
  args: {
    userId: string;
    username: string;
    trustLevel?: number | null;
  },
) {
  await pool.query(
    `insert into users (
       id,
       username,
       email,
       avatar_url,
       profile_tagline,
       honor_showcased_agent_ids,
       honor_showcased_project_ids,
       honor_showcased_investment_project_ids,
       honor_showcased_issue_ids,
       honor_showcased_investment_issue_ids,
       trust_level,
       created_at,
       updated_at,
       last_login_at
     )
     values ($1, $2, $3, $4, null, null, null, null, null, null, $5, now(), now(), now())
     on conflict (id) do nothing`,
    [
      args.userId,
      args.username,
      `${args.username}@example.test`,
      `https://example.test/${args.username}.png`,
      args.trustLevel ?? null,
    ],
  );
}

if (!databaseUrl) {
  test("product-order-item integration requires DATABASE_URL from the embedded PostgreSQL harness", () => {
    throw new Error("DATABASE_URL is required for product-order-item integration coverage");
  });
} else {
  test("product orders deduct funds, create correct item shapes, and rollback safely", { timeout: 120_000 }, async () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });
  pool.on("error", () => undefined);

  let corePool: { end: () => Promise<void> } | null = null;
  let accountPool: { end: () => Promise<void> } | null = null;

  try {
    const {
      createOrder,
      getUserItems,
      getUserOrders,
      rollbackOrderAsOperator,
      upsertProductDefinitionAsOperator,
    } = await import("../service");
    const { getWalletSummary, grantBalance } = await import(
      "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js"
    );
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

    const operatorUserId = "operator-1";
    const buyerUserId = "order-buyer";
    const customProductId = "product_test_one_time_delivery";

    await seedUser(pool, {
      userId: buyerUserId,
      username: "order_buyer",
      trustLevel: 2,
    });
    await grantBalance(buyerUserId, "obsidian", 200, "seed buyer balance");

    await upsertProductDefinitionAsOperator(operatorUserId, customProductId, {
      slug: "test-one-time-delivery",
      title: "Test One Time Delivery",
      description: "Integration-only one time delivery product.",
      category: "artificial_intelligence",
      tags: ["integration"],
      kind: "unlimited",
      currency: "obsidian",
      price: 50,
      fulfillmentMode: "one_time_delivery",
      transferable: true,
      active: true,
      allowDiscountCodes: false,
      limitScope: "global",
      targetedAudienceGroupKey: null,
      durationDays: null,
      unitCount: null,
      warrantyDays: null,
      stockLabel: "test",
      gatewayAccessBundleId: null,
      gatewayAccessGrantMode: null,
      gatewayAccessGrantQuantity: null,
    });

    const durationOrder = await createOrder(buyerUserId, "product_codex_refill_1d");
    assert.equal(durationOrder.order.status, "fulfilled");
    assert.equal(durationOrder.order.finalAmount, 10);
    assert.ok(durationOrder.item.expiresAt);
    assert.equal(durationOrder.item.remainingUses, null);

    const oneTimeOrder = await createOrder(buyerUserId, customProductId);
    assert.equal(oneTimeOrder.order.status, "fulfilled");
    assert.equal(oneTimeOrder.order.finalAmount, 50);
    assert.equal(oneTimeOrder.item.remainingUses, 1);
    assert.equal(oneTimeOrder.item.expiresAt, null);

    const walletAfterPurchase = await getWalletSummary(buyerUserId);
    assert.equal(walletAfterPurchase.balances.obsidian.available, 140);
    assert.equal(walletAfterPurchase.balances.obsidian.frozen, 0);

    const userOrders = await getUserOrders(buyerUserId);
    assert.equal(userOrders.length, 2);
    assert.deepEqual(
      userOrders.map((order) => order.status),
      ["fulfilled", "fulfilled"],
    );

    const userItems = await getUserItems(buyerUserId);
    assert.equal(userItems.length, 2);

    await assert.rejects(
      () => rollbackOrderAsOperator("not-an-operator", oneTimeOrder.order.id, { reason: "unauthorized" }),
      /Only platform operators/i,
    );

    const rollbackResult = await rollbackOrderAsOperator(operatorUserId, oneTimeOrder.order.id, {
      reason: "integration_rollback",
      note: "verify refund and revoke",
    });
    assert.equal(rollbackResult.order.status, "rolled_back");
    assert.equal(rollbackResult.refundedAmount, 50);
    assert.equal(rollbackResult.items.length, 1);
    assert.equal(rollbackResult.items[0]?.status, "revoked");
    assert.equal(rollbackResult.items[0]?.remainingUses, 0);

    const walletAfterRollback = await getWalletSummary(buyerUserId);
    assert.equal(walletAfterRollback.balances.obsidian.available, 190);
    assert.equal(walletAfterRollback.balances.obsidian.frozen, 0);

    const orderStatusRows = await pool.query<{ status: string; rollback_reason: string | null }>(
      `select status, rollback_reason
         from orders
        where id = $1`,
      [oneTimeOrder.order.id],
    );
    assert.deepEqual(orderStatusRows.rows[0], {
      status: "rolled_back",
      rollback_reason: "integration_rollback",
    });

    const outboxCounts = await pool.query<{ event_name: string; count: string }>(
      `select event_name, count(*)::text as count
         from outbox_events
        where event_name in ('product.purchased', 'product.orderRolledBack')
        group by event_name
        order by event_name`,
    );
    assert.deepEqual(outboxCounts.rows, [
      {
        event_name: "product.orderRolledBack",
        count: "1",
      },
      {
        event_name: "product.purchased",
        count: "2",
      },
    ]);
  } finally {
    await corePool?.end().catch(() => undefined);
    await accountPool?.end().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
  });
}
