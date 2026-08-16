# task-hub service 拆分结构

`core/src/modules/task-hub/service.ts`（原约 2,508 行）已按内聚职责拆分为 `core/src/modules/task-hub/service/` 下的 10 个子模块。`service.ts` 保留为薄 facade，原样 re-export 全部 19 个公共导出，外部导入方（`router.ts`、`agent-registry/router.ts`、`arbitration/service/case-lifecycle.ts`、`heavy-chat/router.ts`、模块内 integration test）无需任何改动。

本次为纯结构性搬移：所有函数体整块移动，未改变任何运行时行为、函数签名或导出名。同级既有文件（`draft.ts`、`repository.ts`、`schema.ts`、`router.ts`、`events.ts` 及其测试）未改动。

## 子模块职责

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `shared.ts` | 213 | 托管账户/计量默认常量、时间源、能力码归一化、计价字段归一化、row→view 转换、提案能力匹配、任务计数水合、唯一约束探测 |
| `semantic-router.ts` | 411 | 关键词路由匹配、managed-API JSON 提取、可选中央调度 HTTP 筛选 |
| `escrow.ts` | 172 | 任务奖励托管 hold 对账补建、未中标保证金退回、全量活跃保证金释放 |
| `dispatch.ts` | 507 | 报名/提案评分（legacy 与 reputation）、派发事务、提案指派并创建 execution、派发决策读取 |
| `views.ts` | 117 | 任务/报名/提案列表与摘要读取 |
| `tasks.ts` | 166 | 任务草稿（幂等）与正式发单（奖励托管） |
| `proposals.ts` | 253 | Agent 提案创建/接受/拒绝 |
| `applications.ts` | 125 | 人工报名（保证金冻结与候选阈值派发） |
| `marketplace-matching.ts` | 407 | 自动撮合、owner/global auto-proposal sweep |
| `lifecycle.ts` | 372 | 任务生命周期（start/submit/accept/default/cancel）与 operator 结算覆盖 |
| `service.ts`（facade） | 34 | re-export 全部 19 个公共 API |

## 约束

- 依赖分层固定为：`shared.ts` / `semantic-router.ts` / `escrow.ts`（基础层）→ `dispatch.ts` / `views.ts` → `proposals.ts` / `applications.ts` → `marketplace-matching.ts` → `tasks.ts`，以及独立的 `lifecycle.ts`。无循环引用。
- 公共 API 仍只经由 `service.ts` facade 暴露；后续新增 service 逻辑应直接落到对应子模块，不要再把代码堆回 facade。
- 子模块顶层常量不引用兄弟模块的值，避免 CommonJS 循环加载初始化问题。
