import type { FastifyPluginAsync } from "fastify";

import { registerOperatorCatalogRoutes } from "./router/operator-catalog";
import { registerOperatorAuditsRoutes } from "./router/operator-audits";
import { registerAnalysisSummaryRoutes } from "./router/analysis-summary";
import { registerPromptCacheRoutes } from "./router/prompt-cache";
import { registerRateLimitHotspotRoutes } from "./router/rate-limit-hotspots";
import { registerAnomalyPolicyRoutes } from "./router/anomaly-policies";
import { registerAnalysisExportRoutes } from "./router/analysis-exports";
import { registerAnomalyIncidentRoutes } from "./router/anomaly-incidents";
import { registerAnomalyRemediationRoutes } from "./router/anomaly-remediation";
import { registerRemediationEffectivenessRoutes } from "./router/remediation-effectiveness";
import { registerProviderAdminRoutes } from "./router/provider-admin";

// Deprecated guard: gatewayRouter is only a migration-period legacy HTTP surface.
// Do not register it in services/account-api or make it a new owner path.
// The Rust gateway/ service is the formal AI gateway owner; Web/operator callers
// should use the Rust gateway internal API instead of this legacy router.
export const gatewayRouter: FastifyPluginAsync = async (app) => {
  registerOperatorCatalogRoutes(app);
  registerOperatorAuditsRoutes(app);
  registerAnalysisSummaryRoutes(app);
  registerPromptCacheRoutes(app);
  registerRateLimitHotspotRoutes(app);
  registerAnomalyPolicyRoutes(app);
  registerAnalysisExportRoutes(app);
  registerAnomalyIncidentRoutes(app);
  registerAnomalyRemediationRoutes(app);
  registerRemediationEffectivenessRoutes(app);
  registerProviderAdminRoutes(app);
};
