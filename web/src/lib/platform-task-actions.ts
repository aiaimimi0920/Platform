"use server";

import { redirect } from "next/navigation";

import {
  acceptTaskAgentProposal,
  applyForTask,
  createTask,
  createTaskAgentProposal,
  dispatchTaskNow,
  rejectTaskAgentProposal,
  updateDevelopmentQueueStatus,
  updateTaskLifecycle,
} from "@/lib/platform-client";
import { requirePlatformUserContext } from "@/lib/platform-session";
import {
  buildStatusRedirect,
  resolveRedirectPath,
  setRedirectTargetQueryParams,
  toMessage,
} from "@/lib/platform-action-utils";

function parseCapabilityCodes(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export async function createTaskAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tasks");
  try {
    const preferredCapabilityCodes = parseCapabilityCodes(String(formData.get("preferredCapabilityCodes") || ""));
    const pricingMode = String(formData.get("pricingMode") || "flat_task").trim();
    const normalizedPricingMode =
      pricingMode === "token_metered"
        ? "token_metered"
        : "flat_task";
    const rewardAmount = Number(formData.get("rewardAmount") || 0);
    const requiredBondAmount = Number.isFinite(rewardAmount) && rewardAmount > 0 ? Math.ceil(rewardAmount * 0.3) : 0;
    const input = {
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      pricingMode: normalizedPricingMode,
      billingUnit: normalizedPricingMode === "token_metered" ? "1k_tokens" : null,
      meterKey: null,
      meterQuantity: normalizedPricingMode === "token_metered" ? 1 : null,
      operationMode: "automatic" as const,
      rewardCurrency: (String(formData.get("rewardCurrency") || "obsidian") as "obsidian" | "mira"),
      rewardAmount,
      requiredBondAmount,
      ...(preferredCapabilityCodes.length > 0 ? { preferredCapabilityCodes } : {}),
    } as (Parameters<typeof createTask>[1] & { preferredCapabilityCodes?: string[] });
    await createTask(userContext, input);
    redirect(buildStatusRedirect(redirectTo, "success", "任务发布成功。"));
  } catch (error) {
    const message = toMessage(error, "任务发布失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function applyTaskAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tasks");
  const taskId = String(formData.get("taskId") || "");
  const statement = String(formData.get("statement") || "");
  const proposedEtaHours = Number(formData.get("proposedEtaHours") || 0);
  if (!taskId || !statement || !proposedEtaHours) return;
  try {
    await applyForTask(userContext, taskId, statement, proposedEtaHours);
    redirect(buildStatusRedirect(redirectTo, "success", "任务申请已提交。"));
  } catch (error) {
    const message = toMessage(error, "任务申请失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function dispatchTaskAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tasks");
  const taskId = String(formData.get("taskId") || "");
  if (!taskId) return;
  try {
    await dispatchTaskNow(userContext, taskId);
    redirect(buildStatusRedirect(redirectTo, "success", "任务已进入调度流程。"));
  } catch (error) {
    const message = toMessage(error, "任务调度失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function createTaskAgentProposalAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tasks");
  const taskId = String(formData.get("taskId") || "");
  const agentId = String(formData.get("agentId") || "");
  const statement = String(formData.get("statement") || "");
  const proposedEtaHours = Number(formData.get("proposedEtaHours") || 0);
  const proposedCostNote = String(formData.get("proposedCostNote") || "").trim();

  if (!taskId || !agentId || !statement || !proposedEtaHours) {
    redirect(buildStatusRedirect(redirectTo, "error", "Agent 提案参数无效。"));
  }

  try {
    await createTaskAgentProposal(userContext, taskId, {
      agentId,
      statement,
      proposedEtaHours,
      proposedCostNote: proposedCostNote || undefined,
    });
    redirect(buildStatusRedirect(redirectTo, "success", "Agent 提案已提交。"));
  } catch (error) {
    const message = toMessage(error, "Agent 提案提交失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function acceptTaskAgentProposalAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tasks");
  const taskId = String(formData.get("taskId") || "");
  const proposalId = String(formData.get("proposalId") || "");

  if (!taskId || !proposalId) {
    redirect(buildStatusRedirect(redirectTo, "error", "Agent 提案参数无效。"));
  }

  try {
    const result = await acceptTaskAgentProposal(userContext, taskId, proposalId);
    redirect(
      buildStatusRedirect(
        setRedirectTargetQueryParams(redirectTo, { executionId: result.executionId }),
        "success",
        `Agent 提案已接受，并创建执行会话 ${result.executionId}。`,
      ),
    );
  } catch (error) {
    const message = toMessage(error, "接受 Agent 提案失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function rejectTaskAgentProposalAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tasks");
  const taskId = String(formData.get("taskId") || "");
  const proposalId = String(formData.get("proposalId") || "");

  if (!taskId || !proposalId) {
    redirect(buildStatusRedirect(redirectTo, "error", "Agent 提案参数无效。"));
  }

  try {
    await rejectTaskAgentProposal(userContext, taskId, proposalId);
    redirect(buildStatusRedirect(redirectTo, "success", "Agent 提案已拒绝。"));
  } catch (error) {
    const message = toMessage(error, "拒绝 Agent 提案失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function updateDevelopmentQueueStatusAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/dashboard");
  const itemId = String(formData.get("itemId") || "");
  const status = String(formData.get("status") || "");

  if (!itemId || !["planned", "in_progress", "completed", "archived"].includes(status)) {
    redirect(buildStatusRedirect(redirectTo, "error", "开发排期参数无效。"));
  }

  try {
    await updateDevelopmentQueueStatus(userContext, itemId, {
      status: status as "planned" | "in_progress" | "completed" | "archived",
    });
    const labels: Record<string, string> = {
      planned: "开发排期已转为 planned。",
      in_progress: "开发排期已开始执行。",
      completed: "开发排期已标记完成。",
      archived: "开发排期已归档。",
    };
    redirect(buildStatusRedirect(redirectTo, "success", labels[status]));
  } catch (error) {
    const message = toMessage(error, "开发排期状态更新失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

type TaskLifecycleAction = "start" | "submit" | "accept" | "default" | "cancel";

export async function taskLifecycleAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tasks");
  const taskId = String(formData.get("taskId") || "");
  const action = String(formData.get("action") || "") as TaskLifecycleAction;
  if (!taskId || !["start", "submit", "accept", "default", "cancel"].includes(action)) {
    redirect(buildStatusRedirect(redirectTo, "error", "任务状态变更参数无效。"));
  }

  const labels: Record<TaskLifecycleAction, string> = {
    start: "任务已开始执行。",
    submit: "任务已提交验收。",
    accept: "任务已验收通过。",
    default: "任务已标记违约。",
    cancel: "任务已取消。",
  };

  try {
    await updateTaskLifecycle(userContext, taskId, action);
    redirect(buildStatusRedirect(redirectTo, "success", labels[action]));
  } catch (error) {
    const message = toMessage(error, "任务状态变更失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}
