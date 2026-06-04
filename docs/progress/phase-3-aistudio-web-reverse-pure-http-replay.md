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

当前作用：

- 把 `ActiveTrigger` 之类噪音请求和目标双 RPC 合同显式区分
- 为下一轮一般文本 replay 提供真实 request/response 样本
- 已把归一化合同 mirror 到 object storage sidecar：
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
- probe 脚本语法检查已通过，capture plumbing 改动未引入 JS 语法错误
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

因此当前不能把 live steady-state 任务勾选完成。下一轮需要先刷新可用
AIStudio 登录态 / browser profile，再重跑同一 probe，直到捕获
`CodeAssistantOffline` 与 `StreamCodeAssistantOfflineGeneration` 双 RPC。
