import { redirect } from "next/navigation";

import type {
  ArbitrationCaseView,
  ArbitrationCaseSummaryView,
  ArbitrationRemoteAttachmentCleanupQueueView,
  ArbitrationWorkloadView,
  TaskView,
} from "@neuro/contracts";
import { auth } from "@/auth";
import { DependencyState } from "@/components/dependency-state";
import { Card, Panel } from "@/components/ui/card";
import {
  combineDependencyResults,
  createDependencyFailureResult,
  createDependencyResult,
  type DependencyResult,
} from "@/lib/dependency-result";
import { arbitrationClient } from "@/lib/arbitration-core-client";
import {
  getFeatureSnapshot,
  getPublicSurfaceSnapshotStrict,
  isFeatureSnapshotUnavailable,
  listTasks,
} from "@/lib/core-client";
import { isPlatformOperatorUserId } from "@/lib/platform-session";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";
import { ArbitrationCaseFiltersCard } from "@/features/arbitration-center/shared/arbitration-case-filters-card";
import { ArbitrationCaseListSection } from "@/features/arbitration-center/owner/arbitration-case-list-section";
import { ArbitrationCleanupQueueCard } from "@/features/arbitration-center/ops/arbitration-cleanup-queue-card";
import { ArbitrationIntakeSection } from "@/features/arbitration-center/owner/arbitration-intake-section";
import { ArbitrationSummaryCards } from "@/features/arbitration-center/shared/arbitration-summary-cards";
import { ArbitrationWorkloadCard } from "@/features/arbitration-center/ops/arbitration-workload-card";

export type ArbitrationsPageProps = {
  searchParams?: Promise<{
    caseId?: string;
    status?: string;
    message?: string;
    caseStatus?: string;
    taskResolutionAction?: string;
    impact?: string;
    evidenceKind?: string;
    hasEvidence?: string;
    assignment?: string;
  }>;
};

type ArbitrationWorkspaceProps = ArbitrationsPageProps & {
  ownerOnly?: boolean;
  routePath?: "/my-arbitrations" | "/ops/account/arbitrations";
};

export async function renderArbitrationsWorkspace({
  searchParams,
  ownerOnly = false,
  routePath = "/ops/account/arbitrations",
}: ArbitrationWorkspaceProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isOperator = !ownerOnly && isPlatformOperatorUserId(session.user.id, session.user.providerUserId);
  if (!ownerOnly && !isOperator) {
    redirect(
      `/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问仲裁案件中心。")}`,
    );
  }
  const pageTitle = ownerOnly ? "我的仲裁与证据" : "仲裁案件中心";
  const [publicSurfaceResponse] = await Promise.allSettled([getPublicSurfaceSnapshotStrict()]);
  if (publicSurfaceResponse.status === "rejected") {
    return (
      <main className="app-page">
        <div className="nt-shell app-stack" style={{ paddingBlock: 32 }}>
          <h1 className="mg-title">{pageTitle}</h1>
          <DependencyState
            label="公开入口配置"
            result={createDependencyFailureResult({
              error: publicSurfaceResponse.reason,
              message: "公开入口配置暂不可用。",
              source: "public-surfaces",
              unauthorizedMessage: "当前账户无权读取公开入口配置。",
            })}
          />
        </div>
      </main>
    );
  }
  const publicSurfaces = publicSurfaceResponse.value;
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "arbitrations", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;
  const caseIdFilter = params?.caseId?.trim() || "";
  const caseStatusFilter = params?.caseStatus?.trim() || "";
  const taskResolutionActionFilter = params?.taskResolutionAction?.trim() || "";
  const impactFilter = params?.impact?.trim() || "";
  const evidenceKindFilter = params?.evidenceKind?.trim() || "";
  const hasEvidenceFilter = params?.hasEvidence?.trim() || "";
  const requestedAssignmentFilter = params?.assignment?.trim() || "";

  const userContext = {
    userId: session.user.id,
    username: session.user.username,
  };
  const showOperatorMetadata = isOperator;
  const assignmentFilter = showOperatorMetadata ? requestedAssignmentFilter : "";
  const filters = {
    caseIdFilter,
    caseStatusFilter,
    taskResolutionActionFilter,
    impactFilter,
    evidenceKindFilter,
    hasEvidenceFilter,
    assignmentFilter,
  };

  const features = await getFeatureSnapshot();
  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="mg-shell app-stack">
          <h1 className="mg-title">{pageTitle}</h1>
          <DependencyState
            label="仲裁模块"
            result={createDependencyFailureResult({
              error: new Error("Feature snapshot unavailable"),
              message: "当前无法读取仲裁模块状态，请稍后再试。",
              source: "core-features",
            })}
          />
        </div>
      </main>
    );
  }

  if (!features.arbitration.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell app-stack">
          <Card className="app-stack">
            <h1 className="mg-title">仲裁模块已关闭</h1>
            <p className="mg-copy">当前仲裁入口处于关闭状态。开启 `feature.arbitration` 后可提交案件与执行状态流转。</p>
          </Card>
        </div>
      </main>
    );
  }

  const listArbitrationCases = arbitrationClient.listArbitrationCases;
  const arbitrationApiReady = Boolean(
    listArbitrationCases &&
      arbitrationClient.createArbitrationCase &&
      arbitrationClient.addArbitrationEvidence &&
      (ownerOnly || arbitrationClient.updateArbitrationCaseStatus),
  );

  const dependencyResults: Array<DependencyResult<unknown>> = [];
  const dependencyResultsBySource = new Map<string, DependencyResult<unknown>>();
  function loadDependency<T>(
    promise: Promise<T>,
    args: {
      fallback: T;
      message: string;
      source: string;
      unauthorizedMessage: string;
    },
  ) {
    return promise.then(
      (value) => {
        const result = createDependencyResult({ state: "ready", data: value });
        dependencyResults.push(result);
        dependencyResultsBySource.set(args.source, result);
        return value;
      },
      (error: unknown) => {
        const result = createDependencyFailureResult<T>({
          error,
          message: args.message,
          source: args.source,
          unauthorizedMessage: args.unauthorizedMessage,
        });
        dependencyResults.push(result);
        dependencyResultsBySource.set(args.source, result);
        return args.fallback;
      },
    );
  }

  const tasksPromise = loadDependency(listTasks(userContext), {
    fallback: [] as TaskView[],
    message: "可申诉任务暂不可用。",
    source: "core-tasks",
    unauthorizedMessage: "当前账户无权读取可申诉任务。",
  });
  const arbitrationCasesPromise = listArbitrationCases
    ? loadDependency(listArbitrationCases(userContext), {
        fallback: [] as ArbitrationCaseView[],
        message: "仲裁案件暂不可用。",
        source: "arbitration-cases",
        unauthorizedMessage: "当前账户无权读取仲裁案件。",
      })
    : Promise.resolve([] as ArbitrationCaseView[]);
  const arbitrationSummaryPromise = !ownerOnly && arbitrationClient.getArbitrationCaseSummary
    ? loadDependency<ArbitrationCaseSummaryView | null>(arbitrationClient.getArbitrationCaseSummary(userContext), {
        fallback: null,
        message: "仲裁摘要暂不可用。",
        source: "arbitration-summary",
        unauthorizedMessage: "当前账户无权读取仲裁摘要。",
      })
    : Promise.resolve(null as ArbitrationCaseSummaryView | null);
  const arbitrationWorkloadPromise =
    isOperator && arbitrationClient.getArbitrationCaseWorkload
      ? loadDependency<ArbitrationWorkloadView | null>(arbitrationClient.getArbitrationCaseWorkload(userContext), {
          fallback: null,
          message: "仲裁工作负载暂不可用。",
          source: "arbitration-workload",
          unauthorizedMessage: "当前账户无权读取仲裁工作负载。",
        })
      : Promise.resolve(null as ArbitrationWorkloadView | null);
  const cleanupQueuePromise =
    isOperator && arbitrationClient.getArbitrationRemoteAttachmentCleanupQueue
      ? loadDependency<ArbitrationRemoteAttachmentCleanupQueueView | null>(
          arbitrationClient.getArbitrationRemoteAttachmentCleanupQueue(userContext, { limit: 20 }),
          {
            fallback: null,
            message: "远程附件清理队列暂不可用。",
            source: "arbitration-cleanup-queue",
            unauthorizedMessage: "当前账户无权读取远程附件清理队列。",
          },
        )
      : Promise.resolve(null as ArbitrationRemoteAttachmentCleanupQueueView | null);

  const [tasks, arbitrationCases, arbitrationSummary, arbitrationWorkload, cleanupQueue] = await Promise.all([
    tasksPromise,
    arbitrationCasesPromise,
    arbitrationSummaryPromise,
    arbitrationWorkloadPromise,
    cleanupQueuePromise,
  ]);
  const workspaceTasks = ownerOnly
    ? tasks.filter(
        (task) => task.creatorUserId === session.user.id || task.assignedUserId === session.user.id,
      )
    : tasks;
  const workspaceCases = ownerOnly
    ? arbitrationCases.filter(
        (arbitrationCase) =>
          arbitrationCase.requesterUserId === session.user.id ||
          arbitrationCase.respondentUserId === session.user.id,
      )
    : arbitrationCases;
  const filteredCases = workspaceCases.filter((arbitrationCase) => {
    if (caseIdFilter && arbitrationCase.id !== caseIdFilter) return false;
    if (caseStatusFilter && arbitrationCase.status !== caseStatusFilter) return false;
    if (
      taskResolutionActionFilter &&
      (arbitrationCase.taskResolutionAction ?? "none") !== taskResolutionActionFilter
    ) {
      return false;
    }
    if (impactFilter && arbitrationCase.reputationImpactForViewer !== impactFilter) return false;
    if (evidenceKindFilter && !arbitrationCase.evidences.some((evidence) => evidence.kind === evidenceKindFilter)) {
      return false;
    }
    if (hasEvidenceFilter === "with" && arbitrationCase.evidences.length === 0) return false;
    if (hasEvidenceFilter === "without" && arbitrationCase.evidences.length > 0) return false;
    if (assignmentFilter === "claimed" && !arbitrationCase.assignedOperatorUserId) return false;
    if (assignmentFilter === "unclaimed" && arbitrationCase.assignedOperatorUserId) return false;
    if (assignmentFilter === "mine" && arbitrationCase.assignedOperatorUserId !== session.user.id) return false;
    return true;
  });
  const arbitrationDependency = combineDependencyResults({
    data: null,
    empty:
      workspaceTasks.length === 0 &&
      workspaceCases.length === 0 &&
      arbitrationSummary === null &&
      (!isOperator || arbitrationWorkload === null) &&
      (!isOperator || cleanupQueue === null),
    results: dependencyResults,
  });
  const tasksDependency = dependencyResultsBySource.get("core-tasks");
  const casesDependency = dependencyResultsBySource.get("arbitration-cases");
  const tasksUnavailable = tasksDependency?.state === "unavailable" || tasksDependency?.state === "unauthorized";
  const casesUnavailable = casesDependency?.state === "unavailable" || casesDependency?.state === "unauthorized";

  if (arbitrationDependency.state === "unavailable" || arbitrationDependency.state === "unauthorized") {
    return (
      <main className="app-page">
        <div className="mg-shell" style={{ paddingBlock: 32 }}>
          <DependencyState label="仲裁数据" result={arbitrationDependency} />
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <Panel className="app-stack">
          <span className="mg-badge mg-badge--cyan">Arbitration</span>
          <h1 className="mg-title">{pageTitle}</h1>
          <p className="mg-copy">
            {ownerOnly
              ? "查看与你相关的案件、补充结构化证据并跟踪审理时间线。"
              : "该模块用于处理任务纠纷。当前页面已经接入建案、结构化证据、浏览器直传附件、认领派单、轮次推进与裁决动作。"}
          </p>
        </Panel>

        {status && message ? (
          <Card className="app-stack">
            <p className={status === "success" ? "app-banner app-banner--success" : "app-banner app-banner--error"}>
              {message}
            </p>
          </Card>
        ) : null}

        {arbitrationDependency.state === "partial" ? (
          <DependencyState label="仲裁数据" result={arbitrationDependency} />
        ) : null}

        {!arbitrationApiReady ? (
          <Card className="app-stack">
            <p className="app-banner app-banner--error">
              当前环境未启用仲裁操作能力，页面先以只读模式展示案件与状态概览。
            </p>
          </Card>
        ) : null}

        <ArbitrationIntakeSection
          arbitrationApiReady={arbitrationApiReady}
          filters={filters}
          routePath={routePath}
          tasksUnavailable={tasksUnavailable}
          workspaceTasks={workspaceTasks}
        />

        {arbitrationSummary ? (
          <ArbitrationSummaryCards arbitrationSummary={arbitrationSummary} arbitrationWorkload={arbitrationWorkload} />
        ) : null}

        {arbitrationWorkload ? (
          <ArbitrationWorkloadCard arbitrationWorkload={arbitrationWorkload} filters={filters} />
        ) : null}

        {cleanupQueue ? <ArbitrationCleanupQueueCard cleanupQueue={cleanupQueue} filters={filters} /> : null}

        <ArbitrationCaseFiltersCard filters={filters} routePath={routePath} showOperatorMetadata={showOperatorMetadata} />

        <ArbitrationCaseListSection
          arbitrationApiReady={arbitrationApiReady}
          arbitrationWorkload={arbitrationWorkload}
          casesDependency={casesDependency}
          casesUnavailable={casesUnavailable}
          currentUserId={session.user.id}
          filteredCases={filteredCases}
          filters={filters}
          isOperator={isOperator}
          routePath={routePath}
          showOperatorMetadata={showOperatorMetadata}
        />
      </div>
    </main>
  );
}

export default async function ArbitrationsPage(props: ArbitrationsPageProps) {
  return renderArbitrationsWorkspace(props);
}
