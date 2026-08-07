import type { GatewayAccessGrantMode } from "@neuro/contracts";
import { requestInternalText } from "@neuro/backend-foundation/platform/internal-request";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { env } from "@/env";
import { BadRequestError, ConflictError } from "@/platform/errors";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { productGatewayAccessGrants } from "@/modules/product-order-item/schema";

type DbTx = NodePgDatabase<typeof schema>;

type GatewayAccessGrantProjection = {
  userId: string;
  bundleId: string;
  grantMode: GatewayAccessGrantMode;
  activeGrantCount: number;
  balanceStatus: "active" | "expired";
  periodStartsAt: Date | null;
  periodEndsAt: Date | null;
  totalQuantity: number;
  remainingQuantity: number | null;
};

type GatewayAccessKeyBalanceSnapshot = {
  accessKeyId: string;
  balanceMode: string;
  status: string;
  unlimitedUntil: string | null;
  periodStartsAt: string | null;
  periodEndsAt: string | null;
  totalTokens: number | null;
  remainingTokens: number | null;
  totalMessages: number | null;
  remainingMessages: number | null;
  updatedAt: string;
};

export type GatewayAccessGrantSyncResult = {
  itemId: string;
  userId: string;
  bundleId: string;
  grantMode: GatewayAccessGrantMode;
  accessKeyId: string;
  activeGrantCount: number;
  balanceStatus: "active" | "expired";
  periodStartsAt: string | null;
  periodEndsAt: string | null;
  totalQuantity: number;
  remainingQuantity: number | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * DAY_IN_MS);
}

function resolveGatewayInternalBaseUrl() {
  const value = env.aiGatewayInternalUrl?.trim();
  if (!value) {
    throw new ConflictError("当前环境尚未配置 AI_GATEWAY_INTERNAL_URL。");
  }
  return value.replace(/\/+$/, "");
}

function resolveGatewayManagementToken() {
  const value = env.aiGatewayManagementToken?.trim();
  if (!value) {
    throw new ConflictError("当前环境尚未配置 AI_GATEWAY_MANAGEMENT_TOKEN。");
  }
  return value;
}

function parseGatewayError(status: number, raw: string) {
  if (!raw) {
    return `Gateway request failed with ${status}`;
  }

  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || `Gateway request failed with ${status}`;
  } catch {
    return raw;
  }
}

async function gatewayManagementRequest<T>(
  pathname: string,
  init?: {
    method?: "GET" | "POST";
    body?: unknown;
  },
): Promise<T> {
  const baseUrl = resolveGatewayInternalBaseUrl();
  const managementToken = resolveGatewayManagementToken();
  const { response, text } = await requestInternalText(
    `${baseUrl}${pathname}`,
    {
      method: init?.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "x-internal-api-key": managementToken,
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    },
    {
      timeoutMs: env.gatewayInternalFetchTimeoutMs,
      timeoutMessage: `Gateway management request timed out: ${pathname}`,
    },
  );

  if (!response.ok) {
    throw new Error(parseGatewayError(response.status, text));
  }

  return JSON.parse(text) as T;
}

async function ensureGatewayBundleUserAccessKey(args: { bundleId: string; userId: string }) {
  return gatewayManagementRequest<{ id: string }>(
    `/v1/internal/gateway/access/bundles/${encodeURIComponent(args.bundleId)}/user-keys/ensure`,
    {
      method: "POST",
      body: {
        userId: args.userId,
      },
    },
  );
}

async function getGatewayAccessKeyBalance(accessKeyId: string) {
  return gatewayManagementRequest<GatewayAccessKeyBalanceSnapshot | null>(
    `/v1/internal/gateway/access/keys/${encodeURIComponent(accessKeyId)}/balance`,
  );
}

async function adjustGatewayTimePassBalance(args: {
  accessKeyId: string;
  balanceStatus: "active" | "expired";
  periodStartsAt: Date | null;
  periodEndsAt: Date | null;
}) {
  const anchor = args.periodEndsAt ?? new Date();
  await gatewayManagementRequest(
    `/v1/internal/gateway/access/keys/${encodeURIComponent(args.accessKeyId)}/balances/adjust`,
    {
      method: "POST",
      body: {
        balanceMode: "time_pass",
        status: args.balanceStatus,
        unlimitedUntil: anchor.toISOString(),
        periodStartsAt: (args.periodStartsAt ?? anchor).toISOString(),
        periodEndsAt: anchor.toISOString(),
      },
    },
  );
}

async function adjustGatewayTokenBalance(args: {
  accessKeyId: string;
  balanceStatus: "active" | "expired";
  totalTokens: number;
  remainingTokens: number;
}) {
  await gatewayManagementRequest(
    `/v1/internal/gateway/access/keys/${encodeURIComponent(args.accessKeyId)}/balances/adjust`,
    {
      method: "POST",
      body: {
        balanceMode: "token_prepaid",
        status: args.balanceStatus,
        totalTokens: args.totalTokens,
        remainingTokens: args.remainingTokens,
      },
    },
  );
}

async function adjustGatewayMessageBalance(args: {
  accessKeyId: string;
  balanceStatus: "active" | "expired";
  totalMessages: number;
  remainingMessages: number;
}) {
  await gatewayManagementRequest(
    `/v1/internal/gateway/access/keys/${encodeURIComponent(args.accessKeyId)}/balances/adjust`,
    {
      method: "POST",
      body: {
        balanceMode: "message_prepaid",
        status: args.balanceStatus,
        totalMessages: args.totalMessages,
        remainingMessages: args.remainingMessages,
      },
    },
  );
}

function resolveProductGatewayGrant(product: typeof schema.products.$inferSelect): {
  bundleId: string;
  grantMode: GatewayAccessGrantMode;
  quantity: number;
} | null {
  const bundleId = product.gatewayAccessBundleId?.trim();
  if (!bundleId) {
    return null;
  }

  const grantMode = product.gatewayAccessGrantMode as GatewayAccessGrantMode | null;
  const quantity = product.gatewayAccessGrantQuantity ?? null;
  if (!grantMode || !quantity || quantity <= 0) {
    throw new BadRequestError("绑定 Bundle 的商品缺少 grantMode / grantQuantity 配置。");
  }

  return {
    bundleId,
    grantMode,
    quantity,
  };
}

async function listBundleGrantRowsInTx(
  tx: DbTx,
  args: { userId: string; bundleId: string; grantMode: GatewayAccessGrantMode },
) {
  return tx
    .select()
    .from(productGatewayAccessGrants)
    .where(
      and(
        eq(productGatewayAccessGrants.userId, args.userId),
        eq(productGatewayAccessGrants.bundleId, args.bundleId),
        eq(productGatewayAccessGrants.grantMode, args.grantMode),
      ),
    )
    .orderBy(
      asc(productGatewayAccessGrants.grantedAt),
      asc(productGatewayAccessGrants.createdAt),
      asc(productGatewayAccessGrants.id),
    );
}

async function recalculateTimePassGrantWindowsInTx(
  tx: DbTx,
  args: { userId: string; bundleId: string },
): Promise<GatewayAccessGrantProjection> {
  const rows = await listBundleGrantRowsInTx(tx, {
    userId: args.userId,
    bundleId: args.bundleId,
    grantMode: "time_pass",
  });

  const activeRows = rows.filter((row) => row.revokedAt === null);
  const timestamp = new Date();
  let cursor: Date | null = null;
  let firstStartsAt: Date | null = null;
  let lastEndsAt: Date | null = null;
  let totalQuantity = 0;

  for (const row of activeRows) {
    if (!row.durationDays || row.durationDays <= 0) {
      throw new BadRequestError("time_pass grant requires durationDays");
    }

    const startsAt =
      cursor && cursor.getTime() > row.grantedAt.getTime() ? new Date(cursor) : new Date(row.grantedAt);
    const endsAt = addDays(startsAt, row.durationDays);
    cursor = endsAt;
    firstStartsAt = firstStartsAt ?? startsAt;
    lastEndsAt = endsAt;
    totalQuantity += row.durationDays;

    await tx
      .update(productGatewayAccessGrants)
      .set({
        effectiveStartsAt: startsAt,
        effectiveEndsAt: endsAt,
        updatedAt: timestamp,
      })
      .where(eq(productGatewayAccessGrants.id, row.id));
  }

  return {
    userId: args.userId,
    bundleId: args.bundleId,
    grantMode: "time_pass",
    activeGrantCount: activeRows.length,
    periodStartsAt: firstStartsAt,
    periodEndsAt: lastEndsAt,
    balanceStatus: lastEndsAt && lastEndsAt.getTime() > timestamp.getTime() ? "active" : "expired",
    totalQuantity,
    remainingQuantity: null,
  };
}

async function recalculatePrepaidGrantTotalsInTx(
  tx: DbTx,
  args: {
    userId: string;
    bundleId: string;
    grantMode: Extract<GatewayAccessGrantMode, "token_prepaid" | "message_prepaid">;
  },
): Promise<GatewayAccessGrantProjection> {
  const rows = await listBundleGrantRowsInTx(tx, args);
  const activeRows = rows.filter((row) => row.revokedAt === null);
  const totalQuantity = activeRows.reduce((sum, row) => {
    const quantity = args.grantMode === "token_prepaid" ? row.tokenAmount : row.messageAmount;
    if (!quantity || quantity <= 0) {
      throw new BadRequestError(`${args.grantMode} grant requires positive quantity`);
    }
    return sum + quantity;
  }, 0);

  return {
    userId: args.userId,
    bundleId: args.bundleId,
    grantMode: args.grantMode,
    activeGrantCount: activeRows.length,
    periodStartsAt: null,
    periodEndsAt: null,
    balanceStatus: totalQuantity > 0 ? "active" : "expired",
    totalQuantity,
    remainingQuantity: totalQuantity,
  };
}

async function recalculateGrantProjectionInTx(
  tx: DbTx,
  args: { userId: string; bundleId: string; grantMode: GatewayAccessGrantMode },
) {
  if (args.grantMode === "time_pass") {
    return recalculateTimePassGrantWindowsInTx(tx, args);
  }

  return recalculatePrepaidGrantTotalsInTx(tx, {
    userId: args.userId,
    bundleId: args.bundleId,
    grantMode: args.grantMode,
  });
}

function deriveConsumedQuantity(total: number | null | undefined, remaining: number | null | undefined) {
  if (typeof total !== "number" || total <= 0) {
    return 0;
  }
  const safeRemaining = typeof remaining === "number" ? remaining : 0;
  return Math.max(total - safeRemaining, 0);
}

export async function createProductGatewayAccessGrantInTx(args: {
  tx: DbTx;
  itemId: string;
  orderId: string | null;
  userId: string;
  product: typeof schema.products.$inferSelect;
  grantedAt: Date;
}) {
  const resolvedGrant = resolveProductGatewayGrant(args.product);
  if (!resolvedGrant) {
    return null;
  }

  const timestamp = args.grantedAt;
  await args.tx.insert(productGatewayAccessGrants).values({
    id: crypto.randomUUID(),
    itemId: args.itemId,
    orderId: args.orderId,
    userId: args.userId,
    productId: args.product.id,
    bundleId: resolvedGrant.bundleId,
    grantMode: resolvedGrant.grantMode,
    durationDays: resolvedGrant.grantMode === "time_pass" ? resolvedGrant.quantity : null,
    tokenAmount: resolvedGrant.grantMode === "token_prepaid" ? resolvedGrant.quantity : null,
    messageAmount: resolvedGrant.grantMode === "message_prepaid" ? resolvedGrant.quantity : null,
    grantedAt: timestamp,
    effectiveStartsAt: timestamp,
    effectiveEndsAt:
      resolvedGrant.grantMode === "time_pass" ? addDays(timestamp, resolvedGrant.quantity) : null,
    revokedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await recalculateGrantProjectionInTx(args.tx, {
    userId: args.userId,
    bundleId: resolvedGrant.bundleId,
    grantMode: resolvedGrant.grantMode,
  });

  return {
    itemId: args.itemId,
    bundleId: resolvedGrant.bundleId,
    grantMode: resolvedGrant.grantMode,
    userId: args.userId,
  };
}

export async function revokeProductGatewayAccessGrantsInTx(args: {
  tx: DbTx;
  itemIds: string[];
  revokedAt: Date;
}) {
  if (args.itemIds.length === 0) {
    return [];
  }

  const affected = await args.tx
    .select()
    .from(productGatewayAccessGrants)
    .where(and(inArray(productGatewayAccessGrants.itemId, args.itemIds), isNull(productGatewayAccessGrants.revokedAt)));

  if (affected.length === 0) {
    return [];
  }

  await args.tx
    .update(productGatewayAccessGrants)
    .set({
      revokedAt: args.revokedAt,
      updatedAt: args.revokedAt,
    })
    .where(and(inArray(productGatewayAccessGrants.itemId, args.itemIds), isNull(productGatewayAccessGrants.revokedAt)));

  const affectedScopes = Array.from(
    new Set(affected.map((row) => `${row.userId}::${row.bundleId}::${row.grantMode}`)),
  ).map((scope) => {
    const [userId, bundleId, grantMode] = scope.split("::");
    return { userId, bundleId, grantMode: grantMode as GatewayAccessGrantMode };
  });

  for (const scope of affectedScopes) {
    await recalculateGrantProjectionInTx(args.tx, scope);
  }

  return affected.map((row) => row.itemId);
}

export async function syncProductGatewayAccessGrantByItem(itemId: string): Promise<GatewayAccessGrantSyncResult | null> {
  const [grant] = await db
    .select()
    .from(productGatewayAccessGrants)
    .where(eq(productGatewayAccessGrants.itemId, itemId))
    .limit(1);

  if (!grant) {
    return null;
  }

  const projection = await db.transaction((tx) =>
    recalculateGrantProjectionInTx(tx, {
      userId: grant.userId,
      bundleId: grant.bundleId,
      grantMode: grant.grantMode as GatewayAccessGrantMode,
    }),
  );
  const accessKey = await ensureGatewayBundleUserAccessKey({
    bundleId: grant.bundleId,
    userId: grant.userId,
  });

  if (projection.grantMode === "time_pass") {
    await adjustGatewayTimePassBalance({
      accessKeyId: accessKey.id,
      balanceStatus: projection.balanceStatus,
      periodStartsAt: projection.periodStartsAt,
      periodEndsAt: projection.periodEndsAt,
    });
  } else {
    const currentBalance = await getGatewayAccessKeyBalance(accessKey.id);
    if (projection.grantMode === "token_prepaid") {
      const consumedQuantity =
        currentBalance?.balanceMode === "token_prepaid"
          ? deriveConsumedQuantity(currentBalance.totalTokens, currentBalance.remainingTokens)
          : 0;
      const remainingQuantity = Math.max(projection.totalQuantity - consumedQuantity, 0);
      projection.remainingQuantity = remainingQuantity;
      await adjustGatewayTokenBalance({
        accessKeyId: accessKey.id,
        balanceStatus: projection.balanceStatus,
        totalTokens: projection.totalQuantity,
        remainingTokens: remainingQuantity,
      });
    } else {
      const consumedQuantity =
        currentBalance?.balanceMode === "message_prepaid"
          ? deriveConsumedQuantity(currentBalance.totalMessages, currentBalance.remainingMessages)
          : 0;
      const remainingQuantity = Math.max(projection.totalQuantity - consumedQuantity, 0);
      projection.remainingQuantity = remainingQuantity;
      await adjustGatewayMessageBalance({
        accessKeyId: accessKey.id,
        balanceStatus: projection.balanceStatus,
        totalMessages: projection.totalQuantity,
        remainingMessages: remainingQuantity,
      });
    }
  }

  return {
    itemId,
    userId: grant.userId,
    bundleId: grant.bundleId,
    grantMode: projection.grantMode,
    accessKeyId: accessKey.id,
    activeGrantCount: projection.activeGrantCount,
    balanceStatus: projection.balanceStatus,
    periodStartsAt: projection.periodStartsAt?.toISOString() ?? null,
    periodEndsAt: projection.periodEndsAt?.toISOString() ?? null,
    totalQuantity: projection.totalQuantity,
    remainingQuantity: projection.remainingQuantity,
  };
}
