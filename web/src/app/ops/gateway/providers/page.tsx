import { getOperatorGatewayProviderInventory } from "@/lib/account-client";
import { auth } from "@/auth";
import { NtCard, NtPanel } from "@/components/nt-primitives";
import { buildGatewayDependencyUnavailableNotice } from "@/lib/gateway-catalog-notice";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  buildQueryString,
  formatProviderSurfaceLabel,
  groupProviderInventoryEntries,
  ProviderFamilySummaryCard,
  ProviderSummaryCard,
} from "./provider-inventory-ui";

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
    <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
      <section style={{ display: "grid", gap: 12 }}>
        <span className="nt-kicker">Operator / AI 网关</span>
        <h1 style={{ margin: 0, color: "rgba(243,245,247,0.98)", fontSize: "2rem", lineHeight: 1.1 }}>
          服务商
        </h1>
        <span style={{ color: "rgba(148,163,184,0.92)", fontSize: "0.95rem" }}>
          当前共 {providerGroups.length} 个服务商 family / {providerEntries.length} 条协议 surface
          {providerSummary ? `，路由统计口径已与该 family 维度对齐。` : ""}
        </span>
        <span style={{ color: "rgba(190,199,217,0.82)", fontSize: "0.9rem" }}>
          这里仅显示已经创建到数据库里的服务商 surface。官方/聚合/Web 反代模板入口请走“创建服务商”，其中已包含 `Gemini Platform` 的官方 API、Business Images 与 Canvas 预设。
        </span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="nt-btn nt-btn--primary" href={`/ops/gateway/providers/create?returnTo=${encodeURIComponent(redirectTo)}`}>
            创建服务商
          </Link>
        </div>
      </section>

      {pageParams?.status && pageParams?.message ? (
        <NtPanel
          style={{
            display: "grid",
            gap: 8,
            borderColor: pageParams.status === "success" ? "rgba(34,197,94,0.22)" : "rgba(244,63,94,0.22)",
            background: pageParams.status === "success" ? "rgba(8,39,24,0.7)" : "rgba(39,11,17,0.72)",
          }}
        >
          <span className="nt-kicker">{pageParams.status === "success" ? "操作完成" : "操作失败"}</span>
          <span style={{ color: pageParams.status === "success" ? "#bbf7d0" : "#fecdd3" }}>{pageParams.message}</span>
        </NtPanel>
      ) : null}

      {inventoryResult.notice ? (
        <NtPanel
          role="status"
          aria-live="polite"
          style={{
            display: "grid",
            gap: 8,
            borderColor: "rgba(245,158,11,0.28)",
            background: "rgba(39,28,8,0.72)",
          }}
        >
          <span className="nt-kicker">依赖服务未连接</span>
          <strong style={{ color: "#fde68a" }}>{inventoryResult.notice.title}</strong>
          <span style={{ color: "rgba(254,243,199,0.9)" }}>{inventoryResult.notice.body}</span>
          <span style={{ color: "rgba(254,243,199,0.72)", fontSize: "0.86rem", overflowWrap: "anywhere" }}>
            {inventoryResult.notice.detail}
          </span>
        </NtPanel>
      ) : null}

      <section style={{ display: "grid", gap: 12 }}>
        {providerEntries.length === 0 ? (
          <NtCard style={{ display: "grid", gap: 10 }}>
            <strong style={{ color: "rgba(243,245,247,0.96)" }}>
              {inventoryResult.notice ? "服务商库存暂不可读" : "暂无服务商"}
            </strong>
            {inventoryResult.notice ? (
              <span style={{ color: "rgba(190,199,217,0.76)" }}>
                Gateway 恢复后会自动显示已创建的 provider surface；当前仍可进入“创建服务商”查看模板。
              </span>
            ) : null}
          </NtCard>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
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
