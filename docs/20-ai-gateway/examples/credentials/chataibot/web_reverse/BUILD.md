# ChatAIBot `web_reverse` 可选编译与最小验证

## Line Identity

- 平台：`ChatAIBot`
- 实现线：`web_reverse`
- operator create key：`chataibot-images`
- `protocolProfile`：`chataibot`
- `protocolFamily`：`chataibot_images`
- adapter：`chataibot_compatible`

## 当前“可选编译”的正式语义

当前这条线的“可选编译 / 最小验证”已正式收口为：

1. 独立 `CARGO_TARGET_DIR`
2. focused cargo tests，只覆盖 ChataIBot 图片线 owner
3. focused regression suites：
   - `chataibot_images_fixture`
   - `chataibot_images_live`

这不是 Cargo `features` 级别的 provider 裁剪编译。

当前正式语义是：

- **实现线级 owner + 实现线级 focused 验证上下文**

## 当前主代码 owner

- `gateway/src/protocol/chataibot/mod.rs`
- `gateway/src/protocol/chataibot/models.rs`
- `gateway/src/protocol/chataibot/request.rs`
- `gateway/src/protocol/chataibot/multipart.rs`
- `gateway/src/protocol/chataibot/response.rs`
- `gateway/src/upstream/chataibot.rs`
- `gateway/src/provider_credential_folder_sync.rs`
- `web/src/app/ops/gateway/providers/provider-create-catalog.ts`

## 推荐的独立编译目录

当前 Windows 环境下，建议显式使用较短的独立 `CARGO_TARGET_DIR`，避免长路径把 `boring-sys2` / CMake / MSBuild 链打坏。

当前这条线的推荐值：

```powershell
$env:CARGO_TARGET_DIR='C:\ctgt\np-chataibot'
```

## 当前 focused cargo 验证入口

最小 Rust 回归：

```powershell
$env:CARGO_TARGET_DIR='C:\ctgt\np-chataibot'
cargo test --manifest-path gateway/Cargo.toml chataibot -- --nocapture
```

这组当前至少覆盖：

- 模型 spec
- `response_format=url / b64_json`
- aspect ratio 映射
- data URI / object upload 解析
- multipart body 组装
- OpenAI image response 组装
- folder sync import normalization
- provider surface slug / nested export path
- 本地拒绝非图片 endpoint
- 本地拒绝 mask edit

额外建议最小点测：

```powershell
$env:CARGO_TARGET_DIR='C:\ctgt\np-chataibot'
cargo test --manifest-path gateway/Cargo.toml merge_provider_payload_preserves_non_empty_account_values_when_overlay_is_blank -- --nocapture
```

它固定回归一个当前已经真实踩过的坑：

- provider credential 空字符串不得覆盖 provider account 里的 `baseUrl`

## 当前 focused suites

### 1. Fixture

```powershell
py -3 deploy/test-gateway-protocol-matrix.py `
  --suite chataibot_images_fixture `
  --run `
  --gateway-base-url http://127.0.0.1:42368
```

当前 fixture 覆盖：

- `generation.url`
- `generation.b64`
- `edit.single`
- `edit.merge`
- `/v1/models`

### 2. Live

```powershell
py -3 deploy/test-gateway-protocol-matrix.py `
  --suite chataibot_images_live `
  --run `
  --gateway-base-url http://127.0.0.1:42368
```

当前 live bootstrap 顺序已固定为：

1. 显式 `GATEWAY_CHATAIBOT_LIVE_CREDENTIAL_PATH`
2. canonical `~/.neuro/chataibot-platform/chataibot-images/session-auth/*.json`
3. 环境变量：
   - `GATEWAY_CHATAIBOT_LIVE_AUTH_TOKEN`
   - `GATEWAY_CHATAIBOT_LIVE_COOKIE`
4. 最后才回退到仓库内辅助脚本：
   - `gateway/scripts/chataibot-session-worker.mjs`

当前 live 覆盖：

- `generation.url`
- `generation.b64`
- `edit.single`
- `edit.merge`
- `/v1/models`

其中当前 live 的正式判定口径是：

- `generation.url / generation.b64 / models`
  - 必须 caller-visible 成功
- `edit.single / edit.merge`
  - 若命中 provider 明确返回的 free-tier quota gate
    - `403`
    - `NotEnoughFreeLimitAnswerCountError`
  - 当前按 **quota gate accepted** 理解，可视为实现线完成

额外注意：

- `generation.url / generation.b64` 依赖当前 free-tier 账号仍有剩余图片生成额度
- 若 live bootstrap 阶段的健康 free model probe 对：
  - `qwen-lora`
  - `google-nano-banana-2`
  都返回 `http_403`
- 默认先排查：
  1. 当前凭证对应账号是否已经耗尽 free-tier 生成额度
  2. 是否需要更换另一份活凭证
- 不要先把它当成 ChataIBot owner 代码回退

## 当前已验证的正式结果

- fixture：
  - `output/chataibot_images_fixture_20260517_v3`
  - `5/5`
- live：
  - `output/chataibot_images_live_20260517_v4`
  - `5/5`
- file-first bootstrap：
  - `output/chataibot_images_live_filefirst_20260517_v1`
  - `tokenSource = file:...manual-live-test.json`

## 当前不应混入本线的内容

不要把下面这些内容继续混回 ChataIBot 正式主线：

1. 文本聊天
2. 音频 / 视频 / 搜索
3. 浏览器逐请求 relay owner

当前 ChataIBot 的正式主线固定理解为：

- **图片专用**
- **session-backed direct HTTP replay**
