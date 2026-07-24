# Phase 4 核心领域测试、安全与可观测性

- [x] `P4-01` identity, wallet, commerce, task invariants。
- [x] `P4-02` agent, mailbox, governance, arbitration, executor contracts。
- [ ] `P4-03` required PostgreSQL/Valkey/S3 fixture and OAuth contract。
- [ ] `P4-04` correlation IDs, dependency taxonomy, secret redaction。

Acceptance: required integration has no skipped suite and every error evidence contains service/category/time/correlation id without secrets.

## P4-01 完成记录

- 新增真实 PostgreSQL invariants 覆盖：
  - `core/src/modules/identity/tests/invariants.integration.test.ts`
  - `core/src/modules/wallet-ledger/tests/invariants.integration.test.ts`
  - `core/src/modules/product-order-item/tests/invariants.integration.test.ts`
  - `core/src/modules/task-hub/tests/invariants.integration.test.ts`
- 删除了 identity / wallet-ledger / product-order-item / task-hub 的占位 `README.md`。
- 为 Core 域集成测试补齐统一 runner：
  - `scripts/testing/run-domain-integration.ts`
  - `core/src/testing/integration-postgres.ts`
  - `core/package.json` integration scripts
- `P4-01` 通过验证：
  - `npm run build --workspace @neuro/account-domain`
  - `npm run typecheck --workspace @neuro/core`
  - `npm run test:integration --workspace @neuro/core`
- 当前剩余警告：
  - task-hub 相关集成测试仍会打印 dedicated read-model fallback 警告（`platform-summary -> fetch failed`），因为测试环境只验证本地数据库契约，不启动 core read-model HTTP 服务；这不影响 `P4-01` 判定，但后续 `P4-04` / acceptance 仍需统一为更清晰的 dependency observability 表达。

## P4-02 完成记录

- 新增真实 PostgreSQL / contract 覆盖：
  - `core/src/modules/agent-registry/tests/invariants.integration.test.ts`
  - `core/src/modules/agent-execution/tests/invariants.integration.test.ts`
  - `core/src/modules/redemption-mailbox-marketplace/tests/invariants.integration.test.ts`
  - `core/src/modules/arbitration/tests/invariants.integration.test.ts`
  - `core/src/modules/opinion-hub/tests/invariants.integration.test.ts`
  - `packages/account-domain/src/modules/reputation/tests/invariants.integration.test.ts`
  - `executor/src/http.test.ts`
  - `executor/src/tasks.test.ts`
  - `executor/src/cli.test.ts`
  - `executor/src/health.test.ts`
- 删除了 agent-execution / agent-registry / redemption-mailbox-marketplace / opinion-hub / reputation 的占位 `README.md`。
- 为 `P4-02` 暴露的真实缺陷做了最小修复：
  - `core/src/modules/redemption-mailbox-marketplace/service.ts`：`claimAttachment` 改为事务内锁定并对重复 claim 幂等，避免并发重复发放。
  - `core/src/modules/arbitration/service.ts`：`under_review` 不再提前关闭当前 open review round；非当前 claimer 的 operator 不能 release 已被其他 operator claim 的案件。
  - `core/src/modules/opinion-hub/service.ts`：改为直接依赖 `packages/account-domain/dist/...` 子模块，避免根包导入带来的集成运行时漂移。
  - `packages/account-domain/src/env.ts` 与 `services/account-worker/src/env.ts`：当 `ACCOUNT_*` 与共享 `DATABASE_URL` / `REDIS_URL` 实际相同时，不再误判为 dedicated 模式。
  - `core/package.json`：补齐 `agent-registry`、`agent-execution`、`redemption-mailbox-marketplace`、`arbitration`、`opinion-hub` integration scripts，并将它们纳入 core integration umbrella。
- `P4-02` 通过验证：
  - `npm run typecheck --workspace @neuro/core`
  - `npm run typecheck --workspace @neuro/account-domain`
  - `npm run typecheck --workspace @neuro/executor`
  - `npm run test:integration --workspace @neuro/core`
  - `npm run test:integration --workspace @neuro/account-domain`
  - `npm run test --workspace @neuro/executor`
