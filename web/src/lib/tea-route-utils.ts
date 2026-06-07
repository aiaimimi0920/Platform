import {
  TeaWebClientError,
  type CreateTeaTicketInput,
  type RejectTeaTicketInput,
  type TeaTicketCommentInput,
} from "./tea-client";

const noStoreHeaders = {
  "cache-control": "no-store, no-cache, must-revalidate",
};

export class TeaRouteInputError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "TeaRouteInputError";
  }
}

export function teaJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

export function parseCreateTeaTicketPayload(payload: unknown): CreateTeaTicketInput {
  if (!isRecord(payload)) {
    throw new TeaRouteInputError("Tea ticket payload must be a JSON object.");
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";

  if (title.length < 3) {
    throw new TeaRouteInputError("Tea ticket title must contain at least 3 characters.");
  }

  if (description.length < 10) {
    throw new TeaRouteInputError("Tea ticket description must contain at least 10 characters.");
  }

  return { title, description };
}

export function parseTeaCommentPayload(payload: unknown): TeaTicketCommentInput {
  if (!isRecord(payload)) {
    throw new TeaRouteInputError("Tea comment payload must be a JSON object.");
  }

  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (body.length < 1) {
    throw new TeaRouteInputError("Tea comment body must contain at least 1 character.");
  }

  return { body };
}

export function parseTeaRejectPayload(payload: unknown): RejectTeaTicketInput {
  if (!isRecord(payload)) {
    throw new TeaRouteInputError("Tea rejection payload must be a JSON object.");
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (reason.length < 1) {
    throw new TeaRouteInputError("Tea rejection reason must contain at least 1 character.");
  }

  return { reason };
}

export function teaRouteErrorResponse(error: unknown, fallbackMessage: string): Response {
  if (error instanceof TeaWebClientError) {
    return teaJson(
      {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      },
      error.statusCode,
    );
  }

  if (error instanceof TeaRouteInputError) {
    return teaJson({ error: error.message }, error.statusCode);
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return teaJson(
    { error: message },
    message === "Authentication required" ? 401 : 503,
  );
}

export async function readJsonObject(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TeaRouteInputError("Request body must be valid JSON.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
