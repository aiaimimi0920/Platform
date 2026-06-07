import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { BadRequestError } from "../../platform/errors";
import { withInternalRequest } from "../../platform/internal-auth";
import type { TeaClient } from "./client";
import { getDefaultTeaClient, toPlatformTeaError } from "./service";

const listTicketsQuerySchema = z.object({
  status: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
});

const createTicketSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
});

const commentTicketSchema = z.object({
  body: z.string().min(1),
});

const rejectTicketSchema = z.object({
  reason: z.string().min(1),
});

type TeaRouterOptions = {
  client?: TeaClient;
};

export function createTeaRouter(options: TeaRouterOptions = {}): FastifyPluginAsync {
  return async (app) => {
    const getClient = () => options.client ?? getDefaultTeaClient();

    app.get("/internal/tea/status", { preHandler: withInternalRequest }, async () => {
      return {
        status: await callTea(() => getClient().getStatus()),
      };
    });

    app.get<{ Querystring: z.infer<typeof listTicketsQuerySchema> }>(
      "/internal/tea/tickets",
      { preHandler: withInternalRequest },
      async (request) => {
        const query = parseRequest(listTicketsQuerySchema, request.query);
        return {
          tickets: await callTea(() => getClient().listTickets(query)),
        };
      },
    );

    app.post<{ Body: z.infer<typeof createTicketSchema> }>(
      "/internal/tea/tickets",
      { preHandler: withInternalRequest },
      async (request) => {
        const payload = parseRequest(createTicketSchema, request.body);
        return {
          ticket: await callTea(() => getClient().createTicket(payload)),
        };
      },
    );

    app.get<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId",
      { preHandler: withInternalRequest },
      async (request) => ({
        ticket: await callTea(() => getClient().getTicket(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string }; Body: z.infer<typeof commentTicketSchema> }>(
      "/internal/tea/tickets/:ticketId/comments",
      { preHandler: withInternalRequest },
      async (request) => {
        const payload = parseRequest(commentTicketSchema, request.body);
        return {
          comment: await callTea(() => getClient().addComment(request.params.ticketId, payload)),
        };
      },
    );

    app.get<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/events",
      { preHandler: withInternalRequest },
      async (request) => ({
        events: await callTea(() => getClient().getTicketEvents(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/analyze",
      { preHandler: withInternalRequest },
      async (request) => ({
        analysis: await callTea(() => getClient().analyzeTicket(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/plan",
      { preHandler: withInternalRequest },
      async (request) => ({
        plan: await callTea(() => getClient().planTicket(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/approve",
      { preHandler: withInternalRequest },
      async (request) => ({
        ticket: await callTea(() => getClient().approveTicket(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string }; Body: z.infer<typeof rejectTicketSchema> }>(
      "/internal/tea/tickets/:ticketId/reject",
      { preHandler: withInternalRequest },
      async (request) => {
        const payload = parseRequest(rejectTicketSchema, request.body);
        return {
          ticket: await callTea(() => getClient().rejectTicket(request.params.ticketId, payload)),
        };
      },
    );

    app.post<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/run",
      { preHandler: withInternalRequest },
      async (request) => ({
        run: await callTea(() => getClient().runTicket(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/stop",
      { preHandler: withInternalRequest },
      async (request) => ({
        run: await callTea(() => getClient().stopLatestRun(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/retry",
      { preHandler: withInternalRequest },
      async (request) => ({
        run: await callTea(() => getClient().retryLatestRun(request.params.ticketId)),
      }),
    );

    app.get<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/runs",
      { preHandler: withInternalRequest },
      async (request) => ({
        runs: await callTea(() => getClient().listRuns(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/accept",
      { preHandler: withInternalRequest },
      async (request) => ({
        ticket: await callTea(() => getClient().acceptTicket(request.params.ticketId)),
      }),
    );

    app.post<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/close",
      { preHandler: withInternalRequest },
      async (request) => ({
        ticket: await callTea(() => getClient().closeTicket(request.params.ticketId)),
      }),
    );

    app.get<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/export/json",
      { preHandler: withInternalRequest },
      async (request) => ({
        export: await callTea(() => getClient().exportTicketJson(request.params.ticketId)),
      }),
    );

    app.get<{ Params: { ticketId: string } }>(
      "/internal/tea/tickets/:ticketId/export/markdown",
      { preHandler: withInternalRequest },
      async (request) => {
        const markdown = await callTea(() => getClient().exportTicketMarkdown(request.params.ticketId));
        if (typeof markdown !== "string") {
          throw new BadRequestError("Tea markdown export returned a non-text response");
        }
        return { markdown };
      },
    );
  };
}

export const teaRouter = createTeaRouter();

async function callTea<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toPlatformTeaError(error);
  }
}

function parseRequest<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}
