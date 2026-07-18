# Platform 产品完成风险评估

日期：`2026-07-18`

严重度以 candidate canonical `docs/40-engineering/Platform产品完成与验收基线.md` 为准。每项风险只有一个当前等级；第三方账号、额度、网络和服务状态单列为 `external-blocked`。

## P0 风险

### R1 假产品成功

`/chat` 当前可显示“生成完成”“已转任务”“已投递邮箱”，但没有服务端调用或持久化副作用。

影响：用户数据丢失、验收误判、产品信任受损。

控制：先建立失败测试和服务端领域，再删除 seed send path；在真实链通过前不得保留成功提示。

### R2 验收环境污染宿主现场

Compose 使用默认 project、固定端口并挂载宿主 `.neuro`。

影响：与其他子项目/对话冲突，读取或写回真实凭证，`down -v` 清理错误资源。

控制：独立 project、动态端口、临时 volume、临时 credential root、资源 owner 校验。

### R3 生产部署不可重现

K8s 使用 example host/image 和漂移的 `latest`。

影响：无法证明部署内容、回滚目标和首次 migration 顺序。

控制：不可变 digest、render gate、migration Job、rollout smoke、环境 namespace 隔离。

### R4 release 范围错误

当前 release 只包含 Web，却使用 Platform 名称。

影响：可能把 Web 可启动误报为整个平台可交付。

控制：manifest 明确组件边界，并补全后端 OCI、migration、deploy bundle 和证据。

## P1 风险

### R5 测试门禁假绿

`test:all` 不含 `test:debt`，integration 可以 skip 后退出 0。

当前 `test:debt` 冻结证据：

- `credential-failover.test.ts`：1 项失败。
- `credential-refresh.test.ts`：3 项失败。
- `thinking-filter.test.ts`：5 项失败。
- 合计 `44 passed / 9 failed / 53 total`；后续 `test:node-mock:debt` 尚未执行。

控制：建立 Platform 内唯一 `acceptance:ci`；把 debt 纳入全量门禁；每层报告 discovered/executed/passed/failed/skipped，required 遇到 skip 或未执行必须失败。

### R6 依赖故障伪装为空数据

多个 Owner/Operator 页面使用 `catch(() => []/null)`。

控制：引入统一 dependency result/envelope，区分 empty、partial 和 unavailable。

### R7 Dev Auth 误入生产

当前 bypass 只受环境变量控制。

控制：生产环境硬禁用并建立启动失败测试、部署清单 gate。

### R8 Readiness 语义错误

Worker 即使依赖失败也可能返回 ready。

控制：记录成功 cycle、依赖状态和连续失败阈值；health 与 ready 分离。

### R9 大文件和重复 owner

Agent、Gateway migration compatibility 和部分页面已形成高认知负担。

控制：新增 heavy chat 独立模块；不把新行为继续写入巨型 Agent/Gateway 文件；跨模块只走 service/API。

### R10 浏览器旅程不足

当前没有覆盖 Owner、Visitor、Operator 的具名全旅程 Playwright 门禁，也没有把 UI 动作与 API/数据库副作用绑定验证。

控制：按 canonical 浏览器矩阵建立 journey id、角色 fixture、路由、动作、持久化断言、错误态断言和 desktop/mobile 最小集合。

### R11 核心领域与 Executor 缺少可执行测试

Identity、Wallet/Ledger、Task Hub 等关键领域仍存在测试 README 占位，Executor 没有测试脚本。

控制：把领域状态机、权限、事务不变量和 Executor 执行合同纳入 required test inventory；占位 README 不能计为覆盖。

### R12 Compose 启动竞态

多个服务使用 `service_started`，进程已启动时数据库、Valkey、migration 或上游服务可能仍不可用。

控制：关键依赖改为 `service_healthy` 或成功完成的 migration condition；isolated startup 必须重复执行并保存 readiness 证据。

### R13 Platform 验收证据不可直接交付给 CI

现有根级 Platform workflow 只验证 smoke、typecheck 和 Compose render，不产出完整 deployable artifact；本轮又不能修改 Platform 外文件。

控制：在 `Platform/` 内生成稳定的 acceptance 命令、完整 evidence 目录和机器可读 manifest；把现有 workflow 已调用的 `npm run smoke` 改为严格 `acceptance:ci` 桥接，把轻量 smoke 迁到 `smoke:quick`。根级 artifact upload 接线作为仓库级编排，不通过越界写入解决，但不得影响 CI 门禁退出码。

### R14 release smoke 可能偷用源码

若打包器只保存 image 名称，或 smoke 继续使用源码 bind/build context，release 通过不能证明交付物独立可运行。

控制：默认生成离线 OCI layout 或固定 digest manifest；release smoke 只从 release 目录/固定 digest 启动，禁止源码和兄弟项目 build/mount。

## 外部风险

- Gateway 无可用 provider 或额度。
- Linux.do OAuth 无测试账号或回调域名。
- Tea/Loom 外部服务不可用。

这些风险只影响 `conditional-live`，不允许降低 `required` 或 `external-boundary` 标准。出现时必须：

- 先证明 Platform 请求已到达正确外部边界。
- 保存请求 id、时间、状态码和脱敏错误。
- fixture/contract 测试仍需通过。
- 页面不得伪造外部成功。
- 结果明确标为 `external-blocked` 或 `not-run`，不得标记 pass。

若 required/external-boundary 全绿且内部 P0/P1 清零，可以签收为“Platform 产品完成，可验收；外部 live 条件待签收”。只有上述 live 风险全部实际通过，才可以签收端到端生产依赖。

## 验收环境前置风险

- Docker daemon 不可用。
- 本地缺少构建 OCI layout 所需的容器能力或磁盘空间。
- required fixture 依赖的本地端口、文件权限或进程能力不可用。

这些情况不自动归为 Platform P0/P1，但会使 required 或 release smoke 未执行/失败，因此必须阻断产品完成结论。默认离线 OCI layout 不依赖外部 registry；只有显式选择固定 registry digest 时，registry 网络才属于该次 required release smoke 的前置条件。
