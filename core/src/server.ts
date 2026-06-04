import cors from "@fastify/cors";
import { sql } from "drizzle-orm";
import Fastify from "fastify";

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { arbitrationRouter } from "@/modules/arbitration/router";
import { accountIntegrationRouter } from "@/modules/account-integration/router";
import { agentRegistryRouter } from "@/modules/agent-registry/router";
import { agentExecutionRouter } from "@/modules/agent-execution/router";
import { developmentQueueRouter } from "@/modules/development-queue/router";
import { featureModuleRouter } from "@/platform/feature-modules/router";
import { ensureFeatureModules } from "@/platform/feature-modules/service";
import { publicSurfaceRouter } from "@/platform/public-surfaces/router";
import { ensurePublicSurfaceSnapshot } from "@/platform/public-surfaces/service";
import { HttpError } from "@/platform/errors";
import { outboxRouter } from "@/platform/outbox/router";
import { opinionHubRouter } from "@/modules/opinion-hub/router";
import { productOrderItemRouter } from "@/modules/product-order-item/router";
import { redemptionMailboxMarketplaceRouter } from "@/modules/redemption-mailbox-marketplace/router";
import { taskHubRouter } from "@/modules/task-hub/router";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await ensureFeatureModules();
  await ensurePublicSurfaceSnapshot();

  app.get("/health", async () => {
    return { ok: true, service: "core" };
  });

  app.get("/ready", async () => {
    await db.execute(sql`select 1`);
    await redis.ping();
    return { ok: true, ready: true, service: "core" };
  });

  await app.register(outboxRouter);
  await app.register(featureModuleRouter);
  await app.register(publicSurfaceRouter);
  await app.register(accountIntegrationRouter);
  await app.register(arbitrationRouter);
  await app.register(agentRegistryRouter);
  await app.register(agentExecutionRouter);
  await app.register(developmentQueueRouter);
  await app.register(opinionHubRouter);
  await app.register(productOrderItemRouter);
  await app.register(redemptionMailboxMarketplaceRouter);
  await app.register(taskHubRouter);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          moduleKey: error.moduleKey,
        },
      });
    }

    const unexpected = error as Error;
    app.log.error(unexpected);
    return reply.status(500).send({
      error: {
        code: "BAD_REQUEST",
        message: unexpected.message || "Unexpected error",
      },
    });
  });

  return app;
}
