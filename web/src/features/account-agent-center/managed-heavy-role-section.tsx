import Link from "next/link";

import type { AgentView } from "@neuro/contracts";

import { AccountHomeSection } from "@/components/account-home/templates";
import {
  NtBadge as Badge,
  NtCard as Card,
  NtInput as Input,
  NtTextarea as Textarea,
} from "@/components/nt-primitives";
import { formatAccountNumber } from "@/lib/account-center";
import {
  applyManagedHeavyAgentBatchAction,
  saveManagedHeavyAgentAction,
} from "@/lib/platform-actions";

import { MimiExtensionsEditor } from "./mimi-extensions-editor";

type ManagedHeavyRoleSectionProps = {
  agents: AgentView[];
  embedded: boolean;
  selfHref: string;
  batchMode: "delete" | "enable" | "disable" | null;
  panel: "create" | "edit" | null;
  editingAgentId: string | null;
  storeVisible: boolean;
};

const DEFAULT_HEAVY_SLOT_ID = "slot-default-heavy";
const MANAGED_HEAVY_TOTAL_SLOT_LIMIT = 2;

function buildHeavyChatHref(slotId: string) {
  const params = new URLSearchParams();
  params.set("slotId", slotId);
  return `/chat?${params.toString()}`;
}

function buildHeavyHref(
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

function formatManagedHeavyBatchConfirmLabel(batchMode: "delete" | "enable" | "disable") {
  if (batchMode === "delete") {
    return "确认删除";
  }
  if (batchMode === "enable") {
    return "确认启用";
  }
  return "确认停用";
}

function formatManagedHeavyCompatibilityLabel(agent: AgentView) {
  return agent.hostingMode === "registry_only" ? "兼容槽位" : "自创建槽位";
}

export function ManagedHeavyRoleSection({
  agents,
  embedded,
  selfHref,
  batchMode,
  panel,
  editingAgentId,
  storeVisible,
}: ManagedHeavyRoleSectionProps) {
  const topNavTarget = embedded ? "_top" : undefined;
  const baseHref = buildHeavyHref(selfHref, { hash: "#role-heavy" });
  const createHref = buildHeavyHref(selfHref, { panel: "create", hash: "#heavy-workbench" });
  const editingAgent = panel === "edit" && editingAgentId
    ? agents.find((agent) => agent.id === editingAgentId) ?? null
    : null;
  const showWorkbench = panel === "create" || Boolean(editingAgent);
  const showOverview = !showWorkbench;
  const selectionModeActive = batchMode !== null;
  const workbenchHref = panel === "edit" && editingAgent
    ? buildHeavyHref(selfHref, {
        panel: "edit",
        agentId: editingAgent.id,
        hash: "#heavy-workbench",
      })
    : createHref;
  const batchRedirectHref = batchMode
    ? buildHeavyHref(selfHref, { batchMode, hash: "#role-heavy" })
    : baseHref;
  const currentHeavySlotCount = agents.length + 1;
  const currentHeavySlotSummary = `${formatAccountNumber(currentHeavySlotCount)} / ${MANAGED_HEAVY_TOTAL_SLOT_LIMIT}`;
  const canCreateCustomSlot = currentHeavySlotCount < MANAGED_HEAVY_TOTAL_SLOT_LIMIT;
  const workbenchDisabledMessage =
    !editingAgent && !canCreateCustomSlot
      ? "当前仅允许 1 个自创建重度槽位，更多槽位请先购买。"
      : null;
  const defaultHeavyChatHref = buildHeavyChatHref(DEFAULT_HEAVY_SLOT_ID);

  return (
    <>
      {showOverview ? (
        <AccountHomeSection className="app-agent-center-section--roles app-agent-center-light-overview" id="role-heavy">
          <form action={applyManagedHeavyAgentBatchAction} className="app-agent-center-heavy-overview-layout">
            <input name="redirectTo" type="hidden" value={batchRedirectHref} />
            <input name="successRedirectTo" type="hidden" value={baseHref} />
            {batchMode ? <input name="batchAction" type="hidden" value={batchMode} /> : null}

            <div className="app-agent-center-light-toolbar app-agent-center-heavy-overview-toolbar">
              <div className="app-agent-center-light-opbar__stack app-agent-center-light-opbar__stack--inline">
                {selectionModeActive && batchMode && agents.length > 0 ? (
                  <>
                    <button className="nt-btn nt-btn--primary app-agent-center-light-opbar__button" type="submit">
                      {formatManagedHeavyBatchConfirmLabel(batchMode)}
                    </button>
                    <Link className="nt-btn nt-btn--secondary app-agent-center-light-opbar__button" href={baseHref}>
                      取消
                    </Link>
                  </>
                ) : (
                  <>
                    {canCreateCustomSlot ? (
                      <Link className="nt-btn nt-btn--primary app-agent-center-light-opbar__button" href={createHref}>
                        新建
                      </Link>
                    ) : (
                      <button className="nt-btn nt-btn--primary app-agent-center-light-opbar__button" disabled type="button">
                        新建
                      </button>
                    )}
                    {agents.length > 0 ? (
                      <>
                        <Link
                          className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                          href={buildHeavyHref(selfHref, { batchMode: "delete", hash: "#role-heavy" })}
                        >
                          删除
                        </Link>
                        <Link
                          className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                          href={buildHeavyHref(selfHref, { batchMode: "enable", hash: "#role-heavy" })}
                        >
                          启用
                        </Link>
                        <Link
                          className="nt-btn nt-btn--outline app-agent-center-light-opbar__button"
                          href={buildHeavyHref(selfHref, { batchMode: "disable", hash: "#role-heavy" })}
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

              <div className="app-agent-center-heavy-toolbar-slot">
                <div className="app-agent-center-heavy-toolbar-slot__stat">
                  <span>当前槽位</span>
                  <strong>{currentHeavySlotSummary}</strong>
                </div>
                {storeVisible ? (
                  <Link
                    className="nt-btn nt-btn--outline app-agent-center-heavy-toolbar-slot__button"
                    href="/products"
                    target={topNavTarget}
                  >
                    购买槽位
                  </Link>
                ) : null}
              </div>
            </div>

            {workbenchDisabledMessage ? (
              <p className="app-agent-center-note">{workbenchDisabledMessage}</p>
            ) : null}

            <div className="app-agent-center-heavy-overview-surface">
              <div className="app-agent-center-light-grid app-agent-center-light-grid--heavy-default">
                <MimiExtensionsEditor openHref={defaultHeavyChatHref} target={topNavTarget} />

                {agents.map((agent) => {
                  const editHref = buildHeavyHref(selfHref, {
                    panel: "edit",
                    agentId: agent.id,
                    hash: "#heavy-workbench",
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
                              <Badge tone="violet">{formatManagedHeavyCompatibilityLabel(agent)}</Badge>
                            </div>
                          </div>
                          <p className="app-agent-center-light-card__summary">
                            {agent.description || "该自创建重度槽位用于承接长期上下文、专属人格与深度工作流。"}
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
                          <span>槽位类型</span>
                          <strong>{formatManagedHeavyCompatibilityLabel(agent)}</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>运行模式</span>
                          <strong>平台重度</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>当前状态</span>
                          <strong>{agent.enabled ? "可在重度终端承接工作" : "已停用，避免被继续调度"}</strong>
                        </div>
                        <div className="app-agent-center-light-card__item">
                          <span>产品边界</span>
                          <strong>消息流仍统一收口在 /chat</strong>
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {agents.length === 0 ? (
                  <Card className="app-agent-center-light-card">
                    <div className="app-agent-center-light-card__top">
                      <div className="app-agent-center-light-card__title-block">
                        <div className="app-agent-center-light-card__title-row">
                          <h3 className="app-card-title">自创建重度槽位</h3>
                          <div className="app-agent-center-card__meta app-agent-center-light-card__meta">
                            <Badge tone="glass">尚未创建</Badge>
                          </div>
                        </div>
                        <p className="app-agent-center-light-card__summary">
                          默认觅觅固定保留；如需专属长期上下文，可先创建一个自定义重度槽位。
                        </p>
                      </div>
                    </div>
                    <div className="app-agent-center-light-card__matrix">
                      <div className="app-agent-center-light-card__item">
                        <span>自创建容量</span>
                        <strong>当前空闲 1 个</strong>
                      </div>
                      <div className="app-agent-center-light-card__item">
                        <span>扩容方式</span>
                        <strong>购买更多槽位</strong>
                      </div>
                    </div>
                  </Card>
                ) : null}
              </div>
            </div>
          </form>
        </AccountHomeSection>
      ) : null}

      {showWorkbench ? (
        <AccountHomeSection className="app-agent-center-section--roles" id="heavy-workbench">
          <div className="app-agent-center-light-workbench">
            <div className="app-agent-center-light-workbench__head">
              <div className="app-agent-center-light-workbench__copy">
                <div className="app-agent-center-light-workbench__meta">
                  <Badge tone={editingAgent ? "warning" : "cyan"}>{editingAgent ? "编辑" : "新建"}</Badge>
                  <Badge tone="glass">默认觅觅固定保留</Badge>
                </div>
                <h3>{editingAgent ? `编辑 ${editingAgent.name}` : "新建重度槽位"}</h3>
              </div>
              <div className="app-agent-center-inline-actions">
                <Link className="nt-btn nt-btn--secondary" href={baseHref}>
                  返回
                </Link>
              </div>
            </div>

            <form action={saveManagedHeavyAgentAction} className="app-agent-center-form">
              <input name="redirectTo" type="hidden" value={workbenchHref} />
              <input name="successRedirectTo" type="hidden" value={baseHref} />
              <input name="agentId" type="hidden" value={editingAgent?.id ?? ""} />

              <div className="app-agent-center-create-lead">
                <section className="app-agent-center-intro-pane">
                  <div className="app-agent-center-intro-pane__head">
                    <strong>介绍</strong>
                  </div>
                  <div className="app-agent-center-form__split">
                    <Input defaultValue={editingAgent?.name ?? ""} name="name" placeholder="名称" required />
                  </div>
                  <Textarea
                    defaultValue={editingAgent?.description ?? ""}
                    name="description"
                    placeholder="描述这个重度槽位负责承接的长期上下文、人格边界或任务类型。"
                    rows={5}
                  />
                  <label className="app-agent-center-checkbox app-agent-center-checkbox--leading">
                    <input
                      defaultChecked={editingAgent ? editingAgent.enabled : true}
                      name="enabled"
                      type="checkbox"
                      value="true"
                    />
                    <span>允许该自创建重度槽位继续被使用</span>
                  </label>
                  {workbenchDisabledMessage ? (
                    <p className="app-agent-center-note">{workbenchDisabledMessage}</p>
                  ) : null}
                  <div className="app-agent-center-inline-actions">
                    <button
                      className="nt-btn nt-btn--primary"
                      disabled={Boolean(workbenchDisabledMessage)}
                      type="submit"
                    >
                      {editingAgent ? "保存重度槽位" : "创建重度槽位"}
                    </button>
                    {storeVisible ? (
                      <Link className="nt-btn nt-btn--outline" href="/products" target={topNavTarget}>
                        购买槽位
                      </Link>
                    ) : null}
                  </div>
                </section>
              </div>
            </form>
          </div>
        </AccountHomeSection>
      ) : null}
    </>
  );
}
