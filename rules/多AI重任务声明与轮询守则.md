# 多 AI 重任务声明与轮询守则

适用范围：

- 本仓库内所有多 AI / 多对话 / 多终端并行开发场景
- 尤其适用于：
  - Rust `cargo build/check/test`
  - Docker 镜像构建 / compose build
  - focused / fixture / live suite
  - 浏览器自动化 / Playwright / browser pool / connected client
  - provider runtime bootstrap / keepalive / live reverse-web 验证

---

## 1. 守则目标

本守则用于解决多 AI 同时工作时最容易出现的三类问题：

1. 多个对话同时进入重执行，导致 CPU 被打满
2. 多个对话同时抢构建/浏览器/容器资源，导致“看起来都在跑，但都很慢”
3. 多个对话都自认为可以立刻执行重任务，没有统一的资源声明与等待机制

当前正式目标是：

> **同一时刻，默认只允许一个 AI 对话持有“重任务令牌”并执行重任务；其他对话进入等待轮询态。任何对话都可以在资源可用时晋升为重任务执行者。**

这套机制的本质是：

- **不是固定主从**
- **不是永久指定某一个 AI 为唯一执行者**
- **而是全局只有一个重任务 owner，owner 可以轮换**

---

## 2. 一句话结论

当前本仓库的多 AI 并行基线必须这样理解：

- 多个 AI 对话可以同时存在
- 但默认只允许 **1 个** 对话处于 `heavy_active`
- 其他对话默认处于：
  - `polling_wait`
  - `light_readonly`
  - `light_editing`
- 一旦当前 `heavy_active` 对话完成、主动释放、超时失效、或进入不可继续状态，
  其他对话中的任意一个都可以申请成为新的 `heavy_active`

---

## 3. 重任务与轻任务的正式划分

### 3.1 重任务 `heavy task`

以下操作默认属于重任务：

1. `cargo build / cargo check / cargo test`
2. `docker build / docker compose build`
3. provider-focused full suite / full live suite
4. Playwright / browser automation / browser pool live 操作
5. 大规模回归、批量 probe、批量 network replay
6. 任何会长时间占用 CPU、浏览器 owner、Docker backend、编译缓存、或大量 node 子进程的任务

### 3.2 轻任务 `light task`

以下操作默认属于轻任务：

1. 阅读代码
2. 阅读 docs / rules / progress 文档
3. 静态分析与归纳
4. 写规则 / 写文档
5. 小规模 `rg` / `Get-Content` / 日志查看
6. 不触发重构建、不触发大浏览器执行的少量代码编辑
7. focused 结果整理、归档说明、结果表回填

### 3.3 边界规则

若一个任务同时包含轻任务和重任务部分，则默认按：

- **轻任务先做**
- 到真正需要执行重步骤时，再申请 `heavy_active`

也就是说：

- 不是“这个对话很重要，所以一开始就占着重任务令牌”
- 而是“只有真正进入重执行阶段时才占令牌”

---

## 4. 正式状态机

每个 AI 对话当前只允许处于以下状态之一：

### 4.1 `light_readonly`

只读分析态。

允许：

- 读代码
- 读文档
- 查日志
- 写分析结论

不允许：

- 编译
- build
- browser live
- 大型回归

### 4.2 `light_editing`

轻编辑态。

允许：

- 改代码
- 写规则
- 写文档
- 少量静态验证

不允许：

- 长时间重编译
- Docker build
- browser live

### 4.3 `polling_wait`

等待轮询态。

语义：

- 当前对话已经准备好进入重执行
- 但全局 `heavy_active` 令牌已被其他对话占用
- 因此本对话只做：
  - 等待
  - 轮询
  - 轻量补充分析

### 4.4 `heavy_active`

当前唯一重任务执行态。

语义：

- 当前全局最多只允许 **1 个** 对话处于该状态
- 该对话当前拥有：
  - 编译权
  - Docker build 权
  - browser live / Playwright 主执行权
  - full suite 执行权

### 4.5 `blocked`

阻塞态。

语义：

- 当前对话并非等待资源
- 而是等待前置条件，例如：
  - 某个 provider credential
  - 某条 progress 结论
  - 某个上游 live 结果

---

## 5. 全局重任务令牌规则

### 5.1 单令牌原则

同一时刻默认只允许一个全局重任务令牌：

- `heavy_active_token = 1`

当前不得默认开多个并行重任务槽位，除非后续明确证明：

- CPU 余量足够
- Docker / browser / build 不再互相放大争抢

### 5.2 可轮换原则

当前**任何对话**都可以成为 `heavy_active`，条件只有两个：

1. 当前没有其他对话占用重任务令牌
2. 当前对话确实进入了必须执行重任务的阶段

因此：

- 没有固定“主 AI”
- 没有固定“次 AI”
- 只有当前时刻的：
  - `heavy owner`
  - `waiting contenders`

### 5.3 不占着不用

如果当前对话还在：

- 阅读
- 思考
- 整理规则
- 写文档
- 查静态代码

那么它不应持有 `heavy_active`。

正式要求：

- **谁真正开始跑重步骤，谁才拿令牌**

---

## 6. 对话声明机制

为了避免多个 AI 都“自认为现在该自己跑”，当前正式建议使用一个**对话声明文件**来表达全局状态。

当前仓库推荐 helper：

- `deploy/claim-heavy-task.ps1`
- `deploy/release-heavy-task.ps1`
- `deploy/show-heavy-task-status.ps1`
- `deploy/invoke-heavy-task.ps1`
- `deploy/wait-heavy-task-available.ps1`

### 6.1 推荐文件位置

当前推荐位置：

- `.runtime/ai-heavy-task-declaration.json`

说明：

- 这是运行时协调文件
- 不属于长期业务真相层
- 不要求进 Git
- 但本地多 AI 协作时应优先复用同一位置

### 6.2 推荐结构

推荐最小结构如下：

```json
{
  "version": 1,
  "heavyTaskOwner": {
    "dialogId": "thread-or-agent-id",
    "taskLabel": "gemini-canvas-live-rerun",
    "implementationLine": "gemini/canvas_web_reverse",
    "startedAt": "2026-05-06T12:34:56+08:00",
    "leaseSeconds": 1800,
    "status": "heavy_active"
  },
  "waitingDialogs": [
    {
      "dialogId": "thread-b",
      "taskLabel": "rules-and-doc-sync",
      "requestedHeavy": true,
      "status": "polling_wait"
    }
  ]
}
```

### 6.3 最小必填字段

当前推荐至少包含：

- `dialogId`
- `taskLabel`
- `implementationLine`
- `status`
- `startedAt`
- `leaseSeconds`

### 6.4 `implementationLine` 必填

之所以要求填 `implementationLine`，是因为当前最容易争抢的资源往往并不是“服务商级”，而是：

- `gemini/official_api`
- `gemini/web_reverse`
- `gemini/canvas_web_reverse`

这类实现线级别任务。

---

## 7. 轮询等待规则

### 7.1 等待方默认行为

处于 `polling_wait` 的对话，默认只做：

1. 周期性检查重任务令牌是否释放
2. 做不占重资源的轻分析
3. 补充文档、规则、结果归纳

不得在等待期间偷偷开始：

- 编译
- Docker build
- browser live

### 7.2 推荐轮询间隔

当前建议：

- 轻量轮询间隔：`30-90 秒`

不要做高频 busy polling。

### 7.3 等待中的轻任务允许继续

等待态不是“什么都不做”，而是：

- 不抢重资源
- 继续做轻任务

例如：

- 对照 docs
- 写规则
- 整理结果表
- 做静态修订

---

## 8. 租约与释放规则

### 8.1 租约不是永久锁

`heavy_active` 不应是永久占有。

当前推荐使用：

- `leaseSeconds`

表达一个可续期租约。

### 8.2 何时主动释放

以下情况当前应主动释放重任务令牌：

1. 当前重步骤已经完成
2. 进入长时间等待外部条件阶段
3. 当前任务退回轻分析/轻编辑阶段
4. 当前重任务已经失败，需要人工重新定方向

### 8.3 何时允许续租

若当前重任务仍在持续推进，例如：

- 正在 build
- 正在跑 focused/live suite
- 正在做长时间 browser verification

则允许续租。

但必须满足：

- 当前确实还在做重执行
- 不是占着令牌不使用

### 8.4 租约过期

若某个 `heavy_active` 声明超过租约且没有续租，其他对话当前可将其视为：

- 已失效
- 可重新竞争

---

## 9. 资源晋升规则

### 9.1 任意对话可晋升

当前正式要求：

- **所有对话任务都可以转成重任务**
- 只要当前资源空出来、且它真的需要执行重步骤，即可晋升

这正是本守则的核心。

因此当前不允许形成下面这种隐含习惯：

- “只有某个固定线程才能 build”
- “只有某个固定线程才能跑 live”

正确规则是：

- **谁当前需要重执行，谁在空闲时拿令牌**

### 9.2 晋升前提

对话从 `light_* / polling_wait` 晋升为 `heavy_active` 前，当前至少应满足：

1. 已经完成本轮必要的轻分析
2. 重任务目标明确
3. 当前没有其他重任务 owner
4. 当前确实要跑重步骤，而不是“可能之后会跑”

---

## 10. 与本仓库现有规则的关系

本守则不替代以下规则，而是叠加在其上：

- `docs/40-engineering/本地Rust编译隔离基线.md`
- `rules/多Surface模块化开发守则.md`
- `rules/AI网关多协议兼容测试守则.md`

组合关系如下：

1. 本守则回答：
   - **谁现在可以跑重任务**
   - **其他对话如何等待**
2. `本地Rust编译隔离规则` 回答：
   - **一旦开始编译，如何避免共享 `target/` 冲突**
3. `多Surface模块化开发守则` 回答：
   - **如何按实现线拆目录与拆编译边界**
4. `AI网关多协议兼容测试守则` 回答：
   - **重任务真正开跑后，应如何测试与归档**

---

## 11. 推荐落地方式

当前推荐的实际协作方式是：

1. 所有对话默认先处于：
   - `light_readonly` 或 `light_editing`
2. 当某个对话要进入：
   - `cargo`
   - `docker build`
   - `browser live`
   - `full suite`
   前，先检查声明文件
3. 若已有 `heavy_active`
   - 当前对话进入 `polling_wait`
4. 若没有 `heavy_active`
   - 当前对话把自己声明为 `heavy_active`
5. 做完重步骤后：
   - 及时释放令牌
   - 其他等待对话再竞争下一轮

可直接使用：

- `docs/40-engineering/多AI重任务助手使用说明.md`

查看 helper 的本地调用方式与示例。

---

## 12. 禁止做法

当前明确禁止：

1. 多个 AI 同时默认进入 `cargo build/test`
2. 多个 AI 同时默认进入 `docker build`
3. 多个 AI 同时默认进入 browser live / Playwright 主执行
4. 没有声明就直接开始重任务
5. 明明已经退回轻分析，却继续占着重任务令牌不释放
6. 把“等待态”理解成完全停工，而不是继续做轻任务
7. 把“只有一个重任务 owner”误解成“只有一个 AI 能执行重任务”

---

## 13. 当前正式建议

对本仓库当前这台机器与当前工作模式，正式建议是：

- 全局默认只开 **1 个重任务槽位**
- 所有对话都默认支持晋升为重任务 owner
- 但晋升前必须先通过声明文件占用令牌
- 其他对话默认进入轮询等待态，并继续完成轻任务

这比“多个 AI 同时重执行然后互相拖慢”更符合当前机器与当前仓库的真实约束。
