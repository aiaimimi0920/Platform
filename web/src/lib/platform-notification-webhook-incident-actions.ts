"use server";

import {
  notificationWebhookIncidentSavedViewFocusSections,
  type NotificationWebhookIncidentSavedViewFocusSection,
} from "@neuro/contracts";

import { redirect } from "next/navigation";

import {
  acknowledgeOperatorNotificationWebhookIncident,
  acknowledgeOperatorNotificationWebhookIncidentsBatch,
  clearOperatorNotificationWebhookIncidentSilence,
  clearOperatorNotificationWebhookIncidentSilencesBatch,
  createOperatorNotificationWebhookIncidentSavedView,
  deleteOperatorNotificationWebhookIncidentSavedView,
  setOperatorDefaultNotificationWebhookIncidentSavedView,
  silenceOperatorNotificationWebhookIncident,
  silenceOperatorNotificationWebhookIncidentsBatch,
  updateOperatorNotificationWebhookIncidentSavedView,
} from "@/lib/account-client";
import {
  buildAgentCallbackOpsRedirect,
  readAgentCallbackOpsFollowUp,
} from "@/lib/platform-agent-callback-ops-action-utils";
import {
  buildStatusRedirect,
  parseBooleanFormValue,
  resolveRedirectPath,
  toMessage,
} from "@/lib/platform-action-utils";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";

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
