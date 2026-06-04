import { featureModuleKeys, type FeatureModuleKey, type FeatureSnapshot } from "@neuro/contracts";

import { pgPool } from "@/db";
import { redis } from "@/redis";

const FEATURE_CACHE_KEY = "neuroloom:feature-snapshot";

export async function getFeatureSnapshot(): Promise<FeatureSnapshot> {
  const cached = await redis.get(FEATURE_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached) as FeatureSnapshot;
  }

  const result = await pgPool.query(
    "select module_key, enabled, rollout_note, updated_at from feature_modules where module_key = any($1::text[])",
    [featureModuleKeys],
  );

  const snapshot = {} as FeatureSnapshot;
  for (const moduleKey of featureModuleKeys) {
    const row = result.rows.find((entry: { module_key: string; enabled: boolean; rollout_note: string | null; updated_at: string | Date }) => entry.module_key === moduleKey);
    snapshot[moduleKey] = {
      moduleKey,
      enabled: row ? Boolean(row.enabled) : true,
      rolloutNote: row ? (row.rollout_note as string | null) : null,
      updatedAt: row ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  await redis.set(FEATURE_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function isModuleEnabled(moduleKey: FeatureModuleKey): Promise<boolean> {
  const snapshot = await getFeatureSnapshot();
  return snapshot[moduleKey]?.enabled ?? true;
}
