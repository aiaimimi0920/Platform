import type {
  BenefitAssignmentStatus,
  BenefitAssignmentView,
  BenefitApiDeliveryMode,
  BenefitCatalogView,
  BenefitCredentialImportEntryInput,
  BenefitCredentialPoolView,
  BenefitFamilyKey,
  BenefitFamilyView,
  BenefitGrantSourceType,
  BenefitGrantStatus,
  BenefitGrantView,
  BenefitPanelFamilyView,
  BenefitPanelView,
  BenefitProductBindingView,
  BenefitProductOptionView,
  BenefitServiceCardView,
  BenefitServiceApiAccessView,
  BenefitServicePromptCacheSummaryView,
  BenefitServicePromptCacheTrendReportView,
  BenefitServiceStatus,
  BenefitServiceView,
  BenefitUserSearchResult,
  CreateBenefitGrantInput,
  ImportBenefitCredentialPoolInput,
  UpsertBenefitFamilyInput,
  UpsertBenefitServiceInput,
} from "@neuro/contracts";
import { benefitApiDeliveryModes, benefitFamilyKeys, benefitFamilyTones, benefitRefillDeliveryModes, benefitServiceKinds, benefitServiceStatuses } from "@neuro/contracts";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { ensureInternalUser } from "@/modules/identity/service";
import { authIdentities, users } from "@/modules/identity/schema";
import {
  buildBenefitServiceApiAccessKey,
  resolveBenefitServiceApiAccessPublicBaseUrl,
} from "@/modules/benefits/api-access";
import {
  ensureGatewayBenefitProjectViaRust,
  getGatewayPromptCacheSummaryForProjectViaRust,
  getGatewayPromptCacheTrendReportForProjectViaRust,
  resolveGatewayApiAccessForProjectViaRust,
  rotateGatewayApiAccessForProjectViaRust,
} from "@/modules/benefits/gateway-client";
import {
  benefitCredentialEntries,
  benefitCredentialPools,
  benefitFamilies,
  benefitProductBindings,
  benefitProductLines,
  benefitServiceApiAccessKeys,
  benefitServices,
  benefitUserAssignments,
  benefitUserGrants,
} from "@/modules/benefits/schema";
import {
  getCredentialAssignmentSummariesForUser,
  importCredentialPoolForOperator,
  listOperatorCredentialPoolCatalog,
  readBenefitCredentialConfig,
  rotateCredentialAssignmentForOperator,
} from "@/modules/credential-pools/service";
import { items, products } from "@/modules/product-order-item/schema";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";

const DEFAULT_CODEX_SERVICE_ID = "benefit-service-codex";
const DEFAULT_CODEX_REFILL_SERVICE_ID = "benefit-service-codex-refill";
const DEFAULT_CODEX_API_SERVICE_ID = "benefit-service-codex-api";
const DEFAULT_CODEX_REFILL_PRODUCT_ID = "product_codex_refill_1d";
const DEFAULT_CODEX_API_PRODUCT_ID = "product_codex_api_1d";
const LEGACY_CODEX_PRODUCT_ID = "product_vip_30";

const FAMILY_SEEDS: Array<{
  key: BenefitFamilyKey;
  title: string;
  tone: (typeof benefitFamilyTones)[number];
  description: string | null;
  sortOrder: number;
}> = [
  {
    key: "artificial_intelligence",
    title: "人工智能",
    tone: "signal",
    description: "以账号、密钥、接口与服务控制卡为主的人工智能权益。",
    sortOrder: 10,
  },
  {
    key: "network_search",
    title: "网络搜索",
    tone: "cyan",
    description: null,
    sortOrder: 20,
  },
  {
    key: "network_proxy",
    title: "网络代理",
    tone: "ink",
    description: null,
    sortOrder: 30,
  },
];

function now() {
  return new Date();
}

function getPlatformOperatorUserIdSet() {
  return new Set(
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function assertPlatformOperator(userId: string, providerUserId?: string | null) {
  const operatorIds = getPlatformOperatorUserIdSet();
  if (!operatorIds.has(userId) && (!providerUserId || !operatorIds.has(providerUserId))) {
    throw new UnauthorizedError("Only platform operators can manage benefits");
  }
}

function normalizeRequiredText(value: string, fieldLabel: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestError(`${fieldLabel}不能为空。`);
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`${fieldLabel}长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`说明长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizePositiveInt(value: number, fieldLabel: string, maxValue = 1_000_000) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new BadRequestError(`${fieldLabel}必须是非负整数。`);
  }
  if (value > maxValue) {
    throw new BadRequestError(`${fieldLabel}不能超过 ${maxValue}。`);
  }
  return value;
}

function normalizeFamilyKey(value: string): BenefitFamilyKey {
  if (benefitFamilyKeys.includes(value as BenefitFamilyKey)) {
    return value as BenefitFamilyKey;
  }
  throw new BadRequestError("权益族无效。");
}

function normalizeFamilyTone(value: string) {
  if (benefitFamilyTones.includes(value as (typeof benefitFamilyTones)[number])) {
    return value as (typeof benefitFamilyTones)[number];
  }
  throw new BadRequestError("权益族视觉语气无效。");
}

function normalizeServiceStatus(value: string): BenefitServiceStatus {
  if (benefitServiceStatuses.includes(value as BenefitServiceStatus)) {
    return value as BenefitServiceStatus;
  }
  throw new BadRequestError("服务状态无效。");
}

function normalizeRefillDeliveryMode(value: string | null | undefined) {
  if (value && benefitRefillDeliveryModes.includes(value as (typeof benefitRefillDeliveryModes)[number])) {
    return value as (typeof benefitRefillDeliveryModes)[number];
  }
  return "direct_credential";
}

function normalizeApiDeliveryMode(value: string | null | undefined): BenefitApiDeliveryMode {
  if (value && benefitApiDeliveryModes.includes(value as BenefitApiDeliveryMode)) {
    return value as BenefitApiDeliveryMode;
  }
  return "service_proxy";
}

function buildDefaultCodexConfig() {
  return {
    title: "codex",
    providerKey: "platform_a",
    assignmentMode: "sticky",
    payloadSchemaVersion: "credential-v1",
    refillDeliveryMode: "direct_credential",
    refillModeText: "无限续杯",
    availabilityLabel: "可用账号数",
    availabilityText: "30/30",
    apiDeliveryMode: "service_proxy",
    apiModeText: "无限调用",
    apiUrl: "https://xxxx",
    downloadEnabled: true,
    downloadUrl: null,
  } satisfies UpsertBenefitServiceInput["config"];
}

function normalizeServiceConfig(input: UpsertBenefitServiceInput["config"]) {
  const config = readBenefitCredentialConfig(input);
  return {
    title: normalizeRequiredText(config.title, "服务标题", 80),
    providerKey: config.providerKey,
    assignmentMode: config.assignmentMode,
    payloadSchemaVersion: config.payloadSchemaVersion,
    refillDeliveryMode: normalizeRefillDeliveryMode(config.refillDeliveryMode),
    refillModeText: normalizeRequiredText(config.refillModeText, "续杯模式文案", 80),
    availabilityLabel: normalizeRequiredText(config.availabilityLabel, "可用账号标签", 80),
    availabilityText: normalizeRequiredText(config.availabilityText, "可用账号内容", 80),
    apiDeliveryMode: normalizeApiDeliveryMode(config.apiDeliveryMode),
    apiModeText: normalizeRequiredText(config.apiModeText, "调用模式文案", 80),
    apiUrl: normalizeRequiredText(config.apiUrl, "API 网址", 500),
    downloadEnabled: Boolean(config.downloadEnabled),
    downloadUrl: normalizeOptionalText(config.downloadUrl, 1_000),
  };
}

function toBenefitFamilyView(
  row: typeof benefitFamilies.$inferSelect,
  serviceCount: number,
  actionableServiceCount: number,
): BenefitFamilyView {
  return {
    key: row.key as BenefitFamilyKey,
    title: row.title,
    tone: row.tone as BenefitFamilyView["tone"],
    description: row.description,
    sortOrder: row.sortOrder,
    serviceCount,
    actionableServiceCount,
  };
}

function toBenefitServiceView(row: typeof benefitServices.$inferSelect): BenefitServiceView {
  const config = readBenefitCredentialConfig(row.config);
  return {
    id: row.id,
    familyKey: row.familyKey as BenefitFamilyKey,
    productLineId: row.productLineId ?? null,
    serviceKind: row.serviceKind as BenefitServiceView["serviceKind"],
    status: row.status as BenefitServiceStatus,
    title: row.title,
    sortOrder: row.sortOrder,
    config,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

type BenefitProductBindingRow = typeof benefitProductBindings.$inferSelect & {
  productTitle: string;
};

function toBenefitProductBindingView(row: BenefitProductBindingRow): BenefitProductBindingView {
  return {
    id: row.id,
    serviceId: row.serviceId,
    productId: row.productId,
    productTitle: row.productTitle,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

type BenefitGrantRow = typeof benefitUserGrants.$inferSelect & {
  username: string | null;
  providerUserId: string | null;
};

function toBenefitGrantView(row: BenefitGrantRow): BenefitGrantView {
  return {
    id: row.id,
    serviceId: row.serviceId,
    userId: row.userId,
    username: row.username,
    providerUserId: row.providerUserId,
    sourceType: row.sourceType as BenefitGrantSourceType,
    status: row.status as BenefitGrantStatus,
    sourceItemId: row.sourceItemId,
    sourceOrderId: row.sourceOrderId,
    grantedByUserId: row.grantedByUserId,
    grantedAt: row.grantedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revokedByUserId: row.revokedByUserId,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    durationDays: row.durationDays ?? null,
  };
}

type BenefitAssignmentRow = {
  id: string;
  serviceId: string;
  userId: string;
  username: string | null;
  providerUserId: string | null;
  status: string;
  credentialEntryId: string | null;
  providerKey: string | null;
  assignmentMode: string | null;
  credentialSummary: BenefitAssignmentView["credentialSummary"];
  updatedAt: Date;
  assignedAt: Date | null;
  releasedAt: Date | null;
  revokedAt: Date | null;
};

function toBenefitAssignmentView(row: BenefitAssignmentRow): BenefitAssignmentView {
  return {
    id: row.id,
    serviceId: row.serviceId,
    userId: row.userId,
    username: row.username,
    providerUserId: row.providerUserId,
    status: row.status as BenefitAssignmentStatus,
    credentialEntryId: row.credentialEntryId,
    providerKey: (row.providerKey ?? "platform_a") as BenefitAssignmentView["providerKey"],
    assignmentMode: (row.assignmentMode ?? "sticky") as BenefitAssignmentView["assignmentMode"],
    credentialSummary: row.credentialSummary,
    updatedAt: row.updatedAt.toISOString(),
    assignedAt: row.assignedAt ? row.assignedAt.toISOString() : null,
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

type BenefitCredentialPoolRow = typeof benefitCredentialPools.$inferSelect & {
  availableCount: number;
  assignedCount: number;
  revokedCount: number;
};

function toBenefitCredentialPoolView(row: BenefitCredentialPoolRow): BenefitCredentialPoolView {
  return {
    id: row.id,
    serviceId: row.serviceId,
    label: row.label,
    importNote: row.importNote,
    entryCount: row.entryCount,
    availableCount: row.availableCount,
    assignedCount: row.assignedCount,
    revokedCount: row.revokedCount,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getBenefitServiceRowById(serviceId: string) {
  const [row] = await db.select().from(benefitServices).where(eq(benefitServices.id, serviceId)).limit(1);
  return row ?? null;
}

async function getBenefitGrantRowById(grantId: string) {
  const [row] = await db.select().from(benefitUserGrants).where(eq(benefitUserGrants.id, grantId)).limit(1);
  return row ?? null;
}

async function getBenefitProductBindingRowById(bindingId: string) {
  const [row] = await db
    .select()
    .from(benefitProductBindings)
    .where(eq(benefitProductBindings.id, bindingId))
    .limit(1);
  return row ?? null;
}

async function listBenefitFamilyRows() {
  return db.select().from(benefitFamilies).orderBy(asc(benefitFamilies.sortOrder), asc(benefitFamilies.key));
}

async function listBenefitServiceRows() {
  return db
    .select()
    .from(benefitServices)
    .orderBy(asc(benefitServices.familyKey), asc(benefitServices.sortOrder), asc(benefitServices.createdAt));
}

async function listBenefitProductBindingRows(): Promise<BenefitProductBindingRow[]> {
  const rows = await db
    .select({
      id: benefitProductBindings.id,
      serviceId: benefitProductBindings.serviceId,
      productId: benefitProductBindings.productId,
      createdByUserId: benefitProductBindings.createdByUserId,
      createdAt: benefitProductBindings.createdAt,
      productTitle: products.title,
    })
    .from(benefitProductBindings)
    .innerJoin(products, eq(benefitProductBindings.productId, products.id))
    .orderBy(asc(benefitProductBindings.serviceId), asc(products.title));

  return rows.map((row) => ({
    ...row,
    productTitle: row.productTitle,
  })) as BenefitProductBindingRow[];
}

async function listBenefitProductOptionRows(): Promise<BenefitProductOptionView[]> {
  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      fulfillmentMode: products.fulfillmentMode,
      active: products.active,
    })
    .from(products)
    .orderBy(desc(products.active), asc(products.title));

  return rows;
}

async function listBenefitGrantRows(limit = 200): Promise<BenefitGrantRow[]> {
  const rows = await db
    .select({
      id: benefitUserGrants.id,
      serviceId: benefitUserGrants.serviceId,
      userId: benefitUserGrants.userId,
      sourceType: benefitUserGrants.sourceType,
      sourceKey: benefitUserGrants.sourceKey,
      sourceOrderId: benefitUserGrants.sourceOrderId,
      sourceItemId: benefitUserGrants.sourceItemId,
      status: benefitUserGrants.status,
      grantedByUserId: benefitUserGrants.grantedByUserId,
      grantedAt: benefitUserGrants.grantedAt,
      updatedAt: benefitUserGrants.updatedAt,
      revokedAt: benefitUserGrants.revokedAt,
      revokedByUserId: benefitUserGrants.revokedByUserId,
      username: users.username,
      providerUserId: authIdentities.providerUserId,
    })
    .from(benefitUserGrants)
    .innerJoin(users, eq(benefitUserGrants.userId, users.id))
    .leftJoin(authIdentities, and(eq(authIdentities.userId, users.id), eq(authIdentities.provider, "linuxdo")))
    .orderBy(desc(benefitUserGrants.grantedAt))
    .limit(limit);

  return rows as BenefitGrantRow[];
}

async function listBenefitAssignmentRows(limit = 200): Promise<BenefitAssignmentRow[]> {
  const rows = await db
    .select({
      id: benefitUserAssignments.id,
      serviceId: benefitUserAssignments.serviceId,
      userId: benefitUserAssignments.userId,
      credentialEntryId: benefitUserAssignments.credentialEntryId,
      status: benefitUserAssignments.status,
      assignedAt: benefitUserAssignments.assignedAt,
      updatedAt: benefitUserAssignments.updatedAt,
      revokedAt: benefitUserAssignments.revokedAt,
      releasedAt: sql<Date | null>`null`,
      username: users.username,
      providerUserId: authIdentities.providerUserId,
      providerKey: sql<string>`'platform_a'`,
      assignmentMode: sql<string>`'sticky'`,
      credentialSummary: sql<BenefitAssignmentView["credentialSummary"]>`null`,
    })
    .from(benefitUserAssignments)
    .innerJoin(users, eq(benefitUserAssignments.userId, users.id))
    .leftJoin(authIdentities, and(eq(authIdentities.userId, users.id), eq(authIdentities.provider, "linuxdo")))
    .leftJoin(benefitCredentialEntries, eq(benefitUserAssignments.credentialEntryId, benefitCredentialEntries.id))
    .orderBy(desc(benefitUserAssignments.updatedAt))
    .limit(limit);

  return rows as unknown as BenefitAssignmentRow[];
}

async function listBenefitCredentialPoolRows(): Promise<BenefitCredentialPoolRow[]> {
  const rows = await db
    .select({
      id: benefitCredentialPools.id,
      serviceId: benefitCredentialPools.serviceId,
      label: benefitCredentialPools.label,
      importNote: benefitCredentialPools.importNote,
      entryCount: benefitCredentialPools.entryCount,
      createdByUserId: benefitCredentialPools.createdByUserId,
      createdAt: benefitCredentialPools.createdAt,
      availableCount: sql<number>`coalesce(sum(case when ${benefitCredentialEntries.status} = 'available' then 1 else 0 end), 0)`,
      assignedCount: sql<number>`coalesce(sum(case when ${benefitCredentialEntries.status} = 'assigned' then 1 else 0 end), 0)`,
      revokedCount: sql<number>`coalesce(sum(case when ${benefitCredentialEntries.status} = 'revoked' then 1 else 0 end), 0)`,
    })
    .from(benefitCredentialPools)
    .leftJoin(benefitCredentialEntries, eq(benefitCredentialPools.id, benefitCredentialEntries.poolId))
    .groupBy(
      benefitCredentialPools.id,
      benefitCredentialPools.serviceId,
      benefitCredentialPools.label,
      benefitCredentialPools.importNote,
      benefitCredentialPools.entryCount,
      benefitCredentialPools.createdByUserId,
      benefitCredentialPools.createdAt,
    )
    .orderBy(desc(benefitCredentialPools.createdAt));

  return rows.map((row) => ({
    ...row,
    availableCount: Number(row.availableCount ?? 0),
    assignedCount: Number(row.assignedCount ?? 0),
    revokedCount: Number(row.revokedCount ?? 0),
  })) as BenefitCredentialPoolRow[];
}

export async function ensureBenefitCatalogSeeded() {
  const timestamp = now();

  for (const family of FAMILY_SEEDS) {
    await db
      .insert(benefitFamilies)
      .values({
        key: family.key,
        title: family.title,
        tone: family.tone,
        description: family.description,
        sortOrder: family.sortOrder,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: benefitFamilies.key,
        set: {
          title: family.title,
          tone: family.tone,
          description: family.description,
          sortOrder: family.sortOrder,
          updatedAt: timestamp,
        },
      });
  }

  // Product line: Codex
  const CODEX_PRODUCT_LINE_ID = "pl-codex";
  await db
    .insert(benefitProductLines)
    .values({
      id: CODEX_PRODUCT_LINE_ID,
      familyKey: "artificial_intelligence",
      name: "codex",
      displayName: "Codex",
      description: "OpenAI Codex 系列 AI 编程助手",
      sortOrder: 10,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing({ target: benefitProductLines.id });

  // Legacy single service (keep for backward compat, set to draft)
  await db
    .insert(benefitServices)
    .values({
      id: DEFAULT_CODEX_SERVICE_ID,
      familyKey: "artificial_intelligence",
      productLineId: CODEX_PRODUCT_LINE_ID,
      serviceKind: "credential_service_v1",
      status: "draft",
      title: "codex (legacy)",
      sortOrder: 99,
      config: buildDefaultCodexConfig(),
      createdByUserId: null,
      updatedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    })
    .onConflictDoNothing({ target: benefitServices.id });

  // Refill service (补号/续杯)
  await db
    .insert(benefitServices)
    .values({
      id: DEFAULT_CODEX_REFILL_SERVICE_ID,
      familyKey: "artificial_intelligence",
      productLineId: CODEX_PRODUCT_LINE_ID,
      serviceKind: "credential_service_v1",
      status: "active",
      title: "无限续杯",
      sortOrder: 10,
      config: {
        title: "无限续杯",
        providerKey: "platform_a",
        assignmentMode: "sticky",
        payloadSchemaVersion: "credential-v1",
        refillDeliveryMode: "direct_credential",
        refillModeText: "无限续杯",
        availabilityLabel: "可用账号数",
        availabilityText: "30/30",
        apiDeliveryMode: "direct_credential",
        apiModeText: "—",
        apiUrl: "",
        downloadEnabled: true,
        downloadUrl: null,
      } satisfies UpsertBenefitServiceInput["config"],
      createdByUserId: null,
      updatedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    })
    .onConflictDoNothing({ target: benefitServices.id });

  // API service (转发/调用)
  await db
    .insert(benefitServices)
    .values({
      id: DEFAULT_CODEX_API_SERVICE_ID,
      familyKey: "artificial_intelligence",
      productLineId: CODEX_PRODUCT_LINE_ID,
      serviceKind: "credential_service_v1",
      status: "active",
      title: "无限调用",
      sortOrder: 20,
      config: {
        title: "无限调用",
        providerKey: "platform_a",
        assignmentMode: "sticky",
        payloadSchemaVersion: "credential-v1",
        refillDeliveryMode: "direct_credential",
        refillModeText: "—",
        availabilityLabel: "—",
        availabilityText: "—",
        apiDeliveryMode: "service_proxy",
        apiModeText: "无限调用",
        apiUrl: "https://xxxx",
        downloadEnabled: false,
        downloadUrl: null,
      } satisfies UpsertBenefitServiceInput["config"],
      createdByUserId: null,
      updatedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    })
    .onConflictDoNothing({ target: benefitServices.id });

  // Backfill: link existing services to codex product line
  for (const svcId of [DEFAULT_CODEX_SERVICE_ID, DEFAULT_CODEX_REFILL_SERVICE_ID, DEFAULT_CODEX_API_SERVICE_ID]) {
    await db
      .update(benefitServices)
      .set({ productLineId: CODEX_PRODUCT_LINE_ID })
      .where(and(eq(benefitServices.id, svcId), isNull(benefitServices.productLineId)));
  }

  // Force legacy codex service to archived (it was replaced by refill + api services)
  await db
    .update(benefitServices)
    .set({ status: "archived", archivedAt: timestamp })
    .where(and(eq(benefitServices.id, DEFAULT_CODEX_SERVICE_ID), eq(benefitServices.status, "active")));

  // Remove legacy product bindings (product_vip_30 → refill/api services)
  await db
    .delete(benefitProductBindings)
    .where(
      and(
        inArray(benefitProductBindings.serviceId, [DEFAULT_CODEX_REFILL_SERVICE_ID, DEFAULT_CODEX_API_SERVICE_ID]),
        eq(benefitProductBindings.productId, LEGACY_CODEX_PRODUCT_ID),
      ),
    );

  // Bind correct products: refill → codex_refill_1d, api → codex_api_1d
  const productBindingPairs = [
    { serviceId: DEFAULT_CODEX_REFILL_SERVICE_ID, productId: DEFAULT_CODEX_REFILL_PRODUCT_ID },
    { serviceId: DEFAULT_CODEX_API_SERVICE_ID, productId: DEFAULT_CODEX_API_PRODUCT_ID },
  ];

  for (const pair of productBindingPairs) {
    const [productExists] = await db.select({ id: products.id }).from(products).where(eq(products.id, pair.productId)).limit(1);
    if (productExists) {
      await db
        .insert(benefitProductBindings)
        .values({
          id: crypto.randomUUID(),
          serviceId: pair.serviceId,
          productId: pair.productId,
          createdByUserId: null,
          createdAt: timestamp,
        })
        .onConflictDoNothing({
          target: [benefitProductBindings.serviceId, benefitProductBindings.productId],
        });
    }
  }
}

export async function listOperatorBenefitCatalog(
  operatorUserId: string,
  providerUserId?: string | null,
): Promise<BenefitCatalogView> {
  assertPlatformOperator(operatorUserId, providerUserId);

  const [familyRows, productLineRows, serviceRows, bindingRows, productRows, grantRows, credentialCatalog] = await Promise.all([
    listBenefitFamilyRows(),
    db.select().from(benefitProductLines).orderBy(asc(benefitProductLines.sortOrder)),
    listBenefitServiceRows(),
    listBenefitProductBindingRows(),
    listBenefitProductOptionRows(),
    listBenefitGrantRows(),
    listOperatorCredentialPoolCatalog(operatorUserId, providerUserId),
  ]);

  const activeServiceCountByFamily = new Map<string, number>();
  const serviceCountByFamily = new Map<string, number>();
  for (const service of serviceRows) {
    serviceCountByFamily.set(service.familyKey, (serviceCountByFamily.get(service.familyKey) ?? 0) + 1);
    if (service.status === "active") {
      activeServiceCountByFamily.set(service.familyKey, (activeServiceCountByFamily.get(service.familyKey) ?? 0) + 1);
    }
  }

  const serviceCountByProductLine = new Map<string, number>();
  for (const service of serviceRows) {
    if (service.productLineId) {
      serviceCountByProductLine.set(service.productLineId, (serviceCountByProductLine.get(service.productLineId) ?? 0) + 1);
    }
  }

  return {
    families: familyRows.map((row) =>
      toBenefitFamilyView(
        row,
        serviceCountByFamily.get(row.key) ?? 0,
        activeServiceCountByFamily.get(row.key) ?? 0,
      ),
    ),
    productLines: productLineRows.map((pl) => ({
      id: pl.id,
      familyKey: pl.familyKey as BenefitFamilyKey,
      name: pl.name,
      displayName: pl.displayName,
      description: pl.description,
      sortOrder: pl.sortOrder,
      status: pl.status,
      serviceCount: serviceCountByProductLine.get(pl.id) ?? 0,
      createdAt: pl.createdAt.toISOString(),
      updatedAt: pl.updatedAt.toISOString(),
    })),
    services: serviceRows.map(toBenefitServiceView),
    products: productRows,
    productBindings: bindingRows.map(toBenefitProductBindingView),
    grants: grantRows.map(toBenefitGrantView),
    assignments: credentialCatalog.assignments.map((assignment) =>
      toBenefitAssignmentView({
        id: assignment.id,
        serviceId: assignment.benefitServiceId,
        userId: assignment.userId,
        username: assignment.username,
        providerUserId: assignment.providerUserId,
        status: assignment.status,
        credentialEntryId: assignment.credentialEntryId,
        providerKey: assignment.providerKey,
        assignmentMode: assignment.assignmentMode,
        credentialSummary: assignment.maskedSummary
          ? {
              serviceId: assignment.benefitServiceId,
              providerKey: assignment.providerKey,
              assignmentMode: assignment.assignmentMode,
              credentialReady: assignment.status === "active",
              credentialEntryId: assignment.credentialEntryId,
              scope: null,
              lifecycleStatus: null,
              maskedSummary: assignment.maskedSummary,
              previewLabel: null,
              apiUrl: null,
              updatedAt: assignment.updatedAt,
            }
          : null,
        updatedAt: new Date(assignment.updatedAt),
        assignedAt: assignment.assignedAt ? new Date(assignment.assignedAt) : null,
        releasedAt: assignment.releasedAt ? new Date(assignment.releasedAt) : null,
        revokedAt: assignment.revokedAt ? new Date(assignment.revokedAt) : null,
      }),
    ),
    credentialPools: credentialCatalog.uploadBatches.map((batch) => ({
      id: batch.id,
      serviceId: batch.benefitServiceId ?? "",
      label: batch.label,
      importNote: batch.importNote,
      entryCount: batch.acceptedCount,
      availableCount: batch.acceptedCount,
      assignedCount: 0,
      revokedCount: batch.rejectedCount,
      createdByUserId: batch.createdByUserId,
      createdAt: batch.createdAt,
    })),
  };
}

export async function listOperatorBenefitProductBindings(
  operatorUserId: string,
  providerUserId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  return (await listBenefitProductBindingRows()).map(toBenefitProductBindingView);
}

export async function listOperatorBenefitGrants(operatorUserId: string, providerUserId?: string | null) {
  assertPlatformOperator(operatorUserId, providerUserId);
  return (await listBenefitGrantRows()).map(toBenefitGrantView);
}

export async function listOperatorBenefitAssignments(operatorUserId: string, providerUserId?: string | null) {
  assertPlatformOperator(operatorUserId, providerUserId);
  return (await listOperatorBenefitCatalog(operatorUserId, providerUserId)).assignments;
}

export async function listOperatorBenefitCredentialPools(operatorUserId: string, providerUserId?: string | null) {
  assertPlatformOperator(operatorUserId, providerUserId);
  return (await listOperatorBenefitCatalog(operatorUserId, providerUserId)).credentialPools;
}

async function listActiveGrantRowsForUserService(tx: any, userId: string, serviceId: string) {
  return tx
    .select()
    .from(benefitUserGrants)
    .where(
      and(
        eq(benefitUserGrants.userId, userId),
        eq(benefitUserGrants.serviceId, serviceId),
        eq(benefitUserGrants.status, "active"),
      ),
    );
}

async function getAssignmentRowForUserService(tx: any, userId: string, serviceId: string) {
  const [row] = await tx
    .select()
    .from(benefitUserAssignments)
    .where(and(eq(benefitUserAssignments.userId, userId), eq(benefitUserAssignments.serviceId, serviceId)))
    .limit(1);
  return row ?? null;
}

async function assertUserHasActiveBenefitGrantInTx(tx: any, userId: string, serviceId: string) {
  const grants = await listActiveGrantRowsForUserService(tx, userId, serviceId);
  const currentTime = now();
  const validGrants = grants.filter((g: typeof benefitUserGrants.$inferSelect) => !g.expiresAt || g.expiresAt > currentTime);
  if (validGrants.length === 0) {
    throw new NotFoundError("当前用户尚未获得该服务资格，或已过期。请购买后使用。");
  }
}

async function getActiveBenefitServiceApiAccessKeyInTx(tx: any, userId: string, serviceId: string) {
  const [row] = await tx
    .select()
    .from(benefitServiceApiAccessKeys)
    .where(
      and(
        eq(benefitServiceApiAccessKeys.userId, userId),
        eq(benefitServiceApiAccessKeys.serviceId, serviceId),
        eq(benefitServiceApiAccessKeys.status, "active"),
      ),
    )
    .orderBy(desc(benefitServiceApiAccessKeys.createdAt), desc(benefitServiceApiAccessKeys.id))
    .limit(1);
  return row ?? null;
}

async function createBenefitServiceApiAccessKeyInTx(
  tx: any,
  args: {
    serviceId: string;
    userId: string;
    rotatedFromAccessKeyId?: string | null;
    timestamp: Date;
  },
) {
  const [created] = await tx
    .insert(benefitServiceApiAccessKeys)
    .values({
      id: crypto.randomUUID(),
      serviceId: args.serviceId,
      userId: args.userId,
      status: "active",
      rotatedFromAccessKeyId: args.rotatedFromAccessKeyId ?? null,
      revokedAt: null,
      revokedByUserId: null,
      revokeReason: null,
      createdAt: args.timestamp,
      updatedAt: args.timestamp,
    })
    .returning();
  return created;
}

async function revokeBenefitServiceApiAccessKeyInTx(
  tx: any,
  row: typeof benefitServiceApiAccessKeys.$inferSelect,
  actorUserId: string,
  reason: string,
  timestamp: Date,
) {
  const [updated] = await tx
    .update(benefitServiceApiAccessKeys)
    .set({
      status: "revoked",
      revokedAt: timestamp,
      revokedByUserId: actorUserId,
      revokeReason: reason,
      updatedAt: timestamp,
    })
    .where(eq(benefitServiceApiAccessKeys.id, row.id))
    .returning();
  return updated ?? row;
}

function buildBenefitServiceApiAccessView(args: {
  row: typeof benefitServiceApiAccessKeys.$inferSelect;
  apiUrl: string | null | undefined;
}): BenefitServiceApiAccessView {
  return {
    serviceId: args.row.serviceId,
    apiUrl: resolveBenefitServiceApiAccessPublicBaseUrl(args.apiUrl),
    apiKey: buildBenefitServiceApiAccessKey({
      accessKeyId: args.row.id,
      serviceId: args.row.serviceId,
      userId: args.row.userId,
    }),
    issuedAt: args.row.createdAt.toISOString(),
    deliveryMode: "service_proxy",
  };
}

async function getCredentialEntryRowById(tx: any, entryId: string) {
  const [row] = await tx
    .select()
    .from(benefitCredentialEntries)
    .where(eq(benefitCredentialEntries.id, entryId))
    .limit(1);
  return row ?? null;
}

async function getNextAvailableCredentialEntry(tx: any, serviceId: string) {
  const [row] = await tx
    .select()
    .from(benefitCredentialEntries)
    .where(and(eq(benefitCredentialEntries.serviceId, serviceId), eq(benefitCredentialEntries.status, "available")))
    .orderBy(asc(benefitCredentialEntries.createdAt), asc(benefitCredentialEntries.id))
    .limit(1);
  return row ?? null;
}

async function revokeCredentialEntryInTx(tx: any, entryId: string, revokedAt: Date) {
  await tx
    .update(benefitCredentialEntries)
    .set({
      status: "revoked",
      revokedAt,
      updatedAt: revokedAt,
    })
    .where(eq(benefitCredentialEntries.id, entryId));
}

async function upsertPendingAssignmentInTx(tx: any, userId: string, serviceId: string, timestamp: Date) {
  const existing = await getAssignmentRowForUserService(tx, userId, serviceId);
  if (existing) {
    const [updated] = await tx
      .update(benefitUserAssignments)
      .set({
        credentialEntryId: null,
        status: "pending",
        assignedAt: null,
        revokedAt: null,
        updatedAt: timestamp,
      })
      .where(eq(benefitUserAssignments.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await tx
    .insert(benefitUserAssignments)
    .values({
      id: crypto.randomUUID(),
      serviceId,
      userId,
      credentialEntryId: null,
      status: "pending",
      assignedAt: null,
      updatedAt: timestamp,
      revokedAt: null,
    })
    .returning();
  return created;
}

async function upsertActiveAssignmentInTx(tx: any, userId: string, serviceId: string, entryId: string, timestamp: Date) {
  const existing = await getAssignmentRowForUserService(tx, userId, serviceId);
  if (existing) {
    const [updated] = await tx
      .update(benefitUserAssignments)
      .set({
        credentialEntryId: entryId,
        status: "active",
        assignedAt: timestamp,
        updatedAt: timestamp,
        revokedAt: null,
      })
      .where(eq(benefitUserAssignments.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await tx
    .insert(benefitUserAssignments)
    .values({
      id: crypto.randomUUID(),
      serviceId,
      userId,
      credentialEntryId: entryId,
      status: "active",
      assignedAt: timestamp,
      updatedAt: timestamp,
      revokedAt: null,
    })
    .returning();
  return created;
}

async function revokeAssignmentIfPresentInTx(tx: any, userId: string, serviceId: string, timestamp: Date) {
  const existing = await getAssignmentRowForUserService(tx, userId, serviceId);
  if (!existing) {
    return null;
  }

  if (existing.credentialEntryId) {
    const entry = await getCredentialEntryRowById(tx, existing.credentialEntryId);
    if (entry && entry.status !== "revoked") {
      await revokeCredentialEntryInTx(tx, entry.id, timestamp);
    }
  }

  const [updated] = await tx
    .update(benefitUserAssignments)
    .set({
      status: "revoked",
      revokedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(benefitUserAssignments.id, existing.id))
    .returning();
  return updated;
}

async function reconcileBenefitAssignmentInTx(tx: any, userId: string, serviceId: string) {
  const timestamp = now();
  const grants = await listActiveGrantRowsForUserService(tx, userId, serviceId);
  if (grants.length === 0) {
    return revokeAssignmentIfPresentInTx(tx, userId, serviceId, timestamp);
  }

  const existing = await getAssignmentRowForUserService(tx, userId, serviceId);
  if (existing?.status === "active" && existing.credentialEntryId) {
    const entry = await getCredentialEntryRowById(tx, existing.credentialEntryId);
    if (entry?.status === "assigned" && entry.assignedUserId === userId) {
      return existing;
    }
  }

  const nextEntry = await getNextAvailableCredentialEntry(tx, serviceId);
  if (!nextEntry) {
    return upsertPendingAssignmentInTx(tx, userId, serviceId, timestamp);
  }

  await tx
    .update(benefitCredentialEntries)
    .set({
      status: "assigned",
      assignedUserId: userId,
      assignedAt: timestamp,
      revokedAt: null,
      updatedAt: timestamp,
    })
    .where(eq(benefitCredentialEntries.id, nextEntry.id));

  return upsertActiveAssignmentInTx(tx, userId, serviceId, nextEntry.id, timestamp);
}

async function backfillAssignmentsForServiceInTx(tx: any, serviceId: string) {
  const activeUsers = await tx
    .select({
      userId: benefitUserGrants.userId,
    })
    .from(benefitUserGrants)
    .where(and(eq(benefitUserGrants.serviceId, serviceId), eq(benefitUserGrants.status, "active")))
    .groupBy(benefitUserGrants.userId);

  for (const row of activeUsers) {
    await reconcileBenefitAssignmentInTx(tx, row.userId, serviceId);
  }
}

function buildPanelServiceCard(args: {
  service: typeof benefitServices.$inferSelect;
  grantedSourceTypes: BenefitGrantSourceType[];
  granted: boolean;
  grantExpiresAt: Date | null;
  assignmentSummary: BenefitServiceCardView["credentialSummary"] | null;
}): BenefitServiceCardView {
  const config = readBenefitCredentialConfig(args.service.config);
  const assignmentStatus = args.granted
    ? ((args.assignmentSummary?.credentialReady ? "active" : "pending") as BenefitAssignmentStatus)
    : ("pending" as BenefitAssignmentStatus);

  return {
    id: args.service.id,
    familyKey: args.service.familyKey as BenefitFamilyKey,
    productLineId: args.service.productLineId ?? null,
    serviceKind: args.service.serviceKind as BenefitServiceCardView["serviceKind"],
    status: args.service.status as BenefitServiceStatus,
    title: args.service.title,
    sortOrder: args.service.sortOrder,
    config,
    assignmentStatus,
    providerKey: config.providerKey,
    assignmentMode: config.assignmentMode,
    credentialReady: args.granted ? Boolean(args.assignmentSummary?.credentialReady) : false,
    credentialSummary: args.granted ? args.assignmentSummary : null,
    downloadEnabled: config.downloadEnabled,
    downloadUrl: config.downloadUrl,
    grantedSourceTypes: args.grantedSourceTypes,
    granted: args.granted,
    grantExpiresAt: args.grantExpiresAt ? args.grantExpiresAt.toISOString() : null,
  };
}

export async function getBenefitPanel(userId: string): Promise<BenefitPanelView> {
  const [familyRows, productLineRows, serviceRows, grantRows, assignmentSummaryByService] = await Promise.all([
    listBenefitFamilyRows(),
    db.select().from(benefitProductLines).where(eq(benefitProductLines.status, "active")).orderBy(asc(benefitProductLines.sortOrder)),
    db
      .select()
      .from(benefitServices)
      .where(eq(benefitServices.status, "active"))
      .orderBy(asc(benefitServices.familyKey), asc(benefitServices.sortOrder), asc(benefitServices.title)),
    db
      .select()
      .from(benefitUserGrants)
      .where(and(eq(benefitUserGrants.userId, userId), eq(benefitUserGrants.status, "active"))),
    getCredentialAssignmentSummariesForUser(userId),
  ]);

  // Build grant info per service (check expiry)
  const currentTime = now();
  const activeGrantInfoByService = new Map<string, { sourceTypes: BenefitGrantSourceType[]; latestExpiresAt: Date | null }>();
  for (const row of grantRows) {
    // Skip expired grants
    if (row.expiresAt && row.expiresAt < currentTime) continue;

    const existing = activeGrantInfoByService.get(row.serviceId);
    const sourceTypes = existing?.sourceTypes ?? [];
    if (!sourceTypes.includes(row.sourceType as BenefitGrantSourceType)) {
      sourceTypes.push(row.sourceType as BenefitGrantSourceType);
    }
    // Track the latest expiry across all grants for this service
    let latestExpiry = existing?.latestExpiresAt ?? null;
    if (row.expiresAt) {
      latestExpiry = latestExpiry ? (row.expiresAt > latestExpiry ? row.expiresAt : latestExpiry) : row.expiresAt;
    }
    activeGrantInfoByService.set(row.serviceId, { sourceTypes, latestExpiresAt: latestExpiry });
  }

  // Build service cards for ALL active services (not just granted ones)
  const allServiceCards: BenefitServiceCardView[] = [];
  for (const service of serviceRows) {
    const grantInfo = activeGrantInfoByService.get(service.id);
    const granted = Boolean(grantInfo?.sourceTypes.length);
    allServiceCards.push(buildPanelServiceCard({
      service,
      grantedSourceTypes: grantInfo?.sourceTypes ?? [],
      granted,
      grantExpiresAt: grantInfo?.latestExpiresAt ?? null,
      assignmentSummary: granted ? (assignmentSummaryByService.get(service.id) ?? null) : null,
    }));
  }

  // Group service cards by family and product line
  const servicesByFamily = new Map<string, BenefitServiceCardView[]>();
  const servicesByProductLine = new Map<string, BenefitServiceCardView[]>();
  for (const card of allServiceCards) {
    // By family
    const familyList = servicesByFamily.get(card.familyKey) ?? [];
    familyList.push(card);
    servicesByFamily.set(card.familyKey, familyList);
    // By product line
    if (card.productLineId) {
      const plList = servicesByProductLine.get(card.productLineId) ?? [];
      plList.push(card);
      servicesByProductLine.set(card.productLineId, plList);
    }
  }

  const families: BenefitPanelFamilyView[] = familyRows.map((row) => {
    const services = (servicesByFamily.get(row.key) ?? []).sort((left, right) => left.sortOrder - right.sortOrder);
    const familyProductLines = productLineRows
      .filter((pl) => pl.familyKey === row.key)
      .map((pl) => ({
        id: pl.id,
        name: pl.name,
        displayName: pl.displayName,
        description: pl.description,
        services: (servicesByProductLine.get(pl.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      }));
    return {
      key: row.key as BenefitFamilyKey,
      title: row.title,
      tone: row.tone as BenefitPanelFamilyView["tone"],
      description: row.description,
      services,
      productLines: familyProductLines,
      actionableServiceCount: services.length,
    };
  });

  return {
    families,
    summary: {
      actionableFamilyCount: families.filter((family) => family.actionableServiceCount > 0).length,
      actionableServiceCount: families.reduce((sum, family) => sum + family.actionableServiceCount, 0),
    },
    generatedAt: now().toISOString(),
  };
}

function assertBenefitServiceSupportsProxyApiAccess(service: typeof benefitServices.$inferSelect) {
  const config = readBenefitCredentialConfig(service.config);
  if (config.apiDeliveryMode !== "service_proxy") {
    throw new ConflictError("当前服务的无限调用不是服务器转发模式。");
  }
  return config;
}

export async function resolveBenefitServiceApiAccessForUser(
  serviceId: string,
  userId: string,
): Promise<BenefitServiceApiAccessView> {
  const service = await getBenefitServiceRowById(serviceId);
  if (!service || service.status !== "active") {
    throw new NotFoundError("服务不存在。");
  }
  const config = assertBenefitServiceSupportsProxyApiAccess(service);

  await db.transaction(async (tx) => {
    await assertUserHasActiveBenefitGrantInTx(tx, userId, serviceId);
  });

  const gatewayProject = await ensureGatewayBenefitProjectViaRust({
    serviceId,
    userId,
    serviceTitle: service.title,
  });
  const access = await resolveGatewayApiAccessForProjectViaRust(
    gatewayProject.project.id,
    `${service.title}-benefit-access`,
  );

  return {
    serviceId,
    apiUrl: resolveBenefitServiceApiAccessPublicBaseUrl(config.apiUrl),
    apiKey: access.token,
    issuedAt: access.apiKey.issuedAt,
    deliveryMode: "service_proxy",
  };
}

export async function rotateBenefitServiceApiAccessForUser(
  serviceId: string,
  userId: string,
): Promise<BenefitServiceApiAccessView> {
  const service = await getBenefitServiceRowById(serviceId);
  if (!service || service.status !== "active") {
    throw new NotFoundError("服务不存在。");
  }
  const config = assertBenefitServiceSupportsProxyApiAccess(service);

  await db.transaction(async (tx) => {
    await assertUserHasActiveBenefitGrantInTx(tx, userId, serviceId);
  });

  const gatewayProject = await ensureGatewayBenefitProjectViaRust({
    serviceId,
    userId,
    serviceTitle: service.title,
  });
  const access = await rotateGatewayApiAccessForProjectViaRust(
    gatewayProject.project.id,
    userId,
    `${service.title}-benefit-access`,
  );

  return {
    serviceId,
    apiUrl: resolveBenefitServiceApiAccessPublicBaseUrl(config.apiUrl),
    apiKey: access.token,
    issuedAt: access.apiKey.issuedAt,
    deliveryMode: "service_proxy",
  };
}

export async function resolveBenefitServicePromptCacheSummaryForUser(
  serviceId: string,
  userId: string,
): Promise<BenefitServicePromptCacheSummaryView> {
  const service = await getBenefitServiceRowById(serviceId);
  if (!service || service.status !== "active") {
    throw new NotFoundError("服务不存在。");
  }
  assertBenefitServiceSupportsProxyApiAccess(service);

  await db.transaction(async (tx) => {
    await assertUserHasActiveBenefitGrantInTx(tx, userId, serviceId);
  });

  const generatedAt = now();
  const windowStart = new Date(generatedAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = generatedAt.toISOString();
  const gatewayProject = await ensureGatewayBenefitProjectViaRust({
    serviceId,
    userId,
    serviceTitle: service.title,
  });
  const summary = await getGatewayPromptCacheSummaryForProjectViaRust(gatewayProject.project.id, {
    createdFrom: windowStart,
    createdTo: windowEnd,
  });

  return {
    serviceId,
    projectId: gatewayProject.project.id,
    generatedAt: windowEnd,
    windowStart,
    windowEnd,
    summary,
  };
}

export async function resolveBenefitServicePromptCacheTrendReportForUser(
  serviceId: string,
  userId: string,
): Promise<BenefitServicePromptCacheTrendReportView> {
  const service = await getBenefitServiceRowById(serviceId);
  if (!service || service.status !== "active") {
    throw new NotFoundError("服务不存在。");
  }
  assertBenefitServiceSupportsProxyApiAccess(service);

  await db.transaction(async (tx) => {
    await assertUserHasActiveBenefitGrantInTx(tx, userId, serviceId);
  });

  const generatedAt = now();
  const windowStart = new Date(generatedAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = generatedAt.toISOString();
  const gatewayProject = await ensureGatewayBenefitProjectViaRust({
    serviceId,
    userId,
    serviceTitle: service.title,
  });
  const report = await getGatewayPromptCacheTrendReportForProjectViaRust(gatewayProject.project.id, {
    createdFrom: windowStart,
    createdTo: windowEnd,
    bucketSize: "day",
  });

  return {
    serviceId,
    projectId: gatewayProject.project.id,
    generatedAt: windowEnd,
    windowStart,
    windowEnd,
    report,
  };
}

export async function updateBenefitFamilyForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  familyKey: string,
  input: UpsertBenefitFamilyInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFamilyKey = normalizeFamilyKey(familyKey);
  const timestamp = now();
  const [updated] = await db
    .update(benefitFamilies)
    .set({
      title: normalizeRequiredText(input.title, "权益族标题", 80),
      tone: normalizeFamilyTone(input.tone),
      description: normalizeOptionalText(input.description, 2_000),
      sortOrder: normalizePositiveInt(input.sortOrder, "排序值"),
      updatedAt: timestamp,
    })
    .where(eq(benefitFamilies.key, normalizedFamilyKey))
    .returning();

  if (!updated) {
    throw new NotFoundError("权益族不存在。");
  }

  const services = await db
    .select()
    .from(benefitServices)
    .where(eq(benefitServices.familyKey, normalizedFamilyKey));

  return toBenefitFamilyView(
    updated,
    services.length,
    services.filter((service) => service.status === "active").length,
  );
}

export async function createBenefitProductLineForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: { familyKey: string; name: string; displayName: string; description: string | null; sortOrder: number; status: string },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const id = `pl-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const timestamp = now();
  const [result] = await db
    .insert(benefitProductLines)
    .values({
      id,
      familyKey: input.familyKey,
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      sortOrder: input.sortOrder,
      status: input.status || "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return result;
}

export async function updateBenefitProductLineForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  productLineId: string,
  input: { name?: string; displayName?: string; description?: string | null; sortOrder?: number; status?: string },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [result] = await db
    .update(benefitProductLines)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: now(),
    })
    .where(eq(benefitProductLines.id, productLineId))
    .returning();
  return result;
}

export async function deleteBenefitProductLineForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  productLineId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  await db.delete(benefitProductLines).where(eq(benefitProductLines.id, productLineId));
}

export async function createBenefitServiceForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: UpsertBenefitServiceInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const familyKey = normalizeFamilyKey(input.familyKey);
  if (!benefitServiceKinds.includes(input.serviceKind)) {
    throw new BadRequestError("服务类型无效。");
  }

  const [created] = await db
    .insert(benefitServices)
    .values({
      id: crypto.randomUUID(),
      familyKey,
      productLineId: input.productLineId ?? null,
      serviceKind: input.serviceKind,
      status: normalizeServiceStatus(input.status),
      title: normalizeRequiredText(input.title, "服务标题", 80),
      sortOrder: normalizePositiveInt(input.sortOrder, "排序值"),
      config: normalizeServiceConfig(input.config),
      createdByUserId: operatorUserId,
      updatedByUserId: operatorUserId,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: input.status === "archived" ? timestamp : null,
    })
    .returning();

  return toBenefitServiceView(created);
}

export async function updateBenefitServiceForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  serviceId: string,
  input: UpsertBenefitServiceInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const current = await getBenefitServiceRowById(serviceId);
  if (!current) {
    throw new NotFoundError("服务不存在。");
  }
  const timestamp = now();

  const [updated] = await db
    .update(benefitServices)
    .set({
      familyKey: normalizeFamilyKey(input.familyKey),
      productLineId: input.productLineId ?? current.productLineId,
      serviceKind: input.serviceKind,
      status: normalizeServiceStatus(input.status),
      title: normalizeRequiredText(input.title, "服务标题", 80),
      sortOrder: normalizePositiveInt(input.sortOrder, "排序值"),
      config: normalizeServiceConfig(input.config),
      updatedByUserId: operatorUserId,
      updatedAt: timestamp,
      archivedAt: input.status === "archived" ? current.archivedAt ?? timestamp : null,
    })
    .where(eq(benefitServices.id, serviceId))
    .returning();

  if (!updated) {
    throw new NotFoundError("服务不存在。");
  }

  return toBenefitServiceView(updated);
}

export async function archiveBenefitServiceForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  serviceId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const current = await getBenefitServiceRowById(serviceId);
  if (!current) {
    throw new NotFoundError("服务不存在。");
  }
  const timestamp = now();
  const [updated] = await db
    .update(benefitServices)
    .set({
      status: "archived",
      archivedAt: current.archivedAt ?? timestamp,
      updatedByUserId: operatorUserId,
      updatedAt: timestamp,
    })
    .where(eq(benefitServices.id, serviceId))
    .returning();

  if (!updated) {
    throw new NotFoundError("服务不存在。");
  }

  return toBenefitServiceView(updated);
}

export async function deleteBenefitServiceForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  serviceId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const deleted = await db.delete(benefitServices).where(eq(benefitServices.id, serviceId)).returning({ id: benefitServices.id });
  if (deleted.length === 0) {
    throw new NotFoundError("服务不存在。");
  }
  return { id: serviceId };
}

export async function createBenefitProductBindingForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: { serviceId: string; productId: string },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const service = await getBenefitServiceRowById(input.serviceId);
  if (!service) {
    throw new NotFoundError("服务不存在。");
  }
  const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  if (!product) {
    throw new NotFoundError("商品不存在。");
  }

  const [created] = await db
    .insert(benefitProductBindings)
    .values({
      id: crypto.randomUUID(),
      serviceId: input.serviceId,
      productId: input.productId,
      createdByUserId: operatorUserId,
      createdAt: now(),
    })
    .onConflictDoNothing({
      target: [benefitProductBindings.serviceId, benefitProductBindings.productId],
    })
    .returning();

  if (created) {
    return toBenefitProductBindingView({
      ...created,
      productTitle: product.title,
    } as BenefitProductBindingRow);
  }

  const existingRows = await listBenefitProductBindingRows();
  const existing = existingRows.find((row) => row.serviceId === input.serviceId && row.productId === input.productId);
  if (!existing) {
    throw new ConflictError("商品映射创建失败。");
  }
  return toBenefitProductBindingView(existing);
}

export async function deleteBenefitProductBindingForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  bindingId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const current = await getBenefitProductBindingRowById(bindingId);
  if (!current) {
    throw new NotFoundError("商品映射不存在。");
  }
  await db.delete(benefitProductBindings).where(eq(benefitProductBindings.id, bindingId));
  return { id: bindingId };
}

export async function searchBenefitUsersForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  query: string,
): Promise<BenefitUserSearchResult[]> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const keyword = query.trim();
  if (!keyword) {
    return [];
  }
  const like = `%${keyword}%`;
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      providerUserId: authIdentities.providerUserId,
      email: users.email,
    })
    .from(users)
    .leftJoin(authIdentities, and(eq(authIdentities.userId, users.id), eq(authIdentities.provider, "linuxdo")))
    .where(or(ilike(users.username, like), ilike(authIdentities.providerUserId, like), ilike(users.email, like)))
    .orderBy(asc(users.username))
    .limit(20);

  return rows;
}

export async function createBenefitGrantForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: CreateBenefitGrantInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const service = await getBenefitServiceRowById(input.serviceId);
  if (!service) {
    throw new NotFoundError("服务不存在。");
  }

  return db.transaction(async (tx) => {
    await ensureInternalUser(input.userId, tx);
    const sourceKey = `manual:${input.serviceId}:${input.userId}`;
    const timestamp = now();
    const [existing] = await tx
      .select()
      .from(benefitUserGrants)
      .where(and(eq(benefitUserGrants.serviceId, input.serviceId), eq(benefitUserGrants.userId, input.userId), eq(benefitUserGrants.sourceKey, sourceKey)))
      .limit(1);

    const durationDays = input.durationDays ?? null;
    const expiresAt = durationDays ? new Date(timestamp.getTime() + durationDays * 24 * 60 * 60 * 1000) : null;

    if (existing) {
      // Stacking: if existing grant is still valid, extend from its expiresAt
      let newExpiresAt = expiresAt;
      if (durationDays && existing.expiresAt && existing.expiresAt > timestamp) {
        newExpiresAt = new Date(existing.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
      }
      await tx
        .update(benefitUserGrants)
        .set({
          status: "active",
          grantedByUserId: operatorUserId,
          grantedAt: timestamp,
          updatedAt: timestamp,
          revokedAt: null,
          revokedByUserId: null,
          durationDays,
          expiresAt: newExpiresAt,
        })
        .where(eq(benefitUserGrants.id, existing.id));
    } else {
      await tx.insert(benefitUserGrants).values({
        id: crypto.randomUUID(),
        serviceId: input.serviceId,
        userId: input.userId,
        sourceType: "manual",
        sourceKey,
        sourceOrderId: null,
        sourceItemId: null,
        status: "active",
        grantedByUserId: operatorUserId,
        grantedAt: timestamp,
        updatedAt: timestamp,
        revokedAt: null,
        revokedByUserId: null,
        durationDays,
        expiresAt,
      });
    }

    await reconcileBenefitAssignmentInTx(tx, input.userId, input.serviceId);
  });
}

export async function revokeBenefitGrantForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  grantId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const current = await getBenefitGrantRowById(grantId);
  if (!current) {
    throw new NotFoundError("授权记录不存在。");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(benefitUserGrants)
      .set({
        status: "revoked",
        updatedAt: now(),
        revokedAt: now(),
        revokedByUserId: operatorUserId,
      })
      .where(eq(benefitUserGrants.id, grantId));
    await reconcileBenefitAssignmentInTx(tx, current.userId, current.serviceId);
  });

  return { id: grantId };
}

function normalizeCredentialImportEntries(entries: BenefitCredentialImportEntryInput[]) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new BadRequestError("至少需要导入一条凭据。");
  }
  return entries.map((entry, index) => {
    const refillCode = normalizeOptionalText(entry.refillCode, 2_000);
    const apiKey = normalizeOptionalText(entry.apiKey, 2_000);
    const apiUrl = normalizeOptionalText(entry.apiUrl, 2_000);
    if (!refillCode && !apiKey && !apiUrl) {
      throw new BadRequestError(`第 ${index + 1} 条凭据至少需要填写续杯码、API 密钥或 API 地址之一。`);
    }
    return {
      entryLabel: normalizeOptionalText(entry.entryLabel, 120),
      refillCode,
      apiKey,
      apiUrl,
    };
  });
}

export async function importBenefitCredentialPoolForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: ImportBenefitCredentialPoolInput,
) {
  const service = await getBenefitServiceRowById(input.serviceId);
  if (!service) {
    throw new NotFoundError("服务不存在。");
  }
  const config = readBenefitCredentialConfig(service.config);
  const normalizedEntries = normalizeCredentialImportEntries(input.entries);
  return importCredentialPoolForOperator(operatorUserId, providerUserId, {
    providerKey: config.providerKey,
    label: input.label,
    importNote: input.importNote,
    entries: normalizedEntries.map((entry) => ({
      benefitServiceId: input.serviceId,
      entryLabel: entry.entryLabel,
      scope: "public",
      privateUserId: null,
      storageMode: null,
      payload: {
        entryLabel: entry.entryLabel,
        refillCode: entry.refillCode,
        apiKey: entry.apiKey,
        apiUrl: entry.apiUrl,
      },
    })),
  });
}

export async function rotateBenefitAssignmentForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  serviceId: string,
  userId: string,
) {
  return rotateCredentialAssignmentForOperator(operatorUserId, providerUserId, serviceId, userId);
}

export async function syncBenefitPurchaseGrants() {
  return db.transaction(async (tx) => {
    const bindings = await tx.select().from(benefitProductBindings);
    if (bindings.length === 0) {
      return {
        syncedCount: 0,
        revokedCount: 0,
        touchedAssignmentCount: 0,
      };
    }

    const productIds = Array.from(new Set(bindings.map((binding) => binding.productId)));
    const serviceIds = Array.from(new Set(bindings.map((binding) => binding.serviceId)));
    const bindingMap = new Map<string, string[]>();
    for (const binding of bindings) {
      const existing = bindingMap.get(binding.productId) ?? [];
      existing.push(binding.serviceId);
      bindingMap.set(binding.productId, existing);
    }

    const activeItems = await tx
      .select({
        itemId: items.id,
        userId: items.userId,
        productId: items.productId,
        orderId: items.orderId,
      })
      .from(items)
      .where(
        and(
          inArray(items.productId, productIds),
          or(eq(items.status, "active"), eq(items.status, "listed")),
          isNull(items.revokedAt),
        ),
      );

    const desiredSourceKeys = new Set<string>();
    const touchedPairs = new Set<string>();
    let syncedCount = 0;

    for (const item of activeItems) {
      const serviceKeys = bindingMap.get(item.productId) ?? [];
      for (const serviceId of serviceKeys) {
        const sourceKey = `purchase:${item.itemId}`;
        desiredSourceKeys.add(`${serviceId}:${item.userId}:${sourceKey}`);
        const [existing] = await tx
          .select()
          .from(benefitUserGrants)
          .where(
            and(
              eq(benefitUserGrants.serviceId, serviceId),
              eq(benefitUserGrants.userId, item.userId),
              eq(benefitUserGrants.sourceKey, sourceKey),
            ),
          )
          .limit(1);

        if (existing) {
          if (existing.status !== "active") {
            await tx
              .update(benefitUserGrants)
              .set({
                status: "active",
                sourceOrderId: item.orderId,
                sourceItemId: item.itemId,
                grantedAt: now(),
                updatedAt: now(),
                revokedAt: null,
                revokedByUserId: null,
              })
              .where(eq(benefitUserGrants.id, existing.id));
            syncedCount += 1;
          }
        } else {
          await tx.insert(benefitUserGrants).values({
            id: crypto.randomUUID(),
            serviceId,
            userId: item.userId,
            sourceType: "purchase",
            sourceKey,
            sourceOrderId: item.orderId,
            sourceItemId: item.itemId,
            status: "active",
            grantedByUserId: null,
            grantedAt: now(),
            updatedAt: now(),
            revokedAt: null,
            revokedByUserId: null,
          });
          syncedCount += 1;
        }

        touchedPairs.add(`${serviceId}:${item.userId}`);
      }
    }

    const existingPurchaseGrants = await tx
      .select()
      .from(benefitUserGrants)
      .where(and(inArray(benefitUserGrants.serviceId, serviceIds), eq(benefitUserGrants.sourceType, "purchase")));

    let revokedCount = 0;
    for (const grant of existingPurchaseGrants) {
      const compositeKey = `${grant.serviceId}:${grant.userId}:${grant.sourceKey}`;
      if (!desiredSourceKeys.has(compositeKey) && grant.status !== "revoked") {
        await tx
          .update(benefitUserGrants)
          .set({
            status: "revoked",
            updatedAt: now(),
            revokedAt: now(),
          })
          .where(eq(benefitUserGrants.id, grant.id));
        revokedCount += 1;
        touchedPairs.add(`${grant.serviceId}:${grant.userId}`);
      }
    }

    for (const key of touchedPairs) {
      const [serviceId, userId] = key.split(":");
      await reconcileBenefitAssignmentInTx(tx, userId, serviceId);
    }

    return {
      syncedCount,
      revokedCount,
      touchedAssignmentCount: touchedPairs.size,
    };
  });
}
