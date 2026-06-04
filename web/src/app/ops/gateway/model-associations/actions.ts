"use server";

import type { UpsertGatewayModelAliasInput } from "@/lib/account-client";
import {
  createOperatorGatewayModelAlias,
  deleteOperatorGatewayModelAlias,
  updateOperatorGatewayModelAlias,
} from "@/lib/account-client";
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

function parseRequiredText(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error(`${label}不能为空。`);
  }
  return raw;
}

function parseOptionalText(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function parseInteger(
  value: FormDataEntryValue | null,
  label: string,
  fallback: number,
  options: { allowZero: boolean },
) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${label}必须是整数。`);
  }
  if (options.allowZero ? parsed < 0 : parsed <= 0) {
    throw new Error(`${label}${options.allowZero ? "不能小于 0。" : "必须大于 0。"}`);
  }
  return parsed;
}

function parseEnabled(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return normalized === "true" || normalized === "1" || normalized === "on";
}

function parseScopeType(value: FormDataEntryValue | null): UpsertGatewayModelAliasInput["scopeType"] {
  if (typeof value !== "string") {
    return "global";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "provider_special") {
    return "provider_special";
  }
  return "global";
}

function buildAliasPayload(formData: FormData): UpsertGatewayModelAliasInput {
  return {
    scopeType: parseScopeType(formData.get("scopeType")),
    alias: parseRequiredText(formData.get("alias"), "模型别名"),
    providerAccountId: parseRequiredText(formData.get("providerAccountId"), "服务商"),
    upstreamModel: parseOptionalText(formData.get("upstreamModel")),
    priority: parseInteger(formData.get("priority"), "优先级", 100, { allowZero: true }),
    weight: parseInteger(formData.get("weight"), "权重", 1, { allowZero: false }),
    enabled: parseEnabled(formData.get("enabled")),
  };
}

export async function saveGatewayModelAliasAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/model-associations");
  const aliasId = parseOptionalText(formData.get("aliasId"));

  try {
    const payload = buildAliasPayload(formData);
    const modelAlias = aliasId
      ? await updateOperatorGatewayModelAlias(userContext, aliasId, payload)
      : await createOperatorGatewayModelAlias(userContext, payload);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        aliasId ? `别名 ${modelAlias.alias} 映射已更新。` : `别名 ${modelAlias.alias} 已创建。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存模型别名失败。")));
  }
}

export async function createGlobalGatewayModelAliasAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/model-associations");

  try {
    const alias = parseRequiredText(formData.get("alias"), "全局模型别名");
    const priority = parseInteger(formData.get("priority"), "优先级", 100, { allowZero: true });
    const weight = parseInteger(formData.get("weight"), "权重", 1, { allowZero: false });
    const enabled = parseEnabled(formData.get("enabled"));
    const providerAccountIds = formData
      .getAll("providerAccountId")
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    const upstreamModels = formData.getAll("upstreamModel");

    if (!providerAccountIds.length) {
      throw new Error("当前没有可写入的服务商。");
    }

    await Promise.all(
      providerAccountIds.map((providerAccountId, index) =>
        createOperatorGatewayModelAlias(userContext, {
          scopeType: "global",
          alias,
          providerAccountId,
          upstreamModel: parseOptionalText(upstreamModels[index] ?? null),
          priority,
          weight,
          enabled,
        }),
      ),
    );

    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `全局模型别名 ${alias} 已写入 ${providerAccountIds.length} 个服务商。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "创建全局模型别名失败。")));
  }
}

export async function deleteGatewayModelAliasesAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/model-associations");
  const aliasLabel = parseRequiredText(formData.get("aliasLabel"), "模型别名");
  const scopeLabel = parseOptionalText(formData.get("scopeLabel")) || "模型别名";
  const aliasIds = formData
    .getAll("aliasId")
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);

  if (!aliasIds.length) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待删除的模型别名记录。"));
  }

  try {
    await Promise.all(aliasIds.map((aliasId) => deleteOperatorGatewayModelAlias(userContext, aliasId)));
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `${scopeLabel} ${aliasLabel} 已删除${aliasIds.length > 1 ? `（共 ${aliasIds.length} 条映射）` : ""}。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "删除模型别名失败。")));
  }
}
