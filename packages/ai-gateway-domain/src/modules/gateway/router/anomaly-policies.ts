import type { FastifyInstance } from "fastify";

import {
  listGatewayAnalysisAnomalyPoliciesForOperator,
  getGatewayAnalysisAnomalyPolicySummaryForOperator,
  saveGatewayAnalysisAnomalyPolicyForOperator,
  syncGatewayAnalysisAnomalyPolicyForOperator,
  sweepGatewayAnalysisAnomalyPoliciesForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  anomalyPolicyBodySchema,
  anomalyPolicySweepBodySchema,
  readQueryBoolean,
  readQueryLimit,
  readQueryString,
} from "./shared";

export function registerAnomalyPolicyRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/analysis/anomaly-policies", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      policies: await listGatewayAnalysisAnomalyPoliciesForOperator(userId, providerUserId, {
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        status: readQueryString(query, "status"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        autoSyncEnabled: readQueryBoolean(query, "autoSyncEnabled"),
        autoEscalateEnabled: readQueryBoolean(query, "autoEscalateEnabled"),
        autoRemediationEnabled: readQueryBoolean(query, "autoRemediationEnabled"),
        alertingEnabled: readQueryBoolean(query, "alertingEnabled"),
        dueOnly: readQueryBoolean(query, "dueOnly"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-policies/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisAnomalyPolicySummaryForOperator(userId, providerUserId, {
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        status: readQueryString(query, "status"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        autoSyncEnabled: readQueryBoolean(query, "autoSyncEnabled"),
        autoEscalateEnabled: readQueryBoolean(query, "autoEscalateEnabled"),
        autoRemediationEnabled: readQueryBoolean(query, "autoRemediationEnabled"),
        alertingEnabled: readQueryBoolean(query, "alertingEnabled"),
        dueOnly: readQueryBoolean(query, "dueOnly"),
        limit: readQueryLimit(query, 200),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-policies", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyPolicyBodySchema.parse(request.body ?? {});
    return {
      policy: await saveGatewayAnalysisAnomalyPolicyForOperator(userId, providerUserId, body),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-policies/:policyId/sync", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const policyId = readQueryString(request.params as Record<string, unknown>, "policyId");
    return syncGatewayAnalysisAnomalyPolicyForOperator(userId, providerUserId, policyId);
  });

  app.post("/v1/internal/gateway/analysis/anomaly-policies/sweep-sync", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyPolicySweepBodySchema.parse(request.body ?? {});
    return {
      sweep: await sweepGatewayAnalysisAnomalyPoliciesForOperator(userId, providerUserId, body),
    };
  });
}
