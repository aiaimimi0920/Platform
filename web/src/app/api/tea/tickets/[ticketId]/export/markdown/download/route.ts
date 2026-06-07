import { exportTeaTicketMarkdown } from "@/lib/tea-client";
import { handleDownloadTeaTicketMarkdownRequest } from "@/lib/tea-api-handlers";
import { requirePlatformUserContext } from "@/lib/platform-session";

type RouteContext = {
  params: Promise<{
    ticketId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { ticketId } = await context.params;
  return handleDownloadTeaTicketMarkdownRequest(ticketId, {
    exportTeaTicketMarkdown,
    requireUserContext: requirePlatformUserContext,
  });
}
