import type { RauthyUpsertInput, UserSummary } from "@neuro/contracts";

import { parseRauthyUpsertInput } from "@/modules/identity/rauthy-model";
import { persistRauthyIdentity } from "@/modules/identity/rauthy-repository";
import { getUserSummary } from "@/modules/identity/service";

// Only the authenticated internal web backend may supply verified OIDC claims.
// This service never accepts a browser JWT, email match, or caller-chosen user ID.
export async function upsertRauthyUser(input: RauthyUpsertInput): Promise<UserSummary> {
  const profile = parseRauthyUpsertInput(input);
  const userId = await persistRauthyIdentity(profile);
  const summary = await getUserSummary(userId);
  if (!summary) throw new Error("Persisted OIDC user could not be loaded");
  return summary;
}
