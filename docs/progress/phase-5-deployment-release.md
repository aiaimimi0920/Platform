# Phase 5 部署与完整 release

- [x] `P5-01` Kustomize first-deploy/migration/digest/RBAC contract。
- [ ] `P5-02` staging/production OpenTofu validation。
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

产品状态仍为 `Platform 产品未完成`。
