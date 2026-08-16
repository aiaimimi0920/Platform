# contracts ai-gateway 拆分结构

`packages/contracts/src/ai-gateway.ts`（原 3,708 行、351 个公共导出）已按领域拆分为 `packages/contracts/src/ai-gateway/` 下的 13 个子模块。`ai-gateway.ts` 保留为 15 行薄 facade，原样 `export *` 全部公共符号。包入口 `src/index.ts` 仍是 `export * from "./ai-gateway"`，外部导入方（含同包 `benefits.ts` 的 `from "./ai-gateway"`）无需任何改动。

本次为纯结构性搬移：类型、常量与 `buildGatewayProviderRoutingScore` 整块移动，未改变任何形状、导出名或运行时行为。原文件不含 zod schema。跨子模块只使用 `import type`，避免 CommonJS 循环加载初始化问题。

## 子模块职责

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `shared.ts` | 4 | 跨域共用的 `GatewaySummaryBucket` |
| `identity.ts` | 95 | tenant / project / API key / access key 状态常量、来源 kind、以及 tenant/project/apiKey/benefit-ensure view |
| `provider.ts` | 925 | 服务商 adapter / protocol / source profile、session-backed runtime、各协议 payload、credential / capability / quota / 文件夹同步与相关 upsert |
| `routing.ts` | 343 | 请求状态、route policy、限流定义、route trace、routing score（含 `buildGatewayProviderRoutingScore`）、model alias |
| `access.ts` | 217 | platform access / bundle / access key view、catalog，以及 access upsert / preview |
| `browser.ts` | 110 | browser executor 节点、能力槽、lease 与健康 view |
| `sessions.ts` | 152 | session / request audit / artifact view、审计概要、session detail |
| `archive.ts` | 157 | 对话归档、provider 失败归因、credential-model 健康、usage 聚合、dataset export |
| `prompt-cache.ts` | 45 | prompt cache 指标、summary 与 trend |
| `analysis.ts` | 412 | 分析样本 / summary、analysis export 与 export anomaly 报表 |
| `anomaly.ts` | 700 | 异常策略 / incident / remediation / effectiveness / alert / sync |
| `operator-catalog.ts` | 450 | operator catalog、provider health / inventory / 成本 / 模型关联矩阵 / runtime pressure |
| `rate-limit-hotspots.ts` | 234 | 限流热点 summary / trend / anomaly / snapshot |
| `ai-gateway.ts`（facade） | 15 | 只含 re-export，不得再堆契约声明 |

## 约束

- 公共 API 仍只经由 `src/ai-gateway.ts` facade 与包入口 `src/index.ts` 暴露；不要让外部直接依赖 `./ai-gateway/<submodule>` 作为稳定导入面。
- 后续新增 AI gateway 契约应落到对应子模块，而不是把类型堆回 facade。
- `session-backed` keepalive / runtime 字段与 provider payload 同文件，是为了避免 `provider` ↔ `sessions` 的类型循环；session / audit **view** 仍在 `sessions.ts`。
- 不要把本次拆分理解成恢复 TypeScript 网关 owner 地位；Rust `gateway/` 仍是正式 AI 网关 owner，`packages/contracts` 只提供共享类型。
