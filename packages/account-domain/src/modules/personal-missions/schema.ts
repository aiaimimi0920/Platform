import type { MissionKind, MissionMetricKey, MissionResetRule, MissionStreakMode, MissionStatus } from "@neuro/contracts";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const personalMissionDefinitions = pgTable("personal_mission_definitions", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<MissionKind>().notNull(),
  status: text("status").$type<MissionStatus>().notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  description: text("description").notNull(),
  eyebrow: text("eyebrow").notNull(),
  rewardCurrency: text("reward_currency").notNull(),
  rewardAmount: integer("reward_amount").notNull(),
  metricKey: text("metric_key").$type<MissionMetricKey>().notNull(),
  progressTarget: integer("progress_target").notNull(),
  resetRule: text("reset_rule").$type<MissionResetRule>().notNull(),
  streakMode: text("streak_mode").$type<MissionStreakMode>().notNull(),
  streakTarget: integer("streak_target"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const personalMissionClaims = pgTable(
  "personal_mission_claims",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id").notNull().references(() => personalMissionDefinitions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    progressSnapshot: jsonb("progress_snapshot").$type<Record<string, unknown> | null>(),
    rewardCurrency: text("reward_currency").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    baseRewardAmount: integer("base_reward_amount"),
    bonusRewardAmount: integer("bonus_reward_amount"),
    bonusSourceWagerAmount: integer("bonus_source_wager_amount"),
    bonusMultiplier: integer("bonus_multiplier"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userMissionPeriodUnique: uniqueIndex("personal_mission_claims_user_mission_period_idx").on(
      table.userId,
      table.missionId,
      table.periodKey,
    ),
  }),
);

export const personalMissionCheckinWagers = pgTable(
  "personal_mission_checkin_wagers",
  {
    id: text("id").primaryKey(),
    missionId: text("mission_id").notNull().references(() => personalMissionDefinitions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sourceDayKey: text("source_day_key").notNull(),
    rewardPeriodKey: text("reward_period_key").notNull(),
    rewardCurrency: text("reward_currency").notNull(),
    wagerAmount: integer("wager_amount").notNull(),
    bonusAmount: integer("bonus_amount").notNull(),
    bonusMultiplier: integer("bonus_multiplier").notNull(),
    consumedByClaimId: text("consumed_by_claim_id").references(() => personalMissionClaims.id, { onDelete: "set null" }),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => ({
    userMissionSourceDayUnique: uniqueIndex("personal_mission_checkin_wagers_user_mission_source_day_idx").on(
      table.userId,
      table.missionId,
      table.sourceDayKey,
    ),
    userMissionRewardPeriodUnique: uniqueIndex("personal_mission_checkin_wagers_user_mission_reward_period_idx").on(
      table.userId,
      table.missionId,
      table.rewardPeriodKey,
    ),
  }),
);
