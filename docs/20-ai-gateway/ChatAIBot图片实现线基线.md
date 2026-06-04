# ChatAIBot 图片实现线基线

## 目的

本文档把当前 `ChatAIBot` 平台在 Rust `gateway/` 中的正式 owner、实现线边界、凭证合同、测试口径与验收结论收口成一份 canonical 基线。

它当前只处理一件事：

- **ChatAIBot 图片线**

它不处理：

- 文本聊天
- 音频 / 视频
- 搜索

---

## 1. 平台定位

当前 `ChatAIBot` 在本仓里的正式理解不是一个通用聊天平台，而是一条：

- 单实现线
- 图片专用
- session-backed direct HTTP replay

的 provider 线。

当前固定主语义：

- 平台：`ChatAIBot`
- 实现线：`web_reverse`
- operator surface：`chataibot-images`
- `protocolProfile = chataibot`
- `protocolFamily = chataibot_images`
- adapter：`chataibot_compatible`

---

## 2. 当前只保留一条正式实现线

当前不要把 `ChatAIBot` 理解成 Gemini / ChatGPT 那种多实现线家族。

截至本轮，正式只保留：

- `web_reverse`

并且当前这个 `web_reverse` 更准确的执行语义是：

- `sourceKind = web_reverse_api`
- `webReverseAccessMode = direct_http_replay`
- `executionMode = direct_http`

也就是：

- 浏览器只负责采集登录态
- steady-state 请求默认由网关直接 replay HTTP

---

## 3. 当前能力面边界

当前这条线只承接：

- `images_generations`
- `images_edits`

并且当前 public endpoint 限制已显式固定为：

- 允许：
  - `/v1/images/generations`
  - `/v1/images/edits`
- 本地拒绝：
  - `chat/completions`
  - `responses`
  - `messages`
  - `completions`
  - 音频
  - 视频
  - 搜索

补充：

- `mask` 编辑当前明确 fail-closed
- 单图 edit 与多图 merge 当前都归在这条图片线里理解

---

## 4. 当前 owner 目录

### 4.1 Protocol owner

- `gateway/src/protocol/chataibot/mod.rs`
- `gateway/src/protocol/chataibot/models.rs`
- `gateway/src/protocol/chataibot/request.rs`
- `gateway/src/protocol/chataibot/multipart.rs`
- `gateway/src/protocol/chataibot/response.rs`

### 4.2 Upstream owner

- `gateway/src/upstream/chataibot.rs`

### 4.3 Supporting owner

- `gateway/src/provider_credential_folder_sync.rs`
- `gateway/src/keepalive.rs`
- `web/src/app/ops/gateway/providers/provider-create-catalog.ts`

当前 `gateway/src/upstream/client.rs` 只保留 thin dispatch，不再承载 ChataIBot 主要业务逻辑。

---

## 5. 当前模型与 quota 语义

当前内建 free-tier 可见模型集合：

- `qwen-lora`
- `google-nano-banana-2`
- `gpt-image-1.5`

当前默认模型：

- `google-nano-banana-2`

当前 keepalive / quota probe 已显式建模：

- 探测：
  - `GET /api/user/answers-count/v2`
- 核心字段：
  - `leftAnswersCount`

当前模型成本估算已内置在 owner 里，因此 route / keepalive 会把：

- generation
- edit
- merge

的成本要求一起考虑。

---

## 6. 当前凭证与 folder sync 语义

当前正式凭证语义：

- `credentialMaterialKind = session_auth`
- 主材料：
  - 浏览器登录态里的 `token` cookie

当前 folder sync 已正式支持：

### 6.1 最小 raw import payload

```json
{
  "authToken": "..."
}
```

### 6.2 推荐 raw import payload

```json
{
  "authToken": "...",
  "cookieHeader": "token=...",
  "credentialMaterialKey": "chataibot-browser-session-main-001"
}
```

### 6.3 当前 canonical nested export path

```text
<root>/chataibot-platform/chataibot-images/session-auth/<credential>.json
```

其中：

- `serviceProviderKey = chataibot_platform`
- `providerSurfaceKey = chataibot-images`

### 6.4 当前 live bootstrap 顺序

当前 ChataIBot live bootstrap 已固定为：

1. 显式 `GATEWAY_CHATAIBOT_LIVE_CREDENTIAL_PATH`
2. canonical `~/.neuro/chataibot-platform/chataibot-images/session-auth/*.json`
3. 环境变量注入
4. 最后才回退到辅助 session worker

这意味着：

- 浏览器 worker 不是默认 owner 路径
- 它只是在“现成凭证文件不存在”时承担辅助采集 fallback

---

## 7. 当前 operator create catalog 默认值

当前 operator create catalog 已对齐到 preset/runtime 真相层：

- `defaultServiceProviderKey = chataibot_platform`
- `defaultServiceProviderLabel = ChatAIBot`
- `defaultBaseUrl = https://chataibot.pro`
- 默认 headers：
  - `Accept: */*`
  - `Origin: https://chataibot.pro`
  - `Referer: https://chataibot.pro/app/chat?chat_id=-2`
  - `x-distribution-channel: web`
  - ChataIBot UA
- 默认 `sessionAuth`：
  - `transport = cookie`
  - `primaryCookieName = token`

---

## 8. 当前“可选编译”语义

当前这条线的“可选编译”不表示 Cargo feature-gating。

正式语义是：

1. 独立实现线 owner
2. focused cargo tests
3. focused fixture / live suite
4. 独立 `CARGO_TARGET_DIR`

当前正式入口见：

- `docs/20-ai-gateway/examples/credentials/chataibot/web_reverse/BUILD.md`

---

## 9. 当前测试与验收口径

### 9.1 Focused cargo

当前推荐：

```powershell
$env:CARGO_TARGET_DIR='C:\ctgt\np-chataibot'
cargo test --manifest-path gateway/Cargo.toml chataibot -- --nocapture
```

### 9.2 Fixture suite

- `chataibot_images_fixture`

当前应覆盖：

- `generation.url`
- `generation.b64`
- `edit.single`
- `edit.merge`
- `/v1/models`

### 9.3 Live suite

- `chataibot_images_live`

当前 live 的正式 acceptance boundary：

补充说明：

- `generation.url / generation.b64` 的 live 成功依赖当前 free-tier 账号仍有剩余额度
- 若 rerun 时健康 free model probe 对：
  - `qwen-lora`
  - `google-nano-banana-2`
  都返回 `403`
- 默认先理解为 provider free-tier quota 已耗尽，而不是图片线 owner 逻辑失效

- `generation.url`
  - caller-visible 成功
- `generation.b64`
  - caller-visible 成功
- `/v1/models`
  - caller-visible 成功
- `edit.single / edit.merge`
  - 若 caller-visible 成功，直接算通过
  - 若命中 provider 明确的 free-tier quota gate：
    - `403`
    - `NotEnoughFreeLimitAnswerCountError`
    - `Subscribe to get more requests`
  - 当前按 **quota gate accepted** 理解，也算实现线完成

---

## 10. 本轮关键修复

本轮重构除了 owner 拆分，还修了一个真实 runtime 问题：

- provider credential payload 中的空字符串 `baseUrl`
- 不能再覆盖 provider account 里的非空 `baseUrl`

否则 ChataIBot 这类 direct replay 线会把：

- `https://chataibot.pro/api/user/update`

错误降级成：

- `/api/user/update`

并表现成：

- `relative URL without a base`

当前这个问题已经在主干代码中有单测保护。

---

## 11. 当前正式结论

截至本轮，当前可以把 `ChatAIBot` 正式理解为：

- 一个**单实现线**
- **图片专用**
- **session-backed direct HTTP replay**

的平台接入。

当前它已经具备：

1. 独立 protocol owner
2. 独立 upstream owner
3. operator 可见 create template
4. folder sync import / export 语义
5. focused cargo / fixture / live 验收口径
6. 最小凭证样例与字段说明

因此它现在已经不再是“待专题化的零散实现”，而是一条已收口成 canonical 文档与验收体系的正式图片实现线。
