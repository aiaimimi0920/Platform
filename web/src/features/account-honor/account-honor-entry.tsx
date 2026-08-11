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
  const [panelState, setPanelState] = useState<{ userId: string; panel: AccountHonorCenterProps } | null>(null);
  const [loading, setLoading] = useState(false);
  const [openSignal, setOpenSignal] = useState(0);
  const hasPrefetchedRef = useRef(false);
  const panelRequestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const panelRequestIdRef = useRef(0);
  const panel = panelState?.userId === userId ? panelState.panel : null;

  async function loadPanel(options?: { openWhenLoaded?: boolean }) {
    if (!userId || panelRequestRef.current) {
      return;
    }

    const requestUserId = userId;
    const requestId = panelRequestIdRef.current + 1;
    panelRequestIdRef.current = requestId;
    const controller = new AbortController();
    panelRequestRef.current = { controller, id: requestId };
    setLoading(true);

    try {
      const response = await fetch(ACCOUNT_HONOR_PANEL_API_PATH, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as HonorPanelPayload;

      if (
        !response.ok ||
        !payload.panel ||
        controller.signal.aborted ||
        panelRequestIdRef.current !== requestId ||
        panelRequestRef.current?.id !== requestId
      ) {
        return;
      }

      hasPrefetchedRef.current = true;
      setPanelState({ panel: payload.panel, userId: requestUserId });
      if (options?.openWhenLoaded) {
        setOpenSignal((current) => current + 1);
      }
    } catch {
      // Keep the rest of the shell usable when the profile panel cannot load.
    } finally {
      if (panelRequestRef.current?.id === requestId) {
        panelRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    setPanelState(null);
    setLoading(false);
    hasPrefetchedRef.current = false;

    if (!userId) {
      return;
    }

    void loadPanel();
    return () => {
      panelRequestRef.current?.controller.abort();
      panelRequestRef.current = null;
      panelRequestIdRef.current += 1;
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

    if (panelRequestRef.current) {
      return;
    }

    await loadPanel({ openWhenLoaded: true });
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
