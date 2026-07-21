import type {
  ArchiveReadMailboxMessagesResult,
  ClaimAllMailboxAttachmentsResult,
  ClaimMailboxAttachmentInput,
  ClaimMailboxMessageAttachmentsResult,
  CurrencyKey,
  DeleteMailboxMessageResult,
  MailboxAttachmentView,
  MailboxFolderKey,
  MailboxMessageView,
  MailboxSnapshot,
  SetMailboxMessageFavoriteResult,
} from "@neuro/contracts";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import { mailboxAttachments, mailboxMessages } from "@/modules/mailbox/schema";
import { itemUnits, items, products } from "@/modules/product-order-item/schema";
import { ensureProductSnapshotInTx } from "@/modules/product-order-item/service";
import { grantBalance } from "@/modules/wallet-ledger/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
import { BadRequestError, ConflictError, NotFoundError } from "@/platform/errors";

import { normalizeMailboxFolder, normalizeMailboxText, now } from "../common";
import {
  countMailboxMessages,
  countPendingMailboxAttachments,
  countUnreadMailboxMessages,
  getMailboxAttachmentsByMessageIds,
  getMailboxMessageByUserAndId,
  getMailboxMessagesByUser,
} from "../repository/player";
import {
  mailboxIdempotentPayloadMatches,
  normalizeMailboxIdempotencyKey,
} from "./idempotency";

const MAILBOX_INBOX_STORAGE_LIMIT = 200;

type DbTx = NodePgDatabase<any> | any;

function buildMailboxSummary(body: string, fallbackTitle: string) {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length > 0) {
    return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
  }
  return fallbackTitle;
}

function buildMailboxSourceLabel(type: MailboxMessageView["type"]) {
  switch (type) {
    case "reward":
      return "运营组";
    case "compensation":
      return "项目组";
    case "system":
    default:
      return "系统";
  }
}

function isMailboxMessageExpired(message: Pick<typeof mailboxMessages.$inferSelect, "expiresAt">) {
  return Boolean(message.expiresAt && message.expiresAt.getTime() <= now().getTime());
}

function toMailboxAttachmentView(attachment: typeof mailboxAttachments.$inferSelect): MailboxAttachmentView {
  return {
    id: attachment.id,
    kind: attachment.kind as MailboxAttachmentView["kind"],
    currency: attachment.currency as CurrencyKey | null,
    amount: attachment.amount,
    productId: attachment.productId,
    itemId: attachment.itemId,
    title: normalizeMailboxText(attachment.title),
    claimedAt: attachment.claimedAt ? attachment.claimedAt.toISOString() : null,
  };
}

function buildUnitCode(slotNumber: number, generation: number) {
  return `UNIT-${String(slotNumber).padStart(2, "0")}-G${generation}`;
}

function buildItemExpiry(product: typeof products.$inferSelect, createdAt: Date) {
  if (product.fulfillmentMode !== "duration_pass" || !product.durationDays) {
    return null;
  }

  return new Date(createdAt.getTime() + product.durationDays * 24 * 60 * 60 * 1000);
}

function buildWarrantyExpiry(product: typeof products.$inferSelect, createdAt: Date) {
  if (product.fulfillmentMode !== "warranty_delivery" || !product.warrantyDays) {
    return null;
  }

  return new Date(createdAt.getTime() + product.warrantyDays * 24 * 60 * 60 * 1000);
}

function buildInitialRemainingUses(product: typeof products.$inferSelect) {
  if (product.fulfillmentMode === "one_time_delivery" && !product.unitCount) {
    return 1;
  }

  return null;
}

async function createItemUnitsInTx(args: {
  tx: typeof db;
  itemId: string;
  unitCount: number;
  createdAt: Date;
  unitExpiresAt: Date | null;
}) {
  if (args.unitCount <= 0) {
    return [];
  }

  const rows = Array.from({ length: args.unitCount }, (_, index) => {
    const slotNumber = index + 1;
    return {
      id: crypto.randomUUID(),
      itemId: args.itemId,
      slotNumber,
      generation: 1,
      code: buildUnitCode(slotNumber, 1),
      status: "active",
      issueReason: null,
      activatedAt: args.createdAt,
      expiresAt: args.unitExpiresAt,
      replacedByUnitId: null,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    };
  });

  return args.tx.insert(itemUnits).values(rows).returning();
}

async function grantMailboxItemAttachmentInTx(args: {
  tx: DbTx;
  userId: string;
  productId: string;
}) {
  const product = await ensureProductSnapshotInTx({
    tx: args.tx,
    productId: args.productId,
  });

  if (!product) {
    throw new NotFoundError(`Unknown product ${args.productId}`);
  }

  const createdAt = now();
  const expiresAt = buildItemExpiry(product, createdAt);
  const warrantyExpiresAt = buildWarrantyExpiry(product, createdAt);
  const totalUnits = product.unitCount ?? null;
  const activeUnits = totalUnits;

  const [item] = await args.tx
    .insert(items)
    .values({
      id: crypto.randomUUID(),
      userId: args.userId,
      productId: product.id,
      orderId: null,
      productTitle: product.title,
      fulfillmentMode: product.fulfillmentMode,
      transferable: product.transferable,
      status: "active",
      remainingUses: buildInitialRemainingUses(product),
      totalUnits,
      activeUnits,
      replacementCount: 0,
      warrantyExpiresAt,
      lastReconciledAt: null,
      expiresAt,
      createdAt,
      updatedAt: createdAt,
    })
    .returning();

  if (totalUnits) {
    await createItemUnitsInTx({
      tx: args.tx,
      itemId: item.id,
      unitCount: totalUnits,
      createdAt,
      unitExpiresAt: warrantyExpiresAt,
    });
  }

  await enqueueOutboxEvent(
    "item.granted",
    {
      userId: args.userId,
      itemId: item.id,
      productId: product.id,
    },
    args.tx,
  );

  return item.id;
}

async function pruneMailboxInboxOverflowInTx(args: {
  tx: DbTx;
  userId: string;
  limit?: number;
}) {
  const [countRow] = await args.tx
    .select({
      total: sql<number>`count(*)`,
    })
    .from(mailboxMessages)
    .where(and(eq(mailboxMessages.userId, args.userId), eq(mailboxMessages.folder, "inbox")));

  const overflowCount = Math.max(0, Number(countRow?.total ?? 0) - (args.limit ?? MAILBOX_INBOX_STORAGE_LIMIT));
  if (overflowCount <= 0) {
    return [];
  }

  const prunableRows = await args.tx
    .select({
      id: mailboxMessages.id,
    })
    .from(mailboxMessages)
    .where(
      and(
        eq(mailboxMessages.userId, args.userId),
        eq(mailboxMessages.folder, "inbox"),
        isNull(mailboxMessages.favoritedAt),
      ),
    )
    .orderBy(asc(mailboxMessages.createdAt), asc(mailboxMessages.id))
    .limit(overflowCount);

  const prunableIds = prunableRows.map((row: { id: string }) => row.id);
  if (prunableIds.length === 0) {
    return [];
  }

  return args.tx
    .delete(mailboxMessages)
    .where(inArray(mailboxMessages.id, prunableIds))
    .returning({ id: mailboxMessages.id });
}

export async function createMailboxMessage(args: {
  userId: string;
  title: string;
  body: string;
  type: "system" | "reward" | "compensation";
  folder?: MailboxFolderKey;
  summary?: string | null;
  sourceLabel?: string | null;
  expiresAt?: Date | string | null;
  idempotencyKey?: string | null;
  attachments?: Array<
    | { kind: "currency"; currency: CurrencyKey; amount: number; title?: string | null }
    | { kind: "item"; productId: string; title?: string | null }
  >;
}) {
  let idempotencyKey: string | null;
  try {
    idempotencyKey = normalizeMailboxIdempotencyKey(args.idempotencyKey);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid mailbox idempotency key");
  }
  return db.transaction(async (tx) => {
    const messageId = crypto.randomUUID();
    const createdAt = now();
    const expiresAt =
      typeof args.expiresAt === "string"
        ? new Date(args.expiresAt)
        : args.expiresAt instanceof Date
          ? args.expiresAt
          : null;
    if (expiresAt && !Number.isFinite(expiresAt.getTime())) {
      throw new BadRequestError("Mailbox expiry is invalid");
    }
    const folder = normalizeMailboxFolder(args.folder);
    const summary = normalizeMailboxText(args.summary) ?? buildMailboxSummary(args.body, args.title);
    const sourceLabel = normalizeMailboxText(args.sourceLabel) ?? buildMailboxSourceLabel(args.type);
    const normalizedAttachments = (args.attachments ?? []).map((attachment, index) => ({
      kind: attachment.kind,
      title:
        normalizeMailboxText(attachment.title) ??
        (attachment.kind === "currency"
          ? `${attachment.currency} x ${attachment.amount}`
          : "邮件附件"),
      currency: attachment.kind === "currency" ? attachment.currency : null,
      amount: attachment.kind === "currency" ? attachment.amount : null,
      productId: attachment.kind === "item" ? attachment.productId : null,
      sortOrder: index,
    }));
    const payload = {
      folder,
      title: args.title,
      body: args.body,
      type: args.type,
      summary,
      sourceLabel,
      expiresAt,
      attachments: normalizedAttachments,
    };
    const [inserted] = await tx.insert(mailboxMessages).values({
      id: messageId,
      userId: args.userId,
      folder,
      title: args.title,
      summary,
      body: args.body,
      sourceLabel,
      type: args.type,
      idempotencyKey,
      readAt: null,
      favoritedAt: null,
      expiresAt,
      createdAt,
    }).onConflictDoNothing({
      target: [mailboxMessages.userId, mailboxMessages.idempotencyKey],
    }).returning();

    if (!inserted) {
      if (!idempotencyKey) {
        throw new ConflictError("Mailbox message insert conflicted without an idempotency key");
      }
      const [existing] = await tx
        .select()
        .from(mailboxMessages)
        .where(
          and(
            eq(mailboxMessages.userId, args.userId),
            eq(mailboxMessages.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new ConflictError("Mailbox message could not be recovered after an idempotency conflict");
      }
      const existingAttachments = await tx
        .select({
          kind: mailboxAttachments.kind,
          title: mailboxAttachments.title,
          currency: mailboxAttachments.currency,
          amount: mailboxAttachments.amount,
          productId: mailboxAttachments.productId,
          sortOrder: mailboxAttachments.sortOrder,
        })
        .from(mailboxAttachments)
        .where(eq(mailboxAttachments.messageId, existing.id))
        .orderBy(asc(mailboxAttachments.sortOrder), asc(mailboxAttachments.id));
      if (!mailboxIdempotentPayloadMatches({ ...existing, attachments: existingAttachments }, payload)) {
        throw new ConflictError("Mailbox idempotency key is already used for another payload");
      }
      return { messageId: existing.id, created: false };
    }

    for (const attachment of normalizedAttachments) {
      await tx.insert(mailboxAttachments).values({
        id: crypto.randomUUID(),
        messageId,
        kind: attachment.kind,
        title: attachment.title,
        currency: attachment.currency,
        amount: attachment.amount,
        productId: attachment.productId,
        itemId: null,
        sortOrder: attachment.sortOrder,
        claimedAt: null,
      });
    }

    if (folder === "inbox") {
      await pruneMailboxInboxOverflowInTx({
        tx,
        userId: args.userId,
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

    return { messageId, created: true };
  });
}

function toMailboxMessageView(
  message: typeof mailboxMessages.$inferSelect,
  attachments: MailboxAttachmentView[],
): MailboxMessageView {
  return {
    folder: message.folder === "stash" ? "stash" : "inbox",
    id: message.id,
    title: message.title,
    summary: normalizeMailboxText(message.summary) ?? buildMailboxSummary(message.body, message.title),
    body: message.body,
    sourceLabel: normalizeMailboxText(message.sourceLabel) ?? buildMailboxSourceLabel(message.type as MailboxMessageView["type"]),
    type: message.type as MailboxMessageView["type"],
    readAt: message.readAt ? message.readAt.toISOString() : null,
    favoritedAt: message.favoritedAt ? message.favoritedAt.toISOString() : null,
    expiresAt: message.expiresAt ? message.expiresAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
    attachments,
    pendingAttachmentCount: attachments.filter((attachment) => attachment.claimedAt === null).length,
    claimedAttachmentCount: attachments.filter((attachment) => attachment.claimedAt !== null).length,
  };
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

  return messages.map((message) => toMailboxMessageView(message, attachmentsByMessage.get(message.id) || []));
}

export async function getMailboxMessageById(
  userId: string,
  messageId: string,
): Promise<MailboxMessageView | null> {
  const message = await getMailboxMessageByUserAndId(userId, messageId);
  if (!message) return null;
  const attachments = await getMailboxAttachmentsByMessageIds([message.id]);
  return toMailboxMessageView(message, attachments.map(toMailboxAttachmentView));
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
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from mailbox_messages where id = ${messageId} and user_id = ${userId} for update`);
    await tx.execute(sql`select id from mailbox_attachments where id = ${attachmentId} and message_id = ${messageId} for update`);

    const [message] = await tx
      .select()
      .from(mailboxMessages)
      .where(and(eq(mailboxMessages.id, messageId), eq(mailboxMessages.userId, userId)))
      .limit(1);
    if (!message) {
      throw new NotFoundError("邮件不存在");
    }
    if (isMailboxMessageExpired(message)) {
      throw new ConflictError("邮件已过期");
    }

    const [attachment] = await tx
      .select()
      .from(mailboxAttachments)
      .where(and(eq(mailboxAttachments.id, attachmentId), eq(mailboxAttachments.messageId, messageId)))
      .limit(1);
    if (!attachment) {
      throw new NotFoundError("附件不存在");
    }
    if (attachment.claimedAt) {
      throw new ConflictError("附件已领取");
    }

    let grantedItemId: string | null = null;
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
      grantedItemId = await grantMailboxItemAttachmentInTx({
        tx,
        userId,
        productId: attachment.productId,
      });
    } else {
      throw new ConflictError("附件配置不完整");
    }

    const claimedAt = now();
    const [updatedAttachment] = await tx
      .update(mailboxAttachments)
      .set({ claimedAt, itemId: grantedItemId })
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

export async function markMailboxMessageRead(userId: string, messageId: string) {
  const [message] = await db
    .select()
    .from(mailboxMessages)
    .where(and(eq(mailboxMessages.id, messageId), eq(mailboxMessages.userId, userId)))
    .limit(1);

  if (!message) {
    throw new NotFoundError("邮件不存在");
  }

  if (message.readAt) {
    return {
      messageId,
      readAt: message.readAt.toISOString(),
    };
  }

  const readAt = now();
  await db.update(mailboxMessages).set({ readAt }).where(eq(mailboxMessages.id, message.id));

  return {
    messageId,
    readAt: readAt.toISOString(),
  };
}

export async function setMailboxMessageFavorite(
  userId: string,
  messageId: string,
  favorited: boolean,
): Promise<SetMailboxMessageFavoriteResult> {
  const [message] = await db
    .select()
    .from(mailboxMessages)
    .where(and(eq(mailboxMessages.id, messageId), eq(mailboxMessages.userId, userId)))
    .limit(1);

  if (!message) {
    throw new NotFoundError("邮件不存在");
  }

  const favoritedAt = favorited ? now() : null;
  await db
    .update(mailboxMessages)
    .set({
      favoritedAt,
    })
    .where(eq(mailboxMessages.id, message.id));

  return {
    messageId,
    favoritedAt: favoritedAt ? favoritedAt.toISOString() : null,
  };
}

export async function deleteMailboxMessage(userId: string, messageId: string): Promise<DeleteMailboxMessageResult> {
  const deletedRows = await db
    .delete(mailboxMessages)
    .where(and(eq(mailboxMessages.id, messageId), eq(mailboxMessages.userId, userId)))
    .returning({
      id: mailboxMessages.id,
    });

  if (deletedRows.length === 0) {
    throw new NotFoundError("邮件不存在");
  }

  return {
    messageId,
    deleted: true,
  };
}

export async function claimMailboxMessageAttachments(
  userId: string,
  messageId: string,
): Promise<ClaimMailboxMessageAttachmentsResult> {
  const messages = await listMailbox(userId);
  const message = messages.find((entry) => entry.id === messageId);

  if (!message) {
    throw new NotFoundError("邮件不存在");
  }

  if (message.expiresAt && Date.parse(message.expiresAt) <= Date.now()) {
    throw new ConflictError("邮件已过期");
  }

  const pendingAttachments = message.attachments.filter((attachment) => attachment.claimedAt === null);
  if (pendingAttachments.length === 0) {
    throw new ConflictError("当前邮件没有待领取附件");
  }

  const claimedAttachments: MailboxAttachmentView[] = [];
  for (const attachment of pendingAttachments) {
    claimedAttachments.push(await claimAttachment(userId, messageId, attachment.id));
  }

  return {
    messageId,
    claimedCount: claimedAttachments.length,
    attachments: claimedAttachments,
  };
}

export async function claimAllMailboxAttachments(userId: string): Promise<ClaimAllMailboxAttachmentsResult> {
  const messages = await listMailbox(userId);
  const inboxMessages = messages.filter(
    (message) =>
      message.folder === "inbox" &&
      (!message.expiresAt || Date.parse(message.expiresAt) > Date.now()) &&
      message.pendingAttachmentCount > 0,
  );

  if (inboxMessages.length === 0) {
    throw new ConflictError("当前没有可领取的邮箱附件");
  }

  const claimedAttachments: MailboxAttachmentView[] = [];
  const messageIds = new Set<string>();

  for (const message of inboxMessages) {
    const claimed = await claimMailboxMessageAttachments(userId, message.id);
    if (claimed.claimedCount > 0) {
      messageIds.add(message.id);
      claimed.attachments.forEach((attachment) => claimedAttachments.push(attachment));
    }
  }

  return {
    claimedCount: claimedAttachments.length,
    attachments: claimedAttachments,
    messageIds: Array.from(messageIds),
  };
}

export async function archiveReadMailboxMessages(userId: string): Promise<ArchiveReadMailboxMessagesResult> {
  const messages = await listMailbox(userId);
  const targetMessageIds = messages
    .filter(
      (message) =>
        message.folder === "inbox" &&
        message.readAt !== null &&
        message.favoritedAt === null &&
        message.pendingAttachmentCount === 0,
    )
    .map((message) => message.id);

  if (targetMessageIds.length === 0) {
    return {
      archivedCount: 0,
      messageIds: [],
    };
  }

  const updatedRows = await db
    .update(mailboxMessages)
    .set({ folder: "stash" })
    .where(inArray(mailboxMessages.id, targetMessageIds))
    .returning({ id: mailboxMessages.id });

  return {
    archivedCount: updatedRows.length,
    messageIds: updatedRows.map((row) => row.id),
  };
}
