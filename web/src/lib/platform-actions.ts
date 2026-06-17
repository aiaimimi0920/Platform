"use server";

import {
  agentCallbackRemediationPolicyKeys,
  notificationWebhookIncidentSavedViewFocusSections,
  type AgentExecutionRuntimePressureLevel,
  type AgentExecutionRuntimeSchedulingDecisionClass,
  type NotificationWebhookIncidentSavedViewFocusSection,
  type UpsertAccountAnnouncementInput,
} from "@neuro/contracts";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import {
  acknowledgeOperatorNotificationWebhookIncident,
  acknowledgeOperatorNotificationWebhookIncidentsBatch,
  clearOperatorNotificationWebhookIncidentSilence,
  clearOperatorNotificationWebhookIncidentSilencesBatch,
  clearOperatorAgentExecutionOwnerReliefHandoffDefault,
  createOperatorNotificationWebhookIncidentSavedView,
  deleteOperatorNotificationWebhookIncidentSavedView,
  finalizeOperatorAgentExecutionOwnerReliefRun,
  openOperatorAgentExecutionOwnerReliefRunHandoff,
  recordOperatorAgentExecutionOwnerReliefRunAction,
  reopenOperatorAgentExecutionOwnerReliefRun,
  resolveOperatorAgentExecutionOwnerReliefRunHandoff,
  saveOperatorAgentExecutionOwnerReliefHandoffDefault,
  setOperatorDefaultNotificationWebhookIncidentSavedView,
  silenceOperatorNotificationWebhookIncident,
  silenceOperatorNotificationWebhookIncidentsBatch,
  startOperatorAgentExecutionOwnerReliefRun,
  updateOperatorNotificationWebhookIncidentSavedView,
} from "@/lib/account-client";
import {
  addAgentCapability,
  addAgentExecutionArtifact,
  advanceArbitrationReviewRound,
  createAgent,
  createAgentExecution,
  createAgentExecutionLaunchPreset,
  createAgentExecutionSubtask,
  autoRemediateRejectedCallbackPayloads,
  deleteAgent,
  deleteAgentExecutionLaunchPreset,
  emitAgentExecutionCallbackRemediationAlerts,
  emitAgentExecutionRuntimePressureAlerts,
  listAgents,
  listAgentCapabilities,
  listAgentMarketplaceListings,
  updateAgent,
  updateAgentCapability,
  listAgentExecutionLaunchPresets,
  updateAgentExecutionCallbackRemediationPolicy,
  updateAgentExecutionStatus,
  requeueAgentExecution,
  cleanupExpiredAgentCallbackCompatibility,
  recoverStalePlatformExecutions,
  replayRejectedCallbackPayload,
  requestRejectedCallbackRetryBatch,
  requestRejectedCallbackRetry,
  retryAgentExecutionSettlement,
  runPlatformExecutorNow,
  sweepAgentExecutionRuntimeSessions,
  upsertAgentMarketplaceListing,
  setAgentExecutionLaunchPresetAsDefault,
  updateAgentExecutionLaunchPreset,
  updateAgentExecutionSubtaskStatus,
} from "@/lib/platform-client";
import {
  createOperatorAccountAnnouncement,
  deleteOperatorAccountAnnouncement,
  updateOperatorAccountAnnouncement,
} from "@/lib/core-client";
import {
  normalizeAgentExecutionLaunchPresetCallbackRejectionCategory,
  normalizeAgentExecutionLaunchPresetCallbackRetryability,
  normalizeAgentExecutionLaunchPresetCallbackStatus,
  normalizeAgentExecutionLaunchPresetCallbackType,
  normalizeAgentExecutionLaunchPresetDecisionClass,
  normalizeAgentExecutionLaunchPresetFailureCategory,
  normalizeAgentExecutionLaunchPresetFocusSection,
  normalizeAgentExecutionLaunchPresetRecentWindow,
  normalizeAgentExecutionLaunchPresetReplayFailureClass,
  normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility,
  normalizeAgentExecutionLaunchPresetReplayPayloadReplayable,
  normalizeAgentExecutionLaunchPresetPressureLevel,
  normalizeAgentExecutionLaunchPresetRuntimeProfileKey,
  normalizeAgentExecutionLaunchPresetRuntimeDecisionClass,
  normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity,
  normalizeAgentExecutionLaunchPresetSchedulingDecisionClass,
  normalizeAgentExecutionLaunchPresetRuntimeSessionKind,
  normalizeAgentExecutionLaunchPresetRunKind,
  normalizeAgentExecutionLaunchPresetRunStatus,
  normalizeAgentExecutionLaunchPresetRuntimeSessionState,
  toAgentExecutionLaunchPresetFocusSectionFragment,
} from "@/lib/agent-execution-launch-presets";
import { requirePlatformOperatorUserContext, requirePlatformUserContext } from "@/lib/platform-session";
import {
  claimMailboxAttachmentAction as claimMailboxAttachmentActionImpl,
  claimMissionAction as claimMissionActionImpl,
  exchangeObsidianToMiraAction as exchangeObsidianToMiraActionImpl,
  redeemCodeAction as redeemCodeActionImpl,
} from "@/lib/platform-account-economy-actions";
import {
  rotateAgentCallbackSecretAction as rotateAgentCallbackSecretActionImpl,
  updateAgentCallbackProtocolVersionAction as updateAgentCallbackProtocolVersionActionImpl,
  updateAgentCallbackRemediationPolicyAction as updateAgentCallbackRemediationPolicyActionImpl,
} from "@/lib/platform-agent-callback-actions";
import {
  invokeAgentMarketplaceListingAction as invokeAgentMarketplaceListingActionImpl,
  invokeAgentMarketplaceListingBatchAction as invokeAgentMarketplaceListingBatchActionImpl,
  runAgentMarketplaceAutoProposalSweepAction as runAgentMarketplaceAutoProposalSweepActionImpl,
  updateAgentMarketplaceListingStatusAction as updateAgentMarketplaceListingStatusActionImpl,
  upsertAgentMarketplaceListingAction as upsertAgentMarketplaceListingActionImpl,
} from "@/lib/platform-agent-marketplace-actions";
import {
  applyOperatorDiscountCodeBatchAction as applyOperatorDiscountCodeBatchActionImpl,
  createListingAction as createListingActionImpl,
  deleteOperatorProductAction as deleteOperatorProductActionImpl,
  importOperatorDiscountCodesCsvAction as importOperatorDiscountCodesCsvActionImpl,
  previewOperatorDiscountCodesCsvAction as previewOperatorDiscountCodesCsvActionImpl,
  purchaseListingAction as purchaseListingActionImpl,
  submitOrderAction as submitOrderActionImpl,
  upsertOperatorDiscountCodeAction as upsertOperatorDiscountCodeActionImpl,
  upsertOperatorProductAction as upsertOperatorProductActionImpl,
} from "@/lib/platform-commerce-actions";
import {
  assignBalancedManualReviewAction as assignBalancedManualReviewActionImpl,
  assignManualReviewAction as assignManualReviewActionImpl,
  claimItemManualReviewAction as claimItemManualReviewActionImpl,
  claimNextManualReviewAction as claimNextManualReviewActionImpl,
  escalateFulfillmentAnomaliesAction as escalateFulfillmentAnomaliesActionImpl,
  rebalanceManualReviewQueueAction as rebalanceManualReviewQueueActionImpl,
  reconcileItemAction as reconcileItemActionImpl,
  releaseItemManualReviewAction as releaseItemManualReviewActionImpl,
  releaseStaleItemManualReviewsAction as releaseStaleItemManualReviewsActionImpl,
  reportItemUnitIssueAction as reportItemUnitIssueActionImpl,
  resolveItemManualReviewAction as resolveItemManualReviewActionImpl,
  triggerManualReviewAutoAssignSlaAction as triggerManualReviewAutoAssignSlaActionImpl,
  triggerManualReviewAutoRebalanceAction as triggerManualReviewAutoRebalanceActionImpl,
} from "@/lib/platform-fulfillment-actions";
import {
  adoptOpinionTopicAction as adoptOpinionTopicActionImpl,
  archiveOpinionTopicAction as archiveOpinionTopicActionImpl,
  batchExcludeOpinionMonthlySettlementItemsAction as batchExcludeOpinionMonthlySettlementItemsActionImpl,
  batchRestoreOpinionMonthlySettlementItemsAction as batchRestoreOpinionMonthlySettlementItemsActionImpl,
  createOpinionTopicAction as createOpinionTopicActionImpl,
  createOpinionTopicCommentAction as createOpinionTopicCommentActionImpl,
  moderateOpinionTopicAction as moderateOpinionTopicActionImpl,
  opposeOpinionTopicAction as opposeOpinionTopicActionImpl,
  runOpinionMonthlyLeaderSettlementAction as runOpinionMonthlyLeaderSettlementActionImpl,
  supportOpinionTopicAction as supportOpinionTopicActionImpl,
  updateOpinionHubSettingsAction as updateOpinionHubSettingsActionImpl,
  updateOpinionMonthlySettlementItemDecisionAction as updateOpinionMonthlySettlementItemDecisionActionImpl,
} from "@/lib/platform-opinion-actions";
import {
  emitOutboxAlertsAction as emitOutboxAlertsActionImpl,
  retryOutboxEventAction as retryOutboxEventActionImpl,
  retryOutboxEventsBatchAction as retryOutboxEventsBatchActionImpl,
} from "@/lib/platform-outbox-actions";
import {
  acceptTaskAgentProposalAction as acceptTaskAgentProposalActionImpl,
  applyTaskAction as applyTaskActionImpl,
  createTaskAction as createTaskActionImpl,
  createTaskAgentProposalAction as createTaskAgentProposalActionImpl,
  dispatchTaskAction as dispatchTaskActionImpl,
  rejectTaskAgentProposalAction as rejectTaskAgentProposalActionImpl,
  taskLifecycleAction as taskLifecycleActionImpl,
  updateDevelopmentQueueStatusAction as updateDevelopmentQueueStatusActionImpl,
} from "@/lib/platform-task-actions";

type ActionValidationIssue = {
  code?: string;
  message?: string;
  minimum?: number;
  maximum?: number;
  path?: unknown[];
};

function formatActionValidationIssueMessage(issue: ActionValidationIssue): string | null {
  const field = Array.isArray(issue.path) ? String(issue.path[0] ?? "") : "";
  const code = issue.code ?? "";

  if (field === "title") {
    if (code === "too_small") {
      return `议题标题至少需要 ${issue.minimum ?? 4} 个字。`;
    }
    if (code === "too_big") {
      return `议题标题最多只能输入 ${issue.maximum ?? 120} 个字。`;
    }
  }

  if (field === "description") {
    if (code === "too_small") {
      return `详细描述至少需要 ${issue.minimum ?? 16} 个字。`;
    }
    if (code === "too_big") {
      return `详细描述最多只能输入 ${issue.maximum ?? 4000} 个字。`;
    }
  }

  if (field === "tag") {
    return "请选择 1 个标签。";
  }

  if (field === "content") {
    if (code === "too_small") {
      return "讨论内容不能为空。";
    }
    if (code === "too_big") {
      return `讨论内容最多只能输入 ${issue.maximum ?? 1200} 个字。`;
    }
  }

  return typeof issue.message === "string" && issue.message.trim().length > 0 ? issue.message : null;
}

function normalizeActionErrorMessage(rawMessage: string): string | null {
  const trimmed = rawMessage.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const messages = parsed
      .map((entry) =>
        typeof entry === "object" && entry !== null ? formatActionValidationIssueMessage(entry as ActionValidationIssue) : null,
      )
      .filter((entry): entry is string => Boolean(entry && entry.trim().length > 0));

    if (messages.length === 0) {
      return null;
    }

    return Array.from(new Set(messages)).join(" ");
  } catch {
    return null;
  }
}

function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) {
    return normalizeActionErrorMessage(error.message) ?? error.message;
  }
  return fallback;
}

function resolveRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

function appendQueryStringToRedirectTarget(redirectTo: string, params: URLSearchParams) {
  const hashIndex = redirectTo.indexOf("#");
  const base = hashIndex >= 0 ? redirectTo.slice(0, hashIndex) : redirectTo;
  const hash = hashIndex >= 0 ? redirectTo.slice(hashIndex) : "";
  return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}${hash}`;
}

function setRedirectTargetQueryParams(
  redirectTo: string,
  entries: Record<string, string | null | undefined>,
) {
  const hashIndex = redirectTo.indexOf("#");
  const base = hashIndex >= 0 ? redirectTo.slice(0, hashIndex) : redirectTo;
  const hash = hashIndex >= 0 ? redirectTo.slice(hashIndex) : "";
  const queryIndex = base.indexOf("?");
  const pathname = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
  const params = new URLSearchParams(queryIndex >= 0 ? base.slice(queryIndex + 1) : "");

  for (const [key, value] of Object.entries(entries)) {
    if (value && value.trim().length > 0) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }

  return `${pathname}${params.size > 0 ? `?${params.toString()}` : ""}${hash}`;
}

function appendFragmentToPath(path: string, fragment?: string | null) {
  return fragment ? `${path}#${encodeURIComponent(fragment)}` : path;
}

function coerceRuntimePressureLevel(value: string | null | undefined): AgentExecutionRuntimePressureLevel | undefined {
  if (value === "healthy" || value === "watch" || value === "critical") {
    return value;
  }
  if (value === "near_limit" || value === "saturated") {
    return "critical";
  }
  return undefined;
}

function coerceRuntimeSchedulingDecisionClass(
  value: string | null | undefined,
): AgentExecutionRuntimeSchedulingDecisionClass | undefined {
  if (
    value === "within_capacity" ||
    value === "queue_backlog" ||
    value === "profile_saturated" ||
    value === "owner_hotspot" ||
    value === "profile_and_owner_saturated"
  ) {
    return value;
  }
  if (value === "launchable") {
    return "within_capacity";
  }
  return undefined;
}

function buildAgentExecutionsRedirectTarget(args: {
  params?: URLSearchParams;
  focusSection?: string | null;
}) {
  const target = appendFragmentToPath(
    "/agent-executions",
    toAgentExecutionLaunchPresetFocusSectionFragment(
      normalizeAgentExecutionLaunchPresetFocusSection(args.focusSection ?? null),
    ),
  );
  return args.params ? appendQueryStringToRedirectTarget(target, args.params) : target;
}

function parseAnnouncementSections(formData: FormData) {
  const raw = String(formData.get("sections") || "").trim();
  if (!raw) {
    throw new Error("请提供公告正文的 JSON 结构。");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("公告正文 JSON 格式无效。");
  }
}

function readAnnouncementPayload(formData: FormData): UpsertAccountAnnouncementInput {
  const title = String(formData.get("title") || "").trim();
  const railTitle = String(formData.get("railTitle") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const eyebrow = String(formData.get("eyebrow") || "").trim();
  const toneRaw = String(formData.get("tone") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();
  const tone = toneRaw === "priority" || toneRaw === "update" || toneRaw === "guide" ? toneRaw : null;
  const status =
    statusRaw === "draft" || statusRaw === "published" || statusRaw === "archived" ? statusRaw : null;
  if (!title || !railTitle || !summary || !eyebrow || !tone || !status) {
    throw new Error("公告必填字段缺失。");
  }

  const publishedAtRaw = String(formData.get("publishedAt") || "").trim();
  const publishedAt = publishedAtRaw || null;
  const sections = parseAnnouncementSections(formData);

  return {
    title,
    railTitle,
    summary,
    eyebrow,
    tone,
    status,
    publishedAt,
    sections,
  };
}

function buildStatusRedirect(redirectTo: string, status: "success" | "error", message: string) {
  return appendQueryStringToRedirectTarget(redirectTo, new URLSearchParams({ status, message }));
}

function appendQueryParams(redirectTo: string, entries: Record<string, string>) {
  return appendQueryStringToRedirectTarget(redirectTo, new URLSearchParams(entries));
}

function buildAgentCallbackOpsRedirect(args: {
  result: "success" | "error";
  message: string;
  agentId?: string | null;
  ownerUserId?: string | null;
  callbackType?: string | null;
  callbackVersion?: string | null;
  secretVersion?: string | null;
  callbackStatus?: string | null;
  remediationPolicyKey?: string | null;
  protocolMatch?: string | null;
  secretMatch?: string | null;
  retryability?: string | null;
  autoRemediationReasonCategory?: string | null;
  autoRemediationReasonDisposition?: string | null;
  replayPayloadCompatibility?: string | null;
  replayPayloadReplayable?: string | null;
  decisionClass?: string | null;
  replayFailureClass?: string | null;
  runtimeDecisionClass?: string | null;
  runtimeDecisionSeverity?: string | null;
  incidentReasonDisposition?: string | null;
  incidentAlertLevel?: string | null;
  projectId?: string | null;
  incidentId?: string | null;
  routePolicyId?: string | null;
  snapshotId?: string | null;
  rejectionCategory?: string | null;
  runKind?: string | null;
  runStatus?: string | null;
  executionStatus?: string | null;
  failureCategory?: string | null;
  recentWindow?: string | null;
  incidentState?: string | null;
  runtimePressureLevel?: string | null;
  runtimeSchedulingDecisionClass?: string | null;
  runtimeState?: string | null;
  runtimeKind?: string | null;
  runtimeStaleOnly?: string | null;
  ownerReliefAction?: string | null;
  ownerReliefClosedCount?: number | null;
  ownerReliefSkippedCount?: number | null;
  ownerReliefRecoveredCount?: number | null;
  ownerReliefExhaustedCount?: number | null;
  ownerReliefProcessedCount?: number | null;
  ownerReliefFailedCount?: number | null;
  ownerReliefRunId?: string | null;
  ownerReliefRecoveryExecutionIds?: string[] | null;
  ownerReliefExecutorExecutionIds?: string[] | null;
  ownerReliefRecoveryRunIds?: string[] | null;
  ownerReliefExecutorRunIds?: string[] | null;
  fragment?: string | null;
}) {
  const params = new URLSearchParams({
    result: args.result,
    message: args.message,
  });
  if (args.agentId) params.set("agentId", args.agentId);
  if (args.ownerUserId) params.set("ownerUserId", args.ownerUserId);
  if (args.callbackType) params.set("callbackType", args.callbackType);
  if (args.callbackVersion) params.set("callbackVersion", args.callbackVersion);
  if (args.secretVersion) params.set("secretVersion", args.secretVersion);
  if (args.callbackStatus) params.set("status", args.callbackStatus);
  if (args.remediationPolicyKey) params.set("remediationPolicyKey", args.remediationPolicyKey);
  if (args.protocolMatch) params.set("protocolMatch", args.protocolMatch);
  if (args.secretMatch) params.set("secretMatch", args.secretMatch);
  if (args.retryability) params.set("retryability", args.retryability);
  if (args.autoRemediationReasonCategory) {
    params.set("autoRemediationReasonCategory", args.autoRemediationReasonCategory);
  }
  if (args.autoRemediationReasonDisposition) {
    params.set("autoRemediationReasonDisposition", args.autoRemediationReasonDisposition);
  }
  if (args.replayPayloadCompatibility) {
    params.set("replayPayloadCompatibility", args.replayPayloadCompatibility);
  }
  if (args.replayPayloadReplayable) {
    params.set("replayPayloadReplayable", args.replayPayloadReplayable);
  }
  if (args.decisionClass) params.set("decisionClass", args.decisionClass);
  if (args.replayFailureClass) params.set("replayFailureClass", args.replayFailureClass);
  if (args.runtimeDecisionClass) params.set("runtimeDecisionClass", args.runtimeDecisionClass);
  if (args.runtimeDecisionSeverity) params.set("runtimeDecisionSeverity", args.runtimeDecisionSeverity);
  if (args.incidentReasonDisposition) params.set("incidentReasonDisposition", args.incidentReasonDisposition);
  if (args.incidentAlertLevel) params.set("incidentAlertLevel", args.incidentAlertLevel);
  if (args.projectId) params.set("projectId", args.projectId);
  if (args.incidentId) params.set("incidentId", args.incidentId);
  if (args.routePolicyId) params.set("routePolicyId", args.routePolicyId);
  if (args.snapshotId) params.set("snapshotId", args.snapshotId);
  if (args.rejectionCategory) params.set("rejectionCategory", args.rejectionCategory);
  if (args.runKind) params.set("runKind", args.runKind);
  if (args.runStatus) params.set("runStatus", args.runStatus);
  if (args.executionStatus) params.set("executionStatus", args.executionStatus);
  if (args.failureCategory) params.set("failureCategory", args.failureCategory);
  if (args.recentWindow) params.set("recentWindow", args.recentWindow);
  if (args.incidentState) params.set("incidentState", args.incidentState);
  if (args.runtimePressureLevel) params.set("runtimePressureLevel", args.runtimePressureLevel);
  if (args.runtimeSchedulingDecisionClass) {
    params.set("runtimeSchedulingDecisionClass", args.runtimeSchedulingDecisionClass);
  }
  if (args.runtimeState) params.set("runtimeState", args.runtimeState);
  if (args.runtimeKind) params.set("runtimeKind", args.runtimeKind);
  if (args.runtimeStaleOnly) params.set("runtimeStaleOnly", args.runtimeStaleOnly);
  if (args.ownerReliefAction) params.set("ownerReliefAction", args.ownerReliefAction);
  if (typeof args.ownerReliefClosedCount === "number") {
    params.set("ownerReliefClosedCount", String(args.ownerReliefClosedCount));
  }
  if (typeof args.ownerReliefSkippedCount === "number") {
    params.set("ownerReliefSkippedCount", String(args.ownerReliefSkippedCount));
  }
  if (typeof args.ownerReliefRecoveredCount === "number") {
    params.set("ownerReliefRecoveredCount", String(args.ownerReliefRecoveredCount));
  }
  if (typeof args.ownerReliefExhaustedCount === "number") {
    params.set("ownerReliefExhaustedCount", String(args.ownerReliefExhaustedCount));
  }
  if (typeof args.ownerReliefProcessedCount === "number") {
    params.set("ownerReliefProcessedCount", String(args.ownerReliefProcessedCount));
  }
  if (typeof args.ownerReliefFailedCount === "number") {
    params.set("ownerReliefFailedCount", String(args.ownerReliefFailedCount));
  }
  if (args.ownerReliefRunId) {
    params.set("ownerReliefRunId", args.ownerReliefRunId);
  }
  if (args.ownerReliefRecoveryExecutionIds?.length) {
    params.set(
      "ownerReliefRecoveryExecutionIds",
      Array.from(new Set(args.ownerReliefRecoveryExecutionIds.map((value) => value.trim()).filter(Boolean)))
        .slice(0, 20)
        .join(","),
    );
  }
  if (args.ownerReliefExecutorExecutionIds?.length) {
    params.set(
      "ownerReliefExecutorExecutionIds",
      Array.from(new Set(args.ownerReliefExecutorExecutionIds.map((value) => value.trim()).filter(Boolean)))
        .slice(0, 20)
        .join(","),
    );
  }
  if (args.ownerReliefRecoveryRunIds?.length) {
    params.set(
      "ownerReliefRecoveryRunIds",
      Array.from(new Set(args.ownerReliefRecoveryRunIds.map((value) => value.trim()).filter(Boolean)))
        .slice(0, 20)
        .join(","),
    );
  }
  if (args.ownerReliefExecutorRunIds?.length) {
    params.set(
      "ownerReliefExecutorRunIds",
      Array.from(new Set(args.ownerReliefExecutorRunIds.map((value) => value.trim()).filter(Boolean)))
        .slice(0, 20)
        .join(","),
    );
  }
  return appendFragmentToPath(`/ops/agent-callbacks?${params.toString()}`, args.fragment);
}

function readAgentCallbackOpsFollowUp(formData: FormData) {
  const agentId = String(formData.get("followUpAgentId") || "").trim() || null;
  const ownerUserId = String(formData.get("followUpOwnerUserId") || "").trim() || null;
  const callbackType = String(formData.get("followUpCallbackType") || "").trim() || null;
  const callbackVersion = String(formData.get("followUpCallbackVersion") || "").trim() || null;
  const secretVersion = String(formData.get("followUpSecretVersion") || "").trim() || null;
  const callbackStatus = String(formData.get("followUpCallbackStatus") || "").trim() || null;
  const remediationPolicyKey = String(formData.get("followUpRemediationPolicyKey") || "").trim() || null;
  const protocolMatch = String(formData.get("followUpProtocolMatch") || "").trim() || null;
  const secretMatch = String(formData.get("followUpSecretMatch") || "").trim() || null;
  const retryability = String(formData.get("followUpRetryability") || "").trim() || null;
  const autoRemediationReasonCategory =
    String(formData.get("followUpAutoRemediationReasonCategory") || "").trim() || null;
  const autoRemediationReasonDisposition =
    String(formData.get("followUpAutoRemediationReasonDisposition") || "").trim() || null;
  const replayPayloadCompatibility =
    String(formData.get("followUpReplayPayloadCompatibility") || "").trim() || null;
  const replayPayloadReplayable =
    String(formData.get("followUpReplayPayloadReplayable") || "").trim() || null;
  const decisionClass = String(formData.get("followUpDecisionClass") || "").trim() || null;
  const replayFailureClass = String(formData.get("followUpReplayFailureClass") || "").trim() || null;
  const runtimeDecisionClass = String(formData.get("followUpRuntimeDecisionClass") || "").trim() || null;
  const runtimeDecisionSeverity = String(formData.get("followUpRuntimeDecisionSeverity") || "").trim() || null;
  const incidentReasonDisposition = String(formData.get("followUpIncidentReasonDisposition") || "").trim() || null;
  const incidentAlertLevel = String(formData.get("followUpIncidentAlertLevel") || "").trim() || null;
  const projectId = String(formData.get("followUpProjectId") || "").trim() || null;
  const incidentId = String(formData.get("followUpIncidentId") || "").trim() || null;
  const routePolicyId = String(formData.get("followUpRoutePolicyId") || "").trim() || null;
  const snapshotId = String(formData.get("followUpSnapshotId") || "").trim() || null;
  const rejectionCategory = String(formData.get("followUpRejectionCategory") || "").trim() || null;
  const runKind = String(formData.get("followUpRunKind") || "").trim() || null;
  const runStatus = String(formData.get("followUpRunStatus") || "").trim() || null;
  const executionStatus = String(formData.get("followUpExecutionStatus") || "").trim() || null;
  const failureCategory = String(formData.get("followUpFailureCategory") || "").trim() || null;
  const recentWindow = String(formData.get("followUpRecentWindow") || "").trim() || null;
  const incidentState = String(formData.get("followUpIncidentState") || "").trim() || null;
  const runtimePressureLevel = String(formData.get("followUpRuntimePressureLevel") || "").trim() || null;
  const runtimeSchedulingDecisionClass =
    String(formData.get("followUpRuntimeSchedulingDecisionClass") || "").trim() || null;
  const runtimeState = String(formData.get("followUpRuntimeState") || "").trim() || null;
  const runtimeKind = String(formData.get("followUpRuntimeKind") || "").trim() || null;
  const runtimeStaleOnly = String(formData.get("followUpRuntimeStaleOnly") || "").trim() || null;
  const fragment = String(formData.get("followUpFragment") || "").trim() || null;
  return {
    agentId,
    ownerUserId,
    callbackType,
    callbackVersion,
    secretVersion,
    callbackStatus,
    remediationPolicyKey,
    protocolMatch,
    secretMatch,
      retryability,
      autoRemediationReasonCategory,
      autoRemediationReasonDisposition,
      replayPayloadCompatibility,
      replayPayloadReplayable,
      decisionClass,
    replayFailureClass,
    runtimeDecisionClass,
    runtimeDecisionSeverity,
    incidentReasonDisposition,
    incidentAlertLevel,
    projectId,
    incidentId,
    routePolicyId,
    snapshotId,
    rejectionCategory,
    runKind,
    runStatus,
    executionStatus,
    failureCategory,
    recentWindow,
    incidentState,
    runtimePressureLevel,
    runtimeSchedulingDecisionClass,
    runtimeState,
    runtimeKind,
    runtimeStaleOnly,
    fragment,
  };
}

function readRuntimeSessionSlice(formData: FormData): {
  agentId?: string;
  ownerUserId?: string;
  state?: "running" | "completed" | "failed" | "requeued";
  kind?: "platform_executor" | "stale_recovery" | "owner_requeue";
  staleOnly?: boolean;
} {
  const agentId = String(formData.get("agentId") || "").trim() || undefined;
  const ownerUserId = String(formData.get("ownerUserId") || "").trim() || undefined;
  const state = String(formData.get("state") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const staleOnly = String(formData.get("staleOnly") || "").trim();

  return {
    agentId,
    ownerUserId,
    state:
      state === "running" || state === "completed" || state === "failed" || state === "requeued"
        ? state
        : undefined,
    kind:
      kind === "platform_executor" || kind === "stale_recovery" || kind === "owner_requeue"
        ? kind
        : undefined,
    staleOnly: staleOnly === "true" ? true : staleOnly === "false" ? false : undefined,
  };
}

function readOwnerReliefAction(formData: FormData) {
  const action = String(formData.get("ownerReliefAction") || "").trim();
  return action === "sweep" ||
    action === "recover" ||
    action === "run" ||
    action === "recover_then_run"
    ? action
    : null;
}

function readOwnerReliefRunId(formData: FormData) {
  return String(formData.get("ownerReliefRunId") || "").trim() || null;
}

function buildOwnerReliefSummary(args: {
  closedCount?: number | null;
  skippedCount?: number | null;
  recoveredCount?: number | null;
  exhaustedCount?: number | null;
  processedCount?: number | null;
  failedCount?: number | null;
  recoveryExecutionIds?: string[] | null;
  recoveryRunIds?: string[] | null;
  executorExecutionIds?: string[] | null;
  executorRunIds?: string[] | null;
}) {
  return {
    sweepClosedCount: Math.max(0, args.closedCount ?? 0),
    sweepSkippedCount: Math.max(0, args.skippedCount ?? 0),
    recoveredCount: Math.max(0, args.recoveredCount ?? 0),
    exhaustedCount: Math.max(0, args.exhaustedCount ?? 0),
    processedCount: Math.max(0, args.processedCount ?? 0),
    failedCount: Math.max(0, args.failedCount ?? 0),
    recoveryExecutionIds: args.recoveryExecutionIds ?? [],
    recoveryRunIds: args.recoveryRunIds ?? [],
    executorExecutionIds: args.executorExecutionIds ?? [],
    executorRunIds: args.executorRunIds ?? [],
  };
}

async function ensureOwnerReliefRunId(args: {
  userContext: Awaited<ReturnType<typeof requirePlatformOperatorUserContext>>;
  formData: FormData;
  ownerReliefAction: "sweep" | "recover" | "run" | "recover_then_run" | null;
  runtimeSessionSlice: ReturnType<typeof readRuntimeSessionSlice>;
  followUp: ReturnType<typeof readAgentCallbackOpsFollowUp>;
}) {
  if (!args.ownerReliefAction) {
    return null;
  }
  const existingRunId = readOwnerReliefRunId(args.formData);
  if (existingRunId) {
    return existingRunId;
  }

  const ownerUserId = args.runtimeSessionSlice.ownerUserId ?? args.followUp.ownerUserId;
  if (!ownerUserId) {
    return null;
  }

  const run = await startOperatorAgentExecutionOwnerReliefRun(args.userContext, {
    ownerUserId,
    agentId: args.runtimeSessionSlice.agentId ?? args.followUp.agentId,
    triggerAction: args.ownerReliefAction,
    source: "ops/agent-callbacks",
    runtimePressureLevel: coerceRuntimePressureLevel(args.followUp.runtimePressureLevel) ?? null,
    runtimeSchedulingDecisionClass:
      coerceRuntimeSchedulingDecisionClass(args.followUp.runtimeSchedulingDecisionClass) ?? null,
  });
  return run.id;
}

async function recordOwnerReliefRunActionIfNeeded(args: {
  userContext: Awaited<ReturnType<typeof requirePlatformOperatorUserContext>>;
  runId: string | null;
  actionKind: "sweep" | "recover" | "run" | "recover_then_run";
  status: "success" | "error";
  title: string;
  detail?: string | null;
  summary: ReturnType<typeof buildOwnerReliefSummary>;
}) {
  if (!args.runId) {
    return;
  }
  await recordOperatorAgentExecutionOwnerReliefRunAction(args.userContext, args.runId, {
    actionKind: args.actionKind,
    status: args.status,
    title: args.title,
    detail: args.detail ?? null,
    summary: args.summary,
  });
}

type OwnerReliefRunHandoffTargetType =
  | "runtime_pressure"
  | "execution_run_watch"
  | "runtime_session_watch"
  | "callback_audits"
  | "external_note";

type OwnerReliefRunHandoffFocusSection =
  | "runtime-pressure"
  | "execution-run-watch"
  | "runtime-session-watch"
  | "callback-audits";

type OwnerReliefRunHandoffFollowUpProfile =
  | "inspect_only"
  | "resolve_after_review"
  | "reopen_after_review";

function parseOwnerReliefRunResultStatus(
  value: FormDataEntryValue | null,
): "continue" | "observe" | "escalate" | "handed_off" | null {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw === "continue" || raw === "observe" || raw === "escalate" || raw === "handed_off" ? raw : null;
}

function parseOwnerReliefRunHandoffTargetType(
  value: FormDataEntryValue | null,
): OwnerReliefRunHandoffTargetType | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (
    raw === "runtime_pressure" ||
    raw === "execution_run_watch" ||
    raw === "runtime_session_watch" ||
    raw === "callback_audits" ||
    raw === "external_note"
  ) {
    return raw;
  }
  if (raw === "callback_backlog") {
    return "callback_audits";
  }
  return null;
}

function parseOwnerReliefRunHandoffFocusSection(
  value: FormDataEntryValue | null,
): OwnerReliefRunHandoffFocusSection | null {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw === "runtime-pressure" ||
    raw === "execution-run-watch" ||
    raw === "runtime-session-watch" ||
    raw === "callback-audits"
    ? raw
    : null;
}

function parseOwnerReliefRunHandoffFollowUpProfile(
  value: FormDataEntryValue | null,
): OwnerReliefRunHandoffFollowUpProfile | null {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw === "inspect_only" || raw === "resolve_after_review" || raw === "reopen_after_review"
    ? raw
    : null;
}

export async function saveAgentExecutionOwnerReliefHandoffDefaultAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const handoffTargetType = parseOwnerReliefRunHandoffTargetType(formData.get("handoffTargetType"));
  const handoffTarget = String(formData.get("handoffTarget") || "").trim();
  const noteTemplate = String(formData.get("noteTemplate") || "").trim() || null;
  const followUpFocusSection = parseOwnerReliefRunHandoffFocusSection(formData.get("followUpFocusSection"));
  const followUpProfile = parseOwnerReliefRunHandoffFollowUpProfile(formData.get("followUpProfile"));

  if (!handoffTargetType || !handoffTarget) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少 owner relief handoff default 的目标类型或默认目标。"));
  }

  try {
    const profile = await saveOperatorAgentExecutionOwnerReliefHandoffDefault(userContext, {
      handoffTargetType,
      handoffTarget,
      noteTemplate,
      followUpFocusSection,
      followUpProfile,
    });
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `已保存 ${profile.handoffTargetType} 的 owner relief handoff default。`,
      ),
    );
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "保存 owner relief handoff default 失败，请稍后重试。"),
      ),
    );
  }
}

export async function clearAgentExecutionOwnerReliefHandoffDefaultAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const handoffTargetType = parseOwnerReliefRunHandoffTargetType(formData.get("handoffTargetType"));

  if (!handoffTargetType) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待清除的 owner relief handoff default 类型。"));
  }

  try {
    await clearOperatorAgentExecutionOwnerReliefHandoffDefault(userContext, handoffTargetType);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `已清除 ${handoffTargetType} 的 owner relief handoff default。`,
      ),
    );
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "清除 owner relief handoff default 失败，请稍后重试。"),
      ),
    );
  }
}

export async function openAgentExecutionOwnerReliefRunHandoffAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  const ownerReliefRunId = readOwnerReliefRunId(formData);
  const fallbackRedirect = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUpHref = resolveRedirectPath(formData.get("handoffFollowUpHref"), fallbackRedirect);

  if (!ownerReliefRunId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 owner relief run，无法打开 handoff follow-up。",
        ...followUp,
        ownerReliefAction,
      }),
    );
  }

  try {
    const handoff = await openOperatorAgentExecutionOwnerReliefRunHandoff(userContext, ownerReliefRunId, {
      followUpHref,
    });
    redirect(
      buildStatusRedirect(
        followUpHref,
        "success",
        `已打开 owner relief handoff：${handoff.handoffTargetType}${handoff.handoffTarget ? ` / ${handoff.handoffTarget}` : ""}。`,
      ),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "打开 owner relief handoff follow-up 失败，请稍后重试。"),
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
}

export async function resolveAgentExecutionOwnerReliefHandoffAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  const ownerReliefRunId = readOwnerReliefRunId(formData);
  const note = String(formData.get("ownerReliefHandoffResultNote") || "").trim() || null;

  if (!ownerReliefRunId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 owner relief run，无法结案 handoff follow-up。",
        ...followUp,
        ownerReliefAction,
      }),
    );
  }

  try {
    const handoff = await resolveOperatorAgentExecutionOwnerReliefRunHandoff(userContext, ownerReliefRunId, {
      note,
    });
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message:
          `已将 owner relief handoff 标记为 resolved：${handoff.handoffTargetType}` +
          `${handoff.resultNote ? ` / ${handoff.resultNote}` : ""}。`,
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "结案 owner relief handoff 失败，请稍后重试。"),
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
}

function readNotificationWebhookIncidentSlice(formData: FormData) {
  const agentId = String(formData.get("agentId") || "").trim() || null;
  const callbackType = String(formData.get("callbackType") || "").trim() || null;
  const remediationPolicyKey = String(formData.get("remediationPolicyKey") || "").trim() || null;
  const autoRemediationReasonCategory =
    String(formData.get("autoRemediationReasonCategory") || "").trim() || null;
  const reasonDisposition = String(formData.get("incidentReasonDisposition") || "").trim() || null;
  const alertLevel = String(formData.get("incidentAlertLevel") || "").trim() || null;
  const incidentState = String(formData.get("incidentState") || "").trim() || null;
  const projectId = String(formData.get("projectId") || "").trim() || null;
  const incidentId = String(formData.get("incidentId") || "").trim() || null;
  const routePolicyId = String(formData.get("routePolicyId") || "").trim() || null;
  const snapshotId = String(formData.get("snapshotId") || "").trim() || null;
  return {
    agentId,
    callbackType,
    remediationPolicyKey,
    autoRemediationReasonCategory,
    reasonDisposition,
    alertLevel,
    incidentState,
    projectId,
    incidentId,
    routePolicyId,
    snapshotId,
  };
}

function parseBooleanFormValue(value: FormDataEntryValue | null, fallback = false) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

function readSavedViewFollowUpIncidentState(formData: FormData) {
  const value = String(formData.get("savedViewFollowUpIncidentState") || "").trim();
  return value === "active" || value === "acknowledged" || value === "silenced" ? value : null;
}

function readSavedViewFocusSection(formData: FormData): NotificationWebhookIncidentSavedViewFocusSection | null {
  const value = String(formData.get("savedViewFocusSection") || "").trim();
  return notificationWebhookIncidentSavedViewFocusSections.includes(
    value as NotificationWebhookIncidentSavedViewFocusSection,
  )
    ? (value as NotificationWebhookIncidentSavedViewFocusSection)
    : null;
}

function parseNullablePositiveIntFormValue(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("请输入有效的正整数参数。");
  }
  return Math.floor(parsed);
}

function parsePositiveIntFormValue(value: FormDataEntryValue | null, fieldLabel: string) {
  const parsed = parseNullablePositiveIntFormValue(value);
  if (parsed === null) {
    throw new Error(`请输入有效的${fieldLabel}。`);
  }
  return parsed;
}

function parseNullableIsoDateTimeFormValue(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("请输入有效的时间。");
  }
  return parsed.toISOString();
}

export async function submitOrderAction(formData: FormData) {
  return submitOrderActionImpl(formData);
}

export async function upsertOperatorProductAction(formData: FormData) {
  return upsertOperatorProductActionImpl(formData);
}

export async function deleteOperatorProductAction(formData: FormData) {
  return deleteOperatorProductActionImpl(formData);
}

export async function upsertOperatorDiscountCodeAction(formData: FormData) {
  return upsertOperatorDiscountCodeActionImpl(formData);
}

export async function applyOperatorDiscountCodeBatchAction(formData: FormData) {
  return applyOperatorDiscountCodeBatchActionImpl(formData);
}

export async function importOperatorDiscountCodesCsvAction(formData: FormData) {
  return importOperatorDiscountCodesCsvActionImpl(formData);
}

export async function previewOperatorDiscountCodesCsvAction(formData: FormData) {
  return previewOperatorDiscountCodesCsvActionImpl(formData);
}

export async function createListingAction(formData: FormData) {
  return createListingActionImpl(formData);
}

export async function purchaseListingAction(formData: FormData) {
  return purchaseListingActionImpl(formData);
}



export async function redeemCodeAction(formData: FormData) {
  return redeemCodeActionImpl(formData);
}


export async function reportItemUnitIssueAction(formData: FormData) {
  return reportItemUnitIssueActionImpl(formData);
}

export async function reconcileItemAction(formData: FormData) {
  return reconcileItemActionImpl(formData);
}

export async function resolveItemManualReviewAction(formData: FormData) {
  return resolveItemManualReviewActionImpl(formData);
}


export async function updateAgentCallbackRemediationPolicyAction(formData: FormData) {
  return updateAgentCallbackRemediationPolicyActionImpl(formData);
}

export async function claimItemManualReviewAction(formData: FormData) {
  return claimItemManualReviewActionImpl(formData);
}

export async function releaseItemManualReviewAction(formData: FormData) {
  return releaseItemManualReviewActionImpl(formData);
}

export async function triggerManualReviewAutoRebalanceAction(formData: FormData) {
  return triggerManualReviewAutoRebalanceActionImpl(formData);
}

export async function triggerManualReviewAutoAssignSlaAction(formData: FormData) {
  return triggerManualReviewAutoAssignSlaActionImpl(formData);
}

export async function releaseStaleItemManualReviewsAction(formData: FormData) {
  return releaseStaleItemManualReviewsActionImpl(formData);
}

export async function claimNextManualReviewAction(formData: FormData) {
  return claimNextManualReviewActionImpl(formData);
}

export async function escalateFulfillmentAnomaliesAction(formData: FormData) {
  return escalateFulfillmentAnomaliesActionImpl(formData);
}

export async function assignBalancedManualReviewAction(formData: FormData) {
  return assignBalancedManualReviewActionImpl(formData);
}

export async function rebalanceManualReviewQueueAction(formData: FormData) {
  return rebalanceManualReviewQueueActionImpl(formData);
}

export async function assignManualReviewAction(formData: FormData) {
  return assignManualReviewActionImpl(formData);
}

export async function retryOutboxEventAction(formData: FormData) {
  return retryOutboxEventActionImpl(formData);
}

export async function retryOutboxEventsBatchAction(formData: FormData) {
  return retryOutboxEventsBatchActionImpl(formData);
}

export async function emitOutboxAlertsAction(formData: FormData) {
  return emitOutboxAlertsActionImpl(formData);
}

export async function claimMailboxAttachmentAction(formData: FormData) {
  return claimMailboxAttachmentActionImpl(formData);
}

export async function claimMissionAction(formData: FormData) {
  return claimMissionActionImpl(formData);
}

export async function exchangeObsidianToMiraAction(formData: FormData) {
  return exchangeObsidianToMiraActionImpl(formData);
}


export async function createOpinionTopicAction(formData: FormData) {
  return createOpinionTopicActionImpl(formData);
}

export async function supportOpinionTopicAction(formData: FormData) {
  return supportOpinionTopicActionImpl(formData);
}

export async function opposeOpinionTopicAction(formData: FormData) {
  return opposeOpinionTopicActionImpl(formData);
}

export async function archiveOpinionTopicAction(formData: FormData) {
  return archiveOpinionTopicActionImpl(formData);
}

export async function adoptOpinionTopicAction(formData: FormData) {
  return adoptOpinionTopicActionImpl(formData);
}

export async function createOpinionTopicCommentAction(formData: FormData) {
  return createOpinionTopicCommentActionImpl(formData);
}

export async function updateOpinionHubSettingsAction(formData: FormData) {
  return updateOpinionHubSettingsActionImpl(formData);
}

export async function moderateOpinionTopicAction(formData: FormData) {
  return moderateOpinionTopicActionImpl(formData);
}

export async function runOpinionMonthlyLeaderSettlementAction(formData: FormData) {
  return runOpinionMonthlyLeaderSettlementActionImpl(formData);
}

export async function updateOpinionMonthlySettlementItemDecisionAction(formData: FormData) {
  return updateOpinionMonthlySettlementItemDecisionActionImpl(formData);
}

export async function batchExcludeOpinionMonthlySettlementItemsAction(formData: FormData) {
  return batchExcludeOpinionMonthlySettlementItemsActionImpl(formData);
}

export async function batchRestoreOpinionMonthlySettlementItemsAction(formData: FormData) {
  return batchRestoreOpinionMonthlySettlementItemsActionImpl(formData);
}


export async function createTaskAction(formData: FormData) {
  return createTaskActionImpl(formData);
}

export async function applyTaskAction(formData: FormData) {
  return applyTaskActionImpl(formData);
}

export async function dispatchTaskAction(formData: FormData) {
  return dispatchTaskActionImpl(formData);
}

export async function createTaskAgentProposalAction(formData: FormData) {
  return createTaskAgentProposalActionImpl(formData);
}

export async function acceptTaskAgentProposalAction(formData: FormData) {
  return acceptTaskAgentProposalActionImpl(formData);
}

export async function rejectTaskAgentProposalAction(formData: FormData) {
  return rejectTaskAgentProposalActionImpl(formData);
}

export async function updateDevelopmentQueueStatusAction(formData: FormData) {
  return updateDevelopmentQueueStatusActionImpl(formData);
}

export async function taskLifecycleAction(formData: FormData) {
  return taskLifecycleActionImpl(formData);
}


export async function createAgentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const agentLayer = String(formData.get("agentLayer") || "").trim();
  const resolvedHostingMode =
    agentLayer === "managed_light" || agentLayer === "managed_heavy" || agentLayer === "open_protocol"
      ? agentLayer
      : String(formData.get("hostingMode") || "").trim() || null;
  const resolvedSourceType =
    agentLayer === "open_protocol"
      ? "external"
      : agentLayer === "managed_light" || agentLayer === "managed_heavy"
        ? "platform"
        : (String(formData.get("sourceType") || "platform") as "platform" | "external");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const managedServiceId = String(formData.get("managedServiceId") || "").trim() || null;
  const managedProviderLabel = String(formData.get("managedProviderLabel") || "").trim() || null;
  const managedApiBaseUrl = String(formData.get("managedApiBaseUrl") || "").trim() || null;
  const managedModel = String(formData.get("managedModel") || "").trim() || null;
  const managedApiKey =
    resolvedHostingMode === "managed_api"
      ? String(formData.get("managedApiKey") || "").trim() || null
      : null;
  const managedSystemPrompt = String(formData.get("managedSystemPrompt") || "").trim() || null;
  const managedPromptTemplate = String(formData.get("managedPromptTemplate") || "").trim() || null;
  const managedTaskCategory = String(formData.get("managedTaskCategory") || "").trim() || null;
  const managedCapabilitySummary = String(formData.get("managedCapabilitySummary") || "").trim() || null;
  const listingPriceAmountRaw = Number(formData.get("listingPriceAmount") || 0);
  const listingPriceAmount = Number.isFinite(listingPriceAmountRaw) ? Math.max(1, Math.floor(listingPriceAmountRaw)) : 300;
  const listingBillingModeRaw = String(formData.get("listingBillingMode") || "flat_task").trim();
  const listingBillingMode =
    listingBillingModeRaw === "token_metered" || listingBillingModeRaw === "property_metered"
      ? listingBillingModeRaw
      : "flat_task";
  const listingPriceCurrencyRaw = String(formData.get("listingPriceCurrency") || "obsidian").trim();
  const listingPriceCurrency = listingPriceCurrencyRaw === "mira" ? "mira" : "obsidian";
  const listingAutoTakeEnabled = formData
    .getAll("listingAutoTakeEnabled")
    .some((value) => String(value).trim() === "true");
  const listingBillingUnit = normalizeManagedLightListingBillingUnit(
    listingBillingMode,
    String(formData.get("listingBillingUnit") || "").trim() || null,
  );
  const listingMeterKey = normalizeManagedLightListingMeterKey(
    listingBillingMode,
    String(formData.get("listingMeterKey") || "").trim() || null,
  );
  const lightInputSchema =
    resolvedHostingMode === "managed_light"
      ? parseStructuredResourceSchema(formData, "input", "输入资源")
      : null;
  const lightOutputSchema =
    resolvedHostingMode === "managed_light"
      ? parseStructuredResourceSchema(formData, "output", "输出资源")
      : null;
  try {
    const agent = await createAgent(userContext, {
      name,
      description,
      sourceType: resolvedSourceType,
      hostingMode: resolvedHostingMode
        ? (resolvedHostingMode as
            | "managed_light"
            | "managed_heavy"
            | "open_protocol"
            | "registry_only"
            | "external_runtime"
            | "managed_api")
        : undefined,
      runtimeEndpoint: String(formData.get("runtimeEndpoint") || "").trim() || null,
      authMode: String(formData.get("authMode") || "none") as "none" | "apiKey" | "bearer",
      runtimeAuthToken: String(formData.get("runtimeAuthToken") || "").trim() || null,
      managedServiceId,
      managedProviderLabel,
      managedApiBaseUrl,
      managedModel,
      managedApiKey,
      managedSystemPrompt,
      managedPromptTemplate,
      managedTaskCategory,
      managedCapabilitySummary,
      enabled: String(formData.get("enabled") || "true") !== "false",
    });
    if (resolvedHostingMode === "managed_light") {
      const capability = await addAgentCapability(userContext, agent.id, {
        code: buildManagedLightCapabilityCode(agent.name, managedTaskCategory),
        title: agent.name,
        description: managedCapabilitySummary,
        routingSummary: managedCapabilitySummary,
        routingTags: buildManagedLightRoutingTags(managedTaskCategory),
        inputSchema: lightInputSchema,
        outputSchema: lightOutputSchema,
        resourceNormalizationPrompt: null,
        pricingNote: null,
        enabled: true,
      });
      await upsertAgentMarketplaceListing(userContext, {
        capabilityId: capability.id,
        publicTitle: agent.name,
        publicDescription: managedCapabilitySummary,
        billingMode: listingBillingMode,
        billingUnit: listingBillingUnit,
        meterKey: listingMeterKey,
        priceCurrency: listingPriceCurrency,
        priceAmount: listingPriceAmount,
        status: "published",
        externalInvocationEnabled: true,
        autoTakeEnabled: listingAutoTakeEnabled,
        autoTakeStatementTemplate: null,
      });
    }
    redirect(buildStatusRedirect(setRedirectTargetQueryParams(redirectTo, { agentId: agent.id }), "success", "Agent 创建成功。"));
  } catch (error) {
    const message = toMessage(error, "Agent 创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function saveManagedLightAgentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), redirectTo);
  const agentId = String(formData.get("agentId") || "").trim();
  const capabilityId = String(formData.get("capabilityId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const managedServiceId = String(formData.get("managedServiceId") || "").trim() || null;
  const managedModel = String(formData.get("managedModel") || "").trim() || null;
  const managedTaskCategory = String(formData.get("managedTaskCategory") || "").trim() || null;
  const managedCapabilitySummary = String(formData.get("managedCapabilitySummary") || "").trim() || null;
  const managedSystemPrompt = String(formData.get("managedSystemPrompt") || "").trim() || null;
  const managedPromptTemplate = String(formData.get("managedPromptTemplate") || "").trim() || null;
  const listingPriceAmountRaw = Number(formData.get("listingPriceAmount") || 0);
  const listingPriceAmount = Number.isFinite(listingPriceAmountRaw) ? Math.max(1, Math.floor(listingPriceAmountRaw)) : 300;
  const listingBillingModeRaw = String(formData.get("listingBillingMode") || "flat_task").trim();
  const listingBillingMode =
    listingBillingModeRaw === "token_metered" || listingBillingModeRaw === "property_metered"
      ? listingBillingModeRaw
      : "flat_task";
  const listingPriceCurrencyRaw = String(formData.get("listingPriceCurrency") || "obsidian").trim();
  const listingPriceCurrency = listingPriceCurrencyRaw === "mira" ? "mira" : "obsidian";
  const listingAutoTakeEnabled = formData
    .getAll("listingAutoTakeEnabled")
    .some((value) => String(value).trim() === "true");
  const lightInputSchema = parseStructuredResourceSchema(formData, "input", "输入资源");
  const lightOutputSchema = parseStructuredResourceSchema(formData, "output", "输出资源");

  try {
    let savedAgent = null as Awaited<ReturnType<typeof createAgent>> | null;
    let resolvedCapabilityId = capabilityId;
    let existingCapability = null as Awaited<ReturnType<typeof listAgentCapabilities>>[number] | null;
    let existingListing = null as Awaited<ReturnType<typeof listAgentMarketplaceListings>>[number] | null;

    if (agentId) {
      const [capabilities, listings] = await Promise.all([
        listAgentCapabilities(userContext, agentId),
        listAgentMarketplaceListings(userContext, "owner"),
      ]);
      existingCapability = capabilityId ? capabilities.find((capability) => capability.id === capabilityId) ?? null : capabilities[0] ?? null;
      if (existingCapability) {
        const existingCapabilityId = existingCapability.id;
        existingListing = listings.find((listing) => listing.capabilityId === existingCapabilityId) ?? null;
      }
      savedAgent = await updateAgent(userContext, agentId, {
        name,
        description: null,
        runtimeEndpoint: null,
        authMode: "none",
        runtimeAuthToken: null,
        managedServiceId,
        managedProviderLabel: null,
        managedApiBaseUrl: null,
        managedModel,
        managedApiKey: null,
        managedSystemPrompt,
        managedPromptTemplate,
        managedTaskCategory,
        managedCapabilitySummary,
      });

      if (existingCapability) {
        const updatedCapability = await updateAgentCapability(userContext, agentId, existingCapability.id, {
          title: savedAgent.name,
          description: managedCapabilitySummary,
          routingSummary: managedCapabilitySummary,
          routingTags: buildManagedLightRoutingTags(managedTaskCategory),
          inputSchema: lightInputSchema,
          outputSchema: lightOutputSchema,
          resourceNormalizationPrompt: existingCapability.resourceNormalizationPrompt,
          pricingNote: existingCapability.pricingNote,
          enabled: existingCapability.enabled,
        });
        resolvedCapabilityId = updatedCapability.id;
      }
    }

    if (!savedAgent) {
      savedAgent = await createAgent(userContext, {
        name,
        description: null,
        sourceType: "platform",
        hostingMode: "managed_light",
        runtimeEndpoint: null,
        authMode: "none",
        runtimeAuthToken: null,
        managedServiceId,
        managedProviderLabel: null,
        managedApiBaseUrl: null,
        managedModel,
        managedApiKey: null,
        managedSystemPrompt,
        managedPromptTemplate,
        managedTaskCategory,
        managedCapabilitySummary,
        enabled: true,
      });
    }

    if (!resolvedCapabilityId) {
      const capability = await addAgentCapability(userContext, savedAgent.id, {
        code: buildManagedLightCapabilityCode(savedAgent.name, managedTaskCategory),
        title: savedAgent.name,
        description: managedCapabilitySummary,
        routingSummary: managedCapabilitySummary,
        routingTags: buildManagedLightRoutingTags(managedTaskCategory),
        inputSchema: lightInputSchema,
        outputSchema: lightOutputSchema,
        resourceNormalizationPrompt: null,
        pricingNote: null,
        enabled: true,
      });
      resolvedCapabilityId = capability.id;
    }

    await upsertAgentMarketplaceListing(userContext, {
      capabilityId: resolvedCapabilityId,
      publicTitle: savedAgent.name,
      publicDescription: managedCapabilitySummary,
      billingMode: listingBillingMode,
      billingUnit: normalizeManagedLightListingBillingUnit(listingBillingMode, null),
      meterKey: normalizeManagedLightListingMeterKey(listingBillingMode, null),
      priceCurrency: listingPriceCurrency,
      priceAmount: listingPriceAmount,
      status: existingListing?.status ?? "published",
      externalInvocationEnabled: existingListing?.externalInvocationEnabled ?? true,
      autoTakeEnabled: listingAutoTakeEnabled,
      autoTakeStatementTemplate: existingListing?.autoTakeStatementTemplate ?? null,
    });

    redirect(buildStatusRedirect(successRedirectTo, "success", agentId ? "羽量 Agent 已更新。" : "羽量 Agent 已创建。"));
  } catch (error) {
    const message = toMessage(error, agentId ? "羽量 Agent 更新失败，请稍后重试。" : "羽量 Agent 创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function saveManagedCloudAgentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents?role=cloud");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents?role=cloud");
  const agentId = String(formData.get("agentId") || "").trim();
  const capabilityId = String(formData.get("capabilityId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const runtimeEndpoint = String(formData.get("runtimeEndpoint") || "").trim() || null;
  const authModeRaw = String(formData.get("authMode") || "none").trim();
  const authMode = authModeRaw === "apiKey" || authModeRaw === "bearer" ? authModeRaw : "none";
  const runtimeAuthTokenRaw = String(formData.get("runtimeAuthToken") || "").trim();
  const listingPriceAmountRaw = Number(formData.get("listingPriceAmount") || 0);
  const listingPriceAmount = Number.isFinite(listingPriceAmountRaw) ? Math.max(1, Math.floor(listingPriceAmountRaw)) : 300;
  const listingPriceCurrencyRaw = String(formData.get("listingPriceCurrency") || "obsidian").trim();
  const listingPriceCurrency = listingPriceCurrencyRaw === "mira" ? "mira" : "obsidian";
  const listingAutoTakeEnabled = formData
    .getAll("listingAutoTakeEnabled")
    .some((value) => String(value).trim() === "true");

  try {
    let savedAgent = null as Awaited<ReturnType<typeof createAgent>> | null;
    let resolvedCapabilityId = capabilityId;
    let existingCapability = null as Awaited<ReturnType<typeof listAgentCapabilities>>[number] | null;
    let existingListing = null as Awaited<ReturnType<typeof listAgentMarketplaceListings>>[number] | null;

    if (agentId) {
      const [ownedAgents, capabilities, listings] = await Promise.all([
        listAgents(userContext),
        listAgentCapabilities(userContext, agentId),
        listAgentMarketplaceListings(userContext, "owner"),
      ]);
      const existingAgent =
        ownedAgents.find(
          (agent) =>
            agent.id === agentId && (agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime"),
        ) ?? null;

      if (!existingAgent) {
        redirect(buildStatusRedirect(redirectTo, "error", "未找到可编辑的云端 Agent。"));
      }

      existingCapability = capabilityId ? capabilities.find((capability) => capability.id === capabilityId) ?? null : capabilities[0] ?? null;
      if (existingCapability) {
        const existingCapabilityId = existingCapability.id;
        existingListing = listings.find((listing) => listing.capabilityId === existingCapabilityId) ?? null;
      }

      const updateInput: {
        name: string;
        description?: string | null;
        runtimeEndpoint?: string | null;
        authMode?: "none" | "apiKey" | "bearer";
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
      } = {
        name,
        description,
        runtimeEndpoint,
        authMode,
        managedServiceId: null,
        managedProviderLabel: null,
        managedApiBaseUrl: null,
        managedModel: null,
        managedApiKey: null,
        managedSystemPrompt: null,
        managedPromptTemplate: null,
        managedTaskCategory: null,
        managedCapabilitySummary: null,
        enabled: existingAgent.enabled,
      };

      if (authMode === "none") {
        updateInput.runtimeAuthToken = null;
      } else if (runtimeAuthTokenRaw.length > 0) {
        updateInput.runtimeAuthToken = runtimeAuthTokenRaw;
      }

      savedAgent = await updateAgent(userContext, agentId, updateInput);

      if (existingCapability) {
        const updatedCapability = await updateAgentCapability(userContext, agentId, existingCapability.id, {
          title: savedAgent.name,
          description,
          routingSummary: description,
          routingTags: buildManagedCloudRoutingTags(),
          inputSchema: null,
          outputSchema: null,
          resourceNormalizationPrompt: null,
          pricingNote: null,
          enabled: existingCapability.enabled,
        });
        resolvedCapabilityId = updatedCapability.id;
      }
    }

    if (!savedAgent) {
      savedAgent = await createAgent(userContext, {
        name,
        description,
        sourceType: "external",
        hostingMode: "open_protocol",
        runtimeEndpoint,
        authMode,
        runtimeAuthToken: authMode === "none" ? null : runtimeAuthTokenRaw || null,
        managedServiceId: null,
        managedProviderLabel: null,
        managedApiBaseUrl: null,
        managedModel: null,
        managedApiKey: null,
        managedSystemPrompt: null,
        managedPromptTemplate: null,
        managedTaskCategory: null,
        managedCapabilitySummary: null,
        enabled: true,
      });
    }

    if (!resolvedCapabilityId) {
      const capability = await addAgentCapability(userContext, savedAgent.id, {
        code: buildManagedCloudCapabilityCode(savedAgent.name),
        title: savedAgent.name,
        description,
        routingSummary: description,
        routingTags: buildManagedCloudRoutingTags(),
        inputSchema: null,
        outputSchema: null,
        resourceNormalizationPrompt: null,
        pricingNote: null,
        enabled: true,
      });
      resolvedCapabilityId = capability.id;
    }

    await upsertAgentMarketplaceListing(userContext, {
      capabilityId: resolvedCapabilityId,
      publicTitle: savedAgent.name,
      publicDescription: description,
      billingMode: "flat_task",
      billingUnit: normalizeManagedLightListingBillingUnit("flat_task", null),
      meterKey: null,
      priceCurrency: listingPriceCurrency,
      priceAmount: listingPriceAmount,
      status: existingListing?.status ?? "published",
      externalInvocationEnabled: existingListing?.externalInvocationEnabled ?? true,
      autoTakeEnabled: listingAutoTakeEnabled,
      autoTakeStatementTemplate: existingListing?.autoTakeStatementTemplate ?? null,
    });

    redirect(buildStatusRedirect(successRedirectTo, "success", agentId ? "云端 Agent 已更新。" : "云端 Agent 已创建。"));
  } catch (error) {
    const message = toMessage(error, agentId ? "云端 Agent 更新失败，请稍后重试。" : "云端 Agent 创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function saveManagedHeavyAgentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents?role=heavy");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents?role=heavy");
  const agentId = String(formData.get("agentId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const enabled = formData.getAll("enabled").some((value) => String(value).trim() === "true");

  try {
    const ownedAgents = await listAgents(userContext);
    const existingHeavyAgents = ownedAgents.filter(
      (agent) => agent.hostingMode === "managed_heavy" || agent.hostingMode === "registry_only",
    );

    if (agentId) {
      const existingAgent = existingHeavyAgents.find((agent) => agent.id === agentId) ?? null;
      if (!existingAgent) {
        redirect(buildStatusRedirect(redirectTo, "error", "未找到可编辑的重度智能体。"));
      }

      await updateAgent(userContext, agentId, {
        name,
        description,
        runtimeEndpoint: existingAgent.runtimeEndpoint,
        authMode: existingAgent.authMode,
        runtimeAuthToken: null,
        managedServiceId: existingAgent.managedServiceId,
        managedProviderLabel: existingAgent.managedProviderLabel,
        managedApiBaseUrl: existingAgent.managedApiBaseUrl,
        managedModel: existingAgent.managedModel,
        managedApiKey: null,
        managedSystemPrompt: existingAgent.managedSystemPrompt,
        managedPromptTemplate: existingAgent.managedPromptTemplate,
        managedTaskCategory: existingAgent.managedTaskCategory,
        managedCapabilitySummary: existingAgent.managedCapabilitySummary,
        enabled,
      });

      redirect(buildStatusRedirect(successRedirectTo, "success", "重度智能体已更新。"));
    }

    if (existingHeavyAgents.length >= 1) {
      redirect(buildStatusRedirect(redirectTo, "error", "当前仅允许 1 个自创建重度槽位，更多槽位请先购买。"));
    }

    await createAgent(userContext, {
      name,
      description,
      sourceType: "platform",
      hostingMode: "managed_heavy",
      runtimeEndpoint: null,
      authMode: "none",
      runtimeAuthToken: null,
      managedServiceId: null,
      managedProviderLabel: null,
      managedApiBaseUrl: null,
      managedModel: null,
      managedApiKey: null,
      managedSystemPrompt: null,
      managedPromptTemplate: null,
      managedTaskCategory: null,
      managedCapabilitySummary: null,
      enabled,
    });

    redirect(buildStatusRedirect(successRedirectTo, "success", "重度智能体已创建。"));
  } catch (error) {
    const message = toMessage(error, agentId ? "重度智能体更新失败，请稍后重试。" : "重度智能体创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

type ManagedLightBatchAction = "delete" | "enable" | "disable";

function buildUpdateAgentInputFromView(agent: Awaited<ReturnType<typeof listAgents>>[number], enabled: boolean) {
  return {
    name: agent.name,
    description: agent.description,
    runtimeEndpoint: agent.runtimeEndpoint,
    authMode: agent.authMode,
    runtimeAuthToken: null,
    managedServiceId: agent.managedServiceId,
    managedProviderLabel: agent.managedProviderLabel,
    managedApiBaseUrl: agent.managedApiBaseUrl,
    managedModel: agent.managedModel,
    managedApiKey: null,
    managedSystemPrompt: agent.managedSystemPrompt,
    managedPromptTemplate: agent.managedPromptTemplate,
    managedTaskCategory: agent.managedTaskCategory,
    managedCapabilitySummary: agent.managedCapabilitySummary,
    enabled,
  };
}

export async function applyManagedLightAgentBatchAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents");
  const batchAction = String(formData.get("batchAction") || "").trim() as ManagedLightBatchAction;
  const selectedAgentIds = [...new Set(formData.getAll("agentIds").map((value) => String(value || "").trim()).filter(Boolean))];

  if (batchAction !== "delete" && batchAction !== "enable" && batchAction !== "disable") {
    redirect(buildStatusRedirect(redirectTo, "error", "未识别的羽量批量操作。"));
  }

  if (selectedAgentIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先勾选至少一个羽量 Agent。"));
  }

  try {
    const ownedAgents = await listAgents(userContext);
    const ownedAgentMap = new Map(ownedAgents.map((agent) => [agent.id, agent] as const));
    const selectedAgents = selectedAgentIds
      .map((agentId) => ownedAgentMap.get(agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
      .filter((agent) => agent.hostingMode === "managed_light");

    if (selectedAgents.length === 0) {
      redirect(buildStatusRedirect(redirectTo, "error", "未找到可操作的羽量 Agent。"));
    }

    if (batchAction === "delete") {
      for (const agent of selectedAgents) {
        await deleteAgent(userContext, agent.id);
      }
      redirect(buildStatusRedirect(successRedirectTo, "success", `已删除 ${selectedAgents.length} 个羽量 Agent。`));
    }

    const nextEnabled = batchAction === "enable";
    for (const agent of selectedAgents) {
      await updateAgent(userContext, agent.id, buildUpdateAgentInputFromView(agent, nextEnabled));
    }

    redirect(
      buildStatusRedirect(
        successRedirectTo,
        "success",
        batchAction === "enable"
          ? `已启用 ${selectedAgents.length} 个羽量 Agent。`
          : `已停用 ${selectedAgents.length} 个羽量 Agent。`,
      ),
    );
  } catch (error) {
    const message =
      batchAction === "delete"
        ? toMessage(error, "批量删除羽量 Agent 失败，请稍后重试。")
        : batchAction === "enable"
          ? toMessage(error, "批量启用羽量 Agent 失败，请稍后重试。")
          : toMessage(error, "批量停用羽量 Agent 失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function applyManagedCloudAgentBatchAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents?role=cloud");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents?role=cloud");
  const batchAction = String(formData.get("batchAction") || "").trim() as ManagedLightBatchAction;
  const selectedAgentIds = [...new Set(formData.getAll("agentIds").map((value) => String(value || "").trim()).filter(Boolean))];

  if (batchAction !== "delete" && batchAction !== "enable" && batchAction !== "disable") {
    redirect(buildStatusRedirect(redirectTo, "error", "未识别的云端批量操作。"));
  }

  if (selectedAgentIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先勾选至少一个云端 Agent。"));
  }

  try {
    const ownedAgents = await listAgents(userContext);
    const ownedAgentMap = new Map(ownedAgents.map((agent) => [agent.id, agent] as const));
    const selectedAgents = selectedAgentIds
      .map((agentId) => ownedAgentMap.get(agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
      .filter((agent) => agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime");

    if (selectedAgents.length === 0) {
      redirect(buildStatusRedirect(redirectTo, "error", "未找到可操作的云端 Agent。"));
    }

    if (batchAction === "delete") {
      for (const agent of selectedAgents) {
        await deleteAgent(userContext, agent.id);
      }
      redirect(buildStatusRedirect(successRedirectTo, "success", `已删除 ${selectedAgents.length} 个云端 Agent。`));
    }

    const nextEnabled = batchAction === "enable";
    for (const agent of selectedAgents) {
      await updateAgent(userContext, agent.id, buildUpdateAgentInputFromView(agent, nextEnabled));
    }

    redirect(
      buildStatusRedirect(
        successRedirectTo,
        "success",
        batchAction === "enable"
          ? `已启用 ${selectedAgents.length} 个云端 Agent。`
          : `已停用 ${selectedAgents.length} 个云端 Agent。`,
      ),
    );
  } catch (error) {
    const message =
      batchAction === "delete"
        ? toMessage(error, "批量删除云端 Agent 失败，请稍后重试。")
        : batchAction === "enable"
          ? toMessage(error, "批量启用云端 Agent 失败，请稍后重试。")
          : toMessage(error, "批量停用云端 Agent 失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function applyManagedHeavyAgentBatchAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents?role=heavy");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents?role=heavy");
  const batchAction = String(formData.get("batchAction") || "").trim() as ManagedLightBatchAction;
  const selectedAgentIds = [...new Set(formData.getAll("agentIds").map((value) => String(value || "").trim()).filter(Boolean))];

  if (batchAction !== "delete" && batchAction !== "enable" && batchAction !== "disable") {
    redirect(buildStatusRedirect(redirectTo, "error", "未识别的重度批量操作。"));
  }

  if (selectedAgentIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先勾选至少一个重度智能体。"));
  }

  try {
    const ownedAgents = await listAgents(userContext);
    const ownedAgentMap = new Map(ownedAgents.map((agent) => [agent.id, agent] as const));
    const selectedAgents = selectedAgentIds
      .map((agentId) => ownedAgentMap.get(agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
      .filter((agent) => agent.hostingMode === "managed_heavy" || agent.hostingMode === "registry_only");

    if (selectedAgents.length === 0) {
      redirect(buildStatusRedirect(redirectTo, "error", "未找到可操作的重度智能体。"));
    }

    if (batchAction === "delete") {
      for (const agent of selectedAgents) {
        await deleteAgent(userContext, agent.id);
      }
      redirect(buildStatusRedirect(successRedirectTo, "success", `已删除 ${selectedAgents.length} 个重度智能体。`));
    }

    const nextEnabled = batchAction === "enable";
    for (const agent of selectedAgents) {
      await updateAgent(userContext, agent.id, buildUpdateAgentInputFromView(agent, nextEnabled));
    }

    redirect(
      buildStatusRedirect(
        successRedirectTo,
        "success",
        batchAction === "enable"
          ? `已启用 ${selectedAgents.length} 个重度智能体。`
          : `已停用 ${selectedAgents.length} 个重度智能体。`,
      ),
    );
  } catch (error) {
    const message =
      batchAction === "delete"
        ? toMessage(error, "批量删除重度智能体失败，请稍后重试。")
        : batchAction === "enable"
          ? toMessage(error, "批量启用重度智能体失败，请稍后重试。")
          : toMessage(error, "批量停用重度智能体失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

type BulkAgentImportListing = {
  publicTitle: string;
  publicDescription?: string | null;
  billingMode?: "flat_task" | "token_metered" | "property_metered";
  billingUnit?: string | null;
  meterKey?: string | null;
  priceCurrency?: "obsidian" | "mira";
  priceAmount: number;
  status?: "draft" | "published" | "paused";
  externalInvocationEnabled?: boolean;
  autoTakeEnabled?: boolean;
  autoTakeStatementTemplate?: string | null;
};

type BulkAgentImportCapability = {
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
  listing?: BulkAgentImportListing | null;
};

type BulkAgentImportEntry = {
  agentLayer?: "managed_light" | "managed_heavy" | "open_protocol";
  name: string;
  description?: string | null;
  sourceType?: "platform" | "external";
  hostingMode?:
    | "managed_light"
    | "managed_heavy"
    | "open_protocol"
    | "registry_only"
    | "external_runtime"
    | "managed_api";
  authMode?: "none" | "apiKey" | "bearer";
  runtimeEndpoint?: string | null;
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
  capabilities?: BulkAgentImportCapability[];
};

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseOptionalJsonRecord(value: FormDataEntryValue | null, fieldLabel: string) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel} 不是合法 JSON。`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} 需要是 JSON 对象。`);
  }
  return parsed as Record<string, unknown>;
}

function buildStructuredResourcePropertySchema(
  type: string,
  description: string | null,
  marker: string | null,
  defaultResource:
    | {
        kind: "text";
        value: string;
      }
    | {
        kind: "file";
        fileName: string;
        contentType: string | null;
        dataUrl: string;
      }
    | null,
): Record<string, unknown> {
  const normalizedDescription = description?.trim() || undefined;
  const normalizedMarker = marker?.trim() || undefined;
  const markerExtension = normalizedMarker ? { "x-openagent-marker": normalizedMarker } : {};
  const defaultResourceExtension = defaultResource ? { "x-openagent-default-resource": defaultResource } : {};
  if (type === "number" || type === "integer" || type === "boolean" || type === "object" || type === "array") {
    return {
      type,
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "image") {
    return {
      type: "string",
      contentMediaType: "image/*",
      "x-openagent-resource-kind": "image",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "audio") {
    return {
      type: "string",
      contentMediaType: "audio/*",
      "x-openagent-resource-kind": "audio",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "video") {
    return {
      type: "string",
      contentMediaType: "video/*",
      "x-openagent-resource-kind": "video",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "archive") {
    return {
      type: "string",
      contentMediaType: "application/zip",
      "x-openagent-resource-kind": "archive",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "file") {
    return {
      type: "string",
      contentMediaType: "application/octet-stream",
      "x-openagent-resource-kind": "file",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "url") {
    return {
      type: "string",
      format: "uri",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  return {
    type: "string",
    ...(normalizedDescription ? { description: normalizedDescription } : {}),
    ...markerExtension,
    ...defaultResourceExtension,
  };
}

function parseStructuredResourceSchema(
  formData: FormData,
  prefix: "input" | "output",
  fieldLabel: string,
) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const name = String(formData.get(`${prefix}FieldName${index}`) || "").trim();
    if (!name) {
      continue;
    }
    const type = String(formData.get(`${prefix}FieldType${index}`) || "string").trim();
    const description = null;
    const marker = String(formData.get(`${prefix}FieldMarker${index}`) || "").trim() || null;
    const defaultText = String(formData.get(`${prefix}FieldDefaultText${index}`) || "").trim();
    const defaultFileName = String(formData.get(`${prefix}FieldDefaultFileName${index}`) || "").trim();
    const defaultFileType = String(formData.get(`${prefix}FieldDefaultFileType${index}`) || "").trim() || null;
    const defaultFileData = String(formData.get(`${prefix}FieldDefaultFileData${index}`) || "").trim();
    const defaultResource = defaultFileData
      ? {
          kind: "file" as const,
          fileName: defaultFileName || `${name}.bin`,
          contentType: defaultFileType,
          dataUrl: defaultFileData,
        }
      : defaultText
        ? {
            kind: "text" as const,
            value: defaultText,
          }
        : null;
    properties[name] = buildStructuredResourcePropertySchema(type, description, marker, defaultResource);
    if (String(formData.get(`${prefix}FieldRequired${index}`) || "").trim() === "true") {
      required.push(name);
    }
  }
  if (Object.keys(properties).length === 0) {
    return parseOptionalJsonRecord(formData.get(prefix === "input" ? "inputSchema" : "outputSchema"), fieldLabel);
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length > 0 ? { required } : {}),
  } satisfies Record<string, unknown>;
}

const managedLightTaskCategoryLabels = new Map<string, string>([
  ["image_processing", "图像处理"],
  ["video_processing", "视频处理"],
  ["audio_processing", "音频处理"],
  ["text_generation", "文本生成"],
  ["translation", "翻译改写"],
  ["coding", "代码处理"],
  ["data_analysis", "数据分析"],
]);

function formatManagedLightTaskCategoryLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return managedLightTaskCategoryLabels.get(value) ?? value;
}

function buildManagedLightCapabilityCode(name: string, category: string | null) {
  const slugSource = (category?.trim() || name.trim() || "primary-task").toLowerCase();
  const slug = slugSource.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug ? `primary-${slug}` : "primary-task";
}

function buildManagedCloudCapabilityCode(name: string) {
  const slugSource = (name.trim() || "cloud-agent").toLowerCase();
  const slug = slugSource.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug ? `cloud-${slug}` : "cloud-agent";
}

function buildManagedLightRoutingTags(category: string | null) {
  const tags = new Set<string>();
  const normalizedCategory = category?.trim() || "";
  const categoryLabel = formatManagedLightTaskCategoryLabel(normalizedCategory);
  if (categoryLabel) {
    tags.add(categoryLabel);
  }
  if (normalizedCategory && normalizedCategory !== categoryLabel) {
    tags.add(normalizedCategory);
  }
  return tags.size > 0 ? Array.from(tags) : null;
}

function buildManagedCloudRoutingTags() {
  return ["云端智能体", "高智能", "OpenAgent"];
}

function normalizeManagedLightListingBillingUnit(
  billingMode: "flat_task" | "token_metered" | "property_metered",
  value: string | null,
) {
  const normalized = value?.trim();
  if (normalized) {
    return normalized;
  }
  if (billingMode === "token_metered") {
    return "1k_tokens";
  }
  if (billingMode === "property_metered") {
    return "task_property";
  }
  return "task";
}

function normalizeManagedLightListingMeterKey(
  billingMode: "flat_task" | "token_metered" | "property_metered",
  value: string | null,
) {
  const normalized = value?.trim();
  if (billingMode !== "property_metered") {
    return null;
  }
  return normalized || "task_units";
}

function parseOptionalStringList(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const seen = new Set<string>();
  return raw
    .split(/[\r\n,，;；]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const normalized = item.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readOptionalRecord(value: unknown, fieldLabel: string) {
  if (value == null) {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldLabel} 需要是 JSON 对象。`);
  }
  return value as Record<string, unknown>;
}

function parseBulkAgentImportPayload(raw: string): BulkAgentImportEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("批量导入内容不是合法 JSON。");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("批量导入需要传入非空 JSON 数组。");
  }
  if (parsed.length > 20) {
    throw new Error("单次最多导入 20 个 agents。");
  }
  return parsed as BulkAgentImportEntry[];
}

export async function bulkImportAgentsAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const payload = String(formData.get("payload") || "").trim();
  if (!payload) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先填写批量导入 JSON。"));
  }

  try {
    const entries = parseBulkAgentImportPayload(payload);
    let createdAgentCount = 0;
    let createdCapabilityCount = 0;
    let createdListingCount = 0;
    let lastAgentId: string | null = null;

    for (const [entryIndex, entry] of entries.entries()) {
      const name = readOptionalString(entry?.name);
      if (!name) {
        throw new Error(`第 ${entryIndex + 1} 个 agent 缺少 name。`);
      }

      const inferredHostingMode =
        entry.agentLayer ||
        entry.hostingMode ||
        (readOptionalString(entry.runtimeEndpoint)
          ? "open_protocol"
          : readOptionalString(entry.managedServiceId) || readOptionalString(entry.managedApiBaseUrl)
            ? "managed_light"
            : readOptionalString(entry.managedApiKey)
              ? "managed_api"
            : "registry_only");
      const sourceType =
        entry.sourceType ||
        (inferredHostingMode === "open_protocol" || inferredHostingMode === "external_runtime" ? "external" : "platform");

      const agent = await createAgent(userContext, {
        name,
        description: readOptionalString(entry.description),
        sourceType,
        hostingMode: inferredHostingMode,
        authMode: entry.authMode || "none",
        runtimeEndpoint: readOptionalString(entry.runtimeEndpoint),
        runtimeAuthToken: readOptionalString(entry.runtimeAuthToken),
        managedServiceId: readOptionalString(entry.managedServiceId),
          managedProviderLabel: readOptionalString(entry.managedProviderLabel),
          managedApiBaseUrl: readOptionalString(entry.managedApiBaseUrl),
          managedModel: readOptionalString(entry.managedModel),
        managedApiKey: readOptionalString(entry.managedApiKey),
        managedSystemPrompt: readOptionalString(entry.managedSystemPrompt),
        managedPromptTemplate: readOptionalString(entry.managedPromptTemplate),
        managedTaskCategory: readOptionalString(entry.managedTaskCategory),
        managedCapabilitySummary: readOptionalString(entry.managedCapabilitySummary),
        enabled: readBoolean(entry.enabled, true),
      });
      createdAgentCount += 1;
      lastAgentId = agent.id;

      const capabilities = Array.isArray(entry.capabilities) ? entry.capabilities : [];
      for (const [capabilityIndex, capabilityEntry] of capabilities.entries()) {
        const code = readOptionalString(capabilityEntry?.code);
        const title = readOptionalString(capabilityEntry?.title);
        if (!code || !title) {
          throw new Error(`第 ${entryIndex + 1} 个 agent 的第 ${capabilityIndex + 1} 个 capability 缺少 code 或 title。`);
        }

        const capability = await addAgentCapability(userContext, agent.id, {
          code,
          title,
          description: readOptionalString(capabilityEntry.description),
          routingSummary: readOptionalString(capabilityEntry.routingSummary),
          routingTags: Array.isArray(capabilityEntry.routingTags)
            ? capabilityEntry.routingTags.filter((tag): tag is string => typeof tag === "string")
            : null,
          inputSchema: readOptionalRecord(capabilityEntry.inputSchema, "输入资源"),
          outputSchema: readOptionalRecord(capabilityEntry.outputSchema, "输出资源"),
          resourceNormalizationPrompt: readOptionalString(capabilityEntry.resourceNormalizationPrompt),
          pricingNote: readOptionalString(capabilityEntry.pricingNote),
          enabled: readBoolean(capabilityEntry.enabled, true),
        });
        createdCapabilityCount += 1;

        if (capabilityEntry.listing && typeof capabilityEntry.listing === "object") {
          const listing = capabilityEntry.listing;
          const publicTitle = readOptionalString(listing.publicTitle);
          const rawPriceAmount = Number(listing.priceAmount || 0);
          if (!publicTitle || !Number.isFinite(rawPriceAmount) || rawPriceAmount <= 0) {
            throw new Error(
              `第 ${entryIndex + 1} 个 agent 的 capability ${code} listing 缺少 publicTitle 或 priceAmount。`,
            );
          }
          await upsertAgentMarketplaceListing(userContext, {
            capabilityId: capability.id,
            publicTitle,
            publicDescription: readOptionalString(listing.publicDescription),
            billingMode: listing.billingMode || "flat_task",
            billingUnit: readOptionalString(listing.billingUnit),
            meterKey: readOptionalString(listing.meterKey),
            priceCurrency: listing.priceCurrency || "obsidian",
            priceAmount: Math.max(1, Math.floor(rawPriceAmount)),
            status: listing.status || "draft",
            externalInvocationEnabled: readBoolean(listing.externalInvocationEnabled, false),
            autoTakeEnabled: readBoolean(listing.autoTakeEnabled, false),
            autoTakeStatementTemplate: readOptionalString(listing.autoTakeStatementTemplate),
          });
          createdListingCount += 1;
        }
      }
    }

    redirect(
      buildStatusRedirect(
        setRedirectTargetQueryParams(redirectTo, { agentId: lastAgentId }),
        "success",
        `批量导入完成：${createdAgentCount} 个 agents，${createdCapabilityCount} 个 capabilities，${createdListingCount} 条供给。`,
      ),
    );
  } catch (error) {
    const message = toMessage(error, "批量导入失败，请检查 JSON 配置。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function addAgentCapabilityAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const agentId = String(formData.get("agentId") || "");
  const nextRedirectTarget = setRedirectTargetQueryParams(redirectTo, { agentId });
  if (!agentId) {
    redirect(buildStatusRedirect(nextRedirectTarget, "error", "Agent 参数无效。"));
  }

  try {
      await addAgentCapability(userContext, agentId, {
        code: String(formData.get("code") || "").trim(),
        title: String(formData.get("title") || "").trim(),
        description: String(formData.get("description") || "").trim() || null,
        routingSummary: String(formData.get("routingSummary") || "").trim() || null,
        routingTags: parseOptionalStringList(formData.get("routingTags")),
        pricingNote: String(formData.get("pricingNote") || "").trim() || null,
        inputSchema: parseStructuredResourceSchema(formData, "input", "输入资源"),
        outputSchema: parseStructuredResourceSchema(formData, "output", "输出资源"),
        resourceNormalizationPrompt: String(formData.get("resourceNormalizationPrompt") || "").trim() || null,
      enabled: String(formData.get("enabled") || "true") !== "false",
    });
    redirect(buildStatusRedirect(nextRedirectTarget, "success", "任务能力已添加。"));
  } catch (error) {
    const message = toMessage(error, "任务能力添加失败，请稍后重试。");
    redirect(buildStatusRedirect(nextRedirectTarget, "error", message));
  }
}

export async function upsertAgentMarketplaceListingAction(formData: FormData) {
  return upsertAgentMarketplaceListingActionImpl(formData);
}

export async function updateAgentMarketplaceListingStatusAction(formData: FormData) {
  return updateAgentMarketplaceListingStatusActionImpl(formData);
}

export async function runAgentMarketplaceAutoProposalSweepAction(formData: FormData) {
  return runAgentMarketplaceAutoProposalSweepActionImpl(formData);
}

export async function invokeAgentMarketplaceListingAction(formData: FormData) {
  return invokeAgentMarketplaceListingActionImpl(formData);
}

export async function invokeAgentMarketplaceListingBatchAction(formData: FormData) {
  return invokeAgentMarketplaceListingBatchActionImpl(formData);
}

export async function rotateAgentCallbackSecretAction(formData: FormData) {
  return rotateAgentCallbackSecretActionImpl(formData);
}

export async function updateAgentCallbackProtocolVersionAction(formData: FormData) {
  return updateAgentCallbackProtocolVersionActionImpl(formData);
}

export async function createAgentExecutionAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const agentId = String(formData.get("agentId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const objective = String(formData.get("objective") || "").trim();
  const presetId = String(formData.get("presetId") || "").trim();
  const focusSection = normalizeAgentExecutionLaunchPresetFocusSection(String(formData.get("focusSection") || "").trim());
  const followUpRunKind = normalizeAgentExecutionLaunchPresetRunKind(String(formData.get("followUpRunKind") || "").trim());
  const followUpRunStatus = normalizeAgentExecutionLaunchPresetRunStatus(
    String(formData.get("followUpRunStatus") || "").trim(),
  );
  const followUpFailureCategory = normalizeAgentExecutionLaunchPresetFailureCategory(
    String(formData.get("followUpFailureCategory") || "").trim(),
  );
  const followUpRecentWindow = normalizeAgentExecutionLaunchPresetRecentWindow(
    String(formData.get("followUpRecentWindow") || "").trim(),
  );
  const followUpCallbackStatus = normalizeAgentExecutionLaunchPresetCallbackStatus(
    String(formData.get("followUpCallbackStatus") || "").trim(),
  );
  const followUpCallbackRetryability = normalizeAgentExecutionLaunchPresetCallbackRetryability(
    String(formData.get("followUpCallbackRetryability") || "").trim(),
  );
  const followUpCallbackType = normalizeAgentExecutionLaunchPresetCallbackType(
    String(formData.get("followUpCallbackType") || "").trim(),
  );
  const followUpCallbackRejectionCategory = normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
    String(formData.get("followUpCallbackRejectionCategory") || "").trim(),
  );
  const followUpReplayPayloadCompatibility = normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
    String(formData.get("followUpReplayPayloadCompatibility") || "").trim(),
  );
  const followUpReplayPayloadReplayable = normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
    String(formData.get("followUpReplayPayloadReplayable") || "").trim(),
  );
  const followUpDecisionClass = normalizeAgentExecutionLaunchPresetDecisionClass(
    String(formData.get("followUpDecisionClass") || "").trim(),
  );
  const followUpReplayFailureClass = normalizeAgentExecutionLaunchPresetReplayFailureClass(
    String(formData.get("followUpReplayFailureClass") || "").trim(),
  );
  const followUpRuntimeDecisionClass = normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
    String(formData.get("followUpRuntimeDecisionClass") || "").trim(),
  );
  const followUpRuntimeDecisionSeverity = normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
    String(formData.get("followUpRuntimeDecisionSeverity") || "").trim(),
  );
  const followUpPressureLevel = normalizeAgentExecutionLaunchPresetPressureLevel(
    String(formData.get("followUpPressureLevel") || "").trim(),
  );
  const followUpSchedulingDecisionClass = normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
    String(formData.get("followUpSchedulingDecisionClass") || "").trim(),
  );
  const followUpRuntimeSessionKind = normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
    String(formData.get("followUpRuntimeSessionKind") || "").trim(),
  );
  const followUpRuntimeSessionState = normalizeAgentExecutionLaunchPresetRuntimeSessionState(
    String(formData.get("followUpRuntimeSessionState") || "").trim(),
  );
  const followUpExecutionStatusRaw = String(formData.get("followUpExecutionStatus") || "").trim();
  const followUpExecutionStatus =
    followUpExecutionStatusRaw === "queued" ||
    followUpExecutionStatusRaw === "running" ||
    followUpExecutionStatusRaw === "submitted" ||
    followUpExecutionStatusRaw === "completed" ||
    followUpExecutionStatusRaw === "failed" ||
    followUpExecutionStatusRaw === "cancelled"
      ? followUpExecutionStatusRaw
      : "";
  const runtimeProfileKey = normalizeAgentExecutionLaunchPresetRuntimeProfileKey(
    String(formData.get("runtimeProfileKey") || "").trim(),
  );
  const callbackRemediationPolicyKeyRaw = String(formData.get("callbackRemediationPolicyKey") || "").trim();
  const callbackRemediationPolicyKey =
    callbackRemediationPolicyKeyRaw &&
    callbackRemediationPolicyKeyRaw !== "inherit_agent" &&
    agentCallbackRemediationPolicyKeys.includes(
      callbackRemediationPolicyKeyRaw as (typeof agentCallbackRemediationPolicyKeys)[number],
    )
      ? (callbackRemediationPolicyKeyRaw as (typeof agentCallbackRemediationPolicyKeys)[number])
      : undefined;

  if (!agentId || !title || !objective) {
    redirect(`/agent-executions?status=error&message=${encodeURIComponent("执行会话参数无效。")}`);
  }

  try {
    await createAgentExecution(userContext, {
      agentId,
      title,
      objective,
      runtimeProfileKey: runtimeProfileKey ?? undefined,
      callbackRemediationPolicyKey,
    });
    const params = new URLSearchParams({
      status: "success",
      message: "执行会话已创建。",
    });
    if (presetId) {
      params.set("presetId", presetId);
    }
    if (runtimeProfileKey) {
      params.set("runtimeProfileKey", runtimeProfileKey);
    }
    if (followUpExecutionStatus) {
      params.set("executionStatus", followUpExecutionStatus);
    }
    if (followUpRunKind) {
      params.set("runKind", followUpRunKind);
    }
    if (followUpRunStatus) {
      params.set("runStatus", followUpRunStatus);
    }
    if (followUpFailureCategory) {
      params.set("failureCategory", followUpFailureCategory);
    }
    if (followUpRecentWindow) {
      params.set("recentWindow", followUpRecentWindow);
    }
    if (followUpCallbackStatus) {
      params.set("callbackStatus", followUpCallbackStatus);
    }
    if (followUpCallbackRetryability) {
      params.set("callbackRetryability", followUpCallbackRetryability);
    }
    if (followUpCallbackType) {
      params.set("callbackType", followUpCallbackType);
    }
    if (followUpCallbackRejectionCategory) {
      params.set("callbackRejectionCategory", followUpCallbackRejectionCategory);
    }
    if (followUpReplayPayloadCompatibility) {
      params.set("replayPayloadCompatibility", followUpReplayPayloadCompatibility);
    }
    if (followUpReplayPayloadReplayable !== null) {
      params.set("replayPayloadReplayable", followUpReplayPayloadReplayable ? "true" : "false");
    }
    if (followUpDecisionClass) {
      params.set("decisionClass", followUpDecisionClass);
    }
    if (followUpReplayFailureClass) {
      params.set("replayFailureClass", followUpReplayFailureClass);
    }
    if (followUpRuntimeDecisionClass) {
      params.set("runtimeDecisionClass", followUpRuntimeDecisionClass);
    }
    if (followUpRuntimeDecisionSeverity) {
      params.set("runtimeDecisionSeverity", followUpRuntimeDecisionSeverity);
    }
    if (followUpPressureLevel) {
      params.set("pressureLevel", followUpPressureLevel);
    }
    if (followUpSchedulingDecisionClass) {
      params.set("schedulingDecisionClass", followUpSchedulingDecisionClass);
    }
    if (followUpRuntimeSessionState) {
      params.set("sessionState", followUpRuntimeSessionState);
    }
    if (followUpRuntimeSessionKind) {
      params.set("sessionKind", followUpRuntimeSessionKind);
    }
    redirect(
      buildAgentExecutionsRedirectTarget({
        params,
        focusSection:
          focusSection ??
          (followUpRuntimeSessionKind || followUpRuntimeSessionState
            ? "runtime-sessions"
            : followUpPressureLevel || followUpSchedulingDecisionClass
              ? "cost-overview"
            : followUpExecutionStatus ||
                followUpRunKind ||
                followUpRunStatus ||
                followUpFailureCategory ||
                followUpRecentWindow ||
                followUpCallbackStatus ||
                followUpCallbackRetryability ||
                followUpCallbackType ||
                followUpCallbackRejectionCategory ||
                followUpReplayPayloadCompatibility ||
                followUpReplayPayloadReplayable !== null ||
                followUpDecisionClass ||
                followUpReplayFailureClass ||
                followUpRuntimeDecisionClass ||
                followUpRuntimeDecisionSeverity
              ? "execution-list"
            : null),
      }),
    );
  } catch (error) {
    const message = toMessage(error, "执行会话创建失败，请稍后重试。");
    const params = new URLSearchParams({
      status: "error",
      message,
    });
    if (presetId) {
      params.set("presetId", presetId);
    }
    if (followUpExecutionStatus) {
      params.set("executionStatus", followUpExecutionStatus);
    }
    if (followUpRunKind) {
      params.set("runKind", followUpRunKind);
    }
    if (followUpRunStatus) {
      params.set("runStatus", followUpRunStatus);
    }
    if (followUpFailureCategory) {
      params.set("failureCategory", followUpFailureCategory);
    }
    if (followUpRecentWindow) {
      params.set("recentWindow", followUpRecentWindow);
    }
    if (followUpCallbackStatus) {
      params.set("callbackStatus", followUpCallbackStatus);
    }
    if (followUpCallbackRetryability) {
      params.set("callbackRetryability", followUpCallbackRetryability);
    }
    if (followUpCallbackType) {
      params.set("callbackType", followUpCallbackType);
    }
    if (followUpCallbackRejectionCategory) {
      params.set("callbackRejectionCategory", followUpCallbackRejectionCategory);
    }
    if (followUpReplayPayloadCompatibility) {
      params.set("replayPayloadCompatibility", followUpReplayPayloadCompatibility);
    }
    if (followUpReplayPayloadReplayable !== null) {
      params.set("replayPayloadReplayable", followUpReplayPayloadReplayable ? "true" : "false");
    }
    if (followUpDecisionClass) {
      params.set("decisionClass", followUpDecisionClass);
    }
    if (followUpReplayFailureClass) {
      params.set("replayFailureClass", followUpReplayFailureClass);
    }
    if (followUpRuntimeDecisionClass) {
      params.set("runtimeDecisionClass", followUpRuntimeDecisionClass);
    }
    if (followUpRuntimeDecisionSeverity) {
      params.set("runtimeDecisionSeverity", followUpRuntimeDecisionSeverity);
    }
    if (runtimeProfileKey) {
      params.set("runtimeProfileKey", runtimeProfileKey);
    }
    if (followUpPressureLevel) {
      params.set("pressureLevel", followUpPressureLevel);
    }
    if (followUpSchedulingDecisionClass) {
      params.set("schedulingDecisionClass", followUpSchedulingDecisionClass);
    }
    if (followUpRuntimeSessionState) {
      params.set("sessionState", followUpRuntimeSessionState);
    }
    if (followUpRuntimeSessionKind) {
      params.set("sessionKind", followUpRuntimeSessionKind);
    }
    redirect(
      buildAgentExecutionsRedirectTarget({
        params,
        focusSection:
          focusSection ??
          (followUpRuntimeSessionKind || followUpRuntimeSessionState
            ? "runtime-sessions"
            : followUpPressureLevel || followUpSchedulingDecisionClass
              ? "cost-overview"
            : followUpExecutionStatus ||
                followUpRunKind ||
                followUpRunStatus ||
                followUpFailureCategory ||
                followUpRecentWindow ||
                followUpCallbackStatus ||
                followUpCallbackRetryability ||
                followUpCallbackType ||
                followUpCallbackRejectionCategory ||
                followUpReplayPayloadCompatibility ||
                followUpReplayPayloadReplayable !== null ||
                followUpDecisionClass ||
                followUpReplayFailureClass ||
                followUpRuntimeDecisionClass ||
                followUpRuntimeDecisionSeverity
              ? "execution-list"
            : null),
      }),
    );
  }
}

export async function saveAgentExecutionLaunchPresetAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const editingPresetId = String(formData.get("editingPresetId") || "").trim();
  const name = String(formData.get("presetName") || "").trim();
  const description = String(formData.get("presetDescription") || "").trim() || null;
  const isDefault = parseBooleanFormValue(formData.get("presetIsDefault"));
  const preferredAgentId = String(formData.get("presetPreferredAgentId") || "").trim() || null;
  const runtimeProfileKeyRaw = String(formData.get("presetRuntimeProfileKey") || "").trim();
  const runtimeProfileKey =
    runtimeProfileKeyRaw === "baseline" || runtimeProfileKeyRaw === "iterative" || runtimeProfileKeyRaw === "deep_runtime"
      ? runtimeProfileKeyRaw
      : null;
  const callbackRemediationPolicyKeyRaw = String(formData.get("presetCallbackRemediationPolicyKey") || "").trim();
  const callbackRemediationPolicyKey =
    callbackRemediationPolicyKeyRaw &&
    callbackRemediationPolicyKeyRaw !== "inherit_agent" &&
    agentCallbackRemediationPolicyKeys.includes(
      callbackRemediationPolicyKeyRaw as (typeof agentCallbackRemediationPolicyKeys)[number],
    )
      ? (callbackRemediationPolicyKeyRaw as (typeof agentCallbackRemediationPolicyKeys)[number])
      : null;
  const titleTemplate = String(formData.get("presetTitleTemplate") || "").trim() || null;
  const objectiveTemplate = String(formData.get("presetObjectiveTemplate") || "").trim() || null;
  const launchGuidance = String(formData.get("presetLaunchGuidance") || "").trim() || null;
  const followUpExecutionStatusRaw = String(formData.get("presetFollowUpExecutionStatus") || "").trim();
  const followUpExecutionStatus =
    followUpExecutionStatusRaw === "queued" ||
    followUpExecutionStatusRaw === "running" ||
    followUpExecutionStatusRaw === "submitted" ||
    followUpExecutionStatusRaw === "completed" ||
    followUpExecutionStatusRaw === "failed" ||
      followUpExecutionStatusRaw === "cancelled"
        ? followUpExecutionStatusRaw
        : null;
  const followUpRunKind = normalizeAgentExecutionLaunchPresetRunKind(
    String(formData.get("presetFollowUpRunKind") || "").trim(),
  );
  const followUpRunStatus = normalizeAgentExecutionLaunchPresetRunStatus(
    String(formData.get("presetFollowUpRunStatus") || "").trim(),
  );
  const followUpFailureCategory = normalizeAgentExecutionLaunchPresetFailureCategory(
    String(formData.get("presetFollowUpFailureCategory") || "").trim(),
  );
  const followUpRecentWindow = normalizeAgentExecutionLaunchPresetRecentWindow(
    String(formData.get("presetFollowUpRecentWindow") || "").trim(),
  );
  const followUpCallbackStatus = normalizeAgentExecutionLaunchPresetCallbackStatus(
    String(formData.get("presetFollowUpCallbackStatus") || "").trim(),
  );
  const followUpCallbackRetryability = normalizeAgentExecutionLaunchPresetCallbackRetryability(
    String(formData.get("presetFollowUpCallbackRetryability") || "").trim(),
  );
  const followUpCallbackType = normalizeAgentExecutionLaunchPresetCallbackType(
    String(formData.get("presetFollowUpCallbackType") || "").trim(),
  );
  const followUpCallbackRejectionCategory = normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
    String(formData.get("presetFollowUpCallbackRejectionCategory") || "").trim(),
  );
  const followUpReplayPayloadCompatibility = normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
    String(formData.get("presetFollowUpReplayPayloadCompatibility") || "").trim(),
  );
  const followUpReplayPayloadReplayable = normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
    String(formData.get("presetFollowUpReplayPayloadReplayable") || "").trim(),
  );
  const followUpDecisionClass = normalizeAgentExecutionLaunchPresetDecisionClass(
    String(formData.get("presetFollowUpDecisionClass") || "").trim(),
  );
  const followUpReplayFailureClass = normalizeAgentExecutionLaunchPresetReplayFailureClass(
    String(formData.get("presetFollowUpReplayFailureClass") || "").trim(),
  );
  const followUpRuntimeDecisionClass = normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
    String(formData.get("presetFollowUpRuntimeDecisionClass") || "").trim(),
  );
  const followUpRuntimeDecisionSeverity = normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
    String(formData.get("presetFollowUpRuntimeDecisionSeverity") || "").trim(),
  );
  const followUpPressureLevel = normalizeAgentExecutionLaunchPresetPressureLevel(
    String(formData.get("presetFollowUpPressureLevel") || "").trim(),
  );
  const followUpSchedulingDecisionClass = normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
    String(formData.get("presetFollowUpSchedulingDecisionClass") || "").trim(),
  );
  const followUpRuntimeSessionKind = normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
    String(formData.get("presetFollowUpRuntimeSessionKind") || "").trim(),
  );
  const followUpRuntimeSessionState = normalizeAgentExecutionLaunchPresetRuntimeSessionState(
    String(formData.get("presetFollowUpRuntimeSessionState") || "").trim(),
  );
  const focusSection = normalizeAgentExecutionLaunchPresetFocusSection(
    String(formData.get("presetFocusSection") || "").trim(),
  );

  if (!name) {
    redirect(`/agent-executions?status=error&message=${encodeURIComponent("执行 preset 名称不能为空。")}`);
  }

  try {
    const preset = editingPresetId
      ? await updateAgentExecutionLaunchPreset(userContext, editingPresetId, {
          name,
          description,
          isDefault,
          preferredAgentId,
          runtimeProfileKey,
            callbackRemediationPolicyKey,
            titleTemplate,
            objectiveTemplate,
            launchGuidance,
            followUpExecutionStatus,
            followUpRunKind,
            followUpRunStatus,
            followUpFailureCategory,
            followUpRecentWindow,
            followUpCallbackStatus,
            followUpCallbackRetryability,
            followUpCallbackType,
            followUpCallbackRejectionCategory,
            followUpReplayPayloadCompatibility,
            followUpReplayPayloadReplayable,
            followUpDecisionClass,
            followUpReplayFailureClass,
            followUpRuntimeDecisionClass,
            followUpRuntimeDecisionSeverity,
            followUpPressureLevel,
            followUpSchedulingDecisionClass,
            followUpRuntimeSessionKind,
            followUpRuntimeSessionState,
            focusSection,
          })
        : await createAgentExecutionLaunchPreset(userContext, {
            name,
            description,
            isDefault,
          preferredAgentId,
          runtimeProfileKey,
            callbackRemediationPolicyKey,
            titleTemplate,
            objectiveTemplate,
            launchGuidance,
            followUpExecutionStatus,
            followUpRunKind,
            followUpRunStatus,
            followUpFailureCategory,
            followUpRecentWindow,
            followUpCallbackStatus,
            followUpCallbackRetryability,
            followUpCallbackType,
            followUpCallbackRejectionCategory,
            followUpReplayPayloadCompatibility,
            followUpReplayPayloadReplayable,
            followUpDecisionClass,
            followUpReplayFailureClass,
            followUpRuntimeDecisionClass,
            followUpRuntimeDecisionSeverity,
            followUpPressureLevel,
            followUpSchedulingDecisionClass,
            followUpRuntimeSessionKind,
            followUpRuntimeSessionState,
            focusSection,
          });
      const params = new URLSearchParams({
        status: "success",
        message: editingPresetId ? "执行 launch preset 已更新。" : "执行 launch preset 已保存。",
        presetId: preset.id,
      });
      redirect(buildAgentExecutionsRedirectTarget({ params, focusSection: "launch-presets" }));
    } catch (error) {
      const message = toMessage(error, editingPresetId ? "更新执行 launch preset 失败，请稍后重试。" : "保存执行 launch preset 失败，请稍后重试。");
      const params = new URLSearchParams({
        status: "error",
        message,
      });
      if (editingPresetId) {
        params.set("editingPresetId", editingPresetId);
      }
      redirect(buildAgentExecutionsRedirectTarget({ params, focusSection: "launch-presets" }));
    }
  }

export async function setAgentExecutionLaunchPresetDefaultAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const presetId = String(formData.get("presetId") || "").trim();
  const selectedPresetId = String(formData.get("selectedPresetId") || "").trim();
  const editingPresetId = String(formData.get("editingPresetId") || "").trim();

  if (!presetId) {
    redirect(`/agent-executions?status=error&message=${encodeURIComponent("缺少待设为默认的执行 launch preset。")}`);
  }

  try {
    const preset = await setAgentExecutionLaunchPresetAsDefault(userContext, presetId);
    const params = new URLSearchParams({
      status: "success",
      message: "默认执行 launch preset 已更新。",
      presetId: selectedPresetId || preset.id,
    });
    if (editingPresetId) {
      params.set("editingPresetId", editingPresetId);
    }
    redirect(buildAgentExecutionsRedirectTarget({ params, focusSection: "launch-presets" }));
  } catch (error) {
    const message = toMessage(error, "设置默认执行 launch preset 失败，请稍后重试。");
    const params = new URLSearchParams({
      status: "error",
      message,
    });
    if (selectedPresetId) {
      params.set("presetId", selectedPresetId);
    }
    if (editingPresetId) {
      params.set("editingPresetId", editingPresetId);
    }
    redirect(buildAgentExecutionsRedirectTarget({ params, focusSection: "launch-presets" }));
  }
}

export async function applyAgentExecutionLaunchPresetSuggestedRuntimeProfileAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const presetId = String(formData.get("presetId") || "").trim();
  const selectedPresetId = String(formData.get("selectedPresetId") || "").trim();
  const editingPresetId = String(formData.get("editingPresetId") || "").trim();
  const pressureLevel = String(formData.get("pressureLevel") || "").trim();
  const schedulingDecisionClass = String(formData.get("schedulingDecisionClass") || "").trim();
  const runtimeProfileKey = normalizeAgentExecutionLaunchPresetRuntimeProfileKey(
    String(formData.get("runtimeProfileKey") || "").trim(),
  );

  if (!presetId || !runtimeProfileKey) {
    redirect(
      buildAgentExecutionsRedirectTarget({
        params: new URLSearchParams({
          status: "error",
          message: "缺少待调整的执行模板或建议 runtime profile。",
        }),
        focusSection: "active-preset",
      }),
    );
  }

  try {
    const presets = await listAgentExecutionLaunchPresets(userContext);
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) {
      throw new Error("目标执行模板不存在或当前用户无权访问。");
    }

    const updatedPreset = await updateAgentExecutionLaunchPreset(userContext, presetId, {
      name: preset.name,
      description: preset.description,
      isDefault: preset.isDefault,
      preferredAgentId: preset.preferredAgentId,
      runtimeProfileKey,
      callbackRemediationPolicyKey: preset.callbackRemediationPolicyKey,
      titleTemplate: preset.titleTemplate,
      objectiveTemplate: preset.objectiveTemplate,
      launchGuidance: preset.launchGuidance,
      followUpExecutionStatus: preset.followUpExecutionStatus,
      followUpRunKind: preset.followUpRunKind,
      followUpRunStatus: preset.followUpRunStatus,
      followUpFailureCategory: preset.followUpFailureCategory,
      followUpRecentWindow: preset.followUpRecentWindow,
      followUpCallbackStatus: preset.followUpCallbackStatus,
      followUpCallbackRetryability: preset.followUpCallbackRetryability,
      followUpCallbackType: preset.followUpCallbackType,
      followUpCallbackRejectionCategory: preset.followUpCallbackRejectionCategory,
      followUpReplayPayloadCompatibility: preset.followUpReplayPayloadCompatibility,
      followUpReplayPayloadReplayable: preset.followUpReplayPayloadReplayable,
      followUpDecisionClass: preset.followUpDecisionClass,
      followUpReplayFailureClass: preset.followUpReplayFailureClass,
      followUpRuntimeDecisionClass: preset.followUpRuntimeDecisionClass,
      followUpRuntimeDecisionSeverity: preset.followUpRuntimeDecisionSeverity,
      followUpPressureLevel: preset.followUpPressureLevel,
      followUpSchedulingDecisionClass: preset.followUpSchedulingDecisionClass,
      followUpRuntimeSessionKind: preset.followUpRuntimeSessionKind,
      followUpRuntimeSessionState: preset.followUpRuntimeSessionState,
      focusSection: preset.focusSection,
    });

    const params = new URLSearchParams({
      status: "success",
      message: `执行模板已切换到 ${updatedPreset.runtimeProfile.label}。`,
      presetId: selectedPresetId || updatedPreset.id,
    });
    if (editingPresetId) {
      params.set("editingPresetId", editingPresetId);
    }
    if (pressureLevel) {
      params.set("pressureLevel", pressureLevel);
    }
    if (schedulingDecisionClass) {
      params.set("schedulingDecisionClass", schedulingDecisionClass);
    }
    params.set("runtimeProfileKey", updatedPreset.runtimeProfileKey);
    redirect(buildAgentExecutionsRedirectTarget({ params, focusSection: "active-preset" }));
  } catch (error) {
    const params = new URLSearchParams({
      status: "error",
      message: toMessage(error, "应用建议 runtime profile 失败，请稍后重试。"),
    });
    if (selectedPresetId) {
      params.set("presetId", selectedPresetId);
    }
    if (editingPresetId) {
      params.set("editingPresetId", editingPresetId);
    }
    if (pressureLevel) {
      params.set("pressureLevel", pressureLevel);
    }
    if (schedulingDecisionClass) {
      params.set("schedulingDecisionClass", schedulingDecisionClass);
    }
    if (runtimeProfileKey) {
      params.set("runtimeProfileKey", runtimeProfileKey);
    }
    redirect(buildAgentExecutionsRedirectTarget({ params, focusSection: "active-preset" }));
  }
}

export async function deleteAgentExecutionLaunchPresetAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const presetId = String(formData.get("presetId") || "").trim();
  const selectedPresetId = String(formData.get("selectedPresetId") || "").trim();
  const editingPresetId = String(formData.get("editingPresetId") || "").trim();

  if (!presetId) {
    redirect(`/agent-executions?status=error&message=${encodeURIComponent("缺少待删除的执行 launch preset。")}`);
  }

  try {
    await deleteAgentExecutionLaunchPreset(userContext, presetId);
    const params = new URLSearchParams({
      status: "success",
      message: "执行 launch preset 已删除。",
    });
    if (selectedPresetId && selectedPresetId !== presetId) {
      params.set("presetId", selectedPresetId);
    }
    if (editingPresetId && editingPresetId !== presetId) {
      params.set("editingPresetId", editingPresetId);
    }
    redirect(buildAgentExecutionsRedirectTarget({ params, focusSection: "launch-presets" }));
  } catch (error) {
    const message = toMessage(error, "删除执行 launch preset 失败，请稍后重试。");
    const params = new URLSearchParams({
      status: "error",
      message,
    });
    if (selectedPresetId) {
      params.set("presetId", selectedPresetId);
    }
    if (editingPresetId) {
      params.set("editingPresetId", editingPresetId);
    }
    redirect(buildAgentExecutionsRedirectTarget({ params, focusSection: "launch-presets" }));
  }
}

export async function updateAgentExecutionCallbackRemediationPolicyAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agent-executions");
  const executionId = String(formData.get("executionId") || "").trim();
  const policyKeyRaw = String(formData.get("policyKey") || "").trim();
  const policyKey =
    policyKeyRaw &&
    policyKeyRaw !== "inherit_agent" &&
    agentCallbackRemediationPolicyKeys.includes(policyKeyRaw as (typeof agentCallbackRemediationPolicyKeys)[number])
      ? (policyKeyRaw as (typeof agentCallbackRemediationPolicyKeys)[number])
      : null;

  if (!executionId) {
    redirect(buildStatusRedirect(redirectTo, "error", "执行回调策略参数无效。"));
  }

  try {
    await updateAgentExecutionCallbackRemediationPolicy(userContext, executionId, { policyKey });
    redirect(buildStatusRedirect(redirectTo, "success", "执行回调策略已更新。"));
  } catch (error) {
    const message = toMessage(error, "执行回调策略更新失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function advanceArbitrationReviewRoundAction(formData: FormData) {
  "use server";

  const userContext = await requirePlatformOperatorUserContext();
  const caseId = String(formData.get("caseId") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const assignToOperatorUserId = String(formData.get("assignToOperatorUserId") || "").trim();
  const followUp = {
    caseStatus: String(formData.get("followUpCaseStatus") || "").trim() || null,
    taskResolutionAction: String(formData.get("followUpTaskResolutionAction") || "").trim() || null,
    impact: String(formData.get("followUpImpact") || "").trim() || null,
    evidenceKind: String(formData.get("followUpEvidenceKind") || "").trim() || null,
    hasEvidence: String(formData.get("followUpHasEvidence") || "").trim() || null,
    assignment: String(formData.get("followUpAssignment") || "").trim() || null,
  };

  if (!caseId) {
    redirect(`/arbitrations?status=error&message=${encodeURIComponent("案件参数无效。")}`);
  }

  try {
    await advanceArbitrationReviewRound(userContext, caseId, {
      summary: summary || undefined,
      assignToOperatorUserId: assignToOperatorUserId || undefined,
    });
    const params = new URLSearchParams({ status: "success", message: "已推进到下一轮审理。" });
    if (followUp.caseStatus) params.set("caseStatus", followUp.caseStatus);
    if (followUp.taskResolutionAction) params.set("taskResolutionAction", followUp.taskResolutionAction);
    if (followUp.impact) params.set("impact", followUp.impact);
    if (followUp.evidenceKind) params.set("evidenceKind", followUp.evidenceKind);
    if (followUp.hasEvidence) params.set("hasEvidence", followUp.hasEvidence);
    if (followUp.assignment) params.set("assignment", followUp.assignment);
    redirect(`/arbitrations?${params.toString()}`);
  } catch (error) {
    const message = toMessage(error, "推进下一轮审理失败。");
    const params = new URLSearchParams({ status: "error", message });
    if (followUp.caseStatus) params.set("caseStatus", followUp.caseStatus);
    if (followUp.taskResolutionAction) params.set("taskResolutionAction", followUp.taskResolutionAction);
    if (followUp.impact) params.set("impact", followUp.impact);
    if (followUp.evidenceKind) params.set("evidenceKind", followUp.evidenceKind);
    if (followUp.hasEvidence) params.set("hasEvidence", followUp.hasEvidence);
    if (followUp.assignment) params.set("assignment", followUp.assignment);
    redirect(`/arbitrations?${params.toString()}`);
  }
}

export async function createAgentExecutionSubtaskAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const executionId = String(formData.get("executionId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const detail = String(formData.get("detail") || "").trim();
  const parentSubtaskId = String(formData.get("parentSubtaskId") || "").trim();

  if (!executionId || !title) {
    redirect(`/agent-executions?status=error&message=${encodeURIComponent("子任务参数无效。")}`);
  }

  try {
    await createAgentExecutionSubtask(userContext, executionId, {
      title,
      detail: detail || undefined,
      parentSubtaskId: parentSubtaskId || undefined,
    });
    redirect(`/agent-executions?status=success&message=${encodeURIComponent("执行子任务已创建。")}`);
  } catch (error) {
    const message = toMessage(error, "创建执行子任务失败，请稍后重试。");
    redirect(`/agent-executions?status=error&message=${encodeURIComponent(message)}`);
  }
}

type AgentExecutionStatusAction = "queued" | "running" | "submitted" | "completed" | "failed" | "cancelled";

export async function updateAgentExecutionStatusAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agent-executions");
  const executionId = String(formData.get("executionId") || "");
  const status = String(formData.get("status") || "") as AgentExecutionStatusAction;
  const statusNote = String(formData.get("statusNote") || "").trim();
  const resultSummary = String(formData.get("resultSummary") || "").trim();

  if (!executionId || !["queued", "running", "submitted", "completed", "failed", "cancelled"].includes(status)) {
    redirect(buildStatusRedirect(redirectTo, "error", "执行状态参数无效。"));
  }

  try {
    await updateAgentExecutionStatus(userContext, executionId, {
      status,
      statusNote: statusNote || undefined,
      resultSummary: resultSummary || undefined,
    });
    redirect(buildStatusRedirect(redirectTo, "success", "执行状态已更新。"));
  } catch (error) {
    const message = toMessage(error, "执行状态更新失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function updateAgentExecutionSubtaskStatusAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const executionId = String(formData.get("executionId") || "").trim();
  const subtaskId = String(formData.get("subtaskId") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const detail = String(formData.get("detail") || "").trim();

  if (
    !executionId ||
    !subtaskId ||
    !["pending", "running", "completed", "failed", "cancelled"].includes(status)
  ) {
    redirect(`/agent-executions?status=error&message=${encodeURIComponent("子任务状态参数无效。")}`);
  }

  try {
    await updateAgentExecutionSubtaskStatus(userContext, executionId, subtaskId, {
      status: status as "pending" | "running" | "completed" | "failed" | "cancelled",
      detail: detail || undefined,
    });
    redirect(`/agent-executions?status=success&message=${encodeURIComponent("执行子任务状态已更新。")}`);
  } catch (error) {
    const message = toMessage(error, "更新执行子任务失败，请稍后重试。");
    redirect(`/agent-executions?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function requeueAgentExecutionAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agent-executions");
  const executionId = String(formData.get("executionId") || "").trim();

  if (!executionId) {
    redirect(buildStatusRedirect(redirectTo, "error", "执行参数无效。"));
  }

  try {
    await requeueAgentExecution(userContext, executionId);
    redirect(buildStatusRedirect(redirectTo, "success", "执行会话已重新入队。"));
  } catch (error) {
    const message = toMessage(error, "执行会话重新入队失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function recoverStalePlatformExecutionsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 10);
  const rawStaleSeconds = Number(formData.get("staleSeconds") || 900);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));
  const staleSeconds = Math.max(60, Math.min(Number.isFinite(rawStaleSeconds) ? Math.floor(rawStaleSeconds) : 900, 86_400));
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const runtimeSessionSlice = readRuntimeSessionSlice(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  let ownerReliefRunId: string | null = null;

  try {
    ownerReliefRunId = await ensureOwnerReliefRunId({
      userContext,
      formData,
      ownerReliefAction,
      runtimeSessionSlice,
      followUp,
    });
    const result = await recoverStalePlatformExecutions(userContext, {
      limit,
      staleSeconds,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
    });
    const message =
      result.recoveredCount > 0 || result.exhaustedCount > 0
        ? `恢复 watchdog 已处理：requeued ${result.recoveredCount}，budget exhausted ${result.exhaustedCount}。`
        : "当前没有命中 stale 条件的 platform execution。";
    await recordOwnerReliefRunActionIfNeeded({
      userContext,
      runId: ownerReliefRunId,
      actionKind: "recover",
      status: "success",
      title: "Recovered stale executions",
      detail: message,
      summary: buildOwnerReliefSummary({
        recoveredCount: result.recoveredCount,
        exhaustedCount: result.exhaustedCount,
        recoveryExecutionIds: result.results.map((entry) => entry.executionId),
        recoveryRunIds: result.results.map((entry) => entry.runId),
      }),
    });
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message,
          ...followUp,
          runKind: followUp.runKind ?? "recovery",
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
          ownerReliefRecoveredCount: ownerReliefAction ? result.recoveredCount : null,
          ownerReliefExhaustedCount: ownerReliefAction ? result.exhaustedCount : null,
          ownerReliefRecoveryExecutionIds: ownerReliefAction ? result.results.map((entry) => entry.executionId) : null,
          ownerReliefRecoveryRunIds: ownerReliefAction ? result.results.map((entry) => entry.runId) : null,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "stale platform execution 恢复失败，请稍后重试。");
    if (ownerReliefAction) {
      try {
        ownerReliefRunId =
          ownerReliefRunId ??
          (await ensureOwnerReliefRunId({
            userContext,
            formData,
            ownerReliefAction,
            runtimeSessionSlice,
            followUp,
          }));
        await recordOwnerReliefRunActionIfNeeded({
          userContext,
          runId: ownerReliefRunId,
          actionKind: "recover",
          status: "error",
          title: "Failed to recover stale executions",
          detail: message,
          summary: buildOwnerReliefSummary({}),
        });
      } catch {}
    }
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          runKind: followUp.runKind ?? "recovery",
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function runPlatformExecutorNowAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 3);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 3, 20));
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const runtimeSessionSlice = readRuntimeSessionSlice(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  let ownerReliefRunId: string | null = null;

  try {
    ownerReliefRunId = await ensureOwnerReliefRunId({
      userContext,
      formData,
      ownerReliefAction,
      runtimeSessionSlice,
      followUp,
    });
    const result = await runPlatformExecutorNow(userContext, {
      limit,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
    });
    const message =
      result.processedCount > 0 || result.failedCount > 0
        ? `platform executor 手动推进完成：processed ${result.processedCount}，failed ${result.failedCount}。`
        : "当前没有可推进的 platform execution，或执行器正在由其他循环处理。";
    await recordOwnerReliefRunActionIfNeeded({
      userContext,
      runId: ownerReliefRunId,
      actionKind: "run",
      status: "success",
      title: "Ran owner-scoped platform executor",
      detail: message,
      summary: buildOwnerReliefSummary({
        processedCount: result.processedCount,
        failedCount: result.failedCount,
        executorExecutionIds: [
          ...result.results.map((entry) => entry.executionId),
          ...result.failures.map((entry) => entry.executionId),
        ],
        executorRunIds: [
          ...result.results.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
          ...result.failures.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
        ],
      }),
    });
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message,
          ...followUp,
          runKind: followUp.runKind ?? "platform_executor",
          runStatus:
            followUp.runStatus ??
            (result.failedCount > 0 && result.processedCount === 0 ? "failed" : null),
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
          ownerReliefProcessedCount: ownerReliefAction ? result.processedCount : null,
          ownerReliefFailedCount: ownerReliefAction ? result.failedCount : null,
          ownerReliefExecutorExecutionIds: ownerReliefAction
            ? [...result.results.map((entry) => entry.executionId), ...result.failures.map((entry) => entry.executionId)]
            : null,
          ownerReliefExecutorRunIds: ownerReliefAction
            ? [
                ...result.results.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
                ...result.failures.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
              ]
            : null,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "platform executor 手动推进失败，请稍后重试。");
    if (ownerReliefAction) {
      try {
        ownerReliefRunId =
          ownerReliefRunId ??
          (await ensureOwnerReliefRunId({
            userContext,
            formData,
            ownerReliefAction,
            runtimeSessionSlice,
            followUp,
          }));
        await recordOwnerReliefRunActionIfNeeded({
          userContext,
          runId: ownerReliefRunId,
          actionKind: "run",
          status: "error",
          title: "Failed to run owner-scoped platform executor",
          detail: message,
          summary: buildOwnerReliefSummary({}),
        });
      } catch {}
    }
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          runKind: followUp.runKind ?? "platform_executor",
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function retryAgentExecutionSettlementAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const executionId = String(formData.get("executionId") || "").trim();
  if (!executionId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 executionId，无法重试结算。",
        ...followUp,
      }),
    );
  }

  try {
    await retryAgentExecutionSettlement(userContext, executionId);
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已触发 execution ${executionId} 的结算重试。`,
        ...followUp,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "触发 execution 结算重试失败。"),
        ...followUp,
      }),
    );
  }
}

export async function sweepRuntimeSessionsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 50);
  const rawStaleSeconds = Number(formData.get("staleSeconds") || 1800);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50, 500));
  const staleSeconds = Math.max(60, Math.min(Number.isFinite(rawStaleSeconds) ? Math.floor(rawStaleSeconds) : 1800, 86_400));
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agent-executions");
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const runtimeSessionSlice = readRuntimeSessionSlice(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  let ownerReliefRunId: string | null = null;
  const sweepMessage = (result: { closedCount: number; skippedCount: number }) =>
    `Runtime session sweep 完成：closed ${result.closedCount}，skipped ${result.skippedCount}。`;

  try {
    ownerReliefRunId = await ensureOwnerReliefRunId({
      userContext,
      formData,
      ownerReliefAction,
      runtimeSessionSlice,
      followUp,
    });
    const result = await sweepAgentExecutionRuntimeSessions(userContext, {
      limit,
      staleSeconds,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
      state: runtimeSessionSlice.state,
      kind: runtimeSessionSlice.kind,
      staleOnly: runtimeSessionSlice.staleOnly,
    });
    await recordOwnerReliefRunActionIfNeeded({
      userContext,
      runId: ownerReliefRunId,
      actionKind: "sweep",
      status: "success",
      title: "Swept owner-scoped runtime sessions",
      detail: sweepMessage(result),
      summary: buildOwnerReliefSummary({
        closedCount: result.closedCount,
        skippedCount: result.skippedCount,
      }),
    });
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message: sweepMessage(result),
          ...followUp,
          ownerReliefAction,
          ownerReliefRunId,
          ownerReliefClosedCount: ownerReliefAction ? result.closedCount : null,
          ownerReliefSkippedCount: ownerReliefAction ? result.skippedCount : null,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", sweepMessage(result)));
  } catch (error) {
    const message = toMessage(error, "Runtime session sweep 失败，请稍后重试。");
    if (ownerReliefAction) {
      try {
        ownerReliefRunId =
          ownerReliefRunId ??
          (await ensureOwnerReliefRunId({
            userContext,
            formData,
            ownerReliefAction,
            runtimeSessionSlice,
            followUp,
          }));
        await recordOwnerReliefRunActionIfNeeded({
          userContext,
          runId: ownerReliefRunId,
          actionKind: "sweep",
          status: "error",
          title: "Failed to sweep owner-scoped runtime sessions",
          detail: message,
          summary: buildOwnerReliefSummary({}),
        });
      } catch {}
    }
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          ownerReliefAction,
          ownerReliefRunId,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function recoverThenRunPlatformExecutorAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawRecoveryLimit = Number(formData.get("recoveryLimit") || formData.get("limit") || 10);
  const rawExecutorLimit = Number(formData.get("executorLimit") || 3);
  const rawStaleSeconds = Number(formData.get("staleSeconds") || 900);
  const recoveryLimit = Math.max(1, Math.min(Number.isFinite(rawRecoveryLimit) ? Math.floor(rawRecoveryLimit) : 10, 50));
  const executorLimit = Math.max(1, Math.min(Number.isFinite(rawExecutorLimit) ? Math.floor(rawExecutorLimit) : 3, 20));
  const staleSeconds = Math.max(60, Math.min(Number.isFinite(rawStaleSeconds) ? Math.floor(rawStaleSeconds) : 900, 86_400));
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const runtimeSessionSlice = readRuntimeSessionSlice(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  let ownerReliefRunId: string | null = null;

  try {
    ownerReliefRunId = await ensureOwnerReliefRunId({
      userContext,
      formData,
      ownerReliefAction,
      runtimeSessionSlice,
      followUp,
    });
    const recoveryResult = await recoverStalePlatformExecutions(userContext, {
      limit: recoveryLimit,
      staleSeconds,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
    });
    const executorResult = await runPlatformExecutorNow(userContext, {
      limit: executorLimit,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
    });
    const message =
      `组合 playbook 完成：recovery ${recoveryResult.recoveredCount}，` +
      `executor processed ${executorResult.processedCount}，failed ${executorResult.failedCount}。`;
    await recordOwnerReliefRunActionIfNeeded({
      userContext,
      runId: ownerReliefRunId,
      actionKind: "recover_then_run",
      status: "success",
      title: "Recovered then ran owner slice",
      detail: message,
      summary: buildOwnerReliefSummary({
        recoveredCount: recoveryResult.recoveredCount,
        exhaustedCount: recoveryResult.exhaustedCount,
        processedCount: executorResult.processedCount,
        failedCount: executorResult.failedCount,
        recoveryExecutionIds: recoveryResult.results.map((entry) => entry.executionId),
        recoveryRunIds: recoveryResult.results.map((entry) => entry.runId),
        executorExecutionIds: [
          ...executorResult.results.map((entry) => entry.executionId),
          ...executorResult.failures.map((entry) => entry.executionId),
        ],
        executorRunIds: [
          ...executorResult.results.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
          ...executorResult.failures.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
        ],
      }),
    });
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message,
          ...followUp,
          runKind: followUp.runKind,
          runStatus:
            followUp.runStatus ??
            (executorResult.failedCount > 0 && executorResult.processedCount === 0 ? "failed" : null),
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
          ownerReliefRecoveredCount: ownerReliefAction ? recoveryResult.recoveredCount : null,
          ownerReliefExhaustedCount: ownerReliefAction ? recoveryResult.exhaustedCount : null,
          ownerReliefProcessedCount: ownerReliefAction ? executorResult.processedCount : null,
          ownerReliefFailedCount: ownerReliefAction ? executorResult.failedCount : null,
          ownerReliefRecoveryExecutionIds: ownerReliefAction
            ? recoveryResult.results.map((entry) => entry.executionId)
            : null,
          ownerReliefRecoveryRunIds: ownerReliefAction ? recoveryResult.results.map((entry) => entry.runId) : null,
          ownerReliefExecutorExecutionIds: ownerReliefAction
            ? [
                ...executorResult.results.map((entry) => entry.executionId),
                ...executorResult.failures.map((entry) => entry.executionId),
              ]
            : null,
          ownerReliefExecutorRunIds: ownerReliefAction
            ? [
                ...executorResult.results.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
                ...executorResult.failures.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
              ]
            : null,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "组合 playbook 执行失败，请稍后重试。");
    if (ownerReliefAction) {
      try {
        ownerReliefRunId =
          ownerReliefRunId ??
          (await ensureOwnerReliefRunId({
            userContext,
            formData,
            ownerReliefAction,
            runtimeSessionSlice,
            followUp,
          }));
        await recordOwnerReliefRunActionIfNeeded({
          userContext,
          runId: ownerReliefRunId,
          actionKind: "recover_then_run",
          status: "error",
          title: "Failed to recover and run owner slice",
          detail: message,
          summary: buildOwnerReliefSummary({}),
        });
      } catch {}
    }
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          runKind: followUp.runKind,
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function finalizeAgentExecutionOwnerReliefRunAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  const ownerReliefRunId = readOwnerReliefRunId(formData);
  const resultStatus = parseOwnerReliefRunResultStatus(formData.get("ownerReliefRunResultStatus"));
  const note = String(formData.get("ownerReliefRunResultNote") || "").trim() || null;
  const handoffTargetType = parseOwnerReliefRunHandoffTargetType(
    formData.get("ownerReliefRunHandoffTargetType"),
  );
  const handoffTarget = String(formData.get("ownerReliefRunHandoffTarget") || "").trim() || null;

  if (!ownerReliefRunId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "当前没有可结案的 owner relief run。",
        ...followUp,
        ownerReliefAction,
      }),
    );
  }
  if (!resultStatus) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "请选择有效的 owner relief closeout 结果。",
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
  if (resultStatus === "handed_off" && !handoffTargetType) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "结案为 handed off 时必须选择 handoff target type。",
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
  try {
    const run = await finalizeOperatorAgentExecutionOwnerReliefRun(userContext, ownerReliefRunId, {
      resultStatus,
      note,
      handoffTargetType,
      handoffTarget,
    });
    const resultLabel =
      resultStatus === "handed_off"
        ? `handed off (${handoffTargetType}${handoffTarget ? ` / ${handoffTarget}` : ""})`
        : resultStatus;
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `Owner relief run 已结案为 ${resultLabel}。最近结果：recovered ${run.latestSummary.recoveredCount} / processed ${run.latestSummary.processedCount} / failed ${run.latestSummary.failedCount}。`,
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId: run.id,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "结案 owner relief run 失败，请稍后重试。"),
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
}

export async function reopenAgentExecutionOwnerReliefRunAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const ownerReliefRunId = readOwnerReliefRunId(formData);

  if (!ownerReliefRunId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "当前没有可复开的 owner relief run。",
        ...followUp,
      }),
    );
  }

  try {
    const run = await reopenOperatorAgentExecutionOwnerReliefRun(userContext, ownerReliefRunId);
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已复开 owner relief run ${run.id}${run.reopenedFromRunId ? `，来源 ${run.reopenedFromRunId}` : ""}。`,
        ...followUp,
        ownerReliefRunId: run.id,
        fragment: "runtime-session-watch",
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "复开 owner relief run 失败，请稍后重试。"),
        ...followUp,
        ownerReliefRunId,
        fragment: "runtime-session-watch",
      }),
    );
  }
}

export async function requestRejectedCallbackRetryAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const auditId = String(formData.get("auditId") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUp = readAgentCallbackOpsFollowUp(formData);

  if (!auditId) {
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message: "callback audit 参数无效。",
          ...followUp,
          callbackStatus: followUp.callbackStatus ?? "rejected",
          runKind: followUp.runKind ?? "callback_retry_request",
          runStatus: followUp.runStatus ?? "completed",
          recentWindow: followUp.recentWindow ?? "15m",
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", "callback audit 参数无效。"));
  }

  try {
    const result = await requestRejectedCallbackRetry(userContext, auditId, {
      note: note || undefined,
    });
    const message = `已记录 callback retry request：audit ${result.auditId} / callback ${result.callbackId}。`;
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message,
          ...followUp,
          agentId: followUp.agentId ?? result.agentId,
          callbackStatus: followUp.callbackStatus ?? "rejected",
          rejectionCategory: followUp.rejectionCategory ?? result.rejectionCategory,
          runKind: followUp.runKind ?? "callback_retry_request",
          runStatus: followUp.runStatus ?? "completed",
          recentWindow: followUp.recentWindow ?? "15m",
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "callback retry request 记录失败，请稍后重试。");
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          callbackStatus: followUp.callbackStatus ?? "rejected",
          runKind: followUp.runKind ?? "callback_retry_request",
          runStatus: followUp.runStatus ?? "completed",
          recentWindow: followUp.recentWindow ?? "15m",
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function cleanupExpiredAgentCallbackCompatibilityAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 25);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 25, 100));
  const followUp = readAgentCallbackOpsFollowUp(formData);

  try {
    const result = await cleanupExpiredAgentCallbackCompatibility(userContext, { limit });
    const message =
      result.cleanedCount > 0
        ? `已清理 ${result.cleanedCount} 个 agent 的过期兼容窗口：protocol ${result.protocolClearedCount}，secret ${result.secretClearedCount}。`
        : "当前没有已过期但尚未清理的 callback 兼容窗口。";
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message,
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "过期 callback 兼容窗口清理失败，请稍后重试。");
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function autoRemediateRejectedCallbackPayloadsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 10);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));
  const note = String(formData.get("note") || "").trim();
  const ignoreScheduleWindow = String(formData.get("ignoreScheduleWindow") || "").trim() !== "false";
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const agentId = String(formData.get("agentId") || "").trim() || undefined;
  const callbackType = String(formData.get("callbackType") || "").trim() || undefined;
  const remediationPolicyKey = String(formData.get("remediationPolicyKey") || "").trim() || undefined;
  const callbackVersionValue = String(formData.get("callbackVersion") || "").trim();
  const secretVersionValue = String(formData.get("secretVersion") || "").trim();
  const protocolMatch = String(formData.get("protocolMatch") || "").trim() || undefined;
  const secretMatch = String(formData.get("secretMatch") || "").trim() || undefined;
  const retryability = String(formData.get("retryability") || "").trim() || undefined;
  const autoRemediationReasonCategory =
    String(formData.get("autoRemediationReasonCategory") || "").trim() || undefined;
  const autoRemediationReasonDisposition =
    String(formData.get("autoRemediationReasonDisposition") || "").trim() || undefined;
  const replayPayloadCompatibility = normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
    String(formData.get("replayPayloadCompatibility") || "").trim(),
  );
  const replayPayloadReplayable = normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
    String(formData.get("replayPayloadReplayable") || "").trim(),
  );
  const decisionClass = String(formData.get("decisionClass") || "").trim() || undefined;
  const replayFailureClass = String(formData.get("replayFailureClass") || "").trim() || undefined;
  const runtimeDecisionClass = String(formData.get("runtimeDecisionClass") || "").trim() || undefined;
  const runtimeDecisionSeverity = String(formData.get("runtimeDecisionSeverity") || "").trim() || undefined;
  const runtimePressureLevel = String(formData.get("runtimePressureLevel") || "").trim() || undefined;
  const runtimeSchedulingDecisionClass =
    String(formData.get("runtimeSchedulingDecisionClass") || "").trim() || undefined;
  const rejectionCategory = String(formData.get("rejectionCategory") || "").trim() || undefined;

  try {
    const result = await autoRemediateRejectedCallbackPayloads(userContext, {
      agentId,
      callbackType: callbackType as "status" | "artifact" | "heartbeat" | "callback" | undefined,
      remediationPolicyKey:
        remediationPolicyKey as "manual_only" | "safe_retry" | "balanced" | "aggressive" | undefined,
      callbackVersion:
        callbackVersionValue && Number.isFinite(Number(callbackVersionValue)) ? Number(callbackVersionValue) : undefined,
      secretVersion:
        secretVersionValue && Number.isFinite(Number(secretVersionValue)) ? Number(secretVersionValue) : undefined,
      protocolMatch: protocolMatch as "current" | "previous" | undefined,
      secretMatch: secretMatch as "current" | "previous" | undefined,
      retryability: retryability as "retryable" | "inspect" | "not_retryable" | undefined,
      autoRemediationReasonCategory:
        autoRemediationReasonCategory as
          | "policy_disabled"
          | "missing_rejection_category"
          | "policy_budget_exhausted"
          | "missing_agent"
          | "missing_payload"
          | "incompatible_payload"
          | "compatibility_policy_blocked"
          | "compat_window_blocked"
          | "policy_not_covered"
          | "duplicate_cooldown"
          | "target_unavailable"
          | "attempt_failed"
          | undefined,
      autoRemediationReasonDisposition:
        autoRemediationReasonDisposition as "skipped" | "failed" | undefined,
      replayPayloadCompatibility: replayPayloadCompatibility ?? undefined,
      replayPayloadReplayable: replayPayloadReplayable ?? undefined,
      decisionClass:
        decisionClass as
          | "replay_current_payload"
          | "replay_legacy_payload"
          | "retry_missing_payload"
          | "retry_incompatible_payload"
          | "retry_compatibility_policy"
          | "retry_compat_window"
          | "retry_policy_preferred"
          | "skip_policy_disabled"
          | "skip_missing_rejection_category"
          | "skip_policy_budget_exhausted"
          | "skip_missing_payload"
          | "skip_incompatible_payload"
          | "skip_compatibility_policy"
          | "skip_compat_window"
          | "skip_policy_not_covered"
          | "skip_target_unavailable"
          | undefined,
      replayFailureClass:
        replayFailureClass as
          | "stored_payload_unavailable"
          | "callback_secret_unavailable"
          | "duplicate_replay_cooldown"
          | "agent_disabled"
          | "callback_not_retryable"
          | "unsupported_target"
          | "callback_protocol_mismatch"
          | undefined,
      runtimeDecisionClass:
        runtimeDecisionClass as
          | "prepare_continue"
          | "prepare_near_limit_cap"
          | "prepare_timeout_accelerated"
          | "artifact_batch_continue"
          | "artifact_batch_downshift_near_limit"
          | "artifact_finalize_early_near_limit"
          | "artifact_finalize_early_timeout"
          | "artifact_finalize_early_headroom"
          | "artifact_partial_finalize_blocked"
          | "finalize_continue"
          | "finalize_near_limit_cap"
          | "finalize_timeout_accelerated"
          | "finalize_completed"
          | undefined,
      runtimeDecisionSeverity: runtimeDecisionSeverity as "info" | "warning" | "critical" | undefined,
      runtimePressureLevel: coerceRuntimePressureLevel(runtimePressureLevel),
      runtimeSchedulingDecisionClass:
        coerceRuntimeSchedulingDecisionClass(runtimeSchedulingDecisionClass),
      rejectionCategory:
        rejectionCategory as
          | "invalid_secret"
          | "invalid_signature"
          | "invalid_timestamp"
          | "invalid_version"
          | "invalid_payload"
          | "processing_conflict"
          | "unsupported_target"
          | "unknown"
          | undefined,
      ignoreScheduleWindow,
      limit,
      note: note || undefined,
    });
    const message =
      `已执行一轮 callback auto-remediation：payload replay ${result.remediatedCount}，` +
      `retry request ${result.requestedRetryCount}，skipped ${result.skippedCount}，failed ${result.failedCount}。`;
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message,
        ...followUp,
        agentId: followUp.agentId ?? agentId ?? null,
        callbackType: followUp.callbackType ?? callbackType ?? null,
        callbackVersion: followUp.callbackVersion ?? (callbackVersionValue || null),
        secretVersion: followUp.secretVersion ?? (secretVersionValue || null),
        protocolMatch: followUp.protocolMatch ?? protocolMatch ?? null,
        secretMatch: followUp.secretMatch ?? secretMatch ?? null,
        retryability: followUp.retryability ?? (retryability || "retryable"),
        remediationPolicyKey: followUp.remediationPolicyKey ?? remediationPolicyKey ?? null,
        autoRemediationReasonCategory:
          followUp.autoRemediationReasonCategory ?? autoRemediationReasonCategory ?? null,
        autoRemediationReasonDisposition:
          followUp.autoRemediationReasonDisposition ?? autoRemediationReasonDisposition ?? null,
        decisionClass: followUp.decisionClass ?? decisionClass ?? null,
        replayFailureClass: followUp.replayFailureClass ?? replayFailureClass ?? null,
        runtimeDecisionClass: followUp.runtimeDecisionClass ?? runtimeDecisionClass ?? null,
        runtimeDecisionSeverity: followUp.runtimeDecisionSeverity ?? runtimeDecisionSeverity ?? null,
        runtimePressureLevel: followUp.runtimePressureLevel ?? runtimePressureLevel ?? null,
        runtimeSchedulingDecisionClass:
          followUp.runtimeSchedulingDecisionClass ?? runtimeSchedulingDecisionClass ?? null,
        rejectionCategory: followUp.rejectionCategory ?? rejectionCategory ?? null,
        callbackStatus: followUp.callbackStatus ?? "rejected",
        runKind: followUp.runKind ?? "callback_auto_remediation",
        recentWindow: followUp.recentWindow ?? "15m",
      }),
    );
  } catch (error) {
    const message = toMessage(error, "callback auto-remediation 执行失败，请稍后重试。");
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message,
        ...followUp,
        agentId: followUp.agentId ?? agentId ?? null,
        callbackType: followUp.callbackType ?? callbackType ?? null,
        callbackVersion: followUp.callbackVersion ?? (callbackVersionValue || null),
        secretVersion: followUp.secretVersion ?? (secretVersionValue || null),
        protocolMatch: followUp.protocolMatch ?? protocolMatch ?? null,
        secretMatch: followUp.secretMatch ?? secretMatch ?? null,
        retryability: followUp.retryability ?? (retryability || "retryable"),
        remediationPolicyKey: followUp.remediationPolicyKey ?? remediationPolicyKey ?? null,
        autoRemediationReasonCategory:
          followUp.autoRemediationReasonCategory ?? autoRemediationReasonCategory ?? null,
        autoRemediationReasonDisposition:
          followUp.autoRemediationReasonDisposition ?? autoRemediationReasonDisposition ?? null,
        decisionClass: followUp.decisionClass ?? decisionClass ?? null,
        replayFailureClass: followUp.replayFailureClass ?? replayFailureClass ?? null,
        runtimeDecisionClass: followUp.runtimeDecisionClass ?? runtimeDecisionClass ?? null,
        runtimeDecisionSeverity: followUp.runtimeDecisionSeverity ?? runtimeDecisionSeverity ?? null,
        runtimePressureLevel: followUp.runtimePressureLevel ?? runtimePressureLevel ?? null,
        runtimeSchedulingDecisionClass:
          followUp.runtimeSchedulingDecisionClass ?? runtimeSchedulingDecisionClass ?? null,
        rejectionCategory: followUp.rejectionCategory ?? rejectionCategory ?? null,
        callbackStatus: followUp.callbackStatus ?? "rejected",
        runKind: followUp.runKind ?? "callback_auto_remediation",
        recentWindow: followUp.recentWindow ?? "15m",
      }),
    );
  }
}

export async function emitCallbackRemediationAlertsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 10);
  const rawMinimumAlertLevel = Number(formData.get("minimumAlertLevel") || 2);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 20));
  const minimumAlertLevel = Math.max(
    1,
    Math.min(3, Number.isFinite(rawMinimumAlertLevel) ? Math.floor(rawMinimumAlertLevel) : 2),
  );
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const agentId = String(formData.get("agentId") || "").trim() || undefined;
  const callbackType = String(formData.get("callbackType") || "").trim() || undefined;
  const remediationPolicyKey = String(formData.get("remediationPolicyKey") || "").trim() || undefined;
  const autoRemediationReasonCategory =
    String(formData.get("autoRemediationReasonCategory") || "").trim() || undefined;
  const autoRemediationReasonDisposition =
    String(formData.get("autoRemediationReasonDisposition") || "").trim() || undefined;
  const replayPayloadCompatibility = normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
    String(formData.get("replayPayloadCompatibility") || "").trim(),
  );
  const replayPayloadReplayable = normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
    String(formData.get("replayPayloadReplayable") || "").trim(),
  );
  const decisionClass = String(formData.get("decisionClass") || "").trim() || undefined;
  const replayFailureClass = String(formData.get("replayFailureClass") || "").trim() || undefined;
  const runtimeDecisionClass = String(formData.get("runtimeDecisionClass") || "").trim() || undefined;
  const runtimeDecisionSeverity = String(formData.get("runtimeDecisionSeverity") || "").trim() || undefined;
  const runtimePressureLevel = String(formData.get("runtimePressureLevel") || "").trim() || undefined;
  const runtimeSchedulingDecisionClass =
    String(formData.get("runtimeSchedulingDecisionClass") || "").trim() || undefined;

  try {
    const result = await emitAgentExecutionCallbackRemediationAlerts(userContext, {
      agentId,
      callbackType: callbackType as "status" | "artifact" | "heartbeat" | "callback" | undefined,
      remediationPolicyKey:
        remediationPolicyKey as "manual_only" | "safe_retry" | "balanced" | "aggressive" | undefined,
      autoRemediationReasonCategory:
        autoRemediationReasonCategory as
          | "policy_disabled"
          | "missing_rejection_category"
          | "policy_budget_exhausted"
          | "missing_agent"
          | "missing_payload"
          | "incompatible_payload"
          | "compatibility_policy_blocked"
          | "compat_window_blocked"
          | "policy_not_covered"
          | "duplicate_cooldown"
          | "target_unavailable"
          | "attempt_failed"
          | undefined,
      autoRemediationReasonDisposition:
        autoRemediationReasonDisposition as "skipped" | "failed" | undefined,
      replayPayloadCompatibility: replayPayloadCompatibility ?? undefined,
      replayPayloadReplayable: replayPayloadReplayable ?? undefined,
      decisionClass:
        decisionClass as
          | "replay_current_payload"
          | "replay_legacy_payload"
          | "retry_missing_payload"
          | "retry_incompatible_payload"
          | "retry_compatibility_policy"
          | "retry_compat_window"
          | "retry_policy_preferred"
          | "skip_policy_disabled"
          | "skip_missing_rejection_category"
          | "skip_policy_budget_exhausted"
          | "skip_missing_payload"
          | "skip_incompatible_payload"
          | "skip_compatibility_policy"
          | "skip_compat_window"
          | "skip_policy_not_covered"
          | "skip_target_unavailable"
          | undefined,
      replayFailureClass:
        replayFailureClass as
          | "stored_payload_unavailable"
          | "callback_secret_unavailable"
          | "duplicate_replay_cooldown"
          | undefined,
      runtimeDecisionClass:
        runtimeDecisionClass as
          | "prepare_continue"
          | "prepare_near_limit_cap"
          | "prepare_timeout_accelerated"
          | "artifact_batch_continue"
          | "artifact_batch_downshift_near_limit"
          | "artifact_finalize_early_near_limit"
          | "artifact_finalize_early_timeout"
          | "artifact_finalize_early_headroom"
          | "artifact_partial_finalize_blocked"
          | "finalize_continue"
          | "finalize_near_limit_cap"
          | "finalize_timeout_accelerated"
          | "finalize_completed"
          | undefined,
      runtimeDecisionSeverity: runtimeDecisionSeverity as "info" | "warning" | "critical" | undefined,
      runtimePressureLevel: coerceRuntimePressureLevel(runtimePressureLevel),
      runtimeSchedulingDecisionClass:
        coerceRuntimeSchedulingDecisionClass(runtimeSchedulingDecisionClass),
      minimumAlertLevel,
      limit,
    });
    const message =
      result.dispatchedCount > 0 || result.skippedCount > 0
        ? `已派发 ${result.dispatchedCount} 条 callback remediation alert，跳过 ${result.skippedCount} 条近期重复告警。`
        : "当前没有命中需要派发的 callback remediation alert。";
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message,
        ...followUp,
        agentId: followUp.agentId ?? agentId ?? null,
        callbackType: followUp.callbackType ?? callbackType ?? null,
        remediationPolicyKey: followUp.remediationPolicyKey ?? remediationPolicyKey ?? null,
        autoRemediationReasonCategory:
          followUp.autoRemediationReasonCategory ?? autoRemediationReasonCategory ?? null,
        autoRemediationReasonDisposition:
          followUp.autoRemediationReasonDisposition ?? autoRemediationReasonDisposition ?? null,
        replayPayloadCompatibility:
          followUp.replayPayloadCompatibility ?? replayPayloadCompatibility ?? null,
        replayPayloadReplayable: followUp.replayPayloadReplayable ?? (replayPayloadReplayable !== null
          ? replayPayloadReplayable
            ? "true"
            : "false"
          : null),
        decisionClass: followUp.decisionClass ?? decisionClass ?? null,
        replayFailureClass: followUp.replayFailureClass ?? replayFailureClass ?? null,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "callback remediation alert 派发失败，请稍后重试。");
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message,
        ...followUp,
        agentId: followUp.agentId ?? agentId ?? null,
        callbackType: followUp.callbackType ?? callbackType ?? null,
        remediationPolicyKey: followUp.remediationPolicyKey ?? remediationPolicyKey ?? null,
        autoRemediationReasonCategory:
          followUp.autoRemediationReasonCategory ?? autoRemediationReasonCategory ?? null,
        autoRemediationReasonDisposition:
          followUp.autoRemediationReasonDisposition ?? autoRemediationReasonDisposition ?? null,
        replayPayloadCompatibility:
          followUp.replayPayloadCompatibility ?? replayPayloadCompatibility ?? null,
        replayPayloadReplayable: followUp.replayPayloadReplayable ?? (replayPayloadReplayable !== null
          ? replayPayloadReplayable
            ? "true"
            : "false"
          : null),
        decisionClass: followUp.decisionClass ?? decisionClass ?? null,
        replayFailureClass: followUp.replayFailureClass ?? replayFailureClass ?? null,
      }),
    );
  }
}

export async function emitRuntimePressureAlertsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 10);
  const rawMinimumAlertLevel = Number(formData.get("minimumAlertLevel") || 2);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 20));
  const minimumAlertLevel = Math.max(
    1,
    Math.min(3, Number.isFinite(rawMinimumAlertLevel) ? Math.floor(rawMinimumAlertLevel) : 2),
  );
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const pressureLevel = String(formData.get("runtimePressureLevel") || "").trim() || undefined;
  const schedulingDecisionClass = String(formData.get("runtimeSchedulingDecisionClass") || "").trim() || undefined;

  try {
    const result = await emitAgentExecutionRuntimePressureAlerts(userContext, {
      pressureLevel: pressureLevel as "healthy" | "watch" | "critical" | undefined,
      schedulingDecisionClass: schedulingDecisionClass as
        | "within_capacity"
        | "queue_backlog"
        | "profile_saturated"
        | "owner_hotspot"
        | "profile_and_owner_saturated"
        | undefined,
      minimumAlertLevel,
      limit,
    });
    const message =
      result.dispatchedCount > 0 || result.skippedCount > 0
        ? `已派发 ${result.dispatchedCount} 条 runtime pressure alert，跳过 ${result.skippedCount} 条近期重复告警。`
        : "当前没有命中需要派发的 runtime pressure alert。";
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message,
        ...followUp,
        runtimePressureLevel: followUp.runtimePressureLevel ?? pressureLevel ?? null,
        runtimeSchedulingDecisionClass:
          followUp.runtimeSchedulingDecisionClass ?? schedulingDecisionClass ?? null,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "runtime pressure alert 派发失败，请稍后重试。");
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message,
        ...followUp,
        runtimePressureLevel: followUp.runtimePressureLevel ?? pressureLevel ?? null,
        runtimeSchedulingDecisionClass:
          followUp.runtimeSchedulingDecisionClass ?? schedulingDecisionClass ?? null,
      }),
    );
  }
}

export async function acknowledgeNotificationWebhookIncidentAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const incidentKey = String(formData.get("incidentKey") || "").trim();
  const followUp = readAgentCallbackOpsFollowUp(formData);

  if (!incidentKey) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 incidentKey，无法确认当前 paging incident。",
        ...followUp,
      }),
    );
  }

  try {
    const result = await acknowledgeOperatorNotificationWebhookIncident(userContext, incidentKey);
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已确认 paging incident：${result.incidentKey}。`,
        ...followUp,
        incidentState: result.governanceState,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "确认 paging incident 失败，请稍后重试。"),
        ...followUp,
      }),
    );
  }
}

export async function silenceNotificationWebhookIncidentAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const incidentKey = String(formData.get("incidentKey") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const rawDuration = Number(formData.get("durationMinutes") || 60);
  const durationMinutes = Math.max(1, Math.min(Number.isFinite(rawDuration) ? Math.floor(rawDuration) : 60, 24 * 60));
  const followUp = readAgentCallbackOpsFollowUp(formData);

  if (!incidentKey) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 incidentKey，无法静默当前 paging incident。",
        ...followUp,
      }),
    );
  }

  try {
    const result = await silenceOperatorNotificationWebhookIncident(userContext, incidentKey, {
      durationMinutes,
      reason: reason || undefined,
    });
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已静默 paging incident，截止 ${result.silencedUntil ?? "未知"}。`,
        ...followUp,
        incidentState: result.governanceState,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "静默 paging incident 失败，请稍后重试。"),
        ...followUp,
      }),
    );
  }
}

export async function clearNotificationWebhookIncidentSilenceAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const incidentKey = String(formData.get("incidentKey") || "").trim();
  const followUp = readAgentCallbackOpsFollowUp(formData);

  if (!incidentKey) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 incidentKey，无法取消静默。",
        ...followUp,
      }),
    );
  }

  try {
    const result = await clearOperatorNotificationWebhookIncidentSilence(userContext, incidentKey);
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已取消 paging incident 的静默：${incidentKey}。`,
        ...followUp,
        incidentState: result.governanceState === "silenced" ? "silenced" : result.governanceState || null,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "取消 paging incident 静默失败，请稍后重试。"),
        ...followUp,
      }),
    );
  }
}

export async function acknowledgeNotificationWebhookIncidentBatchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const slice = readNotificationWebhookIncidentSlice(formData);
  const savedViewFollowUpIncidentState = readSavedViewFollowUpIncidentState(formData);
  const savedViewFocusSection = readSavedViewFocusSection(formData);
  const rawLimit = Number(formData.get("limit") || 10);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));

  try {
    const result = await acknowledgeOperatorNotificationWebhookIncidentsBatch(userContext, {
      limit,
      agentId: slice.agentId,
      callbackType: slice.callbackType,
      policyKey: slice.remediationPolicyKey,
      reasonCategory: slice.autoRemediationReasonCategory,
      reasonDisposition: slice.reasonDisposition,
      alertLevel:
        slice.alertLevel && Number.isFinite(Number(slice.alertLevel)) ? Number(slice.alertLevel) : null,
      governanceState:
        slice.incidentState === "active" ||
        slice.incidentState === "acknowledged" ||
        slice.incidentState === "silenced"
          ? slice.incidentState
          : null,
      projectId: slice.projectId,
      incidentId: slice.incidentId,
      routePolicyId: slice.routePolicyId,
      snapshotId: slice.snapshotId,
    });
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已批量确认 ${result.actedCount} 条 paging incident（匹配 ${result.matchedCount} 条）。`,
        ...followUp,
        incidentReasonDisposition: followUp.incidentReasonDisposition ?? slice.reasonDisposition,
        incidentAlertLevel: followUp.incidentAlertLevel ?? slice.alertLevel,
        projectId: followUp.projectId ?? slice.projectId,
        incidentId: followUp.incidentId ?? slice.incidentId,
        routePolicyId: followUp.routePolicyId ?? slice.routePolicyId,
        snapshotId: followUp.snapshotId ?? slice.snapshotId,
        incidentState: savedViewFollowUpIncidentState ?? "acknowledged",
        fragment: savedViewFocusSection,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "批量确认 paging incidents 失败，请稍后重试。"),
        ...followUp,
      }),
    );
  }
}

export async function silenceNotificationWebhookIncidentBatchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const slice = readNotificationWebhookIncidentSlice(formData);
  const savedViewFollowUpIncidentState = readSavedViewFollowUpIncidentState(formData);
  const savedViewFocusSection = readSavedViewFocusSection(formData);
  const reason = String(formData.get("reason") || "").trim();
  const rawLimit = Number(formData.get("limit") || 10);
  const rawDuration = Number(formData.get("durationMinutes") || 60);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));
  const durationMinutes = Math.max(1, Math.min(Number.isFinite(rawDuration) ? Math.floor(rawDuration) : 60, 24 * 60));

  try {
    const result = await silenceOperatorNotificationWebhookIncidentsBatch(userContext, {
      limit,
      durationMinutes,
      reason: reason || undefined,
      agentId: slice.agentId,
      callbackType: slice.callbackType,
      policyKey: slice.remediationPolicyKey,
      reasonCategory: slice.autoRemediationReasonCategory,
      reasonDisposition: slice.reasonDisposition,
      alertLevel:
        slice.alertLevel && Number.isFinite(Number(slice.alertLevel)) ? Number(slice.alertLevel) : null,
      governanceState:
        slice.incidentState === "active" ||
        slice.incidentState === "acknowledged" ||
        slice.incidentState === "silenced"
          ? slice.incidentState
          : null,
      projectId: slice.projectId,
      incidentId: slice.incidentId,
      routePolicyId: slice.routePolicyId,
      snapshotId: slice.snapshotId,
    });
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已批量静默 ${result.actedCount} 条 paging incident，截止 ${result.silencedUntil ?? "未知"}。`,
        ...followUp,
        incidentReasonDisposition: followUp.incidentReasonDisposition ?? slice.reasonDisposition,
        incidentAlertLevel: followUp.incidentAlertLevel ?? slice.alertLevel,
        projectId: followUp.projectId ?? slice.projectId,
        incidentId: followUp.incidentId ?? slice.incidentId,
        routePolicyId: followUp.routePolicyId ?? slice.routePolicyId,
        snapshotId: followUp.snapshotId ?? slice.snapshotId,
        incidentState: savedViewFollowUpIncidentState ?? "silenced",
        fragment: savedViewFocusSection,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "批量静默 paging incidents 失败，请稍后重试。"),
        ...followUp,
      }),
    );
  }
}

export async function clearNotificationWebhookIncidentSilenceBatchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const slice = readNotificationWebhookIncidentSlice(formData);
  const savedViewFollowUpIncidentState = readSavedViewFollowUpIncidentState(formData);
  const savedViewFocusSection = readSavedViewFocusSection(formData);
  const rawLimit = Number(formData.get("limit") || 10);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));

  try {
    const result = await clearOperatorNotificationWebhookIncidentSilencesBatch(userContext, {
      limit,
      agentId: slice.agentId,
      callbackType: slice.callbackType,
      policyKey: slice.remediationPolicyKey,
      reasonCategory: slice.autoRemediationReasonCategory,
      reasonDisposition: slice.reasonDisposition,
      alertLevel:
        slice.alertLevel && Number.isFinite(Number(slice.alertLevel)) ? Number(slice.alertLevel) : null,
      governanceState:
        slice.incidentState === "active" ||
        slice.incidentState === "acknowledged" ||
        slice.incidentState === "silenced"
          ? slice.incidentState
          : null,
      projectId: slice.projectId,
      incidentId: slice.incidentId,
      routePolicyId: slice.routePolicyId,
      snapshotId: slice.snapshotId,
    });
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已批量解除 ${result.actedCount} 条 paging incident 的静默（匹配 ${result.matchedCount} 条）。`,
        ...followUp,
        incidentReasonDisposition: followUp.incidentReasonDisposition ?? slice.reasonDisposition,
        incidentAlertLevel: followUp.incidentAlertLevel ?? slice.alertLevel,
        projectId: followUp.projectId ?? slice.projectId,
        incidentId: followUp.incidentId ?? slice.incidentId,
        routePolicyId: followUp.routePolicyId ?? slice.routePolicyId,
        snapshotId: followUp.snapshotId ?? slice.snapshotId,
        incidentState: savedViewFollowUpIncidentState,
        fragment: savedViewFocusSection,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "批量解除 paging incident 静默失败，请稍后重试。"),
        ...followUp,
      }),
    );
  }
}

export async function runNotificationWebhookIncidentSavedViewPlaybookAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const slice = readNotificationWebhookIncidentSlice(formData);
  const savedViewName = String(formData.get("savedViewName") || "").trim();
  const silenceReasonTemplate = String(formData.get("savedViewSilenceReasonTemplate") || "").trim() || null;
  const savedViewFollowUpIncidentState = readSavedViewFollowUpIncidentState(formData);
  const savedViewFocusSection = readSavedViewFocusSection(formData);
  const rawPreferredAction = String(formData.get("preferredAction") || "acknowledge").trim();
  const preferredAction =
    rawPreferredAction === "silence" || rawPreferredAction === "clear_silence"
      ? rawPreferredAction
      : "acknowledge";
  const rawLimit = Number(formData.get("limit") || 10);
  const rawDuration = Number(formData.get("durationMinutes") || 60);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));
  const durationMinutes = Math.max(1, Math.min(Number.isFinite(rawDuration) ? Math.floor(rawDuration) : 60, 24 * 60));
  const incidentReasonDisposition = followUp.incidentReasonDisposition ?? slice.reasonDisposition;
  const incidentAlertLevel = followUp.incidentAlertLevel ?? slice.alertLevel;
  const governanceState =
    slice.incidentState === "active" || slice.incidentState === "acknowledged" || slice.incidentState === "silenced"
      ? slice.incidentState
      : null;
  const redirectStateBase = {
    agentId: followUp.agentId ?? slice.agentId,
    callbackType: followUp.callbackType ?? slice.callbackType,
    callbackVersion: followUp.callbackVersion,
    secretVersion: followUp.secretVersion,
    callbackStatus: followUp.callbackStatus,
    remediationPolicyKey: followUp.remediationPolicyKey ?? slice.remediationPolicyKey,
    protocolMatch: followUp.protocolMatch,
    secretMatch: followUp.secretMatch,
    retryability: followUp.retryability,
    autoRemediationReasonCategory: followUp.autoRemediationReasonCategory ?? slice.autoRemediationReasonCategory,
    autoRemediationReasonDisposition: followUp.autoRemediationReasonDisposition,
    incidentReasonDisposition,
    incidentAlertLevel,
    projectId: followUp.projectId ?? slice.projectId,
    incidentId: followUp.incidentId ?? slice.incidentId,
    routePolicyId: followUp.routePolicyId ?? slice.routePolicyId,
    snapshotId: followUp.snapshotId ?? slice.snapshotId,
    rejectionCategory: followUp.rejectionCategory,
    runKind: followUp.runKind,
    runStatus: followUp.runStatus,
    executionStatus: followUp.executionStatus,
    failureCategory: followUp.failureCategory,
    recentWindow: followUp.recentWindow,
  };

  try {
    if (preferredAction === "silence") {
      const result = await silenceOperatorNotificationWebhookIncidentsBatch(userContext, {
        limit,
        durationMinutes,
        reason:
          silenceReasonTemplate ??
          (savedViewName ? `saved-view-playbook:${savedViewName}` : "saved-view-playbook"),
        agentId: slice.agentId,
        callbackType: slice.callbackType,
        policyKey: slice.remediationPolicyKey,
        reasonCategory: slice.autoRemediationReasonCategory,
        reasonDisposition: slice.reasonDisposition,
        alertLevel: slice.alertLevel && Number.isFinite(Number(slice.alertLevel)) ? Number(slice.alertLevel) : null,
        governanceState,
        projectId: slice.projectId,
        incidentId: slice.incidentId,
        routePolicyId: slice.routePolicyId,
        snapshotId: slice.snapshotId,
      });
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message: `已执行 saved view 预设动作：${savedViewName || "未命名视图"} 静默 ${result.actedCount} 条 incident，截止 ${result.silencedUntil ?? "未知"}。`,
          ...redirectStateBase,
          incidentState: savedViewFollowUpIncidentState ?? "silenced",
          fragment: savedViewFocusSection,
        }),
      );
    }

    if (preferredAction === "clear_silence") {
      const result = await clearOperatorNotificationWebhookIncidentSilencesBatch(userContext, {
        limit,
        agentId: slice.agentId,
        callbackType: slice.callbackType,
        policyKey: slice.remediationPolicyKey,
        reasonCategory: slice.autoRemediationReasonCategory,
        reasonDisposition: slice.reasonDisposition,
        alertLevel: slice.alertLevel && Number.isFinite(Number(slice.alertLevel)) ? Number(slice.alertLevel) : null,
        governanceState,
        projectId: slice.projectId,
        incidentId: slice.incidentId,
        routePolicyId: slice.routePolicyId,
        snapshotId: slice.snapshotId,
      });
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message: `已执行 saved view 预设动作：${savedViewName || "未命名视图"} 解除 ${result.actedCount} 条 incident 的静默（匹配 ${result.matchedCount} 条）。`,
          ...redirectStateBase,
          incidentState: savedViewFollowUpIncidentState,
          fragment: savedViewFocusSection,
        }),
      );
    }

    const result = await acknowledgeOperatorNotificationWebhookIncidentsBatch(userContext, {
      limit,
      agentId: slice.agentId,
      callbackType: slice.callbackType,
      policyKey: slice.remediationPolicyKey,
      reasonCategory: slice.autoRemediationReasonCategory,
      reasonDisposition: slice.reasonDisposition,
      alertLevel: slice.alertLevel && Number.isFinite(Number(slice.alertLevel)) ? Number(slice.alertLevel) : null,
      governanceState,
      projectId: slice.projectId,
      incidentId: slice.incidentId,
      routePolicyId: slice.routePolicyId,
      snapshotId: slice.snapshotId,
    });
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已执行 saved view 预设动作：${savedViewName || "未命名视图"} 确认 ${result.actedCount} 条 paging incident（匹配 ${result.matchedCount} 条）。`,
        ...redirectStateBase,
        incidentState: savedViewFollowUpIncidentState ?? "acknowledged",
        fragment: savedViewFocusSection,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "执行 incident saved view 预设动作失败，请稍后重试。"),
        ...redirectStateBase,
        incidentState: followUp.incidentState ?? slice.incidentState,
        fragment: savedViewFocusSection,
      }),
    );
  }
}

export async function saveNotificationWebhookIncidentViewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const viewId = String(formData.get("savedViewId") || "").trim();
  const name = String(formData.get("savedViewName") || "").trim();
  const description = String(formData.get("savedViewDescription") || "").trim() || null;
  const slice = readNotificationWebhookIncidentSlice(formData);

  if (!name) {
    redirect(buildStatusRedirect(redirectTo, "error", "请输入 incident saved view 名称。"));
  }

  try {
    const input = {
      name,
      description,
      isDefault: parseBooleanFormValue(formData.get("savedViewIsDefault")),
      filters: {
        agentId: slice.agentId,
        callbackType: slice.callbackType,
        policyKey: slice.remediationPolicyKey,
        reasonCategory: slice.autoRemediationReasonCategory,
        reasonDisposition: slice.reasonDisposition,
        alertLevel: slice.alertLevel && Number.isFinite(Number(slice.alertLevel)) ? Number(slice.alertLevel) : null,
        governanceState:
          slice.incidentState === "active" ||
          slice.incidentState === "acknowledged" ||
          slice.incidentState === "silenced"
            ? slice.incidentState
            : null,
        projectId: slice.projectId,
        incidentId: slice.incidentId,
        routePolicyId: slice.routePolicyId,
        snapshotId: slice.snapshotId,
      },
      playbookDefaults: {
        batchLimit: Number(formData.get("savedViewBatchLimit") || 10),
        silenceDurationMinutes: Number(formData.get("savedViewSilenceDurationMinutes") || 60),
        preferredAction: String(formData.get("savedViewPreferredAction") || "acknowledge").trim() as
          | "acknowledge"
          | "silence"
          | "clear_silence",
        silenceReasonTemplate: String(formData.get("savedViewSilenceReasonTemplate") || "").trim() || null,
        operatorGuidance: String(formData.get("savedViewOperatorGuidance") || "").trim() || null,
        followUpIncidentState: readSavedViewFollowUpIncidentState(formData),
        focusSection: readSavedViewFocusSection(formData),
      },
    } as const;

    if (viewId) {
      await updateOperatorNotificationWebhookIncidentSavedView(userContext, viewId, input);
      redirect(buildStatusRedirect(redirectTo, "success", `incident saved view ${name} 已更新。`));
    }

    await createOperatorNotificationWebhookIncidentSavedView(userContext, input);
    redirect(buildStatusRedirect(redirectTo, "success", `incident saved view ${name} 已保存。`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存 incident saved view 失败，请稍后重试。")));
  }
}

export async function overwriteNotificationWebhookIncidentViewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const viewId = String(formData.get("viewId") || "").trim();
  const name = String(formData.get("savedViewName") || "").trim();
  const description = String(formData.get("savedViewDescription") || "").trim() || null;
  const slice = readNotificationWebhookIncidentSlice(formData);

  if (!viewId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待覆盖的 incident saved view。"));
  }
  if (!name) {
    redirect(buildStatusRedirect(redirectTo, "error", "incident saved view 名称不能为空。"));
  }

  try {
    await updateOperatorNotificationWebhookIncidentSavedView(userContext, viewId, {
      name,
      description,
      isDefault: parseBooleanFormValue(formData.get("savedViewIsDefault")),
      filters: {
        agentId: slice.agentId,
        callbackType: slice.callbackType,
        policyKey: slice.remediationPolicyKey,
        reasonCategory: slice.autoRemediationReasonCategory,
        reasonDisposition: slice.reasonDisposition,
        alertLevel: slice.alertLevel && Number.isFinite(Number(slice.alertLevel)) ? Number(slice.alertLevel) : null,
        governanceState:
          slice.incidentState === "active" ||
          slice.incidentState === "acknowledged" ||
          slice.incidentState === "silenced"
            ? slice.incidentState
            : null,
        projectId: slice.projectId,
        incidentId: slice.incidentId,
        routePolicyId: slice.routePolicyId,
        snapshotId: slice.snapshotId,
      },
      playbookDefaults: {
        batchLimit: Number(formData.get("savedViewBatchLimit") || 10),
        silenceDurationMinutes: Number(formData.get("savedViewSilenceDurationMinutes") || 60),
        preferredAction: String(formData.get("savedViewPreferredAction") || "acknowledge").trim() as
          | "acknowledge"
          | "silence"
          | "clear_silence",
        silenceReasonTemplate: String(formData.get("savedViewSilenceReasonTemplate") || "").trim() || null,
        operatorGuidance: String(formData.get("savedViewOperatorGuidance") || "").trim() || null,
        followUpIncidentState: readSavedViewFollowUpIncidentState(formData),
        focusSection: readSavedViewFocusSection(formData),
      },
    });
    redirect(buildStatusRedirect(redirectTo, "success", `incident saved view ${name} 已用当前 slice 覆盖。`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "覆盖 incident saved view 失败，请稍后重试。")));
  }
}

export async function setDefaultNotificationWebhookIncidentViewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const viewId = String(formData.get("viewId") || "").trim();
  if (!viewId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待设为默认的 incident saved view。"));
  }

  try {
    await setOperatorDefaultNotificationWebhookIncidentSavedView(userContext, viewId);
    redirect(buildStatusRedirect(redirectTo, "success", "默认 incident saved view 已更新。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "设置默认 incident saved view 失败，请稍后重试。")));
  }
}

export async function deleteNotificationWebhookIncidentViewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const viewId = String(formData.get("viewId") || "").trim();
  if (!viewId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待删除的 incident saved view。"));
  }

  try {
    await deleteOperatorNotificationWebhookIncidentSavedView(userContext, viewId);
    redirect(buildStatusRedirect(redirectTo, "success", "incident saved view 已删除。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "删除 incident saved view 失败，请稍后重试。")));
  }
}

export async function requestRejectedCallbackRetryBatchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 20);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20, 50));
  const note = String(formData.get("note") || "").trim();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const agentId = String(formData.get("agentId") || "").trim() || undefined;
  const callbackType = String(formData.get("callbackType") || "").trim() || undefined;
  const remediationPolicyKey = String(formData.get("remediationPolicyKey") || "").trim() || undefined;
  const callbackVersionValue = String(formData.get("callbackVersion") || "").trim();
  const secretVersionValue = String(formData.get("secretVersion") || "").trim();
  const protocolMatch = String(formData.get("protocolMatch") || "").trim() || undefined;
  const secretMatch = String(formData.get("secretMatch") || "").trim() || undefined;
  const retryability = String(formData.get("retryability") || "").trim() || undefined;
  const autoRemediationReasonCategory =
    String(formData.get("autoRemediationReasonCategory") || "").trim() || undefined;
  const autoRemediationReasonDisposition =
    String(formData.get("autoRemediationReasonDisposition") || "").trim() || undefined;
  const replayPayloadCompatibility = normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
    String(formData.get("replayPayloadCompatibility") || "").trim(),
  );
  const replayPayloadReplayable = normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
    String(formData.get("replayPayloadReplayable") || "").trim(),
  );
  const decisionClass = String(formData.get("decisionClass") || "").trim() || undefined;
  const replayFailureClass = String(formData.get("replayFailureClass") || "").trim() || undefined;
  const runtimeDecisionClass = String(formData.get("runtimeDecisionClass") || "").trim() || undefined;
  const runtimeDecisionSeverity = String(formData.get("runtimeDecisionSeverity") || "").trim() || undefined;
  const runtimePressureLevel = String(formData.get("runtimePressureLevel") || "").trim() || undefined;
  const runtimeSchedulingDecisionClass =
    String(formData.get("runtimeSchedulingDecisionClass") || "").trim() || undefined;
  const rejectionCategory = String(formData.get("rejectionCategory") || "").trim() || undefined;

  try {
    const result = await requestRejectedCallbackRetryBatch(userContext, {
      agentId,
      callbackType: callbackType as "status" | "artifact" | "heartbeat" | "callback" | undefined,
      remediationPolicyKey: remediationPolicyKey as "manual_only" | "safe_retry" | "balanced" | "aggressive" | undefined,
      callbackVersion:
        callbackVersionValue && Number.isFinite(Number(callbackVersionValue)) ? Number(callbackVersionValue) : undefined,
      secretVersion:
        secretVersionValue && Number.isFinite(Number(secretVersionValue)) ? Number(secretVersionValue) : undefined,
      protocolMatch: protocolMatch as "current" | "previous" | undefined,
      secretMatch: secretMatch as "current" | "previous" | undefined,
      retryability: retryability as "retryable" | "inspect" | "not_retryable" | undefined,
      autoRemediationReasonCategory:
        autoRemediationReasonCategory as
          | "policy_disabled"
          | "missing_rejection_category"
          | "policy_budget_exhausted"
          | "missing_agent"
          | "missing_payload"
          | "incompatible_payload"
          | "compatibility_policy_blocked"
          | "compat_window_blocked"
          | "policy_not_covered"
          | "duplicate_cooldown"
          | "target_unavailable"
          | "attempt_failed"
          | undefined,
      autoRemediationReasonDisposition:
        autoRemediationReasonDisposition as "skipped" | "failed" | undefined,
      replayPayloadCompatibility: replayPayloadCompatibility ?? undefined,
      replayPayloadReplayable: replayPayloadReplayable ?? undefined,
      decisionClass:
        decisionClass as
          | "replay_current_payload"
          | "replay_legacy_payload"
          | "retry_missing_payload"
          | "retry_incompatible_payload"
          | "retry_compatibility_policy"
          | "retry_compat_window"
          | "retry_policy_preferred"
          | "skip_policy_disabled"
          | "skip_missing_rejection_category"
          | "skip_policy_budget_exhausted"
          | "skip_missing_payload"
          | "skip_incompatible_payload"
          | "skip_compatibility_policy"
          | "skip_compat_window"
          | "skip_policy_not_covered"
          | "skip_target_unavailable"
          | undefined,
      replayFailureClass:
        replayFailureClass as
          | "stored_payload_unavailable"
          | "callback_secret_unavailable"
          | "duplicate_replay_cooldown"
          | undefined,
      runtimeDecisionClass:
        runtimeDecisionClass as
          | "prepare_continue"
          | "prepare_near_limit_cap"
          | "prepare_timeout_accelerated"
          | "artifact_batch_continue"
          | "artifact_batch_downshift_near_limit"
          | "artifact_finalize_early_near_limit"
          | "artifact_finalize_early_timeout"
          | "artifact_finalize_early_headroom"
          | "artifact_partial_finalize_blocked"
          | "finalize_continue"
          | "finalize_near_limit_cap"
          | "finalize_timeout_accelerated"
          | "finalize_completed"
          | undefined,
      runtimeDecisionSeverity: runtimeDecisionSeverity as "info" | "warning" | "critical" | undefined,
      runtimePressureLevel: coerceRuntimePressureLevel(runtimePressureLevel),
      runtimeSchedulingDecisionClass:
        coerceRuntimeSchedulingDecisionClass(runtimeSchedulingDecisionClass),
      rejectionCategory:
        rejectionCategory as
          | "invalid_secret"
          | "invalid_signature"
          | "invalid_timestamp"
          | "invalid_version"
          | "invalid_payload"
          | "processing_conflict"
          | "unsupported_target"
          | "unknown"
          | undefined,
      limit,
      note: note || undefined,
    });
    const message =
      result.requestedCount > 0 || result.skippedCount > 0
        ? `已批量记录 ${result.requestedCount} 条 callback retry request，跳过 ${result.skippedCount} 条。`
        : "当前没有命中可批量记录 retry request 的 rejected callback。";
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message,
        ...followUp,
        agentId: followUp.agentId ?? agentId ?? null,
        callbackType: followUp.callbackType ?? callbackType ?? null,
        callbackVersion: followUp.callbackVersion ?? (callbackVersionValue || null),
        secretVersion: followUp.secretVersion ?? (secretVersionValue || null),
        callbackStatus: followUp.callbackStatus ?? "rejected",
        remediationPolicyKey: followUp.remediationPolicyKey ?? remediationPolicyKey ?? null,
        protocolMatch: followUp.protocolMatch ?? protocolMatch ?? null,
        secretMatch: followUp.secretMatch ?? secretMatch ?? null,
        retryability: followUp.retryability ?? retryability ?? "retryable",
        autoRemediationReasonCategory:
          followUp.autoRemediationReasonCategory ?? autoRemediationReasonCategory ?? null,
        autoRemediationReasonDisposition:
          followUp.autoRemediationReasonDisposition ?? autoRemediationReasonDisposition ?? null,
        decisionClass: followUp.decisionClass ?? decisionClass ?? null,
        replayFailureClass: followUp.replayFailureClass ?? replayFailureClass ?? null,
        runtimeDecisionClass: followUp.runtimeDecisionClass ?? runtimeDecisionClass ?? null,
        runtimeDecisionSeverity: followUp.runtimeDecisionSeverity ?? runtimeDecisionSeverity ?? null,
        runtimePressureLevel: followUp.runtimePressureLevel ?? runtimePressureLevel ?? null,
        runtimeSchedulingDecisionClass:
          followUp.runtimeSchedulingDecisionClass ?? runtimeSchedulingDecisionClass ?? null,
        rejectionCategory: followUp.rejectionCategory ?? rejectionCategory ?? null,
        runKind: followUp.runKind ?? "callback_retry_request",
        runStatus: followUp.runStatus ?? "completed",
        recentWindow: followUp.recentWindow ?? "15m",
      }),
    );
  } catch (error) {
    const message = toMessage(error, "callback retry request 批量记录失败，请稍后重试。");
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message,
        ...followUp,
        agentId: followUp.agentId ?? agentId ?? null,
        callbackType: followUp.callbackType ?? callbackType ?? null,
        callbackVersion: followUp.callbackVersion ?? (callbackVersionValue || null),
        secretVersion: followUp.secretVersion ?? (secretVersionValue || null),
        callbackStatus: followUp.callbackStatus ?? "rejected",
        remediationPolicyKey: followUp.remediationPolicyKey ?? remediationPolicyKey ?? null,
        protocolMatch: followUp.protocolMatch ?? protocolMatch ?? null,
        secretMatch: followUp.secretMatch ?? secretMatch ?? null,
        retryability: followUp.retryability ?? retryability ?? "retryable",
        autoRemediationReasonCategory:
          followUp.autoRemediationReasonCategory ?? autoRemediationReasonCategory ?? null,
        autoRemediationReasonDisposition:
          followUp.autoRemediationReasonDisposition ?? autoRemediationReasonDisposition ?? null,
        decisionClass: followUp.decisionClass ?? decisionClass ?? null,
        replayFailureClass: followUp.replayFailureClass ?? replayFailureClass ?? null,
        runtimeDecisionClass: followUp.runtimeDecisionClass ?? runtimeDecisionClass ?? null,
        runtimeDecisionSeverity: followUp.runtimeDecisionSeverity ?? runtimeDecisionSeverity ?? null,
        runtimePressureLevel: followUp.runtimePressureLevel ?? runtimePressureLevel ?? null,
        runtimeSchedulingDecisionClass:
          followUp.runtimeSchedulingDecisionClass ?? runtimeSchedulingDecisionClass ?? null,
        rejectionCategory: followUp.rejectionCategory ?? rejectionCategory ?? null,
        runKind: followUp.runKind ?? "callback_retry_request",
        runStatus: followUp.runStatus ?? "completed",
        recentWindow: followUp.recentWindow ?? "15m",
      }),
    );
  }
}

export async function replayRejectedCallbackPayloadAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const auditId = String(formData.get("auditId") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUp = readAgentCallbackOpsFollowUp(formData);

  if (!auditId) {
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message: "callback audit 参数无效。",
          ...followUp,
          callbackStatus: followUp.callbackStatus ?? "rejected",
          runKind: followUp.runKind ?? "callback_payload_replay",
          runStatus: followUp.runStatus ?? "completed",
          recentWindow: followUp.recentWindow ?? "15m",
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", "callback audit 参数无效。"));
  }

  try {
    const result = await replayRejectedCallbackPayload(userContext, auditId, {
      note: note || undefined,
    });
    const message = `已重放 stored payload：audit ${result.auditId} / replay ${result.replayCallbackId}。`;
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message,
          ...followUp,
          agentId: followUp.agentId ?? result.agentId,
          callbackType: followUp.callbackType ?? result.callbackType,
          callbackStatus: followUp.callbackStatus ?? "rejected",
          retryability: followUp.retryability ?? "retryable",
          runKind: followUp.runKind ?? "callback_payload_replay",
          runStatus: followUp.runStatus ?? "completed",
          recentWindow: followUp.recentWindow ?? "15m",
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "stored payload replay 失败，请稍后重试。");
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          callbackStatus: followUp.callbackStatus ?? "rejected",
          runKind: followUp.runKind ?? "callback_payload_replay",
          runStatus: followUp.runStatus ?? "completed",
          recentWindow: followUp.recentWindow ?? "15m",
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function addAgentExecutionArtifactAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const executionId = String(formData.get("executionId") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const summary = String(formData.get("summary") || "").trim();

  if (!executionId || !kind || !title) {
    redirect(`/agent-executions?status=error&message=${encodeURIComponent("成果物参数无效。")}`);
  }
  if (!["link", "note"].includes(kind)) {
    redirect(`/agent-executions?status=error&message=${encodeURIComponent("成果物类型无效。")}`);
  }

  try {
    await addAgentExecutionArtifact(userContext, executionId, {
      kind: kind as "link" | "note",
      title,
      url: url || undefined,
      summary: summary || undefined,
    });
    redirect(`/agent-executions?status=success&message=${encodeURIComponent("成果物已提交。")}`);
  } catch (error) {
    const message = toMessage(error, "成果物提交失败，请稍后重试。");
    redirect(`/agent-executions?status=error&message=${encodeURIComponent(message)}`);
  }
}
