# Phase 1 验收基础设施与真实门禁

- [x] `P1-01` manifest、命令执行器和 required skip-fail runner。
- [x] `P1-02` isolated Compose、临时 secret/credential root、Platform doubles、owner cleanup。
- [x] `P1-03` Web production Dev Auth guard、Worker/Account Worker/Executor readiness。
- [x] `P1-04` `smoke` strict bridge、debt 修复、required/external-boundary manifest。

Acceptance: `npm run acceptance:ci` exits nonzero for any required skip/failure and records `acceptance-manifest.json`.

Phase 1 的基础设施任务已全部完成（`4/4`），但这不等于 Platform 产品完成。P1-04 的最终 required manifest 仍有内部失败，后续 Phase 2-6 和 release 任务必须继续执行。

## P1-01 Evidence

- `node --test scripts/acceptance/tests/*.test.mjs`: `48/48` passed, including real Node/Vitest skip and todo detection, bounded timeout tree cleanup, global run/evidence claims, concurrent atomic evidence writes, portable paths, credential redaction, and false-pass rejection.
- required-mode gated command: exit `1` with `Skipping gated tests is forbidden`.
- `npm run smoke:quick`: passed; existing Tea real smoke remains explicitly skipped in the quick baseline.
- P1-01 historical snapshot: `npm run acceptance:ci` exited `1` with a failed manifest because the complete required/external-boundary inventory was intentionally deferred to `P1-04`; the final P1-04 run is recorded below.

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

## P1-04 Evidence

- acceptance unit tests：`node --test scripts/acceptance/tests/*.test.mjs`，`112/112` passed；`npm run smoke:quick`、全 workspace `npm run typecheck` 与 `npm run build` 均通过。脱敏回归覆盖 CLI 顶层异常、敏感环境变量及 JSON 叶子、URL userinfo、base64/base64url 和 credential argv。
- debt 修复结果：原 9 项失败均已清零；`npm run test:vitest:debt --workspace @neuro/ai-gateway-domain` 为 `55/55` passed；`npm run test:node-mock:debt --workspace @neuro/ai-gateway-domain` 为 `56/56` passed。P1-04 开始前的 `44 passed / 9 failed / 53 total` 已作为历史 RED 起始基线保留，不再代表当前结果。
- required/external-boundary inventory 固定为 `14 + 4` 项。最终真实 run 为 `.runtime/acceptance/platform-acceptance-p104-runtime5/acceptance-manifest.json`：required `14 discovered / 14 executed / 9 passed / 5 failed / 0 skipped`；external-boundary `4 discovered / 4 executed / 3 passed / 0 failed / 1 not-applicable`。runtime5 Git metadata 为 commit `77831496c3baa886d9f08ac804b92268f58000f6`、`dirty: true`（dirty 仅来自未提交的 P2-01 文件）。
- required 的 5 个失败是：`integration-required` 在 required 模式拒绝 gated skip（需要 `AI_GATEWAY_INTEGRATION_TESTS=1`），以及 `browser-owner`、`browser-visitor`、`browser-operator`、`browser-errors` 尚未实现。它们均以非零失败留在 manifest 中，没有被伪装成通过或跳过。
- external-boundary 的 Gateway、Loom、Tea contract probes 通过；Hook source/dependency inventory 证明当前没有 Platform-owned runtime hook 调用点，因此记录为 `not-applicable`，不是 `passed`。
- Compose render/startup 均为 exit `0`；startup project 的服务均报告 healthy，`.runtime/acceptance/platform-acceptance-p104-runtime5/compose/startup/compose-cleanup.json` 与 `compose/render/compose-cleanup.json` 均记录 `cleaned: true`。cleanup 后本次 run 的容器、网络、volume 均为 `0`，临时 `resources/` 已清理；runtime5 证据目录未发现测试 canary。
- P1-04 收口结论：Phase 1 acceptance infrastructure 可复现且门禁诚实，但 manifest overall 为 failed；当前 canonical 产品状态仍为 `Platform 产品未完成`，不得据此生成或宣称完整 release。

## 2026-08-10 运行可靠性加固

- dev4 全浏览器矩阵暴露 Docker Desktop Engine API 短暂 HTTP 500：浏览器结束后的首次 owner cleanup 失败，但 Engine 自恢复后使用同一 owner record 的精确 cleanup 成功，scoped container/network/volume 均为 `0`。
- `cleanupAcceptanceProject` 现在只对 timeout、Docker daemon unavailable、Engine 5xx 等瞬态错误有限退避重试；每次重试复用 owner/env 校验后完全相同的 project、Compose file、env file 和 `down --volumes --remove-orphans` 参数。普通 Compose contract 错误立即失败并保留 owner 资源，不做无意义重试。
- startup runner 在 Playwright 结束后、cleanup 之前新增第二次 `compose ps --all --format json`，并将 exit code/结果写入 `compose-startup.json`。该诊断本身也是 startup pass 条件，防止浏览器恰好结束后 Engine/容器失效却被误报为通过。
- 验证：`node --test "scripts/acceptance/tests/*.test.mjs"` 为 `145/145` passed；新增用例覆盖同一 owned cleanup 的两次瞬态失败后成功、非瞬态错误不重试，以及 post-browser process inventory。
