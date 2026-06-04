import { handleAccountHonorProfileRequest } from "@/features/account-honor/server";

export async function POST(request: Request) {
  return handleAccountHonorProfileRequest(request);
}
