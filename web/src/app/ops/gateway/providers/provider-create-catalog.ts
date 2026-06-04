type ProviderCreateHttpSpec = {
  key: string;
  label: string;
  adapter: string;
  protocolFamily: string;
  protocolProfile: string;
  defaultServiceProviderLabel?: string;
  defaultServiceProviderKey?: string;
  defaultBaseUrl?: string;
  defaultPayloadPatch?: Record<string, unknown>;
  defaultCredentialDraft?: Record<string, unknown>;
  credentialHint?: string;
  sourceKind:
    | "official_model_api"
    | "official_vendor_api"
    | "aggregator_api"
    | "web_reverse_api";
  aggregatorApiMode?: "hosted_compute" | "upstream_forward";
  webReverseAccessMode?: "direct_http_replay" | "browser_challenge";
  defaultExecutionMode: "direct_http" | "browser_backed";
  defaultAuthMode:
    | "bearer"
    | "x-api-key"
    | "api-key"
    | "x-goog-api-key"
    | "none";
};

export const PROVIDER_CREATE_HTTP_SPECS: ProviderCreateHttpSpec[] = [
  {
    key: "openai-platform",
    label: "OpenAI Platform",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "chatgpt_official_api",
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "openai-compatible",
    label: "OpenAI-compatible (Generic)",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "openai_compatible_generic",
    sourceKind: "aggregator_api",
    aggregatorApiMode: "hosted_compute",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "azure-openai",
    label: "Azure OpenAI",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "azure_openai",
    defaultServiceProviderKey: "azure_openai_platform",
    defaultServiceProviderLabel: "Azure OpenAI",
    sourceKind: "official_vendor_api",
    defaultBaseUrl: "https://your-resource.openai.azure.com/openai/v1",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "api-key",
  },
  {
    key: "groq-openai",
    label: "Groq OpenAI-compatible",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "groq",
    defaultServiceProviderKey: "groq_platform",
    defaultServiceProviderLabel: "Groq OpenAI-compatible",
    sourceKind: "official_vendor_api",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "together-openai",
    label: "Together OpenAI-compatible",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "together",
    defaultServiceProviderKey: "together_platform",
    defaultServiceProviderLabel: "Together OpenAI-compatible",
    sourceKind: "aggregator_api",
    aggregatorApiMode: "hosted_compute",
    defaultBaseUrl: "https://api.together.xyz/v1",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "openrouter-openai",
    label: "OpenRouter OpenAI-compatible",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "openrouter",
    defaultServiceProviderKey: "openrouter_platform",
    defaultServiceProviderLabel: "OpenRouter OpenAI-compatible",
    sourceKind: "aggregator_api",
    aggregatorApiMode: "upstream_forward",
    defaultBaseUrl: "https://openrouter.ai/api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "deepseek-openai",
    label: "DeepSeek OpenAI-compatible",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "deepseek",
    defaultServiceProviderKey: "deepseek_platform",
    defaultServiceProviderLabel: "DeepSeek OpenAI-compatible",
    sourceKind: "official_model_api",
    defaultBaseUrl: "https://api.deepseek.com",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "mistral-openai",
    label: "Mistral OpenAI-compatible",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "mistral",
    defaultServiceProviderKey: "mistral_platform",
    defaultServiceProviderLabel: "Mistral OpenAI-compatible",
    sourceKind: "official_model_api",
    defaultBaseUrl: "https://api.mistral.ai",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "xai-openai",
    label: "xAI OpenAI-compatible",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "xai",
    defaultServiceProviderKey: "xai_platform",
    defaultServiceProviderLabel: "xAI Platform",
    defaultBaseUrl: "https://api.x.ai/v1",
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "nvidia-openai",
    label: "NVIDIA OpenAI-compatible",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "nvidia",
    defaultServiceProviderKey: "nvidia_platform",
    defaultServiceProviderLabel: "NVIDIA OpenAI-compatible",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "qwen-dashscope-openai",
    label: "Qwen DashScope OpenAI",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "qwen_dashscope_openai",
    defaultServiceProviderLabel: "Qwen Platform",
    defaultServiceProviderKey: "qwen_platform",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultPayloadPatch: {
      chatCompletionsPath: "/chat/completions",
      responsesPath: "/responses",
    },
    sourceKind: "official_model_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "qwen-coding-plan-openai",
    label: "Qwen Coding Plan OpenAI",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "qwen_coding_plan_openai",
    defaultServiceProviderLabel: "Qwen Platform",
    defaultServiceProviderKey: "qwen_platform",
    defaultBaseUrl: "https://coding.dashscope.aliyuncs.com/v1",
    defaultPayloadPatch: {
      chatCompletionsPath: "/chat/completions",
      responsesPath: "/responses",
    },
    defaultCredentialDraft: {
      apiKey: "sk-sp-your-qwen-coding-plan-key",
      credentialMaterialKey: "qwen-official:coding-plan",
      accountName: "coding-plan",
    },
    credentialHint:
      "Coding Plan 官方文档当前把套餐额度限定在交互式 AI 编程工具中，并明确不支持 curl/Postman/Dify/自定义应用程序后端等 API/后端调用场景；sk-sp-... 只是专属 key 形态，当前 gateway lane 应按 provider unsupported 理解。",
    sourceKind: "official_model_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "qwen-coding-plan-anthropic",
    label: "Qwen Coding Plan Anthropic",
    adapter: "anthropic_compatible",
    protocolFamily: "anthropic",
    protocolProfile: "qwen_coding_plan_anthropic",
    defaultServiceProviderLabel: "Qwen Platform",
    defaultServiceProviderKey: "qwen_platform",
    defaultBaseUrl: "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    defaultCredentialDraft: {
      apiKey: "sk-sp-your-qwen-coding-plan-key",
      credentialMaterialKey: "qwen-official:coding-plan",
      accountName: "coding-plan",
    },
    credentialHint:
      "Coding Plan 官方文档当前把套餐额度限定在交互式 AI 编程工具中，并明确不支持 curl/Postman/Dify/自定义应用程序后端等 API/后端调用场景；sk-sp-... 只是专属 key 形态，当前 gateway lane 应按 provider unsupported 理解。",
    sourceKind: "official_model_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "x-api-key",
  },
  {
    key: "qwen-web-chat",
    label: "Qwen WebUI Replay",
    adapter: "qwen_web_compatible",
    protocolFamily: "qwen_web_chat",
    protocolProfile: "qwen_web_chat",
    defaultServiceProviderLabel: "Qwen Platform",
    defaultServiceProviderKey: "qwen_platform",
    defaultBaseUrl: "https://chat.qwen.ai",
    defaultPayloadPatch: {
      chatCompletionsPath: "/api/v2/chat/completions",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        Timezone: "Mon Dec 08 2025 17:28:55 GMT+0800",
        "sec-ch-ua": "\"Microsoft Edge\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        source: "web",
        Version: "0.1.13",
        "bx-v": "2.5.31",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
      },
      sessionAuth: {
        transport: "bearer",
        headerName: "authorization",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "accio-web-reverse-api",
    label: "Accio Web Reverse API",
    adapter: "accio_compatible",
    protocolFamily: "openai_responses",
    protocolProfile: "accio",
    defaultServiceProviderLabel: "Accio Platform",
    defaultServiceProviderKey: "accio_platform",
    defaultBaseUrl: "https://phoenix-gw.alibaba.com",
    defaultPayloadPatch: {
      responsesPath: "/api/adk/llm/generateContent",
      headers: {
        version: "0.5.6",
        "x-app-version": "0.5.6",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "none",
  },
  {
    key: "grok-web-reverse-api",
    label: "Grok Web Reverse API",
    adapter: "grok_compatible",
    protocolFamily: "openai",
    protocolProfile: "grok_web",
    defaultServiceProviderLabel: "Grok Web",
    defaultServiceProviderKey: "grok_platform",
    defaultBaseUrl: "https://grok.com",
    defaultPayloadPatch: {
      chatCompletionsPath: "/rest/app-chat/conversations/new",
      headers: {
        Accept: "text/event-stream",
        Origin: "https://grok.com",
        Referer: "https://grok.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      sessionAuth: {
        transport: "cookie",
        primaryCookieName: "sso",
        secondaryCookieName: "sso-rw",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "none",
  },

  {
    key: "chatgpt-web-reverse",
    label: "ChatGPT Web Reverse",
    adapter: "chatgpt_web_reverse_compatible",
    protocolFamily: "chatgpt_web_chat",
    protocolProfile: "chatgpt_web_reverse",
    defaultServiceProviderLabel: "ChatGPT Platform",
    defaultServiceProviderKey: "chatgpt_platform",
    defaultBaseUrl: "https://chatgpt.com",
    defaultPayloadPatch: {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7",
        Origin: "https://chatgpt.com",
        Referer: "https://chatgpt.com/",
      },
      sessionAuth: {
        transport: "bearer",
        headerName: "authorization",
      },
      extraBody: {
        clientVersion: "prod-be885abbfcfe7b1f511e88b3003d9ee44757fbad",
        clientBuildNumber: "5955942",
        timezone: "Asia/Shanghai",
      },
      modelsPath: "/backend-api/models?history_and_training_disabled=false",
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "aistudio-web-reverse",
    label: "AI Studio Web Reverse",
    adapter: "aistudio_web_reverse_compatible",
    protocolFamily: "gemini_generate_content",
    protocolProfile: "aistudio_web_reverse",
    defaultServiceProviderLabel: "AI Studio Platform",
    defaultServiceProviderKey: "aistudio_platform",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultPayloadPatch: {
      extraBody: {
        appUrl: "https://ai.studio/apps/fa9cb8e6-4d92-4fb6-a2b1-b947405c22ae",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "none",
  },
  {
    key: "perplexity-chat",
    label: "Perplexity Chat",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "perplexity_chat",
    defaultServiceProviderKey: "perplexity_platform",
    defaultServiceProviderLabel: "Perplexity Platform",
    defaultBaseUrl: "https://api.perplexity.ai",
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "anthropic-compatible",
    label: "Anthropic Messages",
    adapter: "anthropic_compatible",
    protocolFamily: "anthropic",
    protocolProfile: "anthropic",
    defaultServiceProviderKey: "anthropic_platform",
    defaultServiceProviderLabel: "Anthropic Messages",
    sourceKind: "official_model_api",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "x-api-key",
  },
  {
    key: "gemini-api",
    label: "Google Gemini API",
    adapter: "gemini_api_compatible",
    protocolFamily: "gemini_generate_content",
    protocolProfile: "google_gemini_api",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    sourceKind: "official_model_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "x-goog-api-key",
  },
  {
    key: "gemini-api-modular",
    label: "Google Gemini API (Modular)",
    adapter: "gemini_api_modular_compatible",
    protocolFamily: "gemini_generate_content",
    protocolProfile: "google_gemini_api_modular",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    sourceKind: "official_model_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "x-goog-api-key",
  },
  {
    key: "vertex-gemini",
    label: "Google Vertex Gemini",
    adapter: "gemini_api_compatible",
    protocolFamily: "gemini_generate_content",
    protocolProfile: "google_vertex_gemini",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    sourceKind: "official_model_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "gemini-web-chat",
    label: "Gemini Web Chat",
    adapter: "gemini_web_compatible",
    protocolFamily: "gemini_web_chat",
    protocolProfile: "gemini_web",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    defaultBaseUrl: "https://gemini.google.com",
    defaultPayloadPatch: {
      chatCompletionsPath:
        "/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
      headers: {
        Accept: "*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://gemini.google.com",
        Referer: "https://gemini.google.com/",
        "X-Same-Domain": "1",
      },
      sessionAuth: {
        transport: "cookie",
        primaryCookieName: "__Secure-1PSID",
        secondaryCookieName: "__Secure-1PSIDTS",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "none",
  },
  {
    key: "gemini-web-chat-modular",
    label: "Gemini Web Chat (Modular)",
    adapter: "gemini_web_reverse_modular_compatible",
    protocolFamily: "gemini_web_chat",
    protocolProfile: "gemini_web_reverse_modular",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    defaultBaseUrl: "https://gemini.google.com",
    defaultPayloadPatch: {
      chatCompletionsPath:
        "/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
      headers: {
        Accept: "*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://gemini.google.com",
        Referer: "https://gemini.google.com/",
        "X-Same-Domain": "1",
      },
      sessionAuth: {
        transport: "cookie",
        primaryCookieName: "__Secure-1PSID",
        secondaryCookieName: "__Secure-1PSIDTS",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "none",
  },
  {
    key: "bedrock-converse",
    label: "AWS Bedrock Converse",
    adapter: "bedrock_converse_compatible",
    protocolFamily: "bedrock_converse",
    protocolProfile: "aws_bedrock",
    defaultServiceProviderKey: "aws_bedrock_platform",
    defaultServiceProviderLabel: "AWS Bedrock Converse",
    sourceKind: "official_model_api",
    defaultBaseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "cohere-chat",
    label: "Cohere Chat",
    adapter: "cohere_compatible",
    protocolFamily: "cohere_chat",
    protocolProfile: "cohere",
    defaultServiceProviderKey: "cohere_platform",
    defaultServiceProviderLabel: "Cohere Chat",
    sourceKind: "official_model_api",
    defaultBaseUrl: "https://api.cohere.com",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "search-compatible",
    label: "Search-compatible (Generic)",
    adapter: "search_api_compatible",
    protocolFamily: "search",
    protocolProfile: "search_generic",
    sourceKind: "aggregator_api",
    aggregatorApiMode: "hosted_compute",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "perplexity-search",
    label: "Perplexity Search",
    adapter: "search_api_compatible",
    protocolFamily: "perplexity_search",
    protocolProfile: "perplexity_search",
    defaultServiceProviderKey: "perplexity_platform",
    defaultServiceProviderLabel: "Perplexity Search",
    defaultBaseUrl: "https://api.perplexity.ai",
    defaultPayloadPatch: {
      searchPath: "/search",
      searchQueryField: "query",
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "tavily-search",
    label: "Tavily Search",
    adapter: "search_api_compatible",
    protocolFamily: "tavily_search",
    protocolProfile: "tavily",
    defaultServiceProviderKey: "tavily_platform",
    defaultServiceProviderLabel: "Tavily Search",
    defaultBaseUrl: "https://api.tavily.com",
    defaultPayloadPatch: {
      searchPath: "/search",
      searchQueryField: "query",
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "exa-search",
    label: "Exa Search",
    adapter: "search_api_compatible",
    protocolFamily: "exa_search",
    protocolProfile: "exa",
    defaultServiceProviderKey: "exa_platform",
    defaultServiceProviderLabel: "Exa Search",
    defaultBaseUrl: "https://api.exa.ai",
    defaultPayloadPatch: {
      searchPath: "/search",
      fetchPath: "/contents",
      searchQueryField: "query",
      fetchUrlsField: "urls",
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "jina-search",
    label: "Jina Search",
    adapter: "search_api_compatible",
    protocolFamily: "jina_search",
    protocolProfile: "jina_search",
    defaultServiceProviderKey: "jina_platform",
    defaultServiceProviderLabel: "Jina Search",
    defaultBaseUrl: "https://s.jina.ai",
    defaultPayloadPatch: {
      searchPath: "/search",
      searchQueryField: "q",
      headers: {
        Accept: "application/json",
      },
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "jina-reader",
    label: "Jina Reader",
    adapter: "search_api_compatible",
    protocolFamily: "jina_reader",
    protocolProfile: "jina_reader",
    defaultServiceProviderKey: "jina_platform",
    defaultServiceProviderLabel: "Jina Reader",
    defaultBaseUrl: "https://r.jina.ai",
    defaultPayloadPatch: {
      fetchPath: "/",
      fetchUrlsField: "url",
      headers: {
        Accept: "application/json",
      },
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "linkup-search",
    label: "Linkup Search",
    adapter: "search_api_compatible",
    protocolFamily: "linkup_search",
    protocolProfile: "linkup",
    defaultServiceProviderKey: "linkup_platform",
    defaultServiceProviderLabel: "Linkup Search",
    defaultBaseUrl: "https://api.linkup.so",
    defaultPayloadPatch: {
      searchPath: "/v1/search",
      fetchPath: "/v1/fetch",
      researchPath: "/v1/research",
      balancePath: "/v1/credits/balance",
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "you-search",
    label: "You.com Search",
    adapter: "search_api_compatible",
    protocolFamily: "you_search",
    protocolProfile: "you_search",
    defaultServiceProviderKey: "you_platform",
    defaultServiceProviderLabel: "You.com Search",
    defaultBaseUrl: "https://api.ydc-index.io",
    defaultPayloadPatch: {
      searchPath: "/v1/search",
      searchQueryField: "query",
      authHeaderName: "X-API-Key",
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "x-api-key",
  },
  {
    key: "websearchapi-search",
    label: "WebSearchAPI Search",
    adapter: "search_api_compatible",
    protocolFamily: "websearchapi_search",
    protocolProfile: "websearchapi",
    defaultServiceProviderKey: "websearchapi_platform",
    defaultServiceProviderLabel: "WebSearchAPI Search",
    defaultBaseUrl: "https://api.websearchapi.ai",
    defaultPayloadPatch: {
      searchPath: "/ai-search",
      searchQueryField: "query",
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "linkup-compatible-legacy",
    label: "Linkup-compatible (Legacy Alias)",
    adapter: "linkup_compatible",
    protocolFamily: "linkup_search",
    protocolProfile: "linkup",
    defaultServiceProviderKey: "linkup_platform",
    defaultServiceProviderLabel: "Linkup Search",
    defaultBaseUrl: "https://api.linkup.so",
    defaultPayloadPatch: {
      searchPath: "/v1/search",
      fetchPath: "/v1/fetch",
      researchPath: "/v1/research",
      balancePath: "/v1/credits/balance",
    },
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "freebuff-compatible",
    label: "FreeBuff",
    adapter: "freebuff_compatible",
    protocolFamily: "freebuff",
    protocolProfile: "freebuff",
    defaultServiceProviderKey: "freebuff_platform",
    defaultServiceProviderLabel: "FreeBuff",
    defaultBaseUrl: "https://www.codebuff.com",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "xfyun-openai",
    label: "XFYun OpenAI-compatible",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    protocolProfile: "xfyun_openai",
    defaultServiceProviderKey: "xfyun_platform",
    defaultServiceProviderLabel: "XFYun Platform",
    defaultBaseUrl: "https://spark-api-open.xf-yun.com/v1",
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "xfyun-native-websocket",
    label: "XFYun Native WebSocket",
    adapter: "xfyun_websocket_compatible",
    protocolFamily: "xfyun_websocket",
    protocolProfile: "xfyun_native_websocket",
    defaultServiceProviderKey: "xfyun_platform",
    defaultServiceProviderLabel: "XFYun Platform",
    defaultBaseUrl: "wss://spark-api.xf-yun.com/v1.1/chat",
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "producer-images",
    label: "Producer Images",
    adapter: "producer_compatible",
    protocolFamily: "producer_images",
    protocolProfile: "producer",
    defaultServiceProviderLabel: "Producer.ai Platform",
    defaultServiceProviderKey: "producer_platform",
    defaultBaseUrl: "https://www.flowmusic.app",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "producer-music",
    label: "Producer Music",
    adapter: "producer_compatible",
    protocolFamily: "producer_music",
    protocolProfile: "producer",
    defaultServiceProviderLabel: "Producer.ai Platform",
    defaultServiceProviderKey: "producer_platform",
    defaultBaseUrl: "https://www.flowmusic.app",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "producer-videos",
    label: "Producer Videos",
    adapter: "producer_compatible",
    protocolFamily: "producer_videos",
    protocolProfile: "producer",
    defaultServiceProviderLabel: "Producer.ai Platform",
    defaultServiceProviderKey: "producer_platform",
    defaultBaseUrl: "https://www.flowmusic.app",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "gemini-business-images",
    label: "Gemini Business Images",
    adapter: "gemini_business_compatible",
    protocolFamily: "gemini_business_images",
    protocolProfile: "gemini_business",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "chataibot-images",
    label: "ChatAIBot Images",
    adapter: "chataibot_compatible",
    protocolFamily: "chataibot_images",
    protocolProfile: "chataibot",
    defaultServiceProviderLabel: "ChatAIBot",
    defaultServiceProviderKey: "chataibot_platform",
    defaultBaseUrl: "https://chataibot.pro",
    defaultPayloadPatch: {
      headers: {
        Accept: "*/*",
        Origin: "https://chataibot.pro",
        Referer: "https://chataibot.pro/app/chat?chat_id=-2",
        "x-distribution-channel": "web",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      },
      sessionAuth: {
        transport: "cookie",
        primaryCookieName: "token",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "direct_http_replay",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "lumalabs-images",
    label: "LumaLabs Images",
    adapter: "lumalabs_compatible",
    protocolFamily: "lumalabs_images",
    protocolProfile: "lumalabs",
    defaultServiceProviderLabel: "LumaLabs Platform",
    defaultServiceProviderKey: "lumalabs_platform",
    defaultBaseUrl: "https://app.lumalabs.ai",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "lumalabs-videos",
    label: "LumaLabs Videos",
    adapter: "lumalabs_compatible",
    protocolFamily: "lumalabs_videos",
    protocolProfile: "lumalabs",
    defaultServiceProviderLabel: "LumaLabs Platform",
    defaultServiceProviderKey: "lumalabs_platform",
    defaultBaseUrl: "https://app.lumalabs.ai",
    defaultPayloadPatch: {
      extraBody: {
        videoActionType: "create_video_ray3_14",
        videoArtifactField: "video",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "lumalabs-audio",
    label: "LumaLabs Audio",
    adapter: "lumalabs_compatible",
    protocolFamily: "lumalabs_audio",
    protocolProfile: "lumalabs",
    defaultServiceProviderLabel: "LumaLabs Platform",
    defaultServiceProviderKey: "lumalabs_platform",
    defaultBaseUrl: "https://app.lumalabs.ai",
    defaultPayloadPatch: {
      extraBody: {
        audioActionType: "text_to_music_elevenlabs_v1",
        audioArtifactField: "audio",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "gemini-canvas-chat",
    label: "Gemini Canvas Chat / TTS",
    adapter: "gemini_canvas_compatible",
    protocolFamily: "gemini_generate_content",
    protocolProfile: "gemini_canvas",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    defaultBaseUrl: "https://gemini.google.com",
    defaultPayloadPatch: {
      extraBody: {
        shareId: "fe24c455a570",
        shareUrl: "https://gemini.google.com/share/fe24c455a570",
        apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "gemini-canvas-browser-relay",
    label: "Gemini Canvas Browser Relay (Modular)",
    adapter: "gemini_canvas_web_reverse_compatible",
    protocolFamily: "gemini_generate_content",
    protocolProfile: "gemini_canvas_web_reverse_modular",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    defaultBaseUrl: "https://gemini.google.com",
    defaultPayloadPatch: {
      extraBody: {
        shareId: "fe24c455a570",
        shareUrl: "https://gemini.google.com/share/fe24c455a570",
        pureHttpMode: "disabled",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "gemini-canvas-program-relay",
    label: "Gemini Canvas Program Relay (Experimental)",
    adapter: "gemini_canvas_program_web_reverse_compatible",
    protocolFamily: "gemini_generate_content",
    protocolProfile: "gemini_canvas_program_web_reverse_modular",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    defaultBaseUrl: "https://gemini.google.com",
    defaultPayloadPatch: {
      extraBody: {
        shareId: "fe24c455a570",
        shareUrl: "https://gemini.google.com/share/fe24c455a570",
        pureHttpMode: "disabled",
        canvasExecutionOwner: "program_owned_relay",
        canvasQuotaMode: "canvas_program",
      },
    },
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "gemini-canvas-images",
    label: "Gemini Canvas Images",
    adapter: "gemini_canvas_compatible",
    protocolFamily: "gemini_canvas_images",
    protocolProfile: "gemini_canvas",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "kiro-compatible",
    label: "Kiro-compatible",
    adapter: "kiro_compatible",
    protocolFamily: "kiro",
    protocolProfile: "kiro",
    defaultServiceProviderKey: "kiro_platform",
    defaultServiceProviderLabel: "Kiro Platform",
    defaultBaseUrl: "https://codewhisperer.us-east-1.amazonaws.com",
    sourceKind: "official_vendor_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
  {
    key: "gemini-canvas-music",
    label: "Gemini Canvas Music",
    adapter: "gemini_canvas_compatible",
    protocolFamily: "gemini_canvas_music",
    protocolProfile: "gemini_canvas",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "gemini-canvas-videos",
    label: "Gemini Canvas Videos",
    adapter: "gemini_canvas_compatible",
    protocolFamily: "gemini_canvas_videos",
    protocolProfile: "gemini_canvas",
    defaultServiceProviderLabel: "Gemini Platform",
    defaultServiceProviderKey: "gemini_platform",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "suno-images",
    label: "Suno Images",
    adapter: "suno_compatible",
    protocolFamily: "suno_images",
    protocolProfile: "suno",
    defaultServiceProviderLabel: "Suno Platform",
    defaultServiceProviderKey: "suno_platform",
    defaultBaseUrl: "https://suno.com",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "suno-music",
    label: "Suno Music",
    adapter: "suno_compatible",
    protocolFamily: "suno_music",
    protocolProfile: "suno",
    defaultServiceProviderLabel: "Suno Platform",
    defaultServiceProviderKey: "suno_platform",
    defaultBaseUrl: "https://suno.com",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "suno-videos",
    label: "Suno Videos",
    adapter: "suno_compatible",
    protocolFamily: "suno_videos",
    protocolProfile: "suno",
    defaultServiceProviderLabel: "Suno Platform",
    defaultServiceProviderKey: "suno_platform",
    defaultBaseUrl: "https://suno.com",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "udio-images",
    label: "Udio Images",
    adapter: "udio_compatible",
    protocolFamily: "udio_images",
    protocolProfile: "udio",
    defaultServiceProviderLabel: "Udio Platform",
    defaultServiceProviderKey: "udio_platform",
    defaultBaseUrl: "https://www.udio.com",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "udio-music",
    label: "Udio Music",
    adapter: "udio_compatible",
    protocolFamily: "udio_music",
    protocolProfile: "udio",
    defaultServiceProviderLabel: "Udio Platform",
    defaultServiceProviderKey: "udio_platform",
    defaultBaseUrl: "https://www.udio.com",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "udio-videos",
    label: "Udio Videos",
    adapter: "udio_compatible",
    protocolFamily: "udio_videos",
    protocolProfile: "udio",
    defaultServiceProviderLabel: "Udio Platform",
    defaultServiceProviderKey: "udio_platform",
    defaultBaseUrl: "https://www.udio.com",
    sourceKind: "web_reverse_api",
    webReverseAccessMode: "browser_challenge",
    defaultExecutionMode: "browser_backed",
    defaultAuthMode: "bearer",
  },
  {
    key: "custom-http",
    label: "Custom HTTP",
    adapter: "custom_http",
    protocolFamily: "openai",
    protocolProfile: "custom",
    sourceKind: "aggregator_api",
    defaultExecutionMode: "direct_http",
    defaultAuthMode: "bearer",
  },
];

function uniqueOptions(items: Array<{ value: string; label: string }>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.value)) {
      return false;
    }
    seen.add(item.value);
    return true;
  });
}

export const PROVIDER_CREATE_ADAPTER_OPTIONS = uniqueOptions(
  PROVIDER_CREATE_HTTP_SPECS.map((spec) => ({
    value: spec.adapter,
    label: spec.adapter,
  })),
);

export const PROVIDER_CREATE_PROTOCOL_FAMILY_OPTIONS = uniqueOptions(
  PROVIDER_CREATE_HTTP_SPECS.map((spec) => ({
    value: spec.protocolFamily,
    label: spec.protocolFamily,
  })),
);

export const PROVIDER_CREATE_PROTOCOL_PROFILE_OPTIONS = uniqueOptions(
  PROVIDER_CREATE_HTTP_SPECS.map((spec) => ({
    value: spec.protocolProfile,
    label: spec.protocolProfile,
  })),
);

export const PROVIDER_CREATE_AUTH_MODE_OPTIONS = [
  { value: "default", label: "按适配器默认" },
  { value: "bearer", label: "Authorization: Bearer" },
  { value: "x-api-key", label: "x-api-key" },
  { value: "api-key", label: "api-key" },
  { value: "x-goog-api-key", label: "X-Goog-Api-Key" },
  { value: "none", label: "无鉴权" },
] as const;

const DEFAULT_PROVIDER_CREATE_SPEC = PROVIDER_CREATE_HTTP_SPECS[0];

export function getProviderCreateDefaults(
  adapter: string | null | undefined,
  protocolFamily: string | null | undefined,
  protocolProfile?: string | null | undefined,
) {
  const normalizedAdapter = (adapter ?? "").trim();
  const normalizedProtocolFamily = (protocolFamily ?? "").trim();
  const normalizedProtocolProfile = (protocolProfile ?? "").trim();

  return (
    PROVIDER_CREATE_HTTP_SPECS.find(
      (spec) =>
        spec.adapter === normalizedAdapter &&
        spec.protocolFamily === normalizedProtocolFamily &&
        spec.protocolProfile === normalizedProtocolProfile,
    ) ??
    PROVIDER_CREATE_HTTP_SPECS.find(
      (spec) =>
        spec.adapter === normalizedAdapter &&
        spec.protocolProfile === normalizedProtocolProfile,
    ) ??
    PROVIDER_CREATE_HTTP_SPECS.find(
      (spec) =>
        spec.adapter === normalizedAdapter &&
        spec.protocolFamily === normalizedProtocolFamily,
    ) ??
    PROVIDER_CREATE_HTTP_SPECS.find(
      (spec) => spec.protocolProfile === normalizedProtocolProfile,
    ) ??
    PROVIDER_CREATE_HTTP_SPECS.find((spec) => spec.adapter === normalizedAdapter) ??
    PROVIDER_CREATE_HTTP_SPECS.find(
      (spec) => spec.protocolFamily === normalizedProtocolFamily,
    ) ??
    DEFAULT_PROVIDER_CREATE_SPEC
  );
}

export function isSupportedProviderCreateAdapter(adapter: string | null | undefined) {
  const normalizedAdapter = (adapter ?? "").trim();
  return PROVIDER_CREATE_HTTP_SPECS.some((spec) => spec.adapter === normalizedAdapter);
}

export function isSupportedProviderCreateProtocolFamily(protocolFamily: string | null | undefined) {
  const normalizedProtocolFamily = (protocolFamily ?? "").trim();
  return PROVIDER_CREATE_HTTP_SPECS.some((spec) => spec.protocolFamily === normalizedProtocolFamily);
}

const QWEN_CODING_PLAN_PROTOCOL_PROFILES = new Set([
  "qwen_coding_plan_openai",
  "qwen_coding_plan_anthropic",
]);

export function getProviderCredentialOperatorWarning(
  protocolProfile: string | null | undefined,
  credential: Record<string, unknown> | null | undefined,
) {
  const normalizedProfile = (protocolProfile ?? "").trim();
  if (!QWEN_CODING_PLAN_PROTOCOL_PROFILES.has(normalizedProfile)) {
    return null;
  }
  const rawApiKey = typeof credential?.apiKey === "string" ? credential.apiKey.trim() : "";
  if (!rawApiKey) {
    return null;
  }
  if (rawApiKey.startsWith("sk-sp-")) {
    return null;
  }
  if (rawApiKey.startsWith("sk-")) {
    return "检测到当前 Coding Plan 凭证仍是 generic `sk-...` 形态；官方文档当前描述的 dedicated key 为 `sk-sp-...`。同时官方文档当前把套餐额度限定在交互式 AI 编程工具中，并明确不支持 curl/Postman/Dify/自定义应用程序后端等 API/后端调用场景；当前 gateway lane 应按 provider unsupported 理解。";
  }
  return "检测到当前 Coding Plan 凭证未呈现官方文档描述的 dedicated `sk-sp-...` 形态。官方文档当前还把套餐额度限定在交互式 AI 编程工具中，并明确不支持 curl/Postman/Dify/自定义应用程序后端等 API/后端调用场景；当前 gateway lane 应按 provider unsupported 理解。";
}

export function appendProviderCredentialOperatorWarningMessage(
  baseMessage: string,
  protocolProfile: string | null | undefined,
  credential: Record<string, unknown> | null | undefined,
) {
  const warning = getProviderCredentialOperatorWarning(protocolProfile, credential);
  if (!warning) {
    return baseMessage;
  }
  return `${baseMessage} 注意：${warning}`;
}

export function isSupportedProviderCreateProtocolProfile(
  protocolProfile: string | null | undefined,
) {
  const normalizedProtocolProfile = (protocolProfile ?? "").trim();
  return PROVIDER_CREATE_HTTP_SPECS.some(
    (spec) => spec.protocolProfile === normalizedProtocolProfile,
  );
}

export function resolveProviderCreateAuthMode(
  adapter: string | null | undefined,
  protocolFamily: string | null | undefined,
  protocolProfile: string | null | undefined,
  authMode: string | null | undefined,
) {
  const normalizedAuthMode = (authMode ?? "").trim();
  if (normalizedAuthMode && normalizedAuthMode !== "default") {
    return normalizedAuthMode;
  }
  return getProviderCreateDefaults(adapter, protocolFamily, protocolProfile).defaultAuthMode;
}
