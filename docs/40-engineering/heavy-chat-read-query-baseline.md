# Heavy Chat 读取查询基线

## 适用范围

本基线约束 Heavy Chat workspace snapshot 与 Gateway conversation history 两条读取路径。两者消费目的不同，禁止通过共享一个“最近消息页”来同时满足 UI 和模型上下文。

## Snapshot 查询

- `HeavyChatSnapshot` 当前保持完整 `slots / projects / slotProjects / bindings / threads / messages` 契约，不允许在没有分页元数据和 UI 合并能力时静默截断历史消息。
- snapshot 必须先取得 owner-scoped slots/threads，再分别使用一次批量查询加载 slot-agent bindings、slot-project bindings 与 messages；不得恢复为逐 slot/逐 thread 查询的 N+1 路径。
- 三类批量查询必须同时包含 owner predicate 和 slot/thread ID predicate，防止传入其他 owner 的 ID 时泄露数据。
- snapshot 只需要 slot-project link 时不得通过逐 slot project join 加载完整 project 行；projects 继续由独立 owner-scoped project 查询提供。
- 数据库返回顺序使用 `threadId / sequence / id` 保持稳定；service 必须按 snapshot thread 顺序重新分组和展开，以保持原扁平响应顺序。
- slot-agent 与 slot-project 结果也必须按 snapshot slot 顺序重新展开，保持原扁平响应顺序。
- 空 slot/thread 集合必须直接返回空数组，不生成无条件或无效 `IN` 查询。

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

## 后续分页边界

- UI keyset pagination 应使用 immutable per-thread sequence cursor，并提供显式 `hasMore / cursor` 与前端 merge/load-more 行为。
- UI 分页不能替代 Gateway history；如果未来需要限制模型上下文，必须建立独立 token/context policy，并明确 system 与最近轮次保留规则。
- 现有 `(owner_user_id, thread_id, sequence)` unique index 足以支持 sequence keyset 与 history range scan；本轮不需要 schema migration。

## 验证要求

- repository 单元测试必须覆盖 owner isolation、跨 thread 批量读取、稳定顺序、pre-sequence、status 与空白 content 过滤。
- service 单元测试必须证明 snapshot 调用批量读取，并保持 Gateway history 内容语义。
- PostgreSQL 集成测试必须覆盖真实 owner/thread predicate、批量顺序和最小 history projection。
- 修改后必须通过 Heavy Chat 单元测试、Heavy Chat PostgreSQL integration、完整 CI 与 required integration suites。
