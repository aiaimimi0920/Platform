import type {
  FulfillmentMode,
  GatewayAccessGrantMode,
  ListOperatorProductsInput,
  ProductCurrency,
  ProductDetail,
  ProductListItem,
  ProductOperatorMutationResult,
  ProductOperatorPage,
  ProductOperatorView,
  ProductTargetedAudienceGroupKey,
  UpsertProductInput,
} from "@neuro/contracts";
import { and, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  discountCodes,
  items,
  orders,
  productGatewayAccessGrants,
  productSeedTombstones,
  products,
} from "@/modules/product-order-item/schema";
import { getProductById, listActiveProducts } from "@/modules/product-order-item/repository";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import {
  getUserForDiscountEvaluation,
  isPlatformOperator,
  matchesUserGroup,
  normalizeOptionalText,
  now,
  type DbTx,
} from "./shared";

const seededProducts = [
  {
    id: "product_vip_30",
    slug: "vip-30-days",
    title: "30 天 VIP 通行证",
    description: "可流转的 30 天 VIP 时长资产。",
    category: "artificial_intelligence",
    tags: ["membership"],
    kind: "limitedTime",
    currency: "obsidian",
    price: 120,
    fulfillmentMode: "duration_pass",
    transferable: true,
    active: false,
    allowDiscountCodes: true,
    limitScope: "global",
    targetedAudienceGroupKey: null,
    durationDays: 30,
    unitCount: null,
    warrantyDays: null,
    stockLabel: "长期供应",
    gatewayAccessBundleId: null,
    gatewayAccessGrantMode: null,
    gatewayAccessGrantQuantity: null,
  },
  {
    id: "product_account_bundle",
    slug: "account-bundle-10",
    title: "10 个账号包",
    description: "一次性交付型账号包，适合作为简单可流转资产。",
    category: "artificial_intelligence",
    tags: ["account"],
    kind: "unlimited",
    currency: "obsidian",
    price: 80,
    fulfillmentMode: "one_time_delivery",
    transferable: true,
    active: false,
    allowDiscountCodes: true,
    limitScope: "global",
    targetedAudienceGroupKey: null,
    durationDays: null,
    unitCount: 10,
    warrantyDays: null,
    stockLabel: "持续开放",
    gatewayAccessBundleId: null,
    gatewayAccessGrantMode: null,
    gatewayAccessGrantQuantity: null,
  },
  {
    id: "product_account_pool_30",
    slug: "account-pool-30",
    title: "30 个账号无限续杯",
    description: "持续维护型账号池，平台负责始终维持 30 个可用账号单元。",
    category: "artificial_intelligence",
    tags: ["account"],
    kind: "limitedPurchase",
    currency: "obsidian",
    price: 300,
    fulfillmentMode: "maintained_pool",
    transferable: false,
    active: true,
    allowDiscountCodes: false,
    limitScope: "targeted",
    targetedAudienceGroupKey: "trusted_users",
    durationDays: null,
    unitCount: 30,
    warrantyDays: null,
    stockLabel: "按资源池开放",
    gatewayAccessBundleId: null,
    gatewayAccessGrantMode: null,
    gatewayAccessGrantQuantity: null,
  },
  {
    id: "product_warranty_bundle_10",
    slug: "account-warranty-10",
    title: "10 个账号 10 天质保",
    description: "一次性交付 10 个账号，质保期内按失效原因决定是否补号。",
    category: "artificial_intelligence",
    tags: ["account"],
    kind: "limitedPurchase",
    currency: "obsidian",
    price: 120,
    fulfillmentMode: "warranty_delivery",
    transferable: false,
    active: true,
    allowDiscountCodes: true,
    limitScope: "global",
    targetedAudienceGroupKey: null,
    durationDays: null,
    unitCount: 10,
    warrantyDays: 10,
    stockLabel: "按质保规则履约",
    gatewayAccessBundleId: null,
    gatewayAccessGrantMode: null,
    gatewayAccessGrantQuantity: null,
  },
  {
    id: "product_mira_pass",
    slug: "mira-pass",
    title: "米拉资格券",
    description: "使用米拉购买的简单资格道具，用于验证双货币商品体系。",
    category: "artificial_intelligence",
    tags: ["qualification"],
    kind: "unlimited",
    currency: "mira",
    price: 50,
    fulfillmentMode: "one_time_delivery",
    transferable: true,
    active: false,
    allowDiscountCodes: false,
    limitScope: "global",
    targetedAudienceGroupKey: null,
    durationDays: null,
    unitCount: null,
    warrantyDays: null,
    stockLabel: "持续开放",
    gatewayAccessBundleId: null,
    gatewayAccessGrantMode: null,
    gatewayAccessGrantQuantity: null,
  },
  {
    id: "product_codex_refill_1d",
    slug: "codex-refill-1day",
    title: "Codex 无限续杯 · 1天",
    description: "购买后享受 1 天的 Codex 无限续杯服务，账号额度用完自动补号。可叠加购买。",
    category: "artificial_intelligence",
    tags: ["account"],
    kind: "limitedTime",
    currency: "obsidian",
    price: 10,
    fulfillmentMode: "duration_pass",
    transferable: false,
    active: true,
    allowDiscountCodes: true,
    limitScope: "global",
    targetedAudienceGroupKey: null,
    durationDays: 1,
    unitCount: null,
    warrantyDays: null,
    stockLabel: "持续开放",
    gatewayAccessBundleId: null,
    gatewayAccessGrantMode: null,
    gatewayAccessGrantQuantity: null,
  },
  {
    id: "product_codex_api_1d",
    slug: "codex-api-1day",
    title: "Codex 无限调用 · 1天",
    description: "购买后享受 1 天的 Codex API 无限调用服务，通过平台 Relay 转发调用。可叠加购买。",
    category: "artificial_intelligence",
    tags: ["account"],
    kind: "limitedTime",
    currency: "obsidian",
    price: 15,
    fulfillmentMode: "duration_pass",
    transferable: false,
    active: true,
    allowDiscountCodes: true,
    limitScope: "global",
    targetedAudienceGroupKey: null,
    durationDays: 1,
    unitCount: null,
    warrantyDays: null,
    stockLabel: "持续开放",
    gatewayAccessBundleId: null,
    gatewayAccessGrantMode: null,
    gatewayAccessGrantQuantity: null,
  },
] as const;

const seededProductIdSet = new Set<string>(seededProducts.map((product) => product.id));

type ProductDefinitionInput = UpsertProductInput;
type SeededProduct = (typeof seededProducts)[number];
type ProductDefinitionComparableField =
  | "slug"
  | "title"
  | "description"
  | "category"
  | "tags"
  | "kind"
  | "currency"
  | "price"
  | "fulfillmentMode"
  | "transferable"
  | "active"
  | "allowDiscountCodes"
  | "limitScope"
  | "targetedAudienceGroupKey"
  | "durationDays"
  | "unitCount"
  | "warrantyDays"
  | "stockLabel"
  | "gatewayAccessBundleId"
  | "gatewayAccessGrantMode"
  | "gatewayAccessGrantQuantity";

const productDefinitionComparableFields: ProductDefinitionComparableField[] = [
  "slug",
  "title",
  "description",
  "category",
  "tags",
  "kind",
  "currency",
  "price",
  "fulfillmentMode",
  "transferable",
  "active",
  "allowDiscountCodes",
  "limitScope",
  "targetedAudienceGroupKey",
  "durationDays",
  "unitCount",
  "warrantyDays",
  "stockLabel",
  "gatewayAccessBundleId",
  "gatewayAccessGrantMode",
  "gatewayAccessGrantQuantity",
];

const supportedProductTargetedAudienceGroupKeys = new Set<ProductTargetedAudienceGroupKey>([
  "trusted_users",
  "new_users",
]);

function resolveProductTargetedAudienceGroupKey(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }
  if (!supportedProductTargetedAudienceGroupKeys.has(normalized as ProductTargetedAudienceGroupKey)) {
    throw new BadRequestError(`Unsupported targetedAudienceGroupKey: ${normalized}`);
  }
  return normalized as ProductTargetedAudienceGroupKey;
}

function getProductTargetedAudienceLabel(groupKey: string | null | undefined) {
  switch (groupKey) {
    case "new_users":
      return "新用户";
    case "trusted_users":
    default:
      return "可信用户";
  }
}

function hasGatewayAccessGrantBinding(input: ProductDefinitionInput) {
  return (
    input.gatewayAccessBundleId !== null ||
    input.gatewayAccessGrantMode !== null ||
    input.gatewayAccessGrantQuantity !== null
  );
}

function getProductDefinitionChangedFields(
  existing: typeof products.$inferSelect,
  next: ProductDefinitionInput,
) {
  return productDefinitionComparableFields.filter((field) => {
    const a = existing[field];
    const b = next[field];
    if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) !== JSON.stringify(b);
    return a !== b;
  });
}

function assertProductDefinitionConsistency(input: ProductDefinitionInput) {
  if (input.price < 0) {
    throw new BadRequestError("Product price must be non-negative");
  }

  if (input.limitScope === "global") {
    if (input.targetedAudienceGroupKey !== null) {
      throw new BadRequestError("Global products cannot define targetedAudienceGroupKey");
    }
  } else if (!resolveProductTargetedAudienceGroupKey(input.targetedAudienceGroupKey)) {
    throw new BadRequestError("Targeted products require targetedAudienceGroupKey");
  }

  if (input.fulfillmentMode === "duration_pass") {
    if (!input.durationDays || input.durationDays <= 0) {
      throw new BadRequestError("duration_pass products require durationDays");
    }
  } else if (input.durationDays !== null) {
    throw new BadRequestError("Only duration_pass products can define durationDays");
  }

  if (input.fulfillmentMode === "maintained_pool" || input.fulfillmentMode === "warranty_delivery") {
    if (!input.unitCount || input.unitCount <= 0) {
      throw new BadRequestError(`${input.fulfillmentMode} products require unitCount`);
    }
  } else if (input.fulfillmentMode === "one_time_delivery") {
    if (input.unitCount !== null && input.unitCount <= 0) {
      throw new BadRequestError("one_time_delivery products with unitCount must define a positive value");
    }
  } else if (input.unitCount !== null) {
    throw new BadRequestError("Only one_time_delivery / maintained_pool / warranty_delivery products can define unitCount");
  }

  if (input.warrantyDays !== null) {
    if (input.warrantyDays <= 0) {
      throw new BadRequestError("Products with warranty must define positive warrantyDays");
    }
    if (input.fulfillmentMode !== "one_time_delivery" && input.fulfillmentMode !== "warranty_delivery") {
      throw new BadRequestError("Only one_time_delivery / warranty_delivery products can define warrantyDays");
    }
  }

  if (!hasGatewayAccessGrantBinding(input)) {
    return;
  }

  if (input.gatewayAccessBundleId === null) {
    throw new BadRequestError("Bundle grant mode / quantity requires gatewayAccessBundleId");
  }
  if (input.gatewayAccessGrantMode === null) {
    throw new BadRequestError("Bundle-bound products require gatewayAccessGrantMode");
  }
  if (input.gatewayAccessGrantQuantity === null || input.gatewayAccessGrantQuantity <= 0) {
    throw new BadRequestError("Bundle-bound products require gatewayAccessGrantQuantity");
  }
  if (input.transferable) {
    throw new BadRequestError("Bundle-bound products cannot be transferable");
  }
  if (input.fulfillmentMode !== "one_time_delivery") {
    throw new BadRequestError("Bundle-bound recharge products currently require one_time_delivery fulfillment");
  }
  if (input.durationDays !== null) {
    throw new BadRequestError("Bundle-bound recharge products cannot define durationDays");
  }
  if (input.unitCount !== null) {
    throw new BadRequestError("Bundle-bound recharge products cannot define unitCount");
  }
}

function toProductOperatorView(product: typeof products.$inferSelect): ProductOperatorView {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: product.category,
    kind: product.kind as ProductOperatorView["kind"],
    currency: product.currency as ProductCurrency,
    price: product.price,
    fulfillmentMode: product.fulfillmentMode as FulfillmentMode,
    transferable: product.transferable,
    active: product.active,
    allowDiscountCodes: product.allowDiscountCodes,
    limitScope: product.limitScope as ProductOperatorView["limitScope"],
    targetedAudienceGroupKey: resolveProductTargetedAudienceGroupKey(product.targetedAudienceGroupKey),
    durationDays: product.durationDays,
    unitCount: product.unitCount,
    warrantyDays: product.warrantyDays,
    stockLabel: product.stockLabel,
    tags: product.tags,
    gatewayAccessBundleId: product.gatewayAccessBundleId,
    gatewayAccessGrantMode: product.gatewayAccessGrantMode as GatewayAccessGrantMode | null,
    gatewayAccessGrantQuantity: product.gatewayAccessGrantQuantity,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function upsertProductDefinitionInTx(args: {
  tx: DbTx;
  productId: string;
  input: ProductDefinitionInput;
  source: string;
  actorUserId?: string | null;
}): Promise<ProductOperatorMutationResult> {
  assertProductDefinitionConsistency(args.input);
  const timestamp = now();
  let [existing] = await args.tx.select().from(products).where(eq(products.id, args.productId)).limit(1);

  if (!existing) {
    const [created] = await args.tx
      .insert(products)
      .values({
        id: args.productId,
        slug: args.input.slug,
        title: args.input.title,
        description: args.input.description,
        category: args.input.category,
        kind: args.input.kind,
        currency: args.input.currency,
        price: args.input.price,
        fulfillmentMode: args.input.fulfillmentMode,
        transferable: args.input.transferable,
        active: args.input.active,
        allowDiscountCodes: args.input.allowDiscountCodes,
        limitScope: args.input.limitScope,
        targetedAudienceGroupKey: resolveProductTargetedAudienceGroupKey(args.input.targetedAudienceGroupKey),
        durationDays: args.input.durationDays,
        unitCount: args.input.unitCount,
        warrantyDays: args.input.warrantyDays,
        stockLabel: args.input.stockLabel,
        tags: args.input.tags,
        gatewayAccessBundleId: args.input.gatewayAccessBundleId,
        gatewayAccessGrantMode: args.input.gatewayAccessGrantMode,
        gatewayAccessGrantQuantity: args.input.gatewayAccessGrantQuantity,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoNothing({ target: products.id })
      .returning();

    if (created) {
      await args.tx.delete(productSeedTombstones).where(eq(productSeedTombstones.productId, args.productId));

      await enqueueOutboxEvent(
        "product.updated",
        {
          productId: args.productId,
          active: args.input.active,
          previousActive: null,
          changedFields: [...productDefinitionComparableFields],
          source: args.source,
          actorUserId: args.actorUserId ?? null,
          updatedAt: timestamp.toISOString(),
        },
        args.tx,
      );

      return {
        product: toProductOperatorView(created),
        created: true,
        eventName: "product.updated",
        changedFields: [...productDefinitionComparableFields],
      };
    }

    [existing] = await args.tx.select().from(products).where(eq(products.id, args.productId)).limit(1);
    if (!existing) {
      throw new Error(`Product conflict did not resolve to a persisted row: ${args.productId}`);
    }
  }

  const changedFields = getProductDefinitionChangedFields(existing, args.input);
  if (changedFields.length === 0) {
    return {
      product: toProductOperatorView(existing),
      created: false,
      eventName: null,
      changedFields: [],
    };
  }

  const [updated] = await args.tx
    .update(products)
    .set({
      slug: args.input.slug,
      title: args.input.title,
      description: args.input.description,
      category: args.input.category,
      kind: args.input.kind,
      currency: args.input.currency,
      price: args.input.price,
      fulfillmentMode: args.input.fulfillmentMode,
      transferable: args.input.transferable,
      active: args.input.active,
      allowDiscountCodes: args.input.allowDiscountCodes,
      limitScope: args.input.limitScope,
      targetedAudienceGroupKey: resolveProductTargetedAudienceGroupKey(args.input.targetedAudienceGroupKey),
      durationDays: args.input.durationDays,
      unitCount: args.input.unitCount,
      warrantyDays: args.input.warrantyDays,
      stockLabel: args.input.stockLabel,
      tags: args.input.tags,
      gatewayAccessBundleId: args.input.gatewayAccessBundleId,
      gatewayAccessGrantMode: args.input.gatewayAccessGrantMode,
      gatewayAccessGrantQuantity: args.input.gatewayAccessGrantQuantity,
      updatedAt: timestamp,
    })
    .where(eq(products.id, args.productId))
    .returning();

  await args.tx.delete(productSeedTombstones).where(eq(productSeedTombstones.productId, args.productId));

  const eventName = existing.active && !args.input.active ? "product.deactivated" : "product.updated";

  await enqueueOutboxEvent(
    eventName,
    {
      productId: args.productId,
      active: args.input.active,
      previousActive: existing.active,
      changedFields,
      source: args.source,
      actorUserId: args.actorUserId ?? null,
      updatedAt: timestamp.toISOString(),
    },
    args.tx,
  );

  return {
    product: toProductOperatorView(updated),
    created: false,
    eventName,
    changedFields,
  };
}

type ProductAccessEvaluationUser = NonNullable<Awaited<ReturnType<typeof getUserForDiscountEvaluation>>>;

type ProductPurchaseEligibility = {
  eligibleToPurchase: boolean;
  purchaseEligibilityNote: string | null;
};

function getProductPurchaseEligibility(
  product: typeof products.$inferSelect,
  user: ProductAccessEvaluationUser,
): ProductPurchaseEligibility {
  if (product.limitScope === "global") {
    return {
      eligibleToPurchase: true,
      purchaseEligibilityNote: null,
    };
  }

  if (product.limitScope === "targeted") {
    const targetedGroupKey = resolveProductTargetedAudienceGroupKey(product.targetedAudienceGroupKey) ?? "trusted_users";
    const eligible = matchesUserGroup(targetedGroupKey, user);
    const label = getProductTargetedAudienceLabel(targetedGroupKey);
    return {
      eligibleToPurchase: eligible,
      purchaseEligibilityNote: eligible
        ? `该商品当前处于定向开放状态，你已满足${label}资格。`
        : `该商品当前仅对${label}开放，当前账号暂不满足购买资格。`,
    };
  }

  return {
    eligibleToPurchase: false,
    purchaseEligibilityNote: "当前商品的购买资格规则尚未开放。",
  };
}

function toProductDetail(
  product: typeof products.$inferSelect,
  eligibility: ProductPurchaseEligibility,
): ProductDetail {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: product.category,
    kind: product.kind as ProductDetail["kind"],
    currency: product.currency as ProductCurrency,
    price: product.price,
    fulfillmentMode: product.fulfillmentMode as FulfillmentMode,
    transferable: product.transferable,
    active: product.active,
    allowDiscountCodes: product.allowDiscountCodes,
    moduleEnabled: true,
    limitScope: product.limitScope as ProductDetail["limitScope"],
    eligibleToPurchase: eligibility.eligibleToPurchase,
    purchaseEligibilityNote: eligibility.purchaseEligibilityNote,
    durationDays: product.durationDays,
    unitCount: product.unitCount,
    warrantyDays: product.warrantyDays,
    tags: product.tags,
    stockLabel: product.stockLabel,
  };
}

function toProductListItem(
  product: typeof products.$inferSelect,
  eligibility: ProductPurchaseEligibility,
): ProductListItem {
  const detail = toProductDetail(product, eligibility);
  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    description: detail.description,
    category: detail.category,
    kind: detail.kind,
    currency: detail.currency,
    price: detail.price,
    fulfillmentMode: detail.fulfillmentMode,
    transferable: detail.transferable,
    active: detail.active,
    allowDiscountCodes: detail.allowDiscountCodes,
    moduleEnabled: true,
    limitScope: detail.limitScope,
    eligibleToPurchase: detail.eligibleToPurchase,
    purchaseEligibilityNote: detail.purchaseEligibilityNote,
    unitCount: detail.unitCount,
    warrantyDays: detail.warrantyDays,
    tags: detail.tags,
  };
}

let _defaultProductsEnsured = false;
let _defaultProductsEnsurePromise: Promise<void> | null = null;

async function ensureDefaultProductsOnce() {
  const deletedSeedRows = await db
    .select({ productId: productSeedTombstones.productId })
    .from(productSeedTombstones)
    .where(inArray(productSeedTombstones.productId, [...seededProductIdSet]));
  const deletedSeedIds = new Set(deletedSeedRows.map((row) => row.productId));
  for (const product of seededProducts) {
    if (deletedSeedIds.has(product.id)) {
      continue;
    }
    const { id: productId, ...rest } = product;
    await db.transaction((tx) =>
      upsertProductDefinitionInTx({
        tx,
        productId,
        input: { ...rest, tags: [...rest.tags] },
        source: "seeded_products",
      }),
    );
  }
}

export async function ensureDefaultProducts() {
  if (_defaultProductsEnsured) return;
  if (!_defaultProductsEnsurePromise) {
    _defaultProductsEnsurePromise = ensureDefaultProductsOnce()
      .then(() => {
        _defaultProductsEnsured = true;
      })
      .finally(() => {
        _defaultProductsEnsurePromise = null;
      });
  }
  await _defaultProductsEnsurePromise;
}

const DEFAULT_OPERATOR_PRODUCT_PAGE_LIMIT = 50;
const MAX_OPERATOR_PRODUCT_PAGE_LIMIT = 100;

type OperatorProductCursor = {
  updatedAt: string;
  id: string;
};

function decodeOperatorProductCursor(cursor: string): OperatorProductCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      typeof (parsed as Record<string, unknown>).updatedAt !== "string" ||
      typeof (parsed as Record<string, unknown>).id !== "string"
    ) {
      throw new Error("invalid cursor payload");
    }
    const updatedAt = new Date((parsed as Record<string, unknown>).updatedAt as string);
    const id = ((parsed as Record<string, unknown>).id as string).trim();
    if (!Number.isFinite(updatedAt.getTime()) || !id) {
      throw new Error("invalid cursor values");
    }
    return { updatedAt: updatedAt.toISOString(), id };
  } catch {
    throw new BadRequestError("Invalid operator product cursor");
  }
}

function encodeOperatorProductCursor(product: typeof products.$inferSelect) {
  return Buffer.from(
    JSON.stringify({ updatedAt: product.updatedAt.toISOString(), id: product.id } satisfies OperatorProductCursor),
    "utf8",
  ).toString("base64url");
}

export async function listProductsForOperator(
  input?: ListOperatorProductsInput,
): Promise<ProductOperatorPage> {
  await ensureDefaultProducts();
  const limit = Math.max(
    1,
    Math.min(input?.limit ?? DEFAULT_OPERATOR_PRODUCT_PAGE_LIMIT, MAX_OPERATOR_PRODUCT_PAGE_LIMIT),
  );
  const cursor = input?.cursor ? decodeOperatorProductCursor(input.cursor) : null;
  const cursorUpdatedAt = cursor ? new Date(cursor.updatedAt) : null;
  const [productRows, [summary]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(
        cursor && cursorUpdatedAt
          ? or(
              lt(products.updatedAt, cursorUpdatedAt),
              and(eq(products.updatedAt, cursorUpdatedAt), lt(products.id, cursor.id)),
            )
          : undefined,
      )
      .orderBy(desc(products.updatedAt), desc(products.id))
      .limit(limit + 1),
    db
      .select({
        totalCount: count(),
        activeCount: sql<number>`count(*) filter (where ${products.active})::int`,
      })
      .from(products),
  ]);
  const hasMore = productRows.length > limit;
  const pageRows = hasMore ? productRows.slice(0, limit) : productRows;
  const totalCount = Number(summary?.totalCount ?? 0);
  const activeCount = Number(summary?.activeCount ?? 0);
  return {
    products: pageRows.map(toProductOperatorView),
    pageInfo: {
      limit,
      hasMore,
      nextCursor: hasMore && pageRows.length > 0 ? encodeOperatorProductCursor(pageRows.at(-1)!) : null,
      totalCount,
      activeCount,
      inactiveCount: Math.max(0, totalCount - activeCount),
    },
  };
}

export async function upsertProductDefinitionAsOperator(
  operatorUserId: string,
  productId: string,
  input: ProductDefinitionInput,
): Promise<ProductOperatorMutationResult> {
  return db.transaction((tx) =>
    upsertProductDefinitionInTx({
      tx,
      productId,
      input,
      source: "operator_api",
      actorUserId: operatorUserId,
    }),
  );
}

export async function deleteProductDefinitionAsOperator(
  operatorUserId: string,
  productId: string,
): Promise<{ productId: string; title: string }> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can manage products");
  }

  await ensureDefaultProducts();

  return db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) {
      throw new NotFoundError(`Unknown product ${productId}`);
    }

    const [orderRefRow, itemRefRow, grantRefRow, discountCodeRefRow] = await Promise.all([
      tx.select({ count: count() }).from(orders).where(eq(orders.productId, productId)),
      tx.select({ count: count() }).from(items).where(eq(items.productId, productId)),
      tx.select({ count: count() }).from(productGatewayAccessGrants).where(eq(productGatewayAccessGrants.productId, productId)),
      tx.select({ count: count() }).from(discountCodes).where(eq(discountCodes.targetProductId, productId)),
    ]);

    const orderRefCount = Number(orderRefRow[0]?.count ?? 0);
    const itemRefCount = Number(itemRefRow[0]?.count ?? 0);
    const grantRefCount = Number(grantRefRow[0]?.count ?? 0);
    const discountCodeRefCount = Number(discountCodeRefRow[0]?.count ?? 0);

    if (orderRefCount > 0 || itemRefCount > 0 || grantRefCount > 0 || discountCodeRefCount > 0) {
      throw new ConflictError("该商品已有订单、发货记录、Bundle grant 或优惠码引用，当前不能直接删除。");
    }

    if (seededProductIdSet.has(productId)) {
      await tx
        .insert(productSeedTombstones)
        .values({
          productId,
          deletedAt: now(),
        })
        .onConflictDoUpdate({
          target: productSeedTombstones.productId,
          set: {
            deletedAt: now(),
          },
        });
    }

    await tx.delete(products).where(eq(products.id, productId));

    await enqueueOutboxEvent(
      "product.deleted",
      {
        productId,
        title: product.title,
        actorUserId: operatorUserId,
        deletedAt: now().toISOString(),
      },
      tx,
    );

    return {
      productId,
      title: product.title,
    };
  });
}

export async function assertProductPurchaseEligibility(
  tx: DbTx,
  userId: string,
  product: typeof products.$inferSelect,
) {
  const user = await getUserForDiscountEvaluation(tx, userId);
  const eligibility = getProductPurchaseEligibility(product, user);
  if (!eligibility.eligibleToPurchase) {
    throw new ConflictError(eligibility.purchaseEligibilityNote || "当前账号不满足商品购买资格");
  }
  return eligibility;
}

export async function listProducts(userId: string): Promise<ProductListItem[]> {
  await ensureDefaultProducts();
  const all = await listActiveProducts();
  const user = await getUserForDiscountEvaluation(db, userId);
  return all.map((product) =>
    toProductListItem(product, getProductPurchaseEligibility(product, user)),
  );
}

export async function getProductDetail(userId: string, productId: string): Promise<ProductDetail | null> {
  await ensureDefaultProducts();
  const product = await getProductById(productId);
  if (!product) return null;
  const user = await getUserForDiscountEvaluation(db, userId);
  return toProductDetail(product, getProductPurchaseEligibility(product, user));
}
