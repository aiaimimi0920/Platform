# NeuroLoom 平台总基线

## 目的

本文档用于作为 `NeuroLoom` 平台的新的总基线文档。

它不是旧 `docs/` 中若干 `NeuroLoom*` 文档的机械合并，而是当前正式归纳后的平台主线。

---

## 1. 平台是什么

`NeuroLoom` 当前不是单一网站，也不是单一 AI 网关项目。

它是一个同时包含以下能力的平台：

- 用户与身份体系
- 钱包、账本与结算
- 商品、订单、资产与权益
- 任务市场与履约
- Agent 注册、执行与交付
- 信誉、风控与仲裁
- AI 网关
- 平台运营与控制面

因此后续所有架构、产品、开发文档都必须基于一个前提：

> `NeuroLoom` 是一个模块化平台，而不是“一组零散页面 + 一组零散脚本”。

---

## 2. 当前正式三视图

平台界面当前正式只分三类：

1. **Owner View**
   - 用户自持视图
   - 已登录用户查看和编辑自己的内容

2. **Visitor View**
   - 游客公开视图
   - 任何人查看用户公开内容，只读

3. **Operator View**
   - 管理员运维视图
   - 面向平台治理与运营

这三类视图必须长期保持边界清晰。

禁止：

- 用 `Operator View` 组件偷渡到用户前台
- 在 `shared` 组件里混入 owner/operator 分支，把视图边界写散

---

## 3. 当前正式平台主模块

从产品与工程角度，当前平台主模块可归纳为：

### 3.1 账户域

包括：

- identity
- `/v1/me`
- mailbox
- announcements
- user progression
- reputation
- daily rewards
- benefits

### 3.2 商品/订单/资产域

包括：

- 商品
- 订单
- item / asset
- 兑换码 / 优惠码
- 钱包与账本

### 3.3 任务与能力域

包括：

- Task Hub
- 能力市场
- 任务发布与履约
- 任务交付与售后

### 3.4 Agent 域

包括：

- Agent 注册
- Agent 执行
- callback / external runtime
- 轻度 / 重度 / 云端智能体

### 3.5 AI Gateway 域

包括：

- 外部统一调用入口
- provider 路由
- 真实凭证库
- keepalive / runtime material
- protocol bridge

### 3.6 风控与仲裁域

包括：

- reputation
- arbitration
- manual review
- issue / remediation / dispute

---

## 4. 当前正式技术总线

当前平台正式采用：

- 架构：模块化单体 + 多运行单元
- 核心宿主：标准 IaaS
- 核心服务：容器化
- 编排：`k3s`
- 主数据库：`PostgreSQL`
- 缓存/锁：`Valkey`
- 对象存储：S3-compatible
- 边缘与对象层：`Cloudflare`

平台当前不应再被理解成：

- 一个完全静态的前端工程
- 一个只有后端 API 的工具型项目
- 一个只能依赖特定云厂商托管运行时的系统

---

## 5. 当前正式 owner 结论

### 5.1 Web

`web` 是前台与控制台 UI，不是所有平台事实的最终 owner。

### 5.2 Core

`core` 继续是平台主业务聚合与运行主线。

### 5.3 Account

`account-api / account-domain / account-worker` 是账户域 owner。

### 5.4 Gateway

Rust `gateway/` 是 AI gateway 的长期正式 owner。

这条结论当前已经冻结：

- 旧 TypeScript gateway 不再是长期主线
- 其他站点/控制面若需要 AI 网关能力，应调用 Rust gateway API

---

## 6. 当前正式部署边界

当前长期部署边界可以压成三句话：

1. `Cloudflare` 负责稳定的边缘层与对象层
2. 动态应用服务继续留在可迁移的标准计算环境
3. 热路径同步流量尽量留在同一私网/同一区域，不绕公网回环

这条边界后续若变化，必须同步更新：

- `AGENTS.md`
- `rules/`
- `docs/`

---

## 7. 当前文档重建后的正式理解

后续若继续写平台总线类文档，应以本文作为上位摘要。

其他更细的专题，例如：

- 账户域细节
- AI 网关细节
- 开发协作与测试细节

都应下沉到 `docs/` 的对应子目录中，不再把新总线继续堆回根目录。
