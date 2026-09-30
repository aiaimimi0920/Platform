import { auth } from "@/auth";
import { GatewayDependencyUnavailableCard } from "@/components/gateway-dependency-unavailable-card";
import { NtBadge, NtCard, NtPanel } from "@/components/nt-primitives";
import {
  listOperatorGatewayProviderCredentialModelStates,
  listOperatorGatewayUsageAggregates,
  summarizeOperatorGatewayUsageAggregates,
  type GatewayProviderCredentialModelStateView,
} from "@/lib/account-client";
import { buildGatewayDependencyUnavailableNotice } from "@/lib/gateway-catalog-notice";
import { formatPlatformDateTime } from "@/lib/platform-date-time";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { gatewayCredentialModelStatusLabel } from "../status-labels";

const STATE_LIMIT = 120;
const USAGE_LIMIT = 80;

/*
 * Layout and color now run through the shared `nt-` utility classes, so these constants hold
 * only what the vocabulary has no class for: the page shell padding, the two heading offsets,
 * the auto-fit track floor and the sidebar's self-alignment. Keeping them at module scope
 * means one allocation per process instead of one per render.
 */
const PAGE_SHELL_STYLE: CSSProperties = { padding: "24px 0 40px" };
const HEADING_STYLE: CSSProperties = { margin: "6px 0 0" };
const LEAD_PARAGRAPH_STYLE: CSSProperties = { margin: "8px 0 0" };
const STATE_META_GRID_STYLE = { "--nt-autofit-min": "180px" } as CSSProperties;
const SIDE_PANEL_STYLE: CSSProperties = { alignSelf: "start" };

function statusTone(status: string) {
  if (status === "active") return "success";
  if (status === "blocked") return "danger";
  if (status === "cooling") return "warning";
  if (status === "degraded") return "warning";
  return "secondary";
}

function formatDate(value: string | null) {
  return formatPlatformDateTime(value, "—");
}

function StateRow({ state }: { state: GatewayProviderCredentialModelStateView }) {
  return (
    <NtPanel className="nt-stack nt-gap-2_5">
      <div className="nt-flex nt-justify-between nt-gap-2_5 nt-wrap">
        <strong className="nt-text-strong">{state.model}</strong>
        <div className="nt-flex nt-gap-1_5 nt-wrap">
          <NtBadge tone={statusTone(state.status)}>{gatewayCredentialModelStatusLabel(state.status)}</NtBadge>
          {state.failureClass ? <NtBadge tone="warning">{state.failureClass}</NtBadge> : null}
          {state.failureScope ? <NtBadge tone="glass">{state.failureScope}</NtBadge> : null}
        </div>
      </div>
      <div className="nt-autofit nt-gap-2_5" style={STATE_META_GRID_STYLE}>
        <span className="nt-kicker">服务商：{state.providerAccountId}</span>
        <span className="nt-kicker">凭证：{state.providerCredentialId ?? state.providerCredentialRef ?? "—"}</span>
        <span className="nt-kicker">协议配置：{state.protocolProfile ?? "—"}</span>
        <span className="nt-kicker">失败次数：{state.failureCount}</span>
        <span className="nt-kicker">冷却截止：{formatDate(state.cooldownUntil)}</span>
        <span className="nt-kicker">更新时间：{formatDate(state.updatedAt)}</span>
      </div>
      {state.lastError ? <span className="nt-text-danger">{state.lastError}</span> : null}
    </NtPanel>
  );
}

export default async function GatewayHealthPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问 AI 网关健康状态。")}`);
  }

  const userContext = await requirePlatformOperatorUserContext();
  const params = searchParams ? await searchParams : {};
  const status = typeof params.status === "string" ? params.status.trim() : "";
  const providerAccountId =
    typeof params.providerAccountId === "string" ? params.providerAccountId.trim() : "";
  const model = typeof params.model === "string" ? params.model.trim() : "";

  const [statesResult, usageSummaryResult, usageBucketsResult] = await Promise.allSettled([
    listOperatorGatewayProviderCredentialModelStates(userContext, {
      status: status || undefined,
      providerAccountId: providerAccountId || undefined,
      model: model || undefined,
      limit: STATE_LIMIT,
    }),
    summarizeOperatorGatewayUsageAggregates(userContext),
    listOperatorGatewayUsageAggregates(userContext, { limit: USAGE_LIMIT }),
  ]);

  if (
    statesResult.status === "rejected" ||
    usageSummaryResult.status === "rejected" ||
    usageBucketsResult.status === "rejected"
  ) {
    let dependencyError: unknown;
    if (statesResult.status === "rejected") {
      dependencyError = statesResult.reason;
    } else if (usageSummaryResult.status === "rejected") {
      dependencyError = usageSummaryResult.reason;
    } else if (usageBucketsResult.status === "rejected") {
      dependencyError = usageBucketsResult.reason;
    }
    const notice = buildGatewayDependencyUnavailableNotice(dependencyError, {
      resourceName: "健康状态与用量聚合",
      continuation: "凭证 × 模型状态机和用量聚合桶暂不可查看；其他运营页面仍可继续使用。",
    });

    return (
      <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
        <NtCard className="nt-stack nt-gap-4">
          <div>
            <span className="nt-kicker">AI 网关 / 健康状态</span>
            <h1 className="nt-text-strong" style={HEADING_STYLE}>健康状态与用量聚合</h1>
            <p className="nt-text-muted" style={LEAD_PARAGRAPH_STYLE}>
              页面已降级为依赖提示，避免 Gateway 离线时整页 500。
            </p>
          </div>
        </NtCard>
        <GatewayDependencyUnavailableCard notice={notice} />
        <NtPanel className="nt-text-muted">当前无法读取 Gateway 健康状态记录。</NtPanel>
      </div>
    );
  }

  const states = statesResult.value;
  const usageSummary = usageSummaryResult.value;
  const usageBuckets = usageBucketsResult.value;

  return (
    <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
      <NtCard className="nt-stack nt-gap-4">
        <div className="nt-flex nt-justify-between nt-gap-4 nt-wrap">
          <div>
            <span className="nt-kicker">AI 网关 / 健康状态</span>
            <h1 className="nt-text-strong" style={HEADING_STYLE}>健康状态与用量聚合</h1>
            <p className="nt-text-muted" style={LEAD_PARAGRAPH_STYLE}>
              展示服务商凭证 × 模型状态机、用量队列聚合摘要与最近聚合桶。状态来源于真实请求成功/失败，不依赖请求期探针。
            </p>
          </div>
          <div className="nt-flex nt-gap-2 nt-items-center nt-wrap">
            <NtBadge tone="glass">队列：{usageSummary.queueDepth}</NtBadge>
            <NtBadge tone="cyan">24 小时请求：{usageSummary.recentRequestCount}</NtBadge>
            <NtBadge tone={usageSummary.alerts.length ? "warning" : "success"}>
              告警：{usageSummary.alerts.length}
            </NtBadge>
          </div>
        </div>
        <form action="/ops/gateway/health" className="nt-flex nt-gap-2_5 nt-wrap">
          <input className="nt-input" name="providerAccountId" placeholder="providerAccountId" defaultValue={providerAccountId} />
          <input className="nt-input" name="model" placeholder="model" defaultValue={model} />
          <select className="nt-input" name="status" defaultValue={status}>
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="degraded">降级</option>
            <option value="cooling">冷却中</option>
            <option value="blocked">已阻断</option>
          </select>
          <button className="nt-btn nt-btn--primary" type="submit">
            筛选
          </button>
        </form>
      </NtCard>

      {usageSummary.alerts.length ? (
        <NtCard className="nt-stack nt-gap-2_5">
          <span className="nt-kicker">运维告警</span>
          {usageSummary.alerts.map((alert) => (
            <NtPanel key={alert.code} className="nt-text-warn">
              [{alert.severity}] {alert.code}: {alert.message}
            </NtPanel>
          ))}
        </NtCard>
      ) : null}

      <div className="nt-gateway-split-pane">
        <section className="nt-stack nt-gap-3">
          {states.map((state) => (
            <StateRow key={state.id} state={state} />
          ))}
          {!states.length ? <NtPanel className="nt-text-muted">当前筛选条件下没有状态记录。</NtPanel> : null}
        </section>

        <NtCard className="nt-stack nt-gap-3" style={SIDE_PANEL_STYLE}>
          <div>
            <span className="nt-kicker">用量聚合</span>
            <h2 className="nt-text-strong" style={HEADING_STYLE}>最近聚合</h2>
          </div>
          {usageBuckets.slice(0, 20).map((bucket) => (
            <NtPanel key={`${bucket.bucketStart}:${bucket.userId}:${bucket.providerCredentialRef}:${bucket.model}`} className="nt-stack nt-gap-2">
              <strong className="nt-text-strong">{bucket.model}</strong>
              <span className="nt-kicker">用户：{bucket.userId}</span>
              <span className="nt-kicker">凭证：{bucket.providerCredentialRef}</span>
              <span className="nt-kicker">
                请求 {bucket.requestCount} / 失败 {bucket.failureCount} / Token {bucket.totalTokens}
              </span>
              <span className="nt-kicker">{formatDate(bucket.bucketStart)}</span>
            </NtPanel>
          ))}
          {!usageBuckets.length ? <span className="nt-text-muted">暂无聚合桶。</span> : null}
        </NtCard>
      </div>
    </div>
  );
}
