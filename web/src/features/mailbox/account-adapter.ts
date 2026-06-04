import { accountRequest } from "@/lib/account-request";
import type {
  ArchiveReadMailboxMessagesResult,
  ClaimAllMailboxAttachmentsResult,
  ClaimMailboxAttachmentInput,
  ClaimMailboxMessageAttachmentsResult,
  DeleteMailboxMessageResult,
  InternalUserContext,
  MailboxMessageView,
  MailboxOpsCampaignDeliveryView,
  MailboxOpsCampaignDispatchResult,
  MailboxOpsCampaignView,
  MailboxOpsRecipientBatchView,
  MailboxOpsTemplateView,
  ListMailboxOpsCampaignsInput,
  ListMailboxOpsRecipientBatchesInput,
  ListMailboxOpsTemplatesInput,
  SetMailboxMessageFavoriteResult,
  UpsertMailboxOpsCampaignInput,
  UpsertMailboxOpsRecipientBatchInput,
  UpsertMailboxOpsTemplateInput,
} from "@neuro/contracts";

export async function listMailbox(userContext: InternalUserContext) {
  const response = await accountRequest<{ messages: MailboxMessageView[] }>("/v1/me/mailbox/messages", {
    userContext,
  });
  return response.messages;
}

export async function claimMailboxAttachment(userContext: InternalUserContext, input: ClaimMailboxAttachmentInput) {
  return accountRequest("/v1/me/mailbox/claim", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function markMailboxMessageRead(userContext: InternalUserContext, messageId: string) {
  const response = await accountRequest<{ message: { messageId: string; readAt: string } }>(
    `/v1/me/mailbox/messages/${encodeURIComponent(messageId)}/read`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.message;
}

export async function setMailboxMessageFavorite(
  userContext: InternalUserContext,
  messageId: string,
  favorited: boolean,
) {
  const response = await accountRequest<{ result: SetMailboxMessageFavoriteResult }>(
    `/v1/me/mailbox/messages/${encodeURIComponent(messageId)}/favorite`,
    {
      method: "POST",
      body: {
        favorited,
      },
      userContext,
    },
  );
  return response.result;
}

export async function deleteMailboxMessage(userContext: InternalUserContext, messageId: string) {
  const response = await accountRequest<{ result: DeleteMailboxMessageResult }>(
    `/v1/me/mailbox/messages/${encodeURIComponent(messageId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function claimMailboxMessageAttachments(userContext: InternalUserContext, messageId: string) {
  const response = await accountRequest<{ result: ClaimMailboxMessageAttachmentsResult }>(
    `/v1/me/mailbox/messages/${encodeURIComponent(messageId)}/claim-all`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function claimAllMailboxAttachments(userContext: InternalUserContext) {
  const response = await accountRequest<{ result: ClaimAllMailboxAttachmentsResult }>("/v1/me/mailbox/claim-all", {
    method: "POST",
    userContext,
  });
  return response.result;
}

export async function archiveReadMailboxMessages(userContext: InternalUserContext) {
  const response = await accountRequest<{ result: ArchiveReadMailboxMessagesResult }>("/v1/me/mailbox/archive-read", {
    method: "POST",
    userContext,
  });
  return response.result;
}

export async function listOperatorMailboxOpsCampaigns(
  userContext: InternalUserContext,
  input?: ListMailboxOpsCampaignsInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  if (input?.status) {
    params.set("status", input.status);
  }
  const pathname = params.size
    ? `/v1/internal/mailbox/ops-campaigns?${params.toString()}`
    : "/v1/internal/mailbox/ops-campaigns";
  const response = await accountRequest<{ campaigns: MailboxOpsCampaignView[] }>(pathname, {
    userContext,
  });
  return response.campaigns;
}

export async function listOperatorMailboxOpsCampaignDeliveries(
  userContext: InternalUserContext,
  campaignId: string,
  input?: { limit?: number | null },
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/deliveries?${params.toString()}`
    : `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/deliveries`;
  const response = await accountRequest<{ deliveries: MailboxOpsCampaignDeliveryView[] }>(pathname, {
    userContext,
  });
  return response.deliveries;
}

export async function createOperatorMailboxOpsCampaign(
  userContext: InternalUserContext,
  input: UpsertMailboxOpsCampaignInput,
) {
  const response = await accountRequest<{ campaign: MailboxOpsCampaignView }>("/v1/internal/mailbox/ops-campaigns", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.campaign;
}

export async function updateOperatorMailboxOpsCampaign(
  userContext: InternalUserContext,
  campaignId: string,
  input: UpsertMailboxOpsCampaignInput,
) {
  const response = await accountRequest<{ campaign: MailboxOpsCampaignView }>(
    `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.campaign;
}

export async function dispatchOperatorMailboxOpsCampaign(userContext: InternalUserContext, campaignId: string) {
  const response = await accountRequest<{ result: MailboxOpsCampaignDispatchResult }>(
    `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/dispatch`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function cancelOperatorMailboxOpsCampaign(userContext: InternalUserContext, campaignId: string) {
  const response = await accountRequest<{ campaign: MailboxOpsCampaignView }>(
    `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/cancel`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.campaign;
}

export async function duplicateOperatorMailboxOpsCampaign(userContext: InternalUserContext, campaignId: string) {
  const response = await accountRequest<{ campaign: MailboxOpsCampaignView }>(
    `/v1/internal/mailbox/ops-campaigns/${encodeURIComponent(campaignId)}/duplicate`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.campaign;
}

export async function listOperatorMailboxOpsTemplates(
  userContext: InternalUserContext,
  input?: ListMailboxOpsTemplatesInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size ? `/v1/internal/mailbox/ops-templates?${params.toString()}` : "/v1/internal/mailbox/ops-templates";
  const response = await accountRequest<{ templates: MailboxOpsTemplateView[] }>(pathname, {
    userContext,
  });
  return response.templates;
}

export async function saveOperatorMailboxOpsTemplate(userContext: InternalUserContext, input: UpsertMailboxOpsTemplateInput) {
  const response = await accountRequest<{ template: MailboxOpsTemplateView }>("/v1/internal/mailbox/ops-templates", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.template;
}

export async function deleteOperatorMailboxOpsTemplate(userContext: InternalUserContext, templateId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/mailbox/ops-templates/${encodeURIComponent(templateId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listOperatorMailboxOpsRecipientBatches(
  userContext: InternalUserContext,
  input?: ListMailboxOpsRecipientBatchesInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/mailbox/ops-recipient-batches?${params.toString()}`
    : "/v1/internal/mailbox/ops-recipient-batches";
  const response = await accountRequest<{ batches: MailboxOpsRecipientBatchView[] }>(pathname, {
    userContext,
  });
  return response.batches;
}

export async function saveOperatorMailboxOpsRecipientBatch(
  userContext: InternalUserContext,
  input: UpsertMailboxOpsRecipientBatchInput,
) {
  const response = await accountRequest<{ batch: MailboxOpsRecipientBatchView }>(
    "/v1/internal/mailbox/ops-recipient-batches",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.batch;
}

export async function deleteOperatorMailboxOpsRecipientBatch(userContext: InternalUserContext, batchId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/mailbox/ops-recipient-batches/${encodeURIComponent(batchId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}
