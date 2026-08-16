import type { GatewayAggregatorApiMode, GatewayEndpointExecutionModeMap, GatewayExecutionMode, GatewayOpenAiCompatibleProviderPayload, GatewayProviderAccountPayload, GatewayProviderAccountView, GatewayProviderSourceProfile, GatewayProviderSourceKind, GatewayProviderSourceView, GatewaySessionBackedProviderRuntime, GatewayWebReverseAccessMode, GatewayRelayEndpointKind, UpsertGatewayProviderAccountInput } from "@neuro/contracts";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

import { normalizeOptionalText, parseFilterTimestamp } from "./shared";
import type { GatewayProviderAccountRow } from "./shared";
import { isGatewayAnthropicProtocolFamily, isGatewayBedrockProtocolFamily, isGatewayChataibotProtocolFamily, isGatewayCohereProtocolFamily, isGatewayGeminiBusinessProtocolFamily, isGatewayGeminiCanvasProtocolFamily, isGatewayGeminiProtocolFamily, isGatewayLumalabsProtocolFamily, isGatewayOpenAiProtocolFamily, isGatewayProducerProtocolFamily, isGatewaySearchProtocolFamily, isGatewaySearchProviderPayload, isGatewaySunoProtocolFamily, isGatewayUdioProtocolFamily, normalizeGatewayProtocolFamily, normalizeGatewayProtocolProfile } from "./provider-identity";

export function normalizeSessionAuthTransport(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "bearer" || normalized === "header" || normalized === "cookie") {
    return normalized;
  }
  return "cookie";
}

export const gatewayOfficialVendorHostPatterns = [
  /(^|\.)openai\.com$/i,
  /(^|\.)anthropic\.com$/i,
  /(^|\.)x\.ai$/i,
  /(^|\.)groq\.com$/i,
  /(^|\.)googleapis\.com$/i,
  /(^|\.)generativelanguage\.googleapis\.com$/i,
  /(^|\.)mistral\.ai$/i,
  /(^|\.)cohere\.ai$/i,
  /(^|\.)moonshot\.cn$/i,
  /(^|\.)zhipuai\.cn$/i,
  /(^|\.)linkup\.so$/i,
  /(^|\.)tavily\.com$/i,
  /(^|\.)exa\.ai$/i,
  /(^|\.)ydc-index\.io$/i,
  /(^|\.)websearchapi\.ai$/i,
  /(^|\.)jina\.ai$/i,
] as const;

export type NormalizedGatewayProviderSourceProfile = GatewayProviderSourceView;

export function isGatewayAggregatorApiMode(value: string | null | undefined): value is GatewayAggregatorApiMode {
  return value === "hosted_compute" || value === "upstream_forward";
}

export function isGatewayProviderSourceKind(value: string | null | undefined): value is GatewayProviderSourceKind {
  return (
    value === "official_model_api" ||
    value === "official_vendor_api" ||
    value === "aggregator_api" ||
    value === "web_reverse_api"
  );
}

export function isGatewayWebReverseAccessMode(value: string | null | undefined): value is GatewayWebReverseAccessMode {
  return value === "direct_http_replay" || value === "browser_challenge";
}

export function readGatewayProviderBaseUrl(payload: GatewayProviderAccountPayload): string | null {
  if ("baseUrl" in payload && typeof payload.baseUrl === "string" && payload.baseUrl.trim()) {
    return payload.baseUrl.trim();
  }
  return null;
}

export function readGatewayProviderHostname(payload: GatewayProviderAccountPayload): string | null {
  const baseUrl = readGatewayProviderBaseUrl(payload);
  if (!baseUrl) {
    return null;
  }
  try {
    return new URL(baseUrl).hostname.trim().toLowerCase();
  } catch {
    return null;
  }
}

export function isKnownOfficialVendorHost(hostname: string | null) {
  if (!hostname) {
    return false;
  }
  return gatewayOfficialVendorHostPatterns.some((pattern) => pattern.test(hostname));
}

export function isKnownHostedAggregatorHost(hostname: string | null) {
  if (!hostname) {
    return false;
  }
  return hostname === "api.siliconflow.cn" || hostname === "ai.gitee.com";
}

export function adapterBelongsToWebReverseSource(adapter: GatewayProviderAccountView["adapter"] | string) {
  return (
    adapter === "grok_compatible" ||
    adapter === "producer_compatible" ||
    adapter === "gemini_business_compatible" ||
    adapter === "chataibot_compatible" ||
    adapter === "lumalabs_compatible" ||
    adapter === "gemini_canvas_compatible" ||
    adapter === "suno_compatible" ||
    adapter === "udio_compatible"
  );
}

export function resolveGatewayProviderSourceAccessModeFromExecution(
  executionMode: GatewayExecutionMode,
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null,
): GatewayWebReverseAccessMode {
  const hasBrowserBackedEndpoint =
    executionMode === "browser_backed" ||
    Object.values(endpointExecutionModes ?? {}).some((mode) => mode === "browser_backed");
  return hasBrowserBackedEndpoint ? "browser_challenge" : "direct_http_replay";
}

export function normalizeExplicitGatewayProviderSourceProfile(
  sourceProfile: GatewayProviderSourceProfile,
): Omit<GatewayProviderSourceView, "derived"> {
  const sourceKind = sourceProfile.sourceKind?.trim().toLowerCase() ?? "";
  if (!isGatewayProviderSourceKind(sourceKind)) {
    throw new ConflictError("provider sourceProfile.sourceKind 不合法。");
  }

  const aggregatorApiModeRaw = sourceProfile.aggregatorApiMode?.trim().toLowerCase() ?? null;
  const webReverseAccessModeRaw = sourceProfile.webReverseAccessMode?.trim().toLowerCase() ?? null;
  const aggregatorApiMode = aggregatorApiModeRaw && isGatewayAggregatorApiMode(aggregatorApiModeRaw)
    ? aggregatorApiModeRaw
    : null;
  const webReverseAccessMode = webReverseAccessModeRaw && isGatewayWebReverseAccessMode(webReverseAccessModeRaw)
    ? webReverseAccessModeRaw
    : null;

  if (aggregatorApiModeRaw && !aggregatorApiMode) {
    throw new ConflictError("provider sourceProfile.aggregatorApiMode 不合法。");
  }
  if (webReverseAccessModeRaw && !webReverseAccessMode) {
    throw new ConflictError("provider sourceProfile.webReverseAccessMode 不合法。");
  }
  if (sourceKind !== "aggregator_api" && aggregatorApiMode) {
    throw new ConflictError("只有 aggregator_api 允许设置 aggregatorApiMode。");
  }
  if (sourceKind !== "web_reverse_api" && webReverseAccessMode) {
    throw new ConflictError("只有 web_reverse_api 允许设置 webReverseAccessMode。");
  }

  return {
    sourceKind,
    aggregatorApiMode,
    webReverseAccessMode,
    notes: normalizeOptionalText(sourceProfile.notes, 500),
  };
}

export function inferGatewayProviderSourceProfile(args: {
  adapter: GatewayProviderAccountView["adapter"] | string;
  payload: GatewayProviderAccountPayload;
  executionMode: GatewayExecutionMode;
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null;
}): NormalizedGatewayProviderSourceProfile {
  const hostname = readGatewayProviderHostname(args.payload);
  if (adapterBelongsToWebReverseSource(args.adapter)) {
    return {
      sourceKind: "web_reverse_api",
      aggregatorApiMode: null,
      webReverseAccessMode: resolveGatewayProviderSourceAccessModeFromExecution(
        args.executionMode,
        args.endpointExecutionModes,
      ),
      notes: `自动推导：${args.adapter}`,
      derived: true,
    };
  }

  if (args.adapter === "search_api_compatible" || args.adapter === "linkup_compatible") {
    return {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: "自动推导：search-style vendor api",
      derived: true,
    };
  }

  if (args.adapter === "kiro_compatible") {
    return {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: "自动推导：kiro session-backed vendor api",
      derived: true,
    };
  }

  if (args.adapter === "codex_cli" || args.adapter === "claude_code") {
    return {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: `自动推导：${args.adapter}`,
      derived: true,
    };
  }

  if (isKnownOfficialVendorHost(hostname)) {
    return {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: `自动推导：official host ${hostname}`,
      derived: true,
    };
  }

  if (isKnownHostedAggregatorHost(hostname)) {
    return {
      sourceKind: "aggregator_api",
      aggregatorApiMode: "hosted_compute",
      webReverseAccessMode: null,
      notes: `自动推导：hosted aggregator ${hostname}`,
      derived: true,
    };
  }

  return {
    sourceKind: "aggregator_api",
    aggregatorApiMode: null,
    webReverseAccessMode: null,
    notes: hostname ? `自动推导：compatible upstream ${hostname}` : "自动推导：generic compatible provider",
    derived: true,
  };
}

export function resolveGatewayProviderSourceProfileForWrite(args: {
  sourceProfile?: GatewayProviderSourceProfile | null;
  adapter: GatewayProviderAccountView["adapter"] | string;
  payload: GatewayProviderAccountPayload;
  executionMode: GatewayExecutionMode;
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null;
}): Omit<GatewayProviderSourceView, "derived"> {
  if (args.sourceProfile?.sourceKind) {
    return normalizeExplicitGatewayProviderSourceProfile(args.sourceProfile);
  }

  const inferred = inferGatewayProviderSourceProfile(args);
  return {
    sourceKind: inferred.sourceKind,
    aggregatorApiMode: inferred.aggregatorApiMode,
    webReverseAccessMode: inferred.webReverseAccessMode,
    notes: inferred.notes,
  };
}

export function resolveGatewayProviderSourceProfileForView(args: {
  row: GatewayProviderAccountRow;
  payload: GatewayProviderAccountPayload;
  executionMode: GatewayExecutionMode;
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null;
}): GatewayProviderSourceView {
  if (args.row.sourceKind) {
    return {
      ...normalizeExplicitGatewayProviderSourceProfile({
        sourceKind: args.row.sourceKind,
        aggregatorApiMode: args.row.aggregatorApiMode,
        webReverseAccessMode: args.row.webReverseAccessMode,
        notes: args.row.sourceNotes,
      }),
      derived: false,
    };
  }

  return inferGatewayProviderSourceProfile({
    adapter: args.row.adapter,
    payload: args.payload,
    executionMode: args.executionMode,
    endpointExecutionModes: args.endpointExecutionModes,
  });
}

export function adapterSupportsBrowserBackedExecution(adapter: GatewayProviderAccountView["adapter"] | string) {
  return (
    adapter === "lumalabs_compatible" ||
    adapter === "gemini_canvas_compatible" ||
    adapter === "producer_compatible" ||
    adapter === "udio_compatible"
  );
}

export function defaultExecutionModeForAdapter(adapter: GatewayProviderAccountView["adapter"] | string): GatewayExecutionMode {
  if (
    adapter === "lumalabs_compatible" ||
    adapter === "udio_compatible"
  ) {
    return "browser_backed";
  }
  return "direct_http";
}

export function defaultEndpointExecutionModesForAdapter(
  adapter: GatewayProviderAccountView["adapter"] | string,
): GatewayEndpointExecutionModeMap | null {
  if (adapter === "producer_compatible") {
    return {
      videos_generations: "browser_backed",
    };
  }
  return null;
}

export function normalizeGatewayExecutionMode(
  adapter: GatewayProviderAccountView["adapter"] | string,
  executionMode: GatewayExecutionMode | string | null | undefined,
) {
  const normalized = executionMode?.trim().toLowerCase();
  if (normalized === "direct_http" || normalized === "browser_backed") {
    if (normalized === "browser_backed" && !adapterSupportsBrowserBackedExecution(adapter)) {
      throw new ConflictError(`${adapter} 当前不支持 executionMode=browser_backed。`);
    }
    return normalized as GatewayExecutionMode;
  }
  return defaultExecutionModeForAdapter(adapter);
}

export function normalizeEndpointExecutionModes(
  adapter: GatewayProviderAccountView["adapter"] | string,
  endpointExecutionModes: GatewayEndpointExecutionModeMap | Record<string, GatewayExecutionMode | string | null> | null | undefined,
) {
  const normalizedEntries = Object.entries(endpointExecutionModes ?? {})
    .map(([endpointKind, mode]) => {
      const normalizedEndpointKind = endpointKind.trim().toLowerCase();
      if (!normalizedEndpointKind) {
        return null;
      }
      const normalizedMode = normalizeGatewayExecutionMode(adapter, mode);
      return [normalizedEndpointKind, normalizedMode] as const;
    })
    .filter((entry): entry is readonly [string, GatewayExecutionMode] => entry !== null);

  const defaults = Object.entries(defaultEndpointExecutionModesForAdapter(adapter) ?? {});
  for (const [endpointKind, mode] of defaults) {
    if (!normalizedEntries.some(([existingEndpointKind]) => existingEndpointKind === endpointKind)) {
      normalizedEntries.push([endpointKind, mode]);
    }
  }

  if (normalizedEntries.length === 0) {
    return null;
  }

  return Object.fromEntries(normalizedEntries) as GatewayEndpointExecutionModeMap;
}

export function resolveProviderExecutionMode(
  executionMode: GatewayExecutionMode | string | null | undefined,
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null | undefined,
  endpointKind: GatewayRelayEndpointKind | string,
) {
  const endpointKey = endpointKind.trim().toLowerCase();
  const override = endpointExecutionModes?.[endpointKey as keyof GatewayEndpointExecutionModeMap];
  if (override === "direct_http" || override === "browser_backed") {
    return override;
  }
  if (executionMode === "direct_http" || executionMode === "browser_backed") {
    return executionMode;
  }
  return "direct_http" as GatewayExecutionMode;
}

export function validateSessionBackedProviderRuntime(payload: GatewaySessionBackedProviderRuntime) {
  if (payload.sessionAuth) {
    const transport = normalizeSessionAuthTransport(payload.sessionAuth.transport);
    if (payload.sessionAuth.expiresAt) {
      parseFilterTimestamp(payload.sessionAuth.expiresAt, "sessionAuth.expiresAt");
    }
    if (transport === "header" && !payload.sessionAuth.headerName?.trim()) {
      throw new ConflictError("sessionAuth.transport=header 时必须提供 headerName。");
    }
  }

  if (payload.keepalive) {
    if (!payload.keepalive.serviceUrl?.trim()) {
      throw new ConflictError("keepalive.serviceUrl 不能为空。");
    }
    if (
      payload.keepalive.timeoutSecs != null &&
      (!Number.isFinite(payload.keepalive.timeoutSecs) || payload.keepalive.timeoutSecs <= 0)
    ) {
      throw new ConflictError("keepalive.timeoutSecs 必须是正整数。");
    }
    if (
      payload.keepalive.refreshBeforeSecs != null &&
      (!Number.isFinite(payload.keepalive.refreshBeforeSecs) || payload.keepalive.refreshBeforeSecs <= 0)
    ) {
      throw new ConflictError("keepalive.refreshBeforeSecs 必须是正整数。");
    }
  }
}

export function normalizeOpenAiCompatibleApiKeyPool(payload: GatewayOpenAiCompatibleProviderPayload) {
  const values = [payload.apiKey, ...(payload.apiKeys ?? [])]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

export function validateGatewayProviderPayload(input: UpsertGatewayProviderAccountInput) {
  const payload = input.payload;
  const protocolFamily = normalizeGatewayProtocolFamily(input.protocolFamily);
  const protocolProfile = normalizeGatewayProtocolProfile(input.protocolProfile);
  if (payload.adapter !== input.adapter) {
    throw new ConflictError("payload.adapter 必须与 provider account adapter 一致。");
  }

  const executionMode = normalizeGatewayExecutionMode(input.adapter, input.executionMode);
  const endpointExecutionModes = normalizeEndpointExecutionModes(input.adapter, input.endpointExecutionModes);
  const sourceProfile = resolveGatewayProviderSourceProfileForWrite({
    sourceProfile: input.sourceProfile,
    adapter: input.adapter,
    payload,
    executionMode,
    endpointExecutionModes,
  });
  if (executionMode === "browser_backed" && !adapterSupportsBrowserBackedExecution(input.adapter)) {
    throw new ConflictError(`${input.adapter} 当前不支持 executionMode=browser_backed。`);
  }
  if (
    endpointExecutionModes &&
    Object.values(endpointExecutionModes).some((mode) => mode === "browser_backed") &&
    !adapterSupportsBrowserBackedExecution(input.adapter)
  ) {
    throw new ConflictError(`${input.adapter} 当前不支持 endpointExecutionModes.*=browser_backed。`);
  }

  if (
    payload.adapter === "openai_compatible" ||
    payload.adapter === "anthropic_compatible" ||
    payload.adapter === "grok_compatible" ||
    payload.adapter === "kiro_compatible" ||
    isGatewaySearchProviderPayload(payload) ||
    payload.adapter === "gemini_business_compatible" ||
    payload.adapter === "chataibot_compatible" ||
    payload.adapter === "lumalabs_compatible" ||
    payload.adapter === "gemini_canvas_compatible" ||
    payload.adapter === "producer_compatible" ||
    payload.adapter === "suno_compatible" ||
    payload.adapter === "udio_compatible" ||
    payload.adapter === "custom_http" ||
    payload.adapter === "provider_passthrough"
  ) {
    validateSessionBackedProviderRuntime(payload);
  }

  if (payload.adapter === "openai_compatible") {
    const apiKeyPool = normalizeOpenAiCompatibleApiKeyPool(payload);
    if (apiKeyPool.length === 0) {
      throw new ConflictError("openai_compatible provider 至少需要一个 apiKey。");
    }
    if (
      payload.keySelectionStrategy != null &&
      payload.keySelectionStrategy !== "round-robin" &&
      payload.keySelectionStrategy !== "random"
    ) {
      throw new ConflictError("openai_compatible provider keySelectionStrategy 不合法。");
    }
  }

  if (payload.adapter === "grok_compatible" && !isGatewayOpenAiProtocolFamily(protocolFamily)) {
    throw new ConflictError("grok_compatible 当前必须归属 openai family。");
  }

  if (payload.adapter === "kiro_compatible" && protocolFamily !== "kiro") {
    throw new ConflictError("kiro_compatible 当前必须归属 kiro protocol family。");
  }

  if (isGatewaySearchProviderPayload(payload) && !isGatewaySearchProtocolFamily(protocolFamily)) {
    throw new ConflictError("search_api_compatible 当前必须归属 search family。");
  }

  if (payload.adapter === "gemini_business_compatible" && !isGatewayGeminiBusinessProtocolFamily(protocolFamily)) {
    throw new ConflictError("gemini_business_compatible 当前必须归属 gemini_business image family。");
  }

  if (payload.adapter === "chataibot_compatible" && !isGatewayChataibotProtocolFamily(protocolFamily)) {
    throw new ConflictError("chataibot_compatible 当前必须归属 chataibot image family。");
  }

  if (payload.adapter === "lumalabs_compatible" && !isGatewayLumalabsProtocolFamily(protocolFamily)) {
    throw new ConflictError("lumalabs_compatible 当前必须归属 lumalabs image family。");
  }

  if (payload.adapter === "gemini_canvas_compatible" && !isGatewayGeminiCanvasProtocolFamily(protocolFamily)) {
    throw new ConflictError("gemini_canvas_compatible 当前必须归属 gemini_canvas media family。");
  }

  if (payload.adapter === "producer_compatible" && !isGatewayProducerProtocolFamily(protocolFamily)) {
    throw new ConflictError("producer_compatible 当前必须归属 producer protocol family。");
  }

  if (payload.adapter === "suno_compatible" && !isGatewaySunoProtocolFamily(protocolFamily)) {
    throw new ConflictError("suno_compatible 当前必须归属 suno music family。");
  }

  if (payload.adapter === "udio_compatible" && !isGatewayUdioProtocolFamily(protocolFamily)) {
    throw new ConflictError("udio_compatible 当前必须归属 udio protocol family。");
  }

  if (payload.adapter === "anthropic_compatible" && !isGatewayAnthropicProtocolFamily(protocolFamily)) {
    throw new ConflictError("anthropic_compatible 当前必须归属 anthropic family。");
  }

  if (payload.adapter === "gemini_api_compatible" && !isGatewayGeminiProtocolFamily(protocolFamily)) {
    throw new ConflictError("gemini_api_compatible 当前必须归属 gemini family。");
  }

  if (payload.adapter === "bedrock_converse_compatible" && !isGatewayBedrockProtocolFamily(protocolFamily)) {
    throw new ConflictError("bedrock_converse_compatible 当前必须归属 bedrock family。");
  }

  if (payload.adapter === "cohere_compatible" && !isGatewayCohereProtocolFamily(protocolFamily)) {
    throw new ConflictError("cohere_compatible 当前必须归属 cohere family。");
  }

  void executionMode;
  void protocolProfile;
  void sourceProfile;
}
