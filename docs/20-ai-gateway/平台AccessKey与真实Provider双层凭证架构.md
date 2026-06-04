# 平台 AccessKey 与真实 Provider 双层凭证架构

## 目的

本文档用于承接历史双层凭证架构完整实现指南中的长期正式结论。

---

## 1. 当前正式双层模型

AI 网关当前正式采用双层凭证架构：

### 1.1 平台访问层

负责回答：

- 谁可以访问
- 可以访问哪些模型/服务
- 平台侧额度与资格如何结算

典型对象：

- `AccessKey`
- bundle
- access projection

### 1.2 真实 Provider 层

负责回答：

- 最后拿哪条真实凭证调用上游

典型对象：

- provider credential row
- session/cookie
- API key
- browser state

---

## 2. 当前正式请求链

标准请求链应理解为：

1. 用户或客户端携带平台 `AccessKey` 进入网关
2. 网关在平台侧判断权限与模型可访问性
3. 网关决定目标 provider / implementation line / surface
4. 网关从真实凭证库中选出真实 provider credential
5. 再发送到上游

这条链路的关键点是：

- 平台 key 永远不直接等价于上游 provider 凭证

---

## 3. 当前与其他文档的关系

本文是以下文档的架构总览补充：

- `统一AccessKey与客户端接入基线.md`
- `单行凭证生命周期与文件夹同步基线.md`
- `AI网关运行时与会话总线.md`

若与上述更细文档冲突：

- 以更细的专题文档为准

---

## 4. 当前旧来源

本文当前主要吸收：

- `legacy source: 双层凭证架构-完整实现指南.md`

---

## 5. 当前正式结论

从现在开始：

- 双层凭证架构已有新的 canonical 文档
- 旧完整实现指南默认退为参考层
