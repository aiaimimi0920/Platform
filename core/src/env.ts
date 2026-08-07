import {
  type AgentCallbackRemediationPolicyKey,
  type AgentExecutionCallbackReplayFailureClass,
  type AgentExecutionCallbackReplayCompatibilityPolicyKey,
  type AgentExecutionCallbackReplayFallbackProfileKey,
  type AgentExecutionCallbackRejectionCategory,
  type ArbitrationEvidenceKind,
  type CurrencyKey,
  type AgentExecutionRuntimeProfileKey,
  type AgentExecutionRunKind,
  type ItemFulfillmentAnomalyKind,
  type ItemFulfillmentAnomalySeverity,
  type ItemManualReviewPriority,
  type ItemManualReviewRoutingCode,
  featureModuleKeys,
  type FeatureModuleKey,
  type PlatformExecutionPhase,
} from "@neuro/contracts";

type CoreEnv = {
  port: number;
  databaseUrl: string;
  databaseConnectionTimeoutMs: number;
  databaseQueryTimeoutMs: number;
  redisUrl: string;
  corePublicBaseUrl: string | null;
  internalApiToken: string;
  aiGatewayInternalUrl: string | null;
  aiGatewayManagementToken: string | null;
  gatewayInternalFetchTimeoutMs: number;
  heavyChatGatewayModel: string | null;
  heavyChatGatewayTimeoutMs: number;
  teaServerUrl: string | null;
  teaAuthToken: string | null;
  platformOperatorUserIds: string[];
  outboxProcessingLeaseTimeoutMs: number;
  objectStorageDriver: "local" | "s3-compatible";
  objectStorageLocalDir: string;
  objectStorageBucket: string | null;
  objectStorageRegion: string;
  objectStorageEndpoint: string | null;
  objectStorageAccessKeyId: string | null;
  objectStorageSecretAccessKey: string | null;
  objectStoragePublicBaseUrl: string | null;
  objectStorageForcePathStyle: boolean;
  objectStorageSignedUrlTtlSeconds: number;
  objectStorageFetchTimeoutMs: number;
  externalCallbackMaxSkewSeconds: number;
  externalCallbackSecretGraceSeconds: number;
  externalCallbackProtocolGraceSeconds: number;
  agentMarketplaceRouterApiBaseUrl: string | null;
  agentMarketplaceRouterApiKey: string | null;
  agentMarketplaceRouterModel: string | null;
  arbitrationEvidenceStorageDir: string;
  arbitrationEvidenceStorageMode: "local" | "remote";
  arbitrationEvidenceRemoteProviderKey: string | null;
  arbitrationEvidenceRemoteUploadStrategy: "local_filesystem" | "server_proxy_put" | "prepared_remote_put";
  arbitrationEvidenceRemoteBaseUrl: string | null;
  arbitrationEvidenceRemoteUploadBaseUrl: string | null;
  arbitrationEvidenceRemoteAuthToken: string | null;
  arbitrationEvidenceUploadPlanTtlSeconds: number;
  arbitrationEvidenceMaxBytes: number;
  arbitrationEvidenceAllowedContentTypes: string[];
  arbitrationStaleClaimHours: number;
  arbitrationReviewRoundStaleHours: number;
  arbitrationReviewRoundPolicies: Record<
    string,
    {
      staleHours: number;
      autoAdvanceEnabled: boolean;
      autoAdvanceAfterHours: number | null;
      rebalanceAfterHours: number;
      rebalanceEnabled: boolean;
      claimReleaseHours: number | null;
      evidenceQuietHours: number | null;
      maxRoundNumber: number | null;
      maxOpenRoundsPerOperator: number | null;
      preferCaseAssignee: boolean;
      assigneePool: string[];
    }
  >;
  arbitrationRemoteCleanupDays: number;
  arbitrationRemoteCleanupMaxAttempts: number;
  arbitrationRemoteCleanupBaseBackoffMinutes: number;
  arbitrationEvidenceStoragePolicyKey: string;
  arbitrationEvidenceStorageBucketKey: string | null;
  arbitrationEvidenceStoragePolicies: Record<
    string,
    {
      bucketKey: string | null;
      cleanupMode: "delete_object" | "bucket_lifecycle";
      uploadPlanTtlSeconds: number;
      retentionDays: number;
      cleanupMaxAttempts: number;
      cleanupBaseBackoffMinutes: number;
      evidenceKinds: ArbitrationEvidenceKind[];
    }
  >;
  agentExecutionStaleSeconds: number;
  agentExecutionPhaseTimeouts: Record<PlatformExecutionPhase, number>;
  agentExecutionPhaseCostUnits: Record<PlatformExecutionPhase, number>;
  agentExecutionRunBaseCostUnits: Record<AgentExecutionRunKind, number>;
  agentExecutionArtifactCostUnits: number;
  agentExecutionArtifactResourceMinutes: number;
  agentExecutionBudgetNearLimitThresholdPercent: number;
  agentExecutionMaxAutoRecoveries: number;
  agentExecutionCallbackAutoRemediationMaxAttempts: number;
  agentExecutionCallbackAutoRemediationBaseBackoffSeconds: number;
  agentExecutionCallbackAlertMinLevel: number;
  agentExecutionCallbackAlertCooldownMinutes: number;
  agentExecutionRuntimeAlertMinLevel: number;
  agentExecutionRuntimeAlertCooldownMinutes: number;
  agentCallbackRemediationPolicies: Record<
    AgentCallbackRemediationPolicyKey,
    {
      label: string;
      autoRemediationEnabled: boolean;
      autoReplayStoredPayload: boolean;
      fallbackRetryRequestEnabled: boolean;
      replayCompatibilityPolicyKey: AgentExecutionCallbackReplayCompatibilityPolicyKey;
      allowedReplayPayloadCompatibilities: Array<"current" | "legacy_normalized">;
      allowReplayFromPreviousProtocolWindow: boolean;
      allowReplayFromPreviousSecretWindow: boolean;
      fallbackRetryRequestReplayFailureProfileKey: AgentExecutionCallbackReplayFallbackProfileKey;
      fallbackRetryRequestReplayFailureClasses: AgentExecutionCallbackReplayFailureClass[];
      maxAttempts: number;
      baseBackoffSeconds: number;
      allowedRejectionCategories: AgentExecutionCallbackRejectionCategory[];
      fallbackRetryRequestCategories: AgentExecutionCallbackRejectionCategory[];
      note: string;
    }
  >;
  agentExecutionBillingEnabled: boolean;
  agentExecutionBillingCurrency: CurrencyKey;
  agentExecutionCostUnitsPerCurrency: number;
  agentExecutionRevenueSharePercent: number;
  agentExecutionTreasuryUserId: string;
  agentExecutionPricingPolicies: Record<
    string,
    {
      label: string;
      version: number;
      currency: CurrencyKey;
      costUnitsPerCurrency: number;
      includedCostUnits: number;
      minimumBilledAmount: number;
      maxBilledAmount: number | null;
      allowPartialFinalize: boolean;
      minimumArtifactsBeforePartialFinalize: number;
      revenueSharePercent: number;
      treasuryUserId: string;
    }
  >;
  agentExecutionRevenueContracts: Record<
    string,
    {
      label: string;
      version: number;
      revenueSharePercent: number;
      minimumPayoutAmount: number;
      treasuryUserId: string;
      revenueRecipientMode: "agent_owner" | "platform_only";
    }
  >;
  agentExecutionRuntimeProfileBudgets: Record<
    AgentExecutionRuntimeProfileKey,
    { budgetCostUnits: number | null; budgetResourceMinutes: number | null }
  >;
  agentExecutionRuntimeProfiles: Record<
    AgentExecutionRuntimeProfileKey,
    {
      label: string;
      description: string;
      targetArtifactCount: number;
      artifactsPerAdvance: number;
      nearLimitArtifactsPerAdvanceCap: number;
      maxAutoRecoveryCount: number;
      maxConcurrentExecutions: number | null;
      maxConcurrentExecutionsPerOwner: number | null;
      nearLimitPhaseAdvancesPerRunCap: number;
      nearLimitPreparePassesCap: number;
      nearLimitFinalizePassesCap: number;
      preparePassesRequired: number;
      finalizePassesRequired: number;
      phaseAdvancesPerRun: number;
      budgetCostUnits: number | null;
      budgetResourceMinutes: number | null;
      artifactMode: "single_bundle" | "checklist_progressive";
      runtimePlanVersion: number;
      pricingPolicyKey: string;
      revenueContractKey: string;
    }
  >;
  manualReviewStaleClaimHours: number;
  manualReviewSlaHours: number;
  manualReviewDefaultAssigneeCapacity: number;
  manualReviewAssigneeCapacities: Record<string, number>;
  manualReviewRoutingAssigneePools: Partial<Record<string, string[]>>;
  manualReviewAutoAssignTemplates: Record<
    string,
    { maxAssignments: number; assigneePool: string[]; strategy: "least_loaded" | "priority_first" }
  >;
  manualReviewSlaPolicies: Record<
    string,
    {
      slaHours: number;
      dueSoonLeadHours: number;
      criticalAfterHours: number | null;
      urgentAfterHours: number | null;
      assignAfterHours: number | null;
      rebalanceAfterHours: number | null;
      autoAssignTemplateKey: string | null;
      autoAssignEnabled: boolean;
      maxAutoAssignmentsPerRun: number;
      anomalyPolicyKey: string | null;
      anomalySeverity: ItemFulfillmentAnomalySeverity | null;
      anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
      anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
      anomalyCooldownMinutes: number | null;
      anomalyStages: Array<{
        key: string;
        minAgeHours: number;
        appliesToKinds: ItemFulfillmentAnomalyKind[] | null;
        routingCodes: ItemManualReviewRoutingCode[] | null;
        priorities: ItemManualReviewPriority[] | null;
        severity: ItemFulfillmentAnomalySeverity | null;
        alertLevel: number | null;
        anomalyPolicyKey: string | null;
        anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
        anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
        autoActionTemplateKey: string | null;
        cooldownMinutes: number | null;
      }>;
    }
  >;
  manualReviewAutoRebalanceMaxAssignments: number;
  manualReviewAutoRebalanceIntervalMs: number;
  fulfillmentAnomalyAlertThresholds: Record<ItemFulfillmentAnomalySeverity, number[]>;
  fulfillmentAnomalyPolicyTemplates: Record<
    string,
    {
      thresholds: number[];
      escalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      failureEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      autoAction: "none" | "assign_template" | "rebalance_queue";
      autoActionTemplateKey: string | null;
      cooldownMinutes: number;
      maxAlertLevel: number;
      maxAutoActionFailures: number;
      anomalyStages: Array<{
        key: string;
        minAgeHours: number;
        appliesToKinds: ItemFulfillmentAnomalyKind[] | null;
        routingCodes: ItemManualReviewRoutingCode[] | null;
        severity: ItemFulfillmentAnomalySeverity | null;
        alertLevel: number | null;
        anomalyPolicyKey: string | null;
        anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
        anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
        autoActionTemplateKey: string | null;
        cooldownMinutes: number | null;
      }>;
    }
  >;
  featureDefaults: Record<FeatureModuleKey, { enabled: boolean; rolloutNote: string | null }>;
  obsidianToMiraRate: number;
};

function parsePhaseTimeouts(raw: string | undefined, fallbackStaleSeconds: number): Record<PlatformExecutionPhase, number> {
  const defaults: Record<PlatformExecutionPhase, number> = {
    queued: fallbackStaleSeconds,
    prepare: Math.max(fallbackStaleSeconds, 600),
    produce_artifact: Math.max(fallbackStaleSeconds, 1800),
    finalize: Math.max(fallbackStaleSeconds, 900),
    done: fallbackStaleSeconds,
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<Record<PlatformExecutionPhase, number>>;
    for (const phase of Object.keys(defaults) as PlatformExecutionPhase[]) {
      const value = parsed[phase];
      if (typeof value === "number" && Number.isFinite(value) && value >= 60) {
        defaults[phase] = Math.floor(value);
      }
    }
  } catch (error) {
    throw new Error(`Invalid AGENT_EXECUTION_PHASE_TIMEOUTS_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parsePhaseCostUnits(raw: string | undefined): Record<PlatformExecutionPhase, number> {
  const defaults: Record<PlatformExecutionPhase, number> = {
    queued: 1,
    prepare: 4,
    produce_artifact: 8,
    finalize: 3,
    done: 1,
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<Record<PlatformExecutionPhase, number>>;
    for (const phase of Object.keys(defaults) as PlatformExecutionPhase[]) {
      const value = parsed[phase];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        defaults[phase] = Math.floor(value);
      }
    }
  } catch (error) {
    throw new Error(`Invalid AGENT_EXECUTION_PHASE_COST_UNITS_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseRunBaseCostUnits(raw: string | undefined): Record<AgentExecutionRunKind, number> {
  const defaults: Record<AgentExecutionRunKind, number> = {
    platform_executor: 5,
    requeue: 1,
    recovery: 2,
    callback_retry_request: 1,
    callback_payload_replay: 2,
    callback_auto_remediation: 1,
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<Record<AgentExecutionRunKind, number>>;
    for (const runKind of Object.keys(defaults) as AgentExecutionRunKind[]) {
      const value = parsed[runKind];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        defaults[runKind] = Math.floor(value);
      }
    }
  } catch (error) {
    throw new Error(`Invalid AGENT_EXECUTION_RUN_BASE_COST_UNITS_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseRuntimeProfileBudgets(raw: string | undefined) {
  const defaults: Record<
    AgentExecutionRuntimeProfileKey,
    { budgetCostUnits: number | null; budgetResourceMinutes: number | null }
  > = {
    baseline: { budgetCostUnits: 24, budgetResourceMinutes: 10 },
    iterative: { budgetCostUnits: 48, budgetResourceMinutes: 20 },
    deep_runtime: { budgetCostUnits: 96, budgetResourceMinutes: 40 },
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<AgentExecutionRuntimeProfileKey, { budgetCostUnits?: unknown; budgetResourceMinutes?: unknown }>
    >;
    for (const profileKey of Object.keys(defaults) as AgentExecutionRuntimeProfileKey[]) {
      const value = parsed[profileKey];
      if (!value) continue;
      const budgetCostUnits =
        typeof value.budgetCostUnits === "number" && Number.isFinite(value.budgetCostUnits) && value.budgetCostUnits >= 0
          ? Math.floor(value.budgetCostUnits)
          : defaults[profileKey].budgetCostUnits;
      const budgetResourceMinutes =
        typeof value.budgetResourceMinutes === "number" &&
        Number.isFinite(value.budgetResourceMinutes) &&
        value.budgetResourceMinutes >= 0
          ? Math.floor(value.budgetResourceMinutes)
          : defaults[profileKey].budgetResourceMinutes;
      defaults[profileKey] = {
        budgetCostUnits,
        budgetResourceMinutes,
      };
    }
  } catch (error) {
    throw new Error(`Invalid AGENT_EXECUTION_RUNTIME_PROFILE_BUDGETS_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseExecutionRuntimeProfiles(args: {
  raw: string | undefined;
  maxAutoRecoveries: number;
  budgets: Record<AgentExecutionRuntimeProfileKey, { budgetCostUnits: number | null; budgetResourceMinutes: number | null }>;
  pricingPolicies: Record<
    string,
    {
      label: string;
      version: number;
      currency: CurrencyKey;
      costUnitsPerCurrency: number;
      revenueSharePercent: number;
      treasuryUserId: string;
    }
  >;
  revenueContracts: Record<
    string,
    {
      label: string;
      version: number;
      revenueSharePercent: number;
      treasuryUserId: string;
      revenueRecipientMode: "agent_owner" | "platform_only";
    }
  >;
}) {
  const resolvePricingPolicyKey = (candidate: string | null | undefined, fallbackKey: string) => {
    if (candidate && args.pricingPolicies[candidate]) return candidate;
    if (args.pricingPolicies[fallbackKey]) return fallbackKey;
    if (args.pricingPolicies.default) return "default";
    return Object.keys(args.pricingPolicies)[0] ?? "default";
  };

  const resolveRevenueContractKey = (candidate: string | null | undefined, fallbackKey: string) => {
    if (candidate && args.revenueContracts[candidate]) return candidate;
    if (args.revenueContracts[fallbackKey]) return fallbackKey;
    if (args.revenueContracts.default) return "default";
    return Object.keys(args.revenueContracts)[0] ?? "default";
  };

  const defaults: Record<
    AgentExecutionRuntimeProfileKey,
    {
      label: string;
      description: string;
      targetArtifactCount: number;
      artifactsPerAdvance: number;
      nearLimitArtifactsPerAdvanceCap: number;
      maxAutoRecoveryCount: number;
      maxConcurrentExecutions: number | null;
      maxConcurrentExecutionsPerOwner: number | null;
      nearLimitPhaseAdvancesPerRunCap: number;
      nearLimitPreparePassesCap: number;
      nearLimitFinalizePassesCap: number;
      preparePassesRequired: number;
      finalizePassesRequired: number;
      phaseAdvancesPerRun: number;
      budgetCostUnits: number | null;
      budgetResourceMinutes: number | null;
      artifactMode: "single_bundle" | "checklist_progressive";
      runtimePlanVersion: number;
      pricingPolicyKey: string;
      revenueContractKey: string;
    }
  > = {
      baseline: {
        label: "Baseline",
        description: "单轮产物生成，适合作为最小执行基线。",
        targetArtifactCount: 1,
        artifactsPerAdvance: 1,
        nearLimitArtifactsPerAdvanceCap: 1,
        maxAutoRecoveryCount: Math.max(1, args.maxAutoRecoveries),
      maxConcurrentExecutions: 4,
      maxConcurrentExecutionsPerOwner: 2,
      nearLimitPhaseAdvancesPerRunCap: 1,
      nearLimitPreparePassesCap: 1,
      nearLimitFinalizePassesCap: 1,
      preparePassesRequired: 1,
      finalizePassesRequired: 1,
        phaseAdvancesPerRun: 1,
      budgetCostUnits: args.budgets.baseline.budgetCostUnits,
      budgetResourceMinutes: args.budgets.baseline.budgetResourceMinutes,
      artifactMode: "single_bundle",
      runtimePlanVersion: 1,
      pricingPolicyKey: resolvePricingPolicyKey("baseline", "baseline"),
      revenueContractKey: resolveRevenueContractKey("baseline", "baseline"),
    },
      iterative: {
        label: "Iterative",
        description: "多轮产物迭代，适合需要逐步沉淀结果的执行。",
        targetArtifactCount: 2,
        artifactsPerAdvance: 1,
        nearLimitArtifactsPerAdvanceCap: 1,
        maxAutoRecoveryCount: Math.max(2, args.maxAutoRecoveries),
      maxConcurrentExecutions: 2,
      maxConcurrentExecutionsPerOwner: 1,
      nearLimitPhaseAdvancesPerRunCap: 1,
      nearLimitPreparePassesCap: 1,
      nearLimitFinalizePassesCap: 1,
      preparePassesRequired: 2,
      finalizePassesRequired: 1,
        phaseAdvancesPerRun: 2,
      budgetCostUnits: args.budgets.iterative.budgetCostUnits,
      budgetResourceMinutes: args.budgets.iterative.budgetResourceMinutes,
      artifactMode: "checklist_progressive",
      runtimePlanVersion: 1,
      pricingPolicyKey: resolvePricingPolicyKey("iterative", "iterative"),
      revenueContractKey: resolveRevenueContractKey("iterative", "iterative"),
    },
      deep_runtime: {
        label: "Deep Runtime",
        description: "更深的产物迭代和更高自动恢复预算，适合复杂目标。",
        targetArtifactCount: 3,
        artifactsPerAdvance: 2,
        nearLimitArtifactsPerAdvanceCap: 1,
        maxAutoRecoveryCount: Math.max(3, args.maxAutoRecoveries + 1),
      maxConcurrentExecutions: 1,
      maxConcurrentExecutionsPerOwner: 1,
      nearLimitPhaseAdvancesPerRunCap: 2,
      nearLimitPreparePassesCap: 1,
      nearLimitFinalizePassesCap: 1,
      preparePassesRequired: 2,
      finalizePassesRequired: 2,
        phaseAdvancesPerRun: 3,
      budgetCostUnits: args.budgets.deep_runtime.budgetCostUnits,
      budgetResourceMinutes: args.budgets.deep_runtime.budgetResourceMinutes,
      artifactMode: "checklist_progressive",
      runtimePlanVersion: 2,
      pricingPolicyKey: resolvePricingPolicyKey("deep_runtime", "deep_runtime"),
      revenueContractKey: resolveRevenueContractKey("deep_runtime", "deep_runtime"),
    },
  };

  if (!args.raw) return defaults;

  try {
    const parsed = JSON.parse(args.raw) as Partial<
      Record<
        AgentExecutionRuntimeProfileKey,
        {
          label?: unknown;
          description?: unknown;
          targetArtifactCount?: unknown;
          artifactsPerAdvance?: unknown;
          nearLimitArtifactsPerAdvanceCap?: unknown;
          maxAutoRecoveryCount?: unknown;
          maxConcurrentExecutions?: unknown;
          maxConcurrentExecutionsPerOwner?: unknown;
          nearLimitPhaseAdvancesPerRunCap?: unknown;
          nearLimitPreparePassesCap?: unknown;
          nearLimitFinalizePassesCap?: unknown;
          preparePassesRequired?: unknown;
          finalizePassesRequired?: unknown;
          phaseAdvancesPerRun?: unknown;
          budgetCostUnits?: unknown;
          budgetResourceMinutes?: unknown;
          artifactMode?: unknown;
          runtimePlanVersion?: unknown;
          pricingPolicyKey?: unknown;
          revenueContractKey?: unknown;
        }
      >
    >;
    for (const profileKey of Object.keys(defaults) as AgentExecutionRuntimeProfileKey[]) {
      const value = parsed[profileKey];
      if (!value || typeof value !== "object") continue;
      defaults[profileKey] = {
        label:
          typeof value.label === "string" && value.label.trim().length > 0
            ? value.label.trim()
            : defaults[profileKey].label,
        description:
          typeof value.description === "string" && value.description.trim().length > 0
            ? value.description.trim()
            : defaults[profileKey].description,
        targetArtifactCount:
          typeof value.targetArtifactCount === "number" &&
          Number.isFinite(value.targetArtifactCount) &&
          value.targetArtifactCount > 0
            ? Math.floor(value.targetArtifactCount)
            : defaults[profileKey].targetArtifactCount,
        artifactsPerAdvance:
          typeof value.artifactsPerAdvance === "number" &&
          Number.isFinite(value.artifactsPerAdvance) &&
          value.artifactsPerAdvance > 0
            ? Math.floor(value.artifactsPerAdvance)
            : defaults[profileKey].artifactsPerAdvance,
        nearLimitArtifactsPerAdvanceCap:
          typeof value.nearLimitArtifactsPerAdvanceCap === "number" &&
          Number.isFinite(value.nearLimitArtifactsPerAdvanceCap) &&
          value.nearLimitArtifactsPerAdvanceCap >= 1
            ? Math.floor(value.nearLimitArtifactsPerAdvanceCap)
            : defaults[profileKey].nearLimitArtifactsPerAdvanceCap,
        maxAutoRecoveryCount:
          typeof value.maxAutoRecoveryCount === "number" &&
          Number.isFinite(value.maxAutoRecoveryCount) &&
          value.maxAutoRecoveryCount > 0
            ? Math.floor(value.maxAutoRecoveryCount)
            : defaults[profileKey].maxAutoRecoveryCount,
        maxConcurrentExecutions:
          typeof value.maxConcurrentExecutions === "number" &&
          Number.isFinite(value.maxConcurrentExecutions) &&
          value.maxConcurrentExecutions >= 1
            ? Math.floor(value.maxConcurrentExecutions)
            : value.maxConcurrentExecutions === null
              ? null
              : defaults[profileKey].maxConcurrentExecutions,
        maxConcurrentExecutionsPerOwner:
          typeof value.maxConcurrentExecutionsPerOwner === "number" &&
          Number.isFinite(value.maxConcurrentExecutionsPerOwner) &&
          value.maxConcurrentExecutionsPerOwner >= 1
            ? Math.floor(value.maxConcurrentExecutionsPerOwner)
            : value.maxConcurrentExecutionsPerOwner === null
              ? null
              : defaults[profileKey].maxConcurrentExecutionsPerOwner,
        nearLimitPhaseAdvancesPerRunCap:
          typeof value.nearLimitPhaseAdvancesPerRunCap === "number" &&
          Number.isFinite(value.nearLimitPhaseAdvancesPerRunCap) &&
          value.nearLimitPhaseAdvancesPerRunCap >= 1
            ? Math.floor(value.nearLimitPhaseAdvancesPerRunCap)
            : defaults[profileKey].nearLimitPhaseAdvancesPerRunCap,
        nearLimitPreparePassesCap:
          typeof value.nearLimitPreparePassesCap === "number" &&
          Number.isFinite(value.nearLimitPreparePassesCap) &&
          value.nearLimitPreparePassesCap >= 1
            ? Math.floor(value.nearLimitPreparePassesCap)
            : defaults[profileKey].nearLimitPreparePassesCap,
        nearLimitFinalizePassesCap:
          typeof value.nearLimitFinalizePassesCap === "number" &&
          Number.isFinite(value.nearLimitFinalizePassesCap) &&
          value.nearLimitFinalizePassesCap >= 1
            ? Math.floor(value.nearLimitFinalizePassesCap)
            : defaults[profileKey].nearLimitFinalizePassesCap,
        preparePassesRequired:
          typeof value.preparePassesRequired === "number" &&
          Number.isFinite(value.preparePassesRequired) &&
          value.preparePassesRequired >= 1
            ? Math.floor(value.preparePassesRequired)
            : defaults[profileKey].preparePassesRequired,
        finalizePassesRequired:
          typeof value.finalizePassesRequired === "number" &&
          Number.isFinite(value.finalizePassesRequired) &&
          value.finalizePassesRequired >= 1
            ? Math.floor(value.finalizePassesRequired)
            : defaults[profileKey].finalizePassesRequired,
        phaseAdvancesPerRun:
          typeof value.phaseAdvancesPerRun === "number" &&
          Number.isFinite(value.phaseAdvancesPerRun) &&
          value.phaseAdvancesPerRun >= 1
            ? Math.floor(value.phaseAdvancesPerRun)
            : defaults[profileKey].phaseAdvancesPerRun,
        budgetCostUnits:
          typeof value.budgetCostUnits === "number" && Number.isFinite(value.budgetCostUnits) && value.budgetCostUnits >= 0
            ? Math.floor(value.budgetCostUnits)
            : defaults[profileKey].budgetCostUnits,
        budgetResourceMinutes:
          typeof value.budgetResourceMinutes === "number" &&
          Number.isFinite(value.budgetResourceMinutes) &&
          value.budgetResourceMinutes >= 0
            ? Math.floor(value.budgetResourceMinutes)
            : defaults[profileKey].budgetResourceMinutes,
        artifactMode:
          value.artifactMode === "single_bundle" || value.artifactMode === "checklist_progressive"
            ? value.artifactMode
            : defaults[profileKey].artifactMode,
        runtimePlanVersion:
          typeof value.runtimePlanVersion === "number" &&
          Number.isFinite(value.runtimePlanVersion) &&
          value.runtimePlanVersion > 0
            ? Math.floor(value.runtimePlanVersion)
            : defaults[profileKey].runtimePlanVersion,
        pricingPolicyKey: resolvePricingPolicyKey(
          typeof value.pricingPolicyKey === "string" ? value.pricingPolicyKey.trim() : null,
          defaults[profileKey].pricingPolicyKey,
        ),
        revenueContractKey: resolveRevenueContractKey(
          typeof value.revenueContractKey === "string" ? value.revenueContractKey.trim() : null,
          defaults[profileKey].revenueContractKey,
        ),
      };
    }
  } catch (error) {
    throw new Error(`Invalid AGENT_EXECUTION_RUNTIME_PROFILES_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseExecutionPricingPolicies(args: {
  raw: string | undefined;
  defaultCurrency: CurrencyKey;
  defaultCostUnitsPerCurrency: number;
  defaultRevenueSharePercent: number;
  defaultTreasuryUserId: string;
}) {
  const defaults: Record<
    string,
    {
      label: string;
      version: number;
      currency: CurrencyKey;
      costUnitsPerCurrency: number;
      includedCostUnits: number;
        minimumBilledAmount: number;
        maxBilledAmount: number | null;
        allowPartialFinalize: boolean;
        minimumArtifactsBeforePartialFinalize: number;
        revenueSharePercent: number;
        treasuryUserId: string;
    }
  > = {
    baseline: {
      label: "Baseline pricing",
      version: 1,
      currency: args.defaultCurrency,
      costUnitsPerCurrency: args.defaultCostUnitsPerCurrency,
      includedCostUnits: 0,
        minimumBilledAmount: 0,
        maxBilledAmount: null,
        allowPartialFinalize: true,
        minimumArtifactsBeforePartialFinalize: 1,
        revenueSharePercent: args.defaultRevenueSharePercent,
        treasuryUserId: args.defaultTreasuryUserId,
    },
    iterative: {
      label: "Iterative pricing",
      version: 1,
      currency: args.defaultCurrency,
      costUnitsPerCurrency: Math.max(1, args.defaultCostUnitsPerCurrency),
      includedCostUnits: 2,
        minimumBilledAmount: 1,
        maxBilledAmount: null,
        allowPartialFinalize: true,
        minimumArtifactsBeforePartialFinalize: 1,
        revenueSharePercent: args.defaultRevenueSharePercent,
        treasuryUserId: args.defaultTreasuryUserId,
    },
    deep_runtime: {
      label: "Deep runtime pricing",
      version: 1,
      currency: args.defaultCurrency,
      costUnitsPerCurrency: Math.max(1, args.defaultCostUnitsPerCurrency),
      includedCostUnits: 4,
        minimumBilledAmount: 2,
        maxBilledAmount: 24,
        allowPartialFinalize: true,
        minimumArtifactsBeforePartialFinalize: 2,
        revenueSharePercent: args.defaultRevenueSharePercent,
        treasuryUserId: args.defaultTreasuryUserId,
    },
    default: {
      label: "Default pricing",
      version: 1,
      currency: args.defaultCurrency,
      costUnitsPerCurrency: args.defaultCostUnitsPerCurrency,
      includedCostUnits: 0,
        minimumBilledAmount: 0,
        maxBilledAmount: null,
        allowPartialFinalize: true,
        minimumArtifactsBeforePartialFinalize: 1,
        revenueSharePercent: args.defaultRevenueSharePercent,
        treasuryUserId: args.defaultTreasuryUserId,
    },
  };

  if (!args.raw) return defaults;

  try {
    const parsed = JSON.parse(args.raw) as Record<
      string,
      {
        label?: unknown;
        version?: unknown;
        currency?: unknown;
        costUnitsPerCurrency?: unknown;
        includedCostUnits?: unknown;
          minimumBilledAmount?: unknown;
          maxBilledAmount?: unknown;
          allowPartialFinalize?: unknown;
          minimumArtifactsBeforePartialFinalize?: unknown;
          revenueSharePercent?: unknown;
          treasuryUserId?: unknown;
      }
    >;
    for (const [key, value] of Object.entries(parsed)) {
      const pricingKey = key.trim();
      if (!pricingKey || !value || typeof value !== "object") continue;
      const currency =
        value.currency === "mira"
          ? "mira"
          : value.currency === "opinionTickets"
            ? "opinionTickets"
            : value.currency === "obsidian"
              ? "obsidian"
              : defaults[pricingKey]?.currency ?? args.defaultCurrency;
      const costUnitsPerCurrency =
        typeof value.costUnitsPerCurrency === "number" &&
        Number.isFinite(value.costUnitsPerCurrency) &&
        value.costUnitsPerCurrency > 0
          ? Math.floor(value.costUnitsPerCurrency)
          : defaults[pricingKey]?.costUnitsPerCurrency ?? args.defaultCostUnitsPerCurrency;
      const revenueSharePercent =
        typeof value.revenueSharePercent === "number" &&
        Number.isFinite(value.revenueSharePercent) &&
        value.revenueSharePercent >= 0
          ? Math.max(0, Math.min(100, Math.floor(value.revenueSharePercent)))
          : defaults[pricingKey]?.revenueSharePercent ?? args.defaultRevenueSharePercent;
      const includedCostUnits =
        typeof value.includedCostUnits === "number" &&
        Number.isFinite(value.includedCostUnits) &&
        value.includedCostUnits >= 0
          ? Math.floor(value.includedCostUnits)
          : defaults[pricingKey]?.includedCostUnits ?? 0;
      const minimumBilledAmount =
        typeof value.minimumBilledAmount === "number" &&
        Number.isFinite(value.minimumBilledAmount) &&
        value.minimumBilledAmount >= 0
          ? Math.floor(value.minimumBilledAmount)
          : defaults[pricingKey]?.minimumBilledAmount ?? 0;
      const maxBilledAmount =
        typeof value.maxBilledAmount === "number" &&
        Number.isFinite(value.maxBilledAmount) &&
        value.maxBilledAmount >= 0
          ? Math.floor(value.maxBilledAmount)
          : value.maxBilledAmount === null
            ? null
            : defaults[pricingKey]?.maxBilledAmount ?? null;
      const version =
        typeof value.version === "number" && Number.isFinite(value.version) && value.version > 0
          ? Math.floor(value.version)
          : defaults[pricingKey]?.version ?? 1;
      const treasuryUserId =
        typeof value.treasuryUserId === "string" && value.treasuryUserId.trim().length > 0
          ? value.treasuryUserId.trim()
          : defaults[pricingKey]?.treasuryUserId ?? args.defaultTreasuryUserId;
        defaults[pricingKey] = {
        label:
          typeof value.label === "string" && value.label.trim().length > 0
            ? value.label.trim()
            : defaults[pricingKey]?.label ?? pricingKey,
        version,
        currency,
        costUnitsPerCurrency,
        includedCostUnits,
        minimumBilledAmount,
        maxBilledAmount,
          allowPartialFinalize:
            typeof value.allowPartialFinalize === "boolean"
              ? value.allowPartialFinalize
              : defaults[pricingKey]?.allowPartialFinalize ?? true,
          minimumArtifactsBeforePartialFinalize:
            typeof value.minimumArtifactsBeforePartialFinalize === "number" &&
            Number.isFinite(value.minimumArtifactsBeforePartialFinalize) &&
            value.minimumArtifactsBeforePartialFinalize >= 1
              ? Math.floor(value.minimumArtifactsBeforePartialFinalize)
              : defaults[pricingKey]?.minimumArtifactsBeforePartialFinalize ??
                defaults.default.minimumArtifactsBeforePartialFinalize,
          revenueSharePercent,
          treasuryUserId,
      };
    }
  } catch (error) {
    throw new Error(`Invalid AGENT_EXECUTION_PRICING_POLICIES_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseExecutionRevenueContracts(args: {
  raw: string | undefined;
  defaultRevenueSharePercent: number;
  defaultTreasuryUserId: string;
}) {
  const defaults: Record<
    string,
    {
      label: string;
      version: number;
      revenueSharePercent: number;
      minimumPayoutAmount: number;
      treasuryUserId: string;
      revenueRecipientMode: "agent_owner" | "platform_only";
    }
  > = {
    baseline: {
      label: "Baseline revenue",
      version: 1,
      revenueSharePercent: args.defaultRevenueSharePercent,
      minimumPayoutAmount: 0,
      treasuryUserId: args.defaultTreasuryUserId,
      revenueRecipientMode: "agent_owner",
    },
    iterative: {
      label: "Iterative revenue",
      version: 1,
      revenueSharePercent: args.defaultRevenueSharePercent,
      minimumPayoutAmount: 1,
      treasuryUserId: args.defaultTreasuryUserId,
      revenueRecipientMode: "agent_owner",
    },
    deep_runtime: {
      label: "Deep runtime revenue",
      version: 1,
      revenueSharePercent: args.defaultRevenueSharePercent,
      minimumPayoutAmount: 2,
      treasuryUserId: args.defaultTreasuryUserId,
      revenueRecipientMode: "agent_owner",
    },
    default: {
      label: "Default revenue",
      version: 1,
      revenueSharePercent: args.defaultRevenueSharePercent,
      minimumPayoutAmount: 0,
      treasuryUserId: args.defaultTreasuryUserId,
      revenueRecipientMode: "agent_owner",
    },
  };

  if (!args.raw) return defaults;

  try {
    const parsed = JSON.parse(args.raw) as Record<
      string,
      {
        label?: unknown;
        version?: unknown;
        revenueSharePercent?: unknown;
        minimumPayoutAmount?: unknown;
        treasuryUserId?: unknown;
        revenueRecipientMode?: unknown;
      }
    >;
    for (const [key, value] of Object.entries(parsed)) {
      const contractKey = key.trim();
      if (!contractKey || !value || typeof value !== "object") continue;
      defaults[contractKey] = {
        label:
          typeof value.label === "string" && value.label.trim().length > 0
            ? value.label.trim()
            : defaults[contractKey]?.label ?? contractKey,
        version:
          typeof value.version === "number" && Number.isFinite(value.version) && value.version > 0
            ? Math.floor(value.version)
            : defaults[contractKey]?.version ?? 1,
        revenueSharePercent:
          typeof value.revenueSharePercent === "number" &&
          Number.isFinite(value.revenueSharePercent) &&
          value.revenueSharePercent >= 0
            ? Math.max(0, Math.min(100, Math.floor(value.revenueSharePercent)))
            : defaults[contractKey]?.revenueSharePercent ?? args.defaultRevenueSharePercent,
        minimumPayoutAmount:
          typeof value.minimumPayoutAmount === "number" &&
          Number.isFinite(value.minimumPayoutAmount) &&
          value.minimumPayoutAmount >= 0
            ? Math.floor(value.minimumPayoutAmount)
            : defaults[contractKey]?.minimumPayoutAmount ?? 0,
        treasuryUserId:
          typeof value.treasuryUserId === "string" && value.treasuryUserId.trim().length > 0
            ? value.treasuryUserId.trim()
            : defaults[contractKey]?.treasuryUserId ?? args.defaultTreasuryUserId,
        revenueRecipientMode:
          value.revenueRecipientMode === "platform_only"
            ? "platform_only"
            : defaults[contractKey]?.revenueRecipientMode ?? "agent_owner",
      };
    }
  } catch (error) {
    throw new Error(`Invalid AGENT_EXECUTION_REVENUE_CONTRACTS_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseArbitrationEvidenceStoragePolicies(args: {
  raw: string | undefined;
  defaultPolicyKey: string;
  defaultBucketKey: string | null;
  defaultUploadPlanTtlSeconds: number;
  defaultRetentionDays: number;
  defaultCleanupMaxAttempts: number;
  defaultCleanupBaseBackoffMinutes: number;
}) {
  const defaultPolicy = {
    bucketKey: args.defaultBucketKey,
    cleanupMode: "delete_object" as const,
    uploadPlanTtlSeconds: args.defaultUploadPlanTtlSeconds,
    retentionDays: args.defaultRetentionDays,
    cleanupMaxAttempts: args.defaultCleanupMaxAttempts,
    cleanupBaseBackoffMinutes: args.defaultCleanupBaseBackoffMinutes,
    evidenceKinds: [] as ArbitrationEvidenceKind[],
  };
  const defaults: Record<
    string,
    {
      bucketKey: string | null;
      cleanupMode: "delete_object" | "bucket_lifecycle";
      uploadPlanTtlSeconds: number;
      retentionDays: number;
      cleanupMaxAttempts: number;
      cleanupBaseBackoffMinutes: number;
      evidenceKinds: ArbitrationEvidenceKind[];
    }
  > = {
    [args.defaultPolicyKey]: defaultPolicy,
    default: defaultPolicy,
  };

  if (!args.raw) return defaults;

  try {
    const parsed = JSON.parse(args.raw) as Record<
      string,
      {
        bucketKey?: unknown;
        cleanupMode?: unknown;
        uploadPlanTtlSeconds?: unknown;
        retentionDays?: unknown;
        cleanupMaxAttempts?: unknown;
        cleanupBaseBackoffMinutes?: unknown;
        evidenceKinds?: unknown;
      }
    >;
    for (const [key, value] of Object.entries(parsed)) {
      const policyKey = key.trim();
      if (!policyKey || !value || typeof value !== "object") continue;
      const evidenceKinds = Array.isArray(value.evidenceKinds)
        ? value.evidenceKinds.filter(
            (kind): kind is ArbitrationEvidenceKind =>
              kind === "text_note" || kind === "external_link" || kind === "log_excerpt" || kind === "screenshot_ref",
          )
        : defaults[policyKey]?.evidenceKinds ?? [];
      defaults[policyKey] = {
        bucketKey:
          typeof value.bucketKey === "string" && value.bucketKey.trim().length > 0
            ? value.bucketKey.trim()
            : defaults[policyKey]?.bucketKey ?? args.defaultBucketKey,
        cleanupMode:
          value.cleanupMode === "bucket_lifecycle"
            ? "bucket_lifecycle"
            : defaults[policyKey]?.cleanupMode ?? defaultPolicy.cleanupMode,
        uploadPlanTtlSeconds:
          typeof value.uploadPlanTtlSeconds === "number" &&
          Number.isFinite(value.uploadPlanTtlSeconds) &&
          value.uploadPlanTtlSeconds >= 60
            ? Math.floor(value.uploadPlanTtlSeconds)
            : defaults[policyKey]?.uploadPlanTtlSeconds ?? args.defaultUploadPlanTtlSeconds,
        retentionDays:
          typeof value.retentionDays === "number" && Number.isFinite(value.retentionDays) && value.retentionDays >= 1
            ? Math.floor(value.retentionDays)
            : defaults[policyKey]?.retentionDays ?? args.defaultRetentionDays,
        cleanupMaxAttempts:
          typeof value.cleanupMaxAttempts === "number" &&
          Number.isFinite(value.cleanupMaxAttempts) &&
          value.cleanupMaxAttempts >= 1
            ? Math.floor(value.cleanupMaxAttempts)
            : defaults[policyKey]?.cleanupMaxAttempts ?? args.defaultCleanupMaxAttempts,
        cleanupBaseBackoffMinutes:
          typeof value.cleanupBaseBackoffMinutes === "number" &&
          Number.isFinite(value.cleanupBaseBackoffMinutes) &&
          value.cleanupBaseBackoffMinutes >= 1
            ? Math.floor(value.cleanupBaseBackoffMinutes)
            : defaults[policyKey]?.cleanupBaseBackoffMinutes ?? args.defaultCleanupBaseBackoffMinutes,
        evidenceKinds,
      };
    }
  } catch (error) {
    throw new Error(`Invalid ARBITRATION_EVIDENCE_STORAGE_POLICIES_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseArbitrationReviewRoundPolicies(
  raw: string | undefined,
  fallbackStaleHours: number,
  fallbackClaimReleaseHours: number,
) {
  const defaultAssigneePool = (process.env.PLATFORM_OPERATOR_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const defaults: CoreEnv["arbitrationReviewRoundPolicies"] = {
    default: {
      staleHours: fallbackStaleHours,
      autoAdvanceEnabled: true,
      autoAdvanceAfterHours: fallbackStaleHours,
      rebalanceAfterHours: fallbackStaleHours,
      rebalanceEnabled: true,
      claimReleaseHours: fallbackClaimReleaseHours,
      evidenceQuietHours: Math.max(1, Math.min(12, Math.floor(fallbackStaleHours / 4))),
      maxRoundNumber: null,
      maxOpenRoundsPerOperator: null,
      preferCaseAssignee: true,
      assigneePool: defaultAssigneePool,
    },
    "round:1": {
      staleHours: fallbackStaleHours,
      autoAdvanceEnabled: true,
      autoAdvanceAfterHours: fallbackStaleHours,
      rebalanceAfterHours: fallbackStaleHours,
      rebalanceEnabled: true,
      claimReleaseHours: fallbackClaimReleaseHours,
      evidenceQuietHours: Math.max(1, Math.min(12, Math.floor(fallbackStaleHours / 4))),
      maxRoundNumber: null,
      maxOpenRoundsPerOperator: null,
      preferCaseAssignee: true,
      assigneePool: defaultAssigneePool,
    },
    "round:2": {
      staleHours: Math.max(1, fallbackStaleHours - 6),
      autoAdvanceEnabled: true,
      autoAdvanceAfterHours: Math.max(1, fallbackStaleHours - 6),
      rebalanceAfterHours: Math.max(1, fallbackStaleHours - 12),
      rebalanceEnabled: true,
      claimReleaseHours: Math.max(1, fallbackClaimReleaseHours - 6),
      evidenceQuietHours: Math.max(1, Math.min(8, Math.floor(Math.max(1, fallbackStaleHours - 6) / 4))),
      maxRoundNumber: null,
      maxOpenRoundsPerOperator: 4,
      preferCaseAssignee: true,
      assigneePool: defaultAssigneePool,
    },
    "round:3": {
      staleHours: Math.max(1, fallbackStaleHours - 12),
      autoAdvanceEnabled: true,
      autoAdvanceAfterHours: Math.max(1, fallbackStaleHours - 12),
      rebalanceAfterHours: Math.max(1, fallbackStaleHours - 18),
      rebalanceEnabled: true,
      claimReleaseHours: Math.max(1, fallbackClaimReleaseHours - 12),
      evidenceQuietHours: Math.max(1, Math.min(6, Math.floor(Math.max(1, fallbackStaleHours - 12) / 4))),
      maxRoundNumber: null,
      maxOpenRoundsPerOperator: 3,
      preferCaseAssignee: false,
      assigneePool: defaultAssigneePool,
    },
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        staleHours?: unknown;
        autoAdvanceEnabled?: unknown;
        autoAdvanceAfterHours?: unknown;
        rebalanceAfterHours?: unknown;
        rebalanceEnabled?: unknown;
        claimReleaseHours?: unknown;
        evidenceQuietHours?: unknown;
        maxRoundNumber?: unknown;
        maxOpenRoundsPerOperator?: unknown;
        preferCaseAssignee?: unknown;
        assigneePool?: unknown;
      }
    >;
    for (const [key, value] of Object.entries(parsed)) {
      const policyKey = key.trim();
      if (!policyKey || !value || typeof value !== "object") continue;
      defaults[policyKey] = {
        staleHours:
          typeof value.staleHours === "number" && Number.isFinite(value.staleHours) && value.staleHours >= 1
            ? Math.floor(value.staleHours)
            : defaults[policyKey]?.staleHours ?? defaults.default.staleHours,
        autoAdvanceEnabled:
          typeof value.autoAdvanceEnabled === "boolean"
            ? value.autoAdvanceEnabled
            : defaults[policyKey]?.autoAdvanceEnabled ?? defaults.default.autoAdvanceEnabled,
        autoAdvanceAfterHours:
          typeof value.autoAdvanceAfterHours === "number" &&
          Number.isFinite(value.autoAdvanceAfterHours) &&
          value.autoAdvanceAfterHours >= 1
            ? Math.floor(value.autoAdvanceAfterHours)
            : value.autoAdvanceAfterHours === null
              ? null
              : defaults[policyKey]?.autoAdvanceAfterHours ?? defaults.default.autoAdvanceAfterHours,
        rebalanceAfterHours:
          typeof value.rebalanceAfterHours === "number" &&
          Number.isFinite(value.rebalanceAfterHours) &&
          value.rebalanceAfterHours >= 1
            ? Math.floor(value.rebalanceAfterHours)
            : defaults[policyKey]?.rebalanceAfterHours ?? defaults.default.rebalanceAfterHours,
        rebalanceEnabled:
          typeof value.rebalanceEnabled === "boolean"
            ? value.rebalanceEnabled
            : defaults[policyKey]?.rebalanceEnabled ?? defaults.default.rebalanceEnabled,
        claimReleaseHours:
          typeof value.claimReleaseHours === "number" &&
          Number.isFinite(value.claimReleaseHours) &&
          value.claimReleaseHours >= 1
            ? Math.floor(value.claimReleaseHours)
            : value.claimReleaseHours === null
              ? null
              : defaults[policyKey]?.claimReleaseHours ?? defaults.default.claimReleaseHours,
        evidenceQuietHours:
          typeof value.evidenceQuietHours === "number" &&
          Number.isFinite(value.evidenceQuietHours) &&
          value.evidenceQuietHours >= 1
            ? Math.floor(value.evidenceQuietHours)
            : value.evidenceQuietHours === null
              ? null
              : defaults[policyKey]?.evidenceQuietHours ?? defaults.default.evidenceQuietHours,
        maxRoundNumber:
          typeof value.maxRoundNumber === "number" &&
          Number.isFinite(value.maxRoundNumber) &&
          value.maxRoundNumber >= 1
            ? Math.floor(value.maxRoundNumber)
            : value.maxRoundNumber === null
              ? null
              : defaults[policyKey]?.maxRoundNumber ?? defaults.default.maxRoundNumber,
        maxOpenRoundsPerOperator:
          typeof value.maxOpenRoundsPerOperator === "number" &&
          Number.isFinite(value.maxOpenRoundsPerOperator) &&
          value.maxOpenRoundsPerOperator >= 1
            ? Math.floor(value.maxOpenRoundsPerOperator)
            : value.maxOpenRoundsPerOperator === null
              ? null
              : defaults[policyKey]?.maxOpenRoundsPerOperator ?? defaults.default.maxOpenRoundsPerOperator,
        preferCaseAssignee:
          typeof value.preferCaseAssignee === "boolean"
            ? value.preferCaseAssignee
            : defaults[policyKey]?.preferCaseAssignee ?? defaults.default.preferCaseAssignee,
        assigneePool: Array.isArray(value.assigneePool)
          ? value.assigneePool
              .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
              .map((entry) => entry.trim())
          : defaults[policyKey]?.assigneePool ?? defaults.default.assigneePool,
      };
    }
  } catch (error) {
    throw new Error(`Invalid ARBITRATION_REVIEW_ROUND_POLICIES_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

const knownAgentExecutionCallbackReplayFailureClasses: AgentExecutionCallbackReplayFailureClass[] = [
  "stored_payload_unavailable",
  "callback_secret_unavailable",
  "duplicate_replay_cooldown",
  "agent_disabled",
  "callback_not_retryable",
  "unsupported_target",
  "callback_protocol_mismatch",
];

const knownAgentExecutionCallbackReplayPayloadCompatibilities = ["current", "legacy_normalized"] as const;
type AgentExecutionCallbackReplayPayloadCompatibility =
  (typeof knownAgentExecutionCallbackReplayPayloadCompatibilities)[number];

const agentExecutionCallbackReplayCompatibilityPolicyDefaults: Record<
  AgentExecutionCallbackReplayCompatibilityPolicyKey,
  AgentExecutionCallbackReplayPayloadCompatibility[]
> = {
  current_only: ["current"],
  allow_legacy_payload: ["current", "legacy_normalized"],
  allow_compat_window: ["current", "legacy_normalized"],
};

const agentExecutionCallbackReplayFallbackProfileDefaults: Record<
  Exclude<AgentExecutionCallbackReplayFallbackProfileKey, "custom">,
  AgentExecutionCallbackReplayFailureClass[]
> = {
  none: [],
  safe_structural: ["stored_payload_unavailable", "callback_secret_unavailable"],
  extended_structural: [
    "stored_payload_unavailable",
    "callback_secret_unavailable",
    "duplicate_replay_cooldown",
  ],
};

function normalizeAgentExecutionCallbackReplayFailureClasses(
  input: unknown,
  fallback: AgentExecutionCallbackReplayFailureClass[],
) {
  if (!Array.isArray(input)) {
    return fallback;
  }
  const values = input.filter(
    (entry): entry is AgentExecutionCallbackReplayFailureClass =>
      typeof entry === "string" &&
      knownAgentExecutionCallbackReplayFailureClasses.includes(entry as AgentExecutionCallbackReplayFailureClass),
  );
  return Array.from(new Set(values));
}

function normalizeAgentExecutionCallbackReplayPayloadCompatibilities(
  input: unknown,
  fallback: AgentExecutionCallbackReplayPayloadCompatibility[],
): AgentExecutionCallbackReplayPayloadCompatibility[] {
  if (!Array.isArray(input)) {
    return fallback;
  }
  const values = input.filter(
    (entry): entry is AgentExecutionCallbackReplayPayloadCompatibility =>
      typeof entry === "string" &&
      knownAgentExecutionCallbackReplayPayloadCompatibilities.includes(
        entry as AgentExecutionCallbackReplayPayloadCompatibility,
      ),
  );
  return Array.from(new Set(values)) as AgentExecutionCallbackReplayPayloadCompatibility[];
}

function resolveAgentExecutionCallbackReplayFallbackProfileKey(args: {
  profileKey: unknown;
  failureClasses: AgentExecutionCallbackReplayFailureClass[];
  fallbackProfileKey: AgentExecutionCallbackReplayFallbackProfileKey;
}) {
  if (
    args.profileKey === "none" ||
    args.profileKey === "safe_structural" ||
    args.profileKey === "extended_structural" ||
    args.profileKey === "custom"
  ) {
    if (args.profileKey !== "custom") {
      return args.profileKey;
    }
  }

  for (const [profileKey, failureClasses] of Object.entries(
    agentExecutionCallbackReplayFallbackProfileDefaults,
  ) as Array<[Exclude<AgentExecutionCallbackReplayFallbackProfileKey, "custom">, AgentExecutionCallbackReplayFailureClass[]]>) {
    if (
      failureClasses.length === args.failureClasses.length &&
      failureClasses.every((failureClass) => args.failureClasses.includes(failureClass))
    ) {
      return profileKey;
    }
  }

  return args.fallbackProfileKey;
}

function parseAgentCallbackRemediationPolicies(args: {
  raw: string | undefined;
  defaultMaxAttempts: number;
  defaultBaseBackoffSeconds: number;
}) {
  const categories: AgentExecutionCallbackRejectionCategory[] = [
    "invalid_secret",
    "invalid_signature",
    "invalid_timestamp",
    "invalid_version",
    "invalid_payload",
    "processing_conflict",
    "unsupported_target",
    "unknown",
  ];
  const defaults: CoreEnv["agentCallbackRemediationPolicies"] = {
    manual_only: {
      label: "Manual Only",
      autoRemediationEnabled: false,
      autoReplayStoredPayload: false,
      fallbackRetryRequestEnabled: false,
      replayCompatibilityPolicyKey: "current_only",
      allowedReplayPayloadCompatibilities: ["current"],
      allowReplayFromPreviousProtocolWindow: false,
      allowReplayFromPreviousSecretWindow: false,
      fallbackRetryRequestReplayFailureProfileKey: "none",
      fallbackRetryRequestReplayFailureClasses: [...agentExecutionCallbackReplayFallbackProfileDefaults.none],
      maxAttempts: 0,
      baseBackoffSeconds: args.defaultBaseBackoffSeconds,
      allowedRejectionCategories: [],
      fallbackRetryRequestCategories: [],
      note: "只记录 rejected callback，不触发自动 remediation。",
    },
    safe_retry: {
      label: "Safe Retry",
      autoRemediationEnabled: true,
      autoReplayStoredPayload: true,
      fallbackRetryRequestEnabled: false,
      replayCompatibilityPolicyKey: "current_only",
      allowedReplayPayloadCompatibilities: ["current"],
      allowReplayFromPreviousProtocolWindow: false,
      allowReplayFromPreviousSecretWindow: false,
      fallbackRetryRequestReplayFailureProfileKey: "none",
      fallbackRetryRequestReplayFailureClasses: [...agentExecutionCallbackReplayFallbackProfileDefaults.none],
      maxAttempts: Math.min(args.defaultMaxAttempts, 1),
      baseBackoffSeconds: args.defaultBaseBackoffSeconds,
      allowedRejectionCategories: ["processing_conflict"],
      fallbackRetryRequestCategories: [],
      note: "仅自动处理明显幂等冲突型回调，降低误重放风险。",
    },
    balanced: {
      label: "Balanced",
      autoRemediationEnabled: true,
      autoReplayStoredPayload: true,
      fallbackRetryRequestEnabled: true,
      replayCompatibilityPolicyKey: "allow_legacy_payload",
      allowedReplayPayloadCompatibilities: ["current", "legacy_normalized"],
      allowReplayFromPreviousProtocolWindow: false,
      allowReplayFromPreviousSecretWindow: false,
      fallbackRetryRequestReplayFailureProfileKey: "safe_structural",
      fallbackRetryRequestReplayFailureClasses: [
        ...agentExecutionCallbackReplayFallbackProfileDefaults.safe_structural,
      ],
      maxAttempts: Math.min(args.defaultMaxAttempts, 3),
      baseBackoffSeconds: args.defaultBaseBackoffSeconds,
      allowedRejectionCategories: ["processing_conflict", "invalid_timestamp"],
      fallbackRetryRequestCategories: ["processing_conflict", "invalid_timestamp"],
      note: "默认策略，自动处理短暂冲突和时钟偏移型 rejected callback。",
    },
    aggressive: {
      label: "Aggressive",
      autoRemediationEnabled: true,
      autoReplayStoredPayload: true,
      fallbackRetryRequestEnabled: true,
      replayCompatibilityPolicyKey: "allow_compat_window",
      allowedReplayPayloadCompatibilities: ["current", "legacy_normalized"],
      allowReplayFromPreviousProtocolWindow: true,
      allowReplayFromPreviousSecretWindow: true,
      fallbackRetryRequestReplayFailureProfileKey: "extended_structural",
      fallbackRetryRequestReplayFailureClasses: [
        ...agentExecutionCallbackReplayFallbackProfileDefaults.extended_structural,
      ],
      maxAttempts: args.defaultMaxAttempts,
      baseBackoffSeconds: Math.max(1, Math.floor(args.defaultBaseBackoffSeconds / 2)),
      allowedRejectionCategories: ["processing_conflict", "invalid_timestamp", "invalid_version"],
      fallbackRetryRequestCategories: ["processing_conflict", "invalid_timestamp", "invalid_version"],
      note: "兼容窗口频繁变化时使用，会额外尝试版本失配型重放。",
    },
  };

  if (!args.raw) return defaults;

  try {
    const parsed = JSON.parse(args.raw) as Partial<
      Record<
        AgentCallbackRemediationPolicyKey,
        {
          label?: unknown;
          autoRemediationEnabled?: unknown;
          autoReplayStoredPayload?: unknown;
          fallbackRetryRequestEnabled?: unknown;
          replayCompatibilityPolicyKey?: unknown;
          allowedReplayPayloadCompatibilities?: unknown;
          allowReplayFromPreviousProtocolWindow?: unknown;
          allowReplayFromPreviousSecretWindow?: unknown;
          fallbackRetryRequestReplayFailureProfileKey?: unknown;
          fallbackRetryRequestReplayFailureClasses?: unknown;
          maxAttempts?: unknown;
          baseBackoffSeconds?: unknown;
          allowedRejectionCategories?: unknown;
          fallbackRetryRequestCategories?: unknown;
          note?: unknown;
        }
      >
    >;

    for (const key of Object.keys(defaults) as AgentCallbackRemediationPolicyKey[]) {
      const value = parsed[key];
      if (!value || typeof value !== "object") continue;
      const normalizeCategories = (input: unknown, fallback: AgentExecutionCallbackRejectionCategory[]) =>
        Array.isArray(input)
          ? input.filter(
              (entry): entry is AgentExecutionCallbackRejectionCategory =>
                typeof entry === "string" && categories.includes(entry as AgentExecutionCallbackRejectionCategory),
            )
          : fallback;
      const requestedReplayFailureProfileKey =
        value.fallbackRetryRequestReplayFailureProfileKey === "none" ||
        value.fallbackRetryRequestReplayFailureProfileKey === "safe_structural" ||
        value.fallbackRetryRequestReplayFailureProfileKey === "extended_structural" ||
        value.fallbackRetryRequestReplayFailureProfileKey === "custom"
          ? value.fallbackRetryRequestReplayFailureProfileKey
          : null;
      const replayFailureClasses =
        value.fallbackRetryRequestReplayFailureClasses !== undefined
          ? normalizeAgentExecutionCallbackReplayFailureClasses(
              value.fallbackRetryRequestReplayFailureClasses,
              defaults[key].fallbackRetryRequestReplayFailureClasses,
            )
          : requestedReplayFailureProfileKey && requestedReplayFailureProfileKey !== "custom"
            ? [...agentExecutionCallbackReplayFallbackProfileDefaults[requestedReplayFailureProfileKey]]
            : defaults[key].fallbackRetryRequestReplayFailureClasses;
      const replayFailureProfileKey = resolveAgentExecutionCallbackReplayFallbackProfileKey({
        profileKey: requestedReplayFailureProfileKey,
        failureClasses: replayFailureClasses,
        fallbackProfileKey:
          value.fallbackRetryRequestReplayFailureClasses !== undefined
            ? "custom"
            : defaults[key].fallbackRetryRequestReplayFailureProfileKey,
      });
      const replayCompatibilityPolicyKey =
        value.replayCompatibilityPolicyKey === "current_only" ||
        value.replayCompatibilityPolicyKey === "allow_legacy_payload" ||
        value.replayCompatibilityPolicyKey === "allow_compat_window"
          ? value.replayCompatibilityPolicyKey
          : defaults[key].replayCompatibilityPolicyKey;
      const allowedReplayPayloadCompatibilities: AgentExecutionCallbackReplayPayloadCompatibility[] =
        value.allowedReplayPayloadCompatibilities !== undefined
          ? normalizeAgentExecutionCallbackReplayPayloadCompatibilities(
              value.allowedReplayPayloadCompatibilities,
              defaults[key].allowedReplayPayloadCompatibilities,
            )
          : [...agentExecutionCallbackReplayCompatibilityPolicyDefaults[replayCompatibilityPolicyKey]];
      defaults[key] = {
        label: typeof value.label === "string" && value.label.trim().length > 0 ? value.label.trim() : defaults[key].label,
        autoRemediationEnabled:
          typeof value.autoRemediationEnabled === "boolean"
            ? value.autoRemediationEnabled
            : defaults[key].autoRemediationEnabled,
        autoReplayStoredPayload:
          typeof value.autoReplayStoredPayload === "boolean"
            ? value.autoReplayStoredPayload
            : defaults[key].autoReplayStoredPayload,
        fallbackRetryRequestEnabled:
          typeof value.fallbackRetryRequestEnabled === "boolean"
            ? value.fallbackRetryRequestEnabled
            : defaults[key].fallbackRetryRequestEnabled,
        replayCompatibilityPolicyKey,
        allowedReplayPayloadCompatibilities,
        allowReplayFromPreviousProtocolWindow:
          typeof value.allowReplayFromPreviousProtocolWindow === "boolean"
            ? value.allowReplayFromPreviousProtocolWindow
            : replayCompatibilityPolicyKey === "allow_compat_window"
              ? true
              : defaults[key].allowReplayFromPreviousProtocolWindow,
        allowReplayFromPreviousSecretWindow:
          typeof value.allowReplayFromPreviousSecretWindow === "boolean"
            ? value.allowReplayFromPreviousSecretWindow
            : replayCompatibilityPolicyKey === "allow_compat_window"
              ? true
              : defaults[key].allowReplayFromPreviousSecretWindow,
        fallbackRetryRequestReplayFailureProfileKey: replayFailureProfileKey,
        fallbackRetryRequestReplayFailureClasses: replayFailureClasses,
        maxAttempts:
          typeof value.maxAttempts === "number" && Number.isFinite(value.maxAttempts) && value.maxAttempts >= 0
            ? Math.floor(value.maxAttempts)
            : defaults[key].maxAttempts,
        baseBackoffSeconds:
          typeof value.baseBackoffSeconds === "number" &&
          Number.isFinite(value.baseBackoffSeconds) &&
          value.baseBackoffSeconds >= 1
            ? Math.floor(value.baseBackoffSeconds)
            : defaults[key].baseBackoffSeconds,
        allowedRejectionCategories: normalizeCategories(
          value.allowedRejectionCategories,
          defaults[key].allowedRejectionCategories,
        ),
        fallbackRetryRequestCategories: normalizeCategories(
          value.fallbackRetryRequestCategories,
          defaults[key].fallbackRetryRequestCategories,
        ),
        note: typeof value.note === "string" && value.note.trim().length > 0 ? value.note.trim() : defaults[key].note,
      };
    }
  } catch (error) {
    throw new Error(`Invalid AGENT_CALLBACK_REMEDIATION_POLICIES_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseManualReviewSlaPolicies(raw: string | undefined) {
  const defaults: CoreEnv["manualReviewSlaPolicies"] = {
      "priority:urgent": {
        slaHours: 24,
        dueSoonLeadHours: 24,
        criticalAfterHours: 48,
        urgentAfterHours: 96,
        assignAfterHours: 24,
        rebalanceAfterHours: 72,
        autoAssignTemplateKey: "priority:urgent",
        autoAssignEnabled: true,
      maxAutoAssignmentsPerRun: 3,
      anomalyPolicyKey: "severity:critical",
        anomalySeverity: "critical",
        anomalyEscalationStrategy: "urgent_operator_review",
        anomalyAutoAction: "rebalance_queue",
        anomalyCooldownMinutes: 30,
        anomalyStages: [],
      },
      "priority:high": {
        slaHours: 36,
        dueSoonLeadHours: 12,
        criticalAfterHours: 72,
        urgentAfterHours: 120,
        assignAfterHours: 48,
        rebalanceAfterHours: 96,
        autoAssignTemplateKey: null,
        autoAssignEnabled: true,
      maxAutoAssignmentsPerRun: 2,
      anomalyPolicyKey: "severity:warning",
        anomalySeverity: "warning",
        anomalyEscalationStrategy: "operator_review",
        anomalyAutoAction: "assign_template",
        anomalyCooldownMinutes: 45,
        anomalyStages: [],
      },
      "priority:normal": {
        slaHours: 48,
        dueSoonLeadHours: 12,
        criticalAfterHours: null,
        urgentAfterHours: null,
        assignAfterHours: null,
        rebalanceAfterHours: null,
        autoAssignTemplateKey: "default",
        autoAssignEnabled: true,
      maxAutoAssignmentsPerRun: 1,
      anomalyPolicyKey: "default",
        anomalySeverity: "warning",
        anomalyEscalationStrategy: null,
        anomalyAutoAction: null,
        anomalyCooldownMinutes: null,
        anomalyStages: [],
      },
      default: {
        slaHours: 48,
        dueSoonLeadHours: 12,
        criticalAfterHours: null,
        urgentAfterHours: null,
        assignAfterHours: null,
        rebalanceAfterHours: null,
        autoAssignTemplateKey: "default",
        autoAssignEnabled: true,
      maxAutoAssignmentsPerRun: 1,
      anomalyPolicyKey: "default",
        anomalySeverity: "warning",
        anomalyEscalationStrategy: null,
        anomalyAutoAction: null,
        anomalyCooldownMinutes: null,
        anomalyStages: [],
      },
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        slaHours?: unknown;
          dueSoonLeadHours?: unknown;
          criticalAfterHours?: unknown;
          urgentAfterHours?: unknown;
          assignAfterHours?: unknown;
          rebalanceAfterHours?: unknown;
          autoAssignTemplateKey?: unknown;
        autoAssignEnabled?: unknown;
        maxAutoAssignmentsPerRun?: unknown;
        anomalyPolicyKey?: unknown;
        anomalySeverity?: unknown;
          anomalyEscalationStrategy?: unknown;
          anomalyAutoAction?: unknown;
          anomalyCooldownMinutes?: unknown;
          anomalyStages?: unknown;
        }
      >;
    for (const [key, value] of Object.entries(parsed)) {
      const policyKey = key.trim();
      if (!policyKey || !value || typeof value !== "object") continue;
        defaults[policyKey] = {
        slaHours:
          typeof value.slaHours === "number" && Number.isFinite(value.slaHours) && value.slaHours >= 1
            ? Math.floor(value.slaHours)
            : defaults[policyKey]?.slaHours ?? defaults.default.slaHours,
        dueSoonLeadHours:
          typeof value.dueSoonLeadHours === "number" &&
          Number.isFinite(value.dueSoonLeadHours) &&
          value.dueSoonLeadHours >= 1
            ? Math.floor(value.dueSoonLeadHours)
            : defaults[policyKey]?.dueSoonLeadHours ?? defaults.default.dueSoonLeadHours,
        criticalAfterHours:
          typeof value.criticalAfterHours === "number" &&
          Number.isFinite(value.criticalAfterHours) &&
          value.criticalAfterHours >= 1
            ? Math.floor(value.criticalAfterHours)
            : value.criticalAfterHours === null
              ? null
              : defaults[policyKey]?.criticalAfterHours ?? defaults.default.criticalAfterHours,
          urgentAfterHours:
            typeof value.urgentAfterHours === "number" &&
            Number.isFinite(value.urgentAfterHours) &&
            value.urgentAfterHours >= 1
              ? Math.floor(value.urgentAfterHours)
              : value.urgentAfterHours === null
                ? null
                : defaults[policyKey]?.urgentAfterHours ?? defaults.default.urgentAfterHours,
          assignAfterHours:
            typeof value.assignAfterHours === "number" &&
            Number.isFinite(value.assignAfterHours) &&
            value.assignAfterHours >= 1
              ? Math.floor(value.assignAfterHours)
              : value.assignAfterHours === null
                ? null
                : defaults[policyKey]?.assignAfterHours ?? defaults.default.assignAfterHours,
          rebalanceAfterHours:
            typeof value.rebalanceAfterHours === "number" &&
            Number.isFinite(value.rebalanceAfterHours) &&
            value.rebalanceAfterHours >= 1
              ? Math.floor(value.rebalanceAfterHours)
              : value.rebalanceAfterHours === null
                ? null
                : defaults[policyKey]?.rebalanceAfterHours ?? defaults.default.rebalanceAfterHours,
          autoAssignTemplateKey:
            typeof value.autoAssignTemplateKey === "string" && value.autoAssignTemplateKey.trim().length > 0
              ? value.autoAssignTemplateKey.trim()
            : value.autoAssignTemplateKey === null
              ? null
              : defaults[policyKey]?.autoAssignTemplateKey ?? defaults.default.autoAssignTemplateKey,
        autoAssignEnabled:
          typeof value.autoAssignEnabled === "boolean"
            ? value.autoAssignEnabled
            : defaults[policyKey]?.autoAssignEnabled ?? defaults.default.autoAssignEnabled,
        maxAutoAssignmentsPerRun:
          typeof value.maxAutoAssignmentsPerRun === "number" &&
          Number.isFinite(value.maxAutoAssignmentsPerRun) &&
          value.maxAutoAssignmentsPerRun >= 1
            ? Math.floor(value.maxAutoAssignmentsPerRun)
            : defaults[policyKey]?.maxAutoAssignmentsPerRun ?? defaults.default.maxAutoAssignmentsPerRun,
        anomalyPolicyKey:
          typeof value.anomalyPolicyKey === "string" && value.anomalyPolicyKey.trim().length > 0
            ? value.anomalyPolicyKey.trim()
            : value.anomalyPolicyKey === null
              ? null
              : defaults[policyKey]?.anomalyPolicyKey ?? defaults.default.anomalyPolicyKey,
        anomalySeverity:
          value.anomalySeverity === "critical"
            ? "critical"
            : value.anomalySeverity === "warning"
              ? "warning"
              : value.anomalySeverity === null
                ? null
                : defaults[policyKey]?.anomalySeverity ?? defaults.default.anomalySeverity,
        anomalyEscalationStrategy:
          value.anomalyEscalationStrategy === "urgent_operator_review"
            ? "urgent_operator_review"
            : value.anomalyEscalationStrategy === "operator_review"
              ? "operator_review"
              : value.anomalyEscalationStrategy === "owner_notice"
                ? "owner_notice"
                : value.anomalyEscalationStrategy === null
                  ? null
                  : defaults[policyKey]?.anomalyEscalationStrategy ?? defaults.default.anomalyEscalationStrategy,
        anomalyAutoAction:
          value.anomalyAutoAction === "rebalance_queue"
            ? "rebalance_queue"
            : value.anomalyAutoAction === "assign_template"
              ? "assign_template"
              : value.anomalyAutoAction === "none"
                ? "none"
                : value.anomalyAutoAction === null
                  ? null
                  : defaults[policyKey]?.anomalyAutoAction ?? defaults.default.anomalyAutoAction,
          anomalyCooldownMinutes:
            typeof value.anomalyCooldownMinutes === "number" &&
            Number.isFinite(value.anomalyCooldownMinutes) &&
            value.anomalyCooldownMinutes >= 0
              ? Math.floor(value.anomalyCooldownMinutes)
              : value.anomalyCooldownMinutes === null
                ? null
                : defaults[policyKey]?.anomalyCooldownMinutes ?? defaults.default.anomalyCooldownMinutes,
          anomalyStages: Array.isArray(value.anomalyStages)
            ? value.anomalyStages
                .map((item, index) => {
                  if (!item || typeof item !== "object") return null;
                  const stage = item as {
                    key?: unknown;
                    minAgeHours?: unknown;
                    appliesToKinds?: unknown;
                    routingCodes?: unknown;
                    priorities?: unknown;
                    severity?: unknown;
                    alertLevel?: unknown;
                    anomalyPolicyKey?: unknown;
                    anomalyEscalationStrategy?: unknown;
                    anomalyAutoAction?: unknown;
                    autoActionTemplateKey?: unknown;
                    cooldownMinutes?: unknown;
                  };
                  return {
                    key:
                      typeof stage.key === "string" && stage.key.trim().length > 0
                        ? stage.key.trim()
                        : `stage-${index + 1}`,
                    minAgeHours:
                      typeof stage.minAgeHours === "number" &&
                      Number.isFinite(stage.minAgeHours) &&
                      stage.minAgeHours >= 0
                        ? Math.floor(stage.minAgeHours)
                        : 0,
                    appliesToKinds: Array.isArray(stage.appliesToKinds)
                      ? stage.appliesToKinds.filter(
                          (entry): entry is ItemFulfillmentAnomalyKind =>
                            entry === "manual_review_routed" ||
                            entry === "reconcile_failure" ||
                            entry === "stale_manual_review" ||
                            entry === "sla_due_soon_unclaimed" ||
                            entry === "sla_breach_unclaimed",
                        )
                      : null,
                    routingCodes: Array.isArray(stage.routingCodes)
                      ? stage.routingCodes.filter(
                          (entry): entry is ItemManualReviewRoutingCode =>
                            entry === "high_replacement_frequency" ||
                            entry === "low_coverage" ||
                            entry === "suspicious_pattern" ||
                            entry === "fresh_account_high_risk" ||
                            entry === "normal_review",
                        )
                      : null,
                    priorities: Array.isArray(stage.priorities)
                      ? stage.priorities.filter(
                          (entry): entry is ItemManualReviewPriority =>
                            entry === "normal" || entry === "high" || entry === "urgent",
                        )
                      : null,
                    severity:
                      stage.severity === "critical"
                        ? "critical"
                        : stage.severity === "warning"
                          ? "warning"
                          : null,
                    alertLevel:
                      typeof stage.alertLevel === "number" &&
                      Number.isFinite(stage.alertLevel) &&
                      stage.alertLevel >= 0
                        ? Math.floor(stage.alertLevel)
                        : null,
                    anomalyPolicyKey:
                      typeof stage.anomalyPolicyKey === "string" && stage.anomalyPolicyKey.trim().length > 0
                        ? stage.anomalyPolicyKey.trim()
                        : stage.anomalyPolicyKey === null
                          ? null
                          : null,
                    anomalyEscalationStrategy:
                      stage.anomalyEscalationStrategy === "urgent_operator_review"
                        ? "urgent_operator_review"
                        : stage.anomalyEscalationStrategy === "operator_review"
                          ? "operator_review"
                          : stage.anomalyEscalationStrategy === "owner_notice"
                            ? "owner_notice"
                            : null,
                    anomalyAutoAction:
                      stage.anomalyAutoAction === "rebalance_queue"
                        ? "rebalance_queue"
                        : stage.anomalyAutoAction === "assign_template"
                          ? "assign_template"
                          : stage.anomalyAutoAction === "none"
                            ? "none"
                            : null,
                    autoActionTemplateKey:
                      typeof stage.autoActionTemplateKey === "string" && stage.autoActionTemplateKey.trim().length > 0
                        ? stage.autoActionTemplateKey.trim()
                        : stage.autoActionTemplateKey === null
                          ? null
                          : null,
                    cooldownMinutes:
                      typeof stage.cooldownMinutes === "number" &&
                      Number.isFinite(stage.cooldownMinutes) &&
                      stage.cooldownMinutes >= 0
                        ? Math.floor(stage.cooldownMinutes)
                        : stage.cooldownMinutes === null
                          ? null
                          : null,
                  };
                })
                .filter(
                  (
                    value,
                  ): value is NonNullable<(typeof defaults)[string]["anomalyStages"][number]> => Boolean(value),
                )
                .sort((left, right) => left.minAgeHours - right.minAgeHours)
            : defaults[policyKey]?.anomalyStages ?? defaults.default.anomalyStages,
        };
      }
  } catch (error) {
    throw new Error(`Invalid MANUAL_REVIEW_SLA_POLICIES_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseFeatureDefaults(raw: string | undefined): CoreEnv["featureDefaults"] {
  const defaults = Object.fromEntries(
    featureModuleKeys.map((moduleKey) => [moduleKey, { enabled: true, rolloutNote: null }]),
  ) as CoreEnv["featureDefaults"];

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<Record<FeatureModuleKey, { enabled?: boolean; rolloutNote?: string | null }>>;
    for (const moduleKey of featureModuleKeys) {
      const value = parsed[moduleKey];
      if (!value) continue;
      defaults[moduleKey] = {
        enabled: value.enabled ?? defaults[moduleKey].enabled,
        rolloutNote: value.rolloutNote ?? defaults[moduleKey].rolloutNote,
      };
    }
  } catch (error) {
    throw new Error(`Invalid FEATURE_MODULE_DEFAULTS_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseManualReviewAssigneeCapacities(raw: string | undefined) {
  if (!raw) return {} as Record<string, number>;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalizedEntries = Object.entries(parsed)
      .map(([key, value]) => {
        const operatorUserId = key.trim();
        const capacity =
          typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
        if (!operatorUserId || !capacity) {
          return null;
        }
        return [operatorUserId, capacity] as const;
      })
      .filter((entry): entry is readonly [string, number] => Boolean(entry));

    return Object.fromEntries(normalizedEntries);
  } catch (error) {
    throw new Error(`Invalid MANUAL_REVIEW_ASSIGNEE_CAPACITIES_JSON: ${(error as Error).message}`);
  }
}

function parseManualReviewRoutingAssigneePools(raw: string | undefined, allowedOperatorIds: string[]) {
  if (!raw) return {} as Partial<Record<string, string[]>>;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const allowed = new Set(allowedOperatorIds.map((value) => value.trim()).filter(Boolean));
    const normalized = Object.entries(parsed)
      .map(([routingCode, value]) => {
        if (!Array.isArray(value)) return null;
        const pool = value
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0 && allowed.has(entry));
        if (!routingCode.trim() || pool.length === 0) return null;
        return [routingCode.trim(), Array.from(new Set(pool))] as const;
      })
      .filter((entry): entry is readonly [string, string[]] => Boolean(entry));
    return Object.fromEntries(normalized) as Partial<Record<string, string[]>>;
  } catch (error) {
    throw new Error(`Invalid MANUAL_REVIEW_ROUTING_ASSIGNEE_POOLS_JSON: ${(error as Error).message}`);
  }
}

function parseManualReviewAutoAssignTemplates(raw: string | undefined, allowedOperatorIds: string[]) {
  if (!raw) {
    return {} as Record<
      string,
      { maxAssignments: number; assigneePool: string[]; strategy: "least_loaded" | "priority_first" }
    >;
  }

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      { maxAssignments?: number; assigneePool?: unknown; strategy?: unknown }
    >;
    const allowed = new Set(allowedOperatorIds.map((value) => value.trim()).filter(Boolean));
    const normalized = Object.entries(parsed)
      .map(([templateKey, value]) => {
        const pool = Array.isArray(value?.assigneePool)
          ? value.assigneePool
              .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
              .filter((entry) => entry.length > 0 && allowed.has(entry))
          : [];
        if (!templateKey.trim() || pool.length === 0) return null;
        const maxAssignments =
          typeof value?.maxAssignments === "number" && Number.isFinite(value.maxAssignments) && value.maxAssignments > 0
            ? Math.floor(value.maxAssignments)
            : 1;
        const strategy = value?.strategy === "least_loaded" ? "least_loaded" : "priority_first";
        return [templateKey.trim(), { maxAssignments, assigneePool: Array.from(new Set(pool)), strategy }] as const;
      })
      .filter(
        (
          entry,
        ): entry is readonly [
          string,
          { maxAssignments: number; assigneePool: string[]; strategy: "least_loaded" | "priority_first" },
        ] => Boolean(entry),
      );
    return Object.fromEntries(normalized);
  } catch (error) {
    throw new Error(`Invalid MANUAL_REVIEW_AUTO_ASSIGN_TEMPLATES_JSON: ${(error as Error).message}`);
  }
}

function parseFulfillmentAnomalyAlertThresholds(raw: string | undefined) {
  const defaults: Record<ItemFulfillmentAnomalySeverity, number[]> = {
    warning: [12, 48],
    critical: [1, 12, 24],
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<Record<ItemFulfillmentAnomalySeverity, unknown>>;
    for (const severity of Object.keys(defaults) as ItemFulfillmentAnomalySeverity[]) {
      const value = parsed[severity];
      if (!Array.isArray(value)) continue;
      const normalized = value
        .map((entry) => (typeof entry === "number" && Number.isFinite(entry) && entry >= 0 ? Math.floor(entry) : null))
        .filter((entry): entry is number => entry !== null)
        .sort((left, right) => left - right);
      if (normalized.length > 0) {
        defaults[severity] = Array.from(new Set(normalized));
      }
    }
  } catch (error) {
    throw new Error(`Invalid FULFILLMENT_ANOMALY_ALERT_THRESHOLDS_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function parseFulfillmentAnomalyPolicyTemplates(
  raw: string | undefined,
  thresholds: Record<ItemFulfillmentAnomalySeverity, number[]>,
) {
  const defaults: Record<
    string,
    {
      thresholds: number[];
      escalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      failureEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      autoAction: "none" | "assign_template" | "rebalance_queue";
      autoActionTemplateKey: string | null;
      cooldownMinutes: number;
      maxAlertLevel: number;
      maxAutoActionFailures: number;
      anomalyStages: Array<{
        key: string;
        minAgeHours: number;
        appliesToKinds: ItemFulfillmentAnomalyKind[] | null;
        routingCodes: ItemManualReviewRoutingCode[] | null;
        severity: ItemFulfillmentAnomalySeverity | null;
        alertLevel: number | null;
        anomalyPolicyKey: string | null;
        anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
        anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
        autoActionTemplateKey: string | null;
        cooldownMinutes: number | null;
      }>;
    }
  > = {
    "routing:high_replacement_frequency": {
      thresholds: thresholds.critical,
      escalationStrategy: "urgent_operator_review",
      failureEscalationStrategy: "urgent_operator_review",
      autoAction: "assign_template",
      autoActionTemplateKey: "routing:high_replacement_frequency",
      cooldownMinutes: 30,
      maxAlertLevel: Math.max(1, thresholds.critical.length),
      maxAutoActionFailures: 2,
      anomalyStages: [],
    },
    "routing:usage_audit_required": {
      thresholds: thresholds.warning,
      escalationStrategy: "operator_review",
      failureEscalationStrategy: "urgent_operator_review",
      autoAction: "assign_template",
      autoActionTemplateKey: "routing:usage_audit_required",
      cooldownMinutes: 45,
      maxAlertLevel: Math.max(1, thresholds.warning.length),
      maxAutoActionFailures: 2,
      anomalyStages: [],
    },
    "kind:reconcile_failure": {
      thresholds: thresholds.critical,
      escalationStrategy: "urgent_operator_review",
      failureEscalationStrategy: "urgent_operator_review",
      autoAction: "rebalance_queue",
      autoActionTemplateKey: null,
      cooldownMinutes: 20,
      maxAlertLevel: Math.max(1, thresholds.critical.length),
      maxAutoActionFailures: 1,
      anomalyStages: [],
    },
    "kind:sla_breach_unclaimed": {
      thresholds: thresholds.critical,
      escalationStrategy: "urgent_operator_review",
      failureEscalationStrategy: "urgent_operator_review",
      autoAction: "assign_template",
      autoActionTemplateKey: null,
      cooldownMinutes: 15,
      maxAlertLevel: Math.max(1, thresholds.critical.length),
      maxAutoActionFailures: 2,
      anomalyStages: [],
    },
    "severity:critical": {
      thresholds: thresholds.critical,
      escalationStrategy: "urgent_operator_review",
      failureEscalationStrategy: "urgent_operator_review",
      autoAction: "rebalance_queue",
      autoActionTemplateKey: null,
      cooldownMinutes: 20,
      maxAlertLevel: Math.max(1, thresholds.critical.length),
      maxAutoActionFailures: 1,
      anomalyStages: [],
    },
    default: {
      thresholds: thresholds.warning,
      escalationStrategy: "owner_notice",
      failureEscalationStrategy: "operator_review",
      autoAction: "none",
      autoActionTemplateKey: null,
      cooldownMinutes: 60,
      maxAlertLevel: Math.max(1, thresholds.warning.length),
      maxAutoActionFailures: 1,
      anomalyStages: [],
    },
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        thresholds?: unknown;
        escalationStrategy?: unknown;
        failureEscalationStrategy?: unknown;
        autoAction?: unknown;
        autoActionTemplateKey?: unknown;
        cooldownMinutes?: unknown;
        maxAlertLevel?: unknown;
        maxAutoActionFailures?: unknown;
        anomalyStages?: unknown;
      }
    >;
    for (const [key, value] of Object.entries(parsed)) {
      const policyKey = key.trim();
      if (!policyKey || !value || typeof value !== "object") continue;
      const normalizedThresholds = Array.isArray(value.thresholds)
        ? value.thresholds
            .map((entry) => (typeof entry === "number" && Number.isFinite(entry) && entry >= 0 ? Math.floor(entry) : null))
            .filter((entry): entry is number => entry !== null)
            .sort((left, right) => left - right)
        : defaults[policyKey]?.thresholds ?? thresholds.warning;
      defaults[policyKey] = {
        thresholds: Array.from(new Set(normalizedThresholds.length > 0 ? normalizedThresholds : thresholds.warning)),
        escalationStrategy:
          value.escalationStrategy === "urgent_operator_review"
            ? "urgent_operator_review"
            : value.escalationStrategy === "operator_review"
              ? "operator_review"
              : "owner_notice",
        failureEscalationStrategy:
          value.failureEscalationStrategy === "urgent_operator_review"
            ? "urgent_operator_review"
            : value.failureEscalationStrategy === "operator_review"
              ? "operator_review"
              : defaults[policyKey]?.failureEscalationStrategy ?? "operator_review",
        autoAction:
          value.autoAction === "assign_template"
            ? "assign_template"
            : value.autoAction === "rebalance_queue"
              ? "rebalance_queue"
              : defaults[policyKey]?.autoAction ?? "none",
        autoActionTemplateKey:
          typeof value.autoActionTemplateKey === "string" && value.autoActionTemplateKey.trim().length > 0
            ? value.autoActionTemplateKey.trim()
            : defaults[policyKey]?.autoActionTemplateKey ?? null,
        cooldownMinutes:
          typeof value.cooldownMinutes === "number" && Number.isFinite(value.cooldownMinutes) && value.cooldownMinutes >= 0
            ? Math.floor(value.cooldownMinutes)
            : defaults[policyKey]?.cooldownMinutes ?? 60,
        maxAlertLevel:
          typeof value.maxAlertLevel === "number" && Number.isFinite(value.maxAlertLevel) && value.maxAlertLevel >= 0
            ? Math.floor(value.maxAlertLevel)
            : Math.max(
                1,
                (Array.isArray(value.thresholds) ? normalizedThresholds : defaults[policyKey]?.thresholds ?? thresholds.warning)
                  .length,
              ),
        maxAutoActionFailures:
          typeof value.maxAutoActionFailures === "number" &&
          Number.isFinite(value.maxAutoActionFailures) &&
          value.maxAutoActionFailures >= 0
            ? Math.floor(value.maxAutoActionFailures)
            : defaults[policyKey]?.maxAutoActionFailures ?? 1,
        anomalyStages: Array.isArray(value.anomalyStages)
          ? value.anomalyStages
              .map((item, index) => {
                if (!item || typeof item !== "object") return null;
                const stage = item as {
                  key?: unknown;
                  minAgeHours?: unknown;
                  appliesToKinds?: unknown;
                  routingCodes?: unknown;
                  severity?: unknown;
                  alertLevel?: unknown;
                  anomalyPolicyKey?: unknown;
                  anomalyEscalationStrategy?: unknown;
                  anomalyAutoAction?: unknown;
                  autoActionTemplateKey?: unknown;
                  cooldownMinutes?: unknown;
                };
                const normalizedMinAgeHours =
                  typeof stage.minAgeHours === "number" && Number.isFinite(stage.minAgeHours) && stage.minAgeHours >= 0
                    ? Math.floor(stage.minAgeHours)
                    : null;
                if (normalizedMinAgeHours === null) return null;
                const appliesToKinds = Array.isArray(stage.appliesToKinds)
                  ? Array.from(
                      new Set(
                        stage.appliesToKinds.filter(
                          (entry): entry is ItemFulfillmentAnomalyKind =>
                            typeof entry === "string" && entry.trim().length > 0,
                        ),
                      ),
                    )
                  : null;
                const routingCodes = Array.isArray(stage.routingCodes)
                  ? Array.from(
                      new Set(
                        stage.routingCodes.filter(
                          (entry): entry is ItemManualReviewRoutingCode =>
                            typeof entry === "string" && entry.trim().length > 0,
                        ),
                      ),
                    )
                  : null;
                return {
                  key:
                    typeof stage.key === "string" && stage.key.trim().length > 0
                      ? stage.key.trim()
                      : `${policyKey}:stage:${index + 1}`,
                  minAgeHours: normalizedMinAgeHours,
                  appliesToKinds: appliesToKinds && appliesToKinds.length > 0 ? appliesToKinds : null,
                  routingCodes: routingCodes && routingCodes.length > 0 ? routingCodes : null,
                  severity:
                    stage.severity === "critical"
                      ? "critical"
                      : stage.severity === "warning"
                        ? "warning"
                        : null,
                  alertLevel:
                    typeof stage.alertLevel === "number" &&
                    Number.isFinite(stage.alertLevel) &&
                    stage.alertLevel >= 0
                      ? Math.floor(stage.alertLevel)
                      : null,
                  anomalyPolicyKey:
                    typeof stage.anomalyPolicyKey === "string" && stage.anomalyPolicyKey.trim().length > 0
                      ? stage.anomalyPolicyKey.trim()
                      : null,
                  anomalyEscalationStrategy:
                    stage.anomalyEscalationStrategy === "urgent_operator_review"
                      ? "urgent_operator_review"
                      : stage.anomalyEscalationStrategy === "operator_review"
                        ? "operator_review"
                        : stage.anomalyEscalationStrategy === "owner_notice"
                          ? "owner_notice"
                          : null,
                  anomalyAutoAction:
                    stage.anomalyAutoAction === "rebalance_queue"
                      ? "rebalance_queue"
                      : stage.anomalyAutoAction === "assign_template"
                        ? "assign_template"
                        : stage.anomalyAutoAction === "none"
                          ? "none"
                          : null,
                  autoActionTemplateKey:
                    typeof stage.autoActionTemplateKey === "string" && stage.autoActionTemplateKey.trim().length > 0
                      ? stage.autoActionTemplateKey.trim()
                      : null,
                  cooldownMinutes:
                    typeof stage.cooldownMinutes === "number" &&
                    Number.isFinite(stage.cooldownMinutes) &&
                    stage.cooldownMinutes >= 0
                      ? Math.floor(stage.cooldownMinutes)
                      : null,
                };
              })
              .filter(
                (
                  stage,
                ): stage is NonNullable<
                  CoreEnv["fulfillmentAnomalyPolicyTemplates"][string]["anomalyStages"][number]
                > => stage !== null,
              )
              .sort((left, right) => left.minAgeHours - right.minAgeHours || left.key.localeCompare(right.key))
          : defaults[policyKey]?.anomalyStages ?? [],
      };
    }
  } catch (error) {
    throw new Error(`Invalid FULFILLMENT_ANOMALY_POLICY_TEMPLATES_JSON: ${(error as Error).message}`);
  }

  return defaults;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function parseHeavyChatGatewayTimeoutMs(value: string | undefined, fallback = 30_000) {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error("HEAVY_CHAT_GATEWAY_TIMEOUT_MS must be a finite number");
  }
  return Math.max(1_000, Math.floor(parsed));
}

export function parseInfrastructureTimeoutMs(value: string | undefined, fallback: number, minimum = 250) {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.floor(parsed);
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const platformOperatorUserIds = (process.env.PLATFORM_OPERATOR_USER_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const agentExecutionDefaultBillingCurrency =
  process.env.AGENT_EXECUTION_BILLING_CURRENCY?.trim() === "mira"
    ? "mira"
    : process.env.AGENT_EXECUTION_BILLING_CURRENCY?.trim() === "opinionTickets"
      ? "opinionTickets"
      : "obsidian";
const agentExecutionDefaultCostUnitsPerCurrency = Math.max(
  1,
  Number(process.env.AGENT_EXECUTION_COST_UNITS_PER_CURRENCY || 10),
);
const agentExecutionDefaultRevenueSharePercent = Math.max(
  0,
  Math.min(100, Number(process.env.AGENT_EXECUTION_REVENUE_SHARE_PERCENT || 100)),
);
const agentExecutionDefaultTreasuryUserId =
  process.env.AGENT_EXECUTION_TREASURY_USER_ID?.trim() || "system:agent-execution-treasury";
const agentExecutionRuntimeProfileBudgets = parseRuntimeProfileBudgets(
  process.env.AGENT_EXECUTION_RUNTIME_PROFILE_BUDGETS_JSON,
);
const agentExecutionPricingPolicies = parseExecutionPricingPolicies({
  raw: process.env.AGENT_EXECUTION_PRICING_POLICIES_JSON,
  defaultCurrency: agentExecutionDefaultBillingCurrency,
  defaultCostUnitsPerCurrency: agentExecutionDefaultCostUnitsPerCurrency,
  defaultRevenueSharePercent: agentExecutionDefaultRevenueSharePercent,
  defaultTreasuryUserId: agentExecutionDefaultTreasuryUserId,
});
const agentExecutionRevenueContracts = parseExecutionRevenueContracts({
  raw: process.env.AGENT_EXECUTION_REVENUE_CONTRACTS_JSON,
  defaultRevenueSharePercent: agentExecutionDefaultRevenueSharePercent,
  defaultTreasuryUserId: agentExecutionDefaultTreasuryUserId,
});
const agentCallbackRemediationPolicies = parseAgentCallbackRemediationPolicies({
  raw: process.env.AGENT_CALLBACK_REMEDIATION_POLICIES_JSON,
  defaultMaxAttempts: Math.max(0, Number(process.env.AGENT_EXECUTION_CALLBACK_AUTO_REMEDIATION_MAX_ATTEMPTS || 3)),
  defaultBaseBackoffSeconds: Math.max(
    1,
    Number(process.env.AGENT_EXECUTION_CALLBACK_AUTO_REMEDIATION_BASE_BACKOFF_SECONDS || 300),
  ),
});
const agentExecutionRuntimeProfiles = parseExecutionRuntimeProfiles({
  raw: process.env.AGENT_EXECUTION_RUNTIME_PROFILES_JSON,
  maxAutoRecoveries: Math.max(1, Number(process.env.AGENT_EXECUTION_MAX_AUTO_RECOVERIES || 3)),
  budgets: agentExecutionRuntimeProfileBudgets,
  pricingPolicies: agentExecutionPricingPolicies,
  revenueContracts: agentExecutionRevenueContracts,
});

export const env: CoreEnv = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  databaseConnectionTimeoutMs: parseInfrastructureTimeoutMs(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 5_000),
  databaseQueryTimeoutMs: parseInfrastructureTimeoutMs(process.env.DATABASE_QUERY_TIMEOUT_MS, 30_000),
  redisUrl: requireEnv("REDIS_URL"),
  corePublicBaseUrl: process.env.CORE_PUBLIC_BASE_URL?.trim() || null,
  internalApiToken: requireEnv("INTERNAL_API_TOKEN"),
  aiGatewayInternalUrl: process.env.AI_GATEWAY_INTERNAL_URL?.trim() || null,
  aiGatewayManagementToken:
    process.env.AI_GATEWAY_MANAGEMENT_TOKEN?.trim() ||
    process.env.GATEWAY_MANAGEMENT_TOKEN?.trim() ||
    process.env.INTERNAL_API_TOKEN?.trim() ||
    null,
  gatewayInternalFetchTimeoutMs: parseInfrastructureTimeoutMs(
    process.env.GATEWAY_INTERNAL_FETCH_TIMEOUT_MS ?? process.env.INTERNAL_FETCH_TIMEOUT_MS,
    10_000,
  ),
  heavyChatGatewayModel: process.env.HEAVY_CHAT_GATEWAY_MODEL?.trim() || null,
  heavyChatGatewayTimeoutMs: parseHeavyChatGatewayTimeoutMs(process.env.HEAVY_CHAT_GATEWAY_TIMEOUT_MS),
  teaServerUrl: process.env.TEA_SERVER_URL?.trim() || process.env.TEA_BASE_URL?.trim() || null,
  teaAuthToken: process.env.TEA_AUTH_TOKEN?.trim() || process.env.INTERNAL_API_TOKEN?.trim() || null,
  platformOperatorUserIds,
  outboxProcessingLeaseTimeoutMs: Math.max(
    5_000,
    Number(process.env.WORKER_PROCESSING_LEASE_TIMEOUT_MS || 5 * 60 * 1000),
  ),
  objectStorageDriver:
    process.env.OBJECT_STORAGE_DRIVER?.trim() === "s3-compatible"
      ? "s3-compatible"
      : process.env.ARBITRATION_EVIDENCE_STORAGE_MODE?.trim() === "remote"
        ? "s3-compatible"
        : "local",
  objectStorageLocalDir: process.env.OBJECT_STORAGE_LOCAL_DIR?.trim() || ".runtime/object-storage",
  objectStorageBucket: process.env.OBJECT_STORAGE_BUCKET?.trim() || null,
  objectStorageRegion: process.env.OBJECT_STORAGE_REGION?.trim() || "auto",
  objectStorageEndpoint:
    process.env.OBJECT_STORAGE_ENDPOINT?.trim() || process.env.ARBITRATION_EVIDENCE_REMOTE_UPLOAD_BASE_URL?.trim() || null,
  objectStorageAccessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim() || null,
  objectStorageSecretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim() || null,
  objectStoragePublicBaseUrl:
    process.env.S3_PUBLIC_BASE_URL?.trim() || process.env.OBJECT_STORAGE_PUBLIC_BASE_URL?.trim() || null,
  objectStorageForcePathStyle: parseBooleanEnv(process.env.OBJECT_STORAGE_FORCE_PATH_STYLE, false),
  objectStorageSignedUrlTtlSeconds: Math.max(
    60,
    Number(process.env.OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS || 900),
  ),
  objectStorageFetchTimeoutMs: parseInfrastructureTimeoutMs(
    process.env.OBJECT_STORAGE_FETCH_TIMEOUT_MS ?? process.env.INTERNAL_FETCH_TIMEOUT_MS,
    10_000,
  ),
  externalCallbackMaxSkewSeconds: Math.max(30, Number(process.env.EXTERNAL_CALLBACK_MAX_SKEW_SECONDS || 300)),
  externalCallbackSecretGraceSeconds: Math.max(
    60,
    Number(process.env.EXTERNAL_CALLBACK_SECRET_GRACE_SECONDS || 3600),
  ),
  externalCallbackProtocolGraceSeconds: Math.max(
    60,
    Number(process.env.EXTERNAL_CALLBACK_PROTOCOL_GRACE_SECONDS || 1800),
  ),
  agentMarketplaceRouterApiBaseUrl: process.env.AGENT_MARKETPLACE_ROUTER_API_BASE_URL?.trim() || null,
  agentMarketplaceRouterApiKey: process.env.AGENT_MARKETPLACE_ROUTER_API_KEY?.trim() || null,
  agentMarketplaceRouterModel: process.env.AGENT_MARKETPLACE_ROUTER_MODEL?.trim() || null,
  arbitrationEvidenceStorageDir:
    process.env.ARBITRATION_EVIDENCE_STORAGE_DIR?.trim() || ".runtime/arbitration-evidence",
  arbitrationEvidenceStorageMode:
    process.env.OBJECT_STORAGE_DRIVER?.trim() === "s3-compatible" ||
    process.env.ARBITRATION_EVIDENCE_STORAGE_MODE?.trim() === "remote"
      ? "remote"
      : "local",
  arbitrationEvidenceRemoteProviderKey:
    process.env.ARBITRATION_EVIDENCE_REMOTE_PROVIDER_KEY?.trim() ||
    (process.env.OBJECT_STORAGE_DRIVER?.trim() === "s3-compatible" ? "s3-compatible" : "generic_http"),
  arbitrationEvidenceRemoteUploadStrategy:
    process.env.OBJECT_STORAGE_DRIVER?.trim() === "s3-compatible" ||
    process.env.ARBITRATION_EVIDENCE_STORAGE_MODE?.trim() === "remote"
      ? process.env.ARBITRATION_EVIDENCE_REMOTE_UPLOAD_STRATEGY?.trim() === "prepared_remote_put"
        ? "prepared_remote_put"
        : "server_proxy_put"
      : "local_filesystem",
  arbitrationEvidenceRemoteBaseUrl: process.env.ARBITRATION_EVIDENCE_REMOTE_BASE_URL?.trim() || null,
  arbitrationEvidenceRemoteUploadBaseUrl: process.env.ARBITRATION_EVIDENCE_REMOTE_UPLOAD_BASE_URL?.trim() || null,
  arbitrationEvidenceRemoteAuthToken: process.env.ARBITRATION_EVIDENCE_REMOTE_AUTH_TOKEN?.trim() || null,
  arbitrationEvidenceUploadPlanTtlSeconds: Math.max(
    60,
    Number(process.env.ARBITRATION_EVIDENCE_UPLOAD_PLAN_TTL_SECONDS || 900),
  ),
  arbitrationEvidenceMaxBytes: Math.max(1_024, Number(process.env.ARBITRATION_EVIDENCE_MAX_BYTES || 5_242_880)),
  arbitrationEvidenceAllowedContentTypes: (process.env.ARBITRATION_EVIDENCE_ALLOWED_CONTENT_TYPES ||
      "application/pdf,image/png,image/jpeg,text/plain").split(",").map((value) => value.trim()).filter(Boolean),
  arbitrationStaleClaimHours: Math.max(1, Number(process.env.ARBITRATION_STALE_CLAIM_HOURS || 24)),
  arbitrationReviewRoundStaleHours: Math.max(1, Number(process.env.ARBITRATION_REVIEW_ROUND_STALE_HOURS || 24)),
  arbitrationReviewRoundPolicies: parseArbitrationReviewRoundPolicies(
    process.env.ARBITRATION_REVIEW_ROUND_POLICIES_JSON,
    Math.max(1, Number(process.env.ARBITRATION_REVIEW_ROUND_STALE_HOURS || 24)),
    Math.max(1, Number(process.env.ARBITRATION_STALE_CLAIM_HOURS || 24)),
  ),
  arbitrationRemoteCleanupDays: Math.max(1, Number(process.env.ARBITRATION_REMOTE_CLEANUP_DAYS || 14)),
  arbitrationRemoteCleanupMaxAttempts: Math.max(1, Number(process.env.ARBITRATION_REMOTE_CLEANUP_MAX_ATTEMPTS || 5)),
  arbitrationRemoteCleanupBaseBackoffMinutes: Math.max(
    1,
    Number(process.env.ARBITRATION_REMOTE_CLEANUP_BASE_BACKOFF_MINUTES || 30),
  ),
  arbitrationEvidenceStoragePolicyKey: process.env.ARBITRATION_EVIDENCE_STORAGE_POLICY_KEY?.trim() || "default",
  arbitrationEvidenceStorageBucketKey:
    process.env.ARBITRATION_EVIDENCE_STORAGE_BUCKET_KEY?.trim() ||
    process.env.OBJECT_STORAGE_BUCKET?.trim() ||
    null,
  arbitrationEvidenceStoragePolicies: parseArbitrationEvidenceStoragePolicies({
    raw: process.env.ARBITRATION_EVIDENCE_STORAGE_POLICIES_JSON,
    defaultPolicyKey: process.env.ARBITRATION_EVIDENCE_STORAGE_POLICY_KEY?.trim() || "default",
    defaultBucketKey:
      process.env.ARBITRATION_EVIDENCE_STORAGE_BUCKET_KEY?.trim() ||
      process.env.OBJECT_STORAGE_BUCKET?.trim() ||
      null,
    defaultUploadPlanTtlSeconds: Math.max(60, Number(process.env.ARBITRATION_EVIDENCE_UPLOAD_PLAN_TTL_SECONDS || 900)),
    defaultRetentionDays: Math.max(1, Number(process.env.ARBITRATION_REMOTE_CLEANUP_DAYS || 14)),
    defaultCleanupMaxAttempts: Math.max(1, Number(process.env.ARBITRATION_REMOTE_CLEANUP_MAX_ATTEMPTS || 5)),
    defaultCleanupBaseBackoffMinutes: Math.max(
      1,
      Number(process.env.ARBITRATION_REMOTE_CLEANUP_BASE_BACKOFF_MINUTES || 30),
    ),
  }),
  agentExecutionStaleSeconds: Math.max(60, Number(process.env.AGENT_EXECUTION_STALE_SECONDS || 900)),
  agentExecutionPhaseTimeouts: (() => {
    const staleSeconds = Math.max(60, Number(process.env.AGENT_EXECUTION_STALE_SECONDS || 900));
    return parsePhaseTimeouts(process.env.AGENT_EXECUTION_PHASE_TIMEOUTS_JSON, staleSeconds);
  })(),
  agentExecutionPhaseCostUnits: parsePhaseCostUnits(process.env.AGENT_EXECUTION_PHASE_COST_UNITS_JSON),
  agentExecutionRunBaseCostUnits: parseRunBaseCostUnits(process.env.AGENT_EXECUTION_RUN_BASE_COST_UNITS_JSON),
  agentExecutionArtifactCostUnits: Math.max(0, Number(process.env.AGENT_EXECUTION_ARTIFACT_COST_UNITS || 1)),
  agentExecutionArtifactResourceMinutes: Math.max(
    0,
    Number(process.env.AGENT_EXECUTION_ARTIFACT_RESOURCE_MINUTES || 1),
  ),
  agentExecutionBudgetNearLimitThresholdPercent: (() => {
    const rawThreshold = Number(process.env.AGENT_EXECUTION_BUDGET_NEAR_LIMIT_THRESHOLD_PERCENT || 0.85);
    if (Number.isFinite(rawThreshold) && rawThreshold > 0 && rawThreshold < 1) {
      return rawThreshold;
    }
    return 0.85;
  })(),
  agentExecutionMaxAutoRecoveries: Math.max(0, Number(process.env.AGENT_EXECUTION_MAX_AUTO_RECOVERIES || 3)),
  agentExecutionCallbackAutoRemediationMaxAttempts: Math.max(
    1,
    Number(process.env.AGENT_EXECUTION_CALLBACK_AUTO_REMEDIATION_MAX_ATTEMPTS || 3),
  ),
  agentExecutionCallbackAutoRemediationBaseBackoffSeconds: Math.max(
    30,
    Number(process.env.AGENT_EXECUTION_CALLBACK_AUTO_REMEDIATION_BASE_BACKOFF_SECONDS || 300),
  ),
  agentExecutionCallbackAlertMinLevel: Math.max(
    1,
    Math.min(3, Number(process.env.AGENT_EXECUTION_CALLBACK_ALERT_MIN_LEVEL || 2)),
  ),
  agentExecutionCallbackAlertCooldownMinutes: Math.max(
    1,
    Number(process.env.AGENT_EXECUTION_CALLBACK_ALERT_COOLDOWN_MINUTES || 60),
  ),
  agentExecutionRuntimeAlertMinLevel: Math.max(
    1,
    Math.min(3, Number(process.env.AGENT_EXECUTION_RUNTIME_ALERT_MIN_LEVEL || 2)),
  ),
  agentExecutionRuntimeAlertCooldownMinutes: Math.max(
    1,
    Number(process.env.AGENT_EXECUTION_RUNTIME_ALERT_COOLDOWN_MINUTES || 60),
  ),
  agentCallbackRemediationPolicies,
  agentExecutionBillingEnabled: process.env.AGENT_EXECUTION_BILLING_ENABLED?.trim() !== "false",
  agentExecutionBillingCurrency: agentExecutionDefaultBillingCurrency,
  agentExecutionCostUnitsPerCurrency: agentExecutionDefaultCostUnitsPerCurrency,
  agentExecutionRevenueSharePercent: agentExecutionDefaultRevenueSharePercent,
  agentExecutionTreasuryUserId: agentExecutionDefaultTreasuryUserId,
  agentExecutionPricingPolicies,
  agentExecutionRevenueContracts,
  agentExecutionRuntimeProfileBudgets,
  agentExecutionRuntimeProfiles,
  manualReviewStaleClaimHours: Math.max(1, Number(process.env.MANUAL_REVIEW_STALE_CLAIM_HOURS || 12)),
  manualReviewSlaHours: Math.max(1, Number(process.env.MANUAL_REVIEW_SLA_HOURS || 48)),
  manualReviewDefaultAssigneeCapacity: Math.max(
    1,
    Number(process.env.MANUAL_REVIEW_DEFAULT_ASSIGNEE_CAPACITY || 8),
  ),
  manualReviewAssigneeCapacities: parseManualReviewAssigneeCapacities(
    process.env.MANUAL_REVIEW_ASSIGNEE_CAPACITIES_JSON,
  ),
  manualReviewRoutingAssigneePools: parseManualReviewRoutingAssigneePools(
    process.env.MANUAL_REVIEW_ROUTING_ASSIGNEE_POOLS_JSON,
    platformOperatorUserIds,
  ),
  manualReviewAutoAssignTemplates: parseManualReviewAutoAssignTemplates(
    process.env.MANUAL_REVIEW_AUTO_ASSIGN_TEMPLATES_JSON,
    platformOperatorUserIds,
  ),
  manualReviewSlaPolicies: parseManualReviewSlaPolicies(process.env.MANUAL_REVIEW_SLA_POLICIES_JSON),
  manualReviewAutoRebalanceMaxAssignments: Math.max(
    1,
    Number(process.env.MANUAL_REVIEW_AUTO_REBALANCE_MAX_ASSIGNMENTS || 10),
  ),
  manualReviewAutoRebalanceIntervalMs: Math.max(
    60_000,
    Number(process.env.MANUAL_REVIEW_AUTO_REBALANCE_INTERVAL_MS || 15 * 60 * 1000),
  ),
  fulfillmentAnomalyAlertThresholds: parseFulfillmentAnomalyAlertThresholds(
    process.env.FULFILLMENT_ANOMALY_ALERT_THRESHOLDS_JSON,
  ),
  fulfillmentAnomalyPolicyTemplates: parseFulfillmentAnomalyPolicyTemplates(
    process.env.FULFILLMENT_ANOMALY_POLICY_TEMPLATES_JSON,
    parseFulfillmentAnomalyAlertThresholds(process.env.FULFILLMENT_ANOMALY_ALERT_THRESHOLDS_JSON),
  ),
  featureDefaults: parseFeatureDefaults(process.env.FEATURE_MODULE_DEFAULTS_JSON),
  obsidianToMiraRate: (() => {
    const rawRate = Number(process.env.OBSIDIAN_TO_MIRA_RATE ?? "10");
    if (Number.isFinite(rawRate) && rawRate > 0) return rawRate;
    return 10;
  })(),
};
