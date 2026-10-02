import { createHash } from "node:crypto";

import rateLimit from "@fastify/rate-limit";
import type { RauthyUpsertInput, UserSummary } from "@neuro/contracts";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type Redis from "ioredis";

import { parseRauthyUpsertInput } from "./rauthy-model";
import { rauthyRateLimitPolicy } from "./rauthy-rate-limit";
import { HttpError } from "../../platform/errors";

export type RauthyRouteDependencies = {
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  redis: Redis;
  ready: () => Promise<void>;
  requireIdentityEnabled: () => Promise<void>;
  upsert: (profile: RauthyUpsertInput) => Promise<UserSummary>;
};

export function createRauthyIdentityRouter(dependencies: RauthyRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    const profiles = new WeakMap<FastifyRequest, RauthyUpsertInput>();
    await app.register(rateLimit, {
      global: false,
      hook: "preHandler",
      redis: dependencies.redis,
      nameSpace: "neuro:rauthy-upsert:v1:",
      max: rauthyRateLimitPolicy.total,
      timeWindow: rauthyRateLimitPolicy.windowMs,
      keyGenerator: () => "total",
      continueExceeding: false,
      exponentialBackoff: false,
      skipOnError: false,
      errorResponseBuilder: () => new HttpError(429, "QUOTA_EXCEEDED", "Rauthy sign-in rate limit exceeded"),
    });
    const consumeTotal = app.createRateLimit();
    app.post("/internal/identity/rauthy-upsert", {
      bodyLimit: 8192,
      preHandler: [
        dependencies.authenticate,
        async (request) => { profiles.set(request, parseRauthyUpsertInput(request.body)); },
        async (request, reply) => {
          await dependencies.ready();
          const limit = await consumeTotal(request);
          if (!limit.isAllowed && limit.isExceeded) {
            reply.header("Retry-After", limit.ttlInSeconds);
            throw new HttpError(429, "QUOTA_EXCEEDED", "Rauthy sign-in rate limit exceeded");
          }
        },
      ],
      // The official plugin appends this identity check after the hooks above.
      // Total-budget rejection never creates a new per-identity Redis key.
      config: { rateLimit: {
        max: rauthyRateLimitPolicy.identity,
        keyGenerator: (request) => {
          const profile = profiles.get(request)!;
          return `identity:${createHash("sha256").update(JSON.stringify([profile.issuer, profile.subject])).digest("hex")}`;
        },
      } },
    }, async (request) => {
      await dependencies.requireIdentityEnabled();
      return { user: await dependencies.upsert(profiles.get(request)!) };
    });
  };
}
