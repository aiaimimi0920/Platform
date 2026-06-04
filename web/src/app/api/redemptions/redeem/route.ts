import { redeemCode } from "@/lib/platform-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { code?: string };
    const code = payload.code?.trim() ?? "";

    if (!code) {
      return Response.json(
        { error: "请输入兑换码。" },
        {
          status: 400,
          headers: {
            "cache-control": "no-store, no-cache, must-revalidate",
          },
        },
      );
    }

    const userContext = await requirePlatformUserContext();
    const response = await redeemCode(userContext, { code });
    return Response.json(
      { result: response.result },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "兑换失败，请稍后重试。";
    return Response.json(
      { error: message },
      {
        status: message === "Authentication required" ? 401 : 400,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
