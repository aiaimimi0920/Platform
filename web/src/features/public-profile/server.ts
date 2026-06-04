import { getPublicUserProfile } from "@/lib/account-client";
import { listPublicAgentMarketplaceListingsByAgentIds } from "@/lib/core-client";

import type { PublicProfilePageData } from "./types";

export async function fetchPublicProfile(username: string): Promise<PublicProfilePageData | null> {
  try {
    const profile = await getPublicUserProfile(username);
    if (!profile) {
      return null;
    }

    const showcasedAgentListings =
      profile.showcasedAgentIds && profile.showcasedAgentIds.length > 0
        ? await listPublicAgentMarketplaceListingsByAgentIds(profile.showcasedAgentIds, 2).catch(() => [])
        : [];

    return {
      profile,
      showcasedAgentListings,
    };
  } catch {
    return null;
  }
}
