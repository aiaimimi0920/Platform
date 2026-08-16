import type { FastifyInstance } from "fastify";

import {
  listGatewayOperatorCatalog,
  getGatewayProviderInventoryForOperator,
  getGatewayModelAssociationMatrixForOperator,
  getGatewayCostOverviewForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";

export function registerOperatorCatalogRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/catalog", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      catalog: await listGatewayOperatorCatalog(userId, providerUserId),
    };
  });

  app.get("/v1/internal/gateway/provider-inventory", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      inventory: await getGatewayProviderInventoryForOperator(userId, providerUserId),
    };
  });

  app.get("/v1/internal/gateway/model-associations", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      matrix: await getGatewayModelAssociationMatrixForOperator(userId, providerUserId),
    };
  });

  app.get("/v1/internal/gateway/costs", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      overview: await getGatewayCostOverviewForOperator(userId, providerUserId),
    };
  });
}
