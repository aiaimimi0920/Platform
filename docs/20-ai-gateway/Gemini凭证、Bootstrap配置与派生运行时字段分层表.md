# Gemini 凭证、Bootstrap 配置与派生运行时字段分层表

本文档是 Gemini 三线路架构的字段分层对照表。

它只回答一个问题：

> 某个字段到底属于：
> - 第二条线源凭证
> - 第三条线 bootstrap 配置
> - 还是第三条线派生运行时材料

---

## 1. 三层对象

| 层 | 语义 | owner |
| --- | --- | --- |
| 源凭证 `source credential` | Gemini web 身份底座 | `web_reverse` |
| bootstrap 配置 `bootstrap config` | Canvas app 创建入口配置 | `canvas_web_reverse` implementation line |
| 派生运行时 `derived runtime credential` | concrete Canvas app 运行时材料 | `canvas_web_reverse / program-owned` |

---

## 2. 字段分层总表

| 字段 | 所属层 | 是否用户导入 | 是否秘密材料 | 是否通常固定 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `__Secure-1PSID` | source credential | 是 | 是 | 否 | Gemini web 主 cookie，第二条线核心源凭证 |
| `__Secure-1PSIDTS` | source credential | 是 | 是 | 否 | Gemini web 辅助 cookie，建议与 `__Secure-1PSID` 一起提供 |
| `cookieHeader` | source credential | 是 | 是 | 否 | 便于直接复放或 session 组装 |
| `runtimeStateObjectKey` | source credential | 是 | 是 | 否 | 指向 browser-state / storage-state 对象；第三条线也会继续复用它 |
| `credentialMaterialKey` | source credential | 是 | 否 | 相对稳定 | 用于把同源 web session 与第三条线派生物关联起来 |
| `shareId` | bootstrap config | 默认否 | 否 | **是，若当前只有 canonical 入口** | 用于 `share -> app` materialize，不是用户级秘密 |
| `shareUrl` | bootstrap config | 默认否 | 否 | **是，若当前只有 canonical 入口** | 与 `shareId` 同义层，适合作为实现线配置 |
| `canvasProgramOperation` | bootstrap config | 可选 | 否 | 可固定/可映射 | 指明按什么 operation 去 materialize 或引导 app |
| `canvasProgramUrl` | derived runtime credential | 否 | 否 | 否 | 具体 Canvas app URL，实例级运行时结果 |
| `pageUrl` | derived runtime credential | 否 | 否 | 否 | 当前 app 页面的具体 URL |
| `appPath` | derived runtime credential | 否 | 否 | 否 | 具体 app 路径，如 `/app/<id>` |
| `conversationId` | derived runtime credential | 否 | 否 | 否 | 当前 app conversation 标识 |
| `responseId` | derived runtime credential | 否 | 否 | 否 | 当前 app response 标识 |
| `canvasProgramInvokeContract` | derived runtime credential | 否 | 否 | 否 | 当前第三条线 steady-state 最核心的程序合同 |
| `candidatePairs` | derived runtime credential | 否 | 否 | 否 | runtime 聚合 hint |
| `aggregateHints` | derived runtime credential | 否 | 否 | 否 | runtime 聚合 hint |
| `lastSeenConversationId` | derived runtime credential | 否 | 否 | 否 | 最近一次成功 runtime 追踪 |
| `lastSeenResponseId` | derived runtime credential | 否 | 否 | 否 | 最近一次成功 runtime 追踪 |
| `capturedAt` | derived runtime credential | 否 | 否 | 否 | runtime 派生时间 |
| `lastValidatedAt` | derived runtime credential | 否 | 否 | 否 | runtime 最近校验时间 |

---

## 3. 当前正式推荐的数据边界

### 3.1 用户/外部程序默认只需要输出什么

默认只需要输出：

- 第二条线源凭证
  - `__Secure-1PSID`
  - `__Secure-1PSIDTS`
  - `cookieHeader`
  - `runtimeStateObjectKey`
  - `credentialMaterialKey`

这就是用户级“主凭证”。

---

### 3.2 `shareId/shareUrl` 最合理放哪

如果当前 Gemini Canvas 只有一个 canonical app 创建入口，那么：

- `shareId/shareUrl` 最合理放在：
  - provider account 配置
  - provider surface 配置
  - implementation-line bootstrap 配置

当前仓库里这份 canonical bootstrap 默认值截至 `2026-05-12` 已配置为：

- `shareId = fe24c455a570`
- `shareUrl = https://gemini.google.com/share/fe24c455a570`

而不是：

- 每条用户源凭证

所以：

- `shareId` 更像“第三条线配置”
- 不是“用户凭证的一部分”

---

### 3.3 什么才是第三条线真正会失活、需要重建的对象

真正会失活的是：

- `canvasProgramUrl`
- `appPath`
- `conversationId`
- `responseId`
- `canvasProgramInvokeContract`

也就是：

- **derived runtime credential**

不是：

- 第二条线源凭证
- 也不是固定 `shareId/shareUrl`

---

## 4. 当前正式工作流

### 4.1 正常 steady-state

1. 选中一条 Gemini web 源凭证
2. 读取固定 bootstrap 配置 `shareId/shareUrl`
3. 若已有可用 derived runtime，则直接复用
4. 若没有，则执行：
   - `GET /share/<shareId>`
   - `POST rpcids=ujx1Bf`
5. 派生新的：
   - `canvasProgramUrl`
   - `appPath`
   - `conversationId`
   - `responseId`
   - `canvasProgramInvokeContract`
6. 后续只走 `program-owned contract`

### 4.2 第三条线失活时

1. 标记旧 derived runtime 失效
2. 保留第二条线源凭证
3. 保留固定 bootstrap 配置
4. 重新 materialize 新 app
5. 用新 derived runtime 覆盖旧值

---

## 5. 最终一句话

Gemini 当前最合理的长期模型应当固定为：

- **第二条线源凭证 = 用户导入并长期维护**
- **`shareId/shareUrl` = 第三条线固定 bootstrap 配置**
- **第三条线 app/runtime = 网关自动派生、持久化、保活、重建**
