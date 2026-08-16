# Platform 代码优化计划（2026-08-17）

本计划建立在 `defb97efd2666bc3dc8bdd516c076ad512781565` 的 clean Platform
基线上。`2026-08-15` 计划中的权限、并发、分页、模块拆分和 JSON helper 项目已经
完成，本轮不重复这些工作。

## 目标与边界

- 只修改独立 `Platform` 仓库拥有的源码、测试、文档和发布工具。
- 选择能从当前调用链直接证明，并能通过自动化测试验证的性能或可靠性问题。
- 保持现有单 Agent capability API、页面语义和 release package 格式兼容。
- 不增加数据库迁移，不扩张旧 TypeScript Gateway ownership，不修改兄弟仓库。

## 复核结论

| 优先级 | 问题 | 当前证据 | 本轮处理 |
| --- | --- | --- | --- |
| P1 | 自有 Agent capability 读取是 N+1 HTTP/SQL fan-out | `/my-agents`、Agent Center、任务市场按 Agent 调用 `/v1/agents/:agentId/capabilities` | 增加 owner-scoped capability catalog，一次 join 查询返回全部自有能力；保留原单 Agent API |
| P1 | 任务提案读取使用无界 `Promise.all(tasks.map(...))` | Agent Center 和任务市场会按当前任务数量同时请求 Core | 复用 `mapWithConcurrency`，保持顺序并限制并发 |
| P2 | 任务市场首屏存在可避免 waterfall 和 `O(tasks * cases)` 分组 | feature/tasks 串行读取；每个 task 都重新过滤全部 arbitration cases | 并行独立读取，并用一次线性遍历建立 task -> cases 索引 |
| P1 | OCI release smoke 不能显式选择 Buildx builder，失败证据丢失 | Docker driver BuildKit `v0.30.0` 对 `oci-layout://` 返回 `unknown scheme`；失败 import 未进入 evidence | 增加可选 builder 参数、参数校验和脱敏失败输出；不硬编码本机 builder 名 |

## 实施批次

### A. Capability catalog

- Core repository 使用 owner join 一次读取 capability catalog。
- Core 增加静态 owner-scoped catalog route，原动态 route 保持不变。
- Web client 和需要全部自有能力的页面切换到单请求 catalog。
- 集成测试证明 catalog 不返回其他 owner 的 capability。

### B. Web fan-out 与分组

- Agent Center 与任务市场的 task proposal 请求使用固定并发上限。
- 任务市场并行加载互不依赖的首屏数据。
- 仲裁案例使用线性分组，保持每个 task 都有稳定空数组条目。

### C. Release smoke 可靠性

- CLI 支持可选 `--buildx-builder <name>`。
- builder 名只允许 Docker Buildx 可移植名称字符，拒绝空值和命令形态输入。
- OCI import 无论成功或失败都写入 evidence；失败输出经过既有 secret redaction。
- 文档记录 Docker driver 不支持 `oci-layout://` 时的显式 builder 用法。

## 验收与停止条件

1. 新增 focused tests、Core/Web unit、typecheck 通过。
2. agent-registry integration 证明 owner 隔离和 catalog 结果。
3. release smoke tests 覆盖 builder 参数和脱敏失败 evidence。
4. `git diff --check`、`npm run ci`、required integration fresh 通过。
5. 从 clean commit 生成 acceptance manifest、六个 `linux/amd64` OCI layout、正式
   `../release/Platform/<versionId>`，并通过 artifact-only smoke。

正式发布完成后不再回写本文件，以免产生与 acceptance/release revision 不一致的新
HEAD；最终发布事实由 release manifest 和独立 smoke evidence 持有。
