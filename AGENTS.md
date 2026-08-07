# Project Rules

Scope: this repository root and all subdirectories, excluding the external `AIRead/` repository.

## Repository Architecture

- This directory is the canonical checkout of the independent Platform repository:
  - `https://github.com/aiaimimi0920/Platform`
- In the top-level Neuro workspace, it is mounted at `Platform/` as a Git submodule.
- Platform repository automation is owned here under `.github/workflows/`; do not move Platform CI or image publication back into the parent repository.
- Parent-level release orchestration may call Platform-owned scripts, but the standalone Platform checkout must keep its own CI, package, verification, and release entrypoints working.
- Local integrated compose may use sibling `Gateway/`, `Loom/`, and `Tea/` checkouts. Single-repository CI must use Platform-local validation or the acceptance doubles unless it explicitly checks out those sibling repositories.
- Never place repository credentials, GitHub tokens, provider credentials, or real environment files in Git remotes, workflow YAML, examples, fixtures, or release evidence.
- Production Dockerfiles must keep the Node base image pinned by digest through `NODE_IMAGE`; an image refresh requires all six Platform image builds to pass.
- Version-tag releases must pass `npm run ci` and `npm run test:integration:required` before packaging. Regular CI must retain the AI Gateway Vitest gate.
- Production deployments must use immutable GHCR `sha-*` tags or digests, inject independent secrets, and retain prior digests as rollback targets. The local read-write `.neuro` Gateway mount is development-only.

## UI Default

All future UI work in this repository must use the **NeuroTerminal** (`nt-*`) industrial-terminal design system.

Design system rules and reference files:

- `design-system/stylekit-modern-gradient/RULES.md`
- `design-system/stylekit-modern-gradient/theme.css`
- `design-system/stylekit-modern-gradient/preview.html`

The design system has been unified to a single visual language: industrial terminal. The `nt-*` prefix is the official component prefix for all new work. Legacy `mg-*` and `mg-terminal-*` classes remain valid in existing code but must not be used for new development.

## Documentation Rule

- If a feature, model, workflow, rule set, or product decision needs documentation for future development, that documentation must be written into the repository as part of the implementation.
- Do not leave critical product rules, data models, or process agreements only in chat context.
- Default canonical documentation location is `docs/` unless a feature-specific location is more appropriate.
- When code and documentation both change, keep them synchronized in the same round of work.
- Architecture and deployment baseline changes must update canonical docs and this `AGENTS.md` in the same round so future AI runs inherit the new rules automatically.

## Documentation Tree Priority

- 文档优先级固定为：
  1. `AGENTS.md`
  2. `rules/`
  3. `docs/`
  4. `docs/50-history/`
- `docs/50-history/` 只承接历史 `analysis / plan / progress` 材料，不作为新的正式规则层。
- 后续新的长期开发结论默认写入 `docs/`，不要把新的 canonical 结论写进历史归档或零散说明文档。

## Repo-Local Skill Trigger

- 仓库内显式存在 repo-local reasoning skill：
  - `智能推测模板`
- 技能文件：
  - `.codex/skills/intelligent-inference-template/SKILL.md`
- 说明文档：
  - `docs/40-engineering/智能推测模板技能说明.md`
- 当用户明确提及 `智能推测模板` 时，后续 AI 运行默认应读取并遵循该技能文件，尤其适用于：
  - reverse-web / unofficial surface 推断
  - session-backed HTTP replay
  - 页面态协议 / 抓包 / live 回归驱动的逐步推理
  - “失败面不断前移直到打绿”的复杂链路

## Multi-Surface Modular Rule

- 仓库内所有“多协议 / 多 surface / 多 owner / 多 source-kind”的复杂实现，必须优先遵守：
  - `rules/多Surface模块化开发守则.md`
- Gemini 当前作为具体实例，还必须继续遵守：
  - `rules/gemini-modular-development-rule.md`
- 对 Gemini 来说，最小目录分层基线固定为：
  - `gemini/common`
  - `gemini/official_api`
  - `gemini/web_reverse`
  - `gemini/canvas_web_reverse`
- 后续类似 Qwen / ChatGPT Web Reverse / AIStudio Web Reverse / 其他多 surface 接入，也应按相同思想拆分，而不是继续把不同 owner 逻辑堆回单个大文件。

## AI Gateway Testing Rule

- AI 网关所有“支持/完成/绿灯”相关结论必须遵守：
  - `rules/AI网关多协议兼容测试守则.md`
- 该规则统一定义：
  - 测哪些内容
  - 何时可标完整绿灯 / 部分绿灯
  - 如何区分：
    - `纯协议实现`
    - `混合实现`
    - `浏览器实现`
  - 如何标记：
    - `服务商不支持`
    - `网关未实现`
    - `quota gate accepted`
  - 单服务商测试阶段如何执行：
    - 按需最小编译
    - 独立编译目录
    - 独立镜像 / 容器 / 端口
  - 若同一服务商下存在多条本质不同的实现线，则测试阶段必须按“实现线”分别独立编译
  - 当前默认测试口径：
    - 测试过程只编译当前相关功能即可
    - 不需要为了当前实现线测试额外编译或测试全部服务商
- 测试万能密钥是平台测试 access key，不是 provider 真实凭证：
  - 平台侧默认满额度、全模型、全服务商 / 全实现线可访问
  - 但仍必须走完整正常调用流程，不得绕过路由、模型目录、真实凭证换取与 provider quota
- 任何 provider / surface 若声称自己“已经完成”，都必须落一张标准结果表，并附归档证据。

## AI Gateway Credential Library Rule

- AI 网关所有“服务商真实凭证如何分库、如何分类、请求如何换取到真实凭证”的开发，必须遵守：
  - `rules/AI网关服务商凭证库分层与换取守则.md`
- 当前正式要求：
  - 每个服务商必须按实现线理解自己的凭证库
  - 同一实现线下允许多种 `credentialMaterialKind`
  - 同一逻辑凭证库下允许按套餐 / 额度 / 能力 / 模型 / 地区等因素做二级分类
  - 不同实现线可共享同一份底层认证材料，但共享材料不等于共享 execution contract
  - 共享材料默认通过 `credentialMaterialKey` 识别
- 当前请求期真实凭证换取的最小安全粒度仍然是：
  - `selected provider credential + selected model`

## Multi-AI Heavy Task Rule

- 多个 AI 对话并行工作时，必须遵守：
  - `rules/多AI重任务声明与轮询守则.md`
- 当前正式要求：
  - 同一时刻默认只允许 **1 个** 对话处于 `heavy_active`
  - 其他对话默认处于：
    - `light_readonly`
    - `light_editing`
    - `polling_wait`
  - 所有对话都可以晋升为重任务 owner，只要当前资源可用且它真正进入重执行阶段
- 当前推荐通过运行时声明文件协调：
  - `.runtime/ai-heavy-task-declaration.json`
- 当前推荐 helper：
  - `deploy/claim-heavy-task.ps1`
  - `deploy/release-heavy-task.ps1`
  - `deploy/show-heavy-task-status.ps1`
  - `deploy/invoke-heavy-task.ps1`
  - `deploy/wait-heavy-task-available.ps1`
- `heavy_active` 当前默认只适用于：
  - `cargo build/check/test`
  - `docker build / compose build`
  - browser live / Playwright / browser pool 主执行
  - full fixture / focused live / full live suite

## Local Preview Port Rule

- 当前本地 UI 预览 / 验证默认遵循：
  - `docs/40-engineering/本地预览与端口分配基线.md`
- 预览端口规则：
  - 不继续复用 `3000 / 3001`
  - 新实例从 `30000` 开始按 `+2` 递增
  - 每次测试都应返回新的完整 URL
- 默认 helper：
  - 通用预览：`deploy/start-web-preview.ps1`
  - 重建本地 `docker compose` 的 `web` 并拿到新实例：`deploy/restart-web-next-port.ps1`
- 若代码已变化，先更新 `deploy-web` 镜像，再启动新的预览端口；不要把旧端口当成“已自动同步”的事实来源。
- 本地预览里的 `Agent Center -> 羽量` 当前默认应补出一个仅用于 Web 调试的 `测试环境调试凭证`，默认模型 `ui-test-model`；它不依赖购买状态、assignment 或 gateway provider 完整配置，不得被视为生产正式凭证。
- 本地开发栈的硬依赖：
  - `account-migrate` 必须同时覆盖 `@neuro/ai-gateway-domain` 与 `@neuro/account-domain`
  - 本地预览必须包含 Rust `gateway`
  - 旧 TypeScript 网关不得重新引回本地预览、兼容 profile 或默认 helper
- 本地 Rust gateway 构建基线：
  - `Platform/deploy/docker-compose.local.yml` 的 `gateway` service 必须构建 sibling `../Gateway`，不得重新把 Rust Gateway source vendor 回 `Platform/`
  - `docker compose -f deploy/docker-compose.local.yml build gateway` 必须以 `../Gateway` 自身作为 build context
  - Gateway 镜像 / 二进制 / 发布 helper 归 `../Gateway` 或仓库根级自动化 owner；`Platform/deploy/` 只保留 Platform 预览、账户栈、调试 bootstrap 与协作 helper
  - 若某个服务商的某条实现线在开发过程中需要频繁编译并产出新的开发镜像，这本身是允许且正常的；但默认必须遵守 `docs/40-engineering/历史构建产物清理基线.md`
  - 当前镜像预算按“服务商 + 实现线”计算，理论上最多允许并存 5 个开发镜像；若要继续产出新镜像，先删除旧的冗余开发镜像
  - 若旧镜像对应关键测试数据，默认先保留测试归档/日志/回包/截图等证据，再删除旧镜像本体
- 本地服务地址 / 环境变量基线：
  - 宿主机端口：
    - `web = 3028`
    - `core = 4028`
    - `account-api = 4128`
    - `gateway = 4226`
  - `web` 若要读取已购 AI 服务模型目录或请求 gateway operator 面，必须带 `AI_GATEWAY_INTERNAL_URL=http://gateway:4200`
  - `account-api / account-domain / core` 若要处理 gateway 相关能力，必须带：
    - `AI_GATEWAY_INTERNAL_URL=http://gateway:4200`
    - `AI_GATEWAY_MANAGEMENT_TOKEN`
  - 本地账户服务对浏览器返回的 `AI gateway` 地址必须对齐本地 Rust gateway 映射端口 `4226`
- 并发开发基线：
  - 多个 AI / 多个终端并行工作时，本地 Rust 开发还必须遵守 `docs/40-engineering/本地Rust编译隔离基线.md`
  - 直接运行本地 `cargo check / test / build` 时，默认显式设置独立 `CARGO_TARGET_DIR`
  - Windows / MSVC 日常轻量任务可用：
    - `.runtime/cargo-target-<task-or-agent>`
  - 若会触发 `boring-sys / cmake / MSBuild` 等深层原生依赖编译，当前默认优先使用短绝对路径：
    - `C:\t\<task-or-agent>`
    - `C:\t\cargo-<task>`
  - 原因是当前主机上的深层 `.runtime/...` 目标目录可能让中间 `CMakeScratch / FileTracker` 路径超过 `260` 字符并导致构建失败
- 仓库健康基线：
  - 若本仓库出现 `git gc/repack` 内存不足、`.git/objects/pack/.tmp-*.pack` 孤儿 pack、或 `no corresponding .idx`，默认遵循 `docs/40-engineering/Git仓库健康维护基线.md`
  - 默认先关闭本仓库自动 `gc/maintenance` 并清理孤儿 `.tmp-*.pack`，不要直接上全量 `repack`
  - 若某条本地 feature branch 准备发布到远端时，`git merge-base HEAD origin/<target-branch>` 为空，则默认先按“远端与当前本地主线无共同祖先”处理；不要把问题误判成只差推送最近几个提交的小分支
  - 若默认 git push / bundle create 因 pack 内存或 shared-pack 异常失败，当前允许优先用较新的 Git for Windows + 保守 pack 参数导出 `.bundle` 作为高保真转运件；具体参数以 `docs/40-engineering/Git仓库健康维护基线.md` 为准
  - 若 `.bundle` 将作为当前专题分支的正式转运件，当前推荐再用一次性临时 bare repo 执行 `git fetch <bundle> <ref>:<ref>`，并比较导入 head 与源 branch head 是否一致
  - 若真实 `git push` 在较新的 Git + 保守 pack 参数下仍长时间悬挂且远端 ref 没出现，当前默认停止悬挂 push 进程并保留已验证 `.bundle`，不要无限等待
  - 若从已验证 `.bundle` 恢复出的最小 bare source repo 再推远端仍报 `HTTP 500` / remote disconnect，当前默认把阻塞归到远端侧，不再继续怀疑本地 branch 内容或 `.bundle` 结构
  - 若最新 `.bundle` 无法继续刷新，而需要验证最新 patchset，当前默认优先用：
    - 同仓 detached worktree
    - `git am --3way <patches>`
    做 base 上的重放验证；不要优先新建 fresh temp repo 再 `git fetch source <base>`，否则容易重新卡回 `upload-pack / pack-objects`
  - patchset replay 的正式成功判据当前优先看：
    - `HEAD^{tree}` 是否与源 branch head 一致
    - patch 数量与 subject 序列是否一致
    不要把 replay 后的 `HEAD commit hash` 与源 branch head 的 commit hash 直接相等，当成唯一成功标准
  - 若最新 patchset 已验证，但原大仓库仍无法继续刷新一个“对齐当前 head”的 current `.bundle`，当前允许使用：
    - `base tree + verified patchset + short-path synthetic repo`
    导出 synthetic current bundle
  - synthetic repo 当前默认优先落在短绝对路径（例如 `C:\t\...`），并显式：
    - `git config core.longpaths true`
    避免 Windows `Filename too long`
  - synthetic current bundle 的正式成功判据当前优先看：
    - source branch `HEAD^{tree}` 与 synthetic repo `HEAD^{tree}` 一致
    - `git bundle verify` 通过
    - bare repo 从 bundle `git fetch` 后，取回的 ref head 与 synthetic repo head 一致
    不要要求 synthetic repo head commit hash 与 source branch head commit hash 相同
- 运行时排查基线：
  - 若缺失 `ai-gateway-domain` migration，本地 `无限调用`、`gateway project api key`、`/v1/models`、智能体模型选择器都会因为 `gateway_tenants / gateway_projects / gateway_api_keys` 表不存在而失效
  - 若 `无限调用` 已激活但 `/v1/models` 返回空数组，默认先排查本地 `gateway provider account / model alias` 是否为空
  - 当用户只是测试 `智能体` UI / 交互链而非真实模型调用时，允许使用本地 fake gateway provider 作为测试夹具；默认 helper：`deploy/bootstrap-local-gateway-fake-provider.ps1`
  - 本地 gateway bootstrap helper 默认直连 Rust gateway `http://127.0.0.1:4226`，使用 `x-management-token` / `local-internal-token`；不得再依赖 account-api 的旧 `/v1/internal/gateway/catalog` 聚合面
  - Qwen 当前本地 fixture/live regression lane 固定为独立 standalone Rust gateway：
    - `http://127.0.0.1:42430`
  - 它不等同于本地预览栈的 `4226`，也不得被宿主机上其他 standalone `neuro-gateway.exe` 冒充；若现场存在多条 standalone worker，默认按：
    - 监听端口
    - `/v1/internal/gateway/provider-accounts` inventory
    区分
  - 当前 `42430` lane 的恢复、启动契约与 clean inventory 基线，统一以下列 Qwen 专题文档为准：
    - `docs/20-ai-gateway/Qwen平台实现线、可选编译与物理隔离基线.md`
- 本地 provider credential 文件夹同步基线：
  - 根目录默认是当前运行用户的 `~/.neuro`
  - Docker 预览里的 `gateway` 若启用同步，默认把宿主机 `%USERPROFILE%\\.neuro` 挂到容器 `/root/.neuro`
  - 优先按新目录结构组织：
    - `<root>/<service-provider>/<provider-surface>/<credential-material-kind>/<credential>.json`
  - 旧 `<root>/<provider-family>/<credential>.json` 仍允许继续读取，用于历史 provider 兼容

## Deployment Default

All future deployment, infra, runtime-boundary, and portability work in this repository must follow:

- `docs/10-platform/NeuroLoom平台总基线.md`

Default long-term deployment baseline:

- `Cloudflare` is the stable long-term edge and object layer:
  - `DNS`
  - `WAF`
  - `CDN / Cache`
  - `Load Balancing`
  - `R2`
- The current dynamic application stack must stay off Cloudflare-hosted compute:
  - `web`
  - `core`
  - `worker`
  - `executor`
  - `PostgreSQL`
  - `Valkey / Redis-compatible`
- Hot-path synchronous traffic must stay inside the same cloud/private network/region:
  - `web -> core`
  - `core -> PostgreSQL`
  - `core -> Valkey`
  - `worker / executor / cron -> core`
- Do not route internal service traffic through public Cloudflare URLs when a private or cluster-local path is available.
- Rust `gateway` provider 兼容代码若发生变更，当前正式默认必须通过 `splitter` 拉起新 `worker`、把切流后的新请求全部交给新 `worker`、并只让老 `worker` 完成切流前已建立的请求 / 响应后再退出。当前无停机发布基线见：
  - `docs/20-ai-gateway/AI网关发布与滚动切流基线.md`
- `GATEWAY_SPLITTER_RELOAD_SHUTDOWN_TIMEOUT_SECS` 当前默认值是 `0`，语义是“无限等待老 `worker` 排空”。
- `gateway` 当前正式无停机发布 helper 归 sibling `../Gateway` / 仓库根级 Gateway 自动化 owner；`Platform/` 不再维护 `deploy/build-gateway-binary.sh`、`deploy/reload-gateway-splitter.sh`、`deploy/release-gateway.sh` 的本地副本。
- 镜像 / 集群发布 helper 也归 Gateway 自动化 owner；`Platform/deploy/` 中不得重新引入 `build-images.sh`、`push-images.sh`、`rollout-gateway.sh` 来掩盖 Gateway ownership 边界。

## Portability Rules

- Treat `GCP` as replaceable standard `IaaS`, not as a platform-runtime dependency.
- Default allowed GCP building blocks are:
  - `Compute Engine`
  - `VPC / Subnet / Firewall`
  - `Persistent Disk`
  - `Static IP`
- Do not introduce the following as required runtime dependencies unless the user explicitly re-approves the architecture and the docs/rules are updated in the same round:
  - `Cloud Run`
  - `Cloud SQL`
  - `Memorystore`
  - `Cloud Scheduler`
  - `Secret Manager`
  - `Artifact Registry`
  - `GCP Load Balancer`
- Default application-plane packaging is portable OCI containers.
- Default application-plane orchestration is `k3s`.
- Default infra-as-code location is `infra/tofu/` using `OpenTofu`.
- Default Kubernetes manifests live under `infra/k8s/`.
- Default deploy/build/release helpers live under `deploy/`.
- Default image registry is `GHCR`.
- Default secret management baseline is `SOPS + age`.
- Default production object storage target is `Cloudflare R2` through an `S3-compatible` abstraction.
- Default stateful data plane is portable:
  - `PostgreSQL`
  - `Valkey (Redis-compatible)`
- Do not couple business logic to vendor-specific managed database, queue, scheduler, or identity APIs when a portable application-owned abstraction already exists.

## View Architecture

平台所有界面归属于且仅归属于以下三类视图，完整基线见 `docs/30-product/视图、账户与用户主线.md`：

- **用户自持视图 (Owner View)**：已登录用户查看和编辑自己的内容。路由 `/dashboard`、`/wallet`、`/growth` 等账户终端路由。
- **游客公开视图 (Visitor View)**：任何人查看某用户的公开档案，只读。路由 `/u/:username`。
- **管理员运维视图 (Operator View)**：平台管理员进行运维操作。路由 `/ops/*`。使用独立运维壳层，不复用账户终端壳层或用户页面组件。

账户终端中的 `/tasks` 当前正式属于 **Owner View** 下的“任务与能力统一市场”工作台：

- 左侧 rail 固定为：
  - `任务列表 / 出售`
  - `曜晶市场 / 米拉市场`
- 右侧主板顶部固定为：
  - `任务一口价 / token量`
  - 搜索栏
  - 当前模式动作按钮
- `发布任务` 当前必须弹出独立二级弹窗，不得直接把任务表单铺在主列表页。
- `发布任务` 当前字段基线只保留：
  - `任务标题`
  - `任务说明`
  - `计费模式`
  - `奖励币种`
  - `奖励金额`
  - `保证金（只读）`
- `发布任务` 当前必须删除：
  - `偏好能力代码`
  - `承接模式`
  - `计量单位`
  - `属性键`
  - `数量`
- `计费模式` 只允许 `按任务一口价 / 按 token 计费`
- `承接模式` 统一强制自动撮合
- `保证金 = 奖励金额 * 30%`
- 不要再把 `/tasks` 回退成四个顶层子 tab 工作台或解释型占位页。

后端 API 分层：

- `/v1/me/*` — 用户自身数据读写
- `/v1/public/*` — 公开只读数据
- `/v1/internal/*` — 运维管理操作
- `/internal/*` — 服务间机器调用

前端 feature 模块标准子目录：`shared/`、`owner/`、`visitor/`、`ops/`。不允许在 `shared/` 组件中混入 `if (isOwner)` 编辑分支。

平台当前还维护一层独立的“前台界面外放”真相层：

- operator 正式入口：`/ops/account/surface-visibility`
- 真相层：`public_surface_visibility`
- Web 定义层：`web/src/lib/public-surface-visibility.ts`

这层开关只负责前台可见性，不替代 `feature_modules`：

- `feature_modules` 负责模块能力是否真正开放
- `public_surface_visibility` 负责普通用户 / 游客是否看到按钮和页面

## Account Boundary

- 第一批用户账户中心的正式代码 owner 是：
  - `services/account-api`
  - `services/account-worker`
  - `packages/ai-gateway-domain`
  - `packages/account-domain`
- 以下能力默认属于账户域：
  - `identity`
  - `/v1/me`
  - `wallet-ledger`
  - `mailbox`
  - `verified email identities / email-native access`
  - `announcements`
  - `honor-archive / user-profile`
  - `user-progression`
  - `reputation`
  - `personal-missions`
  - `benefits`
  - `credential-pools`
- `users.id` 继续是账户域内部 canonical user id；真实邮箱地址不得替代内部主键。
- `auth_identities` 允许在保持内部主键不变的前提下承接已验证真实邮箱，作为外部身份锚点与 `email-native access layer` 入口。
- 当前批准的真实邮箱主线只包括：
  - 真实邮箱绑定与验证
  - 邮件调用 Agent / 任务
  - 邮件回执 / 结果投递
- 上述真实邮箱能力不是“把平台改造成完整 SMTP/IMAP 邮箱产品”；`mailbox` 仍是平台内 inbox / projection target。
- 邮件入口不得替代 `task-hub / agent-execution / wallet-ledger / fulfillment` 真相层；邮件只允许作为外部 ingress / egress 与异步投递层。
- 邮件触发默认只批准低风险、异步、可审计动作；资金支出、权限变更、凭证旋转等高风险动作不得仅凭邮件直接完成。
- `wallet-ledger` 当前正式钱包三货币 canonical key 固定为：
  - `mira`
  - `obsidian`
  - `opinionTickets`
- 若产品展示需要使用 `耀晶 / 投票券`，当前优先通过显示层 alias 处理，不要先改 schema、contracts 或账本 key。

### AI Gateway Ownership

- AI gateway / 平台 `neuro_*` key 主链的长期正式 owner 固定为 Rust `gateway/`。
- Rust `gateway` 当前必须同时 owner：
  - 对外 `baseURL + api_key` 入口
  - 特殊 API key 与用户 API key
  - 用户凭证库与真实凭证库
  - 真实凭证单条 / 批量上传
  - keepalive / session / request audit / runtime patch
  - key 管理与分发接口
- 网站后台、operator 页面与其他 Web 能力若需要 AI gateway 管理能力，默认应调用 Rust gateway API；它们是客户端，不是长期 owner。
- 已删除的旧 TypeScript 网关后续不得以任何形式恢复为运行单元、helper 或默认兼容层。
- `packages/ai-gateway-domain` 若继续存在，只允许作为迁移期网站后台过渡数据层，不得再作为长期正式网关 owner 扩张。
- 平台 `web` / operator 页面访问 `/v1/internal/gateway/*` 时，默认直连 Rust gateway 管理接口；不再以 `account-api -> gatewayRouter` 作为正式主路径。
- Operator 页面到 Rust gateway internal route 的当前对照表见 `docs/20-ai-gateway/Operator到RustGateway接口对照表.md`。
- 平台 `account-domain / benefit service` 若需要处理：
  - `gateway project ensure`
  - `API access resolve / rotate`
  - `prompt-cache summary / trend`
  默认也应通过 Rust gateway internal management API 完成。
- Rust gateway 当前允许直接读取和管理：
  - `PostgreSQL`
  - `Valkey`
  - `S3-compatible object storage`

### AI Gateway Provider / Credential Rules

- AI gateway 深层 provider 细节、目录样例、runtime 变体、fixture / suite 归档，统一以下列 canonical docs 为准：
  - `docs/20-ai-gateway/AI网关总基线.md`
  - `docs/20-ai-gateway/AI网关协议与路由总线.md`
  - `docs/20-ai-gateway/AI网关运行时与会话总线.md`
  - `docs/20-ai-gateway/AI网关服务商建模与凭证体系.md`
  - `docs/20-ai-gateway/统一AccessKey与客户端接入基线.md`
  - `docs/20-ai-gateway/单行凭证生命周期与文件夹同步基线.md`
  - `docs/20-ai-gateway/服务商凭证库存水位与补货通知基线.md`
  - `docs/20-ai-gateway/用户级对话日志存档与模型优化数据集基线.md`
  - `docs/20-ai-gateway/成熟网关项目借鉴与RustGateway硬化计划-2026-05-30.md`
  - `docs/20-ai-gateway/服务商实现线与Provider目录.md`
  - `docs/20-ai-gateway/Gemini三线路与Canvas派生运行时架构规范.md`
  - `docs/20-ai-gateway/Gemini凭证、Bootstrap配置与派生运行时字段分层表.md`
  - `docs/20-ai-gateway/Qwen平台实现线、可选编译与物理隔离基线.md`
  - `docs/20-ai-gateway/Qwen平台凭证模板与字段说明.md`
  - `docs/20-ai-gateway/AI网关测试与验收总线.md`
- 当前必须继续自动继承的 AI gateway 高层规则是：
  - 真相层固定为 `gateway_provider_credentials`
  - 每条真实 provider credential 必须单独一行、单独生命周期
  - `provider account` 只承载共享配置与 surface 级路由语义，不再承担“整包凭证池”语义
  - 正式建模粒度必须显式区分：
    - `service provider identity`
    - `implementation line`
    - `provider surface`
    - `credentialMaterialKind`
  - 同一服务商允许同时拥有多条不同 surface / 不同协议 / 不同商品面的 provider account
  - 同一份底层认证材料可跨 surface 共享，但共享材料不等于共享 execution contract；默认通过 `credentialMaterialKey` 识别共享材料
  - 服务商出口协议 family 的最小安全判定粒度固定为：
    - `selected provider credential + selected model`
  - 用户级对话日志存档当前正式策略固定为：
    - `ops_forced_full`
    - authenticated conversation-like gateway 请求默认全量归档
    - 用户侧无 opt-out
    - request 期间存档失败不得导致用户请求失败
    - authorization / cookie / token / api key / secret / password 等字段必须脱敏
    - 元数据入 PostgreSQL，重 payload 入 object storage
    - 默认保留期 `180` 天
    - v1 批准 capture / query / export / clean sample / review / publish dataset asset
    - `published` dataset 只表示平台内数据资产可被后续任务引用，不等于启动训练、fine-tuning 或外部共享
    - 任何训练 / fine-tuning / 外部数据传输仍必须另行经过产品与隐私策略审批
  - provider 失败归因必须优先按：
    - `credential_invalid`
    - `credential_expired`
    - `quota_exhausted`
    - `rate_limited`
    - `model_unsupported`
    - `content_rejected`
    - `gateway_protocol_error`
    - `client_request_invalid`
    - `provider_transient`
    - `unknown`
    区分，并显式标注 failure scope；不得把模型级失败无脑写成整条凭证失效
  - provider credential-model 健康状态当前正式 owner 是 Rust gateway：
    - 真相表：`gateway_provider_credential_model_states`
    - 最小粒度：`provider_account_id + provider_credential_id + protocol_profile + model`
    - `credential_invalid / model_unsupported` 进入 `blocked`
    - `credential_expired / quota_exhausted / rate_limited` 进入 `cooling`
    - `provider_transient / gateway_protocol_error` 进入 `degraded`
    - `client_request_invalid / content_rejected` 不惩罚 provider credential
    - 请求成功必须清回 `active`
    - 路由候选构建阶段必须读取该状态表，并在请求期不得靠 proactive quota 探针替代真实流量证据
  - usage / quota 批处理硬化当前正式 owner 是 Rust gateway：
    - 请求期继续只入 Redis usage report queue
    - 批量 flush 聚合维度固定为 `user_id + provider_credential_ref + model`
    - 聚合表：`gateway_usage_aggregates`
    - operator summary 必须暴露 usage queue depth、24h request/failure/token、conversation archive object storage failure 告警
  - provider credential 库存水位与补货通知当前正式 owner 是 Rust gateway：
    - policy 真相表：`gateway_credential_stock_policies`
    - signal 归档表：`gateway_credential_stock_signal_events`
    - pull API：
      - `GET /v1/internal/gateway/credential-stock/status`
      - `GET/POST /v1/internal/gateway/credential-stock/policies`
      - `POST /v1/internal/gateway/credential-stock/signals/sweep`
    - push 通道默认使用 Redis Stream：`gw:credential-stock:signals`
    - 库存分类最小公开键为 `stockClassKey`，同时必须显式携带：
      - `serviceProviderKey`
      - `implementationLineKey`
      - `providerSurfaceKey`
      - `credentialMaterialKind`
    - v1 支持两类水位：
      - `credential_count`：`minCredentialCount / targetCredentialCount / maxCredentialCount`
      - `token_window`：`tokenWindowKey / tokenWindowSeconds / minAverageAvailableTokens / targetAverageAvailableTokens`
    - 这两类水位是 provider 真实凭证供给侧库存 / 上游 quota 度量，不等同于平台对用户的计费模型；用户侧可按时间、套餐、任务、订阅或内部积分计费
    - API canonical 字段固定为 `providerSupplyMetricKind`；历史 `metricKind` 仅作为兼容 alias，不得被解释为用户 billing metric
    - 外部凭证生成程序默认先 pull 查询自身负责的 `stockClassKey`，常驻时再订阅 Redis Stream；不得直接修改 gateway policy 的 `lastSignal*` 去重字段
  - 模型优化数据集导出当前正式 owner 是 Rust gateway：
    - 索引表：`gateway_conversation_dataset_exports`
    - object key：
      - `ai-gateway/conversation-dataset-exports/{datasetId}/dataset.jsonl`
      - `ai-gateway/conversation-dataset-exports/{datasetId}/manifest.json`
    - 状态机固定为：
      - `review_pending -> approved -> published`
      - `review_pending -> rejected`
    - 只有 `approved` 可以 publish；`review_pending / rejected` 不得发布
  - 若同一条 `credential + model` 同时支持多种出口协议 family，默认优先选择与调用方入口协议 family 相同的那一条，尽量走 same-protocol fast path
  - 常见实现线语义统一收口为：
    - `official_api`
    - `official_vendor_api`
    - `web_reverse`
    - `browser_owned`
    - `program_owned`
  - 请求期 browser / local worker fallback 当前必须受 Rust gateway 全局策略约束：
    - 环境变量：`GATEWAY_REQUEST_TIME_BROWSER_POLICY`
    - `local_allowed`：允许远端 browser executor 不可用后返回 `Ok(None)` 并继续本进程 local browser / Node worker fallback
    - `remote_only`：不允许 local fallback；远端 browser executor 缺失 / 不可达返回 `browser_executor_required_unavailable`，远端非 2xx / 坏 JSON 返回 `browser_executor_required_failed`
    - `disabled`：禁止请求期 local browser / Node worker fallback；仍允许 pure HTTP / browserless replay 与已配置的远端 browser executor；若没有远端 executor 且路径需要 browser executor，返回 `request_time_browser_forbidden`
    - `remote_only` 与 `disabled` 下不得用 silent `Ok(None)` 触发本地 fallback
  - 内部 browser executor 服务入口默认必须配置 `GATEWAY_BROWSER_EXECUTOR_BEARER_TOKEN`；只有显式设置 `GATEWAY_ALLOW_UNAUTHENTICATED_BROWSER_EXECUTOR=1|true|yes|on` 时，才允许开发环境绕过 token 配置
  - `AIStudio Web Reverse` 当前 Phase 1 正式已完成：
    - `text / models / tools / embeddings / TTS / images`
    - 其中 `embeddings` 当前归 `browser-owned`
    - `text / stream / tools` 当前代码侧默认 send path 已改为：
      - `program-owned capture-contract pure_http_replay -> browser-backed fallback`
      - 但已存在一条极小的 `program-owned deterministic bridge` 子链
      - 当前一般文本热路径已提升为默认 `program_owned pure-http first`
        - 依赖：
          - `runtimeStateObjectKey`
          - `aistudio-target-rpc-contract.json`
          - `cloudApiKey`
        - sidecar / runtime material 缺失、合同解析失败、目标 RPC 失败或上游拒绝时仍自动回退 browser-backed request
      - 不得在缺少 live steady-state 归档证据时误读成 Phase 3 已完整验收
  - `TTS / images` 当前归 `mixed implementation`
      - `direct send material = cloud_api_key`
      - `browser fallback material = browser_state`
      - `send path = cloudApiKey direct-http fast path -> browser-backed fallback`
    - 参考实现 `AIStudioToAPI` 与当前专题证据只明确覆盖上述六类能力
    - `image edits / music / videos` 当前未证明属于 AIStudio 正式能力域，不得提前误报成 Phase 1 必做项
  - Qwen / ChatGPT / Gemini / AIStudio / Producer.ai 等服务商的具体实现线边界，以 `docs/20-ai-gateway/服务商实现线与Provider目录.md` 和相应专题文档为准；不要在 `AGENTS.md` 里继续扩张成第二份 provider 手册
  - `Qwen` 当前正式只按两条实现线理解：
    - `qwen_official_api`
      - 当前共享 3 个 canonical official surface：
        - `qwen_dashscope_openai`
        - `qwen_coding_plan_openai`
        - `qwen_coding_plan_anthropic`
      - official 凭证模板、单行文件目录与本地 helper 以：
        - `docs/20-ai-gateway/Qwen平台凭证模板与字段说明.md`
        - `deploy/write-qwen-official-credential-files.ps1`
        为准
    - `qwen_web_reverse`
      - 当前 canonical surface：
        - `qwen_web_chat`
      - 当前请求期 owner 目标是：
        - `browserless / pure_http_replay`
      - 浏览器只允许参与 session material 提取与 refresh tooling，不得重新进入请求期热路径
      - 历史 Qwen web preset alias：
        - `qwen-web`
        - `qwen-webui`
        - `qwen-webui-replay`
        - `qwen-webui-replay-live`
        当前必须继续 canonicalize 到：
        - `qwen-web-chat`
        并且不只是在 profile 解释层等价；built-in preset lookup、YAML route config、credential routing 这些真实 consumer path 也必须继续走 canonical Qwen web preset，不得退化成：
        - unknown preset
        - raw `openai_compatible` fallback
    - `Qwen` 当前 compile-switch Rust 回归的最小正式验证矩阵也已收口为：
      - `--no-default-features`
      - `--no-default-features --features line-qwen-official-api`
      - `--no-default-features --features line-qwen-web-reverse`
      - `--no-default-features --features line-qwen-official-api,line-qwen-web-reverse`
    - 后续若再写 Qwen line-specific Rust tests，必须同时覆盖：
      - feature 开启时的正常路径
      - feature 关闭时的 `gateway_provider_line_compiled_out`
      - 不得再让 “实现线已停编，本应断言 compiled-out” 的测试继续 `unwrap()` 正常路径
    - 当前这层之外，Qwen 还已经补上了 protocol-profile compile gate 的 direct tests，因为 access preview / route preview 当前正是靠：
      - `is_protocol_profile_compiled_in(...)`
      过滤 disabled line
    - 若后续终于拿到真实 Qwen official key，当前正式收口顺序固定为：
      1. 先用 `deploy/write-qwen-official-credential-files.ps1` 写 canonical `~/.neuro` 单行凭证文件
      2. 确认 `http://127.0.0.1:42430` lane 仍然 up，且 inventory 仍 clean
      3. 依次运行：
         - `qwen_dashscope_live`
         - `qwen_coding_plan_openai_live`
         - `qwen_coding_plan_anthropic_live`
      4. 当前允许把 `qwen模块重构` 记完成的条件是：
         - `qwen_dashscope_live` fresh 打绿
         - `qwen_coding_plan_openai_fixture` 与 `qwen_coding_plan_anthropic_fixture` 已绿
         - `qwen_coding_plan_openai_live` 与 `qwen_coding_plan_anthropic_live` 已保留 latest-head fail-fast / stale-key-scrub 证据
         - 且截至 `2026-05-18` 的官方文档仍明确把 Coding Plan 配额限定在交互式 AI 编程工具中，并排除
           `curl / Postman / Dify / 自定义应用程序后端 / 非交互式批量 API` 场景；
           因此对本仓库的 AI gateway API/backend lane，这两条 Coding Plan live probe 当前应按 `服务商不支持` 记录，
           而不是继续作为必须 fresh 打绿的 completion gate
    - Qwen official live bootstrap 当前也必须继续对齐 AI gateway 真相层：
      - provider account 只承载 surface 级协议语义
      - 实际 official key 应收口到 child `gateway_provider_credentials` row
      - 不再把真实 key 长期内联在 provider account `payload.apiKey`
    - 当前还必须额外记住一条 fresh 证据约束：
      - 一个能打绿 `qwen_dashscope_live` 的 DashScope-compatible key，
        **不等于**它也一定能通过 Coding Plan upstream surface
      - 若 direct-upstream probe 对：
        - `https://coding.dashscope.aliyuncs.com/v1/...`
        - `https://coding.dashscope.aliyuncs.com/apps/anthropic/...`
        已返回：
        - `401 Unauthorized`
        - `invalid_api_key`
      - 且同日官方文档仍明确把套餐额度限定在交互式 AI 编程工具，并排除
        `curl / Postman / Dify / 自定义应用程序后端 / 非交互式批量 API`
      则对 AI gateway API/backend lane 应优先记成：
        - `服务商不支持`
      而不是继续把它记成：
        - `缺少 Coding Plan-capable official key`
    - 当前若 latest-head preflight 已明确把某个 generic `sk-...` 判定成 Coding Plan upstream reject，
      isolated `42430` lane 中对应 Coding Plan live provider row 的内联 `payload.apiKey` 也应被 scrub 成空串，
      不再继续保留误导性的 masked stale key
  - `ChatGPT` 当前正式按三条独立实现线理解：
    - `chatgpt_official_api`
      - 当前正式对应 `OpenAI Platform`
      - 当前 control-plane 主标识是 `protocolProfile = chatgpt_official_api`
    - `web_reverse`
      - 当前正式对应 `protocolProfile = chatgpt_web_reverse`
      - 若单行 credential 含真实 OAuth `refreshToken`，Rust gateway worker 当前会通过 DB-owned 后台刷新器提前执行 browserless OAuth refresh，维护 `apiKey / refreshToken / idToken / expiresAt`；该能力只续 access token，不保证 refresh token 永不失效，也不得在后台启动 browser
  - `chatgpt.com/backend-api/codex` 当前仍是 ChatGPT 站点后端特例；不得把它继续等同为 `official_api` 线的长期干净 owner 语义

### Benefits / Credential Pools

- `benefits` 在 `无限调用` 等 access 场景下不再 owner relay 本体：
  - 它只负责校验 grant 并为用户 ensure `gateway project`
  - 再由 gateway project 签发 `neuro_*` project api key（历史 `new_api_*` 仅作兼容解析）
- `credential-pools` 当前对 `service_proxy` 仅保留“历史 benefit 账号来源 / 导入来源”语义，不再作为长期正式 `gateway provider account` owner。
- `personal-missions` 当前统一承接：
  - `check-in`
  - `daily missions`
  - `weekly missions`
  - `permanent missions`
  - `event missions`
- `benefits` 当前统一承接：
  - `benefit families`
  - `benefit services`
  - `benefit product bindings`
  - `benefit grants`
  - `benefit credential pools`

## 重度智能体对话终端基线

- `/chat` 是默认免费重度智能体 `觅觅` 的正式运行时入口；重度对话必须严格分离 `slot / project / thread` 三层数据，并在 UI 端收口成一个由平台 AI 服务支持的独立聊天应用：
  - 隐藏账户终端总导航
  - 使用自己的 topbar
  - 左侧 `search / project list / history`
  - 中央 welcome state / message stream / composer
  - composer 预留 references、quick prompts、streaming indicator
  - message 提供 `复制 / 重试 / 转 task / 投递邮箱`
- `/agents?role=heavy` 只负责槽位概览、默认 slot 入口与扩展槽位购买 CTA，不展示消息流。
- 默认免费重度体当前正式名称是 `觅觅`。
- `/agents?role=heavy` overview 顶部当前保留：
  - 左侧 `新建 / 删除 / 启用 / 停用`
  - 右侧 `当前槽位 x/2`
  - 右侧 `购买槽位`
- `managed_light` 当前正式指向平台代运行的轻量 Agent。
- `managed_heavy` 当前正式指向平台代运行的重 Agent。
- `open_protocol` 当前正式指向接口定义的 Agent。
- 当前无论哪一层 Agent，都应以 `OpenAgent` 协议作为正式交互主语义。
- 上述规范当前收口在：
  - `docs/30-product/任务后台、Agent Center与重度终端基线.md`

## Identity Entry

- 当前正式首页默认就是登录入口，不是公开产品说明页。
- 当前正式主会话登录方式只有一种：
  - `Linux.do` 授权登录
- 当前允许新增的外部身份锚点是：
  - 已验证真实邮箱
  - 其正式用途是 `Email-Native` 调用入口与回执投递地址
  - 它不是第二套主会话登录来源，也不得替代 `users.id`
- 不允许在未获用户重新确认前，为首页或账户体系新增：
  - 邮箱注册
  - 邮箱密码登录
  - 手机号登录
  - 第二套平行主会话账号来源
- 当前规则是：
  - 用户首次通过 `Linux.do` 授权时，自动创建本地账户
  - 本地账户与该 `Linux.do` 账号一对一绑定
  - 后续平台身份默认以该绑定关系和内部 `users.id` 为准
  - 后续允许为该账户绑定经验证的真实邮箱，作为外部身份锚点与邮件调用入口

## UI Constraints

- Do not introduce a new visual theme unless the user explicitly asks for a different theme.
- Default to the `nt-*` (NeuroTerminal) control family for buttons, cards, inputs, badges, alerts, and progress displays.
- Keep future UI consistent with the NeuroTerminal rules:
  - dark base
  - graphite slabs
  - signal-yellow emphasis
  - structural geometry
  - disciplined motion
- 所有页面（包括账户中心、用户个人主页、成长中心、控制面、运维面）统一使用仓库根设计系统与 `nt-*` NeuroTerminal 风格作为唯一正式视觉基线。
- Owner 与 Visitor 高度相似的页面（如个人档案、项目展示、Agent 展示），必须通过 `shared/` + `owner/` + `visitor/` 分层复用。
- Operator 使用独立壳层，不复用账户终端壳层或用户视图的页面组件。
- 游客公开视图 (`/u/:username`) 不向游客暴露钱包、邮箱、订单、凭证、成长分项等私有域数据。
- `公告界面` 已被提升为正式视觉参考面；后续账户域以及相关轻后台的 `左侧目录 + 右侧详情 / 编辑 / 阅读` 类页面，默认优先复用公告界面的结构语言。
- 产品界面参考面默认按下面收口：
  - `福利中心 / 签到 / 兑换码 / 个人任务中心` -> `docs/30-product/福利、签到与兑换码基线.md`
  - `羊毛派 / 已购权益领取台` -> `docs/30-product/权益领取、凭证发放与羊毛派总线.md`
  - `商城 / 小集市` -> `docs/30-product/商城、小集市与权益发放实施边界.md`
  - `项目` -> `docs/30-product/项目中心与公开档案实施边界.md`
  - `Agents / Agent Center / 重度智能体对话终端` -> `docs/30-product/任务后台、Agent Center与重度终端基线.md`

## Implementation Guidance

### Module Structure

- 前端 feature 模块标准子目录：
  - `shared/`（纯展示）
  - `owner/`（编辑能力）
  - `visitor/`（只读）
  - `ops/`（运维）
  - `server.ts`
  - `routes.ts`
  - `types.ts`
  - `adapter.ts`
- 后端模块标准文件：
  - `router.ts`
  - `service.ts`
  - `repository.ts`
  - `schema.ts`
  - `types.ts`
  - `events.ts`
- 模块间不直接导入彼此的 `repository` 或 `schema`；跨模块数据访问通过 `service` 层暴露。
- 共享类型放 `packages/contracts`，共享后端工具放 `packages/backend-foundation`。
- 后端路由分层必须遵循：
  - `/v1/public/*`
  - `/v1/*`
  - `/v1/internal/*`
  - `/internal/*`

### Existing Module Ownership

- 用户侧前端 owner：
  - `商城 / 小集市` -> `web/src/features/account-commerce-center/*`
  - `Agent Center` -> `web/src/features/account-agent-center/*`
  - `重度智能体对话终端` -> `web/src/features/account-heavy-agent-chat/*`
  - `任务 / 能力集市` -> `web/src/features/account-task-market/*`
  - `项目中心` -> `web/src/features/account-project-center/*`
  - `荣誉档案 / honor archive` -> `web/src/features/account-honor/**`
- operator UI owner：
  - `account-worker` -> `web /ops/account-worker`
  - `邮箱运营中心` -> `web /ops/account/mailbox`
  - `benefits` -> `web /ops/account/benefits`
  - `credential-pools` -> `web /ops/account/credential-pools`
  - `projects` -> `web /ops/account/projects`
  - `issues` -> `web /ops/account/issues`
  - `agents` -> `web /ops/account/agents`

后续若上述 owner 或边界变化，必须同步更新：

- `docs/30-product/视图、账户与用户主线.md`
- `docs/30-product/账户域API与服务边界.md`
- `docs/10-platform/NeuroLoom平台总基线.md`
