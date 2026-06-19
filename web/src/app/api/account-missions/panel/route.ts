import { getMissionPanel } from "@/lib/account-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

export async function GET() {
  try {
    const userContext = await requirePlatformUserContext();
    const panel = await getMissionPanel(userContext);
    return Response.json(
      { panel },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "任务面板暂不可用";
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
