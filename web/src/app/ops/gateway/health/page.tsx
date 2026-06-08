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
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";

const STATE_LIMIT = 120;
const USAGE_LIMIT = 80;

function statusTone(status: string) {
  if (status === "active") return "success";
  if (status === "blocked") return "danger";
  if (status === "cooling") return "warning";
  if (status === "degraded") return "warning";
  return "secondary";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StateRow({ state }: { state: GatewayProviderCredentialModelStateView }) {
  return (
    <NtPanel style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ color: "rgba(243,245,247,0.96)" }}>{state.model}</strong>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <NtBadge tone={statusTone(state.status)}>{state.status}</NtBadge>
          {state.failureClass ? <NtBadge tone="warning">{state.failureClass}</NtBadge> : null}
          {state.failureScope ? <NtBadge tone="glass">{state.failureScope}</NtBadge> : null}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <span className="nt-kicker">Provider: {state.providerAccountId}</span>
        <span className="nt-kicker">Credential: {state.providerCredentialId ?? state.providerCredentialRef ?? "—"}</span>
        <span className="nt-kicker">Profile: {state.protocolProfile ?? "—"}</span>
        <span className="nt-kicker">Failures: {state.failureCount}</span>
        <span className="nt-kicker">Cooldown: {formatDate(state.cooldownUntil)}</span>
        <span className="nt-kicker">Updated: {formatDate(state.updatedAt)}</span>
      </div>
      {state.lastError ? <span style={{ color: "rgba(252,165,165,0.9)" }}>{state.lastError}</span> : null}
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
      continuation: "credential × model 状态机和 usage bucket 暂不可查看；其他运营页面仍可继续使用。",
    });

    return (
      <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
        <NtCard style={{ display: "grid", gap: 16 }}>
          <div>
            <span className="nt-kicker">AI Gateway / Health</span>
            <h1 style={{ margin: "6px 0 0", color: "rgba(243,245,247,0.98)" }}>健康状态与用量聚合</h1>
            <p style={{ margin: "8px 0 0", color: "rgba(148,163,184,0.9)" }}>
              页面已降级为依赖提示，避免 Gateway 离线时整页 500。
            </p>
          </div>
        </NtCard>
        <GatewayDependencyUnavailableCard notice={notice} />
        <NtPanel style={{ color: "rgba(148,163,184,0.9)" }}>当前无法读取 Gateway 健康状态记录。</NtPanel>
      </div>
    );
  }

  const states = statesResult.value;
  const usageSummary = usageSummaryResult.value;
  const usageBuckets = usageBucketsResult.value;

  return (
    <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
      <NtCard style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span className="nt-kicker">AI Gateway / Health</span>
            <h1 style={{ margin: "6px 0 0", color: "rgba(243,245,247,0.98)" }}>健康状态与用量聚合</h1>
            <p style={{ margin: "8px 0 0", color: "rgba(148,163,184,0.9)" }}>
              展示 provider credential × model 状态机、usage queue 聚合摘要与最近 bucket。状态来源于真实请求成功/失败，不依赖请求期探针。
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <NtBadge tone="glass">queue: {usageSummary.queueDepth}</NtBadge>
            <NtBadge tone="cyan">24h req: {usageSummary.recentRequestCount}</NtBadge>
            <NtBadge tone={usageSummary.alerts.length ? "warning" : "success"}>
              alerts: {usageSummary.alerts.length}
            </NtBadge>
          </div>
        </div>
        <form action="/ops/gateway/health" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="nt-input" name="providerAccountId" placeholder="providerAccountId" defaultValue={providerAccountId} />
          <input className="nt-input" name="model" placeholder="model" defaultValue={model} />
          <select className="nt-input" name="status" defaultValue={status}>
            <option value="">全部状态</option>
            <option value="active">active</option>
            <option value="degraded">degraded</option>
            <option value="cooling">cooling</option>
            <option value="blocked">blocked</option>
          </select>
          <button className="nt-btn nt-btn--primary" type="submit">
            筛选
          </button>
        </form>
      </NtCard>

      {usageSummary.alerts.length ? (
        <NtCard style={{ display: "grid", gap: 10 }}>
          <span className="nt-kicker">Operator Alerts</span>
          {usageSummary.alerts.map((alert) => (
            <NtPanel key={alert.code} style={{ color: "rgba(252,211,77,0.92)" }}>
              [{alert.severity}] {alert.code}: {alert.message}
            </NtPanel>
          ))}
        </NtCard>
      ) : null}

      <div className="nt-gateway-split-pane">
        <section style={{ display: "grid", gap: 12 }}>
          {states.map((state) => (
            <StateRow key={state.id} state={state} />
          ))}
          {!states.length ? <NtPanel style={{ color: "rgba(148,163,184,0.9)" }}>当前筛选条件下没有状态记录。</NtPanel> : null}
        </section>

        <NtCard style={{ display: "grid", gap: 12, alignSelf: "start" }}>
          <div>
            <span className="nt-kicker">Usage Buckets</span>
            <h2 style={{ margin: "6px 0 0", color: "rgba(243,245,247,0.98)" }}>最近聚合</h2>
          </div>
          {usageBuckets.slice(0, 20).map((bucket) => (
            <NtPanel key={`${bucket.bucketStart}:${bucket.userId}:${bucket.providerCredentialRef}:${bucket.model}`} style={{ display: "grid", gap: 8 }}>
              <strong style={{ color: "rgba(243,245,247,0.92)" }}>{bucket.model}</strong>
              <span className="nt-kicker">user: {bucket.userId}</span>
              <span className="nt-kicker">credential: {bucket.providerCredentialRef}</span>
              <span className="nt-kicker">
                req {bucket.requestCount} / fail {bucket.failureCount} / tokens {bucket.totalTokens}
              </span>
              <span className="nt-kicker">{formatDate(bucket.bucketStart)}</span>
            </NtPanel>
          ))}
          {!usageBuckets.length ? <span style={{ color: "rgba(148,163,184,0.9)" }}>暂无聚合 bucket。</span> : null}
        </NtCard>
      </div>
    </div>
  );
}
