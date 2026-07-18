# Phase 1 验收基础设施与真实门禁

- [x] `P1-01` manifest、命令执行器和 required skip-fail runner。
- [x] `P1-02` isolated Compose、临时 secret/credential root、Platform doubles、owner cleanup。
- [x] `P1-03` Web production Dev Auth guard、Worker/Account Worker/Executor readiness。
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

## P1-03 Evidence

- RED/GREEN focused tests：Web Dev Auth `4/4`；Worker workspace `7/7`；Account Worker workspace `44/44`；Executor readiness/task suites `4/4`；Core outbox machine-auth contract `2/2`。
- Typecheck/build：Web `next build`、Core、Worker、Account Worker、Executor typecheck 均通过；Executor workspace 新增 `test` script。
- Readiness semantics：`/health` 在未成功、最新失败和过期状态下保持 `200`；`/ready` 对 never-success、latest-failure、stale-success 返回 `503`，恢复成功后返回 `200`。Executor 按每个 loop 的 interval 独立计算 freshness，并要求全部 loop ready。
- Compose contract：`17/17` acceptance compose tests；acceptance/local config 均 `config --quiet` 通过；应用依赖从 `service_started` 切换为 `service_healthy`，Web 的 acceptance/local Dev Auth 明确运行在 `NODE_ENV=development` 的 `next dev`，Worker/Account Worker 获得所有 readiness-critical Core/Gateway 环境与 health dependency，不削弱生产 guard。
- Isolated runtime `platform-acceptance-p103-runtime2`：11 个服务全部 healthy；Web、Core、Account API、Gateway、Loom、Tea 的 `/ready` 均 `200`；Worker、Account Worker、Executor 容器内 `/health` 与 `/ready` 均 `200`；Executor 20 个常驻调度 loop 均有 `lastSuccessAt`，`failingLoops=[]`，日志无 `401/404/error`；另有 2 个 CLI/CronJob task，不计入常驻 loop。
- Production guard probe：使用最新 Web 镜像运行 `NODE_ENV=production` 与 `DEV_AUTH_BYPASS_ENABLED=true`，容器退出码 `1`，错误为 `DEV_AUTH_BYPASS_ENABLED must be disabled when NODE_ENV=production`。
- Runtime 期间发现并修复两项真实缺口：Outbox alert 机器任务错误要求用户上下文；Executor 中两个没有 Core 路由实现的 discount archive loop 已删除，并由回归测试锁定。
