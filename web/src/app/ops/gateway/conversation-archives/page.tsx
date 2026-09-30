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
import { formatPlatformDateTime } from "@/lib/platform-date-time";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { gatewayConversationArchiveStatusLabel } from "../status-labels";

const ARCHIVE_LIMIT = 80;

/*
 * Layout and color now run through the shared `nt-` utility classes, so these constants hold
 * only what the vocabulary has no class for: the page shell padding, the two heading offsets,
 * the archive row's own padding plus its selected/idle border, the two auto-fit track floors,
 * the sidebar's self-alignment and the preview block's wrapping. Module scope keeps them at
 * one allocation per process instead of one per render.
 */
const PAGE_SHELL_STYLE: CSSProperties = { padding: "24px 0 40px" };
const HEADING_STYLE: CSSProperties = { margin: "6px 0 0" };
const LEAD_PARAGRAPH_STYLE: CSSProperties = { margin: "8px 0 0" };
const ARCHIVE_ROW_STYLE: CSSProperties = {
  padding: 14,
  textDecoration: "none",
  borderColor: "var(--neuro-line)",
};
const ARCHIVE_ROW_SELECTED_STYLE: CSSProperties = {
  ...ARCHIVE_ROW_STYLE,
  borderColor: "var(--neuro-info-blue)",
};
const ARCHIVE_META_GRID_STYLE = { "--nt-autofit-min": "150px" } as CSSProperties;
const ARTIFACT_META_GRID_STYLE = { "--nt-autofit-min": "160px" } as CSSProperties;
const SIDE_PANEL_STYLE: CSSProperties = { alignSelf: "start" };
const ARCHIVE_PREVIEW_STYLE: CSSProperties = { margin: 0, whiteSpace: "pre-wrap" };

function formatDate(value: string | null) {
  return formatPlatformDateTime(value, "—");
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
    <div className="nt-stack nt-gap-1">
      <span className="nt-kicker nt-text-2xs">
        {props.label}
      </span>
      <span className="nt-text-muted nt-break-word">{props.value}</span>
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
      className="nt-panel nt-stack nt-gap-2_5"
      style={selected ? ARCHIVE_ROW_SELECTED_STYLE : ARCHIVE_ROW_STYLE}
    >
      <div className="nt-flex nt-justify-between nt-gap-2_5 nt-wrap">
        <strong className="nt-text-strong">{archive.resolvedModel ?? archive.requestedModel ?? "—"}</strong>
        <div className="nt-flex nt-gap-1_5 nt-wrap">
          <NtBadge tone={statusTone(archive.status)}>{gatewayConversationArchiveStatusLabel(archive.status)}</NtBadge>
          {archive.failureClass ? <NtBadge tone="warning">{archive.failureClass}</NtBadge> : null}
          {archive.truncatedRequest || archive.truncatedResponse ? <NtBadge tone="warning">已截断</NtBadge> : null}
        </div>
      </div>
      <div className="nt-autofit nt-gap-2_5" style={ARCHIVE_META_GRID_STYLE}>
        <DetailLine label="用户" value={archive.userId ?? "—"} />
        <DetailLine label="服务商" value={archive.providerAccountId ?? "—"} />
        <DetailLine label="协议" value={archive.protocolProfile ?? archive.protocolFamily} />
        <DetailLine label="端点" value={archive.endpointKind} />
        <DetailLine label="创建时间" value={formatDate(archive.createdAt)} />
      </div>
      {archive.archiveError ? <span className="nt-text-danger">{archive.archiveError}</span> : null}
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
    <div className="nt-shell nt-stack nt-gap-6" style={PAGE_SHELL_STYLE}>
      <NtCard className="nt-stack nt-gap-4">
        <div className="nt-flex nt-justify-between nt-gap-4 nt-wrap">
          <div>
            <span className="nt-kicker">AI 网关 / 对话存档</span>
            <h1 className="nt-text-strong" style={HEADING_STYLE}>用户级对话存档</h1>
            <p className="nt-text-muted" style={LEAD_PARAGRAPH_STYLE}>
              运维全量强制存档视图。这里展示已脱敏的请求 / 响应归档对象索引与 NDJSON 导出落点。
            </p>
          </div>
          <div className="nt-flex nt-gap-2 nt-items-center nt-wrap">
            <NtBadge tone="cyan">ops_forced_full</NtBadge>
            <NtBadge tone="glass">记录：{filteredArchives.length}</NtBadge>
          </div>
        </div>
        <form action="/ops/gateway/conversation-archives" className="nt-flex nt-gap-2_5 nt-wrap">
          <input className="nt-input" name="q" placeholder="搜索请求、用户、服务商或模型" defaultValue={q} />
          <input className="nt-input" name="userId" placeholder="userId" defaultValue={userId} />
          <select className="nt-input" name="status" defaultValue={status}>
            <option value="">全部状态</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
            <option value="partial">部分完成</option>
            <option value="archive_failed">归档失败</option>
          </select>
          <button className="nt-btn nt-btn--primary" type="submit">
            筛选
          </button>
        </form>
      </NtCard>

      {dependencyNotice ? <GatewayDependencyUnavailableCard notice={dependencyNotice} /> : null}

      <div className="nt-gateway-split-pane">
        <section className="nt-stack nt-gap-3">
          {filteredArchives.map((archive) => (
            <ArchiveRow
              key={archive.id}
              archive={archive}
              selected={archive.id === selectedArchiveId}
              query={query}
            />
          ))}
          {!filteredArchives.length ? (
            <NtPanel className="nt-text-muted">当前筛选条件下没有对话存档。</NtPanel>
          ) : null}
        </section>

        <NtCard className="nt-stack nt-gap-3_5" style={SIDE_PANEL_STYLE}>
          <div className="nt-flex nt-justify-between nt-gap-2_5 nt-wrap">
            <div>
              <span className="nt-kicker">已选存档</span>
              <h2 className="nt-text-strong" style={HEADING_STYLE}>
                {selectedArtifacts?.archive.id ?? "未选择"}
              </h2>
            </div>
            <NtBadge tone="glass">{selectedArtifacts?.archive.redactionVersion ?? "v1"}</NtBadge>
          </div>
          {selectedArtifacts ? (
            <>
              <div className="nt-autofit nt-gap-3" style={ARTIFACT_META_GRID_STYLE}>
                <DetailLine label="请求对象" value={selectedArtifacts.archive.requestObjectKey ?? "—"} />
                <DetailLine label="响应对象" value={selectedArtifacts.archive.responseObjectKey ?? "—"} />
                <DetailLine label="保留期限" value={formatDate(selectedArtifacts.archive.retentionExpiresAt)} />
                <DetailLine label="导出接口" value="/v1/internal/gateway/conversation-archives/export" />
              </div>
              <NtPanel className="nt-stack nt-gap-2_5">
                <span className="nt-kicker">归档预览</span>
                <pre className="nt-text-muted" style={ARCHIVE_PREVIEW_STYLE}>
                  {JSON.stringify(selectedArtifacts.artifacts, null, 2).slice(0, 6000)}
                </pre>
              </NtPanel>
            </>
          ) : (
            <span className="nt-text-muted">选择左侧记录查看归档对象。</span>
          )}
        </NtCard>
      </div>
    </div>
  );
}
