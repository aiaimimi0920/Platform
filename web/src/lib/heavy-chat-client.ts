import type {
  ApiErrorCode,
  CreateHeavyChatThreadRequest,
  HeavyChatMessageActionRequest,
  HeavyChatMessageActionResult,
  HeavyChatMessageAttemptResult,
  HeavyChatMessagePage,
  HeavyChatSendMessageResult,
  HeavyChatSnapshot,
  HeavyChatThreadView,
  InternalUserContext,
  RetryHeavyChatMessageRequest,
  SendHeavyChatMessageRequest,
} from "@neuro/contracts";

import {
  classifyInternalDependencyError,
  fetchInternal,
  resolveInternalRequestTimeoutMs,
  type ClassifiedInternalDependencyError,
} from "./internal-request";

type HeavyChatCoreRequestOptions = {
  body?: unknown;
  method?: "GET" | "POST";
  userContext: InternalUserContext;
};

type HeavyChatErrorBody = {
  error?: {
    code?: ApiErrorCode;
    message?: string;
  };
  code?: ApiErrorCode;
  message?: string;
} | null;

export class HeavyChatWebClientError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode | undefined;
  readonly category: ClassifiedInternalDependencyError["category"];
  readonly service: ClassifiedInternalDependencyError["service"];
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly occurredAt: string;
  readonly retryable: boolean;
  readonly diagnostics: string;
  readonly responseBody: unknown;

  constructor(
    statusCode: number,
    message: string,
    code: ApiErrorCode | undefined,
    responseBody: unknown,
    dependency: ClassifiedInternalDependencyError,
  ) {
    super(message);
    this.name = "HeavyChatWebClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.category = dependency.category;
    this.service = dependency.service;
    this.requestId = dependency.requestId;
    this.correlationId = dependency.correlationId;
    this.occurredAt = dependency.occurredAt;
    this.retryable = dependency.retryable;
    this.diagnostics = dependency.diagnostics;
    this.responseBody = responseBody;
  }
}

function buildHeaders(userContext: InternalUserContext, hasJsonBody: boolean) {
  const headers: Record<string, string> = {
    "x-internal-api-token": process.env.INTERNAL_API_TOKEN || "",
    "x-neuro-user-id": userContext.userId,
  };
  if (hasJsonBody) headers["content-type"] = "application/json";
  if (userContext.providerUserId) headers["x-neuro-provider-user-id"] = userContext.providerUserId;
  if (userContext.username) headers["x-neuro-username"] = userContext.username;
  return headers;
}

function buildCoreUrl(pathname: string) {
  const baseUrl = (process.env.CORE_INTERNAL_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function normalizeErrorBody(body: unknown): { code: ApiErrorCode | undefined; message: string } {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const payload = body as HeavyChatErrorBody;
    if (payload?.error && typeof payload.error === "object") {
      return {
        code: payload.error.code,
        message: payload.error.message || "Heavy chat request failed",
      };
    }
    return {
      code: payload?.code,
      message: payload?.message || "Heavy chat request failed",
    };
  }
  return {
    code: undefined,
    message: typeof body === "string" && body.trim() ? body.trim() : "Heavy chat request failed",
  };
}

async function heavyChatCoreRequest<T>(pathname: string, options: HeavyChatCoreRequestOptions): Promise<T> {
  const hasJsonBody = options.body !== undefined;
  const response = await fetchInternal(buildCoreUrl(pathname), {
    targetService: "core",
    method: options.method ?? "GET",
    headers: buildHeaders(options.userContext, hasJsonBody),
    body: hasJsonBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    timeoutMs: resolveInternalRequestTimeoutMs(
      process.env.CORE_INTERNAL_FETCH_TIMEOUT_MS,
      process.env.INTERNAL_FETCH_TIMEOUT_MS,
    ),
  });
  const responseForClassification = response.clone();
  const body = await parseResponseBody(response);
  if (!response.ok) {
    const normalized = normalizeErrorBody(body);
    const dependency = await classifyInternalDependencyError(responseForClassification, {
      targetService: "core",
      fallbackMessage: "Heavy chat request failed",
    });
    throw new HeavyChatWebClientError(response.status, normalized.message, normalized.code, body, dependency);
  }
  return body as T;
}

export async function getHeavyChatSnapshot(userContext: InternalUserContext): Promise<HeavyChatSnapshot> {
  const response = await heavyChatCoreRequest<{ snapshot: HeavyChatSnapshot }>("/v1/me/heavy-chat/snapshot", {
    userContext,
  });
  return response.snapshot;
}

export async function getHeavyChatMessagePage(
  userContext: InternalUserContext,
  threadId: string,
  options: { beforeSequence?: number; limit?: number } = {},
): Promise<HeavyChatMessagePage> {
  const query = new URLSearchParams();
  if (options.beforeSequence !== undefined) query.set("beforeSequence", String(options.beforeSequence));
  if (options.limit !== undefined) query.set("limit", String(options.limit));
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await heavyChatCoreRequest<{ page: HeavyChatMessagePage }>(
    `/v1/me/heavy-chat/threads/${encodeURIComponent(threadId)}/messages${suffix}`,
    { userContext },
  );
  return response.page;
}

export async function createHeavyChatThread(
  userContext: InternalUserContext,
  input: CreateHeavyChatThreadRequest,
): Promise<HeavyChatThreadView> {
  const response = await heavyChatCoreRequest<{ thread: HeavyChatThreadView }>("/v1/me/heavy-chat/threads", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.thread;
}

export async function sendHeavyChatMessage(
  userContext: InternalUserContext,
  threadId: string,
  input: SendHeavyChatMessageRequest,
): Promise<HeavyChatSendMessageResult> {
  const response = await heavyChatCoreRequest<{ result: HeavyChatSendMessageResult }>(
    `/v1/me/heavy-chat/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function retryHeavyChatMessage(
  userContext: InternalUserContext,
  messageId: string,
  input: RetryHeavyChatMessageRequest,
): Promise<HeavyChatMessageAttemptResult> {
  const response = await heavyChatCoreRequest<{ result: HeavyChatMessageAttemptResult }>(
    `/v1/me/heavy-chat/messages/${encodeURIComponent(messageId)}/retry`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function runHeavyChatMessageAction(
  userContext: InternalUserContext,
  messageId: string,
  input: HeavyChatMessageActionRequest,
): Promise<HeavyChatMessageActionResult> {
  const response = await heavyChatCoreRequest<{ result: HeavyChatMessageActionResult }>(
    `/v1/me/heavy-chat/messages/${encodeURIComponent(messageId)}/actions`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}
