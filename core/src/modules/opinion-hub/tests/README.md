# Opinion Hub 模块测试约束

- 创建议题必须走账本扣减 `opinionTickets`，不能直接改余额。
- 支持议题必须走账本转入平台票池账户。
- 反对议题必须走账本转入平台票池账户。
- 议题 `qualified` 需要同时满足：
  - `supportTicketTotal >= targetSupportCount`
  - `supportRate = support/(support+oppose) >= 70%`
- 支持或反对并发操作下，累计票数、唯一人数与状态切换应保持一致。
- 模块关闭后，议题列表、创建、支持、反对接口都必须返回 `503 MODULE_DISABLED`。
