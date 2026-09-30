import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { redis } from "../../db/redis";
import { withInternalRequest } from "../../platform/internal-auth";
import { requireModuleEnabled } from "../../platform/feature-modules/service";
import { LoomAccountError } from "../loom-account/model";
import { createLoomAccountService } from "../loom-account/service";
import { LoomProjectionError } from "./model";
import { configuredProjectionPolicy } from "./policy";
import { LoomProjectionRepository } from "./repository";
import { LoomProjectionService } from "./service";

export function createLoomProjectionRouter(service: LoomProjectionService): FastifyPluginAsync {
  return async (app) => {
    app.post("/internal/loom-projections", { preHandler: withInternalRequest, bodyLimit: 16 * 1024 }, async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      await requireModuleEnabled("identity");
      try { return await service.execute(request.body); }
      catch (error) {
        if (error instanceof LoomAccountError || error instanceof LoomProjectionError || error instanceof ZodError) {
          return reply.code(error instanceof ZodError ? 400 : error.statusCode).send({
            error: { code: error instanceof ZodError ? "projection_invalid_request" : error.code },
          });
        }
        throw error;
      }
    });
  };
}

export const loomProjectionRouter = createLoomProjectionRouter(new LoomProjectionService(
  new LoomProjectionRepository(redis), createLoomAccountService(redis), configuredProjectionPolicy,
));
