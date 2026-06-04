import type {
  GatewayRateLimitHotspotAnomalySnapshotView,
  GatewayRateLimitHotspotAnomalyView,
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

function toAlertLevel(anomaly: GatewayRateLimitHotspotAnomalyView) {
  return anomaly.severity === "critical" ? 3 : 2;
}

export function buildGatewayRateLimitHotspotAnomalyMailboxBody(args: {
  snapshot: GatewayRateLimitHotspotAnomalySnapshotView;
  anomaly: GatewayRateLimitHotspotAnomalyView;
}) {
  return (
    `AI gateway rate-limit hotspot anomaly 命中告警，snapshot=${args.snapshot.snapshotId}，` +
    `profile=${args.snapshot.report.profileKey}，project=${args.snapshot.filters.projectId ?? "global"}，` +
    `routePolicy=${args.snapshot.filters.routePolicyId ?? "global"}，` +
    `code=${args.anomaly.code}，severity=${args.anomaly.severity}。` +
    `${args.anomaly.message}`
  );
}

export function buildGatewayRateLimitHotspotAnomalyAlertPayload(args: {
  snapshot: GatewayRateLimitHotspotAnomalySnapshotView;
  anomaly: GatewayRateLimitHotspotAnomalyView;
}) {
  const alertLevel = toAlertLevel(args.anomaly);
  const criticalCount = args.snapshot.report.bySeverity.find((item) => item.key === "critical")?.count ?? 0;

  return {
    alertLevel,
    severity: toSeverity(alertLevel),
    title:
      alertLevel >= 3
        ? "AI gateway rate-limit hotspot anomaly 需要紧急处理"
        : "AI gateway rate-limit hotspot anomaly 进入观察态",
    detail:
      `snapshot=${args.snapshot.snapshotId} / profile=${args.snapshot.report.profileKey} / ` +
      `project=${args.snapshot.filters.projectId ?? "global"} / ` +
      `routePolicy=${args.snapshot.filters.routePolicyId ?? "global"} / ` +
      `code=${args.anomaly.code} / severity=${args.anomaly.severity}。` +
      `${args.anomaly.message}`,
    actionLabel: "查看 rate-limit hotspot anomalies",
    reasonCategory: args.anomaly.code,
    reasonDisposition: args.snapshot.report.profileKey,
    profileKey: args.snapshot.report.profileKey,
    count: args.snapshot.report.anomalies.length,
    candidateCount: criticalCount,
    maxAlertLevel: alertLevel,
    projectId: args.snapshot.filters.projectId,
    routePolicyId: args.snapshot.filters.routePolicyId,
    snapshotId: args.snapshot.snapshotId,
    criticalCount,
  } satisfies Record<string, unknown>;
}
