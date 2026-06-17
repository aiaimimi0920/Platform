import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { sql } from "drizzle-orm";
import Fastify from "fastify";

import {
  agentExecutionRouter,
  announcementsRouter,
  benefitsRouter,
  credentialPoolsRouter,
  db,
  ensureAnnouncementCatalogSeeded,
  ensureBenefitCatalogSeeded,
  emailNativeRouter,
  ensurePersonalMissionCatalogSeeded,
  ensureHonorProjectCatalogSeeded,
  env as accountEnv,
  honorProjectsRouter,
  identityRouter,
  mailboxRouter,
  personalMissionsRouter,
  productShadowRouter,
  reputationRouter,
  redis,
  walletLedgerRouter,
} from "@neuro/account-domain";
import { env } from "@neuro/backend-foundation/env";
import { HttpError } from "@neuro/backend-foundation/platform/errors";
import { ensureFeatureModules } from "@neuro/backend-foundation/platform/feature-modules/service";
import {
  platformCorsOrigin,
  serializePlatformError,
} from "@neuro/backend-foundation/platform/http-server";

import { emailProviderIngressRouter } from "./email-provider-ingress";
import { emailProviderIngressOpsRouter } from "./email-provider-ingress-ops";
import { notificationWebhookOpsRouter } from "./notification-webhook-ops-router";
import { platformHttpDebugRouter } from "./platform-http-debug-router";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: platformCorsOrigin,
    credentials: true,
  });
  await app.register(multipart, {
    limits: {
      fields: 128,
      files: 16,
      fileSize: 25 * 1024 * 1024,
      fieldNameSize: 128,
      fieldSize: 1024 * 1024,
      parts: 160,
    },
  });

  await ensureFeatureModules();
  await ensureAnnouncementCatalogSeeded();
  await ensureBenefitCatalogSeeded();
  await ensurePersonalMissionCatalogSeeded();
  await ensureHonorProjectCatalogSeeded();

  app.get("/health", async () => {
    return {
      ok: true,
      service: "account-api",
      databaseMode: accountEnv.usesDedicatedDatabase ? "account" : "shared",
      redisMode: accountEnv.usesDedicatedRedis ? "account" : "shared",
    };
  });

  app.get("/ready", async () => {
    await db.execute(sql`select 1`);
    await redis.ping();
    return {
      ok: true,
      ready: true,
      service: "account-api",
      databaseMode: accountEnv.usesDedicatedDatabase ? "account" : "shared",
      redisMode: accountEnv.usesDedicatedRedis ? "account" : "shared",
    };
  });

  await app.register(identityRouter);
  await app.register(emailProviderIngressRouter);
  await app.register(emailProviderIngressOpsRouter);
  await app.register(emailNativeRouter);
  await app.register(walletLedgerRouter);
  await app.register(reputationRouter);
  await app.register(personalMissionsRouter);
  await app.register(honorProjectsRouter);
  await app.register(benefitsRouter);
  await app.register(credentialPoolsRouter);
  await app.register(mailboxRouter);
  await app.register(agentExecutionRouter);
  await app.register(announcementsRouter);
  await app.register(productShadowRouter);

  await app.register(platformHttpDebugRouter);
  await app.register(notificationWebhookOpsRouter);

  app.setErrorHandler((error, _request, reply) => {
    if (!(error instanceof HttpError)) {
      app.log.error(error);
    }

    const serialized = serializePlatformError(error);
    return reply.status(serialized.statusCode).send(serialized.body);
  });

  return app;
}

export { env };
