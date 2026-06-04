# AI 网关运行时与会话总线

## 目的

本文档用于把 AI Gateway 当前最容易混乱的“key / 凭证 / session / browser / runtime”重新收口成一条新的总线。

它优先吸收和替代旧文档中的这些主题：

- provider session / keepalive / runtime material 的旧基线结论
- browser execution capability 与 runtime material 分层语义
- 单行凭证生命周期与文件夹同步的长期规则
- provider quota snapshot 与路由侧可见性边界

---

## 1. 当前正式两层 access/credential 模型

AI Gateway 当前必须长期区分两层：

### 1.1 平台访问层

面向调用方。

它回答：

- 谁可以访问
- 可以访问哪些模型/服务
- 平台侧还剩多少资格/额度

典型对象：

- access key
- bundle
- access projection
- 测试万能密钥

### 1.2 真实 provider 层

面向上游服务商。

它回答：

- 最后拿哪条真实材料去调上游

典型对象：

- provider credential row
- provider quota snapshot
- runtime session material

这两层不能混成一条“万能 key”。

---

## 2. 当前正式三层运行时模型

当前运行时必须再继续拆成三层：

### 2.1 seed credential material

长期可恢复的基础材料。

例如：

- API key
- bearer token
- 原始 cookie
- browser-state object key

### 2.2 runtime session material

当前发送前 ensure 出来的会话材料。

例如：

- `apiKey`
- `headers`
- `extraBody`
- `sessionAuth`
- `expiresAt`
- `runtimeStateObjectKey`

### 2.3 browser-backed execution capability

浏览器执行资源本身。

例如：

- warm browser context
- browser worker
- browser pool lease
- connected client

这三层必须分开说。

尤其不能再把：

- 浏览器上下文
- browser worker
- warmed lease

误建模成一条“凭证”。

### 2.4 request-time browser policy

请求期是否允许 Rust gateway 本进程继续走本地 browser / Node worker fallback，当前统一由：

- `GATEWAY_REQUEST_TIME_BROWSER_POLICY`

表达。

当前正式取值为：

- `local_allowed`
  - 默认值。
  - 允许先尝试远端 browser executor。
  - 远端 executor 缺失、不可达、非 2xx、坏 JSON 时，允许返回 `Ok(None)` 给调用方继续本进程 local browser / Node worker fallback。
- `remote_only`
  - 请求期不允许本进程 local browser / Node worker fallback。
  - `GATEWAY_BROWSER_EXECUTOR_BASE_URL` 缺失或远端不可达时，必须返回 `browser_executor_required_unavailable`。
  - 远端 executor 非 2xx 或返回坏 JSON 时，必须返回 `browser_executor_required_failed`。
- `disabled`
  - 请求期禁止本进程 local browser / Node worker fallback。
  - 仍允许 pure HTTP / browserless replay。
  - 仍允许调用已经配置好的远端 browser executor。
  - 若未配置 `GATEWAY_BROWSER_EXECUTOR_BASE_URL` 且当前路径需要 browser executor，必须返回 `request_time_browser_forbidden`，不得返回 `Ok(None)` 触发本地 fallback。
  - 若已配置远端 executor 但远端不可达、非 2xx 或坏 JSON，必须按 `remote_only` 同样 fail-closed，不得继续本地 fallback。

内部 browser executor 服务入口当前也必须 fail-closed：

- 默认必须配置 `GATEWAY_BROWSER_EXECUTOR_BEARER_TOKEN`。
- 调用方可通过 `Authorization: Bearer ...` 或 `x-internal-api-key` 传入 token。
- 若 token 未配置，必须返回 `browser_executor_token_not_configured`。
- 只有显式设置 `GATEWAY_ALLOW_UNAUTHENTICATED_BROWSER_EXECUTOR=1|true|yes|on` 时，才允许本地开发绕过该 token 配置。

---

## 3. 当前正式 provider credential 真相层

真实 provider credential 当前正式真相层仍然是：

- 单条 `provider credential` 一行

它表达的是：

- 一把 key
- 一份 session/cookie
- 一条 JWT
- 一份 browser-state

而不是：

- 一整个 provider account payload
- 一整个服务商总凭证池

“凭证库”当前首先是逻辑分组，不是新的物理真相层。

---

## 4. 当前正式 keepalive 边界

`keepalive steward` 当前只负责：

1. 判断 session-backed credential 是否仍可用
2. 在必要时刷新 runtime session material
3. 返回 write-back patch

它不负责：

1. 代替正式请求发送
2. 成为第二套公开调用入口
3. 管理浏览器热池生命周期

后台凭证保活与请求期 keepalive 是两个不同层次：

- 请求期 keepalive：只在某条凭证即将参与本次请求时执行，目标是让本次请求继续走正式 hot path。
- 后台凭证保活：由 gateway worker 周期性扫描 `gateway_provider_credentials` 中的 active 单行凭证，在凭证尚未被请求命中时也可提前刷新即将过期的 runtime material。

截至 `2026-05-30`，ChatGPT Web Reverse 已补充 DB-owned 后台保活：

- 只扫描 `adapter = chatgpt_web_reverse_compatible` 的 active provider credential。
- 只对含真实 OAuth `refreshToken` 且进入刷新窗口的 credential 执行 browserless OAuth refresh。
- refresh 调用固定为 `grant_type=refresh_token -> https://auth.openai.com/oauth/token`。
- refresh 成功后写回单行 credential 的 `apiKey / refreshToken / idToken / expiresAt` 等 runtime material。
- refresh 失败只记录单行 credential 错误与失败计数，不把 keepalive steward 变成新的公开调用入口。

所以正式边界必须始终保持：

- `client -> gateway hot path -> upstream`

而不是：

- `client -> keepalive -> upstream`

---

## 5. 当前正式 provider quota 语义

provider quota 当前正式 owner 是：

- **单条真实 provider credential**

它的作用是：

- 决定哪张真实凭证更适合继续承接请求

它不替代：

- 平台 access key 的付费/资格判断

因此必须长期区分：

1. 平台 access quota
2. provider credential quota

这两者可以同时都叫“额度”，但绝不是同一层。

---

## 6. 当前正式请求期选择顺序

请求进入后，当前正式顺序应理解为：

1. 先过平台访问层
2. 再做 route resolution
3. 再落到 implementation line / surface
4. 再从逻辑凭证库中选候选
5. 再按：
   - runtime readiness
   - keepalive ensure
   - provider quota
   - cooling/breaker
   做单凭证决策
6. 最终发送

也就是说，运行时“换取真实凭证”的时机是在：

- access key 之后
- provider transport 之前

---

## 7. 当前正式测试万能密钥边界

测试万能密钥当前只表示：

- 平台侧全模型、全服务商/实现线可访问
- 平台侧额度不设限

它不表示：

- provider quota 一定有
- session 一定有效
- browser owner 一定 ready

因此：

- 若使用测试万能密钥仍然遇到 provider 侧失败
- 当前必须按 provider/runtime 失败面记录
- 不得再误写成“平台 key 不够”

---

## 8. 当前正式冲突处理

若旧文档中仍出现下面这些混写方式：

- access key = provider credential
- runtime session material = browser worker
- browser pool lease = credential row
- provider quota = 平台访问额度

从现在开始都以本文为准。

---

## 9. 当前正式结论

今后只要讨论“凭证、会话、保活、浏览器执行、provider quota”，默认都必须先回答：

1. 现在说的是平台访问层，还是 provider 真实层
2. 说的是 seed material、runtime session material，还是 browser execution capability
3. 这次变化会回写哪一层

只有先把这三件事说清楚，后续 provider 文档和运行时实现才不会继续互相污染。
