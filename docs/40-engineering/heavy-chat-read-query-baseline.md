# Heavy Chat 读取查询基线

## 适用范围

本基线约束 Heavy Chat workspace snapshot 与 Gateway conversation history 两条读取路径。两者消费目的不同，禁止通过共享一个“最近消息页”来同时满足 UI 和模型上下文。

## Snapshot 查询

- `HeavyChatSnapshot` 保持 `slots / projects / slotProjects / bindings / threads / messages / messagePages` 契约；`messages` 是每个 thread 最近一页的扁平结果，`messagePages` 必须为每个 thread 显式提供 `hasMore / nextBeforeSequence`，禁止无元数据静默截断。
- 初始 snapshot 每个 thread 最多返回最近 50 条消息。必须先取得 owner-scoped slots/threads，再分别使用一次批量查询加载 slot-agent bindings、slot-project bindings 与所有 thread 的有界最近页；不得恢复为逐 slot/逐 thread 查询的 N+1 路径，也不得把 owner 的全部历史消息重新装入 snapshot。
- 最近页批量查询必须在一个 SQL statement 中通过 owner-scoped thread 集合与 `LATERAL` 子查询为每个 thread 执行索引有界读取，只取各自按 `sequence / id` 倒序的 `pageSize + 1` 行；禁止使用需要扫描全部历史的窗口排名，也禁止退回应用层 N+1。额外一行只用于判断 `hasMore`，不能进入响应。
- 三类批量查询必须同时包含 owner predicate 和 slot/thread ID predicate，防止传入其他 owner 的 ID 时泄露数据。
- snapshot 只需要 slot-project link 时不得通过逐 slot project join 加载完整 project 行；projects 继续由独立 owner-scoped project 查询提供。
- 每个消息页对外按 `sequence / id` 升序排列；service 必须按 snapshot thread 顺序重新分组和展开，以保持原扁平响应顺序。
- slot-agent 与 slot-project 结果也必须按 snapshot slot 顺序重新展开，保持原扁平响应顺序。
- 空 slot/thread 集合必须直接返回空数组，不生成无条件或无效 `IN` 查询。

## UI keyset pagination

- 读取更早消息使用 `GET /v1/me/heavy-chat/threads/:threadId/messages?beforeSequence=<sequence>&limit=<size>`。Core 与 Web 两层均校验 `beforeSequence` 为正整数、`limit` 为 `1..100`，service 在查询前验证 thread ownership。
- 游标使用 thread 内不可变且唯一的 `sequence`。分页查询约束 `sequence < beforeSequence`，按 `sequence / id` 倒序读取 `pageSize + 1` 行，再反转为升序返回。
- 当存在下一页时，`nextBeforeSequence` 等于本页保留消息中最老一条的 sequence；没有下一页时必须为 `null`。
- Web 合并按 message ID 去重、按 sequence 排序；snapshot 刷新必须以新行覆盖相同 ID 的 streaming/status 内容，同时保留已经加载的更早历史与其分页游标。
- “加载更早消息”只能出现在消息滚动区域内，必须暴露 loading/disabled/focus 状态；prepend 完成后按 `scrollHeight` 差值恢复阅读位置，不能把用户跳到列表顶部或底部。

## Gateway history 查询

- Gateway history 必须使用独立 repository 查询，不得先加载完整 `HeavyChatMessageRecord[]` 再在 service 内过滤。
- 查询只投影 `role / content`，并在数据库侧约束：
  - owner 与 thread；
  - `sequence < current assistant sequence`；
  - `status = complete`；
  - role 属于 `user / assistant / system`。
- 空白 content 继续使用应用层 `trim()` 过滤，保持现有 JavaScript 可见语义。
- 查询顺序保持 `sequence / id` 升序，不能改变 Gateway 收到的历史对话顺序。
- message sequence 分配、message/attempt idempotency 和状态 CAS 不得依赖分页或投影查询，仍使用各自完整的事务与唯一索引路径。

## 分页与 Gateway 边界

- UI 分页不能替代 Gateway history；如果未来需要限制模型上下文，必须建立独立 token/context policy，并明确 system 与最近轮次保留规则。
- `(owner_user_id, thread_id, sequence)` unique index 同时支持 sequence keyset 与 history range scan；不要为该分页重复增加 schema migration。

## 验证要求

- repository 单元测试必须覆盖 owner isolation、跨 thread 有界最近页、稳定顺序、连续 keyset 页、pre-sequence、status 与空白 content 过滤。
- service 单元测试必须证明 snapshot 调用有界批量读取、分页前验证 ownership/页大小，并保持 Gateway history 内容语义。
- Web 测试必须覆盖 Core/Web query 转发、message ID 去重、snapshot refresh 覆盖实时状态且保留旧历史，以及显式分页状态。
- PostgreSQL 集成测试必须覆盖真实 owner/thread predicate、按 thread 的有界 LATERAL 结果、连续 keyset 页和最小 history projection。
- 修改后必须通过 Heavy Chat 单元测试、Heavy Chat PostgreSQL integration、完整 CI 与 required integration suites。
