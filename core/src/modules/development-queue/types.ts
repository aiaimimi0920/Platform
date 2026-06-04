import type {
  DevelopmentQueueItemView,
  DevelopmentQueueSourceType,
  DevelopmentQueueStatus,
  OpinionDifficultyLevel,
} from "@neuro/contracts";

import { developmentQueueItems } from "@/modules/development-queue/schema";

export type DevelopmentQueueSourceSnapshot = {
  sourceType: DevelopmentQueueSourceType;
  sourceId: string;
  ownerUserId: string;
  title: string;
  description: string;
  difficultyLevel: OpinionDifficultyLevel | null;
  supportTicketTotal: number;
  opposeTicketTotal: number;
  supportRate: number;
  priorityScore: number;
  queuedAt?: Date;
};

export const developmentQueueStatusOrder: Record<DevelopmentQueueStatus, number> = {
  in_progress: 0,
  planned: 1,
  queued: 2,
  completed: 3,
  archived: 4,
};

const allowedTransitions: Record<DevelopmentQueueStatus, DevelopmentQueueStatus[]> = {
  queued: ["planned", "in_progress", "archived"],
  planned: ["in_progress", "archived"],
  in_progress: ["completed", "archived"],
  completed: ["archived"],
  archived: [],
};

export function canTransitionDevelopmentQueueStatus(
  current: DevelopmentQueueStatus,
  next: DevelopmentQueueStatus,
): boolean {
  return allowedTransitions[current]?.includes(next) ?? false;
}

function numericToNumber(raw: string | number) {
  return typeof raw === "string" ? Number(raw) : raw;
}

export function toDevelopmentQueueItemView(
  item: typeof developmentQueueItems.$inferSelect,
  canUpdateStatus: boolean,
): DevelopmentQueueItemView {
  return {
    id: item.id,
    sourceType: item.sourceType as DevelopmentQueueSourceType,
    sourceId: item.sourceId,
    ownerUserId: item.ownerUserId,
    title: item.title,
    description: item.description,
    difficultyLevel: (item.difficultyLevel as OpinionDifficultyLevel | null) ?? null,
    supportTicketTotal: item.supportTicketTotal,
    opposeTicketTotal: item.opposeTicketTotal,
    supportRate: Number(numericToNumber(item.supportRate).toFixed(4)),
    priorityScore: item.priorityScore,
    status: item.status as DevelopmentQueueStatus,
    queuedAt: item.queuedAt.toISOString(),
    startedAt: item.startedAt ? item.startedAt.toISOString() : null,
    deliveredAt: item.deliveredAt ? item.deliveredAt.toISOString() : null,
    archivedAt: item.archivedAt ? item.archivedAt.toISOString() : null,
    updatedAt: item.updatedAt.toISOString(),
    canUpdateStatus: canUpdateStatus && item.status !== "archived",
  };
}
