import { featureModuleKeys, type FeatureModuleKey, type FeatureSnapshot } from "@neuro/contracts";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { env } from "@/env";
import { ModuleDisabledError } from "@/platform/errors";
import { featureModules } from "@/platform/feature-modules/schema";

const FEATURE_CACHE_KEY = "neuroloom:feature-snapshot";

function buildSnapshot(rows: typeof featureModules.$inferSelect[]): FeatureSnapshot {
  const snapshot = {} as FeatureSnapshot;
  for (const moduleKey of featureModuleKeys) {
    const existing = rows.find((row) => row.moduleKey === moduleKey);
    const fallback = env.featureDefaults[moduleKey];
    snapshot[moduleKey] = {
      moduleKey,
      enabled: existing?.enabled ?? fallback.enabled,
      rolloutNote: existing?.rolloutNote ?? fallback.rolloutNote,
      updatedAt: (existing?.updatedAt ?? new Date()).toISOString(),
    };
  }
  return snapshot;
}

export async function ensureFeatureModules(): Promise<FeatureSnapshot> {
  const rows = await db.select().from(featureModules);
  const existing = new Set(rows.map((row) => row.moduleKey));

  for (const moduleKey of featureModuleKeys) {
    if (existing.has(moduleKey)) continue;
    const fallback = env.featureDefaults[moduleKey];
    await db.insert(featureModules).values({
      moduleKey,
      enabled: fallback.enabled,
      rolloutNote: fallback.rolloutNote,
      updatedAt: new Date(),
    });
  }

  const refreshed = await db.select().from(featureModules);
  const snapshot = buildSnapshot(refreshed);
  await redis.set(FEATURE_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function getFeatureSnapshot(forceRefresh = false): Promise<FeatureSnapshot> {
  if (!forceRefresh) {
    const cached = await redis.get(FEATURE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as FeatureSnapshot;
    }
  }

  return ensureFeatureModules();
}

export async function requireModuleEnabled(moduleKey: FeatureModuleKey): Promise<void> {
  const snapshot = await getFeatureSnapshot();
  if (!snapshot[moduleKey].enabled) {
    throw new ModuleDisabledError(moduleKey, snapshot[moduleKey].rolloutNote || `Module ${moduleKey} is disabled`);
  }
}

export async function setFeatureModuleEnabled(
  moduleKey: FeatureModuleKey,
  enabled: boolean,
  rolloutNote: string | null,
): Promise<FeatureSnapshot> {
  await db
    .insert(featureModules)
    .values({ moduleKey, enabled, rolloutNote, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: featureModules.moduleKey,
      set: { enabled, rolloutNote, updatedAt: new Date() },
    });

  return getFeatureSnapshot(true);
}

export async function getSingleFeatureModule(moduleKey: FeatureModuleKey) {
  const [row] = await db.select().from(featureModules).where(eq(featureModules.moduleKey, moduleKey));
  return row ?? null;
}
