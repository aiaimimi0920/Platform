import { auth } from "@/auth";
import { serializeDiscountCodesToCsv } from "@/lib/discount-code-ops";
import { getFeatureSnapshot, listOperatorDiscountCodes, type DiscountCodeOperatorView } from "@/lib/core-client";
import { isPlatformOperatorUserId } from "@/lib/platform-session";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    return new Response("Platform operator required", { status: 401 });
  }

  const features = await getFeatureSnapshot();
  if (!features.discountCode.enabled) {
    return new Response("discountCode module disabled", { status: 409 });
  }

  const url = new URL(request.url);
  const discountCodes = (await listOperatorDiscountCodes(
    {
      userId: session.user.id,
      username: session.user.username,
    },
    {
      productId: url.searchParams.get("discountProductId") || undefined,
      state: (url.searchParams.get("discountState") as
        | "all"
        | "enabled"
        | "disabled"
        | "expired"
        | "expiring"
        | "activeWindow"
        | "scheduled"
        | null) || undefined,
      scope: (url.searchParams.get("discountScope") as
        | "all"
        | "allProducts"
        | "productCategory"
        | "specificProduct"
        | null) || undefined,
      audienceScope: (url.searchParams.get("discountAudienceScope") as
        | "all"
        | "allUsers"
        | "userGroup"
        | "specificUser"
        | null) || undefined,
      namespace: url.searchParams.get("discountNamespace") || undefined,
      batchLabel: url.searchParams.get("discountBatchLabel") || undefined,
      windowDays: url.searchParams.get("discountWindowDays")
        ? Math.max(1, Math.min(Number(url.searchParams.get("discountWindowDays")) || 7, 365))
        : undefined,
    },
  )) as DiscountCodeOperatorView[];

  const csv = serializeDiscountCodesToCsv(discountCodes);
  const filename = `discount-codes-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
