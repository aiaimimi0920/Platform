import type { AccountAnnouncement } from "@/lib/account-announcements";

export function sortAnnouncements(items: AccountAnnouncement[]) {
  return [...items].sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
}

export function isAnnouncementNewer(latestPublishedAt: string | null, lastSeenPublishedAt: string | null) {
  if (!latestPublishedAt) {
    return false;
  }

  if (!lastSeenPublishedAt) {
    return true;
  }

  return Date.parse(latestPublishedAt) > Date.parse(lastSeenPublishedAt);
}
