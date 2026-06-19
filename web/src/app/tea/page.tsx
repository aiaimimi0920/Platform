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
import { safeLocalLoomUrl } from "@/lib/loom-config";
import { createTeaTicketAction, teaTicketLifecycleAction } from "@/lib/tea-actions";
import { getTeaStatus, listTeaTickets, type TeaStatusView, type TeaTicketView } from "@/lib/tea-client";

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
  return typeof status === "string" && status ? status : "unavailable";
}

function formatTicketStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "待处理";
    case "awaiting_approval":
      return "等待审批";
    case "approved":
      return "已审批";
    case "plan_ready":
      return "方案就绪";
    case "needs_review":
      return "等待审阅";
    case "running":
      return "执行中";
    case "accepted":
      return "已验收";
    case "completed":
      return "已完成";
    case "closed":
      return "已关闭";
    case "cancelled":
      return "已取消";
    case "failed":
      return "执行失败";
    case "blocked":
      return "受阻";
    case "rejected":
      return "已退回";
    case "unavailable":
      return "未提供";
    default:
      return "自定义状态";
  }
}

function formatTicketSource(source: unknown): string {
  switch (source) {
    case "hook":
      return "Hook 提交";
    case "api":
      return "接口提交";
    case "loom":
      return "Loom 提交";
    case "schedule":
      return "定时提交";
    case "human":
    case undefined:
    case null:
    case "":
      return "手动提交";
    default:
      return "其他来源";
  }
}

function formatApprovalPolicy(value: unknown): string {
  switch (value) {
    case "human_before_execute":
      return "执行前人工确认";
    case "human_before_completion":
      return "完成前人工验收";
    case "manual_only":
      return "仅人工推进";
    case "plan_only":
      return "只生成方案";
    case "auto_execute":
      return "自动执行";
    case undefined:
    case null:
    case "":
      return "未提供";
    default:
      return "自定义审批策略";
  }
}

function formatRiskLevel(value: unknown): string {
  switch (value) {
    case "low":
      return "低风险";
    case "medium":
      return "中风险";
    case "high":
      return "高风险";
    case "critical":
      return "高危";
    case undefined:
    case null:
    case "":
      return "未提供";
    default:
      return "自定义风险等级";
  }
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

function configSource(status: TeaStatusView | null): string {
  const source = status?.configuration_source;
  if (source === "loom-managed" || source === "fallback" || source === "local") {
    return source;
  }
  return typeof source === "string" && source.trim() ? "custom" : "unavailable";
}

function configSourceLabel(status: TeaStatusView | null): string {
  switch (configSource(status)) {
    case "loom-managed":
      return "Loom 集中管理";
    case "fallback":
      return "本地兜底";
    case "local":
      return "Tea 本地配置";
    case "unavailable":
      return "未声明";
    default:
      return "自定义配置";
  }
}

function configOwner(status: TeaStatusView | null): string | null {
  return typeof status?.configuration?.owner === "string" && status.configuration.owner.trim()
    ? status.configuration.owner
    : null;
}

function configOwnerLabel(status: TeaStatusView | null): string {
  switch (configOwner(status)) {
    case "loom":
      return "归属：Loom";
    case "tea":
      return "归属：Tea";
    case null:
      return "归属：未声明";
    default:
      return `归属：${configOwner(status)}`;
  }
}

function configPanelHref(status: TeaStatusView | null): string {
  const panelUrl = safeLocalLoomUrl(status?.configuration?.loom_panel_url);
  if (panelUrl && configSource(status) === "loom-managed") {
    return panelUrl;
  }
  return "/tea/settings";
}

function configActionLabel(status: TeaStatusView | null): string {
  return configSource(status) === "loom-managed" ? "在 Loom 中配置 Tea" : "打开 Tea 本地设置";
}

function brainProviderMode(status: TeaStatusView | null): string {
  const mode = status?.brain_provider?.mode;
  if (mode === "loom" || mode === "template" || mode === "manual") {
    return mode;
  }
  return typeof mode === "string" && mode.trim() ? "custom" : "unavailable";
}

function brainProviderModeLabel(status: TeaStatusView | null): string {
  switch (brainProviderMode(status)) {
    case "loom":
      return "Loom 强推理";
    case "template":
      return "模板拆解";
    case "manual":
      return "人工拆解";
    case "unavailable":
      return "未声明";
    default:
      return "自定义拆解模式";
  }
}

function brainProviderCapability(status: TeaStatusView | null): string {
  switch (status?.brain_provider?.capability) {
    case "tea.ticket.decompose.v1":
    case undefined:
    case null:
    case "":
      return "工单拆解能力";
    default:
      return "自定义拆解能力";
  }
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
  let teaStatus: TeaStatusView | null = null;
  let loadError: string | null = null;
  try {
    [tickets, teaStatus] = await Promise.all([listTeaTickets(userContext), getTeaStatus(userContext)]);
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
              <p className="mg-subtitle">Tea 工单台</p>
              <h1 className="mg-title">AI 工单控制台</h1>
              <p className="mg-copy">
                这里是 Platform Web 的 Tea 入口。浏览器只访问 Platform Web；工单详情、执行证据和流转动作由平台统一读取与转发，
                后台凭证不会暴露给浏览器。
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
                kicker="队列"
                title="Tea 工单队列"
              />

              {loadError ? (
                <Card className="app-stack">
                  <Badge variant="danger">工单服务暂不可用</Badge>
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
                            <p className="mg-subtitle">{formatTicketSource(ticket.source)} · {ticket.id}</p>
                            <h2 className="app-card-title">{ticket.title || "未命名 Tea 工单"}</h2>
                          </div>
                          <Badge variant={statusBadgeVariant(ticketStatus)}>{formatTicketStatusLabel(ticketStatus)}</Badge>
                        </div>
                        <p className="mg-copy">{ticket.description || "无描述。"}</p>
                        <AccountHomeList>
                          <AccountHomeListRow
                            aside={<span className="app-note">{formatApprovalPolicy(ticket.approval_policy)}</span>}
                            title="审批策略"
                          />
                          <AccountHomeListRow
                            aside={<span className="app-note">{formatRiskLevel(ticket.risk_level)}</span>}
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
                            {lifecycleButton(ticket, "decompose", "拆解工单", "mg-btn--primary")}
                            {lifecycleButton(ticket, "approve", "审批", "mg-btn--secondary")}
                            {lifecycleButton(ticket, "run", "执行", "mg-btn--primary")}
                            {lifecycleButton(ticket, "accept", "验收")}
                            {lifecycleButton(ticket, "close", "关闭")}
                            {lifecycleButton(ticket, "cancel", "取消")}
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
              <AccountHomeSectionHead kicker="配置" title="配置归属" />
              <Card className="app-stack">
                <div className="app-action-row">
                  <Badge variant={configSource(teaStatus) === "loom-managed" ? "cyan" : "glass"}>
                    {configSourceLabel(teaStatus)}
                  </Badge>
                  <span className="app-note">{configOwnerLabel(teaStatus)}</span>
                </div>
                <p className="mg-copy">
                  {configSource(teaStatus) === "loom-managed"
                    ? "当前 Tea 设置由 Loom 集中管理。此处只展示状态，配置按钮会跳转到 Loom 的 Tea 配置入口。"
                    : configSource(teaStatus) === "fallback"
                      ? `未读取到 Loom 集中配置声明，Tea 会继续使用本地配置保持可用：${
                          teaStatus?.configuration?.reason || "未提供原因"
                        }`
                      : "当前 Tea 使用本地配置。没有可用 Loom 接管声明时，Tea 保持独立可配置。"}
                </p>
                <Link className="mg-btn mg-btn--secondary" href={configPanelHref(teaStatus)}>
                  {configActionLabel(teaStatus)}
                </Link>
              </Card>
            </AccountHomeSection>

            <AccountHomeSection>
              <AccountHomeSectionHead kicker="智能拆解" title="拆解能力" />
              <Card className="app-stack">
                <div className="app-action-row">
                  <Badge variant={brainProviderMode(teaStatus) === "loom" ? "cyan" : "glass"}>
                    {brainProviderModeLabel(teaStatus)}
                  </Badge>
                  <span className="app-note">{brainProviderCapability(teaStatus)}</span>
                </div>
                <p className="mg-copy">
                  Tea 负责工单生命周期和拆解记录；Loom 负责强推理拆解提案。没有 Loom 时，Tea 会使用本地
                  模板或人工流程保持独立可用。
                </p>
              </Card>
            </AccountHomeSection>

            <AccountHomeSection>
              <AccountHomeSectionHead kicker="创建" title="提交 AI 工单" />
              <form action={createTeaTicketAction} className="app-form-grid">
                <input name="redirectTo" type="hidden" value="/tea" />
                <Input name="title" placeholder="工单标题，例如：修复 Hook 截图上传失败" required />
                <Textarea
                  name="description"
                  placeholder="描述目标、上下文、验收标准、限制条件。Tea 会记录工单，并在拆解时使用 Loom 或本地模板生成提案。"
                  required
                  rows={6}
                />
                <button className="mg-btn mg-btn--primary" type="submit">
                  创建 Tea 工单
                </button>
              </form>
            </AccountHomeSection>

            <AccountHomeSection>
              <AccountHomeSectionHead kicker="状态" title="状态分布" />
              {statusCounts.length === 0 ? (
                <p className="mg-copy">暂无可统计状态。</p>
              ) : (
                <AccountHomeList>
                  {statusCounts.map(([ticketStatus, count]) => (
                    <AccountHomeListRow
                      aside={<Badge variant={statusBadgeVariant(ticketStatus)}>{String(count)}</Badge>}
                      key={ticketStatus}
                      title={formatTicketStatusLabel(ticketStatus)}
                    />
                  ))}
                </AccountHomeList>
              )}
            </AccountHomeSection>

            <AccountHomeSection>
              <AccountHomeSectionHead kicker="访问" title="访问说明" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">浏览器只访问 Platform Web</span>} title="前端入口" />
                <AccountHomeListRow aside={<span className="app-note">工单创建、审批与流转由平台统一转发</span>} title="操作方式" />
                <AccountHomeListRow aside={<span className="app-note">后台凭证由服务端托管，不暴露给浏览器</span>} title="安全边界" />
              </AccountHomeList>
            </AccountHomeSection>
          </div>
        </div>
      </div>
    </main>
  );
}
