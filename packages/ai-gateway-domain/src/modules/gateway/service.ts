import type {
  GatewayAggregatorApiMode,
  GatewayApiKeyView,
  ExecuteGatewayAnalysisAnomalyIncidentRemediationInput,
  GatewayAnalysisAnomalyAlertDeliverySeverity,
  GatewayAnalysisAnomalyIncidentAlertQueueItemView,
  GatewayAnalysisAnomalyIncidentAlertQueueView,
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView,
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView,
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig,
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView,
  GatewayAnalysisAnomalyIncidentHistoryEventType,
  GatewayAnalysisAnomalyIncidentHistoryView,
  GatewayAnalysisAnomalyIncidentFollowUpInput,
  GatewayAnalysisAnomalyIncidentRemediationActionView,
  GatewayAnalysisAnomalyIncidentRemediationQueueItemView,
  GatewayAnalysisAnomalyIncidentRemediationQueueView,
  GatewayAnalysisAnomalyRemediationEffectivenessSummaryView,
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView,
  GatewayAnalysisAnomalyRemediationRunImpactView,
  GatewayAnalysisAnomalyRemediationRunSummaryView,
  GatewayAnalysisAnomalyIncidentRemediationRunView,
  GatewayAnalysisAnomalyIncidentFollowUpStatus,
  GatewayAnalysisAnomalyIncidentRemediationPlanView,
  GatewayAnalysisAnomalyRemediationSweepView,
  GatewayAnalysisAnomalyRemediationExecutionMode,
  GatewayAnalysisAnomalyIncidentEscalationStatus,
  GatewayAnalysisAnomalyIncidentStatus,
  GatewayAnalysisAnomalyRemediationRunStatus,
  GatewayAnalysisAnomalyIncidentSummaryView,
  GatewayAnalysisAnomalyIncidentView,
  GatewayAnalysisAnomalyPolicyStatus,
  GatewayAnalysisAnomalyPolicySummaryView,
  GatewayAnalysisAnomalyPolicySweepView,
  GatewayAnalysisAnomalyPolicySyncStatus,
  GatewayAnalysisAnomalyPolicyView,
  GatewayAnalysisExportAnomalyReportView,
  GatewayAnalysisExportAnomalyProfileKey,
  GatewayAnalysisExportAnomalySeverity,
  GatewayAnalysisExportAnomalyThresholdConfig,
  GatewayAnalysisExportBaselineReportView,
  GatewayAnalysisExportCleanupResult,
  GatewayAnalysisExportDiffView,
  GatewayAnalysisExportTextMode,
  GatewayAnalysisExportFilterView,
  GatewayAnalysisExportInventorySummaryView,
  GatewayAnalysisExportMetadataUpdateInput,
  GatewayAnalysisExportRowView,
  GatewayAnalysisExportTrendPointView,
  GatewayAnalysisExportTrendReportView,
  GatewayAnalysisExportView,
  GatewayAnalysisExportTimelinePairView,
  GatewayAnalysisExportTimelineReportView,
  GatewayAnalysisExportManifest,
  GatewayPersistedAnalysisExportView,
  GatewaySyncRateLimitHotspotAnomalyIncidentsResult,
  GatewaySyncProviderRoutingAnalysisAnomalyIncidentsResult,
  GatewayEndpointExecutionModeMap,
  GatewayExecutionMode,
  GatewaySearchApiCompatibleProviderPayload,
  GatewayOpenAiCompatibleProviderPayload,
  GatewayModelAliasView,
  GatewayModelAliasScopeType,
  GatewayProjectView,
  GatewayProjectPressureView,
  GatewayProtocolFamily,
  GatewayProtocolProfile,
  GatewayProviderAccountPayload,
  GatewayProviderHealthSummaryView,
  GatewayProviderInventoryEntryView,
  GatewayProviderInventorySummaryView,
  GatewayProviderInventoryView,
  GatewayProviderCostHintsView,
  GatewayPriceRateView,
  GatewayProviderAccountView,
  GatewayProviderSourceProfile,
  GatewayProviderSourceProfileBackfillInput,
  GatewayProviderSourceProfileBackfillResult,
  GatewayProviderSourceKind,
  GatewayProviderSourceView,
  PatchGatewayProviderSourceProfileInput,
  GatewayModelAssociationAliasRowView,
  GatewayModelAssociationMatrixView,
  GatewayModelAssociationProviderAliasLinkView,
  GatewayModelAssociationProviderLinkView,
  GatewayModelAssociationProviderRowView,
  GatewayProviderRoutingAnalysisAnomalyReportView,
  GatewayProviderRoutingAnalysisAnomalyThresholdConfig,
  GatewayProviderRoutingAnalysisFilterView,
  GatewayProviderRoutingAnalysisSummaryView,
  GatewayProviderPressureView,
  GatewayPromptCacheSummaryView,
  GatewayPromptCacheTrendReportView,
  GatewayAnalysisSampleView,
  GatewayAnalysisSummaryView,
  GatewayAnalysisMetricDistributionView,
  GatewayRequestAnalysisProfile,
  GatewayRequestAuditView,
  GatewayRequestArtifactsView,
  GatewayRequestAuditSummaryView,
  GatewayRequestRouteTrace,
  GatewayRequestStatus,
  GatewayRoutePolicyConfig,
  GatewayRoutePolicyView,
  GatewayRuntimePressureView,
  GatewaySessionAuthConfig,
  GatewaySessionBackedProviderRuntime,
  GatewaySessionDetailView,
  GatewaySessionView,
  GatewayStoredRequestArtifact,
  GatewayStoredResponseArtifact,
  GatewaySummaryBucket,
  GatewayCostOverviewView,
  GatewayRateLimitHotspotSummaryView,
  GatewayRateLimitHotspotFilterView,
  GatewayRateLimitHotspotTrendReportView,
  GatewayRateLimitHotspotAnomalyReportView,
  GatewayRateLimitHotspotAnomalyThresholdConfig,
  GatewayRateLimitHotspotSnapshotView,
  GatewayRateLimitHotspotSnapshotInventorySummaryView,
  GatewayRateLimitHotspotSnapshotTrendReportView,
  GatewayRateLimitHotspotAnomalySnapshotView,
  GatewayTenantView,
  GatewayWebReverseAccessMode,
  GatewayProviderHealthView,
  GatewayRelayEndpointKind,
  UpsertGatewayAnalysisAnomalyPolicyInput,
  UpsertGatewayModelAliasInput,
  UpsertGatewayProviderAccountInput,
  UpsertGatewayRoutePolicyInput,
} from "@neuro/contracts";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { env } from "@/env";
import { getCachedProviderPayload, setCachedProviderPayload } from "@/modules/gateway/provider-credential-sync";
import { buildGatewayProjectApiKey, verifyGatewayProjectApiKey } from "@/modules/gateway/api-key";
import {
  resolveGatewayAnalysisAnomalyAlertDeliveryProfile,
  resolveGatewayAnalysisAnomalyIncidentAlertSchedule,
} from "@/modules/gateway/analysis-alert";
import {
  buildGatewayAnalysisExportAnomalyReport,
  buildGatewayAnalysisExportAnomalyThresholdConfig,
} from "@/modules/gateway/analysis-anomaly";
import {
  buildGatewayProviderRoutingAnalysisAnomalyReport,
  buildGatewayProviderRoutingAnalysisAnomalyThresholdConfig,
  buildGatewayProviderRoutingAnalysisSummary,
} from "@/modules/gateway/analysis-provider-routing";
import { buildGatewayAnalysisExportBaselineReport } from "@/modules/gateway/analysis-baseline";
import { buildGatewayAnalysisExportDiff } from "@/modules/gateway/analysis-diff";
import { buildGatewayAnalysisExportInventorySummary } from "@/modules/gateway/analysis-inventory";
import {
  buildGatewayAnalysisAnomalyIncidentFingerprint,
  buildGatewayAnalysisAnomalyIncidentSummary,
} from "@/modules/gateway/analysis-incident";
import {
  resolveGatewayAnalysisAnomalyAutoEscalation,
  resolveGatewayProviderRoutingAutoEscalation,
  resolveGatewayRateLimitHotspotAutoEscalation,
} from "@/modules/gateway/analysis-escalation";
import {
  resolveGatewayAnalysisAnomalyRemediationSchedule,
  resolveGatewayRoutingAnomalyAutoRemediationConfig,
  resolveGatewayRateLimitHotspotAutoRemediationConfig,
} from "@/modules/gateway/analysis-auto-remediation";
import {
  buildGatewayAnalysisAnomalyRemediationEffectivenessSummary,
} from "@/modules/gateway/analysis-remediation-effectiveness";
import {
  buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalyReport,
  buildGatewayAnalysisAnomalyRemediationEffectivenessThresholdConfig,
} from "@/modules/gateway/analysis-remediation-snapshot-anomaly";
import { buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummary } from "@/modules/gateway/analysis-remediation-snapshot-inventory";
import {
  buildGatewayAnalysisAnomalyRemediationEffectivenessTrendPoint,
  buildGatewayAnalysisAnomalyRemediationEffectivenessTrendReport,
} from "@/modules/gateway/analysis-remediation-snapshot-trend";
import {
  buildGatewayAnalysisAnomalyRemediationRunImpact,
  buildGatewayAnalysisAnomalyRemediationRunSummary,
} from "@/modules/gateway/analysis-remediation-impact";
import {
  buildGatewayAnalysisAnomalyPolicySummary,
  resolveGatewayAnalysisAnomalyPolicySchedule,
} from "@/modules/gateway/analysis-policy";
import { buildGatewayAnalysisAnomalyIncidentRemediationPlan } from "@/modules/gateway/analysis-remediation";
import { resolveGatewayAnalysisAnomalyRoutePolicyPatch } from "@/modules/gateway/analysis-remediation-execution";
import { buildGatewayAnalysisExportTimelineReport } from "@/modules/gateway/analysis-timeline";
import { buildGatewayAnalysisExportTrendReport } from "@/modules/gateway/analysis-trend";
import {
  buildGatewayAnalysisDatasetJsonl,
  buildGatewayAnalysisExportFileView,
  buildGatewayAnalysisExportManifest,
  buildGatewayAnalysisExportRow,
} from "@/modules/gateway/analysis-export";
import {
  buildGatewayAnalysisExportDatasetObjectKey,
  buildGatewayAnalysisExportManifestObjectKey,
  buildGatewayAnalysisExportPrefix,
  buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotObjectKey,
  buildGatewayAnalysisRemediationEffectivenessSnapshotObjectKey,
  buildGatewayProviderAccountObjectKey,
  buildGatewayRequestArtifactObjectKey,
  buildGatewayRateLimitHotspotAnomalySnapshotObjectKey,
  buildGatewayRateLimitHotspotSnapshotObjectKey,
} from "@/modules/gateway/object-keys";
import { buildGatewayRateLimitHotspotSummary } from "./rate-limit-hotspot";
import { buildGatewayRateLimitHotspotSnapshotInventorySummary } from "./rate-limit-hotspot-snapshot-inventory";
import {
  buildGatewayRateLimitHotspotSnapshotTrendPoint,
  buildGatewayRateLimitHotspotSnapshotTrendReport,
} from "./rate-limit-hotspot-snapshot-trend";
import { buildGatewayRateLimitHotspotTrendReport } from "./rate-limit-hotspot-trend";
import {
  buildGatewayRateLimitHotspotAnomalyReport,
  buildGatewayRateLimitHotspotAnomalyThresholdConfig,
} from "./rate-limit-hotspot-anomaly";
import { normalizeRoutePolicyGuardrails } from "@/modules/gateway/route-policy-guardrails";
import { normalizeRoutePolicyRateLimitHotspotAutoRemediationProfile } from "@/modules/gateway/route-policy-hotspot-remediation";
import { normalizeRoutePolicyRoutingAnomalyAutoRemediationProfile } from "@/modules/gateway/route-policy-routing-remediation";
import { routePolicyAllowsModels, routePolicyHasModelRestrictions } from "@/modules/gateway/route-policy-models";
import {
  normalizeRoutePolicyRateLimitDefinition,
  normalizeRoutePolicyRateLimitMap,
} from "@/modules/gateway/route-policy-rate-limits";
import { buildGatewayProviderRoutingScore } from "@/modules/gateway/provider-routing-score";
import { maskGatewayProviderPayload } from "@/modules/gateway/provider-payload-mask";
import { chooseProviderPayloadStorageMode } from "@/modules/gateway/provider-payload-storage";
import { deleteGatewayObject, listGatewayObjects, putGatewayObject, readGatewayObject } from "@/modules/gateway/object-storage";
import {
  gatewayApiKeys,
  gatewayAnalysisAnomalyIncidentHistory,
  gatewayAnalysisAnomalyIncidents,
  gatewayAnalysisAnomalyPolicies,
  gatewayAnalysisAnomalyRemediationRuns,
  gatewayAnalysisExports,
  gatewayModelAliases,
  gatewayProjects,
  gatewayProviderAccounts,
  gatewayRequestAudits,
  gatewayRoutePolicies,
  gatewaySessions,
  gatewayTenants,
} from "@/modules/gateway/schema";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "@neuro/backend-foundation/platform/errors";
import { mapWithConcurrency } from "@neuro/backend-foundation/async/map-with-concurrency";
import { requestInternalText } from "@neuro/backend-foundation/platform/internal-request";
import { discoverGatewayProviderModelIds } from "@/modules/gateway/provider-model-discovery";

const ANALYSIS_EXPORT_READ_CONCURRENCY = 12;
const GATEWAY_PROVIDER_RESPONSE_MAX_BYTES = 1_048_576;

function requestGatewayProviderText(url: string, init: RequestInit, operation: string) {
  return requestInternalText(url, init, {
    timeoutMs: env.providerFetchTimeoutMs,
    timeoutMessage: `${operation} timed out`,
    maxBodyBytes: GATEWAY_PROVIDER_RESPONSE_MAX_BYTES,
  });
}

type GatewayApiKeyRow = typeof gatewayApiKeys.$inferSelect;
type GatewayAnalysisAnomalyIncidentHistoryRow = typeof gatewayAnalysisAnomalyIncidentHistory.$inferSelect;
type GatewayAnalysisAnomalyIncidentRow = typeof gatewayAnalysisAnomalyIncidents.$inferSelect;
type GatewayAnalysisAnomalyPolicyRow = typeof gatewayAnalysisAnomalyPolicies.$inferSelect;
type GatewayAnalysisAnomalyRemediationRunRow = typeof gatewayAnalysisAnomalyRemediationRuns.$inferSelect;
type GatewayAnalysisExportRow = typeof gatewayAnalysisExports.$inferSelect;
type GatewayProjectRow = typeof gatewayProjects.$inferSelect;
type GatewayProviderAccountRow = typeof gatewayProviderAccounts.$inferSelect;
type GatewayRoutePolicyRow = typeof gatewayRoutePolicies.$inferSelect;
type GatewaySessionRow = typeof gatewaySessions.$inferSelect;
type GatewayTenantRow = typeof gatewayTenants.$inferSelect;

type GatewayCostBucketContributionView = {
  providerAccountId: string;
  label: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  staticCostMicros: number | null;
  observedCostMicros: number | null;
};

type GatewayCostBucketView = {
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

type GatewayPricingQuoteView = {
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

export type GatewayRouteCandidate = {
  aliasId: string | null;
  modelAlias: string | null;
  providerAccount: GatewayProviderAccountView;
  upstreamModel: string | null;
  resolvedExecutionMode: GatewayExecutionMode;
  priority: number;
  weight: number;
};

export type AuthenticatedGatewayAccess = {
  apiKey: GatewayApiKeyRow;
  project: GatewayProjectRow;
  tenant: GatewayTenantRow;
};

export type GatewayResolvedRouteContext = {
  project: GatewayProjectView;
  routePolicy: GatewayRoutePolicyView;
  candidates: GatewayRouteCandidate[];
};

export type GatewayResolvedProviderNamespaceContext = {
  project: GatewayProjectView;
  routePolicy: GatewayRoutePolicyView;
  providerName: string;
  providerAccounts: GatewayProviderAccountView[];
};

type GatewayRequestAuditOperatorFilters = {
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

type GatewayRateLimitHotspotOperatorFilters = GatewayRequestAuditOperatorFilters & {
  windowSize?: number | null;
  bucketSizeMinutes?: number | null;
};

type GatewayRateLimitHotspotAnomalyOperatorFilters = GatewayRateLimitHotspotOperatorFilters & {
  label?: string | null;
  profileKey?: GatewayAnalysisExportAnomalyProfileKey | null;
  thresholds?: Partial<GatewayRateLimitHotspotAnomalyThresholdConfig>;
};

type GatewayRateLimitHotspotSnapshotFilters = {
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

type GatewayRateLimitHotspotSnapshotTrendFilters = GatewayRateLimitHotspotSnapshotFilters;

type GatewayRateLimitHotspotAnomalySnapshotFilters = {
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

type GatewaySessionOperatorFilters = {
  projectId?: string | null;
  providerAccountId?: string | null;
  protocolFamily?: GatewayProtocolFamily | null;
  activeOnly?: boolean | null;
  limit?: number;
};

type GatewayProviderHealthOperatorFilters = {
  providerAccountId?: string | null;
  protocolFamily?: GatewayProtocolFamily | null;
  status?: string | null;
};

type GatewayRuntimePressureOperatorFilters = {
  projectId?: string | null;
  providerAccountId?: string | null;
  limit?: number;
};

type GatewayAnalysisOperatorFilters = GatewayRequestAuditOperatorFilters & {
  artifactAvailable?: boolean | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  maxTextChars?: number | null;
};

type GatewayPromptCacheOperatorFilters = GatewayRequestAuditOperatorFilters & {
  inputPricePerMillion?: number | null;
  bucketSize?: string | null;
};

type GatewayProviderRoutingAnalysisOperatorFilters = GatewayRequestAuditOperatorFilters & {
  profileKey?: GatewayAnalysisExportAnomalyProfileKey;
  thresholds?: Partial<GatewayProviderRoutingAnalysisAnomalyThresholdConfig>;
};

type GatewayPersistedAnalysisExportFilters = {
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

type GatewayAnalysisExportBaselineReportFilters = Omit<GatewayPersistedAnalysisExportFilters, "exportId" | "limit"> & {
  limit?: number;
};

type GatewayAnalysisExportAnomalyReportFilters = GatewayAnalysisExportBaselineReportFilters & {
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

type GatewayAnalysisAnomalyPolicyFilters = {
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

type GatewayAnalysisAnomalyIncidentFilters = {
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

type GatewayAnalysisAnomalyIncidentAlertQueueFilters = GatewayAnalysisAnomalyIncidentFilters & {
  dueOnly?: boolean | null;
};

type GatewayAnalysisAnomalyIncidentHistoryFilters = {
  incidentId?: string | null;
  limit?: number;
};

type GatewayAnalysisAnomalyRemediationRunFilters = {
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

type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters = {
  snapshotId?: string | null;
  label?: string | null;
  routePolicyId?: string | null;
  actionKey?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

type GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters = {
  snapshotId?: string | null;
  label?: string | null;
  routePolicyId?: string | null;
  actionKey?: string | null;
  profileKey?: GatewayAnalysisExportAnomalyProfileKey | string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number;
};

type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters =
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters;

type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters =
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

type GatewayAnalysisAnomalyRemediationQueueFilters = GatewayAnalysisAnomalyIncidentFilters & {
  actionKey?: string | null;
  executionMode?: GatewayAnalysisAnomalyRemediationExecutionMode | string | null;
  dueOnly?: boolean | null;
};

function now() {
  return new Date();
}

function normalizeRequiredText(value: string, fieldLabel: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConflictError(`${fieldLabel}不能为空。`);
  }
  if (trimmed.length > maxLength) {
    throw new ConflictError(`${fieldLabel}长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new ConflictError(`文本长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeGatewayServiceProviderIdentity(
  providerLabel: string,
  serviceProviderKey: string | null | undefined,
  serviceProviderLabel: string | null | undefined,
) {
  const normalizedLabel =
    normalizeOptionalText(serviceProviderLabel, 120) ?? normalizeRequiredText(providerLabel, "服务商归属名", 120);
  const normalizedKey =
    normalizeOptionalText(serviceProviderKey, 120) != null
      ? normalizeGatewayServiceProviderKey(serviceProviderKey ?? "")
      : deriveGatewayServiceProviderKey(normalizedLabel);
  return {
    serviceProviderKey: normalizedKey,
    serviceProviderLabel: normalizedLabel,
  };
}

function normalizeGatewayServiceProviderKey(value: string) {
  const normalized = sanitizeGatewayServiceProviderKey(value);
  if (!normalized) {
    throw new ConflictError("serviceProviderKey 只允许字母、数字与分隔符，归一化后不能为空。");
  }
  if (normalized.length > 120) {
    throw new ConflictError("serviceProviderKey 长度不能超过 120 个字符。");
  }
  return normalized;
}

function deriveGatewayServiceProviderKey(label: string) {
  const normalized = sanitizeGatewayServiceProviderKey(label);
  if (normalized) {
    return normalized;
  }
  return `sp_${stableGatewayServiceProviderHash(label)}`;
}

function normalizeGatewayProtocolProfile(
  value: GatewayProtocolProfile | string | null | undefined,
): GatewayProtocolProfile | string {
  const normalized = value?.trim().toLowerCase().replace(/[-\s]+/g, "_") ?? "";
  return normalized || "custom";
}

function normalizeGatewayProtocolFamily(
  value: GatewayProtocolFamily | string | null | undefined,
): GatewayProtocolFamily | string {
  const normalized = value?.trim().toLowerCase().replace(/[-\s]+/g, "_") ?? "";
  switch (normalized) {
    case "openai_chat_completions":
    case "chat_completions":
    case "chat":
      return "openai_chat";
    case "openai_completions":
    case "legacy_completions":
    case "completions":
      return "openai_legacy_completions";
    case "responses":
      return "openai_responses";
    case "realtime":
      return "openai_realtime";
    case "embeddings":
      return "openai_embeddings";
    case "audio_transcriptions":
    case "transcriptions":
      return "openai_audio_transcriptions";
    case "audio_speech":
      return "openai_audio_speech";
    case "images_generations":
    case "image_generations":
      return "openai_images_generations";
    case "images_edits":
    case "image_edits":
      return "openai_images_edits";
    case "music_generations":
      return "openai_music_generations";
    case "videos_generations":
      return "openai_videos_generations";
    case "messages":
      return "anthropic_messages";
    case "generate_content":
      return "gemini_generate_content";
    case "converse":
      return "bedrock_converse";
    case "cohere_chat_v2":
      return "cohere_chat";
    case "perplexity":
    case "perplexity_search":
      return "perplexity_search";
    case "tavily":
      return "tavily_search";
    case "exa":
      return "exa_search";
    case "jina":
      return "jina_search";
    case "linkup":
      return "linkup_search";
    case "you":
      return "you_search";
    case "websearchapi":
      return "websearchapi_search";
    case "gemini_business":
      return "gemini_business_images";
    case "chataibot":
      return "chataibot_images";
    case "lumalabs":
      return "lumalabs_images";
    case "producer_music":
      return "producer_music";
    case "producer_videos":
      return "producer_videos";
    case "gemini_canvas_images":
      return "gemini_canvas_images";
    case "gemini_canvas_music":
      return "gemini_canvas_music";
    case "gemini_canvas_videos":
      return "gemini_canvas_videos";
    case "suno_music":
      return "suno_music";
    case "udio_music":
      return "udio_music";
    case "search_api":
      return "search";
    default:
      return normalized || "openai";
  }
}

function isGatewaySearchProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return (
    normalized === "search" ||
    normalized === "search_api" ||
    normalized === "perplexity_search" ||
    normalized === "tavily_search" ||
    normalized === "exa_search" ||
    normalized === "jina_search" ||
    normalized === "jina_reader" ||
    normalized === "linkup_search" ||
    normalized === "you_search" ||
    normalized === "websearchapi_search"
  );
}

function isGatewaySearchAdapter(adapter: GatewayProviderAccountView["adapter"] | string) {
  return adapter === "search_api_compatible" || adapter === "linkup_compatible";
}

function isGatewaySearchProviderPayload(
  payload: GatewayProviderAccountPayload,
): payload is GatewaySearchApiCompatibleProviderPayload {
  return isGatewaySearchAdapter(payload.adapter);
}

function isGatewayOpenAiProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return (
    normalized === "openai" ||
    normalized === "openai_chat" ||
    normalized === "openai_legacy_completions" ||
    normalized === "openai_responses" ||
    normalized === "openai_realtime" ||
    normalized === "openai_embeddings" ||
    normalized === "openai_audio_transcriptions" ||
    normalized === "openai_audio_speech" ||
    normalized === "openai_images_generations" ||
    normalized === "openai_images_edits" ||
    normalized === "openai_music_generations" ||
    normalized === "openai_videos_generations"
  );
}

function isGatewayAnthropicProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "anthropic" || normalized === "anthropic_messages";
}

function isGatewayGeminiProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "gemini" || normalized === "gemini_generate_content" || normalized === "gemini_live";
}

function isGatewayBedrockProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "bedrock" || normalized === "bedrock_converse";
}

function isGatewayCohereProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "cohere" || normalized === "cohere_chat";
}

function isGatewayGeminiBusinessProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "gemini_business" || normalized === "gemini_business_images";
}

function isGatewayChataibotProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "chataibot" || normalized === "chataibot_images";
}

function isGatewayLumalabsProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "lumalabs" || normalized === "lumalabs_images";
}

function isGatewayGeminiCanvasProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return (
    normalized === "gemini_canvas" ||
    normalized === "gemini_canvas_images" ||
    normalized === "gemini_canvas_music" ||
    normalized === "gemini_canvas_videos"
  );
}

function isGatewayProducerProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "producer" || normalized === "producer_music" || normalized === "producer_videos";
}

function isGatewaySunoProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "suno" || normalized === "suno_music";
}

function isGatewayUdioProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "udio" || normalized === "udio_music";
}

function sanitizeGatewayServiceProviderKey(value: string) {
  let normalized = "";
  let previousWasSeparator = false;
  for (const char of value.trim()) {
    const lowered = char.toLowerCase();
    if (/^[a-z0-9]$/.test(lowered)) {
      normalized += lowered;
      previousWasSeparator = false;
      continue;
    }
    if (/[ _./:-]/.test(char) && !previousWasSeparator) {
      normalized += "_";
      previousWasSeparator = true;
    }
  }
  return normalized.replace(/^_+|_+$/g, "").slice(0, 120);
}

function stableGatewayServiceProviderHash(value: string) {
  let hash = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  for (const byte of Buffer.from(value, "utf8")) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function truncateErrorSummary(value: string | null | undefined, maxLength = 1_000) {
  const message = value?.trim() ?? "";
  if (!message) {
    return null;
  }
  return message.length > maxLength ? `${message.slice(0, maxLength - 1)}…` : message;
}

function parseFilterTimestamp(value: string | null | undefined, fieldLabel: string) {
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

function normalizeAnalysisTextMode(value: string | null | undefined): GatewayAnalysisExportTextMode {
  const normalized = value?.trim() ?? "";
  if (normalized === "none" || normalized === "full" || normalized === "preview_redacted") {
    return normalized;
  }
  return "preview_redacted";
}

function normalizeAnalysisExportLabel(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 120);
}

function normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 120);
}

function normalizeAnalysisExportTags(values: string[] | null | undefined) {
  const normalized = normalizeStringList(values, { lowerCase: true }) ?? [];
  if (normalized.length > 32) {
    throw new ConflictError("tags 数量不能超过 32 个。");
  }
  for (const tag of normalized) {
    if (tag.length > 40) {
      throw new ConflictError("单个 tag 长度不能超过 40 个字符。");
    }
  }
  return normalized;
}

function hasPinnedAnalysisExportTag(values: string[] | null | undefined) {
  return normalizeAnalysisExportTags(values).includes("pinned");
}

function normalizeNonNegativeNumber(value: number | null | undefined, fallback: number | null) {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new ConflictError("数值必须是非负数字。");
  }
  return value;
}

function normalizeGatewayAnalysisAnomalyProfileKey(
  value: GatewayAnalysisExportAnomalyProfileKey | string | null | undefined,
): GatewayAnalysisExportAnomalyProfileKey {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "conservative" || normalized === "aggressive" || normalized === "balanced") {
    return normalized;
  }
  return "balanced";
}

function normalizeGatewayAnalysisAnomalyPolicyStatus(
  value: GatewayAnalysisAnomalyPolicyStatus | string | null | undefined,
): GatewayAnalysisAnomalyPolicyStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "disabled") {
    return "disabled";
  }
  return "enabled";
}

function normalizeGatewayAnalysisAnomalyPolicySyncStatus(
  value: GatewayAnalysisAnomalyPolicySyncStatus | string | null | undefined,
): GatewayAnalysisAnomalyPolicySyncStatus | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "ok" || normalized === "error") {
    return normalized;
  }
  return null;
}

function normalizeGatewayAnalysisAnomalyIncidentStatus(
  value: GatewayAnalysisAnomalyIncidentStatus | string | null | undefined,
): GatewayAnalysisAnomalyIncidentStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "acknowledged" || normalized === "resolved") {
    return normalized;
  }
  return "open";
}

function normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(
  value: GatewayAnalysisAnomalyIncidentFollowUpStatus | string | null | undefined,
): GatewayAnalysisAnomalyIncidentFollowUpStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "investigating" || normalized === "monitoring" || normalized === "done") {
    return normalized;
  }
  return "pending";
}

function normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(
  value: GatewayAnalysisAnomalyIncidentEscalationStatus | string | null | undefined,
): GatewayAnalysisAnomalyIncidentEscalationStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "escalated" || normalized === "resolved") {
    return normalized;
  }
  return "none";
}

function normalizeGatewayAnalysisAnomalySeverity(
  value: GatewayAnalysisExportAnomalySeverity | string | null | undefined,
): GatewayAnalysisExportAnomalySeverity | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "warning" || normalized === "critical") {
    return normalized;
  }
  return null;
}

function normalizeGatewayAnalysisAnomalyAlertDeliverySeverity(
  value: GatewayAnalysisAnomalyAlertDeliverySeverity | string | null | undefined,
): GatewayAnalysisAnomalyAlertDeliverySeverity | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "info" || normalized === "warning" || normalized === "danger") {
    return normalized;
  }
  return null;
}

function buildGatewayAnalysisAnomalyThresholdOverrides(
  filters: GatewayAnalysisExportAnomalyReportFilters,
): Partial<GatewayAnalysisExportAnomalyThresholdConfig> {
  return {
    failureRateWarningThreshold: normalizeNonNegativeNumber(filters.failureRateWarningThreshold, null) ?? undefined,
    failureRateCriticalThreshold: normalizeNonNegativeNumber(filters.failureRateCriticalThreshold, null) ?? undefined,
    failureRateDeltaRatioThreshold: normalizeNonNegativeNumber(filters.failureRateDeltaRatioThreshold, null) ?? undefined,
    completionRateWarningThreshold: normalizeNonNegativeNumber(filters.completionRateWarningThreshold, null) ?? undefined,
    completionRateCriticalThreshold: normalizeNonNegativeNumber(filters.completionRateCriticalThreshold, null) ?? undefined,
    completionRateDeltaValueThreshold:
      filters.completionRateDeltaValueThreshold == null
        ? undefined
        : Number.isFinite(filters.completionRateDeltaValueThreshold)
          ? filters.completionRateDeltaValueThreshold
          : (() => {
              throw new ConflictError("completionRateDeltaValueThreshold 必须是合法数字。");
            })(),
    responseArtifactCoverageWarningThreshold:
      normalizeNonNegativeNumber(filters.responseArtifactCoverageWarningThreshold, null) ?? undefined,
    responseArtifactCoverageCriticalThreshold:
      normalizeNonNegativeNumber(filters.responseArtifactCoverageCriticalThreshold, null) ?? undefined,
    responseArtifactCoverageDeltaValueThreshold:
      filters.responseArtifactCoverageDeltaValueThreshold == null
        ? undefined
        : Number.isFinite(filters.responseArtifactCoverageDeltaValueThreshold)
          ? filters.responseArtifactCoverageDeltaValueThreshold
          : (() => {
              throw new ConflictError("responseArtifactCoverageDeltaValueThreshold 必须是合法数字。");
            })(),
    requestArtifactCoverageWarningThreshold:
      normalizeNonNegativeNumber(filters.requestArtifactCoverageWarningThreshold, null) ?? undefined,
    requestArtifactCoverageCriticalThreshold:
      normalizeNonNegativeNumber(filters.requestArtifactCoverageCriticalThreshold, null) ?? undefined,
    requestArtifactCoverageDeltaValueThreshold:
      filters.requestArtifactCoverageDeltaValueThreshold == null
        ? undefined
        : Number.isFinite(filters.requestArtifactCoverageDeltaValueThreshold)
          ? filters.requestArtifactCoverageDeltaValueThreshold
          : (() => {
              throw new ConflictError("requestArtifactCoverageDeltaValueThreshold 必须是合法数字。");
            })(),
    tokensPerSampleWarningDeltaRatioThreshold:
      normalizeNonNegativeNumber(filters.tokensPerSampleWarningDeltaRatioThreshold, null) ?? undefined,
    tokensPerSampleCriticalDeltaRatioThreshold:
      normalizeNonNegativeNumber(filters.tokensPerSampleCriticalDeltaRatioThreshold, null) ?? undefined,
    tokensPerSampleCriticalAbsoluteThreshold:
      normalizeNonNegativeNumber(filters.tokensPerSampleCriticalAbsoluteThreshold, null) ?? undefined,
  };
}

function buildGatewayAnalysisRemediationEffectivenessAnomalyThresholdOverrides(
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters,
): Partial<GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig> {
  return {
    impactedRunRateWarningThreshold:
      normalizeNonNegativeNumber(filters.impactedRunRateWarningThreshold, null) ?? undefined,
    impactedRunRateCriticalThreshold:
      normalizeNonNegativeNumber(filters.impactedRunRateCriticalThreshold, null) ?? undefined,
    unavailableRunRateWarningThreshold:
      normalizeNonNegativeNumber(filters.unavailableRunRateWarningThreshold, null) ?? undefined,
    unavailableRunRateCriticalThreshold:
      normalizeNonNegativeNumber(filters.unavailableRunRateCriticalThreshold, null) ?? undefined,
    completionRateRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.completionRateRegressedWarningThreshold, null) ?? undefined,
    completionRateRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.completionRateRegressedCriticalThreshold, null) ?? undefined,
    failureRateRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.failureRateRegressedWarningThreshold, null) ?? undefined,
    failureRateRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.failureRateRegressedCriticalThreshold, null) ?? undefined,
    requestArtifactRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.requestArtifactRegressedWarningThreshold, null) ?? undefined,
    requestArtifactRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.requestArtifactRegressedCriticalThreshold, null) ?? undefined,
    responseArtifactRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.responseArtifactRegressedWarningThreshold, null) ?? undefined,
    responseArtifactRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.responseArtifactRegressedCriticalThreshold, null) ?? undefined,
    firstTokenLatencyRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.firstTokenLatencyRegressedWarningThreshold, null) ?? undefined,
    firstTokenLatencyRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.firstTokenLatencyRegressedCriticalThreshold, null) ?? undefined,
    totalTokensRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.totalTokensRegressedWarningThreshold, null) ?? undefined,
    totalTokensRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.totalTokensRegressedCriticalThreshold, null) ?? undefined,
  };
}

function toGatewayAnalysisAnomalyPolicyView(row: GatewayAnalysisAnomalyPolicyRow): GatewayAnalysisAnomalyPolicyView {
  const schedule = resolveGatewayAnalysisAnomalyPolicySchedule({
    status: row.status,
    autoSyncEnabled: row.autoSyncEnabled,
    autoSyncIntervalMinutes: row.autoSyncIntervalMinutes ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  });
  return {
    id: row.id,
    name: row.name,
    status: normalizeGatewayAnalysisAnomalyPolicyStatus(row.status),
    projectId: row.projectId ?? null,
    routePolicyId: row.routePolicyId ?? null,
    tag: row.tag ?? null,
    textMode: (row.textMode as GatewayAnalysisExportTextMode | null) ?? null,
    profileKey: normalizeGatewayAnalysisAnomalyProfileKey(row.profileKey),
    thresholds: row.thresholds,
    autoSyncEnabled: row.autoSyncEnabled,
    autoSyncIntervalMinutes: row.autoSyncIntervalMinutes ?? null,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      lastSyncStatus: normalizeGatewayAnalysisAnomalyPolicySyncStatus(row.lastSyncStatus),
      lastSyncError: row.lastSyncError ?? null,
      nextSyncDueAt: schedule.nextSyncDueAt,
    syncDue: schedule.syncDue,
    autoEscalateEnabled: row.autoEscalateEnabled,
    escalateSeverityThreshold: normalizeGatewayAnalysisAnomalySeverity(row.escalateSeverityThreshold),
    escalateAfterSyncCount: row.escalateAfterSyncCount ?? null,
    autoEscalateOwnerUserId: row.autoEscalateOwnerUserId ?? null,
    autoEscalateFollowUpStatus:
      (row.autoEscalateFollowUpStatus as GatewayAnalysisAnomalyPolicyView["autoEscalateFollowUpStatus"]) ?? null,
    autoRemediationEnabled: row.autoRemediationEnabled,
    autoRemediationIntervalMinutes: row.autoRemediationIntervalMinutes ?? null,
    autoRemediationDryRunFirst: row.autoRemediationDryRunFirst,
    autoRemediationActionKeys: normalizeStringList(row.autoRemediationActionKeys ?? null),
    autoRemediationMaxApplyRunsPerIncident: row.autoRemediationMaxApplyRunsPerIncident ?? null,
    autoRemediationRequireAlertBeforeApply: row.autoRemediationRequireAlertBeforeApply,
    autoRemediationFreezeOnProviderHealthDegrade: row.autoRemediationFreezeOnProviderHealthDegrade,
    alertingEnabled: row.alertingEnabled,
    alertIntervalMinutes: row.alertIntervalMinutes ?? null,
    notifyOperatorsOnEscalation: row.notifyOperatorsOnEscalation,
    notifyOwnerOnEscalation: row.notifyOwnerOnEscalation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toGatewayAnalysisAnomalyIncidentView(row: GatewayAnalysisAnomalyIncidentRow): GatewayAnalysisAnomalyIncidentView {
  return {
    id: row.id,
    policyId: row.policyId ?? null,
    fingerprint: row.fingerprint,
    projectId: row.projectId ?? null,
    routePolicyId: row.routePolicyId ?? null,
    tag: row.tag ?? null,
    textMode: (row.textMode as GatewayAnalysisExportTextMode | null) ?? null,
    code: row.code as GatewayAnalysisAnomalyIncidentView["code"],
    severity: row.severity as GatewayAnalysisAnomalyIncidentView["severity"],
    status: normalizeGatewayAnalysisAnomalyIncidentStatus(row.status),
    ownerUserId: row.ownerUserId ?? null,
    followUpStatus: normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(row.followUpStatus),
    syncHitCount: row.syncHitCount,
    escalationStatus: normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus),
    escalatedAt: row.escalatedAt?.toISOString() ?? null,
    escalationReason: row.escalationReason ?? null,
    latestNote: row.latestNote ?? null,
    resolutionNote: row.resolutionNote ?? null,
    lastActionAt: row.lastActionAt?.toISOString() ?? null,
    lastAlertAttemptAt: row.lastAlertAttemptAt?.toISOString() ?? null,
    lastAlertedAt: row.lastAlertedAt?.toISOString() ?? null,
    lastAlertSeverity: normalizeGatewayAnalysisAnomalyAlertDeliverySeverity(row.lastAlertSeverity),
    alertDeliveryCount: row.alertDeliveryCount,
    summary: row.summary,
    latestExportId: row.latestExportId ?? null,
    previousExportId: row.previousExportId ?? null,
    latestValue: row.latestValue ?? null,
    previousValue: row.previousValue ?? null,
    deltaValue: row.deltaValue ?? null,
    deltaRatio: row.deltaRatio ?? null,
    thresholdValue: row.thresholdValue ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toGatewayAnalysisAnomalyIncidentHistoryView(
  row: GatewayAnalysisAnomalyIncidentHistoryRow,
): GatewayAnalysisAnomalyIncidentHistoryView {
  return {
    id: row.id,
    incidentId: row.incidentId,
    eventType: row.eventType as GatewayAnalysisAnomalyIncidentHistoryEventType,
    actorUserId: row.actorUserId ?? null,
    note: row.note ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toGatewayAnalysisAnomalyRemediationRunView(
  row: GatewayAnalysisAnomalyRemediationRunRow,
): GatewayAnalysisAnomalyIncidentRemediationRunView {
  return {
    id: row.id,
    incidentId: row.incidentId,
    policyId: row.policyId ?? null,
    routePolicyId: row.routePolicyId ?? null,
    actionKey: row.actionKey,
    title: row.title,
    executionMode: row.executionMode as GatewayAnalysisAnomalyIncidentRemediationRunView["executionMode"],
    status: row.status as GatewayAnalysisAnomalyIncidentRemediationRunView["status"],
    dryRun: row.dryRun,
    actorUserId: row.actorUserId,
    note: row.note ?? null,
    input: row.input ?? null,
    result: row.result ?? null,
    beforeIncident: (row.beforeIncident as GatewayAnalysisAnomalyIncidentRemediationRunView["beforeIncident"]) ?? null,
    afterIncident: (row.afterIncident as GatewayAnalysisAnomalyIncidentRemediationRunView["afterIncident"]) ?? null,
    beforeRoutePolicy:
      (row.beforeRoutePolicy as GatewayAnalysisAnomalyIncidentRemediationRunView["beforeRoutePolicy"]) ?? null,
    afterRoutePolicy:
      (row.afterRoutePolicy as GatewayAnalysisAnomalyIncidentRemediationRunView["afterRoutePolicy"]) ?? null,
    errorSummary: row.errorSummary ?? null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

function buildGatewayAnalysisExportFilterView(
  filters: GatewayAnalysisOperatorFilters,
  textMode: GatewayAnalysisExportTextMode,
  maxTextChars: number,
): GatewayAnalysisExportFilterView {
  return {
    projectId: filters.projectId ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    providerAccountId: filters.providerAccountId ?? null,
    sessionId: filters.sessionId ?? null,
    apiKeyId: filters.apiKeyId ?? null,
    responseId: filters.responseId ?? null,
    protocolFamily: filters.protocolFamily ?? null,
    status: filters.status ?? null,
    endpointKind: filters.endpointKind ?? null,
    stream: typeof filters.stream === "boolean" ? filters.stream : null,
    errorCode: filters.errorCode ?? null,
    fallbackEligible: typeof filters.fallbackEligible === "boolean" ? filters.fallbackEligible : null,
    createdFrom: filters.createdFrom?.trim() || null,
    createdTo: filters.createdTo?.trim() || null,
    artifactAvailable: typeof filters.artifactAvailable === "boolean" ? filters.artifactAvailable : null,
    limit: Math.max(1, Math.min(filters.limit ?? 200, 1000)),
    textMode,
    maxTextChars,
  };
}

async function readGatewayAnalysisExportManifest(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayAnalysisExportManifest;
}

async function readGatewayAnalysisExportDataset(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  const lines = buffer
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.map((line) => JSON.parse(line) as GatewayAnalysisExportRowView);
}

function buildSyntheticGatewayAnalysisExportManifest(
  row: Pick<
    GatewayAnalysisExportRow,
    | "id"
    | "label"
    | "tags"
    | "filters"
    | "sampleCount"
    | "requestArtifactCount"
    | "responseArtifactCount"
    | "retentionExpiresAt"
    | "createdAt"
  >,
): GatewayAnalysisExportManifest {
  return {
    schemaVersion: 1,
    exportId: row.id,
    label: row.label,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    retentionExpiresAt: row.retentionExpiresAt?.toISOString() ?? null,
    filters: row.filters,
    sampleCount: row.sampleCount,
    requestArtifactCount: row.requestArtifactCount,
    responseArtifactCount: row.responseArtifactCount,
    files: [],
  };
}

function toGatewayPersistedAnalysisExportView(manifest: GatewayAnalysisExportManifest): GatewayPersistedAnalysisExportView {
  return {
    exportId: manifest.exportId,
    label: manifest.label,
    tags: [],
    status: "active",
    createdAt: manifest.createdAt,
    updatedAt: manifest.createdAt,
    objectPrefix: buildGatewayAnalysisExportPrefix(manifest.exportId),
    filters: manifest.filters,
    sampleCount: manifest.sampleCount,
    requestArtifactCount: manifest.requestArtifactCount,
    responseArtifactCount: manifest.responseArtifactCount,
    retentionExpiresAt: null,
    cleanedUpAt: null,
    lastCleanupError: null,
    files: manifest.files,
    manifest,
  };
}

function toGatewayPersistedAnalysisExportViewFromRow(
  row: GatewayAnalysisExportRow,
  manifest: GatewayAnalysisExportManifest | null,
): GatewayPersistedAnalysisExportView {
  const resolvedManifest = manifest
    ? {
        ...manifest,
        label: row.label,
        tags: row.tags,
        filters: row.filters,
        sampleCount: row.sampleCount,
        requestArtifactCount: row.requestArtifactCount,
        responseArtifactCount: row.responseArtifactCount,
        retentionExpiresAt: row.retentionExpiresAt?.toISOString() ?? null,
      }
    : buildSyntheticGatewayAnalysisExportManifest(row);
  return {
    exportId: row.id,
    label: row.label,
    tags: row.tags,
    status: row.status as GatewayPersistedAnalysisExportView["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    objectPrefix: row.objectPrefix,
    filters: row.filters,
    sampleCount: row.sampleCount,
    requestArtifactCount: row.requestArtifactCount,
    responseArtifactCount: row.responseArtifactCount,
    retentionExpiresAt: row.retentionExpiresAt?.toISOString() ?? null,
    cleanedUpAt: row.cleanedUpAt?.toISOString() ?? null,
    lastCleanupError: row.lastCleanupError ?? null,
    files: resolvedManifest.files,
    manifest: resolvedManifest,
  };
}

function matchesGatewayPersistedAnalysisExportFilters(
  item: Pick<GatewayPersistedAnalysisExportView, "label" | "tags" | "filters" | "createdAt" | "status">,
  filters: GatewayPersistedAnalysisExportFilters,
  createdFrom: Date | null,
  createdTo: Date | null,
) {
  if (filters.label?.trim()) {
    const needle = filters.label.trim().toLowerCase();
    const haystack = item.label?.trim().toLowerCase() ?? "";
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  if (filters.tag?.trim()) {
    const needle = filters.tag.trim().toLowerCase();
    if (!normalizeAnalysisExportTags(item.tags).includes(needle)) {
      return false;
    }
  }
  if (filters.projectId?.trim() && item.filters.projectId !== filters.projectId.trim()) {
    return false;
  }
  if (filters.status?.trim() && item.status !== filters.status.trim()) {
    return false;
  }
  if (filters.textMode && item.filters.textMode !== filters.textMode) {
    return false;
  }
  const createdAt = new Date(item.createdAt);
  if (createdFrom && createdAt < createdFrom) {
    return false;
  }
  if (createdTo && createdAt > createdTo) {
    return false;
  }
  return true;
}

function buildGatewayPersistedAnalysisExportManifestArtifacts(args: {
  exportId: string;
  label: string | null;
  tags: string[];
  createdAt: string;
  retentionExpiresAt: string | null;
  filters: GatewayAnalysisExportFilterView;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  datasetFile: GatewayPersistedAnalysisExportView["files"][number];
  manifestObjectKey: string;
}) {
  const manifest = buildGatewayAnalysisExportManifest({
    exportId: args.exportId,
    label: args.label,
    tags: args.tags,
    createdAt: args.createdAt,
    retentionExpiresAt: args.retentionExpiresAt,
    filters: args.filters,
    sampleCount: args.sampleCount,
    requestArtifactCount: args.requestArtifactCount,
    responseArtifactCount: args.responseArtifactCount,
    files: [
      args.datasetFile,
      {
        kind: "manifest",
        objectKey: args.manifestObjectKey,
        contentType: "application/json",
        sizeBytes: 0,
        sha256: "",
        lineCount: null,
      },
    ],
  });
  const manifestBody = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  const manifestFile = buildGatewayAnalysisExportFileView({
    kind: "manifest",
    objectKey: args.manifestObjectKey,
    contentType: "application/json",
    body: manifestBody,
    lineCount: null,
  });
  const finalizedManifest = buildGatewayAnalysisExportManifest({
    ...manifest,
    files: [manifestFile, args.datasetFile],
  });
  const finalizedManifestBody = Buffer.from(JSON.stringify(finalizedManifest, null, 2), "utf8");
  const finalizedManifestFile = buildGatewayAnalysisExportFileView({
    kind: "manifest",
    objectKey: args.manifestObjectKey,
    contentType: "application/json",
    body: finalizedManifestBody,
    lineCount: null,
  });
  return {
    manifest: {
      ...finalizedManifest,
      files: [finalizedManifestFile, args.datasetFile],
    } satisfies GatewayAnalysisExportManifest,
    manifestBody: finalizedManifestBody,
    manifestFile: finalizedManifestFile,
  };
}

function normalizeNonNegativeInt(value: number | null | undefined, fallback: number | null, maxValue = 1_000_000) {
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

function normalizePositiveIntField(
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

function slugify(input: string) {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "gateway"
  );
}

function defaultRoutePolicyConfig(): GatewayRoutePolicyConfig {
  return {
    stickySessions: true,
    preStreamFallbackEnabled: true,
    selectionStrategy: "weighted_random",
    providerLoadAwareRoutingEnabled: true,
    maxConcurrentRequests: 4,
    providerMaxConcurrentRequests: null,
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 30,
    apiKeyRateLimit: null,
    modelRateLimits: null,
    endpointRateLimits: null,
    circuitBreakerThreshold: 3,
    circuitBreakerCooldownSeconds: 60,
    allowedProviderAccountIds: null,
    allowedProtocolFamilies: null,
    allowedModelIds: null,
    blockedModelIds: null,
    maxRequestBodyBytes: null,
    streamIdleTimeoutSeconds: null,
    totalRequestTimeoutSeconds: null,
    maxStreamHeartbeatGapSeconds: null,
    routingAnomalyAutoRemediation: null,
    rateLimitHotspotAutoRemediation: null,
    fallbackHttpStatuses: [408, 425, 429, 500, 502, 503, 504],
    fallbackErrorCodes: [
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_BODY_TIMEOUT",
    ],
  };
}

function buildBenefitTenantSourceKey(userId: string) {
  return `benefit_user:${userId}`;
}

function buildBenefitProjectSourceKey(serviceId: string, userId: string) {
  return `benefit_service_user:${serviceId}:${userId}`;
}

function normalizeStringList(values: string[] | null | undefined, options?: { lowerCase?: boolean }) {
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

function normalizeSessionAuthTransport(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "bearer" || normalized === "header" || normalized === "cookie") {
    return normalized;
  }
  return "cookie";
}

const gatewayOfficialVendorHostPatterns = [
  /(^|\.)openai\.com$/i,
  /(^|\.)anthropic\.com$/i,
  /(^|\.)x\.ai$/i,
  /(^|\.)groq\.com$/i,
  /(^|\.)googleapis\.com$/i,
  /(^|\.)generativelanguage\.googleapis\.com$/i,
  /(^|\.)mistral\.ai$/i,
  /(^|\.)cohere\.ai$/i,
  /(^|\.)moonshot\.cn$/i,
  /(^|\.)zhipuai\.cn$/i,
  /(^|\.)linkup\.so$/i,
  /(^|\.)tavily\.com$/i,
  /(^|\.)exa\.ai$/i,
  /(^|\.)ydc-index\.io$/i,
  /(^|\.)websearchapi\.ai$/i,
  /(^|\.)jina\.ai$/i,
] as const;

type NormalizedGatewayProviderSourceProfile = GatewayProviderSourceView;

function isGatewayAggregatorApiMode(value: string | null | undefined): value is GatewayAggregatorApiMode {
  return value === "hosted_compute" || value === "upstream_forward";
}

function isGatewayProviderSourceKind(value: string | null | undefined): value is GatewayProviderSourceKind {
  return (
    value === "official_model_api" ||
    value === "official_vendor_api" ||
    value === "aggregator_api" ||
    value === "web_reverse_api"
  );
}

function isGatewayWebReverseAccessMode(value: string | null | undefined): value is GatewayWebReverseAccessMode {
  return value === "direct_http_replay" || value === "browser_challenge";
}

function readGatewayProviderBaseUrl(payload: GatewayProviderAccountPayload): string | null {
  if ("baseUrl" in payload && typeof payload.baseUrl === "string" && payload.baseUrl.trim()) {
    return payload.baseUrl.trim();
  }
  return null;
}

function readGatewayProviderHostname(payload: GatewayProviderAccountPayload): string | null {
  const baseUrl = readGatewayProviderBaseUrl(payload);
  if (!baseUrl) {
    return null;
  }
  try {
    return new URL(baseUrl).hostname.trim().toLowerCase();
  } catch {
    return null;
  }
}

function isKnownOfficialVendorHost(hostname: string | null) {
  if (!hostname) {
    return false;
  }
  return gatewayOfficialVendorHostPatterns.some((pattern) => pattern.test(hostname));
}

function isKnownHostedAggregatorHost(hostname: string | null) {
  if (!hostname) {
    return false;
  }
  return hostname === "api.siliconflow.cn" || hostname === "ai.gitee.com";
}

function adapterBelongsToWebReverseSource(adapter: GatewayProviderAccountView["adapter"] | string) {
  return (
    adapter === "grok_compatible" ||
    adapter === "producer_compatible" ||
    adapter === "gemini_business_compatible" ||
    adapter === "chataibot_compatible" ||
    adapter === "lumalabs_compatible" ||
    adapter === "gemini_canvas_compatible" ||
    adapter === "suno_compatible" ||
    adapter === "udio_compatible"
  );
}

function resolveGatewayProviderSourceAccessModeFromExecution(
  executionMode: GatewayExecutionMode,
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null,
): GatewayWebReverseAccessMode {
  const hasBrowserBackedEndpoint =
    executionMode === "browser_backed" ||
    Object.values(endpointExecutionModes ?? {}).some((mode) => mode === "browser_backed");
  return hasBrowserBackedEndpoint ? "browser_challenge" : "direct_http_replay";
}

function normalizeExplicitGatewayProviderSourceProfile(
  sourceProfile: GatewayProviderSourceProfile,
): Omit<GatewayProviderSourceView, "derived"> {
  const sourceKind = sourceProfile.sourceKind?.trim().toLowerCase() ?? "";
  if (!isGatewayProviderSourceKind(sourceKind)) {
    throw new ConflictError("provider sourceProfile.sourceKind 不合法。");
  }

  const aggregatorApiModeRaw = sourceProfile.aggregatorApiMode?.trim().toLowerCase() ?? null;
  const webReverseAccessModeRaw = sourceProfile.webReverseAccessMode?.trim().toLowerCase() ?? null;
  const aggregatorApiMode = aggregatorApiModeRaw && isGatewayAggregatorApiMode(aggregatorApiModeRaw)
    ? aggregatorApiModeRaw
    : null;
  const webReverseAccessMode = webReverseAccessModeRaw && isGatewayWebReverseAccessMode(webReverseAccessModeRaw)
    ? webReverseAccessModeRaw
    : null;

  if (aggregatorApiModeRaw && !aggregatorApiMode) {
    throw new ConflictError("provider sourceProfile.aggregatorApiMode 不合法。");
  }
  if (webReverseAccessModeRaw && !webReverseAccessMode) {
    throw new ConflictError("provider sourceProfile.webReverseAccessMode 不合法。");
  }
  if (sourceKind !== "aggregator_api" && aggregatorApiMode) {
    throw new ConflictError("只有 aggregator_api 允许设置 aggregatorApiMode。");
  }
  if (sourceKind !== "web_reverse_api" && webReverseAccessMode) {
    throw new ConflictError("只有 web_reverse_api 允许设置 webReverseAccessMode。");
  }

  return {
    sourceKind,
    aggregatorApiMode,
    webReverseAccessMode,
    notes: normalizeOptionalText(sourceProfile.notes, 500),
  };
}

function inferGatewayProviderSourceProfile(args: {
  adapter: GatewayProviderAccountView["adapter"] | string;
  payload: GatewayProviderAccountPayload;
  executionMode: GatewayExecutionMode;
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null;
}): NormalizedGatewayProviderSourceProfile {
  const hostname = readGatewayProviderHostname(args.payload);
  if (adapterBelongsToWebReverseSource(args.adapter)) {
    return {
      sourceKind: "web_reverse_api",
      aggregatorApiMode: null,
      webReverseAccessMode: resolveGatewayProviderSourceAccessModeFromExecution(
        args.executionMode,
        args.endpointExecutionModes,
      ),
      notes: `自动推导：${args.adapter}`,
      derived: true,
    };
  }

  if (args.adapter === "search_api_compatible" || args.adapter === "linkup_compatible") {
    return {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: "自动推导：search-style vendor api",
      derived: true,
    };
  }

  if (args.adapter === "kiro_compatible") {
    return {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: "自动推导：kiro session-backed vendor api",
      derived: true,
    };
  }

  if (args.adapter === "codex_cli" || args.adapter === "claude_code") {
    return {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: `自动推导：${args.adapter}`,
      derived: true,
    };
  }

  if (isKnownOfficialVendorHost(hostname)) {
    return {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: `自动推导：official host ${hostname}`,
      derived: true,
    };
  }

  if (isKnownHostedAggregatorHost(hostname)) {
    return {
      sourceKind: "aggregator_api",
      aggregatorApiMode: "hosted_compute",
      webReverseAccessMode: null,
      notes: `自动推导：hosted aggregator ${hostname}`,
      derived: true,
    };
  }

  return {
    sourceKind: "aggregator_api",
    aggregatorApiMode: null,
    webReverseAccessMode: null,
    notes: hostname ? `自动推导：compatible upstream ${hostname}` : "自动推导：generic compatible provider",
    derived: true,
  };
}

function resolveGatewayProviderSourceProfileForWrite(args: {
  sourceProfile?: GatewayProviderSourceProfile | null;
  adapter: GatewayProviderAccountView["adapter"] | string;
  payload: GatewayProviderAccountPayload;
  executionMode: GatewayExecutionMode;
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null;
}): Omit<GatewayProviderSourceView, "derived"> {
  if (args.sourceProfile?.sourceKind) {
    return normalizeExplicitGatewayProviderSourceProfile(args.sourceProfile);
  }

  const inferred = inferGatewayProviderSourceProfile(args);
  return {
    sourceKind: inferred.sourceKind,
    aggregatorApiMode: inferred.aggregatorApiMode,
    webReverseAccessMode: inferred.webReverseAccessMode,
    notes: inferred.notes,
  };
}

function resolveGatewayProviderSourceProfileForView(args: {
  row: GatewayProviderAccountRow;
  payload: GatewayProviderAccountPayload;
  executionMode: GatewayExecutionMode;
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null;
}): GatewayProviderSourceView {
  if (args.row.sourceKind) {
    return {
      ...normalizeExplicitGatewayProviderSourceProfile({
        sourceKind: args.row.sourceKind,
        aggregatorApiMode: args.row.aggregatorApiMode,
        webReverseAccessMode: args.row.webReverseAccessMode,
        notes: args.row.sourceNotes,
      }),
      derived: false,
    };
  }

  return inferGatewayProviderSourceProfile({
    adapter: args.row.adapter,
    payload: args.payload,
    executionMode: args.executionMode,
    endpointExecutionModes: args.endpointExecutionModes,
  });
}

function adapterSupportsBrowserBackedExecution(adapter: GatewayProviderAccountView["adapter"] | string) {
  return (
    adapter === "lumalabs_compatible" ||
    adapter === "gemini_canvas_compatible" ||
    adapter === "producer_compatible" ||
    adapter === "udio_compatible"
  );
}

function defaultExecutionModeForAdapter(adapter: GatewayProviderAccountView["adapter"] | string): GatewayExecutionMode {
  if (
    adapter === "lumalabs_compatible" ||
    adapter === "udio_compatible"
  ) {
    return "browser_backed";
  }
  return "direct_http";
}

function defaultEndpointExecutionModesForAdapter(
  adapter: GatewayProviderAccountView["adapter"] | string,
): GatewayEndpointExecutionModeMap | null {
  if (adapter === "producer_compatible") {
    return {
      videos_generations: "browser_backed",
    };
  }
  return null;
}

function normalizeGatewayExecutionMode(
  adapter: GatewayProviderAccountView["adapter"] | string,
  executionMode: GatewayExecutionMode | string | null | undefined,
) {
  const normalized = executionMode?.trim().toLowerCase();
  if (normalized === "direct_http" || normalized === "browser_backed") {
    if (normalized === "browser_backed" && !adapterSupportsBrowserBackedExecution(adapter)) {
      throw new ConflictError(`${adapter} 当前不支持 executionMode=browser_backed。`);
    }
    return normalized as GatewayExecutionMode;
  }
  return defaultExecutionModeForAdapter(adapter);
}

function normalizeEndpointExecutionModes(
  adapter: GatewayProviderAccountView["adapter"] | string,
  endpointExecutionModes: GatewayEndpointExecutionModeMap | Record<string, GatewayExecutionMode | string | null> | null | undefined,
) {
  const normalizedEntries = Object.entries(endpointExecutionModes ?? {})
    .map(([endpointKind, mode]) => {
      const normalizedEndpointKind = endpointKind.trim().toLowerCase();
      if (!normalizedEndpointKind) {
        return null;
      }
      const normalizedMode = normalizeGatewayExecutionMode(adapter, mode);
      return [normalizedEndpointKind, normalizedMode] as const;
    })
    .filter((entry): entry is readonly [string, GatewayExecutionMode] => entry !== null);

  const defaults = Object.entries(defaultEndpointExecutionModesForAdapter(adapter) ?? {});
  for (const [endpointKind, mode] of defaults) {
    if (!normalizedEntries.some(([existingEndpointKind]) => existingEndpointKind === endpointKind)) {
      normalizedEntries.push([endpointKind, mode]);
    }
  }

  if (normalizedEntries.length === 0) {
    return null;
  }

  return Object.fromEntries(normalizedEntries) as GatewayEndpointExecutionModeMap;
}

function resolveProviderExecutionMode(
  executionMode: GatewayExecutionMode | string | null | undefined,
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null | undefined,
  endpointKind: GatewayRelayEndpointKind | string,
) {
  const endpointKey = endpointKind.trim().toLowerCase();
  const override = endpointExecutionModes?.[endpointKey as keyof GatewayEndpointExecutionModeMap];
  if (override === "direct_http" || override === "browser_backed") {
    return override;
  }
  if (executionMode === "direct_http" || executionMode === "browser_backed") {
    return executionMode;
  }
  return "direct_http" as GatewayExecutionMode;
}

function validateSessionBackedProviderRuntime(payload: GatewaySessionBackedProviderRuntime) {
  if (payload.sessionAuth) {
    const transport = normalizeSessionAuthTransport(payload.sessionAuth.transport);
    if (payload.sessionAuth.expiresAt) {
      parseFilterTimestamp(payload.sessionAuth.expiresAt, "sessionAuth.expiresAt");
    }
    if (transport === "header" && !payload.sessionAuth.headerName?.trim()) {
      throw new ConflictError("sessionAuth.transport=header 时必须提供 headerName。");
    }
  }

  if (payload.keepalive) {
    if (!payload.keepalive.serviceUrl?.trim()) {
      throw new ConflictError("keepalive.serviceUrl 不能为空。");
    }
    if (
      payload.keepalive.timeoutSecs != null &&
      (!Number.isFinite(payload.keepalive.timeoutSecs) || payload.keepalive.timeoutSecs <= 0)
    ) {
      throw new ConflictError("keepalive.timeoutSecs 必须是正整数。");
    }
    if (
      payload.keepalive.refreshBeforeSecs != null &&
      (!Number.isFinite(payload.keepalive.refreshBeforeSecs) || payload.keepalive.refreshBeforeSecs <= 0)
    ) {
      throw new ConflictError("keepalive.refreshBeforeSecs 必须是正整数。");
    }
  }
}

function normalizeOpenAiCompatibleApiKeyPool(payload: GatewayOpenAiCompatibleProviderPayload) {
  const values = [payload.apiKey, ...(payload.apiKeys ?? [])]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function validateGatewayProviderPayload(input: UpsertGatewayProviderAccountInput) {
  const payload = input.payload;
  const protocolFamily = normalizeGatewayProtocolFamily(input.protocolFamily);
  const protocolProfile = normalizeGatewayProtocolProfile(input.protocolProfile);
  if (payload.adapter !== input.adapter) {
    throw new ConflictError("payload.adapter 必须与 provider account adapter 一致。");
  }

  const executionMode = normalizeGatewayExecutionMode(input.adapter, input.executionMode);
  const endpointExecutionModes = normalizeEndpointExecutionModes(input.adapter, input.endpointExecutionModes);
  const sourceProfile = resolveGatewayProviderSourceProfileForWrite({
    sourceProfile: input.sourceProfile,
    adapter: input.adapter,
    payload,
    executionMode,
    endpointExecutionModes,
  });
  if (executionMode === "browser_backed" && !adapterSupportsBrowserBackedExecution(input.adapter)) {
    throw new ConflictError(`${input.adapter} 当前不支持 executionMode=browser_backed。`);
  }
  if (
    endpointExecutionModes &&
    Object.values(endpointExecutionModes).some((mode) => mode === "browser_backed") &&
    !adapterSupportsBrowserBackedExecution(input.adapter)
  ) {
    throw new ConflictError(`${input.adapter} 当前不支持 endpointExecutionModes.*=browser_backed。`);
  }

  if (
    payload.adapter === "openai_compatible" ||
    payload.adapter === "anthropic_compatible" ||
    payload.adapter === "grok_compatible" ||
    payload.adapter === "kiro_compatible" ||
    isGatewaySearchProviderPayload(payload) ||
    payload.adapter === "gemini_business_compatible" ||
    payload.adapter === "chataibot_compatible" ||
    payload.adapter === "lumalabs_compatible" ||
    payload.adapter === "gemini_canvas_compatible" ||
    payload.adapter === "producer_compatible" ||
    payload.adapter === "suno_compatible" ||
    payload.adapter === "udio_compatible" ||
    payload.adapter === "custom_http" ||
    payload.adapter === "provider_passthrough"
  ) {
    validateSessionBackedProviderRuntime(payload);
  }

  if (payload.adapter === "openai_compatible") {
    const apiKeyPool = normalizeOpenAiCompatibleApiKeyPool(payload);
    if (apiKeyPool.length === 0) {
      throw new ConflictError("openai_compatible provider 至少需要一个 apiKey。");
    }
    if (
      payload.keySelectionStrategy != null &&
      payload.keySelectionStrategy !== "round-robin" &&
      payload.keySelectionStrategy !== "random"
    ) {
      throw new ConflictError("openai_compatible provider keySelectionStrategy 不合法。");
    }
  }

  if (payload.adapter === "grok_compatible" && !isGatewayOpenAiProtocolFamily(protocolFamily)) {
    throw new ConflictError("grok_compatible 当前必须归属 openai family。");
  }

  if (payload.adapter === "kiro_compatible" && protocolFamily !== "kiro") {
    throw new ConflictError("kiro_compatible 当前必须归属 kiro protocol family。");
  }

  if (isGatewaySearchProviderPayload(payload) && !isGatewaySearchProtocolFamily(protocolFamily)) {
    throw new ConflictError("search_api_compatible 当前必须归属 search family。");
  }

  if (payload.adapter === "gemini_business_compatible" && !isGatewayGeminiBusinessProtocolFamily(protocolFamily)) {
    throw new ConflictError("gemini_business_compatible 当前必须归属 gemini_business image family。");
  }

  if (payload.adapter === "chataibot_compatible" && !isGatewayChataibotProtocolFamily(protocolFamily)) {
    throw new ConflictError("chataibot_compatible 当前必须归属 chataibot image family。");
  }

  if (payload.adapter === "lumalabs_compatible" && !isGatewayLumalabsProtocolFamily(protocolFamily)) {
    throw new ConflictError("lumalabs_compatible 当前必须归属 lumalabs image family。");
  }

  if (payload.adapter === "gemini_canvas_compatible" && !isGatewayGeminiCanvasProtocolFamily(protocolFamily)) {
    throw new ConflictError("gemini_canvas_compatible 当前必须归属 gemini_canvas media family。");
  }

  if (payload.adapter === "producer_compatible" && !isGatewayProducerProtocolFamily(protocolFamily)) {
    throw new ConflictError("producer_compatible 当前必须归属 producer protocol family。");
  }

  if (payload.adapter === "suno_compatible" && !isGatewaySunoProtocolFamily(protocolFamily)) {
    throw new ConflictError("suno_compatible 当前必须归属 suno music family。");
  }

  if (payload.adapter === "udio_compatible" && !isGatewayUdioProtocolFamily(protocolFamily)) {
    throw new ConflictError("udio_compatible 当前必须归属 udio protocol family。");
  }

  if (payload.adapter === "anthropic_compatible" && !isGatewayAnthropicProtocolFamily(protocolFamily)) {
    throw new ConflictError("anthropic_compatible 当前必须归属 anthropic family。");
  }

  if (payload.adapter === "gemini_api_compatible" && !isGatewayGeminiProtocolFamily(protocolFamily)) {
    throw new ConflictError("gemini_api_compatible 当前必须归属 gemini family。");
  }

  if (payload.adapter === "bedrock_converse_compatible" && !isGatewayBedrockProtocolFamily(protocolFamily)) {
    throw new ConflictError("bedrock_converse_compatible 当前必须归属 bedrock family。");
  }

  if (payload.adapter === "cohere_compatible" && !isGatewayCohereProtocolFamily(protocolFamily)) {
    throw new ConflictError("cohere_compatible 当前必须归属 cohere family。");
  }

  void executionMode;
  void protocolProfile;
  void sourceProfile;
}

function toGatewayTenantView(row: GatewayTenantRow): GatewayTenantView {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    status: row.status as GatewayTenantView["status"],
    ownerUserId: row.ownerUserId,
    sourceKind: row.sourceKind as GatewayTenantView["sourceKind"],
    sourceKey: row.sourceKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toGatewayProjectView(row: GatewayProjectRow): GatewayProjectView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    displayName: row.displayName,
    status: row.status as GatewayProjectView["status"],
    sourceKind: row.sourceKind as GatewayProjectView["sourceKind"],
    sourceKey: row.sourceKey,
    defaultRoutePolicyId: row.defaultRoutePolicyId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toGatewayApiKeyView(row: GatewayApiKeyRow): GatewayApiKeyView {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    status: row.status as GatewayApiKeyView["status"],
    issuedAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    rotatedFromApiKeyId: row.rotatedFromApiKeyId,
  };
}

async function readProviderAccountPayload(row: GatewayProviderAccountRow) {
  // Fast path: check Redis cache first
  const cached = await getCachedProviderPayload(row.id).catch(() => null);
  if (cached) {
    return cached;
  }

  // Cache miss: read from DB inline or object storage
  let payload: GatewayProviderAccountPayload;
  if (row.payloadInline && typeof row.payloadInline === "object") {
    payload = row.payloadInline as GatewayProviderAccountPayload;
  } else if (row.payloadObjectKey) {
    const buffer = await readGatewayObject(row.payloadObjectKey);
    payload = JSON.parse(buffer.toString("utf8")) as GatewayProviderAccountPayload;
  } else {
    throw new ConflictError("Provider account payload 缺失。");
  }

  // Populate cache for next time (fire-and-forget)
  setCachedProviderPayload(row.id, payload).catch(() => undefined);

  return payload;
}

async function toGatewayProviderAccountView(
  row: GatewayProviderAccountRow,
  options?: { maskSecrets?: boolean },
): Promise<GatewayProviderAccountView> {
  const payload = await readProviderAccountPayload(row);
  const executionMode = normalizeGatewayExecutionMode(row.adapter, row.executionMode);
  const endpointExecutionModes = normalizeEndpointExecutionModes(
    row.adapter,
    (row.endpointExecutionModes as GatewayEndpointExecutionModeMap | null | undefined) ?? null,
  );
  return {
    id: row.id,
    label: row.label,
    serviceProviderKey: row.serviceProviderKey,
    serviceProviderLabel: row.serviceProviderLabel,
    adapter: row.adapter as GatewayProviderAccountView["adapter"],
    status: row.status as GatewayProviderAccountView["status"],
    protocolFamily: row.protocolFamily as GatewayProviderAccountView["protocolFamily"],
    protocolProfile: row.protocolProfile as GatewayProviderAccountView["protocolProfile"],
    sourceProfile: resolveGatewayProviderSourceProfileForView({
      row,
      payload,
      executionMode,
      endpointExecutionModes,
    }),
    executionMode,
    endpointExecutionModes,
    payload: options?.maskSecrets ? maskGatewayProviderPayload(payload) : payload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cooldownUntil: row.cooldownUntil ? row.cooldownUntil.toISOString() : null,
    lastError: row.lastError,
    failureCount: row.failureCount,
  };
}

function toGatewayModelAliasView(row: typeof gatewayModelAliases.$inferSelect): GatewayModelAliasView {
  return {
    id: row.id,
    projectId: row.projectId,
    scopeType: normalizeGatewayModelAliasScopeType(row.scopeType),
    alias: row.alias,
    providerAccountId: row.providerAccountId,
    upstreamModel: row.upstreamModel,
    priority: row.priority,
    weight: row.weight,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeGatewayModelAliasScopeType(
  value: string | null | undefined,
): GatewayModelAliasScopeType {
  return value === "provider_special" ? "provider_special" : "global";
}

function toGatewayRoutePolicyView(row: GatewayRoutePolicyRow): GatewayRoutePolicyView {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    isDefault: row.isDefault,
    enabled: row.enabled,
    config: row.config,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toGatewaySessionView(row: GatewaySessionRow): GatewaySessionView {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionKey: row.sessionKey,
    protocolFamily: row.protocolFamily as GatewayProtocolFamily,
    providerAccountId: row.providerAccountId,
    latestResponseId: row.latestResponseId,
    upstreamSessionId: row.upstreamSessionId,
    runtimeStateObjectKey: row.runtimeStateObjectKey,
    activeRequestAuditId: row.activeRequestAuditId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

function toGatewayRequestAuditView(row: typeof gatewayRequestAudits.$inferSelect): GatewayRequestAuditView {
  return {
    id: row.id,
    projectId: row.projectId,
    accessKeyId: row.accessKeyId,
    sourceAccessKeyId: row.sourceAccessKeyId,
    apiKeyId: row.apiKeyId,
    userCredentialId: row.userCredentialId,
    sessionId: row.sessionId,
    routePolicyId: row.routePolicyId,
    providerAccountId: row.providerAccountId,
    protocolFamily: row.protocolFamily as GatewayProtocolFamily,
    endpointKind: row.endpointKind,
    requestedModel: row.requestedModel,
    resolvedModel: row.resolvedModel,
    modelAlias: row.modelAlias,
    stream: row.stream,
    status: row.status as GatewayRequestStatus,
    upstreamStatus: row.upstreamStatus,
    durationMs: row.durationMs,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    cacheCreationInputTokens: row.cacheCreationInputTokens,
    cacheReadInputTokens: row.cacheReadInputTokens,
    clientHasCacheControl: row.clientHasCacheControl,
    autoCacheApplied: row.autoCacheApplied,
    errorSummary: row.errorSummary,
    routeTrace: row.routeTrace ?? null,
    analysisProfile: row.analysisProfile ?? null,
    requestArtifactObjectKey: row.requestArtifactObjectKey,
    responseArtifactObjectKey: row.responseArtifactObjectKey,
    responseId: row.responseId,
    previousResponseId: row.previousResponseId,
    clientDisconnectedAt: row.clientDisconnectedAt ? row.clientDisconnectedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertPlatformOperator(userId: string, providerUserId?: string | null) {
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

async function getGatewayProjectById(projectId: string) {
  const [row] = await db.select().from(gatewayProjects).where(eq(gatewayProjects.id, projectId)).limit(1);
  return row ?? null;
}

async function getDefaultRoutePolicyForProject(projectId: string) {
  const [row] = await db
    .select()
    .from(gatewayRoutePolicies)
    .where(
      and(
        eq(gatewayRoutePolicies.projectId, projectId),
        eq(gatewayRoutePolicies.isDefault, true),
        eq(gatewayRoutePolicies.enabled, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function reactivateExpiredCoolingProviderAccounts() {
  const timestamp = now();
  const rows = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(
      and(
        eq(gatewayProviderAccounts.status, "cooling"),
        lte(gatewayProviderAccounts.cooldownUntil, timestamp),
      ),
    )
    .orderBy(asc(gatewayProviderAccounts.cooldownUntil))
    .limit(50);

  for (const row of rows) {
    await withProviderProbeLock(row.id, async () => {
      const [fresh] = await db
        .select()
        .from(gatewayProviderAccounts)
        .where(eq(gatewayProviderAccounts.id, row.id))
        .limit(1);
      if (!fresh || fresh.status !== "cooling") {
        return;
      }
      if (fresh.cooldownUntil && fresh.cooldownUntil > now()) {
        return;
      }

      try {
        await probeGatewayProviderAccount(fresh);
        await db
          .update(gatewayProviderAccounts)
          .set({
            status: "active",
            cooldownUntil: null,
            lastError: null,
            lastHealthCheckAt: now(),
            updatedAt: now(),
          })
          .where(eq(gatewayProviderAccounts.id, fresh.id));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db
          .update(gatewayProviderAccounts)
          .set({
            cooldownUntil: new Date(Date.now() + 30_000),
            lastError: truncateErrorSummary(message, 1000),
            lastHealthCheckAt: now(),
            updatedAt: now(),
          })
          .where(eq(gatewayProviderAccounts.id, fresh.id));
      }
    });
  }
}

export async function sweepGatewayCoolingProviders() {
  await reactivateExpiredCoolingProviderAccounts();
}

function providerAllowedByRoutePolicy(
  providerAccount: GatewayProviderAccountRow,
  routePolicy: GatewayRoutePolicyConfig | null | undefined,
) {
  const allowedProviderIds = normalizeStringList(routePolicy?.allowedProviderAccountIds ?? null);
  if (allowedProviderIds && !allowedProviderIds.includes(providerAccount.id)) {
    return false;
  }

  const allowedProtocolFamilies = normalizeStringList(routePolicy?.allowedProtocolFamilies ?? null);
  if (allowedProtocolFamilies && !allowedProtocolFamilies.includes(providerAccount.protocolFamily)) {
    return false;
  }

  return true;
}

function buildGatewayProviderModelsCacheKey(providerAccountId: string) {
  return `ai-gateway:provider:${providerAccountId}:models`;
}

function buildGatewayProviderProbeLockKey(providerAccountId: string) {
  return `ai-gateway:provider:${providerAccountId}:probe-lock`;
}

function applySessionBackedHeaders(headers: Headers, payload: GatewaySessionBackedProviderRuntime & { apiKey: string }) {
  const sessionAuth = payload.sessionAuth;
  const transport = normalizeSessionAuthTransport(sessionAuth?.transport);
  if (transport === "cookie") {
    const primary = sessionAuth?.primaryCookieName?.trim() || "sso";
    const secondary = sessionAuth?.secondaryCookieName?.trim() || "sso-rw";
    const cookies = [`${primary}=${payload.apiKey}`];
    if (secondary) {
      cookies.push(`${secondary}=${payload.apiKey}`);
    }
    headers.set("cookie", cookies.join("; "));
    return;
  }

  const headerName =
    sessionAuth?.headerName?.trim() || (transport === "bearer" ? "authorization" : "x-session-token");
  const headerValue = transport === "bearer" ? `Bearer ${payload.apiKey}` : payload.apiKey;
  headers.set(headerName, headerValue);
}

function buildGatewayProviderHeaders(payload: GatewayProviderAccountPayload) {
  const headers = new Headers();
  if (payload.adapter === "openai_compatible") {
    if (payload.authMode === "x-api-key") {
      headers.set("x-api-key", payload.apiKey);
    } else if (payload.authMode === "api-key") {
      headers.set("api-key", payload.apiKey);
    } else {
      headers.set("authorization", `Bearer ${payload.apiKey}`);
    }
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (payload.adapter === "anthropic_compatible") {
    headers.set("x-api-key", payload.apiKey);
    headers.set("anthropic-version", payload.anthropicVersion?.trim() || "2023-06-01");
    for (const beta of payload.betaHeaders ?? []) {
      if (typeof beta === "string" && beta.trim()) {
        headers.append("anthropic-beta", beta.trim());
      }
    }
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (payload.adapter === "grok_compatible") {
    applySessionBackedHeaders(headers, payload);
    headers.set("x-xai-request-id", randomUUID());
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (isGatewaySearchProviderPayload(payload)) {
    const authHeaderName = payload.authHeaderName?.trim();
    const authToken = payload.authToken?.trim();
    if (authHeaderName && authToken) {
      headers.set(authHeaderName, authToken);
    } else if (authHeaderName) {
      headers.set(authHeaderName, payload.apiKey);
    } else {
      headers.set("authorization", `Bearer ${payload.apiKey}`);
    }
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (payload.adapter === "producer_compatible") {
    headers.set("authorization", `Bearer ${payload.apiKey}`);
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  if (payload.adapter === "udio_compatible") {
    applySessionBackedHeaders(headers, payload);
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }
    return headers;
  }
  return null;
}

async function readCachedProviderModels(providerAccountId: string) {
  try {
    const raw = await redis.get(buildGatewayProviderModelsCacheKey(providerAccountId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  } catch {
    return null;
  }
}

async function writeCachedProviderModels(providerAccountId: string, modelIds: string[]) {
  try {
    await redis.set(
      buildGatewayProviderModelsCacheKey(providerAccountId),
      JSON.stringify(modelIds),
      "EX",
      Math.max(10, env.modelsCacheTtlSeconds),
    );
  } catch {
    return;
  }
}

async function invalidateCachedProviderModels(providerAccountId: string) {
  try {
    await redis.del(buildGatewayProviderModelsCacheKey(providerAccountId));
  } catch {
    return;
  }
}

function parseGatewayProviderModelsResponse(payload: GatewayProviderAccountPayload, body: Record<string, unknown>) {
  const collected = new Set<string>();
  const records = [
    ...(Array.isArray(body.data) ? body.data : []),
    ...(Array.isArray(body.models) ? body.models : []),
  ];

  for (const item of records) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id =
      (typeof record.id === "string" && record.id.trim() ? record.id.trim() : null) ??
      (typeof record.name === "string" && record.name.trim() ? record.name.trim() : null) ??
      (typeof record.model === "string" && record.model.trim() ? record.model.trim() : null);
    if (id) {
      collected.add(id);
    }
  }

  if (payload.adapter === "anthropic_compatible" && collected.size === 0) {
    const topLevelId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
    if (topLevelId) {
      collected.add(topLevelId);
    }
  }

  return Array.from(collected.values());
}

async function discoverProviderModels(row: GatewayProviderAccountRow) {
  const payload = await readProviderAccountPayload(row);
  const cached = await readCachedProviderModels(row.id);
  if (cached && cached.length > 0) {
    return cached;
  }

  if (payload.adapter !== "openai_compatible" && payload.adapter !== "anthropic_compatible") {
    const defaultModel =
      "defaultModel" in payload && typeof payload.defaultModel === "string" ? payload.defaultModel.trim() : "";
    return defaultModel ? [defaultModel] : [];
  }

  const endpointPath =
    payload.adapter === "openai_compatible"
      ? payload.modelsPath?.trim() || "/models"
      : payload.modelsPath?.trim() || "/models";
  const { response, text } = await requestGatewayProviderText(
    `${payload.baseUrl.replace(/\/+$/, "")}${endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`}`,
    {
      method: "GET",
      headers: buildGatewayProviderHeaders(payload) ?? undefined,
    },
    "Provider models discovery",
  );

  if (!response.ok) {
    await invalidateCachedProviderModels(row.id);
    throw new ConflictError(`Provider models discovery failed with status ${response.status}.`);
  }

  const body = JSON.parse(text) as Record<string, unknown>;
  const modelIds = parseGatewayProviderModelsResponse(payload, body);
  if (modelIds.length > 0) {
    await writeCachedProviderModels(row.id, modelIds);
  } else {
    await invalidateCachedProviderModels(row.id);
  }
  await db
    .update(gatewayProviderAccounts)
    .set({
      lastHealthCheckAt: now(),
      updatedAt: now(),
    })
    .where(eq(gatewayProviderAccounts.id, row.id));
  return modelIds;
}

async function probeGatewayProviderAccount(row: GatewayProviderAccountRow) {
  const payload = await readProviderAccountPayload(row);

  if (payload.adapter === "openai_compatible" || payload.adapter === "anthropic_compatible") {
    await discoverProviderModels(row);
    return;
  }

  if (payload.adapter === "codex_cli") {
    await readGatewayObject(payload.codexHomeBundleObjectKey);
    return;
  }

  if (payload.adapter === "claude_code") {
    await readGatewayObject(payload.claudeHomeBundleObjectKey);
    return;
  }

  if (payload.adapter === "grok_compatible") {
    const { response } = await requestGatewayProviderText(
      payload.baseUrl.replace(/\/+$/, ""),
      {
        method: "GET",
        headers: buildGatewayProviderHeaders(payload) ?? undefined,
      },
      "Provider probe",
    );
    if (response.status >= 500) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
    return;
  }

  if (payload.adapter === "kiro_compatible") {
    return;
  }

  if (isGatewaySearchProviderPayload(payload)) {
    const balancePath =
      "balancePath" in payload && typeof payload.balancePath === "string" && payload.balancePath.trim()
        ? payload.balancePath.trim()
        : "/v1/credits/balance";
    const { response } = await requestGatewayProviderText(
      `${payload.baseUrl.replace(/\/+$/, "")}${balancePath.startsWith("/") ? balancePath : `/${balancePath}`}`,
      {
        method: "GET",
        headers: buildGatewayProviderHeaders(payload) ?? undefined,
      },
      "Provider probe",
    );
    if (!response.ok) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
    return;
  }

  if (payload.adapter === "producer_compatible") {
    const { response } = await requestGatewayProviderText(
      `${payload.baseUrl.replace(/\/+$/, "")}/__api/billing/credits`,
      {
        method: "GET",
        headers: buildGatewayProviderHeaders(payload) ?? undefined,
      },
      "Provider probe",
    );
    if (!response.ok) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
    return;
  }

  if (payload.adapter === "udio_compatible") {
    const { response } = await requestGatewayProviderText(
      `${payload.baseUrl.replace(/\/+$/, "")}/api/users/current`,
      {
        method: "GET",
        headers: buildGatewayProviderHeaders(payload) ?? undefined,
      },
      "Provider probe",
    );
    if (!response.ok) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
    return;
  }

  if (payload.adapter === "custom_http" || payload.adapter === "provider_passthrough") {
    const headers = new Headers();
    if (payload.authHeaderName?.trim() && payload.authToken?.trim()) {
      headers.set(payload.authHeaderName.trim(), payload.authToken.trim());
    }
    for (const [key, value] of Object.entries(payload.headers ?? {})) {
      if (typeof value === "string" && value.trim()) {
        headers.set(key, value.trim());
      }
    }

    const providerUrl = payload.baseUrl.replace(/\/+$/, "");
    const { response } = await requestGatewayProviderText(
      providerUrl,
      {
        method: "HEAD",
        headers,
      },
      "Provider HEAD probe",
    ).catch(() =>
      requestGatewayProviderText(
        providerUrl,
        {
          method: "GET",
          headers,
        },
        "Provider GET probe",
      ),
    );

    if (response.status >= 500) {
      throw new ConflictError(`Provider probe failed with status ${response.status}.`);
    }
  }
}

async function withProviderProbeLock<T>(providerAccountId: string, callback: () => Promise<T>): Promise<T | null> {
  const lockKey = buildGatewayProviderProbeLockKey(providerAccountId);
  const token = randomUUID();
  const acquired = await redis.set(lockKey, token, "PX", 15_000, "NX");
  if (acquired !== "OK") {
    return null;
  }
  try {
    return await callback();
  } finally {
    const current = await redis.get(lockKey);
    if (current === token) {
      await redis.del(lockKey);
    }
  }
}

function buildGatewayProviderConcurrencyKey(providerAccountId: string) {
  return `ai-gateway:provider:${providerAccountId}:concurrency`;
}

function buildGatewayProviderBreakerOpenKey(providerAccountId: string) {
  return `ai-gateway:provider:${providerAccountId}:breaker-open`;
}

function buildGatewayProjectConcurrencyKey(projectId: string) {
  return `ai-gateway:project:${projectId}:concurrency`;
}

async function readRedisInt(key: string) {
  try {
    const raw = await redis.get(key);
    return typeof raw === "string" && Number.isFinite(Number(raw)) ? Math.max(0, Math.floor(Number(raw))) : 0;
  } catch {
    return 0;
  }
}

async function getOrCreateDefaultRoutePolicyInTx(tx: any, projectId: string, timestamp: Date) {
  const [existing] = await tx
    .select()
    .from(gatewayRoutePolicies)
    .where(and(eq(gatewayRoutePolicies.projectId, projectId), eq(gatewayRoutePolicies.isDefault, true)))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await tx
    .insert(gatewayRoutePolicies)
    .values({
      id: randomUUID(),
      projectId,
      name: "default",
      isDefault: true,
      enabled: true,
      config: defaultRoutePolicyConfig(),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  await tx
    .update(gatewayProjects)
    .set({
      defaultRoutePolicyId: created.id,
      updatedAt: timestamp,
    })
    .where(eq(gatewayProjects.id, projectId));

  return created;
}

async function getActiveGatewayApiKeyInTx(tx: any, projectId: string) {
  const [row] = await tx
    .select()
    .from(gatewayApiKeys)
    .where(and(eq(gatewayApiKeys.projectId, projectId), eq(gatewayApiKeys.status, "active")))
    .orderBy(desc(gatewayApiKeys.createdAt), desc(gatewayApiKeys.id))
    .limit(1);
  return row ?? null;
}

async function createGatewayApiKeyInTx(
  tx: any,
  args: {
    projectId: string;
    name: string;
    rotatedFromApiKeyId?: string | null;
    timestamp: Date;
  },
) {
  const [created] = await tx
    .insert(gatewayApiKeys)
    .values({
      id: randomUUID(),
      projectId: args.projectId,
      name: args.name,
      status: "active",
      rotatedFromApiKeyId: args.rotatedFromApiKeyId ?? null,
      revokedAt: null,
      revokedByUserId: null,
      revokeReason: null,
      createdAt: args.timestamp,
      updatedAt: args.timestamp,
    })
    .returning();
  return created;
}

async function revokeGatewayApiKeyInTx(
  tx: any,
  row: GatewayApiKeyRow,
  actorUserId: string | null,
  reason: string,
  timestamp: Date,
) {
  const [updated] = await tx
    .update(gatewayApiKeys)
    .set({
      status: "revoked",
      revokedAt: timestamp,
      revokedByUserId: actorUserId,
      revokeReason: reason,
      updatedAt: timestamp,
    })
    .where(eq(gatewayApiKeys.id, row.id))
    .returning();
  return updated ?? row;
}

export async function ensureGatewayBenefitProject(args: {
  serviceId: string;
  userId: string;
  serviceTitle?: string | null;
}) {
  return db.transaction(async (tx) => {
    const timestamp = now();
    const tenantSourceKey = buildBenefitTenantSourceKey(args.userId);
    const [existingTenant] = await tx
      .select()
      .from(gatewayTenants)
      .where(and(eq(gatewayTenants.sourceKind, "benefit_user"), eq(gatewayTenants.sourceKey, tenantSourceKey)))
      .limit(1);

    const tenant =
      existingTenant ??
      (
        await tx
          .insert(gatewayTenants)
          .values({
            id: randomUUID(),
            slug: slugify(`benefit-${args.userId}`),
            displayName: `Benefit ${args.userId}`,
            status: "active",
            ownerUserId: args.userId,
            sourceKind: "benefit_user",
            sourceKey: tenantSourceKey,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning()
      )[0];

    const projectSourceKey = buildBenefitProjectSourceKey(args.serviceId, args.userId);
    const [existingProject] = await tx
      .select()
      .from(gatewayProjects)
      .where(and(eq(gatewayProjects.sourceKind, "benefit_service_user"), eq(gatewayProjects.sourceKey, projectSourceKey)))
      .limit(1);

    const project =
      existingProject ??
      (
        await tx
          .insert(gatewayProjects)
          .values({
            id: randomUUID(),
            tenantId: tenant.id,
            slug: slugify(`${args.serviceTitle || args.serviceId}-${args.userId}`),
            displayName: args.serviceTitle?.trim() || `Benefit Service ${args.serviceId}`,
            status: "active",
            sourceKind: "benefit_service_user",
            sourceKey: projectSourceKey,
            defaultRoutePolicyId: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning()
      )[0];

    const routePolicy = await getOrCreateDefaultRoutePolicyInTx(tx, project.id, timestamp);

    return {
      tenant: toGatewayTenantView(tenant),
      project: toGatewayProjectView({
        ...project,
        defaultRoutePolicyId: project.defaultRoutePolicyId ?? routePolicy.id,
      }),
      routePolicy: toGatewayRoutePolicyView(routePolicy),
    };
  });
}

export async function resolveGatewayApiAccessForProject(projectId: string, name = "benefit-project-key") {
  const project = await getGatewayProjectById(projectId);
  if (!project || project.status !== "active") {
    throw new NotFoundError("AI gateway project 不存在。");
  }
  const [tenant] = await db.select().from(gatewayTenants).where(eq(gatewayTenants.id, project.tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") {
    throw new NotFoundError("AI gateway tenant 不存在。");
  }

  return db.transaction(async (tx) => {
    let apiKey = await getActiveGatewayApiKeyInTx(tx, projectId);
    if (!apiKey) {
      apiKey = await createGatewayApiKeyInTx(tx, {
        projectId,
        name,
        timestamp: now(),
      });
    }

    return {
      project: toGatewayProjectView(project),
      tenant: toGatewayTenantView(tenant),
      apiKey: toGatewayApiKeyView(apiKey),
      token: buildGatewayProjectApiKey({
        apiKeyId: apiKey.id,
        projectId: project.id,
        tenantId: tenant.id,
      }),
    };
  });
}

export async function rotateGatewayApiAccessForProject(
  projectId: string,
  actorUserId: string | null,
  name = "benefit-project-key",
) {
  const project = await getGatewayProjectById(projectId);
  if (!project || project.status !== "active") {
    throw new NotFoundError("AI gateway project 不存在。");
  }
  const [tenant] = await db.select().from(gatewayTenants).where(eq(gatewayTenants.id, project.tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") {
    throw new NotFoundError("AI gateway tenant 不存在。");
  }

  return db.transaction(async (tx) => {
    const timestamp = now();
    const current = await getActiveGatewayApiKeyInTx(tx, projectId);
    if (current) {
      await revokeGatewayApiKeyInTx(tx, current, actorUserId, "rotated", timestamp);
    }
    const next = await createGatewayApiKeyInTx(tx, {
      projectId,
      name,
      rotatedFromApiKeyId: current?.id ?? null,
      timestamp,
    });
    return {
      project: toGatewayProjectView(project),
      tenant: toGatewayTenantView(tenant),
      apiKey: toGatewayApiKeyView(next),
      token: buildGatewayProjectApiKey({
        apiKeyId: next.id,
        projectId: project.id,
        tenantId: tenant.id,
      }),
    };
  });
}

export async function authenticateGatewayAccessToken(rawToken: string): Promise<AuthenticatedGatewayAccess | null> {
  const token = rawToken?.trim();
  if (!token?.startsWith("new_api_")) {
    return null;
  }

  const encodedPart = token.slice("new_api_".length).split(".")[0];
  let apiKeyId: string | null = null;
  try {
    apiKeyId = encodedPart ? Buffer.from(encodedPart, "base64url").toString("utf8").trim() : null;
  } catch {
    apiKeyId = null;
  }

  if (!apiKeyId) {
    return null;
  }

  const [apiKey] = await db.select().from(gatewayApiKeys).where(eq(gatewayApiKeys.id, apiKeyId)).limit(1);
  if (!apiKey || apiKey.status !== "active") {
    return null;
  }

  const [project] = await db.select().from(gatewayProjects).where(eq(gatewayProjects.id, apiKey.projectId)).limit(1);
  if (!project || project.status !== "active") {
    return null;
  }

  const [tenant] = await db.select().from(gatewayTenants).where(eq(gatewayTenants.id, project.tenantId)).limit(1);
  if (!tenant || tenant.status !== "active") {
    return null;
  }

  if (
    !verifyGatewayProjectApiKey(token, {
      apiKeyId: apiKey.id,
      projectId: project.id,
      tenantId: tenant.id,
    })
  ) {
    return null;
  }

  return {
    apiKey,
    project,
    tenant,
  };
}

export async function listGatewayModelsForProject(projectId: string) {
  await reactivateExpiredCoolingProviderAccounts();
  const project = await getGatewayProjectById(projectId);
  const routePolicy =
    (project?.defaultRoutePolicyId
      ? await db
          .select()
          .from(gatewayRoutePolicies)
          .where(eq(gatewayRoutePolicies.id, project.defaultRoutePolicyId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null) ?? (project ? await getDefaultRoutePolicyForProject(project.id) : null);
  const aliasRows = await db
    .select()
    .from(gatewayModelAliases)
    .where(or(eq(gatewayModelAliases.projectId, projectId), isNull(gatewayModelAliases.projectId)))
    .orderBy(asc(gatewayModelAliases.alias), asc(gatewayModelAliases.priority), desc(gatewayModelAliases.weight));

  const modelIds = new Set<string>();
  for (const row of aliasRows) {
    if (row.enabled && routePolicyAllowsModels(routePolicy?.config ?? null, [row.alias, row.upstreamModel])) {
      modelIds.add(row.alias);
    }
  }

  if (modelIds.size === 0) {
    const providerRows = await db
      .select()
      .from(gatewayProviderAccounts)
      .where(eq(gatewayProviderAccounts.status, "active"))
      .orderBy(asc(gatewayProviderAccounts.label));
    const allowedProviderRows = providerRows.filter((row) =>
      providerAllowedByRoutePolicy(row, routePolicy?.config ?? null),
    );
    const providerModelIds = await discoverGatewayProviderModelIds({
      providers: allowedProviderRows,
      discover: discoverProviderModels,
      async fallback(row) {
        const payload = await readProviderAccountPayload(row);
        const defaultModel =
          "defaultModel" in payload && typeof payload.defaultModel === "string" ? payload.defaultModel.trim() : "";
        return defaultModel ? [defaultModel] : [];
      },
    });
    for (const discoveredModelIds of providerModelIds) {
      for (const modelId of discoveredModelIds) {
        if (routePolicyAllowsModels(routePolicy?.config ?? null, [modelId])) {
          modelIds.add(modelId);
        }
      }
    }
  }

  return Array.from(modelIds.values()).sort((left, right) => left.localeCompare(right));
}

export async function resolveGatewayRouteContext(
  projectId: string,
  requestedModel: string | null,
  endpointKind: GatewayRelayEndpointKind | string,
) {
  await reactivateExpiredCoolingProviderAccounts();
  const project = await getGatewayProjectById(projectId);
  if (!project || project.status !== "active") {
    throw new NotFoundError("AI gateway project 不存在。");
  }

  const routePolicy =
    (project.defaultRoutePolicyId
      ? await db
          .select()
          .from(gatewayRoutePolicies)
          .where(eq(gatewayRoutePolicies.id, project.defaultRoutePolicyId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null) ?? (await getDefaultRoutePolicyForProject(project.id));

  if (!routePolicy || !routePolicy.enabled) {
    throw new ConflictError("当前 project 尚未配置可用的 AI gateway route policy。");
  }

  const aliasRows = await db
    .select()
    .from(gatewayModelAliases)
    .where(
      requestedModel
        ? and(
            eq(gatewayModelAliases.alias, requestedModel),
            eq(gatewayModelAliases.enabled, true),
            or(eq(gatewayModelAliases.projectId, project.id), isNull(gatewayModelAliases.projectId)),
          )
        : and(
            eq(gatewayModelAliases.enabled, true),
            or(eq(gatewayModelAliases.projectId, project.id), isNull(gatewayModelAliases.projectId)),
          ),
    )
    .orderBy(asc(gatewayModelAliases.priority), desc(gatewayModelAliases.weight), asc(gatewayModelAliases.createdAt));

  const activeProviderRows = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(
      and(
        eq(gatewayProviderAccounts.status, "active"),
        or(isNull(gatewayProviderAccounts.cooldownUntil), lte(gatewayProviderAccounts.cooldownUntil, now())),
      ),
    )
    .orderBy(asc(gatewayProviderAccounts.createdAt));

  const providerById = new Map(activeProviderRows.map((row) => [row.id, row] as const));
  const candidates: GatewayRouteCandidate[] = [];
  for (const aliasRow of aliasRows) {
    const providerRow = providerById.get(aliasRow.providerAccountId);
    if (!providerRow) {
      continue;
    }
    if (!providerAllowedByRoutePolicy(providerRow, routePolicy.config)) {
      continue;
    }
    if (!routePolicyAllowsModels(routePolicy.config, [aliasRow.alias, aliasRow.upstreamModel])) {
      continue;
    }
    candidates.push({
      aliasId: aliasRow.id,
      modelAlias: aliasRow.alias,
      providerAccount: await toGatewayProviderAccountView(providerRow),
      upstreamModel: aliasRow.upstreamModel,
      resolvedExecutionMode: resolveProviderExecutionMode(
        providerRow.executionMode,
        (providerRow.endpointExecutionModes as GatewayEndpointExecutionModeMap | null | undefined) ?? null,
        endpointKind,
      ),
      priority: aliasRow.priority,
      weight: aliasRow.weight,
    });
  }

  if (candidates.length === 0) {
    for (const providerRow of activeProviderRows) {
      if (!providerAllowedByRoutePolicy(providerRow, routePolicy.config)) {
        continue;
      }
      const providerAccount = await toGatewayProviderAccountView(providerRow);
      const payload = providerAccount.payload;
      const defaultModel =
        "defaultModel" in payload && typeof payload.defaultModel === "string" && payload.defaultModel.trim()
          ? payload.defaultModel.trim()
          : requestedModel;
      if (!routePolicyAllowsModels(routePolicy.config, [requestedModel, defaultModel])) {
        continue;
      }
      candidates.push({
        aliasId: null,
        modelAlias: requestedModel,
        providerAccount,
        upstreamModel: defaultModel ?? null,
        resolvedExecutionMode: resolveProviderExecutionMode(
          providerRow.executionMode,
          (providerRow.endpointExecutionModes as GatewayEndpointExecutionModeMap | null | undefined) ?? null,
          endpointKind,
        ),
        priority: 100,
        weight: 1,
      });
    }
  }

  if (candidates.length === 0) {
    if (requestedModel && routePolicyHasModelRestrictions(routePolicy.config)) {
      throw new ConflictError(`当前 route policy 不允许模型 ${requestedModel}。`);
    }
    throw new ConflictError("当前网关没有可用的 provider account。");
  }

  return {
    project: toGatewayProjectView(project),
    routePolicy: toGatewayRoutePolicyView(routePolicy),
    candidates,
  } satisfies GatewayResolvedRouteContext;
}

export async function resolveGatewayProviderNamespaceContext(projectId: string, providerName: string) {
  await reactivateExpiredCoolingProviderAccounts();
  const normalizedProviderName = providerName.trim().toLowerCase();
  if (!normalizedProviderName) {
    throw new ConflictError("Provider namespace 不能为空。");
  }

  const routeContext = await resolveGatewayRouteContext(projectId, null, "provider_namespace");
  const seenProviderIds = new Set<string>();
  const providerAccounts = routeContext.candidates
    .map((candidate) => candidate.providerAccount)
    .filter((providerAccount) => {
      if (seenProviderIds.has(providerAccount.id)) {
        return false;
      }
      seenProviderIds.add(providerAccount.id);
      return true;
    })
    .filter((providerAccount) => {
      const payload = providerAccount.payload;
      if (payload.adapter === "provider_passthrough") {
        return payload.provider.trim().toLowerCase() === normalizedProviderName;
      }
      if (payload.adapter === "custom_http") {
        const configuredProvider = payload.provider?.trim().toLowerCase() ?? "";
        const fallbackProvider = providerAccount.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        return configuredProvider === normalizedProviderName || fallbackProvider === normalizedProviderName;
      }
      return false;
    });

  if (providerAccounts.length === 0) {
    throw new NotFoundError(`当前 project 未配置 provider namespace: ${providerName}`);
  }

  return {
    project: routeContext.project,
    routePolicy: routeContext.routePolicy,
    providerName: normalizedProviderName,
    providerAccounts,
  } satisfies GatewayResolvedProviderNamespaceContext;
}

export async function resolveGatewaySession(args: {
  projectId: string;
  sessionKey: string | null;
  previousResponseId: string | null;
}) {
  if (args.sessionKey) {
    const [session] = await db
      .select()
      .from(gatewaySessions)
      .where(and(eq(gatewaySessions.projectId, args.projectId), eq(gatewaySessions.sessionKey, args.sessionKey)))
      .limit(1);
    return session ? toGatewaySessionView(session) : null;
  }

  if (!args.previousResponseId) {
    return null;
  }

  const [audit] = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      and(
        eq(gatewayRequestAudits.projectId, args.projectId),
        eq(gatewayRequestAudits.responseId, args.previousResponseId),
      ),
    )
    .limit(1);

  if (!audit?.sessionId) {
    return null;
  }

  const [session] = await db.select().from(gatewaySessions).where(eq(gatewaySessions.id, audit.sessionId)).limit(1);
  return session ? toGatewaySessionView(session) : null;
}

export async function upsertGatewaySession(args: {
  projectId: string;
  sessionKey: string;
  protocolFamily: GatewayProtocolFamily;
  providerAccountId: string;
  upstreamSessionId?: string | null;
  runtimeStateObjectKey?: string | null;
  latestResponseId?: string | null;
  activeRequestAuditId?: string | null;
}) {
  return db.transaction(async (tx) => {
    const timestamp = now();
    const [existing] = await tx
      .select()
      .from(gatewaySessions)
      .where(and(eq(gatewaySessions.projectId, args.projectId), eq(gatewaySessions.sessionKey, args.sessionKey)))
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(gatewaySessions)
        .set({
          protocolFamily: args.protocolFamily,
          providerAccountId: args.providerAccountId,
          upstreamSessionId: args.upstreamSessionId ?? existing.upstreamSessionId,
          runtimeStateObjectKey: args.runtimeStateObjectKey ?? existing.runtimeStateObjectKey,
          latestResponseId: args.latestResponseId ?? existing.latestResponseId,
          activeRequestAuditId: args.activeRequestAuditId ?? existing.activeRequestAuditId,
          updatedAt: timestamp,
          lastUsedAt: timestamp,
          revokedAt: null,
        })
        .where(eq(gatewaySessions.id, existing.id))
        .returning();
      return toGatewaySessionView(updated ?? existing);
    }

    const [created] = await tx
      .insert(gatewaySessions)
      .values({
        id: randomUUID(),
        projectId: args.projectId,
        sessionKey: args.sessionKey,
        protocolFamily: args.protocolFamily,
        providerAccountId: args.providerAccountId,
        latestResponseId: args.latestResponseId ?? null,
        upstreamSessionId: args.upstreamSessionId ?? null,
        runtimeStateObjectKey: args.runtimeStateObjectKey ?? null,
        activeRequestAuditId: args.activeRequestAuditId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastUsedAt: timestamp,
        revokedAt: null,
      })
      .returning();

    return toGatewaySessionView(created);
  });
}

export async function createGatewayRequestAudit(args: {
  projectId: string;
  apiKeyId: string;
  sessionId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  modelAlias: string | null;
  stream: boolean;
  routeAttemptCount: number;
  responseId: string;
  previousResponseId: string | null;
  clientHasCacheControl?: boolean | null;
  autoCacheApplied?: boolean | null;
  routeTrace?: GatewayRequestRouteTrace | null;
  analysisProfile?: GatewayRequestAnalysisProfile | null;
  requestArtifactObjectKey?: string | null;
}) {
  const timestamp = now();
  const [created] = await db
    .insert(gatewayRequestAudits)
    .values({
      id: randomUUID(),
      projectId: args.projectId,
      apiKeyId: args.apiKeyId,
      sessionId: args.sessionId,
      routePolicyId: args.routePolicyId,
      providerAccountId: args.providerAccountId,
      protocolFamily: args.protocolFamily,
      endpointKind: args.endpointKind,
      requestedModel: args.requestedModel,
      resolvedModel: args.resolvedModel,
      modelAlias: args.modelAlias,
      stream: args.stream,
      routeAttemptCount: Math.max(1, args.routeAttemptCount),
      status: "running",
      upstreamStatus: null,
      durationMs: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      clientHasCacheControl: args.clientHasCacheControl ?? false,
      autoCacheApplied: args.autoCacheApplied ?? false,
      errorSummary: null,
      routeTrace: args.routeTrace ?? null,
      analysisProfile: args.analysisProfile ?? null,
      requestArtifactObjectKey: args.requestArtifactObjectKey ?? null,
      responseArtifactObjectKey: null,
      responseId: args.responseId,
      previousResponseId: args.previousResponseId,
      clientDisconnectedAt: null,
      createdAt: timestamp,
      completedAt: null,
      updatedAt: timestamp,
    })
    .returning();
  return toGatewayRequestAuditView(created);
}

export async function finalizeGatewayRequestAudit(
  requestAuditId: string,
  args: {
    status: GatewayRequestStatus;
    upstreamStatus: number | null;
    durationMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    cacheCreationInputTokens?: number | null;
    cacheReadInputTokens?: number | null;
    clientHasCacheControl?: boolean | null;
    autoCacheApplied?: boolean | null;
    errorSummary: string | null;
    sessionId?: string | null;
    providerAccountId?: string | null;
    resolvedModel?: string | null;
    routeTrace?: GatewayRequestRouteTrace | null;
    analysisProfile?: GatewayRequestAnalysisProfile | null;
    requestArtifactObjectKey?: string | null;
    responseArtifactObjectKey?: string | null;
  },
) {
  const timestamp = now();
  const [updated] = await db
    .update(gatewayRequestAudits)
    .set({
      status: args.status,
      upstreamStatus: args.upstreamStatus,
      durationMs: args.durationMs,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      cacheCreationInputTokens: args.cacheCreationInputTokens ?? undefined,
      cacheReadInputTokens: args.cacheReadInputTokens ?? undefined,
      clientHasCacheControl: args.clientHasCacheControl ?? undefined,
      autoCacheApplied: args.autoCacheApplied ?? undefined,
      errorSummary: args.errorSummary,
      routeTrace: args.routeTrace ?? undefined,
      analysisProfile: args.analysisProfile ?? undefined,
      requestArtifactObjectKey: args.requestArtifactObjectKey ?? undefined,
      responseArtifactObjectKey: args.responseArtifactObjectKey ?? undefined,
      sessionId: args.sessionId ?? undefined,
      providerAccountId: args.providerAccountId ?? undefined,
      resolvedModel: args.resolvedModel ?? undefined,
      completedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(gatewayRequestAudits.id, requestAuditId))
    .returning();
  if (!updated) {
    throw new NotFoundError("AI gateway request audit 不存在。");
  }
  return toGatewayRequestAuditView(updated);
}

export async function markGatewayRequestAuditDisconnected(requestAuditId: string) {
  await db
    .update(gatewayRequestAudits)
    .set({
      clientDisconnectedAt: now(),
      updatedAt: now(),
    })
    .where(eq(gatewayRequestAudits.id, requestAuditId));
}

export async function recordGatewaySessionOutcome(args: {
  sessionId: string;
  latestResponseId: string | null;
  upstreamSessionId?: string | null;
  runtimeStateObjectKey?: string | null;
  activeRequestAuditId?: string | null;
}) {
  const [updated] = await db
    .update(gatewaySessions)
    .set({
      latestResponseId: args.latestResponseId,
      upstreamSessionId: args.upstreamSessionId ?? undefined,
      runtimeStateObjectKey: args.runtimeStateObjectKey ?? undefined,
      activeRequestAuditId: args.activeRequestAuditId ?? undefined,
      updatedAt: now(),
      lastUsedAt: now(),
    })
    .where(eq(gatewaySessions.id, args.sessionId))
    .returning();
  return updated ? toGatewaySessionView(updated) : null;
}

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

type GatewayUsageAggregate = {
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

type GatewayUsageAuditRow = {
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

function emptyGatewayUsageAggregate(): GatewayUsageAggregate {
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

const USAGE_SAMPLE_LIMIT = 2000;

function mergeGatewayUsageAggregate(target: GatewayUsageAggregate, source: GatewayUsageAggregate) {
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

function normalizeGatewayPriceValue(value: unknown): number | null {
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

function readGatewayPricingField(
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

function buildGatewayPriceRateView(
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

function estimateGatewayObservedCostMicros(
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

function readGatewayModelStaticPricingCoverage(
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

function buildGatewayProviderCostHints(
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

async function listGatewayRecentUsageAuditRows(limit = USAGE_SAMPLE_LIMIT): Promise<GatewayUsageAuditRow[]> {
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

function aggregateGatewayUsageRowsByKey(
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

function readGatewayProviderDefaultModel(payload: GatewayProviderAccountPayload): string | null {
  if ("defaultModel" in payload && typeof payload.defaultModel === "string" && payload.defaultModel.trim()) {
    return payload.defaultModel.trim();
  }
  return null;
}

function buildGatewayFallbackPriorityLabel(links: GatewayModelAssociationProviderLinkView[]) {
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

export async function listGatewayRequestAuditsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRequestAuditOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 1000));
  const rows = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      and(
        filters.projectId ? eq(gatewayRequestAudits.projectId, filters.projectId) : undefined,
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
    .limit(limit);

  return rows
    .filter((row) => {
      if (filters.errorCode && row.routeTrace?.errorCode !== filters.errorCode) {
        return false;
      }
      if (
        typeof filters.fallbackEligible === "boolean" &&
        (row.routeTrace?.fallbackEligible ?? false) !== filters.fallbackEligible
      ) {
        return false;
      }
      return true;
    })
    .map(toGatewayRequestAuditView);
}

export async function listGatewaySessionsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewaySessionOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500));
  const rows = await db
    .select()
    .from(gatewaySessions)
    .where(
      and(
        filters.projectId ? eq(gatewaySessions.projectId, filters.projectId) : undefined,
        filters.providerAccountId ? eq(gatewaySessions.providerAccountId, filters.providerAccountId) : undefined,
        filters.protocolFamily ? eq(gatewaySessions.protocolFamily, filters.protocolFamily) : undefined,
        filters.activeOnly ? isNull(gatewaySessions.revokedAt) : undefined,
      ),
    )
    .orderBy(desc(gatewaySessions.lastUsedAt))
    .limit(limit);
  return rows.map(toGatewaySessionView);
}

export async function getGatewayRequestAuditForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args?: { requestAuditId?: string | null; responseId?: string | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const requestAuditId = args?.requestAuditId?.trim() ?? "";
  const responseId = args?.responseId?.trim() ?? "";
  if (!requestAuditId && !responseId) {
    throw new ConflictError("必须提供 requestAuditId 或 responseId。");
  }

  const [row] = await db
    .select()
    .from(gatewayRequestAudits)
    .where(
      requestAuditId
        ? eq(gatewayRequestAudits.id, requestAuditId)
        : eq(gatewayRequestAudits.responseId, responseId),
    )
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway request audit 不存在。");
  }
  return toGatewayRequestAuditView(row);
}

export async function getGatewayRequestArtifactsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args?: { requestAuditId?: string | null; responseId?: string | null },
) {
  const requestAudit = await getGatewayRequestAuditForOperator(operatorUserId, providerUserId, args);

  const [requestArtifact, responseArtifact] = await Promise.all([
    requestAudit.requestArtifactObjectKey
      ? readGatewayObject(requestAudit.requestArtifactObjectKey)
          .then((buffer) => JSON.parse(buffer.toString("utf8")) as GatewayStoredRequestArtifact)
          .catch(() => null)
      : Promise.resolve(null),
    requestAudit.responseArtifactObjectKey
      ? readGatewayObject(requestAudit.responseArtifactObjectKey)
          .then((buffer) => JSON.parse(buffer.toString("utf8")) as GatewayStoredResponseArtifact)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    requestAudit,
    requestArtifact,
    responseArtifact,
  } satisfies GatewayRequestArtifactsView;
}

export async function getGatewaySessionDetailForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  sessionId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSessionId = sessionId?.trim() ?? "";
  if (!normalizedSessionId) {
    throw new ConflictError("sessionId 不能为空。");
  }

  const [session] = await db.select().from(gatewaySessions).where(eq(gatewaySessions.id, normalizedSessionId)).limit(1);
  if (!session) {
    throw new NotFoundError("Gateway session 不存在。");
  }

  const recentAudits = await db
    .select()
    .from(gatewayRequestAudits)
    .where(eq(gatewayRequestAudits.sessionId, session.id))
    .orderBy(desc(gatewayRequestAudits.createdAt))
    .limit(10);

  const activeRequestAudit =
    session.activeRequestAuditId?.trim()
      ? recentAudits.find((row) => row.id === session.activeRequestAuditId) ??
        (
          await db
            .select()
            .from(gatewayRequestAudits)
            .where(eq(gatewayRequestAudits.id, session.activeRequestAuditId))
            .limit(1)
        )[0] ??
        null
      : null;

  return {
    session: toGatewaySessionView(session),
    activeRequestAudit: activeRequestAudit ? toGatewayRequestAuditView(activeRequestAudit) : null,
    latestRequestAudit: recentAudits[0] ? toGatewayRequestAuditView(recentAudits[0]) : null,
    recentRequestAudits: recentAudits.map(toGatewayRequestAuditView),
  } satisfies GatewaySessionDetailView;
}

function accumulateSummaryBucket(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() ?? "";
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toSummaryBuckets(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count } satisfies GatewaySummaryBucket))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? null;
}

function buildDistribution(values: Array<number | null | undefined>) {
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

function roundPromptCacheMetric(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function normalizePromptCacheInputPrice(value?: number | null) {
  const normalized = value ?? 15;
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new ConflictError("inputPricePerMillion 必须是大于等于 0 的数字。");
  }
  return normalized;
}

function normalizePromptCacheBucketSize(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "day" as const;
  }
  if (normalized === "hour" || normalized === "day") {
    return normalized;
  }
  throw new ConflictError("bucketSize 仅支持 hour 或 day。");
}

function calculatePromptCacheCostSavedUsd(tokensSaved: number, inputPricePerMillion: number) {
  if (tokensSaved <= 0) {
    return 0;
  }
  return tokensSaved * inputPricePerMillion * 0.9 / 1_000_000;
}

function buildGatewayPromptCacheSummaryView(args: {
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

function getPromptCacheBucketStart(createdAt: string, bucketSize: "hour" | "day") {
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

export async function listGatewayRequestAuditSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRequestAuditOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 1000, 1000)),
  });

  const byStatus = new Map<string, number>();
  const byProviderAccount = new Map<string, number>();
  const byEndpointKind = new Map<string, number>();
  const byErrorCode = new Map<string, number>();

  let completedCount = 0;
  let failedCount = 0;
  let cancelledCount = 0;
  let runningCount = 0;
  let fallbackEligibleFailures = 0;
  let fallbackExhaustedFailures = 0;

  for (const row of rows) {
    accumulateSummaryBucket(byStatus, row.status);
    accumulateSummaryBucket(byProviderAccount, row.providerAccountId);
    accumulateSummaryBucket(byEndpointKind, row.endpointKind);
    accumulateSummaryBucket(byErrorCode, row.routeTrace?.errorCode ?? null);

    if (row.status === "completed") {
      completedCount += 1;
    } else if (row.status === "failed") {
      failedCount += 1;
      if (row.routeTrace?.fallbackEligible) {
        fallbackEligibleFailures += 1;
      } else {
        fallbackExhaustedFailures += 1;
      }
    } else if (row.status === "cancelled") {
      cancelledCount += 1;
    } else if (row.status === "running") {
      runningCount += 1;
    }
  }

  return {
    totalRequests: rows.length,
    completedCount,
    failedCount,
    cancelledCount,
    runningCount,
    fallbackEligibleFailures,
    fallbackExhaustedFailures,
    byStatus: toSummaryBuckets(byStatus),
    byProviderAccount: toSummaryBuckets(byProviderAccount),
    byEndpointKind: toSummaryBuckets(byEndpointKind),
    byErrorCode: toSummaryBuckets(byErrorCode),
  } satisfies GatewayRequestAuditSummaryView;
}

export async function summarizeGatewayRateLimitHotspotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRequestAuditOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 1000));
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    status: "failed",
    limit,
  });
  return buildGatewayRateLimitHotspotSummary(rows);
}

function toGatewayRateLimitHotspotFilterView(
  filters: GatewayRateLimitHotspotOperatorFilters,
  args: { limit: number; windowSize: number; bucketSizeMinutes: number },
): GatewayRateLimitHotspotFilterView {
  return {
    projectId: filters.projectId ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    providerAccountId: filters.providerAccountId ?? null,
    sessionId: filters.sessionId ?? null,
    apiKeyId: filters.apiKeyId ?? null,
    responseId: filters.responseId ?? null,
    protocolFamily: filters.protocolFamily ?? null,
    endpointKind: filters.endpointKind ?? null,
    errorCode: filters.errorCode ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    limit: args.limit,
    windowSize: args.windowSize,
    bucketSizeMinutes: args.bucketSizeMinutes,
  };
}

export async function getGatewayRateLimitHotspotTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotOperatorFilters = {},
): Promise<GatewayRateLimitHotspotTrendReportView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 1000, 1000));
  const windowSize = Math.max(1, Math.min(filters.windowSize ?? 12, 168));
  const bucketSizeMinutes = Math.max(1, Math.min(filters.bucketSizeMinutes ?? 60, 1440));
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    status: "failed",
    limit,
  });
  return buildGatewayRateLimitHotspotTrendReport({
    generatedAt: now().toISOString(),
    filters: toGatewayRateLimitHotspotFilterView(filters, {
      limit,
      windowSize,
      bucketSizeMinutes,
    }),
    rows,
  });
}

export async function getGatewayRateLimitHotspotAnomalyReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotAnomalyOperatorFilters = {},
): Promise<GatewayRateLimitHotspotAnomalyReportView> {
  const profileKey = filters.profileKey ?? "balanced";
  const trendReport = await getGatewayRateLimitHotspotTrendReportForOperator(operatorUserId, providerUserId, filters);
  const thresholds = buildGatewayRateLimitHotspotAnomalyThresholdConfig(profileKey, filters.thresholds ?? {});
  return buildGatewayRateLimitHotspotAnomalyReport({
    generatedAt: now().toISOString(),
    trendReport,
    profileKey,
    thresholds,
  });
}

function buildGatewayRateLimitHotspotSnapshotFilterView(args: {
  filters: GatewayRateLimitHotspotOperatorFilters;
  limit: number;
  lookbackHours: number | null;
}) {
  return {
    projectId: args.filters.projectId ?? null,
    routePolicyId: args.filters.routePolicyId ?? null,
    providerAccountId: args.filters.providerAccountId ?? null,
    sessionId: args.filters.sessionId ?? null,
    apiKeyId: args.filters.apiKeyId ?? null,
    responseId: args.filters.responseId ?? null,
    protocolFamily: args.filters.protocolFamily ?? null,
    endpointKind: args.filters.endpointKind ?? null,
    errorCode: args.filters.errorCode ?? null,
    createdFrom: args.filters.createdFrom ?? null,
    createdTo: args.filters.createdTo ?? null,
    limit: args.limit,
    lookbackHours: args.lookbackHours,
  } satisfies GatewayRateLimitHotspotSnapshotView["filters"];
}

function buildGatewayRateLimitHotspotAnomalySnapshotFilterView(args: {
  filters: GatewayRateLimitHotspotAnomalyOperatorFilters;
  limit: number;
  lookbackHours: number | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
}) {
  return {
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.filters.label ?? null),
    projectId: args.filters.projectId ?? null,
    routePolicyId: args.filters.routePolicyId ?? null,
    apiKeyId: args.filters.apiKeyId ?? null,
    endpointKind: args.filters.endpointKind ?? null,
    createdFrom: args.filters.createdFrom ?? null,
    createdTo: args.filters.createdTo ?? null,
    limit: args.limit,
    lookbackHours: args.lookbackHours,
    profileKey: args.profileKey,
  } satisfies GatewayRateLimitHotspotAnomalySnapshotView["filters"];
}

async function readGatewayRateLimitHotspotSnapshot(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayRateLimitHotspotSnapshotView;
}

async function readGatewayRateLimitHotspotAnomalySnapshot(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayRateLimitHotspotAnomalySnapshotView;
}

function matchesGatewayRateLimitHotspotSnapshotFilters(
  snapshot: GatewayRateLimitHotspotSnapshotView,
  filters: GatewayRateLimitHotspotSnapshotFilters,
  createdFrom: Date | null,
  createdTo: Date | null,
) {
  if (filters.snapshotId?.trim() && snapshot.snapshotId !== filters.snapshotId.trim()) {
    return false;
  }
  if (filters.label?.trim()) {
    const needle = filters.label.trim().toLowerCase();
    const haystack = snapshot.label?.trim().toLowerCase() ?? "";
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  if (filters.projectId?.trim() && snapshot.filters.projectId !== filters.projectId.trim()) {
    return false;
  }
  if (filters.routePolicyId?.trim() && snapshot.filters.routePolicyId !== filters.routePolicyId.trim()) {
    return false;
  }
  if (filters.apiKeyId?.trim() && snapshot.filters.apiKeyId !== filters.apiKeyId.trim()) {
    return false;
  }
  if (filters.endpointKind?.trim() && snapshot.filters.endpointKind !== filters.endpointKind.trim()) {
    return false;
  }
  const createdAt = Date.parse(snapshot.createdAt);
  if (createdFrom && createdAt < createdFrom.getTime()) {
    return false;
  }
  if (createdTo && createdAt > createdTo.getTime()) {
    return false;
  }
  return true;
}

function matchesGatewayRateLimitHotspotAnomalySnapshotFilters(
  snapshot: GatewayRateLimitHotspotAnomalySnapshotView,
  filters: GatewayRateLimitHotspotAnomalySnapshotFilters,
  createdFrom: Date | null,
  createdTo: Date | null,
) {
  if (filters.snapshotId?.trim() && snapshot.snapshotId !== filters.snapshotId.trim()) {
    return false;
  }
  if (filters.label?.trim()) {
    const needle = filters.label.trim().toLowerCase();
    const haystack = snapshot.label?.trim().toLowerCase() ?? "";
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  if (filters.projectId?.trim() && snapshot.filters.projectId !== filters.projectId.trim()) {
    return false;
  }
  if (filters.routePolicyId?.trim() && snapshot.filters.routePolicyId !== filters.routePolicyId.trim()) {
    return false;
  }
  if (filters.apiKeyId?.trim() && snapshot.filters.apiKeyId !== filters.apiKeyId.trim()) {
    return false;
  }
  if (filters.endpointKind?.trim() && snapshot.filters.endpointKind !== filters.endpointKind.trim()) {
    return false;
  }
  if (filters.profileKey?.trim() && snapshot.filters.profileKey !== filters.profileKey.trim()) {
    return false;
  }
  const createdAt = Date.parse(snapshot.createdAt);
  if (createdFrom && createdAt < createdFrom.getTime()) {
    return false;
  }
  if (createdTo && createdAt > createdTo.getTime()) {
    return false;
  }
  return true;
}

function normalizeGatewayRateLimitHotspotSnapshotTrendFilters(
  filters: GatewayRateLimitHotspotSnapshotTrendFilters = {},
) {
  return {
    snapshotId: filters.snapshotId ?? null,
    label: filters.label ?? null,
    projectId: filters.projectId ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    apiKeyId: filters.apiKeyId ?? null,
    endpointKind: filters.endpointKind ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    limit: Math.max(1, Math.min(filters.limit ?? 10, 50)),
  } satisfies GatewayRateLimitHotspotSnapshotTrendFilters;
}

export async function persistGatewayRateLimitHotspotSnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayRateLimitHotspotOperatorFilters & {
    label?: string | null;
    lookbackHours?: number | null;
  } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const lookbackHours = normalizeNonNegativeInt(args.lookbackHours, null, 24 * 365);
  const createdFrom =
    args.createdFrom?.trim() ||
    (lookbackHours != null ? new Date(timestamp.getTime() - lookbackHours * 60 * 60 * 1000).toISOString() : null);
  const limit = Math.max(1, Math.min(args.limit ?? 1000, 1000));
  const summary = await summarizeGatewayRateLimitHotspotsForOperator(operatorUserId, providerUserId, {
    ...args,
    createdFrom,
    limit,
  });
  const snapshotId = randomUUID();
  const objectKey = buildGatewayRateLimitHotspotSnapshotObjectKey(snapshotId);
  const snapshot = {
    snapshotId,
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.label),
    createdAt: timestamp.toISOString(),
    objectKey,
    filters: buildGatewayRateLimitHotspotSnapshotFilterView({
      filters: {
        ...args,
        createdFrom,
      },
      limit,
      lookbackHours,
    }),
    summary,
  } satisfies GatewayRateLimitHotspotSnapshotView;

  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), "application/json");
  return snapshot;
}

export async function listGatewayRateLimitHotspotSnapshotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotSnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const snapshotKeys = (await listGatewayObjects("ai-gateway/rate-limit-hotspot-snapshots")).filter((key) =>
    key.endsWith("/snapshot.json"),
  );
  const snapshots: GatewayRateLimitHotspotSnapshotView[] = [];
  for (const objectKey of snapshotKeys) {
    const snapshot = await readGatewayRateLimitHotspotSnapshot(objectKey).catch(() => null);
    if (!snapshot) {
      continue;
    }
    if (!matchesGatewayRateLimitHotspotSnapshotFilters(snapshot, filters, createdFrom, createdTo)) {
      continue;
    }
    snapshots.push(snapshot);
  }
  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayRateLimitHotspotSnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSnapshotId = snapshotId?.trim() ?? "";
  if (!normalizedSnapshotId) {
    throw new ConflictError("snapshotId 不能为空。");
  }
  const objectKey = buildGatewayRateLimitHotspotSnapshotObjectKey(normalizedSnapshotId);
  const snapshot = await readGatewayRateLimitHotspotSnapshot(objectKey).catch(() => null);
  if (!snapshot) {
    throw new NotFoundError("Gateway rate-limit hotspot snapshot 不存在。");
  }
  return snapshot;
}

export async function getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotSnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const snapshots = await listGatewayRateLimitHotspotSnapshotsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 500, 500)),
  });
  return buildGatewayRateLimitHotspotSnapshotInventorySummary({
    snapshots,
  }) satisfies GatewayRateLimitHotspotSnapshotInventorySummaryView;
}

export async function getGatewayRateLimitHotspotSnapshotTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotSnapshotTrendFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = normalizeGatewayRateLimitHotspotSnapshotTrendFilters(filters);
  const [snapshots, inventorySummary] = await Promise.all([
    listGatewayRateLimitHotspotSnapshotsForOperator(operatorUserId, providerUserId, normalizedFilters),
    getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator(operatorUserId, providerUserId, {
      ...normalizedFilters,
      limit: 500,
    }),
  ]);
  const points = snapshots.map((snapshot) => buildGatewayRateLimitHotspotSnapshotTrendPoint(snapshot));
  return buildGatewayRateLimitHotspotSnapshotTrendReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      projectId: normalizedFilters.projectId ?? null,
      routePolicyId: normalizedFilters.routePolicyId ?? null,
      apiKeyId: normalizedFilters.apiKeyId ?? null,
      endpointKind: normalizedFilters.endpointKind ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    windowSize: normalizedFilters.limit,
    inventorySummary,
    points,
  }) satisfies GatewayRateLimitHotspotSnapshotTrendReportView;
}

export async function persistGatewayRateLimitHotspotAnomalySnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayRateLimitHotspotAnomalyOperatorFilters & {
    label?: string | null;
    lookbackHours?: number | null;
  } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const lookbackHours = normalizeNonNegativeInt(args.lookbackHours, null, 24 * 365);
  const createdFrom =
    args.createdFrom?.trim() ||
    (lookbackHours != null ? new Date(timestamp.getTime() - lookbackHours * 60 * 60 * 1000).toISOString() : null);
  const normalizedFilters = {
    ...args,
    createdFrom,
    limit: Math.max(1, Math.min(args.limit ?? 10, 50)),
  } satisfies GatewayRateLimitHotspotAnomalyOperatorFilters & { label?: string | null; lookbackHours?: number | null };
  const report = await getGatewayRateLimitHotspotAnomalyReportForOperator(
    operatorUserId,
    providerUserId,
    normalizedFilters,
  );
  const snapshotId = randomUUID();
  const objectKey = buildGatewayRateLimitHotspotAnomalySnapshotObjectKey(snapshotId);
  const snapshot = {
    snapshotId,
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.label),
    createdAt: timestamp.toISOString(),
    objectKey,
    filters: buildGatewayRateLimitHotspotAnomalySnapshotFilterView({
      filters: normalizedFilters,
      limit: normalizedFilters.limit ?? 10,
      lookbackHours,
      profileKey: report.profileKey,
    }),
    report,
  } satisfies GatewayRateLimitHotspotAnomalySnapshotView;

  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), "application/json");
  return snapshot;
}

export async function listGatewayRateLimitHotspotAnomalySnapshotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotAnomalySnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const snapshotKeys = (await listGatewayObjects("ai-gateway/rate-limit-hotspot-anomaly-snapshots")).filter((key) =>
    key.endsWith("/snapshot.json"),
  );
  const snapshots: GatewayRateLimitHotspotAnomalySnapshotView[] = [];
  for (const objectKey of snapshotKeys) {
    const snapshot = await readGatewayRateLimitHotspotAnomalySnapshot(objectKey).catch(() => null);
    if (!snapshot) {
      continue;
    }
    if (!matchesGatewayRateLimitHotspotAnomalySnapshotFilters(snapshot, filters, createdFrom, createdTo)) {
      continue;
    }
    snapshots.push(snapshot);
  }
  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayRateLimitHotspotAnomalySnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSnapshotId = snapshotId?.trim() ?? "";
  if (!normalizedSnapshotId) {
    throw new ConflictError("snapshotId 不能为空。");
  }
  const objectKey = buildGatewayRateLimitHotspotAnomalySnapshotObjectKey(normalizedSnapshotId);
  const snapshot = await readGatewayRateLimitHotspotAnomalySnapshot(objectKey).catch(() => null);
  if (!snapshot) {
    throw new NotFoundError("Gateway rate-limit hotspot anomaly snapshot 不存在。");
  }
  return snapshot;
}

function toGatewayAnalysisSampleView(row: GatewayRequestAuditView): GatewayAnalysisSampleView {
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

function toGatewayProviderRoutingAnalysisFilterView(
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

export async function exportGatewayAnalysisRowsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisOperatorFilters = {},
) {
  const rows = await listGatewayAnalysisSamplesForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 200, 500)),
  });
  const textMode = normalizeAnalysisTextMode(filters.textMode);
  const maxTextChars = Math.max(0, Math.min(filters.maxTextChars ?? 4_000, 32_000));

  const exportedRows = await mapWithConcurrency(
    rows,
    ANALYSIS_EXPORT_READ_CONCURRENCY,
    async (row) => {
      const [requestArtifact, responseArtifact] = await Promise.all([
        row.requestArtifactObjectKey
          ? readGatewayObject(row.requestArtifactObjectKey)
              .then((buffer) => JSON.parse(buffer.toString("utf8")) as GatewayStoredRequestArtifact)
              .catch(() => null)
          : Promise.resolve(null),
        row.responseArtifactObjectKey
          ? readGatewayObject(row.responseArtifactObjectKey)
              .then((buffer) => JSON.parse(buffer.toString("utf8")) as GatewayStoredResponseArtifact)
              .catch(() => null)
          : Promise.resolve(null),
      ]);

      return buildGatewayAnalysisExportRow({
        sample: row,
        requestArtifact,
        responseArtifact,
        textMode,
        maxTextChars,
      });
    },
  );

  return {
    textMode,
    maxTextChars,
    sampleCount: exportedRows.length,
    requestArtifactCount: exportedRows.filter((row) => row.requestArtifactAvailable).length,
    responseArtifactCount: exportedRows.filter((row) => row.responseArtifactAvailable).length,
    rows: exportedRows,
  } satisfies GatewayAnalysisExportView;
}

export async function persistGatewayAnalysisExportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayAnalysisOperatorFilters & {
    label?: string | null;
    tags?: string[] | null;
    retentionExpiresAt?: string | null;
  } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const textMode = normalizeAnalysisTextMode(args.textMode);
  const maxTextChars = Math.max(0, Math.min(args.maxTextChars ?? 4_000, 32_000));
  const exportView = await exportGatewayAnalysisRowsForOperator(operatorUserId, providerUserId, {
    ...args,
    textMode,
    maxTextChars,
  });
  const exportId = randomUUID();
  const createdAt = now().toISOString();
  const label = normalizeAnalysisExportLabel(args.label);
  const tags = normalizeAnalysisExportTags(args.tags);
  const retentionExpiresAt = parseFilterTimestamp(args.retentionExpiresAt, "retentionExpiresAt");
  const filters = buildGatewayAnalysisExportFilterView(args, textMode, maxTextChars);
  const objectPrefix = buildGatewayAnalysisExportPrefix(exportId);

  const datasetBody = buildGatewayAnalysisDatasetJsonl(exportView.rows);
  const datasetObjectKey = buildGatewayAnalysisExportDatasetObjectKey(exportId);
  const datasetFile = buildGatewayAnalysisExportFileView({
    kind: "dataset_jsonl",
    objectKey: datasetObjectKey,
    contentType: "application/x-ndjson",
    body: datasetBody,
    lineCount: exportView.rows.length,
  });

  const manifestObjectKey = buildGatewayAnalysisExportManifestObjectKey(exportId);
  const { manifest: finalizedManifest, manifestBody: finalizedManifestBody, manifestFile: finalizedManifestFile } =
    buildGatewayPersistedAnalysisExportManifestArtifacts({
      exportId,
      label,
      tags,
      createdAt,
      retentionExpiresAt: retentionExpiresAt?.toISOString() ?? null,
      filters,
      sampleCount: exportView.sampleCount,
      requestArtifactCount: exportView.requestArtifactCount,
      responseArtifactCount: exportView.responseArtifactCount,
      datasetFile,
      manifestObjectKey,
    });

  await putGatewayObject(datasetObjectKey, datasetBody, datasetFile.contentType);
  await putGatewayObject(manifestObjectKey, finalizedManifestBody, finalizedManifestFile.contentType);

  const timestamp = new Date(createdAt);
  await db
    .insert(gatewayAnalysisExports)
    .values({
      id: exportId,
      projectId: filters.projectId,
      label,
      tags,
      status: "active",
      textMode,
      maxTextChars,
      filters,
      objectPrefix,
      manifestObjectKey,
      datasetObjectKey,
      sampleCount: exportView.sampleCount,
      requestArtifactCount: exportView.requestArtifactCount,
      responseArtifactCount: exportView.responseArtifactCount,
      retentionExpiresAt,
      cleanedUpAt: null,
      lastCleanupError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: gatewayAnalysisExports.id,
      set: {
        projectId: filters.projectId,
        label,
        tags,
        status: "active",
        textMode,
        maxTextChars,
        filters,
        objectPrefix,
        manifestObjectKey,
        datasetObjectKey,
        sampleCount: exportView.sampleCount,
        requestArtifactCount: exportView.requestArtifactCount,
        responseArtifactCount: exportView.responseArtifactCount,
        retentionExpiresAt,
        cleanedUpAt: null,
        lastCleanupError: null,
        updatedAt: timestamp,
      },
    });

  return {
    exportId,
    label,
    tags,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    objectPrefix,
    filters,
    sampleCount: exportView.sampleCount,
    requestArtifactCount: exportView.requestArtifactCount,
    responseArtifactCount: exportView.responseArtifactCount,
    retentionExpiresAt: retentionExpiresAt?.toISOString() ?? null,
    cleanedUpAt: null,
    lastCleanupError: null,
    files: [finalizedManifestFile, datasetFile],
    manifest: finalizedManifest,
  } satisfies GatewayPersistedAnalysisExportView;
}

export async function listGatewayPersistedAnalysisExportsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayPersistedAnalysisExportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }

  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const rows = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(
      and(
        filters.exportId?.trim() ? eq(gatewayAnalysisExports.id, filters.exportId.trim()) : undefined,
        filters.projectId?.trim() ? eq(gatewayAnalysisExports.projectId, filters.projectId.trim()) : undefined,
        filters.status?.trim() ? eq(gatewayAnalysisExports.status, filters.status.trim()) : undefined,
        filters.textMode ? eq(gatewayAnalysisExports.textMode, filters.textMode) : undefined,
        createdFrom ? gte(gatewayAnalysisExports.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayAnalysisExports.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisExports.createdAt))
    .limit(limit * 2);

  const matchedRows = rows.filter((row) => {
    return matchesGatewayPersistedAnalysisExportFilters(
      {
        label: row.label,
        tags: row.tags,
        filters: row.filters,
        createdAt: row.createdAt.toISOString(),
        status: row.status as GatewayPersistedAnalysisExportView["status"],
      },
      filters,
      createdFrom,
      createdTo,
    );
  });

  const persisted = await Promise.all(
    matchedRows.slice(0, limit).map(async (row) => {
      const manifest = await readGatewayAnalysisExportManifest(row.manifestObjectKey).catch(() => null);
      return toGatewayPersistedAnalysisExportViewFromRow(row, manifest);
    }),
  );
  const resolved = persisted.filter((item): item is GatewayPersistedAnalysisExportView => Boolean(item));
  if (resolved.length > 0 || matchedRows.length > 0) {
    return resolved;
  }

  if ((filters.status?.trim() && filters.status.trim() !== "active") || filters.tag?.trim()) {
    return [];
  }
  const manifestKeys = (await listGatewayObjects("ai-gateway/analysis-exports"))
    .filter((key) => key.endsWith("/manifest.json"));
  const fallbackManifests: GatewayPersistedAnalysisExportView[] = [];
  for (const manifestKey of manifestKeys) {
    const manifest = await readGatewayAnalysisExportManifest(manifestKey).catch(() => null);
    if (!manifest) {
      continue;
    }
    const fallbackItem = toGatewayPersistedAnalysisExportView(manifest);
    if (filters.exportId?.trim() && fallbackItem.exportId !== filters.exportId.trim()) {
      continue;
    }
    if (!matchesGatewayPersistedAnalysisExportFilters(fallbackItem, filters, createdFrom, createdTo)) {
      continue;
    }
    fallbackManifests.push(fallbackItem);
  }
  return fallbackManifests
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayPersistedAnalysisExportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  exportId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedExportId = exportId?.trim() ?? "";
  if (!normalizedExportId) {
    throw new ConflictError("exportId 不能为空。");
  }
  const [row] = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(eq(gatewayAnalysisExports.id, normalizedExportId))
    .limit(1);
  if (row) {
    const manifest = await readGatewayAnalysisExportManifest(row.manifestObjectKey).catch(() => null);
    return toGatewayPersistedAnalysisExportViewFromRow(row, manifest);
  }
  const manifest = await readGatewayAnalysisExportManifest(
    buildGatewayAnalysisExportManifestObjectKey(normalizedExportId),
  ).catch(() => null);
  if (!manifest) {
    throw new NotFoundError("Gateway analysis export 不存在。");
  }
  return toGatewayPersistedAnalysisExportView(manifest);
}

export async function getGatewayPersistedAnalysisExportInventorySummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayPersistedAnalysisExportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }

  const rows = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(
      and(
        filters.exportId?.trim() ? eq(gatewayAnalysisExports.id, filters.exportId.trim()) : undefined,
        filters.projectId?.trim() ? eq(gatewayAnalysisExports.projectId, filters.projectId.trim()) : undefined,
        filters.status?.trim() ? eq(gatewayAnalysisExports.status, filters.status.trim()) : undefined,
        filters.textMode ? eq(gatewayAnalysisExports.textMode, filters.textMode) : undefined,
        createdFrom ? gte(gatewayAnalysisExports.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayAnalysisExports.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisExports.createdAt));

  const persisted = rows
    .filter((row) =>
      matchesGatewayPersistedAnalysisExportFilters(
        {
          label: row.label,
          tags: row.tags,
          filters: row.filters,
          createdAt: row.createdAt.toISOString(),
          status: row.status as GatewayPersistedAnalysisExportView["status"],
        },
        filters,
        createdFrom,
        createdTo,
      ),
    )
    .map((row) => toGatewayPersistedAnalysisExportViewFromRow(row, null));

  if (persisted.length > 0 || rows.length > 0 || filters.status?.trim() || filters.tag?.trim()) {
    return buildGatewayAnalysisExportInventorySummary({
      exports: persisted,
      nowIso: now().toISOString(),
    }) satisfies GatewayAnalysisExportInventorySummaryView;
  }

  const manifestKeys = (await listGatewayObjects("ai-gateway/analysis-exports")).filter((key) => key.endsWith("/manifest.json"));
  const fallbackItems: GatewayPersistedAnalysisExportView[] = [];
  for (const manifestKey of manifestKeys) {
    const manifest = await readGatewayAnalysisExportManifest(manifestKey).catch(() => null);
    if (!manifest) {
      continue;
    }
    const item = toGatewayPersistedAnalysisExportView(manifest);
    if (filters.exportId?.trim() && item.exportId !== filters.exportId.trim()) {
      continue;
    }
    if (!matchesGatewayPersistedAnalysisExportFilters(item, filters, createdFrom, createdTo)) {
      continue;
    }
    fallbackItems.push(item);
  }

  return buildGatewayAnalysisExportInventorySummary({
    exports: fallbackItems,
    nowIso: now().toISOString(),
  }) satisfies GatewayAnalysisExportInventorySummaryView;
}

export async function updateGatewayPersistedAnalysisExportMetadataForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  exportId?: string | null,
  input: GatewayAnalysisExportMetadataUpdateInput = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedExportId = exportId?.trim() ?? "";
  if (!normalizedExportId) {
    throw new ConflictError("exportId 不能为空。");
  }

  const [row] = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(eq(gatewayAnalysisExports.id, normalizedExportId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway analysis export 不存在。");
  }
  if (row.status === "deleted") {
    throw new ConflictError("已删除的 export 不允许继续修改 metadata。");
  }

  const nextLabel = Object.prototype.hasOwnProperty.call(input, "label")
    ? normalizeAnalysisExportLabel(input.label)
    : row.label;
  const nextTags = Object.prototype.hasOwnProperty.call(input, "tags")
    ? normalizeAnalysisExportTags(input.tags)
    : normalizeAnalysisExportTags(row.tags);
  const nextRetentionExpiresAt = Object.prototype.hasOwnProperty.call(input, "retentionExpiresAt")
    ? parseFilterTimestamp(input.retentionExpiresAt, "retentionExpiresAt")
    : row.retentionExpiresAt;

  const manifest = await readGatewayAnalysisExportManifest(row.manifestObjectKey).catch(() => null);
  const datasetFile =
    manifest?.files.find((file) => file.kind === "dataset_jsonl") ??
    ({
      kind: "dataset_jsonl",
      objectKey: row.datasetObjectKey,
      contentType: "application/x-ndjson",
      sizeBytes: 0,
      sha256: "",
      lineCount: row.sampleCount,
    } as GatewayPersistedAnalysisExportView["files"][number]);
  const rebuilt = buildGatewayPersistedAnalysisExportManifestArtifacts({
    exportId: row.id,
    label: nextLabel,
    tags: nextTags,
    createdAt: row.createdAt.toISOString(),
    retentionExpiresAt: nextRetentionExpiresAt?.toISOString() ?? null,
    filters: row.filters,
    sampleCount: row.sampleCount,
    requestArtifactCount: row.requestArtifactCount,
    responseArtifactCount: row.responseArtifactCount,
    datasetFile,
    manifestObjectKey: row.manifestObjectKey,
  });
  await putGatewayObject(row.manifestObjectKey, rebuilt.manifestBody, rebuilt.manifestFile.contentType);

  const updatedAt = now();
  await db
    .update(gatewayAnalysisExports)
    .set({
      label: nextLabel,
      tags: nextTags,
      retentionExpiresAt: nextRetentionExpiresAt,
      updatedAt,
    })
    .where(eq(gatewayAnalysisExports.id, row.id));

  return toGatewayPersistedAnalysisExportViewFromRow(
    {
      ...row,
      label: nextLabel,
      tags: nextTags,
      retentionExpiresAt: nextRetentionExpiresAt,
      updatedAt,
    },
    rebuilt.manifest,
  );
}

export async function runGatewayPersistedAnalysisExportCleanupForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: { limit?: number | null; includePinned?: boolean | null; dryRun?: boolean | null } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(args.limit ?? 50, 500));
  const scanTime = now();
  const candidates = await db
    .select()
    .from(gatewayAnalysisExports)
    .where(
      and(
        eq(gatewayAnalysisExports.status, "active"),
        lte(gatewayAnalysisExports.retentionExpiresAt, scanTime),
      ),
    )
    .orderBy(asc(gatewayAnalysisExports.retentionExpiresAt), asc(gatewayAnalysisExports.createdAt))
    .limit(limit);
  const rows = (args.includePinned ? candidates : candidates.filter((row) => !hasPinnedAnalysisExportTag(row.tags))).slice(
    0,
    limit,
  );

  const results: GatewayAnalysisExportCleanupResult["results"] = [];
  for (const row of rows) {
    try {
      const listedKeys = await listGatewayObjects(row.objectPrefix).catch(() => []);
      const keysToDelete = Array.from(
        new Set(
          [row.manifestObjectKey, row.datasetObjectKey, ...listedKeys].filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0,
          ),
        ),
      );
      if (args.dryRun) {
        results.push({
          exportId: row.id,
          status: "deleted",
          deletedObjectCount: keysToDelete.length,
          errorMessage: null,
        });
        continue;
      }
      for (const objectKey of keysToDelete) {
        await deleteGatewayObject(objectKey);
      }

      await db
        .update(gatewayAnalysisExports)
        .set({
          status: "deleted",
          cleanedUpAt: scanTime,
          lastCleanupError: null,
          updatedAt: scanTime,
        })
        .where(eq(gatewayAnalysisExports.id, row.id));

      results.push({
        exportId: row.id,
        status: "deleted",
        deletedObjectCount: keysToDelete.length,
        errorMessage: null,
      });
    } catch (error) {
      const errorMessage = truncateErrorSummary(error instanceof Error ? error.message : String(error), 500);
      await db
        .update(gatewayAnalysisExports)
        .set({
          lastCleanupError: errorMessage,
          updatedAt: scanTime,
        })
        .where(eq(gatewayAnalysisExports.id, row.id));

      results.push({
        exportId: row.id,
        status: "failed",
        deletedObjectCount: 0,
        errorMessage,
      });
    }
  }

  return {
    scannedCount: rows.length,
    deletedCount: results.filter((entry) => entry.status === "deleted").length,
    failedCount: results.filter((entry) => entry.status === "failed").length,
    results,
  } satisfies GatewayAnalysisExportCleanupResult;
}

async function buildGatewayAnalysisExportDiffForViews(args: {
  leftExport: GatewayPersistedAnalysisExportView;
  rightExport: GatewayPersistedAnalysisExportView;
}) {
  const leftDatasetObjectKey =
    args.leftExport.files.find((file) => file.kind === "dataset_jsonl")?.objectKey ??
    buildGatewayAnalysisExportDatasetObjectKey(args.leftExport.exportId);
  const rightDatasetObjectKey =
    args.rightExport.files.find((file) => file.kind === "dataset_jsonl")?.objectKey ??
    buildGatewayAnalysisExportDatasetObjectKey(args.rightExport.exportId);

  const [leftRows, rightRows] = await Promise.all([
    readGatewayAnalysisExportDataset(leftDatasetObjectKey).catch(() => null),
    readGatewayAnalysisExportDataset(rightDatasetObjectKey).catch(() => null),
  ]);
  if (!leftRows) {
    throw new ConflictError(`leftExportId=${args.leftExport.exportId} 的 dataset.jsonl 不可用，无法执行 diff。`);
  }
  if (!rightRows) {
    throw new ConflictError(`rightExportId=${args.rightExport.exportId} 的 dataset.jsonl 不可用，无法执行 diff。`);
  }

  return buildGatewayAnalysisExportDiff({
    leftExport: args.leftExport,
    rightExport: args.rightExport,
    leftRows,
    rightRows,
  }) satisfies GatewayAnalysisExportDiffView;
}

async function buildGatewayAnalysisExportTrendPoint(exportView: GatewayPersistedAnalysisExportView) {
  const datasetObjectKey =
    exportView.files.find((file) => file.kind === "dataset_jsonl")?.objectKey ??
    buildGatewayAnalysisExportDatasetObjectKey(exportView.exportId);
  const rows = await readGatewayAnalysisExportDataset(datasetObjectKey).catch(() => null);
  if (!rows) {
    return {
      export: exportView,
      datasetAvailable: false,
      datasetUnavailableReason: "dataset_missing",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      streamSamples: null,
      completedSamples: null,
      failedSamples: null,
      cancelledSamples: null,
      toolRequestSamples: null,
      toolResponseSamples: null,
      systemPromptSamples: null,
      reasoningSamples: null,
      metadataSamples: null,
      explicitSessionSamples: null,
      previousResponseSamples: null,
    } satisfies GatewayAnalysisExportTrendPointView;
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let streamSamples = 0;
  let completedSamples = 0;
  let failedSamples = 0;
  let cancelledSamples = 0;
  let toolRequestSamples = 0;
  let toolResponseSamples = 0;
  let systemPromptSamples = 0;
  let reasoningSamples = 0;
  let metadataSamples = 0;
  let explicitSessionSamples = 0;
  let previousResponseSamples = 0;

  for (const row of rows) {
    promptTokens += row.promptTokens ?? 0;
    completionTokens += row.completionTokens ?? 0;
    totalTokens += row.totalTokens ?? 0;
    if (row.stream) {
      streamSamples += 1;
    }
    if (row.status === "completed") {
      completedSamples += 1;
    } else if (row.status === "failed") {
      failedSamples += 1;
    } else if (row.status === "cancelled") {
      cancelledSamples += 1;
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
  }

  return {
    export: exportView,
    datasetAvailable: true,
    datasetUnavailableReason: null,
    promptTokens,
    completionTokens,
    totalTokens,
    streamSamples,
    completedSamples,
    failedSamples,
    cancelledSamples,
    toolRequestSamples,
    toolResponseSamples,
    systemPromptSamples,
    reasoningSamples,
    metadataSamples,
    explicitSessionSamples,
    previousResponseSamples,
  } satisfies GatewayAnalysisExportTrendPointView;
}

async function findGatewayAnalysisAnomalyPolicyRow(policyId: string) {
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyPolicies)
    .where(eq(gatewayAnalysisAnomalyPolicies.id, policyId))
    .limit(1);
  return row ?? null;
}

async function findGatewayRoutePolicyRow(routePolicyId: string) {
  const [row] = await db
    .select()
    .from(gatewayRoutePolicies)
    .where(eq(gatewayRoutePolicies.id, routePolicyId))
    .limit(1);
  return row ?? null;
}

async function updateGatewayAnalysisAnomalyPolicySyncState(args: {
  policyId?: string | null;
  status: GatewayAnalysisAnomalyPolicySyncStatus;
  syncedAt?: Date;
  error?: string | null;
}) {
  const policyId = args.policyId?.trim() ?? "";
  if (!policyId) {
    return;
  }
  await db
    .update(gatewayAnalysisAnomalyPolicies)
    .set({
      lastSyncedAt: args.syncedAt ?? now(),
      lastSyncStatus: args.status,
      lastSyncError: normalizeOptionalText(args.error, 2_000),
      updatedAt: now(),
    })
    .where(eq(gatewayAnalysisAnomalyPolicies.id, policyId));
}

function buildGatewayAnalysisAnomalyIncidentSnapshotMetadata(args: {
  policyId?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  tag?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  code: string;
  severity?: string | null;
  status?: string | null;
  ownerUserId?: string | null;
  followUpStatus?: string | null;
  syncHitCount?: number | null;
  escalationStatus?: string | null;
  escalatedAt?: string | null;
  escalationReason?: string | null;
  lastAlertAttemptAt?: string | null;
  lastAlertedAt?: string | null;
  lastAlertSeverity?: string | null;
  alertDeliveryCount?: number | null;
  latestExportId?: string | null;
  previousExportId?: string | null;
  latestValue?: number | null;
  previousValue?: number | null;
  deltaValue?: number | null;
  deltaRatio?: number | null;
  thresholdValue?: number | null;
  snapshotId?: string | null;
  entityKey?: string | null;
  latestBucketStartAt?: string | null;
  previousBucketStartAt?: string | null;
}) {
  return {
    policyId: args.policyId ?? null,
    projectId: args.projectId ?? null,
    routePolicyId: args.routePolicyId ?? null,
    tag: args.tag ?? null,
    textMode: args.textMode ?? null,
    code: args.code,
    severity: args.severity ?? null,
    status: args.status ?? null,
    ownerUserId: args.ownerUserId ?? null,
    followUpStatus: args.followUpStatus ?? null,
    syncHitCount: args.syncHitCount ?? null,
    escalationStatus: args.escalationStatus ?? null,
    escalatedAt: args.escalatedAt ?? null,
    escalationReason: args.escalationReason ?? null,
    lastAlertAttemptAt: args.lastAlertAttemptAt ?? null,
    lastAlertedAt: args.lastAlertedAt ?? null,
    lastAlertSeverity: args.lastAlertSeverity ?? null,
    alertDeliveryCount: args.alertDeliveryCount ?? null,
    latestExportId: args.latestExportId ?? null,
    previousExportId: args.previousExportId ?? null,
    latestValue: args.latestValue ?? null,
    previousValue: args.previousValue ?? null,
    deltaValue: args.deltaValue ?? null,
    deltaRatio: args.deltaRatio ?? null,
    thresholdValue: args.thresholdValue ?? null,
    snapshotId: args.snapshotId ?? null,
    entityKey: args.entityKey ?? null,
    latestBucketStartAt: args.latestBucketStartAt ?? null,
    previousBucketStartAt: args.previousBucketStartAt ?? null,
  } satisfies Record<string, unknown>;
}

function buildGatewayRateLimitHotspotIncidentTag(snapshot: GatewayRateLimitHotspotAnomalySnapshotView) {
  const parts = [`rate-limit-hotspot:${snapshot.filters.profileKey}`];
  if (snapshot.filters.apiKeyId?.trim()) {
    parts.push(`api-key:${snapshot.filters.apiKeyId.trim()}`);
  }
  if (snapshot.filters.endpointKind?.trim()) {
    parts.push(`endpoint:${snapshot.filters.endpointKind.trim().toLowerCase()}`);
  }
  return parts.join(":");
}

function buildGatewayProviderRoutingIncidentTag(args: {
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  filters: GatewayProviderRoutingAnalysisFilterView;
}) {
  const parts = [`provider-routing:${args.profileKey}`];
  if (args.filters.providerAccountId?.trim()) {
    parts.push(`provider:${args.filters.providerAccountId.trim()}`);
  }
  if (args.filters.protocolFamily?.trim()) {
    parts.push(`protocol:${args.filters.protocolFamily.trim().toLowerCase()}`);
  }
  if (args.filters.endpointKind?.trim()) {
    parts.push(`endpoint:${args.filters.endpointKind.trim().toLowerCase()}`);
  }
  if (args.filters.apiKeyId?.trim()) {
    parts.push(`api-key:${args.filters.apiKeyId.trim()}`);
  }
  if (args.filters.sessionId?.trim()) {
    parts.push(`session:${args.filters.sessionId.trim()}`);
  }
  if (args.filters.responseId?.trim()) {
    parts.push(`response:${args.filters.responseId.trim()}`);
  }
  if (args.filters.status?.trim()) {
    parts.push(`status:${args.filters.status.trim().toLowerCase()}`);
  }
  return parts.join(":");
}

async function appendGatewayAnalysisAnomalyIncidentHistory(args: {
  incidentId: string;
  eventType: GatewayAnalysisAnomalyIncidentHistoryEventType;
  actorUserId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
}) {
  await db.insert(gatewayAnalysisAnomalyIncidentHistory).values({
    id: randomUUID(),
    incidentId: args.incidentId,
    eventType: args.eventType,
    actorUserId: args.actorUserId?.trim() || null,
    note: normalizeOptionalText(args.note, 2_000),
    metadata: args.metadata ?? null,
    createdAt: args.createdAt ?? now(),
  });
}

async function resolveGatewayAnalysisAnomalyEvaluationContextForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportAnomalyReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const policyId = filters.policyId?.trim() ?? "";
  const policyRow = policyId ? await findGatewayAnalysisAnomalyPolicyRow(policyId) : null;
  if (policyId && !policyRow) {
    throw new NotFoundError("Gateway analysis anomaly policy 不存在。");
  }
  const policy = policyRow ? toGatewayAnalysisAnomalyPolicyView(policyRow) : null;
  const linkedRoutePolicyRow =
    policy?.routePolicyId != null ? await findGatewayRoutePolicyRow(policy.routePolicyId).catch(() => null) : null;
  if (policy?.projectId && linkedRoutePolicyRow && linkedRoutePolicyRow.projectId !== policy.projectId) {
    throw new ConflictError("当前 anomaly policy 绑定的 route policy 与 projectId 不一致。");
  }
  if (filters.projectId?.trim() && linkedRoutePolicyRow && linkedRoutePolicyRow.projectId !== filters.projectId.trim()) {
    throw new ConflictError("filters.projectId 与 anomaly policy 绑定的 route policy project 不一致。");
  }
  const profileKey = normalizeGatewayAnalysisAnomalyProfileKey(filters.profileKey ?? policy?.profileKey);
  const thresholds = buildGatewayAnalysisExportAnomalyThresholdConfig(profileKey, {
    ...(policy?.thresholds ?? {}),
    ...buildGatewayAnalysisAnomalyThresholdOverrides(filters),
  });

  return {
    policy,
    profileKey,
    thresholds,
    filters: {
      label: filters.label ?? null,
      tag: filters.tag ?? policy?.tag ?? null,
      projectId: filters.projectId ?? policy?.projectId ?? linkedRoutePolicyRow?.projectId ?? null,
      status: (filters.status?.trim() as GatewayPersistedAnalysisExportView["status"] | undefined) ?? "active",
      textMode: filters.textMode ?? policy?.textMode ?? null,
      createdFrom: filters.createdFrom ?? null,
      createdTo: filters.createdTo ?? null,
      limit: filters.limit,
    } satisfies GatewayAnalysisExportBaselineReportFilters,
  };
}

export async function listGatewayAnalysisAnomalyPoliciesForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyPolicyFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const dueOnly = filters.dueOnly === true;
  const rawLimit = dueOnly ? Math.max(limit, 500) : limit;
  const rows = await db
    .select()
    .from(gatewayAnalysisAnomalyPolicies)
    .where(
      and(
        filters.policyId?.trim() ? eq(gatewayAnalysisAnomalyPolicies.id, filters.policyId.trim()) : undefined,
        filters.projectId?.trim() ? eq(gatewayAnalysisAnomalyPolicies.projectId, filters.projectId.trim()) : undefined,
        filters.routePolicyId?.trim()
          ? eq(gatewayAnalysisAnomalyPolicies.routePolicyId, filters.routePolicyId.trim())
          : undefined,
        filters.status?.trim() ? eq(gatewayAnalysisAnomalyPolicies.status, filters.status.trim()) : undefined,
        filters.tag?.trim() ? eq(gatewayAnalysisAnomalyPolicies.tag, filters.tag.trim().toLowerCase()) : undefined,
        filters.textMode ? eq(gatewayAnalysisAnomalyPolicies.textMode, filters.textMode) : undefined,
        typeof filters.autoSyncEnabled === "boolean"
          ? eq(gatewayAnalysisAnomalyPolicies.autoSyncEnabled, filters.autoSyncEnabled)
          : undefined,
        typeof filters.autoEscalateEnabled === "boolean"
          ? eq(gatewayAnalysisAnomalyPolicies.autoEscalateEnabled, filters.autoEscalateEnabled)
          : undefined,
        typeof filters.autoRemediationEnabled === "boolean"
          ? eq(gatewayAnalysisAnomalyPolicies.autoRemediationEnabled, filters.autoRemediationEnabled)
          : undefined,
        typeof filters.alertingEnabled === "boolean"
          ? eq(gatewayAnalysisAnomalyPolicies.alertingEnabled, filters.alertingEnabled)
          : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyPolicies.updatedAt))
    .limit(rawLimit);
  const views = rows.map((row) => toGatewayAnalysisAnomalyPolicyView(row));
  return (dueOnly ? views.filter((row) => row.syncDue) : views).slice(0, limit);
}

export async function getGatewayAnalysisAnomalyPolicySummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyPolicyFilters = {},
) {
  const policies = await listGatewayAnalysisAnomalyPoliciesForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(filters.limit ?? 200, 200),
  });
  return buildGatewayAnalysisAnomalyPolicySummary(policies) satisfies GatewayAnalysisAnomalyPolicySummaryView;
}

export async function saveGatewayAnalysisAnomalyPolicyForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: UpsertGatewayAnalysisAnomalyPolicyInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const policyId = input.id?.trim() || randomUUID();
  const policyName = normalizeRequiredText(input.name, "Policy 名称", 120);
  const status = normalizeGatewayAnalysisAnomalyPolicyStatus(input.status);
  const profileKey = normalizeGatewayAnalysisAnomalyProfileKey(input.profileKey);
  const thresholds = buildGatewayAnalysisExportAnomalyThresholdConfig(profileKey, input.thresholds ?? {});
  const tag = normalizeOptionalText(input.tag, 40)?.toLowerCase() ?? null;
  const routePolicyId = input.routePolicyId?.trim() || null;
  const linkedRoutePolicy = routePolicyId ? await findGatewayRoutePolicyRow(routePolicyId) : null;
  if (routePolicyId && !linkedRoutePolicy) {
    throw new NotFoundError("绑定的 route policy 不存在。");
  }
  const requestedProjectId = input.projectId?.trim() || null;
  if (requestedProjectId && linkedRoutePolicy && linkedRoutePolicy.projectId !== requestedProjectId) {
    throw new ConflictError("anomaly policy 的 projectId 必须与 route policy 所属 project 一致。");
  }
  const projectId = requestedProjectId ?? linkedRoutePolicy?.projectId ?? null;
  const autoSyncEnabled = input.autoSyncEnabled ?? false;
  const autoSyncIntervalMinutes = autoSyncEnabled ? normalizeNonNegativeInt(input.autoSyncIntervalMinutes, 60, 10_080) : null;
  const autoEscalateEnabled = input.autoEscalateEnabled ?? false;
  const escalateSeverityThreshold = autoEscalateEnabled
    ? normalizeGatewayAnalysisAnomalySeverity(input.escalateSeverityThreshold ?? "critical")
    : null;
  const escalateAfterSyncCount = autoEscalateEnabled ? normalizeNonNegativeInt(input.escalateAfterSyncCount, 3, 1_000) : null;
  const autoEscalateOwnerUserId = autoEscalateEnabled ? input.autoEscalateOwnerUserId?.trim() || null : null;
  const autoEscalateFollowUpStatus = autoEscalateEnabled
    ? input.autoEscalateFollowUpStatus
      ? normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(input.autoEscalateFollowUpStatus)
      : "investigating"
    : null;
  const autoRemediationEnabled = input.autoRemediationEnabled ?? false;
  const autoRemediationIntervalMinutes = autoRemediationEnabled
    ? normalizeNonNegativeInt(input.autoRemediationIntervalMinutes, 180, 10_080)
    : null;
  const autoRemediationDryRunFirst = autoRemediationEnabled ? input.autoRemediationDryRunFirst !== false : true;
  const autoRemediationActionKeys = autoRemediationEnabled
    ? normalizeStringList(input.autoRemediationActionKeys ?? null)
    : null;
  const autoRemediationMaxApplyRunsPerIncident = autoRemediationEnabled
    ? normalizeNonNegativeInt(input.autoRemediationMaxApplyRunsPerIncident, null, 1_000)
    : null;
  const autoRemediationRequireAlertBeforeApply = autoRemediationEnabled
    ? input.autoRemediationRequireAlertBeforeApply === true
    : false;
  const autoRemediationFreezeOnProviderHealthDegrade = autoRemediationEnabled
    ? input.autoRemediationFreezeOnProviderHealthDegrade !== false
    : true;
  const alertingEnabled = input.alertingEnabled ?? true;
  const alertIntervalMinutes = alertingEnabled ? normalizeNonNegativeInt(input.alertIntervalMinutes, 180, 10_080) : null;
  const notifyOperatorsOnEscalation = alertingEnabled ? input.notifyOperatorsOnEscalation ?? true : false;
  const notifyOwnerOnEscalation = alertingEnabled ? input.notifyOwnerOnEscalation ?? true : false;
  const timestamp = now();

  await db
    .insert(gatewayAnalysisAnomalyPolicies)
    .values({
      id: policyId,
      name: policyName,
      status,
      projectId,
      routePolicyId,
      tag,
      textMode: input.textMode ?? null,
      profileKey,
      thresholds,
      autoSyncEnabled,
      autoSyncIntervalMinutes,
      autoEscalateEnabled,
      escalateSeverityThreshold,
      escalateAfterSyncCount,
      autoEscalateOwnerUserId,
      autoEscalateFollowUpStatus,
      autoRemediationEnabled,
      autoRemediationIntervalMinutes,
      autoRemediationDryRunFirst,
      autoRemediationActionKeys,
      autoRemediationMaxApplyRunsPerIncident,
      autoRemediationRequireAlertBeforeApply,
      autoRemediationFreezeOnProviderHealthDegrade,
      alertingEnabled,
      alertIntervalMinutes,
      notifyOperatorsOnEscalation,
      notifyOwnerOnEscalation,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: gatewayAnalysisAnomalyPolicies.id,
      set: {
        name: policyName,
        status,
        projectId,
        routePolicyId,
        tag,
        textMode: input.textMode ?? null,
        profileKey,
        thresholds,
        autoSyncEnabled,
        autoSyncIntervalMinutes,
        autoEscalateEnabled,
        escalateSeverityThreshold,
        escalateAfterSyncCount,
        autoEscalateOwnerUserId,
        autoEscalateFollowUpStatus,
        autoRemediationEnabled,
        autoRemediationIntervalMinutes,
        autoRemediationDryRunFirst,
        autoRemediationActionKeys,
        autoRemediationMaxApplyRunsPerIncident,
        autoRemediationRequireAlertBeforeApply,
        autoRemediationFreezeOnProviderHealthDegrade,
        alertingEnabled,
        alertIntervalMinutes,
        notifyOperatorsOnEscalation,
        notifyOwnerOnEscalation,
        updatedAt: timestamp,
      },
    });

  const row = await findGatewayAnalysisAnomalyPolicyRow(policyId);
  if (!row) {
    throw new NotFoundError("Gateway analysis anomaly policy 保存失败。");
  }
  return toGatewayAnalysisAnomalyPolicyView(row);
}

export async function syncGatewayAnalysisAnomalyPolicyForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  policyId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedPolicyId = policyId?.trim() ?? "";
  if (!normalizedPolicyId) {
    throw new ConflictError("policyId 不能为空。");
  }
  const policyRow = await findGatewayAnalysisAnomalyPolicyRow(normalizedPolicyId);
  if (!policyRow) {
    throw new NotFoundError("Gateway analysis anomaly policy 不存在。");
  }
  const sync = await syncGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    policyId: normalizedPolicyId,
  });
  const refreshedPolicy = await findGatewayAnalysisAnomalyPolicyRow(normalizedPolicyId);
  if (!refreshedPolicy) {
    throw new NotFoundError("Gateway analysis anomaly policy 同步后不存在。");
  }
  return {
    policy: toGatewayAnalysisAnomalyPolicyView(refreshedPolicy),
    sync,
  };
}

export async function sweepGatewayAnalysisAnomalyPoliciesForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyPolicyFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const startedAt = now();
  const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
  const candidates = await listGatewayAnalysisAnomalyPoliciesForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit,
  });
  const items: GatewayAnalysisAnomalyPolicySweepView["items"] = [];
  let okCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const policy of candidates) {
    if (policy.status !== "enabled" || !policy.autoSyncEnabled || !policy.syncDue) {
      skippedCount += 1;
      items.push({
        policyId: policy.id,
        policyName: policy.name,
        status: "skipped",
        error: null,
        lastSyncedAt: policy.lastSyncedAt,
        nextSyncDueAt: policy.nextSyncDueAt,
        syncDue: policy.syncDue,
        anomalyCount: 0,
        openedIncidentCount: 0,
        updatedIncidentCount: 0,
        resolvedIncidentCount: 0,
      });
      continue;
    }

    try {
      const result = await syncGatewayAnalysisAnomalyPolicyForOperator(operatorUserId, providerUserId, policy.id);
      okCount += 1;
      items.push({
        policyId: result.policy.id,
        policyName: result.policy.name,
        status: "ok",
        error: null,
        lastSyncedAt: result.policy.lastSyncedAt,
        nextSyncDueAt: result.policy.nextSyncDueAt,
        syncDue: result.policy.syncDue,
        anomalyCount: result.sync.report.anomalies.length,
        openedIncidentCount: result.sync.openedIncidentIds.length,
        updatedIncidentCount: result.sync.updatedIncidentIds.length,
        resolvedIncidentCount: result.sync.resolvedIncidentIds.length,
      });
    } catch (error) {
      errorCount += 1;
      items.push({
        policyId: policy.id,
        policyName: policy.name,
        status: "error",
        error: truncateErrorSummary(error instanceof Error ? error.message : String(error), 240),
        lastSyncedAt: policy.lastSyncedAt,
        nextSyncDueAt: policy.nextSyncDueAt,
        syncDue: policy.syncDue,
        anomalyCount: 0,
        openedIncidentCount: 0,
        updatedIncidentCount: 0,
        resolvedIncidentCount: 0,
      });
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    completedAt: now().toISOString(),
    limit,
    attemptedCount: items.length,
    okCount,
    errorCount,
    skippedCount,
    items,
  } satisfies GatewayAnalysisAnomalyPolicySweepView;
}

export async function getGatewayPersistedAnalysisExportDiffForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: { leftExportId?: string | null; rightExportId?: string | null } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const leftExportId = args.leftExportId?.trim() ?? "";
  const rightExportId = args.rightExportId?.trim() ?? "";
  if (!leftExportId || !rightExportId) {
    throw new ConflictError("leftExportId 与 rightExportId 都不能为空。");
  }

  const [leftExport, rightExport] = await Promise.all([
    getGatewayPersistedAnalysisExportForOperator(operatorUserId, providerUserId, leftExportId),
    getGatewayPersistedAnalysisExportForOperator(operatorUserId, providerUserId, rightExportId),
  ]);
  return buildGatewayAnalysisExportDiffForViews({
    leftExport,
    rightExport,
  });
}

export async function getGatewayAnalysisExportBaselineReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportBaselineReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = {
    ...filters,
    status: (filters.status?.trim() as GatewayPersistedAnalysisExportView["status"] | undefined) ?? "active",
    limit: Math.max(2, Math.min(filters.limit ?? 10, 50)),
  };
  const [exports, inventorySummary] = await Promise.all([
    listGatewayPersistedAnalysisExportsForOperator(operatorUserId, providerUserId, normalizedFilters),
    getGatewayPersistedAnalysisExportInventorySummaryForOperator(operatorUserId, providerUserId, normalizedFilters),
  ]);

  let diff: GatewayAnalysisExportDiffView | null = null;
  if (exports.length >= 2) {
    diff = await getGatewayPersistedAnalysisExportDiffForOperator(operatorUserId, providerUserId, {
      leftExportId: exports[1]?.exportId,
      rightExportId: exports[0]?.exportId,
    }).catch(() => null);
  }

  return buildGatewayAnalysisExportBaselineReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      tag: normalizedFilters.tag ?? null,
      projectId: normalizedFilters.projectId ?? null,
      status: normalizedFilters.status ?? null,
      textMode: normalizedFilters.textMode ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    exports,
    inventorySummary,
    diff,
  }) satisfies GatewayAnalysisExportBaselineReportView;
}

export async function getGatewayAnalysisExportTimelineReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportBaselineReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = {
    ...filters,
    status: (filters.status?.trim() as GatewayPersistedAnalysisExportView["status"] | undefined) ?? "active",
    limit: Math.max(2, Math.min(filters.limit ?? 5, 20)),
  };
  const [exports, inventorySummary] = await Promise.all([
    listGatewayPersistedAnalysisExportsForOperator(operatorUserId, providerUserId, normalizedFilters),
    getGatewayPersistedAnalysisExportInventorySummaryForOperator(operatorUserId, providerUserId, normalizedFilters),
  ]);

  const pairComparisons: GatewayAnalysisExportTimelinePairView[] = [];
  for (let index = 0; index < exports.length - 1; index += 1) {
    const newerExport = exports[index];
    const olderExport = exports[index + 1];
    if (!newerExport || !olderExport) {
      continue;
    }
    try {
      const diff = await buildGatewayAnalysisExportDiffForViews({
        leftExport: olderExport,
        rightExport: newerExport,
      });
      pairComparisons.push({
        newerExport,
        olderExport,
        diff,
        diffUnavailableReason: null,
      });
    } catch (error) {
      pairComparisons.push({
        newerExport,
        olderExport,
        diff: null,
        diffUnavailableReason: truncateErrorSummary(error instanceof Error ? error.message : String(error), 240),
      });
    }
  }

  return buildGatewayAnalysisExportTimelineReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      tag: normalizedFilters.tag ?? null,
      projectId: normalizedFilters.projectId ?? null,
      status: normalizedFilters.status ?? null,
      textMode: normalizedFilters.textMode ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    windowSize: normalizedFilters.limit,
    exports,
    inventorySummary,
    pairComparisons,
  }) satisfies GatewayAnalysisExportTimelineReportView;
}

export async function getGatewayAnalysisExportTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportBaselineReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = {
    ...filters,
    status: (filters.status?.trim() as GatewayPersistedAnalysisExportView["status"] | undefined) ?? "active",
    limit: Math.max(1, Math.min(filters.limit ?? 10, 50)),
  };
  const [exports, inventorySummary] = await Promise.all([
    listGatewayPersistedAnalysisExportsForOperator(operatorUserId, providerUserId, normalizedFilters),
    getGatewayPersistedAnalysisExportInventorySummaryForOperator(operatorUserId, providerUserId, normalizedFilters),
  ]);
  const points = await Promise.all(exports.map((item) => buildGatewayAnalysisExportTrendPoint(item)));

  return buildGatewayAnalysisExportTrendReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      tag: normalizedFilters.tag ?? null,
      projectId: normalizedFilters.projectId ?? null,
      status: normalizedFilters.status ?? null,
      textMode: normalizedFilters.textMode ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    windowSize: normalizedFilters.limit,
    inventorySummary,
    points,
  }) satisfies GatewayAnalysisExportTrendReportView;
}

export async function getGatewayAnalysisExportAnomalyReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportAnomalyReportFilters = {},
) {
  const context = await resolveGatewayAnalysisAnomalyEvaluationContextForOperator(operatorUserId, providerUserId, filters);
  const trendReport = await getGatewayAnalysisExportTrendReportForOperator(operatorUserId, providerUserId, context.filters);
  return buildGatewayAnalysisExportAnomalyReport({
    trendReport,
    profileKey: context.profileKey,
    thresholds: context.thresholds,
  }) satisfies GatewayAnalysisExportAnomalyReportView;
}

function buildGatewayAnalysisAnomalyIncidentScopeWhere(args: {
  policyId?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  tag?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
}) {
  return and(
    args.policyId?.trim()
      ? eq(gatewayAnalysisAnomalyIncidents.policyId, args.policyId.trim())
      : isNull(gatewayAnalysisAnomalyIncidents.policyId),
    args.projectId?.trim()
      ? eq(gatewayAnalysisAnomalyIncidents.projectId, args.projectId.trim())
      : isNull(gatewayAnalysisAnomalyIncidents.projectId),
    args.routePolicyId?.trim()
      ? eq(gatewayAnalysisAnomalyIncidents.routePolicyId, args.routePolicyId.trim())
      : isNull(gatewayAnalysisAnomalyIncidents.routePolicyId),
    args.tag?.trim() ? eq(gatewayAnalysisAnomalyIncidents.tag, args.tag.trim()) : isNull(gatewayAnalysisAnomalyIncidents.tag),
    args.textMode ? eq(gatewayAnalysisAnomalyIncidents.textMode, args.textMode) : isNull(gatewayAnalysisAnomalyIncidents.textMode),
  );
}

export async function listGatewayAnalysisAnomalyIncidentsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyIncidentFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const rows = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(
      and(
        filters.incidentId?.trim() ? eq(gatewayAnalysisAnomalyIncidents.id, filters.incidentId.trim()) : undefined,
        filters.policyId?.trim() ? eq(gatewayAnalysisAnomalyIncidents.policyId, filters.policyId.trim()) : undefined,
        filters.projectId?.trim() ? eq(gatewayAnalysisAnomalyIncidents.projectId, filters.projectId.trim()) : undefined,
        filters.routePolicyId?.trim()
          ? eq(gatewayAnalysisAnomalyIncidents.routePolicyId, filters.routePolicyId.trim())
          : undefined,
        filters.ownerUserId?.trim() ? eq(gatewayAnalysisAnomalyIncidents.ownerUserId, filters.ownerUserId.trim()) : undefined,
        filters.tag?.trim() ? eq(gatewayAnalysisAnomalyIncidents.tag, filters.tag.trim().toLowerCase()) : undefined,
        filters.textMode ? eq(gatewayAnalysisAnomalyIncidents.textMode, filters.textMode) : undefined,
        filters.status?.trim() ? eq(gatewayAnalysisAnomalyIncidents.status, filters.status.trim()) : undefined,
        filters.followUpStatus?.trim()
          ? eq(gatewayAnalysisAnomalyIncidents.followUpStatus, filters.followUpStatus.trim())
          : undefined,
        filters.escalationStatus?.trim()
          ? eq(gatewayAnalysisAnomalyIncidents.escalationStatus, filters.escalationStatus.trim())
          : undefined,
        filters.code?.trim() ? eq(gatewayAnalysisAnomalyIncidents.code, filters.code.trim()) : undefined,
        filters.severity?.trim() ? eq(gatewayAnalysisAnomalyIncidents.severity, filters.severity.trim()) : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyIncidents.updatedAt))
    .limit(limit);
  return rows.map((row) => toGatewayAnalysisAnomalyIncidentView(row));
}

export async function getGatewayAnalysisAnomalyIncidentSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyIncidentFilters = {},
) {
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(filters.limit ?? 200, 200),
  });
  return buildGatewayAnalysisAnomalyIncidentSummary(incidents) satisfies GatewayAnalysisAnomalyIncidentSummaryView;
}

export async function listGatewayAnalysisAnomalyIncidentHistoryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyIncidentHistoryFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const incidentId = filters.incidentId?.trim() ?? "";
  if (!incidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const [incidentRow] = await db
    .select({ id: gatewayAnalysisAnomalyIncidents.id })
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, incidentId))
    .limit(1);
  if (!incidentRow) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 1_000));
  const rows = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidentHistory)
    .where(eq(gatewayAnalysisAnomalyIncidentHistory.incidentId, incidentId))
    .orderBy(desc(gatewayAnalysisAnomalyIncidentHistory.createdAt))
    .limit(limit);
  return rows.map((row) => toGatewayAnalysisAnomalyIncidentHistoryView(row));
}

export async function getGatewayAnalysisAnomalyIncidentRemediationPlanForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
) {
  const context = await loadGatewayAnalysisAnomalyIncidentRemediationContextForOperator(
    operatorUserId,
    providerUserId,
    incidentId,
  );
  return context.plan;
}

async function loadGatewayAnalysisAnomalyIncidentLatestSyncContext(incidentId: string) {
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidentHistory)
    .where(
      and(
        eq(gatewayAnalysisAnomalyIncidentHistory.incidentId, incidentId),
        inArray(gatewayAnalysisAnomalyIncidentHistory.eventType, ["sync_opened", "sync_updated"]),
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyIncidentHistory.createdAt))
    .limit(1);

  const metadata =
    row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  return {
    entityKey: typeof metadata?.entityKey === "string" ? metadata.entityKey : null,
    snapshotId: typeof metadata?.snapshotId === "string" ? metadata.snapshotId : null,
  };
}

async function loadGatewayAnalysisAnomalyIncidentRemediationContextForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    incidentId: normalizedIncidentId,
    limit: 1,
  });
  const incident = incidents[0];
  if (!incident) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const policyRow = incident.policyId ? await findGatewayAnalysisAnomalyPolicyRow(incident.policyId).catch(() => null) : null;
  const policy = policyRow ? toGatewayAnalysisAnomalyPolicyView(policyRow) : null;
  const resolvedRoutePolicyId = policy?.routePolicyId ?? incident.routePolicyId ?? null;
  const routePolicyRow = resolvedRoutePolicyId ? await findGatewayRoutePolicyRow(resolvedRoutePolicyId).catch(() => null) : null;
  const routePolicy = routePolicyRow ? toGatewayRoutePolicyView(routePolicyRow) : null;
  const incidentContext = await loadGatewayAnalysisAnomalyIncidentLatestSyncContext(incident.id);
  const plan = buildGatewayAnalysisAnomalyIncidentRemediationPlan({
    generatedAt: now().toISOString(),
    incident,
    policy,
    routePolicy,
    incidentContext,
  }) satisfies GatewayAnalysisAnomalyIncidentRemediationPlanView;
  return {
    incident,
    policy,
    routePolicy,
    incidentContext,
    plan,
  };
}

export async function listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationRunFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const rows = await db
    .select()
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(
      and(
        filters.incidentId ? eq(gatewayAnalysisAnomalyRemediationRuns.incidentId, filters.incidentId) : undefined,
        filters.policyId ? eq(gatewayAnalysisAnomalyRemediationRuns.policyId, filters.policyId) : undefined,
        filters.routePolicyId ? eq(gatewayAnalysisAnomalyRemediationRuns.routePolicyId, filters.routePolicyId) : undefined,
        filters.actionKey ? eq(gatewayAnalysisAnomalyRemediationRuns.actionKey, filters.actionKey) : undefined,
        filters.status ? eq(gatewayAnalysisAnomalyRemediationRuns.status, filters.status) : undefined,
        filters.executionMode ? eq(gatewayAnalysisAnomalyRemediationRuns.executionMode, filters.executionMode) : undefined,
        typeof filters.dryRun === "boolean" ? eq(gatewayAnalysisAnomalyRemediationRuns.dryRun, filters.dryRun) : undefined,
        createdFrom ? gte(gatewayAnalysisAnomalyRemediationRuns.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayAnalysisAnomalyRemediationRuns.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyRemediationRuns.createdAt))
    .limit(limit);
  return rows.map((row) => toGatewayAnalysisAnomalyRemediationRunView(row));
}

async function findGatewayAnalysisAnomalyRemediationRunRow(runId: string) {
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(eq(gatewayAnalysisAnomalyRemediationRuns.id, runId))
    .limit(1);
  return row ?? null;
}

function normalizeGatewayAnalysisRemediationImpactWindowMinutes(value: number | null | undefined) {
  return Math.max(5, Math.min(value ?? 180, 10_080));
}

function buildGatewayAnalysisAnomalyRemediationImpactCapturePayload(args: {
  capturedAt: string;
  windowMinutes: number;
  impact: GatewayAnalysisAnomalyRemediationRunImpactView;
}) {
  return {
    capturedAt: args.capturedAt,
    windowMinutes: args.windowMinutes,
    impact: args.impact,
  } satisfies Record<string, unknown>;
}

export async function getGatewayAnalysisAnomalyRemediationRunSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationRunFilters = {},
) {
  const runs = await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 500, 500)),
  });
  return buildGatewayAnalysisAnomalyRemediationRunSummary({
    runs,
  }) satisfies GatewayAnalysisAnomalyRemediationRunSummaryView;
}

export async function getGatewayAnalysisAnomalyRemediationRunImpactForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  runId?: string | null,
  options?: { windowMinutes?: number | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedRunId = runId?.trim() ?? "";
  if (!normalizedRunId) {
    throw new ConflictError("runId 不能为空。");
  }

  const row = await findGatewayAnalysisAnomalyRemediationRunRow(normalizedRunId);
  if (!row) {
    throw new NotFoundError("Gateway anomaly remediation run 不存在。");
  }

  const run = toGatewayAnalysisAnomalyRemediationRunView(row);
  const incident = run.afterIncident ?? run.beforeIncident ?? null;
  const projectId = incident?.projectId ?? null;
  if (!projectId) {
    throw new ConflictError("当前 remediation run 缺少 project 作用域，无法计算影响面。");
  }
  const routePolicyId = run.afterRoutePolicy?.id ?? run.beforeRoutePolicy?.id ?? run.routePolicyId ?? null;
  const windowMinutes = normalizeGatewayAnalysisRemediationImpactWindowMinutes(options?.windowMinutes);
  const anchorAt = new Date(run.completedAt ?? run.createdAt);
  if (Number.isNaN(anchorAt.getTime())) {
    throw new ConflictError("当前 remediation run 缺少合法的时间锚点。");
  }

  const beforeStartedAt = new Date(anchorAt.getTime() - windowMinutes * 60_000);
  const beforeEndedAt = anchorAt;
  const afterStartedAt = anchorAt;
  const afterEndedAt = new Date(anchorAt.getTime() + windowMinutes * 60_000);

  const [beforeSummary, afterSummary] = await Promise.all([
    getGatewayAnalysisSummaryForOperator(operatorUserId, providerUserId, {
      projectId,
      routePolicyId,
      createdFrom: beforeStartedAt.toISOString(),
      createdTo: beforeEndedAt.toISOString(),
      limit: 1_000,
    }),
    getGatewayAnalysisSummaryForOperator(operatorUserId, providerUserId, {
      projectId,
      routePolicyId,
      createdFrom: afterStartedAt.toISOString(),
      createdTo: afterEndedAt.toISOString(),
      limit: 1_000,
    }),
  ]);

  return buildGatewayAnalysisAnomalyRemediationRunImpact({
    generatedAt: now().toISOString(),
    run,
    incident,
    projectId,
    routePolicyId,
    anchorAt: anchorAt.toISOString(),
    windowMinutes,
    beforeWindow: {
      startedAt: beforeStartedAt.toISOString(),
      endedAt: beforeEndedAt.toISOString(),
      summary: beforeSummary,
    },
    afterWindow: {
      startedAt: afterStartedAt.toISOString(),
      endedAt: afterEndedAt.toISOString(),
      summary: afterSummary,
    },
  }) satisfies GatewayAnalysisAnomalyRemediationRunImpactView;
}

export async function captureGatewayAnalysisAnomalyRemediationRunImpactForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  runId?: string | null,
  options?: { windowMinutes?: number | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const impact = await getGatewayAnalysisAnomalyRemediationRunImpactForOperator(
    operatorUserId,
    providerUserId,
    runId,
    options,
  );

  const runRow = await findGatewayAnalysisAnomalyRemediationRunRow(impact.run.id);
  if (!runRow) {
    throw new NotFoundError("Gateway anomaly remediation run 不存在。");
  }

  const resultPayload =
    runRow.result && typeof runRow.result === "object" ? { ...(runRow.result as Record<string, unknown>) } : {};
  resultPayload.impactCapture = buildGatewayAnalysisAnomalyRemediationImpactCapturePayload({
    capturedAt: impact.generatedAt,
    windowMinutes: impact.windowMinutes,
    impact,
  });

  const [updated] = await db
    .update(gatewayAnalysisAnomalyRemediationRuns)
    .set({
      result: resultPayload,
    })
    .where(eq(gatewayAnalysisAnomalyRemediationRuns.id, impact.run.id))
    .returning();

  if (impact.incident) {
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: impact.incident.id,
      eventType: "remediation_impact_captured",
      actorUserId: operatorUserId,
      note: `Captured remediation impact over ${impact.windowMinutes} minutes.`,
      metadata: {
        ...buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: impact.incident.policyId,
          projectId: impact.incident.projectId,
          routePolicyId: impact.incident.routePolicyId,
          tag: impact.incident.tag,
          textMode: impact.incident.textMode,
          code: impact.incident.code,
          severity: impact.incident.severity,
          status: impact.incident.status,
          ownerUserId: impact.incident.ownerUserId,
          followUpStatus: impact.incident.followUpStatus,
          syncHitCount: impact.incident.syncHitCount,
          escalationStatus: impact.incident.escalationStatus,
          escalatedAt: impact.incident.escalatedAt,
          escalationReason: impact.incident.escalationReason,
          latestExportId: impact.incident.latestExportId,
          previousExportId: impact.incident.previousExportId,
          latestValue: impact.incident.latestValue,
          previousValue: impact.incident.previousValue,
          deltaValue: impact.incident.deltaValue,
          deltaRatio: impact.incident.deltaRatio,
          thresholdValue: impact.incident.thresholdValue,
        }),
        remediationRunId: impact.run.id,
        routePolicyId: impact.routePolicyId,
        windowMinutes: impact.windowMinutes,
        completionRateDelta: impact.metrics.completionRate.deltaValue,
        failureRateDelta: impact.metrics.failureRate.deltaValue,
        requestArtifactCoverageDelta: impact.metrics.requestArtifactCoverage.deltaValue,
        responseArtifactCoverageDelta: impact.metrics.responseArtifactCoverage.deltaValue,
        firstTokenLatencyMsAvgDelta: impact.metrics.firstTokenLatencyMsAvg.deltaValue,
        totalTokensPerSampleDelta: impact.metrics.totalTokensPerSample.deltaValue,
      },
    });
  }

  return {
    run: toGatewayAnalysisAnomalyRemediationRunView(updated ?? runRow),
    impact,
  };
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationRunFilters = {},
  options?: { windowMinutes?: number | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const windowMinutes = normalizeGatewayAnalysisRemediationImpactWindowMinutes(options?.windowMinutes);
  const runs = await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 100, 200)),
  });

  const impacts = await Promise.all(
    runs.map(async (run) => {
      if (run.status !== "applied") {
        return null;
      }
      const cachedImpact =
        run.result &&
        typeof run.result === "object" &&
        (run.result as Record<string, unknown>).impactCapture &&
        typeof (run.result as Record<string, unknown>).impactCapture === "object"
          ? (((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>).windowMinutes ===
              windowMinutes &&
            ((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>).impact &&
            typeof ((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>).impact === "object")
            ? (((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>)
                .impact as GatewayAnalysisAnomalyRemediationRunImpactView)
            : null
          : null;
      if (cachedImpact) {
        return cachedImpact;
      }
      try {
        return await getGatewayAnalysisAnomalyRemediationRunImpactForOperator(
          operatorUserId,
          providerUserId,
          run.id,
          { windowMinutes },
        );
      } catch {
        return null;
      }
    }),
  );

  return buildGatewayAnalysisAnomalyRemediationEffectivenessSummary({
    generatedAt: now().toISOString(),
    windowMinutes,
    runs,
    impacts,
  }) satisfies GatewayAnalysisAnomalyRemediationEffectivenessSummaryView;
}

function buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilterView(args: {
  filters: GatewayAnalysisAnomalyRemediationRunFilters;
  limit: number;
  lookbackHours: number | null;
  windowMinutes: number;
}): GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView["filters"] {
  const normalizedStatus =
    args.filters.status === "dry_run" || args.filters.status === "applied" || args.filters.status === "failed"
      ? args.filters.status
      : null;
  const normalizedExecutionMode =
    args.filters.executionMode === "informational" ||
    args.filters.executionMode === "incident_follow_up" ||
    args.filters.executionMode === "route_policy_patch"
      ? args.filters.executionMode
      : null;
  return {
    incidentId: args.filters.incidentId?.trim() ?? null,
    policyId: args.filters.policyId?.trim() ?? null,
    routePolicyId: args.filters.routePolicyId?.trim() ?? null,
    actionKey: args.filters.actionKey?.trim() ?? null,
    status: normalizedStatus,
    executionMode: normalizedExecutionMode,
    dryRun: typeof args.filters.dryRun === "boolean" ? args.filters.dryRun : null,
    createdFrom: args.filters.createdFrom?.trim() ?? null,
    createdTo: args.filters.createdTo?.trim() ?? null,
    limit: args.limit,
    lookbackHours: args.lookbackHours,
    windowMinutes: args.windowMinutes,
  };
}

function buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilterView(args: {
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters;
  limit: number;
  lookbackHours: number | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
}): GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView["filters"] {
  return {
    label: args.filters.label?.trim() || null,
    routePolicyId: args.filters.routePolicyId?.trim() || null,
    actionKey: args.filters.actionKey?.trim() || null,
    createdFrom: args.filters.createdFrom?.trim() || null,
    createdTo: args.filters.createdTo?.trim() || null,
    limit: args.limit,
    lookbackHours: args.lookbackHours,
    profileKey: args.profileKey,
  };
}

function matchesGatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters(
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters,
  createdFrom: Date | null,
  createdTo: Date | null,
) {
  if (filters.snapshotId?.trim() && snapshot.snapshotId !== filters.snapshotId.trim()) {
    return false;
  }
  if (filters.label?.trim()) {
    const needle = filters.label.trim().toLowerCase();
    const haystack = snapshot.label?.trim().toLowerCase() ?? "";
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  if (filters.routePolicyId?.trim() && snapshot.filters.routePolicyId !== filters.routePolicyId.trim()) {
    return false;
  }
  if (filters.actionKey?.trim() && snapshot.filters.actionKey !== filters.actionKey.trim()) {
    return false;
  }
  const createdAt = new Date(snapshot.createdAt);
  if (createdFrom && createdAt < createdFrom) {
    return false;
  }
  if (createdTo && createdAt > createdTo) {
    return false;
  }
  return true;
}

async function readGatewayAnalysisAnomalyRemediationEffectivenessSnapshot(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView;
}

function matchesGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters(
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters,
  createdFrom: Date | null,
  createdTo: Date | null,
) {
  if (filters.snapshotId?.trim() && snapshot.snapshotId !== filters.snapshotId.trim()) {
    return false;
  }
  if (filters.label?.trim()) {
    const needle = filters.label.trim().toLowerCase();
    const haystack = snapshot.label?.trim().toLowerCase() ?? "";
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  if (filters.routePolicyId?.trim() && snapshot.filters.routePolicyId !== filters.routePolicyId.trim()) {
    return false;
  }
  if (filters.actionKey?.trim() && snapshot.filters.actionKey !== filters.actionKey.trim()) {
    return false;
  }
  if (filters.profileKey?.trim()) {
    const expected = normalizeGatewayAnalysisAnomalyProfileKey(filters.profileKey);
    if (snapshot.filters.profileKey !== expected) {
      return false;
    }
  }
  const createdAt = new Date(snapshot.createdAt);
  if (createdFrom && createdAt < createdFrom) {
    return false;
  }
  if (createdTo && createdAt > createdTo) {
    return false;
  }
  return true;
}

async function readGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshot(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView;
}

export async function persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayAnalysisAnomalyRemediationRunFilters & {
    label?: string | null;
    windowMinutes?: number | null;
    lookbackHours?: number | null;
  } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const windowMinutes = normalizeGatewayAnalysisRemediationImpactWindowMinutes(args.windowMinutes);
  const lookbackHours = normalizeNonNegativeInt(args.lookbackHours, null, 24 * 365);
  const createdFrom =
    args.createdFrom?.trim() ||
    (lookbackHours != null ? new Date(timestamp.getTime() - lookbackHours * 60 * 60 * 1000).toISOString() : null);
  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  const summary = await getGatewayAnalysisAnomalyRemediationEffectivenessForOperator(
    operatorUserId,
    providerUserId,
    {
      ...args,
      createdFrom,
      limit,
    },
    {
      windowMinutes,
    },
  );

  const snapshotId = randomUUID();
  const objectKey = buildGatewayAnalysisRemediationEffectivenessSnapshotObjectKey(snapshotId);
  const snapshot = {
    snapshotId,
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.label),
    createdAt: timestamp.toISOString(),
    objectKey,
    filters: buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilterView({
      filters: {
        ...args,
        createdFrom,
      },
      limit,
      lookbackHours,
      windowMinutes,
    }),
    summary,
  } satisfies GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView;

  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), "application/json");
  return snapshot;
}

export async function listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const snapshotKeys = (await listGatewayObjects("ai-gateway/remediation-effectiveness-snapshots")).filter((key) =>
    key.endsWith("/snapshot.json"),
  );
  const snapshots: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView[] = [];
  for (const objectKey of snapshotKeys) {
    const snapshot = await readGatewayAnalysisAnomalyRemediationEffectivenessSnapshot(objectKey).catch(() => null);
    if (!snapshot) {
      continue;
    }
    if (!matchesGatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters(snapshot, filters, createdFrom, createdTo)) {
      continue;
    }
    snapshots.push(snapshot);
  }
  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSnapshotId = snapshotId?.trim() ?? "";
  if (!normalizedSnapshotId) {
    throw new ConflictError("snapshotId 不能为空。");
  }
  const objectKey = buildGatewayAnalysisRemediationEffectivenessSnapshotObjectKey(normalizedSnapshotId);
  const snapshot = await readGatewayAnalysisAnomalyRemediationEffectivenessSnapshot(objectKey).catch(() => null);
  if (!snapshot) {
    throw new NotFoundError("Gateway remediation effectiveness snapshot 不存在。");
  }
  return snapshot;
}

function normalizeGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters(
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters = {},
) {
  return {
    snapshotId: filters.snapshotId ?? null,
    label: filters.label ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    actionKey: filters.actionKey ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    limit: Math.max(1, Math.min(filters.limit ?? 10, 50)),
  } satisfies GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters;
}

async function resolveGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyContext(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const profileKey = normalizeGatewayAnalysisAnomalyProfileKey(filters.profileKey);
  const thresholds = buildGatewayAnalysisAnomalyRemediationEffectivenessThresholdConfig(profileKey, {
    ...buildGatewayAnalysisRemediationEffectivenessAnomalyThresholdOverrides(filters),
  });

  return {
    profileKey,
    thresholds,
    filters: normalizeGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters(filters),
  };
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const snapshots = await listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator(
    operatorUserId,
    providerUserId,
    {
      ...filters,
      limit: Math.max(1, Math.min(filters.limit ?? 500, 500)),
    },
  );
  return buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummary({
    snapshots,
  }) satisfies GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView;
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = normalizeGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters(filters);
  const [snapshots, inventorySummary] = await Promise.all([
    listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator(
      operatorUserId,
      providerUserId,
      normalizedFilters,
    ),
    getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator(
      operatorUserId,
      providerUserId,
      {
        ...normalizedFilters,
        limit: 500,
      },
    ),
  ]);
  const points = snapshots.map((snapshot) =>
    buildGatewayAnalysisAnomalyRemediationEffectivenessTrendPoint(snapshot),
  );

  return buildGatewayAnalysisAnomalyRemediationEffectivenessTrendReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      routePolicyId: normalizedFilters.routePolicyId ?? null,
      actionKey: normalizedFilters.actionKey ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    windowSize: normalizedFilters.limit,
    inventorySummary,
    points,
  }) satisfies GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView;
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters = {},
) {
  const context = await resolveGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyContext(
    operatorUserId,
    providerUserId,
    filters,
  );
  const trendReport = await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator(
    operatorUserId,
    providerUserId,
    context.filters,
  );
  return buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalyReport({
    trendReport,
    profileKey: context.profileKey,
    thresholds: context.thresholds,
  }) satisfies GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView;
}

export async function persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters & {
    label?: string | null;
    lookbackHours?: number | null;
  } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const lookbackHours = normalizeNonNegativeInt(args.lookbackHours, null, 24 * 365);
  const createdFrom =
    args.createdFrom?.trim() ||
    (lookbackHours != null ? new Date(timestamp.getTime() - lookbackHours * 60 * 60 * 1000).toISOString() : null);
  const normalizedFilters = {
    ...args,
    createdFrom,
    limit: Math.max(1, Math.min(args.limit ?? 10, 50)),
  } satisfies GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters;
  const report = await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator(
    operatorUserId,
    providerUserId,
    normalizedFilters,
  );
  const snapshotId = randomUUID();
  const objectKey = buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotObjectKey(snapshotId);
  const snapshot = {
    snapshotId,
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.label),
    createdAt: timestamp.toISOString(),
    objectKey,
    filters: buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilterView({
      filters: normalizedFilters,
      limit: normalizedFilters.limit ?? 10,
      lookbackHours,
      profileKey: report.profileKey,
    }),
    report,
  } satisfies GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView;

  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), "application/json");
  return snapshot;
}

export async function listGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const snapshotKeys = (await listGatewayObjects("ai-gateway/remediation-effectiveness-anomaly-snapshots")).filter(
    (key) => key.endsWith("/snapshot.json"),
  );
  const snapshots: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView[] = [];
  for (const objectKey of snapshotKeys) {
    const snapshot = await readGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshot(objectKey).catch(() => null);
    if (!snapshot) {
      continue;
    }
    if (
      !matchesGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters(
        snapshot,
        filters,
        createdFrom,
        createdTo,
      )
    ) {
      continue;
    }
    snapshots.push(snapshot);
  }
  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSnapshotId = snapshotId?.trim() ?? "";
  if (!normalizedSnapshotId) {
    throw new ConflictError("snapshotId 不能为空。");
  }
  const objectKey = buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotObjectKey(normalizedSnapshotId);
  const snapshot = await readGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshot(objectKey).catch(() => null);
  if (!snapshot) {
    throw new NotFoundError("Gateway remediation effectiveness anomaly snapshot 不存在。");
  }
  return snapshot;
}

function buildGatewayAnalysisAnomalyRemediationExecutionInputFromAction(
  action: GatewayAnalysisAnomalyIncidentRemediationActionView,
  status: GatewayAnalysisAnomalyRemediationRunStatus,
): ExecuteGatewayAnalysisAnomalyIncidentRemediationInput {
  const base = {
    actionKey: action.actionKey,
    dryRun: status === "dry_run",
  } satisfies ExecuteGatewayAnalysisAnomalyIncidentRemediationInput;
  const defaults = action.defaultExecutionInput ?? null;
  if (!defaults || typeof defaults !== "object") {
    return base;
  }
  return {
    ...base,
    ...(defaults as Omit<ExecuteGatewayAnalysisAnomalyIncidentRemediationInput, "actionKey" | "dryRun">),
  };
}

export async function listGatewayAnalysisAnomalyRemediationQueueForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationQueueFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const dueOnly = filters.dueOnly === true;
  const referenceTime = now();
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    ...filters,
    escalationStatus: "escalated",
    limit: Math.max(limit, 200),
  });

  const items: GatewayAnalysisAnomalyIncidentRemediationQueueItemView[] = [];
  for (const incident of incidents) {
    const context = await loadGatewayAnalysisAnomalyIncidentRemediationContextForOperator(
      operatorUserId,
      providerUserId,
      incident.id,
    );
    const policyConfig = resolveGatewayAnalysisAnomalyIncidentAutoRemediationConfig(
      context.policy,
      incident,
      context.routePolicy,
    );
    for (const action of context.plan.actions) {
      if (!action.executable) {
        continue;
      }
      if (filters.actionKey?.trim() && action.actionKey !== filters.actionKey.trim()) {
        continue;
      }
      if (filters.executionMode?.trim() && action.executionMode !== filters.executionMode.trim()) {
        continue;
      }
      const actionAllowed =
        !policyConfig.autoRemediationActionKeys ||
        policyConfig.autoRemediationActionKeys.includes(action.actionKey);
      const latestRun = await findLatestGatewayAnalysisAnomalyRemediationRun(incident.id, action.actionKey);
      const appliedRunCount = await countGatewayAnalysisAnomalyRemediationRunsByStatus(
        incident.id,
        action.actionKey,
        "applied",
      );
      const providerHealthDegraded = await readGatewayRoutePolicyHealthDegraded(context.routePolicy);
      const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
        incidentStatus: incident.status,
        escalationStatus: incident.escalationStatus,
        autoRemediationEnabled: policyConfig.autoRemediationEnabled,
        actionEnabled: actionAllowed,
        autoRemediationIntervalMinutes: policyConfig.autoRemediationIntervalMinutes,
        autoRemediationDryRunFirst: policyConfig.autoRemediationDryRunFirst,
        autoRemediationMaxApplyRunsPerIncident: policyConfig.autoRemediationMaxApplyRunsPerIncident,
        autoRemediationRequireAlertBeforeApply: policyConfig.autoRemediationRequireAlertBeforeApply,
        autoRemediationFreezeOnProviderHealthDegrade: policyConfig.autoRemediationFreezeOnProviderHealthDegrade,
        appliedRunCount,
        lastAlertedAt: incident.lastAlertedAt,
        providerHealthDegraded,
        latestRunStatus: latestRun?.status ?? null,
        latestRunDryRun: latestRun?.dryRun ?? null,
        latestRunCompletedAt: latestRun?.completedAt ?? null,
        latestRunCreatedAt: latestRun?.createdAt ?? null,
        now: referenceTime,
      });
      if (dueOnly && !schedule.remediationDue) {
        continue;
      }
      items.push({
        incident,
        policy: context.policy,
        routePolicy: context.routePolicy,
        action,
        remediationDue: schedule.remediationDue,
        nextExecutionStatus: schedule.nextExecutionStatus,
        nextRunDueAt: schedule.nextRunDueAt,
        blockedReason: schedule.blockedReason,
        latestRun,
      });
    }
  }

  const sortedItems = items
    .sort((left, right) => {
      if (left.remediationDue !== right.remediationDue) {
        return left.remediationDue ? -1 : 1;
      }
      if (left.incident.severity !== right.incident.severity) {
        return left.incident.severity === "critical" ? -1 : 1;
      }
      return right.incident.updatedAt.localeCompare(left.incident.updatedAt);
    })
    .slice(0, limit);

  return {
    generatedAt: referenceTime.toISOString(),
    limit,
    dueOnly,
    itemCount: sortedItems.length,
    dueCount: sortedItems.filter((item) => item.remediationDue).length,
    items: sortedItems,
  } satisfies GatewayAnalysisAnomalyIncidentRemediationQueueView;
}

export async function sweepGatewayAnalysisAnomalyRemediationsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationQueueFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const startedAt = now();
  const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
  const queue = await listGatewayAnalysisAnomalyRemediationQueueForOperator(operatorUserId, providerUserId, {
    ...filters,
    dueOnly: true,
    limit,
  });
  const items: GatewayAnalysisAnomalyRemediationSweepView["items"] = [];
  let dryRunCount = 0;
  let appliedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const item of queue.items) {
    if (!item.remediationDue || !item.nextExecutionStatus) {
      skippedCount += 1;
      items.push({
        incidentId: item.incident.id,
        actionKey: item.action.actionKey,
        status: "skipped",
        executionStatus: null,
        runId: null,
        error: null,
      });
      continue;
    }
    try {
      const run = await executeGatewayAnalysisAnomalyIncidentRemediationForOperator(
        operatorUserId,
        providerUserId,
        item.incident.id,
        buildGatewayAnalysisAnomalyRemediationExecutionInputFromAction(item.action, item.nextExecutionStatus),
      );
      if (run.status === "dry_run") {
        dryRunCount += 1;
      } else {
        appliedCount += 1;
      }
      items.push({
        incidentId: item.incident.id,
        actionKey: item.action.actionKey,
        status: "ok",
        executionStatus: run.status,
        runId: run.id,
        error: null,
      });
    } catch (error) {
      errorCount += 1;
      items.push({
        incidentId: item.incident.id,
        actionKey: item.action.actionKey,
        status: "error",
        executionStatus: item.nextExecutionStatus,
        runId: null,
        error: truncateErrorSummary(error instanceof Error ? error.message : String(error), 240),
      });
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    completedAt: now().toISOString(),
    limit,
    attemptedCount: queue.items.length,
    dryRunCount,
    appliedCount,
    errorCount,
    skippedCount,
    items,
  } satisfies GatewayAnalysisAnomalyRemediationSweepView;
}

function buildGatewayAnalysisAnomalyIncidentRemediationRunResult(args: {
  action: GatewayAnalysisAnomalyIncidentRemediationActionView;
  status: GatewayAnalysisAnomalyRemediationRunStatus;
  changedFields?: string[];
  summary?: string | null;
}) {
  return {
    actionKey: args.action.actionKey,
    executionMode: args.action.executionMode,
    status: args.status,
    changedFields: args.changedFields ?? [],
    summary: args.summary ?? null,
  } satisfies Record<string, unknown>;
}

export async function executeGatewayAnalysisAnomalyIncidentRemediationForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
  input: ExecuteGatewayAnalysisAnomalyIncidentRemediationInput = { actionKey: "" },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const actionKey = input.actionKey?.trim() ?? "";
  if (!actionKey) {
    throw new ConflictError("actionKey 不能为空。");
  }

  const context = await loadGatewayAnalysisAnomalyIncidentRemediationContextForOperator(
    operatorUserId,
    providerUserId,
    incidentId,
  );
  const action = context.plan.actions.find((item) => item.actionKey === actionKey);
  if (!action) {
    throw new ConflictError(`incident 当前不存在 remediation action: ${actionKey}`);
  }
  if (!action.executable || action.executionMode === "informational") {
    throw new ConflictError(`remediation action ${action.actionKey} 仅提供建议，当前不支持直接执行。`);
  }

  const timestamp = now();
  const dryRun = input.dryRun === true;
  const runId = randomUUID();
  const note = normalizeOptionalText(input.note, 2_000);
  const beforeIncident = context.incident;
  const beforeRoutePolicy = context.routePolicy;

  let afterIncident: GatewayAnalysisAnomalyIncidentView | null = beforeIncident;
  let afterRoutePolicy: GatewayRoutePolicyView | null = beforeRoutePolicy;
  let resultPayload: Record<string, unknown> | null = null;
  let errorSummary: string | null = null;
  let runStatus: GatewayAnalysisAnomalyRemediationRunStatus = dryRun ? "dry_run" : "applied";

  try {
    if (action.executionMode === "incident_follow_up") {
      const requestedFollowUp = input.incidentFollowUp ?? {};
      const resolvedFollowUp = {
        ownerUserId: Object.prototype.hasOwnProperty.call(requestedFollowUp, "ownerUserId")
          ? requestedFollowUp.ownerUserId ?? null
          : beforeIncident.ownerUserId,
        followUpStatus: Object.prototype.hasOwnProperty.call(requestedFollowUp, "followUpStatus")
          ? requestedFollowUp.followUpStatus ?? beforeIncident.followUpStatus
          : beforeIncident.followUpStatus === "pending"
            ? "investigating"
            : beforeIncident.followUpStatus,
        note: Object.prototype.hasOwnProperty.call(requestedFollowUp, "note")
          ? requestedFollowUp.note ?? null
          : beforeIncident.latestNote,
        resolutionNote: Object.prototype.hasOwnProperty.call(requestedFollowUp, "resolutionNote")
          ? requestedFollowUp.resolutionNote ?? null
          : beforeIncident.resolutionNote,
      };
      if (dryRun) {
        afterIncident = {
          ...beforeIncident,
          ownerUserId: resolvedFollowUp.ownerUserId,
          followUpStatus:
            resolvedFollowUp.followUpStatus ?? beforeIncident.followUpStatus,
          latestNote: resolvedFollowUp.note,
          resolutionNote: resolvedFollowUp.resolutionNote,
          lastActionAt: timestamp.toISOString(),
          updatedAt: timestamp.toISOString(),
        };
      } else {
        afterIncident = await updateGatewayAnalysisAnomalyIncidentFollowUpForOperator(
          operatorUserId,
          providerUserId,
          beforeIncident.id,
          resolvedFollowUp,
        );
      }
      resultPayload = buildGatewayAnalysisAnomalyIncidentRemediationRunResult({
        action,
        status: runStatus,
        changedFields: ["ownerUserId", "followUpStatus", "note", "resolutionNote"],
        summary: "Updated incident ownership and follow-up fields.",
      });
    } else if (action.executionMode === "route_policy_patch") {
      if (!beforeRoutePolicy) {
        throw new ConflictError(`remediation action ${action.actionKey} 需要绑定 route policy 才能执行。`);
      }
      const patch = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
        action,
        routePolicy: beforeRoutePolicy,
        input,
      });
      if (dryRun) {
        afterRoutePolicy = {
          ...beforeRoutePolicy,
          config: patch.nextConfig,
          updatedAt: timestamp.toISOString(),
        };
      } else {
        afterRoutePolicy = await saveGatewayRoutePolicyForOperator(
          operatorUserId,
          providerUserId,
          beforeRoutePolicy.id,
          {
            projectId: beforeRoutePolicy.projectId,
            name: beforeRoutePolicy.name,
            isDefault: beforeRoutePolicy.isDefault,
            enabled: beforeRoutePolicy.enabled,
            config: patch.nextConfig,
          },
        );
      }
      resultPayload = buildGatewayAnalysisAnomalyIncidentRemediationRunResult({
        action,
        status: runStatus,
        changedFields: patch.changedFields,
        summary: patch.summary,
      });
    }
  } catch (error) {
    runStatus = "failed";
    errorSummary = truncateErrorSummary(error instanceof Error ? error.message : String(error), 500);
    resultPayload = buildGatewayAnalysisAnomalyIncidentRemediationRunResult({
      action,
      status: runStatus,
      changedFields: [],
      summary: errorSummary,
    });
  }

  await db.insert(gatewayAnalysisAnomalyRemediationRuns).values({
    id: runId,
    incidentId: beforeIncident.id,
    policyId: beforeIncident.policyId ?? null,
    routePolicyId: afterRoutePolicy?.id ?? beforeRoutePolicy?.id ?? null,
    actionKey: action.actionKey,
    title: action.title,
    executionMode: action.executionMode,
    status: runStatus,
    dryRun,
    actorUserId: operatorUserId,
    note,
    input: {
      actionKey,
      dryRun,
      incidentFollowUp: input.incidentFollowUp ?? null,
      routePolicyPatch: input.routePolicyPatch ?? null,
    },
    result: resultPayload,
    beforeIncident,
    afterIncident,
    beforeRoutePolicy,
    afterRoutePolicy,
    errorSummary,
    createdAt: timestamp,
    completedAt: timestamp,
  });

  await appendGatewayAnalysisAnomalyIncidentHistory({
    incidentId: beforeIncident.id,
    eventType: runStatus === "failed" ? "remediation_failed" : dryRun ? "remediation_dry_run" : "remediation_applied",
    actorUserId: operatorUserId,
    note: note ?? resultPayload?.summary?.toString() ?? action.title,
    metadata: {
      ...buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: beforeIncident.policyId,
        projectId: beforeIncident.projectId,
        tag: beforeIncident.tag,
        textMode: beforeIncident.textMode,
        code: beforeIncident.code,
        severity: beforeIncident.severity,
        status: afterIncident?.status ?? beforeIncident.status,
        ownerUserId: afterIncident?.ownerUserId ?? beforeIncident.ownerUserId,
        followUpStatus: afterIncident?.followUpStatus ?? beforeIncident.followUpStatus,
        syncHitCount: afterIncident?.syncHitCount ?? beforeIncident.syncHitCount,
        escalationStatus: afterIncident?.escalationStatus ?? beforeIncident.escalationStatus,
        escalatedAt: afterIncident?.escalatedAt ?? beforeIncident.escalatedAt,
        escalationReason: afterIncident?.escalationReason ?? beforeIncident.escalationReason,
        lastAlertAttemptAt: afterIncident?.lastAlertAttemptAt ?? beforeIncident.lastAlertAttemptAt,
        lastAlertedAt: afterIncident?.lastAlertedAt ?? beforeIncident.lastAlertedAt,
        lastAlertSeverity: afterIncident?.lastAlertSeverity ?? beforeIncident.lastAlertSeverity,
        alertDeliveryCount: afterIncident?.alertDeliveryCount ?? beforeIncident.alertDeliveryCount,
        latestExportId: afterIncident?.latestExportId ?? beforeIncident.latestExportId,
        previousExportId: afterIncident?.previousExportId ?? beforeIncident.previousExportId,
        latestValue: afterIncident?.latestValue ?? beforeIncident.latestValue,
        previousValue: afterIncident?.previousValue ?? beforeIncident.previousValue,
        deltaValue: afterIncident?.deltaValue ?? beforeIncident.deltaValue,
        deltaRatio: afterIncident?.deltaRatio ?? beforeIncident.deltaRatio,
        thresholdValue: afterIncident?.thresholdValue ?? beforeIncident.thresholdValue,
      }),
      remediationRunId: runId,
      actionKey: action.actionKey,
      executionMode: action.executionMode,
      runStatus,
      dryRun,
      routePolicyId: afterRoutePolicy?.id ?? beforeRoutePolicy?.id ?? null,
      result: resultPayload,
      errorSummary,
    },
    createdAt: timestamp,
  });

  if (runStatus === "failed") {
    throw new ConflictError(errorSummary ?? `remediation action ${action.actionKey} 执行失败。`);
  }

  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(eq(gatewayAnalysisAnomalyRemediationRuns.id, runId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway anomaly remediation run 不存在。");
  }
  return toGatewayAnalysisAnomalyRemediationRunView(row);
}

function resolveGatewayAnalysisAnomalyPolicyAlertConfig(policy: GatewayAnalysisAnomalyPolicyView | null) {
  return {
    alertingEnabled: policy?.alertingEnabled ?? true,
    alertIntervalMinutes: policy?.alertIntervalMinutes ?? 180,
    notifyOperators: policy?.notifyOperatorsOnEscalation ?? true,
    notifyOwner: policy?.notifyOwnerOnEscalation ?? true,
  };
}

function resolveGatewayAnalysisAnomalyPolicyAutoRemediationConfig(policy: GatewayAnalysisAnomalyPolicyView | null) {
  return {
    autoRemediationEnabled: policy?.autoRemediationEnabled ?? false,
    autoRemediationIntervalMinutes: policy?.autoRemediationIntervalMinutes ?? 180,
    autoRemediationDryRunFirst: policy?.autoRemediationDryRunFirst ?? true,
    autoRemediationActionKeys: normalizeStringList(policy?.autoRemediationActionKeys ?? null),
    autoRemediationMaxApplyRunsPerIncident: policy?.autoRemediationMaxApplyRunsPerIncident ?? null,
    autoRemediationRequireAlertBeforeApply: policy?.autoRemediationRequireAlertBeforeApply ?? false,
    autoRemediationFreezeOnProviderHealthDegrade: policy?.autoRemediationFreezeOnProviderHealthDegrade ?? true,
  };
}

function resolveGatewayAnalysisAnomalyIncidentAutoRemediationConfig(
  policy: GatewayAnalysisAnomalyPolicyView | null,
  incident: GatewayAnalysisAnomalyIncidentView,
  routePolicy: GatewayRoutePolicyView | null,
) {
  if (policy) {
    return resolveGatewayAnalysisAnomalyPolicyAutoRemediationConfig(policy);
  }
  const hotspotConfig = resolveGatewayRateLimitHotspotAutoRemediationConfig(incident, routePolicy);
  if (hotspotConfig.autoRemediationEnabled) {
    return hotspotConfig;
  }
  return resolveGatewayRoutingAnomalyAutoRemediationConfig(incident, routePolicy);
}

async function findLatestGatewayAnalysisAnomalyRemediationRun(
  incidentId: string,
  actionKey: string,
) {
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(
      and(
        eq(gatewayAnalysisAnomalyRemediationRuns.incidentId, incidentId),
        eq(gatewayAnalysisAnomalyRemediationRuns.actionKey, actionKey),
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyRemediationRuns.createdAt))
    .limit(1);
  return row ? toGatewayAnalysisAnomalyRemediationRunView(row) : null;
}

async function countGatewayAnalysisAnomalyRemediationRunsByStatus(
  incidentId: string,
  actionKey: string,
  status: GatewayAnalysisAnomalyRemediationRunStatus,
) {
  const rows = await db
    .select({ id: gatewayAnalysisAnomalyRemediationRuns.id })
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(
      and(
        eq(gatewayAnalysisAnomalyRemediationRuns.incidentId, incidentId),
        eq(gatewayAnalysisAnomalyRemediationRuns.actionKey, actionKey),
        eq(gatewayAnalysisAnomalyRemediationRuns.status, status),
      ),
    );
  return rows.length;
}

async function readGatewayRoutePolicyHealthDegraded(routePolicy: GatewayRoutePolicyView | null) {
  if (!routePolicy?.config.allowedProviderAccountIds?.length) {
    return false;
  }
  const providerIds = routePolicy.config.allowedProviderAccountIds;
  const providerRows = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(inArray(gatewayProviderAccounts.id, providerIds));
  if (providerRows.some((row) => row.status !== "active")) {
    return true;
  }
  for (const providerId of providerIds) {
    const breakerOpenRaw = await redis.get(buildGatewayProviderBreakerOpenKey(providerId)).catch(() => null);
    if (breakerOpenRaw) {
      return true;
    }
  }
  return false;
}

export async function listGatewayAnalysisAnomalyIncidentAlertQueueForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyIncidentAlertQueueFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  const dueOnly = filters.dueOnly === true;
  const referenceTime = now();
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    ...filters,
    escalationStatus: "escalated",
    limit: Math.max(limit, 200),
  });

  const items: GatewayAnalysisAnomalyIncidentAlertQueueItemView[] = [];
  for (const incident of incidents) {
    const policyRow = incident.policyId ? await findGatewayAnalysisAnomalyPolicyRow(incident.policyId).catch(() => null) : null;
    const policy = policyRow ? toGatewayAnalysisAnomalyPolicyView(policyRow) : null;
    const resolvedRoutePolicyId = policy?.routePolicyId ?? incident.routePolicyId ?? null;
    const routePolicyRow = resolvedRoutePolicyId ? await findGatewayRoutePolicyRow(resolvedRoutePolicyId).catch(() => null) : null;
    const routePolicy = routePolicyRow ? toGatewayRoutePolicyView(routePolicyRow) : null;
    const incidentContext = await loadGatewayAnalysisAnomalyIncidentLatestSyncContext(incident.id);
    const alertConfig = resolveGatewayAnalysisAnomalyPolicyAlertConfig(policy);
    const schedule = resolveGatewayAnalysisAnomalyIncidentAlertSchedule({
      status: incident.status,
      escalationStatus: incident.escalationStatus,
      alertingEnabled: alertConfig.alertingEnabled,
      alertIntervalMinutes: alertConfig.alertIntervalMinutes,
      lastAlertAttemptAt: incident.lastAlertAttemptAt,
      now: referenceTime,
    });
    if (dueOnly && !schedule.alertDue) {
      continue;
    }
    const deliveryProfile = resolveGatewayAnalysisAnomalyAlertDeliveryProfile(incident.severity);
    const remediationPlan = buildGatewayAnalysisAnomalyIncidentRemediationPlan({
      generatedAt: referenceTime.toISOString(),
      incident,
      policy,
      routePolicy,
      incidentContext,
    });
    items.push({
      incident,
      policy,
      routePolicy,
      alertIntervalMinutes: alertConfig.alertIntervalMinutes,
      alertDue: schedule.alertDue,
      nextAlertDueAt: schedule.nextAlertDueAt,
      notifyOperators: alertConfig.notifyOperators,
      notifyOwner: alertConfig.notifyOwner,
      alertLevel: deliveryProfile.alertLevel,
      webhookSeverity: deliveryProfile.webhookSeverity,
      remediationActionKeys: remediationPlan.actions.map((action) => action.actionKey),
    });
  }

  const sortedItems = items
    .sort((left, right) => {
      if (left.alertDue !== right.alertDue) {
        return left.alertDue ? -1 : 1;
      }
      if (left.incident.severity !== right.incident.severity) {
        return left.incident.severity === "critical" ? -1 : 1;
      }
      return Date.parse(right.incident.lastSeenAt) - Date.parse(left.incident.lastSeenAt);
    })
    .slice(0, limit);

  return {
    generatedAt: referenceTime.toISOString(),
    limit,
    dueOnly,
    incidentCount: sortedItems.length,
    dueCount: sortedItems.filter((item) => item.alertDue).length,
    items: sortedItems,
  } satisfies GatewayAnalysisAnomalyIncidentAlertQueueView;
}

export async function recordGatewayAnalysisAnomalyIncidentAlertDispatchForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
  args?: {
    alertedAt?: Date | string | null;
    alertSeverity?: GatewayAnalysisAnomalyAlertDeliverySeverity | string | null;
    alertLevel?: number | null;
    note?: string | null;
    mailboxRecipientCount?: number | null;
    webhookDispatched?: boolean | null;
    webhookSkippedReason?: string | null;
    remediationActionKeys?: string[] | null;
  },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }

  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }

  const alertTimestamp =
    args?.alertedAt instanceof Date
      ? args.alertedAt
      : typeof args?.alertedAt === "string"
        ? new Date(args.alertedAt)
        : now();
  if (!Number.isFinite(alertTimestamp.getTime())) {
    throw new ConflictError("alertedAt 必须是合法的 ISO 时间。");
  }

  const mailboxRecipientCount = Math.max(0, Math.floor(args?.mailboxRecipientCount ?? 0));
  const webhookDispatched = args?.webhookDispatched === true;
  const deliverySucceeded = mailboxRecipientCount > 0 || webhookDispatched;
  const alertSeverity = normalizeGatewayAnalysisAnomalyAlertDeliverySeverity(args?.alertSeverity);

  await db
    .update(gatewayAnalysisAnomalyIncidents)
    .set({
      lastAlertAttemptAt: alertTimestamp,
      lastAlertedAt: deliverySucceeded ? alertTimestamp : row.lastAlertedAt,
      lastAlertSeverity: deliverySucceeded ? alertSeverity : row.lastAlertSeverity,
      alertDeliveryCount: deliverySucceeded ? row.alertDeliveryCount + 1 : row.alertDeliveryCount,
      updatedAt: alertTimestamp,
    })
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId));

  const [updatedRow] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId))
    .limit(1);
  if (!updatedRow) {
    throw new NotFoundError("Gateway analysis anomaly incident 告警回写失败。");
  }

  const incident = toGatewayAnalysisAnomalyIncidentView(updatedRow);
  if (deliverySucceeded) {
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: normalizedIncidentId,
      eventType: "alert_dispatched",
      actorUserId: operatorUserId,
      note: args?.note ?? "Gateway anomaly alert dispatched.",
      metadata: {
        ...buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: incident.policyId,
          projectId: incident.projectId,
          routePolicyId: incident.routePolicyId,
          tag: incident.tag,
          textMode: incident.textMode,
          code: incident.code,
          severity: incident.severity,
          status: incident.status,
          ownerUserId: incident.ownerUserId,
          followUpStatus: incident.followUpStatus,
          syncHitCount: incident.syncHitCount,
          escalationStatus: incident.escalationStatus,
          escalatedAt: incident.escalatedAt,
          escalationReason: incident.escalationReason,
          lastAlertAttemptAt: incident.lastAlertAttemptAt,
          lastAlertedAt: incident.lastAlertedAt,
          lastAlertSeverity: incident.lastAlertSeverity,
          alertDeliveryCount: incident.alertDeliveryCount,
          latestExportId: incident.latestExportId,
          previousExportId: incident.previousExportId,
          latestValue: incident.latestValue,
          previousValue: incident.previousValue,
          deltaValue: incident.deltaValue,
          deltaRatio: incident.deltaRatio,
          thresholdValue: incident.thresholdValue,
        }),
        alertLevel: args?.alertLevel ?? null,
        mailboxRecipientCount,
        webhookDispatched,
        webhookSkippedReason: args?.webhookSkippedReason ?? null,
        remediationActionKeys: args?.remediationActionKeys ?? null,
      },
      createdAt: alertTimestamp,
    });
  }

  return incident;
}

export async function syncGatewayAnalysisAnomalyIncidentsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportAnomalyReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const requestedPolicyId = filters.policyId?.trim() ?? null;
  try {
    const context = await resolveGatewayAnalysisAnomalyEvaluationContextForOperator(operatorUserId, providerUserId, filters);
    const report = buildGatewayAnalysisExportAnomalyReport({
      trendReport: await getGatewayAnalysisExportTrendReportForOperator(operatorUserId, providerUserId, context.filters),
      profileKey: context.profileKey,
      thresholds: context.thresholds,
    });
    const timestamp = now();
    const existingRows = await db
      .select()
      .from(gatewayAnalysisAnomalyIncidents)
      .where(
        buildGatewayAnalysisAnomalyIncidentScopeWhere({
          policyId: context.policy?.id ?? null,
          projectId: context.filters.projectId ?? null,
          routePolicyId: context.policy?.routePolicyId ?? null,
          tag: context.filters.tag ?? null,
          textMode: context.filters.textMode ?? null,
        }),
      );
    const existingByFingerprint = new Map(existingRows.map((row) => [row.fingerprint, row] as const));
    const openedIncidentIds: string[] = [];
    const updatedIncidentIds: string[] = [];
    const resolvedIncidentIds: string[] = [];
    const seenFingerprints = new Set<string>();

    for (const anomaly of report.anomalies) {
      const fingerprint = buildGatewayAnalysisAnomalyIncidentFingerprint({
        policyId: context.policy?.id ?? null,
        projectId: context.filters.projectId ?? null,
        routePolicyId: context.policy?.routePolicyId ?? null,
        tag: context.filters.tag ?? null,
        textMode: context.filters.textMode ?? null,
        code: anomaly.code,
      });
      seenFingerprints.add(fingerprint);
      const existing = existingByFingerprint.get(fingerprint);

      if (existing) {
        const previousStatus = normalizeGatewayAnalysisAnomalyIncidentStatus(existing.status);
        const previousEscalationStatus = normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(existing.escalationStatus);
        const previousFollowUpStatus = normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(existing.followUpStatus);
        const wasResolved = previousStatus === "resolved";
        const nextStatus = previousStatus === "acknowledged" ? "acknowledged" : "open";
        const nextSyncHitCount = wasResolved ? 1 : Math.max(existing.syncHitCount ?? 0, 0) + 1;
        const escalationDecision = resolveGatewayAnalysisAnomalyAutoEscalation({
          policy: context.policy,
          anomalySeverity: anomaly.severity,
          syncHitCount: nextSyncHitCount,
        });
        const escalationTransitioned = escalationDecision.shouldEscalate && previousEscalationStatus !== "escalated";
        const nextEscalationStatus = escalationDecision.shouldEscalate
          ? "escalated"
          : wasResolved
            ? "none"
            : previousEscalationStatus;
        const nextEscalatedAt = escalationDecision.shouldEscalate
          ? existing.escalatedAt ?? timestamp
          : wasResolved
            ? null
            : existing.escalatedAt;
        const nextEscalationReason = escalationDecision.shouldEscalate
          ? escalationDecision.reason
          : wasResolved
            ? null
            : existing.escalationReason;
        const nextOwnerUserId =
          escalationTransitioned && !existing.ownerUserId ? escalationDecision.ownerUserId ?? null : existing.ownerUserId;
        const nextFollowUpStatus =
          escalationTransitioned && (wasResolved || previousFollowUpStatus === "pending")
            ? escalationDecision.followUpStatus ?? previousFollowUpStatus
            : previousFollowUpStatus;
        await db
          .update(gatewayAnalysisAnomalyIncidents)
          .set({
            policyId: context.policy?.id ?? null,
            projectId: context.filters.projectId ?? null,
            routePolicyId: context.policy?.routePolicyId ?? null,
            tag: context.filters.tag ?? null,
            textMode: context.filters.textMode ?? null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: nextStatus,
            ownerUserId: nextOwnerUserId ?? null,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt,
            escalationReason: nextEscalationReason,
            summary: anomaly.message,
            latestExportId: anomaly.latestExportId,
            previousExportId: anomaly.previousExportId,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
            lastSeenAt: timestamp,
            resolvedAt: null,
            updatedAt: timestamp,
          })
          .where(eq(gatewayAnalysisAnomalyIncidents.id, existing.id));
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId: existing.id,
          eventType: "sync_updated",
          note: anomaly.message,
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: context.policy?.id ?? null,
            projectId: context.filters.projectId ?? null,
            routePolicyId: context.policy?.routePolicyId ?? null,
            tag: context.filters.tag ?? null,
            textMode: context.filters.textMode ?? null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: nextStatus,
            ownerUserId: nextOwnerUserId ?? null,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt?.toISOString() ?? null,
            escalationReason: nextEscalationReason,
            latestExportId: anomaly.latestExportId,
            previousExportId: anomaly.previousExportId,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
          }),
          createdAt: timestamp,
        });
        if (escalationTransitioned) {
          await appendGatewayAnalysisAnomalyIncidentHistory({
            incidentId: existing.id,
            eventType: "auto_escalated",
            note: escalationDecision.reason,
            metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
              policyId: context.policy?.id ?? null,
              projectId: context.filters.projectId ?? null,
              routePolicyId: context.policy?.routePolicyId ?? null,
              tag: context.filters.tag ?? null,
              textMode: context.filters.textMode ?? null,
              code: anomaly.code,
              severity: anomaly.severity,
              status: nextStatus,
              ownerUserId: nextOwnerUserId ?? null,
              followUpStatus: nextFollowUpStatus,
              syncHitCount: nextSyncHitCount,
              escalationStatus: nextEscalationStatus,
              escalatedAt: nextEscalatedAt?.toISOString() ?? null,
              escalationReason: nextEscalationReason,
              latestExportId: anomaly.latestExportId,
              previousExportId: anomaly.previousExportId,
              latestValue: anomaly.latestValue,
              previousValue: anomaly.previousValue,
              deltaValue: anomaly.deltaValue,
              deltaRatio: anomaly.deltaRatio,
              thresholdValue: anomaly.thresholdValue,
            }),
            createdAt: timestamp,
          });
        }
        updatedIncidentIds.push(existing.id);
        continue;
      }

      const nextSyncHitCount = 1;
      const escalationDecision = resolveGatewayAnalysisAnomalyAutoEscalation({
        policy: context.policy,
        anomalySeverity: anomaly.severity,
        syncHitCount: nextSyncHitCount,
      });
      const nextEscalationStatus = escalationDecision.shouldEscalate ? "escalated" : "none";
      const nextEscalatedAt = escalationDecision.shouldEscalate ? timestamp : null;
      const nextEscalationReason = escalationDecision.shouldEscalate ? escalationDecision.reason : null;
      const nextOwnerUserId = escalationDecision.shouldEscalate ? escalationDecision.ownerUserId ?? null : null;
      const nextFollowUpStatus = escalationDecision.shouldEscalate
        ? escalationDecision.followUpStatus ?? "pending"
        : "pending";
      const incidentId = randomUUID();
      await db.insert(gatewayAnalysisAnomalyIncidents).values({
        id: incidentId,
        policyId: context.policy?.id ?? null,
        fingerprint,
        projectId: context.filters.projectId ?? null,
        routePolicyId: context.policy?.routePolicyId ?? null,
        tag: context.filters.tag ?? null,
        textMode: context.filters.textMode ?? null,
        code: anomaly.code,
        severity: anomaly.severity,
        status: "open",
        ownerUserId: nextOwnerUserId,
        followUpStatus: nextFollowUpStatus,
        syncHitCount: nextSyncHitCount,
        escalationStatus: nextEscalationStatus,
        escalatedAt: nextEscalatedAt,
        escalationReason: nextEscalationReason,
        latestNote: null,
        resolutionNote: null,
        lastActionAt: null,
        summary: anomaly.message,
        latestExportId: anomaly.latestExportId,
        previousExportId: anomaly.previousExportId,
        latestValue: anomaly.latestValue,
        previousValue: anomaly.previousValue,
        deltaValue: anomaly.deltaValue,
        deltaRatio: anomaly.deltaRatio,
        thresholdValue: anomaly.thresholdValue,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        acknowledgedAt: null,
        resolvedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId,
        eventType: "sync_opened",
        note: anomaly.message,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: context.policy?.id ?? null,
          projectId: context.filters.projectId ?? null,
          routePolicyId: context.policy?.routePolicyId ?? null,
          tag: context.filters.tag ?? null,
          textMode: context.filters.textMode ?? null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: "open",
          ownerUserId: nextOwnerUserId,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestExportId: anomaly.latestExportId,
          previousExportId: anomaly.previousExportId,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
        }),
        createdAt: timestamp,
      });
      if (nextEscalationStatus === "escalated") {
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId,
          eventType: "auto_escalated",
          note: nextEscalationReason,
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: context.policy?.id ?? null,
            projectId: context.filters.projectId ?? null,
            routePolicyId: context.policy?.routePolicyId ?? null,
            tag: context.filters.tag ?? null,
            textMode: context.filters.textMode ?? null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: "open",
            ownerUserId: nextOwnerUserId,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt?.toISOString() ?? null,
            escalationReason: nextEscalationReason,
            latestExportId: anomaly.latestExportId,
            previousExportId: anomaly.previousExportId,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
          }),
          createdAt: timestamp,
        });
      }
      openedIncidentIds.push(incidentId);
    }

    for (const row of existingRows) {
      if (seenFingerprints.has(row.fingerprint)) {
        continue;
      }
      if (normalizeGatewayAnalysisAnomalyIncidentStatus(row.status) === "resolved") {
        continue;
      }
      await db
        .update(gatewayAnalysisAnomalyIncidents)
        .set({
          status: "resolved",
          syncHitCount: 0,
          escalationStatus:
            normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated" ? "resolved" : row.escalationStatus,
          resolvedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(gatewayAnalysisAnomalyIncidents.id, row.id));
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: row.id,
        eventType: "sync_resolved",
        note: row.summary,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: row.policyId ?? null,
          projectId: row.projectId ?? null,
          routePolicyId: row.routePolicyId ?? null,
          tag: row.tag ?? null,
          textMode: (row.textMode as GatewayAnalysisExportTextMode | null) ?? null,
          code: row.code,
          severity: row.severity,
          status: "resolved",
          ownerUserId: row.ownerUserId ?? null,
          followUpStatus: row.followUpStatus ?? null,
          syncHitCount: 0,
          escalationStatus:
            normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated" ? "resolved" : row.escalationStatus,
          escalatedAt: row.escalatedAt?.toISOString() ?? null,
          escalationReason: row.escalationReason ?? null,
          latestExportId: row.latestExportId ?? null,
          previousExportId: row.previousExportId ?? null,
          latestValue: row.latestValue ?? null,
          previousValue: row.previousValue ?? null,
          deltaValue: row.deltaValue ?? null,
          deltaRatio: row.deltaRatio ?? null,
          thresholdValue: row.thresholdValue ?? null,
        }),
        createdAt: timestamp,
      });
      if (normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated") {
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId: row.id,
          eventType: "escalation_cleared",
          note: row.escalationReason ?? "Escalation cleared because anomaly no longer matched.",
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: row.policyId ?? null,
            projectId: row.projectId ?? null,
            routePolicyId: row.routePolicyId ?? null,
            tag: row.tag ?? null,
            textMode: (row.textMode as GatewayAnalysisExportTextMode | null) ?? null,
            code: row.code,
            severity: row.severity,
            status: "resolved",
            ownerUserId: row.ownerUserId ?? null,
            followUpStatus: row.followUpStatus ?? null,
            syncHitCount: 0,
            escalationStatus: "resolved",
            escalatedAt: row.escalatedAt?.toISOString() ?? null,
            escalationReason: row.escalationReason ?? null,
            latestExportId: row.latestExportId ?? null,
            previousExportId: row.previousExportId ?? null,
            latestValue: row.latestValue ?? null,
            previousValue: row.previousValue ?? null,
            deltaValue: row.deltaValue ?? null,
            deltaRatio: row.deltaRatio ?? null,
            thresholdValue: row.thresholdValue ?? null,
          }),
          createdAt: timestamp,
        });
      }
      resolvedIncidentIds.push(row.id);
    }

    const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
      policyId: context.policy?.id ?? null,
      projectId: context.filters.projectId ?? null,
      routePolicyId: context.policy?.routePolicyId ?? null,
      tag: context.filters.tag ?? null,
      textMode: context.filters.textMode ?? null,
      limit: 200,
    });
    if (context.policy?.id) {
      await updateGatewayAnalysisAnomalyPolicySyncState({
        policyId: context.policy.id,
        status: "ok",
        syncedAt: timestamp,
        error: null,
      });
    }
    return {
      report,
      incidents,
      openedIncidentIds,
      updatedIncidentIds,
      resolvedIncidentIds,
    };
  } catch (error) {
    if (requestedPolicyId) {
      await updateGatewayAnalysisAnomalyPolicySyncState({
        policyId: requestedPolicyId,
        status: "error",
        syncedAt: now(),
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
    throw error;
  }
}

export async function syncGatewayProviderRoutingAnalysisAnomalyIncidentsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayProviderRoutingAnalysisOperatorFilters = {},
): Promise<GatewaySyncProviderRoutingAnalysisAnomalyIncidentsResult> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const report = await getGatewayProviderRoutingAnalysisAnomalyReportForOperator(
    operatorUserId,
    providerUserId,
    filters,
  );
  const timestamp = now();
  const projectId = report.filters.projectId?.trim() ?? null;
  const routePolicyId = report.filters.routePolicyId?.trim() ?? null;
  const tag = buildGatewayProviderRoutingIncidentTag({
    profileKey: report.profileKey,
    filters: report.filters,
  });
  const existingRows = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(
      buildGatewayAnalysisAnomalyIncidentScopeWhere({
        policyId: null,
        projectId,
        routePolicyId,
        tag,
        textMode: null,
      }),
    );
  const existingByFingerprint = new Map(existingRows.map((row) => [row.fingerprint, row] as const));
  const openedIncidentIds: string[] = [];
  const updatedIncidentIds: string[] = [];
  const resolvedIncidentIds: string[] = [];
  const seenFingerprints = new Set<string>();

  for (const anomaly of report.anomalies) {
    const fingerprint = buildGatewayAnalysisAnomalyIncidentFingerprint({
      policyId: null,
      projectId,
      routePolicyId,
      tag,
      textMode: null,
      code: anomaly.code,
    });
    seenFingerprints.add(fingerprint);
    const existing = existingByFingerprint.get(fingerprint);

    if (existing) {
      const previousStatus = normalizeGatewayAnalysisAnomalyIncidentStatus(existing.status);
      const previousEscalationStatus = normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(existing.escalationStatus);
      const previousFollowUpStatus = normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(existing.followUpStatus);
      const wasResolved = previousStatus === "resolved";
      const nextStatus = previousStatus === "acknowledged" ? "acknowledged" : "open";
      const nextSyncHitCount = wasResolved ? 1 : Math.max(existing.syncHitCount ?? 0, 0) + 1;
      const escalationDecision = resolveGatewayProviderRoutingAutoEscalation({
        anomalySeverity: anomaly.severity,
        syncHitCount: nextSyncHitCount,
      });
      const escalationTransitioned = escalationDecision.shouldEscalate && previousEscalationStatus !== "escalated";
      const nextEscalationStatus = escalationDecision.shouldEscalate
        ? "escalated"
        : wasResolved
          ? "none"
          : previousEscalationStatus;
      const nextEscalatedAt = escalationDecision.shouldEscalate
        ? existing.escalatedAt ?? timestamp
        : wasResolved
          ? null
          : existing.escalatedAt;
      const nextEscalationReason = escalationDecision.shouldEscalate
        ? escalationDecision.reason
        : wasResolved
          ? null
          : existing.escalationReason;
      const nextOwnerUserId =
        escalationTransitioned && !existing.ownerUserId ? escalationDecision.ownerUserId ?? null : existing.ownerUserId;
      const nextFollowUpStatus =
        escalationTransitioned && (wasResolved || previousFollowUpStatus === "pending")
          ? escalationDecision.followUpStatus ?? previousFollowUpStatus
          : previousFollowUpStatus;
      await db
        .update(gatewayAnalysisAnomalyIncidents)
        .set({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: nextStatus,
          ownerUserId: nextOwnerUserId ?? null,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt,
          escalationReason: nextEscalationReason,
          summary: anomaly.message,
          latestExportId: null,
          previousExportId: null,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
          lastSeenAt: timestamp,
          resolvedAt: null,
          updatedAt: timestamp,
        })
        .where(eq(gatewayAnalysisAnomalyIncidents.id, existing.id));
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: existing.id,
        eventType: "sync_updated",
        note: anomaly.message,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: nextStatus,
          ownerUserId: nextOwnerUserId ?? null,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
        }),
        createdAt: timestamp,
      });
      if (escalationTransitioned) {
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId: existing.id,
          eventType: "auto_escalated",
          note: escalationDecision.reason,
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: null,
            projectId,
            routePolicyId,
            tag,
            textMode: null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: nextStatus,
            ownerUserId: nextOwnerUserId ?? null,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt?.toISOString() ?? null,
            escalationReason: nextEscalationReason,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
          }),
          createdAt: timestamp,
        });
      }
      updatedIncidentIds.push(existing.id);
      continue;
    }

    const nextSyncHitCount = 1;
    const escalationDecision = resolveGatewayProviderRoutingAutoEscalation({
      anomalySeverity: anomaly.severity,
      syncHitCount: nextSyncHitCount,
    });
    const nextEscalationStatus = escalationDecision.shouldEscalate ? "escalated" : "none";
    const nextEscalatedAt = escalationDecision.shouldEscalate ? timestamp : null;
    const nextEscalationReason = escalationDecision.shouldEscalate ? escalationDecision.reason : null;
    const nextOwnerUserId = escalationDecision.shouldEscalate ? escalationDecision.ownerUserId ?? null : null;
    const nextFollowUpStatus = escalationDecision.shouldEscalate
      ? escalationDecision.followUpStatus ?? "pending"
      : "pending";
    const incidentId = randomUUID();
    await db.insert(gatewayAnalysisAnomalyIncidents).values({
      id: incidentId,
      policyId: null,
      fingerprint,
      projectId,
      routePolicyId,
      tag,
      textMode: null,
      code: anomaly.code,
      severity: anomaly.severity,
      status: "open",
      ownerUserId: nextOwnerUserId,
      followUpStatus: nextFollowUpStatus,
      syncHitCount: nextSyncHitCount,
      escalationStatus: nextEscalationStatus,
      escalatedAt: nextEscalatedAt,
      escalationReason: nextEscalationReason,
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      summary: anomaly.message,
      latestExportId: null,
      previousExportId: null,
      latestValue: anomaly.latestValue,
      previousValue: anomaly.previousValue,
      deltaValue: anomaly.deltaValue,
      deltaRatio: anomaly.deltaRatio,
      thresholdValue: anomaly.thresholdValue,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId,
      eventType: "sync_opened",
      note: anomaly.message,
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: null,
        projectId,
        routePolicyId,
        tag,
        textMode: null,
        code: anomaly.code,
        severity: anomaly.severity,
        status: "open",
        ownerUserId: nextOwnerUserId,
        followUpStatus: nextFollowUpStatus,
        syncHitCount: nextSyncHitCount,
        escalationStatus: nextEscalationStatus,
        escalatedAt: nextEscalatedAt?.toISOString() ?? null,
        escalationReason: nextEscalationReason,
        latestValue: anomaly.latestValue,
        previousValue: anomaly.previousValue,
        deltaValue: anomaly.deltaValue,
        deltaRatio: anomaly.deltaRatio,
        thresholdValue: anomaly.thresholdValue,
      }),
      createdAt: timestamp,
    });
    if (nextEscalationStatus === "escalated") {
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId,
        eventType: "auto_escalated",
        note: nextEscalationReason,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: "open",
          ownerUserId: nextOwnerUserId,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
        }),
        createdAt: timestamp,
      });
    }
    openedIncidentIds.push(incidentId);
  }

  for (const row of existingRows) {
    if (seenFingerprints.has(row.fingerprint)) {
      continue;
    }
    if (normalizeGatewayAnalysisAnomalyIncidentStatus(row.status) === "resolved") {
      continue;
    }
    const nextEscalationStatus =
      normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated"
        ? "resolved"
        : row.escalationStatus;
    await db
      .update(gatewayAnalysisAnomalyIncidents)
      .set({
        status: "resolved",
        syncHitCount: 0,
        escalationStatus: nextEscalationStatus,
        resolvedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(gatewayAnalysisAnomalyIncidents.id, row.id));
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: row.id,
      eventType: "sync_resolved",
      note: row.summary,
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: null,
        projectId: row.projectId ?? null,
        routePolicyId: row.routePolicyId ?? null,
        tag: row.tag ?? null,
        textMode: null,
        code: row.code,
        severity: row.severity,
        status: "resolved",
        ownerUserId: row.ownerUserId ?? null,
        followUpStatus: row.followUpStatus ?? null,
        syncHitCount: 0,
        escalationStatus: nextEscalationStatus,
        escalatedAt: row.escalatedAt?.toISOString() ?? null,
        escalationReason: row.escalationReason ?? null,
        latestValue: row.latestValue ?? null,
        previousValue: row.previousValue ?? null,
        deltaValue: row.deltaValue ?? null,
        deltaRatio: row.deltaRatio ?? null,
        thresholdValue: row.thresholdValue ?? null,
      }),
      createdAt: timestamp,
    });
    if (normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated") {
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: row.id,
        eventType: "escalation_cleared",
        note: row.escalationReason ?? "Escalation cleared because provider routing anomaly no longer matched.",
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId: row.projectId ?? null,
          routePolicyId: row.routePolicyId ?? null,
          tag: row.tag ?? null,
          textMode: null,
          code: row.code,
          severity: row.severity,
          status: "resolved",
          ownerUserId: row.ownerUserId ?? null,
          followUpStatus: row.followUpStatus ?? null,
          syncHitCount: 0,
          escalationStatus: "resolved",
          escalatedAt: row.escalatedAt?.toISOString() ?? null,
          escalationReason: row.escalationReason ?? null,
          latestValue: row.latestValue ?? null,
          previousValue: row.previousValue ?? null,
          deltaValue: row.deltaValue ?? null,
          deltaRatio: row.deltaRatio ?? null,
          thresholdValue: row.thresholdValue ?? null,
        }),
        createdAt: timestamp,
      });
    }
    resolvedIncidentIds.push(row.id);
  }

  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    projectId,
    routePolicyId,
    tag,
    limit: 200,
  });

  return {
    report,
    incidents,
    openedIncidentIds,
    updatedIncidentIds,
    resolvedIncidentIds,
  };
}

export async function syncGatewayRateLimitHotspotAnomalyIncidentsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
): Promise<GatewaySyncRateLimitHotspotAnomalyIncidentsResult> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const snapshot = await getGatewayRateLimitHotspotAnomalySnapshotForOperator(operatorUserId, providerUserId, snapshotId);
  const timestamp = now();
  const projectId = snapshot.filters.projectId?.trim() ?? null;
  const routePolicyId = snapshot.filters.routePolicyId?.trim() ?? null;
  const tag = buildGatewayRateLimitHotspotIncidentTag(snapshot);
  const existingRows = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(
      buildGatewayAnalysisAnomalyIncidentScopeWhere({
        policyId: null,
        projectId,
        routePolicyId,
        tag,
        textMode: null,
      }),
    );
  const existingByFingerprint = new Map(existingRows.map((row) => [row.fingerprint, row] as const));
  const openedIncidentIds: string[] = [];
  const updatedIncidentIds: string[] = [];
  const resolvedIncidentIds: string[] = [];
  const seenFingerprints = new Set<string>();

  for (const anomaly of snapshot.report.anomalies) {
    const fingerprint = buildGatewayAnalysisAnomalyIncidentFingerprint({
      policyId: null,
      projectId,
      routePolicyId,
      tag,
      textMode: null,
      code: anomaly.code,
    });
    seenFingerprints.add(fingerprint);
    const existing = existingByFingerprint.get(fingerprint);

    if (existing) {
      const previousStatus = normalizeGatewayAnalysisAnomalyIncidentStatus(existing.status);
      const previousEscalationStatus = normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(existing.escalationStatus);
      const previousFollowUpStatus = normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(existing.followUpStatus);
      const wasResolved = previousStatus === "resolved";
      const nextStatus = previousStatus === "acknowledged" ? "acknowledged" : "open";
      const nextSyncHitCount = wasResolved ? 1 : Math.max(existing.syncHitCount ?? 0, 0) + 1;
      const escalationDecision = resolveGatewayRateLimitHotspotAutoEscalation({
        anomalySeverity: anomaly.severity,
        syncHitCount: nextSyncHitCount,
      });
      const escalationTransitioned = escalationDecision.shouldEscalate && previousEscalationStatus !== "escalated";
      const nextEscalationStatus = escalationDecision.shouldEscalate
        ? "escalated"
        : wasResolved
          ? "none"
          : previousEscalationStatus;
      const nextEscalatedAt = escalationDecision.shouldEscalate
        ? existing.escalatedAt ?? timestamp
        : wasResolved
          ? null
          : existing.escalatedAt;
      const nextEscalationReason = escalationDecision.shouldEscalate
        ? escalationDecision.reason
        : wasResolved
          ? null
          : existing.escalationReason;
      const nextOwnerUserId =
        escalationTransitioned && !existing.ownerUserId ? escalationDecision.ownerUserId ?? null : existing.ownerUserId;
      const nextFollowUpStatus =
        escalationTransitioned && (wasResolved || previousFollowUpStatus === "pending")
          ? escalationDecision.followUpStatus ?? previousFollowUpStatus
          : previousFollowUpStatus;
      await db
        .update(gatewayAnalysisAnomalyIncidents)
        .set({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: nextStatus,
          ownerUserId: nextOwnerUserId ?? null,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt,
          escalationReason: nextEscalationReason,
          summary: anomaly.message,
          latestExportId: null,
          previousExportId: null,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
          lastSeenAt: timestamp,
          resolvedAt: null,
          updatedAt: timestamp,
        })
        .where(eq(gatewayAnalysisAnomalyIncidents.id, existing.id));
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: existing.id,
        eventType: "sync_updated",
        note: anomaly.message,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: nextStatus,
          ownerUserId: nextOwnerUserId ?? null,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
          snapshotId: snapshot.snapshotId,
          entityKey: anomaly.entityKey,
          latestBucketStartAt: anomaly.latestBucketStartAt,
          previousBucketStartAt: anomaly.previousBucketStartAt,
        }),
        createdAt: timestamp,
      });
      if (escalationTransitioned) {
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId: existing.id,
          eventType: "auto_escalated",
          note: escalationDecision.reason,
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: null,
            projectId,
            routePolicyId,
            tag,
            textMode: null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: nextStatus,
            ownerUserId: nextOwnerUserId ?? null,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt?.toISOString() ?? null,
            escalationReason: nextEscalationReason,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
            snapshotId: snapshot.snapshotId,
            entityKey: anomaly.entityKey,
            latestBucketStartAt: anomaly.latestBucketStartAt,
            previousBucketStartAt: anomaly.previousBucketStartAt,
          }),
          createdAt: timestamp,
        });
      }
      updatedIncidentIds.push(existing.id);
      continue;
    }

    const nextSyncHitCount = 1;
    const escalationDecision = resolveGatewayRateLimitHotspotAutoEscalation({
      anomalySeverity: anomaly.severity,
      syncHitCount: nextSyncHitCount,
    });
    const nextEscalationStatus = escalationDecision.shouldEscalate ? "escalated" : "none";
    const nextEscalatedAt = escalationDecision.shouldEscalate ? timestamp : null;
    const nextEscalationReason = escalationDecision.shouldEscalate ? escalationDecision.reason : null;
    const nextOwnerUserId = escalationDecision.shouldEscalate ? escalationDecision.ownerUserId ?? null : null;
    const nextFollowUpStatus = escalationDecision.shouldEscalate
      ? escalationDecision.followUpStatus ?? "pending"
      : "pending";
    const incidentId = randomUUID();
    await db.insert(gatewayAnalysisAnomalyIncidents).values({
      id: incidentId,
      policyId: null,
      fingerprint,
      projectId,
      routePolicyId,
      tag,
      textMode: null,
      code: anomaly.code,
      severity: anomaly.severity,
      status: "open",
      ownerUserId: nextOwnerUserId,
      followUpStatus: nextFollowUpStatus,
      syncHitCount: nextSyncHitCount,
      escalationStatus: nextEscalationStatus,
      escalatedAt: nextEscalatedAt,
      escalationReason: nextEscalationReason,
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      summary: anomaly.message,
      latestExportId: null,
      previousExportId: null,
      latestValue: anomaly.latestValue,
      previousValue: anomaly.previousValue,
      deltaValue: anomaly.deltaValue,
      deltaRatio: anomaly.deltaRatio,
      thresholdValue: anomaly.thresholdValue,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId,
      eventType: "sync_opened",
      note: anomaly.message,
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: null,
        projectId,
        routePolicyId,
        tag,
        textMode: null,
        code: anomaly.code,
        severity: anomaly.severity,
        status: "open",
        ownerUserId: nextOwnerUserId,
        followUpStatus: nextFollowUpStatus,
        syncHitCount: nextSyncHitCount,
        escalationStatus: nextEscalationStatus,
        escalatedAt: nextEscalatedAt?.toISOString() ?? null,
        escalationReason: nextEscalationReason,
        latestValue: anomaly.latestValue,
        previousValue: anomaly.previousValue,
        deltaValue: anomaly.deltaValue,
        deltaRatio: anomaly.deltaRatio,
        thresholdValue: anomaly.thresholdValue,
        snapshotId: snapshot.snapshotId,
        entityKey: anomaly.entityKey,
        latestBucketStartAt: anomaly.latestBucketStartAt,
        previousBucketStartAt: anomaly.previousBucketStartAt,
      }),
      createdAt: timestamp,
    });
    if (nextEscalationStatus === "escalated") {
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId,
        eventType: "auto_escalated",
        note: nextEscalationReason,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: "open",
          ownerUserId: nextOwnerUserId,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
          snapshotId: snapshot.snapshotId,
          entityKey: anomaly.entityKey,
          latestBucketStartAt: anomaly.latestBucketStartAt,
          previousBucketStartAt: anomaly.previousBucketStartAt,
        }),
        createdAt: timestamp,
      });
    }
    openedIncidentIds.push(incidentId);
  }

  for (const row of existingRows) {
    if (seenFingerprints.has(row.fingerprint)) {
      continue;
    }
    if (normalizeGatewayAnalysisAnomalyIncidentStatus(row.status) === "resolved") {
      continue;
    }
    const nextEscalationStatus =
      normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated"
        ? "resolved"
        : row.escalationStatus;
    await db
      .update(gatewayAnalysisAnomalyIncidents)
      .set({
        status: "resolved",
        syncHitCount: 0,
        escalationStatus: nextEscalationStatus,
        resolvedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(gatewayAnalysisAnomalyIncidents.id, row.id));
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: row.id,
      eventType: "sync_resolved",
      note: row.summary,
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: null,
        projectId: row.projectId ?? null,
        routePolicyId: row.routePolicyId ?? null,
        tag: row.tag ?? null,
        textMode: null,
        code: row.code,
        severity: row.severity,
        status: "resolved",
        ownerUserId: row.ownerUserId ?? null,
        followUpStatus: row.followUpStatus ?? null,
        syncHitCount: 0,
        escalationStatus: nextEscalationStatus,
        escalatedAt: row.escalatedAt?.toISOString() ?? null,
        escalationReason: row.escalationReason ?? null,
        latestValue: row.latestValue ?? null,
        previousValue: row.previousValue ?? null,
        deltaValue: row.deltaValue ?? null,
        deltaRatio: row.deltaRatio ?? null,
        thresholdValue: row.thresholdValue ?? null,
        snapshotId: snapshot.snapshotId,
      }),
      createdAt: timestamp,
    });
    if (normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated") {
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: row.id,
        eventType: "escalation_cleared",
        note: row.escalationReason ?? "Escalation cleared because hotspot anomaly no longer matched.",
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId: row.projectId ?? null,
          routePolicyId: row.routePolicyId ?? null,
          tag: row.tag ?? null,
          textMode: null,
          code: row.code,
          severity: row.severity,
          status: "resolved",
          ownerUserId: row.ownerUserId ?? null,
          followUpStatus: row.followUpStatus ?? null,
          syncHitCount: 0,
          escalationStatus: "resolved",
          escalatedAt: row.escalatedAt?.toISOString() ?? null,
          escalationReason: row.escalationReason ?? null,
          latestValue: row.latestValue ?? null,
          previousValue: row.previousValue ?? null,
          deltaValue: row.deltaValue ?? null,
          deltaRatio: row.deltaRatio ?? null,
          thresholdValue: row.thresholdValue ?? null,
          snapshotId: snapshot.snapshotId,
        }),
        createdAt: timestamp,
      });
    }
    resolvedIncidentIds.push(row.id);
  }

  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    projectId,
    routePolicyId,
    tag,
    limit: 200,
  });

  return {
    snapshot,
    incidents,
    openedIncidentIds,
    updatedIncidentIds,
    resolvedIncidentIds,
  };
}

export async function acknowledgeGatewayAnalysisAnomalyIncidentForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const timestamp = now();
  await db
    .update(gatewayAnalysisAnomalyIncidents)
    .set({
      status: "acknowledged",
      followUpStatus: "investigating",
      acknowledgedAt: timestamp,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId));
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    incidentId: normalizedIncidentId,
    limit: 1,
  });
  if (!incidents[0]) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  await appendGatewayAnalysisAnomalyIncidentHistory({
    incidentId: normalizedIncidentId,
    eventType: "acknowledged",
    actorUserId: operatorUserId,
    note: "Operator acknowledged incident.",
    metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
      policyId: incidents[0].policyId,
      projectId: incidents[0].projectId,
      routePolicyId: incidents[0].routePolicyId,
      tag: incidents[0].tag,
      textMode: incidents[0].textMode,
      code: incidents[0].code,
      severity: incidents[0].severity,
      status: incidents[0].status,
      ownerUserId: incidents[0].ownerUserId,
      followUpStatus: incidents[0].followUpStatus,
      syncHitCount: incidents[0].syncHitCount,
      escalationStatus: incidents[0].escalationStatus,
      escalatedAt: incidents[0].escalatedAt,
      escalationReason: incidents[0].escalationReason,
      latestExportId: incidents[0].latestExportId,
      previousExportId: incidents[0].previousExportId,
      latestValue: incidents[0].latestValue,
      previousValue: incidents[0].previousValue,
      deltaValue: incidents[0].deltaValue,
      deltaRatio: incidents[0].deltaRatio,
      thresholdValue: incidents[0].thresholdValue,
    }),
    createdAt: timestamp,
  });
  return incidents[0];
}

export async function resolveGatewayAnalysisAnomalyIncidentForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const previousEscalationStatus = normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus);
  const timestamp = now();
  await db
    .update(gatewayAnalysisAnomalyIncidents)
    .set({
      status: "resolved",
      followUpStatus: "done",
      escalationStatus: previousEscalationStatus === "escalated" ? "resolved" : row.escalationStatus,
      resolvedAt: timestamp,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId));
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    incidentId: normalizedIncidentId,
    limit: 1,
  });
  if (!incidents[0]) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  await appendGatewayAnalysisAnomalyIncidentHistory({
    incidentId: normalizedIncidentId,
    eventType: "resolved",
    actorUserId: operatorUserId,
    note: incidents[0].resolutionNote ?? "Operator resolved incident.",
    metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
      policyId: incidents[0].policyId,
      projectId: incidents[0].projectId,
      routePolicyId: incidents[0].routePolicyId,
      tag: incidents[0].tag,
      textMode: incidents[0].textMode,
      code: incidents[0].code,
      severity: incidents[0].severity,
      status: incidents[0].status,
      ownerUserId: incidents[0].ownerUserId,
      followUpStatus: incidents[0].followUpStatus,
      syncHitCount: incidents[0].syncHitCount,
      escalationStatus: incidents[0].escalationStatus,
      escalatedAt: incidents[0].escalatedAt,
      escalationReason: incidents[0].escalationReason,
      latestExportId: incidents[0].latestExportId,
      previousExportId: incidents[0].previousExportId,
      latestValue: incidents[0].latestValue,
      previousValue: incidents[0].previousValue,
      deltaValue: incidents[0].deltaValue,
      deltaRatio: incidents[0].deltaRatio,
      thresholdValue: incidents[0].thresholdValue,
    }),
    createdAt: timestamp,
  });
  if (previousEscalationStatus === "escalated") {
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: normalizedIncidentId,
      eventType: "escalation_cleared",
      actorUserId: operatorUserId,
      note: incidents[0].escalationReason ?? "Escalation cleared by operator resolution.",
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: incidents[0].policyId,
        projectId: incidents[0].projectId,
        routePolicyId: incidents[0].routePolicyId,
        tag: incidents[0].tag,
        textMode: incidents[0].textMode,
        code: incidents[0].code,
        severity: incidents[0].severity,
        status: incidents[0].status,
        ownerUserId: incidents[0].ownerUserId,
        followUpStatus: incidents[0].followUpStatus,
        syncHitCount: incidents[0].syncHitCount,
        escalationStatus: incidents[0].escalationStatus,
        escalatedAt: incidents[0].escalatedAt,
        escalationReason: incidents[0].escalationReason,
        latestExportId: incidents[0].latestExportId,
        previousExportId: incidents[0].previousExportId,
        latestValue: incidents[0].latestValue,
        previousValue: incidents[0].previousValue,
        deltaValue: incidents[0].deltaValue,
        deltaRatio: incidents[0].deltaRatio,
        thresholdValue: incidents[0].thresholdValue,
      }),
      createdAt: timestamp,
    });
  }
  return incidents[0];
}

export async function updateGatewayAnalysisAnomalyIncidentFollowUpForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
  input: GatewayAnalysisAnomalyIncidentFollowUpInput = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const timestamp = now();
  const nextOwnerUserId = Object.prototype.hasOwnProperty.call(input, "ownerUserId") ? input.ownerUserId?.trim() || null : row.ownerUserId;
  const nextFollowUpStatus = input.followUpStatus
    ? normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(input.followUpStatus)
    : normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(row.followUpStatus);
  const nextNote = Object.prototype.hasOwnProperty.call(input, "note")
    ? normalizeOptionalText(input.note, 2_000)
    : row.latestNote;
  const nextResolutionNote = Object.prototype.hasOwnProperty.call(input, "resolutionNote")
    ? normalizeOptionalText(input.resolutionNote, 2_000)
    : row.resolutionNote;

  await db
    .update(gatewayAnalysisAnomalyIncidents)
    .set({
      ownerUserId: nextOwnerUserId,
      followUpStatus: nextFollowUpStatus,
      latestNote: nextNote,
      resolutionNote: nextResolutionNote,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId));

  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    incidentId: normalizedIncidentId,
    limit: 1,
  });
  if (!incidents[0]) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const changedFields = [
    Object.prototype.hasOwnProperty.call(input, "ownerUserId") ? "ownerUserId" : null,
    Object.prototype.hasOwnProperty.call(input, "followUpStatus") ? "followUpStatus" : null,
    Object.prototype.hasOwnProperty.call(input, "note") ? "note" : null,
    Object.prototype.hasOwnProperty.call(input, "resolutionNote") ? "resolutionNote" : null,
  ].filter((value): value is string => Boolean(value));
  await appendGatewayAnalysisAnomalyIncidentHistory({
    incidentId: normalizedIncidentId,
    eventType: "follow_up_updated",
    actorUserId: operatorUserId,
    note: nextResolutionNote ?? nextNote ?? "Operator updated incident follow-up.",
    metadata: {
      ...buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: incidents[0].policyId,
        projectId: incidents[0].projectId,
        routePolicyId: incidents[0].routePolicyId,
        tag: incidents[0].tag,
        textMode: incidents[0].textMode,
        code: incidents[0].code,
        severity: incidents[0].severity,
        status: incidents[0].status,
        ownerUserId: incidents[0].ownerUserId,
        followUpStatus: incidents[0].followUpStatus,
        syncHitCount: incidents[0].syncHitCount,
        escalationStatus: incidents[0].escalationStatus,
        escalatedAt: incidents[0].escalatedAt,
        escalationReason: incidents[0].escalationReason,
        latestExportId: incidents[0].latestExportId,
        previousExportId: incidents[0].previousExportId,
        latestValue: incidents[0].latestValue,
        previousValue: incidents[0].previousValue,
        deltaValue: incidents[0].deltaValue,
        deltaRatio: incidents[0].deltaRatio,
        thresholdValue: incidents[0].thresholdValue,
      }),
      changedFields,
      previousOwnerUserId: row.ownerUserId ?? null,
      previousFollowUpStatus: normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(row.followUpStatus),
      previousSyncHitCount: row.syncHitCount,
      previousEscalationStatus: normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus),
      previousEscalatedAt: row.escalatedAt?.toISOString() ?? null,
      previousEscalationReason: row.escalationReason ?? null,
      previousLatestNote: row.latestNote ?? null,
      previousResolutionNote: row.resolutionNote ?? null,
    },
    createdAt: timestamp,
  });
  return incidents[0];
}

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

async function writeProviderPayloadObject(payload: GatewayProviderAccountPayload, objectKey: string) {
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

export async function noteProviderAccountFailure(args: {
  providerAccountId: string;
  routePolicy: GatewayRoutePolicyConfig;
  message: string;
}) {
  const counterKey = `ai-gateway:provider:${args.providerAccountId}:failure-count`;
  const openKey = `ai-gateway:provider:${args.providerAccountId}:breaker-open`;
  const failureCount = await redis.incr(counterKey);
  await redis.expire(counterKey, Math.max(30, args.routePolicy.circuitBreakerCooldownSeconds));

  if (failureCount >= args.routePolicy.circuitBreakerThreshold) {
    await invalidateCachedProviderModels(args.providerAccountId);
    await redis.set(openKey, "1", "EX", Math.max(30, args.routePolicy.circuitBreakerCooldownSeconds));
    await db
      .update(gatewayProviderAccounts)
      .set({
        status: "cooling",
        cooldownUntil: new Date(Date.now() + args.routePolicy.circuitBreakerCooldownSeconds * 1000),
        lastError: args.message.slice(0, 1000),
        failureCount,
        updatedAt: now(),
      })
      .where(eq(gatewayProviderAccounts.id, args.providerAccountId));
  } else {
    await db
      .update(gatewayProviderAccounts)
      .set({
        lastError: args.message.slice(0, 1000),
        failureCount,
        updatedAt: now(),
      })
      .where(eq(gatewayProviderAccounts.id, args.providerAccountId));
  }
}

export async function noteProviderAccountSuccess(providerAccountId: string) {
  const counterKey = `ai-gateway:provider:${providerAccountId}:failure-count`;
  const openKey = `ai-gateway:provider:${providerAccountId}:breaker-open`;
  await redis.del(counterKey, openKey);
  await invalidateCachedProviderModels(providerAccountId);
  await db
    .update(gatewayProviderAccounts)
    .set({
      status: "active",
      cooldownUntil: null,
      lastError: null,
      failureCount: 0,
      lastHealthCheckAt: now(),
      updatedAt: now(),
    })
    .where(eq(gatewayProviderAccounts.id, providerAccountId));
}
