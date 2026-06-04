"use server";

import {
  claimOperatorCredentialRepair,
  createOperatorCredentialTerminal,
  importOperatorCredentialPool,
  markOperatorCredentialCooling,
  markOperatorCredentialDeath,
  markOperatorCredentialInvalid,
  releaseOperatorCredentialRepair,
  revokeOperatorCredentialTerminal,
  rotateOperatorCredentialAssignment,
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

function buildStatusRedirect(redirectTo: string, status: "success" | "error", message: string) {
  const params = new URLSearchParams({ flash: status, message });
  return `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${params.toString()}`;
}

function parseRequiredText(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error(`${label}不能为空。`);
  }
  return raw;
}

function parseNullableText(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function parseRequiredInt(value: FormDataEntryValue | null, label: string, minimum = 0) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label}必须是大于等于 ${minimum} 的整数。`);
  }
  return parsed;
}

function parseEntriesJson(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error("导入 JSON 不能为空。");
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("导入 JSON 至少需要一条记录。");
  }
  return parsed;
}

export async function createCredentialTerminalAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    const issued = await createOperatorCredentialTerminal(userContext, {
      providerKey: parseRequiredText(formData.get("providerKey"), "provider") as "platform_a" | "platform_b" | "platform_c",
      label: parseRequiredText(formData.get("label"), "终端名称"),
      note: parseNullableText(formData.get("note")),
    });
    redirect(buildStatusRedirect(redirectTo, "success", `终端已创建，令牌：${issued.plainToken}`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "创建终端失败。")));
  }
}

export async function revokeCredentialTerminalAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    await revokeOperatorCredentialTerminal(userContext, parseRequiredText(formData.get("terminalId"), "终端"));
    redirect(buildStatusRedirect(redirectTo, "success", "终端已吊销。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "吊销终端失败。")));
  }
}

export async function importCredentialPoolAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    await importOperatorCredentialPool(userContext, {
      providerKey: parseRequiredText(formData.get("providerKey"), "provider") as "platform_a" | "platform_b" | "platform_c",
      label: parseRequiredText(formData.get("label"), "批次标题"),
      importNote: parseNullableText(formData.get("importNote")),
      entries: parseEntriesJson(formData.get("entriesJson")) as Array<{
        benefitServiceId: string;
        entryLabel?: string | null;
        scope?: "public" | "private";
        privateUserId?: string | null;
        storageMode?: "inline" | "r2" | null;
        payload: Record<string, unknown>;
      }>,
    });
    redirect(buildStatusRedirect(redirectTo, "success", "凭证池导入完成。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "导入凭证池失败。")));
  }
}

export async function claimCredentialRepairAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    await claimOperatorCredentialRepair(userContext, parseRequiredText(formData.get("entryId"), "凭证"));
    redirect(buildStatusRedirect(redirectTo, "success", "修缮领取已创建。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "领取修缮失败。")));
  }
}

export async function releaseCredentialRepairAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    await releaseOperatorCredentialRepair(userContext, parseRequiredText(formData.get("claimId"), "修缮领取"));
    redirect(buildStatusRedirect(redirectTo, "success", "修缮领取已释放。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "释放修缮领取失败。")));
  }
}

export async function markCredentialCoolingAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    await markOperatorCredentialCooling(
      userContext,
      parseRequiredText(formData.get("entryId"), "凭证"),
      {
        cooldownMinutes: parseRequiredInt(formData.get("cooldownMinutes"), "冷却分钟", 1),
        reason: parseNullableText(formData.get("reason")),
      },
    );
    redirect(buildStatusRedirect(redirectTo, "success", "凭证已转入冷却。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "设置冷却失败。")));
  }
}

export async function markCredentialInvalidAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    await markOperatorCredentialInvalid(
      userContext,
      parseRequiredText(formData.get("entryId"), "凭证"),
      {
        reason: parseRequiredText(formData.get("reason"), "无效原因"),
      },
    );
    redirect(buildStatusRedirect(redirectTo, "success", "凭证已标记为无效。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "标记无效失败。")));
  }
}

export async function markCredentialDeathAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    await markOperatorCredentialDeath(
      userContext,
      parseRequiredText(formData.get("entryId"), "凭证"),
      {
        reason: parseRequiredText(formData.get("reason"), "死亡原因"),
      },
    );
    redirect(buildStatusRedirect(redirectTo, "success", "死亡清理任务已创建。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "标记死亡失败。")));
  }
}

export async function rotateCredentialAssignmentAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/credential-pools");
  try {
    await rotateOperatorCredentialAssignment(
      userContext,
      parseRequiredText(formData.get("serviceId"), "服务"),
      parseRequiredText(formData.get("userId"), "用户"),
    );
    redirect(buildStatusRedirect(redirectTo, "success", "用户凭证已轮换。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "轮换用户凭证失败。")));
  }
}
