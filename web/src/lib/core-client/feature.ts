import {
  featureModuleKeys,
  type FeatureSnapshot,
  type PublicSurfaceKey,
  type PublicSurfaceSnapshot,
} from "@neuro/contracts";

import { coreRequest } from "./request";

export const FEATURE_SNAPSHOT_UNAVAILABLE_NOTE = "Feature snapshot unavailable; module state unknown.";

function unavailableFeatureSnapshot(): FeatureSnapshot {
  return Object.fromEntries(
    featureModuleKeys.map((moduleKey) => [
      moduleKey,
      {
        moduleKey,
        enabled: false,
        rolloutNote: FEATURE_SNAPSHOT_UNAVAILABLE_NOTE,
        updatedAt: new Date().toISOString(),
      },
    ]),
  ) as FeatureSnapshot;
}

export function isFeatureSnapshotUnavailable(features: FeatureSnapshot): boolean {
  return Object.values(features).every(
    (feature) => feature.enabled === false && feature.rolloutNote === FEATURE_SNAPSHOT_UNAVAILABLE_NOTE,
  );
}

export async function getFeatureSnapshot(): Promise<FeatureSnapshot> {
  try {
    const response = await coreRequest<{ modules: FeatureSnapshot }>("/internal/features");
    return response.modules;
  } catch {
    return unavailableFeatureSnapshot();
  }
}

export async function getPublicSurfaceSnapshotStrict(): Promise<PublicSurfaceSnapshot> {
  const response = await coreRequest<{ surfaces: PublicSurfaceSnapshot }>("/internal/public-surfaces");
  return response.surfaces;
}

export async function updatePublicSurfaceSnapshot(
  surfaces: Array<{ surfaceKey: PublicSurfaceKey; enabled: boolean }>,
): Promise<PublicSurfaceSnapshot> {
  const response = await coreRequest<{ surfaces: PublicSurfaceSnapshot }>("/internal/public-surfaces", {
    method: "POST",
    body: { surfaces },
  });
  return response.surfaces;
}
