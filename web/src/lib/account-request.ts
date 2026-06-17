import type { ApiErrorPayload, InternalUserContext } from "@neuro/contracts";

import { fetchInternal, resolveInternalRequestTimeoutMs } from "@/lib/internal-request";

const accountInternalUrl =
  process.env.ACCOUNT_INTERNAL_URL || process.env.CORE_INTERNAL_URL || "http://127.0.0.1:4000";
const internalApiToken = process.env.INTERNAL_API_TOKEN || "";
const accountRequestTimeoutMs = resolveInternalRequestTimeoutMs(
  process.env.ACCOUNT_INTERNAL_FETCH_TIMEOUT_MS,
  process.env.INTERNAL_FETCH_TIMEOUT_MS,
);

type AccountRequestError = Error & {
  code?: ApiErrorPayload["code"];
};

type AccountRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  userContext?: InternalUserContext | null;
};

type ApiErrorResponseBody = {
  error?: ApiErrorPayload;
  message?: string;
  code?: ApiErrorPayload["code"];
} | null;

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

export async function accountRequest<T>(pathname: string, options: AccountRequestOptions = {}): Promise<T> {
  const hasJsonBody = options.body !== undefined;
  const response = await fetchInternal(`${accountInternalUrl}${pathname}`, {
    targetService: "account",
    method: options.method || "GET",
    headers: buildHeaders(options.userContext, hasJsonBody),
    body: hasJsonBody ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    timeoutMs: accountRequestTimeoutMs,
  });

  if (!response.ok) {
    const payload = await parseApiErrorResponse(response);
    const message = payload?.error?.message || payload?.message || `Account request failed: ${pathname}`;
    const error = new Error(message) as AccountRequestError;
    error.code = payload?.error?.code || payload?.code;
    throw error;
  }

  return (await response.json()) as T;
}
