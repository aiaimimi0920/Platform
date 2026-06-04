# AgentExecution tests

当前已落地的自动化测试：

- `callback-governance.test.ts`
  - callback canonical payload 序列化
  - signature message 构造
  - callback audit payload summary
  - 当前/旧协议与密钥在 grace window 内的匹配规则
  - replay-safe callback payload envelope 的构造与归一化
- `operator-run-analysis.test.ts`
  - operator run failure 分类
  - stale timeout 优先级
  - execution phase bucket 归一化
  - recent window interval 映射
  - summary-driven operator recommendations
  - stale timeout + queued coexistence 时的 combo playbook recommendation
- `operator-callback-analysis.test.ts`
  - compatibility / duplicate callback governance recommendations
  - rejected callback remediation recommendation
  - retryable rejected callback recommendation routing
  - dominant rejection category routing
- `auto-remediation-analysis.test.ts`
  - 自动补救 skip/failure 原因分类
  - 原因分类到 disposition 的映射
  - remediation summary 的 skip/failure buckets
- `operator-remediation-analysis.test.ts`
  - remediation summary 到 operator playbook 的规则化推荐
  - attempt_failed / missing_payload / policy_disabled / budget_exhausted 的优先级
  - target_unavailable / duplicate_cooldown 的治理切片
  - remediation reason 到 dominant policy key 的归因
  - remediation `L1-L3` alert bucket 与 active alert 热点归因
- `web/src/lib/agent-execution-launch-presets.test.ts`
  - launch preset 套用后的创建表单默认值
  - 默认 preset 与显式选择的优先级
  - preferred agent 失效时的回退逻辑
  - 直启 preset 的可用性判定

后续仍建议补充：

- owner 创建执行会话
- 非 owner 不可更新执行状态
- 状态流转合法性校验
- disabled agent 拒绝创建执行会话
- failed/cancelled 的 `platform` execution requeue 行为
