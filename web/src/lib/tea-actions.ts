"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import {
  acceptTeaTicket,
  addTeaTicketComment,
  analyzeTeaTicket,
  approveTeaTicket,
  cancelTeaTicket,
  closeTeaTicket,
  createTeaTicket,
  decomposeTeaTicket,
  editTeaTicket,
  planTeaTicket,
  rejectTeaTicket,
  retryTeaTicket,
  runTeaTicket,
  stopTeaTicket,
  updateTeaConfiguration,
} from "@/lib/tea-client";
import { requirePlatformUserContext } from "@/lib/platform-session";
import {
  parseCreateTeaTicketPayload,
  parseEditTeaTicketPayload,
  parseTeaCommentPayload,
  parseTeaRejectPayload,
} from "@/lib/tea-route-utils";

type TeaLifecycleAction =
  | "decompose"
  | "analyze"
  | "plan"
  | "approve"
  | "run"
  | "stop"
  | "retry"
  | "accept"
  | "close"
  | "cancel";

function resolveRedirectPath(value: FormDataEntryValue | null, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

function buildStatusRedirect(redirectTo: string, status: "success" | "error", message: string): string {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}${new URLSearchParams({ status, message }).toString()}`;
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeLifecycleAction(value: FormDataEntryValue | null): TeaLifecycleAction | null {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw === "decompose" ||
    raw === "analyze" ||
    raw === "plan" ||
    raw === "approve" ||
    raw === "run" ||
    raw === "stop" ||
    raw === "retry" ||
    raw === "accept" ||
    raw === "close" ||
    raw === "cancel"
    ? raw
    : null;
}

function lifecycleActionSuccessMessage(action: TeaLifecycleAction): string {
  switch (action) {
    case "decompose":
      return "Tea 已完成工单拆解。";
    case "analyze":
      return "Tea 已完成工单分析。";
    case "plan":
      return "Tea 已生成执行计划。";
    case "approve":
      return "Tea 工单已审批通过。";
    case "run":
      return "Tea 工单已进入 Loom 执行。";
    case "stop":
      return "Tea 已请求停止最新执行。";
    case "retry":
      return "Tea 已请求重试最新执行。";
    case "accept":
      return "Tea 工单已验收。";
    case "close":
      return "Tea 工单已关闭。";
    case "cancel":
      return "Tea 工单已取消。";
  }
}

export async function createTeaTicketAction(formData: FormData) {
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tea");
  let target = redirectTo;

  try {
    const userContext = await requirePlatformUserContext();
    const ticket = await createTeaTicket(
      userContext,
      parseCreateTeaTicketPayload({
        title: formData.get("title"),
        description: formData.get("description"),
      }),
    );
    target = buildStatusRedirect(redirectTo, "success", `Tea 工单 ${ticket.id} 已创建。`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    target = buildStatusRedirect(redirectTo, "error", toMessage(error, "Tea 工单创建失败。"));
  }

  redirect(target);
}

export async function editTeaTicketAction(formData: FormData) {
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tea");
  const ticketId = String(formData.get("ticketId") || "").trim();
  let target = redirectTo;

  if (!ticketId) {
    redirect(buildStatusRedirect(redirectTo, "error", "Tea 工单编辑参数无效。"));
  }

  try {
    const userContext = await requirePlatformUserContext();
    // Labels arrive as a single comma/newline-separated field; split and trim.
    const rawLabels = formData.get("labels");
    const labels =
      typeof rawLabels === "string"
        ? rawLabels
            .split(/[,\n]/)
            .map((label) => label.trim())
            .filter(Boolean)
        : undefined;
    const payload = parseEditTeaTicketPayload({
      title: formData.get("title"),
      description: formData.get("description"),
      priority: formData.get("priority"),
      labels,
    });
    await editTeaTicket(userContext, ticketId, payload);
    target = buildStatusRedirect(redirectTo, "success", "Tea 工单已更新。");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    target = buildStatusRedirect(redirectTo, "error", toMessage(error, "Tea 工单更新失败。"));
  }

  redirect(target);
}

export async function teaTicketLifecycleAction(formData: FormData) {
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tea");
  const ticketId = String(formData.get("ticketId") || "").trim();
  const action = normalizeLifecycleAction(formData.get("action"));
  let target = redirectTo;

  if (!ticketId || !action) {
    redirect(buildStatusRedirect(redirectTo, "error", "Tea 工单动作参数无效。"));
  }

  try {
    const userContext = await requirePlatformUserContext();
    switch (action) {
      case "decompose":
        await decomposeTeaTicket(userContext, ticketId);
        break;
      case "analyze":
        await analyzeTeaTicket(userContext, ticketId);
        break;
      case "plan":
        await planTeaTicket(userContext, ticketId);
        break;
      case "approve":
        await approveTeaTicket(userContext, ticketId);
        break;
      case "run":
        await runTeaTicket(userContext, ticketId);
        break;
      case "stop":
        await stopTeaTicket(userContext, ticketId);
        break;
      case "retry":
        await retryTeaTicket(userContext, ticketId);
        break;
      case "accept":
        await acceptTeaTicket(userContext, ticketId);
        break;
      case "close":
        await closeTeaTicket(userContext, ticketId);
        break;
      case "cancel":
        await cancelTeaTicket(userContext, ticketId);
        break;
    }
    target = buildStatusRedirect(redirectTo, "success", lifecycleActionSuccessMessage(action));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    target = buildStatusRedirect(redirectTo, "error", toMessage(error, "Tea 工单动作执行失败。"));
  }

  redirect(target);
}

export async function addTeaTicketCommentAction(formData: FormData) {
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tea");
  const ticketId = String(formData.get("ticketId") || "").trim();
  let target = redirectTo;

  if (!ticketId) {
    redirect(buildStatusRedirect(redirectTo, "error", "Tea 工单评论参数无效。"));
  }

  try {
    const userContext = await requirePlatformUserContext();
    await addTeaTicketComment(
      userContext,
      ticketId,
      parseTeaCommentPayload({
        body: formData.get("body"),
      }),
    );
    target = buildStatusRedirect(redirectTo, "success", "Tea 工单评论已提交。");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    target = buildStatusRedirect(redirectTo, "error", toMessage(error, "Tea 工单评论提交失败。"));
  }

  redirect(target);
}

export async function rejectTeaTicketAction(formData: FormData) {
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tea");
  const ticketId = String(formData.get("ticketId") || "").trim();
  let target = redirectTo;

  if (!ticketId) {
    redirect(buildStatusRedirect(redirectTo, "error", "Tea 工单驳回参数无效。"));
  }

  try {
    const userContext = await requirePlatformUserContext();
    await rejectTeaTicket(
      userContext,
      ticketId,
      parseTeaRejectPayload({
        reason: formData.get("reason"),
      }),
    );
    target = buildStatusRedirect(redirectTo, "success", "Tea 工单已驳回并要求补充信息。");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    target = buildStatusRedirect(redirectTo, "error", toMessage(error, "Tea 工单驳回失败。"));
  }

  redirect(target);
}

export async function updateTeaConfigurationAction(formData: FormData) {
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/tea/settings");
  const notificationsEnabled = String(formData.get("notifications_enabled") || "") === "true";
  const humanPolicy =
    String(formData.get("human_ticket_default_approval_policy") || "").trim() || "human_before_execute";
  const hookPolicy =
    String(formData.get("hook_ticket_default_approval_policy") || "").trim() || "plan_only";
  let target = redirectTo;

  try {
    const userContext = await requirePlatformUserContext();
    await updateTeaConfiguration(userContext, {
      notifications_enabled: notificationsEnabled,
      human_ticket_default_approval_policy: humanPolicy,
      hook_ticket_default_approval_policy: hookPolicy,
    });
    target = buildStatusRedirect(redirectTo, "success", "Tea 本地配置已更新。");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    target = buildStatusRedirect(redirectTo, "error", toMessage(error, "Tea 配置更新失败。"));
  }

  redirect(target);
}
