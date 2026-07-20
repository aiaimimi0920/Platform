import { handleHeavyChatSnapshotRequest } from "@/features/account-heavy-agent-chat/server";

export async function GET(request: Request) {
  return handleHeavyChatSnapshotRequest(request);
}
