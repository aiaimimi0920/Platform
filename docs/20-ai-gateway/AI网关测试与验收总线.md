# AI 网关测试与验收总线

## 目的

本文档用于把 AI Gateway 当前的测试与验收口径收口成一份新的总线文档。

它优先吸收旧文档中的这些主题：

- 早期协议兼容矩阵中的 suite/surface/line 粒度
- 早期详细测试档案中的 caller-visible 验收口径
- `rules/AI网关多协议兼容测试守则.md`

其中：

- `rules/AI网关多协议兼容测试守则.md`
  仍是仓库级最高规则
- 本文负责把它映射成新的 `docs/` 开发文档口径

---

## 1. 当前正式测试目标

测试的根目标不是：

- “某个 provider 返回过一次内容”

而是：

> 只要调用方指定了一个平台允许的模型，并从平台支持的任意协议入口进入，网关都应尽量自动完成协议归一、路由与转换，并把结果用调用方原始协议家族的形态回给调用方。

因此测试必须覆盖：

1. 入口协议兼容
2. caller-visible 回包语义
3. provider/surface 的真实完成度
4. 失败面是否被正确归类
5. conversation-like 请求是否按用户级存档基线留下可追溯 archive

---

## 2. 当前正式验收粒度

“支持/完成/绿灯”当前必须至少按以下粒度表达：

1. `service provider identity`
2. `implementation line`
3. `provider surface`
4. `protocol profile`
5. `endpoint family / capability family`

禁止再写成：

- “这个服务商整体已支持”

却不拆：

- 官方 API
- web reverse
- browser-owned
- program-owned

---

## 3. 当前正式绿灯分类

### 3.1 完整绿灯

必须同时满足：

1. 代码路径已落地
2. focused case 有证据
3. suite 级归档有证据
4. caller-visible 契约成立
5. 文档与规则已同步

### 3.2 部分绿灯

出现以下情况之一，就必须写成部分绿灯：

- 文本过了，媒体没过
- fixture 过了，live 没过
- browser fallback 过了，pure HTTP 没过
- quota gate accepted，但没有真实 200 资产成功
- provider external gate accepted，但没有真实 200 资产成功
- 某些 endpoint family 尚未覆盖

### 3.3 不得误报

以下情况不得写成完整支持：

- 只有代码，没有归档
- 只有单 case，没有 suite
- 用旧 surface 归档替代新 surface
- browser success 冒充 pure HTTP success
- provider external gate 冒充真实 200 成功

---

## 4. 当前正式实现模式标记

每条能力结果当前都必须同时标注实现模式：

1. `纯协议实现`
2. `混合实现`
3. `浏览器实现`

并补 owner 语义，例如：

- `pure HTTP replay`
- `mixed lane`
- `browser-owned relay`
- `program-owned relay`

这一步不能省略。

---

## 4.1 请求存档与失败归因验收

从 `2026-05-30` 起，任何声称“产品级完成”的 conversation-like provider / implementation line，除原有协议与 live / fixture 证据外，还必须检查：

1. `gateway_request_audits.route_trace` 能看到：
   - selected provider account
   - selected protocol profile
   - selected execution mode
   - failureClass / failureScope（失败场景）
2. `gateway_conversation_archives` 能看到对应用户 / project / provider / model 的 archive row。
3. request / response artifact 中不包含：
   - authorization
   - cookie
   - access token / refresh token
   - api key
   - secret / password
4. archive 写入失败不影响用户请求返回；失败只能反映为 archive row 的 `partial / archive_failed` 和 `archiveError`。
5. 对模型优化用途导出的 NDJSON 只能标记为“待清洗原始归档数据集”，不得直接标记为训练集。

---

## 5. 当前正式万能测试 key 语义

当前测试体系允许存在：

- **测试万能密钥**

它的正式语义是：

- 平台访问层的测试 access key
- 平台侧满额度
- 平台侧全模型、全服务商、全实现线可访问

但它不是：

- provider 真实凭证
- 上游 API key
- 上游 session/cookie

因此它只能证明：

- 平台访问层没有额外拦截

不能自动证明：

- provider quota 足够
- runtime/session 有效
- browser/program owner ready

---

## 6. 当前正式最小编译规则

测试阶段的最小独立编译粒度当前不是：

- 服务商名

而是：

- **服务商下的具体实现线**

例如 `Gemini` 当前至少默认拆成：

1. `official_api`
2. `web_reverse`
3. `canvas_web_reverse`

这条规则的原因是：

- 避免不同实现线互相污染
- 避免多个 AI 共享同一编译产物
- 缩短 focused 回归时间

当前正式补充口径：

- **测试过程只编译当前相关功能即可，不需要为了当前实现线测试额外编译或测试全部服务商。**
当前对已重构完成的实现线，默认允许直接按 cargo feature 做实现线级最小编译，例如：

- `line-gemini-web-reverse`
- `line-gemini-canvas-program`
- `line-aistudio-official`
- `line-aistudio-web-reverse`
- `line-google-agent-platform-official`
- `line-chatgpt-official-api`
- `line-chatgpt-codex-oauth-official`
- `line-chatgpt-web-reverse`
- `line-nvidia-openai-official-vendor-api`
- `line-grok-web-reverse-api`
- `line-qwen-official-api`
- `line-qwen-web-reverse`

默认执行方式：

1. 若当前只在验收 `Gemini official_api / web_reverse / canvas_web_reverse` 中的一条或几条实现线，则默认只做这几条线相关的最小编译与行为验证
2. 若完整 `cargo test`、完整 provider matrix、或其他服务商的并行重构状态会引入无关阻塞，则不应默认把它们提升为当前实现线验收前置条件
3. focused 编译时允许使用：
   - `--no-default-features --features <line-a,...>`
4. 若某条实现线被停编：
   - 当前验收结果不得再把该线记为 active green
   - Rust gateway 对命中该线的请求必须返回明确：
     - `gateway_provider_line_compiled_out`
   - 不得静默回退到其他实现线充当“仍然支持”
5. 对已经进入实现线级 compile switch 的服务商，当前 targeted Rust regression 也应覆盖：
   - line 开启时的正常路径
   - line 关闭时的 compiled-out 路径
6. 当前实现线仍必须补齐：
   - 最小编译通过
   - focused / fixture / live 证据
   - caller-visible 契约成立
7. 只有当任务目标明确提升为“全网关全服务商回归”时，才应扩展到全部服务商统一测试

### 6.1 多 surface 同标签服务商的 suite 运行时约束

若同一服务商会同时暴露多条：

- `protocolProfile`
- `adapter`
- `provider account`

且这些 surface 还可能共享同一 `label`，则 regression suite 运行时不得继续把 suite 模板里的固定 provider UUID 当成唯一真相。

当前已明确适用的典型例子是：

- `xfyun_qwen_http`
- `xfyun_qwen`
- `xfyun_qwen_ws`

对这组 XFYun suite，protocol matrix 当前必须按：

- `serviceProviderKey = xfyun_platform`
- `protocolProfile`
- `adapter`

动态解析 live provider account id，然后再做：

- provider truth sync
- access row / bundle / route policy 构造
- suite case surface id remap

这样做的目的，是避免 main 分支或新的 live inventory 中 provider row 被重新创建后，suite 仍错误绑死到旧 UUID。

当前 repo-level `strict` 也必须继续直接跑：

- `deploy/test_qwen_live_helpers.py`
- `deploy/validate-gateway-line-manifests.py`

作为辅助验证，确保这条 XFYun/Qwen surface-id 动态解析逻辑不会只停留在单次人工回归里。
其中 `validate-gateway-line-manifests.py` 当前还会继续拦：

- provider directory 文档里的失效 markdown 引用
- `docs/20-ai-gateway/**` canonical 文档树中的关键旧专题文件名漂移
- `deploy/` 与 `gateway/scripts/` helper 中重新引入的仓库或同工作区 sibling 绝对路径硬编码
- Gemini Canvas helper 中重新引入的 dated runtime/profile default 路径（如 `host-export-YYYYMMDD`、`manual-live-vendor-YYYYMMDD`、`manual-test-YYYYMMDD`、`live-probe-YYYYMMDD`）

截至 `2026-05-17`，Qwen 当前已经把这条规则显式补到了：

- no-feature
- official-only
- web-only
- dual-line

四种组合；后续类似多 surface / 多 line 服务商，默认也应按同样思路补齐，而不是只跑“feature 打开时正常工作”的一半验证。

当前这一层之外，还必须继续满足：

- 真实 owner 模块树尽量不再进入编译图
- 不是只做 runtime fail-closed

实现线 compile switch 与物理编译隔离的正式规则，统一以下列文档为准：

- `docs/20-ai-gateway/实现线可选编译与物理隔离规范.md`

---

## 7. 当前正式重任务测试规则

本仓库当前还新增了一条测试协作边界：

- 多个 AI 并行开发时，同一时刻默认只允许一个 `heavy_active`

它的正式落点是：

- `rules/多AI重任务声明与轮询守则.md`
- `deploy/claim-heavy-task.ps1`
- `deploy/release-heavy-task.ps1`
- `deploy/show-heavy-task-status.ps1`
- `deploy/wait-heavy-task-available.ps1`
- `deploy/invoke-heavy-task.ps1`

这意味着：

- full suite
- live suite
- browser live
- preview rebuild
- provider probe

这类高负载验证当前都应 honor 重任务令牌，而不是多个 AI 同时硬跑。

---

## 8. 当前正式结果表要求

后续任何 provider/surface 若声称自己“已完成”，结果表至少应包含：

| Provider | Implementation Line | Surface | Capability | Status | Execution Mode | Owner | Provider Support | Evidence | Notes |
|----------|---------------------|---------|------------|--------|----------------|-------|------------------|----------|-------|

若还涉及凭证建模，还应补：

| Credential Material Kind | Has Subpool | Subpool Dimension | Shared Material Key |

---

## 9. 当前正式旧测试文档定位

旧测试矩阵材料现在这样理解：

- 早期协议兼容矩阵与详细测试档案
  - 仍是 source material
- `rules/AI网关多协议兼容测试守则.md`
  - 仍是最高规则
- 本文
  - 是 `docs/` 下新的总线说明

若它们冲突：

1. `rules/` 优先
2. 再以 `docs/` 为准
3. 旧 `docs/` 退为参考层

---

## 10. Qwen 当前专项测试口径

Qwen 当前正式只按两条实现线测试：

1. `qwen_official_api`
2. `qwen_web_reverse`

### 10.1 official 线

当前 official 线 canonical suite：

- fixture
  - `qwen_dashscope_openai_fixture`
  - `qwen_coding_plan_openai_fixture`
  - `qwen_coding_plan_anthropic_fixture`
- live
  - `qwen_dashscope_live`
  - `qwen_coding_plan_openai_live`
  - `qwen_coding_plan_anthropic_live`

当前在本地做 Qwen focused fixture/live 时，还固定存在一条独立 regression lane：

- `http://127.0.0.1:42430`

它的正式语义是：

- standalone Rust gateway
- 与本地预览网关 `4226` 分离
- 用于 Qwen suite 的本地 isolated 回归，不拿现有 preview/runtime 实例冒充

当前诊断顺序固定为：

1. 先看 `42430` 是否真的监听
2. 再看：
   - `/v1/internal/gateway/projects/platform-default-project/api-access`
   - `/v1/internal/gateway/provider-accounts`
3. 再用 fresh `neuro_*` project key 验证：
   - `/v1/models`
4. 若宿主机上同时存在其他 standalone `neuro-gateway.exe`，按：
   - 端口
   - provider inventory
   区分；不要只按进程名判断

Qwen regression lane 的详细启动契约，统一以下列专题文档为准：

- `docs/20-ai-gateway/Qwen平台实现线、可选编译与物理隔离基线.md`

### 10.2 web reverse 线

当前 web reverse canonical suite：

- fixture
  - `qwen_web_chat_fixture`
  - `qwen_web_chat_full_fixture`
- live
  - `qwen_web_chat_live`
  - `qwen_web_chat_full_live`

Qwen Web 当前正式测试边界固定为：

- 浏览器允许参与 session material 提取
- 但 suite 验收结论必须仍按：
  - `request-time browserless / pure HTTP`
  理解

截至 `2026-05-17`，当前 fresh web reverse live 归档已经是：

- `output/qwen_web_chat_live_20260517_v4`
  - `5 / 5 pass`
- `output/qwen_web_chat_full_live_20260517_v3`
  - `37 / 37 pass`

当前 fresh web reverse fixture 归档已经是：

- `output/qwen_web_chat_fixture_20260517_v3`
  - `5 / 5 pass`
- `output/qwen_web_chat_full_fixture_20260517_v2`
  - `37 / 37 pass`

当前 official fixture 归档已经是：

- `output/qwen_dashscope_openai_fixture_20260517_v1`
  - `4 / 4 pass`
- `output/qwen_coding_plan_openai_fixture_20260517_v1`
  - `4 / 4 pass`
- `output/qwen_coding_plan_anthropic_fixture_20260517_v1`
  - `2 / 2 pass`

因此当前 Qwen Web 的 caller-visible 绿灯语义是：

- **browserless live 已打绿**
- 不是 browser-owned 热路径冒充成功
- 当前 supported official backend surface 里，`qwen_dashscope_live` 已闭环
- `qwen_coding_plan_openai_live` 与 `qwen_coding_plan_anthropic_live`
  当前不再作为必须打绿的 backend completion gate；
  截至 `2026-05-18` 的官方文档已明确把 Coding Plan 配额限定在交互式 AI 编程工具中，
  并排除 `curl / Postman / Dify / 自定义应用程序后端 / 非交互式批量 API` 场景，
  因此对 AI gateway API/backend lane 应按 `服务商不支持` 记录
- 同时，当前分支已经做过 invalid-key probe，确认：
  - 三条 official live suite 都不再卡在本地 bootstrap / provider wiring
  - Coding Plan 两条 live probe 的失败面已经前移到 upstream auth / invalid key 层
  - 结合官方文档，这两条 backend lane 当前应归类为 `服务商不支持`

---

## 10. 当前正式结论

后续一切“网关是否完成”的说法，默认都必须同时回答四件事：

1. 具体是哪个 provider / implementation line / surface
2. 现在是完整绿灯还是部分绿灯
3. 它是纯协议、混合，还是浏览器实现
4. 证据归档在哪里

不再允许只给一句抽象总结。

---

## 10A. Provider External Gate Accepted

当前测试总线允许一类单独结论：

- `provider external gate accepted`

它的正式语义是：

1. 网关已经把真实请求送达官方 upstream
2. caller-visible 协议契约、路由与必要签名/运行时 owner 已成立
3. 剩余失败面来自 provider 账号开通、allowlisting、法务/政策审核、企业白名单等外部门槛

这类结果当前不得误写成：

- `网关未实现`
- `真实 200 成功`

但允许在结果表中记成：

- `部分绿灯`
- `provider external gate accepted`

---

## 11. 当前已落地的统一验证入口

截至 `2026-05-18`，AI Gateway 当前正式已经落地统一实现线验证入口：

- `deploy/verify-gateway-line.ps1`

这条 helper 当前直接读取：

- `gateway/manifests/lines/**`

并从 manifest 中拿到：

- `lineFeature`
- `familyCommonFeatures`
- `recommendedCargoTargetDirSlug`
- `focusedCargoFilters`
- `fixtureSuiteId`
- `liveSuiteId`

也就是说，当前 helper 已不再要求“每个平台单独再维护一份命令真相层”。

当前已保留兼容 wrapper 的旧入口示例：

- `deploy/verify-chatgpt-lines.ps1`

但其正式语义已收窄为：

- 只负责把 `official_api / codex_backend / web_reverse`
  映射到统一 line manifest id
- 不再单独维护自己的 cargo filter / suite id / target dir 事实

当前正式 helper 口径：

1. 默认读取 manifest
2. 默认走 line-level focused cargo verification
3. 默认可选择追加 fixture / live suite
4. 默认允许 `--no-default-features --features <line,...>` 的 compile smoke

因此后续若再新增实现线验证入口，默认应优先补 manifest，而不是再复制一份新的 provider-specific 验证脚本。
