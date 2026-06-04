import type { MailboxFolderKey } from "@neuro/contracts";
import { UnauthorizedError } from "@/platform/errors";

export function now() {
  return new Date();
}

export function normalizeMailboxText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeMailboxFolder(value: MailboxFolderKey | null | undefined): MailboxFolderKey {
  return value === "stash" ? "stash" : "inbox";
}

function parsePlatformOperatorIds() {
  return new Set(
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

export function getPlatformOperatorUserIdSet() {
  return parsePlatformOperatorIds();
}

export function assertPlatformOperator(userId: string) {
  if (!getPlatformOperatorUserIdSet().has(userId)) {
    throw new UnauthorizedError("Only platform operators can manage mailbox archive alert subscriptions");
  }
}
