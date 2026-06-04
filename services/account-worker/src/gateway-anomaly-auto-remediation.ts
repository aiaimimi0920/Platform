import { sweepGatewayAnalysisAnomalyRemediationsForOperator } from "@neuro/ai-gateway-domain";

export async function dispatchGatewayAnomalyAutoRemediation(args: {
  actorUserId: string;
  limit: number;
}) {
  const sweep = await sweepGatewayAnalysisAnomalyRemediationsForOperator(args.actorUserId, null, {
    limit: args.limit,
  });

  return {
    startedAt: sweep.startedAt,
    completedAt: sweep.completedAt,
    attemptedCount: sweep.attemptedCount,
    dryRunCount: sweep.dryRunCount,
    appliedCount: sweep.appliedCount,
    errorCount: sweep.errorCount,
    skippedCount: sweep.skippedCount,
  };
}
