import type {
  BenefitCredentialServiceConfig,
  CredentialAssignmentMode,
  CredentialAssignmentSummaryView,
  CredentialLifecycleStatus,
  CredentialOperatorCatalogView,
  CredentialOperatorImportInput,
  CredentialProviderConfig,
  CredentialProviderKey,
  CredentialResolvedPayloadView,
  CredentialScope,
  CredentialStorageMode,
  CredentialTerminalUploadInput,
  CredentialUploadTokenKind,
} from "@neuro/contracts";
import {
  credentialAssignmentModes,
  credentialLifecycleStatuses,
  credentialProviderKeys,
  credentialScopes,
  credentialStorageModes,
} from "@neuro/contracts";
import { and, asc, desc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { db } from "@/db/client";
import { env } from "@/env";
import { authIdentities, users } from "@/modules/identity/schema";
import { benefitCredentialEntries, benefitServiceProxyBindings, benefitServices, benefitUserGrants } from "@/modules/benefits/schema";
import {
  credentialAssignments,
  credentialDeathJobs,
  credentialEntries,
  credentialProviders,
  credentialRepairClaims,
  credentialTerminals,
  credentialUploadBatches,
} from "@/modules/credential-pools/schema";
import { deleteCredentialObject, putCredentialObject, readCredentialObject } from "@/modules/credential-pools/object-storage";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";

const REPAIR_CLAIM_TTL_MINUTES = 30;
const DEFAULT_PROVIDER_KEY: CredentialProviderKey = "platform_a";
const DEFAULT_ASSIGNMENT_MODE: CredentialAssignmentMode = "sticky";
const DEFAULT_PAYLOAD_SCHEMA_VERSION = "credential-v1";

const PROVIDER_SEEDS: CredentialProviderConfig[] = [
  {
    key: "platform_a",
    displayName: "A 平台",
    description: "多平台账号凭证池中的 A 平台 provider。",
    healthCheckStrategy: "manual_review",
    defaultAssignmentMode: "sticky",
    payloadSchemaVersion: DEFAULT_PAYLOAD_SCHEMA_VERSION,
    supportsRepair: true,
    supportsCooldown: true,
  },
  {
    key: "platform_b",
    displayName: "B 平台",
    description: "多平台账号凭证池中的 B 平台 provider。",
    healthCheckStrategy: "manual_review",
    defaultAssignmentMode: "sticky",
    payloadSchemaVersion: DEFAULT_PAYLOAD_SCHEMA_VERSION,
    supportsRepair: true,
    supportsCooldown: true,
  },
  {
    key: "platform_c",
    displayName: "C 平台",
    description: "多平台账号凭证池中的 C 平台 provider。",
    healthCheckStrategy: "manual_review",
    defaultAssignmentMode: "sticky",
    payloadSchemaVersion: DEFAULT_PAYLOAD_SCHEMA_VERSION,
    supportsRepair: true,
    supportsCooldown: true,
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
    throw new UnauthorizedError("Only platform operators can manage credential pools");
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
    throw new BadRequestError(`文本长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeProviderKey(value: string | null | undefined): CredentialProviderKey {
  if (value && credentialProviderKeys.includes(value as CredentialProviderKey)) {
    return value as CredentialProviderKey;
  }
  return DEFAULT_PROVIDER_KEY;
}

function normalizeAssignmentMode(value: string | null | undefined): CredentialAssignmentMode {
  if (value && credentialAssignmentModes.includes(value as CredentialAssignmentMode)) {
    return value as CredentialAssignmentMode;
  }
  return DEFAULT_ASSIGNMENT_MODE;
}

function normalizeStorageMode(value: string | null | undefined): CredentialStorageMode | null {
  if (!value) {
    return null;
  }
  if (credentialStorageModes.includes(value as CredentialStorageMode)) {
    return value as CredentialStorageMode;
  }
  throw new BadRequestError("凭证存储模式无效。");
}

function normalizeScope(value: string | null | undefined): CredentialScope {
  if (!value) {
    return "public";
  }
  if (credentialScopes.includes(value as CredentialScope)) {
    return value as CredentialScope;
  }
  throw new BadRequestError("凭证作用域无效。");
}

function normalizeLifecycleStatus(value: string | null | undefined): CredentialLifecycleStatus {
  if (value && credentialLifecycleStatuses.includes(value as CredentialLifecycleStatus)) {
    return value as CredentialLifecycleStatus;
  }
  return "available";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateTerminalToken() {
  return randomBytes(24).toString("base64url");
}

function looksLikeStructuredPayload(value: unknown) {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

function chooseStorageMode(payload: Record<string, unknown>, requestedMode: CredentialStorageMode | null) {
  if (requestedMode) {
    return requestedMode;
  }
  const serialized = JSON.stringify(payload);
  const hasNestedValue = Object.values(payload).some(looksLikeStructuredPayload);
  return serialized.length > 600 || hasNestedValue || Object.keys(payload).length > 4 ? "r2" : "inline";
}

function maskSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "••••••";
  }
  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 1)}••••`;
  }
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-4)}`;
}

function readPayloadString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function buildPayloadSummary(payload: Record<string, unknown>, entryLabel?: string | null) {
  const refillCode = readPayloadString(payload, ["refillCode", "refill_code", "code", "token"]);
  const apiKey = readPayloadString(payload, ["apiKey", "api_key", "secret", "key"]);
  const apiUrl = readPayloadString(payload, ["apiUrl", "api_url", "endpoint", "url"]);
  const previewLabel =
    normalizeOptionalText(entryLabel, 120) ??
    readPayloadString(payload, ["title", "label", "accountLabel", "username", "accountId", "email"]);
  const summaryParts = [previewLabel, refillCode ? maskSecret(refillCode) : null, apiKey ? maskSecret(apiKey) : null]
    .filter((value): value is string => Boolean(value));

  return {
    maskedSummary: summaryParts.length > 0 ? summaryParts.join(" · ") : apiUrl ?? "已导入凭证",
    previewLabel,
    previewUrl: apiUrl,
  };
}

function buildCredentialObjectKey(providerKey: CredentialProviderKey, benefitServiceId: string, entryId: string) {
  return `credential-pools/${providerKey}/${benefitServiceId}/${entryId}.json`;
}

function coercePayloadRecord(payload: Record<string, unknown>) {
  const normalized = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value] as const),
  );
  if (Object.keys(normalized).length === 0) {
    throw new BadRequestError("凭证 payload 不能为空。");
  }
  return normalized;
}

export function readBenefitCredentialConfig(
  input: Partial<BenefitCredentialServiceConfig> | Record<string, unknown> | null | undefined,
) {
  const config = (input ?? {}) as Partial<BenefitCredentialServiceConfig> & Record<string, unknown>;
  return {
    title: typeof config.title === "string" && config.title.trim() ? config.title.trim() : "credential-service",
    providerKey: normalizeProviderKey(typeof config.providerKey === "string" ? config.providerKey : null),
    assignmentMode: normalizeAssignmentMode(typeof config.assignmentMode === "string" ? config.assignmentMode : null),
    payloadSchemaVersion:
      typeof config.payloadSchemaVersion === "string" && config.payloadSchemaVersion.trim()
        ? config.payloadSchemaVersion.trim()
        : DEFAULT_PAYLOAD_SCHEMA_VERSION,
    refillDeliveryMode:
      typeof config.refillDeliveryMode === "string" && config.refillDeliveryMode.trim()
        ? config.refillDeliveryMode.trim() === "direct_credential"
          ? "direct_credential"
          : "direct_credential"
        : "direct_credential",
    refillModeText:
      typeof config.refillModeText === "string" && config.refillModeText.trim()
        ? config.refillModeText.trim()
        : "无限续杯",
    availabilityLabel:
      typeof config.availabilityLabel === "string" && config.availabilityLabel.trim()
        ? config.availabilityLabel.trim()
        : "可用账号数",
    availabilityText:
      typeof config.availabilityText === "string" && config.availabilityText.trim()
        ? config.availabilityText.trim()
        : "等待补位",
    apiDeliveryMode:
      typeof config.apiDeliveryMode === "string" && config.apiDeliveryMode.trim()
        ? config.apiDeliveryMode.trim() === "direct_credential"
          ? "direct_credential"
          : "service_proxy"
        : "service_proxy",
    apiModeText:
      typeof config.apiModeText === "string" && config.apiModeText.trim()
        ? config.apiModeText.trim()
        : "无限调用",
    apiUrl: typeof config.apiUrl === "string" && config.apiUrl.trim() ? config.apiUrl.trim() : "https://xxxx",
    downloadEnabled: Boolean(config.downloadEnabled),
    downloadUrl: typeof config.downloadUrl === "string" && config.downloadUrl.trim() ? config.downloadUrl.trim() : null,
  } satisfies BenefitCredentialServiceConfig;
}

export async function ensureCredentialProviderCatalogSeeded() {
  const timestamp = now();
  for (const provider of PROVIDER_SEEDS) {
    await db
      .insert(credentialProviders)
      .values({
        key: provider.key,
        displayName: provider.displayName,
        description: provider.description,
        healthCheckStrategy: provider.healthCheckStrategy,
        defaultAssignmentMode: provider.defaultAssignmentMode,
        payloadSchemaVersion: provider.payloadSchemaVersion,
        supportsRepair: provider.supportsRepair,
        supportsCooldown: provider.supportsCooldown,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: credentialProviders.key,
        set: {
          displayName: provider.displayName,
          description: provider.description,
          healthCheckStrategy: provider.healthCheckStrategy,
          defaultAssignmentMode: provider.defaultAssignmentMode,
          payloadSchemaVersion: provider.payloadSchemaVersion,
          supportsRepair: provider.supportsRepair,
          supportsCooldown: provider.supportsCooldown,
          updatedAt: timestamp,
        },
      });
  }
}

async function getBenefitServiceRowById(serviceId: string) {
  const [service] = await db.select().from(benefitServices).where(eq(benefitServices.id, serviceId)).limit(1);
  return service ?? null;
}

async function getCredentialEntryById(tx: any, entryId: string) {
  const [entry] = await tx.select().from(credentialEntries).where(eq(credentialEntries.id, entryId)).limit(1);
  return entry ?? null;
}

async function getAssignmentForUserService(tx: any, userId: string, serviceId: string) {
  const [assignment] = await tx
    .select()
    .from(credentialAssignments)
    .where(and(eq(credentialAssignments.userId, userId), eq(credentialAssignments.benefitServiceId, serviceId)))
    .limit(1);
  return assignment ?? null;
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

async function findNextAssignableCredentialEntry(
  tx: any,
  args: { serviceId: string; userId: string; excludeEntryIds?: string[] },
) {
  const activeAssignments = await tx
    .select({ credentialEntryId: credentialAssignments.credentialEntryId })
    .from(credentialAssignments)
    .where(eq(credentialAssignments.status, "active"));
  const activeProxyBindings = await tx
    .select({ credentialEntryId: benefitServiceProxyBindings.credentialEntryId })
    .from(benefitServiceProxyBindings)
    .where(eq(benefitServiceProxyBindings.status, "active"));
  const excludedEntryIds = Array.from(
    new Set(
      [
        ...activeAssignments
          .map((row: { credentialEntryId: string | null }) => row.credentialEntryId)
          .filter((value: string | null): value is string => Boolean(value)),
        ...activeProxyBindings
          .map((row: { credentialEntryId: string | null }) => row.credentialEntryId)
          .filter((value: string | null): value is string => Boolean(value)),
        ...(args.excludeEntryIds ?? []).filter((value): value is string => Boolean(value)),
      ],
    ),
  );

  return tx
    .select()
    .from(credentialEntries)
    .where(
      and(
        eq(credentialEntries.benefitServiceId, args.serviceId),
        eq(credentialEntries.lifecycleStatus, "available"),
        excludedEntryIds.length > 0 ? notInArray(credentialEntries.id, excludedEntryIds) : undefined,
        or(
          eq(credentialEntries.scope, "public"),
          and(eq(credentialEntries.scope, "private"), eq(credentialEntries.privateUserId, args.userId)),
        ),
      ),
    )
    .orderBy(asc(credentialEntries.createdAt), asc(credentialEntries.id))
    .limit(1)
    .then((rows: Array<typeof credentialEntries.$inferSelect>) => rows[0] ?? null);
}

async function releaseAssignmentInTx(
  tx: any,
  assignment: typeof credentialAssignments.$inferSelect,
  timestamp: Date,
  status: "released" | "revoked" = "released",
) {
  const [updated] = await tx
    .update(credentialAssignments)
    .set({
      credentialEntryId: null,
      status,
      releasedAt: status === "released" ? timestamp : assignment.releasedAt,
      revokedAt: status === "revoked" ? timestamp : assignment.revokedAt,
      updatedAt: timestamp,
    })
    .where(eq(credentialAssignments.id, assignment.id))
    .returning();
  return updated ?? assignment;
}

async function upsertActiveAssignmentInTx(
  tx: any,
  args: { serviceId: string; userId: string; entryId: string; assignmentMode: CredentialAssignmentMode; timestamp: Date },
) {
  const existing = await getAssignmentForUserService(tx, args.userId, args.serviceId);
  if (existing) {
    const [updated] = await tx
      .update(credentialAssignments)
      .set({
        credentialEntryId: args.entryId,
        assignmentMode: args.assignmentMode,
        status: "active",
        assignedAt: args.timestamp,
        releasedAt: null,
        revokedAt: null,
        updatedAt: args.timestamp,
      })
      .where(eq(credentialAssignments.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await tx
    .insert(credentialAssignments)
    .values({
      id: randomUUID(),
      benefitServiceId: args.serviceId,
      userId: args.userId,
      credentialEntryId: args.entryId,
      assignmentMode: args.assignmentMode,
      status: "active",
      assignedAt: args.timestamp,
      releasedAt: null,
      revokedAt: null,
      updatedAt: args.timestamp,
    })
    .returning();
  return created;
}

async function createCredentialEntryInTx(
  tx: any,
  args: {
    providerKey: CredentialProviderKey;
    benefitServiceId: string;
    uploadBatchId: string | null;
    sourceTerminalId: string | null;
    entryLabel: string | null;
    scope: CredentialScope;
    privateUserId: string | null;
    payload: Record<string, unknown>;
    payloadSchemaVersion: string;
    storageMode: CredentialStorageMode | null;
    lifecycleStatus?: CredentialLifecycleStatus | null;
  },
) {
  const normalizedPayload = coercePayloadRecord(args.payload);
  const storageMode = chooseStorageMode(normalizedPayload, args.storageMode ?? null);
  const entryId = randomUUID();
  const timestamp = now();
  const summary = buildPayloadSummary(normalizedPayload, args.entryLabel);
  let payloadInline: Record<string, unknown> | null = null;
  let payloadObjectKey: string | null = null;
  if (storageMode === "inline") {
    payloadInline = normalizedPayload;
  } else {
    payloadObjectKey = buildCredentialObjectKey(args.providerKey, args.benefitServiceId, entryId);
    await putCredentialObject(
      payloadObjectKey,
      Buffer.from(JSON.stringify(normalizedPayload, null, 2), "utf8"),
      "application/json",
    );
  }

  const [created] = await tx
    .insert(credentialEntries)
    .values({
      id: entryId,
      providerKey: args.providerKey,
      benefitServiceId: args.benefitServiceId,
      uploadBatchId: args.uploadBatchId,
      sourceTerminalId: args.sourceTerminalId,
      entryLabel: args.entryLabel,
      storageMode,
      scope: args.scope,
      lifecycleStatus: normalizeLifecycleStatus(args.lifecycleStatus ?? null),
      privateUserId: args.privateUserId,
      payloadSchemaVersion: args.payloadSchemaVersion,
      maskedSummary: summary.maskedSummary,
      previewLabel: summary.previewLabel,
      previewUrl: summary.previewUrl,
      payloadInline,
      payloadObjectKey,
      payloadContentType: "application/json",
      eligibleAfter: null,
      invalidReason: null,
      deathReason: null,
      failureCount: 0,
      lastHealthCheckAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    })
    .returning();

  return created;
}

async function reconcileUserCredentialAssignmentInTx(
  tx: any,
  args: {
    userId: string;
    serviceId: string;
    assignmentMode: CredentialAssignmentMode;
    excludeEntryIds?: string[];
  },
) {
  const timestamp = now();
  const grants = await listActiveGrantRowsForUserService(tx, args.userId, args.serviceId);
  const existing = await getAssignmentForUserService(tx, args.userId, args.serviceId);

  if (grants.length === 0) {
    if (existing) {
      await releaseAssignmentInTx(tx, existing, timestamp, "revoked");
    }
    return null;
  }

  if (existing?.status === "active" && existing.credentialEntryId) {
    const activeEntry = await getCredentialEntryById(tx, existing.credentialEntryId);
    if (
      activeEntry &&
      activeEntry.lifecycleStatus === "available" &&
      (activeEntry.scope === "public" || activeEntry.privateUserId === args.userId)
    ) {
      return existing;
    }
  }

  if (existing && existing.status === "active") {
    await releaseAssignmentInTx(tx, existing, timestamp, "released");
  }

  const nextEntry = await findNextAssignableCredentialEntry(tx, {
    serviceId: args.serviceId,
    userId: args.userId,
    excludeEntryIds: args.excludeEntryIds,
  });
  if (!nextEntry) {
    return null;
  }

  return upsertActiveAssignmentInTx(tx, {
    serviceId: args.serviceId,
    userId: args.userId,
    entryId: nextEntry.id,
    assignmentMode: args.assignmentMode,
    timestamp,
  });
}

async function readCredentialPayload(entry: typeof credentialEntries.$inferSelect) {
  if (entry.payloadInline) {
    return entry.payloadInline as Record<string, unknown>;
  }
  if (!entry.payloadObjectKey) {
    return null;
  }
  const buffer = await readCredentialObject(entry.payloadObjectKey);
  return JSON.parse(buffer.toString("utf8")) as Record<string, unknown>;
}

function assertUserHasCredentialGrantInTx(tx: any, userId: string, serviceId: string) {
  return listActiveGrantRowsForUserService(tx, userId, serviceId).then((activeGrants) => {
    if (activeGrants.length === 0) {
      throw new ConflictError("当前账号还没有此服务的有效资格。");
    }
    return activeGrants;
  });
}

async function buildResolvedCredentialViewFromEntry(args: {
  serviceId: string;
  assignmentMode: CredentialAssignmentMode;
  entry: typeof credentialEntries.$inferSelect;
}): Promise<CredentialResolvedPayloadView> {
  return {
    serviceId: args.serviceId,
    providerKey: args.entry.providerKey,
    assignmentMode: args.assignmentMode,
    credentialEntryId: args.entry.id,
    scope: args.entry.scope,
    storageMode: args.entry.storageMode,
    lifecycleStatus: args.entry.lifecycleStatus,
    maskedSummary: args.entry.maskedSummary,
    payload: await readCredentialPayload(args.entry),
    deliveredAt: now().toISOString(),
  };
}

async function resolveIssuedCredentialForUserInTx(
  tx: any,
  args: {
    userId: string;
    serviceId: string;
    assignmentMode: CredentialAssignmentMode;
    excludeEntryIds?: string[];
  },
): Promise<CredentialResolvedPayloadView> {
  let assignment = await reconcileUserCredentialAssignmentInTx(tx, args);

  if (args.assignmentMode === "ephemeral" && assignment?.credentialEntryId) {
    await releaseAssignmentInTx(tx, assignment, now(), "released");
    assignment = await reconcileUserCredentialAssignmentInTx(tx, args);
  }

  if (!assignment?.credentialEntryId) {
    throw new ConflictError("当前服务暂时没有可下发的账号凭证。");
  }

  const entry = await getCredentialEntryById(tx, assignment.credentialEntryId);
  if (!entry || entry.lifecycleStatus !== "available") {
    throw new ConflictError("当前服务暂时没有可下发的账号凭证。");
  }

  return buildResolvedCredentialViewFromEntry({
    serviceId: args.serviceId,
    assignmentMode: args.assignmentMode,
    entry,
  });
}

async function markCredentialEntryInvalidForUserRotationInTx(
  tx: any,
  entryId: string,
  userId: string,
  timestamp: Date,
) {
  await tx
    .update(credentialEntries)
    .set({
      lifecycleStatus: "invalid",
      invalidReason: `用户 ${userId} 自助重置后停用`,
      updatedAt: timestamp,
    })
    .where(eq(credentialEntries.id, entryId));
}

function buildAssignmentSummaryFromEntry(args: {
  serviceId: string;
  providerKey: CredentialProviderKey;
  assignmentMode: CredentialAssignmentMode;
  entry: typeof credentialEntries.$inferSelect | null;
  updatedAt: Date | null;
}): CredentialAssignmentSummaryView {
  return {
    serviceId: args.serviceId,
    providerKey: args.providerKey,
    assignmentMode: args.assignmentMode,
    credentialReady: Boolean(args.entry && args.entry.lifecycleStatus === "available"),
    credentialEntryId: args.entry?.id ?? null,
    scope: args.entry?.scope ?? null,
    lifecycleStatus: args.entry?.lifecycleStatus ?? null,
    maskedSummary: args.entry?.maskedSummary ?? null,
    previewLabel: args.entry?.previewLabel ?? null,
    apiUrl: args.entry?.previewUrl ?? null,
    updatedAt: args.updatedAt ? args.updatedAt.toISOString() : null,
  };
}

async function listUserAssignmentRows(userId: string) {
  return db
    .select({
      benefitServiceId: credentialAssignments.benefitServiceId,
      credentialEntryId: credentialAssignments.credentialEntryId,
      assignmentMode: credentialAssignments.assignmentMode,
      updatedAt: credentialAssignments.updatedAt,
      providerKey: credentialEntries.providerKey,
      scope: credentialEntries.scope,
      lifecycleStatus: credentialEntries.lifecycleStatus,
      maskedSummary: credentialEntries.maskedSummary,
      previewLabel: credentialEntries.previewLabel,
      previewUrl: credentialEntries.previewUrl,
    })
    .from(credentialAssignments)
    .leftJoin(credentialEntries, eq(credentialAssignments.credentialEntryId, credentialEntries.id))
    .where(eq(credentialAssignments.userId, userId));
}

export async function getCredentialAssignmentSummariesForUser(userId: string) {
  await ensureCredentialProviderCatalogSeeded();
  const [serviceRows, activeGrants] = await Promise.all([
    db.select().from(benefitServices).where(eq(benefitServices.status, "active")),
    db
      .select({ serviceId: benefitUserGrants.serviceId })
      .from(benefitUserGrants)
      .where(and(eq(benefitUserGrants.userId, userId), eq(benefitUserGrants.status, "active")))
      .groupBy(benefitUserGrants.serviceId),
  ]);
  const serviceConfigById = new Map(
    serviceRows.map((service) => [service.id, readBenefitCredentialConfig(service.config)] as const),
  );

  await db.transaction(async (tx) => {
    for (const grant of activeGrants) {
      const config = serviceConfigById.get(grant.serviceId);
      if (!config) {
        continue;
      }
      await reconcileUserCredentialAssignmentInTx(tx, {
        userId,
        serviceId: grant.serviceId,
        assignmentMode: config.assignmentMode,
      });
    }
  });

  const assignmentRows = await listUserAssignmentRows(userId);
  const summaryByService = new Map<string, CredentialAssignmentSummaryView>();

  for (const row of assignmentRows) {
    const config = serviceConfigById.get(row.benefitServiceId);
    if (!config) {
      continue;
    }
    const entry = row.credentialEntryId
      ? ({
          id: row.credentialEntryId,
          scope: row.scope,
          lifecycleStatus: row.lifecycleStatus,
          maskedSummary: row.maskedSummary,
          previewLabel: row.previewLabel,
          previewUrl: row.previewUrl,
        } as typeof credentialEntries.$inferSelect)
      : null;
    summaryByService.set(
      row.benefitServiceId,
      buildAssignmentSummaryFromEntry({
        serviceId: row.benefitServiceId,
        providerKey: config.providerKey,
        assignmentMode: config.assignmentMode,
        entry,
        updatedAt: row.updatedAt,
      }),
    );
  }

  return summaryByService;
}

export async function resolveCredentialForUser(serviceId: string, userId: string): Promise<CredentialResolvedPayloadView> {
  await ensureCredentialProviderCatalogSeeded();
  const service = await getBenefitServiceRowById(serviceId);
  if (!service || service.status !== "active") {
    throw new NotFoundError("服务不存在。");
  }
  const config = readBenefitCredentialConfig(service.config);

  return db.transaction(async (tx) => {
    await assertUserHasCredentialGrantInTx(tx, userId, serviceId);
    return resolveIssuedCredentialForUserInTx(tx, {
      userId,
      serviceId,
      assignmentMode: config.assignmentMode,
    });
  });
}

export async function rotateCredentialForUser(serviceId: string, userId: string): Promise<CredentialResolvedPayloadView> {
  await ensureCredentialProviderCatalogSeeded();
  const service = await getBenefitServiceRowById(serviceId);
  if (!service || service.status !== "active") {
    throw new NotFoundError("服务不存在。");
  }
  const config = readBenefitCredentialConfig(service.config);

  return db.transaction(async (tx) => {
    await assertUserHasCredentialGrantInTx(tx, userId, serviceId);

    const currentAssignment = await getAssignmentForUserService(tx, userId, serviceId);
    const currentEntryId =
      currentAssignment?.status === "active" && currentAssignment.credentialEntryId
        ? currentAssignment.credentialEntryId
        : null;

    if (!currentAssignment || !currentEntryId) {
      return resolveIssuedCredentialForUserInTx(tx, {
        userId,
        serviceId,
        assignmentMode: config.assignmentMode,
      });
    }

    const nextEntry = await findNextAssignableCredentialEntry(tx, {
      serviceId,
      userId,
      excludeEntryIds: [currentEntryId],
    });

    if (!nextEntry) {
      throw new ConflictError("当前服务暂时没有可轮换的新凭证。");
    }

    const timestamp = now();
    await markCredentialEntryInvalidForUserRotationInTx(tx, currentEntryId, userId, timestamp);
    await releaseAssignmentInTx(tx, currentAssignment, timestamp, "released");
    await upsertActiveAssignmentInTx(tx, {
      serviceId,
      userId,
      entryId: nextEntry.id,
      assignmentMode: config.assignmentMode,
      timestamp,
    });

    return buildResolvedCredentialViewFromEntry({
      serviceId,
      assignmentMode: config.assignmentMode,
      entry: nextEntry,
    });
  });
}

type NormalizedUploadEntry = {
  benefitServiceId: string;
  entryLabel: string | null;
  scope: CredentialScope;
  privateUserId: string | null;
  storageMode: CredentialStorageMode | null;
  payload: Record<string, unknown>;
  providerKey: CredentialProviderKey;
  payloadSchemaVersion: string;
};

async function normalizeUploadEntries(
  providerKey: CredentialProviderKey,
  entries: CredentialTerminalUploadInput["entries"],
): Promise<NormalizedUploadEntry[]> {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new BadRequestError("至少需要导入一条凭证。");
  }

  const serviceIds = Array.from(
    new Set(entries.map((entry) => normalizeRequiredText(entry.benefitServiceId, "服务", 120))),
  );
  const serviceRows = await db.select().from(benefitServices).where(inArray(benefitServices.id, serviceIds));
  const serviceById = new Map(serviceRows.map((service) => [service.id, service] as const));

  return entries.map((entry, index) => {
    const serviceId = normalizeRequiredText(entry.benefitServiceId, `第 ${index + 1} 条凭证的服务`, 120);
    const service = serviceById.get(serviceId);
    if (!service) {
      throw new NotFoundError(`第 ${index + 1} 条凭证引用的服务不存在。`);
    }
    const config = readBenefitCredentialConfig(service.config);
    if (config.providerKey !== providerKey) {
      throw new ConflictError(`服务 ${service.title} 已绑定到 ${config.providerKey}，与当前上传 provider 不一致。`);
    }
    const scope = normalizeScope(entry.scope ?? null);
    const privateUserId = normalizeOptionalText(entry.privateUserId, 120);
    if (scope === "private" && !privateUserId) {
      throw new BadRequestError(`第 ${index + 1} 条私有凭证必须指定 privateUserId。`);
    }
    return {
      benefitServiceId: serviceId,
      entryLabel: normalizeOptionalText(entry.entryLabel, 120),
      scope,
      privateUserId,
      storageMode: normalizeStorageMode(entry.storageMode ?? null),
      payload: coercePayloadRecord(entry.payload),
      providerKey: config.providerKey,
      payloadSchemaVersion: config.payloadSchemaVersion,
    };
  });
}

async function importCredentialEntriesInTx(
  tx: any,
  args: {
    providerKey: CredentialProviderKey;
    label: string;
    importNote: string | null;
    tokenKind: CredentialUploadTokenKind;
    terminalId: string | null;
    createdByUserId: string | null;
    entries: NormalizedUploadEntry[];
  },
) {
  const timestamp = now();
  const batchId = randomUUID();
  const singleServiceId =
    new Set(args.entries.map((entry) => entry.benefitServiceId)).size === 1
      ? args.entries[0]?.benefitServiceId ?? null
      : null;

  await tx.insert(credentialUploadBatches).values({
    id: batchId,
    providerKey: args.providerKey,
    benefitServiceId: singleServiceId,
    terminalId: args.terminalId,
    tokenKind: args.tokenKind,
    label: normalizeRequiredText(args.label, "批次标题", 120),
    importNote: args.importNote,
    acceptedCount: args.entries.length,
    rejectedCount: 0,
    inlineCount: 0,
    r2Count: 0,
    createdByUserId: args.createdByUserId,
    createdAt: timestamp,
  });

  let inlineCount = 0;
  let r2Count = 0;
  for (const entry of args.entries) {
    const created = await createCredentialEntryInTx(tx, {
      providerKey: entry.providerKey,
      benefitServiceId: entry.benefitServiceId,
      uploadBatchId: batchId,
      sourceTerminalId: args.terminalId,
      entryLabel: entry.entryLabel,
      scope: entry.scope,
      privateUserId: entry.privateUserId,
      payload: entry.payload,
      payloadSchemaVersion: entry.payloadSchemaVersion,
      storageMode: entry.storageMode,
      lifecycleStatus: "available",
    });
    if (created.storageMode === "inline") {
      inlineCount += 1;
    } else {
      r2Count += 1;
    }
  }

  await tx
    .update(credentialUploadBatches)
    .set({ inlineCount, r2Count })
    .where(eq(credentialUploadBatches.id, batchId));

  const touchedServiceIds = Array.from(new Set(args.entries.map((entry) => entry.benefitServiceId)));
  const services = (await tx
    .select()
    .from(benefitServices)
    .where(inArray(benefitServices.id, touchedServiceIds))) as Array<typeof benefitServices.$inferSelect>;
  const serviceConfigById = new Map(
    services.map((service: typeof benefitServices.$inferSelect) => [service.id, readBenefitCredentialConfig(service.config)] as const),
  );
  for (const serviceId of touchedServiceIds) {
    const grants = await tx
      .select({ userId: benefitUserGrants.userId })
      .from(benefitUserGrants)
      .where(and(eq(benefitUserGrants.serviceId, serviceId), eq(benefitUserGrants.status, "active")))
      .groupBy(benefitUserGrants.userId);
    const config = serviceConfigById.get(serviceId) ?? readBenefitCredentialConfig(null);
    for (const grant of grants) {
      await reconcileUserCredentialAssignmentInTx(tx, {
        userId: grant.userId,
        serviceId,
        assignmentMode: config.assignmentMode,
      });
    }
  }

  const [batch] = await tx
    .select()
    .from(credentialUploadBatches)
    .where(eq(credentialUploadBatches.id, batchId))
    .limit(1);
  return batch;
}

export async function importCredentialPoolForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: CredentialOperatorImportInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  await ensureCredentialProviderCatalogSeeded();
  const providerKey = normalizeProviderKey(input.providerKey);
  const normalizedEntries = await normalizeUploadEntries(providerKey, input.entries);
  return db.transaction(async (tx) =>
    importCredentialEntriesInTx(tx, {
      providerKey,
      label: input.label,
      importNote: normalizeOptionalText(input.importNote, 2_000),
      tokenKind: "operator_import",
      terminalId: null,
      createdByUserId: operatorUserId,
      entries: normalizedEntries,
    }),
  );
}

async function resolveTerminalByToken(
  providerKey: CredentialProviderKey,
  terminalToken: string | null | undefined,
  sharedToken: string | null | undefined,
) {
  const normalizedTerminalToken = terminalToken?.trim() ?? "";
  const normalizedSharedToken = sharedToken?.trim() ?? "";

  if (normalizedTerminalToken) {
    const [terminal] = await db
      .select()
      .from(credentialTerminals)
      .where(
        and(
          eq(credentialTerminals.providerKey, providerKey),
          eq(credentialTerminals.uploadTokenHash, hashToken(normalizedTerminalToken)),
        ),
      )
      .limit(1);
    if (!terminal || terminal.status !== "active") {
      throw new UnauthorizedError("终端令牌无效。");
    }
    return {
      terminal,
      tokenKind: "terminal" as CredentialUploadTokenKind,
    };
  }

  if (normalizedSharedToken && env.credentialPoolSuperToken && normalizedSharedToken === env.credentialPoolSuperToken) {
    return {
      terminal: null,
      tokenKind: "shared" as CredentialUploadTokenKind,
    };
  }

  throw new UnauthorizedError("缺少可用的凭证上传鉴权。");
}

export async function ingestCredentialPoolUpload(input: {
  terminalToken?: string | null;
  sharedToken?: string | null;
  payload: CredentialTerminalUploadInput;
}) {
  await ensureCredentialProviderCatalogSeeded();
  const providerKey = normalizeProviderKey(input.payload.providerKey);
  const terminalIdentity = await resolveTerminalByToken(providerKey, input.terminalToken, input.sharedToken);
  const normalizedEntries = await normalizeUploadEntries(providerKey, input.payload.entries);

  return db.transaction(async (tx) => {
    const batch = await importCredentialEntriesInTx(tx, {
      providerKey,
      label: input.payload.label,
      importNote: normalizeOptionalText(input.payload.importNote, 2_000),
      tokenKind: terminalIdentity.tokenKind,
      terminalId: terminalIdentity.terminal?.id ?? null,
      createdByUserId: null,
      entries: normalizedEntries,
    });

    if (terminalIdentity.terminal) {
      await tx
        .update(credentialTerminals)
        .set({
          lastSeenAt: now(),
          lastUploadAt: now(),
          updatedAt: now(),
        })
        .where(eq(credentialTerminals.id, terminalIdentity.terminal.id));
    }

    return batch;
  });
}

export async function createCredentialTerminalForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: { providerKey: CredentialProviderKey; label: string; note?: string | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  await ensureCredentialProviderCatalogSeeded();
  const timestamp = now();
  const plainToken = generateTerminalToken();
  const [terminal] = await db
    .insert(credentialTerminals)
    .values({
      id: randomUUID(),
      providerKey: normalizeProviderKey(input.providerKey),
      label: normalizeRequiredText(input.label, "终端名称", 120),
      note: normalizeOptionalText(input.note, 2_000),
      status: "active",
      uploadTokenHash: hashToken(plainToken),
      lastSeenAt: null,
      lastUploadAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  return {
    terminal,
    plainToken,
  };
}

export async function revokeCredentialTerminalForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  terminalId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [terminal] = await db
    .update(credentialTerminals)
    .set({
      status: "revoked",
      updatedAt: now(),
    })
    .where(eq(credentialTerminals.id, terminalId))
    .returning();
  if (!terminal) {
    throw new NotFoundError("终端不存在。");
  }
  return terminal;
}

export async function claimCredentialRepairForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  entryId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const staleAt = new Date(timestamp.getTime() + REPAIR_CLAIM_TTL_MINUTES * 60 * 1000);
  const [entry] = await db.select().from(credentialEntries).where(eq(credentialEntries.id, entryId)).limit(1);
  if (!entry) {
    throw new NotFoundError("凭证不存在。");
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(credentialRepairClaims)
      .where(eq(credentialRepairClaims.credentialEntryId, entryId))
      .limit(1);

    if (existing && existing.status === "active" && existing.staleAt > timestamp) {
      throw new ConflictError("该凭证当前已被其他修缮会话领取。");
    }

    const values = {
      status: "active",
      claimOwnerType: "operator",
      claimOwnerKey: operatorUserId,
      claimedAt: timestamp,
      staleAt,
      releasedAt: null,
      resolvedAt: null,
    };

    const claim = existing
      ? (
          await tx
            .update(credentialRepairClaims)
            .set(values)
            .where(eq(credentialRepairClaims.id, existing.id))
            .returning()
        )[0]
      : (
          await tx
            .insert(credentialRepairClaims)
            .values({
              id: randomUUID(),
              credentialEntryId: entryId,
              benefitServiceId: entry.benefitServiceId,
              ...values,
            })
            .returning()
        )[0];

    await tx
      .update(credentialEntries)
      .set({
        lifecycleStatus: "repair",
        updatedAt: timestamp,
      })
      .where(eq(credentialEntries.id, entryId));

    return claim;
  });
}

export async function releaseCredentialRepairClaimForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  claimId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [claim] = await db
    .update(credentialRepairClaims)
    .set({
      status: "released",
      releasedAt: now(),
    })
    .where(eq(credentialRepairClaims.id, claimId))
    .returning();
  if (!claim) {
    throw new NotFoundError("修缮领取不存在。");
  }
  return claim;
}

export async function markCredentialEntryCoolingForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  entryId: string,
  input: { cooldownMinutes: number; reason?: string | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const cooldownMinutes = Number.isFinite(input.cooldownMinutes) ? Math.max(1, Math.floor(input.cooldownMinutes)) : 60;
  const [entry] = await db
    .update(credentialEntries)
    .set({
      lifecycleStatus: "cooling",
      eligibleAfter: new Date(Date.now() + cooldownMinutes * 60 * 1000),
      invalidReason: normalizeOptionalText(input.reason, 2_000),
      updatedAt: now(),
    })
    .where(eq(credentialEntries.id, entryId))
    .returning();
  if (!entry) {
    throw new NotFoundError("凭证不存在。");
  }
  return entry;
}

export async function markCredentialEntryInvalidForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  entryId: string,
  input: { reason: string },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [entry] = await db
    .update(credentialEntries)
    .set({
      lifecycleStatus: "invalid",
      invalidReason: normalizeRequiredText(input.reason, "无效原因", 2_000),
      updatedAt: now(),
    })
    .where(eq(credentialEntries.id, entryId))
    .returning();
  if (!entry) {
    throw new NotFoundError("凭证不存在。");
  }
  return entry;
}

export async function markCredentialEntryDeathForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  entryId: string,
  input: { reason: string },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  return db.transaction(async (tx) => {
    const entry = await getCredentialEntryById(tx, entryId);
    if (!entry) {
      throw new NotFoundError("凭证不存在。");
    }

    const [updatedEntry] = await tx
      .update(credentialEntries)
      .set({
        lifecycleStatus: "death_pending",
        deathReason: normalizeRequiredText(input.reason, "死亡原因", 2_000),
        updatedAt: timestamp,
      })
      .where(eq(credentialEntries.id, entryId))
      .returning();

    const [existingJob] = await tx
      .select()
      .from(credentialDeathJobs)
      .where(eq(credentialDeathJobs.credentialEntryId, entryId))
      .limit(1);

    if (existingJob) {
      await tx
        .update(credentialDeathJobs)
        .set({
          status: "pending",
          objectKey: entry.payloadObjectKey,
          lastError: null,
          updatedAt: timestamp,
        })
        .where(eq(credentialDeathJobs.id, existingJob.id));
    } else {
      await tx.insert(credentialDeathJobs).values({
        id: randomUUID(),
        credentialEntryId: entry.id,
        benefitServiceId: entry.benefitServiceId,
        providerKey: entry.providerKey,
        objectKey: entry.payloadObjectKey,
        status: "pending",
        attempts: 0,
        lastError: null,
        requestedByUserId: operatorUserId,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      });
    }

    return updatedEntry;
  });
}

export async function rotateCredentialAssignmentForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  serviceId: string,
  userId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const service = await getBenefitServiceRowById(serviceId);
  if (!service) {
    throw new NotFoundError("服务不存在。");
  }
  const config = readBenefitCredentialConfig(service.config);

  return db.transaction(async (tx) => {
    const assignment = await getAssignmentForUserService(tx, userId, serviceId);
    const currentEntryId =
      assignment?.status === "active" && assignment.credentialEntryId ? assignment.credentialEntryId : null;

    if (!assignment || !currentEntryId) {
      return reconcileUserCredentialAssignmentInTx(tx, {
        userId,
        serviceId,
        assignmentMode: config.assignmentMode,
      });
    }

    const nextEntry = await findNextAssignableCredentialEntry(tx, {
      serviceId,
      userId,
      excludeEntryIds: [currentEntryId],
    });

    if (!nextEntry) {
      throw new ConflictError("当前服务暂时没有可轮换的新凭证。");
    }

    const timestamp = now();
    await releaseAssignmentInTx(tx, assignment, timestamp, "released");
    return upsertActiveAssignmentInTx(tx, {
      serviceId,
      userId,
      entryId: nextEntry.id,
      assignmentMode: config.assignmentMode,
      timestamp,
    });
  });
}

export async function listOperatorCredentialPoolCatalog(
  operatorUserId: string,
  providerUserId?: string | null,
): Promise<CredentialOperatorCatalogView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  await ensureCredentialProviderCatalogSeeded();

  const [providerRows, terminalRows, batchRows, entryRows, assignmentRows, repairRows, deathRows] = await Promise.all([
    db.select().from(credentialProviders).orderBy(asc(credentialProviders.key)),
    db.select().from(credentialTerminals).orderBy(asc(credentialTerminals.providerKey), asc(credentialTerminals.label)),
    db.select().from(credentialUploadBatches).orderBy(desc(credentialUploadBatches.createdAt)).limit(100),
    db.select().from(credentialEntries).orderBy(desc(credentialEntries.updatedAt)).limit(400),
    db
      .select({
        id: credentialAssignments.id,
        benefitServiceId: credentialAssignments.benefitServiceId,
        userId: credentialAssignments.userId,
        credentialEntryId: credentialAssignments.credentialEntryId,
        assignmentMode: credentialAssignments.assignmentMode,
        status: credentialAssignments.status,
        assignedAt: credentialAssignments.assignedAt,
        releasedAt: credentialAssignments.releasedAt,
        revokedAt: credentialAssignments.revokedAt,
        updatedAt: credentialAssignments.updatedAt,
        username: users.username,
        providerUserId: authIdentities.providerUserId,
        providerKey: credentialEntries.providerKey,
        maskedSummary: credentialEntries.maskedSummary,
      })
      .from(credentialAssignments)
      .innerJoin(users, eq(credentialAssignments.userId, users.id))
      .leftJoin(authIdentities, and(eq(authIdentities.userId, users.id), eq(authIdentities.provider, "linuxdo")))
      .leftJoin(credentialEntries, eq(credentialAssignments.credentialEntryId, credentialEntries.id))
      .orderBy(desc(credentialAssignments.updatedAt))
      .limit(400),
    db.select().from(credentialRepairClaims).orderBy(desc(credentialRepairClaims.claimedAt)).limit(200),
    db.select().from(credentialDeathJobs).orderBy(desc(credentialDeathJobs.updatedAt)).limit(200),
  ]);

  const terminalCountByProvider = new Map<string, number>();
  for (const terminal of terminalRows) {
    terminalCountByProvider.set(terminal.providerKey, (terminalCountByProvider.get(terminal.providerKey) ?? 0) + 1);
  }
  const serviceCountByProvider = new Map<string, number>();
  const activeEntryCountByProvider = new Map<string, number>();
  const lifecycleCounts = {
    available: 0,
    repair: 0,
    cooling: 0,
    invalid: 0,
    death_pending: 0,
    deleted: 0,
  } satisfies Record<CredentialLifecycleStatus, number>;
  for (const entry of entryRows) {
    serviceCountByProvider.set(entry.providerKey, (serviceCountByProvider.get(entry.providerKey) ?? 0) + 1);
    if (entry.lifecycleStatus === "available") {
      activeEntryCountByProvider.set(entry.providerKey, (activeEntryCountByProvider.get(entry.providerKey) ?? 0) + 1);
    }
    lifecycleCounts[entry.lifecycleStatus] += 1;
  }
  const activeAssignmentCountByProvider = new Map<string, number>();
  for (const assignment of assignmentRows) {
    if (assignment.providerKey && assignment.status === "active") {
      activeAssignmentCountByProvider.set(
        assignment.providerKey,
        (activeAssignmentCountByProvider.get(assignment.providerKey) ?? 0) + 1,
      );
    }
  }

  return {
    providers: providerRows.map((row) => ({
      key: row.key,
      displayName: row.displayName,
      description: row.description,
      healthCheckStrategy: row.healthCheckStrategy,
      defaultAssignmentMode: row.defaultAssignmentMode,
      payloadSchemaVersion: row.payloadSchemaVersion,
      supportsRepair: row.supportsRepair,
      supportsCooldown: row.supportsCooldown,
      serviceCount: serviceCountByProvider.get(row.key) ?? 0,
      terminalCount: terminalCountByProvider.get(row.key) ?? 0,
      activeEntryCount: activeEntryCountByProvider.get(row.key) ?? 0,
      activeAssignmentCount: activeAssignmentCountByProvider.get(row.key) ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    terminals: terminalRows.map((terminal) => ({
      id: terminal.id,
      providerKey: terminal.providerKey,
      label: terminal.label,
      status: terminal.status,
      note: terminal.note,
      lastSeenAt: terminal.lastSeenAt ? terminal.lastSeenAt.toISOString() : null,
      lastUploadAt: terminal.lastUploadAt ? terminal.lastUploadAt.toISOString() : null,
      createdAt: terminal.createdAt.toISOString(),
      updatedAt: terminal.updatedAt.toISOString(),
    })),
    uploadBatches: batchRows.map((batch) => ({
      id: batch.id,
      providerKey: batch.providerKey,
      benefitServiceId: batch.benefitServiceId,
      terminalId: batch.terminalId,
      tokenKind: batch.tokenKind,
      label: batch.label,
      importNote: batch.importNote,
      acceptedCount: batch.acceptedCount,
      rejectedCount: batch.rejectedCount,
      inlineCount: batch.inlineCount,
      r2Count: batch.r2Count,
      createdByUserId: batch.createdByUserId,
      createdAt: batch.createdAt.toISOString(),
    })),
    entries: entryRows.map((entry) => ({
      id: entry.id,
      providerKey: entry.providerKey,
      benefitServiceId: entry.benefitServiceId,
      uploadBatchId: entry.uploadBatchId,
      sourceTerminalId: entry.sourceTerminalId,
      storageMode: entry.storageMode,
      scope: entry.scope,
      lifecycleStatus: entry.lifecycleStatus,
      entryLabel: entry.entryLabel,
      maskedSummary: entry.maskedSummary,
      previewLabel: entry.previewLabel,
      privateUserId: entry.privateUserId,
      eligibleAfter: entry.eligibleAfter ? entry.eligibleAfter.toISOString() : null,
      invalidReason: entry.invalidReason,
      deathReason: entry.deathReason,
      failureCount: entry.failureCount,
      lastHealthCheckAt: entry.lastHealthCheckAt ? entry.lastHealthCheckAt.toISOString() : null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
    assignments: assignmentRows.map((assignment) => ({
      id: assignment.id,
      benefitServiceId: assignment.benefitServiceId,
      userId: assignment.userId,
      username: assignment.username,
      providerUserId: assignment.providerUserId,
      credentialEntryId: assignment.credentialEntryId,
      providerKey: assignment.providerKey ?? DEFAULT_PROVIDER_KEY,
      assignmentMode: assignment.assignmentMode,
      status: assignment.status,
      maskedSummary: assignment.maskedSummary,
      updatedAt: assignment.updatedAt.toISOString(),
      assignedAt: assignment.assignedAt ? assignment.assignedAt.toISOString() : null,
      releasedAt: assignment.releasedAt ? assignment.releasedAt.toISOString() : null,
      revokedAt: assignment.revokedAt ? assignment.revokedAt.toISOString() : null,
    })),
    repairClaims: repairRows.map((claim) => ({
      id: claim.id,
      credentialEntryId: claim.credentialEntryId,
      benefitServiceId: claim.benefitServiceId,
      status: claim.status as CredentialOperatorCatalogView["repairClaims"][number]["status"],
      claimOwnerType: claim.claimOwnerType,
      claimOwnerKey: claim.claimOwnerKey,
      claimedAt: claim.claimedAt.toISOString(),
      staleAt: claim.staleAt.toISOString(),
      releasedAt: claim.releasedAt ? claim.releasedAt.toISOString() : null,
      resolvedAt: claim.resolvedAt ? claim.resolvedAt.toISOString() : null,
    })),
    deathJobs: deathRows.map((job) => ({
      id: job.id,
      credentialEntryId: job.credentialEntryId,
      benefitServiceId: job.benefitServiceId,
      providerKey: job.providerKey,
      objectKey: job.objectKey,
      status: job.status as CredentialOperatorCatalogView["deathJobs"][number]["status"],
      attempts: job.attempts,
      lastError: job.lastError,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      deletedAt: job.deletedAt ? job.deletedAt.toISOString() : null,
    })),
    summary: {
      providerCount: providerRows.length,
      terminalCount: terminalRows.length,
      availableEntryCount: lifecycleCounts.available,
      repairEntryCount: lifecycleCounts.repair,
      coolingEntryCount: lifecycleCounts.cooling,
      invalidEntryCount: lifecycleCounts.invalid,
      deathPendingEntryCount: lifecycleCounts.death_pending,
      deletedEntryCount: lifecycleCounts.deleted,
      activeAssignmentCount: assignmentRows.filter((row) => row.status === "active").length,
    },
  };
}

export async function runCredentialPoolLifecycleSweep() {
  await ensureCredentialProviderCatalogSeeded();
  let releasedRepairClaims = 0;
  let reactivatedEntries = 0;
  let deletedEntries = 0;

  await db.transaction(async (tx) => {
    const timestamp = now();
    const staleClaims = await tx
      .select()
      .from(credentialRepairClaims)
      .where(and(eq(credentialRepairClaims.status, "active"), sql`${credentialRepairClaims.staleAt} <= ${timestamp}`));
    for (const claim of staleClaims) {
      await tx
        .update(credentialRepairClaims)
        .set({
          status: "expired",
          releasedAt: timestamp,
        })
        .where(eq(credentialRepairClaims.id, claim.id));
      releasedRepairClaims += 1;
    }

    const coolingEntries = await tx
      .select()
      .from(credentialEntries)
      .where(and(eq(credentialEntries.lifecycleStatus, "cooling"), sql`${credentialEntries.eligibleAfter} <= ${timestamp}`));
    for (const entry of coolingEntries) {
      await tx
        .update(credentialEntries)
        .set({
          lifecycleStatus: "available",
          eligibleAfter: null,
          invalidReason: null,
          updatedAt: timestamp,
        })
        .where(eq(credentialEntries.id, entry.id));
      reactivatedEntries += 1;
    }

    const deathJobs = await tx
      .select()
      .from(credentialDeathJobs)
      .where(inArray(credentialDeathJobs.status, ["pending", "failed"]))
      .orderBy(asc(credentialDeathJobs.createdAt))
      .limit(100);
    for (const job of deathJobs) {
      try {
        await tx
          .update(credentialDeathJobs)
          .set({
            status: "running",
            attempts: job.attempts + 1,
            lastError: null,
            updatedAt: timestamp,
          })
          .where(eq(credentialDeathJobs.id, job.id));

        if (job.objectKey) {
          await deleteCredentialObject(job.objectKey);
        }

        await tx.delete(credentialAssignments).where(eq(credentialAssignments.credentialEntryId, job.credentialEntryId));
        await tx
          .update(credentialEntries)
          .set({
            lifecycleStatus: "deleted",
            payloadInline: null,
            payloadObjectKey: null,
            payloadContentType: null,
            deletedAt: timestamp,
            updatedAt: timestamp,
          })
          .where(eq(credentialEntries.id, job.credentialEntryId));
        await tx
          .update(credentialDeathJobs)
          .set({
            status: "deleted",
            deletedAt: timestamp,
            updatedAt: timestamp,
          })
          .where(eq(credentialDeathJobs.id, job.id));
        deletedEntries += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown death purge failure";
        await tx
          .update(credentialDeathJobs)
          .set({
            status: "failed",
            lastError: message,
            updatedAt: now(),
          })
          .where(eq(credentialDeathJobs.id, job.id));
      }
    }
  });

  return {
    releasedRepairClaims,
    reactivatedEntries,
    deletedEntries,
  };
}
