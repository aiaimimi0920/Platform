# Platform 可维护性优化 round 4（2026-08-13）

> 当前状态说明（2026-08-15）：本文记录的是 round 4 当时的本地拆分和验证现场，
> 不是当前正式 full release 证明。下述 sibling release 目录是 Web component 包，
> 其 manifest 记录了 dirty worktree；完整 Platform release 仍须通过 clean-commit
> acceptance、六镜像锁和 artifact runtime smoke。当前置顶计划见
> `docs/40-engineering/code-optimization-plan-20260815.md`。

本轮只做纯结构性拆分：整块搬移巨型文件，不改变运行时行为、函数签名或 HTTP 契约。目标是把后续功能开发从万行单体中解放出来。

## 已完成拆分

| 原文件 | 原规模 | 结果 |
| --- | --- | --- |
| `core/src/modules/agent-execution/service.ts` | ~11,000 行 | 71 行 facade + `service/` 17 个子模块 |
| `core/src/modules/product-order-item/service.ts` | ~6,600 行 | 66 行 facade + `service/` 11 个子模块 |
| `core/src/modules/arbitration/service.ts` | ~3,400 行 | 39 行 facade + `service/` 10 个子模块 |
| `packages/ai-gateway-domain/src/modules/gateway/service.ts` | ~11,000 行 | 147 行 facade + `service/` 21 个子模块 |
| `web/src/app/ops/account/agents/page.tsx` | ~3,900 行 | 620 行页面 + lib/feature 组件 |
| `web/src/app/arbitrations/page.tsx` | ~2,000 行 | 366 行页面 + lib/feature 组件 |
| `web/src/lib/core-client.ts` | ~2,586 行 | 17 行 facade + `core-client/` 子模块 |
| `web/src/lib/account-client.ts` | ~2,599 行 | 17 行 facade + `account-client/` 子模块 |
| `core/src/modules/task-hub/service.ts` | ~2,282 行 | 34 行 facade + `service/` 10 个子模块 |
| `packages/ai-gateway-domain/.../gateway/router.ts` | ~1,983 行 | 31 行入口 + `router/` 12 个子路由 |

拆分结构说明分别见：

- `docs/40-engineering/agent-execution-service拆分结构.md`
- `docs/40-engineering/product-order-item-service-split.md`
- `docs/40-engineering/arbitration-service拆分结构.md`
- `docs/40-engineering/ai-gateway-service拆分结构.md`

## 门禁（round 4 收口时）

- `@neuro/core` unit：172 / 172
- `@neuro/web` unit：380 / 380
- `@neuro/ai-gateway-domain` unit：236 / 236，vitest 67 / 67
- 三处 typecheck 通过，其中 web `next build` 生成 69 个静态页

## 产物与本地栈

- Web 组件包：sibling `../release/Platform/optimization-round4-20260813-2325`
- 本地 Docker 使用 `deploy/docker-compose.local.yml` 启动完整栈：web / core / account-api / gateway / worker / executor / account-worker / loom / tea + postgres / valkey / minio
- Loom 本地镜像需要 `COPY protocol/`；compose 需设 `LOOM_TLS_TERMINATED=1` 才能在容器网络绑定 `0.0.0.0`
- Tea 构建上下文必须用 `**/target/` 忽略 cargo target，否则 Windows 上会把数 GB 产物打进 context

## 发现但未改的后续项

- `web/src/lib/core-client.ts`、`account-client.ts`、`core/.../task-hub/service.ts`、`ai-gateway-domain/.../gateway/router.ts` 仍是下一轮拆分候选。
- `getCallbackAuditSummaryForOperator` 等审计摘要在派生过滤下会分页扫全表。
- `autoAssignSlaItemManualReviews` 循环内重复拉全量 workload。
- `claimNextArbitrationCase` 靠吞 `ConflictError` 顺序重试。
- Loom 本地镜像需要在 sibling Dockerfile 中拷贝 `protocol/` 后才能编进 compose。
