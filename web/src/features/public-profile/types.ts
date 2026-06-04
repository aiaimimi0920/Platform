import type { AgentMarketplaceListingView, PublicUserProfile } from "@neuro/contracts";

export type PublicProfilePageData = {
  profile: PublicUserProfile;
  showcasedAgentListings: AgentMarketplaceListingView[];
};
