"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { FeatureSnapshot, PublicSurfaceSnapshot } from "@neuro/contracts";
import type { ReactNode } from "react";

import { AppToastProvider } from "@/components/app-toast-center";
import { OpinionEntry } from "@/components/account-home/opinion-entry";
import { AccountHonorEntry } from "@/features/account-honor";
import { TaskMarketEntry } from "@/features/account-task-market";
import { RedeemCenter } from "@/features/account-redeem";
import { AnnouncementCenter } from "@/features/account-announcement-center";
import { AgentEntry } from "@/features/account-agent-center";
import { BenefitCenter } from "@/features/account-benefit-center";
import { HeavyAgentChatEntry } from "@/features/account-heavy-agent-chat";
import { CommerceCenter, getCommerceRouteMode } from "@/features/account-commerce-center";
import { MissionCenter } from "@/features/account-mission-center";
import { ProjectEntry } from "@/features/account-project-center";
import { isMailboxRouteOpen, MailboxCenter } from "@/features/mailbox";
import { cn } from "@/lib/cn";

type AppShellProps = {
  authActionSlot: ReactNode;
  children: ReactNode;
  currentUserId: string | null;
  features: FeatureSnapshot;
  publicSurfaces: PublicSurfaceSnapshot;
};

const AUTH_SCENE_PATHS = new Set(["/", "/login"]);
const ACCOUNT_TERMINAL_PREFIXES = [
  "/dashboard",
  "/benefits",
  "/products",
  "/marketplace",
  "/wallet",
  "/growth",
  "/reputation",
  "/mailbox",
  "/redeem",
  "/projects",
  "/opinions",
  "/chat",
  "/agents",
  "/tea",
  "/tasks",
  "/inventory",
  "/my-tasks",
  "/my-agents",
];

function isNavLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) {
    return false;
  }

  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ authActionSlot, children, currentUserId, features, publicSurfaces }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOpsScene = pathname ? pathname === "/ops" || pathname.startsWith("/ops/") : false;
  const isStandaloneChatScene = pathname ? pathname === "/chat" || pathname.startsWith("/chat/") : false;
  const isAuthScene = pathname ? AUTH_SCENE_PATHS.has(pathname) : false;
  const isEmbeddedAgentRoute =
    (pathname === "/agents" || pathname?.startsWith("/agents/")) && searchParams?.get("embedded") === "1";
  const commerceRouteMode = getCommerceRouteMode(pathname);
  const isAccountTerminal = pathname
    ? ACCOUNT_TERMINAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    : false;
  const redundantTerminalLinks = new Set(["/", "/dashboard", "/tasks", "/opinions"]);
  const navLinks = [
    { href: "/", label: "首页", enabled: true },
    { href: "/dashboard", label: "控制台", enabled: true },
    { href: "/products", label: "商城", enabled: publicSurfaces.store.enabled && features.product.enabled && !isAccountTerminal },
    { href: "/marketplace", label: "小集市", enabled: publicSurfaces.marketplace.enabled && features.marketplace.enabled && !isAccountTerminal },
    { href: "/redeem", label: "兑换码", enabled: publicSurfaces.redemption.enabled && features.redemption.enabled && !isAccountTerminal },
    { href: "/mailbox", label: "邮箱", enabled: publicSurfaces.mailbox.enabled && features.mailbox.enabled && !isAccountTerminal },
    { href: "/projects", label: "项目", enabled: publicSurfaces.projects.enabled && Boolean(currentUserId) && !isAccountTerminal },
    { href: "/tea", label: "工单", enabled: Boolean(currentUserId) },
    { href: "/tasks", label: "集市", enabled: publicSurfaces.tasks.enabled && features.taskHub.enabled },
    { href: "/opinions", label: "议题", enabled: publicSurfaces.opinions.enabled && features.opinionHub.enabled },
  ].filter((link) => link.enabled && !(isAccountTerminal && redundantTerminalLinks.has(link.href)));

  if (isOpsScene) {
    return <AppToastProvider>{children}</AppToastProvider>;
  }

  if (isStandaloneChatScene) {
    return (
      <AppToastProvider>
        <div className="mg-theme app-root app-root--chat-app">{children}</div>
      </AppToastProvider>
    );
  }

  return (
    <AppToastProvider>
      <div
        className={cn(
          "mg-theme app-root",
          isAccountTerminal && "app-root--terminal",
          isEmbeddedAgentRoute && "app-root--embedded-agent",
        )}
      >
        {isAuthScene || isEmbeddedAgentRoute ? null : (
          <header className={cn("app-nav", isAccountTerminal && "app-nav--terminal")}>
            <div className="mg-shell app-nav__inner">
              <div className="app-nav__group">
                <Link className="app-nav__brand" href={isAccountTerminal ? "/dashboard" : "/"}>
                  <span className="app-nav__mark">N</span>
                  <span aria-label="NeuroLoom" className="app-nav__brand-copy">
                    <span className="app-nav__brand-line">
                      <span className="app-nav__brand-initial">N</span>euro
                    </span>
                    <span className="app-nav__brand-line">
                      <span className="app-nav__brand-initial">L</span>oom
                    </span>
                  </span>
                </Link>
                <nav className="app-nav__links">
                  {navLinks.map((link) => (
                    <Link
                      className={cn(
                        "app-nav__link",
                        isNavLinkActive(pathname, link.href) && "app-nav__link--active",
                      )}
                      href={link.href}
                      key={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="app-nav__actions">
                  {/* ── 已优化的 10 个面板按钮 ── */}
                  {isAccountTerminal ? (
                    <CommerceCenter
                      itemEnabled={publicSurfaces.inventory.enabled && features.item.enabled}
                      marketplaceEnabled={publicSurfaces.marketplace.enabled && features.marketplace.enabled}
                      productEnabled={publicSurfaces.store.enabled && features.product.enabled}
                      routeMode={commerceRouteMode}
                      userId={currentUserId}
                    />
                  ) : null}
                  {isAccountTerminal ? (
                    <BenefitCenter
                      enabled={publicSurfaces.benefits.enabled && features.benefits.enabled}
                      routeOpen={pathname === "/benefits" || pathname?.startsWith("/benefits/")}
                      storeVisible={publicSurfaces.store.enabled && features.product.enabled}
                      userId={currentUserId}
                    />
                  ) : null}
                  {isAccountTerminal ? (
                    <RedeemCenter
                      enabled={publicSurfaces.redemption.enabled && features.redemption.enabled}
                      routeOpen={pathname === "/redeem" || pathname?.startsWith("/redeem/")}
                      userId={currentUserId}
                    />
                  ) : null}
                  {isAccountTerminal ? (
                    <MissionCenter enabled={publicSurfaces.missions.enabled && features.personalMissions.enabled} userId={currentUserId} />
                  ) : null}
                  {isAccountTerminal ? (
                    <MailboxCenter
                      enabled={publicSurfaces.mailbox.enabled && features.mailbox.enabled}
                      routeOpen={isMailboxRouteOpen(pathname)}
                      userId={currentUserId}
                    />
                  ) : null}
                  {isAccountTerminal && publicSurfaces.announcements.enabled ? <AnnouncementCenter userId={currentUserId} /> : null}
                  {isAccountTerminal ? (
                    <OpinionEntry
                      enabled={publicSurfaces.opinions.enabled && features.opinionHub.enabled}
                      routeOpen={pathname === "/opinions" || pathname?.startsWith("/opinions/")}
                      userId={currentUserId}
                    />
                  ) : null}
                  {isAccountTerminal && publicSurfaces.projects.enabled ? (
                    <ProjectEntry
                      routeOpen={pathname === "/projects" || pathname?.startsWith("/projects/")}
                      userId={currentUserId}
                    />
                  ) : null}
                  {isAccountTerminal && publicSurfaces.honor.enabled ? <AccountHonorEntry userId={currentUserId} /> : null}
                  {isAccountTerminal && publicSurfaces.heavyChat.enabled ? (
                    <HeavyAgentChatEntry
                      routeOpen={pathname === "/chat" || pathname?.startsWith("/chat/")}
                      userId={currentUserId}
                    />
                  ) : null}
                  {isAccountTerminal && publicSurfaces.agents.enabled ? (
                    <AgentEntry
                      routeOpen={pathname === "/agents" || pathname?.startsWith("/agents/")}
                      userId={currentUserId}
                    />
                  ) : null}
                  {/* ── 其他功能入口 ── */}
                  {isAccountTerminal && publicSurfaces.tasks.enabled ? (
                    <TaskMarketEntry
                      routeOpen={pathname === "/tasks" || pathname?.startsWith("/tasks/")}
                      userId={currentUserId}
                    />
                  ) : null}
                  {authActionSlot}
                </div>
              </div>
            </div>
          </header>
        )}
        {children}
      </div>
    </AppToastProvider>
  );
}
