"use server";

import type { AccountAnnouncementSection, UpsertAccountAnnouncementInput } from "@/lib/account-client";
import { createOperatorAccountAnnouncement, deleteOperatorAccountAnnouncement, updateOperatorAccountAnnouncement } from "@/lib/account-client";
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
    throw new Error("请输入有效的发布时间。");
  }
  return parsed.toISOString();
}

function parseAnnouncementSectionsJson(value: FormDataEntryValue | null): AccountAnnouncementSection[] {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error("请填写正文分区 JSON。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("正文分区 JSON 格式无效。");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("正文分区至少需要一个 section。");
  }

  return parsed.map((section, index) => {
    if (!section || typeof section !== "object") {
      throw new Error(`第 ${index + 1} 个 section 不是有效对象。`);
    }

    const record = section as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) {
      throw new Error(`第 ${index + 1} 个 section 缺少标题。`);
    }

    const normalizeStringArray = (value: unknown) =>
      Array.isArray(value)
        ? value
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter((item) => item.length > 0)
        : undefined;

    const paragraphs = normalizeStringArray(record.paragraphs);
    const bullets = normalizeStringArray(record.bullets);

    if (!paragraphs?.length && !bullets?.length) {
      throw new Error(`第 ${index + 1} 个 section 至少需要一段 paragraphs 或 bullets。`);
    }

    return {
      title,
      paragraphs,
      bullets,
    };
  });
}

function parseAnnouncementPayload(formData: FormData): UpsertAccountAnnouncementInput {
  return {
    title: String(formData.get("title") || "").trim(),
    railTitle: String(formData.get("railTitle") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    eyebrow: String(formData.get("eyebrow") || "").trim(),
    tone: String(formData.get("tone") || "").trim() as UpsertAccountAnnouncementInput["tone"],
    status: String(formData.get("status") || "").trim() as UpsertAccountAnnouncementInput["status"],
    publishedAt: parseNullableIsoDateTimeFormValue(formData.get("publishedAt")),
    sections: parseAnnouncementSectionsJson(formData.get("sectionsJson")),
  };
}

export async function saveAccountAnnouncementAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/announcements");
  const announcementId = String(formData.get("announcementId") || "").trim();

  try {
    const payload = parseAnnouncementPayload(formData);

    if (announcementId) {
      const announcement = await updateOperatorAccountAnnouncement(userContext, announcementId, payload);
      redirect(buildStatusRedirect(redirectTo, "success", `公告 ${announcement.title} 已更新。`, announcement.id));
    }

    const announcement = await createOperatorAccountAnnouncement(userContext, payload);
    redirect(buildStatusRedirect(redirectTo, "success", `公告 ${announcement.title} 已创建。`, announcement.id));
  } catch (error) {
    const message = toMessage(error, announcementId ? "更新公告失败，请稍后重试。" : "创建公告失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message, announcementId || null));
  }
}

export async function deleteAccountAnnouncementAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/announcements");
  const announcementId = String(formData.get("announcementId") || "").trim();

  if (!announcementId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待删除的公告。"));
  }

  try {
    await deleteOperatorAccountAnnouncement(userContext, announcementId);
    redirect(buildStatusRedirect(redirectTo, "success", "公告已删除。"));
  } catch (error) {
    const message = toMessage(error, "删除公告失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message, announcementId));
  }
}
