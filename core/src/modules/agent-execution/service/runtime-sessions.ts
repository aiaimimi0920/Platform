import type {
  AgentExecutionRuntimeSessionState,
  AgentExecutionRuntimeSessionView,
  AgentExecutionRuntimeSessionSummaryView,
  AgentExecutionRuntimeSessionSweepResult,
  AgentExecutionStatus,
  PlatformExecutionPhase,
} from "@neuro/contracts";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { buildRuntimeSessionRecommendations } from "@/modules/agent-execution/operator-runtime-session-analysis";
import {
  agentExecutionRuntimeSessions,
  agentExecutions,
} from "@/modules/agent-execution/schema";

import { buildSummaryBuckets } from "./callback-audit";
import {
  getExecutionPhaseAgeSeconds,
  getExecutionPhaseTimeoutSeconds,
  getMinimumExecutionPhaseTimeoutSeconds,
} from "./pricing";
import {
  now,
  toWhereClause,
} from "./shared";
import { toAgentExecutionRuntimeSessionView } from "./views";

export async function getOpenRuntimeSessionInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  kind?: AgentExecutionRuntimeSessionView["kind"],
) {
  const conditions: SQL[] = [
    eq(agentExecutionRuntimeSessions.executionId, executionId),
    sql`${agentExecutionRuntimeSessions.endedAt} is null`,
  ];
  if (kind) {
    conditions.push(eq(agentExecutionRuntimeSessions.kind, kind));
  }

  const [session] = await tx
    .select()
    .from(agentExecutionRuntimeSessions)
    .where(and(...conditions))
    .orderBy(desc(agentExecutionRuntimeSessions.startedAt))
    .limit(1);

  return session ?? null;
}

export async function createRuntimeSessionInTx(
  tx: NodePgDatabase<typeof schema>,
  input: {
    execution: typeof agentExecutions.$inferSelect;
    runId?: string | null;
    kind: AgentExecutionRuntimeSessionView["kind"];
    trigger: AgentExecutionRuntimeSessionView["trigger"];
    state?: AgentExecutionRuntimeSessionState;
    startedPhase?: PlatformExecutionPhase | null;
    note?: string | null;
  },
) {
  const [session] = await tx
    .insert(agentExecutionRuntimeSessions)
    .values({
      id: crypto.randomUUID(),
      executionId: input.execution.id,
      runId: input.runId ?? null,
      agentId: input.execution.agentId,
      ownerUserId: input.execution.ownerUserId,
      kind: input.kind,
      state: input.state ?? "running",
      trigger: input.trigger,
      startedPhase: input.startedPhase ?? ((input.execution.executorPhase as PlatformExecutionPhase | null) ?? null),
      endedPhase: null,
      note: input.note ?? null,
      startedAt: now(),
      endedAt: null,
      updatedAt: now(),
    })
    .returning();

  return session;
}

export async function touchRuntimeSessionInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  input: {
    kind?: AgentExecutionRuntimeSessionView["kind"];
    phase?: PlatformExecutionPhase | null;
    note?: string | null;
  },
) {
  const session = await getOpenRuntimeSessionInTx(tx, executionId, input.kind);
  if (!session) {
    return null;
  }

  const [updated] = await tx
    .update(agentExecutionRuntimeSessions)
    .set({
      endedPhase: input.phase ?? session.endedPhase,
      note: input.note ?? session.note,
      updatedAt: now(),
    })
    .where(eq(agentExecutionRuntimeSessions.id, session.id))
    .returning();

  return updated ?? session;
}

export async function finalizeRuntimeSessionInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  input: {
    kind?: AgentExecutionRuntimeSessionView["kind"];
    state: AgentExecutionRuntimeSessionState;
    endedPhase?: PlatformExecutionPhase | null;
    note?: string | null;
  },
) {
  const session = await getOpenRuntimeSessionInTx(tx, executionId, input.kind);
  if (!session) {
    return null;
  }

  const timestamp = now();
  const [updated] = await tx
    .update(agentExecutionRuntimeSessions)
    .set({
      state: input.state,
      endedPhase: input.endedPhase ?? ((session.endedPhase as PlatformExecutionPhase | null) ?? null),
      note: input.note ?? session.note,
      endedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionRuntimeSessions.id, session.id))
    .returning();

  return updated ?? session;
}

export function getRuntimeSessionTerminalStateForExecutionStatus(
  status: AgentExecutionStatus,
): AgentExecutionRuntimeSessionState | null {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
    case "cancelled":
      return "failed";
    case "queued":
      return "requeued";
    default:
      return null;
  }
}

export function buildRuntimeSessionConditions(args?: {
  agentId?: string;
  ownerUserId?: string;
  state?: AgentExecutionRuntimeSessionState;
  kind?: AgentExecutionRuntimeSessionView["kind"];
  staleOnly?: boolean;
}) {
  const clauses: SQL[] = [];

  if (args?.agentId) {
    clauses.push(eq(agentExecutionRuntimeSessions.agentId, args.agentId));
  }
  if (args?.ownerUserId) {
    clauses.push(eq(agentExecutionRuntimeSessions.ownerUserId, args.ownerUserId));
  }
  if (args?.state) {
    clauses.push(eq(agentExecutionRuntimeSessions.state, args.state));
  }
  if (args?.kind) {
    clauses.push(eq(agentExecutionRuntimeSessions.kind, args.kind));
  }
  if (args?.staleOnly) {
    clauses.push(sql`
      ${agentExecutionRuntimeSessions.endedAt} is null
      and (
        ${agentExecutionRuntimeSessions.updatedAt} <= now() - (${env.agentExecutionStaleSeconds} * interval '1 second')
        or ${agentExecutions.status} in ('queued', 'completed', 'failed', 'cancelled')
      )
    `);
  }

  return clauses;
}

export async function getRuntimeSessionSummaryForOperator(args?: {
  agentId?: string;
  ownerUserId?: string;
  state?: AgentExecutionRuntimeSessionState;
  kind?: AgentExecutionRuntimeSessionView["kind"];
  staleOnly?: boolean;
}): Promise<AgentExecutionRuntimeSessionSummaryView> {
  const whereClause = toWhereClause(buildRuntimeSessionConditions(args));

  let latestQuery = db
    .select({
      totalCount: sql<number>`count(*)::int`,
      openCount: sql<number>`count(*) filter (where ${agentExecutionRuntimeSessions.endedAt} is null)::int`,
      oldestOpenStartedAt: sql<Date | null>`min(case when ${agentExecutionRuntimeSessions.endedAt} is null then ${agentExecutionRuntimeSessions.startedAt} end)`,
      oldestStaleStartedAt: sql<Date | null>`min(case when ${agentExecutionRuntimeSessions.endedAt} is null and ${agentExecutionRuntimeSessions.updatedAt} <= now() - (${env.agentExecutionStaleSeconds} * interval '1 second') then ${agentExecutionRuntimeSessions.startedAt} end)`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    latestQuery = latestQuery.where(whereClause);
  }
  const [latestRow] = await latestQuery;

  let staleQuery = db
    .select({
      staleCount: sql<number>`count(*) filter (
        where ${agentExecutionRuntimeSessions.endedAt} is null
          and ${agentExecutionRuntimeSessions.updatedAt} <= now() - (${env.agentExecutionStaleSeconds} * interval '1 second')
      )::int`,
      terminalOpenCount: sql<number>`count(*) filter (
        where ${agentExecutionRuntimeSessions.endedAt} is null
          and ${agentExecutions.status} in ('queued', 'completed', 'failed', 'cancelled')
      )::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    staleQuery = staleQuery.where(whereClause);
  }
  const [staleRow] = await staleQuery;

  let kindQuery = db
    .select({
      key: agentExecutionRuntimeSessions.kind,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    kindQuery = kindQuery.where(whereClause);
  }
  const kindRows = await kindQuery.groupBy(agentExecutionRuntimeSessions.kind);

  let stateQuery = db
    .select({
      key: agentExecutionRuntimeSessions.state,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    stateQuery = stateQuery.where(whereClause);
  }
  const stateRows = await stateQuery.groupBy(agentExecutionRuntimeSessions.state);

  let openKindQuery = db
    .select({
      key: agentExecutionRuntimeSessions.kind,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    openKindQuery = openKindQuery.where(and(whereClause, sql`${agentExecutionRuntimeSessions.endedAt} is null`));
  } else {
    openKindQuery = openKindQuery.where(sql`${agentExecutionRuntimeSessions.endedAt} is null`);
  }
  const openKindRows = await openKindQuery.groupBy(agentExecutionRuntimeSessions.kind);

  let openStateQuery = db
    .select({
      key: agentExecutionRuntimeSessions.state,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .$dynamic();
  if (whereClause) {
    openStateQuery = openStateQuery.where(and(whereClause, sql`${agentExecutionRuntimeSessions.endedAt} is null`));
  } else {
    openStateQuery = openStateQuery.where(sql`${agentExecutionRuntimeSessions.endedAt} is null`);
  }
  const openStateRows = await openStateQuery.groupBy(agentExecutionRuntimeSessions.state);

  const staleOpenCount = Number(staleRow?.staleCount ?? 0);
  const terminalExecutionOpenCount = Number(staleRow?.terminalOpenCount ?? 0);
  const openByKind = buildSummaryBuckets(openKindRows as Array<{ key: string; count: number }>);
  const openByState = buildSummaryBuckets(openStateRows as Array<{ key: string; count: number }>);
  const oldestStaleStartedAt = latestRow?.oldestStaleStartedAt ? latestRow.oldestStaleStartedAt.toISOString() : null;
  const openCount = Number(latestRow?.openCount ?? 0);

  return {
    totalCount: Number(latestRow?.totalCount ?? 0),
    openCount,
    staleOpenCount,
    terminalExecutionOpenCount,
    oldestOpenStartedAt: latestRow?.oldestOpenStartedAt ? latestRow.oldestOpenStartedAt.toISOString() : null,
    oldestStaleStartedAt,
    byKind: buildSummaryBuckets(kindRows as Array<{ key: string; count: number }>),
    byState: buildSummaryBuckets(stateRows as Array<{ key: string; count: number }>),
    openByKind,
    openByState,
    recommendations: buildRuntimeSessionRecommendations({
      openCount,
      staleOpenCount,
      terminalExecutionOpenCount,
      oldestStaleStartedAt,
      openByKind,
      openByState,
    }),
  };
}

export async function listRuntimeSessionsForOperator(args?: {
  agentId?: string;
  ownerUserId?: string;
  state?: AgentExecutionRuntimeSessionState;
  kind?: AgentExecutionRuntimeSessionView["kind"];
  staleOnly?: boolean;
  limit?: number;
}): Promise<AgentExecutionRuntimeSessionView[]> {
  const limit = Math.max(1, Math.min(args?.limit ?? 100, 200));
  const clauses = buildRuntimeSessionConditions(args);

  const rows = await db
    .select({
      session: agentExecutionRuntimeSessions,
      execution: agentExecutions,
    })
    .from(agentExecutionRuntimeSessions)
    .innerJoin(agentExecutions, eq(agentExecutionRuntimeSessions.executionId, agentExecutions.id))
    .where(toWhereClause(clauses))
    .orderBy(desc(agentExecutionRuntimeSessions.startedAt))
    .limit(limit);

  return rows.map(({ session, execution }) => toAgentExecutionRuntimeSessionView(session, execution));
}

export async function sweepRuntimeSessions(args?: {
  limit?: number;
  staleSeconds?: number;
  agentId?: string;
  ownerUserId?: string;
  state?: AgentExecutionRuntimeSessionState;
  kind?: AgentExecutionRuntimeSessionView["kind"];
  staleOnly?: boolean;
}): Promise<AgentExecutionRuntimeSessionSweepResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 25, 100));
  const staleSeconds = getMinimumExecutionPhaseTimeoutSeconds(args?.staleSeconds ?? null);
  const sweepWhereClause = toWhereClause([
    ...buildRuntimeSessionConditions({
      agentId: args?.agentId,
      ownerUserId: args?.ownerUserId,
      state: args?.state,
      kind: args?.kind,
      staleOnly: args?.staleOnly,
    }),
    sql`${agentExecutionRuntimeSessions.endedAt} is null`,
    sql`(
      ${agentExecutions.status} in ('queued', 'completed', 'failed', 'cancelled')
      or ${agentExecutionRuntimeSessions.updatedAt} <= now() - (${staleSeconds} * interval '1 second')
    )`,
  ]);

  return db.transaction(async (tx) => {
    const rows = await tx.execute<{
      session_id: string;
      execution_id: string;
      execution_status: AgentExecutionStatus;
      executor_phase: string | null;
      updated_at: Date;
      ended_at: Date | null;
    }>(sql`
      select
        ${agentExecutionRuntimeSessions.id} as session_id,
        ${agentExecutionRuntimeSessions.executionId} as execution_id,
        ${agentExecutions.status} as execution_status,
        ${agentExecutions.executorPhase} as executor_phase,
        ${agentExecutionRuntimeSessions.updatedAt} as updated_at,
        ${agentExecutionRuntimeSessions.endedAt} as ended_at
      from ${agentExecutionRuntimeSessions}
      inner join ${agentExecutions} on ${agentExecutions.id} = ${agentExecutionRuntimeSessions.executionId}
      where ${sweepWhereClause ?? sql`true`}
      order by ${agentExecutionRuntimeSessions.updatedAt} asc
      limit ${limit}
      for update skip locked
    `);

    const closedSessionIds: string[] = [];
    let skippedCount = 0;

    for (const row of rows.rows) {
      const nextState = getRuntimeSessionTerminalStateForExecutionStatus(row.execution_status);
      if (!nextState) {
        const phaseAgeSeconds = getExecutionPhaseAgeSeconds({
          updatedAt: row.updated_at,
          status: row.execution_status,
          phase: (row.executor_phase as PlatformExecutionPhase | null) ?? null,
        });
        const phaseTimeoutSeconds = getExecutionPhaseTimeoutSeconds(
          (row.executor_phase as PlatformExecutionPhase | null) ?? null,
          args?.staleSeconds ?? null,
        );
        if (phaseAgeSeconds === null || phaseAgeSeconds < phaseTimeoutSeconds) {
          skippedCount += 1;
          continue;
        }
        skippedCount += 1;
        continue;
      }

      const [session] = await tx
        .select()
        .from(agentExecutionRuntimeSessions)
        .where(eq(agentExecutionRuntimeSessions.id, row.session_id))
        .limit(1);

      if (!session || session.endedAt) {
        skippedCount += 1;
        continue;
      }

      await tx
        .update(agentExecutionRuntimeSessions)
        .set({
          state: nextState,
          endedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? session.endedPhase,
          note:
            session.note ??
            (nextState === "requeued"
              ? "Runtime session sweep closed a queued execution session."
              : "Runtime session sweep closed a terminal execution session."),
          endedAt: now(),
          updatedAt: now(),
        })
        .where(eq(agentExecutionRuntimeSessions.id, session.id));

      closedSessionIds.push(session.id);
    }

    return {
      closedCount: closedSessionIds.length,
      skippedCount,
      staleSeconds,
      latestSweepAt: now().toISOString(),
      closedSessionIds,
    };
  });
}
