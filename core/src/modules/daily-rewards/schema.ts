import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const dailyRewardClaims = pgTable(
  "daily_reward_claims",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    rewardDate: text("reward_date").notNull(),
    rewardCurrency: text("reward_currency").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    streakDaysAfterClaim: integer("streak_days_after_claim").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userDateUnique: uniqueIndex("daily_reward_claims_user_date_idx").on(table.userId, table.rewardDate),
  }),
);

export const dailyMissionClaims = pgTable(
  "daily_mission_claims",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    missionKey: text("mission_key").notNull(),
    rewardDate: text("reward_date").notNull(),
    rewardCurrency: text("reward_currency").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userMissionDayUnique: uniqueIndex("daily_mission_claims_user_mission_day_idx").on(
      table.userId,
      table.rewardDate,
      table.missionKey,
    ),
  }),
);

export const weeklyMissionClaims = pgTable(
  "weekly_mission_claims",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    missionKey: text("mission_key").notNull(),
    weekKey: text("week_key").notNull(),
    rewardCurrency: text("reward_currency").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userMissionWeekUnique: uniqueIndex("weekly_mission_claims_user_mission_week_idx").on(
      table.userId,
      table.weekKey,
      table.missionKey,
    ),
  }),
);
