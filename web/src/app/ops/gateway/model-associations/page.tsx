import { auth } from "@/auth";
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
import {
  isPlatformOperatorUserId,
  requirePlatformOperatorUserContext,
} from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

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

const MODEL_ALIAS_CARD_WRAP_STYLE = {
  display: "flex",
  flexWrap: "wrap",
  gap: 14,
  alignItems: "stretch",
} as const;

const MODEL_ALIAS_CARD_STYLE = {
  display: "grid",
  gap: 12,
  flex: "0 1 360px",
  width: "min(360px, 100%)",
  minWidth: "min(320px, 100%)",
  maxWidth: 360,
  alignContent: "start",
} as const;

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
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <NtBadge tone={resolveProviderStatusTone(provider.status)}>
          {PROVIDER_STATUS_LABELS[provider.status] ?? provider.status}
        </NtBadge>
        <NtBadge tone={resolveSourceTone(provider.sourceProfile.sourceKind)}>
          {SOURCE_KIND_LABELS[provider.sourceProfile.sourceKind] ?? provider.sourceProfile.sourceKind}
        </NtBadge>
        <NtBadge tone="glass">{provider.protocolFamily}</NtBadge>
      </div>
      <div>
        <h3 style={{ margin: 0, color: "rgba(243,245,247,0.96)" }}>{provider.label}</h3>
        <p style={{ margin: "4px 0 0", color: "rgba(190,199,217,0.76)" }}>
          默认模型：<strong style={{ color: "rgba(243,245,247,0.94)" }}>{provider.defaultModel ?? "未声明"}</strong>
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
  const [modelAssociations, modelAliases] = await Promise.all([
    getOperatorGatewayModelAssociations(userContext),
    listOperatorGatewayModelAliases(userContext),
  ]);

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
    <NtPanel style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <p className="nt-kicker">AI 网关</p>
            <h1 style={{ margin: 0, fontSize: "2rem" }}>模型别名</h1>
            <p style={{ margin: 0, color: "rgba(190,199,217,0.76)", maxWidth: 980 }}>
              这里把模型别名正式拆成两种运维视角：一边按全局别名批量校对每个服务商的真实模型映射，一边按单个服务商维护自己的全局映射与特殊别名。
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <NtBadge tone="glass">全局别名 {globalAliasRows.length}</NtBadge>
          <NtBadge tone="glass">服务商 {providerRows.length}</NtBadge>
        </div>
      </header>

      {status && message ? (
        <NtCard
          style={{
            display: "grid",
            gap: 6,
            borderColor: status === "success" ? "rgba(120,255,204,0.28)" : "rgba(255,114,118,0.28)",
            background:
              status === "success"
                ? "linear-gradient(135deg, rgba(11,31,24,0.92), rgba(18,41,33,0.84))"
                : "linear-gradient(135deg, rgba(42,15,17,0.94), rgba(54,20,25,0.84))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NtBadge tone={resolveStatusTone(status)}>{status === "success" ? "操作完成" : "操作失败"}</NtBadge>
          </div>
          <p style={{ margin: 0, color: "rgba(243,245,247,0.92)" }}>{message}</p>
        </NtCard>
      ) : null}

      {activeSection === "global" ? (
        <section style={{ display: "grid", gap: 16 }}>
          <NtCard style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">全局模型别名</span>
                <p style={{ margin: 0, color: "rgba(190,199,217,0.76)" }}>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
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
              <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
                当前还没有全局模型别名。先通过“添加全局模型别名”生成一整套服务商映射栏位。
              </p>
            )}
          </NtCard>

          {createMode === "global" ? (
            <NtCard style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">新增全局模型别名</span>
                <p style={{ margin: 0, color: "rgba(190,199,217,0.76)" }}>
                  这会按当前所有服务商各创建一条别名映射。你可以先留空真实模型，后续再分别补齐。
                </p>
              </div>

              <form action={createGlobalGatewayModelAliasAction} style={{ display: "grid", gap: 16 }}>
                <input type="hidden" name="redirectTo" value={globalViewRedirectTo} />
                <input type="hidden" name="priority" value="100" />
                <input type="hidden" name="weight" value="1" />
                <input type="hidden" name="enabled" value="true" />

                <label style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">别名名称</span>
                  <NtInput name="alias" placeholder="例如 gpt-5 / sonnet-4 / image-pro" required />
                </label>

                <div style={MODEL_ALIAS_CARD_WRAP_STYLE}>
                  {providerRows.length ? (
                    providerRows.map((provider) => (
                      <div
                        key={`global-create-${provider.providerAccountId}`}
                        style={{
                          display: "grid",
                          gap: 10,
                          padding: 16,
                          flex: MODEL_ALIAS_CARD_STYLE.flex,
                          width: MODEL_ALIAS_CARD_STYLE.width,
                          minWidth: MODEL_ALIAS_CARD_STYLE.minWidth,
                          maxWidth: MODEL_ALIAS_CARD_STYLE.maxWidth,
                          borderRadius: 18,
                          border: "1px solid rgba(148,163,184,0.16)",
                          background: "linear-gradient(180deg, rgba(11,16,27,0.84), rgba(8,12,21,0.74))",
                        }}
                      >
                        <input type="hidden" name="providerAccountId" value={provider.providerAccountId} />
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          {renderProviderHeader(provider)}
                        </div>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="nt-kicker">真实模型映射</span>
                          <NtInput name="upstreamModel" placeholder={provider.defaultModel ?? "留空后可稍后补填"} />
                        </label>
                      </div>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
                      当前没有服务商，无法创建全局模型别名。
                    </p>
                  )}
                </div>

                {providerRows.length ? (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="nt-btn nt-btn--primary">
                      写入全局别名
                    </button>
                  </div>
                ) : null}
              </form>
            </NtCard>
          ) : null}

          {selectedGlobalAliasRow ? (
            <NtCard style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">已选全局别名</span>
                  <h2 style={{ margin: 0, color: "rgba(243,245,247,0.96)" }}>{selectedGlobalAliasRow.alias}</h2>
                  <p style={{ margin: 0, color: "rgba(190,199,217,0.76)" }}>
                    当前已覆盖 {selectedGlobalAliasRow.providerCount}/{totalProviders} 个服务商。
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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

              <div style={MODEL_ALIAS_CARD_WRAP_STYLE}>
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
                      style={{ ...MODEL_ALIAS_CARD_STYLE, gap: 14 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                        {renderProviderHeader(provider)}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <NtBadge tone={link?.enabled === false ? "warning" : "success"}>
                            {link?.enabled === false ? "当前停用" : "当前启用"}
                          </NtBadge>
                          {duplicateCount > 1 ? <NtBadge tone="warning">同名映射 {duplicateCount} 条</NtBadge> : null}
                        </div>
                      </div>

                      <form action={saveGatewayModelAliasAction} style={{ display: "grid", gap: 12 }}>
                        <input type="hidden" name="redirectTo" value={globalViewRedirectTo} />
                        <input type="hidden" name="aliasId" value={record?.id ?? ""} />
                        <input type="hidden" name="scopeType" value="global" />
                        <input type="hidden" name="alias" value={selectedGlobalAliasRow.alias} />
                        <input type="hidden" name="providerAccountId" value={provider.providerAccountId} />
                        <input type="hidden" name="priority" value={String(link?.priority ?? record?.priority ?? 100)} />
                        <input type="hidden" name="weight" value={String(link?.weight ?? record?.weight ?? 1)} />
                        <input type="hidden" name="enabled" value={String(link?.enabled ?? record?.enabled ?? true)} />

                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="nt-kicker">真实模型映射</span>
                          <NtInput
                            name="upstreamModel"
                            defaultValue={link?.upstreamModel ?? record?.upstreamModel ?? ""}
                            placeholder={provider.defaultModel ?? "填写该服务商里的真实模型名"}
                          />
                        </label>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
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
              <p style={{ margin: "6px 0 0", color: "rgba(190,199,217,0.76)" }}>
                当前没有可展示的全局别名。先创建一个全局别名，再逐个服务商填写真实模型映射。
              </p>
            </NtCard>
          )}

        </section>
      ) : (
        <section style={{ display: "grid", gap: 16 }}>
          <NtCard style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <span className="nt-kicker">服务商模型别名</span>
                <p style={{ margin: 0, color: "rgba(190,199,217,0.76)" }}>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
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
              <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
                当前没有服务商，无法维护服务商模型别名。
              </p>
            )}
          </NtCard>

          {selectedProviderRow ? (
            <>
              <NtCard style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                  {renderProviderHeader(selectedProviderRow)}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <NtBadge tone="glass">全局别名 {globalAliasRows.length}</NtBadge>
                    <NtBadge tone="glass">特殊别名 {providerSpecialAliases.length}</NtBadge>
                  </div>
                </div>

                {providerProjectScopedAliasCount > 0 ? (
                  <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
                    当前服务商另有 {providerProjectScopedAliasCount} 条项目定制别名。当前页面先只维护平台级全局别名与服务商特殊别名。
                  </p>
                ) : null}
              </NtCard>

              <NtCard style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">全局模型别名</span>
                  <p style={{ margin: 0, color: "rgba(190,199,217,0.76)" }}>
                    这里展示该服务商承接的全局 alias 视图。它和“全局模型别名”分页看到的是同一批数据，只是换成了服务商视角。
                  </p>
                </div>

                {globalAliasRows.length ? (
                  <div style={MODEL_ALIAS_CARD_WRAP_STYLE}>
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
                          style={MODEL_ALIAS_CARD_STYLE}
                        >
                          <div style={{ display: "grid", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <div>
                                <span className="nt-kicker">全局别名</span>
                                <h3 style={{ margin: 0, color: "rgba(243,245,247,0.96)" }}>{row.alias}</h3>
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                <NtBadge tone={link?.enabled === false ? "warning" : "success"}>
                                  {link?.enabled === false ? "停用" : "启用"}
                                </NtBadge>
                                {duplicateCount > 1 ? <NtBadge tone="warning">同名映射 {duplicateCount} 条</NtBadge> : null}
                              </div>
                            </div>
                            <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
                              已覆盖 {row.providerCount}/{totalProviders} 个服务商。
                            </p>
                          </div>

                          <form action={saveGatewayModelAliasAction} style={{ display: "grid", gap: 12 }}>
                            <input type="hidden" name="redirectTo" value={providerViewRedirectTo} />
                            <input type="hidden" name="aliasId" value={record?.id ?? ""} />
                            <input type="hidden" name="scopeType" value="global" />
                            <input type="hidden" name="alias" value={row.alias} />
                            <input type="hidden" name="providerAccountId" value={selectedProviderRow.providerAccountId} />
                            <input type="hidden" name="priority" value={String(link?.priority ?? record?.priority ?? 100)} />
                            <input type="hidden" name="weight" value={String(link?.weight ?? record?.weight ?? 1)} />
                            <input type="hidden" name="enabled" value={String(link?.enabled ?? record?.enabled ?? true)} />

                            <label style={{ display: "grid", gap: 6 }}>
                              <span className="nt-kicker">真实模型映射</span>
                              <NtInput
                                name="upstreamModel"
                                defaultValue={link?.upstreamModel ?? record?.upstreamModel ?? ""}
                                placeholder={selectedProviderRow.defaultModel ?? "填写真实模型名"}
                              />
                            </label>

                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <span style={{ color: "rgba(190,199,217,0.72)" }}>
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
                  <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
                    当前还没有全局模型别名。先切到“全局模型别名”创建，再回到这里按服务商视角核对。
                  </p>
                )}
              </NtCard>

              {createMode === "special" ? (
                <NtCard style={{ display: "grid", gap: 16 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <span className="nt-kicker">新增服务商特殊别名</span>
                    <p style={{ margin: 0, color: "rgba(190,199,217,0.76)" }}>
                      这里创建的 alias 只会写入当前服务商，不会进入全局 alias 列表。
                    </p>
                  </div>

                  <form action={saveGatewayModelAliasAction} style={{ display: "grid", gap: 14 }}>
                    <input type="hidden" name="redirectTo" value={providerViewRedirectTo} />
                    <input type="hidden" name="providerAccountId" value={selectedProviderRow.providerAccountId} />
                    <input type="hidden" name="scopeType" value="provider_special" />
                    <input type="hidden" name="priority" value="100" />
                    <input type="hidden" name="weight" value="1" />
                    <input type="hidden" name="enabled" value="true" />

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="nt-kicker">特殊别名</span>
                      <NtInput name="alias" placeholder="例如 gpt-5-codex-fast / vendor-preview" required />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="nt-kicker">真实模型映射</span>
                      <NtInput name="upstreamModel" placeholder={selectedProviderRow.defaultModel ?? "填写真实模型名"} />
                    </label>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button type="submit" className="nt-btn nt-btn--primary">
                        添加特殊别名
                      </button>
                    </div>
                  </form>
                </NtCard>
              ) : null}

              <NtCard style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <span className="nt-kicker">服务商特殊别名</span>
                  <p style={{ margin: 0, color: "rgba(190,199,217,0.76)" }}>
                    这些 alias 只在当前服务商里生效，不会被当作所有服务商共同承接的全局 alias。
                  </p>
                </div>

                {providerSpecialAliases.length ? (
                  <div style={MODEL_ALIAS_CARD_WRAP_STYLE}>
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
                          style={MODEL_ALIAS_CARD_STYLE}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div>
                              <span className="nt-kicker">特殊别名</span>
                              <h3 style={{ margin: 0, color: "rgba(243,245,247,0.96)" }}>{alias.alias}</h3>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

                          <form action={saveGatewayModelAliasAction} style={{ display: "grid", gap: 12 }}>
                            <input type="hidden" name="redirectTo" value={providerViewRedirectTo} />
                            <input type="hidden" name="aliasId" value={record?.id ?? ""} />
                            <input type="hidden" name="scopeType" value="provider_special" />
                            <input type="hidden" name="alias" value={alias.alias} />
                            <input type="hidden" name="providerAccountId" value={selectedProviderRow.providerAccountId} />
                            <input type="hidden" name="priority" value={String(alias.priority)} />
                            <input type="hidden" name="weight" value={String(alias.weight)} />
                            <input type="hidden" name="enabled" value={String(alias.enabled)} />

                            <label style={{ display: "grid", gap: 6 }}>
                              <span className="nt-kicker">真实模型映射</span>
                              <NtInput
                                name="upstreamModel"
                                defaultValue={alias.upstreamModel ?? record?.upstreamModel ?? ""}
                                placeholder={selectedProviderRow.defaultModel ?? "填写真实模型名"}
                              />
                            </label>

                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
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
                  <p style={{ margin: 0, color: "rgba(190,199,217,0.72)" }}>
                    当前服务商还没有特殊别名。需要时可以用上面的按钮单独添加。
                  </p>
                )}
              </NtCard>
            </>
          ) : (
            <NtCard>
              <span className="nt-kicker">服务商视角</span>
              <p style={{ margin: "6px 0 0", color: "rgba(190,199,217,0.78)" }}>
                当前没有服务商数据，先确认服务商目录已经创建并同步完成。
              </p>
            </NtCard>
          )}
        </section>
      )}
    </NtPanel>
  );
}
