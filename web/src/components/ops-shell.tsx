"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type OpsNavItem = {
  href: string;
  label: string;
  group: string;
};

const OPS_NAV_ITEMS: OpsNavItem[] = [
  { href: "/ops/gateway/providers", label: "服务商", group: "AI Gateway" },
  { href: "/ops/gateway/traces", label: "请求追踪", group: "AI Gateway" },
  { href: "/ops/gateway/health", label: "健康状态", group: "AI Gateway" },
  { href: "/ops/gateway/model-associations", label: "模型别名", group: "AI Gateway" },
  { href: "/ops/gateway/costs", label: "使用统计", group: "AI Gateway" },
  { href: "/ops/gateway/access", label: "Access 控制", group: "AI Gateway" },
  // Account
  { href: "/ops/account/surface-visibility", label: "界面外放", group: "账户" },
  { href: "/ops/account-worker", label: "账户后台任务", group: "账户" },
  { href: "/ops/account/announcements", label: "公告管理", group: "账户" },
  { href: "/ops/account/mailbox", label: "邮箱运营", group: "账户" },
  { href: "/ops/account/email-ingress", label: "真实邮件网关", group: "账户" },
  { href: "/ops/account/missions", label: "任务配置", group: "账户" },
  { href: "/ops/account/benefits", label: "羊毛派管理", group: "账户" },
  { href: "/ops/account/credential-pools", label: "凭证池", group: "账户" },
  { href: "/ops/account/redemption-codes", label: "兑换码管理", group: "账户" },
  { href: "/ops/account/arbitrations", label: "仲裁管理", group: "账户" },
  // Content
  { href: "/ops/account/projects", label: "项目管理", group: "内容" },
  { href: "/ops/account/honor-projects", label: "荣誉项目", group: "内容" },
  { href: "/ops/account/issues", label: "议题管理", group: "内容" },
  { href: "/ops/account/agents", label: "智能体管理", group: "内容" },
  // Commerce
  { href: "/ops/products", label: "商品管理", group: "商品" },
  { href: "/ops/discount-codes", label: "优惠码管理", group: "商品" },
];

function isOpsLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type OpsShellProps = {
  authActionSlot: ReactNode;
  children: ReactNode;
};

export function OpsShell({ authActionSlot, children }: OpsShellProps) {
  const pathname = usePathname();

  const groups = OPS_NAV_ITEMS.reduce<Record<string, OpsNavItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div className="mg-theme app-root ops-root">
      <header className="ops-header">
        <div className="ops-header__inner">
          <Link className="ops-header__brand" href="/ops/gateway/providers">
            <span className="ops-header__mark">N</span>
            <span className="ops-header__brand-copy">
              <span className="ops-header__brand-title">NeuroLoom</span>
              <span className="ops-header__brand-subtitle">运维控制台</span>
            </span>
          </Link>
          <div className="ops-header__actions">
            <Link className="ops-header__back-link" href="/dashboard">
              ← 返回终端
            </Link>
            {authActionSlot}
          </div>
        </div>
      </header>
      <div className="ops-layout">
        <aside className="ops-rail">
          <nav className="ops-rail__nav">
            {Object.entries(groups).map(([group, items]) => (
              <div className="ops-rail__group" key={group}>
                <div className="ops-rail__group-title">{group}</div>
                {items.map((item) => (
                  <Link
                    className={cn(
                      "ops-rail__item",
                      isOpsLinkActive(pathname, item.href) && "ops-rail__item--active",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <main className="ops-main">{children}</main>
      </div>
    </div>
  );
}
