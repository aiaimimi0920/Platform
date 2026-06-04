// ---------------------------------------------------------------------------
// GatewayStandardError — structured error classification with FallbackHint
// ---------------------------------------------------------------------------

export type GatewayErrorKind =
  | "authentication"
  | "rate_limit"
  | "context_length"
  | "content_filter"
  | "model_not_found"
  | "server_error"
  | "network"
  | "bad_request"
  | "insufficient_quota"
  | "service_unavailable"
  | "timeout"
  | "unknown";

export type GatewayFallbackHint =
  | { action: "retry"; delayMs: number; reason: string }
  | { action: "fallback_provider"; reason: string }
  | { action: "downgrade_model"; suggestedModel?: string; reason: string }
  | { action: "abort"; reason: string };

export type GatewayStandardError = {
  kind: GatewayErrorKind;
  message: string;
  code: string | null;
  httpStatus: number | null;
  retryable: boolean;
  fallbackHint: GatewayFallbackHint;
  providerName: string | null;
  raw: unknown;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function safeString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function extractHttpStatus(error: unknown): number | null {
  if (error !== null && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const candidate =
      obj["status"] ??
      obj["statusCode"] ??
      obj["httpStatus"] ??
      obj["http_status"] ??
      null;
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    // Some HTTP client libraries nest it under response
    if (obj["response"] !== null && typeof obj["response"] === "object") {
      const response = obj["response"] as Record<string, unknown>;
      const nested = response["status"] ?? null;
      if (typeof nested === "number" && Number.isFinite(nested)) {
        return nested;
      }
    }
  }
  return null;
}

function extractCode(error: unknown): string | null {
  if (error !== null && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const candidate = obj["code"] ?? obj["error_code"] ?? obj["errorCode"] ?? null;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function extractMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    // Some providers wrap the message under error.error.message
    const nested = obj["error"];
    if (nested !== null && typeof nested === "object") {
      const nestedMsg = (nested as Record<string, unknown>)["message"];
      if (typeof nestedMsg === "string" && nestedMsg.trim()) {
        return nestedMsg.trim();
      }
    }
    const msg = obj["message"];
    if (typeof msg === "string" && msg.trim()) {
      return msg.trim();
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return safeString(error) || "Unknown error";
}

// ---------------------------------------------------------------------------
// Kind resolution — three layers: HTTP status, Node.js error code, keywords
// ---------------------------------------------------------------------------

function kindFromHttpStatus(status: number): GatewayErrorKind | null {
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limit";
  if (status === 500 || status === 502 || status === 503) return "server_error";
  if (status === 504) return "timeout";
  return null;
}

const NODE_NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EPIPE"]);

function kindFromNodeCode(code: string | null): GatewayErrorKind | null {
  if (code && NODE_NETWORK_CODES.has(code.toUpperCase())) {
    return "network";
  }
  return null;
}

const KEYWORD_KIND_MAP: Array<{ patterns: RegExp; kind: GatewayErrorKind }> = [
  { patterns: /rate.?limit/i, kind: "rate_limit" },
  { patterns: /context.length|too.long|maximum.context|token.limit|tokens?.exceed/i, kind: "context_length" },
  { patterns: /content.filter|safety|policy.violation|moderat/i, kind: "content_filter" },
  { patterns: /quota|credit/i, kind: "insufficient_quota" },
  { patterns: /service.unavailable|overloaded|temporarily.unavailable/i, kind: "service_unavailable" },
  { patterns: /timed?.out|timeout/i, kind: "timeout" },
  { patterns: /authentication|unauthorized|invalid.api.key|invalid_api_key|no.auth/i, kind: "authentication" },
  { patterns: /model.not.found|does.not.exist|unknown.model/i, kind: "model_not_found" },
];

function kindFromMessage(message: string): GatewayErrorKind | null {
  for (const { patterns, kind } of KEYWORD_KIND_MAP) {
    if (patterns.test(message)) {
      return kind;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// FallbackHint derivation
// ---------------------------------------------------------------------------

const DEFAULT_RETRY_DELAY_MS = 1_000;
const RATE_LIMIT_RETRY_DELAY_MS = 5_000;
const SERVER_ERROR_RETRY_DELAY_MS = 2_000;

function buildFallbackHint(kind: GatewayErrorKind): GatewayFallbackHint {
  switch (kind) {
    case "rate_limit":
      return { action: "retry", delayMs: RATE_LIMIT_RETRY_DELAY_MS, reason: "Rate limit hit; back-off before retrying." };
    case "insufficient_quota":
      return { action: "fallback_provider", reason: "Account quota exhausted; switch to an alternative provider." };
    case "context_length":
      return { action: "downgrade_model", reason: "Prompt exceeds context window; retry with a model that supports a larger context." };
    case "authentication":
      return { action: "abort", reason: "Invalid or missing credentials; manual intervention required." };
    case "server_error":
      return { action: "fallback_provider", reason: "Provider returned a server error; try an alternative provider." };
    case "network":
      return { action: "fallback_provider", reason: "Network failure reaching provider; try an alternative provider." };
    case "content_filter":
      return { action: "abort", reason: "Request was blocked by content policy; the prompt must be revised." };
    case "bad_request":
      return { action: "abort", reason: "Malformed request; fix the request before retrying." };
    case "model_not_found":
      return { action: "downgrade_model", reason: "Requested model does not exist on this provider; select an available model." };
    case "service_unavailable":
      return { action: "retry", delayMs: SERVER_ERROR_RETRY_DELAY_MS, reason: "Provider temporarily unavailable; retry after a brief delay." };
    case "timeout":
      return { action: "retry", delayMs: DEFAULT_RETRY_DELAY_MS, reason: "Request timed out; retry with a shorter prompt or increased timeout." };
    case "unknown":
      return { action: "fallback_provider", reason: "Unclassified error; try an alternative provider." };
    default: {
      // exhaustiveness guard — TypeScript should never reach this
      const _exhaustive: never = kind;
      void _exhaustive;
      return { action: "abort", reason: "Unhandled error kind." };
    }
  }
}

function isKindRetryable(kind: GatewayErrorKind): boolean {
  return (
    kind === "rate_limit" ||
    kind === "server_error" ||
    kind === "network" ||
    kind === "service_unavailable" ||
    kind === "timeout"
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies an arbitrary upstream error into a GatewayStandardError with a
 * structured FallbackHint describing the recommended recovery action.
 */
export function classifyUpstreamError(
  error: unknown,
  providerName?: string,
): GatewayStandardError {
  const httpStatus = extractHttpStatus(error);
  const code = extractCode(error);
  const message = extractMessage(error);

  // Resolve kind: HTTP status > Node.js code > message keywords > unknown
  const kind: GatewayErrorKind =
    (httpStatus !== null ? kindFromHttpStatus(httpStatus) : null) ??
    kindFromNodeCode(code) ??
    kindFromMessage(message) ??
    "unknown";

  return {
    kind,
    message,
    code,
    httpStatus,
    retryable: isKindRetryable(kind),
    fallbackHint: buildFallbackHint(kind),
    providerName: typeof providerName === "string" && providerName.trim() ? providerName.trim() : null,
    raw: error,
  };
}

/**
 * Returns true when the error is safe to retry (e.g. transient network or
 * rate-limit issues).
 */
export function isRetryableError(error: GatewayStandardError): boolean {
  return error.retryable;
}

/**
 * Returns true when the caller should fall back to the next provider in the
 * routing chain rather than retrying the same one.
 */
export function shouldFallbackToNextProvider(error: GatewayStandardError): boolean {
  return error.fallbackHint.action === "fallback_provider";
}

/**
 * Returns the suggested delay in milliseconds before the next retry attempt.
 * Returns 0 for non-retryable errors.
 */
export function suggestedRetryDelay(error: GatewayStandardError): number {
  const hint = error.fallbackHint;
  if (hint.action === "retry") {
    return hint.delayMs;
  }
  return 0;
}

/**
 * Returns a human-readable single-line summary of the error suitable for
 * logging or display.
 */
export function formatStandardError(error: GatewayStandardError): string {
  const parts: string[] = [];

  if (error.providerName) {
    parts.push(`[${error.providerName}]`);
  }

  parts.push(`kind=${error.kind}`);

  if (error.httpStatus !== null) {
    parts.push(`status=${error.httpStatus}`);
  }

  if (error.code !== null) {
    parts.push(`code=${error.code}`);
  }

  parts.push(`retryable=${error.retryable}`);
  parts.push(`hint=${error.fallbackHint.action}`);
  parts.push(`message=${JSON.stringify(error.message)}`);

  return parts.join(" ");
}
