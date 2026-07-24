import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@neuro/contracts";
import type { FastifyInstance } from "fastify";

import { HttpError } from "./errors";

export const defaultPlatformAllowedOrigins = ["http://localhost:3028", "http://127.0.0.1:3028"] as const;

export type PlatformErrorResponseBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    moduleKey?: string;
    requestId?: string;
    correlationId?: string;
    category?: PlatformErrorCategory;
    diagnostics?: PlatformErrorDiagnostics;
  };
};

export type SerializedPlatformError = {
  statusCode: number;
  body: PlatformErrorResponseBody;
};

export type PlatformCorsObservabilitySnapshot = {
  allowedOrigins: string[];
  checkedCount: number;
  allowedCount: number;
  rejectedCount: number;
  lastCheckedAt: string | null;
  lastRejectedAt: string | null;
};

export type PlatformErrorCategory =
  | "auth"
  | "validation"
  | "not_found"
  | "conflict"
  | "quota"
  | "dependency"
  | "internal";

export type PlatformRequestObservability = {
  requestId: string;
  correlationId: string;
};

export type PlatformRequestObservabilityContext = PlatformRequestObservability & {
  service: string;
  occurredAt?: string;
};

export type PlatformErrorDiagnostics = {
  service: string;
  category: PlatformErrorCategory;
  occurredAt: string;
  requestId: string;
  correlationId: string;
  retryable: boolean;
  statusCode: number;
  moduleKey?: string;
};

export type PlatformLogErrorEntry = PlatformErrorDiagnostics & {
  message: string;
  stack?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    platformRequest: PlatformRequestObservabilityContext;
  }
}

const platformCorsObservability = {
  checkedCount: 0,
  allowedCount: 0,
  rejectedCount: 0,
  lastCheckedAt: null as string | null,
  lastRejectedAt: null as string | null,
};

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

type HeaderMap = Record<string, string | string[] | undefined> | Headers;

export function redactPlatformText(value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return value ?? "";
  }

  return value
    .replace(cookiePattern, (_match, header: string) => `${header}: ${redactedValue}`)
    .replace(authorizationPattern, `Authorization: ${redactedValue}`)
    .replace(bearerPattern, `Bearer ${redactedValue}`)
    .replace(namedSecretPattern, (_match, name: string, separator: string) => {
      return `${name}${separator}${redactedValue}`;
    })
    .replace(skSecretPattern, redactedValue);
}

function readHeader(headers: HeaderMap, name: string): string | null {
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  const value = headers[name.toLowerCase()] ?? headers[name];
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim().length > 0)?.trim() ?? null;
  }
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRequestId(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (!safeRequestIdPattern.test(value)) {
    return null;
  }
  if (redactPlatformText(value) !== value) {
    return null;
  }
  return value;
}

function createPlatformRequestId(service = "platform") {
  const normalizedService = service.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "platform";
  return `${normalizedService}-${randomUUID()}`;
}

export function resolvePlatformRequestObservability(
  headers: HeaderMap,
  options: { generateId?: () => string } = {},
): PlatformRequestObservability {
  const generateId = options.generateId ?? (() => createPlatformRequestId());
  const generatedId = generateId();
  const requestId =
    normalizeRequestId(readHeader(headers, "x-request-id")) ??
    normalizeRequestId(readHeader(headers, "x-correlation-id")) ??
    generatedId;
  const correlationId = normalizeRequestId(readHeader(headers, "x-correlation-id")) ?? requestId;

  return { requestId, correlationId };
}

function classifyPlatformError(error: unknown, statusCode: number): PlatformErrorCategory {
  if (!(error instanceof HttpError)) {
    return "internal";
  }
  if (error.statusCode === 401 || error.statusCode === 403 || error.code === "UNAUTHORIZED") {
    return "auth";
  }
  if (error.statusCode === 400 || error.code === "BAD_REQUEST") {
    return "validation";
  }
  if (error.statusCode === 404 || error.code === "NOT_FOUND") {
    return "not_found";
  }
  if (error.statusCode === 409 || error.code === "CONFLICT") {
    return "conflict";
  }
  if (error.statusCode === 429 || error.code === "QUOTA_EXCEEDED") {
    return "quota";
  }
  if (error.statusCode >= 500 || statusCode >= 500 || error.code === "MODULE_DISABLED") {
    return "dependency";
  }
  return "internal";
}

function isRetryablePlatformError(category: PlatformErrorCategory): boolean {
  return category === "dependency" || category === "internal";
}

function buildPlatformErrorDiagnostics(
  error: unknown,
  context: PlatformRequestObservabilityContext,
  statusCode: number,
  occurredAt = context.occurredAt ?? new Date().toISOString(),
): PlatformErrorDiagnostics {
  const category = classifyPlatformError(error, statusCode);
  const diagnostics: PlatformErrorDiagnostics = {
    service: context.service,
    category,
    occurredAt,
    requestId: context.requestId,
    correlationId: context.correlationId,
    retryable: isRetryablePlatformError(category),
    statusCode,
  };
  if (error instanceof HttpError && error.moduleKey) {
    diagnostics.moduleKey = error.moduleKey;
  }
  return diagnostics;
}

export function registerPlatformRequestObservability(
  app: FastifyInstance,
  options: { service: string },
): void {
  app.addHook("onRequest", async (request, reply) => {
    const observability = resolvePlatformRequestObservability(request.headers, {
      generateId: () => createPlatformRequestId(options.service),
    });
    request.platformRequest = { ...observability, service: options.service };
    reply.header("x-request-id", observability.requestId);
    reply.header("x-correlation-id", observability.correlationId);
  });
}

export function resolvePlatformRequestContext(
  context: PlatformRequestObservabilityContext | undefined,
  service: string,
): PlatformRequestObservabilityContext {
  if (context?.requestId && context.correlationId) {
    return context;
  }
  const requestId = createPlatformRequestId(service);
  return {
    service,
    requestId,
    correlationId: requestId,
  };
}

export function resolvePlatformAllowedOrigins(
  value: string | undefined = process.env.PLATFORM_ALLOWED_ORIGINS,
): string[] {
  if (!value?.trim()) {
    return [...defaultPlatformAllowedOrigins];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  );
}

export function isAllowedPlatformOrigin(
  origin: string | undefined,
  allowedOrigins = resolvePlatformAllowedOrigins(),
): boolean {
  return origin === undefined || allowedOrigins.includes(origin);
}

function recordPlatformCorsDecision(allowed: boolean) {
  const timestamp = new Date().toISOString();
  platformCorsObservability.checkedCount += 1;
  platformCorsObservability.lastCheckedAt = timestamp;

  if (allowed) {
    platformCorsObservability.allowedCount += 1;
    return;
  }

  platformCorsObservability.rejectedCount += 1;
  platformCorsObservability.lastRejectedAt = timestamp;
}

export function platformCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow: boolean) => void,
): void {
  const allowed = isAllowedPlatformOrigin(origin);
  recordPlatformCorsDecision(allowed);
  callback(null, allowed);
}

export function getPlatformCorsObservabilitySnapshot(
  value: string | undefined = process.env.PLATFORM_ALLOWED_ORIGINS,
): PlatformCorsObservabilitySnapshot {
  return {
    allowedOrigins: resolvePlatformAllowedOrigins(value),
    checkedCount: platformCorsObservability.checkedCount,
    allowedCount: platformCorsObservability.allowedCount,
    rejectedCount: platformCorsObservability.rejectedCount,
    lastCheckedAt: platformCorsObservability.lastCheckedAt,
    lastRejectedAt: platformCorsObservability.lastRejectedAt,
  };
}

export function resetPlatformCorsObservabilityForTests() {
  platformCorsObservability.checkedCount = 0;
  platformCorsObservability.allowedCount = 0;
  platformCorsObservability.rejectedCount = 0;
  platformCorsObservability.lastCheckedAt = null;
  platformCorsObservability.lastRejectedAt = null;
}

export function serializePlatformLogError(
  error: unknown,
  context: PlatformRequestObservabilityContext,
): PlatformLogErrorEntry {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const diagnostics = buildPlatformErrorDiagnostics(error, context, statusCode);
  const message = error instanceof Error ? redactPlatformText(error.message) : redactPlatformText(String(error));
  const stack = error instanceof Error && error.stack ? redactPlatformText(error.stack) : undefined;
  return {
    ...diagnostics,
    message,
    ...(stack ? { stack } : {}),
  };
}

export function serializePlatformError(
  error: unknown,
  context?: PlatformRequestObservabilityContext,
): SerializedPlatformError {
  if (error instanceof HttpError) {
    const diagnostics = context
      ? buildPlatformErrorDiagnostics(error, context, error.statusCode)
      : undefined;
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: redactPlatformText(error.message),
          moduleKey: error.moduleKey,
          ...(context
            ? {
                requestId: context.requestId,
                correlationId: context.correlationId,
                category: diagnostics?.category,
                diagnostics,
              }
            : {}),
        },
      },
    };
  }

  const diagnostics = context ? buildPlatformErrorDiagnostics(error, context, 500) : undefined;
  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        ...(context
          ? {
              requestId: context.requestId,
              correlationId: context.correlationId,
              category: diagnostics?.category,
              diagnostics,
            }
          : {}),
      },
    },
  };
}
