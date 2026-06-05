# Phase 3 - AIStudio Web Reverse Pure HTTP Replay

## 目标

本阶段用于把 `AIStudio Web Reverse` 从当前 `browser-backed` 热路径继续推进到：

- `program-owned`
- `pure_http_replay`

当前优先目标不是扩能力面，而是先把最值得迁出的文本主链推进到脱页执行。

---

## 当前正式前提

1. 官方线继续统一归 `gemini official api`
2. `AIStudio` 当前唯一独立线仍是 `AIStudio Web Reverse`
3. Phase 2 已完成：
   - `runtime material`
   - `request plan`
   - mixed lane direct-send / browser-fallback 材料边界
   - browser executor 真实 `provider_account_id` 贯通
4. `stream` 当前仍保持 accumulate canonical -> fake OpenAI SSE 外观

---

## 本阶段范围

本阶段只优先承接以下目标：

- 为 `text / stream / tools` 建立第一条 `program-owned` 文本 replay 主链
- 继续把 browser 的职责收窄到：
  - bootstrap
  - recovery
  - fallback
- 保持 `TTS / images` 当前 mixed lane 结论不变，不误报 pure HTTP 已完成

---

## 本阶段非目标

本阶段明确不包含：

- 把 `image edits / music / videos` 纳入正式 scope
- 在没有 live 证据前宣称 true streaming 已完成
- 删除全部 browser-assisted 能力
- 把 `TTS / images` 提前改写成 pure HTTP 完成

---

## 任务清单

- [x] 落第一条 `program-owned` 文本 replay request/response contract
- [x] 明确 `stream` 继续保持 fake SSE 外观的过渡语义与边界
- [x] 为 target RPC capture sidecar 落 object-key 归档与 Rust 侧消费层
- [x] 把一般文本 hot path 的代码侧默认路径转正为 pure-http first 主链，并保留 browser-backed fallback
- [ ] 补齐 live steady-state 证据，证明默认 pure-http 主链可稳定承接一般文本请求
- [x] 为第一条 pure-http text lane 补 focused 验证与进度归档
- [x] 强化 live probe/capture plumbing，单独沉淀目标双 RPC 合同产物

---

## 当前状态

- Phase：`active`
- 当前结论：
  - Phase 2 已完成
  - 当前已落第一条 `program-owned` 文本子链：
    - `aistudio_deterministic_tool_bridge`
    - `aistudio_deterministic_roundtrip_bridge`
  - Rust 侧已正式对象化：
    - `promptText`
    - `model`
    - `CodeAssistantOffline path`
    - `StreamCodeAssistantOfflineGeneration path`
    - `generationId` 提取
    - 最终文本提取
  - 目标双 RPC 合同当前已具备 sidecar object key：
    - `aistudio-target-rpc-contract.json`
    - 默认与 `runtimeStateObjectKey` 同级
  - Rust 侧当前已能从：
    - `runtimeStateObjectKey`
    - `targetRpcContractObjectKey`
    - `cloudApiKey`
    组装 `AIStudioPureHttpMaterial`
  - 一般文本热路径代码侧默认已提升为 `program-owned pure-http first`
    - 不再需要 `AISTUDIO_PROGRAM_OWNED_TEXT_HTTP_FIRST`
    - sidecar / runtime material 缺失、合同解析失败、目标 RPC 失败或上游拒绝时仍自动回退 browser-backed request
  - 当前真正未完成的是：还没有 live steady-state 归档证据证明这条默认 pure-http 主链稳定承接一般文本请求
  - 下一轮主战场仍是补齐 `program-owned pure_http_replay` 一般文本 live 证据，而不是继续扩 mixed lane 能力

---

## 当前已落地子链

本阶段已落地两层 `program-owned` 文本子链。

第一层是把 browser worker 中已存在的 deterministic 短路上移到 Rust：

- `aistudio_deterministic_tool_bridge`
- `aistudio_deterministic_roundtrip_bridge`

当前语义：

- 这两条子链不再依赖 browser execution
- 它们仍然复用 Gemini `generateContent` response shape 回到现有 Rust parse 链
- 它们不代表 `CodeAssistantOffline -> StreamCodeAssistantOfflineGeneration` 一般文本热路径已经 live 验收

第二层是一般文本代码侧默认路径：

- 默认先尝试 `CodeAssistantOffline -> StreamCodeAssistantOfflineGeneration` capture-contract pure HTTP replay
- 成功后把最终文本重新封装为 Gemini `generateContent` response shape
- 任一材料 / 合同 / 目标 RPC / 上游错误会自动回退 browser-backed request
- 这代表代码默认 hot path 已转正，但还不代表 live steady-state 证据已补齐

---

## 当前 capture plumbing

本阶段当前还新增了一层专用 capture plumbing，用于后续一般文本 steady-state replay 所需的真实合同采样：

- `gateway/scripts/probe-aistudio-live-request.mjs`
  - 已支持 `autoPrompt`
  - 已支持 `failUnlessTargetRpcCaptured`
  - 若抓到目标流量，会额外输出：
    - `target-rpc-summary.json`
    - `01-code_assistant_offline.json`
    - `02-stream_code_assistant_offline_generation.json`
    - 以及更多 numbered pair files
  - 若在 `captureDir` 已知后失败，会稳定输出：
    - `capture.json`（若失败发生在 capture 初始化之后）
    - `summary.json`
    - `target-rpc-summary.json`
    - `normalized-target-rpc-contract.json`
    - stdout JSON 与 `summary.json` 保持一致
  - 若调用方显式传入 `captureDir`，即使输入校验提前失败，也会落同一组诊断 artifact
  - 失败路径不再直接 `process.exit(...)`，而是设置 `process.exitCode`，避免绕过 `finally` 清理浏览器 / context / local websocket server
- `gateway/scripts/export-aistudio-storage-state.mjs`
  - 当前作为 AIStudio 登录态刷新入口：打开隔离的可见 Edge/Chrome，
    等待人工完成 AIStudio 登录后导出 Playwright `storageState`
  - 默认写入 `credential-runtime/aistudio-web/.../storage-state.json`，
    可直接作为 `probe-aistudio-live-request.mjs` 的
    `runtimeStateObjectKey`
  - 不直接复制或改动 live Chrome / Edge profile，避免把正在运行的
    浏览器 profile 当作测试工作目录

当前作用：

- 把 `ActiveTrigger` 之类噪音请求和目标双 RPC 合同显式区分
- 为下一轮一般文本 replay 提供真实 request/response 样本
- 防止 live sweep 中途失败时留下空归档目录或缺少目标 RPC 空摘要
- 防止浏览器启动 / 页面阶段失败时丢失已经初始化的 capture 上下文
- stdout `summary` 即使未抓全双 RPC，也会暴露：
  - `targetRpcSummaryPath`
  - `normalizedTargetRpcContractPath`
  这样下一轮 live sweep 只看 stdout 也能定位诊断 artifact
- `capturedTargetRpcContract=true` 现在必须同时捕获：
  - `CodeAssistantOffline` 的 request + response pair
  - `StreamCodeAssistantOfflineGeneration` 的 request + response pair
  单个目标 RPC、或只有 request 没有 response 的半截 RPC，不再被误报为完整 target contract
- target RPC response 归因现在优先使用 Playwright response 绑定的真实 request
  object；若同一 URL 连续出现多次请求，不再用 `method + url` 覆盖成最后一次
  request，避免重复 URL 样本错配 request / response pair
- capture request id 现在改为单次 probe 内单调递增 factory，不再依赖
  `capture.requests.length`；即使 async request entry 创建在
  `request.allHeaders()` 等待期间重叠，也不会生成重复 request id
- `normalized-target-rpc-contract.json` 现在会优先选用各目标 RPC 的完整
  request + response pair；若前面存在 orphan / partial pair，不会再让归一化
  合同误降级为不完整
- 若同一目标 RPC 先捕获到 rejected / non-2xx 完整 pair，后续又捕获到
  2xx 完整 pair，归一化合同会优先选择 2xx 完整 pair，避免早期失败样本
  抢占可 replay 的成功样本
- `appId` 归一化只从真实请求槽位提取：
  - `CodeAssistantOffline` request `[11] / [20]`
  - `StreamCodeAssistantOfflineGeneration` request `[3]`
  避免把 `CodeAssistantOffline` response `[0]` 里的 UUID 形态
  `generationId` 误当成 Rust replay 所需的 `appId`
- `appId` 不再从完整 `CodeAssistantOffline` request 文本、prompt 文本或
  stream response body 全局扫描 UUID；若缺少槽位来源的 `appId`，归一化
  sidecar 保持 diagnostic / non-replay-ready，不会靠任意 UUID fallback
  误发布不可 replay 的合同
- `CodeAssistantOffline` request `[11] / [20]` 内部必须一致；它与
  `StreamCodeAssistantOfflineGeneration` request `[3]` 同时存在时也必须
  一致，否则归一化 sidecar 保持 diagnostic / non-replay-ready，不发布冲突
  `appId` 合同
- `generationId` 归一化要求 `CodeAssistantOffline` response `[0]` 与
  `StreamCodeAssistantOfflineGeneration` request `[0]` 属于同一 generation
  chain；两侧缺失或不一致时保持 `generationId=null`，不发布可 replay
  sidecar
- `modelPath` 归一化只从 `CodeAssistantOffline` request `[7]` 提取；若槽位
  缺失则保持 `null`，让 Rust replay 使用 caller requested model fallback，
  避免 prompt / stream 文本中的 `models/...` 字样抢占真实 runtime model
- 目标 RPC sidecar 的 preferred header subset 现在按 header name 大小写无关
  匹配，并继续以规范小写 key 输出，避免 `Content-Type` / `X-Goog-Api-Key`
  等 mixed-case 捕获样本丢失 replay 关键 header
- `replayReadyTargetRpcContract=true` 是比 `capturedTargetRpcContract=true`
  更强的可 replay / 可发布 sidecar 门槛，当前要求：
  - 双目标 RPC request + response pair 均已捕获
  - 归一化合同含有 Rust replay 必需的 `appId`
  - 归一化合同含有 CodeAssistant response 与 Stream request 一致的
    `generationId`
  - 归一化合同含有 `codeAssistantOpaqueToken`
  - 双目标 RPC 均有可用 URL
  - 双目标 RPC response status 均为 2xx
- `failUnlessTargetRpcCaptured=true` 的 probe `ok=true` 现在以
  `replayReadyTargetRpcContract=true` 为准；只抓到双 RPC pair 但缺少
  `appId / generationId / codeAssistantOpaqueToken / URL / 2xx status` 时，
  仍会保留诊断 artifact，但不会把本轮 live validation 标成通过
- 只有 replay-ready 的归一化合同才会 mirror 到 object storage sidecar：
  - `aistudio-target-rpc-contract.json`
- 不再把“只抓到普通 AI Studio 流量”误报成“已经抓到 steady-state 文本合同”

当前归一化合同最小字段已经覆盖：

- `appId`
- `modelPath`
- `promptText`
- `generationId`
- `codeAssistantOpaqueToken`
- `finalText`
- 双 RPC 的 `url / requestHeaders / requestBodyPreview / responseStatus / responseHeaders / responseBodyPreview`

---

## 当前流式边界

当前 `stream` 继续保持：

- `accumulate canonical`
- `fake OpenAI SSE facade`

本阶段没有把 AIStudio 一般文本流式误报为 true streaming upstream 完成。

当前默认 pure HTTP first 路径也仍沿用这条边界：

- 上游双 RPC 本身不是 OpenAI SSE
- caller-visible `stream` 仍然通过 canonical accumulate 后再转 fake SSE

---

## 本轮验证

- `cargo fmt --manifest-path Gateway/Cargo.toml --all -- --check`
- `CARGO_TARGET_DIR=C:\t\cargo-aistudio-phase3-default cargo test --manifest-path Gateway/Cargo.toml aistudio -- --nocapture`
- `CARGO_TARGET_DIR=C:\t\cargo-aistudio-phase3-default cargo check --manifest-path Gateway/Cargo.toml`
- `node --check Gateway/scripts/probe-aistudio-live-request.mjs`
- `node --check Gateway/scripts/export-aistudio-storage-state.mjs`
- `node --test Gateway/scripts/tests/probe-aistudio-live-request.test.mjs`
- `node --test Gateway/scripts/tests/export-aistudio-storage-state.test.mjs`
- `node --test Gateway/scripts/tests/*.test.mjs`
- `python -m unittest discover -s Gateway/tests/python -p "test_*.py" -v`
- `node Gateway/scripts/probe-aistudio-live-request.mjs` with:
  - `runtimeStateObjectKey=credential-runtime/aistudio-web-live-account-a-cdp-refresh-20260515-v1/storage-state.json`
  - `captureDir=.runtime/aistudio-live-probe/phase3-20260604-continue`
  - `failUnlessTargetRpcCaptured=true`

当前结果：

- 四条静态 / focused 验证命令均已通过
- `aistudio` focused tests 当前为 `33 passed`
- 本轮新增 focused 覆盖：
  - `program-owned text replay plan`
  - `deterministic tool bridge`
  - `deterministic roundtrip bridge`
  - `CodeAssistantOffline` 请求体槽位构造
  - `StreamCodeAssistantOfflineGeneration` 请求体构造
  - `target RPC contract object key` 推导
  - `pure_http_material` 组装与 capture-aligned headers
  - `generationId` 提取
  - 最终文本提取
- Rust gateway `cargo check` 当前已覆盖：
  - `capture_contract`
  - `pure_http_material`
  - 默认 `program-owned pure-http first` 代码路径
- 2026-06-05 新增 AIStudio storage-state 手动刷新 helper，只补齐
  credential-refresh 操作入口；它还不是 live steady-state 验收证据
- 2026-06-05 replay-ready probe hardening 只改 JS probe / JS test / progress
  docs；本次未重跑 cargo、browser 或 live probe，因此不把本次改动扩展声明为
  Rust/live 新验证
- probe 脚本语法检查已通过，capture plumbing 改动未引入 JS 语法错误
- probe 脚本测试当前覆盖：
  - 失败路径不直接调用 `process.exit(...)`
  - `captureDir` 已知后的失败会写 `summary.json`
  - 失败路径会同时写 `target-rpc-summary.json` 与
    `normalized-target-rpc-contract.json`
  - 显式 `captureDir` 下的输入校验失败也会留下同一组诊断 artifact
  - 浏览器启动失败等 capture 初始化之后的异常也会留下 `capture.json`
  - 单个目标 RPC 不会把 `capturedTargetRpcContract` 误置为 true，必须双 RPC
    都出现且各自具备 request + response pair
  - 重复 identical target RPC URL 的 response 归因会保留真实 request 顺序，
    不会把早期 response 错配到后一次同 URL request
  - 归一化合同会优先选中完整 pair，而不是被更早出现的 orphan / partial
    pair 抢占
  - 若同类目标 RPC 同时存在早期 non-2xx 完整 pair 与后续 2xx 完整
    pair，归一化合同会优先选中 2xx 完整 pair
  - `appId` 只会从 CodeAssistant / Stream 请求槽位提取，不会被响应中的
    UUID 形态 `generationId`、prompt UUID 或 stream response UUID 抢占
  - CodeAssistant `[11] / [20]` 内部冲突，或 CodeAssistant 与 Stream
    两侧请求槽位同时存在但 `appId` 不一致时，合同保持 diagnostic /
    non-replay-ready
  - CodeAssistant response `[0]` 与 Stream request `[0]` 的 generation id
    chain 不一致时，合同保持 diagnostic / non-replay-ready
  - `modelPath` 只会从 CodeAssistant 请求槽位 `[7]` 提取；槽位缺失时保持
    `null`，不会被 prompt / stream 中的 `models/...` 文本抢占
  - 目标 RPC preferred header subset 会大小写无关保留，并以规范小写 key
    写入 normalized sidecar
  - 完整双 RPC pair 若缺少 `appId` / `generationId` / `CodeAssistant`
    opaque token / URL，或目标 RPC response status 非 2xx，不会把 validation
    `ok` 误置为 true，也不会发布不可 replay 的 sidecar mirror
  - 未抓全 target contract 时，stdout summary 仍会给出 target / normalized
    diagnostic artifact 路径
  - request id factory 在单次 probe 内单调递增，且不依赖
    `capture.requests.length`
  - AIStudio storage-state export helper 会生成 slugged / timestamped
    `credential-runtime/aistudio-web/.../storage-state.json` object key，
    且 auth signal 必须同时看到 AIStudio surface 与 Google auth cookie
  - AIStudio storage-state export helper 支持无副作用 `--help` / `-h`，
    会在解析浏览器路径或启动可见窗口前直接输出 usage，避免误触发手动
    登录等待循环
  - AIStudio storage-state export helper 会拒绝绝对路径、反斜杠与 `..`
    segment，避免显式 object key 写出本地 object-storage root
  - AIStudio storage-state export helper 的 Google auth cookie domain 必须是
    `google.com` 或其子域，避免 `evilgoogle.com` 这类包含字符串误判
  - AIStudio live probe 会在进入/启动 owned app 前后 best-effort 处理
    AI Studio `Remix ...` modal，自动点击 `Apply`，避免 modal 阻断后续
    prompt / capture
  - live probe stdout summary 会直接暴露：
    - `targetRpcModelPath`
    - `targetRpcResponseStatuses`
    - `targetRpcFailure`
    后续只看 stdout 即可区分“未抓到目标 RPC”和“目标 RPC 已抓到但被
    上游拒绝”
  - `Gateway/scripts/tests/*.test.mjs` 当前为 `40 passed`
  - `Gateway/tests/python` 当前为 `7 passed`
- 已尝试补 live steady-state 证据：
  - 从旧 `NeuroPlatform/.runtime/ai-gateway-objects` 只读复制历史
    `storage-state.json` 到当前 `Neuro/.runtime/ai-gateway-objects`
  - probe 能启动 Chrome 并进入目标 `appUrl`
  - 最终页面跳转到 Google account chooser：
    - `finalUrl=https://accounts.google.com/v3/signin/accountchooser?...`
    - `final-page.title=登录 - Google 账号`
  - 只捕获到 `ActiveTrigger` 检测流量：
    - `matchedRequestCount=1`
    - `matchedResponseCount=1`
    - `firstMatchedUrl=https://generativelanguage.googleapis.com/v1beta/models?key=ActiveTrigger`
  - 未捕获目标双 RPC 合同：
    - `capturedTargetRpcContract=false`
    - `matchedCodeAssistantOfflineCount=0`
    - `matchedStreamCodeAssistantOfflineGenerationCount=0`
  - 归档文件：
    - `.runtime/aistudio-live-probe/phase3-20260604-continue/summary.json`
    - `.runtime/aistudio-live-probe/phase3-20260604-continue/target-rpc-summary.json`
  - 随后在 heavy-task lease 下又尝试旧 object store 中剩余三份历史 AIStudio
    `storage-state.json`：
    - `historical-aistudio-web-live-account-a-cdp`
      - 归档目录：`.runtime/aistudio-live-probe/phase3-20260604-historical-historical-aistudio-web-live-account-a-cdp`
      - 最终跳转到 Google account chooser
    - `historical-aistudio-web-live-account-b-cdp`
      - 归档目录：`.runtime/aistudio-live-probe/phase3-20260604-historical-historical-aistudio-web-live-account-b-cdp`
      - 最终跳转到 Google account chooser
    - `historical-aistudio-web-live-cookie-refresh`
      - 归档目录：`.runtime/aistudio-live-probe/phase3-20260604-historical-historical-aistudio-web-live-cookie-refresh`
      - 最终进入 Google challenge
  - 三份历史状态的 probe 结果同样为 `ok=false`
  - 三份历史状态均只捕获到 `ActiveTrigger`
  - 三份历史状态均未捕获目标双 RPC 合同：
    - `capturedTargetRpcContract=false`
    - `matchedCodeAssistantOfflineCount=0`
    - `matchedStreamCodeAssistantOfflineGenerationCount=0`
  - 因此当前仓内和旧 `NeuroPlatform` runtime 中未发现可复用的 AIStudio 已登录态
  - 2026-06-05 又补做本机浏览器 profile sweep，全部只使用 `.runtime`
    下的隔离复制件，不直接改动 live Chrome / Edge profile：
    - Edge `Default` live profile copy 因 `Network\Cookies` / `Sessions`
      被运行中的 Edge 锁定，不能作为有效登录态证据继续使用
    - Chrome active `Profile` 复制件：
      - 归档目录：`.runtime/aistudio-live-probe/phase3-20260605-chrome-active-profile-copy`
      - `ok=false`
      - 最终跳转到 Google sign-in identifier
      - 只捕获到 `ActiveTrigger`
      - `capturedTargetRpcContract=false`
      - `matchedCodeAssistantOfflineCount=0`
      - `matchedStreamCodeAssistantOfflineGenerationCount=0`
    - Chrome `Default` 复制件：
      - 归档目录：`.runtime/aistudio-live-probe/phase3-20260605-chrome-default-profile-copy`
      - `ok=false`
      - 最终跳转到 Google sign-in identifier
      - 只捕获到 `ActiveTrigger`
      - `capturedTargetRpcContract=false`
      - `matchedCodeAssistantOfflineCount=0`
      - `matchedStreamCodeAssistantOfflineGenerationCount=0`
    - Chrome `Profile 2` 复制件：
      - 归档目录：`.runtime/aistudio-live-probe/phase3-20260605-chrome-profile-2-copy`
      - `ok=false`
      - 最终跳转到 Google sign-in identifier
      - 只捕获到 `ActiveTrigger`
      - `capturedTargetRpcContract=false`
      - `matchedCodeAssistantOfflineCount=0`
      - `matchedStreamCodeAssistantOfflineGenerationCount=0`
    - Chrome `Profile 1` 复制件：
      - 归档目录：`.runtime/aistudio-live-probe/phase3-20260605-chrome-profile-1-copy-debug`
      - 未生成 target summary
      - `stdout.log` 记录 `page.goto: net::ERR_SOCKET_NOT_CONNECTED`
      - 也未产生 `CodeAssistantOffline` / `StreamCodeAssistantOfflineGeneration`
        捕获证据
  - 因此当前仓内、旧 `NeuroPlatform` runtime、本机可安全复制的 Chrome
    profile 中，仍未发现可复用的 AIStudio 已登录态 / target RPC capture source
  - 当前 shell 未设置 remote object-storage env，因此没有可自动枚举 /
    mirror 的新远端 AIStudio runtime state
  - 2026-06-05 后续已通过人工登录刷新一份可用 storage-state：
    - `credential-runtime/aistudio-web/manual-login-20260605-233444-20260605-153446/storage-state.json`
    - export artifact 显示 `cookieCount=24`、`hasAistudioSurface=true`
    - 这证明当前最新失败不再是历史登录态过期
  - 使用新登录态重跑 live probe 后，已经能通过 remix/Apply 并捕获
    `CodeAssistantOffline`，但该目标 RPC 被上游权限拒绝：
    - 归档目录：`.runtime/aistudio-live-probe/manual-login-diagnostic-ws9998-20260606-005811`
    - `matchedCodeAssistantOfflineCount=1`
    - `matchedStreamCodeAssistantOfflineGenerationCount=0`
    - `targetRpcModelPath=models/gemini-3.5-flash`
    - `targetRpcResponseStatuses.codeAssistantOffline=403`
    - `targetRpcFailure.bodyPreview=[7,"The caller does not have permission"]`
    - 因 `CodeAssistantOffline` 已被拒绝，本轮没有发出
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

因此当前不能把 live steady-state 任务勾选完成。下一轮不应继续把失败
归因到登录态。2026-06-06 第二个登录态、普通 Gemini API 可用性检查、
目标 app probe、model override sweep、以及全新 Build app probe 都指向
同一结论：阻塞点是 AIStudio Apps builder `CodeAssistantOffline` 权限，
不是 storage-state、Gemini API key、单个模型名或第三方 remix app。
下一轮需要更换/确认具备 AIStudio Apps `CodeAssistantOffline` 权限的
账号、区域或项目，再重跑同一 probe，直到捕获 `CodeAssistantOffline`
与 `StreamCodeAssistantOfflineGeneration` 双 RPC。
