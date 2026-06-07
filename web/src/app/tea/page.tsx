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
import { Input, Textarea } from "@/components/ui/input";
import { createTeaTicketAction, teaTicketLifecycleAction } from "@/lib/tea-actions";
import { listTeaTickets, type TeaTicketView } from "@/lib/tea-client";

export const dynamic = "force-dynamic";

type TeaPageProps = {
  searchParams?: Promise<{
    message?: string;
    status?: string;
  }>;
};

const terminalStatuses = new Set(["closed", "cancelled"]);

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

function countByStatus(tickets: TeaTicketView[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const ticket of tickets) {
    const status = formatStatus(ticket.status);
    result.set(status, (result.get(status) ?? 0) + 1);
  }
  return result;
}

function lifecycleButton(ticket: TeaTicketView, action: string, label: string, variant = "mg-btn--glass") {
  return (
    <form action={teaTicketLifecycleAction}>
      <input name="ticketId" type="hidden" value={ticket.id} />
      <input name="action" type="hidden" value={action} />
      <input name="redirectTo" type="hidden" value="/tea" />
      <button className={`mg-btn ${variant}`} type="submit">
        {label}
      </button>
    </form>
  );
}

export default async function TeaPage({ searchParams }: TeaPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;
  const userContext = {
    userId: session.user.id,
    providerUserId: session.user.providerUserId,
    username: session.user.username || session.user.name || undefined,
  };

  let tickets: TeaTicketView[] = [];
  let loadError: string | null = null;
  try {
    tickets = await listTeaTickets(userContext);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Tea 工单列表不可用。";
  }

  const openTickets = tickets.filter((ticket) => !terminalStatuses.has(formatStatus(ticket.status)));
  const statusCounts = [...countByStatus(tickets).entries()].sort(([left], [right]) => left.localeCompare(right));

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
              <p className="mg-subtitle">Tea Work Order Desk</p>
              <h1 className="mg-title">AI 工单控制台</h1>
              <p className="mg-copy">
                这里是 Platform Web 的 Tea 入口。浏览器只访问 Platform Web；Platform Web 通过 Platform Core
                的 <code>/internal/tea/*</code> 代理调用 Tea daemon，浏览器不会持有 Tea daemon token。
              </p>
            </div>
            <div className="app-action-row">
              <Link className="mg-btn mg-btn--secondary" href="/dashboard">
                返回总览
              </Link>
              <Link className="mg-btn mg-btn--glass" href="/my-tasks">
                人类任务
              </Link>
            </div>
          </div>

          <AccountHomeStatGrid>
            <AccountHomeStat label="全部工单" value={tickets.length} />
            <AccountHomeStat label="活跃工单" value={openTickets.length} />
            <AccountHomeStat label="终态记录" value={tickets.length - openTickets.length} />
          </AccountHomeStatGrid>
        </Card>

        <div className="app-account-content-grid">
          <div className="app-account-content-main">
            <AccountHomeSection>
              <AccountHomeSectionHead
                actions={<span className="app-note">{tickets.length} 条</span>}
                kicker="Queue"
                title="Tea 工单队列"
              />

              {loadError ? (
                <Card className="app-stack">
                  <Badge variant="danger">Core/Tea unavailable</Badge>
                  <p className="mg-copy">{loadError}</p>
                </Card>
              ) : tickets.length === 0 ? (
                <p className="mg-copy">当前还没有 Tea 工单。可以从右侧创建一个最小工单。</p>
              ) : (
                <div className="app-task-list">
                  {tickets.map((ticket) => {
                    const ticketStatus = formatStatus(ticket.status);
                    const isTerminal = terminalStatuses.has(ticketStatus);
                    return (
                      <Card className="app-stack" key={ticket.id}>
                        <div className="app-task-card__header">
                          <div>
                            <p className="mg-subtitle">{ticket.source || "human"} · {ticket.id}</p>
                            <h2 className="app-card-title">{ticket.title || "Untitled Tea ticket"}</h2>
                          </div>
                          <Badge variant={statusBadgeVariant(ticketStatus)}>{ticketStatus}</Badge>
                        </div>
                        <p className="mg-copy">{ticket.description || "无描述。"}</p>
                        <AccountHomeList>
                          <AccountHomeListRow
                            aside={<span className="app-note">{ticket.approval_policy || "unknown"}</span>}
                            title="审批策略"
                          />
                          <AccountHomeListRow
                            aside={<span className="app-note">{ticket.risk_level || "unknown"}</span>}
                            title="风险等级"
                          />
                          <AccountHomeListRow
                            aside={<span className="app-note">{formatDateTime(ticket.updated_at)}</span>}
                            title="最近更新"
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
                          <>
                            <p className="app-note">该工单已经进入终态，只保留审计与导出读取。</p>
                            <div className="app-action-row">
                              <Link className="mg-btn mg-btn--secondary" href={`/tea/${encodeURIComponent(ticket.id)}`}>
                                查看详情 / 审阅证据
                              </Link>
                            </div>
                          </>
                        ) : (
                          <div className="app-action-row">
                            <Link className="mg-btn mg-btn--secondary" href={`/tea/${encodeURIComponent(ticket.id)}`}>
                              查看详情 / 审阅证据
                            </Link>
                            {lifecycleButton(ticket, "analyze", "AI 分析")}
                            {lifecycleButton(ticket, "plan", "生成计划")}
                            {lifecycleButton(ticket, "approve", "审批", "mg-btn--secondary")}
                            {lifecycleButton(ticket, "run", "执行", "mg-btn--primary")}
                            {lifecycleButton(ticket, "accept", "验收")}
                            {lifecycleButton(ticket, "close", "关闭")}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </AccountHomeSection>
          </div>

          <div className="app-account-content-side">
            <AccountHomeSection>
              <AccountHomeSectionHead kicker="Create" title="提交 AI 工单" />
              <form action={createTeaTicketAction} className="app-form-grid">
                <input name="redirectTo" type="hidden" value="/tea" />
                <Input name="title" placeholder="工单标题，例如：修复 Hook 截图上传失败" required />
                <Textarea
                  name="description"
                  placeholder="描述目标、上下文、验收标准、限制条件。Tea 会把它交给 AI brain 分析并拆成计划。"
                  required
                  rows={6}
                />
                <button className="mg-btn mg-btn--primary" type="submit">
                  创建 Tea 工单
                </button>
              </form>
            </AccountHomeSection>

            <AccountHomeSection>
              <AccountHomeSectionHead kicker="Status" title="状态分布" />
              {statusCounts.length === 0 ? (
                <p className="mg-copy">暂无可统计状态。</p>
              ) : (
                <AccountHomeList>
                  {statusCounts.map(([ticketStatus, count]) => (
                    <AccountHomeListRow
                      aside={<Badge variant={statusBadgeVariant(ticketStatus)}>{String(count)}</Badge>}
                      key={ticketStatus}
                      title={ticketStatus}
                    />
                  ))}
                </AccountHomeList>
              )}
            </AccountHomeSection>

            <AccountHomeSection>
              <AccountHomeSectionHead kicker="Boundary" title="接口边界" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">Browser</span>} title="只访问 Platform Web" />
                <AccountHomeListRow aside={<span className="app-note">Web API</span>} title="/api/tea/tickets" />
                <AccountHomeListRow aside={<span className="app-note">Core</span>} title="/internal/tea/*" />
                <AccountHomeListRow aside={<span className="app-note">Tea</span>} title="Bearer token 仅后端持有" />
              </AccountHomeList>
            </AccountHomeSection>
          </div>
        </div>
      </div>
    </main>
  );
}
