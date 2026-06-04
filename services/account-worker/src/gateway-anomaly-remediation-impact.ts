import {
  captureGatewayAnalysisAnomalyRemediationRunImpactForOperator,
  listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator,
} from "@neuro/ai-gateway-domain";
import { selectGatewayAnomalyRemediationImpactCandidates } from "@/gateway-anomaly-remediation-impact-helpers";

export async function dispatchGatewayAnomalyRemediationImpactCapture(args: {
  actorUserId: string;
  limit: number;
  windowMinutes: number;
  lookbackHours: number;
}) {
  const referenceTime = new Date();
  const createdFrom = new Date(referenceTime.getTime() - args.lookbackHours * 60 * 60 * 1000).toISOString();
  const runs = await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(args.actorUserId, null, {
    status: "applied",
    createdFrom,
    limit: Math.max(args.limit * 5, args.limit),
  });

  const candidates = selectGatewayAnomalyRemediationImpactCandidates({
    runs,
    referenceTime,
    windowMinutes: args.windowMinutes,
    limit: args.limit,
  });

  let capturedCount = 0;
  let errorCount = 0;
  const items: Array<{ runId: string; status: "captured" | "error"; error: string | null }> = [];

  for (const run of candidates) {
    try {
      await captureGatewayAnalysisAnomalyRemediationRunImpactForOperator(args.actorUserId, null, run.id, {
        windowMinutes: args.windowMinutes,
      });
      capturedCount += 1;
      items.push({
        runId: run.id,
        status: "captured",
        error: null,
      });
    } catch (error) {
      errorCount += 1;
      items.push({
        runId: run.id,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    startedAt: referenceTime.toISOString(),
    completedAt: new Date().toISOString(),
    attemptedCount: candidates.length,
    capturedCount,
    errorCount,
    skippedCount: Math.max(0, runs.length - candidates.length),
    items,
  };
}
