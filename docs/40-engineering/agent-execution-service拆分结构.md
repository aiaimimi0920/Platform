# agent-execution service 拆分结构

`core/src/modules/agent-execution/service.ts`（原约 10,965 行）已按内聚职责拆分为 `core/src/modules/agent-execution/service/` 下的 17 个子模块。`service.ts` 保留为薄 facade，原样 re-export 全部 44 个公共导出，外部导入方（`router.ts`、`agent-registry/router.ts`、`task-hub/service.ts` 等）无需任何改动。

本次为纯结构性搬移：所有函数体整块移动，未改变任何运行时行为、函数签名或导出名。先前拆出的 `analysis/*.ts` 同级文件（`callback-governance.ts`、`runtime-decision.ts` 等）未改动。

## 子模块职责

| 文件 | 职责 |
| --- | --- |
| `shared.ts` | 状态迁移表、TTL/锁 key 等常量、跨模块查询类型、ephemeral Redis 锁、`toWhereClause` 等通用工具 |
| `managed-light.ts` | managed_light 模型调用：prompt 模板渲染、schema marker 替换、benefit service access 解析、usage 合并 |
| `pricing.ts` | 阶段成本/预算/定价策略/收入合同、runtime profile 解析与利用率快照、settlement view 转换 |
| `runtime-catalog.ts` | runtime catalog 与 runtime pressure alert 概要（operator 面） |
| `launch-presets.ts` | launch preset 归一化、view 组装与 CRUD |
| `runtime-subtasks.ts` | runtime managed subtask 的 ensure/sync（InTx）与 artifact descriptor |
| `views.ts` | execution/artifact/step/subtask/run/callback/session 等 view 转换与 batch map 组装、`getAgentExecutionViewById` |
| `settlement.ts` | 结算计划/行项目刷新/预算强制/finalize 推进（InTx）、结算执行与 operator 结算接口 |
| `runs.ts` | execution run/step 记录（InTx）、run 查询条件与 operator run 列表/概要 |
| `callback-audit.ts` | 外部回调审计记录、审计过滤/派生过滤扫描、审计概要累加器与 operator 审计接口 |
| `remediation.ts` | 回调补救：attempt 记录、retry/replay（operator 与自动）、补救概要与策略元数据 |
| `alerts.ts` | callback remediation 与 runtime pressure 告警去重与发射 |
| `runtime-sessions.ts` | runtime session InTx 生命周期、operator session 列表/概要与 sweep |
| `executions.ts` | 执行创建（`createOwnedAgentExecution(InTx)`）、owner 侧读写（artifact/status/subtask/requeue 等） |
| `dispatch.ts` | 待派发执行的 managed API / external runtime 派发、marketplace listing 调用 |
| `external-runtime.ts` | 外部 runtime 上报面：status/artifact/heartbeat 与回调幂等包装 |
| `platform-executor.ts` | 平台执行器主循环：`advancePlatformExecution`、`runPlatformExecutor`、陈旧执行恢复 |

## 约束

- 模块间通过命名导出互相引用；公共 API 仍只经由 `service.ts` facade 暴露。
- 子模块顶层常量不引用兄弟模块的值，避免 CommonJS 循环加载初始化问题；函数级循环引用在调用期解析，安全。
- 后续新增 service 逻辑应直接落到对应子模块，不要再把代码堆回 facade。
