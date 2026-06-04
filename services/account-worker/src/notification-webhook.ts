import { createHmac } from "node:crypto";

import { notificationWebhookDefaultTargetRouteName, type EventName } from "@neuro/contracts";

import { env, type NotificationWebhookFormat, type NotificationWebhookRouteConfig } from "./env";
import {
  markNotificationWebhookRouteDelivered,
  shouldSendNotificationWebhookRoute,
  touchNotificationWebhookIncident,
} from "./notification-webhook-state";

type CallbackRemediationAlertWebhookPayload = {
  eventName: "agentExecution.callbackRemediationAlerted";
  source: "neuroloom-account-worker";
  sentAt: string;
  alertKey: string;
  severity: NotificationWebhookSeverity;
  alertLevel: number;
  title: string;
  detail: string;
  actionLabel: string;
  count: number;
  candidateCount: number;
  maxAlertLevel: number;
  operatorPath: string;
  operatorUrl: string | null;
  reasonCategory: string | null;
  reasonDisposition: string | null;
  policyKey: string | null;
  scope: {
    agentId: string | null;
    agentName: string | null;
    agentOwnerUserId: string | null;
    callbackType: string | null;
  };
};

type RuntimePressureAlertWebhookPayload = {
  eventName: "agentExecution.runtimePressureAlerted";
  source: "neuroloom-account-worker";
  sentAt: string;
  alertKey: string;
  severity: NotificationWebhookSeverity;
  alertLevel: number;
  title: string;
  detail: string;
  actionLabel: string;
  count: number;
  candidateCount: number;
  maxAlertLevel: number;
  operatorPath: string;
  operatorUrl: string | null;
  pressureLevel: string;
  schedulingDecisionClass: string;
  runtime: {
    profileKey: string;
    ownerUserId: string | null;
    queuedExecutionCount: number;
    runningExecutionCount: number;
    claimableQueuedExecutionCount: number;
    blockedQueuedExecutionCount: number;
    blockedByProfileCount: number;
    blockedByOwnerCount: number;
    saturatedOwnerCount: number;
    busiestOwnerUserId: string | null;
    busiestOwnerRunningCount: number | null;
    busiestBlockedOwnerUserId: string | null;
    busiestBlockedOwnerQueuedCount: number | null;
  };
};

type GatewayAnomalyIncidentAlertWebhookPayload = {
  eventName: "aiGateway.anomalyIncidentAlerted";
  source: "neuroloom-account-worker";
  sentAt: string;
  alertKey: string;
  severity: NotificationWebhookSeverity;
  alertLevel: number;
  title: string;
  detail: string;
  actionLabel: string;
  count: number;
  candidateCount: number;
  maxAlertLevel: number;
  operatorPath: string;
  operatorUrl: string | null;
  reasonCategory: string | null;
  reasonDisposition: string | null;
  policyKey: string | null;
  scope: {
    projectId: string | null;
    incidentId: string | null;
    ownerUserId: string | null;
    routePolicyId: string | null;
  };
};

type GatewayRemediationEffectivenessAnomalyAlertWebhookPayload = {
  eventName: "aiGateway.remediationEffectivenessAnomalyAlerted";
  source: "neuroloom-account-worker";
  sentAt: string;
  alertKey: string;
  severity: NotificationWebhookSeverity;
  alertLevel: number;
  title: string;
  detail: string;
  actionLabel: string;
  count: number;
  candidateCount: number;
  maxAlertLevel: number;
  operatorPath: string;
  operatorUrl: string | null;
  reasonCategory: string | null;
  reasonDisposition: string | null;
  policyKey: string | null;
  scope: {
    routePolicyId: string | null;
    snapshotId: string | null;
    criticalCount: number | null;
  };
};

type GatewayRateLimitHotspotAnomalyAlertWebhookPayload = {
  eventName: "aiGateway.rateLimitHotspotAnomalyAlerted";
  source: "neuroloom-account-worker";
  sentAt: string;
  alertKey: string;
  severity: NotificationWebhookSeverity;
  alertLevel: number;
  title: string;
  detail: string;
  actionLabel: string;
  count: number;
  candidateCount: number;
  maxAlertLevel: number;
  operatorPath: string;
  operatorUrl: string | null;
  reasonCategory: string | null;
  reasonDisposition: string | null;
  policyKey: string | null;
  scope: {
    projectId: string | null;
    routePolicyId: string | null;
    snapshotId: string | null;
    criticalCount: number | null;
  };
};

type NotificationWebhookSeverity = "info" | "warning" | "danger";

type SlackWebhookPayload = {
  text: string;
  blocks: Array<Record<string, unknown>>;
};

type DiscordWebhookPayload = {
  content?: string;
  embeds: Array<Record<string, unknown>>;
};

type FeishuWebhookPayload = {
  msg_type: "post";
  content: {
    post: {
      zh_cn: {
        title: string;
        content: Array<Array<Record<string, string>>>;
      };
    };
  };
};

type GenericNotificationWebhookPayload =
  | CallbackRemediationAlertWebhookPayload
  | RuntimePressureAlertWebhookPayload
  | GatewayAnomalyIncidentAlertWebhookPayload
  | GatewayRemediationEffectivenessAnomalyAlertWebhookPayload
  | GatewayRateLimitHotspotAnomalyAlertWebhookPayload;

type NotificationWebhookPayload =
  | GenericNotificationWebhookPayload
  | SlackWebhookPayload
  | DiscordWebhookPayload
  | FeishuWebhookPayload;

type NotificationWebhookDeliveryTarget = {
  name: string;
  url: string;
  format: NotificationWebhookFormat;
  authToken: string | null;
  signingSecret: string | null;
  timeoutMs: number;
  routeConfig?: NotificationWebhookRouteConfig | null;
};

type NotificationWebhookDeliveryConfig = {
  defaultTarget: NotificationWebhookDeliveryTarget | null;
  routes: NotificationWebhookRouteConfig[];
};

function toOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

function buildCallbackRemediationOperatorPath(payload: Record<string, unknown>) {
  const params = new URLSearchParams();
  params.set("status", "rejected");

  const agentId = toOptionalString(payload.scopeAgentId);
  const callbackType = toOptionalString(payload.scopeCallbackType);
  const reasonCategory = toOptionalString(payload.reasonCategory);
  const reasonDisposition = toOptionalString(payload.reasonDisposition);
  const policyKey = toOptionalString(payload.policyKey);

  if (agentId) params.set("agentId", agentId);
  if (callbackType) params.set("callbackType", callbackType);
  if (reasonCategory) params.set("autoRemediationReasonCategory", reasonCategory);
  if (reasonDisposition) params.set("autoRemediationReasonDisposition", reasonDisposition);
  if (policyKey) params.set("remediationPolicyKey", policyKey);

  return `/ops/agent-callbacks?${params.toString()}`;
}

function buildRuntimePressureOperatorPath(payload: Record<string, unknown>) {
  const params = new URLSearchParams();
  const pressureLevel = toOptionalString(payload.pressureLevel);
  const schedulingDecisionClass = toOptionalString(payload.schedulingDecisionClass);
  if (pressureLevel) params.set("runtimePressureLevel", pressureLevel);
  if (schedulingDecisionClass) params.set("runtimeSchedulingDecisionClass", schedulingDecisionClass);
  const query = params.toString();
  return query ? `/ops/agent-callbacks?${query}#runtime-pressure` : "/ops/agent-callbacks#runtime-pressure";
}

function buildGatewayAnomalyOperatorPath(payload: Record<string, unknown>) {
  const params = new URLSearchParams();
  const projectId = toOptionalString(payload.projectId);
  const incidentId = toOptionalString(payload.incidentId);
  const anomalyCode = toOptionalString(payload.reasonCategory);
  const followUpStatus = toOptionalString(payload.followUpStatus);
  const policyId = toOptionalString(payload.policyId);

  if (projectId) params.set("projectId", projectId);
  if (incidentId) params.set("incidentId", incidentId);
  if (anomalyCode) params.set("gatewayAnomalyCode", anomalyCode);
  if (followUpStatus) params.set("followUpStatus", followUpStatus);
  if (policyId) params.set("policyId", policyId);

  const query = params.toString();
  return query
    ? `/ops/account/issues?${query}#gateway-anomalies`
    : "/ops/account/issues#gateway-anomalies";
}

function buildGatewayRemediationEffectivenessAnomalyOperatorPath(payload: Record<string, unknown>) {
  const params = new URLSearchParams();
  const snapshotId = toOptionalString(payload.snapshotId);
  const routePolicyId = toOptionalString(payload.routePolicyId);
  const anomalyCode = toOptionalString(payload.reasonCategory);
  const profileKey = toOptionalString(payload.profileKey);

  if (snapshotId) params.set("snapshotId", snapshotId);
  if (routePolicyId) params.set("routePolicyId", routePolicyId);
  if (anomalyCode) params.set("gatewayRemediationAnomalyCode", anomalyCode);
  if (profileKey) params.set("profileKey", profileKey);

  const query = params.toString();
  return query
    ? `/ops/account/issues?${query}#gateway-remediation-effectiveness`
    : "/ops/account/issues#gateway-remediation-effectiveness";
}

function buildGatewayRateLimitHotspotAnomalyOperatorPath(payload: Record<string, unknown>) {
  const params = new URLSearchParams();
  const projectId = toOptionalString(payload.projectId);
  const snapshotId = toOptionalString(payload.snapshotId);
  const routePolicyId = toOptionalString(payload.routePolicyId);
  const anomalyCode = toOptionalString(payload.reasonCategory);
  const profileKey = toOptionalString(payload.profileKey);

  if (projectId) params.set("projectId", projectId);
  if (snapshotId) params.set("snapshotId", snapshotId);
  if (routePolicyId) params.set("routePolicyId", routePolicyId);
  if (anomalyCode) params.set("gatewayRateLimitAnomalyCode", anomalyCode);
  if (profileKey) params.set("profileKey", profileKey);

  const query = params.toString();
  return query
    ? `/ops/account/issues?${query}#gateway-rate-limit-hotspots`
    : "/ops/account/issues#gateway-rate-limit-hotspots";
}

function buildGenericNotificationWebhookPayload(
  eventName: EventName,
  payload: Record<string, unknown>,
) {
  if (eventName === "agentExecution.callbackRemediationAlerted") {
    const operatorPath = buildCallbackRemediationOperatorPath(payload);
    return {
      eventName,
      source: "neuroloom-account-worker",
      sentAt: new Date().toISOString(),
      alertKey: [
        "callback-remediation",
        toSafeNumber(payload.alertLevel),
        toOptionalString(payload.reasonCategory) ?? "none",
        toOptionalString(payload.reasonDisposition) ?? "none",
        toOptionalString(payload.policyKey) ?? "none",
        toOptionalString(payload.scopeAgentId) ?? "global",
        toOptionalString(payload.scopeCallbackType) ?? "all",
      ].join(":"),
      severity:
        payload.severity === "danger" || payload.severity === "warning" || payload.severity === "info"
          ? payload.severity
          : "warning",
      alertLevel: toSafeNumber(payload.alertLevel),
      title: toOptionalString(payload.title) ?? "Callback remediation alert",
      detail: toOptionalString(payload.detail) ?? "",
      actionLabel: toOptionalString(payload.actionLabel) ?? "查看 callback backlog",
      count: toSafeNumber(payload.count),
      candidateCount: toSafeNumber(payload.candidateCount),
      maxAlertLevel: toSafeNumber(payload.maxAlertLevel),
      operatorPath,
      operatorUrl: env.webPublicBaseUrl ? `${env.webPublicBaseUrl.replace(/\/+$/, "")}${operatorPath}` : null,
      reasonCategory: toOptionalString(payload.reasonCategory),
      reasonDisposition: toOptionalString(payload.reasonDisposition),
      policyKey: toOptionalString(payload.policyKey),
      scope: {
        agentId: toOptionalString(payload.scopeAgentId),
        agentName: toOptionalString(payload.agentName),
        agentOwnerUserId: toOptionalString(payload.agentOwnerUserId),
        callbackType: toOptionalString(payload.scopeCallbackType),
      },
    } satisfies CallbackRemediationAlertWebhookPayload;
  }

  if (eventName === "agentExecution.runtimePressureAlerted") {
    const operatorPath = buildRuntimePressureOperatorPath(payload);
    return {
      eventName,
      source: "neuroloom-account-worker",
      sentAt: new Date().toISOString(),
      alertKey: [
        "runtime-pressure",
        toSafeNumber(payload.alertLevel),
        toOptionalString(payload.profileKey) ?? "baseline",
        toOptionalString(payload.pressureLevel) ?? "healthy",
        toOptionalString(payload.schedulingDecisionClass) ?? "within_capacity",
        toOptionalString(payload.ownerUserId) ?? "none",
      ].join(":"),
      severity:
        payload.severity === "danger" || payload.severity === "warning" || payload.severity === "info"
          ? payload.severity
          : "warning",
      alertLevel: toSafeNumber(payload.alertLevel),
      title: toOptionalString(payload.title) ?? "Runtime pressure alert",
      detail: toOptionalString(payload.detail) ?? "",
      actionLabel: toOptionalString(payload.actionLabel) ?? "查看 runtime pressure",
      count: toSafeNumber(payload.queuedExecutionCount),
      candidateCount: toSafeNumber(payload.runningExecutionCount),
      maxAlertLevel: toSafeNumber(payload.maxAlertLevel),
      operatorPath,
      operatorUrl: env.webPublicBaseUrl ? `${env.webPublicBaseUrl.replace(/\/+$/, "")}${operatorPath}` : null,
      pressureLevel: toOptionalString(payload.pressureLevel) ?? "healthy",
      schedulingDecisionClass: toOptionalString(payload.schedulingDecisionClass) ?? "within_capacity",
      runtime: {
        profileKey: toOptionalString(payload.profileKey) ?? "baseline",
        ownerUserId: toOptionalString(payload.ownerUserId),
        queuedExecutionCount: toSafeNumber(payload.queuedExecutionCount),
        runningExecutionCount: toSafeNumber(payload.runningExecutionCount),
        claimableQueuedExecutionCount: toSafeNumber(payload.claimableQueuedExecutionCount),
        blockedQueuedExecutionCount: toSafeNumber(payload.blockedQueuedExecutionCount),
        blockedByProfileCount: toSafeNumber(payload.blockedByProfileCount),
        blockedByOwnerCount: toSafeNumber(payload.blockedByOwnerCount),
        saturatedOwnerCount: toSafeNumber(payload.saturatedOwnerCount),
        busiestOwnerUserId: toOptionalString(payload.ownerUserId),
        busiestOwnerRunningCount:
          payload.busiestOwnerRunningCount === null || payload.busiestOwnerRunningCount === undefined
            ? null
            : toSafeNumber(payload.busiestOwnerRunningCount),
        busiestBlockedOwnerUserId: toOptionalString(payload.busiestBlockedOwnerUserId),
        busiestBlockedOwnerQueuedCount:
          payload.busiestBlockedOwnerQueuedCount === null || payload.busiestBlockedOwnerQueuedCount === undefined
            ? null
            : toSafeNumber(payload.busiestBlockedOwnerQueuedCount),
      },
    } satisfies RuntimePressureAlertWebhookPayload;
  }

  if (eventName === "aiGateway.anomalyIncidentAlerted") {
    const operatorPath = buildGatewayAnomalyOperatorPath(payload);
    return {
      eventName,
      source: "neuroloom-account-worker",
      sentAt: new Date().toISOString(),
      alertKey: [
        "gateway-anomaly",
        toSafeNumber(payload.alertLevel),
        toOptionalString(payload.reasonCategory) ?? "none",
        toOptionalString(payload.followUpStatus) ?? "none",
        toOptionalString(payload.policyId) ?? "none",
        toOptionalString(payload.projectId) ?? "global",
        toOptionalString(payload.incidentId) ?? "none",
      ].join(":"),
      severity:
        payload.severity === "danger" || payload.severity === "warning" || payload.severity === "info"
          ? payload.severity
          : "warning",
      alertLevel: toSafeNumber(payload.alertLevel),
      title: toOptionalString(payload.title) ?? "AI gateway anomaly alert",
      detail: toOptionalString(payload.detail) ?? "",
      actionLabel: toOptionalString(payload.actionLabel) ?? "查看 gateway anomalies",
      count: toSafeNumber(payload.count),
      candidateCount: toSafeNumber(payload.candidateCount),
      maxAlertLevel: toSafeNumber(payload.maxAlertLevel),
      operatorPath,
      operatorUrl: env.webPublicBaseUrl ? `${env.webPublicBaseUrl.replace(/\/+$/, "")}${operatorPath}` : null,
      reasonCategory: toOptionalString(payload.reasonCategory),
      reasonDisposition: toOptionalString(payload.followUpStatus),
      policyKey: toOptionalString(payload.policyId),
      scope: {
        projectId: toOptionalString(payload.projectId),
        incidentId: toOptionalString(payload.incidentId),
        ownerUserId: toOptionalString(payload.ownerUserId),
        routePolicyId: toOptionalString(payload.routePolicyId),
      },
    } satisfies GatewayAnomalyIncidentAlertWebhookPayload;
  }

  if (eventName === "aiGateway.remediationEffectivenessAnomalyAlerted") {
    const operatorPath = buildGatewayRemediationEffectivenessAnomalyOperatorPath(payload);
    return {
      eventName,
      source: "neuroloom-account-worker",
      sentAt: new Date().toISOString(),
      alertKey: [
        "gateway-remediation-effectiveness-anomaly",
        toSafeNumber(payload.alertLevel),
        toOptionalString(payload.reasonCategory) ?? "none",
        toOptionalString(payload.profileKey) ?? "none",
        toOptionalString(payload.routePolicyId) ?? "global",
        toOptionalString(payload.snapshotId) ?? "none",
        toOptionalString(payload.reasonDisposition) ?? "none",
      ].join(":"),
      severity:
        payload.severity === "danger" || payload.severity === "warning" || payload.severity === "info"
          ? payload.severity
          : "warning",
      alertLevel: toSafeNumber(payload.alertLevel),
      title: toOptionalString(payload.title) ?? "AI gateway remediation effectiveness anomaly alert",
      detail: toOptionalString(payload.detail) ?? "",
      actionLabel: toOptionalString(payload.actionLabel) ?? "查看 remediation effectiveness anomalies",
      count: toSafeNumber(payload.count),
      candidateCount: toSafeNumber(payload.candidateCount),
      maxAlertLevel: toSafeNumber(payload.maxAlertLevel),
      operatorPath,
      operatorUrl: env.webPublicBaseUrl ? `${env.webPublicBaseUrl.replace(/\/+$/, "")}${operatorPath}` : null,
      reasonCategory: toOptionalString(payload.reasonCategory),
      reasonDisposition: toOptionalString(payload.reasonDisposition),
      policyKey: toOptionalString(payload.profileKey),
      scope: {
        routePolicyId: toOptionalString(payload.routePolicyId),
        snapshotId: toOptionalString(payload.snapshotId),
        criticalCount:
          payload.criticalCount === null || payload.criticalCount === undefined
            ? null
            : toSafeNumber(payload.criticalCount),
      },
    } satisfies GatewayRemediationEffectivenessAnomalyAlertWebhookPayload;
  }

  if (eventName === "aiGateway.rateLimitHotspotAnomalyAlerted") {
    const operatorPath = buildGatewayRateLimitHotspotAnomalyOperatorPath(payload);
    return {
      eventName,
      source: "neuroloom-account-worker",
      sentAt: new Date().toISOString(),
      alertKey: [
        "gateway-rate-limit-hotspot-anomaly",
        toSafeNumber(payload.alertLevel),
        toOptionalString(payload.reasonCategory) ?? "none",
        toOptionalString(payload.profileKey) ?? "none",
        toOptionalString(payload.routePolicyId) ?? "global",
        toOptionalString(payload.projectId) ?? "global",
        toOptionalString(payload.snapshotId) ?? "none",
      ].join(":"),
      severity:
        payload.severity === "danger" || payload.severity === "warning" || payload.severity === "info"
          ? payload.severity
          : "warning",
      alertLevel: toSafeNumber(payload.alertLevel),
      title: toOptionalString(payload.title) ?? "AI gateway rate-limit hotspot anomaly alert",
      detail: toOptionalString(payload.detail) ?? "",
      actionLabel: toOptionalString(payload.actionLabel) ?? "查看 rate-limit hotspot anomalies",
      count: toSafeNumber(payload.count),
      candidateCount: toSafeNumber(payload.candidateCount),
      maxAlertLevel: toSafeNumber(payload.maxAlertLevel),
      operatorPath,
      operatorUrl: env.webPublicBaseUrl ? `${env.webPublicBaseUrl.replace(/\/+$/, "")}${operatorPath}` : null,
      reasonCategory: toOptionalString(payload.reasonCategory),
      reasonDisposition: toOptionalString(payload.reasonDisposition),
      policyKey: toOptionalString(payload.profileKey),
      scope: {
        projectId: toOptionalString(payload.projectId),
        routePolicyId: toOptionalString(payload.routePolicyId),
        snapshotId: toOptionalString(payload.snapshotId),
        criticalCount:
          payload.criticalCount === null || payload.criticalCount === undefined
            ? null
            : toSafeNumber(payload.criticalCount),
      },
    } satisfies GatewayRateLimitHotspotAnomalyAlertWebhookPayload;
  }

  return null;
}

function getNotificationHeading(payload: GenericNotificationWebhookPayload) {
  if (payload.eventName === "agentExecution.callbackRemediationAlerted") {
    return `Callback remediation alert L${payload.alertLevel}`;
  }
  if (payload.eventName === "agentExecution.runtimePressureAlerted") {
    return `Runtime pressure alert L${payload.alertLevel}`;
  }
  if (payload.eventName === "aiGateway.remediationEffectivenessAnomalyAlerted") {
    return `AI gateway remediation effectiveness anomaly alert L${payload.alertLevel}`;
  }
  if (payload.eventName === "aiGateway.rateLimitHotspotAnomalyAlerted") {
    return `AI gateway rate-limit hotspot anomaly alert L${payload.alertLevel}`;
  }
  return `AI gateway anomaly alert L${payload.alertLevel}`;
}

function getSeverityLabel(severity: GenericNotificationWebhookPayload["severity"]) {
  if (severity === "danger") return "L3 / Danger";
  if (severity === "warning") return "L2 / Warning";
  return "L1 / Info";
}

function getSeverityColor(severity: GenericNotificationWebhookPayload["severity"]) {
  if (severity === "danger") return 0xe5484d;
  if (severity === "warning") return 0xf5a524;
  return 0x3b82f6;
}

function buildScopeSummary(payload: GenericNotificationWebhookPayload) {
  if (payload.eventName === "agentExecution.callbackRemediationAlerted") {
    const parts: string[] = [];
    if (payload.scope.agentName) parts.push(`agent=${payload.scope.agentName}`);
    else if (payload.scope.agentId) parts.push(`agent=${payload.scope.agentId}`);
    else parts.push("agent=global");
    if (payload.scope.callbackType) parts.push(`callback=${payload.scope.callbackType}`);
    if (payload.reasonCategory) parts.push(`reason=${payload.reasonCategory}`);
    if (payload.reasonDisposition) parts.push(`disposition=${payload.reasonDisposition}`);
    if (payload.policyKey) parts.push(`policy=${payload.policyKey}`);
    return parts.join(" | ");
  }

  if (payload.eventName === "aiGateway.anomalyIncidentAlerted") {
    const parts = [
      payload.scope.projectId ? `project=${payload.scope.projectId}` : "project=global",
      payload.scope.incidentId ? `incident=${payload.scope.incidentId}` : null,
      payload.reasonCategory ? `code=${payload.reasonCategory}` : null,
      payload.reasonDisposition ? `followUp=${payload.reasonDisposition}` : null,
      payload.policyKey ? `policy=${payload.policyKey}` : null,
      payload.scope.ownerUserId ? `owner=${payload.scope.ownerUserId}` : null,
    ].filter((item): item is string => Boolean(item));
    return parts.join(" | ");
  }

  if (payload.eventName === "aiGateway.remediationEffectivenessAnomalyAlerted") {
    const parts = [
      payload.scope.routePolicyId ? `route=${payload.scope.routePolicyId}` : "route=global",
      payload.scope.snapshotId ? `snapshot=${payload.scope.snapshotId}` : null,
      payload.reasonCategory ? `code=${payload.reasonCategory}` : null,
      payload.reasonDisposition ? `profile=${payload.reasonDisposition}` : null,
      payload.policyKey ? `policy=${payload.policyKey}` : null,
      typeof payload.scope.criticalCount === "number" ? `critical=${payload.scope.criticalCount}` : null,
    ].filter((item): item is string => Boolean(item));
    return parts.join(" | ");
  }

  if (payload.eventName === "aiGateway.rateLimitHotspotAnomalyAlerted") {
    const parts = [
      payload.scope.projectId ? `project=${payload.scope.projectId}` : "project=global",
      payload.scope.routePolicyId ? `route=${payload.scope.routePolicyId}` : "route=global",
      payload.scope.snapshotId ? `snapshot=${payload.scope.snapshotId}` : null,
      payload.reasonCategory ? `code=${payload.reasonCategory}` : null,
      payload.reasonDisposition ? `profile=${payload.reasonDisposition}` : null,
      typeof payload.scope.criticalCount === "number" ? `critical=${payload.scope.criticalCount}` : null,
    ].filter((item): item is string => Boolean(item));
    return parts.join(" | ");
  }

  const parts = [
    `profile=${payload.runtime.profileKey}`,
    `pressure=${payload.pressureLevel}`,
    `decision=${payload.schedulingDecisionClass}`,
    payload.runtime.ownerUserId ? `owner=${payload.runtime.ownerUserId}` : null,
  ].filter((item): item is string => Boolean(item));
  return parts.join(" | ");
}

function buildNotificationFacts(payload: GenericNotificationWebhookPayload) {
  if (payload.eventName === "agentExecution.callbackRemediationAlerted") {
    return [
      { label: "Severity", value: `${getSeverityLabel(payload.severity)} / alertLevel=${payload.alertLevel}` },
      { label: "Count", value: `${payload.count} / candidates=${payload.candidateCount}` },
      { label: "Policy", value: payload.policyKey ?? "none" },
      { label: "Reason", value: payload.reasonCategory ?? "none" },
      { label: "Disposition", value: payload.reasonDisposition ?? "none" },
      { label: "Scope", value: buildScopeSummary(payload) },
      { label: "Action", value: payload.actionLabel },
      { label: "Alert Key", value: payload.alertKey },
    ];
  }

  if (payload.eventName === "aiGateway.anomalyIncidentAlerted") {
    return [
      { label: "Severity", value: `${getSeverityLabel(payload.severity)} / alertLevel=${payload.alertLevel}` },
      { label: "Sync Hits / Actions", value: `${payload.count} / ${payload.candidateCount}` },
      { label: "Policy", value: payload.policyKey ?? "none" },
      { label: "Anomaly", value: payload.reasonCategory ?? "none" },
      { label: "Follow-up", value: payload.reasonDisposition ?? "none" },
      { label: "Scope", value: buildScopeSummary(payload) },
      { label: "Action", value: payload.actionLabel },
      { label: "Alert Key", value: payload.alertKey },
    ];
  }

  if (payload.eventName === "aiGateway.remediationEffectivenessAnomalyAlerted") {
    return [
      { label: "Severity", value: `${getSeverityLabel(payload.severity)} / alertLevel=${payload.alertLevel}` },
      { label: "Anomalies / Critical", value: `${payload.count} / ${payload.scope.criticalCount ?? 0}` },
      { label: "Profile", value: payload.reasonDisposition ?? payload.policyKey ?? "none" },
      { label: "Anomaly", value: payload.reasonCategory ?? "none" },
      { label: "Scope", value: buildScopeSummary(payload) },
      { label: "Action", value: payload.actionLabel },
      { label: "Alert Key", value: payload.alertKey },
    ];
  }

  if (payload.eventName === "aiGateway.rateLimitHotspotAnomalyAlerted") {
    return [
      { label: "Severity", value: `${getSeverityLabel(payload.severity)} / alertLevel=${payload.alertLevel}` },
      { label: "Anomalies / Critical", value: `${payload.count} / ${payload.scope.criticalCount ?? 0}` },
      { label: "Profile", value: payload.reasonDisposition ?? payload.policyKey ?? "none" },
      { label: "Anomaly", value: payload.reasonCategory ?? "none" },
      { label: "Scope", value: buildScopeSummary(payload) },
      { label: "Action", value: payload.actionLabel },
      { label: "Alert Key", value: payload.alertKey },
    ];
  }

  return [
    { label: "Severity", value: `${getSeverityLabel(payload.severity)} / alertLevel=${payload.alertLevel}` },
    { label: "Queue / Running", value: `${payload.runtime.queuedExecutionCount} / ${payload.runtime.runningExecutionCount}` },
    {
      label: "Claimable / Blocked",
      value: `${payload.runtime.claimableQueuedExecutionCount} / ${payload.runtime.blockedQueuedExecutionCount}`,
    },
    {
      label: "Profile / Owner Guardrail",
      value: `${payload.runtime.blockedByProfileCount} / ${payload.runtime.blockedByOwnerCount}`,
    },
    { label: "Pressure", value: payload.pressureLevel },
    { label: "Scheduling", value: payload.schedulingDecisionClass },
    { label: "Owner", value: payload.runtime.ownerUserId ?? "none" },
    { label: "Saturated Owners", value: String(payload.runtime.saturatedOwnerCount) },
    { label: "Scope", value: buildScopeSummary(payload) },
    { label: "Action", value: payload.actionLabel },
    { label: "Alert Key", value: payload.alertKey },
  ];
}

function buildSlackWebhookPayload(payload: GenericNotificationWebhookPayload): SlackWebhookPayload {
  const facts = buildNotificationFacts(payload);
  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: getNotificationHeading(payload),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${payload.title}*\n${payload.detail || payload.title}`,
      },
    },
    {
      type: "section",
      fields: facts.slice(0, 6).map((fact) => ({
        type: "mrkdwn",
        text: `*${fact.label}*\n${fact.value}`,
      })),
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `source=${payload.source} | sentAt=${payload.sentAt}`,
        },
      ],
    },
  ];

  if (payload.operatorUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: payload.actionLabel,
          },
          url: payload.operatorUrl,
        },
      ],
    });
  }

  return {
    text: `[${getSeverityLabel(payload.severity)}] ${payload.title} (${payload.count})`,
    blocks,
  };
}

function buildDiscordWebhookPayload(payload: GenericNotificationWebhookPayload): DiscordWebhookPayload {
  const facts = buildNotificationFacts(payload);
  return {
    content: payload.operatorUrl ? `${payload.actionLabel}: ${payload.operatorUrl}` : undefined,
    embeds: [
      {
        title: getNotificationHeading(payload),
        description: payload.detail || payload.title,
        color: getSeverityColor(payload.severity),
        url: payload.operatorUrl ?? undefined,
        fields: facts.map((fact) => ({
          name: fact.label,
          value: fact.value,
          inline: fact.label !== "Scope" && fact.label !== "Alert Key",
        })),
        footer: {
          text: payload.alertKey,
        },
        timestamp: payload.sentAt,
      },
    ],
  };
}

function buildFeishuWebhookPayload(payload: GenericNotificationWebhookPayload): FeishuWebhookPayload {
  const facts = buildNotificationFacts(payload);
  const content: Array<Array<Record<string, string>>> = [
    [
      {
        tag: "text",
        text: payload.detail || payload.title,
      },
    ],
    ...facts.map((fact) => [
      {
        tag: "text",
        text: `${fact.label}: ${fact.value}`,
      },
    ]),
  ];

  if (payload.operatorUrl) {
    content.push([
      {
        tag: "a",
        text: payload.actionLabel,
        href: payload.operatorUrl,
      },
    ]);
  }

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: getNotificationHeading(payload),
          content,
        },
      },
    },
  };
}

export function buildCallbackRemediationAlertWebhookPayload(payload: Record<string, unknown>) {
  return buildGenericNotificationWebhookPayload(
    "agentExecution.callbackRemediationAlerted",
    payload,
  ) as CallbackRemediationAlertWebhookPayload;
}

export function buildRuntimePressureAlertWebhookPayload(payload: Record<string, unknown>) {
  return buildGenericNotificationWebhookPayload(
    "agentExecution.runtimePressureAlerted",
    payload,
  ) as RuntimePressureAlertWebhookPayload;
}

export function buildGatewayAnomalyIncidentAlertWebhookPayload(payload: Record<string, unknown>) {
  return buildGenericNotificationWebhookPayload(
    "aiGateway.anomalyIncidentAlerted",
    payload,
  ) as GatewayAnomalyIncidentAlertWebhookPayload;
}

export function buildGatewayRemediationEffectivenessAnomalyAlertWebhookPayload(
  payload: Record<string, unknown>,
) {
  return buildGenericNotificationWebhookPayload(
    "aiGateway.remediationEffectivenessAnomalyAlerted",
    payload,
  ) as GatewayRemediationEffectivenessAnomalyAlertWebhookPayload;
}

export function buildGatewayRateLimitHotspotAnomalyAlertWebhookPayload(payload: Record<string, unknown>) {
  return buildGenericNotificationWebhookPayload(
    "aiGateway.rateLimitHotspotAnomalyAlerted",
    payload,
  ) as GatewayRateLimitHotspotAnomalyAlertWebhookPayload;
}

export function buildNotificationWebhookPayload(
  eventName: EventName,
  payload: Record<string, unknown>,
  format: NotificationWebhookFormat = "generic",
): NotificationWebhookPayload | null {
  const genericPayload = buildGenericNotificationWebhookPayload(eventName, payload);
  if (!genericPayload) {
    return null;
  }

  if (format === "slack") {
    return buildSlackWebhookPayload(genericPayload);
  }
  if (format === "discord") {
    return buildDiscordWebhookPayload(genericPayload);
  }
  if (format === "feishu") {
    return buildFeishuWebhookPayload(genericPayload);
  }
  return genericPayload;
}

function buildNotificationWebhookHeaders(
  eventName: EventName,
  body: string,
  target: Pick<NotificationWebhookDeliveryTarget, "authToken" | "signingSecret">,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-neuro-event-name": eventName,
  };

  if (target.authToken) {
    headers.authorization = `Bearer ${target.authToken}`;
  }

  if (target.signingSecret) {
    headers["x-neuro-signature"] = `sha256=${createHmac("sha256", target.signingSecret)
      .update(body)
      .digest("hex")}`;
  }

  return headers;
}

function buildDefaultNotificationWebhookTarget(): NotificationWebhookDeliveryTarget | null {
  if (!env.notificationWebhookUrl) {
    return null;
  }
  return {
    name: notificationWebhookDefaultTargetRouteName,
    url: env.notificationWebhookUrl,
    format: env.notificationWebhookFormat,
    authToken: env.notificationWebhookAuthToken,
    signingSecret: env.notificationWebhookSigningSecret,
    timeoutMs: env.notificationWebhookTimeoutMs,
    routeConfig: null,
  };
}

function buildNotificationWebhookDeliveryConfig(): NotificationWebhookDeliveryConfig {
  return {
    defaultTarget: buildDefaultNotificationWebhookTarget(),
    routes: env.notificationWebhookRoutes,
  };
}

function routeMatchesCallbackRemediationAlert(
  route: NotificationWebhookRouteConfig,
  payload: CallbackRemediationAlertWebhookPayload,
) {
  if (route.minAlertLevel !== null && payload.alertLevel < route.minAlertLevel) {
    return false;
  }
  if (route.maxAlertLevel !== null && payload.alertLevel > route.maxAlertLevel) {
    return false;
  }
  if (route.minCount !== null && payload.count < route.minCount) {
    return false;
  }
  if (route.maxCount !== null && payload.count > route.maxCount) {
    return false;
  }
  if (route.minCandidateCount !== null && payload.candidateCount < route.minCandidateCount) {
    return false;
  }
  if (route.maxCandidateCount !== null && payload.candidateCount > route.maxCandidateCount) {
    return false;
  }
  if (route.policyKeys.length > 0 && (!payload.policyKey || !route.policyKeys.includes(payload.policyKey))) {
    return false;
  }
  if (
    route.reasonCategories.length > 0 &&
    (!payload.reasonCategory || !route.reasonCategories.includes(payload.reasonCategory))
  ) {
    return false;
  }
  if (
    route.reasonDispositions.length > 0 &&
    (!payload.reasonDisposition || !route.reasonDispositions.includes(payload.reasonDisposition))
  ) {
    return false;
  }
  if (
    route.callbackTypes.length > 0 &&
    (!payload.scope.callbackType || !route.callbackTypes.includes(payload.scope.callbackType))
  ) {
    return false;
  }
  return true;
}

function routeMatchesRuntimePressureAlert(
  route: NotificationWebhookRouteConfig,
  payload: RuntimePressureAlertWebhookPayload,
) {
  if (
    route.policyKeys.length > 0 ||
    route.reasonCategories.length > 0 ||
    route.reasonDispositions.length > 0 ||
    route.callbackTypes.length > 0
  ) {
    return false;
  }
  if (route.minAlertLevel !== null && payload.alertLevel < route.minAlertLevel) {
    return false;
  }
  if (route.maxAlertLevel !== null && payload.alertLevel > route.maxAlertLevel) {
    return false;
  }
  if (route.minCount !== null && payload.count < route.minCount) {
    return false;
  }
  if (route.maxCount !== null && payload.count > route.maxCount) {
    return false;
  }
  if (route.minCandidateCount !== null && payload.candidateCount < route.minCandidateCount) {
    return false;
  }
  if (route.maxCandidateCount !== null && payload.candidateCount > route.maxCandidateCount) {
    return false;
  }
  return true;
}

function routeMatchesGatewayAnomalyAlert(
  route: NotificationWebhookRouteConfig,
  payload: GatewayAnomalyIncidentAlertWebhookPayload,
) {
  if (route.callbackTypes.length > 0) {
    return false;
  }
  if (route.minAlertLevel !== null && payload.alertLevel < route.minAlertLevel) {
    return false;
  }
  if (route.maxAlertLevel !== null && payload.alertLevel > route.maxAlertLevel) {
    return false;
  }
  if (route.minCount !== null && payload.count < route.minCount) {
    return false;
  }
  if (route.maxCount !== null && payload.count > route.maxCount) {
    return false;
  }
  if (route.minCandidateCount !== null && payload.candidateCount < route.minCandidateCount) {
    return false;
  }
  if (route.maxCandidateCount !== null && payload.candidateCount > route.maxCandidateCount) {
    return false;
  }
  if (route.policyKeys.length > 0 && (!payload.policyKey || !route.policyKeys.includes(payload.policyKey))) {
    return false;
  }
  if (
    route.reasonCategories.length > 0 &&
    (!payload.reasonCategory || !route.reasonCategories.includes(payload.reasonCategory))
  ) {
    return false;
  }
  if (
    route.reasonDispositions.length > 0 &&
    (!payload.reasonDisposition || !route.reasonDispositions.includes(payload.reasonDisposition))
  ) {
    return false;
  }
  return true;
}

function routeMatchesGatewayRemediationEffectivenessAnomalyAlert(
  route: NotificationWebhookRouteConfig,
  payload: GatewayRemediationEffectivenessAnomalyAlertWebhookPayload,
) {
  if (route.callbackTypes.length > 0) {
    return false;
  }
  if (route.minAlertLevel !== null && payload.alertLevel < route.minAlertLevel) {
    return false;
  }
  if (route.maxAlertLevel !== null && payload.alertLevel > route.maxAlertLevel) {
    return false;
  }
  if (route.minCount !== null && payload.count < route.minCount) {
    return false;
  }
  if (route.maxCount !== null && payload.count > route.maxCount) {
    return false;
  }
  if (route.minCandidateCount !== null && payload.candidateCount < route.minCandidateCount) {
    return false;
  }
  if (route.maxCandidateCount !== null && payload.candidateCount > route.maxCandidateCount) {
    return false;
  }
  if (route.policyKeys.length > 0 && (!payload.policyKey || !route.policyKeys.includes(payload.policyKey))) {
    return false;
  }
  if (
    route.reasonCategories.length > 0 &&
    (!payload.reasonCategory || !route.reasonCategories.includes(payload.reasonCategory))
  ) {
    return false;
  }
  if (
    route.reasonDispositions.length > 0 &&
    (!payload.reasonDisposition || !route.reasonDispositions.includes(payload.reasonDisposition))
  ) {
    return false;
  }
  return true;
}

function routeMatchesGatewayRateLimitHotspotAnomalyAlert(
  route: NotificationWebhookRouteConfig,
  payload: GatewayRateLimitHotspotAnomalyAlertWebhookPayload,
) {
  if (route.callbackTypes.length > 0) {
    return false;
  }
  if (route.minAlertLevel !== null && payload.alertLevel < route.minAlertLevel) {
    return false;
  }
  if (route.maxAlertLevel !== null && payload.alertLevel > route.maxAlertLevel) {
    return false;
  }
  if (route.minCount !== null && payload.count < route.minCount) {
    return false;
  }
  if (route.maxCount !== null && payload.count > route.maxCount) {
    return false;
  }
  if (route.minCandidateCount !== null && payload.candidateCount < route.minCandidateCount) {
    return false;
  }
  if (route.maxCandidateCount !== null && payload.candidateCount > route.maxCandidateCount) {
    return false;
  }
  if (route.policyKeys.length > 0 && (!payload.policyKey || !route.policyKeys.includes(payload.policyKey))) {
    return false;
  }
  if (
    route.reasonCategories.length > 0 &&
    (!payload.reasonCategory || !route.reasonCategories.includes(payload.reasonCategory))
  ) {
    return false;
  }
  if (
    route.reasonDispositions.length > 0 &&
    (!payload.reasonDisposition || !route.reasonDispositions.includes(payload.reasonDisposition))
  ) {
    return false;
  }
  return true;
}

function routeMatchesEvent(
  route: NotificationWebhookRouteConfig,
  eventName: EventName,
  payload: GenericNotificationWebhookPayload | null,
) {
  if (!route.eventNames.includes(eventName)) {
    return false;
  }
  if (eventName === "agentExecution.callbackRemediationAlerted" && payload) {
    return routeMatchesCallbackRemediationAlert(
      route,
      payload as CallbackRemediationAlertWebhookPayload,
    );
  }
  if (eventName === "agentExecution.runtimePressureAlerted" && payload) {
    return routeMatchesRuntimePressureAlert(route, payload as RuntimePressureAlertWebhookPayload);
  }
  if (eventName === "aiGateway.anomalyIncidentAlerted" && payload) {
    return routeMatchesGatewayAnomalyAlert(route, payload as GatewayAnomalyIncidentAlertWebhookPayload);
  }
  if (eventName === "aiGateway.remediationEffectivenessAnomalyAlerted" && payload) {
    return routeMatchesGatewayRemediationEffectivenessAnomalyAlert(
      route,
      payload as GatewayRemediationEffectivenessAnomalyAlertWebhookPayload,
    );
  }
  if (eventName === "aiGateway.rateLimitHotspotAnomalyAlerted" && payload) {
    return routeMatchesGatewayRateLimitHotspotAnomalyAlert(
      route,
      payload as GatewayRateLimitHotspotAnomalyAlertWebhookPayload,
    );
  }
  return true;
}

export function selectNotificationWebhookTargetsForConfig(
  eventName: EventName,
  payload: Record<string, unknown>,
  config: NotificationWebhookDeliveryConfig,
): NotificationWebhookDeliveryTarget[] {
  const genericPayload = buildGenericNotificationWebhookPayload(eventName, payload);
  const matchedRoutes: NotificationWebhookDeliveryTarget[] = [];

  for (const route of config.routes) {
    if (!routeMatchesEvent(route, eventName, genericPayload)) {
      continue;
    }

    matchedRoutes.push({
      name: route.name,
      url: route.url,
      format: route.format,
      authToken: route.authToken,
      signingSecret: route.signingSecret,
      timeoutMs: route.timeoutMs,
      routeConfig: route,
    });

    if (route.stopAfterMatch) {
      break;
    }
  }

  if (matchedRoutes.length > 0) {
    return matchedRoutes;
  }

  return config.defaultTarget ? [config.defaultTarget] : [];
}

export function selectNotificationWebhookTargets(
  eventName: EventName,
  payload: Record<string, unknown>,
): NotificationWebhookDeliveryTarget[] {
  return selectNotificationWebhookTargetsForConfig(
    eventName,
    payload,
    buildNotificationWebhookDeliveryConfig(),
  );
}

export async function sendNotificationWebhook(
  eventName: EventName,
  payload: Record<string, unknown>,
): Promise<{ sent: boolean; skippedReason: string | null }> {
  const config = buildNotificationWebhookDeliveryConfig();
  if (!config.defaultTarget && config.routes.length === 0) {
    return { sent: false, skippedReason: "webhook_disabled" };
  }
  if (!env.notificationWebhookEvents.includes(eventName)) {
    return { sent: false, skippedReason: "event_not_enabled" };
  }

  const targets = selectNotificationWebhookTargetsForConfig(eventName, payload, config);
  if (targets.length === 0) {
    return { sent: false, skippedReason: "route_not_matched" };
  }

  const genericPayload = buildGenericNotificationWebhookPayload(eventName, payload);
  const incidentKey = genericPayload?.alertKey ?? null;
  const referenceTime = new Date();
  let sentCount = 0;
  let lastFailureReason: string | null = null;

  if (incidentKey) {
    await touchNotificationWebhookIncident(incidentKey, referenceTime);
  }

  for (const target of targets) {
    if (incidentKey && target.routeConfig) {
      const routePolicy = await shouldSendNotificationWebhookRoute({
        incidentKey,
        route: target.routeConfig,
        referenceTime,
      });
      if (!routePolicy.allowed) {
        lastFailureReason = routePolicy.reason;
        continue;
      }
    }

    const notificationPayload = buildNotificationWebhookPayload(eventName, payload, target.format);
    if (!notificationPayload) {
      lastFailureReason = "unsupported_event";
      continue;
    }

    const body = JSON.stringify(notificationPayload);
    const headers = buildNotificationWebhookHeaders(eventName, body, target);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), target.timeoutMs);

    try {
      const response = await fetch(target.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(
          `Notification webhook route ${target.name} returned ${response.status} for ${eventName}: ${await response.text().catch(() => "")}`,
        );
        lastFailureReason = `http_${response.status}`;
        continue;
      }

      sentCount += 1;
      if (incidentKey) {
        await markNotificationWebhookRouteDelivered({
          incidentKey,
          routeName: target.routeConfig?.name ?? target.name,
          profileKey: target.routeConfig?.profileKey ?? null,
          format: target.format,
          deliveredAt: referenceTime,
        });
      }
    } catch (error) {
      console.error(`Notification webhook delivery failed for ${eventName} via route ${target.name}`, error);
      lastFailureReason = "delivery_failed";
    } finally {
      clearTimeout(timeout);
    }
  }

  if (sentCount === 0) {
    return { sent: false, skippedReason: lastFailureReason ?? "delivery_failed" };
  }

  return {
    sent: true,
    skippedReason: sentCount < targets.length ? lastFailureReason ?? "partial_delivery" : null,
  };
}
