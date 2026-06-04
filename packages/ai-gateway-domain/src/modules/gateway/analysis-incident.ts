import type {
  GatewayAnalysisAnomalyIncidentSummaryView,
  GatewayAnalysisAnomalyIncidentView,
  GatewaySummaryBucket,
} from "@neuro/contracts";

function pushBucket(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key?.trim() ?? "";
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toBuckets(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count } satisfies GatewaySummaryBucket))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function buildGatewayAnalysisAnomalyIncidentFingerprint(args: {
  policyId?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  tag?: string | null;
  textMode?: string | null;
  code: string;
}) {
  if (args.policyId?.trim()) {
    return `policy:${args.policyId.trim()}:code:${args.code}`;
  }
  return `adhoc:project:${args.projectId?.trim() || "*"}:routePolicy:${args.routePolicyId?.trim() || "*"}:tag:${args.tag?.trim() || "*"}:textMode:${args.textMode?.trim() || "*"}:code:${args.code}`;
}

export function buildGatewayAnalysisAnomalyIncidentSummary(
  incidents: GatewayAnalysisAnomalyIncidentView[],
): GatewayAnalysisAnomalyIncidentSummaryView {
  const byStatus = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  const byCode = new Map<string, number>();
  const byFollowUpStatus = new Map<string, number>();
  const byEscalationStatus = new Map<string, number>();
  let openIncidents = 0;
  let acknowledgedIncidents = 0;
  let resolvedIncidents = 0;
  let escalatedIncidents = 0;

  for (const incident of incidents) {
    pushBucket(byStatus, incident.status);
    pushBucket(bySeverity, incident.severity);
    pushBucket(byCode, incident.code);
    pushBucket(byFollowUpStatus, incident.followUpStatus);
    pushBucket(byEscalationStatus, incident.escalationStatus);
    if (incident.status === "open") {
      openIncidents += 1;
    } else if (incident.status === "acknowledged") {
      acknowledgedIncidents += 1;
    } else if (incident.status === "resolved") {
      resolvedIncidents += 1;
    }
    if (incident.escalationStatus === "escalated") {
      escalatedIncidents += 1;
    }
  }

  return {
    totalIncidents: incidents.length,
    openIncidents,
    acknowledgedIncidents,
    resolvedIncidents,
    escalatedIncidents,
    byStatus: toBuckets(byStatus),
    bySeverity: toBuckets(bySeverity),
    byCode: toBuckets(byCode),
    byFollowUpStatus: toBuckets(byFollowUpStatus),
    byEscalationStatus: toBuckets(byEscalationStatus),
  };
}
