# Platform 产品完成进度总控

状态：`实施阶段总控`。详细 implementation plan、依赖图、里程碑和每阶段 progress 已落盘；每个 runtime task 仍必须遵循 TDD 和双阶段 review。

## 任务

将 `Platform` 从当前可构建 beta 收口为满足 A 方案的可验收产品。

开发边界：

- 源码只修改 `Platform/`。
- Gateway、Loom、Tea、Hook 仅作为外部依赖。
- release 只写入 `../release/Platform/`。

## 权威文档

- [Platform 产品完成与验收基线](../40-engineering/Platform产品完成与验收基线.md)
- [Implementation plan](../superpowers/plans/2026-07-18-platform-product-completion.md)
- [Task breakdown](../plan/task-breakdown.md)
- [Dependency graph](../plan/dependency-graph.md)
- [Milestones](../plan/milestones.md)

本进度总控是当前流程控制面。上述验收基线已在 `P0-D04` 完成用户书面确认，现为正式 canonical 规格。任务执行规则位于 `.codex/skills/platform-product-completion/SKILL.md`。

## 审计证据

以下文件是设计输入和历史证据，不是长期规则；与 canonical 冲突时以验收基线为准：

- [项目概览](../50-history/analysis/platform-product-completion/project-overview.md)
- [模块盘点](../50-history/analysis/platform-product-completion/module-inventory.md)
- [风险评估](../50-history/analysis/platform-product-completion/risk-assessment.md)

## 阶段

- [x] Phase 0: 设计与计划冻结 (5/5 tasks) [details](./phase-0-design-and-plan.md)
- [x] Phase 1: 验收基础设施与真实门禁 (4/4 tasks) [details](./phase-1-acceptance-infrastructure.md)
- [ ] Phase 2: 重度智能体真实闭环 (3/5 tasks) [details](./phase-2-heavy-chat.md)
- [ ] Phase 3: 产品真实性与正式入口 (0/4 tasks) [details](./phase-3-product-truthfulness.md)
- [ ] Phase 4: 核心领域测试与安全可观测性 (0/4 tasks) [details](./phase-4-domain-security-observability.md)
- [ ] Phase 5: 部署与完整 release (0/4 tasks) [details](./phase-5-deployment-release.md)
- [ ] Phase 6: 全栈、浏览器与最终验收 (0/4 tasks) [details](./phase-6-final-acceptance.md)

Phase 0 当前任务：

- [x] `P0-D01`：用户确认 A 方案与写入/release 边界。
- [x] `P0-D02`：完成产品、架构/交付、质量三路只读审计。
- [x] `P0-D03`：完成 candidate canonical 设计、独立审阅修订、文档验证和候选基线提交。
- [x] `P0-D04`：用户审阅并确认书面规格（2026-07-18）。
- [x] `P0-D05`：生成详细 task inventory、依赖图、逐项验收命令、里程碑、phase progress 和 task-specific skill。

`P0-D04` 已完成。详细实施计划不得改变上述阶段边界和验收顺序，除非同步修订 canonical 基线并重新确认。

## Current Status

- 当前阶段：Phase 2（Phase 1 验收基础设施已完成，产品本身尚未完成）。
- 已完成：Phase 0 全部设计任务；`P1-01` acceptance manifest、命令执行器、证据脱敏和 required skip-fail runner；`P1-02` isolated Compose、临时 secret/credential root、Platform doubles 与 owner-aware cleanup；`P1-03` production Dev Auth guard、Worker/Account Worker/Executor readiness 与 Compose health gates；`P1-04` strict acceptance inventory、debt 修复、`smoke` bridge 和 external-boundary harness。
- `P1-04` 最终真实运行记录于 `.runtime/acceptance/platform-acceptance-p104-runtime5/acceptance-manifest.json`：required `14 discovered / 14 executed / 9 passed / 5 failed / 0 skipped`；external-boundary `4 discovered / 4 executed / 3 passed / 0 failed / 1 not-applicable`。required 失败为 integration gate 未获授权以及尚未实现的 Owner、Visitor、Operator、dependency-error 浏览器套件，未被静默标记为 skip；runtime5 对应已提交的 Platform P1-04 commit `77831496c3baa886d9f08ac804b92268f58000f6`。
- 同一 run 的 Compose render/startup 均成功，服务均 healthy，owner cleanup receipt 已保留；cleanup 后本次验收的容器、网络、volume 均为 `0`。这些是基础设施证据，不是产品验收通过证据。
- 当前动作：`P2-03` Gateway boundary 已完成库级实现和隔离验证，下一步进入 `P2-04` Core router、runtime composition、Next API 与 Web 持久化；产品仍未完成。
- 产品状态：`Platform 产品未完成`。Phase 2-6 和完整 release 尚未完成；required 门禁仍有 5 项失败，不能给出产品可验收或 release 完成结论。

## Next Steps

1. 完成 `P2-04` Core owner routes、runtime composition、Next API、snapshot hydration 与 refresh persistence。
2. 完成 `P2-05` Task Hub / mailbox action bridge，再处理 Phase 3-6 的产品真实性、领域覆盖、部署、浏览器和 release 门禁。
3. 每个 task 完成后更新本文件、对应 phase progress 和 evidence manifest；只有所有 required/external-boundary 门禁与最终 release smoke 满足 canonical 条件，才能改变产品状态。
