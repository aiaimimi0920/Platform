import { publicSurfaceKeys, type PublicSurfaceKey, type PublicSurfaceSnapshot } from "@neuro/contracts";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { redis } from "@/db/redis";

import { publicSurfaceVisibility } from "./schema";

const PUBLIC_SURFACE_CACHE_KEY = "neuroloom:public-surface-snapshot";

function buildSnapshot(rows: typeof publicSurfaceVisibility.$inferSelect[]): PublicSurfaceSnapshot {
  const snapshot = {} as PublicSurfaceSnapshot;
  for (const surfaceKey of publicSurfaceKeys) {
    const existing = rows.find((row) => row.surfaceKey === surfaceKey);
    snapshot[surfaceKey] = {
      surfaceKey,
      enabled: existing?.enabled ?? true,
      updatedAt: (existing?.updatedAt ?? new Date()).toISOString(),
    };
  }
  return snapshot;
}

export async function ensurePublicSurfaceSnapshot(): Promise<PublicSurfaceSnapshot> {
  const rows = await db.select().from(publicSurfaceVisibility);
  const existing = new Set(rows.map((row) => row.surfaceKey));

  for (const surfaceKey of publicSurfaceKeys) {
    if (existing.has(surfaceKey)) continue;
    await db.insert(publicSurfaceVisibility).values({
      surfaceKey,
      enabled: true,
      updatedAt: new Date(),
    });
  }

  const refreshed = await db.select().from(publicSurfaceVisibility);
  const snapshot = buildSnapshot(refreshed);
  await redis.set(PUBLIC_SURFACE_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function getPublicSurfaceSnapshot(forceRefresh = false): Promise<PublicSurfaceSnapshot> {
  if (!forceRefresh) {
    const cached = await redis.get(PUBLIC_SURFACE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as PublicSurfaceSnapshot;
    }
  }

  return ensurePublicSurfaceSnapshot();
}

export async function setPublicSurfaceEnabled(
  surfaceKey: PublicSurfaceKey,
  enabled: boolean,
): Promise<PublicSurfaceSnapshot> {
  await db
    .insert(publicSurfaceVisibility)
    .values({
      surfaceKey,
      enabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: publicSurfaceVisibility.surfaceKey,
      set: {
        enabled,
        updatedAt: new Date(),
      },
    });

  return getPublicSurfaceSnapshot(true);
}

export async function updatePublicSurfaceSnapshot(
  entries: Array<{ surfaceKey: PublicSurfaceKey; enabled: boolean }>,
): Promise<PublicSurfaceSnapshot> {
  for (const entry of entries) {
    await db
      .insert(publicSurfaceVisibility)
      .values({
        surfaceKey: entry.surfaceKey,
        enabled: entry.enabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: publicSurfaceVisibility.surfaceKey,
        set: {
          enabled: entry.enabled,
          updatedAt: new Date(),
        },
      });
  }

  return getPublicSurfaceSnapshot(true);
}

export async function getSinglePublicSurface(surfaceKey: PublicSurfaceKey) {
  const [row] = await db.select().from(publicSurfaceVisibility).where(eq(publicSurfaceVisibility.surfaceKey, surfaceKey));
  return row ?? null;
}
