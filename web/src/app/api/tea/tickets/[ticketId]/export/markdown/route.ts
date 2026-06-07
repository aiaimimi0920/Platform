import { exportTeaTicketMarkdown } from "@/lib/tea-client";
import { handleExportTeaTicketMarkdownRequest } from "@/lib/tea-api-handlers";
import { requirePlatformUserContext } from "@/lib/platform-session";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { ticketId } = await context.params;
  return handleExportTeaTicketMarkdownRequest(ticketId, {
    exportTeaTicketMarkdown,
    requireUserContext: requirePlatformUserContext,
  });
}
