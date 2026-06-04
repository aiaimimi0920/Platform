# AI 网关统一 AccessKey 与客户端接入基线

## 目的

本文档用于接住旧文档中仍然分散的两类高频内容：

1. 平台 `AccessKey` 到底是什么
2. 外部客户端接入网关时，什么算正式兼容路径

---

## 1. AccessKey 的正式定位

平台 `AccessKey` 不是 provider 真实凭证。

它的正式职责是：

1. 识别调用方是谁
2. 判断调用方拥有哪些模型/服务商/实现线访问权
3. 把平台权限投影到网关路由层
4. 允许网关再去换取真实 provider credential

它当前不直接等价于：

- 上游 API key
- 上游 cookie/session
- 上游 browser state

---

## 2. AccessKey 与 provider credential 的关系

正式请求链应理解为：

1. 调用方携带平台 `AccessKey`
2. 网关验证：
   - key 是否有效
   - key 是否具备目标模型/实现线权限
3. 再根据路由和策略，选择：
   - service provider
   - implementation line
   - provider surface
4. 最后从对应 provider credential library 中选出真实执行凭证

因此：

- `AccessKey` 负责平台侧授权
- `provider credential` 负责上游侧执行

二者不得再混成“同一把 key”。

---

## 3. 当前正式支持的客户端接入理解

客户端接入的目标不是“把所有请求都伪装成一种协议”，而是：

- 尽量保持入口协议家族
- 在必要时做 canonical bridge
- 对调用方尽量保持兼容回包

当前正式支持的理解方式包括：

- OpenAI 风格入口
- Anthropic 风格入口
- Gemini 风格入口
- 其他已在网关 family/profile 注册的入口

---

## 4. 客户端兼容的正式判断标准

一条接入路径若要声称“兼容”，必须至少回答：

1. 入口协议是什么
2. 它是否直接命中同协议出口
3. 若不是，桥接到哪个 canonical family
4. 回包是否仍保持入口协议风格
5. 流式/非流式是否都验证过
6. tools/function calling 是否验证过
7. media 能力是否验证过

不能只因为某个简单 `chat` 请求能通，就把整条客户端接入路径说成“已兼容”。

---

## 5. 测试万能密钥与 AccessKey 的关系

当前测试阶段允许存在：

- 平台万能测试 key

它的语义是：

- 平台侧权限和额度全开
- 可访问全部已开放模型/服务商/实现线

但它仍必须：

- 经过正常的 `AccessKey -> projection -> route -> provider credential exchange` 流程

它不是绕过网关 auth 流程的后门 key。

---

## 6. 当前旧文档来源

本文当前主要吸收这些旧文档的长期结论：

- `legacy source: AI网关统一AccessKey与访问表基线.md`
- `legacy source: AI网关客户端接入兼容与请求审计基线.md`
- `legacy source: AI网关统一请求管线与同协议直连基线.md`

后续若这些旧文档与本文冲突：

- **以本文为准**

---

## 7. 当前正式结论

从现在开始：

- `AccessKey` 是平台访问凭证，不是 provider 凭证
- 客户端兼容判断必须按协议家族、桥接、回包与能力面逐项验证
- 旧 `AccessKey` / 客户端接入旧稿默认退为参考层
