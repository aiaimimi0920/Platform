import type {
  GatewayRouteTraceCandidate,
  GatewayRequestStatus,
  GatewayRequestAuditView,
} from "@/lib/account-client";
import { auth } from "@/auth";
import {
  getOperatorGatewayRequestArtifacts,
  getOperatorGatewayRequestAudit,
  getOperatorGatewayRequestAuditSummary,
  listOperatorGatewayRequestAudits,
} from "@/lib/account-client";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { NtBadge, NtCard, NtPanel } from "@/components/nt-primitives";
import Link from "next/link";
import { redirect } from "next/navigation";

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

function buildTraceQuery(params: TracePageQuery) {
  const search = new URLSearchParams();
  if (params.requestId) search.set("requestId", params.requestId);
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return query ? `?${query}` : "";
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
  return request.routeTrace?.selectedCandidate.providerLabel ?? request.providerAccountId ?? "—";
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
    request.routeTrace?.selectedCandidate.realCredentialRef ?? "",
    request.routeTrace?.selectedCandidate.platformAccessId ?? request.routeTrace?.platformAccessId ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function buildRouteDecisionReasons(request: GatewayRequestAuditView) {
  const routeTrace = request.routeTrace;
  if (!routeTrace) return [] as string[];
  const selected = routeTrace.selectedCandidate;
  const alternatives = routeTrace.candidateQueue.filter(
    (candidate) => candidate.providerAccountId !== selected.providerAccountId,
  );
  const reasons: string[] = [];

  if (routeTrace.stickyProviderAccountId && routeTrace.stickyProviderAccountId === selected.providerAccountId) {
    reasons.push("命中了粘性服务商策略。");
  }
  if (routeTrace.selectedPipelineMode === "same_protocol_fast_path") {
    reasons.push("当前请求走同协议直连快路径。");
  } else if (routeTrace.requestedProtocolFamily && routeTrace.requestedProtocolFamily !== selected.protocolFamily) {
    reasons.push(`入口协议 ${routeTrace.requestedProtocolFamily} 与上游协议 ${selected.protocolFamily} 不同，已走统一桥接链。`);
  }
  const nextBest = alternatives[0];
  if (selected.routingScore != null && nextBest?.routingScore != null && selected.routingScore !== nextBest.routingScore) {
    reasons.push(`所选服务商路由分数更高（${selected.routingScore.toFixed(2)} > ${nextBest.routingScore.toFixed(2)}）。`);
  }
  if (!selected.degraded && alternatives.some((candidate) => candidate.degraded)) {
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
  return <NtBadge tone={tone}>{status}</NtBadge>;
}

function DetailLine(props: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span className="nt-kicker" style={{ fontSize: "0.72rem" }}>
        {props.label}
      </span>
      <span style={{ color: "rgba(190,199,217,0.88)", wordBreak: "break-word" }}>{props.value}</span>
    </div>
  );
}

function CandidateRow({ candidate, isSelected }: { candidate: GatewayRouteTraceCandidate; isSelected?: boolean }) {
  return (
    <NtPanel
      style={{
        display: "grid",
        gap: 10,
        borderColor: isSelected ? "rgba(34,211,238,0.28)" : "transparent",
        background: isSelected ? "rgba(15,23,42,0.92)" : "rgba(13,18,32,0.72)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ color: "rgba(243,245,247,0.96)" }}>{candidate.providerLabel}</strong>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <NtBadge tone="glass">{candidate.adapter}</NtBadge>
          <NtBadge tone="glass">{getSourceKindLabel(candidate.sourceProfile.sourceKind)}</NtBadge>
          {candidate.stickyPreferred ? <NtBadge tone="cyan">粘性</NtBadge> : null}
          {candidate.sameProtocolFastPathEligible ? <NtBadge tone="success">同协议</NtBadge> : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
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
        <div style={{ display: "grid", gap: 4 }}>
          <span className="nt-kicker">降级原因</span>
          <span style={{ color: "rgba(252,211,77,0.92)" }}>{candidate.degradationReasons.join(" / ")}</span>
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
      href={href}
      style={{
        display: "grid",
        gap: 10,
        padding: 14,
        borderRadius: 18,
        border: props.selected ? "1px solid rgba(34,211,238,0.28)" : "1px solid rgba(255,255,255,0.06)",
        background: props.selected ? "rgba(15,23,42,0.92)" : "rgba(10,14,24,0.78)",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <StatusBadge status={request.status} />
          <span style={{ color: "rgba(243,245,247,0.96)", fontWeight: 600 }}>{request.id}</span>
        </div>
        <span style={{ color: "rgba(190,199,217,0.76)" }}>{formatDate(request.createdAt)}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1.1fr 0.9fr 0.8fr 0.8fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <span className="nt-kicker">模型</span>
          <span style={{ color: "rgba(214,219,233,0.9)" }}>
            {request.requestedModel ?? "—"} → {request.resolvedModel ?? "—"}
          </span>
          <span style={{ color: "rgba(140,151,173,0.82)" }}>{request.endpointKind}</span>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <span className="nt-kicker">服务商</span>
          <span style={{ color: "rgba(214,219,233,0.9)" }}>{getRequestProviderLabel(request)}</span>
          <span style={{ color: "rgba(140,151,173,0.82)" }}>{request.providerAccountId ?? "—"}</span>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <span className="nt-kicker">管线</span>
          <span style={{ color: "rgba(214,219,233,0.9)" }}>
            {getPipelineLabel(request.routeTrace?.selectedPipelineMode ?? null)}
          </span>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <span className="nt-kicker">耗时</span>
          <span style={{ color: "rgba(214,219,233,0.9)" }}>{formatDurationMs(request.durationMs)}</span>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <span className="nt-kicker">Token</span>
          <span style={{ color: "rgba(214,219,233,0.9)" }}>{formatCount(request.totalTokens)}</span>
        </div>
      </div>

      {request.errorSummary ? (
        <span style={{ color: "rgba(252,165,165,0.92)" }}>{request.errorSummary}</span>
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

  const [requestList, summary] = await Promise.all([
    listOperatorGatewayRequestAudits(userContext, { status: statusFilter || undefined, limit: REQUEST_LIMIT }),
    getOperatorGatewayRequestAuditSummary(userContext, { limit: REQUEST_LIMIT }),
  ]);

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

  const selectedRequest = selectedRequestId
    ? await getOperatorGatewayRequestAudit(userContext, selectedRequestId)
    : null;
  const artifacts = selectedRequestId
    ? await getOperatorGatewayRequestArtifacts(userContext, selectedRequestId)
    : null;

  return (
    <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
      <section style={{ display: "grid", gap: 12 }}>
        <span className="nt-kicker">Operator / AI 网关</span>
        <h1 style={{ margin: 0, color: "rgba(243,245,247,0.98)", fontSize: "2rem", lineHeight: 1.1 }}>
          请求追踪
        </h1>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <NtCard style={{ display: "grid", gap: 8 }}>
          <span className="nt-kicker">样本数</span>
          <strong style={{ fontSize: "1.9rem", color: "rgba(243,245,247,0.96)" }}>{filteredRequests.length}</strong>
          <span style={{ color: "rgba(140,151,173,0.82)" }}>总计 {summary.totalRequests}</span>
        </NtCard>
        <NtCard style={{ display: "grid", gap: 8 }}>
          <span className="nt-kicker">失败</span>
          <strong style={{ fontSize: "1.9rem", color: "rgba(244,63,94,0.96)" }}>{failedCount}</strong>
          <span style={{ color: "rgba(140,151,173,0.82)" }}>全量 {summary.failedCount}</span>
        </NtCard>
        <NtCard style={{ display: "grid", gap: 8 }}>
          <span className="nt-kicker">同协议直连</span>
          <strong style={{ fontSize: "1.9rem", color: "rgba(34,197,94,0.96)" }}>{fastPathCount}</strong>
          <span style={{ color: "rgba(140,151,173,0.82)" }}>当前结果集</span>
        </NtCard>
        <NtCard style={{ display: "grid", gap: 8 }}>
          <span className="nt-kicker">允许回退</span>
          <strong style={{ fontSize: "1.9rem", color: "rgba(245,158,11,0.96)" }}>{fallbackEligibleCount}</strong>
          <span style={{ color: "rgba(140,151,173,0.82)" }}>当前结果集</span>
        </NtCard>
      </section>

      <NtCard style={{ display: "grid", gap: 14 }}>
        <form
          action="/ops/gateway/traces"
          method="get"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span className="nt-kicker">检索</span>
            <input
              className="nt-input"
              defaultValue={searchQuery}
              name="q"
              placeholder="请求 ID / 模型 / 服务商 / 错误"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="nt-kicker">状态</span>
            <select className="nt-input" defaultValue={statusFilter} name="status">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="nt-btn nt-btn--primary" type="submit">
              查询
            </button>
            <Link className="nt-btn nt-btn--secondary" href="/ops/gateway/traces">
              清空
            </Link>
          </div>
        </form>
      </NtCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(360px, 0.95fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <NtCard style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <span className="nt-kicker">请求事件明细</span>
              <strong style={{ color: "rgba(243,245,247,0.96)" }}>最近 {REQUEST_LIMIT} 条请求</strong>
            </div>
            <NtBadge tone="glass">{filteredRequests.length} 条</NtBadge>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
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
              <NtPanel style={{ display: "grid", gap: 8 }}>
                <span className="nt-kicker">请求事件明细</span>
                <strong style={{ color: "rgba(243,245,247,0.96)" }}>没有命中结果</strong>
                <span style={{ color: "rgba(190,199,217,0.76)" }}>调整状态或关键字后再查。</span>
              </NtPanel>
            )}
          </div>
        </NtCard>

        <div style={{ display: "grid", gap: 16, position: "sticky", top: 20 }}>
          {selectedRequest ? (
            <>
              <NtCard style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <span className="nt-kicker">当前请求</span>
                  <strong style={{ color: "rgba(243,245,247,0.96)" }}>{selectedRequest.id}</strong>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 12,
                  }}
                >
                  <DetailLine label="状态" value={selectedRequest.status} />
                  <DetailLine label="创建时间" value={formatDate(selectedRequest.createdAt)} />
                  <DetailLine label="端点" value={selectedRequest.endpointKind} />
                  <DetailLine label="协议族" value={selectedRequest.protocolFamily} />
                  <DetailLine label="耗时" value={formatDurationMs(selectedRequest.durationMs)} />
                  <DetailLine label="上游状态" value={selectedRequest.upstreamStatus != null ? String(selectedRequest.upstreamStatus) : "—"} />
                  <DetailLine label="请求模型" value={selectedRequest.requestedModel ?? "—"} />
                  <DetailLine label="解析模型" value={selectedRequest.resolvedModel ?? "—"} />
                  <DetailLine label="服务商" value={getRequestProviderLabel(selectedRequest)} />
                  <DetailLine label="Provider ID" value={selectedRequest.providerAccountId ?? "—"} />
                  <DetailLine label="Pipeline" value={getPipelineLabel(selectedRequest.routeTrace?.selectedPipelineMode)} />
                  <DetailLine label="Token" value={formatCount(selectedRequest.totalTokens)} />
                </div>
                {selectedRequest.errorSummary ? (
                  <NtPanel style={{ display: "grid", gap: 4 }}>
                    <span className="nt-kicker">错误摘要</span>
                    <span style={{ color: "rgba(252,165,165,0.92)" }}>{selectedRequest.errorSummary}</span>
                  </NtPanel>
                ) : null}
              </NtCard>

              <NtCard style={{ display: "grid", gap: 10 }}>
                <span className="nt-kicker">路由判定</span>
                {buildRouteDecisionReasons(selectedRequest).length ? (
                  buildRouteDecisionReasons(selectedRequest).map((reason) => (
                    <span key={reason} style={{ color: "rgba(214,219,233,0.84)" }}>
                      {reason}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "rgba(190,199,217,0.76)" }}>当前没有额外路由说明。</span>
                )}
              </NtCard>

              <NtCard style={{ display: "grid", gap: 12 }}>
                <span className="nt-kicker">候选队列</span>
                {selectedRequest.routeTrace?.candidateQueue?.length ? (
                  selectedRequest.routeTrace.candidateQueue.map((candidate) => (
                    <CandidateRow
                      key={candidate.providerAccountId}
                      candidate={candidate}
                      isSelected={
                        candidate.providerAccountId === selectedRequest.routeTrace?.selectedCandidate.providerAccountId
                      }
                    />
                  ))
                ) : (
                  <span style={{ color: "rgba(190,199,217,0.76)" }}>当前请求没有候选队列数据。</span>
                )}
              </NtCard>

              <NtCard style={{ display: "grid", gap: 10 }}>
                <span className="nt-kicker">已选候选</span>
                <DetailLine
                  label="Provider"
                  value={selectedRequest.routeTrace?.selectedCandidate.providerLabel ?? "—"}
                />
                <DetailLine
                  label="Platform Access"
                  value={
                    selectedRequest.routeTrace?.selectedCandidate.platformAccessId ??
                    selectedRequest.routeTrace?.platformAccessId ??
                    "—"
                  }
                />
                <DetailLine
                  label="Source Access Key"
                  value={
                    selectedRequest.routeTrace?.selectedCandidate.sourceAccessKeyId ??
                    selectedRequest.routeTrace?.sourceAccessKeyId ??
                    "—"
                  }
                />
                <DetailLine
                  label="Real Credential"
                  value={
                    selectedRequest.routeTrace?.selectedCandidate.realCredentialRef ??
                    selectedRequest.routeTrace?.realCredentialRef ??
                    "—"
                  }
                />
                <Link
                  className="nt-btn nt-btn--secondary"
                  href={`/ops/gateway/providers?selected=${selectedRequest.routeTrace?.selectedCandidate.providerAccountId ?? ""}`}
                >
                  打开服务商
                </Link>
              </NtCard>

              <NtCard style={{ display: "grid", gap: 10 }}>
                <span className="nt-kicker">访问凭证</span>
                <DetailLine label="Access Key" value={selectedRequest.accessKeyId ?? "—"} />
                <DetailLine label="Source Access Key" value={selectedRequest.sourceAccessKeyId ?? "—"} />
                <DetailLine label="Legacy API Key" value={selectedRequest.apiKeyId ?? "—"} />
                <DetailLine label="User Credential" value={selectedRequest.userCredentialId ?? "—"} />
                <DetailLine label="Previous Response" value={selectedRequest.previousResponseId ?? "—"} />
                <DetailLine label="Session" value={selectedRequest.sessionId ?? "—"} />
              </NtCard>

              <NtCard style={{ display: "grid", gap: 10 }}>
                <span className="nt-kicker">保活与执行链</span>
                <DetailLine
                  label="显式 Session Key"
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

              <NtCard style={{ display: "grid", gap: 10 }}>
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
            <NtCard style={{ display: "grid", gap: 8 }}>
              <span className="nt-kicker">当前请求</span>
              <strong style={{ color: "rgba(243,245,247,0.96)" }}>还未选择</strong>
              <span style={{ color: "rgba(190,199,217,0.76)" }}>从左侧事件列表点一条请求即可查看明细。</span>
            </NtCard>
          )}
        </div>
      </div>
    </div>
  );
}
