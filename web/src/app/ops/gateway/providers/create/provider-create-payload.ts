export type ProviderCreatePayloadArgs = {
  adapter: string;
  accountLabel: string;
  baseUrl: string | null;
  defaultModel: string | null;
  authMode: string | null;
  defaultPayloadPatch?: Record<string, unknown>;
};

export type ProviderCreatePayload = {
  adapter: string;
  accountLabel: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string | null;
  [key: string]: unknown;
};

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

export function buildProviderPayload(args: ProviderCreatePayloadArgs): ProviderCreatePayload {
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
    case "gemini_api_modular_compatible":
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
    case "aistudio_web_reverse_compatible":
    case "freebuff_compatible":
    case "qwen_web_compatible":
    case "chatgpt_web_reverse_compatible":
    case "gemini_web_compatible":
    case "gemini_web_reverse_modular_compatible":
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
    case "gemini_canvas_web_reverse_compatible":
    case "gemini_canvas_program_web_reverse_compatible":
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
