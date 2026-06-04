import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const publicSurfaceVisibility = pgTable("public_surface_visibility", {
  surfaceKey: text("surface_key").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
