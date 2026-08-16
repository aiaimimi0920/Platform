# arbitration service 拆分结构

`core/src/modules/arbitration/service.ts`（原 3,398 行）已按内聚职责拆分为 `core/src/modules/arbitration/service/` 下的 10 个子模块。`service.ts` 保留为薄 facade（39 行），原样 re-export 全部 25 个公共导出，外部导入方（`router.ts`）无需任何改动。

本次为纯结构性搬移：所有函数体整块移动，未改变任何运行时行为、函数签名或导出名。先前拆出的同级分析文件（`case-analysis.ts`、`workload-analysis.ts` 及其测试）未改动，仍由子模块通过 `@/modules/arbitration/...` 引用。

## 子模块职责

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `shared.ts` | 160 | 时间源、operator/参与人权限判断、状态迁移断言、URL 校验与证据输入归一化 |
| `round-policies.ts` | 253 | 审理轮次策略解析、operator 池、容量断言、负载均衡指派推荐、证据静默窗口活动探测（InTx） |
| `attachment-storage.ts` | 518 | 证据存储策略解析、object key/metadata/tag 指令、文件名归一化、远端对象存储 IO（store/prepare/read/delete/verify） |
| `case-views.ts` | 265 | evidence/attachment/round/case 的 row→view 转换、可见性校验的 case 加载器、`listVisibleArbitrationCases` 富水合列表 |
| `metrics-summary.ts` | 105 | `getVisibleArbitrationCaseSummary` / `getArbitrationCaseWorkload` 统计路径 |
| `case-lifecycle.ts` | 299 | 建案（含首轮与唯一活跃案件守卫）、operator 状态迁移（含任务结算与附件保留期同步） |
| `evidence.ts` | 76 | 活跃案件上的证据记录创建 |
| `attachments.ts` | 956 | 附件生命周期端点：prepared 上传计划、上传完成校验、直传、内容/签名访问、归档、清理请求、过期与已结案清理扫、清理队列巡检、存储策略列表 |
| `claims.ts` | 361 | claim-next 优先级排序、直接 claim、指派、释放、陈旧 claim 释放扫 |
| `rounds.ts` | 645 | 轮次推进、开放轮 rebalance/修复、陈旧轮自动推进、终局轮 escalation |

## 约束

- `metrics-summary.ts` 中的 summary/workload 端点必须继续遵守 `docs/40-engineering/arbitration-metric-query-baseline.md`：只使用可见性过滤的标量 case 投影与分组 evidence/attachment/round 指标，不得把完整证据内容、任务行、附件 payload 或案件时间线重新引回统计路径；富水合仅允许留在 `case-views.ts` 的 detail/list 端点。
- 依赖分层固定为：`shared.ts` / `round-policies.ts` / `attachment-storage.ts`（基础层）→ `case-views.ts` → 各功能子模块（`case-lifecycle` / `evidence` / `attachments` / `claims` / `rounds` / `metrics-summary`），无循环引用。
- 公共 API 仍只经由 `service.ts` facade 暴露；后续新增 service 逻辑应直接落到对应子模块，不要再把代码堆回 facade。
