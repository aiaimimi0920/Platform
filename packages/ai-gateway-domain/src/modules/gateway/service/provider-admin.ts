import type { GatewayEndpointExecutionModeMap, GatewayProjectPressureView, GatewayProtocolFamily, GatewayProviderAccountPayload, GatewayProviderHealthSummaryView, GatewayProviderSourceProfile, GatewayProviderSourceProfileBackfillInput, GatewayProviderSourceProfileBackfillResult, PatchGatewayProviderSourceProfileInput, GatewayProviderPressureView, GatewayRoutePolicyConfig, GatewayRuntimePressureView, GatewayProviderHealthView, UpsertGatewayModelAliasInput, UpsertGatewayProviderAccountInput, UpsertGatewayRoutePolicyInput } from "@neuro/contracts";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { env } from "@/env";
import { buildGatewayProviderAccountObjectKey } from "@/modules/gateway/object-keys";
import { normalizeRoutePolicyGuardrails } from "@/modules/gateway/route-policy-guardrails";
import { normalizeRoutePolicyRateLimitHotspotAutoRemediationProfile } from "@/modules/gateway/route-policy-hotspot-remediation";
import { normalizeRoutePolicyRoutingAnomalyAutoRemediationProfile } from "@/modules/gateway/route-policy-routing-remediation";
import { normalizeRoutePolicyRateLimitDefinition, normalizeRoutePolicyRateLimitMap } from "@/modules/gateway/route-policy-rate-limits";
import { buildGatewayProviderRoutingScore } from "@/modules/gateway/provider-routing-score";
import { chooseProviderPayloadStorageMode } from "@/modules/gateway/provider-payload-storage";
import { deleteGatewayObject, putGatewayObject } from "@/modules/gateway/object-storage";
import { gatewayModelAliases, gatewayProjects, gatewayProviderAccounts, gatewayRequestAudits, gatewayRoutePolicies } from "@/modules/gateway/schema";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { assertPlatformOperator, normalizeNonNegativeInt, normalizeOptionalText, normalizeRequiredText, normalizeStringList, now, truncateErrorSummary } from "./shared";
import type { GatewayProjectRow, GatewayProviderAccountRow, GatewayProviderHealthOperatorFilters, GatewayRuntimePressureOperatorFilters } from "./shared";
import { normalizeGatewayProtocolFamily, normalizeGatewayProtocolProfile, normalizeGatewayServiceProviderIdentity } from "./provider-identity";
import { inferGatewayProviderSourceProfile, normalizeEndpointExecutionModes, normalizeExplicitGatewayProviderSourceProfile, normalizeGatewayExecutionMode, resolveGatewayProviderSourceProfileForWrite, validateGatewayProviderPayload } from "./provider-source-profile";
import { defaultRoutePolicyConfig, normalizeGatewayModelAliasScopeType, readProviderAccountPayload, toGatewayModelAliasView, toGatewayProviderAccountView, toGatewayRoutePolicyView } from "./views";
import { buildGatewayProjectConcurrencyKey, buildGatewayProviderBreakerOpenKey, buildGatewayProviderConcurrencyKey, invalidateCachedProviderModels, probeGatewayProviderAccount, readRedisInt, sweepGatewayCoolingProviders, withProviderProbeLock } from "./provider-health";
import { getGatewayProjectById } from "./routing";

export async function listGatewayProviderHealthForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayProviderHealthOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const rows = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(
      and(
        or(eq(gatewayProviderAccounts.status, "active"), eq(gatewayProviderAccounts.status, "cooling"), eq(gatewayProviderAccounts.status, "disabled")),
        filters.providerAccountId ? eq(gatewayProviderAccounts.id, filters.providerAccountId) : undefined,
        filters.protocolFamily ? eq(gatewayProviderAccounts.protocolFamily, filters.protocolFamily) : undefined,
        filters.status ? eq(gatewayProviderAccounts.status, filters.status) : undefined,
      ),
    )
    .orderBy(asc(gatewayProviderAccounts.label));

  const healthRows = await Promise.all(
    rows.map(async (row) => {
      const [activeConcurrencyRaw, breakerOpenRaw] = await Promise.all([
        redis.get(buildGatewayProviderConcurrencyKey(row.id)).catch(() => null),
        redis.get(buildGatewayProviderBreakerOpenKey(row.id)).catch(() => null),
      ]);
      const activeConcurrency =
        typeof activeConcurrencyRaw === "string" && Number.isFinite(Number(activeConcurrencyRaw))
          ? Math.max(0, Math.floor(Number(activeConcurrencyRaw)))
          : 0;
      const routingScore = buildGatewayProviderRoutingScore({
        status: row.status as GatewayProviderHealthView["status"],
        failureCount: row.failureCount,
        breakerOpen: Boolean(breakerOpenRaw),
        activeConcurrency,
        providerConcurrencyLimit: null,
      });
      return {
        providerAccountId: row.id,
        label: row.label,
        adapter: row.adapter as GatewayProviderHealthView["adapter"],
        protocolFamily: row.protocolFamily as GatewayProtocolFamily,
        status: row.status as GatewayProviderHealthView["status"],
        cooldownUntil: row.cooldownUntil ? row.cooldownUntil.toISOString() : null,
        failureCount: row.failureCount,
        lastError: row.lastError,
        lastHealthCheckAt: row.lastHealthCheckAt ? row.lastHealthCheckAt.toISOString() : null,
        activeConcurrency,
        breakerOpen: Boolean(breakerOpenRaw),
        routingScore: routingScore.score,
        healthWeight: routingScore.healthWeight,
        capacityWeight: routingScore.capacityWeight,
        degraded: routingScore.degraded,
        saturated: routingScore.saturated,
        degradationReasons: routingScore.degradationReasons,
      } satisfies GatewayProviderHealthView;
    }),
  );

  return healthRows;
}

export async function listGatewayRuntimePressureForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRuntimePressureOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const runningRows = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      and(
        eq(gatewayRequestAudits.status, "running"),
        filters.projectId ? eq(gatewayRequestAudits.projectId, filters.projectId) : undefined,
        filters.providerAccountId ? eq(gatewayRequestAudits.providerAccountId, filters.providerAccountId) : undefined,
      ),
    )
    .orderBy(desc(gatewayRequestAudits.createdAt))
    .limit(limit);

  const projectIds = Array.from(new Set(runningRows.map((row) => row.projectId).filter(Boolean)));
  const providerIds = Array.from(
    new Set(
      runningRows
        .map((row) => row.providerAccountId)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );

  if (filters.projectId && !projectIds.includes(filters.projectId)) {
    projectIds.push(filters.projectId);
  }
  if (filters.providerAccountId && !providerIds.includes(filters.providerAccountId)) {
    providerIds.push(filters.providerAccountId);
  }

  const [projects, providers] = await Promise.all([
    projectIds.length > 0
      ? db.select().from(gatewayProjects).where(inArray(gatewayProjects.id, projectIds))
      : Promise.resolve([] as GatewayProjectRow[]),
    providerIds.length > 0
      ? db.select().from(gatewayProviderAccounts).where(inArray(gatewayProviderAccounts.id, providerIds))
      : Promise.resolve([] as GatewayProviderAccountRow[]),
  ]);

  const projectCounts = new Map<string, number>();
  const providerCounts = new Map<string, number>();
  for (const row of runningRows) {
    projectCounts.set(row.projectId, (projectCounts.get(row.projectId) ?? 0) + 1);
    if (row.providerAccountId) {
      providerCounts.set(row.providerAccountId, (providerCounts.get(row.providerAccountId) ?? 0) + 1);
    }
  }

  const projectViews = await Promise.all(
    projects.map(async (project) => ({
      projectId: project.id,
      displayName: project.displayName,
      activeConcurrency: await readRedisInt(buildGatewayProjectConcurrencyKey(project.id)),
      runningRequestCount: projectCounts.get(project.id) ?? 0,
    }) satisfies GatewayProjectPressureView),
  );

  const providerViews = await Promise.all(
    providers.map(async (provider) => ({
      providerAccountId: provider.id,
      label: provider.label,
      status: provider.status as GatewayProviderPressureView["status"],
      protocolFamily: provider.protocolFamily as GatewayProtocolFamily,
      activeConcurrency: await readRedisInt(buildGatewayProviderConcurrencyKey(provider.id)),
      runningRequestCount: providerCounts.get(provider.id) ?? 0,
      breakerOpen: Boolean(await redis.get(buildGatewayProviderBreakerOpenKey(provider.id)).catch(() => null)),
    }) satisfies GatewayProviderPressureView),
  );

  return {
    totalRunningRequests: runningRows.length,
    totalProjectConcurrency: projectViews.reduce((sum, row) => sum + row.activeConcurrency, 0),
    totalProviderConcurrency: providerViews.reduce((sum, row) => sum + row.activeConcurrency, 0),
    projects: projectViews.sort((left, right) => right.activeConcurrency - left.activeConcurrency || right.runningRequestCount - left.runningRequestCount),
    providers: providerViews.sort((left, right) => right.activeConcurrency - left.activeConcurrency || right.runningRequestCount - left.runningRequestCount),
  } satisfies GatewayRuntimePressureView;
}

export async function getGatewayProviderHealthSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayProviderHealthOperatorFilters = {},
) {
  const rows = await listGatewayProviderHealthForOperator(operatorUserId, providerUserId, filters);
  return {
    totalProviders: rows.length,
    activeProviders: rows.filter((row) => row.status === "active").length,
    coolingProviders: rows.filter((row) => row.status === "cooling").length,
    disabledProviders: rows.filter((row) => row.status === "disabled").length,
    breakerOpenProviders: rows.filter((row) => row.breakerOpen).length,
    degradedProviders: rows.filter((row) => row.degraded).length,
    saturatedProviders: rows.filter((row) => row.saturated).length,
    totalActiveConcurrency: rows.reduce((sum, row) => sum + row.activeConcurrency, 0),
    avgRoutingScore: rows.length > 0 ? Math.round((rows.reduce((sum, row) => sum + row.routingScore, 0) / rows.length) * 1000) / 1000 : null,
  } satisfies GatewayProviderHealthSummaryView;
}

export async function probeGatewayProviderAccountForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  providerAccountId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [existing] = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(eq(gatewayProviderAccounts.id, providerAccountId))
    .limit(1);
  if (!existing) {
    throw new NotFoundError("Provider account 不存在。");
  }

  const locked = await withProviderProbeLock(providerAccountId, async () => {
    const [fresh] = await db
      .select()
      .from(gatewayProviderAccounts)
      .where(eq(gatewayProviderAccounts.id, providerAccountId))
      .limit(1);
    if (!fresh) {
      throw new NotFoundError("Provider account 不存在。");
    }

    try {
      await probeGatewayProviderAccount(fresh);
      const [updated] = await db
        .update(gatewayProviderAccounts)
        .set({
          status: "active",
          cooldownUntil: null,
          lastError: null,
          lastHealthCheckAt: now(),
          updatedAt: now(),
        })
        .where(eq(gatewayProviderAccounts.id, providerAccountId))
        .returning();
      return {
        ok: true,
        providerAccount: await toGatewayProviderAccountView(updated ?? fresh, { maskSecrets: true }),
      };
    } catch (error) {
      const message = truncateErrorSummary(error instanceof Error ? error.message : String(error));
      const [updated] = await db
        .update(gatewayProviderAccounts)
        .set({
          status: fresh.status === "archived" ? fresh.status : "cooling",
          cooldownUntil: fresh.status === "archived" ? fresh.cooldownUntil : new Date(Date.now() + 30_000),
          lastError: message,
          lastHealthCheckAt: now(),
          updatedAt: now(),
        })
        .where(eq(gatewayProviderAccounts.id, providerAccountId))
        .returning();
      return {
        ok: false,
        providerAccount: await toGatewayProviderAccountView(updated ?? fresh, { maskSecrets: true }),
        errorMessage: message,
      };
    }
  });

  if (!locked) {
    throw new ConflictError("当前 provider account 正在执行 probe，请稍后再试。");
  }

  return locked;
}

export async function runGatewayCoolingSweepForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  await sweepGatewayCoolingProviders();
  return {
    providerHealth: await listGatewayProviderHealthForOperator(operatorUserId, providerUserId),
    providerHealthSummary: await getGatewayProviderHealthSummaryForOperator(operatorUserId, providerUserId),
    readiness: await getGatewayReadinessReport(),
  };
}

export async function writeProviderPayloadObject(payload: GatewayProviderAccountPayload, objectKey: string) {
  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(payload, null, 2), "utf8"), "application/json");
}

export async function createGatewayProviderAccountForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: UpsertGatewayProviderAccountInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  validateGatewayProviderPayload(input);
  const payload = input.payload;
  const executionMode = normalizeGatewayExecutionMode(input.adapter, input.executionMode);
  const endpointExecutionModes = normalizeEndpointExecutionModes(input.adapter, input.endpointExecutionModes);
  const sourceProfile = resolveGatewayProviderSourceProfileForWrite({
    sourceProfile: input.sourceProfile,
    adapter: input.adapter,
    payload,
    executionMode,
    endpointExecutionModes,
  });
  const protocolFamily = normalizeGatewayProtocolFamily(input.protocolFamily);
  const protocolProfile = normalizeGatewayProtocolProfile(input.protocolProfile);
  const serviceProviderIdentity = normalizeGatewayServiceProviderIdentity(
    input.label,
    input.serviceProviderKey,
    input.serviceProviderLabel,
  );
  const storageMode = chooseProviderPayloadStorageMode(payload);
  const accountId = randomUUID();
  let payloadInline: GatewayProviderAccountPayload | null = null;
  let payloadObjectKey: string | null = null;
  if (storageMode === "inline") {
    payloadInline = payload;
  } else {
    payloadObjectKey = buildGatewayProviderAccountObjectKey(accountId);
    await writeProviderPayloadObject(payload, payloadObjectKey);
  }

  const [created] = await db
    .insert(gatewayProviderAccounts)
    .values({
      id: accountId,
      label: normalizeRequiredText(input.label, "Provider account 标题", 120),
      serviceProviderKey: serviceProviderIdentity.serviceProviderKey,
      serviceProviderLabel: serviceProviderIdentity.serviceProviderLabel,
      adapter: input.adapter,
      protocolFamily,
      protocolProfile,
      status: input.status ?? "active",
      sourceKind: sourceProfile.sourceKind,
      aggregatorApiMode: sourceProfile.aggregatorApiMode,
      webReverseAccessMode: sourceProfile.webReverseAccessMode,
      sourceNotes: sourceProfile.notes,
      executionMode,
      endpointExecutionModes,
      payloadInline,
      payloadObjectKey,
      payloadContentType: "application/json",
      storageMode,
      cooldownUntil: null,
      lastError: null,
      failureCount: 0,
      lastHealthCheckAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    })
    .returning();

  return toGatewayProviderAccountView(created, { maskSecrets: true });
}

export async function updateGatewayProviderAccountForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  providerAccountId: string,
  input: UpsertGatewayProviderAccountInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [existing] = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(eq(gatewayProviderAccounts.id, providerAccountId))
    .limit(1);
  if (!existing) {
    throw new NotFoundError("Provider account 不存在。");
  }

  validateGatewayProviderPayload(input);
  const payload = input.payload;
  const executionMode = normalizeGatewayExecutionMode(input.adapter, input.executionMode ?? existing.executionMode);
  const endpointExecutionModes = normalizeEndpointExecutionModes(
    input.adapter,
    input.endpointExecutionModes ?? ((existing.endpointExecutionModes as GatewayEndpointExecutionModeMap | null | undefined) ?? null),
  );
  const existingSourceProfile: GatewayProviderSourceProfile | undefined = existing.sourceKind
    ? {
        sourceKind: existing.sourceKind,
        aggregatorApiMode: existing.aggregatorApiMode ?? undefined,
        webReverseAccessMode: existing.webReverseAccessMode ?? undefined,
        notes: existing.sourceNotes ?? undefined,
      }
    : undefined;
  const sourceProfile = resolveGatewayProviderSourceProfileForWrite({
    sourceProfile: input.sourceProfile ?? existingSourceProfile,
    adapter: input.adapter,
    payload,
    executionMode,
    endpointExecutionModes,
  });
  const protocolFamily = normalizeGatewayProtocolFamily(input.protocolFamily);
  const protocolProfile = normalizeGatewayProtocolProfile(input.protocolProfile ?? existing.protocolProfile);
  const serviceProviderIdentity = normalizeGatewayServiceProviderIdentity(
    input.label,
    input.serviceProviderKey ?? existing.serviceProviderKey,
    input.serviceProviderLabel ?? existing.serviceProviderLabel,
  );
  const storageMode = chooseProviderPayloadStorageMode(payload);
  let payloadInline: GatewayProviderAccountPayload | null = null;
  let payloadObjectKey: string | null = existing.payloadObjectKey;
  await invalidateCachedProviderModels(providerAccountId);
  if (storageMode === "inline") {
    payloadInline = payload;
    if (existing.payloadObjectKey) {
      await deleteGatewayObject(existing.payloadObjectKey).catch(() => undefined);
      payloadObjectKey = null;
    }
  } else {
    payloadObjectKey = existing.payloadObjectKey ?? buildGatewayProviderAccountObjectKey(providerAccountId);
    await writeProviderPayloadObject(payload, payloadObjectKey);
  }

  const [updated] = await db
    .update(gatewayProviderAccounts)
    .set({
      label: normalizeRequiredText(input.label, "Provider account 标题", 120),
      serviceProviderKey: serviceProviderIdentity.serviceProviderKey,
      serviceProviderLabel: serviceProviderIdentity.serviceProviderLabel,
      adapter: input.adapter,
      protocolFamily,
      protocolProfile,
      status: input.status ?? existing.status,
      sourceKind: sourceProfile.sourceKind,
      aggregatorApiMode: sourceProfile.aggregatorApiMode,
      webReverseAccessMode: sourceProfile.webReverseAccessMode,
      sourceNotes: sourceProfile.notes,
      executionMode,
      endpointExecutionModes,
      payloadInline,
      payloadObjectKey,
      payloadContentType: "application/json",
      storageMode,
      updatedAt: now(),
    })
    .where(eq(gatewayProviderAccounts.id, providerAccountId))
    .returning();
  if (!updated) {
    throw new NotFoundError("Provider account 不存在。");
  }
  return toGatewayProviderAccountView(updated, { maskSecrets: true });
}

export async function patchGatewayProviderSourceProfileForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  providerAccountId: string,
  input: PatchGatewayProviderSourceProfileInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [existing] = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(eq(gatewayProviderAccounts.id, providerAccountId))
    .limit(1);
  if (!existing) {
    throw new NotFoundError("Provider account 不存在。");
  }

  const normalized = normalizeExplicitGatewayProviderSourceProfile(input.sourceProfile);
  const [updated] = await db
    .update(gatewayProviderAccounts)
    .set({
      sourceKind: normalized.sourceKind,
      aggregatorApiMode: normalized.aggregatorApiMode,
      webReverseAccessMode: normalized.webReverseAccessMode,
      sourceNotes: normalized.notes,
      updatedAt: now(),
    })
    .where(eq(gatewayProviderAccounts.id, providerAccountId))
    .returning();
  if (!updated) {
    throw new NotFoundError("Provider account 不存在。");
  }
  return toGatewayProviderAccountView(updated, { maskSecrets: true });
}

export async function backfillGatewayProviderSourceProfilesForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: GatewayProviderSourceProfileBackfillInput = {},
): Promise<GatewayProviderSourceProfileBackfillResult> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const providerAccountIds = Array.from(
    new Set(
      (input.providerAccountIds ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
  const rows = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(providerAccountIds.length > 0 ? inArray(gatewayProviderAccounts.id, providerAccountIds) : undefined)
    .orderBy(desc(gatewayProviderAccounts.updatedAt));

  const onlyMissing = input.onlyMissing !== false;
  const updatedProviderRows: GatewayProviderAccountRow[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    if (onlyMissing && row.sourceKind) {
      skippedCount += 1;
      continue;
    }
    const payload = await readProviderAccountPayload(row);
    const executionMode = normalizeGatewayExecutionMode(row.adapter, row.executionMode);
    const endpointExecutionModes = normalizeEndpointExecutionModes(
      row.adapter,
      (row.endpointExecutionModes as GatewayEndpointExecutionModeMap | null | undefined) ?? null,
    );
    const inferred = inferGatewayProviderSourceProfile({
      adapter: row.adapter,
      payload,
      executionMode,
      endpointExecutionModes,
    });
    const [updated] = await db
      .update(gatewayProviderAccounts)
      .set({
        sourceKind: inferred.sourceKind,
        aggregatorApiMode: inferred.aggregatorApiMode,
        webReverseAccessMode: inferred.webReverseAccessMode,
        sourceNotes: inferred.notes,
        updatedAt: now(),
      })
      .where(eq(gatewayProviderAccounts.id, row.id))
      .returning();
    if (updated) {
      updatedProviderRows.push(updated);
    }
  }

  return {
    scannedCount: rows.length,
    updatedCount: updatedProviderRows.length,
    skippedCount,
    providerAccounts: await Promise.all(
      updatedProviderRows.map((row) => toGatewayProviderAccountView(row, { maskSecrets: true })),
    ),
  };
}

export async function saveGatewayModelAliasForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  aliasId: string | null,
  input: UpsertGatewayModelAliasInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [providerAccount] = await db
    .select({ id: gatewayProviderAccounts.id })
    .from(gatewayProviderAccounts)
    .where(eq(gatewayProviderAccounts.id, input.providerAccountId))
    .limit(1);
  if (!providerAccount) {
    throw new NotFoundError("Provider account 不存在。");
  }

  if (aliasId) {
    const [updated] = await db
      .update(gatewayModelAliases)
      .set({
        projectId: input.projectId ?? null,
        scopeType: normalizeGatewayModelAliasScopeType(input.scopeType),
        alias: normalizeRequiredText(input.alias, "模型别名", 120),
        providerAccountId: input.providerAccountId,
        upstreamModel: normalizeOptionalText(input.upstreamModel, 120),
        priority: normalizeNonNegativeInt(input.priority, 100) ?? 100,
        weight: normalizeNonNegativeInt(input.weight, 1) ?? 1,
        enabled: input.enabled ?? true,
        updatedAt: now(),
      })
      .where(eq(gatewayModelAliases.id, aliasId))
      .returning();
    if (!updated) {
      throw new NotFoundError("模型别名不存在。");
    }
    return toGatewayModelAliasView(updated);
  }

  const [created] = await db
    .insert(gatewayModelAliases)
    .values({
      id: randomUUID(),
      projectId: input.projectId ?? null,
      scopeType: normalizeGatewayModelAliasScopeType(input.scopeType),
      alias: normalizeRequiredText(input.alias, "模型别名", 120),
      providerAccountId: input.providerAccountId,
      upstreamModel: normalizeOptionalText(input.upstreamModel, 120),
      priority: normalizeNonNegativeInt(input.priority, 100) ?? 100,
      weight: normalizeNonNegativeInt(input.weight, 1) ?? 1,
      enabled: input.enabled ?? true,
      createdAt: now(),
      updatedAt: now(),
    })
    .returning();
  return toGatewayModelAliasView(created);
}

export async function saveGatewayRoutePolicyForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  policyId: string | null,
  input: UpsertGatewayRoutePolicyInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const project = await getGatewayProjectById(input.projectId);
  if (!project) {
    throw new NotFoundError("AI gateway project 不存在。");
  }

  const defaults = defaultRoutePolicyConfig();
  const normalizedGuardrails = normalizeRoutePolicyGuardrails({
    maxRequestBodyBytes: input.config.maxRequestBodyBytes ?? null,
    streamIdleTimeoutSeconds: input.config.streamIdleTimeoutSeconds ?? null,
    totalRequestTimeoutSeconds: input.config.totalRequestTimeoutSeconds ?? null,
    maxStreamHeartbeatGapSeconds: input.config.maxStreamHeartbeatGapSeconds ?? null,
  });

  const normalizedConfig: GatewayRoutePolicyConfig = {
    stickySessions: input.config.stickySessions !== false,
    preStreamFallbackEnabled: input.config.preStreamFallbackEnabled !== false,
    selectionStrategy: input.config.selectionStrategy === "priority" ? "priority" : "weighted_random",
    providerLoadAwareRoutingEnabled: input.config.providerLoadAwareRoutingEnabled !== false,
    maxConcurrentRequests: normalizeNonNegativeInt(input.config.maxConcurrentRequests, null),
    providerMaxConcurrentRequests: normalizeNonNegativeInt(input.config.providerMaxConcurrentRequests, null),
    rateLimitWindowSeconds: normalizeNonNegativeInt(input.config.rateLimitWindowSeconds, null),
    rateLimitMaxRequests: normalizeNonNegativeInt(input.config.rateLimitMaxRequests, null),
    apiKeyRateLimit: normalizeRoutePolicyRateLimitDefinition(
      "apiKeyRateLimit",
      input.config.apiKeyRateLimit ?? null,
      defaults.apiKeyRateLimit ?? null,
    ),
    modelRateLimits: normalizeRoutePolicyRateLimitMap(
      "modelRateLimits",
      input.config.modelRateLimits ?? null,
      defaults.modelRateLimits ?? null,
      { normalizeKey: (key) => key.toLowerCase() },
    ),
    endpointRateLimits: normalizeRoutePolicyRateLimitMap(
      "endpointRateLimits",
      input.config.endpointRateLimits ?? null,
      defaults.endpointRateLimits ?? null,
      { normalizeKey: (key) => key.toLowerCase() },
    ),
    circuitBreakerThreshold: normalizeNonNegativeInt(input.config.circuitBreakerThreshold, 3) ?? 3,
    circuitBreakerCooldownSeconds: normalizeNonNegativeInt(input.config.circuitBreakerCooldownSeconds, 60) ?? 60,
    allowedProviderAccountIds: normalizeStringList(input.config.allowedProviderAccountIds ?? null),
    allowedProtocolFamilies: normalizeStringList(input.config.allowedProtocolFamilies ?? null) as GatewayProtocolFamily[] | null,
    allowedModelIds: normalizeStringList(input.config.allowedModelIds ?? null, { lowerCase: true }),
    blockedModelIds: normalizeStringList(input.config.blockedModelIds ?? null, { lowerCase: true }),
    routingAnomalyAutoRemediation: normalizeRoutePolicyRoutingAnomalyAutoRemediationProfile(
      input.config.routingAnomalyAutoRemediation ?? null,
      defaults.routingAnomalyAutoRemediation ?? null,
    ),
    fallbackHttpStatuses:
      (input.config.fallbackHttpStatuses ?? defaults.fallbackHttpStatuses ?? [])
        .filter((value) => Number.isInteger(value) && value >= 100 && value <= 599)
        .map((value) => Math.floor(value)),
    fallbackErrorCodes: normalizeStringList(
      input.config.fallbackErrorCodes ?? defaults.fallbackErrorCodes ?? null,
      { lowerCase: true },
    ),
    rateLimitHotspotAutoRemediation: normalizeRoutePolicyRateLimitHotspotAutoRemediationProfile(
      input.config.rateLimitHotspotAutoRemediation ?? null,
      defaults.rateLimitHotspotAutoRemediation ?? null,
    ),
    ...normalizedGuardrails,
  };

  return db.transaction(async (tx) => {
    const timestamp = now();
    if (policyId) {
      const [updated] = await tx
        .update(gatewayRoutePolicies)
        .set({
          projectId: input.projectId,
          name: normalizeRequiredText(input.name, "route policy 标题", 120),
          isDefault: input.isDefault ?? false,
          enabled: input.enabled ?? true,
          config: normalizedConfig,
          updatedAt: timestamp,
        })
        .where(eq(gatewayRoutePolicies.id, policyId))
        .returning();
      if (!updated) {
        throw new NotFoundError("Route policy 不存在。");
      }
      if (updated.isDefault) {
        await tx
          .update(gatewayProjects)
          .set({
            defaultRoutePolicyId: updated.id,
            updatedAt: timestamp,
          })
          .where(eq(gatewayProjects.id, updated.projectId));
        await tx
          .update(gatewayRoutePolicies)
          .set({
            isDefault: false,
            updatedAt: timestamp,
          })
          .where(and(eq(gatewayRoutePolicies.projectId, updated.projectId), sql`${gatewayRoutePolicies.id} <> ${updated.id}`));
      }
      return toGatewayRoutePolicyView(updated);
    }

    const [created] = await tx
      .insert(gatewayRoutePolicies)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        name: normalizeRequiredText(input.name, "route policy 标题", 120),
        isDefault: input.isDefault ?? false,
        enabled: input.enabled ?? true,
        config: normalizedConfig,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (created.isDefault || !project.defaultRoutePolicyId) {
      await tx
        .update(gatewayProjects)
        .set({
          defaultRoutePolicyId: created.id,
          updatedAt: timestamp,
        })
        .where(eq(gatewayProjects.id, input.projectId));
      await tx
        .update(gatewayRoutePolicies)
        .set({
          isDefault: false,
          updatedAt: timestamp,
        })
        .where(and(eq(gatewayRoutePolicies.projectId, input.projectId), sql`${gatewayRoutePolicies.id} <> ${created.id}`));
      created.isDefault = true;
    }

    return toGatewayRoutePolicyView(created);
  });
}

export async function getGatewayReadinessReport() {
  const checks = {
    database: false,
    redis: false,
    objectStorage: false,
    apiKeySecret: Boolean(env.apiKeySecret?.trim()),
    publicBaseUrl: Boolean(env.publicBaseUrl?.trim()),
  };
  let providerStats = {
    activeProviders: 0,
    coolingProviders: 0,
    disabledProviders: 0,
  };

  try {
    await db.execute(sql`select 1`);
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    const pong = await redis.ping();
    checks.redis = typeof pong === "string" && pong.toUpperCase() === "PONG";
  } catch {
    checks.redis = false;
  }

  try {
    if (env.objectStorageDriver === "local") {
      await mkdir(env.objectStorageLocalDir, { recursive: true });
      checks.objectStorage = true;
    } else {
      checks.objectStorage = Boolean(
        env.objectStorageBucket &&
          env.objectStorageEndpoint &&
          env.objectStorageAccessKeyId &&
          env.objectStorageSecretAccessKey,
      );
    }
  } catch {
    checks.objectStorage = false;
  }

  try {
    const rows = await db
      .select({
        status: gatewayProviderAccounts.status,
        count: sql<number>`count(*)`,
      })
      .from(gatewayProviderAccounts)
      .groupBy(gatewayProviderAccounts.status);
    providerStats = rows.reduce(
      (accumulator, row) => {
        if (row.status === "active") {
          accumulator.activeProviders = Number(row.count ?? 0);
        } else if (row.status === "cooling") {
          accumulator.coolingProviders = Number(row.count ?? 0);
        } else if (row.status === "disabled") {
          accumulator.disabledProviders = Number(row.count ?? 0);
        }
        return accumulator;
      },
      {
        activeProviders: 0,
        coolingProviders: 0,
        disabledProviders: 0,
      },
    );
  } catch {
    providerStats = {
      activeProviders: 0,
      coolingProviders: 0,
      disabledProviders: 0,
    };
  }

  return {
    ok:
      checks.database &&
      checks.redis &&
      checks.objectStorage &&
      checks.apiKeySecret &&
      checks.publicBaseUrl,
    checks,
    providerStats,
  };
}
