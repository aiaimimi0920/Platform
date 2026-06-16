import type { ApiErrorPayload, InternalUserContext } from "@neuro/contracts";

import { fetchInternal, resolveInternalRequestTimeoutMs } from "@/lib/internal-request";

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
};

type GatewayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  userContext?: InternalUserContext | null;
};

type ApiErrorResponseBody = {
  error?: ApiErrorPayload;
  message?: string;
  code?: ApiErrorPayload["code"];
} | null;

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

async function parseApiErrorResponse(response: Response): Promise<ApiErrorResponseBody> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ApiErrorResponseBody;
  } catch {
    return { message: raw };
  }
}

export async function gatewayRequest<T>(pathname: string, options: GatewayRequestOptions = {}): Promise<T> {
  const hasJsonBody = options.body !== undefined;
  const response = await fetchInternal(`${gatewayInternalUrl}${pathname}`, {
    method: options.method || "GET",
    headers: buildGatewayHeaders(options.userContext, hasJsonBody),
    body: hasJsonBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    timeoutMs: gatewayRequestTimeoutMs,
  });

  if (!response.ok) {
    const payload = await parseApiErrorResponse(response);
    const message = payload?.error?.message || payload?.message || `Gateway request failed: ${pathname}`;
    const error = new Error(message) as GatewayRequestError;
    error.code = payload?.error?.code || payload?.code;
    throw error;
  }

  return (await response.json()) as T;
}
