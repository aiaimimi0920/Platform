# Arbitration 统计查询基线

## 适用范围

本基线约束 Arbitration case summary 与 operator workload 两条统计路径。案件列表、单案详情、证据下载与状态变更仍可以按产品需要加载完整视图。

## 查询边界

- summary/workload 的 case 查询只允许读取统计需要的标量字段：ID、entity、status、action、effects、assignee、claimedAt、createdAt。
- viewer reputation 只允许批量读取 task 的 `id / creatorUserId / assignedUserId`，不得读取完整 task 行。
- evidence 按 `caseId + kind` 聚合 count；不得把 title、content、URL 或 creator payload 拉入统计路径。
- attachment 只聚合 remote、cleanup requested 且未 archived、remote archived 三个 count；不得加载文件名、对象路径、URL、校验元数据或重试内容。
- workload 只读取 review round 的 `caseId / roundNumber / status / assignee / startedAt / endedAt`。
- child table 聚合必须分开执行，禁止把 evidence、attachment、round 同时 join 后再 count，避免一对多 join 乘法造成重复计数。

## Summary 语义

- visibility 与案件列表一致：operator 可查看全部，普通用户只能查看 requester/respondent 命中的案件。
- `awaitingOperatorCount` 统计 `open + under_review`。
- `resolvedWithEffectsCount` 只统计 `resolved` 且 `effectsAppliedAt` 非空。
- `casesWithEvidenceCount` 按每案 evidence count 是否大于零判断。
- cleanup requested remote attachment 必须满足 `storageMode=remote && cleanupRequestedAt!=null && archivedAt=null`。
- archived remote attachment 必须满足 `storageMode=remote && archivedAt!=null`，即使同时存在 cleanupRequestedAt 也只进入 archived 计数，不进入 cleanup-requested 计数。
- reputation impact 保持：resolved + effects 才可能非 neutral；accept 对 assignee favorable、creator unfavorable；default 对 creator favorable、assignee unfavorable；其余均 neutral。
- 所有 bucket 保持 count 降序、key 字典序作为稳定次排序。

## Workload 语义

- workload 仍只允许 platform operator 调用。
- 使用一次 reference time 计算本次响应内的 claim/round age，避免同一响应跨小时边界漂移。
- stale claim 的边界是 `claimAgeHours >= arbitrationStaleClaimHours`。
- stale round 仅适用于 open round，并按该 round policy 的 staleHours 判断。
- case assignee 的 `openRoundCount` 统计该案件全部 open rounds；round assignee bucket 则按每个 open round 自己的 assignee 统计。
- next claim candidate 排序保持：`under_review > open > other`、更高 current round、更多 evidence、更早 createdAt；case rows 的 createdAt/ID 稳定顺序继续承担最终隐式 tie-break。
- recommended assignee 排序保持：更少 stale claims、更少 claimed cases、更少 open rounds、operator ID 字典序。

## 验证要求

- 纯分析测试必须覆盖 summary evidence/attachment metrics、workload stale/assignee/round buckets 与 candidate tie-break。
- PostgreSQL 集成测试必须覆盖 participant visibility、grouped evidence kind、remote attachment filter、viewer reputation 与 operator workload。
- 仓库契约必须阻止 summary/workload 重新调用 `listVisibleArbitrationCases`。
- 修改统计查询后必须通过 Core 类型检查、Arbitration 集成测试、完整 CI 与 required integration suites。
