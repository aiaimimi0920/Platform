# 多 AI 重任务助手使用说明

## 目的

本文档用于承接旧 `多AI重任务助手使用说明.md`，作为新的 canonical 使用说明。

---

## 1. 当前核心脚本

当前重任务协调 helper 包括：

- `deploy/claim-heavy-task.ps1`
- `deploy/release-heavy-task.ps1`
- `deploy/show-heavy-task-status.ps1`
- `deploy/wait-heavy-task-available.ps1`
- `deploy/invoke-heavy-task.ps1`

---

## 2. 当前正式语义

默认同一时刻只允许一个对话处于：

- `heavy_active`

其他对话应进入：

- `polling_wait`

所有对话都可以在资源空闲时晋升为新的重任务 owner。

---

## 3. 当前正式结论

从现在开始：

- 多 AI 重任务助手已有新的 canonical 使用说明
- 若旧使用说明与本文冲突，以本文与 `rules/多AI重任务声明与轮询守则.md` 为准
