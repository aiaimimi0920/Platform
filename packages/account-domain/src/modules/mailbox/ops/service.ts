import type {
  ListMailboxOpsCampaignsInput,
  ListMailboxOpsRecipientBatchesInput,
  ListMailboxOpsTemplatesInput,
  MailboxOpsAttachmentInput,
  MailboxOpsCampaignDeliveryView,
  MailboxOpsCampaignDispatchResult,
  MailboxOpsCampaignStatus,
  MailboxOpsCampaignView,
  MailboxOpsRecipientBatchView,
  MailboxOpsRecipientMode,
  MailboxOpsTemplateView,
  UpsertMailboxOpsCampaignInput,
  UpsertMailboxOpsRecipientBatchInput,
  UpsertMailboxOpsTemplateInput,
} from "@neuro/contracts";
import { currencyKeys } from "@neuro/contracts";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { authIdentities, users } from "@/modules/identity/schema";
import { ensureInternalUser } from "@/modules/identity/service";
import {
  getMailboxOpsCampaignById,
  getMailboxOpsRecipientBatchById,
  getMailboxOpsRecipientBatchByOperatorAndName,
  getMailboxOpsTemplateById,
  getMailboxOpsTemplateByOperatorAndName,
  listDueMailboxOpsCampaigns,
  listMailboxOpsCampaignDeliveriesByCampaignId,
  listMailboxOpsCampaignsByOperator,
  listMailboxOpsRecipientBatchesByOperator,
  listMailboxOpsTemplatesByOperator,
} from "../repository/ops";
import {
  mailboxOpsCampaignDeliveries,
  mailboxOpsCampaigns,
  mailboxOpsRecipientBatches,
  mailboxOpsTemplates,
} from "@/modules/mailbox/schema";
import { products } from "@/modules/product-order-item/schema";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { createMailboxMessage } from "../player/service";
import { assertPlatformOperator, getPlatformOperatorUserIdSet, normalizeMailboxText, now } from "../common";

const MAILBOX_OPS_MAX_ATTACHMENT_COUNT = 6;
const MAILBOX_OPS_MAX_RECIPIENT_TOKENS = 5000;
const MAILBOX_OPS_MAX_UNRESOLVED_PREVIEW = 50;

async function assertMailboxOpsPlatformOperator(userId: string) {
  const operatorIds = getPlatformOperatorUserIdSet();
  if (operatorIds.has(userId)) {
    return;
  }

  const [identity] = await db
    .select({ providerUserId: authIdentities.providerUserId })
    .from(authIdentities)
    .where(eq(authIdentities.userId, userId))
    .limit(1);

  if (identity?.providerUserId && operatorIds.has(identity.providerUserId)) {
    return;
  }

  throw new UnauthorizedError("Only platform operators can manage mailbox operations");
}

function normalizeMailboxOpsRecipientMode(value: unknown): MailboxOpsRecipientMode {
  if (
    value === "allUsers" ||
    value === "userIds" ||
    value === "usernames" ||
    value === "providerUserIds"
  ) {
    return value;
  }
  throw new BadRequestError("请选择有效的收件范围。");
}

function normalizeMailboxOpsCampaignStatus(value: unknown): Extract<MailboxOpsCampaignStatus, "draft" | "scheduled"> {
  if (value === "scheduled") {
    return "scheduled";
  }
  return "draft";
}

function normalizeMailboxOpsCampaignText(value: string | null | undefined, fieldLabel: string, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new BadRequestError(`${fieldLabel}不能为空。`);
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`${fieldLabel}不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeOptionalMailboxOpsCampaignText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`文本内容不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function parseMailboxOpsRecipientTokens(value: string | null | undefined) {
  const tokens = Array.from(
    new Set(
      (value ?? "")
        .split(/[\r\n,;]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0),
    ),
  );
  if (tokens.length > MAILBOX_OPS_MAX_RECIPIENT_TOKENS) {
    throw new BadRequestError(`单次最多允许输入 ${MAILBOX_OPS_MAX_RECIPIENT_TOKENS} 个收件标识。`);
  }
  return tokens;
}

async function assertMailboxOpsAttachmentProductsExist(attachments: MailboxOpsAttachmentInput[]) {
  const productIds = Array.from(
    new Set(
      attachments
        .filter((attachment): attachment is Extract<MailboxOpsAttachmentInput, { kind: "item" }> => attachment.kind === "item")
        .map((attachment) => attachment.productId),
    ),
  );

  if (productIds.length === 0) {
    return;
  }

  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, productIds));
  const found = new Set(rows.map((row) => row.id));
  const missing = productIds.filter((productId) => !found.has(productId));
  if (missing.length > 0) {
    throw new BadRequestError(`存在无效的商品附件 productId：${missing.slice(0, 5).join("、")}`);
  }
}

type MailboxOpsResolvedRecipient = {
  userId: string;
  usernameSnapshot: string | null;
  providerUserIdSnapshot: string | null;
};

async function getPreferredProviderIdentityMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, string | null>();
  }

  const rows = await db
    .select({
      userId: authIdentities.userId,
      provider: authIdentities.provider,
      providerUserId: authIdentities.providerUserId,
      createdAt: authIdentities.createdAt,
    })
    .from(authIdentities)
    .where(inArray(authIdentities.userId, userIds))
    .orderBy(asc(authIdentities.createdAt));

  const providerMap = new Map<string, string | null>();
  for (const row of rows) {
    const current = providerMap.get(row.userId);
    if (!current || row.provider === "linuxdo") {
      providerMap.set(row.userId, row.providerUserId);
    }
  }
  return providerMap;
}

async function resolveMailboxOpsRecipients(
  mode: MailboxOpsRecipientMode,
  recipientInput: string | null | undefined,
): Promise<{ recipients: MailboxOpsResolvedRecipient[]; unresolvedTargets: string[] }> {
  if (mode === "allUsers") {
    const userRows = await db
      .select({
        userId: users.id,
        username: users.username,
      })
      .from(users)
      .orderBy(asc(users.createdAt));
    const providerMap = await getPreferredProviderIdentityMap(userRows.map((row) => row.userId));
    return {
      recipients: userRows.map((row) => ({
        userId: row.userId,
        usernameSnapshot: row.username,
        providerUserIdSnapshot: providerMap.get(row.userId) ?? null,
      })),
      unresolvedTargets: [],
    };
  }

  const tokens = parseMailboxOpsRecipientTokens(recipientInput);
  if (tokens.length === 0) {
    throw new BadRequestError("请输入至少一个收件标识。");
  }

  if (mode === "providerUserIds") {
    const rows = await db
      .select({
        userId: users.id,
        username: users.username,
        providerUserId: authIdentities.providerUserId,
      })
      .from(authIdentities)
      .innerJoin(users, eq(authIdentities.userId, users.id))
      .where(inArray(authIdentities.providerUserId, tokens));

    const matched = new Set(rows.map((row) => row.providerUserId));
    const unresolvedTargets = tokens.filter((token) => !matched.has(token));
    const recipientsByUserId = new Map<string, MailboxOpsResolvedRecipient>();
    for (const row of rows) {
      if (!recipientsByUserId.has(row.userId)) {
        recipientsByUserId.set(row.userId, {
          userId: row.userId,
          usernameSnapshot: row.username,
          providerUserIdSnapshot: row.providerUserId,
        });
      }
    }

    return {
      recipients: Array.from(recipientsByUserId.values()),
      unresolvedTargets,
    };
  }

  const query =
    mode === "userIds"
      ? db
          .select({
            userId: users.id,
            username: users.username,
          })
          .from(users)
          .where(inArray(users.id, tokens))
      : db
          .select({
            userId: users.id,
            username: users.username,
          })
          .from(users)
          .where(inArray(users.username, tokens));

  const userRows = await query;
  const providerMap = await getPreferredProviderIdentityMap(userRows.map((row) => row.userId));
  const matched =
    mode === "userIds" ? new Set(userRows.map((row) => row.userId)) : new Set(userRows.map((row) => row.username));

  return {
    recipients: userRows.map((row) => ({
      userId: row.userId,
      usernameSnapshot: row.username,
      providerUserIdSnapshot: providerMap.get(row.userId) ?? null,
    })),
    unresolvedTargets: tokens.filter((token) => !matched.has(token)),
  };
}

function normalizeMailboxOpsCampaignAttachments(
  attachments: MailboxOpsAttachmentInput[] | null | undefined,
): MailboxOpsAttachmentInput[] {
  const normalized = (attachments ?? []).map((attachment) => {
    if (attachment.kind === "currency") {
      if (!currencyKeys.includes(attachment.currency)) {
        throw new BadRequestError("附件中包含无效的货币类型。");
      }
      if (!Number.isInteger(attachment.amount) || attachment.amount <= 0) {
        throw new BadRequestError("货币附件数量必须是正整数。");
      }
      return {
        kind: "currency" as const,
        currency: attachment.currency,
        amount: attachment.amount,
        title: normalizeOptionalMailboxOpsCampaignText(attachment.title, 120),
      };
    }

    const productId = attachment.productId?.trim() ?? "";
    if (!productId) {
      throw new BadRequestError("Item 附件必须填写 productId。");
    }
    return {
      kind: "item" as const,
      productId,
      title: normalizeOptionalMailboxOpsCampaignText(attachment.title, 120),
    };
  });

  if (normalized.length > MAILBOX_OPS_MAX_ATTACHMENT_COUNT) {
    throw new BadRequestError(`单封邮件最多允许 ${MAILBOX_OPS_MAX_ATTACHMENT_COUNT} 个附件。`);
  }

  return normalized;
}

function toMailboxOpsCampaignView(row: typeof mailboxOpsCampaigns.$inferSelect): MailboxOpsCampaignView {
  const attachments = normalizeMailboxOpsCampaignAttachments(row.attachments);
  return {
    id: row.id,
    operatorLabel: row.operatorLabel,
    title: row.title,
    summary: normalizeMailboxText(row.summary),
    body: row.body,
    type: row.type as MailboxOpsCampaignView["type"],
    sourceLabel: normalizeMailboxText(row.sourceLabel),
    recipientMode: normalizeMailboxOpsRecipientMode(row.recipientMode),
    recipientInput: normalizeMailboxText(row.recipientInput),
    attachments,
    attachmentCount: attachments.length,
    previewRecipientCount: row.previewRecipientCount,
    previewUnresolvedCount: row.previewUnresolvedCount,
    previewUnresolvedTargets: Array.isArray(row.previewUnresolvedTargets)
      ? row.previewUnresolvedTargets.map((value) => String(value))
      : [],
    targetCount: row.targetCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    status: (row.status as MailboxOpsCampaignStatus) ?? "draft",
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    lastDispatchedAt: row.lastDispatchedAt ? row.lastDispatchedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    lastError: normalizeMailboxText(row.lastError),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    dispatchedByUserId: row.dispatchedByUserId,
    canceledByUserId: row.canceledByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMailboxOpsCampaignDeliveryView(
  row: typeof mailboxOpsCampaignDeliveries.$inferSelect,
): MailboxOpsCampaignDeliveryView {
  return {
    id: row.id,
    campaignId: row.campaignId,
    userId: row.userId,
    usernameSnapshot: normalizeMailboxText(row.usernameSnapshot),
    providerUserIdSnapshot: normalizeMailboxText(row.providerUserIdSnapshot),
    messageId: row.messageId,
    status: row.status === "failed" ? "failed" : "sent",
    errorMessage: normalizeMailboxText(row.errorMessage),
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
  };
}

function toMailboxOpsTemplateView(row: typeof mailboxOpsTemplates.$inferSelect): MailboxOpsTemplateView {
  const attachments = normalizeMailboxOpsCampaignAttachments(row.attachments);
  return {
    id: row.id,
    operatorUserId: row.operatorUserId,
    name: row.name,
    description: normalizeMailboxText(row.description),
    operatorLabel: row.operatorLabel,
    title: row.title,
    summary: normalizeMailboxText(row.summary),
    body: row.body,
    type: row.type as MailboxOpsTemplateView["type"],
    sourceLabel: normalizeMailboxText(row.sourceLabel),
    attachments,
    attachmentCount: attachments.length,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMailboxOpsRecipientBatchView(
  row: typeof mailboxOpsRecipientBatches.$inferSelect,
): MailboxOpsRecipientBatchView {
  return {
    id: row.id,
    operatorUserId: row.operatorUserId,
    name: row.name,
    description: normalizeMailboxText(row.description),
    recipientMode: normalizeMailboxOpsRecipientMode(row.recipientMode),
    recipientInput: normalizeMailboxText(row.recipientInput),
    previewRecipientCount: row.previewRecipientCount,
    previewUnresolvedCount: row.previewUnresolvedCount,
    previewUnresolvedTargets: Array.isArray(row.previewUnresolvedTargets)
      ? row.previewUnresolvedTargets.map((value) => String(value))
      : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeMailboxOpsTemplateName(value: string | null | undefined) {
  return normalizeMailboxOpsCampaignText(value, "模板名称", 120);
}

function normalizeMailboxOpsRecipientBatchName(value: string | null | undefined) {
  return normalizeMailboxOpsCampaignText(value, "收件批次名称", 120);
}

function buildMailboxOpsDuplicatedOperatorLabel(value: string) {
  const suffix = "（复制）";
  const trimmed = value.trim();
  if (trimmed.length + suffix.length <= 120) {
    return `${trimmed}${suffix}`;
  }
  return `${trimmed.slice(0, 120 - suffix.length)}${suffix}`;
}

function canEditMailboxOpsCampaign(status: MailboxOpsCampaignStatus) {
  return status === "draft" || status === "scheduled";
}

function canDispatchMailboxOpsCampaign(status: MailboxOpsCampaignStatus) {
  return status === "draft" || status === "scheduled" || status === "failed" || status === "partial";
}

async function dispatchMailboxOpsCampaign(
  campaignId: string,
  actorUserId: string | null,
): Promise<MailboxOpsCampaignDispatchResult> {
  if (actorUserId) {
    await assertMailboxOpsPlatformOperator(actorUserId);
    await ensureInternalUser(actorUserId);
  }

  const campaign = await getMailboxOpsCampaignById(campaignId);
  if (!campaign) {
    throw new NotFoundError("Mailbox ops campaign not found.");
  }
  const status = (campaign.status as MailboxOpsCampaignStatus) ?? "draft";
  if (!canDispatchMailboxOpsCampaign(status)) {
    throw new ConflictError("当前活动状态不允许继续发送。");
  }

  const attachments = normalizeMailboxOpsCampaignAttachments(campaign.attachments);
  await assertMailboxOpsAttachmentProductsExist(attachments);

  const resolution = await resolveMailboxOpsRecipients(
    normalizeMailboxOpsRecipientMode(campaign.recipientMode),
    campaign.recipientInput,
  );
  const unresolvedCount = resolution.unresolvedTargets.length;
  const unresolvedPreview = resolution.unresolvedTargets.slice(0, MAILBOX_OPS_MAX_UNRESOLVED_PREVIEW);
  const timestamp = now();

  await db
    .update(mailboxOpsCampaigns)
    .set({
      status: "sending",
      previewRecipientCount: resolution.recipients.length,
      previewUnresolvedCount: unresolvedCount,
      previewUnresolvedTargets: unresolvedPreview,
      targetCount: resolution.recipients.length,
      updatedAt: timestamp,
      lastDispatchedAt: timestamp,
      completedAt: null,
      lastError: null,
      dispatchedByUserId: actorUserId,
    })
    .where(eq(mailboxOpsCampaigns.id, campaignId));

  const existingDeliveries = await listMailboxOpsCampaignDeliveriesByCampaignId(campaignId);
  const successfulUserIds = new Set(
    existingDeliveries.filter((delivery) => delivery.status === "sent").map((delivery) => delivery.userId),
  );

  let sentCount = successfulUserIds.size;
  let deliveryFailedCount = 0;
  let firstError: string | null = null;

  for (const recipient of resolution.recipients) {
    if (successfulUserIds.has(recipient.userId)) {
      continue;
    }

    try {
      const result = await createMailboxMessage({
        userId: recipient.userId,
        title: campaign.title,
        body: campaign.body,
        type: campaign.type as MailboxOpsCampaignView["type"],
        folder: "inbox",
        summary: campaign.summary,
        sourceLabel: campaign.sourceLabel,
        expiresAt: campaign.expiresAt,
        attachments,
      });

      await db
        .insert(mailboxOpsCampaignDeliveries)
        .values({
          id: crypto.randomUUID(),
          campaignId,
          userId: recipient.userId,
          usernameSnapshot: recipient.usernameSnapshot,
          providerUserIdSnapshot: recipient.providerUserIdSnapshot,
          messageId: result.messageId,
          status: "sent",
          errorMessage: null,
          createdAt: timestamp,
          sentAt: timestamp,
        })
        .onConflictDoUpdate({
          target: [mailboxOpsCampaignDeliveries.campaignId, mailboxOpsCampaignDeliveries.userId],
          set: {
            usernameSnapshot: recipient.usernameSnapshot,
            providerUserIdSnapshot: recipient.providerUserIdSnapshot,
            messageId: result.messageId,
            status: "sent",
            errorMessage: null,
            sentAt: timestamp,
          },
        });

      successfulUserIds.add(recipient.userId);
      sentCount += 1;
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "mail dispatch failed";
      deliveryFailedCount += 1;
      if (!firstError) {
        firstError = message;
      }
      await db
        .insert(mailboxOpsCampaignDeliveries)
        .values({
          id: crypto.randomUUID(),
          campaignId,
          userId: recipient.userId,
          usernameSnapshot: recipient.usernameSnapshot,
          providerUserIdSnapshot: recipient.providerUserIdSnapshot,
          messageId: null,
          status: "failed",
          errorMessage: message,
          createdAt: timestamp,
          sentAt: null,
        })
        .onConflictDoUpdate({
          target: [mailboxOpsCampaignDeliveries.campaignId, mailboxOpsCampaignDeliveries.userId],
          set: {
            usernameSnapshot: recipient.usernameSnapshot,
            providerUserIdSnapshot: recipient.providerUserIdSnapshot,
            messageId: null,
            status: "failed",
            errorMessage: message,
            sentAt: null,
          },
        });
    }
  }

  const finalFailedCount = unresolvedCount + deliveryFailedCount;
  let finalStatus: MailboxOpsCampaignStatus = "sent";
  if (resolution.recipients.length === 0) {
    finalStatus = "failed";
  } else if (finalFailedCount > 0 && sentCount > 0) {
    finalStatus = "partial";
  } else if (finalFailedCount > 0) {
    finalStatus = "failed";
  }

  const lastError =
    resolution.recipients.length === 0
      ? "当前范围没有匹配到任何用户。"
      : unresolvedCount > 0
        ? `存在 ${unresolvedCount} 个未匹配的收件标识。${firstError ? ` 首个投递错误：${firstError}` : ""}`
        : firstError;

  const completedAt = now();
  await db
    .update(mailboxOpsCampaigns)
    .set({
      status: finalStatus,
      previewRecipientCount: resolution.recipients.length,
      previewUnresolvedCount: unresolvedCount,
      previewUnresolvedTargets: unresolvedPreview,
      targetCount: resolution.recipients.length,
      sentCount,
      failedCount: finalFailedCount,
      lastError,
      updatedAt: completedAt,
      completedAt,
      lastDispatchedAt: timestamp,
      dispatchedByUserId: actorUserId,
    })
    .where(eq(mailboxOpsCampaigns.id, campaignId));

  const updatedCampaign = await getMailboxOpsCampaignById(campaignId);
  if (!updatedCampaign) {
    throw new NotFoundError("Mailbox ops campaign disappeared after dispatch.");
  }

  return {
    campaign: toMailboxOpsCampaignView(updatedCampaign),
    dispatchedCount: sentCount,
    failedCount: finalFailedCount,
    unresolvedCount,
    errorMessage: lastError,
  };
}

export async function listMailboxOpsCampaignsForOperator(
  operatorUserId: string,
  input?: ListMailboxOpsCampaignsInput,
): Promise<MailboxOpsCampaignView[]> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  const rows = await listMailboxOpsCampaignsByOperator(operatorUserId, {
    limit: input?.limit ?? 40,
    status: input?.status ?? null,
  });
  return rows.map(toMailboxOpsCampaignView);
}

export async function listMailboxOpsCampaignDeliveriesForOperator(
  operatorUserId: string,
  campaignId: string,
  limit = 24,
): Promise<MailboxOpsCampaignDeliveryView[]> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  const campaign = await getMailboxOpsCampaignById(campaignId);
  if (!campaign) {
    throw new NotFoundError("Mailbox ops campaign not found.");
  }
  const rows = await listMailboxOpsCampaignDeliveriesByCampaignId(campaignId, limit);
  return rows.map(toMailboxOpsCampaignDeliveryView);
}

export async function saveMailboxOpsCampaignForOperator(
  operatorUserId: string,
  input: UpsertMailboxOpsCampaignInput,
  campaignId?: string,
): Promise<MailboxOpsCampaignView> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  await ensureInternalUser(operatorUserId);

  const operatorLabel = normalizeMailboxOpsCampaignText(input.operatorLabel, "运营标签", 120);
  const title = normalizeMailboxOpsCampaignText(input.title, "邮件标题", 160);
  const body = normalizeMailboxOpsCampaignText(input.body, "正文内容", 6000);
  const recipientMode = normalizeMailboxOpsRecipientMode(input.recipientMode);
  const recipientInput =
    recipientMode === "allUsers"
      ? null
      : parseMailboxOpsRecipientTokens(input.recipientInput).join("\n");
  const attachments = normalizeMailboxOpsCampaignAttachments(input.attachments);
  await assertMailboxOpsAttachmentProductsExist(attachments);

  const expiresAt =
    typeof input.expiresAt === "string" && input.expiresAt.trim()
      ? new Date(input.expiresAt)
      : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new BadRequestError("邮件过期时间无效。");
  }

  const scheduledAt =
    typeof input.scheduledAt === "string" && input.scheduledAt.trim()
      ? new Date(input.scheduledAt)
      : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    throw new BadRequestError("定时发送时间无效。");
  }

  const status = normalizeMailboxOpsCampaignStatus(input.status);
  if (status === "scheduled") {
    if (!scheduledAt) {
      throw new BadRequestError("定时发送必须填写发送时间。");
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestError("定时发送时间必须晚于当前时间。");
    }
  }

  const resolution = await resolveMailboxOpsRecipients(recipientMode, recipientInput);
  const previewUnresolvedTargets = resolution.unresolvedTargets.slice(0, MAILBOX_OPS_MAX_UNRESOLVED_PREVIEW);
  const timestamp = now();

  if (campaignId) {
    const existing = await getMailboxOpsCampaignById(campaignId);
    if (!existing) {
      throw new NotFoundError("Mailbox ops campaign not found.");
    }
    if (!canEditMailboxOpsCampaign((existing.status as MailboxOpsCampaignStatus) ?? "draft")) {
      throw new ConflictError("已发出或已取消的活动不可再编辑，请新建一条新的运营邮件。");
    }

    const [row] = await db
      .update(mailboxOpsCampaigns)
      .set({
        operatorLabel,
        title,
        summary: normalizeOptionalMailboxOpsCampaignText(input.summary, 240),
        body,
        type: input.type,
        sourceLabel: normalizeOptionalMailboxOpsCampaignText(input.sourceLabel, 80),
        recipientMode,
        recipientInput,
        attachments,
        previewRecipientCount: resolution.recipients.length,
        previewUnresolvedCount: resolution.unresolvedTargets.length,
        previewUnresolvedTargets,
        status,
        expiresAt,
        scheduledAt: status === "scheduled" ? scheduledAt : null,
        updatedByUserId: operatorUserId,
        updatedAt: timestamp,
      })
      .where(eq(mailboxOpsCampaigns.id, campaignId))
      .returning();

    return toMailboxOpsCampaignView(row);
  }

  const [row] = await db
    .insert(mailboxOpsCampaigns)
    .values({
      id: crypto.randomUUID(),
      operatorLabel,
      title,
      summary: normalizeOptionalMailboxOpsCampaignText(input.summary, 240),
      body,
      type: input.type,
      sourceLabel: normalizeOptionalMailboxOpsCampaignText(input.sourceLabel, 80),
      recipientMode,
      recipientInput,
      attachments,
      previewRecipientCount: resolution.recipients.length,
      previewUnresolvedCount: resolution.unresolvedTargets.length,
      previewUnresolvedTargets,
      targetCount: 0,
      sentCount: 0,
      failedCount: 0,
      status,
      expiresAt,
      scheduledAt: status === "scheduled" ? scheduledAt : null,
      lastDispatchedAt: null,
      completedAt: null,
      lastError: null,
      createdByUserId: operatorUserId,
      updatedByUserId: operatorUserId,
      dispatchedByUserId: null,
      canceledByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  return toMailboxOpsCampaignView(row);
}

export async function dispatchMailboxOpsCampaignForOperator(
  operatorUserId: string,
  campaignId: string,
): Promise<MailboxOpsCampaignDispatchResult> {
  assertPlatformOperator(operatorUserId);
  return dispatchMailboxOpsCampaign(campaignId, operatorUserId);
}

export async function cancelMailboxOpsCampaignForOperator(
  operatorUserId: string,
  campaignId: string,
): Promise<MailboxOpsCampaignView> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  await ensureInternalUser(operatorUserId);
  const campaign = await getMailboxOpsCampaignById(campaignId);
  if (!campaign) {
    throw new NotFoundError("Mailbox ops campaign not found.");
  }

  const status = (campaign.status as MailboxOpsCampaignStatus) ?? "draft";
  if (!canEditMailboxOpsCampaign(status)) {
    throw new ConflictError("只有草稿和定时中的活动可以取消。");
  }

  const [row] = await db
    .update(mailboxOpsCampaigns)
    .set({
      status: "canceled",
      canceledByUserId: operatorUserId,
      updatedByUserId: operatorUserId,
      updatedAt: now(),
      completedAt: now(),
      lastError: null,
    })
    .where(eq(mailboxOpsCampaigns.id, campaignId))
    .returning();

  return toMailboxOpsCampaignView(row);
}

export async function duplicateMailboxOpsCampaignForOperator(
  operatorUserId: string,
  campaignId: string,
): Promise<MailboxOpsCampaignView> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  await ensureInternalUser(operatorUserId);

  const campaign = await getMailboxOpsCampaignById(campaignId);
  if (!campaign) {
    throw new NotFoundError("Mailbox ops campaign not found.");
  }

  const timestamp = now();
  const [row] = await db
    .insert(mailboxOpsCampaigns)
    .values({
      id: crypto.randomUUID(),
      operatorLabel: buildMailboxOpsDuplicatedOperatorLabel(campaign.operatorLabel),
      title: campaign.title,
      summary: campaign.summary,
      body: campaign.body,
      type: campaign.type,
      sourceLabel: campaign.sourceLabel,
      recipientMode: campaign.recipientMode,
      recipientInput: campaign.recipientInput,
      attachments: normalizeMailboxOpsCampaignAttachments(campaign.attachments),
      previewRecipientCount: campaign.previewRecipientCount,
      previewUnresolvedCount: campaign.previewUnresolvedCount,
      previewUnresolvedTargets: Array.isArray(campaign.previewUnresolvedTargets)
        ? campaign.previewUnresolvedTargets.map((value) => String(value))
        : [],
      targetCount: 0,
      sentCount: 0,
      failedCount: 0,
      status: "draft",
      expiresAt: campaign.expiresAt,
      scheduledAt: null,
      lastDispatchedAt: null,
      completedAt: null,
      lastError: null,
      createdByUserId: operatorUserId,
      updatedByUserId: operatorUserId,
      dispatchedByUserId: null,
      canceledByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  return toMailboxOpsCampaignView(row);
}

export async function listMailboxOpsTemplatesForOperator(
  operatorUserId: string,
  input?: ListMailboxOpsTemplatesInput,
): Promise<MailboxOpsTemplateView[]> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  const rows = await listMailboxOpsTemplatesByOperator(operatorUserId, input?.limit ?? 24);
  return rows.map(toMailboxOpsTemplateView);
}

export async function saveMailboxOpsTemplateForOperator(
  operatorUserId: string,
  input: UpsertMailboxOpsTemplateInput,
): Promise<MailboxOpsTemplateView> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  await ensureInternalUser(operatorUserId);

  const name = normalizeMailboxOpsTemplateName(input.name);
  const operatorLabel = normalizeMailboxOpsCampaignText(input.operatorLabel, "模板默认运营标签", 120);
  const title = normalizeMailboxOpsCampaignText(input.title, "模板邮件标题", 160);
  const body = normalizeMailboxOpsCampaignText(input.body, "模板正文", 6000);
  const attachments = normalizeMailboxOpsCampaignAttachments(input.attachments);
  await assertMailboxOpsAttachmentProductsExist(attachments);

  const expiresAt =
    typeof input.expiresAt === "string" && input.expiresAt.trim() ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new BadRequestError("模板过期时间无效。");
  }

  const timestamp = now();
  const existing = await getMailboxOpsTemplateByOperatorAndName(operatorUserId, name);
  if (existing) {
    const [row] = await db
      .update(mailboxOpsTemplates)
      .set({
        description: normalizeOptionalMailboxOpsCampaignText(input.description, 240),
        operatorLabel,
        title,
        summary: normalizeOptionalMailboxOpsCampaignText(input.summary, 240),
        body,
        type: input.type,
        sourceLabel: normalizeOptionalMailboxOpsCampaignText(input.sourceLabel, 80),
        attachments,
        expiresAt,
        updatedAt: timestamp,
      })
      .where(eq(mailboxOpsTemplates.id, existing.id))
      .returning();
    return toMailboxOpsTemplateView(row ?? existing);
  }

  const [row] = await db
    .insert(mailboxOpsTemplates)
    .values({
      id: crypto.randomUUID(),
      operatorUserId,
      name,
      description: normalizeOptionalMailboxOpsCampaignText(input.description, 240),
      operatorLabel,
      title,
      summary: normalizeOptionalMailboxOpsCampaignText(input.summary, 240),
      body,
      type: input.type,
      sourceLabel: normalizeOptionalMailboxOpsCampaignText(input.sourceLabel, 80),
      attachments,
      expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  return toMailboxOpsTemplateView(row);
}

export async function deleteMailboxOpsTemplateForOperator(operatorUserId: string, templateId: string) {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  const template = await getMailboxOpsTemplateById(templateId);
  if (!template || template.operatorUserId !== operatorUserId) {
    throw new NotFoundError("Mailbox ops template not found.");
  }
  await db.delete(mailboxOpsTemplates).where(eq(mailboxOpsTemplates.id, templateId));
}

export async function listMailboxOpsRecipientBatchesForOperator(
  operatorUserId: string,
  input?: ListMailboxOpsRecipientBatchesInput,
): Promise<MailboxOpsRecipientBatchView[]> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  const rows = await listMailboxOpsRecipientBatchesByOperator(operatorUserId, input?.limit ?? 24);
  return rows.map(toMailboxOpsRecipientBatchView);
}

export async function saveMailboxOpsRecipientBatchForOperator(
  operatorUserId: string,
  input: UpsertMailboxOpsRecipientBatchInput,
): Promise<MailboxOpsRecipientBatchView> {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  await ensureInternalUser(operatorUserId);

  const name = normalizeMailboxOpsRecipientBatchName(input.name);
  const recipientMode = normalizeMailboxOpsRecipientMode(input.recipientMode);
  const recipientInput =
    recipientMode === "allUsers" ? null : parseMailboxOpsRecipientTokens(input.recipientInput).join("\n");
  const resolution = await resolveMailboxOpsRecipients(recipientMode, recipientInput);
  const previewUnresolvedTargets = resolution.unresolvedTargets.slice(0, MAILBOX_OPS_MAX_UNRESOLVED_PREVIEW);
  const timestamp = now();
  const existing = await getMailboxOpsRecipientBatchByOperatorAndName(operatorUserId, name);

  if (existing) {
    const [row] = await db
      .update(mailboxOpsRecipientBatches)
      .set({
        description: normalizeOptionalMailboxOpsCampaignText(input.description, 240),
        recipientMode,
        recipientInput,
        previewRecipientCount: resolution.recipients.length,
        previewUnresolvedCount: resolution.unresolvedTargets.length,
        previewUnresolvedTargets,
        updatedAt: timestamp,
      })
      .where(eq(mailboxOpsRecipientBatches.id, existing.id))
      .returning();
    return toMailboxOpsRecipientBatchView(row ?? existing);
  }

  const [row] = await db
    .insert(mailboxOpsRecipientBatches)
    .values({
      id: crypto.randomUUID(),
      operatorUserId,
      name,
      description: normalizeOptionalMailboxOpsCampaignText(input.description, 240),
      recipientMode,
      recipientInput,
      previewRecipientCount: resolution.recipients.length,
      previewUnresolvedCount: resolution.unresolvedTargets.length,
      previewUnresolvedTargets,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  return toMailboxOpsRecipientBatchView(row);
}

export async function deleteMailboxOpsRecipientBatchForOperator(operatorUserId: string, batchId: string) {
  await assertMailboxOpsPlatformOperator(operatorUserId);
  const batch = await getMailboxOpsRecipientBatchById(batchId);
  if (!batch || batch.operatorUserId !== operatorUserId) {
    throw new NotFoundError("Mailbox ops recipient batch not found.");
  }
  await db.delete(mailboxOpsRecipientBatches).where(eq(mailboxOpsRecipientBatches.id, batchId));
}

export async function dispatchDueMailboxOpsCampaigns(limit = 10) {
  const dueRows = await listDueMailboxOpsCampaigns(now(), Math.max(1, Math.min(limit, 20)));
  let dispatchedCampaignCount = 0;
  let failedCampaignCount = 0;
  let deliveredMessageCount = 0;
  let lastError: string | null = null;

  for (const row of dueRows) {
    try {
      const result = await dispatchMailboxOpsCampaign(row.id, null);
      dispatchedCampaignCount += 1;
      deliveredMessageCount += result.dispatchedCount;
      if (result.campaign.status === "failed" || result.campaign.status === "partial") {
        failedCampaignCount += 1;
      }
    } catch (error) {
      failedCampaignCount += 1;
      lastError = error instanceof Error && error.message ? error.message : "scheduled mailbox dispatch failed";
      await db
        .update(mailboxOpsCampaigns)
        .set({
          status: "failed",
          failedCount: row.failedCount + 1,
          lastError,
          updatedAt: now(),
          completedAt: now(),
        })
        .where(eq(mailboxOpsCampaigns.id, row.id));
    }
  }

  return {
    dueCount: dueRows.length,
    dispatchedCampaignCount,
    failedCampaignCount,
    deliveredMessageCount,
    lastError,
  };
}
