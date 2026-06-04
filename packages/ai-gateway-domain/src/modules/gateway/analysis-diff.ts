import type {
  GatewayAnalysisExportBucketDeltaView,
  GatewayAnalysisExportDiffView,
  GatewayAnalysisExportMetricDeltaView,
  GatewayAnalysisExportRowView,
  GatewayPersistedAnalysisExportView,
} from "@neuro/contracts";

function buildMetricDelta(leftValue: number | null, rightValue: number | null): GatewayAnalysisExportMetricDeltaView {
  return {
    leftValue,
    rightValue,
    deltaValue:
      typeof leftValue === "number" && typeof rightValue === "number" ? rightValue - leftValue : null,
  };
}

function buildBucketDelta(
  leftRows: GatewayAnalysisExportRowView[],
  rightRows: GatewayAnalysisExportRowView[],
  selector: (row: GatewayAnalysisExportRowView) => string | null | undefined,
): GatewayAnalysisExportBucketDeltaView[] {
  const leftCounts = new Map<string, number>();
  const rightCounts = new Map<string, number>();

  for (const row of leftRows) {
    const key = selector(row)?.trim() ?? "";
    if (!key) {
      continue;
    }
    leftCounts.set(key, (leftCounts.get(key) ?? 0) + 1);
  }

  for (const row of rightRows) {
    const key = selector(row)?.trim() ?? "";
    if (!key) {
      continue;
    }
    rightCounts.set(key, (rightCounts.get(key) ?? 0) + 1);
  }

  const keys = Array.from(new Set([...leftCounts.keys(), ...rightCounts.keys()]));
  return keys
    .map((key) => {
      const leftCount = leftCounts.get(key) ?? 0;
      const rightCount = rightCounts.get(key) ?? 0;
      return {
        key,
        leftCount,
        rightCount,
        deltaCount: rightCount - leftCount,
      } satisfies GatewayAnalysisExportBucketDeltaView;
    })
    .sort((left, right) => {
      const deltaMagnitude = Math.abs(right.deltaCount) - Math.abs(left.deltaCount);
      if (deltaMagnitude !== 0) {
        return deltaMagnitude;
      }
      return left.key.localeCompare(right.key);
    });
}

function sumMetric(rows: GatewayAnalysisExportRowView[], selector: (row: GatewayAnalysisExportRowView) => number | null) {
  return rows.reduce((sum, row) => sum + (selector(row) ?? 0), 0);
}

export function buildGatewayAnalysisExportDiff(args: {
  leftExport: GatewayPersistedAnalysisExportView;
  rightExport: GatewayPersistedAnalysisExportView;
  leftRows: GatewayAnalysisExportRowView[];
  rightRows: GatewayAnalysisExportRowView[];
}): GatewayAnalysisExportDiffView {
  const leftRequestIds = new Set(args.leftRows.map((row) => row.requestAuditId));
  const rightRequestIds = new Set(args.rightRows.map((row) => row.requestAuditId));
  let overlapRequestCount = 0;
  for (const requestAuditId of leftRequestIds) {
    if (rightRequestIds.has(requestAuditId)) {
      overlapRequestCount += 1;
    }
  }

  return {
    leftExport: args.leftExport,
    rightExport: args.rightExport,
    overlapRequestCount,
    leftOnlyRequestCount: Math.max(0, leftRequestIds.size - overlapRequestCount),
    rightOnlyRequestCount: Math.max(0, rightRequestIds.size - overlapRequestCount),
    sampleCount: buildMetricDelta(args.leftRows.length, args.rightRows.length),
    requestArtifactCount: buildMetricDelta(
      args.leftRows.filter((row) => row.requestArtifactAvailable).length,
      args.rightRows.filter((row) => row.requestArtifactAvailable).length,
    ),
    responseArtifactCount: buildMetricDelta(
      args.leftRows.filter((row) => row.responseArtifactAvailable).length,
      args.rightRows.filter((row) => row.responseArtifactAvailable).length,
    ),
    promptTokens: buildMetricDelta(
      sumMetric(args.leftRows, (row) => row.promptTokens),
      sumMetric(args.rightRows, (row) => row.promptTokens),
    ),
    completionTokens: buildMetricDelta(
      sumMetric(args.leftRows, (row) => row.completionTokens),
      sumMetric(args.rightRows, (row) => row.completionTokens),
    ),
    totalTokens: buildMetricDelta(
      sumMetric(args.leftRows, (row) => row.totalTokens),
      sumMetric(args.rightRows, (row) => row.totalTokens),
    ),
    byStatus: buildBucketDelta(args.leftRows, args.rightRows, (row) => row.status),
    byProtocolFamily: buildBucketDelta(args.leftRows, args.rightRows, (row) => row.protocolFamily),
    byEndpointKind: buildBucketDelta(args.leftRows, args.rightRows, (row) => row.endpointKind),
    byResolvedModel: buildBucketDelta(args.leftRows, args.rightRows, (row) => row.resolvedModel),
    byProviderAccount: buildBucketDelta(args.leftRows, args.rightRows, (row) => row.providerAccountId),
  };
}
