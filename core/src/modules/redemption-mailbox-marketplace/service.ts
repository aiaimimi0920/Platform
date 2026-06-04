import type {
  CurrencyKey,
  MailboxAttachmentView,
  MailboxMessageView,
  MailboxSnapshot,
  MarketplaceListingView,
  ProductCurrency,
  RedeemResult,
  RedemptionCodeUsageView,
  RedemptionCodeView,
  RedemptionEligibility,
  RedemptionRewardEntry,
  UpsertRedemptionCodeInput,
} from "@neuro/contracts";
import { grantBalance, transferBalance } from "@neuro/account-domain";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { users } from "@/modules/identity/schema";
import { items, products } from "@/modules/product-order-item/schema";
import { grantItemDirect, markItemListed, releaseListedItem, transferMarketplaceItem } from "@/modules/product-order-item/service";
import {
  countMailboxMessages,
  countUnreadMailboxMessages,
  countPendingMailboxAttachments,
  getMarketplaceListingById,
  getMailboxAttachmentsByMessageIds,
  getMailboxMessagesByUser,
  getRedemptionCodeByCode,
  listActiveMarketplaceListings,
} from "@/modules/redemption-mailbox-marketplace/repository";
import { mailboxAttachments, mailboxMessages, marketplaceListings, redemptionCodes, redemptionCodeUsages } from "@/modules/redemption-mailbox-marketplace/schema";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

function now() {
  return new Date();
}

function buildMailboxSummary(body: string, fallbackTitle: string) {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length > 0) {
    return normalized.length > 96 ? `${normalized.slice(0, 93)}...` : normalized;
  }
  return fallbackTitle;
}

function buildMailboxSourceLabel(type: MailboxMessageView["type"]) {
  switch (type) {
    case "reward":
      return "Reward Delivery";
    case "compensation":
      return "Compensation";
    case "system":
    default:
      return "System Mail";
  }
}

function toMarketplaceListingView(listing: typeof marketplaceListings.$inferSelect): MarketplaceListingView {
  return {
    id: listing.id,
    itemId: listing.itemId,
    sellerUserId: listing.sellerUserId,
    productTitle: listing.productTitle,
    currency: listing.currency as ProductCurrency,
    price: listing.price,
    status: listing.status as MarketplaceListingView["status"],
    createdAt: listing.createdAt.toISOString(),
  };
}

function toMailboxAttachmentView(attachment: typeof mailboxAttachments.$inferSelect): MailboxAttachmentView {
  return {
    id: attachment.id,
    kind: attachment.kind as MailboxAttachmentView["kind"],
    currency: attachment.currency as CurrencyKey | null,
    amount: attachment.amount,
    productId: attachment.productId,
    itemId: attachment.itemId,
    title: null,
    claimedAt: attachment.claimedAt ? attachment.claimedAt.toISOString() : null,
  };
}

// ─── Seed codes (called once on startup, not per-request) ───

async function ensureSeedRedemptionCodes() {
  const createdAt = now();
  const seedValues = [
    {
      id: "redeem_welcome_obs_20",
      code: "WELCOME-OBS-20",
      active: true,
      rewardKind: "walletGrant",
      currency: "obsidian",
      amount: 20,
      productId: null,
      maxUses: 10000,
      usedCount: 0,
      expiresAt: null,
      exclusionGroup: "welcome_pack",
      rewards: JSON.stringify([{ kind: "walletGrant", currency: "obsidian", amount: 20 }]),
      description: "新手欢迎礼包 - 黑曜石",
      createdAt,
    },
    {
      id: "redeem_welcome_vip",
      code: "WELCOME-VIP",
      active: true,
      rewardKind: "itemGrant",
      currency: null,
      amount: null,
      productId: "product_vip_30",
      maxUses: 10000,
      usedCount: 0,
      expiresAt: null,
      exclusionGroup: "welcome_pack",
      rewards: JSON.stringify([{ kind: "itemGrant", productId: "product_vip_30" }]),
      description: "新手欢迎礼包 - VIP",
      createdAt,
    },
  ] as const;

  for (const seed of seedValues) {
    await db.insert(redemptionCodes).values(seed).onConflictDoNothing({ target: redemptionCodes.id });
  }
}

export { ensureSeedRedemptionCodes };

// ─── Rate limiting ───

const REDEEM_RATE_LIMIT_PREFIX = "redeem_rate:";
const REDEEM_RATE_LIMIT_MAX = 5;
const REDEEM_RATE_LIMIT_WINDOW_SECONDS = 60;

async function checkRedeemRateLimit(userId: string) {
  const key = `${REDEEM_RATE_LIMIT_PREFIX}${userId}`;
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, REDEEM_RATE_LIMIT_WINDOW_SECONDS);
  }
  if (current > REDEEM_RATE_LIMIT_MAX) {
    throw new Error("操作过于频繁，请稍后再试");
  }
}

// ─── Helpers ───

function parseRewards(row: typeof redemptionCodes.$inferSelect): RedemptionRewardEntry[] {
  if (row.rewards) {
    try {
      const parsed = (typeof row.rewards === "string" ? JSON.parse(row.rewards) : row.rewards) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as RedemptionRewardEntry[];
    } catch { /* fall through */ }
  }
  // Fallback to legacy fields
  if (row.rewardKind === "walletGrant" && row.currency && row.amount) {
    return [{ kind: "walletGrant", currency: row.currency, amount: row.amount }];
  }
  if (row.rewardKind === "itemGrant" && row.productId) {
    return [{ kind: "itemGrant", productId: row.productId }];
  }
  return [];
}

function parseEligibility(row: typeof redemptionCodes.$inferSelect): RedemptionEligibility | null {
  if (!row.eligibility) return null;
  try {
    const parsed = (typeof row.eligibility === "string" ? JSON.parse(row.eligibility) : row.eligibility) as RedemptionEligibility;
    if (parsed.minTrustLevel || parsed.userGroup || (parsed.userIds && parsed.userIds.length > 0)) return parsed;
    return null;
  } catch { return null; }
}

function mapRedemptionCodeView(row: typeof redemptionCodes.$inferSelect): RedemptionCodeView {
  return {
    id: row.id,
    code: row.code,
    active: row.active,
    exclusionGroup: row.exclusionGroup ?? null,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    eligibility: parseEligibility(row),
    rewards: parseRewards(row),
    rewardKind: row.rewardKind as "walletGrant" | "itemGrant",
    currency: row.currency,
    amount: row.amount,
    productId: row.productId,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    mailTitle: row.mailTitle ?? null,
    mailBody: row.mailBody ?? null,
    batchLabel: row.batchLabel ?? null,
    description: row.description ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

// ─── CRUD ───

export async function listRedemptionCodes(): Promise<RedemptionCodeView[]> {
  const rows = await db.select().from(redemptionCodes).orderBy(redemptionCodes.createdAt);
  return rows.map(mapRedemptionCodeView);
}

export async function upsertRedemptionCode(input: UpsertRedemptionCodeInput & { id?: string }): Promise<RedemptionCodeView> {
  const codeId = input.id || `redeem_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const createdAt = now();
  const firstReward = input.rewards[0];
  const legacyKind = firstReward?.kind ?? "walletGrant";
  const legacyCurrency = firstReward?.kind === "walletGrant" ? firstReward.currency : null;
  const legacyAmount = firstReward?.kind === "walletGrant" ? firstReward.amount : null;
  const legacyProductId = firstReward?.kind === "itemGrant" ? firstReward.productId : null;

  const [result] = await db
    .insert(redemptionCodes)
    .values({
      id: codeId,
      code: input.code,
      active: input.active,
      rewardKind: legacyKind,
      currency: legacyCurrency,
      amount: legacyAmount,
      productId: legacyProductId,
      maxUses: input.maxUses,
      usedCount: 0,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      exclusionGroup: input.exclusionGroup ?? null,
      eligibility: input.eligibility ? JSON.stringify(input.eligibility) : null,
      rewards: JSON.stringify(input.rewards),
      mailTitle: input.mailTitle ?? null,
      mailBody: input.mailBody ?? null,
      batchLabel: input.batchLabel ?? null,
      description: input.description ?? null,
      createdAt,
      updatedAt: createdAt,
    })
    .onConflictDoUpdate({
      target: redemptionCodes.id,
      set: {
        code: input.code,
        active: input.active,
        rewardKind: legacyKind,
        currency: legacyCurrency,
        amount: legacyAmount,
        productId: legacyProductId,
        maxUses: input.maxUses,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        exclusionGroup: input.exclusionGroup ?? null,
        eligibility: input.eligibility ? JSON.stringify(input.eligibility) : null,
        rewards: JSON.stringify(input.rewards),
        mailTitle: input.mailTitle ?? null,
        mailBody: input.mailBody ?? null,
        batchLabel: input.batchLabel ?? null,
        description: input.description ?? null,
        updatedAt: now(),
      },
    })
    .returning();

  return mapRedemptionCodeView(result);
}

export async function listRedemptionCodeUsages(codeId: string): Promise<RedemptionCodeUsageView[]> {
  const rows = await db
    .select({
      id: redemptionCodeUsages.id,
      redemptionCodeId: redemptionCodeUsages.redemptionCodeId,
      userId: redemptionCodeUsages.userId,
      username: users.username,
      createdAt: redemptionCodeUsages.createdAt,
    })
    .from(redemptionCodeUsages)
    .leftJoin(users, eq(redemptionCodeUsages.userId, users.id))
    .where(eq(redemptionCodeUsages.redemptionCodeId, codeId))
    .orderBy(redemptionCodeUsages.createdAt);

  return rows.map((row) => ({
    id: row.id,
    redemptionCodeId: row.redemptionCodeId,
    userId: row.userId,
    username: row.username ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function generateRedemptionCodeBatch(input: {
  count: number;
  codePrefix: string;
  template: Omit<UpsertRedemptionCodeInput, "code">;
}): Promise<RedemptionCodeView[]> {
  const batchSize = Math.min(Math.max(1, input.count), 500);
  const results: RedemptionCodeView[] = [];
  const prefix = input.codePrefix.toUpperCase().replace(/[^A-Z0-9-_]/g, "");

  for (let i = 1; i <= batchSize; i++) {
    const code = `${prefix}-${String(i).padStart(4, "0")}`;
    const result = await upsertRedemptionCode({
      ...input.template,
      code,
      batchLabel: input.template.batchLabel ?? prefix,
    });
    results.push(result);
  }

  return results;
}

// ─── Redeem logic (V2 with full validation chain) ───

export async function redeemCodeForUser(userId: string, code: string): Promise<RedeemResult> {
  // Rate limiting
  await checkRedeemRateLimit(userId);

  const redemptionCode = await getRedemptionCodeByCode(code);
  if (!redemptionCode || !redemptionCode.active) {
    throw new Error("兑换码不存在或已失效");
  }

  // Time window check
  const currentTime = now();
  if (redemptionCode.startsAt && redemptionCode.startsAt > currentTime) {
    throw new Error("兑换码尚未开放");
  }
  if (redemptionCode.expiresAt && redemptionCode.expiresAt < currentTime) {
    throw new Error("兑换码已过期");
  }

  // Eligibility check
  const eligibility = parseEligibility(redemptionCode);
  if (eligibility) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("用户不存在");

    if (eligibility.minTrustLevel != null && (user.trustLevel ?? 0) < eligibility.minTrustLevel) {
      throw new Error(`不满足兑换条件：需要信任等级 ${eligibility.minTrustLevel} 以上`);
    }
    if (eligibility.userIds && eligibility.userIds.length > 0 && !eligibility.userIds.includes(userId)) {
      throw new Error("不满足兑换条件：该码仅限指定用户使用");
    }
  }

  // Per-code usage check
  const [existingUsage] = await db
    .select()
    .from(redemptionCodeUsages)
    .where(and(eq(redemptionCodeUsages.redemptionCodeId, redemptionCode.id), eq(redemptionCodeUsages.userId, userId)));
  if (existingUsage) {
    throw new Error("该兑换码已被使用");
  }

  // Exclusion group check
  if (redemptionCode.exclusionGroup) {
    const [groupUsage] = await db
      .select({ id: redemptionCodeUsages.id })
      .from(redemptionCodeUsages)
      .innerJoin(redemptionCodes, eq(redemptionCodeUsages.redemptionCodeId, redemptionCodes.id))
      .where(
        and(
          eq(redemptionCodes.exclusionGroup, redemptionCode.exclusionGroup),
          eq(redemptionCodeUsages.userId, userId),
        ),
      )
      .limit(1);

    if (groupUsage) {
      throw new Error("同组兑换码已使用，每组只能兑换一个");
    }
  }

  // Max uses check
  if (redemptionCode.usedCount >= redemptionCode.maxUses) {
    throw new Error("兑换码使用次数已达上限");
  }

  // Resolve rewards
  const rewards = parseRewards(redemptionCode);
  if (rewards.length === 0) {
    throw new Error("兑换码奖励配置不完整");
  }

  return db.transaction(async (tx) => {
    await tx.insert(redemptionCodeUsages).values({
      id: crypto.randomUUID(),
      redemptionCodeId: redemptionCode.id,
      userId,
      createdAt: now(),
    });

    await tx
      .update(redemptionCodes)
      .set({ usedCount: redemptionCode.usedCount + 1 })
      .where(eq(redemptionCodes.id, redemptionCode.id));

    // Grant all rewards
    const messages: string[] = [];
    for (const reward of rewards) {
      if (reward.kind === "walletGrant") {
        await grantBalance(
          userId,
          reward.currency as CurrencyKey,
          reward.amount,
          `兑换码发放：${redemptionCode.code}`,
          "redemptionCode",
          redemptionCode.id,
          tx,
        );
        messages.push(`${reward.amount} ${reward.currency}`);
      } else if (reward.kind === "itemGrant") {
        await grantItemDirect(userId, reward.productId, tx);
        messages.push("物品已发放到资产中");
      }
    }

    const outcome: RedeemResult["outcome"] = rewards.some((r) => r.kind === "itemGrant") ? "itemGrant" : "walletGrant";

    await enqueueOutboxEvent(
      "redemption.used",
      {
        userId,
        redemptionCodeId: redemptionCode.id,
        mailTitle: redemptionCode.mailTitle ?? null,
        mailBody: redemptionCode.mailBody ?? null,
      },
      tx,
    );

    return {
      code: redemptionCode.code,
      outcome,
      message: `已发放：${messages.join("、")}`,
    };
  });
}

export async function createMailboxMessage(args: {
  userId: string;
  title: string;
  body: string;
  type: "system" | "reward" | "compensation";
  attachments?: Array<
    | { kind: "currency"; currency: CurrencyKey; amount: number }
    | { kind: "item"; productId: string }
  >;
}) {
  return db.transaction(async (tx) => {
    const messageId = crypto.randomUUID();
    await tx.insert(mailboxMessages).values({
      id: messageId,
      userId: args.userId,
      title: args.title,
      body: args.body,
      type: args.type,
      readAt: null,
      expiresAt: null,
      createdAt: now(),
    });

    for (const attachment of args.attachments ?? []) {
      await tx.insert(mailboxAttachments).values({
        id: crypto.randomUUID(),
        messageId,
        kind: attachment.kind,
        currency: attachment.kind === "currency" ? attachment.currency : null,
        amount: attachment.kind === "currency" ? attachment.amount : null,
        productId: attachment.kind === "item" ? attachment.productId : null,
        itemId: null,
        claimedAt: null,
      });
    }

    await enqueueOutboxEvent(
      "mail.sent",
      {
        userId: args.userId,
        messageId,
      },
      tx,
    );
  });
}

export async function listMailbox(userId: string): Promise<MailboxMessageView[]> {
  const messages = await getMailboxMessagesByUser(userId);
  const attachments = await getMailboxAttachmentsByMessageIds(messages.map((message) => message.id));
  const attachmentsByMessage = new Map<string, MailboxAttachmentView[]>();

  for (const attachment of attachments) {
    const list = attachmentsByMessage.get(attachment.messageId) || [];
    list.push(toMailboxAttachmentView(attachment));
    attachmentsByMessage.set(attachment.messageId, list);
  }

  return messages.map((message) => ({
    id: message.id,
    folder: "inbox",
    title: message.title,
    summary: buildMailboxSummary(message.body, message.title),
    body: message.body,
    sourceLabel: buildMailboxSourceLabel(message.type as MailboxMessageView["type"]),
    type: message.type as MailboxMessageView["type"],
    readAt: message.readAt ? message.readAt.toISOString() : null,
    favoritedAt: null,
    expiresAt: message.expiresAt ? message.expiresAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
    attachments: attachmentsByMessage.get(message.id) || [],
    pendingAttachmentCount: (attachmentsByMessage.get(message.id) || []).filter((attachment) => attachment.claimedAt === null).length,
    claimedAttachmentCount: (attachmentsByMessage.get(message.id) || []).filter((attachment) => attachment.claimedAt !== null).length,
  }));
}

export async function getMailboxSnapshot(userId: string): Promise<MailboxSnapshot> {
  const [totalMessages, unreadMessages, pendingAttachments] = await Promise.all([
    countMailboxMessages(userId),
    countUnreadMailboxMessages(userId),
    countPendingMailboxAttachments(userId),
  ]);
  return {
    totalMessages,
    unreadMessages,
    pendingAttachments,
  };
}

export async function claimAttachment(userId: string, messageId: string, attachmentId: string) {
  const [message] = await db
    .select()
    .from(mailboxMessages)
    .where(and(eq(mailboxMessages.id, messageId), eq(mailboxMessages.userId, userId)));
  if (!message) {
    throw new Error("邮件不存在");
  }

  const [attachment] = await db
    .select()
    .from(mailboxAttachments)
    .where(and(eq(mailboxAttachments.id, attachmentId), eq(mailboxAttachments.messageId, messageId)));
  if (!attachment) {
    throw new Error("附件不存在");
  }
  if (attachment.claimedAt) {
    throw new Error("附件已领取");
  }

  return db.transaction(async (tx) => {
    if (attachment.kind === "currency" && attachment.currency && attachment.amount) {
      await grantBalance(
        userId,
        attachment.currency as CurrencyKey,
        attachment.amount,
        `站内邮箱领取：${message.title}`,
        "mailboxAttachment",
        attachment.id,
        tx,
      );
    } else if (attachment.kind === "item" && attachment.productId) {
      await grantItemDirect(userId, attachment.productId, tx);
    } else {
      throw new Error("附件配置不完整");
    }

    const claimedAt = now();
    const [updatedAttachment] = await tx
      .update(mailboxAttachments)
      .set({ claimedAt })
      .where(eq(mailboxAttachments.id, attachment.id))
      .returning();

    if (!message.readAt) {
      await tx.update(mailboxMessages).set({ readAt: claimedAt }).where(eq(mailboxMessages.id, message.id));
    }

    await enqueueOutboxEvent(
      "mail.claimed",
      {
        userId,
        messageId,
        attachmentId,
      },
      tx,
    );

    return toMailboxAttachmentView(updatedAttachment);
  });
}

export async function listMarketplace(): Promise<MarketplaceListingView[]> {
  const listings = await listActiveMarketplaceListings();
  return listings.map(toMarketplaceListingView);
}

export async function createMarketplaceListingForUser(
  userId: string,
  itemId: string,
  price: number,
  currency?: ProductCurrency,
): Promise<MarketplaceListingView> {
  return db.transaction(async (tx) => {
    const item = await markItemListed({
      tx,
      itemId,
      ownerUserId: userId,
    });

    const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
    if (!product) {
      throw new Error("商品不存在");
    }

      const [listing] = await tx
        .insert(marketplaceListings)
        .values({
          id: crypto.randomUUID(),
          itemId: item.id,
          sellerUserId: userId,
          productTitle: item.productTitle,
          currency: currency ?? product.currency,
          price,
          status: "active",
          createdAt: now(),
        })
      .returning();

    return toMarketplaceListingView(listing);
  });
}

export async function purchaseMarketplaceListingForUser(userId: string, listingId: string): Promise<MarketplaceListingView> {
  const listing = await getMarketplaceListingById(listingId);
  if (!listing || listing.status !== "active") {
    throw new Error("挂牌不存在或已失效");
  }
  if (listing.sellerUserId === userId) {
    throw new Error("不能购买自己的挂牌");
  }

  return db.transaction(async (tx) => {
    await transferBalance({
      fromUserId: userId,
      toUserId: listing.sellerUserId,
      currency: listing.currency as CurrencyKey,
      amount: listing.price,
      note: `集市购买：${listing.productTitle}`,
      referenceType: "marketplaceListing",
      referenceId: listing.id,
      tx,
    });

    await transferMarketplaceItem({
      tx,
      itemId: listing.itemId,
      expectedSellerUserId: listing.sellerUserId,
      buyerUserId: userId,
    });

    const [updated] = await tx
      .update(marketplaceListings)
      .set({ status: "sold" })
      .where(eq(marketplaceListings.id, listing.id))
      .returning();

    return toMarketplaceListingView(updated);
  });
}

export async function cancelMarketplaceListingForUser(userId: string, listingId: string): Promise<MarketplaceListingView> {
  const listing = await getMarketplaceListingById(listingId);
  if (!listing || listing.status !== "active") {
    throw new Error("挂牌不存在或已失效");
  }
  if (listing.sellerUserId !== userId) {
    throw new Error("只有卖家可以取消挂牌");
  }

  return db.transaction(async (tx) => {
    await releaseListedItem({
      tx,
      itemId: listing.itemId,
      ownerUserId: userId,
    });
    const [updated] = await tx
      .update(marketplaceListings)
      .set({ status: "cancelled" })
      .where(eq(marketplaceListings.id, listing.id))
      .returning();
    return toMarketplaceListingView(updated);
  });
}
