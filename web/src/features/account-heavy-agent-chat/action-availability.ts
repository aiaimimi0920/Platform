import type { FeatureSnapshot, PublicSurfaceSnapshot } from "@neuro/contracts";

import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

export type HeavyChatActionAvailability = {
  task: boolean;
  mailbox: boolean;
};

export function resolveChatActionAvailability(
  features: FeatureSnapshot,
  surfaces: PublicSurfaceSnapshot,
  userId?: string | null,
  providerUserId?: string | null,
): HeavyChatActionAvailability {
  return {
    task:
      features.taskHub.enabled
      && isPublicSurfaceVisibleForViewer(surfaces, "tasks", userId, providerUserId),
    mailbox:
      features.mailbox.enabled
      && isPublicSurfaceVisibleForViewer(surfaces, "mailbox", userId, providerUserId),
  };
}
