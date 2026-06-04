# Phase 2 - AIStudio Web Reverse Runtime Material And Request Plan

## 目标

本阶段用于把 `AIStudio Web Reverse` 后续去浏览器依赖化所需的基础对象层先收出来。

当前目标不是立刻完成 pure HTTP 热路径，而是先把下面两类对象变成正式代码资产：

- `runtime material`
- `request plan`

---

## 当前正式前提

1. 官方线继续统一归 `gemini official api`
2. `AIStudio` 当前唯一独立线仍是 `AIStudio Web Reverse`
3. 浏览器当前仍允许作为辅助执行与恢复手段
4. 长期目标仍是：
   - `program_owned`
   - `pure_http_replay`

---

## 本阶段范围

本阶段只允许承接以下目标：

- 为 AIStudio Web Reverse 建立最小 `runtime material` 对象
- 为 AIStudio Web Reverse 建立最小 `request plan` 对象
- 让当前 `text / embeddings / TTS / images` 执行链开始复用这些对象
- 在不扩大能力面的前提下，为后续 pure HTTP 热路径铺路

---

## 本阶段非目标

本阶段明确不包含：

- 宣称已完成 pure HTTP 热路径
- 删除 browser fallback
- 引入新的 endpoint family
- 把 `image edits / music / videos` 纳入正式 scope
- 对 caller-visible 成功语义做扩面

---

## 任务清单

- [x] 建立最小 `runtime material` 对象层
- [x] 建立最小 `request plan` 对象层
- [x] 让 `TTS / images / embeddings` 开始复用对象层
- [x] 让 `text` 与 `stream/tools` 继续向同一 request plan 抽象收口
- [x] 归纳当前哪些字段仍属于 browser-only，哪些已经可作为 future pure-http material
- [x] 补一轮针对性验证并沉淀进入 Phase 3 的边界说明

---

## 当前状态

- Phase：`completed`
- 本轮类型：`rust-structure + runtime-foundation`
- 当前结论：
  - `runtime material` 与 `request plan` 已进入代码层
  - `runtimeStateObjectKey` 不再在 `config_from_payload` 解析期统一硬失败
  - `browser-backed request / browser executor / local browser worker` 仍在执行期强制要求 `runtimeStateObjectKey`
  - `TTS / images` 的 mixed lane 当前已显式区分：
    - `direct send material = cloud_api_key`
    - `browser fallback material = browser_state`
  - `text / stream / TTS` 的 browser executor 账号 id 贯通已补齐
  - `text / stream/tools` 当前已统一走 `generateContent request plan -> browser request spec` 抽象
  - 浏览器仍未退出热路径
  - pure HTTP 热路径仍未完成

## 当前材料边界

当前仍属于 `browser-only` 或 browser execution 必需的字段：

- `runtimeStateObjectKey`
- `appUrl`
- `browserExecutablePath`

当前已经可作为 future pure-http material / direct send material 的字段：

- `cloudApiKey`
- `generateContent / embeddings` request URL
- `content-type / x-goog-api-key` 请求头
- 已对象化的 JSON request body / request spec

## 本轮验证

- `cargo fmt --manifest-path gateway/Cargo.toml --all`
- `CARGO_TARGET_DIR=.runtime/cargo-target-aistudio-phase2-main cargo check --manifest-path gateway/Cargo.toml`
- `CARGO_TARGET_DIR=.runtime/cargo-target-aistudio-phase2-main cargo test --manifest-path gateway/Cargo.toml aistudio -- --nocapture`

当前结果：

- 三条命令均已通过
- focused `aistudio` tests 已通过，覆盖 `config` 解析门槛、browser executor 输入约束与现有 ingress/preset 断言
- 本轮 AIStudio Web Reverse 修复未阻塞 Rust gateway 编译
- 当前仍存在仓内既有 warning，但不属于本轮新增阻塞

## 进入 Phase 3 前的剩余边界

- `text / stream/tools` 虽已开始复用同一类 `generateContent` request plan / browser request spec
- 但热路径仍未脱离 browser-backed execution
- 当前 `stream` 仍保持 accumulate canonical -> fake OpenAI SSE 外观
- 下一阶段真正要推进的是：
  - `program-owned` 文本 replay 主链
  - browser-assisted bootstrap / recovery 与 pure-http hot path 的继续拆分
