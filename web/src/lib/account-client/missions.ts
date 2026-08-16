import type {
  InternalUserContext,
  MissionClaimResult,
  MissionCheckinWagerResult,
  MissionDefinitionView,
  MissionPanelView,
  UpsertMissionDefinitionInput,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function getMissionPanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: MissionPanelView }>("/v1/me/missions/panel", {
    userContext,
  });
  return response.panel;
}

export async function claimMission(userContext: InternalUserContext, missionId: string) {
  const response = await accountRequest<{ reward: MissionClaimResult }>(
    `/v1/me/missions/${encodeURIComponent(missionId)}/claim`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.reward;
}

export async function placeCheckinWager(userContext: InternalUserContext, missionId: string) {
  const response = await accountRequest<{ wager: MissionCheckinWagerResult }>(
    `/v1/me/missions/${encodeURIComponent(missionId)}/checkin-wager`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.wager;
}

export async function listOperatorMissionDefinitions(userContext: InternalUserContext) {
  const response = await accountRequest<{ missions: MissionDefinitionView[] }>(
    "/v1/internal/missions",
    {
      userContext,
    },
  );
  return response.missions;
}

export async function createOperatorMissionDefinition(
  userContext: InternalUserContext,
  input: UpsertMissionDefinitionInput,
) {
  const response = await accountRequest<{ mission: MissionDefinitionView }>(
    "/v1/internal/missions",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.mission;
}

export async function updateOperatorMissionDefinition(
  userContext: InternalUserContext,
  missionId: string,
  input: UpsertMissionDefinitionInput,
) {
  const response = await accountRequest<{ mission: MissionDefinitionView }>(
    `/v1/internal/missions/${encodeURIComponent(missionId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.mission;
}

export async function archiveOperatorMissionDefinition(
  userContext: InternalUserContext,
  missionId: string,
) {
  const response = await accountRequest<{ mission: MissionDefinitionView }>(
    `/v1/internal/missions/${encodeURIComponent(missionId)}/archive`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.mission;
}

export async function deleteOperatorMissionDefinition(userContext: InternalUserContext, missionId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/missions/${encodeURIComponent(missionId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}
