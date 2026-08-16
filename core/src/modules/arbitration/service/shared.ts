// Shared arbitration service helpers: time source, operator/participant
// permission checks, status transition assertions, and evidence input
// normalization. Moved verbatim from the original service.ts.
import type {
  ArbitrationStatus,
  ArbitrationTaskResolutionAction,
  CreateArbitrationEvidenceInput,
  UpdateArbitrationCaseStatusInput,
} from "@neuro/contracts";

import {
  arbitrationCases,
  arbitrationCaseReviewRounds,
} from "@/modules/arbitration/schema";
import { env } from "@/env";
import { ConflictError } from "@/platform/errors";
import { getArbitrationClaimAgeHours as getClaimAgeHours } from "@/modules/arbitration/workload-analysis";

export function now() {
  return new Date();
}

export function isPlatformOperator(userId: string) {
  return env.platformOperatorUserIds.includes(userId);
}

export function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

export function isCaseParticipant(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "requesterUserId" | "respondentUserId">,
) {
  return row.requesterUserId === userId || row.respondentUserId === userId;
}

export function canViewCase(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "requesterUserId" | "respondentUserId">,
) {
  return isPlatformOperator(userId) || isCaseParticipant(userId, row);
}

export function canAddEvidence(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "status" | "requesterUserId" | "respondentUserId">,
) {
  return ["open", "under_review"].includes(row.status) && canViewCase(userId, row);
}

export function canClaimCase(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "status" | "assignedOperatorUserId">,
) {
  return isPlatformOperator(userId) && ["open", "under_review"].includes(row.status) && !row.assignedOperatorUserId;
}

export function canReleaseCase(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "status" | "assignedOperatorUserId">,
) {
  return isPlatformOperator(userId) && ["open", "under_review"].includes(row.status) && Boolean(row.assignedOperatorUserId);
}

export function isStaleClaim(claimedAt: Date | null, referenceTime: Date) {
  const claimAgeHours = getClaimAgeHours(claimedAt, referenceTime);
  return claimAgeHours !== null && claimAgeHours >= env.arbitrationStaleClaimHours;
}

export function getViewerReputationImpact(args: {
  actorUserId: string;
  task:
    | {
        creatorUserId: string;
        assignedUserId: string | null;
      }
    | null;
  taskResolutionAction: ArbitrationTaskResolutionAction | null;
  status: ArbitrationStatus;
  effectsAppliedAt: Date | null;
}): "favorable" | "unfavorable" | "neutral" {
  if (!args.task || args.status !== "resolved" || !args.effectsAppliedAt) {
    return "neutral";
  }

  if (args.taskResolutionAction === "accept") {
    if (args.task.assignedUserId === args.actorUserId) return "favorable";
    if (args.task.creatorUserId === args.actorUserId) return "unfavorable";
  }

  if (args.taskResolutionAction === "default") {
    if (args.task.creatorUserId === args.actorUserId) return "favorable";
    if (args.task.assignedUserId === args.actorUserId) return "unfavorable";
  }

  return "neutral";
}

export function assertStatusTransition(current: ArbitrationStatus, next: Exclude<ArbitrationStatus, "open">) {
  if (current === "open" && next === "under_review") return;
  if (current === "under_review" && ["resolved", "rejected"].includes(next)) return;
  throw new ConflictError(`Cannot move arbitration case from ${current} to ${next}`);
}

export function resolveTaskResolutionAction(
  input: UpdateArbitrationCaseStatusInput,
): ArbitrationTaskResolutionAction | null {
  if (input.status !== "resolved") return null;
  return input.taskResolutionAction ?? "none";
}

export function getOpenReviewRound(rows: Array<typeof arbitrationCaseReviewRounds.$inferSelect>) {
  return rows.find((row) => row.status === "open") ?? null;
}

export function assertHttpUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConflictError("Evidence URL must be a valid absolute URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ConflictError("Evidence URL must use http or https");
  }
}

export function normalizeEvidenceInput(input: CreateArbitrationEvidenceInput) {
  const title = input.title.trim();
  const content = input.content?.trim() || null;
  const url = input.url?.trim() || null;

  if (!title) {
    throw new ConflictError("Evidence title is required");
  }

  if (["external_link", "screenshot_ref"].includes(input.kind) && !url) {
    throw new ConflictError("This evidence kind requires a URL");
  }

  if (["text_note", "log_excerpt"].includes(input.kind) && !content) {
    throw new ConflictError("This evidence kind requires textual content");
  }

  if (!content && !url) {
    throw new ConflictError("Evidence requires content or URL");
  }

  if (url) {
    assertHttpUrl(url);
  }

  return {
    kind: input.kind,
    title,
    content,
    url,
  };
}
