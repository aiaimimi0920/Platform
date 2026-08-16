import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  autoRemediateRejectedCallbackPayloads,
  emitCallbackRemediationAlerts,
  getCallbackAuditSummaryForOperator,
  getCallbackRemediationSummaryForOperator,
  listCallbackAuditsForOperator,
  replayRejectedCallbackPayloadByOperator,
  requestRejectedCallbackRetriesByOperator,
  requestRejectedCallbackRetryByOperator,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";
import {
  autoRemediateCallbackPayloadSchema,
  callbackRemediationSummaryQuerySchema,
  emitCallbackRemediationAlertsSchema,
  listCallbackAuditQuerySchema,
  replayCallbackPayloadSchema,
  requestCallbackRetryBatchSchema,
  requestCallbackRetrySchema,
} from "./shared";

export function registerCallbackAuditRoutes(app: FastifyInstance) {
  app.get<{ Querystring: z.infer<typeof listCallbackAuditQuerySchema> }>(
    "/v1/internal/agent-executions/callback-audits",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listCallbackAuditQuerySchema.parse(request.query);
      return {
        callbacks: await listCallbackAuditsForOperator(query),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listCallbackAuditQuerySchema> }>(
    "/v1/internal/agent-executions/callback-audits/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listCallbackAuditQuerySchema.parse(request.query);
      return {
        summary: await getCallbackAuditSummaryForOperator(query),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof callbackRemediationSummaryQuerySchema> }>(
    "/v1/internal/agent-executions/callback-audits/remediation-summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        summary: await getCallbackRemediationSummaryForOperator(
          callbackRemediationSummaryQuerySchema.parse(request.query),
        ),
      };
    },
  );

  app.post<{ Params: { auditId: string }; Body: z.infer<typeof requestCallbackRetrySchema> }>(
    "/v1/internal/agent-executions/callback-audits/:auditId/request-retry",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const body = requestCallbackRetrySchema.parse(request.body ?? {});
      return {
        result: await requestRejectedCallbackRetryByOperator(userId, request.params.auditId, body),
      };
    },
  );

  app.post<{ Body: z.infer<typeof requestCallbackRetryBatchSchema> }>(
    "/v1/internal/agent-executions/callback-audits/request-retry-batch",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const body = requestCallbackRetryBatchSchema.parse(request.body ?? {});
      return {
        result: await requestRejectedCallbackRetriesByOperator(userId, body),
      };
    },
  );

  app.post<{ Params: { auditId: string }; Body: z.infer<typeof replayCallbackPayloadSchema> }>(
    "/v1/internal/agent-executions/callback-audits/:auditId/replay-payload",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const body = replayCallbackPayloadSchema.parse(request.body ?? {});
      return {
        result: await replayRejectedCallbackPayloadByOperator(userId, request.params.auditId, body),
      };
    },
  );

  app.post<{ Body: z.infer<typeof autoRemediateCallbackPayloadSchema> }>(
    "/v1/internal/agent-executions/callback-audits/auto-remediate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const body = autoRemediateCallbackPayloadSchema.parse(request.body ?? {});
      return {
        result: await autoRemediateRejectedCallbackPayloads({
          ...body,
          actorUserId: typeof headerUserId === "string" && headerUserId.length > 0 ? headerUserId : null,
          actorLabel:
            typeof headerUserId === "string" && headerUserId.length > 0
              ? "Operator auto remediation"
              : "Automatic remediation",
        }),
      };
    },
  );

  app.post<{ Body: z.infer<typeof emitCallbackRemediationAlertsSchema> }>(
    "/v1/internal/agent-executions/callback-audits/emit-alerts",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const body = emitCallbackRemediationAlertsSchema.parse(request.body ?? {});
      return {
        result: await emitCallbackRemediationAlerts(body),
      };
    },
  );
}
