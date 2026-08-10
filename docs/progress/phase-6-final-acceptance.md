# Phase 6 全栈、浏览器与最终验收

- [x] `P6-01` Owner and Visitor desktop/mobile Playwright journeys。
- [x] `P6-02` Operator and dependency-error journeys。
- [x] `P6-03` required/external-boundary/conditional-live matrix and classification。
- [ ] `P6-04` final release, review, P2 register and signoff。

Acceptance: use exactly one canonical conclusion phrase; no internal P0/P1, no unclassified live failure, no required skip, and release smoke passes.

## P6-01 / P6-02 完成记录

- fresh official run 位于 `.runtime/acceptance/platform-round16-640f77d/acceptance-manifest.json`，对应 clean revision `640f77dddedf5b5773db5cdb81b65b376fc134c7`。
- `browser-owner`、`browser-visitor`、`browser-operator`、`browser-errors` 全部通过；Owner、Visitor、Operator 与 dependency-error canonical journeys 均由 desktop/mobile Playwright projects 覆盖。
- 同一 run 的 required 为 `14 discovered / 14 executed / 14 passed / 0 failed / 0 skipped`；external-boundary 为 `4 discovered / 4 executed / 3 passed / 0 failed / 0 skipped / 1 not-applicable`，其中 Hook 由 source/dependency inventory 证明当前无 Platform-owned runtime call point。

## P6-03 完成记录

- same-day conditional-live run 位于 `.runtime/acceptance/platform-live-round16-640f77d/acceptance-manifest.json`，同样对应 clean revision `640f77dddedf5b5773db5cdb81b65b376fc134c7`。
- Linux.do OAuth、Gateway、Loom 与 Tea 均执行环境 preflight，并因缺少对应 live URL/token 或 OAuth client 配置分类为 `external-blocked`；证据只记录环境变量名，不记录凭证值。Hook 分类为 evidence-backed `not-applicable`。
- conditional-live 合计 `5 discovered / 5 executed / 0 failed / 0 skipped / 4 external-blocked / 1 not-applicable`，不存在未分类的 `failed` 或无证据 `not-run`。

## P6-04 剩余边界

- 已验证的 immutable `V0.1.0` release 来源是 `3d2f653663eb4796362ffa278eafd74df308ec7d`；本轮 release Compose readiness 修复位于更晚的 revision，不能覆盖或改写现有 `V0.1.0`。
- 最终 review 已发现并修复两项内部 P1：release evidence filesystem-link 逃逸由 `47f2234` 修复；public-surface 控制面故障时的 all-enabled fallback 由 `bb5580b` 删除。任意分支手动触发 GHCR 发布的权限边界由 `4014b1d` 收紧，同时保留已声明的 main/tag 镜像策略。
- 本地预览 review 已把 Compose Web 失败清理从 service-wide 删除收紧为旧/新容器身份比较和 replacement-only 删除，失败后恢复 `WEB_HOST_PORT`；heavy-task claim/release 统一使用当前无 profile PowerShell host，release 非零退出不再静默。Windows Docker-double 合同覆盖旧身份保持与替换身份清理，真实 Docker 成功路径同时验证原子 state、健康容器和环境恢复。
- [P2 register](./p2-register.md) 已建立；第三方 Actions 已固定到审计后的完整 commit SHA，`P2-CI-001` 已核销。当前 active 项只保留 owner、边界、不阻塞理由和升级条件明确、且无法在本轮仓库内直接消除的 release governance 与 CI feedback 问题；历史依赖告警、已修复 P1 和外部 live 条件均未伪装为 P2。
- 最终签收仍需在最终源码 revision 上复核 P0/P1 为零，完成新版本 release 与 artifact-only smoke、fresh full gates 和 clean-worktree/Git identity signoff。
- 当前唯一 canonical 结论保持为：`Platform 产品未完成`。
