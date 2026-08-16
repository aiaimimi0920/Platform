import type { GatewayProviderRoutingAnalysisAnomalyReportView, GatewayProviderRoutingAnalysisFilterView, GatewayProviderRoutingAnalysisSummaryView, GatewayAnalysisSampleView, GatewayAnalysisSummaryView, GatewayRequestAuditView } from "@neuro/contracts";
import { buildGatewayProviderRoutingAnalysisAnomalyReport, buildGatewayProviderRoutingAnalysisAnomalyThresholdConfig, buildGatewayProviderRoutingAnalysisSummary } from "@/modules/gateway/analysis-provider-routing";

import { accumulateSummaryBucket, buildDistribution, now, toSummaryBuckets } from "./shared";
import type { GatewayAnalysisOperatorFilters, GatewayProviderRoutingAnalysisOperatorFilters, GatewayRequestAuditOperatorFilters } from "./shared";
import { listGatewayRequestAuditsForOperator } from "./operator-audits";

export function toGatewayAnalysisSampleView(row: GatewayRequestAuditView): GatewayAnalysisSampleView {
  return {
    requestAuditId: row.id,
    responseId: row.responseId,
    projectId: row.projectId,
    routePolicyId: row.routePolicyId,
    sessionId: row.sessionId,
    providerAccountId: row.providerAccountId,
    protocolFamily: row.protocolFamily,
    endpointKind: row.endpointKind,
    requestedModel: row.requestedModel,
    resolvedModel: row.resolvedModel,
    status: row.status,
    stream: row.stream,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    cacheCreationInputTokens: row.cacheCreationInputTokens,
    cacheReadInputTokens: row.cacheReadInputTokens,
    analysisProfile: row.analysisProfile,
    requestArtifactObjectKey: row.requestArtifactObjectKey,
    responseArtifactObjectKey: row.responseArtifactObjectKey,
    routeTrace: row.routeTrace,
  };
}

export async function listGatewayAnalysisSamplesForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisOperatorFilters = {},
) {
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 200, 1000)),
  });

  return rows
    .filter((row) => {
      if (typeof filters.artifactAvailable === "boolean") {
        const available = Boolean(row.requestArtifactObjectKey || row.responseArtifactObjectKey);
        if (available !== filters.artifactAvailable) {
          return false;
        }
      }
      return true;
    })
    .map(toGatewayAnalysisSampleView);
}

export async function getGatewayAnalysisSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisOperatorFilters = {},
) {
  const rows = await listGatewayAnalysisSamplesForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 1000, 1000)),
  });

  const byProtocolFamily = new Map<string, number>();
  const byEndpointKind = new Map<string, number>();
  const byResolvedModel = new Map<string, number>();
  const byProviderAccount = new Map<string, number>();
  const byStatus = new Map<string, number>();

  let completedSamples = 0;
  let failedSamples = 0;
  let cancelledSamples = 0;
  let streamSamples = 0;
  let toolRequestSamples = 0;
  let toolResponseSamples = 0;
  let systemPromptSamples = 0;
  let reasoningSamples = 0;
  let metadataSamples = 0;
  let explicitSessionSamples = 0;
  let previousResponseSamples = 0;
  let requestArtifactSamples = 0;
  let responseArtifactSamples = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalCacheCreationInputTokens = 0;
  let totalCacheReadInputTokens = 0;

  for (const row of rows) {
    accumulateSummaryBucket(byProtocolFamily, row.protocolFamily);
    accumulateSummaryBucket(byEndpointKind, row.endpointKind);
    accumulateSummaryBucket(byResolvedModel, row.resolvedModel);
    accumulateSummaryBucket(byProviderAccount, row.providerAccountId);
    accumulateSummaryBucket(byStatus, row.status);

    if (row.status === "completed") {
      completedSamples += 1;
    } else if (row.status === "failed") {
      failedSamples += 1;
    } else if (row.status === "cancelled") {
      cancelledSamples += 1;
    }

    if (row.stream) {
      streamSamples += 1;
    }
    if ((row.analysisProfile?.requestToolCount ?? 0) > 0 || (row.analysisProfile?.requestHistoricalToolCallCount ?? 0) > 0) {
      toolRequestSamples += 1;
    }
    if ((row.analysisProfile?.responseToolCallCount ?? 0) > 0) {
      toolResponseSamples += 1;
    }
    if (row.analysisProfile?.hasSystemPrompt) {
      systemPromptSamples += 1;
    }
    if (row.analysisProfile?.hasReasoning) {
      reasoningSamples += 1;
    }
    if (row.analysisProfile?.hasMetadata) {
      metadataSamples += 1;
    }
    if (row.analysisProfile?.hasExplicitSessionKey) {
      explicitSessionSamples += 1;
    }
    if (row.analysisProfile?.hasPreviousResponse) {
      previousResponseSamples += 1;
    }
    if (row.requestArtifactObjectKey) {
      requestArtifactSamples += 1;
    }
    if (row.responseArtifactObjectKey) {
      responseArtifactSamples += 1;
    }
    totalPromptTokens += row.promptTokens ?? 0;
    totalCompletionTokens += row.completionTokens ?? 0;
    totalTokens += row.totalTokens ?? 0;
    totalCacheCreationInputTokens += row.cacheCreationInputTokens ?? 0;
    totalCacheReadInputTokens += row.cacheReadInputTokens ?? 0;
  }

  return {
    totalSamples: rows.length,
    completedSamples,
    failedSamples,
    cancelledSamples,
    streamSamples,
    toolRequestSamples,
    toolResponseSamples,
    systemPromptSamples,
    reasoningSamples,
    metadataSamples,
    explicitSessionSamples,
    previousResponseSamples,
    requestArtifactSamples,
    responseArtifactSamples,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    totalCacheCreationInputTokens,
    totalCacheReadInputTokens,
    requestTextChars: buildDistribution(rows.map((row) => row.analysisProfile?.requestTextChars ?? null)),
    responseTextChars: buildDistribution(rows.map((row) => row.analysisProfile?.responseTextChars ?? null)),
    firstTokenLatencyMs: buildDistribution(rows.map((row) => row.analysisProfile?.firstTokenLatencyMs ?? null)),
    streamChunkCount: buildDistribution(rows.map((row) => row.analysisProfile?.streamChunkCount ?? null)),
    byProtocolFamily: toSummaryBuckets(byProtocolFamily),
    byEndpointKind: toSummaryBuckets(byEndpointKind),
    byResolvedModel: toSummaryBuckets(byResolvedModel),
    byProviderAccount: toSummaryBuckets(byProviderAccount),
    byStatus: toSummaryBuckets(byStatus),
  } satisfies GatewayAnalysisSummaryView;
}

export function toGatewayProviderRoutingAnalysisFilterView(
  filters: GatewayRequestAuditOperatorFilters,
  limit: number,
): GatewayProviderRoutingAnalysisFilterView {
  return {
    projectId: filters.projectId ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    providerAccountId: filters.providerAccountId ?? null,
    sessionId: filters.sessionId ?? null,
    apiKeyId: filters.apiKeyId ?? null,
    responseId: filters.responseId ?? null,
    protocolFamily: filters.protocolFamily ?? null,
    endpointKind: filters.endpointKind ?? null,
    status: filters.status ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    limit,
  };
}

export async function getGatewayProviderRoutingAnalysisSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRequestAuditOperatorFilters = {},
): Promise<GatewayProviderRoutingAnalysisSummaryView> {
  const limit = Math.max(1, Math.min(filters.limit ?? 1000, 1000));
  const rows = await listGatewayAnalysisSamplesForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit,
  });
  return buildGatewayProviderRoutingAnalysisSummary(rows);
}

export async function getGatewayProviderRoutingAnalysisAnomalyReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayProviderRoutingAnalysisOperatorFilters = {},
): Promise<GatewayProviderRoutingAnalysisAnomalyReportView> {
  const limit = Math.max(1, Math.min(filters.limit ?? 1000, 1000));
  const profileKey = filters.profileKey ?? "balanced";
  const summary = await getGatewayProviderRoutingAnalysisSummaryForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit,
  });
  return buildGatewayProviderRoutingAnalysisAnomalyReport({
    generatedAt: now().toISOString(),
    filters: toGatewayProviderRoutingAnalysisFilterView(filters, limit),
    profileKey,
    thresholds: buildGatewayProviderRoutingAnalysisAnomalyThresholdConfig(
      profileKey,
      filters.thresholds ?? {},
    ),
    summary,
  });
}
