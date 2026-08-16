import type {
  ItemView,
  OrderDiscountSource,
  OrderView,
  ProductCurrency,
  RollbackOrderInput,
  RollbackOrderResult,
} from "@neuro/contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  deductBalance,
  refundBalance,
} from "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";

import { db } from "@/db/client";
import {
  createProductGatewayAccessGrantInTx,
  revokeProductGatewayAccessGrantsInTx,
  syncProductGatewayAccessGrantByItem,
} from "@/modules/product-order-item/gateway-access-grants";
import {
  listItemFulfillmentRunsByItemIds,
  listItemIssueReportsByItemIds,
  listItemManualReviewsByItemIds,
  listOrdersByUser,
  listItemReplacementLogsByItemIds,
  listItemsByUser,
  listItemUnitsByItemIds,
} from "@/modules/product-order-item/repository";
import {
  discountCodes,
  discountCodeUsages,
  itemManualReviews,
  items,
  itemUnits,
  orders,
  products,
} from "@/modules/product-order-item/schema";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import { ensureDefaultDiscountCodes, resolveDiscountForOrder } from "./discount-codes";
import {
  buildManualReviewAssignmentHistoryMap,
  buildUnitCode,
  toItemView,
  toOrderView,
} from "./item-views";
import { assertProductPurchaseEligibility, ensureDefaultProducts } from "./product-catalog";
import { isPlatformOperator, normalizeOptionalText, now, type DbTx } from "./shared";

function buildItemExpiry(product: typeof products.$inferSelect, createdAt: Date) {
  if (product.fulfillmentMode !== "duration_pass" || !product.durationDays) {
    return null;
  }

  return new Date(createdAt.getTime() + product.durationDays * 24 * 60 * 60 * 1000);
}

function buildWarrantyExpiry(product: typeof products.$inferSelect, createdAt: Date) {
  if (!product.warrantyDays) {
    return null;
  }

  return new Date(createdAt.getTime() + product.warrantyDays * 24 * 60 * 60 * 1000);
}

function buildInitialRemainingUses(product: typeof products.$inferSelect) {
  if (product.fulfillmentMode === "one_time_delivery" && !product.unitCount) {
    return 1;
  }

  return null;
}

async function createItemUnitsInTx(args: {
  tx: DbTx;
  itemId: string;
  unitCount: number;
  createdAt: Date;
  unitExpiresAt: Date | null;
}) {
  if (args.unitCount <= 0) {
    return [];
  }

  const rows = Array.from({ length: args.unitCount }, (_, index) => {
    const slotNumber = index + 1;
    return {
      id: crypto.randomUUID(),
      itemId: args.itemId,
      slotNumber,
      generation: 1,
      code: buildUnitCode(slotNumber, 1),
      status: "active",
      issueReason: null,
      activatedAt: args.createdAt,
      expiresAt: args.unitExpiresAt,
      replacedByUnitId: null,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    };
  });

  return args.tx.insert(itemUnits).values(rows).returning();
}

async function createGrantedItemInTx(args: {
  tx: DbTx;
  userId: string;
  product: typeof products.$inferSelect;
  orderId: string | null;
}) {
  const createdAt = now();
  const expiresAt = buildItemExpiry(args.product, createdAt);
  const warrantyExpiresAt = buildWarrantyExpiry(args.product, createdAt);
  const totalUnits = args.product.unitCount ?? null;
  const activeUnits = totalUnits;

  const [item] = await args.tx
    .insert(items)
    .values({
      id: crypto.randomUUID(),
      userId: args.userId,
      productId: args.product.id,
      orderId: args.orderId,
      productTitle: args.product.title,
      fulfillmentMode: args.product.fulfillmentMode,
      transferable: args.product.transferable,
      status: "active",
      remainingUses: buildInitialRemainingUses(args.product),
      totalUnits,
      activeUnits,
      replacementCount: 0,
      revokedAt: null,
      revokedByUserId: null,
      revocationReason: null,
      warrantyExpiresAt,
      lastReconciledAt: null,
      expiresAt,
      createdAt,
    })
    .returning();

  const createdUnits = totalUnits
    ? await createItemUnitsInTx({
        tx: args.tx,
        itemId: item.id,
        unitCount: totalUnits,
        createdAt,
        unitExpiresAt: warrantyExpiresAt,
      })
    : [];

  await createProductGatewayAccessGrantInTx({
    tx: args.tx,
    itemId: item.id,
    orderId: args.orderId,
    userId: args.userId,
    product: args.product,
    grantedAt: createdAt,
  });

  await enqueueOutboxEvent(
    "item.granted",
    {
      userId: args.userId,
      itemId: item.id,
      productId: args.product.id,
    },
    args.tx,
  );

  return {
    itemRow: item,
    itemView: toItemView(item, createdUnits),
  };
}

function buildGroupedMap<Row extends { itemId: string }>(rows: Row[]) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const existing = grouped.get(row.itemId) ?? [];
    existing.push(row);
    grouped.set(row.itemId, existing);
  }
  return grouped;
}

export async function grantItemDirect(
  userId: string,
  productId: string,
  tx: DbTx = db,
): Promise<ItemView> {
  const product = await tx.query.products.findFirst({
    where: (row, operators) => operators.eq(row.id, productId),
  });

  if (!product) {
    throw new NotFoundError(`Unknown product ${productId}`);
  }

  const { itemView } = await createGrantedItemInTx({
    tx,
    userId,
    product,
    orderId: null,
  });

  return itemView;
}

export async function createOrder(
  userId: string,
  productId: string,
  discountCodeInput?: string,
): Promise<{ order: OrderView; item: ItemView }> {
  await ensureDefaultProducts();
  await ensureDefaultDiscountCodes();

  const result = await db.transaction(async (tx) => {
    const product = await tx.query.products.findFirst({
      where: (row, operators) => operators.eq(row.id, productId),
    });

    if (!product || !product.active) {
      throw new BadRequestError("Product not available");
    }

    await assertProductPurchaseEligibility(tx, userId, product);

    const discountResolution = await resolveDiscountForOrder({
      tx,
      userId,
      product,
      discountCodeInput,
    });

    const orderId = crypto.randomUUID();
    const purchaseNote = discountResolution.discountLabel
      ? `购买商品：${product.title}（${discountResolution.discountLabel}）`
      : `购买商品：${product.title}`;

    if (discountResolution.finalAmount > 0) {
      await deductBalance(
        userId,
        product.currency as ProductCurrency,
        discountResolution.finalAmount,
        purchaseNote,
        "order",
        orderId,
        tx,
      );
    }

    const [order] = await tx
      .insert(orders)
      .values({
        id: orderId,
        userId,
        productId: product.id,
        currency: product.currency,
        amount: discountResolution.finalAmount,
        originalAmount: product.price,
        discountAmount: discountResolution.discountAmount,
        finalAmount: discountResolution.finalAmount,
        discountCodeId: discountResolution.discountCode?.id ?? null,
        discountCode: discountResolution.appliedCode,
        status: "created",
        rolledBackAt: null,
        rolledBackByUserId: null,
        rollbackReason: null,
        rollbackNote: null,
        createdAt: now(),
      })
      .returning();

    if (discountResolution.discountCode) {
      await tx.insert(discountCodeUsages).values({
        id: crypto.randomUUID(),
        discountCodeId: discountResolution.discountCode.id,
        userId,
        orderId: order.id,
        createdAt: now(),
      });

      await tx
        .update(discountCodes)
        .set({
          usedCount: discountResolution.discountCode.usedCount + 1,
          updatedAt: now(),
        })
        .where(eq(discountCodes.id, discountResolution.discountCode.id));
    }

    const grantedItem = await createGrantedItemInTx({
      tx,
      userId,
      product,
      orderId: order.id,
    });

    await tx.update(orders).set({ status: "fulfilled" }).where(eq(orders.id, order.id));

    await enqueueOutboxEvent(
      "product.purchased",
      {
        userId,
        orderId: order.id,
        productId: product.id,
        discountCode: discountResolution.appliedCode,
        discountSource: discountResolution.source,
        discountLabel: discountResolution.discountLabel,
        finalAmount: discountResolution.finalAmount,
      },
      tx,
    );

    return {
      order: toOrderView(
        { ...order, status: "fulfilled", discountCode: discountResolution.appliedCode },
        product,
        {
          discountSource: discountResolution.source,
          discountLabel: discountResolution.discountLabel,
        },
      ),
      item: grantedItem.itemView,
      syncItemId: grantedItem.itemRow.id,
    };
  });

  try {
    await syncProductGatewayAccessGrantByItem(result.syncItemId);
  } catch (error) {
    console.warn(
      `[core] failed to sync gateway bundle grant for item ${result.syncItemId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return {
    order: result.order,
    item: result.item,
  };
}

export async function rollbackOrderAsOperator(
  operatorUserId: string,
  orderId: string,
  input: RollbackOrderInput = {},
): Promise<RollbackOrderResult> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can rollback orders");
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from orders where id = ${orderId} for update`);

    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      throw new NotFoundError("订单不存在");
    }
    if (order.status === "rolled_back") {
      throw new ConflictError("该订单已经回退");
    }
    if (order.status !== "fulfilled") {
      throw new ConflictError("当前仅支持回退已履约订单");
    }

    const [product] = await tx.select().from(products).where(eq(products.id, order.productId)).limit(1);
    if (!product) {
      throw new NotFoundError("订单对应商品不存在");
    }

    const relatedItems = await tx.select().from(items).where(eq(items.orderId, order.id));
    const relatedItemIds = relatedItems.map((item) => item.id);

    if (relatedItems.some((item) => item.userId !== order.userId)) {
      throw new ConflictError("关联资产已经发生转移，当前不能自动回退");
    }
    if (relatedItems.some((item) => item.status !== "active")) {
      throw new ConflictError("当前仅支持回退仍处于 active 的关联资产");
    }

    if (relatedItemIds.length > 0) {
      const [openReview] = await tx
        .select({ id: itemManualReviews.id })
        .from(itemManualReviews)
        .where(and(inArray(itemManualReviews.itemId, relatedItemIds), eq(itemManualReviews.status, "open")))
        .limit(1);
      if (openReview) {
        throw new ConflictError("存在未完成的人工复核，暂不可自动回退该订单");
      }
    }

    const rollbackReason = normalizeOptionalText(input.reason);
    const rollbackNote = normalizeOptionalText(input.note);
    const timestamp = now();

    if (order.finalAmount > 0) {
      const ledgerNote = rollbackReason
        ? `订单回退：${product.title}（${rollbackReason}）`
        : `订单回退：${product.title}`;
      await refundBalance(
        order.userId,
        product.currency as ProductCurrency,
        order.finalAmount,
        rollbackNote ? `${ledgerNote}｜${rollbackNote}` : ledgerNote,
        "orderRollback",
        order.id,
        tx,
      );
    }

    if (order.discountCodeId) {
      await tx.delete(discountCodeUsages).where(eq(discountCodeUsages.orderId, order.id));
      const [discountCode] = await tx
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.id, order.discountCodeId))
        .limit(1);
      if (discountCode) {
        await tx
          .update(discountCodes)
          .set({
            usedCount: Math.max(0, discountCode.usedCount - 1),
            updatedAt: timestamp,
          })
          .where(eq(discountCodes.id, discountCode.id));
      }
    }

    if (relatedItemIds.length > 0) {
      await revokeProductGatewayAccessGrantsInTx({
        tx,
        itemIds: relatedItemIds,
        revokedAt: timestamp,
      });

      await tx
        .update(itemUnits)
        .set({
          status: "inactive",
          issueReason: "invalidated",
          updatedAt: timestamp,
        })
        .where(inArray(itemUnits.itemId, relatedItemIds));

      await tx
        .update(items)
        .set({
          status: "revoked",
          remainingUses: 0,
          activeUnits: 0,
          revokedAt: timestamp,
          revokedByUserId: operatorUserId,
          revocationReason: rollbackReason ?? "order_rollback",
        })
        .where(inArray(items.id, relatedItemIds));
    }

    const [updatedOrder] = await tx
      .update(orders)
      .set({
        status: "rolled_back",
        rolledBackAt: timestamp,
        rolledBackByUserId: operatorUserId,
        rollbackReason,
        rollbackNote,
      })
      .where(eq(orders.id, order.id))
      .returning();

    await enqueueOutboxEvent(
      "product.orderRolledBack",
      {
        orderId: order.id,
        userId: order.userId,
        productId: order.productId,
        operatorUserId,
        refundedAmount: order.finalAmount,
        rollbackReason,
        rollbackNote,
        itemIds: relatedItemIds,
      },
      tx,
    );

    const updatedItemRows =
      relatedItemIds.length > 0 ? await tx.select().from(items).where(inArray(items.id, relatedItemIds)) : [];
    const updatedUnitRows =
      relatedItemIds.length > 0
        ? await tx
            .select()
            .from(itemUnits)
            .where(inArray(itemUnits.itemId, relatedItemIds))
            .orderBy(asc(itemUnits.slotNumber), asc(itemUnits.generation), asc(itemUnits.createdAt))
        : [];
    const unitsByItemId = buildGroupedMap(updatedUnitRows);

    return {
      order: toOrderView(updatedOrder, product, {
        discountSource: (order.discountCode ? "code" : "none") as OrderDiscountSource,
        discountLabel: order.discountCode
          ? `优惠码：${order.discountCode}`
          : order.discountAmount > 0
            ? "已应用折扣"
            : null,
      }),
      items: updatedItemRows.map((item) => toItemView(item, unitsByItemId.get(item.id) ?? [])),
      refundedAmount: order.finalAmount,
      syncItemIds: relatedItemIds,
    };
  });

  for (const itemId of result.syncItemIds) {
    try {
      await syncProductGatewayAccessGrantByItem(itemId);
    } catch (error) {
      console.warn(
        `[core] failed to sync gateway bundle grant rollback for item ${itemId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    order: result.order,
    items: result.items,
    refundedAmount: result.refundedAmount,
  };
}

export async function getUserItems(userId: string): Promise<ItemView[]> {
  const rows = await listItemsByUser(userId);
  const unitRows = await listItemUnitsByItemIds(rows.map((row) => row.id));
  const issueReportRows = await listItemIssueReportsByItemIds(rows.map((row) => row.id));
  const manualReviewRows = await listItemManualReviewsByItemIds(rows.map((row) => row.id));
  const manualReviewAssignmentHistoryByReviewId = await buildManualReviewAssignmentHistoryMap(
    manualReviewRows.map((row) => row.id),
  );
  const replacementLogRows = await listItemReplacementLogsByItemIds(rows.map((row) => row.id));
  const fulfillmentRunRows = await listItemFulfillmentRunsByItemIds(rows.map((row) => row.id));
  const unitsByItemId = buildGroupedMap(unitRows);
  const issueReportsByItemId = buildGroupedMap(issueReportRows);
  const manualReviewsByItemId = buildGroupedMap(manualReviewRows);
  const replacementLogsByItemId = buildGroupedMap(replacementLogRows);
  const fulfillmentRunsByItemId = buildGroupedMap(fulfillmentRunRows);

  return rows.map((row) =>
    toItemView(
      row,
      unitsByItemId.get(row.id) ?? [],
      issueReportsByItemId.get(row.id) ?? [],
      manualReviewsByItemId.get(row.id) ?? [],
      replacementLogsByItemId.get(row.id) ?? [],
      fulfillmentRunsByItemId.get(row.id) ?? [],
      manualReviewAssignmentHistoryByReviewId,
    ),
  );
}

export async function getUserOrders(userId: string): Promise<OrderView[]> {
  await ensureDefaultProducts();
  const orderRows = await listOrdersByUser(userId);
  if (orderRows.length === 0) {
    return [];
  }

  const productIds = Array.from(new Set(orderRows.map((row) => row.productId)));
  const productRows = await db.select().from(products).where(inArray(products.id, productIds));
  const productById = new Map(productRows.map((row) => [row.id, row]));

  return orderRows
    .map((order) => {
      const product = productById.get(order.productId);
      if (!product) {
        return null;
      }
      return toOrderView(order, product, {
        discountSource: (order.discountCode ? "code" : "none") as OrderDiscountSource,
        discountLabel: order.discountCode
          ? `优惠码：${order.discountCode}`
          : order.discountAmount > 0
            ? "已应用折扣"
            : null,
      });
    })
    .filter((order): order is OrderView => Boolean(order));
}
