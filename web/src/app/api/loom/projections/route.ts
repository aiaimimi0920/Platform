import { accountRequest } from "@/lib/account-request";
import { handleLoomProjectionRequest } from "@/lib/loom-projection-handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleLoomProjectionRequest(request, accountRequest);
}
