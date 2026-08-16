import type { GatewaySearchApiCompatibleProviderPayload, GatewayProtocolFamily, GatewayProtocolProfile, GatewayProviderAccountPayload, GatewayProviderAccountView } from "@neuro/contracts";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

import { normalizeOptionalText, normalizeRequiredText } from "./shared";

export function normalizeGatewayServiceProviderIdentity(
  providerLabel: string,
  serviceProviderKey: string | null | undefined,
  serviceProviderLabel: string | null | undefined,
) {
  const normalizedLabel =
    normalizeOptionalText(serviceProviderLabel, 120) ?? normalizeRequiredText(providerLabel, "服务商归属名", 120);
  const normalizedKey =
    normalizeOptionalText(serviceProviderKey, 120) != null
      ? normalizeGatewayServiceProviderKey(serviceProviderKey ?? "")
      : deriveGatewayServiceProviderKey(normalizedLabel);
  return {
    serviceProviderKey: normalizedKey,
    serviceProviderLabel: normalizedLabel,
  };
}

export function normalizeGatewayServiceProviderKey(value: string) {
  const normalized = sanitizeGatewayServiceProviderKey(value);
  if (!normalized) {
    throw new ConflictError("serviceProviderKey 只允许字母、数字与分隔符，归一化后不能为空。");
  }
  if (normalized.length > 120) {
    throw new ConflictError("serviceProviderKey 长度不能超过 120 个字符。");
  }
  return normalized;
}

export function deriveGatewayServiceProviderKey(label: string) {
  const normalized = sanitizeGatewayServiceProviderKey(label);
  if (normalized) {
    return normalized;
  }
  return `sp_${stableGatewayServiceProviderHash(label)}`;
}

export function normalizeGatewayProtocolProfile(
  value: GatewayProtocolProfile | string | null | undefined,
): GatewayProtocolProfile | string {
  const normalized = value?.trim().toLowerCase().replace(/[-\s]+/g, "_") ?? "";
  return normalized || "custom";
}

export function normalizeGatewayProtocolFamily(
  value: GatewayProtocolFamily | string | null | undefined,
): GatewayProtocolFamily | string {
  const normalized = value?.trim().toLowerCase().replace(/[-\s]+/g, "_") ?? "";
  switch (normalized) {
    case "openai_chat_completions":
    case "chat_completions":
    case "chat":
      return "openai_chat";
    case "openai_completions":
    case "legacy_completions":
    case "completions":
      return "openai_legacy_completions";
    case "responses":
      return "openai_responses";
    case "realtime":
      return "openai_realtime";
    case "embeddings":
      return "openai_embeddings";
    case "audio_transcriptions":
    case "transcriptions":
      return "openai_audio_transcriptions";
    case "audio_speech":
      return "openai_audio_speech";
    case "images_generations":
    case "image_generations":
      return "openai_images_generations";
    case "images_edits":
    case "image_edits":
      return "openai_images_edits";
    case "music_generations":
      return "openai_music_generations";
    case "videos_generations":
      return "openai_videos_generations";
    case "messages":
      return "anthropic_messages";
    case "generate_content":
      return "gemini_generate_content";
    case "converse":
      return "bedrock_converse";
    case "cohere_chat_v2":
      return "cohere_chat";
    case "perplexity":
    case "perplexity_search":
      return "perplexity_search";
    case "tavily":
      return "tavily_search";
    case "exa":
      return "exa_search";
    case "jina":
      return "jina_search";
    case "linkup":
      return "linkup_search";
    case "you":
      return "you_search";
    case "websearchapi":
      return "websearchapi_search";
    case "gemini_business":
      return "gemini_business_images";
    case "chataibot":
      return "chataibot_images";
    case "lumalabs":
      return "lumalabs_images";
    case "producer_music":
      return "producer_music";
    case "producer_videos":
      return "producer_videos";
    case "gemini_canvas_images":
      return "gemini_canvas_images";
    case "gemini_canvas_music":
      return "gemini_canvas_music";
    case "gemini_canvas_videos":
      return "gemini_canvas_videos";
    case "suno_music":
      return "suno_music";
    case "udio_music":
      return "udio_music";
    case "search_api":
      return "search";
    default:
      return normalized || "openai";
  }
}

export function isGatewaySearchProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return (
    normalized === "search" ||
    normalized === "search_api" ||
    normalized === "perplexity_search" ||
    normalized === "tavily_search" ||
    normalized === "exa_search" ||
    normalized === "jina_search" ||
    normalized === "jina_reader" ||
    normalized === "linkup_search" ||
    normalized === "you_search" ||
    normalized === "websearchapi_search"
  );
}

export function isGatewaySearchAdapter(adapter: GatewayProviderAccountView["adapter"] | string) {
  return adapter === "search_api_compatible" || adapter === "linkup_compatible";
}

export function isGatewaySearchProviderPayload(
  payload: GatewayProviderAccountPayload,
): payload is GatewaySearchApiCompatibleProviderPayload {
  return isGatewaySearchAdapter(payload.adapter);
}

export function isGatewayOpenAiProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return (
    normalized === "openai" ||
    normalized === "openai_chat" ||
    normalized === "openai_legacy_completions" ||
    normalized === "openai_responses" ||
    normalized === "openai_realtime" ||
    normalized === "openai_embeddings" ||
    normalized === "openai_audio_transcriptions" ||
    normalized === "openai_audio_speech" ||
    normalized === "openai_images_generations" ||
    normalized === "openai_images_edits" ||
    normalized === "openai_music_generations" ||
    normalized === "openai_videos_generations"
  );
}

export function isGatewayAnthropicProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "anthropic" || normalized === "anthropic_messages";
}

export function isGatewayGeminiProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "gemini" || normalized === "gemini_generate_content" || normalized === "gemini_live";
}

export function isGatewayBedrockProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "bedrock" || normalized === "bedrock_converse";
}

export function isGatewayCohereProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "cohere" || normalized === "cohere_chat";
}

export function isGatewayGeminiBusinessProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "gemini_business" || normalized === "gemini_business_images";
}

export function isGatewayChataibotProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "chataibot" || normalized === "chataibot_images";
}

export function isGatewayLumalabsProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "lumalabs" || normalized === "lumalabs_images";
}

export function isGatewayGeminiCanvasProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return (
    normalized === "gemini_canvas" ||
    normalized === "gemini_canvas_images" ||
    normalized === "gemini_canvas_music" ||
    normalized === "gemini_canvas_videos"
  );
}

export function isGatewayProducerProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "producer" || normalized === "producer_music" || normalized === "producer_videos";
}

export function isGatewaySunoProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "suno" || normalized === "suno_music";
}

export function isGatewayUdioProtocolFamily(value: GatewayProtocolFamily | string | null | undefined) {
  const normalized = normalizeGatewayProtocolFamily(value);
  return normalized === "udio" || normalized === "udio_music";
}

export function sanitizeGatewayServiceProviderKey(value: string) {
  let normalized = "";
  let previousWasSeparator = false;
  for (const char of value.trim()) {
    const lowered = char.toLowerCase();
    if (/^[a-z0-9]$/.test(lowered)) {
      normalized += lowered;
      previousWasSeparator = false;
      continue;
    }
    if (/[ _./:-]/.test(char) && !previousWasSeparator) {
      normalized += "_";
      previousWasSeparator = true;
    }
  }
  return normalized.replace(/^_+|_+$/g, "").slice(0, 120);
}

export function stableGatewayServiceProviderHash(value: string) {
  let hash = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  for (const byte of Buffer.from(value, "utf8")) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}
