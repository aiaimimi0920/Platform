import {
  agentExecutionOwnerReliefHandoffFocusSections,
  agentExecutionOwnerReliefHandoffFollowUpProfiles,
  agentExecutionOwnerReliefRunHandoffTargetTypes,
  agentExecutionRuntimePressureLevels,
  agentExecutionRuntimeSchedulingDecisionClasses,
  agentExecutionOwnerReliefRunActionKinds,
  agentExecutionOwnerReliefRunResultStatuses,
} from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  clearAgentExecutionOwnerReliefHandoffDefaultForOperator,
  finalizeAgentExecutionOwnerReliefRunForOperator,
  listAgentExecutionOwnerReliefHandoffDefaultsForOperator,
  listAgentExecutionOwnerReliefRunsForOperator,
  openAgentExecutionOwnerReliefRunHandoffForOperator,
  recordAgentExecutionOwnerReliefRunActionForOperator,
  reopenAgentExecutionOwnerReliefRunForOperator,
  resolveAgentExecutionOwnerReliefRunHandoffForOperator,
  saveAgentExecutionOwnerReliefHandoffDefaultForOperator,
  startAgentExecutionOwnerReliefRunForOperator,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const ownerReliefRunParamsSchema = z.object({
  runId: z.string().trim().min(1),
});

const ownerReliefRunStartSchema = z.object({
  ownerUserId: z.string().trim().min(1),
  agentId: z.string().trim().max(120).nullable().optional(),
  triggerAction: z.enum(["sweep", "recover", "run", "recover_then_run"]).nullable().optional(),
  source: z.string().trim().max(120).nullable().optional(),
  runtimePressureLevel: z.enum(agentExecutionRuntimePressureLevels).nullable().optional(),
  runtimeSchedulingDecisionClass: z
    .enum(agentExecutionRuntimeSchedulingDecisionClasses)
    .nullable()
    .optional(),
});

const ownerReliefSummarySchema = z.object({
  sweepClosedCount: z.number().int().min(0).optional(),
  sweepSkippedCount: z.number().int().min(0).optional(),
  recoveredCount: z.number().int().min(0).optional(),
  exhaustedCount: z.number().int().min(0).optional(),
  processedCount: z.number().int().min(0).optional(),
  failedCount: z.number().int().min(0).optional(),
  recoveryExecutionIds: z.array(z.string().trim().min(1)).max(20).optional(),
  recoveryRunIds: z.array(z.string().trim().min(1)).max(20).optional(),
  executorExecutionIds: z.array(z.string().trim().min(1)).max(20).optional(),
  executorRunIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

const ownerReliefRunActionSchema = z.object({
  actionKind: z.enum(["sweep", "recover", "run", "recover_then_run"]),
  status: z.enum(["success", "error"]).optional(),
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(400).nullable().optional(),
  summary: ownerReliefSummarySchema,
});

const ownerReliefRunFinalizeSchema = z.object({
  resultStatus: z.enum(["continue", "observe", "escalate", "handed_off"]),
  note: z.string().trim().max(400).nullable().optional(),
  handoffTargetType: z.enum(agentExecutionOwnerReliefRunHandoffTargetTypes).nullable().optional(),
  handoffTarget: z.string().trim().max(160).nullable().optional(),
});

const ownerReliefRunHandoffOpenSchema = z.object({
  followUpHref: z.string().trim().max(800).nullable().optional(),
});

const ownerReliefRunHandoffResolveSchema = z.object({
  note: z.string().trim().max(400).nullable().optional(),
});

const ownerReliefHandoffDefaultSchema = z.object({
  handoffTargetType: z.enum(agentExecutionOwnerReliefRunHandoffTargetTypes),
  handoffTarget: z.string().trim().min(1).max(160),
  noteTemplate: z.string().trim().max(400).nullable().optional(),
  followUpFocusSection: z.enum(agentExecutionOwnerReliefHandoffFocusSections).nullable().optional(),
  followUpProfile: z.enum(agentExecutionOwnerReliefHandoffFollowUpProfiles).nullable().optional(),
});

const ownerReliefHandoffDefaultClearSchema = z.object({
  handoffTargetType: z.enum(agentExecutionOwnerReliefRunHandoffTargetTypes),
});

const ownerReliefRunsQuerySchema = z.object({
  ownerUserId: z.string().trim().min(1).optional(),
  agentId: z.string().trim().min(1).optional(),
  resultStatus: z.enum(agentExecutionOwnerReliefRunResultStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const agentExecutionRouter: FastifyPluginAsync = async (app) => {
  app.get(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        defaults: await listAgentExecutionOwnerReliefHandoffDefaultsForOperator(userId),
      };
    },
  );

  app.get("/v1/internal/agent-executions/owner-relief-runs", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("agentExecution");
    const { userId } = assertUserContext(request);
    const query = ownerReliefRunsQuerySchema.parse(request.query ?? {});
    return {
      runs: await listAgentExecutionOwnerReliefRunsForOperator(userId, {
        ownerUserId: query.ownerUserId ?? null,
        agentId: query.agentId ?? null,
        resultStatus: query.resultStatus ?? null,
        limit: query.limit ?? 8,
      }),
    };
  });

  app.post<{ Body: z.infer<typeof ownerReliefRunStartSchema> }>(
    "/v1/internal/agent-executions/owner-relief-runs/start",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const payload = ownerReliefRunStartSchema.parse(request.body ?? {});
      return {
        run: await startAgentExecutionOwnerReliefRunForOperator(userId, {
          ownerUserId: payload.ownerUserId,
          agentId: payload.agentId ?? null,
          triggerAction: payload.triggerAction ?? null,
          source: payload.source ?? null,
          runtimePressureLevel: payload.runtimePressureLevel ?? null,
          runtimeSchedulingDecisionClass: payload.runtimeSchedulingDecisionClass ?? null,
        }),
      };
    },
  );

  app.post<{ Body: z.infer<typeof ownerReliefHandoffDefaultSchema> }>(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const payload = ownerReliefHandoffDefaultSchema.parse(request.body ?? {});
      return {
        profile: await saveAgentExecutionOwnerReliefHandoffDefaultForOperator(userId, {
          handoffTargetType: payload.handoffTargetType,
          handoffTarget: payload.handoffTarget,
          noteTemplate: payload.noteTemplate ?? null,
          followUpFocusSection: payload.followUpFocusSection ?? null,
          followUpProfile: payload.followUpProfile ?? null,
        }),
      };
    },
  );

  app.post<{ Body: z.infer<typeof ownerReliefHandoffDefaultClearSchema> }>(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults/clear",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const payload = ownerReliefHandoffDefaultClearSchema.parse(request.body ?? {});
      await clearAgentExecutionOwnerReliefHandoffDefaultForOperator(userId, payload.handoffTargetType);
      return { ok: true as const };
    },
  );

  app.post<{
    Params: z.infer<typeof ownerReliefRunParamsSchema>;
    Body: z.infer<typeof ownerReliefRunActionSchema>;
  }>(
    "/v1/internal/agent-executions/owner-relief-runs/:runId/actions",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const { runId } = ownerReliefRunParamsSchema.parse(request.params);
      const payload = ownerReliefRunActionSchema.parse(request.body ?? {});
      return {
        action: await recordAgentExecutionOwnerReliefRunActionForOperator(userId, runId, {
          actionKind: payload.actionKind,
          status: payload.status ?? "success",
          title: payload.title,
          detail: payload.detail ?? null,
          summary: {
            sweepClosedCount: payload.summary.sweepClosedCount ?? 0,
            sweepSkippedCount: payload.summary.sweepSkippedCount ?? 0,
            recoveredCount: payload.summary.recoveredCount ?? 0,
            exhaustedCount: payload.summary.exhaustedCount ?? 0,
            processedCount: payload.summary.processedCount ?? 0,
            failedCount: payload.summary.failedCount ?? 0,
            recoveryExecutionIds: payload.summary.recoveryExecutionIds ?? [],
            recoveryRunIds: payload.summary.recoveryRunIds ?? [],
            executorExecutionIds: payload.summary.executorExecutionIds ?? [],
            executorRunIds: payload.summary.executorRunIds ?? [],
          },
        }),
      };
    },
  );

  app.post<{
    Params: z.infer<typeof ownerReliefRunParamsSchema>;
    Body: z.infer<typeof ownerReliefRunFinalizeSchema>;
  }>(
    "/v1/internal/agent-executions/owner-relief-runs/:runId/finalize",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const { runId } = ownerReliefRunParamsSchema.parse(request.params);
      const payload = ownerReliefRunFinalizeSchema.parse(request.body ?? {});
      return {
        run: await finalizeAgentExecutionOwnerReliefRunForOperator(userId, runId, {
          resultStatus: payload.resultStatus,
          note: payload.note ?? null,
          handoffTargetType: payload.handoffTargetType ?? null,
          handoffTarget: payload.handoffTarget ?? null,
        }),
      };
    },
  );

  app.post<{
    Params: z.infer<typeof ownerReliefRunParamsSchema>;
    Body: z.infer<typeof ownerReliefRunHandoffOpenSchema>;
  }>(
    "/v1/internal/agent-executions/owner-relief-runs/:runId/handoff/open",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const { runId } = ownerReliefRunParamsSchema.parse(request.params);
      const payload = ownerReliefRunHandoffOpenSchema.parse(request.body ?? {});
      return {
        handoff: await openAgentExecutionOwnerReliefRunHandoffForOperator(userId, runId, {
          followUpHref: payload.followUpHref ?? null,
        }),
      };
    },
  );

  app.post<{
    Params: z.infer<typeof ownerReliefRunParamsSchema>;
    Body: z.infer<typeof ownerReliefRunHandoffResolveSchema>;
  }>(
    "/v1/internal/agent-executions/owner-relief-runs/:runId/handoff/resolve",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const { runId } = ownerReliefRunParamsSchema.parse(request.params);
      const payload = ownerReliefRunHandoffResolveSchema.parse(request.body ?? {});
      return {
        handoff: await resolveAgentExecutionOwnerReliefRunHandoffForOperator(userId, runId, {
          note: payload.note ?? null,
        }),
      };
    },
  );

  app.post<{ Params: z.infer<typeof ownerReliefRunParamsSchema> }>(
    "/v1/internal/agent-executions/owner-relief-runs/:runId/reopen",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const { runId } = ownerReliefRunParamsSchema.parse(request.params);
      return {
        run: await reopenAgentExecutionOwnerReliefRunForOperator(userId, runId),
      };
    },
  );
};
