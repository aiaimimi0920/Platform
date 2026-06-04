import { and, desc, eq, ne } from "drizzle-orm";

import {
  db,
  notificationWebhookIncidentDefaultViews,
  notificationWebhookIncidentSavedViews,
} from "@neuro/account-domain";
import type {
  CreateNotificationWebhookIncidentSavedViewInput,
  ListNotificationWebhookIncidentSavedViewsInput,
  NotificationWebhookIncidentGovernanceState,
  NotificationWebhookIncidentSavedView,
  NotificationWebhookIncidentSavedViewFilters,
  NotificationWebhookIncidentSavedViewPlaybookActionKind,
  NotificationWebhookIncidentSavedViewPlaybookDefaults,
  NotificationWebhookIncidentSavedViewFocusSection,
} from "@neuro/contracts";
import { notificationWebhookIncidentSavedViewFocusSections } from "@neuro/contracts";
import { HttpError } from "@neuro/backend-foundation/platform/errors";

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeGovernanceState(value: unknown): NotificationWebhookIncidentGovernanceState | null {
  return value === "active" || value === "acknowledged" || value === "silenced" ? value : null;
}

function normalizeSavedViewFocusSection(value: unknown): NotificationWebhookIncidentSavedViewFocusSection | null {
  if (typeof value !== "string") {
    return null;
  }
  return notificationWebhookIncidentSavedViewFocusSections.includes(
    value as NotificationWebhookIncidentSavedViewFocusSection,
  )
    ? (value as NotificationWebhookIncidentSavedViewFocusSection)
    : null;
}

function normalizeAlertLevel(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function normalizePlaybookAction(value: unknown): NotificationWebhookIncidentSavedViewPlaybookActionKind {
  return value === "silence" || value === "clear_silence" ? value : "acknowledge";
}

function normalizePlaybookBatchLimit(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  return Math.max(1, Math.min(Number.isFinite(parsed) ? Math.floor(parsed) : 10, 50));
}

function normalizePlaybookSilenceDurationMinutes(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  return Math.max(5, Math.min(Number.isFinite(parsed) ? Math.floor(parsed) : 60, 24 * 60));
}

function normalizePlaybookSilenceReasonTemplate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 240);
}

function normalizePlaybookOperatorGuidance(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 1_200);
}

function normalizeNotificationWebhookIncidentSavedViewFilters(
  input?: Partial<NotificationWebhookIncidentSavedViewFilters> | null,
): NotificationWebhookIncidentSavedViewFilters {
  return {
    agentId: normalizeOptionalText(input?.agentId),
    callbackType: normalizeOptionalText(input?.callbackType),
    policyKey: normalizeOptionalText(input?.policyKey),
    reasonCategory: normalizeOptionalText(input?.reasonCategory),
    reasonDisposition: normalizeOptionalText(input?.reasonDisposition),
    projectId: normalizeOptionalText(input?.projectId),
    incidentId: normalizeOptionalText(input?.incidentId),
    routePolicyId: normalizeOptionalText(input?.routePolicyId),
    snapshotId: normalizeOptionalText(input?.snapshotId),
    alertLevel: normalizeAlertLevel(input?.alertLevel),
    governanceState: normalizeGovernanceState(input?.governanceState),
  };
}

function normalizeNotificationWebhookIncidentSavedViewPlaybookDefaults(
  input?: Partial<NotificationWebhookIncidentSavedViewPlaybookDefaults> | null,
): NotificationWebhookIncidentSavedViewPlaybookDefaults {
  return {
    batchLimit: normalizePlaybookBatchLimit(input?.batchLimit),
    silenceDurationMinutes: normalizePlaybookSilenceDurationMinutes(input?.silenceDurationMinutes),
    preferredAction: normalizePlaybookAction(input?.preferredAction),
    silenceReasonTemplate: normalizePlaybookSilenceReasonTemplate(input?.silenceReasonTemplate),
    operatorGuidance: normalizePlaybookOperatorGuidance(input?.operatorGuidance),
    followUpIncidentState: normalizeGovernanceState(input?.followUpIncidentState),
    focusSection: normalizeSavedViewFocusSection(input?.focusSection),
  };
}

function toNotificationWebhookIncidentSavedView(
  row: typeof notificationWebhookIncidentSavedViews.$inferSelect,
  isDefault = false,
): NotificationWebhookIncidentSavedView {
  return {
    id: row.id,
    operatorUserId: row.operatorUserId,
    name: row.name,
    description: row.description,
    isDefault,
    filters: normalizeNotificationWebhookIncidentSavedViewFilters(row.filters),
    playbookDefaults: normalizeNotificationWebhookIncidentSavedViewPlaybookDefaults(row.playbookDefaults),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getNotificationWebhookIncidentDefaultViewIdForOperator(operatorUserId: string) {
  const row = await db.query.notificationWebhookIncidentDefaultViews.findFirst({
    where: eq(notificationWebhookIncidentDefaultViews.operatorUserId, operatorUserId),
    columns: {
      savedViewId: true,
    },
  });
  return row?.savedViewId ?? null;
}

async function getNotificationWebhookIncidentSavedViewRowForOperator(operatorUserId: string, viewId: string) {
  const row = await db.query.notificationWebhookIncidentSavedViews.findFirst({
    where: and(
      eq(notificationWebhookIncidentSavedViews.id, viewId),
      eq(notificationWebhookIncidentSavedViews.operatorUserId, operatorUserId),
    ),
  });
  if (!row) {
    throw new HttpError(404, "NOT_FOUND", "Notification webhook incident saved view not found");
  }
  return row;
}

export async function listNotificationWebhookIncidentSavedViewsForOperator(
  operatorUserId: string,
  input?: ListNotificationWebhookIncidentSavedViewsInput,
): Promise<NotificationWebhookIncidentSavedView[]> {
  const limit = Math.max(1, Math.min(Number(input?.limit ?? 20), 50));
  const defaultViewId = await getNotificationWebhookIncidentDefaultViewIdForOperator(operatorUserId);
  const rows = await db
    .select()
    .from(notificationWebhookIncidentSavedViews)
    .where(eq(notificationWebhookIncidentSavedViews.operatorUserId, operatorUserId))
    .orderBy(
      desc(notificationWebhookIncidentSavedViews.updatedAt),
      desc(notificationWebhookIncidentSavedViews.createdAt),
    )
    .limit(limit);
  return rows.map((row) => toNotificationWebhookIncidentSavedView(row, row.id === defaultViewId));
}

export async function getDefaultNotificationWebhookIncidentSavedViewForOperator(
  operatorUserId: string,
): Promise<NotificationWebhookIncidentSavedView | null> {
  const defaultViewId = await getNotificationWebhookIncidentDefaultViewIdForOperator(operatorUserId);
  if (!defaultViewId) {
    return null;
  }
  const row = await db.query.notificationWebhookIncidentSavedViews.findFirst({
    where: and(
      eq(notificationWebhookIncidentSavedViews.id, defaultViewId),
      eq(notificationWebhookIncidentSavedViews.operatorUserId, operatorUserId),
    ),
  });
  return row ? toNotificationWebhookIncidentSavedView(row, true) : null;
}

export async function createNotificationWebhookIncidentSavedViewAsOperator(
  operatorUserId: string,
  input: CreateNotificationWebhookIncidentSavedViewInput,
): Promise<NotificationWebhookIncidentSavedView> {
  const name = input.name.trim();
  const description = typeof input.description === "string" && input.description.trim().length > 0
    ? input.description.trim()
    : null;
  if (!name) {
    throw new HttpError(400, "BAD_REQUEST", "Notification webhook incident saved view requires name");
  }
  if (name.length > 120) {
    throw new HttpError(400, "BAD_REQUEST", "Notification webhook incident saved view name is too long");
  }
  if (description && description.length > 4000) {
    throw new HttpError(400, "BAD_REQUEST", "Notification webhook incident saved view description is too long");
  }

  const existing = await db.query.notificationWebhookIncidentSavedViews.findFirst({
    where: and(
      eq(notificationWebhookIncidentSavedViews.operatorUserId, operatorUserId),
      eq(notificationWebhookIncidentSavedViews.name, name),
    ),
    columns: {
      id: true,
    },
  });
  if (existing) {
    throw new HttpError(409, "CONFLICT", "A notification webhook incident saved view with the same name already exists");
  }

  const now = new Date();
  const [created] = await db
    .insert(notificationWebhookIncidentSavedViews)
    .values({
      id: crypto.randomUUID(),
      operatorUserId,
      name,
      description,
      filters: normalizeNotificationWebhookIncidentSavedViewFilters(input.filters),
      playbookDefaults: normalizeNotificationWebhookIncidentSavedViewPlaybookDefaults(input.playbookDefaults),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new HttpError(500, "BAD_REQUEST", "Failed to create notification webhook incident saved view");
  }

  if (input.isDefault) {
    await setDefaultNotificationWebhookIncidentSavedViewAsOperator(operatorUserId, created.id);
    return toNotificationWebhookIncidentSavedView(created, true);
  }
  return toNotificationWebhookIncidentSavedView(created, false);
}

export async function updateNotificationWebhookIncidentSavedViewAsOperator(
  operatorUserId: string,
  viewId: string,
  input: CreateNotificationWebhookIncidentSavedViewInput,
): Promise<NotificationWebhookIncidentSavedView> {
  const existingRow = await getNotificationWebhookIncidentSavedViewRowForOperator(operatorUserId, viewId);
  const name = input.name.trim();
  const description =
    typeof input.description === "string" && input.description.trim().length > 0 ? input.description.trim() : null;
  if (!name) {
    throw new HttpError(400, "BAD_REQUEST", "Notification webhook incident saved view requires name");
  }
  if (name.length > 120) {
    throw new HttpError(400, "BAD_REQUEST", "Notification webhook incident saved view name is too long");
  }
  if (description && description.length > 4000) {
    throw new HttpError(400, "BAD_REQUEST", "Notification webhook incident saved view description is too long");
  }

  const conflicting = await db.query.notificationWebhookIncidentSavedViews.findFirst({
    where: and(
      eq(notificationWebhookIncidentSavedViews.operatorUserId, operatorUserId),
      eq(notificationWebhookIncidentSavedViews.name, name),
      ne(notificationWebhookIncidentSavedViews.id, viewId),
    ),
    columns: {
      id: true,
    },
  });
  if (conflicting) {
    throw new HttpError(409, "CONFLICT", "A notification webhook incident saved view with the same name already exists");
  }

  const now = new Date();
  const [updated] = await db
    .update(notificationWebhookIncidentSavedViews)
    .set({
      name,
      description,
      filters: normalizeNotificationWebhookIncidentSavedViewFilters(input.filters),
      playbookDefaults: normalizeNotificationWebhookIncidentSavedViewPlaybookDefaults(input.playbookDefaults),
      updatedAt: now,
    })
    .where(
      and(
        eq(notificationWebhookIncidentSavedViews.id, viewId),
        eq(notificationWebhookIncidentSavedViews.operatorUserId, operatorUserId),
      ),
    )
    .returning();

  if (!updated) {
    throw new HttpError(500, "BAD_REQUEST", "Failed to update notification webhook incident saved view");
  }

  if (input.isDefault) {
    await setDefaultNotificationWebhookIncidentSavedViewAsOperator(operatorUserId, updated.id);
    return toNotificationWebhookIncidentSavedView(updated, true);
  }

  const defaultViewId = await getNotificationWebhookIncidentDefaultViewIdForOperator(operatorUserId);
  return toNotificationWebhookIncidentSavedView(updated, existingRow.id === defaultViewId);
}

export async function setDefaultNotificationWebhookIncidentSavedViewAsOperator(
  operatorUserId: string,
  viewId: string,
): Promise<NotificationWebhookIncidentSavedView> {
  const row = await getNotificationWebhookIncidentSavedViewRowForOperator(operatorUserId, viewId);
  const now = new Date();
  await db
    .insert(notificationWebhookIncidentDefaultViews)
    .values({
      operatorUserId,
      savedViewId: viewId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: notificationWebhookIncidentDefaultViews.operatorUserId,
      set: {
        savedViewId: viewId,
        updatedAt: now,
      },
    });
  return toNotificationWebhookIncidentSavedView(row, true);
}

export async function deleteNotificationWebhookIncidentSavedViewAsOperator(
  operatorUserId: string,
  viewId: string,
): Promise<void> {
  const deleted = await db
    .delete(notificationWebhookIncidentSavedViews)
    .where(
      and(
        eq(notificationWebhookIncidentSavedViews.id, viewId),
        eq(notificationWebhookIncidentSavedViews.operatorUserId, operatorUserId),
      ),
    )
    .returning({ id: notificationWebhookIncidentSavedViews.id });
  if (deleted.length === 0) {
    throw new HttpError(404, "NOT_FOUND", "Notification webhook incident saved view not found");
  }
}
