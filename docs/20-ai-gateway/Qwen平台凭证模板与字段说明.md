# Qwen 平台凭证模板与字段说明

本文档是 Qwen Platform 当前两条实现线的凭证模板与字段分层说明。

它回答三件事：

1. Qwen official 线的示例凭证应该长什么样
2. Qwen web reverse 线的示例凭证应该长什么样
3. 哪些字段应该由 operator 提供，哪些字段是运行时或导入器自动派生

---

## 1. 当前两条实现线与材料类型

| 实现线 | canonical surface | credential material kind | 说明 |
| --- | --- | --- | --- |
| `qwen_official_api` | `qwen-dashscope-openai` | `api_key` | DashScope OpenAI-compatible 官方线 |
| `qwen_official_api` | `qwen-coding-plan-openai` | `api_key` | Coding Plan OpenAI-compatible 官方线 |
| `qwen_official_api` | `qwen-coding-plan-anthropic` | `api_key` | Coding Plan Anthropic-compatible 官方线 |
| `qwen_web_reverse` | `qwen-web-chat` | `session_auth` | Qwen WebUI reverse-chat 线 |

---

## 2. 推荐目录结构

当前推荐目录层级：

- `%USERPROFILE%\\.neuro\\qwen-platform\\qwen-dashscope-openai\\api-key\\<credential>.json`
- `%USERPROFILE%\\.neuro\\qwen-platform\\qwen-coding-plan-openai\\api-key\\<credential>.json`
- `%USERPROFILE%\\.neuro\\qwen-platform\\qwen-coding-plan-anthropic\\api-key\\<credential>.json`
- `%USERPROFILE%\\.neuro\\qwen-platform\\qwen-web-chat\\session-auth\\<credential>.json`

仓库内同步提供了可拷贝的示例模板文件：

- `docs/20-ai-gateway/examples/qwen-platform/qwen-dashscope-openai.api-key.example.json`
- `docs/20-ai-gateway/examples/qwen-platform/qwen-coding-plan-openai.api-key.example.json`
- `docs/20-ai-gateway/examples/qwen-platform/qwen-coding-plan-anthropic.api-key.example.json`
- `docs/20-ai-gateway/examples/qwen-platform/qwen-web-chat.session-auth.example.json`

如果 operator 已经拿到真实 Qwen official key，也可以直接使用：

- `deploy/write-qwen-official-credential-files.ps1`

把官方 key material 写入 canonical `~/.neuro/qwen-platform/.../api-key/*.json` 目录结构，避免手改 JSON。
该 helper 当前会输出：

- UTF-8 无 BOM
- 单行 JSON
- 无末尾换行

与 official live bootstrap 当前接受的 canonical 单行凭证文件契约保持一致。
当前 helper 还支持：

- 直接通过参数传入：
  - `-DashscopeApiKey`
  - `-CodingPlanApiKey`
- 从环境变量回退读取：
  - `GATEWAY_QWEN_DASHSCOPE_API_KEY`
  - `GATEWAY_QWEN_CODING_PLAN_API_KEY`
  - `QWEN_DASHSCOPE_API_KEY`
  - `QWEN_CODING_PLAN_API_KEY`
- 若目标文件已存在，默认拒绝覆盖；需显式传：
  - `-Force`

截至 `2026-05-17`，当前 head 还额外做过一轮 **helper-generated invalid-key probe**：

- helper 先把 fake key 写入临时 `USERPROFILE\\.neuro\\qwen-platform\\...`
- 再依次跑：
  - `qwen_dashscope_live`
  - `qwen_coding_plan_openai_live`
  - `qwen_coding_plan_anthropic_live`
- 三条 suite 都能生成完整的 summary artifact，失败面前移到 upstream auth，而不是停在 “missing key”

这说明：

- `deploy/write-qwen-official-credential-files.ps1`
- canonical `~/.neuro` 单行凭证文件
- official live bootstrap

这三者之间的接线，在当前 head 上已经有真实 runtime 级证据，不只是单元测试结论。
同一轮 probe 里，helper 实际写出的三份文件还额外确认了：

- UTF-8 无 BOM
- `newline_count = 0`
- 无末尾换行
- DashScope 行的：
  - `credentialMaterialKey = qwen-official:dashscope`
  - `accountName = dashscope`
- Coding Plan OpenAI / Anthropic 行的：
  - `credentialMaterialKey = qwen-official:coding-plan`
  - `accountName = coding-plan`

对应证据可见：

- `output/qwen_official_invalid_key_helper_probe_20260517_v1/written-file-contract.json`
- `output/qwen_official_invalid_key_helper_probe_20260517_v1/cleanup-before.json`
- `output/qwen_official_invalid_key_helper_probe_20260517_v1/cleanup-after.json`

其中 `cleanup-before.json -> cleanup-after.json` 当前还证明：

- probe 开始前没有残留：
  - `Qwen DashScope Live`
  - `Qwen Coding Plan OpenAI Live`
  - `Qwen Coding Plan Anthropic Live`
- helper + suite runtime 过程中确实创建出了这三条 live provider rows
- probe 结束后又被显式清理回 clean inventory

因此这轮 helper runtime proof 不只是“文件被写出来了”，而是已经进一步证明：

- canonical 文件会被 official live bootstrap 消费
- bootstrap 会真实创建对应 live provider rows
- 失败面随后才前移到 upstream auth

Qwen official live bootstrap 当前除了 canonical `~/.neuro` 单行凭证文件，还支持三类额外本地回退源，但它们只应作为迁移/恢复辅助，不建议当作正式 operator 操作入口：

- 当前 provider account 下已存在、且 `maskSecrets=false` 时仍可读到真实 `apiKey` 的 child `gateway_provider_credentials` row
- `.runtime/tmp_provider_accounts.json` 中未脱敏的 Qwen official `payload.apiKey`
- `gateway/routes.yaml` 中非 `${ENV_VAR}` 占位符的 literal `api_key`
  - 当前支持双引号、单引号或不带引号的 literal 值
- 上述本地 JSON / YAML 恢复源当前会容忍历史 UTF-8 BOM 文件，避免旧 helper 产物因为 BOM 被误判成无效
- 当前 live bootstrap 已对齐真相层：实际 official key 会收口到 child `gateway_provider_credentials` row；provider account `payload.apiKey` 只保留空值或临时兼容来源，不再作为长期真相层
- 若 provider row 已存在但 operator listing 中只剩 masked `payload.apiKey`，当前仍会使用新的本地真实 key 来源刷新对应 child credential；masked 值本身不会阻断 refresh

对于 `qwen-coding-plan-openai` 与 `qwen-coding-plan-anthropic`，当前默认把它们视为共享同一份 Coding Plan official key：

- live bootstrap 会优先读取本 surface 的缓存 / route
- 若本 surface 缺失，也允许从 sibling surface 的本地单行凭证、未脱敏 provider export、或 `routes.yaml` literal `api_key` 恢复
- provider account listing 当前会对 `payload.apiKey` 做脱敏，因此 sibling live provider row 的 **inline payload** 本身不是当前正式依赖的恢复源；
  但若 sibling account 下已经有未脱敏 child credential row，当前 live bootstrap 允许直接复用它

截至 `2026-05-18` 的 fresh live / direct-upstream probe 还额外证明了一条重要边界：

- 一个**能打绿 `qwen_dashscope_live`** 的 DashScope-compatible key，
  **不等于**它也一定能通过：
  - `https://coding.dashscope.aliyuncs.com/v1`
  - `https://coding.dashscope.aliyuncs.com/apps/anthropic`
- 对 Coding Plan OpenAI surface，当前已直接验证：
  - `Authorization: Bearer`
  - `x-api-key`
  - `api-key`
  三种常见 header 形式都可能继续返回：
  - `401 Unauthorized`
  - `invalid_api_key`
- 对 Coding Plan Anthropic surface，当前也已直接验证可能返回：
  - `401 Unauthorized`
  - `invalid_api_key`
- 截至 `2026-05-18` 的阿里云官方文档还额外给出了一个重要区分：
  - DashScope API Key / 百炼 API Key 通常是通用 `sk-...`
  - Coding Plan / 通义灵码专属 API Key 当前描述为专属 `sk-sp-...`
  - 两者不是当前默认可互换的同一种 key material
- 同一批官方文档当前还明确把 Coding Plan 套餐额度限定在交互式 AI 编程工具中，
  并排除 `curl / Postman / Dify / 自定义应用程序后端 / 非交互式批量 API` 场景

这意味着当前 operator 在提供 `-CodingPlanApiKey`、`GATEWAY_QWEN_CODING_PLAN_API_KEY`、或对应 canonical `~/.neuro` 单行凭证时，正式要求不只是：

- “它是一个真实 Qwen official key”

还必须满足：

- “它是一个 **被 Coding Plan upstream surface 接受** 的 key”
- “它当前还应与官方描述的 Coding Plan dedicated key 形态一致，通常是 `sk-sp-...`”
- 但即便如此，当前官方文档仍把 gateway 这类 API/backend lane 归到 `服务商不支持`

也就是说：

- DashScope live 绿灯
  **不能**单独推出：
  - `qwen_coding_plan_openai_live`
  - `qwen_coding_plan_anthropic_live`
  也会自动打绿

此外，截至 `2026-05-18` 当前 helper：

- `deploy/write-qwen-official-credential-files.ps1`

若收到的 Coding Plan key 仍只是通用 `sk-...`，当前会继续写出 canonical 单行凭证文件，
但会同时显式 `Write-Warning` 提示：

- Coding Plan 官方文档当前描述的是 dedicated `sk-sp-...` key
- generic `sk-...` key 可能仍会被 `coding.dashscope.aliyuncs.com` upstream 拒绝

---

## 3. 官方线：provider account 基线

Qwen official 三个 surface 共享一份 official core，但 provider account 仍要显式表明 surface 语义。

### 3.1 `qwen_dashscope_openai` provider account 示例

```json
{
  "label": "Qwen DashScope OpenAI",
  "serviceProviderKey": "qwen_platform",
  "serviceProviderLabel": "Qwen Platform",
  "adapter": "openai_compatible",
  "protocolFamily": "openai",
  "protocolProfile": "qwen_dashscope_openai",
  "status": "active",
  "sourceKind": "official_model_api",
  "payload": {
    "adapter": "openai_compatible",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "authMode": "bearer",
    "defaultModel": "qwen-plus",
    "chatCompletionsPath": "/chat/completions",
    "responsesPath": "/responses"
  }
}
```

### 3.2 `qwen_coding_plan_openai` provider account 示例

```json
{
  "label": "Qwen Coding Plan OpenAI",
  "serviceProviderKey": "qwen_platform",
  "serviceProviderLabel": "Qwen Platform",
  "adapter": "openai_compatible",
  "protocolFamily": "openai",
  "protocolProfile": "qwen_coding_plan_openai",
  "status": "active",
  "sourceKind": "official_model_api",
  "payload": {
    "adapter": "openai_compatible",
    "baseUrl": "https://coding.dashscope.aliyuncs.com/v1",
    "authMode": "bearer",
    "defaultModel": "Qwen3-Coder-Plus",
    "chatCompletionsPath": "/chat/completions",
    "responsesPath": "/responses"
  }
}
```

### 3.3 `qwen_coding_plan_anthropic` provider account 示例

```json
{
  "label": "Qwen Coding Plan Anthropic",
  "serviceProviderKey": "qwen_platform",
  "serviceProviderLabel": "Qwen Platform",
  "adapter": "anthropic_compatible",
  "protocolFamily": "anthropic",
  "protocolProfile": "qwen_coding_plan_anthropic",
  "status": "active",
  "sourceKind": "official_model_api",
  "payload": {
    "adapter": "anthropic_compatible",
    "baseUrl": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    "authMode": "x-api-key",
    "defaultModel": "Qwen3-Coder-Plus",
    "messagesPath": "/v1/messages",
    "anthropicVersion": "2023-06-01"
  }
}
```

说明：

- `baseUrl / path / authMode / anthropicVersion`
  - 当前属于 **provider account / surface 语义**
  - 不建议 operator 把这些字段重复塞进每条 credential row

---

## 4. 官方线：单行 credential 模板

Qwen official 三个 surface 当前统一使用：

- `credential material kind = api_key`

### 4.1 推荐最小模板

#### DashScope / 百炼

```json
{
  "apiKey": "sk-your-qwen-dashscope-official-key",
  "credentialMaterialKey": "qwen-official:dashscope",
  "accountName": "dashscope",
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

#### Coding Plan / 通义灵码

```json
{
  "apiKey": "sk-sp-your-qwen-coding-plan-key",
  "credentialMaterialKey": "qwen-official:coding-plan",
  "accountName": "coding-plan",
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

其中当前推荐的 placeholder 形态应按 surface 区分：

- DashScope / 百炼通用 official key：`sk-...`
- Coding Plan / 通义灵码 dedicated official key：`sk-sp-...`

### 4.2 字段说明

| 字段 | 层级 | 必填 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | credential row | 是 | 真实上游 API key |
| `credentialMaterialKey` | credential row | 否 | 用于标识共享认证材料；同一底层 key 跨 surface 复用时建议填写 |
| `accountName` | credential row | 否 | 运营可读标签 |
| `expiresAt` | credential row | 否 | 若外部系统能提供显式过期时间，可填写 |

### 4.3 operator 不应手改的字段

下面这些字段属于 provider account / runtime 派生，不建议手工塞到单条 credential row：

- `baseUrl`
- `chatCompletionsPath`
- `responsesPath`
- `messagesPath`
- `authMode`
- `anthropicVersion`
- `hiddenFromOperatorInventory`

### 4.4 对 `qwen-coding-plan-*` 的额外 operator 约束

若这条 credential row 将用于：

- `qwen-coding-plan-openai`
- `qwen-coding-plan-anthropic`

当前真实验收标准需要先区分 lane：

- 若是交互式 AI 编程工具场景，仍需：
  - 它对应的 key 已被 Coding Plan upstream surface 接受
- 若是本仓库的 AI gateway API/backend lane，
  当前官方文档已经把它定义到：
  - `服务商不支持`

若 direct-upstream probe 已经返回：

- `401 Unauthorized`
- `invalid_api_key`

则当前对 gateway API/backend lane 应把问题归类为：

- `服务商不支持`

而不是继续把它误记成：

- generic DashScope key 已足够完成全部 official live

截至 `2026-05-18`，operator Web 创建凭证页也已经同步了这条约束：

- `/ops/gateway/providers/[providerAccountId]/credentials/create`

当前若 provider account 属于：

- `qwen-coding-plan-openai`
- `qwen-coding-plan-anthropic`

则页面默认 `凭证 JSON` / `批量凭证 JSON` 草稿会直接给出：

- `apiKey = sk-sp-your-qwen-coding-plan-key`

并附带 operator-visible hint，明确提示：

- Coding Plan 官方文档当前描述的 dedicated key 形态是 `sk-sp-...`
- generic `sk-...` DashScope key 可能仍会被 `coding.dashscope.aliyuncs.com` upstream 拒绝

并且从同一天起，operator credential server action 也已同步这条提示：

- 手动创建
- 批量创建
- 单个上传
- 批量上传
- patch 更新

若目标 provider account 属于：

- `qwen-coding-plan-openai`
- `qwen-coding-plan-anthropic`

且凭证里的 `apiKey` 仍呈现 generic `sk-...` 形态，
当前成功 redirect message 也会追加同样的 operator warning，
避免“保存成功”被误读成“已满足 Coding Plan live key 约束”。

### 4.4.1 当前 `42430` live DB 真相层补充

截至 `2026-05-18` 的 fresh management-api 检查与同日 `qwen_dashscope_live` rerun 之后，
当前 isolated Qwen regression lane 上：

- `Qwen DashScope Live`
- `Qwen Coding Plan OpenAI Live`
- `Qwen Coding Plan Anthropic Live`

当前真实状态已经分成两类：

### DashScope live row

- `Qwen DashScope Live`
  - `providerAccount.payload.apiKey = ""`
  - `GET /v1/internal/gateway/provider-accounts/{id}/credentials?maskSecrets=false`
    当前返回：
    - `credentials: [Qwen DashScope Live Key]`
    - child credential status = `active`
  - 这说明当前代码路径已经在 live runtime 上真正证明：
    - real key 已收口到 child `gateway_provider_credentials` row
    - provider account 本体不再长期 owner 真实 key

### Coding Plan live rows

- `Qwen Coding Plan OpenAI Live`
- `Qwen Coding Plan Anthropic Live`
  - `GET /v1/internal/gateway/provider-accounts/{id}/credentials?maskSecrets=false`
    当前仍返回：
    - `credentials: []`
  - 在 `2026-05-18` 的 latest-head fail-fast rerun 之后，
    这两条 row 的 `providerAccount.payload.apiKey` 当前也已被 scrub 成：
    - `""`
  - 原因不是“代码还不会写 child credential”，而是：
    - generic `sk-...` key 会先被 Coding Plan upstream preflight 拒绝
    - 因此当前还没有机会把这两条 live row 迁移成 child credential truth layer

这意味着当前 live DB 真相层里：

- DashScope official live 的 child credential truth layer 已经有 fresh runtime 证据
- Coding Plan 侧并不存在一条“被 child credential rows 隐藏起来的 dedicated `sk-sp-...` key”
- 当前 generic `sk-...` 若已被 latest-head preflight 明确判定 upstream reject，
  isolated live lane 中对应 Coding Plan provider row 也不应继续保留内联 masked `payload.apiKey`
- 对本仓库的 AI gateway API/backend lane，当前不应再把“继续把 Coding Plan official live 打绿”当作 completion blocker；
  正式结论应记录为：
  - `服务商不支持`

---

## 5. Web Reverse：provider account 基线

`qwen_web_reverse` 的 provider account 当前只负责声明 replay surface，不承载真实会话秘密本体。

### `qwen_web_chat` provider account 示例

```json
{
  "label": "Qwen WebUI Replay",
  "serviceProviderKey": "qwen_platform",
  "serviceProviderLabel": "Qwen Platform",
  "adapter": "qwen_web_compatible",
  "protocolFamily": "qwen_web_chat",
  "protocolProfile": "qwen_web_chat",
  "status": "active",
  "sourceKind": "browser_session",
  "payload": {
    "adapter": "qwen_web_compatible",
    "baseUrl": "https://chat.qwen.ai",
    "defaultModel": "qwen3-coder-plus",
    "headers": {
      "Accept": "application/json"
    },
    "accountLabel": "Qwen WebUI Replay",
    "hiddenFromOperatorInventory": false
  }
}
```

说明：

- `baseUrl = https://chat.qwen.ai`
  - 当前是 surface 语义，不是用户秘密材料
- `headers.Accept = application/json`
  - 当前 canonical control-plane 默认值
  - request-time body 仍可能返回 SSE / chunked upstream stream，但 provider account 默认头不再伪装成 `text/event-stream`
- 浏览器只允许参与：
  - 会话材料提取
  - keepalive / refresh tooling
- 请求期执行必须保持：
  - `pure HTTP / browserless replay`

---

## 6. Web Reverse：canonical normalized credential 模板

Qwen Web reverse 当前统一使用：

- `credential material kind = session_auth`

### 6.1 canonical normalized 模板

```json
{
  "apiKey": "qwen-web-auth-token",
  "headers": {
    "Cookie": "x=1; y=2"
  },
  "supportedModels": [
    "qwen3-coder-plus"
  ],
  "selectedDisplayModel": "Qwen3-Coder",
  "accountName": "user@example.com",
  "credentialMaterialKey": "qwen-web-user:user-123",
  "extraBody": {
    "authSeed": {
      "type": "qwen_web_signin",
      "email": "user@example.com",
      "passwordSha256": "0123456789abcdef"
    }
  }
}
```

### 6.2 字段说明

| 字段 | 层级 | 必填 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | credential row | 是 | 当前有效的 Qwen Web auth token；导入器也接受 `authToken` / `token` / `active_token` 等别名 |
| `headers.Cookie` | credential row | 否 | 已提取的浏览器 Cookie header；可用于更稳的 browserless replay |
| `supportedModels` | credential row | 否 | 当前会话已知可用模型集合；至少第一项会被当作默认 text model |
| `selectedDisplayModel` | credential row | 否 | operator 可读展示模型名 |
| `accountName` | credential row | 否 | 当前会话账号标签；导入器会优先使用 `authProbe.email` 或显式 `accountName` |
| `credentialMaterialKey` | credential row | 否 | 建议填写；常用模式是 `qwen-web-user:<userId>` |
| `extraBody.authSeed` | credential row | 否 | 用于后续 refresh / repair 的登录种子；允许携带邮箱和密码或其 hash |

---

## 7. Web Reverse：raw import 模板

Qwen Web 当前允许导入 browser worker / 手工抽取的原始 payload。导入后网关会把它规范化成上一节的 canonical 结构。

### 7.1 推荐 raw import 示例

```json
{
  "authToken": "qwen-web-auth-token",
  "cookieHeader": "x=1; y=2",
  "selectedModel": "qwen3-coder-plus",
  "selectedDisplayModel": "Qwen3-Coder",
  "authProbe": {
    "email": "user@example.com",
    "userId": "user-123"
  },
  "passwordSha256": "0123456789abcdef"
}
```

### 7.2 导入器会自动派生的字段

从 raw import 规范化到 canonical payload 时，当前会自动：

- 把 `authToken / token / active_token / api_key` 归一成 `apiKey`
- 把 `cookieHeader` 归一成 `headers.Cookie`
- 从：
  - `selectedModel`
  - `defaultModel`
  - `supportedModels[0]`
  归一出 `supportedModels`
- 从 `authProbe.userId` 自动生成：
  - `credentialMaterialKey = qwen-web-user:<userId>`
- 从：
  - `email`
  - `password`
  - `passwordSha256`
  自动生成：
  - `extraBody.authSeed`

### 7.3 operator 不应手改的字段

以下字段若是由 live worker / 导入器自动生成，默认不建议人工硬改：

- `rawSource`
- `credentialMaterialKind`
- `serviceProviderKey`
- `serviceProviderLabel`
- `providerFamilySlug`
- `selectedDisplayModel`（若它来自 live extract）
- `credentialMaterialKey`（若已与 userId 绑定）

---

## 8. 字段分层总结

### 8.1 required

- official
  - `apiKey`
- web reverse
  - `apiKey`

### 8.2 optional

- `accountName`
- `credentialMaterialKey`
- `expiresAt`
- `headers.Cookie`
- `supportedModels`
- `selectedDisplayModel`
- `extraBody.authSeed`

### 8.3 derived

- `rawSource`
- 从 `authProbe.userId` 推出来的 `credentialMaterialKey`
- 从 raw worker payload 推出来的 canonical `apiKey / headers / supportedModels`

### 8.4 runtime-refreshed

- Qwen Web 当前会话 token
- Qwen Web Cookie header
- live extract 中的模型选择 / display model

### 8.5 operator should not hand-edit

- `baseUrl`
- `messagesPath`
- `responsesPath`
- `chatCompletionsPath`
- `authMode`
- `anthropicVersion`
- `hiddenFromOperatorInventory`
- `rawSource`

---

## 9. 最终一句话

Qwen 当前最合理的长期模型应固定为：

- **official 线：provider account owner surface 语义，credential row 只放单条真实 API key**
- **web reverse 线：浏览器只负责提取 session_auth，运行时请求必须继续保持 pure HTTP / browserless replay**
