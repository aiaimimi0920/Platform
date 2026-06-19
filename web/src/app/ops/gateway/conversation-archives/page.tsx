import type { GatewayConversationArchiveView } from "@/lib/account-client";
import { auth } from "@/auth";
import { GatewayDependencyUnavailableCard } from "@/components/gateway-dependency-unavailable-card";
import {
  getOperatorGatewayConversationArchiveArtifacts,
  listOperatorGatewayConversationArchives,
} from "@/lib/account-client";
import { buildGatewayDependencyUnavailableNotice } from "@/lib/gateway-catalog-notice";
import { NtBadge, NtCard, NtPanel } from "@/components/nt-primitives";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

const ARCHIVE_LIMIT = 80;

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

function statusTone(status: string) {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "partial") return "warning";
  if (status === "archive_failed") return "danger";
  return "secondary";
}

function archiveSearchText(archive: GatewayConversationArchiveView) {
  return [
    archive.id,
    archive.requestId,
    archive.userId ?? "",
    archive.projectId ?? "",
    archive.providerAccountId ?? "",
    archive.providerCredentialRef ?? "",
    archive.protocolFamily,
    archive.protocolProfile ?? "",
    archive.endpointKind,
    archive.requestedModel ?? "",
    archive.resolvedModel ?? "",
    archive.status,
    archive.failureClass ?? "",
    archive.failureScope ?? "",
    archive.archiveError ?? "",
  ]
    .join(" ")
    .toLowerCase();
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

function ArchiveRow({
  archive,
  selected,
  query,
}: {
  archive: GatewayConversationArchiveView;
  selected: boolean;
  query: URLSearchParams;
}) {
  const next = new URLSearchParams(query);
  next.set("archiveId", archive.id);
  return (
    <Link
      href={`/ops/gateway/conversation-archives?${next.toString()}`}
      className="nt-panel"
      style={{
        display: "grid",
        gap: 10,
        padding: 14,
        textDecoration: "none",
        borderColor: selected ? "rgba(34,211,238,0.32)" : "rgba(148,163,184,0.12)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ color: "rgba(243,245,247,0.96)" }}>{archive.resolvedModel ?? archive.requestedModel ?? "—"}</strong>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <NtBadge tone={statusTone(archive.status)}>{archive.status}</NtBadge>
          {archive.failureClass ? <NtBadge tone="warning">{archive.failureClass}</NtBadge> : null}
          {archive.truncatedRequest || archive.truncatedResponse ? <NtBadge tone="warning">已截断</NtBadge> : null}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <DetailLine label="用户" value={archive.userId ?? "—"} />
        <DetailLine label="服务商" value={archive.providerAccountId ?? "—"} />
        <DetailLine label="协议" value={archive.protocolProfile ?? archive.protocolFamily} />
        <DetailLine label="端点" value={archive.endpointKind} />
        <DetailLine label="创建时间" value={formatDate(archive.createdAt)} />
      </div>
      {archive.archiveError ? <span style={{ color: "rgba(252,165,165,0.92)" }}>{archive.archiveError}</span> : null}
    </Link>
  );
}

export default async function GatewayConversationArchivesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问 AI 网关对话存档。")}`);
  }
  const userContext = await requirePlatformOperatorUserContext();
  const params = searchParams ? await searchParams : {};
  const status = typeof params.status === "string" ? params.status.trim() : "";
  const userId = typeof params.userId === "string" ? params.userId.trim() : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";

  let dependencyNotice: ReturnType<typeof buildGatewayDependencyUnavailableNotice> | null = null;
  let archives: GatewayConversationArchiveView[] = [];
  try {
    archives = await listOperatorGatewayConversationArchives(userContext, {
      status: status || undefined,
      userId: userId || undefined,
      limit: ARCHIVE_LIMIT,
    });
  } catch (error) {
    dependencyNotice = buildGatewayDependencyUnavailableNotice(error, {
      resourceName: "用户级对话存档",
      continuation: "存档列表和归档预览暂不可查看；其他运营页面仍可继续使用。",
    });
  }
  const filteredArchives = archives.filter((archive) =>
    q ? archiveSearchText(archive).includes(q.toLowerCase()) : true,
  );
  const selectedArchiveId =
    typeof params.archiveId === "string" && params.archiveId ? params.archiveId : filteredArchives[0]?.id ?? null;
  let selectedArtifacts: Awaited<ReturnType<typeof getOperatorGatewayConversationArchiveArtifacts>> | null = null;
  if (selectedArchiveId && !dependencyNotice) {
    try {
      selectedArtifacts = await getOperatorGatewayConversationArchiveArtifacts(userContext, selectedArchiveId);
    } catch (error) {
      dependencyNotice = buildGatewayDependencyUnavailableNotice(error, {
        resourceName: "对话存档归档对象",
        continuation: "存档列表仍可查看，归档预览暂不可用。",
      });
    }
  }
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (userId) query.set("userId", userId);
  if (q) query.set("q", q);

  return (
    <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
      <NtCard style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span className="nt-kicker">AI 网关 / 对话存档</span>
            <h1 style={{ margin: "6px 0 0", color: "rgba(243,245,247,0.98)" }}>用户级对话存档</h1>
            <p style={{ margin: "8px 0 0", color: "rgba(148,163,184,0.9)" }}>
              运维全量强制存档视图。这里展示已脱敏的请求 / 响应归档对象索引与 NDJSON 导出落点。
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <NtBadge tone="cyan">ops_forced_full</NtBadge>
            <NtBadge tone="glass">记录：{filteredArchives.length}</NtBadge>
          </div>
        </div>
        <form action="/ops/gateway/conversation-archives" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input className="nt-input" name="q" placeholder="搜索请求、用户、服务商或模型" defaultValue={q} />
          <input className="nt-input" name="userId" placeholder="userId" defaultValue={userId} />
          <select className="nt-input" name="status" defaultValue={status}>
            <option value="">全部状态</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="partial">partial</option>
            <option value="archive_failed">archive_failed</option>
          </select>
          <button className="nt-btn nt-btn--primary" type="submit">
            筛选
          </button>
        </form>
      </NtCard>

      {dependencyNotice ? <GatewayDependencyUnavailableCard notice={dependencyNotice} /> : null}

      <div className="nt-gateway-split-pane">
        <section style={{ display: "grid", gap: 12 }}>
          {filteredArchives.map((archive) => (
            <ArchiveRow
              key={archive.id}
              archive={archive}
              selected={archive.id === selectedArchiveId}
              query={query}
            />
          ))}
          {!filteredArchives.length ? (
            <NtPanel style={{ color: "rgba(148,163,184,0.9)" }}>当前筛选条件下没有对话存档。</NtPanel>
          ) : null}
        </section>

        <NtCard style={{ display: "grid", gap: 14, alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <span className="nt-kicker">已选存档</span>
              <h2 style={{ margin: "6px 0 0", color: "rgba(243,245,247,0.98)" }}>
                {selectedArtifacts?.archive.id ?? "未选择"}
              </h2>
            </div>
            <NtBadge tone="glass">{selectedArtifacts?.archive.redactionVersion ?? "v1"}</NtBadge>
          </div>
          {selectedArtifacts ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <DetailLine label="请求对象" value={selectedArtifacts.archive.requestObjectKey ?? "—"} />
                <DetailLine label="响应对象" value={selectedArtifacts.archive.responseObjectKey ?? "—"} />
                <DetailLine label="保留期限" value={formatDate(selectedArtifacts.archive.retentionExpiresAt)} />
                <DetailLine label="导出接口" value="/v1/internal/gateway/conversation-archives/export" />
              </div>
              <NtPanel style={{ display: "grid", gap: 10 }}>
                <span className="nt-kicker">归档预览</span>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "rgba(190,199,217,0.9)" }}>
                  {JSON.stringify(selectedArtifacts.artifacts, null, 2).slice(0, 6000)}
                </pre>
              </NtPanel>
            </>
          ) : (
            <span style={{ color: "rgba(148,163,184,0.9)" }}>选择左侧记录查看归档对象。</span>
          )}
        </NtCard>
      </div>
    </div>
  );
}
