# PostgreSQL 迁移并发与事务基线

## 适用范围

本基线适用于 Platform 仓库内的 Core、AI Gateway domain 与 Account domain PostgreSQL schema runner，以及后续新增的数据库迁移入口。

## 并发控制

- 每个 runner 必须在执行 tracking table DDL 或读取已应用文件之前获取 session-level PostgreSQL advisory lock。
- 锁键必须组合 `current_database()` 与 runner 的稳定独立名称，避免不同数据库之间互相阻塞，同时保证同一数据库内同一 runner 的并发实例串行执行。
- 获取锁、执行迁移和释放锁必须使用同一个 PostgreSQL client；不得获取 transaction-level lock 后切换连接。
- 当前稳定锁名：
  - Core：`neuro-core-schema-migrations`
  - AI Gateway domain：`neuro-gateway-schema-migrations`
  - Account domain：`neuro-account-schema-migrations`
- Kubernetes 可以同时创建三个 domain migration Job。独立锁名只串行化同一 runner 的并发实例，不虚构三个 domain 必须共用同一个数据库的前提。

## 事务与错误语义

- 普通 `.sql` 文件按文件名字典序执行。
- 每个尚未应用的文件单独执行 `BEGIN -> migration SQL -> tracking insert -> COMMIT`。
- SQL、tracking insert 或 COMMIT 失败时必须尝试 `ROLLBACK`。
- ROLLBACK、advisory unlock、client release 或 pool close 的二次失败不得覆盖原始迁移错误；必须记录清理错误并继续完成剩余清理。
- 无论目录检查、连接、锁获取、SQL 还是清理在哪一步失败，runner 都必须尝试关闭自己拥有的 pool。
- advisory lock 只有在获取成功后才允许显式 unlock；连接关闭仍是 session lock 的最终安全边界。

## 在线索引边界

当前三个 runner 都把普通 migration 文件包在显式事务中，因此禁止在现有文件中加入 `CREATE INDEX CONCURRENTLY`。PostgreSQL 不允许该语句在 transaction block 内执行。

引入在线索引前，必须先完成统一的 no-transaction migration contract，至少定义：

- 明确、可测试的文件标记或旁车 manifest；
- 禁止在同一 no-transaction 文件中混入要求原子事务的语句；
- SQL 成功后 tracking row 的记录时机；
- 中途失败、残留 invalid index 和重试语义；
- advisory lock、部署 Job 重试及真实 PostgreSQL 并发写入验证。

不得通过修改已经应用的历史 migration 来伪装修复；应添加新的 forward migration。

## 验证要求

- 共享 runner 必须使用不访问真实数据库的 fake pool/client 单元测试覆盖：成功顺序、已应用跳过、SQL 失败回滚、锁失败不解锁、连接失败仍关闭 pool，以及清理失败不覆盖主错误。
- 修改 migration runner 后必须通过 Backend Foundation、Account domain、AI Gateway domain 类型检查与完整仓库 CI。
- 涉及真实 DDL、事务边界或 no-transaction 行为时，还必须补充隔离 PostgreSQL 集成验证。
