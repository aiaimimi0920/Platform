import { persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator } from "@neuro/ai-gateway-domain";

export async function dispatchGatewayAnomalyRemediationEffectivenessSnapshot(args: {
  actorUserId: string;
  limit: number;
  windowMinutes: number;
  lookbackHours: number;
}) {
  const snapshot = await persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
    args.actorUserId,
    null,
    {
      status: "applied",
      limit: args.limit,
      lookbackHours: args.lookbackHours,
      windowMinutes: args.windowMinutes,
      label: `auto-${new Date().toISOString()}`,
    },
  );

  return {
    createdAt: snapshot.createdAt,
    snapshotId: snapshot.snapshotId,
    runCount: snapshot.summary.totalRuns,
    impactedRunCount: snapshot.summary.impactedRuns,
    unavailableRunCount: snapshot.summary.unavailableRuns,
  };
}
