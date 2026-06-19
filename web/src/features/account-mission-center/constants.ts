import type { MissionTabKey } from "@/lib/account-client";

export const MISSION_POLL_INTERVAL_MS = 30_000;

export const TAB_ORDER: MissionTabKey[] = ["checkin", "permanent", "daily", "weekly", "event"];

export const TAB_COPY: Record<MissionTabKey, { title: string; emptyTitle: string; emptyMessage: string }> = {
  checkin: {
    title: "签到福利",
    emptyTitle: "每天来签到领奖励",
    emptyMessage: "签到任务由运营配置，开放后每天都可以来领取奖励。",
  },
  permanent: {
    title: "永久福利",
    emptyTitle: "暂无永久任务",
    emptyMessage: "当前暂无可领取永久任务；新增永久福利会通过站内通知展示。",
  },
  daily: {
    title: "每日福利",
    emptyTitle: "今日任务已全部完成",
    emptyMessage: "明天还会有新任务，记得来领取。",
  },
  weekly: {
    title: "每周福利",
    emptyTitle: "本周任务已全部完成",
    emptyMessage: "下周一将刷新新的周任务。",
  },
  event: {
    title: "活动福利",
    emptyTitle: "暂无进行中的活动",
    emptyMessage: "活动任务会在特殊节点开放，关注站内通知。",
  },
};
