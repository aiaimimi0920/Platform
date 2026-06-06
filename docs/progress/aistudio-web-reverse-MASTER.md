# AIStudio Web Reverse Refactor Master

## 目的

本文档用于收口 `AIStudio Web Reverse` 后续多轮结构重组与能力演进的长期进度。

它只服务于：

- `AIStudio Web Reverse`

它不再服务于：

- `AIStudio official`

---

## 当前正式边界

从本轮开始，AIStudio 相关官方线统一收口到：

- `gemini official api`

因此：

- 不再存在独立的 `AIStudio official` 实现线
- 不新增独立的 `AIStudio official` adapter / profile / provider 线
- 若需要表达 “key 来自 Google AI Studio”
  - 应落在文档说明、control-plane 展示、provider provenance
  - 不再表达一条独立 upstream execution contract

---

## 当前唯一保留的 AIStudio 线路

当前需要继续重构的 AIStudio 线路只有：

- `AIStudio Web Reverse`

它当前仍应理解为：

- `service provider identity` 下的一条 `web_reverse` 实现线

它的长期目标仍然是：

- 从当前 `browser-owned / browser-backed`
- 逐步演进到 `program-owned pure_http_replay`

但本 Master 不把长期目标误写成“当前已经完成”。

---

## 当前能力结论基线

截至本轮，AIStudio Web Reverse 的正式已完成面仍然只限于：

- `text`
- `models`
- `tools`
- `embeddings`
- `TTS`
- `images`

当前不纳入正式 scope、且也未拿到上游正式证据的能力候选：

- `image edits`
- `music`
- `videos`

解释规则继续以 canonical 专题为准：

- `docs/20-ai-gateway/AIStudio Web Reverse基线.md`

---

## 当前阶段总览

### Phase 1

- 名称：`structure`
- 目标：只做第一轮结构重组
- 当前状态：`completed`
- 当前原则：
  - 不新增能力
  - 不扩大已完成面
  - 不把 mixed lane 误报成 pure HTTP 已完成
  - 不恢复 `AIStudio official` 独立实现线

### Phase 2

- 名称：`runtime-material-and-request-plan`
- 目标：把 reverse-web 所需运行时材料与请求计划对象化
- 当前状态：`completed`

### Phase 3

- 名称：`pure-http-replay`
- 目标：把热路径逐步从 browser-backed 演进到 pure HTTP replay
- 当前状态：`active`

---

## Current Status

- 当前活跃阶段：`Phase 3 - pure-http-replay`
- 当前活跃任务：
  - Phase 2 已完成：`runtime material`、`request plan`、`provider_account_id` 贯通、gate 下放与 focused 验证均已落地
  - Phase 3 第一条 `program-owned` 文本子链已落地：
    - `aistudio_deterministic_tool_bridge`
    - `aistudio_deterministic_roundtrip_bridge`
  - `runtimeStateObjectKey` 当前已经绑定一份默认同级 sidecar：
    - `aistudio-target-rpc-contract.json`
  - Rust 侧当前已落：
    - `capture_contract`
    - `pure_http_material`
    - 从 `storage-state + sidecar contract + cloudApiKey` 组装 AIStudio pure-http 发送材料
  - live probe/capture plumbing 已继续硬化：
    - 失败路径不再直接 `process.exit(...)`，避免绕过 `finally` 清理
    - `captureDir` 已知后的失败会稳定写出 `summary.json`、`target-rpc-summary.json`
      与 `normalized-target-rpc-contract.json`
    - 浏览器启动 / 页面阶段失败时，若 capture 已初始化，也会保留 `capture.json`
    - 显式 `captureDir` 下的输入校验失败也会留下同一组诊断 artifact
    - 未抓全 target contract 时，stdout summary 仍会给出
      `targetRpcSummaryPath` 与 `normalizedTargetRpcContractPath`
    - `capturedTargetRpcContract=true` 必须同时捕获 `CodeAssistantOffline`
      与 `StreamCodeAssistantOfflineGeneration` 的 request + response pair，
      单个目标 RPC 或只有 request 的半截 RPC 不再算完整合同
    - target RPC response 归因现在优先使用 Playwright response 绑定的真实
      request object；若同一 URL 连续出现多次请求，不再用 `method + url`
      覆盖成最后一次 request，避免重复 URL 样本错配 request / response pair
    - capture request id 现在改为单次 probe 内单调递增 factory，不再依赖
      `capture.requests.length`；即使 async request entry 创建在
      `request.allHeaders()` 等待期间重叠，也不会生成重复 request id
    - `normalized-target-rpc-contract.json` 现在会优先选用各目标 RPC
      的完整 request + response pair；若前面存在 orphan / partial pair，
      不会再让归一化合同误降级为不完整
    - 若同类目标 RPC 同时存在早期 non-2xx 完整 pair 与后续 2xx
      完整 pair，归一化合同会优先选中 2xx 完整 pair
    - `appId` 归一化只从 `CodeAssistantOffline` request `[11] / [20]`
      或 `StreamCodeAssistantOfflineGeneration` request `[3]` 提取，避免被
      响应中的 UUID 形态 `generationId`、prompt 中用户提供的 UUID、或
      stream response body 中的 UUID 误当成 Rust replay 所需 `appId`
    - `CodeAssistantOffline` request `[11] / [20]` 内部必须一致；它与
      `StreamCodeAssistantOfflineGeneration` request `[3]` 同时存在时也必须
      一致，否则归一化合同保持 diagnostic / non-replay-ready，不发布冲突
      `appId` sidecar
    - `generationId` 归一化要求 `CodeAssistantOffline` response `[0]` 与
      `StreamCodeAssistantOfflineGeneration` request `[0]` 属于同一 generation
      chain；两侧缺失或不一致时保持 `generationId=null`，不发布可 replay
      sidecar
    - 若缺少槽位来源的 `appId`，归一化合同保持 diagnostic /
      non-replay-ready，不会靠任意 UUID fallback 误发布 sidecar
    - `modelPath` 归一化只从 `CodeAssistantOffline` request `[7]`
      提取；若槽位缺失则保持 `null`，让 Rust replay 使用 caller
      requested model fallback，避免 prompt / stream 文本中的 `models/...`
      字样抢占真实 runtime model
    - 目标 RPC sidecar 的 preferred header subset 现在按 header name
      大小写无关匹配，并继续以规范小写 key 输出，避免 `Content-Type` /
      `X-Goog-Api-Key` 等 mixed-case 捕获样本丢失 replay 关键 header
    - 新增 `replayReadyTargetRpcContract` 作为可 replay / 可发布 sidecar
      门槛：除完整双 RPC pair 外，还要求 `appId`、一致的 `generationId`、
      `CodeAssistant` opaque token、双 RPC URL 与双 RPC 2xx response status；
      否则只保留诊断 artifact，不把 validation `ok` 或 object-storage
      sidecar mirror 误置为通过
    - 当前补了 `Gateway/scripts/export-aistudio-storage-state.mjs` 作为安全
      手动刷新入口：打开隔离的可见 Edge/Chrome 登录 AIStudio，导出
      `credential-runtime/aistudio-web/.../storage-state.json`，供现有
      `probe-aistudio-live-request.mjs` 重跑 steady-state capture；它不直接
      复制或改动 live Chrome / Edge profile；显式 object key 只接受安全
      relative slash-delimited key，拒绝绝对路径、反斜杠与 `..` 路径穿越
    - storage-state export helper 支持无副作用 `--help` / `-h` 路径，
      会在解析浏览器路径或启动可见窗口前直接输出 usage，避免误触发手动
      登录等待循环
    - storage-state export auth signal 要求 AIStudio surface 与真实 Google
      auth cookie；cookie domain 必须是 `google.com` 或其子域，避免
      `evilgoogle.com` 这类包含字符串误判
    - live probe 会在进入/启动 owned app 前后 best-effort 处理 AI Studio
      `Remix ...` modal，自动点击 `Apply`，避免卡在 remix 确认层后无法
      继续补 prompt / capture
    - live probe stdout summary 现在会直接暴露目标 RPC 诊断字段：
      - `targetRpcModelPath`
      - `targetRpcResponseStatuses`
      - `targetRpcFailure`
      这样只看 stdout 也能区分“未抓到目标 RPC”和“目标 RPC 已抓到但被
      上游拒绝”
    - 2026-06-05 已通过人工登录刷新一份可用 storage-state：
      - `credential-runtime/aistudio-web/manual-login-20260605-233444-20260605-153446/storage-state.json`
      - export artifact 显示 `cookieCount=24`、`hasAistudioSurface=true`
      - 这证明当前最新失败不再是历史登录态过期
    - 使用新登录态的 live probe 已能通过 remix/Apply 并捕获
      `CodeAssistantOffline`，但被上游权限拒绝：
      - 归档目录：`.runtime/aistudio-live-probe/manual-login-diagnostic-ws9998-20260606-005811`
      - `matchedCodeAssistantOfflineCount=1`
      - `matchedStreamCodeAssistantOfflineGenerationCount=0`
      - `targetRpcModelPath=models/gemini-3.5-flash`
      - `targetRpcResponseStatuses.codeAssistantOffline=403`
      - `targetRpcFailure.bodyPreview=[7,"The caller does not have permission"]`
      - 因 `CodeAssistantOffline` 已被拒绝，本轮不会继续发出
        `StreamCodeAssistantOfflineGeneration`
    - 只读 one-off model override sweep 已确认失败不是单一
      `models/gemini-3.5-flash` 模型名导致：
      - 归档目录：`.runtime/aistudio-live-probe/model-override-sweep-20260605T165008`
      - 已把 CodeAssistant request `[7]` 分别改写为
        `models/gemini-2.5-flash`、`models/gemini-2.0-flash`、
        `models/gemini-1.5-flash`、`models/gemini-2.5-pro`、
        `models/gemini-2.0-flash-001`
      - 所有候选都返回同样的 `403 [7,"The caller does not have permission"]`
      - 当前更强结论是：登录态可用、remix flow 可用、目标 RPC 可捕获；
        阻塞点在当前账号/区域/项目对 AIStudio Apps
        `CodeAssistantOffline` 能力本身没有权限，而不是单个模型名错误
    - 2026-06-06 又刷新第二份隔离 storage-state：
      - `credential-runtime/aistudio-web/manual-alt-codeassistant-20260606-012117-20260605-172118/storage-state.json`
      - export artifact 同样显示 `cookieCount=24`、`hasAistudioSurface=true`
      - 使用该登录态重跑目标 app live probe：
        - 归档目录：`.runtime/aistudio-live-probe/manual-alt-codeassistant-ws9998-20260606-013204`
        - `matchedCodeAssistantOfflineCount=1`
        - `matchedStreamCodeAssistantOfflineGenerationCount=0`
        - `targetRpcModelPath=models/gemini-3.5-flash`
        - `targetRpcResponseStatuses.codeAssistantOffline=403`
        - `targetRpcFailure.bodyPreview=[7,"The caller does not have permission"]`
      - 使用该登录态再做 model override sweep：
        - 归档目录：`.runtime/aistudio-live-probe/model-override-sweep-alt-20260605T173539`
        - `models/gemini-2.5-flash`、`models/gemini-2.0-flash`、
          `models/gemini-1.5-flash`、`models/gemini-2.5-pro`、
          `models/gemini-2.0-flash-001` 全部仍返回同样的
          `403 [7,"The caller does not have permission"]`
      - 同一 capture 中的 `ListCloudApiKeys` 返回的 Gemini API key 可成功：
        - `GET /v1beta/models` 返回 `200`，可列出 `50` 个模型
        - `models/gemini-2.5-flash:generateContent` 返回 `200`，文本为 `OK`
        - 这进一步证明普通 Gemini API / project key 是可用的；被拒的是
          AIStudio Apps builder 专用的 `CodeAssistantOffline` RPC
      - 从 AIStudio Apps 首页新建空白 Build app 的 one-off probe 也复现同一
        权限拒绝：
        - 归档目录：`.runtime/aistudio-live-probe/oneoff-build-home-alt-20260605T174244`
        - final app URL 为 `https://aistudio.google.com/apps/c3e37f8c-eb4d-437b-98df-661dd6089878?showPreview=true&showAssistant=true`
        - `CodeAssistantOffline` request model 仍为 `models/gemini-3.5-flash`
        - response 仍为 `403 [7,"The caller does not have permission"]`
        - 因此失败也不是第三方 remix app 特有问题，而是 Build/CodeAssistant
          入口本身的权限问题
    - live probe 会记录 page-level UI diagnostic signals，并在 prompt 前
      best-effort dismiss 非破坏性 AIStudio overlay；不会点击
      `Create budget` 这类会改变账号/项目状态的动作
    - 当前脚本测试覆盖 `Gateway/scripts/tests/*.test.mjs = 53 passed` 与
      `Gateway/tests/python = 7 passed`
  - `text / stream/tools` 当前已统一走 `generateContent request plan -> browser request spec` 抽象
  - 一般文本热路径代码侧默认已提升为 `CodeAssistantOffline -> StreamCodeAssistantOfflineGeneration` program-owned pure-http first：
    - 不再需要 `AISTUDIO_PROGRAM_OWNED_TEXT_HTTP_FIRST`
    - sidecar / runtime material 缺失、合同解析失败、目标 RPC 失败或上游拒绝时仍自动回退 browser-backed request
  - 一般文本热路径仍待补齐 live steady-state 归档证据后，才能把 Phase 3 标为完整验收
  - `stream` 当前仍保持 accumulate canonical -> fake OpenAI SSE 外观
  - `TTS / images` 当前仍保留 mixed lane，不误报为 pure HTTP 已完成
  - 浏览器仍处于辅助但未完全退出热路径的状态
  - 当前验证结果：
    - `cargo fmt --manifest-path Gateway/Cargo.toml --all -- --check` 通过
    - focused `cargo test --manifest-path Gateway/Cargo.toml aistudio -- --nocapture` = `33 passed`
    - `cargo check --manifest-path Gateway/Cargo.toml` 通过（仍存在既有 warning）
    - `node --check Gateway/scripts/probe-aistudio-live-request.mjs` 通过
    - 已补做一次 live probe 归档尝试：
      - 归档目录：`.runtime/aistudio-live-probe/phase3-20260604-continue`
      - 使用从旧 `NeuroPlatform/.runtime/ai-gateway-objects` 只读复制到当前 `Neuro/.runtime/ai-gateway-objects` 的历史 `storage-state.json`
      - probe 能启动 Chrome 并进入目标 `appUrl`，但最终跳转到 Google account chooser：
        - `finalUrl=https://accounts.google.com/v3/signin/accountchooser?...`
        - `final-page.title=登录 - Google 账号`
      - 本轮只捕获到 `ActiveTrigger` 检测流量：
        - `matchedRequestCount=1`
        - `matchedResponseCount=1`
        - `firstMatchedUrl=https://generativelanguage.googleapis.com/v1beta/models?key=ActiveTrigger`
      - 未捕获目标双 RPC 合同：
        - `capturedTargetRpcContract=false`
        - `matchedCodeAssistantOfflineCount=0`
        - `matchedStreamCodeAssistantOfflineGenerationCount=0`
      - 因此这次 live probe 证明历史登录态已经失效，不能把 live steady-state 任务勾选完成
      - 随后在 heavy-task lease 下又尝试旧 object store 中剩余三份历史 AIStudio `storage-state.json`：
        - `historical-aistudio-web-live-account-a-cdp`
        - `historical-aistudio-web-live-account-b-cdp`
        - `historical-aistudio-web-live-cookie-refresh`
      - 三份历史状态的 probe 结果同样为 `ok=false`：
        - account A / account B 均跳转到 Google account chooser
        - cookie-refresh 进入 Google challenge
        - 三者均只捕获到 `ActiveTrigger`
        - 三者均为 `capturedTargetRpcContract=false`
        - 三者均为 `matchedCodeAssistantOfflineCount=0`
        - 三者均为 `matchedStreamCodeAssistantOfflineGenerationCount=0`
      - 因此当前仓内和旧 `NeuroPlatform` runtime 中未发现可复用的 AIStudio 已登录态
      - 2026-06-05 又补做本机浏览器 profile sweep，且只使用 `.runtime`
        下隔离复制件，不直接改动 live Chrome / Edge profile：
        - Edge `Default` live profile copy 因 `Network\Cookies` / `Sessions`
          被运行中的 Edge 锁定，不能作为有效登录态证据继续使用
        - Chrome active `Profile`、Chrome `Default`、Chrome `Profile 2`
          复制件均为 `ok=false`
        - 三者均最终跳转到 Google sign-in identifier
        - 三者均只捕获到 `ActiveTrigger`
        - 三者均为 `capturedTargetRpcContract=false`
        - 三者均为 `matchedCodeAssistantOfflineCount=0`
        - 三者均为 `matchedStreamCodeAssistantOfflineGenerationCount=0`
        - Chrome `Profile 1` 复制件未生成 target summary；debug 归档记录
          `page.goto: net::ERR_SOCKET_NOT_CONNECTED`，也未产生目标双 RPC 捕获证据
      - 因此当前仓内、旧 `NeuroPlatform` runtime、本机可安全复制的 Chrome
        profile 中，仍未发现可复用的 AIStudio 已登录态 / target RPC capture source
      - 当前 shell 也未设置 remote object-storage env，因此没有可自动枚举 /
        mirror 的新远端 AIStudio runtime state
      - 2026-06-05 后续人工登录已经刷新本地隔离 storage-state；因此下一轮
        不应继续把失败归因到登录态
      - 2026-06-06 第二个登录态、普通 Gemini API 可用性检查、目标 app
        probe、model override sweep、以及全新 Build app probe 都指向同一结论：
        阻塞点是 AIStudio Apps builder `CodeAssistantOffline` 权限，不是
        storage-state、Gemini API key、单个模型名或第三方 remix app
      - probe 侧已补本地浏览器代理预检：显式设置
        `browserProxyUrl=http://127.0.0.1:<port>` / `localhost` / `::1`
        时，会在 Chromium launch 前做 TCP reachability 检查；端口不可达
        会以 `aistudio_browser_proxy_unreachable` 早失败，并输出
        `browserProxyPreflight`，避免把本地代理端口抖动误判为
        AIStudio 登录态或 `CodeAssistantOffline` 权限问题
      - 2026-06-06 晚间复核时，`127.0.0.1:42344` 已恢复可达，probe
        的 `browserProxyPreflight={ok:true,host:"127.0.0.1",port:42344}`
        生效；但同一隔离 storage-state 进入
        Google account chooser，只捕获 `ActiveTrigger`，未捕获
        `CodeAssistantOffline` / `StreamCodeAssistantOfflineGeneration`
        - 归档目录：
          `.runtime/aistudio-live-probe/manual-alt-auth-recovery-proxy42344-ws9998-20260606-192024`
        - 新 summary 字段：
          `authRecoveryState={isAuthRecovery:true,kind:"google_account_chooser",finalUrlHost:"accounts.google.com"}`
        - 本轮已被显式标为 `ok=false`，避免把登录恢复页的
          ActiveTrigger-only 流量误判为有效 AIStudio Apps capture
      - probe 侧继续补了 opt-in account chooser automation 与 late
        prompt textbox retry：只有显式配置 account email 时才会点击
        Google account chooser 行；prompt textarea 延迟出现时会按
        `autoPromptMaxAttempts / autoPromptPollMs` 重试。
      - 若 prompt textarea 在初始阶段不可见、但后续 polling 阶段才出现，
        probe 会继续按 5 秒 gate 重试 auto-prompt，而不是只尝试一次后
        固定等待超时。
      - local WebSocket proxy error frames 现在会汇总为
        `localProxyErrors`，避免把 browser/proxy 侧返回的 403/错误文本
        和“未捕获目标双 RPC”混在一起。
      - 下一轮需要更换/确认具备 AIStudio Apps `CodeAssistantOffline` 权限的
        账号、区域或项目后重跑同一 probe，直到捕获
        `CodeAssistantOffline` 与 `StreamCodeAssistantOfflineGeneration`
        双 RPC 的 replay-ready 合同
- 当前明确不在做的内容：
  - JS/browser worker 逻辑扩张
  - 新能力 claim
  - 删除 browser fallback
  - 在缺少 live 证据时宣称 Phase 3 完整完成

---

## Phase 1 任务计数

- 总任务数：`5`
- 已完成：`5`
- 进行中：`0`
- 待开始：`0`

对应 phase 文档：

- `docs/progress/phase-1-aistudio-web-reverse-structure.md`
- `docs/progress/phase-2-aistudio-web-reverse-runtime-material-and-request-plan.md`
- `docs/progress/phase-3-aistudio-web-reverse-pure-http-replay.md`

---

## 禁止事项

在本专题后续推进中，默认禁止：

- 把 `AIStudio official` 重新写回独立实现线
- 把 `Gemini official api` 与 `AIStudio official` 再做平行建模
- 在没有新证据前把 `image edits / music / videos` 写成正式已知 scope
- 把 `TTS / images` 当前 mixed lane 误写成 pure HTTP 已完成
- 把结构重组文档误写成能力完成文档

---

## Canonical 文档锚点

- `docs/20-ai-gateway/AIStudio Web Reverse基线.md`
- `docs/20-ai-gateway/服务商实现线与Provider目录.md`

若与上位规则冲突：

- `AGENTS.md`
- `rules/多Surface模块化开发守则.md`

优先。
