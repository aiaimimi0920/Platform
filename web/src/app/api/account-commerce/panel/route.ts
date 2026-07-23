import type { ItemView, MarketplaceListingView, OrderView, ProductListItem, UserSummary } from "@neuro/contracts";

import { getCurrentUser } from "@/lib/account-client";
import {
  getFeatureSnapshot,
  getPublicSurfaceSnapshotStrict,
  isFeatureSnapshotUnavailable,
  listItems,
  listMarketplace,
  listOrders,
  listProducts,
} from "@/lib/core-client";
import { createDependencyFailureResult, createDependencyResult, type DependencyResult } from "@/lib/dependency-result";
import { requirePlatformUserContext } from "@/lib/platform-session";
import { applyPublicSurfaceVisibilityForViewer } from "@/lib/public-surface-visibility";
import {
  combineCommercePanelDependencies,
  EMPTY_COMMERCE_PANEL,
  type CommercePanelView,
} from "@/features/account-commerce-center/model";

function resultFromSettled<T>(
  result: PromiseSettledResult<T>,
  args: { message: string; source: string; unauthorizedMessage: string },
): DependencyResult<T> {
  if (result.status === "fulfilled") {
    return createDependencyResult({ state: "ready", data: result.value });
  }
  return createDependencyFailureResult({
    error: result.reason,
    message: args.message,
    source: args.source,
    unauthorizedMessage: args.unauthorizedMessage,
  });
}

export async function GET() {
  try {
    const userContext = await requirePlatformUserContext();
    const [features, rawPublicSurfaces] = await Promise.all([getFeatureSnapshot(), getPublicSurfaceSnapshotStrict()]);
    if (isFeatureSnapshotUnavailable(features)) {
      const dependency = createDependencyFailureResult<CommercePanelView>({
        error: new Error("Feature snapshot unavailable"),
        message: "商城依赖状态暂不可用。",
        source: "core-features",
      });
      return Response.json(
        { dependency, panel: EMPTY_COMMERCE_PANEL },
        {
          status: 503,
          headers: { "cache-control": "no-store, no-cache, must-revalidate" },
        },
      );
    }
    const publicSurfaces = applyPublicSurfaceVisibilityForViewer(
      rawPublicSurfaces,
      userContext.userId,
      userContext.providerUserId,
    );
    const [currentUserResponse, productsResponse, itemsResponse, listingsResponse, ordersResponse] = await Promise.allSettled([
      getCurrentUser(userContext),
      publicSurfaces.store.enabled && features.product.enabled ? listProducts(userContext) : Promise.resolve([] as ProductListItem[]),
      publicSurfaces.inventory.enabled && features.item.enabled ? listItems(userContext) : Promise.resolve([] as ItemView[]),
      publicSurfaces.marketplace.enabled && features.marketplace.enabled
        ? listMarketplace(userContext)
        : Promise.resolve([] as MarketplaceListingView[]),
      publicSurfaces.store.enabled && features.product.enabled ? listOrders(userContext) : Promise.resolve([] as OrderView[]),
    ]);
    const bundle = combineCommercePanelDependencies({
      currentUser: resultFromSettled<UserSummary | null>(currentUserResponse, {
        message: "账户信息暂不可用。",
        unauthorizedMessage: "当前账户无权读取账户信息。",
        source: "account-user",
      }),
      products: resultFromSettled<ProductListItem[]>(productsResponse, {
        message: "商品目录暂不可用。",
        unauthorizedMessage: "当前账户无权读取商品目录。",
        source: "core-products",
      }),
      items: resultFromSettled<ItemView[]>(itemsResponse, {
        message: "资产清单暂不可用。",
        unauthorizedMessage: "当前账户无权读取资产清单。",
        source: "core-items",
      }),
      listings: resultFromSettled<MarketplaceListingView[]>(listingsResponse, {
        message: "市场挂单暂不可用。",
        unauthorizedMessage: "当前账户无权读取市场挂单。",
        source: "core-marketplace",
      }),
      orders: resultFromSettled<OrderView[]>(ordersResponse, {
        message: "订单记录暂不可用。",
        unauthorizedMessage: "当前账户无权读取订单记录。",
        source: "core-orders",
      }),
    });
    const dependencyStatus = bundle.dependency.state === "unauthorized" ? 401 : bundle.dependency.state === "unavailable" ? 503 : 200;

    return Response.json(
      {
        dependency: bundle.dependency,
        panel: {
          ...bundle.panel,
        },
      },
      {
        status: dependencyStatus,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    const dependency = createDependencyFailureResult<CommercePanelView>({
      error,
      message: "商城面板暂不可用。",
      source: "commerce-panel",
      unauthorizedMessage: "当前账户无权读取商城面板。",
    });
    const publicMessage =
      dependency.state === "unauthorized"
        ? "当前账户无权读取商城面板。"
        : "商城面板暂不可用。";
    return Response.json(
      { dependency, panel: EMPTY_COMMERCE_PANEL, error: publicMessage },
      {
        status: dependency.state === "unauthorized" ? 401 : 503,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
