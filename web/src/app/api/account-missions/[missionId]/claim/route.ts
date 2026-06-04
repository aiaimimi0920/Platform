import { claimMission } from "@/lib/account-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

type RouteContext = {
  params: Promise<{
    missionId: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { missionId } = await context.params;

  try {
    const userContext = await requirePlatformUserContext();
    const reward = await claimMission(userContext, missionId);
    return Response.json(
      { reward },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission claim failed";
    return Response.json(
      { error: message },
      {
        status: message === "Authentication required" ? 401 : 409,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
