# product-order-item service 拆分说明

`core/src/modules/product-order-item/service.ts`（约 6,600 行）已按内聚职责拆分为
`core/src/modules/product-order-item/service/` 下的子模块。`service.ts` 保留为薄 facade，
re-export 全部原有 42 个公共导出，外部导入方（router.ts、其他模块、测试）无需任何修改。

这是一次纯结构性重构：所有函数体按"整块移动"迁移，未改变任何运行时行为、函数签名或导出名。

## 子模块分层

依赖方向自上而下（下层不依赖上层），避免循环导入：

| 文件 | 职责 | 行数 |
| --- | --- | --- |
| `shared.ts` | 通用工具（`now`、`DbTx`、`isPlatformOperator`、用户分组匹配等） | 53 |
| `manual-review-policy.ts` | 人工复核纯策略计算（优先级、SLA、分配池、容量、模板匹配） | 568 |
| `anomaly-engine.ts` | 履约异常核心引擎（策略模板、告警级别、事务内 upsert/resolve） | 439 |
| `item-views.ts` | 视图映射（order/item/unit/issue/manual review/replacement/run 视图，`loadItemViewInTx`） | 415 |
| `product-catalog.ts` | 商品定义、种子数据、购买资格、运营端商品 CRUD | 790 |
| `discount-codes.ts` | 优惠码定义、种子数据、运营端 CRUD/批量操作、下单折扣解析 | 829 |
| `order-lifecycle.ts` | 下单、直接发放、订单回退、用户资产/订单查询 | 594 |
| `fulfillment.ts` | 问题上报、履约对账（手动与定时） | 591 |
| `manual-review.ts` | 人工复核队列运营（列表/汇总/SLA 汇总/认领/分配/再均衡/释放） | 1731 |
| `fulfillment-anomalies.ts` | 履约异常运营（运营汇总、异常列表/策略、SLA 异常同步、升级、自动动作） | 881 |
| `marketplace.ts` | 交易市场资产挂牌/释放/转移 | 66 |
| `service.ts`（facade） | re-export 全部公共 API | 66 |

唯一的跨"同层"依赖：`fulfillment-anomalies.ts` 调用 `manual-review.ts` 的
`getManualReviewWorkload` / `listManualReviewSlaPolicies` 等（单向，无循环）。

## 相关调整

- `default-product-seeding.test.ts` 原来直接读取 `service.ts` 源码断言种子逻辑，
  已改为读取 `service/product-catalog.ts`（种子逻辑现所在文件）。
