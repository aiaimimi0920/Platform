# AI 网关平台、实现线、Surface 与能力总表

## 目的

本文档用于把当前 Rust `gateway/` 中已经存在的：

1. 目标平台
2. 实现线
3. operator 可见 surface
4. 主要能力面
5. 当前状态

收口成一份总表与阅读地图。

它的目标不是替代各 provider 专题文档，而是提供一个统一索引，避免后续继续把：

- 平台
- 实现线
- surface
- 能力面
- 执行模式

混成一句“这个平台已经做完/没做完”。

---

## 1. 当前推荐读法

当前 AI 网关建议固定按下面五层主结构理解：

1. `service provider identity`
2. `implementation line`
3. `provider surface`
4. `capability / endpoint family`
5. `provider credential row`

同时每次请求还叠加以下并行维度：

1. `protocol family`
2. `protocol profile`
3. `execution mode`
4. `credential material kind`
5. `platform access layer`

这意味着：

- “多平台”是对的
- “每个平台下有多条实现线”也是对的
- 但每条实现线下还必须继续区分：
  - 它暴露了哪些 surface
  - 每个 surface 主要承接哪些能力面
  - 最终走 `direct_http` 还是 `browser_backed`

---

## 2. 当前能力面基线

当前仓库中常用的能力面，不建议只粗写成“文本/图片/音频/视频/搜索”，而应优先按下面粒度理解：

### 2.1 对话 / 文本类

- `chat_completions`
- `responses`
- `messages`
- `completions`
- `live`
- `realtime`

### 2.2 图片类

- `images_generations`
- `images_edits`

### 2.3 音频类

- `audio_transcriptions`
- `audio_speech`

### 2.4 音乐类

- `music_generations`

### 2.5 视频类

- `videos_generations`

### 2.6 搜索 / 研究类

- `search`
- `fetch`
- `research_create`
- `research_list`
- `research_get`
- `credits_balance`

### 2.7 其他非对话能力

- `embeddings`
- `models`
- `tools`

补充约束：

- `music` 当前作为独立能力面理解，不应直接并回 `audio`
- `audio` 当前至少继续拆成：
  - `transcriptions`
  - `speech`
- `search` 当前也不是一个单点，而是一组 search / fetch / research family

---

## 3. 当前状态标签

本文统一使用下面四类状态：

### 3.1 `已通过`

表示：

- 当前 canonical 文档中已有明确通过结论
- 且当前仓库内仍可找到对应验收归档或明确指向的结果材料

### 3.2 `范围内已完成，仍在演进`

表示：

- 当前正式 scope 内已经成立
- 但仍有正在推进的实现线增强任务
- 不应误读成“这一条线已经没有任何后续工作”

### 3.3 `部分覆盖`

表示：

- 平台 / 实现线 / surface 已经存在
- 但 canonical 文档、专题下沉、严格验收、或能力面结论仍未完全收口

### 3.4 `待专题化`

表示：

- operator create catalog 与代码中已经存在相关入口或实现
- 但新的 canonical 文档体系尚未把该平台单独下沉成更完整专题

---

## 4. 当前总览结论

截至当前仓库状态，可先记住下面三条：

1. 当前 operator create catalog 中已存在 `57` 个模板项，可折成约 `39` 个可见 provider group
2. 当前真正拿到最清晰“正式通过”结论的主平台，是 `Gemini Platform`
3. 当前仍需明确继续补齐的，不只是“新平台”，还有：
   - backend 已存在线但未 operator 暴露的实现线
   - 已存在平台但尚未专题化 / 严格验收化的实现线

---

## 5. 平台总表

下表优先按“平台级”组织，而不是按单条模板 key 平铺。

| 平台 / 入口 | 当前 operator 可见模板 | 当前主要实现线 | 当前主要 surface / 入口 | 当前主要能力面 | 当前状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `Gemini Platform` | `gemini-api` / `vertex-gemini` / `gemini-web-chat` / `gemini-canvas-*` / `gemini-business-images` | `official_api` / `official_vendor_api` / `web_reverse` / `canvas_web_reverse` | `google-gemini-api` / `gemini-web-chat` / `gemini-canvas-images` / `gemini-canvas-music` / `gemini-canvas-videos` | 文本、`models`、`TTS`、图片、音乐、视频、`embeddings` | 三条主线 `已通过`，`gemini_business` 仍未与三主线同级收口 | 当前最成熟的平台家族 |
| `AI Studio Platform` | `aistudio-web-reverse` | `web_reverse` | `AIStudio Web Reverse` | 当前正式 scope = `text` / `models` / `tools` / `embeddings` / `TTS` / `images` | `范围内已完成，仍在演进` | 当前仍在推进文本热路径 pure-http 默认化 |
| `Qwen Platform` | `qwen-dashscope-openai` / `qwen-coding-plan-openai` / `qwen-coding-plan-anthropic` / `qwen-web-chat` | `official_api` / `web_reverse` | DashScope OpenAI、Coding Plan OpenAI、Coding Plan Anthropic、Qwen WebUI Replay | 对话 / 文本优先 | `部分覆盖` | 线已分出，但 canonical 专题仍不完整 |
| `ChatGPT Platform` | `chatgpt-web-reverse` | `web_reverse` | `chatgpt-web-reverse` | 对话 / 文本优先 | `web_reverse 已通过，平台整体部分覆盖` | 2026-05-29 已完成 EasyRegister `failed-twice` 最终 10 凭证改造、导入 Rust gateway 凭证库与 `/v1/chat/completions` / `/v1/responses` live；逐凭证询问 `法国的首都在哪里` 均返回 `巴黎` / `Paris`；2026-05-30 已补 browserless OAuth refresh 代码路径，但当前 `failed-twice` batch 无 `refreshToken`，旧 `code+verifier` probe 返回 `400 token_exchange_user_error`，refresh live 仍需新采集含 `refreshToken` 的凭证；`chatgpt_codex_backend` 当前仍是特殊兼容线，不是独立 operator 模板 |
| `OpenAI Platform` | `openai-platform` | `official_api` | OpenAI Platform | OpenAI family 对话入口优先 | `部分覆盖` | 当前与 ChatGPT 家族一起理解，但 formal provider 专题未单独收口 |
| `Azure OpenAI` | `azure-openai` | `official_vendor_api` | Azure OpenAI | OpenAI family 对话入口优先 | `已通过` | 已建立实现线专题；同一条线同时 owner `/openai/v1` 与 legacy deployment-path variant；latest-head live 已使用真实 customer-managed Azure 资源与真实 key 打到官方 data-plane，其中文本入口按 provider external gate accepted 收口 |
| `Anthropic Messages` | `anthropic-compatible` | `official_model_api` | Anthropic Messages | 对话 / 文本优先 | `已通过` | 已建立实现线专题；当前是 anthropic-compatible official family 的 canonical first-class reference；latest-head live 按 quota gate accepted 收口 |
| `AWS Bedrock Converse` | `bedrock-converse` | `official_model_api` | Bedrock Converse | 对话 / 文本优先 | `已通过` | 已建立实现线专题；本轮已升成 dedicated bedrock-converse family-common；latest-head live 按 provider external gate accepted 收口 |
| `Cohere Chat` | `cohere-chat` | `official_model_api` | Cohere Chat | 对话 / 文本优先 | `已通过` | 已建立实现线专题；当前 canonical key 固定为 `cohere_chat` 并已升成 dedicated family-common；latest-head live 已绿 |
| `Groq OpenAI-compatible` | `groq-openai` | `official_vendor_api` | Groq OpenAI-compatible | 对话 / 文本优先 | `已通过` | wave-4 已补 line manifest、line feature、专题文档、focused verify 与 fixture；本轮已在真实 console 完成 Turnstile 解锁并创建官方 key，latest-head live 当前已绿 |
| `Together OpenAI-compatible` | `together-openai` | `aggregator_api` | Together OpenAI-compatible | 对话 / 文本优先 | `已通过` | wave-4 已把 canonical line 统一为 aggregator_api，并补齐 manifest / docs / live suite owner；latest-head live 当前按 provider external gate accepted 收口 |
| `OpenRouter OpenAI-compatible` | `openrouter-openai` | `aggregator_api` | OpenRouter OpenAI-compatible | 对话 / 文本优先 | `已通过` | wave-4 已把 canonical line 统一为 aggregator_api，并补齐 manifest / docs / live suite owner；latest-head live 当前按 quota gate accepted 收口 |
| `DeepSeek OpenAI-compatible` | `deepseek-openai` | `official_model_api` | DeepSeek OpenAI-compatible | 对话 / 文本优先 | `已通过` | wave-4 已补 line manifest、专题文档、focused verify 与 fixture；latest-head live 已收口，其中 chat/completions 当前按 quota gate accepted 记账，`/v1/responses` 当前按服务商不支持记录 |
| `Mistral OpenAI-compatible` | `mistral-openai` | `official_model_api` | Mistral OpenAI-compatible | 对话 / 文本优先 | `已通过` | wave-4 已补 line manifest、专题文档、focused verify 与 fixture；latest-head live 已收口，其中 `/v1/responses` 当前按服务商不支持记录 |
| `xAI OpenAI-compatible` | `xai-openai` | `official_vendor_api` | xAI OpenAI-compatible | 对话 / 文本优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 credential docs；`xai` fixture wiring 已有；live 待真实 key |
| `Perplexity Chat` | `perplexity-chat` | `official_vendor_api` | Perplexity Chat | 对话 / 文本优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 credential docs；与 `perplexity-search` 分开理解；live 待真实 key |
| `Perplexity Search` | `perplexity-search` | `official_vendor_api` | Perplexity Search | 搜索 / 研究优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 fixture suite；`2026-05-28` 隔离 runtime fresh fixture `1 / 1 pass`；live 待补 |
| `Tavily Search` | `tavily-search` | `official_vendor_api` | Tavily Search | 搜索 / 研究优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 fixture suite；`2026-05-28` 隔离 runtime fresh fixture `1 / 1 pass`；live 待补 |
| `Exa Search` | `exa-search` | `official_vendor_api` | Exa Search | 搜索 / 研究优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 fixture suite；`2026-05-28` 隔离 runtime fresh fixture `2 / 2 pass`；live 待补 |
| `Jina Search` | `jina-search` | `official_vendor_api` | Jina Search | 搜索 / 研究优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 fixture suite；`2026-05-28` 隔离 runtime fresh fixture `1 / 1 pass`；live 待补 |
| `Jina Reader` | `jina-reader` | `official_vendor_api` | Jina Reader | 搜索 / 读取优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 fixture suite；`2026-05-28` 隔离 runtime fresh fixture `1 / 1 pass`；live 待补 |
| `Linkup Search` | `linkup-search` | `official_vendor_api` | Linkup Search | 搜索 / 研究优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 fixture suite；`2026-05-28` 隔离 runtime fresh fixture `2 / 2 pass`；live 待补 |
| `You.com Search` | `you-search` | `official_vendor_api` | You.com Search | 搜索 / 研究优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 fixture suite；`2026-05-28` 隔离 runtime fresh fixture `1 / 1 pass`；live 待补 |
| `WebSearchAPI Search` | `websearchapi-search` | `official_vendor_api` | WebSearchAPI Search | 搜索 / 研究优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 fixture suite；`2026-05-28` 隔离 runtime fresh fixture `1 / 1 pass`；live 待补 |
| `FreeBuff` | `freebuff-compatible` | `web_reverse_api` 风格兼容线 | FreeBuff | 对话 / 文本优先 | `部分覆盖` | 已把现有接入基线升级为实现线基线，并补 manifest、feature、credential docs 与 folder sync；fixture wiring 为 `freebuff_glm51`；live 待真实 session/key |
| `XFYun OpenAI-compatible` | `xfyun-openai` | `official_vendor_api` | XFYun OpenAI-compatible | 对话 / 文本优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 credential docs；HTTP OpenAI-compatible 线不替代 native websocket；live 待真实 key |
| `XFYun Native WebSocket` | `xfyun-native-websocket` | `official_vendor_api` | XFYun Native WebSocket | 对话 / 流式优先 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 credential docs；签名材料为 `APPID + APIKey + APISecret`；live 待真实材料 |
| `Producer.ai Platform` | `producer-images` / `producer-music` / `producer-videos` | `web_reverse_api` 风格线 | `producer_images` / `producer_music` / `producer_videos` | 图片、音乐、视频 | `部分覆盖` | 已建立独立专题基线、line feature、manifest 与 credential docs；当前 canonical base URL 为 `https://www.flowmusic.app`；live 依赖真实 session |
| `Suno` | `suno-music`，本轮目标补齐 `suno-images` / `suno-videos` | `web_reverse_api` 风格线 | `suno_images` / `suno_music` / `suno_videos` | 图片、音乐、视频 | `部分覆盖` | 已建立专题基线；正式 send path 按 `browser_backed`，`suno_http_live` 只是 direct HTTP probe；video 受账号 entitlement 影响 |
| `Udio Platform` | `udio-images` / `udio-music` / `udio-videos` | `web_reverse_api` 风格线 | `udio_images` / `udio_music` / `udio_videos` | 图片、音乐、视频 | `部分覆盖` | 已建立专题基线；当前默认 `browser_backed`，live 依赖 cookie / runtimeStateObjectKey / hCaptcha 条件 |
| `LumaLabs` | `lumalabs-images` / `lumalabs-videos` / `lumalabs-audio` | `web_reverse_api` 风格线 | `lumalabs_images` / `lumalabs_videos` / `lumalabs_audio` | 图片、视频、音频 | `部分覆盖` | 已建立专题基线；当前默认 `browser_backed`，live 依赖 `wos-session + realmId`，quota/rate-limit 按 provider external gate 记录 |
| `ChatAIBot Images` | `chataibot-images` | `web_reverse_api` 风格线 | `chataibot_images` | 图片 | `已通过` | 单能力面平台；当前正式只按图片线理解，`generation` live 成功，`edit/merge` 按 provider 明确 free-tier quota gate accepted |
| `Kiro-compatible` | `kiro-compatible` | `official_vendor_api` 风格兼容线 | `kiro` | 对话 / 文本优先 | `部分覆盖` | 已补独立专题基线、credential docs 与 manifest docs path；既有 line feature 为 `line-kiro-official-vendor-api`；live 待真实 bearer/session material |

---

## 6. Generic / 辅助型 operator 入口

这些条目当前存在于 create catalog，但它们不应直接等同于“一个明确业务平台”。

| 入口 | 作用 | 当前状态 |
| --- | --- | --- |
| `openai-compatible` | 通用 OpenAI-compatible 聚合入口 | 保留 |
| `search-compatible` | 通用 Search-compatible 聚合兼容入口 | 保留 |
| `linkup-compatible-legacy` | Linkup 旧别名 / 兼容入口尾项 | 保留 |
| `custom-http` | 自定义 HTTP surface / operator 手工接线入口 | 保留 |

这些入口的价值主要是：

- operator 快速挂接
- 非专题化平台先行接入
- 兼容历史 provider 配置

而不是代替 provider 专题本身。

---

## 7. backend 已存在、但当前还不是 operator 正式 create 模板的线

这一组是当前最值得单独盯住的“缺口”。

| 平台 / 线 | 当前仓库证据 | 当前缺口 |
| --- | --- | --- |
| `Accio` | 已有 `preset`、`protocol`、`quota`、`folder sync`、`provider account` 推断逻辑，当前实现线正式收口为 `web_reverse_api / direct_http_replay` | operator create catalog 已暴露；继续维护 fixture/live 归档 |
| `NVIDIA` | 已有 `nvidia-openai` preset、protocol profile 推断、folder sync 识别、正式 create catalog 模板 | 当前已专题化为 `official_vendor_api` 正式线 |
| `Grok web` | 已有 `grok_compatible` preset、protocol、headers、stage_send / upstream path、正式 create catalog 模板 | 当前已专题化为 `web_reverse_api / direct_http_replay` 正式线 |

补充说明：

- 这三项当前不应被说成“平台完全不存在”
- 更准确的表达是：
  - backend owner 已准备或已存在
  - 但 operator 面尚未完成 create-catalog 暴露与正式收口

---

## 8. 当前最重要的收口判断

如果只是问“还有没有平台需要继续完成”，建议按下面两类区分：

### 8.1 平台 / 实现线硬缺口

优先关注：

- `NVIDIA`
- `Grok web`

其中 `Accio` 已经完成 `web_reverse_api / direct_http_replay` 正式收口；当前真正还属 operator 口径缺口的重点主要剩 `NVIDIA` 与 `Grok web`。

### 8.2 已存在但仍需继续收口的平台

优先关注：

- `AIStudio Web Reverse`
  - 当前重点不是新增平台，而是把一般文本热路径从 browser-backed 继续推进到默认 pure-http steady-state
- `Gemini business`
  - 当前尚未与 Gemini 三条主线达到同级 formal closure
- `Qwen`
- `ChatGPT`
- `OpenRouter`
- `Suno`
- `Udio`
- `LumaLabs`
- `Producer.ai`
- `xAI / Perplexity Chat / FreeBuff / XFYun / Kiro-compatible`
- Search family 与上述原 `待专题化` 项当前均已前移成独立专题基线；live 与更严格验收仍待继续收口

这些当前不应再说成“平台没做”，而应理解成：

- 平台与代码已存在
- 但 canonical 专题、严格验收、或实现线层级结论还没全部收口

---

## 9. 当前实践建议

后续任何“这个平台做没做完”的讨论，建议默认按下面句式表达：

```text
平台：
实现线：
surface：
能力面：
protocol family / profile：
execution mode：
当前状态：
证据：
```

例如：

```text
平台：Gemini Platform
实现线：canvas_web_reverse
surface：gemini-canvas-images
能力面：images_generations
protocol profile：gemini_canvas
execution mode：browser_backed
当前状态：已通过
证据：对应 live / fixture 归档
```

这样可以避免再把：

- `平台是否存在`
- `实现线是否存在`
- `能力是否 caller-visible 成立`
- `是否已经 strict-green`

混成同一句话。

---

## 10. 当前正式结论

当前 AI 网关的正式理解应固定为：

- 它不是“若干平台 + 一堆请求转发”
- 而是一个：
  - 多平台
  - 多实现线
  - 多 surface
  - 多能力面
  - 多协议入口
  - 多执行模式
  的统一路由与执行系统

因此后续一切“完成度”判断，都应优先收口到：

- `平台 + 实现线 + surface + 能力面`

而不是只按平台名做一句抽象结论。
