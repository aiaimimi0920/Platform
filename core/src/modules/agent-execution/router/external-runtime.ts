import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { buildStoredExternalCallbackReplayEnvelope } from "@/modules/agent-execution/callback-governance";
import {
  addExternalAgentExecutionArtifact,
  handleExternalAgentCallback,
  recordExternalAgentExecutionHeartbeat,
  updateExternalAgentExecutionStatus,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import {
  addArtifactSchema,
  assertExternalCallbackSignature,
  auditRejectedExternalCallback,
  externalCallbackSchema,
  getExternalCallbackId,
  getExternalCallbackSecret,
  getExternalCallbackTimestamp,
  getExternalCallbackVersion,
  heartbeatSchema,
  updateStatusSchema,
} from "./shared";

export function registerExternalRuntimeRoutes(app: FastifyInstance) {
  app.post<{ Params: { executionId: string }; Body: z.infer<typeof updateStatusSchema> }>(
    "/external/agent-executions/:executionId/status",
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const payload = updateStatusSchema.parse(request.body);
      try {
        const callbackSecret = getExternalCallbackSecret(request);
        const callbackId = getExternalCallbackId(request);
        const callbackVersion = getExternalCallbackVersion(request);
        const callbackTimestamp = new Date(getExternalCallbackTimestamp(request) * 1000);
        assertExternalCallbackSignature({
          request,
          executionId: request.params.executionId,
          payload,
          callbackSecret,
          callbackId,
        });
        return {
          execution: await updateExternalAgentExecutionStatus(
            request.params.executionId,
            callbackSecret,
            callbackId,
            callbackVersion,
            callbackTimestamp,
            payload,
          ),
        };
      } catch (error) {
        await auditRejectedExternalCallback({
          request,
          executionId: request.params.executionId,
          callbackType: "status",
          payload,
          replayPayload: buildStoredExternalCallbackReplayEnvelope({
            type: "status",
            status: payload.status,
            statusNote: payload.statusNote,
            resultSummary: payload.resultSummary,
          }),
          reason: error instanceof Error ? error.message : "status callback rejected",
        });
        throw error;
      }
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof heartbeatSchema> }>(
    "/external/agent-executions/:executionId/heartbeat",
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const payload = heartbeatSchema.parse(request.body);
      try {
        const callbackSecret = getExternalCallbackSecret(request);
        const callbackId = getExternalCallbackId(request);
        const callbackVersion = getExternalCallbackVersion(request);
        const callbackTimestamp = new Date(getExternalCallbackTimestamp(request) * 1000);
        assertExternalCallbackSignature({
          request,
          executionId: request.params.executionId,
          payload,
          callbackSecret,
          callbackId,
        });
        return {
          execution: await recordExternalAgentExecutionHeartbeat(
            request.params.executionId,
            callbackSecret,
            callbackId,
            callbackVersion,
            callbackTimestamp,
            payload.statusNote,
          ),
        };
      } catch (error) {
        await auditRejectedExternalCallback({
          request,
          executionId: request.params.executionId,
          callbackType: "heartbeat",
          payload,
          replayPayload: buildStoredExternalCallbackReplayEnvelope({
            type: "heartbeat",
            statusNote: payload.statusNote,
          }),
          reason: error instanceof Error ? error.message : "heartbeat rejected",
        });
        throw error;
      }
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof addArtifactSchema> }>(
    "/external/agent-executions/:executionId/artifacts",
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const payload = addArtifactSchema.parse(request.body);
      try {
        const callbackSecret = getExternalCallbackSecret(request);
        const callbackId = getExternalCallbackId(request);
        const callbackVersion = getExternalCallbackVersion(request);
        const callbackTimestamp = new Date(getExternalCallbackTimestamp(request) * 1000);
        assertExternalCallbackSignature({
          request,
          executionId: request.params.executionId,
          payload,
          callbackSecret,
          callbackId,
        });
        return {
          execution: await addExternalAgentExecutionArtifact(
            request.params.executionId,
            callbackSecret,
            callbackId,
            callbackVersion,
            callbackTimestamp,
            payload,
          ),
        };
      } catch (error) {
        await auditRejectedExternalCallback({
          request,
          executionId: request.params.executionId,
          callbackType: "artifact",
          payload,
          replayPayload: buildStoredExternalCallbackReplayEnvelope({
            type: "artifact",
            artifact: payload,
          }),
          reason: error instanceof Error ? error.message : "artifact callback rejected",
        });
        throw error;
      }
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof externalCallbackSchema> }>(
    "/external/agent-executions/:executionId/callback",
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const payload = externalCallbackSchema.parse(request.body);
      try {
        const callbackSecret = getExternalCallbackSecret(request);
        const callbackId = getExternalCallbackId(request);
        const callbackVersion = getExternalCallbackVersion(request);
        const callbackTimestamp = new Date(getExternalCallbackTimestamp(request) * 1000);
        assertExternalCallbackSignature({
          request,
          executionId: request.params.executionId,
          payload,
          callbackSecret,
          callbackId,
        });
        return {
          execution: await handleExternalAgentCallback(
            request.params.executionId,
            callbackSecret,
            callbackId,
            callbackVersion,
            callbackTimestamp,
            payload,
          ),
        };
      } catch (error) {
        await auditRejectedExternalCallback({
          request,
          executionId: request.params.executionId,
          callbackType: payload.type === "status" ? "status" : payload.type === "artifact" ? "artifact" : payload.type,
          payload,
          replayPayload: buildStoredExternalCallbackReplayEnvelope(payload),
          reason: error instanceof Error ? error.message : "callback rejected",
        });
        throw error;
      }
    },
  );
}
