import {
  type ArbitrationEvidenceKind,
  type CurrencyKey,
  type AgentExecutionRuntimeProfileKey,
  type AgentExecutionRunKind,
  type ItemFulfillmentAnomalySeverity,
  featureModuleKeys,
  type FeatureModuleKey,
  type PlatformExecutionPhase,
} from "@neuro/contracts";

type CoreEnv = {
  port: number;
  databaseUrl: string;
  accountDatabaseUrl: string;
  accountDatabaseUrlOverride: string | null;
  accountDatabaseDedicated: boolean;
  redisUrl: string;
  corePublicBaseUrl: string | null;
  internalApiToken: string;
  platformOperatorUserIds: string[];
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
  externalCallbackMaxSkewSeconds: number;
  externalCallbackSecretGraceSeconds: number;
  externalCallbackProtocolGraceSeconds: number;
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
  arbitrationRemoteCleanupDays: number;
  arbitrationRemoteCleanupMaxAttempts: number;
  arbitrationRemoteCleanupBaseBackoffMinutes: number;
  arbitrationEvidenceStoragePolicyKey: string;
  arbitrationEvidenceStorageBucketKey: string | null;
  arbitrationEvidenceStoragePolicies: Record<
    string,
    {
      bucketKey: string | null;
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
  agentExecutionMaxAutoRecoveries: number;
  agentExecutionCallbackAutoRemediationMaxAttempts: number;
  agentExecutionCallbackAutoRemediationBaseBackoffSeconds: number;
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
      maxAutoRecoveryCount: number;
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
  manualReviewAutoRebalanceMaxAssignments: number;
  manualReviewAutoRebalanceIntervalMs: number;
  fulfillmentAnomalyAlertThresholds: Record<ItemFulfillmentAnomalySeverity, number[]>;
  fulfillmentAnomalyPolicyTemplates: Record<
    string,
    {
      thresholds: number[];
      escalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      autoAction: "none" | "assign_template" | "rebalance_queue";
      autoActionTemplateKey: string | null;
      cooldownMinutes: number;
      maxAlertLevel: number;
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
      maxAutoRecoveryCount: number;
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
      maxAutoRecoveryCount: Math.max(1, args.maxAutoRecoveries),
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
      maxAutoRecoveryCount: Math.max(2, args.maxAutoRecoveries),
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
      maxAutoRecoveryCount: Math.max(3, args.maxAutoRecoveries + 1),
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
          maxAutoRecoveryCount?: unknown;
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
        maxAutoRecoveryCount:
          typeof value.maxAutoRecoveryCount === "number" &&
          Number.isFinite(value.maxAutoRecoveryCount) &&
          value.maxAutoRecoveryCount > 0
            ? Math.floor(value.maxAutoRecoveryCount)
            : defaults[profileKey].maxAutoRecoveryCount,
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
      revenueSharePercent: number;
      treasuryUserId: string;
    }
  > = {
    baseline: {
      label: "Baseline pricing",
      version: 1,
      currency: args.defaultCurrency,
      costUnitsPerCurrency: args.defaultCostUnitsPerCurrency,
      revenueSharePercent: args.defaultRevenueSharePercent,
      treasuryUserId: args.defaultTreasuryUserId,
    },
    iterative: {
      label: "Iterative pricing",
      version: 1,
      currency: args.defaultCurrency,
      costUnitsPerCurrency: Math.max(1, args.defaultCostUnitsPerCurrency),
      revenueSharePercent: args.defaultRevenueSharePercent,
      treasuryUserId: args.defaultTreasuryUserId,
    },
    deep_runtime: {
      label: "Deep runtime pricing",
      version: 1,
      currency: args.defaultCurrency,
      costUnitsPerCurrency: Math.max(1, args.defaultCostUnitsPerCurrency),
      revenueSharePercent: args.defaultRevenueSharePercent,
      treasuryUserId: args.defaultTreasuryUserId,
    },
    default: {
      label: "Default pricing",
      version: 1,
      currency: args.defaultCurrency,
      costUnitsPerCurrency: args.defaultCostUnitsPerCurrency,
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
      treasuryUserId: string;
      revenueRecipientMode: "agent_owner" | "platform_only";
    }
  > = {
    baseline: {
      label: "Baseline revenue",
      version: 1,
      revenueSharePercent: args.defaultRevenueSharePercent,
      treasuryUserId: args.defaultTreasuryUserId,
      revenueRecipientMode: "agent_owner",
    },
    iterative: {
      label: "Iterative revenue",
      version: 1,
      revenueSharePercent: args.defaultRevenueSharePercent,
      treasuryUserId: args.defaultTreasuryUserId,
      revenueRecipientMode: "agent_owner",
    },
    deep_runtime: {
      label: "Deep runtime revenue",
      version: 1,
      revenueSharePercent: args.defaultRevenueSharePercent,
      treasuryUserId: args.defaultTreasuryUserId,
      revenueRecipientMode: "agent_owner",
    },
    default: {
      label: "Default revenue",
      version: 1,
      revenueSharePercent: args.defaultRevenueSharePercent,
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
  defaultRetentionDays: number;
  defaultCleanupMaxAttempts: number;
  defaultCleanupBaseBackoffMinutes: number;
}) {
  const defaultPolicy = {
    bucketKey: args.defaultBucketKey,
    retentionDays: args.defaultRetentionDays,
    cleanupMaxAttempts: args.defaultCleanupMaxAttempts,
    cleanupBaseBackoffMinutes: args.defaultCleanupBaseBackoffMinutes,
    evidenceKinds: [] as ArbitrationEvidenceKind[],
  };
  const defaults: Record<
    string,
    {
      bucketKey: string | null;
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
      autoAction: "none" | "assign_template" | "rebalance_queue";
      autoActionTemplateKey: string | null;
      cooldownMinutes: number;
      maxAlertLevel: number;
    }
  > = {
    "routing:high_replacement_frequency": {
      thresholds: thresholds.critical,
      escalationStrategy: "urgent_operator_review",
      autoAction: "assign_template",
      autoActionTemplateKey: "routing:high_replacement_frequency",
      cooldownMinutes: 30,
      maxAlertLevel: Math.max(1, thresholds.critical.length),
    },
    "routing:usage_audit_required": {
      thresholds: thresholds.warning,
      escalationStrategy: "operator_review",
      autoAction: "assign_template",
      autoActionTemplateKey: "routing:usage_audit_required",
      cooldownMinutes: 45,
      maxAlertLevel: Math.max(1, thresholds.warning.length),
    },
    "kind:reconcile_failure": {
      thresholds: thresholds.critical,
      escalationStrategy: "urgent_operator_review",
      autoAction: "rebalance_queue",
      autoActionTemplateKey: null,
      cooldownMinutes: 20,
      maxAlertLevel: Math.max(1, thresholds.critical.length),
    },
    "kind:sla_breach_unclaimed": {
      thresholds: thresholds.critical,
      escalationStrategy: "urgent_operator_review",
      autoAction: "assign_template",
      autoActionTemplateKey: null,
      cooldownMinutes: 15,
      maxAlertLevel: Math.max(1, thresholds.critical.length),
    },
    "severity:critical": {
      thresholds: thresholds.critical,
      escalationStrategy: "urgent_operator_review",
      autoAction: "rebalance_queue",
      autoActionTemplateKey: null,
      cooldownMinutes: 20,
      maxAlertLevel: Math.max(1, thresholds.critical.length),
    },
    default: {
      thresholds: thresholds.warning,
      escalationStrategy: "owner_notice",
      autoAction: "none",
      autoActionTemplateKey: null,
      cooldownMinutes: 60,
      maxAlertLevel: Math.max(1, thresholds.warning.length),
    },
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        thresholds?: unknown;
        escalationStrategy?: unknown;
        autoAction?: unknown;
        autoActionTemplateKey?: unknown;
        cooldownMinutes?: unknown;
        maxAlertLevel?: unknown;
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

const sharedDatabaseUrl = requireEnv("DATABASE_URL");
const accountDatabaseUrlOverride = process.env.ACCOUNT_DATABASE_URL?.trim() || null;
const accountDatabaseUrl = accountDatabaseUrlOverride ?? sharedDatabaseUrl;

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export const env: CoreEnv = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  accountDatabaseUrl,
  accountDatabaseUrlOverride,
  accountDatabaseDedicated: accountDatabaseUrlOverride !== null,
  redisUrl: requireEnv("REDIS_URL"),
  corePublicBaseUrl: process.env.CORE_PUBLIC_BASE_URL?.trim() || null,
  internalApiToken: requireEnv("INTERNAL_API_TOKEN"),
  platformOperatorUserIds: (process.env.PLATFORM_OPERATOR_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
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
  externalCallbackMaxSkewSeconds: Math.max(30, Number(process.env.EXTERNAL_CALLBACK_MAX_SKEW_SECONDS || 300)),
  externalCallbackSecretGraceSeconds: Math.max(
    60,
    Number(process.env.EXTERNAL_CALLBACK_SECRET_GRACE_SECONDS || 3600),
  ),
  externalCallbackProtocolGraceSeconds: Math.max(
    60,
    Number(process.env.EXTERNAL_CALLBACK_PROTOCOL_GRACE_SECONDS || 1800),
  ),
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
  agentExecutionMaxAutoRecoveries: Math.max(0, Number(process.env.AGENT_EXECUTION_MAX_AUTO_RECOVERIES || 3)),
  agentExecutionCallbackAutoRemediationMaxAttempts: Math.max(
    1,
    Number(process.env.AGENT_EXECUTION_CALLBACK_AUTO_REMEDIATION_MAX_ATTEMPTS || 3),
  ),
  agentExecutionCallbackAutoRemediationBaseBackoffSeconds: Math.max(
    30,
    Number(process.env.AGENT_EXECUTION_CALLBACK_AUTO_REMEDIATION_BASE_BACKOFF_SECONDS || 300),
  ),
  agentExecutionBillingEnabled: process.env.AGENT_EXECUTION_BILLING_ENABLED?.trim() !== "false",
  agentExecutionBillingCurrency:
    process.env.AGENT_EXECUTION_BILLING_CURRENCY?.trim() === "mira"
      ? "mira"
      : process.env.AGENT_EXECUTION_BILLING_CURRENCY?.trim() === "opinionTickets"
        ? "opinionTickets"
        : "obsidian",
  agentExecutionCostUnitsPerCurrency: Math.max(
    1,
    Number(process.env.AGENT_EXECUTION_COST_UNITS_PER_CURRENCY || 10),
  ),
  agentExecutionRevenueSharePercent: Math.max(
    0,
    Math.min(100, Number(process.env.AGENT_EXECUTION_REVENUE_SHARE_PERCENT || 100)),
  ),
  agentExecutionTreasuryUserId:
    process.env.AGENT_EXECUTION_TREASURY_USER_ID?.trim() || "system:agent-execution-treasury",
  agentExecutionPricingPolicies: parseExecutionPricingPolicies({
    raw: process.env.AGENT_EXECUTION_PRICING_POLICIES_JSON,
    defaultCurrency:
      process.env.AGENT_EXECUTION_BILLING_CURRENCY?.trim() === "mira"
        ? "mira"
        : process.env.AGENT_EXECUTION_BILLING_CURRENCY?.trim() === "opinionTickets"
          ? "opinionTickets"
          : "obsidian",
    defaultCostUnitsPerCurrency: Math.max(1, Number(process.env.AGENT_EXECUTION_COST_UNITS_PER_CURRENCY || 10)),
    defaultRevenueSharePercent: Math.max(
      0,
      Math.min(100, Number(process.env.AGENT_EXECUTION_REVENUE_SHARE_PERCENT || 100)),
    ),
    defaultTreasuryUserId: process.env.AGENT_EXECUTION_TREASURY_USER_ID?.trim() || "system:agent-execution-treasury",
  }),
  agentExecutionRevenueContracts: parseExecutionRevenueContracts({
    raw: process.env.AGENT_EXECUTION_REVENUE_CONTRACTS_JSON,
    defaultRevenueSharePercent: Math.max(
      0,
      Math.min(100, Number(process.env.AGENT_EXECUTION_REVENUE_SHARE_PERCENT || 100)),
    ),
    defaultTreasuryUserId: process.env.AGENT_EXECUTION_TREASURY_USER_ID?.trim() || "system:agent-execution-treasury",
  }),
  agentExecutionRuntimeProfileBudgets: parseRuntimeProfileBudgets(
    process.env.AGENT_EXECUTION_RUNTIME_PROFILE_BUDGETS_JSON,
  ),
  agentExecutionRuntimeProfiles: parseExecutionRuntimeProfiles({
    raw: process.env.AGENT_EXECUTION_RUNTIME_PROFILES_JSON,
    maxAutoRecoveries: Math.max(1, Number(process.env.AGENT_EXECUTION_MAX_AUTO_RECOVERIES || 3)),
    budgets: parseRuntimeProfileBudgets(process.env.AGENT_EXECUTION_RUNTIME_PROFILE_BUDGETS_JSON),
    pricingPolicies: parseExecutionPricingPolicies({
      raw: process.env.AGENT_EXECUTION_PRICING_POLICIES_JSON,
      defaultCurrency:
        process.env.AGENT_EXECUTION_BILLING_CURRENCY?.trim() === "mira"
          ? "mira"
          : process.env.AGENT_EXECUTION_BILLING_CURRENCY?.trim() === "opinionTickets"
            ? "opinionTickets"
            : "obsidian",
      defaultCostUnitsPerCurrency: Math.max(1, Number(process.env.AGENT_EXECUTION_COST_UNITS_PER_CURRENCY || 10)),
      defaultRevenueSharePercent: Math.max(
        0,
        Math.min(100, Number(process.env.AGENT_EXECUTION_REVENUE_SHARE_PERCENT || 100)),
      ),
      defaultTreasuryUserId: process.env.AGENT_EXECUTION_TREASURY_USER_ID?.trim() || "system:agent-execution-treasury",
    }),
    revenueContracts: parseExecutionRevenueContracts({
      raw: process.env.AGENT_EXECUTION_REVENUE_CONTRACTS_JSON,
      defaultRevenueSharePercent: Math.max(
        0,
        Math.min(100, Number(process.env.AGENT_EXECUTION_REVENUE_SHARE_PERCENT || 100)),
      ),
      defaultTreasuryUserId: process.env.AGENT_EXECUTION_TREASURY_USER_ID?.trim() || "system:agent-execution-treasury",
    }),
  }),
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
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
  manualReviewAutoAssignTemplates: parseManualReviewAutoAssignTemplates(
    process.env.MANUAL_REVIEW_AUTO_ASSIGN_TEMPLATES_JSON,
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
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
