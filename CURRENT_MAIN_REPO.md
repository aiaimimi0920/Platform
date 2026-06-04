# 当前 Platform 工作目录说明

更新时间：`2026-06-04`

## 当前正式 Platform 工作目录

当前 `Platform/` 已迁移到新的 Neuro 顶层工作区。后续 Platform
网站、账户、权益、运营后台、Platform 本地预览与 Platform 侧 Gateway
集成开发，默认以本目录为准：

- `C:\Users\Public\nas_home\AI\GameEditor\Neuro\Platform`

顶层工作区目录为：

- `C:\Users\Public\nas_home\AI\GameEditor\Neuro`

## 与旧 NeuroPlatform 目录的关系

旧目录：

- `C:\Users\Public\nas_home\AI\GameEditor\NeuroPlatform`

当前只作为历史来源、对照参考或本地运行态材料来源使用。除非用户明确要求在
旧目录中维护或取证，否则不要把新的 Platform 开发继续写回旧
`NeuroPlatform` 目录。

## 当前边界

- `Platform/` owns:
  - website / Next.js web surface
  - account, identity, quota, entitlement, product, and operator flows
  - Platform-local compose topology and operational helper scripts
  - Platform-side Gateway API integration contracts
- `../Gateway/` owns:
  - Rust AI gateway runtime
  - provider relay implementation
  - gateway manifests, line validators, binary/image packaging, and Gateway release helpers
- `../Loom/` owns:
  - headless AI brain, workflow orchestration, agents, durable events, memory, hooks, and Gateway client integration
- `../Hook/` owns:
  - foreground capture / desktop interaction integration

Platform must call or manage Gateway through Gateway APIs, shared contracts, local
compose services, or `~/.neuro` credential material. Platform must not vendor the
Rust Gateway source tree or Gateway-only release helpers back into `Platform/`.

## 当前验证入口

在 `C:\Users\Public\nas_home\AI\GameEditor\Neuro\Platform` 下：

```powershell
npm run smoke
npm run typecheck -ws --if-present
docker compose -f deploy/docker-compose.local.yml config --quiet
```

如果全量 workspace typecheck 在 Windows / NAS 工作区中耗时过长，可以按
workspace 拆分验证，但最终结论必须说明实际运行的是全量命令还是拆分命令。

## 本地运行态材料

仓库中允许保留未跟踪的本地运行态材料，例如：

- `.runtime/`
- `.next/`
- `test-results/`
- provider credential / browser-state capture artifacts

这些内容默认是本地现场，不代表应该作为 Platform tracked source 提交。
判断 Platform 源码边界时，优先看 tracked diff、`MIGRATION_NOTES.md`、
`README.md`、`AGENTS.md` 与 `scripts/smoke.mjs` 的验证规则。
