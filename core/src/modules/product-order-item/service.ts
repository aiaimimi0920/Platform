import type {
  ApplyDiscountCodeBatchInput,
  DiscountCodeOperatorMutationResult,
  DiscountCodeBatchMutationResult,
  DiscountCodeBatchAction,
  DiscountCodeOperatorState,
  DiscountCodeOperatorView,
  DiscountCodeView,
  FulfillmentOpsSummaryView,
  FulfillmentMode,
  ItemFulfillmentAnomalyKind,
  ItemFulfillmentAnomalySeverity,
  ItemFulfillmentAnomalyView,
  ItemFulfillmentRunStatus,
  ItemFulfillmentRunTrigger,
  ItemFulfillmentRunView,
  ItemManualReviewAction,
  ItemManualReviewPriority,
  ItemManualReviewAssignmentAction,
  ItemManualReviewAssignmentEventView,
  ItemManualReviewRoutingCode,
  ItemManualReviewSlaBucket,
  ItemManualReviewSuggestedAction,
  ItemManualReviewStatus,
  ManualReviewRebalanceAssignmentView,
  ManualReviewRebalanceResult,
  ManualReviewSlaPolicyTemplateView,
  ManualReviewSlaSummaryView,
  ManualReviewWorkloadSnapshotView,
  ManualReviewWorkloadView,
  ItemManualReviewView,
  ItemIssueRejectionCode,
  ItemIssueReportOutcome,
  ItemIssueReportView,
  ItemUnitIssueReason,
  ItemUnitView,
  ItemView,
  OrderDiscountSource,
  ItemReplacementLogTrigger,
  ItemReplacementLogView,
  OrderView,
  GatewayAccessGrantMode,
  ProductCurrency,
  ProductDetail,
  ProductOperatorMutationResult,
  ProductOperatorView,
  ProductListItem,
  ProductTargetedAudienceGroupKey,
  ListOperatorDiscountCodesInput,
  RollbackOrderInput,
  RollbackOrderResult,
  UpsertDiscountCodeInput,
  UpsertProductInput,
} from "@neuro/contracts";
import { and, asc, count, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  deductBalance,
  refundBalance,
} from "../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  buildFulfillmentOpsRecommendations,
  buildFulfillmentRecentRunWindows,
} from "@/modules/product-order-item/operator-ops-analysis";
import {
  getProductById,
  listActiveProducts,
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
  itemFulfillmentRuns,
  itemFulfillmentAnomalies,
  itemIssueReports,
  itemManualReviews,
  itemManualReviewAssignmentEvents,
  itemManualReviewWorkloadSnapshots,
  itemReplacementLogs,
  items,
  itemUnits,
  orders,
  productSeedTombstones,
  productGatewayAccessGrants,
  products,
} from "@/modules/product-order-item/schema";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";


import { enqueueOutboxEvent } from "@/platform/outbox/service";
import { env } from "@/env";
import {
  createProductGatewayAccessGrantInTx,
  revokeProductGatewayAccessGrantsInTx,
  syncProductGatewayAccessGrantByItem,
} from "@/modules/product-order-item/gateway-access-grants";

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

const seededDiscountCodes = [
  {
    id: "discount_obsidian_welcome_20",
    code: "OBSI-20",
    namespace: "seeded",
    batchLabel: "default_seed",
    enabled: true,
    scope: "allProducts",
    targetProductCategory: null,
    targetProductId: null,
    audienceScope: "allUsers",
    audienceGroupKey: null,
    audienceUserId: null,
    valueKind: "fixedAmount",
    valueAmount: 20,
    totalMaxUses: null,
    usedCount: 0,
    perUserLimit: 1,
    startsAt: null,
    expiresAt: null,
  },
  {
    id: "discount_vip_half",
    code: "VIPHALF",
    namespace: "seeded",
    batchLabel: "default_seed",
    enabled: true,
    scope: "specificProduct",
    targetProductCategory: null,
    targetProductId: "product_vip_30",
    audienceScope: "allUsers",
    audienceGroupKey: null,
    audienceUserId: null,
    valueKind: "percentage",
    valueAmount: 50,
    totalMaxUses: 200,
    usedCount: 0,
    perUserLimit: 1,
    startsAt: null,
    expiresAt: null,
  },
  {
    id: "discount_trusted_account_10",
    code: "TRUST10",
    namespace: "seeded",
    batchLabel: "default_seed",
    enabled: true,
    scope: "productCategory",
    targetProductCategory: "artificial_intelligence",
    targetProductId: null,
    audienceScope: "userGroup",
    audienceGroupKey: "trusted_users",
    audienceUserId: null,
    valueKind: "percentage",
    valueAmount: 10,
    totalMaxUses: null,
    usedCount: 0,
    perUserLimit: null,
    startsAt: null,
    expiresAt: null,
  },
] as const;

const seededProductIdSet = new Set<string>(seededProducts.map((product) => product.id));

type DbTx = NodePgDatabase<typeof schema>;
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

type DiscountCodeDefinitionInput = Omit<UpsertDiscountCodeInput, "startsAt" | "expiresAt"> & {
  startsAt: Date | null;
  expiresAt: Date | null;
};
type SeededDiscountCode = (typeof seededDiscountCodes)[number];
type DiscountCodeDefinitionComparableField =
  | "code"
  | "namespace"
  | "batchLabel"
  | "enabled"
  | "scope"
  | "targetProductCategory"
  | "targetProductId"
  | "audienceScope"
  | "audienceGroupKey"
  | "audienceUserId"
  | "valueKind"
  | "valueAmount"
  | "totalMaxUses"
  | "perUserLimit"
  | "startsAt"
  | "expiresAt";

const discountCodeDefinitionComparableFields: DiscountCodeDefinitionComparableField[] = [
  "code",
  "namespace",
  "batchLabel",
  "enabled",
  "scope",
  "targetProductCategory",
  "targetProductId",
  "audienceScope",
  "audienceGroupKey",
  "audienceUserId",
  "valueKind",
  "valueAmount",
  "totalMaxUses",
  "perUserLimit",
  "startsAt",
  "expiresAt",
];

function now() {
  return new Date();
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

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

const DISCOUNT_CODE_HISTORY_ALERT_SCOPE_PRESET = "preset_archive_failure";
const DISCOUNT_CODE_HISTORY_ALERT_SCOPE_CLEANUP = "cleanup_failure";
const DISCOUNT_CODE_HISTORY_ALERT_COOLDOWN_MINUTES = 60;

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
  const [existing] = await args.tx.select().from(products).where(eq(products.id, args.productId)).limit(1);

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
      .returning();

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

function normalizeOptionalTimestamp(value: string | Date | null | undefined) {
  if (!value) return null;
  const normalized = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(normalized.getTime())) {
    throw new BadRequestError("优惠码时间参数无效");
  }
  return normalized;
}

function normalizeDiscountCodeDefinitionInput(input: UpsertDiscountCodeInput | SeededDiscountCode): DiscountCodeDefinitionInput {
  return {
    code: input.code.trim().toUpperCase(),
    namespace: normalizeOptionalText("namespace" in input ? input.namespace : null),
    batchLabel: normalizeOptionalText("batchLabel" in input ? input.batchLabel : null),
    enabled: input.enabled,
    scope: input.scope,
    targetProductCategory: normalizeOptionalText(input.targetProductCategory),
    targetProductId: normalizeOptionalText(input.targetProductId),
    audienceScope: input.audienceScope,
    audienceGroupKey: normalizeOptionalText(input.audienceGroupKey),
    audienceUserId: normalizeOptionalText(input.audienceUserId),
    valueKind: input.valueKind,
    valueAmount: input.valueAmount,
    totalMaxUses: input.totalMaxUses,
    perUserLimit: input.perUserLimit,
    startsAt: normalizeOptionalTimestamp(input.startsAt),
    expiresAt: normalizeOptionalTimestamp(input.expiresAt),
  };
}

function areTimestampsEqual(left: Date | null, right: Date | null) {
  if (left === null && right === null) return true;
  if (left === null || right === null) return false;
  return left.getTime() === right.getTime();
}

function getDiscountCodeDefinitionChangedFields(
  existing: typeof discountCodes.$inferSelect,
  next: DiscountCodeDefinitionInput,
) {
  return discountCodeDefinitionComparableFields.filter((field) => {
    if (field === "startsAt" || field === "expiresAt") {
      return !areTimestampsEqual(existing[field], next[field]);
    }
    return existing[field] !== next[field];
  });
}

async function assertDiscountCodeDefinitionConsistency(tx: DbTx, input: DiscountCodeDefinitionInput) {
  if (!input.code) {
    throw new BadRequestError("Discount code is required");
  }
  if (input.valueAmount <= 0) {
    throw new BadRequestError("Discount value amount must be positive");
  }
  if (input.valueKind === "percentage" && input.valueAmount > 100) {
    throw new BadRequestError("Percentage discount cannot exceed 100");
  }
  if (input.startsAt && input.expiresAt && input.startsAt.getTime() >= input.expiresAt.getTime()) {
    throw new BadRequestError("Discount start time must be earlier than expiry time");
  }
  if (input.batchLabel && !input.namespace) {
    throw new BadRequestError("Discount batchLabel requires namespace");
  }

  if (input.scope === "allProducts") {
    if (input.targetProductCategory || input.targetProductId) {
      throw new BadRequestError("allProducts discount codes cannot target category or product");
    }
  } else if (input.scope === "productCategory") {
    if (!input.targetProductCategory) {
      throw new BadRequestError("productCategory discount codes require targetProductCategory");
    }
    if (input.targetProductId) {
      throw new BadRequestError("productCategory discount codes cannot target a specific product");
    }
  } else if (input.scope === "specificProduct") {
    if (!input.targetProductId) {
      throw new BadRequestError("specificProduct discount codes require targetProductId");
    }
    if (input.targetProductCategory) {
      throw new BadRequestError("specificProduct discount codes cannot target a product category");
    }

    const [targetProduct] = await tx.select({ id: products.id }).from(products).where(eq(products.id, input.targetProductId)).limit(1);
    if (!targetProduct) {
      throw new BadRequestError("Target product does not exist");
    }
  }

  if (input.audienceScope === "allUsers") {
    if (input.audienceGroupKey || input.audienceUserId) {
      throw new BadRequestError("allUsers discount codes cannot target a group or specific user");
    }
  } else if (input.audienceScope === "userGroup") {
    if (!input.audienceGroupKey) {
      throw new BadRequestError("userGroup discount codes require audienceGroupKey");
    }
    if (input.audienceUserId) {
      throw new BadRequestError("userGroup discount codes cannot target a specific user");
    }
  } else if (input.audienceScope === "specificUser") {
    if (!input.audienceUserId) {
      throw new BadRequestError("specificUser discount codes require audienceUserId");
    }
    if (input.audienceGroupKey) {
      throw new BadRequestError("specificUser discount codes cannot target a user group");
    }
  }
}

function toDiscountCodeOperatorView(discountCode: typeof discountCodes.$inferSelect): DiscountCodeOperatorView {
  return {
    id: discountCode.id,
    code: discountCode.code,
    namespace: discountCode.namespace,
    batchLabel: discountCode.batchLabel,
    enabled: discountCode.enabled,
    scope: discountCode.scope as DiscountCodeOperatorView["scope"],
    targetProductCategory: discountCode.targetProductCategory,
    targetProductId: discountCode.targetProductId,
    audienceScope: discountCode.audienceScope as DiscountCodeOperatorView["audienceScope"],
    audienceGroupKey: discountCode.audienceGroupKey,
    audienceUserId: discountCode.audienceUserId,
    valueKind: discountCode.valueKind as DiscountCodeOperatorView["valueKind"],
    valueAmount: discountCode.valueAmount,
    totalMaxUses: discountCode.totalMaxUses,
    totalUsedCount: discountCode.usedCount,
    perUserLimit: discountCode.perUserLimit,
    startsAt: discountCode.startsAt ? discountCode.startsAt.toISOString() : null,
    expiresAt: discountCode.expiresAt ? discountCode.expiresAt.toISOString() : null,
    createdAt: discountCode.createdAt.toISOString(),
    updatedAt: discountCode.updatedAt.toISOString(),
  };
}

function clampDiscountCodeWindowDays(windowDays: number | null | undefined) {
  if (!windowDays || !Number.isFinite(windowDays)) {
    return 7;
  }
  return Math.max(1, Math.min(Math.floor(windowDays), 365));
}

function getDiscountCodeState(
  discountCode: typeof discountCodes.$inferSelect,
  referenceTime: Date,
  windowDays: number,
): DiscountCodeOperatorState {
  if (!discountCode.enabled) {
    return "disabled";
  }
  if (discountCode.startsAt && discountCode.startsAt.getTime() > referenceTime.getTime()) {
    return "scheduled";
  }
  if (discountCode.expiresAt && discountCode.expiresAt.getTime() < referenceTime.getTime()) {
    return "expired";
  }
  if (
    discountCode.expiresAt &&
    discountCode.expiresAt.getTime() <= referenceTime.getTime() + windowDays * 24 * 60 * 60 * 1000
  ) {
    return "expiring";
  }
  return "activeWindow";
}

function matchesDiscountCodeStateFilter(args: {
  discountCode: typeof discountCodes.$inferSelect;
  state: DiscountCodeOperatorState;
  referenceTime: Date;
  windowDays: number;
}) {
  if (args.state === "all") {
    return true;
  }
  if (args.state === "enabled") {
    return args.discountCode.enabled;
  }
  if (args.state === "disabled") {
    return !args.discountCode.enabled;
  }

  return getDiscountCodeState(args.discountCode, args.referenceTime, args.windowDays) === args.state;
}

function matchesDiscountCodeProduct(args: {
  discountCode: typeof discountCodes.$inferSelect;
  product: typeof products.$inferSelect;
}) {
  if (args.discountCode.scope === "allProducts") return true;
  if (args.discountCode.scope === "specificProduct") {
    return args.discountCode.targetProductId === args.product.id;
  }
  if (args.discountCode.scope === "productCategory") {
    return args.discountCode.targetProductCategory === args.product.category;
  }
  return false;
}

async function upsertDiscountCodeDefinitionInTx(args: {
  tx: DbTx;
  discountCodeId: string;
  input: UpsertDiscountCodeInput | SeededDiscountCode;
}): Promise<DiscountCodeOperatorMutationResult> {
  const normalizedInput = normalizeDiscountCodeDefinitionInput(args.input);
  await assertDiscountCodeDefinitionConsistency(args.tx, normalizedInput);

  const timestamp = now();
  const [existing] = await args.tx
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.id, args.discountCodeId))
    .limit(1);

  try {
    if (!existing) {
      const [created] = await args.tx
        .insert(discountCodes)
        .values({
          id: args.discountCodeId,
          code: normalizedInput.code,
          namespace: normalizedInput.namespace,
          batchLabel: normalizedInput.batchLabel,
          enabled: normalizedInput.enabled,
          scope: normalizedInput.scope,
          targetProductCategory: normalizedInput.targetProductCategory,
          targetProductId: normalizedInput.targetProductId,
          audienceScope: normalizedInput.audienceScope,
          audienceGroupKey: normalizedInput.audienceGroupKey,
          audienceUserId: normalizedInput.audienceUserId,
          valueKind: normalizedInput.valueKind,
          valueAmount: normalizedInput.valueAmount,
          totalMaxUses: normalizedInput.totalMaxUses,
          usedCount: 0,
          perUserLimit: normalizedInput.perUserLimit,
          startsAt: normalizedInput.startsAt,
          expiresAt: normalizedInput.expiresAt,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning();

      return {
        discountCode: toDiscountCodeOperatorView(created),
        created: true,
        changedFields: [...discountCodeDefinitionComparableFields],
      };
    }

    const changedFields = getDiscountCodeDefinitionChangedFields(existing, normalizedInput);
    if (changedFields.length === 0) {
      return {
        discountCode: toDiscountCodeOperatorView(existing),
        created: false,
        changedFields: [],
      };
    }

    const [updated] = await args.tx
      .update(discountCodes)
      .set({
        code: normalizedInput.code,
        namespace: normalizedInput.namespace,
        batchLabel: normalizedInput.batchLabel,
        enabled: normalizedInput.enabled,
        scope: normalizedInput.scope,
        targetProductCategory: normalizedInput.targetProductCategory,
        targetProductId: normalizedInput.targetProductId,
        audienceScope: normalizedInput.audienceScope,
        audienceGroupKey: normalizedInput.audienceGroupKey,
        audienceUserId: normalizedInput.audienceUserId,
        valueKind: normalizedInput.valueKind,
        valueAmount: normalizedInput.valueAmount,
        totalMaxUses: normalizedInput.totalMaxUses,
        perUserLimit: normalizedInput.perUserLimit,
        startsAt: normalizedInput.startsAt,
        expiresAt: normalizedInput.expiresAt,
        updatedAt: timestamp,
      })
      .where(eq(discountCodes.id, args.discountCodeId))
      .returning();

    return {
      discountCode: toDiscountCodeOperatorView(updated),
      created: false,
      changedFields,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("优惠码 code 已存在，请使用新的编码。");
    }
    throw error;
  }
}

function getManualReviewAgeHours(createdAt: Date, referenceTime: Date) {
  return Math.max(0, Math.floor((referenceTime.getTime() - createdAt.getTime()) / (60 * 60 * 1000)));
}

function getManualReviewPriority(args: {
  routingCode: ItemManualReviewRoutingCode;
  ageHours: number;
}): ItemManualReviewPriority {
  if (args.ageHours >= 72) {
    return "urgent";
  }
  if (args.routingCode === "high_replacement_frequency" || args.ageHours >= 24) {
    return "high";
  }
  return "normal";
}

function getManualReviewPriorityRank(priority: ItemManualReviewPriority) {
  switch (priority) {
    case "urgent":
      return 3;
    case "high":
      return 2;
    default:
      return 1;
  }
}

function getManualReviewSlaPolicy(args: {
  routingCode: ItemManualReviewRoutingCode;
  priority: ItemManualReviewPriority;
}) {
  const routingKey = `routing:${args.routingCode}`;
  const priorityKey = `priority:${args.priority}`;
  if (env.manualReviewSlaPolicies[routingKey]) {
    return {
      key: routingKey,
      scope: "routing" as const,
      ...env.manualReviewSlaPolicies[routingKey],
    };
  }
  if (env.manualReviewSlaPolicies[priorityKey]) {
    return {
      key: priorityKey,
      scope: "priority" as const,
      ...env.manualReviewSlaPolicies[priorityKey],
    };
  }
  return {
    key: "default",
    scope: "default" as const,
    ...env.manualReviewSlaPolicies.default,
  };
}

function getManualReviewSlaBucket(args: {
  ageHours: number;
  priority: ItemManualReviewPriority;
  routingCode: ItemManualReviewRoutingCode;
}): ItemManualReviewSlaBucket {
  const policy = getManualReviewSlaPolicy({
    routingCode: args.routingCode,
    priority: args.priority,
  });
  if (args.ageHours >= policy.slaHours) {
    return "breached";
  }
  if (args.ageHours >= Math.max(1, policy.slaHours - policy.dueSoonLeadHours)) {
    return "due_soon";
  }
  return "on_track";
}

function getManualReviewSlaAnomalySeverity(args: {
  ageHours: number;
  slaPolicy: ReturnType<typeof getManualReviewSlaPolicy>;
}): ItemFulfillmentAnomalySeverity {
  if (args.slaPolicy.criticalAfterHours !== null && args.ageHours >= args.slaPolicy.criticalAfterHours) {
    return "critical";
  }
  return args.slaPolicy.anomalySeverity ?? "warning";
}

function getManualReviewSlaAnomalyProgress(args: {
  ageHours: number;
  slaPolicy: ReturnType<typeof getManualReviewSlaPolicy>;
  referenceTime: Date;
}) {
  const severity = getManualReviewSlaAnomalySeverity({
    ageHours: args.ageHours,
    slaPolicy: args.slaPolicy,
  });
  let alertLevel = severity === "critical" ? 2 : 1;
  let nextEscalationAt: Date | null = null;

  if (args.slaPolicy.urgentAfterHours !== null && args.ageHours >= args.slaPolicy.urgentAfterHours) {
    alertLevel = 3;
  } else if (args.slaPolicy.urgentAfterHours !== null && args.ageHours < args.slaPolicy.urgentAfterHours) {
    nextEscalationAt = new Date(
      args.referenceTime.getTime() + (args.slaPolicy.urgentAfterHours - args.ageHours) * 60 * 60 * 1000,
    );
  } else if (
    severity !== "critical" &&
    args.slaPolicy.criticalAfterHours !== null &&
    args.ageHours < args.slaPolicy.criticalAfterHours
  ) {
    nextEscalationAt = new Date(
      args.referenceTime.getTime() + (args.slaPolicy.criticalAfterHours - args.ageHours) * 60 * 60 * 1000,
    );
  }

  return {
    severity,
    alertLevel,
    nextEscalationAt,
  };
}

function getManualReviewSlaAnomalyRuleState(args: {
  ageHours: number;
  anomalyKind: ItemFulfillmentAnomalyKind;
  routingCode: ItemManualReviewRoutingCode;
  priority: ItemManualReviewPriority;
  slaPolicy: ReturnType<typeof getManualReviewSlaPolicy>;
  referenceTime: Date;
}) {
  const baseProgress = getManualReviewSlaAnomalyProgress(args);
  const sortedStages = [...args.slaPolicy.anomalyStages]
    .filter((stage) => {
      const kindMatch = !stage.appliesToKinds || stage.appliesToKinds.length === 0 || stage.appliesToKinds.includes(args.anomalyKind);
      const routingMatch =
        !stage.routingCodes || stage.routingCodes.length === 0 || stage.routingCodes.includes(args.routingCode);
      const priorityMatch =
        !stage.priorities || stage.priorities.length === 0 || stage.priorities.includes(args.priority);
      return kindMatch && routingMatch && priorityMatch;
    })
    .sort((left, right) => left.minAgeHours - right.minAgeHours);

  let severity = baseProgress.severity;
  let alertLevel = baseProgress.alertLevel;
  let anomalyPolicyKey = args.slaPolicy.anomalyPolicyKey;
  let anomalyEscalationStrategy = args.slaPolicy.anomalyEscalationStrategy;
  let anomalyAutoAction = args.slaPolicy.anomalyAutoAction;
  let autoActionTemplateKey = args.slaPolicy.autoAssignTemplateKey ?? null;
  let cooldownMinutes = args.slaPolicy.anomalyCooldownMinutes;
  let matchedStageKey: string | null = null;

  for (const stage of sortedStages) {
    if (args.ageHours < stage.minAgeHours) {
      break;
    }
    matchedStageKey = stage.key;
    if (stage.severity !== null) severity = stage.severity;
    if (stage.alertLevel !== null) alertLevel = stage.alertLevel;
    if (stage.anomalyPolicyKey !== null) anomalyPolicyKey = stage.anomalyPolicyKey;
    if (stage.anomalyEscalationStrategy !== null) anomalyEscalationStrategy = stage.anomalyEscalationStrategy;
    if (stage.anomalyAutoAction !== null) anomalyAutoAction = stage.anomalyAutoAction;
    if (stage.autoActionTemplateKey !== null) autoActionTemplateKey = stage.autoActionTemplateKey;
    if (stage.cooldownMinutes !== null) cooldownMinutes = stage.cooldownMinutes;
  }

  const nextStage = sortedStages.find((stage) => args.ageHours < stage.minAgeHours) ?? null;
  const nextEscalationAt = nextStage
    ? new Date(args.referenceTime.getTime() + (nextStage.minAgeHours - args.ageHours) * 60 * 60 * 1000)
    : baseProgress.nextEscalationAt;
  const nextAlertEligibleAt =
    cooldownMinutes !== null ? new Date(args.referenceTime.getTime() + cooldownMinutes * 60 * 1000) : null;

  return {
    severity,
    alertLevel,
    anomalyPolicyKey,
    anomalyEscalationStrategy,
    anomalyAutoAction,
    autoActionTemplateKey,
    cooldownMinutes,
    nextEscalationAt,
    nextAlertEligibleAt,
    matchedStageKey,
  };
}

const manualReviewLinkedAnomalyKinds = new Set<ItemFulfillmentAnomalyKind>([
  "manual_review_routed",
  "stale_manual_review",
  "sla_due_soon_unclaimed",
  "sla_breach_unclaimed",
]);

async function getManualReviewLinkedAnomalyRuleStateInTx(args: {
  tx: DbTx;
  anomaly: typeof itemFulfillmentAnomalies.$inferSelect;
  referenceTime: Date;
}) {
  const anomalyKind = args.anomaly.kind as ItemFulfillmentAnomalyKind;
  if (!args.anomaly.reviewId || !manualReviewLinkedAnomalyKinds.has(anomalyKind)) {
    return null;
  }

  const [review] = await args.tx
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.id, args.anomaly.reviewId))
    .limit(1);
  if (!review || review.status !== "open") {
    return null;
  }

  const ageHours = getManualReviewAgeHours(review.createdAt, args.referenceTime);
  const priority = getManualReviewPriority({
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    ageHours,
  });
  const slaPolicy = getManualReviewSlaPolicy({
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    priority,
  });
  const anomalyProgress = getManualReviewSlaAnomalyProgress({
    ageHours,
    slaPolicy,
    referenceTime: args.referenceTime,
  });
  const anomalyRuleState = getManualReviewSlaAnomalyRuleState({
    ageHours,
    anomalyKind,
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    priority,
    slaPolicy,
    referenceTime: args.referenceTime,
  });
  const slaDrivenAutoAction = getManualReviewSlaDrivenAutoAction({
    slaPolicy,
    anomalyProgress,
    ageHours,
  });

  return {
    review,
    ageHours,
    priority,
    slaPolicy,
    anomalyRuleState,
    effectiveAutoAction: anomalyRuleState.anomalyAutoAction ?? slaDrivenAutoAction.autoAction,
    effectiveAutoActionTemplateKey:
      anomalyRuleState.autoActionTemplateKey ?? slaDrivenAutoAction.autoActionTemplateKey,
  };
}

function getManualReviewSlaDrivenAutoAction(args: {
  slaPolicy: ReturnType<typeof getManualReviewSlaPolicy>;
  anomalyProgress: ReturnType<typeof getManualReviewSlaAnomalyProgress>;
  ageHours: number;
}) {
  if (!args.slaPolicy.autoAssignEnabled) {
    return {
      autoAction: null,
      autoActionTemplateKey: null,
    };
  }

  if (args.slaPolicy.rebalanceAfterHours !== null && args.ageHours >= args.slaPolicy.rebalanceAfterHours) {
    return {
      autoAction: "rebalance_queue" as const,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  if (args.slaPolicy.assignAfterHours !== null && args.ageHours >= args.slaPolicy.assignAfterHours) {
    return {
      autoAction: "assign_template" as const,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  if (args.slaPolicy.anomalyAutoAction) {
    return {
      autoAction: args.slaPolicy.anomalyAutoAction,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  if (args.anomalyProgress.alertLevel >= 3) {
    return {
      autoAction: "rebalance_queue" as const,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  if (args.anomalyProgress.alertLevel >= 2) {
    return {
      autoAction: "assign_template" as const,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  return {
    autoAction: null,
    autoActionTemplateKey: null,
  };
}

function getManualReviewSlaRank(bucket: ItemManualReviewSlaBucket) {
  switch (bucket) {
    case "breached":
      return 3;
    case "due_soon":
      return 2;
    default:
      return 1;
  }
}

function getManualReviewEscalationLevel(args: {
  ageHours: number;
  slaBucket: ItemManualReviewSlaBucket;
  priority: ItemManualReviewPriority;
  routingCode: ItemManualReviewRoutingCode;
}) {
  const policy = getManualReviewSlaPolicy({
    routingCode: args.routingCode,
    priority: args.priority,
  });
  if (args.slaBucket !== "breached") return 0;
  if (policy.urgentAfterHours !== null && args.ageHours >= policy.urgentAfterHours) return 3;
  if (policy.criticalAfterHours !== null && args.ageHours >= policy.criticalAfterHours) return 2;
  return 1;
}

function getManualReviewAgeBucket(ageHours: number) {
  if (ageHours < 24) return "under_24h";
  if (ageHours < 72) return "24h_to_72h";
  return "72h_plus";
}

function getManualReviewClaimAgeHours(claimedAt: Date | null, referenceTime: Date) {
  if (!claimedAt) return null;
  return Math.max(0, Math.floor((referenceTime.getTime() - claimedAt.getTime()) / (60 * 60 * 1000)));
}

function getManualReviewClaimAgeBucket(claimAgeHours: number | null) {
  if (claimAgeHours === null) return "unclaimed";
  if (claimAgeHours < env.manualReviewStaleClaimHours) return "active_claim";
  return "stale_claim";
}

function isManualReviewClaimStale(claimedAt: Date | null, referenceTime: Date) {
  const claimAgeHours = getManualReviewClaimAgeHours(claimedAt, referenceTime);
  return claimAgeHours !== null && claimAgeHours >= env.manualReviewStaleClaimHours;
}

function isIssueReportingEnabled(fulfillmentMode: string) {
  return fulfillmentMode === "maintained_pool" || fulfillmentMode === "warranty_delivery";
}

function buildUnitCode(slotNumber: number, generation: number) {
  return `UNIT-${String(slotNumber).padStart(2, "0")}-G${generation}`;
}

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

function toOrderView(
  order: typeof orders.$inferSelect,
  product: typeof products.$inferSelect,
  discountMeta?: {
    discountSource?: OrderDiscountSource;
    discountLabel?: string | null;
  },
): OrderView {
  return {
    id: order.id,
    productId: order.productId,
    productTitle: product.title,
    currency: order.currency as ProductCurrency,
    originalAmount: order.originalAmount,
    discountAmount: order.discountAmount,
    finalAmount: order.finalAmount,
    discountCode: order.discountCode,
    discountSource: discountMeta?.discountSource ?? "none",
    discountLabel: discountMeta?.discountLabel ?? null,
    status: order.status as OrderView["status"],
    rolledBackAt: order.rolledBackAt ? order.rolledBackAt.toISOString() : null,
    rolledBackByUserId: order.rolledBackByUserId,
    rollbackReason: order.rollbackReason,
    rollbackNote: order.rollbackNote,
    createdAt: order.createdAt.toISOString(),
  };
}

function toItemUnitView(unit: typeof itemUnits.$inferSelect): ItemUnitView {
  const statusMap: Record<string, ItemUnitView["status"]> = {
    active: "active",
    inactive: "inactive",
    replaced: "replaced",
    consumed: "consumed",
  };

  return {
    id: unit.id,
    code: unit.code,
    status: statusMap[unit.status] ?? "inactive",
    issueReason: (unit.issueReason as ItemUnitIssueReason | null) ?? null,
    activatedAt: unit.activatedAt ? unit.activatedAt.toISOString() : null,
    expiresAt: unit.expiresAt ? unit.expiresAt.toISOString() : null,
    replacedByUnitId: unit.replacedByUnitId,
  };
}

function getItemIssueRejectionSummary(rejectionCode: ItemIssueRejectionCode | null) {
  return rejectionCode === "warranty_expired"
    ? "当前质保窗口已结束，本次上报不会再自动补号。"
    : rejectionCode === "reason_not_covered"
      ? "当前问题原因不在自动补号覆盖范围内。"
      : rejectionCode === "manual_review_required"
        ? "本次上报已进入人工复核队列，等待平台操作员处理。"
        : rejectionCode === "quota_exhausted_not_replaceable"
          ? "该问题被判定为额度耗尽，不属于自动补号范围。"
          : rejectionCode === "normal_exhaustion_not_replaceable"
        ? "该问题被判定为正常耗尽，不属于自动补号范围。"
            : null;
}

function getItemIssueRejectionCategory(
  rejectionCode: ItemIssueRejectionCode | null,
): ItemIssueReportView["rejectionCategory"] {
  if (rejectionCode === "manual_review_required") return "manual_review";
  if (rejectionCode === "warranty_expired") return "warranty_window";
  if (rejectionCode === "reason_not_covered") return "policy_restriction";
  if (
    rejectionCode === "quota_exhausted_not_replaceable" ||
    rejectionCode === "normal_exhaustion_not_replaceable"
  ) {
    return "usage_exhaustion";
  }
  return null;
}

function getItemIssueOperatorHint(rejectionCode: ItemIssueRejectionCode | null): string | null {
  return rejectionCode === "manual_review_required"
    ? "等待平台操作员处理当前人工复核项，并确认是否需要补位、补号或拒绝上报。"
    : rejectionCode === "warranty_expired"
      ? "复核购买时间、质保窗口和异常发生时间，确认是否存在补偿或例外处理空间。"
      : rejectionCode === "reason_not_covered"
        ? "确认问题原因是否被正确分类；如分类错误，可改走人工复核或补位流程。"
        : rejectionCode === "quota_exhausted_not_replaceable"
          ? "核查额度审计记录，确认是否属于正常额度耗尽而非异常失效。"
          : rejectionCode === "normal_exhaustion_not_replaceable"
            ? "核查使用记录，确认该单元是否属于正常耗尽且不应再补位。"
            : null;
}

function isItemIssueAppealable(rejectionCode: ItemIssueRejectionCode | null) {
  return (
    rejectionCode === "manual_review_required" ||
    rejectionCode === "warranty_expired" ||
    rejectionCode === "reason_not_covered"
  );
}

function getFulfillmentAnomalySeverity(
  kind: ItemFulfillmentAnomalyKind,
  routingCode: ItemManualReviewRoutingCode | null,
): ItemFulfillmentAnomalySeverity {
  if (
    kind === "reconcile_failure" ||
    kind === "sla_breach_unclaimed" ||
    routingCode === "high_replacement_frequency"
  ) {
    return "critical";
  }
  return "warning";
}

function getFulfillmentAnomalyPolicyTemplate(args: {
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  routingCode: ItemManualReviewRoutingCode | null;
  preferredPolicyKey?: string | null;
}) {
  const candidateKeys = [
    args.preferredPolicyKey ? args.preferredPolicyKey : null,
    args.routingCode ? `routing:${args.routingCode}` : null,
    `kind:${args.kind}`,
    `severity:${args.severity}`,
    "default",
  ].filter((value): value is string => Boolean(value));
  const matchedKey =
    candidateKeys.find((key) => env.fulfillmentAnomalyPolicyTemplates[key]) ??
    (env.fulfillmentAnomalyPolicyTemplates.default ? "default" : candidateKeys[0]);
  const template = env.fulfillmentAnomalyPolicyTemplates[matchedKey];
  if (!template) {
    throw new ConflictError("Fulfillment anomaly policy template is not configured");
  }
  return {
    key: matchedKey,
    scope: matchedKey.startsWith("routing:")
      ? ("routing" as const)
      : matchedKey.startsWith("kind:")
        ? ("kind" as const)
        : matchedKey.startsWith("severity:")
          ? ("severity" as const)
          : ("default" as const),
    ...template,
  };
}

function getFulfillmentAnomalyAlertLevel(args: {
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  routingCode: ItemManualReviewRoutingCode | null;
  detectedAt: Date;
  referenceTime?: Date;
}) {
  const referenceTime = args.referenceTime ?? now();
  const ageHours = Math.max(0, Math.floor((referenceTime.getTime() - args.detectedAt.getTime()) / (60 * 60 * 1000)));
  const template = getFulfillmentAnomalyPolicyTemplate({
    kind: args.kind,
    severity: args.severity,
    routingCode: args.routingCode,
  });
  const thresholds = template.thresholds;
  let alertLevel = 0;
  thresholds.forEach((threshold, index) => {
    if (ageHours >= threshold) {
      alertLevel = index + 1;
    }
  });
  return Math.min(alertLevel, template.maxAlertLevel);
}

function getFulfillmentAnomalyRuleState(args: {
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  routingCode: ItemManualReviewRoutingCode | null;
  detectedAt: Date;
  referenceTime: Date;
  preferredPolicyKey?: string | null;
}) {
  const ageHours = Math.max(0, Math.floor((args.referenceTime.getTime() - args.detectedAt.getTime()) / (60 * 60 * 1000)));
  const policy = getFulfillmentAnomalyPolicyTemplate({
    kind: args.kind,
    severity: args.severity,
    routingCode: args.routingCode,
    preferredPolicyKey: args.preferredPolicyKey,
  });
  const baseAlertLevel = getFulfillmentAnomalyAlertLevel({
    kind: args.kind,
    severity: args.severity,
    routingCode: args.routingCode,
    detectedAt: args.detectedAt,
    referenceTime: args.referenceTime,
  });
  const matchedStage =
    [...policy.anomalyStages]
      .filter((stage) => ageHours >= stage.minAgeHours)
      .filter((stage) => !stage.appliesToKinds || stage.appliesToKinds.includes(args.kind))
      .filter((stage) => !stage.routingCodes || (args.routingCode ? stage.routingCodes.includes(args.routingCode) : false))
      .sort((left, right) => right.minAgeHours - left.minAgeHours || left.key.localeCompare(right.key))[0] ?? null;
  const cooldownMinutes = matchedStage?.cooldownMinutes ?? policy.cooldownMinutes;
  const nextAlertEligibleAt =
    cooldownMinutes !== null ? new Date(args.referenceTime.getTime() + cooldownMinutes * 60 * 1000) : null;

  return {
    ageHours,
    severity: matchedStage?.severity ?? args.severity,
    alertLevel: Math.max(baseAlertLevel, matchedStage?.alertLevel ?? 0),
    anomalyPolicyKey: matchedStage?.anomalyPolicyKey ?? policy.key,
    escalationStrategy: matchedStage?.anomalyEscalationStrategy ?? policy.escalationStrategy,
    autoAction: matchedStage?.anomalyAutoAction ?? policy.autoAction,
    autoActionTemplateKey: matchedStage?.autoActionTemplateKey ?? policy.autoActionTemplateKey,
    cooldownMinutes,
    nextAlertEligibleAt,
    matchedStageKey: matchedStage?.key ?? null,
    policy,
  };
}

function buildFulfillmentAnomalyAlertReason(args: {
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  alertLevel: number;
  policyKey: string;
  escalationStrategy: string;
}) {
  return `Anomaly ${args.kind} escalated to alert level ${args.alertLevel} (${args.severity}) via policy ${args.policyKey} / ${args.escalationStrategy}.`;
}

function buildFulfillmentAnomalyAutoActionFailureReason(args: {
  anomalyId: string;
  action: string;
  attemptCount: number;
  maxAutoActionFailures: number;
  failureEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
  policyKey: string;
}) {
  return `Anomaly ${args.anomalyId} exhausted auto action ${args.action} after ${args.attemptCount}/${args.maxAutoActionFailures} attempts and was escalated via ${args.policyKey} / ${args.failureEscalationStrategy}.`;
}

function getNextFulfillmentAnomalyEscalationAt(args: {
  detectedAt: Date;
  currentAlertLevel: number;
  policy: ReturnType<typeof getFulfillmentAnomalyPolicyTemplate>;
}) {
  const nextThreshold = args.policy.thresholds[args.currentAlertLevel];
  if (typeof nextThreshold !== "number") {
    return null;
  }
  return new Date(args.detectedAt.getTime() + nextThreshold * 60 * 60 * 1000);
}

function getNextFulfillmentAnomalyAlertEligibleAt(referenceTime: Date, policy: ReturnType<typeof getFulfillmentAnomalyPolicyTemplate>) {
  return new Date(referenceTime.getTime() + policy.cooldownMinutes * 60 * 1000);
}

function toItemFulfillmentAnomalyView(
  row: typeof itemFulfillmentAnomalies.$inferSelect,
): ItemFulfillmentAnomalyView {
  return {
    id: row.id,
    itemId: row.itemId,
    reportId: row.reportId,
    reviewId: row.reviewId,
    kind: row.kind as ItemFulfillmentAnomalyKind,
    severity: row.severity as ItemFulfillmentAnomalySeverity,
    status: row.status as "open" | "resolved",
    routingCode: (row.routingCode as ItemManualReviewRoutingCode | null) ?? null,
    policyKey: row.policyKey,
    escalationStrategy: row.escalationStrategy,
    autoAction: (row.autoAction as "none" | "assign_template" | "rebalance_queue") ?? "none",
    autoActionTemplateKey: row.autoActionTemplateKey,
    summary: row.summary,
    detail: row.detail,
    detectedAt: row.detectedAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    occurrenceCount: row.occurrenceCount,
    alertLevel: row.alertLevel,
    alertedAt: row.alertedAt ? row.alertedAt.toISOString() : null,
    lastAlertReason: row.lastAlertReason,
    nextAlertEligibleAt: row.nextAlertEligibleAt ? row.nextAlertEligibleAt.toISOString() : null,
    nextEscalationAt: row.nextEscalationAt ? row.nextEscalationAt.toISOString() : null,
    lastAutoAction: row.lastAutoAction,
    lastAutoActionAt: row.lastAutoActionAt ? row.lastAutoActionAt.toISOString() : null,
    autoActionAttemptCount: row.autoActionAttemptCount,
    lastAutoActionStatus: (row.lastAutoActionStatus as "applied" | "noop" | "failed" | null) ?? null,
    lastAutoActionError: row.lastAutoActionError,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolutionNote: row.resolutionNote,
  };
}

function getResolvedManualReviewRejectionCode(args: {
  reason: ItemUnitIssueReason;
  routingCode: ItemManualReviewRoutingCode;
}) {
  if (args.routingCode === "usage_audit_required") {
    return args.reason === "quota_exhausted"
      ? ("quota_exhausted_not_replaceable" as ItemIssueRejectionCode)
      : args.reason === "normal_exhaustion"
        ? ("normal_exhaustion_not_replaceable" as ItemIssueRejectionCode)
        : ("manual_review_required" as ItemIssueRejectionCode);
  }

  return "manual_review_required" as ItemIssueRejectionCode;
}

function toItemIssueReportView(report: typeof itemIssueReports.$inferSelect): ItemIssueReportView {
  const rejectionCode = (report.rejectionCode as ItemIssueRejectionCode | null) ?? null;
  return {
    id: report.id,
    itemId: report.itemId,
    unitId: report.unitId,
    reason: report.reason as ItemUnitIssueReason,
    outcome: report.outcome as ItemIssueReportOutcome,
    rejectionCode,
    rejectionCategory: getItemIssueRejectionCategory(rejectionCode),
    rejectionSummary: getItemIssueRejectionSummary(rejectionCode),
    operatorHint: getItemIssueOperatorHint(rejectionCode),
    appealable: isItemIssueAppealable(rejectionCode),
    replacementUnitId: report.replacementUnitId,
    createdAt: report.createdAt.toISOString(),
  };
}

function toItemManualReviewView(
  review: typeof itemManualReviews.$inferSelect,
  report?: typeof itemIssueReports.$inferSelect | null,
  referenceTime: Date = now(),
  viewerUserId?: string | null,
  assignmentHistory: ItemManualReviewAssignmentEventView[] = [],
): ItemManualReviewView {
  const ageHours = getManualReviewAgeHours(review.createdAt, referenceTime);
  const claimAgeHours = getManualReviewClaimAgeHours(review.claimedAt, referenceTime);
  const isStaleClaim = isManualReviewClaimStale(review.claimedAt, referenceTime);
  const priority = getManualReviewPriority({
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    ageHours,
  });
  const slaBucket = getManualReviewSlaBucket({
    ageHours,
    priority,
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
  });
  const escalationLevel = Math.max(
    review.escalationLevel ?? 0,
    getManualReviewEscalationLevel({
      ageHours,
      slaBucket,
      priority,
      routingCode: review.routingCode as ItemManualReviewRoutingCode,
    }),
  );
  const rejectionCode =
    (report?.rejectionCode as ItemIssueRejectionCode | null) ??
    (review.status === "rejected"
      ? getResolvedManualReviewRejectionCode({
          reason: review.reason as ItemUnitIssueReason,
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
        })
      : ("manual_review_required" as ItemIssueRejectionCode));
  return {
    id: review.id,
    itemId: review.itemId,
    unitId: review.unitId,
    reportId: review.reportId,
    slotNumber: review.slotNumber,
    status: review.status as ItemManualReviewStatus,
    reason: review.reason as ItemUnitIssueReason,
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    routingSummary: review.routingSummary,
    suggestedAction: review.suggestedAction as ItemManualReviewSuggestedAction,
    rejectionCode,
    rejectionCategory: getItemIssueRejectionCategory(rejectionCode),
    rejectionSummary: getItemIssueRejectionSummary(rejectionCode),
    operatorHint: getItemIssueOperatorHint(rejectionCode),
    appealable: isItemIssueAppealable(rejectionCode),
    assigneeUserId: review.assigneeUserId,
    claimedAt: review.claimedAt ? review.claimedAt.toISOString() : null,
    claimAgeHours,
    isStaleClaim,
    lastClaimReleasedAt: review.lastClaimReleasedAt ? review.lastClaimReleasedAt.toISOString() : null,
    lastClaimReleaseReason:
      (review.lastClaimReleaseReason as "operator_release" | "stale_timeout_release" | null) ?? null,
    autoAssignmentCount: review.autoAssignmentCount,
    lastAutoAssignedAt: review.lastAutoAssignedAt ? review.lastAutoAssignedAt.toISOString() : null,
    escalationLevel,
    slaEscalatedAt: review.slaEscalatedAt ? review.slaEscalatedAt.toISOString() : null,
    priority,
    ageHours,
    slaBucket,
    slaBreached: slaBucket === "breached",
    resolutionAction: (review.resolutionAction as ItemManualReviewAction | null) ?? null,
    resolutionNote: review.resolutionNote,
    reviewerUserId: review.reviewerUserId,
    createdAt: review.createdAt.toISOString(),
    resolvedAt: review.resolvedAt ? review.resolvedAt.toISOString() : null,
    canClaim: review.status === "open" && !review.assigneeUserId && Boolean(viewerUserId),
    canRelease:
      review.status === "open" &&
      Boolean(viewerUserId) &&
      review.assigneeUserId === viewerUserId,
    assignmentHistory,
  };
}

function toItemManualReviewAssignmentEventView(
  row: typeof itemManualReviewAssignmentEvents.$inferSelect,
): ItemManualReviewAssignmentEventView {
  return {
    id: row.id,
    reviewId: row.reviewId,
    itemId: row.itemId,
    reportId: row.reportId,
    actorUserId: row.actorUserId,
    action: row.action as ItemManualReviewAssignmentAction,
    fromAssigneeUserId: row.fromAssigneeUserId,
    toAssigneeUserId: row.toAssigneeUserId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

async function buildManualReviewAssignmentHistoryMap(reviewIds: string[], executor: DbTx | typeof db = db) {
  if (reviewIds.length === 0) {
    return new Map<string, ItemManualReviewAssignmentEventView[]>();
  }

  const rows = await executor
    .select()
    .from(itemManualReviewAssignmentEvents)
    .where(inArray(itemManualReviewAssignmentEvents.reviewId, reviewIds))
    .orderBy(desc(itemManualReviewAssignmentEvents.createdAt));

  const map = new Map<string, ItemManualReviewAssignmentEventView[]>();
  for (const row of rows) {
    const events = map.get(row.reviewId) ?? [];
    events.push(toItemManualReviewAssignmentEventView(row));
    map.set(row.reviewId, events);
  }
  return map;
}

function toItemReplacementLogView(log: typeof itemReplacementLogs.$inferSelect): ItemReplacementLogView {
  return {
    id: log.id,
    itemId: log.itemId,
    previousUnitId: log.previousUnitId,
    replacementUnitId: log.replacementUnitId,
    reason: (log.reason as ItemUnitIssueReason | null) ?? null,
    trigger: log.trigger as ItemReplacementLogTrigger,
    createdAt: log.createdAt.toISOString(),
  };
}

function toItemFulfillmentRunView(run: typeof itemFulfillmentRuns.$inferSelect): ItemFulfillmentRunView {
  return {
    id: run.id,
    itemId: run.itemId,
    trigger: run.trigger as ItemFulfillmentRunTrigger,
    status: run.status as ItemFulfillmentRunStatus,
    scannedUnits: run.scannedUnits,
    replacementsCreated: run.replacementsCreated,
    note: run.note,
    createdAt: run.createdAt.toISOString(),
  };
}

function toItemView(
  item: typeof items.$inferSelect,
  unitsForItem: typeof itemUnits.$inferSelect[] = [],
  issueReportsForItem: typeof itemIssueReports.$inferSelect[] = [],
  manualReviewsForItem: typeof itemManualReviews.$inferSelect[] = [],
  replacementLogsForItem: typeof itemReplacementLogs.$inferSelect[] = [],
  fulfillmentRunsForItem: typeof itemFulfillmentRuns.$inferSelect[] = [],
  manualReviewAssignmentHistoryByReviewId: Map<string, ItemManualReviewAssignmentEventView[]> = new Map(),
): ItemView {
  const issueReportsById = new Map(issueReportsForItem.map((report) => [report.id, report]));
  return {
    id: item.id,
    productId: item.productId,
    productTitle: item.productTitle,
    fulfillmentMode: item.fulfillmentMode as FulfillmentMode,
    transferable: item.transferable,
    status: item.status as ItemView["status"],
    remainingUses: item.remainingUses,
    totalUnits: item.totalUnits,
    activeUnits: item.activeUnits,
    replacementCount: item.replacementCount,
    warrantyExpiresAt: item.warrantyExpiresAt ? item.warrantyExpiresAt.toISOString() : null,
    issueReportingEnabled: isIssueReportingEnabled(item.fulfillmentMode),
    units: unitsForItem.map(toItemUnitView),
    issueReports: issueReportsForItem.map(toItemIssueReportView),
    manualReviews: manualReviewsForItem.map((review) =>
      toItemManualReviewView(
        review,
        issueReportsById.get(review.reportId),
        now(),
        null,
        manualReviewAssignmentHistoryByReviewId.get(review.id) ?? [],
      ),
    ),
    replacementLogs: replacementLogsForItem.map(toItemReplacementLogView),
    fulfillmentRuns: fulfillmentRunsForItem.map(toItemFulfillmentRunView),
    lastReconciledAt: item.lastReconciledAt ? item.lastReconciledAt.toISOString() : null,
    expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
    revokedAt: item.revokedAt ? item.revokedAt.toISOString() : null,
    revokedByUserId: item.revokedByUserId,
    revocationReason: item.revocationReason,
    createdAt: item.createdAt.toISOString(),
  };
}

function toDiscountCodeView(discountCode: typeof discountCodes.$inferSelect): DiscountCodeView {
  return {
    id: discountCode.id,
    code: discountCode.code,
    enabled: discountCode.enabled,
    scope: discountCode.scope as DiscountCodeView["scope"],
    audienceScope: discountCode.audienceScope as DiscountCodeView["audienceScope"],
    valueKind: discountCode.valueKind as DiscountCodeView["valueKind"],
    valueAmount: discountCode.valueAmount,
    startsAt: discountCode.startsAt ? discountCode.startsAt.toISOString() : null,
    expiresAt: discountCode.expiresAt ? discountCode.expiresAt.toISOString() : null,
    totalMaxUses: discountCode.totalMaxUses,
    totalUsedCount: discountCode.usedCount,
    perUserLimit: discountCode.perUserLimit,
  };
}

async function getUserForDiscountEvaluation(tx: DbTx, userId: string) {
  const user = await tx.query.users.findFirst({
    where: (row, operators) => operators.eq(row.id, userId),
  });

  if (!user) {
    throw new NotFoundError("用户不存在，无法校验优惠码");
  }

  return user;
}

function matchesUserGroup(groupKey: string | null, user: NonNullable<Awaited<ReturnType<typeof getUserForDiscountEvaluation>>>) {
  if (!groupKey) return false;
  if (groupKey === "trusted_users") {
    return (user.trustLevel ?? 0) >= 2;
  }
  if (groupKey === "new_users") {
    return user.createdAt.getTime() >= now().getTime() - 7 * 24 * 60 * 60 * 1000;
  }
  return false;
}

function evaluateScope(product: typeof products.$inferSelect, discountCode: typeof discountCodes.$inferSelect) {
  if (discountCode.scope === "allProducts") return true;
  if (discountCode.scope === "productCategory") {
    return product.category === discountCode.targetProductCategory;
  }
  if (discountCode.scope === "specificProduct") {
    return product.id === discountCode.targetProductId;
  }
  return false;
}

async function evaluateAudience(tx: DbTx, userId: string, discountCode: typeof discountCodes.$inferSelect) {
  if (discountCode.audienceScope === "allUsers") return true;
  if (discountCode.audienceScope === "specificUser") {
    return discountCode.audienceUserId === userId;
  }

  if (discountCode.audienceScope === "userGroup") {
    const user = await getUserForDiscountEvaluation(tx, userId);
    return matchesUserGroup(discountCode.audienceGroupKey, user);
  }

  return false;
}

function calculateDiscountAmount(productPrice: number, discountCode: typeof discountCodes.$inferSelect) {
  if (discountCode.valueKind === "fixedAmount") {
    return Math.max(0, Math.min(productPrice, discountCode.valueAmount));
  }

  if (discountCode.valueKind === "percentage") {
    return Math.max(0, Math.min(productPrice, Math.floor((productPrice * discountCode.valueAmount) / 100)));
  }

  return 0;
}

type CodeDiscountResolution = {
  discountCode: typeof discountCodes.$inferSelect;
  discountAmount: number;
  finalAmount: number;
  appliedCode: string;
};

type AppliedOrderDiscountResolution = {
  source: OrderDiscountSource;
  discountCode: typeof discountCodes.$inferSelect | null;
  discountAmount: number;
  finalAmount: number;
  appliedCode: string | null;
  discountLabel: string | null;
};

function buildNoDiscountResolution(productPrice: number): AppliedOrderDiscountResolution {
  return {
    source: "none",
    discountCode: null,
    discountAmount: 0,
    finalAmount: productPrice,
    appliedCode: null,
    discountLabel: null,
  };
}

function buildCodeDiscountResolution(
  codeResolution: CodeDiscountResolution,
): AppliedOrderDiscountResolution {
  return {
    source: "code",
    discountCode: codeResolution.discountCode,
    discountAmount: codeResolution.discountAmount,
    finalAmount: codeResolution.finalAmount,
    appliedCode: codeResolution.appliedCode,
    discountLabel: `优惠码：${codeResolution.appliedCode}`,
  };
}

async function resolveCodeDiscountForOrder(args: {
  tx: DbTx;
  userId: string;
  product: typeof products.$inferSelect;
  discountCodeInput?: string;
}): Promise<CodeDiscountResolution | null> {
  const normalizedCode = args.discountCodeInput?.trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  if (!args.product.allowDiscountCodes) {
    throw new BadRequestError("该商品当前不支持优惠码");
  }

  await args.tx.execute(sql`select id from discount_codes where code = ${normalizedCode} for update`);
  const discountCode = await args.tx.query.discountCodes.findFirst({
    where: (row, operators) => operators.eq(row.code, normalizedCode),
  });

  if (!discountCode || !discountCode.enabled) {
    throw new BadRequestError("优惠码不存在或已停用");
  }

  const currentTime = now();
  if (discountCode.startsAt && discountCode.startsAt > currentTime) {
    throw new BadRequestError("优惠码尚未生效");
  }
  if (discountCode.expiresAt && discountCode.expiresAt < currentTime) {
    throw new BadRequestError("优惠码已过期");
  }

  if (discountCode.totalMaxUses !== null && discountCode.usedCount >= discountCode.totalMaxUses) {
    throw new BadRequestError("优惠码平台总使用量已达上限");
  }

  if (!evaluateScope(args.product, discountCode)) {
    throw new BadRequestError("优惠码不适用于当前商品");
  }

  const audienceMatched = await evaluateAudience(args.tx, args.userId, discountCode);
  if (!audienceMatched) {
    throw new BadRequestError("当前用户不满足优惠码使用条件");
  }

  if (discountCode.perUserLimit !== null) {
    const [usageCountRow] = await args.tx
      .select({ count: count() })
      .from(discountCodeUsages)
      .where(and(eq(discountCodeUsages.discountCodeId, discountCode.id), eq(discountCodeUsages.userId, args.userId)));
    const usageCount = Number(usageCountRow?.count ?? 0);
    if (usageCount >= discountCode.perUserLimit) {
      throw new BadRequestError("该优惠码已达到你的可使用次数上限");
    }
  }

  const discountAmount = calculateDiscountAmount(args.product.price, discountCode);
  return {
    discountCode,
    discountAmount,
    finalAmount: Math.max(0, args.product.price - discountAmount),
    appliedCode: discountCode.code,
  } satisfies CodeDiscountResolution;
}

async function resolveDiscountForOrder(args: {
  tx: DbTx;
  userId: string;
  product: typeof products.$inferSelect;
  discountCodeInput?: string;
}) {
  const codeResolution = await resolveCodeDiscountForOrder(args);
  if (codeResolution) {
    return buildCodeDiscountResolution(codeResolution);
  }
  return buildNoDiscountResolution(args.product.price);
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

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

async function loadItemViewInTx(tx: DbTx, itemId: string) {
  const [item] = await tx.select().from(items).where(eq(items.id, itemId));
  if (!item) {
    throw new NotFoundError("资产不存在");
  }

  const unitsForItem = await tx
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.itemId, itemId))
    .orderBy(itemUnits.slotNumber, itemUnits.generation, itemUnits.createdAt);
  const issueReportsForItem = await tx
    .select()
    .from(itemIssueReports)
    .where(eq(itemIssueReports.itemId, itemId))
    .orderBy(itemIssueReports.createdAt);
  const manualReviewsForItem = await tx
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.itemId, itemId))
    .orderBy(itemManualReviews.createdAt);
  const replacementLogsForItem = await tx
    .select()
    .from(itemReplacementLogs)
    .where(eq(itemReplacementLogs.itemId, itemId))
    .orderBy(itemReplacementLogs.createdAt);
  const fulfillmentRunsForItem = await tx
    .select()
    .from(itemFulfillmentRuns)
    .where(eq(itemFulfillmentRuns.itemId, itemId))
    .orderBy(itemFulfillmentRuns.createdAt);

  return toItemView(
    item,
    unitsForItem,
    issueReportsForItem,
    manualReviewsForItem,
    replacementLogsForItem,
    fulfillmentRunsForItem,
  );
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

function getNonReplacementUnitStatus(reason: ItemUnitIssueReason): "inactive" | "consumed" {
  if (reason === "quota_exhausted" || reason === "normal_exhaustion") {
    return "consumed";
  }
  return "inactive";
}

function shouldReplaceWarrantyUnit(item: typeof items.$inferSelect, reason: ItemUnitIssueReason, timestamp: Date) {
  const withinWarranty = item.warrantyExpiresAt ? item.warrantyExpiresAt.getTime() >= timestamp.getTime() : false;
  if (!withinWarranty) {
    return false;
  }
  return reason === "invalidated" || reason === "expired";
}

function getWarrantyRejectionCode(item: typeof items.$inferSelect, reason: ItemUnitIssueReason, timestamp: Date) {
  const withinWarranty = item.warrantyExpiresAt ? item.warrantyExpiresAt.getTime() >= timestamp.getTime() : false;
  if (!withinWarranty) {
    return "warranty_expired" as ItemIssueRejectionCode;
  }
  if (reason === "quota_exhausted") {
    return "quota_exhausted_not_replaceable" as ItemIssueRejectionCode;
  }
  if (reason === "normal_exhaustion") {
    return "normal_exhaustion_not_replaceable" as ItemIssueRejectionCode;
  }
  if (!["invalidated", "expired"].includes(reason)) {
    return "reason_not_covered" as ItemIssueRejectionCode;
  }
  return null;
}

function isPlatformOperator(userId: string) {
  return env.platformOperatorUserIds.includes(userId);
}

function getManualReviewRoutingDecision(
  item: typeof items.$inferSelect,
  reason: ItemUnitIssueReason,
): {
  routingCode: ItemManualReviewRoutingCode;
  routingSummary: string;
  suggestedAction: ItemManualReviewSuggestedAction;
} | null {
  if (!isIssueReportingEnabled(item.fulfillmentMode)) return null;
  if (["quota_exhausted", "normal_exhaustion"].includes(reason)) {
    return {
      routingCode: "usage_audit_required",
      routingSummary:
        item.fulfillmentMode === "maintained_pool"
          ? "该服务型资产被上报为使用耗尽，建议先核对资源池配额、使用记录和池内补位策略，再决定是否人工补位。"
          : "该质保资产被上报为使用耗尽，当前不属于自动补号范围，建议先核对使用记录后再决定是否例外补号。",
      suggestedAction: "audit_usage",
    };
  }
  if (!["invalidated", "expired"].includes(reason)) return null;
  if (item.replacementCount < 3) return null;

  return {
    routingCode: "high_replacement_frequency",
    routingSummary:
      item.fulfillmentMode === "maintained_pool"
        ? "同一服务型资产已连续多次触发替换，建议先检查资源池健康与来源稳定性，再决定是否继续补位。"
        : "同一质保资产已多次触发补号，建议人工确认失效模式后再决定是否继续补号。",
    suggestedAction:
      item.fulfillmentMode === "maintained_pool" ? "inspect_pool_health" : "approve_replacement",
  };
}

function sortSummaryBuckets(bucketMap: Map<string, number>) {
  return [...bucketMap.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

let _defaultProductsEnsured = false;

export async function ensureDefaultProducts() {
  if (_defaultProductsEnsured) return;
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
  _defaultProductsEnsured = true;
}

export async function listProductsForOperator(): Promise<ProductOperatorView[]> {
  await ensureDefaultProducts();
  const productRows = await db.select().from(products).orderBy(desc(products.updatedAt), desc(products.createdAt));
  return productRows.map(toProductOperatorView);
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

let _defaultDiscountCodesEnsured = false;

export async function ensureDefaultDiscountCodes() {
  if (_defaultDiscountCodesEnsured) return;
  await ensureDefaultProducts();
  for (const discountCode of seededDiscountCodes) {
    const [existing] = await db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.id, discountCode.id)).limit(1);
    if (existing) {
      continue;
    }

    await db.transaction((tx) =>
      upsertDiscountCodeDefinitionInTx({
        tx,
        discountCodeId: discountCode.id,
        input: discountCode,
      }),
    );
  }
  _defaultDiscountCodesEnsured = true;
}

export async function listDiscountCodesForOperator(
  filters?: ListOperatorDiscountCodesInput,
): Promise<DiscountCodeOperatorView[]> {
  await ensureDefaultDiscountCodes();
  const rows = await db.select().from(discountCodes).orderBy(desc(discountCodes.updatedAt), desc(discountCodes.createdAt));
  const state = filters?.state ?? "all";
  const scope = filters?.scope ?? "all";
  const audienceScope = filters?.audienceScope ?? "all";
  const namespace = normalizeOptionalText(filters?.namespace);
  const batchLabel = normalizeOptionalText(filters?.batchLabel);
  const windowDays = clampDiscountCodeWindowDays(filters?.windowDays);
  const referenceTime = now();

  let product: typeof products.$inferSelect | null = null;
  if (filters?.productId) {
    const [targetProduct] = await db.select().from(products).where(eq(products.id, filters.productId)).limit(1);
    if (!targetProduct) {
      throw new NotFoundError("筛选商品不存在");
    }
    product = targetProduct;
  }

  return rows
    .filter((discountCode) => {
      if (scope !== "all" && discountCode.scope !== scope) return false;
      if (audienceScope !== "all" && discountCode.audienceScope !== audienceScope) return false;
      if (namespace !== null && discountCode.namespace !== namespace) return false;
      if (batchLabel !== null && discountCode.batchLabel !== batchLabel) return false;
      if (
        !matchesDiscountCodeStateFilter({
          discountCode,
          state,
          referenceTime,
          windowDays,
        })
      ) {
        return false;
      }
      if (product && !matchesDiscountCodeProduct({ discountCode, product })) {
        return false;
      }
      return true;
    })
    .map(toDiscountCodeOperatorView);
}

export async function upsertDiscountCodeAsOperator(
  operatorUserId: string,
  discountCodeId: string,
  input: UpsertDiscountCodeInput,
): Promise<DiscountCodeOperatorMutationResult> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can manage discount codes");
  }

  await ensureDefaultProducts();

  return db.transaction((tx) =>
    upsertDiscountCodeDefinitionInTx({
      tx,
      discountCodeId,
      input,
    }),
  );
}

export async function applyDiscountCodeBatchAsOperator(
  operatorUserId: string,
  input: ApplyDiscountCodeBatchInput,
): Promise<DiscountCodeBatchMutationResult> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can manage discount codes");
  }

  await ensureDefaultDiscountCodes();

  const discountCodeIds: string[] = Array.from(
    new Set<string>(
      input.discountCodeIds
        .map((discountCodeId) => discountCodeId.trim())
        .filter((discountCodeId) => discountCodeId.length > 0),
    ),
  );

  if (discountCodeIds.length === 0) {
    throw new BadRequestError("请选择至少一个优惠码。");
  }

  if (input.action === "extendExpiry" && (!input.extendDays || input.extendDays <= 0)) {
    throw new BadRequestError("批量延期需要提供有效的天数。");
  }
  if (input.action === "setQuota" && input.totalMaxUses === undefined && input.perUserLimit === undefined) {
    throw new BadRequestError("批量配额调整至少需要提供一个配额字段。");
  }

  const requestedCount = discountCodeIds.length;

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(discountCodes)
      .where(inArray(discountCodes.id, discountCodeIds))
      .orderBy(desc(discountCodes.updatedAt), desc(discountCodes.createdAt));

    if (rows.length === 0) {
      throw new NotFoundError("未找到可操作的优惠码。");
    }

    const rowById = new Map(rows.map((row) => [row.id, row]));
    const referenceTime = now();
    const updatedViews: DiscountCodeOperatorView[] = [];
    let affectedCount = 0;

    for (const discountCodeId of discountCodeIds) {
      const row = rowById.get(discountCodeId);
      if (!row) {
        continue;
      }

      let nextEnabled = row.enabled;
      let nextExpiresAt = row.expiresAt;
      let nextTotalMaxUses = row.totalMaxUses;
      let nextPerUserLimit = row.perUserLimit;
      let shouldUpdate = false;

      if (input.action === "enable") {
        shouldUpdate = !row.enabled;
        nextEnabled = true;
      } else if (input.action === "disable") {
        shouldUpdate = row.enabled;
        nextEnabled = false;
      } else if (input.action === "disableExpired") {
        const isExpired = row.expiresAt !== null && row.expiresAt.getTime() < referenceTime.getTime();
        shouldUpdate = isExpired && row.enabled;
        nextEnabled = false;
      } else if (input.action === "extendExpiry") {
        const extendDays = input.extendDays ?? 0;
        const extensionBase = new Date(
          Math.max(
            referenceTime.getTime(),
            row.startsAt?.getTime() ?? 0,
            row.expiresAt?.getTime() ?? 0,
          ),
        );
        nextExpiresAt = new Date(extensionBase.getTime() + extendDays * 24 * 60 * 60 * 1000);
        shouldUpdate = !areTimestampsEqual(row.expiresAt, nextExpiresAt);
      } else if (input.action === "setQuota") {
        if (input.totalMaxUses !== undefined) {
          nextTotalMaxUses = input.totalMaxUses;
          shouldUpdate = shouldUpdate || row.totalMaxUses !== input.totalMaxUses;
        }
        if (input.perUserLimit !== undefined) {
          nextPerUserLimit = input.perUserLimit;
          shouldUpdate = shouldUpdate || row.perUserLimit !== input.perUserLimit;
        }
      }

      if (!shouldUpdate) {
        continue;
      }

      const [updated] = await tx
        .update(discountCodes)
        .set({
          enabled: nextEnabled,
          expiresAt: nextExpiresAt,
          totalMaxUses: nextTotalMaxUses,
          perUserLimit: nextPerUserLimit,
          updatedAt: referenceTime,
        })
        .where(eq(discountCodes.id, row.id))
        .returning();

      updatedViews.push(toDiscountCodeOperatorView(updated));
      affectedCount += 1;
    }

    return {
      action: input.action,
      requestedCount,
      affectedCount,
      skippedCount: requestedCount - affectedCount,
      discountCodes: updatedViews,
    };
  });
}

async function assertProductPurchaseEligibility(
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

export async function getDiscountCodeDetail(code: string): Promise<DiscountCodeView | null> {
  await ensureDefaultDiscountCodes();
  const normalizedCode = code.trim().toUpperCase();
  const discountCode = await db.query.discountCodes.findFirst({
    where: (row, operators) => operators.eq(row.code, normalizedCode),
  });
  return discountCode ? toDiscountCodeView(discountCode) : null;
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

export async function reportItemUnitIssue(
  userId: string,
  itemId: string,
  unitId: string,
  reason: ItemUnitIssueReason,
): Promise<ItemView> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from items where id = ${itemId} for update`);
    await tx.execute(sql`select id from item_units where id = ${unitId} for update`);

    const [item] = await tx.select().from(items).where(eq(items.id, itemId));
    if (!item || item.userId !== userId) {
      throw new NotFoundError("资产不存在或不属于当前用户");
    }
    if (item.status !== "active") {
      throw new ConflictError("当前资产不处于可履约处理状态");
    }
    if (!isIssueReportingEnabled(item.fulfillmentMode)) {
      throw new BadRequestError("当前资产不支持问题上报");
    }

    const [unit] = await tx
      .select()
      .from(itemUnits)
      .where(and(eq(itemUnits.id, unitId), eq(itemUnits.itemId, itemId)));
    if (!unit) {
      throw new NotFoundError("单元不存在");
    }
    if (unit.status !== "active") {
      throw new ConflictError("该单元当前不可重复上报");
    }

    const timestamp = now();
    const manualReviewDecision = getManualReviewRoutingDecision(item, reason);
    const manualReviewRequired = manualReviewDecision !== null;
    const replacementTriggered =
      manualReviewRequired
        ? false
        : item.fulfillmentMode === "maintained_pool"
        ? true
        : item.fulfillmentMode === "warranty_delivery"
          ? shouldReplaceWarrantyUnit(item, reason, timestamp)
          : false;
    const rejectionCode =
      manualReviewRequired
        ? ("manual_review_required" as ItemIssueRejectionCode)
        : item.fulfillmentMode === "warranty_delivery" && !replacementTriggered
        ? getWarrantyRejectionCode(item, reason, timestamp)
        : null;

    const fallbackStatus = getNonReplacementUnitStatus(reason);
    let nextActiveUnits = item.activeUnits;
    let nextReplacementCount = item.replacementCount;
    let replacementUnit: typeof itemUnits.$inferSelect | null = null;

    if (replacementTriggered) {
      const [createdReplacement] = await tx
        .insert(itemUnits)
        .values({
          id: crypto.randomUUID(),
          itemId: item.id,
          slotNumber: unit.slotNumber,
          generation: unit.generation + 1,
          code: buildUnitCode(unit.slotNumber, unit.generation + 1),
          status: "active",
          issueReason: null,
          activatedAt: timestamp,
          expiresAt: unit.expiresAt,
          replacedByUnitId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning();
      replacementUnit = createdReplacement;
      nextReplacementCount += 1;

      await tx
        .update(itemUnits)
        .set({
          status: "replaced",
          issueReason: reason,
          replacedByUnitId: replacementUnit.id,
          updatedAt: timestamp,
        })
        .where(eq(itemUnits.id, unit.id));

      await tx.insert(itemReplacementLogs).values({
        id: crypto.randomUUID(),
        itemId: item.id,
        previousUnitId: unit.id,
        replacementUnitId: replacementUnit.id,
        reason,
        trigger: "issue_report",
        createdAt: timestamp,
      });
    } else {
      nextActiveUnits = item.activeUnits !== null ? Math.max(0, item.activeUnits - 1) : item.activeUnits;

      await tx
        .update(itemUnits)
        .set({
          status: fallbackStatus,
          issueReason: reason,
          updatedAt: timestamp,
        })
        .where(eq(itemUnits.id, unit.id));
    }

    const [createdIssueReport] = await tx.insert(itemIssueReports).values({
      id: crypto.randomUUID(),
      itemId: item.id,
      unitId: unit.id,
      reporterUserId: userId,
      reason,
      outcome: manualReviewRequired ? "manual_review" : replacementTriggered ? "replaced" : "rejected",
      rejectionCode,
      replacementUnitId: replacementUnit?.id ?? null,
      createdAt: timestamp,
    }).returning();

    if (manualReviewRequired) {
      const [createdReview] = await tx.insert(itemManualReviews).values({
        id: crypto.randomUUID(),
        itemId: item.id,
        unitId: unit.id,
        reportId: createdIssueReport.id,
        slotNumber: unit.slotNumber,
        status: "open",
        reason,
        routingCode: manualReviewDecision!.routingCode,
        routingSummary: manualReviewDecision!.routingSummary,
        suggestedAction: manualReviewDecision!.suggestedAction,
        resolutionAction: null,
        resolutionNote: null,
        reviewerUserId: null,
        createdAt: timestamp,
        resolvedAt: null,
      }).returning();
      const reviewAgeHours = getManualReviewAgeHours(createdReview.createdAt, timestamp);
      const reviewPriority = getManualReviewPriority({
        routingCode: createdReview.routingCode as ItemManualReviewRoutingCode,
        ageHours: reviewAgeHours,
      });
      const reviewSlaPolicy = getManualReviewSlaPolicy({
        routingCode: createdReview.routingCode as ItemManualReviewRoutingCode,
        priority: reviewPriority,
      });
      const routedAnomalyRuleState = getManualReviewSlaAnomalyRuleState({
        ageHours: reviewAgeHours,
        anomalyKind: "manual_review_routed",
        routingCode: createdReview.routingCode as ItemManualReviewRoutingCode,
        priority: reviewPriority,
        slaPolicy: reviewSlaPolicy,
        referenceTime: timestamp,
      });

      await upsertFulfillmentAnomalyInTx({
        tx,
        itemId: item.id,
        reportId: createdIssueReport.id,
        reviewId: createdReview.id,
        kind: "manual_review_routed",
        routingCode: createdReview.routingCode as ItemManualReviewRoutingCode,
        policyKeyOverride: routedAnomalyRuleState.anomalyPolicyKey,
        severityOverride: routedAnomalyRuleState.severity,
        escalationStrategyOverride: routedAnomalyRuleState.anomalyEscalationStrategy,
        alertLevelOverride: routedAnomalyRuleState.alertLevel,
        nextAlertEligibleAtOverride: routedAnomalyRuleState.nextAlertEligibleAt,
        nextEscalationAtOverride: routedAnomalyRuleState.nextEscalationAt,
        autoActionOverride: routedAnomalyRuleState.anomalyAutoAction,
        autoActionTemplateKeyOverride: routedAnomalyRuleState.autoActionTemplateKey,
        summary: `Manual review routed via ${createdReview.routingCode}.`,
        detail: `${createdReview.routingSummary}${routedAnomalyRuleState.matchedStageKey ? ` Applied SLA anomaly stage ${routedAnomalyRuleState.matchedStageKey}.` : ""}`,
      });
    }

    const nextItemStatus = !replacementTriggered && nextActiveUnits !== null && nextActiveUnits <= 0 ? "consumed" : item.status;

    await tx
      .update(items)
      .set({
        activeUnits: nextActiveUnits,
        replacementCount: nextReplacementCount,
        status: nextItemStatus,
        lastReconciledAt: timestamp,
      })
      .where(eq(items.id, item.id));

    await enqueueOutboxEvent(
      "item.issueReported",
      {
        userId,
        itemId: item.id,
        unitId: unit.id,
        reason,
        routingCode: manualReviewDecision?.routingCode ?? null,
        suggestedAction: manualReviewDecision?.suggestedAction ?? null,
        replacementTriggered,
        manualReviewRequired,
        rejectionCode,
      },
      tx,
    );

    if (replacementUnit) {
      await enqueueOutboxEvent(
        "item.replaced",
        {
          userId,
          itemId: item.id,
          oldUnitId: unit.id,
          newUnitId: replacementUnit.id,
          reason,
        },
        tx,
      );
    }

    if (manualReviewRequired) {
      await enqueueOutboxEvent(
        "item.manualReviewRequested",
        {
          userId,
          itemId: item.id,
          unitId: unit.id,
          reason,
          routingCode: manualReviewDecision?.routingCode ?? null,
          routingSummary: manualReviewDecision?.routingSummary ?? null,
          suggestedAction: manualReviewDecision?.suggestedAction ?? null,
        },
        tx,
      );
    }

    return loadItemViewInTx(tx, item.id);
  });
}

type ReconcileItemOptions = {
  expectedUserId?: string;
  trigger: ItemFulfillmentRunTrigger;
};

async function reconcileItemFulfillmentInTx(
  tx: DbTx,
  itemId: string,
  options: ReconcileItemOptions,
): Promise<{ item: ItemView; replacementsCreated: number; userId: string }> {
  await tx.execute(sql`select id from items where id = ${itemId} for update`);

  const [item] = await tx.select().from(items).where(eq(items.id, itemId));
  if (!item || (options.expectedUserId && item.userId !== options.expectedUserId)) {
    throw new NotFoundError("资产不存在或不属于当前用户");
  }
  if (!isIssueReportingEnabled(item.fulfillmentMode)) {
    throw new BadRequestError("当前资产不支持履约对账");
  }

  const timestamp = now();
  const unitsForItem = await tx
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.itemId, item.id))
    .orderBy(itemUnits.slotNumber, itemUnits.generation, itemUnits.createdAt);
  const openManualReviews = await tx
    .select()
    .from(itemManualReviews)
    .where(and(eq(itemManualReviews.itemId, item.id), eq(itemManualReviews.status, "open")));

  let replacementsCreated = 0;
  let nextReplacementCount = item.replacementCount;
  let nextActiveUnits = unitsForItem.filter((unit) => unit.status === "active").length;

  if (item.fulfillmentMode === "maintained_pool" && item.totalUnits) {
    const blockedSlots = new Set(openManualReviews.map((review) => review.slotNumber));
    const activeSlotSet = new Set(unitsForItem.filter((unit) => unit.status === "active").map((unit) => unit.slotNumber));
    const unitsBySlot = new Map<number, typeof itemUnits.$inferSelect[]>();

    for (const unit of unitsForItem) {
      const existing = unitsBySlot.get(unit.slotNumber) ?? [];
      existing.push(unit);
      unitsBySlot.set(unit.slotNumber, existing);
    }

    for (let slotNumber = 1; slotNumber <= item.totalUnits; slotNumber += 1) {
      if (activeSlotSet.has(slotNumber)) {
        continue;
      }
      if (blockedSlots.has(slotNumber)) {
        continue;
      }

      const slotUnits = unitsBySlot.get(slotNumber) ?? [];
      const previousUnit = slotUnits.length > 0 ? slotUnits[slotUnits.length - 1] : null;
      const nextGeneration = previousUnit ? previousUnit.generation + 1 : 1;

      const [replacementUnit] = await tx
        .insert(itemUnits)
        .values({
          id: crypto.randomUUID(),
          itemId: item.id,
          slotNumber,
          generation: nextGeneration,
          code: buildUnitCode(slotNumber, nextGeneration),
          status: "active",
          issueReason: null,
          activatedAt: timestamp,
          expiresAt: item.warrantyExpiresAt,
          replacedByUnitId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning();

      await tx.insert(itemReplacementLogs).values({
        id: crypto.randomUUID(),
        itemId: item.id,
        previousUnitId: previousUnit?.id ?? null,
        replacementUnitId: replacementUnit.id,
        reason: null,
        trigger: options.trigger === "manual" ? "manual_reconcile" : "scheduled_reconcile",
        createdAt: timestamp,
      });

      await enqueueOutboxEvent(
        "item.replaced",
        {
          userId: item.userId,
          itemId: item.id,
          oldUnitId: previousUnit?.id ?? null,
          newUnitId: replacementUnit.id,
          reason: null,
        },
        tx,
      );

      replacementsCreated += 1;
      nextReplacementCount += 1;
    }

    nextActiveUnits = activeSlotSet.size + replacementsCreated;
  }

  if (item.fulfillmentMode === "warranty_delivery") {
    nextActiveUnits = unitsForItem.filter((unit) => unit.status === "active").length;
  }

  const nextStatus = nextActiveUnits <= 0 ? "consumed" : "active";
  const runStatus: ItemFulfillmentRunStatus = replacementsCreated > 0 ? "completed" : "noop";
  const runNote =
    item.fulfillmentMode === "maintained_pool"
      ? replacementsCreated > 0
        ? "Active slot gaps were replenished."
        : "No slot gap detected."
      : nextStatus === "consumed"
        ? "No active warranty units remain."
        : "Warranty delivery state recomputed.";

  await tx
    .update(items)
    .set({
      activeUnits: nextActiveUnits,
      replacementCount: nextReplacementCount,
      status: nextStatus,
      lastReconciledAt: timestamp,
    })
    .where(eq(items.id, item.id));

  await tx.insert(itemFulfillmentRuns).values({
    id: crypto.randomUUID(),
    itemId: item.id,
    trigger: options.trigger,
    status: runStatus,
    scannedUnits: unitsForItem.length,
    replacementsCreated,
    note: runNote,
    createdAt: timestamp,
  });

  await enqueueOutboxEvent(
    "item.reconciled",
    {
      userId: item.userId,
      itemId: item.id,
      replacementsCreated,
      trigger: options.trigger,
    },
    tx,
  );

  await resolveFulfillmentAnomaliesInTx({
    tx,
    itemId: item.id,
    kind: "reconcile_failure",
    resolutionNote: "Reconcile completed successfully after anomaly detection.",
  });

  return {
    item: await loadItemViewInTx(tx, item.id),
    replacementsCreated,
    userId: item.userId,
  };
}

export async function reconcileItemFulfillment(userId: string, itemId: string): Promise<ItemView> {
  const result = await db.transaction((tx) =>
    reconcileItemFulfillmentInTx(tx, itemId, {
      expectedUserId: userId,
      trigger: "manual",
    }),
  );

  return result.item;
}

export async function reconcileDueItems(limit = 20) {
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const dueRows = await db.execute(sql`
    select id
    from items
    where status = 'active'
      and (
        (
          fulfillment_mode = 'maintained_pool'
          and (last_reconciled_at is null or last_reconciled_at <= now() - interval '6 hours')
        )
        or (
          fulfillment_mode = 'warranty_delivery'
          and (last_reconciled_at is null or last_reconciled_at <= now() - interval '24 hours')
        )
      )
    order by coalesce(last_reconciled_at, created_at) asc
    limit ${boundedLimit}
  `);

  const results: Array<{ itemId: string; userId: string; replacementsCreated: number }> = [];
  const failures: Array<{ itemId: string; message: string }> = [];

  for (const row of dueRows.rows as Array<{ id: string }>) {
    try {
      const reconciled = await db.transaction((tx) =>
        reconcileItemFulfillmentInTx(tx, row.id, {
          trigger: "scheduled",
        }),
      );

      results.push({
        itemId: reconciled.item.id,
        userId: reconciled.userId,
        replacementsCreated: reconciled.replacementsCreated,
      });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unknown reconcile failure";
      await db.transaction(async (tx) => {
        await upsertFulfillmentAnomalyInTx({
          tx,
          itemId: row.id,
          kind: "reconcile_failure",
          summary: "Scheduled reconcile failed and requires operator follow-up.",
          detail: message,
        });
      });
      failures.push({
        itemId: row.id,
        message,
      });
    }
  }

  return {
    processedCount: results.length,
    failedCount: failures.length,
    results,
    failures,
  };
}

export async function listOpenItemManualReviews(
  operatorUserId: string,
  filters?: {
    status?: "open" | "approved" | "rejected" | "all";
    reason?: ItemUnitIssueReason;
    routingCode?: string;
    suggestedAction?: string;
    rejectionCategory?: ItemManualReviewView["rejectionCategory"];
    appealable?: "true" | "false";
    priority?: ItemManualReviewPriority;
    slaBucket?: ItemManualReviewSlaBucket;
    limit?: number;
    assignee?: string;
    claimedAt?: string;
  },
): Promise<ItemManualReviewView[]> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual reviews");
  }

  const clauses: SQL[] = [];
  if (filters?.status && filters.status !== "all") {
    clauses.push(eq(itemManualReviews.status, filters.status));
  } else if (!filters?.status) {
    clauses.push(eq(itemManualReviews.status, "open"));
  }
  if (filters?.reason) {
    clauses.push(eq(itemManualReviews.reason, filters.reason));
  }
  if (filters?.routingCode) {
    clauses.push(eq(itemManualReviews.routingCode, filters.routingCode));
  }
  if (filters?.suggestedAction) {
    clauses.push(eq(itemManualReviews.suggestedAction, filters.suggestedAction));
  }
  if (filters?.assignee === "me") {
    clauses.push(eq(itemManualReviews.assigneeUserId, operatorUserId));
  } else if (filters?.assignee === "unassigned") {
    clauses.push(sql`${itemManualReviews.assigneeUserId} is null`);
  } else if (filters?.assignee && filters.assignee !== "any") {
    clauses.push(eq(itemManualReviews.assigneeUserId, filters.assignee));
  }
  if (filters?.claimedAt === "claimed") {
    clauses.push(sql`${itemManualReviews.claimedAt} is not null`);
  } else if (filters?.claimedAt === "unclaimed") {
    clauses.push(sql`${itemManualReviews.claimedAt} is null`);
  }
  const requestedLimit = Math.max(1, Math.min(filters?.limit ?? 100, 200));
  const prioritizeOldest = Boolean(filters?.priority);
  const rows = await db
    .select()
    .from(itemManualReviews)
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(prioritizeOldest ? sql`${itemManualReviews.createdAt} asc` : sql`${itemManualReviews.createdAt} desc`)
    .limit(prioritizeOldest ? Math.min(Math.max(requestedLimit * 4, 250), 600) : requestedLimit);

  const reportIds = Array.from(new Set(rows.map((row) => row.reportId)));
  const reports =
    reportIds.length > 0
      ? await db.select().from(itemIssueReports).where(inArray(itemIssueReports.id, reportIds))
      : [];
  const reportsById = new Map(reports.map((report) => [report.id, report]));
  const assignmentHistoryMap = await buildManualReviewAssignmentHistoryMap(rows.map((row) => row.id));
  const referenceTime = now();

  const views = rows.map((row) =>
    toItemManualReviewView(
      row,
      reportsById.get(row.reportId),
      referenceTime,
      operatorUserId,
      assignmentHistoryMap.get(row.id) ?? [],
    ),
  );
  const filtered = views.filter((view) => {
    if (filters?.priority && view.priority !== filters.priority) return false;
    if (filters?.slaBucket && view.slaBucket !== filters.slaBucket) return false;
    if (filters?.rejectionCategory && view.rejectionCategory !== filters.rejectionCategory) return false;
    if (filters?.appealable === "true" && !view.appealable) return false;
    if (filters?.appealable === "false" && view.appealable) return false;
    return true;
  });
  return filtered.slice(0, requestedLimit);
}

export async function getOpenItemManualReviewSummary(operatorUserId: string) {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual review summary");
  }

  const rows = await db
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.status, "open"))
    .orderBy(itemManualReviews.createdAt);

  const byReason = new Map<string, number>();
  const byRoutingCode = new Map<string, number>();
  const bySuggestedAction = new Map<string, number>();
  const byPriority = new Map<string, number>();
  const byAgeBucket = new Map<string, number>();
  const byClaimState = new Map<string, number>();
  const byClaimAgeBucket = new Map<string, number>();
  const byAssignee = new Map<string, number>();
  const referenceTime = now();
  let claimedCount = 0;
  let staleClaimedCount = 0;

  const [autoReleasedRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(itemManualReviews)
    .where(
      and(
        eq(itemManualReviews.lastClaimReleaseReason, "stale_timeout_release"),
        sql`${itemManualReviews.lastClaimReleasedAt} >= now() - interval '24 hours'`,
      ),
    );

  for (const row of rows) {
    const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
    const claimAgeHours = getManualReviewClaimAgeHours(row.claimedAt, referenceTime);
    const priority = getManualReviewPriority({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      ageHours,
    });
    byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
    byRoutingCode.set(row.routingCode, (byRoutingCode.get(row.routingCode) ?? 0) + 1);
    bySuggestedAction.set(row.suggestedAction, (bySuggestedAction.get(row.suggestedAction) ?? 0) + 1);
    byPriority.set(priority, (byPriority.get(priority) ?? 0) + 1);
    const ageBucket = getManualReviewAgeBucket(ageHours);
    byAgeBucket.set(ageBucket, (byAgeBucket.get(ageBucket) ?? 0) + 1);
    const claimState = row.assigneeUserId ? "claimed" : "unclaimed";
    byClaimState.set(claimState, (byClaimState.get(claimState) ?? 0) + 1);
    byAssignee.set(row.assigneeUserId ?? "unassigned", (byAssignee.get(row.assigneeUserId ?? "unassigned") ?? 0) + 1);
    const claimAgeBucket = getManualReviewClaimAgeBucket(claimAgeHours);
    byClaimAgeBucket.set(claimAgeBucket, (byClaimAgeBucket.get(claimAgeBucket) ?? 0) + 1);
    if (row.assigneeUserId) {
      claimedCount += 1;
      if (isManualReviewClaimStale(row.claimedAt, referenceTime)) {
        staleClaimedCount += 1;
      }
    }
  }

  return {
    openCount: rows.length,
    oldestOpenAt: rows[0]?.createdAt ? rows[0].createdAt.toISOString() : null,
    oldestOpenAgeHours: rows[0]?.createdAt ? getManualReviewAgeHours(rows[0].createdAt, referenceTime) : null,
    claimedCount,
    unclaimedCount: Math.max(0, rows.length - claimedCount),
    staleClaimedCount,
    autoReleasedLast24h: Number(autoReleasedRow?.count ?? 0),
    byReason: sortSummaryBuckets(byReason),
    byRoutingCode: sortSummaryBuckets(byRoutingCode),
    bySuggestedAction: sortSummaryBuckets(bySuggestedAction),
    byPriority: sortSummaryBuckets(byPriority),
    byAgeBucket: sortSummaryBuckets(byAgeBucket),
    byClaimState: sortSummaryBuckets(byClaimState),
    byClaimAgeBucket: sortSummaryBuckets(byClaimAgeBucket),
    byAssignee: sortSummaryBuckets(byAssignee),
  };
}

export async function getManualReviewSlaSummary(
  operatorUserId: string,
  filters?: { assignee?: string | null; priority?: ItemManualReviewPriority | null },
): Promise<ManualReviewSlaSummaryView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual review SLA summary");
  }

  const rows = await db
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.status, "open"))
    .orderBy(itemManualReviews.createdAt);

  const referenceTime = now();
  const bySlaBucket = new Map<string, number>();
  const byPriority = new Map<string, number>();
  const policyBuckets = new Map<string, ManualReviewSlaPolicyTemplateView>();
  const byAssignee = new Map<string, { openCount: number; breachedCount: number; dueSoonCount: number; totalAgeHours: number }>();
  let openCount = 0;
  let oldestBreachedAgeHours: number | null = null;
  let escalatedCount = 0;
  let autoAssignedLast24h = 0;

  for (const row of rows) {
    if (filters?.assignee && (row.assigneeUserId ?? "unassigned") !== filters.assignee) {
      continue;
    }

    const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
    const priority = getManualReviewPriority({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      ageHours,
    });
    if (filters?.priority && priority !== filters.priority) {
      continue;
    }

    const slaBucket = getManualReviewSlaBucket({
      ageHours,
      priority,
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
    });
    const policy = getManualReviewSlaPolicy({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      priority,
    });
    const escalationLevel = Math.max(
      row.escalationLevel ?? 0,
      getManualReviewEscalationLevel({
        ageHours,
        slaBucket,
        priority,
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
      }),
    );
    openCount += 1;
    bySlaBucket.set(slaBucket, (bySlaBucket.get(slaBucket) ?? 0) + 1);
    byPriority.set(priority, (byPriority.get(priority) ?? 0) + 1);
    const policyBucket = policyBuckets.get(policy.key) ?? {
      key: policy.key,
      scope: policy.scope,
      slaHours: policy.slaHours,
      dueSoonLeadHours: policy.dueSoonLeadHours,
      criticalAfterHours: policy.criticalAfterHours,
      urgentAfterHours: policy.urgentAfterHours,
      assignAfterHours: policy.assignAfterHours,
      rebalanceAfterHours: policy.rebalanceAfterHours,
      autoAssignTemplateKey: policy.autoAssignTemplateKey,
      autoAssignEnabled: policy.autoAssignEnabled,
      maxAutoAssignmentsPerRun: policy.maxAutoAssignmentsPerRun,
      anomalyPolicyKey: policy.anomalyPolicyKey,
      anomalySeverity: policy.anomalySeverity,
      anomalyEscalationStrategy: policy.anomalyEscalationStrategy,
      anomalyAutoAction: policy.anomalyAutoAction,
      anomalyCooldownMinutes: policy.anomalyCooldownMinutes,
      anomalyStages: policy.anomalyStages,
      matchingReviewCount: 0,
      dueSoonCount: 0,
      breachedCount: 0,
      unclaimedCount: 0,
      escalatedCount: 0,
    };
    policyBucket.matchingReviewCount += 1;
    if (slaBucket === "due_soon") {
      policyBucket.dueSoonCount += 1;
    } else if (slaBucket === "breached") {
      policyBucket.breachedCount += 1;
    }
    if (!row.assigneeUserId) {
      policyBucket.unclaimedCount += 1;
    }
    if (escalationLevel > 0) {
      policyBucket.escalatedCount += 1;
    }
    policyBuckets.set(policy.key, policyBucket);

    if (slaBucket === "breached") {
      oldestBreachedAgeHours = oldestBreachedAgeHours === null ? ageHours : Math.max(oldestBreachedAgeHours, ageHours);
    }
    if (escalationLevel > 0) {
      escalatedCount += 1;
    }
    if (
      row.lastAutoAssignedAt &&
      row.lastAutoAssignedAt.getTime() >= referenceTime.getTime() - 24 * 60 * 60 * 1000
    ) {
      autoAssignedLast24h += 1;
    }

    const assigneeKey = row.assigneeUserId ?? "unassigned";
    const bucket = byAssignee.get(assigneeKey) ?? {
      openCount: 0,
      breachedCount: 0,
      dueSoonCount: 0,
      totalAgeHours: 0,
    };
    bucket.openCount += 1;
    bucket.totalAgeHours += ageHours;
    if (slaBucket === "breached") {
      bucket.breachedCount += 1;
    } else if (slaBucket === "due_soon") {
      bucket.dueSoonCount += 1;
    }
    byAssignee.set(assigneeKey, bucket);
  }

  const onTrackCount = bySlaBucket.get("on_track") ?? 0;
  const dueSoonCount = bySlaBucket.get("due_soon") ?? 0;
  const breachedCount = bySlaBucket.get("breached") ?? 0;

  return {
    openCount,
    onTrackCount,
    dueSoonCount,
    breachedCount,
    escalatedCount,
    autoAssignedLast24h,
    oldestBreachedAgeHours,
    bySlaBucket: sortSummaryBuckets(bySlaBucket),
    byPriority: sortSummaryBuckets(byPriority),
    byPolicy: Array.from(policyBuckets.values())
      .sort((left, right) => right.matchingReviewCount - left.matchingReviewCount || left.key.localeCompare(right.key))
      .map((bucket) => ({ key: bucket.key, count: bucket.matchingReviewCount })),
    byAssignee: Array.from(byAssignee.entries())
      .map(([key, value]) => ({
        key,
        openCount: value.openCount,
        breachedCount: value.breachedCount,
        dueSoonCount: value.dueSoonCount,
        avgAgeHours: value.openCount > 0 ? Number((value.totalAgeHours / value.openCount).toFixed(1)) : null,
      }))
      .sort((left, right) => {
        if (right.breachedCount !== left.breachedCount) return right.breachedCount - left.breachedCount;
        if (right.dueSoonCount !== left.dueSoonCount) return right.dueSoonCount - left.dueSoonCount;
        if (right.openCount !== left.openCount) return right.openCount - left.openCount;
        return left.key.localeCompare(right.key);
      }),
  };
}

function toManualReviewWorkloadSnapshotView(
  row: typeof itemManualReviewWorkloadSnapshots.$inferSelect,
): ManualReviewWorkloadSnapshotView {
  return {
    id: row.id,
    source: row.source as "manual" | "auto",
    openCount: row.openCount,
    unclaimedCount: row.unclaimedCount,
    breachedUnclaimedCount: row.breachedUnclaimedCount,
    slaBreachedCount: row.slaBreachedCount,
    atCapacityCount: row.atCapacityCount,
    recommendedAssigneeUserId: row.recommendedAssigneeUserId,
    claimNextEta: row.claimNextEta,
    createdAt: row.createdAt.toISOString(),
  };
}

async function recordManualReviewWorkloadSnapshot(source: "manual" | "auto", workload: ManualReviewWorkloadView) {
  const openCount = workload.byAssignee.reduce((sum, bucket) => sum + bucket.claimedCount, 0) + workload.unclaimedCount;
  await db.insert(itemManualReviewWorkloadSnapshots).values({
    id: crypto.randomUUID(),
    source,
    openCount,
    unclaimedCount: workload.unclaimedCount,
    breachedUnclaimedCount: workload.breachedUnclaimedCount,
    slaBreachedCount: workload.slaBreachedCount,
    atCapacityCount: workload.atCapacityCount,
    recommendedAssigneeUserId: workload.recommendedAssigneeUserId,
    claimNextEta: workload.claimNextEta,
    createdAt: now(),
  });
}

async function upsertFulfillmentAnomalyInTx(args: {
  tx: DbTx;
  itemId: string;
  reportId?: string | null;
  reviewId?: string | null;
  kind: ItemFulfillmentAnomalyKind;
  routingCode?: ItemManualReviewRoutingCode | null;
  policyKeyOverride?: string | null;
  severityOverride?: ItemFulfillmentAnomalySeverity | null;
  escalationStrategyOverride?: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
  alertLevelOverride?: number | null;
  nextAlertEligibleAtOverride?: Date | null;
  nextEscalationAtOverride?: Date | null;
  autoActionOverride?: "none" | "assign_template" | "rebalance_queue" | null;
  autoActionTemplateKeyOverride?: string | null;
  summary: string;
  detail?: string | null;
}) {
  const [existing] = await args.tx
    .select()
    .from(itemFulfillmentAnomalies)
    .where(
      and(
        eq(itemFulfillmentAnomalies.itemId, args.itemId),
        eq(itemFulfillmentAnomalies.kind, args.kind),
        eq(itemFulfillmentAnomalies.status, "open"),
        args.reviewId
          ? eq(itemFulfillmentAnomalies.reviewId, args.reviewId)
          : sql`${itemFulfillmentAnomalies.reviewId} is null`,
        args.reportId
          ? eq(itemFulfillmentAnomalies.reportId, args.reportId)
          : sql`${itemFulfillmentAnomalies.reportId} is null`,
      ),
    )
    .limit(1);

  const timestamp = now();
  const baseSeverity = getFulfillmentAnomalySeverity(args.kind, args.routingCode ?? null);
  const ruleState = getFulfillmentAnomalyRuleState({
    kind: args.kind,
    severity: args.severityOverride ?? baseSeverity,
    routingCode: args.routingCode ?? null,
    detectedAt: existing?.detectedAt ?? timestamp,
    referenceTime: timestamp,
    preferredPolicyKey: args.policyKeyOverride,
  });
  const severity = args.severityOverride ?? ruleState.severity ?? baseSeverity;
  const policy =
    args.policyKeyOverride && env.fulfillmentAnomalyPolicyTemplates[args.policyKeyOverride]
      ? {
          key: args.policyKeyOverride,
          scope: args.policyKeyOverride.startsWith("routing:")
            ? ("routing" as const)
            : args.policyKeyOverride.startsWith("kind:")
              ? ("kind" as const)
              : args.policyKeyOverride.startsWith("severity:")
                ? ("severity" as const)
                : ("default" as const),
          ...env.fulfillmentAnomalyPolicyTemplates[args.policyKeyOverride],
        }
      : ruleState.policy;
  const effectiveEscalationStrategy =
    args.escalationStrategyOverride !== undefined && args.escalationStrategyOverride !== null
      ? args.escalationStrategyOverride
      : ruleState.escalationStrategy ?? policy.escalationStrategy;
  const alertLevel = getFulfillmentAnomalyAlertLevel({
    kind: args.kind,
    severity,
    routingCode: args.routingCode ?? null,
    detectedAt: timestamp,
    referenceTime: timestamp,
  });
  const targetAlertLevel = Math.max(0, args.alertLevelOverride ?? ruleState.alertLevel ?? alertLevel);
  const targetAutoAction =
    args.autoActionOverride !== undefined && args.autoActionOverride !== null
      ? args.autoActionOverride
      : ruleState.autoAction ?? policy.autoAction;
  const targetAutoActionTemplateKey =
    args.autoActionTemplateKeyOverride !== undefined
      ? args.autoActionTemplateKeyOverride
      : ruleState.autoActionTemplateKey ?? policy.autoActionTemplateKey;
  const nextEscalationAt = getNextFulfillmentAnomalyEscalationAt({
    detectedAt: timestamp,
    currentAlertLevel: targetAlertLevel,
    policy,
  });
  const targetNextEscalationAt = args.nextEscalationAtOverride ?? nextEscalationAt;
  const nextAlertEligibleAt =
    ruleState.nextAlertEligibleAt ?? getNextFulfillmentAnomalyAlertEligibleAt(timestamp, policy);
  const targetNextAlertEligibleAt = args.nextAlertEligibleAtOverride ?? nextAlertEligibleAt;
  if (existing) {
    const nextAlertLevel = Math.max(existing.alertLevel ?? 0, targetAlertLevel);
    const [updated] = await args.tx
      .update(itemFulfillmentAnomalies)
      .set({
        severity,
        routingCode: args.routingCode ?? existing.routingCode,
        policyKey: policy.key,
        escalationStrategy: effectiveEscalationStrategy,
        autoAction: targetAutoAction,
        autoActionTemplateKey: targetAutoActionTemplateKey,
        summary: args.summary,
        detail: args.detail ?? existing.detail,
        lastSeenAt: timestamp,
        occurrenceCount: (existing.occurrenceCount ?? 1) + 1,
        alertLevel: nextAlertLevel,
        alertedAt: nextAlertLevel > 0 ? existing.alertedAt ?? timestamp : existing.alertedAt,
        lastAlertReason:
          nextAlertLevel > 0
            ? buildFulfillmentAnomalyAlertReason({
                kind: args.kind,
                severity,
                alertLevel: nextAlertLevel,
                policyKey: policy.key,
                escalationStrategy: effectiveEscalationStrategy,
              })
            : existing.lastAlertReason,
        nextAlertEligibleAt:
          nextAlertLevel > 0
            ? nextAlertLevel > (existing.alertLevel ?? 0)
              ? targetNextAlertEligibleAt
              : existing.nextAlertEligibleAt ?? targetNextAlertEligibleAt
            : existing.nextAlertEligibleAt,
        nextEscalationAt:
          args.nextEscalationAtOverride ??
          getNextFulfillmentAnomalyEscalationAt({
            detectedAt: existing.detectedAt,
            currentAlertLevel: nextAlertLevel,
            policy,
          }),
        resolutionNote: null,
        resolvedAt: null,
      })
      .where(eq(itemFulfillmentAnomalies.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await args.tx
    .insert(itemFulfillmentAnomalies)
    .values({
      id: crypto.randomUUID(),
      itemId: args.itemId,
      reportId: args.reportId ?? null,
      reviewId: args.reviewId ?? null,
      kind: args.kind,
      severity,
      status: "open",
      routingCode: args.routingCode ?? null,
      policyKey: policy.key,
      escalationStrategy: effectiveEscalationStrategy,
      autoAction: targetAutoAction,
      autoActionTemplateKey: targetAutoActionTemplateKey,
      summary: args.summary,
      detail: args.detail ?? null,
      alertLevel: targetAlertLevel,
      alertedAt: targetAlertLevel > 0 ? timestamp : null,
      lastAlertReason:
        targetAlertLevel > 0
          ? buildFulfillmentAnomalyAlertReason({
              kind: args.kind,
              severity,
              alertLevel: targetAlertLevel,
              policyKey: policy.key,
              escalationStrategy: effectiveEscalationStrategy,
            })
          : null,
      nextAlertEligibleAt: targetAlertLevel > 0 ? targetNextAlertEligibleAt : null,
      nextEscalationAt: targetNextEscalationAt,
      autoActionAttemptCount: 0,
      lastAutoActionStatus: null,
      lastAutoActionError: null,
      detectedAt: timestamp,
      lastSeenAt: timestamp,
      occurrenceCount: 1,
      resolvedAt: null,
      resolutionNote: null,
    })
    .returning();
  return created;
}

async function resolveFulfillmentAnomaliesInTx(args: {
  tx: DbTx;
  itemId: string;
  kind?: ItemFulfillmentAnomalyKind;
  reportId?: string | null;
  reviewId?: string | null;
  resolutionNote: string;
}) {
  const clauses: SQL[] = [
    eq(itemFulfillmentAnomalies.itemId, args.itemId),
    eq(itemFulfillmentAnomalies.status, "open"),
  ];
  if (args.kind) clauses.push(eq(itemFulfillmentAnomalies.kind, args.kind));
  if (args.reportId) clauses.push(eq(itemFulfillmentAnomalies.reportId, args.reportId));
  if (args.reviewId) clauses.push(eq(itemFulfillmentAnomalies.reviewId, args.reviewId));

  await args.tx
    .update(itemFulfillmentAnomalies)
    .set({
      status: "resolved",
      alertLevel: 0,
      nextAlertEligibleAt: null,
      nextEscalationAt: null,
      resolvedAt: now(),
      resolutionNote: args.resolutionNote,
    })
    .where(and(...clauses));
}

async function resolveManualReviewQueueLinkedAnomaliesInTx(args: {
  tx: DbTx;
  itemId: string;
  reportId: string;
  reviewId: string;
  resolutionNote: string;
}) {
  for (const kind of [
    "manual_review_routed",
    "sla_due_soon_unclaimed",
    "sla_breach_unclaimed",
    "stale_manual_review",
  ] as ItemFulfillmentAnomalyKind[]) {
    await resolveFulfillmentAnomaliesInTx({
      tx: args.tx,
      itemId: args.itemId,
      reportId: args.reportId,
      reviewId: args.reviewId,
      kind,
      resolutionNote: args.resolutionNote,
    });
  }
}

export async function getFulfillmentOpsSummary(operatorUserId: string): Promise<FulfillmentOpsSummaryView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view fulfillment ops summary");
  }

  const [manualReviews, rejectedIssueRows, recentRuns, resolvedReviewRows, assignmentRows, anomalyRows] = await Promise.all([
    getOpenItemManualReviewSummary(operatorUserId),
    db
      .select({
        rejectionCode: itemIssueReports.rejectionCode,
        count: count(),
      })
      .from(itemIssueReports)
      .where(and(eq(itemIssueReports.outcome, "rejected"), sql`${itemIssueReports.rejectionCode} is not null`))
      .groupBy(itemIssueReports.rejectionCode),
    db.select().from(itemFulfillmentRuns).orderBy(sql`${itemFulfillmentRuns.createdAt} desc`).limit(200),
    db
      .select({
        resolutionAction: itemManualReviews.resolutionAction,
        resolvedAt: itemManualReviews.resolvedAt,
      })
      .from(itemManualReviews)
      .where(and(sql`${itemManualReviews.resolvedAt} is not null`, sql`${itemManualReviews.status} <> 'open'`)),
    db
      .select({
        action: itemManualReviewAssignmentEvents.action,
        createdAt: itemManualReviewAssignmentEvents.createdAt,
      })
      .from(itemManualReviewAssignmentEvents)
      .orderBy(desc(itemManualReviewAssignmentEvents.createdAt))
      .limit(500),
    db.select().from(itemFulfillmentAnomalies).orderBy(desc(itemFulfillmentAnomalies.lastSeenAt)).limit(100),
  ]);

  const byRejectionCode = new Map<string, number>();
  const byRejectionCategory = new Map<string, number>();
  let appealableCount = 0;
  for (const row of rejectedIssueRows) {
    if (!row.rejectionCode) continue;
    const countValue = Number(row.count ?? 0);
    byRejectionCode.set(row.rejectionCode, countValue);
    const category = getItemIssueRejectionCategory(row.rejectionCode as ItemIssueRejectionCode);
    if (category) {
      byRejectionCategory.set(category, (byRejectionCategory.get(category) ?? 0) + countValue);
    }
    if (isItemIssueAppealable(row.rejectionCode as ItemIssueRejectionCode)) {
      appealableCount += countValue;
    }
  }

  const byRunTrigger = new Map<string, number>();
  const byRunStatus = new Map<string, number>();
  for (const row of recentRuns) {
    byRunTrigger.set(row.trigger, (byRunTrigger.get(row.trigger) ?? 0) + 1);
    byRunStatus.set(row.status, (byRunStatus.get(row.status) ?? 0) + 1);
  }
  const recentRunViews = recentRuns.slice(0, 20).map(toItemFulfillmentRunView);
  const recentRunWindows = buildFulfillmentRecentRunWindows(recentRunViews);

  const resolutionWindowStart = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
  let resolvedLast7Days = 0;
  const byResolutionAction = new Map<string, number>();
  for (const row of resolvedReviewRows) {
    if (row.resolvedAt && row.resolvedAt.getTime() >= resolutionWindowStart.getTime()) {
      resolvedLast7Days += 1;
    }
    if (row.resolutionAction) {
      byResolutionAction.set(
        row.resolutionAction,
        (byResolutionAction.get(row.resolutionAction) ?? 0) + 1,
      );
    }
  }

  const byAssignmentAction = new Map<string, number>();
  for (const row of assignmentRows) {
    byAssignmentAction.set(row.action, (byAssignmentAction.get(row.action) ?? 0) + 1);
  }

  const openAnomalies = anomalyRows.filter((row) => row.status === "open");
  const resolvedAnomalies = anomalyRows.filter((row) => row.status === "resolved");
  const byAnomalyKind = new Map<string, number>();
  const byAnomalySeverity = new Map<string, number>();
  const byAlertLevel = new Map<string, number>();
  const byPolicyKey = new Map<string, number>();
  const byAutoActionStatus = new Map<string, number>();
  const policyBuckets = new Map<
    string,
    {
      scope: "routing" | "kind" | "severity" | "default";
      thresholds: number[];
      escalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      failureEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      autoAction: "none" | "assign_template" | "rebalance_queue";
      autoActionTemplateKey: string | null;
      cooldownMinutes: number;
      maxAlertLevel: number;
      maxAutoActionFailures: number;
      anomalyStages: Array<{
        key: string;
        minAgeHours: number;
        appliesToKinds: ItemFulfillmentAnomalyKind[] | null;
        routingCodes: ItemManualReviewRoutingCode[] | null;
        severity: ItemFulfillmentAnomalySeverity | null;
        alertLevel: number | null;
        anomalyPolicyKey: string | null;
        anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
        anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
        autoActionTemplateKey: string | null;
        cooldownMinutes: number | null;
      }>;
      matchingAnomalyCount: number;
    }
  >();
  let criticalCount = 0;
  let alertedCount = 0;
  let lastAlertedAt: Date | null = null;
  let autoActionedCount = 0;
  let lastAutoActionAt: Date | null = null;
  for (const row of openAnomalies) {
    byAnomalyKind.set(row.kind, (byAnomalyKind.get(row.kind) ?? 0) + 1);
    byAnomalySeverity.set(row.severity, (byAnomalySeverity.get(row.severity) ?? 0) + 1);
    if (row.policyKey) {
      byPolicyKey.set(row.policyKey, (byPolicyKey.get(row.policyKey) ?? 0) + 1);
      const template = env.fulfillmentAnomalyPolicyTemplates[row.policyKey];
      if (template) {
        policyBuckets.set(row.policyKey, {
          scope: row.policyKey.startsWith("routing:")
            ? "routing"
            : row.policyKey.startsWith("kind:")
              ? "kind"
              : row.policyKey.startsWith("severity:")
                ? "severity"
                : "default",
          thresholds: template.thresholds,
          escalationStrategy: template.escalationStrategy,
          failureEscalationStrategy: template.failureEscalationStrategy,
          autoAction: template.autoAction,
          autoActionTemplateKey: template.autoActionTemplateKey,
          cooldownMinutes: template.cooldownMinutes,
          maxAlertLevel: template.maxAlertLevel,
          maxAutoActionFailures: template.maxAutoActionFailures,
          anomalyStages: template.anomalyStages,
          matchingAnomalyCount: (policyBuckets.get(row.policyKey)?.matchingAnomalyCount ?? 0) + 1,
        });
      }
    }
    if (row.severity === "critical") criticalCount += 1;
    if ((row.alertLevel ?? 0) > 0) {
      alertedCount += 1;
      byAlertLevel.set(String(row.alertLevel), (byAlertLevel.get(String(row.alertLevel)) ?? 0) + 1);
      if (row.alertedAt && (!lastAlertedAt || row.alertedAt.getTime() > lastAlertedAt.getTime())) {
        lastAlertedAt = row.alertedAt;
      }
    }
    if (row.lastAutoActionAt) {
      autoActionedCount += 1;
      if (!lastAutoActionAt || row.lastAutoActionAt.getTime() > lastAutoActionAt.getTime()) {
        lastAutoActionAt = row.lastAutoActionAt;
      }
    }
    if (row.lastAutoActionStatus) {
      byAutoActionStatus.set(
        row.lastAutoActionStatus,
        (byAutoActionStatus.get(row.lastAutoActionStatus) ?? 0) + 1,
      );
    }
  }

  return {
    manualReviews,
    anomalies: {
      openCount: openAnomalies.length,
      criticalCount,
      alertedCount,
      autoActionedCount,
      latestDetectedAt: anomalyRows[0]?.detectedAt ? anomalyRows[0].detectedAt.toISOString() : null,
      latestResolvedAt: resolvedAnomalies[0]?.resolvedAt ? resolvedAnomalies[0].resolvedAt.toISOString() : null,
      lastAlertedAt: lastAlertedAt ? lastAlertedAt.toISOString() : null,
      lastAutoActionAt: lastAutoActionAt ? lastAutoActionAt.toISOString() : null,
      byKind: sortSummaryBuckets(byAnomalyKind),
      bySeverity: sortSummaryBuckets(byAnomalySeverity),
      byAlertLevel: sortSummaryBuckets(byAlertLevel),
      byPolicyKey: sortSummaryBuckets(byPolicyKey),
      byAutoActionStatus: sortSummaryBuckets(byAutoActionStatus),
      policies: Array.from(policyBuckets.entries())
        .map(([key, value]) => ({
          key,
          scope: value.scope,
          thresholds: value.thresholds,
          escalationStrategy: value.escalationStrategy,
          failureEscalationStrategy: value.failureEscalationStrategy,
          autoAction: value.autoAction,
          autoActionTemplateKey: value.autoActionTemplateKey,
          cooldownMinutes: value.cooldownMinutes,
          maxAlertLevel: value.maxAlertLevel,
          maxAutoActionFailures: value.maxAutoActionFailures,
          anomalyStages: value.anomalyStages,
          matchingAnomalyCount: value.matchingAnomalyCount,
        }))
        .sort((left, right) => right.matchingAnomalyCount - left.matchingAnomalyCount || left.key.localeCompare(right.key)),
    },
    byRejectionCode: sortSummaryBuckets(byRejectionCode),
    byRejectionCategory: sortSummaryBuckets(byRejectionCategory),
    appealableCount,
    resolvedLast7Days,
    byResolutionAction: sortSummaryBuckets(byResolutionAction),
    byAssignmentAction: sortSummaryBuckets(byAssignmentAction),
    latestAssignmentAt: assignmentRows[0]?.createdAt ? assignmentRows[0].createdAt.toISOString() : null,
    byRunTrigger: sortSummaryBuckets(byRunTrigger),
    byRunStatus: sortSummaryBuckets(byRunStatus),
    latestRunAt: recentRuns[0]?.createdAt ? recentRuns[0].createdAt.toISOString() : null,
    recentRunWindows,
    recentRuns: recentRunViews,
    recentAnomalies: anomalyRows.slice(0, 12).map(toItemFulfillmentAnomalyView),
    recommendations: buildFulfillmentOpsRecommendations({
      manualReviews,
      recentRunWindows,
      latestRunAt: recentRuns[0]?.createdAt ? recentRuns[0].createdAt.toISOString() : null,
    }),
  };
}

export async function listOpenFulfillmentAnomalies(operatorUserId: string, args?: {
  status?: "open" | "resolved";
  kind?: ItemFulfillmentAnomalyKind;
  severity?: ItemFulfillmentAnomalySeverity;
  alertLevel?: number;
  policyKey?: string;
  autoActionStatus?: "applied" | "noop" | "failed";
  limit?: number;
}) {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view fulfillment anomalies");
  }

  const clauses: SQL[] = [];
  if (args?.status) clauses.push(eq(itemFulfillmentAnomalies.status, args.status));
  if (args?.kind) clauses.push(eq(itemFulfillmentAnomalies.kind, args.kind));
  if (args?.severity) clauses.push(eq(itemFulfillmentAnomalies.severity, args.severity));
  if (typeof args?.alertLevel === "number") clauses.push(eq(itemFulfillmentAnomalies.alertLevel, args.alertLevel));
  if (args?.policyKey) clauses.push(eq(itemFulfillmentAnomalies.policyKey, args.policyKey));
  if (args?.autoActionStatus) clauses.push(eq(itemFulfillmentAnomalies.lastAutoActionStatus, args.autoActionStatus));
  const rows = await db
    .select()
    .from(itemFulfillmentAnomalies)
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(itemFulfillmentAnomalies.lastSeenAt))
    .limit(Math.max(1, Math.min(args?.limit ?? 100, 200)));
  return rows.map(toItemFulfillmentAnomalyView);
}

export async function listFulfillmentAnomalyPolicies(operatorUserId: string) {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view fulfillment anomaly policies");
  }

  const rows = await db
    .select({
      policyKey: itemFulfillmentAnomalies.policyKey,
      count: count(),
    })
    .from(itemFulfillmentAnomalies)
    .where(and(eq(itemFulfillmentAnomalies.status, "open"), sql`${itemFulfillmentAnomalies.policyKey} is not null`))
    .groupBy(itemFulfillmentAnomalies.policyKey);
  const counts = new Map(rows.map((row) => [row.policyKey ?? "default", Number(row.count ?? 0)]));

  return Object.entries(env.fulfillmentAnomalyPolicyTemplates)
    .map(([key, value]) => ({
      key,
      scope: key.startsWith("routing:")
        ? ("routing" as const)
        : key.startsWith("kind:")
          ? ("kind" as const)
          : key.startsWith("severity:")
            ? ("severity" as const)
            : ("default" as const),
      thresholds: value.thresholds,
      escalationStrategy: value.escalationStrategy,
      failureEscalationStrategy: value.failureEscalationStrategy,
      autoAction: value.autoAction,
      autoActionTemplateKey: value.autoActionTemplateKey,
      cooldownMinutes: value.cooldownMinutes,
      maxAlertLevel: value.maxAlertLevel,
      maxAutoActionFailures: value.maxAutoActionFailures,
      anomalyStages: value.anomalyStages,
      matchingAnomalyCount: counts.get(key) ?? 0,
    }))
    .sort((left, right) => right.matchingAnomalyCount - left.matchingAnomalyCount || left.key.localeCompare(right.key));
}

export async function listManualReviewSlaPolicies(operatorUserId: string): Promise<ManualReviewSlaPolicyTemplateView[]> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual review SLA policies");
  }

  const rows = await db.select().from(itemManualReviews).where(eq(itemManualReviews.status, "open"));
  const referenceTime = now();
  const buckets = new Map<string, ManualReviewSlaPolicyTemplateView>();

  for (const row of rows) {
    const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
    const priority = getManualReviewPriority({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      ageHours,
    });
    const policy = getManualReviewSlaPolicy({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      priority,
    });
    const slaBucket = getManualReviewSlaBucket({
      ageHours,
      priority,
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
    });
    const escalationLevel = Math.max(
      row.escalationLevel ?? 0,
      getManualReviewEscalationLevel({
        ageHours,
        slaBucket,
        priority,
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
      }),
    );
    const bucket = buckets.get(policy.key) ?? {
      key: policy.key,
      scope: policy.scope,
      slaHours: policy.slaHours,
      dueSoonLeadHours: policy.dueSoonLeadHours,
      criticalAfterHours: policy.criticalAfterHours,
      urgentAfterHours: policy.urgentAfterHours,
      assignAfterHours: policy.assignAfterHours,
      rebalanceAfterHours: policy.rebalanceAfterHours,
      autoAssignTemplateKey: policy.autoAssignTemplateKey,
      autoAssignEnabled: policy.autoAssignEnabled,
      maxAutoAssignmentsPerRun: policy.maxAutoAssignmentsPerRun,
      anomalyPolicyKey: policy.anomalyPolicyKey,
      anomalySeverity: policy.anomalySeverity,
      anomalyEscalationStrategy: policy.anomalyEscalationStrategy,
      anomalyAutoAction: policy.anomalyAutoAction,
      anomalyCooldownMinutes: policy.anomalyCooldownMinutes,
      anomalyStages: policy.anomalyStages,
      matchingReviewCount: 0,
      dueSoonCount: 0,
      breachedCount: 0,
      unclaimedCount: 0,
      escalatedCount: 0,
    };
    bucket.matchingReviewCount += 1;
    if (slaBucket === "due_soon") {
      bucket.dueSoonCount += 1;
    } else if (slaBucket === "breached") {
      bucket.breachedCount += 1;
    }
    if (!row.assigneeUserId) {
      bucket.unclaimedCount += 1;
    }
    if (escalationLevel > 0) {
      bucket.escalatedCount += 1;
    }
    buckets.set(policy.key, bucket);
  }

  return Object.entries(env.manualReviewSlaPolicies)
    .map(([key, policy]) => ({
      key,
      scope: key.startsWith("routing:")
        ? ("routing" as const)
        : key.startsWith("priority:")
          ? ("priority" as const)
          : ("default" as const),
      slaHours: policy.slaHours,
      dueSoonLeadHours: policy.dueSoonLeadHours,
      criticalAfterHours: policy.criticalAfterHours,
      urgentAfterHours: policy.urgentAfterHours,
      assignAfterHours: policy.assignAfterHours,
      rebalanceAfterHours: policy.rebalanceAfterHours,
      autoAssignTemplateKey: policy.autoAssignTemplateKey,
      autoAssignEnabled: policy.autoAssignEnabled,
      maxAutoAssignmentsPerRun: policy.maxAutoAssignmentsPerRun,
      anomalyPolicyKey: policy.anomalyPolicyKey,
      anomalySeverity: policy.anomalySeverity,
      anomalyEscalationStrategy: policy.anomalyEscalationStrategy,
      anomalyAutoAction: policy.anomalyAutoAction,
      anomalyCooldownMinutes: policy.anomalyCooldownMinutes,
      anomalyStages: policy.anomalyStages,
      matchingReviewCount: buckets.get(key)?.matchingReviewCount ?? 0,
      dueSoonCount: buckets.get(key)?.dueSoonCount ?? 0,
      breachedCount: buckets.get(key)?.breachedCount ?? 0,
      unclaimedCount: buckets.get(key)?.unclaimedCount ?? 0,
      escalatedCount: buckets.get(key)?.escalatedCount ?? 0,
    }))
    .sort((left, right) => right.matchingReviewCount - left.matchingReviewCount || left.key.localeCompare(right.key));
}

export async function resolveItemManualReview(
  operatorUserId: string,
  reviewId: string,
  action: ItemManualReviewAction,
  resolutionNote?: string,
): Promise<ItemView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can resolve manual reviews");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item_manual_reviews where id = ${reviewId} for update`);
    const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, reviewId));
    if (!review) {
      throw new NotFoundError("Manual review not found");
    }
    if (review.status !== "open") {
      throw new ConflictError("Manual review already resolved");
    }
    if (review.assigneeUserId && review.assigneeUserId !== operatorUserId) {
      throw new UnauthorizedError("Manual review is currently claimed by another operator");
    }

    await tx.execute(sql`select id from items where id = ${review.itemId} for update`);
    await tx.execute(sql`select id from item_units where id = ${review.unitId} for update`);

    const [item] = await tx.select().from(items).where(eq(items.id, review.itemId));
    const [unit] = await tx.select().from(itemUnits).where(eq(itemUnits.id, review.unitId));
    if (!item || !unit) {
      throw new NotFoundError("Linked item or unit missing");
    }

    const timestamp = now();
    let nextActiveUnits = item.activeUnits;
    let nextReplacementCount = item.replacementCount;
    let replacementUnitId: string | null = null;

    if (action === "approve_replacement") {
      if (unit.status === "replaced" && unit.replacedByUnitId) {
        replacementUnitId = unit.replacedByUnitId;
      } else {
        const [createdReplacement] = await tx
          .insert(itemUnits)
          .values({
            id: crypto.randomUUID(),
            itemId: item.id,
            slotNumber: unit.slotNumber,
            generation: unit.generation + 1,
            code: buildUnitCode(unit.slotNumber, unit.generation + 1),
            status: "active",
            issueReason: null,
            activatedAt: timestamp,
            expiresAt: unit.expiresAt,
            replacedByUnitId: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning();

        replacementUnitId = createdReplacement.id;
        nextReplacementCount += 1;
        nextActiveUnits = nextActiveUnits !== null ? nextActiveUnits + 1 : nextActiveUnits;

        await tx
          .update(itemUnits)
          .set({
            status: "replaced",
            replacedByUnitId: createdReplacement.id,
            updatedAt: timestamp,
          })
          .where(eq(itemUnits.id, unit.id));

        await tx.insert(itemReplacementLogs).values({
          id: crypto.randomUUID(),
          itemId: item.id,
          previousUnitId: unit.id,
          replacementUnitId: createdReplacement.id,
          reason: review.reason,
          trigger: "manual_review",
          createdAt: timestamp,
        });

        await enqueueOutboxEvent(
          "item.replaced",
          {
            userId: item.userId,
            itemId: item.id,
            oldUnitId: unit.id,
            newUnitId: createdReplacement.id,
            reason: review.reason,
          },
          tx,
        );
      }
    }

    const nextItemStatus = nextActiveUnits !== null && nextActiveUnits <= 0 ? "consumed" : "active";

    await tx
      .update(items)
      .set({
        activeUnits: nextActiveUnits,
        replacementCount: nextReplacementCount,
        status: nextItemStatus,
        lastReconciledAt: timestamp,
      })
      .where(eq(items.id, item.id));

    const resolvedRejectionCode =
      action === "reject_report"
        ? getResolvedManualReviewRejectionCode({
            reason: review.reason as ItemUnitIssueReason,
            routingCode: review.routingCode as ItemManualReviewRoutingCode,
          })
        : null;

    await tx
      .update(itemIssueReports)
      .set({
        outcome: action === "approve_replacement" ? "replaced" : "rejected",
        rejectionCode: resolvedRejectionCode,
        replacementUnitId,
      })
      .where(eq(itemIssueReports.id, review.reportId));

    await tx
      .update(itemManualReviews)
      .set({
        status: action === "approve_replacement" ? "approved" : "rejected",
        resolutionAction: action,
        resolutionNote: resolutionNote?.trim() || null,
        reviewerUserId: operatorUserId,
        resolvedAt: timestamp,
      })
      .where(eq(itemManualReviews.id, review.id));

    await resolveFulfillmentAnomaliesInTx({
      tx,
      itemId: item.id,
      reportId: review.reportId,
      reviewId: review.id,
      resolutionNote:
        action === "approve_replacement"
          ? "Manual review approved replacement and closed the routed anomaly."
          : "Manual review rejected the report and closed the routed anomaly.",
    });

    await enqueueOutboxEvent(
      "item.manualReviewResolved",
      {
        userId: item.userId,
        itemId: item.id,
        reviewId: review.id,
        action,
        replacementUnitId,
        resolutionNote: resolutionNote?.trim() || null,
      },
      tx,
    );

    return loadItemViewInTx(tx, item.id);
  });
}

export async function claimItemManualReview(
  operatorUserId: string,
  reviewId: string,
  assignmentAction: ItemManualReviewAssignmentAction = "claim",
): Promise<ItemManualReviewView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can claim manual reviews");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item_manual_reviews where id = ${reviewId} for update`);
    const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, reviewId));
    if (!review) {
      throw new NotFoundError("Manual review not found");
    }
    if (review.status !== "open") {
      throw new ConflictError("Only open manual reviews can be claimed");
    }
    if (review.assigneeUserId && review.assigneeUserId !== operatorUserId) {
      throw new ConflictError("Manual review is already claimed by another operator");
    }
    if (review.assigneeUserId !== operatorUserId) {
      await assertManualReviewAssigneeCapacityInTx(tx, operatorUserId);
    }

    const claimedAt = review.claimedAt ?? now();
    const [updated] = await tx
      .update(itemManualReviews)
      .set({
        assigneeUserId: operatorUserId,
        claimedAt,
      })
      .where(eq(itemManualReviews.id, review.id))
      .returning();

    await recordManualReviewAssignmentEventInTx(tx, {
      review,
      actorUserId: operatorUserId,
      action: assignmentAction,
      fromAssigneeUserId: review.assigneeUserId,
      toAssigneeUserId: operatorUserId,
      note: assignmentAction === "claim_next" ? "Operator claimed the next available review from the queue." : null,
    });

    await resolveManualReviewQueueLinkedAnomaliesInTx({
      tx,
      itemId: review.itemId,
      reportId: review.reportId,
      reviewId: review.id,
      resolutionNote:
        assignmentAction === "claim_next"
          ? "Manual review was claimed from the queue; queue-linked anomalies closed automatically."
          : "Manual review was claimed; queue-linked anomalies closed automatically.",
    });

    const [report] = await tx.select().from(itemIssueReports).where(eq(itemIssueReports.id, updated.reportId));
    const assignmentHistoryMap = await buildManualReviewAssignmentHistoryMap([updated.id], tx);
    return toItemManualReviewView(updated, report, now(), operatorUserId, assignmentHistoryMap.get(updated.id) ?? []);
  });
}

export async function claimNextItemManualReview(
  operatorUserId: string,
  input?: { templateKey?: string | null },
): Promise<ItemManualReviewView | null> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can claim manual reviews");
  }

  const workload = await getManualReviewWorkload(operatorUserId);
  const operatorBucket = workload.byAssignee.find((bucket) => bucket.key === operatorUserId);
  if (operatorBucket?.atCapacity) {
    throw new ConflictError("Current operator is already at manual review capacity");
  }

  const candidates = await db
    .select()
    .from(itemManualReviews)
    .where(and(eq(itemManualReviews.status, "open"), sql`${itemManualReviews.assigneeUserId} is null`))
    .orderBy(itemManualReviews.createdAt)
    .limit(250);

  const referenceTime = now();
  const sorted = candidates
    .map((row) => ({
      reviewId: row.id,
      priority: getManualReviewPriority({
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
        ageHours: getManualReviewAgeHours(row.createdAt, referenceTime),
      }),
      slaBucket: getManualReviewSlaBucket({
        ageHours: getManualReviewAgeHours(row.createdAt, referenceTime),
        priority: getManualReviewPriority({
          routingCode: row.routingCode as ItemManualReviewRoutingCode,
          ageHours: getManualReviewAgeHours(row.createdAt, referenceTime),
        }),
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
      }),
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      createdAt: row.createdAt,
      ageHours: getManualReviewAgeHours(row.createdAt, referenceTime),
    }))
    .filter((candidate) =>
      matchesManualReviewTemplateKey({
        routingCode: candidate.routingCode,
        priority: candidate.priority,
        templateKey: input?.templateKey ?? null,
      }),
    )
    .sort((left, right) => {
      const slaDiff = getManualReviewSlaRank(right.slaBucket) - getManualReviewSlaRank(left.slaBucket);
      if (slaDiff !== 0) return slaDiff;
      const priorityDiff = getManualReviewPriorityRank(right.priority) - getManualReviewPriorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      if (right.ageHours !== left.ageHours) return right.ageHours - left.ageHours;
      return left.createdAt.getTime() - right.createdAt.getTime();
    });

  for (const candidate of sorted) {
    try {
      return await claimItemManualReview(operatorUserId, candidate.reviewId, "claim_next");
    } catch (error) {
      if (error instanceof ConflictError || error instanceof UnauthorizedError || error instanceof NotFoundError) {
        continue;
      }
      throw error;
    }
  }

  return null;
}

function getRecommendedManualReviewAssignee(args: {
  currentOperatorUserId: string;
  assigneePool?: string[] | null;
  byAssignee: Array<{
    key: string;
    claimedCount: number;
    processingCount: number;
    avgClaimAgeHours: number | null;
    capacity?: number;
    remainingCapacity?: number;
    atCapacity?: boolean;
  }>;
}) {
  const operatorIds =
    args.assigneePool && args.assigneePool.length > 0
      ? args.assigneePool
      : env.platformOperatorUserIds.length > 0
        ? env.platformOperatorUserIds
        : [args.currentOperatorUserId];
  const loadByOperator = new Map<
    string,
    {
      claimedCount: number;
      processingCount: number;
      avgClaimAgeHours: number;
      capacity?: number;
      remainingCapacity?: number;
      atCapacity?: boolean;
    }
  >(
    args.byAssignee.map((bucket) => [
      bucket.key,
      {
        claimedCount: bucket.claimedCount,
        processingCount: bucket.processingCount,
        avgClaimAgeHours: bucket.avgClaimAgeHours ?? 0,
      },
    ]),
  );

  const ranked = operatorIds
    .map((operatorId) => ({
      operatorId,
      claimedCount: loadByOperator.get(operatorId)?.claimedCount ?? 0,
      processingCount: loadByOperator.get(operatorId)?.processingCount ?? 0,
      avgClaimAgeHours: loadByOperator.get(operatorId)?.avgClaimAgeHours ?? 0,
      capacity: loadByOperator.get(operatorId)?.capacity ?? getManualReviewAssigneeCapacity(operatorId),
      remainingCapacity:
        loadByOperator.get(operatorId)?.remainingCapacity ??
        Math.max(0, getManualReviewAssigneeCapacity(operatorId) - (loadByOperator.get(operatorId)?.claimedCount ?? 0)),
      atCapacity:
        loadByOperator.get(operatorId)?.atCapacity ??
        isManualReviewAssigneeAtCapacity({
          operatorUserId: operatorId,
          claimedCount: loadByOperator.get(operatorId)?.claimedCount ?? 0,
        }),
    }))
    .sort((left, right) => {
      if (left.atCapacity !== right.atCapacity) return Number(left.atCapacity) - Number(right.atCapacity);
      if (left.processingCount !== right.processingCount) return left.processingCount - right.processingCount;
      if (left.claimedCount !== right.claimedCount) return left.claimedCount - right.claimedCount;
      if (left.avgClaimAgeHours !== right.avgClaimAgeHours) return left.avgClaimAgeHours - right.avgClaimAgeHours;
      return left.operatorId.localeCompare(right.operatorId);
    });

  const available = ranked.filter((candidate) => !candidate.atCapacity && candidate.remainingCapacity > 0);
  return available[0]?.operatorId ?? null;
}

function normalizeManualReviewAssigneePool(operatorUserId: string, assigneePool?: string[] | null) {
  const allowedPool =
    env.platformOperatorUserIds.length > 0 ? new Set(env.platformOperatorUserIds) : new Set([operatorUserId]);
  const normalized = (assigneePool ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && allowedPool.has(value));

  if (normalized.length > 0) {
    return Array.from(new Set(normalized));
  }

  if (allowedPool.size > 0) {
    return Array.from(allowedPool);
  }

  return [operatorUserId];
}

function getRoutingAwareManualReviewAssigneePool(args: {
  operatorUserId: string;
  routingCode: ItemManualReviewRoutingCode;
  explicitAssigneePool?: string[] | null;
}) {
  const explicitPool = normalizeManualReviewAssigneePool(args.operatorUserId, args.explicitAssigneePool ?? null);
  if ((args.explicitAssigneePool ?? []).length > 0 && explicitPool.length > 0) {
    return {
      assigneePool: explicitPool,
      policySource: "explicit_pool" as const,
    };
  }

  const routingPool = env.manualReviewRoutingAssigneePools[args.routingCode] ?? [];
  if (routingPool.length > 0) {
    return {
      assigneePool: routingPool,
      policySource: "routing_pool" as const,
    };
  }

  return {
    assigneePool: normalizeManualReviewAssigneePool(args.operatorUserId, null),
    policySource: "global_pool" as const,
  };
}

function getManualReviewAutoAssignTemplate(args: {
  routingCode: ItemManualReviewRoutingCode;
  priority: ItemManualReviewPriority;
}) {
  const slaPolicy = getManualReviewSlaPolicy(args);
  if (
    slaPolicy.autoAssignTemplateKey &&
    env.manualReviewAutoAssignTemplates[slaPolicy.autoAssignTemplateKey]
  ) {
    const policySource: ManualReviewRebalanceAssignmentView["policySource"] = slaPolicy.key.startsWith("routing:")
      ? "template_routing"
      : slaPolicy.key.startsWith("priority:")
        ? "template_priority"
        : "template_default";
    return {
      templateKey: slaPolicy.autoAssignTemplateKey,
      policySource,
      ...env.manualReviewAutoAssignTemplates[slaPolicy.autoAssignTemplateKey],
    };
  }
  const routingKey = `routing:${args.routingCode}`;
  const priorityKey = `priority:${args.priority}`;
  if (env.manualReviewAutoAssignTemplates[routingKey]) {
    return {
      templateKey: routingKey,
      policySource: "template_routing" as const,
      ...env.manualReviewAutoAssignTemplates[routingKey],
    };
  }
  if (env.manualReviewAutoAssignTemplates[priorityKey]) {
    return {
      templateKey: priorityKey,
      policySource: "template_priority" as const,
      ...env.manualReviewAutoAssignTemplates[priorityKey],
    };
  }
  if (env.manualReviewAutoAssignTemplates.default) {
    return {
      templateKey: "default",
      policySource: "template_default" as const,
      ...env.manualReviewAutoAssignTemplates.default,
    };
  }
  return null;
}

function getManualReviewTemplateScope(templateKey: string): "routing" | "priority" | "default" {
  if (templateKey.startsWith("routing:")) return "routing";
  if (templateKey.startsWith("priority:")) return "priority";
  return "default";
}

function isManualReviewAnomalyRoutingCode(routingCode: ItemManualReviewRoutingCode) {
  return routingCode === "usage_audit_required" || routingCode === "high_replacement_frequency";
}

function matchesManualReviewTemplateKey(args: {
  routingCode: ItemManualReviewRoutingCode;
  priority: ItemManualReviewPriority;
  templateKey: string | null | undefined;
}) {
  if (!args.templateKey) return true;
  const matchedTemplate = getManualReviewAutoAssignTemplate({
    routingCode: args.routingCode,
    priority: args.priority,
  });
  return matchedTemplate?.templateKey === args.templateKey;
}

function getManualReviewAssigneeCapacity(operatorUserId: string) {
  return env.manualReviewAssigneeCapacities[operatorUserId] ?? env.manualReviewDefaultAssigneeCapacity;
}

function isManualReviewAssigneeAtCapacity(args: { operatorUserId: string; claimedCount: number }) {
  return args.claimedCount >= getManualReviewAssigneeCapacity(args.operatorUserId);
}

function getManualReviewAutoRebalancePolicy() {
  const assigneePool = env.platformOperatorUserIds.filter((value) => value.trim().length > 0);
  return {
    enabled: assigneePool.length > 0 && env.manualReviewAutoRebalanceMaxAssignments > 0,
    assigneePool,
    maxAssignments: env.manualReviewAutoRebalanceMaxAssignments,
    intervalMinutes: Math.max(1, Math.floor(env.manualReviewAutoRebalanceIntervalMs / 60_000)),
  };
}

async function assertManualReviewAssigneeCapacityInTx(
  tx: DbTx,
  operatorUserId: string,
  options?: {
    excludeReviewId?: string | null;
  },
) {
  const capacity = getManualReviewAssigneeCapacity(operatorUserId);
  const clauses: SQL[] = [
    eq(itemManualReviews.status, "open"),
    eq(itemManualReviews.assigneeUserId, operatorUserId),
  ];
  if (options?.excludeReviewId) {
    clauses.push(sql`${itemManualReviews.id} <> ${options.excludeReviewId}`);
  }
  const rows = await tx
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(itemManualReviews)
    .where(and(...clauses));

  const claimedCount = Number(rows[0]?.count ?? 0);
  if (claimedCount >= capacity) {
    throw new ConflictError("Selected operator is already at manual review capacity");
  }

  return {
    capacity,
    claimedCount,
    remainingCapacity: Math.max(0, capacity - claimedCount),
  };
}

async function recordManualReviewAssignmentEventInTx(
  tx: DbTx,
  input: {
    review: typeof itemManualReviews.$inferSelect;
    actorUserId: string;
    action: ItemManualReviewAssignmentAction;
    fromAssigneeUserId: string | null;
    toAssigneeUserId: string | null;
    note?: string | null;
  },
) {
  await tx.insert(itemManualReviewAssignmentEvents).values({
    id: crypto.randomUUID(),
    reviewId: input.review.id,
    itemId: input.review.itemId,
    reportId: input.review.reportId,
    actorUserId: input.actorUserId,
    action: input.action,
    fromAssigneeUserId: input.fromAssigneeUserId,
    toAssigneeUserId: input.toAssigneeUserId,
    note: input.note ?? null,
    createdAt: now(),
  });
}

export async function getManualReviewWorkload(operatorUserId: string): Promise<ManualReviewWorkloadView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual review workload");
  }

  const [rows, recentAssignmentRows, historyRows] = await Promise.all([
    db.select().from(itemManualReviews).where(eq(itemManualReviews.status, "open")).orderBy(itemManualReviews.createdAt),
    db.select().from(itemManualReviewAssignmentEvents).orderBy(desc(itemManualReviewAssignmentEvents.createdAt)).limit(20),
    db.select().from(itemManualReviewWorkloadSnapshots).orderBy(desc(itemManualReviewWorkloadSnapshots.createdAt)).limit(20),
  ]);

  const referenceTime = now();
  const byAssignee = new Map<
    string,
    { claimedCount: number; processingCount: number; totalClaimAgeHours: number; claimAgeSamples: number }
  >();
  const bySlaBucket = new Map<string, number>();
  const byPolicy = new Map<string, number>();
  let unclaimedCount = 0;
  let breachedUnclaimedCount = 0;
  let slaBreachedCount = 0;
  let nextClaimCandidate: ManualReviewWorkloadView["nextClaimCandidate"] = null;
  const autoAssignQueue: Array<{
    reviewId: string;
    priority: ItemManualReviewPriority;
    slaBucket: ItemManualReviewSlaBucket;
    routingCode: ItemManualReviewRoutingCode;
    ageHours: number;
    templateKey: string | null;
  }> = [];
  const templateBuckets = new Map<
    string,
    {
      scope: "routing" | "priority" | "default";
      strategy: "least_loaded" | "priority_first";
      maxAssignments: number;
      assigneePool: string[];
      matchingReviewCount: number;
      anomalyReviewCount: number;
    }
  >();

  for (const row of rows) {
    const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
    const priority = getManualReviewPriority({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      ageHours,
    });
    const matchedTemplate = getManualReviewAutoAssignTemplate({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      priority,
    });
    if (matchedTemplate) {
      const templateBucket = templateBuckets.get(matchedTemplate.templateKey) ?? {
        scope: getManualReviewTemplateScope(matchedTemplate.templateKey),
        strategy: matchedTemplate.strategy,
        maxAssignments: matchedTemplate.maxAssignments,
        assigneePool: matchedTemplate.assigneePool,
        matchingReviewCount: 0,
        anomalyReviewCount: 0,
      };
      templateBucket.matchingReviewCount += 1;
      if (isManualReviewAnomalyRoutingCode(row.routingCode as ItemManualReviewRoutingCode)) {
        templateBucket.anomalyReviewCount += 1;
      }
      templateBuckets.set(matchedTemplate.templateKey, templateBucket);
    }
    const slaBucket = getManualReviewSlaBucket({
      ageHours,
      priority,
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
    });
    const policy = getManualReviewSlaPolicy({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      priority,
    });
    bySlaBucket.set(slaBucket, (bySlaBucket.get(slaBucket) ?? 0) + 1);
    byPolicy.set(policy.key, (byPolicy.get(policy.key) ?? 0) + 1);
    if (slaBucket === "breached") {
      slaBreachedCount += 1;
    }

    if (!row.assigneeUserId) {
      unclaimedCount += 1;
      if (slaBucket === "breached") {
        breachedUnclaimedCount += 1;
      }
      if (slaBucket === "breached" || slaBucket === "due_soon") {
        autoAssignQueue.push({
          reviewId: row.id,
          priority,
          slaBucket,
          routingCode: row.routingCode as ItemManualReviewRoutingCode,
          ageHours,
          templateKey: matchedTemplate?.templateKey ?? null,
        });
      }
      if (
        !nextClaimCandidate ||
        getManualReviewSlaRank(slaBucket) > getManualReviewSlaRank(nextClaimCandidate.slaBucket ?? "on_track") ||
        (
          getManualReviewSlaRank(slaBucket) === getManualReviewSlaRank(nextClaimCandidate.slaBucket ?? "on_track") &&
        getManualReviewPriorityRank(priority) > getManualReviewPriorityRank(nextClaimCandidate.priority ?? "normal") ||
        (
          getManualReviewPriorityRank(priority) === getManualReviewPriorityRank(nextClaimCandidate.priority ?? "normal") &&
          ageHours > (nextClaimCandidate.ageHours ?? -1)
          )
        )
      ) {
        nextClaimCandidate = {
          reviewId: row.id,
          priority,
          slaBucket,
          routingCode: row.routingCode as ItemManualReviewRoutingCode,
          ageHours,
          templateKey: matchedTemplate?.templateKey ?? null,
        };
      }
      continue;
    }

    const claimAgeHours = getManualReviewClaimAgeHours(row.claimedAt, referenceTime);
    const bucket = byAssignee.get(row.assigneeUserId) ?? {
      claimedCount: 0,
      processingCount: 0,
      totalClaimAgeHours: 0,
      claimAgeSamples: 0,
    };
    bucket.claimedCount += 1;
    if (!isManualReviewClaimStale(row.claimedAt, referenceTime)) {
      bucket.processingCount += 1;
    }
    if (claimAgeHours !== null) {
      bucket.totalClaimAgeHours += claimAgeHours;
      bucket.claimAgeSamples += 1;
    }
    byAssignee.set(row.assigneeUserId, bucket);
  }

  for (const operatorId of normalizeManualReviewAssigneePool(operatorUserId, null)) {
    if (!byAssignee.has(operatorId)) {
      byAssignee.set(operatorId, {
        claimedCount: 0,
        processingCount: 0,
        totalClaimAgeHours: 0,
        claimAgeSamples: 0,
      });
    }
  }

  const byAssigneeBuckets = Array.from(byAssignee.entries())
    .map(([key, value]) => ({
      key,
      claimedCount: value.claimedCount,
      processingCount: value.processingCount,
      avgClaimAgeHours: value.claimAgeSamples > 0 ? Number((value.totalClaimAgeHours / value.claimAgeSamples).toFixed(1)) : null,
      capacity: getManualReviewAssigneeCapacity(key),
      remainingCapacity: Math.max(0, getManualReviewAssigneeCapacity(key) - value.claimedCount),
      atCapacity: isManualReviewAssigneeAtCapacity({
        operatorUserId: key,
        claimedCount: value.claimedCount,
      }),
    }))
    .sort((left, right) => {
      if (left.atCapacity !== right.atCapacity) return Number(left.atCapacity) - Number(right.atCapacity);
      if (right.claimedCount !== left.claimedCount) return right.claimedCount - left.claimedCount;
      return left.key.localeCompare(right.key);
    });
  const autoRebalancePolicy = getManualReviewAutoRebalancePolicy();
  const atCapacityCount = byAssigneeBuckets.filter((bucket) => bucket.atCapacity).length;
  const recommendedAssigneeUserId = getRecommendedManualReviewAssignee({
    currentOperatorUserId: operatorUserId,
    byAssignee: byAssigneeBuckets,
  });
  const slaPolicies = await listManualReviewSlaPolicies(operatorUserId);
  const recommendedAutoAssignments = autoAssignQueue.slice(0, env.manualReviewAutoRebalanceMaxAssignments).reduce<
    ManualReviewRebalanceAssignmentView[]
  >((acc, candidate) => {
    const poolDecision = getRoutingAwareManualReviewAssigneePool({
      operatorUserId,
      routingCode: candidate.routingCode,
    });
    const assigneeUserId = getRecommendedManualReviewAssignee({
      currentOperatorUserId: operatorUserId,
      assigneePool: poolDecision.assigneePool,
      byAssignee: byAssigneeBuckets,
    });
    if (!assigneeUserId) {
      return acc;
    }
    acc.push({
      reviewId: candidate.reviewId,
      assigneeUserId,
      priority: candidate.priority,
      slaBucket: candidate.slaBucket,
      routingCode: candidate.routingCode,
      policySource: poolDecision.policySource,
      templateKey: candidate.templateKey,
    });
    return acc;
  }, []);

  return {
    byAssignee: byAssigneeBuckets,
    bySlaBucket: sortSummaryBuckets(bySlaBucket),
    byPolicy: sortSummaryBuckets(byPolicy),
    unclaimedCount,
    breachedUnclaimedCount,
    slaBreachedCount,
    atCapacityCount,
    autoRebalanceEnabled: autoRebalancePolicy.enabled,
    autoRebalancePool: autoRebalancePolicy.assigneePool,
    autoRebalanceMaxAssignments: autoRebalancePolicy.maxAssignments,
    autoRebalanceIntervalMinutes: autoRebalancePolicy.intervalMinutes,
    recommendedAssigneeUserId,
    claimNextEta: nextClaimCandidate ? (recommendedAssigneeUserId ? "available_now" : "capacity_blocked") : null,
    nextClaimCandidate,
    recommendedAutoAssignments,
    recentAssignments: recentAssignmentRows.map(toItemManualReviewAssignmentEventView),
    history: historyRows.map(toManualReviewWorkloadSnapshotView),
    templates: Array.from(templateBuckets.entries())
      .map(([key, value]) => ({
        key,
        scope: value.scope,
        strategy: value.strategy,
        maxAssignments: value.maxAssignments,
        assigneePool: value.assigneePool,
        matchingReviewCount: value.matchingReviewCount,
        anomalyReviewCount: value.anomalyReviewCount,
      }))
      .sort((left, right) => right.matchingReviewCount - left.matchingReviewCount || left.key.localeCompare(right.key)),
    slaPolicies,
  };
}

export async function assignBalancedItemManualReview(
  operatorUserId: string,
  input?: { reviewId?: string | null; assigneePool?: string[] | null },
): Promise<ItemManualReviewView | null> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can assign manual reviews");
  }

  const workload = await getManualReviewWorkload(operatorUserId);
  const reviewId = input?.reviewId?.trim() || workload.nextClaimCandidate?.reviewId || null;
  if (!reviewId) {
    return null;
  }

  const assigneeUserId =
    getRecommendedManualReviewAssignee({
      currentOperatorUserId: operatorUserId,
      assigneePool: normalizeManualReviewAssigneePool(operatorUserId, input?.assigneePool ?? null),
      byAssignee: workload.byAssignee,
    }) ?? workload.recommendedAssigneeUserId;
  if (!assigneeUserId) {
    return null;
  }
  return assignItemManualReview(operatorUserId, reviewId, assigneeUserId, "assign_balanced");
}

export async function assignItemManualReview(
  operatorUserId: string,
  reviewId: string,
  assigneeUserId: string,
  assignmentAction: ItemManualReviewAssignmentAction = "assign_explicit",
): Promise<ItemManualReviewView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can assign manual reviews");
  }
  const allowedAssignees = normalizeManualReviewAssigneePool(operatorUserId, [assigneeUserId]);
  if (!allowedAssignees.includes(assigneeUserId)) {
    throw new UnauthorizedError("Assignee must be a configured platform operator");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item_manual_reviews where id = ${reviewId} for update`);
    const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, reviewId));
    if (!review) {
      throw new NotFoundError("Manual review not found");
    }
    if (review.status !== "open") {
      throw new ConflictError("Only open manual reviews can be assigned");
    }
    if (review.assigneeUserId && review.assigneeUserId !== assigneeUserId) {
      throw new ConflictError("Manual review is already claimed by another operator");
    }
    if (review.assigneeUserId !== assigneeUserId) {
      await assertManualReviewAssigneeCapacityInTx(tx, assigneeUserId, {
        excludeReviewId: review.id,
      });
    }

    const [updated] = await tx
      .update(itemManualReviews)
      .set({
        assigneeUserId,
        claimedAt: review.claimedAt ?? now(),
        autoAssignmentCount:
          assignmentAction === "assign_auto_sla" ? (review.autoAssignmentCount ?? 0) + 1 : review.autoAssignmentCount,
        lastAutoAssignedAt: assignmentAction === "assign_auto_sla" ? now() : review.lastAutoAssignedAt,
        escalationLevel:
          assignmentAction === "assign_auto_sla"
            ? Math.max(review.escalationLevel ?? 0, 1)
            : review.escalationLevel,
        slaEscalatedAt:
          assignmentAction === "assign_auto_sla" && !review.slaEscalatedAt ? now() : review.slaEscalatedAt,
      })
      .where(eq(itemManualReviews.id, review.id))
      .returning();

    await recordManualReviewAssignmentEventInTx(tx, {
      review,
      actorUserId: operatorUserId,
      action: assignmentAction,
      fromAssigneeUserId: review.assigneeUserId,
      toAssigneeUserId: assigneeUserId,
      note:
        assignmentAction === "assign_balanced"
          ? "Balanced assignment selected the least-loaded operator."
          : assignmentAction === "rebalance_manual"
            ? "Manual rebalance assigned the review to a different operator."
            : assignmentAction === "rebalance_auto"
              ? "Automatic rebalance assigned the review to the configured operator pool."
              : assignmentAction === "assign_auto_sla"
                ? "SLA automation assigned the review because it reached due-soon/breached state."
              : null,
    });

    await resolveManualReviewQueueLinkedAnomaliesInTx({
      tx,
      itemId: review.itemId,
      reportId: review.reportId,
      reviewId: review.id,
      resolutionNote:
        assignmentAction === "assign_auto_sla"
          ? "Manual review was automatically assigned; queue-linked anomalies closed automatically."
          : "Manual review was assigned; queue-linked anomalies closed automatically.",
    });

    const [report] = await tx.select().from(itemIssueReports).where(eq(itemIssueReports.id, updated.reportId));
    const assignmentHistoryMap = await buildManualReviewAssignmentHistoryMap([updated.id], tx);
    return toItemManualReviewView(updated, report, now(), operatorUserId, assignmentHistoryMap.get(updated.id) ?? []);
  });
}

export async function rebalanceItemManualReviews(
  operatorUserId: string,
  input?: {
    strategy?: "least_loaded" | "priority_first";
    maxAssignments?: number;
    assigneePool?: string[] | null;
    templateKey?: string | null;
    assignmentAction?: "rebalance_manual" | "rebalance_auto";
  },
): Promise<ManualReviewRebalanceResult> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can rebalance manual reviews");
  }

  const maxAssignments = Math.max(1, Math.min(input?.maxAssignments ?? 10, 100));
  const strategy = input?.strategy ?? "least_loaded";
  const assignmentAction = input?.assignmentAction ?? "rebalance_manual";
  const assigneePool = normalizeManualReviewAssigneePool(operatorUserId, input?.assigneePool ?? null);
  const workload = await getManualReviewWorkload(operatorUserId);

  const candidates = await db
    .select()
    .from(itemManualReviews)
    .where(and(eq(itemManualReviews.status, "open"), sql`${itemManualReviews.assigneeUserId} is null`))
    .orderBy(itemManualReviews.createdAt)
    .limit(500);

  const referenceTime = now();
  const queue = candidates
    .map((row) => {
      const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
      const priority = getManualReviewPriority({
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
        ageHours,
      });
      const slaBucket = getManualReviewSlaBucket({
        ageHours,
        priority,
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
      });
      return {
        reviewId: row.id,
        priority,
        slaBucket,
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
        ageHours,
        templateKey:
          getManualReviewAutoAssignTemplate({
            routingCode: row.routingCode as ItemManualReviewRoutingCode,
            priority,
          })?.templateKey ?? null,
        createdAt: row.createdAt,
      };
    })
    .filter((candidate) =>
      matchesManualReviewTemplateKey({
        routingCode: candidate.routingCode,
        priority: candidate.priority,
        templateKey: input?.templateKey ?? null,
      }),
    )
    .sort((left, right) => {
      const slaDiff = getManualReviewSlaRank(right.slaBucket) - getManualReviewSlaRank(left.slaBucket);
      const priorityDiff = getManualReviewPriorityRank(right.priority) - getManualReviewPriorityRank(left.priority);
      if (strategy === "priority_first") {
        if (slaDiff !== 0) return slaDiff;
        if (priorityDiff !== 0) return priorityDiff;
      } else {
        if (priorityDiff !== 0) return priorityDiff;
        if (slaDiff !== 0) return slaDiff;
      }
      if (right.ageHours !== left.ageHours) return right.ageHours - left.ageHours;
      return left.createdAt.getTime() - right.createdAt.getTime();
    });

  const localBuckets = new Map(
    workload.byAssignee
      .filter((bucket) => assigneePool.includes(bucket.key))
      .map((bucket) => [
        bucket.key,
        {
          claimedCount: bucket.claimedCount,
          processingCount: bucket.processingCount,
          avgClaimAgeHours: bucket.avgClaimAgeHours,
        },
      ]),
  );

  const assignments: ManualReviewRebalanceAssignmentView[] = [];
  let skippedCount = 0;

  for (const candidate of queue) {
    if (assignments.length >= maxAssignments) {
      break;
    }

    const poolDecision = getRoutingAwareManualReviewAssigneePool({
      operatorUserId,
      routingCode: candidate.routingCode,
      explicitAssigneePool: input?.assigneePool ?? null,
    });
    const assigneeUserId = getRecommendedManualReviewAssignee({
      currentOperatorUserId: operatorUserId,
      assigneePool: poolDecision.assigneePool,
      byAssignee: poolDecision.assigneePool.map((key) => ({
        key,
        claimedCount: localBuckets.get(key)?.claimedCount ?? 0,
        processingCount: localBuckets.get(key)?.processingCount ?? 0,
        avgClaimAgeHours: localBuckets.get(key)?.avgClaimAgeHours ?? null,
        capacity: getManualReviewAssigneeCapacity(key),
        remainingCapacity: Math.max(
          0,
          getManualReviewAssigneeCapacity(key) - (localBuckets.get(key)?.claimedCount ?? 0),
        ),
        atCapacity: isManualReviewAssigneeAtCapacity({
          operatorUserId: key,
          claimedCount: localBuckets.get(key)?.claimedCount ?? 0,
        }),
      })),
    });
    if (!assigneeUserId) {
      skippedCount += 1;
      continue;
    }

    try {
      await assignItemManualReview(operatorUserId, candidate.reviewId, assigneeUserId, assignmentAction);
      const bucket = localBuckets.get(assigneeUserId) ?? {
        claimedCount: 0,
        processingCount: 0,
        avgClaimAgeHours: 0,
      };
      bucket.claimedCount += 1;
      bucket.processingCount += 1;
      localBuckets.set(assigneeUserId, bucket);
      assignments.push({
        reviewId: candidate.reviewId,
        assigneeUserId,
        priority: candidate.priority,
        slaBucket: candidate.slaBucket,
        routingCode: candidate.routingCode,
        policySource: poolDecision.policySource,
        templateKey: candidate.templateKey,
      });
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError || error instanceof UnauthorizedError) {
        skippedCount += 1;
        continue;
      }
      throw error;
    }
  }

  const result = {
    assignedCount: assignments.length,
    skippedCount,
    assignments,
  } satisfies ManualReviewRebalanceResult;

  const refreshedWorkload = await getManualReviewWorkload(operatorUserId);
  await recordManualReviewWorkloadSnapshot(
    assignmentAction === "rebalance_auto" ? "auto" : "manual",
    refreshedWorkload,
  );

  return result;
}

export async function autoRebalanceItemManualReviews(args?: {
  strategy?: "least_loaded" | "priority_first";
  maxAssignments?: number;
  assigneePool?: string[] | null;
  templateKey?: string | null;
}) {
  const autoRebalancePolicy = getManualReviewAutoRebalancePolicy();
  if (!autoRebalancePolicy.enabled) {
    return {
      assignedCount: 0,
      skippedCount: 0,
      assignments: [],
    } satisfies ManualReviewRebalanceResult;
  }

  const operatorUserId = autoRebalancePolicy.assigneePool[0];
  if (!operatorUserId) {
    return {
      assignedCount: 0,
      skippedCount: 0,
      assignments: [],
    } satisfies ManualReviewRebalanceResult;
  }

  return rebalanceItemManualReviews(operatorUserId, {
    strategy: args?.strategy ?? "priority_first",
    maxAssignments: args?.maxAssignments ?? autoRebalancePolicy.maxAssignments,
    assigneePool: args?.assigneePool ?? autoRebalancePolicy.assigneePool,
    templateKey: args?.templateKey ?? null,
    assignmentAction: "rebalance_auto",
  });
}

export async function autoAssignSlaItemManualReviews(args?: {
  maxAssignments?: number;
  assigneePool?: string[] | null;
  templateKey?: string | null;
}) {
  const operatorUserId = env.platformOperatorUserIds[0];
  if (!operatorUserId) {
    return {
      assignedCount: 0,
      skippedCount: 0,
      assignments: [],
    } satisfies ManualReviewRebalanceResult;
  }

  const maxAssignments = Math.max(1, Math.min(args?.maxAssignments ?? env.manualReviewAutoRebalanceMaxAssignments, 50));
  const reviews = await listOpenItemManualReviews(operatorUserId, {
    status: "open",
    limit: 200,
  });
  const queue = reviews
    .filter((review) => !review.assigneeUserId && (review.slaBucket === "breached" || review.slaBucket === "due_soon"))
    .sort((left, right) => {
      const slaDiff = getManualReviewSlaRank(right.slaBucket) - getManualReviewSlaRank(left.slaBucket);
      if (slaDiff !== 0) return slaDiff;
      const priorityDiff = getManualReviewPriorityRank(right.priority) - getManualReviewPriorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return right.ageHours - left.ageHours;
    });

  const assignments: ManualReviewRebalanceAssignmentView[] = [];
  const templateAssignmentCounts = new Map<string, number>();
  const slaPolicyAssignmentCounts = new Map<string, number>();
  let skippedCount = 0;
  for (const candidate of queue) {
    if (assignments.length >= maxAssignments) break;
    const slaPolicy = getManualReviewSlaPolicy({
      routingCode: candidate.routingCode,
      priority: candidate.priority,
    });
    if (!slaPolicy.autoAssignEnabled) {
      skippedCount += 1;
      continue;
    }
    if ((slaPolicyAssignmentCounts.get(slaPolicy.key) ?? 0) >= slaPolicy.maxAutoAssignmentsPerRun) {
      skippedCount += 1;
      continue;
    }
    const template = getManualReviewAutoAssignTemplate({
      routingCode: candidate.routingCode,
      priority: candidate.priority,
    });
    if (
      !matchesManualReviewTemplateKey({
        routingCode: candidate.routingCode,
        priority: candidate.priority,
        templateKey: args?.templateKey ?? null,
      })
    ) {
      skippedCount += 1;
      continue;
    }
    if (template && (templateAssignmentCounts.get(template.templateKey) ?? 0) >= template.maxAssignments) {
      skippedCount += 1;
      continue;
    }
    const poolDecision =
      template && !args?.assigneePool?.length
        ? {
            assigneePool: normalizeManualReviewAssigneePool(operatorUserId, template.assigneePool),
            policySource: template.policySource,
            templateKey: template.templateKey,
          }
        : {
            ...getRoutingAwareManualReviewAssigneePool({
              operatorUserId,
              routingCode: candidate.routingCode,
              explicitAssigneePool: args?.assigneePool ?? null,
            }),
            templateKey: null as string | null,
          };
    const workload = await getManualReviewWorkload(operatorUserId);
    const assigneeUserId = getRecommendedManualReviewAssignee({
      currentOperatorUserId: operatorUserId,
      assigneePool: poolDecision.assigneePool,
      byAssignee: workload.byAssignee,
    });
    if (!assigneeUserId) {
      skippedCount += 1;
      continue;
    }
    try {
      const review = await assignItemManualReview(operatorUserId, candidate.id, assigneeUserId, "assign_auto_sla");
      assignments.push({
        reviewId: review.id,
        assigneeUserId,
        priority: review.priority,
        slaBucket: review.slaBucket,
        routingCode: review.routingCode,
        policySource: poolDecision.policySource,
        templateKey: poolDecision.templateKey,
      });
      if (template) {
        templateAssignmentCounts.set(template.templateKey, (templateAssignmentCounts.get(template.templateKey) ?? 0) + 1);
      }
      slaPolicyAssignmentCounts.set(slaPolicy.key, (slaPolicyAssignmentCounts.get(slaPolicy.key) ?? 0) + 1);
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError || error instanceof UnauthorizedError) {
        skippedCount += 1;
        continue;
      }
      throw error;
    }
  }

  const refreshedWorkload = await getManualReviewWorkload(operatorUserId);
  await recordManualReviewWorkloadSnapshot("auto", refreshedWorkload);
  return {
    assignedCount: assignments.length,
    skippedCount,
    assignments,
  } satisfies ManualReviewRebalanceResult;
}

async function runFulfillmentAnomalyAutoAction(args: {
  anomaly: typeof itemFulfillmentAnomalies.$inferSelect;
  policy: ReturnType<typeof getFulfillmentAnomalyPolicyTemplate>;
  operatorUserId: string;
}) {
  const effectiveAutoAction =
    ((args.anomaly.autoAction as "none" | "assign_template" | "rebalance_queue" | null) ?? args.policy.autoAction) ||
    "none";
  const effectiveAutoActionTemplateKey = args.anomaly.autoActionTemplateKey ?? args.policy.autoActionTemplateKey;

  if (effectiveAutoAction === "none") {
    return { action: "none", applied: false, errorMessage: null };
  }

  if (effectiveAutoAction === "rebalance_queue") {
    const result = await autoRebalanceItemManualReviews({
      templateKey: effectiveAutoActionTemplateKey ?? null,
      maxAssignments: 1,
    });
    return {
      action: result.assignedCount > 0 ? "rebalance_queue" : "rebalance_queue_noop",
      applied: result.assignedCount > 0,
      errorMessage: result.assignedCount > 0 ? null : "Automatic rebalance did not assign any review.",
    };
  }

  if (!args.anomaly.reviewId) {
    return { action: "assign_template_no_review", applied: false, errorMessage: "Anomaly does not reference an open review." };
  }

  const [review] = await db
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.id, args.anomaly.reviewId))
    .limit(1);
  if (!review || review.status !== "open") {
    return { action: "assign_template_review_closed", applied: false, errorMessage: "Linked review is no longer open." };
  }
  if (review.assigneeUserId) {
    return { action: "assign_template_already_claimed", applied: false, errorMessage: "Linked review is already claimed." };
  }

  const ageHours = getManualReviewAgeHours(review.createdAt, now());
  const priority = getManualReviewPriority({
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    ageHours,
  });
  const template =
    effectiveAutoActionTemplateKey && env.manualReviewAutoAssignTemplates[effectiveAutoActionTemplateKey]
      ? {
          templateKey: effectiveAutoActionTemplateKey,
          policySource: (
            effectiveAutoActionTemplateKey.startsWith("routing:")
              ? "template_routing"
              : effectiveAutoActionTemplateKey.startsWith("priority:")
                ? "template_priority"
                : "template_default"
          ) as ManualReviewRebalanceAssignmentView["policySource"],
          ...env.manualReviewAutoAssignTemplates[effectiveAutoActionTemplateKey],
        }
      : getManualReviewAutoAssignTemplate({
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          priority,
        });

  const assigneePool =
    template?.assigneePool?.length
      ? normalizeManualReviewAssigneePool(args.operatorUserId, template.assigneePool)
      : getRoutingAwareManualReviewAssigneePool({
          operatorUserId: args.operatorUserId,
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          explicitAssigneePool: null,
        }).assigneePool;
  const workload = await getManualReviewWorkload(args.operatorUserId);
  const assigneeUserId = getRecommendedManualReviewAssignee({
    currentOperatorUserId: args.operatorUserId,
    assigneePool,
    byAssignee: workload.byAssignee,
  });
  if (!assigneeUserId) {
    return {
      action: "assign_template_capacity_blocked",
      applied: false,
      errorMessage: "No assignee currently has remaining capacity for this template.",
    };
  }

  try {
    await assignItemManualReview(args.operatorUserId, review.id, assigneeUserId, "assign_auto_sla");
    return { action: "assign_template", applied: true, errorMessage: null };
  } catch (error) {
    if (error instanceof ConflictError || error instanceof NotFoundError || error instanceof UnauthorizedError) {
      return { action: "assign_template_conflict", applied: false, errorMessage: error.message };
    }
    throw error;
  }
}

export async function syncManualReviewSlaAnomalies(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 100, 500));
  const referenceTime = now();
  const reviews = await db
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.status, "open"))
    .orderBy(itemManualReviews.createdAt)
    .limit(limit);

  const reportIds = Array.from(new Set(reviews.map((review) => review.reportId)));
  const reports =
    reportIds.length > 0
      ? await db.select().from(itemIssueReports).where(inArray(itemIssueReports.id, reportIds))
      : [];
  const reportsById = new Map(reports.map((report) => [report.id, report]));

  let createdOrUpdatedCount = 0;
  let resolvedCount = 0;
  const affectedReviewIds: string[] = [];

  await db.transaction(async (tx) => {
    for (const review of reviews) {
      const ageHours = getManualReviewAgeHours(review.createdAt, referenceTime);
      const priority = getManualReviewPriority({
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        ageHours,
      });
      const slaPolicy = getManualReviewSlaPolicy({
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        priority,
      });
      const slaBucket = getManualReviewSlaBucket({
        ageHours,
        priority,
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
      });
      const shouldTrack = !review.assigneeUserId && (slaBucket === "due_soon" || slaBucket === "breached");

      if (shouldTrack) {
        const anomalyProgress = getManualReviewSlaAnomalyProgress({
          ageHours,
          slaPolicy,
          referenceTime,
        });
        const anomalyRuleState = getManualReviewSlaAnomalyRuleState({
          ageHours,
          anomalyKind:
            slaBucket === "due_soon"
              ? ("sla_due_soon_unclaimed" as ItemFulfillmentAnomalyKind)
              : ("sla_breach_unclaimed" as ItemFulfillmentAnomalyKind),
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          priority,
          slaPolicy,
          referenceTime,
        });
        const slaDrivenAutoAction = getManualReviewSlaDrivenAutoAction({
          slaPolicy,
          anomalyProgress,
          ageHours,
        });
        const effectiveAutoAction = anomalyRuleState.anomalyAutoAction ?? slaDrivenAutoAction.autoAction;
        const effectiveAutoActionTemplateKey =
          anomalyRuleState.autoActionTemplateKey ?? slaDrivenAutoAction.autoActionTemplateKey;
        const anomalyKind =
          slaBucket === "due_soon"
            ? ("sla_due_soon_unclaimed" as ItemFulfillmentAnomalyKind)
            : ("sla_breach_unclaimed" as ItemFulfillmentAnomalyKind);
        await upsertFulfillmentAnomalyInTx({
          tx,
          itemId: review.itemId,
          reportId: review.reportId,
          reviewId: review.id,
          kind: anomalyKind,
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          policyKeyOverride: anomalyRuleState.anomalyPolicyKey,
          severityOverride: anomalyRuleState.severity,
          escalationStrategyOverride: anomalyRuleState.anomalyEscalationStrategy,
          alertLevelOverride: anomalyRuleState.alertLevel,
          nextAlertEligibleAtOverride: anomalyRuleState.nextAlertEligibleAt,
          nextEscalationAtOverride: anomalyRuleState.nextEscalationAt,
          autoActionOverride: effectiveAutoAction,
          autoActionTemplateKeyOverride: effectiveAutoActionTemplateKey,
          summary:
            slaBucket === "due_soon"
              ? "Manual review is approaching SLA breach while remaining unclaimed."
              : "Manual review breached SLA while remaining unclaimed.",
          detail: `Priority ${priority} review is ${ageHours}h old and still unassigned. Current SLA bucket=${slaBucket}, anomaly severity=${anomalyRuleState.severity}, alertLevel=${anomalyRuleState.alertLevel}${anomalyRuleState.matchedStageKey ? ` via SLA stage ${anomalyRuleState.matchedStageKey}` : ""}${slaPolicy.criticalAfterHours !== null ? ` (critical after ${slaPolicy.criticalAfterHours}h)` : ""}${slaPolicy.urgentAfterHours !== null ? `, urgent after ${slaPolicy.urgentAfterHours}h` : ""}.`,
        });
        await resolveFulfillmentAnomaliesInTx({
          tx,
          itemId: review.itemId,
          reportId: review.reportId,
          reviewId: review.id,
          kind:
            slaBucket === "due_soon"
              ? ("sla_breach_unclaimed" as ItemFulfillmentAnomalyKind)
              : ("sla_due_soon_unclaimed" as ItemFulfillmentAnomalyKind),
          resolutionNote:
            slaBucket === "due_soon"
              ? "Review remains in due-soon window and has not breached SLA yet."
              : "Review progressed from due-soon into breached SLA handling.",
        });
        createdOrUpdatedCount += 1;
        affectedReviewIds.push(review.id);
      } else {
        for (const kind of ["sla_due_soon_unclaimed", "sla_breach_unclaimed"] as ItemFulfillmentAnomalyKind[]) {
          await resolveFulfillmentAnomaliesInTx({
            tx,
            itemId: review.itemId,
            reportId: review.reportId,
            reviewId: review.id,
            kind,
            resolutionNote: review.assigneeUserId
              ? "Review was assigned before further SLA escalation."
              : "Review no longer matches SLA-driven anomaly criteria.",
          });
        }
      }
    }

    const staleResolvedRows = await tx
      .select()
      .from(itemFulfillmentAnomalies)
      .where(
        inArray(
          itemFulfillmentAnomalies.kind,
          ["sla_due_soon_unclaimed", "sla_breach_unclaimed"] as ItemFulfillmentAnomalyKind[],
        ),
      );

    for (const row of staleResolvedRows) {
      const reviewStillOpen = reviews.some((review) => review.id === row.reviewId);
        if (!reviewStillOpen && row.status === "open") {
          await resolveFulfillmentAnomaliesInTx({
            tx,
            itemId: row.itemId,
            reportId: row.reportId,
            reviewId: row.reviewId,
            kind: row.kind as ItemFulfillmentAnomalyKind,
            resolutionNote: "Review left the open queue; SLA-driven anomaly closed automatically.",
          });
          resolvedCount += 1;
        }
    }
  });

  return {
    scannedCount: reviews.length,
    createdOrUpdatedCount,
    resolvedCount,
    affectedReviewIds,
    trackedOpenReviews: reviews
      .map((review) => {
        const report = reportsById.get(review.reportId);
        return {
          reviewId: review.id,
          itemId: review.itemId,
          reportId: review.reportId,
          assigneeUserId: review.assigneeUserId,
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          appealable: report ? isItemIssueAppealable((report.rejectionCode as ItemIssueRejectionCode | null) ?? null) : false,
        };
      })
      .slice(0, 20),
  };
}

export async function escalateFulfillmentAnomalies(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 100, 500));
  const referenceTime = now();
  const rows = await db
    .select()
    .from(itemFulfillmentAnomalies)
    .where(eq(itemFulfillmentAnomalies.status, "open"))
    .orderBy(itemFulfillmentAnomalies.detectedAt)
    .limit(limit);

  let escalatedCount = 0;
  let unchangedCount = 0;
  const affectedIds: string[] = [];
  const autoActionCandidates: Array<{
    anomalyId: string;
    policy: ReturnType<typeof getFulfillmentAnomalyPolicyTemplate>;
    effectiveAutoAction: "none" | "assign_template" | "rebalance_queue";
    effectiveAutoActionTemplateKey: string | null;
  }> = [];

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const linkedRuleState = await getManualReviewLinkedAnomalyRuleStateInTx({
        tx,
        anomaly: row,
        referenceTime,
      });
      const baseSeverity = linkedRuleState?.anomalyRuleState.severity ?? (row.severity as ItemFulfillmentAnomalySeverity);
      const effectiveRoutingCode =
        (linkedRuleState?.review.routingCode as ItemManualReviewRoutingCode | undefined) ??
        ((row.routingCode as ItemManualReviewRoutingCode | null) ?? null);
      const fallbackRuleState = getFulfillmentAnomalyRuleState({
        kind: row.kind as ItemFulfillmentAnomalyKind,
        severity: baseSeverity,
        routingCode: effectiveRoutingCode,
        detectedAt: row.detectedAt,
        referenceTime,
        preferredPolicyKey: row.policyKey,
      });
      const effectiveSeverity =
        linkedRuleState?.anomalyRuleState.severity ?? fallbackRuleState.severity;
      const policy = getFulfillmentAnomalyPolicyTemplate({
        kind: row.kind as ItemFulfillmentAnomalyKind,
        severity: effectiveSeverity,
        routingCode: effectiveRoutingCode,
        preferredPolicyKey:
          linkedRuleState?.anomalyRuleState.anomalyPolicyKey ??
          fallbackRuleState.anomalyPolicyKey ??
          row.policyKey,
      });
      const effectiveAutoAction =
        linkedRuleState?.effectiveAutoAction ?? fallbackRuleState.autoAction ?? policy.autoAction;
      const effectiveAutoActionTemplateKey =
        linkedRuleState?.effectiveAutoActionTemplateKey ??
        fallbackRuleState.autoActionTemplateKey ??
        policy.autoActionTemplateKey;
      const thresholdAlertLevel = getFulfillmentAnomalyAlertLevel({
        kind: row.kind as ItemFulfillmentAnomalyKind,
        severity: effectiveSeverity,
        routingCode: effectiveRoutingCode,
        detectedAt: row.detectedAt,
        referenceTime,
      });
      const targetAlertLevel = Math.max(
        thresholdAlertLevel,
        linkedRuleState?.anomalyRuleState.alertLevel ?? 0,
        fallbackRuleState.alertLevel ?? 0,
      );
      if (row.nextAlertEligibleAt && row.nextAlertEligibleAt.getTime() > referenceTime.getTime()) {
        unchangedCount += 1;
        continue;
      }
      if (targetAlertLevel <= (row.alertLevel ?? 0)) {
        unchangedCount += 1;
        continue;
      }

      const alertReason = buildFulfillmentAnomalyAlertReason({
        kind: row.kind as ItemFulfillmentAnomalyKind,
        severity: effectiveSeverity,
        alertLevel: targetAlertLevel,
        policyKey: policy.key,
        escalationStrategy:
          linkedRuleState?.anomalyRuleState.anomalyEscalationStrategy ?? policy.escalationStrategy,
      });

      await tx
        .update(itemFulfillmentAnomalies)
        .set({
          severity: effectiveSeverity,
          alertLevel: targetAlertLevel,
          alertedAt: row.alertedAt ?? referenceTime,
          lastAlertReason: alertReason,
          policyKey:
            linkedRuleState?.anomalyRuleState.anomalyPolicyKey ??
            fallbackRuleState.anomalyPolicyKey ??
            policy.key,
          escalationStrategy:
            linkedRuleState?.anomalyRuleState.anomalyEscalationStrategy ??
            fallbackRuleState.escalationStrategy ??
            policy.escalationStrategy,
          autoAction: effectiveAutoAction,
          autoActionTemplateKey: effectiveAutoActionTemplateKey,
          nextAlertEligibleAt:
            linkedRuleState?.anomalyRuleState.nextAlertEligibleAt ??
            fallbackRuleState.nextAlertEligibleAt ??
            getNextFulfillmentAnomalyAlertEligibleAt(referenceTime, policy),
          nextEscalationAt: linkedRuleState?.anomalyRuleState.nextEscalationAt ?? getNextFulfillmentAnomalyEscalationAt({
            detectedAt: row.detectedAt,
            currentAlertLevel: targetAlertLevel,
            policy,
          }),
          lastSeenAt: referenceTime,
        })
        .where(eq(itemFulfillmentAnomalies.id, row.id));

      await enqueueOutboxEvent(
        "item.anomalyEscalated",
        {
          anomalyId: row.id,
          itemId: row.itemId,
          reportId: row.reportId,
          reviewId: row.reviewId,
          kind: row.kind,
          severity: effectiveSeverity,
          alertLevel: targetAlertLevel,
          policyKey:
            linkedRuleState?.anomalyRuleState.anomalyPolicyKey ??
            fallbackRuleState.anomalyPolicyKey ??
            policy.key,
          escalationStrategy:
            linkedRuleState?.anomalyRuleState.anomalyEscalationStrategy ??
            fallbackRuleState.escalationStrategy ??
            policy.escalationStrategy,
        },
        tx,
      );

      escalatedCount += 1;
      affectedIds.push(row.id);
      if (effectiveAutoAction !== "none") {
        const autoActionExhausted =
          row.lastAutoActionStatus === "failed" && (row.autoActionAttemptCount ?? 0) >= policy.maxAutoActionFailures;
        if (autoActionExhausted) {
          continue;
        }
        autoActionCandidates.push({
          anomalyId: row.id,
          policy,
          effectiveAutoAction,
          effectiveAutoActionTemplateKey,
        });
      }
    }
  });

  const automationOperatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (automationOperatorUserId) {
    for (const candidate of autoActionCandidates) {
      const [anomaly] = await db
        .select()
        .from(itemFulfillmentAnomalies)
        .where(eq(itemFulfillmentAnomalies.id, candidate.anomalyId))
        .limit(1);
      if (!anomaly || anomaly.status !== "open") {
        continue;
      }
      const result = await runFulfillmentAnomalyAutoAction({
        anomaly,
        policy: candidate.policy,
        operatorUserId: automationOperatorUserId,
      });
      const autoActionAttemptCount = (anomaly.autoActionAttemptCount ?? 0) + 1;
      const autoActionStatus = result.applied ? "applied" : result.action === "none" ? "noop" : "failed";
      const autoActionError =
        result.applied || result.action === "none"
          ? null
          : result.errorMessage ?? "Auto action did not produce a queue mutation.";
      const autoActionFailureExhausted =
        autoActionStatus === "failed" && autoActionAttemptCount >= candidate.policy.maxAutoActionFailures;

      await db
        .update(itemFulfillmentAnomalies)
        .set({
          autoActionAttemptCount,
          lastAutoAction: result.action !== "none" ? result.action : anomaly.lastAutoAction,
          lastAutoActionAt: now(),
          lastAutoActionStatus: autoActionStatus,
          lastAutoActionError: autoActionError,
          escalationStrategy: autoActionFailureExhausted
            ? candidate.policy.failureEscalationStrategy
            : anomaly.escalationStrategy ?? candidate.policy.escalationStrategy,
          nextAlertEligibleAt: autoActionFailureExhausted ? now() : anomaly.nextAlertEligibleAt,
          lastAlertReason: autoActionFailureExhausted
            ? buildFulfillmentAnomalyAutoActionFailureReason({
                anomalyId: candidate.anomalyId,
                action: result.action,
                attemptCount: autoActionAttemptCount,
                maxAutoActionFailures: candidate.policy.maxAutoActionFailures,
                failureEscalationStrategy: candidate.policy.failureEscalationStrategy,
                policyKey: candidate.policy.key,
              })
            : anomaly.lastAlertReason,
        })
        .where(eq(itemFulfillmentAnomalies.id, candidate.anomalyId));
        await enqueueOutboxEvent("item.anomalyAutoActionApplied", {
          anomalyId: candidate.anomalyId,
          itemId: anomaly.itemId,
          reportId: anomaly.reportId,
          reviewId: anomaly.reviewId,
        policyKey: anomaly.policyKey ?? candidate.policy.key,
          escalationStrategy: autoActionFailureExhausted
            ? candidate.policy.failureEscalationStrategy
            : anomaly.escalationStrategy ?? candidate.policy.escalationStrategy,
          autoAction: candidate.effectiveAutoAction,
          autoActionTemplateKey: candidate.effectiveAutoActionTemplateKey,
          autoActionStatus,
          autoActionError,
          autoActionResult: result.action,
        });
      if (autoActionFailureExhausted) {
        await enqueueOutboxEvent("item.anomalyEscalated", {
          anomalyId: candidate.anomalyId,
          itemId: anomaly.itemId,
          reportId: anomaly.reportId,
          reviewId: anomaly.reviewId,
          kind: anomaly.kind,
          severity: anomaly.severity,
          alertLevel: anomaly.alertLevel,
          policyKey: anomaly.policyKey ?? candidate.policy.key,
          escalationStrategy: candidate.policy.failureEscalationStrategy,
        });
      }
    }
  }

  return {
    scannedCount: rows.length,
    escalatedCount,
    unchangedCount,
    affectedIds,
  };
}

export async function releaseItemManualReview(
  operatorUserId: string,
  reviewId: string,
): Promise<ItemManualReviewView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can release manual reviews");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item_manual_reviews where id = ${reviewId} for update`);
    const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, reviewId));
    if (!review) {
      throw new NotFoundError("Manual review not found");
    }
    if (review.status !== "open") {
      throw new ConflictError("Only open manual reviews can be released");
    }
    if (!review.assigneeUserId) {
      throw new ConflictError("Manual review is not currently claimed");
    }
    if (review.assigneeUserId !== operatorUserId) {
      throw new UnauthorizedError("Only the claiming operator can release this manual review");
    }

    const [updated] = await tx
      .update(itemManualReviews)
      .set({
        assigneeUserId: null,
        claimedAt: null,
        lastClaimReleasedAt: now(),
        lastClaimReleaseReason: "operator_release",
      })
      .where(eq(itemManualReviews.id, review.id))
      .returning();

    await recordManualReviewAssignmentEventInTx(tx, {
      review,
      actorUserId: operatorUserId,
      action: "release",
      fromAssigneeUserId: review.assigneeUserId,
      toAssigneeUserId: null,
      note: "Operator released the claimed manual review back to the queue.",
    });

    const [report] = await tx.select().from(itemIssueReports).where(eq(itemIssueReports.id, updated.reportId));
    const assignmentHistoryMap = await buildManualReviewAssignmentHistoryMap([updated.id], tx);
    return toItemManualReviewView(updated, report, now(), operatorUserId, assignmentHistoryMap.get(updated.id) ?? []);
  });
}

export async function releaseStaleItemManualReviews(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 25, 100));
  const staleHours = Math.max(1, env.manualReviewStaleClaimHours);

  return db.transaction(async (tx) => {
    const rows = await tx.execute<{
      id: string;
      item_id: string;
      report_id: string;
    }>(sql`
      select id, item_id, report_id
      from item_manual_reviews
      where status = 'open'
        and assignee_user_id is not null
        and claimed_at is not null
        and claimed_at <= now() - (${staleHours} * interval '1 hour')
      order by claimed_at asc
      limit ${limit}
      for update skip locked
    `);

    const releasedReviewIds: string[] = [];
    for (const row of rows.rows) {
      const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, row.id));
      if (!review || review.status !== "open" || !review.assigneeUserId || !review.claimedAt) {
        continue;
      }
      if (!isManualReviewClaimStale(review.claimedAt, now())) {
        continue;
      }

      const timestamp = now();
      await tx
        .update(itemManualReviews)
        .set({
          assigneeUserId: null,
          claimedAt: null,
          lastClaimReleasedAt: timestamp,
          lastClaimReleaseReason: "stale_timeout_release",
        })
        .where(eq(itemManualReviews.id, review.id));

      await recordManualReviewAssignmentEventInTx(tx, {
        review,
        actorUserId: "system:manual-review-stale-release",
        action: "stale_release",
        fromAssigneeUserId: review.assigneeUserId,
        toAssigneeUserId: null,
        note: `Claim auto-released after exceeding the ${staleHours}-hour stale threshold.`,
      });

      await enqueueOutboxEvent(
        "item.manualReviewReleased",
        {
          itemId: review.itemId,
          reviewId: review.id,
          reportId: review.reportId,
          releaseReason: "stale_timeout_release",
        },
        tx,
      );
      const ageHours = getManualReviewAgeHours(review.createdAt, timestamp);
      const priority = getManualReviewPriority({
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        ageHours,
      });
      const slaPolicy = getManualReviewSlaPolicy({
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        priority,
      });
      const anomalyRuleState = getManualReviewSlaAnomalyRuleState({
        ageHours,
        anomalyKind: "stale_manual_review",
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        priority,
        slaPolicy,
        referenceTime: timestamp,
      });
      await upsertFulfillmentAnomalyInTx({
        tx,
        itemId: review.itemId,
        reportId: review.reportId,
        reviewId: review.id,
        kind: "stale_manual_review",
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        policyKeyOverride: anomalyRuleState.anomalyPolicyKey,
        severityOverride: anomalyRuleState.severity,
        escalationStrategyOverride: anomalyRuleState.anomalyEscalationStrategy,
        alertLevelOverride: anomalyRuleState.alertLevel,
        nextAlertEligibleAtOverride: anomalyRuleState.nextAlertEligibleAt,
        nextEscalationAtOverride: anomalyRuleState.nextEscalationAt,
        autoActionOverride: anomalyRuleState.anomalyAutoAction,
        autoActionTemplateKeyOverride: anomalyRuleState.autoActionTemplateKey,
        summary: "Manual review claim became stale and was auto-released back to the queue.",
        detail: `Claim exceeded the ${staleHours}-hour stale threshold and was auto-released.${anomalyRuleState.matchedStageKey ? ` Applied SLA anomaly stage ${anomalyRuleState.matchedStageKey}.` : ""}`,
      });
      releasedReviewIds.push(review.id);
    }

    return {
      releasedCount: releasedReviewIds.length,
      staleHours,
      reviewIds: releasedReviewIds,
    };
  });
}

export async function markItemListed(args: {
  tx: DbTx;
  itemId: string;
  ownerUserId: string;
}) {
  const [item] = await args.tx.select().from(items).where(eq(items.id, args.itemId));

  if (!item || item.userId !== args.ownerUserId) {
    throw new BadRequestError("资产不存在或不属于当前用户");
  }
  if (item.fulfillmentMode === "maintained_pool" || item.fulfillmentMode === "warranty_delivery") {
    throw new BadRequestError("服务型履约资产当前不可流转");
  }
  if (!item.transferable) {
    throw new BadRequestError("该资产不可流转");
  }
  if (item.status !== "active") {
    throw new BadRequestError("该资产当前不可挂牌");
  }

  await args.tx.update(items).set({ status: "listed" }).where(eq(items.id, item.id));
  return item;
}

export async function releaseListedItem(args: {
  tx: DbTx;
  itemId: string;
  ownerUserId: string;
}) {
  const [item] = await args.tx.select().from(items).where(eq(items.id, args.itemId));

  if (!item || item.userId !== args.ownerUserId) {
    throw new BadRequestError("资产不存在或不属于当前用户");
  }

  await args.tx.update(items).set({ status: "active" }).where(eq(items.id, item.id));
}

export async function transferMarketplaceItem(args: {
  tx: DbTx;
  itemId: string;
  expectedSellerUserId: string;
  buyerUserId: string;
}) {
  const [item] = await args.tx.select().from(items).where(eq(items.id, args.itemId));

  if (!item || item.userId !== args.expectedSellerUserId || item.status !== "listed") {
    throw new BadRequestError("资产状态已变化，无法完成转移");
  }
  if (item.fulfillmentMode === "maintained_pool" || item.fulfillmentMode === "warranty_delivery") {
    throw new BadRequestError("服务型履约资产当前不可流转");
  }

  await args.tx
    .update(items)
    .set({
      userId: args.buyerUserId,
      status: "active",
    })
    .where(eq(items.id, item.id));
}
