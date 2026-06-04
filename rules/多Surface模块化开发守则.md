# 多 Surface 模块化开发守则

适用范围：

- 本仓库内所有具备以下任一特征的新开发或重构任务：
  - 多协议入口
  - 多 product surface
  - 多 source kind
  - 多 owner/runtime 语义
  - 多种调用/反代/官方 API 并存
  - 多 AI / 多开发者并行开发

典型适用对象包括但不限于：

- `Gemini`
- `Qwen`
- `ChatGPT Web Reverse`
- `AIStudio Web Reverse`
- 以及未来任何同时存在 `official_api / web_reverse / 特定产品 reverse surface` 的复杂集成

---

## 1. 目标

这份守则的核心目标只有四个：

1. 避免把多条实现线重新堆回单个大文件
2. 保证不同 surface / owner 的边界长期清晰
3. 支持按需编译，不把不需要的模块强绑进程序
4. 让多 AI / 多开发者可以按目录并行开发，而不是反复撞同一文件

---

## 2. 适用判定

当某个功能或服务同时满足下列任一条件时，默认必须套用本守则：

- 同一服务商下存在多条真实不同的 product surface
- 同一服务商下同时存在官方 API 与网页反代
- 同一能力存在不同 owner 语义，例如：
  - official API owner
  - browser-owned relay
  - program-owned relay
  - pure HTTP replay
- 当前实现已经出现：
  - 单文件持续膨胀
  - 多 agent 同改一个文件
  - 相邻 surface 被误混
  - 编译时无法裁掉不需要的集成线

---

## 3. 顶层分层原则

任何复杂集成都必须先按**真实 surface / owner 边界**拆目录，而不是按临时 adapter 名字或历史大文件位置组织。

最小分层原则：

1. `common`
2. `official_api`
3. `web_reverse`
4. 每一个**特定产品面**独立目录

也就是说，除了 `common`、`official_api`、`web_reverse` 这三种常见基础层外：

- 任何具有独立 quota domain / capability domain / execution contract 的产品面
- 都必须单独建目录

例如：

- `canvas_web_reverse`
- `studio_web_reverse`
- `assistant_web_reverse`
- `consumer_app_reverse`

禁止做法：

- 把多个 surface 继续混在同一个 `client.rs`
- 用同一个 `web_reverse` 目录承载两个本质不同的 quota domain
- 先在大文件里加判断分支，再事后解释“其实它们逻辑不同”

---

## 4. 通用目录模板

对于任何一条复杂服务商/子系统，推荐的最小目录模板如下：

```text
<domain>/<provider>/
  common/
  official_api/
  web_reverse/
  <product_surface_a>/
  <product_surface_b>/
```

如果是 Rust gateway 这类双层结构，推荐同时在协议层与上游执行层保持镜像分层：

```text
gateway/src/protocol/<provider>/
  common/
  official_api/
  web_reverse/
  <product_surface_a>/

gateway/src/upstream/<provider>/
  common/
  official_api/
  web_reverse/
  <product_surface_a>/
```

允许存在：

- `mod.rs`
- `registry.rs`
- `feature_flags.rs`

但它们只能做：

- re-export
- feature gate 接线
- 薄分发

不得重新演化成新的核心实现堆放点。

---

## 5. 各层职责边界

### 5.1 `common`

`common` 只允许放：

- 共享类型
- 共享错误
- 共享模型/别名
- 共享 credential material 解析
- 共享序列化/反序列化小工具
- 共享 capability / feature 枚举
- 共享无 owner 语义的 helper

`common` 不允许放：

- 具体 surface 的 bootstrap / preflight / follow-up
- 某条线专有的 owner 逻辑
- 某条线专有的请求体/状态机

规则：

- `common` 可以被其他层依赖
- 其他层的实现细节不得反向渗透回 `common`

### 5.2 `official_api`

只处理官方 API 面。

必须满足：

- 不混网页 session/replay
- 不依赖 browser state 作为正式 owner
- 不把 reverse-web fallback 塞进官方层

### 5.3 `web_reverse`

只处理 generic web reverse。

这里可以承载：

- generic page bootstrap
- cookie/session replay
- 纯 HTTP 页面协议回放
- legacy mixed lane 迁移资产

但不能冒充：

- true product-specific owner
- program quota owner

### 5.4 特定产品 surface 目录

任何具备独立产品语义的 surface，都必须独立。

判定标准：

- quota 计算独立
- product page 独立
- 调用合同独立
- bootstrap / owner 不同

只要满足任一条，就不应继续塞进 generic `web_reverse`。

---

## 6. 进一步细分建议

每一层内部允许继续细分，推荐按职责拆：

- `bootstrap/`
- `session/`
- `request_builders/`
- `response_parsers/`
- `runtime_material/`
- `browser_owned/`
- `program_owned/`
- `pure_http/`
- `media/`
- `text/`
- `tts/`
- `image_edits/`
- `followups/`
- `feature_flags/`

原则：

- 一层目录只承载一类职责
- 一条文件不要同时承载多类 owner 逻辑

---

## 7. 按需编译守则

任何多 surface 系统都必须支持按需编译。

最小要求：

1. `common` 必须可独立成为基础 feature
2. 每条主线必须有自己的 feature gate
3. 不需要的主线必须允许完全不参与编译

推荐 feature 设计：

- `<provider>-common`
- `<provider>-official-api`
- `<provider>-web-reverse`
- `<provider>-<product-surface>`

必须支持的典型场景：

- 只编 `web_reverse + 特定产品 surface`
- 不编 `official_api`
- 同一服务商下若存在多条本质不同的实现线，则必须允许按**实现线**分别独立编译

当前这里要特别强调：

- “独立编译”的最小粒度默认不是“服务商名”
- 而是“服务商下的具体实现线 / 具体 surface owner”

例如：

- `Gemini`
  - `official_api`
  - `web_reverse`
  - `canvas_web_reverse`

虽然名义上属于同一个服务商，但测试和开发阶段都必须允许拆成三套独立编译产物。

因此：

- `web_reverse` 不能在编译时硬依赖 `official_api`
- 产品 surface 也不能隐式强绑 `official_api`
- 若有共享逻辑，应下沉到 `common`

当前还必须补一条镜像预算规则：

- 若某个服务商的某条实现线在开发过程中需要频繁编译并产出新的开发镜像，这本身是被允许、也是预期效果
- 但开发镜像必须按**实现线**及时做冗余清理
- 冗余镜像定义：
  - 例如先编译出版本 `A`
  - 后续因功能缺失或逻辑变更又编译出版本 `B`
  - 若 `A` 不再承载当前有效回归价值，则 `A` 应视为冗余镜像并删除
- 若旧镜像对应的关键测试数据后续仍需核查，默认应保留：
  - 测试归档
  - 关键日志
  - caller-visible 回包
  - 关键截图 / 抓包 / summary
  - 而不是长期保留旧镜像本体
- 当前正式预算：
  - **一个服务商的一条实现线，理论上最多只允许并存 5 个开发镜像**
- 若需要继续产出第 6 个及之后的新开发镜像，默认必须先删除旧的无效开发镜像，再腾出空间产出新镜像

---

## 8. 迁移方式守则

面对历史包袱大的旧实现，默认采用：

- **copy-only parallel new implementation**

也就是：

- 允许复制旧实现里的有效代码
- 在新目录里重组
- 旧代码先保留
- 不要求一轮就替换旧链路

禁止做法：

- 直接在旧大文件里继续塞新分支，然后声称“以后再拆”
- 一边迁移一边删除旧实现，导致没有稳定对照面

旧实现只有在以下条件都满足后才允许收缩：

1. 新模块已接线
2. focused 验证通过
3. full suite 通过，或剩余边界已清晰记录
4. 文档和规则已同步

---

## 9. 大文件治理守则

如果某个文件已经成为多条线的集中承载点，例如：

- 总调度文件
- 巨型 `client.rs`
- 巨型 `registry.rs`

后续新增逻辑默认不得再继续往里堆核心实现。

允许它保留的角色只包括：

- 薄路由
- feature gate 分发
- 模块 re-export
- 迁移期兼容入口

不允许继续加入：

- 新的 bootstrap 状态机
- 新的 preflight 序列
- 新的 follow-up 链
- 多条 surface 混写的核心逻辑

---

## 10. 多 AI / 多开发者并行开发守则

并行开发时，默认按**目录 ownership** 划分任务。

推荐方式：

- Agent A：`common`
- Agent B：`official_api`
- Agent C：`web_reverse`
- Agent D：`canvas_web_reverse` 或其他特定 surface

必须遵守：

1. 一个任务优先只写自己负责的子树
2. `common` 改动必须说明共享理由
3. `mod.rs`、feature gate 接线文件、注册文件应最后统一集成
4. 不允许两个 agent 同时围绕一个大文件各自插入逻辑

如果一个任务暂时还不清楚属于哪条线：

- 先确定 owner
- 再改代码

---

## 11. 测试与归档守则

每一条主线都必须拥有自己的验证面：

- focused case
- fixture suite
- live suite

规则：

1. 不同 surface 的结果不得互相替代
2. 不同 owner 的结果不得互相替代
3. `HTTP 200 成功`
4. `quota gate accepted`
5. `browser fallback 成功`

这三种结论必须分开写，不能混成一个“已完成”

---

## 12. 文档同步守则

凡是发生以下变化，必须同轮写入仓库：

- 新目录分层
- 新 feature gate
- 新 owner 语义
- 新迁移规则
- 新并行开发边界

至少同步：

- `rules/`
- `AGENTS.md`
- 相关 progress 文档
- 相关 baseline 文档

不得把这些规则只留在聊天上下文里。

---

## 13. Gemini 作为具体例子

这份守则是通用的，不只适用于 Gemini。

但当前 Gemini 是最明确的现成例子，因此可作为参考映射：

- `gemini/common`
- `gemini/official_api`
- `gemini/web_reverse`
- `gemini/canvas_web_reverse`

其中：

- `web_reverse` 承载 generic Gemini Web reverse 与迁移进来的 legacy mixed lane 资产
- `canvas_web_reverse` 承载 true Canvas owner 线
- `common` 只放三条线共享、且不带具体 owner 语义的通用逻辑

---

## 14. 冻结结论

从现在开始，任何类似“多 surface / 多协议 / 多 owner”的复杂开发，默认必须遵守：

1. 先分层，再实现
2. 先分 owner，再写代码
3. 先支持按需编译，再扩大功能
4. 先把目录 ownership 定清楚，再允许多 AI 并行
5. 不再把历史大文件当成新逻辑默认落点
