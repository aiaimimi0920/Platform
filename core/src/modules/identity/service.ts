import {
  currencyKeys,
  type FeatureSnapshot,
  type LinuxDoUpsertInput,
  type UserSummary,
  type UserWalletSnapshot,
} from "@neuro/contracts";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getUserProgressionSnapshot } from "../../../../packages/account-domain/dist/modules/user-progression/service.js";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { authIdentities, users } from "@/modules/identity/schema";
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
  const walletAccounts = await tx.query.ledgerAccounts.findMany({
    where: (row, operators) => operators.eq(row.userId, user.id),
    columns: {
      currency: true,
      availableBalance: true,
      frozenBalance: true,
    },
  });
  const recentEntryRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.userId, user.id));
  const mailboxMessageRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.mailboxMessages)
    .where(eq(schema.mailboxMessages.userId, user.id));
  const unreadMailboxMessageRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.mailboxMessages)
    .where(and(eq(schema.mailboxMessages.userId, user.id), isNull(schema.mailboxMessages.readAt)));
  const pendingAttachmentRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.mailboxAttachments)
    .innerJoin(schema.mailboxMessages, eq(schema.mailboxAttachments.messageId, schema.mailboxMessages.id))
    .where(and(eq(schema.mailboxMessages.userId, user.id), isNull(schema.mailboxAttachments.claimedAt)));
  const totalAgentRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.agents)
    .where(eq(schema.agents.ownerUserId, user.id));
  const enabledAgentRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.agents)
    .where(and(eq(schema.agents.ownerUserId, user.id), eq(schema.agents.enabled, true)));
  const externalAgentRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.agents)
    .where(and(eq(schema.agents.ownerUserId, user.id), eq(schema.agents.sourceType, "external")));
  const capabilityRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.agentCapabilities)
    .innerJoin(schema.agents, eq(schema.agentCapabilities.agentId, schema.agents.id))
    .where(eq(schema.agents.ownerUserId, user.id));
  const activeExecutionRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.agentExecutions)
    .where(
      and(
        eq(schema.agentExecutions.ownerUserId, user.id),
        inArray(schema.agentExecutions.status, ["queued", "running", "submitted"]),
      ),
    );
  const totalItemRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.items)
    .where(eq(schema.items.userId, user.id));
  const activeItemRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.items)
    .where(and(eq(schema.items.userId, user.id), eq(schema.items.status, "active")));
  const listedItemRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.items)
    .where(and(eq(schema.items.userId, user.id), eq(schema.items.status, "listed")));

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
      ? {
          totalAgents: totalAgentRow[0]?.count ?? 0,
          enabledAgents: enabledAgentRow[0]?.count ?? 0,
          externalAgents: externalAgentRow[0]?.count ?? 0,
          capabilityCount: capabilityRow[0]?.count ?? 0,
          activeExecutions: activeExecutionRow[0]?.count ?? 0,
        }
      : null,
    assets: assetEnabled
      ? {
          totalItems: totalItemRow[0]?.count ?? 0,
          activeItems: activeItemRow[0]?.count ?? 0,
          listedItems: listedItemRow[0]?.count ?? 0,
        }
      : null,
    progression: progressionEnabled
      ? await getUserProgressionSnapshot(
          {
            userId: user.id,
            trustLevel: user.trustLevel,
          },
          tx,
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

function safeUsername(profile: LinuxDoUpsertInput): string {
  return profile.username || profile.name || `linuxdo_${profile.id}`;
}

export async function upsertLinuxDoUser(profile: LinuxDoUpsertInput): Promise<UserSummary> {
  return db.transaction(async (tx) => {
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

      return mapUserSummary({ tx, user: updatedUser, providerUserId });
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

    return mapUserSummary({ tx, user: createdUser, providerUserId });
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
