"use server";

import { agentCallbackRemediationPolicyKeys } from "@neuro/contracts";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  rotateAgentCallbackSecret,
  updateAgentCallbackProtocolVersion,
  updateAgentCallbackRemediationPolicy,
} from "@/lib/platform-client";
import {
  buildStatusRedirect,
  resolveCookiePathFromRedirectTarget,
  resolveRedirectPath,
  setRedirectTargetQueryParams,
  toMessage,
} from "@/lib/platform-action-utils";
import { requirePlatformUserContext } from "@/lib/platform-session";
import { createAgentCallbackSecretFlash } from "@/lib/server-flash";

const AGENT_CALLBACK_SECRET_FLASH_COOKIE = "np_agent_callback_secret_flash";

export async function updateAgentCallbackRemediationPolicyAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const agentId = String(formData.get("agentId") || "").trim();
  const policyKey = String(formData.get("policyKey") || "").trim();
  const nextRedirectTarget = setRedirectTargetQueryParams(redirectTo, { agentId });
  if (!agentId || !agentCallbackRemediationPolicyKeys.includes(policyKey as (typeof agentCallbackRemediationPolicyKeys)[number])) {
    redirect(buildStatusRedirect(nextRedirectTarget, "error", "请输入回调策略关键字"));
  }
  try {
    await updateAgentCallbackRemediationPolicy(
      userContext,
      agentId,
      policyKey as (typeof agentCallbackRemediationPolicyKeys)[number],
    );
    redirect(buildStatusRedirect(nextRedirectTarget, "success", "已应用回调策略"));
  } catch (error) {
    redirect(buildStatusRedirect(nextRedirectTarget, "error", toMessage(error, "策略更新失败")));
  }
}

export async function rotateAgentCallbackSecretAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const agentId = String(formData.get("agentId") || "").trim();
  if (!agentId) {
    redirect(buildStatusRedirect(redirectTo, "error", "Agent 参数无效。"));
  }

  try {
    const result = await rotateAgentCallbackSecret(userContext, agentId);
    const flashToken = await createAgentCallbackSecretFlash({
      agentId: result.agent.id,
      callbackSecret: result.callbackSecret,
    });
    const cookieStore = await cookies();
    cookieStore.set(
      AGENT_CALLBACK_SECRET_FLASH_COOKIE,
      flashToken,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: resolveCookiePathFromRedirectTarget(redirectTo),
        maxAge: 90,
      },
    );
    redirect(
      buildStatusRedirect(
        setRedirectTargetQueryParams(redirectTo, { agentId: result.agent.id }),
        "success",
        "回调密钥已轮换，请立即保存新密钥。",
      ),
    );
  } catch (error) {
    const message = toMessage(error, "回调密钥轮换失败，请稍后重试。");
    redirect(buildStatusRedirect(setRedirectTargetQueryParams(redirectTo, { agentId }), "error", message));
  }
}

export async function updateAgentCallbackProtocolVersionAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const agentId = String(formData.get("agentId") || "").trim();
  const protocolRaw = String(formData.get("protocolVersion") || "").trim();
  const protocolVersion = Number(protocolRaw);
  const nextRedirectTarget = setRedirectTargetQueryParams(redirectTo, { agentId });

  if (!agentId || Number.isNaN(protocolVersion) || protocolVersion <= 0) {
    redirect(buildStatusRedirect(nextRedirectTarget, "error", "回调协议版本参数无效。"));
  }

  try {
    await updateAgentCallbackProtocolVersion(userContext, agentId, protocolVersion);
    redirect(buildStatusRedirect(nextRedirectTarget, "success", "回调协议版本已更新。"));
  } catch (error) {
    const message = toMessage(error, "更新回调协议版本失败，请稍后重试。");
    redirect(buildStatusRedirect(nextRedirectTarget, "error", message));
  }
}
