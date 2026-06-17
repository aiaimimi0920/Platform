import { getDevAuthBypassProfile, isDevAuthBypassEnabled } from "./dev-auth";

type AccountLoginSourceLabelInput = {
  accountProvider?: string | null;
  sessionProviderUserId?: string | null;
};

export function resolveAccountLoginSourceLabel({
  accountProvider,
  sessionProviderUserId,
}: AccountLoginSourceLabelInput): string {
  if (
    sessionProviderUserId?.trim() &&
    isDevAuthBypassEnabled() &&
    sessionProviderUserId.trim() === getDevAuthBypassProfile().id
  ) {
    return "local-dev";
  }

  const normalizedProvider = accountProvider?.trim();
  return normalizedProvider || "unknown";
}
