import type {
  CreateHeavyChatThreadRequest,
  HeavyChatSnapshot,
  InternalUserContext,
  RetryHeavyChatMessageRequest,
  SendHeavyChatMessageRequest,
} from "@neuro/contracts";
import { z } from "zod";

import {
  createHeavyChatThread,
  getHeavyChatSnapshot,
  HeavyChatWebClientError,
  retryHeavyChatMessage,
  sendHeavyChatMessage,
} from "@/lib/heavy-chat-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

import { adaptHeavyChatSnapshot } from "./adapter";
import type { HeavyWorkspaceSnapshot } from "./types";

const threadRequestSchema = z.object({
  slotId: z.string().trim().min(1).max(200),
  projectId: z.string().trim().min(1).max(200).nullable().optional(),
  title: z.string().trim().min(1).max(200),
});

const sendRequestSchema = z.object({
  content: z.string().trim().min(1).max(100_000),
  idempotencyKey: z.string().trim().min(1).max(500),
  correlationId: z.string().trim().min(1).max(200).optional(),
});

const retryRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(500),
  correlationId: z.string().trim().min(1).max(200).optional(),
});

type HeavyChatServerDependencies = {
  requireUserContext?: () => Promise<InternalUserContext>;
  getSnapshot?: (context: InternalUserContext) => Promise<HeavyChatSnapshot>;
  createThread?: (context: InternalUserContext, input: CreateHeavyChatThreadRequest) => Promise<unknown>;
  sendMessage?: (
    context: InternalUserContext,
    threadId: string,
    input: SendHeavyChatMessageRequest,
  ) => Promise<unknown>;
  retryMessage?: (
    context: InternalUserContext,
    messageId: string,
    input: RetryHeavyChatMessageRequest,
  ) => Promise<unknown>;
};

const noStoreHeaders = {
  "cache-control": "no-store, no-cache, must-revalidate",
};

class HeavyChatBrowserRequestError extends Error {
  override name = "HeavyChatBrowserRequestError";
}

function defaultDependencies(): Required<HeavyChatServerDependencies> {
  return {
    requireUserContext: requirePlatformUserContext,
    getSnapshot: getHeavyChatSnapshot,
    createThread: createHeavyChatThread,
    sendMessage: sendHeavyChatMessage,
    retryMessage: retryHeavyChatMessage,
  };
}

function mergeDependencies(dependencies?: HeavyChatServerDependencies) {
  return { ...defaultDependencies(), ...dependencies };
}

function errorResponse(error: unknown) {
  if (error instanceof HeavyChatWebClientError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode, headers: noStoreHeaders },
    );
  }
  if (error instanceof Error && error.message === "Authentication required") {
    return Response.json({ error: error.message }, { status: 401, headers: noStoreHeaders });
  }
  return Response.json(
    { error: "Heavy chat service is temporarily unavailable" },
    { status: 503, headers: noStoreHeaders },
  );
}

async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HeavyChatBrowserRequestError("Invalid JSON request body");
  }
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue?.path.join(".");
  throw new HeavyChatBrowserRequestError(
    field ? `${field}: ${issue?.message || "Invalid value"}` : issue?.message || "Invalid request body",
  );
}

export async function loadHeavyChatWorkspace(
  context: InternalUserContext,
  dependencies?: Pick<HeavyChatServerDependencies, "getSnapshot">,
): Promise<{ workspace: HeavyWorkspaceSnapshot; error: string | null }> {
  try {
    const snapshot = await (dependencies?.getSnapshot ?? getHeavyChatSnapshot)(context);
    return { workspace: adaptHeavyChatSnapshot(snapshot), error: null };
  } catch (error) {
    const message = error instanceof HeavyChatWebClientError
      ? error.message
      : "Heavy chat service is temporarily unavailable";
    return {
      workspace: { slots: [], projects: [], threads: [] },
      error: message,
    };
  }
}

export async function handleHeavyChatSnapshotRequest(
  _request: Request,
  dependencies?: HeavyChatServerDependencies,
) {
  const resolved = mergeDependencies(dependencies);
  try {
    const context = await resolved.requireUserContext();
    const snapshot = await resolved.getSnapshot(context);
    return Response.json({ snapshot }, { headers: noStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleHeavyChatCreateThreadRequest(
  request: Request,
  dependencies?: HeavyChatServerDependencies,
) {
  const resolved = mergeDependencies(dependencies);
  try {
    const context = await resolved.requireUserContext();
    const input = await parseJson(request, threadRequestSchema);
    const thread = await resolved.createThread(context, input);
    return Response.json({ thread }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof HeavyChatBrowserRequestError) {
      return Response.json({ error: error.message }, { status: 400, headers: noStoreHeaders });
    }
    return errorResponse(error);
  }
}

export async function handleHeavyChatSendMessageRequest(
  threadId: string,
  request: Request,
  dependencies?: HeavyChatServerDependencies,
) {
  const resolved = mergeDependencies(dependencies);
  try {
    const context = await resolved.requireUserContext();
    const input = await parseJson(request, sendRequestSchema);
    const result = await resolved.sendMessage(context, threadId, input);
    return Response.json({ result }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof HeavyChatBrowserRequestError) {
      return Response.json({ error: error.message }, { status: 400, headers: noStoreHeaders });
    }
    return errorResponse(error);
  }
}

export async function handleHeavyChatRetryMessageRequest(
  messageId: string,
  request: Request,
  dependencies?: HeavyChatServerDependencies,
) {
  const resolved = mergeDependencies(dependencies);
  try {
    const context = await resolved.requireUserContext();
    const input = await parseJson(request, retryRequestSchema);
    const result = await resolved.retryMessage(context, messageId, input);
    return Response.json({ result }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof HeavyChatBrowserRequestError) {
      return Response.json({ error: error.message }, { status: 400, headers: noStoreHeaders });
    }
    return errorResponse(error);
  }
}
