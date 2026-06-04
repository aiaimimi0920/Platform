# Anthropic Messages 平台实现线、可选编译与物理隔离基线

## 目的

本文档把当前 `Anthropic Messages` 在 Rust `gateway/` 中的正式实现线、共享模板归属、可选编译边界、凭证合同与验证入口收口成一份 canonical 基线。

---

## 1. 当前正式只有一条实现线

截至 `2026-05-19`，`Anthropic Messages` 当前正式只按下面一条实现线理解：

- `official_model_api`

当前固定主语义：

- `serviceProviderKey = anthropic_platform`
- `providerSurfaceKey = anthropic-compatible`
- `protocolProfile = anthropic`
- `adapter = anthropic_compatible`
- `sourceKind = official_model_api`
- `executionMode = direct_http`

---

## 2. 当前是 Anthropics family 的 canonical first-class reference

本轮以后，`Anthropic Messages` 不是“现有 generic support 的一个例子”，而是：

- `family-anthropic-compatible-official-api`

的 canonical first-class reference line。

当前 family-common 主语义应由它定义：

- `messages`
- tool-use
- stream / non-stream
- stop reason
- response normalize

`qwen_coding_plan_anthropic` 当前继续是该 family 的消费者，不再反向定义 family 主语义。

---

## 3. 当前 owner

### 3.1 Protocol owner

- `gateway/src/protocol/anthropic_messages.rs`
- `gateway/src/protocol/anthropic.rs`

### 3.2 Upstream owner

- `gateway/src/upstream/anthropic_messages.rs`
- `gateway/src/upstream/anthropic_compatible_official_api_common.rs`

### 3.3 Control-plane / supporting owner

- `gateway/manifests/lines/anthropic/official-model-api.json`
- `deploy/validate-gateway-line-manifests.py`
- `deploy/verify-gateway-line.ps1`
- `deploy/test-gateway-protocol-matrix.py`
- `web/src/app/ops/gateway/providers/provider-create-catalog.ts`
- `gateway/src/provider_credential_folder_sync.rs`

---

## 4. 当前可选编译与二进制裁剪

当前这条线已经进入正式 `line feature + family feature` 体系：

- `line-anthropic-messages-official-model-api`
- `family-anthropic-compatible-official-api`

当前正式语义：

1. 启用这条 line 时
   - Anthropics official family-common 进入 binary
2. 若所有依赖该 family 的 line 都关闭
   - 该 family-common 不得继续无条件进入编译图
3. 关闭这条 line 后
   - 运行时必须 fail-closed，返回：
     - `gateway_provider_line_compiled_out`

---

## 5. 当前凭证材料

当前最小 credential material 固定为：

- `credentialMaterialKind = api_key`

最小 raw import payload 见：

- `docs/20-ai-gateway/examples/credentials/anthropic/official_model_api/minimal.raw.sample.json`

当前最常见字段：

- `apiKey`
- `baseUrl`
- `defaultModel`
- `anthropicVersion`
- `credentialMaterialKey`

---

## 6. 当前验证入口

### 6.1 Focused cargo

```powershell
powershell -ExecutionPolicy Bypass -File deploy/verify-gateway-line.ps1 -LineId anthropic-messages-official-model-api
```

### 6.2 Fixture suite

- `anthropic_fixture`

### 6.3 Live suite

- `anthropic_live`

当前 live suite 目标是：

- 用真实 Anthropics key 跑 caller-visible `/v1/messages`
- 并作为 shared anthropic-compatible official API family 的 latest-head reference regression

---

## 7. 当前状态

截至 `2026-05-19`，当前状态应理解为：

- 平台实现线拆解：已完成
- line manifest / compile gate：已接入
- shared anthropic family-common：已接入
- credential sample / fields / build docs：已补齐
- fixture / live suite：已进入统一 matrix
- fixture：已打绿
- latest-head live：已打正，其中 native messages case 按 `quota gate accepted` 记账

是否已经正式 `绿灯`，必须继续以：

- `AI网关测试与验收总线.md`
- 最新 fixture/live 归档

为准。
