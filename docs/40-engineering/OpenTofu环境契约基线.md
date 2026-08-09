# OpenTofu 环境契约基线

## 适用范围

本基线约束 `infra/tofu/` 下 Platform 自有的 GCP 标准 IaaS 与 Cloudflare DNS。它不授权真实云资源变更，也不改变 `AGENTS.md` 中“GCP 可替换、应用面保持 OCI + k3s 可移植”的架构边界。

## 工具与 provider

- OpenTofu 版本由仓库根 `.opentofu-version` 固定，开发机和 CI 使用同一版本。
- 根环境和子模块必须显式声明 provider source；Cloudflare 只允许 `cloudflare/cloudflare`，Google 只允许 `hashicorp/google`。
- staging / production 各自提交 `.terraform.lock.hcl`，至少包含 `windows_amd64` 与 `linux_amd64` 校验值。
- 日常验证必须使用 `npm run infra:tofu:validate`。该命令执行递归格式检查、`init -backend=false -lockfile=readonly` 和 provider-schema `validate`。

## 环境与状态隔离

- staging 与 production 必须使用不同的资源前缀、子网 CIDR 和 GCS state prefix。
- `backend.tf` 只提交稳定的 state prefix，不提交 bucket、credentials 或访问令牌。
- bucket 通过忽略的 `backend.hcl` 显式选择；实际 bucket 必须启用版本保留、统一 bucket 级访问，并满足组织的加密和保留策略。
- 不得提交 `backend.hcl`、`terraform.tfvars`、`.terraform/`、state、crash log 或 provider credentials。

## 输入与网络安全

- GCP project、Cloudflare token、zone id、根域名和对象存储 CNAME 目标不得有可部署默认值。
- token 必须标记为 sensitive，并通过受保护的运行时变量或批准的 secret manager 注入。
- 示例值必须保持不可部署；变量验证必须拒绝占位符和 world-open `0.0.0.0/0` / `::/0` 管理与入口网段。
- 内部防火墙只开放已审查的 k3s、数据服务和 overlay 网络端口，并通过 target tag 限定节点范围；SSH 只命中管理节点标签。
- 节点使用专用最小权限服务账号、OS Login、禁用 project-wide SSH key、Shielded VM；实例 metadata 只允许模块生成的安全开关与受限角色，不接受调用方任意键值；状态数据使用独立持久盘，不与可删除 boot disk 混合。

## 输出与部署边界

- 环境输出只提供后续 k3s / Cloudflare 步骤需要的非 secret 网络、节点、持久盘、服务账号和 DNS 信息。
- CI 不执行 `plan` 或 `apply`，不连接 GCS backend，也不需要真实云凭证。
- 真实 `plan` / `apply` 必须由明确授权的环境发布流程执行，使用非占位输入、经审查凭证和显式 backend 配置。
- `tofu validate` 成功只证明 HCL 与锁定 provider schema 相容，不证明云账户权限、配额、现存资源、k3s、Ingress、DNS 传播或应用运行时可用。
