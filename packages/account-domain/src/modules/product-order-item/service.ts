import { and, eq, notInArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import { env } from "@/env";
import { products } from "@/modules/product-order-item/schema";
import {
  getCoreProductSnapshot,
  listCoreProductSnapshots,
  type CoreProductSnapshot,
} from "@/platform/core-integration/service";

type DbTx = NodePgDatabase<any>;

export type ProductShadowSyncResult = {
  mode: "synced" | "skipped";
  reason: string | null;
  fetchedCount: number;
  upsertedCount: number;
  deactivatedCount: number;
  syncedAt: string;
};

function toProductShadowValues(snapshot: CoreProductSnapshot) {
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    description: snapshot.description,
    category: snapshot.category,
    kind: snapshot.kind,
    currency: snapshot.currency,
    price: snapshot.price,
    fulfillmentMode: snapshot.fulfillmentMode,
    transferable: snapshot.transferable,
    active: snapshot.active,
    allowDiscountCodes: snapshot.allowDiscountCodes,
    limitScope: snapshot.limitScope,
    durationDays: snapshot.durationDays,
    unitCount: snapshot.unitCount,
    warrantyDays: snapshot.warrantyDays,
    stockLabel: snapshot.stockLabel,
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
  };
}

export async function upsertProductSnapshotInTx(args: {
  tx: DbTx;
  snapshot: CoreProductSnapshot;
}) {
  const values = toProductShadowValues(args.snapshot);
  const [product] = await args.tx
    .insert(products)
    .values(values)
    .onConflictDoUpdate({
      target: products.id,
      set: {
        slug: values.slug,
        title: values.title,
        description: values.description,
        category: values.category,
        kind: values.kind,
        currency: values.currency,
        price: values.price,
        fulfillmentMode: values.fulfillmentMode,
        transferable: values.transferable,
        active: values.active,
        allowDiscountCodes: values.allowDiscountCodes,
        limitScope: values.limitScope,
        durationDays: values.durationDays,
        unitCount: values.unitCount,
        warrantyDays: values.warrantyDays,
        stockLabel: values.stockLabel,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  return product;
}

export async function ensureProductSnapshotInTx(args: {
  tx: DbTx;
  productId: string;
}) {
  const [existing] = await args.tx.select().from(products).where(eq(products.id, args.productId)).limit(1);
  if (existing) {
    return existing;
  }

  if (!env.usesDedicatedDatabase) {
    return null;
  }

  const coreProduct = await getCoreProductSnapshot(args.productId);
  if (!coreProduct) {
    return null;
  }

  return upsertProductSnapshotInTx({
    tx: args.tx,
    snapshot: coreProduct,
  });
}

export async function refreshProductSnapshotInTx(args: {
  tx: DbTx;
  productId: string;
}) {
  if (!env.usesDedicatedDatabase) {
    const [existing] = await args.tx.select().from(products).where(eq(products.id, args.productId)).limit(1);
    return existing ?? null;
  }

  const coreProduct = await getCoreProductSnapshot(args.productId);
  if (!coreProduct) {
    const [existing] = await args.tx.select().from(products).where(eq(products.id, args.productId)).limit(1);
    return existing ?? null;
  }

  return upsertProductSnapshotInTx({
    tx: args.tx,
    snapshot: coreProduct,
  });
}

export async function deleteProductSnapshotInTx(args: {
  tx: DbTx;
  productId: string;
}) {
  const [deleted] = await args.tx
    .delete(products)
    .where(eq(products.id, args.productId))
    .returning();
  return deleted ?? null;
}

export async function syncDedicatedProductShadowFromCore(): Promise<ProductShadowSyncResult> {
  const syncedAt = new Date();
  if (!env.usesDedicatedDatabase) {
    return {
      mode: "skipped",
      reason: "shared-database",
      fetchedCount: 0,
      upsertedCount: 0,
      deactivatedCount: 0,
      syncedAt: syncedAt.toISOString(),
    };
  }

  const coreProducts = await listCoreProductSnapshots();
  if (!coreProducts) {
    throw new Error("Core product shadow source is unavailable");
  }

  return db.transaction(async (tx) => {
    for (const snapshot of coreProducts) {
      await upsertProductSnapshotInTx({
        tx,
        snapshot,
      });
    }

    let deactivatedCount = 0;
    const remoteIds = coreProducts.map((product) => product.id);
    if (remoteIds.length > 0) {
      const deactivated = await tx
        .update(products)
        .set({
          active: false,
          updatedAt: syncedAt,
        })
        .where(and(eq(products.active, true), notInArray(products.id, remoteIds)))
        .returning({ id: products.id });
      deactivatedCount = deactivated.length;
    }

    return {
      mode: "synced" as const,
      reason: null,
      fetchedCount: coreProducts.length,
      upsertedCount: coreProducts.length,
      deactivatedCount,
      syncedAt: syncedAt.toISOString(),
    };
  });
}
