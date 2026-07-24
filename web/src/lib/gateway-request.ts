import type { ApiErrorPayload, InternalUserContext } from "@neuro/contracts";

import {
  classifyInternalDependencyError,
  fetchInternal,
  resolveInternalRequestTimeoutMs,
  type ClassifiedInternalDependencyError,
} from "@/lib/internal-request";

const gatewayInternalUrl = process.env.AI_GATEWAY_INTERNAL_URL || "http://127.0.0.1:4200";
const gatewayManagementToken =
  process.env.AI_GATEWAY_MANAGEMENT_TOKEN ||
  process.env.GATEWAY_MANAGEMENT_TOKEN ||
  process.env.INTERNAL_API_TOKEN ||
  "";
const gatewayRequestTimeoutMs = resolveInternalRequestTimeoutMs(
  process.env.GATEWAY_INTERNAL_FETCH_TIMEOUT_MS,
  process.env.INTERNAL_FETCH_TIMEOUT_MS,
);

type GatewayRequestError = Error & {
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

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  userContext?: InternalUserContext | null;
};

function buildGatewayHeaders(userContext?: InternalUserContext | null, hasJsonBody = false): HeadersInit {
  const headers: Record<string, string> = {};

  if (gatewayManagementToken) {
    headers["x-internal-api-key"] = gatewayManagementToken;
  }

  if (hasJsonBody) {
    headers["content-type"] = "application/json";
  }

  if (userContext?.userId) {
    headers["x-operator-user-id"] = userContext.userId;
    headers["x-user-id"] = userContext.userId;
  }

  if (userContext?.providerUserId) {
    headers["x-provider-user-id"] = userContext.providerUserId;
  }

  if (userContext?.username) {
    headers["x-neuro-username"] = userContext.username;
  }

  return headers;
}

export async function gatewayRequest<T>(pathname: string, options: GatewayRequestOptions = {}): Promise<T> {
  const hasJsonBody = options.body !== undefined;
  const response = await fetchInternal(`${gatewayInternalUrl}${pathname}`, {
    targetService: "gateway",
    method: options.method || "GET",
    headers: buildGatewayHeaders(options.userContext, hasJsonBody),
    body: hasJsonBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    timeoutMs: gatewayRequestTimeoutMs,
  });

  if (!response.ok) {
    const classified = await classifyInternalDependencyError(response, {
      targetService: "gateway",
      fallbackMessage: `Gateway request failed: ${pathname}`,
    });
    const message = classified.publicMessage;
    const error = new Error(message) as GatewayRequestError;
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
