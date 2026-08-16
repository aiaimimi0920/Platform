# Platform 代码优化计划（2026-08-15）

这是当前置顶的 Platform 代码质量计划。它以 `2026-08-15` 的实际工作树、
模块调用关系和测试入口为依据；历史 round 文档只作为实施记录，不替代本计划的
当前状态和验收结论。

## 目标与边界

- 只修改独立 `Platform` 仓库拥有的代码、文档、测试、构建和本地 Compose 配置。
- 优先修复可证实的权限、正确性、并发和无界查询问题，不以“文件变短”代替优化。
- 保持现有 HTTP、TypeScript public surface 和数据库兼容性；需要迁移时必须提供可重复迁移与集成测试。
- 每项完成状态必须由 fresh test/build/runtime 证据支持，不能沿用旧日志或旧发布包。

## 本轮审查结论

| 优先级 | 问题 | 证据 | 处理计划 |
| --- | --- | --- | --- |
| P1 | 非 owner 仲裁工作台缺少 Web 路由级 operator guard | `web/src/app/arbitrations/page.tsx` 只检查登录；`/ops/account/arbitrations` 直接复用该页面。Core 当前仍按用户可见性过滤，因此没有把“缺 guard”误报成已证实的跨用户数据泄露 | 在任何数据读取前拒绝非 operator，并增加路由源码契约测试 |
| P1 | 非法 Base64 可被 `Buffer.from(..., "base64")` 宽松解码 | `core/src/modules/arbitration/service/attachment-storage.ts` 依赖不会可靠抛错的 `try/catch` | 增加严格字母表、padding 和 canonical round-trip 校验及回归测试 |
| P1 | Task dispatch 在事务内读取该任务全部申请/提案，再用 JS 过滤 pending | `core/src/modules/task-hub/service/dispatch.ts` | 把 `status = pending` 下推数据库并增加查询契约测试 |
| P1 | AI Gateway anomaly 模块存在静态循环依赖 | `anomaly-alerts <-> anomaly-incidents`，`anomaly-policies <-> anomaly-sync` | 抽离纯 normalizer，并把策略触发同步改为调用期动态加载；增加边界测试 |
| P1 | 远程仲裁附件 sweep 缺少跨 worker 原子领取 | `expirePreparedArbitrationEvidenceUploads` 和 `cleanupResolvedRemoteArbitrationAttachments` 先查后执行远端副作用 | 增加有过期时间和 token 的数据库 lease，完成/失败更新必须校验 lease owner；增加并发集成测试 |
| P2 | 仲裁 Web client 的动态 path segment 未统一编码 | `web/src/lib/core-client/arbitration.ts` | 统一 `encodeURIComponent` 边界并增加源码契约测试 |
| P2 | 仲裁建案表单缺少显式 label | `arbitration-intake-section.tsx` | 补齐 `label` / `htmlFor` / `id` |
| P2 | 部分 operator 列表和 SLA 聚合仍为无界读取 | product catalog、manual-review SLA、claim-next arbitration | 作为下一批数据库分页/聚合工作，先补 API pagination contract，再改调用方 |

## 实施顺序

### A. 当前修复批次

- [x] 仲裁 operator 路由 guard 与回归测试。
- [x] 严格 Base64 校验与回归测试。
- [x] Task dispatch pending 条件下推。
- [x] Gateway anomaly 静态依赖环拆除。
- [x] 仲裁附件 sweep 原子 lease。
- [x] 动态 URL segment 编码与建案表单可访问性。

### B. 拆分收口门禁

- [x] agent-execution、task-hub、arbitration、product-order-item facade 继续覆盖拆分前 public exports。
- [x] 拆分前后路由集合保持一致，并补充直接加载 router facade 的契约测试。
- [x] Core、Web、AI Gateway domain 的 unit/typecheck fresh 通过。

### C. 后续性能批次

- [x] 为 operator product catalog 增加 cursor/limit 与稳定排序。
- [x] 将 manual-review SLA workload 改为 SQL 聚合或有上限分页。
- [x] 将 arbitration claim-next 优先级与原子领取下推 PostgreSQL。
- [x] 统一 Core 内重复的 JSON 提取/序列化 helper，并明确非 JSON 2xx 的错误语义。

## 完成门禁

本轮只有在以下证据齐全时才能标记完成：

1. `git diff --check` 通过。
2. 受影响 workspace 的 unit tests、typecheck/build fresh 通过。
3. `npm run ci` 与 required integration gate fresh 通过，或明确记录无法运行的外部依赖。
4. Compose 配置可解析；更新 Platform 镜像后，本地栈 readiness 和最小语义请求通过。
5. 版本化产物写入 canonical `../release/Platform/<versionId>` 并通过对应 verifier/smoke。
6. 正式 full release 仍必须满足 clean Git、同 commit acceptance manifest 和六镜像 immutable lock；dirty Web-only 包不得称为完整 Platform release。

## 本轮完成证据（2026-08-15）

- `git diff --check` 通过；根级 `npm run ci` 退出 `0`。其中仓库/发布/结构契约
  `103/103` 通过，Core unit `178/178`、Web unit `383/383`、AI Gateway Vitest
  `67/67` 通过，全部 workspace typecheck 通过，Next production build 成功。
- OpenTofu `1.12.1` 对 staging / production 完成 `fmt -check`、
  `init -backend=false -lockfile=readonly` 和 provider-schema validate；生产依赖审计为
  `0 vulnerabilities`。审计过程中将传递依赖 `nanoid` 从 `3.3.17` 更新到修复版
  `3.3.18`。
- `npm run test:integration:required` 使用隔离 PostgreSQL、Valkey 和假 S3 fixture，
  readiness 全部为 `true`，发现并执行 `10/10` workspace，`10` 通过、`0` 失败、
  `0` 跳过。
- Compose 使用项目名 `deploy` 执行 `up -d --build --wait --wait-timeout 900`，退出
  `0`。Core、Account API、Gateway、Loom、Web、Worker、
  Account Worker、Executor 均为 running/healthy，Tea 的鉴权 `/v1/status` 返回
  HTTP `200` 和 `status=ok`；九个应用进程 restart count 均为 `0`。Core / Account API /
  Gateway / Web readiness 均返回 HTTP `200`，两项附件 cleanup lease 字段已由迁移写入
  本地 PostgreSQL。
- Web 开发候选写入
  `../release/Platform/optimization-20260815-180048`：package verifier 校验
  `2242` 个 checksum 条目，独立解压后执行 `npm ci --omit=dev` 和 Next start，
  `/ready` 返回 HTTP `200`。该 manifest 明确为 `component=web` 且
  `gitDirty=true`，因此不是正式完整 Platform release。

当前修复批次、拆分收口门禁和 C 组性能批次均已完成；发布候选仍严格按
component/full-release 边界单独判定，见下方证据与当前发布事实。

## C 组继续收口证据（2026-08-16）

- operator product catalog 已使用不透明 cursor、`limit + 1` 有界读取和
  `updatedAt DESC, id DESC` 稳定排序；manual-review SLA workload 使用最多 `1000`
  条的 bounded scan，并在自动分配循环中复用本地 bucket，避免重复查询。
- arbitration `claim-next` 已在 PostgreSQL 中完成候选排序、`FOR UPDATE OF ac SKIP
  LOCKED` 原子领取和 open round 同步。stale 优先级通过按 round 解析的
  `make_interval` SQL CASE 复现 `getArbitrationReviewRoundPolicy(roundNumber).staleHours`，
  不再使用固定一小时阈值。
- Core JSON helper 统一了安全序列化、object 响应解析和非 JSON 2xx 的
  `JsonResponseProtocolError` 语义；相关 unit/performance contract 与全量 workspace
  typecheck 均通过。
- fresh `npm run ci`（`TOFU_BIN=.runtime/tools/opentofu-1.12.1/tofu.exe`）退出码为 `0`；
  repository/release/smoke contract、Web unit `383/383`、AI Gateway Vitest `67/67`、
  workspace typecheck 和 Next production build 均通过。Arbitration 与 product-order-item
  integration 各 `1/1` 通过。
- 新的 Web development candidate 写入
  `../release/Platform/optimization-c-20260816-034617`：manifest 明确
  `component=web`、`gitDirty=true`；verifier 校验 `2242` 个 checksum 条目，独立解压
  `npm ci --omit=dev` 后 `/ready` 返回 HTTP `200`。对应 smoke evidence 位于
  `.runtime/acceptance/Platform-optimization-c-20260816-034617-web-next-smoke.json`。
- 本地 Platform Compose 已使用当前工作树构建并保持运行：postgres、valkey、minio、
  core、account-api、gateway、web、worker、account-worker、executor、loom、tea 均
  running；带 healthcheck 的服务均为 healthy，Tea `/v1/status` 使用本地 token 返回 HTTP
  `200`；Web/Core/Account
  API/Gateway readiness 分别为 `3028/ready`、`4028/ready`、`4128/ready`、`4226/readyz`
  HTTP `200`。本地栈验证没有停止或清理兄弟项目容器。

上述 candidate 仍然只是 dirty Web component，不能替代完整 Platform release。正式
full release 仍需 clean Git、同一 clean commit 的 acceptance manifest，以及六个
`linux/amd64` immutable image lock/OCI source。

## 当前发布事实

`optimization-round4-20260813-2325` 等历史目录、`optimization-20260815-180048` 和
本轮 `optimization-c-20260816-034617` 都是 Web component 包，不是完整六镜像
Platform release；其 manifest 明确记录 `gitDirty: true`。在 clean commit acceptance
与 immutable image lock 缺失时，这些产物只能标记为开发候选，不能冒充正式 release。
