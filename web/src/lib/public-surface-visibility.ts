import type { PublicSurfaceKey, PublicSurfaceSnapshot } from "@neuro/contracts";

import type { AccountCenterNavKey } from "@/lib/account-center";
import { isPlatformOperatorUserId } from "@/lib/platform-session";

export type PublicSurfaceDefinition = {
  key: PublicSurfaceKey;
  label: string;
  group: "终端入口" | "深链接页面";
  description: string;
  impacts: string[];
};

export const PUBLIC_SURFACE_DEFINITIONS: PublicSurfaceDefinition[] = [
  {
    key: "announcements",
    label: "公告按钮",
    group: "终端入口",
    description: "控制控制台顶部的公告面板入口。",
    impacts: ["控制台公告按钮"],
  },
  {
    key: "store",
    label: "商城",
    group: "深链接页面",
    description: "控制官方货架入口，以及商城面板中的官方售卖部分。",
    impacts: ["顶部导航 /products", "商城面板官方货架", "控制台商城按钮"],
  },
  {
    key: "marketplace",
    label: "小集市",
    group: "深链接页面",
    description: "控制玩家流转货架入口，以及商城面板中的小集市部分。",
    impacts: ["顶部导航 /marketplace", "商城面板小集市", "控制台商城按钮"],
  },
  {
    key: "redemption",
    label: "兑换码",
    group: "深链接页面",
    description: "控制兑换码按钮和兑换入口页面。",
    impacts: ["顶部导航 /redeem", "控制台兑换码按钮"],
  },
  {
    key: "mailbox",
    label: "邮箱",
    group: "深链接页面",
    description: "控制邮箱按钮和邮箱界面。",
    impacts: ["顶部导航 /mailbox", "控制台邮箱按钮"],
  },
  {
    key: "benefits",
    label: "羊毛派",
    group: "深链接页面",
    description: "控制羊毛派按钮和权益终端入口。",
    impacts: ["控制台羊毛派按钮", "/benefits"],
  },
  {
    key: "missions",
    label: "任务面板按钮",
    group: "终端入口",
    description: "控制个人任务弹层按钮。",
    impacts: ["控制台任务按钮"],
  },
  {
    key: "opinions",
    label: "议题",
    group: "深链接页面",
    description: "控制议题按钮和议题界面。",
    impacts: ["顶部导航 /opinions", "控制台议题按钮"],
  },
  {
    key: "projects",
    label: "项目",
    group: "深链接页面",
    description: "控制项目按钮和项目界面。",
    impacts: ["顶部导航 /projects", "控制台项目按钮"],
  },
  {
    key: "honor",
    label: "荣誉按钮",
    group: "终端入口",
    description: "控制控制台里的荣誉入口。",
    impacts: ["控制台荣誉按钮"],
  },
  {
    key: "heavyChat",
    label: "重度聊天",
    group: "深链接页面",
    description: "控制重度智能体聊天按钮和聊天界面。",
    impacts: ["控制台重度聊天按钮", "/chat"],
  },
  {
    key: "agents",
    label: "智能体中心",
    group: "深链接页面",
    description: "控制智能体按钮和智能体中心界面。",
    impacts: ["控制台智能体按钮", "/agents", "/my-agents"],
  },
  {
    key: "tasks",
    label: "集市",
    group: "深链接页面",
    description: "控制任务/能力集市按钮和集市界面。",
    impacts: ["顶部导航 /tasks", "控制台集市按钮", "/my-tasks"],
  },
  {
    key: "wallet",
    label: "钱包",
    group: "深链接页面",
    description: "控制钱包界面入口。",
    impacts: ["/wallet"],
  },
  {
    key: "growth",
    label: "成长",
    group: "深链接页面",
    description: "控制成长界面入口。",
    impacts: ["/growth"],
  },
  {
    key: "reputation",
    label: "声望",
    group: "深链接页面",
    description: "控制声望界面入口。",
    impacts: ["/reputation"],
  },
  {
    key: "inventory",
    label: "库存",
    group: "深链接页面",
    description: "控制库存页面和其中的商城跳转入口。",
    impacts: ["/inventory"],
  },
  {
    key: "arbitrations",
    label: "仲裁",
    group: "深链接页面",
    description: "控制仲裁界面入口。",
    impacts: ["/arbitrations"],
  },
];

export function applyPublicSurfaceVisibilityForViewer(
  snapshot: PublicSurfaceSnapshot,
  userId?: string | null,
  providerUserId?: string | null,
): PublicSurfaceSnapshot {
  if (!isPlatformOperatorUserId(userId, providerUserId)) {
    return snapshot;
  }

  return Object.fromEntries(
    Object.entries(snapshot).map(([key, state]) => [
      key,
      {
        ...state,
        enabled: true,
      },
    ]),
  ) as PublicSurfaceSnapshot;
}

export function isPublicSurfaceVisibleForViewer(
  snapshot: PublicSurfaceSnapshot,
  surfaceKey: PublicSurfaceKey,
  userId?: string | null,
  providerUserId?: string | null,
): boolean {
  return applyPublicSurfaceVisibilityForViewer(snapshot, userId, providerUserId)[surfaceKey]?.enabled === true;
}

export function buildAccountCenterSurfaceVisibility(
  snapshot: PublicSurfaceSnapshot,
  userId?: string | null,
  providerUserId?: string | null,
): Partial<Record<AccountCenterNavKey, boolean>> {
  return {
    benefits: isPublicSurfaceVisibleForViewer(snapshot, "benefits", userId, providerUserId),
    wallet: isPublicSurfaceVisibleForViewer(snapshot, "wallet", userId, providerUserId),
    growth: isPublicSurfaceVisibleForViewer(snapshot, "growth", userId, providerUserId),
    reputation: isPublicSurfaceVisibleForViewer(snapshot, "reputation", userId, providerUserId),
    mailbox: isPublicSurfaceVisibleForViewer(snapshot, "mailbox", userId, providerUserId),
    chat: isPublicSurfaceVisibleForViewer(snapshot, "heavyChat", userId, providerUserId),
    emailAccess: true,
  };
}
