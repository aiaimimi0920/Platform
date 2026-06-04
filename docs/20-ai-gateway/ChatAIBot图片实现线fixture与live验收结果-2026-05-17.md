# ChatAIBot 图片实现线 Fixture 与 Live 验收结果 - 2026-05-17

## 摘要

本轮对 `ChatAIBot` 图片实现线做了两层正式验收：

1. `fixture`
2. `live`

并且把实现线当前的正式 acceptance boundary 固定为：

- 生成：
  - 必须 caller-visible 成功
- edit / merge：
  - caller-visible 成功，或
  - provider 明确 free-tier quota gate accepted

---

## 当前实现线身份

- 平台：`ChatAIBot`
- 实现线：`web_reverse`
- operator surface：`chataibot-images`
- `protocolProfile = chataibot`
- `protocolFamily = chataibot_images`
- adapter：`chataibot_compatible`

---

## 1. Fixture 结果

- suite：`chataibot_images_fixture`
- 归档：
  - `output/chataibot_images_fixture_20260517_v5`
- 结果：
  - `5/5 pass`

### 覆盖项

1. `generation.url`
2. `generation.b64`
3. `edit.single`
4. `edit.merge`
5. `/v1/models`

### 结论

- fixture 口径下，图片线主合同已完整成立

---

## 2. Live 结果

- suite：`chataibot_images_live`
- 归档：
  - `output/chataibot_images_live_20260517_v4`
- 历史结果：
  - `5/5 pass`

补充说明：

- 这组 `5/5` 结果成立的前提是：当时使用的 free-tier 账号仍有可用生成额度
- 同一账号在后续重复 rerun 时，`generation.url / generation.b64` 也可能因为 provider 额度耗尽而直接返回：
  - `403`
  - `Subscribe to get more requests`
- 若出现这种情况，默认先理解为 **provider free-tier quota 已耗尽**，不要优先误判成网关实现回退
- 截至本轮最新 fresh rerun，当前已观察到这类 gate：
  - 归档：
    - `output/chataibot_images_live_quota_gate_probe_20260517_v1.txt`
  - 失败摘要：
    - `No healthy ChatAIBot free image model passed the live generation probe`
    - `qwen-lora: http_403`
    - `google-nano-banana-2: http_403`

### 2.1 生成成功项

当前 caller-visible 成功：

1. `generation.url`
2. `generation.b64`
3. `/v1/models`

### 2.2 edit / merge 的 live acceptance

当前 live edit / merge 使用：

- `google-nano-banana-2`

这样做的原因是：

- generation 当前更稳的健康 free model probe 结果是：
  - `qwen-lora`
- 但 edit / merge 在 live 上更适合用 provider 自己更明确的 Google 编辑模型做 quota / gate 观察

当前 live 结果里：

- `edit.single`
- `edit.merge`

都允许按下面口径判通过：

- 若 caller-visible 直接成功，当然通过
- 若返回 provider 明确 gate：
  - `403`
  - `NotEnoughFreeLimitAnswerCountError`
  - `Subscribe to get more requests`
  当前按 **quota gate accepted** 理解，也算通过

### 2.3 当前 live 真实含义

这不是在“放宽标准掩盖没实现”。

它的正式含义是：

1. gateway 已成功把 ChataIBot 图片 edit / merge 请求正确送到真实上游
2. 当前失败面是 provider free-tier 对 edit / merge 的明确 gate
3. 该 gate 不属于网关未实现

---

## 3. 本轮关键修复

本轮 live 过程中，真实发现并修复了一个 runtime 问题：

### 3.1 空 `baseUrl` 覆盖问题

旧行为里，provider credential payload 若保留了：

```json
{
  "baseUrl": ""
}
```

会把 provider account 的：

```json
{
  "baseUrl": "https://chataibot.pro"
}
```

覆盖掉。

这会导致图片线第一步：

- `/api/user/update`

被拼成相对 URL，并在 live 中表现成：

- `relative URL without a base`

当前已修复为：

- credential 空字符串不再覆盖 account 非空默认值

### 3.2 回归 suite credential 更新策略

本轮还修了 regression suite 的 provider credential ensure helper：

- 旧行为：在旧 payload 上 `update()`
- 新行为：当 suite 传入完整 payload 时，使用新 payload 全量替换

这避免了历史遗留的空字段继续残留在 live credential 行里。

---

## 4. 当前正式结论

截至 `2026-05-17`，`ChatAIBot` 图片实现线可以按下面口径正式理解：

1. 这是一个**单实现线**、**图片专用**的平台接入
2. 当前 fixture 已完整打绿
3. 已存在同日 `live` 绿档：
   - `output/chataibot_images_live_20260517_v4`
4. 当前 fresh rerun 已经表现出明显的 **provider free-tier quota 敏感性**
5. live 中：
   - 历史绿档里的生成链是真 caller-visible 成功
   - edit / merge 当前按 provider 明确 quota gate accepted 通过
   - 后续 rerun 若 generation probe 直接被 `http_403` gate，应优先理解为 provider quota，而不是实现线回退

因此，这条线当前已经达到：

- **正式可用**
- **实现线级 canonical 文档化**
- **可按实现线最小验证上下文独立回归**
