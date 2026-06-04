import type { MissionKind } from "@neuro/contracts";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  personalMissionCheckinWagers,
  personalMissionClaims,
  personalMissionDefinitions,
} from "@/modules/personal-missions/schema";

type DbTx = NodePgDatabase<typeof schema>;

export async function listActiveMissionDefinitionRows() {
  return db
    .select()
    .from(personalMissionDefinitions)
    .where(eq(personalMissionDefinitions.status, "active"))
    .orderBy(asc(personalMissionDefinitions.sortOrder), asc(personalMissionDefinitions.createdAt));
}

export async function listOperatorMissionDefinitionRows() {
  return db
    .select()
    .from(personalMissionDefinitions)
    .orderBy(
      asc(personalMissionDefinitions.kind),
      asc(personalMissionDefinitions.sortOrder),
      desc(personalMissionDefinitions.updatedAt),
    );
}

export async function getMissionDefinitionRowById(id: string) {
  const [row] = await db
    .select()
    .from(personalMissionDefinitions)
    .where(eq(personalMissionDefinitions.id, id))
    .limit(1);
  return row ?? null;
}

export async function hasPendingMissionCheckinWagers(missionId: string) {
  const [row] = await db
    .select({ count: count(personalMissionCheckinWagers.id) })
    .from(personalMissionCheckinWagers)
    .where(
      and(
        eq(personalMissionCheckinWagers.missionId, missionId),
        isNull(personalMissionCheckinWagers.consumedByClaimId),
      ),
    );
  return Number(row?.count ?? 0) > 0;
}

export async function listMissionDefinitionRowsByIds(ids: string[]) {
  const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)));
  if (normalizedIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(personalMissionDefinitions)
    .where(inArray(personalMissionDefinitions.id, normalizedIds));
}

export async function insertMissionDefinitionRow(values: typeof personalMissionDefinitions.$inferInsert) {
  const [row] = await db.insert(personalMissionDefinitions).values(values).returning();
  return row;
}

export async function updateMissionDefinitionRow(
  id: string,
  values: Partial<typeof personalMissionDefinitions.$inferInsert>,
) {
  const [row] = await db
    .update(personalMissionDefinitions)
    .set(values)
    .where(eq(personalMissionDefinitions.id, id))
    .returning();
  return row ?? null;
}

export async function deleteMissionDefinitionRow(id: string) {
  const [row] = await db
    .delete(personalMissionDefinitions)
    .where(eq(personalMissionDefinitions.id, id))
    .returning({ id: personalMissionDefinitions.id });
  return row ?? null;
}

export async function listMissionClaimRowsByMissionIds(
  tx: DbTx,
  userId: string,
  missionIds: string[],
) {
  const normalizedIds = Array.from(new Set(missionIds.map((id) => id.trim()).filter((id) => id.length > 0)));
  if (normalizedIds.length === 0) {
    return [];
  }

  return tx
    .select()
    .from(personalMissionClaims)
    .where(and(eq(personalMissionClaims.userId, userId), inArray(personalMissionClaims.missionId, normalizedIds)));
}

export async function getMissionClaimByMissionAndPeriod(
  tx: DbTx,
  userId: string,
  missionId: string,
  periodKey: string,
) {
  const [row] = await tx
    .select()
    .from(personalMissionClaims)
    .where(
      and(
        eq(personalMissionClaims.userId, userId),
        eq(personalMissionClaims.missionId, missionId),
        eq(personalMissionClaims.periodKey, periodKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getLatestMissionClaim(
  tx: DbTx,
  userId: string,
  missionId: string,
) {
  const [row] = await tx
    .select()
    .from(personalMissionClaims)
    .where(and(eq(personalMissionClaims.userId, userId), eq(personalMissionClaims.missionId, missionId)))
    .orderBy(desc(personalMissionClaims.claimedAt))
    .limit(1);
  return row ?? null;
}

export async function getMissionCheckinWagerBySourceDay(
  tx: DbTx,
  userId: string,
  missionId: string,
  sourceDayKey: string,
) {
  const [row] = await tx
    .select()
    .from(personalMissionCheckinWagers)
    .where(
      and(
        eq(personalMissionCheckinWagers.userId, userId),
        eq(personalMissionCheckinWagers.missionId, missionId),
        eq(personalMissionCheckinWagers.sourceDayKey, sourceDayKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getMissionCheckinWagerByRewardPeriod(
  tx: DbTx,
  userId: string,
  missionId: string,
  rewardPeriodKey: string,
) {
  const [row] = await tx
    .select()
    .from(personalMissionCheckinWagers)
    .where(
      and(
        eq(personalMissionCheckinWagers.userId, userId),
        eq(personalMissionCheckinWagers.missionId, missionId),
        eq(personalMissionCheckinWagers.rewardPeriodKey, rewardPeriodKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertMissionCheckinWagerRow(
  tx: DbTx,
  values: typeof personalMissionCheckinWagers.$inferInsert,
) {
  const [row] = await tx.insert(personalMissionCheckinWagers).values(values).returning();
  return row;
}

export async function consumeMissionCheckinWagerRow(
  tx: DbTx,
  id: string,
  consumedByClaimId: string,
  consumedAt: Date,
) {
  const [row] = await tx
    .update(personalMissionCheckinWagers)
    .set({
      consumedByClaimId,
      consumedAt,
    })
    .where(eq(personalMissionCheckinWagers.id, id))
    .returning();
  return row ?? null;
}

export async function countMissionClaimsByKinds(
  tx: DbTx,
  userId: string,
  kinds: MissionKind[],
  from: Date,
  to: Date,
) {
  if (kinds.length === 0) {
    return 0;
  }

  const [row] = await tx
    .select({ count: count(personalMissionClaims.id) })
    .from(personalMissionClaims)
    .innerJoin(personalMissionDefinitions, eq(personalMissionClaims.missionId, personalMissionDefinitions.id))
    .where(
      and(
        eq(personalMissionClaims.userId, userId),
        inArray(personalMissionDefinitions.kind, kinds),
        gte(personalMissionClaims.claimedAt, from),
        lt(personalMissionClaims.claimedAt, to),
      ),
    );

  return Number(row?.count ?? 0);
}
