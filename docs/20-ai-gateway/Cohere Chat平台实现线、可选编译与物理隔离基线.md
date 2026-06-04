# Cohere Chat 平台实现线、可选编译与物理隔离基线

## 目的

本文档把当前 `Cohere Chat` 在 Rust `gateway/` 中的正式实现线、共享模板归属、可选编译边界、凭证合同与验证入口收口成一份 canonical 基线。

---

## 1. 当前正式只有一条实现线

截至 `2026-05-18`，`Cohere Chat` 当前正式只按下面一条实现线理解：

- `official_model_api`

当前固定主语义：

- `serviceProviderKey = cohere_platform`
- `providerSurfaceKey = cohere-chat`
- `protocolProfile = cohere`
- `adapter = cohere_compatible`
- `sourceKind = official_model_api`
- `executionMode = direct_http`

---

## 2. 当前拥有独立 family-common

本轮以后，`Cohere Chat` 当前不是 provider-local inline branch，而是：

- `family-cohere-chat-official-api`

的第一条正式消费者。

当前 family-common owner：

- `/v2/chat` request-plan
- stream / non-stream common path
- tool roundtrip
- finish reason / response normalize

---

## 3. 当前 owner

### 3.1 Protocol owner

- `gateway/src/protocol/cohere.rs`

### 3.2 Upstream owner

- `gateway/src/upstream/cohere_chat_official_api_common.rs`

### 3.3 Control-plane / supporting owner

- `gateway/manifests/lines/cohere/official-model-api.json`
- `deploy/validate-gateway-line-manifests.py`
- `deploy/verify-gateway-line.ps1`
- `deploy/test-gateway-protocol-matrix.py`
- `web/src/app/ops/gateway/providers/provider-create-catalog.ts`
- `gateway/src/provider_credential_folder_sync.rs`

---

## 4. 当前可选编译与二进制裁剪

当前这条线已经进入正式 `line feature + family feature` 体系：

- `line-cohere-chat-official-model-api`
- `family-cohere-chat-official-api`

当前正式语义：

1. 启用这条 line 时
   - Cohere Chat family-common 进入 binary
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

- `docs/20-ai-gateway/examples/credentials/cohere/official_model_api/minimal.raw.sample.json`

当前最常见字段：

- `apiKey`
- `baseUrl`
- `defaultModel`
- `authMode = bearer`
- `credentialMaterialKey`

---

## 6. 当前验证入口

### 6.1 Focused cargo

```powershell
powershell -ExecutionPolicy Bypass -File deploy/verify-gateway-line.ps1 -LineId cohere-chat-official-model-api
```

### 6.2 Fixture suite

- `cohere_fixture`

### 6.3 Live suite

- `cohere_live`

当前 live suite 目标是：

- 用真实 Cohere key 跑 caller-visible `/v2/chat` regression
- 并验证新的 cohere-chat family-common 已成为正式 owner

---

## 7. 当前状态

截至 `2026-05-18`，当前状态应理解为：

- 平台实现线拆解：已完成
- line manifest / compile gate：已接入
- dedicated cohere family-common：已接入
- credential sample / fields / build docs：已补齐
- fixture / live suite：已进入统一 matrix

是否已经正式 `绿灯`，必须继续以：

- `AI网关测试与验收总线.md`
- 最新 fixture/live 归档

为准。
