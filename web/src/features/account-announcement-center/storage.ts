import type { AccountAnnouncement } from "@/lib/account-announcements";

import { LEGACY_STORAGE_KEY_PREFIX, STORAGE_KEY_PREFIX } from "./constants";

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function getLegacyStorageKey(userId: string) {
  return `${LEGACY_STORAGE_KEY_PREFIX}:${userId}`;
}

function normalizeSeenMarker(value: string | null, announcements: AccountAnnouncement[]) {
  if (!value) {
    return null;
  }

  if (!Number.isNaN(Date.parse(value))) {
    return value;
  }

  const matchedAnnouncement = announcements.find((announcement) => announcement.id === value);
  return matchedAnnouncement?.publishedAt ?? null;
}

export function readLastSeenAt(userId: string, announcements: AccountAnnouncement[]) {
  try {
    const currentValue = window.localStorage.getItem(getStorageKey(userId));
    if (currentValue) {
      return normalizeSeenMarker(currentValue, announcements);
    }

    const legacyValue = window.localStorage.getItem(getLegacyStorageKey(userId));
    return normalizeSeenMarker(legacyValue, announcements);
  } catch {
    return null;
  }
}

export function writeLastSeenAt(userId: string, publishedAt: string) {
  try {
    window.localStorage.setItem(getStorageKey(userId), publishedAt);
    window.localStorage.removeItem(getLegacyStorageKey(userId));
  } catch {
    // Ignore storage failures and keep the session usable.
  }
}
