import type { MissionCardView, MissionPanelView, MissionTabKey } from "@/lib/account-client";
import { getCurrencyLabel } from "@/lib/currency-display";

export function renderStatusLabel(mission: MissionCardView) {
  if (mission.kind === "checkin") {
    if (mission.checkinWager?.todayWagerAmount !== null) {
      return "已押注";
    }
    if (mission.claimed) {
      return "已签到";
    }
  }
  if (mission.claimed) {
    return "已领取";
  }
  if (mission.claimable) {
    return "可领取";
  }
  return mission.kind === "checkin" ? "待签到" : "进行中";
}

export function renderStatusTone(mission: MissionCardView) {
  if (mission.claimed) {
    return "success";
  }
  if (mission.claimable) {
    return "warning";
  }
  return "ink";
}

export function renderRewardBadgeText(mission: MissionCardView) {
  if (mission.kind === "checkin" && mission.checkinReward) {
    return mission.checkinReward.previewText;
  }

  return `x ${mission.rewardAmount}`;
}

export function renderClaimActionLabel(mission: MissionCardView, pendingMissionId: string | null) {
  if (pendingMissionId === mission.id) {
    return mission.kind === "checkin" ? "签到中..." : "处理中...";
  }
  if (!mission.claimable) {
    return renderStatusLabel(mission);
  }
  return mission.kind === "checkin" ? "签到" : "可领取";
}

export function renderCheckinActionLabel(
  mission: MissionCardView,
  pendingMissionId: string | null,
  pendingWagerMissionId: string | null,
) {
  if (pendingMissionId === mission.id) {
    return "签到中...";
  }
  if (pendingWagerMissionId === mission.id) {
    return "压注中...";
  }
  if (mission.checkinWager?.todayWagerAmount !== null) {
    return "已押注";
  }
  if (mission.claimable) {
    return "签到";
  }
  if (mission.claimed && mission.checkinWager?.canPlaceToday) {
    return "押注";
  }
  if (mission.claimed) {
    return "已签到";
  }
  return "待签到";
}

export function canUseCheckinAction(
  mission: MissionCardView,
  pendingMissionId: string | null,
  pendingWagerMissionId: string | null,
) {
  if (pendingMissionId === mission.id || pendingWagerMissionId === mission.id) {
    return false;
  }
  if (mission.claimable) {
    return true;
  }
  return Boolean(mission.claimed && mission.checkinWager?.canPlaceToday);
}

export function getEntriesByTab(panel: MissionPanelView | null, tab: MissionTabKey) {
  if (!panel) {
    return [];
  }

  if (tab === "checkin") {
    return panel.checkin ? [panel.checkin] : [];
  }

  return panel[tab];
}

export function hasCheckinFollowupAction(mission: MissionCardView | null | undefined) {
  return Boolean(mission?.kind === "checkin" && mission.claimed && mission.checkinWager?.canPlaceToday);
}

export function renderMissionHint(mission: MissionCardView) {
  if (mission.kind !== "checkin" || !mission.checkinWager || !mission.checkinReward) {
    return null;
  }

  const currencyLabel = getCurrencyLabel(mission.rewardCurrency);

  if (mission.checkinWager.todayWagerAmount !== null && mission.checkinWager.todayBonusAmount !== null) {
    return `今日已押注 ${mission.checkinWager.todayWagerAmount} ${currencyLabel}，明日签到将额外获得 ${mission.checkinWager.todayBonusAmount} ${currencyLabel}`;
  }

  return `押注会随机消耗 ${mission.checkinWager.minAmount}-${mission.checkinWager.maxAmount} ${currencyLabel}，次日按双倍返还额外奖励`;
}
