import assert from "node:assert/strict";
import test, { describe, it } from "node:test";

import {
  gatewayProtocolFamilies,
  gatewayProtocolProfiles,
  gatewayProviderAdapters,
} from "@neuro/contracts";

import {
  appendProviderCredentialOperatorWarningMessage,
  getProviderCredentialOperatorWarning,
  getProviderCreateDefaults,
  PROVIDER_CREATE_HTTP_SPECS,
} from "./provider-create-catalog";

function requireSpec(key: string) {
  const spec = PROVIDER_CREATE_HTTP_SPECS.find((item) => item.key === key);
  assert.ok(spec, `missing provider-create-catalog spec: ${key}`);
  return spec;
}

test("provider create catalog stays inside the public gateway contracts", () => {
  const adapters = new Set<string>(gatewayProviderAdapters);
  const protocolFamilies = new Set<string>(gatewayProtocolFamilies);
  const protocolProfiles = new Set<string>(gatewayProtocolProfiles);

  const missingAdapters = PROVIDER_CREATE_HTTP_SPECS
    .map((spec) => spec.adapter)
    .filter((value, index, values) => values.indexOf(value) === index)
    .filter((value) => !adapters.has(value));
  const missingProtocolFamilies = PROVIDER_CREATE_HTTP_SPECS
    .map((spec) => spec.protocolFamily)
    .filter((value, index, values) => values.indexOf(value) === index)
    .filter((value) => !protocolFamilies.has(value));
  const missingProtocolProfiles = PROVIDER_CREATE_HTTP_SPECS
    .map((spec) => spec.protocolProfile)
    .filter((value, index, values) => values.indexOf(value) === index)
    .filter((value) => !protocolProfiles.has(value));

  assert.deepEqual(missingAdapters, []);
  assert.deepEqual(missingProtocolFamilies, []);
  assert.deepEqual(missingProtocolProfiles, []);
});

test("provider create catalog exposes Accio web reverse api line", () => {
  const spec = PROVIDER_CREATE_HTTP_SPECS.find((entry) => entry.adapter === "accio_compatible");

  assert.ok(spec, "expected accio_compatible create spec");
  assert.equal(spec?.key, "accio-web-reverse-api");
  assert.equal(spec?.label, "Accio Web Reverse API");
  assert.equal(spec?.protocolProfile, "accio");
  assert.equal(spec?.sourceKind, "web_reverse_api");
  assert.equal(spec?.webReverseAccessMode, "direct_http_replay");
  assert.equal(spec?.defaultExecutionMode, "direct_http");
  assert.equal(spec?.defaultAuthMode, "none");
});

test("provider create catalog exposes NVIDIA and Grok canonical lines", () => {
  const nvidia = requireSpec("nvidia-openai");
  assert.equal(nvidia.protocolProfile, "nvidia");
  assert.equal(nvidia.adapter, "openai_compatible");
  assert.equal(nvidia.defaultServiceProviderKey, "nvidia_platform");
  assert.equal(nvidia.defaultServiceProviderLabel, "NVIDIA OpenAI-compatible");
  assert.equal(nvidia.sourceKind, "official_vendor_api");
  assert.equal(nvidia.defaultExecutionMode, "direct_http");
  assert.equal(nvidia.defaultAuthMode, "bearer");
  assert.equal(nvidia.defaultBaseUrl, "https://integrate.api.nvidia.com/v1");

  const grok = requireSpec("grok-web-reverse-api");
  assert.equal(grok.protocolProfile, "grok_web");
  assert.equal(grok.adapter, "grok_compatible");
  assert.equal(grok.defaultServiceProviderKey, "grok_platform");
  assert.equal(grok.defaultServiceProviderLabel, "Grok Web");
  assert.equal(grok.sourceKind, "web_reverse_api");
  assert.equal(grok.webReverseAccessMode, "direct_http_replay");
  assert.equal(grok.defaultExecutionMode, "direct_http");
  assert.equal(grok.defaultAuthMode, "none");
  assert.equal(grok.defaultBaseUrl, "https://grok.com");
  assert.equal(grok.defaultPayloadPatch?.chatCompletionsPath, "/rest/app-chat/conversations/new");
  assert.deepEqual(grok.defaultPayloadPatch?.sessionAuth, {
    transport: "cookie",
    primaryCookieName: "sso",
    secondaryCookieName: "sso-rw",
  });
});

test("media web reverse provider-create-catalog entries expose canonical platform surfaces", () => {
  for (const key of ["suno-images", "suno-music", "suno-videos"]) {
    const spec = requireSpec(key);
    assert.equal(spec.adapter, "suno_compatible");
    assert.equal(spec.protocolProfile, "suno");
    assert.equal(spec.defaultServiceProviderKey, "suno_platform");
    assert.equal(spec.defaultServiceProviderLabel, "Suno Platform");
    assert.equal(spec.defaultBaseUrl, "https://suno.com");
    assert.equal(spec.sourceKind, "web_reverse_api");
    assert.equal(spec.webReverseAccessMode, "browser_challenge");
    assert.equal(spec.defaultExecutionMode, "browser_backed");
    assert.equal(spec.defaultAuthMode, "bearer");
  }

  for (const key of ["udio-images", "udio-music", "udio-videos"]) {
    const spec = requireSpec(key);
    assert.equal(spec.adapter, "udio_compatible");
    assert.equal(spec.protocolProfile, "udio");
    assert.equal(spec.defaultServiceProviderKey, "udio_platform");
    assert.equal(spec.defaultServiceProviderLabel, "Udio Platform");
    assert.equal(spec.defaultBaseUrl, "https://www.udio.com");
    assert.equal(spec.sourceKind, "web_reverse_api");
    assert.equal(spec.webReverseAccessMode, "browser_challenge");
    assert.equal(spec.defaultExecutionMode, "browser_backed");
    assert.equal(spec.defaultAuthMode, "bearer");
  }

  for (const key of ["lumalabs-images", "lumalabs-videos", "lumalabs-audio"]) {
    const spec = requireSpec(key);
    assert.equal(spec.adapter, "lumalabs_compatible");
    assert.equal(spec.protocolProfile, "lumalabs");
    assert.equal(spec.defaultServiceProviderKey, "lumalabs_platform");
    assert.equal(spec.defaultServiceProviderLabel, "LumaLabs Platform");
    assert.equal(spec.defaultBaseUrl, "https://app.lumalabs.ai");
    assert.equal(spec.sourceKind, "web_reverse_api");
    assert.equal(spec.webReverseAccessMode, "browser_challenge");
    assert.equal(spec.defaultExecutionMode, "browser_backed");
    assert.equal(spec.defaultAuthMode, "bearer");
  }
});

test("unfinished official/vendor provider-create-catalog entries expose canonical platform defaults", () => {
  const xai = requireSpec("xai-openai");
  assert.equal(xai.defaultServiceProviderKey, "xai_platform");
  assert.equal(xai.defaultServiceProviderLabel, "xAI Platform");
  assert.equal(xai.defaultBaseUrl, "https://api.x.ai/v1");
  assert.equal(xai.protocolProfile, "xai");
  assert.equal(xai.defaultExecutionMode, "direct_http");

  const perplexityChat = requireSpec("perplexity-chat");
  assert.equal(perplexityChat.defaultServiceProviderKey, "perplexity_platform");
  assert.equal(perplexityChat.defaultServiceProviderLabel, "Perplexity Platform");
  assert.equal(perplexityChat.defaultBaseUrl, "https://api.perplexity.ai");
  assert.equal(perplexityChat.protocolProfile, "perplexity_chat");
  assert.equal(perplexityChat.defaultExecutionMode, "direct_http");

  const xfyunOpenAi = requireSpec("xfyun-openai");
  assert.equal(xfyunOpenAi.defaultServiceProviderKey, "xfyun_platform");
  assert.equal(xfyunOpenAi.defaultServiceProviderLabel, "XFYun Platform");
  assert.equal(xfyunOpenAi.defaultBaseUrl, "https://spark-api-open.xf-yun.com/v1");
  assert.equal(xfyunOpenAi.protocolProfile, "xfyun_openai");
  assert.equal(xfyunOpenAi.defaultExecutionMode, "direct_http");

  const kiro = requireSpec("kiro-compatible");
  assert.equal(kiro.defaultServiceProviderKey, "kiro_platform");
  assert.equal(kiro.defaultServiceProviderLabel, "Kiro Platform");
  assert.equal(kiro.protocolProfile, "kiro");
  assert.equal(kiro.defaultExecutionMode, "direct_http");
});

test("unfinished non-openai provider-create-catalog entries expose canonical defaults", () => {
  const freebuff = requireSpec("freebuff-compatible");
  assert.equal(freebuff.defaultServiceProviderKey, "freebuff_platform");
  assert.equal(freebuff.defaultServiceProviderLabel, "FreeBuff");
  assert.equal(freebuff.defaultBaseUrl, "https://www.codebuff.com");
  assert.equal(freebuff.protocolProfile, "freebuff");

  const xfyunNative = requireSpec("xfyun-native-websocket");
  assert.equal(xfyunNative.defaultServiceProviderKey, "xfyun_platform");
  assert.equal(xfyunNative.defaultServiceProviderLabel, "XFYun Platform");
  assert.equal(xfyunNative.defaultBaseUrl, "wss://spark-api.xf-yun.com/v1.1/chat");
  assert.equal(xfyunNative.protocolProfile, "xfyun_native_websocket");

  for (const key of ["producer-images", "producer-music", "producer-videos"]) {
    const producer = requireSpec(key);
    assert.equal(producer.defaultServiceProviderKey, "producer_platform");
    assert.equal(producer.defaultServiceProviderLabel, "Producer.ai Platform");
    assert.equal(producer.defaultBaseUrl, "https://www.flowmusic.app");
    assert.equal(producer.protocolProfile, "producer");
  }
});

describe("provider create catalog", () => {
  it("returns ChatAIBot image defaults aligned with the runtime preset", () => {
    const defaults = getProviderCreateDefaults(
      "chataibot_compatible",
      "chataibot_images",
      "chataibot",
    );

    assert.equal(defaults.key, "chataibot-images");
    assert.equal(defaults.defaultServiceProviderKey, "chataibot_platform");
    assert.equal(defaults.defaultServiceProviderLabel, "ChatAIBot");
    assert.equal(defaults.defaultBaseUrl, "https://chataibot.pro");
    assert.equal(defaults.webReverseAccessMode, "direct_http_replay");
    assert.equal(defaults.defaultExecutionMode, "direct_http");

    assert.deepEqual(defaults.defaultPayloadPatch, {
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
    });
  });
});

test("Qwen provider-create-catalog entries expose the four canonical surfaces", () => {
  const dashscope = requireSpec("qwen-dashscope-openai");
  assert.equal(dashscope.protocolProfile, "qwen_dashscope_openai");
  assert.equal(dashscope.adapter, "openai_compatible");
  assert.equal(dashscope.sourceKind, "official_model_api");
  assert.equal(dashscope.defaultExecutionMode, "direct_http");
  assert.equal(dashscope.defaultAuthMode, "bearer");
  assert.equal(dashscope.defaultBaseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
  assert.deepEqual(dashscope.defaultPayloadPatch, {
    chatCompletionsPath: "/chat/completions",
    responsesPath: "/responses",
  });

  const codingOpenAi = requireSpec("qwen-coding-plan-openai");
  assert.equal(codingOpenAi.protocolProfile, "qwen_coding_plan_openai");
  assert.equal(codingOpenAi.adapter, "openai_compatible");
  assert.equal(codingOpenAi.sourceKind, "official_model_api");
  assert.equal(codingOpenAi.defaultExecutionMode, "direct_http");
  assert.equal(codingOpenAi.defaultAuthMode, "bearer");
  assert.equal(codingOpenAi.defaultBaseUrl, "https://coding.dashscope.aliyuncs.com/v1");
  assert.deepEqual(codingOpenAi.defaultPayloadPatch, {
    chatCompletionsPath: "/chat/completions",
    responsesPath: "/responses",
  });
  assert.deepEqual(codingOpenAi.defaultCredentialDraft, {
    apiKey: "sk-sp-your-qwen-coding-plan-key",
    credentialMaterialKey: "qwen-official:coding-plan",
    accountName: "coding-plan",
  });
  assert.match(codingOpenAi.credentialHint ?? "", /sk-sp-\.\.\./);
  assert.match(codingOpenAi.credentialHint ?? "", /交互式 AI 编程工具/);

  const codingAnthropic = requireSpec("qwen-coding-plan-anthropic");
  assert.equal(codingAnthropic.protocolProfile, "qwen_coding_plan_anthropic");
  assert.equal(codingAnthropic.adapter, "anthropic_compatible");
  assert.equal(codingAnthropic.protocolFamily, "anthropic");
  assert.equal(codingAnthropic.sourceKind, "official_model_api");
  assert.equal(codingAnthropic.defaultExecutionMode, "direct_http");
  assert.equal(codingAnthropic.defaultAuthMode, "x-api-key");
  assert.equal(
    codingAnthropic.defaultBaseUrl,
    "https://coding.dashscope.aliyuncs.com/apps/anthropic",
  );
  assert.deepEqual(codingAnthropic.defaultCredentialDraft, {
    apiKey: "sk-sp-your-qwen-coding-plan-key",
    credentialMaterialKey: "qwen-official:coding-plan",
    accountName: "coding-plan",
  });
  assert.match(codingAnthropic.credentialHint ?? "", /sk-sp-\.\.\./);
  assert.match(codingAnthropic.credentialHint ?? "", /provider unsupported/);

  const web = requireSpec("qwen-web-chat");
  assert.equal(web.protocolProfile, "qwen_web_chat");
  assert.equal(web.adapter, "qwen_web_compatible");
  assert.equal(web.sourceKind, "web_reverse_api");
  assert.equal(web.webReverseAccessMode, "direct_http_replay");
  assert.equal(web.defaultExecutionMode, "direct_http");
  assert.equal(web.defaultAuthMode, "bearer");
  assert.equal(web.defaultBaseUrl, "https://chat.qwen.ai");
  assert.equal(web.defaultPayloadPatch?.chatCompletionsPath, "/api/v2/chat/completions");
  const headers = (web.defaultPayloadPatch?.headers ?? {}) as Record<string, string>;
  assert.equal(headers.Accept, "application/json");
  assert.equal(headers.source, "web");
  const sessionAuth = (web.defaultPayloadPatch?.sessionAuth ?? {}) as Record<string, string>;
  assert.equal(sessionAuth.transport, "bearer");
  assert.equal(sessionAuth.headerName, "authorization");
});

test("Qwen Coding Plan generic sk keys surface operator warning", () => {
  assert.match(
    getProviderCredentialOperatorWarning("qwen_coding_plan_openai", {
      apiKey: "sk-generic-coding-plan-key",
    }) ?? "",
    /sk-sp-\.\.\./,
  );
  assert.match(
    getProviderCredentialOperatorWarning("qwen_coding_plan_anthropic", {
      apiKey: "sk-generic-coding-plan-key",
    }) ?? "",
    /provider unsupported/,
  );
  assert.equal(
    getProviderCredentialOperatorWarning("qwen_coding_plan_openai", {
      apiKey: "sk-sp-dedicated-coding-plan-key",
    }),
    null,
  );
  assert.equal(
    getProviderCredentialOperatorWarning("qwen_dashscope_openai", {
      apiKey: "sk-generic-dashscope-key",
    }),
    null,
  );
  assert.match(
    appendProviderCredentialOperatorWarningMessage(
      "已创建凭证 Credential A。",
      "qwen_coding_plan_openai",
      {
        apiKey: "sk-generic-coding-plan-key",
      },
    ),
    /注意：.*provider unsupported/,
  );
  assert.equal(
    appendProviderCredentialOperatorWarningMessage(
      "已创建凭证 Credential A。",
      "qwen_coding_plan_openai",
      {
        apiKey: "sk-sp-dedicated-coding-plan-key",
      },
    ),
    "已创建凭证 Credential A。",
  );
});

test("official API provider-create-catalog entries expose canonical service provider defaults", () => {
  const azure = requireSpec("azure-openai");
  assert.equal(azure.protocolProfile, "azure_openai");
  assert.equal(azure.defaultServiceProviderKey, "azure_openai_platform");
  assert.equal(azure.defaultServiceProviderLabel, "Azure OpenAI");
  assert.equal(azure.defaultAuthMode, "api-key");
  assert.equal(azure.defaultBaseUrl, "https://your-resource.openai.azure.com/openai/v1");

  const anthropic = requireSpec("anthropic-compatible");
  assert.equal(anthropic.protocolProfile, "anthropic");
  assert.equal(anthropic.defaultServiceProviderKey, "anthropic_platform");
  assert.equal(anthropic.defaultServiceProviderLabel, "Anthropic Messages");
  assert.equal(anthropic.defaultAuthMode, "x-api-key");
  assert.equal(anthropic.defaultBaseUrl, "https://api.anthropic.com");

  const bedrock = requireSpec("bedrock-converse");
  assert.equal(bedrock.protocolProfile, "aws_bedrock");
  assert.equal(bedrock.defaultServiceProviderKey, "aws_bedrock_platform");
  assert.equal(bedrock.defaultServiceProviderLabel, "AWS Bedrock Converse");
  assert.equal(bedrock.defaultAuthMode, "bearer");
  assert.equal(bedrock.defaultBaseUrl, "https://bedrock-runtime.us-east-1.amazonaws.com");

  const cohere = requireSpec("cohere-chat");
  assert.equal(cohere.protocolProfile, "cohere");
  assert.equal(cohere.defaultServiceProviderKey, "cohere_platform");
  assert.equal(cohere.defaultServiceProviderLabel, "Cohere Chat");
  assert.equal(cohere.defaultAuthMode, "bearer");
  assert.equal(cohere.defaultBaseUrl, "https://api.cohere.com");
});

test("wave4 openai-compatible provider-create-catalog entries expose canonical defaults", () => {
  const groq = requireSpec("groq-openai");
  assert.equal(groq.protocolProfile, "groq");
  assert.equal(groq.defaultServiceProviderKey, "groq_platform");
  assert.equal(groq.defaultServiceProviderLabel, "Groq OpenAI-compatible");
  assert.equal(groq.sourceKind, "official_vendor_api");
  assert.equal(groq.defaultAuthMode, "bearer");
  assert.equal(groq.defaultBaseUrl, "https://api.groq.com/openai/v1");

  const together = requireSpec("together-openai");
  assert.equal(together.protocolProfile, "together");
  assert.equal(together.defaultServiceProviderKey, "together_platform");
  assert.equal(together.defaultServiceProviderLabel, "Together OpenAI-compatible");
  assert.equal(together.sourceKind, "aggregator_api");
  assert.equal(together.aggregatorApiMode, "hosted_compute");
  assert.equal(together.defaultAuthMode, "bearer");
  assert.equal(together.defaultBaseUrl, "https://api.together.xyz/v1");

  const openrouter = requireSpec("openrouter-openai");
  assert.equal(openrouter.protocolProfile, "openrouter");
  assert.equal(openrouter.defaultServiceProviderKey, "openrouter_platform");
  assert.equal(openrouter.defaultServiceProviderLabel, "OpenRouter OpenAI-compatible");
  assert.equal(openrouter.sourceKind, "aggregator_api");
  assert.equal(openrouter.aggregatorApiMode, "upstream_forward");
  assert.equal(openrouter.defaultAuthMode, "bearer");
  assert.equal(openrouter.defaultBaseUrl, "https://openrouter.ai/api");

  const deepseek = requireSpec("deepseek-openai");
  assert.equal(deepseek.protocolProfile, "deepseek");
  assert.equal(deepseek.defaultServiceProviderKey, "deepseek_platform");
  assert.equal(deepseek.defaultServiceProviderLabel, "DeepSeek OpenAI-compatible");
  assert.equal(deepseek.sourceKind, "official_model_api");
  assert.equal(deepseek.defaultAuthMode, "bearer");
  assert.equal(deepseek.defaultBaseUrl, "https://api.deepseek.com");

  const mistral = requireSpec("mistral-openai");
  assert.equal(mistral.protocolProfile, "mistral");
  assert.equal(mistral.defaultServiceProviderKey, "mistral_platform");
  assert.equal(mistral.defaultServiceProviderLabel, "Mistral OpenAI-compatible");
  assert.equal(mistral.sourceKind, "official_model_api");
  assert.equal(mistral.defaultAuthMode, "bearer");
  assert.equal(mistral.defaultBaseUrl, "https://api.mistral.ai");
});

test("search family provider-create-catalog entries expose canonical defaults", () => {
  const perplexity = requireSpec("perplexity-search");
  assert.equal(perplexity.protocolProfile, "perplexity_search");
  assert.equal(perplexity.defaultServiceProviderKey, "perplexity_platform");
  assert.equal(perplexity.defaultServiceProviderLabel, "Perplexity Search");
  assert.equal(perplexity.defaultBaseUrl, "https://api.perplexity.ai");
  assert.deepEqual(perplexity.defaultPayloadPatch, {
    searchPath: "/search",
    searchQueryField: "query",
  });

  const tavily = requireSpec("tavily-search");
  assert.equal(tavily.protocolProfile, "tavily");
  assert.equal(tavily.defaultServiceProviderKey, "tavily_platform");
  assert.equal(tavily.defaultBaseUrl, "https://api.tavily.com");
  assert.deepEqual(tavily.defaultPayloadPatch, {
    searchPath: "/search",
    searchQueryField: "query",
  });

  const exa = requireSpec("exa-search");
  assert.equal(exa.protocolProfile, "exa");
  assert.equal(exa.defaultServiceProviderKey, "exa_platform");
  assert.equal(exa.defaultBaseUrl, "https://api.exa.ai");
  assert.deepEqual(exa.defaultPayloadPatch, {
    searchPath: "/search",
    fetchPath: "/contents",
    searchQueryField: "query",
    fetchUrlsField: "urls",
  });

  const jinaSearch = requireSpec("jina-search");
  assert.equal(jinaSearch.protocolProfile, "jina_search");
  assert.equal(jinaSearch.defaultServiceProviderKey, "jina_platform");
  assert.equal(jinaSearch.defaultBaseUrl, "https://s.jina.ai");
  assert.deepEqual(jinaSearch.defaultPayloadPatch, {
    searchPath: "/search",
    searchQueryField: "q",
    headers: {
      Accept: "application/json",
    },
  });

  const jinaReader = requireSpec("jina-reader");
  assert.equal(jinaReader.protocolProfile, "jina_reader");
  assert.equal(jinaReader.defaultServiceProviderKey, "jina_platform");
  assert.equal(jinaReader.defaultBaseUrl, "https://r.jina.ai");
  assert.deepEqual(jinaReader.defaultPayloadPatch, {
    fetchPath: "/",
    fetchUrlsField: "url",
    headers: {
      Accept: "application/json",
    },
  });

  const linkup = requireSpec("linkup-search");
  assert.equal(linkup.protocolProfile, "linkup");
  assert.equal(linkup.defaultServiceProviderKey, "linkup_platform");
  assert.equal(linkup.defaultBaseUrl, "https://api.linkup.so");
  assert.deepEqual(linkup.defaultPayloadPatch, {
    searchPath: "/v1/search",
    fetchPath: "/v1/fetch",
    researchPath: "/v1/research",
    balancePath: "/v1/credits/balance",
  });

  const you = requireSpec("you-search");
  assert.equal(you.protocolProfile, "you_search");
  assert.equal(you.defaultServiceProviderKey, "you_platform");
  assert.equal(you.defaultAuthMode, "x-api-key");
  assert.equal(you.defaultBaseUrl, "https://api.ydc-index.io");
  assert.deepEqual(you.defaultPayloadPatch, {
    searchPath: "/v1/search",
    searchQueryField: "query",
    authHeaderName: "X-API-Key",
  });

  const websearchapi = requireSpec("websearchapi-search");
  assert.equal(websearchapi.protocolProfile, "websearchapi");
  assert.equal(websearchapi.defaultServiceProviderKey, "websearchapi_platform");
  assert.equal(websearchapi.defaultBaseUrl, "https://api.websearchapi.ai");
  assert.deepEqual(websearchapi.defaultPayloadPatch, {
    searchPath: "/ai-search",
    searchQueryField: "query",
  });

  const legacyLinkup = requireSpec("linkup-compatible-legacy");
  assert.equal(legacyLinkup.protocolProfile, "linkup");
  assert.equal(legacyLinkup.adapter, "linkup_compatible");
  assert.equal(legacyLinkup.defaultServiceProviderKey, "linkup_platform");
  assert.equal(legacyLinkup.defaultBaseUrl, "https://api.linkup.so");
});
