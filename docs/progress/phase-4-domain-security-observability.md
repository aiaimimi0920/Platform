# Phase 4 核心领域测试、安全与可观测性

- [x] `P4-01` identity, wallet, commerce, task invariants。
- [x] `P4-02` agent, mailbox, governance, arbitration, executor contracts。
- [x] `P4-03` required PostgreSQL/Valkey/S3 fixture and OAuth contract。
- [x] `P4-04` correlation IDs, dependency taxonomy, secret redaction。

Acceptance: required integration has no skipped suite（`P4-03`），and every error/dependency evidence now contains service/category/time/correlation id without secrets（`P4-04`）。Phase 4 已完成；产品状态仍为 `Platform 产品未完成`。

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

## P4-03 完成记录

- 新增 required integration fixture 与 acceptance contract：
  - `scripts/acceptance/integration-fixture.mjs`
  - `scripts/acceptance/tests/integration-fixture.test.mjs`
- root acceptance gate 现在显式依赖 `test:integration:required`，并把 `PLATFORM_ACCEPTANCE_RUN_ID` 传入 required environment；`scripts/acceptance/run-required.mjs` 不再以 root `test:integration` 的 `--if-present` 模式作为正式验收入口。
- 为全部 workspace 显式声明 `test:integration:required`：
  - 有真实 suite 的 workspace（`@neuro/ai-gateway-domain`、`@neuro/account-domain`、`@neuro/core`）直接执行 required 套件。
  - 当前没有 required integration suite 的 workspace（contracts / backend-foundation / account-api / account-worker / executor / worker / web）显式 no-op，而不是通过缺脚本隐式跳过。
- 新增 OAuth contract 覆盖：
  - `web/src/auth.test.ts`
  - 覆盖 callback 缺失 state 拒绝、Linux.do callback identity -> local JWT/session mapping、重复 account-linking 幂等，以及未登录 session contract。
- 为 clean worktree 下的重复验证补齐最小修复：
  - `packages/account-domain/package.json`：增加 `pretest:integration`，先 build `@neuro/contracts` 与 `@neuro/backend-foundation`，避免 `backend-foundation/dist/db/factories` 缺失。
  - `packages/ai-gateway-domain/src/modules/gateway/response-cache.ts`：Redis client 改为懒建，避免只测 TTL helper 时因顶层连接句柄导致 required suite 挂住。
  - `packages/ai-gateway-domain/package.json`：`test:integration:required` 改为无 gate 的直接命令，避免把 required suite 伪装成 gated optional shortcut。
- `P4-03` 通过验证：
  - `node --test scripts/acceptance/tests/integration-fixture.test.mjs scripts/acceptance/tests/run-required.test.mjs`
  - `node --test --import tsx src/auth.test.ts`（`web/`）
  - `npm run test:integration:required --workspace @neuro/account-domain`
  - `npm run test:integration:required --workspace @neuro/core`
  - 一次 production `runRequiredIntegrationFixture(...)` full summary：`10 discovered / 10 executed / 10 passed / 0 failed / 0 skipped`

## P4-04 完成记录

- `packages/backend-foundation/src/platform/http-server.ts` 新增共享 request observability：
  - 归一化 `x-request-id` / `x-correlation-id`，拒绝 secret-shaped 或非法 header 值并生成安全 fallback。
  - `serializePlatformError` 在有 request context 时附带 requestId、correlationId、category 与 diagnostics；`serializePlatformLogError` 为非 `HttpError` 输出已脱敏 structured log entry。
  - `redactPlatformText` 覆盖 Authorization/Bearer、Cookie、token、key、client secret、password、email/oauth/verification code 与 `sk-*`。
- Core 与 Account API HTTP 边界已注册共享 observability hook，并在错误处理器中使用安全 diagnostics / log entry；Core full test 中同步修正 heavy-chat required integration gate 的脚本断言，使其匹配当前 `test:integration:heavy-chat` 拆分。
- Web 内部请求层已补齐：
  - `fetchInternal` 为 Core / Account / Gateway 请求传播安全 request/correlation headers，并为 network/timeout transport failures 附带 service/category/time/correlation diagnostics。
  - `classifyInternalDependencyError` 将 HTTP 非 2xx 和 transport errors 统一分类为 auth / validation / not_found / conflict / quota / dependency / internal，且对响应中的 secret-shaped request-id、correlation-id、code 做脱敏。
  - Account/Core/Gateway/Heavy Chat clients 统一使用 classified dependency error；dependency result 保留安全 operator diagnostics，同时继续隐藏原始 credential-shaped message/diagnostics。
- Acceptance evidence redaction 扩展到 email/oauth/verification code 与 `sk-*`，避免验收 stdout/stderr/evidence manifest 记录 canary secret。
- `P4-04` 通过验证：
  - `npm run test --workspace @neuro/backend-foundation`
  - `npm run typecheck --workspace @neuro/backend-foundation`
  - `npm run test --workspace @neuro/core`（151/151）
  - `npm run typecheck --workspace @neuro/core`
  - `npm run test --workspace @neuro/account-api`
  - `npm run typecheck --workspace @neuro/account-api`
  - `npm run test --workspace @neuro/web`（284/284）
  - `npm run typecheck --workspace @neuro/web`
  - `node --test scripts/acceptance/tests/manifest.test.mjs`
  - `git diff --check -- Platform`（退出 0；仅 Git LF/CRLF 提示）
