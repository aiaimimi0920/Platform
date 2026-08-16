import type { GatewayAnalysisAnomalyIncidentFollowUpStatus, GatewayAnalysisAnomalyRemediationExecutionMode, GatewayAnalysisAnomalyIncidentEscalationStatus, GatewayAnalysisAnomalyIncidentStatus, GatewayAnalysisAnomalyRemediationRunStatus, GatewayAnalysisAnomalyPolicyStatus, GatewayAnalysisExportAnomalyProfileKey, GatewayAnalysisExportTextMode, GatewayProtocolFamily, GatewayProviderRoutingAnalysisAnomalyThresholdConfig, GatewayAnalysisMetricDistributionView, GatewayRequestStatus, GatewaySummaryBucket, GatewayRateLimitHotspotAnomalyThresholdConfig } from "@neuro/contracts";
import { env } from "@/env";
import { gatewayApiKeys, gatewayAnalysisAnomalyIncidentHistory, gatewayAnalysisAnomalyIncidents, gatewayAnalysisAnomalyPolicies, gatewayAnalysisAnomalyRemediationRuns, gatewayAnalysisExports, gatewayProjects, gatewayProviderAccounts, gatewayRoutePolicies, gatewaySessions, gatewayTenants } from "@/modules/gateway/schema";
import { ConflictError, UnauthorizedError } from "@neuro/backend-foundation/platform/errors";
import { requestInternalText } from "@neuro/backend-foundation/platform/internal-request";

export const ANALYSIS_EXPORT_READ_CONCURRENCY = 12;

export const GATEWAY_PROVIDER_RESPONSE_MAX_BYTES = 1_048_576;

export function requestGatewayProviderText(url: string, init: RequestInit, operation: string) {
  return requestInternalText(url, init, {
    timeoutMs: env.providerFetchTimeoutMs,
    timeoutMessage: `${operation} timed out`,
    maxBodyBytes: GATEWAY_PROVIDER_RESPONSE_MAX_BYTES,
  });
}

export type GatewayApiKeyRow = typeof gatewayApiKeys.$inferSelect;

export type GatewayAnalysisAnomalyIncidentHistoryRow = typeof gatewayAnalysisAnomalyIncidentHistory.$inferSelect;

export type GatewayAnalysisAnomalyIncidentRow = typeof gatewayAnalysisAnomalyIncidents.$inferSelect;

export type GatewayAnalysisAnomalyPolicyRow = typeof gatewayAnalysisAnomalyPolicies.$inferSelect;

export type GatewayAnalysisAnomalyRemediationRunRow = typeof gatewayAnalysisAnomalyRemediationRuns.$inferSelect;

export type GatewayAnalysisExportRow = typeof gatewayAnalysisExports.$inferSelect;

export type GatewayProjectRow = typeof gatewayProjects.$inferSelect;

export type GatewayProviderAccountRow = typeof gatewayProviderAccounts.$inferSelect;

export type GatewayRoutePolicyRow = typeof gatewayRoutePolicies.$inferSelect;

export type GatewaySessionRow = typeof gatewaySessions.$inferSelect;

export type GatewayTenantRow = typeof gatewayTenants.$inferSelect;

export type GatewayRequestAuditOperatorFilters = {
  projectId?: string | null;
  routePolicyId?: string | null;
  providerAccountId?: string | null;
  sessionId?: string | null;
  apiKeyId?: string | null;
  userCredentialId?: string | null;
  responseId?: string | null;
  protocolFamily?: GatewayProtocolFamily | null;
  status?: GatewayRequestStatus | null;
  endpointKind?: string | null;
  stream?: boolean | null;
  errorCode?: string | null;
  fallbackEligible?: boolean | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

export type GatewayRateLimitHotspotOperatorFilters = GatewayRequestAuditOperatorFilters & {
  windowSize?: number | null;
  bucketSizeMinutes?: number | null;
};

export type GatewayRateLimitHotspotAnomalyOperatorFilters = GatewayRateLimitHotspotOperatorFilters & {
  label?: string | null;
  profileKey?: GatewayAnalysisExportAnomalyProfileKey | null;
  thresholds?: Partial<GatewayRateLimitHotspotAnomalyThresholdConfig>;
};

export type GatewayRateLimitHotspotSnapshotFilters = {
  snapshotId?: string | null;
  label?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  apiKeyId?: string | null;
  endpointKind?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

export type GatewayRateLimitHotspotSnapshotTrendFilters = GatewayRateLimitHotspotSnapshotFilters;

export type GatewayRateLimitHotspotAnomalySnapshotFilters = {
  snapshotId?: string | null;
  label?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  apiKeyId?: string | null;
  endpointKind?: string | null;
  profileKey?: GatewayAnalysisExportAnomalyProfileKey | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

export type GatewaySessionOperatorFilters = {
  projectId?: string | null;
  providerAccountId?: string | null;
  protocolFamily?: GatewayProtocolFamily | null;
  activeOnly?: boolean | null;
  limit?: number;
};

export type GatewayProviderHealthOperatorFilters = {
  providerAccountId?: string | null;
  protocolFamily?: GatewayProtocolFamily | null;
  status?: string | null;
};

export type GatewayRuntimePressureOperatorFilters = {
  projectId?: string | null;
  providerAccountId?: string | null;
  limit?: number;
};

export type GatewayAnalysisOperatorFilters = GatewayRequestAuditOperatorFilters & {
  artifactAvailable?: boolean | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  maxTextChars?: number | null;
};

export type GatewayPromptCacheOperatorFilters = GatewayRequestAuditOperatorFilters & {
  inputPricePerMillion?: number | null;
  bucketSize?: string | null;
};

export type GatewayProviderRoutingAnalysisOperatorFilters = GatewayRequestAuditOperatorFilters & {
  profileKey?: GatewayAnalysisExportAnomalyProfileKey;
  thresholds?: Partial<GatewayProviderRoutingAnalysisAnomalyThresholdConfig>;
};

export type GatewayPersistedAnalysisExportFilters = {
  exportId?: string | null;
  label?: string | null;
  tag?: string | null;
  projectId?: string | null;
  status?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

export type GatewayAnalysisExportBaselineReportFilters = Omit<GatewayPersistedAnalysisExportFilters, "exportId" | "limit"> & {
  limit?: number;
};

export type GatewayAnalysisExportAnomalyReportFilters = GatewayAnalysisExportBaselineReportFilters & {
  policyId?: string | null;
  profileKey?: GatewayAnalysisExportAnomalyProfileKey | string | null;
  failureRateWarningThreshold?: number | null;
  failureRateCriticalThreshold?: number | null;
  failureRateDeltaRatioThreshold?: number | null;
  completionRateWarningThreshold?: number | null;
  completionRateCriticalThreshold?: number | null;
  completionRateDeltaValueThreshold?: number | null;
  responseArtifactCoverageWarningThreshold?: number | null;
  responseArtifactCoverageCriticalThreshold?: number | null;
  responseArtifactCoverageDeltaValueThreshold?: number | null;
  requestArtifactCoverageWarningThreshold?: number | null;
  requestArtifactCoverageCriticalThreshold?: number | null;
  requestArtifactCoverageDeltaValueThreshold?: number | null;
  tokensPerSampleWarningDeltaRatioThreshold?: number | null;
  tokensPerSampleCriticalDeltaRatioThreshold?: number | null;
  tokensPerSampleCriticalAbsoluteThreshold?: number | null;
};

export type GatewayAnalysisAnomalyPolicyFilters = {
  policyId?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  status?: GatewayAnalysisAnomalyPolicyStatus | string | null;
  tag?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  autoSyncEnabled?: boolean | null;
  autoEscalateEnabled?: boolean | null;
  autoRemediationEnabled?: boolean | null;
  alertingEnabled?: boolean | null;
  dueOnly?: boolean | null;
  limit?: number;
};

export type GatewayAnalysisAnomalyIncidentFilters = {
  incidentId?: string | null;
  policyId?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  ownerUserId?: string | null;
  tag?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  status?: GatewayAnalysisAnomalyIncidentStatus | string | null;
  followUpStatus?: GatewayAnalysisAnomalyIncidentFollowUpStatus | string | null;
  escalationStatus?: GatewayAnalysisAnomalyIncidentEscalationStatus | string | null;
  code?: string | null;
  severity?: string | null;
  limit?: number;
};

export type GatewayAnalysisAnomalyIncidentAlertQueueFilters = GatewayAnalysisAnomalyIncidentFilters & {
  dueOnly?: boolean | null;
};

export type GatewayAnalysisAnomalyIncidentHistoryFilters = {
  incidentId?: string | null;
  limit?: number;
};

export type GatewayAnalysisAnomalyRemediationRunFilters = {
  incidentId?: string | null;
  policyId?: string | null;
  routePolicyId?: string | null;
  actionKey?: string | null;
  status?: GatewayAnalysisAnomalyRemediationRunStatus | string | null;
  executionMode?: GatewayAnalysisAnomalyRemediationExecutionMode | string | null;
  dryRun?: boolean | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters = {
  snapshotId?: string | null;
  label?: string | null;
  routePolicyId?: string | null;
  actionKey?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters = {
  snapshotId?: string | null;
  label?: string | null;
  routePolicyId?: string | null;
  actionKey?: string | null;
  profileKey?: GatewayAnalysisExportAnomalyProfileKey | string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters =
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters;

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters =
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters & {
    profileKey?: GatewayAnalysisExportAnomalyProfileKey | string | null;
    impactedRunRateWarningThreshold?: number | null;
    impactedRunRateCriticalThreshold?: number | null;
    unavailableRunRateWarningThreshold?: number | null;
    unavailableRunRateCriticalThreshold?: number | null;
    completionRateRegressedWarningThreshold?: number | null;
    completionRateRegressedCriticalThreshold?: number | null;
    failureRateRegressedWarningThreshold?: number | null;
    failureRateRegressedCriticalThreshold?: number | null;
    requestArtifactRegressedWarningThreshold?: number | null;
    requestArtifactRegressedCriticalThreshold?: number | null;
    responseArtifactRegressedWarningThreshold?: number | null;
    responseArtifactRegressedCriticalThreshold?: number | null;
    firstTokenLatencyRegressedWarningThreshold?: number | null;
    firstTokenLatencyRegressedCriticalThreshold?: number | null;
    totalTokensRegressedWarningThreshold?: number | null;
    totalTokensRegressedCriticalThreshold?: number | null;
  };

export type GatewayAnalysisAnomalyRemediationQueueFilters = GatewayAnalysisAnomalyIncidentFilters & {
  actionKey?: string | null;
  executionMode?: GatewayAnalysisAnomalyRemediationExecutionMode | string | null;
  dueOnly?: boolean | null;
};

export function now() {
  return new Date();
}

export function normalizeRequiredText(value: string, fieldLabel: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConflictError(`${fieldLabel}不能为空。`);
  }
  if (trimmed.length > maxLength) {
    throw new ConflictError(`${fieldLabel}长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

export function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new ConflictError(`文本长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

export function truncateErrorSummary(value: string | null | undefined, maxLength = 1_000) {
  const message = value?.trim() ?? "";
  if (!message) {
    return null;
  }
  return message.length > maxLength ? `${message.slice(0, maxLength - 1)}…` : message;
}

export function parseFilterTimestamp(value: string | null | undefined, fieldLabel: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new ConflictError(`${fieldLabel} 必须是合法的 ISO 时间。`);
  }
  return parsed;
}

export function normalizeNonNegativeNumber(value: number | null | undefined, fallback: number | null) {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new ConflictError("数值必须是非负数字。");
  }
  return value;
}

export function normalizeNonNegativeInt(value: number | null | undefined, fallback: number | null, maxValue = 1_000_000) {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new ConflictError("数值必须是非负整数。");
  }
  if (value > maxValue) {
    throw new ConflictError(`数值不能超过 ${maxValue}。`);
  }
  return value;
}

export function normalizePositiveIntField(
  label: string,
  value: number | null | undefined,
  fallback: number | null,
  maxValue = 1_000_000,
) {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new ConflictError(`${label} 必须是正整数。`);
  }
  if (value > maxValue) {
    throw new ConflictError(`${label} 不能超过 ${maxValue}。`);
  }
  return value;
}

export function slugify(input: string) {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "gateway"
  );
}

export function normalizeStringList(values: string[] | null | undefined, options?: { lowerCase?: boolean }) {
  const seen = new Set<string>();
  const normalized = (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => (options?.lowerCase ? value.toLowerCase() : value))
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  return normalized.length > 0 ? normalized : null;
}

export function assertPlatformOperator(userId: string, providerUserId?: string | null) {
  const operatorIds = new Set(
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
  if (!operatorIds.has(userId) && (!providerUserId || !operatorIds.has(providerUserId))) {
    throw new UnauthorizedError("Only platform operators can manage AI gateway");
  }
}

export function accumulateSummaryBucket(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() ?? "";
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

export function toSummaryBuckets(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count } satisfies GatewaySummaryBucket))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? null;
}

export function buildDistribution(values: Array<number | null | undefined>) {
  const normalized = values.filter((value): value is number => Number.isFinite(value ?? NaN));
  if (normalized.length === 0) {
    return {
      avg: null,
      p50: null,
      p95: null,
    } satisfies GatewayAnalysisMetricDistributionView;
  }
  const sum = normalized.reduce((accumulator, value) => accumulator + value, 0);
  return {
    avg: Number((sum / normalized.length).toFixed(2)),
    p50: percentile(normalized, 0.5),
    p95: percentile(normalized, 0.95),
  } satisfies GatewayAnalysisMetricDistributionView;
}
