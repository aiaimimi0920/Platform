import { accountRequest } from "@/lib/account-request";
import { handleLoomAccountRequest } from "@/lib/loom-account-handlers";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return handleLoomAccountRequest(request, (await context.params).action, accountRequest);
}
