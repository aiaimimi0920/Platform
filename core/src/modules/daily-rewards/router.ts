import { dailyMissionKeys, weeklyMissionKeys } from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  claimDailyMission,
  claimDailyReward,
  claimWeeklyMission,
  getDailyRewardStatus,
  listDailyMissions,
  listWeeklyMissions,
} from "@/modules/daily-rewards/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const missionClaimParamsSchema = z.object({
  missionKey: z.enum(dailyMissionKeys),
});

const weeklyMissionClaimParamsSchema = z.object({
  missionKey: z.enum(weeklyMissionKeys),
});

export const dailyRewardsRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/daily-rewards/status", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("personalMissions");
    const { userId } = assertUserContext(request);
    return {
      status: await getDailyRewardStatus(userId),
    };
  });

  app.post("/v1/daily-rewards/claim", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("personalMissions");
    await requireModuleEnabled("wallet");
    await requireModuleEnabled("ledger");
    const { userId } = assertUserContext(request);
    return {
      reward: await claimDailyReward(userId),
    };
  });

  app.get("/v1/daily-rewards/missions", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("personalMissions");
    const { userId } = assertUserContext(request);
    return {
      missions: await listDailyMissions(userId),
    };
  });

  app.post<{ Params: { missionKey: string } }>(
    "/v1/daily-rewards/missions/:missionKey/claim",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("personalMissions");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      const params = missionClaimParamsSchema.parse(request.params);
      return {
        reward: await claimDailyMission(userId, params.missionKey),
      };
    },
  );

  app.get("/v1/daily-rewards/weekly-missions", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("personalMissions");
    const { userId } = assertUserContext(request);
    return {
      missions: await listWeeklyMissions(userId),
    };
  });

  app.post<{ Params: { missionKey: string } }>(
    "/v1/daily-rewards/weekly-missions/:missionKey/claim",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("personalMissions");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      const params = weeklyMissionClaimParamsSchema.parse(request.params);
      return {
        reward: await claimWeeklyMission(userId, params.missionKey),
      };
    },
  );
};
