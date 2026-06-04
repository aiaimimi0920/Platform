# 账户域 API 与服务边界

## 目的

本文档用于吸收 `legacy source: account/API文档.md` 与 `legacy source: account/开发文档.md` 中关于账户域 API、owner、调用方式的内容，并收口成新的 canonical 文档。

它回答三件事：

1. 账户域到底 owner 哪些服务能力
2. 调用方应如何访问 `account-api`
3. 账户域与平台域的边界在哪里

---

## 1. 当前正式账户域 owner

账户域当前正式 owner 的能力主要包括：

- identity
- `/v1/me`
- wallet summary
- mailbox
- announcements
- personal missions
- reputation
- user progression
- benefits 的账户侧聚合入口

它当前不是：

- 整个平台所有业务事实的唯一 owner

尤其这些能力仍然主要属于平台域：

- 商品完整生命周期
- 任务主事实链
- 仲裁主事实链
- Agent 执行主事实链

账户域当前的正式定位仍然是：

- **账户聚合服务**

---

## 2. 当前正式服务单元

账户域当前正式运行单元包括：

- `packages/account-domain`
- `services/account-api`
- `services/account-worker`
- `packages/backend-foundation`

边界如下：

### 2.1 `packages/account-domain`

账户业务逻辑唯一 owner。

### 2.2 `services/account-api`

账户服务的正式 API 入口，只负责：

- 路由装配
- 内部鉴权
- 健康检查
- 聚合输出

### 2.3 `services/account-worker`

账户异步副作用与轮询服务。

### 2.4 `packages/backend-foundation`

跨服务共享的基础设施层，不承载账户业务真相。

---

## 3. 当前正式调用模型

`account-api` 当前正式不是一个浏览器直接公开认证的 API。

它当前主要由：

- `web`
- 平台内部服务

通过**内部请求头**调用。

后续如需扩大公开面，也不能先打破这条边界再说。

---

## 4. 当前正式鉴权规则

账户 API 当前统一使用 internal request 鉴权。

最小正式头包括：

- `x-internal-api-token`

用户上下文类接口还必须补：

- `x-neuro-user-id`

这意味着：

- `account-api` 当前不是随便拿浏览器 cookie 就能直打的公共 API
- 其正式使用方式仍然是：
  - 平台内部调用
  - BFF 转发

---

## 5. 当前正式 API 类型

账户域 API 当前应按三类理解：

### 5.1 健康与就绪类

例如：

- `GET /health`
- `GET /ready`

### 5.2 用户账户聚合类

例如：

- `GET /v1/me`
- `GET /v1/wallet`
- `GET /v1/reputation`
- `GET /v1/missions/panel`
- `GET /v1/mailbox/messages`

### 5.3 内部运营/同步类

例如：

- `POST /internal/identity/linuxdo-upsert`
- `POST /internal/product-shadow/sync`
- 各类 mailbox ops internal 接口

---

## 6. 当前正式 `/v1/me` 理解

`/v1/me` 当前正式是：

- 用户账户聚合快照入口

它可以展示：

- 身份
- 钱包摘要
- 邮箱摘要
- 账户域自己的成长与信誉摘要
- 平台域的只读投影

但它不意味着：

- 账户域拥有所有投影背后的业务真相层

所以后续文档和代码注释中，必须继续区分：

- `snapshot`
- `source of truth`

---

## 7. 当前正式账户域与平台域边界

边界可以压成三句话：

1. 账户域 owner 用户账户聚合与个人终端高频读取
2. 平台域 owner 商品、任务、仲裁、Agent 执行等主事实链
3. 账户域可以读取平台派生只读投影，但不因此自动拥有平台主事实

这条规则后续必须长期保持。

---

## 8. 当前正式前端调用边界

前端调用账户域时，默认应通过：

- `web/src/lib/account-client.ts`

而不是：

- 随处手写 `fetch`
- 再把账户 API 混回平台 client

这样做的正式意义是：

- 保持账户域入口独立
- 保持前端调用口径一致

---

## 9. 当前正式结论

从现在开始，后续讨论账户 API、账户服务边界、账户域 owner 时，默认以本文为准；旧 `legacy source: account/API文档.md` 继续保留为 source material，但不再是新的主线。
