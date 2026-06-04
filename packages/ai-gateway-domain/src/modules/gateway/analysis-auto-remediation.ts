import type {
  GatewayAnalysisAnomalyIncidentView,
  GatewayAnalysisAnomalyRemediationRunStatus,
  GatewayAnalysisAnomalyPolicyView,
  GatewayRoutePolicyView,
} from "@neuro/contracts";
import { resolveRoutePolicyRateLimitHotspotAutoRemediationActionKeys } from "./route-policy-hotspot-remediation";
import { resolveRoutePolicyRoutingAnomalyAutoRemediationActionKeys } from "./route-policy-routing-remediation";

export function resolveGatewayAnalysisAnomalyRemediationSchedule(args: {
  incidentStatus: string;
  escalationStatus: string;
  autoRemediationEnabled: boolean;
  actionEnabled: boolean;
  autoRemediationIntervalMinutes: number | null;
  autoRemediationDryRunFirst: boolean;
  autoRemediationMaxApplyRunsPerIncident: number | null;
  autoRemediationRequireAlertBeforeApply: boolean;
  autoRemediationFreezeOnProviderHealthDegrade: boolean;
  appliedRunCount: number;
  lastAlertedAt: string | null;
  providerHealthDegraded: boolean;
  latestRunStatus: GatewayAnalysisAnomalyRemediationRunStatus | string | null;
  latestRunDryRun: boolean | null;
  latestRunCompletedAt: string | null;
  latestRunCreatedAt: string | null;
  now?: Date;
}): {
  remediationDue: boolean;
  nextExecutionStatus: GatewayAnalysisAnomalyRemediationRunStatus | null;
  nextRunDueAt: string | null;
  blockedReason: string | null;
} {
  if (
    args.incidentStatus === "resolved" ||
    args.escalationStatus !== "escalated" ||
    !args.autoRemediationEnabled ||
    !args.actionEnabled
  ) {
    return {
      remediationDue: false,
      nextExecutionStatus: null,
      nextRunDueAt: null,
      blockedReason:
        !args.autoRemediationEnabled ? "policy_disabled" : !args.actionEnabled ? "action_not_allowed" : null,
    };
  }

  const now = args.now ?? new Date();
  const intervalMinutes = args.autoRemediationIntervalMinutes ?? 180;
  const latestReference =
    args.latestRunCompletedAt ?? args.latestRunCreatedAt ?? null;

  if (!latestReference) {
    const nextExecutionStatus = args.autoRemediationDryRunFirst ? "dry_run" : "applied";
    if (
      nextExecutionStatus === "applied" &&
      args.autoRemediationRequireAlertBeforeApply &&
      !args.lastAlertedAt
    ) {
      return {
        remediationDue: false,
        nextExecutionStatus,
        nextRunDueAt: null,
        blockedReason: "alert_pending",
      };
    }
    if (
      nextExecutionStatus === "applied" &&
      args.autoRemediationMaxApplyRunsPerIncident != null &&
      args.appliedRunCount >= args.autoRemediationMaxApplyRunsPerIncident
    ) {
      return {
        remediationDue: false,
        nextExecutionStatus,
        nextRunDueAt: null,
        blockedReason: "apply_cap_reached",
      };
    }
    if (
      nextExecutionStatus === "applied" &&
      args.autoRemediationFreezeOnProviderHealthDegrade &&
      args.providerHealthDegraded
    ) {
      return {
        remediationDue: false,
        nextExecutionStatus,
        nextRunDueAt: null,
        blockedReason: "provider_health_degraded",
      };
    }
    return {
      remediationDue: true,
      nextExecutionStatus,
      nextRunDueAt: null,
      blockedReason: null,
    };
  }

  if (args.latestRunStatus === "failed") {
    return {
      remediationDue: false,
      nextExecutionStatus: null,
      nextRunDueAt: null,
      blockedReason: "previous_failure",
    };
  }

  if (args.latestRunStatus === "applied") {
    return {
      remediationDue: false,
      nextExecutionStatus: null,
      nextRunDueAt: null,
      blockedReason: "already_applied",
    };
  }

  const referenceTime = new Date(latestReference);
  if (!Number.isFinite(referenceTime.getTime())) {
    return {
      remediationDue: false,
      nextExecutionStatus: null,
      nextRunDueAt: null,
      blockedReason: "invalid_reference_time",
    };
  }
  const nextRunDueAtDate = new Date(referenceTime.getTime() + intervalMinutes * 60_000);
  const nextExecutionStatus =
    args.latestRunStatus === "dry_run" && args.autoRemediationDryRunFirst
      ? ("applied" as const)
      : args.autoRemediationDryRunFirst && args.latestRunDryRun !== false
        ? ("applied" as const)
        : ("dry_run" as const);

  if (
    nextExecutionStatus === "applied" &&
    args.autoRemediationRequireAlertBeforeApply &&
    !args.lastAlertedAt
  ) {
    return {
      remediationDue: false,
      nextExecutionStatus,
      nextRunDueAt: nextRunDueAtDate.toISOString(),
      blockedReason: "alert_pending",
    };
  }
  if (
    nextExecutionStatus === "applied" &&
    args.autoRemediationMaxApplyRunsPerIncident != null &&
    args.appliedRunCount >= args.autoRemediationMaxApplyRunsPerIncident
  ) {
    return {
      remediationDue: false,
      nextExecutionStatus,
      nextRunDueAt: nextRunDueAtDate.toISOString(),
      blockedReason: "apply_cap_reached",
    };
  }
  if (
    nextExecutionStatus === "applied" &&
    args.autoRemediationFreezeOnProviderHealthDegrade &&
    args.providerHealthDegraded
  ) {
    return {
      remediationDue: false,
      nextExecutionStatus,
      nextRunDueAt: nextRunDueAtDate.toISOString(),
      blockedReason: "provider_health_degraded",
    };
  }

  return {
    remediationDue: nextRunDueAtDate.getTime() <= now.getTime(),
    nextExecutionStatus,
    nextRunDueAt: nextRunDueAtDate.toISOString(),
    blockedReason: null,
  };
}

export function countGatewayAnalysisAutoRemediationEnabledPolicies(
  policies: GatewayAnalysisAnomalyPolicyView[],
) {
  return policies.reduce((count, policy) => count + (policy.autoRemediationEnabled ? 1 : 0), 0);
}

export function resolveGatewayRateLimitHotspotAutoRemediationConfig(
  incident: GatewayAnalysisAnomalyIncidentView,
  routePolicy?: GatewayRoutePolicyView | null,
): {
  autoRemediationEnabled: boolean;
  autoRemediationIntervalMinutes: number;
  autoRemediationDryRunFirst: boolean;
  autoRemediationActionKeys: string[] | null;
  autoRemediationMaxApplyRunsPerIncident: number | null;
  autoRemediationRequireAlertBeforeApply: boolean;
  autoRemediationFreezeOnProviderHealthDegrade: boolean;
} {
  if (!incident.routePolicyId) {
    return {
      autoRemediationEnabled: false,
      autoRemediationIntervalMinutes: 180,
      autoRemediationDryRunFirst: true,
      autoRemediationActionKeys: [],
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
    };
  }

  const configuredProfile = routePolicy?.config.rateLimitHotspotAutoRemediation ?? null;
  if (configuredProfile) {
    return {
      autoRemediationEnabled: configuredProfile.enabled,
      autoRemediationIntervalMinutes: configuredProfile.intervalMinutes ?? 180,
      autoRemediationDryRunFirst: configuredProfile.dryRunFirst,
      autoRemediationActionKeys: resolveRoutePolicyRateLimitHotspotAutoRemediationActionKeys(
        configuredProfile,
        incident.code,
      ),
      autoRemediationMaxApplyRunsPerIncident: configuredProfile.maxApplyRunsPerIncident ?? null,
      autoRemediationRequireAlertBeforeApply: configuredProfile.requireAlertBeforeApply,
      autoRemediationFreezeOnProviderHealthDegrade: configuredProfile.freezeOnProviderHealthDegrade,
    };
  }

  let actionKeys: string[] | null = null;
  if (
    incident.code === "rate_limit_request_spike" ||
    incident.code === "rate_limit_code_concentration" ||
    incident.code === "rate_limit_project_hotspot"
  ) {
    actionKeys = ["tighten-project-rate-limit"];
  } else if (incident.code === "rate_limit_api_key_hotspot") {
    actionKeys = ["tighten-api-key-rate-limit"];
  } else if (incident.code === "rate_limit_model_hotspot") {
    actionKeys = ["tighten-model-rate-limit"];
  } else if (incident.code === "rate_limit_endpoint_hotspot") {
    actionKeys = ["tighten-endpoint-rate-limit"];
  }

  if (!actionKeys?.length) {
    return {
      autoRemediationEnabled: false,
      autoRemediationIntervalMinutes: 180,
      autoRemediationDryRunFirst: true,
      autoRemediationActionKeys: [],
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
    };
  }

  return {
    autoRemediationEnabled: true,
    autoRemediationIntervalMinutes: 180,
    autoRemediationDryRunFirst: true,
    autoRemediationActionKeys: actionKeys,
    autoRemediationMaxApplyRunsPerIncident: 1,
    autoRemediationRequireAlertBeforeApply: true,
    autoRemediationFreezeOnProviderHealthDegrade: true,
  };
}

export function resolveGatewayRoutingAnomalyAutoRemediationConfig(
  incident: GatewayAnalysisAnomalyIncidentView,
  routePolicy?: GatewayRoutePolicyView | null,
): {
  autoRemediationEnabled: boolean;
  autoRemediationIntervalMinutes: number;
  autoRemediationDryRunFirst: boolean;
  autoRemediationActionKeys: string[] | null;
  autoRemediationMaxApplyRunsPerIncident: number | null;
  autoRemediationRequireAlertBeforeApply: boolean;
  autoRemediationFreezeOnProviderHealthDegrade: boolean;
} {
  if (!incident.routePolicyId || !routePolicy) {
    return {
      autoRemediationEnabled: false,
      autoRemediationIntervalMinutes: 180,
      autoRemediationDryRunFirst: true,
      autoRemediationActionKeys: [],
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
    };
  }

  const configuredProfile = routePolicy.config.routingAnomalyAutoRemediation ?? null;
  if (configuredProfile) {
    return {
      autoRemediationEnabled: configuredProfile.enabled,
      autoRemediationIntervalMinutes: configuredProfile.intervalMinutes ?? 180,
      autoRemediationDryRunFirst: configuredProfile.dryRunFirst,
      autoRemediationActionKeys: resolveRoutePolicyRoutingAnomalyAutoRemediationActionKeys(
        configuredProfile,
        incident.code,
      ),
      autoRemediationMaxApplyRunsPerIncident: configuredProfile.maxApplyRunsPerIncident ?? null,
      autoRemediationRequireAlertBeforeApply: configuredProfile.requireAlertBeforeApply,
      autoRemediationFreezeOnProviderHealthDegrade: configuredProfile.freezeOnProviderHealthDegrade,
    };
  }

  if (
    incident.code !== "failure_rate_spike" &&
    incident.code !== "completion_rate_drop" &&
    incident.code !== "provider_routing_score_drop" &&
    incident.code !== "degraded_provider_route_spike" &&
    incident.code !== "saturated_provider_route_spike" &&
    incident.code !== "breaker_open_provider_route_detected"
  ) {
    return {
      autoRemediationEnabled: false,
      autoRemediationIntervalMinutes: 180,
      autoRemediationDryRunFirst: true,
      autoRemediationActionKeys: [],
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
    };
  }

  const allowProviderIsolation = Boolean(
    routePolicy.config.allowedProviderAccountIds && routePolicy.config.allowedProviderAccountIds.length > 1,
  );
  const actionKeys =
    incident.code === "saturated_provider_route_spike"
      ? ["reduce-provider-concurrency"]
      : incident.code === "breaker_open_provider_route_detected"
        ? [
            ...(allowProviderIsolation ? ["provider-isolation"] : []),
            "disable-prestream-fallback",
          ]
        : [
            "disable-prestream-fallback",
            "reduce-provider-concurrency",
            ...(allowProviderIsolation ? ["provider-isolation"] : []),
          ];

  return {
    autoRemediationEnabled: actionKeys.length > 0,
    autoRemediationIntervalMinutes: 180,
    autoRemediationDryRunFirst: true,
    autoRemediationActionKeys: actionKeys,
    autoRemediationMaxApplyRunsPerIncident: 1,
    autoRemediationRequireAlertBeforeApply: true,
    autoRemediationFreezeOnProviderHealthDegrade: true,
  };
}
