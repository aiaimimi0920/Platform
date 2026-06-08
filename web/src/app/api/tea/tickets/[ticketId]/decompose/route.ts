import { decomposeTeaTicket } from "@/lib/tea-client";
import { handleDecomposeTeaTicketRequest } from "@/lib/tea-api-handlers";
import { requirePlatformUserContext } from "@/lib/platform-session";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { ticketId } = await context.params;
  return handleDecomposeTeaTicketRequest(ticketId, {
    decomposeTeaTicket,
    requireUserContext: requirePlatformUserContext,
  });
}
