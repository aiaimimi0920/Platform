export { db, pgPool } from "./db/client";
export { redis } from "./db/redis";
export { env } from "./env";

export {
  buildGatewayAnalysisExportDatasetObjectKey,
  buildGatewayAnalysisExportManifestObjectKey,
  buildGatewayAnalysisExportObjectKey,
  buildGatewayAnalysisExportPrefix,
  buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotObjectKey,
  buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotPrefix,
  buildGatewayAnalysisRemediationEffectivenessSnapshotObjectKey,
  buildGatewayAnalysisRemediationEffectivenessSnapshotPrefix,
  buildGatewayProviderAccountObjectKey,
  buildGatewayRateLimitHotspotAnomalySnapshotObjectKey,
  buildGatewayRateLimitHotspotAnomalySnapshotPrefix,
  buildGatewayRateLimitHotspotSnapshotObjectKey,
  buildGatewayRateLimitHotspotSnapshotPrefix,
  buildGatewayRequestArtifactObjectKey,
  buildGatewayRuntimeSessionObjectKey,
} from "./modules/gateway/object-keys";
export {
  buildGatewayProjectApiKey,
  parseGatewayProjectApiKey,
  resolveGatewayCompatibilityBaseUrl,
  resolveGatewayPublicBaseUrl,
  verifyGatewayProjectApiKey,
} from "./modules/gateway/api-key";

export {
  deleteGatewayObject,
  putGatewayObject,
  readGatewayObject,
} from "./modules/gateway/object-storage";
export { buildGatewayProviderRoutingScore } from "./modules/gateway/provider-routing-score";
export { MultiKeyRotator } from "./modules/gateway/multi-key-rotation";
export type { KeyEntry, KeyRotationConfig, KeySelectionStrategy } from "./modules/gateway/multi-key-rotation";

export {
  acknowledgeGatewayAnalysisAnomalyIncidentForOperator,
  authenticateGatewayAccessToken,
  createGatewayProviderAccountForOperator,
  createGatewayRequestAudit,
  ensureGatewayBenefitProject,
  exportGatewayAnalysisRowsForOperator,
  finalizeGatewayRequestAudit,
  getGatewayAnalysisAnomalyIncidentSummaryForOperator,
  getGatewayAnalysisAnomalyPolicySummaryForOperator,
  getGatewayAnalysisAnomalyIncidentRemediationPlanForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator,
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
  listGatewayAnalysisAnomalyIncidentAlertQueueForOperator,
  listGatewayAnalysisAnomalyIncidentHistoryForOperator,
  listGatewayAnalysisAnomalyRemediationQueueForOperator,
  listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator,
  getGatewayAnalysisExportAnomalyReportForOperator,
  getGatewayAnalysisExportBaselineReportForOperator,
  getGatewayProviderRoutingAnalysisAnomalyReportForOperator,
  getGatewayProviderRoutingAnalysisSummaryForOperator,
  getGatewayAnalysisExportTrendReportForOperator,
  getGatewayAnalysisExportTimelineReportForOperator,
  getGatewayPromptCacheSummaryForProject,
  getGatewayPromptCacheTrendReportForProject,
  getGatewayAnalysisSummaryForOperator,
  getGatewayRateLimitHotspotAnomalyReportForOperator,
  getGatewayRateLimitHotspotAnomalySnapshotForOperator,
  getGatewayRateLimitHotspotSnapshotForOperator,
  getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator,
  getGatewayRateLimitHotspotSnapshotTrendReportForOperator,
  getGatewayRateLimitHotspotTrendReportForOperator,
  listGatewayRateLimitHotspotAnomalySnapshotsForOperator,
  listGatewayRateLimitHotspotSnapshotsForOperator,
  persistGatewayRateLimitHotspotAnomalySnapshotForOperator,
  persistGatewayRateLimitHotspotSnapshotForOperator,
  summarizeGatewayRateLimitHotspotsForOperator,
  listGatewayAnalysisAnomalyIncidentsForOperator,
  listGatewayAnalysisAnomalyPoliciesForOperator,
  getGatewayPersistedAnalysisExportDiffForOperator,
  getGatewayPersistedAnalysisExportInventorySummaryForOperator,
  getGatewayPersistedAnalysisExportForOperator,
  getGatewayRequestArtifactsForOperator,
  getGatewayRequestAuditForOperator,
  getGatewaySessionDetailForOperator,
  getGatewayReadinessReport,
  listGatewayModelsForProject,
  listGatewayAnalysisSamplesForOperator,
  listGatewayOperatorCatalog,
  listGatewayPersistedAnalysisExportsForOperator,
  getGatewayProviderHealthSummaryForOperator,
  listGatewayProviderHealthForOperator,
  listGatewayRequestAuditsForOperator,
  listGatewayRequestAuditSummaryForOperator,
  listGatewayRuntimePressureForOperator,
  listGatewaySessionsForOperator,
  markGatewayRequestAuditDisconnected,
  noteProviderAccountFailure,
  noteProviderAccountSuccess,
  patchGatewayProviderSourceProfileForOperator,
  probeGatewayProviderAccountForOperator,
  persistGatewayAnalysisExportForOperator,
  resolveGatewayAnalysisAnomalyIncidentForOperator,
  runGatewayPersistedAnalysisExportCleanupForOperator,
  recordGatewaySessionOutcome,
  resolveGatewayApiAccessForProject,
  resolveGatewayProviderNamespaceContext,
  resolveGatewayRouteContext,
  resolveGatewaySession,
  runGatewayCoolingSweepForOperator,
  rotateGatewayApiAccessForProject,
  saveGatewayAnalysisAnomalyPolicyForOperator,
  backfillGatewayProviderSourceProfilesForOperator,
  recordGatewayAnalysisAnomalyIncidentAlertDispatchForOperator,
  saveGatewayModelAliasForOperator,
  saveGatewayRoutePolicyForOperator,
  sweepGatewayAnalysisAnomalyPoliciesForOperator,
  sweepGatewayAnalysisAnomalyRemediationsForOperator,
  syncGatewayAnalysisAnomalyPolicyForOperator,
  syncGatewayAnalysisAnomalyIncidentsForOperator,
  syncGatewayProviderRoutingAnalysisAnomalyIncidentsForOperator,
  syncGatewayRateLimitHotspotAnomalyIncidentsForOperator,
  sweepGatewayCoolingProviders,
  updateGatewayAnalysisAnomalyIncidentFollowUpForOperator,
  updateGatewayPersistedAnalysisExportMetadataForOperator,
  updateGatewayProviderAccountForOperator,
  upsertGatewaySession,
} from "./modules/gateway/service";
export type {
  AuthenticatedGatewayAccess,
  GatewayResolvedProviderNamespaceContext,
  GatewayResolvedRouteContext,
  GatewayRouteCandidate,
} from "./modules/gateway/service";
export {
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
  gatewayUserCredentials,
} from "./modules/gateway/schema";

// -- Credential Cache ---------------------------------------------------------
export {
  getGatewayCredential,
  setGatewayCredential,
  deleteGatewayCredential,
  listGatewayCredentialsByProject,
  listGatewayCredentialsByUser,
  resolveGatewayCredentialForRequest,
} from "./modules/gateway/credential-cache";
export type {
  GatewayCredentialKind,
  GatewayCredentialEntry,
} from "./modules/gateway/credential-cache";

// -- Usage Tracking -----------------------------------------------------------
export {
  parseUpstreamUsage,
  estimateTokenCount,
  checkGatewayQuota,
  deductGatewayQuota,
  initGatewayQuota,
  enqueueGatewayUsageReport,
  dequeueGatewayUsageReports,
} from "./modules/gateway/usage-tracking";
export type {
  GatewayUsageReport,
  GatewayQuotaCheckResult,
} from "./modules/gateway/usage-tracking";

// -- Response Cache -----------------------------------------------------------
export {
  buildResponseCacheKey,
  getGatewayCachedResponse,
  setGatewayCachedResponse,
  invalidateGatewayResponseCache,
  getGatewayResponseCacheStats,
  resolveEndpointTtl,
} from "./modules/gateway/response-cache";
export type {
  GatewayResponseCacheConfig,
  GatewayResponseCacheEntry,
  GatewayResponseCacheResult,
  GatewayResponseCacheScope,
} from "./modules/gateway/response-cache";

// -- Content Filter -----------------------------------------------------------
export {
  createKeywordFilter,
  createPiiFilter,
  createRegexFilter,
  runGatewayContentFilterChain,
  extractTextFromMessages,
  buildDefaultFilterChain,
} from "./modules/gateway/content-filter";
export type {
  GatewayContentFilterVerdict,
  GatewayContentFilterMatch,
  GatewayContentFilterResult,
  GatewayContentFilter,
  GatewayContentFilterChainConfig,
} from "./modules/gateway/content-filter";

// -- Schema Normalizer --------------------------------------------------------
export {
  normalizeJsonSchema,
  normalizeToolSchemas,
} from "./modules/gateway/schema-normalizer";

// -- Credential Refresh -------------------------------------------------------
export {
  BaseCredentialRefresher,
  CredentialRefresherRegistry,
  credentialRefresherRegistry,
  checkCredentialExpiration,
  refreshCredential,
} from "./modules/gateway/credential-refresh";
export type {
  ICredentialRefresher,
  CredentialRefreshResult,
  CredentialExpirationStatus,
} from "./modules/gateway/credential-refresh";

// -- Credential Failover ------------------------------------------------------
export {
  CredentialFailoverManager,
  DEFAULT_FAILOVER_CONFIG,
} from "./modules/gateway/credential-failover";
export type {
  CredentialEntry,
  LoadBalancingMode,
  CredentialFailoverConfig,
  CredentialSelectionResult,
  CredentialExecutionResult,
} from "./modules/gateway/credential-failover";

// -- Thinking Filter ----------------------------------------------------------
export {
  createThinkingFilterState,
  processThinkingChunk,
  finalizeThinkingFilter,
  extractThinkingContent,
} from "./modules/gateway/thinking-filter";
export type {
  ThinkingFilterState,
} from "./modules/gateway/thinking-filter";

// -- Proxy Manager ------------------------------------------------------------
export {
  parseProxyUrl,
  resolveEffectiveProxy,
  getProxyCacheKey,
  HttpClientPool,
  DIRECT_PROXY,
} from "./modules/gateway/proxy-manager";
export type {
  ProxyConfig,
  ProxyProtocol,
} from "./modules/gateway/proxy-manager";

// -- Region Resolver ----------------------------------------------------------
export {
  resolveAuthRegion,
  resolveApiRegion,
  resolveRegionConfig,
  buildAuthEndpoint,
  buildApiEndpoint,
  parseRegionFromEndpoint,
  isValidRegion,
  DEFAULT_REGION,
  DEFAULT_AUTH_REGION,
  DEFAULT_API_REGION,
  COMMON_REGIONS,
} from "./modules/gateway/region-resolver";
export type {
  RegionConfig,
  ResolvedRegionConfig,
  CommonRegion,
} from "./modules/gateway/region-resolver";

// -- Auth Adapter -------------------------------------------------------------
export {
  createGatewayApiKeyAuthAdapter,
  createGatewayExternalAuthAdapter,
  createGatewayStaticKeyAuthAdapter,
  resolveGatewayAuth,
  extractGatewayAuthRequest,
} from "./modules/gateway/auth-adapter";
export type {
  GatewayAuthResult,
  GatewayAuthRequest,
  GatewayAuthAdapter,
  GatewayApiKeyLookup,
} from "./modules/gateway/auth-adapter";

// -- Provider Credential Sync -------------------------------------------------
export {
  getCachedProviderPayload,
  setCachedProviderPayload,
  deleteCachedProviderPayload,
  syncProviderPayloadsBatch,
  invalidateCachedProviderPayloads,
  providerPayloadKey,
} from "./modules/gateway/provider-credential-sync";

// -- Provider Credential Manager ----------------------------------------------
export {
  chooseStorageMode,
  createProviderCredential,
  updateProviderCredential,
  deleteProviderCredential,
  getProviderCredential,
  invalidateProviderCredentialCache,
  warmupProviderCredentialCache,
  batchProviderCredentialOperations,
} from "./modules/gateway/provider-credential-manager";
export type {
  CreateProviderCredentialInput,
  CreateProviderCredentialResult,
  UpdateProviderCredentialInput,
  UpdateProviderCredentialResult,
  DeleteProviderCredentialResult,
  GetProviderCredentialOptions,
  GetProviderCredentialResult,
  InvalidateCacheInput,
  InvalidateCacheResult,
  WarmupCacheInput,
  WarmupCacheResult,
  BatchOperation,
  BatchOperationResult,
  BatchOperationsInput,
  BatchOperationsResult,
} from "./modules/gateway/provider-credential-manager";

// -- Provider Key Health ------------------------------------------------------
export {
  checkProviderKeyHealth,
  getProviderKeyHealthReport,
} from "./modules/gateway/provider-key-health";
export type {
  KeyHealthStatus,
  KeyHealthEntry,
  KeyHealthReport,
  CheckKeyHealthInput,
  CheckKeyHealthResult,
} from "./modules/gateway/provider-key-health";

// -- User Credential Manager --------------------------------------------------
export {
  issueUserCredential,
  verifyUserCredential,
  revokeUserCredential,
  authenticateUserCredential,
} from "./modules/gateway/user-credential-manager";
export type {
  IssueUserCredentialInput,
  IssueUserCredentialResult,
  VerifyUserCredentialInput,
  VerifyUserCredentialResult,
  RevokeUserCredentialInput,
  RevokeUserCredentialResult,
} from "./modules/gateway/user-credential-manager";

// -- Adaptive Concurrency (AIMD) ----------------------------------------------
export { AimdConcurrencyController } from "./modules/gateway/adaptive-concurrency";
export type {
  AimdConcurrencyConfig,
  ConcurrencySnapshot,
  ConcurrencyPermit,
} from "./modules/gateway/adaptive-concurrency";

// -- Standard Error + FallbackHint --------------------------------------------
export {
  classifyUpstreamError,
  isRetryableError,
  shouldFallbackToNextProvider,
  suggestedRetryDelay,
  formatStandardError,
} from "./modules/gateway/standard-error";
export type {
  GatewayErrorKind,
  GatewayFallbackHint,
  GatewayStandardError,
} from "./modules/gateway/standard-error";

// -- Sliding Window Metrics ---------------------------------------------------
export { SlidingWindowMetrics, percentile } from "./modules/gateway/sliding-metrics";
export type {
  MetricEntry,
  MetricsSummary,
} from "./modules/gateway/sliding-metrics";

// -- Protocol Hooks -----------------------------------------------------------
export {
  runAfterPackHooks,
  runBeforeSendHooks,
  runAfterReceiveHooks,
  runBeforeUnpackHooks,
  createMistralToolIdHook,
  createHeaderInjectionHook,
  createRequestEnvelopeHook,
  createFieldInjectionHook,
  resolveHooksForProvider,
} from "./modules/gateway/protocol-hooks";
export type {
  ProtocolHookContext,
  GatewayProtocolHook,
} from "./modules/gateway/protocol-hooks";

// -- Tracked Stream (TTFT + AIMD integration) ---------------------------------
export {
  TrackedStream,
  createTrackedStream,
  buildMetricsRecordingCallbacks,
  isRateLimitError,
} from "./modules/gateway/tracked-stream";
export type {
  TrackedStreamCallbacks,
  StreamCompletionMetrics,
  AimdPermitHandle,
} from "./modules/gateway/tracked-stream";

// -- Balance Status (shouldDeprioritize) --------------------------------------
export {
  computeRemainingRatio,
  buildQuotaStatus,
  evaluateBalanceStatus,
  shouldDeprioritizeProvider,
  isProviderUnavailable,
  buildBalanceDisplay,
  mergeBalanceIntoRoutingWeight,
} from "./modules/gateway/balance-status";
export type {
  QuotaUnit,
  QuotaStatus,
  QuotaType,
  BalanceStatus,
  BalanceCheckerConfig,
} from "./modules/gateway/balance-status";
