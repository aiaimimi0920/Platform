# Phase 3 产品真实性与正式入口

- [x] `P3-01` typed dependency result envelope and shared states。
- [x] `P3-02` remove demo catalog and silent empty fallbacks。
- [x] `P3-03` direct mailbox/benefits/my-arbitrations workspaces。
- [x] `P3-04` real managed-heavy slot controls。

Acceptance: dependency failure is visibly unavailable/error, true empty remains empty, and every successful action has a queryable side effect.

## P3-01 Evidence

- Added a generic discriminated dependency envelope with `ready`, `empty`, `partial`, `unavailable`, and `unauthorized` states. `partial`, `unavailable`, and `unauthorized` require at least one concrete failure both in the TypeScript tuple type and at runtime.
- Correlation IDs are explicitly `string | null`; missing IDs remain `null`, ordinary IDs are preserved, and credential-shaped values are redacted before diagnostics can render. Retry metadata is discriminated and rejects non-retryable results carrying a delay.
- Failure message, source, code, diagnostics, and correlation ID normalization redact Authorization/Bearer values, token/API-key/password assignments, and `sk-*` values. No transport or page request code was changed.
- `DependencyState` reuses `NtCard` and `NtBadge`, renders all five tones, and exposes `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`. Technical source/code/correlation/retry/diagnostic details are hidden by default and shown only when `diagnostics` is explicit.
- TDD evidence: the initial focused RED run was `0 pass / 2 fail` because the four implementation modules did not exist; after implementation and the correlation redaction regression, focused tests passed `9/9`. Web full suite passed `234/234`, TypeScript check exited `0`, and Next production build exited `0`.

P3-01 is complete. P3-02 evidence follows.

## P3-02 Evidence

- Removed the project fallback catalog and formal route-local `withFallback` / broad empty fallbacks from Project, Commerce, Agent, Operator, Arbitration, and Opinion surfaces.
- Commerce now returns a typed panel envelope for every source, preserving successful sections as `partial` and returning a typed empty panel on outer failure. Product, listing, item, order, account, and balance UI states no longer turn source failures into fake empty shelves or zero balances.
- Opinion filtered views now aggregate per-topic detail dependencies. Partial detail failures preserve successful topics; all-detail failures render `DependencyState` and block the normal empty-list message. Vote controls are disabled unless the wallet dependency is `ready`.
- Agent and Operator pages now guard the primary registry, capability, execution, callback-health, runtime, callback-history, and benefits/model sources. Failed sources render local dependency states and suppress derived zero counts or dependent write/action controls.
- Added `getPublicSurfaceSnapshotStrict()` for formal P3-02 pages. Opinion, Agent, Project, Arbitration, and Commerce no longer treat a failed public-surface read as all surfaces enabled; legacy callers retain the compatibility wrapper until their own migration tasks.
- TDD evidence: focused RED/GREEN cycles cover filtered Opinion detail aggregation, wallet vote gating, Agent/Operator registry and source guards, and strict public-surface reads. Web full suite passed `264/264`; `npx tsc --noEmit --pretty false -p tsconfig.json` exited `0`; `npm run build` completed successfully; `git diff --check -- Platform` passed.

P3-02 is complete. P3-03 evidence follows.

## P3-03 Evidence

- `/mailbox` no longer renders a placeholder page. It now mounts the real `MailboxCenter` in workspace mode, preserves `messageId` deep links, updates the URL when the owner changes the selected message, and keeps dependency failures visible instead of redirecting to fake empty UI.
- `/benefits` no longer acts as a popup explainer route. It now mounts the real `BenefitCenter` in workspace mode, resolves `family` and `serviceId` from the current query string, highlights the targeted dual-service row, and keeps refill/API/prompt-cache dependency failures explicit instead of silently dropping those details.
- `/my-arbitrations` no longer redirects to the operator console. It now reuses the main arbitration workspace in `ownerOnly` mode so owners can review only their related cases, filter by `caseId` and status, add evidence, and keep operator-only workload, assignment, remote-storage, and status-mutation controls hidden.
- The account shell now recognizes `/mailbox`, `/benefits`, and `/my-arbitrations` as direct workspaces and suppresses duplicate overlay launchers while those routes are active.
- Added focused route and helper contracts for the new direct surfaces: `src/app/p3-03-workspaces.test.ts`, `src/app/arbitrations/presentation.test.ts`, `src/features/account-benefit-center/utils.test.ts`, and the mailbox deep-link/workspace regressions in `src/features/mailbox/player/utils.test.ts`.
- Verification evidence: `npm run test --workspace @neuro/web` passed `273/273`; `npm run typecheck --workspace @neuro/web` completed successfully via `next build`; `git diff --check -- Platform` exited `0` with only Git LF/CRLF normalization warnings.

P3-03 is complete. P3-04 evidence follows.

## P3-04 Evidence

- `/agents?role=heavy` no longer hard-codes `1 / 2` or renders permanently disabled controls. The slot summary now derives from live custom heavy-agent count plus the protected default Mimi slot, and the toolbar switches between create/batch-confirm states like the light/cloud role workbenches.
- The heavy role overview now wires real `saveManagedHeavyAgentAction` and `applyManagedHeavyAgentBatchAction` entry points. Owners can create one self-defined heavy slot, edit it, and batch delete/enable/disable only custom heavy slots while the default Mimi entry remains non-selectable and protected.
- Entitlement pressure is surfaced in the UI instead of only via dead buttons. When the owner already occupies the default slot plus one self-created slot, the create affordance is disabled and the same “更多槽位请先购买” guidance remains visible before the form submits.
- Added the focused contract `src/features/account-agent-center/managed-heavy-role-section.test.ts` to pin real slot-count derivation, live action wiring, and default Mimi protection.
- Verification evidence: `npm run test --workspace @neuro/web` passed `276/276`; `npm run typecheck --workspace @neuro/web` completed successfully via `next build`; `git diff --check -- Platform` exited `0` with only Git LF/CRLF normalization warnings.

Phase 3 is complete. Platform is still not complete: Phase 4-6 remain, and release generation is still prohibited.
