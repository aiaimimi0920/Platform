import Link from "next/link";

import type { AgentView } from "@neuro/contracts";

import { AccountHomeSection } from "@/components/account-home/templates";
import { formatAccountNumber } from "@/lib/account-center";

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

function buildHeavyChatHref(slotId: string) {
  const params = new URLSearchParams();
  params.set("slotId", slotId);
  return `/chat?${params.toString()}`;
}

export function ManagedHeavyRoleSection({
  agents: _agents,
  embedded,
  selfHref: _selfHref,
  batchMode: _batchMode,
  panel: _panel,
  editingAgentId: _editingAgentId,
  storeVisible,
}: ManagedHeavyRoleSectionProps) {
  const topNavTarget = embedded ? "_top" : undefined;
  const currentHeavySlotSummary = `${formatAccountNumber(1)} / 2`;
  const defaultHeavyChatHref = buildHeavyChatHref(DEFAULT_HEAVY_SLOT_ID);

  return (
    <AccountHomeSection className="app-agent-center-section--roles app-agent-center-light-overview" id="role-heavy">
      <div className="app-agent-center-heavy-overview-layout">
        <div className="app-agent-center-light-toolbar app-agent-center-heavy-overview-toolbar">
          <div className="app-agent-center-light-opbar__stack app-agent-center-light-opbar__stack--inline">
            <button className="nt-btn nt-btn--primary app-agent-center-light-opbar__button" disabled type="button">
              新建
            </button>
            <button className="nt-btn nt-btn--outline app-agent-center-light-opbar__button" disabled type="button">
              删除
            </button>
            <button className="nt-btn nt-btn--outline app-agent-center-light-opbar__button" disabled type="button">
              启用
            </button>
            <button className="nt-btn nt-btn--outline app-agent-center-light-opbar__button" disabled type="button">
              停用
            </button>
          </div>

          <div className="app-agent-center-heavy-toolbar-slot">
            <div className="app-agent-center-heavy-toolbar-slot__stat">
              <span>当前槽位</span>
              <strong>{currentHeavySlotSummary}</strong>
            </div>
            {storeVisible ? (
              <Link className="nt-btn nt-btn--outline app-agent-center-heavy-toolbar-slot__button" href="/products" target={topNavTarget}>
                购买槽位
              </Link>
            ) : null}
          </div>
        </div>

        <div className="app-agent-center-heavy-overview-surface">
          <div className="app-agent-center-light-grid app-agent-center-light-grid--heavy-default">
            <MimiExtensionsEditor openHref={defaultHeavyChatHref} target={topNavTarget} />
          </div>
        </div>
      </div>
    </AccountHomeSection>
  );
}
