import type {
  AddAgentExecutionArtifactInput,
  CurrencyKey,
  AgentHostingMode,
  AgentMarketplaceBillingMode,
  AgentMarketplaceInvocationSnapshotView,
  AgentExecutionCallbackAuditStatus,
  AgentExecutionCallbackAutoRemediationState,
  AgentExecutionCallbackAutoRemediationReasonCategory,
  AgentExecutionCallbackAutoRemediationReasonDisposition,
  AgentCallbackRemediationPolicyKey,
  AgentExecutionCallbackRemediationAttemptStatus,
  AgentExecutionCallbackRemediationAttemptView,
  AgentExecutionCallbackRemediationMode,
  AgentExecutionCallbackAutoRemediationResult,
  AgentExecutionCallbackRemediationAlertDispatchResult,
  AgentExecutionCallbackRemediationAlertView,
  AgentExecutionCallbackRemediationDecisionClass,
  AgentExecutionCallbackRemediationSummaryView,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackReplayResult,
  AgentExecutionCallbackRetryBatchResult,
  AgentExecutionCallbackRetryRequestResult,
  AgentExecutionCallbackRejectionCategory,
  AgentExecutionCallbackType,
  AgentExecutionCallbackRetryability,
  AgentExecutionCallbackAuditSummaryView,
  AgentExecutionCallbackAuditView,
  AgentExecutionCallbackRuntimeContextView,
  AgentExecutionArtifactKind,
  AgentExecutionArtifactView,
  AgentExecutionLaunchPresetView,
  AgentExecutionOutputEnvelope,
  AgentExecutionOutputKind,
  AgentExecutionPricingPolicyView,
  AgentExecutionObjectiveChecklistEntry,
  AgentExecutionRevenueContractView,
  AgentExecutionRuntimeCatalogView,
  AgentExecutionRuntimePressureAlertDispatchResult,
  AgentExecutionRuntimePressureAlertSummaryView,
  AgentExecutionRuntimePressureAlertView,
  AgentExecutionRuntimeDecisionClass,
  AgentExecutionRuntimeDecisionSeverity,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeProfileKey,
  AgentExecutionRuntimeProfileView,
  AgentExecutionRecentWindowKey,
  AgentExecutionRuntimeSchedulingDecisionClass,
  AgentExecutionStoredReplayPayloadCompatibility,
  AgentExecutionRuntimeSessionState,
  AgentExecutionRuntimeSessionKind,
  AgentExecutionRuntimeSessionView,
  AgentExecutionRunFailureCategory,
  AgentExecutionOperatorRunSummaryView,
  AgentExecutionOperatorRunView,
  AgentExecutionStepKind,
  AgentExecutionStepStatus,
  AgentExecutionRuntimeSessionSummaryView,
  AgentExecutionRuntimeSessionSweepResult,
  AgentExecutionSettlementAttemptStatus,
  AgentExecutionSettlementAttemptView,
  AgentExecutionSettlementLineItemKind,
  AgentExecutionSettlementLineItemView,
  AgentExecutionSettlementSummaryView,
  AgentExecutionSettlementStatus,
  AgentExecutionSettlementView,
  AgentExecutionLaunchPresetFocusSection,
  AgentExecutionRunKind,
  AgentExecutionStepView,
  AgentExecutionSubtaskStatus,
  AgentExecutionSubtaskView,
  AgentExecutionRunView,
  AgentExecutionRunStatus,
  AgentExecutionStatus,
  AgentExecutionView,
  AgentSourceType,
  BenefitServiceApiAccessView,
  CreateAgentExecutionInput,
  CreateAgentExecutionLaunchPresetInput,
  CreateAgentExecutionSubtaskInput,
  ExternalAgentCallbackInput,
  InvokeAgentMarketplaceListingInput,
  InvokeAgentMarketplaceListingResult,
  ListAgentExecutionLaunchPresetsInput,
  PlatformExecutionPhase,
  ProductCurrency,
  UpdateAgentExecutionLaunchPresetInput,
  UpdateAgentExecutionCallbackRemediationPolicyInput,
  UpdateAgentExecutionSubtaskStatusInput,
  UpdateAgentExecutionStatusInput,
} from "@neuro/contracts";
import { and, asc, desc, eq, gte, inArray, max, or, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { transferBalance } from "../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  buildStoredExternalCallbackReplayEnvelope,
  classifyExternalCallbackRejection,
  getRejectionCategoriesForRetryability,
  getExternalCallbackRetryGuidance,
  resolveStoredExternalCallbackReplayEnvelope,
  resolveExternalCallbackCompatibility,
  resolveExternalCallbackMatch,
  type StoredExternalCallbackReplayEnvelope,
  summarizeExternalCallbackPayload,
} from "@/modules/agent-execution/callback-governance";
import {
  buildAutoRemediationReasonBuckets,
  classifyAutoRemediationReasonCategory,
  getAutoRemediationReasonFilterPatterns,
  getAutoRemediationReasonDisposition,
  listAutoRemediationReasonCategoriesForDisposition,
} from "@/modules/agent-execution/auto-remediation-analysis";
import {
  buildCallbackRemediationPlan,
  classifyReplayFailureForRetryFallback,
  shouldFallbackReplayFailureToRetryRequestByPolicy,
} from "@/modules/agent-execution/callback-remediation-plan";
import {
  buildArtifactRuntimeDecision,
  buildFinalizeCompletedRuntimeDecision,
  buildFinalizeRuntimeDecision,
  buildPrepareRuntimeDecision,
  resolveRuntimeDecisionFromPayload,
} from "@/modules/agent-execution/runtime-decision";
import { buildRuntimeProfileUtilizationView } from "@/modules/agent-execution/runtime-scheduling";
import { buildCallbackAuditRecommendations } from "@/modules/agent-execution/operator-callback-analysis";
import {
  buildCallbackRemediationRuntimeCorrelationSummary,
  buildCallbackRemediationAlertBuckets,
  buildCallbackRemediationAlerts,
  buildCallbackRemediationRecommendations,
} from "@/modules/agent-execution/operator-remediation-analysis";
import {
  buildExecutionRunRecommendations,
  classifyExecutionRunFailure,
  getRecentWindowInterval,
  toExecutionPhaseBucket,
} from "@/modules/agent-execution/operator-run-analysis";
import { buildRuntimeSessionRecommendations } from "@/modules/agent-execution/operator-runtime-session-analysis";
import {
  buildRuntimePressureAlertBuckets,
  buildRuntimePressureAlerts,
} from "@/modules/agent-execution/operator-runtime-analysis";
import {
  getExternalAgentExecution,
  getAgentExecutionById,
  getAgentExecutionLaunchDefaultPreset,
  getOwnedAgentExecution,
  getOwnedAgentExecutionLaunchPreset,
  listArtifactsByExecutionIds,
  listAgentExecutionLaunchPresetsByOwner,
  listCallbacksByExecutionIds,
  listRuntimeSessionsByExecutionIds,
  listRunsByExecutionIds,
  listStepsByExecutionIds,
  listSubtasksByExecutionIds,
  getOwnedRunnableAgent,
  listAgentExecutionsByOwner,
  listSuppliedMarketplaceAgentExecutions,
} from "@/modules/agent-execution/repository";
import {
  agentExecutionArtifacts,
  agentExecutionCallbacks,
  agentExecutionLaunchDefaultPresets,
  agentExecutionCallbackRemediations,
  agentExecutionLaunchPresets,
  agentExecutionRuntimeSessions,
  agentExecutionRuns,
  agentExecutionSettlementLineItems,
  agentExecutionSettlementAttempts,
  agentExecutionSettlements,
  agentExecutionSteps,
  agentExecutionSubtasks,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { getMarketplaceListingDetailById, getOwnedAgent } from "@/modules/agent-registry/repository";
import {
  buildAgentCallbackRemediationPolicyView,
  normalizeRemediationPolicyKey,
} from "@/modules/agent-registry/service";
import { agentCapabilities, agents } from "@/modules/agent-registry/schema";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { outboxEvents } from "@/platform/outbox/schema";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

const transitionMap: Record<AgentExecutionStatus, AgentExecutionStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["submitted", "completed", "failed", "cancelled"],
  submitted: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const subtaskTransitionMap: Record<AgentExecutionSubtaskStatus, AgentExecutionSubtaskStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const terminalExecutionStatuses = new Set<AgentExecutionStatus>(["completed", "failed", "cancelled"]);

const externalCallbackPendingTtlSeconds = 5 * 60;
const externalCallbackProcessedTtlSeconds = 24 * 60 * 60;
const platformRuntimeLoopLockKey = "agent-execution:platform-runtime-loop";
const platformRuntimeLoopLockTtlSeconds = 30;
const automaticCallbackRemediationActorId = "system:callback-auto-remediation";
const callbackRemediationAlertEventName = "agentExecution.callbackRemediationAlerted";
const runtimePressureAlertEventName = "agentExecution.runtimePressureAlerted";

const runtimeSubtaskPhaseOrder: Array<PlatformExecutionPhase | null> = ["prepare", "produce_artifact", "finalize", null, null];
const managedApiDispatchTimeoutMs = 90_000;
const externalRuntimeDispatchTimeoutMs = 30_000;
const accountInternalUrl = process.env.ACCOUNT_INTERNAL_URL?.trim() || process.env.ACCOUNT_API_INTERNAL_URL?.trim() || null;

type StoredMarketplaceInvocationSnapshot = {
  listingId: string;
  supplierUserId: string;
  capabilityId: string;
  capabilityCode: string;
  capabilityTitle: string;
  publicTitle: string;
  billingMode: AgentMarketplaceBillingMode;
  billingUnit: string | null;
  meterKey: string | null;
  meterQuantity: number;
  priceCurrency: ProductCurrency;
  unitPriceAmount: number;
  quotedAmount: number;
  invokedAt: string;
};

type RuntimeDispatchResult = {
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  message: string | null;
  executionId: string;
};

type CallbackAuditOperatorQuery = {
  agentId?: string;
  callbackType?: AgentExecutionCallbackType;
  status?: AgentExecutionCallbackAuditStatus;
  remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
  callbackVersion?: number;
  secretVersion?: number;
  protocolMatch?: "current" | "previous";
  secretMatch?: "current" | "previous";
  rejectionCategory?: AgentExecutionCallbackRejectionCategory;
  retryability?: AgentExecutionCallbackRetryability;
  autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
  autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
  replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
  replayPayloadReplayable?: boolean;
  decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
  replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
  runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
  runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
  runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
  runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
  limit?: number;
};

type ExecutionRunOperatorQuery = {
  agentId?: string;
  ownerUserId?: string;
  executionIds?: string[];
  runIds?: string[];
  runKind?: AgentExecutionRunView["runKind"];
  runStatus?: AgentExecutionRunStatus;
  executionStatus?: AgentExecutionStatus;
  failureCategory?: AgentExecutionRunFailureCategory;
  recentWindow?: AgentExecutionRecentWindowKey;
  limit?: number;
};

type CallbackRemediationSummaryQuery = {
  agentId?: string;
  callbackType?: AgentExecutionCallbackType;
  remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
  autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
  autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
  replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
  replayPayloadReplayable?: boolean;
  decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
  replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
  runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
  runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
  runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
  runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
};

type CallbackRemediationAlertEmitQuery = CallbackRemediationSummaryQuery & {
  limit?: number;
  minimumAlertLevel?: number;
};

type RuntimePressureAlertSummaryQuery = {
  pressureLevel?: AgentExecutionRuntimePressureLevel;
  schedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
};

type RuntimePressureAlertEmitQuery = RuntimePressureAlertSummaryQuery & {
  limit?: number;
  minimumAlertLevel?: number;
};

type ExecutionCallbackRemediationPolicyMetadata = {
  agentSourceType: AgentSourceType;
  key: AgentCallbackRemediationPolicyKey;
  source: "agent" | "execution";
  overrideKey: AgentCallbackRemediationPolicyKey | null;
  policy: ReturnType<typeof buildAgentCallbackRemediationPolicyView>;
};

function now() {
  return new Date();
}

function normalizeMarketplaceMeterQuantity(raw: number | null | undefined) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

function toStoredMarketplaceInvocationSnapshot(
  snapshot: AgentMarketplaceInvocationSnapshotView | StoredMarketplaceInvocationSnapshot | unknown,
): StoredMarketplaceInvocationSnapshot | null {
  if (!snapshot) return null;
  const normalized =
    toMarketplaceInvocationSnapshotView(snapshot) ??
    (snapshot as AgentMarketplaceInvocationSnapshotView | StoredMarketplaceInvocationSnapshot);
  return {
    listingId: normalized.listingId,
    supplierUserId: normalized.supplierUserId,
    capabilityId: normalized.capabilityId,
    capabilityCode: normalized.capabilityCode,
    capabilityTitle: normalized.capabilityTitle,
    publicTitle: normalized.publicTitle,
    billingMode: normalized.billingMode,
    billingUnit: normalized.billingUnit ?? null,
    meterKey: normalized.meterKey ?? null,
    meterQuantity: normalizeMarketplaceMeterQuantity(normalized.meterQuantity),
    priceCurrency: normalized.priceCurrency,
    unitPriceAmount: Math.max(1, Math.floor(normalized.unitPriceAmount)),
    quotedAmount: Math.max(1, Math.floor(normalized.quotedAmount)),
    invokedAt: normalized.invokedAt,
  };
}

function toMarketplaceInvocationSnapshotView(
  value: unknown,
): AgentMarketplaceInvocationSnapshotView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StoredMarketplaceInvocationSnapshot>;
  if (
    !row.listingId ||
    !row.supplierUserId ||
    !row.capabilityId ||
    !row.capabilityCode ||
    !row.capabilityTitle ||
    !row.publicTitle ||
    !row.billingMode ||
    !row.priceCurrency ||
    !row.invokedAt
  ) {
    return null;
  }
  return {
    listingId: row.listingId,
    supplierUserId: row.supplierUserId,
    capabilityId: row.capabilityId,
    capabilityCode: row.capabilityCode,
    capabilityTitle: row.capabilityTitle,
    publicTitle: row.publicTitle,
    billingMode: row.billingMode,
    billingUnit: row.billingUnit ?? null,
    meterKey: row.meterKey ?? null,
    meterQuantity: normalizeMarketplaceMeterQuantity(row.meterQuantity ?? 1),
    priceCurrency: row.priceCurrency,
    unitPriceAmount: Math.max(1, Math.floor(Number(row.unitPriceAmount ?? 1))),
    quotedAmount: Math.max(1, Math.floor(Number(row.quotedAmount ?? 1))),
    invokedAt: row.invokedAt,
  };
}

function buildRuntimeAuthHeaders(
  authMode: "none" | "apiKey" | "bearer",
  token: string | null | undefined,
): Record<string, string> {
  if (!token?.trim() || authMode === "none") {
    return {};
  }
  if (authMode === "bearer") {
    return {
      authorization: `Bearer ${token.trim()}`,
    };
  }
  return {
    "x-api-key": token.trim(),
  };
}

function resolveManagedApiEndpoint(baseUrl: string | null | undefined) {
  const normalizedBaseUrl = baseUrl?.trim();
  if (!normalizedBaseUrl) {
    throw new ConflictError("Managed API base URL is missing");
  }
  if (normalizedBaseUrl.endsWith("/chat/completions") || normalizedBaseUrl.endsWith("/responses")) {
    return normalizedBaseUrl;
  }
  return `${normalizedBaseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function renderManagedPromptTemplate(
  template: string,
  args: {
    executionTitle: string;
    objective: string;
    publicTitle: string | null;
    capabilityCode: string | null;
    capabilityTitle: string | null;
    quotedAmount: number | null;
    priceCurrency: ProductCurrency | null;
    billingMode: AgentMarketplaceBillingMode | null;
    billingUnit: string | null;
    meterQuantity: number | null;
    managedTaskCategory?: string | null;
    managedCapabilitySummary?: string | null;
    routingSummary?: string | null;
    routingTags?: string[] | null;
    inputSchema?: Record<string, unknown> | null;
    outputSchema?: Record<string, unknown> | null;
    inputResourcePayload?: Record<string, unknown> | null;
    normalizedResourcePayload?: Record<string, unknown> | null;
  },
) {
  const replacements = new Map<string, string>([
    ["title", args.executionTitle],
    ["objective", args.objective],
    ["publicTitle", args.publicTitle ?? ""],
    ["capabilityCode", args.capabilityCode ?? ""],
    ["capabilityTitle", args.capabilityTitle ?? ""],
    ["quotedAmount", args.quotedAmount ? String(args.quotedAmount) : ""],
    ["priceCurrency", args.priceCurrency ?? ""],
    ["billingMode", args.billingMode ?? ""],
    ["billingUnit", args.billingUnit ?? ""],
    ["meterQuantity", args.meterQuantity ? String(args.meterQuantity) : ""],
    ["taskCategory", args.managedTaskCategory ?? ""],
    ["capabilitySummary", args.managedCapabilitySummary ?? ""],
    ["routingSummary", args.routingSummary ?? ""],
    ["routingTags", (args.routingTags ?? []).join(", ")],
    ["routing_tags", safeJsonStringify(args.routingTags ?? [])],
    ["input_schema_json", safeJsonStringify(args.inputSchema)],
    ["output_schema_json", safeJsonStringify(args.outputSchema)],
    ["resource_json", safeJsonStringify(args.inputResourcePayload)],
    ["input_resource_json", safeJsonStringify(args.inputResourcePayload)],
    ["normalized_resource_json", safeJsonStringify(args.normalizedResourcePayload)],
  ]);

  addPromptPayloadReplacements(replacements, "input", args.inputResourcePayload);
  addPromptPayloadReplacements(replacements, "normalized", args.normalizedResourcePayload);

  let rendered = template;
  for (const [key, value] of replacements.entries()) {
    rendered = rendered
      .replaceAll(`{${key}}`, value)
      .replaceAll(`{{${key}}}`, value);
  }
  rendered = applySchemaMarkerReplacements(
    rendered,
    args.inputSchema,
    args.normalizedResourcePayload ?? args.inputResourcePayload ?? null,
  );
  return rendered.trim();
}

function safeJsonStringify(value: unknown) {
  if (value == null) {
    return "{}";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function addPromptPayloadReplacements(
  replacements: Map<string, string>,
  prefix: "input" | "normalized",
  payload: Record<string, unknown> | null | undefined,
  path: string = prefix,
) {
  if (!payload) {
    return;
  }
  for (const [key, rawValue] of Object.entries(payload)) {
    const nextPath = `${path}.${key}`;
    if (rawValue == null) {
      replacements.set(nextPath, "");
      continue;
    }
    if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      replacements.set(nextPath, String(rawValue));
      continue;
    }
    if (Array.isArray(rawValue)) {
      replacements.set(nextPath, safeJsonStringify(rawValue));
      continue;
    }
    if (typeof rawValue === "object") {
      replacements.set(nextPath, safeJsonStringify(rawValue));
      addPromptPayloadReplacements(replacements, prefix, rawValue as Record<string, unknown>, nextPath);
    }
  }
}

function stringifyPromptTemplateValue(value: unknown) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return safeJsonStringify(value);
}

function getSchemaDefaultResourceValue(schemaValue: Record<string, unknown>) {
  const defaultResource = schemaValue["x-openagent-default-resource"];
  if (!defaultResource || typeof defaultResource !== "object" || Array.isArray(defaultResource)) {
    return "";
  }
  const kind = typeof (defaultResource as Record<string, unknown>).kind === "string"
    ? String((defaultResource as Record<string, unknown>).kind)
    : "";
  if (kind === "text") {
    return stringifyPromptTemplateValue((defaultResource as Record<string, unknown>).value);
  }
  if (kind === "file") {
    const dataUrl = typeof (defaultResource as Record<string, unknown>).dataUrl === "string"
      ? String((defaultResource as Record<string, unknown>).dataUrl)
      : "";
    if (dataUrl) {
      return dataUrl;
    }
    const fileName = typeof (defaultResource as Record<string, unknown>).fileName === "string"
      ? String((defaultResource as Record<string, unknown>).fileName)
      : "";
    return fileName;
  }
  return "";
}

function getSchemaProperties(schema: Record<string, unknown> | null | undefined) {
  const properties = schema?.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return null;
  }
  return properties as Record<string, unknown>;
}

function applySchemaMarkerReplacements(
  template: string,
  schema: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown> | null | undefined,
) {
  if (!payload) {
    return template;
  }
  const properties = getSchemaProperties(schema);
  if (!properties) {
    return template;
  }
  let rendered = template;
  for (const [propertyKey, schemaValue] of Object.entries(properties)) {
    if (!schemaValue || typeof schemaValue !== "object" || Array.isArray(schemaValue)) {
      continue;
    }
    const marker = typeof (schemaValue as Record<string, unknown>)["x-openagent-marker"] === "string"
      ? String((schemaValue as Record<string, unknown>)["x-openagent-marker"]).trim()
      : "";
    if (!marker) {
      continue;
    }
    const nextValue =
      payload[propertyKey] == null
        ? getSchemaDefaultResourceValue(schemaValue as Record<string, unknown>)
        : stringifyPromptTemplateValue(payload[propertyKey]);
    rendered = rendered
      .replaceAll(`#$${marker}$#`, nextValue)
      .replaceAll(marker, nextValue);
  }
  return rendered;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function parseJsonSafely(response: Response) {
  const rawText = await response.text();
  if (!rawText.trim()) {
    return null;
  }
  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return {
      rawText,
    };
  }
}

function toRecordPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function extractJsonObjectFromText(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const direct = tryParseJsonObject(trimmed);
  if (direct) {
    return direct;
  }

  const firstBraceIndex = trimmed.indexOf("{");
  const lastBraceIndex = trimmed.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return tryParseJsonObject(trimmed.slice(firstBraceIndex, lastBraceIndex + 1));
  }
  return null;
}

function tryParseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return toRecordPayload(parsed);
  } catch {
    return null;
  }
}

async function resolveManagedLightServiceAccess(args: {
  ownerUserId: string;
  serviceId: string;
}): Promise<BenefitServiceApiAccessView> {
  if (!accountInternalUrl) {
    throw new ConflictError("ACCOUNT_INTERNAL_URL is not configured for managed light service access");
  }
  const response = await fetchWithTimeout(
    `${accountInternalUrl}/v1/benefits/services/${encodeURIComponent(args.serviceId)}/api-access`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-api-token": env.internalApiToken,
        "x-neuro-user-id": args.ownerUserId,
      },
      body: JSON.stringify({}),
    },
    managedApiDispatchTimeoutMs,
  );
  const payload = (await parseJsonSafely(response)) as
    | { access?: BenefitServiceApiAccessView; error?: { message?: string } | string }
    | null;
  if (!response.ok || !payload?.access) {
    const message =
      (typeof payload?.error === "string" ? payload.error : payload?.error?.message) ||
      "Failed to resolve managed light AI service access";
    throw new ConflictError(message);
  }
  return payload.access;
}

function extractManagedApiText(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const text = content
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const textValue = (item as { text?: unknown }).text;
          return typeof textValue === "string" ? textValue : "";
        })
        .join("")
        .trim();
      if (text) return text;
    }
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const combined = output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) return [];
      return content
        .map((contentItem) => {
          if (!contentItem || typeof contentItem !== "object") return "";
          const textValue = (contentItem as { text?: unknown }).text;
          return typeof textValue === "string" ? textValue : "";
        })
        .filter(Boolean);
    })
    .join("")
    .trim();
  return combined || null;
}

function extractManagedApiUsageTotals(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const usage = payload.usage;
  if (!usage || typeof usage !== "object") return null;
  const promptTokens = Number((usage as { prompt_tokens?: unknown }).prompt_tokens ?? 0);
  const completionTokens = Number((usage as { completion_tokens?: unknown }).completion_tokens ?? 0);
  const totalTokens = Number(
    (usage as { total_tokens?: unknown }).total_tokens ??
      (Number.isFinite(promptTokens) ? promptTokens : 0) + (Number.isFinite(completionTokens) ? completionTokens : 0),
  );
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
    return null;
  }
  return {
    promptTokens: Number.isFinite(promptTokens) ? Math.max(0, Math.floor(promptTokens)) : 0,
    completionTokens: Number.isFinite(completionTokens) ? Math.max(0, Math.floor(completionTokens)) : 0,
    totalTokens: Math.max(1, Math.floor(totalTokens)),
  };
}

function mergeManagedApiUsageTotals(
  ...usages: Array<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>
) {
  const aggregated = usages.reduce<{ promptTokens: number; completionTokens: number; totalTokens: number }>(
    (sum, usage) => {
      if (!usage) {
        return sum;
      }
      return {
        promptTokens: sum.promptTokens + Math.max(0, usage.promptTokens),
        completionTokens: sum.completionTokens + Math.max(0, usage.completionTokens),
        totalTokens: sum.totalTokens + Math.max(0, usage.totalTokens),
      };
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );
  if (aggregated.totalTokens <= 0) {
    return null;
  }
  return aggregated;
}

async function invokeManagedLightModel(args: {
  endpoint: string;
  apiKey: string | null | undefined;
  model: string;
  systemPrompt?: string | null;
  userPrompt: string;
}) {
  const requestBody = args.endpoint.endsWith("/responses")
    ? {
        model: args.model,
        input: [
          ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
          { role: "user", content: args.userPrompt },
        ],
      }
    : {
        model: args.model,
        messages: [
          ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
          { role: "user", content: args.userPrompt },
        ],
      };

  const response = await fetchWithTimeout(
    args.endpoint,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...buildRuntimeAuthHeaders("bearer", args.apiKey),
      },
      body: JSON.stringify(requestBody),
    },
    managedApiDispatchTimeoutMs,
  );

  const payload = await parseJsonSafely(response);
  const text = extractManagedApiText(payload);
  const usageTotals = extractManagedApiUsageTotals(payload);

  return {
    response,
    payload,
    text,
    usageTotals,
  };
}

function resolveTokenMeterQuantity(totalTokens: number, billingUnit: string | null | undefined) {
  const normalizedUnit = billingUnit?.trim().toLowerCase() ?? "";
  if (!normalizedUnit || normalizedUnit === "token" || normalizedUnit === "tokens") {
    return Math.max(1, totalTokens);
  }

  const matchedUnit = normalizedUnit.match(/^(\d+)\s*_?tokens?$/);
  if (matchedUnit) {
    const divisor = Math.max(1, Number(matchedUnit[1]));
    return Math.max(1, Math.ceil(totalTokens / divisor));
  }

  const matchedKUnit = normalizedUnit.match(/^(\d+)k\s*_?tokens?$/);
  if (matchedKUnit) {
    const divisor = Math.max(1, Number(matchedKUnit[1]) * 1000);
    return Math.max(1, Math.ceil(totalTokens / divisor));
  }

  if (normalizedUnit === "1k_tokens" || normalizedUnit === "k_tokens") {
    return Math.max(1, Math.ceil(totalTokens / 1000));
  }

  return Math.max(1, totalTokens);
}

function getNextAutoRemediationAt(
  attempts: number,
  referenceTime: Date,
  baseBackoffSeconds = env.agentExecutionCallbackAutoRemediationBaseBackoffSeconds,
) {
  const backoffSeconds = baseBackoffSeconds * Math.max(1, 2 ** Math.max(0, attempts - 1));
  return new Date(referenceTime.getTime() + backoffSeconds * 1000);
}

function getSkippedAutoRemediationNextAttemptAt(referenceTime: Date, baseBackoffSeconds: number) {
  const minimumSkipDelaySeconds = 15 * 60;
  const effectiveBackoffSeconds = Math.max(baseBackoffSeconds, minimumSkipDelaySeconds);
  return new Date(referenceTime.getTime() + effectiveBackoffSeconds * 1000);
}

function getCallbackAutoRemediationState(
  row: Pick<
    typeof agentExecutionCallbacks.$inferSelect,
    "autoRemediationAttempts" | "nextAutoRemediationAt" | "autoRemediationExhaustedAt"
  >,
): AgentExecutionCallbackAutoRemediationState {
  if (row.autoRemediationExhaustedAt) {
    return "exhausted";
  }
  if (row.nextAutoRemediationAt) {
    return "scheduled";
  }
  return "idle";
}

async function acquireEphemeralLock(lockKey: string, ttlSeconds: number) {
  const token = crypto.randomUUID();
  const claimed = await redis.set(lockKey, token, "EX", ttlSeconds, "NX");
  return claimed === "OK" ? token : null;
}

async function releaseEphemeralLock(lockKey: string, token: string) {
  await redis.eval(
    `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `,
    1,
    lockKey,
    token,
  );
}

function normalizeExecutionHostingMode(hostingMode?: string | null): "managed_light" | "managed_heavy" | "open_protocol" {
  if (hostingMode === "managed_heavy" || hostingMode === "registry_only") {
    return "managed_heavy";
  }
  if (hostingMode === "open_protocol" || hostingMode === "external_runtime") {
    return "open_protocol";
  }
  return "managed_light";
}

function isManagedLightExecutionHostingMode(hostingMode?: string | null) {
  return normalizeExecutionHostingMode(hostingMode) === "managed_light";
}

async function resolveManagedLightCapabilityRow(args: {
  agentId: string;
  capabilityId?: string | null;
  connection?: NodePgDatabase<typeof schema>;
}) {
  const connection = args.connection ?? db;
  const rows = await connection
    .select()
    .from(agentCapabilities)
    .where(
      and(
        eq(agentCapabilities.agentId, args.agentId),
        eq(agentCapabilities.enabled, true),
        ...(args.capabilityId ? [eq(agentCapabilities.id, args.capabilityId)] : []),
      ),
    )
    .orderBy(asc(agentCapabilities.createdAt))
    .limit(args.capabilityId ? 1 : 2);

  if (args.capabilityId) {
    const exact = rows[0] ?? null;
    if (!exact) {
      throw new ConflictError("羽量 Agent 任务能力不存在或未启用");
    }
    return exact;
  }

  if (rows.length === 0) {
    throw new ConflictError("羽量 Agent 尚未定义任务能力");
  }
  if (rows.length > 1) {
    throw new ConflictError("羽量 Agent 必须保持单任务能力");
  }
  return rows[0];
}

function getInitialRuntimeState(sourceType: string, hostingMode?: string | null) {
  if (sourceType !== "platform" || isManagedLightExecutionHostingMode(hostingMode)) {
    return {
      executorPhase: null as PlatformExecutionPhase | null,
      progressPercent: null as number | null,
    };
  }

  return {
    executorPhase: "queued" as PlatformExecutionPhase,
    progressPercent: 0,
  };
}

function getExecutionPhaseTimeoutSeconds(phase: PlatformExecutionPhase | null, overrideSeconds?: number | null) {
  if (overrideSeconds && Number.isFinite(overrideSeconds) && overrideSeconds >= 60) {
    return Math.floor(overrideSeconds);
  }

  if (!phase) {
    return env.agentExecutionStaleSeconds;
  }

  return env.agentExecutionPhaseTimeouts[phase] ?? env.agentExecutionStaleSeconds;
}

function getMinimumExecutionPhaseTimeoutSeconds(overrideSeconds?: number | null) {
  if (overrideSeconds && Number.isFinite(overrideSeconds) && overrideSeconds >= 60) {
    return Math.floor(overrideSeconds);
  }

  return Math.min(
    env.agentExecutionStaleSeconds,
    ...Object.values(env.agentExecutionPhaseTimeouts).map((value) => Math.max(60, value)),
  );
}

function getExecutionPhaseAgeSeconds(args: {
  updatedAt: Date;
  status: AgentExecutionStatus;
  phase: PlatformExecutionPhase | null;
  referenceTime?: Date;
}) {
  if (args.status !== "running" || !args.phase) {
    return null;
  }
  const referenceTime = args.referenceTime ?? now();
  return Math.max(0, Math.floor((referenceTime.getTime() - args.updatedAt.getTime()) / 1000));
}

function isExecutionPhaseTimeoutApproaching(args: {
  updatedAt: Date;
  status: AgentExecutionStatus;
  phase: PlatformExecutionPhase | null;
  referenceTime?: Date;
}) {
  const phaseAgeSeconds = getExecutionPhaseAgeSeconds(args);
  if (phaseAgeSeconds === null || !args.phase) {
    return false;
  }
  const phaseTimeoutSeconds = getExecutionPhaseTimeoutSeconds(args.phase);
  return phaseAgeSeconds >= Math.max(1, Math.floor(phaseTimeoutSeconds * 0.9));
}

function toSerializablePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload as Record<string, unknown>;
}

function buildExecutionOutputEnvelope(args: {
  kind: AgentExecutionOutputKind;
  title: string;
  summary?: string | null;
  payload?: Record<string, unknown>;
  generatedAt?: Date | null;
}): AgentExecutionOutputEnvelope {
  return {
    version: 1,
    kind: args.kind,
    title: args.title,
    summary: args.summary ?? null,
    payload: args.payload ?? {},
    generatedAt: args.generatedAt ? args.generatedAt.toISOString() : null,
  };
}

function getExecutionPhaseCostUnits(phase: PlatformExecutionPhase | null) {
  if (!phase) return 0;
  const phaseOrder: PlatformExecutionPhase[] = ["queued", "prepare", "produce_artifact", "finalize", "done"];
  let total = 0;
  for (const currentPhase of phaseOrder) {
    total += env.agentExecutionPhaseCostUnits[currentPhase] ?? 0;
    if (currentPhase === phase) {
      break;
    }
  }
  return total;
}

function estimateExecutionRunCostUnits(args: {
  runKind: AgentExecutionRunView["runKind"];
  status: AgentExecutionRunStatus;
  artifactCount: number;
  executionPhase?: PlatformExecutionPhase | null;
}) {
  const baseUnits = env.agentExecutionRunBaseCostUnits[args.runKind] ?? 0;
  const artifactUnits = Math.max(0, args.artifactCount) * env.agentExecutionArtifactCostUnits;

  if (args.runKind !== "platform_executor") {
    return baseUnits + artifactUnits;
  }

  const platformPhase =
    args.executionPhase ??
    (args.status === "completed" ? "done" : args.status === "failed" ? "prepare" : "queued");
  return baseUnits + artifactUnits + getExecutionPhaseCostUnits(platformPhase);
}

function estimateExecutionStepCostUnits(args: {
  kind: AgentExecutionStepKind;
  phase?: PlatformExecutionPhase | null;
  status: AgentExecutionStepStatus;
  progressPercent?: number | null;
}) {
  const phaseUnits = args.phase ? Math.max(0, Math.floor((env.agentExecutionPhaseCostUnits[args.phase] ?? 0) / 2)) : 0;
  const statusUnits = args.status === "completed" ? 2 : args.status === "failed" ? 1 : 1;
  const progressUnits = args.progressPercent ? Math.max(0, Math.floor(args.progressPercent / 20)) : 0;
  const kindUnits =
    args.kind === "artifact"
      ? env.agentExecutionArtifactCostUnits
      : args.kind === "status"
        ? 1
        : 2;
  return phaseUnits + statusUnits + progressUnits + kindUnits;
}

function buildExecutionCostBuckets(runs: AgentExecutionRunView[]) {
  const bucketMap = new Map<string, number>();
  for (const run of runs) {
    bucketMap.set(run.runKind, (bucketMap.get(run.runKind) ?? 0) + run.costUnits);
  }
  return [...bucketMap.entries()]
    .map(([key, costUnits]) => ({ key, costUnits }))
    .sort((left, right) => right.costUnits - left.costUnits || left.key.localeCompare(right.key));
}

function buildStepCostBuckets(steps: AgentExecutionStepView[]) {
  const bucketMap = new Map<string, number>();
  for (const step of steps) {
    bucketMap.set(step.kind, (bucketMap.get(step.kind) ?? 0) + step.costUnits);
  }
  return [...bucketMap.entries()]
    .map(([key, costUnits]) => ({ key, costUnits }))
    .sort((left, right) => right.costUnits - left.costUnits || left.key.localeCompare(right.key));
}

function estimateSettlementAmount(costUnits: number, costUnitsPerCurrency = env.agentExecutionCostUnitsPerCurrency) {
  return Math.max(0, Math.ceil(Math.max(0, costUnits) / Math.max(1, costUnitsPerCurrency)));
}

function applyExecutionPricingPolicyRules(args: {
  measuredCostUnits: number;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
}) {
  const measuredCostUnits = Math.max(0, args.measuredCostUnits);
  const includedCostUnits = Math.min(measuredCostUnits, args.pricingPolicy.includedCostUnits);
  const billedCostUnits = Math.max(0, measuredCostUnits - includedCostUnits);
  const estimatedBilledAmount = estimateSettlementAmount(
    billedCostUnits,
    args.pricingPolicy.costUnitsPerCurrency,
  );
  const minimumAdjustedAmount =
    billedCostUnits > 0 ? Math.max(args.pricingPolicy.minimumBilledAmount, estimatedBilledAmount) : 0;
  const billedAmount =
    args.pricingPolicy.maxBilledAmount !== null
      ? Math.min(minimumAdjustedAmount, args.pricingPolicy.maxBilledAmount)
      : minimumAdjustedAmount;
  const pricingCapExceeded =
    args.pricingPolicy.maxBilledAmount !== null && minimumAdjustedAmount > args.pricingPolicy.maxBilledAmount;
  return {
    measuredCostUnits,
    includedCostUnits,
    billedCostUnits,
    estimatedBilledAmount,
    minimumAdjustedAmount,
    billedAmount,
    pricingCapExceeded,
  };
}

function getMaximumAffordableAdditionalArtifacts(args: {
  measuredCostUnits: number;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
  maxAdditionalArtifacts: number;
  reserveCostUnits?: number;
}) {
  const maxAdditionalArtifacts = Math.max(0, args.maxAdditionalArtifacts);
  if (maxAdditionalArtifacts === 0) {
    return 0;
  }
  if (args.pricingPolicy.maxBilledAmount === null) {
    return maxAdditionalArtifacts;
  }

  const reserveCostUnits = Math.max(0, args.reserveCostUnits ?? 0);
  let affordableArtifacts = 0;
  for (let count = 1; count <= maxAdditionalArtifacts; count += 1) {
    const projectedPricing = applyExecutionPricingPolicyRules({
      measuredCostUnits: args.measuredCostUnits + reserveCostUnits + count * env.agentExecutionArtifactCostUnits,
      pricingPolicy: args.pricingPolicy,
    });
    if (projectedPricing.pricingCapExceeded) {
      break;
    }
    affordableArtifacts = count;
  }
  return affordableArtifacts;
}

function isExecutionPricingNearLimit(args: {
  measuredCostUnits: number;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
}) {
  if (args.pricingPolicy.maxBilledAmount === null || args.pricingPolicy.maxBilledAmount <= 0) {
    return false;
  }
  const projectedPricing = applyExecutionPricingPolicyRules(args);
  return (
    !projectedPricing.pricingCapExceeded &&
    projectedPricing.minimumAdjustedAmount / args.pricingPolicy.maxBilledAmount >=
      env.agentExecutionBudgetNearLimitThresholdPercent
  );
}

function getMaximumComfortableAdditionalArtifacts(args: {
  measuredCostUnits: number;
  currentResourceMinutes: number;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
  maxAdditionalArtifacts: number;
  reserveCostUnits?: number;
  reserveResourceMinutes?: number;
  budgetCostUnits: number | null;
  budgetResourceMinutes: number | null;
}) {
  const maxAdditionalArtifacts = Math.max(0, args.maxAdditionalArtifacts);
  if (maxAdditionalArtifacts === 0) {
    return 0;
  }

  const reserveCostUnits = Math.max(0, args.reserveCostUnits ?? 0);
  const reserveResourceMinutes = Math.max(0, args.reserveResourceMinutes ?? 0);
  let comfortableArtifacts = 0;
  for (let count = 1; count <= maxAdditionalArtifacts; count += 1) {
    const projectedCostUnits = args.measuredCostUnits + reserveCostUnits + count * env.agentExecutionArtifactCostUnits;
    const projectedResourceMinutes =
      args.currentResourceMinutes + reserveResourceMinutes + count * getArtifactResourceMinutes();
    const budgetStatus = getExecutionBudgetStatus({
      totalCostUnits: projectedCostUnits,
      totalResourceMinutes: projectedResourceMinutes,
      budgetCostUnits: args.budgetCostUnits,
      budgetResourceMinutes: args.budgetResourceMinutes,
    });
    const pricingCapExceeded = applyExecutionPricingPolicyRules({
      measuredCostUnits: projectedCostUnits,
      pricingPolicy: args.pricingPolicy,
    }).pricingCapExceeded;
    const pricingNearLimit = isExecutionPricingNearLimit({
      measuredCostUnits: projectedCostUnits,
      pricingPolicy: args.pricingPolicy,
    });
    if (budgetStatus !== "within_budget" || pricingCapExceeded || pricingNearLimit) {
      break;
    }
    comfortableArtifacts = count;
  }
  return comfortableArtifacts;
}

function estimateRunResourceMinutes(args: {
  createdAt: Date;
  finishedAt: Date;
}) {
  return Math.max(1, Math.ceil((args.finishedAt.getTime() - args.createdAt.getTime()) / 60_000));
}

function getExecutionBudgetStatus(args: {
  totalCostUnits: number;
  totalResourceMinutes: number;
  budgetCostUnits: number | null;
  budgetResourceMinutes: number | null;
}): "no_budget" | "within_budget" | "near_limit" | "exceeded" {
  if (args.budgetCostUnits === null && args.budgetResourceMinutes === null) {
    return "no_budget";
  }

  const costRatio =
    args.budgetCostUnits !== null && args.budgetCostUnits > 0 ? args.totalCostUnits / args.budgetCostUnits : 0;
  const minuteRatio =
    args.budgetResourceMinutes !== null && args.budgetResourceMinutes > 0
      ? args.totalResourceMinutes / args.budgetResourceMinutes
      : 0;
  const highestRatio = Math.max(costRatio, minuteRatio);

  if (highestRatio > 1) return "exceeded";
  if (highestRatio >= env.agentExecutionBudgetNearLimitThresholdPercent) return "near_limit";
  return "within_budget";
}

function getExecutionRuntimeNearLimitState(args: {
  measuredCostUnits: number;
  currentResourceMinutes: number;
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
}) {
  const budgetStatus = getExecutionBudgetStatus({
    totalCostUnits: args.measuredCostUnits,
    totalResourceMinutes: args.currentResourceMinutes,
    budgetCostUnits: args.runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: args.runtimeProfile.budgetResourceMinutes,
  });
  const pricingNearLimit = isExecutionPricingNearLimit({
    measuredCostUnits: args.measuredCostUnits,
    pricingPolicy: args.pricingPolicy,
  });
  return {
    budgetStatus,
    pricingNearLimit,
    nearLimit: budgetStatus === "near_limit" || pricingNearLimit,
  };
}

function toAgentExecutionSettlementView(
  row: typeof agentExecutionSettlements.$inferSelect,
  lineItems: AgentExecutionSettlementLineItemView[] = [],
): AgentExecutionSettlementView {
  return {
    id: row.id,
    executionId: row.executionId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    currency: row.currency as CurrencyKey,
    runtimeProfileKey: row.runtimeProfileKey as AgentExecutionRuntimeProfileKey,
    pricingPolicyKey: row.pricingPolicyKey,
    pricingPolicyVersion: row.pricingPolicyVersion,
    revenueContractKey: row.revenueContractKey,
    revenueContractVersion: row.revenueContractVersion,
    revenueRecipientMode: row.revenueRecipientMode as "agent_owner" | "platform_only",
    costUnitsPerCurrency: row.costUnitsPerCurrency,
    revenueSharePercent: row.revenueSharePercent,
    treasuryUserId: row.treasuryUserId,
    measuredCostUnits: row.measuredCostUnits,
    includedCostUnits: row.includedCostUnits,
    billedCostUnits: row.billedCostUnits,
    minimumBilledAmount: row.minimumBilledAmount,
    billedAmount: row.billedAmount,
    revenueRecipientUserId: row.revenueRecipientUserId,
    minimumPayoutAmount: row.minimumPayoutAmount,
    revenueAmount: row.revenueAmount,
    status: row.status as AgentExecutionSettlementStatus,
    note: row.note,
    lastError: row.lastError,
    lastAttemptAt: row.lastAttemptAt ? row.lastAttemptAt.toISOString() : null,
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    lineItems,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAgentExecutionSettlementLineItemView(
  row: typeof agentExecutionSettlementLineItems.$inferSelect,
): AgentExecutionSettlementLineItemView {
  return {
    id: row.id,
    settlementId: row.settlementId,
    executionId: row.executionId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    lineKind: row.lineKind as AgentExecutionSettlementLineItemKind,
    title: row.title,
    scopeType: (row.scopeType as AgentExecutionSettlementLineItemView["scopeType"]) ?? null,
    scopeId: row.scopeId,
    costUnits: row.costUnits,
    amount: row.amount,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAgentExecutionSettlementAttemptView(
  row: typeof agentExecutionSettlementAttempts.$inferSelect,
): AgentExecutionSettlementAttemptView {
  return {
    id: row.id,
    settlementId: row.settlementId,
    executionId: row.executionId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    currency: row.currency as CurrencyKey,
    billedAmount: row.billedAmount,
    revenueAmount: row.revenueAmount,
    status: row.status as AgentExecutionSettlementAttemptStatus,
    note: row.note,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

function getRemainingExecutionPhaseCostUnits(phase: PlatformExecutionPhase | null) {
  const phaseOrder: PlatformExecutionPhase[] = ["queued", "prepare", "produce_artifact", "finalize", "done"];
  if (!phase) {
    return phaseOrder.reduce((sum, currentPhase) => sum + (env.agentExecutionPhaseCostUnits[currentPhase] ?? 0), 0);
  }
  const startIndex = phaseOrder.indexOf(phase);
  const relevant = startIndex >= 0 ? phaseOrder.slice(startIndex) : phaseOrder;
  return relevant.reduce((sum, currentPhase) => sum + (env.agentExecutionPhaseCostUnits[currentPhase] ?? 0), 0);
}

function buildObjectiveChecklist(objective: string) {
  const normalized = objective
    .split(/\r?\n|[。！？!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const unique = Array.from(new Set(normalized));
  return unique.slice(0, 5).map((item, index) => ({
    order: index + 1,
    text: item,
  }));
}

function normalizeObjectiveChecklist(
  value: unknown,
  fallbackObjective: string,
): AgentExecutionObjectiveChecklistEntry[] {
  if (!Array.isArray(value)) {
    return buildObjectiveChecklist(fallbackObjective).map((entry, index) => ({
      order: entry.order ?? index + 1,
      text: entry.text,
      runtimePhase: getRuntimeManagedSubtaskPhase(index),
    }));
  }

  const entries = value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { order?: unknown; text?: unknown; runtimePhase?: unknown };
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
      if (!text) return null;
      const runtimePhase =
        candidate.runtimePhase === "queued" ||
        candidate.runtimePhase === "prepare" ||
        candidate.runtimePhase === "produce_artifact" ||
        candidate.runtimePhase === "finalize"
          ? candidate.runtimePhase
          : getRuntimeManagedSubtaskPhase(index);
      return {
        order:
          typeof candidate.order === "number" && Number.isInteger(candidate.order) && candidate.order > 0
            ? candidate.order
            : index + 1,
        text,
        runtimePhase,
      } satisfies AgentExecutionObjectiveChecklistEntry;
    })
    .filter((item): item is AgentExecutionObjectiveChecklistEntry => Boolean(item));

  if (entries.length > 0) {
    return entries.slice(0, 5);
  }

  return buildObjectiveChecklist(fallbackObjective).map((entry, index) => ({
    order: entry.order ?? index + 1,
    text: entry.text,
    runtimePhase: getRuntimeManagedSubtaskPhase(index),
  }));
}

function getDerivedRuntimeTargetArtifactCount(args: {
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  if (args.runtimeProfile.artifactMode !== "checklist_progressive") {
    return args.runtimeProfile.targetArtifactCount;
  }
  return Math.max(args.runtimeProfile.targetArtifactCount, Math.max(1, args.objectiveChecklist.length));
}

function getRequiredPreparePasses(args: {
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  const prepareEntryCount = args.objectiveChecklist.filter((entry) => entry.runtimePhase === "prepare").length;
  return Math.max(args.runtimeProfile.preparePassesRequired, Math.max(1, prepareEntryCount));
}

function getRequiredFinalizePasses(args: {
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  const finalizeEntryCount = args.objectiveChecklist.filter((entry) => entry.runtimePhase === "finalize").length;
  return Math.max(args.runtimeProfile.finalizePassesRequired, Math.max(1, finalizeEntryCount));
}

function getFinalizeReserveCostUnitsForExecution(args: {
  execution: typeof agentExecutions.$inferSelect;
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  const objectiveChecklist = normalizeObjectiveChecklist(args.execution.objectiveChecklist, args.execution.objective);
  const finalizePassesRequired = getRequiredFinalizePasses({
    objectiveChecklist,
    runtimeProfile: args.runtimeProfile,
  });
  return Math.max(1, finalizePassesRequired) * (env.agentExecutionPhaseCostUnits.finalize ?? 0);
}

function getFinalizeReserveResourceMinutesForExecution(args: {
  execution: typeof agentExecutions.$inferSelect;
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  const objectiveChecklist = normalizeObjectiveChecklist(args.execution.objectiveChecklist, args.execution.objective);
  const finalizePassesRequired = getRequiredFinalizePasses({
    objectiveChecklist,
    runtimeProfile: args.runtimeProfile,
  });
  return Math.max(1, finalizePassesRequired) * Math.max(1, Math.ceil((env.agentExecutionPhaseTimeouts.finalize ?? 60) / 60));
}

function getArtifactResourceMinutes() {
  return Math.max(0, env.agentExecutionArtifactResourceMinutes);
}

function getRuntimeManagedSubtaskPhase(index: number): PlatformExecutionPhase | null {
  return runtimeSubtaskPhaseOrder[index] ?? null;
}

function resolveRuntimeProfile(key: AgentExecutionRuntimeProfileKey | null | undefined) {
  if (key && env.agentExecutionRuntimeProfiles[key]) {
    return {
      key,
      ...env.agentExecutionRuntimeProfiles[key],
    };
  }

  return {
    key: "baseline" as AgentExecutionRuntimeProfileKey,
    ...env.agentExecutionRuntimeProfiles.baseline,
  };
}

function resolveExecutionPricingPolicy(preferredPolicyKey?: string | null, runtimeProfileKey?: string | null | undefined) {
  const policyKey =
    preferredPolicyKey && env.agentExecutionPricingPolicies[preferredPolicyKey]
      ? preferredPolicyKey
      : runtimeProfileKey && env.agentExecutionPricingPolicies[runtimeProfileKey]
        ? runtimeProfileKey
      : env.agentExecutionPricingPolicies.default
        ? "default"
        : Object.keys(env.agentExecutionPricingPolicies)[0] ?? "default";
  const policy = env.agentExecutionPricingPolicies[policyKey];
  if (!policy) {
    throw new ConflictError("Agent execution pricing policy is not configured");
  }
  return {
    key: policyKey,
    ...policy,
  };
}

function resolveExecutionRevenueContract(
  preferredContractKey?: string | null,
  runtimeProfileKey?: string | null | undefined,
) {
  const contractKey =
    preferredContractKey && env.agentExecutionRevenueContracts[preferredContractKey]
      ? preferredContractKey
      : runtimeProfileKey && env.agentExecutionRevenueContracts[runtimeProfileKey]
        ? runtimeProfileKey
      : env.agentExecutionRevenueContracts.default
        ? "default"
        : Object.keys(env.agentExecutionRevenueContracts)[0] ?? "default";
  const contract = env.agentExecutionRevenueContracts[contractKey];
  if (!contract) {
    throw new ConflictError("Agent execution revenue contract is not configured");
  }
  return {
    key: contractKey,
    ...contract,
  };
}

function getRemainingExecutionPhaseResourceMinutes(phase: PlatformExecutionPhase | null) {
  const phaseOrder: PlatformExecutionPhase[] = ["queued", "prepare", "produce_artifact", "finalize", "done"];
  const startIndex = phase ? phaseOrder.indexOf(phase) : 0;
  const relevant = startIndex >= 0 ? phaseOrder.slice(startIndex) : phaseOrder;
  return relevant.reduce(
    (sum, currentPhase) => sum + Math.max(1, Math.ceil((env.agentExecutionPhaseTimeouts[currentPhase] ?? 60) / 60)),
    0,
  );
}

function toRuntimeProfileView(row: Pick<typeof agentExecutions.$inferSelect, "runtimeProfileKey" | "targetArtifactCount" | "maxAutoRecoveryCount">): AgentExecutionRuntimeProfileView {
  const profile = resolveRuntimeProfile((row.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline");
  const pricingPolicy = resolveExecutionPricingPolicy(profile.pricingPolicyKey, profile.key);
  const revenueContract = resolveExecutionRevenueContract(profile.revenueContractKey, profile.key);
  return {
    key: profile.key,
    label: profile.label,
    description: profile.description,
    targetArtifactCount: row.targetArtifactCount ?? profile.targetArtifactCount,
    artifactsPerAdvance: profile.artifactsPerAdvance,
    nearLimitArtifactsPerAdvanceCap: profile.nearLimitArtifactsPerAdvanceCap,
    maxAutoRecoveryCount: row.maxAutoRecoveryCount ?? profile.maxAutoRecoveryCount,
    maxConcurrentExecutions: profile.maxConcurrentExecutions,
    maxConcurrentExecutionsPerOwner: profile.maxConcurrentExecutionsPerOwner,
    nearLimitPhaseAdvancesPerRunCap: profile.nearLimitPhaseAdvancesPerRunCap,
    nearLimitPreparePassesCap: profile.nearLimitPreparePassesCap,
    nearLimitFinalizePassesCap: profile.nearLimitFinalizePassesCap,
    preparePassesRequired: profile.preparePassesRequired,
    finalizePassesRequired: profile.finalizePassesRequired,
    phaseAdvancesPerRun: profile.phaseAdvancesPerRun,
    budgetCostUnits: profile.budgetCostUnits,
    budgetResourceMinutes: profile.budgetResourceMinutes,
    pricingPolicyKey: pricingPolicy.key,
    pricingPolicyVersion: pricingPolicy.version,
    revenueContractKey: revenueContract.key,
    revenueContractVersion: revenueContract.version,
    artifactMode: profile.artifactMode,
    runtimePlanVersion: profile.runtimePlanVersion,
  };
}

function buildRuntimeProfileOwnerKey(runtimeProfileKey: string, ownerUserId: string) {
  return `${runtimeProfileKey}:${ownerUserId}`;
}

async function getRuntimeProfileUtilizationMap() {
  const runningRows = await db.execute(sql`
    select ae.runtime_profile_key, count(*)::int as count
    from agent_executions ae
    inner join agents a on a.id = ae.agent_id
    where a.source_type = 'platform'
      and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
      and a.enabled = true
      and ae.status = 'running'
    group by ae.runtime_profile_key
  `);
  const queuedRows = await db.execute(sql`
    select ae.runtime_profile_key, count(*)::int as count
    from agent_executions ae
    inner join agents a on a.id = ae.agent_id
    where a.source_type = 'platform'
      and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
      and a.enabled = true
      and ae.status = 'queued'
    group by ae.runtime_profile_key
  `);
  const runningOwnerRows = await db.execute(sql`
    select ae.runtime_profile_key, ae.owner_user_id, count(*)::int as count
    from agent_executions ae
    inner join agents a on a.id = ae.agent_id
    where a.source_type = 'platform'
      and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
      and a.enabled = true
      and ae.status = 'running'
    group by ae.runtime_profile_key, ae.owner_user_id
  `);
  const queuedExecutionRows = await db.execute(sql`
    select ae.id as execution_id, ae.runtime_profile_key, ae.owner_user_id
    from agent_executions ae
    inner join agents a on a.id = ae.agent_id
    where a.source_type = 'platform'
      and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
      and a.enabled = true
      and ae.status = 'queued'
    order by ae.created_at asc
  `);

  const runningCountByProfile = new Map<string, number>();
  const queuedCountByProfile = new Map<string, number>();
  const runningCountByProfileOwner = new Map<string, number>();
  const queuedCandidatesByProfile = new Map<string, Array<{ ownerUserId: string }>>();
  for (const row of runningRows.rows as Array<{ runtime_profile_key: string | null; count: number }>) {
    const key = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
    runningCountByProfile.set(key, Number(row.count) || 0);
  }
  for (const row of queuedRows.rows as Array<{ runtime_profile_key: string | null; count: number }>) {
    const key = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
    queuedCountByProfile.set(key, Number(row.count) || 0);
  }
  for (const row of runningOwnerRows.rows as Array<{ runtime_profile_key: string | null; owner_user_id: string | null; count: number }>) {
    const runtimeProfileKey = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
    const ownerUserId = row.owner_user_id?.trim();
    if (!ownerUserId) continue;
    runningCountByProfileOwner.set(
      buildRuntimeProfileOwnerKey(runtimeProfileKey, ownerUserId),
      Number(row.count) || 0,
    );
  }
  for (const row of queuedExecutionRows.rows as Array<{ execution_id: string; runtime_profile_key: string | null; owner_user_id: string | null }>) {
    const runtimeProfileKey = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
    const ownerUserId = row.owner_user_id?.trim() || `unknown:${row.execution_id}`;
    const candidates = queuedCandidatesByProfile.get(runtimeProfileKey) ?? [];
    candidates.push({ ownerUserId });
    queuedCandidatesByProfile.set(runtimeProfileKey, candidates);
  }

  return {
    runningCountByProfile,
    queuedCountByProfile,
    runningCountByProfileOwner,
    queuedCandidatesByProfile,
  };
}

async function getExecutionRuntimeHeadroomSnapshot(
  execution: typeof agentExecutions.$inferSelect,
  connection: NodePgDatabase<typeof schema> = db,
) {
  const runtimeProfile = resolveRuntimeProfile(
    (execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
  );
  const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
  const [measuredCostUnits, runTotals] = await Promise.all([
    calculateExecutionBilledCostUnitsInTx(connection, execution.id),
    connection
      .select({
        totalResourceMinutes: sql<number>`coalesce(sum(${agentExecutionRuns.resourceMinutes}), 0)::int`,
      })
      .from(agentExecutionRuns)
      .where(eq(agentExecutionRuns.executionId, execution.id)),
  ]);
  const currentResourceMinutes = Number(runTotals[0]?.totalResourceMinutes ?? 0);
  const nearLimitState = getExecutionRuntimeNearLimitState({
    measuredCostUnits,
    currentResourceMinutes,
    runtimeProfile,
    pricingPolicy,
  });
  return {
    runtimeProfile,
    pricingPolicy,
    measuredCostUnits,
    currentResourceMinutes,
    ...nearLimitState,
  };
}

function toAgentExecutionPricingPolicyView(
  key: string,
  policy: (typeof env.agentExecutionPricingPolicies)[string],
): AgentExecutionPricingPolicyView {
  return {
    key,
    label: policy.label,
    version: policy.version,
    currency: policy.currency,
    costUnitsPerCurrency: policy.costUnitsPerCurrency,
    includedCostUnits: policy.includedCostUnits,
    minimumBilledAmount: policy.minimumBilledAmount,
    maxBilledAmount: policy.maxBilledAmount,
    allowPartialFinalize: policy.allowPartialFinalize,
    minimumArtifactsBeforePartialFinalize: policy.minimumArtifactsBeforePartialFinalize,
    revenueSharePercent: policy.revenueSharePercent,
    treasuryUserId: policy.treasuryUserId,
  };
}

function toAgentExecutionRevenueContractView(
  key: string,
  contract: (typeof env.agentExecutionRevenueContracts)[string],
): AgentExecutionRevenueContractView {
  return {
    key,
    label: contract.label,
    version: contract.version,
    revenueSharePercent: contract.revenueSharePercent,
    minimumPayoutAmount: contract.minimumPayoutAmount,
    treasuryUserId: contract.treasuryUserId,
    revenueRecipientMode: contract.revenueRecipientMode,
  };
}

export async function getAgentExecutionRuntimeCatalog(): Promise<AgentExecutionRuntimeCatalogView> {
  const { runningCountByProfile, queuedCountByProfile, runningCountByProfileOwner, queuedCandidatesByProfile } =
    await getRuntimeProfileUtilizationMap();
  const runtimeProfiles = (Object.keys(env.agentExecutionRuntimeProfiles) as AgentExecutionRuntimeProfileKey[])
    .map((key) =>
      toRuntimeProfileView({
        runtimeProfileKey: key,
        targetArtifactCount: env.agentExecutionRuntimeProfiles[key].targetArtifactCount,
        maxAutoRecoveryCount: env.agentExecutionRuntimeProfiles[key].maxAutoRecoveryCount,
      }),
    )
    .sort((left, right) => left.key.localeCompare(right.key));
  const pricingPolicies = Object.entries(env.agentExecutionPricingPolicies)
    .map(([key, policy]) => toAgentExecutionPricingPolicyView(key, policy))
    .sort((left, right) => left.key.localeCompare(right.key));
  const revenueContracts = Object.entries(env.agentExecutionRevenueContracts)
    .map(([key, contract]) => toAgentExecutionRevenueContractView(key, contract))
    .sort((left, right) => left.key.localeCompare(right.key));
  const utilization = (Object.keys(env.agentExecutionRuntimeProfiles) as AgentExecutionRuntimeProfileKey[])
    .map((key) => {
      const maxConcurrentExecutions = env.agentExecutionRuntimeProfiles[key].maxConcurrentExecutions;
      const runningExecutionCount = runningCountByProfile.get(key) ?? 0;
      const queuedExecutionCount = queuedCountByProfile.get(key) ?? 0;
      const ownerRunningCounts = [...runningCountByProfileOwner.entries()]
        .filter(([compositeKey]) => compositeKey.startsWith(`${key}:`))
        .map(([compositeKey, count]) => ({
          ownerUserId: compositeKey.slice(key.length + 1),
          runningExecutionCount: count,
        }));
      return buildRuntimeProfileUtilizationView({
        key,
        maxConcurrentExecutions,
        maxConcurrentExecutionsPerOwner: env.agentExecutionRuntimeProfiles[key].maxConcurrentExecutionsPerOwner,
        runningExecutionCount,
        queuedExecutionCount,
        ownerRunningCounts,
        queuedCandidates: queuedCandidatesByProfile.get(key) ?? [],
      });
    })
    .sort((left, right) => left.key.localeCompare(right.key));
  return {
    runtimeProfiles,
    pricingPolicies,
    revenueContracts,
    utilization,
  };
}

function filterRuntimeUtilizationForAlerts(
  utilization: AgentExecutionRuntimeCatalogView["utilization"],
  args?: RuntimePressureAlertSummaryQuery,
) {
  return utilization.filter((entry) => {
    if (args?.pressureLevel && entry.pressureLevel !== args.pressureLevel) {
      return false;
    }
    if (args?.schedulingDecisionClass && entry.schedulingDecisionClass !== args.schedulingDecisionClass) {
      return false;
    }
    return true;
  });
}

export async function getRuntimePressureAlertSummaryForOperator(
  args?: RuntimePressureAlertSummaryQuery,
): Promise<AgentExecutionRuntimePressureAlertSummaryView> {
  const runtimeCatalog = await getAgentExecutionRuntimeCatalog();
  const utilization = filterRuntimeUtilizationForAlerts(runtimeCatalog.utilization, args);
  const alerts = buildRuntimePressureAlerts(utilization);

  return {
    profileCount: utilization.length,
    queuedExecutionCount: utilization.reduce((sum, entry) => sum + entry.queuedExecutionCount, 0),
    claimableQueuedExecutionCount: utilization.reduce((sum, entry) => sum + entry.claimableQueuedExecutionCount, 0),
    blockedQueuedExecutionCount: utilization.reduce((sum, entry) => sum + entry.blockedQueuedExecutionCount, 0),
    blockedByProfileCount: utilization.reduce((sum, entry) => sum + entry.blockedByProfileCount, 0),
    blockedByOwnerCount: utilization.reduce((sum, entry) => sum + entry.blockedByOwnerCount, 0),
    blockedOwnerCount: utilization.reduce((sum, entry) => sum + entry.blockedOwnerCount, 0),
    criticalProfileCount: utilization.filter((entry) => entry.pressureLevel === "critical").length,
    watchProfileCount: utilization.filter((entry) => entry.pressureLevel === "watch").length,
    saturatedOwnerCount: utilization.reduce((sum, entry) => sum + entry.saturatedOwnerCount, 0),
    byPressureLevel: buildSummaryBucketsFromValues(utilization.map((entry) => entry.pressureLevel)),
    bySchedulingDecisionClass: buildSummaryBucketsFromValues(
      utilization.map((entry) => entry.schedulingDecisionClass),
    ),
    byAlertLevel: buildRuntimePressureAlertBuckets(utilization),
    maxAlertLevel: alerts.reduce((maxLevel, alert) => Math.max(maxLevel, alert.alertLevel), 0),
    alerts,
  };
}

type NormalizedAgentExecutionLaunchPresetInput = {
  name: string;
  description: string | null;
  isDefault: boolean | null;
  preferredAgentId: string | null;
  runtimeProfileKey: AgentExecutionRuntimeProfileKey;
  callbackRemediationPolicyKey: AgentCallbackRemediationPolicyKey | null;
  titleTemplate: string | null;
  objectiveTemplate: string | null;
  launchGuidance: string | null;
  followUpExecutionStatus: AgentExecutionStatus | null;
  followUpRunKind: AgentExecutionRunKind | null;
  followUpRunStatus: AgentExecutionRunStatus | null;
  followUpFailureCategory: AgentExecutionRunFailureCategory | null;
  followUpRecentWindow: AgentExecutionRecentWindowKey | null;
  followUpCallbackStatus: AgentExecutionCallbackAuditStatus | null;
  followUpCallbackRetryability: AgentExecutionCallbackRetryability | null;
  followUpCallbackType: AgentExecutionCallbackType | null;
  followUpCallbackRejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  followUpReplayPayloadCompatibility: AgentExecutionStoredReplayPayloadCompatibility | null;
  followUpReplayPayloadReplayable: boolean | null;
  followUpDecisionClass: AgentExecutionCallbackRemediationDecisionClass | null;
  followUpReplayFailureClass: AgentExecutionCallbackReplayFailureClass | null;
  followUpRuntimeDecisionClass: AgentExecutionRuntimeDecisionClass | null;
  followUpRuntimeDecisionSeverity: AgentExecutionRuntimeDecisionSeverity | null;
  followUpPressureLevel: AgentExecutionRuntimePressureLevel | null;
  followUpSchedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass | null;
  followUpRuntimeSessionKind: AgentExecutionRuntimeSessionKind | null;
  followUpRuntimeSessionState: AgentExecutionRuntimeSessionState | null;
  focusSection: AgentExecutionLaunchPresetFocusSection | null;
};

function normalizeAgentExecutionLaunchPresetTextTemplate(
  value: string | null | undefined,
  minimumLength: number,
  label: string,
) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length < minimumLength) {
    throw new ConflictError(`${label} must be at least ${minimumLength} characters`);
  }
  return normalized;
}

function normalizeAgentExecutionLaunchPresetGuidance(value: string | null | undefined) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > 4000) {
    throw new ConflictError("Launch guidance must be at most 4000 characters");
  }
  return normalized;
}

function normalizeAgentExecutionLaunchPresetFocusSection(
  value: AgentExecutionLaunchPresetFocusSection | null | undefined,
): AgentExecutionLaunchPresetFocusSection | null {
  return value === "active-preset" ||
    value === "launch-presets" ||
    value === "create-execution" ||
    value === "runtime-sessions" ||
    value === "cost-overview" ||
    value === "execution-list"
    ? value
    : null;
}

function normalizeAgentExecutionLaunchPresetRunKind(
  value: AgentExecutionRunKind | null | undefined,
): AgentExecutionRunKind | null {
  return value === "platform_executor" ||
    value === "requeue" ||
    value === "recovery" ||
    value === "callback_retry_request" ||
    value === "callback_payload_replay" ||
    value === "callback_auto_remediation"
    ? value
    : null;
}

function normalizeAgentExecutionLaunchPresetRunStatus(
  value: AgentExecutionRunStatus | null | undefined,
): AgentExecutionRunStatus | null {
  return value === "running" || value === "completed" || value === "failed" ? value : null;
}

function normalizeAgentExecutionLaunchPresetFailureCategory(
  value: AgentExecutionRunFailureCategory | null | undefined,
): AgentExecutionRunFailureCategory | null {
  return value === "stale_timeout" ||
    value === "executor_failure" ||
    value === "requeue_failure" ||
    value === "unknown_failure"
    ? value
    : null;
}

function normalizeAgentExecutionLaunchPresetRecentWindow(
  value: AgentExecutionRecentWindowKey | null | undefined,
): AgentExecutionRecentWindowKey | null {
  return value === "15m" || value === "1h" || value === "24h" ? value : null;
}

function normalizeAgentExecutionLaunchPresetCallbackStatus(
  value: AgentExecutionCallbackAuditStatus | null | undefined,
): AgentExecutionCallbackAuditStatus | null {
  return value === "accepted" || value === "duplicate" || value === "rejected" ? value : null;
}

function normalizeAgentExecutionLaunchPresetCallbackRetryability(
  value: AgentExecutionCallbackRetryability | null | undefined,
): AgentExecutionCallbackRetryability | null {
  return value === "retryable" || value === "inspect" || value === "not_retryable" ? value : null;
}

function normalizeAgentExecutionLaunchPresetCallbackType(
  value: AgentExecutionCallbackType | null | undefined,
): AgentExecutionCallbackType | null {
  return value === "heartbeat" || value === "status" || value === "artifact" || value === "callback" ? value : null;
}

function normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
  value: AgentExecutionCallbackRejectionCategory | null | undefined,
): AgentExecutionCallbackRejectionCategory | null {
  return value === "invalid_secret" ||
    value === "invalid_signature" ||
    value === "invalid_timestamp" ||
    value === "invalid_version" ||
    value === "invalid_payload" ||
    value === "processing_conflict" ||
    value === "unsupported_target" ||
    value === "unknown"
    ? value
    : null;
}

function normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
  value: AgentExecutionStoredReplayPayloadCompatibility | null | undefined,
): AgentExecutionStoredReplayPayloadCompatibility | null {
  return value === "current" || value === "legacy_normalized" || value === "invalid" ? value : null;
}

function normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(value: boolean | null | undefined): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeAgentExecutionLaunchPresetDecisionClass(
  value: AgentExecutionCallbackRemediationDecisionClass | null | undefined,
): AgentExecutionCallbackRemediationDecisionClass | null {
  return value === "replay_current_payload" ||
    value === "replay_legacy_payload" ||
    value === "retry_missing_payload" ||
    value === "retry_incompatible_payload" ||
    value === "retry_compatibility_policy" ||
    value === "retry_compat_window" ||
    value === "retry_policy_preferred" ||
    value === "skip_policy_disabled" ||
    value === "skip_missing_rejection_category" ||
    value === "skip_policy_budget_exhausted" ||
    value === "skip_missing_payload" ||
    value === "skip_incompatible_payload" ||
    value === "skip_compatibility_policy" ||
    value === "skip_compat_window" ||
    value === "skip_policy_not_covered" ||
    value === "skip_target_unavailable"
    ? value
    : null;
}

function normalizeAgentExecutionLaunchPresetReplayFailureClass(
  value: AgentExecutionCallbackReplayFailureClass | null | undefined,
): AgentExecutionCallbackReplayFailureClass | null {
  return value === "stored_payload_unavailable" ||
    value === "callback_secret_unavailable" ||
    value === "duplicate_replay_cooldown" ||
    value === "agent_disabled" ||
    value === "callback_not_retryable" ||
    value === "unsupported_target" ||
    value === "callback_protocol_mismatch"
    ? value
    : null;
}

function normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
  value: AgentExecutionRuntimeDecisionClass | null | undefined,
): AgentExecutionRuntimeDecisionClass | null {
  return value === "prepare_continue" ||
    value === "prepare_near_limit_cap" ||
    value === "prepare_timeout_accelerated" ||
    value === "artifact_batch_continue" ||
    value === "artifact_batch_downshift_near_limit" ||
    value === "artifact_finalize_early_near_limit" ||
    value === "artifact_finalize_early_timeout" ||
    value === "artifact_finalize_early_headroom" ||
    value === "artifact_partial_finalize_blocked" ||
    value === "finalize_continue" ||
    value === "finalize_near_limit_cap" ||
    value === "finalize_timeout_accelerated" ||
    value === "finalize_completed"
    ? value
    : null;
}

function normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
  value: AgentExecutionRuntimeDecisionSeverity | null | undefined,
): AgentExecutionRuntimeDecisionSeverity | null {
  return value === "info" || value === "warning" || value === "critical" ? value : null;
}

function normalizeAgentExecutionLaunchPresetPressureLevel(
  value: AgentExecutionRuntimePressureLevel | null | undefined,
): AgentExecutionRuntimePressureLevel | null {
  return value === "healthy" || value === "watch" || value === "critical" ? value : null;
}

function normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
  value: AgentExecutionRuntimeSchedulingDecisionClass | null | undefined,
): AgentExecutionRuntimeSchedulingDecisionClass | null {
  return value === "within_capacity" ||
    value === "queue_backlog" ||
    value === "profile_saturated" ||
    value === "owner_hotspot" ||
    value === "profile_and_owner_saturated"
    ? value
    : null;
}

function normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
  value: AgentExecutionRuntimeSessionKind | null | undefined,
): AgentExecutionRuntimeSessionKind | null {
  return value === "platform_executor" || value === "stale_recovery" || value === "owner_requeue" ? value : null;
}

function normalizeAgentExecutionLaunchPresetRuntimeSessionState(
  value: AgentExecutionRuntimeSessionState | null | undefined,
): AgentExecutionRuntimeSessionState | null {
  return value === "running" || value === "completed" || value === "failed" || value === "requeued" ? value : null;
}

async function normalizeAgentExecutionLaunchPresetInput(
  ownerUserId: string,
  input: CreateAgentExecutionLaunchPresetInput | UpdateAgentExecutionLaunchPresetInput,
): Promise<NormalizedAgentExecutionLaunchPresetInput> {
  const name = input.name.trim();
  if (!name) {
    throw new ConflictError("Execution launch preset name is required");
  }

  const preferredAgentId = input.preferredAgentId?.trim() || null;
  const callbackRemediationPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(
    input.callbackRemediationPolicyKey,
  );
  const runtimeProfileKey = resolveRuntimeProfile(
    (input.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null | undefined) ?? "baseline",
  ).key;
  const titleTemplate = normalizeAgentExecutionLaunchPresetTextTemplate(input.titleTemplate, 3, "Title template");
  const objectiveTemplate = normalizeAgentExecutionLaunchPresetTextTemplate(
    input.objectiveTemplate,
    10,
    "Objective template",
  );
  const launchGuidance = normalizeAgentExecutionLaunchPresetGuidance(input.launchGuidance);

  if (preferredAgentId) {
    const preferredAgent = await getOwnedAgent(ownerUserId, preferredAgentId);
    if (!preferredAgent) {
      throw new NotFoundError("Preferred agent not found");
    }
    if (preferredAgent.sourceType !== "external" && callbackRemediationPolicyKey) {
      throw new ConflictError("Preferred platform agent presets cannot pin callback remediation override");
    }
  }

  return {
    name,
    description: input.description?.trim() || null,
    isDefault: typeof input.isDefault === "boolean" ? input.isDefault : null,
    preferredAgentId,
    runtimeProfileKey,
    callbackRemediationPolicyKey,
    titleTemplate,
    objectiveTemplate,
    launchGuidance,
    followUpExecutionStatus: input.followUpExecutionStatus ?? null,
    followUpRunKind: normalizeAgentExecutionLaunchPresetRunKind(input.followUpRunKind),
    followUpRunStatus: normalizeAgentExecutionLaunchPresetRunStatus(input.followUpRunStatus),
    followUpFailureCategory: normalizeAgentExecutionLaunchPresetFailureCategory(input.followUpFailureCategory),
    followUpRecentWindow: normalizeAgentExecutionLaunchPresetRecentWindow(input.followUpRecentWindow),
    followUpCallbackStatus: normalizeAgentExecutionLaunchPresetCallbackStatus(input.followUpCallbackStatus),
    followUpCallbackRetryability: normalizeAgentExecutionLaunchPresetCallbackRetryability(
      input.followUpCallbackRetryability,
    ),
    followUpCallbackType: normalizeAgentExecutionLaunchPresetCallbackType(input.followUpCallbackType),
    followUpCallbackRejectionCategory: normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
      input.followUpCallbackRejectionCategory,
    ),
    followUpReplayPayloadCompatibility: normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
      input.followUpReplayPayloadCompatibility,
    ),
    followUpReplayPayloadReplayable: normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
      input.followUpReplayPayloadReplayable,
    ),
    followUpDecisionClass: normalizeAgentExecutionLaunchPresetDecisionClass(input.followUpDecisionClass),
    followUpReplayFailureClass: normalizeAgentExecutionLaunchPresetReplayFailureClass(
      input.followUpReplayFailureClass,
    ),
    followUpRuntimeDecisionClass: normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
      input.followUpRuntimeDecisionClass,
    ),
    followUpRuntimeDecisionSeverity: normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
      input.followUpRuntimeDecisionSeverity,
    ),
    followUpPressureLevel: normalizeAgentExecutionLaunchPresetPressureLevel(input.followUpPressureLevel),
    followUpSchedulingDecisionClass: normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
      input.followUpSchedulingDecisionClass,
    ),
    followUpRuntimeSessionKind: normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
      input.followUpRuntimeSessionKind,
    ),
    followUpRuntimeSessionState: normalizeAgentExecutionLaunchPresetRuntimeSessionState(
      input.followUpRuntimeSessionState,
    ),
    focusSection: normalizeAgentExecutionLaunchPresetFocusSection(input.focusSection),
  };
}

function toAgentExecutionLaunchPresetView(args: {
  row: typeof agentExecutionLaunchPresets.$inferSelect;
  preferredAgentName: string | null;
  isDefault: boolean;
}): AgentExecutionLaunchPresetView {
  const runtimeProfileKey =
    (args.row.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null | undefined) ?? "baseline";
  const runtimeProfile = toRuntimeProfileView({
    runtimeProfileKey,
    targetArtifactCount: env.agentExecutionRuntimeProfiles[runtimeProfileKey]?.targetArtifactCount ?? 1,
    maxAutoRecoveryCount: env.agentExecutionRuntimeProfiles[runtimeProfileKey]?.maxAutoRecoveryCount ?? 0,
  });
  const callbackRemediationPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(
    args.row.callbackRemediationPolicyKey,
  );
  return {
    id: args.row.id,
    ownerUserId: args.row.ownerUserId,
    name: args.row.name,
    description: args.row.description ?? null,
    isDefault: args.isDefault,
    preferredAgentId: args.row.preferredAgentId ?? null,
    preferredAgentName: args.preferredAgentName,
    runtimeProfileKey: runtimeProfile.key,
    runtimeProfile,
    callbackRemediationPolicyKey,
    callbackRemediationPolicy: callbackRemediationPolicyKey
      ? buildAgentCallbackRemediationPolicyView(callbackRemediationPolicyKey)
      : null,
    titleTemplate: args.row.titleTemplate ?? null,
    objectiveTemplate: args.row.objectiveTemplate ?? null,
    launchGuidance: args.row.launchGuidance ?? null,
    followUpExecutionStatus: (args.row.followUpExecutionStatus as AgentExecutionStatus | null) ?? null,
    followUpRunKind: normalizeAgentExecutionLaunchPresetRunKind(
      args.row.followUpRunKind as AgentExecutionRunKind | null | undefined,
    ),
    followUpRunStatus: normalizeAgentExecutionLaunchPresetRunStatus(
      args.row.followUpRunStatus as AgentExecutionRunStatus | null | undefined,
    ),
    followUpFailureCategory: normalizeAgentExecutionLaunchPresetFailureCategory(
      args.row.followUpFailureCategory as AgentExecutionRunFailureCategory | null | undefined,
    ),
    followUpRecentWindow: normalizeAgentExecutionLaunchPresetRecentWindow(
      args.row.followUpRecentWindow as AgentExecutionRecentWindowKey | null | undefined,
    ),
    followUpCallbackStatus: normalizeAgentExecutionLaunchPresetCallbackStatus(
      args.row.followUpCallbackStatus as AgentExecutionCallbackAuditStatus | null | undefined,
    ),
    followUpCallbackRetryability: normalizeAgentExecutionLaunchPresetCallbackRetryability(
      args.row.followUpCallbackRetryability as AgentExecutionCallbackRetryability | null | undefined,
    ),
    followUpCallbackType: normalizeAgentExecutionLaunchPresetCallbackType(
      args.row.followUpCallbackType as AgentExecutionCallbackType | null | undefined,
    ),
    followUpCallbackRejectionCategory: normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
      args.row.followUpCallbackRejectionCategory as AgentExecutionCallbackRejectionCategory | null | undefined,
    ),
    followUpReplayPayloadCompatibility: normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
      args.row.followUpReplayPayloadCompatibility as AgentExecutionStoredReplayPayloadCompatibility | null | undefined,
    ),
    followUpReplayPayloadReplayable: normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
      args.row.followUpReplayPayloadReplayable,
    ),
    followUpDecisionClass: normalizeAgentExecutionLaunchPresetDecisionClass(
      args.row.followUpDecisionClass as AgentExecutionCallbackRemediationDecisionClass | null | undefined,
    ),
    followUpReplayFailureClass: normalizeAgentExecutionLaunchPresetReplayFailureClass(
      args.row.followUpReplayFailureClass as AgentExecutionCallbackReplayFailureClass | null | undefined,
    ),
    followUpRuntimeDecisionClass: normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
      args.row.followUpRuntimeDecisionClass as AgentExecutionRuntimeDecisionClass | null | undefined,
    ),
    followUpRuntimeDecisionSeverity: normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
      args.row.followUpRuntimeDecisionSeverity as AgentExecutionRuntimeDecisionSeverity | null | undefined,
    ),
    followUpPressureLevel: normalizeAgentExecutionLaunchPresetPressureLevel(
      args.row.followUpPressureLevel as AgentExecutionRuntimePressureLevel | null | undefined,
    ),
    followUpSchedulingDecisionClass: normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
      args.row.followUpSchedulingDecisionClass as AgentExecutionRuntimeSchedulingDecisionClass | null | undefined,
    ),
    followUpRuntimeSessionKind: normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
      args.row.followUpRuntimeSessionKind as AgentExecutionRuntimeSessionKind | null | undefined,
    ),
    followUpRuntimeSessionState: normalizeAgentExecutionLaunchPresetRuntimeSessionState(
      args.row.followUpRuntimeSessionState as AgentExecutionRuntimeSessionState | null | undefined,
    ),
    focusSection: normalizeAgentExecutionLaunchPresetFocusSection(
      args.row.focusSection as AgentExecutionLaunchPresetFocusSection | null | undefined,
    ),
    createdAt: args.row.createdAt.toISOString(),
    updatedAt: args.row.updatedAt.toISOString(),
  };
}

async function buildAgentExecutionLaunchPresetViews(
  ownerUserId: string,
  rows: Array<typeof agentExecutionLaunchPresets.$inferSelect>,
): Promise<AgentExecutionLaunchPresetView[]> {
  if (rows.length === 0) {
    return [];
  }

  const defaultPresetRow = await getAgentExecutionLaunchDefaultPreset(ownerUserId);
  const defaultPresetId = defaultPresetRow?.presetId ?? null;
  const preferredAgentIds = Array.from(
    new Set(
      rows
        .map((row) => row.preferredAgentId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const preferredAgentNameMap =
    preferredAgentIds.length === 0
      ? new Map<string, string>()
      : new Map(
          (
            await db
              .select({
                id: agents.id,
                name: agents.name,
              })
              .from(agents)
              .where(and(eq(agents.ownerUserId, ownerUserId), inArray(agents.id, preferredAgentIds)))
          ).map((row) => [row.id, row.name]),
        );

  return rows.map((row) =>
    toAgentExecutionLaunchPresetView({
      row,
      preferredAgentName:
        row.preferredAgentId && preferredAgentNameMap.has(row.preferredAgentId)
          ? preferredAgentNameMap.get(row.preferredAgentId) ?? null
          : null,
      isDefault: defaultPresetId === row.id,
    }),
  );
}

async function getOwnedAgentExecutionLaunchPresetView(ownerUserId: string, presetId: string) {
  const row = await getOwnedAgentExecutionLaunchPreset(ownerUserId, presetId);
  if (!row) {
    throw new NotFoundError("Execution launch preset not found");
  }
  const [view] = await buildAgentExecutionLaunchPresetViews(ownerUserId, [row]);
  if (!view) {
    throw new NotFoundError("Execution launch preset not found");
  }
  return view;
}

async function setOwnedAgentExecutionLaunchDefaultPresetInTx(
  tx: NodePgDatabase<typeof schema>,
  ownerUserId: string,
  presetId: string,
) {
  const timestamp = now();
  await tx.delete(agentExecutionLaunchDefaultPresets).where(eq(agentExecutionLaunchDefaultPresets.ownerUserId, ownerUserId));
  await tx.insert(agentExecutionLaunchDefaultPresets).values({
    ownerUserId,
    presetId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function clearOwnedAgentExecutionLaunchDefaultPresetInTx(
  tx: NodePgDatabase<typeof schema>,
  ownerUserId: string,
) {
  await tx.delete(agentExecutionLaunchDefaultPresets).where(eq(agentExecutionLaunchDefaultPresets.ownerUserId, ownerUserId));
}

export async function setOwnedAgentExecutionLaunchDefaultPreset(
  ownerUserId: string,
  presetId: string,
): Promise<AgentExecutionLaunchPresetView> {
  const existing = await getOwnedAgentExecutionLaunchPreset(ownerUserId, presetId);
  if (!existing) {
    throw new NotFoundError("Execution launch preset not found");
  }

  await db.transaction(async (tx) => {
    await setOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId, existing.id);
  });
  return getOwnedAgentExecutionLaunchPresetView(ownerUserId, existing.id);
}

export async function listOwnedAgentExecutionLaunchPresets(
  ownerUserId: string,
  input?: ListAgentExecutionLaunchPresetsInput | null,
): Promise<AgentExecutionLaunchPresetView[]> {
  const rows = await listAgentExecutionLaunchPresetsByOwner(ownerUserId);
  const limit =
    typeof input?.limit === "number" && Number.isFinite(input.limit)
      ? Math.max(1, Math.floor(input.limit))
      : rows.length;
  return buildAgentExecutionLaunchPresetViews(ownerUserId, rows.slice(0, limit));
}

export async function createOwnedAgentExecutionLaunchPreset(
  ownerUserId: string,
  input: CreateAgentExecutionLaunchPresetInput,
): Promise<AgentExecutionLaunchPresetView> {
  const normalized = await normalizeAgentExecutionLaunchPresetInput(ownerUserId, input);
  const existingDefault = await getAgentExecutionLaunchDefaultPreset(ownerUserId);
  const created = await db.transaction(async (tx) => {
    const timestamp = now();
    const [row] = await tx
      .insert(agentExecutionLaunchPresets)
      .values({
        id: crypto.randomUUID(),
        ownerUserId,
        name: normalized.name,
        description: normalized.description,
        preferredAgentId: normalized.preferredAgentId,
        runtimeProfileKey: normalized.runtimeProfileKey,
        callbackRemediationPolicyKey: normalized.callbackRemediationPolicyKey,
        titleTemplate: normalized.titleTemplate,
        objectiveTemplate: normalized.objectiveTemplate,
        launchGuidance: normalized.launchGuidance,
        followUpExecutionStatus: normalized.followUpExecutionStatus,
        followUpRunKind: normalized.followUpRunKind,
        followUpRunStatus: normalized.followUpRunStatus,
        followUpFailureCategory: normalized.followUpFailureCategory,
        followUpRecentWindow: normalized.followUpRecentWindow,
        followUpCallbackStatus: normalized.followUpCallbackStatus,
        followUpCallbackRetryability: normalized.followUpCallbackRetryability,
        followUpCallbackType: normalized.followUpCallbackType,
        followUpCallbackRejectionCategory: normalized.followUpCallbackRejectionCategory,
        followUpReplayPayloadCompatibility: normalized.followUpReplayPayloadCompatibility,
        followUpReplayPayloadReplayable: normalized.followUpReplayPayloadReplayable,
        followUpDecisionClass: normalized.followUpDecisionClass,
        followUpReplayFailureClass: normalized.followUpReplayFailureClass,
        followUpRuntimeDecisionClass: normalized.followUpRuntimeDecisionClass,
        followUpRuntimeDecisionSeverity: normalized.followUpRuntimeDecisionSeverity,
        followUpPressureLevel: normalized.followUpPressureLevel,
        followUpSchedulingDecisionClass: normalized.followUpSchedulingDecisionClass,
        followUpRuntimeSessionKind: normalized.followUpRuntimeSessionKind,
        followUpRuntimeSessionState: normalized.followUpRuntimeSessionState,
        focusSection: normalized.focusSection,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new ConflictError("Execution launch preset could not be created");
    }

    if (normalized.isDefault === true || !existingDefault) {
      await setOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId, row.id);
    }
    return row;
  });

  if (!created) {
    throw new ConflictError("Execution launch preset could not be created");
  }
  return getOwnedAgentExecutionLaunchPresetView(ownerUserId, created.id);
}

export async function updateOwnedAgentExecutionLaunchPreset(
  ownerUserId: string,
  presetId: string,
  input: UpdateAgentExecutionLaunchPresetInput,
): Promise<AgentExecutionLaunchPresetView> {
  const existing = await getOwnedAgentExecutionLaunchPreset(ownerUserId, presetId);
  if (!existing) {
    throw new NotFoundError("Execution launch preset not found");
  }

  const normalized = await normalizeAgentExecutionLaunchPresetInput(ownerUserId, input);
  const defaultPreset = await getAgentExecutionLaunchDefaultPreset(ownerUserId);
  await db.transaction(async (tx) => {
    await tx
      .update(agentExecutionLaunchPresets)
      .set({
        name: normalized.name,
        description: normalized.description,
        preferredAgentId: normalized.preferredAgentId,
        runtimeProfileKey: normalized.runtimeProfileKey,
        callbackRemediationPolicyKey: normalized.callbackRemediationPolicyKey,
        titleTemplate: normalized.titleTemplate,
        objectiveTemplate: normalized.objectiveTemplate,
        launchGuidance: normalized.launchGuidance,
        followUpExecutionStatus: normalized.followUpExecutionStatus,
        followUpRunKind: normalized.followUpRunKind,
        followUpRunStatus: normalized.followUpRunStatus,
        followUpFailureCategory: normalized.followUpFailureCategory,
        followUpRecentWindow: normalized.followUpRecentWindow,
        followUpCallbackStatus: normalized.followUpCallbackStatus,
        followUpCallbackRetryability: normalized.followUpCallbackRetryability,
        followUpCallbackType: normalized.followUpCallbackType,
        followUpCallbackRejectionCategory: normalized.followUpCallbackRejectionCategory,
        followUpReplayPayloadCompatibility: normalized.followUpReplayPayloadCompatibility,
        followUpReplayPayloadReplayable: normalized.followUpReplayPayloadReplayable,
        followUpDecisionClass: normalized.followUpDecisionClass,
        followUpReplayFailureClass: normalized.followUpReplayFailureClass,
        followUpRuntimeDecisionClass: normalized.followUpRuntimeDecisionClass,
        followUpRuntimeDecisionSeverity: normalized.followUpRuntimeDecisionSeverity,
        followUpPressureLevel: normalized.followUpPressureLevel,
        followUpSchedulingDecisionClass: normalized.followUpSchedulingDecisionClass,
        followUpRuntimeSessionKind: normalized.followUpRuntimeSessionKind,
        followUpRuntimeSessionState: normalized.followUpRuntimeSessionState,
        focusSection: normalized.focusSection,
        updatedAt: now(),
      })
      .where(eq(agentExecutionLaunchPresets.id, existing.id));

    if (normalized.isDefault === true) {
      await setOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId, existing.id);
    } else if (normalized.isDefault === false && defaultPreset?.presetId === existing.id) {
      await clearOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId);
    }
  });

  return getOwnedAgentExecutionLaunchPresetView(ownerUserId, existing.id);
}

export async function deleteOwnedAgentExecutionLaunchPreset(ownerUserId: string, presetId: string): Promise<void> {
  const existing = await getOwnedAgentExecutionLaunchPreset(ownerUserId, presetId);
  if (!existing) {
    throw new NotFoundError("Execution launch preset not found");
  }

  const defaultPreset = await getAgentExecutionLaunchDefaultPreset(ownerUserId);
  await db.transaction(async (tx) => {
    await tx.delete(agentExecutionLaunchPresets).where(eq(agentExecutionLaunchPresets.id, existing.id));

    if (defaultPreset?.presetId === existing.id) {
      const [fallbackPreset] = await tx
        .select({ id: agentExecutionLaunchPresets.id })
        .from(agentExecutionLaunchPresets)
        .where(eq(agentExecutionLaunchPresets.ownerUserId, ownerUserId))
        .orderBy(desc(agentExecutionLaunchPresets.updatedAt), desc(agentExecutionLaunchPresets.createdAt));
      if (fallbackPreset) {
        await setOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId, fallbackPreset.id);
      } else {
        await clearOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId);
      }
    }
  });
}

function buildRuntimeArtifactDescriptor(args: {
  execution: typeof agentExecutions.$inferSelect;
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
  producedArtifactCount: number;
}) {
  const checklist = normalizeObjectiveChecklist(args.execution.objectiveChecklist, args.execution.objective);
  if (args.runtimeProfile.artifactMode === "checklist_progressive" && checklist.length > 0) {
    const targetArtifactCount = Math.max(1, args.execution.targetArtifactCount);
    const primaryArtifactSlotCount = Math.max(1, Math.min(targetArtifactCount, checklist.length));
    const chunkSize = Math.max(1, Math.ceil(checklist.length / primaryArtifactSlotCount));
    const artifactIndex = Math.max(0, args.producedArtifactCount - 1);
    if (artifactIndex < primaryArtifactSlotCount) {
      const startIndex = artifactIndex * chunkSize;
      const entries = checklist.slice(startIndex, startIndex + chunkSize);
      const firstEntry = entries[0] ?? checklist[Math.min(artifactIndex, checklist.length - 1)];
      const entryLabel =
        entries.length === 1
          ? `checklist entry ${firstEntry.order}`
          : `checklist entries ${entries[0]?.order ?? firstEntry.order}-${entries[entries.length - 1]?.order ?? firstEntry.order}`;
      const summary =
        entries.length === 1
          ? `Runtime processed ${entryLabel}: ${firstEntry.text}`
          : `Runtime processed ${entryLabel}: ${firstEntry.text} + ${entries.length - 1} more item(s)`;
      return {
        title: entries.length === 1 ? `Checklist artifact ${args.producedArtifactCount}` : `Checklist batch ${args.producedArtifactCount}`,
        summary,
        payload: {
          checklistEntries: entries,
          artifactMode: args.runtimeProfile.artifactMode,
          runtimePlanVersion: args.runtimeProfile.runtimePlanVersion,
          artifactSlot: args.producedArtifactCount,
          artifactSlots: targetArtifactCount,
        },
      };
    }

    const synthesisEntries = checklist.slice(Math.max(0, checklist.length - Math.min(3, checklist.length)));
    return {
      title: `Runtime synthesis ${args.producedArtifactCount}`,
      summary: `Runtime synthesized ${synthesisEntries.length} checklist entr${synthesisEntries.length === 1 ? "y" : "ies"} into an aggregated artifact.`,
      payload: {
        checklistEntries: synthesisEntries,
        artifactMode: args.runtimeProfile.artifactMode,
        runtimePlanVersion: args.runtimeProfile.runtimePlanVersion,
        artifactSlot: args.producedArtifactCount,
        artifactSlots: targetArtifactCount,
        synthesized: true,
      },
    };
  }

  return {
    title: `Platform executor result ${args.producedArtifactCount}`,
    summary: `Platform executor generated artifact ${args.producedArtifactCount} for ${args.execution.title}.`,
    payload: {
      artifactMode: args.runtimeProfile.artifactMode,
      runtimePlanVersion: args.runtimeProfile.runtimePlanVersion,
      executionTitle: args.execution.title,
    },
  };
}

function getRuntimePhaseChecklistContext(args: {
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  phase: Extract<PlatformExecutionPhase, "prepare" | "finalize">;
  passNumber: number;
}) {
  const phaseEntries = args.objectiveChecklist.filter((entry) => entry.runtimePhase === args.phase);
  if (phaseEntries.length === 0) {
    return null;
  }
  const entry = phaseEntries[Math.min(Math.max(0, args.passNumber - 1), phaseEntries.length - 1)];
  return {
    entry,
    phaseEntries,
  };
}

async function ensureRuntimeManagedSubtasksInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
) {
  const existing = await tx
    .select()
    .from(agentExecutionSubtasks)
    .where(and(eq(agentExecutionSubtasks.executionId, execution.id), eq(agentExecutionSubtasks.managedByRuntime, true)))
    .orderBy(asc(agentExecutionSubtasks.sortOrder));

  if (existing.length > 0) {
    return existing;
  }

  const checklist = normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective);
  if (checklist.length === 0) {
    return existing;
  }

  const [sortRow] = await tx
    .select({
      maxSortOrder: sql<number>`coalesce(max(${agentExecutionSubtasks.sortOrder}), -1)::int`,
    })
    .from(agentExecutionSubtasks)
    .where(eq(agentExecutionSubtasks.executionId, execution.id));

  const timestamp = now();
  await tx.insert(agentExecutionSubtasks).values(
    checklist.map((item, index) => ({
      id: crypto.randomUUID(),
      executionId: execution.id,
      parentSubtaskId: null,
      title: item.text,
      detail: `Runtime-managed objective ${item.order}`,
      status: "pending",
      managedByRuntime: true,
      runtimePhase: item.runtimePhase,
      sortOrder: Number(sortRow?.maxSortOrder ?? -1) + index + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    })),
  );

  return tx
    .select()
    .from(agentExecutionSubtasks)
    .where(and(eq(agentExecutionSubtasks.executionId, execution.id), eq(agentExecutionSubtasks.managedByRuntime, true)))
    .orderBy(asc(agentExecutionSubtasks.sortOrder));
}

async function syncRuntimeManagedSubtasksInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
  signal: "claim" | "advance" | "complete" | "failed" | "cancelled" | "requeue",
) {
  const sourceAgent = await tx
    .select({ sourceType: agents.sourceType })
    .from(agents)
    .where(eq(agents.id, execution.agentId))
    .limit(1);

  if (sourceAgent[0]?.sourceType !== "platform") {
    return;
  }

  const subtasks = await ensureRuntimeManagedSubtasksInTx(tx, execution);
  if (subtasks.length === 0) {
    return;
  }

  const running = subtasks.find((item) => item.status === "running") ?? null;
  const firstPending = subtasks.find((item) => item.status === "pending") ?? null;
  const timestamp = now();

  if (signal === "claim") {
    if (!running && firstPending) {
      await tx
        .update(agentExecutionSubtasks)
        .set({
          status: "running",
          updatedAt: timestamp,
          detail: firstPending.detail ?? "Runtime claimed this checklist item.",
        })
        .where(eq(agentExecutionSubtasks.id, firstPending.id));
    }
    return;
  }

  if (signal === "requeue") {
    await tx
      .update(agentExecutionSubtasks)
      .set({
        status: "pending",
        updatedAt: timestamp,
        completedAt: null,
      })
      .where(
        and(
          eq(agentExecutionSubtasks.executionId, execution.id),
          eq(agentExecutionSubtasks.managedByRuntime, true),
          inArray(agentExecutionSubtasks.status, ["running", "failed", "cancelled"] as AgentExecutionSubtaskStatus[]),
        ),
      );
    return;
  }

  if (signal === "advance") {
    if (running) {
      await tx
        .update(agentExecutionSubtasks)
        .set({
          status: "completed",
          updatedAt: timestamp,
          completedAt: running.completedAt ?? timestamp,
        })
        .where(eq(agentExecutionSubtasks.id, running.id));
    } else if (firstPending) {
      await tx
        .update(agentExecutionSubtasks)
        .set({
          status: "completed",
          updatedAt: timestamp,
          completedAt: timestamp,
        })
        .where(eq(agentExecutionSubtasks.id, firstPending.id));
    }

    const refresh = await tx
      .select()
      .from(agentExecutionSubtasks)
      .where(and(eq(agentExecutionSubtasks.executionId, execution.id), eq(agentExecutionSubtasks.managedByRuntime, true)))
      .orderBy(asc(agentExecutionSubtasks.sortOrder));
    const nextPending = refresh.find((item) => item.status === "pending") ?? null;
    if (nextPending) {
      await tx
        .update(agentExecutionSubtasks)
        .set({
          status: "running",
          updatedAt: timestamp,
        })
        .where(eq(agentExecutionSubtasks.id, nextPending.id));
    }
    return;
  }

  if (signal === "complete") {
    await tx
      .update(agentExecutionSubtasks)
      .set({
        status: "completed",
        updatedAt: timestamp,
        completedAt: timestamp,
      })
      .where(
        and(
          eq(agentExecutionSubtasks.executionId, execution.id),
          eq(agentExecutionSubtasks.managedByRuntime, true),
          inArray(agentExecutionSubtasks.status, ["pending", "running"] as AgentExecutionSubtaskStatus[]),
        ),
      );
    return;
  }

  const terminalStatus: AgentExecutionSubtaskStatus = signal === "failed" ? "failed" : "cancelled";
  await tx
    .update(agentExecutionSubtasks)
    .set({
      status: terminalStatus,
      updatedAt: timestamp,
      completedAt: timestamp,
    })
    .where(
      and(
        eq(agentExecutionSubtasks.executionId, execution.id),
        eq(agentExecutionSubtasks.managedByRuntime, true),
        inArray(agentExecutionSubtasks.status, ["pending", "running"] as AgentExecutionSubtaskStatus[]),
      ),
    );
}

function toStoredExecutionOutputEnvelope(
  envelope: AgentExecutionOutputEnvelope | null | undefined,
): {
  outputVersion: number | null;
  outputKind: string | null;
  outputPayload: Record<string, unknown> | null;
  outputGeneratedAt: Date | null;
} {
  if (!envelope) {
    return {
      outputVersion: null,
      outputKind: null,
      outputPayload: null,
      outputGeneratedAt: null,
    };
  }

  return {
    outputVersion: envelope.version,
    outputKind: envelope.kind,
    outputPayload: envelope.payload,
    outputGeneratedAt: envelope.generatedAt ? new Date(envelope.generatedAt) : null,
  };
}

function toExecutionOutputEnvelope(row: typeof agentExecutions.$inferSelect): AgentExecutionOutputEnvelope | null {
  if (!row.outputKind || row.outputVersion === null) {
    return null;
  }

  return {
    version: row.outputVersion,
    kind: row.outputKind as AgentExecutionOutputKind,
    title:
      row.outputKind === "artifact_bundle"
        ? "Execution artifact bundle"
        : row.outputKind === "runtime_result"
          ? "Execution runtime result"
          : "Execution status report",
    summary: row.resultSummary ?? null,
    payload: toSerializablePayload(row.outputPayload),
    generatedAt: row.outputGeneratedAt ? row.outputGeneratedAt.toISOString() : null,
  };
}

function buildArtifactBundleOutputEnvelope(args: {
  executionId: string;
  artifacts: Array<{
    id: string;
    kind: string;
    title: string;
    url: string | null;
    summary: string | null;
    createdAt: Date;
  }>;
  generatedAt: Date;
}): AgentExecutionOutputEnvelope {
  const latestArtifact = args.artifacts.at(-1) ?? null;
  return buildExecutionOutputEnvelope({
    kind: "artifact_bundle",
    title: "Execution artifact bundle",
    summary: latestArtifact?.summary ?? latestArtifact?.title ?? null,
    generatedAt: args.generatedAt,
    payload: {
      executionId: args.executionId,
      artifactCount: args.artifacts.length,
      latestArtifact: latestArtifact
        ? {
            id: latestArtifact.id,
            kind: latestArtifact.kind,
            title: latestArtifact.title,
            url: latestArtifact.url,
            summary: latestArtifact.summary,
            createdAt: latestArtifact.createdAt.toISOString(),
          }
        : null,
      artifacts: args.artifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        title: artifact.title,
        url: artifact.url,
        summary: artifact.summary,
        createdAt: artifact.createdAt.toISOString(),
      })),
    },
  });
}

function buildStatusReportOutputEnvelope(args: {
  executionId: string;
  status: AgentExecutionStatus;
  statusNote?: string | null;
  resultSummary?: string | null;
  generatedAt: Date;
}): AgentExecutionOutputEnvelope {
  return buildExecutionOutputEnvelope({
    kind: "status_report",
    title: "Execution status report",
    summary: args.resultSummary ?? args.statusNote ?? null,
    generatedAt: args.generatedAt,
    payload: {
      executionId: args.executionId,
      status: args.status,
      statusNote: args.statusNote ?? null,
      resultSummary: args.resultSummary ?? null,
    },
  });
}

function toAgentExecutionArtifactView(
  row: typeof agentExecutionArtifacts.$inferSelect,
): AgentExecutionArtifactView {
  return {
    id: row.id,
    executionId: row.executionId,
    kind: row.kind as AgentExecutionArtifactKind,
    title: row.title,
    url: row.url,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAgentExecutionStepView(
  row: typeof agentExecutionSteps.$inferSelect,
): AgentExecutionStepView {
  return {
    id: row.id,
    executionId: row.executionId,
    kind: row.kind as AgentExecutionStepKind,
    phase: (row.phase as PlatformExecutionPhase | null) ?? null,
    title: row.title,
    detail: row.detail,
    status: row.status as AgentExecutionStepStatus,
    progressPercent: row.progressPercent,
    costUnits: row.costUnits,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAgentExecutionSubtaskView(
  row: typeof agentExecutionSubtasks.$inferSelect,
  ownerUserId: string,
  viewerUserId: string,
): AgentExecutionSubtaskView {
  return {
    id: row.id,
    executionId: row.executionId,
    parentSubtaskId: row.parentSubtaskId,
    title: row.title,
    detail: row.detail,
    status: row.status as AgentExecutionSubtaskStatus,
    managedByRuntime: row.managedByRuntime,
    runtimePhase: (row.runtimePhase as PlatformExecutionPhase | null) ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    canUpdateStatus:
      ownerUserId === viewerUserId &&
      !row.managedByRuntime &&
      (subtaskTransitionMap[row.status as AgentExecutionSubtaskStatus]?.length ?? 0) > 0,
  };
}

type AgentExecutionCallbackPlanAgentContext = {
  sourceType: AgentSourceType;
  enabled: boolean;
};

async function buildAgentExecutionCallbackPlanAgentMap(agentIds: string[]) {
  if (agentIds.length === 0) {
    return new Map<string, AgentExecutionCallbackPlanAgentContext>();
  }

  const rows = await db
    .select({
      id: agents.id,
      sourceType: agents.sourceType,
      enabled: agents.enabled,
    })
    .from(agents)
    .where(inArray(agents.id, Array.from(new Set(agentIds))));

  return new Map(
    rows.map((row) => [
      row.id,
      {
        sourceType: row.sourceType as AgentSourceType,
        enabled: row.enabled,
      },
    ]),
  );
}

function toAgentExecutionCallbackAuditView(
  row: typeof agentExecutionCallbacks.$inferSelect,
  remediationAttempts: AgentExecutionCallbackRemediationAttemptView[] = [],
  agentContext?: AgentExecutionCallbackPlanAgentContext,
  runtimeContext?: AgentExecutionCallbackRuntimeContextView | null,
): AgentExecutionCallbackAuditView {
  const guidance = getExternalCallbackRetryGuidance(
    (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
  );
  const autoRemediationReasonCategory = classifyAutoRemediationReasonCategory(row.autoRemediationLastError);
  const autoRemediationReasonDisposition = getAutoRemediationReasonDisposition(autoRemediationReasonCategory);
  const remediationPolicyKey = normalizeRemediationPolicyKey(row.remediationPolicyKey);
  const replayPayloadResolution = resolveStoredExternalCallbackReplayEnvelope(row.replayPayload);
  const remediationPlan = buildCallbackRemediationPlan({
    status: row.status as AgentExecutionCallbackAuditStatus,
    agentSourceType: agentContext?.sourceType ?? "external",
    agentEnabled: agentContext?.enabled ?? true,
    usedPreviousProtocol: row.usedPreviousProtocol,
    usedPreviousSecret: row.usedPreviousSecret,
    retryability: (guidance.retryability as AgentExecutionCallbackRetryability | null) ?? null,
    rejectionCategory: (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
    policy: buildAgentCallbackRemediationPolicyView(remediationPolicyKey),
    replayPayload: replayPayloadResolution,
    autoRemediationAttempts: row.autoRemediationAttempts,
  });
  return {
    id: row.id,
    executionId: row.executionId,
    agentId: row.agentId,
    remediationPolicyKey,
    callbackId: row.callbackId,
    callbackType: row.callbackType as AgentExecutionCallbackType,
    status: row.status as AgentExecutionCallbackAuditStatus,
    callbackVersion: row.callbackVersion,
    secretVersion: row.secretVersion,
    usedPreviousProtocol: row.usedPreviousProtocol,
    usedPreviousSecret: row.usedPreviousSecret,
    callbackTimestamp: row.callbackTimestamp ? row.callbackTimestamp.toISOString() : null,
    rejectionCategory: (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
    retryability: guidance.retryability as AgentExecutionCallbackRetryability | null,
    retryHint: guidance.retryHint,
    payloadSummary: row.payloadSummary,
    replayPayloadStored: replayPayloadResolution.stored,
    replayPayloadReplayable: replayPayloadResolution.replayable,
    replayPayloadCompatibility: replayPayloadResolution.compatibility,
    replayPayloadSchemaVersion: replayPayloadResolution.schemaVersion,
    remediationPlan,
    autoRemediationAttempts: row.autoRemediationAttempts,
    lastAutoRemediationAt: row.lastAutoRemediationAt ? row.lastAutoRemediationAt.toISOString() : null,
    nextAutoRemediationAt: row.nextAutoRemediationAt ? row.nextAutoRemediationAt.toISOString() : null,
    autoRemediationExhaustedAt: row.autoRemediationExhaustedAt
      ? row.autoRemediationExhaustedAt.toISOString()
      : null,
    autoRemediationLastError: row.autoRemediationLastError,
    autoRemediationState: getCallbackAutoRemediationState(row),
    autoRemediationReasonCategory:
      (autoRemediationReasonCategory as AgentExecutionCallbackAutoRemediationReasonCategory | null) ?? null,
    autoRemediationReasonDisposition:
      (autoRemediationReasonDisposition as AgentExecutionCallbackAutoRemediationReasonDisposition | null) ?? null,
    runtimeContext: runtimeContext ?? null,
    receivedAt: row.receivedAt.toISOString(),
    remediationAttempts,
  };
}

function toAgentExecutionCallbackRemediationAttemptView(
  row: typeof agentExecutionCallbackRemediations.$inferSelect,
): AgentExecutionCallbackRemediationAttemptView {
  return {
    id: row.id,
    callbackAuditId: row.callbackAuditId,
    executionId: row.executionId,
    agentId: row.agentId,
    runId: row.runId,
    actorUserId: row.actorUserId,
    mode: row.mode as AgentExecutionCallbackRemediationMode,
    status: row.status as AgentExecutionCallbackRemediationAttemptStatus,
    plannedDecisionClass:
      (row.plannedDecisionClass as AgentExecutionCallbackAuditView["remediationPlan"]["decisionClass"] | null) ?? null,
    plannedPrimaryAction: (row.plannedPrimaryAction as AgentExecutionCallbackAuditView["remediationPlan"]["primaryAction"] | null) ?? null,
    plannedFallbackAction:
      (row.plannedFallbackAction as AgentExecutionCallbackAuditView["remediationPlan"]["fallbackAction"] | null) ?? null,
    planReasonCategory:
      (row.planReasonCategory as AgentExecutionCallbackAutoRemediationReasonCategory | null) ?? null,
    planReason: row.planReason ?? null,
    fallbackFailureClass:
      (row.fallbackFailureClass as AgentExecutionCallbackReplayFailureClass | null) ?? null,
    fallbackReason: row.fallbackReason ?? null,
    note: row.note,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function toAgentExecutionRunView(
  row: typeof agentExecutionRuns.$inferSelect,
): AgentExecutionRunView {
  return {
    id: row.id,
    executionId: row.executionId,
    agentId: row.agentId,
    ownerUserId: row.ownerUserId,
    runKind: row.runKind as AgentExecutionRunView["runKind"],
    status: row.status as AgentExecutionRunView["status"],
    failureCategory: classifyExecutionRunFailure({
      runKind: row.runKind as AgentExecutionRunView["runKind"],
      status: row.status as AgentExecutionRunStatus,
      summary: row.summary,
      errorMessage: row.errorMessage,
    }),
    summary: row.summary,
    errorMessage: row.errorMessage,
    artifactCount: row.artifactCount,
    costUnits: row.costUnits,
    resourceMinutes: row.resourceMinutes,
    estimatedAmount: row.estimatedAmount,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function toAgentExecutionOperatorRunView(args: {
  run: typeof agentExecutionRuns.$inferSelect;
  execution: typeof agentExecutions.$inferSelect;
  agent: typeof agents.$inferSelect;
}): AgentExecutionOperatorRunView {
  const output = toExecutionOutputEnvelope(args.execution);
  return {
    ...toAgentExecutionRunView(args.run),
    executionTitle: args.execution.title,
    executionStatus: args.execution.status as AgentExecutionStatus,
    executionUpdatedAt: args.execution.updatedAt.toISOString(),
    executorPhase: (args.execution.executorPhase as PlatformExecutionPhase | null) ?? null,
    progressPercent: args.execution.progressPercent,
    agentName: args.agent.name,
    agentSourceType: args.agent.sourceType as AgentSourceType,
    callbackAuditId: extractCallbackRetryAuditId(args.run.summary),
    failureCategory: classifyExecutionRunFailure({
      runKind: args.run.runKind as AgentExecutionRunView["runKind"],
      status: args.run.status as AgentExecutionRunStatus,
      summary: args.run.summary,
      errorMessage: args.run.errorMessage,
    }),
    runtimeDecision: resolveRuntimeDecisionFromPayload(output?.payload ?? null),
  };
}

function buildExecutionPhaseDiagnostics(row: typeof agentExecutions.$inferSelect) {
  const phase = (row.executorPhase as PlatformExecutionPhase | null) ?? null;
  const phaseTimeoutSeconds = phase ? getExecutionPhaseTimeoutSeconds(phase) : null;
  const phaseAgeSeconds = getExecutionPhaseAgeSeconds({
    updatedAt: row.updatedAt,
    status: row.status as AgentExecutionStatus,
    phase,
  });

  return {
    phase,
    phaseTimeoutSeconds,
    phaseAgeSeconds,
    phaseOverdue:
      phaseTimeoutSeconds !== null && phaseAgeSeconds !== null ? phaseAgeSeconds >= phaseTimeoutSeconds : false,
  };
}

function toAgentExecutionRuntimeSessionView(
  row: typeof agentExecutionRuntimeSessions.$inferSelect,
  execution: typeof agentExecutions.$inferSelect,
): AgentExecutionRuntimeSessionView {
  const diagnostics = buildExecutionPhaseDiagnostics(execution);
  return {
    id: row.id,
    executionId: row.executionId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    executionTitle: execution.title,
    executionStatus: execution.status as AgentExecutionStatus,
    runId: row.runId,
    kind: row.kind as AgentExecutionRuntimeSessionView["kind"],
    state: row.state as AgentExecutionRuntimeSessionState,
    trigger: row.trigger as AgentExecutionRuntimeSessionView["trigger"],
    startedPhase: (row.startedPhase as PlatformExecutionPhase | null) ?? null,
    endedPhase: (row.endedPhase as PlatformExecutionPhase | null) ?? null,
    executorPhase: diagnostics.phase,
    progressPercent: execution.progressPercent,
    phaseTimeoutSeconds: diagnostics.phaseTimeoutSeconds,
    phaseAgeSeconds: diagnostics.phaseAgeSeconds,
    phaseOverdue: diagnostics.phaseOverdue,
    note: row.note,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAgentExecutionView(
  row: typeof agentExecutions.$inferSelect,
  viewerUserId: string,
  remediationPolicyMetadata: ExecutionCallbackRemediationPolicyMetadata,
  artifacts: AgentExecutionArtifactView[] = [],
  steps: AgentExecutionStepView[] = [],
  subtasks: AgentExecutionSubtaskView[] = [],
  runtimeSessions: AgentExecutionRuntimeSessionView[] = [],
  callbacks: AgentExecutionCallbackAuditView[] = [],
  runs: AgentExecutionRunView[] = [],
  settlement: AgentExecutionSettlementView | null = null,
): AgentExecutionView {
  const phase = (row.executorPhase as PlatformExecutionPhase | null) ?? null;
  const output = toExecutionOutputEnvelope(row);
  const runtimeDecision = resolveRuntimeDecisionFromPayload(output?.payload ?? null);
  const phaseTimeoutSeconds = phase ? getExecutionPhaseTimeoutSeconds(phase) : null;
  const phaseAgeSeconds = getExecutionPhaseAgeSeconds({
    updatedAt: row.updatedAt,
    status: row.status as AgentExecutionStatus,
    phase,
  });
  const totalCostUnits = runs.reduce((sum, run) => sum + run.costUnits, 0);
  const totalStepCostUnits = steps.reduce((sum, step) => sum + step.costUnits, 0);
  const totalResourceMinutes = runs.reduce((sum, run) => sum + run.resourceMinutes, 0);
  const totalEstimatedAmount = runs.reduce((sum, run) => sum + run.estimatedAmount, 0);
  const producedArtifactCount = artifacts.length;
  const remainingArtifactCount = Math.max(0, row.targetArtifactCount - producedArtifactCount);
  const estimatedRemainingCostUnits = terminalExecutionStatuses.has(row.status as AgentExecutionStatus)
    ? 0
    : getRemainingExecutionPhaseCostUnits(phase) + remainingArtifactCount * env.agentExecutionArtifactCostUnits;
  const runtimeProfile = toRuntimeProfileView(row);
  const costSummary = {
    totalCostUnits,
    totalStepCostUnits,
    totalResourceMinutes,
    totalEstimatedAmount,
    estimatedRemainingCostUnits,
    budgetCostUnits: runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
    budgetStatus: getExecutionBudgetStatus({
      totalCostUnits,
      totalResourceMinutes,
      budgetCostUnits: runtimeProfile.budgetCostUnits,
      budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
    }),
  } satisfies AgentExecutionView["costSummary"];
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    capabilityId: row.capabilityId ?? null,
    agentSourceType: remediationPolicyMetadata.agentSourceType,
    taskId: row.taskId,
    title: row.title,
    objective: row.objective,
    objectiveChecklist: normalizeObjectiveChecklist(row.objectiveChecklist, row.objective),
    inputResourcePayload: toRecordPayload(row.inputResourcePayload),
    normalizedResourcePayload: toRecordPayload(row.normalizedResourcePayload),
    outputResourcePayload: toRecordPayload(row.outputResourcePayload),
    status: row.status as AgentExecutionStatus,
    statusNote: row.statusNote,
    resultSummary: row.resultSummary,
    runtimeProfileKey: runtimeProfile.key,
    runtimeProfile,
    callbackRemediationPolicyKey: remediationPolicyMetadata.key,
    callbackRemediationPolicy: remediationPolicyMetadata.policy,
    callbackRemediationPolicySource: remediationPolicyMetadata.source,
    callbackRemediationPolicyOverrideKey: remediationPolicyMetadata.overrideKey,
    targetArtifactCount: row.targetArtifactCount,
    executorPhase: phase,
    progressPercent: row.progressPercent,
    phaseTimeoutSeconds,
    phaseAgeSeconds,
    phaseOverdue: phaseTimeoutSeconds !== null && phaseAgeSeconds !== null ? phaseAgeSeconds >= phaseTimeoutSeconds : false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    lastExternalCallbackAt: row.lastExternalCallbackAt ? row.lastExternalCallbackAt.toISOString() : null,
    lastHeartbeatAt: row.lastHeartbeatAt ? row.lastHeartbeatAt.toISOString() : null,
    autoRecoveryCount: row.autoRecoveryCount,
    maxAutoRecoveryCount: row.maxAutoRecoveryCount,
    recoveryExhaustedAt: row.recoveryExhaustedAt ? row.recoveryExhaustedAt.toISOString() : null,
    totalCostUnits,
    costByRunKind: buildExecutionCostBuckets(runs),
    totalStepCostUnits,
    costByStepKind: buildStepCostBuckets(steps),
    estimatedRemainingCostUnits,
    costSummary,
    settlement,
    marketplaceInvocation: toMarketplaceInvocationSnapshotView(row.marketplaceInvocation),
    output,
    runtimeDecision,
    artifacts,
    steps,
    subtasks,
    runtimeSessions,
    callbacks,
    runs,
    canUpdateStatus: row.ownerUserId === viewerUserId && transitionMap[row.status as AgentExecutionStatus].length > 0,
    canRequeue:
      row.ownerUserId === viewerUserId &&
      row.executorPhase !== null &&
      ["failed", "cancelled"].includes(row.status as AgentExecutionStatus),
  };
}

async function buildCallbackRemediationAttemptMap(callbackAuditIds: string[]) {
  if (callbackAuditIds.length === 0) {
    return new Map<string, AgentExecutionCallbackRemediationAttemptView[]>();
  }

  const rows = await db
    .select()
    .from(agentExecutionCallbackRemediations)
    .where(inArray(agentExecutionCallbackRemediations.callbackAuditId, callbackAuditIds))
    .orderBy(desc(agentExecutionCallbackRemediations.createdAt));

  const map = new Map<string, AgentExecutionCallbackRemediationAttemptView[]>();
  for (const row of rows) {
    const attempts = map.get(row.callbackAuditId) ?? [];
    attempts.push(toAgentExecutionCallbackRemediationAttemptView(row));
    map.set(row.callbackAuditId, attempts);
  }
  return map;
}

function getAgentExecutionEventName(status: AgentExecutionStatus) {
  switch (status) {
    case "running":
      return "agentExecution.started";
    case "submitted":
      return "agentExecution.submitted";
    case "completed":
      return "agentExecution.completed";
    case "failed":
      return "agentExecution.failed";
    case "cancelled":
      return "agentExecution.cancelled";
    case "queued":
      return "agentExecution.created";
    default:
      return "agentExecution.created";
  }
}

async function buildArtifactMap(executionIds: string[]) {
  const artifactRows = await listArtifactsByExecutionIds(executionIds);
  const artifactMap = new Map<string, AgentExecutionArtifactView[]>();

  for (const row of artifactRows) {
    const artifacts = artifactMap.get(row.executionId) ?? [];
    artifacts.push(toAgentExecutionArtifactView(row));
    artifactMap.set(row.executionId, artifacts);
  }

  return artifactMap;
}

async function buildStepMap(executionIds: string[]) {
  const stepRows = await listStepsByExecutionIds(executionIds);
  const stepMap = new Map<string, AgentExecutionStepView[]>();

  for (const row of stepRows) {
    const steps = stepMap.get(row.executionId) ?? [];
    steps.push(toAgentExecutionStepView(row));
    stepMap.set(row.executionId, steps);
  }

  return stepMap;
}

async function buildSubtaskMap(
  executionIds: string[],
  ownerUserIdByExecutionId: Map<string, string>,
  viewerUserId: string,
) {
  const subtaskRows = await listSubtasksByExecutionIds(executionIds);
  const subtaskMap = new Map<string, AgentExecutionSubtaskView[]>();

  for (const row of subtaskRows) {
    const subtasks = subtaskMap.get(row.executionId) ?? [];
    const ownerUserId = ownerUserIdByExecutionId.get(row.executionId) ?? "";
    subtasks.push(toAgentExecutionSubtaskView(row, ownerUserId, viewerUserId));
    subtaskMap.set(row.executionId, subtasks);
  }

  return subtaskMap;
}

async function buildRuntimeSessionMap(executions: Array<typeof agentExecutions.$inferSelect>) {
  const executionIds = executions.map((row) => row.id);
  const sessionRows = await listRuntimeSessionsByExecutionIds(executionIds);
  const sessionMap = new Map<string, AgentExecutionRuntimeSessionView[]>();
  const executionById = new Map(executions.map((row) => [row.id, row]));

  for (const row of sessionRows) {
    const execution = executionById.get(row.executionId);
    if (!execution) {
      continue;
    }
    const sessions = sessionMap.get(row.executionId) ?? [];
    sessions.push(toAgentExecutionRuntimeSessionView(row, execution));
    sessionMap.set(row.executionId, sessions);
  }

  return sessionMap;
}

async function buildCallbackMap(executionIds: string[]) {
  const callbackRows = await listCallbacksByExecutionIds(executionIds);
  const attemptMap = await buildCallbackRemediationAttemptMap(callbackRows.map((row) => row.id));
  const agentMap = await buildAgentExecutionCallbackPlanAgentMap(callbackRows.map((row) => row.agentId));
  const runtimeContextMap = await buildCallbackAuditRuntimeContextMap(callbackRows.map((row) => row.executionId));
  const callbackMap = new Map<string, AgentExecutionCallbackAuditView[]>();

  for (const row of callbackRows) {
    const callbacks = callbackMap.get(row.executionId) ?? [];
    callbacks.push(
      toAgentExecutionCallbackAuditView(
        row,
        attemptMap.get(row.id) ?? [],
        agentMap.get(row.agentId),
        runtimeContextMap.get(row.executionId),
      ),
    );
    callbackMap.set(row.executionId, callbacks);
  }

  return callbackMap;
}

async function buildRunMap(executionIds: string[]) {
  const runRows = await listRunsByExecutionIds(executionIds);
  const runMap = new Map<string, AgentExecutionRunView[]>();

  for (const row of runRows) {
    const runs = runMap.get(row.executionId) ?? [];
    runs.push(toAgentExecutionRunView(row));
    runMap.set(row.executionId, runs);
  }

  return runMap;
}

async function buildSettlementMap(executionIds: string[]) {
  if (executionIds.length === 0) {
    return new Map<string, AgentExecutionSettlementView>();
  }

  const rows = await db
    .select()
    .from(agentExecutionSettlements)
    .where(inArray(agentExecutionSettlements.executionId, executionIds));
  const settlementIds = rows.map((row) => row.id);
  const lineItemRows =
    settlementIds.length > 0
      ? await db
          .select()
          .from(agentExecutionSettlementLineItems)
          .where(inArray(agentExecutionSettlementLineItems.settlementId, settlementIds))
          .orderBy(asc(agentExecutionSettlementLineItems.createdAt))
      : [];
  const lineItemMap = new Map<string, AgentExecutionSettlementLineItemView[]>();
  for (const row of lineItemRows) {
    const items = lineItemMap.get(row.settlementId) ?? [];
    items.push(toAgentExecutionSettlementLineItemView(row));
    lineItemMap.set(row.settlementId, items);
  }

  return new Map(
    rows.map((row) => [row.executionId, toAgentExecutionSettlementView(row, lineItemMap.get(row.id) ?? [])]),
  );
}

async function getExecutionSettlementByExecutionId(
  executionId: string,
  connection: NodePgDatabase<typeof schema> = db,
) {
  const [row] = await connection
    .select()
    .from(agentExecutionSettlements)
    .where(eq(agentExecutionSettlements.executionId, executionId))
    .limit(1);
  return row ?? null;
}

async function calculateExecutionBilledCostUnitsInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
) {
  const [runRow] = await tx
    .select({ total: sql<number>`coalesce(sum(${agentExecutionRuns.costUnits}), 0)::int` })
    .from(agentExecutionRuns)
    .where(eq(agentExecutionRuns.executionId, executionId));
  const [stepRow] = await tx
    .select({ total: sql<number>`coalesce(sum(${agentExecutionSteps.costUnits}), 0)::int` })
    .from(agentExecutionSteps)
    .where(eq(agentExecutionSteps.executionId, executionId));
  return Number(runRow?.total ?? 0) + Number(stepRow?.total ?? 0);
}

async function refreshExecutionSettlementLineItemsInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  settlement: typeof agentExecutionSettlements.$inferSelect;
}) {
  const [runRows, stepRows] = await Promise.all([
    args.tx
      .select({
        key: agentExecutionRuns.runKind,
        costUnits: sql<number>`coalesce(sum(${agentExecutionRuns.costUnits}), 0)::int`,
      })
      .from(agentExecutionRuns)
      .where(eq(agentExecutionRuns.executionId, args.settlement.executionId))
      .groupBy(agentExecutionRuns.runKind),
    args.tx
      .select({
        key: agentExecutionSteps.kind,
        costUnits: sql<number>`coalesce(sum(${agentExecutionSteps.costUnits}), 0)::int`,
      })
      .from(agentExecutionSteps)
      .where(eq(agentExecutionSteps.executionId, args.settlement.executionId))
      .groupBy(agentExecutionSteps.kind),
  ]);

  await args.tx
    .delete(agentExecutionSettlementLineItems)
    .where(eq(agentExecutionSettlementLineItems.settlementId, args.settlement.id));

  const timestamp = now();
  const rows: Array<typeof agentExecutionSettlementLineItems.$inferInsert> = [
    {
      id: crypto.randomUUID(),
      settlementId: args.settlement.id,
      executionId: args.settlement.executionId,
      ownerUserId: args.settlement.ownerUserId,
      agentId: args.settlement.agentId,
      lineKind: "owner_charge",
      title: "Owner charge",
      scopeType: "settlement",
      scopeId: args.settlement.id,
      costUnits: args.settlement.billedCostUnits,
      amount: args.settlement.billedAmount,
      createdAt: timestamp,
    },
  ];

  if (args.settlement.revenueRecipientUserId && args.settlement.revenueAmount > 0) {
    rows.push({
      id: crypto.randomUUID(),
      settlementId: args.settlement.id,
      executionId: args.settlement.executionId,
      ownerUserId: args.settlement.ownerUserId,
      agentId: args.settlement.agentId,
      lineKind: "revenue_share",
      title: "Agent revenue share",
      scopeType: "settlement",
      scopeId: args.settlement.id,
      costUnits: 0,
      amount: args.settlement.revenueAmount,
      createdAt: timestamp,
    });
  }

  for (const row of runRows) {
    rows.push({
      id: crypto.randomUUID(),
      settlementId: args.settlement.id,
      executionId: args.settlement.executionId,
      ownerUserId: args.settlement.ownerUserId,
      agentId: args.settlement.agentId,
      lineKind: "run_cost",
      title: `Run cost · ${row.key}`,
      scopeType: "run",
      scopeId: row.key,
      costUnits: Number(row.costUnits ?? 0),
      amount: estimateSettlementAmount(Number(row.costUnits ?? 0), args.settlement.costUnitsPerCurrency),
      createdAt: timestamp,
    });
  }

  for (const row of stepRows) {
    rows.push({
      id: crypto.randomUUID(),
      settlementId: args.settlement.id,
      executionId: args.settlement.executionId,
      ownerUserId: args.settlement.ownerUserId,
      agentId: args.settlement.agentId,
      lineKind: "step_cost",
      title: `Step cost · ${row.key}`,
      scopeType: "step",
      scopeId: row.key,
      costUnits: Number(row.costUnits ?? 0),
      amount: estimateSettlementAmount(Number(row.costUnits ?? 0), args.settlement.costUnitsPerCurrency),
      createdAt: timestamp,
    });
  }

  if (rows.length > 0) {
    await args.tx.insert(agentExecutionSettlementLineItems).values(rows);
  }
}

async function ensureExecutionSettlementPlanInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
) {
  const [agentRow] = await tx
    .select({ ownerUserId: agents.ownerUserId, sourceType: agents.sourceType })
    .from(agents)
    .where(eq(agents.id, execution.agentId))
    .limit(1);
  if (!agentRow) {
    throw new NotFoundError("Agent not found for execution settlement");
  }

  const runtimeProfile = resolveRuntimeProfile(execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null);
  const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
  const revenueContract = resolveExecutionRevenueContract(runtimeProfile.revenueContractKey, runtimeProfile.key);
  const pricingRuleResult = applyExecutionPricingPolicyRules({
    measuredCostUnits: await calculateExecutionBilledCostUnitsInTx(tx, execution.id),
    pricingPolicy,
  });
  const marketplaceInvocation = toMarketplaceInvocationSnapshotView(execution.marketplaceInvocation);
  const { measuredCostUnits, includedCostUnits, billedCostUnits, estimatedBilledAmount, billedAmount: runtimeBilledAmount } =
    pricingRuleResult;
  const billedAmount = marketplaceInvocation?.quotedAmount ?? runtimeBilledAmount;
  const settlementCurrency = (marketplaceInvocation?.priceCurrency ?? pricingPolicy.currency) as CurrencyKey;
  const revenueRecipientUserId =
    revenueContract.revenueRecipientMode === "agent_owner" && agentRow.ownerUserId !== execution.ownerUserId
      ? agentRow.ownerUserId
      : null;
  const calculatedRevenueAmount = revenueRecipientUserId
    ? Math.max(0, Math.floor((billedAmount * revenueContract.revenueSharePercent) / 100))
    : 0;
  const revenueAmount =
    revenueRecipientUserId && calculatedRevenueAmount >= revenueContract.minimumPayoutAmount
      ? calculatedRevenueAmount
      : 0;
  const timestamp = now();
  const plannedStatus: AgentExecutionSettlementStatus =
    !env.agentExecutionBillingEnabled || billedAmount <= 0 ? "skipped" : "pending";
  const note =
    !env.agentExecutionBillingEnabled
      ? "Execution billing is disabled."
      : billedAmount <= 0
        ? "Execution produced no billable cost units after pricing policy offsets."
        : marketplaceInvocation
          ? `Marketplace invocation settlement will charge ${billedAmount} ${settlementCurrency} using ${marketplaceInvocation.billingMode}${marketplaceInvocation.billingUnit ? ` / ${marketplaceInvocation.billingUnit}` : ""}.`
        : pricingRuleResult.pricingCapExceeded
          ? "Execution completed and reached the pricing policy cap before settlement."
        : billedAmount > estimatedBilledAmount
          ? "Execution completed and is awaiting settlement after minimum charge policy uplift."
          : calculatedRevenueAmount > 0 && revenueAmount === 0
            ? "Execution completed and is awaiting settlement; revenue share is withheld until minimum payout is reached."
            : "Execution completed and is awaiting settlement.";

  const existing = await getExecutionSettlementByExecutionId(execution.id, tx);
  if (existing) {
    const nextStatus =
      existing.status === "settled"
        ? "settled"
        : (plannedStatus as typeof existing.status);
    const [updated] = await tx
      .update(agentExecutionSettlements)
      .set({
        currency: settlementCurrency,
        runtimeProfileKey: execution.runtimeProfileKey,
        pricingPolicyKey: pricingPolicy.key,
        pricingPolicyVersion: pricingPolicy.version,
        costUnitsPerCurrency: pricingPolicy.costUnitsPerCurrency,
        revenueContractKey: revenueContract.key,
        revenueContractVersion: revenueContract.version,
        revenueRecipientMode: revenueContract.revenueRecipientMode,
        revenueSharePercent: revenueContract.revenueSharePercent,
        treasuryUserId: revenueContract.treasuryUserId,
        measuredCostUnits,
        includedCostUnits,
        billedCostUnits,
        minimumBilledAmount: pricingPolicy.minimumBilledAmount,
        billedAmount,
        revenueRecipientUserId,
        minimumPayoutAmount: revenueContract.minimumPayoutAmount,
        revenueAmount,
        status: nextStatus,
        note,
        updatedAt: timestamp,
      })
      .where(eq(agentExecutionSettlements.id, existing.id))
      .returning();
    await refreshExecutionSettlementLineItemsInTx({ tx, settlement: updated });
    return updated;
  }

  const [created] = await tx
    .insert(agentExecutionSettlements)
    .values({
      id: crypto.randomUUID(),
        executionId: execution.id,
        ownerUserId: execution.ownerUserId,
        agentId: execution.agentId,
        currency: settlementCurrency,
        runtimeProfileKey: execution.runtimeProfileKey,
        pricingPolicyKey: pricingPolicy.key,
        pricingPolicyVersion: pricingPolicy.version,
        costUnitsPerCurrency: pricingPolicy.costUnitsPerCurrency,
        revenueContractKey: revenueContract.key,
        revenueContractVersion: revenueContract.version,
        revenueRecipientMode: revenueContract.revenueRecipientMode,
        revenueSharePercent: revenueContract.revenueSharePercent,
        treasuryUserId: revenueContract.treasuryUserId,
        measuredCostUnits,
        includedCostUnits,
        billedCostUnits,
        minimumBilledAmount: pricingPolicy.minimumBilledAmount,
        billedAmount,
      revenueRecipientUserId,
      minimumPayoutAmount: revenueContract.minimumPayoutAmount,
      revenueAmount,
      status: plannedStatus,
      note,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  await refreshExecutionSettlementLineItemsInTx({ tx, settlement: created });
  return created;
}

async function enforceExecutionBudgetInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  execution: typeof agentExecutions.$inferSelect;
  runId: string;
}) {
  const runtimeProfile = resolveRuntimeProfile(
    (args.execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
  );
  if (runtimeProfile.budgetCostUnits === null && runtimeProfile.budgetResourceMinutes === null) {
    return null;
  }

  const billedCostUnits = await calculateExecutionBilledCostUnitsInTx(args.tx, args.execution.id);
  const [artifactRow, runTotals] = await Promise.all([
    args.tx
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(agentExecutionArtifacts)
      .where(eq(agentExecutionArtifacts.executionId, args.execution.id)),
    args.tx
      .select({
        totalResourceMinutes: sql<number>`coalesce(sum(${agentExecutionRuns.resourceMinutes}), 0)::int`,
      })
      .from(agentExecutionRuns)
      .where(eq(agentExecutionRuns.executionId, args.execution.id)),
  ]);

  const producedArtifactCount = Number(artifactRow[0]?.count ?? 0);
  const minimumContinuationArtifactCount = producedArtifactCount > 0 ? 0 : 1;
  const currentPhase = (args.execution.executorPhase as PlatformExecutionPhase | null) ?? "prepare";
  const finalizeReserveCostUnits = getFinalizeReserveCostUnitsForExecution({
    execution: args.execution,
    runtimeProfile,
  });
  const finalizeReserveResourceMinutes = getFinalizeReserveResourceMinutesForExecution({
    execution: args.execution,
    runtimeProfile,
  });
  const phaseCostUnits =
    currentPhase === "produce_artifact"
      ? (env.agentExecutionPhaseCostUnits.produce_artifact ?? 0) + finalizeReserveCostUnits
      : getRemainingExecutionPhaseCostUnits(currentPhase);
  const phaseResourceMinutes =
    currentPhase === "produce_artifact"
      ? Math.max(1, Math.ceil((env.agentExecutionPhaseTimeouts.produce_artifact ?? 60) / 60)) + finalizeReserveResourceMinutes
      : getRemainingExecutionPhaseResourceMinutes(currentPhase);
  const projectedCostUnits =
    billedCostUnits +
    phaseCostUnits +
    minimumContinuationArtifactCount * env.agentExecutionArtifactCostUnits;
  const projectedResourceMinutes =
    Number(runTotals[0]?.totalResourceMinutes ?? 0) +
    phaseResourceMinutes +
    minimumContinuationArtifactCount * getArtifactResourceMinutes();
  const projectedStatus = getExecutionBudgetStatus({
    totalCostUnits: projectedCostUnits,
    totalResourceMinutes: projectedResourceMinutes,
    budgetCostUnits: runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
  });
  const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
  const projectedPricing = applyExecutionPricingPolicyRules({
    measuredCostUnits: projectedCostUnits,
    pricingPolicy,
  });
  const budgetExceeded = projectedStatus === "exceeded";
  const pricingCapExceeded = projectedPricing.pricingCapExceeded;

  if (!budgetExceeded && !pricingCapExceeded) {
    return null;
  }

  const detail = budgetExceeded
    ? `Execution exceeded runtime budget for profile ${runtimeProfile.key} and pricing policy ${pricingPolicy.key} during the minimum viable continuation path. Projected cost=${projectedCostUnits}/${runtimeProfile.budgetCostUnits ?? "unlimited"} cu, projected resource=${projectedResourceMinutes}/${runtimeProfile.budgetResourceMinutes ?? "unlimited"} min.`
    : `Execution would exceed pricing policy cap for profile ${runtimeProfile.key} during the minimum viable continuation path. Projected billed amount=${projectedPricing.minimumAdjustedAmount}/${pricingPolicy.maxBilledAmount} ${pricingPolicy.currency} after included cost units (${projectedPricing.includedCostUnits}) and minimum charge rules.`;
  const timestamp = now();
  const [updatedExecution] = await args.tx
    .update(agentExecutions)
    .set({
      status: "failed",
      statusNote: budgetExceeded
        ? "Execution stopped because the runtime budget would be exceeded."
        : "Execution stopped because the pricing policy cap would be exceeded.",
      resultSummary: budgetExceeded
        ? "Runtime budget exceeded before the next executor phase could proceed."
        : "Pricing policy cap exceeded before the next executor phase could proceed.",
      updatedAt: timestamp,
      completedAt: timestamp,
      executorPhase: "done",
      progressPercent: 100,
    })
    .where(eq(agentExecutions.id, args.execution.id))
    .returning();

  await finishExecutionRunInTx(args.tx, args.runId, {
    status: "failed",
    summary: budgetExceeded
      ? "Platform executor stopped because the runtime budget would be exceeded."
      : "Platform executor stopped because the pricing policy cap would be exceeded.",
    errorMessage: detail,
    artifactCount: producedArtifactCount,
  });
  await recordExecutionStepInTx(args.tx, {
    executionId: args.execution.id,
    kind: "phase",
    phase: "done",
    title: budgetExceeded ? "Runtime budget exceeded" : "Pricing cap exceeded",
    detail,
    status: "failed",
    progressPercent: 100,
  });
  if (updatedExecution) {
    await syncRuntimeManagedSubtasksInTx(args.tx, updatedExecution, "failed");
    await finalizeRuntimeSessionInTx(args.tx, updatedExecution.id, {
      kind: "platform_executor",
      state: "failed",
      endedPhase: "done",
      note: detail,
    });
  }
  await enqueueOutboxEvent(
    "agentExecution.failed",
    {
      executionId: args.execution.id,
      ownerUserId: args.execution.ownerUserId,
      agentId: args.execution.agentId,
      taskId: args.execution.taskId,
      trigger: budgetExceeded ? "budget_exceeded" : "pricing_cap_exceeded",
    },
    args.tx,
  );
  return updatedExecution;
}

async function maybeAdvanceExecutionToFinalizeInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  execution: typeof agentExecutions.$inferSelect;
  runId: string;
}) {
  const currentPhase = (args.execution.executorPhase as PlatformExecutionPhase | null) ?? "prepare";
  if (currentPhase !== "produce_artifact") {
    return null;
  }

  const runtimeProfile = resolveRuntimeProfile(
    (args.execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
  );
  const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
  if (!pricingPolicy.allowPartialFinalize) {
    return null;
  }

  const [artifactRow, runTotals] = await Promise.all([
    args.tx
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(agentExecutionArtifacts)
      .where(eq(agentExecutionArtifacts.executionId, args.execution.id)),
    args.tx
      .select({
        totalResourceMinutes: sql<number>`coalesce(sum(${agentExecutionRuns.resourceMinutes}), 0)::int`,
      })
      .from(agentExecutionRuns)
      .where(eq(agentExecutionRuns.executionId, args.execution.id)),
  ]);

  const producedArtifactCount = Number(artifactRow[0]?.count ?? 0);
  const minimumArtifactsBeforePartialFinalize = Math.max(1, pricingPolicy.minimumArtifactsBeforePartialFinalize);
  if (producedArtifactCount < minimumArtifactsBeforePartialFinalize) {
    return null;
  }

  const billedCostUnits = await calculateExecutionBilledCostUnitsInTx(args.tx, args.execution.id);
  const finalizeReserveCostUnits = getFinalizeReserveCostUnitsForExecution({
    execution: args.execution,
    runtimeProfile,
  });
  const finalizeReserveResourceMinutes = getFinalizeReserveResourceMinutesForExecution({
    execution: args.execution,
    runtimeProfile,
  });

  const continuationProjectedCostUnits =
    billedCostUnits + finalizeReserveCostUnits + env.agentExecutionArtifactCostUnits;
  const continuationProjectedResourceMinutes =
    Number(runTotals[0]?.totalResourceMinutes ?? 0) + finalizeReserveResourceMinutes + getArtifactResourceMinutes();
  const continuationProjectedStatus = getExecutionBudgetStatus({
    totalCostUnits: continuationProjectedCostUnits,
    totalResourceMinutes: continuationProjectedResourceMinutes,
    budgetCostUnits: runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
  });
  const continuationProjectedPricing = applyExecutionPricingPolicyRules({
    measuredCostUnits: continuationProjectedCostUnits,
    pricingPolicy,
  });
  const continuationPricingNearLimit = isExecutionPricingNearLimit({
    measuredCostUnits: continuationProjectedCostUnits,
    pricingPolicy,
  });
  const continuationNearLimit = continuationProjectedStatus === "near_limit" || continuationPricingNearLimit;
  const continuationWouldFail =
    continuationProjectedStatus === "exceeded" || continuationProjectedPricing.pricingCapExceeded;
  if (!continuationWouldFail && !continuationNearLimit) {
    return null;
  }

  const finalizeOnlyProjectedCostUnits = billedCostUnits + finalizeReserveCostUnits;
  const finalizeOnlyProjectedResourceMinutes =
    Number(runTotals[0]?.totalResourceMinutes ?? 0) + finalizeReserveResourceMinutes;
  const finalizeOnlyStatus = getExecutionBudgetStatus({
    totalCostUnits: finalizeOnlyProjectedCostUnits,
    totalResourceMinutes: finalizeOnlyProjectedResourceMinutes,
    budgetCostUnits: runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
  });
  const finalizeOnlyPricing = applyExecutionPricingPolicyRules({
    measuredCostUnits: finalizeOnlyProjectedCostUnits,
    pricingPolicy,
  });
  if (finalizeOnlyStatus === "exceeded" || finalizeOnlyPricing.pricingCapExceeded) {
    return null;
  }

  const artifactRows = await args.tx
    .select()
    .from(agentExecutionArtifacts)
    .where(eq(agentExecutionArtifacts.executionId, args.execution.id))
    .orderBy(asc(agentExecutionArtifacts.createdAt));
  const targetArtifactCount = Math.max(1, args.execution.targetArtifactCount);
  const objectiveChecklist = normalizeObjectiveChecklist(args.execution.objectiveChecklist, args.execution.objective);
  const detail =
    continuationProjectedStatus === "exceeded"
      ? `Platform executor advanced directly to finalize because producing another artifact would exceed the runtime budget for profile ${runtimeProfile.key}, while finalize-only completion remains within headroom.`
      : continuationNearLimit
        ? `Platform executor advanced directly to finalize because producing another artifact would push runtime utilization into the near-limit zone (${Math.round(env.agentExecutionBudgetNearLimitThresholdPercent * 100)}%) for profile ${runtimeProfile.key}, while finalize-only completion remains within headroom.`
      : `Platform executor advanced directly to finalize because producing another artifact would exceed pricing policy ${pricingPolicy.key}, while finalize-only completion remains within headroom.`;
  const runtimeDecision = buildArtifactRuntimeDecision({
    phase: "produce_artifact",
    runtimeProfileKey: runtimeProfile.key,
    pricingPolicyKey: pricingPolicy.key,
    budgetStatus: continuationProjectedStatus,
    nearLimit: continuationNearLimit,
    pricingNearLimit: continuationPricingNearLimit,
    phaseTimeoutApproaching: false,
    adaptiveFinalize: true,
    partialArtifactCompletion: false,
    artifactCount: producedArtifactCount,
    targetArtifactCount,
    requestedArtifactsToProduce: 1,
    plannedArtifactsToProduce: 0,
    nearLimitArtifactsPerAdvanceCap: continuationNearLimit
      ? Math.max(1, runtimeProfile.nearLimitArtifactsPerAdvanceCap)
      : null,
    batchDownshiftApplied: false,
    finalizeEarlyReason: continuationNearLimit ? "near_limit" : "headroom",
    partialFinalizeBlocked: false,
  });

  const runtimeEnvelope = buildExecutionOutputEnvelope({
    kind: "runtime_result",
    title: "Platform executor runtime result",
    summary: `Execution advanced to finalize early after delivering ${producedArtifactCount}/${targetArtifactCount} artifacts under runtime headroom rules.`,
    generatedAt: now(),
    payload: {
      runtime: "platform_baseline",
      runtimeProfile: runtimeProfile.key,
      runtimePlanVersion: runtimeProfile.runtimePlanVersion,
      artifactMode: runtimeProfile.artifactMode,
      executionId: args.execution.id,
      phase: "finalize",
      artifactCount: producedArtifactCount,
      targetArtifactCount,
      artifactsProducedThisAdvance: 0,
      artifactsPerAdvance: runtimeProfile.artifactsPerAdvance,
      pricingPolicyKey: pricingPolicy.key,
      runtimeRuleLimited: true,
      adaptiveFinalize: true,
      budgetNearLimitTriggered: continuationNearLimit,
      runtimeDecision,
      objectiveChecklist,
      artifactSummaries: artifactRows.map((row) => row.summary),
    },
  });

  const [updatedExecution] = await args.tx
    .update(agentExecutions)
    .set({
      executorPhase: "finalize",
      progressPercent: Math.max(args.execution.progressPercent ?? 35, 80),
      statusNote: detail,
      ...toStoredExecutionOutputEnvelope(runtimeEnvelope),
      updatedAt: now(),
    })
    .where(eq(agentExecutions.id, args.execution.id))
    .returning();

  await recordExecutionStepInTx(args.tx, {
    executionId: args.execution.id,
    kind: "phase",
    phase: "produce_artifact",
    title: "Advanced to finalize under runtime decision rules",
    detail,
    status: "completed",
    progressPercent: 80,
  });
  await syncRuntimeManagedSubtasksInTx(args.tx, updatedExecution ?? args.execution, "advance");
  await touchRuntimeSessionInTx(args.tx, args.execution.id, {
    kind: "platform_executor",
    phase: "finalize",
    note: detail,
  });

  return updatedExecution;
}

async function recordSettlementAttemptInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  settlement: typeof agentExecutionSettlements.$inferSelect;
  status: AgentExecutionSettlementAttemptStatus;
  note: string | null;
  error: string | null;
}) {
  await args.tx.insert(agentExecutionSettlementAttempts).values({
    id: crypto.randomUUID(),
    settlementId: args.settlement.id,
    executionId: args.settlement.executionId,
    ownerUserId: args.settlement.ownerUserId,
    agentId: args.settlement.agentId,
    currency: args.settlement.currency,
    billedAmount: args.settlement.billedAmount,
    revenueAmount: args.settlement.revenueAmount,
    status: args.status,
    note: args.note,
    error: args.error,
    createdAt: now(),
  });
}

function isInsufficientBalanceError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("insufficient balance");
}

async function settleExecutionById(executionId: string) {
  if (!env.agentExecutionBillingEnabled) {
    return getExecutionViewWithSettlement(executionId);
  }

  await db.transaction(async (tx) => {
    const [settlement] = await tx
      .select()
      .from(agentExecutionSettlements)
      .where(eq(agentExecutionSettlements.executionId, executionId))
      .limit(1);
    if (!settlement) {
      return;
    }
    if (settlement.status === "settled" || settlement.status === "skipped") {
      return;
    }

    const timestamp = now();
    try {
      if (settlement.billedAmount > 0) {
        await transferBalance({
          fromUserId: settlement.ownerUserId,
          toUserId: settlement.treasuryUserId,
          currency: settlement.currency as CurrencyKey,
          amount: settlement.billedAmount,
          note: `Agent execution settlement for ${settlement.executionId}`,
          referenceType: "agentExecutionSettlement",
          referenceId: settlement.id,
          tx,
        });
      }

      if (
        settlement.revenueRecipientUserId &&
        settlement.revenueAmount > 0 &&
        settlement.revenueRecipientUserId !== settlement.treasuryUserId
      ) {
        await transferBalance({
          fromUserId: settlement.treasuryUserId,
          toUserId: settlement.revenueRecipientUserId,
          currency: settlement.currency as CurrencyKey,
          amount: settlement.revenueAmount,
          note: `Agent execution revenue share for ${settlement.executionId}`,
          referenceType: "agentExecutionRevenueShare",
          referenceId: settlement.id,
          tx,
        });
      }

      await tx
        .update(agentExecutionSettlements)
        .set({
          status: "settled",
          lastError: null,
          lastAttemptAt: timestamp,
          settledAt: timestamp,
          updatedAt: timestamp,
          note: "Execution settlement completed.",
        })
        .where(eq(agentExecutionSettlements.id, settlement.id));
      await recordSettlementAttemptInTx({
        tx,
        settlement,
        status: "settled",
        note: "Execution settlement completed.",
        error: null,
      });
    } catch (error) {
      const nextStatus = isInsufficientBalanceError(error) ? "pending_insufficient_balance" : "pending";
      const message = error instanceof Error ? error.message : "Unknown settlement error";
      await tx
        .update(agentExecutionSettlements)
        .set({
          status: nextStatus,
          lastError: message,
          lastAttemptAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(agentExecutionSettlements.id, settlement.id));
      await recordSettlementAttemptInTx({
        tx,
        settlement,
        status: nextStatus,
        note: null,
        error: message,
      });
    }
  });

  return getExecutionViewWithSettlement(executionId);
}

async function getExecutionViewWithSettlement(executionId: string) {
  return getAgentExecutionViewById(executionId);
}

async function getAgentExecutionViewById(executionId: string) {
  const execution = await getAgentExecutionById(executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }

  const ownerMap = new Map([[execution.id, execution.ownerUserId]]);
  const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, settlementMap, remediationPolicyMap] =
    await Promise.all([
    buildArtifactMap([execution.id]),
    buildStepMap([execution.id]),
    buildSubtaskMap([execution.id], ownerMap, execution.ownerUserId),
    buildRuntimeSessionMap([execution]),
    buildCallbackMap([execution.id]),
    buildRunMap([execution.id]),
    buildSettlementMap([execution.id]),
      buildExecutionRemediationPolicyMap([execution]),
    ]);
  return toAgentExecutionView(
    execution,
    execution.ownerUserId,
    remediationPolicyMap.get(execution.id) ??
      resolveExecutionCallbackRemediationPolicyMetadata({
        execution,
        agentSourceType: "platform",
        agentPolicyKey: null,
      }),
    artifactMap.get(execution.id) ?? [],
    stepMap.get(execution.id) ?? [],
    subtaskMap.get(execution.id) ?? [],
    runtimeSessionMap.get(execution.id) ?? [],
    callbackMap.get(execution.id) ?? [],
    runMap.get(execution.id) ?? [],
    settlementMap.get(execution.id) ?? null,
  );
}

async function recordExecutionStepInTx(
  tx: NodePgDatabase<typeof schema>,
  input: {
    executionId: string;
    kind: AgentExecutionStepKind;
    phase?: PlatformExecutionPhase | null;
    title: string;
    detail?: string | null;
    status: AgentExecutionStepStatus;
    progressPercent?: number | null;
  },
) {
  await tx.insert(agentExecutionSteps).values({
    id: crypto.randomUUID(),
    executionId: input.executionId,
    kind: input.kind,
    phase: input.phase ?? null,
    title: input.title,
    detail: input.detail ?? null,
    status: input.status,
    progressPercent: input.progressPercent ?? null,
    costUnits: estimateExecutionStepCostUnits({
      kind: input.kind,
      phase: input.phase ?? null,
      status: input.status,
      progressPercent: input.progressPercent ?? null,
    }),
    createdAt: now(),
  });
}

async function countCompletedPhaseStepsInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  phase: PlatformExecutionPhase,
) {
  const [row] = await tx
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionSteps)
    .where(
      and(
        eq(agentExecutionSteps.executionId, executionId),
        eq(agentExecutionSteps.kind, "phase"),
        eq(agentExecutionSteps.phase, phase),
        eq(agentExecutionSteps.status, "completed"),
      ),
    );
  return Number(row?.count ?? 0);
}

async function createExecutionRunInTx(
  tx: NodePgDatabase<typeof schema>,
  input: {
    executionId: string;
    agentId: string;
    ownerUserId: string;
    runKind: AgentExecutionRunView["runKind"];
    summary?: string | null;
  },
) {
  const [run] = await tx
    .insert(agentExecutionRuns)
    .values({
      id: crypto.randomUUID(),
      executionId: input.executionId,
      agentId: input.agentId,
      ownerUserId: input.ownerUserId,
      runKind: input.runKind,
      status: "running",
      summary: input.summary ?? null,
      errorMessage: null,
      artifactCount: 0,
      costUnits: 0,
      resourceMinutes: 0,
      estimatedAmount: 0,
      createdAt: now(),
      finishedAt: null,
    })
    .returning();

  return run;
}

async function finishExecutionRun(
  runId: string,
  input: {
    status: AgentExecutionRunView["status"];
    summary?: string | null;
    errorMessage?: string | null;
    artifactCount?: number;
    executionPhase?: PlatformExecutionPhase | null;
    costUnits?: number;
  },
) {
  const [existingRun] = await db.select().from(agentExecutionRuns).where(eq(agentExecutionRuns.id, runId)).limit(1);
  if (!existingRun) {
    throw new NotFoundError("Execution run not found");
  }
  const costUnits =
    input.costUnits ??
    estimateExecutionRunCostUnits({
      runKind: existingRun.runKind as AgentExecutionRunView["runKind"],
      status: input.status,
      artifactCount: input.artifactCount ?? 0,
      executionPhase: input.executionPhase ?? null,
    });
  const finishedAt = now();
  const resourceMinutes = estimateRunResourceMinutes({
    createdAt: existingRun.createdAt,
    finishedAt,
  });
  const estimatedAmount = estimateSettlementAmount(costUnits);
  const [run] = await db
    .update(agentExecutionRuns)
    .set({
      status: input.status,
      summary: input.summary ?? null,
      errorMessage: input.errorMessage ?? null,
      artifactCount: input.artifactCount ?? 0,
      costUnits,
      resourceMinutes,
      estimatedAmount,
      finishedAt,
    })
    .where(eq(agentExecutionRuns.id, runId))
    .returning();

  return run;
}

async function finishExecutionRunInTx(
  tx: NodePgDatabase<typeof schema>,
  runId: string,
  input: {
    status: AgentExecutionRunView["status"];
    summary?: string | null;
    errorMessage?: string | null;
    artifactCount?: number;
    executionPhase?: PlatformExecutionPhase | null;
    costUnits?: number;
  },
) {
  const [existingRun] = await tx.select().from(agentExecutionRuns).where(eq(agentExecutionRuns.id, runId)).limit(1);
  if (!existingRun) {
    throw new NotFoundError("Execution run not found");
  }
  const costUnits =
    input.costUnits ??
    estimateExecutionRunCostUnits({
      runKind: existingRun.runKind as AgentExecutionRunView["runKind"],
      status: input.status,
      artifactCount: input.artifactCount ?? 0,
      executionPhase: input.executionPhase ?? null,
    });
  const finishedAt = now();
  const resourceMinutes = estimateRunResourceMinutes({
    createdAt: existingRun.createdAt,
    finishedAt,
  });
  const estimatedAmount = estimateSettlementAmount(costUnits);
  const [run] = await tx
    .update(agentExecutionRuns)
    .set({
      status: input.status,
      summary: input.summary ?? null,
      errorMessage: input.errorMessage ?? null,
      artifactCount: input.artifactCount ?? 0,
      costUnits,
      resourceMinutes,
      estimatedAmount,
      finishedAt,
    })
    .where(eq(agentExecutionRuns.id, runId))
    .returning();

  return run;
}

async function createCallbackRemediationAttemptInTx(
  tx: NodePgDatabase<typeof schema>,
  input: {
    callbackAuditId: string;
    executionId: string;
    agentId: string;
    runId?: string | null;
    actorUserId: string;
    mode: AgentExecutionCallbackRemediationMode;
    status?: AgentExecutionCallbackRemediationAttemptStatus;
    plannedDecisionClass?: AgentExecutionCallbackAuditView["remediationPlan"]["decisionClass"] | null;
    plannedPrimaryAction?: AgentExecutionCallbackAuditView["remediationPlan"]["primaryAction"] | null;
    plannedFallbackAction?: AgentExecutionCallbackAuditView["remediationPlan"]["fallbackAction"] | null;
    planReasonCategory?: AgentExecutionCallbackAuditView["remediationPlan"]["reasonCategory"] | null;
    planReason?: string | null;
    fallbackFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
    fallbackReason?: string | null;
    note?: string | null;
    errorMessage?: string | null;
  },
) {
  const timestamp = now();
  const [attempt] = await tx
    .insert(agentExecutionCallbackRemediations)
    .values({
      id: crypto.randomUUID(),
      callbackAuditId: input.callbackAuditId,
      executionId: input.executionId,
      agentId: input.agentId,
      runId: input.runId ?? null,
      actorUserId: input.actorUserId,
      mode: input.mode,
      status: input.status ?? "running",
      plannedDecisionClass: input.plannedDecisionClass ?? null,
      plannedPrimaryAction: input.plannedPrimaryAction ?? null,
      plannedFallbackAction: input.plannedFallbackAction ?? null,
      planReasonCategory: input.planReasonCategory ?? null,
      planReason: input.planReason ?? null,
      fallbackFailureClass: input.fallbackFailureClass ?? null,
      fallbackReason: input.fallbackReason ?? null,
      note: input.note ?? null,
      errorMessage: input.errorMessage ?? null,
      createdAt: timestamp,
      finishedAt: input.status && input.status !== "running" ? timestamp : null,
    })
    .returning();

  return attempt;
}

async function finishCallbackRemediationAttemptInTx(
  tx: NodePgDatabase<typeof schema>,
  attemptId: string,
  input: {
    status: Exclude<AgentExecutionCallbackRemediationAttemptStatus, "running">;
    errorMessage?: string | null;
    fallbackFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
    fallbackReason?: string | null;
  },
) {
  const [attempt] = await tx
    .update(agentExecutionCallbackRemediations)
    .set({
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      fallbackFailureClass: input.fallbackFailureClass ?? null,
      fallbackReason: input.fallbackReason ?? null,
      finishedAt: now(),
    })
    .where(eq(agentExecutionCallbackRemediations.id, attemptId))
    .returning();

  return attempt;
}

async function getOpenRuntimeSessionInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  kind?: AgentExecutionRuntimeSessionView["kind"],
) {
  const conditions: SQL[] = [
    eq(agentExecutionRuntimeSessions.executionId, executionId),
    sql`${agentExecutionRuntimeSessions.endedAt} is null`,
  ];
  if (kind) {
    conditions.push(eq(agentExecutionRuntimeSessions.kind, kind));
  }

  const [session] = await tx
    .select()
    .from(agentExecutionRuntimeSessions)
    .where(and(...conditions))
    .orderBy(desc(agentExecutionRuntimeSessions.startedAt))
    .limit(1);

  return session ?? null;
}

async function createRuntimeSessionInTx(
  tx: NodePgDatabase<typeof schema>,
  input: {
    execution: typeof agentExecutions.$inferSelect;
    runId?: string | null;
    kind: AgentExecutionRuntimeSessionView["kind"];
    trigger: AgentExecutionRuntimeSessionView["trigger"];
    state?: AgentExecutionRuntimeSessionState;
    startedPhase?: PlatformExecutionPhase | null;
    note?: string | null;
  },
) {
  const [session] = await tx
    .insert(agentExecutionRuntimeSessions)
    .values({
      id: crypto.randomUUID(),
      executionId: input.execution.id,
      runId: input.runId ?? null,
      agentId: input.execution.agentId,
      ownerUserId: input.execution.ownerUserId,
      kind: input.kind,
      state: input.state ?? "running",
      trigger: input.trigger,
      startedPhase: input.startedPhase ?? ((input.execution.executorPhase as PlatformExecutionPhase | null) ?? null),
      endedPhase: null,
      note: input.note ?? null,
      startedAt: now(),
      endedAt: null,
      updatedAt: now(),
    })
    .returning();

  return session;
}

async function touchRuntimeSessionInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  input: {
    kind?: AgentExecutionRuntimeSessionView["kind"];
    phase?: PlatformExecutionPhase | null;
    note?: string | null;
  },
) {
  const session = await getOpenRuntimeSessionInTx(tx, executionId, input.kind);
  if (!session) {
    return null;
  }

  const [updated] = await tx
    .update(agentExecutionRuntimeSessions)
    .set({
      endedPhase: input.phase ?? session.endedPhase,
      note: input.note ?? session.note,
      updatedAt: now(),
    })
    .where(eq(agentExecutionRuntimeSessions.id, session.id))
    .returning();

  return updated ?? session;
}

async function finalizeRuntimeSessionInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  input: {
    kind?: AgentExecutionRuntimeSessionView["kind"];
    state: AgentExecutionRuntimeSessionState;
    endedPhase?: PlatformExecutionPhase | null;
    note?: string | null;
  },
) {
  const session = await getOpenRuntimeSessionInTx(tx, executionId, input.kind);
  if (!session) {
    return null;
  }

  const timestamp = now();
  const [updated] = await tx
    .update(agentExecutionRuntimeSessions)
    .set({
      state: input.state,
      endedPhase: input.endedPhase ?? ((session.endedPhase as PlatformExecutionPhase | null) ?? null),
      note: input.note ?? session.note,
      endedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionRuntimeSessions.id, session.id))
    .returning();

  return updated ?? session;
}

async function recordExternalCallbackAudit(args: {
  tx: NodePgDatabase<typeof schema>;
  executionId: string;
  agentId: string;
  remediationPolicyKey: AgentCallbackRemediationPolicyKey;
  callbackId: string;
  callbackType: AgentExecutionCallbackType;
  status: AgentExecutionCallbackAuditStatus;
  callbackVersion: number;
  secretVersion: number;
  usedPreviousProtocol: boolean;
  usedPreviousSecret: boolean;
  callbackTimestamp: Date | null;
  rejectionCategory?: AgentExecutionCallbackRejectionCategory | null;
  payloadSummary: string | null;
  replayPayload?: StoredExternalCallbackReplayEnvelope | null;
}) {
  await args.tx.insert(agentExecutionCallbacks).values({
    id: crypto.randomUUID(),
    executionId: args.executionId,
    agentId: args.agentId,
    remediationPolicyKey: args.remediationPolicyKey,
    callbackId: args.callbackId,
    callbackType: args.callbackType,
    status: args.status,
    callbackVersion: args.callbackVersion,
    secretVersion: args.secretVersion,
    usedPreviousProtocol: args.usedPreviousProtocol,
    usedPreviousSecret: args.usedPreviousSecret,
    callbackTimestamp: args.callbackTimestamp,
    rejectionCategory: args.rejectionCategory ?? null,
    payloadSummary: args.payloadSummary,
    replayPayload: args.replayPayload ?? null,
    receivedAt: now(),
  });
}

function getExecutionCallbackRemediationPolicyKey(args: {
  execution: typeof agentExecutions.$inferSelect;
  agent: { sourceType: string | null | undefined; externalCallbackRemediationPolicy: string | null | undefined };
}) {
  return resolveExecutionCallbackRemediationPolicyMetadata({
    execution: args.execution,
    agentSourceType: (args.agent.sourceType as AgentSourceType | null) ?? "platform",
    agentPolicyKey: args.agent.externalCallbackRemediationPolicy,
  }).key;
}

export async function recordRejectedExternalCallbackAudit(input: {
  executionId: string;
  callbackSecret?: string | null;
  callbackId?: string | null;
  callbackType: AgentExecutionCallbackType;
  callbackVersion?: number | null;
  callbackTimestamp?: Date | null;
  payloadSummary?: string | null;
  replayPayload?: StoredExternalCallbackReplayEnvelope | null;
  rejectionReason: string;
}) {
  const row = await getExternalAgentExecution(input.executionId);
  if (!row || row.agent.sourceType !== "external") {
    return;
  }

  const callbackId = input.callbackId?.trim() || `rejected:${crypto.randomUUID()}`;
  const payloadSummary = [input.rejectionReason, input.payloadSummary].filter(Boolean).join(" | ");
  const rejectionCategory = classifyExternalCallbackRejection(input.rejectionReason);
  const compatibility = resolveExternalCallbackCompatibility(row.agent, {
    callbackSecret: input.callbackSecret ?? null,
    callbackVersion: input.callbackVersion ?? null,
    now: now(),
  });

  try {
    await db.transaction(async (tx) => {
      await recordExternalCallbackAudit({
        tx,
        executionId: row.execution.id,
        agentId: row.agent.id,
        remediationPolicyKey: getExecutionCallbackRemediationPolicyKey(row),
        callbackId,
        callbackType: input.callbackType,
        status: "rejected",
        callbackVersion: input.callbackVersion ?? 0,
        secretVersion: compatibility.matchedSecretVersion ?? row.agent.externalCallbackSecretVersion,
        usedPreviousProtocol: compatibility.usedPreviousProtocol,
        usedPreviousSecret: compatibility.usedPreviousSecret,
        callbackTimestamp: input.callbackTimestamp ?? null,
        rejectionCategory,
        payloadSummary: payloadSummary || null,
        replayPayload: input.replayPayload ?? null,
      });
    });
  } catch (auditError) {
    console.error("Failed to persist rejected external callback audit", auditError);
  }
}

function getExternalCallbackIdempotencyKey(executionId: string, callbackId: string) {
  return `agent-execution:external-callback:${executionId}:${callbackId}`;
}

function buildSummaryBuckets(rows: Array<{ key: string; count: number }>) {
  return rows
    .map((row) => ({ key: row.key, count: Number(row.count ?? 0) }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function buildSummaryBucketsFromValues(values: Array<string | null | undefined>, options?: { noneKey?: string }) {
  const bucketMap = new Map<string, number>();
  for (const value of values) {
    const normalized = value?.trim() || options?.noneKey || "";
    if (!normalized) {
      continue;
    }
    bucketMap.set(normalized, (bucketMap.get(normalized) ?? 0) + 1);
  }
  return buildSummaryBuckets([...bucketMap.entries()].map(([key, count]) => ({ key, count })));
}

function inferReplayFailureClassFromFallbackReason(
  fallbackReason: string | null | undefined,
): AgentExecutionCallbackReplayFailureClass | null {
  const normalized = fallbackReason?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("stored_payload_unavailable:")) {
    return "stored_payload_unavailable";
  }
  if (normalized.startsWith("callback_secret_unavailable:")) {
    return "callback_secret_unavailable";
  }
  if (normalized.startsWith("duplicate_replay_cooldown:")) {
    return "duplicate_replay_cooldown";
  }
  if (normalized.startsWith("agent_disabled:")) {
    return "agent_disabled";
  }
  if (normalized.startsWith("callback_not_retryable:")) {
    return "callback_not_retryable";
  }
  if (normalized.startsWith("unsupported_target:")) {
    return "unsupported_target";
  }
  if (normalized.startsWith("callback_protocol_mismatch:")) {
    return "callback_protocol_mismatch";
  }
  return classifyReplayFailureForRetryFallback(normalized);
}

async function buildCallbackAuditRuntimeContextMap(
  executionIds: string[],
): Promise<Map<string, AgentExecutionCallbackRuntimeContextView>> {
  const uniqueExecutionIds = Array.from(new Set(executionIds));
  if (uniqueExecutionIds.length === 0) {
    return new Map();
  }

  const runtimeCatalog = await getAgentExecutionRuntimeCatalog();
  const utilizationByProfileKey = new Map(runtimeCatalog.utilization.map((entry) => [entry.key, entry]));
  const executionRows = await db
    .select({
      id: agentExecutions.id,
      ownerUserId: agentExecutions.ownerUserId,
      runtimeProfileKey: agentExecutions.runtimeProfileKey,
      outputPayload: agentExecutions.outputPayload,
    })
    .from(agentExecutions)
    .where(inArray(agentExecutions.id, uniqueExecutionIds));

  return new Map(
    executionRows.map((row) => {
      const runtimeDecision = resolveRuntimeDecisionFromPayload(toSerializablePayload(row.outputPayload));
      const runtimeProfileKey =
        (row.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? runtimeDecision?.runtimeProfileKey ?? null;
      const utilization = runtimeProfileKey ? utilizationByProfileKey.get(runtimeProfileKey) ?? null : null;
      return [
        row.id,
        {
          runtimeProfileKey,
          ownerUserId: row.ownerUserId,
          runtimeDecisionClass: runtimeDecision?.decisionClass ?? null,
          runtimeDecisionSeverity: runtimeDecision?.severity ?? null,
          runtimePressureLevel: utilization?.pressureLevel ?? null,
          runtimeSchedulingDecisionClass: utilization?.schedulingDecisionClass ?? null,
        } satisfies AgentExecutionCallbackRuntimeContextView,
      ];
    }),
  );
}

function callbackAuditMatchesDerivedFilters(
  callback: AgentExecutionCallbackAuditView,
  args?: Pick<
    CallbackAuditOperatorQuery,
    | "replayPayloadCompatibility"
    | "replayPayloadReplayable"
    | "decisionClass"
    | "replayFailureClass"
    | "runtimeDecisionClass"
    | "runtimeDecisionSeverity"
    | "runtimePressureLevel"
    | "runtimeSchedulingDecisionClass"
  >,
  runtimeContext?: AgentExecutionCallbackRuntimeContextView | null,
) {
  const effectiveRuntimeContext = runtimeContext ?? callback.runtimeContext;
  if (
    args?.replayPayloadCompatibility &&
    callback.replayPayloadCompatibility !== args.replayPayloadCompatibility
  ) {
    return false;
  }
  if (
    typeof args?.replayPayloadReplayable === "boolean" &&
    callback.replayPayloadReplayable !== args.replayPayloadReplayable
  ) {
    return false;
  }
  if (args?.decisionClass && callback.remediationPlan.decisionClass !== args.decisionClass) {
    return false;
  }
  if (args?.replayFailureClass) {
    const matchedAttempt = callback.remediationAttempts.some((attempt) => {
      const failureClass =
        attempt.fallbackFailureClass ?? inferReplayFailureClassFromFallbackReason(attempt.fallbackReason);
      return failureClass === args.replayFailureClass;
    });
    if (!matchedAttempt) {
      return false;
    }
  }
  if (args?.runtimeDecisionClass && effectiveRuntimeContext?.runtimeDecisionClass !== args.runtimeDecisionClass) {
    return false;
  }
  if (args?.runtimeDecisionSeverity && effectiveRuntimeContext?.runtimeDecisionSeverity !== args.runtimeDecisionSeverity) {
    return false;
  }
  if (args?.runtimePressureLevel && effectiveRuntimeContext?.runtimePressureLevel !== args.runtimePressureLevel) {
    return false;
  }
  if (
    args?.runtimeSchedulingDecisionClass &&
    effectiveRuntimeContext?.runtimeSchedulingDecisionClass !== args.runtimeSchedulingDecisionClass
  ) {
    return false;
  }
  return true;
}

function hasCallbackAuditRuntimeDerivedFilters(
  args?: Pick<
    CallbackAuditOperatorQuery,
    | "runtimeDecisionClass"
    | "runtimeDecisionSeverity"
    | "runtimePressureLevel"
    | "runtimeSchedulingDecisionClass"
  >,
) {
  return Boolean(
    args?.runtimeDecisionClass ||
      args?.runtimeDecisionSeverity ||
      args?.runtimePressureLevel ||
      args?.runtimeSchedulingDecisionClass,
  );
}

function hasCallbackAuditDerivedFilters(
  args?: Pick<
    CallbackAuditOperatorQuery,
    | "replayPayloadCompatibility"
    | "replayPayloadReplayable"
    | "decisionClass"
    | "replayFailureClass"
    | "runtimeDecisionClass"
    | "runtimeDecisionSeverity"
    | "runtimePressureLevel"
    | "runtimeSchedulingDecisionClass"
  >,
) {
  return Boolean(
    args?.replayPayloadCompatibility !== undefined ||
      args?.replayPayloadReplayable !== undefined ||
      args?.decisionClass ||
      args?.replayFailureClass ||
      hasCallbackAuditRuntimeDerivedFilters(args),
  );
}

async function buildCallbackAuditViewsForOperator(
  args?: Omit<CallbackAuditOperatorQuery, "limit">,
) {
  const whereClause = toWhereClause(buildCallbackAuditConditions(args));
  let query = db.select().from(agentExecutionCallbacks).$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
  }

  const rows = await query.orderBy(desc(agentExecutionCallbacks.receivedAt));
  const attemptMap = await buildCallbackRemediationAttemptMap(rows.map((row) => row.id));
  const agentMap = await buildAgentExecutionCallbackPlanAgentMap(rows.map((row) => row.agentId));
  const runtimeContextMap = await buildCallbackAuditRuntimeContextMap(rows.map((row) => row.executionId));
  const callbacks = rows
    .map((row) =>
      toAgentExecutionCallbackAuditView(
        row,
        attemptMap.get(row.id) ?? [],
        agentMap.get(row.agentId),
        runtimeContextMap.get(row.executionId),
      ),
    )
    .filter((callback) => callbackAuditMatchesDerivedFilters(callback, args, runtimeContextMap.get(callback.executionId)));

  return {
    callbacks,
    runtimeContextMap,
  };
}

async function listCallbackAuditViewsForOperator(args?: Omit<CallbackAuditOperatorQuery, "limit">) {
  return (await buildCallbackAuditViewsForOperator(args)).callbacks;
}

function buildCallbackAuditSummaryFromViews(
  callbacks: AgentExecutionCallbackAuditView[],
): AgentExecutionCallbackAuditSummaryView {
  const rejectedCallbacks = callbacks.filter((callback) => callback.status === "rejected");
  const totalCount = callbacks.length;
  const byStatus = buildSummaryBucketsFromValues(callbacks.map((callback) => callback.status));
  const byProtocolMatch = buildSummaryBucketsFromValues(
    callbacks.map((callback) => (callback.usedPreviousProtocol ? "previous" : "current")),
  );
  const bySecretMatch = buildSummaryBucketsFromValues(
    callbacks.map((callback) => (callback.usedPreviousSecret ? "previous" : "current")),
  );
  const byRejectionCategory = buildSummaryBucketsFromValues(
    rejectedCallbacks.map((callback) => callback.rejectionCategory ?? "none"),
  );
  const byRetryability = buildSummaryBucketsFromValues(
    rejectedCallbacks.map((callback) => callback.retryability ?? "inspect"),
  );
  const byRemediationPolicyKey = buildSummaryBucketsFromValues(
    callbacks.map((callback) => callback.remediationPolicyKey),
  );

  return {
    totalCount,
    newestReceivedAt: callbacks[0]?.receivedAt ?? null,
    byCallbackType: buildSummaryBucketsFromValues(callbacks.map((callback) => callback.callbackType)),
    byStatus,
    byCallbackVersion: buildSummaryBucketsFromValues(
      callbacks.map((callback) => String(callback.callbackVersion)),
    ),
    bySecretVersion: buildSummaryBucketsFromValues(
      callbacks.map((callback) => String(callback.secretVersion)),
    ),
    byProtocolMatch,
    bySecretMatch,
    byRejectionCategory,
    byRetryability,
    byRemediationPolicyKey,
    byAutoRemediationState: buildSummaryBucketsFromValues(
      callbacks.map((callback) => callback.autoRemediationState),
    ),
    recommendations: buildCallbackAuditRecommendations({
      totalCount,
      byStatus,
      byProtocolMatch,
      bySecretMatch,
      byRejectionCategory,
      byRetryability,
    }),
  };
}

function buildCallbackRemediationSummaryFromViews(
  callbacks: AgentExecutionCallbackAuditView[],
  runtimeContextMap?: Map<string, AgentExecutionCallbackRuntimeContextView>,
): AgentExecutionCallbackRemediationSummaryView {
  const reasonPolicyRows = Array.from(
    callbacks.reduce((map, callback) => {
      if (!callback.autoRemediationReasonCategory) {
        return map;
      }
      const key = `${callback.remediationPolicyKey}:${callback.autoRemediationReasonCategory}`;
      const current = map.get(key) ?? {
        policyKey: callback.remediationPolicyKey,
        reason: callback.autoRemediationReasonCategory,
        count: 0,
      };
      current.count += 1;
      map.set(key, current);
      return map;
    }, new Map<string, { policyKey: AgentCallbackRemediationPolicyKey; reason: string; count: number }>()),
  ).map(([, row]) => row);
  const byDecisionClass = buildSummaryBucketsFromValues(
    callbacks.map((callback) => callback.remediationPlan.decisionClass),
  );
  const byPlannedAction = buildSummaryBucketsFromValues(
    callbacks.map((callback) => callback.remediationPlan.primaryAction),
  );
  const byFallbackAction = buildSummaryBucketsFromValues(
    callbacks.map((callback) => callback.remediationPlan.fallbackAction),
  );
  const byReplayFailureClass = buildSummaryBucketsFromValues(
    callbacks.flatMap((callback) =>
      callback.remediationAttempts.map(
        (attempt) =>
          attempt.fallbackFailureClass ?? inferReplayFailureClassFromFallbackReason(attempt.fallbackReason),
      ),
    ),
  );
  const bySkipReason = buildSummaryBucketsFromValues(
    callbacks.flatMap((callback) =>
      callback.autoRemediationReasonDisposition === "skipped" && callback.autoRemediationReasonCategory
        ? [callback.autoRemediationReasonCategory]
        : [],
    ),
  );
  const byFailureReason = buildSummaryBucketsFromValues(
    callbacks.flatMap((callback) =>
      callback.autoRemediationReasonDisposition === "failed" && callback.autoRemediationReasonCategory
        ? [callback.autoRemediationReasonCategory]
        : [],
    ),
  );
  const candidateCount = callbacks.length;
  const byPolicyKey = buildSummaryBucketsFromValues(callbacks.map((callback) => callback.remediationPolicyKey));
  const alerts = buildCallbackRemediationAlerts({
    candidateCount,
    bySkipReason,
    byFailureReason,
    byPolicyKey,
    reasonPolicyRows,
  });
  const runtimeCorrelationSummary = buildCallbackRemediationRuntimeCorrelationSummary(
    callbacks.map((callback) => runtimeContextMap?.get(callback.executionId) ?? callback.runtimeContext),
  );

  return {
    candidateCount,
    replayPayloadStoredCount: callbacks.filter((callback) => callback.replayPayloadStored).length,
    replayPayloadReplayableCount: callbacks.filter((callback) => callback.replayPayloadReplayable).length,
    replayPayloadLegacyCompatibleCount: callbacks.filter(
      (callback) => callback.replayPayloadCompatibility === "legacy_normalized",
    ).length,
    replayPayloadInvalidCount: callbacks.filter((callback) => callback.replayPayloadCompatibility === "invalid").length,
    latestFailureAt:
      callbacks
        .map((callback) => callback.lastAutoRemediationAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null,
    nextDueAt:
      callbacks
        .map((callback) => callback.nextAutoRemediationAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null,
    runtimeDecisionPresentCount: runtimeCorrelationSummary.runtimeDecisionPresentCount,
    runtimePressureContextCount: runtimeCorrelationSummary.runtimePressureContextCount,
    byDecisionClass,
    byPlannedAction,
    byFallbackAction,
    byReplayFailureClass,
    byRuntimeDecisionClass: runtimeCorrelationSummary.byRuntimeDecisionClass,
    byRuntimeDecisionSeverity: runtimeCorrelationSummary.byRuntimeDecisionSeverity,
    byRuntimePressureLevel: runtimeCorrelationSummary.byRuntimePressureLevel,
    byRuntimeSchedulingDecisionClass: runtimeCorrelationSummary.byRuntimeSchedulingDecisionClass,
    byCallbackType: buildSummaryBucketsFromValues(callbacks.map((callback) => callback.callbackType)),
    byRejectionCategory: buildSummaryBucketsFromValues(
      callbacks.map((callback) => callback.rejectionCategory ?? "none"),
    ),
    byRetryability: buildSummaryBucketsFromValues(
      callbacks.map((callback) => callback.retryability ?? "inspect"),
    ),
    byPolicyKey,
    byAutoRemediationState: buildSummaryBucketsFromValues(
      callbacks.map((callback) => callback.autoRemediationState),
    ),
    byAlertLevel: buildCallbackRemediationAlertBuckets({
      bySkipReason,
      byFailureReason,
    }),
    maxAlertLevel: alerts.reduce((maxLevel, alert) => Math.max(maxLevel, alert.alertLevel), 0),
    bySkipReason,
    byFailureReason,
    alerts,
    recommendations: buildCallbackRemediationRecommendations({
      candidateCount,
      bySkipReason,
      byFailureReason,
      byPolicyKey,
      reasonPolicyRows,
    }),
  };
}

function buildRetryabilityBuckets(rows: Array<{ key: string; count: number }>) {
  const bucketMap = new Map<string, number>();
  for (const row of rows) {
    const rejectionCategory =
      row.key === "none"
        ? null
        : (row.key as AgentExecutionCallbackRejectionCategory);
    const guidance = getExternalCallbackRetryGuidance(rejectionCategory);
    const retryability = guidance.retryability ?? "inspect";
    bucketMap.set(retryability, (bucketMap.get(retryability) ?? 0) + Number(row.count ?? 0));
  }
  return buildSummaryBuckets([...bucketMap.entries()].map(([key, count]) => ({ key, count })));
}

function buildRemediationPolicyBuckets(rows: Array<{ key: string; count: number }>) {
  const bucketMap = new Map<AgentCallbackRemediationPolicyKey, number>();
  for (const row of rows) {
    const key = normalizeRemediationPolicyKey(row.key);
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + Number(row.count ?? 0));
  }
  return buildSummaryBuckets([...bucketMap.entries()].map(([key, count]) => ({ key, count })));
}

function normalizeExecutionCallbackRemediationPolicyOverrideKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return normalizeRemediationPolicyKey(value);
}

function resolveExecutionCallbackRemediationPolicyMetadata(args: {
  execution: typeof agentExecutions.$inferSelect;
  agentSourceType: AgentSourceType;
  agentPolicyKey: string | null | undefined;
}): ExecutionCallbackRemediationPolicyMetadata {
  const overrideKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(
    args.execution.callbackRemediationPolicyKey,
  );
  const key = overrideKey ?? normalizeRemediationPolicyKey(args.agentPolicyKey);
  return {
    agentSourceType: args.agentSourceType,
    key,
    source: overrideKey ? "execution" : "agent",
    overrideKey,
    policy: buildAgentCallbackRemediationPolicyView(key),
  };
}

async function buildExecutionRemediationPolicyMap(executions: Array<typeof agentExecutions.$inferSelect>) {
  if (executions.length === 0) {
    return new Map<string, ExecutionCallbackRemediationPolicyMetadata>();
  }

  const agentIds = Array.from(new Set(executions.map((row) => row.agentId)));
  const agentRows =
    agentIds.length > 0
      ? await db
          .select({
            id: agents.id,
            sourceType: agents.sourceType,
            remediationPolicyKey: agents.externalCallbackRemediationPolicy,
          })
          .from(agents)
          .where(inArray(agents.id, agentIds))
      : [];
  const agentMap = new Map(
    agentRows.map((row) => [
      row.id,
      {
        sourceType: row.sourceType as AgentSourceType,
        remediationPolicyKey: row.remediationPolicyKey,
      },
    ]),
  );

  return new Map(
    executions.map((execution) => {
      const agent = agentMap.get(execution.agentId);
      const metadata = resolveExecutionCallbackRemediationPolicyMetadata({
        execution,
        agentSourceType: agent?.sourceType ?? "platform",
        agentPolicyKey: agent?.remediationPolicyKey,
      });
      return [execution.id, metadata];
    }),
  );
}

function buildKnownAutoRemediationReasonPatternConditions() {
  return listAutoRemediationReasonCategoriesForDisposition("skipped")
    .filter(
      (category): category is Exclude<AgentExecutionCallbackAutoRemediationReasonCategory, "attempt_failed"> =>
        category !== "attempt_failed",
    )
    .flatMap((category) => getAutoRemediationReasonFilterPatterns(category))
    .map((pattern) => sql`lower(coalesce(${agentExecutionCallbacks.autoRemediationLastError}, '')) like ${`%${pattern}%`}`);
}

function buildAutoRemediationReasonCategoryCondition(
  category: AgentExecutionCallbackAutoRemediationReasonCategory,
): SQL {
  if (category === "attempt_failed") {
    const knownPatternConditions = buildKnownAutoRemediationReasonPatternConditions();
    return and(
      sql`${agentExecutionCallbacks.autoRemediationLastError} is not null`,
      ...knownPatternConditions.map((condition) => sql`not (${condition})`),
    ) as SQL;
  }

  const patternConditions = getAutoRemediationReasonFilterPatterns(category).map(
    (pattern) => sql`lower(coalesce(${agentExecutionCallbacks.autoRemediationLastError}, '')) like ${`%${pattern}%`}`,
  );
  return and(
    sql`${agentExecutionCallbacks.autoRemediationLastError} is not null`,
    or(...patternConditions) as SQL,
  ) as SQL;
}

function buildAutoRemediationReasonDispositionCondition(
  disposition: AgentExecutionCallbackAutoRemediationReasonDisposition,
): SQL {
  const categoryConditions = listAutoRemediationReasonCategoriesForDisposition(disposition).map((category) =>
    buildAutoRemediationReasonCategoryCondition(category),
  );
  return and(
    sql`${agentExecutionCallbacks.autoRemediationLastError} is not null`,
    or(...categoryConditions) as SQL,
  ) as SQL;
}

function extractCallbackRetryAuditId(summary: string | null | undefined) {
  if (!summary) {
    return null;
  }

  const match = summary.match(/callback audit ([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function buildCallbackAuditConditions(args?: CallbackAuditOperatorQuery) {
  const conditions: SQL[] = [];
  if (args?.agentId) conditions.push(eq(agentExecutionCallbacks.agentId, args.agentId));
  if (args?.callbackType) conditions.push(eq(agentExecutionCallbacks.callbackType, args.callbackType));
  if (args?.status) conditions.push(eq(agentExecutionCallbacks.status, args.status));
  if (args?.remediationPolicyKey) {
    conditions.push(eq(agentExecutionCallbacks.remediationPolicyKey, args.remediationPolicyKey));
  }
  if (typeof args?.callbackVersion === "number") {
    conditions.push(eq(agentExecutionCallbacks.callbackVersion, args.callbackVersion));
  }
  if (typeof args?.secretVersion === "number") {
    conditions.push(eq(agentExecutionCallbacks.secretVersion, args.secretVersion));
  }
  if (args?.protocolMatch === "current") {
    conditions.push(eq(agentExecutionCallbacks.usedPreviousProtocol, false));
  }
  if (args?.protocolMatch === "previous") {
    conditions.push(eq(agentExecutionCallbacks.usedPreviousProtocol, true));
  }
  if (args?.secretMatch === "current") {
    conditions.push(eq(agentExecutionCallbacks.usedPreviousSecret, false));
  }
  if (args?.secretMatch === "previous") {
    conditions.push(eq(agentExecutionCallbacks.usedPreviousSecret, true));
  }
  if (args?.rejectionCategory) {
    conditions.push(eq(agentExecutionCallbacks.rejectionCategory, args.rejectionCategory));
  }
  if (args?.retryability) {
    conditions.push(eq(agentExecutionCallbacks.status, "rejected"));
    conditions.push(
      inArray(agentExecutionCallbacks.rejectionCategory, getRejectionCategoriesForRetryability(args.retryability)),
    );
  }
  if (args?.autoRemediationReasonCategory) {
    conditions.push(buildAutoRemediationReasonCategoryCondition(args.autoRemediationReasonCategory));
  } else if (args?.autoRemediationReasonDisposition) {
    conditions.push(buildAutoRemediationReasonDispositionCondition(args.autoRemediationReasonDisposition));
  }
  return conditions;
}

function buildRejectedCallbackRetryRequestDetail(args: {
  callbackId: string;
  callbackType: AgentExecutionCallbackType;
  rejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  callbackVersion: number;
  secretVersion: number;
  usedPreviousProtocol: boolean;
  usedPreviousSecret: boolean;
  operatorNote?: string | null;
}) {
  const parts = [
    `callbackId=${args.callbackId}`,
    `type=${args.callbackType}`,
    `callbackVersion=${args.callbackVersion}`,
    `secretVersion=${args.secretVersion}`,
    `protocolMatch=${args.usedPreviousProtocol ? "previous" : "current"}`,
    `secretMatch=${args.usedPreviousSecret ? "previous" : "current"}`,
  ];
  if (args.rejectionCategory) {
    parts.push(`rejection=${args.rejectionCategory}`);
  }
  if (args.operatorNote) {
    parts.push(`note=${args.operatorNote}`);
  }
  return parts.join(" | ");
}

function buildStoredCallbackReplayDetail(args: {
  callbackId: string;
  replayCallbackId: string;
  callbackType: AgentExecutionCallbackType;
  operatorNote?: string | null;
}) {
  const parts = [
    `callbackId=${args.callbackId}`,
    `replayCallbackId=${args.replayCallbackId}`,
    `type=${args.callbackType}`,
  ];

  if (args.operatorNote) {
    parts.push(`operatorNote=${args.operatorNote}`);
  }

  return parts.join(" | ");
}

function buildExecutionRunConditions(args?: ExecutionRunOperatorQuery) {
  const conditions: SQL[] = [];
  if (args?.agentId) conditions.push(eq(agentExecutionRuns.agentId, args.agentId));
  if (args?.ownerUserId) conditions.push(eq(agentExecutions.ownerUserId, args.ownerUserId));
  if (args?.executionIds?.length) conditions.push(inArray(agentExecutionRuns.executionId, args.executionIds));
  if (args?.runIds?.length) conditions.push(inArray(agentExecutionRuns.id, args.runIds));
  if (args?.runKind) conditions.push(eq(agentExecutionRuns.runKind, args.runKind));
  if (args?.runStatus) conditions.push(eq(agentExecutionRuns.status, args.runStatus));
  if (args?.executionStatus) conditions.push(eq(agentExecutions.status, args.executionStatus));
  if (args?.recentWindow) {
    const interval = getRecentWindowInterval(args.recentWindow);
    conditions.push(sql`${agentExecutionRuns.createdAt} >= now() - ${sql.raw(`interval '${interval}'`)}`);
  }
  const failureCategoryCondition = buildFailureCategoryCondition(args?.failureCategory);
  if (failureCategoryCondition) conditions.push(failureCategoryCondition);
  return conditions;
}

function buildFailureHaystackExpression() {
  return sql`lower(coalesce(${agentExecutionRuns.summary}, '') || ' ' || coalesce(${agentExecutionRuns.errorMessage}, ''))`;
}

function buildStaleTimeoutCondition() {
  const haystack = buildFailureHaystackExpression();
  return sql`(${haystack} like '%stale timeout%' or ${haystack} like '%stale platform execution%')`;
}

function buildFailureCategoryCondition(
  failureCategory?: AgentExecutionRunFailureCategory,
): SQL | undefined {
  if (!failureCategory) {
    return undefined;
  }

  const staleCondition = buildStaleTimeoutCondition();
  if (failureCategory === "stale_timeout") {
    return and(eq(agentExecutionRuns.status, "failed"), staleCondition) ?? undefined;
  }
  if (failureCategory === "executor_failure") {
    return and(
      eq(agentExecutionRuns.status, "failed"),
      eq(agentExecutionRuns.runKind, "platform_executor"),
      sql`not (${staleCondition})`,
    ) ?? undefined;
  }
  if (failureCategory === "requeue_failure") {
    return and(
      eq(agentExecutionRuns.status, "failed"),
      eq(agentExecutionRuns.runKind, "requeue"),
      sql`not (${staleCondition})`,
    ) ?? undefined;
  }
  return and(
    eq(agentExecutionRuns.status, "failed"),
    sql`not (${staleCondition})`,
    sql`${agentExecutionRuns.runKind} not in ('platform_executor', 'requeue')`,
  ) ?? undefined;
}

function toWhereClause(conditions: SQL[]) {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function runExternalCallbackWithIdempotency<T>(
  executionId: string,
  callbackId: string,
  operation: () => Promise<T>,
  onDuplicate: () => Promise<T>,
) {
  const key = getExternalCallbackIdempotencyKey(executionId, callbackId);
  const claimed = await redis.set(key, "pending", "EX", externalCallbackPendingTtlSeconds, "NX");
  if (claimed !== "OK") {
    const status = await redis.get(key);
    if (status === "pending") {
      throw new ConflictError("External callback is already being processed");
    }
    return onDuplicate();
  }

  try {
    const result = await operation();
    await redis.set(key, "processed", "EX", externalCallbackProcessedTtlSeconds);
    return result;
  } catch (error) {
    await redis.del(key);
    throw error;
  }
}

export async function listOwnedAgentExecutions(ownerUserId: string): Promise<AgentExecutionView[]> {
  const rows = await listAgentExecutionsByOwner(ownerUserId);
  const ownerMap = new Map(rows.map((row) => [row.id, row.ownerUserId]));
  const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, settlementMap, remediationPolicyMap] =
    await Promise.all([
      buildArtifactMap(rows.map((row) => row.id)),
      buildStepMap(rows.map((row) => row.id)),
      buildSubtaskMap(rows.map((row) => row.id), ownerMap, ownerUserId),
      buildRuntimeSessionMap(rows),
      buildCallbackMap(rows.map((row) => row.id)),
      buildRunMap(rows.map((row) => row.id)),
      buildSettlementMap(rows.map((row) => row.id)),
      buildExecutionRemediationPolicyMap(rows),
    ]);
  return rows.map((row) =>
    toAgentExecutionView(
      row,
      ownerUserId,
      remediationPolicyMap.get(row.id) ??
        resolveExecutionCallbackRemediationPolicyMetadata({
          execution: row,
          agentSourceType: "platform",
          agentPolicyKey: null,
        }),
      artifactMap.get(row.id) ?? [],
      stepMap.get(row.id) ?? [],
      subtaskMap.get(row.id) ?? [],
      runtimeSessionMap.get(row.id) ?? [],
      callbackMap.get(row.id) ?? [],
      runMap.get(row.id) ?? [],
      settlementMap.get(row.id) ?? null,
    ),
  );
}

export async function listSuppliedAgentMarketplaceExecutions(
  supplierUserId: string,
  limit = 20,
): Promise<AgentExecutionView[]> {
  const rows = await listSuppliedMarketplaceAgentExecutions(supplierUserId, limit);
  const ownerMap = new Map(rows.map((row) => [row.id, row.ownerUserId]));
  const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, settlementMap, remediationPolicyMap] =
    await Promise.all([
      buildArtifactMap(rows.map((row) => row.id)),
      buildStepMap(rows.map((row) => row.id)),
      buildSubtaskMap(rows.map((row) => row.id), ownerMap, supplierUserId),
      buildRuntimeSessionMap(rows),
      buildCallbackMap(rows.map((row) => row.id)),
      buildRunMap(rows.map((row) => row.id)),
      buildSettlementMap(rows.map((row) => row.id)),
      buildExecutionRemediationPolicyMap(rows),
    ]);

  return rows.map((row) =>
    toAgentExecutionView(
      row,
      supplierUserId,
      remediationPolicyMap.get(row.id) ??
        resolveExecutionCallbackRemediationPolicyMetadata({
          execution: row,
          agentSourceType: "platform",
          agentPolicyKey: null,
        }),
      artifactMap.get(row.id) ?? [],
      stepMap.get(row.id) ?? [],
      subtaskMap.get(row.id) ?? [],
      runtimeSessionMap.get(row.id) ?? [],
      callbackMap.get(row.id) ?? [],
      runMap.get(row.id) ?? [],
      settlementMap.get(row.id) ?? null,
    ),
  );
}

export async function listCallbackAuditsForOperator(
  args?: CallbackAuditOperatorQuery,
): Promise<AgentExecutionCallbackAuditView[]> {
  const limit = Math.max(1, Math.min(args?.limit ?? 50, 200));
  if (hasCallbackAuditDerivedFilters(args)) {
    const callbacks = await listCallbackAuditViewsForOperator({
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: args?.status,
      remediationPolicyKey: args?.remediationPolicyKey,
      callbackVersion: args?.callbackVersion,
      secretVersion: args?.secretVersion,
      protocolMatch: args?.protocolMatch,
      secretMatch: args?.secretMatch,
      rejectionCategory: args?.rejectionCategory,
      retryability: args?.retryability,
      autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
      autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
      replayPayloadCompatibility: args?.replayPayloadCompatibility,
      replayPayloadReplayable: args?.replayPayloadReplayable,
      decisionClass: args?.decisionClass,
      replayFailureClass: args?.replayFailureClass,
      runtimeDecisionClass: args?.runtimeDecisionClass,
      runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
      runtimePressureLevel: args?.runtimePressureLevel,
      runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
    });
    return callbacks.slice(0, limit);
  }
  const whereClause = toWhereClause(buildCallbackAuditConditions(args));
  let query = db.select().from(agentExecutionCallbacks).$dynamic();

  if (whereClause) query = query.where(whereClause);

  const rows = await query.orderBy(desc(agentExecutionCallbacks.receivedAt)).limit(limit);
  const attemptMap = await buildCallbackRemediationAttemptMap(rows.map((row) => row.id));
  const agentMap = await buildAgentExecutionCallbackPlanAgentMap(rows.map((row) => row.agentId));
  const runtimeContextMap = await buildCallbackAuditRuntimeContextMap(rows.map((row) => row.executionId));
  return rows.map((row) =>
    toAgentExecutionCallbackAuditView(
      row,
      attemptMap.get(row.id) ?? [],
      agentMap.get(row.agentId),
      runtimeContextMap.get(row.executionId),
    ),
  );
}

export async function getCallbackAuditSummaryForOperator(
  args?: CallbackAuditOperatorQuery,
): Promise<AgentExecutionCallbackAuditSummaryView> {
  if (hasCallbackAuditDerivedFilters(args)) {
    const callbacks = await listCallbackAuditViewsForOperator({
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: args?.status,
      remediationPolicyKey: args?.remediationPolicyKey,
      callbackVersion: args?.callbackVersion,
      secretVersion: args?.secretVersion,
      protocolMatch: args?.protocolMatch,
      secretMatch: args?.secretMatch,
      rejectionCategory: args?.rejectionCategory,
      retryability: args?.retryability,
      autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
      autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
      replayPayloadCompatibility: args?.replayPayloadCompatibility,
      replayPayloadReplayable: args?.replayPayloadReplayable,
      decisionClass: args?.decisionClass,
      replayFailureClass: args?.replayFailureClass,
      runtimeDecisionClass: args?.runtimeDecisionClass,
      runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
      runtimePressureLevel: args?.runtimePressureLevel,
      runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
    });
    return buildCallbackAuditSummaryFromViews(callbacks);
  }
  const whereClause = toWhereClause(buildCallbackAuditConditions(args));

  const [latestRow] = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      newestReceivedAt: max(agentExecutionCallbacks.receivedAt),
    })
    .from(agentExecutionCallbacks)
    .where(whereClause);

  const callbackTypeRows = await db
    .select({
      key: agentExecutionCallbacks.callbackType,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.callbackType);

  const statusRows = await db
    .select({
      key: agentExecutionCallbacks.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.status);

  const callbackVersionRows = await db
    .select({
      key: sql<string>`${agentExecutionCallbacks.callbackVersion}::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.callbackVersion);

  const secretVersionRows = await db
    .select({
      key: sql<string>`${agentExecutionCallbacks.secretVersion}::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.secretVersion);

  const protocolMatchRows = await db
    .select({
      key: sql<string>`case when ${agentExecutionCallbacks.usedPreviousProtocol} then 'previous' else 'current' end`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.usedPreviousProtocol);

  const secretMatchRows = await db
    .select({
      key: sql<string>`case when ${agentExecutionCallbacks.usedPreviousSecret} then 'previous' else 'current' end`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.usedPreviousSecret);

  const rejectionCategoryRows = await db
    .select({
      key: sql<string>`coalesce(${agentExecutionCallbacks.rejectionCategory}, 'none')`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(
      toWhereClause([
        ...buildCallbackAuditConditions(args),
        eq(agentExecutionCallbacks.status, "rejected"),
      ]),
    )
    .groupBy(sql`coalesce(${agentExecutionCallbacks.rejectionCategory}, 'none')`);

  const remediationPolicyRows = await db
    .select({
      key: agentExecutionCallbacks.remediationPolicyKey,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.remediationPolicyKey);

  const autoRemediationStateRows = await db
    .select({
      key: sql<string>`
        case
          when ${agentExecutionCallbacks.autoRemediationExhaustedAt} is not null then 'exhausted'
          when ${agentExecutionCallbacks.nextAutoRemediationAt} is not null then 'scheduled'
          else 'idle'
        end
      `,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(sql`
      case
        when ${agentExecutionCallbacks.autoRemediationExhaustedAt} is not null then 'exhausted'
        when ${agentExecutionCallbacks.nextAutoRemediationAt} is not null then 'scheduled'
        else 'idle'
      end
    `);

  const byStatus = buildSummaryBuckets(statusRows as Array<{ key: string; count: number }>);
  const byProtocolMatch = buildSummaryBuckets(protocolMatchRows as Array<{ key: string; count: number }>);
  const bySecretMatch = buildSummaryBuckets(secretMatchRows as Array<{ key: string; count: number }>);
  const byRejectionCategory = buildSummaryBuckets(rejectionCategoryRows as Array<{ key: string; count: number }>);
  const byRetryability = buildRetryabilityBuckets(rejectionCategoryRows as Array<{ key: string; count: number }>);
  const byRemediationPolicyKey = buildRemediationPolicyBuckets(
    remediationPolicyRows as Array<{ key: string; count: number }>,
  );
  const totalCount = Number(latestRow?.totalCount ?? 0);

  return {
    totalCount,
    newestReceivedAt: latestRow?.newestReceivedAt ? latestRow.newestReceivedAt.toISOString() : null,
    byCallbackType: buildSummaryBuckets(callbackTypeRows as Array<{ key: string; count: number }>),
    byStatus,
    byCallbackVersion: buildSummaryBuckets(callbackVersionRows as Array<{ key: string; count: number }>),
    bySecretVersion: buildSummaryBuckets(secretVersionRows as Array<{ key: string; count: number }>),
    byProtocolMatch,
    bySecretMatch,
    byRejectionCategory,
    byRetryability,
    byRemediationPolicyKey,
    byAutoRemediationState: buildSummaryBuckets(autoRemediationStateRows as Array<{ key: string; count: number }>),
    recommendations: buildCallbackAuditRecommendations({
      totalCount,
      byStatus,
      byProtocolMatch,
      bySecretMatch,
      byRejectionCategory,
      byRetryability,
    }),
  };
}

export async function getCallbackRemediationSummaryForOperator(
  args?: CallbackRemediationSummaryQuery,
): Promise<AgentExecutionCallbackRemediationSummaryView> {
  if (hasCallbackAuditDerivedFilters(args)) {
    const { callbacks, runtimeContextMap } = await buildCallbackAuditViewsForOperator(
      {
        agentId: args?.agentId,
        callbackType: args?.callbackType,
        status: "rejected",
        remediationPolicyKey: args?.remediationPolicyKey,
        autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
        autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
        replayPayloadCompatibility: args?.replayPayloadCompatibility,
        replayPayloadReplayable: args?.replayPayloadReplayable,
        decisionClass: args?.decisionClass,
        replayFailureClass: args?.replayFailureClass,
        runtimeDecisionClass: args?.runtimeDecisionClass,
        runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
        runtimePressureLevel: args?.runtimePressureLevel,
        runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
      },
    );
    return buildCallbackRemediationSummaryFromViews(
      callbacks.filter((callback) => callback.status === "rejected"),
      runtimeContextMap,
    );
  }
  const whereClause = toWhereClause([
    ...buildCallbackAuditConditions({
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: "rejected",
      remediationPolicyKey: args?.remediationPolicyKey,
      autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
      autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
    }),
  ]);

  const [latestRow] = await db
    .select({
      candidateCount: sql<number>`count(*)::int`,
      latestFailureAt: max(agentExecutionCallbacks.lastAutoRemediationAt),
      nextDueAt: sql<Date | null>`min(${agentExecutionCallbacks.nextAutoRemediationAt})`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause);

  const candidateRows = await db
    .select({
      id: agentExecutionCallbacks.id,
      executionId: agentExecutionCallbacks.executionId,
      agentId: agentExecutionCallbacks.agentId,
      status: agentExecutionCallbacks.status,
      rejectionCategory: agentExecutionCallbacks.rejectionCategory,
      remediationPolicyKey: agentExecutionCallbacks.remediationPolicyKey,
      usedPreviousProtocol: agentExecutionCallbacks.usedPreviousProtocol,
      usedPreviousSecret: agentExecutionCallbacks.usedPreviousSecret,
      replayPayload: agentExecutionCallbacks.replayPayload,
      autoRemediationAttempts: agentExecutionCallbacks.autoRemediationAttempts,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause);
  const candidateAgentMap = await buildAgentExecutionCallbackPlanAgentMap(candidateRows.map((row) => row.agentId));
  const replayPayloadResolutions = candidateRows.map((row) =>
    resolveStoredExternalCallbackReplayEnvelope(row.replayPayload),
  );
  const remediationPlans = candidateRows.map((row, index) =>
    buildCallbackRemediationPlan({
      status: row.status as AgentExecutionCallbackAuditStatus,
      agentSourceType: candidateAgentMap.get(row.agentId)?.sourceType ?? "external",
      agentEnabled: candidateAgentMap.get(row.agentId)?.enabled ?? true,
      usedPreviousProtocol: row.usedPreviousProtocol,
      usedPreviousSecret: row.usedPreviousSecret,
      retryability:
        (getExternalCallbackRetryGuidance(
          (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
        ).retryability as AgentExecutionCallbackRetryability | null) ?? null,
      rejectionCategory: (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
      policy: buildAgentCallbackRemediationPolicyView(normalizeRemediationPolicyKey(row.remediationPolicyKey)),
      replayPayload: replayPayloadResolutions[index],
      autoRemediationAttempts: row.autoRemediationAttempts,
    }),
  );
  const replayPayloadStoredCount = replayPayloadResolutions.filter((row) => row.stored).length;
  const replayPayloadReplayableCount = replayPayloadResolutions.filter((row) => row.replayable).length;
  const replayPayloadLegacyCompatibleCount = replayPayloadResolutions.filter(
    (row) => row.compatibility === "legacy_normalized",
  ).length;
  const replayPayloadInvalidCount = replayPayloadResolutions.filter((row) => row.compatibility === "invalid").length;
  const byDecisionClass = buildSummaryBuckets(
    Array.from(
      remediationPlans.reduce((map, plan) => {
        map.set(plan.decisionClass, (map.get(plan.decisionClass) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([key, count]) => ({ key, count })),
  );
  const byPlannedAction = buildSummaryBuckets(
    Array.from(
      remediationPlans.reduce((map, plan) => {
        map.set(plan.primaryAction, (map.get(plan.primaryAction) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([key, count]) => ({ key, count })),
  );
  const byFallbackAction = buildSummaryBuckets(
    Array.from(
      remediationPlans.reduce((map, plan) => {
        if (plan.fallbackAction) {
          map.set(plan.fallbackAction, (map.get(plan.fallbackAction) ?? 0) + 1);
        }
        return map;
      }, new Map<string, number>()),
    ).map(([key, count]) => ({ key, count })),
  );
  const replayFailureClassRows = await db
    .select({
      key: agentExecutionCallbackRemediations.fallbackFailureClass,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbackRemediations)
    .innerJoin(
      agentExecutionCallbacks,
      eq(agentExecutionCallbackRemediations.callbackAuditId, agentExecutionCallbacks.id),
    )
    .where(
      toWhereClause([
        ...buildCallbackAuditConditions({
          agentId: args?.agentId,
          callbackType: args?.callbackType,
          status: "rejected",
          remediationPolicyKey: args?.remediationPolicyKey,
          autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
          autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
        }),
        sql`${agentExecutionCallbackRemediations.fallbackFailureClass} is not null`,
      ]),
    )
    .groupBy(agentExecutionCallbackRemediations.fallbackFailureClass);

  const callbackTypeRows = await db
    .select({
      key: agentExecutionCallbacks.callbackType,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.callbackType);

  const rejectionCategoryRows = await db
    .select({
      key: sql<string>`coalesce(${agentExecutionCallbacks.rejectionCategory}, 'none')`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(sql`coalesce(${agentExecutionCallbacks.rejectionCategory}, 'none')`);

  const remediationPolicyRows = await db
    .select({
      key: agentExecutionCallbacks.remediationPolicyKey,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.remediationPolicyKey);

  const remediationReasonPolicyRows = await db
    .select({
      policyKey: agentExecutionCallbacks.remediationPolicyKey,
      reason: sql<string>`coalesce(${agentExecutionCallbacks.autoRemediationLastError}, 'none')`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.remediationPolicyKey, sql`coalesce(${agentExecutionCallbacks.autoRemediationLastError}, 'none')`);

  const autoRemediationStateRows = await db
    .select({
      key: sql<string>`
        case
          when ${agentExecutionCallbacks.autoRemediationExhaustedAt} is not null then 'exhausted'
          when ${agentExecutionCallbacks.nextAutoRemediationAt} is not null then 'scheduled'
          else 'idle'
        end
      `,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(sql`
      case
        when ${agentExecutionCallbacks.autoRemediationExhaustedAt} is not null then 'exhausted'
        when ${agentExecutionCallbacks.nextAutoRemediationAt} is not null then 'scheduled'
        else 'idle'
      end
    `);

  const autoRemediationLastErrorRows = await db
    .select({
      key: sql<string>`coalesce(${agentExecutionCallbacks.autoRemediationLastError}, 'none')`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(sql`coalesce(${agentExecutionCallbacks.autoRemediationLastError}, 'none')`);

  const byCallbackType = buildSummaryBuckets(callbackTypeRows as Array<{ key: string; count: number }>);
  const byRejectionCategory = buildSummaryBuckets(rejectionCategoryRows as Array<{ key: string; count: number }>);
  const byRetryability = buildRetryabilityBuckets(rejectionCategoryRows as Array<{ key: string; count: number }>);
  const byPolicyKey = buildRemediationPolicyBuckets(remediationPolicyRows as Array<{ key: string; count: number }>);
  const byAutoRemediationState = buildSummaryBuckets(autoRemediationStateRows as Array<{ key: string; count: number }>);
  const byReplayFailureClass = buildSummaryBuckets(
    (replayFailureClassRows as Array<{ key: string | null; count: number }>)
      .filter((row): row is { key: string; count: number } => Boolean(row.key))
      .map((row) => ({ key: row.key, count: Number(row.count ?? 0) })),
  );
  const bySkipReason = buildAutoRemediationReasonBuckets(
    autoRemediationLastErrorRows as Array<{ key: string; count: number }>,
    "skipped",
  );
  const byFailureReason = buildAutoRemediationReasonBuckets(
    autoRemediationLastErrorRows as Array<{ key: string; count: number }>,
    "failed",
  );
  const byAlertLevel = buildCallbackRemediationAlertBuckets({
    bySkipReason,
    byFailureReason,
  });
  const reasonPolicyRows = (
    remediationReasonPolicyRows as Array<{ policyKey: string; reason: string; count: number }>
  ).map((row) => ({
    policyKey: normalizeRemediationPolicyKey(row.policyKey),
    reason: row.reason,
    count: Number(row.count ?? 0),
  }));
  const alerts = buildCallbackRemediationAlerts({
    candidateCount: Number(latestRow?.candidateCount ?? 0),
    bySkipReason,
    byFailureReason,
    byPolicyKey,
    reasonPolicyRows,
  });
  const runtimeContextMap = await buildCallbackAuditRuntimeContextMap(
    candidateRows.map((row) => row.executionId),
  );
  const runtimeCorrelationSummary = buildCallbackRemediationRuntimeCorrelationSummary(
    candidateRows.map((row) => runtimeContextMap.get(row.executionId)),
  );

  return {
    candidateCount: Number(latestRow?.candidateCount ?? 0),
    replayPayloadStoredCount,
    replayPayloadReplayableCount,
    replayPayloadLegacyCompatibleCount,
    replayPayloadInvalidCount,
    latestFailureAt: latestRow?.latestFailureAt ? latestRow.latestFailureAt.toISOString() : null,
    nextDueAt: latestRow?.nextDueAt ? latestRow.nextDueAt.toISOString() : null,
    runtimeDecisionPresentCount: runtimeCorrelationSummary.runtimeDecisionPresentCount,
    runtimePressureContextCount: runtimeCorrelationSummary.runtimePressureContextCount,
    byDecisionClass,
    byPlannedAction,
    byFallbackAction,
    byReplayFailureClass,
    byRuntimeDecisionClass: runtimeCorrelationSummary.byRuntimeDecisionClass,
    byRuntimeDecisionSeverity: runtimeCorrelationSummary.byRuntimeDecisionSeverity,
    byRuntimePressureLevel: runtimeCorrelationSummary.byRuntimePressureLevel,
    byRuntimeSchedulingDecisionClass: runtimeCorrelationSummary.byRuntimeSchedulingDecisionClass,
    byCallbackType,
    byRejectionCategory,
    byRetryability,
    byPolicyKey,
    byAutoRemediationState,
    byAlertLevel,
    maxAlertLevel: alerts.reduce((maxLevel, alert) => Math.max(maxLevel, alert.alertLevel), 0),
    bySkipReason,
    byFailureReason,
    alerts,
    recommendations: buildCallbackRemediationRecommendations({
      candidateCount: Number(latestRow?.candidateCount ?? 0),
      bySkipReason,
      byFailureReason,
      byPolicyKey,
      reasonPolicyRows,
    }),
  };
}

function toCallbackRemediationAlertScopeValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "";
}

async function hasRecentCallbackRemediationAlertEvent(args: {
  alert: AgentExecutionCallbackRemediationAlertView;
  agentId?: string;
  callbackType?: AgentExecutionCallbackType;
  cooldownThreshold: Date;
}) {
  const [row] = await db
    .select({
      id: outboxEvents.id,
    })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.eventName, callbackRemediationAlertEventName),
        gte(outboxEvents.createdAt, args.cooldownThreshold),
        sql`coalesce(${outboxEvents.payload}->>'reasonCategory', '') = ${toCallbackRemediationAlertScopeValue(
          args.alert.reasonCategory,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'reasonDisposition', '') = ${toCallbackRemediationAlertScopeValue(
          args.alert.reasonDisposition,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'policyKey', '') = ${toCallbackRemediationAlertScopeValue(
          args.alert.policyKey,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'scopeAgentId', '') = ${toCallbackRemediationAlertScopeValue(
          args.agentId,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'scopeCallbackType', '') = ${toCallbackRemediationAlertScopeValue(
          args.callbackType,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'alertLevel', '') = ${String(args.alert.alertLevel)}`,
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function emitCallbackRemediationAlerts(
  args?: CallbackRemediationAlertEmitQuery,
): Promise<AgentExecutionCallbackRemediationAlertDispatchResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 20));
  const minimumAlertLevel = Math.max(
    1,
    Math.min(3, Math.floor(args?.minimumAlertLevel ?? env.agentExecutionCallbackAlertMinLevel)),
  );
  const summary = await getCallbackRemediationSummaryForOperator({
    agentId: args?.agentId,
    callbackType: args?.callbackType,
    remediationPolicyKey: args?.remediationPolicyKey,
    autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
    autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
    replayPayloadCompatibility: args?.replayPayloadCompatibility,
    replayPayloadReplayable: args?.replayPayloadReplayable,
    decisionClass: args?.decisionClass,
    replayFailureClass: args?.replayFailureClass,
    runtimeDecisionClass: args?.runtimeDecisionClass,
    runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
    runtimePressureLevel: args?.runtimePressureLevel,
    runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
  });
  const alerts = summary.alerts.filter((alert) => alert.alertLevel >= minimumAlertLevel).slice(0, limit);
  const scopedAgent =
    args?.agentId && args.agentId.trim().length > 0
      ? await db.query.agents.findFirst({
          where: eq(agents.id, args.agentId.trim()),
          columns: {
            id: true,
            ownerUserId: true,
            name: true,
          },
        })
      : null;
  const cooldownThreshold = new Date(
    now().getTime() - env.agentExecutionCallbackAlertCooldownMinutes * 60 * 1000,
  );
  const dispatchedAlerts: AgentExecutionCallbackRemediationAlertDispatchResult["alerts"] = [];
  let dispatchedCount = 0;
  let skippedCount = 0;

  for (const alert of alerts) {
    const isDuplicate = await hasRecentCallbackRemediationAlertEvent({
      alert,
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      cooldownThreshold,
    });

    if (isDuplicate) {
      skippedCount += 1;
      dispatchedAlerts.push({
        ...alert,
        dispatched: false,
        skippedReason: "recent_duplicate",
      });
      continue;
    }

    await enqueueOutboxEvent(
      callbackRemediationAlertEventName,
      {
        alertLevel: alert.alertLevel,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        actionLabel: alert.actionLabel,
        reasonCategory: alert.reasonCategory,
        reasonDisposition: alert.reasonDisposition,
        policyKey: alert.policyKey,
        count: alert.count,
        candidateCount: summary.candidateCount,
        maxAlertLevel: summary.maxAlertLevel,
        agentOwnerUserId: scopedAgent?.ownerUserId ?? null,
        agentName: scopedAgent?.name ?? null,
        scopeAgentId: args?.agentId ?? null,
        scopeCallbackType: args?.callbackType ?? null,
      },
      db,
      "account",
    );
    dispatchedCount += 1;
    dispatchedAlerts.push({
      ...alert,
      dispatched: true,
      skippedReason: null,
    });
  }

  return {
    dispatchedCount,
    skippedCount,
    minimumAlertLevel,
    alerts: dispatchedAlerts,
  };
}

async function hasRecentRuntimePressureAlertEvent(args: {
  alert: AgentExecutionRuntimePressureAlertView;
  cooldownThreshold: Date;
}) {
  const [row] = await db
    .select({
      id: outboxEvents.id,
    })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.eventName, runtimePressureAlertEventName),
        gte(outboxEvents.createdAt, args.cooldownThreshold),
        sql`coalesce(${outboxEvents.payload}->>'profileKey', '') = ${args.alert.profileKey}`,
        sql`coalesce(${outboxEvents.payload}->>'pressureLevel', '') = ${args.alert.pressureLevel}`,
        sql`coalesce(${outboxEvents.payload}->>'schedulingDecisionClass', '') = ${args.alert.schedulingDecisionClass}`,
        sql`coalesce(${outboxEvents.payload}->>'ownerUserId', '') = ${toCallbackRemediationAlertScopeValue(
          args.alert.busiestOwnerUserId,
        )}`,
        sql`coalesce(${outboxEvents.payload}->>'alertLevel', '') = ${String(args.alert.alertLevel)}`,
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function emitRuntimePressureAlerts(
  args?: RuntimePressureAlertEmitQuery,
): Promise<AgentExecutionRuntimePressureAlertDispatchResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 20));
  const minimumAlertLevel = Math.max(
    1,
    Math.min(3, Math.floor(args?.minimumAlertLevel ?? env.agentExecutionRuntimeAlertMinLevel)),
  );
  const summary = await getRuntimePressureAlertSummaryForOperator({
    pressureLevel: args?.pressureLevel,
    schedulingDecisionClass: args?.schedulingDecisionClass,
  });
  const alerts = summary.alerts.filter((alert) => alert.alertLevel >= minimumAlertLevel).slice(0, limit);
  const cooldownThreshold = new Date(
    now().getTime() - env.agentExecutionRuntimeAlertCooldownMinutes * 60 * 1000,
  );
  const dispatchedAlerts: AgentExecutionRuntimePressureAlertDispatchResult["alerts"] = [];
  let dispatchedCount = 0;
  let skippedCount = 0;

  for (const alert of alerts) {
    const isDuplicate = await hasRecentRuntimePressureAlertEvent({
      alert,
      cooldownThreshold,
    });

    if (isDuplicate) {
      skippedCount += 1;
      dispatchedAlerts.push({
        ...alert,
        dispatched: false,
        skippedReason: "recent_duplicate",
      });
      continue;
    }

    await enqueueOutboxEvent(
      runtimePressureAlertEventName,
      {
        alertLevel: alert.alertLevel,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        actionLabel: alert.actionLabel,
        profileKey: alert.profileKey,
        pressureLevel: alert.pressureLevel,
        schedulingDecisionClass: alert.schedulingDecisionClass,
        runningExecutionCount: alert.runningExecutionCount,
        queuedExecutionCount: alert.queuedExecutionCount,
        claimableQueuedExecutionCount: alert.claimableQueuedExecutionCount,
        blockedQueuedExecutionCount: alert.blockedQueuedExecutionCount,
        blockedByProfileCount: alert.blockedByProfileCount,
        blockedByOwnerCount: alert.blockedByOwnerCount,
        blockedOwnerCount: alert.blockedOwnerCount,
        availableExecutionSlots: alert.availableExecutionSlots,
        maxConcurrentExecutions: alert.maxConcurrentExecutions,
        maxConcurrentExecutionsPerOwner: alert.maxConcurrentExecutionsPerOwner,
        ownerUserId: alert.busiestOwnerUserId,
        busiestOwnerRunningCount: alert.busiestOwnerRunningCount,
        busiestBlockedOwnerUserId: alert.busiestBlockedOwnerUserId,
        busiestBlockedOwnerQueuedCount: alert.busiestBlockedOwnerQueuedCount,
        saturatedOwnerCount: alert.saturatedOwnerCount,
        profileCount: summary.profileCount,
        criticalProfileCount: summary.criticalProfileCount,
        watchProfileCount: summary.watchProfileCount,
        totalQueuedExecutionCount: summary.queuedExecutionCount,
        claimableQueuedExecutionCountTotal: summary.claimableQueuedExecutionCount,
        blockedQueuedExecutionCountTotal: summary.blockedQueuedExecutionCount,
        blockedByProfileCountTotal: summary.blockedByProfileCount,
        blockedByOwnerCountTotal: summary.blockedByOwnerCount,
        maxAlertLevel: summary.maxAlertLevel,
      },
      db,
      "account",
    );
    dispatchedCount += 1;
    dispatchedAlerts.push({
      ...alert,
      dispatched: true,
      skippedReason: null,
    });
  }

  return {
    dispatchedCount,
    skippedCount,
    minimumAlertLevel,
    alerts: dispatchedAlerts,
  };
}

function getRuntimeSessionTerminalStateForExecutionStatus(
  status: AgentExecutionStatus,
): AgentExecutionRuntimeSessionState | null {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
    case "cancelled":
      return "failed";
    case "queued":
      return "requeued";
    default:
      return null;
  }
}

function buildRuntimeSessionConditions(args?: {
  agentId?: string;
  ownerUserId?: string;
  state?: AgentExecutionRuntimeSessionState;
  kind?: AgentExecutionRuntimeSessionView["kind"];
  staleOnly?: boolean;
}) {
  const clauses: SQL[] = [];

  if (args?.agentId) {
    clauses.push(eq(agentExecutionRuntimeSessions.agentId, args.agentId));
  }
  if (args?.ownerUserId) {
    clauses.push(eq(agentExecutionRuntimeSessions.ownerUserId, args.ownerUserId));
  }
  if (args?.state) {
    clauses.push(eq(agentExecutionRuntimeSessions.state, args.state));
  }
  if (args?.kind) {
    clauses.push(eq(agentExecutionRuntimeSessions.kind, args.kind));
  }
  if (args?.staleOnly) {
    clauses.push(sql`
      ${agentExecutionRuntimeSessions.endedAt} is null
      and (
        ${agentExecutionRuntimeSessions.updatedAt} <= now() - (${env.agentExecutionStaleSeconds} * interval '1 second')
        or ${agentExecutions.status} in ('queued', 'completed', 'failed', 'cancelled')
      )
    `);
  }

  return clauses;
}

export async function getRuntimeSessionSummaryForOperator(args?: {
  agentId?: string;
  ownerUserId?: string;
  state?: AgentExecutionRuntimeSessionState;
  kind?: AgentExecutionRuntimeSessionView["kind"];
  staleOnly?: boolean;
}): Promise<AgentExecutionRuntimeSessionSummaryView> {
  const whereClause = toWhereClause(buildRuntimeSessionConditions(args));

  let latestQuery = db
    .select({
      totalCount: sql<number>`count(*)::int`,
      openCount: sql<number>`count(*) filter (where ${agentExecutionRuntimeSessions.endedAt} is null)::int`,
      oldestOpenStartedAt: sql<Date | null>`min(case when ${agentExecutionRuntimeSessions.endedAt} is null then ${agentExecutionRuntimeSessions.startedAt} end)`,
      oldestStaleStartedAt: sql<Date | null>`min(case when ${agentExecutionRuntimeSessions.endedAt} is null and ${agentExecutionRuntimeSessions.updatedAt} <= now() - (${env.agentExecutionStaleSeconds} * interval '1 second') then ${agentExecutionRuntimeSessions.startedAt} end)`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    latestQuery = latestQuery.where(whereClause);
  }
  const [latestRow] = await latestQuery;

  let staleQuery = db
    .select({
      staleCount: sql<number>`count(*) filter (
        where ${agentExecutionRuntimeSessions.endedAt} is null
          and ${agentExecutionRuntimeSessions.updatedAt} <= now() - (${env.agentExecutionStaleSeconds} * interval '1 second')
      )::int`,
      terminalOpenCount: sql<number>`count(*) filter (
        where ${agentExecutionRuntimeSessions.endedAt} is null
          and ${agentExecutions.status} in ('queued', 'completed', 'failed', 'cancelled')
      )::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    staleQuery = staleQuery.where(whereClause);
  }
  const [staleRow] = await staleQuery;

  let kindQuery = db
    .select({
      key: agentExecutionRuntimeSessions.kind,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    kindQuery = kindQuery.where(whereClause);
  }
  const kindRows = await kindQuery.groupBy(agentExecutionRuntimeSessions.kind);

  let stateQuery = db
    .select({
      key: agentExecutionRuntimeSessions.state,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    stateQuery = stateQuery.where(whereClause);
  }
  const stateRows = await stateQuery.groupBy(agentExecutionRuntimeSessions.state);

  let openKindQuery = db
    .select({
      key: agentExecutionRuntimeSessions.kind,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    openKindQuery = openKindQuery.where(and(whereClause, sql`${agentExecutionRuntimeSessions.endedAt} is null`));
  } else {
    openKindQuery = openKindQuery.where(sql`${agentExecutionRuntimeSessions.endedAt} is null`);
  }
  const openKindRows = await openKindQuery.groupBy(agentExecutionRuntimeSessions.kind);

  let openStateQuery = db
    .select({
      key: agentExecutionRuntimeSessions.state,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    openStateQuery = openStateQuery.where(and(whereClause, sql`${agentExecutionRuntimeSessions.endedAt} is null`));
  } else {
    openStateQuery = openStateQuery.where(sql`${agentExecutionRuntimeSessions.endedAt} is null`);
  }
  const openStateRows = await openStateQuery.groupBy(agentExecutionRuntimeSessions.state);

  const staleOpenCount = Number(staleRow?.staleCount ?? 0);
  const terminalExecutionOpenCount = Number(staleRow?.terminalOpenCount ?? 0);
  const openByKind = buildSummaryBuckets(openKindRows as Array<{ key: string; count: number }>);
  const openByState = buildSummaryBuckets(openStateRows as Array<{ key: string; count: number }>);
  const oldestStaleStartedAt = latestRow?.oldestStaleStartedAt ? latestRow.oldestStaleStartedAt.toISOString() : null;
  const openCount = Number(latestRow?.openCount ?? 0);

  return {
    totalCount: Number(latestRow?.totalCount ?? 0),
    openCount,
    staleOpenCount,
    terminalExecutionOpenCount,
    oldestOpenStartedAt: latestRow?.oldestOpenStartedAt ? latestRow.oldestOpenStartedAt.toISOString() : null,
    oldestStaleStartedAt,
    byKind: buildSummaryBuckets(kindRows as Array<{ key: string; count: number }>),
    byState: buildSummaryBuckets(stateRows as Array<{ key: string; count: number }>),
    openByKind,
    openByState,
    recommendations: buildRuntimeSessionRecommendations({
      openCount,
      staleOpenCount,
      terminalExecutionOpenCount,
      oldestStaleStartedAt,
      openByKind,
      openByState,
    }),
  };
}

export async function listRuntimeSessionsForOperator(args?: {
  agentId?: string;
  ownerUserId?: string;
  state?: AgentExecutionRuntimeSessionState;
  kind?: AgentExecutionRuntimeSessionView["kind"];
  staleOnly?: boolean;
  limit?: number;
}): Promise<AgentExecutionRuntimeSessionView[]> {
  const limit = Math.max(1, Math.min(args?.limit ?? 100, 200));
  const clauses = buildRuntimeSessionConditions(args);

  const rows = await db
    .select({
      session: agentExecutionRuntimeSessions,
      execution: agentExecutions,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .where(toWhereClause(clauses))
    .orderBy(desc(agentExecutionRuntimeSessions.startedAt))
    .limit(limit);

  return rows.map(({ session, execution }) => toAgentExecutionRuntimeSessionView(session, execution));
}

export async function sweepRuntimeSessions(args?: {
  limit?: number;
  staleSeconds?: number;
  agentId?: string;
  ownerUserId?: string;
  state?: AgentExecutionRuntimeSessionState;
  kind?: AgentExecutionRuntimeSessionView["kind"];
  staleOnly?: boolean;
}): Promise<AgentExecutionRuntimeSessionSweepResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 25, 100));
  const staleSeconds = getMinimumExecutionPhaseTimeoutSeconds(args?.staleSeconds ?? null);
  const sweepWhereClause = toWhereClause([
    ...buildRuntimeSessionConditions({
      agentId: args?.agentId,
      ownerUserId: args?.ownerUserId,
      state: args?.state,
      kind: args?.kind,
      staleOnly: args?.staleOnly,
    }),
    sql`${agentExecutionRuntimeSessions.endedAt} is null`,
    sql`(
      ${agentExecutions.status} in ('queued', 'completed', 'failed', 'cancelled')
      or ${agentExecutionRuntimeSessions.updatedAt} <= now() - (${staleSeconds} * interval '1 second')
    )`,
  ]);

  return db.transaction(async (tx) => {
    const rows = await tx.execute<{
      session_id: string;
      execution_id: string;
      execution_status: AgentExecutionStatus;
      executor_phase: string | null;
      updated_at: Date;
      ended_at: Date | null;
    }>(sql`
      select
        ${agentExecutionRuntimeSessions.id} as session_id,
        ${agentExecutionRuntimeSessions.executionId} as execution_id,
        ${agentExecutions.status} as execution_status,
        ${agentExecutions.executorPhase} as executor_phase,
        ${agentExecutionRuntimeSessions.updatedAt} as updated_at,
        ${agentExecutionRuntimeSessions.endedAt} as ended_at
      from ${agentExecutionRuntimeSessions}
      inner join ${agentExecutions} on ${agentExecutions.id} = ${agentExecutionRuntimeSessions.executionId}
      where ${sweepWhereClause ?? sql`true`}
      order by ${agentExecutionRuntimeSessions.updatedAt} asc
      limit ${limit}
      for update skip locked
    `);

    const closedSessionIds: string[] = [];
    let skippedCount = 0;

    for (const row of rows.rows) {
      const nextState = getRuntimeSessionTerminalStateForExecutionStatus(row.execution_status);
      if (!nextState) {
        const phaseAgeSeconds = getExecutionPhaseAgeSeconds({
          updatedAt: row.updated_at,
          status: row.execution_status,
          phase: (row.executor_phase as PlatformExecutionPhase | null) ?? null,
        });
        const phaseTimeoutSeconds = getExecutionPhaseTimeoutSeconds(
          (row.executor_phase as PlatformExecutionPhase | null) ?? null,
          args?.staleSeconds ?? null,
        );
        if (phaseAgeSeconds === null || phaseAgeSeconds < phaseTimeoutSeconds) {
          skippedCount += 1;
          continue;
        }
        skippedCount += 1;
        continue;
      }

      const [session] = await tx
        .select()
        .from(agentExecutionRuntimeSessions)
        .where(eq(agentExecutionRuntimeSessions.id, row.session_id))
        .limit(1);

      if (!session || session.endedAt) {
        skippedCount += 1;
        continue;
      }

      await tx
        .update(agentExecutionRuntimeSessions)
        .set({
          state: nextState,
          endedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? session.endedPhase,
          note:
            session.note ??
            (nextState === "requeued"
              ? "Runtime session sweep closed a queued execution session."
              : "Runtime session sweep closed a terminal execution session."),
          endedAt: now(),
          updatedAt: now(),
        })
        .where(eq(agentExecutionRuntimeSessions.id, session.id));

      closedSessionIds.push(session.id);
    }

    return {
      closedCount: closedSessionIds.length,
      skippedCount,
      staleSeconds,
      latestSweepAt: now().toISOString(),
      closedSessionIds,
    };
  });
}

export async function runPendingAgentExecutionSettlements(args?: { limit?: number; executionId?: string }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 100));

  if (args?.executionId) {
    const execution = await settleExecutionById(args.executionId);
    return {
      settledCount: execution?.settlement?.status === "settled" ? 1 : 0,
      insufficientBalanceCount: execution?.settlement?.status === "pending_insufficient_balance" ? 1 : 0,
      skippedCount:
        !execution?.settlement || ["pending", "skipped"].includes(execution.settlement.status) ? 1 : 0,
    };
  }

  const rows = await db
    .select({ executionId: agentExecutionSettlements.executionId })
    .from(agentExecutionSettlements)
    .where(inArray(agentExecutionSettlements.status, ["pending", "pending_insufficient_balance"]))
    .orderBy(asc(agentExecutionSettlements.updatedAt))
    .limit(limit);

  let settledCount = 0;
  let insufficientBalanceCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    const execution = await settleExecutionById(row.executionId);
    if (!execution?.settlement) {
      skippedCount += 1;
      continue;
    }
    if (execution.settlement.status === "settled") {
      settledCount += 1;
    } else if (execution.settlement.status === "pending_insufficient_balance") {
      insufficientBalanceCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    settledCount,
    insufficientBalanceCount,
    skippedCount,
  };
}

export async function listAgentExecutionSettlementAttempts(args?: {
  status?: AgentExecutionSettlementAttemptStatus;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(args?.limit ?? 50, 200));
  const conditions: SQL[] = [];
  if (args?.status) {
    conditions.push(eq(agentExecutionSettlementAttempts.status, args.status));
  }
  const rows = await db
    .select()
    .from(agentExecutionSettlementAttempts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentExecutionSettlementAttempts.createdAt))
    .limit(limit);
  return rows.map(toAgentExecutionSettlementAttemptView);
}

export async function getAgentExecutionSettlementSummary(): Promise<AgentExecutionSettlementSummaryView> {
  const [counts, totals, recentAttempts] = await Promise.all([
    db
      .select({
        status: agentExecutionSettlements.status,
        count: sql<number>`count(*)::int`,
      })
      .from(agentExecutionSettlements)
      .groupBy(agentExecutionSettlements.status),
    db
      .select({
        totalBilledAmount: sql<number>`coalesce(sum(${agentExecutionSettlements.billedAmount}), 0)::int`,
        totalRevenueAmount: sql<number>`coalesce(sum(${agentExecutionSettlements.revenueAmount}), 0)::int`,
      })
      .from(agentExecutionSettlements),
    db.select().from(agentExecutionSettlementAttempts).orderBy(desc(agentExecutionSettlementAttempts.createdAt)).limit(20),
  ]);

  const countMap = new Map(counts.map((row) => [row.status, Number(row.count ?? 0)]));
  return {
    pendingCount: countMap.get("pending") ?? 0,
    pendingInsufficientBalanceCount: countMap.get("pending_insufficient_balance") ?? 0,
    settledCount: countMap.get("settled") ?? 0,
    skippedCount: countMap.get("skipped") ?? 0,
    totalBilledAmount: Number(totals[0]?.totalBilledAmount ?? 0),
    totalRevenueAmount: Number(totals[0]?.totalRevenueAmount ?? 0),
    recentAttempts: recentAttempts.map(toAgentExecutionSettlementAttemptView),
  };
}

export async function retryAgentExecutionSettlement(executionId: string) {
  return settleExecutionById(executionId);
}

async function requestRejectedCallbackRetryWithActor(args: {
  actorUserId: string;
  auditId: string;
  note?: string | null;
  actorLabel: string;
  remediationMode: AgentExecutionCallbackRemediationMode;
  plan?: AgentExecutionCallbackAuditView["remediationPlan"] | null;
  fallbackFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
  fallbackReason?: string | null;
}): Promise<AgentExecutionCallbackRetryRequestResult> {
  const normalizedAuditId = args.auditId.trim();
  if (!normalizedAuditId) {
    throw new NotFoundError("Callback audit not found");
  }

  const [row] = await db
    .select({
      callback: agentExecutionCallbacks,
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutionCallbacks)
    .innerJoin(agentExecutions, eq(agentExecutionCallbacks.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionCallbacks.agentId, agents.id))
    .where(eq(agentExecutionCallbacks.id, normalizedAuditId));

  if (!row) {
    throw new NotFoundError("Callback audit not found");
  }

  if (row.callback.status !== "rejected") {
    throw new ConflictError("Only rejected callback audits can be marked for retry requests");
  }

  if (row.agent.sourceType !== "external") {
    throw new ConflictError("Only external callback audits support retry requests");
  }

  const operatorNote = args.note?.trim() || null;
  const duplicateSummary = `${args.actorLabel} requested a retry for rejected callback audit ${row.callback.id}.`;
  const [recentDuplicate] = await db
    .select({
      id: agentExecutionRuns.id,
    })
    .from(agentExecutionRuns)
    .where(
      and(
        eq(agentExecutionRuns.executionId, row.execution.id),
        eq(agentExecutionRuns.runKind, "callback_retry_request"),
        sql`${agentExecutionRuns.summary} like ${`%callback audit ${row.callback.id}%`}`,
        sql`${agentExecutionRuns.createdAt} >= now() - interval '15 minutes'`,
      ),
    )
    .limit(1);

  if (recentDuplicate) {
    throw new ConflictError("A callback retry request was already recorded recently for this audit");
  }

  const requestedAt = now();

  const run = await db.transaction(async (tx) => {
    await tx
      .update(agentExecutions)
      .set({
        updatedAt: requestedAt,
      })
      .where(eq(agentExecutions.id, row.execution.id));

    const createdRun = await createExecutionRunInTx(tx, {
      executionId: row.execution.id,
      agentId: row.agent.id,
      ownerUserId: row.execution.ownerUserId,
      runKind: "callback_retry_request",
      summary: duplicateSummary,
    });

    await recordExecutionStepInTx(tx, {
      executionId: row.execution.id,
      kind: "status",
      phase: (row.execution.executorPhase as PlatformExecutionPhase | null) ?? null,
        title: `${args.actorLabel} requested rejected callback retry`,
        detail: buildRejectedCallbackRetryRequestDetail({
        callbackId: row.callback.callbackId,
        callbackType: row.callback.callbackType as AgentExecutionCallbackType,
        rejectionCategory: (row.callback.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
          callbackVersion: row.callback.callbackVersion,
          secretVersion: row.callback.secretVersion,
          usedPreviousProtocol: row.callback.usedPreviousProtocol,
          usedPreviousSecret: row.callback.usedPreviousSecret,
          operatorNote,
        }),
      status: "info",
      progressPercent: row.execution.progressPercent,
    });

    await createCallbackRemediationAttemptInTx(tx, {
      callbackAuditId: row.callback.id,
      executionId: row.execution.id,
      agentId: row.agent.id,
      runId: createdRun.id,
      actorUserId: args.actorUserId,
      mode: args.remediationMode,
      status: "completed",
      plannedDecisionClass: args.plan?.decisionClass ?? null,
      plannedPrimaryAction: args.plan?.primaryAction ?? "request_retry",
      plannedFallbackAction: args.plan?.fallbackAction ?? null,
      planReasonCategory: args.plan?.reasonCategory ?? null,
      planReason:
        args.plan?.reason ?? (args.fallbackReason ? "Retry request was recorded as a fallback remediation path." : null),
      fallbackFailureClass: args.fallbackFailureClass ?? null,
      fallbackReason: args.fallbackReason ?? null,
      note: operatorNote,
    });

    await finishExecutionRunInTx(tx, createdRun.id, {
      status: "completed",
      summary: `Retry request recorded for rejected callback audit ${row.callback.id} (${row.callback.callbackId}).`,
      artifactCount: 0,
    });

    return createdRun;
  });

  return {
    auditId: row.callback.id,
    executionId: row.execution.id,
    agentId: row.agent.id,
    callbackId: row.callback.callbackId,
    runId: run.id,
    operatorUserId: args.actorUserId,
    rejectionCategory: (row.callback.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
    note: operatorNote,
    requestedAt: requestedAt.toISOString(),
  };
}

export async function requestRejectedCallbackRetryByOperator(
  operatorUserId: string,
  auditId: string,
  input?: { note?: string | null },
): Promise<AgentExecutionCallbackRetryRequestResult> {
  return requestRejectedCallbackRetryWithActor({
    actorUserId: operatorUserId,
    auditId,
    note: input?.note ?? null,
    actorLabel: "Operator",
    remediationMode: "retry_request",
    plan: null,
  });
}

export async function requestRejectedCallbackRetriesByOperator(
  operatorUserId: string,
  args?: {
    agentId?: string;
    callbackType?: AgentExecutionCallbackType;
    remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
    callbackVersion?: number;
    secretVersion?: number;
    protocolMatch?: "current" | "previous";
    secretMatch?: "current" | "previous";
    rejectionCategory?: AgentExecutionCallbackRejectionCategory;
    retryability?: AgentExecutionCallbackRetryability;
    autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
    autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
    replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
    replayPayloadReplayable?: boolean;
    decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
    replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
    runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
    runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
    runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
    runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
    limit?: number;
    note?: string | null;
  },
): Promise<AgentExecutionCallbackRetryBatchResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 50));
  const operatorNote = args?.note?.trim() || null;
  if (hasCallbackAuditDerivedFilters(args)) {
    const candidates = await listCallbackAuditViewsForOperator({
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: "rejected",
      remediationPolicyKey: args?.remediationPolicyKey,
      callbackVersion: args?.callbackVersion,
      secretVersion: args?.secretVersion,
      protocolMatch: args?.protocolMatch,
      secretMatch: args?.secretMatch,
      rejectionCategory: args?.rejectionCategory,
      retryability: args?.retryability,
      autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
      autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
      replayPayloadCompatibility: args?.replayPayloadCompatibility,
      replayPayloadReplayable: args?.replayPayloadReplayable,
      decisionClass: args?.decisionClass,
      replayFailureClass: args?.replayFailureClass,
      runtimeDecisionClass: args?.runtimeDecisionClass,
      runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
      runtimePressureLevel: args?.runtimePressureLevel,
      runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
    });
    const scopedCandidates = candidates.slice(0, limit);
    const results: AgentExecutionCallbackRetryRequestResult[] = [];
    const skippedAuditIds: string[] = [];

    for (const candidate of scopedCandidates) {
      try {
        const result = await requestRejectedCallbackRetryByOperator(operatorUserId, candidate.id, {
          note: operatorNote,
        });
        results.push(result);
      } catch (error) {
        if (error instanceof ConflictError) {
          skippedAuditIds.push(candidate.id);
          continue;
        }
        throw error;
      }
    }

    return {
      requestedCount: results.length,
      skippedCount: skippedAuditIds.length,
      retryability: args?.retryability ?? null,
      results,
      skippedAuditIds,
    };
  }
  const whereClause = toWhereClause(
    buildCallbackAuditConditions({
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: "rejected",
      remediationPolicyKey: args?.remediationPolicyKey,
      callbackVersion: args?.callbackVersion,
      secretVersion: args?.secretVersion,
      protocolMatch: args?.protocolMatch,
      secretMatch: args?.secretMatch,
      rejectionCategory: args?.rejectionCategory,
      retryability: args?.retryability,
      autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
      autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
    }),
  );

  let query = db
    .select({
      id: agentExecutionCallbacks.id,
    })
    .from(agentExecutionCallbacks)
    .$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
  }

  const candidates = await query.orderBy(desc(agentExecutionCallbacks.receivedAt)).limit(limit);
  const results: AgentExecutionCallbackRetryRequestResult[] = [];
  const skippedAuditIds: string[] = [];

  for (const candidate of candidates) {
    try {
      const result = await requestRejectedCallbackRetryByOperator(operatorUserId, candidate.id, {
        note: operatorNote,
      });
      results.push(result);
    } catch (error) {
      if (error instanceof ConflictError) {
        skippedAuditIds.push(candidate.id);
        continue;
      }
      throw error;
    }
  }

  return {
    requestedCount: results.length,
    skippedCount: skippedAuditIds.length,
    retryability: args?.retryability ?? null,
    results,
    skippedAuditIds,
  };
}

async function replayRejectedCallbackPayloadWithActor(args: {
  actorUserId: string;
  auditId: string;
  note?: string | null;
  runKind: AgentExecutionRunView["runKind"];
  actorLabel: string;
  plan?: AgentExecutionCallbackAuditView["remediationPlan"] | null;
}): Promise<AgentExecutionCallbackReplayResult> {
  const normalizedAuditId = args.auditId.trim();
  if (!normalizedAuditId) {
    throw new NotFoundError("Callback audit not found");
  }

  const [row] = await db
    .select({
      callback: agentExecutionCallbacks,
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutionCallbacks)
    .innerJoin(agentExecutions, eq(agentExecutionCallbacks.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionCallbacks.agentId, agents.id))
    .where(eq(agentExecutionCallbacks.id, normalizedAuditId));

  if (!row) {
    throw new NotFoundError("Callback audit not found");
  }
  if (row.callback.status !== "rejected") {
    throw new ConflictError("Only rejected callback audits can replay stored payloads");
  }
  if (row.agent.sourceType !== "external") {
    throw new ConflictError("Only external callback audits support stored payload replay");
  }
  if (!row.agent.enabled) {
    throw new ConflictError("External agent is disabled");
  }

  const retryGuidance = getExternalCallbackRetryGuidance(
    (row.callback.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
  );
  if (retryGuidance.retryability !== "retryable") {
    throw new ConflictError("Only retryable rejected callbacks support stored payload replay");
  }

  const replayPayloadResolution = resolveStoredExternalCallbackReplayEnvelope(row.callback.replayPayload);
  const replayPayload = replayPayloadResolution.envelope;
  if (!replayPayload) {
    throw new ConflictError("Stored payload replay is unavailable for this callback audit");
  }

  const callbackSecret = row.agent.externalCallbackSecret?.trim() || null;
  if (!callbackSecret) {
    throw new ConflictError("External agent callback secret is unavailable for payload replay");
  }

  const actorNote = args.note?.trim() || null;
  const duplicateSummary = `${args.actorLabel} replayed stored payload for callback audit ${row.callback.id}.`;
  const [recentDuplicate] = await db
    .select({
      id: agentExecutionRuns.id,
    })
    .from(agentExecutionRuns)
    .where(
      and(
        eq(agentExecutionRuns.executionId, row.execution.id),
        inArray(agentExecutionRuns.runKind, ["callback_payload_replay", "callback_auto_remediation"]),
        sql`${agentExecutionRuns.summary} like ${`%callback audit ${row.callback.id}%`}`,
        sql`${agentExecutionRuns.createdAt} >= now() - interval '15 minutes'`,
      ),
    )
    .limit(1);

  if (recentDuplicate) {
    throw new ConflictError("A callback payload replay was already recorded recently for this audit");
  }

  const replayedAt = now();
  const replayCallbackId = `replay:${row.callback.callbackId}:${crypto.randomUUID().slice(0, 8)}`;
  const remediationMode: AgentExecutionCallbackRemediationMode =
    args.runKind === "callback_auto_remediation" ? "auto_payload_replay" : "manual_payload_replay";

  const { run, attemptId } = await db.transaction(async (tx) => {
    await tx
      .update(agentExecutions)
      .set({
        updatedAt: replayedAt,
      })
      .where(eq(agentExecutions.id, row.execution.id));

    const createdRun = await createExecutionRunInTx(tx, {
      executionId: row.execution.id,
      agentId: row.agent.id,
      ownerUserId: row.execution.ownerUserId,
      runKind: args.runKind,
      summary: duplicateSummary,
    });

    await recordExecutionStepInTx(tx, {
      executionId: row.execution.id,
      kind: "status",
      phase: (row.execution.executorPhase as PlatformExecutionPhase | null) ?? null,
      title: `${args.actorLabel} replayed stored callback payload`,
      detail: buildStoredCallbackReplayDetail({
        callbackId: row.callback.callbackId,
        replayCallbackId,
        callbackType: row.callback.callbackType as AgentExecutionCallbackType,
        operatorNote: actorNote,
      }),
      status: "info",
      progressPercent: row.execution.progressPercent,
    });

    const attempt = await createCallbackRemediationAttemptInTx(tx, {
      callbackAuditId: row.callback.id,
      executionId: row.execution.id,
      agentId: row.agent.id,
      runId: createdRun.id,
      actorUserId: args.actorUserId,
      mode: remediationMode,
      plannedDecisionClass: args.plan?.decisionClass ?? null,
      plannedPrimaryAction: args.plan?.primaryAction ?? "replay_payload",
      plannedFallbackAction: args.plan?.fallbackAction ?? null,
      planReasonCategory: args.plan?.reasonCategory ?? null,
      planReason: args.plan?.reason ?? "Stored payload replay was chosen as the primary remediation path.",
      fallbackFailureClass: null,
      note: actorNote,
    });

    return {
      run: createdRun,
      attemptId: attempt.id,
    };
  });

  try {
    if (replayPayload.type === "heartbeat") {
      await recordExternalAgentExecutionHeartbeat(
        row.execution.id,
        callbackSecret,
        replayCallbackId,
        row.agent.externalCallbackProtocolVersion,
        replayedAt,
        replayPayload.statusNote ?? undefined,
      );
    } else if (replayPayload.type === "status") {
      await updateExternalAgentExecutionStatus(row.execution.id, callbackSecret, replayCallbackId, row.agent.externalCallbackProtocolVersion, replayedAt, {
        status: replayPayload.status,
        statusNote: replayPayload.statusNote ?? undefined,
        resultSummary: replayPayload.resultSummary ?? undefined,
      });
    } else {
      await addExternalAgentExecutionArtifact(
        row.execution.id,
        callbackSecret,
        replayCallbackId,
        row.agent.externalCallbackProtocolVersion,
        replayedAt,
        {
          kind: replayPayload.artifact.kind,
          title: replayPayload.artifact.title,
          url: replayPayload.artifact.url ?? undefined,
          summary: replayPayload.artifact.summary ?? undefined,
        },
      );
    }

    await db.transaction(async (tx) => {
      await finishExecutionRunInTx(tx, run.id, {
        status: "completed",
        summary: `${args.actorLabel} stored payload replay completed for callback audit ${row.callback.id} (${replayCallbackId}).`,
        artifactCount: 0,
      });
      await finishCallbackRemediationAttemptInTx(tx, attemptId, {
        status: "completed",
      });
    });
  } catch (error) {
    const replayFailureClass =
      error instanceof Error ? classifyReplayFailureForRetryFallback(error.message) : null;
    const fallbackReason =
      error instanceof Error
        ? replayFailureClass
          ? `${replayFailureClass}: ${error.message}`
          : error.message
        : "Stored payload replay failed";
    await db.transaction(async (tx) => {
      await finishExecutionRunInTx(tx, run.id, {
        status: "failed",
        summary: `${args.actorLabel} stored payload replay failed for callback audit ${row.callback.id}.`,
        errorMessage: error instanceof Error ? error.message : "Stored payload replay failed",
        artifactCount: 0,
      });
      await finishCallbackRemediationAttemptInTx(tx, attemptId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Stored payload replay failed",
        fallbackFailureClass: replayFailureClass,
        fallbackReason,
      });

      await recordExecutionStepInTx(tx, {
        executionId: row.execution.id,
        kind: "status",
        phase: (row.execution.executorPhase as PlatformExecutionPhase | null) ?? null,
        title: `${args.actorLabel} stored callback payload replay failed`,
        detail: error instanceof Error ? error.message : "Stored payload replay failed",
        status: "failed",
        progressPercent: row.execution.progressPercent,
      });
    });
    throw error;
  }

  return {
    auditId: row.callback.id,
    executionId: row.execution.id,
    agentId: row.agent.id,
    callbackId: row.callback.callbackId,
    replayCallbackId,
    callbackType: row.callback.callbackType as AgentExecutionCallbackType,
    replayPayloadCompatibility: replayPayloadResolution.compatibility,
    runId: run.id,
    operatorUserId: args.actorUserId,
    replayedAt: replayedAt.toISOString(),
  };
}

export async function replayRejectedCallbackPayloadByOperator(
  operatorUserId: string,
  auditId: string,
  input?: { note?: string | null },
): Promise<AgentExecutionCallbackReplayResult> {
  return replayRejectedCallbackPayloadWithActor({
    actorUserId: operatorUserId,
    auditId,
    note: input?.note ?? null,
    runKind: "callback_payload_replay",
    actorLabel: "Operator",
    plan: null,
  });
}

export async function autoRemediateRejectedCallbackPayloads(args?: {
  agentId?: string;
  callbackType?: AgentExecutionCallbackType;
  remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
  callbackVersion?: number;
  secretVersion?: number;
  protocolMatch?: "current" | "previous";
  secretMatch?: "current" | "previous";
  rejectionCategory?: AgentExecutionCallbackRejectionCategory;
  retryability?: AgentExecutionCallbackRetryability;
  autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
  autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
  replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
  replayPayloadReplayable?: boolean;
  decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
  replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
  runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
  runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
  runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
  runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
  ignoreScheduleWindow?: boolean;
  limit?: number;
  note?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
}): Promise<AgentExecutionCallbackAutoRemediationResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 50));
  const callbackQuery: CallbackAuditOperatorQuery = {
    agentId: args?.agentId,
    callbackType: args?.callbackType,
    status: "rejected",
    remediationPolicyKey: args?.remediationPolicyKey,
    callbackVersion: args?.callbackVersion,
    secretVersion: args?.secretVersion,
    protocolMatch: args?.protocolMatch,
    secretMatch: args?.secretMatch,
    rejectionCategory: args?.rejectionCategory,
    retryability: args?.retryability ?? "retryable",
    autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
    autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
    replayPayloadCompatibility: args?.replayPayloadCompatibility,
    replayPayloadReplayable: args?.replayPayloadReplayable,
    decisionClass: args?.decisionClass,
    replayFailureClass: args?.replayFailureClass,
    runtimeDecisionClass: args?.runtimeDecisionClass,
    runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
    runtimePressureLevel: args?.runtimePressureLevel,
    runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
    limit: limit * 3,
  };
  const nowRef = now();
  const scheduleFilter = (candidate: typeof agentExecutionCallbacks.$inferSelect) =>
    !candidate.autoRemediationExhaustedAt &&
    (args?.ignoreScheduleWindow ||
      !candidate.nextAutoRemediationAt ||
      candidate.nextAutoRemediationAt.getTime() <= nowRef.getTime());

  let candidates: Array<typeof agentExecutionCallbacks.$inferSelect> = [];
  if (hasCallbackAuditDerivedFilters(callbackQuery)) {
    const candidateViews = await listCallbackAuditsForOperator(callbackQuery);
    const candidateIds = candidateViews.map((candidate) => candidate.id);
    const candidateRows =
      candidateIds.length > 0
        ? await db.select().from(agentExecutionCallbacks).where(inArray(agentExecutionCallbacks.id, candidateIds))
        : [];
    const candidateRowMap = new Map(candidateRows.map((row) => [row.id, row]));
    candidates = candidateIds
      .map((candidateId) => candidateRowMap.get(candidateId) ?? null)
      .filter((candidate): candidate is typeof agentExecutionCallbacks.$inferSelect => Boolean(candidate))
      .filter(scheduleFilter);
  } else {
    const whereClause = toWhereClause([
      ...buildCallbackAuditConditions(callbackQuery),
      sql`${agentExecutionCallbacks.autoRemediationExhaustedAt} is null`,
      args?.ignoreScheduleWindow
        ? sql`true`
        : sql`(${agentExecutionCallbacks.nextAutoRemediationAt} is null or ${agentExecutionCallbacks.nextAutoRemediationAt} <= now())`,
    ]);

    let query = db.select().from(agentExecutionCallbacks).$dynamic();
    if (whereClause) {
      query = query.where(whereClause);
    }
    candidates = await query.orderBy(desc(agentExecutionCallbacks.receivedAt)).limit(limit * 3);
  }

  const agentIds = Array.from(new Set(candidates.map((candidate) => candidate.agentId)));
  const agentRows =
    agentIds.length > 0 ? await db.select().from(agents).where(inArray(agents.id, agentIds)) : [];
  const agentById = new Map(agentRows.map((agent) => [agent.id, agent]));
  const results: AgentExecutionCallbackReplayResult[] = [];
  const requestedRetryAuditIds: string[] = [];
  const skippedAuditIds: string[] = [];
  const failedAuditIds: string[] = [];
  const actorUserId = args?.actorUserId?.trim() || automaticCallbackRemediationActorId;
  const actorLabel = args?.actorLabel?.trim() || "Automatic remediation";

  async function recordSkippedAutoRemediation(
    candidate: typeof agentExecutionCallbacks.$inferSelect,
    reason: string,
    baseBackoffSeconds = env.agentExecutionCallbackAutoRemediationBaseBackoffSeconds,
  ) {
    const timestamp = now();
    await db
      .update(agentExecutionCallbacks)
      .set({
        lastAutoRemediationAt: timestamp,
        nextAutoRemediationAt: getSkippedAutoRemediationNextAttemptAt(timestamp, baseBackoffSeconds),
        autoRemediationExhaustedAt: null,
        autoRemediationLastError: reason,
      })
      .where(eq(agentExecutionCallbacks.id, candidate.id));
  }

  for (const candidate of candidates) {
    const agent = agentById.get(candidate.agentId);
    if (!agent) {
      await recordSkippedAutoRemediation(
        candidate,
        "Automatic remediation skipped because the linked agent is missing or no longer external.",
      );
      skippedAuditIds.push(candidate.id);
      continue;
    }

    const policy = buildAgentCallbackRemediationPolicyView(
      normalizeRemediationPolicyKey(candidate.remediationPolicyKey),
    );
    const maxAttempts = Math.max(0, policy.maxAttempts);
    const rejectionCategory =
      (candidate.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null;

    if (results.length + requestedRetryAuditIds.length >= limit) {
      break;
    }

    const replayPayloadResolution = resolveStoredExternalCallbackReplayEnvelope(candidate.replayPayload);
    const plan = buildCallbackRemediationPlan({
      status: candidate.status as AgentExecutionCallbackAuditStatus,
      agentSourceType: agent.sourceType as AgentSourceType,
      agentEnabled: agent.enabled,
      usedPreviousProtocol: candidate.usedPreviousProtocol,
      usedPreviousSecret: candidate.usedPreviousSecret,
      retryability:
        (getExternalCallbackRetryGuidance(rejectionCategory).retryability as AgentExecutionCallbackRetryability | null) ??
        null,
      rejectionCategory,
      policy,
      replayPayload: replayPayloadResolution,
      autoRemediationAttempts: candidate.autoRemediationAttempts,
    });

    if (plan.primaryAction === "skip") {
      if (plan.reasonCategory === "policy_budget_exhausted") {
        const timestamp = now();
        await db
          .update(agentExecutionCallbacks)
          .set({
            autoRemediationExhaustedAt: candidate.autoRemediationExhaustedAt ?? timestamp,
            nextAutoRemediationAt: null,
            autoRemediationLastError: candidate.autoRemediationLastError ?? plan.reason,
          })
          .where(eq(agentExecutionCallbacks.id, candidate.id));
      } else {
        await recordSkippedAutoRemediation(candidate, plan.reason, policy.baseBackoffSeconds);
      }
      skippedAuditIds.push(candidate.id);
      continue;
    }

    try {
      if (plan.primaryAction === "replay_payload") {
        try {
          const result = await replayRejectedCallbackPayloadWithActor({
            actorUserId,
            auditId: candidate.id,
            note: args?.note ?? "Automatic remediation replayed a retryable stored callback payload.",
            runKind: "callback_auto_remediation",
            actorLabel,
            plan,
          });
          results.push(result);
        } catch (error) {
          const replayFailureClass =
            error instanceof Error ? classifyReplayFailureForRetryFallback(error.message) : null;
          if (
            plan.fallbackAction === "request_retry" &&
            error instanceof Error &&
            shouldFallbackReplayFailureToRetryRequestByPolicy({
              policy,
              errorMessage: error.message,
            })
          ) {
            await requestRejectedCallbackRetryWithActor({
              actorUserId,
              auditId: candidate.id,
              note:
                args?.note ??
                `Automatic remediation requested an external retry after stored payload replay could not proceed${
                  replayFailureClass ? ` (${replayFailureClass})` : ""
                }: ${error.message}`,
              actorLabel,
              remediationMode: "auto_retry_request",
              plan,
              fallbackFailureClass: replayFailureClass,
              fallbackReason: replayFailureClass ? `${replayFailureClass}: ${error.message}` : error.message,
            });
            requestedRetryAuditIds.push(candidate.id);
          } else {
            throw error;
          }
        }
      } else if (plan.primaryAction === "request_retry") {
        await requestRejectedCallbackRetryWithActor({
          actorUserId,
          auditId: candidate.id,
          note:
            args?.note ??
            "Automatic remediation requested an external retry because the callback is retryable but stored payload replay could not be used as the primary path.",
          actorLabel,
          remediationMode: "auto_retry_request",
          plan,
        });
        requestedRetryAuditIds.push(candidate.id);
      }

      await db
        .update(agentExecutionCallbacks)
        .set({
          autoRemediationAttempts: candidate.autoRemediationAttempts + 1,
          lastAutoRemediationAt: now(),
          nextAutoRemediationAt: null,
          autoRemediationExhaustedAt: null,
          autoRemediationLastError: null,
        })
        .where(eq(agentExecutionCallbacks.id, candidate.id));
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError) {
        await recordSkippedAutoRemediation(
          candidate,
          error.message,
          policy.baseBackoffSeconds,
        );
        skippedAuditIds.push(candidate.id);
        continue;
      }
      const attempts = candidate.autoRemediationAttempts + 1;
      const timestamp = now();
      const exhausted = attempts >= maxAttempts;
      await db
        .update(agentExecutionCallbacks)
        .set({
          autoRemediationAttempts: attempts,
          lastAutoRemediationAt: timestamp,
          nextAutoRemediationAt: exhausted ? null : getNextAutoRemediationAt(attempts, timestamp, policy.baseBackoffSeconds),
          autoRemediationExhaustedAt: exhausted ? timestamp : null,
          autoRemediationLastError: error instanceof Error ? error.message : "Automatic remediation failed",
        })
        .where(eq(agentExecutionCallbacks.id, candidate.id));
      failedAuditIds.push(candidate.id);
    }
  }

  return {
    remediatedCount: results.length,
    requestedRetryCount: requestedRetryAuditIds.length,
    skippedCount: skippedAuditIds.length,
    failedCount: failedAuditIds.length,
    results,
    requestedRetryAuditIds,
    skippedAuditIds,
    failedAuditIds,
  };
}

export async function listExecutionRunsForOperator(
  args?: ExecutionRunOperatorQuery,
): Promise<AgentExecutionOperatorRunView[]> {
  const limit = Math.max(1, Math.min(args?.limit ?? 50, 200));
  const whereClause = toWhereClause(buildExecutionRunConditions(args));
  let query = db
    .select({
      run: agentExecutionRuns,
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .$dynamic();

  if (whereClause) query = query.where(whereClause);

  const rows = await query.orderBy(desc(agentExecutionRuns.createdAt)).limit(limit);
  return rows.map((row) => toAgentExecutionOperatorRunView(row));
}

export async function getExecutionRunSummaryForOperator(
  args?: ExecutionRunOperatorQuery,
): Promise<AgentExecutionOperatorRunSummaryView> {
  const whereClause = toWhereClause(buildExecutionRunConditions(args));

  const [latestRow] = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      failedCount: sql<number>`count(*) filter (where ${agentExecutionRuns.status} = 'failed')::int`,
      totalCostUnits: sql<number>`coalesce(sum(${agentExecutionRuns.costUnits}), 0)::int`,
      newestCreatedAt: max(agentExecutionRuns.createdAt),
      recent15mTotal: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '15 minutes')::int`,
      recent15mFailed: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '15 minutes' and ${agentExecutionRuns.status} = 'failed')::int`,
      recent1hTotal: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '1 hour')::int`,
      recent1hFailed: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '1 hour' and ${agentExecutionRuns.status} = 'failed')::int`,
      recent24hTotal: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '24 hours')::int`,
      recent24hFailed: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '24 hours' and ${agentExecutionRuns.status} = 'failed')::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause);

  const runKindRows = await db
    .select({
      key: agentExecutionRuns.runKind,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(agentExecutionRuns.runKind);

  const runKindCostRows = await db
    .select({
      key: agentExecutionRuns.runKind,
      costUnits: sql<number>`coalesce(sum(${agentExecutionRuns.costUnits}), 0)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(agentExecutionRuns.runKind);

  const runStatusRows = await db
    .select({
      key: agentExecutionRuns.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(agentExecutionRuns.status);

  const executionStatusRows = await db
    .select({
      key: agentExecutions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(agentExecutions.status);

  const executionPhaseRows = await db
    .select({
      key: sql<string>`case when ${agentExecutions.executorPhase} is null then 'none' else ${agentExecutions.executorPhase} end`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(sql`case when ${agentExecutions.executorPhase} is null then 'none' else ${agentExecutions.executorPhase} end`);

  const failureRows = await db
    .select({
      runKind: agentExecutionRuns.runKind,
      summary: agentExecutionRuns.summary,
      errorMessage: agentExecutionRuns.errorMessage,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(toWhereClause([...buildExecutionRunConditions(args), eq(agentExecutionRuns.status, "failed")]))
    .groupBy(agentExecutionRuns.runKind, agentExecutionRuns.summary, agentExecutionRuns.errorMessage);

  const failureBuckets = new Map<string, number>();
  for (const row of failureRows) {
    const key =
      classifyExecutionRunFailure({
        runKind: row.runKind as AgentExecutionRunView["runKind"],
        status: "failed",
        summary: row.summary,
        errorMessage: row.errorMessage,
      }) ?? "unknown_failure";
    failureBuckets.set(key, (failureBuckets.get(key) ?? 0) + Number(row.count ?? 0));
  }

  return {
    totalCount: Number(latestRow?.totalCount ?? 0),
    failedCount: Number(latestRow?.failedCount ?? 0),
    totalCostUnits: Number(latestRow?.totalCostUnits ?? 0),
    newestCreatedAt: latestRow?.newestCreatedAt ? latestRow.newestCreatedAt.toISOString() : null,
    byRunKind: buildSummaryBuckets(runKindRows as Array<{ key: string; count: number }>),
    byRunKindCost: (runKindCostRows as Array<{ key: string; costUnits: number }>)
      .map((row) => ({ key: row.key, costUnits: Number(row.costUnits ?? 0) }))
      .sort((left, right) => right.costUnits - left.costUnits || left.key.localeCompare(right.key)),
    byRunStatus: buildSummaryBuckets(runStatusRows as Array<{ key: string; count: number }>),
    byExecutionStatus: buildSummaryBuckets(executionStatusRows as Array<{ key: string; count: number }>),
    byExecutionPhase: buildSummaryBuckets(
      (executionPhaseRows as Array<{ key: string; count: number }>).map((row) => ({
        key: toExecutionPhaseBucket(row.key as PlatformExecutionPhase | "none"),
        count: row.count,
      })),
    ),
    byFailureCategory: buildSummaryBuckets(
      Array.from(failureBuckets.entries()).map(([key, count]) => ({ key, count })),
    ),
    recentWindows: [
      {
        key: "15m",
        totalCount: Number(latestRow?.recent15mTotal ?? 0),
        failedCount: Number(latestRow?.recent15mFailed ?? 0),
      },
      {
        key: "1h",
        totalCount: Number(latestRow?.recent1hTotal ?? 0),
        failedCount: Number(latestRow?.recent1hFailed ?? 0),
      },
      {
        key: "24h",
        totalCount: Number(latestRow?.recent24hTotal ?? 0),
        failedCount: Number(latestRow?.recent24hFailed ?? 0),
      },
    ],
    recommendations: buildExecutionRunRecommendations({
      byExecutionStatus: buildSummaryBuckets(executionStatusRows as Array<{ key: string; count: number }>),
      byFailureCategory: buildSummaryBuckets(
        Array.from(failureBuckets.entries()).map(([key, count]) => ({ key, count })),
      ),
      recentWindows: [
        {
          key: "15m",
          totalCount: Number(latestRow?.recent15mTotal ?? 0),
          failedCount: Number(latestRow?.recent15mFailed ?? 0),
        },
        {
          key: "1h",
          totalCount: Number(latestRow?.recent1hTotal ?? 0),
          failedCount: Number(latestRow?.recent1hFailed ?? 0),
        },
        {
          key: "24h",
          totalCount: Number(latestRow?.recent24hTotal ?? 0),
          failedCount: Number(latestRow?.recent24hFailed ?? 0),
        },
      ],
    }),
  };
}

export async function createOwnedAgentExecution(
  ownerUserId: string,
  input: CreateAgentExecutionInput,
): Promise<AgentExecutionView> {
  const agent = await getOwnedRunnableAgent(ownerUserId, input.agentId);
  if (!agent) {
    throw new NotFoundError("Agent not found or not owned by current user");
  }
  if (!agent.enabled) {
    throw new ConflictError("Agent is disabled");
  }

  return db.transaction(async (tx) => createOwnedAgentExecutionInTx(tx, ownerUserId, input));
}

export async function createOwnedAgentExecutionInTx(
  tx: NodePgDatabase<typeof schema>,
  ownerUserId: string,
  input: CreateAgentExecutionInput & {
    taskId?: string | null;
    marketplaceInvocation?: AgentMarketplaceInvocationSnapshotView | null;
  },
): Promise<AgentExecutionView> {
  const [agentRow] = await tx
    .select({
      sourceType: schema.agents.sourceType,
      hostingMode: schema.agents.hostingMode,
      externalCallbackRemediationPolicy: schema.agents.externalCallbackRemediationPolicy,
    })
    .from(schema.agents)
    .where(eq(schema.agents.id, input.agentId));
  if (!agentRow) {
    throw new NotFoundError("Agent not found");
  }

  const requestedCallbackRemediationPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(
    input.callbackRemediationPolicyKey,
  );
  if (agentRow.sourceType !== "external" && requestedCallbackRemediationPolicyKey) {
    throw new ConflictError("Only external executions support callback remediation policy override");
  }
  const managedLightCapability = isManagedLightExecutionHostingMode(agentRow.hostingMode)
    ? await resolveManagedLightCapabilityRow({
        agentId: input.agentId,
        capabilityId: input.capabilityId ?? null,
        connection: tx,
      })
    : null;

  const createdAt = now();
  const runtimeState = getInitialRuntimeState(agentRow.sourceType, agentRow.hostingMode);
  const objectiveChecklist = normalizeObjectiveChecklist(null, input.objective);
  const runtimeProfile = resolveRuntimeProfile(
    agentRow.sourceType === "platform"
      ? ((input.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null | undefined) ?? "baseline")
      : "baseline",
  );
  const derivedTargetArtifactCount = getDerivedRuntimeTargetArtifactCount({
    objectiveChecklist,
    runtimeProfile,
  });
  const initialOutputEnvelope = buildExecutionOutputEnvelope({
    kind: "status_report",
    title: "Execution queued",
    summary:
      agentRow.sourceType === "platform" && !isManagedLightExecutionHostingMode(agentRow.hostingMode)
        ? "Platform executor will claim this execution in a later worker tick."
        : isManagedLightExecutionHostingMode(agentRow.hostingMode)
          ? "Platform light dispatcher will invoke the hosted runtime in a later worker tick."
          : "Open Agent dispatcher will forward this execution and wait for callback updates.",
    generatedAt: createdAt,
    payload: {
      sourceType: agentRow.sourceType,
      hostingMode: agentRow.hostingMode,
      runtimeProfile: runtimeProfile.key,
      targetArtifactCount: derivedTargetArtifactCount,
      objectiveChecklist,
      capabilityId: managedLightCapability?.id ?? null,
      inputResourcePayload: input.inputResourcePayload ?? null,
      normalizedResourcePayload: null,
      outputResourcePayload: null,
      taskId: input.taskId ?? null,
      marketplaceInvocation: toStoredMarketplaceInvocationSnapshot(input.marketplaceInvocation),
      phase: runtimeState.executorPhase,
      progressPercent: runtimeState.progressPercent,
    },
  });
  const [created] = await tx
    .insert(agentExecutions)
    .values({
      id: crypto.randomUUID(),
      ownerUserId,
      agentId: input.agentId,
      capabilityId: managedLightCapability?.id ?? null,
      taskId: input.taskId ?? null,
      title: input.title,
      objective: input.objective,
      objectiveChecklist,
      inputResourcePayload: input.inputResourcePayload ?? null,
      normalizedResourcePayload: null,
      outputResourcePayload: null,
      marketplaceInvocation: toStoredMarketplaceInvocationSnapshot(input.marketplaceInvocation),
      runtimeProfileKey: runtimeProfile.key,
      callbackRemediationPolicyKey: requestedCallbackRemediationPolicyKey,
      targetArtifactCount: derivedTargetArtifactCount,
      status: "queued",
      statusNote: null,
      resultSummary: null,
      ...toStoredExecutionOutputEnvelope(initialOutputEnvelope),
      executorPhase: runtimeState.executorPhase,
      progressPercent: runtimeState.progressPercent,
      autoRecoveryCount: 0,
      maxAutoRecoveryCount: runtimeProfile.maxAutoRecoveryCount,
      recoveryExhaustedAt: null,
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      submittedAt: null,
      completedAt: null,
      lastExternalCallbackAt: null,
      lastHeartbeatAt: null,
    })
    .returning();

  await recordExecutionStepInTx(tx, {
    executionId: created.id,
    kind: "phase",
    phase: runtimeState.executorPhase,
    title: "Execution queued",
    detail:
      agentRow.sourceType === "platform" && !isManagedLightExecutionHostingMode(agentRow.hostingMode)
        ? "Platform executor will claim this execution in a later worker tick."
        : isManagedLightExecutionHostingMode(agentRow.hostingMode)
          ? "Platform light dispatcher will invoke the hosted runtime in a later worker tick."
          : "Open Agent dispatcher will forward this execution and wait for callback updates.",
    status: "info",
    progressPercent: runtimeState.progressPercent,
  });

  if (agentRow.sourceType === "platform" && !isManagedLightExecutionHostingMode(agentRow.hostingMode)) {
    await ensureRuntimeManagedSubtasksInTx(tx, created);
  }

  await enqueueOutboxEvent(
    "agentExecution.created",
    {
      executionId: created.id,
      ownerUserId: created.ownerUserId,
      agentId: created.agentId,
      taskId: created.taskId,
    },
    tx,
  );

  return toAgentExecutionView(
    created,
    ownerUserId,
    resolveExecutionCallbackRemediationPolicyMetadata({
      execution: created,
      agentSourceType: agentRow.sourceType as AgentSourceType,
      agentPolicyKey: agentRow.externalCallbackRemediationPolicy,
    }),
    [],
    [],
    [],
    [],
    [],
    [],
  );
}

function truncateDispatchText(value: string | null | undefined, maximum = 4000) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maximum ? trimmed : `${trimmed.slice(0, Math.max(0, maximum - 1))}…`;
}

async function getDispatchableExecutionRow(executionId: string, connection: NodePgDatabase<typeof schema> = db) {
  const [row] = await connection
    .select({
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutions)
    .innerJoin(agents, eq(agentExecutions.agentId, agents.id))
    .where(eq(agentExecutions.id, executionId));
  return row ?? null;
}

async function markExecutionDispatchRunning(args: {
  tx: NodePgDatabase<typeof schema>;
  execution: typeof agentExecutions.$inferSelect;
  note: string;
}) {
  const timestamp = now();
  const output = buildExecutionOutputEnvelope({
    kind: "status_report",
    title: "Execution dispatch in progress",
    summary: args.note,
    generatedAt: timestamp,
    payload: {
      phase: null,
      dispatchState: "running",
      marketplaceInvocation: toStoredMarketplaceInvocationSnapshot(args.execution.marketplaceInvocation),
    },
  });

  const [updated] = await args.tx
    .update(agentExecutions)
    .set({
      status: "running",
      statusNote: args.note,
      resultSummary: null,
      ...toStoredExecutionOutputEnvelope(output),
      executorPhase: null,
      progressPercent: null,
      updatedAt: timestamp,
      startedAt: args.execution.startedAt ?? timestamp,
    })
    .where(and(eq(agentExecutions.id, args.execution.id), eq(agentExecutions.status, "queued")))
    .returning();

  if (!updated) {
    return {
      execution: args.execution,
      claimed: false,
    };
  }

  await recordExecutionStepInTx(args.tx, {
    executionId: args.execution.id,
    kind: "status",
    phase: null,
    title: "Execution dispatched",
    detail: args.note,
    status: "info",
    progressPercent: null,
  });

  await enqueueOutboxEvent(
    getAgentExecutionEventName("running"),
    {
      executionId: args.execution.id,
      ownerUserId: args.execution.ownerUserId,
      agentId: args.execution.agentId,
      status: "running",
    },
    args.tx,
  );

  return {
    execution: updated,
    claimed: true,
  };
}

async function dispatchManagedApiExecution(
  execution: typeof agentExecutions.$inferSelect,
  agent: typeof agents.$inferSelect,
): Promise<RuntimeDispatchResult> {
  const marketplaceInvocation = toMarketplaceInvocationSnapshotView(execution.marketplaceInvocation);
  const dispatchNote = marketplaceInvocation
    ? `Managed API dispatcher is invoking ${marketplaceInvocation.publicTitle} for ${marketplaceInvocation.quotedAmount} ${marketplaceInvocation.priceCurrency}.`
    : "Managed API dispatcher is invoking the hosted agent runtime.";

  const claimResult = await db.transaction(async (tx) =>
    markExecutionDispatchRunning({
      tx,
      execution,
      note: dispatchNote,
    }),
  );

  if (!claimResult.claimed) {
    return {
      state: "running",
      message: "Managed API execution was already claimed by another dispatcher.",
      executionId: execution.id,
    };
  }

  let resolvedServiceAccess: BenefitServiceApiAccessView | null = null;
  let endpoint: string;
  let capability: typeof agentCapabilities.$inferSelect | null = null;
  try {
    capability = await resolveManagedLightCapabilityRow({
      agentId: agent.id,
      capabilityId: execution.capabilityId ?? null,
    });
    if (agent.managedServiceId?.trim()) {
      resolvedServiceAccess = await resolveManagedLightServiceAccess({
        ownerUserId: execution.ownerUserId,
        serviceId: agent.managedServiceId.trim(),
      });
    }
    endpoint = resolveManagedApiEndpoint(resolvedServiceAccess?.apiUrl || agent.managedApiBaseUrl);
  } catch (error) {
    const failureMessage = truncateDispatchText(
      error instanceof Error ? error.message : "Managed light service access is unavailable.",
      4000,
    );
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: failureMessage ?? undefined,
      resultSummary: failureMessage ?? undefined,
    });
    return {
      state: "failed",
      message: failureMessage ?? "Managed light service access is unavailable.",
      executionId: execution.id,
    };
  }
  const userPromptTemplate = agent.managedPromptTemplate?.trim();
  if (!userPromptTemplate) {
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: "Managed API prompt template is missing.",
      resultSummary: "Managed API prompt template is missing.",
    });
    return {
      state: "failed",
      message: "Managed API prompt template is missing.",
      executionId: execution.id,
    };
  }
  if (!capability) {
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: "Managed light capability is missing.",
      resultSummary: "Managed light capability is missing.",
    });
    return {
      state: "failed",
      message: "Managed light capability is missing.",
      executionId: execution.id,
    };
  }

  const rawInputResourcePayload: Record<string, unknown> = {
    ...(toRecordPayload(execution.inputResourcePayload) ?? {}),
    requestObjective: execution.objective,
  };
  const templateArgs = {
    executionTitle: execution.title,
    objective: execution.objective,
    publicTitle: marketplaceInvocation?.publicTitle ?? null,
    capabilityCode: marketplaceInvocation?.capabilityCode ?? null,
    capabilityTitle: marketplaceInvocation?.capabilityTitle ?? null,
    quotedAmount: marketplaceInvocation?.quotedAmount ?? null,
    priceCurrency: marketplaceInvocation?.priceCurrency ?? null,
    billingMode: marketplaceInvocation?.billingMode ?? null,
    billingUnit: marketplaceInvocation?.billingUnit ?? null,
    meterQuantity: marketplaceInvocation?.meterQuantity ?? null,
    managedTaskCategory: agent.managedTaskCategory ?? null,
    managedCapabilitySummary: agent.managedCapabilitySummary ?? null,
    routingSummary: capability.routingSummary ?? null,
    routingTags: (capability.routingTags as string[] | null) ?? [],
    inputSchema: (capability.inputSchema as Record<string, unknown> | null) ?? null,
    outputSchema: (capability.outputSchema as Record<string, unknown> | null) ?? null,
    inputResourcePayload: rawInputResourcePayload,
    normalizedResourcePayload: null as Record<string, unknown> | null,
  };
  const model = agent.managedModel?.trim() || "gpt-4.1-mini";

  try {
    let normalizedResourcePayload = templateArgs.inputResourcePayload;
    let normalizationUsageTotals: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

    if (capability.resourceNormalizationPrompt?.trim()) {
      const normalizationResult = await invokeManagedLightModel({
        endpoint,
        apiKey: resolvedServiceAccess?.apiKey || agent.managedApiKey,
        model,
        systemPrompt: capability.resourceNormalizationPrompt.trim(),
        userPrompt: [
          "请将原始输入资源整理成适合当前单任务 Agent 使用的 JSON 对象，只返回 JSON，不要输出解释。",
          `任务标题: ${capability.title}`,
          agent.managedTaskCategory?.trim() ? `任务类别: ${agent.managedTaskCategory.trim()}` : null,
          agent.managedCapabilitySummary?.trim() ? `能力短语: ${agent.managedCapabilitySummary.trim()}` : null,
          capability.routingSummary?.trim() ? `路由描述: ${capability.routingSummary.trim()}` : null,
          Array.isArray(capability.routingTags) && capability.routingTags.length > 0
            ? `路由标签: ${(capability.routingTags as string[]).join(", ")}`
            : null,
          `执行目标: ${execution.objective}`,
          `输入资源契约(JSON Schema):\n${safeJsonStringify(capability.inputSchema)}`,
          `输出资源契约(JSON Schema):\n${safeJsonStringify(capability.outputSchema)}`,
          `原始输入资源(JSON):\n${safeJsonStringify(templateArgs.inputResourcePayload)}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
      normalizationUsageTotals = normalizationResult.usageTotals;
      const normalizationSummary =
        truncateDispatchText(normalizationResult.text, 4000) ??
        truncateDispatchText(typeof normalizationResult.payload?.rawText === "string" ? normalizationResult.payload.rawText : null, 4000);
      if (!normalizationResult.response.ok) {
        const failureMessage = truncateDispatchText(
          `羽量 Agent 资源整理失败，状态 ${normalizationResult.response.status}.${normalizationSummary ? ` ${normalizationSummary}` : ""}`,
          4000,
        );
        await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
          status: "failed",
          statusNote: failureMessage ?? undefined,
          resultSummary: normalizationSummary ?? failureMessage ?? undefined,
        });
        return {
          state: "failed",
          message: failureMessage ?? "羽量 Agent 资源整理失败。",
          executionId: execution.id,
        };
      }
      normalizedResourcePayload =
        extractJsonObjectFromText(normalizationResult.text) ??
        toRecordPayload(normalizationResult.payload) ??
        {
          normalizedText: normalizationResult.text ?? normalizationSummary ?? "",
        };
    }

    const templateArgsWithNormalized = {
      ...templateArgs,
      normalizedResourcePayload,
    };
    const systemPrompt = agent.managedSystemPrompt?.trim()
      ? renderManagedPromptTemplate(agent.managedSystemPrompt.trim(), templateArgsWithNormalized)
      : null;
    const userPrompt = renderManagedPromptTemplate(userPromptTemplate, templateArgsWithNormalized);

    const completionResult = await invokeManagedLightModel({
      endpoint,
      apiKey: resolvedServiceAccess?.apiKey || agent.managedApiKey,
      model,
      systemPrompt,
      userPrompt,
    });

    const response = completionResult.response;
    const payload = completionResult.payload;
    const managedText = completionResult.text;
    const usageTotals = mergeManagedApiUsageTotals(normalizationUsageTotals, completionResult.usageTotals);
    const responseSummary =
      truncateDispatchText(managedText, 4000) ??
      truncateDispatchText(typeof payload?.rawText === "string" ? payload.rawText : null, 4000);

    if (!response.ok) {
      const failureMessage = truncateDispatchText(
        `Managed API invocation failed with status ${response.status}.${responseSummary ? ` ${responseSummary}` : ""}`,
        4000,
      );
      await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
        status: "failed",
        statusNote: failureMessage ?? `Managed API invocation failed with status ${response.status}.`,
        resultSummary: responseSummary ?? failureMessage ?? undefined,
      });
      return {
        state: "failed",
        message: failureMessage ?? `Managed API invocation failed with status ${response.status}.`,
        executionId: execution.id,
      };
    }

    if (marketplaceInvocation?.billingMode === "token_metered" && usageTotals) {
      const meterQuantity = resolveTokenMeterQuantity(usageTotals.totalTokens, marketplaceInvocation.billingUnit);
      const quotedAmount = Math.max(1, meterQuantity * marketplaceInvocation.unitPriceAmount);
      marketplaceInvocation.meterQuantity = meterQuantity;
      marketplaceInvocation.quotedAmount = quotedAmount;
    }

    const outputResourcePayload =
      extractJsonObjectFromText(managedText) ??
      {
        text: managedText ?? null,
        usage: usageTotals,
        rawResponse: payload ?? null,
      };
    await db
      .update(agentExecutions)
      .set({
        normalizedResourcePayload,
        outputResourcePayload,
        marketplaceInvocation: marketplaceInvocation ? toStoredMarketplaceInvocationSnapshot(marketplaceInvocation) : execution.marketplaceInvocation,
        updatedAt: now(),
      })
      .where(eq(agentExecutions.id, execution.id));

    const artifactSummary = managedText ?? JSON.stringify(payload ?? {}, null, 2);
    await addOwnedAgentExecutionArtifact(execution.ownerUserId, execution.id, {
      kind: "note",
      title: marketplaceInvocation?.publicTitle
        ? `${marketplaceInvocation.publicTitle} 输出`
        : `${agent.name} 托管输出`,
      summary:
        usageTotals && marketplaceInvocation?.billingMode === "token_metered"
          ? `${artifactSummary}\n\nusage: prompt=${usageTotals.promptTokens}, completion=${usageTotals.completionTokens}, total=${usageTotals.totalTokens}, billed_units=${marketplaceInvocation.meterQuantity}, quoted_amount=${marketplaceInvocation.quotedAmount}`
          : artifactSummary,
    });
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "completed",
      statusNote: "Managed API invocation completed successfully.",
      resultSummary: responseSummary ?? "Managed API invocation completed successfully.",
    });
    return {
      state: "completed",
      message: "Managed API invocation completed successfully.",
      executionId: execution.id,
    };
  } catch (error) {
    const failureMessage =
      error instanceof Error && error.name === "AbortError"
        ? "Managed API invocation timed out."
        : truncateDispatchText(error instanceof Error ? error.message : "Managed API invocation failed.") ??
          "Managed API invocation failed.";
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: failureMessage,
      resultSummary: failureMessage ?? undefined,
    });
    return {
      state: "failed",
      message: failureMessage,
      executionId: execution.id,
    };
  }
}

function buildExternalRuntimeDispatchPayload(args: {
  execution: typeof agentExecutions.$inferSelect;
  agent: typeof agents.$inferSelect;
  capability?: typeof agentCapabilities.$inferSelect | null;
}) {
  if (!env.corePublicBaseUrl) {
    throw new ConflictError("CORE_PUBLIC_BASE_URL is required to dispatch external runtime executions");
  }
  const callbackBase = `${env.corePublicBaseUrl.replace(/\/+$/, "")}/external/agent-executions/${encodeURIComponent(args.execution.id)}`;
  return {
    dispatchVersion: 1,
    execution: {
      id: args.execution.id,
      ownerUserId: args.execution.ownerUserId,
      agentId: args.execution.agentId,
      capabilityId: args.execution.capabilityId,
      taskId: args.execution.taskId,
      title: args.execution.title,
      objective: args.execution.objective,
      inputResourcePayload: toRecordPayload(args.execution.inputResourcePayload),
      normalizedResourcePayload: toRecordPayload(args.execution.normalizedResourcePayload),
      marketplaceInvocation: toMarketplaceInvocationSnapshotView(args.execution.marketplaceInvocation),
    },
    capability: args.capability
      ? {
          id: args.capability.id,
          code: args.capability.code,
          title: args.capability.title,
          description: args.capability.description ?? null,
          routingSummary: args.capability.routingSummary ?? null,
          routingTags: (args.capability.routingTags as string[] | null) ?? [],
          inputSchema: (args.capability.inputSchema as Record<string, unknown> | null) ?? null,
          outputSchema: (args.capability.outputSchema as Record<string, unknown> | null) ?? null,
        }
      : null,
    agent: {
      id: args.agent.id,
      ownerUserId: args.agent.ownerUserId,
      name: args.agent.name,
      sourceType: args.agent.sourceType,
      hostingMode: args.agent.hostingMode,
      runtimeEndpoint: args.agent.runtimeEndpoint,
    },
    callback: {
      statusUrl: `${callbackBase}/status`,
      heartbeatUrl: `${callbackBase}/heartbeat`,
      artifactUrl: `${callbackBase}/artifacts`,
      eventUrl: callbackBase,
      secret: args.agent.externalCallbackSecret,
      version: args.agent.externalCallbackProtocolVersion,
      signatureAlgorithm: "hmac-sha256",
      headers: {
        secret: "x-external-agent-secret",
        callbackId: "x-external-callback-id",
        callbackTimestamp: "x-external-callback-timestamp",
        callbackVersion: "x-external-callback-version",
        callbackSignature: "x-external-callback-signature",
      },
    },
  };
}

async function dispatchExternalRuntimeExecution(
  execution: typeof agentExecutions.$inferSelect,
  agent: typeof agents.$inferSelect,
): Promise<RuntimeDispatchResult> {
  const runtimeEndpoint = agent.runtimeEndpoint?.trim();
  if (!runtimeEndpoint) {
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: "External runtime endpoint is missing.",
      resultSummary: "External runtime endpoint is missing.",
    });
    return {
      state: "failed",
      message: "External runtime endpoint is missing.",
      executionId: execution.id,
    };
  }

  const claimResult = await db.transaction(async (tx) =>
    markExecutionDispatchRunning({
      tx,
      execution,
      note: "External runtime dispatcher forwarded the execution and is waiting for callback updates.",
    }),
  );

  if (!claimResult.claimed) {
    return {
      state: "running",
      message: "External runtime execution was already claimed by another dispatcher.",
      executionId: execution.id,
    };
  }

  const capability =
    execution.capabilityId != null
      ? (
          await db
            .select()
            .from(agentCapabilities)
            .where(eq(agentCapabilities.id, execution.capabilityId))
            .limit(1)
        )[0] ?? null
      : null;

  try {
    const response = await fetchWithTimeout(
      runtimeEndpoint,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildRuntimeAuthHeaders(agent.authMode as "none" | "apiKey" | "bearer", agent.runtimeAuthToken),
        },
        body: JSON.stringify(
          buildExternalRuntimeDispatchPayload({
            execution,
            agent,
            capability,
          }),
        ),
      },
      externalRuntimeDispatchTimeoutMs,
    );

    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      const failureMessage = truncateDispatchText(
        `External runtime dispatch failed with status ${response.status}.${typeof payload?.rawText === "string" ? ` ${payload.rawText}` : ""}`,
        4000,
      );
      await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
        status: "failed",
        statusNote: failureMessage ?? `External runtime dispatch failed with status ${response.status}.`,
        resultSummary: failureMessage ?? undefined,
      });
      return {
        state: "failed",
        message: failureMessage ?? `External runtime dispatch failed with status ${response.status}.`,
        executionId: execution.id,
      };
    }

    const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
    for (const artifact of artifacts) {
      if (!artifact || typeof artifact !== "object") continue;
      const title = typeof (artifact as { title?: unknown }).title === "string" ? (artifact as { title: string }).title : "";
      if (!title.trim()) continue;
      const kind = (artifact as { kind?: unknown }).kind === "link" ? "link" : "note";
      const urlValue = typeof (artifact as { url?: unknown }).url === "string" ? (artifact as { url: string }).url : null;
      const summaryValue =
        typeof (artifact as { summary?: unknown }).summary === "string"
          ? (artifact as { summary: string }).summary
          : null;
      await addOwnedAgentExecutionArtifact(execution.ownerUserId, execution.id, {
        kind,
        title,
        url: kind === "link" ? urlValue : null,
        summary: summaryValue,
      });
    }

    const runtimeStatus =
      typeof payload?.status === "string" &&
      ["running", "submitted", "completed", "failed", "cancelled"].includes(payload.status)
        ? (payload.status as AgentExecutionStatus)
        : "running";
    const resultSummary =
      typeof payload?.resultSummary === "string"
        ? truncateDispatchText(payload.resultSummary, 4000)
        : typeof payload?.summary === "string"
          ? truncateDispatchText(payload.summary, 4000)
          : null;
    const statusNote =
      typeof payload?.statusNote === "string"
        ? truncateDispatchText(payload.statusNote, 2000)
        : "External runtime accepted dispatch and should continue via callback updates.";

    if (runtimeStatus === "running") {
      return {
        state: "running",
        message: statusNote,
        executionId: execution.id,
      };
    }

    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: runtimeStatus,
      statusNote: statusNote ?? undefined,
      resultSummary: resultSummary ?? undefined,
    });
    return {
      state: runtimeStatus === "submitted" ? "running" : runtimeStatus,
      message: statusNote,
      executionId: execution.id,
    };
  } catch (error) {
    const failureMessage =
      error instanceof Error && error.name === "AbortError"
        ? "External runtime dispatch timed out."
        : truncateDispatchText(error instanceof Error ? error.message : "External runtime dispatch failed.") ??
          "External runtime dispatch failed.";
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: failureMessage,
      resultSummary: failureMessage ?? undefined,
    });
    return {
      state: "failed",
      message: failureMessage,
      executionId: execution.id,
    };
  }
}

async function dispatchPendingExecutionById(executionId: string): Promise<RuntimeDispatchResult> {
  const row = await getDispatchableExecutionRow(executionId);
  if (!row) {
    throw new NotFoundError("Agent execution not found");
  }
  if (terminalExecutionStatuses.has(row.execution.status as AgentExecutionStatus)) {
    return {
      state: row.execution.status as RuntimeDispatchResult["state"],
      message: row.execution.statusNote,
      executionId,
    };
  }
  if (row.execution.status !== "queued") {
    return {
      state: row.execution.status === "submitted" ? "running" : (row.execution.status as RuntimeDispatchResult["state"]),
      message: row.execution.statusNote,
      executionId,
    };
  }
  if (!row.agent.enabled) {
    await updateOwnedAgentExecutionStatus(row.execution.ownerUserId, executionId, {
      status: "failed",
      statusNote: "Linked agent is disabled and cannot accept dispatch.",
      resultSummary: "Linked agent is disabled and cannot accept dispatch.",
    });
    return {
      state: "failed",
      message: "Linked agent is disabled and cannot accept dispatch.",
      executionId,
    };
  }

  if (isManagedLightExecutionHostingMode(row.agent.hostingMode as AgentHostingMode | null)) {
    return dispatchManagedApiExecution(row.execution, row.agent);
  }
  if ((row.agent.sourceType as AgentSourceType) === "external") {
    return dispatchExternalRuntimeExecution(row.execution, row.agent);
  }

  return {
    state: "queued",
    message: "Execution is handled by the platform runtime executor.",
    executionId,
  };
}

export async function runPendingDispatchableAgentExecutions(args?: {
  limit?: number;
  executionId?: string;
}) {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 50));
  const executionIds = args?.executionId
    ? [args.executionId]
    : (
        await db.execute(sql`
          select ae.id as execution_id
          from agent_executions ae
          inner join agents a on a.id = ae.agent_id
          where ae.status = 'queued'
            and a.enabled = true
            and (
              a.source_type = 'external'
              or coalesce(a.hosting_mode, 'registry_only') in ('managed_api', 'managed_light')
            )
          order by ae.created_at asc
          limit ${limit}
        `)
      ).rows.map((row) => String((row as { execution_id: string }).execution_id));

  const results: RuntimeDispatchResult[] = [];
  for (const executionId of executionIds) {
    results.push(await dispatchPendingExecutionById(executionId));
  }

  return {
    attemptedCount: executionIds.length,
    processedCount: results.filter((result) => result.state !== "queued").length,
    failedCount: results.filter((result) => result.state === "failed").length,
    results,
  };
}

export async function invokeAgentMarketplaceListing(
  consumerUserId: string,
  listingId: string,
  input: InvokeAgentMarketplaceListingInput,
): Promise<InvokeAgentMarketplaceListingResult> {
  const listingDetail = await getMarketplaceListingDetailById(listingId);
  if (!listingDetail) {
    throw new NotFoundError("Marketplace listing not found");
  }
  if (listingDetail.listing.status !== "published") {
    throw new ConflictError("Only published marketplace listings can be invoked");
  }
  if (!listingDetail.listing.externalInvocationEnabled) {
    throw new ConflictError("This marketplace listing does not allow direct invocation");
  }
  if (!listingDetail.agent.enabled || !listingDetail.capability.enabled) {
    throw new ConflictError("Linked agent or capability is unavailable");
  }

  const meterQuantity = normalizeMarketplaceMeterQuantity(input.meterQuantity ?? 1);
  const quotedAmount =
    listingDetail.listing.billingMode === "flat_task"
      ? listingDetail.listing.priceAmount
      : listingDetail.listing.priceAmount * meterQuantity;
  const invocationSnapshot: AgentMarketplaceInvocationSnapshotView = {
    listingId: listingDetail.listing.id,
    supplierUserId: listingDetail.agent.ownerUserId,
    capabilityId: listingDetail.capability.id,
    capabilityCode: listingDetail.capability.code,
    capabilityTitle: listingDetail.capability.title,
    publicTitle: listingDetail.listing.publicTitle,
    billingMode: listingDetail.listing.billingMode as AgentMarketplaceBillingMode,
    billingUnit: listingDetail.listing.billingUnit ?? null,
    meterKey: listingDetail.listing.meterKey ?? null,
    meterQuantity,
    priceCurrency: listingDetail.listing.priceCurrency as ProductCurrency,
    unitPriceAmount: listingDetail.listing.priceAmount,
    quotedAmount,
    invokedAt: now().toISOString(),
  };

  const createdExecution = await db.transaction((tx) =>
    createOwnedAgentExecutionInTx(tx, consumerUserId, {
      agentId: listingDetail.agent.id,
      capabilityId: listingDetail.capability.id,
      title: input.title.trim(),
      objective: input.objective.trim(),
      inputResourcePayload: input.inputResourcePayload ?? null,
      runtimeProfileKey: input.runtimeProfileKey ?? null,
      marketplaceInvocation: invocationSnapshot,
    }),
  );

  const dispatchResult = await dispatchPendingExecutionById(createdExecution.id);
  return {
    execution: await getAgentExecutionViewById(createdExecution.id),
    dispatchState: dispatchResult.state,
    dispatchMessage: dispatchResult.message,
  };
}

function validateArtifactInput(input: AddAgentExecutionArtifactInput) {
  if (input.kind === "link" && !input.url?.trim()) {
    throw new ConflictError("Link artifact requires a URL");
  }
}

async function addOwnedAgentExecutionArtifactInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
  input: AddAgentExecutionArtifactInput,
) {
  const createdAt = now();
  const [updatedExecution] = await tx
    .update(agentExecutions)
    .set({
      updatedAt: createdAt,
    })
    .where(eq(agentExecutions.id, execution.id))
    .returning();
  const [artifact] = await tx
    .insert(agentExecutionArtifacts)
    .values({
      id: crypto.randomUUID(),
      executionId: execution.id,
      kind: input.kind,
      title: input.title,
      url: input.url?.trim() || null,
      summary: input.summary?.trim() || null,
      createdAt,
    })
    .returning();

  await recordExecutionStepInTx(tx, {
    executionId: execution.id,
    kind: "artifact",
    phase: updatedExecution?.executorPhase as PlatformExecutionPhase | null,
    title: `Artifact added: ${artifact.title}`,
    detail: artifact.summary ?? artifact.url ?? null,
    status: "completed",
    progressPercent: updatedExecution?.progressPercent ?? execution.progressPercent,
  });

  await enqueueOutboxEvent(
    "agentExecution.artifactAdded",
    {
      executionId: execution.id,
      ownerUserId: execution.ownerUserId,
      agentId: execution.agentId,
      taskId: execution.taskId,
      artifactId: artifact.id,
      artifactTitle: artifact.title,
    },
    tx,
  );

  const artifactRows = await tx
    .select()
    .from(agentExecutionArtifacts)
    .where(eq(agentExecutionArtifacts.executionId, execution.id))
    .orderBy(asc(agentExecutionArtifacts.createdAt));

  const outputEnvelope = buildArtifactBundleOutputEnvelope({
    executionId: execution.id,
    artifacts: artifactRows,
    generatedAt: createdAt,
  });

  const [executionRow] = await tx
    .update(agentExecutions)
    .set({
      ...toStoredExecutionOutputEnvelope(outputEnvelope),
      updatedAt: createdAt,
    })
    .where(eq(agentExecutions.id, execution.id))
    .returning();

  return executionRow ?? updatedExecution ?? execution;
}

async function updateOwnedAgentExecutionStatusInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
  input: UpdateAgentExecutionStatusInput,
) {
  const currentStatus = execution.status as AgentExecutionStatus;
  if (currentStatus === input.status) {
    return execution;
  }
  if (!transitionMap[currentStatus].includes(input.status)) {
    throw new ConflictError(`Cannot move agent execution from ${currentStatus} to ${input.status}`);
  }

  const updatedAt = now();
  const outputEnvelope =
    input.resultSummary || input.statusNote || ["submitted", "completed", "failed", "cancelled"].includes(input.status)
      ? buildStatusReportOutputEnvelope({
          executionId: execution.id,
          status: input.status,
          statusNote: input.statusNote ?? execution.statusNote,
          resultSummary: input.resultSummary ?? execution.resultSummary,
          generatedAt: updatedAt,
        })
      : null;
  const hasPlatformRuntime = execution.executorPhase !== null || execution.progressPercent !== null;
  const [updated] = await tx
    .update(agentExecutions)
    .set({
      status: input.status,
      statusNote: input.statusNote ?? execution.statusNote,
      resultSummary: input.resultSummary ?? execution.resultSummary,
      executorPhase: hasPlatformRuntime
        ? input.status === "running"
          ? ((execution.executorPhase ?? "prepare") as PlatformExecutionPhase)
          : input.status === "submitted"
            ? ("finalize" as PlatformExecutionPhase)
            : input.status === "completed"
              ? ("done" as PlatformExecutionPhase)
              : input.status === "failed" || input.status === "cancelled"
                ? ((execution.executorPhase ?? "done") as PlatformExecutionPhase)
                : execution.executorPhase
        : execution.executorPhase,
      progressPercent: hasPlatformRuntime
        ? input.status === "running"
          ? Math.max(execution.progressPercent ?? 0, 10)
          : input.status === "submitted"
            ? Math.max(execution.progressPercent ?? 0, 90)
            : input.status === "completed"
              ? 100
              : input.status === "failed" || input.status === "cancelled"
                ? execution.progressPercent ?? 0
                : execution.progressPercent
        : execution.progressPercent,
      updatedAt,
      startedAt: input.status === "running" ? execution.startedAt ?? updatedAt : execution.startedAt,
      submittedAt: input.status === "submitted" ? execution.submittedAt ?? updatedAt : execution.submittedAt,
      completedAt:
        input.status === "completed" || input.status === "failed" || input.status === "cancelled"
          ? execution.completedAt ?? updatedAt
          : execution.completedAt,
      ...toStoredExecutionOutputEnvelope(outputEnvelope),
    })
    .where(eq(agentExecutions.id, execution.id))
    .returning();

  if (updated.taskId) {
    const [linkedTask] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, updated.taskId));
    if (linkedTask && linkedTask.assignedUserId === updated.ownerUserId) {
      if (input.status === "running" && linkedTask.status === "assigned") {
        await tx.update(schema.tasks).set({ status: "in_progress" }).where(eq(schema.tasks.id, linkedTask.id));
        await enqueueOutboxEvent("task.started", { taskId: linkedTask.id, actorUserId: updated.ownerUserId }, tx);
      }

      if (
        (input.status === "submitted" || input.status === "completed") &&
        ["assigned", "in_progress"].includes(linkedTask.status)
      ) {
        await tx.update(schema.tasks).set({ status: "submitted" }).where(eq(schema.tasks.id, linkedTask.id));
        await enqueueOutboxEvent("task.submitted", { taskId: linkedTask.id, actorUserId: updated.ownerUserId }, tx);
      }
    }
  }

  if (hasPlatformRuntime) {
    if (input.status === "running") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "claim");
      await touchRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        phase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote,
      });
    } else if (input.status === "submitted") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "advance");
      await touchRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        phase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote,
      });
    } else if (input.status === "completed") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "complete");
      await finalizeRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        state: "completed",
        endedPhase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote ?? "Execution completed successfully.",
      });
    } else if (input.status === "failed") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "failed");
      await finalizeRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        state: "failed",
        endedPhase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote ?? "Execution failed.",
      });
    } else if (input.status === "cancelled") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "cancelled");
      await finalizeRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        state: "failed",
        endedPhase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote ?? "Execution cancelled.",
      });
    }
  }

  await recordExecutionStepInTx(tx, {
    executionId: updated.id,
    kind: "status",
    phase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
    title: `Execution moved to ${updated.status}`,
    detail: input.statusNote ?? null,
    status:
      input.status === "failed" || input.status === "cancelled"
        ? "failed"
        : ("completed" as AgentExecutionStepStatus),
    progressPercent: updated.progressPercent,
  });

  await enqueueOutboxEvent(
    getAgentExecutionEventName(input.status),
    {
      executionId: updated.id,
      ownerUserId: updated.ownerUserId,
      agentId: updated.agentId,
      status: updated.status,
    },
    tx,
  );

  if (input.status === "completed") {
    await ensureExecutionSettlementPlanInTx(tx, updated);
  }

  return updated;
}

export async function addOwnedAgentExecutionArtifact(
  ownerUserId: string,
  executionId: string,
  input: AddAgentExecutionArtifactInput,
): Promise<AgentExecutionView> {
  validateArtifactInput(input);

  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }

  await db.transaction(async (tx) => {
    await addOwnedAgentExecutionArtifactInTx(tx, execution, input);
  });

  return getAgentExecutionViewById(execution.id);
}

export async function updateOwnedAgentExecutionStatus(
  ownerUserId: string,
  executionId: string,
  input: UpdateAgentExecutionStatusInput,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }

  if ((execution.status as AgentExecutionStatus) === input.status) {
    const ownerMap = new Map([[execution.id, execution.ownerUserId]]);
    const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, settlementMap, remediationPolicyMap] =
      await Promise.all([
        buildArtifactMap([execution.id]),
        buildStepMap([execution.id]),
        buildSubtaskMap([execution.id], ownerMap, ownerUserId),
        buildRuntimeSessionMap([execution]),
        buildCallbackMap([execution.id]),
        buildRunMap([execution.id]),
        buildSettlementMap([execution.id]),
        buildExecutionRemediationPolicyMap([execution]),
      ]);
    return toAgentExecutionView(
      execution,
      ownerUserId,
      remediationPolicyMap.get(execution.id) ??
        resolveExecutionCallbackRemediationPolicyMetadata({
          execution,
          agentSourceType: "platform",
          agentPolicyKey: null,
        }),
      artifactMap.get(execution.id) ?? [],
      stepMap.get(execution.id) ?? [],
      subtaskMap.get(execution.id) ?? [],
      runtimeSessionMap.get(execution.id) ?? [],
      callbackMap.get(execution.id) ?? [],
      runMap.get(execution.id) ?? [],
      settlementMap.get(execution.id) ?? null,
    );
  }
  await db.transaction(async (tx) => {
    await updateOwnedAgentExecutionStatusInTx(tx, execution, input);
  });

  if (input.status === "completed") {
    return settleExecutionById(execution.id);
  }

  return getAgentExecutionViewById(execution.id);
}

export async function updateOwnedAgentExecutionCallbackRemediationPolicy(
  ownerUserId: string,
  executionId: string,
  input: UpdateAgentExecutionCallbackRemediationPolicyInput,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (terminalExecutionStatuses.has(execution.status as AgentExecutionStatus)) {
    throw new ConflictError("Terminal executions cannot update callback remediation policy");
  }

  const agent = await getOwnedAgent(ownerUserId, execution.agentId);
  if (!agent) {
    throw new NotFoundError("Linked agent not found");
  }
  if (agent.sourceType !== "external") {
    throw new ConflictError("Only external executions support callback remediation policy override");
  }

  const nextPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(input.policyKey);
  const currentPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(execution.callbackRemediationPolicyKey);
  if (currentPolicyKey === nextPolicyKey) {
    return getAgentExecutionViewById(execution.id);
  }

  await db.transaction(async (tx) => {
    const timestamp = now();
    await tx
      .update(agentExecutions)
      .set({
        callbackRemediationPolicyKey: nextPolicyKey,
        updatedAt: timestamp,
      })
      .where(eq(agentExecutions.id, execution.id));

    await recordExecutionStepInTx(tx, {
      executionId: execution.id,
      kind: "status",
      phase: (execution.executorPhase as PlatformExecutionPhase | null) ?? null,
      title: nextPolicyKey
        ? `Execution callback policy overridden to ${nextPolicyKey}`
        : "Execution callback policy reset to agent default",
      detail: nextPolicyKey
        ? `Execution now overrides the agent callback remediation policy with '${nextPolicyKey}'.`
        : "Execution now inherits the linked agent callback remediation policy again.",
      status: "completed",
      progressPercent: execution.progressPercent,
    });
  });

  return getAgentExecutionViewById(execution.id);
}

export async function createOwnedAgentExecutionSubtask(
  ownerUserId: string,
  executionId: string,
  input: CreateAgentExecutionSubtaskInput,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (terminalExecutionStatuses.has(execution.status as AgentExecutionStatus)) {
    throw new ConflictError("Cannot add subtasks to a terminal execution");
  }

  const title = input.title.trim();
  const detail = input.detail?.trim() || null;
  const parentSubtaskId = input.parentSubtaskId?.trim() || null;
  if (!title) {
    throw new ConflictError("Subtask title is required");
  }

  await db.transaction(async (tx) => {
    if (parentSubtaskId) {
      const [parentSubtask] = await tx
        .select()
        .from(agentExecutionSubtasks)
        .where(and(eq(agentExecutionSubtasks.id, parentSubtaskId), eq(agentExecutionSubtasks.executionId, execution.id)));
      if (!parentSubtask) {
        throw new NotFoundError("Parent subtask not found");
      }
      if (parentSubtask.managedByRuntime) {
        throw new ConflictError("Runtime-managed subtasks cannot accept owner-created children");
      }
    }

    const [sortRow] = await tx
      .select({
        maxSortOrder: sql<number>`coalesce(max(${agentExecutionSubtasks.sortOrder}), -1)::int`,
      })
      .from(agentExecutionSubtasks)
      .where(eq(agentExecutionSubtasks.executionId, execution.id));

    const timestamp = now();
    await tx.insert(agentExecutionSubtasks).values({
      id: crypto.randomUUID(),
      executionId: execution.id,
      parentSubtaskId,
      title,
      detail,
      status: "pending",
      managedByRuntime: false,
      runtimePhase: null,
      sortOrder: Number(sortRow?.maxSortOrder ?? -1) + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    });

    await tx
      .update(agentExecutions)
      .set({
        updatedAt: timestamp,
      })
      .where(eq(agentExecutions.id, execution.id));

    await recordExecutionStepInTx(tx, {
      executionId: execution.id,
      kind: "status",
      phase: (execution.executorPhase as PlatformExecutionPhase | null) ?? null,
      title: `Subtask added: ${title}`,
      detail,
      status: "info",
      progressPercent: execution.progressPercent,
    });
  });

  return getAgentExecutionViewById(execution.id);
}

export async function updateOwnedAgentExecutionSubtaskStatus(
  ownerUserId: string,
  executionId: string,
  subtaskId: string,
  input: UpdateAgentExecutionSubtaskStatusInput,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (terminalExecutionStatuses.has(execution.status as AgentExecutionStatus)) {
    throw new ConflictError("Cannot update subtasks on a terminal execution");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from agent_execution_subtasks where id = ${subtaskId} for update`);
    const [subtask] = await tx
      .select()
      .from(agentExecutionSubtasks)
      .where(and(eq(agentExecutionSubtasks.id, subtaskId), eq(agentExecutionSubtasks.executionId, execution.id)));
    if (!subtask) {
      throw new NotFoundError("Execution subtask not found");
    }
    if (subtask.managedByRuntime) {
      throw new ConflictError("Runtime-managed subtasks cannot be updated manually");
    }

    const currentStatus = subtask.status as AgentExecutionSubtaskStatus;
    if (currentStatus !== input.status && !subtaskTransitionMap[currentStatus].includes(input.status)) {
      throw new ConflictError(`Cannot move execution subtask from ${currentStatus} to ${input.status}`);
    }

    const timestamp = now();
    const detail = input.detail?.trim() || subtask.detail || null;
    await tx
      .update(agentExecutionSubtasks)
      .set({
        status: input.status,
        detail,
        updatedAt: timestamp,
        completedAt:
          input.status === "completed" || input.status === "failed" || input.status === "cancelled"
            ? subtask.completedAt ?? timestamp
            : null,
      })
      .where(eq(agentExecutionSubtasks.id, subtask.id));

    await tx
      .update(agentExecutions)
      .set({
        updatedAt: timestamp,
      })
      .where(eq(agentExecutions.id, execution.id));

    await recordExecutionStepInTx(tx, {
      executionId: execution.id,
      kind: "status",
      phase: (execution.executorPhase as PlatformExecutionPhase | null) ?? null,
      title: `Subtask moved to ${input.status}: ${subtask.title}`,
      detail,
      status: input.status === "failed" || input.status === "cancelled" ? "failed" : "completed",
      progressPercent: execution.progressPercent,
    });
  });

  return getAgentExecutionViewById(execution.id);
}

export async function requeueOwnedAgentExecution(
  ownerUserId: string,
  executionId: string,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (!["failed", "cancelled"].includes(execution.status as AgentExecutionStatus)) {
    throw new ConflictError("Only failed or cancelled executions can be requeued");
  }

  const agent = await getOwnedAgent(ownerUserId, execution.agentId);
  if (!agent) {
    throw new NotFoundError("Linked agent not found");
  }
  if (agent.sourceType !== "platform") {
    throw new ConflictError("Only platform agent executions can be requeued");
  }
  if (!agent.enabled) {
    throw new ConflictError("Agent is disabled and cannot be requeued");
  }

  return db.transaction(async (tx) => {
    const updatedAt = now();
    const [updated] = await tx
      .update(agentExecutions)
      .set({
        status: "queued",
        statusNote: "Execution requeued by owner.",
        resultSummary: null,
        outputVersion: null,
        outputKind: null,
        outputPayload: null,
        outputGeneratedAt: null,
        executorPhase: isManagedLightExecutionHostingMode(agent.hostingMode) ? null : "queued",
        progressPercent: isManagedLightExecutionHostingMode(agent.hostingMode) ? null : 0,
        autoRecoveryCount: 0,
        recoveryExhaustedAt: null,
        updatedAt,
        startedAt: null,
        submittedAt: null,
        completedAt: null,
      })
      .where(eq(agentExecutions.id, execution.id))
      .returning();

    const run = await createExecutionRunInTx(tx, {
      executionId: execution.id,
      agentId: execution.agentId,
      ownerUserId,
      runKind: "requeue",
      summary: "Execution moved back to queued state by owner.",
    });

    await finishExecutionRunInTx(tx, run.id, {
      status: "completed",
      summary: "Execution requeued for another platform executor attempt.",
      artifactCount: 0,
    });

    if (!isManagedLightExecutionHostingMode(agent.hostingMode)) {
      const requeueSession = await createRuntimeSessionInTx(tx, {
        execution: updated,
        runId: run.id,
        kind: "owner_requeue",
        trigger: "owner_requeue",
        state: "requeued",
        startedPhase: "queued",
        note: "Owner requeued the platform execution.",
      });

      await finalizeRuntimeSessionInTx(tx, updated.id, {
        kind: "owner_requeue",
        state: "requeued",
        endedPhase: "queued",
        note: requeueSession.note ?? "Owner requeued the platform execution.",
      });
    }

    await recordExecutionStepInTx(tx, {
      executionId: updated.id,
      kind: "phase",
      phase: isManagedLightExecutionHostingMode(agent.hostingMode) ? null : "queued",
      title: "Execution requeued",
      detail:
        isManagedLightExecutionHostingMode(agent.hostingMode)
          ? "Owner moved the platform light execution back into the pending dispatcher queue."
          : "Owner moved the platform execution back into the queued state.",
      status: "completed",
      progressPercent: updated.progressPercent,
    });

    if (!isManagedLightExecutionHostingMode(agent.hostingMode)) {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "requeue");
    }

    await enqueueOutboxEvent(
      "agentExecution.requeued",
      {
        executionId: updated.id,
        ownerUserId: updated.ownerUserId,
        agentId: updated.agentId,
        taskId: updated.taskId,
      },
      tx,
    );

    const ownerMap = new Map([[updated.id, updated.ownerUserId]]);
    const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, remediationPolicyMap] =
      await Promise.all([
        buildArtifactMap([updated.id]),
        buildStepMap([updated.id]),
        buildSubtaskMap([updated.id], ownerMap, ownerUserId),
        buildRuntimeSessionMap([updated]),
        buildCallbackMap([updated.id]),
        buildRunMap([updated.id]),
        buildExecutionRemediationPolicyMap([updated]),
      ]);
    return toAgentExecutionView(
      updated,
      ownerUserId,
      remediationPolicyMap.get(updated.id) ??
        resolveExecutionCallbackRemediationPolicyMetadata({
          execution: updated,
          agentSourceType: "platform",
          agentPolicyKey: null,
        }),
      artifactMap.get(updated.id) ?? [],
      stepMap.get(updated.id) ?? [],
      subtaskMap.get(updated.id) ?? [],
      runtimeSessionMap.get(updated.id) ?? [],
      callbackMap.get(updated.id) ?? [],
      runMap.get(updated.id) ?? [],
    );
  });
}

async function assertExternalAgentExecutionAccess(
  executionId: string,
  callbackSecret: string,
  callbackVersion: number,
) {
  const row = await getExternalAgentExecution(executionId);
  if (!row) {
    throw new NotFoundError("Agent execution not found");
  }
  if (row.agent.sourceType !== "external") {
    throw new ConflictError("Only external agent executions support callback updates");
  }
  if (!row.agent.enabled) {
    throw new ConflictError("External agent is disabled");
  }
  const currentTime = now();
  const matched = resolveExternalCallbackMatch(row.agent, {
    callbackSecret,
    callbackVersion,
    now: currentTime,
  });

  if (!matched) {
    throw new ConflictError("External callback protocol version does not match agent configuration");
  }

  return {
    ...row,
    matchedProtocolVersion: matched.matchedProtocolVersion,
    usedPreviousProtocol: matched.usedPreviousProtocol,
    matchedSecretVersion: matched.matchedSecretVersion,
    usedPreviousSecret: matched.usedPreviousSecret,
  };
}

async function touchExternalExecutionCallback(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  options: { heartbeat?: boolean; statusNote?: string },
) {
  const timestamp = now();
  const [updated] = await tx
    .update(agentExecutions)
    .set({
      updatedAt: timestamp,
      lastExternalCallbackAt: timestamp,
      lastHeartbeatAt: options.heartbeat ? timestamp : undefined,
      statusNote: options.statusNote ?? undefined,
    })
    .where(eq(agentExecutions.id, executionId))
    .returning();

  return updated;
}

export async function updateExternalAgentExecutionStatus(
  executionId: string,
  callbackSecret: string,
  callbackId: string,
  callbackVersion: number,
  callbackTimestamp: Date | null,
  input: UpdateAgentExecutionStatusInput,
): Promise<AgentExecutionView> {
  const access = await assertExternalAgentExecutionAccess(executionId, callbackSecret, callbackVersion);
  const execution = access.execution;
  const effectiveRemediationPolicyKey = getExecutionCallbackRemediationPolicyKey(access);
  const payloadSummary = summarizeExternalCallbackPayload(input);
  const replayPayload = buildStoredExternalCallbackReplayEnvelope({
    type: "status",
    status: input.status,
    statusNote: input.statusNote,
    resultSummary: input.resultSummary,
  });
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    async () => {
      await db.transaction(async (tx) => {
        await updateOwnedAgentExecutionStatusInTx(tx, execution, input);
        await touchExternalExecutionCallback(tx, execution.id, { statusNote: input.statusNote });
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "status",
          status: "accepted",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      if (input.status === "completed") {
        return settleExecutionById(execution.id);
      }
      return getAgentExecutionViewById(execution.id);
    },
    async () => {
      await db.transaction(async (tx) => {
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "status",
          status: "duplicate",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      return getAgentExecutionViewById(execution.id);
    },
  );
}

export async function addExternalAgentExecutionArtifact(
  executionId: string,
  callbackSecret: string,
  callbackId: string,
  callbackVersion: number,
  callbackTimestamp: Date | null,
  input: AddAgentExecutionArtifactInput,
): Promise<AgentExecutionView> {
  const access = await assertExternalAgentExecutionAccess(executionId, callbackSecret, callbackVersion);
  const execution = access.execution;
  const effectiveRemediationPolicyKey = getExecutionCallbackRemediationPolicyKey(access);
  const payloadSummary = summarizeExternalCallbackPayload(input);
  const replayPayload = buildStoredExternalCallbackReplayEnvelope(input);
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    async () => {
      await db.transaction(async (tx) => {
        await addOwnedAgentExecutionArtifactInTx(tx, execution, input);
        await touchExternalExecutionCallback(tx, execution.id, {});
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "artifact",
          status: "accepted",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      return getAgentExecutionViewById(execution.id);
    },
    async () => {
      await db.transaction(async (tx) => {
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "artifact",
          status: "duplicate",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      return getAgentExecutionViewById(execution.id);
    },
  );
}

export async function recordExternalAgentExecutionHeartbeat(
  executionId: string,
  callbackSecret: string,
  callbackId: string,
  callbackVersion: number,
  callbackTimestamp: Date | null,
  statusNote?: string,
): Promise<AgentExecutionView> {
  const access = await assertExternalAgentExecutionAccess(executionId, callbackSecret, callbackVersion);
  const execution = access.execution;
  const effectiveRemediationPolicyKey = getExecutionCallbackRemediationPolicyKey(access);
  const payloadSummary = summarizeExternalCallbackPayload({ type: "heartbeat", statusNote });
  const replayPayload = buildStoredExternalCallbackReplayEnvelope({
    type: "heartbeat",
    statusNote,
  });
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    async () => {
      const latestExecution = await db.transaction(async (tx) => {
        const [currentExecution] = await tx
          .select()
          .from(agentExecutions)
          .where(eq(agentExecutions.id, execution.id));

        if (!currentExecution) {
          throw new NotFoundError("Agent execution not found");
        }

        if (terminalExecutionStatuses.has(currentExecution.status as AgentExecutionStatus)) {
          return currentExecution;
        }

        const updatedExecution = await touchExternalExecutionCallback(tx, execution.id, {
          heartbeat: true,
          statusNote,
        });
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "heartbeat",
          status: "accepted",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });

        return updatedExecution ?? currentExecution;
      });

      if (terminalExecutionStatuses.has(latestExecution.status as AgentExecutionStatus)) {
        return getAgentExecutionViewById(latestExecution.id);
      }

      return getAgentExecutionViewById(execution.id);
    },
    async () => {
      await db.transaction(async (tx) => {
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "heartbeat",
          status: "duplicate",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      return getAgentExecutionViewById(execution.id);
    },
  );
}

export async function handleExternalAgentCallback(
  executionId: string,
  callbackSecret: string,
  callbackId: string,
  callbackVersion: number,
  callbackTimestamp: Date | null,
  input: ExternalAgentCallbackInput,
): Promise<AgentExecutionView> {
  if (input.type === "heartbeat") {
    return recordExternalAgentExecutionHeartbeat(
      executionId,
      callbackSecret,
      callbackId,
      callbackVersion,
      callbackTimestamp,
      input.statusNote,
    );
  }
  if (input.type === "status") {
    return updateExternalAgentExecutionStatus(executionId, callbackSecret, callbackId, callbackVersion, callbackTimestamp, {
      status: input.status,
      statusNote: input.statusNote,
      resultSummary: input.resultSummary,
    });
  }
  return addExternalAgentExecutionArtifact(
    executionId,
    callbackSecret,
    callbackId,
    callbackVersion,
    callbackTimestamp,
    input.artifact,
  );
}

async function getActiveExecutionRunId(
  executionId: string,
  connection: NodePgDatabase<typeof schema> = db,
) {
  const [run] = await connection
    .select({ id: agentExecutionRuns.id })
    .from(agentExecutionRuns)
    .where(and(eq(agentExecutionRuns.executionId, executionId), eq(agentExecutionRuns.status, "running")))
    .orderBy(desc(agentExecutionRuns.createdAt))
    .limit(1);

  return run?.id ?? null;
}

async function ensureActivePlatformRun(args: {
  executionId: string;
  ownerUserId: string;
  agentId: string;
}) {
  const existingRunId = await getActiveExecutionRunId(args.executionId);
  if (existingRunId) {
    return existingRunId;
  }

  const created = await db.transaction(async (tx) => {
    const [execution] = await tx.select().from(agentExecutions).where(eq(agentExecutions.id, args.executionId)).limit(1);
    if (!execution) {
      throw new NotFoundError("Agent execution not found");
    }

    const run = await createExecutionRunInTx(tx, {
      executionId: args.executionId,
      agentId: args.agentId,
      ownerUserId: args.ownerUserId,
      runKind: "platform_executor",
      summary: "Execution claimed by platform executor loop.",
    });

    const openSession = await getOpenRuntimeSessionInTx(tx, execution.id, "platform_executor");
    if (!openSession) {
      await createRuntimeSessionInTx(tx, {
        execution,
        runId: run.id,
        kind: "platform_executor",
        trigger: "worker_loop",
        state: "running",
        startedPhase: (execution.executorPhase as PlatformExecutionPhase | null) ?? "prepare",
        note: "Platform executor claimed the execution for runtime processing.",
      });
    }
    return run.id;
  });

  return created;
}

async function advancePlatformExecution(executionId: string) {
  const execution = await getAgentExecutionById(executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (execution.status !== "running") {
    return {
      executionId,
      runId: (await getActiveExecutionRunId(executionId)) ?? null,
      advanced: false,
      phase: execution.executorPhase ?? null,
    };
  }

  const runId = await ensureActivePlatformRun({
    executionId: execution.id,
    ownerUserId: execution.ownerUserId,
    agentId: execution.agentId,
  });

  const phase = (execution.executorPhase as PlatformExecutionPhase | null) ?? "prepare";
  const runtimeProfile = resolveRuntimeProfile(
    (execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
  );

  const adaptedToFinalize = await db.transaction(async (tx) =>
    maybeAdvanceExecutionToFinalizeInTx({
      tx,
      execution,
      runId,
    }),
  );
  if (adaptedToFinalize) {
    return { executionId, runId, advanced: true, phase: "finalize" as PlatformExecutionPhase };
  }

  const budgetStopped = await db.transaction(async (tx) =>
    enforceExecutionBudgetInTx({
      tx,
      execution,
      runId,
    }),
  );
  if (budgetStopped) {
    return { executionId, runId, advanced: false, phase: "done" as PlatformExecutionPhase };
  }

  if (phase === "prepare" || phase === "queued") {
    let nextPhase: PlatformExecutionPhase = "prepare";
    await db.transaction(async (tx) => {
      const completedPreparePasses = await countCompletedPhaseStepsInTx(tx, execution.id, "prepare");
      const preparePassNumber = completedPreparePasses + 1;
      const objectiveChecklist = normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective);
      const basePreparePassesRequired = getRequiredPreparePasses({
        objectiveChecklist,
        runtimeProfile,
      });
      const prepareHeadroom = await getExecutionRuntimeHeadroomSnapshot(execution, tx);
      const prepareTimeoutApproaching = isExecutionPhaseTimeoutApproaching({
        updatedAt: execution.updatedAt,
        status: execution.status as AgentExecutionStatus,
        phase: "prepare",
      });
      const preparePassesRequired = prepareTimeoutApproaching
        ? Math.min(
            preparePassNumber,
            prepareHeadroom.nearLimit
              ? Math.min(basePreparePassesRequired, Math.max(1, runtimeProfile.nearLimitPreparePassesCap))
              : basePreparePassesRequired,
          )
        : prepareHeadroom.nearLimit
          ? Math.min(basePreparePassesRequired, Math.max(1, runtimeProfile.nearLimitPreparePassesCap))
          : basePreparePassesRequired;
      const prepareChecklistContext = getRuntimePhaseChecklistContext({
        objectiveChecklist,
        phase: "prepare",
        passNumber: preparePassNumber,
      });
      const isFinalPreparePass = preparePassNumber >= preparePassesRequired;
      const prepareNearLimitCapApplied =
        prepareHeadroom.nearLimit && preparePassesRequired < basePreparePassesRequired;
      const prepareTimeoutAccelerationApplied = prepareTimeoutApproaching && isFinalPreparePass;
      const prepareFocus = prepareChecklistContext
        ? ` Focus: ${prepareChecklistContext.entry.text}.`
        : "";
      nextPhase = isFinalPreparePass ? "produce_artifact" : "prepare";
      const progressPercent = isFinalPreparePass
        ? Math.max(execution.progressPercent ?? 0, 35)
        : Math.max(
            execution.progressPercent ?? 0,
            Math.min(34, 10 + Math.floor((preparePassNumber / preparePassesRequired) * 20)),
          );
      const prepareDetail = isFinalPreparePass
        ? prepareTimeoutApproaching
          ? `Platform executor completed prepare pass ${preparePassNumber}/${preparePassesRequired} and advanced early toward artifact production because the prepare timeout window was nearly exhausted.${prepareFocus}`
          : `Platform executor completed prepare pass ${preparePassNumber}/${preparePassesRequired} and advanced toward artifact production.${prepareFocus}`
        : `Platform executor completed prepare pass ${preparePassNumber}/${preparePassesRequired} and remains in prepare for additional runtime setup.${prepareFocus}`;
      const runtimeDecision = buildPrepareRuntimeDecision({
        phase: "prepare",
        runtimeProfileKey: runtimeProfile.key,
        pricingPolicyKey: prepareHeadroom.pricingPolicy.key,
        budgetStatus: prepareHeadroom.budgetStatus,
        nearLimit: prepareHeadroom.nearLimit,
        pricingNearLimit: prepareHeadroom.pricingNearLimit,
        phaseTimeoutApproaching: prepareTimeoutApproaching,
        preparePassNumber,
        preparePassesRequired,
        nearLimitCapApplied: prepareNearLimitCapApplied,
        timeoutAccelerationApplied: prepareTimeoutAccelerationApplied,
      });
      const [updatedExecution] = await tx
        .update(agentExecutions)
        .set({
          executorPhase: nextPhase,
          progressPercent,
          statusNote: isFinalPreparePass
            ? prepareTimeoutApproaching
              ? `Platform executor advanced toward artifact production because prepare headroom was nearly exhausted.${prepareChecklistContext ? ` Focused checklist entry: ${prepareChecklistContext.entry.text}.` : ""}`
              : `Platform executor prepared execution context and advanced toward artifact production.${prepareChecklistContext ? ` Focused checklist entry: ${prepareChecklistContext.entry.text}.` : ""}`
            : `Platform executor is still preparing execution context (${preparePassNumber}/${preparePassesRequired}).${prepareChecklistContext ? ` Current focus: ${prepareChecklistContext.entry.text}.` : ""}`,
          ...toStoredExecutionOutputEnvelope(
            buildExecutionOutputEnvelope({
              kind: "runtime_result",
              title: "Platform executor runtime result",
              summary: prepareDetail,
              generatedAt: now(),
              payload: {
                runtime: "platform_baseline",
                runtimeProfile: runtimeProfile.key,
                runtimePlanVersion: runtimeProfile.runtimePlanVersion,
                artifactMode: runtimeProfile.artifactMode,
                executionId: execution.id,
                phase: nextPhase,
                preparePass: preparePassNumber,
                preparePassesRequired,
                objectiveChecklist,
                focusedChecklistEntry: prepareChecklistContext?.entry ?? null,
                runtimeDecision,
              },
            }),
          ),
          updatedAt: now(),
        })
        .where(eq(agentExecutions.id, execution.id))
        .returning();

      await recordExecutionStepInTx(tx, {
        executionId: execution.id,
        kind: "phase",
        phase: "prepare",
        title: isFinalPreparePass
          ? prepareChecklistContext
            ? `Prepared ${prepareChecklistContext.entry.text}`
            : `Prepared execution context (${preparePassNumber}/${preparePassesRequired})`
          : prepareChecklistContext
            ? `Prepare ${prepareChecklistContext.entry.text} (${preparePassNumber}/${preparePassesRequired})`
            : `Prepare pass ${preparePassNumber}/${preparePassesRequired}`,
        detail: prepareDetail,
        status: "completed",
        progressPercent,
      });

      await syncRuntimeManagedSubtasksInTx(tx, updatedExecution ?? execution, "advance");
      await touchRuntimeSessionInTx(tx, execution.id, {
        kind: "platform_executor",
        phase: nextPhase,
        note: prepareDetail,
      });
    });

    return { executionId, runId, advanced: true, phase: nextPhase };
  }

  if (phase === "produce_artifact") {
    let nextPhase: PlatformExecutionPhase = "produce_artifact";
    let progressPercent = execution.progressPercent ?? 35;
    let haltedByRuntimeRules = false;
    await db.transaction(async (tx) => {
      const artifactRows = await tx
        .select()
        .from(agentExecutionArtifacts)
        .where(eq(agentExecutionArtifacts.executionId, execution.id))
        .orderBy(asc(agentExecutionArtifacts.createdAt));
      const targetArtifactCount = Math.max(1, execution.targetArtifactCount);
      const remainingArtifactCount = Math.max(0, targetArtifactCount - artifactRows.length);
      const artifactsPerAdvance = Math.max(1, runtimeProfile.artifactsPerAdvance);
      const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
      const allowPartialFinalize = pricingPolicy.allowPartialFinalize;
      const minimumArtifactsBeforePartialFinalize = Math.max(
        1,
        pricingPolicy.minimumArtifactsBeforePartialFinalize,
      );
      const [measuredCostUnits, runTotals] = await Promise.all([
        calculateExecutionBilledCostUnitsInTx(tx, execution.id),
        tx
          .select({
            totalResourceMinutes: sql<number>`coalesce(sum(${agentExecutionRuns.resourceMinutes}), 0)::int`,
          })
          .from(agentExecutionRuns)
          .where(eq(agentExecutionRuns.executionId, execution.id)),
      ]);
      const finalizeReserveCostUnits = getFinalizeReserveCostUnitsForExecution({
        execution,
        runtimeProfile,
      });
      const finalizeReserveResourceMinutes = getFinalizeReserveResourceMinutesForExecution({
        execution,
        runtimeProfile,
      });
      const currentResourceMinutes = Number(runTotals[0]?.totalResourceMinutes ?? 0);
      const affordableAdditionalArtifactsByPricing = getMaximumAffordableAdditionalArtifacts({
        measuredCostUnits,
        pricingPolicy,
        maxAdditionalArtifacts: remainingArtifactCount,
        reserveCostUnits: finalizeReserveCostUnits,
      });
      const affordableAdditionalArtifactsByBudget =
        runtimeProfile.budgetCostUnits === null
          ? remainingArtifactCount
          : env.agentExecutionArtifactCostUnits <= 0
            ? remainingArtifactCount
            : Math.max(
                0,
                Math.floor(
                  (runtimeProfile.budgetCostUnits - measuredCostUnits - finalizeReserveCostUnits) /
                    env.agentExecutionArtifactCostUnits,
                ),
              );
      const affordableAdditionalArtifactsByResourceBudget =
        runtimeProfile.budgetResourceMinutes === null
          ? remainingArtifactCount
          : getArtifactResourceMinutes() <= 0
            ? remainingArtifactCount
            : Math.max(
                0,
                Math.floor(
                  (runtimeProfile.budgetResourceMinutes -
                    currentResourceMinutes -
                    finalizeReserveResourceMinutes) /
                    getArtifactResourceMinutes(),
                ),
              );
      const affordableAdditionalArtifacts = Math.max(
        0,
        Math.min(
          remainingArtifactCount,
          affordableAdditionalArtifactsByPricing,
          affordableAdditionalArtifactsByBudget,
          affordableAdditionalArtifactsByResourceBudget,
        ),
      );
      const comfortableAdditionalArtifacts = Math.max(
        0,
        Math.min(
          affordableAdditionalArtifacts,
          getMaximumComfortableAdditionalArtifacts({
            measuredCostUnits,
            currentResourceMinutes,
            pricingPolicy,
            maxAdditionalArtifacts: remainingArtifactCount,
            reserveCostUnits: finalizeReserveCostUnits,
            reserveResourceMinutes: finalizeReserveResourceMinutes,
            budgetCostUnits: runtimeProfile.budgetCostUnits,
            budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
          }),
        ),
      );
      const runtimeNearLimitState = getExecutionRuntimeNearLimitState({
        measuredCostUnits,
        currentResourceMinutes,
        runtimeProfile,
        pricingPolicy,
      });
      const phaseTimeoutApproaching = isExecutionPhaseTimeoutApproaching({
        updatedAt: execution.updatedAt,
        status: execution.status as AgentExecutionStatus,
        phase: "produce_artifact",
      });
      const naturalArtifactsToProduce = Math.max(1, Math.min(remainingArtifactCount || 1, artifactsPerAdvance));
      const nearLimitArtifactsPerAdvanceCap = runtimeNearLimitState.nearLimit
        ? Math.max(1, runtimeProfile.nearLimitArtifactsPerAdvanceCap)
        : null;
      const requestedArtifactsToProduce = Math.max(
        1,
        Math.min(naturalArtifactsToProduce, nearLimitArtifactsPerAdvanceCap ?? artifactsPerAdvance),
      );
      const pricingCapLimited =
        remainingArtifactCount > 0 &&
        affordableAdditionalArtifactsByPricing > 0 &&
        affordableAdditionalArtifactsByPricing < remainingArtifactCount;
      const runtimeBudgetLimited =
        remainingArtifactCount > 0 &&
        ((affordableAdditionalArtifactsByBudget >= 0 &&
          affordableAdditionalArtifactsByBudget < remainingArtifactCount) ||
          (affordableAdditionalArtifactsByResourceBudget >= 0 &&
            affordableAdditionalArtifactsByResourceBudget < remainingArtifactCount));
      const partialFinalizeBlocked =
        artifactRows.length > 0 &&
        remainingArtifactCount > 0 &&
        affordableAdditionalArtifacts === 0 &&
        (!allowPartialFinalize || artifactRows.length < minimumArtifactsBeforePartialFinalize);
      if (partialFinalizeBlocked) {
        const failureDetail = pricingCapLimited
            ? `Runtime profile ${runtimeProfile.key} hit pricing policy ${pricingPolicy.key} headroom after ${artifactRows.length}/${targetArtifactCount} artifacts, but partial finalize requires at least ${minimumArtifactsBeforePartialFinalize} artifacts under the current pricing rules.`
            : `Runtime profile ${runtimeProfile.key} exhausted runtime budget headroom after ${artifactRows.length}/${targetArtifactCount} artifacts, but partial finalize requires at least ${minimumArtifactsBeforePartialFinalize} artifacts under pricing policy ${pricingPolicy.key}.`;
        const runtimeDecision = buildArtifactRuntimeDecision({
          phase: "produce_artifact",
          runtimeProfileKey: runtimeProfile.key,
          pricingPolicyKey: pricingPolicy.key,
          budgetStatus: runtimeNearLimitState.budgetStatus,
          nearLimit: runtimeNearLimitState.nearLimit,
          pricingNearLimit: runtimeNearLimitState.pricingNearLimit,
          phaseTimeoutApproaching,
          adaptiveFinalize: false,
          partialArtifactCompletion: true,
          artifactCount: artifactRows.length,
          targetArtifactCount,
          requestedArtifactsToProduce: naturalArtifactsToProduce,
          plannedArtifactsToProduce: 0,
          nearLimitArtifactsPerAdvanceCap,
          batchDownshiftApplied: false,
          finalizeEarlyReason: null,
          partialFinalizeBlocked: true,
        });
        const [failedExecution] = await tx
          .update(agentExecutions)
          .set({
            status: "failed",
            statusNote:
              "Platform executor stopped because runtime headroom was exhausted before partial finalize became eligible.",
            resultSummary: failureDetail,
            executorPhase: "done",
            progressPercent: 100,
            ...toStoredExecutionOutputEnvelope(
              buildExecutionOutputEnvelope({
                kind: "runtime_result",
                title: "Platform executor runtime result",
                summary: failureDetail,
                generatedAt: now(),
                payload: {
                  runtime: "platform_baseline",
                  runtimeProfile: runtimeProfile.key,
                  runtimePlanVersion: runtimeProfile.runtimePlanVersion,
                  artifactMode: runtimeProfile.artifactMode,
                  executionId: execution.id,
                  phase: "done",
                  artifactCount: artifactRows.length,
                  targetArtifactCount,
                  artifactsProducedThisAdvance: 0,
                  artifactsPerAdvance,
                  pricingPolicyKey: pricingPolicy.key,
                  runtimeRuleLimited: true,
                  phaseTimeoutApproaching,
                  runtimeNearLimit: runtimeNearLimitState.nearLimit,
                  budgetNearLimit: runtimeNearLimitState.budgetStatus === "near_limit",
                  pricingNearLimit: runtimeNearLimitState.pricingNearLimit,
                  nearLimitArtifactsPerAdvanceCap,
                  affordableAdditionalArtifacts,
                  comfortableAdditionalArtifacts,
                  partialArtifactCompletion: true,
                  runtimeDecision,
                  objectiveChecklist: normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective),
                  artifactSummaries: artifactRows.map((row) => row.summary),
                },
              }),
            ),
            updatedAt: now(),
            completedAt: now(),
          })
          .where(eq(agentExecutions.id, execution.id))
          .returning();
        await finishExecutionRunInTx(tx, runId, {
          status: "failed",
          summary:
            "Platform executor stopped because runtime headroom was exhausted before partial finalize became eligible.",
          errorMessage: failureDetail,
          artifactCount: artifactRows.length,
        });
        await recordExecutionStepInTx(tx, {
          executionId: execution.id,
          kind: "phase",
          phase: "produce_artifact",
          title: "Runtime headroom exhausted",
          detail: failureDetail,
          status: "failed",
          progressPercent: 100,
        });
        if (failedExecution) {
          await syncRuntimeManagedSubtasksInTx(tx, failedExecution, "failed");
          await finalizeRuntimeSessionInTx(tx, execution.id, {
            kind: "platform_executor",
            state: "failed",
            endedPhase: "done",
            note: failureDetail,
          });
        }
        await enqueueOutboxEvent(
          "agentExecution.failed",
          {
            executionId: execution.id,
            ownerUserId: execution.ownerUserId,
            agentId: execution.agentId,
            taskId: execution.taskId,
            trigger: pricingCapLimited ? "pricing_cap_exceeded" : "budget_exceeded",
          },
          tx,
        );
        nextPhase = "done";
        progressPercent = 100;
        haltedByRuntimeRules = true;
        return;
      }
      const finalizeEarlyForRuntimeRules =
          (phaseTimeoutApproaching &&
            allowPartialFinalize &&
            artifactRows.length >= minimumArtifactsBeforePartialFinalize &&
            remainingArtifactCount > 0) ||
          allowPartialFinalize &&
          artifactRows.length >= minimumArtifactsBeforePartialFinalize &&
          remainingArtifactCount > 0 &&
          affordableAdditionalArtifacts === 0;
      const artifactsToProduce = finalizeEarlyForRuntimeRules
        ? 0
        : comfortableAdditionalArtifacts > 0
          ? Math.max(1, Math.min(requestedArtifactsToProduce, comfortableAdditionalArtifacts))
          : Math.max(1, Math.min(requestedArtifactsToProduce, affordableAdditionalArtifacts || requestedArtifactsToProduce));
      const producedSummaries: string[] = [];
      let lastArtifactExecution = execution;

      for (let index = 0; index < artifactsToProduce; index += 1) {
        const nextArtifactNumber = artifactRows.length + index + 1;
        const runtimeArtifact = buildRuntimeArtifactDescriptor({
          execution,
          runtimeProfile,
          producedArtifactCount: nextArtifactNumber,
        });
        const artifactSummary = `${runtimeArtifact.summary} (${nextArtifactNumber}/${targetArtifactCount})`;
        producedSummaries.push(artifactSummary);
        lastArtifactExecution = await addOwnedAgentExecutionArtifactInTx(tx, execution, {
          kind: "note",
          title: runtimeArtifact.title,
          summary: artifactSummary,
        });
      }

      const producedArtifactCount = artifactRows.length + artifactsToProduce;
      const hasRemainingArtifacts = producedArtifactCount < targetArtifactCount;
      const finalizeEarlyAfterThisAdvance =
        hasRemainingArtifacts &&
        (pricingCapLimited || runtimeBudgetLimited) &&
        affordableAdditionalArtifacts <= artifactsToProduce;
      nextPhase =
        finalizeEarlyForRuntimeRules || finalizeEarlyAfterThisAdvance
          ? "finalize"
          : hasRemainingArtifacts
            ? "produce_artifact"
            : "finalize";
      progressPercent =
        nextPhase === "finalize"
          ? 80
          : Math.min(85, 35 + Math.floor((producedArtifactCount / targetArtifactCount) * 40));
      const artifactSummary = finalizeEarlyForRuntimeRules
        ? phaseTimeoutApproaching
          ? `Runtime approached the phase timeout after ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize early.`
          : `Runtime exhausted execution headroom after ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize early.`
        : producedSummaries.length > 1
          ? `${producedSummaries[0]} + ${producedSummaries.length - 1} more artifact(s)`
          : producedSummaries[0] ??
            `Platform executor advanced artifact production (${producedArtifactCount}/${targetArtifactCount}).`;
      const batchDownshiftApplied =
        remainingArtifactCount > 0 && artifactsToProduce > 0 && artifactsToProduce < naturalArtifactsToProduce;
      const runtimeDecision = buildArtifactRuntimeDecision({
        phase: "produce_artifact",
        runtimeProfileKey: runtimeProfile.key,
        pricingPolicyKey: pricingPolicy.key,
        budgetStatus: runtimeNearLimitState.budgetStatus,
        nearLimit: runtimeNearLimitState.nearLimit,
        pricingNearLimit: runtimeNearLimitState.pricingNearLimit,
        phaseTimeoutApproaching,
        adaptiveFinalize: false,
        partialArtifactCompletion: false,
        artifactCount: producedArtifactCount,
        targetArtifactCount,
        requestedArtifactsToProduce: naturalArtifactsToProduce,
        plannedArtifactsToProduce: artifactsToProduce,
        nearLimitArtifactsPerAdvanceCap,
        batchDownshiftApplied,
        finalizeEarlyReason: finalizeEarlyForRuntimeRules
          ? phaseTimeoutApproaching
            ? "timeout"
            : "headroom"
          : finalizeEarlyAfterThisAdvance
            ? "headroom"
            : null,
        partialFinalizeBlocked: false,
      });
      const runtimeEnvelope = buildExecutionOutputEnvelope({
        kind: "runtime_result",
        title: "Platform executor runtime result",
        summary: artifactSummary,
        generatedAt: now(),
        payload: {
          runtime: "platform_baseline",
          runtimeProfile: runtimeProfile.key,
          runtimePlanVersion: runtimeProfile.runtimePlanVersion,
          artifactMode: runtimeProfile.artifactMode,
          executionId: execution.id,
          phase: nextPhase,
          artifactCount: producedArtifactCount,
          targetArtifactCount,
          artifactsProducedThisAdvance: artifactsToProduce,
          artifactsPerAdvance,
          pricingPolicyKey: pricingPolicy.key,
          pricingCapLimited: pricingCapLimited,
          runtimeBudgetLimited,
          resourceBudgetLimited:
            remainingArtifactCount > 0 &&
            affordableAdditionalArtifactsByResourceBudget >= 0 &&
            affordableAdditionalArtifactsByResourceBudget < remainingArtifactCount,
          runtimeRuleLimited: finalizeEarlyForRuntimeRules || finalizeEarlyAfterThisAdvance,
          phaseTimeoutApproaching,
          runtimeNearLimit: runtimeNearLimitState.nearLimit,
          budgetNearLimit: runtimeNearLimitState.budgetStatus === "near_limit",
          pricingNearLimit: runtimeNearLimitState.pricingNearLimit,
          nearLimitArtifactsPerAdvanceCap,
          requestedArtifactsToProduce: naturalArtifactsToProduce,
          plannedArtifactsToProduce: artifactsToProduce,
          affordableAdditionalArtifacts,
          comfortableAdditionalArtifacts,
          runtimeDecision,
          objectiveChecklist: normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective),
          artifactSummaries: producedSummaries,
        },
      });
      const [updatedExecution] = await tx
        .update(agentExecutions)
        .set({
          executorPhase: nextPhase,
          progressPercent,
          statusNote: finalizeEarlyForRuntimeRules
            ? phaseTimeoutApproaching
              ? `Platform executor approached the phase timeout after ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize.`
              : `Platform executor exhausted runtime headroom after ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize.`
            : finalizeEarlyAfterThisAdvance
              ? `Platform executor hit the runtime headroom for further artifact production at ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize.`
              : hasRemainingArtifacts
                ? `Platform executor generated artifact ${producedArtifactCount}/${targetArtifactCount}.`
                : "Platform executor generated the full artifact package and moved into finalize.",
          ...toStoredExecutionOutputEnvelope(runtimeEnvelope),
          updatedAt: now(),
        })
        .where(eq(agentExecutions.id, execution.id))
        .returning();

      await recordExecutionStepInTx(tx, {
        executionId: execution.id,
        kind: "phase",
        phase: "produce_artifact",
        title: finalizeEarlyForRuntimeRules
          ? phaseTimeoutApproaching
            ? "Advanced to finalize under phase-timeout pressure"
            : "Advanced to finalize under runtime headroom"
          : artifactsToProduce > 1
            ? hasRemainingArtifacts && !finalizeEarlyAfterThisAdvance
              ? `Produced artifact batch to ${producedArtifactCount}/${targetArtifactCount}`
              : "Produced final artifact batch"
            : hasRemainingArtifacts && !finalizeEarlyAfterThisAdvance
              ? `Produced artifact ${producedArtifactCount}/${targetArtifactCount}`
              : "Produced final artifact package",
          detail: finalizeEarlyForRuntimeRules
            ? phaseTimeoutApproaching
              ? `Runtime profile ${runtimeProfile.key} (${runtimeProfile.artifactMode}) approached the phase timeout and moved to finalize with a partial artifact set after reaching the minimum partial-finalize threshold (${minimumArtifactsBeforePartialFinalize}).`
              : `Runtime profile ${runtimeProfile.key} (${runtimeProfile.artifactMode}) could not afford more artifacts under the current pricing/budget rules, so execution advanced to finalize with a partial artifact set after reaching the minimum partial-finalize threshold (${minimumArtifactsBeforePartialFinalize}).`
            : finalizeEarlyAfterThisAdvance
              ? `Runtime profile ${runtimeProfile.key} (${runtimeProfile.artifactMode}) produced the last runtime-affordable artifact batch (${artifactsToProduce}) and moved the execution into finalize early.`
              : hasRemainingArtifacts
              ? `Runtime profile ${runtimeProfile.key} (${runtimeProfile.artifactMode}) produced ${artifactsToProduce} artifact(s) and requires more before finalize.`
              : `Platform executor generated the final ${artifactsToProduce} artifact(s) and moved the execution into finalize.`,
        status: "completed",
        progressPercent,
      });

      await syncRuntimeManagedSubtasksInTx(tx, updatedExecution ?? lastArtifactExecution, "advance");
      await touchRuntimeSessionInTx(tx, execution.id, {
        kind: "platform_executor",
        phase: nextPhase,
          note: finalizeEarlyForRuntimeRules
            ? phaseTimeoutApproaching
              ? `Platform executor advanced to finalize because the phase timeout was nearly exhausted after ${producedArtifactCount}/${targetArtifactCount} artifacts and the execution had reached the minimum partial-finalize threshold (${minimumArtifactsBeforePartialFinalize}).`
              : `Platform executor advanced to finalize because runtime headroom was exhausted after ${producedArtifactCount}/${targetArtifactCount} artifacts and the execution had reached the minimum partial-finalize threshold (${minimumArtifactsBeforePartialFinalize}).`
            : finalizeEarlyAfterThisAdvance
              ? `Platform executor moved to finalize because runtime headroom only allowed ${producedArtifactCount}/${targetArtifactCount} artifacts.`
              : hasRemainingArtifacts
              ? `Platform executor remains in artifact production (${producedArtifactCount}/${targetArtifactCount}) after producing ${artifactsToProduce} artifact(s).`
              : `Platform executor produced the target artifact package with a final batch of ${artifactsToProduce} artifact(s).`,
      });
    });

    if (haltedByRuntimeRules) {
      return { executionId, runId, advanced: false, phase: "done" as PlatformExecutionPhase };
    }
    return { executionId, runId, advanced: true, phase: nextPhase };
  }

  if (phase === "finalize") {
    const completedExecution = await db.transaction(async (tx) => {
      const completedFinalizePasses = await countCompletedPhaseStepsInTx(tx, execution.id, "finalize");
      const finalizePassNumber = completedFinalizePasses + 1;
      const objectiveChecklist = normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective);
      const baseFinalizePassesRequired = getRequiredFinalizePasses({
        objectiveChecklist,
        runtimeProfile,
      });
      const finalizeHeadroom = await getExecutionRuntimeHeadroomSnapshot(execution, tx);
      const finalizeTimeoutApproaching = isExecutionPhaseTimeoutApproaching({
        updatedAt: execution.updatedAt,
        status: execution.status as AgentExecutionStatus,
        phase: "finalize",
      });
      const finalizePassesRequired = finalizeTimeoutApproaching
        ? Math.min(
            finalizePassNumber,
            finalizeHeadroom.nearLimit
              ? Math.min(baseFinalizePassesRequired, Math.max(1, runtimeProfile.nearLimitFinalizePassesCap))
              : baseFinalizePassesRequired,
          )
        : finalizeHeadroom.nearLimit
          ? Math.min(baseFinalizePassesRequired, Math.max(1, runtimeProfile.nearLimitFinalizePassesCap))
          : baseFinalizePassesRequired;
      const finalizeChecklistContext = getRuntimePhaseChecklistContext({
        objectiveChecklist,
        phase: "finalize",
        passNumber: finalizePassNumber,
      });
      const isFinalFinalizePass = finalizePassNumber >= finalizePassesRequired;
      const finalizeNearLimitCapApplied =
        finalizeHeadroom.nearLimit && finalizePassesRequired < baseFinalizePassesRequired;
      const finalizeTimeoutAccelerationApplied = finalizeTimeoutApproaching && isFinalFinalizePass;
      const artifactSummary = `Platform executor processed objective: ${execution.id}. This is the first internal execution-plane baseline result.`;

      if (!isFinalFinalizePass) {
        const progressPercent = Math.max(
          execution.progressPercent ?? 80,
          Math.min(95, 80 + Math.floor((finalizePassNumber / finalizePassesRequired) * 15)),
        );
        const detail = `Platform executor completed finalize pass ${finalizePassNumber}/${finalizePassesRequired} and remains in finalize for additional runtime consolidation.${finalizeChecklistContext ? ` Focus: ${finalizeChecklistContext.entry.text}.` : ""}`;
        const runtimeDecision = buildFinalizeRuntimeDecision({
          phase: "finalize",
          runtimeProfileKey: runtimeProfile.key,
          pricingPolicyKey: finalizeHeadroom.pricingPolicy.key,
          budgetStatus: finalizeHeadroom.budgetStatus,
          nearLimit: finalizeHeadroom.nearLimit,
          pricingNearLimit: finalizeHeadroom.pricingNearLimit,
          phaseTimeoutApproaching: finalizeTimeoutApproaching,
          finalizePassNumber,
          finalizePassesRequired,
          nearLimitCapApplied: finalizeNearLimitCapApplied,
          timeoutAccelerationApplied: finalizeTimeoutAccelerationApplied,
        });
        await tx
          .update(agentExecutions)
          .set({
            executorPhase: "finalize",
            progressPercent,
            statusNote: `Platform executor is finalizing runtime output (${finalizePassNumber}/${finalizePassesRequired}).${finalizeChecklistContext ? ` Current focus: ${finalizeChecklistContext.entry.text}.` : ""}`,
            ...toStoredExecutionOutputEnvelope(
              buildExecutionOutputEnvelope({
                kind: "runtime_result",
                title: "Platform executor runtime result",
                summary: artifactSummary,
                generatedAt: now(),
                payload: {
                  runtime: "platform_baseline",
                  runtimeProfile: runtimeProfile.key,
                  runtimePlanVersion: runtimeProfile.runtimePlanVersion,
                  artifactMode: runtimeProfile.artifactMode,
                  executionId: execution.id,
                  phase: "finalize",
                  finalizePass: finalizePassNumber,
                  finalizePassesRequired,
                  targetArtifactCount: execution.targetArtifactCount,
                  runtimeDecision,
                  objectiveChecklist,
                  focusedChecklistEntry: finalizeChecklistContext?.entry ?? null,
                },
              }),
            ),
            updatedAt: now(),
          })
          .where(eq(agentExecutions.id, execution.id));
        await recordExecutionStepInTx(tx, {
          executionId: execution.id,
          kind: "phase",
          phase: "finalize",
          title: finalizeChecklistContext
            ? `Finalize ${finalizeChecklistContext.entry.text} (${finalizePassNumber}/${finalizePassesRequired})`
            : `Finalize pass ${finalizePassNumber}/${finalizePassesRequired}`,
          detail,
          status: "completed",
          progressPercent,
        });
        await touchRuntimeSessionInTx(tx, execution.id, {
          kind: "platform_executor",
          phase: "finalize",
          note: detail,
        });
        return false;
      }
      return true;
    });

    if (!completedExecution) {
      return { executionId, runId, advanced: true, phase: "finalize" as PlatformExecutionPhase };
    }

    const [artifactCountRow] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(agentExecutionArtifacts)
      .where(eq(agentExecutionArtifacts.executionId, execution.id));
    const actualArtifactCount = Number(artifactCountRow?.count ?? 0);
    const partialArtifactCompletion = actualArtifactCount < execution.targetArtifactCount;
    const finalHeadroom = await getExecutionRuntimeHeadroomSnapshot(execution);
    const artifactSummary = partialArtifactCompletion
      ? `Platform executor finalized a pricing-aware partial runtime result with ${actualArtifactCount}/${execution.targetArtifactCount} artifacts.`
      : `Platform executor processed objective: ${execution.id}. This is the first internal execution-plane baseline result.`;
    const runtimeDecision = buildFinalizeCompletedRuntimeDecision({
      phase: "finalize",
      runtimeProfileKey: runtimeProfile.key,
      pricingPolicyKey: finalHeadroom.pricingPolicy.key,
      budgetStatus: finalHeadroom.budgetStatus,
      nearLimit: finalHeadroom.nearLimit,
      pricingNearLimit: finalHeadroom.pricingNearLimit,
      phaseTimeoutApproaching: false,
      artifactCount: actualArtifactCount,
      targetArtifactCount: execution.targetArtifactCount,
      partialArtifactCompletion,
    });
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "submitted",
      statusNote: partialArtifactCompletion
        ? "Platform executor produced a partial result package under runtime pricing constraints."
        : "Platform executor produced a result package.",
      resultSummary: artifactSummary,
    });

    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "completed",
      statusNote: partialArtifactCompletion
        ? "Platform executor completed successfully with a pricing-aware partial result."
        : "Platform executor completed successfully.",
      resultSummary: artifactSummary,
    });

    await db
      .update(agentExecutions)
      .set({
        ...toStoredExecutionOutputEnvelope(
          buildExecutionOutputEnvelope({
            kind: "runtime_result",
            title: "Platform executor runtime result",
            summary: artifactSummary,
            generatedAt: now(),
            payload: {
              runtime: "platform_baseline",
              runtimeProfile: runtimeProfile.key,
              runtimePlanVersion: runtimeProfile.runtimePlanVersion,
              artifactMode: runtimeProfile.artifactMode,
              executionId: execution.id,
              phase: "done",
              artifactCount: actualArtifactCount,
              targetArtifactCount: execution.targetArtifactCount,
              completionMode: "auto_finalize",
              objectiveChecklist: normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective),
              finalStatus: "completed",
              partialArtifactCompletion,
              runtimeDecision,
            },
          }),
        ),
        updatedAt: now(),
      })
      .where(eq(agentExecutions.id, execution.id));

    await finishExecutionRun(runId, {
      status: "completed",
      summary: "Platform executor completed after phased execution progress.",
      artifactCount: actualArtifactCount,
    });

    await db.transaction(async (tx) => {
      await recordExecutionStepInTx(tx, {
        executionId: execution.id,
        kind: "phase",
        phase: "finalize",
        title: "Finalized platform execution",
        detail: partialArtifactCompletion
          ? `Platform executor finished finalize with a partial artifact package (${actualArtifactCount}/${execution.targetArtifactCount}) after runtime pricing decisions.`
          : "Platform executor finished its finalize phase and marked the execution as completed.",
        status: "completed",
        progressPercent: 100,
      });
    });

    return { executionId, runId, advanced: true, phase: "done" as PlatformExecutionPhase };
  }

  return { executionId, runId, advanced: false, phase };
}

export async function runPlatformExecutor(args?: { limit?: number; agentId?: string; ownerUserId?: string }) {
  const lockToken = await acquireEphemeralLock(platformRuntimeLoopLockKey, platformRuntimeLoopLockTtlSeconds);
  if (!lockToken) {
    return {
      processedCount: 0,
      failedCount: 0,
      results: [],
      failures: [],
    };
  }

  try {
  const limit = Math.max(1, Math.min(args?.limit ?? 3, 20));
  const claimedRows = await db.transaction(async (tx) => {
    const runningRows = await tx.execute(sql`
      select ae.runtime_profile_key, count(*)::int as count
      from agent_executions ae
      inner join agents a on a.id = ae.agent_id
      where ae.status = 'running'
        and a.source_type = 'platform'
        and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
        and a.enabled = true
      group by ae.runtime_profile_key
    `);
    const runningOwnerRows = await tx.execute(sql`
      select ae.runtime_profile_key, ae.owner_user_id, count(*)::int as count
      from agent_executions ae
      inner join agents a on a.id = ae.agent_id
      where ae.status = 'running'
        and a.source_type = 'platform'
        and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
        and a.enabled = true
      group by ae.runtime_profile_key, ae.owner_user_id
    `);
    const runningCountByProfile = new Map<string, number>();
    const runningCountByProfileOwner = new Map<string, number>();
    for (const row of runningRows.rows as Array<{ runtime_profile_key: string | null; count: number }>) {
      const key = row.runtime_profile_key?.trim() || "baseline";
      runningCountByProfile.set(key, Number(row.count) || 0);
    }
    for (const row of runningOwnerRows.rows as Array<{ runtime_profile_key: string | null; owner_user_id: string | null; count: number }>) {
      const runtimeProfileKey = row.runtime_profile_key?.trim() || "baseline";
      const ownerUserId = row.owner_user_id?.trim();
      if (!ownerUserId) continue;
      runningCountByProfileOwner.set(
        buildRuntimeProfileOwnerKey(runtimeProfileKey, ownerUserId),
        Number(row.count) || 0,
      );
    }

    const candidateFetchLimit = Math.max(limit * 5, 20);
    const executorScopeWhereClause = toWhereClause([
      eq(agentExecutions.status, "queued"),
      eq(agents.sourceType, "platform"),
        sql`coalesce(${agents.hostingMode}, 'registry_only') not in ('managed_api', 'managed_light')`,
      eq(agents.enabled, true),
      ...(args?.agentId ? [eq(agentExecutions.agentId, args.agentId)] : []),
      ...(args?.ownerUserId ? [eq(agentExecutions.ownerUserId, args.ownerUserId)] : []),
    ]);
    const rows = await tx.execute(sql`
      select
        ${agentExecutions.id} as execution_id,
        ${agentExecutions.ownerUserId} as owner_user_id,
        ${agentExecutions.agentId} as agent_id,
        ${agentExecutions.taskId} as task_id,
        ${agentExecutions.runtimeProfileKey} as runtime_profile_key
      from ${agentExecutions}
      inner join ${agents} on ${agents.id} = ${agentExecutions.agentId}
      where ${executorScopeWhereClause ?? sql`true`}
      order by ${agentExecutions.createdAt} asc
      limit ${candidateFetchLimit}
      for update skip locked
    `);

    const timestamp = now();
    const candidates = rows.rows as Array<{
      execution_id: string;
      owner_user_id: string;
      agent_id: string;
      task_id: string | null;
      runtime_profile_key: string | null;
    }>;
    const claimed = candidates
      .filter((row) => {
        const runtimeProfileKey = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
        const runtimeProfile = resolveRuntimeProfile(runtimeProfileKey);
        const ownerConcurrencyKey = buildRuntimeProfileOwnerKey(runtimeProfile.key, row.owner_user_id);
        if (runtimeProfile.maxConcurrentExecutions === null) {
          if (runtimeProfile.maxConcurrentExecutionsPerOwner === null) {
            return true;
          }
          const runningCountByOwner = runningCountByProfileOwner.get(ownerConcurrencyKey) ?? 0;
          if (runningCountByOwner >= runtimeProfile.maxConcurrentExecutionsPerOwner) {
            return false;
          }
          runningCountByProfileOwner.set(ownerConcurrencyKey, runningCountByOwner + 1);
          return true;
        }
        const runningCount = runningCountByProfile.get(runtimeProfile.key) ?? 0;
        if (runningCount >= runtimeProfile.maxConcurrentExecutions) {
          return false;
        }
        if (runtimeProfile.maxConcurrentExecutionsPerOwner !== null) {
          const runningCountByOwner = runningCountByProfileOwner.get(ownerConcurrencyKey) ?? 0;
          if (runningCountByOwner >= runtimeProfile.maxConcurrentExecutionsPerOwner) {
            return false;
          }
          runningCountByProfileOwner.set(ownerConcurrencyKey, runningCountByOwner + 1);
        }
        runningCountByProfile.set(runtimeProfile.key, runningCount + 1);
        return true;
      })
      .slice(0, limit);

    for (const row of claimed) {
      const [updatedExecution] = await tx
        .update(agentExecutions)
        .set({
          status: "running",
          statusNote: "Platform executor claimed this execution.",
          executorPhase: "prepare",
          progressPercent: 10,
          startedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(agentExecutions.id, row.execution_id))
        .returning();

      await recordExecutionStepInTx(tx, {
        executionId: row.execution_id,
        kind: "phase",
        phase: "prepare",
        title: "Claimed by platform executor",
        detail: "Worker claimed the queued execution and moved it into the prepare phase.",
        status: "info",
        progressPercent: 10,
      });

      await enqueueOutboxEvent(
        "agentExecution.started",
        {
          executionId: row.execution_id,
          ownerUserId: row.owner_user_id,
          agentId: row.agent_id,
          taskId: row.task_id,
        },
        tx,
      );

      if (updatedExecution) {
        await syncRuntimeManagedSubtasksInTx(tx, updatedExecution, "claim");
      }
    }

    return claimed;
  });

  const existingRunningWhereClause = toWhereClause([
    eq(agentExecutions.status, "running"),
    eq(agents.sourceType, "platform"),
        sql`coalesce(${agents.hostingMode}, 'registry_only') not in ('managed_api', 'managed_light')`,
    eq(agents.enabled, true),
    ...(args?.agentId ? [eq(agentExecutions.agentId, args.agentId)] : []),
    ...(args?.ownerUserId ? [eq(agentExecutions.ownerUserId, args.ownerUserId)] : []),
  ]);
  const existingRunningRows = await db.execute(sql`
    select ${agentExecutions.id} as execution_id, ${agentExecutions.ownerUserId} as owner_user_id
    from ${agentExecutions}
    inner join ${agents} on ${agents.id} = ${agentExecutions.agentId}
    where ${existingRunningWhereClause ?? sql`true`}
    order by ${agentExecutions.updatedAt} asc
    limit ${limit}
  `);

  const candidateMap = new Map<string, { executionId: string; ownerUserId: string }>();
  for (const row of claimedRows) {
    candidateMap.set(row.execution_id, {
      executionId: row.execution_id,
      ownerUserId: row.owner_user_id,
    });
  }
  for (const row of existingRunningRows.rows as Array<{ execution_id: string; owner_user_id: string }>) {
    if (!candidateMap.has(row.execution_id)) {
      candidateMap.set(row.execution_id, {
        executionId: row.execution_id,
        ownerUserId: row.owner_user_id,
      });
    }
  }

  const results: Array<{
    executionId: string;
    ownerUserId: string;
    runId: string | null;
    phase: string | null;
    advancesPerformed: number;
  }> = [];
  const failures: Array<{ executionId: string; runId: string | null; message: string }> = [];

  for (const row of candidateMap.values()) {
    const executionId = row.executionId;
    const ownerUserId = row.ownerUserId;
    try {
      const latestExecution = await getAgentExecutionById(executionId);
      if (!latestExecution) {
        failures.push({ executionId, runId: null, message: "Execution disappeared before runtime processing." });
        continue;
      }
      const runtimeProfile = resolveRuntimeProfile(
        (latestExecution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
      );
      const runtimeHeadroom = await getExecutionRuntimeHeadroomSnapshot(latestExecution);
      const phaseTimeoutApproaching = isExecutionPhaseTimeoutApproaching({
        updatedAt: latestExecution.updatedAt,
        status: latestExecution.status as AgentExecutionStatus,
        phase: (latestExecution.executorPhase as PlatformExecutionPhase | null) ?? null,
      });
      const maxAdvances = phaseTimeoutApproaching
        ? 1
        : runtimeHeadroom.nearLimit
          ? Math.max(1, Math.min(runtimeProfile.phaseAdvancesPerRun, runtimeProfile.nearLimitPhaseAdvancesPerRunCap))
          : Math.max(1, runtimeProfile.phaseAdvancesPerRun);
      let lastPhase: string | null = latestExecution.executorPhase ?? null;
      let advancesPerformed = 0;
      for (let index = 0; index < maxAdvances; index += 1) {
        const result = await advancePlatformExecution(executionId);
        const runId = result.runId ?? null;
        lastPhase = result.phase;
        if (!result.advanced) {
          results.push({ executionId, ownerUserId, runId, phase: lastPhase, advancesPerformed });
          break;
        }
        advancesPerformed += 1;
        if (result.phase === "done") {
          results.push({ executionId, ownerUserId, runId, phase: lastPhase, advancesPerformed });
          break;
        }
        if (index === maxAdvances - 1) {
          results.push({ executionId, ownerUserId, runId, phase: lastPhase, advancesPerformed });
        }
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unknown platform executor failure";
      const runId = await getActiveExecutionRunId(executionId);
      if (runId) {
        await finishExecutionRun(runId, {
          status: "failed",
          summary: "Platform executor failed while processing the execution.",
          errorMessage: message,
          artifactCount: 0,
        });
      }
      failures.push({ executionId, runId: runId ?? null, message });
    }
  }

  return {
    processedCount: results.length,
    failedCount: failures.length,
    results,
    failures,
  };
  } finally {
    await releaseEphemeralLock(platformRuntimeLoopLockKey, lockToken);
  }
}

export async function recoverStalePlatformExecutions(args?: {
  limit?: number;
  staleSeconds?: number;
  agentId?: string;
  ownerUserId?: string;
}) {
  const lockToken = await acquireEphemeralLock(platformRuntimeLoopLockKey, platformRuntimeLoopLockTtlSeconds);
  const staleSeconds = getMinimumExecutionPhaseTimeoutSeconds(args?.staleSeconds ?? null);
  if (!lockToken) {
    return {
      recoveredCount: 0,
      exhaustedCount: 0,
      staleSeconds,
      results: [],
    };
  }

  try {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 50));
  const actionResults = await db.transaction(async (tx) => {
    const recoveryWhereClause = toWhereClause([
      eq(agentExecutions.status, "running"),
      eq(agents.sourceType, "platform"),
        sql`coalesce(${agents.hostingMode}, 'registry_only') not in ('managed_api', 'managed_light')`,
      eq(agents.enabled, true),
      sql`${agentExecutions.updatedAt} <= now() - (${staleSeconds} * interval '1 second')`,
      ...(args?.agentId ? [eq(agentExecutions.agentId, args.agentId)] : []),
      ...(args?.ownerUserId ? [eq(agentExecutions.ownerUserId, args.ownerUserId)] : []),
    ]);

    const rows = await tx.execute(sql`
      select
        ${agentExecutions.id} as execution_id,
        ${agentExecutions.ownerUserId} as owner_user_id,
        ${agentExecutions.agentId} as agent_id,
        ${agentExecutions.taskId} as task_id,
        ${agentExecutions.executorPhase} as executor_phase,
        ${agentExecutions.updatedAt} as updated_at,
        ${agentExecutions.autoRecoveryCount} as auto_recovery_count,
        ${agentExecutions.maxAutoRecoveryCount} as max_auto_recovery_count
      from ${agentExecutions}
      inner join ${agents} on ${agents.id} = ${agentExecutions.agentId}
      where ${recoveryWhereClause ?? sql`true`}
      order by ${agentExecutions.updatedAt} asc
      limit ${limit}
      for update skip locked
    `);

    const timestamp = now();
    const recovered = rows.rows as Array<{
      execution_id: string;
      owner_user_id: string;
      agent_id: string;
      task_id: string | null;
      executor_phase: string | null;
      updated_at: Date;
      auto_recovery_count: number;
      max_auto_recovery_count: number;
      run_id?: string;
    }>;
    const handledResults: Array<{
      executionId: string;
      ownerUserId: string;
      action: "requeued" | "exhausted";
      runId: string;
    }> = [];

    for (const row of recovered) {
      const phaseTimeoutSeconds = getExecutionPhaseTimeoutSeconds(
        (row.executor_phase as PlatformExecutionPhase | null) ?? null,
        args?.staleSeconds ?? null,
      );
      const phaseAgeSeconds = getExecutionPhaseAgeSeconds({
        updatedAt: row.updated_at,
        status: "running",
        phase: (row.executor_phase as PlatformExecutionPhase | null) ?? null,
      });
      if (phaseAgeSeconds === null || phaseAgeSeconds < phaseTimeoutSeconds) {
        continue;
      }

      const activeRunId = await getActiveExecutionRunId(row.execution_id, tx);
      if (activeRunId) {
        await finishExecutionRunInTx(tx, activeRunId, {
          status: "failed",
          summary: "Recovery watchdog marked the stale platform execution as interrupted.",
          errorMessage: `Execution exceeded phase timeout of ${phaseTimeoutSeconds} seconds.`,
          artifactCount: 0,
        });
      }

      const nextAutoRecoveryCount = Number(row.auto_recovery_count ?? 0) + 1;
      const maxAutoRecoveryCount = Number(row.max_auto_recovery_count ?? env.agentExecutionMaxAutoRecoveries);
      const recoveryBudgetExhausted = nextAutoRecoveryCount > maxAutoRecoveryCount;

      if (recoveryBudgetExhausted) {
        const [updatedExecution] = await tx
          .update(agentExecutions)
          .set({
            status: "failed",
            statusNote: "Execution exceeded stale timeout and exhausted the automatic recovery budget.",
            resultSummary: "Automatic stale recovery budget exhausted.",
            autoRecoveryCount: nextAutoRecoveryCount,
            recoveryExhaustedAt: timestamp,
            updatedAt: timestamp,
            completedAt: timestamp,
          })
          .where(eq(agentExecutions.id, row.execution_id))
          .returning();

        const run = await createExecutionRunInTx(tx, {
          executionId: row.execution_id,
          agentId: row.agent_id,
          ownerUserId: row.owner_user_id,
          runKind: "recovery",
          summary: `Execution exceeded stale timeout and exhausted the automatic recovery budget after ${maxAutoRecoveryCount} attempts.`,
        });

        await finishExecutionRunInTx(tx, run.id, {
          status: "failed",
          summary: "Recovery watchdog stopped requeueing because the automatic recovery budget was exhausted.",
          errorMessage: `Automatic recovery attempts exceeded the configured maximum (${maxAutoRecoveryCount}).`,
          artifactCount: 0,
        });
        handledResults.push({
          executionId: row.execution_id,
          ownerUserId: row.owner_user_id,
          action: "exhausted",
          runId: run.id,
        });

        await recordExecutionStepInTx(tx, {
          executionId: row.execution_id,
          kind: "phase",
          phase: "done",
          title: "Automatic recovery budget exhausted",
          detail: `Execution remained stale beyond the ${phaseTimeoutSeconds}-second timeout for phase ${(row.executor_phase as string | null) ?? "unknown"} and exhausted ${maxAutoRecoveryCount} automatic recovery attempts.`,
          status: "failed",
          progressPercent: 100,
        });

        await enqueueOutboxEvent(
          "agentExecution.failed",
          {
            executionId: row.execution_id,
            ownerUserId: row.owner_user_id,
            agentId: row.agent_id,
            taskId: row.task_id,
            trigger: "recovery_exhausted",
          },
          tx,
        );

        if (updatedExecution) {
          await syncRuntimeManagedSubtasksInTx(tx, updatedExecution, "failed");
          await finalizeRuntimeSessionInTx(tx, updatedExecution.id, {
            kind: "platform_executor",
            state: "failed",
            endedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? "done",
            note: "Automatic recovery budget exhausted after repeated stale runtime recovery attempts.",
          });
          const recoverySession = await createRuntimeSessionInTx(tx, {
            execution: updatedExecution,
            runId: run.id,
            kind: "stale_recovery",
            trigger: "auto_recovery",
            state: "failed",
            startedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? "done",
            note: "Recovery watchdog exhausted the automatic recovery budget.",
          });
          await finalizeRuntimeSessionInTx(tx, updatedExecution.id, {
            kind: "stale_recovery",
            state: "failed",
            endedPhase: "done",
            note: recoverySession.note ?? "Recovery watchdog exhausted the automatic recovery budget.",
          });
        }
      } else {
        const [updatedExecution] = await tx
          .update(agentExecutions)
          .set({
            status: "queued",
            statusNote: "Execution automatically requeued after stale running timeout.",
            resultSummary: null,
            executorPhase: "queued",
            progressPercent: 0,
            autoRecoveryCount: nextAutoRecoveryCount,
            updatedAt: timestamp,
            startedAt: null,
            submittedAt: null,
            completedAt: null,
          })
          .where(eq(agentExecutions.id, row.execution_id))
          .returning();

        const run = await createExecutionRunInTx(tx, {
          executionId: row.execution_id,
          agentId: row.agent_id,
          ownerUserId: row.owner_user_id,
          runKind: "recovery",
          summary: `Execution auto-requeued after exceeding stale timeout of ${staleSeconds} seconds.`,
        });

        await finishExecutionRunInTx(tx, run.id, {
          status: "completed",
          summary: "Recovery watchdog returned the execution to queued state.",
          artifactCount: 0,
        });
        handledResults.push({
          executionId: row.execution_id,
          ownerUserId: row.owner_user_id,
          action: "requeued",
          runId: run.id,
        });

        await enqueueOutboxEvent(
          "agentExecution.requeued",
          {
            executionId: row.execution_id,
            ownerUserId: row.owner_user_id,
            agentId: row.agent_id,
            taskId: row.task_id,
            trigger: "recovery",
          },
          tx,
        );

        await recordExecutionStepInTx(tx, {
          executionId: row.execution_id,
          kind: "phase",
          phase: "queued",
          title: "Execution auto-requeued",
          detail: `Recovery watchdog detected a stale platform execution and returned it to the queue after ${nextAutoRecoveryCount} automatic attempts.`,
          status: "completed",
          progressPercent: 0,
        });

        if (updatedExecution) {
          await syncRuntimeManagedSubtasksInTx(tx, updatedExecution, "requeue");
          await finalizeRuntimeSessionInTx(tx, updatedExecution.id, {
            kind: "platform_executor",
            state: "requeued",
            endedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? "queued",
            note: "Recovery watchdog returned the stale execution to the queue.",
          });
          const recoverySession = await createRuntimeSessionInTx(tx, {
            execution: updatedExecution,
            runId: run.id,
            kind: "stale_recovery",
            trigger: "auto_recovery",
            state: "requeued",
            startedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? "queued",
            note: "Recovery watchdog requeued the stale execution.",
          });
          await finalizeRuntimeSessionInTx(tx, updatedExecution.id, {
            kind: "stale_recovery",
            state: "requeued",
            endedPhase: "queued",
            note: recoverySession.note ?? "Recovery watchdog requeued the stale execution.",
          });
        }
      }
    }

    return handledResults;
  });

  const exhaustedResults = actionResults.filter((row) => row.action === "exhausted");
  const recoveredResults = actionResults.filter((row) => row.action === "requeued");
  return {
    recoveredCount: recoveredResults.length,
    exhaustedCount: exhaustedResults.length,
    staleSeconds,
    results: actionResults,
  };
  } finally {
    await releaseEphemeralLock(platformRuntimeLoopLockKey, lockToken);
  }
}
