import type {
  GatewayAnalysisExportInventorySummaryView,
  GatewayAnalysisExportStatus,
  GatewayPersistedAnalysisExportView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

function accumulateBucket(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() ?? "";
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toBuckets(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count } satisfies GatewaySummaryBucket))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function hasPinnedTag(tags: string[]) {
  return tags.some((tag) => tag.trim().toLowerCase() === "pinned");
}

export function buildGatewayAnalysisExportInventorySummary(args: {
  exports: GatewayPersistedAnalysisExportView[];
  nowIso?: string;
}): GatewayAnalysisExportInventorySummaryView {
  const nowTime = new Date(args.nowIso ?? new Date().toISOString()).getTime();
  const expiringThreshold = nowTime + 24 * 60 * 60 * 1_000;
  const byStatus = new Map<string, number>();
  const byTextMode = new Map<string, number>();
  const byTag = new Map<string, number>();
  const byProject = new Map<string, number>();

  let activeExports = 0;
  let deletedExports = 0;
  let pinnedExports = 0;
  let expiringWithin24Hours = 0;
  let expiredActiveExports = 0;
  let totalSampleCount = 0;
  let totalRequestArtifactCount = 0;
  let totalResponseArtifactCount = 0;

  for (const item of args.exports) {
    totalSampleCount += item.sampleCount;
    totalRequestArtifactCount += item.requestArtifactCount;
    totalResponseArtifactCount += item.responseArtifactCount;
    accumulateBucket(byStatus, item.status);
    accumulateBucket(byTextMode, item.filters.textMode);
    accumulateBucket(byProject, item.filters.projectId);
    for (const tag of item.tags) {
      accumulateBucket(byTag, tag);
    }

    if ((item.status as GatewayAnalysisExportStatus) === "active") {
      activeExports += 1;
    }
    if ((item.status as GatewayAnalysisExportStatus) === "deleted") {
      deletedExports += 1;
    }
    if (hasPinnedTag(item.tags)) {
      pinnedExports += 1;
    }

    if (item.status === "active" && item.retentionExpiresAt) {
      const expiresAtTime = new Date(item.retentionExpiresAt).getTime();
      if (!Number.isNaN(expiresAtTime)) {
        if (expiresAtTime <= nowTime) {
          expiredActiveExports += 1;
        } else if (expiresAtTime <= expiringThreshold) {
          expiringWithin24Hours += 1;
        }
      }
    }
  }

  return {
    totalExports: args.exports.length,
    activeExports,
    deletedExports,
    pinnedExports,
    expiringWithin24Hours,
    expiredActiveExports,
    totalSampleCount,
    totalRequestArtifactCount,
    totalResponseArtifactCount,
    byStatus: toBuckets(byStatus),
    byTextMode: toBuckets(byTextMode),
    byTag: toBuckets(byTag),
    byProject: toBuckets(byProject),
  };
}
