import {
  archiveReadMailboxMessages,
  claimAllMailboxAttachments,
  claimMailboxAttachment,
  claimMailboxMessageAttachments,
  deleteMailboxMessage,
  listMailbox,
  markMailboxMessageRead,
  setMailboxMessageFavorite,
} from "@/features/mailbox/account-adapter";
import { requirePlatformUserContext } from "@/lib/platform-session";

const DEFAULT_CACHE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate",
} as const;

type MailboxOperationOptions = {
  fallbackMessage: string;
  fallbackStatus: number;
  responseInit?: ResponseInit;
};

type MailboxMessageRouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

function withNoCache(body: unknown, init?: ResponseInit) {
  const headers: Record<string, string> = { ...DEFAULT_CACHE_HEADERS };
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, init.headers);
    }
  }

  return Response.json(body, {
    ...init,
    headers,
  });
}

function mailboxErrorResponse(error: unknown, fallbackMessage: string, fallbackStatus: number) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = message === "Authentication required" ? 401 : fallbackStatus;
  return withNoCache({ error: message }, { status });
}

async function runMailboxOperation<T>(
  executor: () => Promise<T>,
  options: MailboxOperationOptions,
) {
  try {
    const payload = await executor();
    return withNoCache(payload, options.responseInit);
  } catch (error) {
    return mailboxErrorResponse(error, options.fallbackMessage, options.fallbackStatus);
  }
}

export async function handleMailboxMessagesRequest() {
  return runMailboxOperation(
    async () => {
      const userContext = await requirePlatformUserContext();
      const messages = await listMailbox(userContext);
      return { messages };
    },
    { fallbackMessage: "Mailbox unavailable", fallbackStatus: 503 },
  );
}

export async function handleMailboxClaimRequest(request: Request) {
  const body = (await request.json()) as {
    messageId?: string;
    attachmentId?: string;
  };
  const messageId = String(body.messageId || "").trim();
  const attachmentId = String(body.attachmentId || "").trim();

  if (!messageId || !attachmentId) {
    return withNoCache(
      { error: "邮箱附件参数无效。" },
      {
        status: 400,
      },
    );
  }

  return runMailboxOperation(
    async () => {
      const userContext = await requirePlatformUserContext();
      return claimMailboxAttachment(userContext, { messageId, attachmentId });
    },
    {
      fallbackMessage: "Mailbox claim failed",
      fallbackStatus: 409,
    },
  );
}

export async function handleMailboxClaimAllRequest() {
  return runMailboxOperation(
    async () => {
      const userContext = await requirePlatformUserContext();
      return { result: await claimAllMailboxAttachments(userContext) };
    },
    {
      fallbackMessage: "Mailbox claim-all failed",
      fallbackStatus: 409,
    },
  );
}

export async function handleMailboxArchiveReadRequest() {
  return runMailboxOperation(
    async () => {
      const userContext = await requirePlatformUserContext();
      return { result: await archiveReadMailboxMessages(userContext) };
    },
    {
      fallbackMessage: "Mailbox archive-read failed",
      fallbackStatus: 409,
    },
  );
}

async function resolveMessageId(context: MailboxMessageRouteContext) {
  const { messageId } = await context.params;
  return messageId;
}

export async function handleMailboxMessageReadRequest(_: Request, context: MailboxMessageRouteContext) {
  return runMailboxOperation(
    async () => {
      const messageId = await resolveMessageId(context);
      const userContext = await requirePlatformUserContext();
      const message = await markMailboxMessageRead(userContext, messageId);
      return { message };
    },
    {
      fallbackMessage: "Mailbox read failed",
      fallbackStatus: 409,
    },
  );
}

export async function handleMailboxMessageFavoriteRequest(request: Request, context: MailboxMessageRouteContext) {
  return runMailboxOperation(
    async () => {
      const messageId = await resolveMessageId(context);
      const payload = (await request.json()) as { favorited?: boolean };
      const userContext = await requirePlatformUserContext();
      const result = await setMailboxMessageFavorite(userContext, messageId, Boolean(payload.favorited));
      return { result };
    },
    {
      fallbackMessage: "Mailbox favorite update failed",
      fallbackStatus: 409,
    },
  );
}

export async function handleMailboxMessageDeleteRequest(_: Request, context: MailboxMessageRouteContext) {
  return runMailboxOperation(
    async () => {
      const messageId = await resolveMessageId(context);
      const userContext = await requirePlatformUserContext();
      const result = await deleteMailboxMessage(userContext, messageId);
      return { result };
    },
    {
      fallbackMessage: "Mailbox delete failed",
      fallbackStatus: 409,
    },
  );
}

export async function handleMailboxMessageClaimAllRequest(_: Request, context: MailboxMessageRouteContext) {
  return runMailboxOperation(
    async () => {
      const messageId = await resolveMessageId(context);
      const userContext = await requirePlatformUserContext();
      const result = await claimMailboxMessageAttachments(userContext, messageId);
      return { result };
    },
    {
      fallbackMessage: "Mailbox message claim failed",
      fallbackStatus: 409,
    },
  );
}
