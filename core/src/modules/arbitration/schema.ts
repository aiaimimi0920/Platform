import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const arbitrationCases = pgTable(
  "arbitration_cases",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    requesterUserId: text("requester_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    respondentUserId: text("respondent_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedOperatorUserId: text("assigned_operator_user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    evidenceSummary: text("evidence_summary"),
    resolutionSummary: text("resolution_summary"),
    taskResolutionAction: text("task_resolution_action"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    effectsAppliedAt: timestamp("effects_applied_at", { withTimezone: true }),
  },
  (table) => ({
    entityStatusIdx: uniqueIndex("arbitration_cases_entity_status_idx").on(table.entityType, table.entityId, table.status),
  }),
);

export const arbitrationCaseReviewRounds = pgTable(
  "arbitration_case_review_rounds",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => arbitrationCases.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    status: text("status").notNull(),
    summary: text("summary"),
    assignedOperatorUserId: text("assigned_operator_user_id").references(() => users.id, { onDelete: "set null" }),
    startedByUserId: text("started_by_user_id").references(() => users.id, { onDelete: "set null" }),
    endedByUserId: text("ended_by_user_id").references(() => users.id, { onDelete: "set null" }),
    finalEscalatedAt: timestamp("final_escalated_at", { withTimezone: true }),
    finalEscalationCount: integer("final_escalation_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => ({
    caseRoundUnique: uniqueIndex("arbitration_case_review_rounds_case_round_idx").on(table.caseId, table.roundNumber),
    caseStartedIdx: index("arbitration_case_review_rounds_case_started_idx").on(table.caseId, table.startedAt),
  }),
);

export const arbitrationCaseEvidences = pgTable(
  "arbitration_case_evidences",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => arbitrationCases.id, { onDelete: "cascade" }),
    creatorUserId: text("creator_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    caseCreatedIdx: index("arbitration_case_evidences_case_created_idx").on(table.caseId, table.createdAt),
    creatorIdx: index("arbitration_case_evidences_creator_idx").on(table.creatorUserId),
  }),
);

export const arbitrationEvidenceAttachments = pgTable(
  "arbitration_evidence_attachments",
  {
    id: text("id").primaryKey(),
    evidenceId: text("evidence_id")
      .notNull()
      .references(() => arbitrationCaseEvidences.id, { onDelete: "cascade" }),
    caseId: text("case_id")
      .notNull()
      .references(() => arbitrationCases.id, { onDelete: "cascade" }),
    uploaderUserId: text("uploader_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageMode: text("storage_mode").notNull().default("local"),
    uploadState: text("upload_state").notNull().default("uploaded"),
    storagePolicyKey: text("storage_policy_key"),
    bucketKey: text("bucket_key"),
    objectKey: text("object_key"),
    remoteUrl: text("remote_url"),
    storagePath: text("storage_path").notNull(),
    uploadPreparedAt: timestamp("upload_prepared_at", { withTimezone: true }),
    preparedUploadExpiresAt: timestamp("prepared_upload_expires_at", { withTimezone: true }),
    uploadCompletedAt: timestamp("upload_completed_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedSizeBytes: integer("verified_size_bytes"),
    verifiedContentType: text("verified_content_type"),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }),
    cleanupRequestedAt: timestamp("cleanup_requested_at", { withTimezone: true }),
    cleanupAttemptCount: integer("cleanup_attempt_count").notNull().default(0),
    lastCleanupAttemptAt: timestamp("last_cleanup_attempt_at", { withTimezone: true }),
    lastCleanupError: text("last_cleanup_error"),
    nextCleanupAttemptAt: timestamp("next_cleanup_attempt_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveReason: text("archive_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    evidenceCreatedIdx: index("arbitration_evidence_attachments_evidence_created_idx").on(table.evidenceId, table.createdAt),
    caseCreatedIdx: index("arbitration_evidence_attachments_case_created_idx").on(table.caseId, table.createdAt),
  }),
);
