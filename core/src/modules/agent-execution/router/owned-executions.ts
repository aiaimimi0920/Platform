import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  addOwnedAgentExecutionArtifact,
  createOwnedAgentExecutionSubtask,
  createOwnedAgentExecution,
  listOwnedAgentExecutions,
  requeueOwnedAgentExecution,
  updateOwnedAgentExecutionCallbackRemediationPolicy,
  updateOwnedAgentExecutionSubtaskStatus,
  updateOwnedAgentExecutionStatus,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import {
  addArtifactSchema,
  createExecutionSchema,
  createSubtaskSchema,
  updateExecutionCallbackRemediationPolicySchema,
  updateStatusSchema,
  updateSubtaskStatusSchema,
} from "./shared";

export function registerOwnedExecutionRoutes(app: FastifyInstance) {
  app.get("/v1/agent-executions", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("agentExecution");
    const { userId } = assertUserContext(request);
    return {
      executions: await listOwnedAgentExecutions(userId),
    };
  });

  app.post<{ Body: z.infer<typeof createExecutionSchema> }>(
    "/v1/agent-executions",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        execution: await createOwnedAgentExecution(userId, createExecutionSchema.parse(request.body)),
      };
      },
    );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof createSubtaskSchema> }>(
    "/v1/agent-executions/:executionId/subtasks",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        execution: await createOwnedAgentExecutionSubtask(
          userId,
          request.params.executionId,
          createSubtaskSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string; subtaskId: string }; Body: z.infer<typeof updateSubtaskStatusSchema> }>(
    "/v1/agent-executions/:executionId/subtasks/:subtaskId/status",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        execution: await updateOwnedAgentExecutionSubtaskStatus(
          userId,
          request.params.executionId,
          request.params.subtaskId,
          updateSubtaskStatusSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof updateStatusSchema> }>(
    "/v1/agent-executions/:executionId/status",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        execution: await updateOwnedAgentExecutionStatus(
          userId,
          request.params.executionId,
          updateStatusSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof updateExecutionCallbackRemediationPolicySchema> }>(
    "/v1/agent-executions/:executionId/callback-remediation-policy",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        execution: await updateOwnedAgentExecutionCallbackRemediationPolicy(
          userId,
          request.params.executionId,
          updateExecutionCallbackRemediationPolicySchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof addArtifactSchema> }>(
    "/v1/agent-executions/:executionId/artifacts",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        execution: await addOwnedAgentExecutionArtifact(
          userId,
          request.params.executionId,
          addArtifactSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string } }>(
    "/v1/agent-executions/:executionId/requeue",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        execution: await requeueOwnedAgentExecution(userId, request.params.executionId),
      };
    },
  );
}
