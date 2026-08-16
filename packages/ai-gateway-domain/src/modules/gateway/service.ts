// Thin facade: the gateway service implementation lives in ./service/*.
// This file re-exports the original public API unchanged; add new logic to the submodules.
export {
  sweepGatewayCoolingProviders,
  noteProviderAccountFailure,
  noteProviderAccountSuccess,
} from "./service/provider-health";
export {
  ensureGatewayBenefitProject,
  resolveGatewayApiAccessForProject,
  rotateGatewayApiAccessForProject,
  authenticateGatewayAccessToken,
} from "./service/access";
export type {
  AuthenticatedGatewayAccess,
} from "./service/access";
export {
  listGatewayModelsForProject,
  resolveGatewayRouteContext,
  resolveGatewayProviderNamespaceContext,
} from "./service/routing";
export type {
  GatewayRouteCandidate,
  GatewayResolvedRouteContext,
  GatewayResolvedProviderNamespaceContext,
} from "./service/routing";
export {
  resolveGatewaySession,
  upsertGatewaySession,
  createGatewayRequestAudit,
  finalizeGatewayRequestAudit,
  markGatewayRequestAuditDisconnected,
  recordGatewaySessionOutcome,
} from "./service/sessions";
export {
  listGatewayOperatorCatalog,
  getGatewayProviderInventoryForOperator,
  getGatewayModelAssociationMatrixForOperator,
  getGatewayCostOverviewForOperator,
} from "./service/operator-catalog";
export {
  listGatewayRequestAuditsForOperator,
  listGatewaySessionsForOperator,
  getGatewayRequestAuditForOperator,
  getGatewayRequestArtifactsForOperator,
  getGatewaySessionDetailForOperator,
  listGatewayRequestAuditSummaryForOperator,
} from "./service/operator-audits";
export {
  getGatewayPromptCacheSummaryForOperator,
  getGatewayPromptCacheSummaryForProject,
  getGatewayPromptCacheTrendReportForProject,
  getGatewayPromptCacheTrendReportForOperator,
} from "./service/prompt-cache";
export {
  summarizeGatewayRateLimitHotspotsForOperator,
  getGatewayRateLimitHotspotTrendReportForOperator,
  getGatewayRateLimitHotspotAnomalyReportForOperator,
  persistGatewayRateLimitHotspotSnapshotForOperator,
  listGatewayRateLimitHotspotSnapshotsForOperator,
  getGatewayRateLimitHotspotSnapshotForOperator,
  getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator,
  getGatewayRateLimitHotspotSnapshotTrendReportForOperator,
  persistGatewayRateLimitHotspotAnomalySnapshotForOperator,
  listGatewayRateLimitHotspotAnomalySnapshotsForOperator,
  getGatewayRateLimitHotspotAnomalySnapshotForOperator,
} from "./service/rate-limit-hotspots";
export {
  listGatewayAnalysisSamplesForOperator,
  getGatewayAnalysisSummaryForOperator,
  getGatewayProviderRoutingAnalysisSummaryForOperator,
  getGatewayProviderRoutingAnalysisAnomalyReportForOperator,
} from "./service/analysis-summary";
export {
  exportGatewayAnalysisRowsForOperator,
  persistGatewayAnalysisExportForOperator,
  listGatewayPersistedAnalysisExportsForOperator,
  getGatewayPersistedAnalysisExportForOperator,
  getGatewayPersistedAnalysisExportInventorySummaryForOperator,
  updateGatewayPersistedAnalysisExportMetadataForOperator,
  runGatewayPersistedAnalysisExportCleanupForOperator,
  getGatewayPersistedAnalysisExportDiffForOperator,
  getGatewayAnalysisExportBaselineReportForOperator,
  getGatewayAnalysisExportTimelineReportForOperator,
  getGatewayAnalysisExportTrendReportForOperator,
  getGatewayAnalysisExportAnomalyReportForOperator,
} from "./service/analysis-exports";
export {
  listGatewayAnalysisAnomalyPoliciesForOperator,
  getGatewayAnalysisAnomalyPolicySummaryForOperator,
  saveGatewayAnalysisAnomalyPolicyForOperator,
  syncGatewayAnalysisAnomalyPolicyForOperator,
  sweepGatewayAnalysisAnomalyPoliciesForOperator,
} from "./service/anomaly-policies";
export {
  listGatewayAnalysisAnomalyIncidentsForOperator,
  getGatewayAnalysisAnomalyIncidentSummaryForOperator,
  listGatewayAnalysisAnomalyIncidentHistoryForOperator,
  acknowledgeGatewayAnalysisAnomalyIncidentForOperator,
  resolveGatewayAnalysisAnomalyIncidentForOperator,
  updateGatewayAnalysisAnomalyIncidentFollowUpForOperator,
} from "./service/anomaly-incidents";
export {
  getGatewayAnalysisAnomalyIncidentRemediationPlanForOperator,
  listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator,
  getGatewayAnalysisAnomalyRemediationRunSummaryForOperator,
  getGatewayAnalysisAnomalyRemediationRunImpactForOperator,
  captureGatewayAnalysisAnomalyRemediationRunImpactForOperator,
  listGatewayAnalysisAnomalyRemediationQueueForOperator,
  sweepGatewayAnalysisAnomalyRemediationsForOperator,
  executeGatewayAnalysisAnomalyIncidentRemediationForOperator,
} from "./service/anomaly-remediation";
export {
  getGatewayAnalysisAnomalyRemediationEffectivenessForOperator,
  persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator,
  listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator,
  persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator,
  listGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotsForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator,
} from "./service/remediation-effectiveness";
export {
  listGatewayAnalysisAnomalyIncidentAlertQueueForOperator,
  recordGatewayAnalysisAnomalyIncidentAlertDispatchForOperator,
} from "./service/anomaly-alerts";
export {
  syncGatewayAnalysisAnomalyIncidentsForOperator,
  syncGatewayProviderRoutingAnalysisAnomalyIncidentsForOperator,
  syncGatewayRateLimitHotspotAnomalyIncidentsForOperator,
} from "./service/anomaly-sync";
export {
  listGatewayProviderHealthForOperator,
  listGatewayRuntimePressureForOperator,
  getGatewayProviderHealthSummaryForOperator,
  probeGatewayProviderAccountForOperator,
  runGatewayCoolingSweepForOperator,
  createGatewayProviderAccountForOperator,
  updateGatewayProviderAccountForOperator,
  patchGatewayProviderSourceProfileForOperator,
  backfillGatewayProviderSourceProfilesForOperator,
  saveGatewayModelAliasForOperator,
  saveGatewayRoutePolicyForOperator,
  getGatewayReadinessReport,
} from "./service/provider-admin";
