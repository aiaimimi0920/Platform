import type {
  AgentExecutionObjectiveChecklistEntry,
  AgentExecutionSubtaskStatus,
  PlatformExecutionPhase,
} from "@neuro/contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  agentExecutionSubtasks,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { agents } from "@/modules/agent-registry/schema";

import {
  normalizeObjectiveChecklist,
  resolveRuntimeProfile,
} from "./pricing";
import { now } from "./shared";

export function buildRuntimeArtifactDescriptor(args: {
  execution: typeof agentExecutions.$inferSelect;
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
  producedArtifactCount: number;
}) {
  const checklist = normalizeObjectiveChecklist(args.execution.objectiveChecklist, args.execution.objective);
  if (args.runtimeProfile.artifactMode === "checklist_progressive" && checklist.length > 0) {
    const targetArtifactCount = Math.max(1, args.execution.targetArtifactCount);
    const primaryArtifactSlotCount = Math.max(1, Math.min(targetArtifactCount, checklist.length));
    const chunkSize = Math.max(1, Math.ceil(checklist.length / primaryArtifactSlotCount));
    const artifactIndex = Math.max(0, args.producedArtifactCount - 1);
    if (artifactIndex < primaryArtifactSlotCount) {
      const startIndex = artifactIndex * chunkSize;
      const entries = checklist.slice(startIndex, startIndex + chunkSize);
      const firstEntry = entries[0] ?? checklist[Math.min(artifactIndex, checklist.length - 1)];
      const entryLabel =
        entries.length === 1
          ? `checklist entry ${firstEntry.order}`
          : `checklist entries ${entries[0]?.order ?? firstEntry.order}-${entries[entries.length - 1]?.order ?? firstEntry.order}`;
      const summary =
        entries.length === 1
          ? `Runtime processed ${entryLabel}: ${firstEntry.text}`
          : `Runtime processed ${entryLabel}: ${firstEntry.text} + ${entries.length - 1} more item(s)`;
      return {
        title: entries.length === 1 ? `Checklist artifact ${args.producedArtifactCount}` : `Checklist batch ${args.producedArtifactCount}`,
        summary,
        payload: {
          checklistEntries: entries,
          artifactMode: args.runtimeProfile.artifactMode,
          runtimePlanVersion: args.runtimeProfile.runtimePlanVersion,
          artifactSlot: args.producedArtifactCount,
          artifactSlots: targetArtifactCount,
        },
      };
    }

    const synthesisEntries = checklist.slice(Math.max(0, checklist.length - Math.min(3, checklist.length)));
    return {
      title: `Runtime synthesis ${args.producedArtifactCount}`,
      summary: `Runtime synthesized ${synthesisEntries.length} checklist entr${synthesisEntries.length === 1 ? "y" : "ies"} into an aggregated artifact.`,
      payload: {
        checklistEntries: synthesisEntries,
        artifactMode: args.runtimeProfile.artifactMode,
        runtimePlanVersion: args.runtimeProfile.runtimePlanVersion,
        artifactSlot: args.producedArtifactCount,
        artifactSlots: targetArtifactCount,
        synthesized: true,
      },
    };
  }

  return {
    title: `Platform executor result ${args.producedArtifactCount}`,
    summary: `Platform executor generated artifact ${args.producedArtifactCount} for ${args.execution.title}.`,
    payload: {
      artifactMode: args.runtimeProfile.artifactMode,
      runtimePlanVersion: args.runtimeProfile.runtimePlanVersion,
      executionTitle: args.execution.title,
    },
  };
}

export function getRuntimePhaseChecklistContext(args: {
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  phase: Extract<PlatformExecutionPhase, "prepare" | "finalize">;
  passNumber: number;
}) {
  const phaseEntries = args.objectiveChecklist.filter((entry) => entry.runtimePhase === args.phase);
  if (phaseEntries.length === 0) {
    return null;
  }
  const entry = phaseEntries[Math.min(Math.max(0, args.passNumber - 1), phaseEntries.length - 1)];
  return {
    entry,
    phaseEntries,
  };
}

export async function ensureRuntimeManagedSubtasksInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
) {
  const existing = await tx
    .select()
    .from(agentExecutionSubtasks)
    .where(and(eq(agentExecutionSubtasks.executionId, execution.id), eq(agentExecutionSubtasks.managedByRuntime, true)))
    .orderBy(asc(agentExecutionSubtasks.sortOrder));

  if (existing.length > 0) {
    return existing;
  }

  const checklist = normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective);
  if (checklist.length === 0) {
    return existing;
  }

  const [sortRow] = await tx
    .select({
      maxSortOrder: sql<number>`coalesce(max(${agentExecutionSubtasks.sortOrder}), -1)::int`,
    })
    .from(agentExecutionSubtasks)
    .where(eq(agentExecutionSubtasks.executionId, execution.id));

  const timestamp = now();
  await tx.insert(agentExecutionSubtasks).values(
    checklist.map((item, index) => ({
      id: crypto.randomUUID(),
      executionId: execution.id,
      parentSubtaskId: null,
      title: item.text,
      detail: `Runtime-managed objective ${item.order}`,
      status: "pending",
      managedByRuntime: true,
      runtimePhase: item.runtimePhase,
      sortOrder: Number(sortRow?.maxSortOrder ?? -1) + index + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    })),
  );

  return tx
    .select()
    .from(agentExecutionSubtasks)
    .where(and(eq(agentExecutionSubtasks.executionId, execution.id), eq(agentExecutionSubtasks.managedByRuntime, true)))
    .orderBy(asc(agentExecutionSubtasks.sortOrder));
}

export async function syncRuntimeManagedSubtasksInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
  signal: "claim" | "advance" | "complete" | "failed" | "cancelled" | "requeue",
) {
  const sourceAgent = await tx
    .select({ sourceType: agents.sourceType })
    .from(agents)
    .where(eq(agents.id, execution.agentId))
    .limit(1);

  if (sourceAgent[0]?.sourceType !== "platform") {
    return;
  }

  const subtasks = await ensureRuntimeManagedSubtasksInTx(tx, execution);
  if (subtasks.length === 0) {
    return;
  }

  const running = subtasks.find((item) => item.status === "running") ?? null;
  const firstPending = subtasks.find((item) => item.status === "pending") ?? null;
  const timestamp = now();

  if (signal === "claim") {
    if (!running && firstPending) {
      await tx
        .update(agentExecutionSubtasks)
        .set({
          status: "running",
          updatedAt: timestamp,
          detail: firstPending.detail ?? "Runtime claimed this checklist item.",
        })
        .where(eq(agentExecutionSubtasks.id, firstPending.id));
    }
    return;
  }

  if (signal === "requeue") {
    await tx
      .update(agentExecutionSubtasks)
      .set({
        status: "pending",
        updatedAt: timestamp,
        completedAt: null,
      })
      .where(
        and(
          eq(agentExecutionSubtasks.executionId, execution.id),
          eq(agentExecutionSubtasks.managedByRuntime, true),
          inArray(agentExecutionSubtasks.status, ["running", "failed", "cancelled"] as AgentExecutionSubtaskStatus[]),
        ),
      );
    return;
  }

  if (signal === "advance") {
    if (running) {
      await tx
        .update(agentExecutionSubtasks)
        .set({
          status: "completed",
          updatedAt: timestamp,
          completedAt: running.completedAt ?? timestamp,
        })
        .where(eq(agentExecutionSubtasks.id, running.id));
    } else if (firstPending) {
      await tx
        .update(agentExecutionSubtasks)
        .set({
          status: "completed",
          updatedAt: timestamp,
          completedAt: timestamp,
        })
        .where(eq(agentExecutionSubtasks.id, firstPending.id));
    }

    const refresh = await tx
      .select()
      .from(agentExecutionSubtasks)
      .where(and(eq(agentExecutionSubtasks.executionId, execution.id), eq(agentExecutionSubtasks.managedByRuntime, true)))
      .orderBy(asc(agentExecutionSubtasks.sortOrder));
    const nextPending = refresh.find((item) => item.status === "pending") ?? null;
    if (nextPending) {
      await tx
        .update(agentExecutionSubtasks)
        .set({
          status: "running",
          updatedAt: timestamp,
        })
        .where(eq(agentExecutionSubtasks.id, nextPending.id));
    }
    return;
  }

  if (signal === "complete") {
    await tx
      .update(agentExecutionSubtasks)
      .set({
        status: "completed",
        updatedAt: timestamp,
        completedAt: timestamp,
      })
      .where(
        and(
          eq(agentExecutionSubtasks.executionId, execution.id),
          eq(agentExecutionSubtasks.managedByRuntime, true),
          inArray(agentExecutionSubtasks.status, ["pending", "running"] as AgentExecutionSubtaskStatus[]),
        ),
      );
    return;
  }

  const terminalStatus: AgentExecutionSubtaskStatus = signal === "failed" ? "failed" : "cancelled";
  await tx
    .update(agentExecutionSubtasks)
    .set({
      status: terminalStatus,
      updatedAt: timestamp,
      completedAt: timestamp,
    })
    .where(
      and(
        eq(agentExecutionSubtasks.executionId, execution.id),
        eq(agentExecutionSubtasks.managedByRuntime, true),
        inArray(agentExecutionSubtasks.status, ["pending", "running"] as AgentExecutionSubtaskStatus[]),
      ),
    );
}
