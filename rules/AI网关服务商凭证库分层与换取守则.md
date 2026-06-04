# AI 网关服务商凭证库分层与换取守则

适用范围：

- Rust `gateway/`
- provider account / provider credential 控制面
- `~/.neuro` 服务商凭证文件夹同步
- 所有 `official_api / web_reverse / browser-owned / program-owned / pure-http replay`
  共存的服务商接入
- 所有后续需要声明“某个服务商有几套凭证、这些凭证如何分库、请求如何换取到真实凭证”的开发与文档

---

## 1. 守则目标

本守则用于固定 AI 网关里“服务商真实凭证库”的正式理解方式，避免后续再次把下面这些不同概念混成一个“凭证池”：

- 服务商 identity
- 实现线 / owner 线
- provider surface
- 凭证材料种类
- 额度/能力二级分类
- 单条真实凭证行
- 运行时请求到底如何换取到最终执行用的真实凭证

当前目标不是再造一张新的大表，而是把：

- **逻辑分层**
- **文件视图**
- **单条凭证真相层**
- **请求期换取流程**

统一成一套仓库级守则。

---

## 2. 与现有基线的关系

本守则建立在以下已有文档之上，不替代它们：

- `docs/20-ai-gateway/单行凭证生命周期与文件夹同步基线.md`
- `docs/20-ai-gateway/AI网关运行时与会话总线.md`
- `docs/20-ai-gateway/AI网关服务商建模与凭证体系.md`
- `docs/20-ai-gateway/AI网关协议与路由总线.md`

分工如下：

- 上述 canonical `docs/` 文档负责：
  - 真相层
  - 单行凭证生命周期
  - session/runtime/browser 三层边界
  - 路由与协议家族
- 本守则额外负责：
  - **服务商凭证库应该如何按实现线分层**
  - **二级分类应如何建模**
  - **不同实现线如何共享或复用同一份凭证材料**
  - **请求进入后如何从“平台访问”换取到“真实 provider credential”**

---

## 3. 一句话结论

当前 AI 网关中的“服务商凭证库”必须这样理解：

> **每个服务商按实现线拥有一组或多组逻辑凭证库；每组凭证库下还允许按额度、能力、模型、地区、套餐等因素做二级分类；运行时请求必须先解析到目标实现线，再从对应凭证库与子库中换取到单条真实 provider credential。**

补充要求：

- 不同实现线**可以**共享同一份原始认证材料
- 但共享材料不等于合并成同一条实现线，也不等于共享同一个 execution contract
- 真相层仍然是：
  - 单条 `provider credential` 一行
- “凭证库”当前优先理解为：
  - 一组有共同语义的单行凭证集合
  - 而不是强制新增另一张数据库真相表

---

## 4. 正式术语

### 4.1 服务商 `service provider identity`

表达“这是哪一家平台/服务商”。

例如：

- `gemini_platform`
- `qwen_platform`
- `chatgpt_platform`

### 4.2 实现线 `implementation line`

表达“同一家服务商下，本轮到底走哪一条本质不同的实现方案”。

当前至少允许：

- `official_api`
- `web_reverse`
- `canvas_web_reverse`
- 未来其他独立产品线

实现线的判定标准不是名字，而是：

- quota domain 是否不同
- capability domain 是否不同
- execution contract 是否不同
- owner/runtime 是否不同

### 4.3 Surface `provider surface`

表达“某条实现线下的具体可路由 surface”。

例如：

- `google-gemini-api`
- `gemini-web-chat`
- `gemini-canvas-images`
- `qwen-web-chat`

### 4.4 凭证材料种类 `credential material kind`

表达“这条真实材料的基本格式是什么”。

当前至少包括：

- `api_key`
- `bearer_token`
- `session_auth`
- `jwt_widget_session`
- `browser_state`

### 4.5 逻辑凭证库 `credential library`

表达“某个服务商、某条实现线、某个或某组 surface 下，共享同一类路由/运营语义的一组真实凭证集合”。

它当前默认是**逻辑分组概念**，不是要求必须新建一张真相表。

### 4.6 二级分类 / 子库 `credential subpool`

表达“同一个逻辑凭证库内部，再按额度、能力或套餐做出的进一步分类”。

### 4.7 单条真实凭证 `provider credential row`

表达最终真实可用的那一条：

- API key
- session/cookie
- JWT
- browser-state

它仍然是当前正式真相层最小单位。

### 4.8 共享材料键 `credentialMaterialKey`

表达“不同 surface / 不同实现线下的若干凭证行，实际上共享同一份底层认证材料”。

它用于识别共享，不用于抹平实现线差异。

### 4.9 凭证换取 `credential exchange`

表达“请求进入后，网关如何从平台访问资格与目标模型，换取到最终执行所需的单条真实 provider credential”。

注意：

- 这里的“换取”不是把真实 secret 发给调用方
- 而是 gateway 在内部完成：
  - 实现线选择
  - 凭证库筛选
  - 子库筛选
  - 单凭证选择

---

## 5. 正式分层规则

### 5.1 第一层：按服务商分

每个服务商都是一个独立的大类。

例如：

- `gemini_platform`
- `qwen_platform`

不得先把多个服务商的材料塞到一个“通用大凭证池”里，再靠 label 猜测来源。

### 5.2 第二层：按实现线分

同一服务商下，默认必须按**实现线**继续拆分。

例如 `Gemini` 当前至少应存在三条主实现线：

1. `official_api`
2. `web_reverse`
3. `canvas_web_reverse`

这三条线即使共享 Google identity，也不能直接视为同一个凭证库，因为它们的：

- quota domain
- capability domain
- execution contract
- session/runtime 要求

都不完全相同。

### 5.3 第三层：按 surface 分

实现线下可以继续按具体 surface 拆分。

这是为了避免把：

- 文本
- 图片
- 音乐
- 视频
- business widget
- canvas program

这种已知 contract 不同的能力继续混成一个总 bucket。

### 5.4 第四层：按材料种类分

同一 service provider + implementation line + surface 下，还必须显式区分：

- `credentialMaterialKind`

原因：

- 同一 surface 可能同时接受不同形式的 seed material
- 同一服务商不同实现线的材料格式往往天然不同

---

## 6. 二级分类规则

同一逻辑凭证库内，当前允许继续做二级分类。

### 6.1 允许的二级分类维度

二级分类当前至少允许按以下维度建立：

1. `额度/套餐`
   - 例如：
     - `free`
     - `plus`
     - `pro`
     - `team`
     - `enterprise`

2. `可调用能力`
   - 例如：
     - `text_only`
     - `text_tts`
     - `image_only`
     - `image_edit`
     - `music_video`
     - `multimodal_full`

3. `模型绑定`
   - 例如：
     - 该库内只服务某些模型
     - 该库内对某类模型做单独容量控制

4. `地区/网络/出口环境`
   - 例如：
     - 某些会话只适合特定区域或出口环境

5. `账号来源或账号家族`
   - 例如：
     - 某一批 imported account
     - 某一批 browser-state 恢复线

### 6.2 二级分类的正式表达方式

当前二级分类**不应默认通过乱加目录层级实现**。

原因：

- 现有文件夹同步正式目录基线仍是：
  - `<root>/<service-provider>/<provider-surface>/<credential-material-kind>/<credential>.json`
- 若随意增加第四、第五层目录，容易直接破坏现有 importer/exporter 合同

因此当前二级分类默认应通过以下方式表达：

- provider credential payload 中的显式字段
- operator 可编辑的结构化元数据
- 机器可读的稳定标签/枚举值
- 路由热路径的过滤字段

而不是只靠：

- 文件名拼接
- 人工约定
- 自由文本 label

### 6.3 当前推荐的二级分类字段

若某条线需要正式引入二级分类，当前推荐至少使用机器可读字段表达，例如：

- `quotaTier`
- `capabilityClass`
- `accountPlan`
- `regionClass`
- `accountFamily`
- `modelBindingGroup`

若当前 schema 还未显式收口这些字段，也必须至少先保证：

- 这些信息存在于可稳定导入/导出的结构化 JSON 中
- 不得只留在聊天上下文或人工口头约定中

---

## 7. 共享材料与跨线复用

### 7.1 允许共享

不同实现线或不同 surface 可以共享同一份底层认证材料。

例如：

- 同一服务商后台账号
- 同一组 cookie/session
- 同一把 key

理论上可同时服务多条线。

### 7.2 共享不等于合并

即使共享同一份材料，也仍必须保持：

- 不同实现线下的 `provider credential row` 分开存在
- 不同 surface 的 owner 语义分开记录
- 不同模型、不同能力、不同额度状态分开判断

当前不得因为“材料相同”就把：

- `official_api`
- `web_reverse`
- `canvas_web_reverse`

合并成一套统一运行时真相。

### 7.3 正式关联方式

当前跨 surface / 跨实现线共享同一份材料时，正式应使用：

- `credentialMaterialKey`

它的职责是：

- 识别共享来源
- 支持 operator 看到“这些行实际来自同一份材料”
- 支持后续 refresh / 失效传播 / 诊断联动

它**不是**：

- 新的 provider account
- 新的 execution owner
- 对不同实现线差异的抹平器

---

## 8. 凭证换取流程

当前正式的“凭证换取”流程必须这样理解：

1. 调用方拿平台访问 key / bundle / access projection 进入网关
2. 网关先解析：
   - 允许的服务商
   - 允许的模型
   - 允许的协议入口
3. 再解析目标服务商下的：
   - 实现线
   - surface
4. 从该实现线对应的逻辑凭证库中取候选
5. 按二级分类过滤子库
   - 套餐/额度
   - 能力类型
   - 模型绑定
   - region/account family
6. 展开成单条 `provider credential row`
7. 再读取单条凭证的：
   - quota snapshot
   - cooling / failure
   - keepalive/runtime readiness
8. 最终选出：
   - `selected implementation line`
   - `selected provider surface`
   - `selected provider credential`
   - `selected model`
   - `selected outbound protocol family`
9. 用这条真实凭证执行请求

这条流程里最重要的正式边界是：

- 平台访问资格 != 真实 provider 凭证
- 凭证库 != provider account payload
- 子库 != 单条凭证
- 运行时最终发送的最小选择单位仍然是：
  - `selected provider credential + selected model`

---

## 9. 与当前文件夹视图的关系

当前正式文件夹视图仍然优先保持：

- `<root>/<service-provider>/<provider-surface>/<credential-material-kind>/<credential>.json`

这代表的是：

1. 服务商 identity
2. surface
3. 凭证材料种类
4. 单条凭证文件

而“实现线”和“二级分类”当前可能：

- 从 `providerSurfaceKey`、provider profile、protocol profile 推导
- 或在 payload/metadata 中显式声明

正式要求是：

- 若当前 schema 尚未引入显式 `implementationLineKey`
  - 可以先从 `providerSurfaceKey + provider profile` 稳定推导
- 但后续不得长期依赖“看名字猜实现线”的隐式约定

同理：

- 二级分类若未正式上 schema
  - 可以先从 payload 中的结构化字段表达
- 但不得只靠文件名后缀或 operator 记忆维持

---

## 10. Gemini 作为当前具体实例

当前 `Gemini` 这条服务商线，应默认这样理解它的凭证库：

### 10.1 第一层：服务商

- `gemini_platform`

### 10.2 第二层：实现线

至少三条主实现线：

1. `official_api`
2. `web_reverse`
3. `canvas_web_reverse`

### 10.3 第三层：示例 surface

- `official_api`
  - `google-gemini-api`
  - `google-vertex-gemini`
- `web_reverse`
  - `gemini-web-chat`
  - 以及已迁回 web reverse 的 legacy mixed-lane 纯 HTTP 能力
- `canvas_web_reverse`
  - `gemini-canvas-chat-tts`
  - `gemini-canvas-images`
  - `gemini-canvas-music`
  - `gemini-canvas-videos`
  - `gemini-canvas-program-*`

### 10.4 第四层：材料种类

例如：

- `api_key`
- `bearer_token`
- `session_auth`
- `browser_state`
- `jwt_widget_session`

### 10.5 二级分类示例

例如可按：

- `plus / pro / team`
- `text / image / music / video / image_edit`
- `browser-owned / program-owned / browserless probe-validated`

做进一步分类。

### 10.6 共享材料示例

如果同一份 Google 认证材料理论上可同时服务：

- `gemini_web_reverse`
- `gemini_canvas_web_reverse`

那么当前允许它们共享：

- 同一个 `credentialMaterialKey`

但不允许因此直接得出：

- web reverse 成功 = canvas reverse 成功
- 一条线 green = 另一条线 green

---

## 11. 完整实现后的交付要求

当某个服务商或实现线声称“凭证库规则已经完整实现”时，至少应交付一张表，列出：

| 服务商 | 实现线 | Surface | 凭证材料种类 | 是否存在二级分类 | 二级分类维度 | 是否与其他线共享材料 | 共享键 | 当前是否已实跑验证 |
|--------|--------|---------|--------------|------------------|--------------|----------------------|--------|--------------------|

并附：

- 对应 `rules/` / canonical `docs/` 文件
- 对应 focused / fixture / live 归档
- 对应当前 folder-sync 样例路径

---

## 12. 禁止做法

当前明确禁止：

1. 把“一整个 provider account payload”继续当成完整凭证池。
2. 把同一服务商下所有实现线都塞进一个“总凭证池”而不分线。
3. 只按服务商名建目录，不区分实现线/surface/material kind。
4. 用文件名、人工标签、聊天上下文来隐式表示二级分类，而没有结构化字段。
5. 因为多条线共享同一份原始材料，就把这些线合并成一个 execution contract。
6. 把 browser runtime / warmed context / worker lease 当成 credential 库条目保存。
7. 把一条线的 live success 误写成整个服务商所有线都已完成。

---

## 13. 当前正式落地原则

在未新增额外数据库真相表之前，当前正式原则应先保持：

- `gateway_provider_credentials` 继续作为单条真实凭证真相层
- “凭证库”优先作为逻辑分组与路由规则存在
- “二级分类”优先通过结构化 metadata/payload 表达
- “共享材料”优先通过 `credentialMaterialKey` 表达
- “请求期换取”优先通过：
  - `service provider`
  - `implementation line`
  - `provider surface`
  - `credential subpool filters`
  - `single provider credential row`

逐层收敛

这样既不会破坏现有单行凭证真相层，又能把多实现线、多材料种类、多子库分类的规则正式化。
