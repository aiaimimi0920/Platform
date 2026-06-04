# Operator 到 Rust Gateway 接口对照表

本文档记录当前 `/ops/gateway/*` operator 页面与 Rust `gateway/` internal API 的正式调用边界。

结论：

- Operator gateway 页面默认由 `web` 直连 Rust gateway internal API。
- Web 侧统一入口是 `web/src/lib/gateway-request.ts`。
- Web 必须配置：
  - `AI_GATEWAY_INTERNAL_URL`
  - `AI_GATEWAY_MANAGEMENT_TOKEN`
- 不再把 `account-api -> packages/ai-gateway-domain gatewayRouter` 作为 `/v1/internal/gateway/*` 的正式主路径。
- `packages/ai-gateway-domain` 中残留的 `gatewayRouter` 仅属于迁移期 legacy HTTP surface，不得继续扩张为长期 runtime owner。

---

## 1. Web 调用入口

| Web 文件 | 角色 | Backend target |
| --- | --- | --- |
| `web/src/lib/gateway-request.ts` | Rust gateway management request helper | `${AI_GATEWAY_INTERNAL_URL}/v1/internal/gateway/*` |
| `web/src/lib/account-client.ts` | Operator/account API facade；gateway 相关函数应委托 `gatewayRequest` | Rust gateway internal API |
| `web/src/app/ops/gateway/**/actions.ts` | Operator server actions | 通过 `account-client.ts` 或 `gatewayRequest.ts` 进入 Rust gateway |

`gatewayRequest.ts` 当前使用 `x-internal-api-key` 传递 `AI_GATEWAY_MANAGEMENT_TOKEN`，并转发 operator 上下文：

- `x-operator-user-id`
- `x-user-id`
- `x-provider-user-id`
- `x-neuro-username`

---

## 2. Operator 页面到 Rust gateway route 对照

| Operator 页面 / 功能 | Web 调用函数 / helper | Rust gateway route |
| --- | --- | --- |
| `/ops/gateway/providers` 服务商列表 | `getOperatorGatewayProviderInventory` | `GET /v1/internal/gateway/provider-inventory` |
| `/ops/gateway/providers/create` 创建服务商 | `createOperatorGatewayProviderAccount` | `POST /v1/internal/gateway/provider-accounts` |
| `/ops/gateway/providers/:providerAccountId` 服务商详情 | `getOperatorGatewayProviderAccount` | `GET /v1/internal/gateway/provider-accounts/:provider_account_id` |
| 更新服务商基础信息 | `updateOperatorGatewayProviderAccount` | `POST /v1/internal/gateway/provider-accounts/:provider_account_id` |
| 删除服务商 | `deleteOperatorGatewayProviderAccount` | `DELETE /v1/internal/gateway/provider-accounts/:provider_account_id` |
| 刷新服务商 quota | `refreshOperatorGatewayProviderQuota` | `POST /v1/internal/gateway/provider-accounts/:provider_account_id/quota` |
| 读取服务商 quota | `getOperatorGatewayProviderQuota` | `GET /v1/internal/gateway/provider-accounts/:provider_account_id/quota` |
| 服务商 model tiering | `getOperatorGatewayProviderModelTiering` | `GET /v1/internal/gateway/provider-accounts/:provider_account_id/model-tiering` |
| 保存服务商 model tiering | `saveGatewayProviderModelTieringAction` | `POST /v1/internal/gateway/provider-accounts/:provider_account_id/model-tiering` |
| 更新模型价格 | `updateOperatorGatewayProviderModelPricing` | `POST /v1/internal/gateway/provider-accounts/:provider_account_id/model-pricing` |
| patch source profile | `patchOperatorGatewayProviderSourceProfile` | `POST /v1/internal/gateway/provider-accounts/:provider_account_id/source-profile` |
| source profile backfill | `backfillOperatorGatewayProviderSourceProfiles` | `POST /v1/internal/gateway/provider-accounts/source-profile/backfill` |
| `/ops/gateway/providers/:providerAccountId/credentials` 凭证列表 | `listOperatorGatewayProviderCredentials` | `GET /v1/internal/gateway/provider-accounts/:provider_account_id/credentials` |
| 创建 provider credential | `createOperatorGatewayProviderCredential` | `POST /v1/internal/gateway/provider-accounts/:provider_account_id/credentials` |
| 更新 provider credential | `updateOperatorGatewayProviderCredential` | `PUT /v1/internal/gateway/provider-credentials/:provider_credential_id` |
| 删除 provider credential | `deleteOperatorGatewayProviderCredential` | `DELETE /v1/internal/gateway/provider-credentials/:provider_credential_id` |
| credential quota refresh | `refreshOperatorGatewayProviderCredentialQuota` | `POST /v1/internal/gateway/provider-credentials/:provider_credential_id/quota` |
| credential folder sync status/import/export | `get/import/exportOperatorGatewayProviderCredentialFolderSyncStatus` | `/v1/internal/gateway/provider-credentials/folder-sync/*` |
| `/ops/gateway/model-associations` model association matrix | `getOperatorGatewayModelAssociations` | `GET /v1/internal/gateway/model-associations` |
| model aliases 列表/创建/更新/删除 | `list/create/update/deleteOperatorGatewayModelAlias` | `/v1/internal/gateway/model-aliases*` |
| `/ops/gateway/access` access catalog | `getOperatorGatewayAccessCatalog` | `GET /v1/internal/gateway/access/catalog` |
| provider capability CRUD | `gatewayRequest` in `access/actions.ts` | `/v1/internal/gateway/access/provider-capabilities*` |
| platform access CRUD | `gatewayRequest` in `access/actions.ts` | `/v1/internal/gateway/access/platform-access*` |
| access bundles / keys / balances / affinity | `gatewayRequest` in `access/actions.ts` | `/v1/internal/gateway/access/*` |
| `/ops/gateway/traces` request audits | `list/getOperatorGatewayRequestAudits` | `/v1/internal/gateway/requests*` |
| request audit summary/artifacts | `getOperatorGatewayRequestAuditSummary`, `getOperatorGatewayRequestArtifacts` | `/v1/internal/gateway/requests/summary`, `/artifacts` |
| `/ops/gateway/conversation-archives` archive list/artifacts/export | `list/get/exportOperatorGatewayConversationArchives` | `/v1/internal/gateway/conversation-archives*` |
| `/ops/gateway/costs` cost overview | `getOperatorGatewayCosts` | `GET /v1/internal/gateway/costs` |
| `/ops/gateway/health` credential-model states | `listOperatorGatewayProviderCredentialModelStates` | `GET /v1/internal/gateway/provider-credential-model-states` |
| `/ops/gateway/health` usage aggregates | `listOperatorGatewayUsageAggregates` | `GET /v1/internal/gateway/usage-aggregates` |

---

## 3. Body shape 注意事项

Rust gateway 的 provider account upsert API 当前接收顶层 source profile 字段：

- `sourceKind`
- `aggregatorApiMode`
- `webReverseAccessMode`
- `sourceNotes`

Web 合同层仍使用 `sourceProfile` 对象表达 operator 输入。`web/src/lib/account-client.ts` 必须在发送给 Rust gateway 前把 `sourceProfile` 展平成上述顶层字段。不得把 `sourceProfile` 原样发送给 `POST /v1/internal/gateway/provider-accounts*`，否则 Rust API 会忽略 source profile。

---

## 4. Local bootstrap helper

本地 helper 默认也必须直连 Rust gateway，而不是 account-api legacy gateway surface：

| Helper | 默认 gateway |
| --- | --- |
| `deploy/bootstrap-local-gateway-provider.ps1` | `http://127.0.0.1:4226` |
| `deploy/bootstrap-local-gateway-fake-provider.ps1` | `http://127.0.0.1:4226` |
| `deploy/bootstrap-local-gateway-kiro-provider.ps1` | `http://127.0.0.1:4226` |
| `deploy/bootstrap-local-gateway-freebuff-provider.ps1` | `http://127.0.0.1:4226` |

这些 helper 应使用 Rust gateway management token：

- header：`x-management-token`
- 默认本地值：`local-internal-token`

部分 helper 仍保留兼容参数 `-AccountApiBaseUrl`，仅用于旧调用命令短期过渡，不代表 account-api 是 gateway management owner。

---

## 5. 不再使用的旧主路径

以下路径不再是 operator gateway 正式主路径：

- `web -> account-api -> packages/ai-gateway-domain gatewayRouter`
- `GET /v1/internal/gateway/catalog` 聚合 catalog legacy surface

若未来确实需要新增 operator gateway API，默认必须优先进入 Rust `gateway/`。只有 migration、schema runner、过渡数据层或纯 client helper 可以继续留在 `packages/ai-gateway-domain`。
