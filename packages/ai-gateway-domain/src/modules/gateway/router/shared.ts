import { z } from "zod";

import {
  gatewayAnalysisAnomalyIncidentFollowUpStatuses,
  gatewayAnalysisAnomalyRemediationExecutionModes,
  gatewayAnalysisAnomalyRemediationRunStatuses,
  gatewayAnalysisAnomalyPolicyStatuses,
  gatewayAggregatorApiModes,
  gatewayAnalysisAnomalyProfileKeys,
  gatewayExecutionModes,
  gatewayAnalysisExportTextModes,
  gatewayProviderSourceKinds,
  gatewayProtocolProfiles,
  gatewayRelayEndpointKinds,
  gatewayRoutingAnomalyAutoRemediationActionKeys,
  gatewayRateLimitHotspotAutoRemediationActionKeys,
  gatewayProtocolFamilies,
  gatewayProviderAccountStatuses,
  gatewayProviderAdapters,
  gatewayRouteSelectionStrategies,
  gatewayWebReverseAccessModes,
} from "@neuro/contracts";

const providerAccountBodySchema = z.object({
  label: z.string().trim().min(1).max(120),
  adapter: z.enum(gatewayProviderAdapters),
  protocolFamily: z.enum(gatewayProtocolFamilies),
  protocolProfile: z.enum(gatewayProtocolProfiles).nullable().optional(),
  status: z.enum(gatewayProviderAccountStatuses).optional(),
  sourceProfile: z
    .object({
      sourceKind: z.enum(gatewayProviderSourceKinds),
      aggregatorApiMode: z.enum(gatewayAggregatorApiModes).nullable().optional(),
      webReverseAccessMode: z.enum(gatewayWebReverseAccessModes).nullable().optional(),
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .nullable()
    .optional(),
  executionMode: z.enum(gatewayExecutionModes).nullable().optional(),
  endpointExecutionModes: z
    .record(z.enum(gatewayRelayEndpointKinds), z.enum(gatewayExecutionModes))
    .nullable()
    .optional(),
  payload: z.record(z.string(), z.unknown()),
});

const providerSourceProfilePatchBodySchema = z.object({
  sourceProfile: z.object({
    sourceKind: z.enum(gatewayProviderSourceKinds),
    aggregatorApiMode: z.enum(gatewayAggregatorApiModes).nullable().optional(),
    webReverseAccessMode: z.enum(gatewayWebReverseAccessModes).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  }),
});

const providerSourceProfileBackfillBodySchema = z.object({
  providerAccountIds: z.array(z.string().trim().min(1).max(120)).max(500).nullable().optional(),
  onlyMissing: z.boolean().optional(),
});

const modelAliasBodySchema = z.object({
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  alias: z.string().trim().min(1).max(120),
  providerAccountId: z.string().trim().min(1).max(120),
  upstreamModel: z.string().trim().min(1).max(120).nullable().optional(),
  priority: z.number().int().min(0).optional(),
  weight: z.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
});

const rateLimitDefinitionSchema = z.object({
  windowSeconds: z.number().int().min(1).max(86400),
  maxRequests: z.number().int().min(1).max(1_000_000),
});

const routePolicyHotspotAutoRemediationSchema = z.object({
  enabled: z.boolean().optional(),
  intervalMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  dryRunFirst: z.boolean().optional(),
  requireAlertBeforeApply: z.boolean().optional(),
  freezeOnProviderHealthDegrade: z.boolean().optional(),
  maxApplyRunsPerIncident: z.number().int().min(1).max(100).nullable().optional(),
  actionByCode: z
    .record(
      z.string().trim().min(1).max(120),
      z.enum(gatewayRateLimitHotspotAutoRemediationActionKeys).nullable(),
    )
    .nullable()
    .optional(),
});

const routePolicyRoutingAutoRemediationSchema = z.object({
  enabled: z.boolean().optional(),
  intervalMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  dryRunFirst: z.boolean().optional(),
  requireAlertBeforeApply: z.boolean().optional(),
  freezeOnProviderHealthDegrade: z.boolean().optional(),
  maxApplyRunsPerIncident: z.number().int().min(1).max(100).nullable().optional(),
  actionKeysByCode: z
    .record(
      z.string().trim().min(1).max(120),
      z.array(z.enum(gatewayRoutingAnomalyAutoRemediationActionKeys)).nullable(),
    )
    .nullable()
    .optional(),
});

const routePolicyBodySchema = z.object({
  projectId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
  config: z.object({
    stickySessions: z.boolean().optional(),
    preStreamFallbackEnabled: z.boolean().optional(),
    selectionStrategy: z.enum(gatewayRouteSelectionStrategies).optional(),
    providerLoadAwareRoutingEnabled: z.boolean().optional(),
    maxConcurrentRequests: z.number().int().min(0).nullable().optional(),
    providerMaxConcurrentRequests: z.number().int().min(0).nullable().optional(),
    rateLimitWindowSeconds: z.number().int().min(0).nullable().optional(),
    rateLimitMaxRequests: z.number().int().min(0).nullable().optional(),
    apiKeyRateLimit: rateLimitDefinitionSchema.nullable().optional(),
    modelRateLimits: z
      .record(z.string().trim().min(1).max(120), rateLimitDefinitionSchema)
      .nullable()
      .optional(),
    endpointRateLimits: z
      .record(z.string().trim().min(1).max(120), rateLimitDefinitionSchema)
      .nullable()
      .optional(),
    circuitBreakerThreshold: z.number().int().min(0).optional(),
    circuitBreakerCooldownSeconds: z.number().int().min(0).optional(),
    allowedProviderAccountIds: z.array(z.string().trim().min(1).max(120)).nullable().optional(),
    allowedProtocolFamilies: z.array(z.enum(gatewayProtocolFamilies)).nullable().optional(),
    allowedModelIds: z.array(z.string().trim().min(1).max(120)).nullable().optional(),
    blockedModelIds: z.array(z.string().trim().min(1).max(120)).nullable().optional(),
    maxRequestBodyBytes: z.number().int().min(1).max(1_000_000_000).nullable().optional(),
    streamIdleTimeoutSeconds: z.number().int().min(1).max(300).nullable().optional(),
    totalRequestTimeoutSeconds: z.number().int().min(1).max(300).nullable().optional(),
    maxStreamHeartbeatGapSeconds: z.number().int().min(1).max(60).nullable().optional(),
    routingAnomalyAutoRemediation: routePolicyRoutingAutoRemediationSchema.nullable().optional(),
    rateLimitHotspotAutoRemediation: routePolicyHotspotAutoRemediationSchema.nullable().optional(),
    fallbackHttpStatuses: z.array(z.number().int().min(100).max(599)).nullable().optional(),
    fallbackErrorCodes: z.array(z.string().trim().min(1).max(120)).nullable().optional(),
  }),
});

const analysisExportPersistBodySchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(32).nullable().optional(),
  retentionExpiresAt: z.string().trim().min(1).max(120).nullable().optional(),
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  routePolicyId: z.string().trim().min(1).max(120).nullable().optional(),
  providerAccountId: z.string().trim().min(1).max(120).nullable().optional(),
  sessionId: z.string().trim().min(1).max(120).nullable().optional(),
  apiKeyId: z.string().trim().min(1).max(120).nullable().optional(),
  responseId: z.string().trim().min(1).max(120).nullable().optional(),
  protocolFamily: z.enum(gatewayProtocolFamilies).nullable().optional(),
  status: z.enum(["running", "completed", "failed", "cancelled"]).nullable().optional(),
  endpointKind: z.string().trim().min(1).max(120).nullable().optional(),
  stream: z.boolean().nullable().optional(),
  errorCode: z.string().trim().min(1).max(120).nullable().optional(),
  fallbackEligible: z.boolean().nullable().optional(),
  createdFrom: z.string().trim().min(1).max(120).nullable().optional(),
  createdTo: z.string().trim().min(1).max(120).nullable().optional(),
  artifactAvailable: z.boolean().nullable().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  textMode: z.enum(gatewayAnalysisExportTextModes).optional(),
  maxTextChars: z.number().int().min(0).max(32000).optional(),
});

const analysisExportMetadataBodySchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(32).nullable().optional(),
  retentionExpiresAt: z.string().trim().min(1).max(120).nullable().optional(),
});

const analysisExportCleanupBodySchema = z.object({
  limit: z.number().int().min(1).max(500).nullable().optional(),
  includePinned: z.boolean().nullable().optional(),
  dryRun: z.boolean().nullable().optional(),
});

const rateLimitHotspotSnapshotBodySchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  lookbackHours: z.number().int().min(0).max(24 * 365).nullable().optional(),
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  routePolicyId: z.string().trim().min(1).max(120).nullable().optional(),
  providerAccountId: z.string().trim().min(1).max(120).nullable().optional(),
  sessionId: z.string().trim().min(1).max(120).nullable().optional(),
  apiKeyId: z.string().trim().min(1).max(120).nullable().optional(),
  responseId: z.string().trim().min(1).max(120).nullable().optional(),
  protocolFamily: z.enum(gatewayProtocolFamilies).nullable().optional(),
  endpointKind: z.string().trim().min(1).max(120).nullable().optional(),
  errorCode: z.string().trim().min(1).max(120).nullable().optional(),
  createdFrom: z.string().trim().min(1).max(120).nullable().optional(),
  createdTo: z.string().trim().min(1).max(120).nullable().optional(),
  limit: z.number().int().min(1).max(1000).nullable().optional(),
});

const rateLimitHotspotAnomalySnapshotBodySchema = rateLimitHotspotSnapshotBodySchema.extend({
  profileKey: z.enum(gatewayAnalysisAnomalyProfileKeys).nullable().optional(),
  totalRateLimitedRequestsWarningThreshold: z.number().nonnegative().nullable().optional(),
  totalRateLimitedRequestsCriticalThreshold: z.number().nonnegative().nullable().optional(),
  totalRateLimitedRequestsDeltaRatioThreshold: z.number().nonnegative().nullable().optional(),
  topCodeShareWarningThreshold: z.number().nonnegative().nullable().optional(),
  topCodeShareCriticalThreshold: z.number().nonnegative().nullable().optional(),
  topProjectShareWarningThreshold: z.number().nonnegative().nullable().optional(),
  topProjectShareCriticalThreshold: z.number().nonnegative().nullable().optional(),
  topApiKeyShareWarningThreshold: z.number().nonnegative().nullable().optional(),
  topApiKeyShareCriticalThreshold: z.number().nonnegative().nullable().optional(),
  topRequestedModelShareWarningThreshold: z.number().nonnegative().nullable().optional(),
  topRequestedModelShareCriticalThreshold: z.number().nonnegative().nullable().optional(),
  topEndpointShareWarningThreshold: z.number().nonnegative().nullable().optional(),
  topEndpointShareCriticalThreshold: z.number().nonnegative().nullable().optional(),
});

const providerRoutingAnomalySyncBodySchema = z.object({
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  routePolicyId: z.string().trim().min(1).max(120).nullable().optional(),
  providerAccountId: z.string().trim().min(1).max(120).nullable().optional(),
  sessionId: z.string().trim().min(1).max(120).nullable().optional(),
  apiKeyId: z.string().trim().min(1).max(120).nullable().optional(),
  responseId: z.string().trim().min(1).max(120).nullable().optional(),
  protocolFamily: z.enum(gatewayProtocolFamilies).nullable().optional(),
  endpointKind: z.string().trim().min(1).max(120).nullable().optional(),
  status: z.enum(["running", "completed", "failed", "cancelled"]).nullable().optional(),
  createdFrom: z.string().trim().min(1).max(120).nullable().optional(),
  createdTo: z.string().trim().min(1).max(120).nullable().optional(),
  limit: z.number().int().min(1).max(1000).nullable().optional(),
  profileKey: z.enum(gatewayAnalysisAnomalyProfileKeys).nullable().optional(),
  routingScoreWarningThreshold: z.number().nonnegative().nullable().optional(),
  routingScoreCriticalThreshold: z.number().nonnegative().nullable().optional(),
  degradedRouteWarningThreshold: z.number().nonnegative().nullable().optional(),
  degradedRouteCriticalThreshold: z.number().nonnegative().nullable().optional(),
  saturatedRouteWarningThreshold: z.number().nonnegative().nullable().optional(),
  saturatedRouteCriticalThreshold: z.number().nonnegative().nullable().optional(),
  breakerOpenRouteWarningThreshold: z.number().nonnegative().nullable().optional(),
  breakerOpenRouteCriticalThreshold: z.number().nonnegative().nullable().optional(),
});

const anomalyPolicyBodySchema = z.object({
  id: z.string().trim().min(1).max(120).nullable().optional(),
  name: z.string().trim().min(1).max(120),
  status: z.enum(gatewayAnalysisAnomalyPolicyStatuses).nullable().optional(),
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  routePolicyId: z.string().trim().min(1).max(120).nullable().optional(),
  tag: z.string().trim().min(1).max(40).nullable().optional(),
  textMode: z.enum(gatewayAnalysisExportTextModes).nullable().optional(),
  profileKey: z.enum(gatewayAnalysisAnomalyProfileKeys).nullable().optional(),
  thresholds: z
    .object({
      failureRateWarningThreshold: z.number().nonnegative().optional(),
      failureRateCriticalThreshold: z.number().nonnegative().optional(),
      failureRateDeltaRatioThreshold: z.number().nonnegative().optional(),
      completionRateWarningThreshold: z.number().nonnegative().optional(),
      completionRateCriticalThreshold: z.number().nonnegative().optional(),
      completionRateDeltaValueThreshold: z.number().optional(),
      responseArtifactCoverageWarningThreshold: z.number().nonnegative().optional(),
      responseArtifactCoverageCriticalThreshold: z.number().nonnegative().optional(),
      responseArtifactCoverageDeltaValueThreshold: z.number().optional(),
      requestArtifactCoverageWarningThreshold: z.number().nonnegative().optional(),
      requestArtifactCoverageCriticalThreshold: z.number().nonnegative().optional(),
      requestArtifactCoverageDeltaValueThreshold: z.number().optional(),
      tokensPerSampleWarningDeltaRatioThreshold: z.number().nonnegative().optional(),
      tokensPerSampleCriticalDeltaRatioThreshold: z.number().nonnegative().optional(),
      tokensPerSampleCriticalAbsoluteThreshold: z.number().nonnegative().optional(),
    })
    .nullable()
    .optional(),
  autoSyncEnabled: z.boolean().nullable().optional(),
  autoSyncIntervalMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  autoEscalateEnabled: z.boolean().nullable().optional(),
  escalateSeverityThreshold: z.enum(["warning", "critical"]).nullable().optional(),
  escalateAfterSyncCount: z.number().int().min(1).max(1000).nullable().optional(),
  autoEscalateOwnerUserId: z.string().trim().min(1).max(120).nullable().optional(),
  autoEscalateFollowUpStatus: z.enum(gatewayAnalysisAnomalyIncidentFollowUpStatuses).nullable().optional(),
  autoRemediationEnabled: z.boolean().nullable().optional(),
  autoRemediationIntervalMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  autoRemediationDryRunFirst: z.boolean().nullable().optional(),
  autoRemediationActionKeys: z.array(z.string().trim().min(1).max(120)).max(64).nullable().optional(),
  autoRemediationMaxApplyRunsPerIncident: z.number().int().min(1).max(1000).nullable().optional(),
  autoRemediationRequireAlertBeforeApply: z.boolean().nullable().optional(),
  autoRemediationFreezeOnProviderHealthDegrade: z.boolean().nullable().optional(),
  alertingEnabled: z.boolean().nullable().optional(),
  alertIntervalMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  notifyOperatorsOnEscalation: z.boolean().nullable().optional(),
  notifyOwnerOnEscalation: z.boolean().nullable().optional(),
});

const anomalyIncidentSyncBodySchema = z.object({
  policyId: z.string().trim().min(1).max(120).nullable().optional(),
  label: z.string().trim().min(1).max(120).nullable().optional(),
  tag: z.string().trim().min(1).max(40).nullable().optional(),
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  status: z.string().trim().min(1).max(40).nullable().optional(),
  textMode: z.enum(gatewayAnalysisExportTextModes).nullable().optional(),
  createdFrom: z.string().trim().min(1).max(120).nullable().optional(),
  createdTo: z.string().trim().min(1).max(120).nullable().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  profileKey: z.enum(gatewayAnalysisAnomalyProfileKeys).nullable().optional(),
  failureRateWarningThreshold: z.number().nonnegative().nullable().optional(),
  failureRateCriticalThreshold: z.number().nonnegative().nullable().optional(),
  failureRateDeltaRatioThreshold: z.number().nonnegative().nullable().optional(),
  completionRateWarningThreshold: z.number().nonnegative().nullable().optional(),
  completionRateCriticalThreshold: z.number().nonnegative().nullable().optional(),
  completionRateDeltaValueThreshold: z.number().nullable().optional(),
  responseArtifactCoverageWarningThreshold: z.number().nonnegative().nullable().optional(),
  responseArtifactCoverageCriticalThreshold: z.number().nonnegative().nullable().optional(),
  responseArtifactCoverageDeltaValueThreshold: z.number().nullable().optional(),
  requestArtifactCoverageWarningThreshold: z.number().nonnegative().nullable().optional(),
  requestArtifactCoverageCriticalThreshold: z.number().nonnegative().nullable().optional(),
  requestArtifactCoverageDeltaValueThreshold: z.number().nullable().optional(),
  tokensPerSampleWarningDeltaRatioThreshold: z.number().nonnegative().nullable().optional(),
  tokensPerSampleCriticalDeltaRatioThreshold: z.number().nonnegative().nullable().optional(),
  tokensPerSampleCriticalAbsoluteThreshold: z.number().nonnegative().nullable().optional(),
});

const anomalyIncidentFollowUpBodySchema = z.object({
  ownerUserId: z.string().trim().min(1).max(120).nullable().optional(),
  followUpStatus: z.enum(gatewayAnalysisAnomalyIncidentFollowUpStatuses).nullable().optional(),
  note: z.string().trim().min(1).max(2000).nullable().optional(),
  resolutionNote: z.string().trim().min(1).max(2000).nullable().optional(),
});

const anomalyPolicySweepBodySchema = z.object({
  policyId: z.string().trim().min(1).max(120).nullable().optional(),
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  routePolicyId: z.string().trim().min(1).max(120).nullable().optional(),
  status: z.enum(gatewayAnalysisAnomalyPolicyStatuses).nullable().optional(),
  tag: z.string().trim().min(1).max(40).nullable().optional(),
  textMode: z.enum(gatewayAnalysisExportTextModes).nullable().optional(),
  autoSyncEnabled: z.boolean().nullable().optional(),
  autoEscalateEnabled: z.boolean().nullable().optional(),
  autoRemediationEnabled: z.boolean().nullable().optional(),
  alertingEnabled: z.boolean().nullable().optional(),
  dueOnly: z.boolean().nullable().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const anomalyRemediationSweepBodySchema = z.object({
  incidentId: z.string().trim().min(1).max(120).nullable().optional(),
  policyId: z.string().trim().min(1).max(120).nullable().optional(),
  projectId: z.string().trim().min(1).max(120).nullable().optional(),
  ownerUserId: z.string().trim().min(1).max(120).nullable().optional(),
  tag: z.string().trim().min(1).max(40).nullable().optional(),
  textMode: z.enum(gatewayAnalysisExportTextModes).nullable().optional(),
  status: z.string().trim().min(1).max(40).nullable().optional(),
  followUpStatus: z.enum(gatewayAnalysisAnomalyIncidentFollowUpStatuses).nullable().optional(),
  escalationStatus: z.enum(["none", "escalated", "resolved"]).nullable().optional(),
  code: z.string().trim().min(1).max(120).nullable().optional(),
  severity: z.enum(["warning", "critical"]).nullable().optional(),
  actionKey: z.string().trim().min(1).max(120).nullable().optional(),
  executionMode: z.enum(gatewayAnalysisAnomalyRemediationExecutionModes).nullable().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const anomalyRemediationRunBodySchema = z.object({
  actionKey: z.string().trim().min(1).max(120),
  dryRun: z.boolean().nullable().optional(),
  note: z.string().trim().min(1).max(2000).nullable().optional(),
  incidentFollowUp: anomalyIncidentFollowUpBodySchema.partial().nullable().optional(),
  routePolicyPatch: z
    .object({
      providerMaxConcurrentRequests: z.number().int().min(1).max(100000).nullable().optional(),
      preStreamFallbackEnabled: z.boolean().nullable().optional(),
      allowedProviderAccountIds: z.array(z.string().trim().min(1).max(120)).max(128).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const anomalyRemediationEffectivenessSnapshotBodySchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  incidentId: z.string().trim().min(1).max(120).nullable().optional(),
  policyId: z.string().trim().min(1).max(120).nullable().optional(),
  routePolicyId: z.string().trim().min(1).max(120).nullable().optional(),
  actionKey: z.string().trim().min(1).max(120).nullable().optional(),
  status: z.enum(gatewayAnalysisAnomalyRemediationRunStatuses).nullable().optional(),
  executionMode: z.enum(gatewayAnalysisAnomalyRemediationExecutionModes).nullable().optional(),
  dryRun: z.boolean().nullable().optional(),
  createdFrom: z.string().trim().min(1).max(120).nullable().optional(),
  createdTo: z.string().trim().min(1).max(120).nullable().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  lookbackHours: z.number().int().min(1).max(24 * 365).nullable().optional(),
  windowMinutes: z.number().int().min(5).max(10080).nullable().optional(),
});

const anomalyRemediationEffectivenessAnomalySnapshotBodySchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  routePolicyId: z.string().trim().min(1).max(120).nullable().optional(),
  actionKey: z.string().trim().min(1).max(120).nullable().optional(),
  createdFrom: z.string().trim().min(1).max(120).nullable().optional(),
  createdTo: z.string().trim().min(1).max(120).nullable().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  lookbackHours: z.number().int().min(1).max(24 * 365).nullable().optional(),
  profileKey: z.enum(gatewayAnalysisAnomalyProfileKeys).nullable().optional(),
  impactedRunRateWarningThreshold: z.number().nonnegative().nullable().optional(),
  impactedRunRateCriticalThreshold: z.number().nonnegative().nullable().optional(),
  unavailableRunRateWarningThreshold: z.number().nonnegative().nullable().optional(),
  unavailableRunRateCriticalThreshold: z.number().nonnegative().nullable().optional(),
  completionRateRegressedWarningThreshold: z.number().nonnegative().nullable().optional(),
  completionRateRegressedCriticalThreshold: z.number().nonnegative().nullable().optional(),
  failureRateRegressedWarningThreshold: z.number().nonnegative().nullable().optional(),
  failureRateRegressedCriticalThreshold: z.number().nonnegative().nullable().optional(),
  requestArtifactRegressedWarningThreshold: z.number().nonnegative().nullable().optional(),
  requestArtifactRegressedCriticalThreshold: z.number().nonnegative().nullable().optional(),
  responseArtifactRegressedWarningThreshold: z.number().nonnegative().nullable().optional(),
  responseArtifactRegressedCriticalThreshold: z.number().nonnegative().nullable().optional(),
  firstTokenLatencyRegressedWarningThreshold: z.number().nonnegative().nullable().optional(),
  firstTokenLatencyRegressedCriticalThreshold: z.number().nonnegative().nullable().optional(),
  totalTokensRegressedWarningThreshold: z.number().nonnegative().nullable().optional(),
  totalTokensRegressedCriticalThreshold: z.number().nonnegative().nullable().optional(),
});

function readQueryString(query: Record<string, unknown>, key: string) {
  const value = query[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readQueryBoolean(query: Record<string, unknown>, key: string) {
  const value = query[key];
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function readQueryLimit(query: Record<string, unknown>, fallback: number) {
  const parsed = Number(query.limit ?? fallback);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function readQueryInt(query: Record<string, unknown>, key: string) {
  const parsed = Number(query[key]);
  return Number.isFinite(parsed) ? Math.floor(parsed) : null;
}

function readQueryNumber(query: Record<string, unknown>, key: string) {
  const parsed = Number(query[key]);
  return Number.isFinite(parsed) ? parsed : null;
}

function readGatewayRequestAuditFilters(query: Record<string, unknown>, fallbackLimit: number) {
  return {
    projectId: readQueryString(query, "projectId"),
    routePolicyId: readQueryString(query, "routePolicyId"),
    providerAccountId: readQueryString(query, "providerAccountId"),
    sessionId: readQueryString(query, "sessionId"),
    apiKeyId: readQueryString(query, "apiKeyId"),
    responseId: readQueryString(query, "responseId"),
    protocolFamily: readQueryString(query, "protocolFamily") as any,
    status: readQueryString(query, "status") as any,
    endpointKind: readQueryString(query, "endpointKind"),
    stream: readQueryBoolean(query, "stream"),
    errorCode: readQueryString(query, "errorCode"),
    fallbackEligible: readQueryBoolean(query, "fallbackEligible"),
    createdFrom: readQueryString(query, "createdFrom"),
    createdTo: readQueryString(query, "createdTo"),
    limit: readQueryLimit(query, fallbackLimit),
  };
}

export {
  providerAccountBodySchema,
  providerSourceProfilePatchBodySchema,
  providerSourceProfileBackfillBodySchema,
  modelAliasBodySchema,
  routePolicyBodySchema,
  analysisExportPersistBodySchema,
  analysisExportMetadataBodySchema,
  analysisExportCleanupBodySchema,
  rateLimitHotspotSnapshotBodySchema,
  rateLimitHotspotAnomalySnapshotBodySchema,
  providerRoutingAnomalySyncBodySchema,
  anomalyPolicyBodySchema,
  anomalyIncidentSyncBodySchema,
  anomalyIncidentFollowUpBodySchema,
  anomalyPolicySweepBodySchema,
  anomalyRemediationSweepBodySchema,
  anomalyRemediationRunBodySchema,
  anomalyRemediationEffectivenessSnapshotBodySchema,
  anomalyRemediationEffectivenessAnomalySnapshotBodySchema,
  readQueryString,
  readQueryBoolean,
  readQueryLimit,
  readQueryInt,
  readQueryNumber,
  readGatewayRequestAuditFilters,
};
