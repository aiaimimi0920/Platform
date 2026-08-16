# ai-gateway-domain gateway service 拆分结构

`packages/ai-gateway-domain/src/modules/gateway/service.ts`（原 11,053 行、338 个顶层声明）已按内聚职责拆分为 `packages/ai-gateway-domain/src/modules/gateway/service/` 下的 21 个子模块。`service.ts` 保留为 147 行薄 facade，原样 re-export 全部 107 个公共导出（103 个值 + 4 个纯类型），外部导入方（同模块 `router.ts`、包入口 `src/index.ts`）无需任何改动。

本次为纯结构性搬移：所有声明体整块移动并逐声明比对逐字一致，未改变任何运行时行为、函数签名或导出名。同目录先前拆出的 `analysis-*.ts`、`provider-*.ts`、`rate-limit-hotspot*.ts` 等同级文件未改动。`ai-gateway-domain` 仍是迁移期网站后台过渡数据层，本次未扩张其职责。

## 子模块职责

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `shared.ts` | 438 | 常量、drizzle 行类型、operator 过滤器类型、通用文本/数值归一化、`assertPlatformOperator`、分位数/分布/summary bucket 工具 |
| `provider-identity.ts` | 263 | 服务商 identity/key 归一化与派生、协议 profile/family 归一化、各协议 family 判定谓词 |
| `provider-source-profile.ts` | 528 | provider source profile 推断/归一化/读写解析、执行模式（execution mode）解析、session-backed runtime 与 provider payload 校验 |
| `views.ts` | 241 | tenant/project/apiKey/providerAccount/modelAlias/routePolicy/session/requestAudit 行到 view 的转换、默认 route policy config、payload 读取 |
| `provider-health.ts` | 514 | 冷却恢复与 sweep、provider 探活、模型发现与模型缓存、provider headers、熔断/并发 Redis key、`noteProviderAccountFailure/Success` |
| `access.ts` | 313 | benefit tenant/project ensure、API key InTx 签发/吊销、API access resolve/rotate、access token 认证 |
| `routing.ts` | 297 | 项目模型目录、路由候选构建（`resolveGatewayRouteContext`）、provider namespace 解析、route policy 准入判定 |
| `sessions.ts` | 256 | gateway session 解析/upsert、request audit 创建/终态/断连标记、session outcome 记录 |
| `operator-catalog.ts` | 933 | operator 目录、usage 聚合与定价/成本估算、provider inventory、模型关联矩阵、成本总览 |
| `operator-audits.ts` | 242 | operator 请求审计/会话列表、审计详情/工件、会话详情、请求审计概要 |
| `prompt-cache.ts` | 448 | prompt cache 指标归一化、项目/operator 两侧 prompt cache summary 与 trend 报表 |
| `rate-limit-hotspots.ts` | 471 | 限流热点概要/趋势/异常报表、热点快照与异常快照的持久化/列表/读取/盘点/趋势 |
| `analysis-summary.ts` | 232 | 分析样本 view 与列表、分析概要、provider routing 分析概要与异常报表 |
| `analysis-exports.ts` | 1114 | 分析导出行导出、持久化导出 manifest/dataset 读写、列表/详情/盘点/元数据更新/清理、diff 与 baseline/timeline/trend/anomaly 报表 |
| `anomaly-policies.ts` | 564 | 异常策略归一化/阈值覆盖/view、策略 CRUD、sync 状态、评估上下文、策略 sweep |
| `anomaly-incidents.ts` | 583 | 异常事件 view/history、快照元数据与事件 tag、事件列表/概要/历史、acknowledge/resolve/follow-up |
| `anomaly-remediation.ts` | 870 | 补救 run view/查询、补救计划与上下文、run impact 采集、补救队列/sweep/执行（含自动补救配置解析） |
| `remediation-effectiveness.ts` | 523 | 补救效果概要与效果快照/异常快照的持久化/列表/读取/盘点/趋势/异常报表 |
| `anomaly-alerts.ts` | 226 | 告警投递严重度归一化、策略告警配置解析、事件告警队列与 dispatch 记录 |
| `anomaly-sync.ts` | 1178 | 三条异常事件同步主链：analysis export / provider routing / rate limit hotspot |
| `provider-admin.ts` | 826 | operator 运维面：provider 健康/运行时压力列表、探活、冷却 sweep、provider account CRUD、source profile patch/backfill、model alias 与 route policy 保存、readiness report |

## 约束

- 模块间通过命名导出互相引用；公共 API 仍只经由 `service.ts` facade 暴露，facade 只含 re-export，不得再堆业务代码。
- 子模块顶层常量全部为字面量，不引用兄弟模块的值，避免 CommonJS 循环加载初始化问题；函数级循环引用在调用期解析，安全。
- 后续新增 service 逻辑应直接落到对应子模块；`ai-gateway-domain` 职责边界不变（迁移期过渡数据层）。
