import type { CurrencyKey } from "@neuro/contracts";
import type { ReactNode } from "react";

import {
  AccountHomeFocus,
  AccountHomeFocusGrid,
  AccountHomeHero,
  AccountHomeHeroBody,
  AccountHomeHeroEyebrow,
  AccountHomeHud,
  AccountHomeHudChip,
  AccountHomeNav,
  AccountHomeNavItem,
  AccountHomeRail,
  AccountHomeRailCard,
  AccountHomeSectionHead,
  AccountHomeShell,
  AccountHomeStage,
  AccountHomeStagePlaceholder,
  AccountHomeStat,
  AccountHomeStatGrid,
} from "@/components/account-home/templates";

export type AccountCenterHudItem = {
  badge?: ReactNode;
  badgeCurrency?: CurrencyKey;
  label: ReactNode;
  meta?: ReactNode;
  value: ReactNode;
};

export type AccountCenterFocusItem = {
  label: ReactNode;
  value: ReactNode;
};

export type AccountCenterNavItem = {
  active?: boolean;
  href: string;
  label: ReactNode;
  meta?: ReactNode;
};

export type AccountCenterRailStat = {
  label: ReactNode;
  value: ReactNode;
};

type AccountCenterFrameProps = {
  actions?: ReactNode;
  children: ReactNode;
  description: ReactNode;
  focusItems: AccountCenterFocusItem[];
  hudItems: AccountCenterHudItem[];
  kicker?: ReactNode;
  navItems: AccountCenterNavItem[];
  railFooter?: ReactNode;
  railStats: AccountCenterRailStat[];
  stage: ReactNode;
  title: ReactNode;
  titleBadges?: ReactNode;
};

type AccountCenterNavigationCardProps = {
  items: AccountCenterNavItem[];
  title?: ReactNode;
};

export function AccountCenterFrame({
  actions,
  children,
  description,
  focusItems,
  hudItems,
  kicker,
  navItems,
  railFooter,
  railStats,
  stage,
  title,
  titleBadges,
}: AccountCenterFrameProps) {
  return (
    <AccountHomeShell className="app-account-shell">
      <AccountHomeHud>
        {hudItems.map((item, index) => (
          <AccountHomeHudChip
            badge={item.badge}
            badgeCurrency={item.badgeCurrency}
            key={`${String(item.label)}-${index}`}
            label={item.label}
            meta={item.meta}
            value={item.value}
          />
        ))}
      </AccountHomeHud>

      <AccountHomeHero>
        <AccountHomeStage>{stage}</AccountHomeStage>

        <AccountHomeHeroBody>
          {kicker ? <span className="mg-terminal-kicker">{kicker}</span> : null}
          {titleBadges ? <AccountHomeHeroEyebrow>{titleBadges}</AccountHomeHeroEyebrow> : null}
          <h1 className="mg-title">{title}</h1>
          <p className="mg-copy">{description}</p>

          <AccountHomeFocusGrid>
            {focusItems.map((item, index) => (
              <AccountHomeFocus key={`${String(item.label)}-${index}`} label={item.label} value={item.value} />
            ))}
          </AccountHomeFocusGrid>

          {actions ? <div className="app-account-hero-actions">{actions}</div> : null}
        </AccountHomeHeroBody>

        <AccountHomeRail>
          <AccountHomeRailCard>
            <AccountHomeSectionHead kicker="Action Board" title="当前会话" />
            <AccountHomeStatGrid>
              {railStats.map((item, index) => (
                <AccountHomeStat key={`${String(item.label)}-${index}`} label={item.label} value={item.value} />
              ))}
            </AccountHomeStatGrid>
          </AccountHomeRailCard>

          <AccountCenterNavigationCard items={navItems} />

          {railFooter}
        </AccountHomeRail>
      </AccountHomeHero>

      {children}
    </AccountHomeShell>
  );
}

export function AccountCenterNavigationCard({
  items,
  title = "账户导航",
}: AccountCenterNavigationCardProps) {
  return (
    <AccountHomeRailCard>
      <AccountHomeSectionHead kicker="Navigation" title={title} />
      <AccountHomeNav>
        {items.map((item, index) => (
          <AccountHomeNavItem
            active={item.active}
            href={item.href}
            key={`${String(item.label)}-${index}`}
            label={item.label}
            meta={item.meta}
          />
        ))}
      </AccountHomeNav>
    </AccountHomeRailCard>
  );
}

type AccountCenterAvatarStageProps = {
  alt: string;
  avatarUrl?: string | null;
  fallback: ReactNode;
};

export function AccountCenterAvatarStage({
  alt,
  avatarUrl,
  fallback,
}: AccountCenterAvatarStageProps) {
  if (avatarUrl) {
    return (
      <div className="app-account-stage-avatar">
        <img alt={alt} className="app-account-stage-avatar__image" src={avatarUrl} />
      </div>
    );
  }

  return (
    <AccountHomeStagePlaceholder className="app-account-stage-avatar app-account-stage-avatar--placeholder">
      {fallback}
    </AccountHomeStagePlaceholder>
  );
}
