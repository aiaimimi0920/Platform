# Phase 1 验收基础设施与真实门禁

- [x] `P1-01` manifest、命令执行器和 required skip-fail runner。
- [ ] `P1-02` isolated Compose、临时 secret/credential root、Platform doubles、owner cleanup。
- [ ] `P1-03` Web production Dev Auth guard、Worker/Account Worker/Executor readiness。
- [ ] `P1-04` `smoke` strict bridge、debt 9 项清零、required/external-boundary manifest。

Acceptance: `npm run acceptance:ci` exits nonzero for any required skip/failure and records `acceptance-manifest.json`.

## P1-01 Evidence

- `node --test scripts/acceptance/tests/*.test.mjs`: `18/18` passed, including colon/equals multi-cookie and raw Bearer redaction plus missing/nonzero-exit false-pass rejection.
- required-mode gated command: exit `1` with `Skipping gated tests is forbidden`.
- `npm run smoke:quick`: passed; existing Tea real smoke remains explicitly skipped in the quick baseline.
- `npm run acceptance:ci`: exit `1` with a failed manifest because the complete required/external-boundary inventory is intentionally deferred to `P1-04`.
