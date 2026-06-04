import type { InternalUserContext } from "@neuro/contracts";

import { auth } from "@/auth";
import { getDevAuthBypassProfile, isDevAuthBypassEnabled } from "@/lib/dev-auth";

export async function requirePlatformUserContext(): Promise<InternalUserContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  return {
    userId: session.user.id,
    providerUserId: session.user.providerUserId || undefined,
    username: session.user.username || session.user.name || undefined,
  };
}

export async function requirePlatformOperatorUserContext(): Promise<InternalUserContext> {
  const context = await requirePlatformUserContext();
  if (!isPlatformOperatorUserId(context.userId, context.providerUserId)) {
    throw new Error("Platform operator required");
  }
  return context;
}

export async function getOptionalPlatformUserContext(): Promise<InternalUserContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    providerUserId: session.user.providerUserId || undefined,
    username: session.user.username || session.user.name || undefined,
  };
}

export function isPlatformOperatorUserId(
  userId: string | null | undefined,
  providerUserId?: string | null | undefined,
): boolean {
  const operatorIds = (process.env.PLATFORM_OPERATOR_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    (userId ? operatorIds.includes(userId) : false) ||
    (providerUserId ? operatorIds.includes(providerUserId) : false) ||
    isDevAuthBypassProviderUserId(providerUserId)
  );
}

export function isDevAuthBypassProviderUserId(providerUserId?: string | null | undefined): boolean {
  if (!providerUserId || !isDevAuthBypassEnabled()) {
    return false;
  }

  return providerUserId.trim() === getDevAuthBypassProfile().id;
}
