# Platform Product Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `Platform` from a buildable beta into an acceptance-ready product with truthful Owner/Visitor/Operator workflows, isolated full-stack verification, complete deployment artifacts, and a reproducible release under `../release/Platform/`.

**Architecture:** Keep the existing TypeScript workspace and service boundaries. Add a bounded Core heavy-chat module, Platform-local acceptance/release runners, explicit dependency-result envelopes, and isolated Compose fixtures. Gateway, Loom, Tea, and Hook remain external; acceptance uses fixed images/URLs or Platform-local doubles and never builds sibling source.

**Tech Stack:** Node.js 22, TypeScript, Fastify, Drizzle/PostgreSQL, Valkey, Next.js 16/React 19, Docker Compose, Playwright, Kustomize, OpenTofu, PowerShell/Node release tooling.

---

## Global Rules

- Modify only `Platform/`; write release output only to `../release/Platform/`.
- Use TDD for every behavior change: add one failing test, run it and confirm the expected failure, implement the minimum, rerun focused and affected suites, then commit.
- Never build or mount `../Gateway`, `../Loom`, `../Tea`, or `../Hook` from the acceptance stack.
- Use one task per commit. Do not stage unrelated sibling-project changes.
- After every task, update the matching phase file (`phase-1-acceptance-infrastructure.md` through `phase-6-final-acceptance.md`), `docs/progress/MASTER.md`, and the task evidence path.
- Required evidence lives under `.runtime/acceptance/<run-id>/`; release copies only redacted evidence.

## File Structure Lock

New acceptance files:

```text
scripts/acceptance/
  cli.mjs                 # argument parsing and command dispatch
  manifest.mjs            # atomic manifest writer and counters
  run-command.mjs         # child-process execution and redaction
  run-required.mjs        # required + external-boundary orchestration
  run-live.mjs            # conditional-live orchestration
  compose.mjs             # isolated project/env/cleanup ownership
  release-build.mjs       # complete Platform release builder
  release-smoke.mjs       # artifact-only runtime verification
  tests/*.test.mjs
deploy/acceptance/
  docker-compose.acceptance.yml
  gateway-double/
    Dockerfile
    server.mjs
  loom-double/
    Dockerfile
    server.mjs
  tea-double/
    Dockerfile
    server.mjs
web/e2e/
  fixtures.ts
  owner/*.spec.ts
  visitor/*.spec.ts
  operator/*.spec.ts
  errors/*.spec.ts
```

New heavy-chat files:

```text
core/src/modules/heavy-chat/
  types.ts
  schema.ts
  repository.ts
  gateway-client.ts
  action-bridge.ts
  service.ts
  router.ts
  *.test.ts
core/migrations/0138_heavy_chat.sql
packages/contracts/src/heavy-chat.ts
web/src/lib/heavy-chat-client.ts
web/src/app/api/heavy-chat/**/route.ts
web/src/features/account-heavy-agent-chat/server.ts
web/src/features/account-heavy-agent-chat/adapter.ts
```

## Phase 1: Acceptance Infrastructure And Truthful Gates

### Task P1-01: Acceptance Manifest And Skip-Fail Runner

**Files:**
- Create: `scripts/acceptance/manifest.mjs`
- Create: `scripts/acceptance/run-command.mjs`
- Create: `scripts/acceptance/cli.mjs`
- Create: `scripts/acceptance/tests/manifest.test.mjs`
- Create: `scripts/acceptance/tests/run-command.test.mjs`
- Modify: `scripts/run-gated-tests.mjs`
- Modify: `package.json`

- [ ] Write `manifest.test.mjs` asserting atomic `acceptance-manifest.json`, separate `required`, `externalBoundary`, and `conditionalLive` counters, and nonzero status for skipped required suites.
- [ ] Run `node --test scripts/acceptance/tests/manifest.test.mjs`; expect failure because `manifest.mjs` does not exist.
- [ ] Implement `createAcceptanceManifest`, `recordSuiteResult`, `finalizeAcceptanceManifest`, and secret redaction for token/cookie/key fields.
- [ ] Write `run-command.test.mjs` asserting exit code, duration, stdout/stderr evidence paths, and `skipped` detection.
- [ ] Run the focused tests and confirm the missing runner failure.
- [ ] Implement `runAcceptanceCommand` with `spawn`, no shell interpolation, bounded logs, and redacted persisted output.
- [ ] Change `run-gated-tests.mjs` so `PLATFORM_ACCEPTANCE_MODE=required` turns a disabled gate into exit code 1 instead of exit code 0.
- [ ] Add `acceptance:ci`, `acceptance:live`, and `smoke:quick` scripts; keep `smoke` unchanged until P1-04.
- [ ] Verify `node --test scripts/acceptance/tests/*.test.mjs` passes and `PLATFORM_ACCEPTANCE_MODE=required node scripts/run-gated-tests.mjs MISSING_FLAG '' -- node -e "process.exit(0)"` fails with a skip-forbidden message.
- [ ] Commit `feat(platform): add acceptance manifest runner`.

### Task P1-02: Isolated Compose Project And External Doubles

**Files:**
- Create: `deploy/acceptance/docker-compose.acceptance.yml`
- Create: `deploy/acceptance/gateway-double/Dockerfile`
- Create: `deploy/acceptance/gateway-double/server.mjs`
- Create: `deploy/acceptance/loom-double/Dockerfile`
- Create: `deploy/acceptance/loom-double/server.mjs`
- Create: `deploy/acceptance/tea-double/Dockerfile`
- Create: `deploy/acceptance/tea-double/server.mjs`
- Create: `scripts/acceptance/compose.mjs`
- Create: `scripts/acceptance/tests/compose.test.mjs`
- Modify: `deploy/docker-compose.local.yml`

- [ ] Write `compose.test.mjs` asserting a nonempty run id, loopback-only parameterized ports, generated secrets, dedicated volume names, and cleanup rejection for a foreign Compose project.
- [ ] Run the test; expect failure because the acceptance Compose contract is missing.
- [ ] Implement `createAcceptanceEnvironment` and `cleanupAcceptanceProject`; write secrets and credential roots only under `.runtime/acceptance/<run-id>/`.
- [ ] Add Platform-local Gateway/Loom/Tea doubles with `/health`, `/ready`, deterministic success/error/timeout fixtures, and request-id echoing.
- [ ] Add the acceptance Compose file using only Platform build contexts, doubles, isolated volumes, `${..._HOST_PORT}` variables, and `127.0.0.1` bindings.
- [ ] Parameterize all host ports in `deploy/docker-compose.local.yml`, bind them to loopback, and remove acceptance use of `${USERPROFILE}/.neuro`.
- [ ] Verify `docker compose -p platform-acceptance-contract -f deploy/acceptance/docker-compose.acceptance.yml config --quiet` passes without reading sibling source.
- [ ] Verify the test creates and removes only its own `.runtime/acceptance/<run-id>` resources.
- [ ] Commit `feat(platform): add isolated acceptance compose stack`.

### Task P1-03: Readiness And Production Dev-Auth Guard

**Files:**
- Create: `web/src/lib/dev-auth.test.ts`
- Modify: `web/src/lib/dev-auth.ts`
- Modify: `worker/src/health.ts`
- Create: `worker/src/health.test.ts`
- Modify: `services/account-worker/src/health.ts`
- Modify: `services/account-worker/src/health.test.ts`
- Modify: `executor/src/health.ts`
- Create: `executor/src/health.test.ts`
- Modify: `executor/package.json`
- Modify: `deploy/docker-compose.local.yml`
- Modify: `deploy/acceptance/docker-compose.acceptance.yml`

- [ ] Add a failing dev-auth test: `NODE_ENV=production` plus `DEV_AUTH_BYPASS_ENABLED=true` must throw a startup configuration error and must never register the credentials provider.
- [ ] Run `npm test --workspace @neuro/web -- --test-name-pattern="production dev auth"`; confirm the test fails because bypass remains enabled.
- [ ] Implement `assertDevAuthConfiguration` and call it before auth provider construction.
- [ ] Add failing readiness tests for never-successful cycles, stale successful cycles, dependency failures, and recovery to ready.
- [ ] Run worker/account-worker/executor focused tests and confirm current `/ready` behavior is too permissive.
- [ ] Implement separate liveness and readiness evaluators with last-success timestamps and configured freshness thresholds.
- [ ] Add `test` to `executor/package.json`.
- [ ] Add service healthchecks to both Compose files and replace dependent `service_started` conditions with `service_healthy`.
- [ ] Verify all four focused suites pass and Compose config is valid.
- [ ] Commit `fix(platform): enforce production auth and readiness`.

### Task P1-04: Strict Acceptance Entry Point And Debt Baseline

**Files:**
- Create: `scripts/acceptance/run-required.mjs`
- Create: `scripts/acceptance/run-live.mjs`
- Create: `scripts/acceptance/tests/run-required.test.mjs`
- Modify: `package.json`
- Modify: `packages/ai-gateway-domain/src/modules/gateway/credential-failover.ts`
- Modify: `packages/ai-gateway-domain/src/modules/gateway/credential-refresh.ts`
- Modify: `packages/ai-gateway-domain/src/modules/gateway/thinking-filter.ts`
- Test: existing three debt test files and Node module-mock debt files

- [x] Write a failing orchestration test proving `acceptance:ci` records every required suite and fails on one skipped or absent result.
- [x] Implement the required command inventory: unit, Vitest, debt, integration, typecheck, build, Compose render/startup, browser suite, and external-boundary contract probes.
- [x] Run each debt file separately and preserve the current nine expected failures as RED evidence.
- [x] Fix credential round-robin state, refresher registry behavior, and streaming thinking-tag boundary handling without weakening assertions.
- [x] Run `npm run test:vitest:debt --workspace @neuro/ai-gateway-domain` and `npm run test:node-mock:debt --workspace @neuro/ai-gateway-domain`; require zero failures.
- [x] Change `smoke` to call `acceptance:ci`; preserve the previous command as `smoke:quick`.
- [x] Verify `npm run smoke:quick`, `npm run test:debt`, and the acceptance orchestration unit tests pass.
- [x] Commit `test(platform): make acceptance gates truthful` (`7783149`).

## Phase 2: Real Heavy-Agent Chat

### Task P2-01: Contracts, Migration, And Repository

**Files:**
- Create: `packages/contracts/src/heavy-chat.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `core/migrations/0138_heavy_chat.sql`
- Create: `core/src/modules/heavy-chat/types.ts`
- Create: `core/src/modules/heavy-chat/schema.ts`
- Create: `core/src/modules/heavy-chat/repository.ts`
- Create: `core/src/modules/heavy-chat/repository.test.ts`

- [x] Write repository tests for user ownership, default Mimi slot idempotency, slot limit, project/thread/message ordering, favorite/project binding, and message status transitions.
- [x] Run the focused test against the integration database; expect missing tables/module failure.
- [x] Define contract types for slots, projects, threads, messages, references, actions, and `pending|streaming|complete|failed`.
- [x] Add SQL tables with foreign keys, owner-scoped unique indexes, idempotency keys, and timestamps.
- [x] Implement repository methods using transactions and owner predicates on every read/write.
- [x] Run migration on the isolated PostgreSQL fixture and require all repository tests to pass.
- [x] Commit `feat(platform): add heavy chat persistence model` (`e5bb268`).

### Task P2-02: Heavy-Chat Service And Managed-Heavy Agent

**Files:**
- Create: `core/src/modules/heavy-chat/service.ts`
- Create: `core/src/modules/heavy-chat/service.test.ts`
- Modify: `core/src/modules/agent-registry/service.ts`
- Create: `core/src/modules/agent-registry/managed-heavy.test.ts`

- [x] Write failing tests for default slot creation, custom slot entitlement/limit, thread creation, message idempotency, retry reuse, and cross-user denial.
- [x] Write a failing managed-heavy test proving a valid Platform-owned heavy agent is accepted while external runtime fields are rejected.
- [x] Implement heavy-chat orchestration and replace the blanket `managed_heavy` rejection with a Platform-managed validation branch.
- [x] Keep heavy-chat behavior out of the existing Agent repository; use Agent service only for slot-to-agent binding.
- [x] Run both focused suites and Core typecheck.
- [x] Commit `feat(platform): enable managed heavy agents`.

### Task P2-03: Gateway Boundary And Real Message Execution

**Files:**
- Create: `core/src/modules/heavy-chat/gateway-client.ts`
- Create: `core/src/modules/heavy-chat/gateway-client.test.ts`
- Modify: `core/src/modules/heavy-chat/service.ts`
- Modify: `core/src/env.ts`
- Modify: `deploy/env/core.env.example`
- Modify: both Compose files

- [x] Write contract tests against the Platform Gateway double for success, streaming chunks, provider rejection, timeout, and correlation-id propagation.
- [x] Confirm RED because no server-side heavy-chat Gateway client exists.
- [x] Implement a server-only client using `AI_GATEWAY_INTERNAL_URL` and management/project credentials; never return management tokens to Web.
- [x] Persist the user message before dispatch; persist assistant `pending`, append stream state, then finalize `complete` or `failed`.
- [x] Make retry idempotent by original assistant message id and idempotency key.
- [x] Run gateway-client, service, and isolated external-boundary tests, including PostgreSQL attempt CAS verification.
- [x] Commit `feat(platform): execute heavy chat through gateway`.

### Task P2-04: Core Router, Web API, And Client State

**Files:**
- Create: `core/src/modules/heavy-chat/router.ts`
- Create: `core/src/modules/heavy-chat/router.test.ts`
- Modify: `core/src/server.ts`
- Create: `web/src/lib/heavy-chat-client.ts`
- Create: `web/src/app/api/heavy-chat/snapshot/route.ts`
- Create: `web/src/app/api/heavy-chat/threads/route.ts`
- Create: `web/src/app/api/heavy-chat/threads/[threadId]/messages/route.ts`
- Create: `web/src/app/api/heavy-chat/messages/[messageId]/retry/route.ts`
- Create: `web/src/features/account-heavy-agent-chat/server.ts`
- Create: `web/src/features/account-heavy-agent-chat/adapter.ts`
- Modify: `web/src/features/account-heavy-agent-chat/heavy-agent-chat-page.tsx`
- Modify: `web/src/features/account-heavy-agent-chat/chat-workspace.tsx`
- Modify: `web/src/features/account-heavy-agent-chat/use-heavy-chat-thread-state.ts`

- [x] Write router permission/idempotency/error tests and Web client tests.
- [x] Confirm RED for missing `/v1/me/heavy-chat/*` routes.
- [x] Register owner-scoped Core routes and Next route handlers.
- [x] Replace seed initialization and timers with server snapshot hydration and API mutations.
- [x] Preserve the existing UI component structure and NeuroTerminal visual system.
- [x] Verify refresh restores the same persisted thread and failed messages remain retryable.
- [x] Run Core, Web, and typecheck suites.
- [x] Commit `feat(platform): connect heavy chat UI to persistence`.

### Task P2-05: Real Task And Mailbox Actions

**Files:**
- Create: `core/src/modules/heavy-chat/action-bridge.ts`
- Create: `core/src/modules/heavy-chat/action-bridge.test.ts`
- Modify: `core/src/modules/heavy-chat/service.ts`
- Create: `web/src/app/api/heavy-chat/messages/[messageId]/actions/route.ts`
- Modify: `web/src/features/account-heavy-agent-chat/use-heavy-chat-thread-state.ts`
- Modify: `web/src/features/account-heavy-agent-chat/heavy-chat-message-card.tsx`

- [ ] Write failing tests proving `task` creates an owner task draft and `mailbox` creates a mailbox draft/delivery record exactly once.
- [ ] Implement bridges through Task Hub and account mailbox service APIs, never direct cross-module repository imports.
- [ ] Persist action status and target id on the chat message action record.
- [ ] Return real target links; show success only after the target can be queried.
- [ ] Run action, Task Hub, mailbox, and Web tests.
- [ ] Commit `feat(platform): add real chat task and mailbox actions`.

## Phase 3: Product Truthfulness And Direct Work Surfaces

### Task P3-01: Dependency Result Envelope

**Files:**
- Create: `web/src/lib/dependency-result.ts`
- Create: `web/src/lib/dependency-result.test.ts`
- Create: `web/src/components/dependency-state.tsx`
- Create: `web/src/components/dependency-state.test.tsx`

- [ ] Test typed `ready|empty|partial|unavailable|unauthorized` results, correlation ids, retry metadata, and secret redaction.
- [ ] Implement the envelope and shared rendering primitives.
- [ ] Run Web tests and commit `feat(platform): add dependency result states`.

### Task P3-02: Remove Demo And Silent Empty Fallbacks

**Files:**
- Modify: `web/src/features/account-project-center/server.ts`
- Modify: `web/src/features/account-project-center/model.ts`
- Modify: `web/src/app/api/account-commerce/panel/route.ts`
- Modify: `web/src/features/account-agent-center/agent-center-page.tsx`
- Modify: `web/src/app/ops/account/agents/page.tsx`
- Modify: `web/src/app/arbitrations/page.tsx`
- Modify: `web/src/features/account-opinion-center/opinion-center-page.tsx`
- Add focused tests beside each feature/route

- [ ] Add failing tests for dependency 5xx/timeout/401 and true empty responses.
- [ ] Remove `PROJECT_FALLBACK_CATALOG`, broad `catch(() => []/null)`, and route-local `withFallback` from formal surfaces.
- [ ] Render the typed dependency state and preserve partial data only when source results identify which section failed.
- [ ] Run all affected Web tests and commit `fix(platform): stop masking dependency failures`.

### Task P3-03: Mailbox, Benefits, And Owner Arbitration Workspaces

**Files:**
- Modify: `web/src/app/mailbox/page.tsx`
- Modify: `web/src/features/mailbox/routes.ts`
- Modify: `web/src/app/benefits/page.tsx`
- Modify: `web/src/app/my-arbitrations/page.tsx`
- Create/modify focused page tests

- [ ] Write failing tests that each direct route renders its own actionable data/workflow and preserves deep-link state.
- [ ] Replace explanatory pages/redirect with real mailbox list/detail, benefits inventory/actions, and owner case/evidence views using existing clients.
- [ ] Verify mobile and desktop component tests and commit `feat(platform): add direct owner workspaces`.

### Task P3-04: Managed-Heavy Slot Controls

**Files:**
- Modify: `web/src/features/account-agent-center/managed-heavy-role-section.tsx`
- Modify: `web/src/features/account-agent-center/agent-center-page.tsx`
- Add focused component/server-action tests

- [ ] Add failing tests for real slot count, create/delete/enable/disable permissions, default Mimi protection, and entitlement errors.
- [ ] Wire controls to the heavy-chat/Agent APIs and remove hard-coded `1 / 2` and permanently disabled buttons.
- [ ] Run tests and commit `feat(platform): make heavy slot controls functional`.

## Phase 4: Core Domain Coverage, Security, And Observability

### Task P4-01: Identity, Wallet, Commerce, And Task Invariants

**Files:**
- Create tests under `core/src/modules/identity/tests/`, `core/src/modules/wallet-ledger/tests/`, `core/src/modules/product-order-item/tests/`, `core/src/modules/task-hub/tests/`
- Remove the corresponding placeholder `README.md` files after executable coverage exists
- Modify services only when a failing invariant test proves a defect

- [ ] Add real PostgreSQL tests for first/repeat login, role boundaries, grant/deduct/freeze/unfreeze, no negative balance, order/rollback, task escrow/settlement/cancel/default.
- [ ] Run RED tests against the isolated database, fix defects minimally, then require all domain suites green.
- [ ] Commit `test(platform): cover core identity economy and tasks`.

### Task P4-02: Agent, Mailbox, Governance, And Executor Contracts

**Files:**
- Add executable tests under Agent, arbitration, opinion, reputation, mailbox, and Executor modules
- Modify `executor/package.json`, `executor/src/health.ts`, `executor/src/http.ts`, `executor/src/tasks.ts` only as required by failing tests

- [ ] Test Agent ownership/callback/governance, mailbox delivery/idempotency, arbitration evidence/review, opinion settlement, reputation effects, and every Executor task key/HTTP contract.
- [ ] Remove covered placeholder README files.
- [ ] Run focused and workspace suites; commit `test(platform): cover agents governance mailbox and executor`.

### Task P4-03: Required Integration Fixture And OAuth Contract

**Files:**
- Create: `scripts/acceptance/integration-fixture.mjs`
- Create: `scripts/acceptance/tests/integration-fixture.test.mjs`
- Add workspace `test:integration:required` scripts where absent
- Add NextAuth callback/state/account-linking contract tests

- [ ] Test migration ordering, PostgreSQL/Valkey/S3 fixture readiness, no skip, and teardown ownership.
- [ ] Test OAuth state rejection, callback identity mapping, repeated account linking, and unauthorized access.
- [ ] Wire the fixture into `acceptance:ci` and require discovered equals executed.
- [ ] Commit `test(platform): make integration and oauth required`.

### Task P4-04: Correlation, Error Taxonomy, And Secret Redaction

**Files:**
- Modify shared HTTP foundation and Web/Core/Account clients
- Add focused tests to `packages/backend-foundation`, Core, Account API, and Web

- [ ] Test correlation id propagation, dependency error classification, Operator diagnostics, and redaction of tokens/cookies/keys/email codes.
- [ ] Implement shared headers/envelopes without exposing raw credentials.
- [ ] Verify logs and acceptance evidence scans contain no configured canary secret.
- [ ] Commit `feat(platform): add safe dependency observability`.

## Phase 5: Deployment And Complete Release

### Task P5-01: Production-Grade Kustomize

**Files:**
- Modify: `infra/k8s/base/*.yaml`
- Modify: `infra/k8s/overlays/staging/*`
- Modify: `infra/k8s/overlays/production/*`
- Modify: `infra/k8s/templates/secrets.example.yaml`
- Create: `infra/k8s/base/migrations.yaml`
- Create: `scripts/acceptance/tests/k8s-contract.test.mjs`

- [ ] Test no example values/latest tags, environment namespace isolation, digest replacements, migration jobs, Gateway secret contract, and namespace-scoped RBAC without Secret read.
- [ ] Implement manifests and update `deploy/apply-k8s.sh` with render, placeholder, migration, rollout, and smoke gates.
- [ ] Verify `kubectl kustomize` for both overlays and commit `feat(platform): make k8s deployment reproducible`.

### Task P5-02: OpenTofu Environment Contract

**Files:**
- Modify: `infra/tofu/environments/staging/*`
- Modify: `infra/tofu/environments/production/*`
- Modify modules only when validation requires it
- Create: `scripts/acceptance/tests/tofu-contract.test.mjs`

- [ ] Test environment separation, required variables, no secret defaults, standard IaaS-only resources, and outputs needed by k3s/Cloudflare.
- [ ] Run `tofu fmt -check -recursive` and `tofu validate` for each environment.
- [ ] Commit `feat(platform): validate portable infrastructure contract`.

### Task P5-03: Complete Platform Release Builder

**Files:**
- Create: `scripts/acceptance/release-build.mjs`
- Create: `scripts/acceptance/tests/release-build.test.mjs`
- Modify: `package.json`
- Modify: `docs/40-engineering/Platform产品完成与验收基线.md` only if implementation details require synchronization

- [ ] Test output-root enforcement, clean/current Git identity, acceptance-manifest match, OCI layout inventory, migration order, deployment bundle, env contract, SBOM/checksums, and secret scan.
- [ ] Implement `npm run release:build`; reject output outside `../release/Platform` and do not push a registry.
- [ ] Verify a test release manifest from Platform-local fixture images.
- [ ] Commit `feat(platform): build complete platform releases`.

### Task P5-04: Artifact-Only Release Smoke

**Files:**
- Create: `scripts/acceptance/release-smoke.mjs`
- Create: `scripts/acceptance/tests/release-smoke.test.mjs`
- Modify: `package.json`

- [ ] Test rejection of source bind mounts/build contexts and acceptance of OCI/digest inputs.
- [ ] Start the release on unique loopback ports, run migration/readiness/product smoke, record evidence, and clean only the run project.
- [ ] Verify `npm run acceptance:release -- --package-dir <fixture> --run-id <id> --evidence-path <file>` passes.
- [ ] Commit `test(platform): verify release artifacts independently`.

## Phase 6: Browser Journeys And Final Acceptance

### Task P6-01: Owner And Visitor Playwright Journeys

**Files:**
- Create: `playwright.config.ts`
- Create: `web/e2e/fixtures.ts`
- Create Owner and Visitor specs named by the canonical journey ids
- Modify: `package.json`

- [ ] Implement `O-AUTH`, `O-COMMERCE`, `O-TASK`, `O-AGENT-CHAT`, `O-PROJECT-GOV`, and `V-PUBLIC` with API/DB evidence after writes and desktop/mobile projects.
- [ ] Run against the isolated acceptance stack and require screenshots/traces only on failure.
- [ ] Commit `test(platform): cover owner and visitor journeys`.

### Task P6-02: Operator And Dependency-Error Journeys

**Files:**
- Create Operator and error specs under `web/e2e/operator/` and `web/e2e/errors/`

- [ ] Implement `OP-CONTROL` and `ERR-DEPENDENCY`, including correlation id, partial/unavailable states, retry, and no secret exposure.
- [ ] Run desktop plus mobile smoke; commit `test(platform): cover operator and dependency errors`.

### Task P6-03: Full Required And Conditional-Live Matrix

**Files:**
- Modify acceptance runners and progress/evidence docs only as results require

- [ ] Run `npm run acceptance:ci` with a fresh run id and zero skipped required/external-boundary suites.
- [ ] Run `npm run acceptance:live`; classify Linux.do, Gateway, Tea, Loom, and Hook inventory as passed, external-blocked, failed, not-run, or not-applicable with same-day evidence.
- [ ] Fix every internal failure and rerun from a clean isolated stack.
- [ ] Commit only evidence/doc synchronization if source fixes were already committed per task.

### Task P6-04: Release, Final Review, And Signoff

**Files:**
- Generate: `../release/Platform/<version-id>/`
- Modify: progress files, canonical docs, and P2 register

- [ ] Run full typecheck/build/tests, K8s/Tofu validation, Compose acceptance, browser matrix, release build, and artifact-only smoke.
- [ ] Dispatch final spec and code-quality reviews; fix every Critical/Important finding.
- [ ] Confirm Platform worktree has no unintended changes and no internal P0/P1 remains.
- [ ] Record remaining P2 owner/boundary/rationale and final conclusion using one canonical status phrase.
- [ ] Commit `release(platform): complete acceptance-ready product`.

## Plan Self-Review

- Every canonical requirement maps to at least one task.
- Runtime implementation begins only after P1-01 RED evidence.
- External sibling source is never a build context.
- Complete release generation and artifact-only verification are separate tasks.
- Browser success requires API/database evidence, not visual toast checks.
- No task permits required-suite skip or demo fallback.
