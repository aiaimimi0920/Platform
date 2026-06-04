# AI 网关多协议兼容测试守则

适用范围：

- Rust `gateway/`
- `deploy/test-gateway-protocol-matrix.py`
- 所有 provider / surface / profile 的 fixture、focused、live 回归
- 所有后续声称“已支持 / 已完成 / 已绿灯”的 AI 网关能力

---

## 1. 守则目标

本守则用于固定 AI 网关测试的统一目标、统一术语、统一完成标准。

当前测试的根目标不是“某个 provider 单点能返回内容”，而是：

> **只要调用方指定了一个平台允许的模型，并从平台支持的任意协议入口进入，网关都应尽量自动完成协议归一、路由与转换，并把结果用调用方原始协议家族的形态回给调用方。**

换句话说，测试的核心是：

1. 多协议入口是否兼容
2. 回包协议是否保持 caller-visible 一致
3. 上游能力不足、provider 不支持、quota gate、browser challenge 是否被正确归类
4. 每条 provider surface 到底完成到哪一层，而不是泛化成一句“这个服务商已支持”

---

## 2. 当前测试总原则

### 2.1 以 surface 为最小完成粒度

完成度默认必须按以下粒度记录：

1. `service provider identity`
2. `provider surface`
3. `protocol profile`
4. `endpoint family / capability family`

禁止把一个服务商下不同 surface 的结果混写成一个“总支持”结论。

例如：

- 同一个服务商可能同时有：
  - `official_api`
  - `web_reverse`
  - `browser_owned relay`
  - `program_owned relay`
- 这些 surface 的完成度必须分开标，不得互相替代

### 2.2 以 caller-visible 契约为第一判断面

测试首先看：

- 调用方从哪个入口进来
- 是否拿到符合该协议家族预期的回包

而不是先看：

- 底层实际使用的模型是谁家的
- 上游内部到底走了哪个非公开 contract

### 2.3 以真实证据为准

任何“已完成 / 已支持 / 已绿灯”的声称，必须至少落到以下一种证据：

- focused case 归档
- fixture suite 归档
- live suite 归档
- 运行时日志 / 资产下载 / caller-visible 回包

不得只靠：

- 静态代码存在
- 单次人工口头验证
- 某个相邻 provider 的类比推断

---

## 3. 测试对象分层

测试对象必须按以下层次拆分：

### 3.1 协议入口层

典型包括：

- `chat/completions`
- `responses`
- `messages`
- `completions`
- `models`
- `realtime`
- `generateContent`
- `live`
- `embeddings`
- `audio/transcriptions`
- `audio/speech`
- `images/generations`
- `images/edits`
- `music/generations`
- `videos/generations`
- `search / fetch / research / credits`

### 3.2 provider surface 层

典型包括：

- `official_api`
- `web_reverse`
- `canvas_web_reverse`
- `business_images`
- `browser_owned relay`
- `program_owned relay`

### 3.3 owner / execution 层

典型包括：

- `pure protocol / official api`
- `pure HTTP replay`
- `mixed lane`
- `browser-backed`
- `browser-owned relay`
- `program-owned relay`

---

## 4. 必测内容清单

后续任何 provider / surface 若要声称“完整支持”，必须明确覆盖以下测试维度。

### 4.1 鉴权头兼容

至少要验证：

- `Authorization`
- `x-api-key`
- `api-key`
- `X-Goog-Api-Key`

若环境支持 alias header，也应单独登记为附加验证，不得混进默认固定头集合。

### 4.2 入口协议家族

至少要验证当前该 surface 对外声称支持的协议家族：

- `OpenAI Chat`
- `OpenAI Responses`
- `Anthropic Messages`
- `OpenAI Completions`
- `Model Catalog`
- 以及该 surface 明确支持的其他协议族

### 4.3 流式 / 非流式

若该入口协议支持流式，必须明确测试：

- `non_stream`
- `stream`

不能只测其中一个就声称全支持。

### 4.4 Tools / Function Calling

若该 surface 声称支持 tools，至少要区分：

- `none`
- `required`
- `specific`
- `roundtrip`
- `emulated`（如 XML fallback）

并明确 caller-visible 语义是否成立。

### 4.5 非文本入口

按 surface 能力分别覆盖：

- `embeddings`
- `audio/transcriptions`
- `audio/speech`
- `images/generations`
- `images/edits`
- `music/generations`
- `videos/generations`
- `search / fetch / research / credits`

不能用“文本已过”替代这些能力。

### 4.6 资产可见性

凡是图片、音频、视频、音乐结果，必须额外验证：

- caller-visible URL 是否可直接使用
- caller-visible b64 / binary 是否真实可消费
- 是否需要 authenticated download
- 若只返回内部 `blob:` URL，是否已被网关转换为 caller-usable 资产

### 4.7 `/v1/models`

每条 surface 的模型目录能力必须单独验证：

- 是否返回正确模型
- 是否受 access projection / bundle / credential payload 过滤
- 是否回平台 alias，而非错误泄露 provider-native 虚拟模型名

### 4.8 错误与失败面

每条 surface 除成功外，还必须明确记录这些失败分类：

- `provider unsupported`
- `gateway unsupported`
- `quota reached / rate limit`
- `browser challenge`
- `session invalid`
- `asset missing`
- `tool unsupported`
- `protocol mismatch`

不能把所有失败都混成一个“没过”。

### 4.9 Session / Runtime / Keepalive

对于 session-backed、browser-backed、web-reverse、program-owned surface，必须额外验证：

- runtime material 是否可导入
- session 是否可续命 / refresh
- 运行时回写是否污染其他 case
- provider credential payload 是否需要 per-case reset

### 4.10 Owner 语义

对于多 owner 系统，必须明确判断：

- 是否是 `official api owner`
- 是否是 `pure HTTP owner`
- 是否是 `mixed lane`
- 是否是 `browser-owned relay`
- 是否是 `program-owned relay`

任何“已完成”都必须带 owner 语义，不得只给 provider 名。

### 4.11 测试阶段按需最小编译

测试单个服务商、单个 surface、或单个**实现线**时，当前默认必须采用：

- **按需最小编译原则**

定义：

- 只把当前测试对象真正需要的内容编进本轮测试产物
- 不把与本轮无关的其他服务商、其他大模块、其他历史集成线一并编进同一个测试产物

目标：

1. 缩短单服务商/单实现线测试反馈时间
2. 避免无关模块引入编译噪音
3. 让多个 AI / 多个开发者可以同时针对不同服务商独立编译与测试
4. 避免不同测试轮次互相污染编译目录、镜像、日志与产物

当前正式补充要求：

- **测试过程只编译当前相关功能即可，不需要为了本轮验收额外编译或测试全部服务商。**

具体语义：

1. 若本轮目标是某个服务商下的单条实现线，则默认只验证该实现线相关代码路径、focused case、fixture 与 live suite
2. 无关服务商的编译错误、测试失败、未完成迁移、并行重构中的中间态，不应默认阻塞当前实现线的结构验收与 live 验收
3. 只有当用户明确要求“全网关全服务商回归”或“全仓完整测试”时，才应把全部服务商纳入同一轮测试范围
4. 这条规则不等于跳过必要验证；当前实现线仍必须完成：
   - 最小编译
   - 本实现线 focused / fixture / live 证据
   - caller-visible 契约验证

强制要求：

1. **最小独立编译粒度不是“服务商”，而是“服务商下的具体实现线”**
   - 如果某个服务商只有一条实现线，则可按服务商独立编译
   - 如果某个服务商下有多条本质不同的实现线，则必须按实现线分别独立编译
2. **单实现线测试默认独立编译**
   - 例如只测 `Gemini official_api` 时，只编 `Gemini official_api`
   - 例如只测 `Gemini web_reverse` 时，只编 `Gemini web_reverse`
   - 例如只测 `Gemini canvas_web_reverse` 时，只编 `Gemini canvas_web_reverse`
   - 不应顺手把与本轮无关的其他服务商、其他实现线一起编进去
3. **像 Gemini 这类多实现线服务商，测试阶段必须拆成多套独立编译目录**
   - 当前 Gemini 至少应拆成：
     - `official_api`
     - `web_reverse`
     - `canvas_web_reverse`
   - 也就是说，Gemini 当前测试阶段默认至少应有三套独立编译产物
4. **编译产物必须独立目录**
   - 每个服务商实现线 / 每个任务 / 每个 agent 都必须有独立编译目录
   - Rust 本地默认建议：
     - `.runtime/cargo-target-<provider>-<surface-or-line>-<task-or-agent>`
   - 例如 Gemini 推荐：
     - `.runtime/cargo-target-gemini-official-api-<task>`
     - `.runtime/cargo-target-gemini-web-reverse-<task>`
     - `.runtime/cargo-target-gemini-canvas-web-reverse-<task>`
   - 不允许多个 AI 共享同一个默认 `target/`
5. **镜像 / 容器 / 端口也应独立**
   - 若本轮测试需要容器镜像，应使用独立镜像 tag
   - 若需要本地容器实例，应使用独立容器名与端口
   - 这个独立性同样按“实现线”区分，而不是只按服务商名区分
6. **测试归档必须能反推出对应编译上下文**
   - 至少要能知道：
     - 测的是哪个 provider
     - 测的是哪个 surface / implementation line
     - 对应哪套编译产物
     - 是否是最小编译

推荐最小实践：

- Rust 本地测试：
  - 显式设置 `CARGO_TARGET_DIR`
- Docker 测试：
  - 使用独立镜像名 / tag
  - 使用独立容器名 / 端口
- provider-focused suite：
  - 先裁剪到该 provider 当前实现线相关 feature / surface
  - 再跑 focused suite

禁止做法：

- 单服务商 focused 验证时仍使用“全量 provider 全编译”的默认测试产物
- 多实现线服务商测试时，继续只产出“一套服务商总编译产物”
- 多个 AI 并行测试时共用同一个编译目录
- 不区分服务商直接复用同一套测试镜像并混写结果

#### 开发镜像预算与清理

测试与开发阶段当前默认允许：

- 围绕某个服务商的某条实现线频繁重新编译并产出新的开发镜像

这本身是被支持的效果，不应因为“镜像编得多”就被视为异常。
但必须同时遵守以下规则：

1. **冗余镜像必须及时清理**
   - 例如先编译版本 `A`
   - 发现功能缺失后继续修改代码并编译出版本 `B`
   - 若 `A` 已不再承载当前有效验证价值，则 `A` 应视为冗余镜像并删除
2. **关键测试数据优先保留，旧镜像本体不默认长期保留**
   - 若旧镜像对应：
     - focused/live 归档
     - 关键日志
     - 关键回包
     - 截图 / 抓包 / summary
   - 则默认应先保存这些证据，再删除旧镜像
3. **镜像预算按“服务商 + 实现线”计算**
   - 当前正式预算：
     - **一个服务商的一条实现线，理论上最多允许并存 5 个开发镜像**
4. **若需要第 6 个及之后的新开发镜像**
   - 默认必须先删除旧的无效开发镜像
   - 再腾出空间继续产出新镜像

禁止做法：

- 把大量历史失败镜像长期堆在本地，只为保留“也许以后会看”的可能性
- 不保留测试证据，却试图通过长期堆镜像来代替归档
- 不区分服务商/实现线，把所有开发镜像混成一个共享垃圾堆

### 4.12 测试万能密钥

当前 AI 网关测试体系还必须维护一类专用的：

- **测试万能密钥**

它的正式语义是：

- 一条**测试阶段专用的平台 access key**
- 不是某个服务商的真实 provider credential
- 不是某个上游的 API key / cookie / session

#### 正式规则

测试万能密钥当前必须同时满足：

1. **平台侧永远满额度**
   - 不受普通测试套餐、余额、次数限制影响
   - 不因平台级 project/key 配额而提前阻断请求
2. **平台侧默认拥有全部已开放模型访问权**
   - 当前项目中已接入、已开放给测试的模型目录，默认都可通过该 key 访问
3. **平台侧默认拥有全部已开放服务商/实现线访问权**
   - 包括：
     - `official_api`
     - `web_reverse`
     - `canvas_web_reverse`
     - 以及其他已纳入测试矩阵的实现线
4. **必须继续走正常调用流程**
   - 不得因为是测试万能密钥，就绕过：
     - access key 鉴权
     - access projection
     - `/v1/models` 目录过滤
     - 路由与 candidate queue
     - provider credential exchange
     - keepalive / runtime ensure
     - 真实发送链
5. **不得直接硬绑某条真实凭证**
   - 除非该测试 case 本身就是在验证显式 `credential_ref`
   - 否则测试万能密钥只能提供“平台访问资格”，不能跳过真实凭证选择

#### 最重要的边界

测试万能密钥的“万能”，当前只表示：

- **平台侧权限全开**
- **平台侧额度不设限**

它**不表示**：

- 所有 provider 真实凭证都一定健康
- 所有上游 session 都一定有效
- 所有 provider quota 都一定充足
- 所有 browser/program owner 都一定 ready

因此：

- 若某次调用因为 provider quota、browser challenge、session invalid、asset missing、上游 429/402/403 等失败
- 当前仍必须按真实失败面记录
- 不得因为用了测试万能密钥，就把这类失败误写成“平台权限不足”

#### 推荐测试用途

测试万能密钥当前主要用于：

1. **验证统一公共调用链**
   - 入口协议兼容
   - 模型目录
   - 自动路由
   - provider credential exchange
   - caller-visible 回包
2. **验证某条 provider/surface 在“平台访问全开”前提下的真实完成度**
3. **避免平台级 key/bundle/次数限制干扰 provider 实现判断**

#### 仍需保留的其他测试 key

即使存在测试万能密钥，以下测试仍不能完全被它替代：

1. **受限投影 key**
   - 用于验证 `/v1/models`、bundle、access projection、模型过滤是否正确
2. **单实现线 / 单服务商 key**
   - 用于验证路由隔离是否正确
3. **显式 `credential_ref` key**
   - 用于验证“只命中指定真实凭证，不偷偷 fallback”是否成立

也就是说：

- 测试万能密钥负责验证“平台全开条件下，真实实现能不能跑通”
- scoped key 负责验证“平台限制条件下，访问边界是否仍正确”

#### 归档要求

凡是使用测试万能密钥跑出的 focused / fixture / live 归档，当前都应在 summary 或配套说明中显式写清：

- 本轮使用的是 `测试万能密钥`
- 它只放开平台侧权限/额度
- 真实 provider quota / session / challenge 仍按原始语义记录

---

## 5. 绿灯标准

### 5.1 完整绿灯

一个 surface / capability 只有同时满足以下条件，才可标记为**完整绿灯**：

1. 代码路径已落地
2. focused case 已通过
3. fixture/live suite 已通过，或边界已明确登记
4. caller-visible 契约成立
5. 文档 / 规则已同步

### 5.2 部分绿灯

满足以下任一情况，必须标记为**部分绿灯**而不是完整绿灯：

- 只有文本过，媒体没过
- 只有 fixture 过，没有 live
- 只有 browser fallback 成功，pure HTTP 未成立
- 只有 quota gate accepted，没有真实 200 资产成功
- 只有 provider external gate accepted，没有真实 200 资产成功
- 某些 endpoint 家族未覆盖

### 5.3 不得误报为完整绿灯的情况

以下情况禁止写成“完整支持”：

- 只有代码实现，没有回归归档
- 只有单 case 成功，没有 suite
- 旧 surface 的归档拿来替代新 surface
- browser fallback 成功，被写成 pure HTTP 成功
- accepted quota gate，被写成真实成功资产
- accepted provider external gate，被写成真实成功资产

---

## 6. 实现模式分类标准

每条 surface / capability 在结果表里必须显式标注以下实现模式之一。

### 6.1 纯协议实现

定义：

- 通过正式协议 / 正式 API / 纯 HTTP contract 完成调用
- request-time 不依赖浏览器 owner
- 不依赖 browser relay 才能成功

典型包括：

- 官方 API
- 纯 HTTP reverse replay
- 同协议直连

### 6.2 混合实现

定义：

- 一个能力链中混用了多种 owner 或多种发送方式
- 例如：
  - pure HTTP 主链 + browser fallback
  - official runtime API + legacy replay follow-up
  - 资产提取仍依赖另一路 helper

混合实现不是负面标签，但必须诚实标明，不得冒充纯协议实现。

### 6.3 浏览器实现

定义：

- request-time owner 仍然是浏览器 / browser pool / connected client / remote executor
- 网关只是 relay / orchestrator / browser-backed bridge

其中可再细分备注：

- `browser-owned relay`
- `program-owned relay`

### 6.4 结果表必须同时允许记录 owner 说明

例如：

- `纯协议实现 / pure HTTP replay`
- `混合实现 / pure HTTP + browser fallback`
- `浏览器实现 / program-owned relay`

---

## 7. 服务商不支持的标记标准

### 7.1 什么时候标记为“服务商不支持”

只有在以下任一条件成立时，才允许标：

- 官方文档明确不支持
- live upstream 明确返回“不支持该能力”
- 同 surface 的真实上游 contract 已证明该 endpoint 天然不存在

### 7.2 什么时候不能标“服务商不支持”

以下情况不能写成“服务商不支持”：

- 只是我们网关还没实现
- 只是当前 session/challenge/配额问题
- 只是 browser fallback 没接上
- 只是这个 provider 的另一个 surface 不支持

这些情况必须分别标成：

- `网关未实现`
- `会话/挑战限制`
- `限额/配额限制`
- `其他 surface 才支持`

### 7.3 记录方式

结果表必须允许写出：

- `服务商不支持`
- `网关未实现`
- `已验证 quota gate`
- `已验证 provider external gate`
- `仅 browser-backed`
- `仅 fixture`

不能只用单一布尔值。

### 7.4 什么时候允许标记为 `provider external gate accepted`

只有当以下条件同时成立时，才允许这样记录：

1. 网关已经把真实请求送达官方 upstream
2. caller-visible 协议契约、路由与必要签名/运行时 owner 已成立
3. 剩余失败面来自 provider 账号开通、allowlisting、法务/政策审核、企业白名单等外部门槛

这类情况当前可以按：

- `provider external gate accepted`

记录为“实现已成立，但仍受上游账号外部门槛限制”。

禁止把这类结果写成：

- `网关未实现`
- `真实 200 成功`

---

## 8. 结果表标准模板

后续任何 provider / surface 认为自己“已完整绿灯实现后”，都必须至少用下面这张表记录。

| 服务商 | Surface | Protocol Profile | 能力项 | 当前状态 | 实现模式 | Owner 语义 | 服务商是否支持 | 证据归档 | 备注 |
|--------|---------|------------------|--------|----------|----------|------------|----------------|----------|------|
| Gemini Platform | `gemini_web_reverse_modular` | `gemini_web_reverse_modular` | `chat_completions` | 完整绿灯 | 纯协议实现 | pure HTTP replay | 支持 | `summary.json / logs` | caller-visible 200 |
| Gemini Platform | `gemini_canvas_program_web_reverse_modular` | `gemini_canvas_program_web_reverse_modular` | `videos_generations` | 部分绿灯 | 混合实现 或 浏览器实现 或 纯协议实现 | program-owned / pure HTTP / mixed | 支持 | `summary.json / response.txt / logs` | 若是 quota gate，通过但不是 200 资产成功，必须写明 |

推荐最少能力列举：

- `chat_completions`
- `responses`
- `messages`
- `completions`
- `models`
- `tools`
- `stream`
- `embeddings`
- `audio_transcriptions`
- `audio_speech`
- `images_generations`
- `images_edits`
- `music_generations`
- `videos_generations`
- `search/fetch/research/credits`

---

## 9. 每次测试归档必须写明的内容

每一轮 focused / live / fixture 归档，至少应包含：

1. `suite id`
2. `provider surface`
3. `protocol profile`
4. `case list`
5. `active pass / fail`
6. `caller-visible 结果`
7. `accepted error` 是否命中
8. 当前实现模式
9. 当前 owner 语义
10. 剩余边界

---

## 10. 当前仓库中的特殊注意事项

1. 一个 provider 的旧 surface 归档，不能替代新 modular surface 归档。
2. 一个 browser-owned 结果，不能替代 pure HTTP 结果。
3. 一个 accepted quota gate，通过时必须明确记成：
   - `部分成功`
   - 或 `绿灯但附带 quota gate 说明`
   不能当作真实 `HTTP 200` 资产成功。
4. 对 session-backed / program-owned surface，若 suite 内多个 case 会共享同一条 runtime credential，必须明确验证是否需要 per-case reset。

---

## 11. 文档同步守则

凡是测试标准、结果分类、表格字段、green 定义发生变化，必须同轮同步：

- `rules/AI网关多协议兼容测试守则.md`
- `AGENTS.md`
- 早期协议兼容矩阵
- 早期协议兼容详细测试档案
- 相关 progress/baseline 文档

---

## 12. 冻结结论

从现在开始，AI 网关测试不得再只回答“能不能调用”，而必须同时回答：

1. 从哪些协议入口能调
2. 具体哪些 endpoint/capability 已覆盖
3. 是纯协议实现、混合实现，还是浏览器实现
4. 是我们没做完，还是服务商本身不支持
5. 证据归档在哪里
