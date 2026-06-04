# AgentRegistry 模块测试占位

后续自动化测试应覆盖：

- 创建平台 agent（`sourceType=platform`）成功
- 创建外部 agent（`sourceType=external`）必须提供 `runtimeEndpoint`
- 非 owner 访问 `GET /v1/agents/:agentId/capabilities` 返回 404
- 非 owner 提交 `POST /v1/agents/:agentId/capabilities` 返回 404
- 同一 agent 下 capability `code` 唯一，重复创建返回 409
- 模块关闭时所有路由返回 `MODULE_DISABLED`
