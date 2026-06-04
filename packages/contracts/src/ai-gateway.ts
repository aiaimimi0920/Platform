export const gatewayTenantStatuses = ["active", "archived"] as const;

export type GatewayTenantStatus = (typeof gatewayTenantStatuses)[number];

export const gatewayProjectStatuses = ["active", "archived"] as const;

export type GatewayProjectStatus = (typeof gatewayProjectStatuses)[number];

export const gatewayApiKeyStatuses = ["active", "revoked"] as const;

export type GatewayApiKeyStatus = (typeof gatewayApiKeyStatuses)[number];

export const gatewayAccessKeyOwnerTypes = ["user", "platform", "project"] as const;

export type GatewayAccessKeyOwnerType = (typeof gatewayAccessKeyOwnerTypes)[number];

export const gatewayAccessKeyKinds = ["normal", "auto_route"] as const;

export type GatewayAccessKeyKind = (typeof gatewayAccessKeyKinds)[number];

export const gatewayAccessKeyStatuses = ["active", "frozen", "revoked", "expired"] as const;

export type GatewayAccessKeyStatus = (typeof gatewayAccessKeyStatuses)[number];

export const gatewayAccessBalanceModes = ["time_pass", "token_prepaid", "message_prepaid"] as const;

export type GatewayAccessBalanceMode = (typeof gatewayAccessBalanceModes)[number];

export const gatewayAccessBundleBillingModes = ["time_pass", "token_prepaid", "message_prepaid"] as const;

export type GatewayAccessBundleBillingMode = (typeof gatewayAccessBundleBillingModes)[number];

export const gatewayPlatformTiers = ["low", "mid", "high"] as const;

export type GatewayPlatformTier = (typeof gatewayPlatformTiers)[number];

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
  "kiro_compatible",
  "freebuff_compatible",
  "xfyun_websocket_compatible",
  "search_api_compatible",
  "linkup_compatible",
  "producer_compatible",
  "gemini_business_compatible",
  "gemini_web_compatible",
  "chatgpt_web_reverse_compatible",
  "chataibot_compatible",
  "lumalabs_compatible",
  "gemini_canvas_compatible",
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
  "producer",
  "producer_images",
  "producer_music",
  "producer_videos",
  "gemini_canvas",
  "gemini_canvas_images",
  "gemini_canvas_music",
  "gemini_canvas_videos",
  "suno",
  "suno_music",
  "udio",
  "udio_music",
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
  "openai_compatible_generic",
  "azure_openai",
  "anthropic",
  "grok_web",
  "google_gemini_api",
  "google_vertex_gemini",
  "gemini_web",
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
  "suno",
  "udio",
  "gemini_business",
  "chataibot",
  "lumalabs",
  "qwen",
  "accio",
  "codex",
  "search_generic",
  "custom",
] as const;

export type GatewayProtocolProfile = (typeof gatewayProtocolProfiles)[number];

export const gatewayRequestStatuses = ["running", "completed", "failed", "cancelled"] as const;

export type GatewayRequestStatus = (typeof gatewayRequestStatuses)[number];

export const gatewayRouteSelectionStrategies = ["priority", "weighted_random"] as const;

export type GatewayRouteSelectionStrategy = (typeof gatewayRouteSelectionStrategies)[number];

export const gatewayProjectSourceKinds = ["manual", "benefit_service_user"] as const;

export type GatewayProjectSourceKind = (typeof gatewayProjectSourceKinds)[number];

export const gatewayTenantSourceKinds = ["manual", "benefit_user"] as const;

export type GatewayTenantSourceKind = (typeof gatewayTenantSourceKinds)[number];

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
  | GatewayBedrockConverseCompatibleProviderPayload
  | GatewayCohereCompatibleProviderPayload
  | GatewayGrokCompatibleProviderPayload
  | GatewayAccioCompatibleProviderPayload
  | GatewayKiroCompatibleProviderPayload
  | GatewayFreebuffCompatibleProviderPayload
  | GatewayXfyunWebsocketCompatibleProviderPayload
  | GatewaySearchApiCompatibleProviderPayload
  | GatewayProducerCompatibleProviderPayload
  | GatewayGeminiBusinessCompatibleProviderPayload
  | GatewayGeminiWebCompatibleProviderPayload
  | GatewayChatGptWebReverseCompatibleProviderPayload
  | GatewayChataibotCompatibleProviderPayload
  | GatewayLumalabsCompatibleProviderPayload
  | GatewayGeminiCanvasCompatibleProviderPayload
  | GatewaySunoCompatibleProviderPayload
  | GatewayUdioCompatibleProviderPayload
  | GatewayCodexCliProviderPayload
  | GatewayClaudeCodeProviderPayload
  | GatewayCustomHttpProviderPayload
  | GatewayProviderPassthroughPayload;

export type GatewayRateLimitDefinition = {
  windowSeconds: number | null;
  maxRequests: number | null;
};

export const gatewayRateLimitHotspotAnomalyCodes = [
  "rate_limit_request_spike",
  "rate_limit_code_concentration",
  "rate_limit_project_hotspot",
  "rate_limit_api_key_hotspot",
  "rate_limit_model_hotspot",
  "rate_limit_endpoint_hotspot",
] as const;

export type GatewayRateLimitHotspotAnomalyCode = (typeof gatewayRateLimitHotspotAnomalyCodes)[number];

export const gatewayRateLimitHotspotAutoRemediationActionKeys = [
  "tighten-project-rate-limit",
  "tighten-api-key-rate-limit",
  "tighten-model-rate-limit",
  "tighten-endpoint-rate-limit",
] as const;

export type GatewayRateLimitHotspotAutoRemediationActionKey =
  (typeof gatewayRateLimitHotspotAutoRemediationActionKeys)[number];

export type GatewayRoutePolicyRateLimitHotspotAutoRemediationProfile = {
  enabled: boolean;
  intervalMinutes: number | null;
  dryRunFirst: boolean;
  requireAlertBeforeApply: boolean;
  freezeOnProviderHealthDegrade: boolean;
  maxApplyRunsPerIncident: number | null;
  actionByCode: Partial<
    Record<GatewayRateLimitHotspotAnomalyCode, GatewayRateLimitHotspotAutoRemediationActionKey | null>
  > | null;
};

export const gatewayRoutingAnomalyAutoRemediationCodes = [
  "failure_rate_spike",
  "completion_rate_drop",
  "provider_routing_score_drop",
  "degraded_provider_route_spike",
  "saturated_provider_route_spike",
  "breaker_open_provider_route_detected",
] as const;

export type GatewayRoutingAnomalyAutoRemediationCode =
  (typeof gatewayRoutingAnomalyAutoRemediationCodes)[number];

export const gatewayRoutingAnomalyAutoRemediationActionKeys = [
  "disable-prestream-fallback",
  "reduce-provider-concurrency",
  "provider-isolation",
] as const;

export type GatewayRoutingAnomalyAutoRemediationActionKey =
  (typeof gatewayRoutingAnomalyAutoRemediationActionKeys)[number];

export type GatewayRoutePolicyRoutingAnomalyAutoRemediationProfile = {
  enabled: boolean;
  intervalMinutes: number | null;
  dryRunFirst: boolean;
  requireAlertBeforeApply: boolean;
  freezeOnProviderHealthDegrade: boolean;
  maxApplyRunsPerIncident: number | null;
  actionKeysByCode: Partial<
    Record<GatewayRoutingAnomalyAutoRemediationCode, GatewayRoutingAnomalyAutoRemediationActionKey[] | null>
  > | null;
};

export type GatewayRoutePolicyConfig = {
  stickySessions: boolean;
  preStreamFallbackEnabled: boolean;
  selectionStrategy: GatewayRouteSelectionStrategy;
  providerLoadAwareRoutingEnabled: boolean;
  maxConcurrentRequests: number | null;
  providerMaxConcurrentRequests: number | null;
  rateLimitWindowSeconds: number | null;
  rateLimitMaxRequests: number | null;
  apiKeyRateLimit: GatewayRateLimitDefinition | null;
  modelRateLimits: Record<string, GatewayRateLimitDefinition> | null;
  endpointRateLimits: Record<string, GatewayRateLimitDefinition> | null;
  circuitBreakerThreshold: number;
  circuitBreakerCooldownSeconds: number;
  allowedProviderAccountIds: string[] | null;
  allowedProtocolFamilies: GatewayProtocolFamily[] | null;
  allowedModelIds: string[] | null;
  blockedModelIds: string[] | null;
  maxRequestBodyBytes: number | null;
  streamIdleTimeoutSeconds: number | null;
  totalRequestTimeoutSeconds: number | null;
  maxStreamHeartbeatGapSeconds: number | null;
  routingAnomalyAutoRemediation: GatewayRoutePolicyRoutingAnomalyAutoRemediationProfile | null;
  rateLimitHotspotAutoRemediation: GatewayRoutePolicyRateLimitHotspotAutoRemediationProfile | null;
  fallbackHttpStatuses: number[] | null;
  fallbackErrorCodes: string[] | null;
};

export type GatewayRouteTraceCandidate = {
  providerAccountId: string;
  platformAccessId?: string | null;
  sourceAccessKeyId?: string | null;
  realCredentialRef?: string | null;
  providerLabel: string;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  sourceProfile: GatewayProviderSourceView;
  protocolBridgeStrategy?: GatewayProtocolBridgeStrategy | null;
  sameProtocolFastPathEligible?: boolean | null;
  resolvedExecutionMode: GatewayExecutionMode;
  modelAlias: string | null;
  resolvedModel: string | null;
  priority: number | null;
  weight: number | null;
  stickyPreferred: boolean;
  activeConcurrency?: number | null;
  failureCount?: number | null;
  breakerOpen?: boolean | null;
  routingScore?: number | null;
  healthWeight?: number | null;
  capacityWeight?: number | null;
  degraded?: boolean | null;
  degradationReasons?: string[] | null;
};

export type GatewayRequestRouteTrace = {
  requestedProtocolFamily: GatewayProtocolFamily | null;
  selectedUpstreamTargetProtocolFamily?: GatewayProtocolFamily | string | null;
  selectionStrategy: GatewayRouteSelectionStrategy;
  accessKeyId?: string | null;
  sourceAccessKeyId?: string | null;
  platformAccessId?: string | null;
  realCredentialRef?: string | null;
  stickyProviderAccountId: string | null;
  preStreamFallbackEnabled: boolean;
  projectConcurrencyLimit: number | null;
  providerConcurrencyLimit: number | null;
  routeAttempt: number;
  selectedPipelineMode: GatewayRelayPipelineMode | null;
  candidateQueue: GatewayRouteTraceCandidate[];
  selectedCandidate: GatewayRouteTraceCandidate;
  browserExecutionStatus?: GatewayBrowserExecutionStatus | null;
  executorNodeId?: string | null;
  executorSlotId?: string | null;
  executorLeaseId?: string | null;
  executorLeaseIssuedAt?: string | null;
  executorLeaseExpiresAt?: string | null;
  executorLeaseReleasedAt?: string | null;
  executorLeaseReleaseReason?: string | null;
  fallbackEligible: boolean | null;
  outcomeStatus: GatewayRequestStatus | null;
  upstreamStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type GatewayProviderRoutingScoreInput = {
  status: GatewayProviderAccountStatus;
  failureCount?: number | null;
  breakerOpen?: boolean | null;
  activeConcurrency?: number | null;
  providerConcurrencyLimit?: number | null;
};

export type GatewayProviderRoutingScoreView = {
  score: number;
  healthWeight: number;
  capacityWeight: number;
  degraded: boolean;
  saturated: boolean;
  degradationReasons: string[];
};

function roundGatewayProviderRoutingScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

function resolveGatewayProviderStatusWeight(status: GatewayProviderAccountStatus) {
  switch (status) {
    case "active":
      return 1;
    case "cooling":
      return 0.45;
    case "disabled":
      return 0.15;
    case "archived":
      return 0.05;
    default:
      return 0.1;
  }
}

function resolveGatewayProviderFailureWeight(failureCount: number) {
  return Math.max(0.2, 1 - Math.min(8, Math.max(0, failureCount)) * 0.1);
}

function resolveGatewayProviderCapacityWeight(activeConcurrency: number, providerConcurrencyLimit: number | null | undefined) {
  if (!providerConcurrencyLimit || providerConcurrencyLimit <= 0) {
    return 1;
  }
  const safeLimit = Math.max(1, providerConcurrencyLimit);
  const safeActive = Math.max(0, activeConcurrency);
  if (safeActive >= safeLimit) {
    return 0;
  }
  return roundGatewayProviderRoutingScore((safeLimit - safeActive) / safeLimit);
}

export function buildGatewayProviderRoutingScore(
  input: GatewayProviderRoutingScoreInput,
): GatewayProviderRoutingScoreView {
  const failureCount = Math.max(0, input.failureCount ?? 0);
  const activeConcurrency = Math.max(0, input.activeConcurrency ?? 0);
  const breakerOpen = Boolean(input.breakerOpen);
  const statusWeight = resolveGatewayProviderStatusWeight(input.status);
  const failureWeight = resolveGatewayProviderFailureWeight(failureCount);
  const healthWeight = roundGatewayProviderRoutingScore(statusWeight * failureWeight);
  const capacityWeight = resolveGatewayProviderCapacityWeight(activeConcurrency, input.providerConcurrencyLimit ?? null);
  const saturated = capacityWeight <= 0;

  if (breakerOpen) {
    return {
      score: 0,
      healthWeight: 0,
      capacityWeight,
      degraded: true,
      saturated,
      degradationReasons: ["breaker_open"],
    };
  }

  const degradationReasons: string[] = [];
  if (input.status !== "active") {
    degradationReasons.push(`status_${input.status}`);
  }
  if (failureCount >= 3) {
    degradationReasons.push("failure_count_elevated");
  }
  if (saturated) {
    degradationReasons.push("concurrency_saturated");
  } else if (capacityWeight < 0.5) {
    degradationReasons.push("concurrency_pressure");
  }

  return {
    score: roundGatewayProviderRoutingScore(healthWeight * capacityWeight),
    healthWeight,
    capacityWeight,
    degraded: degradationReasons.length > 0,
    saturated,
    degradationReasons,
  };
}

export type GatewayRequestAnalysisProfile = {
  requestMessageCount: number;
  requestTextChars: number;
  requestImageCount: number;
  requestAttachmentCount: number;
  requestToolCount: number;
  requestHistoricalToolCallCount: number;
  hasSystemPrompt: boolean;
  hasReasoning: boolean;
  hasMetadata: boolean;
  hasExplicitSessionKey: boolean;
  hasPreviousResponse: boolean;
  stream: boolean;
  responseTextChars: number | null;
  responseToolCallCount: number | null;
  firstTokenLatencyMs: number | null;
  streamChunkCount: number | null;
  requestTextSha256: string | null;
  responseTextSha256: string | null;
};

export type GatewayTenantView = {
  id: string;
  slug: string;
  displayName: string;
  status: GatewayTenantStatus;
  ownerUserId: string | null;
  sourceKind: GatewayTenantSourceKind;
  sourceKey: string;
  createdAt: string;
  updatedAt: string;
};

export type GatewayProjectView = {
  id: string;
  tenantId: string;
  slug: string;
  displayName: string;
  status: GatewayProjectStatus;
  sourceKind: GatewayProjectSourceKind;
  sourceKey: string;
  defaultRoutePolicyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayApiKeyView = {
  id: string;
  projectId: string;
  name: string;
  status: GatewayApiKeyStatus;
  issuedAt: string;
  revokedAt: string | null;
  rotatedFromApiKeyId: string | null;
};

export type GatewayProjectApiAccessView = {
  project: GatewayProjectView;
  tenant: GatewayTenantView;
  apiKey: GatewayApiKeyView;
  token: string;
};

export type GatewayBenefitProjectEnsureView = {
  tenant: GatewayTenantView;
  project: GatewayProjectView;
  routePolicy: GatewayRoutePolicyView;
};

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

export type GatewayPlatformAccessView = {
  id: string;
  providerCapabilityId: string;
  providerAccountId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel: string | null;
  platformTier: GatewayPlatformTier;
  status: string;
  operatorWeight: number;
  routingPriority: number;
  enabledForSale: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAccessBundleView = {
  id: string;
  projectId: string | null;
  slug: string;
  displayName: string;
  billingMode: GatewayAccessBundleBillingMode | string;
  status: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAccessBundleItemView = {
  bundleId: string;
  platformAccessId: string;
  createdAt: string;
};

export type GatewayAccessKeyView = {
  id: string;
  ownerType: GatewayAccessKeyOwnerType;
  ownerId: string;
  resolvedProjectId: string;
  resolvedTenantId: string;
  keyKind: GatewayAccessKeyKind;
  status: GatewayAccessKeyStatus | string;
  publicKeyPrefix: string;
  displayName: string;
  token: string | null;
  externalKey: string | null;
  rotatedFromAccessKeyId: string | null;
  legacyGatewayApiKeyId: string | null;
  legacyUserCredentialId: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  metadata: Record<string, unknown> | null;
  revokedAt: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAccessKeyBalanceView = {
  accessKeyId: string;
  balanceMode: GatewayAccessBalanceMode | string;
  status: string;
  unlimitedUntil: string | null;
  periodStartsAt: string | null;
  periodEndsAt: string | null;
  totalTokens: number | null;
  remainingTokens: number | null;
  totalMessages: number | null;
  remainingMessages: number | null;
  updatedAt: string;
};

export type GatewayAccessKeyBundleBindingView = {
  accessKeyId: string;
  bundleId: string;
  createdAt: string;
};

export type GatewayAccessKeyAggregateMembershipView = {
  aggregateAccessKeyId: string;
  memberAccessKeyId: string;
  priority: number;
  createdAt: string;
};

export type GatewayAccessCatalogView = {
  providerCapabilities: GatewayProviderCapabilityView[];
  platformAccessRows: GatewayPlatformAccessView[];
  bundles: GatewayAccessBundleView[];
  bundleItems: GatewayAccessBundleItemView[];
  accessKeys: GatewayAccessKeyView[];
  keyBundleBindings: GatewayAccessKeyBundleBindingView[];
  balances: GatewayAccessKeyBalanceView[];
  aggregateMemberships: GatewayAccessKeyAggregateMembershipView[];
};

export type GatewayOperatorCatalogView = {
  tenants: GatewayTenantView[];
  projects: GatewayProjectView[];
  apiKeys: GatewayApiKeyView[];
  providerAccounts: GatewayProviderAccountView[];
  modelAliases: GatewayModelAliasView[];
  routePolicies: GatewayRoutePolicyView[];
};

export const gatewayBrowserExecutorNodeStatuses = ["active", "degraded", "draining", "offline"] as const;

export type GatewayBrowserExecutorNodeStatus = (typeof gatewayBrowserExecutorNodeStatuses)[number];

export const gatewayBrowserCapabilitySlotStatuses = [
  "warming",
  "warm",
  "hot",
  "busy",
  "cooling",
  "expired",
  "dead",
] as const;

export type GatewayBrowserCapabilitySlotStatus = (typeof gatewayBrowserCapabilitySlotStatuses)[number];

export const gatewayBrowserExecutionStatuses = [
  "leased",
  "completed",
  "released",
  "challenge",
  "timed_out",
  "crashed",
] as const;

export type GatewayBrowserExecutionStatus = (typeof gatewayBrowserExecutionStatuses)[number];

export type GatewayBrowserExecutorNodeView = {
  nodeId: string;
  status: GatewayBrowserExecutorNodeStatus;
  capabilities: string[];
  lastHeartbeatAt: string;
  version: string | null;
  host: string | null;
};

export type GatewayBrowserCapabilitySlotView = {
  slotId: string;
  nodeId: string;
  providerAccountId: string;
  adapter: GatewayProviderAdapter | string;
  endpointKind: GatewayRelayEndpointKind | string;
  executionMode: GatewayExecutionMode;
  status: GatewayBrowserCapabilitySlotStatus;
  runtimeStateObjectKey: string | null;
  accountName: string | null;
  lastWarmAt: string | null;
  lastUsedAt: string | null;
  lastFailureAt: string | null;
  degradationReasons: string[] | null;
  updatedAt: string;
};

export type GatewayBrowserCapabilityLeaseView = {
  leaseId: string;
  slotId: string;
  nodeId: string;
  providerAccountId: string;
  requestAuditId: string | null;
  projectId: string | null;
  endpointKind: GatewayRelayEndpointKind | string;
  executionMode: GatewayExecutionMode;
  issuedAt: string;
  expiresAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
};

export type GatewayBrowserExecutorNodeHealthView = {
  nodeId: string;
  totalSlots: number;
  warmSlots: number;
  busySlots: number;
  coolingSlots: number;
  degradedSlots: number;
  challengeOpenSlots: number;
  lastErrorSummary: string | null;
  updatedAt: string;
};

export type GatewayBrowserExecutorProviderHealthView = {
  providerAccountId: string;
  totalSlots: number;
  warmSlots: number;
  busySlots: number;
  coolingSlots: number;
  degradedSlots: number;
  challengeOpenSlots: number;
  lastErrorSummary: string | null;
  updatedAt: string;
};

export type GatewayBrowserExecutorHealthView = {
  generatedAt: string;
  totalNodes: number;
  totalSlots: number;
  totalWarmSlots: number;
  totalBusySlots: number;
  totalCoolingSlots: number;
  totalDegradedSlots: number;
  totalChallengeOpenSlots: number;
  nodes: GatewayBrowserExecutorNodeHealthView[];
  providers: GatewayBrowserExecutorProviderHealthView[];
};

export type GatewayModelAliasView = {
  id: string;
  projectId: string | null;
  scopeType: GatewayModelAliasScopeType;
  alias: string;
  providerAccountId: string;
  upstreamModel: string | null;
  priority: number;
  weight: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GatewayModelAliasScopeType = "global" | "provider_special";

export type GatewayRoutePolicyView = {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  enabled: boolean;
  config: GatewayRoutePolicyConfig;
  createdAt: string;
  updatedAt: string;
};

export type GatewaySessionView = {
  id: string;
  projectId: string;
  sessionKey: string;
  protocolFamily: GatewayProtocolFamily;
  providerAccountId: string;
  latestResponseId: string | null;
  upstreamSessionId: string | null;
  runtimeStateObjectKey: string | null;
  activeRequestAuditId: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
};

export type GatewayRequestAuditView = {
  id: string;
  projectId: string;
  accessKeyId: string | null;
  sourceAccessKeyId: string | null;
  apiKeyId: string | null;
  userCredentialId: string | null;
  sessionId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  modelAlias: string | null;
  stream: boolean;
  status: GatewayRequestStatus;
  upstreamStatus: number | null;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  clientHasCacheControl: boolean;
  autoCacheApplied: boolean;
  errorSummary: string | null;
  routeTrace: GatewayRequestRouteTrace | null;
  analysisProfile: GatewayRequestAnalysisProfile | null;
  requestArtifactObjectKey: string | null;
  responseArtifactObjectKey: string | null;
  responseId: string;
  previousResponseId: string | null;
  clientDisconnectedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type GatewayStoredRequestArtifact = {
  schemaVersion: 1;
  kind: "request";
  requestAuditId: string;
  projectId: string;
  sessionId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  previousResponseId: string | null;
  explicitSessionKey: string | null;
  analysisProfile: GatewayRequestAnalysisProfile;
  capturedAt: string;
  canonicalRequest: {
    protocolFamily: GatewayProtocolFamily | "openai" | "anthropic";
    endpointKind: string;
    requestedModel: string | null;
    stream: boolean;
    messages: unknown[];
    tools: unknown[];
    toolChoice: unknown;
    reasoning: unknown;
    metadata: Record<string, unknown> | null;
    attachments: unknown[];
    previousResponseId: string | null;
    explicitSessionKey: string | null;
  };
  rawBody: Record<string, unknown>;
};

export type GatewayStoredResponseArtifact = {
  schemaVersion: 1;
  kind: "response";
  requestAuditId: string;
  responseId: string;
  providerAccountId: string | null;
  resolvedModel: string | null;
  upstreamStatus: number | null;
  status: GatewayRequestStatus;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    cacheCreationInputTokens: number | null;
    cacheReadInputTokens: number | null;
  } | null;
  result: {
    text: string;
    toolCalls: unknown[];
    upstreamSessionId: string | null;
    runtimeStateObjectKey: string | null;
  };
  analysisProfile: GatewayRequestAnalysisProfile;
  routeTrace: GatewayRequestRouteTrace | null;
  capturedAt: string;
};

export type GatewayRequestArtifactsView = {
  requestAudit: GatewayRequestAuditView;
  requestArtifact: GatewayStoredRequestArtifact | null;
  responseArtifact: GatewayStoredResponseArtifact | null;
};

export type GatewayConversationArchiveStatus =
  | "completed"
  | "failed"
  | "partial"
  | "archive_failed";

export type GatewayProviderFailureClass =
  | "credential_invalid"
  | "credential_expired"
  | "quota_exhausted"
  | "rate_limited"
  | "model_unsupported"
  | "content_rejected"
  | "gateway_protocol_error"
  | "client_request_invalid"
  | "provider_transient"
  | "unknown";

export type GatewayProviderFailureScope =
  | "credential"
  | "credential_model"
  | "provider"
  | "implementation_line"
  | "client_request"
  | "unknown";

export type GatewayConversationArchiveView = {
  id: string;
  requestAuditId: string | null;
  requestId: string;
  projectId: string | null;
  userId: string | null;
  sessionId: string | null;
  providerAccountId: string | null;
  providerCredentialRef: string | null;
  protocolFamily: GatewayProtocolFamily | string;
  protocolProfile: string | null;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  status: GatewayConversationArchiveStatus | string;
  upstreamStatus: number | null;
  failureClass: GatewayProviderFailureClass | string | null;
  failureScope: GatewayProviderFailureScope | string | null;
  requestObjectKey: string | null;
  responseObjectKey: string | null;
  redactionVersion: string;
  truncatedRequest: boolean;
  truncatedResponse: boolean;
  archiveError: string | null;
  retentionExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayConversationArchiveArtifactsView = {
  archive: GatewayConversationArchiveView;
  artifacts: {
    requestArtifact: unknown | null;
    responseArtifact: unknown | null;
  };
};

export type GatewayConversationArchiveExportView = {
  exportId: string;
  datasetObjectKey: string;
  rowCount: number;
  createdAt: string;
};

export type GatewayProviderCredentialModelHealthStatus =
  | "active"
  | "degraded"
  | "cooling"
  | "blocked";

export type GatewayProviderCredentialModelStateView = {
  id: string;
  providerAccountId: string;
  providerCredentialId: string | null;
  providerCredentialRef: string | null;
  protocolProfile: string | null;
  model: string;
  status: GatewayProviderCredentialModelHealthStatus | string;
  failureClass: GatewayProviderFailureClass | string | null;
  failureScope: GatewayProviderFailureScope | string | null;
  failureCount: number;
  lastError: string | null;
  lastUpstreamStatus: number | null;
  cooldownUntil: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayUsageAggregateBucketView = {
  bucketStart: string;
  bucketGranularity: string;
  projectId: string;
  userId: string;
  provider: string;
  providerCredentialRef: string;
  model: string;
  requestCount: number;
  failureCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  latencyMsSum: number;
  createdAt: string;
  updatedAt: string;
};

export type GatewayUsageAggregateAlertView = {
  severity: "info" | "warning" | "critical" | string;
  code: string;
  message: string;
};

export type GatewayUsageAggregateSummaryView = {
  queueDepth: number;
  recentRequestCount: number;
  recentFailureCount: number;
  recentTotalTokens: number;
  archiveFailureCount: number;
  alerts: GatewayUsageAggregateAlertView[];
};

export type GatewayConversationDatasetExportStatus =
  | "review_pending"
  | "approved"
  | "rejected"
  | "published";

export type GatewayConversationDatasetExportView = {
  id: string;
  status: GatewayConversationDatasetExportStatus | string;
  filter: unknown;
  sampleSize: number | null;
  rowCount: number;
  datasetObjectKey: string;
  manifestObjectKey: string;
  createdBy: string | null;
  reviewerId: string | null;
  approvalNote: string | null;
  rejectedReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAnalysisMetricDistributionView = {
  avg: number | null;
  p50: number | null;
  p95: number | null;
};

export type GatewayAnalysisSampleView = {
  requestAuditId: string;
  responseId: string;
  projectId: string;
  routePolicyId?: string | null;
  sessionId: string | null;
  providerAccountId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  status: GatewayRequestStatus;
  stream: boolean;
  createdAt: string;
  completedAt: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  analysisProfile: GatewayRequestAnalysisProfile | null;
  requestArtifactObjectKey: string | null;
  responseArtifactObjectKey: string | null;
  routeTrace: GatewayRequestRouteTrace | null;
};

export type GatewayAnalysisSummaryView = {
  totalSamples: number;
  completedSamples: number;
  failedSamples: number;
  cancelledSamples: number;
  streamSamples: number;
  toolRequestSamples: number;
  toolResponseSamples: number;
  systemPromptSamples: number;
  reasoningSamples: number;
  metadataSamples: number;
  explicitSessionSamples: number;
  previousResponseSamples: number;
  requestArtifactSamples: number;
  responseArtifactSamples: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCacheCreationInputTokens: number;
  totalCacheReadInputTokens: number;
  requestTextChars: GatewayAnalysisMetricDistributionView;
  responseTextChars: GatewayAnalysisMetricDistributionView;
  firstTokenLatencyMs: GatewayAnalysisMetricDistributionView;
  streamChunkCount: GatewayAnalysisMetricDistributionView;
  byProtocolFamily: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
  byResolvedModel: GatewaySummaryBucket[];
  byProviderAccount: GatewaySummaryBucket[];
  byStatus: GatewaySummaryBucket[];
};

export type GatewayPromptCacheMetricsView = {
  hitRequests: number;
  creationRequests: number;
  clientMarkedRequests: number;
  autoAppliedRequests: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

export type GatewayPromptCacheSummaryView = {
  totalRequests: number;
  cacheHitRequests: number;
  cacheCreationRequests: number;
  clientMarkedRequests: number;
  autoAppliedRequests: number;
  cacheControlCoverageRequests: number;
  totalTokensSaved: number;
  totalCacheCreationInputTokens: number;
  estimatedCostSavedUsd: number;
  cacheHitRate: number;
  cacheControlCoverageRate: number;
  inputPricePerMillion: number;
  cachedInputPricePerMillion: number;
};

export type GatewayPromptCacheTrendPointView = {
  bucketStart: string;
  totalRequests: number;
  cacheHitRequests: number;
  cacheCreationRequests: number;
  clientMarkedRequests: number;
  autoAppliedRequests: number;
  cacheControlCoverageRequests: number;
  totalTokensSaved: number;
  totalCacheCreationInputTokens: number;
  estimatedCostSavedUsd: number;
  cacheHitRate: number;
  cacheControlCoverageRate: number;
};

export type GatewayPromptCacheTrendReportView = {
  bucketSize: string;
  summary: GatewayPromptCacheSummaryView;
  points: GatewayPromptCacheTrendPointView[];
};

export const gatewayAnalysisExportTextModes = ["none", "preview_redacted", "full"] as const;

export type GatewayAnalysisExportTextMode = (typeof gatewayAnalysisExportTextModes)[number];

export type GatewayAnalysisExportMessageView = {
  role: "system" | "user" | "assistant" | "tool";
  name: string | null;
  toolCallId: string | null;
  text: string;
  toolCallCount: number;
};

export type GatewayAnalysisExportRowView = {
  requestAuditId: string;
  responseId: string;
  projectId: string;
  sessionId: string | null;
  providerAccountId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  status: GatewayRequestStatus;
  stream: boolean;
  createdAt: string;
  completedAt: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  requestArtifactAvailable: boolean;
  responseArtifactAvailable: boolean;
  analysisProfile: GatewayRequestAnalysisProfile | null;
  routeTrace: GatewayRequestRouteTrace | null;
  requestText: string | null;
  responseText: string | null;
  requestTextTruncated: boolean;
  responseTextTruncated: boolean;
  requestMessages: GatewayAnalysisExportMessageView[];
  requestToolNames: string[];
  responseToolNames: string[];
};

export type GatewayAnalysisExportView = {
  textMode: GatewayAnalysisExportTextMode;
  maxTextChars: number;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  rows: GatewayAnalysisExportRowView[];
};

export type GatewayAnalysisExportFileView = {
  kind: "manifest" | "dataset_jsonl";
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  lineCount: number | null;
};

export const gatewayAnalysisExportStatuses = ["active", "deleted"] as const;

export type GatewayAnalysisExportStatus = (typeof gatewayAnalysisExportStatuses)[number];

export type GatewayAnalysisExportFilterView = {
  projectId: string | null;
  routePolicyId?: string | null;
  providerAccountId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  responseId: string | null;
  protocolFamily: GatewayProtocolFamily | null;
  status: GatewayRequestStatus | null;
  endpointKind: string | null;
  stream: boolean | null;
  errorCode: string | null;
  fallbackEligible: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
  artifactAvailable: boolean | null;
  limit: number;
  textMode: GatewayAnalysisExportTextMode;
  maxTextChars: number;
};

export type GatewayAnalysisExportManifest = {
  schemaVersion: 1;
  exportId: string;
  label: string | null;
  tags?: string[];
  createdAt: string;
  retentionExpiresAt?: string | null;
  filters: GatewayAnalysisExportFilterView;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  files: GatewayAnalysisExportFileView[];
};

export type GatewayPersistedAnalysisExportView = {
  exportId: string;
  label: string | null;
  tags: string[];
  status: GatewayAnalysisExportStatus;
  createdAt: string;
  updatedAt: string;
  objectPrefix: string;
  filters: GatewayAnalysisExportFilterView;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  retentionExpiresAt: string | null;
  cleanedUpAt: string | null;
  lastCleanupError: string | null;
  files: GatewayAnalysisExportFileView[];
  manifest: GatewayAnalysisExportManifest;
};

export type GatewayAnalysisExportMetadataUpdateInput = {
  label?: string | null;
  tags?: string[] | null;
  retentionExpiresAt?: string | null;
};

export type GatewayAnalysisExportCleanupEntryView = {
  exportId: string;
  status: "deleted" | "failed";
  deletedObjectCount: number;
  errorMessage: string | null;
};

export type GatewayAnalysisExportCleanupResult = {
  scannedCount: number;
  deletedCount: number;
  failedCount: number;
  results: GatewayAnalysisExportCleanupEntryView[];
};

export type GatewayAnalysisExportInventorySummaryView = {
  totalExports: number;
  activeExports: number;
  deletedExports: number;
  pinnedExports: number;
  expiringWithin24Hours: number;
  expiredActiveExports: number;
  totalSampleCount: number;
  totalRequestArtifactCount: number;
  totalResponseArtifactCount: number;
  byStatus: GatewaySummaryBucket[];
  byTextMode: GatewaySummaryBucket[];
  byTag: GatewaySummaryBucket[];
  byProject: GatewaySummaryBucket[];
};

export type GatewayAnalysisExportBucketDeltaView = {
  key: string;
  leftCount: number;
  rightCount: number;
  deltaCount: number;
};

export type GatewayAnalysisExportMetricDeltaView = {
  leftValue: number | null;
  rightValue: number | null;
  deltaValue: number | null;
};

export type GatewayAnalysisExportDiffView = {
  leftExport: GatewayPersistedAnalysisExportView;
  rightExport: GatewayPersistedAnalysisExportView;
  overlapRequestCount: number;
  leftOnlyRequestCount: number;
  rightOnlyRequestCount: number;
  sampleCount: GatewayAnalysisExportMetricDeltaView;
  requestArtifactCount: GatewayAnalysisExportMetricDeltaView;
  responseArtifactCount: GatewayAnalysisExportMetricDeltaView;
  promptTokens: GatewayAnalysisExportMetricDeltaView;
  completionTokens: GatewayAnalysisExportMetricDeltaView;
  totalTokens: GatewayAnalysisExportMetricDeltaView;
  byStatus: GatewayAnalysisExportBucketDeltaView[];
  byProtocolFamily: GatewayAnalysisExportBucketDeltaView[];
  byEndpointKind: GatewayAnalysisExportBucketDeltaView[];
  byResolvedModel: GatewayAnalysisExportBucketDeltaView[];
  byProviderAccount: GatewayAnalysisExportBucketDeltaView[];
};

export type GatewayAnalysisExportBaselineReportFilterView = {
  label: string | null;
  tag: string | null;
  projectId: string | null;
  status: GatewayAnalysisExportStatus | null;
  textMode: GatewayAnalysisExportTextMode | null;
  createdFrom: string | null;
  createdTo: string | null;
};

export type GatewayAnalysisExportBaselineReportView = {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  matchedExportsCount: number;
  latestExport: GatewayPersistedAnalysisExportView | null;
  previousExport: GatewayPersistedAnalysisExportView | null;
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  diff: GatewayAnalysisExportDiffView | null;
};

export type GatewayAnalysisExportTimelinePairView = {
  newerExport: GatewayPersistedAnalysisExportView;
  olderExport: GatewayPersistedAnalysisExportView;
  diff: GatewayAnalysisExportDiffView | null;
  diffUnavailableReason: string | null;
};

export type GatewayAnalysisExportTimelineReportView = {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  matchedExportsCount: number;
  windowSize: number;
  exports: GatewayPersistedAnalysisExportView[];
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  pairComparisons: GatewayAnalysisExportTimelinePairView[];
};

export type GatewayAnalysisExportTrendPointView = {
  export: GatewayPersistedAnalysisExportView;
  datasetAvailable: boolean;
  datasetUnavailableReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  streamSamples: number | null;
  completedSamples: number | null;
  failedSamples: number | null;
  cancelledSamples: number | null;
  toolRequestSamples: number | null;
  toolResponseSamples: number | null;
  systemPromptSamples: number | null;
  reasoningSamples: number | null;
  metadataSamples: number | null;
  explicitSessionSamples: number | null;
  previousResponseSamples: number | null;
};

export type GatewayAnalysisExportTrendMetricSummaryView = {
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
};

export type GatewayAnalysisExportTrendSummaryView = {
  latestExportId: string | null;
  previousExportId: string | null;
  promptTokensPerSample: GatewayAnalysisExportTrendMetricSummaryView;
  completionTokensPerSample: GatewayAnalysisExportTrendMetricSummaryView;
  totalTokensPerSample: GatewayAnalysisExportTrendMetricSummaryView;
  requestArtifactCoverage: GatewayAnalysisExportTrendMetricSummaryView;
  responseArtifactCoverage: GatewayAnalysisExportTrendMetricSummaryView;
  streamRate: GatewayAnalysisExportTrendMetricSummaryView;
  completionRate: GatewayAnalysisExportTrendMetricSummaryView;
  failureRate: GatewayAnalysisExportTrendMetricSummaryView;
  cancellationRate: GatewayAnalysisExportTrendMetricSummaryView;
  toolRequestRate: GatewayAnalysisExportTrendMetricSummaryView;
  toolResponseRate: GatewayAnalysisExportTrendMetricSummaryView;
  reasoningRate: GatewayAnalysisExportTrendMetricSummaryView;
  metadataRate: GatewayAnalysisExportTrendMetricSummaryView;
  explicitSessionRate: GatewayAnalysisExportTrendMetricSummaryView;
  previousResponseRate: GatewayAnalysisExportTrendMetricSummaryView;
};

export type GatewayAnalysisExportTrendReportView = {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  matchedExportsCount: number;
  windowSize: number;
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  points: GatewayAnalysisExportTrendPointView[];
  summary: GatewayAnalysisExportTrendSummaryView | null;
};

export type GatewayAnalysisExportAnomalySeverity = "warning" | "critical";
export const gatewayAnalysisAnomalyProfileKeys = ["conservative", "balanced", "aggressive"] as const;
export type GatewayAnalysisExportAnomalyProfileKey = (typeof gatewayAnalysisAnomalyProfileKeys)[number];

export type GatewayAnalysisExportAnomalyCode =
  | "latest_dataset_missing"
  | "failure_rate_spike"
  | "completion_rate_drop"
  | "response_artifact_coverage_drop"
  | "request_artifact_coverage_drop"
  | "tokens_per_sample_spike";

export type GatewayAnalysisAnomalyIncidentCode =
  | GatewayAnalysisExportAnomalyCode
  | GatewayRateLimitHotspotAnomalyCode
  | GatewayProviderRoutingAnalysisAnomalyCode;

export type GatewayAnalysisExportAnomalyView = {
  code: GatewayAnalysisExportAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  latestExportId: string | null;
  previousExportId: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number | null;
};

export type GatewayAnalysisExportAnomalyThresholdConfig = {
  failureRateWarningThreshold: number;
  failureRateCriticalThreshold: number;
  failureRateDeltaRatioThreshold: number;
  completionRateWarningThreshold: number;
  completionRateCriticalThreshold: number;
  completionRateDeltaValueThreshold: number;
  responseArtifactCoverageWarningThreshold: number;
  responseArtifactCoverageCriticalThreshold: number;
  responseArtifactCoverageDeltaValueThreshold: number;
  requestArtifactCoverageWarningThreshold: number;
  requestArtifactCoverageCriticalThreshold: number;
  requestArtifactCoverageDeltaValueThreshold: number;
  tokensPerSampleWarningDeltaRatioThreshold: number;
  tokensPerSampleCriticalDeltaRatioThreshold: number;
  tokensPerSampleCriticalAbsoluteThreshold: number;
};

export type GatewayAnalysisExportAnomalyReportView = {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayAnalysisExportAnomalyThresholdConfig;
  latestExport: GatewayPersistedAnalysisExportView | null;
  previousExport: GatewayPersistedAnalysisExportView | null;
  trendSummary: GatewayAnalysisExportTrendSummaryView | null;
  anomalies: GatewayAnalysisExportAnomalyView[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
};

export const gatewayAnalysisAnomalyPolicyStatuses = ["enabled", "disabled"] as const;
export type GatewayAnalysisAnomalyPolicyStatus = (typeof gatewayAnalysisAnomalyPolicyStatuses)[number];
export const gatewayAnalysisAnomalyPolicySyncStatuses = ["ok", "error"] as const;
export type GatewayAnalysisAnomalyPolicySyncStatus = (typeof gatewayAnalysisAnomalyPolicySyncStatuses)[number];

export type GatewayAnalysisAnomalyPolicyView = {
  id: string;
  name: string;
  status: GatewayAnalysisAnomalyPolicyStatus;
  projectId: string | null;
  routePolicyId: string | null;
  tag: string | null;
  textMode: GatewayAnalysisExportTextMode | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayAnalysisExportAnomalyThresholdConfig;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number | null;
  lastSyncedAt: string | null;
  lastSyncStatus: GatewayAnalysisAnomalyPolicySyncStatus | null;
  lastSyncError: string | null;
  nextSyncDueAt: string | null;
  syncDue: boolean;
  autoEscalateEnabled: boolean;
  escalateSeverityThreshold: GatewayAnalysisExportAnomalySeverity | null;
  escalateAfterSyncCount: number | null;
  autoEscalateOwnerUserId: string | null;
  autoEscalateFollowUpStatus: GatewayAnalysisAnomalyIncidentFollowUpStatus | null;
  autoRemediationEnabled: boolean;
  autoRemediationIntervalMinutes: number | null;
  autoRemediationDryRunFirst: boolean;
  autoRemediationActionKeys: string[] | null;
  autoRemediationMaxApplyRunsPerIncident: number | null;
  autoRemediationRequireAlertBeforeApply: boolean;
  autoRemediationFreezeOnProviderHealthDegrade: boolean;
  alertingEnabled: boolean;
  alertIntervalMinutes: number | null;
  notifyOperatorsOnEscalation: boolean;
  notifyOwnerOnEscalation: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertGatewayAnalysisAnomalyPolicyInput = {
  id?: string | null;
  name: string;
  status?: GatewayAnalysisAnomalyPolicyStatus | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  tag?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  profileKey?: GatewayAnalysisExportAnomalyProfileKey | null;
  thresholds?: Partial<GatewayAnalysisExportAnomalyThresholdConfig> | null;
  autoSyncEnabled?: boolean | null;
  autoSyncIntervalMinutes?: number | null;
  autoEscalateEnabled?: boolean | null;
  escalateSeverityThreshold?: GatewayAnalysisExportAnomalySeverity | null;
  escalateAfterSyncCount?: number | null;
  autoEscalateOwnerUserId?: string | null;
  autoEscalateFollowUpStatus?: GatewayAnalysisAnomalyIncidentFollowUpStatus | null;
  autoRemediationEnabled?: boolean | null;
  autoRemediationIntervalMinutes?: number | null;
  autoRemediationDryRunFirst?: boolean | null;
  autoRemediationActionKeys?: string[] | null;
  autoRemediationMaxApplyRunsPerIncident?: number | null;
  autoRemediationRequireAlertBeforeApply?: boolean | null;
  autoRemediationFreezeOnProviderHealthDegrade?: boolean | null;
  alertingEnabled?: boolean | null;
  alertIntervalMinutes?: number | null;
  notifyOperatorsOnEscalation?: boolean | null;
  notifyOwnerOnEscalation?: boolean | null;
};

export type GatewayAnalysisAnomalyPolicySummaryView = {
  totalPolicies: number;
  enabledPolicies: number;
  disabledPolicies: number;
  autoSyncEnabledPolicies: number;
  autoEscalateEnabledPolicies: number;
  autoRemediationEnabledPolicies: number;
  alertingEnabledPolicies: number;
  duePolicies: number;
  byStatus: GatewaySummaryBucket[];
  bySyncStatus: GatewaySummaryBucket[];
};

export const gatewayAnalysisAnomalyPolicySweepStatuses = ["ok", "error", "skipped"] as const;
export type GatewayAnalysisAnomalyPolicySweepStatus = (typeof gatewayAnalysisAnomalyPolicySweepStatuses)[number];

export type GatewayAnalysisAnomalyPolicySweepItemView = {
  policyId: string;
  policyName: string;
  status: GatewayAnalysisAnomalyPolicySweepStatus;
  error: string | null;
  lastSyncedAt: string | null;
  nextSyncDueAt: string | null;
  syncDue: boolean;
  anomalyCount: number;
  openedIncidentCount: number;
  updatedIncidentCount: number;
  resolvedIncidentCount: number;
};

export type GatewayAnalysisAnomalyPolicySweepView = {
  startedAt: string;
  completedAt: string;
  limit: number;
  attemptedCount: number;
  okCount: number;
  errorCount: number;
  skippedCount: number;
  items: GatewayAnalysisAnomalyPolicySweepItemView[];
};

export const gatewayAnalysisAnomalyIncidentStatuses = ["open", "acknowledged", "resolved"] as const;
export type GatewayAnalysisAnomalyIncidentStatus = (typeof gatewayAnalysisAnomalyIncidentStatuses)[number];

export const gatewayAnalysisAnomalyIncidentFollowUpStatuses = ["pending", "investigating", "monitoring", "done"] as const;
export type GatewayAnalysisAnomalyIncidentFollowUpStatus =
  (typeof gatewayAnalysisAnomalyIncidentFollowUpStatuses)[number];

export const gatewayAnalysisAnomalyIncidentEscalationStatuses = ["none", "escalated", "resolved"] as const;
export type GatewayAnalysisAnomalyIncidentEscalationStatus =
  (typeof gatewayAnalysisAnomalyIncidentEscalationStatuses)[number];

export const gatewayAnalysisAnomalyAlertDeliverySeverities = ["info", "warning", "danger"] as const;
export type GatewayAnalysisAnomalyAlertDeliverySeverity =
  (typeof gatewayAnalysisAnomalyAlertDeliverySeverities)[number];

export type GatewayAnalysisAnomalyIncidentView = {
  id: string;
  policyId: string | null;
  fingerprint: string;
  projectId: string | null;
  routePolicyId: string | null;
  tag: string | null;
  textMode: GatewayAnalysisExportTextMode | null;
  code: GatewayAnalysisAnomalyIncidentCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  status: GatewayAnalysisAnomalyIncidentStatus;
  ownerUserId: string | null;
  followUpStatus: GatewayAnalysisAnomalyIncidentFollowUpStatus;
  syncHitCount: number;
  escalationStatus: GatewayAnalysisAnomalyIncidentEscalationStatus;
  escalatedAt: string | null;
  escalationReason: string | null;
  latestNote: string | null;
  resolutionNote: string | null;
  lastActionAt: string | null;
  lastAlertAttemptAt: string | null;
  lastAlertedAt: string | null;
  lastAlertSeverity: GatewayAnalysisAnomalyAlertDeliverySeverity | null;
  alertDeliveryCount: number;
  summary: string;
  latestExportId: string | null;
  previousExportId: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayAnalysisAnomalyIncidentSummaryView = {
  totalIncidents: number;
  openIncidents: number;
  acknowledgedIncidents: number;
  resolvedIncidents: number;
  escalatedIncidents: number;
  byStatus: GatewaySummaryBucket[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
  byFollowUpStatus: GatewaySummaryBucket[];
  byEscalationStatus: GatewaySummaryBucket[];
};

export type GatewaySyncAnalysisAnomalyIncidentsResult = {
  report: GatewayAnalysisExportAnomalyReportView;
  incidents: GatewayAnalysisAnomalyIncidentView[];
  openedIncidentIds: string[];
  updatedIncidentIds: string[];
  resolvedIncidentIds: string[];
};

export type GatewaySyncRateLimitHotspotAnomalyIncidentsResult = {
  snapshot: GatewayRateLimitHotspotAnomalySnapshotView;
  incidents: GatewayAnalysisAnomalyIncidentView[];
  openedIncidentIds: string[];
  updatedIncidentIds: string[];
  resolvedIncidentIds: string[];
};

export type GatewaySyncProviderRoutingAnalysisAnomalyIncidentsResult = {
  report: GatewayProviderRoutingAnalysisAnomalyReportView;
  incidents: GatewayAnalysisAnomalyIncidentView[];
  openedIncidentIds: string[];
  updatedIncidentIds: string[];
  resolvedIncidentIds: string[];
};

export type GatewayAnalysisAnomalyIncidentFollowUpInput = {
  ownerUserId?: string | null;
  followUpStatus?: GatewayAnalysisAnomalyIncidentFollowUpStatus | null;
  note?: string | null;
  resolutionNote?: string | null;
};

export const gatewayAnalysisAnomalyIncidentHistoryEventTypes = [
  "sync_opened",
  "sync_updated",
  "sync_resolved",
  "auto_escalated",
  "escalation_cleared",
  "alert_dispatched",
  "remediation_dry_run",
  "remediation_applied",
  "remediation_failed",
  "remediation_impact_captured",
  "acknowledged",
  "resolved",
  "follow_up_updated",
] as const;
export type GatewayAnalysisAnomalyIncidentHistoryEventType =
  (typeof gatewayAnalysisAnomalyIncidentHistoryEventTypes)[number];

export type GatewayAnalysisAnomalyIncidentHistoryView = {
  id: string;
  incidentId: string;
  eventType: GatewayAnalysisAnomalyIncidentHistoryEventType;
  actorUserId: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export const gatewayAnalysisAnomalyRemediationPriorities = ["high", "medium", "low"] as const;
export type GatewayAnalysisAnomalyRemediationPriority =
  (typeof gatewayAnalysisAnomalyRemediationPriorities)[number];

export const gatewayAnalysisAnomalyRemediationCategories = [
  "routing",
  "provider",
  "retention",
  "prompt",
  "session",
  "manual",
] as const;
export type GatewayAnalysisAnomalyRemediationCategory =
  (typeof gatewayAnalysisAnomalyRemediationCategories)[number];

export const gatewayAnalysisAnomalyRemediationExecutionModes = [
  "informational",
  "incident_follow_up",
  "route_policy_patch",
] as const;
export type GatewayAnalysisAnomalyRemediationExecutionMode =
  (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number];

export const gatewayAnalysisAnomalyRemediationRunStatuses = ["dry_run", "applied", "failed"] as const;
export type GatewayAnalysisAnomalyRemediationRunStatus =
  (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number];

export type GatewayAnalysisAnomalyIncidentRemediationRoutePolicyPatchInput = {
  providerMaxConcurrentRequests?: number | null;
  preStreamFallbackEnabled?: boolean | null;
  allowedProviderAccountIds?: string[] | null;
  projectRateLimit?: GatewayRateLimitDefinition | null;
  apiKeyRateLimit?: GatewayRateLimitDefinition | null;
  modelRateLimitKey?: string | null;
  modelRateLimit?: GatewayRateLimitDefinition | null;
  endpointRateLimitKey?: string | null;
  endpointRateLimit?: GatewayRateLimitDefinition | null;
};

export type ExecuteGatewayAnalysisAnomalyIncidentRemediationInput = {
  actionKey: string;
  dryRun?: boolean | null;
  note?: string | null;
  incidentFollowUp?: GatewayAnalysisAnomalyIncidentFollowUpInput | null;
  routePolicyPatch?: GatewayAnalysisAnomalyIncidentRemediationRoutePolicyPatchInput | null;
};

export type GatewayAnalysisAnomalyIncidentRemediationActionView = {
  actionKey: string;
  title: string;
  description: string;
  category: GatewayAnalysisAnomalyRemediationCategory;
  priority: GatewayAnalysisAnomalyRemediationPriority;
  routePolicyId: string | null;
  executable: boolean;
  executionMode: GatewayAnalysisAnomalyRemediationExecutionMode;
  defaultExecutionInput: Record<string, unknown> | null;
  recommendedChanges: Record<string, unknown> | null;
};

export type GatewayAnalysisAnomalyIncidentRemediationPlanView = {
  generatedAt: string;
  incident: GatewayAnalysisAnomalyIncidentView;
  policy: GatewayAnalysisAnomalyPolicyView | null;
  routePolicy: GatewayRoutePolicyView | null;
  overview: string;
  actions: GatewayAnalysisAnomalyIncidentRemediationActionView[];
};

export type GatewayAnalysisAnomalyIncidentRemediationRunView = {
  id: string;
  incidentId: string;
  policyId: string | null;
  routePolicyId: string | null;
  actionKey: string;
  title: string;
  executionMode: GatewayAnalysisAnomalyRemediationExecutionMode;
  status: GatewayAnalysisAnomalyRemediationRunStatus;
  dryRun: boolean;
  actorUserId: string;
  note: string | null;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  beforeIncident: GatewayAnalysisAnomalyIncidentView | null;
  afterIncident: GatewayAnalysisAnomalyIncidentView | null;
  beforeRoutePolicy: GatewayRoutePolicyView | null;
  afterRoutePolicy: GatewayRoutePolicyView | null;
  errorSummary: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type GatewayAnalysisAnomalyRemediationRunSummaryView = {
  totalRuns: number;
  dryRunRuns: number;
  appliedRuns: number;
  failedRuns: number;
  distinctIncidentCount: number;
  routePolicyChangedRuns: number;
  incidentChangedRuns: number;
  byStatus: GatewaySummaryBucket[];
  byExecutionMode: GatewaySummaryBucket[];
  byActionKey: GatewaySummaryBucket[];
  byPolicyId: GatewaySummaryBucket[];
  byRoutePolicyId: GatewaySummaryBucket[];
};

export type GatewayAnalysisAnomalyRemediationImpactMetricView = {
  beforeValue: number | null;
  afterValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
};

export type GatewayAnalysisAnomalyRemediationRunImpactView = {
  generatedAt: string;
  run: GatewayAnalysisAnomalyIncidentRemediationRunView;
  incident: GatewayAnalysisAnomalyIncidentView | null;
  projectId: string | null;
  routePolicyId: string | null;
  anchorAt: string;
  windowMinutes: number;
  beforeWindow: {
    startedAt: string;
    endedAt: string;
    summary: GatewayAnalysisSummaryView;
  };
  afterWindow: {
    startedAt: string;
    endedAt: string;
    summary: GatewayAnalysisSummaryView;
  };
  metrics: {
    completionRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    failureRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    cancellationRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    streamRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    toolRequestRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    toolResponseRate: GatewayAnalysisAnomalyRemediationImpactMetricView;
    requestArtifactCoverage: GatewayAnalysisAnomalyRemediationImpactMetricView;
    responseArtifactCoverage: GatewayAnalysisAnomalyRemediationImpactMetricView;
    promptTokensPerSample: GatewayAnalysisAnomalyRemediationImpactMetricView;
    completionTokensPerSample: GatewayAnalysisAnomalyRemediationImpactMetricView;
    totalTokensPerSample: GatewayAnalysisAnomalyRemediationImpactMetricView;
    requestTextCharsAvg: GatewayAnalysisAnomalyRemediationImpactMetricView;
    responseTextCharsAvg: GatewayAnalysisAnomalyRemediationImpactMetricView;
    firstTokenLatencyMsAvg: GatewayAnalysisAnomalyRemediationImpactMetricView;
    streamChunkCountAvg: GatewayAnalysisAnomalyRemediationImpactMetricView;
  };
};

export type GatewayAnalysisAnomalyRemediationEffectivenessMetricView = {
  improvedRuns: number;
  regressedRuns: number;
  neutralRuns: number;
  unavailableRuns: number;
};

export type GatewayAnalysisAnomalyRemediationActionEffectivenessView = {
  actionKey: string;
  runCount: number;
  impactedRunCount: number;
  unavailableRunCount: number;
  completionRate: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  failureRate: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  requestArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  responseArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  firstTokenLatencyMsAvg: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  totalTokensPerSample: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSummaryView = {
  generatedAt: string;
  windowMinutes: number;
  totalRuns: number;
  impactedRuns: number;
  unavailableRuns: number;
  byStatus: GatewaySummaryBucket[];
  byExecutionMode: GatewaySummaryBucket[];
  byActionKey: GatewaySummaryBucket[];
  completionRate: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  failureRate: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  requestArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  responseArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  firstTokenLatencyMsAvg: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  totalTokensPerSample: GatewayAnalysisAnomalyRemediationEffectivenessMetricView;
  actions: GatewayAnalysisAnomalyRemediationActionEffectivenessView[];
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilterView = {
  incidentId: string | null;
  policyId: string | null;
  routePolicyId: string | null;
  actionKey: string | null;
  status: GatewayAnalysisAnomalyRemediationRunStatus | null;
  executionMode: GatewayAnalysisAnomalyRemediationExecutionMode | null;
  dryRun: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  lookbackHours: number | null;
  windowMinutes: number;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView = {
  snapshotId: string;
  label: string | null;
  createdAt: string;
  objectKey: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilterView;
  summary: GatewayAnalysisAnomalyRemediationEffectivenessSummaryView;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView = {
  totalSnapshots: number;
  totalRuns: number;
  totalImpactedRuns: number;
  totalUnavailableRuns: number;
  byRoutePolicyId: GatewaySummaryBucket[];
  byActionKey: GatewaySummaryBucket[];
  byExecutionMode: GatewaySummaryBucket[];
  byLabel: GatewaySummaryBucket[];
};

export type GatewayAnalysisAnomalyRemediationEffectivenessSnapshotReportFilterView = {
  label: string | null;
  routePolicyId: string | null;
  actionKey: string | null;
  createdFrom: string | null;
  createdTo: string | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView = {
  improvedRate: number | null;
  regressedRate: number | null;
  neutralRate: number | null;
  unavailableRate: number | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendPointView = {
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView;
  totalRuns: number;
  impactedRunRate: number | null;
  unavailableRunRate: number | null;
  completionRate: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  failureRate: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  requestArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  responseArtifactCoverage: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  firstTokenLatencyMsAvg: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
  totalTokensPerSample: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricPointView;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView = {
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendSummaryView = {
  latestSnapshotId: string | null;
  previousSnapshotId: string | null;
  totalRuns: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  impactedRunRate: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  unavailableRunRate: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  completionRateRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  failureRateRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  requestArtifactCoverageRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  responseArtifactCoverageRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  firstTokenLatencyMsAvgRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
  totalTokensPerSampleRegressed: GatewayAnalysisAnomalyRemediationEffectivenessTrendMetricSummaryView;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView = {
  generatedAt: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotReportFilterView;
  matchedSnapshotsCount: number;
  windowSize: number;
  inventorySummary: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView;
  points: GatewayAnalysisAnomalyRemediationEffectivenessTrendPointView[];
  summary: GatewayAnalysisAnomalyRemediationEffectivenessTrendSummaryView | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalyCode =
  | "impacted_run_rate_drop"
  | "unavailable_run_rate_spike"
  | "completion_effectiveness_regressed"
  | "failure_effectiveness_regressed"
  | "request_artifact_effectiveness_regressed"
  | "response_artifact_effectiveness_regressed"
  | "latency_effectiveness_regressed"
  | "token_effectiveness_regressed";

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView = {
  code: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  latestSnapshotId: string | null;
  previousSnapshotId: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number | null;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig = {
  impactedRunRateWarningThreshold: number;
  impactedRunRateCriticalThreshold: number;
  unavailableRunRateWarningThreshold: number;
  unavailableRunRateCriticalThreshold: number;
  completionRateRegressedWarningThreshold: number;
  completionRateRegressedCriticalThreshold: number;
  failureRateRegressedWarningThreshold: number;
  failureRateRegressedCriticalThreshold: number;
  requestArtifactRegressedWarningThreshold: number;
  requestArtifactRegressedCriticalThreshold: number;
  responseArtifactRegressedWarningThreshold: number;
  responseArtifactRegressedCriticalThreshold: number;
  firstTokenLatencyRegressedWarningThreshold: number;
  firstTokenLatencyRegressedCriticalThreshold: number;
  totalTokensRegressedWarningThreshold: number;
  totalTokensRegressedCriticalThreshold: number;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView = {
  generatedAt: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotReportFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig;
  latestSnapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView | null;
  previousSnapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView | null;
  trendSummary: GatewayAnalysisAnomalyRemediationEffectivenessTrendSummaryView | null;
  anomalies: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilterView = {
  label: string | null;
  routePolicyId: string | null;
  actionKey: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  lookbackHours: number | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
};

export type GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView = {
  snapshotId: string;
  label: string | null;
  createdAt: string;
  objectKey: string;
  filters: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilterView;
  report: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView;
};

export type GatewayAnalysisAnomalyIncidentRemediationQueueItemView = {
  incident: GatewayAnalysisAnomalyIncidentView;
  policy: GatewayAnalysisAnomalyPolicyView | null;
  routePolicy: GatewayRoutePolicyView | null;
  action: GatewayAnalysisAnomalyIncidentRemediationActionView;
  remediationDue: boolean;
  nextExecutionStatus: GatewayAnalysisAnomalyRemediationRunStatus | null;
  nextRunDueAt: string | null;
  blockedReason: string | null;
  latestRun: GatewayAnalysisAnomalyIncidentRemediationRunView | null;
};

export type GatewayAnalysisAnomalyIncidentRemediationQueueView = {
  generatedAt: string;
  limit: number;
  dueOnly: boolean;
  itemCount: number;
  dueCount: number;
  items: GatewayAnalysisAnomalyIncidentRemediationQueueItemView[];
};

export const gatewayAnalysisAnomalyRemediationSweepStatuses = ["ok", "error", "skipped"] as const;
export type GatewayAnalysisAnomalyRemediationSweepStatus =
  (typeof gatewayAnalysisAnomalyRemediationSweepStatuses)[number];

export type GatewayAnalysisAnomalyRemediationSweepItemView = {
  incidentId: string;
  actionKey: string;
  status: GatewayAnalysisAnomalyRemediationSweepStatus;
  executionStatus: GatewayAnalysisAnomalyRemediationRunStatus | null;
  runId: string | null;
  error: string | null;
};

export type GatewayAnalysisAnomalyRemediationSweepView = {
  startedAt: string;
  completedAt: string;
  limit: number;
  attemptedCount: number;
  dryRunCount: number;
  appliedCount: number;
  errorCount: number;
  skippedCount: number;
  items: GatewayAnalysisAnomalyRemediationSweepItemView[];
};

export type GatewayAnalysisAnomalyIncidentAlertQueueItemView = {
  incident: GatewayAnalysisAnomalyIncidentView;
  policy: GatewayAnalysisAnomalyPolicyView | null;
  routePolicy: GatewayRoutePolicyView | null;
  alertIntervalMinutes: number;
  alertDue: boolean;
  nextAlertDueAt: string | null;
  notifyOperators: boolean;
  notifyOwner: boolean;
  alertLevel: number;
  webhookSeverity: GatewayAnalysisAnomalyAlertDeliverySeverity;
  remediationActionKeys: string[];
};

export type GatewayAnalysisAnomalyIncidentAlertQueueView = {
  generatedAt: string;
  limit: number;
  dueOnly: boolean;
  incidentCount: number;
  dueCount: number;
  items: GatewayAnalysisAnomalyIncidentAlertQueueItemView[];
};

export type GatewayProviderHealthView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  status: GatewayProviderAccountStatus;
  cooldownUntil: string | null;
  failureCount: number;
  lastError: string | null;
  lastHealthCheckAt: string | null;
  activeConcurrency: number;
  breakerOpen: boolean;
  routingScore: number;
  healthWeight: number;
  capacityWeight: number;
  degraded: boolean;
  saturated: boolean;
  degradationReasons: string[];
};

export type GatewayProviderHealthSummaryView = {
  totalProviders: number;
  activeProviders: number;
  coolingProviders: number;
  disabledProviders: number;
  breakerOpenProviders: number;
  degradedProviders: number;
  saturatedProviders: number;
  totalActiveConcurrency: number;
  avgRoutingScore: number | null;
};

export type GatewayPriceRateView = {
  promptMicrosPer1kTokens: number | null;
  completionMicrosPer1kTokens: number | null;
  currency: "USD";
  configured: boolean;
  source: "payload" | "model_pricing" | "default_registry" | "unconfigured";
};

export type GatewayProviderModelStaticPricingEntryView = {
  model: string;
  staticRate: GatewayPriceRateView;
};

export type GatewayProviderStaticPricingCoverageView = {
  totalModels: number;
  configuredModels: number;
  fullyConfigured: boolean;
  configuredEntries: GatewayProviderModelStaticPricingEntryView[];
  missingModels: string[];
};

export type GatewayProviderCostHintsView = {
  staticRate: GatewayPriceRateView;
  platformQuoteRate: GatewayPriceRateView;
  staticPricingCoverage: GatewayProviderStaticPricingCoverageView;
  observedRequestCount: number;
  observedFailureCount: number;
  recentRequestCount10m: number;
  recentFailureCount10m: number;
  observedPromptTokens: number;
  observedCompletionTokens: number;
  observedTotalTokens: number;
  observedCostMicros: number | null;
  observedCostSource: "configured_rate_estimate" | "unavailable";
  lastRequestAt: string | null;
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

export type GatewayProviderInventoryEntryView = {
  providerAccount: GatewayProviderAccountView;
  providerHealth: GatewayProviderHealthView | null;
  costHints: GatewayProviderCostHintsView;
  providerQuota: GatewayProviderQuotaView | null;
};

export type GatewayProviderModelTieringSource =
  | "upstream_models"
  | "configured_supported_models"
  | "capability_catalog"
  | "default_model"
  | "fixed_models";

export type GatewayProviderModelTieringCardView = {
  model: string;
  platformTier: GatewayPlatformTier;
  enabled: boolean;
  source: GatewayProviderModelTieringSource;
};

export type GatewayProviderModelTieringView = {
  providerAccountId: string;
  providerLabel: string;
  models: GatewayProviderModelTieringCardView[];
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

export type GatewayCatalogMetadataView = {
  providerAccountCount: number;
  modelAliasCount: number;
  routePolicyCount: number;
  fetchedProviderAccounts: number;
  fetchedModelAliases: number;
  fetchedRoutePolicies: number;
};

export type GatewayProviderInventorySummaryView = {
  totalProviders: number;
  totalProviderSurfaces: number;
  activeProviders: number;
  activeProviderSurfaces: number;
  degradedProviders: number;
  degradedProviderSurfaces: number;
  breakerOpenProviders: number;
  breakerOpenProviderSurfaces: number;
  totalActiveConcurrency: number;
  avgRoutingScore: number | null;
  configuredSourceProfiles: number;
  derivedSourceProfiles: number;
  providersWithObservedCost: number;
  providersWithPlatformQuote: number;
  providersWithQuota: number;
  warningQuotaProviders: number;
  exhaustedQuotaProviders: number;
  bySourceKind: GatewaySummaryBucket[];
  byProtocolFamily: GatewaySummaryBucket[];
  byAdapter: GatewaySummaryBucket[];
  catalogMetadata: GatewayCatalogMetadataView;
};

export type GatewayProviderInventoryView = {
  providers: GatewayProviderInventoryEntryView[];
  summary: GatewayProviderInventorySummaryView;
};

export type GatewayProviderRoutingAnalysisFilterView = {
  projectId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  responseId: string | null;
  protocolFamily: GatewayProtocolFamily | null;
  endpointKind: string | null;
  status: GatewayRequestStatus | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
};

export type GatewayProviderRoutingAnalysisSummaryView = {
  totalSamples: number;
  selectedProviderSamples: number;
  degradedSelectedProviderSamples: number;
  saturatedSelectedProviderSamples: number;
  breakerOpenSelectedProviderSamples: number;
  routingScore: GatewayAnalysisMetricDistributionView;
  healthWeight: GatewayAnalysisMetricDistributionView;
  capacityWeight: GatewayAnalysisMetricDistributionView;
  bySelectedProvider: GatewaySummaryBucket[];
  byDegradationReason: GatewaySummaryBucket[];
};

export type GatewayProviderRoutingAnalysisAnomalyCode =
  | "provider_routing_score_drop"
  | "degraded_provider_route_spike"
  | "saturated_provider_route_spike"
  | "breaker_open_provider_route_detected";

export type GatewayProviderRoutingAnalysisAnomalyView = {
  code: GatewayProviderRoutingAnalysisAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number | null;
};

export type GatewayProviderRoutingAnalysisAnomalyThresholdConfig = {
  routingScoreWarningThreshold: number;
  routingScoreCriticalThreshold: number;
  degradedRouteWarningThreshold: number;
  degradedRouteCriticalThreshold: number;
  saturatedRouteWarningThreshold: number;
  saturatedRouteCriticalThreshold: number;
  breakerOpenRouteWarningThreshold: number;
  breakerOpenRouteCriticalThreshold: number;
};

export type GatewayProviderRoutingAnalysisAnomalyReportView = {
  generatedAt: string;
  filters: GatewayProviderRoutingAnalysisFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayProviderRoutingAnalysisAnomalyThresholdConfig;
  summary: GatewayProviderRoutingAnalysisSummaryView;
  anomalies: GatewayProviderRoutingAnalysisAnomalyView[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
};

export type GatewaySummaryBucket = {
  key: string;
  count: number;
};

export type GatewayRequestAuditSummaryView = {
  totalRequests: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  runningCount: number;
  fallbackEligibleFailures: number;
  fallbackExhaustedFailures: number;
  byStatus: GatewaySummaryBucket[];
  byProviderAccount: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
  byErrorCode: GatewaySummaryBucket[];
};

export type GatewayModelAssociationProviderLinkView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  status: GatewayProviderAccountStatus;
  sourceProfile: GatewayProviderSourceView;
  upstreamModel: string | null;
  priority: number;
  weight: number;
  enabled: boolean;
  defaultModel: string | null;
};

export type GatewayModelAssociationAliasRowView = {
  alias: string;
  projectId: string | null;
  scopeType: GatewayModelAliasScopeType;
  upstreamModel: string | null;
  providerCount: number;
  enabledProviderCount: number;
  fallbackPriority: string;
  sourceKindDistribution: GatewaySummaryBucket[];
  providers: GatewayModelAssociationProviderLinkView[];
};

export type GatewayModelAssociationProviderAliasLinkView = {
  alias: string;
  projectId: string | null;
  scopeType: GatewayModelAliasScopeType;
  upstreamModel: string | null;
  priority: number;
  weight: number;
  enabled: boolean;
};

export type GatewayModelAssociationProviderRowView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  status: GatewayProviderAccountStatus;
  sourceProfile: GatewayProviderSourceView;
  defaultModel: string | null;
  supportedAliasCount: number;
  aliases: GatewayModelAssociationProviderAliasLinkView[];
};

export type GatewayModelAssociationMatrixView = {
  aliasRows: GatewayModelAssociationAliasRowView[];
  providerRows: GatewayModelAssociationProviderRowView[];
  summary: {
    totalAliases: number;
    totalProviders: number;
    totalLinks: number;
    bySourceKind: GatewaySummaryBucket[];
    byProtocolFamily: GatewaySummaryBucket[];
  };
};

export type GatewayCostProviderModelRowView = {
  model: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  marketRate: GatewayPriceRateView;
  estimatedMarketCostMicros: number | null;
  lastRequestAt: string | null;
};

export type GatewayCostProviderBucketView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter | string;
  protocolFamily: GatewayProtocolFamily | string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedMarketCostMicros: number | null;
  pricedModelCount: number;
  unpricedModelCount: number;
  lastRequestAt: string | null;
  models: GatewayCostProviderModelRowView[];
};

export type GatewayCostModelProviderRowView = {
  providerAccountId: string;
  label: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  marketRate: GatewayPriceRateView;
  estimatedMarketCostMicros: number | null;
  lastRequestAt: string | null;
};

export type GatewayCostModelBucketView = {
  model: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedMarketCostMicros: number | null;
  providerCount: number;
  pricedProviderCount: number;
  lastRequestAt: string | null;
  providers: GatewayCostModelProviderRowView[];
};

export type GatewayProviderPricingEditorModelRowView = {
  model: string;
  marketRate: GatewayPriceRateView;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedMarketCostMicros: number | null;
};

export type GatewayProviderPricingEditorView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter | string;
  protocolFamily: GatewayProtocolFamily | string;
  modelCount: number;
  configuredModelCount: number;
  rows: GatewayProviderPricingEditorModelRowView[];
};

export type GatewayCostOverviewView = {
  summary: {
    providerCount: number;
    pricedProviderCount: number;
    unpricedProviderCount: number;
    modelCount: number;
    pricedModelCount: number;
    unpricedModelCount: number;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalThinkingTokens: number;
    totalCachedTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    estimatedMarketCostMicros: number | null;
  };
  providerBuckets: GatewayCostProviderBucketView[];
  modelBuckets: GatewayCostModelBucketView[];
  pricingEditors: GatewayProviderPricingEditorView[];
};

export type GatewayRateLimitHotspotSummaryView = {
  totalRateLimitedRequests: number;
  byCode: GatewaySummaryBucket[];
  byProject: GatewaySummaryBucket[];
  byRoutePolicyId: GatewaySummaryBucket[];
  byApiKeyId: GatewaySummaryBucket[];
  byRequestedModel: GatewaySummaryBucket[];
  byResolvedModel: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
};

export type GatewayRateLimitHotspotFilterView = {
  projectId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  responseId: string | null;
  protocolFamily: GatewayProtocolFamily | null;
  endpointKind: string | null;
  errorCode: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  windowSize: number;
  bucketSizeMinutes: number;
};

export type GatewayRateLimitHotspotTrendPointView = {
  bucketStartAt: string;
  bucketEndAt: string;
  totalRateLimitedRequests: number;
  byCode: GatewaySummaryBucket[];
  byProject: GatewaySummaryBucket[];
  byRoutePolicyId: GatewaySummaryBucket[];
  byApiKeyId: GatewaySummaryBucket[];
  byRequestedModel: GatewaySummaryBucket[];
  byResolvedModel: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
};

export type GatewayRateLimitHotspotMetricSummaryView = {
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
};

export type GatewayRateLimitHotspotTrendSummaryView = {
  latestBucketStartAt: string | null;
  previousBucketStartAt: string | null;
  totalRateLimitedRequests: GatewayRateLimitHotspotMetricSummaryView;
  topCodeShare: GatewayRateLimitHotspotMetricSummaryView;
  topProjectShare: GatewayRateLimitHotspotMetricSummaryView;
  topApiKeyShare: GatewayRateLimitHotspotMetricSummaryView;
  topRequestedModelShare: GatewayRateLimitHotspotMetricSummaryView;
  topEndpointShare: GatewayRateLimitHotspotMetricSummaryView;
  latestTopCodeKey: string | null;
  latestTopProjectKey: string | null;
  latestTopApiKeyKey: string | null;
  latestTopRequestedModelKey: string | null;
  latestTopEndpointKey: string | null;
};

export type GatewayRateLimitHotspotTrendReportView = {
  generatedAt: string;
  filters: GatewayRateLimitHotspotFilterView;
  matchedRequestsCount: number;
  windowSize: number;
  bucketSizeMinutes: number;
  points: GatewayRateLimitHotspotTrendPointView[];
  summary: GatewayRateLimitHotspotTrendSummaryView | null;
};

export type GatewayRateLimitHotspotAnomalyThresholdConfig = {
  totalRateLimitedRequestsWarningThreshold: number;
  totalRateLimitedRequestsCriticalThreshold: number;
  totalRateLimitedRequestsDeltaRatioThreshold: number;
  topCodeShareWarningThreshold: number;
  topCodeShareCriticalThreshold: number;
  topProjectShareWarningThreshold: number;
  topProjectShareCriticalThreshold: number;
  topApiKeyShareWarningThreshold: number;
  topApiKeyShareCriticalThreshold: number;
  topRequestedModelShareWarningThreshold: number;
  topRequestedModelShareCriticalThreshold: number;
  topEndpointShareWarningThreshold: number;
  topEndpointShareCriticalThreshold: number;
};

export type GatewayRateLimitHotspotAnomalyView = {
  code: GatewayRateLimitHotspotAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  entityKey: string | null;
  latestBucketStartAt: string | null;
  previousBucketStartAt: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number;
};

export type GatewayRateLimitHotspotAnomalyReportView = {
  generatedAt: string;
  filters: GatewayRateLimitHotspotFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayRateLimitHotspotAnomalyThresholdConfig;
  trendSummary: GatewayRateLimitHotspotTrendSummaryView | null;
  latestPoint: GatewayRateLimitHotspotTrendPointView | null;
  previousPoint: GatewayRateLimitHotspotTrendPointView | null;
  anomalies: GatewayRateLimitHotspotAnomalyView[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
};

export type GatewayRateLimitHotspotSnapshotFilterView = {
  projectId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  responseId: string | null;
  protocolFamily: GatewayProtocolFamily | null;
  endpointKind: string | null;
  errorCode: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  lookbackHours: number | null;
};

export type GatewayRateLimitHotspotSnapshotView = {
  snapshotId: string;
  label: string | null;
  createdAt: string;
  objectKey: string;
  filters: GatewayRateLimitHotspotSnapshotFilterView;
  summary: GatewayRateLimitHotspotSummaryView;
};

export type GatewayRateLimitHotspotSnapshotInventorySummaryView = {
  totalSnapshots: number;
  totalRateLimitedRequests: number;
  byCode: GatewaySummaryBucket[];
  byProject: GatewaySummaryBucket[];
  byRoutePolicyId: GatewaySummaryBucket[];
  byApiKeyId: GatewaySummaryBucket[];
  byRequestedModel: GatewaySummaryBucket[];
  byResolvedModel: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
  byLabel: GatewaySummaryBucket[];
};

export type GatewayRateLimitHotspotSnapshotReportFilterView = {
  label: string | null;
  projectId: string | null;
  routePolicyId: string | null;
  apiKeyId: string | null;
  endpointKind: string | null;
  createdFrom: string | null;
  createdTo: string | null;
};

export type GatewayRateLimitHotspotSnapshotTrendPointView = {
  snapshot: GatewayRateLimitHotspotSnapshotView;
  totalRateLimitedRequests: number;
  topCodeShare: number | null;
  topProjectShare: number | null;
  topApiKeyShare: number | null;
  topRequestedModelShare: number | null;
  topEndpointShare: number | null;
};

export type GatewayRateLimitHotspotSnapshotTrendSummaryView = {
  latestSnapshotId: string | null;
  previousSnapshotId: string | null;
  totalRateLimitedRequests: GatewayRateLimitHotspotMetricSummaryView;
  topCodeShare: GatewayRateLimitHotspotMetricSummaryView;
  topProjectShare: GatewayRateLimitHotspotMetricSummaryView;
  topApiKeyShare: GatewayRateLimitHotspotMetricSummaryView;
  topRequestedModelShare: GatewayRateLimitHotspotMetricSummaryView;
  topEndpointShare: GatewayRateLimitHotspotMetricSummaryView;
};

export type GatewayRateLimitHotspotSnapshotTrendReportView = {
  generatedAt: string;
  filters: GatewayRateLimitHotspotSnapshotReportFilterView;
  matchedSnapshotsCount: number;
  windowSize: number;
  inventorySummary: GatewayRateLimitHotspotSnapshotInventorySummaryView;
  points: GatewayRateLimitHotspotSnapshotTrendPointView[];
  summary: GatewayRateLimitHotspotSnapshotTrendSummaryView | null;
};

export type GatewayRateLimitHotspotAnomalySnapshotFilterView = {
  label: string | null;
  projectId: string | null;
  routePolicyId: string | null;
  apiKeyId: string | null;
  endpointKind: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  lookbackHours: number | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
};

export type GatewayRateLimitHotspotAnomalySnapshotView = {
  snapshotId: string;
  label: string | null;
  createdAt: string;
  objectKey: string;
  filters: GatewayRateLimitHotspotAnomalySnapshotFilterView;
  report: GatewayRateLimitHotspotAnomalyReportView;
};

export type GatewayProjectPressureView = {
  projectId: string;
  displayName: string;
  activeConcurrency: number;
  runningRequestCount: number;
};

export type GatewayProviderPressureView = {
  providerAccountId: string;
  label: string;
  status: GatewayProviderAccountStatus;
  protocolFamily: GatewayProtocolFamily;
  activeConcurrency: number;
  runningRequestCount: number;
  breakerOpen: boolean;
};

export type GatewayRuntimePressureView = {
  totalRunningRequests: number;
  totalProjectConcurrency: number;
  totalProviderConcurrency: number;
  projects: GatewayProjectPressureView[];
  providers: GatewayProviderPressureView[];
};

export type GatewaySessionDetailView = {
  session: GatewaySessionView;
  activeRequestAudit: GatewayRequestAuditView | null;
  latestRequestAudit: GatewayRequestAuditView | null;
  recentRequestAudits: GatewayRequestAuditView[];
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

export type PatchGatewayProviderModelPricingInput = {
  entries: Array<{
    model: string;
    promptMicrosPer1kTokens?: number | null;
    completionMicrosPer1kTokens?: number | null;
  }>;
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

export type UpsertGatewayModelAliasInput = {
  projectId?: string | null;
  scopeType?: GatewayModelAliasScopeType;
  alias: string;
  providerAccountId: string;
  upstreamModel?: string | null;
  priority?: number;
  weight?: number;
  enabled?: boolean;
};

export type UpsertGatewayRoutePolicyInput = {
  projectId: string;
  name: string;
  isDefault?: boolean;
  enabled?: boolean;
  config: GatewayRoutePolicyConfig;
};

export type UpsertGatewayProviderCapabilityInput = {
  providerAccountId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel?: string | null;
  enabled?: boolean;
};

export type UpsertGatewayPlatformAccessInput = {
  providerCapabilityId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel?: string | null;
  platformTier: GatewayPlatformTier;
  status?: string;
  operatorWeight?: number;
  routingPriority?: number;
  enabledForSale?: boolean;
  notes?: string | null;
};

export type UpsertGatewayAccessBundleInput = {
  projectId?: string | null;
  slug: string;
  displayName: string;
  billingMode: GatewayAccessBundleBillingMode | string;
  status?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ReplaceGatewayAccessBundleItemsInput = {
  platformAccessIds: string[];
};

export type UpsertGatewayAccessKeyInput = {
  ownerType: GatewayAccessKeyOwnerType;
  ownerId: string;
  resolvedProjectId: string;
  resolvedTenantId: string;
  keyKind?: GatewayAccessKeyKind;
  publicKeyPrefix: string;
  displayName: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  bundleIds?: string[] | null;
};

export type GatewayAccessKeyRotateInput = {
  displayName?: string | null;
  expiresAt?: string | null;
};

export type GatewayAccessKeyRevokeInput = {
  reason?: string | null;
};

export type GatewayAccessKeyBalanceAdjustInput = {
  balanceMode?: GatewayAccessBalanceMode;
  unlimitedUntil?: string | null;
  periodStartsAt?: string | null;
  periodEndsAt?: string | null;
  tokenDelta?: number | null;
  messageDelta?: number | null;
  totalTokens?: number | null;
  totalMessages?: number | null;
  status?: string | null;
};

export type ReplaceGatewayAccessKeyAggregateMembershipsInput = {
  memberAccessKeyIds: Array<{
    accessKeyId: string;
    priority?: number | null;
  }>;
};

export type GatewayAccessCandidatePreviewView = {
  requestingAccessKeyId: string;
  sourceAccessKeyId: string;
  platformAccessId: string;
  providerAccountId: string;
  modelCode: string;
  endpointKind: string;
  upstreamModel: string | null;
  platformTier: GatewayPlatformTier;
  operatorWeight: number;
  routingPriority: number;
  stickyMatched: boolean;
  availableByBalance: boolean;
  balanceMode: string | null;
  remainingTokens: number | null;
  remainingMessages: number | null;
};

export type GatewayRouteDecisionPreviewView = {
  requestingAccessKeyId: string;
  requestedModel: string;
  endpointKind: string;
  stickyMatched: boolean;
  selected: GatewayAccessCandidatePreviewView | null;
  candidates: GatewayAccessCandidatePreviewView[];
};

export type GatewayAccessStickyAffinityView = {
  scope: string;
  model: string;
  requestingAccessKeyId: string;
  sourceAccessKeyId: string;
  platformAccessId: string;
  providerAccountId: string;
  realCredentialRef: string | null;
  expiresAt: string | null;
};
