# Phase 4 核心领域测试、安全与可观测性

- [x] `P4-01` identity, wallet, commerce, task invariants。
- [ ] `P4-02` agent, mailbox, governance, arbitration, executor contracts。
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
  - `npx tsc --noEmit --pretty false -p core/tsconfig.json`
  - `npm run test:integration --workspace @neuro/core`
- 当前剩余警告：
  - identity / task-hub 相关集成测试仍会打印 dedicated read-model fallback 警告（`platform-summary -> fetch failed`），因为测试环境只验证本地数据库契约，不启动 core read-model HTTP 服务；这不影响 `P4-01` 判定，但后续 `P4-04` / acceptance 仍需统一为更清晰的 dependency observability 表达。
