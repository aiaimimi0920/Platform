"use server";

import { redirect } from "next/navigation";

import { claimMailboxAttachment, claimMission, exchangeWallet } from "@/lib/account-client";
import { getCurrencyLabel } from "@/lib/currency-display";
import { redeemCode } from "@/lib/platform-client";
import { requirePlatformUserContext } from "@/lib/platform-session";
import { resolveRedirectPath, toMessage } from "@/lib/platform-action-utils";

export async function redeemCodeAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const code = String(formData.get("code") || "").trim();
  if (!code) {
    redirect(`/redeem?status=error&message=${encodeURIComponent("请输入兑换码。")}`);
  }
  try {
    await redeemCode(userContext, { code });
    redirect(`/redeem?status=success&message=${encodeURIComponent("兑换成功，奖励已发放。")}`);
  } catch (error) {
    const message = toMessage(error, "兑换失败，请稍后重试。");
    redirect(`/redeem?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function claimMailboxAttachmentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const messageId = String(formData.get("messageId") || "");
  const attachmentId = String(formData.get("attachmentId") || "");
  if (!messageId || !attachmentId) return;
  await claimMailboxAttachment(userContext, { messageId, attachmentId });
  redirect("/mailbox");
}

export async function claimMissionAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const missionId = String(formData.get("missionId") || "").trim();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/dashboard");
  if (!missionId) {
    redirect(`${redirectTo}?status=error&message=${encodeURIComponent("任务参数无效。")}`);
  }

  try {
    const result = await claimMission(userContext, missionId);
    const message = `任务奖励已发放：${result.claimedAmount} ${getCurrencyLabel(result.rewardCurrency)}。`;
    redirect(`${redirectTo}?status=success&message=${encodeURIComponent(message)}`);
  } catch (error) {
    const message = toMessage(error, "任务奖励领取失败，请稍后重试。");
    redirect(`${redirectTo}?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function exchangeObsidianToMiraAction(formData: FormData) {
  "use server";

  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/dashboard");
  const rawAmount = Number(formData.get("amount") || 0);
  const amount = Math.floor(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(`${redirectTo}?status=error&message=${encodeURIComponent("请输入有效的兑换数量。")}`);
    return;
  }

  try {
    const result = await exchangeWallet(userContext, {
      direction: "obsidian_to_mira",
      amount,
    });
    const message = `兑换成功，已将 ${result.sourceAmount} 曜石兑换为 ${result.targetAmount} 米拉。`;
    redirect(`${redirectTo}?status=success&message=${encodeURIComponent(message)}`);
  } catch (error) {
    const message = toMessage(error, "兑换失败，请稍后重试。");
    redirect(`${redirectTo}?status=error&message=${encodeURIComponent(message)}`);
  }
}
