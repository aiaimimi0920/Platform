type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type InternalRequestError = Error & {
  code?: "INTERNAL_REQUEST_TIMEOUT" | "INTERNAL_REQUEST_NETWORK_ERROR";
};

type FetchInternalOptions = Omit<RequestInit, "signal"> & {
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  retryMethods?: readonly string[];
  fetchImpl?: FetchLike;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAYS_MS = [200, 600] as const;
const DEFAULT_RETRY_METHODS = ["GET"] as const;
const RETRYABLE_FETCH_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ETIMEDOUT",
]);

function getFetchErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const cause = error.cause as { code?: unknown } | undefined;
  return typeof cause?.code === "string" ? cause.code : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRetryableFetchError(error: unknown): boolean {
  const code = getFetchErrorCode(error);
  return code !== null && RETRYABLE_FETCH_ERROR_CODES.has(code);
}

function normalizeNetworkError(error: unknown): never {
  if (error instanceof Error) {
    const normalized = error as InternalRequestError;
    normalized.code = "INTERNAL_REQUEST_NETWORK_ERROR";
    throw normalized;
  }
  const normalized = new Error("Internal request network error") as InternalRequestError;
  normalized.code = "INTERNAL_REQUEST_NETWORK_ERROR";
  throw normalized;
}

function normalizeTimeoutError(error: unknown): never {
  const message = error instanceof Error && error.message ? error.message : "Internal request timed out";
  const normalized = new Error(message) as InternalRequestError;
  normalized.code = "INTERNAL_REQUEST_TIMEOUT";
  throw normalized;
}

async function waitForRetry(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function resolveInternalRequestTimeoutMs(...values: Array<string | undefined>): number {
  for (const value of values) {
    if (!value) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 250) {
      return Math.floor(parsed);
    }
  }
  return DEFAULT_TIMEOUT_MS;
}

export async function fetchInternal(input: string, options: FetchInternalOptions = {}): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    retryMethods = DEFAULT_RETRY_METHODS,
    fetchImpl = fetch,
    ...requestInit
  } = options;
  const method = (requestInit.method ?? "GET").toUpperCase();
  const canRetry = retryMethods.map((item) => item.toUpperCase()).includes(method);
  const maxAttempts = canRetry ? retryDelaysMs.length + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(input, {
        ...requestInit,
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        normalizeTimeoutError(error);
      }
      if (!isRetryableFetchError(error)) {
        normalizeNetworkError(error);
      }
      if (attempt >= maxAttempts - 1) {
        normalizeNetworkError(error);
      }
      await waitForRetry(retryDelaysMs[attempt] ?? 0);
    } finally {
      clearTimeout(timeout);
    }
  }

  const unreachable = new Error("Internal request failed before response") as InternalRequestError;
  unreachable.code = "INTERNAL_REQUEST_NETWORK_ERROR";
  throw unreachable;
}
