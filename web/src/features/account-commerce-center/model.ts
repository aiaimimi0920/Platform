import type {
  ItemView,
  MarketplaceListingView,
  OrderView,
  ProductCurrency,
  ProductListItem,
  UserSummary,
} from "@neuro/contracts";

import {
  combineDependencyResults,
  type DependencyResult,
} from "@/lib/dependency-result";

export type CommerceRouteMode = "official" | "marketplace";

export type CommerceCenterProps = {
  itemEnabled: boolean;
  marketplaceEnabled: boolean;
  productEnabled: boolean;
  routeMode: CommerceRouteMode | null;
  userId: string | null;
};

export type CommercePanelView = {
  currentUser: UserSummary | null;
  items: ItemView[];
  listings: MarketplaceListingView[];
  orders: OrderView[];
  products: ProductListItem[];
};

export type CommerceDependencyInputs = {
  currentUser: DependencyResult<UserSummary | null>;
  items: DependencyResult<ItemView[]>;
  listings: DependencyResult<MarketplaceListingView[]>;
  orders: DependencyResult<OrderView[]>;
  products: DependencyResult<ProductListItem[]>;
};

export type CommerceDependencyBundle = {
  dependency: DependencyResult<CommercePanelView>;
  panel: CommercePanelView;
};

export const EMPTY_COMMERCE_PANEL: CommercePanelView = {
  currentUser: null,
  items: [],
  listings: [],
  orders: [],
  products: [],
};

export function combineCommercePanelDependencies(inputs: CommerceDependencyInputs): CommerceDependencyBundle {
  const panel: CommercePanelView = {
    currentUser:
      inputs.currentUser.state === "ready" || inputs.currentUser.state === "partial"
        ? inputs.currentUser.data
        : null,
    items:
      inputs.items.state === "ready" || inputs.items.state === "partial" ? inputs.items.data : [],
    listings:
      inputs.listings.state === "ready" || inputs.listings.state === "partial"
        ? inputs.listings.data
        : [],
    orders:
      inputs.orders.state === "ready" || inputs.orders.state === "partial" ? inputs.orders.data : [],
    products:
      inputs.products.state === "ready" || inputs.products.state === "partial"
        ? inputs.products.data
        : [],
  };
  const hasBusinessData = panel.items.length > 0 || panel.listings.length > 0 || panel.orders.length > 0 || panel.products.length > 0;
  return {
    panel,
    dependency: combineDependencyResults({
      data: panel,
      empty: !hasBusinessData,
      results: Object.values(inputs),
    }),
  };
}

export type CommercePanelPayload = {
  dependency?: DependencyResult<CommercePanelView>;
  error?: string;
  panel?: CommercePanelView;
};

export type RailSection = {
  accent: string;
  key: string;
  label: string;
};

export type CommerceProductExtras = ProductListItem & {
  cardLabel?: string | null;
  durationDays?: number | null;
  officialVisible?: boolean;
  saleWindowDays?: number | null;
  serviceTermLabel?: string | null;
  supportLabelOverride?: string | null;
  stockLabel?: string | null;
};

export type ShelfTag = {
  key: string;
  label: string;
  title: string;
  tone: "default" | "accent" | "time" | "limitPersonal" | "limitGlobal";
};

export type PendingCommerceTransaction =
  | {
      actionKind: "official";
      actionLabel: "购买";
      confirmTitle: "确认购买";
      allowDiscountCodes: boolean;
      currency: ProductCurrency;
      price: number;
      productId: string;
      redirectTo: "/products";
      subtitle: string;
      title: string;
    }
  | {
      actionKind: "marketplace";
      actionLabel: "接手";
      confirmTitle: "确认接手";
      currency: ProductCurrency;
      listingId: string;
      price: number;
      redirectTo: "/marketplace";
      subtitle: string;
      title: string;
    }
  | {
      actionKind: "listing";
      actionLabel: "上架";
      confirmTitle: "确认上架";
      currency: ProductCurrency;
      itemId: string;
      price: number;
      redirectTo: "/marketplace";
      subtitle: string;
      title: string;
    };

export const COMMERCE_PANEL_UNAVAILABLE_MESSAGE = "商城面板暂时不可用。";
export const COMMERCE_POLL_INTERVAL_MS = 45_000;
export const MODE_LABELS: Record<CommerceRouteMode, string> = {
  official: "大商场",
  marketplace: "小巴扎",
};

export const CURRENCY_SECTIONS: Array<RailSection & { currency: ProductCurrency }> = [
  {
    key: "obsidian",
    label: "耀晶市场",
    accent: "#d9ff38",
    currency: "obsidian",
  },
  {
    key: "mira",
    label: "米拉市场",
    accent: "#4ec9ff",
    currency: "mira",
  },
];

export const CATEGORY_SECTIONS: RailSection[] = [
  {
    key: "artificial_intelligence",
    label: "人工智能",
    accent: "#d9ff38",
  },
  {
    key: "network_search",
    label: "网络搜索",
    accent: "#4ec9ff",
  },
  {
    key: "network_proxy",
    label: "网络代理",
    accent: "#9a70ff",
  },
];
