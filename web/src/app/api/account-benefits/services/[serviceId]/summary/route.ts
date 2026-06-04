import type { BenefitPanelView } from "@/lib/account-client";
import { getBenefitPanel } from "@/lib/account-client";
import { requirePlatformUserContext } from "@/lib/platform-session";
import { maskBenefitSecret } from "@/lib/benefits-utils";

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
    const panel = await getBenefitPanel(userContext);
    const service = panel.families
      .flatMap((family) => family.services)
      .find((entry) => entry.id === params.serviceId);

    if (!service) {
      return Response.json(
        { error: "service_not_found" },
        {
          status: 404,
          headers: {
            "cache-control": "no-store, no-cache, must-revalidate",
          },
        },
      );
    }

    const summary = {
      serviceId: service.id,
      serviceTitle: service.title,
      assignmentStatus: service.assignmentStatus,
      credentialMasked: maskBenefitSecret(service.credentialSummary?.maskedSummary ?? null),
      previewLabel: service.credentialSummary?.previewLabel ?? null,
      apiUrl: service.credentialSummary?.apiUrl ?? service.config.apiUrl ?? null,
      generatedAt: panel.generatedAt,
    };

    return Response.json(
      { summary },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法加载凭证摘要。";
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
