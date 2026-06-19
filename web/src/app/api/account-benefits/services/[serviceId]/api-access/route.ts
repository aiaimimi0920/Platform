import { resolveBenefitServiceApiAccess } from "@/lib/account-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

type RouteContext = {
  params: Promise<{
    serviceId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const userContext = await requirePlatformUserContext();
    const { serviceId } = await context.params;
    const access = await resolveBenefitServiceApiAccess(userContext, serviceId);

    return Response.json(
      { access },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "权益服务 API 访问暂不可用";
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
