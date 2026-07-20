import { handleHeavyChatSendMessageRequest } from "@/features/account-heavy-agent-chat/server";

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await context.params;
  return handleHeavyChatSendMessageRequest(threadId, request);
}
