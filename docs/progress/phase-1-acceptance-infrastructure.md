# Phase 1 验收基础设施与真实门禁

- [x] `P1-01` manifest、命令执行器和 required skip-fail runner。
- [x] `P1-02` isolated Compose、临时 secret/credential root、Platform doubles、owner cleanup。
- [ ] `P1-03` Web production Dev Auth guard、Worker/Account Worker/Executor readiness。
- [ ] `P1-04` `smoke` strict bridge、debt 9 项清零、required/external-boundary manifest。

Acceptance: `npm run acceptance:ci` exits nonzero for any required skip/failure and records `acceptance-manifest.json`.

## P1-01 Evidence

- `node --test scripts/acceptance/tests/*.test.mjs`: `48/48` passed, including real Node/Vitest skip and todo detection, bounded timeout tree cleanup, global run/evidence claims, concurrent atomic evidence writes, portable paths, credential redaction, and false-pass rejection.
- required-mode gated command: exit `1` with `Skipping gated tests is forbidden`.
- `npm run smoke:quick`: passed; existing Tea real smoke remains explicitly skipped in the quick baseline.
- `npm run acceptance:ci`: exit `1` with a failed manifest because the complete required/external-boundary inventory is intentionally deferred to `P1-04`.

## P1-02 Evidence

- focused Compose/double suite: `node --test scripts/acceptance/tests/compose.test.mjs`，`13/13` passed。
- full acceptance test inventory: `node --test scripts/acceptance/tests/*.test.mjs`，`61/61` passed，`0` failed，`0` skipped。
- acceptance Compose render: `docker compose -p platform-acceptance-p102-config --env-file .runtime/acceptance/platform-acceptance-p102-config/resources/acceptance.env -f deploy/acceptance/docker-compose.acceptance.yml config --quiet`，exit `0`。
- local Compose render: `docker compose -f deploy/docker-compose.local.yml config --quiet`，exit `0`。
- acceptance images built successfully for migrations, Core, Account API, workers, Executor, Web，以及 Platform-local Gateway/Loom/Tea doubles；基础镜像使用固定 digest。
- runtime probe run `platform-acceptance-p102-config`：Web `/health`、Core/Account API `/health` 与 `/ready` 返回 `200`；三个 double `/ready` 返回 `fixture: true`、`x-platform-fixture: true` 和 request-id echo；Gateway SSE 返回 fixture header/body 与 `[DONE]`；已认证 Loom 未知路由返回 `404/FIXTURE_NOT_FOUND`；Tea ticket array 返回 `200` 与 fixture header。
- 脱敏启动证据保留于 `.runtime/acceptance/platform-acceptance-p102-config/compose-startup.json`；owner-aware cleanup receipt 为 `.runtime/acceptance/platform-acceptance-p102-config/compose-cleanup.json`。
- cleanup 后 scoped residue check：本次 project 的容器、network、volume 均为 `0`，`resources/` secret/credential root 已删除，启动证据和 cleanup receipt 保留。
- 构建日志报告 npm tree 存在 `3 high severity vulnerabilities`；该项未阻塞本次构建，列入后续依赖审计风险，不作为 live Provider 成功声明。
