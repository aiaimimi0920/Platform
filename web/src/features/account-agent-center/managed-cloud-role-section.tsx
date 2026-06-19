import Link from "next/link";

import type { AgentCapabilityView, AgentMarketplaceListingView, AgentView } from "@neuro/contracts";

import { AccountHomeSection } from "@/components/account-home/templates";
import {
  NtBadge as Badge,
  NtCard as Card,
  NtInput as Input,
  NtSelect as Select,
  NtTextarea as Textarea,
} from "@/components/nt-primitives";
import { formatAccountNumber } from "@/lib/account-center";
import { applyManagedCloudAgentBatchAction, saveManagedCloudAgentAction } from "@/lib/platform-actions";
import { TerminalSelectField } from "@/features/account-agent-center/terminal-select-field";

type ManagedCloudAgentMetrics = {
  completedTaskCount: number;
  totalRevenue: {
    obsidian: number;
    mira: number;
  };
};

type ManagedCloudRoleSectionProps = {
  agents: AgentView[];
  capabilitiesByAgentId: Map<string, AgentCapabilityView[]>;
  listingByCapabilityId: Map<string, AgentMarketplaceListingView>;
  metricsByAgentId: Map<string, ManagedCloudAgentMetrics>;
  selfHref: string;
  batchMode: "delete" | "enable" | "disable" | null;
  panel: "create" | "edit" | null;
  editingAgentId: string | null;
};

function buildCloudHref(
  selfHref: string,
  options?: {
    panel?: "create" | "edit" | null;
    agentId?: string | null;
    batchMode?: "delete" | "enable" | "disable" | null;
    hash?: string;
  },
) {
  const [pathWithQuery] = selfHref.split("#");
  const [pathname, query = ""] = pathWithQuery.split("?");
  const params = new URLSearchParams(query);
  params.delete("batch");
  params.delete("panel");
  params.delete("agentId");
  if (options?.panel) {
    params.set("panel", options.panel);
  }
  if (options?.agentId) {
    params.set("agentId", options.agentId);
  }
  if (options?.batchMode) {
    params.set("batch", options.batchMode);
  }
  const nextQuery = params.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ""}${options?.hash ?? ""}`;
}

function formatAuthModeLabel(agent: AgentView) {
  if (agent.authMode === "apiKey") {
    return "访问密钥";
  }
  if (agent.authMode === "bearer") {
    return "Bearer";
  }
  return "无鉴权";
}

function formatRuntimeEndpointLabel(agent: AgentView) {
  const endpoint = agent.runtimeEndpoint?.trim();
  if (!endpoint) {
    return "未配置";
  }
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

function formatCurrencyLabel(currency: "obsidian" | "mira") {
  return currency === "obsidian" ? "曜石" : "米拉";
}

function formatRevenueSummary(args: { obsidian: number; mira: number }) {
  const parts: string[] = [];
  if (args.obsidian > 0) {
    parts.push(`${formatAccountNumber(args.obsidian)} ${formatCurrencyLabel("obsidian")}`);
  }
  if (args.mira > 0) {
    parts.push(`${formatAccountNumber(args.mira)} ${formatCurrencyLabel("mira")}`);
  }
  return parts.length > 0 ? parts.join(" / ") : "0";
}

function formatListingStatusLabel(status: AgentMarketplaceListingView["status"] | null | undefined) {
  if (status === "published") return "已公开";
  if (status === "paused") return "已暂停";
  if (status === "draft") return "草稿";
  return "未创建";
}

function formatCloudPriceSummary(listing: AgentMarketplaceListingView | null | undefined) {
  if (!listing) {
    return "未定价";
  }
  return `${listing.priceAmount} ${formatCurrencyLabel(listing.priceCurrency)}`;
}

function formatManagedCloudOperationsSummary(listing: AgentMarketplaceListingView | null | undefined) {
  const visibility = formatListingStatusLabel(listing?.status);
  const dispatchMode = listing?.autoTakeEnabled ? "自动接单" : "手动接单";
  return `${visibility} / ${dispatchMode}`;
}

function formatCloudSummary(agent: AgentView, capability: AgentCapabilityView | null) {
  return capability?.routingSummary || capability?.description || agent.description || "尚未填写云端智能体介绍。";
}

function formatManagedCloudBatchConfirmLabel(batchMode: "delete" | "enable" | "disable") {
  if (batchMode === "delete") {
    return "确认删除";
  }
  if (batchMode === "enable") {
    return "确认启用";
  }
  return "确认停用";
}

export function ManagedCloudRoleSection({
  agents,
  capabilitiesByAgentId,
  listingByCapabilityId,
  metricsByAgentId,
  selfHref,
  batchMode,
  panel,
  editingAgentId,
}: ManagedCloudRoleSectionProps) {
  const baseHref = buildCloudHref(selfHref, { hash: "#role-cloud" });
  const createHref = buildCloudHref(selfHref, { panel: "create", hash: "#cloud-workbench" });
  const editingAgent = panel === "edit" && editingAgentId ? agents.find((agent) => agent.id === editingAgentId) ?? null : null;
  const editingCapability = editingAgent ? (capabilitiesByAgentId.get(editingAgent.id) ?? [])[0] ?? null : null;
  const editingListing = editingCapability ? listingByCapabilityId.get(editingCapability.id) ?? null : null;
  const showWorkbench = panel === "create" || Boolean(editingAgent);
  const showOverview = !showWorkbench;
  const workbenchHref =
    panel === "edit" && editingAgent
      ? buildCloudHref(selfHref, {
          panel: "edit",
          agentId: editingAgent.id,
          hash: "#cloud-workbench",
        })
      : createHref;
  const batchRedirectHref = batchMode ? buildCloudHref(selfHref, { batchMode, hash: "#role-cloud" }) : baseHref;
  const selectionModeActive = batchMode !== null;
  const hasAgents = agents.length > 0;
  const editingMetrics =
    (editingAgent ? metricsByAgentId.get(editingAgent.id) : null) ?? {
      completedTaskCount: 0,
      totalRevenue: { obsidian: 0, mira: 0 },
    };
  const autoTakeInputId = editingAgent ? `cloud-listing-auto-take-enabled-${editingAgent.id}` : "cloud-listing-auto-take-enabled-new";

  return (
    <AccountHomeSection className="app-agent-center-section--roles app-agent-center-light-overview" id="role-cloud">
      <div className="app-agent-center-light-overview-layout">
        {showOverview ? (
          <form action={applyManagedCloudAgentBatchAction} className="app-agent-center-light-overview-layout" id="cloud-overview-batch-form">
            <input name="redirectTo" type="hidden" value={batchRedirectHref} />
            <input name="successRedirectTo" type="hidden" value={baseHref} />
            {batchMode ? <input name="batchAction" type="hidden" value={batchMode} /> : null}
            <div className="app-agent-center-light-toolbar">
              <div className="app-agent-center-light-opbar__stack app-agent-center-light-opbar__stack--inline">
                {selectionModeActive && batchMode && hasAgents ? (
                  <>
                    <button className="nt-btn nt-btn--primary app-agent-center-light-opbar__button" type="submit">
                      {formatManagedCloudBatchConfirmLabel(batchMode)}
                    </button>
                    <Link className="nt-btn nt-btn--secondary app-agent-center-light-opbar__button" href={baseHref}>
                      取消
                    </Link>
                  </>
                ) : (
                  <>
                    <Link className="nt-btn nt-btn--primary app-agent-center-light-opbar__button" href={createHref}>
                      新建
                    </Link>
                    {hasAgents ? (
                      <>
                        <Link
                          className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                          href={buildCloudHref(selfHref, { batchMode: "delete", hash: "#role-cloud" })}
                        >
                          删除
                        </Link>
                        <Link
                          className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                          href={buildCloudHref(selfHref, { batchMode: "enable", hash: "#role-cloud" })}
                        >
                          启用
                        </Link>
                        <Link
                          className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                          href={buildCloudHref(selfHref, { batchMode: "disable", hash: "#role-cloud" })}
                        >
                          停用
                        </Link>
                      </>
                    ) : (
                      <>
                        <button className="nt-btn nt-btn--outline app-agent-center-light-opbar__button" disabled type="button">
                          删除
                        </button>
                        <button className="nt-btn nt-btn--outline app-agent-center-light-opbar__button" disabled type="button">
                          启用
                        </button>
                        <button className="nt-btn nt-btn--outline app-agent-center-light-opbar__button" disabled type="button">
                          停用
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            {hasAgents ? (
              <div className="app-agent-center-light-grid">
                {agents.map((agent) => {
                  const capability = (capabilitiesByAgentId.get(agent.id) ?? [])[0] ?? null;
                  const listing = capability ? listingByCapabilityId.get(capability.id) ?? null : null;
                  const metrics = metricsByAgentId.get(agent.id) ?? {
                    completedTaskCount: 0,
                    totalRevenue: { obsidian: 0, mira: 0 },
                  };
                  const editHref = buildCloudHref(selfHref, {
                    panel: "edit",
                    agentId: agent.id,
                    hash: "#cloud-workbench",
                  });

                  return (
                    <Card
                      className={
                        selectionModeActive
                          ? "app-agent-center-light-card app-agent-center-light-card--selection"
                          : "app-agent-center-light-card"
                      }
                      key={agent.id}
                    >
                      <div className="app-agent-center-light-card__top">
                        <div className="app-agent-center-light-card__title-block">
                          <div className="app-agent-center-light-card__title-row">
                            <h3 className="app-card-title">{agent.name}</h3>
                            <div className="app-agent-center-card__meta app-agent-center-light-card__meta">
                              <Badge tone={agent.enabled ? "success" : "warning"}>{agent.enabled ? "已启用" : "已停用"}</Badge>
                              <Badge tone="violet">{formatListingStatusLabel(listing?.status)}</Badge>
                              <Badge tone={listing?.autoTakeEnabled ? "warning" : "secondary"}>
                                {listing?.autoTakeEnabled ? "自动接单" : "手动接单"}
                              </Badge>
                            </div>
                          </div>
                          <p className="app-agent-center-light-card__summary">{formatCloudSummary(agent, capability)}</p>
                        </div>
                        {selectionModeActive && batchMode ? (
                          <label className="app-agent-center-light-card__selector">
                            <input name="agentIds" type="checkbox" value={agent.id} />
                            <span>选择</span>
                          </label>
                        ) : (
                          <Link className="nt-btn nt-btn--outline app-agent-center-light-card__edit" href={editHref}>
                            编辑
                          </Link>
                        )}
                      </div>

                      <div className="app-agent-center-light-card__matrix">
                        <div className="app-agent-center-light-card__item">
                          <span>远端鉴权</span>
                          <strong>{formatAuthModeLabel(agent)}</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>接入地址</span>
                          <strong>{formatRuntimeEndpointLabel(agent)}</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>主报价</span>
                          <strong>{formatCloudPriceSummary(listing)}</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>经营</span>
                          <strong>{formatManagedCloudOperationsSummary(listing)}</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>总任务数</span>
                          <strong>{formatAccountNumber(metrics.completedTaskCount)}</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>总收益</span>
                          <strong>{formatRevenueSummary(metrics.totalRevenue)}</strong>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : null}
          </form>
        ) : null}

        {showWorkbench ? (
          <div className="app-agent-center-light-workbench" id="cloud-workbench">
            <div className="app-agent-center-light-workbench__head">
              <div className="app-agent-center-light-workbench__copy">
                <div className="app-agent-center-light-workbench__meta">
                  <Badge tone={editingAgent ? "warning" : "cyan"}>{editingAgent ? "编辑" : "创建"}</Badge>
                  <Badge tone="glass">高智能云端</Badge>
                </div>
                <h3>{editingAgent ? `编辑 ${editingAgent.name}` : "新建云端"}</h3>
              </div>
              <div className="app-agent-center-inline-actions">
                <Link className="nt-btn nt-btn--secondary" href={baseHref}>
                  返回
                </Link>
              </div>
            </div>

            <form action={saveManagedCloudAgentAction} className="app-agent-center-form">
              <input name="redirectTo" type="hidden" value={workbenchHref} />
              <input name="successRedirectTo" type="hidden" value={baseHref} />
              <input name="agentId" type="hidden" value={editingAgent?.id ?? ""} />
              <input name="capabilityId" type="hidden" value={editingCapability?.id ?? ""} />

              <div className="app-agent-center-create-lead">
                <section className="app-agent-center-intro-pane">
                  <div className="app-agent-center-intro-pane__head">
                    <strong>介绍</strong>
                  </div>
                  <div className="app-agent-center-form__split app-agent-center-form__split--triple">
                    <div className="app-agent-center-form__cell">
                      <Input defaultValue={editingAgent?.name ?? ""} name="name" placeholder="名称" required />
                    </div>
                    <div className="app-agent-center-form__cell">
                      <Input
                        defaultValue={editingAgent?.runtimeEndpoint ?? ""}
                        name="runtimeEndpoint"
                        placeholder="远端接口地址"
                        required
                      />
                    </div>
                    <div className="app-agent-center-form__cell">
                      <Select defaultValue={editingAgent?.authMode ?? "none"} name="authMode">
                        <option value="none">无鉴权</option>
                        <option value="apiKey">访问密钥</option>
                        <option value="bearer">Bearer</option>
                      </Select>
                    </div>
                  </div>
                  <div className="app-agent-center-form__split">
                    <Input
                      name="runtimeAuthToken"
                      placeholder={editingAgent ? "远端鉴权凭证（留空则保持当前值）" : "远端鉴权凭证"}
                    />
                  </div>
                  <div className="app-agent-center-create-summary-row">
                    <div className="app-agent-center-create-summary-card">
                      <Textarea
                        defaultValue={editingAgent?.description ?? ""}
                        name="description"
                        placeholder="介绍这个云端智能体擅长解决什么问题，以及你希望平台如何把任务委托给它。"
                        required
                        rows={7}
                      />
                    </div>
                  </div>
                </section>

                <aside className="app-agent-center-pricing-pane">
                  <div className="app-agent-center-pricing-pane__head">
                    <strong>定价</strong>
                  </div>
                  <div className="app-agent-center-pricing-pane__body">
                    <div className="app-agent-center-pricing-pane__row app-agent-center-pricing-pane__row--price">
                      <Input
                        defaultValue={editingListing?.priceAmount ?? 300}
                        min="1"
                        name="listingPriceAmount"
                        placeholder="报价"
                        required
                        type="number"
                      />
                      <TerminalSelectField
                        defaultValue={editingListing?.priceCurrency ?? "obsidian"}
                        name="listingPriceCurrency"
                        options={[
                          {
                            value: "obsidian",
                            label: formatCurrencyLabel("obsidian"),
                            iconSrc: "/assets/currency/obsidian.png",
                          },
                          {
                            value: "mira",
                            label: formatCurrencyLabel("mira"),
                            iconSrc: "/assets/currency/mira.png",
                          },
                        ]}
                        placeholder="货币单位"
                        required
                      />
                    </div>
                    <div className="app-agent-center-pricing-pane__row">
                      <TerminalSelectField
                        defaultValue="flat_task"
                        disabled
                        name="listingBillingMode"
                        options={[{ value: "flat_task", label: "按任务一口价（单个任务）" }]}
                        placeholder="计费方式"
                        required
                      />
                    </div>
                  </div>
                  <div className="app-agent-center-pricing-pane__foot">
                    <button className="nt-btn nt-btn--primary app-agent-center-pricing-pane__submit" type="submit">
                      {editingAgent ? "保存修改" : "确认"}
                    </button>
                  </div>
                </aside>

                <aside className="app-agent-center-operations-pane">
                  <div className="app-agent-center-operations-pane__head">
                    <strong>经营</strong>
                  </div>
                  <div className="app-agent-center-operations-pane__body">
                    <div className="app-agent-center-operations-pane__stats">
                      <div className="app-agent-center-operations-pane__stat">
                        <span>完成任务数</span>
                        <strong>{formatAccountNumber(editingMetrics.completedTaskCount)}</strong>
                      </div>
                      <div className="app-agent-center-operations-pane__stat">
                        <span>总收益</span>
                        <strong>{formatRevenueSummary(editingMetrics.totalRevenue)}</strong>
                      </div>
                    </div>
                    <div className="app-agent-center-operations-pane__toggle">
                      <div className="app-agent-center-operations-toggle app-agent-center-operations-toggle--single">
                        <input name="listingAutoTakeEnabled" type="hidden" value="false" />
                        <input
                          className="app-agent-center-operations-toggle__input"
                          defaultChecked={editingListing?.autoTakeEnabled ?? true}
                          id={autoTakeInputId}
                          name="listingAutoTakeEnabled"
                          type="checkbox"
                          value="true"
                        />
                        <label className="app-agent-center-operations-toggle__single-chip" htmlFor={autoTakeInputId}>
                          <span className="app-agent-center-operations-toggle__state app-agent-center-operations-toggle__state--on">
                            开始接单
                          </span>
                          <span className="app-agent-center-operations-toggle__state app-agent-center-operations-toggle__state--off">
                            关闭接单
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </AccountHomeSection>
  );
}
