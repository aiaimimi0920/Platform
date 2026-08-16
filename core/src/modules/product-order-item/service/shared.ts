import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { env } from "@/env";
import { NotFoundError } from "@/platform/errors";

export type DbTx = NodePgDatabase<typeof schema>;

export function now() {
  return new Date();
}

export function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function isPlatformOperator(userId: string) {
  return env.platformOperatorUserIds.includes(userId);
}

export function isIssueReportingEnabled(fulfillmentMode: string) {
  return fulfillmentMode === "maintained_pool" || fulfillmentMode === "warranty_delivery";
}

export function sortSummaryBuckets(bucketMap: Map<string, number>) {
  return [...bucketMap.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export async function getUserForDiscountEvaluation(tx: DbTx, userId: string) {
  const user = await tx.query.users.findFirst({
    where: (row, operators) => operators.eq(row.id, userId),
  });

  if (!user) {
    throw new NotFoundError("用户不存在，无法校验优惠码");
  }

  return user;
}

export function matchesUserGroup(groupKey: string | null, user: NonNullable<Awaited<ReturnType<typeof getUserForDiscountEvaluation>>>) {
  if (!groupKey) return false;
  if (groupKey === "trusted_users") {
    return (user.trustLevel ?? 0) >= 2;
  }
  if (groupKey === "new_users") {
    return user.createdAt.getTime() >= now().getTime() - 7 * 24 * 60 * 60 * 1000;
  }
  return false;
}
