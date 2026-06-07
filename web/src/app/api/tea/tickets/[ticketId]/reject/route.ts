import { rejectTeaTicket } from "@/lib/tea-client";
import { handleRejectTeaTicketRequest } from "@/lib/tea-api-handlers";
import { requirePlatformUserContext } from "@/lib/platform-session";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { ticketId } = await context.params;
  return handleRejectTeaTicketRequest(ticketId, request, {
    rejectTeaTicket,
    requireUserContext: requirePlatformUserContext,
  });
}
