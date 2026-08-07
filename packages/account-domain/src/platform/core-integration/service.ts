import { requestInternalText } from "@neuro/backend-foundation/platform/internal-request";

import { env } from "@/env";

type PlatformDailyMissionKey = "taskApply" | "productPurchase";
type PlatformWeeklyMissionKey = "taskApply" | "productPurchase" | "opinionSupport";

export type PlatformProgressionMetrics = {
  taskApplicationCount: number;
  taskCreatedCount: number;
  taskCompletedCount: number;
  itemOwnedCount: number;
  opinionCreatedCount: number;
  opinionParticipationCount: number;
  agentCreatedCount: number;
  agentCapabilityCount: number;
};

export type CorePlatformSummary = {
  agents: {
    totalAgents: number;
    enabledAgents: number;
    externalAgents: number;
    capabilityCount: number;
    activeExecutions: number;
  };
  assets: {
    totalItems: number;
    activeItems: number;
    listedItems: number;
  };
  progressionMetrics: PlatformProgressionMetrics;
  reputationStats: {
    completedTaskCount: number;
    defaultedTaskCount: number;
    cancelledTaskCount: number;
    activeTaskCount: number;
    favorableArbitrationCount: number;
    unfavorableArbitrationCount: number;
  };
};

export type CoreProductSnapshot = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  kind: string;
  currency: string;
  price: number;
  fulfillmentMode: string;
  transferable: boolean;
  active: boolean;
  allowDiscountCodes: boolean;
  limitScope: string;
  durationDays: number | null;
  unitCount: number | null;
  warrantyDays: number | null;
  stockLabel: string;
  createdAt: string;
  updatedAt: string;
};

function resolvePlatformInternalUrl() {
  const raw =
    process.env.PLATFORM_INTERNAL_URL?.trim() ||
    process.env.CORE_INTERNAL_URL?.trim() ||
    "http://127.0.0.1:4000";
  return raw.replace(/\/+$/, "");
}

function canUseCoreReadModel() {
  return env.usesDedicatedDatabase && Boolean(process.env.INTERNAL_API_TOKEN?.trim());
}

async function coreRead<T>(pathname: string): Promise<T | null> {
  if (!canUseCoreReadModel()) {
    return null;
  }

  try {
    const { response, text } = await requestInternalText(
      `${resolvePlatformInternalUrl()}${pathname}`,
      {
        method: "GET",
        headers: {
          "x-internal-api-token": process.env.INTERNAL_API_TOKEN!.trim(),
        },
      },
      {
        timeoutMs: env.coreInternalFetchTimeoutMs,
        timeoutMessage: `Core read model request timed out: ${pathname}`,
      },
    );

    if (!response.ok) {
      console.warn(`[account-domain] core read model request failed: ${pathname} -> ${response.status}`);
      return null;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    console.warn(
      `[account-domain] core read model request failed: ${pathname} -> ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

export async function getCorePlatformSummary(userId: string): Promise<CorePlatformSummary | null> {
  const payload = await coreRead<{ summary: CorePlatformSummary }>(
    `/internal/account/users/${encodeURIComponent(userId)}/platform-summary`,
  );
  return payload?.summary ?? null;
}

export async function getCoreMissionProgress<T extends PlatformDailyMissionKey | PlatformWeeklyMissionKey>(
  args: {
    userId: string;
    scope: "daily" | "weekly";
    from: Date;
    to: Date;
    keys: T[];
  },
): Promise<Record<T, number> | null> {
  if (args.keys.length === 0) {
    return {} as Record<T, number>;
  }

  const search = new URLSearchParams({
    scope: args.scope,
    from: args.from.toISOString(),
    to: args.to.toISOString(),
    keys: args.keys.join(","),
  });
  const payload = await coreRead<{ progress: Record<string, number> }>(
    `/internal/account/users/${encodeURIComponent(args.userId)}/mission-progress?${search.toString()}`,
  );
  if (!payload?.progress) {
    return null;
  }

  return Object.fromEntries(
    args.keys.map((key) => [key, Number(payload.progress[key] ?? 0)]),
  ) as Record<T, number>;
}

export async function getCoreProductSnapshot(productId: string): Promise<CoreProductSnapshot | null> {
  const payload = await coreRead<{ product: CoreProductSnapshot | null }>(
    `/internal/account/products/${encodeURIComponent(productId)}`,
  );
  return payload?.product ?? null;
}

export async function listCoreProductSnapshots(): Promise<CoreProductSnapshot[] | null> {
  const payload = await coreRead<{ products: CoreProductSnapshot[] }>("/internal/account/products");
  return payload?.products ?? null;
}
