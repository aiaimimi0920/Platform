import type {
  ArchiveReadMailboxMessagesResult,
  ClaimAllMailboxAttachmentsResult,
  ClaimMailboxAttachmentInput,
  ClaimMailboxMessageAttachmentsResult,
  DeleteMailboxMessageResult,
  InternalUserContext,
  MailboxMessageView,
  SetMailboxMessageFavoriteResult,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

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
