# 成熟网关项目借鉴与 Rust Gateway 硬化计划（2026-05-30）

## 1. 目标

本计划用于把外部成熟网关项目的高频工程经验收口进本仓库 Rust `gateway/` 的正式开发基线。

参考对象：

- `router-for-me/CLIProxyAPI`
- `Wei-Shaw/sub2api`
- `QuantumNous/new-api`

本计划不复制外部项目实现，也不改变本仓库“Rust gateway 是长期 owner”的架构结论。它只吸收这些项目在真实运行中反复暴露出的成熟网关问题域：

1. 协议兼容要可回归，而不是靠单次 smoke 判断。
2. 凭证失败要分清：凭证级、模型级、服务商级、临时上游级。
3. 管理面筛选必须精确，可追溯 upstream request id 与真实命中路径。
4. 用量 / quota / 统计类写入要批处理化，不能成为请求热路径放大器。
5. 对话内容存档要成为平台级数据资产，但不得让存档失败影响用户请求。

---

## 2. 外部项目可借鉴点

### 2.1 CLIProxyAPI

可借鉴点：

- 长连接 / 会话 pin 与普通轮询路由分开理解。
- OAuth / reverse-web 类凭证的真实可用性要以请求期证据为准。
- 协议细节不能靠本地臆断，必须可通过 live replay / fixture replay 验证。
- 对上游特殊协议的 header、content-type、版本指纹要纳入回归项。

本仓库落点：

- `request_audits.route_trace` 必须保留 route selection、protocol profile、execution mode、fallback eligibility 与 failure classification。
- 对 ChatGPT / Qwen / Gemini / AIStudio 等 reverse-web line 的结论继续执行 `rules/AI网关多协议兼容测试守则.md`。

### 2.2 sub2api

可借鉴点：

- 用户 × 平台 × 凭证维度的 quota / usage flush 需要批处理和延迟落盘。
- 真实请求失败不应被单一“账号坏了”吞掉；需要区分模型不支持、额度不足、临时限流、上游网关错误。
- WebSocket / streaming / event-stream 的结束语义、usage 提取和异常关闭需要独立处理。

本仓库落点：

- v1 先补 failure classification 与 conversation archive。
- usage batching 已有 `GATEWAY_USAGE_REPORT_BATCH_SIZE` 与 Redis report 队列，本计划不重写；后续再补“用户 × provider credential × model”的 flush 聚合。

### 2.3 new-api

可借鉴点：

- 管理面日志筛选必须精确，不允许模糊匹配导致误判。
- channel / provider active 状态必须与真实调用结果、健康检查和最近错误关联。
- 上游 request id、真实 user id、真实 channel path 是排查线上问题的关键维度。

本仓库落点：

- `gateway_request_audits` 继续作为请求索引层。
- 新增 `gateway_conversation_archives` 作为用户级对话存档索引层。
- provider credential 增加按 `credential + model + protocol profile` 的状态表，避免把模型级失败误写成整条凭证不可用。

---

## 3. 本轮执行范围

### 3.1 必做

1. 新增用户级对话日志存档基线。
2. 新增 `gateway_conversation_archives` 数据表与 Rust DB 访问层。
3. 新增内部管理 API：
   - 列表查询
   - 单条查询
   - artifact 读取
   - NDJSON export 创建
4. 请求期写入对话存档：
   - 成功请求写 request / response artifact。
   - 失败请求写 request artifact 与错误摘要。
   - 存档失败不影响请求返回。
5. 新增敏感字段脱敏：
   - Authorization
   - Cookie
   - access token / refresh token
   - api key / secret / password
   - provider session token
6. 新增 provider failure classification 纯函数与 route trace 输出。
7. 新增 `gateway_provider_credential_model_states` 表，为后续凭证健康状态机铺底。
8. 更新 canonical docs 与 `AGENTS.md`。
9. 通过 Rust targeted tests 与至少一次 compile-oriented check。

### 3.2 本轮不做

1. 不实现完整 fine-tuning / 模型训练流水线。
2. 不把 archive 数据直接喂给任何训练任务。
3. 不重写现有 usage report 队列。
4. 不把所有 provider 的 live 测试重新跑一遍。
5. 不改变当前 provider selection 的总体路由策略。

---

## 4. 正式验收标准

本计划完成的最低验收标准：

| 项目 | 验收标准 |
| --- | --- |
| 文档 | 本计划、用户级存档基线、`AGENTS.md` 均更新 |
| 数据库 | migration 可独立表达 archive 与 credential-model state |
| Rust 类型 | archive / failure classification 有单元测试 |
| 请求期 | 非 streaming 成功 / 失败路径调用 archive writer，存档失败只记录 warning |
| streaming | v1 至少捕获 raw SSE 字节上限内内容，并在 stream callback 成功 / 失败时落 archive |
| 管理 API | 能按 user / project / provider / model / 时间过滤查询 archive |
| 导出 | 能生成面向模型优化的 NDJSON manifest/object key |
| 安全 | 凭证、cookie、token 类字段被脱敏 |
| 验证 | targeted tests + compile-oriented `cargo check` 通过 |

---

## 5. 后续阶段

### Phase 2：健康状态机闭环（已落地）

- 已将 failure classification 接入 `gateway_provider_credential_model_states`。
- 请求成功会清空 `credential + model + protocol profile` 状态并回到 `active`。
- 请求失败会按分类写入：
  - `blocked`：永久性 `credential_invalid / model_unsupported`
  - `cooling`：`credential_expired / quota_exhausted / rate_limited`
  - `degraded`：`provider_transient / gateway_protocol_error`
  - `active`：`client_request_invalid / content_rejected`，不惩罚 provider credential
- 路由候选构建阶段会读取该状态表：
  - `blocked` 视为长期 cooldown；
  - `cooling` 在 `cooldown_until` 前排到队尾；
  - `degraded` 通过 failure count 降权。
- 新增 internal management API：
  - `GET /v1/internal/gateway/provider-credential-model-states`
- 区分：
  - credential invalid
  - model unsupported
  - quota exhausted
  - rate limited
  - provider transient
  - gateway/client error
- 管理面展示 credential-model state。

### Phase 3：usage / quota 批处理硬化（已落地）

- 已引入 user × provider credential × model 聚合 flush：
  - Redis usage report queue 仍是请求期缓冲层；
  - `gateway_usage_aggregates` 是 PostgreSQL 聚合落盘层；
  - 默认 bucket granularity 为 `3600s`。
- 新增 internal management API：
  - `POST /v1/internal/gateway/usage-aggregates/flush`
  - `GET /v1/internal/gateway/usage-aggregates`
  - `GET /v1/internal/gateway/usage-aggregates/summary`
- `summary` 当前覆盖三类 operator 告警：
  - usage queue depth 过高；
  - 24h failure rate 过高；
  - 24h token 用量异常增长；
  - conversation archive object storage 写入失败 / partial 计数。

### Phase 4：模型优化数据集流水线（已落地）

- 已基于 conversation archive 增加清洗、抽样、审核、发布状态机：
  - `gateway_conversation_dataset_exports`
  - object storage:
    - `ai-gateway/conversation-dataset-exports/{datasetId}/dataset.jsonl`
    - `ai-gateway/conversation-dataset-exports/{datasetId}/manifest.json`
- 新增 internal management API：
  - `GET /v1/internal/gateway/conversation-archives/datasets`
  - `POST /v1/internal/gateway/conversation-archives/datasets`
  - `POST /v1/internal/gateway/conversation-archives/datasets/:datasetId/review`
  - `POST /v1/internal/gateway/conversation-archives/datasets/:datasetId/publish`
- 发布闸门：
  - `review_pending` 不能发布；
  - `rejected` 不能发布；
  - 只有 `approved` 可执行 publish；
  - publish 只把 dataset 标为 `published`，不启动训练；
  - 训练 / fine-tuning 仍必须另行经过产品和隐私策略审批。
