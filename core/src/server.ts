import cors from "@fastify/cors";
import { sql } from "drizzle-orm";
import Fastify, { type FastifyInstance } from "fastify";

import { HttpError } from "@/platform/errors";
import { platformCorsOrigin, serializePlatformError } from "@/platform/http-server";

export type CorePlatformInitializer = () => Promise<void> | void;
export type CoreReadyCheck = () => Promise<void>;

export type CoreServerBuildOptions = {
  initializePlatform?: CorePlatformInitializer | false;
  readyCheck?: CoreReadyCheck;
  registerDomainRouters?: boolean;
};

async function initializeDefaultPlatform() {
  const [{ ensureFeatureModules }, { ensurePublicSurfaceSnapshot }] = await Promise.all([
    import("@/platform/feature-modules/service"),
    import("@/platform/public-surfaces/service"),
  ]);

  await ensureFeatureModules();
  await ensurePublicSurfaceSnapshot();
}

async function defaultReadyCheck() {
  const [{ db }, { redis }] = await Promise.all([
    import("@/db/client"),
    import("@/db/redis"),
  ]);

  await db.execute(sql`select 1`);
  await redis.ping();
}

export function registerCoreHealthRoutes(app: FastifyInstance, readyCheck: CoreReadyCheck = defaultReadyCheck) {
  app.get("/health", async () => {
    return { ok: true, service: "core" };
  });

  app.get("/ready", async () => {
    await readyCheck();
    return { ok: true, ready: true, service: "core" };
  });
}

export async function registerCoreDomainRouters(app: FastifyInstance) {
  const [
    { outboxRouter },
    { featureModuleRouter },
    { publicSurfaceRouter },
    { accountIntegrationRouter },
    { arbitrationRouter },
    { agentRegistryRouter },
    { agentExecutionRouter },
    { developmentQueueRouter },
    { opinionHubRouter },
    { productOrderItemRouter },
    { redemptionMailboxMarketplaceRouter },
    { taskHubRouter },
    { teaRouter },
  ] = await Promise.all([
    import("@/platform/outbox/router"),
    import("@/platform/feature-modules/router"),
    import("@/platform/public-surfaces/router"),
    import("@/modules/account-integration/router"),
    import("@/modules/arbitration/router"),
    import("@/modules/agent-registry/router"),
    import("@/modules/agent-execution/router"),
    import("@/modules/development-queue/router"),
    import("@/modules/opinion-hub/router"),
    import("@/modules/product-order-item/router"),
    import("@/modules/redemption-mailbox-marketplace/router"),
    import("@/modules/task-hub/router"),
    import("@/modules/tea/router"),
  ]);

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
  await app.register(teaRouter);
}

export function registerCoreErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (!(error instanceof HttpError)) {
      app.log.error(error);
    }

    const serialized = serializePlatformError(error);
    return reply.status(serialized.statusCode).send(serialized.body);
  });
}

export async function buildServer(options: CoreServerBuildOptions = {}) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: platformCorsOrigin,
    credentials: true,
  });

  const platformInitializer = options.initializePlatform ?? initializeDefaultPlatform;
  if (platformInitializer) {
    await platformInitializer();
  }

  registerCoreHealthRoutes(app, options.readyCheck ?? defaultReadyCheck);

  if (options.registerDomainRouters ?? true) {
    await registerCoreDomainRouters(app);
  }

  registerCoreErrorHandler(app);

  return app;
}
