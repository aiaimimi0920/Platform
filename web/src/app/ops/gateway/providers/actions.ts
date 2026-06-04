"use server";

import {
  getOperatorGatewayProviderAccount,
  deleteOperatorGatewayProviderAccount,
  refreshOperatorGatewayProviderQuota,
  updateOperatorGatewayProviderAccount,
} from "@/lib/account-client";
import { gatewayRequest } from "@/lib/gateway-request";
import { revalidatePath } from "next/cache";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  isLumalabsCompatibleAdapter,
  mergeLumalabsContractIntoPayload,
  readLumalabsContractFromFormData,
} from "./lumalabs-contract";

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

function normalizeRevalidatePath(value: string) {
  const [withoutHash] = value.split("#");
  const [withoutQuery] = withoutHash.split("?");
  return withoutQuery || "/ops/gateway/providers";
}

export type GatewayProviderModelTieringActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  model: string;
  platformTier: string;
  enabled: boolean;
  submittedAt: number;
};

export async function saveGatewayProviderModelTieringAction(
  _previousState: GatewayProviderModelTieringActionState,
  formData: FormData,
): Promise<GatewayProviderModelTieringActionState> {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/providers");
  const revalidateTarget = normalizeRevalidatePath(redirectTo);
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const platformTier = String(formData.get("platformTier") || "").trim();
  const enabled = formData.get("enabled") === "on";
  const submittedAt = Date.now();

  if (!providerAccountId) {
    return {
      status: "error",
      message: "缺少服务商标识。",
      model,
      platformTier,
      enabled,
      submittedAt,
    };
  }
  if (!model) {
    return {
      status: "error",
      message: "缺少模型名。",
      model,
      platformTier,
      enabled,
      submittedAt,
    };
  }
  if (!platformTier) {
    return {
      status: "error",
      message: "缺少评级。",
      model,
      platformTier,
      enabled,
      submittedAt,
    };
  }

  try {
    await gatewayRequest(
      `/v1/internal/gateway/provider-accounts/${encodeURIComponent(providerAccountId)}/model-tiering`,
      {
        method: "POST",
        userContext,
        body: {
          model,
          platformTier,
          enabled,
        },
      },
    );
    revalidatePath(revalidateTarget);
    revalidatePath(`/ops/gateway/providers/${providerAccountId}`);
    revalidatePath("/ops/gateway/access");
    return {
      status: "success",
      message: `${model} 已更新为${platformTier}档，当前${enabled ? "已启用" : "已关闭"}。`,
      model,
      platformTier,
      enabled,
      submittedAt,
    };
  } catch (error) {
    return {
      status: "error",
      message: toMessage(error, `保存 ${model} 的模型定级失败。`),
      model,
      platformTier,
      enabled,
      submittedAt,
    };
  }
}

export async function refreshGatewayProviderQuotaAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/providers");
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();

  if (!providerAccountId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商标识。"));
  }

  try {
    const providerQuota = await refreshOperatorGatewayProviderQuota(userContext, providerAccountId);
    const message = providerQuota
      ? `额度快照已刷新：${providerQuota.status}${providerQuota.representativeClaim ? ` · ${providerQuota.representativeClaim}` : ""}`
      : "当前服务商未声明可读取的额度接口。";
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "刷新服务商额度失败。")));
  }
}

export async function deleteGatewayProviderAccountAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/providers");
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();

  if (!providerAccountId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商标识。"));
  }

  try {
    const result = await deleteOperatorGatewayProviderAccount(userContext, providerAccountId);
    revalidatePath("/ops/gateway/providers");
    revalidatePath(`/ops/gateway/providers/${providerAccountId}`);
    const credentialMessage =
      result.deletedCredentialCount > 0 ? `，已同步清理 ${result.deletedCredentialCount} 条凭证。` : "。";
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `已删除服务商 ${result.label}（${result.providerAccountId}）${credentialMessage}`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "删除服务商失败。")));
  }
}

export async function updateGatewayProviderLumalabsContractAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/providers");
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const revalidateTarget = normalizeRevalidatePath(redirectTo);

  if (!providerAccountId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商标识。"));
  }

  try {
    const { providerAccount } = await getOperatorGatewayProviderAccount(userContext, providerAccountId);
    if (!isLumalabsCompatibleAdapter(providerAccount.adapter)) {
      redirect(buildStatusRedirect(redirectTo, "error", "当前服务商不是 LumaLabs surface。"));
    }

    const nextPayload = mergeLumalabsContractIntoPayload(
      providerAccount.payload,
      readLumalabsContractFromFormData(formData),
    );

    await updateOperatorGatewayProviderAccount(userContext, providerAccountId, {
      label: providerAccount.label,
      serviceProviderKey: providerAccount.serviceProviderKey,
      serviceProviderLabel: providerAccount.serviceProviderLabel,
      adapter: providerAccount.adapter,
      protocolFamily: providerAccount.protocolFamily,
      protocolProfile: providerAccount.protocolProfile,
      status: providerAccount.status,
      sourceProfile: {
        sourceKind: providerAccount.sourceProfile.sourceKind,
        aggregatorApiMode: providerAccount.sourceProfile.aggregatorApiMode,
        webReverseAccessMode: providerAccount.sourceProfile.webReverseAccessMode,
        notes: providerAccount.sourceProfile.notes,
      },
      executionMode: providerAccount.executionMode,
      endpointExecutionModes: providerAccount.endpointExecutionModes,
      payload: nextPayload,
    });

    revalidatePath(revalidateTarget);
    revalidatePath("/ops/gateway/providers");
    revalidatePath(`/ops/gateway/providers/${providerAccountId}`);
    redirect(buildStatusRedirect(redirectTo, "success", "已更新 Luma reverse-web 合同。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "更新 Luma reverse-web 合同失败。")));
  }
}
