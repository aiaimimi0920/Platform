# plan 历史归档索引

## 目的

本文档用于承接旧 `docs/plan/` 的主题索引。

这些计划文档当前的价值是：

- 记录当时如何拆任务
- 记录阶段里程碑和依赖图

它们不再作为当前正式规则 owner。

---

## 1. account-commerce 计划族

旧文件：

- `legacy source: account-commerce-dependency-graph.md`
- `legacy source: account-commerce-milestones.md`
- `legacy source: account-commerce-task-breakdown.md`

当前 canonical 落点：

- `docs/30-product/商品、资产与权益总线.md`
- `docs/30-product/商城、小集市与权益发放实施边界.md`

---

## 2. email-native-access-wallet 计划族

旧文件：

- `legacy source: email-native-access-wallet-dependency-graph.md`
- `legacy source: email-native-access-wallet-milestones.md`
- `legacy source: email-native-access-wallet-task-breakdown.md`

当前 canonical 落点：

- `docs/30-product/邮箱、公告与运营投递总线.md`

---

## 3. gateway-protocol-refactor 计划族

旧文件：

- `legacy source: gateway-protocol-refactor-dependency-graph.md`
- `legacy source: gateway-protocol-refactor-milestones.md`
- `legacy source: gateway-protocol-refactor-task-breakdown.md`

当前 canonical 落点：

- `docs/20-ai-gateway/AI网关协议与路由总线.md`

---

## 4. gemini-three-surface 计划族

旧文件：

- `legacy source: gemini-three-surface-dependency-graph.md`
- `legacy source: gemini-three-surface-milestones.md`
- `legacy source: gemini-three-surface-task-breakdown.md`

当前 canonical 落点：

- `docs/20-ai-gateway/服务商实现线与Provider目录.md`

---

## 4.1 Suno / Udio Platform / LumaLabs 平台实现线重构计划

当前文件：

- `docs/50-history/plan/suno-udio-lumalabs-platform-line-refactor-2026-05-28.md`

当前 canonical 落点：

- `docs/20-ai-gateway/Suno平台实现线、可选编译与物理隔离基线.md`
- `docs/20-ai-gateway/Udio Platform实现线、可选编译与物理隔离基线.md`
- `docs/20-ai-gateway/LumaLabs平台实现线、可选编译与物理隔离基线.md`
- `docs/20-ai-gateway/服务商实现线与Provider目录.md`
- `docs/20-ai-gateway/实现线可选编译与物理隔离规范.md`

说明：

- 该计划用于把三个已存在但待专题化的媒体类 web reverse provider 线收口到 line manifest、Cargo feature、compiled-out fail-closed、物理编译隔离、operator surface 与 live suite 证据链。

---

## 4.2 AI Gateway 未完成平台收口计划

当前文件：

- `docs/50-history/plan/ai-gateway-unfinished-platform-completion-2026-05-29.md`

当前 canonical 落点：

- `docs/20-ai-gateway/AI网关平台、实现线、Surface与能力总表.md`
- `docs/20-ai-gateway/服务商实现线与Provider目录.md`
- `docs/20-ai-gateway/AI网关测试与验收总线.md`
- `docs/20-ai-gateway/实现线可选编译与物理隔离规范.md`

说明：

- 该计划用于把当前总表中仍为 `部分覆盖` / `待专题化` / residual scope 的 AI Gateway provider 平台，按 line manifest、Cargo feature、operator catalog、credential examples、focused verify、fixture/live 或 accepted external gate 的统一口径收口。

---

## 5. opinion-center 计划族

旧文件：

- `legacy source: opinion-center-dependency-graph.md`
- `legacy source: opinion-center-milestones.md`
- `legacy source: opinion-center-task-breakdown.md`

当前 canonical 落点：

- `docs/30-product/运营治理与仲裁总线.md`

---

## 6. project-center 计划族

旧文件：

- `legacy source: project-center-dependency-graph.md`
- `legacy source: project-center-milestones.md`
- `legacy source: project-center-task-breakdown.md`

当前 canonical 落点：

- `docs/30-product/项目中心与公开档案实施边界.md`

---

## 7. task-market 计划族

旧文件：

- `legacy source: task-market-dependency-graph.md`
- `legacy source: task-market-milestones.md`
- `legacy source: task-market-task-breakdown.md`

当前 canonical 落点：

- `docs/30-product/任务、能力与Agent市场总线.md`
- `docs/30-product/任务市场与能力供给实施边界.md`

---

## 8. 当前正式结论

旧 `plan/` 当前全部迁入本目录的历史规划语义中。

它们当前保留的核心价值是：

- 提供拆解参考
- 提供阶段顺序参考

但后续开发不应再把它们直接当成当前最终定案。
