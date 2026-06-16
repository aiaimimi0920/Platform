"use client";

import { useEffect, useId, useRef, useState } from "react";

import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import {
  AccountHonorArchiveSection,
  AccountHonorExecutionPanel,
} from "./account-honor-panel";
import { AccountHonorTaglineEditor } from "./owner/tagline-editor";
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
  const wasOpenRef = useRef(false);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const fallback = accountDisplayName.slice(0, 1).toUpperCase();
  const rankLabel = buildHonorRankLabel(progression, trustLevel);

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
                  <AccountHonorTaglineEditor profileTagline={profileTagline} />
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
