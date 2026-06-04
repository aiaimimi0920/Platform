import { persistGatewayRateLimitHotspotSnapshotForOperator } from "@neuro/ai-gateway-domain";

export async function dispatchGatewayRateLimitHotspotSnapshot(args: {
  actorUserId: string;
  limit: number;
  lookbackHours: number;
}) {
  const snapshot = await persistGatewayRateLimitHotspotSnapshotForOperator(args.actorUserId, null, {
    limit: args.limit,
    lookbackHours: args.lookbackHours,
    label: `auto-${new Date().toISOString()}`,
  });

  return {
    createdAt: snapshot.createdAt,
    snapshotId: snapshot.snapshotId,
    rateLimitedRequestCount: snapshot.summary.totalRateLimitedRequests,
  };
}
