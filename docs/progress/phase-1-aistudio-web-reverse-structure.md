# Phase 1 - AIStudio Web Reverse Structure

## 目标

本阶段只处理 `AIStudio Web Reverse` 第一轮结构重组。

本阶段的目标不是扩能力，而是先把后续重构边界收清楚。

---

## 当前正式前提

1. 官方线统一收口到 `gemini official api`
2. 不再存在独立的 `AIStudio official` 实现线
3. AIStudio 当前唯一保留的专题线是：
   - `AIStudio Web Reverse`

---

## 本阶段范围

本阶段只允许承接以下目标：

- 为 `AIStudio Web Reverse` 建立独立 progress 主控文档
- 把 “官方线统一收口到 gemini official api” 回归到 canonical 文档
- 把 “第一轮只做结构重组，不新增能力” 回归到 canonical 文档
- 为后续协议层 / upstream 层的真正代码重组准备稳定文档边界
- 完成第一轮 `protocol` 与 `upstream` 目录重组
- 在不扩能力的前提下完成一轮结构级自检

---

## 本阶段非目标

本阶段明确不包含：

- 任何 JS / browser worker 代码重构
- 任何新的 protocol profile / adapter / preset 引入
- 任何新的能力 claim
- 任何对 `image edits / music / videos` 的 scope 扩张
- 任何把 `TTS / images` 当前 mixed lane 升格成 pure HTTP 已完成的表述

---

## 本阶段完成定义

只有同时满足下面条件，本阶段才算完成：

1. 存在新的 AIStudio Web Reverse progress master
2. 存在 Phase 1 专属 phase 文档
3. canonical 文档中已明确写入：
   - 官方线统一收口到 `gemini official api`
   - 不再存在 `AIStudio official` 独立实现线
   - 第一轮仅做结构重组
   - 当前能力面不扩大
4. `AIStudio Web Reverse` 当前已完成面仍只解释为：
   - `text`
   - `models`
   - `tools`
   - `embeddings`
   - `TTS`
   - `images`
5. `image edits / music / videos` 仍保持：
   - `未证明属于 AIStudio 正式能力域`

---

## 任务清单

- [x] 新建 `docs/progress/aistudio-web-reverse-MASTER.md`
- [x] 更新 canonical 文档，明确官方线统一收口到 `gemini official api`
- [x] 代码层拆出 `protocol/aistudio/common + web_reverse` 目录骨架
- [x] 代码层拆出 `upstream/aistudio/common + web_reverse` 目录骨架
- [x] 自检并归档首轮结构重组后的 caller-visible 契约保持情况

---

## 后续代码重组的预期边界

后续真正进入 code refactor 时，Phase 1 结构重组应优先朝以下方向推进：

- `gateway/src/protocol/aistudio/`
  - `common/`
  - `web_reverse/`
- `gateway/src/upstream/aistudio/`
  - `common/`
  - `web_reverse/`

这里特意不再包含：

- `official_api/`

因为官方线已经统一由 `gemini official api` owner。

---

## 当前风险提醒

- 当前仓库历史实现仍可能把 AIStudio 逻辑分散在旧文件中，但这不等于要恢复 `AIStudio official`
- 当前文档只能确认：
  - `AIStudio Web Reverse` 的既有完成面
  - 以及其第一轮结构重组目标
- 在没有新的测试归档与运行时证据前，不得把本阶段文档解释为“AIStudio 能力新增”

---

## 当前状态

- Phase：`completed`
- 本轮类型：`docs + rust-structure`
- 当前结论：
  - 结构重组基线已进入文档层
  - `protocol/aistudio` 与 `upstream/aistudio` 骨架已建立
  - `gateway/src/upstream/client.rs` 不再承载 AIStudio web reverse 主体实现
  - 已通过一轮独立 `CARGO_TARGET_DIR` 的 `cargo check`
  - 能力结论保持不扩面
