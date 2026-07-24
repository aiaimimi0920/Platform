type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type InternalRequestError = Error & {
  code?: "INTERNAL_REQUEST_TIMEOUT" | "INTERNAL_REQUEST_NETWORK_ERROR";
  status?: number | null;
  statusCode?: number | null;
  category?: InternalDependencyErrorCategory;
  service?: InternalRequestTargetService;
  requestId?: string | null;
  correlationId?: string | null;
  targetService?: InternalRequestTargetService;
  occurredAt?: string;
  retryable?: boolean;
  diagnostics?: string;
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

export type InternalDependencyErrorCategory =
  | "auth"
  | "validation"
  | "not_found"
  | "conflict"
  | "quota"
  | "dependency"
  | "internal";

export type ClassifiedInternalDependencyError = {
  status: number | null;
  code: string | null;
  category: InternalDependencyErrorCategory;
  service: InternalRequestTargetService;
  requestId: string | null;
  correlationId: string | null;
  occurredAt: string;
  retryable: boolean;
  publicMessage: string;
  diagnostics: string;
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
const redactedValue = "[REDACTED]";
const secretValuePattern = String.raw`(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)`;
const authorizationPattern = new RegExp(
  String.raw`\bauthorization\b\s*[:=]\s*(?:(?:bearer|basic)\s+)?${secretValuePattern}`,
  "gi",
);
const bearerPattern = new RegExp(String.raw`\bbearer\s+${secretValuePattern}`, "gi");
const cookiePattern = /\b(Set-Cookie|Cookie)\b\s*[:=]\s*[^\r\n]*/gi;
const namedSecretPattern = new RegExp(
  String.raw`\b((?:(?:access|refresh|id|session)[_-]?)?token|client[_ -]?secret|secret[_ -]?access[_ -]?key|access[_ -]?key|private[_ -]?key|api[_ -]?key|apikey|password|passwd|pwd|credentials?|secret|cookie|key|(?:email|oauth|verification)[_ -]?code|code)\b(\s*[:=]\s*)${secretValuePattern}`,
  "gi",
);
const skSecretPattern = /\bsk-[a-z0-9._-]+/gi;
const safeRequestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

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

function redactInternalText(value: string): string {
  return value
    .replace(cookiePattern, (_match, header: string) => `${header}: ${redactedValue}`)
    .replace(authorizationPattern, `Authorization: ${redactedValue}`)
    .replace(bearerPattern, `Bearer ${redactedValue}`)
    .replace(namedSecretPattern, (_match, name: string, separator: string) => `${name}${separator}${redactedValue}`)
    .replace(skSecretPattern, redactedValue);
}

function normalizeSafeDiagnosticString(value: string | null): string | null {
  if (!value) return null;
  const redacted = redactInternalText(value).trim();
  return redacted.length > 0 ? redacted : null;
}

function normalizeInternalRequestId(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !safeRequestIdPattern.test(trimmed)) return null;
  return redactInternalText(trimmed) === trimmed ? trimmed : null;
}

function createInternalRequestId(targetService: InternalRequestTargetService): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `web-${targetService}-${random}`;
}

function ensureInternalRequestHeaders(
  headersInit: HeadersInit | undefined,
  targetService: InternalRequestTargetService,
): { headers: Record<string, string>; requestId: string; correlationId: string } {
  const normalizedHeaders = new Headers(headersInit);
  const requestId = normalizeInternalRequestId(normalizedHeaders.get("x-request-id")) || createInternalRequestId(targetService);
  const correlationId = normalizeInternalRequestId(normalizedHeaders.get("x-correlation-id")) || requestId;
  const headers: Record<string, string> = {};
  normalizedHeaders.forEach((value, key) => {
    headers[key] = value;
  });
  headers["x-request-id"] = requestId;
  headers["x-correlation-id"] = correlationId;
  return { headers, requestId, correlationId };
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

function applyInternalDependencyMetadata(
  error: InternalRequestError,
  context: { requestId: string; correlationId: string; targetService: InternalRequestTargetService } | undefined,
  category: InternalDependencyErrorCategory,
): InternalRequestError {
  const service = context?.targetService ?? "unknown";
  const requestId = context?.requestId ?? null;
  const correlationId = context?.correlationId ?? requestId;
  const occurredAt = new Date().toISOString();
  const retryable = isRetryableDependency(category, null);
  error.status = null;
  error.statusCode = null;
  error.category = category;
  error.service = service;
  error.requestId = requestId;
  error.correlationId = correlationId;
  error.targetService = service;
  error.occurredAt = occurredAt;
  error.retryable = retryable;
  error.diagnostics = createDiagnostics({ service, category, occurredAt, requestId, correlationId, retryable, status: null });
  return error;
}

function normalizeNetworkError(
  error: unknown,
  context?: { requestId: string; correlationId: string; targetService: InternalRequestTargetService },
): never {
  if (error instanceof Error) {
    const normalized = error as InternalRequestError;
    normalized.code = "INTERNAL_REQUEST_NETWORK_ERROR";
    applyInternalDependencyMetadata(normalized, context, "dependency");
    throw normalized;
  }
  const normalized = new Error("Internal request network error") as InternalRequestError;
  normalized.code = "INTERNAL_REQUEST_NETWORK_ERROR";
  applyInternalDependencyMetadata(normalized, context, "dependency");
  throw normalized;
}

function normalizeTimeoutError(
  error: unknown,
  context?: { requestId: string; correlationId: string; targetService: InternalRequestTargetService },
): never {
  const message = error instanceof Error && error.message ? error.message : "Internal request timed out";
  const normalized = new Error(message) as InternalRequestError;
  normalized.code = "INTERNAL_REQUEST_TIMEOUT";
  applyInternalDependencyMetadata(normalized, context, "dependency");
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
  const { headers, requestId, correlationId } = ensureInternalRequestHeaders(requestInit.headers, targetService);
  const requestContext = { requestId, correlationId, targetService };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(input, {
        ...requestInit,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        recordInternalRequestTelemetry(targetService, "timeoutCount");
        normalizeTimeoutError(error, requestContext);
      }
      if (!isRetryableFetchError(error)) {
        recordInternalRequestTelemetry(targetService, "networkErrorCount");
        normalizeNetworkError(error, requestContext);
      }
      if (attempt >= maxAttempts - 1) {
        recordInternalRequestTelemetry(targetService, "networkErrorCount");
        normalizeNetworkError(error, requestContext);
      }
      recordInternalRequestTelemetry(targetService, "retryCount");
      await waitForRetry(retryDelaysMs[attempt] ?? 0);
    } finally {
      clearTimeout(timeout);
    }
  }

  const unreachable = new Error("Internal request failed before response") as InternalRequestError;
  unreachable.code = "INTERNAL_REQUEST_NETWORK_ERROR";
  unreachable.requestId = requestId;
  unreachable.correlationId = correlationId;
  unreachable.targetService = targetService;
  throw unreachable;
}

function readObjectString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readObjectBoolean(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function normalizeDependencyCategory(
  rawCategory: string | null,
  status: number | null,
  code: string | null,
): InternalDependencyErrorCategory {
  if (
    rawCategory === "auth" ||
    rawCategory === "validation" ||
    rawCategory === "not_found" ||
    rawCategory === "conflict" ||
    rawCategory === "quota" ||
    rawCategory === "dependency" ||
    rawCategory === "internal"
  ) {
    return rawCategory;
  }
  if (status === 401 || status === 403 || code === "UNAUTHORIZED") return "auth";
  if (status === 400 || code === "BAD_REQUEST") return "validation";
  if (status === 404 || code === "NOT_FOUND") return "not_found";
  if (status === 409 || code === "CONFLICT") return "conflict";
  if (status === 429 || code === "QUOTA_EXCEEDED") return "quota";
  if (code === "INTERNAL_REQUEST_TIMEOUT" || code === "INTERNAL_REQUEST_NETWORK_ERROR") return "dependency";
  if (status !== null && status >= 500) return "dependency";
  return "internal";
}

function isRetryableDependency(category: InternalDependencyErrorCategory, explicit: boolean | null): boolean {
  if (explicit !== null) return explicit;
  return category === "dependency" || category === "internal";
}

function createDiagnostics(args: {
  service: InternalRequestTargetService;
  category: InternalDependencyErrorCategory;
  occurredAt: string;
  requestId: string | null;
  correlationId: string | null;
  retryable: boolean;
  status: number | null;
}): string {
  return redactInternalText(
    [
      `service=${args.service}`,
      `category=${args.category}`,
      `occurredAt=${args.occurredAt}`,
      `requestId=${args.requestId ?? "unavailable"}`,
      `correlationId=${args.correlationId ?? "unavailable"}`,
      `retryable=${args.retryable}`,
      `status=${args.status ?? "network"}`,
    ].join(" "),
  );
}

export async function classifyInternalDependencyError(
  responseOrError: Response | unknown,
  options: { targetService: InternalRequestTargetService; fallbackMessage: string },
): Promise<ClassifiedInternalDependencyError> {
  const service = normalizeTargetService(options.targetService);
  const occurredAt = new Date().toISOString();

  if (responseOrError instanceof Response) {
    const rawBody = await responseOrError.text();
    let body: unknown = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody) as unknown;
      } catch {
        body = rawBody;
      }
    }
    const bodyRecord = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    const errorRecord =
      bodyRecord?.error && typeof bodyRecord.error === "object" && !Array.isArray(bodyRecord.error)
        ? (bodyRecord.error as Record<string, unknown>)
        : bodyRecord;
    const diagnosticsRecord =
      errorRecord?.diagnostics && typeof errorRecord.diagnostics === "object" && !Array.isArray(errorRecord.diagnostics)
        ? (errorRecord.diagnostics as Record<string, unknown>)
        : null;
    const status = responseOrError.status;
    const rawCode = errorRecord ? readObjectString(errorRecord, "code") : null;
    const code = normalizeSafeDiagnosticString(rawCode);
    const category = normalizeDependencyCategory(errorRecord ? readObjectString(errorRecord, "category") : null, status, rawCode);
    const requestId =
      normalizeSafeDiagnosticString(responseOrError.headers.get("x-request-id")) ||
      (errorRecord ? normalizeSafeDiagnosticString(readObjectString(errorRecord, "requestId")) : null) ||
      (diagnosticsRecord ? normalizeSafeDiagnosticString(readObjectString(diagnosticsRecord, "requestId")) : null);
    const correlationId =
      normalizeSafeDiagnosticString(responseOrError.headers.get("x-correlation-id")) ||
      (errorRecord ? normalizeSafeDiagnosticString(readObjectString(errorRecord, "correlationId")) : null) ||
      (diagnosticsRecord ? normalizeSafeDiagnosticString(readObjectString(diagnosticsRecord, "correlationId")) : null) ||
      requestId;
    const explicitRetryable = diagnosticsRecord ? readObjectBoolean(diagnosticsRecord, "retryable") : null;
    const retryable = isRetryableDependency(category, explicitRetryable);
    const classifiedOccurredAt = (diagnosticsRecord ? readObjectString(diagnosticsRecord, "occurredAt") : null) ?? occurredAt;
    return {
      status,
      code,
      category,
      service,
      requestId,
      correlationId,
      occurredAt: classifiedOccurredAt,
      retryable,
      publicMessage: options.fallbackMessage,
      diagnostics: createDiagnostics({ service, category, occurredAt: classifiedOccurredAt, requestId, correlationId, retryable, status }),
    };
  }

  const errorRecord = responseOrError && typeof responseOrError === "object" ? (responseOrError as Record<string, unknown>) : null;
  const rawCode = errorRecord ? readObjectString(errorRecord, "code") : null;
  const code = normalizeSafeDiagnosticString(rawCode);
  const status = errorRecord && typeof errorRecord.status === "number"
    ? errorRecord.status
    : errorRecord && typeof errorRecord.statusCode === "number"
      ? errorRecord.statusCode
      : null;
  const category = normalizeDependencyCategory(errorRecord ? readObjectString(errorRecord, "category") : null, status, rawCode);
  const requestId = errorRecord ? normalizeSafeDiagnosticString(readObjectString(errorRecord, "requestId")) : null;
  const correlationId = (errorRecord ? normalizeSafeDiagnosticString(readObjectString(errorRecord, "correlationId")) : null) ?? requestId;
  const explicitRetryable = errorRecord ? readObjectBoolean(errorRecord, "retryable") : null;
  const retryable = isRetryableDependency(category, explicitRetryable);
  const classifiedOccurredAt = (errorRecord ? readObjectString(errorRecord, "occurredAt") : null) ?? occurredAt;
  return {
    status,
    code,
    category,
    service,
    requestId,
    correlationId,
    occurredAt: classifiedOccurredAt,
    retryable,
    publicMessage: options.fallbackMessage,
    diagnostics: createDiagnostics({ service, category, occurredAt: classifiedOccurredAt, requestId, correlationId, retryable, status }),
  };
}
