import { currencyKeys, missionKinds, missionStatuses, missionMetricKeys } from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { UpsertMissionDefinitionInput } from "@neuro/contracts";

import {
  archiveOperatorMissionDefinition,
  claimMission,
  createOperatorMissionDefinition,
  deleteOperatorMissionDefinition,
  getMissionPanel,
  listOperatorMissionDefinitions,
  placeCheckinWager,
  updateOperatorMissionDefinition,
} from "@/modules/personal-missions/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const missionUpsertSchema = z.object({
  kind: z.enum(missionKinds),
  status: z.enum(missionStatuses),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().min(1).max(5_000),
  eyebrow: z.string().trim().min(1).max(40),
  rewardCurrency: z.enum(currencyKeys),
  rewardAmount: z.number().int().positive(),
  metricKey: z.enum(missionMetricKeys),
  progressTarget: z.number().int().positive(),
  streakTarget: z.number().int().positive().nullable().optional(),
  startsAt: z.string().trim().min(1).nullable().optional(),
  endsAt: z.string().trim().min(1).nullable().optional(),
  sortOrder: z.number().int(),
});

const missionParamsSchema = z.object({
  missionId: z.string().trim().min(1),
});

function toMissionUpsertInput(input: z.infer<typeof missionUpsertSchema>): UpsertMissionDefinitionInput {
  return {
    ...input,
    subtitle: input.subtitle ?? null,
    streakTarget: input.streakTarget ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
  };
}

export const personalMissionsRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/me/missions/panel", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("personalMissions");
    const { userId } = assertUserContext(request);
    return {
      panel: await getMissionPanel(userId),
    };
  });

  app.post<{ Params: z.infer<typeof missionParamsSchema> }>(
    "/v1/me/missions/:missionId/claim",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("personalMissions");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      const { missionId } = missionParamsSchema.parse(request.params);
      return {
        reward: await claimMission(userId, missionId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof missionParamsSchema> }>(
    "/v1/me/missions/:missionId/checkin-wager",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("personalMissions");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      const { missionId } = missionParamsSchema.parse(request.params);
      return {
        wager: await placeCheckinWager(userId, missionId),
      };
    },
  );

  app.get("/v1/internal/missions", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("personalMissions");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      missions: await listOperatorMissionDefinitions(userId, providerUserId),
    };
  });

  app.post<{ Body: z.infer<typeof missionUpsertSchema> }>(
    "/v1/internal/missions",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("personalMissions");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = missionUpsertSchema.parse(request.body ?? {});
      return {
        mission: await createOperatorMissionDefinition(userId, providerUserId, toMissionUpsertInput(payload)),
      };
    },
  );

  app.post<{ Params: z.infer<typeof missionParamsSchema>; Body: z.infer<typeof missionUpsertSchema> }>(
    "/v1/internal/missions/:missionId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("personalMissions");
      const { userId, providerUserId } = assertUserContext(request);
      const { missionId } = missionParamsSchema.parse(request.params);
      const payload = missionUpsertSchema.parse(request.body ?? {});
      return {
        mission: await updateOperatorMissionDefinition(
          userId,
          providerUserId,
          missionId,
          toMissionUpsertInput(payload),
        ),
      };
    },
  );

  app.post<{ Params: z.infer<typeof missionParamsSchema> }>(
    "/v1/internal/missions/:missionId/archive",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("personalMissions");
      const { userId, providerUserId } = assertUserContext(request);
      const { missionId } = missionParamsSchema.parse(request.params);
      return {
        mission: await archiveOperatorMissionDefinition(userId, providerUserId, missionId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof missionParamsSchema> }>(
    "/v1/internal/missions/:missionId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("personalMissions");
      const { userId, providerUserId } = assertUserContext(request);
      const { missionId } = missionParamsSchema.parse(request.params);
      await deleteOperatorMissionDefinition(userId, providerUserId, missionId);
      return { ok: true as const };
    },
  );
};
