import type { BenefitCredentialServiceConfig } from "@neuro/contracts";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";
import { products } from "@/modules/product-order-item/schema";

export const benefitFamilies = pgTable("benefit_families", {
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  tone: text("tone").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const benefitProductLines = pgTable("benefit_product_lines", {
  id: text("id").primaryKey(),
  familyKey: text("family_key").notNull().references(() => benefitFamilies.key, { onDelete: "cascade" }),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(100),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const benefitServices = pgTable("benefit_services", {
  id: text("id").primaryKey(),
  familyKey: text("family_key").notNull().references(() => benefitFamilies.key, { onDelete: "cascade" }),
  productLineId: text("product_line_id").references(() => benefitProductLines.id, { onDelete: "cascade" }),
  serviceKind: text("service_kind").notNull(),
  status: text("status").notNull(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull(),
  config: jsonb("config").$type<BenefitCredentialServiceConfig>().notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const benefitProductBindings = pgTable(
  "benefit_product_bindings",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    serviceProductUnique: uniqueIndex("benefit_product_bindings_service_product_idx").on(table.serviceId, table.productId),
  }),
);

export const benefitUserGrants = pgTable(
  "benefit_user_grants",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceKey: text("source_key").notNull(),
    sourceOrderId: text("source_order_id"),
    sourceItemId: text("source_item_id"),
    status: text("status").notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    durationDays: integer("duration_days"),
  },
  (table) => ({
    sourceUnique: uniqueIndex("benefit_user_grants_source_key_idx").on(table.serviceId, table.userId, table.sourceKey),
  }),
);

export const benefitServiceApiAccessKeys = pgTable("benefit_service_api_access_keys", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  rotatedFromAccessKeyId: text("rotated_from_access_key_id"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: text("revoked_by_user_id").references(() => users.id, { onDelete: "set null" }),
  revokeReason: text("revoke_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const benefitServiceProxyBindings = pgTable(
  "benefit_service_proxy_bindings",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    credentialEntryId: text("credential_entry_id"),
    status: text("status").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    serviceUserUnique: uniqueIndex("benefit_service_proxy_bindings_service_user_idx").on(table.serviceId, table.userId),
  }),
);

export const benefitServiceProxyRequests = pgTable(
  "benefit_service_proxy_requests",
  {
    id: text("id").primaryKey(),
    accessKeyId: text("access_key_id").notNull().references(() => benefitServiceApiAccessKeys.id, { onDelete: "cascade" }),
    serviceId: text("service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bindingId: text("binding_id").references(() => benefitServiceProxyBindings.id, { onDelete: "set null" }),
    credentialEntryId: text("credential_entry_id"),
    endpointKind: text("endpoint_kind").notNull(),
    model: text("model"),
    sessionKey: text("session_key"),
    responseId: text("response_id").notNull(),
    previousResponseId: text("previous_response_id"),
    stream: boolean("stream").notNull().default(false),
    relayStatus: text("relay_status").notNull(),
    upstreamStatus: integer("upstream_status"),
    durationMs: integer("duration_ms"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    errorSummary: text("error_summary"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    responseIdUnique: uniqueIndex("benefit_service_proxy_requests_response_id_idx").on(table.responseId),
    serviceCreatedAtIdx: uniqueIndex("benefit_service_proxy_requests_service_created_idx").on(table.serviceId, table.createdAt, table.id),
  }),
);

export const benefitCredentialPools = pgTable("benefit_credential_pools", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  importNote: text("import_note"),
  entryCount: integer("entry_count").notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const benefitCredentialEntries = pgTable("benefit_credential_entries", {
  id: text("id").primaryKey(),
  poolId: text("pool_id").notNull().references(() => benefitCredentialPools.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
  entryLabel: text("entry_label"),
  refillCode: text("refill_code"),
  apiKey: text("api_key"),
  apiUrl: text("api_url"),
  status: text("status").notNull(),
  assignedUserId: text("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const benefitUserAssignments = pgTable(
  "benefit_user_assignments",
  {
    id: text("id").primaryKey(),
    serviceId: text("service_id").notNull().references(() => benefitServices.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    credentialEntryId: text("credential_entry_id").references(() => benefitCredentialEntries.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    serviceUserUnique: uniqueIndex("benefit_user_assignments_service_user_idx").on(table.serviceId, table.userId),
  }),
);
