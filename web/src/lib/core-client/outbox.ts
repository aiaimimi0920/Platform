import {
  type OutboxRetryBatchResult,
  type OutboxEventStatus,
  type OutboxEventView,
  type OutboxRetryAttemptView,
  type OutboxAlertDispatchResult,
  type OutboxSummaryView,
  type InternalUserContext,
} from "@neuro/contracts";

import { coreRequest } from "./request";

export type OutboxQueryArgs = {
  status?: OutboxEventStatus;
  eventName?: string;
  limit?: number;
};

export async function listOutboxEvents(userContext: InternalUserContext, args?: OutboxQueryArgs) {
  const params = new URLSearchParams();
  if (args?.status) {
    params.set("status", args.status);
  }
  if (args?.eventName) {
    params.set("eventName", args.eventName);
  }
  if (args?.limit) {
    params.set("limit", String(args.limit));
  }

  const query = params.toString();
  const response = await coreRequest<{ events: OutboxEventView[] }>(
    `/v1/internal/outbox-events${query ? `?${query}` : ""}`,
    {
      userContext,
    },
  );
  return response.events;
}

export async function getOutboxSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: OutboxSummaryView }>("/v1/internal/outbox-events/summary", {
    userContext,
  });
  return response.summary;
}

export async function listOutboxRetryAttempts(userContext: InternalUserContext, limit = 25) {
  const response = await coreRequest<{ retries: OutboxRetryAttemptView[] }>(
    `/v1/internal/outbox-events/retries?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.retries;
}

export async function retryOutboxEvent(userContext: InternalUserContext, eventId: string) {
  const response = await coreRequest<{ event: OutboxEventView }>(`/v1/internal/outbox-events/${encodeURIComponent(
    eventId,
  )}/retry`, {
    method: "POST",
    userContext,
  });
  return response.event;
}

export async function retryOutboxEventsBatch(
  userContext: InternalUserContext,
  input: {
    limit?: number;
    eventName?: string;
  },
) {
  const response = await coreRequest<{ result: OutboxRetryBatchResult }>("/v1/internal/outbox-events/retry-batch", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.result;
}

export async function emitOutboxAlerts(
  userContext: InternalUserContext,
  input?: {
    limit?: number;
    minimumAlertLevel?: number;
  },
) {
  const response = await coreRequest<{ result: OutboxAlertDispatchResult }>("/v1/internal/outbox-events/emit-alerts", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
  return response.result;
}
