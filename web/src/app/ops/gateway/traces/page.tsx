import type {
  GatewayRouteTraceCandidate,
  GatewayRequestStatus,
  GatewayRequestAuditView,
} from "@/lib/account-client";
import { auth } from "@/auth";
import { GatewayDependencyUnavailableCard } from "@/components/gateway-dependency-unavailable-card";
import {
  getOperatorGatewayRequestArtifacts,
  getOperatorGatewayRequestAudit,
  getOperatorGatewayRequestAuditSummary,
  listOperatorGatewayRequestAudits,
} from "@/lib/account-client";
import { buildGatewayDependencyUnavailableNotice } from "@/lib/gateway-catalog-notice";
import { formatPlatformDateTime } from "@/lib/platform-date-time";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { NtBadge, NtCard, NtPanel } from "@/components/nt-primitives";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

type TracePageQuery = {
  requestId?: string;
  status?: string;
  q?: string;
};

const REQUEST_LIMIT = 60;
const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "running", label: "运行中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "cancelled", label: "已取消" },
] as const;

/*
 * Layout and color now run through the shared `nt-` utility layer, so these constants keep
 * only what the vocabulary has no class for: the fixed request-row tracks, the filter form's
 * three-column form grid, the auto-fit minimums, and the token-colored row/candidate
 * surfaces. Module scope means one allocation per process instead of one per render.
 */
const PAGE_SHELL_STYLE: CSSProperties = { padding: "24px 0 40px" };

const SUMMARY_GRID_STYLE = { "--nt-autofit-min": "180px" } as CSSProperties;

const SUMMARY_VALUE_STYLE: CSSProperties = { fontSize: "1.9rem" };

const FILTER_FORM_STYLE: CSSProperties = {
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  alignItems: "end",
};

/*
 * The padding, radius, border and surface of a request row come from `nt-row-tile`; only the
 * link reset and the selected-row overrides stay inline. The row renders 60 times per response
 * and each inline `style` attribute is serialized twice (HTML plus RSC flight payload), so the
 * fewer properties left here the smaller the payload.
 */
const REQUEST_ROW_STYLE: CSSProperties = {
  textDecoration: "none",
};

const REQUEST_ROW_SELECTED_STYLE: CSSProperties = {
  ...REQUEST_ROW_STYLE,
  border: "1px solid var(--neuro-info-blue)",
  background: "var(--neuro-control)",
};

const REQUEST_ID_STYLE: CSSProperties = { fontWeight: 600 };

const REQUEST_DETAIL_GRID_STYLE = { "--nt-autofit-min": "160px" } as CSSProperties;

const CANDIDATE_META_GRID_STYLE = { "--nt-autofit-min": "140px" } as CSSProperties;

const CANDIDATE_PANEL_STYLE: CSSProperties = {
  borderColor: "transparent",
  background: "var(--neuro-surface)",
};

const CANDIDATE_PANEL_SELECTED_STYLE: CSSProperties = {
  borderColor: "var(--neuro-info-blue)",
  background: "var(--neuro-control)",
};

function buildTraceQuery(params: TracePageQuery) {
  const search = new URLSearchParams();
  if (params.requestId) search.set("requestId", params.requestId);
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return query ? `?${query}` : "";
}

function formatDate(value: string | null) {
  return formatPlatformDateTime(value, "—");
}

function formatDurationMs(value: number | null) {
  if (value == null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function formatCount(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("zh-CN").format(value);
}

function getSourceKindLabel(sourceKind: string) {
  switch (sourceKind) {
    case "official_model_api":
      return "官方单模型 API";
    case "official_vendor_api":
      return "官方 API";
    case "aggregator_api":
      return "聚合 API";
    case "web_reverse_api":
      return "Web 转 API";
    default:
      return sourceKind;
  }
}

function getPipelineLabel(mode: string | null | undefined) {
  switch (mode) {
    case "same_protocol_fast_path":
      return "同协议直连";
    case "canonical_transform":
      return "Canonical 转换";
    case "provider_passthrough":
      return "服务商透传";
    default:
      return mode ?? "—";
  }
}

function getRequestProviderLabel(request: GatewayRequestAuditView) {
  return request.routeTrace?.selectedCandidate?.providerLabel ?? request.providerAccountId ?? "—";
}

function getRequestSearchText(request: GatewayRequestAuditView) {
  return [
    request.id,
    request.requestedModel ?? "",
    request.resolvedModel ?? "",
    request.endpointKind,
    request.protocolFamily,
    request.providerAccountId ?? "",
    getRequestProviderLabel(request),
    request.errorSummary ?? "",
    request.routeTrace?.selectedPipelineMode ?? "",
    request.routeTrace?.selectedCandidate?.realCredentialRef ?? "",
    request.routeTrace?.selectedCandidate?.platformAccessId ?? request.routeTrace?.platformAccessId ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function buildRouteDecisionReasons(request: GatewayRequestAuditView) {
  const routeTrace = request.routeTrace;
  if (!routeTrace) return [] as string[];
  const selected = routeTrace.selectedCandidate ?? null;
  const candidateQueue = Array.isArray(routeTrace.candidateQueue) ? routeTrace.candidateQueue : [];
  const alternatives = selected
    ? candidateQueue.filter((candidate) => candidate.providerAccountId !== selected.providerAccountId)
    : candidateQueue;
  const reasons: string[] = [];

  if (!selected) {
    reasons.push("当前请求未记录已选路由候选。");
  }
  if (selected && routeTrace.stickyProviderAccountId === selected.providerAccountId) {
    reasons.push("命中了粘性服务商策略。");
  }
  if (routeTrace.selectedPipelineMode === "same_protocol_fast_path") {
    reasons.push("当前请求走同协议直连快路径。");
  } else if (selected && routeTrace.requestedProtocolFamily && routeTrace.requestedProtocolFamily !== selected.protocolFamily) {
    reasons.push(`入口协议 ${routeTrace.requestedProtocolFamily} 与上游协议 ${selected.protocolFamily} 不同，已走统一桥接链。`);
  }
  const nextBest = alternatives[0];
  if (selected?.routingScore != null && nextBest?.routingScore != null && selected.routingScore !== nextBest.routingScore) {
    reasons.push(`所选服务商路由分数更高（${selected.routingScore.toFixed(2)} > ${nextBest.routingScore.toFixed(2)}）。`);
  }
  if (selected && !selected.degraded && alternatives.some((candidate) => candidate.degraded)) {
    reasons.push("其他候选带有降级信号，当前优先选择未降级候选。");
  }
  if (routeTrace.fallbackEligible) {
    reasons.push(routeTrace.routeAttempt > 1 ? `当前已进入第 ${routeTrace.routeAttempt} 次尝试。` : "本次请求允许回退。");
  }
  if (routeTrace.browserExecutionStatus) {
    reasons.push(`浏览器执行状态：${routeTrace.browserExecutionStatus}。`);
  }
  if (routeTrace.errorCode || routeTrace.errorMessage) {
    reasons.push(`最终错误：${routeTrace.errorCode ?? routeTrace.errorMessage}。`);
  }
  return reasons;
}

function StatusBadge({ status }: { status: GatewayRequestStatus }) {
  const tone =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "running"
          ? "cyan"
          : "secondary";
  return <NtBadge tone={tone}>{getRequestStatusLabel(status)}</NtBadge>;
}

function getRequestStatusLabel(status: GatewayRequestStatus) {
  switch (status) {
    case "running":
      return "运行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}

function DetailLine(props: { label: string; value: string }) {
  return (
    <div className="nt-stack nt-gap-1">
      <span className="nt-kicker nt-text-2xs">
        {props.label}
      </span>
      <span className="nt-text-muted nt-break-word">{props.value}</span>
    </div>
  );
}

function CandidateRow({ candidate, isSelected }: { candidate: GatewayRouteTraceCandidate; isSelected?: boolean }) {
  return (
    <NtPanel
      className="nt-stack nt-gap-2_5"
      style={isSelected ? CANDIDATE_PANEL_SELECTED_STYLE : CANDIDATE_PANEL_STYLE}
    >
      <div className="nt-flex nt-justify-between nt-gap-2_5 nt-wrap">
        <strong className="nt-text-strong">{candidate.providerLabel}</strong>
        <div className="nt-flex nt-gap-1_5 nt-wrap">
          <NtBadge tone="glass">{candidate.adapter}</NtBadge>
          <NtBadge tone="glass">{getSourceKindLabel(candidate.sourceProfile.sourceKind)}</NtBadge>
          {candidate.stickyPreferred ? <NtBadge tone="cyan">粘性</NtBadge> : null}
          {candidate.sameProtocolFastPathEligible ? <NtBadge tone="success">同协议</NtBadge> : null}
        </div>
      </div>

      <div className="nt-autofit nt-gap-2_5" style={CANDIDATE_META_GRID_STYLE}>
        <DetailLine label="模型" value={candidate.resolvedModel ?? "—"} />
        <DetailLine label="协议族" value={candidate.protocolFamily} />
        <DetailLine label="优先级" value={candidate.priority != null ? String(candidate.priority) : "—"} />
        <DetailLine
          label="路由分数"
          value={candidate.routingScore != null ? candidate.routingScore.toFixed(2) : "—"}
        />
        <DetailLine label="并发" value={candidate.activeConcurrency != null ? String(candidate.activeConcurrency) : "—"} />
        <DetailLine label="失败次数" value={candidate.failureCount != null ? String(candidate.failureCount) : "—"} />
        <DetailLine label="桥接策略" value={candidate.protocolBridgeStrategy ?? "—"} />
      </div>

      {candidate.degradationReasons?.length ? (
        <div className="nt-stack nt-gap-1">
          <span className="nt-kicker">降级原因</span>
          <span className="nt-text-warn">{candidate.degradationReasons.join(" / ")}</span>
        </div>
      ) : null}
    </NtPanel>
  );
}

function RequestEventRow(props: {
  request: GatewayRequestAuditView;
  selected: boolean;
  statusFilter: string;
  searchQuery: string;
}) {
  const { request } = props;
  const href = `/ops/gateway/traces${buildTraceQuery({
    requestId: request.id,
    status: props.statusFilter || undefined,
    q: props.searchQuery || undefined,
  })}`;
  return (
    <Link
      className="nt-stack nt-gap-2_5 nt-row-tile"
      href={href}
      style={props.selected ? REQUEST_ROW_SELECTED_STYLE : REQUEST_ROW_STYLE}
    >
      <div className="nt-flex nt-justify-between nt-gap-2_5 nt-wrap nt-items-center">
        <div className="nt-flex nt-gap-2 nt-wrap nt-items-center">
          <StatusBadge status={request.status} />
          <span className="nt-text-strong" style={REQUEST_ID_STYLE}>{request.id}</span>
        </div>
        <span className="nt-text-muted">{formatDate(request.createdAt)}</span>
      </div>

      <div
        className="nt-gateway-request-grid"
      >
        <div className="nt-stack nt-gap-1">
          <span className="nt-kicker">模型</span>
          <span className="nt-text-muted">
            {request.requestedModel ?? "—"} → {request.resolvedModel ?? "—"}
          </span>
          <span className="nt-text-soft">{request.endpointKind}</span>
        </div>
        <div className="nt-stack nt-gap-1">
          <span className="nt-kicker">服务商</span>
          <span className="nt-text-muted">{getRequestProviderLabel(request)}</span>
          <span className="nt-text-soft">{request.providerAccountId ?? "—"}</span>
        </div>
        <div className="nt-stack nt-gap-1">
          <span className="nt-kicker">管线</span>
          <span className="nt-text-muted">
            {getPipelineLabel(request.routeTrace?.selectedPipelineMode ?? null)}
          </span>
        </div>
        <div className="nt-stack nt-gap-1">
          <span className="nt-kicker">耗时</span>
          <span className="nt-text-muted">{formatDurationMs(request.durationMs)}</span>
        </div>
        <div className="nt-stack nt-gap-1">
          <span className="nt-kicker">Token 用量</span>
          <span className="nt-text-muted">{formatCount(request.totalTokens)}</span>
        </div>
      </div>

      {request.errorSummary ? (
        <span className="nt-text-danger">{request.errorSummary}</span>
      ) : null}
    </Link>
  );
}

export default async function GatewayTracesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问 AI 网关请求追踪。")}`);
  }
  const userContext = await requirePlatformOperatorUserContext();

  const params = searchParams ? await searchParams : {};
  const statusFilter = typeof params.status === "string" ? params.status.trim() : "";
  const searchQuery = typeof params.q === "string" ? params.q.trim() : "";

  const [requestListResult, summaryResult] = await Promise.allSettled([
    listOperatorGatewayRequestAudits(userContext, { status: statusFilter || undefined, limit: REQUEST_LIMIT }),
    getOperatorGatewayRequestAuditSummary(userContext, { limit: REQUEST_LIMIT }),
  ]);

  if (requestListResult.status === "rejected" || summaryResult.status === "rejected") {
    let dependencyError: unknown;
    if (requestListResult.status === "rejected") {
      dependencyError = requestListResult.reason;
    } else if (summaryResult.status === "rejected") {
      dependencyError = summaryResult.reason;
    }
    const notice = buildGatewayDependencyUnavailableNotice(dependencyError, {
      resourceName: "请求追踪",
      continuation: "请求审计列表、路由判定和请求物料暂不可查看；其他运营页面仍可继续使用。",
    });

    return (
      <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
        <section className="nt-stack nt-gap-3">
          <span className="nt-kicker">运维 / AI 网关</span>
          <h1 className="nt-flush nt-text-strong nt-text-metric">
            请求追踪
          </h1>
        </section>
        <GatewayDependencyUnavailableCard notice={notice} />
        <NtCard className="nt-stack nt-gap-2">
          <span className="nt-kicker">请求事件明细</span>
          <strong className="nt-text-strong">当前无法连接 AI 网关</strong>
          <span className="nt-text-muted">
            网关服务恢复后，刷新页面即可重新加载最近 {REQUEST_LIMIT} 条请求。
          </span>
        </NtCard>
      </div>
    );
  }

  const requestList = requestListResult.value;
  const summary = summaryResult.value;

  const filteredRequests = requestList.filter((request) =>
    searchQuery ? getRequestSearchText(request).includes(searchQuery.toLowerCase()) : true,
  );

  const fastPathCount = filteredRequests.filter(
    (request) => request.routeTrace?.selectedPipelineMode === "same_protocol_fast_path",
  ).length;
  const fallbackEligibleCount = filteredRequests.filter((request) => request.routeTrace?.fallbackEligible).length;
  const failedCount = filteredRequests.filter((request) => request.status === "failed").length;

  const selectedRequestId =
    typeof params.requestId === "string" && params.requestId ? params.requestId : filteredRequests[0]?.id ?? null;

  let selectedRequest: GatewayRequestAuditView | null = null;
  let artifacts: Awaited<ReturnType<typeof getOperatorGatewayRequestArtifacts>> | null = null;
  let selectedRequestNotice: ReturnType<typeof buildGatewayDependencyUnavailableNotice> | null = null;
  if (selectedRequestId) {
    const [selectedRequestResult, artifactsResult] = await Promise.allSettled([
      getOperatorGatewayRequestAudit(userContext, selectedRequestId),
      getOperatorGatewayRequestArtifacts(userContext, selectedRequestId),
    ]);
    if (selectedRequestResult.status === "fulfilled") {
      selectedRequest = selectedRequestResult.value;
    } else {
      selectedRequestNotice = buildGatewayDependencyUnavailableNotice(selectedRequestResult.reason, {
        resourceName: "选中请求明细",
        continuation: "左侧请求列表仍可查看，明细面板暂不可用。",
      });
    }
    if (artifactsResult.status === "fulfilled") {
      artifacts = artifactsResult.value;
    } else if (!selectedRequestNotice) {
      selectedRequestNotice = buildGatewayDependencyUnavailableNotice(artifactsResult.reason, {
        resourceName: "请求物料",
        continuation: "请求摘要仍可查看，物料预览暂不可用。",
      });
    }
  }

  const selectedRouteTrace = selectedRequest?.routeTrace;
  const selectedCandidate = selectedRouteTrace?.selectedCandidate ?? null;
  const selectedCandidateQueue = Array.isArray(selectedRouteTrace?.candidateQueue)
    ? selectedRouteTrace.candidateQueue
    : [];
  const selectedProviderAccountId = selectedCandidate?.providerAccountId ?? selectedRequest?.providerAccountId ?? null;

  return (
    <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
      <section className="nt-stack nt-gap-3">
        <span className="nt-kicker">运维 / AI 网关</span>
        <h1 className="nt-flush nt-text-strong nt-text-metric">
          请求追踪
        </h1>
      </section>

      <section className="nt-autofit nt-gap-3_5" style={SUMMARY_GRID_STYLE}>
        <NtCard className="nt-stack nt-gap-2">
          <span className="nt-kicker">样本数</span>
          <strong className="nt-text-strong" style={SUMMARY_VALUE_STYLE}>{filteredRequests.length}</strong>
          <span className="nt-text-soft">总计 {summary.totalRequests}</span>
        </NtCard>
        <NtCard className="nt-stack nt-gap-2">
          <span className="nt-kicker">失败</span>
          <strong className="nt-text-danger" style={SUMMARY_VALUE_STYLE}>{failedCount}</strong>
          <span className="nt-text-soft">全量 {summary.failedCount}</span>
        </NtCard>
        <NtCard className="nt-stack nt-gap-2">
          <span className="nt-kicker">同协议直连</span>
          <strong className="nt-text-success" style={SUMMARY_VALUE_STYLE}>{fastPathCount}</strong>
          <span className="nt-text-soft">当前结果集</span>
        </NtCard>
        <NtCard className="nt-stack nt-gap-2">
          <span className="nt-kicker">允许回退</span>
          <strong className="nt-text-warn" style={SUMMARY_VALUE_STYLE}>{fallbackEligibleCount}</strong>
          <span className="nt-text-soft">当前结果集</span>
        </NtCard>
      </section>

      <NtCard className="nt-stack nt-gap-3_5">
        <form
          action="/ops/gateway/traces"
          className="nt-stack nt-gap-3"
          method="get"
          style={FILTER_FORM_STYLE}
        >
          <label className="nt-stack nt-gap-1_5">
            <span className="nt-kicker">检索</span>
            <input
              className="nt-input"
              defaultValue={searchQuery}
              name="q"
              placeholder="请求 ID / 模型 / 服务商 / 错误"
            />
          </label>
          <label className="nt-stack nt-gap-1_5">
            <span className="nt-kicker">状态</span>
            <select className="nt-input" defaultValue={statusFilter} name="status">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="nt-flex nt-gap-2_5 nt-wrap">
            <button className="nt-btn nt-btn--primary" type="submit">
              查询
            </button>
            <Link className="nt-btn nt-btn--secondary" href="/ops/gateway/traces">
              清空
            </Link>
          </div>
        </form>
      </NtCard>

      <div className="nt-gateway-split-pane">
        <NtCard className="nt-stack nt-gap-3_5">
          <div className="nt-flex nt-justify-between nt-gap-3 nt-wrap nt-items-center">
            <div className="nt-stack nt-gap-1">
              <span className="nt-kicker">请求事件明细</span>
              <strong className="nt-text-strong">最近 {REQUEST_LIMIT} 条请求</strong>
            </div>
            <NtBadge tone="glass">{filteredRequests.length} 条</NtBadge>
          </div>

          <div className="nt-stack nt-gap-2_5">
            {filteredRequests.length ? (
              filteredRequests.map((request) => (
                <RequestEventRow
                  key={request.id}
                  request={request}
                  selected={request.id === selectedRequestId}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                />
              ))
            ) : (
              <NtPanel className="nt-stack nt-gap-2">
                <span className="nt-kicker">请求事件明细</span>
                <strong className="nt-text-strong">没有命中结果</strong>
                <span className="nt-text-muted">调整状态或关键字后再查。</span>
              </NtPanel>
            )}
          </div>
        </NtCard>

        <div className="nt-gateway-sticky-panel">
          {selectedRequestNotice ? <GatewayDependencyUnavailableCard notice={selectedRequestNotice} /> : null}
          {selectedRequest ? (
            <>
              <NtCard className="nt-stack nt-gap-3">
                <div className="nt-stack nt-gap-1">
                  <span className="nt-kicker">当前请求</span>
                  <strong className="nt-text-strong">{selectedRequest.id}</strong>
                </div>
                <div className="nt-autofit" style={REQUEST_DETAIL_GRID_STYLE}>
                  <DetailLine label="状态" value={selectedRequest.status} />
                  <DetailLine label="创建时间" value={formatDate(selectedRequest.createdAt)} />
                  <DetailLine label="端点" value={selectedRequest.endpointKind} />
                  <DetailLine label="协议族" value={selectedRequest.protocolFamily} />
                  <DetailLine label="耗时" value={formatDurationMs(selectedRequest.durationMs)} />
                  <DetailLine label="上游状态" value={selectedRequest.upstreamStatus != null ? String(selectedRequest.upstreamStatus) : "—"} />
                  <DetailLine label="请求模型" value={selectedRequest.requestedModel ?? "—"} />
                  <DetailLine label="解析模型" value={selectedRequest.resolvedModel ?? "—"} />
                  <DetailLine label="服务商" value={getRequestProviderLabel(selectedRequest)} />
                  <DetailLine label="服务商 ID" value={selectedRequest.providerAccountId ?? "—"} />
                  <DetailLine label="执行管线" value={getPipelineLabel(selectedRequest.routeTrace?.selectedPipelineMode)} />
                  <DetailLine label="Token 用量" value={formatCount(selectedRequest.totalTokens)} />
                </div>
                {selectedRequest.errorSummary ? (
                  <NtPanel className="nt-stack nt-gap-1">
                    <span className="nt-kicker">错误摘要</span>
                    <span className="nt-text-danger">{selectedRequest.errorSummary}</span>
                  </NtPanel>
                ) : null}
              </NtCard>

              <NtCard className="nt-stack nt-gap-2_5">
                <span className="nt-kicker">路由判定</span>
                {buildRouteDecisionReasons(selectedRequest).length ? (
                  buildRouteDecisionReasons(selectedRequest).map((reason) => (
                    <span key={reason} className="nt-text-muted">
                      {reason}
                    </span>
                  ))
                ) : (
                  <span className="nt-text-muted">当前没有额外路由说明。</span>
                )}
              </NtCard>

              <NtCard className="nt-stack nt-gap-3">
                <span className="nt-kicker">候选队列</span>
                {selectedCandidateQueue.length ? (
                  selectedCandidateQueue.map((candidate) => (
                    <CandidateRow
                      key={candidate.providerAccountId}
                      candidate={candidate}
                      isSelected={candidate.providerAccountId === selectedProviderAccountId}
                    />
                  ))
                ) : (
                  <span className="nt-text-muted">当前请求没有候选队列数据。</span>
                )}
              </NtCard>

              <NtCard className="nt-stack nt-gap-2_5">
                <span className="nt-kicker">已选候选</span>
                <DetailLine
                  label="服务商"
                  value={selectedCandidate?.providerLabel ?? "—"}
                />
                <DetailLine
                  label="平台访问"
                  value={
                    selectedCandidate?.platformAccessId ??
                    selectedRouteTrace?.platformAccessId ??
                    "—"
                  }
                />
                <DetailLine
                  label="来源访问密钥"
                  value={
                    selectedCandidate?.sourceAccessKeyId ??
                    selectedRouteTrace?.sourceAccessKeyId ??
                    "—"
                  }
                />
                <DetailLine
                  label="真实凭证"
                  value={
                    selectedCandidate?.realCredentialRef ??
                    selectedRouteTrace?.realCredentialRef ??
                    "—"
                  }
                />
                <Link
                  className="nt-btn nt-btn--secondary"
                  href={`/ops/gateway/providers?selected=${selectedProviderAccountId ?? ""}`}
                >
                  打开服务商
                </Link>
              </NtCard>

              <NtCard className="nt-stack nt-gap-2_5">
                <span className="nt-kicker">访问凭证</span>
                <DetailLine label="访问密钥" value={selectedRequest.accessKeyId ?? "—"} />
                <DetailLine label="来源访问密钥" value={selectedRequest.sourceAccessKeyId ?? "—"} />
                <DetailLine label="旧版 API 密钥" value={selectedRequest.apiKeyId ?? "—"} />
                <DetailLine label="用户凭证" value={selectedRequest.userCredentialId ?? "—"} />
                <DetailLine label="上一轮响应" value={selectedRequest.previousResponseId ?? "—"} />
                <DetailLine label="会话" value={selectedRequest.sessionId ?? "—"} />
              </NtCard>

              <NtCard className="nt-stack nt-gap-2_5">
                <span className="nt-kicker">保活与执行链</span>
                <DetailLine
                  label="显式会话密钥"
                  value={selectedRequest.analysisProfile?.hasExplicitSessionKey ? "已记录" : "未记录"}
                />
                <DetailLine
                  label="上一轮响应"
                  value={selectedRequest.analysisProfile?.hasPreviousResponse ? "是" : "否"}
                />
                <DetailLine
                  label="浏览器状态"
                  value={selectedRequest.routeTrace?.browserExecutionStatus ?? "—"}
                />
                <DetailLine label="租约 ID" value={selectedRequest.routeTrace?.executorLeaseId ?? "—"} />
                <DetailLine
                  label="租约到期"
                  value={formatDate(selectedRequest.routeTrace?.executorLeaseExpiresAt ?? null)}
                />
                <DetailLine
                  label="释放原因"
                  value={selectedRequest.routeTrace?.executorLeaseReleaseReason ?? "—"}
                />
              </NtCard>

              <NtCard className="nt-stack nt-gap-2_5">
                <span className="nt-kicker">请求物料</span>
                <DetailLine
                  label="请求物料"
                  value={artifacts?.requestArtifact ? artifacts.requestArtifact.canonicalRequest.endpointKind : "—"}
                />
                <DetailLine
                  label="消息 / 工具 / 附件"
                  value={
                    artifacts?.requestArtifact
                      ? `${formatCount(artifacts.requestArtifact.canonicalRequest.messages.length)} / ${formatCount(
                          artifacts.requestArtifact.canonicalRequest.tools.length,
                        )} / ${formatCount(artifacts.requestArtifact.canonicalRequest.attachments.length)}`
                      : "—"
                  }
                />
                <DetailLine
                  label="响应预览"
                  value={
                    artifacts?.responseArtifact
                      ? `${artifacts.responseArtifact.result.text.slice(0, 80)}${artifacts.responseArtifact.result.text.length > 80 ? "…" : ""}`
                      : "—"
                  }
                />
                <DetailLine
                  label="响应用量"
                  value={
                    artifacts?.responseArtifact?.usage
                      ? `${formatCount(artifacts.responseArtifact.usage.promptTokens)} / ${formatCount(
                          artifacts.responseArtifact.usage.completionTokens,
                        )} / ${formatCount(artifacts.responseArtifact.usage.totalTokens)}`
                      : "—"
                  }
                />
                <DetailLine
                  label="运行时状态"
                  value={artifacts?.responseArtifact?.result.runtimeStateObjectKey ?? "—"}
                />
              </NtCard>
            </>
          ) : (
            <NtCard className="nt-stack nt-gap-2">
              <span className="nt-kicker">当前请求</span>
              <strong className="nt-text-strong">还未选择</strong>
              <span className="nt-text-muted">从左侧事件列表点一条请求即可查看明细。</span>
            </NtCard>
          )}
        </div>
      </div>
    </div>
  );
}
