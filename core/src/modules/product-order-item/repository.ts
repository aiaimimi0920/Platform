import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  itemFulfillmentRuns,
  itemIssueReports,
  itemManualReviews,
  itemReplacementLogs,
  itemUnits,
  items,
  orders,
  products,
} from "@/modules/product-order-item/schema";

export async function listActiveProducts() {
  return db.select().from(products).where(eq(products.active, true));
}

export async function getProductById(productId: string) {
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  return product ?? null;
}

export async function listItemsByUser(userId: string) {
  return db.select().from(items).where(eq(items.userId, userId));
}

export async function getItemById(itemId: string) {
  const [item] = await db.select().from(items).where(eq(items.id, itemId));
  return item ?? null;
}

export async function listItemUnitsByItemIds(itemIds: string[]) {
  if (itemIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(itemUnits)
    .where(inArray(itemUnits.itemId, itemIds))
    .orderBy(asc(itemUnits.slotNumber), asc(itemUnits.generation), asc(itemUnits.createdAt));
}

export async function getItemUnitById(unitId: string) {
  const [unit] = await db.select().from(itemUnits).where(eq(itemUnits.id, unitId));
  return unit ?? null;
}

export async function listItemIssueReportsByItemIds(itemIds: string[]) {
  if (itemIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(itemIssueReports)
    .where(inArray(itemIssueReports.itemId, itemIds))
    .orderBy(asc(itemIssueReports.createdAt));
}

export async function listItemReplacementLogsByItemIds(itemIds: string[]) {
  if (itemIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(itemReplacementLogs)
    .where(inArray(itemReplacementLogs.itemId, itemIds))
    .orderBy(asc(itemReplacementLogs.createdAt));
}

export async function listItemFulfillmentRunsByItemIds(itemIds: string[]) {
  if (itemIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(itemFulfillmentRuns)
    .where(inArray(itemFulfillmentRuns.itemId, itemIds))
    .orderBy(asc(itemFulfillmentRuns.createdAt));
}

export async function listItemManualReviewsByItemIds(itemIds: string[]) {
  if (itemIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(itemManualReviews)
    .where(inArray(itemManualReviews.itemId, itemIds))
    .orderBy(asc(itemManualReviews.createdAt));
}

export async function listOrdersByUser(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}
