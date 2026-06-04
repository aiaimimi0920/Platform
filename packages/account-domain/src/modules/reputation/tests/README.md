# Reputation 模块测试约束

- 读取 `/v1/reputation` 时应只依赖当前用户上下文。
- 模块关闭后接口必须返回 `503 MODULE_DISABLED`。
- 信誉统计来源于 `tasks` 现有状态，不允许回写 `task-hub` 表。
- 已存在快照时，重复读取应执行 refresh + upsert，而不是信任过期快照。
