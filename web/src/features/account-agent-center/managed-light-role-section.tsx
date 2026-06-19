import Link from "next/link";

import type { AgentCapabilityView, AgentMarketplaceListingView, AgentView } from "@neuro/contracts";

import {
  AccountHomeSection,
} from "@/components/account-home/templates";
import {
  NtBadge as Badge,
  NtCard as Card,
  NtInput as Input,
  NtTextarea as Textarea,
} from "@/components/nt-primitives";
import { formatAccountNumber } from "@/lib/account-center";
import { applyManagedLightAgentBatchAction, saveManagedLightAgentAction } from "@/lib/platform-actions";
import { ResourceContractEditor } from "@/features/account-agent-center/resource-contract-editor";
import {
  ManagedLightServiceBindingFields,
  type ManagedLightModelOption,
} from "@/features/account-agent-center/managed-light-service-binding-fields";
import { TerminalSelectField } from "@/features/account-agent-center/terminal-select-field";

type ManagedLightServiceOption = {
  id: string;
  title: string;
  description?: string | null;
  apiUrl: string | null | undefined;
  providerKey: string | null | undefined;
  modelOptions: ManagedLightModelOption[];
};

type ManagedLightAgentMetrics = {
  completedTaskCount: number;
  totalRevenue: {
    obsidian: number;
    mira: number;
  };
};

type ManagedLightRoleSectionProps = {
  agents: AgentView[];
  capabilitiesByAgentId: Map<string, AgentCapabilityView[]>;
  listingByCapabilityId: Map<string, AgentMarketplaceListingView>;
  managedLightServiceOptions: ManagedLightServiceOption[];
  managedLightServiceTitleById: Map<string, string>;
  metricsByAgentId: Map<string, ManagedLightAgentMetrics>;
  embedded: boolean;
  batchMode: "delete" | "enable" | "disable" | null;
  panel: "create" | "edit" | null;
  editingAgentId: string | null;
};

const lightAgentTaskCategoryOptions = [
  { value: "image_processing", label: "图像处理" },
  { value: "video_processing", label: "视频处理" },
  { value: "audio_processing", label: "音频处理" },
  { value: "text_generation", label: "文本生成" },
  { value: "translation", label: "翻译改写" },
  { value: "coding", label: "代码处理" },
  { value: "data_analysis", label: "数据分析" },
] as const;

function buildLightAgentHref(
  embedded: boolean,
  options?: {
    panel?: "create" | "edit" | null;
    agentId?: string | null;
    batchMode?: "delete" | "enable" | "disable" | null;
    hash?: string;
  },
) {
  const params = new URLSearchParams();
  if (options?.panel) {
    params.set("panel", options.panel);
  }
  if (options?.agentId) {
    params.set("agentId", options.agentId);
  }
  if (options?.batchMode) {
    params.set("batch", options.batchMode);
  }
  if (embedded) {
    params.set("embedded", "1");
  }
  const query = params.toString();
  return `/agents${query ? `?${query}` : ""}${options?.hash ?? ""}`;
}

function formatLightAgentTaskCategoryLabel(value: string | null | undefined) {
  if (!value) {
    return "未定义";
  }
  return lightAgentTaskCategoryOptions.find((option) => option.value === value)?.label ?? value;
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

function formatBillingModeLabel(listing: AgentMarketplaceListingView | null | undefined) {
  if (!listing) {
    return "未定价";
  }
  if (listing.billingMode === "token_metered") {
    return `按 Token / ${formatBillingUnitLabel(listing.billingUnit, "token")}`;
  }
  if (listing.billingMode === "property_metered") {
    return `按属性 / ${
      listing.meterKey ? formatMeterKeyLabel(listing.meterKey) : formatBillingUnitLabel(listing.billingUnit, "property")
    }`;
  }
  return `按任务 / ${formatBillingUnitLabel(listing.billingUnit, "task")}`;
}

function formatBillingUnitLabel(value: string | null | undefined, fallback: "task" | "token" | "property") {
  const normalized = value?.trim() || fallback;
  if (normalized === "task") return "单个任务";
  if (normalized === "1k_tokens") return "千 Token";
  if (normalized === "task_units") return "任务属性";
  if (normalized === "task_property") return "单项属性";
  if (normalized === "durationSeconds") return "时长秒数";
  return normalized;
}

function formatMeterKeyLabel(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return "任务属性";
  if (normalized === "task_units") return "任务属性";
  if (normalized === "durationSeconds") return "时长秒数";
  return normalized;
}

function formatListingStatusLabel(status: AgentMarketplaceListingView["status"] | null | undefined) {
  if (status === "published") return "已公开";
  if (status === "paused") return "已暂停";
  if (status === "draft") return "草稿";
  return "未创建";
}

function buildLightAgentServiceDescription(service: ManagedLightServiceOption) {
  if (service.description?.trim()) {
    return service.description.trim();
  }
  const provider = service.providerKey?.trim();
  const endpoint = service.apiUrl?.trim();
  if (provider && endpoint) {
    try {
      return `${provider} / ${new URL(endpoint).host}`;
    } catch {
      return provider;
    }
  }
  return provider || null;
}

function formatManagedLightBindingSummary(args: {
  managedModel: string | null | undefined;
  managedServiceId: string | null | undefined;
  managedLightServiceTitleById: Map<string, string>;
}) {
  const serviceTitle = args.managedLightServiceTitleById.get(args.managedServiceId ?? "") || "未配置";
  if (serviceTitle === "未配置") {
    return serviceTitle;
  }
  return `${serviceTitle} / ${args.managedModel?.trim() || "默认 gpt-4.1-mini"}`;
}

function formatManagedLightBatchLabel(batchMode: "delete" | "enable" | "disable") {
  if (batchMode === "delete") {
    return "删除";
  }
  if (batchMode === "enable") {
    return "启用";
  }
  return "停用";
}

function formatManagedLightBatchConfirmLabel(batchMode: "delete" | "enable" | "disable") {
  if (batchMode === "delete") {
    return "确认删除";
  }
  if (batchMode === "enable") {
    return "确认启用";
  }
  return "确认停用";
}

export function ManagedLightRoleSection({
  agents,
  capabilitiesByAgentId,
  listingByCapabilityId,
  managedLightServiceOptions,
  managedLightServiceTitleById,
  metricsByAgentId,
  embedded,
  batchMode,
  panel,
  editingAgentId,
}: ManagedLightRoleSectionProps) {
  const baseHref = buildLightAgentHref(embedded, { hash: "#role-light" });
  const createHref = buildLightAgentHref(embedded, { panel: "create", hash: "#light-workbench" });
  const editingAgent = panel === "edit" && editingAgentId ? agents.find((agent) => agent.id === editingAgentId) ?? null : null;
  const editingCapability = editingAgent ? (capabilitiesByAgentId.get(editingAgent.id) ?? [])[0] ?? null : null;
  const editingListing = editingCapability ? listingByCapabilityId.get(editingCapability.id) ?? null : null;
  const showWorkbench = panel === "create" || Boolean(editingAgent);
  const showOverview = !showWorkbench;
  const editingServiceId = editingAgent?.managedServiceId ?? "";
  const serviceOptions =
    editingServiceId && !managedLightServiceOptions.some((service) => service.id === editingServiceId)
      ? [
          {
            id: editingServiceId,
            title: managedLightServiceTitleById.get(editingServiceId) ?? "当前 AI 凭证",
            apiUrl: null,
            providerKey: null,
            modelOptions: editingAgent?.managedModel
              ? [
                  {
                    value: editingAgent.managedModel,
                    label: editingAgent.managedModel,
                    description: "当前绑定",
                  },
                ]
              : [],
          },
          ...managedLightServiceOptions,
        ]
      : managedLightServiceOptions;
  const workbenchHref =
    panel === "edit" && editingAgent
      ? buildLightAgentHref(embedded, {
          panel: "edit",
          agentId: editingAgent.id,
          hash: "#light-workbench",
        })
      : createHref;
  const autoTakeInputId = editingAgent ? `listing-auto-take-enabled-${editingAgent.id}` : "listing-auto-take-enabled-new";
  const batchRedirectHref = batchMode ? buildLightAgentHref(embedded, { batchMode, hash: "#role-light" }) : baseHref;
  const selectionModeActive = batchMode !== null;
  const editingMetrics =
    (editingAgent ? metricsByAgentId.get(editingAgent.id) : null) ?? {
      completedTaskCount: 0,
      totalRevenue: { obsidian: 0, mira: 0 },
    };

  return (
    <>
      {showOverview ? (
        <AccountHomeSection className="app-agent-center-section--roles app-agent-center-light-overview" id="role-light">
          {agents.length > 0 ? (
            <form action={applyManagedLightAgentBatchAction} className="app-agent-center-light-overview-layout">
              <input name="redirectTo" type="hidden" value={batchRedirectHref} />
              <input name="successRedirectTo" type="hidden" value={baseHref} />
              {batchMode ? <input name="batchAction" type="hidden" value={batchMode} /> : null}

              <div className="app-agent-center-light-toolbar">
                <div className="app-agent-center-light-opbar__stack app-agent-center-light-opbar__stack--inline">
                  {selectionModeActive && batchMode ? (
                    <>
                      <button className="nt-btn nt-btn--primary app-agent-center-light-opbar__button" type="submit">
                        {formatManagedLightBatchConfirmLabel(batchMode)}
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
                      <Link
                        className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                        href={buildLightAgentHref(embedded, { batchMode: "delete", hash: "#role-light" })}
                      >
                        删除
                      </Link>
                      <Link
                        className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                        href={buildLightAgentHref(embedded, { batchMode: "enable", hash: "#role-light" })}
                      >
                        启用
                      </Link>
                      <Link
                        className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                        href={buildLightAgentHref(embedded, { batchMode: "disable", hash: "#role-light" })}
                      >
                        停用
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className="app-agent-center-light-grid">
                {agents.map((agent) => {
                  const capability = (capabilitiesByAgentId.get(agent.id) ?? [])[0] ?? null;
                  const listing = capability ? listingByCapabilityId.get(capability.id) ?? null : null;
                  const metrics = metricsByAgentId.get(agent.id) ?? {
                    completedTaskCount: 0,
                    totalRevenue: { obsidian: 0, mira: 0 },
                  };
                  const editHref = buildLightAgentHref(embedded, {
                    panel: "edit",
                    agentId: agent.id,
                    hash: "#light-workbench",
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
                          <p className="app-agent-center-light-card__summary">
                            {agent.managedCapabilitySummary || agent.description || "尚未填写能力短语。"}
                          </p>
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
                          <span>处理类别</span>
                          <strong>{formatLightAgentTaskCategoryLabel(agent.managedTaskCategory)}</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>AI 凭证</span>
                          <strong>
                            {formatManagedLightBindingSummary({
                              managedModel: agent.managedModel,
                              managedServiceId: agent.managedServiceId,
                              managedLightServiceTitleById,
                            })}
                          </strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>主报价</span>
                          <strong>
                            {listing ? `${listing.priceAmount} ${formatCurrencyLabel(listing.priceCurrency)}` : "未定价"}
                          </strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>计费方式</span>
                          <strong>{formatBillingModeLabel(listing)}</strong>
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
            </form>
          ) : (
            <div className="app-agent-center-light-empty-stage">
              <Card className="app-agent-center-light-launchpad">
                <div className="app-agent-center-light-launchpad__meta">
                  <Badge tone="cyan">0 个羽量</Badge>
                  <Badge tone="glass">单任务</Badge>
                  <Badge tone="glass">隐藏提示词</Badge>
                </div>
                <div className="app-agent-center-light-launchpad__layout">
                  <div className="app-agent-center-light-launchpad__body">
                    <strong>未创建</strong>
                    <div className="app-agent-center-light-launchpad__chips">
                      <Badge tone="secondary">输入资源</Badge>
                      <Badge tone="secondary">输出资源</Badge>
                      <Badge tone="secondary">提示词</Badge>
                    </div>
                  </div>
                  <div className="app-agent-center-inline-actions">
                    <Link className="nt-btn nt-btn--primary" href={createHref}>
                      新建羽量
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </AccountHomeSection>
      ) : null}

      {showWorkbench ? (
        <AccountHomeSection className="app-agent-center-section--roles" id="light-workbench">
          <div className="app-agent-center-light-workbench">
            <div className="app-agent-center-light-workbench__head">
              <div className="app-agent-center-light-workbench__copy">
                <div className="app-agent-center-light-workbench__meta">
                  <Badge tone={editingAgent ? "warning" : "cyan"}>{editingAgent ? "编辑" : "新建"}</Badge>
                  <Badge tone="glass">仅自己可见</Badge>
                </div>
                <h3>{editingAgent ? `编辑 ${editingAgent.name}` : "新建羽量"}</h3>
              </div>
              <div className="app-agent-center-inline-actions">
                <Link className="nt-btn nt-btn--secondary" href={baseHref}>
                  返回
                </Link>
              </div>
            </div>

            <form action={saveManagedLightAgentAction} className="app-agent-center-form">
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
                      <ManagedLightServiceBindingFields
                        defaultModel={editingAgent?.managedModel ?? null}
                        defaultServiceId={editingServiceId || serviceOptions[0]?.id || ""}
                        serviceOptions={serviceOptions.map((service) => ({
                          id: service.id,
                          title: service.title,
                          description: buildLightAgentServiceDescription(service),
                          modelOptions: service.modelOptions,
                        }))}
                      />
                    </div>
                    <div className="app-agent-center-form__cell">
                      <TerminalSelectField
                        defaultValue={editingAgent?.managedTaskCategory ?? ""}
                        name="managedTaskCategory"
                        options={lightAgentTaskCategoryOptions.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        placeholder="选择能力"
                        required
                      />
                    </div>
                  </div>
                  <div className="app-agent-center-create-summary-row">
                    <div className="app-agent-center-create-summary-card">
                      <Textarea
                        defaultValue={editingAgent?.managedCapabilitySummary ?? ""}
                        name="managedCapabilitySummary"
                        placeholder="能力短语，例如：擅长生成吉卜力风格方形插画，保留细腻油画笔触。"
                        required
                        rows={2}
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
                        defaultValue={editingListing?.billingMode ?? "flat_task"}
                        name="listingBillingMode"
                        options={[
                          { value: "flat_task", label: "按任务一口价（单个任务）" },
                          { value: "token_metered", label: "按 Token 计费（千 Token）" },
                        ]}
                        placeholder="计费方式"
                        required
                      />
                    </div>
                  </div>
                  <div className="app-agent-center-pricing-pane__foot">
                    <button
                      className="nt-btn nt-btn--primary app-agent-center-pricing-pane__submit"
                      disabled={serviceOptions.length === 0}
                      type="submit"
                    >
                      {editingAgent ? "保存修改" : "创建羽量智能体"}
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

              <div className="app-agent-center-create-composer">
                <section className="app-agent-center-create-pane">
                  <div className="app-agent-center-create-pane__head">
                    <strong>输入资源</strong>
                  </div>
                  <ResourceContractEditor
                    initialSchema={editingCapability?.inputSchema ?? null}
                    prefix="input"
                    showTitle={false}
                    title="输入资源"
                  />
                </section>

                <section className="app-agent-center-create-pane app-agent-center-create-pane--prompt">
                  <div className="app-agent-center-create-pane__stack">
                    <div className="app-agent-center-create-pane__slot">
                      <div className="app-agent-center-create-pane__head">
                        <strong>系统提示词</strong>
                      </div>
                      <Textarea
                        defaultValue={editingAgent?.managedSystemPrompt ?? ""}
                        name="managedSystemPrompt"
                        placeholder="系统提示词"
                        rows={10}
                      />
                    </div>
                    <div className="app-agent-center-create-pane__slot">
                      <div className="app-agent-center-create-pane__head">
                        <strong>提示词模板</strong>
                      </div>
                      <Textarea
                        defaultValue={editingAgent?.managedPromptTemplate ?? ""}
                        name="managedPromptTemplate"
                        placeholder="提示词模板"
                        required
                        rows={10}
                      />
                    </div>
                  </div>
                </section>

                <section className="app-agent-center-create-pane">
                  <div className="app-agent-center-create-pane__head">
                    <strong>输出资源</strong>
                  </div>
                  <ResourceContractEditor
                    initialSchema={editingCapability?.outputSchema ?? null}
                    prefix="output"
                    showTitle={false}
                    title="输出资源"
                  />
                </section>
              </div>
            </form>
          </div>
        </AccountHomeSection>
      ) : null}
    </>
  );
}
