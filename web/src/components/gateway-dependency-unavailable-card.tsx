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
  const tintClass = isDanger ? "nt-notice--danger" : "nt-notice--warn";
  const titleToneClass = isDanger ? "nt-text-danger" : "nt-text-warn";

  return (
    <NtCard className={`nt-stack nt-gap-3 ${tintClass}`}>
      <div className="nt-flex nt-items-center nt-justify-between nt-gap-3 nt-wrap">
        <div className="nt-stack nt-gap-1_5">
          <NtBadge tone={badgeTone}>{notice.badgeLabel ?? "依赖服务未连接"}</NtBadge>
          <strong className={titleToneClass}>{notice.title}</strong>
        </div>
        {action ? (
          <Link className="nt-btn nt-btn--secondary" href={action.href}>
            {action.label}
          </Link>
        ) : null}
      </div>
      <span className="nt-text-strong">{notice.body}</span>
      <span className="nt-text-muted nt-text-md">{notice.detail}</span>
    </NtCard>
  );
}
