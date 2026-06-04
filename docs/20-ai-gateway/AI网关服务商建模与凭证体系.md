# AI 网关服务商建模与凭证体系

## 目的

本文档用于统一归纳 AI 网关中最容易反复混淆的三件事：

1. 服务商和实现线怎么分
2. provider credential 到底是什么
3. 请求期如何从平台访问换取到真实执行凭证

---

## 1. 当前正式服务商模型

每个 provider 相关结论都必须至少拆成：

1. `service provider identity`
2. `implementation line`
3. `provider surface`
4. `credential material kind`
5. `provider credential row`

这五层缺一不可。

---

## 2. implementation line 是什么

`implementation line` 不是一个随便起的名字，而是同一服务商下**本质不同的实现方案**。

典型包括：

- `official_api`
- `web_reverse`
- `canvas_web_reverse`

判定标准不是“名字像不像”，而是：

- quota domain 是否不同
- capability domain 是否不同
- execution contract 是否不同
- owner/runtime 是否不同

---

## 3. surface 是什么

`surface` 是实现线下可被实际路由的具体产品面或能力面。

例如：

- `gemini-web-chat`
- `gemini-canvas-images`
- `google-gemini-api`

surface 不应再和 service provider identity 混成一层。

---

## 4. credential material kind 是什么

它表达：

- 这条真实材料的基本格式是什么

当前仓库正式支持的主类型包括：

- `api_key`
- `bearer_token`
- `session_auth`
- `jwt_widget_session`
- `browser_state`

这层是材料格式，不是 route owner。

---

## 5. provider credential row 是什么

当前真相层仍然是：

- 单条 `provider credential` 一行

也就是说：

- 一把 API key
- 一份 session/cookie
- 一条 JWT
- 一份 browser-state

在数据库真相层里都应是一条独立行。

“凭证库”当前首先是逻辑分组，不是要求立刻新增第二张大真相表。

---

## 6. 逻辑凭证库与子库

### 6.1 逻辑凭证库

同一服务商、同一实现线、同一类 surface 下，共同承载某类执行语义的一组凭证集合。

### 6.2 子库

同一逻辑凭证库内部，允许继续按以下维度细分：

- 套餐/额度
  - `free / plus / pro / team / enterprise`
- 能力类型
  - `text / image / image_edit / music / video`
- 模型绑定
- 地区/出口环境
- 账号来源/家族

当前这层建议优先通过结构化 metadata 表达，而不是无限加深文件夹层级。

---

## 7. 共享材料

不同实现线可以共享同一份底层认证材料。

例如：

- 同一服务商后台账号
- 同一份 cookie/session
- 同一把 key

但共享材料不等于：

- 共享同一 execution contract
- 共享同一 quota domain
- 共享同一完成度结论

当前跨 surface / 跨实现线共享材料的正式关联键是：

- `credentialMaterialKey`

---

## 8. 请求期换取流程

当前请求期“换取真实凭证”的正式理解方式是：

1. 调用方拿平台 access key 进来
2. 网关校验资格与模型访问权
3. 决定目标：
   - service provider
   - implementation line
   - provider surface
4. 从对应逻辑凭证库中选候选
5. 按子库维度过滤
6. 展开到单条 `provider credential row`
7. 再按：
   - quota snapshot
   - cooling / last error
   - runtime/session readiness
   - selected model
   做最终选择
8. 发送到上游

最终最小安全粒度仍然是：

- `selected provider credential + selected model`

---

## 9. Gemini 作为当前样例

当前 `Gemini` 必须至少按三条实现线理解：

1. `official_api`
2. `web_reverse`
3. `canvas_web_reverse`

即使它们可能共享 Google identity，也不能直接视为同一条线。

这正是当前新规则和 `docs/` 文档重建要解决的问题：

- 不再让“同一服务商”掩盖“不同实现线”

---

## 10. Qwen 作为两实现线样例

当前 `Qwen Platform` 必须至少按两条实现线理解：

1. `qwen_official_api`
2. `qwen_web_reverse`

并继续拆出 4 个 canonical surface：

- `qwen_dashscope_openai`
- `qwen_coding_plan_openai`
- `qwen_coding_plan_anthropic`
- `qwen_web_chat`

其中：

- 三个 official surface 共享同一份 Qwen official core
- `qwen_web_chat` 当前仍是独立 `web_reverse` surface
- 同一服务商下的 official surface 与 web reverse surface 不得共用同一个 execution contract 叙事

这正是当前 Qwen 平台重构后的正式模型：

- 同一服务商可以有多条实现线
- 同一实现线可以有多个 surface
- compile switch 粒度应固定在实现线，不是 surface

---

## 11. 当前正式结论

以后在本仓库里看到“服务商支持/凭证支持/凭证库”这些词时，默认都应先问：

1. 是哪家服务商
2. 是哪条实现线
3. 是哪个 surface
4. 是哪种材料格式
5. 是哪条真实 provider credential

不再允许把这些层次压成一句模糊描述。

---

## 12. 当前已落地的实现线 Manifest 真相层

截至 `2026-05-18`，Rust gateway 主干里已经正式落了一套可执行的实现线 manifest 真相层：

- schema：
  - `gateway/manifests/schema/gateway-line-manifest.schema.json`
- line manifests：
  - `gateway/manifests/lines/**`
- validator：
  - `deploy/validate-gateway-line-manifests.py`

当前这套 manifest 不是历史说明文档，而是给下面几层共同消费的静态真相层：

1. compile feature / binary inclusion 说明
2. focused cargo verification 入口
3. fixture / live suite 绑定
4. 凭证样例 / 字段说明 / build doc 路径
5. 公共模板层与平台差异层映射

当前已接入的 wave-2 / wave-3 line manifest 至少覆盖：

- `chatgpt-official-api`
- `chatgpt-codex-oauth-official`
- `chatgpt-web-reverse`
- `qwen-official-api`
- `qwen-web-reverse`
- `gemini-web-reverse`
- `gemini-canvas-program`
- `aistudio-official`
- `aistudio-web-reverse`
- `google-agent-platform-official`
- `chataibot-web-reverse`
- `kiro-official-vendor-api`
- `accio-web-reverse-api`
- `azure-openai-official-vendor-api`
- `anthropic-messages-official-model-api`
- `aws-bedrock-converse-official-model-api`
- `cohere-chat-official-model-api`
- `perplexity-search-official-vendor-api`
- `tavily-search-official-vendor-api`
- `exa-search-official-vendor-api`
- `jina-search-official-vendor-api`
- `jina-reader-official-vendor-api`
- `linkup-search-official-vendor-api`
- `you-search-official-vendor-api`
- `websearchapi-search-official-vendor-api`

当前正式约束也随之落地成仓库事实：

- line manifest 可以表达：
  - `lineFeature`
  - `familyCommonFeatures`
  - `compileLayer`
  - `binaryInclusionGroup`
- repo validator 会检查：
  - 文档路径是否存在
  - suite id 是否已注册
  - Cargo feature 是否已声明
  - 同名 `id / lineFeature` 是否冲突
  - `docs/20-ai-gateway/**` canonical 文档树里的关键 markdown 引用是否仍指向真实存在的文件
