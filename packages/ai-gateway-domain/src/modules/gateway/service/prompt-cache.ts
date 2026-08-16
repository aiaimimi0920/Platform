import type { GatewayPromptCacheSummaryView, GatewayPromptCacheTrendReportView } from "@neuro/contracts";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { gatewayRequestAudits } from "@/modules/gateway/schema";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

import { parseFilterTimestamp } from "./shared";
import type { GatewayPromptCacheOperatorFilters } from "./shared";
import { listGatewayRequestAuditsForOperator } from "./operator-audits";

export function roundPromptCacheMetric(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

export function normalizePromptCacheInputPrice(value?: number | null) {
  const normalized = value ?? 15;
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new ConflictError("inputPricePerMillion 必须是大于等于 0 的数字。");
  }
  return normalized;
}

export function normalizePromptCacheBucketSize(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "day" as const;
  }
  if (normalized === "hour" || normalized === "day") {
    return normalized;
  }
  throw new ConflictError("bucketSize 仅支持 hour 或 day。");
}

export function calculatePromptCacheCostSavedUsd(tokensSaved: number, inputPricePerMillion: number) {
  if (tokensSaved <= 0) {
    return 0;
  }
  return tokensSaved * inputPricePerMillion * 0.9 / 1_000_000;
}

export function buildGatewayPromptCacheSummaryView(args: {
  totalRequests: number;
  cacheHitRequests: number;
  cacheCreationRequests: number;
  clientMarkedRequests: number;
  autoAppliedRequests: number;
  totalTokensSaved: number;
  totalCacheCreationInputTokens: number;
  inputPricePerMillion: number;
}) {
  const totalRequests = Math.max(0, args.totalRequests);
  const cacheHitRequests = Math.max(0, args.cacheHitRequests);
  const cacheCreationRequests = Math.max(0, args.cacheCreationRequests);
  const clientMarkedRequests = Math.max(0, args.clientMarkedRequests);
  const autoAppliedRequests = Math.max(0, args.autoAppliedRequests);
  const totalTokensSaved = Math.max(0, args.totalTokensSaved);
  const totalCacheCreationInputTokens = Math.max(0, args.totalCacheCreationInputTokens);
  const cacheControlCoverageRequests = clientMarkedRequests + autoAppliedRequests;
  return {
    totalRequests,
    cacheHitRequests,
    cacheCreationRequests,
    clientMarkedRequests,
    autoAppliedRequests,
    cacheControlCoverageRequests,
    totalTokensSaved,
    totalCacheCreationInputTokens,
    estimatedCostSavedUsd: roundPromptCacheMetric(
      calculatePromptCacheCostSavedUsd(totalTokensSaved, args.inputPricePerMillion),
    ),
    cacheHitRate: roundPromptCacheMetric(totalRequests === 0 ? 0 : cacheHitRequests / totalRequests),
    cacheControlCoverageRate: roundPromptCacheMetric(
      totalRequests === 0 ? 0 : cacheControlCoverageRequests / totalRequests,
    ),
    inputPricePerMillion: roundPromptCacheMetric(args.inputPricePerMillion),
    cachedInputPricePerMillion: roundPromptCacheMetric(args.inputPricePerMillion * 0.1),
  } satisfies GatewayPromptCacheSummaryView;
}

export function getPromptCacheBucketStart(createdAt: string, bucketSize: "hour" | "day") {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const shanghaiOffsetMs = 8 * 60 * 60 * 1000;
  const shifted = new Date(parsed.getTime() + shanghaiOffsetMs);
  if (bucketSize === "hour") {
    shifted.setUTCMinutes(0, 0, 0);
  } else {
    shifted.setUTCHours(0, 0, 0, 0);
  }
  return new Date(shifted.getTime() - shanghaiOffsetMs).toISOString();
}

export async function getGatewayPromptCacheSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayPromptCacheOperatorFilters = {},
) {
  const inputPricePerMillion = normalizePromptCacheInputPrice(filters.inputPricePerMillion);
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 1000, 1000)),
  });

  let cacheHitRequests = 0;
  let cacheCreationRequests = 0;
  let clientMarkedRequests = 0;
  let autoAppliedRequests = 0;
  let totalTokensSaved = 0;
  let totalCacheCreationInputTokens = 0;

  for (const row of rows) {
    if ((row.cacheReadInputTokens ?? 0) > 0) {
      cacheHitRequests += 1;
    }
    if ((row.cacheCreationInputTokens ?? 0) > 0) {
      cacheCreationRequests += 1;
    }
    if (row.clientHasCacheControl) {
      clientMarkedRequests += 1;
    }
    if (row.autoCacheApplied) {
      autoAppliedRequests += 1;
    }
    totalTokensSaved += row.cacheReadInputTokens ?? 0;
    totalCacheCreationInputTokens += row.cacheCreationInputTokens ?? 0;
  }

  return buildGatewayPromptCacheSummaryView({
    totalRequests: rows.length,
    cacheHitRequests,
    cacheCreationRequests,
    clientMarkedRequests,
    autoAppliedRequests,
    totalTokensSaved,
    totalCacheCreationInputTokens,
    inputPricePerMillion,
  });
}

export async function getGatewayPromptCacheSummaryForProject(
  projectId: string,
  filters: Omit<GatewayPromptCacheOperatorFilters, "projectId"> = {},
) {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new ConflictError("projectId 不能为空。");
  }

  const inputPricePerMillion = normalizePromptCacheInputPrice(filters.inputPricePerMillion);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }

  const rows = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      and(
        eq(gatewayRequestAudits.projectId, normalizedProjectId),
        filters.routePolicyId ? eq(gatewayRequestAudits.routePolicyId, filters.routePolicyId) : undefined,
        filters.providerAccountId ? eq(gatewayRequestAudits.providerAccountId, filters.providerAccountId) : undefined,
        filters.sessionId ? eq(gatewayRequestAudits.sessionId, filters.sessionId) : undefined,
        filters.apiKeyId ? eq(gatewayRequestAudits.apiKeyId, filters.apiKeyId) : undefined,
        filters.userCredentialId ? eq(gatewayRequestAudits.userCredentialId, filters.userCredentialId) : undefined,
        filters.responseId ? eq(gatewayRequestAudits.responseId, filters.responseId) : undefined,
        filters.protocolFamily ? eq(gatewayRequestAudits.protocolFamily, filters.protocolFamily) : undefined,
        filters.status ? eq(gatewayRequestAudits.status, filters.status) : undefined,
        filters.endpointKind ? eq(gatewayRequestAudits.endpointKind, filters.endpointKind) : undefined,
        typeof filters.stream === "boolean" ? eq(gatewayRequestAudits.stream, filters.stream) : undefined,
        createdFrom ? gte(gatewayRequestAudits.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayRequestAudits.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayRequestAudits.createdAt))
    .limit(Math.max(1, Math.min(filters.limit ?? 1000, 1000)));

  let cacheHitRequests = 0;
  let cacheCreationRequests = 0;
  let clientMarkedRequests = 0;
  let autoAppliedRequests = 0;
  let totalTokensSaved = 0;
  let totalCacheCreationInputTokens = 0;

  for (const row of rows) {
    if ((row.cacheReadInputTokens ?? 0) > 0) {
      cacheHitRequests += 1;
    }
    if ((row.cacheCreationInputTokens ?? 0) > 0) {
      cacheCreationRequests += 1;
    }
    if (row.clientHasCacheControl) {
      clientMarkedRequests += 1;
    }
    if (row.autoCacheApplied) {
      autoAppliedRequests += 1;
    }
    totalTokensSaved += row.cacheReadInputTokens ?? 0;
    totalCacheCreationInputTokens += row.cacheCreationInputTokens ?? 0;
  }

  return buildGatewayPromptCacheSummaryView({
    totalRequests: rows.length,
    cacheHitRequests,
    cacheCreationRequests,
    clientMarkedRequests,
    autoAppliedRequests,
    totalTokensSaved,
    totalCacheCreationInputTokens,
    inputPricePerMillion,
  });
}

export async function getGatewayPromptCacheTrendReportForProject(
  projectId: string,
  filters: Omit<GatewayPromptCacheOperatorFilters, "projectId"> = {},
) {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    throw new ConflictError("projectId 不能为空。");
  }

  const inputPricePerMillion = normalizePromptCacheInputPrice(filters.inputPricePerMillion);
  const bucketSize = normalizePromptCacheBucketSize(filters.bucketSize);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }

  const rows = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      and(
        eq(gatewayRequestAudits.projectId, normalizedProjectId),
        filters.routePolicyId ? eq(gatewayRequestAudits.routePolicyId, filters.routePolicyId) : undefined,
        filters.providerAccountId ? eq(gatewayRequestAudits.providerAccountId, filters.providerAccountId) : undefined,
        filters.sessionId ? eq(gatewayRequestAudits.sessionId, filters.sessionId) : undefined,
        filters.apiKeyId ? eq(gatewayRequestAudits.apiKeyId, filters.apiKeyId) : undefined,
        filters.userCredentialId ? eq(gatewayRequestAudits.userCredentialId, filters.userCredentialId) : undefined,
        filters.responseId ? eq(gatewayRequestAudits.responseId, filters.responseId) : undefined,
        filters.protocolFamily ? eq(gatewayRequestAudits.protocolFamily, filters.protocolFamily) : undefined,
        filters.status ? eq(gatewayRequestAudits.status, filters.status) : undefined,
        filters.endpointKind ? eq(gatewayRequestAudits.endpointKind, filters.endpointKind) : undefined,
        typeof filters.stream === "boolean" ? eq(gatewayRequestAudits.stream, filters.stream) : undefined,
        createdFrom ? gte(gatewayRequestAudits.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayRequestAudits.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayRequestAudits.createdAt))
    .limit(Math.max(1, Math.min(filters.limit ?? 1000, 1000)));

  const buckets = new Map<
    string,
    {
      bucketStart: string;
      totalRequests: number;
      cacheHitRequests: number;
      cacheCreationRequests: number;
      clientMarkedRequests: number;
      autoAppliedRequests: number;
      totalTokensSaved: number;
      totalCacheCreationInputTokens: number;
    }
  >();

  for (const row of rows) {
    const bucketStart = getPromptCacheBucketStart(row.createdAt.toISOString(), bucketSize);
    if (!bucketStart) {
      continue;
    }
    const existing =
      buckets.get(bucketStart) ?? {
        bucketStart,
        totalRequests: 0,
        cacheHitRequests: 0,
        cacheCreationRequests: 0,
        clientMarkedRequests: 0,
        autoAppliedRequests: 0,
        totalTokensSaved: 0,
        totalCacheCreationInputTokens: 0,
      };
    existing.totalRequests += 1;
    if ((row.cacheReadInputTokens ?? 0) > 0) {
      existing.cacheHitRequests += 1;
    }
    if ((row.cacheCreationInputTokens ?? 0) > 0) {
      existing.cacheCreationRequests += 1;
    }
    if (row.clientHasCacheControl) {
      existing.clientMarkedRequests += 1;
    }
    if (row.autoCacheApplied) {
      existing.autoAppliedRequests += 1;
    }
    existing.totalTokensSaved += row.cacheReadInputTokens ?? 0;
    existing.totalCacheCreationInputTokens += row.cacheCreationInputTokens ?? 0;
    buckets.set(bucketStart, existing);
  }

  const points = Array.from(buckets.values())
    .sort((left, right) => left.bucketStart.localeCompare(right.bucketStart))
    .map((bucket) => {
      const cacheControlCoverageRequests = bucket.clientMarkedRequests + bucket.autoAppliedRequests;
      return {
        bucketStart: bucket.bucketStart,
        totalRequests: bucket.totalRequests,
        cacheHitRequests: bucket.cacheHitRequests,
        cacheCreationRequests: bucket.cacheCreationRequests,
        clientMarkedRequests: bucket.clientMarkedRequests,
        autoAppliedRequests: bucket.autoAppliedRequests,
        cacheControlCoverageRequests,
        totalTokensSaved: bucket.totalTokensSaved,
        totalCacheCreationInputTokens: bucket.totalCacheCreationInputTokens,
        estimatedCostSavedUsd: roundPromptCacheMetric(
          calculatePromptCacheCostSavedUsd(bucket.totalTokensSaved, inputPricePerMillion),
        ),
        cacheHitRate: roundPromptCacheMetric(
          bucket.totalRequests === 0 ? 0 : bucket.cacheHitRequests / bucket.totalRequests,
        ),
        cacheControlCoverageRate: roundPromptCacheMetric(
          bucket.totalRequests === 0 ? 0 : cacheControlCoverageRequests / bucket.totalRequests,
        ),
      };
    });

  return {
    bucketSize,
    summary: buildGatewayPromptCacheSummaryView({
      totalRequests: rows.length,
      cacheHitRequests: points.reduce((sum, point) => sum + point.cacheHitRequests, 0),
      cacheCreationRequests: points.reduce((sum, point) => sum + point.cacheCreationRequests, 0),
      clientMarkedRequests: points.reduce((sum, point) => sum + point.clientMarkedRequests, 0),
      autoAppliedRequests: points.reduce((sum, point) => sum + point.autoAppliedRequests, 0),
      totalTokensSaved: points.reduce((sum, point) => sum + point.totalTokensSaved, 0),
      totalCacheCreationInputTokens: points.reduce((sum, point) => sum + point.totalCacheCreationInputTokens, 0),
      inputPricePerMillion,
    }),
    points,
  } satisfies GatewayPromptCacheTrendReportView;
}

export async function getGatewayPromptCacheTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayPromptCacheOperatorFilters = {},
) {
  const inputPricePerMillion = normalizePromptCacheInputPrice(filters.inputPricePerMillion);
  const bucketSize = normalizePromptCacheBucketSize(filters.bucketSize);
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 1000, 1000)),
  });

  const buckets = new Map<
    string,
    {
      bucketStart: string;
      totalRequests: number;
      cacheHitRequests: number;
      cacheCreationRequests: number;
      clientMarkedRequests: number;
      autoAppliedRequests: number;
      totalTokensSaved: number;
      totalCacheCreationInputTokens: number;
    }
  >();

  for (const row of rows) {
    const bucketStart = getPromptCacheBucketStart(row.createdAt, bucketSize);
    if (!bucketStart) {
      continue;
    }
    const existing =
      buckets.get(bucketStart) ??
      {
        bucketStart,
        totalRequests: 0,
        cacheHitRequests: 0,
        cacheCreationRequests: 0,
        clientMarkedRequests: 0,
        autoAppliedRequests: 0,
        totalTokensSaved: 0,
        totalCacheCreationInputTokens: 0,
      };
    existing.totalRequests += 1;
    if ((row.cacheReadInputTokens ?? 0) > 0) {
      existing.cacheHitRequests += 1;
    }
    if ((row.cacheCreationInputTokens ?? 0) > 0) {
      existing.cacheCreationRequests += 1;
    }
    if (row.clientHasCacheControl) {
      existing.clientMarkedRequests += 1;
    }
    if (row.autoCacheApplied) {
      existing.autoAppliedRequests += 1;
    }
    existing.totalTokensSaved += row.cacheReadInputTokens ?? 0;
    existing.totalCacheCreationInputTokens += row.cacheCreationInputTokens ?? 0;
    buckets.set(bucketStart, existing);
  }

  const points = Array.from(buckets.values())
    .sort((left, right) => left.bucketStart.localeCompare(right.bucketStart))
    .map((bucket) => {
      const cacheControlCoverageRequests = bucket.clientMarkedRequests + bucket.autoAppliedRequests;
      return {
        bucketStart: bucket.bucketStart,
        totalRequests: bucket.totalRequests,
        cacheHitRequests: bucket.cacheHitRequests,
        cacheCreationRequests: bucket.cacheCreationRequests,
        clientMarkedRequests: bucket.clientMarkedRequests,
        autoAppliedRequests: bucket.autoAppliedRequests,
        cacheControlCoverageRequests,
        totalTokensSaved: bucket.totalTokensSaved,
        totalCacheCreationInputTokens: bucket.totalCacheCreationInputTokens,
        estimatedCostSavedUsd: roundPromptCacheMetric(
          calculatePromptCacheCostSavedUsd(bucket.totalTokensSaved, inputPricePerMillion),
        ),
        cacheHitRate: roundPromptCacheMetric(
          bucket.totalRequests === 0 ? 0 : bucket.cacheHitRequests / bucket.totalRequests,
        ),
        cacheControlCoverageRate: roundPromptCacheMetric(
          bucket.totalRequests === 0 ? 0 : cacheControlCoverageRequests / bucket.totalRequests,
        ),
      };
    });

  return {
    bucketSize,
    summary: buildGatewayPromptCacheSummaryView({
      totalRequests: rows.length,
      cacheHitRequests: points.reduce((sum, point) => sum + point.cacheHitRequests, 0),
      cacheCreationRequests: points.reduce((sum, point) => sum + point.cacheCreationRequests, 0),
      clientMarkedRequests: points.reduce((sum, point) => sum + point.clientMarkedRequests, 0),
      autoAppliedRequests: points.reduce((sum, point) => sum + point.autoAppliedRequests, 0),
      totalTokensSaved: points.reduce((sum, point) => sum + point.totalTokensSaved, 0),
      totalCacheCreationInputTokens: points.reduce((sum, point) => sum + point.totalCacheCreationInputTokens, 0),
      inputPricePerMillion,
    }),
    points,
  } satisfies GatewayPromptCacheTrendReportView;
}
