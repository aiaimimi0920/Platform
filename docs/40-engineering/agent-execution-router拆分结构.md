# agent-execution router 拆分结构

`core/src/modules/agent-execution/router.ts`（原约 1,419 行）已按 HTTP 路由面拆分为 `core/src/modules/agent-execution/router/` 下的子模块。`router.ts` 保留为薄入口：继续导出原有 `agentExecutionRouter`，并按子模块挂载全部 HTTP 路由。

本次为纯结构性搬移：Zod schema、外部回调签名 helper、handler 体整块移动，未改变注册路径、HTTP 方法、鉴权 `preHandler`、或响应形状。`service.ts` / `service/` 与同级 analysis 文件未改动。

对外导入仍走 `@/modules/agent-execution/router` 的 `agentExecutionRouter`；`core/src/server.ts` 无需改动。

## 子模块职责

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `shared.ts` | 685 | Zod body/query schema、`parseDelimitedIdList`、外部回调 header / HMAC 校验 / 拒绝审计 helper |
| `owned-executions.ts` | 141 | owner 面 `/v1/agent-executions` 列表、创建、subtask、status、callback-remediation-policy、artifact、requeue |
| `launch-presets.ts` | 86 | owner 面 launch preset 列表 / 创建 / 更新 / 设默认 / 删除 |
| `runtime-catalog.ts` | 63 | owner/operator runtime catalog，以及 runtime pressure alert 概要与发射 |
| `callback-audits.ts` | 153 | operator callback 审计列表/概要/补救概要，以及 retry / replay / auto-remediate / emit-alerts |
| `runs.ts` | 53 | operator execution run 列表与概要 |
| `runtime-sessions.ts` | 69 | operator runtime session 列表/概要与 sweep |
| `dispatch.ts` | 60 | operator 待派发执行、平台执行器主循环、陈旧执行恢复 |
| `settlements.ts` | 70 | operator 结算 run / 列表 / 概要 / retry |
| `external-runtime.ts` | 200 | `/external/agent-executions/:executionId/{status,heartbeat,artifacts,callback}` 外部 runtime 上报面 |
| `router.ts`（facade） | 26 | 组装子 router，导出 `agentExecutionRouter` |

## 约束

- 后续若必须改这条 HTTP 面，应落到对应子模块，而不是把逻辑堆回 `router.ts`。
- 子模块继续通过 `service.ts` facade 调用业务逻辑，不直接导入 `service/`。
