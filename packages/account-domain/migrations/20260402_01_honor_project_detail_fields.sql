ALTER TABLE honor_projects
  ADD COLUMN owner_handle text NOT NULL DEFAULT 'neuroloom',
  ADD COLUMN owner_label text NOT NULL DEFAULT 'NeuroLoom 团队',
  ADD COLUMN category_label text NOT NULL DEFAULT '人工智能',
  ADD COLUMN stage_label text NOT NULL DEFAULT '方案整理',
  ADD COLUMN progress_percent integer NOT NULL DEFAULT 20,
  ADD COLUMN progress_label text NOT NULL DEFAULT '当前处于早期推进阶段。',
  ADD COLUMN reward_share_label text NOT NULL DEFAULT '收益分成方案待后续明确',
  ADD COLUMN sponsor_open boolean NOT NULL DEFAULT true,
  ADD COLUMN sponsor_status_label text NOT NULL DEFAULT '开放赞助',
  ADD COLUMN join_open boolean NOT NULL DEFAULT true,
  ADD COLUMN join_status_label text NOT NULL DEFAULT '接收协作者',
  ADD COLUMN collaboration_label text NOT NULL DEFAULT '协作流程待完善',
  ADD COLUMN funding_target_amount integer NOT NULL DEFAULT 10000,
  ADD COLUMN workspace_href text NOT NULL DEFAULT 'https://github.com/neuroloom-labs',
  ADD COLUMN workspace_label text NOT NULL DEFAULT '外部工作目录',
  ADD COLUMN detail_body text NOT NULL DEFAULT '项目详情将随着后端字段完善逐步补齐。';

UPDATE honor_projects
SET
  owner_handle = 'zhiwei',
  owner_label = '知微',
  category_label = '人工智能',
  stage_label = '原型打磨',
  progress_percent = 48,
  progress_label = '排版引擎与图表美化链路已联通，当前在做批量模板与审阅工作流。',
  reward_share_label = '成功上线后 8% 净收益回流支持者',
  sponsor_open = true,
  sponsor_status_label = '开放赞助',
  join_open = true,
  join_status_label = '接收协作者',
  collaboration_label = '设计 / Prompt / Python 工具链协作',
  funding_target_amount = 12000,
  workspace_href = 'https://github.com/neuroloom-labs/paper-polish',
  workspace_label = 'GitHub 工作目录',
  detail_body = '该项目面向论文写作与投稿流程，核心目标是把排版、图表增强、引用整理与审稿反馈整合成一个可复用的 AI 工具链。当前阶段重点不是公开大规模获客，而是先把编辑、模板与批处理体验打磨到稳定可交付。'
WHERE name = '论文美化软件';

UPDATE honor_projects
SET
  owner_handle = 'sora',
  owner_label = '空川',
  category_label = '网络搜索',
  stage_label = '协作封测',
  progress_percent = 73,
  progress_label = '多终端协作与权限同步已经进入封测，当前在压缩冷启动与同步延迟。',
  reward_share_label = '正式商用后 12% 收益分成',
  sponsor_open = true,
  sponsor_status_label = '开放赞助',
  join_open = true,
  join_status_label = '接收开发者',
  collaboration_label = '前端终端壳 / 同步引擎 / 文档编排',
  funding_target_amount = 15000,
  workspace_href = 'https://github.com/neuroloom-labs/terminal-collab',
  workspace_label = 'GitHub 工作目录',
  detail_body = '终端协作工作台希望把“轻协作 + 本地优先 + 指令式面板”整合成一个适合小团队的工作区。项目当前已经能跑通账户终端、任务、审计与基础同步，正在补齐更稳定的多人协作体验。'
WHERE name = '终端协作工作台';

UPDATE honor_projects
SET
  owner_handle = 'dax',
  owner_label = '达西',
  category_label = '人工智能',
  stage_label = '训练回放',
  progress_percent = 36,
  progress_label = '训练回放与评估板已能展示主链，当前在补全指标聚类与失败重放。',
  reward_share_label = '成功结项后 10% 阶段性收益回馈',
  sponsor_open = true,
  sponsor_status_label = '开放赞助',
  join_open = false,
  join_status_label = '核心成员制',
  collaboration_label = '评估指标 / 训练批次 / 回放分析',
  funding_target_amount = 10000,
  workspace_href = 'https://github.com/neuroloom-labs/agent-training-dashboard',
  workspace_label = 'GitHub 工作目录',
  detail_body = 'Agent 训练仪表盘用于把训练批次、失败重放、指标波动和人工接管记录收成一套可以持续迭代的训练视图。当前阶段重点是把实验数据串起来，而不是先做广义平台化发布。'
WHERE name = 'Agent 训练仪表盘';

UPDATE honor_projects
SET
  owner_handle = 'mei',
  owner_label = '梅时',
  category_label = '网络代理',
  stage_label = '规则校核',
  progress_percent = 29,
  progress_label = '当前完成最小规则扫描与告警编排，后续继续接入更完整的策略集。',
  reward_share_label = '项目结项后按 6% 回报支持者',
  sponsor_open = false,
  sponsor_status_label = '暂未开放',
  join_open = true,
  join_status_label = '接收规则维护者',
  collaboration_label = '策略模板 / 风险标签 / 审计规则',
  funding_target_amount = 8000,
  workspace_href = 'https://github.com/neuroloom-labs/compliance-check',
  workspace_label = 'GitHub 工作目录',
  detail_body = '合规模块验证器面向接口规则、隐私边界与发布前巡检场景。项目目标不是替代完整的安全平台，而是先把最常用的上线前校核、异常告警与策略演练接入账户终端。'
WHERE name = '合规模块验证器';
