"use client";

import { useEffect, useRef, useState } from "react";

import { ACCOUNT_HONOR_PANEL_API_PATH } from "./routes";
import { AccountHonorCenter } from "./account-honor-center";
import type { AccountHonorCenterProps } from "./types";

type AccountHonorEntryProps = {
  userId: string | null;
};

type HonorPanelPayload = {
  error?: string;
  panel?: AccountHonorCenterProps;
};

export function AccountHonorEntry({ userId }: AccountHonorEntryProps) {
  const [panel, setPanel] = useState<AccountHonorCenterProps | null>(null);
  const [loading, setLoading] = useState(false);
  const [openSignal, setOpenSignal] = useState(0);
  const hasPrefetchedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      setPanel(null);
      hasPrefetchedRef.current = false;
      return;
    }

    let cancelled = false;

    async function loadPanel() {
      try {
        setLoading(true);
        const response = await fetch(ACCOUNT_HONOR_PANEL_API_PATH, {
          cache: "no-store",
        });
        const payload = (await response.json()) as HonorPanelPayload;

        if (!response.ok || !payload.panel || cancelled) {
          return;
        }

        setPanel(payload.panel);
        hasPrefetchedRef.current = true;
      } catch {
        // Keep the rest of the shell usable when the profile panel cannot prefetch.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPanel();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleOpen() {
    if (!userId) {
      return;
    }

    if (panel) {
      setOpenSignal((current) => current + 1);
      return;
    }

    if (loading) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(ACCOUNT_HONOR_PANEL_API_PATH, {
        cache: "no-store",
      });
      const payload = (await response.json()) as HonorPanelPayload;
      if (!response.ok || !payload.panel) {
        return;
      }

      hasPrefetchedRef.current = true;
      setPanel(payload.panel);
      setOpenSignal((current) => current + 1);
    } catch {
      // Keep the shell stable when the panel cannot be fetched.
    } finally {
      setLoading(false);
    }
  }

  if (!userId) {
    return null;
  }

  return (
    <>
      <button
        aria-disabled={loading}
        aria-haspopup="dialog"
        className="app-honor-trigger"
        disabled={loading && !hasPrefetchedRef.current}
        onClick={handleOpen}
        type="button"
      >
        <span className="app-honor-trigger__copy">
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
          <span>{loading && !panel ? "档案载入中" : "档案"}</span>
        </span>
      </button>

      {panel ? <AccountHonorCenter {...panel} hideTrigger openSignal={openSignal} /> : null}
    </>
  );
}
