import type { InternalUserContext } from "@neuro/contracts";

export type TeaTicketStatus =
  | "draft"
  | "open"
  | "needs_info"
  | "analyzing"
  | "analysis_ready"
  | "planning"
  | "plan_ready"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "blocked"
  | "failed"
  | "needs_review"
  | "completed"
  | "accepted"
  | "closed"
  | "cancelled";

export type TeaTicketSource = "human" | "hook" | "api" | "system";

export type TeaTicketView = {
  id: string;
  title?: string;
  description?: string;
  source?: TeaTicketSource | string;
  status?: TeaTicketStatus | string;
  priority?: string;
  labels?: string[];
  owner_human_id?: string | null;
  delegated_agent_id?: string | null;
  approval_policy?: string;
  risk_level?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type TeaTicketEventView = {
  id: string;
  ticket_id?: string;
  actor?: unknown;
  kind?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type TeaTicketCommentView = {
  id: string;
  ticket_id?: string;
  actor?: unknown;
  body?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type TeaRunView = {
  id: string;
  ticket_id?: string;
  loom_session_id?: string | null;
  status?: string;
  evidence?: unknown;
  [key: string]: unknown;
};

export type TeaConfigurationSource = "local" | "loom-managed" | "fallback";

export type TeaConfigurationStatusView = {
  owner?: "tea" | "loom" | string;
  local_config_path?: string | null;
  loom_base_url?: string | null;
  loom_panel_url?: string | null;
  reason?: string | null;
  [key: string]: unknown;
};

export type TeaStatusView = {
  service?: string;
  status?: string;
  configuration_source?: TeaConfigurationSource | string;
  configuration?: TeaConfigurationStatusView;
  [key: string]: unknown;
};

export type TeaConfigurationView = {
  configuration_source?: TeaConfigurationSource | string;
  configuration?: TeaConfigurationStatusView;
  config?: unknown;
  [key: string]: unknown;
};

export type UpdateTeaConfigurationInput = {
  notifications_enabled: boolean;
  human_ticket_default_approval_policy: string;
  hook_ticket_default_approval_policy: string;
};

export type TeaTicketListQuery = {
  status?: string | null;
  source?: string | null;
};

export type CreateTeaTicketInput = {
  title: string;
  description: string;
};

export type TeaTicketCommentInput = {
  body: string;
};

export type RejectTeaTicketInput = {
  reason: string;
};

export type TeaWebErrorCode = string | undefined;

export class TeaWebClientError extends Error {
  statusCode: number;
  code: TeaWebErrorCode;
  responseBody: unknown;

  constructor(statusCode: number, message: string, code: TeaWebErrorCode, responseBody: unknown) {
    super(message);
    this.name = "TeaWebClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.responseBody = responseBody;
  }
}

type CoreTeaRequestOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, string | number | boolean | null | undefined>;
  userContext: InternalUserContext;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
} | null;

const noStoreFetchOptions = { cache: "no-store" as RequestCache };

export async function listTeaTickets(
  userContext: InternalUserContext,
  query?: TeaTicketListQuery,
): Promise<TeaTicketView[]> {
  const response = await coreTeaRequest<{ tickets: TeaTicketView[] }>("/internal/tea/tickets", {
    query,
    userContext,
  });
  return Array.isArray(response.tickets) ? response.tickets : [];
}

export async function getTeaStatus(userContext: InternalUserContext): Promise<TeaStatusView> {
  const response = await coreTeaRequest<{ status: TeaStatusView }>("/internal/tea/status", {
    userContext,
  });
  return response.status;
}

export async function getTeaConfiguration(userContext: InternalUserContext): Promise<TeaConfigurationView> {
  const response = await coreTeaRequest<{ configuration: TeaConfigurationView }>("/internal/tea/configuration", {
    userContext,
  });
  return response.configuration;
}

export async function updateTeaConfiguration(
  userContext: InternalUserContext,
  input: UpdateTeaConfigurationInput,
): Promise<TeaConfigurationView> {
  const response = await coreTeaRequest<{ configuration: TeaConfigurationView }>("/internal/tea/configuration", {
    method: "PUT",
    body: input,
    userContext,
  });
  return response.configuration;
}

export async function createTeaTicket(
  userContext: InternalUserContext,
  input: CreateTeaTicketInput,
): Promise<TeaTicketView> {
  const response = await coreTeaRequest<{ ticket: TeaTicketView }>("/internal/tea/tickets", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.ticket;
}

export async function getTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaTicketView> {
  const response = await coreTeaRequest<{ ticket: TeaTicketView }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}`,
    {
      userContext,
    },
  );
  return response.ticket;
}

export async function getTeaTicketEvents(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaTicketEventView[]> {
  const response = await coreTeaRequest<{ events: TeaTicketEventView[] }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/events`,
    {
      userContext,
    },
  );
  return Array.isArray(response.events) ? response.events : [];
}

export async function addTeaTicketComment(
  userContext: InternalUserContext,
  ticketId: string,
  input: TeaTicketCommentInput,
): Promise<TeaTicketCommentView> {
  const response = await coreTeaRequest<{ comment: TeaTicketCommentView }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/comments`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.comment;
}

export async function getTeaTicketComments(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaTicketCommentView[]> {
  const response = await coreTeaRequest<{ comments: TeaTicketCommentView[] }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/comments`,
    {
      userContext,
    },
  );
  return Array.isArray(response.comments) ? response.comments : [];
}

export async function getTeaTicketRuns(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaRunView[]> {
  const response = await coreTeaRequest<{ runs: TeaRunView[] }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/runs`,
    {
      userContext,
    },
  );
  return Array.isArray(response.runs) ? response.runs : [];
}

export async function exportTeaTicketJson(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<unknown> {
  const response = await coreTeaRequest<{ export: unknown }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/export/json`,
    {
      userContext,
    },
  );
  return response.export;
}

export async function exportTeaTicketMarkdown(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<string> {
  const response = await coreTeaRequest<{ markdown: unknown }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/export/markdown`,
    {
      userContext,
    },
  );
  return typeof response.markdown === "string" ? response.markdown : "";
}

export async function analyzeTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<unknown> {
  const response = await coreTeaRequest<{ analysis: unknown }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/analyze`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.analysis;
}

export async function planTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<unknown> {
  const response = await coreTeaRequest<{ plan: unknown }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/plan`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.plan;
}

export async function approveTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaTicketView> {
  return ticketMutation(userContext, ticketId, "approve");
}

export async function rejectTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
  input: RejectTeaTicketInput,
): Promise<TeaTicketView> {
  const response = await coreTeaRequest<{ ticket: TeaTicketView }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/reject`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.ticket;
}

export async function runTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaRunView> {
  const response = await coreTeaRequest<{ run: TeaRunView }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/run`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.run;
}

export async function stopTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaRunView> {
  return runMutation(userContext, ticketId, "stop");
}

export async function retryTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaRunView> {
  return runMutation(userContext, ticketId, "retry");
}

export async function acceptTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaTicketView> {
  return ticketMutation(userContext, ticketId, "accept");
}

export async function closeTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaTicketView> {
  return ticketMutation(userContext, ticketId, "close");
}

export async function cancelTeaTicket(
  userContext: InternalUserContext,
  ticketId: string,
): Promise<TeaTicketView> {
  return ticketMutation(userContext, ticketId, "cancel");
}

async function runMutation(
  userContext: InternalUserContext,
  ticketId: string,
  action: "stop" | "retry",
): Promise<TeaRunView> {
  const response = await coreTeaRequest<{ run: TeaRunView }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/${action}`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.run;
}

async function ticketMutation(
  userContext: InternalUserContext,
  ticketId: string,
  action: "approve" | "accept" | "close" | "cancel",
): Promise<TeaTicketView> {
  const response = await coreTeaRequest<{ ticket: TeaTicketView }>(
    `/internal/tea/tickets/${encodeURIComponent(ticketId)}/${action}`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.ticket;
}

async function coreTeaRequest<T>(pathname: string, options: CoreTeaRequestOptions): Promise<T> {
  const hasJsonBody = options.body !== undefined;
  const headers: Record<string, string> = {
    "x-internal-api-token": process.env.INTERNAL_API_TOKEN || "",
  };

  if (hasJsonBody) {
    headers["content-type"] = "application/json";
  }

  if (options.userContext.userId) {
    headers["x-neuro-user-id"] = options.userContext.userId;
  }
  if (options.userContext.providerUserId) {
    headers["x-neuro-provider-user-id"] = options.userContext.providerUserId;
  }
  if (options.userContext.username) {
    headers["x-neuro-username"] = options.userContext.username;
  }

  const response = await fetch(buildCoreUrl(pathname, options.query), {
    ...noStoreFetchOptions,
    method: options.method ?? "GET",
    headers,
    body: hasJsonBody ? JSON.stringify(options.body) : undefined,
  });

  const responseBody = await parseResponseBody(response);
  if (!response.ok) {
    const apiError = normalizeApiError(responseBody);
    throw new TeaWebClientError(response.status, apiError.message, apiError.code, responseBody);
  }

  return responseBody as T;
}

function buildCoreUrl(
  pathname: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  const baseUrl = (process.env.CORE_INTERNAL_URL || "http://127.0.0.1:4000").replace(/\/+$/, "");
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function normalizeApiError(responseBody: unknown): { code: TeaWebErrorCode; message: string } {
  if (isRecord(responseBody)) {
    const nestedError = responseBody.error;
    if (isRecord(nestedError)) {
      return {
        code: typeof nestedError.code === "string" ? nestedError.code : undefined,
        message:
          typeof nestedError.message === "string" && nestedError.message.length > 0
            ? nestedError.message
            : "Tea request failed",
      };
    }
    return {
      code: typeof responseBody.code === "string" ? responseBody.code : undefined,
      message:
        typeof responseBody.message === "string" && responseBody.message.length > 0
          ? responseBody.message
          : "Tea request failed",
    };
  }

  if (typeof responseBody === "string" && responseBody.length > 0) {
    return { code: undefined, message: responseBody };
  }

  return { code: undefined, message: "Tea request failed" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
