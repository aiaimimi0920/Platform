# AIStudio Web Reverse 基线

## 目的

本文档用于承接历史 AIStudio web reverse 平台基线中仍然需要长期保留的专题结论。

---

## 1. 当前正式定位

`AIStudio Web Reverse` 当前应理解为：

- `service provider identity` 下的一条 `web_reverse` 实现线

它不是：

- 官方 model API
- 通用 browser-backed 杂项能力

补充边界：

- 使用 AIStudio 官方页面创建或管理的 Gemini 官方 API key
  - 当前统一仍归 `gemini official api`
  - 不再单独建 `AIStudio official` 独立实现线
- 因此本文只讨论：
  - `AIStudio Web Reverse`
  - 不承接 Gemini 官方 API 的建模

当前还必须同时固定一条高层收口：

- 使用 Google AI Studio 官方 API key 调官方 Gemini API 的路径
  - 统一归入 `Gemini Platform / official_api`
  - 当前 canonical 对应：
    - `google_gemini_api`
    - `google_vertex_gemini`
- 不再存在 `AIStudio official` 独立实现线
- `AIStudio official api` 这个说法若仍被使用
  - 只允许表达 key 来源 / 产品入口 / operator 文案
  - 不再表达一条独立 upstream execution contract

---

## 2. 当前已确认的 owner 语义

截至当前归档阶段，AIStudio 这条线的最新 owner 真相应分能力理解：

- `text / stream / tools` 的代码侧默认热路径已经转为 `program-owned pure_http_replay first`
- browser-owned / browser-backed execution 仍保留为 bootstrap / recovery / fallback
- `embeddings` 当前仍归 `browser-owned / browser-backed`
- `TTS / images` 当前仍归 `mixed implementation`

其中：

- 顶层页面 owner 仍是页面态工作流
- remote browser executor 是当前正式优先路径
- `run.app local bridge` 仅是必要环境唤醒/占位链，不应误升为主 owner
- 当前 Phase 3 已落第一条 `program-owned` 文本子链，但范围仍只限于 deterministic bridge：
  - `aistudio_deterministic_tool_bridge`
  - `aistudio_deterministic_roundtrip_bridge`
  - 它们不依赖 browser execution，但也不是一般文本上游 RPC replay 的全部
- 当前 Phase 3 已把一般文本热路径的代码侧默认路径提升为 `program-owned pure-http first`：
  - 输入材料：
    - `runtimeStateObjectKey`
    - `aistudio-target-rpc-contract.json`
    - `cloudApiKey`
  - 无需再设置 `AISTUDIO_PROGRAM_OWNED_TEXT_HTTP_FIRST`
  - 若 sidecar / runtime material 缺失、合同解析失败、目标 RPC 失败或上游拒绝，仍自动回退 browser-backed request
  - 在拿到 live 稳定证据前，它只能视为“代码侧默认 hot path 已转正”，不得误报为“live steady-state 已完整验收”
- 当前 `/v1/audio/speech` 的 caller-visible 成功路径虽然仍归属于 `browser_state`
  凭证体系，但发送期优先走：
  - `cloudApiKey direct-http fast path`
  - 失败后才回退 browser-backed request
- 当前 `/v1/images/generations` 也沿用同一条：
  - `cloudApiKey direct-http fast path`
  - 失败后才回退 browser-backed request
- 当前 `runtimeStateObjectKey` 不再作为所有 live 路径的统一解析期硬门槛：
  - direct-http mixed lane 可先从 `cloudApiKey` 材料起步
  - 只有 browser-backed request / browser executor / local browser worker 仍强制要求 `runtimeStateObjectKey`

---

## 3. 当前能力面理解

当前这条线的已验证能力面，应按实际回归归档理解，包括：

- text / stream / tools
- `/v1/models`
- `/v1/embeddings`
- `/v1/audio/speech`
- `/v1/images/generations`

当前不纳入正式 scope、且也未拿到上游正式证据的候选能力：

- `image edits`
- `music`
- `videos`

但当前这些能力还不能自动视为 `AIStudio Web Reverse` 的正式既定 scope。
截至本轮核对：

- 参考实现 `AIStudioToAPI`
- 其 README / API examples / client-side request filtering

都只明确覆盖：

- `text`
- `image generation`
- `TTS`
- `embeddings`

因此在上游产品面或参考实现没有新增正式证据前：

- `image edits / music / videos`
  - 当前应视为 `未证明属于 AIStudio 正式能力域`
  - 不是本线 Phase 1 的默认承诺面

其中当前已完成能力的正式 owner 语义还要继续细分：

- text / stream / tools
  - 当前代码侧默认 send path：
    - `program-owned capture-contract pure_http_replay -> browser-backed fallback`
  - `stream` 仍保持 `accumulate canonical -> fake OpenAI SSE facade`
  - 当前已新增：
    - 一条极小的 `program-owned deterministic bridge` 子链
    - 一条默认启用的 `program-owned pure-http first` 一般文本子链
  - live steady-state 归档证据仍是完成结论的必要条件
- embeddings
  - 当前主 owner 仍是 `browser-owned / browser-backed`
- `/v1/audio/speech`
  - `mixed implementation`
  - `direct send material = cloud_api_key`
  - `browser fallback material = browser_state`
  - `send path = cloudApiKey direct-http fast path -> browser-backed fallback`
- `/v1/images/generations`
  - `mixed implementation`
  - `direct send material = cloud_api_key`
  - `browser fallback material = browser_state`
  - `send path = cloudApiKey direct-http fast path -> browser-backed fallback`

能力完成度与矩阵归档，仍应以：

- `AI网关测试与验收总线.md`

的规则解释，而不是单凭本文一句话下结论。

补充约束：

- 本节中 `text / stream / tools`
  - 表达的是当前 text family 下 caller-visible 已验证路径
  - 不应被误读成在正式 scope 里新增一个独立于 `text` 的新能力桶

---

## 4. 当前与总线文档的关系

本文是以下文档的 provider 专题补充：

- `AI网关总基线.md`
- `AI网关运行时与会话总线.md`
- `AI网关测试与验收总线.md`
- `服务商实现线与Provider目录.md`

若与上述上位文档冲突：

- 以上位文档为准

---

## 5. 第一轮结构重组边界

当前专题已进入 `AIStudio web reverse` 第一轮结构重组。

这一轮的目标仅限于：

1. 把 `AIStudio web reverse` 从历史巨型文件使用方式中逐步抽出
2. 为后续 `protocol/aistudio/common + web_reverse` 与 `upstream/aistudio/common + web_reverse` 结构铺路
3. 把“官方线统一归 `gemini official api`”这条规则写入新的 canonical 文档与 progress 文档

这一轮明确不做：

- 不新增 `AIStudio official` 线
- 不新增任何 Rust / JS 能力 claim
- 不把当前 mixed lane 误报成 `pure_http_replay` 已完成
- 不把 `image edits / music / videos` 提前升级为正式 scope

因此本轮文档更新只应理解为：

- `结构重组进度回归`
- `能力结论回归`

而不是：

- `能力扩张`
- `已进入纯 HTTP 热路径`

当前执行跟踪文档：

- `docs/progress/aistudio-web-reverse-MASTER.md`
- `docs/progress/phase-1-aistudio-web-reverse-structure.md`

---

## 6. 当前旧来源

本文当前主要吸收：

- `legacy source: AI-gateway-aistudio-web-reverse-platform-baseline.md`

---

## 7. 当前正式结论

从现在开始：

- AIStudio Web Reverse 已有新的 canonical 专题
- 旧 AIStudio baseline 默认退为参考层
- `gemini official api`
  - 当前仍是唯一官方线
  - 不新增 `AIStudio official` 独立实现线
- 当前 Phase 1 的正式已完成面是：
  - `text`
  - `models`
  - `tools`
  - `embeddings`
  - `TTS`
  - `images`
- 第一轮结构重组
  - 当前只是在整理 ownership、目录与执行跟踪
  - 不是新增能力
- 其中：
  - `text / tools / embeddings` 当前已完成 `browser-owned` 主线
  - `TTS / images` 当前已完成 caller-visible closure，但 owner 仍是 `mixed lane`
  - 不得误报成“纯 browser-owned page relay 已完成”
- 当前 `images` 的正式归档应以：
  - `output/aistudio-web-reverse-images-fixture-20260506-v4/summary.json`
  - `output/aistudio-web-reverse-live-browser-owned-images-20260506-v4/summary.json`
  为准
- 参考实现与当前专题证据均指向：
  - `AIStudio Web Reverse` 的当前正式 scope = `text / models / tools / embeddings / TTS / images`
- `image edits / music / videos`
  - 只有在后续拿到明确上游产品面或参考实现证据时，才重新纳入待实现波次
  - 第一轮结构重组期间，不得借重组名义把它们提前升级为已纳入 scope
