"use server";

import {
  agentCallbackRemediationPolicyKeys,
  type UpsertAccountAnnouncementInput,
} from "@neuro/contracts";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import {
  createAgentExecution,
  updateAgentExecutionCallbackRemediationPolicy,
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
} from "@/lib/agent-execution-launch-presets";
import { requirePlatformOperatorUserContext, requirePlatformUserContext } from "@/lib/platform-session";
import { buildAgentExecutionsRedirectTarget } from "@/lib/platform-agent-execution-action-utils";
import {
  applyAgentExecutionLaunchPresetSuggestedRuntimeProfileAction as applyAgentExecutionLaunchPresetSuggestedRuntimeProfileActionImpl,
  deleteAgentExecutionLaunchPresetAction as deleteAgentExecutionLaunchPresetActionImpl,
  saveAgentExecutionLaunchPresetAction as saveAgentExecutionLaunchPresetActionImpl,
  setAgentExecutionLaunchPresetDefaultAction as setAgentExecutionLaunchPresetDefaultActionImpl,
} from "@/lib/platform-agent-execution-preset-actions";
import {
  recoverStalePlatformExecutionsAction as recoverStalePlatformExecutionsActionImpl,
  recoverThenRunPlatformExecutorAction as recoverThenRunPlatformExecutorActionImpl,
  retryAgentExecutionSettlementAction as retryAgentExecutionSettlementActionImpl,
  runPlatformExecutorNowAction as runPlatformExecutorNowActionImpl,
  sweepRuntimeSessionsAction as sweepRuntimeSessionsActionImpl,
} from "@/lib/platform-agent-execution-runtime-actions";
import {
  addAgentExecutionArtifactAction as addAgentExecutionArtifactActionImpl,
  advanceArbitrationReviewRoundAction as advanceArbitrationReviewRoundActionImpl,
  createAgentExecutionSubtaskAction as createAgentExecutionSubtaskActionImpl,
  requeueAgentExecutionAction as requeueAgentExecutionActionImpl,
  updateAgentExecutionStatusAction as updateAgentExecutionStatusActionImpl,
  updateAgentExecutionSubtaskStatusAction as updateAgentExecutionSubtaskStatusActionImpl,
} from "@/lib/platform-agent-execution-support-actions";
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
  autoRemediateRejectedCallbackPayloadsAction as autoRemediateRejectedCallbackPayloadsActionImpl,
  cleanupExpiredAgentCallbackCompatibilityAction as cleanupExpiredAgentCallbackCompatibilityActionImpl,
  emitCallbackRemediationAlertsAction as emitCallbackRemediationAlertsActionImpl,
  emitRuntimePressureAlertsAction as emitRuntimePressureAlertsActionImpl,
  replayRejectedCallbackPayloadAction as replayRejectedCallbackPayloadActionImpl,
  requestRejectedCallbackRetryAction as requestRejectedCallbackRetryActionImpl,
  requestRejectedCallbackRetryBatchAction as requestRejectedCallbackRetryBatchActionImpl,
} from "@/lib/platform-agent-callback-remediation-actions";
import {
  addAgentCapabilityAction as addAgentCapabilityActionImpl,
  applyManagedCloudAgentBatchAction as applyManagedCloudAgentBatchActionImpl,
  applyManagedHeavyAgentBatchAction as applyManagedHeavyAgentBatchActionImpl,
  applyManagedLightAgentBatchAction as applyManagedLightAgentBatchActionImpl,
  bulkImportAgentsAction as bulkImportAgentsActionImpl,
  createAgentAction as createAgentActionImpl,
  saveManagedCloudAgentAction as saveManagedCloudAgentActionImpl,
  saveManagedHeavyAgentAction as saveManagedHeavyAgentActionImpl,
  saveManagedLightAgentAction as saveManagedLightAgentActionImpl,
} from "@/lib/platform-managed-agent-actions";
import {
  acknowledgeNotificationWebhookIncidentAction as acknowledgeNotificationWebhookIncidentActionImpl,
  acknowledgeNotificationWebhookIncidentBatchAction as acknowledgeNotificationWebhookIncidentBatchActionImpl,
  clearNotificationWebhookIncidentSilenceAction as clearNotificationWebhookIncidentSilenceActionImpl,
  clearNotificationWebhookIncidentSilenceBatchAction as clearNotificationWebhookIncidentSilenceBatchActionImpl,
  deleteNotificationWebhookIncidentViewAction as deleteNotificationWebhookIncidentViewActionImpl,
  overwriteNotificationWebhookIncidentViewAction as overwriteNotificationWebhookIncidentViewActionImpl,
  runNotificationWebhookIncidentSavedViewPlaybookAction as runNotificationWebhookIncidentSavedViewPlaybookActionImpl,
  saveNotificationWebhookIncidentViewAction as saveNotificationWebhookIncidentViewActionImpl,
  setDefaultNotificationWebhookIncidentViewAction as setDefaultNotificationWebhookIncidentViewActionImpl,
  silenceNotificationWebhookIncidentAction as silenceNotificationWebhookIncidentActionImpl,
  silenceNotificationWebhookIncidentBatchAction as silenceNotificationWebhookIncidentBatchActionImpl,
} from "@/lib/platform-notification-webhook-incident-actions";
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
  clearAgentExecutionOwnerReliefHandoffDefaultAction as clearAgentExecutionOwnerReliefHandoffDefaultActionImpl,
  finalizeAgentExecutionOwnerReliefRunAction as finalizeAgentExecutionOwnerReliefRunActionImpl,
  openAgentExecutionOwnerReliefRunHandoffAction as openAgentExecutionOwnerReliefRunHandoffActionImpl,
  reopenAgentExecutionOwnerReliefRunAction as reopenAgentExecutionOwnerReliefRunActionImpl,
  resolveAgentExecutionOwnerReliefHandoffAction as resolveAgentExecutionOwnerReliefHandoffActionImpl,
  saveAgentExecutionOwnerReliefHandoffDefaultAction as saveAgentExecutionOwnerReliefHandoffDefaultActionImpl,
} from "@/lib/platform-owner-relief-actions";
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

export async function saveAgentExecutionOwnerReliefHandoffDefaultAction(formData: FormData) {
  return saveAgentExecutionOwnerReliefHandoffDefaultActionImpl(formData);
}

export async function clearAgentExecutionOwnerReliefHandoffDefaultAction(formData: FormData) {
  return clearAgentExecutionOwnerReliefHandoffDefaultActionImpl(formData);
}

export async function openAgentExecutionOwnerReliefRunHandoffAction(formData: FormData) {
  return openAgentExecutionOwnerReliefRunHandoffActionImpl(formData);
}

export async function resolveAgentExecutionOwnerReliefHandoffAction(formData: FormData) {
  return resolveAgentExecutionOwnerReliefHandoffActionImpl(formData);
}

function parseBooleanFormValue(value: FormDataEntryValue | null, fallback = false) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
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
  return createAgentActionImpl(formData);
}

export async function saveManagedLightAgentAction(formData: FormData) {
  return saveManagedLightAgentActionImpl(formData);
}

export async function saveManagedCloudAgentAction(formData: FormData) {
  return saveManagedCloudAgentActionImpl(formData);
}

export async function saveManagedHeavyAgentAction(formData: FormData) {
  return saveManagedHeavyAgentActionImpl(formData);
}

export async function applyManagedLightAgentBatchAction(formData: FormData) {
  return applyManagedLightAgentBatchActionImpl(formData);
}

export async function applyManagedCloudAgentBatchAction(formData: FormData) {
  return applyManagedCloudAgentBatchActionImpl(formData);
}

export async function applyManagedHeavyAgentBatchAction(formData: FormData) {
  return applyManagedHeavyAgentBatchActionImpl(formData);
}

export async function bulkImportAgentsAction(formData: FormData) {
  return bulkImportAgentsActionImpl(formData);
}

export async function addAgentCapabilityAction(formData: FormData) {
  return addAgentCapabilityActionImpl(formData);
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
  return saveAgentExecutionLaunchPresetActionImpl(formData);
}

export async function setAgentExecutionLaunchPresetDefaultAction(formData: FormData) {
  return setAgentExecutionLaunchPresetDefaultActionImpl(formData);
}

export async function applyAgentExecutionLaunchPresetSuggestedRuntimeProfileAction(formData: FormData) {
  return applyAgentExecutionLaunchPresetSuggestedRuntimeProfileActionImpl(formData);
}

export async function deleteAgentExecutionLaunchPresetAction(formData: FormData) {
  return deleteAgentExecutionLaunchPresetActionImpl(formData);
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
  return advanceArbitrationReviewRoundActionImpl(formData);
}

export async function createAgentExecutionSubtaskAction(formData: FormData) {
  return createAgentExecutionSubtaskActionImpl(formData);
}

export async function updateAgentExecutionStatusAction(formData: FormData) {
  return updateAgentExecutionStatusActionImpl(formData);
}

export async function updateAgentExecutionSubtaskStatusAction(formData: FormData) {
  return updateAgentExecutionSubtaskStatusActionImpl(formData);
}

export async function requeueAgentExecutionAction(formData: FormData) {
  return requeueAgentExecutionActionImpl(formData);
}

export async function recoverStalePlatformExecutionsAction(formData: FormData) {
  return recoverStalePlatformExecutionsActionImpl(formData);
}

export async function runPlatformExecutorNowAction(formData: FormData) {
  return runPlatformExecutorNowActionImpl(formData);
}

export async function retryAgentExecutionSettlementAction(formData: FormData) {
  return retryAgentExecutionSettlementActionImpl(formData);
}

export async function sweepRuntimeSessionsAction(formData: FormData) {
  return sweepRuntimeSessionsActionImpl(formData);
}

export async function recoverThenRunPlatformExecutorAction(formData: FormData) {
  return recoverThenRunPlatformExecutorActionImpl(formData);
}

export async function finalizeAgentExecutionOwnerReliefRunAction(formData: FormData) {
  return finalizeAgentExecutionOwnerReliefRunActionImpl(formData);
}

export async function reopenAgentExecutionOwnerReliefRunAction(formData: FormData) {
  return reopenAgentExecutionOwnerReliefRunActionImpl(formData);
}
export async function requestRejectedCallbackRetryAction(formData: FormData) {
  return requestRejectedCallbackRetryActionImpl(formData);
}

export async function cleanupExpiredAgentCallbackCompatibilityAction(formData: FormData) {
  return cleanupExpiredAgentCallbackCompatibilityActionImpl(formData);
}

export async function autoRemediateRejectedCallbackPayloadsAction(formData: FormData) {
  return autoRemediateRejectedCallbackPayloadsActionImpl(formData);
}

export async function emitCallbackRemediationAlertsAction(formData: FormData) {
  return emitCallbackRemediationAlertsActionImpl(formData);
}

export async function emitRuntimePressureAlertsAction(formData: FormData) {
  return emitRuntimePressureAlertsActionImpl(formData);
}

export async function acknowledgeNotificationWebhookIncidentAction(formData: FormData) {
  return acknowledgeNotificationWebhookIncidentActionImpl(formData);
}

export async function silenceNotificationWebhookIncidentAction(formData: FormData) {
  return silenceNotificationWebhookIncidentActionImpl(formData);
}

export async function clearNotificationWebhookIncidentSilenceAction(formData: FormData) {
  return clearNotificationWebhookIncidentSilenceActionImpl(formData);
}

export async function acknowledgeNotificationWebhookIncidentBatchAction(formData: FormData) {
  return acknowledgeNotificationWebhookIncidentBatchActionImpl(formData);
}

export async function silenceNotificationWebhookIncidentBatchAction(formData: FormData) {
  return silenceNotificationWebhookIncidentBatchActionImpl(formData);
}

export async function clearNotificationWebhookIncidentSilenceBatchAction(formData: FormData) {
  return clearNotificationWebhookIncidentSilenceBatchActionImpl(formData);
}

export async function runNotificationWebhookIncidentSavedViewPlaybookAction(formData: FormData) {
  return runNotificationWebhookIncidentSavedViewPlaybookActionImpl(formData);
}

export async function saveNotificationWebhookIncidentViewAction(formData: FormData) {
  return saveNotificationWebhookIncidentViewActionImpl(formData);
}

export async function overwriteNotificationWebhookIncidentViewAction(formData: FormData) {
  return overwriteNotificationWebhookIncidentViewActionImpl(formData);
}

export async function setDefaultNotificationWebhookIncidentViewAction(formData: FormData) {
  return setDefaultNotificationWebhookIncidentViewActionImpl(formData);
}

export async function deleteNotificationWebhookIncidentViewAction(formData: FormData) {
  return deleteNotificationWebhookIncidentViewActionImpl(formData);
}

export async function requestRejectedCallbackRetryBatchAction(formData: FormData) {
  return requestRejectedCallbackRetryBatchActionImpl(formData);
}

export async function replayRejectedCallbackPayloadAction(formData: FormData) {
  return replayRejectedCallbackPayloadActionImpl(formData);
}

export async function addAgentExecutionArtifactAction(formData: FormData) {
  return addAgentExecutionArtifactActionImpl(formData);
}
