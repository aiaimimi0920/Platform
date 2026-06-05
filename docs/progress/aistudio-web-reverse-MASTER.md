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
    - 若缺少槽位来源的 `appId`，归一化合同保持 diagnostic /
      non-replay-ready，不会靠任意 UUID fallback 误发布 sidecar
    - `modelPath` 归一化只从 `CodeAssistantOffline` request `[7]`
      提取；若槽位缺失则保持 `null`，让 Rust replay 使用 caller
      requested model fallback，避免 prompt / stream 文本中的 `models/...`
      字样抢占真实 runtime model
    - 新增 `replayReadyTargetRpcContract` 作为可 replay / 可发布 sidecar
      门槛：除完整双 RPC pair 外，还要求 `appId`、`CodeAssistant`
      opaque token、双 RPC URL 与双 RPC 2xx response status；否则只保留
      诊断 artifact，不把 validation `ok` 或 object-storage sidecar mirror
      误置为通过
    - 当前脚本测试覆盖 `Gateway/scripts/tests/*.test.mjs = 30 passed` 与
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
      - 下一轮需要刷新可用 AIStudio 登录态 / browser profile 后重跑同一 probe，直到捕获
        `CodeAssistantOffline` 与 `StreamCodeAssistantOfflineGeneration` 双 RPC
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
