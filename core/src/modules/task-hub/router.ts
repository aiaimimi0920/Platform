import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  acceptAgentProposal,
  advanceTaskLifecycle,
  applyToTask,
  createAgentProposal,
  createTask,
  dispatchTask,
  getDispatchDecision,
  listMyTasks,
  getTaskSummary,
  listAgentProposals,
  listVisibleAgentProposals,
  listApplications,
  listTasks,
  rejectAgentProposal,
} from "@/modules/task-hub/service";
import { BadRequestError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { getFeatureSnapshot, requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const createTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  preferredCapabilityCodes: z.array(z.string().min(1)).optional(),
  pricingMode: z.enum(["flat_task", "token_metered", "property_metered"]).optional(),
  billingUnit: z.string().max(64).optional().nullable(),
  meterKey: z.string().max(64).optional().nullable(),
  meterQuantity: z.number().int().positive().optional().nullable(),
  operationMode: z.enum(["manual", "automatic"]).optional(),
  rewardCurrency: z.enum(["obsidian", "mira"]),
  rewardAmount: z.number().int().positive(),
  requiredBondAmount: z.number().int().min(0),
});

const applyTaskSchema = z.object({
  statement: z.string().min(10),
  proposedEtaHours: z.number().int().positive(),
});

const createAgentProposalSchema = z.object({
  agentId: z.string().min(1),
  statement: z.string().min(10),
  proposedEtaHours: z.number().int().positive(),
  proposedCostNote: z.string().max(1000).optional(),
});

const lifecycleSchema = z.object({
  action: z.enum(["start", "submit", "accept", "default", "cancel"]),
});

export const taskHubRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/tasks", { preHandler: withInternalRequest }, async () => {
    await requireModuleEnabled("taskHub");
    return {
      tasks: await listTasks(),
    };
  });

  app.get("/v1/tasks/mine", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("taskHub");
    const { userId } = assertUserContext(request);
    return {
      tasks: await listMyTasks(userId),
    };
  });

  app.post<{ Body: z.infer<typeof createTaskSchema> }>(
    "/v1/tasks",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      return {
        task: await createTask(userId, createTaskSchema.parse(request.body)),
      };
    },
  );

  app.get<{ Params: { taskId: string } }>(
    "/v1/tasks/:taskId/applications",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      const { userId } = assertUserContext(request);
      const task = await getTaskSummary(request.params.taskId);
      if (!task) {
        throw new NotFoundError("Task not found");
      }
      if (task.creatorUserId !== userId && task.assignedUserId !== userId) {
        throw new UnauthorizedError("只有任务发布者或当前承接者可以查看申请列表");
      }
      return {
        applications: await listApplications(request.params.taskId),
      };
    },
  );

  app.post<{ Params: { taskId: string }; Body: z.infer<typeof applyTaskSchema> }>(
    "/v1/tasks/:taskId/applications",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      const payload = applyTaskSchema.parse(request.body);
      return applyToTask(userId, request.params.taskId, payload.statement, payload.proposedEtaHours);
    },
  );

  app.get<{ Params: { taskId: string } }>(
    "/v1/tasks/:taskId/agent-proposals",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        proposals: await listVisibleAgentProposals(userId, request.params.taskId),
      };
    },
  );

  app.post<{ Params: { taskId: string }; Body: z.infer<typeof createAgentProposalSchema> }>(
    "/v1/tasks/:taskId/agent-proposals",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      const payload = createAgentProposalSchema.parse(request.body);
      return {
        proposal: await createAgentProposal(userId, request.params.taskId, payload),
      };
    },
  );

  app.post<{ Params: { taskId: string; proposalId: string } }>(
    "/v1/tasks/:taskId/agent-proposals/:proposalId/accept",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return acceptAgentProposal(userId, request.params.taskId, request.params.proposalId);
    },
  );

  app.post<{ Params: { taskId: string; proposalId: string } }>(
    "/v1/tasks/:taskId/agent-proposals/:proposalId/reject",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        proposal: await rejectAgentProposal(userId, request.params.taskId, request.params.proposalId),
      };
    },
  );

  app.post<{ Params: { taskId: string } }>(
    "/v1/tasks/:taskId/dispatch",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      const { userId } = assertUserContext(request);
      const task = await getTaskSummary(request.params.taskId);
      if (!task) {
        throw new NotFoundError("Task not found");
      }
      if (task.creatorUserId !== userId) {
        throw new UnauthorizedError("只有任务发布者可以手动触发调度");
      }
      const dispatch = await dispatchTask(request.params.taskId);
      if (!dispatch) {
        throw new BadRequestError("当前没有可调度的候选者");
      }
      return { dispatch };
    },
  );

  app.get<{ Params: { taskId: string } }>(
    "/v1/tasks/:taskId/dispatch",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("taskHub");
      assertUserContext(request);
      return {
        dispatch: await getDispatchDecision(request.params.taskId),
      };
    },
  );

  app.post<{ Params: { taskId: string }; Body: z.infer<typeof lifecycleSchema> }>(
    "/v1/tasks/:taskId/lifecycle",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId } = assertUserContext(request);
      const payload = lifecycleSchema.parse(request.body);
      const snapshot = await getFeatureSnapshot();
      if (!snapshot.taskHub.enabled) {
        const task = await getTaskSummary(request.params.taskId);
        if (!task) {
          throw new NotFoundError("Task not found");
        }
        if (!["open", "applying", "assigned", "in_progress", "submitted"].includes(task.status)) {
          throw new BadRequestError("任务模块已关闭，当前任务不允许继续推进");
        }
      }
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      return {
        task: await advanceTaskLifecycle(userId, request.params.taskId, payload.action),
      };
    },
  );
};
