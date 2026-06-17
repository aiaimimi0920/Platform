"use server";

import { redirect } from "next/navigation";

import { emitOutboxAlerts, retryOutboxEvent, retryOutboxEventsBatch } from "@/lib/platform-client";
import { requirePlatformUserContext } from "@/lib/platform-session";
import { toMessage } from "@/lib/platform-action-utils";

export async function retryOutboxEventAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const eventId = String(formData.get("eventId") || "").trim();
  const queueStatus = String(formData.get("queueStatus") || "").trim();
  const eventName = String(formData.get("eventName") || "").trim();
  if (!eventId) {
    redirect(`/ops/outbox?status=error&message=${encodeURIComponent("事件参数无效。")}`);
    return;
  }

  try {
    await retryOutboxEvent(userContext, eventId);
    const params = new URLSearchParams({
      status: "success",
      message: "事件已重新入队，请稍后等待 worker 处理。",
    });
    if (queueStatus) params.set("queueStatus", queueStatus);
    if (eventName) params.set("eventName", eventName);
    redirect(`/ops/outbox?${params.toString()}`);
  } catch (error) {
    const message = toMessage(error, "事件重新入队失败，请稍后重试。");
    const params = new URLSearchParams({
      status: "error",
      message,
    });
    if (queueStatus) params.set("queueStatus", queueStatus);
    if (eventName) params.set("eventName", eventName);
    redirect(`/ops/outbox?${params.toString()}`);
  }
}

export async function retryOutboxEventsBatchAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const limit = Number(formData.get("limit") || 0);
  const eventName = String(formData.get("eventName") || "").trim();
  const queueStatus = String(formData.get("queueStatus") || "").trim();

  if (!Number.isFinite(limit) || limit <= 0) {
    redirect(`/ops/outbox?status=error&message=${encodeURIComponent("批量重放参数无效。")}`);
  }

  try {
    const result = await retryOutboxEventsBatch(userContext, {
      limit,
      eventName: eventName || undefined,
    });
    const targetMessage =
      result.retriedCount > 0
        ? `已批量重放 ${result.retriedCount} 条${result.eventName ? ` ${result.eventName}` : ""} dead-letter 事件。`
        : "当前筛选下没有可重放的 dead-letter 事件。";
    const params = new URLSearchParams({
      status: "success",
      message: targetMessage,
    });
    if (queueStatus) params.set("queueStatus", queueStatus);
    if (eventName) params.set("eventName", eventName);
    redirect(`/ops/outbox?${params.toString()}`);
  } catch (error) {
    const message = toMessage(error, "批量重放失败，请稍后重试。");
    const params = new URLSearchParams({
      status: "error",
      message,
    });
    if (queueStatus) params.set("queueStatus", queueStatus);
    if (eventName) params.set("eventName", eventName);
    redirect(`/ops/outbox?${params.toString()}`);
  }
}

export async function emitOutboxAlertsAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const queueStatus = String(formData.get("queueStatus") || "").trim();
  const eventName = String(formData.get("eventName") || "").trim();
  const minimumAlertLevel = Number(formData.get("minimumAlertLevel") || 2);

  try {
    const result = await emitOutboxAlerts(userContext, {
      minimumAlertLevel: Number.isFinite(minimumAlertLevel) && minimumAlertLevel > 0 ? minimumAlertLevel : 2,
    });
    const message =
      result.dispatchedCount > 0
        ? `已发出 ${result.dispatchedCount} 条 outbox 主动告警，跳过 ${result.skippedCount} 条冷却中的重复告警。`
        : result.skippedCount > 0
          ? "当前 outbox 风险已命中过冷却窗口，本轮没有重复发告警。"
          : "当前没有达到主动告警阈值的 outbox 风险。";
    const params = new URLSearchParams({
      status: "success",
      message,
    });
    if (queueStatus) params.set("queueStatus", queueStatus);
    if (eventName) params.set("eventName", eventName);
    redirect(`/ops/outbox?${params.toString()}`);
  } catch (error) {
    const params = new URLSearchParams({
      status: "error",
      message: toMessage(error, "触发 outbox 主动告警失败，请稍后重试。"),
    });
    if (queueStatus) params.set("queueStatus", queueStatus);
    if (eventName) params.set("eventName", eventName);
    redirect(`/ops/outbox?${params.toString()}`);
  }
}
