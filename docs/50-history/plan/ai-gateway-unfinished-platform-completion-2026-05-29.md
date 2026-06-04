# AI Gateway 未完成平台实现线收口计划（2026-05-29）

## 目标

把当前 AI Gateway 中仍未达到 `已通过` 的服务商，按统一实现线口径补齐到可验证的工程基线：

- operator create catalog 有稳定默认服务商字段
- Rust gateway 有实现线 identity 与可选编译 feature
- line manifest 可被 strict validator 发现
- 单行 provider credential 能按 service-provider / surface / material-kind 目录导入导出
- docs/20-ai-gateway 下有正式专题或已升级的正式基线
- 没有真实 live key / session 时，状态只前移到 `部分覆盖`，不虚报 `已通过`

本计划执行时必须以当前代码和当前 `docs/20-ai-gateway/AI网关平台、实现线、Surface与能力总表.md` 为准；旧记忆、旧计划和旧口头结论只能作为线索，不能替代当前校验。

## 当前收口对象

### 原 `待专题化` 对象

- xAI OpenAI-compatible
- Perplexity Chat
- FreeBuff
- XFYun OpenAI-compatible
- XFYun Native WebSocket
- Producer.ai Platform
- Kiro-compatible

### 原 `部分覆盖` 对象

- Qwen Platform
- ChatGPT Platform
- OpenAI Platform
- Perplexity Search
- Tavily Search
- Exa Search
- Jina Search
- Jina Reader
- Linkup Search
- You.com Search
- WebSearchAPI Search
- Suno
- Udio Platform
- LumaLabs

其中 Search family、Suno、Udio、LumaLabs 在先前工作中已经有较完整工程基线；本轮重点先把原 `待专题化` 七项清零，并保持剩余 `部分覆盖` 状态诚实。

## 执行规则

1. 必须使用 feature 子工作树开发，不直接在主工作树改代码。
2. Rust heavy 任务必须通过 `deploy/claim-heavy-task.ps1` 与 `deploy/release-heavy-task.ps1` 协调。
3. 新实现线必须先补测试，再补最小代码；至少覆盖：
   - implementation line profile mapping
   - payload inference
   - provider credential folder sync
   - operator catalog 默认字段
4. line manifest 必须通过 `deploy/validate-gateway-line-manifests.py --mode strict`。
5. 合并前必须运行 fresh verification；没有真实 provider 凭证时，不把 live 缺口写成实现完成。

## 本轮文件范围

### Rust gateway

- `gateway/Cargo.toml`
- `gateway/src/implementation_lines.rs`
- `gateway/src/provider_credential_folder_sync.rs`
- `gateway/manifests/lines/`

### Web operator

- `web/src/app/ops/gateway/providers/provider-create-catalog.ts`
- `web/src/app/ops/gateway/providers/provider-create-catalog.test.ts`

### Canonical docs

- `docs/20-ai-gateway/README.md`
- `docs/20-ai-gateway/已完成平台.md`
- `docs/20-ai-gateway/AI网关平台、实现线、Surface与能力总表.md`
- `docs/20-ai-gateway/服务商实现线与Provider目录.md`
- `docs/20-ai-gateway/AI网关FreeBuff兼容Provider接入基线.md`
- `docs/20-ai-gateway/examples/credentials/README.md`

本轮新增或补齐的专题文档位于 `docs/20-ai-gateway/`，新增凭证样例位于 `docs/20-ai-gateway/examples/credentials/`。

## 任务分解

### Task 1：校正文档真相层

- 修复 AI Gateway README 中已经漂移的链接。
- 把 `已完成平台` 调整为派生索引，不再把 `部分覆盖` 或 `待专题化` 平台列入 `已通过`。
- 保持 `AI网关平台、实现线、Surface与能力总表` 为状态真相层。

验收：

- docs/20 下本地链接检查通过。
- `已完成平台` 与总表状态不矛盾。

### Task 2：operator catalog TDD

- 为原 `待专题化` 平台补 operator create catalog 默认字段测试。
- 补齐 xAI、Perplexity Chat、FreeBuff、XFYun、Producer.ai、Kiro 的默认 service provider key / label / base URL。

验收：

- `node --test --import tsx web/src/app/ops/gateway/providers/provider-create-catalog.test.ts` 通过。

### Task 3：implementation line TDD

- 新增并验证以下 line feature：
  - `line-xai-openai-official-vendor-api`
  - `line-perplexity-chat-official-vendor-api`
  - `line-xfyun-openai-official-vendor-api`
  - `line-xfyun-native-websocket-official-vendor-api`
  - `line-freebuff-web-reverse-api`
  - `line-producer-web-reverse-api`
- 保留既有 `line-kiro-official-vendor-api`。
- 补 profile mapping 与 payload inference 测试。

验收：

- no-default-features + 单线 feature 的 targeted cargo tests 通过。

### Task 4：credential folder sync TDD

- 为原 `待专题化` 平台补 service-provider / surface / material-kind 目录推导。
- 明确 Producer.ai 的 `producer-images / producer-music / producer-videos` surface 不被压成同一个 operator surface。
- 明确 XFYun native websocket 的目录 material kind 为 `api-key`，字段层仍包含 APPID、APIKey、APISecret。

验收：

- `provider_credential_folder_sync::tests::derive_provider_surface_slug_maps_remaining_unfinished_platform_lines` 通过。

### Task 5：manifest 与 credential docs

- 为 xAI、Perplexity Chat、FreeBuff、XFYun 两线、Producer.ai 补 line manifest。
- 更新 Kiro manifest 的 docs / credential example 路径。
- 补 minimal raw sample、字段说明和最小验证说明。

验收：

- `py -3 deploy/validate-gateway-line-manifests.py --mode strict` 通过。
- `deploy/verify-gateway-line.ps1 -ListOnly` 能列出新增 line。

### Task 6：状态前移与诚实收口

- 原 `待专题化` 七项前移为 `部分覆盖`。
- 不把缺少真实 live key / browser session 的线写成 `已通过`。
- 在总表和 provider 目录中明确后续 live 阻塞是外部凭证 / session / entitlement 条件，而不是当前工程基线缺口。

验收：

- 总表中不再保留本轮七项的 `待专题化` 状态。
- `已完成平台` 仍只列真正 `已通过` 的平台。

## 合并策略

1. feature 子工作树完成实现和验证。
2. feature 分支分批 commit：
   - 文档真相层
   - catalog / implementation line / folder sync
   - manifest / credential docs /状态同步
3. 回到主工作树 main。
4. 确认 main 未被其他工作推进；如已推进，先 fast-forward / rebase 或 merge 最新主线。
5. 将 feature 分支 merge 回 main。
6. 主工作树重新运行关键验证并报告：
   - git head
   - git status
   - 关键测试命令与结果
   - 哪些平台仍是 `部分覆盖` 以及为什么不能诚实升为 `已通过`
