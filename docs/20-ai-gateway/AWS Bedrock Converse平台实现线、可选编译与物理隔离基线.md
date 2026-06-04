# AWS Bedrock Converse 平台实现线、可选编译与物理隔离基线

## 目的

本文档把当前 `AWS Bedrock Converse` 在 Rust `gateway/` 中的正式实现线、共享模板归属、可选编译边界、凭证合同与验证入口收口成一份 canonical 基线。

---

## 1. 当前正式只有一条实现线

截至 `2026-05-18`，`AWS Bedrock Converse` 当前正式只按下面一条实现线理解：

- `official_model_api`

当前固定主语义：

- `serviceProviderKey = aws_bedrock_platform`
- `providerSurfaceKey = bedrock-converse`
- `protocolProfile = aws_bedrock`
- `adapter = bedrock_converse_compatible`
- `sourceKind = official_model_api`
- `executionMode = direct_http`

---

## 2. 当前拥有独立 family-common

本轮以后，`AWS Bedrock Converse` 当前不是 provider-local inline branch，而是：

- `family-bedrock-converse-official-api`

的第一条正式消费者。

当前 family-common owner：

- Converse / ConverseStream request-plan
- native eventstream translate
- tool roundtrip
- common response normalize

---

## 3. 当前 owner

### 3.1 Protocol owner

- `gateway/src/protocol/bedrock_converse.rs`

### 3.2 Upstream owner

- `gateway/src/upstream/bedrock_converse_official_api_common.rs`

### 3.3 Control-plane / supporting owner

- `gateway/manifests/lines/aws_bedrock/official-model-api.json`
- `deploy/validate-gateway-line-manifests.py`
- `deploy/verify-gateway-line.ps1`
- `deploy/test-gateway-protocol-matrix.py`
- `web/src/app/ops/gateway/providers/provider-create-catalog.ts`
- `gateway/src/provider_credential_folder_sync.rs`

---

## 4. 当前可选编译与二进制裁剪

当前这条线已经进入正式 `line feature + family feature` 体系：

- `line-aws-bedrock-converse-official-model-api`
- `family-bedrock-converse-official-api`

当前正式语义：

1. 启用这条 line 时
   - Bedrock Converse family-common 进入 binary
2. 若所有依赖该 family 的 line 都关闭
   - 该 family-common 不得继续无条件进入编译图
3. 关闭这条 line 后
   - 运行时必须 fail-closed，返回：
     - `gateway_provider_line_compiled_out`

---

## 5. 当前凭证材料

当前这条 line 的最小 credential material 现已支持两种运行语义：

1. `credentialMaterialKind = bearer_token`
   - 继续承接已存在的 signed/auth token contract
2. `credentialMaterialKind = bearer_token`
   - 配合 `extraBody.awsAccessKeyId / awsSecretAccessKey / awsRegion / awsSessionToken`
   - 由 gateway 在请求期直接执行 Bedrock runtime SigV4 signing

也就是说，本轮不再只是“未来考虑 signer”：

- Bedrock runtime SigV4 signing 已经进入当前 gateway owner
- signed token / bearer contract 仍继续兼容

最小 raw import payload 见：

- `docs/20-ai-gateway/examples/credentials/aws_bedrock/official_model_api/minimal.raw.sample.json`

---

## 6. 当前验证入口

### 6.1 Focused cargo

```powershell
powershell -ExecutionPolicy Bypass -File deploy/verify-gateway-line.ps1 -LineId aws-bedrock-converse-official-model-api
```

### 6.2 Fixture suite

- `aws_bedrock_fixture`

### 6.3 Live suite

- `aws_bedrock_live`

当前 live suite 目标是：

- 用真实 Bedrock signed/auth token 跑 caller-visible Converse regression
- 或使用真实 AWS runtime credential 通过 in-gateway SigV4 signing 跑 caller-visible Converse regression
- 并验证新的 bedrock family-common 没有只停留在 inline branch

---

## 7. 当前状态

截至 `2026-05-19`，当前状态应理解为：

- 平台实现线拆解：已完成
- line manifest / compile gate：已接入
- dedicated bedrock family-common：已接入
- credential sample / fields / build docs：已补齐
- fixture / live suite：已进入统一 matrix
- latest-head live：已打正，其中 native converse case 按 `provider external gate accepted` 记账

当前 latest-head Bedrock live 的真实失败面已经前移为：

- `To access Amazon Bedrock, you must provide further information ... bedrock-allowlisting`

因此当前更准确的结论是：

- gateway 的 native Converse request-plan、runtime signing、route exposure 已经真实送达官方 upstream
- 剩余门槛是 AWS 账号未获 Bedrock allowlisting
- 该失败面当前按 `provider external gate accepted` 理解
- 它属于 provider 外部门槛，而不是网关 owner 缺失

是否已经正式 `绿灯`，必须继续以：

- `AI网关测试与验收总线.md`
- 最新 fixture/live 归档

为准。
