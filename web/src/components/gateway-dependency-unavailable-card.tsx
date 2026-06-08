import Link from "next/link";

import { NtBadge, NtCard, type NtBadgeTone } from "@/components/nt-primitives";
import type { GatewayCatalogUnavailableNotice } from "@/lib/gateway-catalog-notice";

type GatewayDependencyUnavailableCardProps = {
  notice: GatewayCatalogUnavailableNotice;
  action?: {
    href: string;
    label: string;
  };
};

export function GatewayDependencyUnavailableCard({
  notice,
  action,
}: GatewayDependencyUnavailableCardProps) {
  const badgeTone: NtBadgeTone = notice.badgeTone ?? "warning";
  const isDanger = badgeTone === "danger";

  return (
    <NtCard
      style={{
        display: "grid",
        gap: 12,
        borderColor: isDanger ? "rgba(248,113,113,0.28)" : "rgba(251,146,60,0.26)",
        background: isDanger
          ? "linear-gradient(135deg, rgba(69,10,10,0.68), rgba(15,23,42,0.78))"
          : "linear-gradient(135deg, rgba(67,20,7,0.68), rgba(15,23,42,0.78))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <NtBadge tone={badgeTone}>{notice.badgeLabel ?? "依赖服务未连接"}</NtBadge>
          <strong style={{ color: isDanger ? "rgba(254,202,202,0.96)" : "rgba(254,215,170,0.96)", fontSize: "1.05rem" }}>
            {notice.title}
          </strong>
        </div>
        {action ? (
          <Link className="nt-btn nt-btn--secondary" href={action.href}>
            {action.label}
          </Link>
        ) : null}
      </div>
      <span style={{ color: isDanger ? "rgba(252,165,165,0.9)" : "rgba(253,186,116,0.9)", lineHeight: 1.6 }}>{notice.body}</span>
      <span style={{ color: isDanger ? "rgba(254,202,202,0.78)" : "rgba(254,215,170,0.78)", fontSize: "0.9rem", lineHeight: 1.55 }}>
        {notice.detail}
      </span>
    </NtCard>
  );
}
