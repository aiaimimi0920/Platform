---
name: platform-product-completion
description: Execute and maintain the Neuro Platform product-completion plan with isolated acceptance infrastructure, real heavy-chat persistence, truthful dependency states, required TDD gates, and release verification. Use when working under Platform/docs/progress/MASTER.md or implementing Platform acceptance tasks.
---

# Platform Product Completion

## Start Every Session

1. Read `docs/progress/MASTER.md`.
2. Read the active phase file and the matching task in `docs/superpowers/plans/2026-07-18-platform-product-completion.md`.
3. Check `git status --short -- Platform`; ignore unrelated sibling-project changes.
4. Claim one task only. Do not run two implementation agents against the same files.

## Required Implementation Loop

1. Write one focused failing test.
2. Run the exact focused command and record the expected failure in `.runtime/acceptance/<run-id>/red/`.
3. Implement the smallest change within `Platform/`.
4. Run focused tests, affected workspace tests, typecheck, and relevant smoke.
5. Run spec-compliance and code-quality review before the next task.
6. Commit only the task's files with a descriptive message.
7. Update the phase file and `MASTER.md` counts immediately.

## Acceptance Rules

- `npm run smoke` is the strict CI bridge; `npm run smoke:quick` is not a completion gate.
- `npm run acceptance:ci -- --run-id <id> --evidence-dir <dir>` must fail on required/external-boundary skips.
- `npm run acceptance:live` may report `external-blocked`, but never converts `failed` or evidence-free `not-run` to pass.
- Never use sibling `../Gateway`, `../Loom`, `../Tea`, or `../Hook` as a Docker build context or bind mount.
- Never expose management tokens in browser responses, logs, screenshots, or release evidence.
- A success toast requires a persisted/queryable side effect.
- A dependency error must not become `[]`, `null`, or demo data.

## Heavy Chat Boundary

Keep heavy chat in `core/src/modules/heavy-chat/` with `slot/project/thread/message` ownership predicates, idempotency keys, and `pending/streaming/complete/failed` status. Call Gateway only from the server-side Core boundary. Task and mailbox actions go through their service/API contracts, never direct repository imports.

## Release Boundary

`release:build` must reject output outside `C:\Users\Public\nas_home\AI\GameEditor\Neuro\release\Platform`, produce an OCI layout or fixed digest manifest, and copy only redacted evidence. `acceptance:release` treats the package directory as read-only and cannot use source paths.
