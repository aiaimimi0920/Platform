import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { redis } from "../../db/redis";
import { assertUserContext, withInternalRequest } from "../../platform/internal-auth";
import { requireModuleEnabled } from "../../platform/feature-modules/service";
import { LoomAccountError } from "./model";
import { LoomAccountRepository } from "./repository";
import { LoomAccountService } from "./service";

export function createLoomAccountRouter(service: LoomAccountService): FastifyPluginAsync {
  return async (app) => {
    for (const action of ["approve", "exchange", "status", "revoke"] as const) {
      app.post(`/internal/loom-account/${action}`, {
        preHandler: withInternalRequest,
        bodyLimit: 4096,
      }, async (request, reply) => {
        reply.header("Cache-Control", "no-store");
        await requireModuleEnabled("identity");
        try {
          if (action === "approve") return await service.approve(request.body, assertUserContext(request));
          if (action === "exchange") return await service.exchange(request.body);
          return await service.prove(action, request.body);
        } catch (error) {
          if (error instanceof LoomAccountError || error instanceof ZodError) {
            return reply.code(error instanceof LoomAccountError ? error.statusCode : 400).send({
              error: { code: error instanceof LoomAccountError ? error.code : "invalid_account_request" },
            });
          }
          throw error;
        }
      });
    }
  };
}

export const loomAccountRouter = createLoomAccountRouter(new LoomAccountService(new LoomAccountRepository(redis)));
