# Platform 产品完成项目概览

日期：`2026-07-18`

状态：设计前只读审计材料，不是长期规则；候选长期规则位于 `docs/40-engineering/Platform产品完成与验收基线.md`，是否已生效以该文件状态字段为准。

## 1. 当前结构

Platform 是 Node.js/TypeScript workspace，主要运行单元为：

| 运行单元 | 责任 |
| --- | --- |
| `web` | Next.js Owner、Visitor、Operator UI 与浏览器 API |
| `core` | 任务、Agent、商品、治理、Tea 等主业务聚合 |
| `services/account-api` | 身份、钱包、邮箱、权益和账户 HTTP API |
| `services/account-worker` | 账户 outbox、通知与 Gateway 分析任务 |
| `worker` | Platform 通用 outbox 消费 |
| `executor` | 定时与运维任务执行 |
| `packages/contracts` | 跨运行单元类型和协议 |
| `packages/backend-foundation` | HTTP、错误、DB/Redis 基础能力 |
| `packages/account-domain` | 账户领域实现 |
| `packages/ai-gateway-domain` | 迁移期 Gateway 控制面数据与 helper |

外部依赖：

- `../Gateway`
- `../Loom`
- `../Tea`
- `../Hook` 是相邻前台交互 owner；当前 Platform 没有正式运行时调用点，验收以 source/dependency inventory 证明 `not-applicable`。
- PostgreSQL
- Valkey
- S3-compatible object storage

## 2. 当前已有能力

- 56 个 Next.js 页面路由和 51 个 Web Route Handler。
- Owner、Visitor、Operator 三类视图。
- 身份、钱包、商品、权益、任务、Agent、项目、邮箱、信誉、仲裁和 Tea 页面。
- Core、Account API、两个 Worker、Executor 和本地 Compose。
- 149 个 Core migration、41 个 Account migration、33 个迁移期 Gateway migration。
- 默认 smoke、typecheck、workspace build 和 Compose config 当前可通过。
- Web 生产进程可启动，`/health`、`/ready`、`/login` 可响应。

## 3. 当前不等于产品完成的原因

- `/chat` 是客户端 seed 演示，不调用真实后端。
- `managed_heavy` 在 Core 被明确拒绝。
- 正式 UI 中存在假成功、demo fallback 和依赖故障假空状态。
- 关键领域测试仍是 README 占位。
- integration 默认 gate skip，不能证明真实数据层。
- `test:debt` 当前 `44 passed / 9 failed`，且后续 Node mock debt suite 尚未执行。
- 没有覆盖完整 Owner/Visitor/Operator 的浏览器门禁。
- Compose 不能安全并行作为隔离验收栈。
- Compose 验收若继续从兄弟源码 build，会把外部 dirty 状态带入结果。
- K8s 清单仍包含 example 值和 `latest` 镜像。
- 当前 Platform release 只交付 Web。

## 4. 目标状态

目标不是重写 Platform，而是在现有模块化单体和多运行单元架构上完成：

- 真实重度智能体领域和对话闭环。
- 所有正式入口的数据真实性和错误真实性。
- 核心领域事务与权限测试。
- 可重复的隔离全栈验收。
- 完整的浏览器产品旅程。
- 版本锁定、可验证、可回滚的 Platform 交付面。
