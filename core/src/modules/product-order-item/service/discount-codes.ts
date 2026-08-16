import type {
  ApplyDiscountCodeBatchInput,
  DiscountCodeOperatorMutationResult,
  DiscountCodeBatchMutationResult,
  DiscountCodeOperatorState,
  DiscountCodeOperatorView,
  DiscountCodeView,
  ListOperatorDiscountCodesInput,
  OrderDiscountSource,
  UpsertDiscountCodeInput,
} from "@neuro/contracts";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  discountCodes,
  discountCodeUsages,
  products,
} from "@/modules/product-order-item/schema";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";

import { ensureDefaultProducts } from "./product-catalog";
import {
  getUserForDiscountEvaluation,
  isPlatformOperator,
  matchesUserGroup,
  normalizeOptionalText,
  now,
  type DbTx,
} from "./shared";

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

const DISCOUNT_CODE_HISTORY_ALERT_SCOPE_PRESET = "preset_archive_failure";
const DISCOUNT_CODE_HISTORY_ALERT_SCOPE_CLEANUP = "cleanup_failure";
const DISCOUNT_CODE_HISTORY_ALERT_COOLDOWN_MINUTES = 60;

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

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
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

export async function resolveDiscountForOrder(args: {
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

export async function getDiscountCodeDetail(code: string): Promise<DiscountCodeView | null> {
  await ensureDefaultDiscountCodes();
  const normalizedCode = code.trim().toUpperCase();
  const discountCode = await db.query.discountCodes.findFirst({
    where: (row, operators) => operators.eq(row.code, normalizedCode),
  });
  return discountCode ? toDiscountCodeView(discountCode) : null;
}
