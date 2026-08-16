import type {
  GatewayAnalysisExportAnomalyCode,
  GatewayAnalysisExportAnomalyProfileKey,
  GatewayAnalysisExportAnomalyReportView,
  GatewayAnalysisExportAnomalySeverity,
  GatewayAnalysisExportAnomalyThresholdConfig,
  GatewayAnalysisExportTextMode,
  GatewayAnalysisSummaryView,
} from "./analysis";

import type {
  GatewayProviderRoutingAnalysisAnomalyCode,
  GatewayProviderRoutingAnalysisAnomalyReportView,
} from "./operator-catalog";

import type {
  GatewayRateLimitHotspotAnomalySnapshotView,
} from "./rate-limit-hotspots";

import type {
  GatewayRateLimitDefinition,
  GatewayRateLimitHotspotAnomalyCode,
  GatewayRoutePolicyView,
} from "./routing";

import type {
  GatewaySummaryBucket,
} from "./shared";

export type GatewayAnalysisAnomalyIncidentCode =
  | GatewayAnalysisExportAnomalyCode
  | GatewayRateLimitHotspotAnomalyCode
  | GatewayProviderRoutingAnalysisAnomalyCode;

export const gatewayAnalysisAnomalyPolicyStatuses = ["enabled", "disabled"] as const;
export type GatewayAnalysisAnomalyPolicyStatus = (typeof gatewayAnalysisAnomalyPolicyStatuses)[number];
export const gatewayAnalysisAnomalyPolicySyncStatuses = ["ok", "error"] as const;
export type GatewayAnalysisAnomalyPolicySyncStatus = (typeof gatewayAnalysisAnomalyPolicySyncStatuses)[number];

export type GatewayAnalysisAnomalyPolicyView = {
  id: string;
  name: string;
  status: GatewayAnalysisAnomalyPolicyStatus;
  projectId: string | null;
  routePolicyId: string | null;
  tag: string | null;
  textMode: GatewayAnalysisExportTextMode | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayAnalysisExportAnomalyThresholdConfig;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number | null;
  lastSyncedAt: string | null;
  lastSyncStatus: GatewayAnalysisAnomalyPolicySyncStatus | null;
  lastSyncError: string | null;
  nextSyncDueAt: string | null;
  syncDue: boolean;
  autoEscalateEnabled: boolean;
  escalateSeverityThreshold: GatewayAnalysisExportAnomalySeverity | null;
  escalateAfterSyncCount: number | null;
  autoEscalateOwnerUserId: string | null;
  autoEscalateFollowUpStatus: GatewayAnalysisAnomalyIncidentFollowUpStatus | null;
  autoRemediationEnabled: boolean;
  autoRemediationIntervalMinutes: number | null;
  autoRemediationDryRunFirst: boolean;
  autoRemediationActionKeys: string[] | null;
  autoRemediationMaxApplyRunsPerIncident: number | null;
  autoRemediationRequireAlertBeforeApply: boolean;
  autoRemediationFreezeOnProviderHealthDegrade: boolean;
  alertingEnabled: boolean;
  alertIntervalMinutes: number | null;
  notifyOperatorsOnEscalation: boolean;
  notifyOwnerOnEscalation: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertGatewayAnalysisAnomalyPolicyInput = {
  id?: string | null;
  name: string;
  status?: GatewayAnalysisAnomalyPolicyStatus | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  tag?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  profileKey?: GatewayAnalysisExportAnomalyProfileKey | null;
  thresholds?: Partial<GatewayAnalysisExportAnomalyThresholdConfig> | null;
  autoSyncEnabled?: boolean | null;
  autoSyncIntervalMinutes?: number | null;
  autoEscalateEnabled?: boolean | null;
  escalateSeverityThreshold?: GatewayAnalysisExportAnomalySeverity | null;
  escalateAfterSyncCount?: number | null;
  autoEscalateOwnerUserId?: string | null;
  autoEscalateFollowUpStatus?: GatewayAnalysisAnomalyIncidentFollowUpStatus | null;
  autoRemediationEnabled?: boolean | null;
  autoRemediationIntervalMinutes?: number | null;
  autoRemediationDryRunFirst?: boolean | null;
  autoRemediationActionKeys?: string[] | null;
  autoRemediationMaxApplyRunsPerIncident?: number | null;
  autoRemediationRequireAlertBeforeApply?: boolean | null;
  autoRemediationFreezeOnProviderHealthDegrade?: boolean | null;
  alertingEnabled?: boolean | null;
  alertIntervalMinutes?: number | null;
  notifyOperatorsOnEscalation?: boolean | null;
  notifyOwnerOnEscalation?: boolean | null;
};

export type GatewayAnalysisAnomalyPolicySummaryView = {
  totalPolicies: number;
  enabledPolicies: number;
  disabledPolicies: number;
  autoSyncEnabledPolicies: number;
  autoEscalateEnabledPolicies: number;
  autoRemediationEnabledPolicies: number;
  alertingEnabledPolicies: number;
  duePolicies: number;
  byStatus: GatewaySummaryBucket[];
  bySyncStatus: GatewaySummaryBucket[];
};

export const gatewayAnalysisAnomalyPolicySweepStatuses = ["ok", "error", "skipped"] as const;
export type GatewayAnalysisAnomalyPolicySweepStatus = (typeof gatewayAnalysisAnomalyPolicySweepStatuses)[number];

export type GatewayAnalysisAnomalyPolicySweepItemView = {
  policyId: string;
  policyName: string;
  status: GatewayAnalysisAnomalyPolicySweepStatus;
  error: string | null;
  lastSyncedAt: string | null;
  nextSyncDueAt: string | null;
  syncDue: boolean;
  anomalyCount: number;
  openedIncidentCount: number;
  updatedIncidentCount: number;
  resolvedIncidentCount: number;
};

export type GatewayAnalysisAnomalyPolicySweepView = {
  startedAt: string;
  completedAt: string;
  limit: number;
  attemptedCount: number;
  okCount: number;
  errorCount: number;
  skippedCount: number;
  items: GatewayAnalysisAnomalyPolicySweepItemView[];
};

export const gatewayAnalysisAnomalyIncidentStatuses = ["open", "acknowledged", "resolved"] as const;
export type GatewayAnalysisAnomalyIncidentStatus = (typeof gatewayAnalysisAnomalyIncidentStatuses)[number];

export const gatewayAnalysisAnomalyIncidentFollowUpStatuses = ["pending", "investigating", "monitoring", "done"] as const;
export type GatewayAnalysisAnomalyIncidentFollowUpStatus =
  (typeof gatewayAnalysisAnomalyIncidentFollowUpStatuses)[number];

export const gatewayAnalysisAnomalyIncidentEscalationStatuses = ["none", "escalated", "resolved"] as const;
export type GatewayAnalysisAnomalyIncidentEscalationStatus =
  (typeof gatewayAnalysisAnomalyIncidentEscalationStatuses)[number];

export const gatewayAnalysisAnomalyAlertDeliverySeverities = ["info", "warning", "danger"] as const;
export type GatewayAnalysisAnomalyAlertDeliverySeverity =
  (typeof gatewayAnalysisAnomalyAlertDeliverySeverities)[number];

export type GatewayAnalysisAnomalyIncidentView = {
  id: string;
  policyId: string | null;
  fingerprint: string;
  projectId: string | null;
  routePolicyId: string | null;
  tag: string | null;
  textMode: GatewayAnalysisExportTextMode | null;
  code: GatewayAnalysisAnomalyIncidentCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  status: GatewayAnalysisAnomalyIncidentStatus;
  ownerUserId: string | null;
  followUpStatus: GatewayAnalysisAnomalyIncidentFollowUpStatus;
  syncHitCount: number;
  escalationStatus: GatewayAnalysisAnomalyIncidentEscalationStatus;
  escalatedAt: string | null;
  escalationReason: string | null;
  latestNote: string | null;
  resolutionNote: string | null;
  lastActionAt: string | null;
  lastAlertAttemptAt: string | null;
  lastAlertedAt: string | null;
  lastAlertSeverity: GatewayAnalysisAnomalyAlertDeliverySeverity | null;
  alertDeliveryCount: number;
  summary: string;
  latestExportId: string | null;
  previousExportId: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAnalysisAnomalyIncidentSummaryView = {
  totalIncidents: number;
  openIncidents: number;
  acknowledgedIncidents: number;
  resolvedIncidents: number;
  escalatedIncidents: number;
  byStatus: GatewaySummaryBucket[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
  byFollowUpStatus: GatewaySummaryBucket[];
  byEscalationStatus: GatewaySummaryBucket[];
};

export type GatewaySyncAnalysisAnomalyIncidentsResult = {
  report: GatewayAnalysisExportAnomalyReportView;
  incidents: GatewayAnalysisAnomalyIncidentView[];
  openedIncidentIds: string[];
  updatedIncidentIds: string[];
  resolvedIncidentIds: string[];
};

export type GatewaySyncRateLimitHotspotAnomalyIncidentsResult = {
  snapshot: GatewayRateLimitHotspotAnomalySnapshotView;
  incidents: GatewayAnalysisAnomalyIncidentView[];
  openedIncidentIds: string[];
  updatedIncidentIds: string[];
  resolvedIncidentIds: string[];
};

export type GatewaySyncProviderRoutingAnalysisAnomalyIncidentsResult = {
  report: GatewayProviderRoutingAnalysisAnomalyReportView;
  incidents: GatewayAnalysisAnomalyIncidentView[];
  openedIncidentIds: string[];
  updatedIncidentIds: string[];
  resolvedIncidentIds: string[];
};

export type GatewayAnalysisAnomalyIncidentFollowUpInput = {
  ownerUserId?: string | null;
  followUpStatus?: GatewayAnalysisAnomalyIncidentFollowUpStatus | null;
  note?: string | null;
  resolutionNote?: string | null;
};

export const gatewayAnalysisAnomalyIncidentHistoryEventTypes = [
  "sync_opened",
  "sync_updated",
  "sync_resolved",
  "auto_escalated",
  "escalation_cleared",
  "alert_dispatched",
  "remediation_dry_run",
  "remediation_applied",
  "remediation_failed",
  "remediation_impact_captured",
  "acknowledged",
  "resolved",
  "follow_up_updated",
] as const;
export type GatewayAnalysisAnomalyIncidentHistoryEventType =
  (typeof gatewayAnalysisAnomalyIncidentHistoryEventTypes)[number];

export type GatewayAnalysisAnomalyIncidentHistoryView = {
  id: string;
  incidentId: string;
  eventType: GatewayAnalysisAnomalyIncidentHistoryEventType;
  actorUserId: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export const gatewayAnalysisAnomalyRemediationPriorities = ["high", "medium", "low"] as const;
export type GatewayAnalysisAnomalyRemediationPriority =
  (typeof gatewayAnalysisAnomalyRemediationPriorities)[number];

export const gatewayAnalysisAnomalyRemediationCategories = [
  "routing",
  "provider",
  "retention",
  "prompt",
  "session",
  "manual",
] as const;
export type GatewayAnalysisAnomalyRemediationCategory =
  (typeof gatewayAnalysisAnomalyRemediationCategories)[number];

export const gatewayAnalysisAnomalyRemediationExecutionModes = [
  "informational",
  "incident_follow_up",
  "route_policy_patch",
] as const;
export type GatewayAnalysisAnomalyRemediationExecutionMode =
  (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number];

export const gatewayAnalysisAnomalyRemediationRunStatuses = ["dry_run", "applied", "failed"] as const;
export type GatewayAnalysisAnomalyRemediationRunStatus =
  (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number];

export type GatewayAnalysisAnomalyIncidentRemediationRoutePolicyPatchInput = {
  providerMaxConcurrentRequests?: number | null;
  preStreamFallbackEnabled?: boolean | null;
  allowedProviderAccountIds?: string[] | null;
  projectRateLimit?: GatewayRateLimitDefinition | null;
  apiKeyRateLimit?: GatewayRateLimitDefinition | null;
  modelRateLimitKey?: string | null;
  modelRateLimit?: GatewayRateLimitDefinition | null;
  endpointRateLimitKey?: string | null;
  endpointRateLimit?: GatewayRateLimitDefinition | null;
};

export type ExecuteGatewayAnalysisAnomalyIncidentRemediationInput = {
  actionKey: string;
  dryRun?: boolean | null;
  note?: string | null;
  incidentFollowUp?: GatewayAnalysisAnomalyIncidentFollowUpInput | null;
  routePolicyPatch?: GatewayAnalysisAnomalyIncidentRemediationRoutePolicyPatchInput | null;
};

export type GatewayAnalysisAnomalyIncidentRemediationActionView = {
  actionKey: string;
  title: string;
  description: string;
  category: GatewayAnalysisAnomalyRemediationCategory;
  priority: GatewayAnalysisAnomalyRemediationPriority;
  routePolicyId: string | null;
  executable: boolean;
  executionMode: GatewayAnalysisAnomalyRemediationExecutionMode;
  defaultExecutionInput: Record<string, unknown> | null;
  recommendedChanges: Record<string, unknown> | null;
};

export type GatewayAnalysisAnomalyIncidentRemediationPlanView = {
  generatedAt: string;
  incident: GatewayAnalysisAnomalyIncidentView;
  policy: GatewayAnalysisAnomalyPolicyView | null;
  routePolicy: GatewayRoutePolicyView | null;
  overview: string;
  actions: GatewayAnalysisAnomalyIncidentRemediationActionView[];
};

export type GatewayAnalysisAnomalyIncidentRemediationRunView = {
  id: string;
  incidentId: string;
  policyId: string | null;
  routePolicyId: string | null;
  actionKey: string;
  title: string;
  executionMode: GatewayAnalysisAnomalyRemediationExecutionMode;
  status: GatewayAnalysisAnomalyRemediationRunStatus;
  dryRun: boolean;
  actorUserId: string;
  note: string | null;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  beforeIncident: GatewayAnalysisAnomalyIncidentView | null;
  afterIncident: GatewayAnalysisAnomalyIncidentView | null;
  beforeRoutePolicy: GatewayRoutePolicyView | null;
  afterRoutePolicy: GatewayRoutePolicyView | null;
  errorSummary: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type GatewayAnalysisAnomalyRemediationRunSummaryView = {
  totalRuns: number;
  dryRunRuns: number;
  appliedRuns: number;
  failedRuns: number;
  distinctIncidentCount: number;
  routePolicyChangedRuns: number;
  incidentChangedRuns: number;
  byStatus: GatewaySummaryBucket[];
  byExecutionMode: GatewaySummaryBucket[];
  byActionKey: GatewaySummaryBucket[];
  byPolicyId: GatewaySummaryBucket[];
  byRoutePolicyId: GatewaySummaryBucket[];
};

export type GatewayAnalysisAnomalyRemediationImpactMetricView = {
  beforeValue: number | null;
  afterValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
};

export type GatewayAnalysisAnomalyRemediationRunImpactView = {
  generatedAt: string;
  run: GatewayAnalysisAnomalyIncidentRemediationRunView;
  incident: GatewayAnalysisAnomalyIncidentView | null;
  projectId: string | null;
  routePolicyId: string | null;
  anchorAt: string;
  windowMinutes: number;
  beforeWindow: {
    startedAt: string;
    endedAt: string;
    summary: GatewayAnalysisSummaryView;
  };
  afterWindow: {
    startedAt: string;
    endedAt: string;
    summary: GatewayAnalysisSummaryView;
  };
  metrics: {
    completionRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    failureRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    cancellationRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    streamRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    toolRequestRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    toolResponseRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    requestArtifactCoverage: GatewayAnalysisAnomalyRemediationImpactMetricView;
    responseArtifactCoverage: GatewayAnalysisAnomalyRemediationImpactMetricView;
    promptTokensPerSample: GatewayAnalysisAnomalyRemediationImpactMetricView;
    completionTokensPerSample: GatewayAnalysisAnomalyRemediationImpactMetricView;
    totalTokensPerSample: GatewayAnalysisAnomalyRemediationImpactMetricView;
    requestTextCharsAvg: GatewayAnalysisAnomalyRemediationImpactMetricView;
    responseTextCharsAvg: GatewayAnalysisAnomalyRemediationImpactMetricView;
    firstTokenLatencyMsAvg: GatewayAnalysisAnomalyRemediationImpactMetricView;
    streamChunkCountAvg: GatewayAnalysisAnomalyRemediationImpactMetricView;
  };
};

export type GatewayAnalysisAnomalyRemediationEffectivenessMetricView = {
  improvedRuns: number;
  regressedRuns: number;
  neutralRuns: number;
  unavailableRuns: number;
};

export type GatewayAnalysisAnomalyRemediationActionEffectivenessView = {
  actionKey: string;
  runCount: number;
  impactedRunCount: number;
  unavailableRunCount: number;
  completionRate: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  failureRate: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  requestArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  responseArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  firstTokenLatencyMsAvg: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  totalTokensPerSample: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSummaryView = {
  generatedAt: string;
  windowMinutes: number;
  totalRuns: number;
  impactedRuns: number;
  unavailableRuns: number;
  byStatus: GatewaySummaryBucket[];
  byExecutionMode: GatewaySummaryBucket[];
  byActionKey: GatewaySummaryBucket[];
  completionRate: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  failureRate: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  requestArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  responseArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  firstTokenLatencyMsAvg: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  totalTokensPerSample: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  actions: GatewayAnalysisAnomalyRemediationActionEffectivenessView[];
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilterView = {
  incidentId: string | null;
  policyId: string | null;
  routePolicyId: string | null;
  actionKey: string | null;
  status: GatewayAnalysisAnomalyRemediationRunStatus | null;
  executionMode: GatewayAnalysisAnomalyRemediationExecutionMode | null;
  dryRun: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  lookbackHours: number | null;
  windowMinutes: number;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView = {
  snapshotId: string;
  label: string | null;
  createdAt: string;
  objectKey: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilterView;
  summary: GatewayAnalysisAnomalyRemediationEffectivenessSummaryView;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView = {
  totalSnapshots: number;
  totalRuns: number;
  totalImpactedRuns: number;
  totalUnavailableRuns: number;
  byRoutePolicyId: GatewaySummaryBucket[];
  byActionKey: GatewaySummaryBucket[];
  byExecutionMode: GatewaySummaryBucket[];
  byLabel: GatewaySummaryBucket[];
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotReportFilterView = {
  label: string | null;
  routePolicyId: string | null;
  actionKey: string | null;
  createdFrom: string | null;
  createdTo: string | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView = {
  improvedRate: number | null;
  regressedRate: number | null;
  neutralRate: number | null;
  unavailableRate: number | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendPointView = {
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView;
  totalRuns: number;
  impactedRunRate: number | null;
  unavailableRunRate: number | null;
  completionRate: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  failureRate: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  requestArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  responseArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  firstTokenLatencyMsAvg: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  totalTokensPerSample: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView = {
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendSummaryView = {
  latestSnapshotId: string | null;
  previousSnapshotId: string | null;
  totalRuns: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  impactedRunRate: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  unavailableRunRate: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  completionRateRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  failureRateRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  requestArtifactCoverageRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  responseArtifactCoverageRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  firstTokenLatencyMsAvgRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  totalTokensPerSampleRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView = {
  generatedAt: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotReportFilterView;
  matchedSnapshotsCount: number;
  windowSize: number;
  inventorySummary: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView;
  points: GatewayAnalysisAnomalyRemediationEffectivenessTrendPointView[];
  summary: GatewayAnalysisAnomalyRemediationEffectivenessTrendSummaryView | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalyCode =
  | "impacted_run_rate_drop"
  | "unavailable_run_rate_spike"
  | "completion_effectiveness_regressed"
  | "failure_effectiveness_regressed"
  | "request_artifact_effectiveness_regressed"
  | "response_artifact_effectiveness_regressed"
  | "latency_effectiveness_regressed"
  | "token_effectiveness_regressed";

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView = {
  code: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  latestSnapshotId: string | null;
  previousSnapshotId: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig = {
  impactedRunRateWarningThreshold: number;
  impactedRunRateCriticalThreshold: number;
  unavailableRunRateWarningThreshold: number;
  unavailableRunRateCriticalThreshold: number;
  completionRateRegressedWarningThreshold: number;
  completionRateRegressedCriticalThreshold: number;
  failureRateRegressedWarningThreshold: number;
  failureRateRegressedCriticalThreshold: number;
  requestArtifactRegressedWarningThreshold: number;
  requestArtifactRegressedCriticalThreshold: number;
  responseArtifactRegressedWarningThreshold: number;
  responseArtifactRegressedCriticalThreshold: number;
  firstTokenLatencyRegressedWarningThreshold: number;
  firstTokenLatencyRegressedCriticalThreshold: number;
  totalTokensRegressedWarningThreshold: number;
  totalTokensRegressedCriticalThreshold: number;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView = {
  generatedAt: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotReportFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig;
  latestSnapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView | null;
  previousSnapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView | null;
  trendSummary: GatewayAnalysisAnomalyRemediationEffectivenessTrendSummaryView | null;
  anomalies: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilterView = {
  label: string | null;
  routePolicyId: string | null;
  actionKey: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  lookbackHours: number | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView = {
  snapshotId: string;
  label: string | null;
  createdAt: string;
  objectKey: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilterView;
  report: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView;
};

export type GatewayAnalysisAnomalyIncidentRemediationQueueItemView = {
  incident: GatewayAnalysisAnomalyIncidentView;
  policy: GatewayAnalysisAnomalyPolicyView | null;
  routePolicy: GatewayRoutePolicyView | null;
  action: GatewayAnalysisAnomalyIncidentRemediationActionView;
  remediationDue: boolean;
  nextExecutionStatus: GatewayAnalysisAnomalyRemediationRunStatus | null;
  nextRunDueAt: string | null;
  blockedReason: string | null;
  latestRun: GatewayAnalysisAnomalyIncidentRemediationRunView | null;
};

export type GatewayAnalysisAnomalyIncidentRemediationQueueView = {
  generatedAt: string;
  limit: number;
  dueOnly: boolean;
  itemCount: number;
  dueCount: number;
  items: GatewayAnalysisAnomalyIncidentRemediationQueueItemView[];
};

export const gatewayAnalysisAnomalyRemediationSweepStatuses = ["ok", "error", "skipped"] as const;
export type GatewayAnalysisAnomalyRemediationSweepStatus =
  (typeof gatewayAnalysisAnomalyRemediationSweepStatuses)[number];

export type GatewayAnalysisAnomalyRemediationSweepItemView = {
  incidentId: string;
  actionKey: string;
  status: GatewayAnalysisAnomalyRemediationSweepStatus;
  executionStatus: GatewayAnalysisAnomalyRemediationRunStatus | null;
  runId: string | null;
  error: string | null;
};

export type GatewayAnalysisAnomalyRemediationSweepView = {
  startedAt: string;
  completedAt: string;
  limit: number;
  attemptedCount: number;
  dryRunCount: number;
  appliedCount: number;
  errorCount: number;
  skippedCount: number;
  items: GatewayAnalysisAnomalyRemediationSweepItemView[];
};

export type GatewayAnalysisAnomalyIncidentAlertQueueItemView = {
  incident: GatewayAnalysisAnomalyIncidentView;
  policy: GatewayAnalysisAnomalyPolicyView | null;
  routePolicy: GatewayRoutePolicyView | null;
  alertIntervalMinutes: number;
  alertDue: boolean;
  nextAlertDueAt: string | null;
  notifyOperators: boolean;
  notifyOwner: boolean;
  alertLevel: number;
  webhookSeverity: GatewayAnalysisAnomalyAlertDeliverySeverity;
  remediationActionKeys: string[];
};

export type GatewayAnalysisAnomalyIncidentAlertQueueView = {
  generatedAt: string;
  limit: number;
  dueOnly: boolean;
  incidentCount: number;
  dueCount: number;
  items: GatewayAnalysisAnomalyIncidentAlertQueueItemView[];
};
