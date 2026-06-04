# AI Gateway 文档主入口

本目录是 `docs/` 下 AI Gateway 的正式文档子树。

它的职责不是替代所有旧专题文档，而是提供一套新的、稳定的、按 owner 分层的 canonical 主线。

---

## 当前阅读顺序

建议按下面顺序阅读：

1. [AI网关总基线.md](./AI网关总基线.md)
2. [AI网关协议与路由总线.md](./AI网关协议与路由总线.md)
3. [AI网关运行时与会话总线.md](./AI网关运行时与会话总线.md)
4. [AI网关服务商建模与凭证体系.md](./AI网关服务商建模与凭证体系.md)
5. [统一AccessKey与客户端接入基线.md](./统一AccessKey与客户端接入基线.md)
6. [平台AccessKey与真实Provider双层凭证架构.md](./平台AccessKey与真实Provider双层凭证架构.md)
7. [用户凭证颁发系统基线.md](./用户凭证颁发系统基线.md)
8. [Provider凭证管理API基线.md](./Provider凭证管理API基线.md)
9. [单行凭证生命周期与文件夹同步基线.md](./单行凭证生命周期与文件夹同步基线.md)
10. [模型市场价与成本治理基线.md](./模型市场价与成本治理基线.md)
11. [服务商实现线与Provider目录.md](./服务商实现线与Provider目录.md)
12. [AI网关平台、实现线、Surface与能力总表.md](./AI网关平台、实现线、Surface与能力总表.md)
13. [实现线最小凭证样例与字段说明基线.md](./实现线最小凭证样例与字段说明基线.md)
14. [AI网关外部凭证采集与实现线协作指南.md](./AI网关外部凭证采集与实现线协作指南.md)
15. [Operator到RustGateway接口对照表.md](./Operator到RustGateway接口对照表.md)
16. [Gemini三线路与Canvas派生运行时架构规范.md](./Gemini三线路与Canvas派生运行时架构规范.md)
17. [Gemini凭证、Bootstrap配置与派生运行时字段分层表.md](./Gemini凭证、Bootstrap配置与派生运行时字段分层表.md)
18. [Gemini三线路正式验收结果-2026-05-15.md](./Gemini三线路正式验收结果-2026-05-15.md)
19. [ChatGPT官方API与WebReverse双线路基线.md](./ChatGPT官方API与WebReverse双线路基线.md)
20. [ChatGPT三条实现线fixture验证结果-2026-05-17.md](./ChatGPT三条实现线fixture验证结果-2026-05-17.md)
21. [ChatGPT基于EasyRegister failed-twice原始凭证的live导入验证结果-2026-05-17.md](./ChatGPT基于EasyRegister%20failed-twice原始凭证的live导入验证结果-2026-05-17.md)
22. [ChatGPT Web Reverse手动浏览器凭证live验证结果-2026-05-17.md](./ChatGPT%20Web%20Reverse手动浏览器凭证live验证结果-2026-05-17.md)
23. [ChatGPT Web Reverse OAuth刷新材料审计-2026-05-30.md](./ChatGPT%20Web%20Reverse%20OAuth刷新材料审计-2026-05-30.md)
24. [ChatGPT Web Reverse给EasyRegister的refreshToken采集改造要求-2026-05-30.md](./ChatGPT%20Web%20Reverse给EasyRegister的refreshToken采集改造要求-2026-05-30.md)
25. [Qwen平台实现线、可选编译与物理隔离基线.md](./Qwen平台实现线、可选编译与物理隔离基线.md)
26. [Qwen平台凭证模板与字段说明.md](./Qwen平台凭证模板与字段说明.md)
27. [AIStudio Web Reverse基线.md](./AIStudio%20Web%20Reverse基线.md)
28. [ChatAIBot图片实现线基线.md](./ChatAIBot图片实现线基线.md)
29. [ChatAIBot图片实现线fixture与live验收结果-2026-05-17.md](./ChatAIBot图片实现线fixture与live验收结果-2026-05-17.md)
30. [Azure OpenAI平台实现线、可选编译与物理隔离基线.md](./Azure%20OpenAI平台实现线、可选编译与物理隔离基线.md)
31. [Anthropic Messages平台实现线、可选编译与物理隔离基线.md](./Anthropic%20Messages平台实现线、可选编译与物理隔离基线.md)
32. [AWS Bedrock Converse平台实现线、可选编译与物理隔离基线.md](./AWS%20Bedrock%20Converse平台实现线、可选编译与物理隔离基线.md)
33. [Cohere Chat平台实现线、可选编译与物理隔离基线.md](./Cohere%20Chat平台实现线、可选编译与物理隔离基线.md)
34. [Azure OpenAI、Anthropic Messages、AWS Bedrock Converse、Cohere Chat fixture与live验收进展-2026-05-19.md](./Azure%20OpenAI、Anthropic%20Messages、AWS%20Bedrock%20Converse、Cohere%20Chat%20fixture与live验收进展-2026-05-19.md)
35. [Producer.ai Session与媒体工作流基线.md](./Producer.ai%20Session与媒体工作流基线.md)
36. [AI网关测试与验收总线.md](./AI网关测试与验收总线.md)
37. [Perplexity Search平台实现线、可选编译与物理隔离基线.md](./Perplexity%20Search平台实现线、可选编译与物理隔离基线.md)
38. [Tavily Search平台实现线、可选编译与物理隔离基线.md](./Tavily%20Search平台实现线、可选编译与物理隔离基线.md)
39. [Exa Search平台实现线、可选编译与物理隔离基线.md](./Exa%20Search平台实现线、可选编译与物理隔离基线.md)
40. [Jina Search平台实现线、可选编译与物理隔离基线.md](./Jina%20Search平台实现线、可选编译与物理隔离基线.md)
41. [Jina Reader平台实现线、可选编译与物理隔离基线.md](./Jina%20Reader平台实现线、可选编译与物理隔离基线.md)
42. [Linkup Search平台实现线、可选编译与物理隔离基线.md](./Linkup%20Search平台实现线、可选编译与物理隔离基线.md)
43. [You.com Search平台实现线、可选编译与物理隔离基线.md](./You.com%20Search平台实现线、可选编译与物理隔离基线.md)
44. [WebSearchAPI Search平台实现线、可选编译与物理隔离基线.md](./WebSearchAPI%20Search平台实现线、可选编译与物理隔离基线.md)
45. [Suno平台实现线、可选编译与物理隔离基线.md](./Suno平台实现线、可选编译与物理隔离基线.md)
46. [Udio Platform实现线、可选编译与物理隔离基线.md](./Udio%20Platform实现线、可选编译与物理隔离基线.md)
47. [LumaLabs平台实现线、可选编译与物理隔离基线.md](./LumaLabs平台实现线、可选编译与物理隔离基线.md)
48. [xAI OpenAI-compatible平台实现线、可选编译与物理隔离基线.md](./xAI%20OpenAI-compatible平台实现线、可选编译与物理隔离基线.md)
49. [Perplexity Chat平台实现线、可选编译与物理隔离基线.md](./Perplexity%20Chat平台实现线、可选编译与物理隔离基线.md)
50. [XFYun OpenAI-compatible平台实现线、可选编译与物理隔离基线.md](./XFYun%20OpenAI-compatible平台实现线、可选编译与物理隔离基线.md)
51. [XFYun Native WebSocket平台实现线、可选编译与物理隔离基线.md](./XFYun%20Native%20WebSocket平台实现线、可选编译与物理隔离基线.md)
52. [Producer.ai平台实现线、可选编译与物理隔离基线.md](./Producer.ai平台实现线、可选编译与物理隔离基线.md)
53. [Kiro-compatible平台实现线、可选编译与物理隔离基线.md](./Kiro-compatible平台实现线、可选编译与物理隔离基线.md)

---

## 当前目录职责

### `AI网关总基线.md`

回答：

- Rust gateway 是谁
- AI gateway 当前应如何总体理解
- 哪些旧文档是 source material，哪些不是

### `AI网关协议与路由总线.md`

回答：

- ingress -> canonical -> route -> bridge -> transport 的正式请求主链
- protocol family / profile / implementation line / execution mode 的边界

### `AI网关运行时与会话总线.md`

回答：

- access key、provider credential、runtime session material、browser capability 之间的边界
- keepalive、runtime patch、provider quota 的正式理解

### `AI网关服务商建模与凭证体系.md`

回答：

- 服务商、实现线、surface、credential material、二级分类、共享材料的正式建模

### `统一AccessKey与客户端接入基线.md`

回答：

- AccessKey 与 provider credential 的正式关系
- 客户端兼容接入当前如何判断

### `平台AccessKey与真实Provider双层凭证架构.md`

回答：

- 平台访问层与真实 provider 层如何分离
- 双层凭证架构的上位理解

### `用户凭证颁发系统基线.md`

回答：

- 用户购买/获得访问资格后，平台访问凭证如何颁发

### `Provider凭证管理API基线.md`

回答：

- 单条真实 provider credential 的管理 API 语义

### `单行凭证生命周期与文件夹同步基线.md`

回答：

- 单条真实 provider credential 的真相层
- provider account 与 provider credential 的正式边界

### `模型市场价与成本治理基线.md`

回答：

- 模型价格来源
- 平台售价与近期样本窗口如何并存

### `AI网关测试与验收总线.md`

回答：

- 什么叫完整绿灯
- 什么叫部分绿灯
- 什么叫纯协议/混合/浏览器实现
- 测试万能密钥与按实现线最小编译如何理解

### `服务商实现线与Provider目录.md`

回答：

- 当前有哪些高优先级服务商
- 每家服务商有哪些实现线
- 哪些 provider baseline 已经被新的目录文档接住

### `AI网关平台、实现线、Surface与能力总表.md`

回答：

- 当前系统里到底有哪些平台
- 每个平台有哪些主要实现线与 operator 可见 surface
- 哪些线已通过、哪些只是部分覆盖、哪些仍待专题化

### `实现线最小凭证样例与字段说明基线.md`

回答：

- 每条实现线最少应交付哪些凭证文档文件
- 最小可调用凭证样例文件应该长什么样
- 字段解释与采集说明文件应该写哪些内容

### `AI网关外部凭证采集与实现线协作指南.md`

回答：

- 外部采集程序应如何从 `gateway/manifests/lines/**/*.json` 发现所有实现线
- 每条实现线的 `samplePath / fieldsDocPath / buildDocPath` 应如何读取
- raw credential JSON 应如何生成并写入 canonical `~/.neuro` folder-sync 目录
- 外部程序需要遵守哪些 fail-closed、安全脱敏和状态误报防线
- 当前 41 条 manifest 的凭证样例、字段说明和生成说明的完整索引

### `Operator到RustGateway接口对照表.md`

回答：

- `/ops/gateway/*` operator 页面当前调用哪些 Rust gateway internal routes
- Web 直连 Rust gateway 时需要哪些环境变量和 header
- `packages/ai-gateway-domain gatewayRouter` 只能作为迁移期 legacy surface 的边界

### `Gemini三线路与Canvas派生运行时架构规范.md`

回答：

- Gemini `official_api / web_reverse / canvas_web_reverse` 三条线如何严格区分
- 什么叫 Gemini 的 `source credential`
- 什么叫 Canvas program 的 `derived runtime credential`
- 为什么第三条线允许复用第二条线认证底座，但 steady-state 不允许退回聊天框 owner
- 第三条线失活后如何从同源第二条线凭证自动重建

### `Gemini凭证、Bootstrap配置与派生运行时字段分层表.md`

回答：

- `__Secure-1PSID / cookieHeader / runtimeStateObjectKey` 到底属于哪一层
- `shareId/shareUrl` 为什么更应该属于 bootstrap 配置而不是用户凭证
- 哪些字段是第三条线真正会失活、需要重建的派生运行时材料

### `Gemini三线路正式验收结果-2026-05-15.md`

回答：

- Gemini 三条线截至 `2026-05-15` 的正式验收结果
- 哪些线是本轮 fresh rerun
- 哪些线仍沿用既有 strict-green baseline
- line2 `legacy media` 为什么当前可以正式按 `6/6` 理解

### `Qwen平台实现线、可选编译与物理隔离基线.md`

回答：

- Qwen 当前为什么正式只按两条实现线理解
- official 三 surface 为什么共享一份 official core
- web reverse 为什么必须保持 browserless request-time owner
- `line-qwen-official-api / line-qwen-web-reverse` 的 compile switch 与物理隔离边界

### `Qwen平台凭证模板与字段说明.md`

回答：

- Qwen official 三个 surface 的 provider account / single-row credential 模板
- Qwen Web reverse 的 canonical normalized session-auth 模板
- 哪些字段属于 operator 应提供、导入器自动派生、还是 runtime 刷新材料
- 仓库内可直接拷贝的 example JSON 模板文件在哪里
- 若已经拿到真实 key，如何用 `deploy/write-qwen-official-credential-files.ps1` 落盘到 canonical `~/.neuro` 目录
- 拿到真实 Qwen official key 后，如何按正式顺序：
  - 检查 `42430`
  - 依次跑：
    - `qwen_dashscope_live`
    - `qwen_coding_plan_openai_live`
    - `qwen_coding_plan_anthropic_live`
- 该 helper 当前输出的 canonical 文件契约：
  - UTF-8 无 BOM
  - 单行 JSON
  - 无末尾换行

### `AI网关服务商建模与凭证体系.md`

回答：

- 实现线 manifest 真相层当前放在哪里
- schema / validator / line manifest 的正式路径
- 当前哪批 implementation line 已经接入 manifest

### `AI网关测试与验收总线.md`

回答：

- 当前统一 focused 验证 helper 是什么
- 它如何从 manifest 读取 cargo / fixture / live 入口
- 旧 `verify-chatgpt-lines.ps1` 为什么现在只是兼容 wrapper

### `实现线可选编译与物理隔离规范.md`

回答：

- 当前哪些 line feature 已经进入物理隔离主线
- 第一波共享 family/common 代码层在哪里
- 共享模板层如何通过 `family-*` feature 进入或退出二进制

### `AIStudio Web Reverse基线.md`

回答：

- AIStudio Web Reverse 当前的 provider 专题边界
- 当前 browser-owned / executor-owned 语义
- 当前已完成能力与未完成媒体波次
- 当前 `/v1/audio/speech` 与 `/v1/images/generations` 的 `cloudApiKey direct-http fast path` 边界

### `ChatAIBot图片实现线基线.md`

回答：

- ChatAIBot 当前为什么只按图片线理解
- 当前唯一正式实现线是什么
- 当前 owner、凭证、folder sync、operator 默认值和可选编译语义是什么

### `ChatAIBot图片实现线fixture与live验收结果-2026-05-17.md`

回答：

- ChatAIBot 图片线截至 `2026-05-17` 的 fixture / live 正式结果
- 生成与 edit/merge 的 acceptance boundary
- 本轮真实修掉的 runtime 问题是什么

### `Producer.ai Session与媒体工作流基线.md`

回答：

- Producer.ai 当前 session-backed / conversation-first 媒体工作流语义

### `Suno平台实现线、可选编译与物理隔离基线.md`

回答：

- Suno 当前 `web_reverse_api` 实现线身份
- `suno_images / suno_music / suno_videos` 三个 media family 如何归属同一平台线
- 为什么正式 send path 是 `browser_backed`
- `suno_http_live` 为什么只是 direct HTTP probe

### `Udio Platform实现线、可选编译与物理隔离基线.md`

回答：

- Udio Platform 当前 `web_reverse_api` 实现线身份
- Udio cover art / music / video export 如何共享 browser-backed generate-proxy + songs contract
- cookie / runtimeStateObjectKey / hCaptcha runtime 条件如何记账

### `LumaLabs平台实现线、可选编译与物理隔离基线.md`

回答：

- LumaLabs 当前 `web_reverse_api` 实现线身份
- `lumalabs_images / lumalabs_videos / lumalabs_audio` 三个 surface 如何共享 `wos-session + realmId`
- quota / rate-limit 与 live contract 成功命中的验收边界

### `xAI OpenAI-compatible平台实现线、可选编译与物理隔离基线.md`

回答：

- xAI official OpenAI-compatible 线的 `xai` profile、manifest、feature 与 credential folder sync 边界
- 它为什么不等于 `Grok Web Reverse`

### `Perplexity Chat平台实现线、可选编译与物理隔离基线.md`

回答：

- Perplexity Chat official-vendor 线如何与 Perplexity Search 分开
- `perplexity-chat` 的 OpenAI-compatible profile、manifest、feature 与凭证目录

### `XFYun OpenAI-compatible平台实现线、可选编译与物理隔离基线.md`

回答：

- XFYun HTTP OpenAI-compatible 线的 `xfyun_openai` profile 与可选编译
- 它与 native websocket 线的物理隔离边界

### `XFYun Native WebSocket平台实现线、可选编译与物理隔离基线.md`

回答：

- XFYun native websocket 线的 `APPID + APIKey + APISecret` 签名材料边界
- `xfyun_native_websocket` 为什么不能被 `xfyun_openai` 替代

### `Producer.ai平台实现线、可选编译与物理隔离基线.md`

回答：

- Producer.ai 当前 `web_reverse_api` 实现线身份
- `producer_images / producer_music / producer_videos` 三个 surface 如何共享 session-backed media workflow
- 为什么当前 canonical upstream base URL 以 `https://www.flowmusic.app` 为准

### `Kiro-compatible平台实现线、可选编译与物理隔离基线.md`

回答：

- Kiro-compatible 的 `kiro_compatible` adapter、bearer runtime material 与可选编译
- 它为什么不是 generic OpenAI-compatible provider

## 当前边界

当前本目录已经开始接管 AI Gateway 的正式开发主线。

因此从现在开始：

- 新的网关总线结论优先写入本目录
- legacy AI Gateway docs tree 默认退为参考层
- 若出现冲突：
  - **以 `docs/20-ai-gateway/` 为准**
