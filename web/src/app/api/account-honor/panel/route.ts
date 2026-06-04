import { handleAccountHonorPanelRequest } from "@/features/account-honor/server";

export async function GET(request: Request) {
  return handleAccountHonorPanelRequest(request);
}
