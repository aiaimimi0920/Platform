# Gemini 三线路与 Canvas 派生运行时架构规范

本文档是 `Gemini Platform` 在本仓 AI Gateway 中的正式架构规范。

它回答四件事：

1. `official_api / web_reverse / canvas_web_reverse` 三条线到底如何区分
2. 三条线各自的 `owner` 是谁
3. 凭证、bootstrap 配置、派生运行时材料到底应该如何导入、持久化、派生、保活、失活重建
4. 为什么 `Gemini Canvas` 第三条线不能再被实现成“创建 app 之后又回到聊天框生成”

---

## 1. 三条线的正式定义

### 1.1 `official_api`

- owner：
  - 官方 Gemini API / 官方 WS
- steady-state 调用：
  - 直接调用官方 API / 官方 websocket
- 典型认证材料：
  - `api_key`

这条线与网页产品 surface 无关。

### 1.2 `web_reverse`

- owner：
  - `https://gemini.google.com/` 通用聊天框
- steady-state 调用：
  - 在网页聊天 surface 上选择模式、输入提示词、提交消息
  - 网关只是在反代 / 复放这一套页面协议
- 典型认证材料：
  - `session_auth`
  - `browser_state`
  - `__Secure-1PSID`
  - `__Secure-1PSIDTS`
  - `cookieHeader`

这条线的本质是：

- **chatbox-owned**

### 1.3 `canvas_web_reverse`

- owner：
  - concrete `Canvas app / program`
- steady-state 调用：
  - 先创建或 materialize 出一个具体 Canvas app
  - 后续所有生成都围绕该 app 的 `program-owned contract` 执行
- 典型运行时材料：
  - `canvasProgramUrl`
  - `appPath`
  - `conversationId`
  - `responseId`
  - `canvasProgramInvokeContract`
  - `runtimeStateObjectKey`
- 典型 bootstrap 配置：
  - `shareId`
  - `shareUrl`

这条线的本质是：

- **program-owned**

它与第二条线的根本差异不是 host 名字，而是：

- **owner 不同**
- **steady-state execution contract 不同**

---

## 2. 三条线的 owner 真相

| 实现线 | owner | 是否允许聊天框 steady-state |
| --- | --- | --- |
| `official_api` | 官方 API | 不适用 |
| `web_reverse` | Gemini 通用聊天框 | 允许，这正是该线本质 |
| `canvas_web_reverse` | concrete Canvas app / program | **不允许** |

因此：

- 第二条线允许“网页聊天框 owner”
- 第三条线一旦创建出 Canvas app，后续就 **不得再回到聊天框 owner**

凡是下面这些行为，都只能归第二条线或 debug/discovery：

- 页面里切音乐模式再发送
- 页面里切图片模式再发送
- 页面输入框提交 prompt 后拿结果
- browser UI submit 成功后把结果说成第三条线成功

---

## 3. 凭证模型：源凭证、bootstrap 配置与派生运行时凭证

Gemini 当前正式推荐使用三层模型：

### 3.1 源凭证 `source credential`

定义：

- 用户导入
- 长期保存
- 作为 Gemini web 身份底座

当前 Gemini 下最重要的源凭证是：

- 第二条线 `web_reverse` 的 session / browser-state 凭证

典型字段：

- `__Secure-1PSID`
- `__Secure-1PSIDTS`
- `cookieHeader`
- `credentialMaterialKey`
- `runtimeStateObjectKey`（若来源是 browser-state 对象）

### 3.2 bootstrap 配置 `bootstrap config`

定义：

- 不是用户秘密材料
- 不是用户逐条导入的主凭证
- 是第三条线 `canvas_web_reverse` 的实现线级 / surface 级固定入口配置

当前最关键的字段是：

- `shareId`
- `shareUrl`

当前仓库里的 canonical Gemini Canvas bootstrap 默认值截至 `2026-05-12` 已收口为：

- `shareId = fe24c455a570`
- `shareUrl = https://gemini.google.com/share/fe24c455a570`

如果当前只有一个 canonical 的 Gemini Canvas 程序入口，那么：

- `shareId/shareUrl` 应优先理解为：
  - **provider-surface / implementation-line bootstrap config**
- 而不是：
  - **每条用户凭证都要重复携带的一部分**

也就是说：

- `shareId` 不是认证秘密
- `shareId` 不是账号身份
- `shareId` 更像“从哪一个 seed/入口重新 materialize Canvas app”

必要时可以进一步按 operation 做配置映射，例如：

- `text -> shareId`
- `image -> shareId`
- `music -> shareId`
- `video -> shareId`

### 3.3 派生运行时凭证 `derived runtime credential`

定义：

- 不是用户手工导入的主凭证
- 由网关在运行时从源凭证派生
- 代表某一个具体 Canvas app 的可执行运行时材料

典型字段：

- `canvasProgramUrl`
- `pageUrl`
- `appPath`
- `conversationId`
- `responseId`
- `canvasProgramInvokeContract`
- 必要时的 `cookieHeader`
- 以及可选 provenance：
  - `shareId`
  - `shareUrl`

这份派生物的语义是：

- **program-owned runtime material**

而不是第二条线聊天框凭证的别名。

---

## 4. Gemini Canvas 的正式凭证策略

### 4.1 默认导入策略

当前正式推荐策略：

- 用户 / 外部程序默认只导入：
  - 第二条线 `web_reverse` 风格的 Gemini web session 凭证
- 第三条线 `canvas_web_reverse` 不再要求用户手工维护完整 program handle
- 第三条线的 `shareId/shareUrl` 默认应优先由：
  - provider 配置
  - surface 配置
  - implementation-line bootstrap 配置
  提供，而不是由每条用户凭证重复携带

也就是说：

- 第二条线凭证是 **主导入凭证**
- 第三条线的 `shareId/shareUrl` 是 **bootstrap config**
- 第三条线运行时材料是 **自动派生凭证**

### 4.2 第三条线 bootstrap

当请求命中第三条线时，网关应：

1. 从 Gemini web 源凭证池中选择一条可用 session
2. 读取第三条线固定 bootstrap 配置
   - 典型为：`shareId/shareUrl`
3. 使用该 session + bootstrap config 做 HTTP bootstrap
4. 通过：
   - `GET /share/<shareId>`
   - `POST rpcids=ujx1Bf`
5. 创建或 materialize 具体 Canvas app
6. 解析出：
   - `canvasProgramUrl`
   - `appPath`
   - `conversationId`
   - `responseId`
   - `canvasProgramInvokeContract`
7. 将这份结果持久化成第三条线派生运行时凭证

重点：

- 第三条线允许复用第二条线的认证底座
- 第三条线允许从固定 `shareId/shareUrl` 重建 app
- 但创建出 app 之后，steady-state 必须转向 `program-owned contract`

### 4.3 当前只有一个 canonical bootstrap 入口时的规则

如果当前产品/实现上只有一个 canonical 的 Gemini Canvas app 创建入口，那么正式规则应当是：

- `shareId/shareUrl` 视为 **固定 bootstrap config**
- 它可以是一个确定值
- 它不必作为“每条用户凭证”的组成部分反复写入
- 当前仓库内这份 canonical 配置已经存在，不再只是文档约定

在这种情况下，凭证层应只保存：

- 第二条线源凭证
- 以及第三条线派生运行时材料

而 bootstrap seed 则应放在：

- provider account 配置
- provider surface 配置
- 或专门的 Gemini Canvas bootstrap 配置层

---

## 5. 第三条线持久化策略

第三条线派生运行时凭证应被持久化。

原因：

- 避免每次请求都重新创建 Canvas app
- 保留已验证过的 program handle
- 让后续调用可直接复用 concrete app runtime

当前持久化对象至少应包含：

- `runtimeStateObjectKey`
- `canvasProgramUrl`
- `pageUrl`
- `appPath`
- `conversationId`
- `responseId`
- `canvasProgramInvokeContract`
- 必要时：
  - `shareId`
  - `shareUrl`
  - `cookieHeader`
  - `candidatePairs`
  - `aggregateHints`
  - `lastSeenConversationId`
  - `lastSeenResponseId`
  - `capturedAt`
  - `lastValidatedAt`

---

## 6. 第三条线保活与失活重建

### 6.1 保活职责

保活系统当前应分两层理解：

#### A. 源凭证保活

对象：

- 第二条线 Gemini web session / browser-state

职责：

- 保持 Gemini web 身份底座持续可用

#### B. 派生运行时保活

对象：

- 第三条线具体 Canvas app runtime

职责：

- 检查该 app/program handle 是否仍然可执行

### 6.2 失活重建

当前正式语义应当是：

- 如果第三条线具体 Canvas app 失活
- 但第二条线源凭证仍有效
- 网关应：
  1. 将旧第三条线派生运行时材料标记失效
  2. 重新基于同一份 Gemini web 源凭证做 HTTP bootstrap
  3. 创建新的 Canvas app
  4. 生成新的第三条线运行时材料
  5. 用新材料覆盖或替换旧材料

这意味着：

- 第三条线是 **可重建的运行时对象**
- 不是要求用户长期手工维护的一套独立主凭证

---

## 7. 严格禁止的混线行为

以下行为禁止作为第三条线成功：

1. 创建 Canvas app 之后，又回到聊天框选择音乐/图片/视频模式
2. 创建 Canvas app 之后，又通过页面输入框提交 prompt
3. 使用 browser UI submit 成功，再把结果包装成 `canvas_web_reverse`
4. 使用 official API key 直连成功，再把结果包装成 `canvas_web_reverse`
5. 第三条线失活后，不做重建，直接偷偷退回第二条线聊天框执行

第三条线允许的唯一正确恢复方式是：

- **用第二条线源凭证重建第三条线**
- **不是直接回第二条线执行 steady-state 生成**

---

## 8. 对程序 B 的正式要求

如果外部程序 B 要与本仓 Gemini 凭证系统对接，推荐按以下层次实现。

### 8.1 最低推荐：只生成第二条线源凭证

程序 B 至少应能产出：

- `__Secure-1PSID`
- `__Secure-1PSIDTS`
- `cookieHeader`
- `credentialMaterialKey`

若输出的是 browser-state 对象，还应给：

- `runtimeStateObjectKey`

这是当前最推荐的长期方向：

- 导入层简单
- 第三条线由网关运行时自动派生
- 第三条线 bootstrap seed 由系统配置提供

### 8.2 若程序 B 还负责生成第三条线 bootstrap 配置

则至少应再补：

- `shareId`
- `shareUrl`

这样网关就可以直接执行：

- `share -> app`

来 materialize 第三条线 runtime。

这里要特别注意：

- `shareId/shareUrl` 在这种模式下更像 **bootstrap config payload**
- 不是“用户级源凭证秘密”

### 8.3 若程序 B 能完整 materialize 第三条线

则可额外提供：

- `canvasProgramUrl`
- `appPath`
- `conversationId`
- `responseId`
- `canvasProgramInvokeContract`

但这不是当前系统的唯一依赖形式，也不是默认要求用户手工维护的主格式。

---

## 9. 示例文件

当前仓库已经提供以下样例：

- 第二条线源凭证样例：
  - `docs/20-ai-gateway/examples/gemini-web-reverse-credential.raw.sample.json`
- 第三条线 bootstrap 样例：
  - `docs/20-ai-gateway/examples/gemini-canvas-program-credential.bootstrap.raw.sample.json`
- 第三条线 fully materialized 样例：
  - `docs/20-ai-gateway/examples/gemini-canvas-program-credential.materialized.raw.sample.json`
- 配套说明：
  - `docs/20-ai-gateway/examples/gemini-credential-lines-samples.md`

---

## 10. 当前正式结论

截至 `2026-05-12`，Gemini 的正式架构收口应理解为：

1. `official_api`
   - 独立 owner
   - 独立 API key 凭证体系
2. `web_reverse`
   - 以 Gemini web session 为源凭证
   - owner 是通用聊天框
3. `canvas_web_reverse`
   - 复用 Gemini web session 作为认证底座
   - 优先消费固定的 `shareId/shareUrl` bootstrap 配置
   - 通过 HTTP bootstrap 自动创建 Canvas app
   - 自动派生、持久化、保活、失活重建第三条线 program runtime
   - steady-state 只走 `program-owned contract`

一句话总结：

- **第二条线凭证是源凭证**
- **`shareId/shareUrl` 是 bootstrap 配置，不是用户级凭证**
- **第三条线凭证是派生运行时凭证**
- **第三条线可以从第二条线派生，但不能在 steady-state 回退成第二条线**
