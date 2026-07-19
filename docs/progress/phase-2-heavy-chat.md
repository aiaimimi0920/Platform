# Phase 2 重度智能体真实闭环

- [x] `P2-01` contracts、SQL migration、owner-scoped repository。
- [x] `P2-02` heavy-chat service、slot entitlement、managed_heavy validation。
- [x] `P2-03` server-side Gateway stream/error/retry boundary。
- [ ] `P2-04` Core/Web routes、server snapshot hydration、refresh persistence。
- [ ] `P2-05` real Task Hub and mailbox action bridges with idempotency。

Acceptance: an isolated Owner can send, reload, retry, create a task, and create a mailbox record; all IDs are queryable.

## P2-01 Evidence

- Focused repository suite: `14/14` passed.
- Core typecheck and build: exit `0`.
- Isolated PostgreSQL integration: `1/1` passed against a temporary PostgreSQL 16 container, followed by container/resource cleanup.
- Database coverage includes composite owner foreign keys, slot-to-managed-agent binding, slot entitlement concurrency, idempotent message insertion, unique message sequence allocation, terminal-state CAS, retry-attempt idempotency, parent-thread activity timestamps, project rebind, deterministic ordering, and trigger-injected transaction rollback.
- RED evidence is retained under `.runtime/acceptance/platform-p201-schema-red/red/` for missing slot-agent/attempt persistence and duplicate pending-attempt reservation.

## P2-02 Evidence

- Focused service and registry suite: `7/7` passed, including default/custom slot delegation, server-side entitlement, message retry delegation, owner denial, complete managed-heavy binding rules, resolver ID matching, and registry wiring.
- Managed-heavy validation is pure and has no PostgreSQL, Redis, or environment initialization side effects.
- `npm run test:heavy-chat --workspace @neuro/core`: `21/21` passed (`14` repository, `4` service, `3` registry/validator).
- Core typecheck: exit `0`.
- Managed-heavy creation and update paths retain the legacy `registry_only` compatibility behavior while explicit `managed_heavy` inputs reject external runtime and managed-light execution fields.

## P2-03 Evidence

- Gateway contract suite: `15/15` passed. Coverage includes management project ensure, project-token exchange, JSON completion, SSE aggregation, unified deadline, response-body/SSE cancellation, strict request/correlation tracing, malformed/empty/error payload rejection, credential redaction, callback error passthrough, and HTTP status attribution (`provider_rejected` vs `unavailable` vs `protocol_error`).
- Heavy-chat focused suite: `49/49` passed (`env` parser `1`, Gateway `15`, repository `17`, service `13`, managed-heavy `3`).
- Core full suite: `123/123` passed after the final env parser and management-auth attribution regressions were added.
- Core typecheck and build: exit `0` after the Gateway contract repair.
- PostgreSQL integration: `1/1` passed against an isolated temporary PostgreSQL 16 container; the container was removed after the run. The integration covers attempt-2 atomic CAS and proves a late attempt-1 result cannot overwrite the fresh result.
- External-boundary probes: `8/8` passed. Acceptance Compose Gateway double now echoes both `x-request-id` and `x-correlation-id` on health, management, runtime, error, and SSE responses.
- Acceptance Compose contract suite: `17/17` passed. Local and acceptance Compose render successfully when the acceptance environment helper supplies its run-owned variables. Local development intentionally leaves `HEAVY_CHAT_GATEWAY_MODEL` unset; acceptance uses the deterministic `fixture-success` model.
- Scope boundary: `createHeavyChatGatewayClient` and `createHeavyChatService` are server-side libraries only at this stage. Core router/runtime composition, Next API handlers, snapshot hydration, and browser persistence remain P2-04; therefore P2-03 is not a user-callable product completion claim.
