import type { GatewayRoutePolicyConfig } from "@neuro/contracts";

function normalizeModelIdList(values: string[] | null | undefined) {
  const seen = new Set<string>();
  const normalized = (values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  return normalized.length > 0 ? normalized : null;
}

function normalizeCandidateModelIds(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => value?.trim().toLowerCase() ?? "")
    .filter((value) => value.length > 0)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

export function routePolicyHasModelRestrictions(
  routePolicy: GatewayRoutePolicyConfig | null | undefined,
) {
  return Boolean(
    normalizeModelIdList(routePolicy?.allowedModelIds ?? null) ||
      normalizeModelIdList(routePolicy?.blockedModelIds ?? null),
  );
}

export function routePolicyAllowsModels(
  routePolicy: GatewayRoutePolicyConfig | null | undefined,
  candidateModelIds: Array<string | null | undefined>,
) {
  const normalizedCandidateIds = normalizeCandidateModelIds(candidateModelIds);
  const blockedModelIds = normalizeModelIdList(routePolicy?.blockedModelIds ?? null);
  if (blockedModelIds && normalizedCandidateIds.some((value) => blockedModelIds.includes(value))) {
    return false;
  }

  const allowedModelIds = normalizeModelIdList(routePolicy?.allowedModelIds ?? null);
  if (!allowedModelIds) {
    return true;
  }
  if (normalizedCandidateIds.length === 0) {
    return false;
  }
  return normalizedCandidateIds.some((value) => allowedModelIds.includes(value));
}
