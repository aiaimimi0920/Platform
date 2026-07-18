# Platform 产品完成进度总控

状态：`设计阶段总控`。本文件在书面规格获用户确认前不替代详细实施计划；task inventory、依赖图、逐项验收命令和 evidence path 必须在规格确认后由 implementation plan 生成。

## 任务

将 `Platform` 从当前可构建 beta 收口为满足 A 方案的可验收产品。

开发边界：

- 源码只修改 `Platform/`。
- Gateway、Loom、Tea、Hook 仅作为外部依赖。
- release 只写入 `../release/Platform/`。

## 权威文档

- [Platform 产品完成与验收基线](../40-engineering/Platform产品完成与验收基线.md)

本进度总控是当前流程控制面。上述验收基线在 `P0-D04` 前是 `candidate canonical`，用户确认后才升级为正式 canonical 规格。

## 审计证据

以下文件是设计输入和历史证据，不是长期规则；与 canonical 冲突时以验收基线为准：

- [项目概览](../50-history/analysis/platform-product-completion/project-overview.md)
- [模块盘点](../50-history/analysis/platform-product-completion/module-inventory.md)
- [风险评估](../50-history/analysis/platform-product-completion/risk-assessment.md)

## 阶段

- [ ] Phase 0: 设计与计划冻结 (3/5 tasks)
- [ ] Phase 1: 验收基础设施与真实门禁 (0/4 tasks)
- [ ] Phase 2: 重度智能体真实闭环 (0/5 tasks)
- [ ] Phase 3: 产品真实性与正式入口 (0/4 tasks)
- [ ] Phase 4: 核心领域测试与安全可观测性 (0/4 tasks)
- [ ] Phase 5: 部署与完整 release (0/4 tasks)
- [ ] Phase 6: 全栈、浏览器与最终验收 (0/4 tasks)

Phase 0 当前任务：

- [x] `P0-D01`：用户确认 A 方案与写入/release 边界。
- [x] `P0-D02`：完成产品、架构/交付、质量三路只读审计。
- [x] `P0-D03`：完成 candidate canonical 设计、独立审阅修订、文档验证和候选基线提交。
- [ ] `P0-D04`：用户审阅并确认书面规格。
- [ ] `P0-D05`：在 `P0-D04` 后生成详细 task inventory、依赖图、逐项验收命令、里程碑和 evidence path。

`P0-D04` 是运行时代码的硬门槛；`P0-D05` 只能在书面规格确认后执行。详细实施计划不得改变上述阶段边界和验收顺序，除非同步修订 canonical 基线并重新确认。

## Current Status

- 当前阶段：Phase 0。
- 已完成：A 方案确认、三路只读审计、candidate canonical 设计、两轮独立审阅与文档验证。
- 当前动作：提交候选基线并请求用户书面审阅。
- 运行时代码：尚未修改。

## Next Steps

1. 用户审阅 `docs/40-engineering/Platform产品完成与验收基线.md`。
2. 根据反馈修订，或在确认后完成 `P0-D04`。
3. 调用 writing-plans 工作流完成 `P0-D05`。
4. 从验收基础设施开始按 TDD 连续实施。
