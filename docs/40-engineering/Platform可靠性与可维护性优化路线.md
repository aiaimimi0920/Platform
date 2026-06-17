# Platform 可靠性与可维护性优化路线

本文记录 Platform 当前已落地的可靠性基线，以及后续可维护性 refactor 的推荐顺序。

适用范围：

- `core`
- `services/account-api`
- `services/account-worker`
- `worker`
- `web`
- `packages/backend-foundation`
- `packages/account-domain`
- `packages/ai-gateway-domain`

非目标：

- 不把 Gateway provider 完成度、具体供应商能力缺口并入 Platform 可靠性问题。
- 不触碰旧 `NeuroPlatform` 仓或运行中旧服务。
- 不在没有独立验证实例的情况下重启或替换现网容器。

## 1. 已落地的可靠性基线

### 1.1 Account worker stale outbox recovery

目标：避免 worker 进程中断后，`processing` 状态 outbox 事件永久卡住。

当前实现：

- `services/account-worker/src/outbox.ts`
  - 新增 `requeueStaleProcessingEvents(staleAfterMs, limit)`。
  - 只恢复 `consumer_service = 'account'` 的 stale `processing` 事件。
  - 剩余 attempts 未耗尽时恢复为 `pending`，并立即可消费。
  - attempts 已耗尽时进入 `dead_letter`。
- `services/account-worker/src/env.ts`
  - `ACCOUNT_WORKER_PROCESSING_LEASE_TIMEOUT_MS`
  - `ACCOUNT_WORKER_PROCESSING_RECOVERY_LIMIT`
- `services/account-worker/src/index.ts`
  - 每轮 poll 前先执行 stale recovery。

后续可增强：

- 给恢复数量、dead-letter 数量加 metrics。
- 在 `/ops/account-worker` 页面展示最近一次 recovery 时间、数量和异常。

### 1.2 Web internal request timeout/retry baseline

目标：避免 Web server-side 对 Core / Account / Gateway 的内部请求无限悬挂；统一 retry 语义。

当前实现：

- `web/src/lib/internal-request.ts`
  - `fetchInternal(...)`
  - 默认 timeout：`15000ms`
  - 默认只重试 `GET`
  - 默认 retry delay：`200ms, 600ms`
  - network error 标准化为 `INTERNAL_REQUEST_NETWORK_ERROR`
  - timeout 标准化为 `INTERNAL_REQUEST_TIMEOUT`
- 已接入：
  - `web/src/lib/core-client.ts`
  - `web/src/lib/account-request.ts`
  - `web/src/lib/gateway-request.ts`
- timeout env：
  - `CORE_INTERNAL_FETCH_TIMEOUT_MS`
  - `ACCOUNT_INTERNAL_FETCH_TIMEOUT_MS`
  - `GATEWAY_INTERNAL_FETCH_TIMEOUT_MS`
  - fallback：`INTERNAL_FETCH_TIMEOUT_MS`

后续可增强：

- 把 timeout / retry 事件接入 operator-visible dependency notice。
- 对非幂等写请求只允许显式 opt-in retry，并要求 idempotency key。

### 1.3 Core / Account API CORS 与错误响应基线

目标：不要对任意 Origin 反射 CORS；unexpected 500 不泄露内部异常 message。

当前实现：

- Core helper：
  - `core/src/platform/http-server.ts`
- Account / shared helper：
  - `packages/backend-foundation/src/platform/http-server.ts`
  - `packages/backend-foundation/platform/http-server.{js,d.ts}` 保持 deep import 兼容。
- 已接入：
  - `core/src/server.ts`
  - `services/account-api/src/server.ts`
- CORS allowlist：
  - env：`PLATFORM_ALLOWED_ORIGINS`
  - dev default：
    - `http://localhost:3028`
    - `http://127.0.0.1:3028`
  - local compose 会按 `WEB_HOST_PORT` 显式传：
    - `http://localhost:${WEB_HOST_PORT:-3028}`
    - `http://127.0.0.1:${WEB_HOST_PORT:-3028}`
- unexpected error payload：
  - `error.code = INTERNAL_SERVER_ERROR`
  - `error.message = Internal server error`
  - 真实异常只写服务端日志。

后续可增强：

- 对 rejected Origin 增加低频 debug 日志，避免误配时无证据。
- 统一 Core 与 backend-foundation 的 helper 来源；当前保留最小重复是为了避免改动 Core 的包依赖边界。

### 1.4 Workspace test scripts baseline

目标：根级不再维护一条越来越长的手写 test 命令；各 workspace 有可直接运行的稳定入口。

当前入口：

- 根级：
  - `npm run test`
    - build contracts
    - run workspace unit tests
  - `npm run test:unit`
    - `npm run test -ws --if-present`
  - `npm run test:focused`
    - 保留原来的手写 focused 集合，便于对照历史 CI 行为。
- workspace：
  - `@neuro/backend-foundation`
  - `@neuro/ai-gateway-domain`
  - `@neuro/account-domain`
  - `@neuro/account-api`
  - `@neuro/account-worker`
  - `@neuro/core`
  - `@neuro/worker`
  - `neuroplatform-web`

注意：

- 当前 workspace `test` 是稳定可运行集合，不等于仓库里所有 `*.test.ts` 的全量 glob。
- 全量 glob 暴露了现有历史问题：
  - 部分 ai-gateway-domain 测试需要 `DATABASE_URL`。
  - 部分测试依赖 `vitest`。
  - 部分测试依赖当前 Node 环境没有的 `mock.module`。
  - 少数旧断言与当前行为不一致。

这些问题应单独进入测试债务清理阶段，不应阻塞本轮可靠性 baseline。

## 2. 后续可维护性 refactor 推荐顺序

### Phase A：测试债务分层

目的：让“稳定单元测试”和“需要外部依赖/特殊 runner 的测试”边界清楚。

当前已落地：

- 根级入口：
  - `npm run test`
  - `npm run test:unit`
  - `npm run test:vitest`
  - `npm run test:integration`
  - `npm run test:all`
  - `npm run test:debt`
- `@neuro/ai-gateway-domain`：
  - `test`：稳定 Node runner 单元测试集合。
  - `test:vitest`：已确认可稳定运行的 Vitest 子集。
  - `test:integration`：需要 `AI_GATEWAY_INTEGRATION_TESTS=1`、`DATABASE_URL`、`REDIS_URL` 才执行；默认显式 skip，避免本地/CI 无依赖时挂住。
  - `test:debt`：保留仍需清理的历史测试债务，当前包括旧 Vitest 断言漂移和 Node experimental module mock 重复注册问题。

建议动作：

1. 给每个 workspace 增加明确分层：
   - `test`
   - `test:integration`
   - `test:vitest`
   - `test:all`
2. 将需要 DB / Redis / env 的测试从默认 `test` 移出，或补默认 test env fixture。
3. 将 Vitest 测试迁移到 Node runner，或正式引入 workspace-local Vitest script。
4. 修正旧断言漂移后，再把更多测试纳入默认 `test`。

完成标准：

- `npm run test` 稳定通过。
- `npm run test:all` 如果失败，失败原因必须是明确的外部依赖缺失，而不是 runner 误配。
- CI 能区分 unit failure、integration dependency missing、runner missing。

### Phase B：Web `platform-actions` 拆分

目的：降低 Web server actions 的单文件认知负担，避免 account / gateway / tea / agent execution 逻辑互相耦合。

当前已落地：

- `web/src/lib/platform-action-utils.ts`
  - 抽出跨 action 复用的 redirect、query、表单值解析和错误消息工具。
  - 新增 `setRedirectTargetQueryParams(...)`，供拆出的 task/agent 等 domain action 复用。
- `web/src/lib/platform-commerce-actions.ts`
  - 承载商品、订单、优惠码、CSV 预览/导入、市场挂牌/购买相关 server actions。
- `web/src/lib/platform-opinion-actions.ts`
  - 承载议题、投票、讨论、审核、月度候补池结算及批量排除/恢复相关 server actions。
- `web/src/lib/platform-task-actions.ts`
  - 承载任务发布/申请/派发、Agent 提案、开发排期状态和任务生命周期相关 server actions。
- `web/src/lib/platform-managed-agent-actions.ts`
  - 承载 Agent 创建、managed light/cloud/heavy 保存、批量启停/删除、批量 JSON 导入和能力添加相关 server actions。
- `web/src/lib/platform-account-economy-actions.ts`
  - 承载兑换码、邮箱附件领取、任务奖励领取和曜石兑换米拉相关 server actions。
- `web/src/lib/platform-fulfillment-actions.ts`
  - 承载履约单元问题上报、手动对账、人工复核认领/释放/派单、SLA 自动分派和履约异常升级相关 server actions。
- `web/src/lib/platform-outbox-actions.ts`
  - 承载 outbox 单事件重放、dead-letter 批量重放和主动告警派发相关 server actions。
- `web/src/lib/platform-agent-marketplace-actions.ts`
  - 承载 Agent 供给保存/状态更新、自动提案扫描、单供给直调和批量直调相关 server actions。
- `web/src/lib/platform-agent-callback-actions.ts`
  - 承载 Agent 回调补救策略、回调密钥轮换和回调协议版本相关 server actions。
- `web/src/lib/platform-agent-callback-remediation-actions.ts`
  - 承载 rejected callback retry、retry request 批量记录、stored payload replay、callback auto-remediation、callback compatibility cleanup、callback remediation alert 和 runtime pressure alert 相关 server actions。
- `web/src/lib/platform-owner-relief-actions.ts`
  - 承载 owner relief handoff default、handoff 打开、handoff 结案、owner relief run 结案和复开相关 server actions。
- `web/src/lib/platform-agent-callback-ops-action-utils.ts`
  - 承载 `/ops/agent-callbacks` follow-up 参数读取、redirect 构造和 owner relief 表单解析 helper，供剩余 callback/runtime actions 与拆出模块共享。
- `web/src/lib/platform-agent-execution-support-actions.ts`
  - 承载 arbitration review 推进、execution subtask/status/requeue 和 execution artifact 提交相关 server actions。
- `web/src/lib/platform-agent-execution-preset-actions.ts`
  - 承载 Agent execution launch preset 保存、默认 preset 切换、建议 runtime profile 应用和 preset 删除相关 server actions。
- `web/src/lib/platform-agent-execution-create-actions.ts`
  - 承载 Agent execution 创建和 execution callback remediation policy override 更新相关 server actions。
- `web/src/lib/platform-agent-execution-action-utils.ts`
  - 承载 `/agent-executions` redirect target 与 focus fragment 构造 helper，供拆出的 execution create 与 preset actions 共享。
- `web/src/lib/platform-agent-execution-runtime-actions.ts`
  - 承载 stale platform execution recovery、executor 手动推进、execution settlement retry、runtime session sweep 和 recover-then-run 组合 playbook 相关 server actions。
- `web/src/lib/platform-agent-execution-runtime-action-utils.ts`
  - 承载 runtime pressure / scheduling decision 兼容值归一 helper，供 runtime action 模块与剩余 callback remediation actions 共享。
- `web/src/lib/platform-notification-webhook-incident-actions.ts`
  - 承载 notification webhook incident acknowledge/silence/clear-silence、批量治理、saved view playbook 和 saved view CRUD/default 相关 server actions。
- `web/src/lib/platform-actions-boundary.test.ts`
  - 固化 domain action 文件必须以 `"use server";` 开头。
  - 固化旧 `platform-actions.ts` 入口只保留薄 wrapper，避免业务实现重新回流到总文件。
- `web/src/lib/platform-actions.ts`
  - 保持现有页面 import path 兼容。
  - 从约 6911 行降到 572 行。

实现约束：

- Next.js `"use server"` 文件不能使用 `export { fooAction } from "@/lib/foo-actions"` 这类 re-export；构建会报 `Only async functions are allowed to be exported in a "use server" file.`。
- 兼容旧 import path 时必须使用显式 async wrapper：
  - `import { fooAction as fooActionImpl } from "@/lib/foo-actions";`
  - `export async function fooAction(formData: FormData) { return fooActionImpl(formData); }`
- 后续每拆一个 domain，都要同步扩展 `platform-actions-boundary.test.ts`，防止 wrapper 退化为 re-export 或 domain 实现回流。

建议拆分方向：

1. 继续让 `web/src/lib/platform-actions.ts` 收敛为薄 wrapper；等所有页面调用路径迁走后再删除。
2. 按业务线继续拆入：
   - account actions
   - agent execution actions
   - gateway ops actions
   - tea actions
   - economy / wallet actions
3. 每个 actions 文件尽量只依赖对应 client：
   - `core-client`
   - `account-request`
   - `gateway-request`
4. 为拆出的每组 actions 补最小 contract tests。

完成标准：

- 单个 actions 文件不再成为多域修改热点。
- 页面调用路径能从文件名直接看出所属 domain。
- `npm run test --workspace neuroplatform-web` 通过。

### Phase C：Account API server 路由拆分

目的：让 `services/account-api/src/server.ts` 从总控文件回到 bootstrap 文件。

当前已落地：

- `services/account-api/src/notification-webhook-ops-router.ts`
  - 承载 notification webhook catalog、incident saved views、incident listing 和 acknowledge/silence/clear-silence lifecycle routes。
  - 保留原有 platform operator 鉴权、incident key 校验、saved view filter/playbook 解析与批量治理语义。
- `services/account-api/src/server-router-boundary.test.ts`
  - 固化 notification webhook ops routes 必须留在 router 模块。
  - 固化 `server.ts` 只注册 `notificationWebhookOpsRouter`，不重新承载 notification webhook route path。
- `services/account-api/src/server.ts`
  - notification webhook 业务 route 已移出。
  - 当前约 113 行，只保留 Fastify bootstrap、基础 plugin、health/ready、domain router 注册和 error handler。

建议拆分方向：

1. 抽出 notification webhook ops router：
   - catalog
   - incidents
   - saved views
   - batch lifecycle actions
2. `server.ts` 只负责：
   - Fastify 创建
   - plugin 注册
   - health / ready
   - router 汇总
   - error handler
3. router 文件只暴露 `async function xxxRouter(app)`。

完成标准：

- `server.ts` 不再承载业务分支。
- notification webhook 相关测试可以只构建该 router 的 Fastify test app。
- `npm run test --workspace @neuro/account-api` 与 `npm run typecheck --workspace @neuro/account-api` 通过。

### Phase D：Core server bootstrap 可测试化

目的：降低 Core 路由测试对 DB / Redis seed 的隐式依赖。

当前已落地：

- `core/src/server.ts`
  - `buildServer(options)` 支持注入 `initializePlatform`、`readyCheck` 和 `registerDomainRouters`。
  - 抽出 `registerCoreHealthRoutes(...)`、`registerCoreDomainRouters(...)`、`registerCoreErrorHandler(...)`。
  - 默认生产路径仍执行 feature module / public surface seed、ready DB/Redis probe 和全部 domain router 注册。
  - 测试路径可用 `initializePlatform: false`、`registerDomainRouters: false` 和 fake `readyCheck` 构建只含基础 HTTP 行为的 Fastify app。
  - DB / Redis / seed services / domain routers 改为默认路径动态 import，避免仅 import `server.ts` 就触发 Redis 连接或 DB env/connection side effect。
- `core/src/server-bootstrap.test.ts`
  - 固化 Core bootstrap 可以在无 DB/Redis 初始化下测试 health、ready 和 error handler。
  - 固化注入的 platform initializer 只执行一次。
- `core/package.json`
  - 将 bootstrap 边界测试纳入 `@neuro/core` 默认稳定测试入口。

建议动作：

1. 将 `buildServer()` 改成可注入初始化策略：
   - 默认生产路径执行 `ensureFeatureModules()` / `ensurePublicSurfaceSnapshot()`。
   - 测试路径可关闭或替换初始化。
2. 将 health / ready 与业务 router 注册拆成独立函数。
3. 对 error handler / CORS / internal auth 建 Fastify inject 测试。

完成标准：

- Core server 层测试不需要真实 DB / Redis。
- DB / Redis ready 检查留在 integration/smoke 层。
- `npm run test --workspace @neuro/core` 通过。

### Phase E：HTTP 基础设施统一

目的：消除 Core 与 backend-foundation 之间的重复 helper。

当前状态：

- Core 有本地 `core/src/platform/http-server.ts`。
- Account API 通过 `@neuro/backend-foundation/platform/http-server` 使用 shared helper。

建议顺序：

1. 先梳理 Core 是否可以依赖 `@neuro/backend-foundation` 的 platform helper，而不引入 DB / Redis side effects。
2. 如果不能，拆一个更小的无副作用包，例如 `@neuro/platform-http-foundation`。
3. 迁移 Core / Account API 到同一个 helper。
4. 移除重复实现。

完成标准：

- CORS allowlist 与 error serialization 只有一个实现来源。
- deep import 兼容层仍可工作，或给出明确迁移窗口。

### Phase F：运行时可观测性补齐

目的：让可靠性 baseline 变成 operator-visible 状态，而不是只存在于日志。

建议增加：

1. Internal request：
   - timeout count
   - retry count
   - network error count
   - target service label：core / account / gateway
2. Account worker outbox recovery：
   - recovered count
   - dead-lettered count
   - last recovery time
3. CORS：
   - rejected origin debug count
   - current allowlist debug endpoint，仅限 operator/internal。

完成标准：

- 运维页面能解释“为什么页面不可用”：目标服务离线、超时、5xx、鉴权、CORS 配置。
- worker 页面能解释“是否发生过 stale processing 恢复”。

## 3. 推荐执行纪律

每个后续 phase 独立提交，并满足：

1. 先写或移动测试，再改实现。
2. 不把 provider 功能完成度混入 Platform 基础设施 refactor。
3. 不在同一提交里同时改运行时行为和大规模文件移动。
4. 每个 phase 至少验证：
   - 受影响 workspace 的 `npm run test --workspace ...`
   - 受影响 workspace 的 `npm run typecheck --workspace ...`
   - 根级 `npm run test`，除非明确只改文档。
