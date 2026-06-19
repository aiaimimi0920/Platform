"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

import { selectShowcasedAgents } from "../shared";
import type { AccountHonorPanelData } from "../types";

function InlineDialogCloseIcon() {
  return (
    <svg aria-hidden="true" className="app-account-honor-inline-dialog__close-icon" viewBox="0 0 24 24">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export type UseAgentShowcaseConfigProps = Pick<AccountHonorPanelData, "agentCatalog" | "agentShowcase">;

export function useAgentShowcaseConfig({ agentCatalog, agentShowcase }: UseAgentShowcaseConfigProps) {
  const [agentConfigOpen, setAgentConfigOpen] = useState(false);
  const [visibleAgentShowcase, setVisibleAgentShowcase] = useState(agentShowcase);
  const [agentDraftIds, setAgentDraftIds] = useState(agentShowcase.map((agent) => agent.id));
  const [savingAgentShowcase, setSavingAgentShowcase] = useState(false);
  const [agentShowcaseError, setAgentShowcaseError] = useState<string | null>(null);

  useEffect(() => {
    setVisibleAgentShowcase(agentShowcase);
    setAgentDraftIds(agentShowcase.map((agent) => agent.id));
  }, [agentShowcase]);

  useEffect(() => {
    if (!agentConfigOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAgentConfigOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [agentConfigOpen]);

  function openAgentConfig() {
    setAgentDraftIds(visibleAgentShowcase.map((agent) => agent.id));
    setAgentShowcaseError(null);
    setAgentConfigOpen(true);
  }

  function toggleAgentDraft(agentId: string) {
    setAgentShowcaseError(null);
    setAgentDraftIds((current) => {
      if (current.includes(agentId)) {
        return current.filter((entry) => entry !== agentId);
      }

      if (current.length >= 4) {
        setAgentShowcaseError("最多展示 4 个智能体");
        return current;
      }

      return [...current, agentId];
    });
  }

  async function handleSaveAgentShowcase() {
    if (savingAgentShowcase) {
      return;
    }

    setSavingAgentShowcase(true);
    setAgentShowcaseError(null);

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedAgentIds: agentDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "展示智能体保存失败");
      }

      setVisibleAgentShowcase(selectShowcasedAgents(agentCatalog, agentDraftIds));
      setAgentConfigOpen(false);
    } catch (error) {
      setAgentShowcaseError(error instanceof Error ? error.message : "展示智能体保存失败");
    } finally {
      setSavingAgentShowcase(false);
    }
  }

  const agentConfigDialog =
    agentConfigOpen && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              aria-label="关闭智能体展示配置"
              className="app-account-honor-inline-dialog__backdrop"
              onClick={() => setAgentConfigOpen(false)}
              type="button"
            />
            <div
              aria-label="智能体展示配置"
              aria-modal="true"
              className="app-account-honor-inline-dialog app-account-honor-inline-dialog--agent-config"
              role="dialog"
            >
              <div className="app-account-honor-inline-dialog__head">
                <span className="mg-terminal-kicker">展示智能体</span>
                <button
                  aria-label="关闭智能体展示配置"
                  className="app-account-honor-inline-dialog__close"
                  onClick={() => setAgentConfigOpen(false)}
                  type="button"
                >
                  <InlineDialogCloseIcon />
                </button>
              </div>

              <div className="app-account-honor-agent-config__summary">
                <span>最多展示 4 个智能体</span>
                <strong>{`${agentDraftIds.length}/4`}</strong>
              </div>

              {agentShowcaseError ? <p className="app-account-honor-agent-config__error">{agentShowcaseError}</p> : null}

              <div className="app-account-honor-agent-config__list">
                {agentCatalog.map((agent) => {
                  const selected = agentDraftIds.includes(agent.id);

                  return (
                    <button
                      className={cn(
                        "app-account-honor-agent-config__option",
                        selected && "app-account-honor-agent-config__option--selected",
                      )}
                      key={agent.id}
                      onClick={() => toggleAgentDraft(agent.id)}
                      type="button"
                    >
                      <div className="app-account-honor-agent-config__option-copy">
                        <strong>{agent.name}</strong>
                        <span>{agent.direction}</span>
                      </div>
                      <span className="app-account-honor-agent-config__option-state">
                        {selected ? "已展示" : agent.enabled ? "可展示" : "未启用"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="app-account-honor-agent-config__actions">
                <button
                  className="app-account-honor-agent-config__secondary"
                  onClick={() => setAgentConfigOpen(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="app-account-honor-agent-config__primary"
                  disabled={savingAgentShowcase}
                  onClick={() => void handleSaveAgentShowcase()}
                  type="button"
                >
                  {savingAgentShowcase ? "保存中" : "保存展示"}
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return {
    agentConfigDialog,
    openAgentConfig,
    visibleAgentShowcase,
  };
}
