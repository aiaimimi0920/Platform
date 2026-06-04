"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import {
  AccountHonorArchiveSection,
  AccountHonorExecutionPanel,
} from "./account-honor-panel";
import type { AccountHonorCenterProps } from "./types";

type AccountHonorCenterInternalProps = AccountHonorCenterProps & {
  hideTrigger?: boolean;
  openSignal?: number;
};

function ArchiveIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-trigger__icon" viewBox="0 0 24 24">
      <path
        d="M6 4.5h9l3 3v12H6z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M15 4.5v3h3"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9 11h6M9 15h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-close__icon" viewBox="0 0 24 24">
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

function EditIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-inline-action__icon" viewBox="0 0 24 24">
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M12.8 6.7 17.3 11.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-inline-action__icon" viewBox="0 0 24 24">
      <path
        d="m5.5 12.5 4 4 9-9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function renderHonorAvatar(avatarUrl: string | null, fallback: string) {
  if (avatarUrl) {
    return (
      <div className="app-honor__avatar">
        <img alt="account avatar" className="app-honor__avatar-image" src={avatarUrl} />
      </div>
    );
  }

  return <div className="app-honor__avatar app-honor__avatar--fallback">{fallback}</div>;
}

function buildHonorRankLabel(
  progression: AccountHonorCenterProps["progression"],
  trustLevel: number | null,
) {
  if (progression) {
    return `${progression.level}kyu`;
  }

  if (trustLevel !== null) {
    return `${trustLevel}kyu`;
  }

  return "UNRANKED";
}

export function AccountHonorCenter({
  accountAvatarUrl,
  accountDisplayName,
  profileTagline,
  abilityMetrics,
  activityHeatmap,
  agentCatalog,
  agentShowcase,
  projectCatalog,
  projectShowcase,
  investmentProjectCatalog,
  sponsorshipSummary,
  issueCatalog,
  issueShowcase,
  investmentIssueCatalog,
  issueSupportSummary,
  progression,
  taskPerformance,
  trustLevel,
  hideTrigger = false,
  openSignal,
}: AccountHonorCenterInternalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const taglineInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [taglineValue, setTaglineValue] = useState(profileTagline ?? "");
  const [taglineDraft, setTaglineDraft] = useState(profileTagline ?? "");
  const [editingTagline, setEditingTagline] = useState(false);
  const [savingTagline, setSavingTagline] = useState(false);
  const [taglineError, setTaglineError] = useState<string | null>(null);
  const titleId = useId();
  const fallback = accountDisplayName.slice(0, 1).toUpperCase();
  const rankLabel = buildHonorRankLabel(progression, trustLevel);

  useEffect(() => {
    const nextTagline = profileTagline ?? "";
    setTaglineValue(nextTagline);
    setTaglineDraft(nextTagline);
  }, [profileTagline]);

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    return acquireBodyOverlayLock();
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (wasOpenRef.current) {
      triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (typeof openSignal === "number" && openSignal > 0) {
      setOpen(true);
    }
  }, [openSignal]);

  useEffect(() => {
    if (editingTagline) {
      taglineInputRef.current?.focus();
      taglineInputRef.current?.select();
    }
  }, [editingTagline]);

  async function handleTaglineSave() {
    if (savingTagline) {
      return;
    }

    setSavingTagline(true);
    setTaglineError(null);

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileTagline: taglineDraft.trim() ? taglineDraft : null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: { profileTagline?: string | null } | null; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "保存失败");
      }

      const nextTagline = payload?.user?.profileTagline ?? "";
      setTaglineValue(nextTagline);
      setTaglineDraft(nextTagline);
      setEditingTagline(false);
    } catch (error) {
      setTaglineError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingTagline(false);
    }
  }

  function handleTaglineCancel() {
    setEditingTagline(false);
    setTaglineDraft(taglineValue);
    setTaglineError(null);
  }

  return (
    <>
      {!hideTrigger ? (
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          className="app-honor-trigger"
          onClick={handleOpen}
          ref={triggerButtonRef}
          type="button"
        >
          <span className="app-honor-trigger__copy">
            <ArchiveIcon />
            <span>档案</span>
          </span>
        </button>
      ) : null}

      {open ? (
        <div aria-labelledby={titleId} aria-modal="true" className="app-honor-overlay" role="dialog">
          <button
            aria-label="关闭角色档案"
            className="app-honor-backdrop"
            onClick={handleClose}
            type="button"
          />

          <section className="app-honor">
            <aside className="app-honor__rail">
              <div className="app-honor__rail-head">
                <div className="app-honor__rail-mark" aria-hidden="true">
                  <ArchiveIcon />
                </div>
                <div className="app-honor__rail-copy">
                  <h2 id={titleId}>档案</h2>
                </div>
              </div>

              <div className="app-honor__rail-profile">
                {renderHonorAvatar(accountAvatarUrl, fallback)}
                <div className="app-honor__rail-profile-copy">
                  <div className="app-honor__identity-row">
                    <span className="app-honor__rank-tag">{rankLabel}</span>
                    <strong className="app-honor__rail-name">{accountDisplayName}</strong>
                  </div>
                  {editingTagline ? (
                    <div className="app-honor__tagline-editor">
                      <input
                        className="app-honor__tagline-input"
                        maxLength={80}
                        onChange={(event) => setTaglineDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleTaglineSave();
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            handleTaglineCancel();
                          }
                        }}
                        placeholder="签名"
                        ref={taglineInputRef}
                        value={taglineDraft}
                      />
                      <div className="app-honor__tagline-actions">
                        <button
                          aria-label="保存签名"
                          className="app-honor-inline-action app-honor-inline-action--confirm"
                          disabled={savingTagline}
                          onClick={() => void handleTaglineSave()}
                          type="button"
                        >
                          <CheckIcon />
                        </button>
                        <button
                          aria-label="取消签名编辑"
                          className="app-honor-inline-action"
                          disabled={savingTagline}
                          onClick={handleTaglineCancel}
                          type="button"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="app-honor__tagline-row">
                      <div
                        className={cn("app-honor__tagline", !taglineValue && "app-honor__tagline--empty")}
                        title={taglineValue || "未设签名"}
                      >
                        {taglineValue || "未设签名"}
                      </div>
                      <button
                        aria-label="编辑签名"
                        className="app-honor-inline-action"
                        onClick={() => {
                          setTaglineError(null);
                          setEditingTagline(true);
                        }}
                        type="button"
                      >
                        <EditIcon />
                      </button>
                    </div>
                  )}
                  {taglineError ? <div className="app-honor__tagline-status">{taglineError}</div> : null}
                </div>
              </div>

              <div className="app-honor__rail-stack">
                <AccountHonorExecutionPanel
                  agentCatalog={agentCatalog}
                  agentShowcase={agentShowcase}
                  className="app-honor__rail-execution"
                  taskPerformance={taskPerformance}
                />
              </div>
            </aside>

            <div className="app-honor__content">
              <button
                aria-label="关闭角色档案"
                className="app-honor-close"
                onClick={handleClose}
                ref={closeButtonRef}
                type="button"
              >
                <CloseIcon />
              </button>

              <div className="app-honor__body">
                <AccountHonorArchiveSection
                  abilityMetrics={abilityMetrics}
                  activityHeatmap={activityHeatmap}
                  investmentProjectCatalog={investmentProjectCatalog}
                  investmentIssueCatalog={investmentIssueCatalog}
                  issueCatalog={issueCatalog}
                  issueShowcase={issueShowcase}
                  issueSupportSummary={issueSupportSummary}
                  projectCatalog={projectCatalog}
                  projectShowcase={projectShowcase}
                  progression={progression}
                  sponsorshipSummary={sponsorshipSummary}
                  showHeader={false}
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
