# AI 网关 Provider 凭证管理 API 基线

## 目的

本文档用于承接历史 provider 凭证管理 API 设计中仍然有长期价值的语义。

---

## 1. 当前正式定位

Provider 凭证管理 API 当前负责：

- 管理单条真实 provider credential
- 批量导入导出与同步
- 触发缓存/运行时失效或预热语义

它不应再被理解成：

- 旧时代整包 provider account payload 的唯一 owner

---

## 2. 当前正式边界

Provider 凭证管理 API 当前必须服从：

- 单行凭证真相层
- provider account 与 provider credential 分离
- 文件夹同步可导入导出

也就是说：

- API 管的是单条真实凭证生命周期
- 不是历史整包大 payload 模型

---

## 3. 当前与其他文档的关系

本文是以下文档的 API 角度补充：

- `单行凭证生命周期与文件夹同步基线.md`
- `AI网关服务商建模与凭证体系.md`
- `AI网关运行时与会话总线.md`

---

## 4. 当前旧来源

本文当前主要吸收：

- `legacy source: AI网关Provider凭证管理API设计.md`

---

## 5. 当前正式结论

从现在开始：

- Provider 凭证管理 API 已有新的 canonical 文档
- 旧 API 设计稿默认退为参考层
