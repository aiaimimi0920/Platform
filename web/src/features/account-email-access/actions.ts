"use server";

import type { InternalUserContext } from "@neuro/contracts";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  confirmEmailIdentityVerification,
  removeEmailIdentity,
  setPrimaryEmailIdentity,
  startEmailIdentityVerification,
} from "@/lib/account-client";

type EmailAccessActionSession = {
  user?: {
    id?: string | null;
    providerUserId?: string | null;
    username?: string | null;
  } | null;
} | null;

function buildUserContext(session: EmailAccessActionSession): InternalUserContext | null {
  if (!session?.user?.id) {
    return null;
  }

  return {
    userId: session.user.id,
    providerUserId: session.user.providerUserId || undefined,
    username: session.user.username || undefined,
  };
}

function redirectWithStatus(status: "success" | "error", message: string) {
  const params = new URLSearchParams({
    status,
    message,
  });
  redirect(`/email-access?${params.toString()}`);
}

export async function startEmailIdentityVerificationAction(formData: FormData) {
  const session = await auth();
  const userContext = buildUserContext(session);
  if (!userContext) {
    redirect("/login");
  }

  try {
    const email = String(formData.get("email") || "").trim();
    const makePrimary = formData.get("makePrimary") === "on";
    const result = await startEmailIdentityVerification(userContext, {
      email,
      makePrimary,
    });
    const message = result.debugCode
      ? `验证码已生成，已进入 console 投递模式。验证码：${result.debugCode}`
      : `验证码已发送到 ${result.verification.email}`;
    redirectWithStatus("success", message);
  } catch (error) {
    redirectWithStatus("error", error instanceof Error ? error.message : "邮箱验证码发送失败");
  }
}

export async function confirmEmailIdentityVerificationAction(formData: FormData) {
  const session = await auth();
  const userContext = buildUserContext(session);
  if (!userContext) {
    redirect("/login");
  }

  try {
    const email = String(formData.get("email") || "").trim();
    const code = String(formData.get("code") || "").trim();
    await confirmEmailIdentityVerification(userContext, {
      email,
      code,
    });
    redirectWithStatus("success", "邮箱验证完成，Email-Native 调用入口已启用");
  } catch (error) {
    redirectWithStatus("error", error instanceof Error ? error.message : "邮箱验证失败");
  }
}

export async function setPrimaryEmailIdentityAction(formData: FormData) {
  const session = await auth();
  const userContext = buildUserContext(session);
  if (!userContext) {
    redirect("/login");
  }

  try {
    const identityId = String(formData.get("identityId") || "").trim();
    await setPrimaryEmailIdentity(userContext, identityId);
    redirectWithStatus("success", "默认真实邮箱已更新");
  } catch (error) {
    redirectWithStatus("error", error instanceof Error ? error.message : "更新默认邮箱失败");
  }
}

export async function removeEmailIdentityAction(formData: FormData) {
  const session = await auth();
  const userContext = buildUserContext(session);
  if (!userContext) {
    redirect("/login");
  }

  try {
    const identityId = String(formData.get("identityId") || "").trim();
    await removeEmailIdentity(userContext, identityId);
    redirectWithStatus("success", "邮箱身份已移除");
  } catch (error) {
    redirectWithStatus("error", error instanceof Error ? error.message : "移除邮箱身份失败");
  }
}
