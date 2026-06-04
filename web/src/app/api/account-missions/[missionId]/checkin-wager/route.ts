import { placeCheckinWager } from "@/lib/account-client";
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
    const wager = await placeCheckinWager(userContext, missionId);
    return Response.json(
      { wager },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mission wager failed";
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
