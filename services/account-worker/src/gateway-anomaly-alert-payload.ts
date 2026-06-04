import type { GatewayAnalysisAnomalyIncidentAlertQueueItemView } from "@neuro/contracts";

export function buildGatewayAnomalyIncidentMailboxBody(item: GatewayAnalysisAnomalyIncidentAlertQueueItemView) {
  const remediationSummary =
    item.remediationActionKeys.length > 0 ? ` 建议动作=${item.remediationActionKeys.join(", ")}。` : "";
  return (
    `AI gateway anomaly 命中 L${item.alertLevel} 告警，project=${item.incident.projectId ?? "global"}，` +
    `code=${item.incident.code}，severity=${item.incident.severity}，followUp=${item.incident.followUpStatus}，` +
    `syncHits=${item.incident.syncHitCount}，policy=${item.policy?.id ?? "none"}。` +
    `${item.incident.summary}${remediationSummary}`
  );
}

export function buildGatewayAnomalyIncidentAlertPayload(item: GatewayAnalysisAnomalyIncidentAlertQueueItemView) {
  const remediationSummary =
    item.remediationActionKeys.length > 0 ? ` 建议动作=${item.remediationActionKeys.join(", ")}。` : "";
  return {
    alertLevel: item.alertLevel,
    severity: item.webhookSeverity,
    title: item.alertLevel >= 3 ? "AI gateway anomaly 需要紧急处理" : "AI gateway anomaly 进入观察态",
    detail:
      `project=${item.incident.projectId ?? "global"} / code=${item.incident.code} / severity=${item.incident.severity} / ` +
      `followUp=${item.incident.followUpStatus} / syncHits=${item.incident.syncHitCount}。` +
      `${item.incident.summary}${remediationSummary}`,
    actionLabel: "查看 gateway anomalies",
    reasonCategory: item.incident.code,
    followUpStatus: item.incident.followUpStatus,
    policyId: item.policy?.id ?? null,
    count: item.incident.syncHitCount,
    candidateCount: item.remediationActionKeys.length,
    maxAlertLevel: item.alertLevel,
    projectId: item.incident.projectId,
    incidentId: item.incident.id,
    ownerUserId: item.incident.ownerUserId,
    routePolicyId: item.routePolicy?.id ?? item.incident.routePolicyId ?? null,
  } satisfies Record<string, unknown>;
}
