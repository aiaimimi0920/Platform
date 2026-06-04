# Suno、Udio Platform、LumaLabs 平台实现线重构开发计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` 或 `executing-plans` 按任务逐项执行。每个任务完成后必须更新对应 canonical 文档、运行指定验证，并做一次小提交。步骤使用 checkbox 语法方便跟踪。

**Goal:** 把 `Suno`、`Udio Platform`、`LumaLabs` 三个已存在但仍待专题化的媒体类 web reverse provider 线，重构成有独立 line manifest、Cargo feature、compiled-out fail-closed、物理编译隔离、operator surface 对齐、credential examples、focused verify 与 live suite 入口的正式实现线。

**Architecture:** 三个平台都按单平台单实现线理解，但每条线下可以有多个 media surface。正式 steady-state owner 以现有 reverse-web/browser-backed 证据为准，不把 experimental direct HTTP probe 误升成默认实现线。Rust 侧目标是把 provider 真实 owner 从 `gateway/src/upstream/client.rs` 和无条件 helper 模块中迁出，收口到按线 gate 的 `protocol` / `upstream` 模块树与 disabled stub。

**Tech Stack:** Rust `gateway/`、Cargo features、`gateway/manifests/lines/**`、`deploy/verify-gateway-line.ps1`、`deploy/test-gateway-protocol-matrix.py`、operator create catalog、provider credential folder sync、PowerShell / Python 验证脚本。

---

## 0. 当前证据与设计输入

本计划基于以下当前仓库事实制定：

- `docs/20-ai-gateway/Mistral平台实现线、可选编译与物理隔离基线.md` 已建立了简洁 provider baseline 格式。
- `docs/20-ai-gateway/实现线可选编译与物理隔离规范.md` 已固定：
  - 默认 feature 全开；
  - focused 构建用 `--no-default-features --features <line>`；
  - feature 关闭后必须返回 `gateway_provider_line_compiled_out`；
  - 真实 owner 模块树应尽量不再进入编译图。
- `docs/20-ai-gateway/AI网关测试与验收总线.md` 已固定：
  - 后续新增实现线验证入口优先补 `gateway/manifests/lines/**`；
  - `deploy/verify-gateway-line.ps1` 从 manifest 读取 feature、cargo filters、suite id。
- `docs/20-ai-gateway/AI网关平台、实现线、Surface与能力总表.md` 当前把三者标成 `待专题化`：
  - `Suno`
  - `Udio Platform`
  - `LumaLabs`
- `provider-create-catalog.ts` 当前已有：
  - `lumalabs-images`
  - `lumalabs-videos`
  - `lumalabs-audio`
  - `suno-music`
  - `udio-images`
  - `udio-music`
  - `udio-videos`
- 当前 catalog 仍有一个需要修正的历史不一致：
  - `suno-music` 仍写成 `webReverseAccessMode = direct_http_replay` / `defaultExecutionMode = direct_http`
  - 但当前正式 live suite 与 worker 语义显示 Suno 的正式 send path 应按 browser-cookie-backed / browser-backed 理解；`suno_http_live` 只能保留为 direct HTTP probe，不是正式 baseline。
- `deploy/test-gateway-protocol-matrix.py` 已有三条 live suite：
  - `lumalabs_live`
  - `suno_live`
  - `udio_live`
- 当前 `gateway/src/protocol/mod.rs` 中 `lumalabs` / `suno` / `udio` 仍无 feature gate。
- 当前 `gateway/src/upstream/mod.rs` 中 `lumalabs_*` / `suno_*` / `udio_*` helpers 仍无 feature gate。
- 当前 `gateway/src/implementation_lines.rs` 尚未把三者纳入 `RefactoredImplementationLine`。
- 当前 `gateway/src/upstream/client.rs` 仍集中持有大量三者执行逻辑：
  - `lumalabs` 约 43 处引用
  - `suno` 约 79 处引用
  - `udio` 约 121 处引用

---

## 1. 固定本轮 scope

### 1.1 本轮必须完成

1. 三个平台分别创建 canonical baseline 文档。
2. 三个平台分别创建 line manifest。
3. 三个平台分别创建 credential example 文档与样例。
4. 三个平台分别接入 Cargo line feature。
5. 三个平台接入 `implementation_lines`：
   - profile -> line
   - adapter -> line
   - payload -> line
   - feature enabled / disabled tests
6. 三个平台 owner 模块做物理编译隔离：
   - feature 开启：真实模块参与编译；
   - feature 关闭：disabled stub 参与编译；
   - request/provider create/folder sync 等入口 fail-closed。
7. operator create catalog 与三条实现线文档对齐。
8. `deploy/verify-gateway-line.ps1 -LineId ... -ListOnly` 能列出三条新 manifest。
9. focused cargo check/test 能在三条 line 的 no-default-features 构建下通过。
10. live suite 入口保持：
    - `lumalabs_live`
    - `suno_live`
    - `udio_live`
11. 所有完成结论必须写入 docs；没有 fresh-run 的 live 不得写成已通过。

### 1.2 本轮不做

1. 不尝试证明新的上游能力域。
2. 不把 Suno direct HTTP probe 改成正式 baseline。
3. 不新增完整 browser automation 产品能力。
4. 不要求三个 live suite 在没有真实会话材料时强行 fresh-run。
5. 不把 `Suno` / `Udio` / `LumaLabs` 混成同一个 generic media provider。
6. 不修改旧凭证真实值，不在文档里保存真实 cookie / token / browser state。

---

## 2. 目标实现线身份表

| 平台 | line id | serviceProviderKey | providerSurfaceKey | protocolProfile | implementationLine | adapter | formal executionMode | suite |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Suno | `suno-web-reverse-api` | `suno_platform` | `suno` | `suno` | `web_reverse_api` | `suno_compatible` | `browser_backed` | `suno_live` |
| Udio Platform | `udio-web-reverse-api` | `udio_platform` | `udio` | `udio` | `web_reverse_api` | `udio_compatible` | `browser_backed` | `udio_live` |
| LumaLabs | `lumalabs-web-reverse-api` | `lumalabs_platform` | `lumalabs` | `lumalabs` | `web_reverse_api` | `lumalabs_compatible` | `browser_backed` | `lumalabs_live` |

### 2.1 Surface 分层

#### Suno

正式 surface：

- `suno-images`
- `suno-music`
- `suno-videos`

说明：

- `suno-music` 是现有 operator entry。
- `suno-images` / `suno-videos` 已在 protocol/matrix 语义中存在，本轮应补 operator catalog。
- `suno-videos` live case 仍受账号 entitlement 影响；无权益账号时应保持 fixture-required / provider external gate，而不是记成网关未实现。

#### Udio Platform

正式 surface：

- `udio-images`
- `udio-music`
- `udio-videos`

说明：

- 三者共享 browser-backed `/api/generate-proxy` + `/api/songs` 合同。
- 运行时材料可来自 `cookieHeader`、`runtimeStateObjectKey` 或当前代码支持的派生 `apiKey`。

#### LumaLabs

正式 surface：

- `lumalabs-images`
- `lumalabs-videos`
- `lumalabs-audio`

说明：

- 三者共享 `wos-session + realmId`。
- `videos` / `audio` 依赖 `extraBody` 中 action/artifact 字段；默认可使用当前 matrix / catalog 中的已知默认。
- 真实 live 若只剩 HTTP 402 / quota / rate limit，应按 provider external gate 记账。

---

## 3. 文件结构规划

### 3.1 新增 canonical baseline 文档

- Create: `docs/20-ai-gateway/Suno平台实现线、可选编译与物理隔离基线.md`
- Create: `docs/20-ai-gateway/Udio Platform实现线、可选编译与物理隔离基线.md`
- Create: `docs/20-ai-gateway/LumaLabs平台实现线、可选编译与物理隔离基线.md`

每份文档沿用 Mistral / NVIDIA / Grok 简洁结构：

1. 平台身份
2. 当前固定语义
3. 当前可选编译
4. 当前 owner 与 delta
5. 当前 suite
6. 当前验收快照

### 3.2 新增 line manifests

- Create: `gateway/manifests/lines/suno/web-reverse-api.json`
- Create: `gateway/manifests/lines/udio/web-reverse-api.json`
- Create: `gateway/manifests/lines/lumalabs/web-reverse-api.json`

### 3.3 新增 credential examples

- Create: `docs/20-ai-gateway/examples/credentials/suno/web_reverse_api/minimal.raw.sample.json`
- Create: `docs/20-ai-gateway/examples/credentials/suno/web_reverse_api/FIELDS.md`
- Create: `docs/20-ai-gateway/examples/credentials/suno/web_reverse_api/BUILD.md`
- Create: `docs/20-ai-gateway/examples/credentials/udio/web_reverse_api/minimal.raw.sample.json`
- Create: `docs/20-ai-gateway/examples/credentials/udio/web_reverse_api/FIELDS.md`
- Create: `docs/20-ai-gateway/examples/credentials/udio/web_reverse_api/BUILD.md`
- Create: `docs/20-ai-gateway/examples/credentials/lumalabs/web_reverse_api/minimal.raw.sample.json`
- Create: `docs/20-ai-gateway/examples/credentials/lumalabs/web_reverse_api/FIELDS.md`
- Create: `docs/20-ai-gateway/examples/credentials/lumalabs/web_reverse_api/BUILD.md`

### 3.4 修改 docs 索引与总表

- Modify: `docs/20-ai-gateway/服务商实现线与Provider目录.md`
- Modify: `docs/20-ai-gateway/AI网关平台、实现线、Surface与能力总表.md`
- Modify: `docs/20-ai-gateway/实现线可选编译与物理隔离规范.md`
- Modify: `docs/20-ai-gateway/AI网关测试与验收总线.md`
- Modify: `docs/20-ai-gateway/README.md`
- Modify: `AGENTS.md` only if本轮把长期规则新增进 canonical baseline；若只是 provider 专题落地，不强行扩大 `AGENTS.md`。

### 3.5 修改 Rust feature / line registry

- Modify: `gateway/Cargo.toml`
- Modify: `gateway/src/implementation_lines.rs`
- Modify: `gateway/src/protocol/mod.rs`
- Modify: `gateway/src/upstream/mod.rs`

### 3.6 新增 disabled stubs

- Create: `gateway/src/protocol/lumalabs_disabled.rs`
- Create: `gateway/src/protocol/suno_disabled.rs`
- Create: `gateway/src/protocol/udio_disabled.rs`
- Create: `gateway/src/upstream/lumalabs_disabled.rs`
- Create: `gateway/src/upstream/suno_disabled.rs`
- Create: `gateway/src/upstream/udio_disabled.rs`

### 3.7 迁出真实 upstream owner

优先把真实执行逻辑从 `gateway/src/upstream/client.rs` 迁出到 provider owner 文件：

- Create: `gateway/src/upstream/lumalabs.rs`
- Create: `gateway/src/upstream/suno.rs`
- Create: `gateway/src/upstream/udio.rs`

保留在 `gateway/src/upstream/client.rs` 的内容只允许是：

- adapter dispatch
- shared transport primitive
- cross-provider helper

禁止继续把 Suno/Udio/LumaLabs 的业务步骤、worker payload、response finalization 主体塞回 `client.rs`。

### 3.8 修改 operator 与 runtime 支撑

- Modify: `web/src/app/ops/gateway/providers/provider-create-catalog.ts`
- Modify: `gateway/src/provider_credential_folder_sync.rs`
- Modify: `gateway/src/http/routes/internal_provider_accounts.rs`
- Modify: `gateway/src/db/provider_accounts.rs`
- Modify: `gateway/src/routing/protocol_resolution.rs`
- Modify: `gateway/src/routing/credential_routing.rs`
- Modify: `gateway/src/keepalive.rs`

---

## 4. 实施任务

### Task 1: 创建三份 baseline 文档

**Files:**

- Create: `docs/20-ai-gateway/Suno平台实现线、可选编译与物理隔离基线.md`
- Create: `docs/20-ai-gateway/Udio Platform实现线、可选编译与物理隔离基线.md`
- Create: `docs/20-ai-gateway/LumaLabs平台实现线、可选编译与物理隔离基线.md`
- Modify: `docs/20-ai-gateway/服务商实现线与Provider目录.md`
- Modify: `docs/20-ai-gateway/AI网关平台、实现线、Surface与能力总表.md`
- Modify: `docs/20-ai-gateway/README.md`

- [ ] **Step 1: 写 Suno baseline**

文档必须明确：

- `serviceProviderKey = suno_platform`
- `providerSurfaceKey = suno`
- `protocolProfile = suno`
- `implementationLine = web_reverse_api`
- `adapter = suno_compatible`
- `protocol families = suno_images / suno_music / suno_videos`
- `sourceKind = web_reverse_api`
- `webReverseAccessMode = browser_challenge`
- `executionMode = browser_backed`
- `credentialMaterialKind = session_auth / browser_state`
- `lineFeature = line-suno-web-reverse-api`
- `live suite = suno_live`
- `suno_http_live` 只能写成 experimental direct HTTP probe。

- [ ] **Step 2: 写 Udio baseline**

文档必须明确：

- `serviceProviderKey = udio_platform`
- `providerSurfaceKey = udio`
- `protocolProfile = udio`
- `implementationLine = web_reverse_api`
- `adapter = udio_compatible`
- `protocol families = udio_images / udio_music / udio_videos`
- `sourceKind = web_reverse_api`
- `webReverseAccessMode = browser_challenge`
- `executionMode = browser_backed`
- `credentialMaterialKind = session_auth / browser_state`
- `lineFeature = line-udio-web-reverse-api`
- `live suite = udio_live`
- `captchaToken` 是 request-scoped live aid，不是长期 credential 主材料。

- [ ] **Step 3: 写 LumaLabs baseline**

文档必须明确：

- `serviceProviderKey = lumalabs_platform`
- `providerSurfaceKey = lumalabs`
- `protocolProfile = lumalabs`
- `implementationLine = web_reverse_api`
- `adapter = lumalabs_compatible`
- `protocol families = lumalabs_images / lumalabs_videos / lumalabs_audio`
- `sourceKind = web_reverse_api`
- `webReverseAccessMode = browser_challenge`
- `executionMode = browser_backed`
- `credentialMaterialKind = session_auth / browser_state`
- `lineFeature = line-lumalabs-web-reverse-api`
- `live suite = lumalabs_live`
- `realmId + wos-session` 是最小 live 材料。

- [ ] **Step 4: 更新 provider 目录**

把 `docs/20-ai-gateway/服务商实现线与Provider目录.md` 中 “Suno / Udio / LumaLabs 旧专题材料当前仍未迁回” 改成：

- Suno 已有本轮 baseline；
- Udio Platform 已有本轮 baseline；
- LumaLabs 已有本轮 baseline；
- Producer / 其他仍按当前实际状态记录。

- [ ] **Step 5: 更新平台总表**

把 `docs/20-ai-gateway/AI网关平台、实现线、Surface与能力总表.md` 中三行状态从 `待专题化` 更新为：

- `部分覆盖` 或 `范围内已完成，仍在演进`

推荐口径：

- Suno：`部分覆盖`，因为 catalog 需要补 images/videos，video entitlement 仍是外部条件。
- Udio：`部分覆盖`，因为 browser-backed live 依赖 hCaptcha/session material。
- LumaLabs：`部分覆盖`，因为 live 仍可能受 quota / rate limit 影响。

不要在 fresh live rerun 前写成 `已通过`。

- [ ] **Step 6: 更新 README 索引**

将三份新 baseline 加到 `docs/20-ai-gateway/README.md` 的 AI gateway 文档索引中。

- [ ] **Step 7: 文档自审**

运行：

```powershell
rg -n "TODO|TBD|待补|占位|未定" docs/20-ai-gateway/Suno平台实现线、可选编译与物理隔离基线.md docs/20-ai-gateway/"Udio Platform实现线、可选编译与物理隔离基线.md" docs/20-ai-gateway/LumaLabs平台实现线、可选编译与物理隔离基线.md
```

Expected:

- 允许出现“live 未 fresh-run”这类事实描述；
- 不允许出现没有解释的 `TODO / TBD`。

- [ ] **Step 8: 提交**

```powershell
git add docs/20-ai-gateway
git commit -m "docs: add suno udio lumalabs provider baselines"
```

---

### Task 2: 创建 manifests 与 credential examples

**Files:**

- Create: `gateway/manifests/lines/suno/web-reverse-api.json`
- Create: `gateway/manifests/lines/udio/web-reverse-api.json`
- Create: `gateway/manifests/lines/lumalabs/web-reverse-api.json`
- Create: `docs/20-ai-gateway/examples/credentials/suno/web_reverse_api/**`
- Create: `docs/20-ai-gateway/examples/credentials/udio/web_reverse_api/**`
- Create: `docs/20-ai-gateway/examples/credentials/lumalabs/web_reverse_api/**`
- Modify: `docs/20-ai-gateway/examples/credentials/README.md`

- [ ] **Step 1: 写 Suno manifest**

核心字段：

```json
{
  "schemaVersion": "gateway-line-manifest/v0-draft-1",
  "id": "suno-web-reverse-api",
  "identity": {
    "serviceProviderKey": "suno_platform",
    "serviceProviderLabel": "Suno Platform",
    "providerSurfaceKey": "suno",
    "providerSurfaceLabel": "Suno Platform",
    "protocolProfile": "suno",
    "implementationLine": "web_reverse_api",
    "adapter": "suno_compatible",
    "sourceKind": "web_reverse_api",
    "executionMode": "browser_backed"
  },
  "capabilities": {
    "families": ["images", "music", "video"],
    "supportsModelsEndpoint": true
  },
  "credentials": {
    "materialKinds": ["session_auth", "browser_state"],
    "samplePath": "docs/20-ai-gateway/examples/credentials/suno/web_reverse_api/minimal.raw.sample.json",
    "fieldsDocPath": "docs/20-ai-gateway/examples/credentials/suno/web_reverse_api/FIELDS.md"
  },
  "docs": {
    "overviewDocPath": "docs/20-ai-gateway/Suno平台实现线、可选编译与物理隔离基线.md",
    "buildDocPath": "docs/20-ai-gateway/examples/credentials/suno/web_reverse_api/BUILD.md"
  },
  "verification": {
    "recommendedCargoTargetDirSlug": "suno-web-reverse-api-verify",
    "focusedCargoFilters": [
      "protocol::suno",
      "implementation_lines::tests::media_web_reverse_protocol_profiles_compile_when_feature_enabled",
      "implementation_lines::tests::media_web_reverse_protocol_profiles_fail_compile_check_when_feature_disabled"
    ],
    "liveSuiteId": "suno_live",
    "useNoDefaultFeatures": true
  },
  "compilation": {
    "compileLayer": "binary_exclusion",
    "lineFeature": "line-suno-web-reverse-api",
    "binaryInclusionGroup": "suno-web-reverse-api"
  },
  "implementation": {
    "protocolModule": "gateway/src/protocol/suno.rs",
    "upstreamModule": "gateway/src/upstream/suno.rs",
    "platformDeltaModule": "gateway/src/upstream/suno.rs"
  }
}
```

如果 focused test 名称最终拆成三条 provider-specific tests，manifest 中同步改成真实测试名。

- [ ] **Step 2: 写 Udio manifest**

与 Suno 同结构，但使用：

- `id = udio-web-reverse-api`
- `serviceProviderKey = udio_platform`
- `serviceProviderLabel = Udio Platform`
- `providerSurfaceKey = udio`
- `protocolProfile = udio`
- `adapter = udio_compatible`
- `liveSuiteId = udio_live`
- `lineFeature = line-udio-web-reverse-api`
- `protocolModule = gateway/src/protocol/udio.rs`
- `upstreamModule = gateway/src/upstream/udio.rs`

- [ ] **Step 3: 写 LumaLabs manifest**

与 Suno 同结构，但使用：

- `id = lumalabs-web-reverse-api`
- `serviceProviderKey = lumalabs_platform`
- `serviceProviderLabel = LumaLabs Platform`
- `providerSurfaceKey = lumalabs`
- `protocolProfile = lumalabs`
- `adapter = lumalabs_compatible`
- `liveSuiteId = lumalabs_live`
- `lineFeature = line-lumalabs-web-reverse-api`
- `protocolModule = gateway/src/protocol/lumalabs.rs`
- `upstreamModule = gateway/src/upstream/lumalabs.rs`

- [ ] **Step 4: 写 Suno credential sample**

`minimal.raw.sample.json`：

```json
{
  "cookieHeader": "__session=redacted-suno-session-cookie; other_cookie=redacted",
  "credentialMaterialKey": "suno_browser_cookie_main",
  "accountName": "redacted-suno-account",
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

`docs/20-ai-gateway/examples/credentials/suno/web_reverse_api/FIELDS.md` 必须说明：

- `cookieHeader` required；
- `challengeToken` optional 且只用于 fresh request / live probe；
- `video` entitlement 是账号外部条件；
- 不得保存真实 cookie。

- [ ] **Step 5: 写 Udio credential sample**

`minimal.raw.sample.json`：

```json
{
  "cookieHeader": "sb-ssr-production-auth-token.0=redacted-part-0; sb-ssr-production-auth-token.1=redacted-part-1",
  "runtimeStateObjectKey": "credential-runtime/udio/main/storage-state.json",
  "credentialMaterialKey": "udio_browser_session_main",
  "accountName": "redacted-udio-account",
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

`docs/20-ai-gateway/examples/credentials/udio/web_reverse_api/FIELDS.md` 必须说明：

- Udio 当前可能使用 Supabase SSR chunked cookie；
- `runtimeStateObjectKey` 强烈建议保留；
- `captchaToken` 是 live probe request-scoped 辅助；
- 三个 surface 共享同一材料。

- [ ] **Step 6: 写 LumaLabs credential sample**

`minimal.raw.sample.json`：

```json
{
  "cookieHeader": "wos-session=redacted-lumalabs-session",
  "realmId": "redacted-realm-id",
  "credentialMaterialKey": "lumalabs_browser_session_main",
  "accountName": "redacted-lumalabs-account",
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

`docs/20-ai-gateway/examples/credentials/lumalabs/web_reverse_api/FIELDS.md` 必须说明：

- `realmId` required；
- `wos-session` required；
- `videoActionType` / `audioActionType` 可作为 provider account extraBody 覆盖；
- live 402 / rate limit 归 provider external gate。

- [ ] **Step 7: 更新 credential README**

把 `suno/web_reverse_api`、`udio/web_reverse_api`、`lumalabs/web_reverse_api` 加到 `docs/20-ai-gateway/examples/credentials/README.md`。

- [ ] **Step 8: 验证 manifest schema**

```powershell
py -3 deploy/validate-gateway-line-manifests.py --mode repo
```

Expected:

- 新三份 manifest 无 schema error；
- 若失败，先修 manifest path / docs link / feature name。

- [ ] **Step 9: 提交**

```powershell
git add gateway/manifests/lines docs/20-ai-gateway/examples/credentials docs/20-ai-gateway/README.md
git commit -m "chore: add suno udio lumalabs line manifests"
```

---

### Task 3: 接入 Cargo features 与 implementation line registry

**Files:**

- Modify: `gateway/Cargo.toml`
- Modify: `gateway/src/implementation_lines.rs`

- [ ] **Step 1: 增加 Cargo features**

在 `gateway/Cargo.toml`：

```toml
line-suno-web-reverse-api = []
line-udio-web-reverse-api = []
line-lumalabs-web-reverse-api = []
```

并加入 `default = [...]`。

- [ ] **Step 2: 增加 feature constants**

在 `gateway/src/implementation_lines.rs` 增加：

```rust
pub const LINE_SUNO_WEB_REVERSE_API_FEATURE: &str = "line-suno-web-reverse-api";
pub const LINE_UDIO_WEB_REVERSE_API_FEATURE: &str = "line-udio-web-reverse-api";
pub const LINE_LUMALABS_WEB_REVERSE_API_FEATURE: &str = "line-lumalabs-web-reverse-api";
```

- [ ] **Step 3: 增加 enum variants**

在 `RefactoredImplementationLine` 增加：

```rust
SunoWebReverseApi,
UdioWebReverseApi,
LumaLabsWebReverseApi,
```

- [ ] **Step 4: 接入 canonical profile / feature / compiled_in**

映射：

- `SunoWebReverseApi -> suno -> line-suno-web-reverse-api`
- `UdioWebReverseApi -> udio -> line-udio-web-reverse-api`
- `LumaLabsWebReverseApi -> lumalabs -> line-lumalabs-web-reverse-api`

- [ ] **Step 5: 接入 line_for_protocol_profile**

必须至少支持：

```rust
"suno" | "suno-music" | "suno_music" | "suno-images" | "suno_images" | "suno-videos" | "suno_videos"
"udio" | "udio-music" | "udio_music" | "udio-images" | "udio_images" | "udio-videos" | "udio_videos"
"lumalabs" | "luma" | "luma-labs" | "lumalabs-images" | "lumalabs_images" | "lumalabs-videos" | "lumalabs_videos" | "lumalabs-audio" | "lumalabs_audio"
```

- [ ] **Step 6: 接入 line_for_adapter**

映射：

```rust
"suno_compatible" => SunoWebReverseApi
"udio_compatible" => UdioWebReverseApi
"lumalabs_compatible" => LumaLabsWebReverseApi
```

- [ ] **Step 7: 接入 line_for_payload**

如果 `adapter` 先命中，上一步已经覆盖。

额外确认：

- base URL inference 不要把这三条误落到 generic `openai_compatible`。
- 如果存在历史 payload 只带 preset/baseUrl 而 adapter 缺失，当前先不要凭 baseUrl 猜线，除非已有真实 consumer path 需要。

- [ ] **Step 8: 写 enabled/disabled regression tests**

新增或复用 macro，覆盖：

1. feature 开启时：
   - `is_protocol_profile_compiled_in("suno") == true`
   - `is_protocol_profile_compiled_in("udio") == true`
   - `is_protocol_profile_compiled_in("lumalabs") == true`
2. feature 关闭时：
   - `ensure_protocol_profile_compiled("suno")` 返回 `gateway_provider_line_compiled_out`
   - `ensure_payload_compiled(adapter=suno_compatible)` 返回 `gateway_provider_line_compiled_out`
   - Udio/LumaLabs 同理。

- [ ] **Step 9: targeted verify**

使用短 target dir：

```powershell
$env:CARGO_TARGET_DIR='C:\t\suno-udio-luma-lines'
cargo test --manifest-path gateway/Cargo.toml implementation_lines::tests:: -- --nocapture
```

再跑 no-default feature 组合：

```powershell
$env:CARGO_TARGET_DIR='C:\t\suno-line'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features --features line-suno-web-reverse-api

$env:CARGO_TARGET_DIR='C:\t\udio-line'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features --features line-udio-web-reverse-api

$env:CARGO_TARGET_DIR='C:\t\lumalabs-line'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features --features line-lumalabs-web-reverse-api
```

Expected:

- 当前阶段可能因为 modules 尚未 gate 而失败；若失败，继续 Task 4，不要把 Task 3 单独提交成破坏构建的状态。

---

### Task 4: 做 protocol / upstream 物理编译隔离

**Files:**

- Modify: `gateway/src/protocol/mod.rs`
- Modify: `gateway/src/upstream/mod.rs`
- Create: `gateway/src/protocol/lumalabs_disabled.rs`
- Create: `gateway/src/protocol/suno_disabled.rs`
- Create: `gateway/src/protocol/udio_disabled.rs`
- Create: `gateway/src/upstream/lumalabs_disabled.rs`
- Create: `gateway/src/upstream/suno_disabled.rs`
- Create: `gateway/src/upstream/udio_disabled.rs`
- Create: `gateway/src/upstream/lumalabs.rs`
- Create: `gateway/src/upstream/suno.rs`
- Create: `gateway/src/upstream/udio.rs`
- Modify: `gateway/src/upstream/client.rs`

- [ ] **Step 1: gate protocol modules**

在 `gateway/src/protocol/mod.rs` 中把：

```rust
pub mod lumalabs;
pub mod suno;
pub mod udio;
```

改成 feature-gated：

```rust
#[cfg(feature = "line-lumalabs-web-reverse-api")]
pub mod lumalabs;
#[cfg(not(feature = "line-lumalabs-web-reverse-api"))]
#[path = "lumalabs_disabled.rs"]
pub mod lumalabs;

#[cfg(feature = "line-suno-web-reverse-api")]
pub mod suno;
#[cfg(not(feature = "line-suno-web-reverse-api"))]
#[path = "suno_disabled.rs"]
pub mod suno;

#[cfg(feature = "line-udio-web-reverse-api")]
pub mod udio;
#[cfg(not(feature = "line-udio-web-reverse-api"))]
#[path = "udio_disabled.rs"]
pub mod udio;
```

- [ ] **Step 2: gate upstream modules / helpers**

在 `gateway/src/upstream/mod.rs` 中：

- 新增 gated provider modules：

```rust
#[cfg(feature = "line-lumalabs-web-reverse-api")]
pub mod lumalabs;
#[cfg(not(feature = "line-lumalabs-web-reverse-api"))]
#[path = "lumalabs_disabled.rs"]
pub mod lumalabs;
```

Suno/Udio 同理。

- helper modules 也要按对应 feature gate：

```rust
#[cfg(feature = "line-lumalabs-web-reverse-api")]
mod lumalabs_response_helpers;
#[cfg(feature = "line-lumalabs-web-reverse-api")]
mod lumalabs_runtime_helpers;
```

Suno/Udio 同理。

- [ ] **Step 3: 创建 protocol disabled stubs**

disabled stubs 必须保留编译所需的 public constants / structs / functions 签名，内部统一返回：

```rust
crate::implementation_lines::compiled_out_error_for_line(
    crate::implementation_lines::RefactoredImplementationLine::SunoWebReverseApi,
)
```

Udio/LumaLabs 同理。

原则：

- stub 只为编译和 fail-closed 存在；
- 不复制真实业务逻辑；
- 默认模型常量可以保留占位，避免 preset / docs 编译断裂。

- [ ] **Step 4: 创建 upstream disabled stubs**

每个 upstream disabled stub 至少提供：

```rust
pub fn unsupported_request_plan_error() -> GatewayError {
    compiled_out_error()
}

impl UpstreamClient {
    pub(crate) async fn execute_suno_browser_backed(...) -> Result<Value, GatewayError> {
        Err(compiled_out_error())
    }
}
```

实际函数签名以迁移后的 `client.rs` dispatch 调用为准。

- [ ] **Step 5: 迁出 LumaLabs upstream owner**

把 `gateway/src/upstream/client.rs` 中 LumaLabs 相关真实执行逻辑迁入：

- `gateway/src/upstream/lumalabs.rs`

至少迁出：

- `execute_lumalabs_media`
- browser executor / browser worker 调度 wrapper
- image download / non-image response finalization 调用链

保留在 `client.rs` 的只应是：

```rust
if payload.adapter == "lumalabs_compatible" {
    return self.execute_lumalabs_media(...).await;
}
```

- [ ] **Step 6: 迁出 Suno upstream owner**

把 `gateway/src/upstream/client.rs` 中 Suno 相关真实执行逻辑迁入：

- `gateway/src/upstream/suno.rs`

至少迁出：

- `execute_suno_media`
- `execute_suno_browser_backed`
- `finalize_suno_media_response`
- Suno browser worker / remote browser executor 调度 wrapper
- challenge check / generate / feed polling orchestration

Suno direct HTTP probe 的执行逻辑可以继续存在，但必须在文档和命名中保持 experimental/probe 语义，不得成为 `defaultExecutionMode`。

- [ ] **Step 7: 迁出 Udio upstream owner**

把 `gateway/src/upstream/client.rs` 中 Udio 相关真实执行逻辑迁入：

- `gateway/src/upstream/udio.rs`

至少迁出：

- `execute_udio_media`
- Udio browser worker / remote browser executor 调度 wrapper
- generate-proxy / songs polling finalization
- image/music/video response materialization

- [ ] **Step 8: 修正 imports**

迁出后：

- `client.rs` 不应直接 import 三个平台的 response/runtime helper。
- `client.rs` 只 import provider upstream module alias。
- 三个平台 helper 模块只在对应 feature 开启时编译。

检查：

```powershell
Select-String -LiteralPath gateway/src/upstream/client.rs -Pattern 'lumalabs_response_helpers|lumalabs_runtime_helpers|suno_response_helpers|suno_runtime_helpers|udio_response_helpers|udio_runtime_helpers'
```

Expected:

- 无匹配。

- [ ] **Step 9: feature-off smoke**

```powershell
$env:CARGO_TARGET_DIR='C:\t\media-lines-off'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features
```

Expected:

- 编译通过。
- 如果失败，优先补 disabled stub 签名，不要把真实 owner 重新无条件打开。

- [ ] **Step 10: provider-specific feature smoke**

```powershell
$env:CARGO_TARGET_DIR='C:\t\suno-line'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features --features line-suno-web-reverse-api

$env:CARGO_TARGET_DIR='C:\t\udio-line'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features --features line-udio-web-reverse-api

$env:CARGO_TARGET_DIR='C:\t\lumalabs-line'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features --features line-lumalabs-web-reverse-api
```

Expected:

- 三条单线构建均通过。

- [ ] **Step 11: 提交**

```powershell
git add gateway/Cargo.toml gateway/src/implementation_lines.rs gateway/src/protocol gateway/src/upstream
git commit -m "refactor: isolate suno udio lumalabs gateway lines"
```

---

### Task 5: 对齐 operator catalog 与 credential import

**Files:**

- Modify: `web/src/app/ops/gateway/providers/provider-create-catalog.ts`
- Modify: `gateway/src/provider_credential_folder_sync.rs`
- Modify: `gateway/src/http/routes/internal_provider_accounts.rs`
- Modify: `gateway/src/db/provider_accounts.rs`
- Modify: `gateway/src/routing/credential_routing.rs`
- Modify: `gateway/src/routing/protocol_resolution.rs`
- Modify: `gateway/src/keepalive.rs`

- [ ] **Step 1: 补齐 Suno operator surfaces**

在 `provider-create-catalog.ts` 增加：

- `suno-images`
- `suno-videos`

并把现有 `suno-music` 改成：

- `defaultServiceProviderLabel = "Suno Platform"`
- `defaultServiceProviderKey = "suno_platform"`
- `webReverseAccessMode = "browser_challenge"`
- `defaultExecutionMode = "browser_backed"`

不要删除 `suno-music`。

- [ ] **Step 2: 统一 Udio operator surfaces**

确认三条 Udio entry 都有：

- `defaultServiceProviderLabel = "Udio Platform"`
- `defaultServiceProviderKey = "udio_platform"`
- `webReverseAccessMode = "browser_challenge"`
- `defaultExecutionMode = "browser_backed"`

- [ ] **Step 3: 统一 LumaLabs operator surfaces**

确认三条 LumaLabs entry 都有：

- `defaultServiceProviderLabel = "LumaLabs Platform"`
- `defaultServiceProviderKey = "lumalabs_platform"`
- `webReverseAccessMode = "browser_challenge"`
- `defaultExecutionMode = "browser_backed"`

- [ ] **Step 4: provider account create/update compiled-out 拦截**

确保 provider account create/update 对以下 adapter 会调用 compiled check：

- `suno_compatible`
- `udio_compatible`
- `lumalabs_compatible`

feature 关闭时返回：

```json
{
  "error": {
    "code": "gateway_provider_line_compiled_out"
  }
}
```

不得只在 UI 层隐藏。

- [ ] **Step 5: folder sync surface slug**

在 `provider_credential_folder_sync` 中补：

- `suno_platform / suno -> suno`
- `udio_platform / udio -> udio`
- `lumalabs_platform / lumalabs -> lumalabs`

并支持新目录结构：

```text
~/.neuro/suno/suno/session_auth/*.json
~/.neuro/udio/udio/browser_state/*.json
~/.neuro/lumalabs/lumalabs/session_auth/*.json
```

如果当前项目正式目录约定不同，以 `docs/20-ai-gateway/单行凭证生命周期与文件夹同步基线.md` 为准，并同步文档。

- [ ] **Step 6: credential import normalization**

最小要求：

- Suno raw `cookieHeader` 能进单条 credential row。
- Udio raw `cookieHeader` / `runtimeStateObjectKey` 能进单条 credential row。
- Luma raw `cookieHeader` + `realmId` 能进单条 credential row。

缺 required 字段时返回明确错误：

- `missing_suno_cookie_header`
- `missing_udio_browser_runtime`
- `missing_lumalabs_realm_id`
- `missing_lumalabs_session_cookie`

如果已有错误码不同，不强行改名，但必须在 FIELDS / BUILD 文档中写当前真实错误码。

- [ ] **Step 7: keepalive compiled-out 拦截**

对三条 adapter 的 keepalive ensure：

- feature 开启：沿用真实 probe；
- feature 关闭：返回 `gateway_provider_line_compiled_out`；
- 不得静默跳过。

- [ ] **Step 8: routing / protocol resolution 检查**

确认以下 endpoint family 仍正确：

- Suno:
  - images -> `suno_images`
  - music -> `suno_music`
  - videos -> `suno_videos`
- Udio:
  - images -> `udio_images`
  - music -> `udio_music`
  - videos -> `udio_videos`
- LumaLabs:
  - images -> `lumalabs_images`
  - music endpoint/audio surface -> `lumalabs_audio`
  - videos -> `lumalabs_videos`

- [ ] **Step 9: 提交**

```powershell
git add web/src/app/ops/gateway/providers/provider-create-catalog.ts gateway/src/provider_credential_folder_sync.rs gateway/src/http/routes/internal_provider_accounts.rs gateway/src/db/provider_accounts.rs gateway/src/routing gateway/src/keepalive.rs
git commit -m "feat: align suno udio lumalabs operator and credentials"
```

---

### Task 6: focused verify 与 manifest verify

**Files:**

- Modify as needed based on failures.

- [ ] **Step 1: list manifests**

```powershell
.\deploy\verify-gateway-line.ps1 -LineId suno-web-reverse-api,udio-web-reverse-api,lumalabs-web-reverse-api -ListOnly
```

Expected:

- 三条 line 都能列出；
- feature、target dir slug、live suite id 正确。

- [ ] **Step 2: strict manifest validation**

```powershell
py -3 deploy/validate-gateway-line-manifests.py --mode strict
```

Expected:

- exit code 0。

- [ ] **Step 3: verify Suno line**

```powershell
$env:GATEWAY_VERIFY_CARGO_TARGET_ROOT='C:\t'
.\deploy\verify-gateway-line.ps1 -LineId suno-web-reverse-api -SkipCargoTests:$false -SkipCargoCheck:$false
```

Expected:

- focused cargo check pass；
- focused cargo tests pass。

- [ ] **Step 4: verify Udio line**

```powershell
$env:GATEWAY_VERIFY_CARGO_TARGET_ROOT='C:\t'
.\deploy\verify-gateway-line.ps1 -LineId udio-web-reverse-api -SkipCargoTests:$false -SkipCargoCheck:$false
```

Expected:

- focused cargo check pass；
- focused cargo tests pass。

- [ ] **Step 5: verify LumaLabs line**

```powershell
$env:GATEWAY_VERIFY_CARGO_TARGET_ROOT='C:\t'
.\deploy\verify-gateway-line.ps1 -LineId lumalabs-web-reverse-api -SkipCargoTests:$false -SkipCargoCheck:$false
```

Expected:

- focused cargo check pass；
- focused cargo tests pass。

- [ ] **Step 6: no-feature build gate**

```powershell
$env:CARGO_TARGET_DIR='C:\t\media-lines-no-feature'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features
```

Expected:

- pass；
- 如果失败，说明 disabled stubs 或 unconditional module imports 仍不完整。

- [ ] **Step 7: three-line focused build**

```powershell
$env:CARGO_TARGET_DIR='C:\t\media-lines-three'
cargo check --manifest-path gateway/Cargo.toml --tests --no-default-features --features line-suno-web-reverse-api,line-udio-web-reverse-api,line-lumalabs-web-reverse-api
```

Expected:

- pass。

- [ ] **Step 8: default build smoke**

```powershell
$env:CARGO_TARGET_DIR='C:\t\media-lines-default'
cargo check --manifest-path gateway/Cargo.toml --tests
```

Expected:

- pass。

- [ ] **Step 9: 更新 docs 验证快照**

把 Task 6 的结果写回三份 baseline 的 “当前验收快照”。

未跑 live 时只写：

- suite wiring 已接入；
- 当前未 fresh-run；
- 阻塞材料是什么。

不要写 “live 已通过”。

- [ ] **Step 10: 提交**

```powershell
git add docs/20-ai-gateway gateway/manifests/lines deploy gateway/src web/src
git commit -m "test: verify suno udio lumalabs line gates"
```

---

### Task 7: 可选 live suite fresh-run

**Files:**

- Modify: only docs result snapshot, if fresh run succeeds or reaches provider external gate.

前置条件：

- 有隔离 standalone gateway；
- 有独立 DB/Valkey/container/ports；
- 有 live 材料：
  - Suno: raw browser cookie header；
  - Udio: cookie/runtimeStateObjectKey/captchaToken if needed；
  - LumaLabs: `wos-session + realmId`；
- 不复用正在服务的生产容器。

- [ ] **Step 1: 启动隔离 gateway**

遵守当前本地端口和重任务规则，不占用默认预览栈。

推荐输出目录：

```text
output/suno-udio-lumalabs-live-final-YYYYMMDD-HHMMSS
```

- [ ] **Step 2: Suno live**

```powershell
py -3 deploy/test-gateway-protocol-matrix.py --suite suno_live --run --gateway-base-url http://127.0.0.1:<port> --output-dir output/suno-udio-lumalabs-live-final-YYYYMMDD-HHMMSS/suno_live
```

Expected:

- active image/music cases pass；
- video case 只有在有 entitlement 账号时 active pass；
- 无 entitlement 时按 suite 现有规则保留 fixture-required / 402 external gate。

- [ ] **Step 3: Udio live**

```powershell
py -3 deploy/test-gateway-protocol-matrix.py --suite udio_live --run --gateway-base-url http://127.0.0.1:<port> --output-dir output/suno-udio-lumalabs-live-final-YYYYMMDD-HHMMSS/udio_live
```

Expected:

- 若 hCaptcha / browser challenge 阻塞，记录为 external challenge，不得改写成实现失败；
- 若有 request-scoped token，应写明来源是本次 live probe 辅助，不写入长期样例。

- [ ] **Step 4: LumaLabs live**

```powershell
py -3 deploy/test-gateway-protocol-matrix.py --suite lumalabs_live --run --gateway-base-url http://127.0.0.1:<port> --output-dir output/suno-udio-lumalabs-live-final-YYYYMMDD-HHMMSS/lumalabs_live
```

Expected:

- image/video/audio + models suite 执行；
- 如果真实上游只返回 quota/rate-limit，按 provider external gate 记账。

- [ ] **Step 5: 写回验收快照**

每个 baseline 只写真实结果：

- active case count；
- passed count；
- failed count；
- output directory；
- 若 external gate，写具体 HTTP / error code；
- 若未跑，写未跑原因。

- [ ] **Step 6: 清理隔离 runtime**

确保：

- no verification containers running；
- no verification ports listening；
- no leaked browser worker processes；
- `.runtime/ai-heavy-task-declaration.json` 已 release。

- [ ] **Step 7: 提交**

```powershell
git add docs/20-ai-gateway
git commit -m "docs: record suno udio lumalabs live verification"
```

---

## 5. 验收总清单

本专题可以进入“本地实现完成”状态的最低条件：

- [ ] 三份 baseline 文档存在并与当前代码一致。
- [ ] 三份 line manifest 通过 `deploy/validate-gateway-line-manifests.py --mode strict`。
- [ ] `deploy/verify-gateway-line.ps1 -ListOnly` 能列出三条 line。
- [ ] 三个 Cargo line features 存在并加入默认 features。
- [ ] 三条线在 `--no-default-features --features <line>` 下能 focused build。
- [ ] `--no-default-features` 下三条线全部 compiled-out 且不编译真实 owner 模块。
- [ ] feature 关闭时 provider account create/update、payload compile check、request execution 都 fail-closed。
- [ ] operator catalog 对 Suno/Udio/LumaLabs 的 surface、serviceProviderKey、executionMode 与 baseline 一致。
- [ ] credential examples 不含真实 secret。
- [ ] `gateway/src/upstream/client.rs` 不再直接持有三条线的大段 provider 业务实现。
- [ ] docs 明确区分：
  - live 已通过；
  - live 未跑；
  - provider external gate；
  - browser challenge；
  - entitlement / quota / rate limit。

---

## 6. 推荐提交序列

1. `docs: add suno udio lumalabs provider baselines`
2. `chore: add suno udio lumalabs line manifests`
3. `refactor: isolate suno udio lumalabs gateway lines`
4. `feat: align suno udio lumalabs operator and credentials`
5. `test: verify suno udio lumalabs line gates`
6. `docs: record suno udio lumalabs live verification`

如果某一阶段验证失败：

- 不继续扩大 scope；
- 不把失败 commit 进 main；
- 先按最小失败面修复；
- 修复后重跑同一验证命令。
