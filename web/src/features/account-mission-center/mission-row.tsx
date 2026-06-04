"use client";

import { CurrencyIcon } from "@/components/currency-icon";
import type { MissionCardView } from "@/lib/account-client";
import { cn } from "@/lib/cn";

import {
  canUseCheckinAction,
  renderCheckinActionLabel,
  renderClaimActionLabel,
  renderMissionHint,
  renderRewardBadgeText,
  renderStatusLabel,
  renderStatusTone,
} from "./utils";

type MissionRowProps = {
  mission: MissionCardView;
  onClaim: (missionId: string) => void;
  onCheckinWager: (missionId: string) => void;
  pendingMissionId: string | null;
  pendingWagerMissionId: string | null;
};

export function MissionRow({
  mission,
  onClaim,
  onCheckinWager,
  pendingMissionId,
  pendingWagerMissionId,
}: MissionRowProps) {
  const progressRatio = Math.max(0, Math.min(1, mission.progressCurrent / Math.max(mission.progressTarget, 1)));
  const isCheckinActionEnabled =
    mission.kind === "checkin" ? canUseCheckinAction(mission, pendingMissionId, pendingWagerMissionId) : false;
  const checkinActionLabel =
    mission.kind === "checkin" ? renderCheckinActionLabel(mission, pendingMissionId, pendingWagerMissionId) : null;

  return (
    <article className={cn("app-mission__row", mission.claimable && "app-mission__row--claimable")}>
      {mission.claimable ? <span aria-hidden="true" className="app-mission__row-dot" /> : null}
      <div className="app-mission__row-frame">
        <div className="app-mission__row-reward">
          <span aria-hidden="true" className="app-mission__reward-icon-shell">
            <CurrencyIcon currency={mission.rewardCurrency} className="app-mission__reward-icon" />
          </span>
          <strong>{renderRewardBadgeText(mission)}</strong>
          <span className="app-mission__row-reward-currency">{mission.rewardCurrency.toUpperCase()}</span>
        </div>

        <div className="app-mission__row-main">
          <h4 className="app-mission__row-title">{mission.title}</h4>
          {mission.kind === "checkin" && mission.streakDays !== null ? (
            <p className="app-mission__row-streak">
              连续签到 <strong>{mission.streakDays}</strong> 天
              {mission.streakTarget ? ` / ${mission.streakTarget}` : null}
            </p>
          ) : null}
          {renderMissionHint(mission) ? <p className="app-mission__row-note">{renderMissionHint(mission)}</p> : null}

          <div className="app-mission__row-progress" aria-label={`当前进度 ${mission.progressCurrent}/${mission.progressTarget}`}>
            <div className="app-mission__progress-track" aria-hidden="true">
              <span className="app-mission__progress-fill" style={{ width: `${progressRatio * 100}%` }} />
            </div>
            <span className="app-mission__row-progress-value">
              {mission.progressCurrent}/{mission.progressTarget}
            </span>
          </div>
        </div>

        <div className="app-mission__row-side">
          {mission.kind === "checkin" ? (
            isCheckinActionEnabled ? (
              <button
                className="app-mission__row-status app-mission__row-status--actionable"
                disabled={!isCheckinActionEnabled}
                onClick={() => (mission.claimable ? onClaim(mission.id) : onCheckinWager(mission.id))}
                type="button"
              >
                {checkinActionLabel}
              </button>
            ) : (
              <span className={cn("app-mission__row-status", `app-mission__row-status--${renderStatusTone(mission)}`)}>
                {checkinActionLabel}
              </span>
            )
          ) : mission.claimable ? (
            <button
              className="app-mission__row-status app-mission__row-status--actionable"
              disabled={pendingMissionId === mission.id}
              onClick={() => onClaim(mission.id)}
              type="button"
            >
              {renderClaimActionLabel(mission, pendingMissionId)}
            </button>
          ) : (
            <span className={cn("app-mission__row-status", `app-mission__row-status--${renderStatusTone(mission)}`)}>
              {renderStatusLabel(mission)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
