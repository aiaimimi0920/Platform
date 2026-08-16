import {
  type AccountAnnouncementView,
  type UpsertAccountAnnouncementInput,
  type InternalUserContext,
} from "@neuro/contracts";

import { coreRequest } from "./request";

export async function listPublishedAccountAnnouncements(userContext: InternalUserContext | null) {
  const response = await coreRequest<{ announcements: AccountAnnouncementView[] }>("/v1/announcements", {
    userContext,
  });
  return response.announcements;
}

export async function listOperatorAccountAnnouncements(userContext: InternalUserContext) {
  const response = await coreRequest<{ announcements: AccountAnnouncementView[] }>("/v1/internal/announcements", {
    userContext,
  });
  return response.announcements;
}

export async function createOperatorAccountAnnouncement(
  userContext: InternalUserContext,
  input: UpsertAccountAnnouncementInput,
) {
  const response = await coreRequest<{ announcement: AccountAnnouncementView }>("/v1/internal/announcements", {
    method: "POST",
    userContext,
    body: input,
  });
  return response.announcement;
}

export async function updateOperatorAccountAnnouncement(
  userContext: InternalUserContext,
  announcementId: string,
  input: UpsertAccountAnnouncementInput,
) {
  const response = await coreRequest<{ announcement: AccountAnnouncementView }>(
    `/v1/internal/announcements/${encodeURIComponent(announcementId)}`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.announcement;
}

export async function deleteOperatorAccountAnnouncement(userContext: InternalUserContext, announcementId: string) {
  await coreRequest<{ ok: true }>(
    `/v1/internal/announcements/${encodeURIComponent(announcementId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}
