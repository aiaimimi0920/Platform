// Facade for the agent-execution HTTP router.
// Handlers live in ./router/*; this file mounts sub-routers and keeps the
// original `agentExecutionRouter` export so server.ts stays unchanged.
import type { FastifyPluginAsync } from "fastify";

import { registerOwnedExecutionRoutes } from "./router/owned-executions";
import { registerLaunchPresetRoutes } from "./router/launch-presets";
import { registerRuntimeCatalogRoutes } from "./router/runtime-catalog";
import { registerCallbackAuditRoutes } from "./router/callback-audits";
import { registerRunRoutes } from "./router/runs";
import { registerRuntimeSessionRoutes } from "./router/runtime-sessions";
import { registerDispatchRoutes } from "./router/dispatch";
import { registerSettlementRoutes } from "./router/settlements";
import { registerExternalRuntimeRoutes } from "./router/external-runtime";

export const agentExecutionRouter: FastifyPluginAsync = async (app) => {
  registerOwnedExecutionRoutes(app);
  registerLaunchPresetRoutes(app);
  registerRuntimeCatalogRoutes(app);
  registerCallbackAuditRoutes(app);
  registerRunRoutes(app);
  registerRuntimeSessionRoutes(app);
  registerDispatchRoutes(app);
  registerSettlementRoutes(app);
  registerExternalRuntimeRoutes(app);
};
