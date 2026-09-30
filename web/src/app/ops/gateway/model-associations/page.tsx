import { auth } from "@/auth";
import { GatewayDependencyUnavailableCard } from "@/components/gateway-dependency-unavailable-card";
import { NtBadge, NtCard, NtInput, NtPanel } from "@/components/nt-primitives";
import type { NtBadgeTone } from "@/components/nt-primitives";
import {
  getOperatorGatewayModelAssociations,
  listOperatorGatewayModelAliases,
} from "@/lib/account-client";
import type {
  GatewayModelAliasView,
  GatewayModelAssociationMatrixView,
} from "@/lib/account-client";
import { buildGatewayDependencyUnavailableNotice } from "@/lib/gateway-catalog-notice";
import {
  isPlatformOperatorUserId,
  requirePlatformOperatorUserContext,
} from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import {
  createGlobalGatewayModelAliasAction,
  deleteGatewayModelAliasesAction,
  saveGatewayModelAliasAction,
} from "./actions";

type ModelAliasesPageProps = {
  searchParams?: Promise<{
    view?: string;
    section?: string;
    alias?: string;
    provider?: string;
    create?: string;
    status?: string;
    message?: string;
  }>;
};

type ProviderRowView = GatewayModelAssociationMatrixView["providerRows"][number];
type GatewayModelAliasScopeType = GatewayModelAliasView["scopeType"];

const SECTION_OPTIONS = [
  { key: "global", label: "全局模型别名" },
  { key: "provider", label: "服务商模型别名" },
] as const;

const SOURCE_KIND_LABELS: Record<string, string> = {
  official_model_api: "官方单模型 API",
  official_vendor_api: "官方厂商 API",
  aggregator_api: "聚合 API",
  web_reverse_api: "Web 转 API",
};

const PROVIDER_STATUS_LABELS: Record<string, string> = {
  active: "可用",
  disabled: "停用",
  archived: "归档",
};

/*
 * Layout and color now run through the shared `nt-` utility layer, so these constants hold
 * only what the vocabulary has no class for: the alias card's align-content, the page gap that
 * sits between the 16px and 24px steps, and the two status surfaces. Keeping them at module
 * scope means one allocation per process instead of one per render.
 */
const PAGE_STACK_STYLE: CSSProperties = { gap: 20 };

const PAGE_LEAD_STYLE: CSSProperties = { maxWidth: 980 };

const BASELINE_HEADER_ROW_STYLE: CSSProperties = { alignItems: "baseline" };

const PROVIDER_META_STYLE: CSSProperties = { margin: "4px 0 0" };

const CARD_NOTE_STYLE: CSSProperties = { margin: "6px 0 0" };

const STATUS_CARD_SUCCESS_STYLE: CSSProperties = {
  borderColor: "var(--neuro-signal-green)",
  background: "var(--neuro-control)",
};

const STATUS_CARD_ERROR_STYLE: CSSProperties = {
  borderColor: "var(--neuro-danger-red)",
  background: "var(--neuro-control)",
};

const MODEL_ALIAS_CARD_STYLE: CSSProperties = {
  alignContent: "start",
};

const MODEL_ALIAS_CREATE_CARD_STYLE: CSSProperties = {
  ...MODEL_ALIAS_CARD_STYLE,
  padding: 16,
};

const SOURCE_KIND_TONES: Record<string, NtBadgeTone> = {
  official_model_api: "success",
  official_vendor_api: "success",
  aggregator_api: "cyan",
  web_reverse_api: "warning",
};

function resolveSourceTone(sourceKind: string): NtBadgeTone {
  return SOURCE_KIND_TONES[sourceKind] ?? "secondary";
}

function resolveProviderStatusTone(status: string): NtBadgeTone {
  if (status === "active") return "success";
  if (status === "disabled") return "warning";
  return "secondary";
}

function resolveStatusTone(status: string | null): NtBadgeTone {
  if (status === "success") return "success";
  if (status === "error") return "danger";
  return "secondary";
}

function buildPageHref(input: {
  section: "global" | "provider";
  alias?: string | null;
  provider?: string | null;
  create?: "global" | "special" | null;
}) {
  const params = new URLSearchParams();
  params.set("section", input.section);
  if (input.alias) params.set("alias", input.alias);
  if (input.provider) params.set("provider", input.provider);
  if (input.create) params.set("create", input.create);
  const query = params.toString();
  return query ? `/ops/gateway/model-associations?${query}` : "/ops/gateway/model-associations";
}

function buildAliasProviderKey(
  alias: string,
  providerAccountId: string,
  scopeType: GatewayModelAliasScopeType,
  projectId: string | null = null,
) {
  return `${projectId ?? "__platform__"}::${scopeType}::${alias}::${providerAccountId}`;
}

function getPrimaryAliasRecord(
  aliasRecordMap: Map<string, GatewayModelAliasView[]>,
  alias: string,
  providerAccountId: string,
  scopeType: GatewayModelAliasScopeType,
  projectId: string | null = null,
) {
  const records = aliasRecordMap.get(buildAliasProviderKey(alias, providerAccountId, scopeType, projectId)) ?? [];
  return { record: records[0] ?? null, duplicateCount: records.length };
}

function getAliasRecordIds(
  aliasRecordMap: Map<string, GatewayModelAliasView[]>,
  alias: string,
  providerAccountId: string,
  scopeType: GatewayModelAliasScopeType,
  projectId: string | null = null,
) {
  return (aliasRecordMap.get(buildAliasProviderKey(alias, providerAccountId, scopeType, projectId)) ?? []).map(
    (record) => record.id,
  );
}

function renderProviderHeader(provider: ProviderRowView) {
  return (
    <div className="nt-stack nt-gap-2">
      <div className="nt-flex nt-wrap nt-gap-2">
        <NtBadge tone={resolveProviderStatusTone(provider.status)}>
          {PROVIDER_STATUS_LABELS[provider.status] ?? provider.status}
        </NtBadge>
        <NtBadge tone={resolveSourceTone(provider.sourceProfile.sourceKind)}>
          {SOURCE_KIND_LABELS[provider.sourceProfile.sourceKind] ?? provider.sourceProfile.sourceKind}
        </NtBadge>
        <NtBadge tone="glass">{provider.protocolFamily}</NtBadge>
      </div>
      <div>
        <h3 className="nt-flush nt-text-strong">{provider.label}</h3>
        <p className="nt-text-muted" style={PROVIDER_META_STYLE}>
          默认模型：<strong className="nt-text-strong">{provider.defaultModel ?? "未声明"}</strong>
        </p>
      </div>
    </div>
  );
}

export default async function GatewayModelAliasesPage({ searchParams }: ModelAliasesPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问 AI 网关模型别名。")}`);
  }

  const params = searchParams ? await searchParams : undefined;
  const activeSection =
    params?.section === "provider" || params?.view === "provider" ? "provider" : "global";
  const createMode = params?.create === "global" || params?.create === "special" ? params.create : null;
  const status = params?.status === "success" || params?.status === "error" ? params.status : null;
  const message = typeof params?.message === "string" ? params.message.trim() : "";

  const userContext = await requirePlatformOperatorUserContext();
  const [modelAssociationsResult, modelAliasesResult] = await Promise.allSettled([
    getOperatorGatewayModelAssociations(userContext),
    listOperatorGatewayModelAliases(userContext),
  ]);

  if (modelAssociationsResult.status === "rejected" || modelAliasesResult.status === "rejected") {
    let dependencyError: unknown;
    if (modelAssociationsResult.status === "rejected") {
      dependencyError = modelAssociationsResult.reason;
    } else if (modelAliasesResult.status === "rejected") {
      dependencyError = modelAliasesResult.reason;
    }
    const notice = buildGatewayDependencyUnavailableNotice(dependencyError, {
      resourceName: "模型别名矩阵",
      continuation: "全局模型别名和服务商模型映射暂不可维护；创建服务商模板入口仍可打开。",
    });

    return (
      <NtPanel className="nt-stack" style={PAGE_STACK_STYLE}>
        <header className="nt-stack nt-gap-3_5">
          <div className="nt-flex nt-justify-between nt-wrap nt-gap-4" style={BASELINE_HEADER_ROW_STYLE}>
            <div className="nt-stack nt-gap-2">
              <p className="nt-kicker">AI 网关</p>
              <h1 className="nt-flush nt-text-metric">模型别名</h1>
              <p className="nt-flush nt-text-muted" style={PAGE_LEAD_STYLE}>
                页面已降级为依赖提示，避免 Gateway 离线时整页 500。
              </p>
            </div>
            <div className="nt-flex nt-wrap nt-gap-2_5">
              {SECTION_OPTIONS.map((option) => (
                <Link
                  key={option.key}
                  href={buildPageHref({ section: option.key })}
                  className={`nt-btn ${activeSection === option.key ? "nt-btn--primary" : ""}`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
        </header>

        {status && message ? (
          <NtCard
            className="nt-stack nt-gap-1_5"
            style={status === "success" ? STATUS_CARD_SUCCESS_STYLE : STATUS_CARD_ERROR_STYLE}
          >
            <div className="nt-flex nt-items-center nt-gap-2">
              <NtBadge tone={resolveStatusTone(status)}>{status === "success" ? "操作完成" : "操作失败"}</NtBadge>
            </div>
            <p className="nt-flush nt-text-strong">{message}</p>
          </NtCard>
        ) : null}

        <GatewayDependencyUnavailableCard
          notice={notice}
          action={{ href: "/ops/gateway/providers/create", label: "打开创建服务商模板" }}
        />
      </NtPanel>
    );
  }

  const modelAssociations = modelAssociationsResult.value;
  const modelAliases = modelAliasesResult.value;

  const providerRows = (modelAssociations.providerRows ?? []).slice().sort((left, right) => left.label.localeCompare(right.label));
  const aliasRows = modelAssociations.aliasRows ?? [];
  const platformAliasRows = aliasRows.filter((row) => row.projectId == null);
  const globalAliasRows = platformAliasRows
    .filter((row) => row.scopeType === "global")
    .sort((left, right) => left.alias.localeCompare(right.alias));
  const totalProviders = providerRows.length;
  const selectedAlias =
    globalAliasRows.find((row) => row.alias === params?.alias)?.alias ?? globalAliasRows[0]?.alias ?? null;
  const selectedGlobalAliasRow = globalAliasRows.find((row) => row.alias === selectedAlias) ?? null;
  const selectedProviderId =
    providerRows.find((row) => row.providerAccountId === params?.provider)?.providerAccountId ??
    providerRows[0]?.providerAccountId ??
    null;
  const selectedProviderRow = providerRows.find((row) => row.providerAccountId === selectedProviderId) ?? null;

  const aliasRecordMap = new Map<string, GatewayModelAliasView[]>();
  for (const aliasRecord of modelAliases ?? []) {
    const key = buildAliasProviderKey(
      aliasRecord.alias,
      aliasRecord.providerAccountId,
      aliasRecord.scopeType,
      aliasRecord.projectId,
    );
    const bucket = aliasRecordMap.get(key);
    if (bucket) bucket.push(aliasRecord);
    else aliasRecordMap.set(key, [aliasRecord]);
  }

  const providerSpecialAliases =
    selectedProviderRow?.aliases.filter((alias) => alias.projectId == null && alias.scopeType === "provider_special") ?? [];
  const providerProjectScopedAliasCount =
    selectedProviderRow?.aliases.filter((alias) => alias.projectId != null).length ?? 0;
  const selectedGlobalAliasIds = selectedGlobalAliasRow
    ? modelAliases
        .filter(
          (aliasRecord) =>
            aliasRecord.projectId == null &&
            aliasRecord.scopeType === "global" &&
            aliasRecord.alias === selectedGlobalAliasRow.alias,
        )
        .map((aliasRecord) => aliasRecord.id)
    : [];
  const globalViewRedirectTo = buildPageHref({ section: "global", alias: selectedAlias, provider: selectedProviderId });
  const providerViewRedirectTo = buildPageHref({ section: "provider", alias: selectedAlias, provider: selectedProviderId });
  const globalDeleteRedirectTo = buildPageHref({ section: "global", provider: selectedProviderId });

  return (
    <NtPanel className="nt-stack" style={PAGE_STACK_STYLE}>
      <header className="nt-stack nt-gap-3_5">
        <div className="nt-flex nt-justify-between nt-wrap nt-gap-4" style={BASELINE_HEADER_ROW_STYLE}>
          <div className="nt-stack nt-gap-2">
            <p className="nt-kicker">AI 网关</p>
            <h1 className="nt-flush nt-text-metric">模型别名</h1>
            <p className="nt-flush nt-text-muted" style={PAGE_LEAD_STYLE}>
              这里把模型别名正式拆成两种运维视角：一边按全局别名批量校对每个服务商的真实模型映射，一边按单个服务商维护自己的全局映射与特殊别名。
            </p>
          </div>
          <div className="nt-flex nt-wrap nt-gap-2_5">
            {SECTION_OPTIONS.map((option) => (
              <Link
                key={option.key}
                href={buildPageHref({ section: option.key, alias: selectedAlias, provider: selectedProviderId })}
                className={`nt-btn ${activeSection === option.key ? "nt-btn--primary" : ""}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="nt-flex nt-wrap nt-gap-2">
          <NtBadge tone="glass">全局别名 {globalAliasRows.length}</NtBadge>
          <NtBadge tone="glass">服务商 {providerRows.length}</NtBadge>
        </div>
      </header>

      {status && message ? (
        <NtCard
          className="nt-stack nt-gap-1_5"
          style={status === "success" ? STATUS_CARD_SUCCESS_STYLE : STATUS_CARD_ERROR_STYLE}
        >
          <div className="nt-flex nt-items-center nt-gap-2">
            <NtBadge tone={resolveStatusTone(status)}>{status === "success" ? "操作完成" : "操作失败"}</NtBadge>
          </div>
          <p className="nt-flush nt-text-strong">{message}</p>
        </NtCard>
      ) : null}

      {activeSection === "global" ? (
        <section className="nt-stack nt-gap-4">
          <NtCard className="nt-stack nt-gap-4">
            <div className="nt-flex nt-justify-between nt-items-center nt-gap-3 nt-wrap">
              <div className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">全局模型别名</span>
                <p className="nt-flush nt-text-muted">
                  选中某个全局别名后，会看到它在每个服务商上的真实模型映射，并允许逐项修正。
                </p>
              </div>
              <Link
                href={buildPageHref({
                  section: "global",
                  alias: selectedAlias,
                  provider: selectedProviderId,
                  create: createMode === "global" ? null : "global",
                })}
                className="nt-btn nt-btn--primary"
              >
                {createMode === "global" ? "收起新增表单" : "添加全局模型别名"}
              </Link>
            </div>

            {globalAliasRows.length ? (
              <div className="nt-flex nt-wrap nt-gap-2_5">
                {globalAliasRows.map((row) => (
                  <Link
                    key={row.alias}
                    href={buildPageHref({ section: "global", alias: row.alias, provider: selectedProviderId })}
                    className={`nt-btn ${selectedAlias === row.alias ? "nt-btn--primary" : ""}`}
                  >
                    {row.alias}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="nt-flush nt-text-muted">
                当前还没有全局模型别名。先通过“添加全局模型别名”生成一整套服务商映射栏位。
              </p>
            )}
          </NtCard>

          {createMode === "global" ? (
            <NtCard className="nt-stack nt-gap-4">
              <div className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">新增全局模型别名</span>
                <p className="nt-flush nt-text-muted">
                  这会按当前所有服务商各创建一条别名映射。你可以先留空真实模型，后续再分别补齐。
                </p>
              </div>

              <form action={createGlobalGatewayModelAliasAction} className="nt-stack nt-gap-4">
                <input type="hidden" name="redirectTo" value={globalViewRedirectTo} />
                <input type="hidden" name="priority" value="100" />
                <input type="hidden" name="weight" value="1" />
                <input type="hidden" name="enabled" value="true" />

                <label className="nt-stack nt-gap-1_5">
                  <span className="nt-kicker">别名名称</span>
                  <NtInput name="alias" placeholder="例如 gpt-5 / sonnet-4 / image-pro" required />
                </label>

                <div className="nt-flex nt-wrap nt-gap-3_5">
                  {providerRows.length ? (
                    providerRows.map((provider) => (
                      <div
                        key={`global-create-${provider.providerAccountId}`}
                        className="nt-card nt-card--outlined nt-stack nt-gap-2_5 nt-col-360"
                        style={MODEL_ALIAS_CREATE_CARD_STYLE}
                      >
                        <input type="hidden" name="providerAccountId" value={provider.providerAccountId} />
                        <div className="nt-flex nt-justify-between nt-gap-3 nt-wrap">
                          {renderProviderHeader(provider)}
                        </div>
                        <label className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">真实模型映射</span>
                          <NtInput name="upstreamModel" placeholder={provider.defaultModel ?? "留空后可稍后补填"} />
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="nt-flush nt-text-muted">
                      当前没有服务商，无法创建全局模型别名。
                    </p>
                  )}
                </div>

                {providerRows.length ? (
                  <div className="nt-flex nt-justify-end">
                    <button type="submit" className="nt-btn nt-btn--primary">
                      写入全局别名
                    </button>
                  </div>
                ) : null}
              </form>
            </NtCard>
          ) : null}

          {selectedGlobalAliasRow ? (
            <NtCard className="nt-stack nt-gap-4">
              <div className="nt-flex nt-justify-between nt-gap-3 nt-wrap" style={BASELINE_HEADER_ROW_STYLE}>
                <div className="nt-stack nt-gap-1_5">
                  <span className="nt-kicker">已选全局别名</span>
                  <h2 className="nt-flush nt-text-strong">{selectedGlobalAliasRow.alias}</h2>
                  <p className="nt-flush nt-text-muted">
                    当前已覆盖 {selectedGlobalAliasRow.providerCount}/{totalProviders} 个服务商。
                  </p>
                </div>
                <div className="nt-flex nt-wrap nt-gap-2 nt-items-center">
                  <NtBadge tone="glass">回退优先级 {selectedGlobalAliasRow.fallbackPriority}</NtBadge>
                  <NtBadge tone="glass">启用映射 {selectedGlobalAliasRow.enabledProviderCount}</NtBadge>
                  {selectedGlobalAliasIds.length ? (
                    <form action={deleteGatewayModelAliasesAction}>
                      <input type="hidden" name="redirectTo" value={globalDeleteRedirectTo} />
                      <input type="hidden" name="aliasLabel" value={selectedGlobalAliasRow.alias} />
                      <input type="hidden" name="scopeLabel" value="全局模型别名" />
                      {selectedGlobalAliasIds.map((aliasId) => (
                        <input key={`delete-global-${aliasId}`} type="hidden" name="aliasId" value={aliasId} />
                      ))}
                      <button type="submit" className="nt-btn">
                        删除全局模型别名
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>

              <div className="nt-flex nt-wrap nt-gap-3_5">
                {providerRows.map((provider) => {
                  const link = selectedGlobalAliasRow.providers.find((entry) => entry.providerAccountId === provider.providerAccountId);
                  const { record, duplicateCount } = getPrimaryAliasRecord(
                    aliasRecordMap,
                    selectedGlobalAliasRow.alias,
                    provider.providerAccountId,
                    "global",
                    null,
                  );

                  return (
                    <NtCard
                      key={`${selectedGlobalAliasRow.alias}-${provider.providerAccountId}`}
                      className="nt-stack nt-gap-3_5 nt-col-360"
                      style={MODEL_ALIAS_CARD_STYLE}
                    >
                      <div className="nt-flex nt-justify-between nt-gap-3 nt-items-start nt-wrap">
                        {renderProviderHeader(provider)}
                        <div className="nt-flex nt-wrap nt-gap-2">
                          <NtBadge tone={link?.enabled === false ? "warning" : "success"}>
                            {link?.enabled === false ? "当前停用" : "当前启用"}
                          </NtBadge>
                          {duplicateCount > 1 ? <NtBadge tone="warning">同名映射 {duplicateCount} 条</NtBadge> : null}
                        </div>
                      </div>

                      <form action={saveGatewayModelAliasAction} className="nt-stack nt-gap-3">
                        <input type="hidden" name="redirectTo" value={globalViewRedirectTo} />
                        <input type="hidden" name="aliasId" value={record?.id ?? ""} />
                        <input type="hidden" name="scopeType" value="global" />
                        <input type="hidden" name="alias" value={selectedGlobalAliasRow.alias} />
                        <input type="hidden" name="providerAccountId" value={provider.providerAccountId} />
                        <input type="hidden" name="priority" value={String(link?.priority ?? record?.priority ?? 100)} />
                        <input type="hidden" name="weight" value={String(link?.weight ?? record?.weight ?? 1)} />
                        <input type="hidden" name="enabled" value={String(link?.enabled ?? record?.enabled ?? true)} />

                        <label className="nt-stack nt-gap-1_5">
                          <span className="nt-kicker">真实模型映射</span>
                          <NtInput
                            name="upstreamModel"
                            defaultValue={link?.upstreamModel ?? record?.upstreamModel ?? ""}
                            placeholder={provider.defaultModel ?? "填写该服务商里的真实模型名"}
                          />
                        </label>

                        <div className="nt-flex nt-justify-between nt-gap-3 nt-wrap">
                          <p className="nt-flush nt-text-muted">
                            优先级 {link?.priority ?? record?.priority ?? 100} · 权重 {link?.weight ?? record?.weight ?? 1}
                          </p>
                          <button type="submit" className="nt-btn nt-btn--primary">
                            {record ? "保存映射" : "补充映射"}
                          </button>
                        </div>
                      </form>

                    </NtCard>
                  );
                })}
              </div>
            </NtCard>
          ) : createMode === "global" ? null : (
            <NtCard>
              <span className="nt-kicker">全局别名视角</span>
              <p className="nt-text-muted" style={CARD_NOTE_STYLE}>
                当前没有可展示的全局别名。先创建一个全局别名，再逐个服务商填写真实模型映射。
              </p>
            </NtCard>
          )}

        </section>
      ) : (
        <section className="nt-stack nt-gap-4">
          <NtCard className="nt-stack nt-gap-4">
            <div className="nt-flex nt-justify-between nt-items-center nt-gap-3 nt-wrap">
              <div className="nt-stack nt-gap-1_5">
                <span className="nt-kicker">服务商模型别名</span>
                <p className="nt-flush nt-text-muted">
                  从单个服务商出发，查看它承接的全局别名，并补充只在该服务商里生效的特殊别名。
                </p>
              </div>
              <Link
                href={buildPageHref({
                  section: "provider",
                  alias: selectedAlias,
                  provider: selectedProviderId,
                  create: createMode === "special" ? null : "special",
                })}
                className="nt-btn nt-btn--primary"
              >
                {createMode === "special" ? "收起特殊别名表单" : "添加服务商特殊别名"}
              </Link>
            </div>

            {providerRows.length ? (
              <div className="nt-flex nt-wrap nt-gap-2_5">
                {providerRows.map((provider) => (
                  <Link
                    key={provider.providerAccountId}
                    href={buildPageHref({
                      section: "provider",
                      alias: selectedAlias,
                      provider: provider.providerAccountId,
                    })}
                    className={`nt-btn ${selectedProviderId === provider.providerAccountId ? "nt-btn--primary" : ""}`}
                  >
                    {provider.label}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="nt-flush nt-text-muted">
                当前没有服务商，无法维护服务商模型别名。
              </p>
            )}
          </NtCard>

          {selectedProviderRow ? (
            <>
              <NtCard className="nt-stack nt-gap-3_5">
                <div className="nt-flex nt-justify-between nt-gap-3 nt-items-start nt-wrap">
                  {renderProviderHeader(selectedProviderRow)}
                  <div className="nt-flex nt-wrap nt-gap-2">
                    <NtBadge tone="glass">全局别名 {globalAliasRows.length}</NtBadge>
                    <NtBadge tone="glass">特殊别名 {providerSpecialAliases.length}</NtBadge>
                  </div>
                </div>

                {providerProjectScopedAliasCount > 0 ? (
                  <p className="nt-flush nt-text-muted">
                    当前服务商另有 {providerProjectScopedAliasCount} 条项目定制别名。当前页面先只维护平台级全局别名与服务商特殊别名。
                  </p>
                ) : null}
              </NtCard>

              <NtCard className="nt-stack nt-gap-4">
                <div className="nt-stack nt-gap-1_5">
                  <span className="nt-kicker">全局模型别名</span>
                  <p className="nt-flush nt-text-muted">
                    这里展示该服务商承接的全局 alias 视图。它和“全局模型别名”分页看到的是同一批数据，只是换成了服务商视角。
                  </p>
                </div>

                {globalAliasRows.length ? (
                  <div className="nt-flex nt-wrap nt-gap-3_5">
                    {globalAliasRows.map((row) => {
                      const link = row.providers.find((entry) => entry.providerAccountId === selectedProviderRow.providerAccountId);
                      const { record, duplicateCount } = getPrimaryAliasRecord(
                        aliasRecordMap,
                        row.alias,
                        selectedProviderRow.providerAccountId,
                        "global",
                        null,
                      );

                      return (
                        <NtCard
                          key={`${selectedProviderRow.providerAccountId}-${row.scopeType}-${row.alias}`}
                          className="nt-stack nt-gap-3 nt-col-360"
                          style={MODEL_ALIAS_CARD_STYLE}
                        >
                          <div className="nt-stack nt-gap-2">
                            <div className="nt-flex nt-justify-between nt-gap-2 nt-wrap">
                              <div>
                                <span className="nt-kicker">全局别名</span>
                                <h3 className="nt-flush nt-text-strong">{row.alias}</h3>
                              </div>
                              <div className="nt-flex nt-wrap nt-gap-1_5">
                                <NtBadge tone={link?.enabled === false ? "warning" : "success"}>
                                  {link?.enabled === false ? "停用" : "启用"}
                                </NtBadge>
                                {duplicateCount > 1 ? <NtBadge tone="warning">同名映射 {duplicateCount} 条</NtBadge> : null}
                              </div>
                            </div>
                            <p className="nt-flush nt-text-muted">
                              已覆盖 {row.providerCount}/{totalProviders} 个服务商。
                            </p>
                          </div>

                          <form action={saveGatewayModelAliasAction} className="nt-stack nt-gap-3">
                            <input type="hidden" name="redirectTo" value={providerViewRedirectTo} />
                            <input type="hidden" name="aliasId" value={record?.id ?? ""} />
                            <input type="hidden" name="scopeType" value="global" />
                            <input type="hidden" name="alias" value={row.alias} />
                            <input type="hidden" name="providerAccountId" value={selectedProviderRow.providerAccountId} />
                            <input type="hidden" name="priority" value={String(link?.priority ?? record?.priority ?? 100)} />
                            <input type="hidden" name="weight" value={String(link?.weight ?? record?.weight ?? 1)} />
                            <input type="hidden" name="enabled" value={String(link?.enabled ?? record?.enabled ?? true)} />

                            <label className="nt-stack nt-gap-1_5">
                              <span className="nt-kicker">真实模型映射</span>
                              <NtInput
                                name="upstreamModel"
                                defaultValue={link?.upstreamModel ?? record?.upstreamModel ?? ""}
                                placeholder={selectedProviderRow.defaultModel ?? "填写真实模型名"}
                              />
                            </label>

                            <div className="nt-flex nt-justify-between nt-gap-3 nt-wrap">
                              <span className="nt-text-muted">
                                优先级 {link?.priority ?? record?.priority ?? 100} · 权重 {link?.weight ?? record?.weight ?? 1}
                              </span>
                              <button type="submit" className="nt-btn nt-btn--primary">
                                {record ? "保存映射" : "补充映射"}
                              </button>
                            </div>
                          </form>
                        </NtCard>
                      );
                    })}
                  </div>
                ) : (
                  <p className="nt-flush nt-text-muted">
                    当前还没有全局模型别名。先切到“全局模型别名”创建，再回到这里按服务商视角核对。
                  </p>
                )}
              </NtCard>

              {createMode === "special" ? (
                <NtCard className="nt-stack nt-gap-4">
                  <div className="nt-stack nt-gap-1_5">
                    <span className="nt-kicker">新增服务商特殊别名</span>
                    <p className="nt-flush nt-text-muted">
                      这里创建的 alias 只会写入当前服务商，不会进入全局 alias 列表。
                    </p>
                  </div>

                  <form action={saveGatewayModelAliasAction} className="nt-stack nt-gap-3_5">
                    <input type="hidden" name="redirectTo" value={providerViewRedirectTo} />
                    <input type="hidden" name="providerAccountId" value={selectedProviderRow.providerAccountId} />
                    <input type="hidden" name="scopeType" value="provider_special" />
                    <input type="hidden" name="priority" value="100" />
                    <input type="hidden" name="weight" value="1" />
                    <input type="hidden" name="enabled" value="true" />

                    <label className="nt-stack nt-gap-1_5">
                      <span className="nt-kicker">特殊别名</span>
                      <NtInput name="alias" placeholder="例如 gpt-5-codex-fast / vendor-preview" required />
                    </label>

                    <label className="nt-stack nt-gap-1_5">
                      <span className="nt-kicker">真实模型映射</span>
                      <NtInput name="upstreamModel" placeholder={selectedProviderRow.defaultModel ?? "填写真实模型名"} />
                    </label>

                    <div className="nt-flex nt-justify-end">
                      <button type="submit" className="nt-btn nt-btn--primary">
                        添加特殊别名
                      </button>
                    </div>
                  </form>
                </NtCard>
              ) : null}

              <NtCard className="nt-stack nt-gap-4">
                <div className="nt-stack nt-gap-1_5">
                  <span className="nt-kicker">服务商特殊别名</span>
                  <p className="nt-flush nt-text-muted">
                    这些 alias 只在当前服务商里生效，不会被当作所有服务商共同承接的全局 alias。
                  </p>
                </div>

                {providerSpecialAliases.length ? (
                  <div className="nt-flex nt-wrap nt-gap-3_5">
                    {providerSpecialAliases.map((alias) => {
                      const { record, duplicateCount } = getPrimaryAliasRecord(
                        aliasRecordMap,
                        alias.alias,
                        selectedProviderRow.providerAccountId,
                        "provider_special",
                        null,
                      );
                      const deleteAliasIds = getAliasRecordIds(
                        aliasRecordMap,
                        alias.alias,
                        selectedProviderRow.providerAccountId,
                        "provider_special",
                        null,
                      );

                      return (
                        <NtCard
                          key={`${selectedProviderRow.providerAccountId}-special-${alias.alias}`}
                          className="nt-stack nt-gap-3 nt-col-360"
                          style={MODEL_ALIAS_CARD_STYLE}
                        >
                          <div className="nt-flex nt-justify-between nt-gap-2 nt-wrap">
                            <div>
                              <span className="nt-kicker">特殊别名</span>
                              <h3 className="nt-flush nt-text-strong">{alias.alias}</h3>
                            </div>
                            <div className="nt-flex nt-gap-1_5 nt-wrap">
                              <NtBadge tone={alias.enabled ? "success" : "warning"}>
                                {alias.enabled ? "启用" : "停用"}
                              </NtBadge>
                              {duplicateCount > 1 ? <NtBadge tone="warning">同名映射 {duplicateCount} 条</NtBadge> : null}
                              {deleteAliasIds.length ? (
                                <form action={deleteGatewayModelAliasesAction}>
                                  <input type="hidden" name="redirectTo" value={providerViewRedirectTo} />
                                  <input type="hidden" name="aliasLabel" value={alias.alias} />
                                  <input type="hidden" name="scopeLabel" value="服务商模型别名" />
                                  {deleteAliasIds.map((aliasId) => (
                                    <input key={`delete-special-${alias.alias}-${aliasId}`} type="hidden" name="aliasId" value={aliasId} />
                                  ))}
                                  <button type="submit" className="nt-btn">
                                    删除
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>

                          <form action={saveGatewayModelAliasAction} className="nt-stack nt-gap-3">
                            <input type="hidden" name="redirectTo" value={providerViewRedirectTo} />
                            <input type="hidden" name="aliasId" value={record?.id ?? ""} />
                            <input type="hidden" name="scopeType" value="provider_special" />
                            <input type="hidden" name="alias" value={alias.alias} />
                            <input type="hidden" name="providerAccountId" value={selectedProviderRow.providerAccountId} />
                            <input type="hidden" name="priority" value={String(alias.priority)} />
                            <input type="hidden" name="weight" value={String(alias.weight)} />
                            <input type="hidden" name="enabled" value={String(alias.enabled)} />

                            <label className="nt-stack nt-gap-1_5">
                              <span className="nt-kicker">真实模型映射</span>
                              <NtInput
                                name="upstreamModel"
                                defaultValue={alias.upstreamModel ?? record?.upstreamModel ?? ""}
                                placeholder={selectedProviderRow.defaultModel ?? "填写真实模型名"}
                              />
                            </label>

                            <div className="nt-flex nt-justify-between nt-gap-3 nt-wrap">
                              <p className="nt-flush nt-text-muted">
                                优先级 {alias.priority} · 权重 {alias.weight}
                              </p>
                              <button type="submit" className="nt-btn nt-btn--primary">
                                保存映射
                              </button>
                            </div>
                          </form>
                        </NtCard>
                      );
                    })}
                  </div>
                ) : (
                  <p className="nt-flush nt-text-muted">
                    当前服务商还没有特殊别名。需要时可以用上面的按钮单独添加。
                  </p>
                )}
              </NtCard>
            </>
          ) : (
            <NtCard>
              <span className="nt-kicker">服务商视角</span>
              <p className="nt-text-muted" style={CARD_NOTE_STYLE}>
                当前没有服务商数据，先确认服务商目录已经创建并同步完成。
              </p>
            </NtCard>
          )}
        </section>
      )}
    </NtPanel>
  );
}
