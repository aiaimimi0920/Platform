type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type InternalRequestError = Error & {
  code?: "INTERNAL_REQUEST_TIMEOUT" | "INTERNAL_REQUEST_NETWORK_ERROR";
};

export type InternalRequestTargetService = "core" | "account" | "gateway" | "unknown";

export type InternalRequestTelemetryCounters = {
  timeoutCount: number;
  retryCount: number;
  networkErrorCount: number;
  lastEventAt: string | null;
};

export type InternalRequestTelemetrySnapshot = {
  generatedAt: string;
  totals: InternalRequestTelemetryCounters;
  byTargetService: Record<InternalRequestTargetService, InternalRequestTelemetryCounters>;
};

type FetchInternalOptions = Omit<RequestInit, "signal"> & {
  targetService?: InternalRequestTargetService;
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

function createTelemetryCounters(): InternalRequestTelemetryCounters {
  return {
    timeoutCount: 0,
    retryCount: 0,
    networkErrorCount: 0,
    lastEventAt: null,
  };
}

function createTargetTelemetryCounters(): Record<InternalRequestTargetService, InternalRequestTelemetryCounters> {
  return {
    core: createTelemetryCounters(),
    account: createTelemetryCounters(),
    gateway: createTelemetryCounters(),
    unknown: createTelemetryCounters(),
  };
}

const internalRequestTelemetry = {
  totals: createTelemetryCounters(),
  byTargetService: createTargetTelemetryCounters(),
};

function cloneTelemetryCounters(counters: InternalRequestTelemetryCounters): InternalRequestTelemetryCounters {
  return {
    timeoutCount: counters.timeoutCount,
    retryCount: counters.retryCount,
    networkErrorCount: counters.networkErrorCount,
    lastEventAt: counters.lastEventAt,
  };
}

function normalizeTargetService(targetService: InternalRequestTargetService | undefined): InternalRequestTargetService {
  if (targetService === "core" || targetService === "account" || targetService === "gateway") {
    return targetService;
  }
  return "unknown";
}

function recordInternalRequestTelemetry(
  targetService: InternalRequestTargetService,
  counterName: keyof Pick<InternalRequestTelemetryCounters, "timeoutCount" | "retryCount" | "networkErrorCount">,
) {
  const timestamp = new Date().toISOString();
  const targetCounters = internalRequestTelemetry.byTargetService[targetService];
  targetCounters[counterName] += 1;
  targetCounters.lastEventAt = timestamp;
  internalRequestTelemetry.totals[counterName] += 1;
  internalRequestTelemetry.totals.lastEventAt = timestamp;
}

export function getInternalRequestTelemetrySnapshot(): InternalRequestTelemetrySnapshot {
  return {
    generatedAt: new Date().toISOString(),
    totals: cloneTelemetryCounters(internalRequestTelemetry.totals),
    byTargetService: {
      core: cloneTelemetryCounters(internalRequestTelemetry.byTargetService.core),
      account: cloneTelemetryCounters(internalRequestTelemetry.byTargetService.account),
      gateway: cloneTelemetryCounters(internalRequestTelemetry.byTargetService.gateway),
      unknown: cloneTelemetryCounters(internalRequestTelemetry.byTargetService.unknown),
    },
  };
}

export function resetInternalRequestTelemetryForTests() {
  internalRequestTelemetry.totals = createTelemetryCounters();
  internalRequestTelemetry.byTargetService = createTargetTelemetryCounters();
}

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
    targetService: rawTargetService,
    ...requestInit
  } = options;
  const targetService = normalizeTargetService(rawTargetService);
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
        recordInternalRequestTelemetry(targetService, "timeoutCount");
        normalizeTimeoutError(error);
      }
      if (!isRetryableFetchError(error)) {
        recordInternalRequestTelemetry(targetService, "networkErrorCount");
        normalizeNetworkError(error);
      }
      if (attempt >= maxAttempts - 1) {
        recordInternalRequestTelemetry(targetService, "networkErrorCount");
        normalizeNetworkError(error);
      }
      recordInternalRequestTelemetry(targetService, "retryCount");
      await waitForRetry(retryDelaysMs[attempt] ?? 0);
    } finally {
      clearTimeout(timeout);
    }
  }

  const unreachable = new Error("Internal request failed before response") as InternalRequestError;
  unreachable.code = "INTERNAL_REQUEST_NETWORK_ERROR";
  throw unreachable;
}
