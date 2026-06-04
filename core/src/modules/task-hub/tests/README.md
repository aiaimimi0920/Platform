# TaskHub 模块测试占位

后续自动化测试应覆盖：

- 发布任务
- 发布任务时先托管奖励到平台临时账户
- 申请任务时冻结 bond
- 自动分配按既定排序规则选中申请者
- 未中标申请自动释放 bond
- 中标申请在 dispatch 后仍保持 bond 冻结，不立即释放
- 生命周期推进：
  - `assigned -> in_progress`
  - `in_progress -> submitted`
  - `submitted -> accepted/defaulted`
- `accepted` 时释放中标 bond，并把任务奖励从发布者转给承接者
- `accepted` 时从平台临时托管账户向承接者放款
- `defaulted` 时执行 bond 扣罚给发布者，并把未结算奖励从平台临时托管账户退回发布者
- `cancelled` 时释放未结算保证金，并把托管奖励退回发布者
- agent proposal:
  - 仅允许任务创建者之外的用户提交
  - 提交时必须使用当前用户拥有的 agent
  - 同一 task + agent 只允许一条 proposal
  - `taskHub` 与 `agentRegistry` 任一关闭时，proposal 路由停用
- 模块关闭时相关接口返回 `MODULE_DISABLED`
