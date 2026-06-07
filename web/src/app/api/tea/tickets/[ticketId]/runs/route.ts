import { getTeaTicketRuns } from "@/lib/tea-client";
import { handleGetTeaTicketRunsRequest } from "@/lib/tea-api-handlers";
import { requirePlatformUserContext } from "@/lib/platform-session";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { ticketId } = await context.params;
  return handleGetTeaTicketRunsRequest(ticketId, {
    getTeaTicketRuns,
    requireUserContext: requirePlatformUserContext,
  });
}
