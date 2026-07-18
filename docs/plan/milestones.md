# Platform 产品完成里程碑

| Milestone | 触发任务 | 必须满足 | 产物 |
| --- | --- | --- | --- |
| M0 规格冻结 | P0-D05 | 用户规格已确认，计划/skill/progress 已落盘 | plan + dependency graph + phase files |
| M1 可安全验收 | P1-04 | acceptance:ci 有 skip-fail、Compose 隔离、ready/auth 真实 | required manifest |
| M2 重度聊天真实 | P2-05 | slot/project/thread/message 持久化、Gateway、任务/邮箱动作 | heavy-chat integration/browser evidence |
| M3 产品状态真实 | P3-04 | 无 demo fallback、正式入口可工作、slot controls 可写入 | truthfulness report |
| M4 领域可证明 | P4-04 | 身份/账本/任务/Agent/治理/Executor/ OAuth required tests | integration + redaction evidence |
| M5 可交付 | P5-04 | K8s/Tofu 可 render，完整 release 可离线 smoke | `release/Platform/<version>/` |
| M6 可签收 | P6-04 | Owner/Visitor/Operator journeys、required/live 分类、P0/P1 清零 | final acceptance manifest |

任何里程碑失败都保留失败证据，不通过改名、删除测试或 fallback 伪造绿灯。
