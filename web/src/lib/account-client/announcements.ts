import type {
  AccountAnnouncementView,
  InternalUserContext,
  UpsertAccountAnnouncementInput,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function listPublishedAccountAnnouncements() {
  const response = await accountRequest<{ announcements: AccountAnnouncementView[] }>("/v1/announcements");
  return response.announcements;
}

export async function listOperatorAccountAnnouncements(userContext: InternalUserContext) {
  const response = await accountRequest<{ announcements: AccountAnnouncementView[] }>(
    "/v1/internal/announcements",
    {
      userContext,
    },
  );
  return response.announcements;
}

export async function createOperatorAccountAnnouncement(
  userContext: InternalUserContext,
  input: UpsertAccountAnnouncementInput,
) {
  const response = await accountRequest<{ announcement: AccountAnnouncementView }>(
    "/v1/internal/announcements",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.announcement;
}

export async function updateOperatorAccountAnnouncement(
  userContext: InternalUserContext,
  announcementId: string,
  input: UpsertAccountAnnouncementInput,
) {
  const response = await accountRequest<{ announcement: AccountAnnouncementView }>(
    `/v1/internal/announcements/${encodeURIComponent(announcementId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.announcement;
}

export async function deleteOperatorAccountAnnouncement(userContext: InternalUserContext, announcementId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/announcements/${encodeURIComponent(announcementId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}
