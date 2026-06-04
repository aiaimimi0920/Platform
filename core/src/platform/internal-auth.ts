import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "@/env";
import { HttpError } from "@/platform/errors";

export function assertInternalRequest(request: FastifyRequest): void {
  const token = request.headers["x-internal-api-token"];
  if (token !== env.internalApiToken) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid internal API token");
  }
}

export function assertUserContext(
  request: FastifyRequest,
): { userId: string; providerUserId?: string; username?: string } {
  const userId = request.headers["x-neuro-user-id"];
  const providerUserId = request.headers["x-neuro-provider-user-id"];
  const username = request.headers["x-neuro-username"];

  if (typeof userId !== "string" || userId.length === 0) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing user context");
  }

  return {
    userId,
    providerUserId: typeof providerUserId === "string" ? providerUserId : undefined,
    username: typeof username === "string" ? username : undefined,
  };
}

export function assertPlatformOperatorUser(userId: string, providerUserId?: string | null): void {
  if (!env.platformOperatorUserIds.includes(userId) && !(providerUserId && env.platformOperatorUserIds.includes(providerUserId))) {
    throw new HttpError(401, "UNAUTHORIZED", "Platform operator required");
  }
}

export async function withInternalRequest(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  assertInternalRequest(request);
}
