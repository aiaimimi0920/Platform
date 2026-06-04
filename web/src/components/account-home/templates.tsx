import Link from "next/link";
import type { CurrencyKey } from "@neuro/contracts";
import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";

import { CurrencyIcon } from "@/components/currency-icon";
import { cn } from "@/lib/cn";

type Accent = "signal" | "cyan" | "ink";

type ShellProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

type HudChipProps = {
  badge?: ReactNode;
  badgeCurrency?: CurrencyKey;
  className?: string;
  label: ReactNode;
  meta?: ReactNode;
  value: ReactNode;
};

type SectionHeadProps = {
  actions?: ReactNode;
  className?: string;
  kicker?: ReactNode;
  title: ReactNode;
};

type StatProps = {
  className?: string;
  label: ReactNode;
  value: ReactNode;
};

type ActionTileProps = {
  accent?: Accent;
  className?: string;
  description?: ReactNode;
  href?: string;
  icon?: ReactNode;
  title: ReactNode;
};

type ListRowProps = {
  aside?: ReactNode;
  className?: string;
  subtitle?: ReactNode;
  title: ReactNode;
};

type NavItemProps = {
  active?: boolean;
  className?: string;
  href?: string;
  label: ReactNode;
  meta?: ReactNode;
};

export function AccountHomeShell({ className, children, ...props }: ShellProps) {
  return (
    <section className={cn("mg-terminal-shell", className)} {...props}>
      {children}
    </section>
  );
}

export function AccountHomeHud({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-hud", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeHudChip({ badge, badgeCurrency, className, label, meta, value }: HudChipProps) {
  return (
    <div className={cn("mg-terminal-chip", className)}>
      {badge || badgeCurrency ? (
        <div className="mg-terminal-chip__badge">
          {badgeCurrency ? <CurrencyIcon className="app-currency-icon app-currency-icon--hud" currency={badgeCurrency} /> : badge}
        </div>
      ) : null}
      <div className="mg-terminal-chip__body">
        <span className="mg-terminal-chip__label">{label}</span>
        <strong className="mg-terminal-chip__value">{value}</strong>
      </div>
      {meta ? <span className="mg-terminal-chip__meta">{meta}</span> : null}
    </div>
  );
}

export function AccountHomeHero({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-hero", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeStage({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-stage", className)} {...props}>
      <div className="mg-terminal-stage__media">{children}</div>
    </div>
  );
}

export function AccountHomeStagePlaceholder({
  children,
  className,
  ...props
}: ShellProps) {
  return (
    <div className={cn("mg-terminal-stage__placeholder", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeHeroBody({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-hero__body", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeHeroEyebrow({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-hero__eyebrow", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeRail({ className, children, ...props }: ShellProps) {
  return (
    <aside className={cn("mg-terminal-rail", className)} {...props}>
      {children}
    </aside>
  );
}

export function AccountHomeRailCard({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-rail-card", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeSection({ className, children, ...props }: ShellProps) {
  return (
    <section className={cn("mg-terminal-section", className)} {...props}>
      {children}
    </section>
  );
}

export function AccountHomeSectionHead({ actions, className, kicker, title }: SectionHeadProps) {
  return (
    <div className={cn("mg-terminal-section__head", className)}>
      <div className="mg-stack">
        {kicker ? <span className="mg-terminal-kicker">{kicker}</span> : null}
        <h2 className="mg-card__title">{title}</h2>
      </div>
      {actions}
    </div>
  );
}

export function AccountHomeStatGrid({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-stat-grid", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeStat({ className, label, value }: StatProps) {
  return (
    <div className={cn("mg-terminal-stat", className)}>
      <span className="mg-terminal-stat__label">{label}</span>
      <strong className="mg-terminal-stat__value">{value}</strong>
    </div>
  );
}

export function AccountHomeFocusGrid({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-focus-grid", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeFocus({ className, label, value }: StatProps) {
  return (
    <div className={cn("mg-terminal-focus", className)}>
      <span className="mg-terminal-focus__label">{label}</span>
      <strong className="mg-terminal-focus__value">{value}</strong>
    </div>
  );
}

export function AccountHomeActionGrid({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-grid", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeActionTile({
  accent = "ink",
  className,
  description,
  href,
  icon,
  title,
}: ActionTileProps) {
  const classes = cn(
    "mg-terminal-tile",
    accent === "signal" ? "mg-terminal-tile--signal" : null,
    accent === "cyan" ? "mg-terminal-tile--cyan" : null,
    className,
  );

  const content = (
    <>
      {icon ? <div className="mg-terminal-tile__icon">{icon}</div> : null}
      <div className="mg-terminal-tile__body">
        <strong className="mg-terminal-tile__title">{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}

export function AccountHomeList({ className, children, ...props }: ShellProps) {
  return (
    <div className={cn("mg-terminal-list", className)} {...props}>
      {children}
    </div>
  );
}

export function AccountHomeListRow({ aside, className, subtitle, title }: ListRowProps) {
  return (
    <div className={cn("mg-terminal-list__row", className)}>
      <div className="mg-terminal-list__meta">
        <strong className="mg-terminal-list__title">{title}</strong>
        {subtitle ? <span className="mg-terminal-list__subtitle">{subtitle}</span> : null}
      </div>
      {aside}
    </div>
  );
}

export function AccountHomeNav({ className, children, ...props }: ShellProps) {
  return (
    <nav className={cn("mg-terminal-nav", className)} {...props}>
      {children}
    </nav>
  );
}

export function AccountHomeNavItem({ active = false, className, href, label, meta }: NavItemProps) {
  const classes = cn("mg-terminal-nav__item", active && "mg-terminal-nav__item--active", className);
  const content = (
    <>
      <span className="mg-terminal-nav__label">{label}</span>
      {meta ? <span className="mg-terminal-nav__meta">{meta}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
