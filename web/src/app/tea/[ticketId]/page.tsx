import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  AccountHomeList,
  AccountHomeListRow,
  AccountHomeSection,
  AccountHomeSectionHead,
  AccountHomeStat,
  AccountHomeStatGrid,
} from "@/components/account-home/templates";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import {
  addTeaTicketCommentAction,
  rejectTeaTicketAction,
  teaTicketLifecycleAction,
} from "@/lib/tea-actions";
import {
  exportTeaTicketJson,
  exportTeaTicketMarkdown,
  getTeaTicket,
  getTeaTicketEvents,
  getTeaTicketRuns,
  type TeaRunView,
  type TeaTicketEventView,
  type TeaTicketView,
} from "@/lib/tea-client";
import { getTeaTicketDetailControls } from "@/lib/tea-detail-controls";

export const dynamic = "force-dynamic";

type TeaTicketPageProps = {
  params: Promise<{
    ticketId: string;
  }>;
  searchParams?: Promise<{
    message?: string;
    status?: string;
  }>;
};

function formatDateTime(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "未记录";
  }
  return new Date(value).toLocaleString("zh-CN");
}

function formatStatus(status: unknown): string {
  return typeof status === "string" && status ? status : "unknown";
}

function statusBadgeVariant(status: string): "cyan" | "danger" | "success" | "warning" | "violet" {
  if (status === "closed" || status === "accepted" || status === "completed") return "success";
  if (status === "failed" || status === "cancelled" || status === "blocked") return "danger";
  if (status === "running" || status === "approved") return "cyan";
  if (status === "awaiting_approval" || status === "needs_review" || status === "plan_ready") return "warning";
  return "violet";
}

function lifecycleButton(
  ticketId: string,
  redirectTo: string,
  action: string,
  label: string,
  variant = "mg-btn--glass",
  disabled = false,
) {
  return (
    <form action={teaTicketLifecycleAction}>
      <input name="ticketId" type="hidden" value={ticketId} />
      <input name="action" type="hidden" value={action} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <button
        className={`mg-btn ${variant}`}
        disabled={disabled}
        title={disabled ? "暂无最新执行记录，不能执行该动作。" : undefined}
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}

function stringifyPreview(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function settledError(...results: PromiseSettledResult<unknown>[]): string | null {
  const rejected = results.find((result) => result.status === "rejected");
  if (!rejected || rejected.status !== "rejected") {
    return null;
  }
  return rejected.reason instanceof Error ? rejected.reason.message : "Tea 工单详情加载失败。";
}

function evidencePreview(run: TeaRunView): string {
  if (run.evidence === undefined || run.evidence === null) {
    return "未记录 evidence。";
  }
  return stringifyPreview(run.evidence);
}

export default async function TeaTicketPage({ params, searchParams }: TeaTicketPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { ticketId } = await params;
  const paramsValue = searchParams ? await searchParams : undefined;
  const status = paramsValue?.status === "success" ? "success" : paramsValue?.status === "error" ? "error" : null;
  const message = paramsValue?.message ?? null;
  const userContext = {
    userId: session.user.id,
    providerUserId: session.user.providerUserId,
    username: session.user.username || session.user.name || undefined,
  };
  const redirectTo = `/tea/${encodeURIComponent(ticketId)}`;

  const [ticketResult, eventsResult, runsResult, jsonExportResult, markdownExportResult] = await Promise.allSettled([
    getTeaTicket(userContext, ticketId),
    getTeaTicketEvents(userContext, ticketId),
    getTeaTicketRuns(userContext, ticketId),
    exportTeaTicketJson(userContext, ticketId),
    exportTeaTicketMarkdown(userContext, ticketId),
  ]);

  const loadError = settledError(ticketResult, eventsResult, runsResult, jsonExportResult, markdownExportResult);
  const ticket = settledValue<TeaTicketView | null>(ticketResult, null);
  const events = settledValue<TeaTicketEventView[]>(eventsResult, []);
  const runs = settledValue<TeaRunView[]>(runsResult, []);
  const jsonExport = settledValue<unknown>(jsonExportResult, null);
  const markdownExport = settledValue<string>(markdownExportResult, "");
  const ticketStatus = formatStatus(ticket?.status);
  const detailControls = getTeaTicketDetailControls(ticket?.id || ticketId, ticketStatus);
  const isTerminal = !detailControls.canMutate;

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        {status && message ? (
          <Card className="app-stack">
            <p className={status === "success" ? "app-banner app-banner--success" : "app-banner app-banner--error"}>
              {message}
            </p>
          </Card>
        ) : null}

        <Card className="app-stack">
          <div className="app-task-card__header">
            <div>
              <p className="mg-subtitle">Tea Review Desk</p>
              <h1 className="mg-title">{ticket?.title || `工单 ${ticketId}`}</h1>
              <p className="mg-copy">
                这是 Tea 工单的人工审阅页：浏览器仍只访问 Platform Web，详情、执行证据和导出内容都通过 Platform
                Core 内部代理读取。
              </p>
            </div>
            <div className="app-action-row">
              <Link className="mg-btn mg-btn--secondary" href="/tea">
                返回工单队列
              </Link>
              <Link className="mg-btn mg-btn--glass" href={`/api/tea/tickets/${encodeURIComponent(ticketId)}/runs`}>
                Runs API
              </Link>
              {detailControls.downloadLinks.map((link) => (
                <Link className="mg-btn mg-btn--glass" href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {loadError ? (
            <p className="app-banner app-banner--error">{loadError}</p>
          ) : null}

          <AccountHomeStatGrid>
            <AccountHomeStat label="事件数" value={events.length} />
            <AccountHomeStat label="执行次数" value={runs.length} />
            <AccountHomeStat label="当前状态" value={ticketStatus} />
          </AccountHomeStatGrid>
        </Card>

        {!ticket ? (
          <Card className="app-stack">
            <Badge variant="danger">Ticket unavailable</Badge>
            <p className="mg-copy">Tea 没有返回该工单详情。请确认 Core/Tea daemon 是否运行，或返回队列重试。</p>
          </Card>
        ) : (
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection>
                <AccountHomeSectionHead
                  actions={<Badge variant={statusBadgeVariant(ticketStatus)}>{ticketStatus}</Badge>}
                  kicker="Ticket"
                  title="工单详情"
                />
                <p className="mg-copy">{ticket.description || "无描述。"}</p>
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">{ticket.id}</span>} title="工单 ID" />
                  <AccountHomeListRow aside={<span className="app-note">{ticket.source || "unknown"}</span>} title="来源" />
                  <AccountHomeListRow
                    aside={<span className="app-note">{ticket.priority || "unknown"}</span>}
                    title="优先级"
                  />
                  <AccountHomeListRow
                    aside={<span className="app-note">{ticket.approval_policy || "unknown"}</span>}
                    title="审批策略"
                  />
                  <AccountHomeListRow
                    aside={<span className="app-note">{ticket.risk_level || "unknown"}</span>}
                    title="风险等级"
                  />
                  <AccountHomeListRow
                    aside={<span className="app-note">{formatDateTime(ticket.created_at)}</span>}
                    title="创建时间"
                  />
                  <AccountHomeListRow
                    aside={<span className="app-note">{formatDateTime(ticket.updated_at)}</span>}
                    title="更新时间"
                  />
                </AccountHomeList>
                {Array.isArray(ticket.labels) && ticket.labels.length > 0 ? (
                  <div className="app-action-row">
                    {ticket.labels.map((label) => (
                      <Badge key={label} variant="glass">
                        {label}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {isTerminal ? (
                  <p className="app-note">该工单已经进入终态，只保留审计、证据与导出读取。</p>
                ) : (
                  <div className="app-action-row">
                    {detailControls.lifecycleControls.map((control) =>
                      lifecycleButton(
                        ticket.id,
                        redirectTo,
                        control.action,
                        control.label,
                        control.variant,
                        control.requiresRun === true && runs.length === 0,
                      ),
                    )}
                  </div>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead
                  actions={<span className="app-note">{runs.length} 条</span>}
                  kicker="Evidence"
                  title="Loom 执行证据"
                />
                {runs.length === 0 ? (
                  <p className="mg-copy">暂无执行记录。审批后点击执行会生成 run 和 evidence。</p>
                ) : (
                  <div className="app-task-list">
                    {runs.map((run) => (
                      <Card className="app-stack" key={run.id}>
                        <div className="app-task-card__header">
                          <div>
                            <p className="mg-subtitle">{run.loom_session_id || "local-run"}</p>
                            <h2 className="app-card-title">{run.id}</h2>
                          </div>
                          <Badge variant={statusBadgeVariant(formatStatus(run.status))}>{formatStatus(run.status)}</Badge>
                        </div>
                        <pre className="app-code-block">{evidencePreview(run)}</pre>
                      </Card>
                    ))}
                  </div>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead
                  actions={<span className="app-note">{events.length} 条</span>}
                  kicker="Audit"
                  title="事件时间线"
                />
                {events.length === 0 ? (
                  <p className="mg-copy">暂无事件。</p>
                ) : (
                  <AccountHomeList>
                    {events.map((event) => (
                      <AccountHomeListRow
                        aside={<span className="app-note">{formatDateTime(event.created_at)}</span>}
                        key={event.id}
                        title={`${event.kind || "event"} · ${event.id}`}
                      />
                    ))}
                  </AccountHomeList>
                )}
              </AccountHomeSection>
            </div>

            <div className="app-account-content-side">
              {detailControls.showCommentForm ? (
                <AccountHomeSection>
                  <AccountHomeSectionHead kicker="Review" title="人工评论" />
                  <form action={addTeaTicketCommentAction} className="app-form-grid">
                    <input name="ticketId" type="hidden" value={ticket.id} />
                    <input name="redirectTo" type="hidden" value={redirectTo} />
                    <Textarea
                      name="body"
                      placeholder="记录人工判断、补充证据要求、验收意见或风险说明。"
                      required
                      rows={4}
                    />
                    <button className="mg-btn mg-btn--secondary" type="submit">
                      提交评论
                    </button>
                  </form>
                </AccountHomeSection>
              ) : null}

              {detailControls.showRejectForm ? (
                <AccountHomeSection>
                  <AccountHomeSectionHead kicker="Reject" title="驳回 / 要求补充" />
                  <form action={rejectTeaTicketAction} className="app-form-grid">
                    <input name="ticketId" type="hidden" value={ticket.id} />
                    <input name="redirectTo" type="hidden" value={redirectTo} />
                    <Textarea
                      name="reason"
                      placeholder="说明为什么不能批准或验收，例如：缺少回滚步骤、缺少真实 smoke evidence。"
                      required
                      rows={4}
                    />
                    <button className="mg-btn mg-btn--glass" type="submit">
                      驳回工单
                    </button>
                  </form>
                </AccountHomeSection>
              ) : null}

              <AccountHomeSection>
                <AccountHomeSectionHead
                  actions={
                    <Link
                      className="mg-btn mg-btn--glass"
                      href={`/api/tea/tickets/${encodeURIComponent(ticket.id)}/export/markdown/download`}
                    >
                      下载
                    </Link>
                  }
                  kicker="Export"
                  title="Markdown 导出"
                />
                <pre className="app-code-block">{markdownExport || "Tea 尚未返回 Markdown 导出内容。"}</pre>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead
                  actions={
                    <Link
                      className="mg-btn mg-btn--glass"
                      href={`/api/tea/tickets/${encodeURIComponent(ticket.id)}/export/json/download`}
                    >
                      下载
                    </Link>
                  }
                  kicker="Export"
                  title="JSON 导出预览"
                />
                <pre className="app-code-block">{stringifyPreview(jsonExport)}</pre>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Boundary" title="接口边界" />
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">Page</span>} title="/tea/[ticketId]" />
                  <AccountHomeListRow aside={<span className="app-note">Web API</span>} title="/api/tea/tickets/:id/*" />
                  <AccountHomeListRow aside={<span className="app-note">Core</span>} title="/internal/tea/tickets/:id/*" />
                  <AccountHomeListRow aside={<span className="app-note">Tea</span>} title="Bearer token 仅后端持有" />
                </AccountHomeList>
              </AccountHomeSection>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
