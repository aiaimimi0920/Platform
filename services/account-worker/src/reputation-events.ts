export function normalizeReputationUpdatedUserIds(payload: Record<string, unknown>): string[] {
  const rawUserIds = Array.isArray(payload.userIds)
    ? payload.userIds
    : typeof payload.userId === "string"
      ? [payload.userId]
      : [];

  const normalized = rawUserIds
    .filter((userId): userId is string => typeof userId === "string")
    .map((userId) => userId.trim())
    .filter((userId) => userId.length > 0);

  return Array.from(new Set(normalized));
}
