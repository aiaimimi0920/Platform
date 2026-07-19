# Phase 2 重度智能体真实闭环

- [x] `P2-01` contracts、SQL migration、owner-scoped repository。
- [x] `P2-02` heavy-chat service、slot entitlement、managed_heavy validation。
- [ ] `P2-03` server-side Gateway stream/error/retry boundary。
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

- Focused service and registry suite: `6/6` passed, including default/custom slot delegation, server-side entitlement, message retry delegation, owner denial, managed-heavy binding rules, and registry wiring.
- Managed-heavy validation is pure and has no PostgreSQL, Redis, or environment initialization side effects.
- `npm run test:heavy-chat --workspace @neuro/core`: `20/20` passed (`14` repository, `3` service, `3` registry/validator).
- Core typecheck: exit `0`.
- Managed-heavy creation and update paths retain the legacy `registry_only` compatibility behavior while explicit `managed_heavy` inputs reject external runtime and managed-light execution fields.
