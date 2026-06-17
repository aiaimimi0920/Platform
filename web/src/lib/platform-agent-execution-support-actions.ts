"use server";

import { redirect } from "next/navigation";

import {
  addAgentExecutionArtifact,
  advanceArbitrationReviewRound,
  createAgentExecutionSubtask,
  requeueAgentExecution,
  updateAgentExecutionStatus,
  updateAgentExecutionSubtaskStatus,
} from "@/lib/platform-client";
import { buildStatusRedirect, resolveRedirectPath, toMessage } from "@/lib/platform-action-utils";
import { requirePlatformOperatorUserContext, requirePlatformUserContext } from "@/lib/platform-session";

export async function advanceArbitrationReviewRoundAction(formData: FormData) {
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
