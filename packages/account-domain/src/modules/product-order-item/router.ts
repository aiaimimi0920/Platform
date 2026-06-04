import type { FastifyPluginAsync } from "fastify";

import { syncDedicatedProductShadowFromCore } from "@/modules/product-order-item/service";
import { withInternalRequest } from "@/platform/internal-auth";

export const productShadowRouter: FastifyPluginAsync = async (app) => {
  app.post(
    "/internal/product-shadow/sync",
    { preHandler: withInternalRequest },
    async () => ({
      result: await syncDedicatedProductShadowFromCore(),
    }),
  );
};
