import type {
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView,
  GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView,
} from "@neuro/contracts";

function toSeverity(alertLevel: number): "info" | "warning" | "danger" {
  if (alertLevel >= 3) {
    return "danger";
  }
  if (alertLevel >= 2) {
    return "warning";
  }
  return "info";
}

function toAlertLevel(anomaly: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView) {
  return anomaly.severity === "critical" ? 3 : 2;
}

export function buildGatewayRemediationEffectivenessAnomalyMailboxBody(args: {
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView;
  anomaly: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView;
}) {
  const routePolicyId = args.snapshot.report.latestSnapshot?.filters.routePolicyId ?? args.snapshot.filters.routePolicyId;
  return (
    `AI gateway remediation effectiveness anomaly 命中告警，snapshot=${args.snapshot.snapshotId}，` +
    `profile=${args.snapshot.report.profileKey}，routePolicy=${routePolicyId ?? "global"}，` +
    `code=${args.anomaly.code}，severity=${args.anomaly.severity}。` +
    `${args.anomaly.message}`
  );
}

export function buildGatewayRemediationEffectivenessAnomalyAlertPayload(args: {
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView;
  anomaly: GatewayAnalysisAnomalyRemediationEffectivenessAnomalyView;
}) {
  const latestSnapshot = args.snapshot.report.latestSnapshot;
  const routePolicyId = latestSnapshot?.filters.routePolicyId ?? args.snapshot.filters.routePolicyId;
  const alertLevel = toAlertLevel(args.anomaly);
  const criticalCount = args.snapshot.report.bySeverity.find((item) => item.key === "critical")?.count ?? 0;

  return {
    alertLevel,
    severity: toSeverity(alertLevel),
    title:
      alertLevel >= 3
        ? "AI gateway remediation effectiveness anomaly 需要紧急处理"
        : "AI gateway remediation effectiveness anomaly 进入观察态",
    detail:
      `snapshot=${args.snapshot.snapshotId} / profile=${args.snapshot.report.profileKey} / ` +
      `routePolicy=${routePolicyId ?? "global"} / code=${args.anomaly.code} / severity=${args.anomaly.severity}。` +
      `${args.anomaly.message}`,
    actionLabel: "查看 remediation effectiveness anomalies",
    reasonCategory: args.anomaly.code,
    reasonDisposition: args.snapshot.report.profileKey,
    profileKey: args.snapshot.report.profileKey,
    count: args.snapshot.report.anomalies.length,
    candidateCount: criticalCount,
    maxAlertLevel: alertLevel,
    routePolicyId,
    snapshotId: args.snapshot.snapshotId,
    criticalCount,
  } satisfies Record<string, unknown>;
}
