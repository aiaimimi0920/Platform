import type { FastifyInstance } from "fastify";

import {
  exportGatewayAnalysisRowsForOperator,
  persistGatewayAnalysisExportForOperator,
  listGatewayPersistedAnalysisExportsForOperator,
  getGatewayPersistedAnalysisExportInventorySummaryForOperator,
  getGatewayAnalysisExportBaselineReportForOperator,
  getGatewayAnalysisExportTimelineReportForOperator,
  getGatewayAnalysisExportTrendReportForOperator,
  getGatewayAnalysisExportAnomalyReportForOperator,
  getGatewayPersistedAnalysisExportDiffForOperator,
  getGatewayPersistedAnalysisExportForOperator,
  updateGatewayPersistedAnalysisExportMetadataForOperator,
  runGatewayPersistedAnalysisExportCleanupForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  analysisExportPersistBodySchema,
  analysisExportMetadataBodySchema,
  analysisExportCleanupBodySchema,
  readGatewayRequestAuditFilters,
  readQueryBoolean,
  readQueryInt,
  readQueryLimit,
  readQueryNumber,
  readQueryString,
} from "./shared";

export function registerAnalysisExportRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/analysis/export", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      export: await exportGatewayAnalysisRowsForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 200),
        artifactAvailable: readQueryBoolean(query, "artifactAvailable"),
        textMode: readQueryString(query, "textMode") as any,
        maxTextChars: readQueryInt(query, "maxTextChars"),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/export", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = analysisExportPersistBodySchema.parse(request.body ?? {});
    return {
      export: await persistGatewayAnalysisExportForOperator(userId, providerUserId, body),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      exports: await listGatewayPersistedAnalysisExportsForOperator(userId, providerUserId, {
        exportId: readQueryString(query, "exportId"),
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayPersistedAnalysisExportInventorySummaryForOperator(userId, providerUserId, {
        exportId: readQueryString(query, "exportId"),
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/baseline-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisExportBaselineReportForOperator(userId, providerUserId, {
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 10),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/timeline-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisExportTimelineReportForOperator(userId, providerUserId, {
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 5),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/trend-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisExportTrendReportForOperator(userId, providerUserId, {
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 10),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/anomaly-report", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      report: await getGatewayAnalysisExportAnomalyReportForOperator(userId, providerUserId, {
        label: readQueryString(query, "label"),
        tag: readQueryString(query, "tag"),
        projectId: readQueryString(query, "projectId"),
        status: readQueryString(query, "status") as any,
        textMode: readQueryString(query, "textMode") as any,
        createdFrom: readQueryString(query, "createdFrom"),
        createdTo: readQueryString(query, "createdTo"),
        limit: readQueryLimit(query, 10),
        profileKey: readQueryString(query, "profileKey"),
        failureRateWarningThreshold: readQueryNumber(query, "failureRateWarningThreshold"),
        failureRateCriticalThreshold: readQueryNumber(query, "failureRateCriticalThreshold"),
        failureRateDeltaRatioThreshold: readQueryNumber(query, "failureRateDeltaRatioThreshold"),
        completionRateWarningThreshold: readQueryNumber(query, "completionRateWarningThreshold"),
        completionRateCriticalThreshold: readQueryNumber(query, "completionRateCriticalThreshold"),
        completionRateDeltaValueThreshold: readQueryNumber(query, "completionRateDeltaValueThreshold"),
        responseArtifactCoverageWarningThreshold: readQueryNumber(query, "responseArtifactCoverageWarningThreshold"),
        responseArtifactCoverageCriticalThreshold: readQueryNumber(query, "responseArtifactCoverageCriticalThreshold"),
        responseArtifactCoverageDeltaValueThreshold: readQueryNumber(query, "responseArtifactCoverageDeltaValueThreshold"),
        requestArtifactCoverageWarningThreshold: readQueryNumber(query, "requestArtifactCoverageWarningThreshold"),
        requestArtifactCoverageCriticalThreshold: readQueryNumber(query, "requestArtifactCoverageCriticalThreshold"),
        requestArtifactCoverageDeltaValueThreshold: readQueryNumber(query, "requestArtifactCoverageDeltaValueThreshold"),
        tokensPerSampleWarningDeltaRatioThreshold: readQueryNumber(query, "tokensPerSampleWarningDeltaRatioThreshold"),
        tokensPerSampleCriticalDeltaRatioThreshold: readQueryNumber(query, "tokensPerSampleCriticalDeltaRatioThreshold"),
        tokensPerSampleCriticalAbsoluteThreshold: readQueryNumber(query, "tokensPerSampleCriticalAbsoluteThreshold"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/diff", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      diff: await getGatewayPersistedAnalysisExportDiffForOperator(userId, providerUserId, {
        leftExportId: readQueryString(query, "leftExportId"),
        rightExportId: readQueryString(query, "rightExportId"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/exports/:exportId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const exportId = readQueryString(request.params as Record<string, unknown>, "exportId");
    return {
      export: await getGatewayPersistedAnalysisExportForOperator(userId, providerUserId, exportId),
    };
  });

  app.post("/v1/internal/gateway/analysis/exports/:exportId/metadata", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const exportId = readQueryString(request.params as Record<string, unknown>, "exportId");
    const body = analysisExportMetadataBodySchema.parse(request.body ?? {});
    return {
      export: await updateGatewayPersistedAnalysisExportMetadataForOperator(userId, providerUserId, exportId, body),
    };
  });

  app.post("/v1/internal/gateway/analysis/exports/cleanup-expired", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = analysisExportCleanupBodySchema.parse(request.body ?? {});
    return {
      cleanup: await runGatewayPersistedAnalysisExportCleanupForOperator(userId, providerUserId, body),
    };
  });
}
