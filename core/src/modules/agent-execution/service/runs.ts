import type {
  AgentExecutionRunFailureCategory,
  AgentExecutionOperatorRunSummaryView,
  AgentExecutionOperatorRunView,
  AgentExecutionStepKind,
  AgentExecutionStepStatus,
  AgentExecutionRunView,
  PlatformExecutionPhase,
} from "@neuro/contracts";
import { and, desc, eq, inArray, max, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  buildExecutionRunRecommendations,
  classifyExecutionRunFailure,
  getRecentWindowInterval,
  toExecutionPhaseBucket,
} from "@/modules/agent-execution/operator-run-analysis";
import {
  agentExecutionRuns,
  agentExecutionSteps,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { agents } from "@/modules/agent-registry/schema";
import { NotFoundError } from "@/platform/errors";

import { buildSummaryBuckets } from "./callback-audit";
import {
  estimateExecutionRunCostUnits,
  estimateExecutionStepCostUnits,
  estimateRunResourceMinutes,
  estimateSettlementAmount,
} from "./pricing";
import {
  ExecutionRunOperatorQuery,
  now,
  toWhereClause,
} from "./shared";
import { toAgentExecutionOperatorRunView } from "./views";

export async function recordExecutionStepInTx(
  tx: NodePgDatabase<typeof schema>,
  input: {
    executionId: string;
    kind: AgentExecutionStepKind;
    phase?: PlatformExecutionPhase | null;
    title: string;
    detail?: string | null;
    status: AgentExecutionStepStatus;
    progressPercent?: number | null;
  },
) {
  await tx.insert(agentExecutionSteps).values({
    id: crypto.randomUUID(),
    executionId: input.executionId,
    kind: input.kind,
    phase: input.phase ?? null,
    title: input.title,
    detail: input.detail ?? null,
    status: input.status,
    progressPercent: input.progressPercent ?? null,
    costUnits: estimateExecutionStepCostUnits({
      kind: input.kind,
      phase: input.phase ?? null,
      status: input.status,
      progressPercent: input.progressPercent ?? null,
    }),
    createdAt: now(),
  });
}

export async function countCompletedPhaseStepsInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  phase: PlatformExecutionPhase,
) {
  const [row] = await tx
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionSteps)
    .where(
      and(
        eq(agentExecutionSteps.executionId, executionId),
        eq(agentExecutionSteps.kind, "phase"),
        eq(agentExecutionSteps.phase, phase),
        eq(agentExecutionSteps.status, "completed"),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function createExecutionRunInTx(
  tx: NodePgDatabase<typeof schema>,
  input: {
    executionId: string;
    agentId: string;
    ownerUserId: string;
    runKind: AgentExecutionRunView["runKind"];
    summary?: string | null;
  },
) {
  const [run] = await tx
    .insert(agentExecutionRuns)
    .values({
      id: crypto.randomUUID(),
      executionId: input.executionId,
      agentId: input.agentId,
      ownerUserId: input.ownerUserId,
      runKind: input.runKind,
      status: "running",
      summary: input.summary ?? null,
      errorMessage: null,
      artifactCount: 0,
      costUnits: 0,
      resourceMinutes: 0,
      estimatedAmount: 0,
      createdAt: now(),
      finishedAt: null,
    })
    .returning();

  return run;
}

export async function finishExecutionRun(
  runId: string,
  input: {
    status: AgentExecutionRunView["status"];
    summary?: string | null;
    errorMessage?: string | null;
    artifactCount?: number;
    executionPhase?: PlatformExecutionPhase | null;
    costUnits?: number;
  },
) {
  const [existingRun] = await db.select().from(agentExecutionRuns).where(eq(agentExecutionRuns.id, runId)).limit(1);
  if (!existingRun) {
    throw new NotFoundError("Execution run not found");
  }
  const costUnits =
    input.costUnits ??
    estimateExecutionRunCostUnits({
      runKind: existingRun.runKind as AgentExecutionRunView["runKind"],
      status: input.status,
      artifactCount: input.artifactCount ?? 0,
      executionPhase: input.executionPhase ?? null,
    });
  const finishedAt = now();
  const resourceMinutes = estimateRunResourceMinutes({
    createdAt: existingRun.createdAt,
    finishedAt,
  });
  const estimatedAmount = estimateSettlementAmount(costUnits);
  const [run] = await db
    .update(agentExecutionRuns)
    .set({
      status: input.status,
      summary: input.summary ?? null,
      errorMessage: input.errorMessage ?? null,
      artifactCount: input.artifactCount ?? 0,
      costUnits,
      resourceMinutes,
      estimatedAmount,
      finishedAt,
    })
    .where(eq(agentExecutionRuns.id, runId))
    .returning();

  return run;
}

export async function finishExecutionRunInTx(
  tx: NodePgDatabase<typeof schema>,
  runId: string,
  input: {
    status: AgentExecutionRunView["status"];
    summary?: string | null;
    errorMessage?: string | null;
    artifactCount?: number;
    executionPhase?: PlatformExecutionPhase | null;
    costUnits?: number;
  },
) {
  const [existingRun] = await tx.select().from(agentExecutionRuns).where(eq(agentExecutionRuns.id, runId)).limit(1);
  if (!existingRun) {
    throw new NotFoundError("Execution run not found");
  }
  const costUnits =
    input.costUnits ??
    estimateExecutionRunCostUnits({
      runKind: existingRun.runKind as AgentExecutionRunView["runKind"],
      status: input.status,
      artifactCount: input.artifactCount ?? 0,
      executionPhase: input.executionPhase ?? null,
    });
  const finishedAt = now();
  const resourceMinutes = estimateRunResourceMinutes({
    createdAt: existingRun.createdAt,
    finishedAt,
  });
  const estimatedAmount = estimateSettlementAmount(costUnits);
  const [run] = await tx
    .update(agentExecutionRuns)
    .set({
      status: input.status,
      summary: input.summary ?? null,
      errorMessage: input.errorMessage ?? null,
      artifactCount: input.artifactCount ?? 0,
      costUnits,
      resourceMinutes,
      estimatedAmount,
      finishedAt,
    })
    .where(eq(agentExecutionRuns.id, runId))
    .returning();

  return run;
}

export function buildExecutionRunConditions(args?: ExecutionRunOperatorQuery) {
  const conditions: SQL[] = [];
  if (args?.agentId) conditions.push(eq(agentExecutionRuns.agentId, args.agentId));
  if (args?.ownerUserId) conditions.push(eq(agentExecutions.ownerUserId, args.ownerUserId));
  if (args?.executionIds?.length) conditions.push(inArray(agentExecutionRuns.executionId, args.executionIds));
  if (args?.runIds?.length) conditions.push(inArray(agentExecutionRuns.id, args.runIds));
  if (args?.runKind) conditions.push(eq(agentExecutionRuns.runKind, args.runKind));
  if (args?.runStatus) conditions.push(eq(agentExecutionRuns.status, args.runStatus));
  if (args?.executionStatus) conditions.push(eq(agentExecutions.status, args.executionStatus));
  if (args?.recentWindow) {
    const interval = getRecentWindowInterval(args.recentWindow);
    conditions.push(sql`${agentExecutionRuns.createdAt} >= now() - ${sql.raw(`interval '${interval}'`)}`);
  }
  const failureCategoryCondition = buildFailureCategoryCondition(args?.failureCategory);
  if (failureCategoryCondition) conditions.push(failureCategoryCondition);
  return conditions;
}

export function buildFailureHaystackExpression() {
  return sql`lower(coalesce(${agentExecutionRuns.summary}, '') || ' ' || coalesce(${agentExecutionRuns.errorMessage}, ''))`;
}

export function buildStaleTimeoutCondition() {
  const haystack = buildFailureHaystackExpression();
  return sql`(${haystack} like '%stale timeout%' or ${haystack} like '%stale platform execution%')`;
}

export function buildFailureCategoryCondition(
  failureCategory?: AgentExecutionRunFailureCategory,
): SQL | undefined {
  if (!failureCategory) {
    return undefined;
  }

  const staleCondition = buildStaleTimeoutCondition();
  if (failureCategory === "stale_timeout") {
    return and(eq(agentExecutionRuns.status, "failed"), staleCondition) ?? undefined;
  }
  if (failureCategory === "executor_failure") {
    return and(
      eq(agentExecutionRuns.status, "failed"),
      eq(agentExecutionRuns.runKind, "platform_executor"),
      sql`not (${staleCondition})`,
    ) ?? undefined;
  }
  if (failureCategory === "requeue_failure") {
    return and(
      eq(agentExecutionRuns.status, "failed"),
      eq(agentExecutionRuns.runKind, "requeue"),
      sql`not (${staleCondition})`,
    ) ?? undefined;
  }
  return and(
    eq(agentExecutionRuns.status, "failed"),
    sql`not (${staleCondition})`,
    sql`${agentExecutionRuns.runKind} not in ('platform_executor', 'requeue')`,
  ) ?? undefined;
}

export async function listExecutionRunsForOperator(
  args?: ExecutionRunOperatorQuery,
): Promise<AgentExecutionOperatorRunView[]> {
  const limit = Math.max(1, Math.min(args?.limit ?? 50, 200));
  const whereClause = toWhereClause(buildExecutionRunConditions(args));
  let query = db
    .select({
      run: agentExecutionRuns,
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .$dynamic();

  if (whereClause) query = query.where(whereClause);

  const rows = await query.orderBy(desc(agentExecutionRuns.createdAt)).limit(limit);
  return rows.map((row) => toAgentExecutionOperatorRunView(row));
}

export async function getExecutionRunSummaryForOperator(
  args?: ExecutionRunOperatorQuery,
): Promise<AgentExecutionOperatorRunSummaryView> {
  const whereClause = toWhereClause(buildExecutionRunConditions(args));

  const [latestRow] = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      failedCount: sql<number>`count(*) filter (where ${agentExecutionRuns.status} = 'failed')::int`,
      totalCostUnits: sql<number>`coalesce(sum(${agentExecutionRuns.costUnits}), 0)::int`,
      newestCreatedAt: max(agentExecutionRuns.createdAt),
      recent15mTotal: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '15 minutes')::int`,
      recent15mFailed: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '15 minutes' and ${agentExecutionRuns.status} = 'failed')::int`,
      recent1hTotal: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '1 hour')::int`,
      recent1hFailed: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '1 hour' and ${agentExecutionRuns.status} = 'failed')::int`,
      recent24hTotal: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '24 hours')::int`,
      recent24hFailed: sql<number>`count(*) filter (where ${agentExecutionRuns.createdAt} >= now() - interval '24 hours' and ${agentExecutionRuns.status} = 'failed')::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause);

  const runKindRows = await db
    .select({
      key: agentExecutionRuns.runKind,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(agentExecutionRuns.runKind);

  const runKindCostRows = await db
    .select({
      key: agentExecutionRuns.runKind,
      costUnits: sql<number>`coalesce(sum(${agentExecutionRuns.costUnits}), 0)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(agentExecutionRuns.runKind);

  const runStatusRows = await db
    .select({
      key: agentExecutionRuns.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(agentExecutionRuns.status);

  const executionStatusRows = await db
    .select({
      key: agentExecutions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(agentExecutions.status);

  const executionPhaseRows = await db
    .select({
      key: sql<string>`case when ${agentExecutions.executorPhase} is null then 'none' else ${agentExecutions.executorPhase} end`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(whereClause)
    .groupBy(sql`case when ${agentExecutions.executorPhase} is null then 'none' else ${agentExecutions.executorPhase} end`);

  const failureRows = await db
    .select({
      runKind: agentExecutionRuns.runKind,
      summary: agentExecutionRuns.summary,
      errorMessage: agentExecutionRuns.errorMessage,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuns)
    .innerJoin(agentExecutions, eq(agentExecutionRuns.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionRuns.agentId, agents.id))
    .where(toWhereClause([...buildExecutionRunConditions(args), eq(agentExecutionRuns.status, "failed")]))
    .groupBy(agentExecutionRuns.runKind, agentExecutionRuns.summary, agentExecutionRuns.errorMessage);

  const failureBuckets = new Map<string, number>();
  for (const row of failureRows) {
    const key =
      classifyExecutionRunFailure({
        runKind: row.runKind as AgentExecutionRunView["runKind"],
        status: "failed",
        summary: row.summary,
        errorMessage: row.errorMessage,
      }) ?? "unknown_failure";
    failureBuckets.set(key, (failureBuckets.get(key) ?? 0) + Number(row.count ?? 0));
  }

  return {
    totalCount: Number(latestRow?.totalCount ?? 0),
    failedCount: Number(latestRow?.failedCount ?? 0),
    totalCostUnits: Number(latestRow?.totalCostUnits ?? 0),
    newestCreatedAt: latestRow?.newestCreatedAt ? latestRow.newestCreatedAt.toISOString() : null,
    byRunKind: buildSummaryBuckets(runKindRows as Array<{ key: string; count: number }>),
    byRunKindCost: (runKindCostRows as Array<{ key: string; costUnits: number }>)
      .map((row) => ({ key: row.key, costUnits: Number(row.costUnits ?? 0) }))
      .sort((left, right) => right.costUnits - left.costUnits || left.key.localeCompare(right.key)),
    byRunStatus: buildSummaryBuckets(runStatusRows as Array<{ key: string; count: number }>),
    byExecutionStatus: buildSummaryBuckets(executionStatusRows as Array<{ key: string; count: number }>),
    byExecutionPhase: buildSummaryBuckets(
      (executionPhaseRows as Array<{ key: string; count: number }>).map((row) => ({
        key: toExecutionPhaseBucket(row.key as PlatformExecutionPhase | "none"),
        count: row.count,
      })),
    ),
    byFailureCategory: buildSummaryBuckets(
      Array.from(failureBuckets.entries()).map(([key, count]) => ({ key, count })),
    ),
    recentWindows: [
      {
        key: "15m",
        totalCount: Number(latestRow?.recent15mTotal ?? 0),
        failedCount: Number(latestRow?.recent15mFailed ?? 0),
      },
      {
        key: "1h",
        totalCount: Number(latestRow?.recent1hTotal ?? 0),
        failedCount: Number(latestRow?.recent1hFailed ?? 0),
      },
      {
        key: "24h",
        totalCount: Number(latestRow?.recent24hTotal ?? 0),
        failedCount: Number(latestRow?.recent24hFailed ?? 0),
      },
    ],
    recommendations: buildExecutionRunRecommendations({
      byExecutionStatus: buildSummaryBuckets(executionStatusRows as Array<{ key: string; count: number }>),
      byFailureCategory: buildSummaryBuckets(
        Array.from(failureBuckets.entries()).map(([key, count]) => ({ key, count })),
      ),
      recentWindows: [
        {
          key: "15m",
          totalCount: Number(latestRow?.recent15mTotal ?? 0),
          failedCount: Number(latestRow?.recent15mFailed ?? 0),
        },
        {
          key: "1h",
          totalCount: Number(latestRow?.recent1hTotal ?? 0),
          failedCount: Number(latestRow?.recent1hFailed ?? 0),
        },
        {
          key: "24h",
          totalCount: Number(latestRow?.recent24hTotal ?? 0),
          failedCount: Number(latestRow?.recent24hFailed ?? 0),
        },
      ],
    }),
  };
}
