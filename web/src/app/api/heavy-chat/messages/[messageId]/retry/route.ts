import { handleHeavyChatRetryMessageRequest } from "@/features/account-heavy-agent-chat/server";

export async function POST(request: Request, context: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await context.params;
  return handleHeavyChatRetryMessageRequest(messageId, request);
}
