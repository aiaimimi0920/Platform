import { persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator } from "@neuro/ai-gateway-domain";

export async function dispatchGatewayAnomalyRemediationEffectivenessAnomalySnapshot(args: {
  actorUserId: string;
  limit: number;
  lookbackHours: number;
  profileKey: "conservative" | "balanced" | "aggressive";
}) {
  const snapshot = await persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
    args.actorUserId,
    null,
    {
      limit: args.limit,
      lookbackHours: args.lookbackHours,
      profileKey: args.profileKey,
      label: `auto-${new Date().toISOString()}`,
    },
  );

  const criticalCount =
    snapshot.report.bySeverity.find((item: { key: string; count: number }) => item.key === "critical")?.count ?? 0;

  return {
    createdAt: snapshot.createdAt,
    snapshotId: snapshot.snapshotId,
    snapshot,
    anomalyCount: snapshot.report.anomalies.length,
    criticalCount,
  };
}
