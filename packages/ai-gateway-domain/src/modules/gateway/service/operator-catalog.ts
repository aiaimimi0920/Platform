import type { GatewayModelAliasScopeType, GatewayProviderAccountPayload, GatewayProviderInventoryEntryView, GatewayProviderInventorySummaryView, GatewayProviderInventoryView, GatewayProviderCostHintsView, GatewayPriceRateView, GatewayProviderAccountView, GatewayModelAssociationAliasRowView, GatewayModelAssociationMatrixView, GatewayModelAssociationProviderAliasLinkView, GatewayModelAssociationProviderLinkView, GatewayModelAssociationProviderRowView, GatewayCostOverviewView } from "@neuro/contracts";
import { asc, desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { gatewayApiKeys, gatewayModelAliases, gatewayProjects, gatewayProviderAccounts, gatewayRequestAudits, gatewayRoutePolicies, gatewayTenants } from "@/modules/gateway/schema";

import { assertPlatformOperator, now, toSummaryBuckets } from "./shared";
import { toGatewayApiKeyView, toGatewayModelAliasView, toGatewayProjectView, toGatewayProviderAccountView, toGatewayRoutePolicyView, toGatewayTenantView } from "./views";
import { listGatewayProviderHealthForOperator } from "./provider-admin";

export type GatewayCostBucketContributionView = {
  providerAccountId: string;
  label: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  staticCostMicros: number | null;
  observedCostMicros: number | null;
};

export type GatewayCostBucketView = {
  key: string;
  label: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  staticCostMicros: number | null;
  observedCostMicros: number | null;
  userQuoteMicros: number | null;
  configuredStaticPrice: boolean;
  configuredUserQuote: boolean;
  lastRequestAt: string | null;
  providerContributions: GatewayCostBucketContributionView[];
};

export type GatewayPricingQuoteView = {
  scopeType: "provider" | "model_alias";
  scopeId: string;
  label: string;
  staticRate: GatewayPriceRateView;
  platformQuoteRate: GatewayPriceRateView;
  observedRequestCount: number;
  observedPromptTokens: number;
  observedCompletionTokens: number;
  observedTotalTokens: number;
  observedCostMicros: number | null;
  userQuoteMicros: number | null;
  lastRequestAt: string | null;
};

export async function listGatewayOperatorCatalog(operatorUserId: string, providerUserId?: string | null) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const [
    tenants,
    projects,
    apiKeys,
    providerAccounts,
    modelAliases,
    routePolicies,
    providerAccountCountRows,
    modelAliasCountRows,
    routePolicyCountRows,
  ] = await Promise.all([
    db.select().from(gatewayTenants).orderBy(desc(gatewayTenants.updatedAt)).limit(200),
    db.select().from(gatewayProjects).orderBy(desc(gatewayProjects.updatedAt)).limit(400),
    db.select().from(gatewayApiKeys).orderBy(desc(gatewayApiKeys.updatedAt)).limit(400),
    db.select().from(gatewayProviderAccounts).orderBy(desc(gatewayProviderAccounts.updatedAt)),
    db
      .select()
      .from(gatewayModelAliases)
      .orderBy(asc(gatewayModelAliases.alias), asc(gatewayModelAliases.priority)),
    db.select().from(gatewayRoutePolicies).orderBy(desc(gatewayRoutePolicies.updatedAt)),
    db.select({ count: sql<number>`count(*)` }).from(gatewayProviderAccounts),
    db.select({ count: sql<number>`count(*)` }).from(gatewayModelAliases),
    db.select({ count: sql<number>`count(*)` }).from(gatewayRoutePolicies),
  ]);
  const catalogMetadata = {
    providerAccountCount: Number(providerAccountCountRows[0]?.count ?? 0),
    modelAliasCount: Number(modelAliasCountRows[0]?.count ?? 0),
    routePolicyCount: Number(routePolicyCountRows[0]?.count ?? 0),
    fetchedProviderAccounts: providerAccounts.length,
    fetchedModelAliases: modelAliases.length,
    fetchedRoutePolicies: routePolicies.length,
  };

  return {
    tenants: tenants.map(toGatewayTenantView),
    projects: projects.map(toGatewayProjectView),
    apiKeys: apiKeys.map(toGatewayApiKeyView),
    providerAccounts: await Promise.all(
      providerAccounts.map((row) => toGatewayProviderAccountView(row, { maskSecrets: true })),
    ),
    modelAliases: modelAliases.map(toGatewayModelAliasView),
    routePolicies: routePolicies.map(toGatewayRoutePolicyView),
    catalogMetadata,
  };
}

export type GatewayUsageAggregate = {
  requestCount: number;
  failureCount: number;
  recentRequestCount10m: number;
  recentFailureCount10m: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  lastRequestAt: string | null;
  estimatedObservedCostMicros: number | null;
};

export type GatewayUsageAuditRow = {
  providerAccountId: string | null;
  modelAlias: string | null;
  requestedModel: string | null;
  resolvedModel: string | null;
  status: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: Date;
};

export function emptyGatewayUsageAggregate(): GatewayUsageAggregate {
  return {
    requestCount: 0,
    failureCount: 0,
    recentRequestCount10m: 0,
    recentFailureCount10m: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    lastRequestAt: null,
    estimatedObservedCostMicros: null,
  };
}

export const USAGE_SAMPLE_LIMIT = 2000;

export function mergeGatewayUsageAggregate(target: GatewayUsageAggregate, source: GatewayUsageAggregate) {
  target.requestCount += source.requestCount;
  target.failureCount += source.failureCount;
  target.recentRequestCount10m += source.recentRequestCount10m;
  target.recentFailureCount10m += source.recentFailureCount10m;
  target.promptTokens += source.promptTokens;
  target.completionTokens += source.completionTokens;
  target.totalTokens += source.totalTokens;
  if (source.lastRequestAt && (!target.lastRequestAt || source.lastRequestAt > target.lastRequestAt)) {
    target.lastRequestAt = source.lastRequestAt;
  }
  if (source.estimatedObservedCostMicros != null) {
    target.estimatedObservedCostMicros =
      (target.estimatedObservedCostMicros ?? 0) + source.estimatedObservedCostMicros;
  }
  return target;
}

export function normalizeGatewayPriceValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
  }
  return null;
}

export function readGatewayPricingField(
  payload: GatewayProviderAccountPayload | Record<string, unknown>,
  keys: readonly string[],
): number | null {
  const payloadRecord = payload as Record<string, unknown>;
  const extraBody =
    "extraBody" in payloadRecord && payloadRecord.extraBody && typeof payloadRecord.extraBody === "object"
      ? (payloadRecord.extraBody as Record<string, unknown>)
      : null;

  for (const key of keys) {
    const direct = normalizeGatewayPriceValue(payloadRecord[key]);
    if (direct != null) {
      return direct;
    }
    if (extraBody) {
      const extra = normalizeGatewayPriceValue(extraBody[key]);
      if (extra != null) {
        return extra;
      }
    }
  }

  return null;
}

export function buildGatewayPriceRateView(
  payload: GatewayProviderAccountPayload | Record<string, unknown>,
  mode: "static" | "quote",
): GatewayPriceRateView {
  const promptMicrosPer1kTokens =
    mode === "static"
      ? readGatewayPricingField(payload, ["staticInputMicrosPer1kTokens", "pricingInputMicrosPer1kTokens"])
      : readGatewayPricingField(payload, ["platformQuoteInputMicrosPer1kTokens", "quoteInputMicrosPer1kTokens"]);
  const completionMicrosPer1kTokens =
    mode === "static"
      ? readGatewayPricingField(payload, ["staticOutputMicrosPer1kTokens", "pricingOutputMicrosPer1kTokens"])
      : readGatewayPricingField(payload, ["platformQuoteOutputMicrosPer1kTokens", "quoteOutputMicrosPer1kTokens"]);

  return {
    promptMicrosPer1kTokens,
    completionMicrosPer1kTokens,
    currency: "USD",
    configured: promptMicrosPer1kTokens != null || completionMicrosPer1kTokens != null,
    source:
      promptMicrosPer1kTokens != null || completionMicrosPer1kTokens != null ? "payload" : "unconfigured",
  };
}

export function estimateGatewayObservedCostMicros(
  aggregate: Pick<GatewayUsageAggregate, "promptTokens" | "completionTokens">,
  rate: GatewayPriceRateView,
): number | null {
  if (!rate.configured) {
    return null;
  }

  const promptCostMicros =
    rate.promptMicrosPer1kTokens != null
      ? Math.round((aggregate.promptTokens * rate.promptMicrosPer1kTokens) / 1000)
      : 0;
  const completionCostMicros =
    rate.completionMicrosPer1kTokens != null
      ? Math.round((aggregate.completionTokens * rate.completionMicrosPer1kTokens) / 1000)
      : 0;

  return promptCostMicros + completionCostMicros;
}

export function readGatewayModelStaticPricingCoverage(
  payload: GatewayProviderAccountView["payload"],
  staticRate: GatewayPriceRateView,
): GatewayProviderCostHintsView["staticPricingCoverage"] {
  const directRecord =
    payload && typeof payload === "object" && "modelPricing" in payload && payload.modelPricing
      ? payload.modelPricing
      : payload && typeof payload === "object" && "model_pricing" in payload && payload.model_pricing
        ? payload.model_pricing
        : null;
  const map = directRecord && typeof directRecord === "object" ? directRecord : null;

  if (!map) {
    const defaultModel =
      "defaultModel" in payload && typeof payload.defaultModel === "string" && payload.defaultModel.trim()
        ? payload.defaultModel.trim()
        : null;
    if (defaultModel && staticRate.configured) {
      return {
        totalModels: 1,
        configuredModels: 1,
        fullyConfigured: true,
        configuredEntries: [{ model: defaultModel, staticRate }],
        missingModels: [],
      };
    }
    return {
      totalModels: 0,
      configuredModels: 0,
      fullyConfigured: false,
      configuredEntries: [],
      missingModels: [],
    };
  }

  const configuredEntries = Object.entries(map)
    .map(([model, entry]) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const staticRate = buildGatewayPriceRateView(entry as Record<string, unknown>, "static");
      if (!staticRate.configured) {
        return null;
      }
      return { model, staticRate };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => left.model.localeCompare(right.model));

  return {
    totalModels: Object.keys(map).length,
    configuredModels: configuredEntries.length,
    fullyConfigured: Object.keys(map).length > 0 && configuredEntries.length === Object.keys(map).length,
    configuredEntries,
    missingModels: Object.keys(map)
      .filter((model) => !configuredEntries.some((entry) => entry.model === model))
      .sort((left, right) => left.localeCompare(right)),
  };
}

export function buildGatewayProviderCostHints(
  provider: GatewayProviderAccountView,
  aggregate: GatewayUsageAggregate,
): GatewayProviderCostHintsView {
  const staticRate = buildGatewayPriceRateView(provider.payload, "static");
  const platformQuoteRate = buildGatewayPriceRateView(provider.payload, "quote");
  const observedCostMicros = estimateGatewayObservedCostMicros(aggregate, staticRate);

  return {
    staticRate,
    platformQuoteRate,
    staticPricingCoverage: readGatewayModelStaticPricingCoverage(provider.payload, staticRate),
    observedRequestCount: aggregate.requestCount,
    observedFailureCount: aggregate.failureCount,
    recentRequestCount10m: aggregate.recentRequestCount10m,
    recentFailureCount10m: aggregate.recentFailureCount10m,
    observedPromptTokens: aggregate.promptTokens,
    observedCompletionTokens: aggregate.completionTokens,
    observedTotalTokens: aggregate.totalTokens,
    observedCostMicros,
    observedCostSource: observedCostMicros != null ? "configured_rate_estimate" : "unavailable",
    lastRequestAt: aggregate.lastRequestAt,
  };
}

export async function listGatewayRecentUsageAuditRows(limit = USAGE_SAMPLE_LIMIT): Promise<GatewayUsageAuditRow[]> {
  const rows = await db
    .select({
      providerAccountId: gatewayRequestAudits.providerAccountId,
      modelAlias: gatewayRequestAudits.modelAlias,
      requestedModel: gatewayRequestAudits.requestedModel,
      resolvedModel: gatewayRequestAudits.resolvedModel,
      status: gatewayRequestAudits.status,
      promptTokens: gatewayRequestAudits.promptTokens,
      completionTokens: gatewayRequestAudits.completionTokens,
      totalTokens: gatewayRequestAudits.totalTokens,
      createdAt: gatewayRequestAudits.createdAt,
    })
    .from(gatewayRequestAudits)
    .orderBy(desc(gatewayRequestAudits.createdAt))
    .limit(Math.max(100, Math.min(limit, 5000)));

  return rows;
}

export function aggregateGatewayUsageRowsByKey(
  rows: GatewayUsageAuditRow[],
  keyResolver: (row: GatewayUsageAuditRow) => string | null,
  observedCostResolver?: (row: GatewayUsageAuditRow) => number | null,
) {
  const aggregates = new Map<string, GatewayUsageAggregate>();
  const recentWindowStart = Date.now() - 10 * 60 * 1000;

  for (const row of rows) {
    const key = keyResolver(row);
    if (!key) {
      continue;
    }

    const promptTokens = Math.max(0, row.promptTokens ?? 0);
    const completionTokens = Math.max(0, row.completionTokens ?? 0);
    const totalTokens = Math.max(0, row.totalTokens ?? promptTokens + completionTokens);
    const observedCostMicros = observedCostResolver ? observedCostResolver(row) : null;
    const existing = aggregates.get(key) ?? emptyGatewayUsageAggregate();
    const isFailed = row.status === "failed";
    const isRecent = row.createdAt.getTime() >= recentWindowStart;

    existing.requestCount += 1;
    existing.failureCount += isFailed ? 1 : 0;
    existing.recentRequestCount10m += isRecent ? 1 : 0;
    existing.recentFailureCount10m += isRecent && isFailed ? 1 : 0;
    existing.promptTokens += promptTokens;
    existing.completionTokens += completionTokens;
    existing.totalTokens += totalTokens;
    if (!existing.lastRequestAt || row.createdAt.toISOString() > existing.lastRequestAt) {
      existing.lastRequestAt = row.createdAt.toISOString();
    }
    if (observedCostMicros != null) {
      existing.estimatedObservedCostMicros = (existing.estimatedObservedCostMicros ?? 0) + observedCostMicros;
    }

    aggregates.set(key, existing);
  }

  return aggregates;
}

export function readGatewayProviderDefaultModel(payload: GatewayProviderAccountPayload): string | null {
  if ("defaultModel" in payload && typeof payload.defaultModel === "string" && payload.defaultModel.trim()) {
    return payload.defaultModel.trim();
  }
  return null;
}

export function buildGatewayFallbackPriorityLabel(links: GatewayModelAssociationProviderLinkView[]) {
  if (links.length === 0) {
    return "未绑定 provider";
  }
  return links
    .slice()
    .sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label))
    .map((link) => `${link.label}(P${link.priority})`)
    .join(" -> ");
}

export async function getGatewayProviderInventoryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
): Promise<GatewayProviderInventoryView> {
  assertPlatformOperator(operatorUserId, providerUserId);

  const [catalog, providerHealth, usageRows] = await Promise.all([
    listGatewayOperatorCatalog(operatorUserId, providerUserId),
    listGatewayProviderHealthForOperator(operatorUserId, providerUserId),
    listGatewayRecentUsageAuditRows(),
  ]);

  const healthByProviderId = new Map(providerHealth.map((row) => [row.providerAccountId, row] as const));
  const usageByProviderId = aggregateGatewayUsageRowsByKey(usageRows, (row) => row.providerAccountId);

  const providers = catalog.providerAccounts
    .map((provider) => {
      const usageAggregate = usageByProviderId.get(provider.id) ?? emptyGatewayUsageAggregate();
      return {
        providerAccount: provider,
        providerHealth: healthByProviderId.get(provider.id) ?? null,
        costHints: buildGatewayProviderCostHints(provider, usageAggregate),
        providerQuota: null,
      } satisfies GatewayProviderInventoryEntryView;
    })
    .sort((left, right) => {
      const leftScore = left.providerHealth?.routingScore ?? -1;
      const rightScore = right.providerHealth?.routingScore ?? -1;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return left.providerAccount.label.localeCompare(right.providerAccount.label);
    });

  const bySourceKind = new Map<string, number>();
  const byProtocolFamily = new Map<string, number>();
  const byAdapter = new Map<string, number>();
  let configuredSourceProfiles = 0;
  let derivedSourceProfiles = 0;
  let providersWithObservedCost = 0;
  let providersWithPlatformQuote = 0;
  const providerIdentityKeys = new Set<string>();
  const activeProviderIdentityKeys = new Set<string>();
  const degradedProviderIdentityKeys = new Set<string>();
  const breakerOpenProviderIdentityKeys = new Set<string>();

  for (const entry of providers) {
    const identityKey =
      entry.providerAccount.serviceProviderKey?.trim() || `surface:${entry.providerAccount.id}`;
    providerIdentityKeys.add(identityKey);
    if (entry.providerAccount.status === "active") {
      activeProviderIdentityKeys.add(identityKey);
    }
    if (entry.providerHealth?.degraded) {
      degradedProviderIdentityKeys.add(identityKey);
    }
    if (entry.providerHealth?.breakerOpen) {
      breakerOpenProviderIdentityKeys.add(identityKey);
    }
    bySourceKind.set(
      entry.providerAccount.sourceProfile.sourceKind,
      (bySourceKind.get(entry.providerAccount.sourceProfile.sourceKind) ?? 0) + 1,
    );
    byProtocolFamily.set(
      entry.providerAccount.protocolFamily,
      (byProtocolFamily.get(entry.providerAccount.protocolFamily) ?? 0) + 1,
    );
    byAdapter.set(entry.providerAccount.adapter, (byAdapter.get(entry.providerAccount.adapter) ?? 0) + 1);
    if (entry.providerAccount.sourceProfile.derived) {
      derivedSourceProfiles += 1;
    } else {
      configuredSourceProfiles += 1;
    }
    if (entry.costHints.observedCostMicros != null) {
      providersWithObservedCost += 1;
    }
    if (entry.costHints.platformQuoteRate.configured) {
      providersWithPlatformQuote += 1;
    }
  }

  return {
    providers,
    summary: {
      totalProviders: providerIdentityKeys.size,
      totalProviderSurfaces: providers.length,
      activeProviders: activeProviderIdentityKeys.size,
      activeProviderSurfaces: providers.filter((entry) => entry.providerAccount.status === "active").length,
      degradedProviders: degradedProviderIdentityKeys.size,
      degradedProviderSurfaces: providers.filter((entry) => entry.providerHealth?.degraded).length,
      breakerOpenProviders: breakerOpenProviderIdentityKeys.size,
      breakerOpenProviderSurfaces: providers.filter((entry) => entry.providerHealth?.breakerOpen).length,
      totalActiveConcurrency: providers.reduce(
        (sum, entry) => sum + (entry.providerHealth?.activeConcurrency ?? 0),
        0,
      ),
      avgRoutingScore:
        providers.length > 0
          ? Number(
              (
                providers.reduce((sum, entry) => sum + (entry.providerHealth?.routingScore ?? 0), 0) /
                providers.length
              ).toFixed(3),
            )
          : null,
      configuredSourceProfiles,
      derivedSourceProfiles,
      providersWithObservedCost,
      providersWithPlatformQuote,
      providersWithQuota: 0,
      warningQuotaProviders: 0,
      exhaustedQuotaProviders: 0,
      bySourceKind: toSummaryBuckets(bySourceKind),
      byProtocolFamily: toSummaryBuckets(byProtocolFamily),
      byAdapter: toSummaryBuckets(byAdapter),
      catalogMetadata: catalog.catalogMetadata,
    } satisfies GatewayProviderInventorySummaryView,
  };
}

export async function getGatewayModelAssociationMatrixForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
): Promise<GatewayModelAssociationMatrixView> {
  assertPlatformOperator(operatorUserId, providerUserId);

  const catalog = await listGatewayOperatorCatalog(operatorUserId, providerUserId);
  const providersById = new Map(catalog.providerAccounts.map((provider) => [provider.id, provider] as const));
  const aliasGroups = new Map<
    string,
    {
      alias: string;
      projectId: string | null;
      scopeType: GatewayModelAliasScopeType;
      providers: GatewayModelAssociationProviderLinkView[];
    }
  >();
  const providerGroups = new Map<
    string,
    {
      provider: GatewayProviderAccountView;
      aliases: GatewayModelAssociationProviderAliasLinkView[];
    }
  >();

  for (const alias of catalog.modelAliases) {
    const provider = providersById.get(alias.providerAccountId);
    if (!provider) {
      continue;
    }

    const aliasGroupKey = `${alias.projectId ?? "__platform__"}::${alias.scopeType}::${alias.alias}`;
    const providerLink: GatewayModelAssociationProviderLinkView = {
      providerAccountId: provider.id,
      label: provider.label,
      adapter: provider.adapter,
      protocolFamily: provider.protocolFamily,
      status: provider.status,
      sourceProfile: provider.sourceProfile,
      upstreamModel: alias.upstreamModel,
      priority: alias.priority,
      weight: alias.weight,
      enabled: alias.enabled,
      defaultModel: readGatewayProviderDefaultModel(provider.payload),
    };
    const aliasGroup = aliasGroups.get(aliasGroupKey) ?? {
      alias: alias.alias,
      projectId: alias.projectId,
      scopeType: alias.scopeType,
      providers: [],
    };
    aliasGroup.providers.push(providerLink);
    aliasGroups.set(aliasGroupKey, aliasGroup);

    const providerGroup = providerGroups.get(provider.id) ?? {
      provider,
      aliases: [],
    };
    providerGroup.aliases.push({
      alias: alias.alias,
      projectId: alias.projectId,
      scopeType: alias.scopeType,
      upstreamModel: alias.upstreamModel,
      priority: alias.priority,
      weight: alias.weight,
      enabled: alias.enabled,
    });
    providerGroups.set(provider.id, providerGroup);
  }

  const aliasRows = Array.from(aliasGroups.values())
    .map((group) => {
      const sortedProviders = group.providers
        .slice()
        .sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
      const upstreamModels = Array.from(
        new Set(sortedProviders.map((provider) => provider.upstreamModel).filter((value): value is string => !!value)),
      );
      const sourceKindDistribution = new Map<string, number>();
      for (const provider of sortedProviders) {
        sourceKindDistribution.set(
          provider.sourceProfile.sourceKind,
          (sourceKindDistribution.get(provider.sourceProfile.sourceKind) ?? 0) + 1,
        );
      }
      return {
        alias: group.alias,
        projectId: group.projectId,
        scopeType: group.scopeType,
        upstreamModel:
          upstreamModels.length === 0
            ? null
            : upstreamModels.length === 1
              ? upstreamModels[0]
              : `mixed (${upstreamModels.length})`,
        providerCount: sortedProviders.length,
        enabledProviderCount: sortedProviders.filter((provider) => provider.enabled).length,
        fallbackPriority: buildGatewayFallbackPriorityLabel(sortedProviders),
        sourceKindDistribution: toSummaryBuckets(sourceKindDistribution),
        providers: sortedProviders,
      } satisfies GatewayModelAssociationAliasRowView;
    })
    .sort((left, right) =>
      left.alias.localeCompare(right.alias) || (left.projectId ?? "").localeCompare(right.projectId ?? ""),
    );

  const providerRows = Array.from(providerGroups.values())
    .map((group) => ({
      providerAccountId: group.provider.id,
      label: group.provider.label,
      adapter: group.provider.adapter,
      protocolFamily: group.provider.protocolFamily,
      status: group.provider.status,
      sourceProfile: group.provider.sourceProfile,
      defaultModel: readGatewayProviderDefaultModel(group.provider.payload),
      supportedAliasCount: group.aliases.length,
      aliases: group.aliases
        .slice()
        .sort((left, right) => left.priority - right.priority || left.alias.localeCompare(right.alias)),
    }) satisfies GatewayModelAssociationProviderRowView)
    .sort((left, right) => left.label.localeCompare(right.label));

  const summaryBySourceKind = new Map<string, number>();
  const summaryByProtocolFamily = new Map<string, number>();
  for (const row of providerRows) {
    summaryBySourceKind.set(
      row.sourceProfile.sourceKind,
      (summaryBySourceKind.get(row.sourceProfile.sourceKind) ?? 0) + 1,
    );
    summaryByProtocolFamily.set(
      row.protocolFamily,
      (summaryByProtocolFamily.get(row.protocolFamily) ?? 0) + 1,
    );
  }

  return {
    aliasRows,
    providerRows,
    summary: {
      totalAliases: aliasRows.length,
      totalProviders: providerRows.length,
      totalLinks: aliasRows.reduce((sum, row) => sum + row.providers.length, 0),
      bySourceKind: toSummaryBuckets(summaryBySourceKind),
      byProtocolFamily: toSummaryBuckets(summaryByProtocolFamily),
    },
  };
}

export async function getGatewayCostOverviewForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
): Promise<GatewayCostOverviewView> {
  assertPlatformOperator(operatorUserId, providerUserId);

  const [catalog, usageRows] = await Promise.all([
    listGatewayOperatorCatalog(operatorUserId, providerUserId),
    listGatewayRecentUsageAuditRows(),
  ]);

  const providersById = new Map(catalog.providerAccounts.map((provider) => [provider.id, provider] as const));
  const staticRateByProviderId = new Map(
    catalog.providerAccounts.map((provider) => [provider.id, buildGatewayPriceRateView(provider.payload, "static")] as const),
  );
  const quoteRateByProviderId = new Map(
    catalog.providerAccounts.map((provider) => [provider.id, buildGatewayPriceRateView(provider.payload, "quote")] as const),
  );

  const providerUsageById = aggregateGatewayUsageRowsByKey(
    usageRows,
    (row) => row.providerAccountId,
    (row) => {
      const providerId = row.providerAccountId;
      if (!providerId) {
        return null;
      }
      const rate = staticRateByProviderId.get(providerId);
      if (!rate) {
        return null;
      }
      return estimateGatewayObservedCostMicros(
        {
          promptTokens: Math.max(0, row.promptTokens ?? 0),
          completionTokens: Math.max(0, row.completionTokens ?? 0),
        },
        rate,
      );
    },
  );

  const providerBuckets = catalog.providerAccounts
    .map((provider) => {
      const aggregate = providerUsageById.get(provider.id) ?? emptyGatewayUsageAggregate();
      const staticRate = staticRateByProviderId.get(provider.id) ?? buildGatewayPriceRateView(provider.payload, "static");
      const quoteRate = quoteRateByProviderId.get(provider.id) ?? buildGatewayPriceRateView(provider.payload, "quote");
      const staticCostMicros = estimateGatewayObservedCostMicros(aggregate, staticRate);
      const userQuoteMicros = estimateGatewayObservedCostMicros(aggregate, quoteRate);
      return {
        key: provider.id,
        label: provider.label,
        requestCount: aggregate.requestCount,
        promptTokens: aggregate.promptTokens,
        completionTokens: aggregate.completionTokens,
        totalTokens: aggregate.totalTokens,
        staticCostMicros,
        observedCostMicros: aggregate.estimatedObservedCostMicros,
        userQuoteMicros,
        configuredStaticPrice: staticRate.configured,
        configuredUserQuote: quoteRate.configured,
        lastRequestAt: aggregate.lastRequestAt,
        providerContributions: [],
      } satisfies GatewayCostBucketView;
    })
    .sort((left, right) => right.totalTokens - left.totalTokens || left.label.localeCompare(right.label));

  const aliasUsageByProviderKey = aggregateGatewayUsageRowsByKey(
    usageRows,
    (row) => {
      const aliasKey = row.modelAlias ?? row.requestedModel ?? row.resolvedModel;
      const providerId = row.providerAccountId;
      if (!aliasKey || !providerId) {
        return null;
      }
      return `${aliasKey}\u0000${providerId}`;
    },
    (row) => {
      const providerId = row.providerAccountId;
      if (!providerId) {
        return null;
      }
      const rate = staticRateByProviderId.get(providerId);
      if (!rate) {
        return null;
      }
      return estimateGatewayObservedCostMicros(
        {
          promptTokens: Math.max(0, row.promptTokens ?? 0),
          completionTokens: Math.max(0, row.completionTokens ?? 0),
        },
        rate,
      );
    },
  );

  const aliasAggregates = new Map<
    string,
    {
      totalAggregate: GatewayUsageAggregate;
      providerDetails: Array<{
        provider: GatewayProviderAccountView;
        aggregate: GatewayUsageAggregate;
        staticCostMicros: number | null;
        observedCostMicros: number | null;
        userQuoteMicros: number | null;
      }>;
    }
  >();

  for (const [compositeKey, aggregate] of aliasUsageByProviderKey.entries()) {
    const [aliasKey, providerId] = compositeKey.split("\u0000");
    const provider = providersById.get(providerId);
    if (!aliasKey || !provider) {
      continue;
    }
    const entry = aliasAggregates.get(aliasKey) ?? {
      totalAggregate: emptyGatewayUsageAggregate(),
      providerDetails: [],
    };
    mergeGatewayUsageAggregate(entry.totalAggregate, aggregate);
    const staticRate = staticRateByProviderId.get(providerId) ?? buildGatewayPriceRateView(provider.payload, "static");
    const quoteRate = quoteRateByProviderId.get(providerId) ?? buildGatewayPriceRateView(provider.payload, "quote");
    const staticCostMicros = estimateGatewayObservedCostMicros(aggregate, staticRate);
    const observedCostMicros = staticCostMicros;
    const userQuoteMicros = estimateGatewayObservedCostMicros(aggregate, quoteRate);
    entry.providerDetails.push({
      provider,
      aggregate,
      staticCostMicros,
      observedCostMicros,
      userQuoteMicros,
    });
    aliasAggregates.set(aliasKey, entry);
  }

  const aliasBuckets = Array.from(aliasAggregates.entries())
    .map(([aliasKey, entry]) => {
      const { totalAggregate, providerDetails } = entry;
      const totalStaticCostMicros = providerDetails.reduce(
        (sum, detail) => sum + (detail.staticCostMicros ?? 0),
        0,
      );
      const totalObservedCostMicros = providerDetails.reduce(
        (sum, detail) => sum + (detail.observedCostMicros ?? 0),
        0,
      );
      const totalUserQuoteMicros = providerDetails.reduce(
        (sum, detail) => sum + (detail.userQuoteMicros ?? 0),
        0,
      );
      return {
        key: aliasKey,
        label: aliasKey,
        requestCount: totalAggregate.requestCount,
        promptTokens: totalAggregate.promptTokens,
        completionTokens: totalAggregate.completionTokens,
        totalTokens: totalAggregate.totalTokens,
        staticCostMicros: totalStaticCostMicros || null,
        observedCostMicros: totalObservedCostMicros || null,
        userQuoteMicros: totalUserQuoteMicros || null,
        configuredStaticPrice: providerDetails.some((detail) => detail.staticCostMicros != null),
        configuredUserQuote: providerDetails.some((detail) => detail.userQuoteMicros != null),
        lastRequestAt: totalAggregate.lastRequestAt,
        providerContributions: providerDetails.map((detail) => ({
          providerAccountId: detail.provider.id,
          label: detail.provider.label,
          requestCount: detail.aggregate.requestCount,
          promptTokens: detail.aggregate.promptTokens,
          completionTokens: detail.aggregate.completionTokens,
          totalTokens: detail.aggregate.totalTokens,
          staticCostMicros: detail.staticCostMicros,
          observedCostMicros: detail.observedCostMicros,
        })),
      } satisfies GatewayCostBucketView;
    })
    .sort((left, right) => right.totalTokens - left.totalTokens || left.label.localeCompare(right.label))
    .slice(0, 40);

  const providerQuotes: GatewayPricingQuoteView[] = catalog.providerAccounts
    .map((provider) => {
      const aggregate = providerUsageById.get(provider.id) ?? emptyGatewayUsageAggregate();
      const staticRate = buildGatewayPriceRateView(provider.payload, "static");
      const platformQuoteRate = buildGatewayPriceRateView(provider.payload, "quote");
      return {
        scopeType: "provider",
        scopeId: provider.id,
        label: provider.label,
        staticRate,
        platformQuoteRate,
        observedRequestCount: aggregate.requestCount,
        observedPromptTokens: aggregate.promptTokens,
        observedCompletionTokens: aggregate.completionTokens,
        observedTotalTokens: aggregate.totalTokens,
        observedCostMicros: estimateGatewayObservedCostMicros(aggregate, staticRate),
        userQuoteMicros: estimateGatewayObservedCostMicros(aggregate, platformQuoteRate),
        lastRequestAt: aggregate.lastRequestAt,
      } satisfies GatewayPricingQuoteView;
    });
  const aliasQuotes: GatewayPricingQuoteView[] = aliasBuckets.slice(0, 24).map((bucket) => ({
        scopeType: "model_alias",
        scopeId: bucket.key,
        label: bucket.label,
        staticRate: {
          promptMicrosPer1kTokens: null,
          completionMicrosPer1kTokens: null,
          currency: "USD",
          configured: bucket.configuredStaticPrice,
          source: bucket.configuredStaticPrice ? "payload" : "unconfigured",
        },
        platformQuoteRate: {
          promptMicrosPer1kTokens: null,
          completionMicrosPer1kTokens: null,
          currency: "USD",
          configured: bucket.configuredUserQuote,
          source: bucket.configuredUserQuote ? "payload" : "unconfigured",
        },
        observedRequestCount: bucket.requestCount,
        observedPromptTokens: bucket.promptTokens,
        observedCompletionTokens: bucket.completionTokens,
        observedTotalTokens: bucket.totalTokens,
        observedCostMicros: bucket.observedCostMicros,
        userQuoteMicros: bucket.userQuoteMicros,
        lastRequestAt: null,
      }) satisfies GatewayPricingQuoteView);
  const quotes: GatewayPricingQuoteView[] = [...providerQuotes, ...aliasQuotes];

  const totalRequests = providerBuckets.reduce((sum, bucket) => sum + bucket.requestCount, 0);
  const totalPromptTokens = providerBuckets.reduce((sum, bucket) => sum + bucket.promptTokens, 0);
  const totalCompletionTokens = providerBuckets.reduce((sum, bucket) => sum + bucket.completionTokens, 0);
  const totalTokens = providerBuckets.reduce((sum, bucket) => sum + bucket.totalTokens, 0);
  const staticCostMicros = providerBuckets.reduce((sum, bucket) => sum + (bucket.staticCostMicros ?? 0), 0);
  const observedCostMicros = providerBuckets.reduce((sum, bucket) => sum + (bucket.observedCostMicros ?? 0), 0);
  const userQuoteMicros = providerBuckets.reduce((sum, bucket) => sum + (bucket.userQuoteMicros ?? 0), 0);

  const usageSampleSize = usageRows.length;
  const usageSampleLimit = USAGE_SAMPLE_LIMIT;
  const usageSampleFullyCaptured = usageSampleSize < usageSampleLimit;

  return {
    summary: {
      totalRequests,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      staticCostMicros: providerBuckets.some((bucket) => bucket.staticCostMicros != null) ? staticCostMicros : null,
      observedCostMicros: providerBuckets.some((bucket) => bucket.observedCostMicros != null)
        ? observedCostMicros
        : null,
      userQuoteMicros: providerBuckets.some((bucket) => bucket.userQuoteMicros != null) ? userQuoteMicros : null,
      providersWithStaticPrice: providerBuckets.filter((bucket) => bucket.configuredStaticPrice).length,
      providersWithObservedCost: providerBuckets.filter((bucket) => bucket.observedCostMicros != null).length,
      providersWithUserQuote: providerBuckets.filter((bucket) => bucket.configuredUserQuote).length,
      usageSampleSize,
      usageSampleLimit,
      usageSampleFullyCaptured,
    },
    providerBuckets,
    aliasBuckets,
    quotes,
  } as unknown as GatewayCostOverviewView;
}
