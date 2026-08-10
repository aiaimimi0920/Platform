# Platform P2 Register

状态：`P6-04 active register`。本文件只登记不影响当前核心正确性和 artifact 交付的内部 P2；外部账号、额度、云权限和 live 服务状态必须留在 `conditional-live` / `external-blocked`，不得混入本表。

## Active P2

| ID | Owner | 边界与证据 | 不阻塞理由 | 升级或处理触发条件 |
| --- | --- | --- | --- | --- |
| `P2-CI-001` | Platform CI / repository maintainers | `.github/workflows/ci.yml`、`.github/workflows/container-images.yml` 与 `.github/workflows/release-platform-tag.yml` 的第三方 Actions 当前使用受控 major tag，而不是完整 commit SHA。 | 本地门禁与 hosted workflow 当前通过，未发现 action provenance 异常；该项不改变产品运行时、数据正确性或 release artifact 内容。 | 仓库启用强制 SHA pin policy、上游 major tag 出现非预期移动或安全公告时，立即固定到审计后的完整 SHA；若已造成 artifact provenance 不可信，升级为 P1。 |
| `P2-REL-001` | Platform release governance | tag workflow 在发布前会重新 fetch 并确认 tag 未移动，但该检查与 GitHub Release API 调用之间仍有极短竞态；仓库内 workflow 无法单独证明远端 tag protection 已启用。 | 利用需要具备 tag 写权限并在发布窗口主动移动 tag；workflow 已校验 tag 格式、版本、checkout SHA、`origin/main` ancestry、镜像锁 revision，并在发布前二次检查。当前尚未创建正式 tag。 | 创建首个正式 Platform tag 前，在 GitHub repository rules 中启用 `V*` tag protection/immutability；若无法建立远端保护，则在发布签收前升级处理。 |
| `P2-CI-002` | Platform CI maintainers | Linux CI 将 workspace tests 与 typecheck 放在单一顺序 job；Windows job主要验证 release build/verifier/smoke contract，完整 immutable release 由 tag workflow执行。 | 这是反馈时延和维护性问题；所有 required gates 仍真实执行，tag workflow另行运行 integration、构建、验证和 runtime smoke，不存在测试被删除或静默跳过。 | 常规 CI 接近 `30` 分钟 timeout、队列成本或失败定位时间持续影响交付时，再拆分矩阵；任何拆分不得减少 required suite 或 release smoke。 |

## 已核销或明确排除

- 历史 `3 high severity vulnerabilities` 不再是当前债务：2026-08-10 fresh `npm run audit:prod` 输出 `found 0 vulnerabilities`。
- public-surface 兼容 wrapper 不再是遗留项：`bb5580b` 删除 all-enabled fallback，正式调用面改为 strict dependency envelope、明确 unavailable 状态和 fail-closed visibility。
- release evidence link escape 不是 P2：它曾是 P1，已由 `47f2234` 使用 symlink/junction、hard-link、realpath、文件身份与重复校验修复并回归。
- OpenTofu backend、云端 `plan/apply`、live cluster/DNS、Linux.do/Gateway/Loom/Tea live 配置属于部署或外部签收边界，不是内部 P2。
- main push 发布 branch/sha 容器镜像是 README 已声明的连续镜像策略；`4014b1d` 仅阻止任意分支 `workflow_dispatch` 获得 GHCR 写路径，保留 main 与 `V*` tag 行为。

## Review rule

- 每个 active P2 必须保持唯一 owner、明确边界和升级条件。
- 若任一项开始影响核心旅程、权限、数据、凭证、可重复验收或空环境 release 启动，必须移出本表并升级为 P0/P1。
- P6-04 最终签收时必须复核本表，不得用 P2 标签降级真实 blocker。
