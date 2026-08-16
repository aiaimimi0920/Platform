import {
  type ClaimMailboxAttachmentInput,
  type InternalUserContext,
  type MailboxMessageView,
} from "@neuro/contracts";

import { coreRequest } from "./request";

export async function listMailbox(userContext: InternalUserContext) {
  const response = await coreRequest<{ messages: MailboxMessageView[] }>("/v1/mailbox/messages", {
    userContext,
  });
  return response.messages;
}

export async function claimMailboxAttachment(userContext: InternalUserContext, input: ClaimMailboxAttachmentInput) {
  return coreRequest("/v1/mailbox/claim", {
    method: "POST",
    body: input,
    userContext,
  });
}
