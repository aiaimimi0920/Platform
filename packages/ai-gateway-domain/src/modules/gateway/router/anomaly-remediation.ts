import type { FastifyInstance } from "fastify";

import {
  listGatewayAnalysisAnomalyRemediationQueueForOperator,
  listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator,
  getGatewayAnalysisAnomalyRemediationRunSummaryForOperator,
  getGatewayAnalysisAnomalyRemediationRunImpactForOperator,
  captureGatewayAnalysisAnomalyRemediationRunImpactForOperator,
  getGatewayAnalysisAnomalyIncidentRemediationPlanForOperator,
  executeGatewayAnalysisAnomalyIncidentRemediationForOperator,
  sweepGatewayAnalysisAnomalyRemediationsForOperator,
} from "@/modules/gateway/service";
import {
  gatewayAnalysisAnomalyRemediationExecutionModes,
  gatewayAnalysisAnomalyRemediationRunStatuses,
} from "@neuro/contracts";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  anomalyRemediationSweepBodySchema,
  anomalyRemediationRunBodySchema,
  readQueryBoolean,
  readQueryInt,
  readQueryLimit,
  readQueryString,
} from "./shared";

export function registerAnomalyRemediationRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/analysis/remediation-queue", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      queue: await listGatewayAnalysisAnomalyRemediationQueueForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        ownerUserId: readQueryString(query, "ownerUserId"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        status: readQueryString(query, "status"),
        followUpStatus: readQueryString(query, "followUpStatus"),
        escalationStatus: readQueryString(query, "escalationStatus"),
        code: readQueryString(query, "code"),
        severity: readQueryString(query, "severity"),
        actionKey: readQueryString(query, "actionKey"),
        executionMode: readQueryString(query, "executionMode") as
          | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
          | null,
        dueOnly: readQueryBoolean(query, "dueOnly"),
        limit: readQueryLimit(query, 50),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      runs: await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        actionKey: readQueryString(query, "actionKey"),
        status: readQueryString(query, "status") as (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number] | null,
        executionMode: readQueryString(query, "executionMode") as
          | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
          | null,
        dryRun: readQueryBoolean(query, "dryRun"),
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisAnomalyRemediationRunSummaryForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        actionKey: readQueryString(query, "actionKey"),
        status: readQueryString(query, "status") as (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number] | null,
        executionMode: readQueryString(query, "executionMode") as
          | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
          | null,
        dryRun: readQueryBoolean(query, "dryRun"),
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 500),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/:runId/impact", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const runId = readQueryString(request.params as Record<string, unknown>, "runId");
    const query = request.query as Record<string, unknown>;
    return {
      impact: await getGatewayAnalysisAnomalyRemediationRunImpactForOperator(userId, providerUserId, runId, {
        windowMinutes: readQueryInt(query, "windowMinutes"),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/remediation-runs/:runId/capture-impact", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const runId = readQueryString(request.params as Record<string, unknown>, "runId");
    const query = request.query as Record<string, unknown>;
    return {
      capture: await captureGatewayAnalysisAnomalyRemediationRunImpactForOperator(
        userId,
        providerUserId,
        runId,
        {
          windowMinutes: readQueryInt(query, "windowMinutes"),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/remediation-plan", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    return {
      plan: await getGatewayAnalysisAnomalyIncidentRemediationPlanForOperator(userId, providerUserId, incidentId),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/remediation-runs", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    const query = request.query as Record<string, unknown>;
    return {
      runs: await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(userId, providerUserId, {
        incidentId,
        policyId: readQueryString(query, "policyId"),
        routePolicyId: readQueryString(query, "routePolicyId"),
        actionKey: readQueryString(query, "actionKey"),
        status: readQueryString(query, "status") as (typeof gatewayAnalysisAnomalyRemediationRunStatuses)[number] | null,
        executionMode: readQueryString(query, "executionMode") as
          | (typeof gatewayAnalysisAnomalyRemediationExecutionModes)[number]
          | null,
        dryRun: readQueryBoolean(query, "dryRun"),
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/remediation-runs", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    const body = anomalyRemediationRunBodySchema.parse(request.body ?? {});
    return {
      run: await executeGatewayAnalysisAnomalyIncidentRemediationForOperator(
        userId,
        providerUserId,
        incidentId,
        body,
      ),
    };
  });

  app.post("/v1/internal/gateway/analysis/remediation-runs/sweep", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyRemediationSweepBodySchema.parse(request.body ?? {});
    return {
      sweep: await sweepGatewayAnalysisAnomalyRemediationsForOperator(userId, providerUserId, body),
    };
  });
}
