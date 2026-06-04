"use server";

import {
  createOperatorGatewayProviderAccount,
} from "@/lib/account-client";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import {
  getProviderCreateDefaults,
  isSupportedProviderCreateAdapter,
  isSupportedProviderCreateProtocolFamily,
  isSupportedProviderCreateProtocolProfile,
  resolveProviderCreateAuthMode,
} from "../provider-create-catalog";

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

function readOptionalText(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function resolveAuthHeaderName(authMode: string | null) {
  switch (authMode) {
    case "bearer":
      return "Authorization";
    case "x-api-key":
      return "x-api-key";
    case "api-key":
      return "api-key";
    case "x-goog-api-key":
      return "X-Goog-Api-Key";
    default:
      return null;
  }
}

function buildProviderPayload(args: {
  adapter: string;
  accountLabel: string;
  baseUrl: string | null;
  defaultModel: string | null;
  authMode: string | null;
  defaultPayloadPatch?: Record<string, unknown>;
}) {
  const authHeaderName = resolveAuthHeaderName(args.authMode);
  const authToken = "";
  const common = {
    adapter: args.adapter,
    baseUrl: args.baseUrl ?? "",
    accountLabel: args.accountLabel,
    apiKey: "",
  };

  switch (args.adapter) {
    case "openai_compatible":
      return {
        ...common,
        authMode: args.authMode ?? "bearer",
        defaultModel: args.defaultModel,
        ...(args.defaultPayloadPatch ?? {}),
      };
    case "anthropic_compatible":
      return {
        ...common,
        defaultModel: args.defaultModel,
        anthropicVersion: "2023-06-01",
        ...(args.defaultPayloadPatch ?? {}),
      };
    case "gemini_api_compatible":
    case "bedrock_converse_compatible":
      return {
        ...common,
        defaultModel: args.defaultModel,
        authHeaderName,
        authToken,
        ...(args.defaultPayloadPatch ?? {}),
      };
    case "cohere_compatible":
      return {
        ...common,
        defaultModel: args.defaultModel,
        authMode: args.authMode === "x-goog-api-key" ? "bearer" : args.authMode,
        ...(args.defaultPayloadPatch ?? {}),
      };
    case "freebuff_compatible":
    case "qwen_web_compatible":
    case "chatgpt_web_reverse_compatible":
    case "gemini_web_compatible":
    case "xfyun_websocket_compatible":
      return {
        ...common,
        defaultModel: args.defaultModel,
        ...(args.defaultPayloadPatch ?? {}),
      };
    case "grok_compatible":
    case "kiro_compatible":
    case "producer_compatible":
    case "gemini_business_compatible":
    case "chataibot_compatible":
    case "lumalabs_compatible":
    case "gemini_canvas_compatible":
    case "suno_compatible":
    case "udio_compatible":
      return {
        ...common,
        defaultModel: args.defaultModel,
        authMode: args.authMode,
        ...(args.defaultPayloadPatch ?? {}),
      };
    case "search_api_compatible":
    case "linkup_compatible":
      return {
        ...common,
        defaultModel: args.defaultModel,
        authHeaderName,
        authToken,
      };
    case "custom_http":
      return {
        ...common,
        defaultModel: args.defaultModel,
        authHeaderName,
        authToken,
      };
    default:
      return {
        ...common,
        defaultModel: args.defaultModel,
        authMode: args.authMode,
        ...(args.defaultPayloadPatch ?? {}),
      };
  }
}

export async function createGatewayProviderFromWorkbenchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const returnTo = resolveRedirectPath(formData.get("returnTo"), "/ops/gateway/providers");
  const failureRedirect = resolveRedirectPath(formData.get("failureRedirectTo"), "/ops/gateway/providers/create");

  const label = String(formData.get("label") || "").trim();
  const serviceProviderLabel = readOptionalText(formData.get("serviceProviderLabel"));
  const serviceProviderKey = readOptionalText(formData.get("serviceProviderKey"));
  const adapter = String(formData.get("adapter") || "").trim();
  const protocolFamily = String(formData.get("protocolFamily") || "").trim();
  const protocolProfile = String(formData.get("protocolProfile") || "").trim();
  const sourceNotes = readOptionalText(formData.get("sourceNotes"));
  const defaultModel = readOptionalText(formData.get("defaultModel"));
  const baseUrl = readOptionalText(formData.get("baseUrl"));
  const authMode = readOptionalText(formData.get("authMode"));
  const defaults = getProviderCreateDefaults(adapter, protocolFamily, protocolProfile);
  const sourceKind = defaults.sourceKind;
  const executionMode = defaults.defaultExecutionMode;
  const normalizedAggregatorApiMode = defaults.aggregatorApiMode ?? null;
  const normalizedWebReverseAccessMode = defaults.webReverseAccessMode ?? null;

  if (!label || !adapter || !protocolFamily || !protocolProfile) {
    redirect(buildStatusRedirect(failureRedirect, "error", "缺少服务商创建字段。"));
  }
  if (!isSupportedProviderCreateAdapter(adapter)) {
    redirect(buildStatusRedirect(failureRedirect, "error", "当前创建页不支持这个适配器。"));
  }
  if (!isSupportedProviderCreateProtocolFamily(protocolFamily)) {
    redirect(buildStatusRedirect(failureRedirect, "error", "当前创建页不支持这个协议族。"));
  }
  if (!isSupportedProviderCreateProtocolProfile(protocolProfile)) {
    redirect(buildStatusRedirect(failureRedirect, "error", "当前创建页不支持这个协议 Profile。"));
  }

  const accountLabel = label;
  const normalizedAuthMode = resolveProviderCreateAuthMode(
    adapter,
    protocolFamily,
    protocolProfile,
    authMode,
  );

  try {
    const providerAccount = await createOperatorGatewayProviderAccount(userContext, {
      label,
      serviceProviderLabel,
      serviceProviderKey,
      adapter: adapter as never,
      protocolFamily: protocolFamily as never,
      protocolProfile: protocolProfile as never,
      status: "disabled",
      executionMode: executionMode ?? "direct_http",
      sourceProfile: {
        sourceKind,
        aggregatorApiMode: normalizedAggregatorApiMode,
        webReverseAccessMode: normalizedWebReverseAccessMode,
        notes: sourceNotes,
      },
      payload: buildProviderPayload({
        adapter,
        accountLabel,
        baseUrl,
        defaultModel,
        authMode: normalizedAuthMode,
        defaultPayloadPatch: defaults.defaultPayloadPatch,
      }) as never,
    });

    redirect(
      buildStatusRedirect(
        `/ops/gateway/providers/${encodeURIComponent(providerAccount.id)}/credentials/create?returnTo=${encodeURIComponent(`/ops/gateway/providers/${encodeURIComponent(providerAccount.id)}?returnTo=${encodeURIComponent(returnTo)}#credentials`)}`,
        "success",
        `${label} 已创建，请继续录入凭证库。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(failureRedirect, "error", toMessage(error, "创建服务商失败。")));
  }
}
