import type { CSSProperties } from "react";
import type { ItemView, MarketplaceListingView, ProductCurrency, ProductListItem } from "@neuro/contracts";

import { CATEGORY_SECTIONS, type CommerceProductExtras, type RailSection, type ShelfTag } from "./model";

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.floor(value ?? 0)));
}

export function normalizeToken(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_");
}

export function humanizeToken(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getCommerceCategoryKey(category: string | null | undefined) {
  const normalized = normalizeToken(category);
  const map: Record<string, string> = {
    account: "artificial_intelligence",
    accounts: "artificial_intelligence",
    ai: "artificial_intelligence",
    artificial_intelligence: "artificial_intelligence",
    credential: "artificial_intelligence",
    credentials: "artificial_intelligence",
    membership: "artificial_intelligence",
    qualification: "artificial_intelligence",
    search: "network_search",
    web_search: "network_search",
    network_search: "network_search",
    proxy: "network_proxy",
    proxies: "network_proxy",
    network_proxy: "network_proxy",
  };
  return map[normalized] ?? "artificial_intelligence";
}

export function getCategoryLabel(category: string) {
  return CATEGORY_SECTIONS.find((section) => section.key === getCommerceCategoryKey(category))?.label ?? humanizeToken(normalizeToken(category) || "catalog");
}

export function getAccentColor(key: string, fallback = "#d9ff38") {
  const normalized = normalizeToken(key);
  const map: Record<string, string> = {
    account: "#d9ff38",
    artificial_intelligence: "#d9ff38",
    benefit: "#4ec9ff",
    bundle: "#f7c348",
    credential: "#4ec9ff",
    credits: "#9a70ff",
    membership: "#9a70ff",
    package: "#f7c348",
    pass: "#9a70ff",
    proxy: "#9a70ff",
    qualification: "#4ec9ff",
    service: "#4ec9ff",
    subscription: "#9a70ff",
    tool: "#ff9e5c",
  };
  return map[normalized] ?? fallback;
}

export function getProductAccent(product: ProductListItem) {
  return getAccentColor(product.category, product.currency === "mira" ? "#4ec9ff" : "#d9ff38");
}

export function getListingAccent(listing: MarketplaceListingView, product: ProductListItem | null) {
  if (product) {
    return getProductAccent(product);
  }
  return listing.currency === "mira" ? "#4ec9ff" : "#9a70ff";
}

export function getProductSupportLabel(product: ProductListItem) {
  const extras = product as CommerceProductExtras;
  if (typeof extras.supportLabelOverride === "string" && extras.supportLabelOverride.trim()) {
    return extras.supportLabelOverride.trim();
  }
  if (typeof product.unitCount === "number" && product.unitCount > 1) {
    return `x ${product.unitCount}`;
  }
  if (typeof product.warrantyDays === "number" && product.warrantyDays > 0) {
    return `${product.warrantyDays}天`;
  }
  return null;
}

function getProductCountdownDays(product: ProductListItem) {
  const extras = product as CommerceProductExtras;
  if (typeof extras.saleWindowDays === "number" && Number.isFinite(extras.saleWindowDays) && extras.saleWindowDays > 0) {
    return Math.max(1, Math.round(extras.saleWindowDays));
  }
  return null;
}

function getPurchaseQuotaBase(product: ProductListItem) {
  if (product.kind !== "limitedPurchase") {
    return null;
  }

  if (product.limitScope === "targeted") {
    return Math.max(1, product.unitCount ?? product.warrantyDays ?? 10);
  }

  return Math.max(20, (product.unitCount ?? product.warrantyDays ?? 10) * 10);
}

function getPurchaseLimitTags(product: ProductListItem, purchasedCount: number): ShelfTag[] {
  const quotaBase = getPurchaseQuotaBase(product);
  if (quotaBase === null) {
    return [];
  }

  const tags: ShelfTag[] = [];
  const globalRemaining = Math.max(0, Math.max(quotaBase * 10, quotaBase + 20) - purchasedCount);
  tags.push({
    key: "limit-global",
    label: `限x${globalRemaining}`,
    title: `全局限购：当前剩余 ${globalRemaining}`,
    tone: "limitGlobal",
  });

  if (product.limitScope === "targeted") {
    const personalRemaining = Math.max(0, quotaBase - purchasedCount);
    tags.unshift({
      key: "limit-personal",
      label: `限x${personalRemaining}`,
      title: `个人限购：当前剩余 ${personalRemaining}`,
      tone: "limitPersonal",
    });
  }

  return tags;
}

function getAvailabilityTag(product: ProductListItem): ShelfTag[] {
  const countdownDays = getProductCountdownDays(product);
  if (countdownDays !== null) {
    return [
      {
        key: "time",
        label: `${countdownDays}天`,
        title: `限时商品：展示周期 ${countdownDays} 天`,
        tone: "time",
      },
    ];
  }
  return [];
}

function getTransferTag(product: ProductListItem | null): ShelfTag[] {
  return product?.transferable
    ? [{ key: "transfer", label: "可流转", title: "该商品支持进入小巴扎流转", tone: "accent" }]
    : [];
}

function getWarrantyTag(product: ProductListItem | null): ShelfTag[] {
  return typeof product?.warrantyDays === "number" && product.warrantyDays > 0
    ? [{ key: "warranty", label: "有质保", title: `有质保：${product.warrantyDays} 天`, tone: "default" }]
    : [];
}

function getOwnershipTag(product: ProductListItem | null): ShelfTag[] {
  return product?.fulfillmentMode === "maintained_pool"
    ? [{ key: "shared-pool", label: "共享池", title: "共享池：该商品由共享账号池持续履约", tone: "default" }]
    : [];
}

export function getProductServiceTermLabel(product: ProductListItem | null) {
  const extras = product as CommerceProductExtras | null;
  return typeof extras?.serviceTermLabel === "string" && extras.serviceTermLabel.trim() ? extras.serviceTermLabel.trim() : null;
}

export function getProductCardLabel(product: ProductListItem | null) {
  const extras = product as CommerceProductExtras | null;
  if (typeof extras?.cardLabel === "string" && extras.cardLabel.trim()) {
    return extras.cardLabel.trim();
  }
  return product ? getCategoryLabel(product.category) : "流转货架";
}

export function buildShelfTags(product: ProductListItem | null, purchasedCount: number) {
  if (!product) {
    return [{ key: "transfer", label: "可流转", title: "该商品支持进入小巴扎流转", tone: "accent" as const }];
  }

  return [
    ...getAvailabilityTag(product),
    ...getPurchaseLimitTags(product, purchasedCount),
    ...getTransferTag(product),
    ...getWarrantyTag(product),
    ...getOwnershipTag(product),
  ];
}

export function maskUserId(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "匿名卖家";
  }
  if (normalized.length <= 6) {
    return normalized;
  }
  return `${normalized.slice(0, 3)}***${normalized.slice(-2)}`;
}

export function getListingProduct(
  listing: MarketplaceListingView,
  itemsById: Map<string, ItemView>,
  productsById: Map<string, ProductListItem>,
  productsByTitle: Map<string, ProductListItem>,
) {
  const item = itemsById.get(listing.itemId);
  if (item) {
    return productsById.get(item.productId) ?? productsByTitle.get(normalizeToken(item.productTitle)) ?? null;
  }
  return productsByTitle.get(normalizeToken(listing.productTitle)) ?? null;
}

export function getListingCategoryKey(
  listing: MarketplaceListingView,
  itemsById: Map<string, ItemView>,
  productsById: Map<string, ProductListItem>,
  productsByTitle: Map<string, ProductListItem>,
) {
  const product = getListingProduct(listing, itemsById, productsById, productsByTitle);
  return getCommerceCategoryKey(product?.category ?? listing.productTitle);
}

export function getItemProduct(
  item: ItemView,
  productsById: Map<string, ProductListItem>,
  productsByTitle: Map<string, ProductListItem>,
) {
  return productsById.get(item.productId) ?? productsByTitle.get(normalizeToken(item.productTitle)) ?? null;
}

export function buildCategoryTabs({ currency }: { currency: ProductCurrency }): RailSection[] {
  return CATEGORY_SECTIONS.map((section) => ({
    ...section,
    accent: currency === "mira" && section.key === "artificial_intelligence" ? "#4ec9ff" : section.accent,
  }));
}

export function decorateCommerceProduct(product: ProductListItem): CommerceProductExtras {
  const normalized = normalizeToken(product.title);
  if (normalized.includes("无限续杯")) {
    return {
      ...product,
      cardLabel: "CodeX",
      officialVisible: true,
      serviceTermLabel: "单日",
      supportLabelOverride: "x 30",
    };
  }

  if (normalized.includes("无限调用")) {
    return {
      ...product,
      cardLabel: "CodeX",
      officialVisible: true,
      serviceTermLabel: "单日",
      supportLabelOverride: null,
    };
  }

  return {
    ...product,
    cardLabel: "CodeX",
    officialVisible: getCommerceCategoryKey(product.category) === "artificial_intelligence",
  };
}

export function cardAccentStyle(accent: string): CSSProperties {
  return {
    "--app-commerce-card-accent": accent,
  } as CSSProperties;
}

export function getCommerceRouteMode(pathname: string | null): "official" | "marketplace" | null {
  if (!pathname) {
    return null;
  }
  if (pathname === "/products" || pathname.startsWith("/products/")) {
    return "official";
  }
  if (pathname === "/marketplace" || pathname.startsWith("/marketplace/")) {
    return "marketplace";
  }
  return null;
}
