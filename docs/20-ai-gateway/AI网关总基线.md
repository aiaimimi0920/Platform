# AI 网关总基线

## 目的

本文档用于作为 `AI Gateway` 在 `docs/` 体系下的新的总基线。

它负责回答四个核心问题：

1. 正式网关本体是谁
2. 请求主链是什么
3. provider / surface / implementation line 应如何理解
4. 哪些文档属于正式长期基线，哪些只是历史记录

---

## 1. 当前正式总判断

Rust `gateway/` 是当前 AI 网关的唯一长期正式网关本体。

这意味着：

- 它 owner：
  - 对外 `baseURL + api_key` 入口
  - 平台 access key
  - 真实 provider credential
  - 路由、keepalive、runtime material、protocol bridge、request audit
- 其他站点/控制面：
  - 只是客户端或 operator frontend
  - 不是长期主 owner

---

## 2. 当前正式请求主链

AI 网关当前主链必须统一理解为：

1. ingress protocol parse
2. canonical request normalize
3. auth / policy / quota / session ensure
4. route resolution
5. protocol bridge 或 same-family fast path
6. provider transport
7. caller-visible response normalize

换句话说：

- 平台默认对调用方承担协议兼容责任
- 不要求客户端先学会平台内部 canonical contract
- 但也不允许为了某条 provider 再造一条绕开主链的秘密发送链

---

## 3. 当前正式两层 key / 凭证模型

必须长期区分：

### 3.1 平台访问 key

作用：

- 面向调用方
- 决定“谁能调用什么”

### 3.2 真实 provider credential

作用：

- 面向上游 provider
- 决定“真正拿什么去调上游”

这两层不能再混。

后续无论是：

- 万能测试 key
- bundle
- access projection
- provider quota

都必须先说清楚它属于哪一层。

---

## 3.5 TS gateway router 退役 inventory

`packages/ai-gateway-domain/src/modules/gateway/router.ts` 中残留的 `gatewayRouter` 只允许理解为迁移期 legacy HTTP surface。

正式边界如下：

- Rust `gateway/` 继续是 AI gateway runtime 与 management API 的长期 owner。
- `web/src/app/ops/gateway/**` 与 `web/src/lib/account-client.ts` 中的 operator gateway 能力默认应通过 `web/src/lib/gateway-request.ts` 直连 Rust gateway internal API。
- 本地 bootstrap helper 默认也应直连 Rust gateway 映射端口，而不是依赖 account-api 暴露旧聚合 route。
- `packages/ai-gateway-domain` 可以继续承接迁移期 migration、类型、历史数据访问、client helper 或旧代码保留，但不得新增长期 runtime owner route。
- 已废弃的旧 TypeScript gateway 不得重新作为运行单元、helper 主路径或默认兼容层引回。

当前 operator 调用对照表见：

- `Operator到RustGateway接口对照表.md`

---

## 4. 当前正式服务商建模

当前 provider 相关结论默认必须按下面粒度表达：

1. `service provider identity`
2. `implementation line`
3. `provider surface`
4. `protocol profile`
5. `endpoint family / capability family`

禁止再写成：

- “这个服务商已经完成”

却不区分：

- 官方 API
- web reverse
- browser-owned
- program-owned

---

## 5. 当前正式文档分类

在 AI 网关主题下，旧 `docs/` 中的文档现在应按三类理解：

### 5.1 Canonical source material

当前新的 canonical 主线主要包括：

- `AI网关协议与路由总线.md`
- `单行凭证生命周期与文件夹同步基线.md`
- `AI网关运行时与会话总线.md`
- `AI网关服务商建模与凭证体系.md`
- `服务商凭证库存水位与补货通知基线.md`

这些文档共同承接了历史总线材料，并构成当前 `docs/` 体系下的正式 owner。

### 5.2 Provider/surface 专题

当前专题型 canonical docs 例如：

- `Gemini三线路与Canvas派生运行时架构规范.md`
- `Qwen平台实现线、可选编译与物理隔离基线.md`
- `ChatGPT官方API与WebReverse双线路基线.md`

这些是专题材料，不应再凌驾于总基线之上。

### 5.3 Historical construction docs

例如：

- `progress/`
- `analysis/`
- `plan/`
- `实施总结 / 草案 / 风险评估`

这些保留过程真相，但不应再直接当长期规则引用。

---

## 6. 当前正式 AI Gateway 读法

后续若要理解当前网关，建议按下面顺序读：

1. 本文
2. `AI网关协议与路由总线.md`
3. `AI网关运行时与会话总线.md`
4. `AI网关服务商建模与凭证体系.md`
5. `AI网关测试与验收总线.md`
6. `服务商凭证库存水位与补货通知基线.md`
7. `rules/AI网关多协议兼容测试守则.md`
8. `rules/AI网关服务商凭证库分层与换取守则.md`
9. 具体 provider/surface 专题

---

## 7. 当前重建后的正式边界

从现在开始：

- 新的网关总线结论，优先写入 `docs/20-ai-gateway/`
- 旧 `docs/` 中的网关专题文档继续保留
- 若它们与 `docs/` 冲突：
  - **以 `docs/` 为准**

这就是当前 AI 网关文档主线的正式边界。
