# AI 网关服务商实现线与 Provider 目录

## 目的

本文档用于吸收 `legacy source: AI-gateway-*`、`legacy source: AI网关*` 中分散的 provider 专题，并先收成一份新的 canonical 目录文档。

它当前不追求替代每一份 provider baseline 的全部细节，而是先固定：

1. 当前有哪些主要服务商
2. 每家服务商有哪些实现线
3. 这些实现线当前更接近：
   - `official_api`
   - `web_reverse`
   - `browser_owned`
   - `program_owned`
4. 哪些旧专题仍然只是参考层

---

## 1. 当前服务商目录的正式理解方式

后续任何服务商文档，默认都先按以下层级理解：

1. `service provider identity`
2. `implementation line`
3. `provider surface`
4. `credential material kind`
5. `route / model / quota domain`

因此本目录的价值，不是列“支持名单”，而是固定“我们如何理解一条 provider 线”。

---

## 2. 当前高优先级服务商目录

### 2.1 Gemini Platform

旧专题来源：

- `Gemini三线路与Canvas派生运行时架构规范.md`
- `Gemini凭证、Bootstrap配置与派生运行时字段分层表.md`

当前实现线目录：

- `official_api`
  - `google_gemini_api`
  - `google_vertex_gemini`
- `official_vendor_api`
  - `gemini_business`
- `web_reverse`
  - `gemini_web`
- `canvas_web_reverse`
  - legacy `gemini_canvas_compatible`
  - historical / deprecated `gemini_canvas_web_reverse_modular`
  - `gemini_canvas_program_web_reverse_modular`

当前正式新落点：

- `docs/20-ai-gateway/AI网关服务商建模与凭证体系.md`
- `docs/20-ai-gateway/AI网关测试与验收总线.md`
- `docs/20-ai-gateway/Gemini三线路与Canvas派生运行时架构规范.md`
- `docs/20-ai-gateway/Gemini凭证、Bootstrap配置与派生运行时字段分层表.md`
- `docs/20-ai-gateway/Gemini三线路正式验收结果-2026-05-15.md`

当前状态：

- `部分覆盖`

说明：

- Gemini 已有清晰的新总线口径
- 但 provider 细节仍大量留在旧专题文档里
- 后续应优先把 Gemini 单独下沉成新的专题子树
- 截至 `2026-05-15` 的当前正式验收结论应补一层区分：
  - `official_api`
    - 已通过
    - 当前沿用既有 `2026-05-09` smoke / fixture 归档
  - `web_reverse`
    - 已通过
    - 当前 fresh line2 `legacy media` 结果：
      - `output/gemini_web_reverse_modular_legacy_media_live-20260515-refresh-v2`
      - `6/6`
  - `canvas_web_reverse`
    - 已通过
    - 当前沿用既有 strict-green baseline：
      - `output/gemini_canvas_program_text_live-20260513-hostfix4-text-v1`
      - `output/gemini_canvas_program_tts_live-20260513-hostfix4-tts-v1`
      - `output/gemini_canvas_program_media_live-20260513-hostfix4-media-v1`
- 当前 `official_api` 这条线已经可以按“正式可运行实现线”理解：
  - canonical owner：
    - `gateway/src/protocol/gemini/api/**`
    - `gateway/src/upstream/gemini/api/**`
  - caller-visible 语义：
    - `text / stream / tts`
    - `image / music / video`
    - `/v1/models`
  - 当前 `google_gemini_api_live` 与 `google_gemini_api_modular_live` 默认都已收窄成最小 smoke：
    - `gemini_generate_content.basic.nonstream`
    - `gemini_generate_content.basic.stream`
    - `oa_chat.basic.nonstream`
    - `oa_responses.basic.nonstream`
    - `oa_audio_speech.basic`
    - `images_generations.image.url`
    - `images_generations.image.b64`
    - `music_generations.music.basic`
    - `videos_generations.video.basic`
    - `oa_models.list.get`
  - 当前 fresh 结果：
    - `output/google_gemini_api_live_smoke_20260509_v3`
      - `10/10`
    - `output/google_gemini_api_modular_live_20260509_v1`
      - `10/10`
    - `output/google_gemini_api_full_fixture_20260509_v1`
      - `45/45`
    - `output/google_gemini_api_modular_full_fixture_20260509_v1`
      - `45/45`
  - 当前 media 语义必须按实现证据区分：
    - `music`
      - 已 caller-visible 成功
      - 当前 official owner 已直接消费远端 ws 的 `serverContent.audioChunks`
    - `video`
      - 当前已命中官方 `predictLongRunning`
      - 默认 request 若未显式给 size/aspect_ratio，official owner 现在按 `16:9` 作为视频默认宽高比
      - 该 live case 当前落在 `quota/plan gate accepted`
    - `image`
      - 当前 live 仍是 `quota/plan gate accepted`
  - 上述 `quota/plan gate accepted` 的含义是：
    - 已命中真实官方端点
    - gateway official owner 已完成
    - 当前缺的是 provider 额度/套餐，而不是协议或实现
  - 当前 `gemini_canvas_program_web_reverse_modular` 的正式理解已经进一步收口：
  - 前半段是 `Canvas app / share / session` bootstrap
  - 后半段是围绕该 `Canvas app` 暴露的 endpoint contract 做调用
  - 它不得再被简化成“generic Gemini Web chat replay + browser-backed prompt execution”
  - 即使后半段 transport 长得像 `generateContent`，owner 语义仍然是 `canvas_web_reverse / program-owned`
  - 截至 `2026-05-12`，`program-owned / no-key` 这条正式线已经重新收口成一套更纯的 `Canvas program interface`：
    - 当前 fresh live 结果：
      - `output/gemini_canvas_program_text_live-20260512-v39r6c-unify4`
        - `5/5`
      - `output/gemini_canvas_program_tts_live-20260512-v39r6c-unify4`
        - `2/2`
      - `output/gemini_canvas_program_media_live-20260512-v39r6c-unify4`
        - `5/5`
    - 当前 caller-visible 已重新打绿的模态：
      - `text`
      - `tts`
      - `image.url`
      - `image.b64`
      - `music`
      - `video`
      - `models`
    - 当前这轮还额外收紧了一个容易混线的点：
      - `program-owned image`
        - 现在已经不再允许：
          - `StreamGenerate` 失败后再退到纯 HTTP `image JSON` lane
        - 也就是说，`image.b64` 当前不再只是“没有 browser relay”
        - 它也不再是：
          - `program contract + JSON bypass`
        - 而是收成了更纯的：
          - `program contract -> asset follow-up -> direct media materialization`
    - 当前 contract 语义必须按“Canvas 程序接口”而不是“网页聊天框”理解：
      - `text`
        - `program-owned direct HTTP StreamGenerate`
        - 若 pure-http contract 不可用，则显式 fail-closed
        - 不再允许 browser-pool preview `/fetch` 充当正式主链
      - `tts`
        - `program-owned direct HTTP TTS`
        - 不再允许 preview/browser relay 作为正式 steady-state
      - `image.url / image.b64`
        - `program-owned direct HTTP image generation + asset follow-up`
        - 当前 `image.b64` 的最终 caller-visible 打绿，依赖：
          - direct HTTP `StreamGenerate` / follow-up 拿到 image asset
          - 再用 direct media materialization path 拉取二进制
        - 它不再回到 preview/browser relay
        - 也不再允许 `image JSON` fallback 绕开 Canvas program contract
      - `music`
        - `program-owned page-owned StreamGenerate + follow-up`
      - `video`
        - `program-owned page-owned StreamGenerate + follow-up`
    - 上述“更纯的 Canvas program interface”指的是：
      - 不走网页聊天输入框提交
      - 不再把 browser submit/browser relay 当正式 steady-state owner
      - 仍然允许基于 app page / program runtime / session-backed page contract 做 pure HTTP replay
    - 对外部参考 `CanvasToAPI` 的最新对照结论也必须继续固定：
      - `CanvasToAPI` 证明的是：
        - `browser relay + browser fetch`
      - 当前本仓 `program-owned / no-key` 最新实现线已经进一步前移成：
        - `browserless pure-http program contract`
      - 因此两者不能再等价理解
  - 当前 `program-owned / no-key` 的最新 capability 结论必须继续分模态理解：
    - `video`
      - 已确认当前正确 no-key 主线不是 `predictLongRunning`
      - 而是 app 页面自己的：
        - `/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`
      - 该合同当前已经被：
        - `storage-state + cookie + SAPISIDHASH`
        - `无浏览器 pure HTTP exact replay`
        caller-visible 复放到：
        - `status = 200`
        - `conversationId / responseId`
        - `video_placeholder`
        - 最终 busy 文本
      - Rust 默认主链当前也已开始接受：
        - `program_video_streamgenerate_candidate`
        - `page_stream_generate_form`
      - 并在“已进入 `video_placeholder / pending / busy` 但还没有真实资产”时返回：
        - `accepted = true`
        - `completed = false`
      - 这表示：
        - `video` 已经不是“必须浏览器 relay”
        - 当前剩余的是如何把 follow-up / final asset retrieval 再继续前移
      - 默认入口层当前也已禁掉：
        - `program-owned video -> silent browser fallback`
      - 若 direct no-key 合同没有被 materialize 出来，正式主链现在会显式报错：
        - `gemini_canvas_program_video_browser_fallback_forbidden`
    - `music`
      - 已确认存在一条 app-owned page front-half contract：
      - `StreamGenerate -> action = music_generation`

### 2.2 Azure OpenAI

当前实现线目录：

- `official_vendor_api`
  - `azure_openai`

当前正式新落点：

- `docs/20-ai-gateway/Azure OpenAI平台实现线、可选编译与物理隔离基线.md`

当前状态：

- `已通过`

说明：

- 当前正式只按一条 `official_vendor_api` 理解
- canonical surface：
  - `azure-openai`
- 同一条线同时 owner：
  - canonical `/openai/v1`
  - legacy deployment-path variant
- 当前已并入：
  - `family-openai-compatible-official-api`
- 当前 latest-head live 已使用真实 customer-managed Azure 资源、真实 `api-key` 与真实 `/openai/v1` endpoint 打到官方 data-plane
- 当前 native text cases 之所以没有真实 `200`，是因为：
  - `gpt-chat-latest` 的部署创建被 Azure 配额 gate 阻断
  - `gpt-5.4-nano` 的部署创建被订阅策略 gate 阻断
- 因此当前按：
  - `provider external gate accepted`
  记账

### 2.3 Anthropic Messages

当前实现线目录：

- `official_model_api`
  - `anthropic`

当前正式新落点：

- `docs/20-ai-gateway/Anthropic Messages平台实现线、可选编译与物理隔离基线.md`

当前状态：

- `已通过`

说明：

- 当前正式只按一条 `official_model_api` 理解
- canonical surface：
  - `anthropic-compatible`
- 当前已升成：
  - `family-anthropic-compatible-official-api`
  - canonical first-class reference line
- latest-head live 当前按：
  - `quota gate accepted`
  记账

### 2.4 AWS Bedrock Converse

当前实现线目录：

- `official_model_api`
  - `aws_bedrock`

当前正式新落点：

- `docs/20-ai-gateway/AWS Bedrock Converse平台实现线、可选编译与物理隔离基线.md`

当前状态：

- `已通过`

说明：

- 当前正式只按一条 `official_model_api` 理解
- canonical surface：
  - `bedrock-converse`
- 本轮已建立：
  - `family-bedrock-converse-official-api`
- latest-head live 当前按：
  - `provider external gate accepted`
  记账

### 2.5 Cohere Chat

当前实现线目录：

- `official_model_api`
  - `cohere`

当前正式新落点：

- `docs/20-ai-gateway/Cohere Chat平台实现线、可选编译与物理隔离基线.md`

当前状态：

- `已通过`

说明：

- 当前正式只按一条 `official_model_api` 理解
- canonical surface：
  - `cohere-chat`
- 当前 canonical key 固定收口为：
  - `cohere_chat`
- latest-head live 已绿
- 本轮已建立：
  - `family-cohere-chat-official-api`
        - `action_input = { prompt, duration_seconds }`
      - Rust 默认主链当前也已开始接受：
        - `program_music_streamgenerate_candidate`
        - `page_stream_generate_form`
      - 进入这条分支后：
        - 若 body 真返回 `music_generation + action_input`
          - 可返回 caller-visible `accepted = true / completed = false`
        - 若首轮 exact replay 还没有进入 `music_generation + action_input`
          - 主链现在会自动借当前 app page bootstrap 做一轮最小 `L5adhe` prelude
          - 然后对同一条 `StreamGenerate` 再做 second-chance replay
        - 若 second-chance 后仍未拿到 asset
          - 主链现在还会继续：
            - `response_id -> PCck7e`
            - recent conversation recovery (`MaZiqc`)
            - concrete `/app/<id>` page poll
        - 若 second-chance replay 仍落在当前已知失败面
          - `BardErrorInfo [1060]`
          - 则显式报：
            - `gemini_canvas_program_music_no_key_stage_incomplete`
      - 默认入口层当前也已禁掉：
        - `program-owned music -> silent browser fallback`
      - 若 direct no-key 合同没有被 materialize 出来，正式主链现在会显式报错：
        - `gemini_canvas_program_music_browser_fallback_forbidden`
      - 当前 browserless no-key 的最新 focused 结论已经前移：
        - old exact `StreamGenerate` body 在当前热 session 下，已不再稳定停在 `1060`
        - 最小一轮合成 prelude：
          - `L5adhe(last_selected_mode_id_on_web, source_path = 当前 app_path)`
          - 已可稳定把 replay 推到：
            - `conversationId / responseId`
            - `music_generation + action_input`
            - 或 `Track Details / cue summary`
        - focused 归档：
          - `output/gemini_canvas_music_sequence_replay_20260510_v2/results.json`
          - `output/gemini_canvas_music_sequence_replay_20260510_v3/summary.json`
          - `output/gemini_canvas_music_n0_current_20260510_v1.txt`
          - `output/gemini_canvas_music_synth_prelude_probe_20260510_v1.json`
          - `output/gemini_canvas_music_pc_followup_20260510_v1/summary.json`
      - 这说明：
        - `music` 当前问题已经不再是“old exact replay 永远只会 1060”
        - 当前 strongest continuation seam 已继续收口成：
          - `PCck7e(response_id) -> 18 / 21 / 44`
          - 其中 `21` token 当前最值得继续追为 final asset continuation key
        - 主阻塞已经前移成：
          - 如何从 `music_generation/action_input`
          - 或 `Track Details`
          - 继续拿到真正的音频资产 / final generation contract
        - 当前 concrete `/app/<id>` page fetch 虽然已经 caller-visible 证明：
          - `pageStatus = 200`
          - `pageHasTrackDetails = true`
          - 但仍没有直接裸露真实 music asset URL
      - 当前 browser-owned `/invoke` 路径也已继续收口：
        - browser-pool 不再在 `music` 已进入：
          - `music_generation + action_input`
          - `Track Details`
          - `I've hit a bit of a snag / please try again later`
          这些 pending/busy 语义后继续无限等待到 transport timeout
        - modular result 层也不再把 `video/mp4` 占位媒体误判成最终音乐资产
        - `program-owned / no-key` 当前也已禁掉：
          - direct asset fetch 失败后再走 browser-assisted asset fetch 兜底
        - 也就是说这条实现线后续不再把浏览器资产补取当成正式成功路径
        - 当 browser result 只剩 `video/mp4` 占位媒体，但 body 已进入上述 pending/busy 状态时，caller-visible 现统一回：
          - `accepted = true`
          - `completed = false`
      - 当前仍不应把 `music` 误报成“已 browserless 完成”
  - 当前 `program-owned` app-endpoint contract 至少允许继续显式承载：
    - `invokeBaseUrl`
    - `musicWsUrl`
    - `videoInvokePath`
    - `canvasProgramAction`
    - `canvasProgramActionInput`
    - `canvasProgramInvokeContract.wsUrl`
    - `canvasProgramInvokeContract.apiStyle`
    - `canvasProgramInvokeContract.requestPath`
    - `canvasProgramInvokeContract.requestEnvelopeKind`
  - 当前 `program-owned` live/bootstrap 也应优先消费已经 materialize 的 runtime：
    - `canvasProgramUrl`
    - `pageUrl`
    - `appPath`
    - `conversationId`
    - `responseId`
    - `canvasProgramInvokeContract`
    - 不再长期停留在只有 `runtimeStateObjectKey + shareId` 的弱 bootstrap 语义
  - 若同一 share 下存在 `text / image / music / video` 多模态 program contract，当前 regression/live bootstrap 必须按 **当前 case 的 operation** 自动选择或重新 materialize 对应 handle：
    - 不允许把 `video` 导向的 handle 直接拿去跑 `image`
    - 不允许把 `image` 导向的 handle 直接拿去跑 `music`
    - canonical 成功标准是“当前 case 拿到匹配 operation 的 program runtime”，而不是“share 下随便有一个最新 handle”
  - 当前 `program-owned` 后半段的正式目标固定为：
    - **无官方 API key**
    - **无 generic web chat replay**
    - **默认 fail-closed**
  - 当前 canonical runtime/live material 默认只应保留：
    - concrete app handle
    - `canvasProgramInvokeContract`
    - `authToken` 等 session 证据字段
    - 必要的 discovery/debug provenance
  - `googleApiKey / apiKeys` 现在只允许视为：
    - 旧 focused/browserless official invoke 的**证据态材料**
    - 或 debug-only 线索
    - **不得再作为 `canvas_web_reverse / program-owned` 的默认正式主链输入**
  - 当前已确认：
    - `g.a...` 页面侧 token 不能直接作为 `generativelanguage.googleapis.com` 的 Bearer token
    - 带显式 official Google API key 的 direct invoke，只能证明“官方 API/WS 合同可直连”，**不能**算 `program-owned` 正式成功
  - 因此 `program-owned` 后半段不得再把：
    - `page token`
    - `网页聊天窗口`
    - `StreamGenerate / batchexecute`
    - `googleApiKey / apiKeys`
    误当成 steady-state invoke 主线
  - 当前 `program-owned` 的浏览器 bootstrap/probe 只允许承担：
    - `share -> app` 的程序 materialize
    - 目标 mode / action contract / rpc contract 的 discovery
    - runtime material 的回写
  - 当前 `music` 的 no-key 默认主链还必须继续区分两层成功：
    - `final asset`
      - 直接出现 `audio/mpeg` / `.mp3`
    - `accepted progress`
      - 出现 `music_generation + action_input`
      - 或 `Track Details`
      - 或 `Generating your music...`
      - 或 `18 / 21 / 44`
      - 或 `11 = Electronic Music Cue Generation`
      - 或 `26 + 44`
    - 当 `program-owned / no-key` 已进入上述 `accepted progress`，但仍未拿到最终 `mp3/audio` 时：
      - caller-visible 语义应返回 `accepted=true, completed=false`
      - 不再把它误报成硬失败
      - 也不再借浏览器页面输入提交或 browser-assisted asset fetch 兜底
  - 当前已新增纯 HTTP focused probe 证明：
    - `share -> ujx1Bf -> concrete canvas app handle`
    - 这一步已经可以在不调用 browser pool 的前提下完成
    - 当前最小成功判据是拿到：
      - `conversationId`
      - `responseId`
    - 以及可从 `conversationId` 归一出的 `appPath / programUrl`
    - 但这只证明“创建 canvas app”可 HTTP 化
    - 不等于后续 `canvas app websocket` 执行链也已经 browserless
  - 当前 Rust `canvas_program_web_reverse` bootstrap 主链也已同步前移：
    - 若 payload 还没有 concrete handle，默认先尝试：
      - `GET /share/<shareId>`
      - `POST rpcids=ujx1Bf`
      - 解析 `canvasProgramUrl / appPath / conversationId / responseId`
    - 只有 pure HTTP create 没能产出 concrete handle 时，才回退到浏览器 discovery
    - 因此当前第一段 `share -> app` 已经不再是“只有脚本 proof-of-concept”，而是正式接入了 Rust bootstrap 主线
  - 当前第二段 `invoke` 的 browserless focused 结论必须继续分层：
    - `text`
      - 已有 browserless focused probe `200`
      - 这条成功来自 official API 形状直连，当前只算**证据态**
      - 证据：`output/gemini_canvas_program_browserless_invoke_2026-05-09T01-08-54-053Z/summary.json`
    - `tts`
      - 已有 browserless focused probe `200`
      - 这条成功来自 official API 形状直连，当前只算**证据态**
      - 证据：`output/gemini_canvas_program_browserless_invoke_2026-05-09T01-09-20-969Z/summary.json`
    - `music`
      - 已有 browserless focused probe `200`
      - 后半段是服务端直连远端官方 websocket，不再依赖本地 connected client
      - 这条成功当前也只算**证据态**
      - 证据：`output/gemini_canvas_program_browserless_invoke_2026-05-09T01-08-53-995Z/summary.json`
    - `image`
      - exact minimal browserless request 已命中官方 `generateContent` 端点
      - 当前失败面是 `429 quota gate`，不是浏览器依赖
      - 这条命中只算“browserless official invoke 证据”，不算 `program-owned` 正式成功
      - 证据：`output/gemini_canvas_program_browserless_image_exact_20260509_v1/summary.json`
    - `video create`
      - exact minimal browserless request 已命中官方 `predictLongRunning` 端点
      - 当前 exact request 失败面是 `429 quota gate`
      - 这条命中只算“browserless official invoke 证据”，不算 `program-owned` 正式成功
      - 证据：`output/gemini_canvas_program_browserless_video_exact_20260509_v1/summary.json`
      - 当前正式 probe 脚本也已收口到同一类官方 gate：
        - `output/gemini_canvas_program_browserless_invoke_2026-05-09T01-38-38-740Z/summary.json`
  - 因此当前关于 `canvas_web_reverse / program-owned` 的 browserless 结论必须固定写成：
    - `share -> app create` 已 browserless
    - `text / tts / music` 已有 browserless official invoke focused success，但当前只算**证据态**
    - `image / video create` 已有 browserless official invoke 命中官方端点证据，但当前只算**证据态**
    - 默认 `program-owned` 主链现在必须视为 `fail-closed` 的纯 `app-interface / browserless` 路由
    - 若主链仍需要 `googleApiKey / apiKeys` 才能成功，应直接报：
      - `gemini_canvas_program_official_api_key_forbidden`
      - 或 `gemini_canvas_program_no_key_invoke_contract_missing`
    - `text / tts / image / video create` 默认不得再静默回退到 connected client `canvas_proxy`、旧 browser execution、或 official key assisted success
    - `image / video create` 当前若失败，caller-visible 失败面应优先体现为：
      - `provider gate`
      - 或 `no-key contract missing`
      - 而不是浏览器 relay 成功
    - 整条 full live steady-state 是否已经完全脱离浏览器、且在**无官方 key**前提下成功，仍应以独立 fresh live 结果为准；不要把 focused official invoke 证据直接夸大成 `program-owned` 已完成
  - 当前新一轮 no-key contract focused probe 已继续把“失败面”收口到更具体的上游级别：
    - 归档：`output/gemini_canvas_program_no_key_contract_probe_20260509_v1/summary.json`
    - `browser_pool + canvas_page_no_key -> official generateContent`
      - 当前稳定返回：`403 PERMISSION_DENIED`
      - 关键信号：`Method doesn't allow unregistered callers`
    - `browser_pool + buildGoogleFetchAuthHeaders -> official generateContent`
      - 当前稳定返回：`400 INVALID_ARGUMENT`
      - 关键信号：`Bad request: Origin doesn't match Host for XD3.`
    - `browser_pool + canvas_page_music_no_key -> official music ws`
      - 当前稳定返回：`1008 PolicyViolation`
      - 关键信号：`Request is missing required authentication credential`
    - `browser_pool + canvas_page_no_key -> clients6 video preview model`
      - 当前仍停在浏览器级：`page.evaluate: TypeError: Failed to fetch`
    - `server-side direct HTTP + signed session -> official hosts`
      - 当前已验证会落在：
        - `400 XD3`
        - 或 `401 CREDENTIALS_MISSING`
    - `server-side direct HTTP + signed session -> clients6 video preview model`
      - 当前稳定返回 Google `400 HTML` 错页
  - 但在此之后，当前又新增了一层更强的 live 证据：
    - 归档：`output/gemini_canvas_preview_no_key_direct_contract_20260509_v1/summary.json`
    - 当前关键纠偏是：
      - 旧的 `canvas_preview_no_key` 失败面，并不完全等价于真实 `Browser API Proxy Client` 语义
      - 少了至少：
        - `credentials: "include"`
        - 对官方 host 强制补空 `?key=`
    - 补齐这两层后，在**真实 Canvas 预览 frame** 内已经 caller-visible 证明：
      - `text`
        - `200`
        - `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`
      - `image`
        - `200`
        - `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`
      - `tts`
        - 当前已 caller-visible 成功
        - `preview-frame no-key` focused 归档：
          - `output/gemini_canvas_preview_no_key_tts_variants_20260510_v1/generate_no_voice.json`
          - `output/gemini_canvas_preview_no_key_tts_variants_20260510_v1/generate_kore.json`
        - 两个样本都直接返回：
          - `candidates[0].content.parts[0].inlineData`
          - `mimeType = audio/L16;codec=pcm;rate=24000`
        - 这说明旧的：
          - `finishReason = OTHER`
          - `200 but no confirmed audio payload`
          已不再代表当前上限
      - `video create`
        - 当前仍是 `PreviewProbeFetchError Failed to fetch`
        - 但新的诊断归档已经证明：
          - `output/gemini_canvas_preview_no_key_video_probe_20260510_v5/error.txt`
        - 当前失败面已经从：
          - `preview frame missing`
          前移成：
          - preview frame 已真实存在
          - `probeResult.finalUrl` 已组装成官方：
            - `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning`
          - 但 preview-frame 内部对该 no-key fetch 本身失败
        - 也就是说它当前卡住的不是 frame 准备层，而是 `predictLongRunning` 这条 no-key 合同本身
    - 在此之后，当前又拿到了一条更接近最终目标的 `video` no-key 页面合同：
      - 归档：
        - `output/tmp-video-streamgenerate-current.json`
        - `output/gemini_canvas_video_streamgenerate_exact_replay_20260510_v3/summary.json`
        - `output/gemini_canvas_video_streamgenerate_exact_replay_20260510_v4/summary.json`
      - 当前已证明：
        - 真实 `Canvas app` 页面内提交 `video` prompt 的 no-key 主线不是官方 `predictLongRunning`
        - 而是页面自己的：
          - `/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`
      - 当前 pure HTTP exact replay 已 caller-visible 成功命中：
        - `status = 200`
        - 新的 `responseId`
        - `conversationId`
        - `video_placeholder`
      - 并且在延长读取窗口后，已进一步对齐到与页面相同的最终 busy 文本：
        - `I couldn't do that because I'm getting a lot of requests right now. Please try again later.`
      - 因此当前关于 `video` no-key 的最准确结论必须更新为：
        - `predictLongRunning` 不是当前 app-native no-key 主线
        - `video` 已发现并复放出一条 **browserless page-owned StreamGenerate contract**
        - 当前剩余问题不再是“能否复放”，而是“如何把这条 contract 正式接入默认主链并稳定处理 follow-up / accepted gate”
    - 同时必须继续明确：
      - 这条成功**不是** ws relay 成功
      - 因为同一预览 frame 里的 `Browser API Proxy Client` websocket 到：
        - `wss://127.0.0.1:9998?authIndex=0`
      - 在 Canvas 内仍被上游页面策略直接拦掉：
        - `WebSocket connection ... is not allowed in Canvas`
      - 也就是说，当前真正打通的是：
        - `preview frame no-key official fetch contract`
      - 而不是：
        - `preview frame websocket relay contract`
  - 因此截至本轮，当前仓库内已经发现了一个**部分可稳定复放**的：
    - `no official key`
    - `program-owned`
    - `caller-visible success`
    的 direct invoke 合同
  - 但它当前只覆盖：
    - `generateContent` 风格的 preview-frame fetch
    - 已 caller-visible 证明：
      - `text`
      - `image`
    - `tts` 还缺完整音频 payload 验证
    - `video create` 仍未打通
    - `music` 仍未打通
  - 当前可写成 canonical 结论的是：
    - `share -> app create` 已 HTTP 化并接入 Rust 主链
    - `invoke` 阶段已经不应再笼统写成“完全未打通”
    - 更准确的写法是：
      - `preview-frame no-key official fetch contract` 仍是 `text / image / tts` 的主要证据来源
      - `websocket no-key relay contract` 仍未打通
      - `video` 当前正式主线已切到 app-scoped `StreamGenerate`
      - `music` 当前正式主线也已切到 app-scoped `StreamGenerate`
    - `program-owned` 默认正式语义仍是 no-key owner，不再允许页面输入提交充当 steady-state invoke
      - `music/video` 当前 caller-visible 正式主链都不再依赖浏览器页面输入提交
      - `music` 已补上：
        - `cookieHeader` 显式保真
        - `StreamGenerate xsrf self-heal`
        - page/app origin 保真
        - direct asset fetch 对 `CookieMismatch`/HTML 的拒收
      - 当前 fresh live 证据：
        - output/gemini_canvas_program_media_live-music-20260511-v52/summary.md（本地验收归档）
        - output/gemini_canvas_program_media_live-20260511-v27b/summary.md（本地验收归档）
      - 当前正式结论应写成：
        - `music`：已 caller-visible 重新打绿，归 `program-owned / no-key / pure-http-first`
        - `video`：caller-visible 返回 `accepted/pending` 也可视为该 live suite 的 accepted gate
        - `tts`：仍未完成；当前 program-owned no-key pure-HTTP 路线还没有重新打绿
  - 当前对外部参考实现 `CanvasToAPI` 的正式理解也必须固定收口：
    - 它当前应被视为：
      - `browser-required relay`
      - `caller-supplied official Gemini API identity`
      - `standalone browser fetch executor`
    - 它**不能**被视为：
      - `canvas program-owned no-key contract`
      - `Canvas 免费额度已被 browserless 复放`
    - 当前已完成独立 fresh 对照：
      - 在全新空目录 `../CanvasToAPI-fresh-main`
      - 运行独立实例：
        - `47861`：`API_KEYS=canvas-probe-key`
        - `47864`：`API_KEYS=<redacted-google-api-key>`
      - 再用 standalone 本地页面：
        - `http://127.0.0.1:47863/canvas.html`
        - 直接连接 `ws://127.0.0.1:47864/ws`
      - 这一步不依赖 Gemini 页面或 Canvas 页面本体
    - 当前 live 证据已经证明：
      - API 请求若带：
        - `Authorization: Bearer AIza...`
      - standalone 浏览器页会把该值原样转发给 Google
      - Google 返回：
        - `401 UNAUTHENTICATED`
        - `ACCESS_TOKEN_TYPE_UNSUPPORTED`
      - 这说明 relay 并不会把 `AIza...` 自动升格成 Canvas 免费身份或页面凭证
    - 同一条 standalone relay 在 API 请求里改成：
      - `x-goog-api-key: AIza...`
      - 会 caller-visible 完成 non-stream 响应
      - `CanvasToAPI` 服务端日志已明确出现：
        - `Response ended, reason: STOP`
        - `Complete non-stream response sent to client`
      - 对应 standalone 页面日志也已出现：
        - `Received request: POST /v1beta/models/gemini-3-flash-preview:generateContent`
        - `Data stream read complete.`
        - `Task completed, stream end signal sent`
    - 因此当前关于 `CanvasToAPI` 的 canonical 结论必须固定为：
      - 它成功的关键是：
        - 浏览器 relay
        - 调用方自己带入的 official Gemini API key / query / header
      - 它没有提供“无官方 key 的 Canvas 免费后端”证据
      - 它不能再被当作 `program-owned / no-key / browserless` 方向的正向证明
  - 它默认不得再在页面里真正提交 `music/video` 生成、点击播放、或点击下载来充当 steady-state invoke
  - 若后续需要网页侧调试，也应明确标注为 `discovery-only` 或 `debug-only`，不得把网页对话生成结果误判成 `program-owned` 已完成
  - 这些字段当前用于表达“Canvas app 暴露的 transport contract”，不得再把它们混回 generic official API 配置含义
  - 若 focused probe 从 Canvas 程序自身的 HTML / JS 中看到了 `Browser API Proxy Client` / `Routing Google API requests via WebSocket` 这类信号，当前允许把它收口成：
    - `transportKind = canvas_program_ws_candidate`
    - `wsUrl`
    - `apiStyle = google_generative_language`
    - `requestEnvelopeKind = canvas_proxy_request`
    - 这些字段优先被视为 `program-owned` 后半段的候选调用合同，而不是网页聊天 replay 的证据
  - 一旦 focused bootstrap 已经命中 share 直接产出的 `Browser API Proxy Client` app，当前 canonical pair 应优先保持该 share-sourced program handle：
    - 不再继续通过 `new chat`
    - 不再继续通过 generic `/app` mode 选择把上下文切回普通 Gemini 对话壳层
    - focused discovery 的成功标准是“拿到 concrete program handle + websocket candidate contract”，不是“页面继续进入视频/音乐模板工作流”
  - 当 focused bootstrap 还没直接暴露最终 transport 时，允许先把 Canvas app 自己给出的结构化动作合同继续显式保存到 runtime material：
    - 例如 `music_generation`
    - 以及对应的 `action_input`
  - 这类 action contract 仍属于 `canvas_web_reverse / program-owned` 的 owner 真相，不得误改判成 generic `official_api`
- 当前 `gemini_canvas_web_reverse_modular`
  - 只保留为：
    - 历史兼容线
    - 夹具/回归守卫线
    - 旧 browser relay 行为证据线
  - 它不再参与当前 `Gemini Canvas` 正式 owner 完成度宣告
  - 当前 `Gemini Canvas` 的正式主叙事固定为：
    - `canvas_web_reverse / program-owned / canvas app websocket contract owner`
- 使用 Google AI Studio 官方页面创建或管理的 Gemini 官方 API key
  - 当前仍统一归 `Gemini Platform / official_api`
  - 不再另外建 `AIStudio official` 独立实现线

### 2.6 Qwen Platform

旧专题来源：

- `Qwen平台实现线、可选编译与物理隔离基线.md`

当前实现线目录：

- `official_api`
  - DashScope OpenAI-compatible
  - Coding Plan OpenAI-compatible
  - Coding Plan Anthropic-compatible
- `web_reverse`
  - `qwen_web_chat`

当前正式新落点：

- `docs/20-ai-gateway/AI网关服务商建模与凭证体系.md`
- `docs/20-ai-gateway/Qwen平台实现线、可选编译与物理隔离基线.md`
- `docs/20-ai-gateway/Qwen平台凭证模板与字段说明.md`
- `docs/20-ai-gateway/AI网关测试与验收总线.md`

当前状态：

- `两实现线已收口`

当前 canonical implementation lines：

1. `qwen_official_api`
   - shared official core
   - canonical surfaces：
     - `qwen_dashscope_openai`
     - `qwen_coding_plan_openai`
     - `qwen_coding_plan_anthropic`
2. `qwen_web_reverse`
   - canonical surface：
     - `qwen_web_chat`

当前 compile switch：

- `line-qwen-official-api`
- `line-qwen-web-reverse`

当前 live suite：

- official：
  - `qwen_dashscope_live`
  - `qwen_coding_plan_openai_live`
  - `qwen_coding_plan_anthropic_live`
- web reverse：
  - `qwen_web_chat_live`
  - `qwen_web_chat_full_live`

当前已 fresh 归档的 browserless web reverse live 结果截至 `2026-05-17`：

- `output/qwen_web_chat_live_20260517_v4`
  - `5 / 5 pass`
- `output/qwen_web_chat_full_live_20260517_v3`
  - `37 / 37 pass`

当前已 fresh 归档的 web reverse fixture 结果：

- `output/qwen_web_chat_fixture_20260517_v3`
  - `5 / 5 pass`
- `output/qwen_web_chat_full_fixture_20260517_v2`
  - `37 / 37 pass`

当前已 fresh 归档的 official fixture 结果：

- `output/qwen_dashscope_openai_fixture_20260517_v1`
  - `4 / 4 pass`
- `output/qwen_coding_plan_openai_fixture_20260517_v1`
  - `4 / 4 pass`
- `output/qwen_coding_plan_anthropic_fixture_20260517_v1`
  - `2 / 2 pass`

说明：

- Qwen Web 的浏览器当前只用于 session material 提取
- 请求期调用必须继续保持：
  - `browserless / pure HTTP`
- 当前 operator catalog / preset / fixture provider spec 已统一使用：
  - `headers.Accept = application/json`
- Qwen official 三 surface 当前都已接入 live suite / live probe，并保留以下 key source：
  - `GATEWAY_QWEN_DASHSCOPE_API_KEY`
  - `GATEWAY_QWEN_CODING_PLAN_API_KEY`
  - 兼容旧别名：
    - `QWEN_DASHSCOPE_API_KEY`
    - `QWEN_CODING_PLAN_API_KEY`
  - 或 `%USERPROFILE%\\.neuro\\qwen-platform\\<surface>\\api-key\\*.json` 下的单行凭证文件
- 截至 `2026-05-17`，当前分支还做过三条 official suite 的 invalid-key probe：
  - local bootstrap / provider-account wiring 已确认可达
  - 当前失败面已经前移到 upstream auth 层
  - 其中 `qwen_dashscope_live` 已在 `2026-05-18` 的 latest-head rerun 中 fresh 打绿
  - `qwen_coding_plan_openai_live` 与 `qwen_coding_plan_anthropic_live`
    当前则应按 `服务商不支持` 记录：
    官方文档已把 Coding Plan 配额限定在交互式 AI 编程工具中，并排除
    `curl / Postman / Dify / 自定义应用程序后端 / 非交互式批量 API` 场景

### 2.7 ChatGPT Platform

旧专题来源：

- `ChatGPT官方API与WebReverse双线路基线.md`
- OpenAI 官方 API / Responses quickstart 相关专题材料
- `ChatGPT Web Reverse基于EasyRegister failed-twice凭证live验证结果-2026-05-29.md`

当前实现线目录：

- `official_api`
  - 当前正式对应 `OpenAI Platform`
  - 当前 control-plane 入口是：
    - `adapter = openai_compatible`
    - `protocolProfile = chatgpt_official_api`
    - `provider-create-catalog key = openai-platform`
  - 当前兼容旧值：
    - 历史 `protocolProfile = openai` 会继续 canonicalize 到 `chatgpt_official_api`
  - 若 broad profile 与强特征 `baseUrl` 冲突：
    - `chatgpt.com/backend-api/codex` 应优先改判到 `chatgpt_codex_backend`
    - `chatgpt.com/backend-api/conversation` 应优先改判到 `chatgpt_web_reverse`
- `web_reverse`
  - 当前正式对应：
    - `adapter = chatgpt_web_reverse_compatible`
    - `protocolProfile = chatgpt_web_reverse`

当前特殊边界：

- `chatgpt.com/backend-api/codex`
  - 当前仍是一个需要兼容的 ChatGPT 站点后端特例
  - 它不能再被当成 `official_api` 线的长期干净 owner 语义
  - 历史 `protocolProfile = codex` 当前应继续 canonicalize 到 `chatgpt_codex_backend`
  - 当前要被 operator / runtime 共同识别成这条线，默认至少需要：
    - `baseUrl` 命中 `chatgpt.com/backend-api/codex`
    - `Originator` 含 `codex`
  - 后续应继续被视为：
    - `official_api` 旁支兼容面
    - 或待进一步独立收口的站点特例

当前正式新落点：

- `docs/20-ai-gateway/AI网关服务商建模与凭证体系.md`
- `docs/20-ai-gateway/AI网关测试与验收总线.md`

当前状态：

- `web_reverse 已通过；平台整体部分覆盖`

说明：

- `ChatGPT` 相关能力当前不应再被理解成“只有 web reverse”
- 当前正式至少存在两条独立实现线：
  - `official_api`
  - `web_reverse`
- 当前 folder sync 下推荐 surface slug：
  - `chatgpt-official-api`
  - `chatgpt-codex-backend`
  - `chatgpt-web-reverse`
- 截至 `2026-05-29`，`chatgpt_web_reverse` 已完成一轮 EasyRegister
  `failed-twice` 来源的随机 10 凭证改造验证：
  - 67 个随机候选中 materialize 成功 11 个；逐凭证复核淘汰 1 个已停用账号，最终保留 10 个
  - 最终 10 个 converted credential 已导入隔离 Rust gateway 的 `gateway_provider_credentials`
  - 最终 pool 的 `GET /v1/models`、route-level `POST /v1/responses` 均返回 `200`
  - route-level responses live 命中目标 marker
  - 用户问题 `法国的首都在哪里` 已按 credential 隔离逐个调用 `/v1/chat/completions`，最终 10 个均返回 `巴黎` / `Paris`
  - 因此该实现线在“可改造 failed-twice 材料 -> gateway credential library -> caller-visible text live”链路上已验证成功
- 截至 `2026-05-30`，`chatgpt_web_reverse` 又完成请求期 pure HTTP 收口验证：
  - browser worker 仅作为离线 refresh / materialization tooling，用于登录恢复与提取 fresh `f/conversation` 请求材料
  - caller-visible 请求期通过 `CHATGPT_WEB_REVERSE_REQUEST_TIME_BROWSER=disabled` 与 `requestTimeBrowserAllowed=false` 禁止 browser fallback
  - 最终 `POST /v1/chat/completions` 经 `POST /backend-api/f/conversation` 返回 `200 / Paris`
  - 如果 cached session / sentinel / turn-trace material 过期，必须请求外 refresh；请求期不得临时启动 browser 兜底
- 截至 `2026-05-30`，`chatgpt_web_reverse` 已补上维护期 browserless refresh 基线：
  - 若单行 credential 含 `extraBody.refreshToken`，gateway 会优先使用 `grant_type=refresh_token` 调用 `https://auth.openai.com/oauth/token`
  - refresh 成功后写回新的 `apiKey / refreshToken / idToken / expiresAt`
  - 该刷新只续 OAuth `accessToken`，不等于续命 `f/conversation` sentinel / turn-trace material
  - 若希望降低对 cached `f/conversation` material 的依赖，可设置 `extraBody.chatgptWebConversationMode=dynamic_backend_conversation`，走动态 `sentinel/chat-requirements -> /backend-api/conversation` pure HTTP 实验基线
- 同日又对当前 EasyRegister `failed-twice` 原始目录做 refresh material 审计：
  - 06:47 快照中 `25872` 个 JSON 的 `refreshToken / refresh_token` 计数为 `0`；06:52 主干 fresh 复核时目录增至 `25873` 个 JSON，`refreshToken` 仍为 `0`
  - 虽然这些文件基本都带 `finalUrl?code=...`，且大部分文件带 `platformAuth.codeVerifier`，但最新样本的 browserless authorization-code exchange 返回 `400 token_exchange_user_error`
  - 因此当前 batch 不能事后补救出 OAuth `refreshToken`；上游采集 / 注册流程必须在 code exchange 成功当时保存 `refresh_token`
  - 详细证据见 `ChatGPT Web Reverse OAuth刷新材料审计-2026-05-30.md`
- 同时不要把上述结论外推到 `chatgpt_codex_backend`：
  - `failed-twice` 默认仍是 ChatGPT Web session material
  - 未通过 codex backend `/responses` staging probe 前，不得作为 codex backend 生产凭证
- 当前 upstream owner 已开始落地：
  - `gateway/src/upstream/chatgpt/official_api/`
    - 当前已拆成 `request_plan.rs + execution.rs + response.rs + mod.rs`
    - owner `official_api / chatgpt_codex_backend` 的 request-plan、execution-context、response-side unpack / accumulate 决策
    - 当前 execution-side provider 归因已按实现线收口到：
      - `chatgpt_official_api`
      - `chatgpt_codex_backend`
      - 不再继续回落成 generic `openai_compatible`
    - 当前 non-streaming unpack 只允许在官方 `OpenAI / Responses` shape 之间桥接
      - 不再继续吸收 `Accio` fallback
  - `gateway/src/protocol/chatgpt/web_reverse/request.rs`
    - 当前 owner `web_reverse` 的 canonical message -> conversation payload 渲染
  - `gateway/src/protocol/chatgpt/web_reverse/response.rs`
    - 当前开始 owner `web_reverse` 的 response-side challenge/session 判定、SSE accumulate 与 OpenAI chunk 翻译
  - `gateway/src/protocol/chatgpt/web_reverse/bootstrap.rs`
    - 当前 owner `web_reverse` 的 site bootstrap 解析与 fallback merge
  - `gateway/src/protocol/chatgpt/web_reverse/proof.rs`
    - 当前 owner `web_reverse` 的 proof / legacy requirements token 生成
  - `gateway/src/protocol/chatgpt/web_reverse.rs`
    - 当前退回薄 façade / re-export 层，继续保留现有 `chatgpt::web_reverse::*` 调用面
  - `gateway/src/upstream/chatgpt/web_reverse.rs`
    - 当前主要 owner `web_reverse` 的 request context、target URL 与 request-side helper re-export
  - `gateway/src/upstream/chatgpt/bootstrap.rs`
    - 当前 owner `web_reverse` 的 bootstrap HTTP fetch、challenge/session gate 与 payload fallback merge 编排
  - `gateway/src/upstream/chatgpt/common.rs`
    - 当前承接 web reverse 线内部重复的 response gate / shared helper
  - `gateway/src/upstream/common.rs`
    - 承接跨 surface 共享的窄 transport helper 与 `RequestPlan`，避免再把这类 helper 反挂回 `client.rs`
  - `gateway/src/upstream/openai_compatible_request_plan.rs`
    - 当前承接 generic `openai_compatible` sibling planner
    - 避免继续把 ChatGPT official/codex 与 generic OpenAI-family planner 一起堆在 `gateway/src/upstream/client.rs`
  - `gateway/src/upstream/openai_compatible_common.rs`
    - 承接 OpenAI-family request-side 共享 helper，如 audio transcription multipart/raw-body 组装
- 其中 `official_api` 的 caller-facing 正式契约应优先以 OpenAI 官方 `Responses API` 为主入口理解
- `web_reverse` 当前允许阶段性保留浏览器辅助恢复能力，但该能力只应位于离线 refresh / materialization 流程；请求期热路径已经有 pure HTTP 验证样本，后续不得把 caller-visible 请求重新退回 browser relay 作为默认完成态

### 2.8 ChatGPT Web Reverse 历史注记

旧专题来源：

- `ChatGPT官方API与WebReverse双线路基线.md`

当前实现线目录：

- `web_reverse`

当前正式新落点：

- `docs/20-ai-gateway/AI网关服务商建模与凭证体系.md`

当前状态：

- `待专题化`

说明：

- 这一节当前只保留历史单线专题入口，避免旧专题完全失联
- 正式 owner / 实现线判断以上面的 `ChatGPT Platform` 小节为准

### 2.9 AIStudio Web Reverse

旧专题来源：

- `AIStudio Web Reverse基线.md`

当前实现线目录：

- `web_reverse`
- `AIStudio` 当前不再保留 `official_api` 独立实现线
  - 使用 Google AI Studio 官方 API key 调官方 Gemini API 的路径
    - 统一收口到 `Gemini Platform / official_api`
    - 当前 canonical 对应：
      - `google_gemini_api`
      - `google_vertex_gemini`
  - `AIStudio official api`
    - 只允许表达 key 来源 / 产品入口 / operator 文案
    - 不再表达一条独立 upstream execution contract
- 当前正式 owner：
  - `text / stream / tools` 当前代码侧默认 send path：
    - `program_owned capture-contract pure_http_replay -> browser-backed fallback`
  - `embeddings` 当前仍为 `browser_owned`
  - TTS 当前为 `mixed lane`
    - `direct send material = cloud_api_key`
    - `browser fallback material = browser_state`
  - `text / tools` 当前还存在一条极小的 `program_owned deterministic bridge` 子链
  - Phase 3 已把一般文本热路径的代码侧默认路径提升为 `program_owned pure-http first`
    - 依赖：
      - `runtimeStateObjectKey`
      - `aistudio-target-rpc-contract.json`
      - `cloudApiKey`
    - 无需再设置 `AISTUDIO_PROGRAM_OWNED_TEXT_HTTP_FIRST`
    - sidecar / runtime material 缺失、合同解析失败、目标 RPC 失败或上游拒绝时仍自动回退 browser-backed request
    - 仍不得在缺少 live steady-state 归档证据时宣称 Phase 3 完整验收

当前状态：

- `Phase 3 active：代码侧默认 pure-http first 已转正，live steady-state 归档证据仍待补齐`

当前已完成面：

- `text`
- `models`
- `tools`
- `embeddings`
- `TTS`
- `images`

当前未纳入正式 scope 的候选项：

- `image edits`
- `music`
- `videos`

说明：

- 第一轮结构重组当前只允许：
  - 回归文档与进度
  - 推进 ownership / 目录拆分
- 第一轮结构重组当前不允许：
  - 新增能力 claim
  - 扩大当前已完成面
  - 把 mixed lane 误报成 pure HTTP 已完成
- 当前参考实现 `AIStudioToAPI` 与本仓本轮专题证据只明确覆盖：
  - `text`
  - `images`
  - `TTS`
  - `embeddings`
- 因此 `image edits / music / videos` 当前更准确的状态是：
  - `未证明属于 AIStudio 正式能力域`
  - 而不是“已确认存在、仅仅还没做完”

### 2.10 Groq / Together / OpenRouter / DeepSeek / Mistral

当前正式专题：

- `Groq平台实现线、可选编译与物理隔离基线.md`
- `Together平台实现线、可选编译与物理隔离基线.md`
- `OpenRouter平台实现线、可选编译与物理隔离基线.md`
- `DeepSeek平台实现线、可选编译与物理隔离基线.md`
- `Mistral平台实现线、可选编译与物理隔离基线.md`

当前实现线目录：

- `Groq`
  - `official_vendor_api`
- `Together`
  - `aggregator_api`
- `OpenRouter`
  - `aggregator_api`
- `DeepSeek`
  - `official_model_api`
- `Mistral`
  - `official_model_api`

当前状态：

- 当前已完成：
  - canonical line manifest
  - line feature
  - credential examples
  - provider 专题下沉
  - focused verify
  - 五条 fixture rerun
- 当前 live 收口：
  - `OpenRouter`
    - 已完成
    - 当前 latest-head live 按 `quota gate accepted` 收口
- `Together`
  - 已完成
  - 当前 latest-head live 按 `provider external gate accepted` 收口
- `Groq`
  - 已完成
  - 当前 latest-head live 已绿
- `Mistral`
  - 已完成
  - 当前 latest-head live 已收口，其中 `/v1/responses` 按 `服务商不支持` 记录
- 当前仍未收口：
  - 无

说明：

- 这五家当前全部继续复用：
  - `family-openai-compatible-official-api`
- 但实现线语义不再被误写成同一种：
  - `Groq = official_vendor_api`
  - `Together / OpenRouter = aggregator_api`
  - `DeepSeek / Mistral = official_model_api`
- 当前 fixture/live 进展见：
  - `Groq、Together、OpenRouter、DeepSeek、Mistral fixture与live验收进展-2026-05-19.md`

### 2.11 Suno / Udio / LumaLabs / Producer / Chataibot / Accio

旧专题来源：

- `Producer.ai Session与媒体工作流基线.md`
- `ChatAIBot图片实现线基线.md`
- `AI-gateway-accio-platform-baseline.md`

Suno / Udio / LumaLabs / Producer.ai 当前已开始迁回新的 canonical docs。
在这些平台专题化继续补齐前，应优先以：

- `AI网关平台、实现线、Surface与能力总表.md`
- `AI网关服务商建模与凭证体系.md`
- `AI网关测试与验收总线.md`
- `Suno平台实现线、可选编译与物理隔离基线.md`
- `Udio Platform实现线、可选编译与物理隔离基线.md`
- `LumaLabs平台实现线、可选编译与物理隔离基线.md`
- `Producer.ai平台实现线、可选编译与物理隔离基线.md`

作为当前真相层。

当前实现线目录：

- 多数属于：
  - `official_vendor_api`
  - 或 `web_reverse_api`
  - 少量含 browser/session 属性

当前状态：

- `Accio` 已完成 `web_reverse_api` 专题化并补齐 operator create catalog、credential examples、BUILD/FIELDS 文档
- `Suno` 已补独立 `web_reverse_api` 基线，正式 send path 按 `browser_backed` 理解，`suno_http_live` 仅是 direct HTTP probe
- `Udio Platform` 已补独立 `web_reverse_api` 基线，当前正式 send path 是 browser-backed `/api/generate-proxy` + `/api/songs`
- `LumaLabs` 已补独立 `web_reverse_api` 基线，当前正式 send path 是 browser-backed board action + events stream
- `Producer.ai Platform` 已补独立 `web_reverse_api` 基线，`producer-images / producer-music / producer-videos` 共享 session-backed media workflow，当前 canonical base URL 以 `https://www.flowmusic.app` 为准
- 其他媒体类服务商仍按各自现有专题或总表状态继续演进

说明：

- `Accio` 当前正式 baseline：`AI-gateway-accio-platform-baseline.md`
- Producer.ai 当前正式 baseline：`Producer.ai Session与媒体工作流基线.md`
- Producer.ai 当前实现线 / 可选编译 baseline：`Producer.ai平台实现线、可选编译与物理隔离基线.md`
- Suno 当前正式 baseline：`Suno平台实现线、可选编译与物理隔离基线.md`
- Udio Platform 当前正式 baseline：`Udio Platform实现线、可选编译与物理隔离基线.md`
- LumaLabs 当前正式 baseline：`LumaLabs平台实现线、可选编译与物理隔离基线.md`
- 但在新的文档体系里，它们已经被明确纳入“provider 专题待下沉区”，不再漂浮在根目录

### 2.12 ChatAIBot Images

旧专题来源：

- `ChatAIBot图片实现线基线.md`

当前实现线目录：

- `web_reverse`

当前固定边界：

- 只按图片线理解
- 当前不继续扩到文本 / 音频 / 视频 / 搜索
- 当前主要能力面：
  - `images_generations`
  - `images_edits`

当前正式新落点：

- `docs/20-ai-gateway/ChatAIBot图片实现线基线.md`
- `docs/20-ai-gateway/ChatAIBot图片实现线fixture与live验收结果-2026-05-17.md`

当前状态：

- `已专题化，已通过`

说明：

- 当前正式只保留一条：
  - `session-backed direct_http_replay` 图片实现线
- 当前 fixture 结果：
  - `output/chataibot_images_fixture_20260517_v3`
  - `5/5`
- 当前 live 结果：
  - `output/chataibot_images_live_20260517_v4`
  - `5/5`
- 当前 live 的正式 acceptance boundary 必须继续写清楚：
  - `generation.url / generation.b64 / models`
    - caller-visible 成功
  - `edit.single / edit.merge`
    - caller-visible 成功
    - 或 provider 明确 free-tier quota gate accepted
      - `403`
      - `NotEnoughFreeLimitAnswerCountError`
      - `Subscribe to get more requests`
- 当前这条线已不再只是“待专题化 provider”，而是已进入 canonical 文档与实现线级验收体系

### 2.13 NVIDIA / Grok

当前正式专题：

- `NVIDIA平台实现线、可选编译与物理隔离基线.md`
- `Grok平台实现线、可选编译与物理隔离基线.md`

当前实现线目录：

- `NVIDIA`
  - `official_vendor_api`
- `Grok`
  - `web_reverse_api`

当前状态：

- 当前已完成：
  - canonical line manifest
  - line feature
  - credential examples
  - operator create catalog 暴露
  - provider 专题下沉
- focused verify / fixture / live：
  - 以各自专题基线文档中的最新回归结果为准

说明：

- `NVIDIA` 当前继续复用：
  - `family-openai-compatible-official-api`
- `Grok` 当前正式按：
  - `web_reverse_api / direct_http_replay`
  理解，不并回 `xAI official`

### 2.14 xAI / Perplexity Chat / XFYun / Kiro-compatible

当前正式专题：

- `xAI OpenAI-compatible平台实现线、可选编译与物理隔离基线.md`
- `Perplexity Chat平台实现线、可选编译与物理隔离基线.md`
- `XFYun OpenAI-compatible平台实现线、可选编译与物理隔离基线.md`
- `XFYun Native WebSocket平台实现线、可选编译与物理隔离基线.md`
- `Kiro-compatible平台实现线、可选编译与物理隔离基线.md`

当前实现线目录：

- `xAI OpenAI-compatible`
  - `official_vendor_api`
  - `protocolProfile = xai`
- `Perplexity Chat`
  - `official_vendor_api`
  - `protocolProfile = perplexity_chat`
- `XFYun OpenAI-compatible`
  - `official_vendor_api`
  - `protocolProfile = xfyun_openai`
- `XFYun Native WebSocket`
  - `official_vendor_api`
  - `protocolProfile = xfyun_native_websocket`
- `Kiro-compatible`
  - `official_vendor_api`
  - `protocolProfile = kiro`

当前状态：

- 均已补实现线 manifest、credential examples、operator catalog 默认服务商字段与 folder sync 映射。
- `xAI / Perplexity Chat / XFYun OpenAI-compatible` 复用 `family-openai-compatible-official-api`。
- `XFYun Native WebSocket` 独立使用 `APPID + APIKey + APISecret` signed WebSocket 材料，不并回 HTTP OpenAI-compatible 线。
- `Kiro-compatible` 使用 `bearer_token` material，不是 generic OpenAI-compatible provider。
- fresh live 仍取决于真实 provider key / session material。

### 2.15 Search Family

当前正式专题：

- `Perplexity Search平台实现线、可选编译与物理隔离基线.md`
- `Tavily Search平台实现线、可选编译与物理隔离基线.md`
- `Exa Search平台实现线、可选编译与物理隔离基线.md`
- `Jina Search平台实现线、可选编译与物理隔离基线.md`
- `Jina Reader平台实现线、可选编译与物理隔离基线.md`
- `Linkup Search平台实现线、可选编译与物理隔离基线.md`
- `You.com Search平台实现线、可选编译与物理隔离基线.md`
- `WebSearchAPI Search平台实现线、可选编译与物理隔离基线.md`

当前实现线目录：

- `Perplexity Search`
  - `official_vendor_api`
- `Tavily Search`
  - `official_vendor_api`
- `Exa Search`
  - `official_vendor_api`
- `Jina Search`
  - `official_vendor_api`
- `Jina Reader`
  - `official_vendor_api`
- `Linkup Search`
  - `official_vendor_api`
- `You.com Search`
  - `official_vendor_api`
- `WebSearchAPI Search`
  - `official_vendor_api`

当前共同语义：

- 共享 template family：
  - `search_api_common`
- 共享 family feature：
  - `family-search-api-compatible-official-api`
- 每家平台仍有独立 line feature、独立 line manifest、独立 fixture suite
- `search-compatible` 与 `linkup-compatible-legacy` 只保留兼容入口语义，不再与这 8 条正式平台线混写

当前状态：

- 8 条 search line 都已补齐：
  - provider 专题文档
  - credential examples / BUILD / FIELDS
  - line manifest
  - compile feature
  - fixture suite 绑定
- 当前最准确状态应记为：
  - `已专题化，fixture 已在隔离 runtime fresh rerun 通过`
  - `live 待补`
- 最近一次 fixture 归档：
  - `output/search-family-fixture-rerun-20260528-185357`
  - 独立 Search-only gateway：`http://127.0.0.1:42438`
  - `perplexity_search_fixture`：`1 / 1 pass`
  - `tavily_fixture`：`1 / 1 pass`
  - `exa_fixture`：`2 / 2 pass`
  - `jina_search_fixture`：`1 / 1 pass`
  - `jina_reader_fixture`：`1 / 1 pass`
  - `linkup_fixture`：`2 / 2 pass`
  - `you_search_fixture`：`1 / 1 pass`
  - `websearchapi_fixture`：`1 / 1 pass`

说明：

- `Perplexity Chat` 已迁入 `Perplexity Chat平台实现线、可选编译与物理隔离基线.md`，继续留在对话线，不并入 search family
- `Jina Search` 与 `Jina Reader` 共用 `jina_platform` service provider identity，但必须继续按两个正式 search surface 理解
- `Linkup Search` 的 generic / legacy 兼容入口仍存在，但正式平台线应优先使用：
  - `linkup-search`
  - `protocolProfile = linkup`

---

## 3. 兼容接入与跨服务商规则来源

以下旧文档虽然不是单一服务商 baseline，但仍会影响 provider catalog：

- `AI网关FreeBuff兼容Provider接入基线.md`
- `统一AccessKey与客户端接入基线.md`

历史请求审计散文档当前尚未全部迁回新的 canonical docs；
若看到旧文件名引用，应优先回看：

- `AI网关协议与路由总线.md`
- `AI网关服务商建模与凭证体系.md`
- `统一AccessKey与客户端接入基线.md`

当前处理方式：

- 这类文档的长期规则，应优先沉回：
  - `AI网关协议与路由总线.md`
  - `AI网关服务商建模与凭证体系.md`
  - `AI网关测试与验收总线.md`

它们不再应作为根目录平行的总线 owner 长期存在。

---

## 4. 当前 provider 文档的使用顺序

若开发者要处理某家 provider，当前推荐顺序是：

1. 先看 `AI网关总基线.md`
2. 再看 `AI网关服务商建模与凭证体系.md`
3. 再看本文，确认它属于哪家服务商、哪条实现线
4. 最后再回看旧 provider baseline 文档取细节

这样可以避免再把：

- `official_api`
- `web_reverse`
- `browser_owned`
- `program_owned`

这些语义混在一起。

---

## 5. 当前正式结论

从现在开始：

- 旧 `AI-gateway-*` / `AI网关*` provider baseline 文档默认退为专题参考层
- 新的 provider catalog 入口，默认先看本文
- 任何新服务商或新实现线，都应先补进：
  - 本文
  - `AI网关服务商建模与凭证体系.md`

然后再决定是否需要单开更细的 provider 专题文档
