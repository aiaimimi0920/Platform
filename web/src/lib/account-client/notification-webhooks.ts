import type {
  InternalUserContext,
  NotificationWebhookIncidentBatchActionResult,
  NotificationWebhookCatalogView,
  NotificationWebhookIncidentControlResult,
  NotificationWebhookIncidentListView,
  NotificationWebhookIncidentSavedView,
  CreateNotificationWebhookIncidentSavedViewInput,
  ListNotificationWebhookIncidentSavedViewsInput,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function getOperatorNotificationWebhookCatalog(userContext: InternalUserContext) {
  const response = await accountRequest<{ catalog: NotificationWebhookCatalogView }>(
    "/v1/internal/notification-webhooks/catalog",
    {
      userContext,
    },
  );
  return response.catalog;
}

export async function listOperatorNotificationWebhookIncidentSavedViews(
  userContext: InternalUserContext,
  input?: ListNotificationWebhookIncidentSavedViewsInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/notification-webhooks/incidents/views?${params.toString()}`
    : "/v1/internal/notification-webhooks/incidents/views";
  const response = await accountRequest<{ views: NotificationWebhookIncidentSavedView[] }>(pathname, {
    userContext,
  });
  return response.views;
}

export async function getOperatorDefaultNotificationWebhookIncidentSavedView(userContext: InternalUserContext) {
  const response = await accountRequest<{ view: NotificationWebhookIncidentSavedView | null }>(
    "/v1/internal/notification-webhooks/incidents/views/default",
    {
      userContext,
    },
  );
  return response.view;
}

export async function createOperatorNotificationWebhookIncidentSavedView(
  userContext: InternalUserContext,
  input: CreateNotificationWebhookIncidentSavedViewInput,
) {
  const response = await accountRequest<{ view: NotificationWebhookIncidentSavedView }>(
    "/v1/internal/notification-webhooks/incidents/views",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.view;
}

export async function setOperatorDefaultNotificationWebhookIncidentSavedView(
  userContext: InternalUserContext,
  viewId: string,
) {
  const response = await accountRequest<{ view: NotificationWebhookIncidentSavedView }>(
    `/v1/internal/notification-webhooks/incidents/views/${encodeURIComponent(viewId)}/default`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.view;
}

export async function updateOperatorNotificationWebhookIncidentSavedView(
  userContext: InternalUserContext,
  viewId: string,
  input: CreateNotificationWebhookIncidentSavedViewInput,
) {
  const response = await accountRequest<{ view: NotificationWebhookIncidentSavedView }>(
    `/v1/internal/notification-webhooks/incidents/views/${encodeURIComponent(viewId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.view;
}

export async function deleteOperatorNotificationWebhookIncidentSavedView(
  userContext: InternalUserContext,
  viewId: string,
) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/notification-webhooks/incidents/views/${encodeURIComponent(viewId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function listOperatorNotificationWebhookIncidents(
  userContext: InternalUserContext,
  options?: {
    limit?: number;
    historyLimit?: number;
    agentId?: string;
    callbackType?: string;
    policyKey?: string;
    reasonCategory?: string;
    reasonDisposition?: string;
    alertLevel?: number;
    governanceState?: "active" | "acknowledged" | "silenced";
    projectId?: string;
    incidentId?: string;
    routePolicyId?: string;
    snapshotId?: string;
  },
) {
  const params = new URLSearchParams();
  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(options.limit))));
  }
  if (typeof options?.historyLimit === "number" && Number.isFinite(options.historyLimit)) {
    params.set("historyLimit", String(Math.max(1, Math.floor(options.historyLimit))));
  }
  if (options?.agentId) params.set("agentId", options.agentId);
  if (options?.callbackType) params.set("callbackType", options.callbackType);
  if (options?.policyKey) params.set("policyKey", options.policyKey);
  if (options?.reasonCategory) params.set("reasonCategory", options.reasonCategory);
  if (options?.reasonDisposition) params.set("reasonDisposition", options.reasonDisposition);
  if (typeof options?.alertLevel === "number" && Number.isFinite(options.alertLevel) && options.alertLevel > 0) {
    params.set("alertLevel", String(Math.floor(options.alertLevel)));
  }
  if (options?.governanceState) params.set("governanceState", options.governanceState);
  if (options?.projectId) params.set("projectId", options.projectId);
  if (options?.incidentId) params.set("incidentId", options.incidentId);
  if (options?.routePolicyId) params.set("routePolicyId", options.routePolicyId);
  if (options?.snapshotId) params.set("snapshotId", options.snapshotId);

  const pathname = params.size
    ? `/v1/internal/notification-webhooks/incidents?${params.toString()}`
    : "/v1/internal/notification-webhooks/incidents";
  const response = await accountRequest<{ incidents: NotificationWebhookIncidentListView }>(pathname, {
    userContext,
  });
  return response.incidents;
}

export async function acknowledgeOperatorNotificationWebhookIncident(
  userContext: InternalUserContext,
  incidentKey: string,
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentControlResult }>(
    `/v1/internal/notification-webhooks/incidents/${encodeURIComponent(incidentKey)}/acknowledge`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function silenceOperatorNotificationWebhookIncident(
  userContext: InternalUserContext,
  incidentKey: string,
  input: {
    durationMinutes: number;
    reason?: string | null;
  },
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentControlResult }>(
    `/v1/internal/notification-webhooks/incidents/${encodeURIComponent(incidentKey)}/silence`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function clearOperatorNotificationWebhookIncidentSilence(
  userContext: InternalUserContext,
  incidentKey: string,
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentControlResult }>(
    `/v1/internal/notification-webhooks/incidents/${encodeURIComponent(incidentKey)}/clear-silence`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function acknowledgeOperatorNotificationWebhookIncidentsBatch(
  userContext: InternalUserContext,
  input: {
    limit: number;
    agentId?: string | null;
    callbackType?: string | null;
    policyKey?: string | null;
    reasonCategory?: string | null;
    reasonDisposition?: string | null;
    alertLevel?: number | null;
    governanceState?: "active" | "acknowledged" | "silenced" | null;
    projectId?: string | null;
    incidentId?: string | null;
    routePolicyId?: string | null;
    snapshotId?: string | null;
  },
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentBatchActionResult }>(
    "/v1/internal/notification-webhooks/incidents/acknowledge-batch",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function silenceOperatorNotificationWebhookIncidentsBatch(
  userContext: InternalUserContext,
  input: {
    limit: number;
    durationMinutes: number;
    reason?: string | null;
    agentId?: string | null;
    callbackType?: string | null;
    policyKey?: string | null;
    reasonCategory?: string | null;
    reasonDisposition?: string | null;
    alertLevel?: number | null;
    governanceState?: "active" | "acknowledged" | "silenced" | null;
    projectId?: string | null;
    incidentId?: string | null;
    routePolicyId?: string | null;
    snapshotId?: string | null;
  },
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentBatchActionResult }>(
    "/v1/internal/notification-webhooks/incidents/silence-batch",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function clearOperatorNotificationWebhookIncidentSilencesBatch(
  userContext: InternalUserContext,
  input: {
    limit: number;
    agentId?: string | null;
    callbackType?: string | null;
    policyKey?: string | null;
    reasonCategory?: string | null;
    reasonDisposition?: string | null;
    alertLevel?: number | null;
    governanceState?: "active" | "acknowledged" | "silenced" | null;
    projectId?: string | null;
    incidentId?: string | null;
    routePolicyId?: string | null;
    snapshotId?: string | null;
  },
) {
  const response = await accountRequest<{ result: NotificationWebhookIncidentBatchActionResult }>(
    "/v1/internal/notification-webhooks/incidents/clear-silence-batch",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}
