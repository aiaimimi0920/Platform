# Platform 产品完成模块盘点

日期：`2026-07-18`

## 模块状态表

优先级按 candidate canonical 基线中的单一严重度规则记录；外部账号、额度和第三方可用性不使用 P0/P1/P2。

| 模块 | 当前实现 | 主要缺口 | 优先级 |
| --- | --- | --- | --- |
| Identity | Linux.do 与本地开发身份路径存在 | 首次/再次登录、模块关闭、生产 bypass 测试不足 | P1 |
| Wallet/Ledger | 账本、冻结和多币种模型存在 | 核心事务与负余额不变量测试仍为占位 | P1 |
| Commerce | 商品、订单、item、兑换、市场存在 | Web 面板会把依赖错误回退为空业务状态 | P1 |
| Benefits | 权益、服务、凭证与 API access 存在 | `/benefits` 仍是弹层说明入口，需正式工作面 | P1 |
| Task Hub | 发布、申请、proposal、履约与结算代码存在 | 完整状态机和资金托管集成测试不足 | P1 |
| Agent Registry | light/open protocol 与大量治理能力存在 | `managed_heavy` 被拒绝，领域测试不足 | P0 |
| Heavy Chat | 完整视觉终端存在 | seed、内存状态、定时器模板回复、无持久化 | P0 |
| Projects | 账户项目、赞助和加入 API 存在 | 依赖失败使用可赞助 demo catalog，部分字段为展示层预设 | P1 |
| Mailbox | 邮件、附件、领取和 ops 能力存在 | `/mailbox` 是说明性深链入口 | P1 |
| Reputation/Opinion | 信誉、投票、结算与运维存在 | 多处依赖错误静默转换为 null/empty | P1 |
| Arbitration | 案件、证据、人工复核和清理队列存在 | 用户入口重定向，Operator 错误可能显示为空 | P1 |
| Tea | Web -> Core -> Tea 边界和专项 smoke 较完整 | 需纳入统一浏览器与 release 验收 | P1 |
| Gateway Ops | provider、credential、cost、trace、archive UI 存在 | 迁移期 test debt、错误态和外部依赖证据需收口 | P1 |
| Worker | outbox recovery 存在 | `/ready` 不能区分持续故障 | P1 |
| Account Worker | 通知和 Gateway 分析任务存在 | `/ready` 不能区分依赖失败 | P1 |
| Executor | 定时任务入口存在 | 没有测试脚本和执行合同门禁 | P1 |
| Compose | 可启动完整本地拓扑 | 固定端口、默认 project、宿主凭证挂载 | P0 |
| K8s | 基础清单存在 | example 值、缺 migration、RBAC 过宽、环境不隔离，无法从空环境部署 release | P0 |
| Tofu | 可移植 IaC 骨架存在 | 正式变量、环境验证和部署证据不足 | P1 |
| Acceptance/CI contract | 已有 smoke、typecheck 和 Compose render | 缺 Platform 内唯一 acceptance 命令、skip-fails manifest 和可上传完整证据目录 | P1 |
| Release | Web package、checksum 和 smoke 脚本存在 | 不含后端、migration 和完整部署 manifest | P0 |

## 关键真实链路

### 已有较强基础

- Tea 工单生命周期与 Web/Core/Tea credential boundary。
- Agent execution 的运行时、callback、补救和治理分析。
- 商品、订单、任务和仲裁的数据库模型。
- Account worker outbox recovery 与部分运行时观测。

### 必须新建或补齐

- Platform 重度对话领域模块。
- 重度 slot/project/thread/message 数据模型。
- 对话到任务、邮箱的真实动作桥。
- 隔离验收 Compose wrapper。
- Platform 内 `acceptance:ci / acceptance:live / release:build / acceptance:release` runner 与 evidence/release manifest。
- 核心领域 PostgreSQL/Valkey integration suite。
- Platform 全旅程 Playwright suite。
- 完整 Platform release manifest。
