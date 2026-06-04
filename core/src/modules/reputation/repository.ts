import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { arbitrationCases } from "@/modules/arbitration/schema";
import { tasks } from "@/modules/task-hub/schema";
import { users } from "@/modules/identity/schema";
import { reputationHistory } from "@/modules/reputation/schema";

type ReputationTaskStats = {
  completedTaskCount: number;
  defaultedTaskCount: number;
  cancelledTaskCount: number;
  activeTaskCount: number;
  favorableArbitrationCount: number;
  unfavorableArbitrationCount: number;
  trustLevel: number | null;
};

async function countTasks(
  tx: NodePgDatabase<typeof schema>,
  whereClause: ReturnType<typeof and> | ReturnType<typeof or>,
) {
  const [row] = await tx.select({ count: count(tasks.id) }).from(tasks).where(whereClause);
  return Number(row?.count ?? 0);
}

export async function getReputationTaskStats(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
): Promise<ReputationTaskStats> {
  const [user] = await tx.select({ trustLevel: users.trustLevel }).from(users).where(eq(users.id, userId));

  const completedTaskCount = await countTasks(
    tx,
    and(eq(tasks.assignedUserId, userId), eq(tasks.status, "accepted")),
  );
  const defaultedTaskCount = await countTasks(
    tx,
    and(eq(tasks.assignedUserId, userId), eq(tasks.status, "defaulted")),
  );
  const cancelledTaskCount = await countTasks(
    tx,
    and(eq(tasks.creatorUserId, userId), eq(tasks.status, "cancelled")),
  );
  const activeTaskCount = await countTasks(
    tx,
    and(
      or(eq(tasks.creatorUserId, userId), eq(tasks.assignedUserId, userId)),
      inArray(tasks.status, ["open", "applying", "assigned", "in_progress", "submitted"]),
    ),
  );

  const [favorableArbitrations] = await tx
    .select({ count: count(arbitrationCases.id) })
    .from(arbitrationCases)
    .innerJoin(tasks, eq(arbitrationCases.entityId, tasks.id))
    .where(
      and(
        eq(arbitrationCases.entityType, "task"),
        eq(arbitrationCases.status, "resolved"),
        or(
          and(eq(arbitrationCases.taskResolutionAction, "accept"), eq(tasks.assignedUserId, userId)),
          and(eq(arbitrationCases.taskResolutionAction, "default"), eq(tasks.creatorUserId, userId)),
        ),
      ),
    );

  const [unfavorableArbitrations] = await tx
    .select({ count: count(arbitrationCases.id) })
    .from(arbitrationCases)
    .innerJoin(tasks, eq(arbitrationCases.entityId, tasks.id))
    .where(
      and(
        eq(arbitrationCases.entityType, "task"),
        eq(arbitrationCases.status, "resolved"),
        or(
          and(eq(arbitrationCases.taskResolutionAction, "accept"), eq(tasks.creatorUserId, userId)),
          and(eq(arbitrationCases.taskResolutionAction, "default"), eq(tasks.assignedUserId, userId)),
        ),
      ),
    );

  return {
    completedTaskCount,
    defaultedTaskCount,
    cancelledTaskCount,
    activeTaskCount,
    favorableArbitrationCount: Number(favorableArbitrations?.count ?? 0),
    unfavorableArbitrationCount: Number(unfavorableArbitrations?.count ?? 0),
    trustLevel: user?.trustLevel ?? null,
  };
}

export async function listReputationHistoryByUser(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  limit: number,
) {
  return tx
    .select()
    .from(reputationHistory)
    .where(eq(reputationHistory.userId, userId))
    .orderBy(desc(reputationHistory.recordedAt))
    .limit(limit);
}
