# 本地 Rust 编译隔离基线

## 目的

本文档用于承接旧 `legacy source: 本地Rust编译隔离规则.md` 中仍然有效的长期开发约束。

---

## 1. 当前正式规则

若存在多个 AI / 多个终端并行做 Rust 任务，默认必须：

- 显式设置独立 `CARGO_TARGET_DIR`

推荐位置：

- Windows / MSVC 日常轻量任务可用：
  - `.runtime/cargo-target-<task-or-agent>`
- 若会触发：
  - `boring-sys`
  - `cmake`
  - Visual Studio / MSBuild
  - 或其他深层原生依赖构建
  则默认优先使用更短的绝对路径：
  - `C:\t\<task-or-agent>`
  - `C:\t\cargo-<task>`

补充说明：

- 在当前 Windows 主机上，`CARGO_TARGET_DIR` 若落在过深的 `.runtime/...` 路径下，最终可能让 MSVC `FileTracker` / `CMakeScratch` 中间文件路径超过 `260` 字符
- 这会把问题表面化为：
  - `boring-sys`
  - `cmake`
  - `MSBuild FileTracker`
  之类的构建失败
- 因此：
  - **需要稳定跑完整 Rust `gateway` 编译 / 测试时，优先短路径**

---

## 2. 当前原因

如果多个进程共享默认 `target/` 并发编译，容易出现：

- 文件锁竞争
- 资源争抢
- 假性卡死

---

## 3. 当前正式结论

从现在开始：

- 本地 Rust 编译隔离已有新的 canonical 专题
- 若旧编译隔离说明与本文冲突，以本文与 `AGENTS.md` 为准
