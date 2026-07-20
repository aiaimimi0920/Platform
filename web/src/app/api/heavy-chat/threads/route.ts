import { handleHeavyChatCreateThreadRequest } from "@/features/account-heavy-agent-chat/server";

export async function POST(request: Request) {
  return handleHeavyChatCreateThreadRequest(request);
}
