import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  getUserProgressionAccessRule,
  getUserProgressionSnapshot,
} from "../../../../packages/account-domain/dist/modules/user-progression/service.js";

import { db } from "@/db/client";
import { env } from "@/env";
import { getExternalCallbackRetryGuidance } from "@/modules/agent-execution/callback-governance";
import {
  buildAgentCallbackCompatibilitySummary,
  getCallbackCompatibilityWindowState,
} from "@/modules/agent-registry/callback-compatibility-analysis";
import { validateManagedHeavyAgentInput } from "@/modules/agent-registry/managed-heavy-validation";
import { agentExecutionCallbackRemediations, agentExecutionCallbacks, agentExecutions } from "@/modules/agent-execution/schema";
import {
  getOwnedAgent,
  getMarketplaceListingByCapability,
  getMarketplaceListingById,
  listAgentsByOwner,
  listCapabilitiesByAgent,
  listCallbackHistoryByAgent,
  listMarketplaceListingsByAgentIds,
} from "@/modules/agent-registry/repository";
import {
  agentCallbackConfigHistory,
  agentCapabilities,
  agentMarketplaceListings,
  agents,
} from "@/modules/agent-registry/schema";
import { ConflictError, HttpError, UnauthorizedError } from "@/platform/errors";
import {
  agentCallbackRemediationPolicyKeys,
  AgentCallbackRemediationPolicyKey,
  AgentCallbackRemediationPolicyView,
  AgentCallbackCompatibilityCleanupResult,
  AgentCallbackCompatibilitySummaryView,
  AgentCallbackCompatibilityWindowState,
  AgentCallbackConfigHistoryView,
  AgentCallbackHealthSummaryView,
  AgentHostingMode,
  AgentMarketplaceBillingMode,
  AgentMarketplaceListingStatus,
  AgentMarketplaceListingView,
  AgentExecutionCallbackRemediationAttemptStatus,
  AgentExecutionCallbackRemediationMode,
  AgentRecentCallbackView,
  AgentSnapshot,
  ProductCurrency,
  UpdateAgentMarketplaceListingStatusInput,
  UpdateAgentCapabilityInput,
  UpdateAgentInput,
  UpsertAgentMarketplaceListingInput,
  UpdateAgentCallbackRemediationPolicyInput,
} from "@neuro/contracts";

type AgentSourceType = "platform" | "external";
type AgentAuthMode = "none" | "apiKey" | "bearer";
type CanonicalAgentHostingMode = "managed_light" | "managed_heavy" | "open_protocol";
type CompatibleAgentHostingMode = AgentHostingMode | CanonicalAgentHostingMode;

export type AgentView = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  sourceType: AgentSourceType;
  hostingMode: CompatibleAgentHostingMode;
  runtimeEndpoint: string | null;
  authMode: AgentAuthMode;
  runtimeAuthTokenPreview: string | null;
  managedServiceId: string | null;
  managedProviderLabel: string | null;
  managedApiBaseUrl: string | null;
  managedModel: string | null;
  managedApiKeyPreview: string | null;
  managedSystemPrompt: string | null;
  managedPromptTemplate: string | null;
  managedTaskCategory: string | null;
  managedCapabilitySummary: string | null;
  externalCallbackConfigured: boolean;
  externalCallbackSecretPreview: string | null;
  externalCallbackRotatedAt: string | null;
  externalCallbackProtocolVersion: number;
  externalCallbackPreviousProtocolVersion: number | null;
  externalCallbackProtocolGraceUntil: string | null;
  externalCallbackProtocolWindowState: AgentCallbackCompatibilityWindowState;
  externalCallbackSecretVersion: number;
  externalCallbackPreviousSecretVersion: number | null;
  externalCallbackSecretGraceUntil: string | null;
  externalCallbackSecretWindowState: AgentCallbackCompatibilityWindowState;
  externalCallbackRemediationPolicyKey: AgentCallbackRemediationPolicyKey;
  externalCallbackRemediationPolicy: AgentCallbackRemediationPolicyView;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentCapabilityView = {
  id: string;
  agentId: string;
  code: string;
  title: string;
  description: string | null;
  routingSummary: string | null;
  routingTags: string[];
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  resourceNormalizationPrompt: string | null;
  pricingNote: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAgentInput = {
  name: string;
  description?: string | null;
  sourceType: AgentSourceType;
  hostingMode?: CompatibleAgentHostingMode;
  runtimeEndpoint?: string | null;
  authMode?: AgentAuthMode;
  runtimeAuthToken?: string | null;
  managedServiceId?: string | null;
  managedProviderLabel?: string | null;
  managedApiBaseUrl?: string | null;
  managedModel?: string | null;
  managedApiKey?: string | null;
  managedSystemPrompt?: string | null;
  managedPromptTemplate?: string | null;
  managedTaskCategory?: string | null;
  managedCapabilitySummary?: string | null;
  enabled?: boolean;
};

export type AddCapabilityInput = {
  code: string;
  title: string;
  description?: string | null;
  routingSummary?: string | null;
  routingTags?: string[] | null;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  resourceNormalizationPrompt?: string | null;
  pricingNote?: string | null;
  enabled?: boolean;
};

export type UpdateCapabilityInput = UpdateAgentCapabilityInput;

function normalizeAgentHostingMode(
  hostingMode: CompatibleAgentHostingMode | null | undefined,
  sourceType: AgentSourceType,
): CanonicalAgentHostingMode {
  if (hostingMode === "managed_heavy" || hostingMode === "registry_only") {
    return "managed_heavy";
  }
  if (hostingMode === "open_protocol" || hostingMode === "external_runtime") {
    return "open_protocol";
  }
  if (hostingMode === "managed_light" || hostingMode === "managed_api") {
    return "managed_light";
  }
  return sourceType === "external" ? "open_protocol" : "managed_heavy";
}

function inferPersistedHostingMode(input: CreateAgentInput): CompatibleAgentHostingMode {
  if (input.hostingMode) {
    return input.hostingMode;
  }
  if (input.sourceType === "external") {
    return "open_protocol";
  }
  if (input.managedApiKey?.trim() && !input.managedServiceId?.trim()) {
    return "managed_api";
  }
  if (
    input.managedServiceId?.trim() ||
    input.managedSystemPrompt?.trim() ||
    input.managedPromptTemplate?.trim() ||
    input.managedTaskCategory?.trim() ||
    input.managedCapabilitySummary?.trim() ||
    input.managedApiBaseUrl?.trim() ||
    input.managedModel?.trim()
  ) {
    return "managed_light";
  }
  return "registry_only";
}

export type UpdateAgentCallbackProtocolInput = {
  protocolVersion: number;
};

const fallbackCallbackRemediationPolicyTemplates: Record<
  AgentCallbackRemediationPolicyKey,
  Omit<AgentCallbackRemediationPolicyView, "maxAttempts" | "baseBackoffSeconds">
> = {
  manual_only: {
    key: "manual_only",
    label: "Manual Only",
    autoRemediationEnabled: false,
    autoReplayStoredPayload: false,
    fallbackRetryRequestEnabled: false,
    replayCompatibilityPolicyKey: "current_only",
    allowedReplayPayloadCompatibilities: ["current"],
    allowReplayFromPreviousProtocolWindow: false,
    allowReplayFromPreviousSecretWindow: false,
    fallbackRetryRequestReplayFailureProfileKey: "none",
    fallbackRetryRequestReplayFailureClasses: [],
    allowedRejectionCategories: [],
    fallbackRetryRequestCategories: [],
    note: "只记录 rejected callback，不触发自动 remediation。",
  },
  safe_retry: {
    key: "safe_retry",
    label: "Safe Retry",
    autoRemediationEnabled: true,
    autoReplayStoredPayload: true,
    fallbackRetryRequestEnabled: false,
    replayCompatibilityPolicyKey: "current_only",
    allowedReplayPayloadCompatibilities: ["current"],
    allowReplayFromPreviousProtocolWindow: false,
    allowReplayFromPreviousSecretWindow: false,
    fallbackRetryRequestReplayFailureProfileKey: "none",
    fallbackRetryRequestReplayFailureClasses: [],
    allowedRejectionCategories: ["processing_conflict"],
    fallbackRetryRequestCategories: [],
    note: "仅自动处理明显幂等冲突型回调，降低误重放风险。",
  },
  balanced: {
    key: "balanced",
    label: "Balanced",
    autoRemediationEnabled: true,
    autoReplayStoredPayload: true,
    fallbackRetryRequestEnabled: true,
    replayCompatibilityPolicyKey: "allow_legacy_payload",
    allowedReplayPayloadCompatibilities: ["current", "legacy_normalized"],
    allowReplayFromPreviousProtocolWindow: false,
    allowReplayFromPreviousSecretWindow: false,
    fallbackRetryRequestReplayFailureProfileKey: "safe_structural",
    fallbackRetryRequestReplayFailureClasses: ["stored_payload_unavailable", "callback_secret_unavailable"],
    allowedRejectionCategories: ["processing_conflict", "invalid_timestamp"],
    fallbackRetryRequestCategories: ["processing_conflict", "invalid_timestamp"],
    note: "默认策略，自动处理短暂冲突和时钟偏移型 rejected callback。",
  },
  aggressive: {
    key: "aggressive",
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
      "stored_payload_unavailable",
      "callback_secret_unavailable",
      "duplicate_replay_cooldown",
    ],
    allowedRejectionCategories: ["processing_conflict", "invalid_timestamp", "invalid_version"],
    fallbackRetryRequestCategories: ["processing_conflict", "invalid_timestamp", "invalid_version"],
    note: "兼容窗口频繁变化时使用，会额外尝试版本失配型重放。",
  },
};

function toCallbackConfigHistoryView(
  row: typeof agentCallbackConfigHistory.$inferSelect,
): AgentCallbackConfigHistoryView {
  return {
    id: row.id,
    agentId: row.agentId,
    actorUserId: row.actorUserId,
    changeType: row.changeType as AgentCallbackConfigHistoryView["changeType"],
    previousProtocolVersion: row.previousProtocolVersion,
    nextProtocolVersion: row.nextProtocolVersion,
    previousSecretVersion: row.previousSecretVersion,
    nextSecretVersion: row.nextSecretVersion,
    graceUntil: row.graceUntil ? row.graceUntil.toISOString() : null,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRecentCallbackView(args: {
  callback: typeof agentExecutionCallbacks.$inferSelect;
  execution: typeof agentExecutions.$inferSelect;
  lastRemediation?: typeof agentExecutionCallbackRemediations.$inferSelect | null;
}): AgentRecentCallbackView {
  const guidance = getExternalCallbackRetryGuidance(
    (args.callback.rejectionCategory as AgentRecentCallbackView["rejectionCategory"]) ?? null,
  );
  return {
    id: args.callback.id,
    agentId: args.callback.agentId,
    executionId: args.callback.executionId,
    executionTitle: args.execution.title,
    executionStatus: args.execution.status as AgentRecentCallbackView["executionStatus"],
    callbackId: args.callback.callbackId,
    callbackType: args.callback.callbackType as AgentRecentCallbackView["callbackType"],
    auditStatus: args.callback.status as AgentRecentCallbackView["auditStatus"],
    callbackVersion: args.callback.callbackVersion,
    secretVersion: args.callback.secretVersion,
    usedPreviousProtocol: args.callback.usedPreviousProtocol,
    usedPreviousSecret: args.callback.usedPreviousSecret,
    callbackTimestamp: args.callback.callbackTimestamp ? args.callback.callbackTimestamp.toISOString() : null,
    rejectionCategory: (args.callback.rejectionCategory as AgentRecentCallbackView["rejectionCategory"]) ?? null,
    retryability: guidance.retryability,
    retryHint: guidance.retryHint,
    payloadSummary: args.callback.payloadSummary,
    receivedAt: args.callback.receivedAt.toISOString(),
    lastRemediationMode: (args.lastRemediation?.mode as AgentExecutionCallbackRemediationMode | null) ?? null,
    lastRemediationStatus:
      (args.lastRemediation?.status as AgentExecutionCallbackRemediationAttemptStatus | null) ?? null,
    lastRemediationAt: args.lastRemediation?.createdAt ? args.lastRemediation.createdAt.toISOString() : null,
  };
}

async function insertCallbackHistoryInTx(
  tx: NodePgDatabase<typeof import("@/db/schema")>,
  input: {
    agentId: string;
    actorUserId: string;
    changeType: AgentCallbackConfigHistoryView["changeType"];
    previousProtocolVersion?: number | null;
    nextProtocolVersion?: number | null;
    previousSecretVersion?: number | null;
    nextSecretVersion?: number | null;
    graceUntil?: Date | null;
    note?: string | null;
  },
) {
  await tx.insert(agentCallbackConfigHistory).values({
    id: crypto.randomUUID(),
    agentId: input.agentId,
    actorUserId: input.actorUserId,
    changeType: input.changeType,
    previousProtocolVersion: input.previousProtocolVersion ?? null,
    nextProtocolVersion: input.nextProtocolVersion ?? null,
    previousSecretVersion: input.previousSecretVersion ?? null,
    nextSecretVersion: input.nextSecretVersion ?? null,
    graceUntil: input.graceUntil ?? null,
    note: input.note ?? null,
    createdAt: now(),
  });
}

function now() {
  return new Date();
}

function toSecretPreview(secret: string | null) {
  if (!secret) return null;
  if (secret.length <= 10) return `${secret.slice(0, 2)}***`;
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

function normalizeRoutingTags(input: string[] | null | undefined) {
  const seen = new Set<string>();
  return (input ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => {
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .slice(0, 24);
}

export function normalizeRemediationPolicyKey(raw: string | null | undefined): AgentCallbackRemediationPolicyKey {
  if (raw === "manual_only" || raw === "safe_retry" || raw === "balanced" || raw === "aggressive") {
    return raw;
  }
  return "balanced";
}

export function buildAgentCallbackRemediationPolicyView(
  policyKey: AgentCallbackRemediationPolicyKey,
): AgentCallbackRemediationPolicyView {
  const template = env.agentCallbackRemediationPolicies[policyKey];
  if (template) {
    return {
      key: policyKey,
      ...template,
    };
  }
  const fallbackTemplate = fallbackCallbackRemediationPolicyTemplates[policyKey];
  return {
    ...fallbackTemplate,
    maxAttempts: env.agentExecutionCallbackAutoRemediationMaxAttempts,
    baseBackoffSeconds: env.agentExecutionCallbackAutoRemediationBaseBackoffSeconds,
  };
}

function validateRemediationPolicyKey(policyKey: AgentCallbackRemediationPolicyKey) {
  if (!env.agentCallbackRemediationPolicies[policyKey] && !fallbackCallbackRemediationPolicyTemplates[policyKey]) {
    throw new HttpError(400, "BAD_REQUEST", "Unknown callback remediation policy");
  }
}

export async function listAgentCallbackRemediationPolicies(
  _userId: string,
): Promise<AgentCallbackRemediationPolicyView[]> {
  return agentCallbackRemediationPolicyKeys.map((key) => buildAgentCallbackRemediationPolicyView(key));
}

function toAgentView(row: typeof agents.$inferSelect): AgentView {
  const protocolWindowState = getCallbackCompatibilityWindowState({
    previousVersion: row.externalCallbackPreviousProtocolVersion,
    graceUntil: row.externalCallbackProtocolGraceUntil,
  });
  const secretWindowState = getCallbackCompatibilityWindowState({
    previousVersion: row.externalCallbackPreviousSecretVersion,
    graceUntil: row.externalCallbackSecretGraceUntil,
  });
  const remediationPolicyKey = normalizeRemediationPolicyKey(row.externalCallbackRemediationPolicy);
  const normalizedHostingMode = normalizeAgentHostingMode(
    (row.hostingMode as CompatibleAgentHostingMode | null | undefined) ?? null,
    row.sourceType as AgentSourceType,
  );
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    description: row.description,
    sourceType: row.sourceType as AgentSourceType,
    hostingMode: normalizedHostingMode,
    runtimeEndpoint: row.runtimeEndpoint,
    authMode: row.authMode as AgentAuthMode,
    runtimeAuthTokenPreview: toSecretPreview(row.runtimeAuthToken ?? null),
    managedServiceId: row.managedServiceId ?? null,
    managedProviderLabel: row.managedProviderLabel ?? null,
    managedApiBaseUrl: row.managedApiBaseUrl ?? null,
    managedModel: row.managedModel ?? null,
    managedApiKeyPreview: toSecretPreview(row.managedApiKey ?? null),
    managedSystemPrompt: row.managedSystemPrompt ?? null,
    managedPromptTemplate: row.managedPromptTemplate ?? null,
    managedTaskCategory: row.managedTaskCategory ?? null,
    managedCapabilitySummary: row.managedCapabilitySummary ?? null,
    externalCallbackConfigured: Boolean(row.externalCallbackSecret),
    externalCallbackSecretPreview: toSecretPreview(row.externalCallbackSecret),
    externalCallbackRotatedAt: row.externalCallbackRotatedAt ? row.externalCallbackRotatedAt.toISOString() : null,
    externalCallbackProtocolVersion: row.externalCallbackProtocolVersion,
    externalCallbackPreviousProtocolVersion: row.externalCallbackPreviousProtocolVersion,
    externalCallbackProtocolGraceUntil: row.externalCallbackProtocolGraceUntil
      ? row.externalCallbackProtocolGraceUntil.toISOString()
      : null,
    externalCallbackProtocolWindowState: protocolWindowState,
    externalCallbackSecretVersion: row.externalCallbackSecretVersion,
    externalCallbackPreviousSecretVersion: row.externalCallbackPreviousSecretVersion,
    externalCallbackSecretGraceUntil: row.externalCallbackSecretGraceUntil
      ? row.externalCallbackSecretGraceUntil.toISOString()
      : null,
    externalCallbackSecretWindowState: secretWindowState,
    externalCallbackRemediationPolicyKey: remediationPolicyKey,
    externalCallbackRemediationPolicy: buildAgentCallbackRemediationPolicyView(remediationPolicyKey),
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCapabilityView(row: typeof agentCapabilities.$inferSelect): AgentCapabilityView {
  return {
    id: row.id,
    agentId: row.agentId,
    code: row.code,
    title: row.title,
    description: row.description,
    routingSummary: row.routingSummary ?? null,
    routingTags: normalizeRoutingTags((row.routingTags as string[] | null | undefined) ?? []),
    inputSchema: (row.inputSchema as Record<string, unknown> | null) ?? null,
    outputSchema: (row.outputSchema as Record<string, unknown> | null) ?? null,
    resourceNormalizationPrompt: row.resourceNormalizationPrompt ?? null,
    pricingNote: row.pricingNote,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMarketplaceListingView(
  row: typeof agentMarketplaceListings.$inferSelect & {
    ownerUserId: string;
    agentName: string;
    agentHostingMode: CompatibleAgentHostingMode;
    capabilityCode: string;
    capabilityTitle: string;
    routingSummary: string | null;
    routingTags: string[] | null;
    inputSchema: Record<string, unknown> | null;
    outputSchema: Record<string, unknown> | null;
  },
): AgentMarketplaceListingView {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    agentName: row.agentName,
    agentHostingMode: normalizeAgentHostingMode(row.agentHostingMode, "platform"),
    capabilityId: row.capabilityId,
    capabilityCode: row.capabilityCode,
    capabilityTitle: row.capabilityTitle,
    routingSummary: row.routingSummary ?? null,
    routingTags: normalizeRoutingTags(row.routingTags ?? []),
    inputSchema: row.inputSchema ?? null,
    outputSchema: row.outputSchema ?? null,
    publicTitle: row.publicTitle,
    publicDescription: row.publicDescription ?? null,
    billingMode: row.billingMode as AgentMarketplaceBillingMode,
    billingUnit: row.billingUnit ?? null,
    meterKey: row.meterKey ?? null,
    priceCurrency: row.priceCurrency as ProductCurrency,
    priceAmount: row.priceAmount,
    status: row.status as AgentMarketplaceListingStatus,
    externalInvocationEnabled: row.externalInvocationEnabled,
    autoTakeEnabled: row.autoTakeEnabled,
    autoTakeStatementTemplate: row.autoTakeStatementTemplate ?? null,
    lastAutoProposalSweepAt: row.lastAutoProposalSweepAt ? row.lastAutoProposalSweepAt.toISOString() : null,
    lastAutoProposalCreatedCount: row.lastAutoProposalCreatedCount ?? 0,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sortSummaryBuckets(bucketMap: Map<string, number>) {
  return [...bucketMap.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function normalizePublicListingAgentIds(agentIds: string[] | null | undefined) {
  const deduped = new Set<string>();
  for (const rawId of agentIds ?? []) {
    const agentId = rawId.trim();
    if (!agentId) {
      continue;
    }
    deduped.add(agentId);
    if (deduped.size >= 24) {
      break;
    }
  }
  return [...deduped];
}

function validateAgentInput(input: CreateAgentInput) {
  const persistedHostingMode = inferPersistedHostingMode(input);
  const hostingMode = normalizeAgentHostingMode(persistedHostingMode, input.sourceType);
  const isLegacyRegistryOnlyCompatibility = persistedHostingMode === "registry_only";
  const isLegacyManagedApiCompatibility = persistedHostingMode === "managed_api";
  if (input.sourceType === "external" && !input.runtimeEndpoint) {
    throw new HttpError(400, "BAD_REQUEST", "External agent requires runtimeEndpoint");
  }
  if (input.sourceType === "platform" && input.runtimeEndpoint) {
    throw new HttpError(400, "BAD_REQUEST", "Platform agent should not set runtimeEndpoint");
  }
  if (persistedHostingMode === "managed_heavy") {
    validateManagedHeavyAgentInput(input);
  }
  if (hostingMode === "managed_light" && input.sourceType !== "platform") {
    throw new HttpError(400, "BAD_REQUEST", "Platform light agents only support platform-owned execution");
  }
  if (hostingMode === "open_protocol" && input.sourceType !== "external") {
    throw new HttpError(400, "BAD_REQUEST", "Open Agent hosting requires an external sourceType");
  }
  if (
    hostingMode === "managed_light" &&
    !isLegacyRegistryOnlyCompatibility &&
    !isLegacyManagedApiCompatibility &&
    !input.managedServiceId?.trim()
  ) {
    throw new HttpError(400, "BAD_REQUEST", "Platform light agent requires a bound AI service");
  }
  if (hostingMode === "managed_light" && !input.managedTaskCategory?.trim()) {
    throw new HttpError(400, "BAD_REQUEST", "Platform light agent requires a task category");
  }
  if (hostingMode === "managed_light" && !input.managedCapabilitySummary?.trim()) {
    throw new HttpError(400, "BAD_REQUEST", "Platform light agent requires a capability summary");
  }
  if (hostingMode === "managed_light" && !isLegacyRegistryOnlyCompatibility && !input.managedPromptTemplate) {
    throw new HttpError(400, "BAD_REQUEST", "Platform light agent requires a prompt template");
  }
  if (input.authMode && input.authMode !== "none" && !input.runtimeAuthToken?.trim()) {
    throw new HttpError(400, "BAD_REQUEST", "Selected runtime auth mode requires a runtime auth token");
  }
}

function validateListingInput(input: UpsertAgentMarketplaceListingInput) {
  if (!input.capabilityId?.trim()) {
    throw new HttpError(400, "BAD_REQUEST", "Capability is required");
  }
  if (!input.publicTitle?.trim()) {
    throw new HttpError(400, "BAD_REQUEST", "Public title is required");
  }
  if (!Number.isInteger(input.priceAmount) || input.priceAmount <= 0) {
    throw new HttpError(400, "BAD_REQUEST", "Price amount must be a positive integer");
  }
}

function validateProtocolVersion(protocolVersion: number) {
  if (!Number.isInteger(protocolVersion) || protocolVersion < 1 || protocolVersion > 10) {
    throw new HttpError(400, "BAD_REQUEST", "Callback protocol version must be an integer between 1 and 10");
  }
}

function isPlatformOperator(userId: string) {
  return env.platformOperatorUserIds.includes(userId);
}

function generateExternalCallbackSecret() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

export async function listOwnedAgents(ownerUserId: string): Promise<AgentView[]> {
  const rows = await listAgentsByOwner(ownerUserId);
  return rows.map(toAgentView);
}

/**
 * Internal resolver for server-side heavy-chat execution. The raw row is kept
 * inside Core so credential fields never cross the HTTP or browser boundary.
 */
export async function resolveOwnedAgentForHeavyChat(ownerUserId: string, agentId: string) {
  const agent = await getOwnedAgent(ownerUserId, agentId);
  if (!agent) return null;
  return {
    ...agent,
    hostingMode: normalizeAgentHostingMode(
      (agent.hostingMode as CompatibleAgentHostingMode | null | undefined) ?? null,
      agent.sourceType as AgentSourceType,
    ),
  };
}

export async function getAgentCallbackCompatibilitySummaryForOperator(
  operatorUserId: string,
): Promise<AgentCallbackCompatibilitySummaryView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view callback compatibility summary");
  }

  const rows = await db.select().from(agents).where(eq(agents.sourceType, "external"));
  return buildAgentCallbackCompatibilitySummary(rows);
}

export async function createOwnedAgent(ownerUserId: string, input: CreateAgentInput): Promise<AgentView> {
  validateAgentInput(input);
  const currentTime = now();
  try {
    const created = await db.transaction(async (tx) => {
      if (!isPlatformOperator(ownerUserId)) {
        const owner = await tx.query.users.findFirst({
          where: (row, operators) => operators.eq(row.id, ownerUserId),
        });
        if (!owner) {
          throw new UnauthorizedError("当前用户不存在，无法创建 Agent");
        }
        const progression = await getUserProgressionSnapshot(
          {
            userId: owner.id,
            trustLevel: owner.trustLevel,
          },
          tx,
        );
        const accessRule = getUserProgressionAccessRule(
          progression,
          input.sourceType === "external" ? "createExternalAgent" : "createPlatformAgent",
        );
        if (!accessRule.satisfied) {
          throw new UnauthorizedError(accessRule.note);
        }
      }

      const [createdRow] = await tx
        .insert(agents)
        .values({
          id: crypto.randomUUID(),
          ownerUserId,
          name: input.name,
          description: input.description ?? null,
          sourceType: input.sourceType,
          hostingMode: inferPersistedHostingMode(input),
          runtimeEndpoint: input.runtimeEndpoint ?? null,
          authMode: input.authMode ?? "none",
          runtimeAuthToken: input.runtimeAuthToken?.trim() || null,
          managedServiceId: input.managedServiceId?.trim() || null,
          managedProviderLabel: input.managedProviderLabel ?? null,
          managedApiBaseUrl: input.managedApiBaseUrl ?? null,
          managedModel: input.managedModel ?? null,
          managedApiKey: input.managedApiKey ?? null,
          managedSystemPrompt: input.managedSystemPrompt ?? null,
          managedPromptTemplate: input.managedPromptTemplate ?? null,
          managedTaskCategory: input.managedTaskCategory?.trim() || null,
          managedCapabilitySummary: input.managedCapabilitySummary?.trim() || null,
          externalCallbackSecret: input.sourceType === "external" ? generateExternalCallbackSecret() : null,
          externalCallbackRotatedAt: input.sourceType === "external" ? currentTime : null,
          externalCallbackProtocolVersion: 1,
          externalCallbackPreviousProtocolVersion: null,
          externalCallbackProtocolGraceUntil: null,
          externalCallbackSecretVersion: 1,
          externalCallbackRemediationPolicy: input.sourceType === "external" ? "balanced" : "manual_only",
          enabled: input.enabled ?? true,
          createdAt: currentTime,
          updatedAt: currentTime,
        })
        .returning();

      if (createdRow.sourceType === "external") {
        await insertCallbackHistoryInTx(tx, {
          agentId: createdRow.id,
          actorUserId: ownerUserId,
          changeType: "agent_created",
          previousProtocolVersion: null,
          nextProtocolVersion: createdRow.externalCallbackProtocolVersion,
          previousSecretVersion: null,
          nextSecretVersion: createdRow.externalCallbackSecretVersion,
          graceUntil: null,
          note: "External agent initialized with first callback protocol and secret.",
        });
      }

      return createdRow;
    });

    return toAgentView(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(`Agent 名称 '${input.name}' 已存在`);
    }
    throw error;
  }
}

export async function updateOwnedAgent(
  ownerUserId: string,
  agentId: string,
  input: UpdateAgentInput,
): Promise<AgentView> {
  const agent = await assertOwnedAgent(ownerUserId, agentId);
  const mergedInput: CreateAgentInput = {
    name: input.name,
    description: input.description !== undefined ? input.description : agent.description,
    sourceType: agent.sourceType as AgentSourceType,
    hostingMode: agent.hostingMode as CompatibleAgentHostingMode,
    runtimeEndpoint: input.runtimeEndpoint !== undefined ? input.runtimeEndpoint : agent.runtimeEndpoint,
    authMode: input.authMode ?? (agent.authMode as AgentAuthMode),
    runtimeAuthToken: input.runtimeAuthToken !== undefined ? input.runtimeAuthToken : agent.runtimeAuthToken,
    managedServiceId: input.managedServiceId !== undefined ? input.managedServiceId : agent.managedServiceId,
    managedProviderLabel:
      input.managedProviderLabel !== undefined ? input.managedProviderLabel : agent.managedProviderLabel,
    managedApiBaseUrl: input.managedApiBaseUrl !== undefined ? input.managedApiBaseUrl : agent.managedApiBaseUrl,
    managedModel: input.managedModel !== undefined ? input.managedModel : agent.managedModel,
    managedApiKey: input.managedApiKey !== undefined ? input.managedApiKey : agent.managedApiKey,
    managedSystemPrompt:
      input.managedSystemPrompt !== undefined ? input.managedSystemPrompt : agent.managedSystemPrompt,
    managedPromptTemplate:
      input.managedPromptTemplate !== undefined ? input.managedPromptTemplate : agent.managedPromptTemplate,
    managedTaskCategory:
      input.managedTaskCategory !== undefined ? input.managedTaskCategory : agent.managedTaskCategory,
    managedCapabilitySummary:
      input.managedCapabilitySummary !== undefined
        ? input.managedCapabilitySummary
        : agent.managedCapabilitySummary,
    enabled: input.enabled ?? agent.enabled,
  };
  validateAgentInput(mergedInput);
  const currentTime = now();

  try {
    const [updatedRow] = await db
      .update(agents)
      .set({
        name: mergedInput.name.trim(),
        description: mergedInput.description?.trim() || null,
        hostingMode: inferPersistedHostingMode(mergedInput),
        runtimeEndpoint: mergedInput.runtimeEndpoint?.trim() || null,
        authMode: mergedInput.authMode ?? "none",
        runtimeAuthToken: mergedInput.runtimeAuthToken?.trim() || null,
        managedServiceId: mergedInput.managedServiceId?.trim() || null,
        managedProviderLabel: mergedInput.managedProviderLabel?.trim() || null,
        managedApiBaseUrl: mergedInput.managedApiBaseUrl?.trim() || null,
        managedModel: mergedInput.managedModel?.trim() || null,
        managedSystemPrompt: mergedInput.managedSystemPrompt ?? null,
        managedPromptTemplate: mergedInput.managedPromptTemplate ?? null,
        managedTaskCategory: mergedInput.managedTaskCategory?.trim() || null,
        managedCapabilitySummary: mergedInput.managedCapabilitySummary?.trim() || null,
        enabled: mergedInput.enabled ?? true,
        updatedAt: currentTime,
      })
      .where(eq(agents.id, agent.id))
      .returning();

    return toAgentView(updatedRow);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(`Agent 名称 '${input.name}' 已存在`);
    }
    throw error;
  }
}

export async function deleteOwnedAgent(
  ownerUserId: string,
  agentId: string,
): Promise<{ deletedAgentId: string; deletedAgentName: string }> {
  const agent = await assertOwnedAgent(ownerUserId, agentId);

  await db.delete(agents).where(eq(agents.id, agent.id));

  return {
    deletedAgentId: agent.id,
    deletedAgentName: agent.name,
  };
}

async function assertOwnedAgent(ownerUserId: string, agentId: string) {
  const agent = await getOwnedAgent(ownerUserId, agentId);
  if (!agent) {
    throw new HttpError(404, "NOT_FOUND", "Agent not found or not owned by current user");
  }
  return agent;
}

async function assertOwnedCapability(ownerUserId: string, capabilityId: string) {
  const [row] = await db
    .select({
      capability: agentCapabilities,
      agent: agents,
    })
    .from(agentCapabilities)
    .innerJoin(agents, eq(agentCapabilities.agentId, agents.id))
    .where(and(eq(agentCapabilities.id, capabilityId), eq(agents.ownerUserId, ownerUserId)));

  if (!row) {
    throw new HttpError(404, "NOT_FOUND", "Capability not found or not owned by current user");
  }

  return row;
}

export async function rotateOwnedAgentCallbackSecret(
  ownerUserId: string,
  agentId: string,
): Promise<{ agent: AgentView; callbackSecret: string }> {
  const agent = await assertOwnedAgent(ownerUserId, agentId);
  if (agent.sourceType !== "external") {
    throw new HttpError(400, "BAD_REQUEST", "Only external agents support callback secret rotation");
  }

  const callbackSecret = generateExternalCallbackSecret();
  const currentTime = now();
  const previousSecret = agent.externalCallbackSecret ?? null;
  const previousSecretVersion = agent.externalCallbackSecretVersion ?? null;
  const graceUntil =
    previousSecret && previousSecretVersion
      ? new Date(currentTime.getTime() + env.externalCallbackSecretGraceSeconds * 1000)
      : null;
  const updated = await db.transaction(async (tx) => {
    const [updatedRow] = await tx
      .update(agents)
      .set({
        externalCallbackSecret: callbackSecret,
        externalCallbackRotatedAt: currentTime,
        externalCallbackSecretVersion: agent.externalCallbackSecretVersion + 1,
        externalCallbackPreviousSecret: previousSecret,
        externalCallbackPreviousSecretVersion: previousSecretVersion,
        externalCallbackSecretGraceUntil: graceUntil,
        updatedAt: currentTime,
      })
      .where(eq(agents.id, agent.id))
      .returning();

    await insertCallbackHistoryInTx(tx, {
      agentId: agent.id,
      actorUserId: ownerUserId,
      changeType: "secret_rotated",
      previousProtocolVersion: updatedRow.externalCallbackProtocolVersion,
      nextProtocolVersion: updatedRow.externalCallbackProtocolVersion,
      previousSecretVersion: previousSecretVersion,
      nextSecretVersion: updatedRow.externalCallbackSecretVersion,
      graceUntil,
      note: "Callback secret rotated; previous secret remains valid during grace window.",
    });

    return updatedRow;
  });

  return {
    agent: toAgentView(updated),
    callbackSecret,
  };
}

export async function updateOwnedAgentCallbackProtocolVersion(
  ownerUserId: string,
  agentId: string,
  input: UpdateAgentCallbackProtocolInput,
): Promise<AgentView> {
  const agent = await assertOwnedAgent(ownerUserId, agentId);
  if (agent.sourceType !== "external") {
    throw new HttpError(400, "BAD_REQUEST", "Only external agents support callback protocol versioning");
  }

  validateProtocolVersion(input.protocolVersion);
  if (agent.externalCallbackProtocolVersion === input.protocolVersion) {
    return toAgentView(agent);
  }
  const currentTime = now();
  const protocolGraceUntil = new Date(currentTime.getTime() + env.externalCallbackProtocolGraceSeconds * 1000);
  const updated = await db.transaction(async (tx) => {
    const [updatedRow] = await tx
      .update(agents)
      .set({
        externalCallbackProtocolVersion: input.protocolVersion,
        externalCallbackPreviousProtocolVersion: agent.externalCallbackProtocolVersion,
        externalCallbackProtocolGraceUntil: protocolGraceUntil,
        updatedAt: currentTime,
      })
      .where(eq(agents.id, agent.id))
      .returning();

    await insertCallbackHistoryInTx(tx, {
      agentId: agent.id,
      actorUserId: ownerUserId,
      changeType: "protocol_updated",
      previousProtocolVersion: agent.externalCallbackProtocolVersion,
      nextProtocolVersion: updatedRow.externalCallbackProtocolVersion,
      previousSecretVersion: updatedRow.externalCallbackSecretVersion,
      nextSecretVersion: updatedRow.externalCallbackSecretVersion,
      graceUntil: protocolGraceUntil,
      note: "Owner updated callback protocol version; previous protocol remains valid during grace window.",
    });

    return updatedRow;
  });

  return toAgentView(updated);
}

export async function updateOwnedAgentCallbackRemediationPolicy(
  ownerUserId: string,
  agentId: string,
  input: UpdateAgentCallbackRemediationPolicyInput,
): Promise<AgentView> {
  const agent = await assertOwnedAgent(ownerUserId, agentId);
  if (agent.sourceType !== "external") {
    throw new HttpError(400, "BAD_REQUEST", "Only external agents support callback remediation policy");
  }

  validateRemediationPolicyKey(input.policyKey);
  const nextPolicyKey = normalizeRemediationPolicyKey(input.policyKey);
  if (normalizeRemediationPolicyKey(agent.externalCallbackRemediationPolicy) === nextPolicyKey) {
    return toAgentView(agent);
  }

  const currentTime = now();
  const updated = await db.transaction(async (tx) => {
    const [updatedRow] = await tx
      .update(agents)
      .set({
        externalCallbackRemediationPolicy: nextPolicyKey,
        updatedAt: currentTime,
      })
      .where(eq(agents.id, agent.id))
      .returning();

    await insertCallbackHistoryInTx(tx, {
      agentId: agent.id,
      actorUserId: ownerUserId,
      changeType: "remediation_policy_updated",
      previousProtocolVersion: updatedRow.externalCallbackProtocolVersion,
      nextProtocolVersion: updatedRow.externalCallbackProtocolVersion,
      previousSecretVersion: updatedRow.externalCallbackSecretVersion,
      nextSecretVersion: updatedRow.externalCallbackSecretVersion,
      graceUntil: null,
      note: `Callback remediation policy changed to ${nextPolicyKey}.`,
    });

    return updatedRow;
  });

  return toAgentView(updated);
}

export async function listOwnedAgentCapabilities(
  ownerUserId: string,
  agentId: string,
): Promise<AgentCapabilityView[]> {
  await assertOwnedAgent(ownerUserId, agentId);
  const rows = await listCapabilitiesByAgent(agentId);
  return rows.map(toCapabilityView);
}

export async function addCapabilityToOwnedAgent(
  ownerUserId: string,
  agentId: string,
  input: AddCapabilityInput,
): Promise<AgentCapabilityView> {
  const agent = await assertOwnedAgent(ownerUserId, agentId);
  const normalizedHostingMode = normalizeAgentHostingMode(
    agent.hostingMode as CompatibleAgentHostingMode,
    agent.sourceType as AgentSourceType,
  );
  if (normalizedHostingMode === "managed_light") {
    const existingCapabilities = await listCapabilitiesByAgent(agentId);
    if (existingCapabilities.length > 0) {
      throw new HttpError(409, "CONFLICT", "羽量 Agent 当前只允许定义一个任务能力");
    }
    if (!input.routingSummary?.trim()) {
      throw new HttpError(400, "BAD_REQUEST", "羽量 Agent 任务能力需要填写路由描述");
    }
    if (!input.inputSchema || Object.keys(input.inputSchema).length === 0) {
      throw new HttpError(400, "BAD_REQUEST", "羽量 Agent 任务能力需要声明输入资源");
    }
    if (!input.outputSchema || Object.keys(input.outputSchema).length === 0) {
      throw new HttpError(400, "BAD_REQUEST", "羽量 Agent 任务能力需要声明输出资源");
    }
  }
  const currentTime = now();

  const existing = await db
    .select()
    .from(agentCapabilities)
    .where(and(eq(agentCapabilities.agentId, agentId), eq(agentCapabilities.code, input.code)));
  if (existing.length > 0) {
    throw new HttpError(409, "CONFLICT", `Capability code '${input.code}' already exists for this agent`);
  }

  try {
    const [created] = await db
      .insert(agentCapabilities)
      .values({
        id: crypto.randomUUID(),
        agentId,
        code: input.code,
        title: input.title,
        description: input.description ?? null,
        routingSummary: input.routingSummary?.trim() || null,
        routingTags: normalizeRoutingTags(input.routingTags),
        inputSchema: input.inputSchema ?? null,
        outputSchema: input.outputSchema ?? null,
        resourceNormalizationPrompt: input.resourceNormalizationPrompt?.trim() || null,
        pricingNote: input.pricingNote ?? null,
        enabled: input.enabled ?? true,
        createdAt: currentTime,
        updatedAt: currentTime,
      })
      .returning();

    return toCapabilityView(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(`Capability code '${input.code}' already exists for this agent`);
    }
    throw error;
  }
}

export async function updateOwnedAgentCapability(
  ownerUserId: string,
  agentId: string,
  capabilityId: string,
  input: UpdateCapabilityInput,
): Promise<AgentCapabilityView> {
  const { capability, agent } = await assertOwnedCapability(ownerUserId, capabilityId);
  if (capability.agentId !== agentId) {
    throw new HttpError(404, "NOT_FOUND", "Capability not found or not owned by current user");
  }
  const normalizedHostingMode = normalizeAgentHostingMode(
    agent.hostingMode as CompatibleAgentHostingMode,
    agent.sourceType as AgentSourceType,
  );
  if (!input.title?.trim()) {
    throw new HttpError(400, "BAD_REQUEST", "Capability title is required");
  }
  if (normalizedHostingMode === "managed_light") {
    if (!input.routingSummary?.trim()) {
      throw new HttpError(400, "BAD_REQUEST", "羽量 Agent 任务能力需要填写路由描述");
    }
    if (!input.inputSchema || Object.keys(input.inputSchema).length === 0) {
      throw new HttpError(400, "BAD_REQUEST", "羽量 Agent 任务能力需要声明输入资源");
    }
    if (!input.outputSchema || Object.keys(input.outputSchema).length === 0) {
      throw new HttpError(400, "BAD_REQUEST", "羽量 Agent 任务能力需要声明输出资源");
    }
  }

  const [updated] = await db
    .update(agentCapabilities)
    .set({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      routingSummary: input.routingSummary?.trim() || null,
      routingTags: normalizeRoutingTags(input.routingTags),
      inputSchema: input.inputSchema ?? null,
      outputSchema: input.outputSchema ?? null,
      resourceNormalizationPrompt: input.resourceNormalizationPrompt?.trim() || null,
      pricingNote: input.pricingNote?.trim() || null,
      enabled: input.enabled ?? capability.enabled,
      updatedAt: now(),
    })
    .where(eq(agentCapabilities.id, capability.id))
    .returning();

  return toCapabilityView(updated);
}

async function getMarketplaceListingViewById(listingId: string): Promise<AgentMarketplaceListingView> {
  const [row] = await db
    .select({
      listing: agentMarketplaceListings,
      ownerUserId: agents.ownerUserId,
      agentName: agents.name,
      agentHostingMode: agents.hostingMode,
      capabilityCode: agentCapabilities.code,
      capabilityTitle: agentCapabilities.title,
      routingSummary: agentCapabilities.routingSummary,
      routingTags: agentCapabilities.routingTags,
      inputSchema: agentCapabilities.inputSchema,
      outputSchema: agentCapabilities.outputSchema,
    })
    .from(agentMarketplaceListings)
    .innerJoin(agents, eq(agentMarketplaceListings.agentId, agents.id))
    .innerJoin(agentCapabilities, eq(agentMarketplaceListings.capabilityId, agentCapabilities.id))
    .where(eq(agentMarketplaceListings.id, listingId));

  if (!row) {
    throw new HttpError(404, "NOT_FOUND", "Agent marketplace listing not found");
  }

  return toMarketplaceListingView({
      ...row.listing,
      ownerUserId: row.ownerUserId,
      agentName: row.agentName,
      agentHostingMode: row.agentHostingMode as CompatibleAgentHostingMode,
      capabilityCode: row.capabilityCode,
      capabilityTitle: row.capabilityTitle,
      routingSummary: row.routingSummary ?? null,
      routingTags: (row.routingTags as string[] | null) ?? [],
      inputSchema: (row.inputSchema as Record<string, unknown> | null) ?? null,
      outputSchema: (row.outputSchema as Record<string, unknown> | null) ?? null,
    });
}

export async function listOwnedAgentMarketplaceListings(ownerUserId: string): Promise<AgentMarketplaceListingView[]> {
  const ownedAgents = await listAgentsByOwner(ownerUserId);
  if (ownedAgents.length === 0) {
    return [];
  }

  const listings = await listMarketplaceListingsByAgentIds(ownedAgents.map((agent) => agent.id));
  if (listings.length === 0) {
    return [];
  }

  const capabilityIds = listings.map((listing) => listing.capabilityId);
  const capabilities = await db
    .select()
    .from(agentCapabilities)
    .where(inArray(agentCapabilities.id, capabilityIds));

  const agentById = new Map(ownedAgents.map((agent) => [agent.id, agent]));
  const capabilityById = new Map(capabilities.map((capability) => [capability.id, capability]));

  return listings
    .map((listing) => {
      const agent = agentById.get(listing.agentId);
      const capability = capabilityById.get(listing.capabilityId);
      if (!agent || !capability) {
        return null;
      }
      return toMarketplaceListingView({
        ...listing,
        ownerUserId,
        agentName: agent.name,
        agentHostingMode: agent.hostingMode as CompatibleAgentHostingMode,
        capabilityCode: capability.code,
        capabilityTitle: capability.title,
        routingSummary: capability.routingSummary ?? null,
        routingTags: (capability.routingTags as string[] | null) ?? [],
        inputSchema: (capability.inputSchema as Record<string, unknown> | null) ?? null,
        outputSchema: (capability.outputSchema as Record<string, unknown> | null) ?? null,
      });
    })
    .filter((listing): listing is AgentMarketplaceListingView => Boolean(listing));
}

export async function listPublicAgentMarketplaceListings(
  args: number | { limit?: number; agentIds?: string[]; perAgentLimit?: number } = 24,
): Promise<AgentMarketplaceListingView[]> {
  const query = typeof args === "number" ? { limit: args } : args;
  const normalizedAgentIds = normalizePublicListingAgentIds(query.agentIds);
  const perAgentLimit = Math.max(1, Math.min(query.perAgentLimit ?? 2, 6));
  const conditions = [
    eq(agentMarketplaceListings.status, "published"),
    eq(agents.enabled, true),
    eq(agentCapabilities.enabled, true),
  ];

  if (normalizedAgentIds.length > 0) {
    conditions.push(inArray(agentMarketplaceListings.agentId, normalizedAgentIds));
  }

  const queryLimit =
    normalizedAgentIds.length > 0
      ? Math.max(24, Math.min(normalizedAgentIds.length * perAgentLimit * 8, 240))
      : Math.max(1, Math.min(query.limit ?? 24, 60));

  const rows = await db
    .select({
      listing: agentMarketplaceListings,
      ownerUserId: agents.ownerUserId,
      agentName: agents.name,
      agentHostingMode: agents.hostingMode,
      capabilityCode: agentCapabilities.code,
      capabilityTitle: agentCapabilities.title,
      routingSummary: agentCapabilities.routingSummary,
      routingTags: agentCapabilities.routingTags,
      inputSchema: agentCapabilities.inputSchema,
      outputSchema: agentCapabilities.outputSchema,
    })
    .from(agentMarketplaceListings)
    .innerJoin(agents, eq(agentMarketplaceListings.agentId, agents.id))
    .innerJoin(agentCapabilities, eq(agentMarketplaceListings.capabilityId, agentCapabilities.id))
    .where(and(...conditions))
    .orderBy(desc(agentMarketplaceListings.publishedAt), desc(agentMarketplaceListings.updatedAt))
    .limit(queryLimit);

  const listings = rows.map((row) =>
    toMarketplaceListingView({
      ...row.listing,
      ownerUserId: row.ownerUserId,
      agentName: row.agentName,
      agentHostingMode: row.agentHostingMode as CompatibleAgentHostingMode,
      capabilityCode: row.capabilityCode,
      capabilityTitle: row.capabilityTitle,
      routingSummary: row.routingSummary ?? null,
      routingTags: (row.routingTags as string[] | null) ?? [],
      inputSchema: (row.inputSchema as Record<string, unknown> | null) ?? null,
      outputSchema: (row.outputSchema as Record<string, unknown> | null) ?? null,
    }),
  );

  if (normalizedAgentIds.length === 0) {
    return listings;
  }

  const listingsByAgentId = new Map<string, AgentMarketplaceListingView[]>();
  for (const listing of listings) {
    const bucket = listingsByAgentId.get(listing.agentId) ?? [];
    if (bucket.length >= perAgentLimit) {
      continue;
    }
    bucket.push(listing);
    listingsByAgentId.set(listing.agentId, bucket);
  }

  return normalizedAgentIds.flatMap((agentId) => listingsByAgentId.get(agentId) ?? []);
}

export async function upsertOwnedAgentMarketplaceListing(
  ownerUserId: string,
  input: UpsertAgentMarketplaceListingInput,
): Promise<AgentMarketplaceListingView> {
  validateListingInput(input);
  const { capability, agent } = await assertOwnedCapability(ownerUserId, input.capabilityId);
  const nextStatus = input.status ?? "draft";

  if (nextStatus === "published" && (!agent.enabled || !capability.enabled)) {
    throw new HttpError(400, "BAD_REQUEST", "Published listing requires both agent and capability to be enabled");
  }

  const currentTime = now();
  const existing = await getMarketplaceListingByCapability(input.capabilityId);
  const publishedAt =
    nextStatus === "published"
      ? existing?.publishedAt ?? currentTime
      : nextStatus === "paused"
        ? existing?.publishedAt ?? currentTime
        : null;

  if (existing) {
    await db
      .update(agentMarketplaceListings)
      .set({
        publicTitle: input.publicTitle.trim(),
        publicDescription: input.publicDescription?.trim() || null,
        billingMode: input.billingMode ?? "flat_task",
        billingUnit: input.billingUnit?.trim() || null,
        meterKey: input.meterKey?.trim() || null,
        priceCurrency: input.priceCurrency,
        priceAmount: input.priceAmount,
        status: nextStatus,
        externalInvocationEnabled: input.externalInvocationEnabled ?? false,
        autoTakeEnabled: input.autoTakeEnabled ?? false,
        autoTakeStatementTemplate: input.autoTakeStatementTemplate?.trim() || null,
        publishedAt,
        updatedAt: currentTime,
      })
      .where(eq(agentMarketplaceListings.id, existing.id));

    return getMarketplaceListingViewById(existing.id);
  }

  const [created] = await db
    .insert(agentMarketplaceListings)
    .values({
      id: crypto.randomUUID(),
      agentId: agent.id,
      capabilityId: capability.id,
      publicTitle: input.publicTitle.trim(),
      publicDescription: input.publicDescription?.trim() || null,
      billingMode: input.billingMode ?? "flat_task",
      billingUnit: input.billingUnit?.trim() || null,
      meterKey: input.meterKey?.trim() || null,
      priceCurrency: input.priceCurrency,
      priceAmount: input.priceAmount,
      status: nextStatus,
      externalInvocationEnabled: input.externalInvocationEnabled ?? false,
      autoTakeEnabled: input.autoTakeEnabled ?? false,
      autoTakeStatementTemplate: input.autoTakeStatementTemplate?.trim() || null,
      lastAutoProposalSweepAt: null,
      lastAutoProposalCreatedCount: 0,
      publishedAt,
      createdAt: currentTime,
      updatedAt: currentTime,
    })
    .returning();

  return getMarketplaceListingViewById(created.id);
}

export async function updateOwnedAgentMarketplaceListingStatus(
  ownerUserId: string,
  listingId: string,
  input: UpdateAgentMarketplaceListingStatusInput,
): Promise<AgentMarketplaceListingView> {
  const listing = await getMarketplaceListingById(listingId);
  if (!listing) {
    throw new HttpError(404, "NOT_FOUND", "Agent marketplace listing not found");
  }

  const agent = await assertOwnedAgent(ownerUserId, listing.agentId);
  if (!agent) {
    throw new HttpError(404, "NOT_FOUND", "Agent marketplace listing not found");
  }

  await db
    .update(agentMarketplaceListings)
    .set({
      status: input.status,
      publishedAt:
        input.status === "published"
          ? listing.publishedAt ?? now()
          : input.status === "draft"
            ? null
            : listing.publishedAt,
      updatedAt: now(),
    })
    .where(eq(agentMarketplaceListings.id, listingId));

  return getMarketplaceListingViewById(listingId);
}

export async function recordOwnedAgentMarketplaceSweepResult(
  ownerUserId: string,
  listingId: string,
  createdProposalCount: number,
): Promise<void> {
  const listingView = await getMarketplaceListingViewById(listingId);
  if (listingView.ownerUserId !== ownerUserId) {
    throw new UnauthorizedError("Current user cannot update this listing");
  }

  await db
    .update(agentMarketplaceListings)
    .set({
      lastAutoProposalSweepAt: now(),
      lastAutoProposalCreatedCount: Math.max(0, createdProposalCount),
      updatedAt: now(),
    })
    .where(eq(agentMarketplaceListings.id, listingId));
}

export async function getEnabledCapabilityCodeMapInTx(
  tx: NodePgDatabase<typeof import("@/db/schema")>,
  agentIds: string[],
) {
  if (agentIds.length === 0) {
    return new Map<string, string[]>();
  }

  const rows = await tx
    .select({
      agentId: agentCapabilities.agentId,
      code: agentCapabilities.code,
    })
    .from(agentCapabilities)
    .where(and(inArray(agentCapabilities.agentId, agentIds), eq(agentCapabilities.enabled, true)));

  const codeMap = new Map<string, string[]>();
  for (const row of rows) {
    const existing = codeMap.get(row.agentId) ?? [];
    existing.push(row.code);
    codeMap.set(row.agentId, existing);
  }

  return codeMap;
}

export async function getEnabledCapabilityCodeMap(agentIds: string[]) {
  return getEnabledCapabilityCodeMapInTx(db, agentIds);
}

export async function getEnabledAgentIdSetInTx(
  tx: NodePgDatabase<typeof import("@/db/schema")>,
  agentIds: string[],
) {
  if (agentIds.length === 0) {
    return new Set<string>();
  }

  const rows = await tx
    .select({ id: agents.id })
    .from(agents)
    .where(and(inArray(agents.id, agentIds), eq(agents.enabled, true)));

  return new Set(rows.map((row) => row.id));
}

export async function getAgentSnapshot(ownerUserId: string): Promise<AgentSnapshot> {
  const [totalRow] = await db
    .select({ total: count(agents.id) })
    .from(agents)
    .where(eq(agents.ownerUserId, ownerUserId));
  const [enabledRow] = await db
    .select({ total: count(agents.id) })
    .from(agents)
    .where(and(eq(agents.ownerUserId, ownerUserId), eq(agents.enabled, true)));
  const [externalRow] = await db
    .select({ total: count(agents.id) })
    .from(agents)
    .where(and(eq(agents.ownerUserId, ownerUserId), eq(agents.sourceType, "external")));
  const [capabilityRow] = await db
    .select({ total: count(agentCapabilities.id) })
    .from(agentCapabilities)
    .innerJoin(agents, eq(agentCapabilities.agentId, agents.id))
    .where(eq(agents.ownerUserId, ownerUserId));
  const [activeExecutionRow] = await db
    .select({ total: count(agentExecutions.id) })
    .from(agentExecutions)
    .where(
      and(
        eq(agentExecutions.ownerUserId, ownerUserId),
        inArray(agentExecutions.status, ["queued", "running", "submitted"]),
      ),
    );

  return {
    totalAgents: Number(totalRow?.total ?? 0),
    enabledAgents: Number(enabledRow?.total ?? 0),
    externalAgents: Number(externalRow?.total ?? 0),
    capabilityCount: Number(capabilityRow?.total ?? 0),
    activeExecutions: Number(activeExecutionRow?.total ?? 0),
  };
}

export async function listOwnedAgentCallbackHistory(ownerUserId: string, agentId: string, limit = 20) {
  await assertOwnedAgent(ownerUserId, agentId);
  const rows = await listCallbackHistoryByAgent(agentId, limit);
  return rows.map(toCallbackConfigHistoryView);
}

export async function listOperatorAgentCallbackHistory(operatorUserId: string, agentId: string, limit = 20) {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view agent callback history");
  }
  const rows = await listCallbackHistoryByAgent(agentId, limit);
  return rows.map(toCallbackConfigHistoryView);
}

export async function listOwnedAgentCallbackHealthSummaries(
  ownerUserId: string,
  windowHours = 168,
): Promise<AgentCallbackHealthSummaryView[]> {
  const agentsRows = await listAgentsByOwner(ownerUserId);
  const externalAgents = agentsRows.filter((row) => row.sourceType === "external");
  if (externalAgents.length === 0) {
    return [];
  }

  const clampedWindowHours = Math.max(1, Math.min(windowHours, 24 * 30));
  const windowStart = new Date(now().getTime() - clampedWindowHours * 60 * 60 * 1000);
  const rows = await db
    .select({
      agentId: agentExecutionCallbacks.agentId,
      callbackType: agentExecutionCallbacks.callbackType,
      status: agentExecutionCallbacks.status,
      usedPreviousProtocol: agentExecutionCallbacks.usedPreviousProtocol,
      usedPreviousSecret: agentExecutionCallbacks.usedPreviousSecret,
      receivedAt: agentExecutionCallbacks.receivedAt,
    })
    .from(agentExecutionCallbacks)
    .where(
      and(
        inArray(
          agentExecutionCallbacks.agentId,
          externalAgents.map((row) => row.id),
        ),
      ),
    );

  const summaryByAgent = new Map<
    string,
    {
      totalCallbacks: number;
      acceptedCallbacks: number;
      duplicateCallbacks: number;
      rejectedCallbacks: number;
      currentProtocolHits: number;
      previousProtocolHits: number;
      currentSecretHits: number;
      previousSecretHits: number;
      lastReceivedAt: Date | null;
      byCallbackType: Map<string, number>;
    }
  >();

  for (const agent of externalAgents) {
    summaryByAgent.set(agent.id, {
      totalCallbacks: 0,
      acceptedCallbacks: 0,
      duplicateCallbacks: 0,
      rejectedCallbacks: 0,
      currentProtocolHits: 0,
      previousProtocolHits: 0,
      currentSecretHits: 0,
      previousSecretHits: 0,
      lastReceivedAt: null,
      byCallbackType: new Map<string, number>(),
    });
  }

  for (const row of rows) {
    if (row.receivedAt.getTime() < windowStart.getTime()) {
      continue;
    }
    const summary = summaryByAgent.get(row.agentId);
    if (!summary) continue;
    summary.totalCallbacks += 1;
    if (row.status === "accepted") {
      summary.acceptedCallbacks += 1;
    } else if (row.status === "duplicate") {
      summary.duplicateCallbacks += 1;
    } else {
      summary.rejectedCallbacks += 1;
    }
    if (row.usedPreviousProtocol) {
      summary.previousProtocolHits += 1;
    } else {
      summary.currentProtocolHits += 1;
    }
    if (row.usedPreviousSecret) {
      summary.previousSecretHits += 1;
    } else {
      summary.currentSecretHits += 1;
    }
    summary.byCallbackType.set(
      row.callbackType,
      (summary.byCallbackType.get(row.callbackType) ?? 0) + 1,
    );
    if (!summary.lastReceivedAt || row.receivedAt.getTime() > summary.lastReceivedAt.getTime()) {
      summary.lastReceivedAt = row.receivedAt;
    }
  }

  return externalAgents.map((agent) => {
    const summary = summaryByAgent.get(agent.id)!;
    return {
      agentId: agent.id,
      windowHours: clampedWindowHours,
      totalCallbacks: summary.totalCallbacks,
      acceptedCallbacks: summary.acceptedCallbacks,
      duplicateCallbacks: summary.duplicateCallbacks,
      rejectedCallbacks: summary.rejectedCallbacks,
      currentProtocolHits: summary.currentProtocolHits,
      previousProtocolHits: summary.previousProtocolHits,
      currentSecretHits: summary.currentSecretHits,
      previousSecretHits: summary.previousSecretHits,
      lastReceivedAt: summary.lastReceivedAt ? summary.lastReceivedAt.toISOString() : null,
      byCallbackType: sortSummaryBuckets(summary.byCallbackType),
    };
  });
}

export async function listOwnedAgentRecentCallbacks(
  ownerUserId: string,
  agentId: string,
  limit = 10,
): Promise<AgentRecentCallbackView[]> {
  const agent = await assertOwnedAgent(ownerUserId, agentId);
  if (agent.sourceType !== "external") {
    return [];
  }

  const clampedLimit = Math.max(1, Math.min(limit, 50));
  const rows = await db
    .select({
      callback: agentExecutionCallbacks,
      execution: agentExecutions,
    })
    .from(agentExecutionCallbacks)
    .innerJoin(agentExecutions, eq(agentExecutionCallbacks.executionId, agentExecutions.id))
    .where(eq(agentExecutionCallbacks.agentId, agentId))
    .orderBy(desc(agentExecutionCallbacks.receivedAt))
    .limit(clampedLimit);

  const callbackIds = rows.map((row) => row.callback.id);
  const remediationRows =
    callbackIds.length > 0
      ? await db
          .select()
          .from(agentExecutionCallbackRemediations)
          .where(inArray(agentExecutionCallbackRemediations.callbackAuditId, callbackIds))
          .orderBy(desc(agentExecutionCallbackRemediations.createdAt))
      : [];

  const latestRemediationByCallbackId = new Map<string, typeof agentExecutionCallbackRemediations.$inferSelect>();
  for (const remediation of remediationRows) {
    if (!latestRemediationByCallbackId.has(remediation.callbackAuditId)) {
      latestRemediationByCallbackId.set(remediation.callbackAuditId, remediation);
    }
  }

  return rows.map((row) =>
    toRecentCallbackView({
      ...row,
      lastRemediation: latestRemediationByCallbackId.get(row.callback.id) ?? null,
    }),
  );
}

export async function cleanupExpiredAgentCallbackCompatibility(args?: {
  limit?: number;
  actorUserId?: string | null;
}): Promise<AgentCallbackCompatibilityCleanupResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 25, 100));
  const referenceTime = now();
  const rows = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.sourceType, "external"),
        or(
          and(
            sql`${agents.externalCallbackPreviousProtocolVersion} is not null`,
            sql`${agents.externalCallbackProtocolGraceUntil} is not null`,
            sql`${agents.externalCallbackProtocolGraceUntil} < now()`,
          ),
          and(
            sql`${agents.externalCallbackPreviousSecretVersion} is not null`,
            sql`${agents.externalCallbackSecretGraceUntil} is not null`,
            sql`${agents.externalCallbackSecretGraceUntil} < now()`,
          ),
        ),
      ),
    )
    .orderBy(desc(agents.updatedAt))
    .limit(limit);

  let protocolClearedCount = 0;
  let secretClearedCount = 0;
  const cleanedAgents: AgentCallbackCompatibilityCleanupResult["cleanedAgents"] = [];

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const protocolExpired =
        getCallbackCompatibilityWindowState({
          previousVersion: row.externalCallbackPreviousProtocolVersion,
          graceUntil: row.externalCallbackProtocolGraceUntil,
          referenceTime,
        }) === "expired";
      const secretExpired =
        getCallbackCompatibilityWindowState({
          previousVersion: row.externalCallbackPreviousSecretVersion,
          graceUntil: row.externalCallbackSecretGraceUntil,
          referenceTime,
        }) === "expired";

      if (!protocolExpired && !secretExpired) {
        continue;
      }

      const [updated] = await tx
        .update(agents)
        .set({
          externalCallbackPreviousProtocolVersion: protocolExpired ? null : row.externalCallbackPreviousProtocolVersion,
          externalCallbackProtocolGraceUntil: protocolExpired ? null : row.externalCallbackProtocolGraceUntil,
          externalCallbackPreviousSecret: secretExpired ? null : row.externalCallbackPreviousSecret,
          externalCallbackPreviousSecretVersion: secretExpired ? null : row.externalCallbackPreviousSecretVersion,
          externalCallbackSecretGraceUntil: secretExpired ? null : row.externalCallbackSecretGraceUntil,
          updatedAt: referenceTime,
        })
        .where(eq(agents.id, row.id))
        .returning();

      if (args?.actorUserId) {
        const notes = [
          protocolExpired ? "Cleared expired previous protocol compatibility window." : null,
          secretExpired ? "Cleared expired previous secret compatibility window." : null,
        ]
          .filter(Boolean)
          .join(" ");
        await insertCallbackHistoryInTx(tx, {
          agentId: row.id,
          actorUserId: args.actorUserId,
          changeType: "compatibility_cleaned",
          previousProtocolVersion: protocolExpired ? row.externalCallbackPreviousProtocolVersion : null,
          nextProtocolVersion: updated.externalCallbackProtocolVersion,
          previousSecretVersion: secretExpired ? row.externalCallbackPreviousSecretVersion : null,
          nextSecretVersion: updated.externalCallbackSecretVersion,
          graceUntil: null,
          note: notes || "Expired callback compatibility windows were cleared.",
        });
      }

      if (protocolExpired) {
        protocolClearedCount += 1;
      }
      if (secretExpired) {
        secretClearedCount += 1;
      }
      cleanedAgents.push({
        agentId: row.id,
        ownerUserId: row.ownerUserId,
        protocolCleared: protocolExpired,
        secretCleared: secretExpired,
      });
    }
  });

  return {
    cleanedCount: cleanedAgents.length,
    protocolClearedCount,
    secretClearedCount,
    cleanedAgents,
  };
}
