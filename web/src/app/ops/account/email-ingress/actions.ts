"use server";

import { retryOperatorEmailProviderInboundMessage } from "@/lib/account-client";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function resolveRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

function buildStatusRedirect(redirectTo: string, status: "success" | "error", message: string) {
  const params = new URLSearchParams({ status, message });
  return `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${params.toString()}`;
}

export async function retryEmailProviderInboundMessageAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/email-ingress");
  const providerInboundMessageId = String(formData.get("providerInboundMessageId") || "").trim();

  if (!providerInboundMessageId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待重试的邮件入站记录。"));
  }

  try {
    await retryOperatorEmailProviderInboundMessage(userContext, providerInboundMessageId);
    redirect(buildStatusRedirect(redirectTo, "success", "真实邮件入站记录已重新入队。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "重试真实邮件入站失败，请稍后再试。")));
  }
}
