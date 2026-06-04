import {
  currencyKeys,
  type FeatureSnapshot,
  type LinuxDoUpsertInput,
  type PublicUserProfile,
  type UserSummary,
  type UserWalletSnapshot,
} from "@neuro/contracts";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { authIdentities, users } from "@/modules/identity/schema";
import { getUserProgressionSnapshot } from "@/modules/user-progression/service";
import { getCorePlatformSummary } from "@/platform/core-integration/service";
import { getFeatureSnapshot } from "@/platform/feature-modules/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

type DbTx = NodePgDatabase<typeof schema>;

function mapWalletSnapshot(
  accounts: Array<Pick<typeof schema.ledgerAccounts.$inferSelect, "currency" | "availableBalance" | "frozenBalance">>,
  recentEntryCount: number,
): UserWalletSnapshot {
  const balances = Object.fromEntries(
    currencyKeys.map((currency) => [currency, { available: 0, frozen: 0 }]),
  ) as UserWalletSnapshot["balances"];

  for (const account of accounts) {
    if (!(account.currency in balances)) continue;
    balances[account.currency as keyof typeof balances] = {
      available: account.availableBalance,
      frozen: account.frozenBalance,
    };
  }

  return {
    balances,
    recentEntryCount,
  };
}

async function loadUserSnapshot(
  user: Pick<typeof users.$inferSelect, "id" | "trustLevel">,
  tx: DbTx = db,
  features?: FeatureSnapshot | null,
) {
  const platformSummary = env.usesDedicatedDatabase ? await getCorePlatformSummary(user.id) : null;
  const sharedPlatformSnapshot = env.usesDedicatedDatabase
    ? null
    : await Promise.all([
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.agents)
          .where(eq(schema.agents.ownerUserId, user.id)),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.agents)
          .where(and(eq(schema.agents.ownerUserId, user.id), eq(schema.agents.enabled, true))),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.agents)
          .where(and(eq(schema.agents.ownerUserId, user.id), eq(schema.agents.sourceType, "external"))),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.agentCapabilities)
          .innerJoin(schema.agents, eq(schema.agentCapabilities.agentId, schema.agents.id))
          .where(eq(schema.agents.ownerUserId, user.id)),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.agentExecutions)
          .where(
            and(
              eq(schema.agentExecutions.ownerUserId, user.id),
              inArray(schema.agentExecutions.status, ["queued", "running", "submitted"]),
            ),
          ),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.items)
          .where(eq(schema.items.userId, user.id)),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.items)
          .where(and(eq(schema.items.userId, user.id), eq(schema.items.status, "active"))),
        tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.items)
          .where(and(eq(schema.items.userId, user.id), eq(schema.items.status, "listed"))),
      ]);
  const [walletAccounts, recentEntryRow, mailboxMessageRow, unreadMailboxMessageRow, pendingAttachmentRow] =
    await Promise.all([
    tx.query.ledgerAccounts.findMany({
      where: (row, operators) => operators.eq(row.userId, user.id),
      columns: {
        currency: true,
        availableBalance: true,
        frozenBalance: true,
      },
    }),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.userId, user.id)),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.mailboxMessages)
      .where(and(eq(schema.mailboxMessages.userId, user.id), eq(schema.mailboxMessages.folder, "inbox"))),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.mailboxMessages)
      .where(
        and(
          eq(schema.mailboxMessages.userId, user.id),
          eq(schema.mailboxMessages.folder, "inbox"),
          isNull(schema.mailboxMessages.readAt),
        ),
      ),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.mailboxAttachments)
      .innerJoin(schema.mailboxMessages, eq(schema.mailboxAttachments.messageId, schema.mailboxMessages.id))
      .where(
        and(
          eq(schema.mailboxMessages.userId, user.id),
          eq(schema.mailboxMessages.folder, "inbox"),
          isNull(schema.mailboxAttachments.claimedAt),
        ),
      ),
  ]);

  const walletEnabled = !features || (features.wallet.enabled && features.ledger.enabled);
  const mailboxEnabled = !features || features.mailbox.enabled;
  const agentEnabled = !features || features.agentRegistry.enabled;
  const assetEnabled = !features || features.item.enabled;
  const progressionEnabled = !features || features.userProgression.enabled;

  return {
    wallet: walletEnabled ? mapWalletSnapshot(walletAccounts, recentEntryRow[0]?.count ?? 0) : null,
    mailbox: mailboxEnabled
      ? {
          totalMessages: mailboxMessageRow[0]?.count ?? 0,
          unreadMessages: unreadMailboxMessageRow[0]?.count ?? 0,
          pendingAttachments: pendingAttachmentRow[0]?.count ?? 0,
        }
      : null,
    agents: agentEnabled
      ? env.usesDedicatedDatabase
        ? platformSummary?.agents ?? null
        : {
            totalAgents: sharedPlatformSnapshot?.[0][0]?.count ?? 0,
            enabledAgents: sharedPlatformSnapshot?.[1][0]?.count ?? 0,
            externalAgents: sharedPlatformSnapshot?.[2][0]?.count ?? 0,
            capabilityCount: sharedPlatformSnapshot?.[3][0]?.count ?? 0,
            activeExecutions: sharedPlatformSnapshot?.[4][0]?.count ?? 0,
          }
      : null,
    assets: assetEnabled
      ? env.usesDedicatedDatabase
        ? platformSummary?.assets ?? null
        : {
            totalItems: sharedPlatformSnapshot?.[5][0]?.count ?? 0,
            activeItems: sharedPlatformSnapshot?.[6][0]?.count ?? 0,
            listedItems: sharedPlatformSnapshot?.[7][0]?.count ?? 0,
          }
      : null,
    progression: progressionEnabled
      ? await getUserProgressionSnapshot(
          {
            userId: user.id,
            trustLevel: user.trustLevel,
          },
          tx,
          platformSummary?.progressionMetrics ?? null,
        )
      : null,
  };
}

async function mapUserSummary(args: {
  tx?: DbTx;
  user: typeof users.$inferSelect;
  providerUserId: string;
  features?: FeatureSnapshot | null;
}): Promise<UserSummary> {
  return {
    id: args.user.id,
    provider: "linuxdo",
    providerUserId: args.providerUserId,
    username: args.user.username,
    email: args.user.email,
    avatarUrl: args.user.avatarUrl,
    profileTagline: args.user.profileTagline,
    honorShowcasedAgentIds: parseStoredShowcasedIds(args.user.honorShowcasedAgentIds),
    honorShowcasedProjectIds: parseStoredShowcasedIds(args.user.honorShowcasedProjectIds),
    honorShowcasedInvestmentProjectIds: parseStoredShowcasedIds(args.user.honorShowcasedInvestmentProjectIds),
    honorShowcasedIssueIds: parseStoredShowcasedIds(args.user.honorShowcasedIssueIds),
    honorShowcasedInvestmentIssueIds: parseStoredShowcasedIds(args.user.honorShowcasedInvestmentIssueIds),
    trustLevel: args.user.trustLevel,
    createdAt: args.user.createdAt.toISOString(),
    updatedAt: args.user.updatedAt.toISOString(),
    lastLoginAt: args.user.lastLoginAt.toISOString(),
    snapshot: await loadUserSnapshot(args.user, args.tx ?? db, args.features),
  };
}

function normalizeProfileTagline(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 80);
}

function parseStoredShowcasedIds(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const normalized = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return normalized.length > 0 ? normalized.slice(0, 4) : null;
  } catch {
    return null;
  }
}

function normalizeStoredShowcasedIds(value: string[] | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const seen = new Set<string>();
  const normalized = value
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    })
    .slice(0, 4);

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

function safeUsername(profile: LinuxDoUpsertInput): string {
  return profile.username || profile.name || `linuxdo_${profile.id}`;
}

function buildShadowUsername(userId: string) {
  const normalized = userId.trim();
  if (!normalized) {
    return "account_user";
  }
  return normalized.length <= 40 ? normalized : normalized.slice(0, 40);
}

export async function ensureInternalUser(userId: string, tx: DbTx = db) {
  const [existingUser] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existingUser) {
    return existingUser;
  }

  const currentTime = new Date();
  const [createdUser] = await tx
    .insert(users)
      .values({
        id: userId,
        username: buildShadowUsername(userId),
        email: null,
        avatarUrl: null,
        profileTagline: null,
        honorShowcasedAgentIds: null,
        honorShowcasedProjectIds: null,
        honorShowcasedInvestmentProjectIds: null,
        honorShowcasedIssueIds: null,
        honorShowcasedInvestmentIssueIds: null,
        trustLevel: null,
        createdAt: currentTime,
        updatedAt: currentTime,
        lastLoginAt: currentTime,
      })
    .returning();

  return createdUser;
}

export async function upsertLinuxDoUser(profile: LinuxDoUpsertInput): Promise<UserSummary> {
  const persisted = await db.transaction(async (tx) => {
    const currentTime = new Date();
    const providerUserId = String(profile.id);
    const [existingIdentity] = await tx
      .select({
        identity: authIdentities,
        user: users,
      })
      .from(authIdentities)
      .innerJoin(users, eq(authIdentities.userId, users.id))
      .where(and(eq(authIdentities.provider, "linuxdo"), eq(authIdentities.providerUserId, providerUserId)));

    if (existingIdentity) {
      const [updatedUser] = await tx
        .update(users)
        .set({
          username: safeUsername(profile),
          email: profile.email || existingIdentity.user.email,
          avatarUrl: profile.avatar_url || existingIdentity.user.avatarUrl,
          profileTagline: existingIdentity.user.profileTagline,
          honorShowcasedAgentIds: existingIdentity.user.honorShowcasedAgentIds,
          honorShowcasedProjectIds: existingIdentity.user.honorShowcasedProjectIds,
          honorShowcasedInvestmentProjectIds: existingIdentity.user.honorShowcasedInvestmentProjectIds,
          honorShowcasedIssueIds: existingIdentity.user.honorShowcasedIssueIds,
          honorShowcasedInvestmentIssueIds: existingIdentity.user.honorShowcasedInvestmentIssueIds,
          trustLevel: profile.trust_level ?? existingIdentity.user.trustLevel,
          updatedAt: currentTime,
          lastLoginAt: currentTime,
        })
        .where(eq(users.id, existingIdentity.user.id))
        .returning();

      await tx
        .update(authIdentities)
        .set({
          email: profile.email || existingIdentity.identity.email,
          updatedAt: currentTime,
        })
        .where(and(eq(authIdentities.provider, "linuxdo"), eq(authIdentities.providerUserId, providerUserId)));

      return {
        user: updatedUser,
        providerUserId,
      };
    }

    const userId = crypto.randomUUID();
    const [createdUser] = await tx
      .insert(users)
      .values({
        id: userId,
        username: safeUsername(profile),
        email: profile.email || null,
        avatarUrl: profile.avatar_url || null,
        profileTagline: null,
        honorShowcasedAgentIds: null,
        honorShowcasedProjectIds: null,
        honorShowcasedInvestmentProjectIds: null,
        honorShowcasedIssueIds: null,
        honorShowcasedInvestmentIssueIds: null,
        trustLevel: profile.trust_level ?? null,
        createdAt: currentTime,
        updatedAt: currentTime,
        lastLoginAt: currentTime,
      })
      .returning();

    await tx.insert(authIdentities).values({
      id: crypto.randomUUID(),
      userId,
      provider: "linuxdo",
      providerUserId,
      email: profile.email || null,
      createdAt: currentTime,
      updatedAt: currentTime,
    });

    await enqueueOutboxEvent(
      "user.registered",
      {
        userId,
        provider: "linuxdo",
      },
      tx,
    );

    return {
      user: createdUser,
      providerUserId,
    };
  });

  return mapUserSummary({
    user: persisted.user,
    providerUserId: persisted.providerUserId,
  });
}

export async function getUserSummary(userId: string, features?: FeatureSnapshot | null): Promise<UserSummary | null> {
  const [row] = await db
    .select({
      identity: authIdentities,
      user: users,
    })
    .from(authIdentities)
    .innerJoin(users, eq(authIdentities.userId, users.id))
    .where(and(eq(authIdentities.provider, "linuxdo"), eq(authIdentities.userId, userId)));

  if (!row) return null;

  return mapUserSummary({
    user: row.user,
    providerUserId: row.identity.providerUserId,
    features,
  });
}

export async function getPublicUserProfile(username: string): Promise<PublicUserProfile | null> {
  const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!row) return null;

  let reputation: PublicUserProfile["reputation"] = null;
  try {
    const { getReputationSummary } = await import("@/modules/reputation/service");
    const repSummary = await getReputationSummary(row.id);
    reputation = {
      score: repSummary.reputationScore,
      tier: repSummary.tier,
      completionRate: repSummary.completionRate,
    };
  } catch {
    // reputation module may be disabled
  }

  let progression: PublicUserProfile["progression"] = null;
  try {
    const snapshot = await getUserProgressionSnapshot(
      { userId: row.id, trustLevel: row.trustLevel },
      db,
      null,
    );
    if (snapshot) {
      progression = {
        level: snapshot.level,
        experience: snapshot.experience,
        nextLevelExperience: snapshot.nextLevelExperience,
      };
    }
  } catch {
    // progression module may be disabled
  }

  return {
    username: row.username,
    avatarUrl: row.avatarUrl,
    profileTagline: row.profileTagline,
    trustLevel: row.trustLevel,
    createdAt: row.createdAt.toISOString(),
    reputation,
    progression,
    showcasedAgentIds: parseStoredShowcasedIds(row.honorShowcasedAgentIds),
    showcasedProjectIds: parseStoredShowcasedIds(row.honorShowcasedProjectIds),
    showcasedIssueIds: parseStoredShowcasedIds(row.honorShowcasedIssueIds),
  };
}

export async function updateUserProfile(
  userId: string,
  input: {
    profileTagline?: string | null;
    honorShowcasedAgentIds?: string[] | null;
    honorShowcasedProjectIds?: string[] | null;
    honorShowcasedInvestmentProjectIds?: string[] | null;
    honorShowcasedIssueIds?: string[] | null;
    honorShowcasedInvestmentIssueIds?: string[] | null;
  },
) {
  const currentTime = new Date();
  const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!existingUser) {
    return null;
  }

  const normalizedTagline =
    input.profileTagline === undefined ? existingUser.profileTagline : normalizeProfileTagline(input.profileTagline);
  const normalizedShowcasedAgentIds =
    input.honorShowcasedAgentIds === undefined
      ? existingUser.honorShowcasedAgentIds
      : normalizeStoredShowcasedIds(input.honorShowcasedAgentIds);
  const normalizedShowcasedProjectIds =
    input.honorShowcasedProjectIds === undefined
      ? existingUser.honorShowcasedProjectIds
      : normalizeStoredShowcasedIds(input.honorShowcasedProjectIds);
  const normalizedShowcasedInvestmentProjectIds =
    input.honorShowcasedInvestmentProjectIds === undefined
      ? existingUser.honorShowcasedInvestmentProjectIds
      : normalizeStoredShowcasedIds(input.honorShowcasedInvestmentProjectIds);
  const normalizedShowcasedIssueIds =
    input.honorShowcasedIssueIds === undefined
      ? existingUser.honorShowcasedIssueIds
      : normalizeStoredShowcasedIds(input.honorShowcasedIssueIds);
  const normalizedShowcasedInvestmentIssueIds =
    input.honorShowcasedInvestmentIssueIds === undefined
      ? existingUser.honorShowcasedInvestmentIssueIds
      : normalizeStoredShowcasedIds(input.honorShowcasedInvestmentIssueIds);

  const [row] = await db
    .update(users)
    .set({
      profileTagline: normalizedTagline,
      honorShowcasedAgentIds: normalizedShowcasedAgentIds,
      honorShowcasedProjectIds: normalizedShowcasedProjectIds,
      honorShowcasedInvestmentProjectIds: normalizedShowcasedInvestmentProjectIds,
      honorShowcasedIssueIds: normalizedShowcasedIssueIds,
      honorShowcasedInvestmentIssueIds: normalizedShowcasedInvestmentIssueIds,
      updatedAt: currentTime,
    })
    .where(eq(users.id, userId))
    .returning();

  if (!row) {
    return null;
  }

  const [identity] = await db
    .select()
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, "linuxdo"), eq(authIdentities.userId, userId)))
    .limit(1);

  if (!identity) {
    return null;
  }

  const features = await getFeatureSnapshot();
  return mapUserSummary({
    user: row,
    providerUserId: identity.providerUserId,
    features,
  });
}
