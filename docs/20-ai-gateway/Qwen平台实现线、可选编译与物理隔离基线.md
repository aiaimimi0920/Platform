# Qwen 平台实现线、可选编译与物理隔离基线

适用范围：

- Rust `gateway/` 中的 Qwen Platform 相关实现
- operator `provider-create-catalog`
- provider credential folder sync
- regression matrix / compile switch / physical isolation

---

## 1. 当前正式两条实现线

截至 `2026-05-17`，Qwen Platform 当前正式只按下面两条实现线理解：

1. `qwen_official_api`
   - control-plane 主入口：
     - `serviceProviderKey = qwen_platform`
     - `implementationLine = qwen_official_api`
   - 当前共享同一份 official core
   - 当前 canonical surface 有 3 个：
     1. `qwen_dashscope_openai`
     2. `qwen_coding_plan_openai`
     3. `qwen_coding_plan_anthropic`

2. `qwen_web_reverse`
   - control-plane 主入口：
     - `adapter = qwen_web_compatible`
     - `protocolProfile = qwen_web_chat`
   - 当前 canonical surface：
     - `qwen_web_chat`

说明：

- `xfyun_qwen_http`
- `xfyun_qwen`
- `xfyun_qwen_ws`
- `qwen-lora`

都不属于本文所说的 `Qwen Platform` 本体实现线。

补充约束：

- 上述 `xfyun_qwen_*` 当前只是 **XFYun official_vendor_api** 下承载 qwen 商品面的三条 regression suite，
  不是 `qwen_platform` 本体 surface。
- protocol matrix 在执行这些 XFYun suite 时，当前必须按：
  - `serviceProviderKey = xfyun_platform`
  - `protocolProfile`
  - `adapter`
  动态解析 live provider account id；
  不得继续把 suite 模板里遗留的固定 UUID 当成唯一真实 surface 标识。

---

## 2. 官方线的正式关系

Qwen 当前官方侧不是三条独立 public implementation line，而是：

- **一条 `qwen_official_api`**
- **三张 canonical surface**
- **共享一份 official core**

当前共享核心 owner：

- `gateway/src/protocol/qwen/official_api.rs`
- `gateway/src/upstream/qwen/official_api.rs`

三张 official surface 当前只允许在下面这些点保留差异：

- `baseUrl`
- `path`
- `adapter`
- `authMode`
- 少量 provider preset / catalog / regression bootstrap metadata

### 2.1 `qwen_dashscope_openai`

- `adapter = openai_compatible`
- `protocolProfile = qwen_dashscope_openai`
- `provider-create-catalog key = qwen-dashscope-openai`
- 典型 `baseUrl`：
  - `https://dashscope.aliyuncs.com/compatible-mode/v1`

### 2.2 `qwen_coding_plan_openai`

- `adapter = openai_compatible`
- `protocolProfile = qwen_coding_plan_openai`
- `provider-create-catalog key = qwen-coding-plan-openai`
- 典型 `baseUrl`：
  - `https://coding.dashscope.aliyuncs.com/v1`

### 2.3 `qwen_coding_plan_anthropic`

- `adapter = anthropic_compatible`
- `protocolProfile = qwen_coding_plan_anthropic`
- `provider-create-catalog key = qwen-coding-plan-anthropic`
- 典型 `baseUrl`：
  - `https://coding.dashscope.aliyuncs.com/apps/anthropic`

---

## 3. Web Reverse 的正式目标

`qwen_web_reverse` 当前正式目标固定为：

- **request-time browserless**
- **pure HTTP steady-state**

浏览器当前只允许存在于：

- session material 提取
- keepalive / session refresh tooling
- challenge 后人工恢复

不允许把浏览器当作：

- request-time hot path owner
- 默认 relay 执行器

当前 web reverse owner 主入口：

- `gateway/src/protocol/qwen/web_reverse.rs`
- `gateway/src/upstream/qwen/web_reverse.rs`

当前 canonical surface：

- `qwen_web_chat`
  - `adapter = qwen_web_compatible`
  - `protocolFamily = qwen_web_chat`
  - `protocolProfile = qwen_web_chat`
  - `provider-create-catalog key = qwen-web-chat`
  - 典型 `baseUrl`：
    - `https://chat.qwen.ai`

---

## 4. 当前正式 compile switch

Qwen 当前正式 public cargo features：

1. `line-qwen-official-api`
2. `line-qwen-web-reverse`

内部共享 feature：

- `line-qwen-official-core`

当前 `gateway/Cargo.toml` 的正式默认策略是：

- 默认这两条线都开启
- focused 构建时允许使用：
  - `--no-default-features --features line-qwen-official-api`
  - `--no-default-features --features line-qwen-web-reverse`
  - `--no-default-features --features line-qwen-official-api,line-qwen-web-reverse`

### 4.1 profile 到实现线映射

当前 canonical 映射固定为：

- `qwen_dashscope_openai -> qwen_official_api`
- `qwen_coding_plan_openai -> qwen_official_api`
- `qwen_coding_plan_anthropic -> qwen_official_api`
- `qwen_web_chat -> qwen_web_reverse`

历史 alias 继续这样 canonicalize：

- `qwen -> qwen_dashscope_openai`
- `qwen-web`
- `qwen-webui`
- `qwen-web-chat`
- `qwen-webui-replay`
  - 继续归到：
    - `qwen_web_chat`

当前正式要求不只是“profile 解释时看起来等价”，还必须保证这些历史 Qwen web alias 在实际 consumer path 上也继续成立：

- built-in preset lookup：
  - `get_builtin_preset(...)`
- YAML route config：
  - `routing/config.rs`
- credential routing：
  - `routing/credential_routing.rs`

也就是说，下面这些历史 preset id 当前都必须继续走到 canonical Qwen web preset，而不是退化成：

- unknown preset
- raw `openai_compatible` payload fallback

当前已明确覆盖：

- `qwen-web`
- `qwen-webui`
- `qwen-webui-replay`
- `qwen-webui-replay-live`

### 4.2 关闭后的正式行为

当某条 Qwen 实现线被停编时：

1. provider account create / update 必须继续可见但后端校验编译态
2. route preview / access candidate 不得把 disabled line 当作正常候选
3. request execution 必须明确 fail-closed
4. 返回：
   - `gateway_provider_line_compiled_out`

禁止行为：

- 静默 fallback 到另一条 Qwen 实现线
- 用旧 surface 的 live 归档冒充新的 line 仍可用

### 4.3 当前最小 Rust 验证矩阵

截至 `2026-05-17`，Qwen 当前 compile switch 的最小 Rust 回归验证矩阵已经明确补成四象限：

1. `--no-default-features`
2. `--no-default-features --features line-qwen-official-api`
3. `--no-default-features --features line-qwen-web-reverse`
4. `--no-default-features --features line-qwen-official-api,line-qwen-web-reverse`

当前正式要求：

- Qwen line-specific Rust tests 不得只验证 “feature 打开时正常工作”
- 当 `line-qwen-official-api` 被停编时，Qwen official 专属 request-plan / routing 断言当前也必须显式验证：
  - `gateway_provider_line_compiled_out`
- 当 `line-qwen-web-reverse` 被停编时，Qwen web reverse 专属断言也必须显式验证 compiled-out 语义
- 不得继续让 “另一条线被停编时本应返回 compiled-out” 的场景，因为测试仍在 `unwrap()` 正常路径而假失败
- 当前还应直接覆盖 protocol-profile compile gate 本身，因为：
  - `preview_access_candidates(...)`
  - `preview_route_decision(...)`
  这类 access preview / route preview 路径当前就是通过：
  - `is_protocol_profile_compiled_in(...)`
  过滤 disabled line
- 截至 `2026-05-17`，Qwen 当前已经补上了这层 direct test：
  - official profile 启用/停编
  - web profile 启用/停编
  - 都直接断言：
    - `is_protocol_profile_compiled_in(...)`
    - `ensure_protocol_profile_compiled(...)`

也就是说，Qwen 当前 compile-switch 回归不再只看：

- `cargo check`

还必须至少确认：

- no-feature
- official-only
- web-only
- dual-line

这四种组合下的 Qwen targeted Rust tests 都符合预期。

---

## 5. 当前物理编译隔离落点

### 5.1 协议层

Qwen 当前 owner 模块树已经收口到：

- `gateway/src/protocol/qwen/mod.rs`
- `gateway/src/protocol/qwen/official_api.rs`
- `gateway/src/protocol/qwen/official_api_disabled.rs`
- `gateway/src/protocol/qwen/web_reverse.rs`
- `gateway/src/protocol/qwen/web_reverse_disabled.rs`

历史 facade：

- `gateway/src/protocol/qwen_web.rs`

当前只允许继续作为最薄 legacy facade：

- `pub use crate::protocol::qwen::web_reverse::*;`

### 5.2 上游执行层

Qwen 当前 upstream owner 模块树已经收口到：

- `gateway/src/upstream/qwen/mod.rs`
- `gateway/src/upstream/qwen/official_api.rs`
- `gateway/src/upstream/qwen/official_api_disabled.rs`
- `gateway/src/upstream/qwen/web_reverse.rs`
- `gateway/src/upstream/qwen/web_reverse_disabled.rs`

历史 `gateway/src/upstream/client.rs` 当前只保留：

- dispatch / bridge wiring

不再继续堆 Qwen Web 的长篇 owner 逻辑。

---

## 6. Folder sync 与 surface slug

当前 folder sync 下推荐 surface slug：

- `qwen-dashscope-openai`
- `qwen-coding-plan-openai`
- `qwen-coding-plan-anthropic`
- `qwen-web-chat`

当前推荐目录层级：

- `<root>/qwen-platform/qwen-dashscope-openai/api-key/<credential>.json`
- `<root>/qwen-platform/qwen-coding-plan-openai/api-key/<credential>.json`
- `<root>/qwen-platform/qwen-coding-plan-anthropic/api-key/<credential>.json`
- `<root>/qwen-platform/qwen-web-chat/session-auth/<credential>.json`

仓库内同步提供 operator 可直接参考的模板示例：

- `docs/20-ai-gateway/examples/qwen-platform/qwen-dashscope-openai.api-key.example.json`
- `docs/20-ai-gateway/examples/qwen-platform/qwen-coding-plan-openai.api-key.example.json`
- `docs/20-ai-gateway/examples/qwen-platform/qwen-coding-plan-anthropic.api-key.example.json`
- `docs/20-ai-gateway/examples/qwen-platform/qwen-web-chat.session-auth.example.json`

若已经拿到真实 official key，当前还提供：

- `deploy/write-qwen-official-credential-files.ps1`

用于把 DashScope / Coding Plan key material 写入 canonical folder-sync 目录结构。
当前 helper 已验证会写出：

- UTF-8 无 BOM
- 单行 JSON
- 无末尾换行

因此可以直接作为 official live 的 canonical 本地单行凭证落盘入口，而不是只作为“示例脚本”存在。
当前 helper 的 operator 使用语义还固定为：

- 参数优先：
  - `-DashscopeApiKey`
  - `-CodingPlanApiKey`
- 环境变量回退：
  - `GATEWAY_QWEN_DASHSCOPE_API_KEY`
  - `GATEWAY_QWEN_CODING_PLAN_API_KEY`
  - `QWEN_DASHSCOPE_API_KEY`
  - `QWEN_CODING_PLAN_API_KEY`
- 目标文件默认 fail-closed，不会静默覆盖；需要显式：
  - `-Force`

---

## 7. 当前 regression suite 入口

### 7.1 官方线

当前 official 相关 suite：

- fixture
  - `qwen_dashscope_openai_fixture`
  - `qwen_coding_plan_openai_fixture`
  - `qwen_coding_plan_anthropic_fixture`
- live
  - `qwen_dashscope_live`
  - `qwen_coding_plan_openai_live`
  - `qwen_coding_plan_anthropic_live`

说明：

- 三条 official live suite 当前已经正式接入测试矩阵
- 其中 `qwen_dashscope_live` 是既有 suite
- `qwen_coding_plan_openai_live` 与 `qwen_coding_plan_anthropic_live` 是本轮补出的 canonical live probe suite
- 截至 `2026-05-18` 的阿里云官方文档，Coding Plan / 通义灵码套餐额度当前被限定在交互式 AI 编程工具中，
  并明确不支持 `curl / Postman / Dify / 自定义应用程序后端 / 非交互式批量 API` 场景；
  因此对本仓库的 AI gateway API/backend lane，二者当前应按 `服务商不支持` 记录，
  而不是继续作为必须 fresh 打绿的 completion gate
- 真实 live 运行当前按下面顺序解析官方 key：
  1. 环境变量
     - `GATEWAY_QWEN_DASHSCOPE_API_KEY`
     - `GATEWAY_QWEN_CODING_PLAN_API_KEY`
     - 兼容旧别名：
       - `QWEN_DASHSCOPE_API_KEY`
       - `QWEN_CODING_PLAN_API_KEY`
  2. 本地单行凭证文件
     - `%USERPROFILE%\\.neuro\\qwen-platform\\qwen-dashscope-openai\\api-key\\*.json`
     - `%USERPROFILE%\\.neuro\\qwen-platform\\qwen-coding-plan-openai\\api-key\\*.json`
     - `%USERPROFILE%\\.neuro\\qwen-platform\\qwen-coding-plan-anthropic\\api-key\\*.json`
  3. 当前 provider account 下已存在、且 `maskSecrets=false` 时仍可读到真实 `apiKey` 的 child `gateway_provider_credentials` row
  4. 本地历史导出与静态 routes
     - `.runtime/tmp_provider_accounts.json` 中未脱敏的 Qwen official `payload.apiKey`
     - `gateway/routes.yaml` 中非 `${ENV_VAR}` 占位符的 literal `api_key`
       - 当前支持双引号、单引号或不带引号的 literal 值
       - 当前也会容忍历史 UTF-8 BOM 文件，避免旧 helper 产物因为 BOM 被误判成无效
    - 若 provider row 已存在但 operator listing 中只剩 masked `payload.apiKey`，当前仍会使用新的本地真实 key 来源刷新对应 child credential；masked 值本身不会阻断 refresh
- 其中 `qwen_coding_plan_openai` 与 `qwen_coding_plan_anthropic` 当前默认共享同一份 Coding Plan official key；
    若本 surface 缺少本地缓存/route，live bootstrap 允许回退读取 sibling surface 的同类材料；
    provider account listing 里的 `payload.apiKey` 当前会被脱敏，因此 sibling live provider row 的 inline payload 本身不是当前正式依赖的恢复源；
    但若 sibling account 下已经有未脱敏 child credential row，当前 live bootstrap 允许直接复用它
- 当前 Qwen official live bootstrap 也已对齐真相层：
  - provider account 只承载 surface 级协议语义
  - 实际 official key 当前应收口到 child `gateway_provider_credentials` row
  - 不再把真实 key 长期内联在 provider account `payload.apiKey`
- 当前本地 Qwen suite 使用的 isolated regression lane 还固定为：
  - `http://127.0.0.1:42430`
  - 它是独立的 standalone Rust gateway，不等同于本地预览栈的 `4226`
  - 若宿主机上同时存在其他 standalone `neuro-gateway.exe`，当前必须按：
    - 监听端口
    - `/v1/internal/gateway/provider-accounts` inventory
    区分，而不是只看进程名
- 当前已验证可恢复的 `42430` 启动契约固定为：
  - `PORT=42430`
  - `GATEWAY_RUNTIME_ROLE=standalone`
  - `GATEWAY_MANAGEMENT_TOKEN=local-internal-token`
  - `GATEWAY_API_KEY_SECRET=local-benefit-api-secret`
  - `GATEWAY_DEFAULT_PROJECT_ID=platform-default-project`
  - `GATEWAY_DATABASE_URL=postgres://neuroloom:neuroloom@127.0.0.1:55440/neuroloom`
  - `GATEWAY_REDIS_URL=redis://127.0.0.1:6388`
  - `GATEWAY_PROVIDER_CREDENTIAL_FOLDER_SYNC_ENABLED=false`
  - `GATEWAY_PROVIDER_CREDENTIAL_FOLDER_SYNC_ROOT_DIR=%USERPROFILE%\\.neuro`
  - `cwd = gateway/`
    - 以保证 `routes.yaml` 能按相对路径正常加载
- 当前 `42430` 的 fresh 恢复检查顺序固定为：
  1. 带 `x-management-token: local-internal-token` 调：
     - `GET /v1/internal/gateway/projects/platform-default-project/api-access`
  2. 调：
     - `GET /v1/internal/gateway/provider-accounts`
  3. 使用新下发的 `neuro_*` project key 调：
     - `GET /v1/models`
  4. 确认当前 clean Qwen inventory 至少是：
     - `Qwen Dashscope Openai Profile Fixture`
     - `Qwen Coding Plan Openai Profile Fixture`
     - `Qwen Coding Plan Anthropic Profile Fixture`
     - `Qwen Web Chat Profile Fixture`
     - `Qwen WebUI Replay Live`
     - 且没有残留：
       - `Qwen DashScope Live`
       - `Qwen Coding Plan OpenAI Live`
       - `Qwen Coding Plan Anthropic Live`
- 截至 `2026-05-17`，当前分支还做过一轮 **invalid-key probe**：
  - `qwen_dashscope_live`
  - `qwen_coding_plan_openai_live`
  - `qwen_coding_plan_anthropic_live`
  - 这三条 suite 都已经能够完成本地 bootstrap / provider wiring，并把失败面前移到 upstream auth 层
- 截至 `2026-05-18`，当前又拿到过一条 fresh real-key 证据：
  - `qwen_dashscope_live`
    - 已真实打绿
  - 但同一条 key 对：
    - `qwen_coding_plan_openai_live`
    - `qwen_coding_plan_anthropic_live`
    仍未打绿
  - direct-upstream probe 还明确显示：
    - `https://coding.dashscope.aliyuncs.com/v1/chat/completions`
    - `https://coding.dashscope.aliyuncs.com/apps/anthropic/v1/messages`
    会直接返回：
    - `401 Unauthorized`
    - `invalid_api_key`
- 因此当前对 gateway API/backend lane 的正式结论已经收口为：
  - `服务商不支持`
  - 原因不是本地实现缺口，而是官方文档当前把 Coding Plan 配额限定在交互式 AI 编程工具中，并明确排除
    `curl / Postman / Dify / 自定义应用程序后端 / 非交互式批量 API`
- 截至 `2026-05-18` 的 fresh management-api 检查与同日 `qwen_dashscope_live` rerun 之后，
  当前 `42430` 上：
  - `Qwen DashScope Live`
    - 已经变成：
      - `providerAccount.payload.apiKey = ""`
      - `credentials: [Qwen DashScope Live Key]`
    - 这说明 DashScope official live 已有 fresh runtime 证据证明 child credential truth layer 生效
  - `Qwen Coding Plan OpenAI Live`
  - `Qwen Coding Plan Anthropic Live`
    - 当前仍是：
      - `credentials: []`
      - 在 `2026-05-18` 的 latest-head fail-fast rerun 之后，
        providerAccount `payload.apiKey` 当前也已被 scrub 成 `""`
    - 这不是因为 live bootstrap 不会写 child credential，
      而是 generic `sk-...` key 会先被 Coding Plan upstream preflight 拒绝
- 当前若 latest-head preflight 已明确返回：
  - `401 Unauthorized`
  - `invalid_api_key`
  则 isolated regression lane 中对应 Coding Plan live row 不应继续保留内联 masked `payload.apiKey`
- 所以当前 blocker 也不能再误写成：
  - “也许 dedicated key 藏在 child credential rows 里，只是还没看见”

### 7.1.1 拿到真实 official key 之后的正式收口顺序

若后续 operator 已经拿到真实可用的 Qwen official key，当前推荐的正式收口顺序固定为：

1. 使用 canonical helper 把 key 落盘到 `~/.neuro`
   - 示例：

```powershell
powershell -File deploy/write-qwen-official-credential-files.ps1 `
  -DashscopeApiKey '<real-dashscope-key>' `
  -CodingPlanApiKey '<real-coding-plan-key>' `
  -Force
```

2. 确认当前 `42430` regression lane 仍然可用
   - 带：
     - `x-management-token: local-internal-token`
   - 至少检查：
     - `GET /v1/internal/gateway/projects/platform-default-project/api-access`
     - `GET /v1/internal/gateway/provider-accounts`
     - 用 fresh `neuro_*` key 调：
       - `GET /v1/models`

3. 依次运行三条 official live suite
   - `qwen_dashscope_live`
   - `qwen_coding_plan_openai_live`
   - `qwen_coding_plan_anthropic_live`

当前推荐命令模板：

```powershell
python deploy/test-gateway-protocol-matrix.py --run --suite qwen_dashscope_live --gateway-base-url http://127.0.0.1:42430 --output-dir output/qwen_dashscope_live_<timestamp>
python deploy/test-gateway-protocol-matrix.py --run --suite qwen_coding_plan_openai_live --gateway-base-url http://127.0.0.1:42430 --output-dir output/qwen_coding_plan_openai_live_<timestamp>
python deploy/test-gateway-protocol-matrix.py --run --suite qwen_coding_plan_anthropic_live --gateway-base-url http://127.0.0.1:42430 --output-dir output/qwen_coding_plan_anthropic_live_<timestamp>
```

4. 当前专题允许宣告完成的条件是：
   - `qwen_dashscope_live` 真实打绿
   - `qwen_coding_plan_openai_fixture` 与 `qwen_coding_plan_anthropic_fixture` 已绿
   - `qwen_coding_plan_openai_live` 与 `qwen_coding_plan_anthropic_live` 已保留 latest-head fail-fast / stale-key-scrub 证据
   - 并且官方文档已经把 Coding Plan gateway API/backend lane 明确落到了 `服务商不支持`

补充说明：

- 一个只足以打绿 `qwen_dashscope_live` 的 key，
  当前**不能**被当作：
  - `qwen_coding_plan_openai_live`
  - `qwen_coding_plan_anthropic_live`
  的默认可用 key
- 当前若 Coding Plan upstream direct probe 已明确返回：
  - `401 Unauthorized`
  - `invalid_api_key`
  - 且同日官方文档仍明确把套餐额度限定在交互式 AI 编程工具，并排除
    `curl / Postman / Dify / 自定义应用程序后端 / 非交互式批量 API`
  则对 gateway API/backend lane 应正式归类为：
  - `服务商不支持`
  而不是继续把剩余问题笼统记成：
  - `缺少 Coding Plan-capable official key`

禁止行为：

- 只凭 helper 绿、fixture 绿、compile 绿、transport artifact 完整，就提前宣告 `qwen模块重构` 完成
- 只跑其中一条 official live，就把另外两条视为默认完成
- 用 masked provider row、旧输出目录、历史 probe 结果冒充 fresh live 证据

### 7.2 Web Reverse 线

当前 web reverse 相关 suite：

- fixture
  - `qwen_web_chat_fixture`
  - `qwen_web_chat_full_fixture`
- live
  - `qwen_web_chat_live`
  - `qwen_web_chat_full_live`

截至 `2026-05-17`，当前 fresh live 归档已经是：

- `output/qwen_web_chat_live_20260517_v4`
  - `5 / 5 pass`
- `output/qwen_web_chat_full_live_20260517_v3`
  - `37 / 37 pass`

这两份归档的语义固定为：

- 浏览器只用于 session material 提取
- 请求期执行仍然走 Rust `gateway` 内部的 pure HTTP / browserless replay
- 不允许把浏览器重新引回请求期热路径
- 当前 operator catalog / preset / fixture provider spec 已统一使用：
  - `headers.Accept = application/json`
  - 不再把 Qwen Web control-plane 默认收口成 `text/event-stream`

### 7.3 operator-visible control-plane 回归覆盖

Qwen 当前 operator-facing create catalog 已有根级测试入口覆盖：

- `web/src/app/ops/gateway/providers/provider-create-catalog.test.ts`
- 根级 `npm test`

当前这条测试会显式验证 4 个 canonical Qwen surface：

- `qwen-dashscope-openai`
- `qwen-coding-plan-openai`
- `qwen-coding-plan-anthropic`
- `qwen-web-chat`

并检查它们的：

- `protocolProfile`
- `adapter`
- `sourceKind`
- `defaultExecutionMode`
- `defaultAuthMode`
- `defaultBaseUrl`
- `defaultPayloadPatch`
- Qwen Web 的 `headers.Accept = application/json`
- Qwen Web 的 `sessionAuth`

---

## 8. 当前阶段结论

Qwen Platform 现在应固定按下面语义理解：

1. **只两条正式实现线**
   - `qwen_official_api`
   - `qwen_web_reverse`
2. **official 线共享一份 core**
3. **web reverse 线的 request-time owner 目标是 browserless / pure HTTP**
4. **compile switch 粒度是实现线，不是 surface**
5. **folder sync / operator / regression suite 已与这两条线对齐**

后续如果继续扩 Qwen 非文本能力，或新增新的官方商品面，也必须先回答：

- 它属于哪条实现线
- 是否共享当前 official core
- 是否需要新增新的 canonical surface

而不能再把不同 owner 逻辑堆回单个旧 facade。
