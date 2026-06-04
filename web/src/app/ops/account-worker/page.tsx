import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, Panel } from "@/components/ui/card";
import {
} from "@/lib/account-client";
import { getAccountWorkerHealth } from "@/lib/account-worker-client";
import { isPlatformOperatorUserId } from "@/lib/platform-session";
import { consumeWorkerOpsRecentSessionsToken, WORKER_OPS_RECENT_SESSIONS_COOKIE } from "@/lib/worker-ops-session";

type AccountWorkerOpsPageProps = {
  searchParams?: Promise<{
    runWindow?: string;
  }>;
};

type RunWindowKey = "6h" | "24h" | "7d" | "all";

type BacklogRiskLevel = "healthy" | "watch" | "critical";

type WorkerRecommendation = {
  key: string;
  title: string;
  detail: string;
  variant: "cyan" | "fuchsia" | "warning";
  href: string;
  actionLabel: string;
};

type WorkerOpsPlaybookArgs = {
  focus: string;
  playbookId?: string;
  reopenRunId?: string;
  source: string;
  runWindow: RunWindowKey;
  actionIntent?: string;
  digestIds?: string[];
  digestStatus?: string;
  digestEventName?: string;
  presetMode?: string;
  subscriptionMode?: string;
  subscriptionEventName?: string;
  subscriptionDeliveryMode?: string;
};

type DigestFailureCluster = {
  message: string;
  count: number;
  latestAt: string;
  triggers: string[];
  category: "worker" | "manual" | "mixed";
};

function toLocaleDateTime(value: string | null | undefined) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString("zh-CN");
}

function getWorkerHealthStatusLabel(status: "success" | "error" | null) {
  if (status === "success") return "Healthy";
  if (status === "error") return "Degraded";
  return "Unknown";
}

function getWorkerHealthStatusBadgeVariant(status: "success" | "error" | null) {
  if (status === "success") return "cyan" as const;
  if (status === "error") return "warning" as const;
  return "fuchsia" as const;
}

function getFailureClusterCategoryLabel(category: DigestFailureCluster["category"]) {
  if (category === "manual") return "Manual Cluster";
  if (category === "mixed") return "Mixed Cluster";
  return "Worker Cluster";
}

function getWorkerOpsFocusLabel(
  focus:
    | "archive-digest-queue"
    | "archive-failing-presets"
    | "archive-subscriptions"
    | "archive-cleanup-alert",
) {
  if (focus === "archive-digest-queue") return "Digest Queue";
  if (focus === "archive-failing-presets") return "Failing Presets";
  if (focus === "archive-subscriptions") return "Mailbox Subscriptions";
  return "Cleanup Alert";
}

function getWorkerOpsActionIntentLabel(
  intent: "retry-digests" | "dismiss-digests" | "retry-archives" | "create-subscription" | "acknowledge-cleanup" | null,
) {
  if (intent === "retry-digests") return "批量重试 Digest";
  if (intent === "dismiss-digests") return "批量忽略 Digest";
  if (intent === "retry-archives") return "立即重试失败归档";
  if (intent === "create-subscription") return "创建订阅规则";
  if (intent === "acknowledge-cleanup") return "确认 Cleanup 告警";
  return "观察模式";
}

function averagePerRun(total: number, count: number) {
  if (count <= 0) return "0.0";
  return (total / count).toFixed(1);
}

function failureRate(runs: Array<{ failedCount: number; errorMessage: string | null }>) {
  if (runs.length === 0) return "0%";
  const failedRuns = runs.filter((run) => run.failedCount > 0 || Boolean(run.errorMessage)).length;
  return `${Math.round((failedRuns / runs.length) * 100)}%`;
}

function getRunWindowLabel(runWindow: RunWindowKey) {
  if (runWindow === "6h") return "最近 6 小时";
  if (runWindow === "7d") return "最近 7 天";
  if (runWindow === "all") return "全部记录";
  return "最近 24 小时";
}

function normalizeRunWindow(value: string | undefined): RunWindowKey {
  if (value === "6h" || value === "24h" || value === "7d" || value === "all") {
    return value;
  }
  return "24h";
}

function filterRunsByWindow<T extends { finishedAt: string }>(runs: T[], runWindow: RunWindowKey): T[] {
  if (runWindow === "all") {
    return runs;
  }

  const nowTime = Date.now();
  const hours = runWindow === "6h" ? 6 : runWindow === "7d" ? 24 * 7 : 24;
  const cutoff = nowTime - hours * 60 * 60 * 1000;
  return runs.filter((run) => new Date(run.finishedAt).getTime() >= cutoff);
}

function getBacklogRiskVariant(level: BacklogRiskLevel) {
  if (level === "critical") return "warning" as const;
  if (level === "watch") return "fuchsia" as const;
  return "cyan" as const;
}

function assessDigestBacklogRisk(_args: {
  workerHealth: Awaited<ReturnType<typeof getAccountWorkerHealth>> | null;
}) {
  return {
    level: "healthy" as const,
    title: "当前健康",
    detail: "archive-alert digest 系统已移除。",
  };
}

function buildAccountWorkerPageHref(runWindow: RunWindowKey, hash?: string) {
  const query = runWindow === "24h" ? "" : `?runWindow=${encodeURIComponent(runWindow)}`;
  return hash ? `/ops/account-worker${query}${hash}` : `/ops/account-worker${query}`;
}

function buildProductsOpsPlaybookHref(args: WorkerOpsPlaybookArgs) {
  const query = new URLSearchParams({
    workerOpsFocus: args.focus,
    workerOpsSource: args.source,
    workerOpsRunWindow: args.runWindow,
  });
  if (args.playbookId) {
    query.set("playbookId", args.playbookId);
  }
  if (args.reopenRunId) {
    query.set("reopenRunId", args.reopenRunId);
  }
  if (args.digestStatus && args.digestStatus !== "all") {
    query.set("workerOpsDigestStatus", args.digestStatus);
  }
  if (args.actionIntent) {
    query.set("workerOpsActionIntent", args.actionIntent);
  }
  if (args.digestIds && args.digestIds.length > 0) {
    query.set("workerOpsDigestIds", args.digestIds.join(","));
  }
  if (args.digestEventName) {
    query.set("workerOpsDigestEventName", args.digestEventName);
  }
  if (args.presetMode && args.presetMode !== "all") {
    query.set("workerOpsPresetMode", args.presetMode);
  }
  if (args.subscriptionMode && args.subscriptionMode !== "all") {
    query.set("workerOpsSubscriptionMode", args.subscriptionMode);
  }
  if (args.subscriptionEventName) {
    query.set("workerOpsSubscriptionEventName", args.subscriptionEventName);
  }
  if (args.subscriptionDeliveryMode) {
    query.set("workerOpsSubscriptionDeliveryMode", args.subscriptionDeliveryMode);
  }
  return `/ops/products/session/start?${query.toString()}`;
}

function buildFailureClusters(runs: Array<{ failedCount: number; errorMessage: string | null; finishedAt: string; trigger: string }>) {
  const clusterMap = new Map<string, DigestFailureCluster>();

  for (const run of runs) {
    if (run.failedCount <= 0 && !run.errorMessage) {
      continue;
    }

    const message = run.errorMessage?.trim() || "worker flush failed without explicit error";
    const existing = clusterMap.get(message);
    const latestAt = existing && new Date(existing.latestAt).getTime() > new Date(run.finishedAt).getTime()
      ? existing.latestAt
      : run.finishedAt;
    const triggers = existing
      ? Array.from(new Set([...existing.triggers, run.trigger]))
      : [run.trigger];
    const category =
      triggers.length > 1 ? "mixed" : triggers[0] === "manual" ? "manual" : "worker";

    clusterMap.set(message, {
      message,
      count: (existing?.count ?? 0) + 1,
      triggers,
      latestAt,
      category,
    });
  }

  return Array.from(clusterMap.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime();
  });
}

function buildWorkerRecommendations(args: {
  workerHealth: Awaited<ReturnType<typeof getAccountWorkerHealth>> | null;
  backlogRisk: ReturnType<typeof assessDigestBacklogRisk>;
  runWindow: RunWindowKey;
}) {
  const recommendations: WorkerRecommendation[] = [];

  if (args.workerHealth?.lastProductShadowSyncStatus === "error") {
    recommendations.push({
      key: "shadow-sync",
      title: "检查 Product Shadow Sync",
      detail: `最近 shadow sync 处于 error 状态，错误：${args.workerHealth.lastProductShadowSyncError ?? "未知错误"}。这通常意味着 dedicated-db 商品影子预热或增量刷新需要介入。`,
      variant: "warning",
      href: buildAccountWorkerPageHref(args.runWindow, "#worker-runtime"),
      actionLabel: "查看 Worker Runtime",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      key: "healthy",
      title: "当前无需额外介入",
      detail: "最近时间窗内没有明显异常。当前更适合持续观察，而不是主动干预。",
      variant: "cyan",
      href: buildAccountWorkerPageHref(args.runWindow, "#worker-runtime"),
      actionLabel: "查看当前快照",
    });
  }

  return recommendations;
}

export default async function AccountWorkerOpsPage({ searchParams }: AccountWorkerOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const runWindow = normalizeRunWindow(params?.runWindow);
  const cookieStore = await cookies();
  const recentWorkerOpsSessions = cookieStore.get(WORKER_OPS_RECENT_SESSIONS_COOKIE)?.value
    ? await consumeWorkerOpsRecentSessionsToken(cookieStore.get(WORKER_OPS_RECENT_SESSIONS_COOKIE)?.value || "")
    : [];
  const normalizedRecentWorkerOpsSessions = recentWorkerOpsSessions.filter(
    (sessionEntry): sessionEntry is NonNullable<(typeof recentWorkerOpsSessions)[number]> => Boolean(sessionEntry),
  );

  const isOperator = isPlatformOperatorUserId(session.user.id, session.user.providerUserId);
  const userContext = {
    userId: session.user.id,
    providerUserId: session.user.providerUserId ?? undefined,
    username: session.user.username,
  };

  let workerHealth = null;
  let workerHealthError: string | null = null;

  let loadError: string | null = null;

  if (isOperator) {
    try {
      workerHealth = await getAccountWorkerHealth();
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法加载 account worker 运维数据。";
      loadError = message;
      workerHealthError = message;
    }
  }

  const digestRuns: Array<Record<string, unknown> & { failedCount: number; errorMessage: string | null; finishedAt: string; trigger: string; flushedCount: number; scannedCount: number; id: string }> = [];
  const digests: Array<Record<string, unknown> & { id: string; status: string; deliveryMode: string; eventName: string; title: string; eventCount: number; dueAt: string; subscriptionId: string }> = [];
  const subscriptions: Array<Record<string, unknown> & { id: string; eventName: string; deliveryMode: string; userId: string }> = [];
  const digestSummary = null;
  const filteredRuns = filterRunsByWindow(digestRuns, runWindow);
  const workerRuns = filteredRuns.filter((run) => run.trigger === "worker");
  const manualRuns = filteredRuns.filter((run) => run.trigger === "manual");
  const recentRuns = filteredRuns.slice(0, 8);
  const pendingDigests = digests.filter((digest) => digest.status === "pending");
  const totalFlushed = recentRuns.reduce((sum, run) => sum + run.flushedCount, 0);
  const totalFailed = recentRuns.reduce((sum, run) => sum + run.failedCount, 0);
  const totalScanned = recentRuns.reduce((sum, run) => sum + run.scannedCount, 0);
  const backlogRisk = assessDigestBacklogRisk({ workerHealth });
  const failureClusters = buildFailureClusters(filteredRuns);
  const recommendations = buildWorkerRecommendations({
    workerHealth,
    backlogRisk,
    runWindow,
  });
  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <Panel className="app-stack">
          <span className="mg-badge mg-badge--warning">Operator Ops</span>
          <h1 className="mg-title">Account Worker Ops</h1>
          <p className="mg-copy">
            这里聚焦 `account-worker` 的私网健康状态、digest queue 压力和最近 flush 趋势。产品运营页继续保留动作入口，运行单元状态在这里集中观察。
          </p>
          <div className="app-inline-actions">
            <Badge variant={getBacklogRiskVariant(backlogRisk.level)}>{backlogRisk.title}</Badge>
            <Link className="mg-btn mg-btn--secondary" href="/ops/products">
              返回 Products Ops
            </Link>
          </div>
        </Panel>

        {!isOperator ? (
          <Card className="app-stack">
            <p className="app-banner app-banner--warning">当前账号无法访问 account worker 运维台，需要平台操作员权限。</p>
          </Card>
        ) : null}

        {loadError ? (
          <Card className="app-stack">
            <p className="app-banner app-banner--error">{loadError}</p>
          </Card>
        ) : null}

        {isOperator ? (
          <>
            <div className="app-wallet-grid">
              <Card className="app-currency-card">
                <p className="mg-subtitle">Risk</p>
                <h2 className="app-card-title">Backlog</h2>
                <div className="app-inline-actions">
                  <Badge variant={getBacklogRiskVariant(backlogRisk.level)}>{backlogRisk.title}</Badge>
                </div>
                <p className="app-note">{backlogRisk.detail}</p>
              </Card>
              <Card className="app-currency-card">
                <p className="mg-subtitle">Worker</p>
                <h2 className="app-card-title">Digest Health</h2>
                <div className="app-inline-actions">
                  <Badge variant={getWorkerHealthStatusBadgeVariant(null)}>
                    {getWorkerHealthStatusLabel(null)}
                  </Badge>
                </div>
                <p className="app-note">
                  最近 flush：{toLocaleDateTime(null)}
                </p>
              </Card>
              <Card className="app-currency-card">
                <p className="mg-subtitle">Queue</p>
                <h2 className="app-card-title">Open / Due</h2>
                <div className="app-currency-card__value">
                  {0} /{" "}
                  {0}
                </div>
                <p className="app-note">
                  Scheduled {0}
                </p>
              </Card>
              <Card className="app-currency-card">
                <p className="mg-subtitle">Runs</p>
                <h2 className="app-card-title">Recent 8</h2>
                <div className="app-currency-card__value">{recentRuns.length}</div>
                <p className="app-note">
                  平均发送 {averagePerRun(totalFlushed, recentRuns.length)} / 失败率 {failureRate(recentRuns)}
                </p>
              </Card>
              <Card className="app-currency-card">
                <p className="mg-subtitle">Worker</p>
                <h2 className="app-card-title">Shadow Sync</h2>
                <div className="app-inline-actions">
                  <Badge variant={getWorkerHealthStatusBadgeVariant(workerHealth?.lastProductShadowSyncStatus ?? null)}>
                    {getWorkerHealthStatusLabel(workerHealth?.lastProductShadowSyncStatus ?? null)}
                  </Badge>
                </div>
                <p className="app-note">
                  最近同步：{toLocaleDateTime(workerHealth?.lastProductShadowSyncAt ?? null)}
                </p>
              </Card>
              <Card className="app-currency-card">
                <p className="mg-subtitle">Subscriptions</p>
                <h2 className="app-card-title">Rules</h2>
                <div className="app-currency-card__value">{subscriptions.length}</div>
                <p className="app-note">Pending digest {pendingDigests.length} 条。</p>
              </Card>
            </div>

            <Card className="app-stack">
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">Runbook</p>
                  <h2 className="app-card-title">当前处理建议</h2>
                </div>
                <Badge variant={getBacklogRiskVariant(backlogRisk.level)}>{recommendations.length} Suggestions</Badge>
              </div>
              <div className="app-task-list">
                {recommendations.map((recommendation) => (
                  <div className="app-task-card" key={recommendation.key}>
                    <div className="app-task-card__header">
                      <div>
                        <p className="mg-subtitle">{recommendation.key}</p>
                        <h3 className="app-card-title">{recommendation.title}</h3>
                      </div>
                      <Badge variant={recommendation.variant}>{recommendation.variant}</Badge>
                    </div>
                    <p className="app-note">{recommendation.detail}</p>
                    <div className="app-inline-actions">
                      <Link className="mg-btn mg-btn--secondary" href={recommendation.href}>
                        {recommendation.actionLabel}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="app-stack">
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">Recent Playbooks</p>
                  <h2 className="app-card-title">最近运维会话</h2>
                </div>
                <Badge variant={normalizedRecentWorkerOpsSessions.length > 0 ? "warning" : "cyan"}>
                  {normalizedRecentWorkerOpsSessions.length} Sessions
                </Badge>
              </div>
              {normalizedRecentWorkerOpsSessions.length > 0 ? (
                <div className="app-task-list">
                  {normalizedRecentWorkerOpsSessions.map((sessionEntry) => (
                    <div className="app-task-card" key={sessionEntry.id}>
                      <div className="app-task-card__header">
                        <div>
                          <p className="mg-subtitle">{sessionEntry.id}</p>
                          <h3 className="app-card-title">{getWorkerOpsFocusLabel(sessionEntry.payload.focus)}</h3>
                        </div>
                        <div className="app-inline-actions">
                          <Badge variant="warning">{getWorkerOpsActionIntentLabel(sessionEntry.payload.actionIntent)}</Badge>
                        </div>
                      </div>
                      <p className="app-note">
                        记录时间：{toLocaleDateTime(sessionEntry.createdAt)} / 来源：{sessionEntry.payload.source ?? "worker-ops"} / 时间窗：
                        {sessionEntry.payload.runWindow ?? "24h"}
                      </p>
                      <p className="app-note">
                        目标 digest：{sessionEntry.payload.digestIds.length} / 事件：
                        {sessionEntry.payload.subscriptionEventName ?? sessionEntry.payload.digestEventName ?? "未指定"}
                      </p>
                      <div className="app-inline-actions">
                        <Link
                          className="mg-btn mg-btn--secondary"
                          href={`/ops/products/session/start?resumeSessionId=${encodeURIComponent(sessionEntry.id)}`}
                        >
                          重新进入会话
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="app-note">当前还没有可重开的 worker playbook 会话。</p>
              )}
            </Card>

            <Card className="app-stack" id="failure-clusters">
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">Failure Reasons</p>
                  <h2 className="app-card-title">最近失败原因聚类</h2>
                </div>
                <div className="app-inline-actions">
                  <Badge variant="fuchsia">{getRunWindowLabel(runWindow)}</Badge>
                  <Badge variant={failureClusters.length > 0 ? "warning" : "cyan"}>
                    {failureClusters.length} Clusters
                  </Badge>
                </div>
              </div>
              {failureClusters.length > 0 ? (
                <div className="app-task-list">
                  {failureClusters.slice(0, 6).map((cluster) => (
                    <div className="app-task-card" key={cluster.message}>
                      <div className="app-task-card__header">
                        <div>
                          <p className="mg-subtitle">
                            {getFailureClusterCategoryLabel(cluster.category)} /{" "}
                            {cluster.triggers.map((trigger) => trigger).join(" / ")}
                          </p>
                          <h3 className="app-card-title">{cluster.message}</h3>
                        </div>
                        <Badge variant={cluster.count >= 3 ? "warning" : "fuchsia"}>{cluster.count} 次</Badge>
                      </div>
                      <p className="app-note">最近出现：{toLocaleDateTime(cluster.latestAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="app-note">当前时间窗内没有聚类出的失败原因。</p>
              )}
            </Card>

            <Card className="app-stack">
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">Run Window</p>
                  <h2 className="app-card-title">按时间窗查看 flush 趋势</h2>
                </div>
                <Badge variant="warning">{getRunWindowLabel(runWindow)}</Badge>
              </div>
              <form action="/ops/account-worker" className="app-inline-actions" method="get">
                <select className="mg-select" defaultValue={runWindow} name="runWindow">
                  <option value="6h">最近 6 小时</option>
                  <option value="24h">最近 24 小时</option>
                  <option value="7d">最近 7 天</option>
                  <option value="all">全部记录</option>
                </select>
                <button className="mg-btn mg-btn--secondary" type="submit">
                  应用时间窗
                </button>
              </form>
            </Card>

            <Card className="app-stack" id="worker-runtime">
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">Worker Runtime</p>
                  <h2 className="app-card-title">私网 `/health` 快照</h2>
                </div>
                <div className="app-inline-actions">
                  <Badge variant="warning">Internal</Badge>
                  <Badge variant={getWorkerHealthStatusBadgeVariant(null)}>
                    {getWorkerHealthStatusLabel(null)}
                  </Badge>
                </div>
              </div>
              {workerHealth ? (
                <div className="app-detail-list">
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">Started At</span>
                    <span className="app-detail-list__value">{toLocaleDateTime(workerHealth.startedAt)}</span>
                  </div>
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">Last Cycle</span>
                    <span className="app-detail-list__value">{toLocaleDateTime(workerHealth.lastCycleAt)}</span>
                  </div>
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">Last Success</span>
                    <span className="app-detail-list__value">{toLocaleDateTime(workerHealth.lastSuccessAt)}</span>
                  </div>
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">Last Error</span>
                    <span className="app-detail-list__value">
                      {toLocaleDateTime(workerHealth.lastErrorAt)} / {workerHealth.lastErrorMessage ?? "无"}
                    </span>
                  </div>
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">Last Digest Run</span>
                    <span className="app-detail-list__value">
                      {"暂无"} /{" "}
                      {toLocaleDateTime(null)}
                    </span>
                  </div>
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">Last Digest Error</span>
                    <span className="app-detail-list__value">{"无"}</span>
                  </div>
                  <div className="app-detail-list__row">
                    <span className="app-detail-list__label">Last Shadow Sync</span>
                    <span className="app-detail-list__value">
                      {toLocaleDateTime(workerHealth.lastProductShadowSyncAt)} /{" "}
                      {workerHealth.lastProductShadowSyncError ?? "无"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="app-banner app-banner--warning">
                  account-worker /health 当前不可用。{workerHealthError ? ` ${workerHealthError}` : ""}
                </p>
              )}
            </Card>

            <div className="app-wallet-grid">
              <Card className="app-stack">
                <div className="app-task-card__header">
                  <div>
                    <p className="mg-subtitle">Digest Pressure</p>
                    <h2 className="app-card-title">运行单元视角</h2>
                  </div>
                  <Badge variant="cyan">Worker Snapshot</Badge>
                </div>
                <p className="app-note">
                  Open {0} / Due {0} /
                  Scheduled {0}
                </p>
                <p className="app-note">
                  Archive Failure {0} / Cleanup Failure{" "}
                  {0}
                </p>
                <p className="app-note">
                  最早到期：{toLocaleDateTime(null)}，下一窗口：
                  {toLocaleDateTime(null)}
                </p>
              </Card>
              <Card className="app-stack">
                <div className="app-task-card__header">
                  <div>
                    <p className="mg-subtitle">Digest Pressure</p>
                    <h2 className="app-card-title">账户域视角</h2>
                  </div>
                  <Badge variant="warning">Mailbox Summary</Badge>
                </div>
                <p className="app-note">
                  Open {0} / Due {0} / Scheduled{" "}
                  {0}
                </p>
                <p className="app-note">
                  Archive Failure {0} / Cleanup Failure{" "}
                  {0}
                </p>
                <p className="app-note">
                  最早到期：{toLocaleDateTime(null)}，最近 flush：
                  {toLocaleDateTime(null)}
                </p>
              </Card>
            </div>

            <Card className="app-stack" id="flush-trend">
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">Flush Trend</p>
                  <h2 className="app-card-title">最近 digest flush 趋势</h2>
                </div>
                <div className="app-inline-actions">
                  <Badge variant="fuchsia">{getRunWindowLabel(runWindow)}</Badge>
                  <Badge variant="warning">{workerRuns.length} Worker Runs</Badge>
                  <Badge variant="cyan">{manualRuns.length} Manual Runs</Badge>
                </div>
              </div>
              <p className="app-note">
                最近 {recentRuns.length} 次运行共扫描 {totalScanned} 条、发送 {totalFlushed} 条、失败 {totalFailed} 条。
              </p>
              {recentRuns.length > 0 ? (
                <div className="app-task-list">
                  {recentRuns.map((run) => (
                    <div className="app-task-card" key={run.id}>
                      <div className="app-task-card__header">
                        <div>
                          <p className="mg-subtitle">{run.id}</p>
                          <h3 className="app-card-title">{run.trigger}</h3>
                        </div>
                        <div className="app-inline-actions">
                          <Badge variant={run.failedCount > 0 || run.errorMessage ? "warning" : "cyan"}>
                            {run.failedCount > 0 || run.errorMessage ? "Degraded" : "Healthy"}
                          </Badge>
                          <Badge variant="fuchsia">Scan {run.scannedCount}</Badge>
                          <Badge variant="cyan">Sent {run.flushedCount}</Badge>
                        </div>
                      </div>
                      <p className="app-note">
                        触发人：{String(run.operatorUserId ?? "account-worker")} / 请求上限 {String(run.requestedLimit ?? "")} / 失败 {run.failedCount}
                      </p>
                      <p className="app-note">
                        开始 {toLocaleDateTime(String(run.startedAt ?? ""))} / 完成 {toLocaleDateTime(run.finishedAt)}
                      </p>
                      {run.errorMessage ? <p className="app-note">错误：{run.errorMessage}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="app-note">还没有 digest flush 运行历史。</p>
              )}
            </Card>

            <div className="app-wallet-grid">
              <Card className="app-stack">
                <div className="app-task-card__header">
                  <div>
                    <p className="mg-subtitle">Pending Digests</p>
                    <h2 className="app-card-title">待发送队列预览</h2>
                  </div>
                  <div className="app-inline-actions">
                    <Badge variant="warning">{pendingDigests.length} Pending</Badge>
                    <Link className="mg-btn mg-btn--secondary" href="/ops/products">
                      去 Products Ops 处理
                    </Link>
                  </div>
                </div>
                {pendingDigests.length > 0 ? (
                  <div className="app-task-list">
                    {pendingDigests.slice(0, 6).map((digest) => (
                      <div className="app-task-card" key={digest.id}>
                        <div className="app-task-card__header">
                          <div>
                            <p className="mg-subtitle">{digest.id}</p>
                            <h3 className="app-card-title">{String(digest.latestTitle ?? "")}</h3>
                          </div>
                          <div className="app-inline-actions">
                            <Badge variant={digest.deliveryMode === "digest" ? "fuchsia" : "cyan"}>
                              {digest.deliveryMode}
                            </Badge>
                            <Badge variant="warning">{digest.status}</Badge>
                          </div>
                        </div>
                        <p className="app-note">
                          聚合 {digest.eventCount} 条，最高失败 {String(digest.maxFailureCount ?? 0)}，Due {toLocaleDateTime(digest.dueAt)}
                        </p>
                        <p className="app-note">
                          渠道 {String(digest.operatorChannel ?? "全局")} / Namespace {String(digest.namespace ?? "全局")} / Batch{" "}
                          {String(digest.batchLabel ?? "全局")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="app-note">当前没有 pending digest。</p>
                )}
              </Card>

              <Card className="app-stack">
                <div className="app-task-card__header">
                  <div>
                    <p className="mg-subtitle">Subscriptions</p>
                    <h2 className="app-card-title">当前定向订阅预览</h2>
                  </div>
                  <Badge variant="cyan">{subscriptions.length} Rules</Badge>
                </div>
                {subscriptions.length > 0 ? (
                  <div className="app-task-list">
                    {subscriptions.slice(0, 6).map((subscription) => (
                      <div className="app-task-card" key={subscription.id}>
                        <div className="app-task-card__header">
                          <div>
                            <p className="mg-subtitle">{subscription.id}</p>
                            <h3 className="app-card-title">{subscription.eventName}</h3>
                          </div>
                          <Badge variant={subscription.deliveryMode === "digest" ? "fuchsia" : "cyan"}>
                            {subscription.deliveryMode}
                          </Badge>
                        </div>
                        <p className="app-note">
                          渠道 {String(subscription.operatorChannel ?? "全局")} / Namespace {String(subscription.namespace ?? "全局")} / Batch{" "}
                          {String(subscription.batchLabel ?? "全局")}
                        </p>
                        <p className="app-note">
                          Digest {String(subscription.digestWindowMinutes ?? 0)} 分钟 / 升级阈值 {String(subscription.escalateAfterCount ?? "未设置")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="app-note">当前没有 archive anomaly 定向订阅规则。</p>
                )}
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
