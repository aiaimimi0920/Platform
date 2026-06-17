import type { ApiErrorCode } from "@neuro/contracts";

import { HttpError } from "./errors";

export const defaultPlatformAllowedOrigins = ["http://localhost:3028", "http://127.0.0.1:3028"] as const;

export type PlatformErrorResponseBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    moduleKey?: string;
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

const platformCorsObservability = {
  checkedCount: 0,
  allowedCount: 0,
  rejectedCount: 0,
  lastCheckedAt: null as string | null,
  lastRejectedAt: null as string | null,
};

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

export function serializePlatformError(error: unknown): SerializedPlatformError {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          moduleKey: error.moduleKey,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    },
  };
}
