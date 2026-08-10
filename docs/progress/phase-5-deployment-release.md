# Phase 5 部署与完整 release

- [x] `P5-01` Kustomize first-deploy/migration/digest/RBAC contract。
- [x] `P5-02` staging/production OpenTofu validation。
- [x] `P5-03` Platform-local complete release builder with OCI layout and manifest。
- [x] `P5-04` artifact-only release runtime smoke。

Acceptance: `release/Platform/<version>/` starts without source bind/build context and contains redacted evidence, migrations, deployment bundle, checksums and SBOM/dependency inventory.

## P5-01 完成记录

- 新增 `scripts/acceptance/tests/k8s-contract.test.mjs`，覆盖 staging/production Kustomize render contract：
  - 不含 `example.com`、`ghcr.io/example`、`:latest`、`replace-me`。
  - staging / production 分别使用 `neuroloom-staging`、`neuroloom-production` namespace，并通过 `staging-` / `production-` namePrefix 隔离资源名。
  - 所有 runtime image 以 `@sha256:<64 hex>` digest 形式渲染。
  - `core`、`ai-gateway-domain`、`account-domain` migration Job 均渲染，且 `ttlSecondsAfterFinished` / `restartPolicy: Never` 明确。
  - account-edge RBAC 降为 namespace-scoped Role/RoleBinding，不再使用 ClusterRole/ClusterRoleBinding，也不读取 Secret。
  - Gateway secret contract 显式列出，模板不带部署占位值。
- K8s base 改造：
  - `infra/k8s/base/kustomization.yaml` 移除固定 namespace，新增 `migrations.yaml`。
  - `infra/k8s/base/apps.yaml` / `cronjobs.yaml` 移除 `ghcr.io/example/*:latest`，改为 release 镜像基名，由 overlay 注入 digest。
  - `infra/k8s/base/configs.yaml` 移除 `example.com` / 示例 R2 地址，并补齐 Web/Core/Account/Gateway 的内部 URL 配置。
  - `infra/k8s/base/account-edge.yaml` 改为 namespaced Traefik edge，限制 watch 当前 namespace。
- K8s overlays 改造：
  - staging / production 各自新增 `namespace.yaml`、`config-patch.yaml`、`account-edge-patch.yaml`。
  - overlay 负责环境 URL、namePrefix、digest replacements 和 account-edge IngressClass 对齐。
- `infra/k8s/templates/secrets.example.yaml` 现在是空值 secret contract，不携带 namespace 或示例 secret；实际部署前需复制后填值并应用到目标 namespace。
- `deploy/apply-k8s.sh` 现在执行 render、placeholder gate、digest gate、namespace preflight、secret preflight、apply、migration wait、rollout status 和 in-cluster smoke。
- `deploy/run-migrations.sh` 移除 `example/latest` 默认镜像，要求 `IMAGE` / `ACCOUNT_IMAGE` 显式 digest-pinned。
- `P5-01` 通过验证：
  - `node --test scripts/acceptance/tests/k8s-contract.test.mjs`
  - `kubectl kustomize infra/k8s/overlays/staging`
  - `kubectl kustomize infra/k8s/overlays/production`
  - rendered manifest forbidden-token scan（staging / production 均无 `example.com`、`ghcr.io/example`、`:latest`、`replace-me`、空 digest、未前缀内部 service URL）
  - `bash -n deploy/apply-k8s.sh`
  - `bash -n deploy/run-migrations.sh`
- 当前剩余边界：GHCR 尚未存在 `ghcr.io/aiaimimi0920/neuroloom-platform-{core,web}:latest` manifest；因此 overlay digest 是 release-contract seed，不代表已经发布的真实 OCI artifact。实际 artifact digest 替换与 release bundle 仍属于 `P5-03`。

## P5-02 完成记录

- 新增 `scripts/acceptance/tests/tofu-contract.test.mjs`，先以 `0/5` RED 固化环境隔离、输入/secret、输出、模块安全和 CI 验证契约，实现后 `5/5` 通过。
- staging / production 现在分别使用 `platform/staging`、`platform/production` GCS state prefix；bucket 仅由忽略的 `backend.hcl` 提供，仓库不保存 bucket、credentials、tfvars 或 state。
- 两个环境保留不同资源前缀与子网，补齐非 secret 网络、控制面、节点、持久盘、服务账号和 DNS 输出；required provider inputs 无部署默认值，示例保持不可部署。
- GCP 网络内部规则从全 TCP/UDP 收敛为显式 k3s / PostgreSQL / Valkey / MinIO / VXLAN 端口并限定 target tag；SSH 与 ingress 拒绝 world-open CIDR。
- 节点启用专用服务账号和日志/监控最小写入角色、OS Login、project SSH key 阻断、Shielded VM，并将数据节点状态盘拆成独立 Persistent Disk。
- Cloudflare 子模块固定 `cloudflare/cloudflare` provider source，代理记录使用 TTL `1`；模块 provider source 缺失曾在首次真实 init 中触发错误的 `hashicorp/cloudflare` 解析，现已增加回归断言并从 lock 清除。
- OpenTofu 固定为 `1.12.1`，staging / production 均提交包含 `windows_amd64` 与 `linux_amd64` 校验值的 provider lock；CI 使用固定到完整 commit SHA 的 `opentofu/setup-opentofu` v2 和 `.opentofu-version`。
- `P5-02` 通过验证：
  - 官方 Windows 归档与发布清单 SHA-256 匹配，`tofu version` 为 `OpenTofu v1.12.1 on windows_amd64`。
  - `npm run infra:tofu:validate`：递归 fmt check、两个环境 `init -backend=false -lockfile=readonly`、provider-schema validate 全部通过。
  - `node --test scripts/acceptance/tests/tofu-contract.test.mjs scripts/repository-contract.mjs`：`15/15` 通过。
- 当前剩余边界：本任务没有配置真实 backend、没有使用云凭证，也没有执行 `plan` / `apply`；因此不证明 GCP/Cloudflare 权限、配额、资源创建、k3s、Ingress、DNS 传播或应用可用。真实部署与完整 release 仍属于后续任务。

## P5-03 完成记录

- 新增 `scripts/acceptance/release-build.mjs` 与 `scripts/acceptance/tests/release-build.test.mjs`，并提供 `npm run release:build`。
- complete release builder 强制只写入 sibling `../release/Platform/<versionId>/`，拒绝仓库内 release、任意 output override、已有 destination、symlink 与脏工作树；构建期间 Git revision 或 dirty 状态发生变化也会失败。
- release 输入必须来自同一 clean commit 的 passed acceptance manifest，并且 required / external-boundary counters 必须与逐条 result 一致；required 不允许 not-applicable，外部边界只允许 evidence-backed not-applicable。
- 镜像输入严格二选一：同 revision 的六镜像 immutable lock，或恰好六个 `linux/amd64` OCI layout。最终 Compose/Kustomize 均替换为实际 `neuro-platform-*` immutable digest，release 不包含 source build context。
- 完整 payload 包含 Web package、六镜像 inventory/可选 OCI layouts、三域 migration 及显式顺序、Compose/K8s/OpenTofu、environment contracts、脱敏 acceptance evidence、dependency inventory 与全文件 SHA-256；唯一 staging 目录在全部校验成功后才原子 rename。
- `P5-03` 验证：
  - `node --test scripts/acceptance/tests/release-build.test.mjs scripts/acceptance/tests/release-smoke.test.mjs`：`10/10` 通过（含后续 P5-04 合同）。
  - `npm run ci`：退出 `0`；仓库/结构门禁、OpenTofu、生产依赖审计、全 workspace tests、Vitest、typecheck 与 Next production build 均通过。
- P5-03 构建器随后已使用同一 clean commit 的正式 acceptance 生成 release；实际 artifact 与 runtime smoke 证据见 P5-04。

## P5-04 完成记录

- 正式 `V0.1.0` release 已原子发布到 canonical sibling `../release/Platform/V0.1.0`，来源为 clean revision `3d2f653663eb4796362ffa278eafd74df308ec7d` 与 passed acceptance run `platform-1786323406483-58880-5e89cba0`。
- release 包含六个真实 `linux/amd64` OCI layout、3 个 migration domain 共 227 个 SQL 文件、Web 包、部署与环境合同、脱敏 acceptance evidence、依赖清单，以及精确覆盖 2598 个文件的 SHA-256 inventory。
- Windows OCI import 使用相对于 run-owned smoke resources 的 drive-free URI，规避 Buildx 把绝对盘符误解析为 image reference；不同盘符会 fail closed。
- artifact-only override 在 executor 首次运行前等待 Core `service_healthy`，避免低频执行循环在 Core 监听前失败后进入最长 180 秒冷却；该门禁不放宽 executor readiness。
- 启动失败时先解析 Compose `ps`，再只采集 unhealthy/非零退出服务的有界脱敏日志；失败清理只删除实际成功导入的临时 OCI 标签。
- 正式验证命令：`npm run acceptance:release -- --package-dir ../release/Platform/V0.1.0 --run-id release-smoke-v0-1-0-cf8a112 --evidence-path .runtime/acceptance/release-smoke-v0-1-0-cf8a112/release-smoke.json`。
- fresh evidence 为 `status: passed`、`cleanup.completed: true`：六次 OCI import、Compose up、process inventory、Core/Account/Web readiness、Linux.do 登录入口、Compose down 与六个临时镜像删除均退出 `0`；运行后对应容器、卷和临时标签均为零。

产品状态仍为 `Platform 产品未完成`。
