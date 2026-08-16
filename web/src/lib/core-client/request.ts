import type { ApiErrorPayload, InternalUserContext } from "@neuro/contracts";

import {
  classifyInternalDependencyError,
  fetchInternal,
  resolveInternalRequestTimeoutMs,
  type ClassifiedInternalDependencyError,
} from "@/lib/internal-request";

const coreInternalUrl = process.env.CORE_INTERNAL_URL || "http://127.0.0.1:4000";
const internalApiToken = process.env.INTERNAL_API_TOKEN || "";
const coreRequestTimeoutMs = resolveInternalRequestTimeoutMs(
  process.env.CORE_INTERNAL_FETCH_TIMEOUT_MS,
  process.env.INTERNAL_FETCH_TIMEOUT_MS,
);

type CoreRequestError = Error & {
  code?: ApiErrorPayload["code"];
  status?: number | null;
  statusCode?: number | null;
  category?: ClassifiedInternalDependencyError["category"];
  service?: ClassifiedInternalDependencyError["service"];
  requestId?: string | null;
  correlationId?: string | null;
  occurredAt?: string;
  retryable?: boolean;
  diagnostics?: string;
  publicMessage?: string;
};

type CoreRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  userContext?: InternalUserContext | null;
};

function buildHeaders(userContext?: InternalUserContext | null, hasJsonBody = false): HeadersInit {
  const headers: Record<string, string> = {
    "x-internal-api-token": internalApiToken,
  };

  if (hasJsonBody) {
    headers["content-type"] = "application/json";
  }

  if (userContext?.userId) {
    headers["x-neuro-user-id"] = userContext.userId;
  }

  if (userContext?.providerUserId) {
    headers["x-neuro-provider-user-id"] = userContext.providerUserId;
  }

  if (userContext?.username) {
    headers["x-neuro-username"] = userContext.username;
  }

  return headers;
}

export async function coreRequest<T>(pathname: string, options: CoreRequestOptions = {}): Promise<T> {
  const hasJsonBody = options.body !== undefined;
  const response = await fetchInternal(`${coreInternalUrl}${pathname}`, {
    targetService: "core",
    method: options.method || "GET",
    headers: buildHeaders(options.userContext, hasJsonBody),
    body: hasJsonBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    timeoutMs: coreRequestTimeoutMs,
  });

  if (!response.ok) {
    const classified = await classifyInternalDependencyError(response, {
      targetService: "core",
      fallbackMessage: `Core request failed: ${pathname}`,
    });
    const message = classified.publicMessage;
    const error = new Error(message) as CoreRequestError;
    error.code = classified.code as ApiErrorPayload["code"] | undefined;
    error.status = classified.status;
    error.statusCode = classified.status;
    error.category = classified.category;
    error.service = classified.service;
    error.requestId = classified.requestId;
    error.correlationId = classified.correlationId;
    error.occurredAt = classified.occurredAt;
    error.retryable = classified.retryable;
    error.diagnostics = classified.diagnostics;
    error.publicMessage = classified.publicMessage;
    throw error;
  }

  return (await response.json()) as T;
}
