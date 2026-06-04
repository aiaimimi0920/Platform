import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    kind: text("kind").notNull(),
    currency: text("currency").notNull(),
    price: integer("price").notNull(),
    fulfillmentMode: text("fulfillment_mode").notNull(),
    transferable: boolean("transferable").notNull(),
    active: boolean("active").notNull(),
    allowDiscountCodes: boolean("allow_discount_codes").notNull(),
    limitScope: text("limit_scope").notNull(),
    targetedAudienceGroupKey: text("targeted_audience_group_key"),
    durationDays: integer("duration_days"),
    unitCount: integer("unit_count"),
    warrantyDays: integer("warranty_days"),
    stockLabel: text("stock_label").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    gatewayAccessBundleId: text("gateway_access_bundle_id"),
    gatewayAccessGrantMode: text("gateway_access_grant_mode"),
    gatewayAccessGrantQuantity: integer("gateway_access_grant_quantity"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("products_slug_idx").on(table.slug),
  }),
);

export const productSeedTombstones = pgTable("product_seed_tombstones", {
  productId: text("product_id").primaryKey(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull(),
});

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    namespace: text("namespace"),
    batchLabel: text("batch_label"),
    enabled: boolean("enabled").notNull(),
    scope: text("scope").notNull(),
    targetProductCategory: text("target_product_category"),
    targetProductId: text("target_product_id").references(() => products.id),
    audienceScope: text("audience_scope").notNull(),
    audienceGroupKey: text("audience_group_key"),
    audienceUserId: text("audience_user_id"),
    valueKind: text("value_kind").notNull(),
    valueAmount: integer("value_amount").notNull(),
    totalMaxUses: integer("total_max_uses"),
    usedCount: integer("used_count").notNull(),
    perUserLimit: integer("per_user_limit"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("discount_codes_code_idx").on(table.code),
  }),
);

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull().references(() => products.id),
  currency: text("currency").notNull(),
  amount: integer("amount").notNull(),
  originalAmount: integer("original_amount").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  finalAmount: integer("final_amount").notNull(),
  discountCodeId: text("discount_code_id").references(() => discountCodes.id),
  discountCode: text("discount_code"),
  status: text("status").notNull(),
  rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
  rolledBackByUserId: text("rolled_back_by_user_id"),
  rollbackReason: text("rollback_reason"),
  rollbackNote: text("rollback_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const discountCodeUsages = pgTable("discount_code_usages", {
  id: text("id").primaryKey(),
  discountCodeId: text("discount_code_id").notNull().references(() => discountCodes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull().references(() => products.id),
  orderId: text("order_id").references(() => orders.id),
  productTitle: text("product_title").notNull(),
  fulfillmentMode: text("fulfillment_mode").notNull(),
  transferable: boolean("transferable").notNull(),
  status: text("status").notNull(),
  remainingUses: integer("remaining_uses"),
  totalUnits: integer("total_units"),
  activeUnits: integer("active_units"),
  replacementCount: integer("replacement_count").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: text("revoked_by_user_id"),
  revocationReason: text("revocation_reason"),
  warrantyExpiresAt: timestamp("warranty_expires_at", { withTimezone: true }),
  lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const productGatewayAccessGrants = pgTable(
  "product_gateway_access_grants",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    userId: text("user_id").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    bundleId: text("bundle_id").notNull(),
    grantMode: text("grant_mode").notNull(),
    durationDays: integer("duration_days"),
    tokenAmount: integer("token_amount"),
    messageAmount: integer("message_amount"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
    effectiveStartsAt: timestamp("effective_starts_at", { withTimezone: true }).notNull(),
    effectiveEndsAt: timestamp("effective_ends_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    itemUnique: uniqueIndex("product_gateway_access_grants_item_idx").on(table.itemId),
    orderIdx: index("product_gateway_access_grants_order_idx").on(table.orderId),
    userBundleIdx: index("product_gateway_access_grants_user_bundle_idx").on(table.userId, table.bundleId),
    userBundleRevokedIdx: index("product_gateway_access_grants_user_bundle_revoked_idx").on(
      table.userId,
      table.bundleId,
      table.revokedAt,
      table.grantedAt,
    ),
  }),
);

export const itemUnits = pgTable(
  "item_units",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    slotNumber: integer("slot_number").notNull(),
    generation: integer("generation").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull(),
    issueReason: text("issue_reason"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    replacedByUnitId: text("replaced_by_unit_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("item_units_item_code_idx").on(table.itemId, table.code),
  }),
);

export const itemIssueReports = pgTable("item_issue_reports", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  unitId: text("unit_id").notNull().references(() => itemUnits.id, { onDelete: "cascade" }),
  reporterUserId: text("reporter_user_id").notNull(),
  reason: text("reason").notNull(),
  outcome: text("outcome").notNull(),
  rejectionCode: text("rejection_code"),
  replacementUnitId: text("replacement_unit_id").references(() => itemUnits.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const itemManualReviews = pgTable("item_manual_reviews", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  unitId: text("unit_id").notNull().references(() => itemUnits.id, { onDelete: "cascade" }),
  reportId: text("report_id").notNull().references(() => itemIssueReports.id, { onDelete: "cascade" }),
  slotNumber: integer("slot_number").notNull(),
  status: text("status").notNull(),
  reason: text("reason").notNull(),
  routingCode: text("routing_code").notNull(),
  routingSummary: text("routing_summary").notNull(),
  suggestedAction: text("suggested_action").notNull(),
  assigneeUserId: text("assignee_user_id"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  lastClaimReleasedAt: timestamp("last_claim_released_at", { withTimezone: true }),
  lastClaimReleaseReason: text("last_claim_release_reason"),
  autoAssignmentCount: integer("auto_assignment_count").notNull().default(0),
  lastAutoAssignedAt: timestamp("last_auto_assigned_at", { withTimezone: true }),
  escalationLevel: integer("escalation_level").notNull().default(0),
  slaEscalatedAt: timestamp("sla_escalated_at", { withTimezone: true }),
  resolutionAction: text("resolution_action"),
  resolutionNote: text("resolution_note"),
  reviewerUserId: text("reviewer_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const itemManualReviewAssignmentEvents = pgTable("item_manual_review_assignment_events", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull().references(() => itemManualReviews.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  reportId: text("report_id").notNull().references(() => itemIssueReports.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  fromAssigneeUserId: text("from_assignee_user_id"),
  toAssigneeUserId: text("to_assignee_user_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const itemManualReviewWorkloadSnapshots = pgTable("item_manual_review_workload_snapshots", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  openCount: integer("open_count").notNull(),
  unclaimedCount: integer("unclaimed_count").notNull(),
  breachedUnclaimedCount: integer("breached_unclaimed_count").notNull().default(0),
  slaBreachedCount: integer("sla_breached_count").notNull(),
  atCapacityCount: integer("at_capacity_count").notNull(),
  recommendedAssigneeUserId: text("recommended_assignee_user_id"),
  claimNextEta: text("claim_next_eta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const itemReplacementLogs = pgTable("item_replacement_logs", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  previousUnitId: text("previous_unit_id").references(() => itemUnits.id, { onDelete: "set null" }),
  replacementUnitId: text("replacement_unit_id").notNull().references(() => itemUnits.id, { onDelete: "cascade" }),
  reason: text("reason"),
  trigger: text("trigger").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const itemFulfillmentRuns = pgTable("item_fulfillment_runs", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  scannedUnits: integer("scanned_units").notNull(),
  replacementsCreated: integer("replacements_created").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const itemFulfillmentAnomalies = pgTable("item_fulfillment_anomalies", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  reportId: text("report_id").references(() => itemIssueReports.id, { onDelete: "set null" }),
  reviewId: text("review_id").references(() => itemManualReviews.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  routingCode: text("routing_code"),
  policyKey: text("policy_key"),
  escalationStrategy: text("escalation_strategy"),
  autoAction: text("auto_action").notNull().default("none"),
  autoActionTemplateKey: text("auto_action_template_key"),
  summary: text("summary").notNull(),
  detail: text("detail"),
  alertLevel: integer("alert_level").notNull().default(0),
  alertedAt: timestamp("alerted_at", { withTimezone: true }),
  lastAlertReason: text("last_alert_reason"),
  nextAlertEligibleAt: timestamp("next_alert_eligible_at", { withTimezone: true }),
  nextEscalationAt: timestamp("next_escalation_at", { withTimezone: true }),
  lastAutoAction: text("last_auto_action"),
  lastAutoActionAt: timestamp("last_auto_action_at", { withTimezone: true }),
  autoActionAttemptCount: integer("auto_action_attempt_count").notNull().default(0),
  lastAutoActionStatus: text("last_auto_action_status"),
  lastAutoActionError: text("last_auto_action_error"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
});
