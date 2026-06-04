import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const featureModules = pgTable("feature_modules", {
  moduleKey: text("module_key").primaryKey(),
  enabled: boolean("enabled").notNull(),
  rolloutNote: text("rollout_note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
