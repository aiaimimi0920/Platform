export type TeaJson = unknown;

export type TeaQuery = Record<string, string | number | boolean | null | undefined>;

export type TeaFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type TeaClientConfig = {
  baseUrl: string;
  authToken: string | null;
  fetchFn?: TeaFetch;
};

export type CreateTeaTicketRequest = {
  title: string;
  description: string;
};

export type RejectTeaTicketRequest = {
  reason: string;
};

export type AddTeaTicketCommentRequest = {
  body: string;
};

export type UpdateTeaConfigurationRequest = {
  notifications_enabled: boolean;
  human_ticket_default_approval_policy: string;
  hook_ticket_default_approval_policy: string;
};

export class TeaUpstreamError extends Error {
  statusCode: number;
  responseBody: unknown;

  constructor(statusCode: number, message: string, responseBody: unknown) {
    super(message);
    this.name = "TeaUpstreamError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export type TeaClient = ReturnType<typeof createTeaClient>;

export function createTeaClient(config: TeaClientConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const fetchFn = config.fetchFn ?? fetch;

  async function request(path: string, options: { method?: string; query?: TeaQuery; body?: unknown } = {}) {
    const url = buildUrl(baseUrl, path, options.query);
    const headers: Record<string, string> = {};
    if (config.authToken) {
      headers.authorization = `Bearer ${config.authToken}`;
    }

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
    };

    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    const response = await fetchFn(url, init);
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      throw new TeaUpstreamError(response.status, extractErrorMessage(responseBody, response.status), responseBody);
    }

    return responseBody;
  }

  return {
    getStatus: () => request("/v1/status"),
    getConfiguration: () => request("/v1/configuration"),
    updateConfiguration: (body: UpdateTeaConfigurationRequest) =>
      request("/v1/configuration", { method: "PUT", body }),
    listTickets: (query?: TeaQuery) => request("/v1/tickets", { query }),
    createTicket: (body: CreateTeaTicketRequest) => request("/v1/tickets", { method: "POST", body }),
    getTicket: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}`),
    addComment: (ticketId: string, body: AddTeaTicketCommentRequest) =>
      request(`/v1/tickets/${encodeURIComponent(ticketId)}/comments`, { method: "POST", body }),
    listComments: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/comments`),
    getTicketEvents: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/events`),
    analyzeTicket: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/analyze`, { method: "POST" }),
    planTicket: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/plan`, { method: "POST" }),
    approveTicket: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/approve`, { method: "POST" }),
    rejectTicket: (ticketId: string, body: RejectTeaTicketRequest) =>
      request(`/v1/tickets/${encodeURIComponent(ticketId)}/reject`, { method: "POST", body }),
    runTicket: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/run`, { method: "POST" }),
    stopLatestRun: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/stop`, { method: "POST" }),
    retryLatestRun: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/retry`, { method: "POST" }),
    listRuns: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/runs`),
    acceptTicket: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/accept`, { method: "POST" }),
    closeTicket: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/close`, { method: "POST" }),
    exportTicketJson: (ticketId: string) => request(`/v1/tickets/${encodeURIComponent(ticketId)}/export/json`),
    exportTicketMarkdown: (ticketId: string) =>
      request(`/v1/tickets/${encodeURIComponent(ticketId)}/export/markdown`),
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error("Tea base URL is required");
  }
  return trimmed.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string, query?: TeaQuery): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function extractErrorMessage(responseBody: unknown, statusCode: number): string {
  if (isRecord(responseBody)) {
    if (typeof responseBody.error === "string" && responseBody.error.length > 0) {
      return responseBody.error;
    }
    if (typeof responseBody.message === "string" && responseBody.message.length > 0) {
      return responseBody.message;
    }
  }
  if (typeof responseBody === "string" && responseBody.length > 0) {
    return responseBody;
  }
  return `Tea request failed with status ${statusCode}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
