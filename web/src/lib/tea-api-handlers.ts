import type { InternalUserContext } from "@neuro/contracts";

import type {
  CreateTeaTicketInput,
  EditTeaTicketInput,
  RejectTeaTicketInput,
  TeaRunView,
  TeaTicketCommentInput,
  TeaTicketCommentView,
  TeaTicketEventView,
  TeaTicketListQuery,
  TeaTicketView,
} from "./tea-client";
import {
  parseCreateTeaTicketPayload,
  parseEditTeaTicketPayload,
  parseTeaCommentPayload,
  parseTeaRejectPayload,
  readJsonObject,
  teaJson,
  teaRouteErrorResponse,
} from "./tea-route-utils";

type RequireUserContext = () => Promise<InternalUserContext>;

export type ListTeaTicketsHandlerDeps = {
  listTeaTickets: (
    userContext: InternalUserContext,
    query?: TeaTicketListQuery,
  ) => Promise<TeaTicketView[]>;
  requireUserContext: RequireUserContext;
};

export type CreateTeaTicketHandlerDeps = {
  createTeaTicket: (
    userContext: InternalUserContext,
    input: CreateTeaTicketInput,
  ) => Promise<TeaTicketView>;
  requireUserContext: RequireUserContext;
};

export type EditTeaTicketHandlerDeps = {
  editTeaTicket: (
    userContext: InternalUserContext,
    ticketId: string,
    input: EditTeaTicketInput,
  ) => Promise<TeaTicketView>;
  requireUserContext: RequireUserContext;
};

export type GetTeaTicketHandlerDeps = {
  getTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<TeaTicketView>;
  getTeaTicketComments: (
    userContext: InternalUserContext,
    ticketId: string,
  ) => Promise<TeaTicketCommentView[]>;
  getTeaTicketEvents: (
    userContext: InternalUserContext,
    ticketId: string,
  ) => Promise<TeaTicketEventView[]>;
  requireUserContext: RequireUserContext;
};

export type GetTeaTicketCommentsHandlerDeps = {
  getTeaTicketComments: (
    userContext: InternalUserContext,
    ticketId: string,
  ) => Promise<TeaTicketCommentView[]>;
  requireUserContext: RequireUserContext;
};

export type AddTeaTicketCommentHandlerDeps = {
  addTeaTicketComment: (
    userContext: InternalUserContext,
    ticketId: string,
    input: TeaTicketCommentInput,
  ) => Promise<TeaTicketCommentView>;
  requireUserContext: RequireUserContext;
};

export type GetTeaTicketRunsHandlerDeps = {
  getTeaTicketRuns: (userContext: InternalUserContext, ticketId: string) => Promise<TeaRunView[]>;
  requireUserContext: RequireUserContext;
};

export type ExportTeaTicketJsonHandlerDeps = {
  exportTeaTicketJson: (userContext: InternalUserContext, ticketId: string) => Promise<unknown>;
  requireUserContext: RequireUserContext;
};

export type ExportTeaTicketMarkdownHandlerDeps = {
  exportTeaTicketMarkdown: (userContext: InternalUserContext, ticketId: string) => Promise<string>;
  requireUserContext: RequireUserContext;
};

export type AnalyzeTeaTicketHandlerDeps = {
  analyzeTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<unknown>;
  requireUserContext: RequireUserContext;
};

export type DecomposeTeaTicketHandlerDeps = {
  decomposeTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<unknown>;
  requireUserContext: RequireUserContext;
};

export type PlanTeaTicketHandlerDeps = {
  planTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<unknown>;
  requireUserContext: RequireUserContext;
};

export type ApproveTeaTicketHandlerDeps = {
  approveTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<TeaTicketView>;
  requireUserContext: RequireUserContext;
};

export type RejectTeaTicketHandlerDeps = {
  rejectTeaTicket: (
    userContext: InternalUserContext,
    ticketId: string,
    input: RejectTeaTicketInput,
  ) => Promise<TeaTicketView>;
  requireUserContext: RequireUserContext;
};

export type RunTeaTicketHandlerDeps = {
  runTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<TeaRunView>;
  requireUserContext: RequireUserContext;
};

export type StopTeaTicketHandlerDeps = {
  stopTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<TeaRunView>;
  requireUserContext: RequireUserContext;
};

export type RetryTeaTicketHandlerDeps = {
  retryTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<TeaRunView>;
  requireUserContext: RequireUserContext;
};

export type AcceptTeaTicketHandlerDeps = {
  acceptTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<TeaTicketView>;
  requireUserContext: RequireUserContext;
};

export type CloseTeaTicketHandlerDeps = {
  closeTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<TeaTicketView>;
  requireUserContext: RequireUserContext;
};

export type CancelTeaTicketHandlerDeps = {
  cancelTeaTicket: (userContext: InternalUserContext, ticketId: string) => Promise<TeaTicketView>;
  requireUserContext: RequireUserContext;
};

export async function handleListTeaTicketsRequest(
  request: Request,
  deps: ListTeaTicketsHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const url = new URL(request.url);
    const tickets = await deps.listTeaTickets(userContext, {
      source: url.searchParams.get("source"),
      status: url.searchParams.get("status"),
    });
    return teaJson({ tickets });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea tickets unavailable");
  }
}

export async function handleCreateTeaTicketRequest(
  request: Request,
  deps: CreateTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const payload = parseCreateTeaTicketPayload(await readJsonObject(request));
    const ticket = await deps.createTeaTicket(userContext, payload);
    return teaJson({ ticket }, 201);
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket creation failed");
  }
}

export async function handleEditTeaTicketRequest(
  ticketId: string,
  request: Request,
  deps: EditTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const payload = parseEditTeaTicketPayload(await readJsonObject(request));
    const ticket = await deps.editTeaTicket(userContext, ticketId, payload);
    return teaJson({ ticket });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket edit failed");
  }
}

export async function handleGetTeaTicketRequest(
  ticketId: string,
  deps: GetTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const [ticket, comments, events] = await Promise.all([
      deps.getTeaTicket(userContext, ticketId),
      deps.getTeaTicketComments(userContext, ticketId),
      deps.getTeaTicketEvents(userContext, ticketId),
    ]);
    return teaJson({ ticket, comments, events });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket unavailable");
  }
}

export async function handleGetTeaTicketCommentsRequest(
  ticketId: string,
  deps: GetTeaTicketCommentsHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const comments = await deps.getTeaTicketComments(userContext, ticketId);
    return teaJson({ comments });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket comments unavailable");
  }
}

export async function handleAddTeaTicketCommentRequest(
  ticketId: string,
  request: Request,
  deps: AddTeaTicketCommentHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const payload = parseTeaCommentPayload(await readJsonObject(request));
    const comment = await deps.addTeaTicketComment(userContext, ticketId, payload);
    return teaJson({ comment }, 201);
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket comment failed");
  }
}

export async function handleGetTeaTicketRunsRequest(
  ticketId: string,
  deps: GetTeaTicketRunsHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const runs = await deps.getTeaTicketRuns(userContext, ticketId);
    return teaJson({ runs });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket runs unavailable");
  }
}

export async function handleExportTeaTicketJsonRequest(
  ticketId: string,
  deps: ExportTeaTicketJsonHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const exported = await deps.exportTeaTicketJson(userContext, ticketId);
    return teaJson({ export: exported });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket JSON export unavailable");
  }
}

export async function handleExportTeaTicketMarkdownRequest(
  ticketId: string,
  deps: ExportTeaTicketMarkdownHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const markdown = await deps.exportTeaTicketMarkdown(userContext, ticketId);
    return teaJson({ markdown });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket Markdown export unavailable");
  }
}

export async function handleDownloadTeaTicketJsonRequest(
  ticketId: string,
  deps: ExportTeaTicketJsonHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const exported = await deps.exportTeaTicketJson(userContext, ticketId);
    return teaDownload(JSON.stringify(exported, null, 2), ticketId, "json", "application/json; charset=utf-8");
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket JSON download unavailable");
  }
}

export async function handleDownloadTeaTicketMarkdownRequest(
  ticketId: string,
  deps: ExportTeaTicketMarkdownHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const markdown = await deps.exportTeaTicketMarkdown(userContext, ticketId);
    return teaDownload(markdown, ticketId, "md", "text/markdown; charset=utf-8");
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket Markdown download unavailable");
  }
}

export async function handleAnalyzeTeaTicketRequest(
  ticketId: string,
  deps: AnalyzeTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const analysis = await deps.analyzeTeaTicket(userContext, ticketId);
    return teaJson({ analysis });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket analysis failed");
  }
}

export async function handleDecomposeTeaTicketRequest(
  ticketId: string,
  deps: DecomposeTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const decomposition = await deps.decomposeTeaTicket(userContext, ticketId);
    return teaJson({ decomposition });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket decomposition failed");
  }
}

export async function handlePlanTeaTicketRequest(
  ticketId: string,
  deps: PlanTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const plan = await deps.planTeaTicket(userContext, ticketId);
    return teaJson({ plan });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket planning failed");
  }
}

export async function handleApproveTeaTicketRequest(
  ticketId: string,
  deps: ApproveTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const ticket = await deps.approveTeaTicket(userContext, ticketId);
    return teaJson({ ticket });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket approval failed");
  }
}

export async function handleRejectTeaTicketRequest(
  ticketId: string,
  request: Request,
  deps: RejectTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const payload = parseTeaRejectPayload(await readJsonObject(request));
    const ticket = await deps.rejectTeaTicket(userContext, ticketId, payload);
    return teaJson({ ticket });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket rejection failed");
  }
}

export async function handleRunTeaTicketRequest(
  ticketId: string,
  deps: RunTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const run = await deps.runTeaTicket(userContext, ticketId);
    return teaJson({ run });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket run failed");
  }
}

export async function handleStopTeaTicketRequest(
  ticketId: string,
  deps: StopTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const run = await deps.stopTeaTicket(userContext, ticketId);
    return teaJson({ run });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket stop failed");
  }
}

export async function handleRetryTeaTicketRequest(
  ticketId: string,
  deps: RetryTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const run = await deps.retryTeaTicket(userContext, ticketId);
    return teaJson({ run });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket retry failed");
  }
}

export async function handleAcceptTeaTicketRequest(
  ticketId: string,
  deps: AcceptTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const ticket = await deps.acceptTeaTicket(userContext, ticketId);
    return teaJson({ ticket });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket accept failed");
  }
}

function teaDownload(body: string, ticketId: string, extension: "json" | "md", contentType: string): Response {
  return new Response(body, {
    headers: {
      "cache-control": "no-store, no-cache, must-revalidate",
      "content-disposition": `attachment; filename="${exportFilename(ticketId, extension)}"`,
      "content-type": contentType,
    },
    status: 200,
  });
}

function exportFilename(ticketId: string, extension: "json" | "md"): string {
  const safeTicketId = ticketId.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "ticket";
  return `tea-ticket-${safeTicketId}.${extension}`;
}

export async function handleCloseTeaTicketRequest(
  ticketId: string,
  deps: CloseTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const ticket = await deps.closeTeaTicket(userContext, ticketId);
    return teaJson({ ticket });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket close failed");
  }
}

export async function handleCancelTeaTicketRequest(
  ticketId: string,
  deps: CancelTeaTicketHandlerDeps,
): Promise<Response> {
  try {
    const userContext = await deps.requireUserContext();
    const ticket = await deps.cancelTeaTicket(userContext, ticketId);
    return teaJson({ ticket });
  } catch (error) {
    return teaRouteErrorResponse(error, "Tea ticket cancel failed");
  }
}
