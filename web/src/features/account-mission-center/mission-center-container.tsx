"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useAppToast } from "@/components/app-toast-center";
import type { MissionCardView, MissionPanelView, MissionTabKey } from "@/lib/account-client";
import { cn } from "@/lib/cn";
import { getCurrencyLabel } from "@/lib/currency-display";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import { MISSION_POLL_INTERVAL_MS, TAB_COPY, TAB_ORDER } from "./constants";
import { CloseIcon, MissionIcon } from "./icons";
import { MissionRow } from "./mission-row";
import { getEntriesByTab, hasCheckinFollowupAction } from "./utils";

export type MissionCenterProps = {
  enabled: boolean;
  userId: string | null;
};

export function MissionCenterContainer({ enabled, userId }: MissionCenterProps) {
  const { pushToast } = useAppToast();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const panelErrorToastRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<MissionPanelView | null>(null);
  const [selectedTab, setSelectedTab] = useState<MissionTabKey>("checkin");
  const [pendingMissionId, setPendingMissionId] = useState<string | null>(null);
  const [pendingWagerMissionId, setPendingWagerMissionId] = useState<string | null>(null);

  async function refreshPanel(preferredTab?: MissionTabKey) {
    if (!enabled || !userId) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/account-missions/panel", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        panel?: MissionPanelView;
      };

      if (!response.ok || !payload.panel) {
        throw new Error(payload.error || "福利中心暂时不可用。");
      }

      setPanel(payload.panel);
      setSelectedTab(preferredTab ?? (hasCheckinFollowupAction(payload.panel.checkin) ? "checkin" : payload.panel.defaultTab));
      panelErrorToastRef.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "福利中心暂时不可用。";
      if (panelErrorToastRef.current !== message) {
        pushToast({
          tone: "error",
          title: "福利中心",
          message,
        });
        panelErrorToastRef.current = message;
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimMission(missionId: string) {
    setPendingMissionId(missionId);

    try {
      const response = await fetch(`/api/account-missions/${encodeURIComponent(missionId)}/claim`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        reward?: {
          rewardPreviewText: string | null;
          claimedAmount: number;
          rewardCurrency: MissionCardView["rewardCurrency"];
        };
      };

      if (!response.ok) {
        throw new Error(payload.error || "任务奖励领取失败。");
      }

      const rewardCurrencyLabel = payload.reward ? getCurrencyLabel(payload.reward.rewardCurrency) : "米拉";
      pushToast({
        tone: "success",
        title: payload.reward?.rewardPreviewText ? "签到完成" : "奖励已发放",
        message: payload.reward?.rewardPreviewText
          ? `获得 ${payload.reward.rewardPreviewText} ${rewardCurrencyLabel}。可继续押注明日奖励。`
          : `已获得 ${payload.reward?.claimedAmount ?? 0} ${rewardCurrencyLabel}。`,
      });
      await refreshPanel(selectedTab);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "签到失败",
        message: error instanceof Error ? error.message : "任务奖励领取失败。",
      });
    } finally {
      setPendingMissionId(null);
    }
  }

  async function handleCheckinWager(missionId: string) {
    setPendingWagerMissionId(missionId);

    try {
      const response = await fetch(`/api/account-missions/${encodeURIComponent(missionId)}/checkin-wager`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        wager?: {
          wagerAmount: number;
          bonusAmount: number;
          previewText: string;
          rewardCurrency: MissionCardView["rewardCurrency"];
        };
      };

      if (!response.ok || !payload.wager) {
        throw new Error(payload.error || "签到压注失败。");
      }

      const rewardCurrencyLabel = getCurrencyLabel(payload.wager.rewardCurrency);
      pushToast({
        tone: "info",
        title: "已押注",
        message: `消耗 ${payload.wager.wagerAmount} ${rewardCurrencyLabel}，明日签到将额外获得 ${payload.wager.bonusAmount} ${rewardCurrencyLabel}。`,
      });
      await refreshPanel(selectedTab);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "押注失败",
        message: error instanceof Error ? error.message : "签到压注失败。",
      });
    } finally {
      setPendingWagerMissionId(null);
    }
  }

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    let cancelled = false;

    async function syncPanel() {
      if (cancelled) {
        return;
      }
      await refreshPanel();
    }

    void syncPanel();
    const intervalId = window.setInterval(() => {
      void syncPanel();
    }, MISSION_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, userId]);

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

  if (!enabled || !userId) {
    return null;
  }

  const totalClaimableCount = panel?.tabs.reduce((sum, tab) => sum + tab.claimableCount, 0) ?? 0;
  const totalActionableCount = totalClaimableCount + (hasCheckinFollowupAction(panel?.checkin) ? 1 : 0);
  const selectedEntries = getEntriesByTab(panel, selectedTab);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn("app-mission-trigger", totalActionableCount > 0 && "app-mission-trigger--ready")}
        onClick={() => {
          setOpen(true);
          void refreshPanel();
        }}
        ref={triggerButtonRef}
        type="button"
      >
        <span className="app-mission-trigger__copy">
          <MissionIcon />
          <span>福利中心</span>
        </span>
        {totalActionableCount > 0 ? <span className="app-mission-trigger__badge">{totalActionableCount}</span> : null}
      </button>

      {open ? (
        <div aria-labelledby={titleId} aria-modal="true" className="app-mission-overlay" role="dialog">
          <button
            aria-label="关闭福利中心面板"
            className="app-mission-backdrop"
            onClick={() => setOpen(false)}
            type="button"
          />

          <section className="app-mission">
            <aside className="app-mission__rail">
              <div className="app-mission__rail-head">
                <div className="app-mission__rail-mark" aria-hidden="true">
                  <MissionIcon />
                </div>
                <div className="app-mission__rail-copy">
                  <h2 id={titleId}>福利中心</h2>
                </div>
              </div>

              <div className="app-mission__rail-list">
                {TAB_ORDER.map((tabKey) => {
                  const summary = panel?.tabs.find((item) => item.key === tabKey);
                  return (
                    <button
                      className={cn(
                        "app-mission__rail-item",
                        selectedTab === tabKey && "app-mission__rail-item--active",
                        ((summary?.claimableCount ?? 0) > 0 ||
                          (tabKey === "checkin" && hasCheckinFollowupAction(panel?.checkin))) &&
                          "app-mission__rail-item--unread",
                      )}
                      key={tabKey}
                      onClick={() => setSelectedTab(tabKey)}
                      type="button"
                    >
                      {(summary?.claimableCount ?? 0) > 0 ||
                      (tabKey === "checkin" && hasCheckinFollowupAction(panel?.checkin)) ? (
                        <span aria-hidden="true" className="app-mission__rail-item-dot" />
                      ) : null}
                      <div className="app-mission__rail-item-copy">
                        <strong>{TAB_COPY[tabKey].title}</strong>
                        {(summary?.claimableCount ?? 0) > 0 ? (
                          <span className="app-mission__rail-item-count">{summary?.claimableCount}</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <article className="app-mission__content">
              <button
                aria-label="关闭福利中心面板"
                className="app-mission-close"
                onClick={() => setOpen(false)}
                ref={closeButtonRef}
                type="button"
              >
                <CloseIcon />
              </button>

              <div className="app-mission__body">
                {loading && !panel ? <p className="mg-copy">任务数据加载中…</p> : null}

                {!loading && selectedEntries.length === 0 ? (
                  <div className="app-mission__empty">
                    <strong>{TAB_COPY[selectedTab].emptyTitle}</strong>
                    <p>{TAB_COPY[selectedTab].emptyMessage}</p>
                  </div>
                ) : null}

                {selectedEntries.length > 0 ? (
                  <div className="app-mission__rows">
                    {selectedEntries.map((mission) => (
                      <MissionRow
                        key={mission.id}
                        mission={mission}
                        onClaim={handleClaimMission}
                        onCheckinWager={handleCheckinWager}
                        pendingMissionId={pendingMissionId}
                        pendingWagerMissionId={pendingWagerMissionId}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          </section>
        </div>
      ) : null}
    </>
  );
}
