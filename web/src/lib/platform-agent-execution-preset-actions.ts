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
import {
  createAgentExecutionLaunchPreset,
  deleteAgentExecutionLaunchPreset,
  listAgentExecutionLaunchPresets,
  setAgentExecutionLaunchPresetAsDefault,
  updateAgentExecutionLaunchPreset,
} from "@/lib/platform-client";
import { parseBooleanFormValue, toMessage } from "@/lib/platform-action-utils";
import { requirePlatformUserContext } from "@/lib/platform-session";

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
