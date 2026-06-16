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

export function platformCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow: boolean) => void,
): void {
  callback(null, isAllowedPlatformOrigin(origin));
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
