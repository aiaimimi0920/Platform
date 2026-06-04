import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const arbitrationCases = pgTable("arbitration_cases", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  requesterUserId: text("requester_user_id").notNull().references(() => users.id),
  respondentUserId: text("respondent_user_id").notNull().references(() => users.id),
  assigneeUserId: text("assignee_user_id").references(() => users.id),
  status: text("status").notNull(),
  taskResolutionAction: text("task_resolution_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
