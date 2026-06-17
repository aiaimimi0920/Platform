"use server";

import { redirect } from "next/navigation";

import {
  normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility,
  normalizeAgentExecutionLaunchPresetReplayPayloadReplayable,
} from "@/lib/agent-execution-launch-presets";
import {
  buildAgentCallbackOpsRedirect,
  readAgentCallbackOpsFollowUp,
} from "@/lib/platform-agent-callback-ops-action-utils";
import {
  coerceRuntimePressureLevel,
  coerceRuntimeSchedulingDecisionClass,
} from "@/lib/platform-agent-execution-runtime-action-utils";
import {
  autoRemediateRejectedCallbackPayloads,
  cleanupExpiredAgentCallbackCompatibility,
  emitAgentExecutionCallbackRemediationAlerts,
  emitAgentExecutionRuntimePressureAlerts,
  replayRejectedCallbackPayload,
  requestRejectedCallbackRetry,
  requestRejectedCallbackRetryBatch,
} from "@/lib/platform-client";
import { buildStatusRedirect, resolveRedirectPath, toMessage } from "@/lib/platform-action-utils";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
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
