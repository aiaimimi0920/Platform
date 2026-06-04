"use server";

import { updateOperatorGatewayProviderModelPricing } from "@/lib/account-client";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

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
  const [pathname, hash] = redirectTo.split("#", 2);
  return `${pathname}${pathname.includes("?") ? "&" : "?"}${params.toString()}${hash ? `#${hash}` : ""}`;
}

function parseUsdPerMillionToMicrosPer1k(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`无效价格：${raw}`);
  }
  return Math.round(numeric * 1000);
}

export async function updateGatewayProviderModelPricingAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const providerAccountId = String(formData.get("providerAccountId") || "").trim();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/costs");

  if (!providerAccountId) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少服务商标识。"));
  }

  try {
    const models = formData.getAll("model[]");
    const promptValues = formData.getAll("promptUsdPer1m[]");
    const completionValues = formData.getAll("completionUsdPer1m[]");

    const entries = models.map((modelValue, index) => {
      const model = typeof modelValue === "string" ? modelValue.trim() : "";
      if (!model) {
        throw new Error(`第 ${index + 1} 行缺少模型名。`);
      }
      return {
        model,
        promptMicrosPer1kTokens: parseUsdPerMillionToMicrosPer1k(promptValues[index] ?? null),
        completionMicrosPer1kTokens: parseUsdPerMillionToMicrosPer1k(completionValues[index] ?? null),
      };
    });

    await updateOperatorGatewayProviderModelPricing(userContext, providerAccountId, { entries });
    redirect(buildStatusRedirect(redirectTo, "success", "模型市场价已更新。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "更新模型市场价失败。")));
  }
}
