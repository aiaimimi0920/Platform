import type { ApiErrorPayload, InternalUserContext } from "@neuro/contracts";

const accountInternalUrl =
  process.env.ACCOUNT_INTERNAL_URL || process.env.CORE_INTERNAL_URL || "http://127.0.0.1:4000";
const internalApiToken = process.env.INTERNAL_API_TOKEN || "";
const accountRequestRetryDelaysMs = [200, 600] as const;
const retryableAccountFetchErrorCodes = new Set(["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ETIMEDOUT"]);

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

function isRetryableAccountFetchError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const cause = error.cause as { code?: string } | undefined;
  return typeof cause?.code === "string" && retryableAccountFetchErrorCodes.has(cause.code);
}

async function waitForAccountRetry(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

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
  let response: Response | null = null;

  for (let attempt = 0; attempt <= accountRequestRetryDelaysMs.length; attempt += 1) {
    try {
      response = await fetch(`${accountInternalUrl}${pathname}`, {
        method: options.method || "GET",
        headers: buildHeaders(options.userContext, hasJsonBody),
        body: hasJsonBody ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
      });
      break;
    } catch (error) {
      if (!isRetryableAccountFetchError(error) || attempt === accountRequestRetryDelaysMs.length) {
        throw error;
      }
      await waitForAccountRetry(accountRequestRetryDelaysMs[attempt]);
    }
  }

  if (!response) {
    throw new Error(`Account request failed before response: ${pathname}`);
  }

  if (!response.ok) {
    const payload = await parseApiErrorResponse(response);
    const message = payload?.error?.message || payload?.message || `Account request failed: ${pathname}`;
    const error = new Error(message) as AccountRequestError;
    error.code = payload?.error?.code || payload?.code;
    throw error;
  }

  return (await response.json()) as T;
}
