import type {
  GatewayAggregatorApiMode,
  GatewayAnalysisExportFilterView,
  GatewayAnalysisExportAnomalyThresholdConfig,
  GatewayEndpointExecutionModeMap,
  GatewayExecutionMode,
  GatewayProviderSourceKind,
  GatewayRequestAnalysisProfile,
  GatewayProviderAccountPayload,
  GatewayRequestRouteTrace,
  GatewayRoutePolicyConfig,
  GatewayWebReverseAccessMode,
} from "@neuro/contracts";
import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";

export const gatewayTenants = pgTable(
  "gateway_tenants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull(),
    ownerUserId: text("owner_user_id"),
    sourceKind: text("source_kind").notNull(),
    sourceKey: text("source_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    sourceKeyUnique: uniqueIndex("gateway_tenants_source_key_idx").on(table.sourceKind, table.sourceKey),
  }),
);

export const gatewayProjects = pgTable(
  "gateway_projects",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => gatewayTenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull(),
    sourceKind: text("source_kind").notNull(),
    sourceKey: text("source_key").notNull(),
    defaultRoutePolicyId: text("default_route_policy_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    sourceKeyUnique: uniqueIndex("gateway_projects_source_key_idx").on(table.sourceKind, table.sourceKey),
  }),
);

export const gatewayApiKeys = pgTable(
  "gateway_api_keys",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => gatewayProjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull(),
    rotatedFromApiKeyId: text("rotated_from_api_key_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: text("revoked_by_user_id"),
    revokeReason: text("revoke_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    projectStatusIdx: index("gateway_api_keys_project_status_idx").on(table.projectId, table.status),
  }),
);

export const gatewayProviderAccounts = pgTable(
  "gateway_provider_accounts",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    serviceProviderKey: text("service_provider_key").notNull(),
    serviceProviderLabel: text("service_provider_label").notNull(),
    adapter: text("adapter").notNull(),
    protocolFamily: text("protocol_family").notNull(),
    protocolProfile: text("protocol_profile").notNull().default("custom"),
    status: text("status").notNull(),
    sourceKind: text("source_kind").$type<GatewayProviderSourceKind | null>(),
    aggregatorApiMode: text("aggregator_api_mode").$type<GatewayAggregatorApiMode | null>(),
    webReverseAccessMode: text("web_reverse_access_mode").$type<GatewayWebReverseAccessMode | null>(),
    sourceNotes: text("source_notes"),
    executionMode: text("execution_mode").$type<GatewayExecutionMode>().notNull().default("direct_http"),
    endpointExecutionModes: jsonb("endpoint_execution_modes").$type<GatewayEndpointExecutionModeMap | null>(),
    payloadInline: jsonb("payload_inline").$type<GatewayProviderAccountPayload | null>(),
    payloadObjectKey: text("payload_object_key"),
    payloadContentType: text("payload_content_type"),
    storageMode: text("storage_mode").notNull(),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    lastError: text("last_error"),
    failureCount: integer("failure_count").notNull().default(0),
    lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    statusCooldownIdx: index("gateway_provider_accounts_status_cooldown_idx").on(table.status, table.cooldownUntil),
    protocolStatusIdx: index("gateway_provider_accounts_protocol_status_idx").on(table.protocolFamily, table.status),
    protocolProfileStatusIdx: index("gateway_provider_accounts_protocol_profile_status_idx").on(
      table.protocolProfile,
      table.status,
    ),
    sourceStatusIdx: index("gateway_provider_accounts_source_status_idx").on(table.sourceKind, table.status),
    serviceProviderKeyIdx: index("gateway_provider_accounts_service_provider_key_idx").on(table.serviceProviderKey),
  }),
);

export const gatewayProviderCredentials = pgTable(
  "gateway_provider_credentials",
  {
    id: text("id").primaryKey(),
    providerAccountId: text("provider_account_id")
      .notNull()
      .references(() => gatewayProviderAccounts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    status: text("status").notNull(),
    payloadInline: jsonb("payload_inline").$type<GatewayProviderAccountPayload | null>(),
    payloadObjectKey: text("payload_object_key"),
    payloadContentType: text("payload_content_type"),
    storageMode: text("storage_mode").notNull(),
    sourceKind: text("source_kind").notNull().default("manual"),
    sourcePath: text("source_path"),
    sourceHash: text("source_hash"),
    syncMode: text("sync_mode").notNull().default("manual"),
    syncState: text("sync_state").notNull().default("idle"),
    syncError: text("sync_error"),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    lastError: text("last_error"),
    failureCount: integer("failure_count").notNull().default(0),
    lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => ({
    providerStatusIdx: index("gateway_provider_credentials_provider_status_idx").on(
      table.providerAccountId,
      table.status,
    ),
    statusCooldownIdx: index("gateway_provider_credentials_status_cooldown_idx").on(
      table.status,
      table.cooldownUntil,
    ),
    sourcePathIdx: uniqueIndex("gateway_provider_credentials_source_path_idx").on(table.sourcePath),
  }),
);

export const gatewayProviderCapabilityCatalog = pgTable(
  "gateway_provider_capability_catalog",
  {
    id: text("id").primaryKey(),
    providerAccountId: text("provider_account_id").notNull().references(() => gatewayProviderAccounts.id, { onDelete: "cascade" }),
    modelCode: text("model_code").notNull(),
    endpointKind: text("endpoint_kind").notNull(),
    upstreamModel: text("upstream_model"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    providerModelEndpointIdx: uniqueIndex("gateway_provider_capability_catalog_provider_model_endpoint_idx").on(
      table.providerAccountId,
      table.modelCode,
      table.endpointKind,
    ),
  }),
);

export const gatewayPlatformAccessCatalog = pgTable(
  "gateway_platform_access_catalog",
  {
    id: text("id").primaryKey(),
    providerCapabilityId: text("provider_capability_id")
      .notNull()
      .references(() => gatewayProviderCapabilityCatalog.id, { onDelete: "cascade" }),
    modelCode: text("model_code").notNull(),
    endpointKind: text("endpoint_kind").notNull(),
    upstreamModel: text("upstream_model"),
    platformTier: text("platform_tier").notNull(),
    status: text("status").notNull(),
    operatorWeight: integer("operator_weight").notNull().default(1),
    routingPriority: integer("routing_priority").notNull().default(100),
    enabledForSale: boolean("enabled_for_sale").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    modelEndpointIdx: index("gateway_platform_access_catalog_model_endpoint_idx").on(table.modelCode, table.endpointKind),
    statusSaleIdx: index("gateway_platform_access_catalog_status_sale_idx").on(table.status, table.enabledForSale),
  }),
);

export const gatewayAccessBundles = pgTable(
  "gateway_access_bundles",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => gatewayProjects.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    billingMode: text("billing_mode").notNull().default("time_pass"),
    status: text("status").notNull(),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("gateway_access_bundles_slug_idx").on(table.slug),
  }),
);

export const gatewayAccessBundleItems = pgTable(
  "gateway_access_bundle_items",
  {
    bundleId: text("bundle_id").notNull().references(() => gatewayAccessBundles.id, { onDelete: "cascade" }),
    platformAccessId: text("platform_access_id")
      .notNull()
      .references(() => gatewayPlatformAccessCatalog.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
);

export const gatewayAccessKeys = pgTable(
  "gateway_access_keys",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    resolvedProjectId: text("resolved_project_id").notNull().references(() => gatewayProjects.id, { onDelete: "cascade" }),
    resolvedTenantId: text("resolved_tenant_id").notNull().references(() => gatewayTenants.id, { onDelete: "cascade" }),
    keyKind: text("key_kind").notNull(),
    status: text("status").notNull(),
    publicKeyPrefix: text("public_key_prefix").notNull(),
    displayName: text("display_name").notNull(),
    externalKey: text("external_key"),
    rotatedFromAccessKeyId: text("rotated_from_access_key_id").references(
      (): AnyPgColumn => gatewayAccessKeys.id,
      { onDelete: "set null" },
    ),
    legacyGatewayApiKeyId: text("legacy_gateway_api_key_id").unique(),
    legacyUserCredentialId: text("legacy_user_credential_id").unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    externalKeyIdx: uniqueIndex("gateway_access_keys_external_key_idx").on(table.externalKey),
    ownerStatusIdx: index("gateway_access_keys_owner_status_idx").on(table.ownerType, table.ownerId, table.status),
    projectStatusIdx: index("gateway_access_keys_project_status_idx").on(table.resolvedProjectId, table.status),
  }),
);

export const gatewayAccessKeyBundleBindings = pgTable(
  "gateway_access_key_bundle_bindings",
  {
    accessKeyId: text("access_key_id").notNull().references(() => gatewayAccessKeys.id, { onDelete: "cascade" }),
    bundleId: text("bundle_id").notNull().references(() => gatewayAccessBundles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
);

export const gatewayAccessKeyBalances = pgTable(
  "gateway_access_key_balances",
  {
    accessKeyId: text("access_key_id").primaryKey().references(() => gatewayAccessKeys.id, { onDelete: "cascade" }),
    balanceMode: text("balance_mode").notNull(),
    status: text("status").notNull(),
    unlimitedUntil: timestamp("unlimited_until", { withTimezone: true }),
    periodStartsAt: timestamp("period_starts_at", { withTimezone: true }),
    periodEndsAt: timestamp("period_ends_at", { withTimezone: true }),
    totalTokens: integer("total_tokens"),
    remainingTokens: integer("remaining_tokens"),
    totalMessages: integer("total_messages"),
    remainingMessages: integer("remaining_messages"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    statusIdx: index("gateway_access_key_balances_status_idx").on(table.status, table.balanceMode),
  }),
);

export const gatewayAccessKeyAggregateMemberships = pgTable(
  "gateway_access_key_aggregate_memberships",
  {
    aggregateAccessKeyId: text("aggregate_access_key_id")
      .notNull()
      .references(() => gatewayAccessKeys.id, { onDelete: "cascade" }),
    memberAccessKeyId: text("member_access_key_id").notNull().references(() => gatewayAccessKeys.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    memberIdx: index("gateway_access_key_aggregate_memberships_member_idx").on(table.memberAccessKeyId),
  }),
);

export const gatewayModelAliases = pgTable(
  "gateway_model_aliases",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => gatewayProjects.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").$type<"global" | "provider_special">().notNull().default("global"),
    alias: text("alias").notNull(),
    providerAccountId: text("provider_account_id").notNull().references(() => gatewayProviderAccounts.id, { onDelete: "cascade" }),
    upstreamModel: text("upstream_model"),
    priority: integer("priority").notNull().default(100),
    weight: integer("weight").notNull().default(1),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    projectAliasEnabledIdx: index("gateway_model_aliases_project_alias_enabled_idx").on(table.projectId, table.alias, table.enabled),
    aliasEnabledIdx: index("gateway_model_aliases_alias_enabled_idx").on(table.alias, table.enabled),
  }),
);

export const gatewayRoutePolicies = pgTable(
  "gateway_route_policies",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => gatewayProjects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<GatewayRoutePolicyConfig>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    projectDefaultEnabledIdx: index("gateway_route_policies_project_default_enabled_idx").on(
      table.projectId,
      table.isDefault,
      table.enabled,
    ),
  }),
);

// Gateway User Credentials
export const gatewayUserCredentials = pgTable(
  "gateway_user_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id").notNull().references(() => gatewayProjects.id, { onDelete: "cascade" }),
    credentialKey: text("credential_key").notNull().unique(),
    credentialType: text("credential_type").notNull(),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    scope: jsonb("scope").$type<string[]>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"),
  },
  (table) => ({
    userIdIdx: index("gateway_user_credentials_user_id_idx").on(table.userId),
    credentialKeyIdx: index("gateway_user_credentials_credential_key_idx").on(table.credentialKey),
    statusExpiresAtIdx: index("gateway_user_credentials_status_expires_at_idx").on(table.status, table.expiresAt),
    projectIdStatusIdx: index("gateway_user_credentials_project_id_status_idx").on(table.projectId, table.status),
  }),
);

export const gatewaySessions = pgTable(
  "gateway_sessions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => gatewayProjects.id, { onDelete: "cascade" }),
    sessionKey: text("session_key").notNull(),
    protocolFamily: text("protocol_family").notNull(),
    providerAccountId: text("provider_account_id").notNull().references(() => gatewayProviderAccounts.id, { onDelete: "cascade" }),
    latestResponseId: text("latest_response_id"),
    upstreamSessionId: text("upstream_session_id"),
    runtimeStateObjectKey: text("runtime_state_object_key"),
    activeRequestAuditId: text("active_request_audit_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    projectSessionUnique: uniqueIndex("gateway_sessions_project_session_idx").on(table.projectId, table.sessionKey),
    projectLastUsedIdx: index("gateway_sessions_project_last_used_idx").on(table.projectId, table.lastUsedAt),
  }),
);

export const gatewayRequestAudits = pgTable(
  "gateway_request_audits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => gatewayProjects.id, { onDelete: "cascade" }),
    accessKeyId: text("access_key_id").references(() => gatewayAccessKeys.id, { onDelete: "set null" }),
    sourceAccessKeyId: text("source_access_key_id").references(() => gatewayAccessKeys.id, { onDelete: "set null" }),
    apiKeyId: text("api_key_id").references(() => gatewayApiKeys.id, { onDelete: "cascade" }),
    userCredentialId: text("user_credential_id").references(() => gatewayUserCredentials.id, { onDelete: "set null" }),
    sessionId: text("session_id").references(() => gatewaySessions.id, { onDelete: "set null" }),
    routePolicyId: text("route_policy_id"),
    providerAccountId: text("provider_account_id").references(() => gatewayProviderAccounts.id, { onDelete: "set null" }),
    protocolFamily: text("protocol_family").notNull(),
    endpointKind: text("endpoint_kind").notNull(),
    requestedModel: text("requested_model"),
    resolvedModel: text("resolved_model"),
    modelAlias: text("model_alias"),
    stream: boolean("stream").notNull().default(false),
    routeAttemptCount: integer("route_attempt_count").notNull().default(1),
    status: text("status").notNull(),
    upstreamStatus: integer("upstream_status"),
    durationMs: integer("duration_ms"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    cacheCreationInputTokens: integer("cache_creation_input_tokens"),
    cacheReadInputTokens: integer("cache_read_input_tokens"),
    clientHasCacheControl: boolean("client_has_cache_control").notNull().default(false),
    autoCacheApplied: boolean("auto_cache_applied").notNull().default(false),
    errorSummary: text("error_summary"),
    routeTrace: jsonb("route_trace").$type<GatewayRequestRouteTrace | null>(),
    analysisProfile: jsonb("analysis_profile").$type<GatewayRequestAnalysisProfile | null>(),
    requestArtifactObjectKey: text("request_artifact_object_key"),
    responseArtifactObjectKey: text("response_artifact_object_key"),
    responseId: text("response_id").notNull(),
    previousResponseId: text("previous_response_id"),
    clientDisconnectedAt: timestamp("client_disconnected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    responseIdUnique: uniqueIndex("gateway_request_audits_response_id_idx").on(table.responseId),
    projectCreatedIdx: index("gateway_request_audits_project_created_idx").on(table.projectId, table.createdAt),
    accessKeyCreatedIdx: index("gateway_request_audits_access_key_created_idx").on(table.accessKeyId, table.createdAt),
    sourceAccessKeyCreatedIdx: index("gateway_request_audits_source_access_key_created_idx").on(
      table.sourceAccessKeyId,
      table.createdAt,
    ),
    providerCreatedIdx: index("gateway_request_audits_provider_created_idx").on(table.providerAccountId, table.createdAt),
    userCredentialCreatedIdx: index("gateway_request_audits_user_credential_created_idx").on(
      table.userCredentialId,
      table.createdAt,
    ),
  }),
);

export const gatewayAnalysisExports = pgTable(
  "gateway_analysis_exports",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => gatewayProjects.id, { onDelete: "set null" }),
    label: text("label"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("active"),
    textMode: text("text_mode").notNull(),
    maxTextChars: integer("max_text_chars").notNull(),
    filters: jsonb("filters").$type<GatewayAnalysisExportFilterView>().notNull(),
    objectPrefix: text("object_prefix").notNull(),
    manifestObjectKey: text("manifest_object_key").notNull(),
    datasetObjectKey: text("dataset_object_key").notNull(),
    sampleCount: integer("sample_count").notNull().default(0),
    requestArtifactCount: integer("request_artifact_count").notNull().default(0),
    responseArtifactCount: integer("response_artifact_count").notNull().default(0),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }),
    cleanedUpAt: timestamp("cleaned_up_at", { withTimezone: true }),
    lastCleanupError: text("last_cleanup_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    projectCreatedIdx: index("gateway_analysis_exports_project_created_idx").on(table.projectId, table.createdAt),
    textModeCreatedIdx: index("gateway_analysis_exports_text_mode_created_idx").on(table.textMode, table.createdAt),
    statusRetentionIdx: index("gateway_analysis_exports_status_retention_idx").on(table.status, table.retentionExpiresAt),
    createdIdx: index("gateway_analysis_exports_created_idx").on(table.createdAt),
  }),
);

export const gatewayAnalysisAnomalyPolicies = pgTable(
  "gateway_analysis_anomaly_policies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull().default("enabled"),
    projectId: text("project_id").references(() => gatewayProjects.id, { onDelete: "set null" }),
    routePolicyId: text("route_policy_id").references(() => gatewayRoutePolicies.id, { onDelete: "set null" }),
    tag: text("tag"),
    textMode: text("text_mode"),
    profileKey: text("profile_key").notNull(),
    thresholds: jsonb("thresholds").$type<GatewayAnalysisExportAnomalyThresholdConfig>().notNull(),
    autoSyncEnabled: boolean("auto_sync_enabled").notNull().default(false),
    autoSyncIntervalMinutes: integer("auto_sync_interval_minutes"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status"),
    lastSyncError: text("last_sync_error"),
    autoEscalateEnabled: boolean("auto_escalate_enabled").notNull().default(false),
    escalateSeverityThreshold: text("escalate_severity_threshold"),
    escalateAfterSyncCount: integer("escalate_after_sync_count"),
    autoEscalateOwnerUserId: text("auto_escalate_owner_user_id"),
    autoEscalateFollowUpStatus: text("auto_escalate_follow_up_status"),
    autoRemediationEnabled: boolean("auto_remediation_enabled").notNull().default(false),
    autoRemediationIntervalMinutes: integer("auto_remediation_interval_minutes"),
    autoRemediationDryRunFirst: boolean("auto_remediation_dry_run_first").notNull().default(true),
    autoRemediationActionKeys: jsonb("auto_remediation_action_keys").$type<string[] | null>(),
    autoRemediationMaxApplyRunsPerIncident: integer("auto_remediation_max_apply_runs_per_incident"),
    autoRemediationRequireAlertBeforeApply: boolean("auto_remediation_require_alert_before_apply").notNull().default(false),
    autoRemediationFreezeOnProviderHealthDegrade: boolean("auto_remediation_freeze_on_provider_health_degrade")
      .notNull()
      .default(true),
    alertingEnabled: boolean("alerting_enabled").notNull().default(true),
    alertIntervalMinutes: integer("alert_interval_minutes"),
    notifyOperatorsOnEscalation: boolean("notify_operators_on_escalation").notNull().default(true),
    notifyOwnerOnEscalation: boolean("notify_owner_on_escalation").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    projectStatusIdx: index("gateway_analysis_anomaly_policies_project_status_idx").on(table.projectId, table.status),
    statusCreatedIdx: index("gateway_analysis_anomaly_policies_status_created_idx").on(table.status, table.createdAt),
    autoEscalateStatusIdx: index("gateway_analysis_anomaly_policies_auto_escalate_status_idx").on(
      table.autoEscalateEnabled,
      table.status,
    ),
    routePolicyStatusIdx: index("gateway_analysis_anomaly_policies_route_policy_status_idx").on(
      table.routePolicyId,
      table.status,
    ),
    alertingStatusIdx: index("gateway_analysis_anomaly_policies_alerting_status_idx").on(
      table.alertingEnabled,
      table.status,
    ),
  }),
);

export const gatewayAnalysisAnomalyIncidents = pgTable(
  "gateway_analysis_anomaly_incidents",
  {
    id: text("id").primaryKey(),
    policyId: text("policy_id").references(() => gatewayAnalysisAnomalyPolicies.id, { onDelete: "set null" }),
    fingerprint: text("fingerprint").notNull(),
    projectId: text("project_id").references(() => gatewayProjects.id, { onDelete: "set null" }),
    routePolicyId: text("route_policy_id").references(() => gatewayRoutePolicies.id, { onDelete: "set null" }),
    tag: text("tag"),
    textMode: text("text_mode"),
    code: text("code").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull().default("open"),
    ownerUserId: text("owner_user_id"),
    followUpStatus: text("follow_up_status").notNull().default("pending"),
    syncHitCount: integer("sync_hit_count").notNull().default(0),
    escalationStatus: text("escalation_status").notNull().default("none"),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    escalationReason: text("escalation_reason"),
    latestNote: text("latest_note"),
    resolutionNote: text("resolution_note"),
    lastActionAt: timestamp("last_action_at", { withTimezone: true }),
    lastAlertAttemptAt: timestamp("last_alert_attempt_at", { withTimezone: true }),
    lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }),
    lastAlertSeverity: text("last_alert_severity"),
    alertDeliveryCount: integer("alert_delivery_count").notNull().default(0),
    summary: text("summary").notNull(),
    latestExportId: text("latest_export_id"),
    previousExportId: text("previous_export_id"),
    latestValue: doublePrecision("latest_value"),
    previousValue: doublePrecision("previous_value"),
    deltaValue: doublePrecision("delta_value"),
    deltaRatio: doublePrecision("delta_ratio"),
    thresholdValue: doublePrecision("threshold_value"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    fingerprintUnique: uniqueIndex("gateway_analysis_anomaly_incidents_fingerprint_idx").on(table.fingerprint),
    projectStatusIdx: index("gateway_analysis_anomaly_incidents_project_status_idx").on(table.projectId, table.status),
    routePolicyStatusIdx: index("gateway_analysis_anomaly_incidents_route_policy_status_idx").on(
      table.routePolicyId,
      table.status,
    ),
    statusSeverityIdx: index("gateway_analysis_anomaly_incidents_status_severity_idx").on(table.status, table.severity),
    codeStatusIdx: index("gateway_analysis_anomaly_incidents_code_status_idx").on(table.code, table.status),
    ownerFollowUpIdx: index("gateway_analysis_anomaly_incidents_owner_follow_up_idx").on(table.ownerUserId, table.followUpStatus),
    escalationStatusIdx: index("gateway_analysis_anomaly_incidents_escalation_status_idx").on(
      table.escalationStatus,
      table.status,
    ),
    escalationAlertAttemptIdx: index("gateway_analysis_anomaly_incidents_escalation_alert_attempt_idx").on(
      table.escalationStatus,
      table.status,
      table.lastAlertAttemptAt,
    ),
  }),
);

export const gatewayAnalysisAnomalyIncidentHistory = pgTable(
  "gateway_analysis_anomaly_incident_history",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id")
      .notNull()
      .references(() => gatewayAnalysisAnomalyIncidents.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorUserId: text("actor_user_id"),
    note: text("note"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    incidentCreatedIdx: index("gateway_analysis_anomaly_incident_history_incident_created_idx").on(
      table.incidentId,
      table.createdAt,
    ),
  }),
);

export const gatewayAnalysisAnomalyRemediationRuns = pgTable(
  "gateway_analysis_anomaly_remediation_runs",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id")
      .notNull()
      .references(() => gatewayAnalysisAnomalyIncidents.id, { onDelete: "cascade" }),
    policyId: text("policy_id").references(() => gatewayAnalysisAnomalyPolicies.id, { onDelete: "set null" }),
    routePolicyId: text("route_policy_id").references(() => gatewayRoutePolicies.id, { onDelete: "set null" }),
    actionKey: text("action_key").notNull(),
    title: text("title").notNull(),
    executionMode: text("execution_mode").notNull(),
    status: text("status").notNull(),
    dryRun: boolean("dry_run").notNull().default(false),
    actorUserId: text("actor_user_id").notNull(),
    note: text("note"),
    input: jsonb("input").$type<Record<string, unknown> | null>(),
    result: jsonb("result").$type<Record<string, unknown> | null>(),
    beforeIncident: jsonb("before_incident").$type<Record<string, unknown> | null>(),
    afterIncident: jsonb("after_incident").$type<Record<string, unknown> | null>(),
    beforeRoutePolicy: jsonb("before_route_policy").$type<Record<string, unknown> | null>(),
    afterRoutePolicy: jsonb("after_route_policy").$type<Record<string, unknown> | null>(),
    errorSummary: text("error_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    incidentCreatedIdx: index("gateway_analysis_anomaly_remediation_runs_incident_created_idx").on(
      table.incidentId,
      table.createdAt,
    ),
    actionStatusIdx: index("gateway_analysis_anomaly_remediation_runs_action_status_idx").on(
      table.actionKey,
      table.status,
      table.createdAt,
    ),
    routePolicyCreatedIdx: index("gateway_analysis_anomaly_remediation_runs_route_policy_created_idx").on(
      table.routePolicyId,
      table.createdAt,
    ),
  }),
);
