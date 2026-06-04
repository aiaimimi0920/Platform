# Gemini 模块化开发规范

> 说明：这份文件现在是 **Gemini 具体落地实例规则**，不再是仓库级通用守则。
> 仓库级的通用规则当前见：
> - `rules/多Surface模块化开发守则.md`
>
> 后续若是面向所有服务商、所有多 surface / 多协议 / 多 owner 开发的统一约束，
> 应优先遵守通用守则；本文件只作为 Gemini 的具体映射与约束补充。

适用范围：

- `gateway/src/protocol/gemini/**`
- `gateway/src/upstream/gemini/**`
- 以及所有未来新增的 Gemini 相关协议、运行时、编译开关、provider surface 实现

本文档用于固定 Gemini 相关代码的**目录分层、编译边界、迁移方式、多人/多 AI 并行开发边界**。

---

## 1. 背景与目标

当前仓库里的 Gemini 相关能力已经明确分化为三条主线：

1. `official_api`
2. `web_reverse`
3. `canvas_web_reverse`

历史问题是：

- 三条线长期共享大文件，尤其是 `gateway/src/upstream/client.rs`
- 多个 AI / 多个开发者在并行推进时，容易重复修改同一文件
- `legacy mixed lane`、`browser-owned relay`、`program-owned Canvas` 容易在实现层被重新混在一起
- 某些部署场景只需要 `web_reverse + canvas_web_reverse`，不希望把 `official_api` 一起编进程序

因此，从现在开始，Gemini 相关实现必须以**模块化目录边界 + 按需编译 feature gate + copy-only 并行新实现**为正式基线。

---

## 2. 顶层目录分层

Gemini 相关代码至少必须拆成以下四个主目录概念：

1. `gemini/common`
2. `gemini/official_api`
3. `gemini/web_reverse`
4. `gemini/canvas_web_reverse`

允许继续细分，但不得少于这四层。

推荐代码落点：

- 协议层：
  - `gateway/src/protocol/gemini/common/`
  - `gateway/src/protocol/gemini/official_api/`
  - `gateway/src/protocol/gemini/web_reverse/`
  - `gateway/src/protocol/gemini/canvas_web_reverse/`
- 上游执行层：
  - `gateway/src/upstream/gemini/common/`
  - `gateway/src/upstream/gemini/official_api/`
  - `gateway/src/upstream/gemini/web_reverse/`
  - `gateway/src/upstream/gemini/canvas_web_reverse/`

如果短期内为了迁移兼容仍保留单文件入口，例如：

- `gateway/src/protocol/gemini/mod.rs`
- `gateway/src/upstream/gemini/mod.rs`

它们也只能承担：

- re-export
- feature gate 分发
- 薄路由

不得重新退化成新的大而全实现文件。

---

## 3. 四层职责边界

### 3.1 `gemini/common`

只允许承载 Gemini 三条线共享、且**不依赖某一条具体 surface owner 语义**的内容，例如：

- 共享类型定义
- 共享错误类型
- 共享模型别名/模型选择规则
- 共享 credential material 解析
- 共享 URL/ID/response body 小工具
- 共享 feature gate / capability 枚举

禁止放入：

- 某条具体上游 contract 的请求构造
- 某条线专有的 bootstrap / preflight / follow-up
- 某条线专有的 browser/runtime owner 逻辑

原则：

- `common` 只能被三条线依赖
- `common` 不得反向依赖 `official_api / web_reverse / canvas_web_reverse`

### 3.2 `gemini/official_api`

只承载官方 API 面：

- `google_gemini_api`
- `google_vertex_gemini`
- 后续官方模型 API / live API 兼容

这里的实现必须坚持：

- 只处理官方 API contract
- 不混入网页 session/replay 逻辑
- 不依赖 browser state 作为默认 owner

### 3.3 `gemini/web_reverse`

只承载 generic Gemini Web reverse 能力。

这里包括：

- `gemini_web`
- 当前已明确应迁入这条线的 legacy pure-HTTP mixed lane 资产
- 文本 / TTS / 图片 / 图片编辑 / 音乐 / 视频等，前提是它们本质仍是 generic web reverse contract

这里必须坚持：

- 不把它误称为 true Canvas owner
- 不把 Canvas program quota 语义偷偷塞回这条线

### 3.4 `gemini/canvas_web_reverse`

只承载 true Canvas owner 主线。

这里必须继续显式区分：

1. browser-owned Canvas relay
2. program-owned Canvas relay
3. browserless pure HTTP Canvas quota reverse

这条线的正式核心原则是：

- **先建立有效 Canvas 程序**
- **再通过该程序进行访问**
- 当前 `program-owned` 的 canonical 真相应继续理解为：
  - `bootstrap context`
  - `app-endpoint contract`
  - steady-state invoke
- 不得再把 `program-owned` 简化成：
  - generic `/app` 对话 replay
  - 或 browser-backed prompt execution 主链

如果某条实现路径不能证明这两步成立，它就不能被定义为 true Canvas owner，只能算：

- browser-backed helper
- generic web reverse 参考路径
- 或 legacy mixed lane 资产

---

## 4. 进一步细分建议

在四层主目录下，允许继续细分到更稳定的子目录。推荐模式如下。

### 4.1 `common` 推荐子目录

- `common/types`
- `common/errors`
- `common/models`
- `common/credentials`
- `common/feature_flags`
- `common/utils`

### 4.2 `official_api` 推荐子目录

- `official_api/conversation`
- `official_api/live`
- `official_api/models`
- `official_api/auth`
- `official_api/request_builders`
- `official_api/response_parsers`

### 4.3 `web_reverse` 推荐子目录

- `web_reverse/bootstrap`
- `web_reverse/session`
- `web_reverse/stream_generate`
- `web_reverse/media`
- `web_reverse/tts`
- `web_reverse/image_edits`
- `web_reverse/runtime_refresh`

### 4.4 `canvas_web_reverse` 推荐子目录

- `canvas_web_reverse/program`
- `canvas_web_reverse/bootstrap`
- `canvas_web_reverse/browser_owned`
- `canvas_web_reverse/program_owned`
- `canvas_web_reverse/pure_http`
- `canvas_web_reverse/media`
- `canvas_web_reverse/text`
- `canvas_web_reverse/runtime_material`

---

## 5. 按需编译基线

Gemini 相关实现必须支持按需编译，不得默认把全部三条线强绑在一个不可裁剪的目标里。

最少应支持以下 feature gate 概念：

- `gemini-common`
- `gemini-official-api`
- `gemini-web-reverse`
- `gemini-canvas-web-reverse`

推荐组合：

1. 仅官方：
   - `gemini-common + gemini-official-api`
2. 仅网页反代：
   - `gemini-common + gemini-web-reverse`
3. 仅 true Canvas：
   - `gemini-common + gemini-canvas-web-reverse`
4. 网页反代 + Canvas：
   - `gemini-common + gemini-web-reverse + gemini-canvas-web-reverse`
5. 全量：
   - `gemini-common + gemini-official-api + gemini-web-reverse + gemini-canvas-web-reverse`

必须明确支持的一个场景是：

- **只编译 `web_reverse + canvas_web_reverse`**
- **不编译 `official_api`**
- **Gemini 的三条主实现线分别独立编译**

因此：

- 任何 `web_reverse` / `canvas_web_reverse` 不得在编译时硬依赖 `official_api`
- 若某些共享工具同时被 `official_api` 使用，必须下沉到 `common`

Gemini 当前测试/开发阶段推荐直接固定三套独立编译目录：

- `.runtime/cargo-target-gemini-official-api-<task-or-agent>`
- `.runtime/cargo-target-gemini-web-reverse-<task-or-agent>`
- `.runtime/cargo-target-gemini-canvas-web-reverse-<task-or-agent>`

不得再把 Gemini 的三条主实现线压成一套共享测试编译产物。

---

## 6. 文件写入边界

### 6.1 禁止继续扩张 `gateway/src/upstream/client.rs`

从现在开始，Gemini 相关的新实现不得继续把核心逻辑堆进：

- `gateway/src/upstream/client.rs`

允许它保留的角色仅包括：

- 迁移期薄分发
- 兼容入口总调度
- 向新模块转发调用

不允许在其中继续新增：

- 大段 Gemini 专有 bootstrap / preflight / follow-up 逻辑
- 三条线混写的 media/text/runtime owner 逻辑

### 6.2 旧代码保留规则

当前 Gemini 历史实现包袱很重，因此本轮及后续同类重构，默认继续采用：

- **copy-only parallel new implementation**

也就是：

- 可以复制旧逻辑作为迁移资产
- 可以在新目录中重组
- 不删除旧逻辑
- 不要求第一轮就替换旧实现

只有在满足以下条件后，才允许收缩/删除旧逻辑：

1. 新模块已接线
2. focused live/fixture 已通过
3. 相关 full suite 已通过或边界已明确
4. 文档与规则已同步

---

## 7. 多 AI / 多开发者并行协作规则

为避免多个 AI 或多个开发者反复撞同一个文件，Gemini 开发默认按**目录 ownership** 划分任务。

推荐分工：

- Agent A：`common`
- Agent B：`official_api`
- Agent C：`web_reverse`
- Agent D：`canvas_web_reverse`

并行开发时必须遵守：

1. 一个任务只能写自己负责的子树
2. 若确需修改 `common`，必须明确说明共享原因
3. 不得两个 agent 同时改同一条具体 surface 的实现文件
4. `mod.rs`、入口注册文件、feature gate 接线文件，必须作为最后集成层处理，不得让多个 agent 同时反复修改

如果任务目标还没明确归属哪条线，先定 owner，再动代码。

---

## 8. Canvas 线的特殊规则

`canvas_web_reverse` 这条线必须额外遵守以下规则：

1. **program-first 是硬约束**
   - 先建 program
   - 再通过 program 调用
2. 任何不能证明 program-first 的路径，不能直接宣称为 true Canvas owner
3. `generic /app`、`share page`、`generateContent proxy` 只能作为：
   - 低层参考
   - 过渡实现
   - fallback/diagnostic
4. 当前已写回 runtime 的：
   - `canvasProgramOperation`
   - `bootstrapOperation`
   必须继续保留，不得回退
5. 当前 `program-owned` 若已发现 app-endpoint transport 提示，允许继续显式保存到 runtime material，例如：
   - `invokeBaseUrl`
   - `musicWsUrl`
   - `videoInvokePath`
   - `canvasProgramAction`
   - `canvasProgramActionInput`
   这些字段属于 `Canvas app invoke contract`，不得被重新解释成 generic official API 配置
6. 当请求 modality 与当前 handle 不一致时：
   - 必须 fresh bootstrap
   - 不能继续复用旧 handle

---

## 9. 编译与发布规则

后续若为 Gemini 模块化增加 Cargo feature、构建参数或镜像裁剪逻辑，必须同步更新：

- `Cargo.toml`
- 构建脚本 / Dockerfile / deploy helper
- 文档
- `AGENTS.md`

必须保证：

- feature 关闭时，相应目录可以不参与编译
- feature 打开时，模块边界不被绕过

---

## 10. 文档同步规则

凡是 Gemini 四层分层、feature gate、目录 ownership、program-first 原则发生变化，必须同轮同步：

- `rules/gemini-modular-development-rule.md`
- `AGENTS.md`
- 相关 progress 文档
- 相关 baseline 文档

不得把“新的模块边界”只留在聊天上下文里。

---

## 11. 当前冻结结论

截至当前，这份规范冻结以下原则为后续默认基线：

1. Gemini 必须至少拆成：
   - `common`
   - `official_api`
   - `web_reverse`
   - `canvas_web_reverse`
2. Gemini 必须支持按需编译。
3. `web_reverse + canvas_web_reverse` 必须允许单独编译，不依赖 `official_api`。
4. `gateway/src/upstream/client.rs` 是真实维护债务，不得继续作为 Gemini 新逻辑主落点。
5. true Canvas 线必须坚持 program-first，而不是 generic web reverse 假装 Canvas。
6. 多 AI 并行开发必须以目录 ownership 为主，不再以“大文件里插入几段新逻辑”的方式推进。
