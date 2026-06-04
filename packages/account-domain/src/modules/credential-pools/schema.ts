import type {
  CredentialAssignmentMode,
  CredentialAssignmentRecordStatus,
  CredentialLifecycleStatus,
  CredentialProviderKey,
  CredentialScope,
  CredentialStorageMode,
  CredentialTerminalStatus,
  CredentialUploadTokenKind,
} from "@neuro/contracts";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { benefitServices } from "@/modules/benefits/schema";
import { users } from "@/modules/identity/schema";

export const credentialProviders = pgTable("credential_providers", {
  key: text("key").primaryKey().$type<CredentialProviderKey>(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  healthCheckStrategy: text("health_check_strategy").notNull(),
  defaultAssignmentMode: text("default_assignment_mode").notNull().$type<CredentialAssignmentMode>(),
  payloadSchemaVersion: text("payload_schema_version").notNull(),
  supportsRepair: boolean("supports_repair").notNull().default(true),
  supportsCooldown: boolean("supports_cooldown").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const credentialTerminals = pgTable("credential_terminals", {
  id: text("id").primaryKey(),
  providerKey: text("provider_key").notNull().references(() => credentialProviders.key, { onDelete: "cascade" }).$type<CredentialProviderKey>(),
  label: text("label").notNull(),
  note: text("note"),
  status: text("status").notNull().$type<CredentialTerminalStatus>(),
  uploadTokenHash: text("upload_token_hash").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastUploadAt: timestamp("last_upload_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const credentialUploadBatches = pgTable("credential_upload_batches", {
  id: text("id").primaryKey(),
  providerKey: text("provider_key").notNull().references(() => credentialProviders.key, { onDelete: "cascade" }).$type<CredentialProviderKey>(),
  benefitServiceId: text("benefit_service_id").references(() => benefitServices.id, { onDelete: "set null" }),
  terminalId: text("terminal_id").references(() => credentialTerminals.id, { onDelete: "set null" }),
  tokenKind: text("token_kind").notNull().$type<CredentialUploadTokenKind>(),
  label: text("label").notNull(),
  importNote: text("import_note"),
  acceptedCount: integer("accepted_count").notNull(),
  rejectedCount: integer("rejected_count").notNull(),
  inlineCount: integer("inline_count").notNull(),
  r2Count: integer("r2_count").notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const credentialEntries = pgTable("credential_entries", {
  id: text("id").primaryKey(),
  providerKey: text("provider_key").notNull().references(() => credentialProviders.key, { onDelete: "cascade" }).$type<CredentialProviderKey>(),
  benefitServiceId: text("benefit_service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
  uploadBatchId: text("upload_batch_id").references(() => credentialUploadBatches.id, { onDelete: "set null" }),
  sourceTerminalId: text("source_terminal_id").references(() => credentialTerminals.id, { onDelete: "set null" }),
  entryLabel: text("entry_label"),
  storageMode: text("storage_mode").notNull().$type<CredentialStorageMode>(),
  scope: text("scope").notNull().$type<CredentialScope>(),
  lifecycleStatus: text("lifecycle_status").notNull().$type<CredentialLifecycleStatus>(),
  privateUserId: text("private_user_id").references(() => users.id, { onDelete: "set null" }),
  payloadSchemaVersion: text("payload_schema_version").notNull(),
  maskedSummary: text("masked_summary").notNull(),
  previewLabel: text("preview_label"),
  previewUrl: text("preview_url"),
  payloadInline: jsonb("payload_inline").$type<Record<string, unknown> | null>(),
  payloadObjectKey: text("payload_object_key"),
  payloadContentType: text("payload_content_type"),
  eligibleAfter: timestamp("eligible_after", { withTimezone: true }),
  invalidReason: text("invalid_reason"),
  deathReason: text("death_reason"),
  failureCount: integer("failure_count").notNull().default(0),
  lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const credentialAssignments = pgTable(
  "credential_assignments",
  {
    id: text("id").primaryKey(),
    benefitServiceId: text("benefit_service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    credentialEntryId: text("credential_entry_id").references(() => credentialEntries.id, { onDelete: "set null" }),
    assignmentMode: text("assignment_mode").notNull().$type<CredentialAssignmentMode>(),
    status: text("status").notNull().$type<CredentialAssignmentRecordStatus>(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    serviceUserUnique: uniqueIndex("credential_assignments_service_user_idx").on(table.benefitServiceId, table.userId),
  }),
);

export const credentialRepairClaims = pgTable(
  "credential_repair_claims",
  {
    id: text("id").primaryKey(),
    credentialEntryId: text("credential_entry_id").notNull().references(() => credentialEntries.id, { onDelete: "cascade" }),
    benefitServiceId: text("benefit_service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    claimOwnerType: text("claim_owner_type").notNull(),
    claimOwnerKey: text("claim_owner_key").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
    staleAt: timestamp("stale_at", { withTimezone: true }).notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    entryUnique: uniqueIndex("credential_repair_claims_entry_idx").on(table.credentialEntryId),
  }),
);

export const credentialDeathJobs = pgTable(
  "credential_death_jobs",
  {
    id: text("id").primaryKey(),
    credentialEntryId: text("credential_entry_id").notNull().references(() => credentialEntries.id, { onDelete: "cascade" }),
    benefitServiceId: text("benefit_service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
    providerKey: text("provider_key").notNull().references(() => credentialProviders.key, { onDelete: "cascade" }).$type<CredentialProviderKey>(),
    objectKey: text("object_key"),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    requestedByUserId: text("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    entryUnique: uniqueIndex("credential_death_jobs_entry_idx").on(table.credentialEntryId),
  }),
);
