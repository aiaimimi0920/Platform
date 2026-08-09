# Phase 5 部署与完整 release

- [x] `P5-01` Kustomize first-deploy/migration/digest/RBAC contract。
- [x] `P5-02` staging/production OpenTofu validation。
- [ ] `P5-03` Platform-local complete release builder with OCI layout and manifest。
- [ ] `P5-04` artifact-only release runtime smoke。

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
- OpenTofu 固定为 `1.12.1`，staging / production 均提交包含 `windows_amd64` 与 `linux_amd64` 校验值的 provider lock；CI 使用 `opentofu/setup-opentofu@v2` 和 `.opentofu-version`。
- `P5-02` 通过验证：
  - 官方 Windows 归档与发布清单 SHA-256 匹配，`tofu version` 为 `OpenTofu v1.12.1 on windows_amd64`。
  - `npm run infra:tofu:validate`：递归 fmt check、两个环境 `init -backend=false -lockfile=readonly`、provider-schema validate 全部通过。
  - `node --test scripts/acceptance/tests/tofu-contract.test.mjs scripts/repository-contract.mjs`：`15/15` 通过。
- 当前剩余边界：本任务没有配置真实 backend、没有使用云凭证，也没有执行 `plan` / `apply`；因此不证明 GCP/Cloudflare 权限、配额、资源创建、k3s、Ingress、DNS 传播或应用可用。真实部署与完整 release 仍属于后续任务。

产品状态仍为 `Platform 产品未完成`。
