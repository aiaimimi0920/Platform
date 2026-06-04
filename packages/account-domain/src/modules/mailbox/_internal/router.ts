import { currencyKeys, mailboxOpsRecipientModes, type ClaimMailboxAttachmentInput } from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  archiveReadMailboxMessages,
  cancelMailboxOpsCampaignForOperator,
  claimAllMailboxAttachments,
  claimAttachment,
  claimMailboxMessageAttachments,
  deleteMailboxOpsRecipientBatchForOperator,
  deleteMailboxOpsTemplateForOperator,
  dispatchMailboxOpsCampaignForOperator,
  deleteMailboxMessage,
  duplicateMailboxOpsCampaignForOperator,
  listMailbox,
  listMailboxOpsCampaignDeliveriesForOperator,
  listMailboxOpsCampaignsForOperator,
  listMailboxOpsRecipientBatchesForOperator,
  listMailboxOpsTemplatesForOperator,
  markMailboxMessageRead,
  saveMailboxOpsCampaignForOperator,
  saveMailboxOpsRecipientBatchForOperator,
  saveMailboxOpsTemplateForOperator,
  setMailboxMessageFavorite,
} from "@/modules/mailbox/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const claimAttachmentSchema = z.object({
  messageId: z.string().min(1),
  attachmentId: z.string().min(1),
});

const mailboxMessageParamsSchema = z.object({
  messageId: z.string().trim().min(1),
});

const mailboxMessageFavoriteSchema = z.object({
  favorited: z.boolean(),
});

const mailboxOpsAttachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("currency"),
    currency: z.enum(currencyKeys),
    amount: z.number().int().min(1),
    title: z.string().trim().max(120).nullable().optional(),
  }),
  z.object({
    kind: z.literal("item"),
    productId: z.string().trim().min(1).max(120),
    title: z.string().trim().max(120).nullable().optional(),
  }),
]);

const mailboxOpsCampaignSchema = z.object({
  operatorLabel: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(240).nullable().optional(),
  body: z.string().trim().min(1).max(6000),
  type: z.enum(["system", "reward", "compensation"]),
  sourceLabel: z.string().trim().max(80).nullable().optional(),
  recipientMode: z.enum(mailboxOpsRecipientModes),
  recipientInput: z.string().trim().max(20000).nullable().optional(),
  attachments: z.array(mailboxOpsAttachmentSchema).max(6).optional(),
  expiresAt: z.string().trim().min(1).nullable().optional(),
  scheduledAt: z.string().trim().min(1).nullable().optional(),
  status: z.enum(["draft", "scheduled"]).optional(),
});

const mailboxOpsCampaignParamsSchema = z.object({
  campaignId: z.string().trim().min(1),
});

const mailboxOpsCampaignsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional(),
  status: z.enum(["draft", "scheduled", "sending", "sent", "partial", "failed", "canceled", "all"]).optional(),
});

const mailboxOpsCampaignDeliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const mailboxOpsTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240).nullable().optional(),
  operatorLabel: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(240).nullable().optional(),
  body: z.string().trim().min(1).max(6000),
  type: z.enum(["system", "reward", "compensation"]),
  sourceLabel: z.string().trim().max(80).nullable().optional(),
  attachments: z.array(mailboxOpsAttachmentSchema).max(6).optional(),
  expiresAt: z.string().trim().min(1).nullable().optional(),
});

const mailboxOpsTemplateParamsSchema = z.object({
  templateId: z.string().trim().min(1),
});

const mailboxOpsTemplatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional(),
});

const mailboxOpsRecipientBatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240).nullable().optional(),
  recipientMode: z.enum(mailboxOpsRecipientModes),
  recipientInput: z.string().trim().max(20000).nullable().optional(),
});

const mailboxOpsRecipientBatchParamsSchema = z.object({
  batchId: z.string().trim().min(1),
});

const mailboxOpsRecipientBatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(60).optional(),
});

export const mailboxRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/me/mailbox/messages", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("mailbox");
    const { userId } = assertUserContext(request);
    return {
      messages: await listMailbox(userId),
    };
  });

  app.post<{ Body: z.infer<typeof claimAttachmentSchema> }>(
    "/v1/me/mailbox/claim",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      await requireModuleEnabled("item");
      const { userId } = assertUserContext(request);
      const payload = claimAttachmentSchema.parse(request.body) as ClaimMailboxAttachmentInput;
      return {
        attachment: await claimAttachment(userId, payload.messageId, payload.attachmentId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof mailboxMessageParamsSchema> }>(
    "/v1/me/mailbox/messages/:messageId/read",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { messageId } = mailboxMessageParamsSchema.parse(request.params);
      return {
        message: await markMailboxMessageRead(userId, messageId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof mailboxMessageFavoriteSchema>; Params: z.infer<typeof mailboxMessageParamsSchema> }>(
    "/v1/me/mailbox/messages/:messageId/favorite",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { messageId } = mailboxMessageParamsSchema.parse(request.params);
      const payload = mailboxMessageFavoriteSchema.parse(request.body ?? {});
      return {
        result: await setMailboxMessageFavorite(userId, messageId, payload.favorited),
      };
    },
  );

  app.post<{ Params: z.infer<typeof mailboxMessageParamsSchema> }>(
    "/v1/me/mailbox/messages/:messageId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { messageId } = mailboxMessageParamsSchema.parse(request.params);
      return {
        result: await deleteMailboxMessage(userId, messageId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof mailboxMessageParamsSchema> }>(
    "/v1/me/mailbox/messages/:messageId/claim-all",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      await requireModuleEnabled("item");
      const { userId } = assertUserContext(request);
      const { messageId } = mailboxMessageParamsSchema.parse(request.params);
      return {
        result: await claimMailboxMessageAttachments(userId, messageId),
      };
    },
  );

  app.post("/v1/me/mailbox/claim-all", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("mailbox");
    await requireModuleEnabled("wallet");
    await requireModuleEnabled("ledger");
    await requireModuleEnabled("item");
    const { userId } = assertUserContext(request);
    return {
      result: await claimAllMailboxAttachments(userId),
    };
  });

  app.post("/v1/me/mailbox/archive-read", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("mailbox");
    const { userId } = assertUserContext(request);
    return {
      result: await archiveReadMailboxMessages(userId),
    };
  });

  app.get("/v1/internal/mailbox/ops-campaigns", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("mailbox");
    const { userId } = assertUserContext(request);
    const query = mailboxOpsCampaignsQuerySchema.parse(request.query ?? {});
    return {
      campaigns: await listMailboxOpsCampaignsForOperator(userId, {
        limit: query.limit ?? 40,
        status: query.status ?? null,
      }),
    };
  });

  app.get<{ Params: z.infer<typeof mailboxOpsCampaignParamsSchema> }>(
    "/v1/internal/mailbox/ops-campaigns/:campaignId/deliveries",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { campaignId } = mailboxOpsCampaignParamsSchema.parse(request.params);
      const query = mailboxOpsCampaignDeliveriesQuerySchema.parse(request.query ?? {});
      return {
        deliveries: await listMailboxOpsCampaignDeliveriesForOperator(userId, campaignId, query.limit ?? 24),
      };
    },
  );

  app.post<{ Body: z.infer<typeof mailboxOpsCampaignSchema> }>(
    "/v1/internal/mailbox/ops-campaigns",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const payload = mailboxOpsCampaignSchema.parse(request.body ?? {});
      return {
        campaign: await saveMailboxOpsCampaignForOperator(userId, payload),
      };
    },
  );

  app.post<{
    Params: z.infer<typeof mailboxOpsCampaignParamsSchema>;
    Body: z.infer<typeof mailboxOpsCampaignSchema>;
  }>(
    "/v1/internal/mailbox/ops-campaigns/:campaignId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { campaignId } = mailboxOpsCampaignParamsSchema.parse(request.params);
      const payload = mailboxOpsCampaignSchema.parse(request.body ?? {});
      return {
        campaign: await saveMailboxOpsCampaignForOperator(userId, payload, campaignId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof mailboxOpsCampaignParamsSchema> }>(
    "/v1/internal/mailbox/ops-campaigns/:campaignId/dispatch",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { campaignId } = mailboxOpsCampaignParamsSchema.parse(request.params);
      return {
        result: await dispatchMailboxOpsCampaignForOperator(userId, campaignId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof mailboxOpsCampaignParamsSchema> }>(
    "/v1/internal/mailbox/ops-campaigns/:campaignId/cancel",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { campaignId } = mailboxOpsCampaignParamsSchema.parse(request.params);
      return {
        campaign: await cancelMailboxOpsCampaignForOperator(userId, campaignId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof mailboxOpsCampaignParamsSchema> }>(
    "/v1/internal/mailbox/ops-campaigns/:campaignId/duplicate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { campaignId } = mailboxOpsCampaignParamsSchema.parse(request.params);
      return {
        campaign: await duplicateMailboxOpsCampaignForOperator(userId, campaignId),
      };
    },
  );

  app.get("/v1/internal/mailbox/ops-templates", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("mailbox");
    const { userId } = assertUserContext(request);
    const query = mailboxOpsTemplatesQuerySchema.parse(request.query ?? {});
    return {
      templates: await listMailboxOpsTemplatesForOperator(userId, {
        limit: query.limit ?? 24,
      }),
    };
  });

  app.post<{ Body: z.infer<typeof mailboxOpsTemplateSchema> }>(
    "/v1/internal/mailbox/ops-templates",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const payload = mailboxOpsTemplateSchema.parse(request.body ?? {});
      return {
        template: await saveMailboxOpsTemplateForOperator(userId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof mailboxOpsTemplateParamsSchema> }>(
    "/v1/internal/mailbox/ops-templates/:templateId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { templateId } = mailboxOpsTemplateParamsSchema.parse(request.params);
      await deleteMailboxOpsTemplateForOperator(userId, templateId);
      return { ok: true as const };
    },
  );

  app.get("/v1/internal/mailbox/ops-recipient-batches", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("mailbox");
    const { userId } = assertUserContext(request);
    const query = mailboxOpsRecipientBatchesQuerySchema.parse(request.query ?? {});
    return {
      batches: await listMailboxOpsRecipientBatchesForOperator(userId, {
        limit: query.limit ?? 24,
      }),
    };
  });

  app.post<{ Body: z.infer<typeof mailboxOpsRecipientBatchSchema> }>(
    "/v1/internal/mailbox/ops-recipient-batches",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const payload = mailboxOpsRecipientBatchSchema.parse(request.body ?? {});
      return {
        batch: await saveMailboxOpsRecipientBatchForOperator(userId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof mailboxOpsRecipientBatchParamsSchema> }>(
    "/v1/internal/mailbox/ops-recipient-batches/:batchId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("mailbox");
      const { userId } = assertUserContext(request);
      const { batchId } = mailboxOpsRecipientBatchParamsSchema.parse(request.params);
      await deleteMailboxOpsRecipientBatchForOperator(userId, batchId);
      return { ok: true as const };
    },
  );

};
