"use server";

import { redirect } from "next/navigation";
import type { UpsertRedemptionCodeInput, RedemptionRewardEntry } from "@neuro/contracts";

import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { upsertOperatorRedemptionCode, generateOperatorRedemptionCodeBatch } from "@/lib/core-client";

function parseRewardsFromForm(formData: FormData): RedemptionRewardEntry[] {
  const rewards: RedemptionRewardEntry[] = [];
  const count = Number(formData.get("rewardCount") || "1");

  for (let i = 0; i < count; i++) {
    const kind = formData.get(`reward_${i}_kind`)?.toString();
    if (kind === "walletGrant") {
      const currency = formData.get(`reward_${i}_currency`)?.toString().trim();
      const amount = Number(formData.get(`reward_${i}_amount`));
      if (currency && amount > 0) {
        rewards.push({ kind: "walletGrant", currency, amount });
      }
    } else if (kind === "itemGrant") {
      const productId = formData.get(`reward_${i}_productId`)?.toString().trim();
      if (productId) {
        rewards.push({ kind: "itemGrant", productId });
      }
    }
  }

  return rewards;
}

function buildInputFromForm(formData: FormData): UpsertRedemptionCodeInput {
  const rewards = parseRewardsFromForm(formData);
  if (rewards.length === 0) {
    throw new Error("至少需要一条奖励配置");
  }

  const userIdsRaw = formData.get("eligibility_userIds")?.toString().trim();
  const minTrustLevel = formData.get("eligibility_minTrustLevel")?.toString().trim();

  return {
    code: formData.get("code")?.toString().trim() || "",
    active: formData.get("active") === "true",
    exclusionGroup: formData.get("exclusionGroup")?.toString().trim() || null,
    startsAt: formData.get("startsAt")?.toString().trim() || null,
    expiresAt: formData.get("expiresAt")?.toString().trim() || null,
    eligibility: (minTrustLevel || userIdsRaw) ? {
      minTrustLevel: minTrustLevel ? Number(minTrustLevel) : null,
      userIds: userIdsRaw ? userIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) : null,
    } : null,
    rewards,
    maxUses: Number(formData.get("maxUses")) || 10000,
    mailTitle: formData.get("mailTitle")?.toString().trim() || null,
    mailBody: formData.get("mailBody")?.toString().trim() || null,
    batchLabel: formData.get("batchLabel")?.toString().trim() || null,
    description: formData.get("description")?.toString().trim() || null,
  };
}

export async function createRedemptionCodeAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();

  try {
    const input = buildInputFromForm(formData);
    if (input.code.length < 3) {
      redirect("/ops/account/redemption-codes?status=error&message=兑换码至少 3 个字符");
      return;
    }
    await upsertOperatorRedemptionCode(userContext, input);
    redirect("/ops/account/redemption-codes?status=success&message=兑换码已创建");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof Error ? error.message : "创建失败";
    redirect(`/ops/account/redemption-codes?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function updateRedemptionCodeAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const codeId = formData.get("codeId")?.toString();
  if (!codeId) {
    redirect("/ops/account/redemption-codes?status=error&message=缺少兑换码 ID");
    return;
  }

  try {
    const input = buildInputFromForm(formData);
    await upsertOperatorRedemptionCode(userContext, input, codeId);
    redirect("/ops/account/redemption-codes?status=success&message=兑换码已更新");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof Error ? error.message : "更新失败";
    redirect(`/ops/account/redemption-codes?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function toggleRedemptionCodeAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const codeId = formData.get("codeId")?.toString();
  const currentActive = formData.get("currentActive") === "true";

  if (!codeId) {
    redirect("/ops/account/redemption-codes?status=error&message=缺少兑换码 ID");
    return;
  }

  try {
    const input = buildInputFromForm(formData);
    input.active = !currentActive;
    await upsertOperatorRedemptionCode(userContext, input, codeId);
    redirect(`/ops/account/redemption-codes?status=success&message=兑换码已${currentActive ? "停用" : "启用"}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof Error ? error.message : "操作失败";
    redirect(`/ops/account/redemption-codes?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function generateBatchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();

  try {
    const count = Number(formData.get("batchCount")) || 10;
    const codePrefix = formData.get("batchPrefix")?.toString().trim() || "";
    if (codePrefix.length < 2) {
      redirect("/ops/account/redemption-codes?status=error&message=码前缀至少 2 个字符");
      return;
    }

    const rewards = parseRewardsFromForm(formData);
    if (rewards.length === 0) {
      redirect("/ops/account/redemption-codes?status=error&message=至少需要一条奖励配置");
      return;
    }

    const minTrustLevel = formData.get("eligibility_minTrustLevel")?.toString().trim();

    await generateOperatorRedemptionCodeBatch(userContext, {
      count,
      codePrefix,
      template: {
        active: formData.get("active") === "true",
        exclusionGroup: formData.get("exclusionGroup")?.toString().trim() || null,
        startsAt: formData.get("startsAt")?.toString().trim() || null,
        expiresAt: formData.get("expiresAt")?.toString().trim() || null,
        eligibility: minTrustLevel ? { minTrustLevel: Number(minTrustLevel) } : null,
        rewards,
        maxUses: Number(formData.get("maxUses")) || 1,
        mailTitle: formData.get("mailTitle")?.toString().trim() || null,
        mailBody: formData.get("mailBody")?.toString().trim() || null,
        batchLabel: formData.get("batchLabel")?.toString().trim() || codePrefix,
        description: formData.get("description")?.toString().trim() || null,
      },
    });

    redirect(`/ops/account/redemption-codes?status=success&message=已批量生成 ${count} 个兑换码`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    const message = error instanceof Error ? error.message : "批量生成失败";
    redirect(`/ops/account/redemption-codes?status=error&message=${encodeURIComponent(message)}`);
  }
}
