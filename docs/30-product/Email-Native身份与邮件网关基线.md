# Email-Native 身份与邮件网关基线

## 目的

本文档用于把旧 `legacy source: 真实邮箱接入与邮件网关配置文档.md`、`legacy source: NeuroLoom真实邮箱身份锚点与Email-Native接入基线.md` 等内容收成新的 canonical 专题。

---

## 1. 当前正式定位

`Email-Native` 当前正式不是“把平台改造成完整邮箱服务”。

它的正式定位是：

1. 真实邮箱作为外部身份锚点
2. 真实邮箱作为低风险、异步、可审计的 ingress/egress 层
3. 平台内 `mailbox` 作为收敛与投递目标

---

## 2. 身份锚点规则

当前正式规则：

- `users.id` 继续是内部 canonical user id
- 真实邮箱不得替代内部主键
- `auth_identities` 可以承接已验证真实邮箱，作为外部身份锚点

因此：

- 真实邮箱是外部身份锚点
- 不是平台内部主键

---

## 3. 邮件网关的批准能力范围

当前正式批准的邮件主线只包括：

1. 真实邮箱绑定与验证
2. 邮件调用 Agent / 任务
3. 邮件回执 / 结果投递

当前不批准的方向包括：

- 仅凭邮件直接完成高风险资金动作
- 仅凭邮件直接完成高风险权限变更
- 把平台 mailbox 退化成完整 SMTP/IMAP 产品替代

---

## 4. 与平台其他真相层的边界

邮件入口不得替代这些正式真相层：

- `task-hub`
- `agent-execution`
- `wallet-ledger`
- `fulfillment`

正式理解是：

- 邮件只负责外部 ingress / egress
- 真正业务状态仍由平台内部真相层 owner

---

## 5. 当前新文档关系

本文是以下新文档的细专题补充：

- `邮箱、公告与运营投递总线.md`
- `账户域API与服务边界.md`
- `商品、资产与权益总线.md`

若这些总线文档与本文冲突：

- 先以上位总线判断边界
- 具体 Email-Native 专题细节以本文为准

---

## 6. 当前旧来源

本文当前主要吸收这些旧文档：

- `legacy source: account/真实邮箱接入与邮件网关配置文档.md`
- `legacy source: NeuroLoom真实邮箱身份锚点与Email-Native接入基线.md`
- `legacy source: NeuroLoom站内邮箱框架.md`

---

## 7. 当前正式结论

从现在开始：

- Email-Native 已有新的 canonical 专题
- 真实邮箱是外部身份锚点与邮件 ingress/egress 层
- 平台内部主键和业务真相层不因邮件接入而改变
