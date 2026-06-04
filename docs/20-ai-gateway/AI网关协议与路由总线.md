# AI 网关协议与路由总线

## 目的

本文档用于把 AI Gateway 当前最核心的协议与路由主线重新收口成一份新的 canonical 文档。

它优先吸收和替代旧文档中的以下总线类内容：

- `AI网关总基线.md` 中对请求主链的总判断
- `AI网关服务商建模与凭证体系.md` 中对 provider / surface / protocol family 的高层建模
- `AI网关测试与验收总线.md` 中对协议兼容与验收矩阵的 caller-visible 约束

---

## 1. 当前正式请求主链

AI Gateway 的正式请求主链固定为：

1. `ingress parse`
2. `canonical normalize`
3. `auth / policy / quota / session ensure`
4. `route resolution`
5. `protocol bridge / same-family fast path`
6. `provider transport`
7. `caller-visible response normalize`

这条主链适用于：

- OpenAI family
- Anthropic family
- Gemini family
- Search family
- 以及各类图片/音频/视频/音乐 public ingress

它的核心原则是：

- **协议兼容默认由服务端承担**
- **所有正式入口都先进入统一请求管线**
- **同协议直连只是统一请求管线内部的优化**

禁止再把某条 provider 的特殊发送逻辑单独解释成“绕开网关主链的第二条正式入口”。

---

## 2. 当前正式分层

协议与路由相关内容，当前必须按以下并行维度理解：

1. `service provider identity`
2. `implementation line`
3. `provider surface`
4. `protocol family`
5. `protocol profile`
6. `execution mode`

这些维度互相相关，但互不替代。

### 2.1 provider identity

回答：

- 这是哪一家服务商

### 2.2 implementation line

回答：

- 同一家服务商下，当前是哪条本质不同的实现方案

### 2.3 surface

回答：

- 当前具体路由到哪个产品面/能力面

### 2.4 protocol family

回答：

- 当前调用方和上游各自说的是哪种协议族

### 2.5 protocol profile

回答：

- 同一协议族下是哪一种具体变体

### 2.6 execution mode

回答：

- 这次请求最后通过什么发送链执行

---

## 3. 当前正式 ingress family

当前公开入口不再只限于对话协议，正式应分成三类：

### 3.1 对话/文本入口

包括：

- `chat/completions`
- `responses`
- `messages`
- `completions`
- `generateContent`
- `live`
- `realtime`
- `converse`
- `cohere chat`

### 3.2 非对话公共入口

包括：

- `embeddings`
- `audio/transcriptions`
- `audio/speech`
- `images/generations`
- `images/edits`
- `music/generations`
- `videos/generations`

### 3.3 搜索与研究入口

包括：

- `search`
- `fetch`
- `research`
- `credits`

后续任何“支持了某协议”的说法，都必须先说清楚是这三类中的哪一类，而不是只说“OpenAI 兼容”。

---

## 4. 当前正式 canonical 语义

统一请求管线内部，当前至少应维护以下 canonical 语义层：

### 4.1 conversation semantics

例如：

- `messages_turns`
- `responses_input_output`
- `prompt_completion`
- `parts_turns`
- `live_session_events`

### 4.2 tool semantics

例如：

- `auto`
- `none`
- `required`
- `specific_function`
- `prompt_only`

### 4.3 completion semantics

例如：

- `stop`
- `tool_calls`
- `length`
- `content_filter`
- `other_provider_reason`

这意味着后续测试和路由说明都不能只写“返回成功”，而要同时说明：

- 它在 canonical 内部被理解成什么请求语义
- 它最终被归一成什么结束语义

---

## 5. 当前正式同协议直连原则

当前允许：

- 在统一请求管线内部，对同协议 family 做 fast path

但必须满足：

1. 仍然先经过统一 auth / policy / quota / route 主链
2. 不得绕开审计、路由、provider quota、keepalive
3. 不得让 fast path 变成一个新的旁路网关

所以“same-family direct path”的正式含义是：

- **优化**

不是：

- **第二条独立正式发送链**

---

## 6. 当前正式 route resolution

路由热路径当前必须至少考虑：

1. access key / access projection
2. route policy
3. provider capability
4. `credential + model` 可用协议 family
5. sticky affinity
6. provider quota snapshot
7. breaker / cooling / failure state
8. execution mode readiness

这里最关键的一条是：

> 最终最小安全判定粒度，不是 provider，也不是 provider account，而是 `selected provider credential + selected model`

---

## 7. 当前正式 execution mode 理解

`execution mode` 当前不是 provider 身份，也不是 protocol family。

它只回答：

- 这次请求最后是怎样被执行的

典型包括：

- `direct_http`
- `browser_backed`
- `browser_owned_relay`
- `program_owned_relay`
- `mixed`

因此后续任何“已完成/未完成”结论，都必须同时带 execution mode 语义。

---

## 8. 当前正式冲突处理

如果旧专题文档仍然在某些 provider 下保留历史写法，例如：

- 把 provider identity 和 protocol family 混写
- 把 browser-backed owner 当成纯 HTTP owner
- 把某个 surface 的结果说成整家服务商的结果

则从现在开始，以本文为准。

---

## 9. 当前正式结论

后续若继续开发或写文档，默认先用本文回答下面这些问题：

1. 这条请求从哪个 ingress family 进来
2. 在 canonical 内部被理解成什么语义
3. 最后路由到哪条 implementation line / surface
4. 是否走 same-family fast path
5. execution mode 到底是什么

只有先把这五件事说清楚，后续 provider 专题文档才不会继续互相打架。
