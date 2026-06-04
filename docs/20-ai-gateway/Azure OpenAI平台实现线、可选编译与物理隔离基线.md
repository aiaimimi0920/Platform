# Azure OpenAI 平台实现线、可选编译与物理隔离基线

## 目的

本文档把当前 `Azure OpenAI` 在 Rust `gateway/` 中的正式实现线、共享模板归属、可选编译边界、凭证合同与验证入口收口成一份 canonical 基线。

---

## 1. 当前正式只有一条实现线

截至 `2026-05-19`，`Azure OpenAI` 当前正式只按下面一条实现线理解：

- `official_vendor_api`

当前固定主语义：

- `serviceProviderKey = azure_openai_platform`
- `providerSurfaceKey = azure-openai`
- `protocolProfile = azure_openai`
- `adapter = openai_compatible`
- `sourceKind = official_vendor_api`
- `executionMode = direct_http`

---

## 2. 同一条线同时 owner 两种 path 形态

当前这条线不是两条 public line。

它必须同时 owner：

1. canonical v1-style
   - `https://<resource>.openai.azure.com/openai/v1`
2. legacy deployment-path compatibility
   - `/openai/deployments/<deployment>/...`

当前正式要求：

- `legacy deployment-path` 是同一条 line 的 path variant
- 不得把它升级成第二条 `Azure OpenAI legacy` public line

---

## 3. 当前共享模板层归属

`Azure OpenAI` 本轮不建立新的 family-common。

它当前正式归入：

- `family-openai-compatible-official-api`

当前共享层 owner：

- OpenAI family request-plan
- `chat_completions / responses / completions`
- OpenAI-compatible response unpack / common bridge

Azure delta layer 只 owner：

- `api-key` auth mode
- Azure base URL 识别
- v1-style 与 legacy deployment-path 选择
- Azure live/bootstrap metadata

---

## 4. 当前 owner

### 4.1 Protocol owner

- `gateway/src/protocol/azure_openai.rs`

### 4.2 Upstream owner

- `gateway/src/upstream/azure_openai.rs`
- `gateway/src/upstream/openai_compatible_official_api_common.rs`

### 4.3 Control-plane / supporting owner

- `gateway/manifests/lines/azure_openai/official-vendor-api.json`
- `deploy/validate-gateway-line-manifests.py`
- `deploy/verify-gateway-line.ps1`
- `deploy/test-gateway-protocol-matrix.py`
- `web/src/app/ops/gateway/providers/provider-create-catalog.ts`
- `gateway/src/provider_credential_folder_sync.rs`

---

## 5. 当前可选编译与二进制裁剪

当前这条线已经进入正式 `line feature + family feature` 体系：

- `line-azure-openai-official-vendor-api`
- `family-openai-compatible-official-api`

当前正式语义：

1. 只启用 Azure 这条 line 时
   - OpenAI-compatible official family-common 进入 binary
2. 若所有依赖该 family 的 line 都关闭
   - 该 family-common 不得无条件进入编译图
3. 关闭 Azure line 后
   - 运行时必须 fail-closed，返回：
     - `gateway_provider_line_compiled_out`

---

## 6. 当前凭证材料

当前最小 credential material 固定为：

- `credentialMaterialKind = api_key`

最小 raw import payload 见：

- `docs/20-ai-gateway/examples/credentials/azure_openai/official_vendor_api/minimal.raw.sample.json`

当前最常见字段：

- `apiKey`
- `baseUrl`
- `defaultModel`
- `authMode = api-key`
- `credentialMaterialKey`

若要走 legacy deployment-path compatibility，允许在同一条 line 上继续补：

- `chatCompletionsPath`
- `responsesPath`

---

## 7. 当前验证入口

### 7.1 Focused cargo

统一 helper：

```powershell
powershell -ExecutionPolicy Bypass -File deploy/verify-gateway-line.ps1 -LineId azure-openai-official-vendor-api
```

### 7.2 Fixture suite

- `azure_openai_fixture`

### 7.3 Live suite

- `azure_openai_live`

当前 live suite 目标是：

- 用真实 Azure key 跑 caller-visible OpenAI-compatible text regression
- 同时保留同 line 的 Azure path variant 兼容语义

当前 live bootstrap 额外支持标准 Azure 环境变量：

- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`

其中：

- 若提供的是标准资源端点
  - `https://<resource>.openai.azure.com`
  - 或 `https://<resource>.cognitiveservices.azure.com`
- 当前 helper 会自动规范化成：
  - `https://<resource>.openai.azure.com/openai/v1`
  - 或对应的 `.../openai/v1`

当前 latest-head live 已经拿到一条真实 Azure customer-managed 资源与真实 `api-key`，并已把 canonical `/openai/v1` 文本入口真实送到官方 data-plane。当前收口所需事实如下：

- 当前这台机器上的 Azure 门户在默认目录下明确显示 `没有订阅? 请查看以下选项`
- `所有资源` 页面进一步显示 `在创建资源之前，需要设置订阅`
- 对应现场截图归档：
  - `output/playwright/azure-portal-all-resources-no-subscription.png`
- 默认目录下 `ai.azure.com` 的 `gpt-chat-latest` 模型页点击 `使用此模型` 后，官方直接弹出：
  - `需要有效的 Azure 订阅才能继续操作`
- 对应现场截图归档：
  - `output/playwright/azure-foundry-use-model-subscription-required.png`
- `ai.azure.com` 页面自身发出的 ARM 请求也进一步证明：
  - `GET /subscriptions?api-version=2022-12-01` 返回 `value=[]`
  - `POST /providers/Microsoft.ResourceGraph/resources?...` 返回 `count=0`
- `ai.azure.com` 的资源查询只返回：
  - `resourceName = azure-openai`
  - `assetContainerType = Registry`
  - `isCustomerManagedResource = false`
  - `isPublicResource = true`
  - `scope = System`
  - 这说明当前能看到的只是系统级公共模型 Registry，不是 customer-managed Azure OpenAI data-plane 资源
  - 进一步核查发现浏览器里存在另一套 tenant：
    - `vmjcv666@gmail.com`
    - `Default Directory (2e135043-3a4e-4da5-a98a-425183c40853)`
  - 该 tenant 下已有真实订阅：
    - `c42ea3ef-02cd-40bb-b27e-6905f1cfb1ef`
  - 其 Resource Graph 初始统计请求：
    - `Resources | summarize resourceCount=count() by type`
    - 返回 `count=0`
  - 说明：
    - 这张订阅最初没有任何现成资源
  - 切到该 tenant 的 `ai.azure.com` 后，`使用此模型` 进入的是：
    - `选择项目 / 创建新项目`
  - 对应现场截图归档：
    - `output/playwright/azure-foundry-create-project-required.png`
  - 当前已按默认值真实创建：
    - project：`vmjcv666-8976`
    - resource group：`rg-vmjcv666-8976`
    - Foundry / AI Services resource：`vmjcv666-8976-resource`
    - region：`eastus2`
  - 当前 ARM 资源已明确暴露：
    - Azure OpenAI endpoint：
      - `https://vmjcv666-8976-resource.openai.azure.com/`
    - Foundry endpoint：
      - `https://vmjcv666-8976-resource.services.ai.azure.com/`
  - 当前也已从门户 `密钥和终结点` 页面取到真实 `api-key`
  - 在此基础上，`azure_openai_live` 当前已经把 `/v1/chat/completions`、`/v1/responses`、`/v1/completions` 三条入口真实打到官方 data-plane
  - caller-visible 回包当前为：
    - `404`
    - `{"error":{"code":"404","message":"Resource not found","type":"ModelNotFound"}}`
  - 这说明：
    - auth 有效
    - endpoint 有效
    - official Azure OpenAI upstream 已真实命中
  - 当前剩余门槛不再是 credential / endpoint 缺失，而是 Azure 侧 deployment gate：
    - `gpt-chat-latest`
      - 部署创建页提示：
        - `所选选项的配额不足`
    - `gpt-5.4-nano`
      - 选择模型后提示：
        - `由于订阅中的策略，无法部署此模型。请与管理员联系以请求访问权限。`
  - 因此当前 latest-head 应按：
    - `provider external gate accepted`
    记账，而不是继续记成 helper / line owner / fixture 未完成

当前已确认的云侧继续推进默认值：

- tenant：
  - `Default Directory (2e135043-3a4e-4da5-a98a-425183c40853)`
- account：
  - `vmjcv666@gmail.com`
- subscription：
  - `c42ea3ef-02cd-40bb-b27e-6905f1cfb1ef`
- `ai.azure.com` 默认建议：
  - project：`vmjcv666-8976`
  - Foundry resource：`vmjcv666-8976-resource`
  - region：`eastus2`

若未来允许继续做真实云侧创建，应优先按上述默认值推进，再把创建后的：

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`

接回 `azure_openai_live` 做 latest-head 收口。

---

## 8. 当前状态

截至 `2026-05-19`，当前状态应理解为：

- 平台实现线拆解：已完成
- line manifest / compile gate：已接入
- 共享 family-common 归属：已接入
- credential sample / fields / build docs：已补齐
- fixture / live suite：已进入统一 matrix
- latest-head live：已使用真实 resource 与真实 `api-key` 触达官方 data-plane，其中 native text cases 按 `provider external gate accepted` 收口

是否已经正式 `绿灯`，必须继续以：

- `AI网关测试与验收总线.md`
- 最新 fixture/live 归档

为准。
