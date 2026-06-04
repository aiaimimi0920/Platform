import { getBenefitServicePromptCacheTrendReport } from "@/lib/account-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ serviceId: string }> },
) {
  const params = await context.params;

  if (!params?.serviceId) {
    return Response.json(
      { error: "missing_service_id" },
      {
        status: 400,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  try {
    const userContext = await requirePlatformUserContext();
    const report = await getBenefitServicePromptCacheTrendReport(userContext, params.serviceId);

    return Response.json(
      { report },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法加载 Prompt Cache 趋势。";
    return Response.json(
      { error: message },
      {
        status: message === "Authentication required" ? 401 : 503,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
