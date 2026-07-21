# Phase 3 产品真实性与正式入口

- [x] `P3-01` typed dependency result envelope and shared states。
- [ ] `P3-02` remove demo catalog and silent empty fallbacks。
- [ ] `P3-03` direct mailbox/benefits/my-arbitrations workspaces。
- [ ] `P3-04` real managed-heavy slot controls。

Acceptance: dependency failure is visibly unavailable/error, true empty remains empty, and every successful action has a queryable side effect.

## P3-01 Evidence

- Added a generic discriminated dependency envelope with `ready`, `empty`, `partial`, `unavailable`, and `unauthorized` states. `partial`, `unavailable`, and `unauthorized` require at least one concrete failure both in the TypeScript tuple type and at runtime.
- Correlation IDs are explicitly `string | null`; missing IDs remain `null`, ordinary IDs are preserved, and credential-shaped values are redacted before diagnostics can render. Retry metadata is discriminated and rejects non-retryable results carrying a delay.
- Failure message, source, code, diagnostics, and correlation ID normalization redact Authorization/Bearer values, token/API-key/password assignments, and `sk-*` values. No transport or page request code was changed.
- `DependencyState` reuses `NtCard` and `NtBadge`, renders all five tones, and exposes `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`. Technical source/code/correlation/retry/diagnostic details are hidden by default and shown only when `diagnostics` is explicit.
- TDD evidence: the initial focused RED run was `0 pass / 2 fail` because the four implementation modules did not exist; after implementation and the correlation redaction regression, focused tests passed `9/9`. Web full suite passed `234/234`, TypeScript check exited `0`, and Next production build exited `0`.

P3-01 is complete. P3-02 through P3-04 remain; Platform is not complete and release generation is still prohibited.
