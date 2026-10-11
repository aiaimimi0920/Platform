import type Redis from "ioredis";

import { HttpError } from "../../platform/errors";

export const rauthyRateLimitPolicy = { total: 240, identity: 30, windowMs: 60_000 } as const;

function unavailable() {
  return new HttpError(503, "INTERNAL_SERVER_ERROR", "Rauthy sign-in rate limiting is unavailable");
}

export function createRauthyRateLimitConnection(base: Redis) {
  const redis = base.duplicate({
    lazyConnect: true,
    connectTimeout: 1000,
    commandTimeout: 1000,
    socketTimeout: 1000,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  // Errors are returned to the request below, without logging credentials/URLs.
  redis.on("error", () => undefined);
  let connecting: Promise<void> | null = null;
  let closed = false;
  return {
    redis,
    async ready(): Promise<void> {
      if (closed) throw unavailable();
      if (redis.status === "ready") return;
      if (!connecting) {
        connecting = (async () => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              redis.connect(),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => { redis.disconnect(); reject(unavailable()); }, 1000);
              }),
            ]);
          } catch {
            throw unavailable();
          } finally {
            clearTimeout(timer);
          }
        })().finally(() => { connecting = null; });
      }
      return connecting;
    },
    close() {
      closed = true;
      redis.disconnect();
    },
  };
}
