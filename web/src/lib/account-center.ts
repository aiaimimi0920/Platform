import type {
  CurrencyKey,
  ReputationSummary,
  UserProgressionSnapshot,
  UserWalletSnapshot,
  WalletSummary,
} from "@neuro/contracts";

import type {
  AccountCenterHudItem,
  AccountCenterNavItem,
} from "@/components/account-home/account-center-frame";
import { currencyCatalog } from "@/lib/economy";

export type AccountCenterNavKey =
  | "dashboard"
  | "benefits"
  | "wallet"
  | "growth"
  | "reputation"
  | "mailbox"
  | "chat"
  | "emailAccess";

export function formatAccountNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatAccountRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatAccountDateTime(value: string | null): string {
  if (!value) {
    return "未记录";
  }

  return new Date(value).toLocaleString("zh-CN");
}

type BuildHudItemsOptions = {
  mailboxUnreadCount: number;
  pendingAttachmentCount: number;
  progression: UserProgressionSnapshot | null;
  wallet: WalletSummary | null;
  walletSnapshot: UserWalletSnapshot | null;
};

export function buildAccountHudItems({
  mailboxUnreadCount,
  pendingAttachmentCount,
  progression,
  wallet,
  walletSnapshot,
}: BuildHudItemsOptions): AccountCenterHudItem[] {
  const balances = wallet?.balances ?? walletSnapshot?.balances ?? null;

  return [
    ...(balances
      ? currencyCatalog.map((currency) => ({
          badgeCurrency: currency.key,
          label: currency.name,
          value: formatAccountNumber(balances[currency.key]?.available ?? 0),
          meta: `冻结 ${formatAccountNumber(balances[currency.key]?.frozen ?? 0)}`,
        }))
      : []),
    {
      badge: "XP",
      label: "成长",
      value: progression ? `Lv.${progression.level}` : "未读取",
      meta:
        progression?.experienceToNextLevel === null
          ? "已满级"
          : progression?.experienceToNextLevel
            ? `距下一阶 ${formatAccountNumber(progression.experienceToNextLevel)}`
            : "等待接线",
    },
    {
      badge: "MSG",
      label: "邮箱",
      value: formatAccountNumber(mailboxUnreadCount),
      meta: pendingAttachmentCount > 0 ? `${pendingAttachmentCount} 个附件待领` : "无待领取附件",
    },
  ];
}

type BuildNavItemsOptions = {
  active: AccountCenterNavKey | null;
  mailboxUnreadCount: number;
  pendingAttachmentCount: number;
  progression: UserProgressionSnapshot | null;
  recentWalletCount?: number;
  reputation?: ReputationSummary | null;
  visibility?: Partial<Record<AccountCenterNavKey, boolean>>;
};

export function buildAccountCenterNavItems({
  active,
  mailboxUnreadCount,
  pendingAttachmentCount,
  progression,
  recentWalletCount = 0,
  reputation,
  visibility,
}: BuildNavItemsOptions): AccountCenterNavItem[] {
  const items: Array<AccountCenterNavItem & { key: AccountCenterNavKey }> = [
    { key: "dashboard", href: "/dashboard", label: "总览", meta: "HUD" },
    {
      key: "benefits",
      href: "/benefits",
      label: "羊毛派",
      meta: "CLAIM",
    },
    {
      key: "wallet",
      href: "/wallet",
      label: "钱包",
      meta: recentWalletCount > 0 ? `${recentWalletCount} LEDGER` : "WALLET",
    },
    {
      key: "growth",
      href: "/growth",
      label: "成长",
      meta: progression ? `Lv.${progression.level}` : "XP",
    },
    {
      key: "reputation",
      href: "/reputation",
      label: "信誉",
      meta: reputation ? `${reputation.reputationScore}` : "REP",
    },
    {
      key: "mailbox",
      href: "/mailbox",
      label: "邮箱",
      meta: pendingAttachmentCount > 0 ? `${pendingAttachmentCount} ATT` : `${mailboxUnreadCount} MSG`,
    },
    {
      key: "chat",
      href: "/chat",
      label: "对话",
      meta: "HEAVY",
    },
    {
      key: "emailAccess",
      href: "/email-access",
      label: "Email",
      meta: "NATIVE",
    },
  ];

  return items
    .filter((item) => visibility?.[item.key] !== false)
    .map((item) => ({
      ...item,
      active: active ? item.key === active : false,
    }));
}

export function getCurrencyAvailable(
  currencyKey: CurrencyKey,
  wallet: WalletSummary | null,
  walletSnapshot: UserWalletSnapshot | null,
): number {
  return wallet?.balances[currencyKey]?.available ?? walletSnapshot?.balances[currencyKey]?.available ?? 0;
}

export function getCurrencyFrozen(
  currencyKey: CurrencyKey,
  wallet: WalletSummary | null,
  walletSnapshot: UserWalletSnapshot | null,
): number {
  return wallet?.balances[currencyKey]?.frozen ?? walletSnapshot?.balances[currencyKey]?.frozen ?? 0;
}
