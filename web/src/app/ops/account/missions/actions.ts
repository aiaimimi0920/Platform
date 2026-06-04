"use server";

import { currencyKeys, type CurrencyKey } from "@neuro/contracts";
import type { UpsertMissionDefinitionInput } from "@/lib/account-client";
import {
  archiveOperatorMissionDefinition,
  createOperatorMissionDefinition,
  deleteOperatorMissionDefinition,
  updateOperatorMissionDefinition,
} from "@/lib/account-client";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function resolveRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

function buildStatusRedirect(
  redirectTo: string,
  status: "success" | "error",
  message: string,
  editingId?: string | null,
) {
  const params = new URLSearchParams({ status, message });
  if (editingId) {
    params.set("editingId", editingId);
  }
  return `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${params.toString()}`;
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

function parseNullablePositiveInt(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("请输入有效的正整数。");
  }
  return parsed;
}

function parseRequiredInt(value: FormDataEntryValue | null, fieldLabel: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${fieldLabel}必须是整数。`);
  }
  return parsed;
}

function parseRewardCurrency(value: FormDataEntryValue | null): CurrencyKey {
  const raw = typeof value === "string" ? value.trim() : "";
  if (currencyKeys.includes(raw as CurrencyKey)) {
    return raw as CurrencyKey;
  }
  throw new Error("请选择有效的奖励货币。");
}

function getDefaultEyebrow(kind: UpsertMissionDefinitionInput["kind"]) {
  switch (kind) {
    case "checkin":
      return "签到";
    case "daily":
      return "每日任务";
    case "weekly":
      return "周任务";
    case "event":
      return "活动任务";
    case "permanent":
    default:
      return "永久任务";
  }
}

function parseMissionPayload(formData: FormData): UpsertMissionDefinitionInput {
  const kind = String(formData.get("kind") || "").trim() as UpsertMissionDefinitionInput["kind"];
  return {
    kind,
    status: String(formData.get("status") || "").trim() as UpsertMissionDefinitionInput["status"],
    title: String(formData.get("title") || "").trim(),
    subtitle: String(formData.get("subtitle") || "").trim() || null,
    description: String(formData.get("description") || "").trim(),
    eyebrow: String(formData.get("eyebrow") || "").trim() || getDefaultEyebrow(kind),
    rewardCurrency: parseRewardCurrency(formData.get("rewardCurrency")),
    rewardAmount: parseRequiredInt(formData.get("rewardAmount"), "奖励数额"),
    metricKey: String(formData.get("metricKey") || "").trim() as UpsertMissionDefinitionInput["metricKey"],
    progressTarget: parseRequiredInt(formData.get("progressTarget"), "任务目标"),
    streakTarget: parseNullablePositiveInt(formData.get("streakTarget")),
    startsAt: parseNullableIsoDateTimeFormValue(formData.get("startsAt")),
    endsAt: parseNullableIsoDateTimeFormValue(formData.get("endsAt")),
    sortOrder: parseRequiredInt(formData.get("sortOrder"), "排序值"),
  };
}

export async function saveMissionDefinitionAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/missions");
  const missionId = String(formData.get("missionId") || "").trim();

  try {
    const payload = parseMissionPayload(formData);

    if (missionId) {
      const mission = await updateOperatorMissionDefinition(userContext, missionId, payload);
      redirect(buildStatusRedirect(redirectTo, "success", `任务 ${mission.title} 已更新。`, mission.id));
    }

    const mission = await createOperatorMissionDefinition(userContext, payload);
    redirect(buildStatusRedirect(redirectTo, "success", `任务 ${mission.title} 已创建。`, mission.id));
  } catch (error) {
    const message = toMessage(error, missionId ? "更新任务失败，请稍后重试。" : "创建任务失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message, missionId || null));
  }
}

export async function deleteMissionDefinitionAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/missions");
  const missionId = String(formData.get("missionId") || "").trim();

  if (!missionId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待删除的任务。"));
  }

  try {
    await deleteOperatorMissionDefinition(userContext, missionId);
    redirect(buildStatusRedirect(redirectTo, "success", "任务已删除。"));
  } catch (error) {
    const message = toMessage(error, "删除任务失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message, missionId));
  }
}

export async function archiveMissionDefinitionAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/missions");
  const missionId = String(formData.get("missionId") || "").trim();

  if (!missionId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待归档的任务。"));
  }

  try {
    const mission = await archiveOperatorMissionDefinition(userContext, missionId);
    redirect(buildStatusRedirect(redirectTo, "success", `任务 ${mission.title} 已归档。`, mission.id));
  } catch (error) {
    const message = toMessage(error, "归档任务失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message, missionId));
  }
}
