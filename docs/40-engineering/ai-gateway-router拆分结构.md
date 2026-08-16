# ai-gateway-domain gateway router 拆分结构

`packages/ai-gateway-domain/src/modules/gateway/router.ts`（原 1,983 行、约 101KB）已按与 `service/` 对齐的内聚职责拆分为 `packages/ai-gateway-domain/src/modules/gateway/router/` 下的子模块。`router.ts` 保留为薄入口：继续导出原有 `gatewayRouter`，并按子模块挂载全部 HTTP 路由。

本次为纯结构性搬移：handler 体、Zod schema、query helper 整块移动，未改变注册路径、HTTP 方法、鉴权 `preHandler`、或响应形状。`ai-gateway-domain` 仍是迁移期网站后台过渡数据层，本次未扩张其职责。

`gatewayRouter` 仍只是迁移期 legacy HTTP surface，不得在 `services/account-api` 重新注册为新 owner 路径。Rust `gateway/` 才是正式 AI 网关 owner。

## 子模块职责

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `shared.ts` | 497 | Zod body schema 与 query helper（`readQuery*` / `readGatewayRequestAuditFilters`） |
| `operator-catalog.ts` | 39 | operator 目录 / provider inventory / 模型关联矩阵 / 成本总览 |
| `operator-audits.ts` | 109 | 请求审计列表/概要/详情/工件、会话列表与详情 |
| `prompt-cache.ts` | 41 | prompt-cache summary 与 trend-report |
| `analysis-summary.ts` | 112 | 分析样本/概要、provider-routing summary / anomaly-report / sync |
| `rate-limit-hotspots.ts` | 257 | 限流热点概要/趋势/异常报表、热点快照与异常快照 |
| `analysis-exports.ts` | 206 | 分析导出、持久化导出列表/盘点/报表/diff/元数据/清理 |
| `anomaly-policies.ts` | 83 | 异常策略列表/概要/保存/sync/sweep |
| `anomaly-incidents.ts` | 130 | 异常事件列表/概要/告警队列/历史、sync/acknowledge/resolve/follow-up |
| `anomaly-remediation.ts` | 174 | 补救队列/run 列表与概要、impact 采集、plan/execute/sweep |
| `remediation-effectiveness.ts` | 224 | 补救效果概要与效果快照/异常快照 |
| `provider-admin.ts` | 290 | provider 健康/readiness/pressure、account CRUD、source-profile、model alias、route policy |
| `router.ts`（facade） | 31 | 组装子 router，导出 `gatewayRouter` |

没有独立 `access` HTTP 子 router：access（benefit project ensure / API access resolve/rotate / token 认证）只存在于 `service/access.ts`，本 legacy router 从未挂过对应路径。

## 约束

- 对外导入仍走 `./modules/gateway/router` 的 `gatewayRouter`；包入口 `src/index.ts` 原本就不导出该 router，本次保持不变。
- 后续若必须改这条 legacy HTTP 面，应落到对应子模块，而不是把逻辑堆回 `router.ts`。
- 不要把本次拆分理解成恢复 TypeScript 网关 owner 地位。
