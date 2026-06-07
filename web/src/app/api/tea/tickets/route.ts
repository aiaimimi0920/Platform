import { createTeaTicket, listTeaTickets } from "@/lib/tea-client";
import { handleCreateTeaTicketRequest, handleListTeaTicketsRequest } from "@/lib/tea-api-handlers";
import { requirePlatformUserContext } from "@/lib/platform-session";

export async function GET(request: Request) {
  return handleListTeaTicketsRequest(request, {
    listTeaTickets,
    requireUserContext: requirePlatformUserContext,
  });
}

export async function POST(request: Request) {
  return handleCreateTeaTicketRequest(request, {
    createTeaTicket,
    requireUserContext: requirePlatformUserContext,
  });
}
