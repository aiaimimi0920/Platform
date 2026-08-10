import {
  type ApiErrorPayload,
  type AccountAnnouncementView,
  type UpsertAccountAnnouncementInput,
  type AdvanceArbitrationReviewRoundInput,
  type ArbitrationCaseView,
  type ArbitrationEvidenceAttachmentUploadPlanView,
  type CreateArbitrationEvidenceInput,
  type CreateArbitrationCaseInput,
  type PrepareArbitrationEvidenceAttachmentUploadInput,
  type UploadArbitrationEvidenceAttachmentInput,
  type AddAgentCapabilityInput,
  type AddAgentExecutionArtifactInput,
  type AgentCallbackConfigHistoryView,
  type AgentCallbackCompatibilityCleanupResult,
  type AgentCallbackCompatibilitySummaryView,
  type AgentCallbackHealthSummaryView,
  type AgentCallbackRemediationPolicyKey,
  type AgentCallbackRemediationPolicyView,
  type AgentCapabilityView,
  type AgentMarketplaceAutoProposalSweepResult,
  type InvokeAgentMarketplaceListingInput,
  type InvokeAgentMarketplaceListingResult,
  type AgentMarketplaceListingView,
  type AgentRecentCallbackView,
  type ArbitrationCaseSummaryView,
  type ArbitrationRemoteAttachmentCleanupQueueView,
  type ArbitrationWorkloadView,
  type AgentExecutionCallbackAuditSummaryView,
  type AgentExecutionCallbackAutoRemediationResult,
  type AgentExecutionCallbackAutoRemediationReasonCategory,
  type AgentExecutionCallbackAutoRemediationReasonDisposition,
  type AgentExecutionCallbackRemediationAlertDispatchResult,
  type AgentExecutionCallbackRemediationDecisionClass,
  type AgentExecutionCallbackRemediationSummaryView,
  type AgentExecutionCallbackReplayResult,
  type AgentExecutionCallbackReplayFailureClass,
  type AgentExecutionCallbackRetryBatchResult,
  type AgentExecutionCallbackRetryRequestResult,
  type AgentExecutionCallbackAuditView,
  type AgentExecutionStoredReplayPayloadCompatibility,
  type AgentExecutionLaunchPresetView,
  type AgentExecutionRuntimeCatalogView,
  type AgentExecutionRuntimeDecisionClass,
  type AgentExecutionRuntimeDecisionSeverity,
  type AgentExecutionRuntimePressureAlertDispatchResult,
  type AgentExecutionRuntimePressureAlertSummaryView,
  type AgentExecutionRuntimePressureLevel,
  type AgentExecutionRuntimeSchedulingDecisionClass,
  type AgentExecutionOperatorRunSummaryView,
  type AgentExecutionOperatorRunView,
  type AgentExecutionOutputEnvelope,
  type AgentExecutionSettlementAttemptStatus,
  type AgentExecutionSettlementAttemptView,
  type AgentExecutionSettlementSummaryView,
  type AgentExecutionRuntimeSessionView,
  type AgentExecutionRuntimeSessionSummaryView,
  type AgentExecutionRuntimeSessionSweepResult,
  type AgentExecutionRunView,
  type AgentExecutionStepView,
  type PlatformExecutionRunResult,
  type PlatformExecutionRecoveryResult,
  type AgentView as ContractAgentView,
  type AgentExecutionView as ContractAgentExecutionView,
  type CreateAgentInput,
  type UpdateAgentInput,
  type CreateAgentExecutionInput,
  type CreateAgentExecutionLaunchPresetInput,
  type CreateAgentExecutionSubtaskInput,
  type CreateOpinionTopicCommentInput,
  type CreateTaskAgentProposalInput,
  type CreateOpinionTopicInput,
  type DevelopmentQueueItemView,
  type FulfillmentOpsSummaryView,
  type OutboxRetryBatchResult,
  type OutboxEventStatus,
  type OutboxEventView,
  type OutboxRetryAttemptView,
  type OutboxAlertDispatchResult,
  type OutboxSummaryView,
  type ReputationBreakdown,
  type ReputationHistoryPoint,
  type TaskAgentProposalView,
  featureModuleKeys,
  type ClaimMailboxAttachmentInput,
  type CreateMarketplaceListingInput,
  type CreateOrderInput,
  type CreateTaskInput,
  type FeatureSnapshot,
  type PublicSurfaceKey,
  type PublicSurfaceSnapshot,
  type InternalUserContext,
  type ItemView as ContractItemView,
  type ItemManualReviewView,
  type ItemManualReviewSummaryView,
  type LinuxDoUpsertInput,
  type LinuxDoUpsertResult,
  type ManualReviewRebalanceResult,
  type ManualReviewSlaSummaryView,
  type ManualReviewSlaTemplateView,
  type ManualReviewWorkloadView,
  type MailboxMessageView,
  type MarketplaceListingView,
  type DiscountCodeOperatorMutationResult,
  type DiscountCodeBatchMutationResult,
  type DiscountCodeOperatorView,
  type DiscountCodeOperatorState,
  type OrderView,
  type OpinionHubSettingsView,
  type OpinionMonthlySettlementRunDetailView,
  type UpdateAgentCapabilityInput,
  type UpdateAgentMarketplaceListingStatusInput,
  type UpsertAgentMarketplaceListingInput,
  type OpinionMonthlySettlementRunView,
  type OpinionMonthlySettlementResultView,
  type OpinionTopicDetailView,
  type OpinionTopicListView,
  type OpinionTopicOpposeSummaryView,
  type OpinionTopicReviewStatus,
  type OpinionTopicSortMode,
  type OpinionTopicTag,
  type OpinionTopicView,
  type OpinionTopicSupportSummaryView,
  type OpposeOpinionTopicInput,
  type ProductListItem as ContractProductListItem,
  type ProductOperatorMutationResult,
  type ProductOperatorView,
  type ReputationSummary,
  type RedeemCodeInput,
  type RedeemResult,
  type RedemptionCodeView,
  type RedemptionCodeUsageView,
  type UpsertRedemptionCodeInput,
  type GenerateRedemptionCodeBatchInput,
  type TaskApplicationView,
  type TaskLifecycleAction,
  type UpdateDevelopmentQueueStatusInput,
  type UpdateOpinionMonthlySettlementItemInput,
  type UpdateArbitrationCaseStatusInput,
  type UpdateAgentExecutionLaunchPresetInput,
  type UpdateAgentExecutionSubtaskStatusInput,
  type UpdateAgentExecutionStatusInput,
  type UpsertDiscountCodeInput,
  type ApplyDiscountCodeBatchInput,
  type ListAgentExecutionLaunchPresetsInput,
  type ListOperatorDiscountCodesInput,
  type RollbackOrderInput,
  type RollbackOrderResult,
  type UpdateOpinionHubSettingsInput,
  type UpsertProductInput,
  type TaskView,
  type UserSummary,
  type WalletSummary,
  type WalletExchangeInput,
  type WalletExchangeResult,
  type ModerateOpinionTopicInput,
} from "@neuro/contracts";

import {
  classifyInternalDependencyError,
  fetchInternal,
  resolveInternalRequestTimeoutMs,
  type ClassifiedInternalDependencyError,
} from "@/lib/internal-request";

export type { ManualReviewWorkloadView } from "@neuro/contracts";
export type {
  AgentExecutionLaunchPresetView,
  CreateAgentExecutionLaunchPresetInput,
  DiscountCodeOperatorMutationResult,
  DiscountCodeBatchMutationResult,
  DiscountCodeOperatorView,
  DiscountCodeOperatorState,
  OrderView,
  ProductOperatorMutationResult,
  ProductOperatorView,
  ApplyDiscountCodeBatchInput,
  ListAgentExecutionLaunchPresetsInput,
  ListOperatorDiscountCodesInput,
  RollbackOrderInput,
  RollbackOrderResult,
  UpdateAgentExecutionLaunchPresetInput,
  UpsertDiscountCodeInput,
  UpsertProductInput,
} from "@neuro/contracts";

const coreInternalUrl = process.env.CORE_INTERNAL_URL || "http://127.0.0.1:4000";
const internalApiToken = process.env.INTERNAL_API_TOKEN || "";
const coreRequestTimeoutMs = resolveInternalRequestTimeoutMs(
  process.env.CORE_INTERNAL_FETCH_TIMEOUT_MS,
  process.env.INTERNAL_FETCH_TIMEOUT_MS,
);
export const FEATURE_SNAPSHOT_UNAVAILABLE_NOTE = "Feature snapshot unavailable; module state unknown.";

export type ItemUnitIssueReason = "invalidated" | "expired" | "quota_exhausted" | "normal_exhaustion";
export type ItemIssueReportOutcome = "replaced" | "rejected" | "manual_review";
export type ItemIssueRejectionCode =
  | "warranty_expired"
  | "reason_not_covered"
  | "manual_review_required"
  | "quota_exhausted_not_replaceable"
  | "normal_exhaustion_not_replaceable";
export type ItemReplacementLogTrigger = "issue_report" | "manual_reconcile" | "scheduled_reconcile" | "manual_review";
export type ItemFulfillmentRunTrigger = "manual" | "scheduled";
export type ItemFulfillmentRunStatus = "completed" | "noop";

export type AgentView = ContractAgentView & {
  externalCallbackRotatedAt?: string | null;
  externalCallbackProtocolVersion?: number | null;
  externalCallbackSecretVersion?: number | null;
  externalCallbackPreviousSecretVersion?: number | null;
  externalCallbackSecretGraceUntil?: string | null;
  externalCallbackPreviousProtocolVersion?: number | null;
  externalCallbackProtocolGraceUntil?: string | null;
};

export type AgentExecutionView = ContractAgentExecutionView & {
  lastHeartbeatAt?: string | null;
  lastExternalCallbackAt?: string | null;
  steps?: AgentExecutionStepView[];
  callbacks?: AgentExecutionCallbackAuditView[];
  runs?: AgentExecutionRunView[];
  canRequeue?: boolean | null;
  output?: AgentExecutionOutputEnvelope | null;
};

export type ItemUnitView = {
  id: string;
  code: string;
  status: "active" | "inactive" | "replaced" | "consumed";
  issueReason: ItemUnitIssueReason | null;
  activatedAt: string | null;
  expiresAt: string | null;
  replacedByUnitId: string | null;
};

export type ItemIssueReportView = {
  id: string;
  itemId: string;
  unitId: string;
  reason: ItemUnitIssueReason;
  outcome: ItemIssueReportOutcome;
  rejectionCode: ItemIssueRejectionCode | null;
  rejectionCategory: "manual_review" | "warranty_window" | "policy_restriction" | "usage_exhaustion" | null;
  rejectionSummary: string | null;
  operatorHint: string | null;
  appealable: boolean;
  replacementUnitId: string | null;
  createdAt: string;
};

export type ItemReplacementLogView = {
  id: string;
  itemId: string;
  previousUnitId: string | null;
  replacementUnitId: string;
  reason: ItemUnitIssueReason | null;
  trigger: ItemReplacementLogTrigger;
  createdAt: string;
};

export type ItemFulfillmentRunView = {
  id: string;
  itemId: string;
  trigger: ItemFulfillmentRunTrigger;
  status: ItemFulfillmentRunStatus;
  scannedUnits: number;
  replacementsCreated: number;
  note: string | null;
  createdAt: string;
};

export type ProductListItem = ContractProductListItem & {
  unitCount?: number | null;
  warrantyDays?: number | null;
};

export type ItemView = ContractItemView & {
  totalUnits?: number | null;
  activeUnits?: number | null;
  replacementCount?: number | null;
  warrantyExpiresAt?: string | null;
  issueReportingEnabled?: boolean;
  units?: ItemUnitView[];
  issueReports?: ItemIssueReportView[];
  manualReviews?: ItemManualReviewView[];
  replacementLogs?: ItemReplacementLogView[];
  fulfillmentRuns?: ItemFulfillmentRunView[];
  lastReconciledAt?: string | null;
};

type ManualReviewQueryArgs = {
  routingCode?: string;
  suggestedAction?: string;
  status?: string;
  reason?: string;
  priority?: string;
  slaBucket?: string;
  rejectionCategory?: string;
  appealable?: string;
  assignee?: string;
  claimedAt?: string;
  limit?: number;
};

export type RotateAgentCallbackSecretResult = {
  agent: AgentView;
  callbackSecret: string;
};

type CallbackAuditQueryArgs = {
  agentId?: string;
  callbackType?: "status" | "artifact" | "heartbeat" | "callback";
  status?: "accepted" | "duplicate" | "rejected";
  remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
  secretVersion?: number;
  callbackVersion?: number;
  protocolMatch?: "current" | "previous";
  secretMatch?: "current" | "previous";
  retryability?: "retryable" | "inspect" | "not_retryable";
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
  rejectionCategory?:
    | "invalid_secret"
    | "invalid_signature"
    | "invalid_timestamp"
    | "invalid_version"
    | "invalid_payload"
    | "processing_conflict"
    | "unsupported_target"
    | "unknown";
  limit?: number;
};

type AgentExecutionRunQueryArgs = {
  agentId?: string;
  ownerUserId?: string;
  executionIds?: string[];
  runIds?: string[];
  runKind?:
    | "platform_executor"
    | "requeue"
    | "recovery"
    | "callback_retry_request"
    | "callback_payload_replay"
    | "callback_auto_remediation";
  runStatus?: "running" | "completed" | "failed";
  executionStatus?: "queued" | "running" | "submitted" | "completed" | "failed" | "cancelled";
  failureCategory?: "stale_timeout" | "executor_failure" | "requeue_failure" | "unknown_failure";
  recentWindow?: "15m" | "1h" | "24h";
  limit?: number;
};

type CoreRequestError = Error & {
  code?: ApiErrorPayload["code"];
  status?: number | null;
  statusCode?: number | null;
  category?: ClassifiedInternalDependencyError["category"];
  service?: ClassifiedInternalDependencyError["service"];
  requestId?: string | null;
  correlationId?: string | null;
  occurredAt?: string;
  retryable?: boolean;
  diagnostics?: string;
  publicMessage?: string;
};

type CoreRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  userContext?: InternalUserContext | null;
};

function buildHeaders(userContext?: InternalUserContext | null, hasJsonBody = false): HeadersInit {
  const headers: Record<string, string> = {
    "x-internal-api-token": internalApiToken,
  };

  if (hasJsonBody) {
    headers["content-type"] = "application/json";
  }

  if (userContext?.userId) {
    headers["x-neuro-user-id"] = userContext.userId;
  }

  if (userContext?.providerUserId) {
    headers["x-neuro-provider-user-id"] = userContext.providerUserId;
  }

  if (userContext?.username) {
    headers["x-neuro-username"] = userContext.username;
  }

  return headers;
}

function buildCallbackAuditQueryString(args?: CallbackAuditQueryArgs) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.callbackType) params.set("callbackType", args.callbackType);
  if (args?.status) params.set("status", args.status);
  if (args?.remediationPolicyKey) params.set("remediationPolicyKey", args.remediationPolicyKey);
  if (typeof args?.secretVersion === "number") params.set("secretVersion", String(args.secretVersion));
  if (typeof args?.callbackVersion === "number") params.set("callbackVersion", String(args.callbackVersion));
  if (args?.protocolMatch) params.set("protocolMatch", args.protocolMatch);
  if (args?.secretMatch) params.set("secretMatch", args.secretMatch);
  if (args?.retryability) params.set("retryability", args.retryability);
  if (args?.autoRemediationReasonCategory) {
    params.set("autoRemediationReasonCategory", args.autoRemediationReasonCategory);
  }
  if (args?.autoRemediationReasonDisposition) {
    params.set("autoRemediationReasonDisposition", args.autoRemediationReasonDisposition);
  }
  if (args?.replayPayloadCompatibility) {
    params.set("replayPayloadCompatibility", args.replayPayloadCompatibility);
  }
  if (typeof args?.replayPayloadReplayable === "boolean") {
    params.set("replayPayloadReplayable", args.replayPayloadReplayable ? "true" : "false");
  }
  if (args?.decisionClass) params.set("decisionClass", args.decisionClass);
  if (args?.replayFailureClass) params.set("replayFailureClass", args.replayFailureClass);
  if (args?.runtimeDecisionClass) params.set("runtimeDecisionClass", args.runtimeDecisionClass);
  if (args?.runtimeDecisionSeverity) params.set("runtimeDecisionSeverity", args.runtimeDecisionSeverity);
  if (args?.runtimePressureLevel) params.set("runtimePressureLevel", args.runtimePressureLevel);
  if (args?.runtimeSchedulingDecisionClass) {
    params.set("runtimeSchedulingDecisionClass", args.runtimeSchedulingDecisionClass);
  }
  if (args?.rejectionCategory) params.set("rejectionCategory", args.rejectionCategory);
  if (args?.limit) params.set("limit", String(args.limit));
  return params.toString();
}

function buildAgentExecutionRunQueryString(args?: AgentExecutionRunQueryArgs) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.ownerUserId) params.set("ownerUserId", args.ownerUserId);
  if (args?.executionIds?.length) params.set("executionIds", args.executionIds.join(","));
  if (args?.runIds?.length) params.set("runIds", args.runIds.join(","));
  if (args?.runKind) params.set("runKind", args.runKind);
  if (args?.runStatus) params.set("runStatus", args.runStatus);
  if (args?.executionStatus) params.set("executionStatus", args.executionStatus);
  if (args?.failureCategory) params.set("failureCategory", args.failureCategory);
  if (args?.recentWindow) params.set("recentWindow", args.recentWindow);
  if (args?.limit) params.set("limit", String(args.limit));
  return params.toString();
}

async function coreRequest<T>(pathname: string, options: CoreRequestOptions = {}): Promise<T> {
  const hasJsonBody = options.body !== undefined;
  const response = await fetchInternal(`${coreInternalUrl}${pathname}`, {
    targetService: "core",
    method: options.method || "GET",
    headers: buildHeaders(options.userContext, hasJsonBody),
    body: hasJsonBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    timeoutMs: coreRequestTimeoutMs,
  });

  if (!response.ok) {
    const classified = await classifyInternalDependencyError(response, {
      targetService: "core",
      fallbackMessage: `Core request failed: ${pathname}`,
    });
    const message = classified.publicMessage;
    const error = new Error(message) as CoreRequestError;
    error.code = classified.code as ApiErrorPayload["code"] | undefined;
    error.status = classified.status;
    error.statusCode = classified.status;
    error.category = classified.category;
    error.service = classified.service;
    error.requestId = classified.requestId;
    error.correlationId = classified.correlationId;
    error.occurredAt = classified.occurredAt;
    error.retryable = classified.retryable;
    error.diagnostics = classified.diagnostics;
    error.publicMessage = classified.publicMessage;
    throw error;
  }

  return (await response.json()) as T;
}

function normalizeOpinionTopicView(raw: OpinionTopicView): OpinionTopicView {
  return {
    ...raw,
    tags: Array.isArray((raw as Partial<OpinionTopicView>).tags)
      ? (((raw as Partial<OpinionTopicView>).tags ?? []) as OpinionTopicTag[])
      : [],
  };
}

function normalizeOpinionTopicListView(raw: Partial<OpinionTopicListView> | null | undefined): OpinionTopicListView {
  const topics = Array.isArray(raw?.topics) ? raw.topics.map((topic) => normalizeOpinionTopicView(topic)) : [];
  const pageSize =
    typeof raw?.pageSize === "number" && Number.isFinite(raw.pageSize) && raw.pageSize > 0
      ? Math.floor(raw.pageSize)
      : 10;
  const totalCount =
    typeof raw?.totalCount === "number" && Number.isFinite(raw.totalCount) && raw.totalCount >= 0
      ? Math.floor(raw.totalCount)
      : topics.length;
  const totalPages =
    typeof raw?.totalPages === "number" && Number.isFinite(raw.totalPages) && raw.totalPages > 0
      ? Math.floor(raw.totalPages)
      : Math.max(1, Math.ceil(Math.max(1, totalCount) / Math.max(1, pageSize)));
  const page =
    typeof raw?.page === "number" && Number.isFinite(raw.page) && raw.page > 0
      ? Math.floor(raw.page)
      : 1;

  return {
    monthlyLeaders: Array.isArray(raw?.monthlyLeaders) ? raw.monthlyLeaders : [],
    page,
    pageSize,
    sort:
      raw?.sort === "supportRate" || raw?.sort === "createdAt" || raw?.sort === "governance"
        ? raw.sort
        : "supportRate",
    topics,
    totalCount,
    totalPages,
  };
}

function normalizeOpinionTopicDetailView(raw: Partial<OpinionTopicDetailView> | null | undefined): OpinionTopicDetailView | null {
  if (!raw?.topic) {
    return null;
  }

  return {
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    topic: normalizeOpinionTopicView(raw.topic),
  };
}

function unavailableFeatureSnapshot(): FeatureSnapshot {
  return Object.fromEntries(
    featureModuleKeys.map((moduleKey) => [
      moduleKey,
      {
        moduleKey,
        enabled: false,
        rolloutNote: FEATURE_SNAPSHOT_UNAVAILABLE_NOTE,
        updatedAt: new Date().toISOString(),
      },
    ]),
  ) as FeatureSnapshot;
}

export function isFeatureSnapshotUnavailable(features: FeatureSnapshot): boolean {
  return Object.values(features).every(
    (feature) => feature.enabled === false && feature.rolloutNote === FEATURE_SNAPSHOT_UNAVAILABLE_NOTE,
  );
}

export async function upsertLinuxDoUser(profile: LinuxDoUpsertInput): Promise<LinuxDoUpsertResult> {
  return coreRequest<LinuxDoUpsertResult>("/internal/identity/linuxdo-upsert", {
    method: "POST",
    body: profile,
  });
}

export async function getFeatureSnapshot(): Promise<FeatureSnapshot> {
  try {
    const response = await coreRequest<{ modules: FeatureSnapshot }>("/internal/features");
    return response.modules;
  } catch {
    return unavailableFeatureSnapshot();
  }
}

export async function getPublicSurfaceSnapshotStrict(): Promise<PublicSurfaceSnapshot> {
  const response = await coreRequest<{ surfaces: PublicSurfaceSnapshot }>("/internal/public-surfaces");
  return response.surfaces;
}

export async function updatePublicSurfaceSnapshot(
  surfaces: Array<{ surfaceKey: PublicSurfaceKey; enabled: boolean }>,
): Promise<PublicSurfaceSnapshot> {
  const response = await coreRequest<{ surfaces: PublicSurfaceSnapshot }>("/internal/public-surfaces", {
    method: "POST",
    body: { surfaces },
  });
  return response.surfaces;
}

export async function getCurrentUser(userContext: InternalUserContext) {
  const response = await coreRequest<{ user: UserSummary | null }>("/v1/me", {
    userContext,
  });
  return response.user;
}

export async function getWalletSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ wallet: WalletSummary }>("/v1/wallet", {
    userContext,
  });
  return response.wallet;
}

export async function exchangeWallet(userContext: InternalUserContext, payload: WalletExchangeInput) {
  const response = await coreRequest<{ exchange: WalletExchangeResult }>("/v1/wallet/exchange", {
    method: "POST",
    userContext,
    body: payload,
  });
  return response.exchange;
}

export async function getReputationSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ reputation: ReputationSummary | null }>("/v1/reputation", {
    userContext,
  });
  return response.reputation;
}

export async function getReputationBreakdown(userContext: InternalUserContext) {
  const response = await coreRequest<{ breakdown: ReputationBreakdown | null }>("/v1/reputation/breakdown", {
    userContext,
  });
  return response.breakdown;
}

export async function listReputationHistory(userContext: InternalUserContext, limit = 10) {
  const response = await coreRequest<{ history: ReputationHistoryPoint[] }>(`/v1/reputation/history?limit=${limit}`, {
    userContext,
  });
  return response.history;
}

export async function getOpinionTopicCollection(
  userContext: InternalUserContext,
  options?: {
    page?: number;
    pageSize?: number;
    sort?: OpinionTopicSortMode;
    topicTag?: OpinionTopicTag | "all";
    topicStatus?: OpinionTopicView["status"] | "all";
  },
) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.sort) params.set("sort", options.sort);
  if (options?.topicTag && options.topicTag !== "all") params.set("topicTag", options.topicTag);
  if (options?.topicStatus) params.set("topicStatus", options.topicStatus);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await coreRequest<Partial<OpinionTopicListView>>(`/v1/opinions/topics${suffix}`, {
    userContext,
  });
  return normalizeOpinionTopicListView(response);
}

export async function listOpinionTopics(userContext: InternalUserContext) {
  const response = await getOpinionTopicCollection(userContext, {
    page: 1,
    pageSize: 50,
    sort: "governance",
  });
  return response.topics;
}

export async function getOpinionTopicDetail(userContext: InternalUserContext, topicId: string) {
  const response = await coreRequest<{ detail?: Partial<OpinionTopicDetailView> } | Partial<OpinionTopicDetailView>>(
    `/v1/opinions/topics/${encodeURIComponent(topicId)}`,
    {
      userContext,
    },
  );
  const normalizedSource: Partial<OpinionTopicDetailView> | null =
    response && typeof response === "object" && "detail" in response
      ? ((response.detail ?? null) as Partial<OpinionTopicDetailView> | null)
      : (response as Partial<OpinionTopicDetailView>);
  return normalizeOpinionTopicDetailView(normalizedSource);
}

export async function listOpinionTopicSupportSummaries(userContext: InternalUserContext) {
  const response = await coreRequest<{ supportSummaries: OpinionTopicSupportSummaryView[] }>(
    "/v1/opinions/topics/support-summary",
    {
      userContext,
    },
  );
  return response.supportSummaries;
}

export async function listOpinionTopicOpposeSummaries(userContext: InternalUserContext) {
  const response = await coreRequest<{ opposeSummaries: OpinionTopicOpposeSummaryView[] }>(
    "/v1/opinions/topics/oppose-summary",
    {
      userContext,
    },
  );
  return response.opposeSummaries;
}

export async function listPublishedAccountAnnouncements(userContext: InternalUserContext | null) {
  const response = await coreRequest<{ announcements: AccountAnnouncementView[] }>("/v1/announcements", {
    userContext,
  });
  return response.announcements;
}

export async function listOperatorAccountAnnouncements(userContext: InternalUserContext) {
  const response = await coreRequest<{ announcements: AccountAnnouncementView[] }>("/v1/internal/announcements", {
    userContext,
  });
  return response.announcements;
}

export async function createOperatorAccountAnnouncement(
  userContext: InternalUserContext,
  input: UpsertAccountAnnouncementInput,
) {
  const response = await coreRequest<{ announcement: AccountAnnouncementView }>("/v1/internal/announcements", {
    method: "POST",
    userContext,
    body: input,
  });
  return response.announcement;
}

export async function updateOperatorAccountAnnouncement(
  userContext: InternalUserContext,
  announcementId: string,
  input: UpsertAccountAnnouncementInput,
) {
  const response = await coreRequest<{ announcement: AccountAnnouncementView }>(
    `/v1/internal/announcements/${encodeURIComponent(announcementId)}`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.announcement;
}

export async function deleteOperatorAccountAnnouncement(userContext: InternalUserContext, announcementId: string) {
  await coreRequest<{ ok: true }>(
    `/v1/internal/announcements/${encodeURIComponent(announcementId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function createOpinionTopic(userContext: InternalUserContext, input: CreateOpinionTopicInput) {
  const response = await coreRequest<{ topic: OpinionTopicView }>("/v1/opinions/topics", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.topic;
}

export async function createOpinionTopicComment(
  userContext: InternalUserContext,
  topicId: string,
  input: Omit<CreateOpinionTopicCommentInput, "topicId">,
) {
  const response = await coreRequest<{ detail: OpinionTopicDetailView }>(
    `/v1/opinions/topics/${encodeURIComponent(topicId)}/comments`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.detail;
}

export async function supportOpinionTopic(userContext: InternalUserContext, topicId: string, ticketAmount: number) {
  const response = await coreRequest<{ topic: OpinionTopicView }>(`/v1/opinions/topics/${topicId}/support`, {
    method: "POST",
    body: { ticketAmount },
    userContext,
  });
  return response.topic;
}

export async function opposeOpinionTopic(userContext: InternalUserContext, topicId: string, ticketAmount: number) {
  const body: OpposeOpinionTopicInput = { topicId, ticketAmount };
  const response = await coreRequest<{ topic: OpinionTopicView }>(`/v1/opinions/topics/${topicId}/oppose`, {
    method: "POST",
    body,
    userContext,
  });
  return response.topic;
}

export async function archiveOpinionTopic(userContext: InternalUserContext, topicId: string) {
  const response = await coreRequest<{ topic: OpinionTopicView }>(`/v1/opinions/topics/${topicId}/archive`, {
    method: "POST",
    userContext,
  });
  return response.topic;
}

export async function adoptOpinionTopic(userContext: InternalUserContext, topicId: string) {
  const response = await coreRequest<{ topic: OpinionTopicView }>(`/v1/opinions/topics/${topicId}/adopt`, {
    method: "POST",
    userContext,
  });
  return response.topic;
}

export async function getOpinionHubSettingsInternal(userContext: InternalUserContext) {
  const response = await coreRequest<{ settings: OpinionHubSettingsView }>("/v1/internal/opinions/settings", {
    userContext,
  });
  return response.settings;
}

export async function updateOpinionHubSettingsInternal(
  userContext: InternalUserContext,
  input: UpdateOpinionHubSettingsInput,
) {
  const response = await coreRequest<{ settings: OpinionHubSettingsView }>("/v1/internal/opinions/settings", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.settings;
}

export async function getOperatorOpinionTopicCollection(
  userContext: InternalUserContext,
  options?: {
    page?: number;
    pageSize?: number;
    sort?: OpinionTopicSortMode;
    topicTag?: OpinionTopicTag | "all";
    topicStatus?: OpinionTopicView["status"] | "all";
    reviewStatus?: OpinionTopicReviewStatus | "all";
  },
) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.sort) params.set("sort", options.sort);
  if (options?.topicTag && options.topicTag !== "all") params.set("topicTag", options.topicTag);
  if (options?.topicStatus) params.set("topicStatus", options.topicStatus);
  if (options?.reviewStatus) params.set("reviewStatus", options.reviewStatus);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await coreRequest<Partial<OpinionTopicListView>>(`/v1/internal/opinions/topics${suffix}`, {
    userContext,
  });
  return normalizeOpinionTopicListView(response);
}

export async function getOperatorOpinionTopicDetail(userContext: InternalUserContext, topicId: string) {
  const response = await coreRequest<{ detail?: Partial<OpinionTopicDetailView> } | Partial<OpinionTopicDetailView>>(
    `/v1/internal/opinions/topics/${encodeURIComponent(topicId)}`,
    {
      userContext,
    },
  );
  const normalizedSource: Partial<OpinionTopicDetailView> | null =
    response && typeof response === "object" && "detail" in response
      ? ((response.detail ?? null) as Partial<OpinionTopicDetailView> | null)
      : (response as Partial<OpinionTopicDetailView>);
  return normalizeOpinionTopicDetailView(normalizedSource);
}

export async function moderateOpinionTopicInternal(
  userContext: InternalUserContext,
  topicId: string,
  input: ModerateOpinionTopicInput,
) {
  const response = await coreRequest<{ topic: OpinionTopicView }>(
    `/v1/internal/opinions/topics/${encodeURIComponent(topicId)}/moderate`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.topic;
}

export async function runOpinionMonthlyLeaderSettlementInternal(
  userContext: InternalUserContext,
  limit = 10,
) {
  const response = await coreRequest<{ result: OpinionMonthlySettlementResultView }>(
    "/v1/internal/opinions/monthly-leaders/run",
    {
      method: "POST",
      body: { limit },
      userContext,
    },
  );
  return response.result;
}

export async function listOpinionMonthlySettlementRunsInternal(
  userContext: InternalUserContext,
  limit = 12,
) {
  const response = await coreRequest<{ runs: OpinionMonthlySettlementRunView[] }>(
    `/v1/internal/opinions/monthly-leaders/runs?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.runs;
}

export async function getOpinionMonthlySettlementRunDetailInternal(
  userContext: InternalUserContext,
  monthKey: string,
) {
  const response = await coreRequest<{ detail: OpinionMonthlySettlementRunDetailView }>(
    `/v1/internal/opinions/monthly-leaders/${encodeURIComponent(monthKey)}`,
    {
      userContext,
    },
  );
  return response.detail;
}

export async function updateOpinionMonthlySettlementItemDecisionInternal(
  userContext: InternalUserContext,
  monthKey: string,
  itemId: string,
  input: UpdateOpinionMonthlySettlementItemInput,
) {
  const response = await coreRequest<{ detail: OpinionMonthlySettlementRunDetailView }>(
    `/v1/internal/opinions/monthly-leaders/${encodeURIComponent(monthKey)}/items/${encodeURIComponent(itemId)}/decision`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.detail;
}

export async function listAgents(userContext: InternalUserContext) {
  const response = await coreRequest<{ agents: AgentView[] }>("/v1/agents", {
    userContext,
  });
  return response.agents;
}

export async function listAgentMarketplaceListings(
  userContext: InternalUserContext,
  scope: "owner" | "public" = "owner",
  limit?: number,
) {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  const response = await coreRequest<{ listings: AgentMarketplaceListingView[] }>(
    `/v1/agents/marketplace/listings?${params.toString()}`,
    {
      userContext,
    },
  );
  return response.listings;
}

export async function listPublicAgentMarketplaceListingsByAgentIds(
  agentIds: string[],
  perAgentLimit = 2,
) {
  const normalizedAgentIds = [...new Set(agentIds.map((value) => value.trim()).filter(Boolean))].slice(0, 24);
  if (normalizedAgentIds.length === 0) {
    return [] as AgentMarketplaceListingView[];
  }
  const params = new URLSearchParams();
  params.set("agentIds", normalizedAgentIds.join(","));
  params.set("perAgentLimit", String(Math.max(1, Math.min(perAgentLimit, 6))));
  const response = await coreRequest<{ listings: AgentMarketplaceListingView[] }>(
    `/v1/public/agents/marketplace/listings?${params.toString()}`,
  );
  return response.listings;
}

export async function listSuppliedAgentMarketplaceExecutions(
  userContext: InternalUserContext,
  limit = 20,
) {
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const response = await coreRequest<{ executions: AgentExecutionView[] }>(
    `/v1/agents/marketplace/supplier-executions?limit=${encodeURIComponent(String(boundedLimit))}`,
    {
      userContext,
    },
  );
  return response.executions;
}

export async function invokeAgentMarketplaceListing(
  userContext: InternalUserContext,
  listingId: string,
  input: InvokeAgentMarketplaceListingInput,
) {
  const response = await coreRequest<{ result: InvokeAgentMarketplaceListingResult }>(
    `/v1/agents/marketplace/listings/${encodeURIComponent(listingId)}/invoke`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function listAgentCallbackHealthSummaries(
  userContext: InternalUserContext,
  windowHours = 168,
) {
  const response = await coreRequest<{ summaries: AgentCallbackHealthSummaryView[] }>(
    `/v1/agents/callback-health?windowHours=${encodeURIComponent(String(windowHours))}`,
    {
      userContext,
    },
  );
  return response.summaries;
}

export async function listAgentCallbackRemediationPolicies(userContext: InternalUserContext) {
  const response = await coreRequest<{ policies: AgentCallbackRemediationPolicyView[] }>(
    "/v1/agents/callback-remediation-policies",
    {
      userContext,
    },
  );
  return response.policies;
}

export async function getAgentCallbackCompatibilitySummary(
  userContext: InternalUserContext,
) {
  const response = await coreRequest<{ summary: AgentCallbackCompatibilitySummaryView }>(
    "/v1/internal/agents/callback-compatibility/summary",
    {
      userContext,
    },
  );
  return response.summary;
}

export async function cleanupExpiredAgentCallbackCompatibility(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  const response = await coreRequest<{ result: AgentCallbackCompatibilityCleanupResult }>(
    "/v1/internal/agents/callback-compatibility/cleanup-expired",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function listAgentRecentCallbacks(
  userContext: InternalUserContext,
  agentId: string,
  limit = 5,
) {
  const response = await coreRequest<{ callbacks: AgentRecentCallbackView[] }>(
    `/v1/agents/${encodeURIComponent(agentId)}/recent-callbacks?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.callbacks;
}

export async function listArbitrationCases(userContext: InternalUserContext) {
  const response = await coreRequest<{ cases: ArbitrationCaseView[] }>("/v1/arbitrations/cases", {
    userContext,
  });
  return response.cases;
}

export async function getArbitrationCaseSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: ArbitrationCaseSummaryView }>("/v1/arbitrations/cases/summary", {
    userContext,
  });
  return response.summary;
}

export async function getArbitrationCaseWorkload(userContext: InternalUserContext) {
  const response = await coreRequest<{ workload: ArbitrationWorkloadView }>("/v1/arbitrations/cases/workload", {
    userContext,
  });
  return response.workload;
}

export async function getArbitrationRemoteAttachmentCleanupQueue(
  userContext: InternalUserContext,
  args?: { limit?: number },
) {
  const params = new URLSearchParams();
  if (typeof args?.limit === "number") params.set("limit", String(args.limit));
  const response = await coreRequest<{ queue: ArbitrationRemoteAttachmentCleanupQueueView }>(
    `/v1/internal/arbitrations/attachments/cleanup-queue${params.size > 0 ? `?${params.toString()}` : ""}`,
    {
      userContext,
    },
  );
  return response.queue;
}

export async function createArbitrationCase(
  userContext: InternalUserContext,
  input: CreateArbitrationCaseInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>("/v1/arbitrations/cases", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.case;
}

export async function addArbitrationEvidence(
  userContext: InternalUserContext,
  caseId: string,
  input: CreateArbitrationEvidenceInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${caseId}/evidences`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function addArbitrationEvidenceAttachment(
  userContext: InternalUserContext,
  evidenceId: string,
  input: UploadArbitrationEvidenceAttachmentInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/evidences/${evidenceId}/attachments`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function prepareArbitrationEvidenceAttachmentUpload(
  userContext: InternalUserContext,
  evidenceId: string,
  input: PrepareArbitrationEvidenceAttachmentUploadInput,
) {
  const response = await coreRequest<{
    case: ArbitrationCaseView;
    upload: ArbitrationEvidenceAttachmentUploadPlanView;
  }>(`/v1/arbitrations/evidences/${evidenceId}/attachments/prepare-upload`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response;
}

export async function completeArbitrationEvidenceAttachmentUpload(
  userContext: InternalUserContext,
  attachmentId: string,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/attachments/${attachmentId}/complete-upload`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function archiveArbitrationEvidenceAttachment(userContext: InternalUserContext, attachmentId: string) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/attachments/${attachmentId}/cleanup`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function requestArbitrationEvidenceAttachmentCleanup(
  userContext: InternalUserContext,
  attachmentId: string,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/attachments/${attachmentId}/request-cleanup`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function updateArbitrationCaseStatus(
  userContext: InternalUserContext,
  caseId: string,
  input: UpdateArbitrationCaseStatusInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${caseId}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function claimArbitrationCase(userContext: InternalUserContext, caseId: string) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${caseId}/claim`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function assignArbitrationCase(
  userContext: InternalUserContext,
  caseId: string,
  input: { assigneeUserId: string },
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${caseId}/assign`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function claimNextArbitrationCase(userContext: InternalUserContext) {
  const response = await coreRequest<{ case: ArbitrationCaseView | null }>("/v1/arbitrations/cases/claim-next", {
    method: "POST",
    userContext,
  });
  return response.case;
}

export async function releaseArbitrationCase(userContext: InternalUserContext, caseId: string) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${caseId}/release`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.case;
}

export async function releaseStaleArbitrationCases(userContext: InternalUserContext, input?: { limit?: number }) {
  return coreRequest<{ result: { scannedCount: number; releasedCount: number; caseIds: string[] } }>(
    "/v1/internal/arbitrations/cases/release-stale",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
}

export async function cleanupResolvedRemoteArbitrationAttachments(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  return coreRequest<{
    result: {
      scannedCount: number;
      archivedCount: number;
      failedCount: number;
      failures: Array<{ attachmentId: string; message: string }>;
    };
  }>("/v1/internal/arbitrations/attachments/cleanup-remote", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
}

export async function advanceArbitrationReviewRound(
  userContext: InternalUserContext,
  caseId: string,
  input: AdvanceArbitrationReviewRoundInput,
) {
  const response = await coreRequest<{ case: ArbitrationCaseView }>(
    `/v1/arbitrations/cases/${caseId}/review-rounds/advance`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.case;
}

export async function listAgentExecutions(userContext: InternalUserContext) {
  const response = await coreRequest<{ executions: AgentExecutionView[] }>("/v1/agent-executions", {
    userContext,
  });
  return response.executions;
}

export async function listAgentExecutionCallbackAudits(
  userContext: InternalUserContext,
  args?: CallbackAuditQueryArgs,
) {
  const query = buildCallbackAuditQueryString(args);
  const response = await coreRequest<{ callbacks: AgentExecutionCallbackAuditView[] }>(
    `/v1/internal/agent-executions/callback-audits${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.callbacks;
}

export async function getAgentExecutionCallbackAuditSummary(
  userContext: InternalUserContext,
  args?: CallbackAuditQueryArgs,
) {
  const query = buildCallbackAuditQueryString(args);
  const response = await coreRequest<{ summary: AgentExecutionCallbackAuditSummaryView }>(
    `/v1/internal/agent-executions/callback-audits/summary${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function getAgentExecutionCallbackRemediationSummary(
  userContext: InternalUserContext,
  args?: {
    agentId?: string;
    callbackType?: "status" | "artifact" | "heartbeat" | "callback";
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
  },
) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.callbackType) params.set("callbackType", args.callbackType);
  if (args?.remediationPolicyKey) params.set("remediationPolicyKey", args.remediationPolicyKey);
  if (args?.autoRemediationReasonCategory) {
    params.set("autoRemediationReasonCategory", args.autoRemediationReasonCategory);
  }
  if (args?.autoRemediationReasonDisposition) {
    params.set("autoRemediationReasonDisposition", args.autoRemediationReasonDisposition);
  }
  if (args?.replayPayloadCompatibility) {
    params.set("replayPayloadCompatibility", args.replayPayloadCompatibility);
  }
  if (typeof args?.replayPayloadReplayable === "boolean") {
    params.set("replayPayloadReplayable", args.replayPayloadReplayable ? "true" : "false");
  }
  if (args?.decisionClass) params.set("decisionClass", args.decisionClass);
  if (args?.replayFailureClass) params.set("replayFailureClass", args.replayFailureClass);
  if (args?.runtimeDecisionClass) params.set("runtimeDecisionClass", args.runtimeDecisionClass);
  if (args?.runtimeDecisionSeverity) params.set("runtimeDecisionSeverity", args.runtimeDecisionSeverity);
  if (args?.runtimePressureLevel) params.set("runtimePressureLevel", args.runtimePressureLevel);
  if (args?.runtimeSchedulingDecisionClass) {
    params.set("runtimeSchedulingDecisionClass", args.runtimeSchedulingDecisionClass);
  }
  const query = params.toString();
  const response = await coreRequest<{ summary: AgentExecutionCallbackRemediationSummaryView }>(
    `/v1/internal/agent-executions/callback-audits/remediation-summary${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function emitAgentExecutionCallbackRemediationAlerts(
  userContext: InternalUserContext,
  input?: {
    agentId?: string;
    callbackType?: "status" | "artifact" | "heartbeat" | "callback";
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
    minimumAlertLevel?: number;
    limit?: number;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackRemediationAlertDispatchResult }>(
    "/v1/internal/agent-executions/callback-audits/emit-alerts",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function autoRemediateRejectedCallbackPayloads(
  userContext: InternalUserContext,
  input?: {
    agentId?: string;
    callbackType?: "status" | "artifact" | "heartbeat" | "callback";
    remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
    callbackVersion?: number;
    secretVersion?: number;
    protocolMatch?: "current" | "previous";
    secretMatch?: "current" | "previous";
    rejectionCategory?:
      | "invalid_secret"
      | "invalid_signature"
      | "invalid_timestamp"
      | "invalid_version"
      | "invalid_payload"
      | "processing_conflict"
      | "unsupported_target"
      | "unknown";
    retryability?: "retryable" | "inspect" | "not_retryable";
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
    note?: string;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackAutoRemediationResult }>(
    "/v1/internal/agent-executions/callback-audits/auto-remediate",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function getAgentExecutionRuntimePressureAlertSummary(
  userContext: InternalUserContext,
  args?: {
    pressureLevel?: AgentExecutionRuntimePressureLevel;
    schedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
  },
) {
  const params = new URLSearchParams();
  if (args?.pressureLevel) params.set("pressureLevel", args.pressureLevel);
  if (args?.schedulingDecisionClass) params.set("schedulingDecisionClass", args.schedulingDecisionClass);
  const query = params.toString();
  const response = await coreRequest<{ summary: AgentExecutionRuntimePressureAlertSummaryView }>(
    `/v1/internal/agent-executions/runtime-alerts/summary${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function emitAgentExecutionRuntimePressureAlerts(
  userContext: InternalUserContext,
  input?: {
    pressureLevel?: AgentExecutionRuntimePressureLevel;
    schedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
    minimumAlertLevel?: number;
    limit?: number;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionRuntimePressureAlertDispatchResult }>(
    "/v1/internal/agent-executions/runtime-alerts/emit-alerts",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function requestRejectedCallbackRetry(
  userContext: InternalUserContext,
  auditId: string,
  input?: { note?: string },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackRetryRequestResult }>(
    `/v1/internal/agent-executions/callback-audits/${encodeURIComponent(auditId)}/request-retry`,
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function requestRejectedCallbackRetryBatch(
  userContext: InternalUserContext,
  input?: {
    agentId?: string;
    callbackType?: "status" | "artifact" | "heartbeat" | "callback";
    remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
    callbackVersion?: number;
    secretVersion?: number;
    protocolMatch?: "current" | "previous";
    secretMatch?: "current" | "previous";
    retryability?: "retryable" | "inspect" | "not_retryable";
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
    rejectionCategory?:
      | "invalid_secret"
      | "invalid_signature"
      | "invalid_timestamp"
      | "invalid_version"
      | "invalid_payload"
      | "processing_conflict"
      | "unsupported_target"
      | "unknown";
    limit?: number;
    note?: string;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackRetryBatchResult }>(
    "/v1/internal/agent-executions/callback-audits/request-retry-batch",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function replayRejectedCallbackPayload(
  userContext: InternalUserContext,
  auditId: string,
  input?: { note?: string },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackReplayResult }>(
    `/v1/internal/agent-executions/callback-audits/${encodeURIComponent(auditId)}/replay-payload`,
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function listAgentExecutionRunsForOperator(
  userContext: InternalUserContext,
  args?: AgentExecutionRunQueryArgs,
) {
  const query = buildAgentExecutionRunQueryString(args);
  const response = await coreRequest<{ runs: AgentExecutionOperatorRunView[] }>(
    `/v1/internal/agent-executions/runs${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.runs;
}

export async function getAgentExecutionRunSummaryForOperator(
  userContext: InternalUserContext,
  args?: AgentExecutionRunQueryArgs,
) {
  const query = buildAgentExecutionRunQueryString(args);
  const response = await coreRequest<{ summary: AgentExecutionOperatorRunSummaryView }>(
    `/v1/internal/agent-executions/runs/summary${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function getAgentExecutionRuntimeSessionSummary(
  userContext: InternalUserContext,
  args?: {
    agentId?: string;
    ownerUserId?: string;
    state?: "running" | "completed" | "failed" | "requeued";
    kind?: "platform_executor" | "stale_recovery" | "owner_requeue";
    staleOnly?: boolean;
  },
) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.ownerUserId) params.set("ownerUserId", args.ownerUserId);
  if (args?.state) params.set("state", args.state);
  if (args?.kind) params.set("kind", args.kind);
  if (typeof args?.staleOnly === "boolean") params.set("staleOnly", args.staleOnly ? "true" : "false");
  const response = await coreRequest<{ summary: AgentExecutionRuntimeSessionSummaryView }>(
    `/v1/internal/agent-executions/runtime-sessions/summary${params.size > 0 ? `?${params.toString()}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function getAgentExecutionRuntimeCatalog(userContext: InternalUserContext) {
  const response = await coreRequest<{ catalog: AgentExecutionRuntimeCatalogView }>(
    "/v1/agent-executions/runtime-catalog",
    {
      userContext,
    },
  );
  return response.catalog;
}

export async function listAgentExecutionSettlementAttempts(
  userContext: InternalUserContext,
  args?: { status?: AgentExecutionSettlementAttemptStatus; limit?: number },
) {
  const params = new URLSearchParams();
  if (args?.status) params.set("status", args.status);
  if (typeof args?.limit === "number") params.set("limit", String(args.limit));
  const response = await coreRequest<{ settlements: AgentExecutionSettlementAttemptView[] }>(
    `/v1/internal/agent-executions/settlements${params.size > 0 ? `?${params.toString()}` : ""}`,
    { userContext },
  );
  return response.settlements;
}

export async function getAgentExecutionSettlementSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: AgentExecutionSettlementSummaryView }>(
    "/v1/internal/agent-executions/settlements/summary",
    { userContext },
  );
  return response.summary;
}

export async function retryAgentExecutionSettlement(userContext: InternalUserContext, executionId: string) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/internal/agent-executions/settlements/${executionId}/retry`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.execution;
}

export async function listAgentExecutionRuntimeSessions(
  userContext: InternalUserContext,
  args?: {
    agentId?: string;
    ownerUserId?: string;
    state?: "running" | "completed" | "failed" | "requeued";
    kind?: "platform_executor" | "stale_recovery" | "owner_requeue";
    staleOnly?: boolean;
    limit?: number;
  },
) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.ownerUserId) params.set("ownerUserId", args.ownerUserId);
  if (args?.state) params.set("state", args.state);
  if (args?.kind) params.set("kind", args.kind);
  if (typeof args?.staleOnly === "boolean") params.set("staleOnly", args.staleOnly ? "true" : "false");
  if (typeof args?.limit === "number") params.set("limit", String(args.limit));
  const response = await coreRequest<{ sessions: AgentExecutionRuntimeSessionView[] }>(
    `/v1/internal/agent-executions/runtime-sessions${params.size > 0 ? `?${params.toString()}` : ""}`,
    { userContext },
  );
  return response.sessions;
}

export async function sweepAgentExecutionRuntimeSessions(
  userContext: InternalUserContext,
  input?: {
    limit?: number;
    staleSeconds?: number;
    agentId?: string;
    ownerUserId?: string;
    state?: "running" | "completed" | "failed" | "requeued";
    kind?: "platform_executor" | "stale_recovery" | "owner_requeue";
    staleOnly?: boolean;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionRuntimeSessionSweepResult }>(
    "/v1/internal/agent-executions/runtime-sessions/sweep",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function listAgentExecutionLaunchPresets(
  userContext: InternalUserContext,
  input?: ListAgentExecutionLaunchPresetsInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size > 0 ? `/v1/agent-executions/presets?${params.toString()}` : "/v1/agent-executions/presets";
  const response = await coreRequest<{ presets: AgentExecutionLaunchPresetView[] }>(pathname, {
    userContext,
  });
  return response.presets;
}

export async function createAgentExecutionLaunchPreset(
  userContext: InternalUserContext,
  input: CreateAgentExecutionLaunchPresetInput,
) {
  const response = await coreRequest<{ preset: AgentExecutionLaunchPresetView }>("/v1/agent-executions/presets", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.preset;
}

export async function updateAgentExecutionLaunchPreset(
  userContext: InternalUserContext,
  presetId: string,
  input: UpdateAgentExecutionLaunchPresetInput,
) {
  const response = await coreRequest<{ preset: AgentExecutionLaunchPresetView }>(
    `/v1/agent-executions/presets/${encodeURIComponent(presetId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.preset;
}

export async function setAgentExecutionLaunchPresetAsDefault(userContext: InternalUserContext, presetId: string) {
  const response = await coreRequest<{ preset: AgentExecutionLaunchPresetView }>(
    `/v1/agent-executions/presets/${encodeURIComponent(presetId)}/default`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.preset;
}

export async function deleteAgentExecutionLaunchPreset(userContext: InternalUserContext, presetId: string) {
  await coreRequest<{ ok: true }>(`/v1/agent-executions/presets/${encodeURIComponent(presetId)}/delete`, {
    method: "POST",
    userContext,
  });
}

export async function createAgentExecution(userContext: InternalUserContext, input: CreateAgentExecutionInput) {
  const response = await coreRequest<{ execution: AgentExecutionView }>("/v1/agent-executions", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.execution;
}

export async function updateAgentExecutionStatus(
  userContext: InternalUserContext,
  executionId: string,
  input: UpdateAgentExecutionStatusInput,
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function updateAgentExecutionCallbackRemediationPolicy(
  userContext: InternalUserContext,
  executionId: string,
  input: { policyKey?: "manual_only" | "safe_retry" | "balanced" | "aggressive" | null },
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/callback-remediation-policy`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function createAgentExecutionSubtask(
  userContext: InternalUserContext,
  executionId: string,
  input: CreateAgentExecutionSubtaskInput,
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/subtasks`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function updateAgentExecutionSubtaskStatus(
  userContext: InternalUserContext,
  executionId: string,
  subtaskId: string,
  input: UpdateAgentExecutionSubtaskStatusInput,
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/subtasks/${subtaskId}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function requeueAgentExecution(userContext: InternalUserContext, executionId: string) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/requeue`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.execution;
}

export async function recoverStalePlatformExecutions(
  userContext: InternalUserContext,
  input?: { limit?: number; staleSeconds?: number; agentId?: string; ownerUserId?: string },
) {
  return coreRequest<PlatformExecutionRecoveryResult>("/v1/internal/agent-executions/recover-stale", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
}

export async function runPlatformExecutorNow(
  userContext: InternalUserContext,
  input?: { limit?: number; agentId?: string; ownerUserId?: string },
) {
  return coreRequest<PlatformExecutionRunResult>("/v1/internal/agent-executions/run-platform-executor", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
}

export async function addAgentExecutionArtifact(
  userContext: InternalUserContext,
  executionId: string,
  input: AddAgentExecutionArtifactInput,
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/artifacts`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function createAgent(userContext: InternalUserContext, input: CreateAgentInput) {
  const response = await coreRequest<{ agent: AgentView }>("/v1/agents", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.agent;
}

export async function updateAgent(
  userContext: InternalUserContext,
  agentId: string,
  input: UpdateAgentInput,
) {
  const response = await coreRequest<{ agent: AgentView }>(`/v1/agents/${encodeURIComponent(agentId)}`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response.agent;
}

export async function deleteAgent(userContext: InternalUserContext, agentId: string) {
  const response = await coreRequest<{ deletedAgentId: string; deletedAgentName: string }>(
    `/v1/agents/${encodeURIComponent(agentId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
  return response;
}

export async function upsertAgentMarketplaceListing(
  userContext: InternalUserContext,
  input: UpsertAgentMarketplaceListingInput,
) {
  const response = await coreRequest<{ listing: AgentMarketplaceListingView }>("/v1/agents/marketplace/listings", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.listing;
}

export async function updateAgentMarketplaceListingStatus(
  userContext: InternalUserContext,
  listingId: string,
  input: UpdateAgentMarketplaceListingStatusInput,
) {
  const response = await coreRequest<{ listing: AgentMarketplaceListingView }>(
    `/v1/agents/marketplace/listings/${encodeURIComponent(listingId)}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.listing;
}

export async function runAgentMarketplaceAutoProposalSweep(
  userContext: InternalUserContext,
  limit?: number,
) {
  const response = await coreRequest<{ result: AgentMarketplaceAutoProposalSweepResult }>(
    "/v1/agents/marketplace/auto-proposals/sweep",
    {
      method: "POST",
      body: typeof limit === "number" ? { limit } : {},
      userContext,
    },
  );
  return response.result;
}

export async function listAgentCapabilities(userContext: InternalUserContext, agentId: string) {
  const response = await coreRequest<{ capabilities: AgentCapabilityView[] }>(`/v1/agents/${agentId}/capabilities`, {
    userContext,
  });
  return response.capabilities;
}

export async function listAgentCallbackHistory(
  userContext: InternalUserContext,
  agentId: string,
  limit = 20,
) {
  const response = await coreRequest<{ history: AgentCallbackConfigHistoryView[] }>(
    `/v1/agents/${agentId}/callback-history?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.history;
}

export async function listOperatorAgentCallbackHistory(
  userContext: InternalUserContext,
  agentId: string,
  limit = 20,
) {
  const response = await coreRequest<{ history: AgentCallbackConfigHistoryView[] }>(
    `/v1/internal/agents/${encodeURIComponent(agentId)}/callback-history?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.history;
}

export async function addAgentCapability(
  userContext: InternalUserContext,
  agentId: string,
  input: AddAgentCapabilityInput,
) {
  const response = await coreRequest<{ capability: AgentCapabilityView }>(`/v1/agents/${agentId}/capabilities`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response.capability;
}

export async function updateAgentCapability(
  userContext: InternalUserContext,
  agentId: string,
  capabilityId: string,
  input: UpdateAgentCapabilityInput,
) {
  const response = await coreRequest<{ capability: AgentCapabilityView }>(
    `/v1/agents/${encodeURIComponent(agentId)}/capabilities/${encodeURIComponent(capabilityId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.capability;
}

export async function rotateAgentCallbackSecret(userContext: InternalUserContext, agentId: string) {
  return coreRequest<RotateAgentCallbackSecretResult>(`/v1/agents/${agentId}/rotate-callback-secret`, {
    method: "POST",
    userContext,
  });
}

export async function updateAgentCallbackProtocolVersion(
  userContext: InternalUserContext,
  agentId: string,
  protocolVersion: number,
) {
  const response = await coreRequest<{ agent: AgentView }>(`/v1/agents/${agentId}/callback-protocol`, {
    method: "POST",
    body: { protocolVersion },
    userContext,
  });
  return response.agent;
}

export async function updateAgentCallbackRemediationPolicy(
  userContext: InternalUserContext,
  agentId: string,
  policyKey: AgentCallbackRemediationPolicyKey,
) {
  const response = await coreRequest<{ agent: AgentView }>(
    `/v1/agents/${encodeURIComponent(agentId)}/callback-remediation-policy`,
    {
      method: "POST",
      body: { policyKey },
      userContext,
    },
  );
  return response.agent;
}

export async function listProducts(userContext: InternalUserContext) {
  const response = await coreRequest<{ products: ProductListItem[] }>("/v1/products", {
    userContext,
  });
  return response.products;
}

export async function listOperatorProducts(userContext: InternalUserContext) {
  const response = await coreRequest<{ products: ProductOperatorView[] }>("/v1/internal/products", {
    userContext,
  });
  return response.products;
}

export async function listOperatorDiscountCodes(
  userContext: InternalUserContext,
  filters?: ListOperatorDiscountCodesInput,
) {
  const params = new URLSearchParams();
  if (filters?.productId) params.set("productId", filters.productId);
  if (filters?.state && filters.state !== "all") params.set("state", filters.state);
  if (filters?.scope && filters.scope !== "all") params.set("scope", filters.scope);
  if (filters?.audienceScope && filters.audienceScope !== "all") params.set("audienceScope", filters.audienceScope);
  if (filters?.namespace) params.set("namespace", filters.namespace);
  if (filters?.batchLabel) params.set("batchLabel", filters.batchLabel);
  if (typeof filters?.windowDays === "number") params.set("windowDays", String(filters.windowDays));
  const path = params.size > 0 ? `/v1/internal/discount-codes?${params.toString()}` : "/v1/internal/discount-codes";
  const response = await coreRequest<{ discountCodes: DiscountCodeOperatorView[] }>(path, {
    userContext,
  });
  return response.discountCodes;
}

export async function upsertOperatorProduct(
  userContext: InternalUserContext,
  productId: string,
  input: UpsertProductInput,
) {
  const response = await coreRequest<{ result: ProductOperatorMutationResult }>(
    `/v1/internal/products/${encodeURIComponent(productId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function deleteOperatorProduct(userContext: InternalUserContext, productId: string) {
  const response = await coreRequest<{ result: { productId: string; title: string } }>(
    `/v1/internal/products/${encodeURIComponent(productId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function upsertOperatorDiscountCode(
  userContext: InternalUserContext,
  discountCodeId: string,
  input: UpsertDiscountCodeInput,
) {
  const response = await coreRequest<{ result: DiscountCodeOperatorMutationResult }>(
    `/v1/internal/discount-codes/${encodeURIComponent(discountCodeId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function applyOperatorDiscountCodeBatch(
  userContext: InternalUserContext,
  input: ApplyDiscountCodeBatchInput,
) {
  const response = await coreRequest<{ result: DiscountCodeBatchMutationResult }>("/v1/internal/discount-codes/batch", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.result;
}

export async function listItems(userContext: InternalUserContext) {
  const response = await coreRequest<{ items: ItemView[] }>("/v1/items", {
    userContext,
  });
  return response.items;
}

export async function reportItemUnitIssue(
  userContext: InternalUserContext,
  itemId: string,
  unitId: string,
  reason: ItemUnitIssueReason,
) {
  return coreRequest<{ item: ItemView }>(`/v1/items/${itemId}/units/${unitId}/report-issue`, {
    method: "POST",
    body: { reason },
    userContext,
  });
}

export async function reconcileItem(userContext: InternalUserContext, itemId: string) {
  const response = await coreRequest<{ item: ItemView }>(`/v1/items/${itemId}/reconcile`, {
    method: "POST",
    userContext,
  });
  return response.item;
}

export async function listOpenItemManualReviews(userContext: InternalUserContext, args?: ManualReviewQueryArgs) {
  const params = new URLSearchParams();
  if (args?.routingCode) params.set("routingCode", args.routingCode);
  if (args?.suggestedAction) params.set("suggestedAction", args.suggestedAction);
  if (args?.status) params.set("status", args.status);
  if (args?.reason) params.set("reason", args.reason);
  if (args?.priority) params.set("priority", args.priority);
  if (args?.slaBucket) params.set("slaBucket", args.slaBucket);
  if (args?.rejectionCategory) params.set("rejectionCategory", args.rejectionCategory);
  if (args?.appealable) params.set("appealable", args.appealable);
  if (args?.assignee) params.set("assignee", args.assignee);
  if (args?.claimedAt) params.set("claimedAt", args.claimedAt);
  if (args?.limit) params.set("limit", String(args.limit));
  const query = params.toString();
  const response = await coreRequest<{ reviews: ItemManualReviewView[] }>(
    `/v1/internal/items/manual-reviews${query ? `?${query}` : ""}`,
    {
      userContext,
    },
  );
  return response.reviews;
}

export async function escalateFulfillmentAnomalies(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  return coreRequest<{
    result: {
      scannedCount: number;
      escalatedCount: number;
      unchangedCount: number;
      affectedIds: string[];
    };
  }>("/v1/internal/items/anomalies/escalate", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
}

export async function getOpenItemManualReviewSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: ItemManualReviewSummaryView }>(
    "/v1/internal/items/manual-reviews/summary",
    {
      userContext,
    },
  );
  return response.summary;
}

export async function getManualReviewWorkload(userContext: InternalUserContext) {
  const response = await coreRequest<{ workload: ManualReviewWorkloadView }>(
    "/v1/internal/items/manual-reviews/workload",
    {
      userContext,
    },
  );
  return response.workload;
}

export async function getManualReviewSlaSummary(
  userContext: InternalUserContext,
  args?: { assignee?: string; priority?: "normal" | "high" | "urgent" },
) {
  const params = new URLSearchParams();
  if (args?.assignee) params.set("assignee", args.assignee);
  if (args?.priority) params.set("priority", args.priority);
  const query = params.toString();
  const response = await coreRequest<{ summary: ManualReviewSlaSummaryView }>(
    `/v1/internal/items/manual-reviews/sla-summary${query ? `?${query}` : ""}`,
    {
      userContext,
    },
  );
  return response.summary;
}

export async function getFulfillmentOpsSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: FulfillmentOpsSummaryView }>(
    "/v1/internal/items/ops-summary",
    {
      userContext,
    },
  );
  return response.summary;
}

export async function resolveItemManualReview(
  userContext: InternalUserContext,
  reviewId: string,
  input: { action: "approve_replacement" | "reject_report"; resolutionNote?: string },
) {
  const response = await coreRequest<{ item: ItemView }>(
    `/v1/internal/items/manual-reviews/${encodeURIComponent(reviewId)}/resolve`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.item;
}

export async function claimItemManualReview(userContext: InternalUserContext, reviewId: string) {
  const response = await coreRequest<{ review: ItemManualReviewView }>(
    `/v1/internal/items/manual-reviews/${encodeURIComponent(reviewId)}/claim`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.review;
}

export async function claimNextItemManualReview(userContext: InternalUserContext) {
  return claimNextItemManualReviewWithTemplate(userContext, {});
}

export async function claimNextItemManualReviewWithTemplate(
  userContext: InternalUserContext,
  input?: { templateKey?: string | null },
) {
  const response = await coreRequest<{ review: ItemManualReviewView | null }>(
    "/v1/internal/items/manual-reviews/claim-next",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.review;
}

export async function assignBalancedItemManualReview(
  userContext: InternalUserContext,
  input?: { reviewId?: string; assigneePool?: string[] },
) {
  const response = await coreRequest<{ review: ItemManualReviewView | null }>(
    "/v1/internal/items/manual-reviews/assign-balanced",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.review;
}

export async function rebalanceItemManualReviews(
  userContext: InternalUserContext,
  input?: {
    strategy?: "least_loaded" | "priority_first";
    maxAssignments?: number;
    assigneePool?: string[];
    templateKey?: string;
  },
) {
  const response = await coreRequest<{ result: ManualReviewRebalanceResult }>(
    "/v1/internal/items/manual-reviews/rebalance",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function triggerManualReviewAutoRebalance(
  userContext: InternalUserContext,
  input?: {
    strategy?: "least_loaded" | "priority_first";
    maxAssignments?: number;
    assigneePool?: string[];
  },
) {
  const response = await coreRequest<{ result: ManualReviewRebalanceResult }>(
    "/v1/internal/items/manual-reviews/rebalance-auto",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function triggerManualReviewAutoAssignSla(
  userContext: InternalUserContext,
  input?: {
    maxAssignments?: number;
    assigneePool?: string[];
    templateKey?: string;
  },
) {
  const response = await coreRequest<{ result: ManualReviewRebalanceResult }>(
    "/v1/internal/items/manual-reviews/auto-assign-sla",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function assignItemManualReview(
  userContext: InternalUserContext,
  reviewId: string,
  input: { assigneeUserId: string },
) {
  const response = await coreRequest<{ review: ItemManualReviewView }>(
    `/v1/internal/items/manual-reviews/${encodeURIComponent(reviewId)}/assign`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.review;
}

export async function releaseItemManualReview(userContext: InternalUserContext, reviewId: string) {
  const response = await coreRequest<{ review: ItemManualReviewView }>(
    `/v1/internal/items/manual-reviews/${encodeURIComponent(reviewId)}/release`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.review;
}

export async function releaseStaleItemManualReviews(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  return coreRequest<{ releasedCount: number; staleHours: number; reviewIds: string[] }>(
    "/v1/internal/items/manual-reviews/release-stale",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
}

export async function createOrder(
  userContext: InternalUserContext,
  input: CreateOrderInput,
) {
  return coreRequest<{ order: OrderView; item: ItemView }>("/v1/orders", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function rollbackOrder(
  userContext: InternalUserContext,
  orderId: string,
  input: RollbackOrderInput = {},
) {
  const response = await coreRequest<{ result: RollbackOrderResult }>(
    `/v1/internal/orders/${encodeURIComponent(orderId)}/rollback`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function listOrders(userContext: InternalUserContext) {
  const response = await coreRequest<{ orders: OrderView[] }>("/v1/orders", {
    userContext,
  });
  return response.orders;
}

export async function listMarketplace(userContext: InternalUserContext) {
  const response = await coreRequest<{ listings: MarketplaceListingView[] }>("/v1/marketplace/listings", {
    userContext,
  });
  return response.listings;
}

export async function createMarketplaceListing(userContext: InternalUserContext, input: CreateMarketplaceListingInput) {
  return coreRequest("/v1/marketplace/listings", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function purchaseMarketplaceListing(userContext: InternalUserContext, listingId: string) {
  return coreRequest("/v1/marketplace/purchase", {
    method: "POST",
    body: { listingId },
    userContext,
  });
}

export async function redeemCode(userContext: InternalUserContext, input: RedeemCodeInput) {
  return coreRequest<{ result: RedeemResult }>("/v1/redemptions/redeem", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function listOperatorRedemptionCodes(userContext: InternalUserContext) {
  return coreRequest<{ codes: RedemptionCodeView[] }>("/v1/internal/redemption-codes", {
    userContext,
  });
}

export async function upsertOperatorRedemptionCode(
  userContext: InternalUserContext,
  input: UpsertRedemptionCodeInput,
  codeId?: string,
) {
  const path = codeId
    ? `/v1/internal/redemption-codes/${encodeURIComponent(codeId)}`
    : "/v1/internal/redemption-codes";
  return coreRequest<{ code: RedemptionCodeView }>(path, {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function listOperatorRedemptionCodeUsages(userContext: InternalUserContext, codeId: string) {
  return coreRequest<{ usages: RedemptionCodeUsageView[] }>(
    `/v1/internal/redemption-codes/${encodeURIComponent(codeId)}/usages`,
    { userContext },
  );
}

export async function generateOperatorRedemptionCodeBatch(
  userContext: InternalUserContext,
  input: GenerateRedemptionCodeBatchInput,
) {
  return coreRequest<{ codes: RedemptionCodeView[] }>("/v1/internal/redemption-codes/batch", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function listMailbox(userContext: InternalUserContext) {
  const response = await coreRequest<{ messages: MailboxMessageView[] }>("/v1/mailbox/messages", {
    userContext,
  });
  return response.messages;
}

export async function claimMailboxAttachment(userContext: InternalUserContext, input: ClaimMailboxAttachmentInput) {
  return coreRequest("/v1/mailbox/claim", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function listTasks(userContext: InternalUserContext) {
  const response = await coreRequest<{ tasks: TaskView[] }>("/v1/tasks", {
    userContext,
  });
  return response.tasks;
}

export async function listMyTasks(userContext: InternalUserContext) {
  const response = await coreRequest<{ tasks: TaskView[] }>("/v1/tasks/mine", {
    userContext,
  });
  return response.tasks;
}

export async function createTask(userContext: InternalUserContext, input: CreateTaskInput) {
  return coreRequest("/v1/tasks", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function listTaskApplications(userContext: InternalUserContext, taskId: string) {
  const response = await coreRequest<{ applications: TaskApplicationView[] }>(`/v1/tasks/${taskId}/applications`, {
    userContext,
  });
  return response.applications;
}

export async function listTaskAgentProposals(userContext: InternalUserContext, taskId: string) {
  const response = await coreRequest<{ proposals: TaskAgentProposalView[] }>(`/v1/tasks/${taskId}/agent-proposals`, {
    userContext,
  });
  return response.proposals;
}

export async function createTaskAgentProposal(
  userContext: InternalUserContext,
  taskId: string,
  input: CreateTaskAgentProposalInput,
) {
  return coreRequest<{ proposal: TaskAgentProposalView }>(`/v1/tasks/${taskId}/agent-proposals`, {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function acceptTaskAgentProposal(
  userContext: InternalUserContext,
  taskId: string,
  proposalId: string,
) {
  return coreRequest<{ task: TaskView; proposal: TaskAgentProposalView; executionId: string }>(
    `/v1/tasks/${taskId}/agent-proposals/${proposalId}/accept`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function rejectTaskAgentProposal(
  userContext: InternalUserContext,
  taskId: string,
  proposalId: string,
) {
  return coreRequest<{ proposal: TaskAgentProposalView }>(`/v1/tasks/${taskId}/agent-proposals/${proposalId}/reject`, {
    method: "POST",
    userContext,
  });
}

export async function listDevelopmentQueue(userContext: InternalUserContext) {
  const response = await coreRequest<{ items: DevelopmentQueueItemView[] }>("/v1/development-queue/items", {
    userContext,
  });
  return response.items;
}

export async function updateDevelopmentQueueStatus(
  userContext: InternalUserContext,
  itemId: string,
  input: UpdateDevelopmentQueueStatusInput,
) {
  const response = await coreRequest<{ item: DevelopmentQueueItemView }>(
    `/v1/development-queue/items/${itemId}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.item;
}

export type OutboxQueryArgs = {
  status?: OutboxEventStatus;
  eventName?: string;
  limit?: number;
};

export async function listOutboxEvents(userContext: InternalUserContext, args?: OutboxQueryArgs) {
  const params = new URLSearchParams();
  if (args?.status) {
    params.set("status", args.status);
  }
  if (args?.eventName) {
    params.set("eventName", args.eventName);
  }
  if (args?.limit) {
    params.set("limit", String(args.limit));
  }

  const query = params.toString();
  const response = await coreRequest<{ events: OutboxEventView[] }>(
    `/v1/internal/outbox-events${query ? `?${query}` : ""}`,
    {
      userContext,
    },
  );
  return response.events;
}

export async function getOutboxSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: OutboxSummaryView }>("/v1/internal/outbox-events/summary", {
    userContext,
  });
  return response.summary;
}

export async function listOutboxRetryAttempts(userContext: InternalUserContext, limit = 25) {
  const response = await coreRequest<{ retries: OutboxRetryAttemptView[] }>(
    `/v1/internal/outbox-events/retries?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.retries;
}

export async function retryOutboxEvent(userContext: InternalUserContext, eventId: string) {
  const response = await coreRequest<{ event: OutboxEventView }>(`/v1/internal/outbox-events/${encodeURIComponent(
    eventId,
  )}/retry`, {
    method: "POST",
    userContext,
  });
  return response.event;
}

export async function retryOutboxEventsBatch(
  userContext: InternalUserContext,
  input: {
    limit?: number;
    eventName?: string;
  },
) {
  const response = await coreRequest<{ result: OutboxRetryBatchResult }>("/v1/internal/outbox-events/retry-batch", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.result;
}

export async function emitOutboxAlerts(
  userContext: InternalUserContext,
  input?: {
    limit?: number;
    minimumAlertLevel?: number;
  },
) {
  const response = await coreRequest<{ result: OutboxAlertDispatchResult }>("/v1/internal/outbox-events/emit-alerts", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
  return response.result;
}

export async function dispatchTaskNow(userContext: InternalUserContext, taskId: string) {
  return coreRequest(`/v1/tasks/${taskId}/dispatch`, {
    method: "POST",
    userContext,
  });
}

export async function applyForTask(
  userContext: InternalUserContext,
  taskId: string,
  statement: string,
  proposedEtaHours: number,
) {
  return coreRequest(`/v1/tasks/${taskId}/applications`, {
    method: "POST",
    body: { statement, proposedEtaHours },
    userContext,
  });
}

export async function updateTaskLifecycle(
  userContext: InternalUserContext,
  taskId: string,
  action: TaskLifecycleAction,
) {
  return coreRequest(`/v1/tasks/${taskId}/lifecycle`, {
    method: "POST",
    body: { action },
    userContext,
  });
}
