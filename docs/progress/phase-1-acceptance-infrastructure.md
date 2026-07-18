# Phase 1 验收基础设施与真实门禁

- [ ] `P1-01` manifest、命令执行器和 required skip-fail runner。
- [ ] `P1-02` isolated Compose、临时 secret/credential root、Platform doubles、owner cleanup。
- [ ] `P1-03` Web production Dev Auth guard、Worker/Account Worker/Executor readiness。
- [ ] `P1-04` `smoke` strict bridge、debt 9 项清零、required/external-boundary manifest。

Acceptance: `npm run acceptance:ci` exits nonzero for any required skip/failure and records `acceptance-manifest.json`.
