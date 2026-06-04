import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  acknowledgeGatewayAnalysisAnomalyIncidentForOperator,
  createGatewayProviderAccountForOperator,
  backfillGatewayProviderSourceProfilesForOperator,
  exportGatewayAnalysisRowsForOperator,
  getGatewayAnalysisExportAnomalyReportForOperator,
  getGatewayAnalysisExportBaselineReportForOperator,
  getGatewayAnalysisAnomalyIncidentSummaryForOperator,
  getGatewayAnalysisAnomalyPolicySummaryForOperator,
  getGatewayProviderRoutingAnalysisAnomalyReportForOperator,
  getGatewayProviderRoutingAnalysisSummaryForOperator,
  getGatewayAnalysisAnomalyIncidentRemediationPlanForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessForOperator,
  listGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotsForOperator,
  persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator,
  getGatewayAnalysisAnomalyRemediationRunImpactForOperator,
  getGatewayAnalysisAnomalyRemediationRunSummaryForOperator,
  captureGatewayAnalysisAnomalyRemediationRunImpactForOperator,
  listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator,
  persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator,
  executeGatewayAnalysisAnomalyIncidentRemediationForOperator,
  listGatewayAnalysisAnomalyIncidentHistoryForOperator,
  listGatewayAnalysisAnomalyIncidentAlertQueueForOperator,
  listGatewayAnalysisAnomalyRemediationQueueForOperator,
  listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator,
  getGatewayAnalysisExportTrendReportForOperator,
  getGatewayAnalysisExportTimelineReportForOperator,
  getGatewayPromptCacheSummaryForOperator,
  getGatewayPromptCacheTrendReportForOperator,
  getGatewayAnalysisSummaryForOperator,
  getGatewayRateLimitHotspotSnapshotForOperator,
  getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator,
  getGatewayRateLimitHotspotSnapshotTrendReportForOperator,
  getGatewayRateLimitHotspotAnomalySnapshotForOperator,
  getGatewayRateLimitHotspotAnomalyReportForOperator,
  getGatewayRateLimitHotspotTrendReportForOperator,
  listGatewayRateLimitHotspotAnomalySnapshotsForOperator,
  listGatewayRateLimitHotspotSnapshotsForOperator,
  persistGatewayRateLimitHotspotAnomalySnapshotForOperator,
  persistGatewayRateLimitHotspotSnapshotForOperator,
  summarizeGatewayRateLimitHotspotsForOperator,
  getGatewayPersistedAnalysisExportDiffForOperator,
  getGatewayPersistedAnalysisExportInventorySummaryForOperator,
  getGatewayPersistedAnalysisExportForOperator,
  getGatewayRequestArtifactsForOperator,
  getGatewayRequestAuditForOperator,
  getGatewaySessionDetailForOperator,
  getGatewayProviderHealthSummaryForOperator,
  getGatewayReadinessReport,
  listGatewayAnalysisAnomalyIncidentsForOperator,
  listGatewayAnalysisAnomalyPoliciesForOperator,
  listGatewayAnalysisSamplesForOperator,
  listGatewayPersistedAnalysisExportsForOperator,
  listGatewayOperatorCatalog,
  getGatewayProviderInventoryForOperator,
  getGatewayModelAssociationMatrixForOperator,
  getGatewayCostOverviewForOperator,
  listGatewayProviderHealthForOperator,
  listGatewayRequestAuditsForOperator,
  listGatewayRequestAuditSummaryForOperator,
  listGatewayRuntimePressureForOperator,
  listGatewaySessionsForOperator,
  persistGatewayAnalysisExportForOperator,
  probeGatewayProviderAccountForOperator,
  resolveGatewayAnalysisAnomalyIncidentForOperator,
  runGatewayPersistedAnalysisExportCleanupForOperator,
  runGatewayCoolingSweepForOperator,
  saveGatewayModelAliasForOperator,
  saveGatewayAnalysisAnomalyPolicyForOperator,
  saveGatewayRoutePolicyForOperator,
  sweepGatewayAnalysisAnomalyPoliciesForOperator,
  sweepGatewayAnalysisAnomalyRemediationsForOperator,
  syncGatewayAnalysisAnomalyIncidentsForOperator,
  syncGatewayAnalysisAnomalyPolicyForOperator,
  syncGatewayProviderRoutingAnalysisAnomalyIncidentsForOperator,
  updateGatewayAnalysisAnomalyIncidentFollowUpForOperator,
  updateGatewayPersistedAnalysisExportMetadataForOperator,
  updateGatewayProviderAccountForOperator,
  patchGatewayProviderSourceProfileForOperator,
} from "@/modules/gateway/service";
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
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";

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

// Deprecated guard: gatewayRouter is only a migration-period legacy HTTP surface.
// Do not register it in services/account-api or make it a new owner path.
// The Rust gateway/ service is the formal AI gateway owner; Web/operator callers
// should use the Rust gateway internal API instead of this legacy router.
export const gatewayRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/internal/gateway/catalog", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      catalog: await listGatewayOperatorCatalog(userId, providerUserId),
    };
  });

  app.get("/v1/internal/gateway/provider-inventory", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      inventory: await getGatewayProviderInventoryForOperator(userId, providerUserId),
    };
  });

  app.get("/v1/internal/gateway/model-associations", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      matrix: await getGatewayModelAssociationMatrixForOperator(userId, providerUserId),
    };
  });

  app.get("/v1/internal/gateway/costs", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      overview: await getGatewayCostOverviewForOperator(userId, providerUserId),
    };
  });

  app.get("/v1/internal/gateway/requests", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      requests: await listGatewayRequestAuditsForOperator(
        userId,
        providerUserId,
        readGatewayRequestAuditFilters(query, 100),
      ),
    };
  });

  app.get("/v1/internal/gateway/requests/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await listGatewayRequestAuditSummaryForOperator(
        userId,
        providerUserId,
        readGatewayRequestAuditFilters(query, 200),
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/samples", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      samples: await listGatewayAnalysisSamplesForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 200),
        artifactAvailable: readQueryBoolean(query, "artifactAvailable"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisSummaryForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 1000),
        artifactAvailable: readQueryBoolean(query, "artifactAvailable"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/prompt-cache/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayPromptCacheSummaryForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 1000),
        inputPricePerMillion: readQueryNumber(query, "inputPricePerMillion"),
      }),
    };
  });

  app.get(
    "/v1/internal/gateway/analysis/prompt-cache/trend-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayPromptCacheTrendReportForOperator(userId, providerUserId, {
          ...readGatewayRequestAuditFilters(query, 1000),
          inputPricePerMillion: readQueryNumber(query, "inputPricePerMillion"),
          bucketSize: readQueryString(query, "bucketSize"),
        }),
      };
    },
  );

  app.get("/v1/internal/gateway/analysis/provider-routing/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayProviderRoutingAnalysisSummaryForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 1000),
      }),
    };
  });

  app.get(
    "/v1/internal/gateway/analysis/provider-routing/anomaly-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayProviderRoutingAnalysisAnomalyReportForOperator(userId, providerUserId, {
          ...readGatewayRequestAuditFilters(query, 1000),
          profileKey: readQueryString(query, "profileKey") as any,
          thresholds: {
            routingScoreWarningThreshold: readQueryNumber(query, "routingScoreWarningThreshold") ?? undefined,
            routingScoreCriticalThreshold: readQueryNumber(query, "routingScoreCriticalThreshold") ?? undefined,
            degradedRouteWarningThreshold: readQueryNumber(query, "degradedRouteWarningThreshold") ?? undefined,
            degradedRouteCriticalThreshold: readQueryNumber(query, "degradedRouteCriticalThreshold") ?? undefined,
            saturatedRouteWarningThreshold: readQueryNumber(query, "saturatedRouteWarningThreshold") ?? undefined,
            saturatedRouteCriticalThreshold: readQueryNumber(query, "saturatedRouteCriticalThreshold") ?? undefined,
            breakerOpenRouteWarningThreshold: readQueryNumber(query, "breakerOpenRouteWarningThreshold") ?? undefined,
            breakerOpenRouteCriticalThreshold: readQueryNumber(query, "breakerOpenRouteCriticalThreshold") ?? undefined,
          },
        }),
      };
    },
  );

  app.post(
    "/v1/internal/gateway/analysis/provider-routing/anomaly-incidents/sync",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const body = providerRoutingAnomalySyncBodySchema.parse(request.body ?? {});
      return {
        sync: await syncGatewayProviderRoutingAnalysisAnomalyIncidentsForOperator(userId, providerUserId, {
          projectId: body.projectId ?? undefined,
          routePolicyId: body.routePolicyId ?? undefined,
          providerAccountId: body.providerAccountId ?? undefined,
          sessionId: body.sessionId ?? undefined,
          apiKeyId: body.apiKeyId ?? undefined,
          responseId: body.responseId ?? undefined,
          protocolFamily: body.protocolFamily ?? undefined,
          endpointKind: body.endpointKind ?? undefined,
          status: body.status ?? undefined,
          createdFrom: body.createdFrom ?? undefined,
          createdTo: body.createdTo ?? undefined,
          limit: body.limit ?? undefined,
          profileKey: body.profileKey ?? undefined,
          thresholds: {
            routingScoreWarningThreshold: body.routingScoreWarningThreshold ?? undefined,
            routingScoreCriticalThreshold: body.routingScoreCriticalThreshold ?? undefined,
            degradedRouteWarningThreshold: body.degradedRouteWarningThreshold ?? undefined,
            degradedRouteCriticalThreshold: body.degradedRouteCriticalThreshold ?? undefined,
            saturatedRouteWarningThreshold: body.saturatedRouteWarningThreshold ?? undefined,
            saturatedRouteCriticalThreshold: body.saturatedRouteCriticalThreshold ?? undefined,
            breakerOpenRouteWarningThreshold: body.breakerOpenRouteWarningThreshold ?? undefined,
            breakerOpenRouteCriticalThreshold: body.breakerOpenRouteCriticalThreshold ?? undefined,
          },
        }),
      };
    },
  );

  app.get("/v1/internal/gateway/analysis/rate-limit-hotspots", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      hotspots: await summarizeGatewayRateLimitHotspotsForOperator(
        userId,
        providerUserId,
        readGatewayRequestAuditFilters(query, 1000),
      ),
    };
  });

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/trend-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayRateLimitHotspotTrendReportForOperator(userId, providerUserId, {
          ...readGatewayRequestAuditFilters(query, 1000),
          windowSize: readQueryInt(query, "windowSize"),
          bucketSizeMinutes: readQueryInt(query, "bucketSizeMinutes"),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/anomaly-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayRateLimitHotspotAnomalyReportForOperator(userId, providerUserId, {
          ...readGatewayRequestAuditFilters(query, 1000),
          windowSize: readQueryInt(query, "windowSize"),
          bucketSizeMinutes: readQueryInt(query, "bucketSizeMinutes"),
          profileKey: readQueryString(query, "profileKey") as any,
          thresholds: {
            totalRateLimitedRequestsWarningThreshold:
              readQueryNumber(query, "totalRateLimitedRequestsWarningThreshold") ?? undefined,
            totalRateLimitedRequestsCriticalThreshold:
              readQueryNumber(query, "totalRateLimitedRequestsCriticalThreshold") ?? undefined,
            totalRateLimitedRequestsDeltaRatioThreshold:
              readQueryNumber(query, "totalRateLimitedRequestsDeltaRatioThreshold") ?? undefined,
            topCodeShareWarningThreshold: readQueryNumber(query, "topCodeShareWarningThreshold") ?? undefined,
            topCodeShareCriticalThreshold: readQueryNumber(query, "topCodeShareCriticalThreshold") ?? undefined,
            topProjectShareWarningThreshold: readQueryNumber(query, "topProjectShareWarningThreshold") ?? undefined,
            topProjectShareCriticalThreshold: readQueryNumber(query, "topProjectShareCriticalThreshold") ?? undefined,
            topApiKeyShareWarningThreshold: readQueryNumber(query, "topApiKeyShareWarningThreshold") ?? undefined,
            topApiKeyShareCriticalThreshold: readQueryNumber(query, "topApiKeyShareCriticalThreshold") ?? undefined,
            topRequestedModelShareWarningThreshold:
              readQueryNumber(query, "topRequestedModelShareWarningThreshold") ?? undefined,
            topRequestedModelShareCriticalThreshold:
              readQueryNumber(query, "topRequestedModelShareCriticalThreshold") ?? undefined,
            topEndpointShareWarningThreshold: readQueryNumber(query, "topEndpointShareWarningThreshold") ?? undefined,
            topEndpointShareCriticalThreshold: readQueryNumber(query, "topEndpointShareCriticalThreshold") ?? undefined,
          },
        }),
      };
    },
  );

  app.post(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshot",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const body = rateLimitHotspotSnapshotBodySchema.parse(request.body ?? {});
      return {
        snapshot: await persistGatewayRateLimitHotspotSnapshotForOperator(userId, providerUserId, {
          ...body,
          limit: body.limit ?? undefined,
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshots",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        snapshots: await listGatewayRateLimitHotspotSnapshotsForOperator(userId, providerUserId, {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          projectId: readQueryString(query, "projectId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          apiKeyId: readQueryString(query, "apiKeyId"),
          endpointKind: readQueryString(query, "endpointKind"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshots/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        summary: await getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator(userId, providerUserId, {
          label: readQueryString(query, "label"),
          projectId: readQueryString(query, "projectId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          apiKeyId: readQueryString(query, "apiKeyId"),
          endpointKind: readQueryString(query, "endpointKind"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 500),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshots/trend-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayRateLimitHotspotSnapshotTrendReportForOperator(userId, providerUserId, {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          projectId: readQueryString(query, "projectId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          apiKeyId: readQueryString(query, "apiKeyId"),
          endpointKind: readQueryString(query, "endpointKind"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 10),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshots/:snapshotId",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const params = request.params as Record<string, unknown>;
      return {
        snapshot: await getGatewayRateLimitHotspotSnapshotForOperator(
          userId,
          providerUserId,
          typeof params.snapshotId === "string" ? params.snapshotId : null,
        ),
      };
    },
  );

  app.post(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/anomaly-snapshot",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const body = rateLimitHotspotAnomalySnapshotBodySchema.parse(request.body ?? {});
      return {
        snapshot: await persistGatewayRateLimitHotspotAnomalySnapshotForOperator(userId, providerUserId, {
          ...body,
          limit: body.limit ?? undefined,
          thresholds: {
            totalRateLimitedRequestsWarningThreshold: body.totalRateLimitedRequestsWarningThreshold ?? undefined,
            totalRateLimitedRequestsCriticalThreshold: body.totalRateLimitedRequestsCriticalThreshold ?? undefined,
            totalRateLimitedRequestsDeltaRatioThreshold: body.totalRateLimitedRequestsDeltaRatioThreshold ?? undefined,
            topCodeShareWarningThreshold: body.topCodeShareWarningThreshold ?? undefined,
            topCodeShareCriticalThreshold: body.topCodeShareCriticalThreshold ?? undefined,
            topProjectShareWarningThreshold: body.topProjectShareWarningThreshold ?? undefined,
            topProjectShareCriticalThreshold: body.topProjectShareCriticalThreshold ?? undefined,
            topApiKeyShareWarningThreshold: body.topApiKeyShareWarningThreshold ?? undefined,
            topApiKeyShareCriticalThreshold: body.topApiKeyShareCriticalThreshold ?? undefined,
            topRequestedModelShareWarningThreshold: body.topRequestedModelShareWarningThreshold ?? undefined,
            topRequestedModelShareCriticalThreshold: body.topRequestedModelShareCriticalThreshold ?? undefined,
            topEndpointShareWarningThreshold: body.topEndpointShareWarningThreshold ?? undefined,
            topEndpointShareCriticalThreshold: body.topEndpointShareCriticalThreshold ?? undefined,
          },
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/anomaly-snapshots",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        snapshots: await listGatewayRateLimitHotspotAnomalySnapshotsForOperator(userId, providerUserId, {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          projectId: readQueryString(query, "projectId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          apiKeyId: readQueryString(query, "apiKeyId"),
          endpointKind: readQueryString(query, "endpointKind"),
          profileKey: readQueryString(query, "profileKey") as any,
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/anomaly-snapshots/:snapshotId",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const params = request.params as Record<string, unknown>;
      return {
        snapshot: await getGatewayRateLimitHotspotAnomalySnapshotForOperator(
          userId,
          providerUserId,
          typeof params.snapshotId === "string" ? params.snapshotId : null,
        ),
      };
    },
  );

  app.get("/v1/internal/gateway/analysis/anomaly-policies", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      policies: await listGatewayAnalysisAnomalyPoliciesForOperator(userId, providerUserId, {
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        status: readQueryString(query, "status"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        autoSyncEnabled: readQueryBoolean(query, "autoSyncEnabled"),
        autoEscalateEnabled: readQueryBoolean(query, "autoEscalateEnabled"),
        autoRemediationEnabled: readQueryBoolean(query, "autoRemediationEnabled"),
        alertingEnabled: readQueryBoolean(query, "alertingEnabled"),
        dueOnly: readQueryBoolean(query, "dueOnly"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-policies/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisAnomalyPolicySummaryForOperator(userId, providerUserId, {
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        status: readQueryString(query, "status"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        autoSyncEnabled: readQueryBoolean(query, "autoSyncEnabled"),
        autoEscalateEnabled: readQueryBoolean(query, "autoEscalateEnabled"),
        autoRemediationEnabled: readQueryBoolean(query, "autoRemediationEnabled"),
        alertingEnabled: readQueryBoolean(query, "alertingEnabled"),
        dueOnly: readQueryBoolean(query, "dueOnly"),
        limit: readQueryLimit(query, 200),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-policies", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyPolicyBodySchema.parse(request.body ?? {});
    return {
      policy: await saveGatewayAnalysisAnomalyPolicyForOperator(userId, providerUserId, body),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-policies/:policyId/sync", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const policyId = readQueryString(request.params as Record<string, unknown>, "policyId");
    return syncGatewayAnalysisAnomalyPolicyForOperator(userId, providerUserId, policyId);
  });

  app.post("/v1/internal/gateway/analysis/anomaly-policies/sweep-sync", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyPolicySweepBodySchema.parse(request.body ?? {});
    return {
      sweep: await sweepGatewayAnalysisAnomalyPoliciesForOperator(userId, providerUserId, body),
    };
  });

  app.get("/v1/internal/gateway/analysis/export", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      export: await exportGatewayAnalysisRowsForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 200),
        artifactAvailable: readQueryBoolean(query, "artifactAvailable"),
        textMode: readQueryString(query, "textMode") as any,
        maxTextChars: readQueryInt(query, "maxTextChars"),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/export", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = analysisExportPersistBodySchema.parse(request.body ?? {});
    return {
      export: await persistGatewayAnalysisExportForOperator(userId, providerUserId, body),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      exports: await listGatewayPersistedAnalysisExportsForOperator(userId, providerUserId, {
        exportId: readQueryString(query, "exportId"),
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayPersistedAnalysisExportInventorySummaryForOperator(userId, providerUserId, {
        exportId: readQueryString(query, "exportId"),
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/baseline-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisExportBaselineReportForOperator(userId, providerUserId, {
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 10),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/timeline-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisExportTimelineReportForOperator(userId, providerUserId, {
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 5),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/trend-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisExportTrendReportForOperator(userId, providerUserId, {
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 10),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/anomaly-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisExportAnomalyReportForOperator(userId, providerUserId, {
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 10),
        profileKey: readQueryString(query, "profileKey"),
        failureRateWarningThreshold: readQueryNumber(query, "failureRateWarningThreshold"),
        failureRateCriticalThreshold: readQueryNumber(query, "failureRateCriticalThreshold"),
        failureRateDeltaRatioThreshold: readQueryNumber(query, "failureRateDeltaRatioThreshold"),
        completionRateWarningThreshold: readQueryNumber(query, "completionRateWarningThreshold"),
        completionRateCriticalThreshold: readQueryNumber(query, "completionRateCriticalThreshold"),
        completionRateDeltaValueThreshold: readQueryNumber(query, "completionRateDeltaValueThreshold"),
        responseArtifactCoverageWarningThreshold: readQueryNumber(query, "responseArtifactCoverageWarningThreshold"),
        responseArtifactCoverageCriticalThreshold: readQueryNumber(query, "responseArtifactCoverageCriticalThreshold"),
        responseArtifactCoverageDeltaValueThreshold: readQueryNumber(query, "responseArtifactCoverageDeltaValueThreshold"),
        requestArtifactCoverageWarningThreshold: readQueryNumber(query, "requestArtifactCoverageWarningThreshold"),
        requestArtifactCoverageCriticalThreshold: readQueryNumber(query, "requestArtifactCoverageCriticalThreshold"),
        requestArtifactCoverageDeltaValueThreshold: readQueryNumber(query, "requestArtifactCoverageDeltaValueThreshold"),
        tokensPerSampleWarningDeltaRatioThreshold: readQueryNumber(query, "tokensPerSampleWarningDeltaRatioThreshold"),
        tokensPerSampleCriticalDeltaRatioThreshold: readQueryNumber(query, "tokensPerSampleCriticalDeltaRatioThreshold"),
        tokensPerSampleCriticalAbsoluteThreshold: readQueryNumber(query, "tokensPerSampleCriticalAbsoluteThreshold"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      incidents: await listGatewayAnalysisAnomalyIncidentsForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        ownerUserId: readQueryString(query, "ownerUserId"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        status: readQueryString(query, "status"),
        followUpStatus: readQueryString(query, "followUpStatus"),
        escalationStatus: readQueryString(query, "escalationStatus"),
        code: readQueryString(query, "code"),
        severity: readQueryString(query, "severity"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisAnomalyIncidentSummaryForOperator(userId, providerUserId, {
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        ownerUserId: readQueryString(query, "ownerUserId"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        status: readQueryString(query, "status"),
        followUpStatus: readQueryString(query, "followUpStatus"),
        escalationStatus: readQueryString(query, "escalationStatus"),
        code: readQueryString(query, "code"),
        severity: readQueryString(query, "severity"),
        limit: readQueryLimit(query, 200),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/alert-queue", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      queue: await listGatewayAnalysisAnomalyIncidentAlertQueueForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        ownerUserId: readQueryString(query, "ownerUserId"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        status: readQueryString(query, "status"),
        followUpStatus: readQueryString(query, "followUpStatus"),
        escalationStatus: readQueryString(query, "escalationStatus"),
        code: readQueryString(query, "code"),
        severity: readQueryString(query, "severity"),
        dueOnly: readQueryBoolean(query, "dueOnly"),
        limit: readQueryLimit(query, 50),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-queue", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      queue: await listGatewayAnalysisAnomalyRemediationQueueForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        ownerUserId: readQueryString(query, "ownerUserId"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        status: readQueryString(query, "status"),
        followUpStatus: readQueryString(query, "followUpStatus"),
        escalationStatus: readQueryString(query, "escalationStatus"),
        code: readQueryString(query, "code"),
        severity: readQueryString(query, "severity"),
        actionKey: readQueryString(query, "actionKey"),
        executionMode: readQueryString(query, "executionMode") as
          | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
          | null,
        dueOnly: readQueryBoolean(query, "dueOnly"),
        limit: readQueryLimit(query, 50),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      runs: await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        actionKey: readQueryString(query, "actionKey"),
        status: readQueryString(query, "status") as (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number] | null,
        executionMode: readQueryString(query, "executionMode") as
          | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
          | null,
        dryRun: readQueryBoolean(query, "dryRun"),
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisAnomalyRemediationRunSummaryForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        actionKey: readQueryString(query, "actionKey"),
        status: readQueryString(query, "status") as (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number] | null,
        executionMode: readQueryString(query, "executionMode") as
          | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
          | null,
        dryRun: readQueryBoolean(query, "dryRun"),
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 500),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      effectiveness: await getGatewayAnalysisAnomalyRemediationEffectivenessForOperator(
        userId,
        providerUserId,
        {
          incidentId: readQueryString(query, "incidentId"),
          policyId: readQueryString(query, "policyId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          status: readQueryString(query, "status") as (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number] | null,
          executionMode: readQueryString(query, "executionMode") as
            | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
            | null,
          dryRun: readQueryBoolean(query, "dryRun"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        },
        {
          windowMinutes: readQueryInt(query, "windowMinutes"),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      snapshots: await listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 500),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/trend-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 10),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/anomaly-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 10),
          profileKey: readQueryString(query, "profileKey"),
          impactedRunRateWarningThreshold: readQueryNumber(query, "impactedRunRateWarningThreshold"),
          impactedRunRateCriticalThreshold: readQueryNumber(query, "impactedRunRateCriticalThreshold"),
          unavailableRunRateWarningThreshold: readQueryNumber(query, "unavailableRunRateWarningThreshold"),
          unavailableRunRateCriticalThreshold: readQueryNumber(query, "unavailableRunRateCriticalThreshold"),
          completionRateRegressedWarningThreshold: readQueryNumber(query, "completionRateRegressedWarningThreshold"),
          completionRateRegressedCriticalThreshold: readQueryNumber(query, "completionRateRegressedCriticalThreshold"),
          failureRateRegressedWarningThreshold: readQueryNumber(query, "failureRateRegressedWarningThreshold"),
          failureRateRegressedCriticalThreshold: readQueryNumber(query, "failureRateRegressedCriticalThreshold"),
          requestArtifactRegressedWarningThreshold: readQueryNumber(query, "requestArtifactRegressedWarningThreshold"),
          requestArtifactRegressedCriticalThreshold: readQueryNumber(query, "requestArtifactRegressedCriticalThreshold"),
          responseArtifactRegressedWarningThreshold: readQueryNumber(query, "responseArtifactRegressedWarningThreshold"),
          responseArtifactRegressedCriticalThreshold: readQueryNumber(query, "responseArtifactRegressedCriticalThreshold"),
          firstTokenLatencyRegressedWarningThreshold: readQueryNumber(query, "firstTokenLatencyRegressedWarningThreshold"),
          firstTokenLatencyRegressedCriticalThreshold: readQueryNumber(query, "firstTokenLatencyRegressedCriticalThreshold"),
          totalTokensRegressedWarningThreshold: readQueryNumber(query, "totalTokensRegressedWarningThreshold"),
          totalTokensRegressedCriticalThreshold: readQueryNumber(query, "totalTokensRegressedCriticalThreshold"),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/anomaly-snapshots", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      snapshots: await listGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotsForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          profileKey: readQueryString(query, "profileKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/anomaly-snapshots/:snapshotId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const snapshotId = readQueryString(request.params as Record<string, unknown>, "snapshotId");
    return {
      snapshot: await getGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
        userId,
        providerUserId,
        snapshotId,
      ),
    };
  });

  app.post("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/anomaly-snapshots", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyRemediationEffectivenessAnomalySnapshotBodySchema.parse(request.body ?? {});
    return {
      snapshot: await persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
        userId,
        providerUserId,
        body,
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/:snapshotId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const snapshotId = readQueryString(request.params as Record<string, unknown>, "snapshotId");
    return {
      snapshot: await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
        userId,
        providerUserId,
        snapshotId,
      ),
    };
  });

  app.post("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshot", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyRemediationEffectivenessSnapshotBodySchema.parse(request.body ?? {});
    return {
      snapshot: await persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
        userId,
        providerUserId,
        body,
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/:runId/impact", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const runId = readQueryString(request.params as Record<string, unknown>, "runId");
    const query = request.query as Record<string, unknown>;
    return {
      impact: await getGatewayAnalysisAnomalyRemediationRunImpactForOperator(userId, providerUserId, runId, {
        windowMinutes: readQueryInt(query, "windowMinutes"),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/remediation-runs/:runId/capture-impact", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const runId = readQueryString(request.params as Record<string, unknown>, "runId");
    const query = request.query as Record<string, unknown>;
    return {
      capture: await captureGatewayAnalysisAnomalyRemediationRunImpactForOperator(
        userId,
        providerUserId,
        runId,
        {
          windowMinutes: readQueryInt(query, "windowMinutes"),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/history", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    const query = request.query as Record<string, unknown>;
    return {
      history: await listGatewayAnalysisAnomalyIncidentHistoryForOperator(userId, providerUserId, {
        incidentId,
        limit: readQueryLimit(query, 200),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/remediation-plan", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    return {
      plan: await getGatewayAnalysisAnomalyIncidentRemediationPlanForOperator(userId, providerUserId, incidentId),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/remediation-runs", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    const query = request.query as Record<string, unknown>;
    return {
      runs: await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(userId, providerUserId, {
        incidentId,
        policyId: readQueryString(query, "policyId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        actionKey: readQueryString(query, "actionKey"),
        status: readQueryString(query, "status") as (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number] | null,
        executionMode: readQueryString(query, "executionMode") as
          | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
          | null,
        dryRun: readQueryBoolean(query, "dryRun"),
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/remediation-runs", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    const body = anomalyRemediationRunBodySchema.parse(request.body ?? {});
    return {
      run: await executeGatewayAnalysisAnomalyIncidentRemediationForOperator(
        userId,
        providerUserId,
        incidentId,
        body,
      ),
    };
  });

  app.post("/v1/internal/gateway/analysis/remediation-runs/sweep", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyRemediationSweepBodySchema.parse(request.body ?? {});
    return {
      sweep: await sweepGatewayAnalysisAnomalyRemediationsForOperator(userId, providerUserId, body),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/sync", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyIncidentSyncBodySchema.parse(request.body ?? {});
    return {
      sync: await syncGatewayAnalysisAnomalyIncidentsForOperator(userId, providerUserId, body),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/acknowledge", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    return {
      incident: await acknowledgeGatewayAnalysisAnomalyIncidentForOperator(userId, providerUserId, incidentId),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/resolve", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    return {
      incident: await resolveGatewayAnalysisAnomalyIncidentForOperator(userId, providerUserId, incidentId),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/follow-up", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    const body = anomalyIncidentFollowUpBodySchema.parse(request.body ?? {});
    return {
      incident: await updateGatewayAnalysisAnomalyIncidentFollowUpForOperator(userId, providerUserId, incidentId, body),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/diff", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      diff: await getGatewayPersistedAnalysisExportDiffForOperator(userId, providerUserId, {
        leftExportId: readQueryString(query, "leftExportId"),
        rightExportId: readQueryString(query, "rightExportId"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/:exportId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const exportId = readQueryString(request.params as Record<string, unknown>, "exportId");
    return {
      export: await getGatewayPersistedAnalysisExportForOperator(userId, providerUserId, exportId),
    };
  });

  app.post("/v1/internal/gateway/analysis/exports/:exportId/metadata", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const exportId = readQueryString(request.params as Record<string, unknown>, "exportId");
    const body = analysisExportMetadataBodySchema.parse(request.body ?? {});
    return {
      export: await updateGatewayPersistedAnalysisExportMetadataForOperator(userId, providerUserId, exportId, body),
    };
  });

  app.post("/v1/internal/gateway/analysis/exports/cleanup-expired", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = analysisExportCleanupBodySchema.parse(request.body ?? {});
    return {
      cleanup: await runGatewayPersistedAnalysisExportCleanupForOperator(userId, providerUserId, body),
    };
  });

  app.get("/v1/internal/gateway/requests/:requestAuditId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const requestAuditId = readQueryString(request.params as Record<string, unknown>, "requestAuditId");
    return {
      requestAudit: await getGatewayRequestAuditForOperator(userId, providerUserId, {
        requestAuditId,
      }),
    };
  });

  app.get("/v1/internal/gateway/requests/by-response/:responseId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const responseId = readQueryString(request.params as Record<string, unknown>, "responseId");
    return {
      requestAudit: await getGatewayRequestAuditForOperator(userId, providerUserId, {
        responseId,
      }),
    };
  });

  app.get("/v1/internal/gateway/requests/:requestAuditId/artifacts", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const requestAuditId = readQueryString(request.params as Record<string, unknown>, "requestAuditId");
    return {
      artifacts: await getGatewayRequestArtifactsForOperator(userId, providerUserId, {
        requestAuditId,
      }),
    };
  });

  app.get("/v1/internal/gateway/requests/by-response/:responseId/artifacts", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const responseId = readQueryString(request.params as Record<string, unknown>, "responseId");
    return {
      artifacts: await getGatewayRequestArtifactsForOperator(userId, providerUserId, {
        responseId,
      }),
    };
  });

  app.get("/v1/internal/gateway/sessions", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    const rawLimit = Number(query.limit ?? 100);
    return {
      sessions: await listGatewaySessionsForOperator(
        userId,
        providerUserId,
        {
          projectId: readQueryString(query, "projectId"),
          providerAccountId: readQueryString(query, "providerAccountId"),
          protocolFamily: readQueryString(query, "protocolFamily") as any,
          activeOnly: readQueryBoolean(query, "activeOnly"),
          limit: Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100,
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/sessions/:sessionId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const sessionId = readQueryString(request.params as Record<string, unknown>, "sessionId");
    return {
      sessionDetail: await getGatewaySessionDetailForOperator(userId, providerUserId, sessionId),
    };
  });

  app.get("/v1/internal/gateway/provider-health", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      providerHealth: await listGatewayProviderHealthForOperator(userId, providerUserId, {
        providerAccountId: readQueryString(query, "providerAccountId"),
        protocolFamily: readQueryString(query, "protocolFamily") as any,
        status: readQueryString(query, "status"),
      }),
      summary: await getGatewayProviderHealthSummaryForOperator(userId, providerUserId, {
        providerAccountId: readQueryString(query, "providerAccountId"),
        protocolFamily: readQueryString(query, "protocolFamily") as any,
        status: readQueryString(query, "status"),
      }),
    };
  });

  app.get("/v1/internal/gateway/readiness", { preHandler: withInternalRequest }, async (_request) => ({
    readiness: await getGatewayReadinessReport(),
  }));

  app.get("/v1/internal/gateway/pressure", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    const rawLimit = Number(query.limit ?? 100);
    return {
      pressure: await listGatewayRuntimePressureForOperator(userId, providerUserId, {
        projectId: readQueryString(query, "projectId"),
        providerAccountId: readQueryString(query, "providerAccountId"),
        limit: Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100,
      }),
    };
  });

  app.post(
    "/v1/internal/gateway/provider-accounts/:providerAccountId/probe",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const providerAccountId =
        typeof (request.params as Record<string, unknown>).providerAccountId === "string"
          ? String((request.params as Record<string, unknown>).providerAccountId).trim()
          : "";
      return {
        result: await probeGatewayProviderAccountForOperator(userId, providerUserId, providerAccountId),
      };
    },
  );

  app.post("/v1/internal/gateway/provider-accounts/sweep-cooling", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return await runGatewayCoolingSweepForOperator(userId, providerUserId);
  });

  app.post("/v1/internal/gateway/provider-accounts", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = providerAccountBodySchema.parse(request.body ?? {});
    return {
      providerAccount: await createGatewayProviderAccountForOperator(userId, providerUserId, {
        ...body,
        payload: body.payload as any,
      }),
    };
  });

  app.post("/v1/internal/gateway/provider-accounts/:providerAccountId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const providerAccountId =
      typeof (request.params as Record<string, unknown>).providerAccountId === "string"
        ? String((request.params as Record<string, unknown>).providerAccountId).trim()
        : "";
    const body = providerAccountBodySchema.parse(request.body ?? {});
    return {
      providerAccount: await updateGatewayProviderAccountForOperator(userId, providerUserId, providerAccountId, {
        ...body,
        payload: body.payload as any,
      }),
    };
  });

  app.post(
    "/v1/internal/gateway/provider-accounts/:providerAccountId/source-profile",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const providerAccountId =
        typeof (request.params as Record<string, unknown>).providerAccountId === "string"
          ? String((request.params as Record<string, unknown>).providerAccountId).trim()
          : "";
      const body = providerSourceProfilePatchBodySchema.parse(request.body ?? {});
      return {
        providerAccount: await patchGatewayProviderSourceProfileForOperator(
          userId,
          providerUserId,
          providerAccountId,
          body,
        ),
      };
    },
  );

  app.post(
    "/v1/internal/gateway/provider-accounts/source-profile/backfill",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const body = providerSourceProfileBackfillBodySchema.parse(request.body ?? {});
      return {
        result: await backfillGatewayProviderSourceProfilesForOperator(userId, providerUserId, body),
      };
    },
  );

  app.post("/v1/internal/gateway/model-aliases", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = modelAliasBodySchema.parse(request.body ?? {});
    return {
      modelAlias: await saveGatewayModelAliasForOperator(userId, providerUserId, null, body),
    };
  });

  app.post("/v1/internal/gateway/model-aliases/:aliasId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const aliasId =
      typeof (request.params as Record<string, unknown>).aliasId === "string"
        ? String((request.params as Record<string, unknown>).aliasId).trim()
        : "";
    const body = modelAliasBodySchema.parse(request.body ?? {});
    return {
      modelAlias: await saveGatewayModelAliasForOperator(userId, providerUserId, aliasId, body),
    };
  });

  app.post("/v1/internal/gateway/route-policies", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = routePolicyBodySchema.parse(request.body ?? {});
    return {
      routePolicy: await saveGatewayRoutePolicyForOperator(userId, providerUserId, null, {
        ...body,
        config: {
          stickySessions: body.config.stickySessions ?? true,
          preStreamFallbackEnabled: body.config.preStreamFallbackEnabled ?? true,
          selectionStrategy: body.config.selectionStrategy ?? "weighted_random",
          providerLoadAwareRoutingEnabled: body.config.providerLoadAwareRoutingEnabled ?? true,
          maxConcurrentRequests: body.config.maxConcurrentRequests ?? null,
          providerMaxConcurrentRequests: body.config.providerMaxConcurrentRequests ?? null,
          rateLimitWindowSeconds: body.config.rateLimitWindowSeconds ?? null,
          rateLimitMaxRequests: body.config.rateLimitMaxRequests ?? null,
          apiKeyRateLimit: body.config.apiKeyRateLimit ?? null,
          modelRateLimits: body.config.modelRateLimits ?? null,
          endpointRateLimits: body.config.endpointRateLimits ?? null,
          circuitBreakerThreshold: body.config.circuitBreakerThreshold ?? 3,
          circuitBreakerCooldownSeconds: body.config.circuitBreakerCooldownSeconds ?? 60,
          allowedProviderAccountIds: body.config.allowedProviderAccountIds ?? null,
          allowedProtocolFamilies: body.config.allowedProtocolFamilies ?? null,
          allowedModelIds: body.config.allowedModelIds ?? null,
          blockedModelIds: body.config.blockedModelIds ?? null,
          maxRequestBodyBytes: body.config.maxRequestBodyBytes ?? null,
          streamIdleTimeoutSeconds: body.config.streamIdleTimeoutSeconds ?? null,
          totalRequestTimeoutSeconds: body.config.totalRequestTimeoutSeconds ?? null,
          maxStreamHeartbeatGapSeconds: body.config.maxStreamHeartbeatGapSeconds ?? null,
          routingAnomalyAutoRemediation: body.config.routingAnomalyAutoRemediation
            ? {
                enabled: body.config.routingAnomalyAutoRemediation.enabled ?? true,
                intervalMinutes: body.config.routingAnomalyAutoRemediation.intervalMinutes ?? null,
                dryRunFirst: body.config.routingAnomalyAutoRemediation.dryRunFirst ?? true,
                requireAlertBeforeApply:
                  body.config.routingAnomalyAutoRemediation.requireAlertBeforeApply ?? true,
                freezeOnProviderHealthDegrade:
                  body.config.routingAnomalyAutoRemediation.freezeOnProviderHealthDegrade ?? true,
                maxApplyRunsPerIncident:
                  body.config.routingAnomalyAutoRemediation.maxApplyRunsPerIncident ?? null,
                actionKeysByCode: body.config.routingAnomalyAutoRemediation.actionKeysByCode ?? null,
              }
            : null,
          rateLimitHotspotAutoRemediation: body.config.rateLimitHotspotAutoRemediation
            ? {
                enabled: body.config.rateLimitHotspotAutoRemediation.enabled ?? true,
                intervalMinutes: body.config.rateLimitHotspotAutoRemediation.intervalMinutes ?? null,
                dryRunFirst: body.config.rateLimitHotspotAutoRemediation.dryRunFirst ?? true,
                requireAlertBeforeApply:
                  body.config.rateLimitHotspotAutoRemediation.requireAlertBeforeApply ?? true,
                freezeOnProviderHealthDegrade:
                  body.config.rateLimitHotspotAutoRemediation.freezeOnProviderHealthDegrade ?? true,
                maxApplyRunsPerIncident:
                  body.config.rateLimitHotspotAutoRemediation.maxApplyRunsPerIncident ?? null,
                actionByCode: body.config.rateLimitHotspotAutoRemediation.actionByCode ?? null,
              }
            : null,
          fallbackHttpStatuses: body.config.fallbackHttpStatuses ?? null,
          fallbackErrorCodes: body.config.fallbackErrorCodes ?? null,
        },
      }),
    };
  });

  app.post("/v1/internal/gateway/route-policies/:policyId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const policyId =
      typeof (request.params as Record<string, unknown>).policyId === "string"
        ? String((request.params as Record<string, unknown>).policyId).trim()
        : "";
    const body = routePolicyBodySchema.parse(request.body ?? {});
    return {
      routePolicy: await saveGatewayRoutePolicyForOperator(userId, providerUserId, policyId, {
        ...body,
        config: {
          stickySessions: body.config.stickySessions ?? true,
          preStreamFallbackEnabled: body.config.preStreamFallbackEnabled ?? true,
          selectionStrategy: body.config.selectionStrategy ?? "weighted_random",
          providerLoadAwareRoutingEnabled: body.config.providerLoadAwareRoutingEnabled ?? true,
          maxConcurrentRequests: body.config.maxConcurrentRequests ?? null,
          providerMaxConcurrentRequests: body.config.providerMaxConcurrentRequests ?? null,
          rateLimitWindowSeconds: body.config.rateLimitWindowSeconds ?? null,
          rateLimitMaxRequests: body.config.rateLimitMaxRequests ?? null,
          apiKeyRateLimit: body.config.apiKeyRateLimit ?? null,
          modelRateLimits: body.config.modelRateLimits ?? null,
          endpointRateLimits: body.config.endpointRateLimits ?? null,
          circuitBreakerThreshold: body.config.circuitBreakerThreshold ?? 3,
          circuitBreakerCooldownSeconds: body.config.circuitBreakerCooldownSeconds ?? 60,
          allowedProviderAccountIds: body.config.allowedProviderAccountIds ?? null,
          allowedProtocolFamilies: body.config.allowedProtocolFamilies ?? null,
          allowedModelIds: body.config.allowedModelIds ?? null,
          blockedModelIds: body.config.blockedModelIds ?? null,
          maxRequestBodyBytes: body.config.maxRequestBodyBytes ?? null,
          streamIdleTimeoutSeconds: body.config.streamIdleTimeoutSeconds ?? null,
          totalRequestTimeoutSeconds: body.config.totalRequestTimeoutSeconds ?? null,
          maxStreamHeartbeatGapSeconds: body.config.maxStreamHeartbeatGapSeconds ?? null,
          routingAnomalyAutoRemediation: body.config.routingAnomalyAutoRemediation
            ? {
                enabled: body.config.routingAnomalyAutoRemediation.enabled ?? true,
                intervalMinutes: body.config.routingAnomalyAutoRemediation.intervalMinutes ?? null,
                dryRunFirst: body.config.routingAnomalyAutoRemediation.dryRunFirst ?? true,
                requireAlertBeforeApply:
                  body.config.routingAnomalyAutoRemediation.requireAlertBeforeApply ?? true,
                freezeOnProviderHealthDegrade:
                  body.config.routingAnomalyAutoRemediation.freezeOnProviderHealthDegrade ?? true,
                maxApplyRunsPerIncident:
                  body.config.routingAnomalyAutoRemediation.maxApplyRunsPerIncident ?? null,
                actionKeysByCode: body.config.routingAnomalyAutoRemediation.actionKeysByCode ?? null,
              }
            : null,
          rateLimitHotspotAutoRemediation: body.config.rateLimitHotspotAutoRemediation
            ? {
                enabled: body.config.rateLimitHotspotAutoRemediation.enabled ?? true,
                intervalMinutes: body.config.rateLimitHotspotAutoRemediation.intervalMinutes ?? null,
                dryRunFirst: body.config.rateLimitHotspotAutoRemediation.dryRunFirst ?? true,
                requireAlertBeforeApply:
                  body.config.rateLimitHotspotAutoRemediation.requireAlertBeforeApply ?? true,
                freezeOnProviderHealthDegrade:
                  body.config.rateLimitHotspotAutoRemediation.freezeOnProviderHealthDegrade ?? true,
                maxApplyRunsPerIncident:
                  body.config.rateLimitHotspotAutoRemediation.maxApplyRunsPerIncident ?? null,
                actionByCode: body.config.rateLimitHotspotAutoRemediation.actionByCode ?? null,
              }
            : null,
          fallbackHttpStatuses: body.config.fallbackHttpStatuses ?? null,
          fallbackErrorCodes: body.config.fallbackErrorCodes ?? null,
        },
      }),
    };
  });
};
