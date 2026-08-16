import type { FastifyInstance } from "fastify";

import {
  getGatewayAnalysisAnomalyRemediationEffectivenessForOperator,
  listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator,
  listGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotsForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator,
  persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator,
  getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator,
  persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator,
} from "@/modules/gateway/service";
import {
  gatewayAnalysisAnomalyRemediationExecutionModes,
  gatewayAnalysisAnomalyRemediationRunStatuses,
} from "@neuro/contracts";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  anomalyRemediationEffectivenessSnapshotBodySchema,
  anomalyRemediationEffectivenessAnomalySnapshotBodySchema,
  readQueryBoolean,
  readQueryInt,
  readQueryLimit,
  readQueryNumber,
  readQueryString,
} from "./shared";

export function registerRemediationEffectivenessRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      effectiveness: await getGatewayAnalysisAnomalyRemediationEffectivenessForOperator(
        userId,
        providerUserId,
        {
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
        },
        {
          windowMinutes: readQueryInt(query, "windowMinutes"),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      snapshots: await listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 500),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/trend-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 10),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/anomaly-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 10),
          profileKey: readQueryString(query, "profileKey"),
          impactedRunRateWarningThreshold: readQueryNumber(query, "impactedRunRateWarningThreshold"),
          impactedRunRateCriticalThreshold: readQueryNumber(query, "impactedRunRateCriticalThreshold"),
          unavailableRunRateWarningThreshold: readQueryNumber(query, "unavailableRunRateWarningThreshold"),
          unavailableRunRateCriticalThreshold: readQueryNumber(query, "unavailableRunRateCriticalThreshold"),
          completionRateRegressedWarningThreshold: readQueryNumber(query, "completionRateRegressedWarningThreshold"),
          completionRateRegressedCriticalThreshold: readQueryNumber(query, "completionRateRegressedCriticalThreshold"),
          failureRateRegressedWarningThreshold: readQueryNumber(query, "failureRateRegressedWarningThreshold"),
          failureRateRegressedCriticalThreshold: readQueryNumber(query, "failureRateRegressedCriticalThreshold"),
          requestArtifactRegressedWarningThreshold: readQueryNumber(query, "requestArtifactRegressedWarningThreshold"),
          requestArtifactRegressedCriticalThreshold: readQueryNumber(query, "requestArtifactRegressedCriticalThreshold"),
          responseArtifactRegressedWarningThreshold: readQueryNumber(query, "responseArtifactRegressedWarningThreshold"),
          responseArtifactRegressedCriticalThreshold: readQueryNumber(query, "responseArtifactRegressedCriticalThreshold"),
          firstTokenLatencyRegressedWarningThreshold: readQueryNumber(query, "firstTokenLatencyRegressedWarningThreshold"),
          firstTokenLatencyRegressedCriticalThreshold: readQueryNumber(query, "firstTokenLatencyRegressedCriticalThreshold"),
          totalTokensRegressedWarningThreshold: readQueryNumber(query, "totalTokensRegressedWarningThreshold"),
          totalTokensRegressedCriticalThreshold: readQueryNumber(query, "totalTokensRegressedCriticalThreshold"),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/anomaly-snapshots", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      snapshots: await listGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotsForOperator(
        userId,
        providerUserId,
        {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          actionKey: readQueryString(query, "actionKey"),
          profileKey: readQueryString(query, "profileKey"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/anomaly-snapshots/:snapshotId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const snapshotId = readQueryString(request.params as Record<string, unknown>, "snapshotId");
    return {
      snapshot: await getGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
        userId,
        providerUserId,
        snapshotId,
      ),
    };
  });

  app.post("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/anomaly-snapshots", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyRemediationEffectivenessAnomalySnapshotBodySchema.parse(request.body ?? {});
    return {
      snapshot: await persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
        userId,
        providerUserId,
        body,
      ),
    };
  });

  app.get("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshots/:snapshotId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const snapshotId = readQueryString(request.params as Record<string, unknown>, "snapshotId");
    return {
      snapshot: await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
        userId,
        providerUserId,
        snapshotId,
      ),
    };
  });

  app.post("/v1/internal/gateway/analysis/remediation-runs/effectiveness/snapshot", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyRemediationEffectivenessSnapshotBodySchema.parse(request.body ?? {});
    return {
      snapshot: await persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
        userId,
        providerUserId,
        body,
      ),
    };
  });
}
