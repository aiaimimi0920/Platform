# Platform 产品完成与验收基线

状态：`正式 canonical 规格，用户已于 2026-07-18 书面确认`。

## 目的

本文固定 `Platform` 从当前可构建 beta 收口为可验收产品的正式范围、架构原则、完成标准和证据要求。

本文适用于：

- `web`
- `core`
- `services/account-api`
- `services/account-worker`
- `worker`
- `executor`
- `packages/*`
- `deploy`
- `infra`
- Platform release 交付面

## 当前实施快照（2026-08-10）

Phase 0-5 已完成，Phase 6 已完成 `P6-01` 至 `P6-03`。fresh run `.runtime/acceptance/platform-round16-640f77d/acceptance-manifest.json` 对应 clean revision `640f77dddedf5b5773db5cdb81b65b376fc134c7`：required 为 `14/14` 全部通过且无 skip，external-boundary 为 `3 passed + 1 evidence-backed not-applicable`，Owner、Visitor、Operator 与 dependency-error 浏览器套件全部通过。同日 conditional-live run 将 Linux.do、Gateway、Loom、Tea 分类为有 preflight 证据的 `external-blocked`，Hook 分类为 `not-applicable`。immutable `V0.1.0` 已从较早 clean revision `3d2f653663eb4796362ffa278eafd74df308ec7d` 构建并通过 artifact-only runtime smoke；后续 P6-04 review 已修复 release evidence link escape、public-surface fail-open 与 arbitrary-dispatch GHCR 写路径，并建立 P2 register。由于这些当前源码更新尚未生成新版本 release，且最终 fresh P0/P1 复核与 signoff 未完成，当前 canonical 结论仍为 `Platform 产品未完成`。

## 1. 正式范围

本轮采用 Platform 生产验收基线：

- 开发代码只允许写入 `C:\Users\Public\nas_home\AI\GameEditor\Neuro\Platform`。
- Gateway、Loom、Tea、Hook 作为外部依赖，可以调用和验证，但不在本轮修改。
- release 产物只允许写入 `C:\Users\Public\nas_home\AI\GameEditor\Neuro\release\Platform`。
- 真实外部供应商、Linux.do 正式 OAuth 或第三方额度不足允许形成有证据的外部阻塞，不得伪造成功。

### 1.1 对话级执行边界

- 新增验收、打包、证据归档和部署校验脚本必须位于 `Platform/scripts/` 或 `Platform/deploy/`。
- 本轮不得修改仓库根级 `.github/`、`scripts/` 或其他子项目来完成 Platform 门禁。
- Platform 必须通过自身 `package.json` 暴露稳定命令，使现有根级 CI 或后续编排者只需调用 Platform 命令，不需要复制内部步骤。
- 现有根级 Platform workflow 已调用 `npm run smoke`。Phase 1 必须把 `smoke` 冻结为严格的 `acceptance:ci` 桥接入口，并把原轻量检查迁到 `smoke:quick`；这样无需修改根级 workflow，也不能在正式验收失败时保持 CI 假绿。
- 根级 workflow 的 artifact upload 接线属于仓库级编排，不在本轮写入边界；Platform 仍必须在确定路径生成可直接上传的完整验收目录和机器可读 manifest，CI 是否上传不改变门禁退出码。
- 隔离验收不得从 `../Gateway`、`../Loom`、`../Tea`、`../Hook` 源码执行 `build:`，不得 bind mount 兄弟项目，也不得依赖兄弟项目当前 dirty worktree。
- 外部依赖只允许通过固定 digest 的 OCI image、明确的外部 URL，或 `Platform/` 内受控 test double 接入。

### 1.2 验收结论分层

验收结果固定分为三层，禁止混写为一个“全绿”：

1. `required`：Platform 自有 unit、service/router、真实数据层 integration、OAuth contract、受控 Gateway provider、浏览器旅程和 release smoke。必须全部执行并通过，任何 skip 都失败。
2. `external-boundary`：通过 Platform 内 contract harness、固定外部测试端点或可控 test double，证明出站请求到达正确边界，并正确处理成功、拒绝、超时和不可用；请求 id、时间、目标类别、状态码和脱敏错误必须留证。此层由 `acceptance:ci` 独立发现、计数和归档，必须通过。
3. `conditional-live`：Linux.do 正式登录、真实 Gateway provider/额度、Tea/Loom live 服务。缺少账号、额度、回调域名或第三方可用性时只能标记 `external-blocked` 或 `not-run`，不得标记 pass。

`required + external-boundary` 全部通过、Platform 内部 P0/P1 清零时，允许结论为“Platform 产品完成，可验收；外部 live 条件待签收”。只有 `conditional-live` 也通过时，才允许结论为“端到端生产依赖已签收”。

`conditional-live` 状态规则：

- `passed`：当天真实调用成功，证据完整。
- `external-blocked`：已执行 preflight 或真实调用，并有证据证明阻塞属于第三方账号、额度、回调域名、网络或服务状态。
- `failed`：调用已执行但尚未完成归因，或已证明是 Platform 合同/处理缺陷；阻断产品完成，后者必须转入内部 P0/P1。
- `not-run`：没有执行且没有 external blocker 证据；阻断产品完成。已证明当前版本不存在对应调用面的项目使用 `not-applicable`，并附 source inventory，不使用 `not-run`。

Hook 当前是相邻外部 owner，但 Platform 没有正式运行时调用点。`acceptance:ci` 必须用 source/dependency inventory 证明这一事实，并把 Hook 记录为 `not-applicable`；若以后出现 Platform-owned Hook 调用点，必须同时增加 required contract、external-boundary 和 conditional-live 项目。

本轮不把下面事项定义为 Platform 内部完成条件：

- 修改 Rust Gateway provider runtime。
- 修改 Loom、Tea 或 Hook 源码。
- 通过前端 seed、定时器、假回包或静默空数组替代真实业务结果。
- 为了显示绿灯而绕过正常身份、路由、账本、任务、Agent 或 Gateway 链路。

## 2. 产品完成定义

Platform 只有同时满足下面条件，才允许标记为产品完成。

### 2.1 产品表面

- Owner、Visitor、Operator 三类视图边界清楚。
- 核心入口均可直接完成其声明的主要任务。
- 正式启用的页面不得停留在说明性占位、演示目录或本地假数据。
- 依赖故障必须显示明确的 unavailable/error state，不能伪装成正常空业务状态。
- 所有成功提示必须对应真实写入、真实调度或可查询的持久化结果。

### 2.2 业务闭环

必须具备并通过 `required` fixture/contract 验证；涉及第三方 live 的部分再按 1.2 单独记录：

- 身份与账户创建、再次登录同步和权限边界。
- 钱包账本的 grant、deduct、freeze、unfreeze、托管和结算不变量。
- 商品、订单、item、权益、兑换和回滚链路。
- 任务发布、申请、分配、执行、提交、验收、违约和取消链路。
- Agent 注册、能力、供给、执行、回调与治理链路。
- 项目、赞助、加入、公开展示和用户关系链路。
- 邮箱、附件、真实邮箱入口和投递链路。
- 信誉、议题、人工复核、仲裁和补救链路。
- Tea 工单从创建到关闭及证据导出链路。
- Gateway 控制面在依赖可用和不可用时都能给出真实状态。

### 2.3 工程与交付

- 所有 `required` 测试、Vitest、历史债务测试和真实集成测试全部通过且没有 skip。
- 隔离 Compose 可以与现有本机实例并存，不读取或写回宿主真实凭证。
- Web、Core、Account API、Workers、Executor 都具有正确 readiness 语义。
- 浏览器验收覆盖 Owner、Visitor、Operator 的桌面与移动视口。
- release 能明确描述并验证 Web、后端运行单元、migration 和部署清单。
- 没有已知 P0/P1 缺陷；剩余 P2 必须写明边界和不阻塞理由。

### 2.4 严重度规则

- `P0`：核心旅程不可完成、存在假成功/数据损坏/凭证泄露风险，或 release 无法从空环境启动。P0 阻止任何产品完成结论。
- `P1`：主要功能不完整、故障被误报为空或成功、关键权限/事务/可观测性缺失，或验收结果不可重复。P1 阻止产品完成结论。
- `P2`：不影响核心正确性和交付的局部体验、维护性或低风险运维问题。必须记录 owner、边界和不阻塞理由。
- 每个缺陷只能有一个当前严重度；第三方账号、额度、网络和服务状态归 `external-blocked`，不得混入 P0/P1/P2。

## 3. 实施起点的 P0 与持续回归约束

### 3.1 重度智能体历史缺口与当前闭环

实施起点的 `/chat` 曾使用客户端 seed 数据、React 内存状态和定时器生成模板回复，线程、消息、收藏、项目绑定、重试、转任务和投递邮箱没有形成真实服务端闭环。

Phase 2 已完成重度对话领域持久化、`managed_heavy` 服务、Gateway execution、Web 状态恢复以及 task/mailbox 动作；fresh required/browser matrix 已通过。下面的约束继续作为防回归基线，而不是未实现清单：

持续约束：

- 新增独立的 Platform 重度对话领域模块，不把逻辑重新堆入现有超大 Agent 文件。
- 以 `slot / project / thread / message` 为最小持久化层级。
- 默认觅觅 slot 在首次访问时幂等创建。
- 自创建重度 slot 受账户权益和槽位上限约束。
- 用户消息先持久化，再通过受控 Platform 服务调用 Gateway。
- assistant 消息必须有 `pending / streaming / complete / failed` 状态。
- 重试使用幂等键，不重复创建用户消息或重复扣费。
- 转任务必须创建真实任务草稿或任务记录。
- 投递邮箱必须创建真实站内邮件草稿或投递记录。
- 页面刷新后必须恢复同一用户的真实线程和消息。

### 3.2 隔离验收栈历史缺口与当前结果

实施起点的 Compose 曾使用固定宿主端口、默认 compose project、固定本地 secret，并挂载宿主 `${USERPROFILE}/.neuro`。当前 acceptance runner 已使用唯一 project、loopback 动态端口、run-owned volume/secret/credential root 和 owner-aware cleanup；fresh Compose startup 与浏览器矩阵均通过。

持续约束：

- 所有宿主端口参数化并默认绑定 `127.0.0.1`。
- 验收 wrapper 必须要求非空、唯一的 compose project id。
- 每次验收使用独立 volume、临时 secret 和临时凭证目录。
- 验收栈不得挂载宿主真实 `.neuro`。
- 验收栈不得构建或挂载兄弟项目源码；Gateway/Loom/Tea/Hook 使用固定 image digest、明确 URL 或 Platform 内 test double。
- cleanup 只能删除本次 project 创建的容器、网络、volume 和临时目录；执行前必须验证 owner/env 全部资源元数据。Docker Engine 短暂返回 timeout/5xx/daemon-unavailable 时，只允许以有限退避重试同一个已验证 project 的同一条 `down --volumes --remove-orphans`，不得扩大 label、project 或目录范围；非瞬态 Compose contract 错误不重试。
- 依赖必须按 `service_healthy` 启动，不以进程已启动替代 ready。
- 浏览器矩阵结束后、cleanup 之前必须再次记录该 project 的 `compose ps --all` 结果，以区分产品 journey 失败、容器退出和 Docker Engine 诊断失败。

### 3.3 生产部署清单与 release artifact 对齐

`P5-01` 已移除 Kubernetes 清单中的 `ghcr.io/example/*:latest`、`example.com`、示例对象存储地址，并补齐 staging / production namespace + namePrefix、digest replacement、migration Job、Gateway secret contract、namespace-scoped account-edge RBAC 与 deploy helper gates。

`P5-03` / `P5-04` 已完成首个 immutable `V0.1.0` 的实际 OCI digest 替换、complete release 组装和 artifact-only smoke。后续版本仍必须保持：

- 用真实 release artifact digest 替换 overlay 中的 release-contract seed digest。
- `acceptance:release` 只接受 OCI/digest 输入，不得从源码 bind/build context 启动。
- deploy helper 的 render、placeholder gate、migration wait、rollout status 和 smoke 结果需要被 release evidence 记录。
- 已发布版本不可覆盖；当前源码晚于 `V0.1.0` 时必须使用新 version id 生成并验证新 release。

### 3.4 完整 Platform release 的当前结果与持续要求

当前 `release/Platform/V0.1.0` 已包含六个 `linux/amd64` OCI layout、三域 migration、Web package、部署/环境合同、脱敏 evidence、依赖清单和完整 checksum，并已通过 artifact-only runtime smoke。该 release 只证明其固定 source revision，不自动覆盖后续源码提交。

每个正式 release 仍至少必须包含：

- 当前 Git identity 和 dirty 状态。
- Platform Web 包及 checksum。
- 后端各运行单元的 OCI layout，或可解析且固定到 digest 的 image manifest。
- 数据库 migration 清单和执行顺序。
- Compose/K8s 部署 bundle。
- 环境变量契约和脱敏示例。
- SBOM 或依赖清单。
- build、integration、browser smoke 和 release runtime smoke 证据。

release 默认不得向外部 registry 推送镜像。无发布授权时，打包器必须在 `release/Platform/<versionId>/oci/` 生成可离线读取的 OCI layout；若显式提供已发布 digest，则 manifest 必须同时保存 registry、repository、digest 和验证时间。release smoke 只能使用 release 目录中的 bundle/OCI 或固定 digest 启动，不得引用源码 bind mount、兄弟项目源码或源码 build context。

## 4. P1 产品真实性规则

### 4.1 禁止假成功

下列行为必须对应真实副作用：

- 发送消息。
- 重试消息。
- 转为任务。
- 投递邮箱。
- 创建、启用、停用或删除重度 Agent。
- 赞助或加入项目。
- 购买、兑换、领取或回滚权益。

若副作用失败，页面必须保留可重试的失败状态，不得只显示成功通知。

### 4.2 禁止假空数据

核心产品和 Operator 页面不得把 dependency timeout、HTTP 5xx、鉴权错误或协议错误统一转换为 `[]`、`null` 或 demo catalog。

页面状态至少区分：

- loading
- ready with data
- ready empty
- dependency unavailable
- unauthorized/forbidden
- partial data
- retrying

Operator 页面还必须保留目标服务、错误分类、时间和 correlation id；不得泄露 secret 或原始认证材料。

### 4.3 正式入口不能是说明页

`/mailbox`、`/benefits`、`/my-arbitrations` 等正式入口必须直接提供对应的用户工作面，或进行无损、可预期的产品内跳转。不得要求用户返回另一个页面后重新点击弹层。

## 5. 安全与运行时基线

### 5.1 Dev Auth

- `NODE_ENV=production` 时必须硬禁用 `DEV_AUTH_BYPASS_ENABLED`。
- 若生产环境显式开启 bypass，服务必须拒绝启动或强制关闭并记录高优先级错误。
- 本地验收用户可以是 Operator，但身份必须只存在于隔离环境。

### 5.2 Readiness

- `/health` 表示进程存活。
- `/ready` 表示依赖可用且服务可以安全接收工作。
- Worker 在从未完成成功 cycle、数据库/Valkey 断开或持续失败时，`/ready` 必须返回非 2xx。
- Web readiness 不替代 Core、Account API、Gateway 和数据层 readiness。

### 5.3 Secret 与本地材料

- release、日志、测试证据和浏览器截图不得包含 token、cookie、API key 或真实邮箱验证码。
- 验收 fixture 使用独立临时材料，不读取宿主真实凭证库。
- K8s RBAC 只授予运行单元实际需要的最小权限。

## 6. 测试与验收总线

### 6.1 测试层级

正式测试层级固定为：

1. unit：纯函数、状态机、验证和序列化。
2. service/router：权限、错误、幂等和模块开关。
3. integration：真实 PostgreSQL、Valkey 和对象存储。
4. component：Web 数据状态、表单和错误态。
5. browser E2E：真实 Next.js、HTTP 服务和浏览器交互。
6. release smoke：从 release 产物启动，不依赖源码目录。

### 6.2 必须进入门禁的测试

Platform 内正式门禁入口固定为：

- `npm run smoke`：现有官方 CI 桥接入口，必须调用 `acceptance:ci`；不得继续只执行轻量 smoke。
- `npm run smoke:quick`：保留原有开发期轻量测试和文档/结构 smoke，不产生产品完成结论。
- `npm run acceptance:ci -- --run-id <run-id> --evidence-dir <dir>`：执行全部 `required` 和 `external-boundary`，包括 typecheck、build、Compose render/isolated startup 和 Owner/Visitor/Operator Playwright。
- `npm run acceptance:live -- --run-id <run-id> --evidence-dir <dir>`：执行 `conditional-live` 探测；逐项输出 `passed / external-blocked / failed / not-run / not-applicable`，不得改变 required/external-boundary 的原始结果。
- `npm run release:build -- --version-id <version-id> --output-root <release-root> --acceptance-manifest <manifest>`：从当前源码生成完整 Platform release；本对话的 `<release-root>` 必须解析到 `C:\Users\Public\nas_home\AI\GameEditor\Neuro\release\Platform`。
- `npm run acceptance:release -- --package-dir <release-dir> --run-id <run-id> --evidence-path <file>`：从已生成 release 启动并执行 verify/runtime smoke，不得使用源码目录。

`run-id` 必须唯一，并同时作为 Compose project owner、临时目录 owner 和 cleanup 校验键。若 `acceptance:ci/live` 未显式传入参数，runner 必须生成 run id，写入 `Platform/.runtime/acceptance/<run-id>/`，并原子更新 `Platform/.runtime/acceptance/latest.json` 指向本次 `acceptance-manifest.json`。显式传入 `--evidence-dir` 时，manifest 固定为 `<dir>/acceptance-manifest.json`。

`release:build` 必须校验输入 acceptance manifest 属于当前 Git identity、required/external-boundary 全绿且没有 secret，再生成 `<release-root>/<version-id>/release-manifest.json`。最终 release 只复制脱敏证据到 `<release-dir>/evidence/`。`acceptance:release` 的 `<package-dir>` 是只读输入，`<evidence-path>` 是 smoke 结果输出；二者不得混用。

`acceptance:ci` 必须包含：

- `npm run test`
- `npm run test:vitest`
- `npm run test:debt`
- 真实执行且不允许 skip 的 integration suite
- `npm run typecheck -ws --if-present`
- `npm run build`
- Compose render 与 isolated startup
- Owner/Visitor/Operator Playwright suite

验收 runner 必须输出机器可读 manifest，分别为 `required`、`external-boundary` 和 `conditional-live` 记录 `discovered / executed / passed / failed / skipped / externalBlocked / notApplicable` 数量、开始结束时间、命令、退出码和 evidence path。任何 required/external-boundary suite 出现 `skipped > 0`、`executed < discovered`、缺少计数或子命令非零退出时，统一返回非零。旧 `test:all` 可以保留为开发快捷命令，但不得再作为产品验收结论来源。

P1-04 开始时冻结的历史债务 RED 基线为 `npm run test:debt`：

- `credential-failover.test.ts`：14 项中 1 项失败，`should round-robin across credentials`。
- `credential-refresh.test.ts`：19 项中 3 项失败，分别为 expiration check、registered refresher refresh、refresh 前验证。
- `thinking-filter.test.ts`：20 项中 5 项失败，分别为完整块、跨 chunk 起始、跨 chunk 结束、尾随空白、thinking 后 tool use。
- 起始合计为 `44 passed / 9 failed / 53 total`；这是 P1-04 的 RED 起始证据，不是当前测试状态。`test:node-mock:debt` 当时因前置 Vitest 失败尚未执行，P1-04 已将两组 debt 拆开纳入门禁。
- P1-04 修复后的当前 debt 证据为 Vitest `55/55` passed、Node module-mock `56/56` passed；runtime5 对应输出保留在 `.runtime/acceptance/platform-acceptance-p104-runtime5/suites/debt-vitest.json.stdout.log` 和 `debt-node-mock.json.stdout.log`。

上述测试不得通过删除、改名、移出脚本或降低断言来获得绿灯；应先判断实现缺陷还是过期契约，再以独立测试证据修复。

### 6.2.1 P1-04 真实运行结果

最终有效 run 为 `.runtime/acceptance/platform-acceptance-p104-runtime5/`，机器可读 manifest 为 `.runtime/acceptance/platform-acceptance-p104-runtime5/acceptance-manifest.json`。required 层发现并执行 14 项，9 项通过、5 项失败、0 项跳过；失败项为 `integration-required`（required 模式禁止 gate skip，需真实 integration 环境）以及尚未实现的 `browser-owner`、`browser-visitor`、`browser-operator`、`browser-errors`。external-boundary 层发现并执行 4 项，Gateway/Loom/Tea 通过，Hook inventory 为 `not-applicable`，无失败项。runtime5 Git metadata 为已提交 P1-04 commit `77831496c3baa886d9f08ac804b92268f58000f6`、Platform `dirty: true`（仅有 P2-01 未提交文件）。

Compose render/startup 均 exit `0`，startup 运行服务均为 healthy；`.runtime/acceptance/platform-acceptance-p104-runtime5/compose/startup/compose-cleanup.json` 和 `compose/render/compose-cleanup.json` 是 owner cleanup receipt，均记录 `cleaned: true`。cleanup 后本次验收 project 的容器、网络和 volume 均为 `0`，临时 `resources/` 已删除。该证据证明验收栈隔离与清理成立，不证明产品功能或 release 已验收通过。

因此 P1-04 的正确结论是“验收基础设施完成、产品验收未通过”；在 required 失败清零、浏览器旅程实现、Phase 2-6 完成并通过 release smoke 之前，最终状态仍必须写作 `Platform 产品未完成`。

### 6.3 浏览器旅程

最小具名旅程固定为：

| ID | 角色与路由 | 核心动作 | 必须证明的副作用/错误态 | 视口 |
| --- | --- | --- | --- | --- |
| `O-AUTH` | Owner `/login -> /dashboard` | 首次登录、再次登录、退出、未授权访问 | OAuth state/callback/account-linking contract；同一账户幂等同步；越权返回明确 401/403 | desktop + mobile |
| `O-COMMERCE` | Owner `/wallet`, `/products`, `/marketplace`, `/benefits`, `/redeem`, `/inventory` | 查看余额、购买/兑换/领取、失败重试 | 订单、item、benefit grant 和 ledger 行可从 API/DB 查询；依赖故障显示 unavailable，不显示假空/假成功 | desktop + mobile |
| `O-TASK` | Owner `/tasks`, `/my-tasks` | 发布、申请/撮合、提交、验收、取消或违约 | task 状态机、托管/结算账本和幂等键可查询；失败不重复扣款 | desktop |
| `O-AGENT-CHAT` | Owner `/agents?role=heavy`, `/chat` | 默认 slot、项目/线程、发送、失败重试、刷新恢复、转任务、投递邮箱 | slot/project/thread/message 持久化；受控 provider 请求；task/mailbox 记录真实存在；重试不重复消息/扣费 | desktop + mobile |
| `O-PROJECT-GOV` | Owner `/projects`, `/mailbox`, `/my-arbitrations`, `/opinions` | 加入/赞助、查看邮件、提交/补充仲裁、参与议题 | 关系、赞助、邮件、案件/证据和投票记录可查询；无说明性占位或无损信息丢失的跳转 | desktop |
| `V-PUBLIC` | Visitor `/u/:username` | 查看公开档案、公开 Agent、公开项目 | 响应和 DOM 不包含钱包、邮箱、订单、凭证或私有成长分项；私有资源返回 404/403 | desktop + mobile |
| `OP-CONTROL` | Operator `/ops/products`, `/ops/account/*`, `/ops/gateway/*`, `/arbitrations` | 管理商品/权益/用户/Agent/仲裁，检查依赖与 Gateway | 写操作持久化且有审计线索；依赖错误包含服务、分类、时间和 correlation id；不泄露 secret | desktop + mobile smoke |
| `ERR-DEPENDENCY` | Owner + Operator 代表页 | 注入 Core/Account/Gateway timeout、5xx、401/403 | 明确区分 empty、partial、unavailable、unauthorized；页面可重试且不产生成功 toast | desktop |

浏览器通过条件不能只看页面可见或 toast。每条写旅程必须在动作后读取 API 或数据库证据，并在刷新/重新登录后确认持久化。生产 OAuth 的 callback/state/account-linking 使用必跑 contract fixture；Linux.do live 登录单列 `conditional-live`。Gateway 使用受控 fake provider 验证计费、持久化、stream/error/retry；真实 provider 额度单列 `conditional-live`。

## 7. 实施阶段

实施顺序固定为：

1. 验收基础设施：真实门禁、隔离 Compose、临时凭证和 readiness。
2. 重度智能体：持久化领域、Gateway 调用、真实消息和真实动作。
3. 产品真实性：移除 demo fallback、假成功和假空状态，补正式入口。
4. 核心领域覆盖：身份、钱包、商品、任务、Agent、邮箱、治理和 executor。
5. 安全与可观测性：Dev Auth、dependency errors、correlation、metrics。
6. 部署与发布：正式 K8s/Tofu contract、完整 release manifest 和可由 CI 直接上传的 evidence artifact。
7. 最终验收：全量测试、全栈、浏览器、release runtime 和 P0/P1 清零。

每阶段必须遵循：

- 先写失败测试。
- 再写最小实现。
- 受影响 workspace 测试和 typecheck 通过。
- 当前阶段要求的 Platform-local acceptance 门禁通过。
- 同轮更新 canonical 文档和进度记录。
- 独立提交，不夹带其他子项目改动。

## 8. 最终签收条件

只有同时满足下面条件，才能通知产品完成：

- 所有阶段任务已完成。
- 所有 `required` 与 `external-boundary` 测试真实执行并通过。
- 没有 skip 被误报为 pass。
- Owner、Visitor、Operator 浏览器旅程通过。
- 隔离 Compose 可重复启动和清理。
- release 从当前源码生成并通过独立运行 smoke。
- release 位于 `release\Platform\<versionId>`。
- Platform Git 工作区没有意外修改。
- P0/P1 缺陷为零。
- 剩余 P2 已进入 register，并记录 owner、边界、不阻塞理由和后续处理条件。
- `conditional-live` 必须逐项显示 `passed / external-blocked / failed / not-run / not-applicable`，不得并入 required/external-boundary pass。
- 外部阻塞均有当天证据、清晰归因和不伪造成功的降级行为。

最终结论只能使用以下之一：

- `Platform 产品未完成`：任一 required/external-boundary 失败、内部 P0/P1 未清零、release smoke 失败，或 conditional-live 存在 `failed`/无 blocker 证据的 `not-run`。
- `Platform 产品完成，可验收；外部 live 条件待签收`：required/external-boundary 全绿，内部 P0/P1 清零，但存在有证据的 conditional-live external blocker。
- `Platform 产品完成，端到端生产依赖已签收`：required/external-boundary 全绿，所有适用 conditional-live 均为 `passed`，仅允许有 source inventory 证明的 `not-applicable`。
