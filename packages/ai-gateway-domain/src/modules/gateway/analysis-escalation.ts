import type {
  GatewayAnalysisAnomalyIncidentFollowUpStatus,
  GatewayAnalysisAnomalyPolicyView,
  GatewayAnalysisExportAnomalySeverity,
} from "@neuro/contracts";

function severityRank(value: GatewayAnalysisExportAnomalySeverity | null | undefined) {
  if (value === "critical") {
    return 2;
  }
  if (value === "warning") {
    return 1;
  }
  return 0;
}

export function resolveGatewayAnalysisAnomalyAutoEscalation(args: {
  policy: GatewayAnalysisAnomalyPolicyView | null;
  anomalySeverity: GatewayAnalysisExportAnomalySeverity;
  syncHitCount: number;
}) {
  const policy = args.policy;
  if (!policy?.autoEscalateEnabled) {
    return {
      shouldEscalate: false,
      reason: null,
      ownerUserId: null,
      followUpStatus: null,
    };
  }

  const requiredSeverity = policy.escalateSeverityThreshold ?? "critical";
  const requiredHitCount = Math.max(1, policy.escalateAfterSyncCount ?? 3);
  if (severityRank(args.anomalySeverity) < severityRank(requiredSeverity)) {
    return {
      shouldEscalate: false,
      reason: null,
      ownerUserId: null,
      followUpStatus: null,
    };
  }
  if (args.syncHitCount < requiredHitCount) {
    return {
      shouldEscalate: false,
      reason: null,
      ownerUserId: null,
      followUpStatus: null,
    };
  }

  return {
    shouldEscalate: true,
    reason: `Auto escalated after ${args.syncHitCount} sync hit(s) at severity ${args.anomalySeverity}.`,
    ownerUserId: policy.autoEscalateOwnerUserId ?? null,
    followUpStatus: policy.autoEscalateFollowUpStatus as GatewayAnalysisAnomalyIncidentFollowUpStatus | null,
  };
}

export function resolveGatewayRateLimitHotspotAutoEscalation(args: {
  anomalySeverity: GatewayAnalysisExportAnomalySeverity;
  syncHitCount: number;
}) {
  const requiredHitCount = args.anomalySeverity === "critical" ? 1 : 3;
  if (args.syncHitCount < requiredHitCount) {
    return {
      shouldEscalate: false,
      reason: null,
      ownerUserId: null,
      followUpStatus: null,
    };
  }

  return {
    shouldEscalate: true,
    reason:
      args.anomalySeverity === "critical"
        ? `Hotspot auto escalated immediately at severity critical after ${args.syncHitCount} sync hit(s).`
        : `Hotspot auto escalated after ${args.syncHitCount} warning sync hit(s).`,
    ownerUserId: null,
    followUpStatus:
      (args.anomalySeverity === "critical" ? "investigating" : "monitoring") satisfies GatewayAnalysisAnomalyIncidentFollowUpStatus,
  };
}

export function resolveGatewayProviderRoutingAutoEscalation(args: {
  anomalySeverity: GatewayAnalysisExportAnomalySeverity;
  syncHitCount: number;
}) {
  const requiredHitCount = args.anomalySeverity === "critical" ? 1 : 3;
  if (args.syncHitCount < requiredHitCount) {
    return {
      shouldEscalate: false,
      reason: null,
      ownerUserId: null,
      followUpStatus: null,
    };
  }

  return {
    shouldEscalate: true,
    reason:
      args.anomalySeverity === "critical"
        ? `Provider routing auto escalated immediately at severity critical after ${args.syncHitCount} sync hit(s).`
        : `Provider routing auto escalated after ${args.syncHitCount} warning sync hit(s).`,
    ownerUserId: null,
    followUpStatus:
      (args.anomalySeverity === "critical" ? "investigating" : "monitoring") satisfies GatewayAnalysisAnomalyIncidentFollowUpStatus,
  };
}
