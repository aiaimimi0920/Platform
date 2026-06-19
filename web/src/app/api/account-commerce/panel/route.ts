import { getCurrentUser } from "@/lib/account-client";
import { getFeatureSnapshot, getPublicSurfaceSnapshot, listItems, listMarketplace, listOrders, listProducts } from "@/lib/core-client";
import { requirePlatformUserContext } from "@/lib/platform-session";
import { applyPublicSurfaceVisibilityForViewer } from "@/lib/public-surface-visibility";

async function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const userContext = await requirePlatformUserContext();
    const [features, rawPublicSurfaces] = await Promise.all([getFeatureSnapshot(), getPublicSurfaceSnapshot()]);
    const publicSurfaces = applyPublicSurfaceVisibilityForViewer(
      rawPublicSurfaces,
      userContext.userId,
      userContext.providerUserId,
    );
    const [currentUser, products, items, listings, orders] = await Promise.all([
      withFallback(getCurrentUser(userContext), null),
      publicSurfaces.store.enabled && features.product.enabled ? withFallback(listProducts(userContext), []) : Promise.resolve([]),
      publicSurfaces.inventory.enabled && features.item.enabled ? withFallback(listItems(userContext), []) : Promise.resolve([]),
      publicSurfaces.marketplace.enabled && features.marketplace.enabled
        ? withFallback(listMarketplace(userContext), [])
        : Promise.resolve([]),
      publicSurfaces.store.enabled && features.product.enabled ? withFallback(listOrders(userContext), []) : Promise.resolve([]),
    ]);

    return Response.json(
      {
        panel: {
          currentUser,
          items,
          listings,
          orders,
          products,
        },
      },
      {
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "商城面板暂不可用";
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
