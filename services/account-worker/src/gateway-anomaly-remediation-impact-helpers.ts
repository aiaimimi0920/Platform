import type { GatewayAnalysisAnomalyIncidentRemediationRunView } from "@neuro/contracts";

function hasCapturedImpactForWindow(
  run: GatewayAnalysisAnomalyIncidentRemediationRunView,
  windowMinutes: number,
) {
  const capture =
    run.result &&
    typeof run.result === "object" &&
    (run.result as Record<string, unknown>).impactCapture &&
    typeof (run.result as Record<string, unknown>).impactCapture === "object"
      ? ((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>)
      : null;
  return Boolean(
    capture &&
      capture.windowMinutes === windowMinutes &&
      capture.impact &&
      typeof capture.impact === "object",
  );
}

export function selectGatewayAnomalyRemediationImpactCandidates(args: {
  runs: GatewayAnalysisAnomalyIncidentRemediationRunView[];
  referenceTime: Date;
  windowMinutes: number;
  limit: number;
}) {
  const thresholdTime = args.referenceTime.getTime() - args.windowMinutes * 60_000;
  return args.runs
    .filter((run) => run.status === "applied")
    .filter((run) => {
      const completedAt = run.completedAt ? new Date(run.completedAt) : null;
      return completedAt != null && !Number.isNaN(completedAt.getTime()) && completedAt.getTime() <= thresholdTime;
    })
    .filter((run) => !hasCapturedImpactForWindow(run, args.windowMinutes))
    .sort((left, right) => {
      const leftTime = left.completedAt ? new Date(left.completedAt).getTime() : 0;
      const rightTime = right.completedAt ? new Date(right.completedAt).getTime() : 0;
      return leftTime - rightTime;
    })
    .slice(0, Math.max(1, args.limit));
}
