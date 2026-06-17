"use server";

import { agentCallbackRemediationPolicyKeys } from "@neuro/contracts";

import { redirect } from "next/navigation";

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
import { buildAgentExecutionsRedirectTarget } from "@/lib/platform-agent-execution-action-utils";
import { buildStatusRedirect, resolveRedirectPath, toMessage } from "@/lib/platform-action-utils";
import {
  createAgentExecution,
  updateAgentExecutionCallbackRemediationPolicy,
} from "@/lib/platform-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

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
