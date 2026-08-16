export const gatewayProviderAccountStatuses = ["active", "cooling", "disabled", "archived"] as const;

export type GatewayProviderAccountStatus = (typeof gatewayProviderAccountStatuses)[number];

export const gatewayExecutionModes = ["direct_http", "browser_backed"] as const;

export type GatewayExecutionMode = (typeof gatewayExecutionModes)[number];

export const gatewayProviderSourceKinds = [
  "official_model_api",
  "official_vendor_api",
  "aggregator_api",
  "web_reverse_api",
] as const;

export type GatewayProviderSourceKind = (typeof gatewayProviderSourceKinds)[number];

export const gatewayAggregatorApiModes = ["hosted_compute", "upstream_forward"] as const;

export type GatewayAggregatorApiMode = (typeof gatewayAggregatorApiModes)[number];

export const gatewayWebReverseAccessModes = ["direct_http_replay", "browser_challenge"] as const;

export type GatewayWebReverseAccessMode = (typeof gatewayWebReverseAccessModes)[number];

export const gatewayProviderKeySelectionStrategies = ["round-robin", "random"] as const;

export type GatewayProviderKeySelectionStrategy = (typeof gatewayProviderKeySelectionStrategies)[number];

export const gatewayProtocolBridgeStrategies = [
  "canonical_only",
  "prefer_same_protocol_fast_path",
] as const;

export type GatewayProtocolBridgeStrategy = (typeof gatewayProtocolBridgeStrategies)[number];

export const gatewayRelayPipelineModes = [
  "canonical_transform",
  "same_protocol_fast_path",
  "provider_passthrough",
] as const;

export type GatewayRelayPipelineMode = (typeof gatewayRelayPipelineModes)[number];

export type GatewayProviderSourceProfile = {
  sourceKind: GatewayProviderSourceKind;
  aggregatorApiMode?: GatewayAggregatorApiMode | null;
  webReverseAccessMode?: GatewayWebReverseAccessMode | null;
  notes?: string | null;
};

export type GatewayProtocolBridgeConfig = {
  protocolBridgeStrategy?: GatewayProtocolBridgeStrategy | null;
};

export type GatewayProviderSourceView = {
  sourceKind: GatewayProviderSourceKind;
  aggregatorApiMode: GatewayAggregatorApiMode | null;
  webReverseAccessMode: GatewayWebReverseAccessMode | null;
  notes: string | null;
  derived: boolean;
};

export const gatewayRelayEndpointKinds = [
  "responses",
  "chat_completions",
  "completions",
  "embeddings",
  "audio_transcriptions",
  "audio_speech",
  "images_generations",
  "images_edits",
  "messages",
  "music_generations",
  "videos_generations",
  "search",
  "fetch",
  "research_create",
  "research_list",
  "research_get",
  "credits_balance",
] as const;

export type GatewayRelayEndpointKind = (typeof gatewayRelayEndpointKinds)[number];

export type GatewayEndpointExecutionModeMap = Partial<Record<GatewayRelayEndpointKind, GatewayExecutionMode>>;

export const gatewayProviderAdapters = [
  "openai_compatible",
  "anthropic_compatible",
  "gemini_api_compatible",
  "bedrock_converse_compatible",
  "cohere_compatible",
  "grok_compatible",
  "accio_compatible",
  "qwen_web_compatible",
  "aistudio_web_reverse_compatible",
  "kiro_compatible",
  "freebuff_compatible",
  "xfyun_websocket_compatible",
  "search_api_compatible",
  "linkup_compatible",
  "producer_compatible",
  "gemini_api_modular_compatible",
  "gemini_business_compatible",
  "gemini_web_compatible",
  "gemini_web_reverse_modular_compatible",
  "chatgpt_web_reverse_compatible",
  "chataibot_compatible",
  "lumalabs_compatible",
  "gemini_canvas_compatible",
  "gemini_canvas_web_reverse_compatible",
  "gemini_canvas_program_web_reverse_compatible",
  "suno_compatible",
  "udio_compatible",
  "codex_cli",
  "claude_code",
  "custom_http",
  "provider_passthrough",
] as const;

export type GatewayProviderAdapter = (typeof gatewayProviderAdapters)[number];

export const gatewayProtocolFamilies = [
  "openai",
  "openai_chat",
  "openai_legacy_completions",
  "openai_responses",
  "openai_realtime",
  "openai_embeddings",
  "openai_audio_transcriptions",
  "openai_audio_speech",
  "openai_images_generations",
  "openai_images_edits",
  "openai_music_generations",
  "openai_videos_generations",
  "anthropic",
  "anthropic_messages",
  "gemini",
  "gemini_generate_content",
  "gemini_live",
  "chatgpt_web_chat",
  "gemini_web_chat",
  "qwen_web_chat",
  "bedrock",
  "bedrock_converse",
  "cohere",
  "cohere_chat",
  "kiro",
  "freebuff",
  "search_api",
  "search",
  "perplexity_search",
  "tavily_search",
  "exa_search",
  "jina_search",
  "jina_reader",
  "linkup_search",
  "you_search",
  "websearchapi_search",
  "linkup",
  "gemini_business",
  "gemini_business_images",
  "chataibot",
  "chataibot_images",
  "lumalabs",
  "lumalabs_images",
  "lumalabs_videos",
  "lumalabs_audio",
  "producer",
  "producer_images",
  "producer_music",
  "producer_videos",
  "gemini_canvas",
  "gemini_canvas_images",
  "gemini_canvas_music",
  "gemini_canvas_videos",
  "suno",
  "suno_images",
  "suno_music",
  "suno_videos",
  "udio",
  "udio_images",
  "udio_music",
  "udio_videos",
  "xfyun_websocket",
  "codex",
  "claude",
  "provider_passthrough",
] as const;

export type GatewayProtocolFamily = (typeof gatewayProtocolFamilies)[number];

export const gatewayProtocolProfiles = [
  "openai",
  "chatgpt_official_api",
  "chatgpt_codex_backend",
  "chatgpt_web_reverse",
  "openai_compatible_generic",
  "azure_openai",
  "anthropic",
  "grok_web",
  "google_gemini_api",
  "google_gemini_api_modular",
  "google_vertex_gemini",
  "gemini_web",
  "gemini_web_reverse_modular",
  "aws_bedrock",
  "cohere",
  "groq",
  "together",
  "openrouter",
  "deepseek",
  "mistral",
  "xai",
  "nvidia",
  "perplexity_chat",
  "perplexity_search",
  "tavily",
  "exa",
  "jina_search",
  "jina_reader",
  "linkup",
  "you_search",
  "websearchapi",
  "xfyun_openai",
  "xfyun_native_websocket",
  "kiro",
  "freebuff",
  "producer",
  "gemini_canvas",
  "gemini_canvas_web_reverse_modular",
  "gemini_canvas_program_web_reverse_modular",
  "suno",
  "udio",
  "gemini_business",
  "chataibot",
  "lumalabs",
  "qwen",
  "qwen_dashscope_openai",
  "qwen_coding_plan_openai",
  "qwen_coding_plan_anthropic",
  "qwen_web_chat",
  "aistudio_web_reverse",
  "accio",
  "codex",
  "search_generic",
  "custom",
] as const;

export type GatewayProtocolProfile = (typeof gatewayProtocolProfiles)[number];

export type GatewaySessionAuthTransport = "cookie" | "bearer" | "header";

export type GatewaySessionAuthConfig = {
  transport?: GatewaySessionAuthTransport | null;
  primaryCookieName?: string | null;
  secondaryCookieName?: string | null;
  headerName?: string | null;
  expiresAt?: string | null;
};

export type GatewayKeepaliveConfig = {
  serviceUrl: string;
  ensurePath?: string | null;
  authToken?: string | null;
  timeoutSecs?: number | null;
  refreshBeforeSecs?: number | null;
};

export type GatewaySessionBackedProviderRuntime = {
  credentialId?: string | null;
  sessionAuth?: GatewaySessionAuthConfig | null;
  keepalive?: GatewayKeepaliveConfig | null;
  expiresAt?: string | null;
  runtimeStateObjectKey?: string | null;
  accountName?: string | null;
};

export type GatewayKeepaliveEnsureRequest = {
  projectId?: string | null;
  sessionKey?: string | null;
  previousResponseId?: string | null;
  credentialId?: string | null;
  providerAccountId: string;
  adapter: GatewayProviderAdapter | string;
  baseUrl: string;
  model: string;
  apiKey?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
  sessionAuth?: GatewaySessionAuthConfig | null;
  expiresAt?: string | null;
  runtimeStateObjectKey?: string | null;
  accountName?: string | null;
};

export type GatewayKeepaliveEnsureResponse = {
  ready: boolean;
  message?: string | null;
  apiKey?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
  sessionAuth?: GatewaySessionAuthConfig | null;
  keepalive?: GatewayKeepaliveConfig | null;
  expiresAt?: string | null;
  runtimeStateObjectKey?: string | null;
  upstreamSessionId?: string | null;
};

export type GatewayOpenAiCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "openai_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  apiKeys?: string[] | null;
  keySelectionStrategy?: GatewayProviderKeySelectionStrategy | null;
  authMode?: "bearer" | "x-api-key" | "api-key" | null;
  defaultModel?: string | null;
  completionsPath?: string | null;
  responsesPath?: string | null;
  chatCompletionsPath?: string | null;
  embeddingsPath?: string | null;
  audioTranscriptionsPath?: string | null;
  audioSpeechPath?: string | null;
  messagesPath?: string | null;
  modelsPath?: string | null;
  headers?: Record<string, string> | null;
  /** Data-driven body fields merged into every request. Keys already present are NOT overwritten. */
  extraBody?: Record<string, unknown> | null;
};

export type GatewayAnthropicCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "anthropic_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  defaultModel?: string | null;
  messagesPath?: string | null;
  modelsPath?: string | null;
  anthropicVersion?: string | null;
  betaHeaders?: string[] | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayGeminiApiCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "gemini_api_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authHeaderName?: string | null;
  authToken?: string | null;
  defaultModel?: string | null;
  responsesPath?: string | null;
  chatCompletionsPath?: string | null;
  messagesPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayGeminiApiModularCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "gemini_api_modular_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authHeaderName?: string | null;
  authToken?: string | null;
  defaultModel?: string | null;
  responsesPath?: string | null;
  chatCompletionsPath?: string | null;
  messagesPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayBedrockConverseCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "bedrock_converse_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authHeaderName?: string | null;
  authToken?: string | null;
  defaultModel?: string | null;
  messagesPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayCohereCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "cohere_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authMode?: "bearer" | "x-api-key" | "api-key" | null;
  defaultModel?: string | null;
  chatCompletionsPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayGrokCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "grok_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  defaultModel?: string | null;
  chatCompletionsPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayAccioCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "accio_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  responsesPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayKiroCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "kiro_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  defaultModel?: string | null;
  responsesPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayFreebuffCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "freebuff_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  defaultModel?: string | null;
  responsesPath?: string | null;
  chatCompletionsPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayQwenWebCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "qwen_web_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  defaultModel?: string | null;
  responsesPath?: string | null;
  chatCompletionsPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayAiStudioWebReverseCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "aistudio_web_reverse_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayXfyunWebsocketCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "xfyun_websocket_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  chatCompletionsPath?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewaySearchApiCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "search_api_compatible" | "linkup_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  defaultModel?: string | null;
  searchPath?: string | null;
  fetchPath?: string | null;
  researchPath?: string | null;
  balancePath?: string | null;
  authHeaderName?: string | null;
  authToken?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayLinkupCompatibleProviderPayload = GatewaySearchApiCompatibleProviderPayload;

export type GatewayProducerCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "producer_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  defaultModel?: string | null;
  conversationPath?: string | null;
  messagesPathPrefix?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayGeminiBusinessCompatibleProviderPayload = GatewaySessionBackedProviderRuntime & {
  adapter: "gemini_business_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
  chatCompletionsPath?: string | null;
  responsesPath?: string | null;
};

// Distinct from Gemini Canvas Web. This surface models the generic Gemini Web
// reverse-chat contract.
export type GatewayGeminiWebCompatibleProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
    adapter: "gemini_web_compatible";
    baseUrl: string;
    accountLabel: string;
    apiKey: string;
    authToken?: string | null;
    defaultModel?: string | null;
    chatCompletionsPath?: string | null;
    headers?: Record<string, string> | null;
    extraBody?: Record<string, unknown> | null;
  };

export type GatewayGeminiWebReverseModularCompatibleProviderPayload =
  GatewaySessionBackedProviderRuntime &
    GatewayProtocolBridgeConfig & {
      adapter: "gemini_web_reverse_modular_compatible";
      baseUrl: string;
      accountLabel: string;
      apiKey: string;
      authToken?: string | null;
      defaultModel?: string | null;
      chatCompletionsPath?: string | null;
      headers?: Record<string, string> | null;
      extraBody?: Record<string, unknown> | null;
    };

export type GatewayChatGptWebReverseCompatibleProviderPayload =
  GatewaySessionBackedProviderRuntime &
    GatewayProtocolBridgeConfig & {
      adapter: "chatgpt_web_reverse_compatible";
      baseUrl: string;
      accountLabel: string;
      apiKey: string;
      authToken?: string | null;
      defaultModel?: string | null;
      modelsPath?: string | null;
      headers?: Record<string, string> | null;
      extraBody?: Record<string, unknown> | null;
    };

export type GatewayChataibotCompatibleProviderPayload = GatewaySessionBackedProviderRuntime & {
  adapter: "chataibot_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayLumalabsCompatibleProviderPayload = GatewaySessionBackedProviderRuntime & {
  adapter: "lumalabs_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

// Distinct from Gemini official APIs and generic Gemini Web. This surface
// models Gemini Canvas Web reverse-web runtime material and execution.
export type GatewayGeminiCanvasCompatibleProviderPayload = GatewaySessionBackedProviderRuntime & {
  adapter: "gemini_canvas_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayGeminiCanvasWebReverseCompatibleProviderPayload =
  GatewaySessionBackedProviderRuntime &
    GatewayProtocolBridgeConfig & {
      adapter: "gemini_canvas_web_reverse_compatible";
      baseUrl: string;
      accountLabel: string;
      apiKey: string;
      authToken?: string | null;
      defaultModel?: string | null;
      headers?: Record<string, string> | null;
      extraBody?: Record<string, unknown> | null;
    };

export type GatewayGeminiCanvasProgramWebReverseCompatibleProviderPayload =
  GatewaySessionBackedProviderRuntime &
    GatewayProtocolBridgeConfig & {
      adapter: "gemini_canvas_program_web_reverse_compatible";
      baseUrl: string;
      accountLabel: string;
      apiKey: string;
      authToken?: string | null;
      defaultModel?: string | null;
      headers?: Record<string, string> | null;
      extraBody?: Record<string, unknown> | null;
    };

export type GatewaySunoCompatibleProviderPayload = GatewaySessionBackedProviderRuntime & {
  adapter: "suno_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayUdioCompatibleProviderPayload = GatewaySessionBackedProviderRuntime & {
  adapter: "udio_compatible";
  baseUrl: string;
  accountLabel: string;
  apiKey: string;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayCodexCliProviderPayload = {
  adapter: "codex_cli";
  codexHomeBundleObjectKey: string;
  accountLabel: string;
  defaultModel?: string | null;
  reasoningEffort?: string | null;
};

export type GatewayClaudeCodeProviderPayload = {
  adapter: "claude_code";
  claudeHomeBundleObjectKey: string;
  accountLabel: string;
  defaultModel?: string | null;
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan" | null;
};

export type GatewayCustomHttpProviderPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "custom_http";
  provider?: string | null;
  baseUrl: string;
  accountLabel: string;
  authHeaderName?: string | null;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayProviderPassthroughPayload = GatewaySessionBackedProviderRuntime &
  GatewayProtocolBridgeConfig & {
  adapter: "provider_passthrough";
  provider: string;
  accountLabel: string;
  baseUrl: string;
  authHeaderName?: string | null;
  authToken?: string | null;
  defaultModel?: string | null;
  headers?: Record<string, string> | null;
  extraBody?: Record<string, unknown> | null;
};

export type GatewayProviderAccountPayload =
  | GatewayOpenAiCompatibleProviderPayload
  | GatewayAnthropicCompatibleProviderPayload
  | GatewayGeminiApiCompatibleProviderPayload
  | GatewayGeminiApiModularCompatibleProviderPayload
  | GatewayBedrockConverseCompatibleProviderPayload
  | GatewayCohereCompatibleProviderPayload
  | GatewayGrokCompatibleProviderPayload
  | GatewayAccioCompatibleProviderPayload
  | GatewayQwenWebCompatibleProviderPayload
  | GatewayAiStudioWebReverseCompatibleProviderPayload
  | GatewayKiroCompatibleProviderPayload
  | GatewayFreebuffCompatibleProviderPayload
  | GatewayXfyunWebsocketCompatibleProviderPayload
  | GatewaySearchApiCompatibleProviderPayload
  | GatewayProducerCompatibleProviderPayload
  | GatewayGeminiBusinessCompatibleProviderPayload
  | GatewayGeminiWebCompatibleProviderPayload
  | GatewayGeminiWebReverseModularCompatibleProviderPayload
  | GatewayChatGptWebReverseCompatibleProviderPayload
  | GatewayChataibotCompatibleProviderPayload
  | GatewayLumalabsCompatibleProviderPayload
  | GatewayGeminiCanvasCompatibleProviderPayload
  | GatewayGeminiCanvasWebReverseCompatibleProviderPayload
  | GatewayGeminiCanvasProgramWebReverseCompatibleProviderPayload
  | GatewaySunoCompatibleProviderPayload
  | GatewayUdioCompatibleProviderPayload
  | GatewayCodexCliProviderPayload
  | GatewayClaudeCodeProviderPayload
  | GatewayCustomHttpProviderPayload
  | GatewayProviderPassthroughPayload;

export type GatewayProviderAccountView = {
  id: string;
  label: string;
  serviceProviderKey: string;
  serviceProviderLabel: string;
  adapter: GatewayProviderAdapter;
  status: GatewayProviderAccountStatus;
  protocolFamily: GatewayProtocolFamily;
  protocolProfile: GatewayProtocolProfile | string;
  sourceProfile: GatewayProviderSourceView;
  executionMode: GatewayExecutionMode;
  endpointExecutionModes: GatewayEndpointExecutionModeMap | null;
  payload: GatewayProviderAccountPayload;
  createdAt: string;
  updatedAt: string;
  cooldownUntil: string | null;
  lastError: string | null;
  failureCount: number;
};

export type GatewayProviderCredentialView = {
  id: string;
  providerAccountId: string;
  label: string;
  status: string;
  credential: Record<string, unknown>;
  credentialMaterialKey: string | null;
  selectedDisplayModel: string | null;
  supportedModels: string[];
  storageMode: string;
  sourceKind: string;
  sourcePath: string | null;
  sourceHash: string | null;
  syncMode: string;
  syncState: string;
  syncError: string | null;
  cooldownUntil: string | null;
  lastError: string | null;
  failureCount: number;
  lastHealthCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  providerQuota: GatewayProviderQuotaView | null;
  sharedPayloadHints: {
    baseUrl: string | null;
    defaultModel: string | null;
    accountLabel: string | null;
  };
};

export type UpsertGatewayProviderCredentialInput = {
  label: string;
  status?: string | null;
  credential: Record<string, unknown>;
  sourceKind?: string | null;
  sourcePath?: string | null;
  sourceHash?: string | null;
  syncMode?: string | null;
  syncState?: string | null;
  syncError?: string | null;
};

export type PatchGatewayProviderCredentialInput = {
  providerAccountId?: string | null;
  label?: string | null;
  status?: string | null;
  credential?: Record<string, unknown> | null;
  sourceKind?: string | null;
  sourcePath?: string | null;
  sourceHash?: string | null;
  syncMode?: string | null;
  syncState?: string | null;
  syncError?: string | null;
};

export type GatewayProviderCapabilityView = {
  id: string;
  providerAccountId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GatewayProviderQuotaWindowView = {
  key: string;
  label: string;
  usedPercent: number | null;
  remainingRatio: number | null;
  limitWindowSeconds: number | null;
  resetAt: string | null;
  resetAfterSeconds: number | null;
};

export type GatewayProviderQuotaView = {
  providerAccountId: string;
  providerType: string;
  source: string;
  status: "available" | "warning" | "exhausted" | "unknown";
  ready: boolean;
  checkedAt: string;
  nextCheckAt: string;
  nextResetAt: string | null;
  planType: string | null;
  representativeClaim: string | null;
  windows: GatewayProviderQuotaWindowView[];
  error: string | null;
  rawData: Record<string, unknown>;
};

export type GatewayProviderCredentialFolderSyncStatusView = {
  enabled: boolean;
  rootDir: string | null;
  intervalSeconds: number | null;
  watchEnabled: boolean;
  watchRunning: boolean;
  watchDebounceMillis: number | null;
  importEnabled: boolean;
  exportEnabled: boolean;
  deleteMissing: boolean;
  lastRunAt: string | null;
  lastImportAt: string | null;
  lastExportAt: string | null;
  lastWatchEventAt: string | null;
  lastExplicitDeleteAt: string | null;
  lastExplicitDeleteCount: number;
  lastExplicitDeletePaths: string[];
  recentExplicitDeleteEvents: GatewayProviderCredentialFolderSyncExplicitDeleteEventView[];
  importedCount: number;
  updatedCount: number;
  exportedCount: number;
  deletedCount: number;
  skippedCount: number;
  lastError: string | null;
  lastWatchError: string | null;
};

export type GatewayProviderCredentialFolderSyncExplicitDeleteEventView = {
  eventId: string;
  occurredAt: string;
  deletedCount: number;
  deletedPaths: string[];
  providerCredentialIds: string[];
};

export type UpsertGatewayProviderAccountInput = {
  label: string;
  serviceProviderKey?: string | null;
  serviceProviderLabel?: string | null;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  protocolProfile?: GatewayProtocolProfile | string | null;
  status?: GatewayProviderAccountStatus;
  sourceProfile?: GatewayProviderSourceProfile | null;
  executionMode?: GatewayExecutionMode | null;
  endpointExecutionModes?: GatewayEndpointExecutionModeMap | null;
  payload: GatewayProviderAccountPayload;
};

export type PatchGatewayProviderSourceProfileInput = {
  sourceProfile: GatewayProviderSourceProfile;
};

export type GatewayProviderSourceProfileBackfillInput = {
  providerAccountIds?: string[] | null;
  onlyMissing?: boolean;
};

export type GatewayProviderSourceProfileBackfillResult = {
  scannedCount: number;
  updatedCount: number;
  skippedCount: number;
  providerAccounts: GatewayProviderAccountView[];
};

export type UpsertGatewayProviderCapabilityInput = {
  providerAccountId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel?: string | null;
  enabled?: boolean;
};
