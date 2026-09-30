import { getOperatorGatewayProviderInventory } from "@/lib/account-client";
import { auth } from "@/auth";
import { NtCard, NtPanel } from "@/components/nt-primitives";
import { buildGatewayDependencyUnavailableNotice } from "@/lib/gateway-catalog-notice";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import {
  buildQueryString,
  formatProviderSurfaceLabel,
  groupProviderInventoryEntries,
  ProviderFamilySummaryCard,
  ProviderSummaryCard,
} from "./provider-inventory-ui";

const PAGE_SHELL_STYLE: CSSProperties = { padding: "24px 0 40px" };

const SUCCESS_NOTICE_STYLE: CSSProperties = {
  borderColor: "var(--neuro-signal-green)",
  background: "var(--neuro-control)",
};

const ERROR_NOTICE_STYLE: CSSProperties = {
  borderColor: "var(--neuro-danger-red)",
  background: "var(--neuro-control)",
};

const DEPENDENCY_NOTICE_STYLE: CSSProperties = {
  borderColor: "var(--neuro-yellow-line)",
  background: "var(--neuro-yellow-soft)",
};

const PROVIDER_GROUP_GRID_STYLE = {
  "--nt-autofit-min": "320px",
  gap: 16,
} as CSSProperties;

type GatewayProviderOpsPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function GatewayProviderOpsPage({ searchParams }: GatewayProviderOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问 AI 网关服务商。")}`);
  }

  const pageParams = searchParams ? await searchParams : undefined;
  const userContext = await requirePlatformOperatorUserContext();
  const inventoryResult = await getOperatorGatewayProviderInventory(userContext)
    .then((inventory) => ({
      inventory,
      notice: null,
    }))
    .catch((error) => ({
      inventory: null,
      notice: buildGatewayDependencyUnavailableNotice(error, {
        resourceName: "服务商库存",
        continuation: "已创建服务商列表暂不可用；创建服务商模板入口仍可打开。",
      }),
    }));
  const providerEntries = inventoryResult.inventory?.providers ?? [];
  const providerGroups = groupProviderInventoryEntries(providerEntries);
  const providerSummary = inventoryResult.inventory?.summary ?? null;
  const redirectTo = "/ops/gateway/providers";

  return (
    <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
      <section className="nt-stack nt-gap-3">
        <span className="nt-kicker">Operator / AI 网关</span>
        <h1 className="nt-flush nt-text-strong nt-text-metric">
          服务商
        </h1>
        <span className="nt-text-muted nt-text-md">
          当前共 {providerGroups.length} 个服务商 family / {providerEntries.length} 条协议 surface
          {providerSummary ? `，路由统计口径已与该 family 维度对齐。` : ""}
        </span>
        <span className="nt-text-muted nt-text-sm">
          这里仅显示已经创建到数据库里的服务商 surface。官方/聚合/Web 反代模板入口请走“创建服务商”，其中已包含 `Gemini Platform` 的官方 API、Business Images 与 Canvas 预设。
        </span>
        <div className="nt-flex nt-wrap nt-gap-2_5">
          <Link className="nt-btn nt-btn--primary" href={`/ops/gateway/providers/create?returnTo=${encodeURIComponent(redirectTo)}`}>
            创建服务商
          </Link>
        </div>
      </section>

      {pageParams?.status && pageParams?.message ? (
        <NtPanel
          className="nt-stack nt-gap-2"
          style={pageParams.status === "success" ? SUCCESS_NOTICE_STYLE : ERROR_NOTICE_STYLE}
        >
          <span className="nt-kicker">{pageParams.status === "success" ? "操作完成" : "操作失败"}</span>
          <span className={pageParams.status === "success" ? "nt-text-success" : "nt-text-danger"}>{pageParams.message}</span>
        </NtPanel>
      ) : null}

      {inventoryResult.notice ? (
        <NtPanel
          role="status"
          aria-live="polite"
          className="nt-stack nt-gap-2"
          style={DEPENDENCY_NOTICE_STYLE}
        >
          <span className="nt-kicker">依赖服务未连接</span>
          <strong className="nt-text-warn">{inventoryResult.notice.title}</strong>
          <span className="nt-text-warn">{inventoryResult.notice.body}</span>
          <span className="nt-text-warn nt-text-sm nt-break-word">
            {inventoryResult.notice.detail}
          </span>
        </NtPanel>
      ) : null}

      <section className="nt-stack nt-gap-3">
        {providerEntries.length === 0 ? (
          <NtCard className="nt-stack nt-gap-2_5">
            <strong className="nt-text-strong">
              {inventoryResult.notice ? "服务商库存暂不可读" : "暂无服务商"}
            </strong>
            {inventoryResult.notice ? (
              <span className="nt-text-muted">
                Gateway 恢复后会自动显示已创建的 provider surface；当前仍可进入“创建服务商”查看模板。
              </span>
            ) : null}
          </NtCard>
        ) : (
          <div className="nt-autofit" style={PROVIDER_GROUP_GRID_STYLE}>
            {providerGroups.map((group) => {
              if (group.entries.length === 1) {
                const [entry] = group.entries;
                const detailHref = `/ops/gateway/providers/${encodeURIComponent(entry.providerAccount.id)}${buildQueryString({
                  returnTo: redirectTo,
                })}`;
                return <ProviderSummaryCard key={entry.providerAccount.id} entry={entry} detailHref={detailHref} />;
              }

              const detailLinks = group.entries.map((entry) => ({
                providerAccountId: entry.providerAccount.id,
                label: `${formatProviderSurfaceLabel(entry.providerAccount)} 详情`,
                href: `/ops/gateway/providers/${encodeURIComponent(entry.providerAccount.id)}${buildQueryString({
                  returnTo: redirectTo,
                })}`,
              }));

              return <ProviderFamilySummaryCard key={group.familyKey} group={group} detailLinks={detailLinks} />;
            })}
          </div>
        )}
      </section>

    </div>
  );
}
