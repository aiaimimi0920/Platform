"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ItemView, ProductCurrency } from "@neuro/contracts";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useAppToast } from "@/components/app-toast-center";
import { DependencyState } from "@/components/dependency-state";
import { createDependencyFailureResult, type DependencyResult } from "@/lib/dependency-result";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import { MarketplaceListingCard, OfficialProductCard } from "./components/cards";
import { CommerceConfirmDialog } from "./components/CommerceConfirmDialog";
import { CommerceHeader } from "./components/CommerceHeader";
import { CommerceListingComposer } from "./components/CommerceListingComposer";
import { CommerceRail } from "./components/CommerceRail";
import { CloseIcon, CommerceEmptyState, CommerceIcon } from "./components/primitives";
import {
  COMMERCE_PANEL_UNAVAILABLE_MESSAGE,
  COMMERCE_POLL_INTERVAL_MS,
  MODE_LABELS,
  type CommerceCenterProps,
  type CommercePanelPayload,
  type CommercePanelView,
  type CommerceProductExtras,
  type CommerceRouteMode,
  type PendingCommerceTransaction,
} from "./model";
import {
  buildCategoryTabs,
  decorateCommerceProduct,
  formatNumber,
  getCommerceCategoryKey,
  getCommerceRouteMode,
  getItemProduct,
  getListingCategoryKey,
  getListingProduct,
  normalizeToken,
} from "./utils";

export { getCommerceRouteMode };
export type { CommerceCenterProps, CommerceRouteMode } from "./model";

export function CommerceCenter({
  itemEnabled,
  marketplaceEnabled,
  productEnabled,
  routeMode,
  userId,
}: CommerceCenterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pushToast } = useAppToast();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const consumedStatusRef = useRef<string | null>(null);
  const commerceRequestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const commerceRequestIdRef = useRef(0);
  const titleId = useId();

  const enabled = Boolean(userId) && (productEnabled || marketplaceEnabled);
  const open = enabled && routeMode !== null;
  const defaultRoute = productEnabled ? "/products" : "/marketplace";
  const triggerLabel = productEnabled ? "商城" : "小集市";
  const [panelState, setPanelState] = useState<{ panel: CommercePanelView; userId: string } | null>(null);
  const [dependency, setDependency] = useState<DependencyResult<CommercePanelView> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<ProductCurrency>("obsidian");
  const [selectedCategory, setSelectedCategory] = useState<string>("artificial_intelligence");
  const [pendingTransactionState, setPendingTransactionState] = useState<{
    transaction: PendingCommerceTransaction;
    userId: string;
  } | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [listingComposerOpen, setListingComposerOpen] = useState(false);
  const [selectedListingItemId, setSelectedListingItemId] = useState<string | null>(null);
  const [listingPriceInput, setListingPriceInput] = useState("");
  const [listingCurrency, setListingCurrency] = useState<ProductCurrency>("obsidian");
  const panel = panelState?.userId === userId ? panelState.panel : null;
  const pendingTransaction = pendingTransactionState?.userId === userId ? pendingTransactionState.transaction : null;

  function setPendingTransaction(transaction: PendingCommerceTransaction | null) {
    setPendingTransactionState(transaction && userId ? { transaction, userId } : null);
  }

  async function refreshPanel(options?: { silent?: boolean }) {
    if (!enabled || !userId) {
      return;
    }

    const requestUserId = userId;
    commerceRequestRef.current?.controller.abort();
    const requestId = commerceRequestIdRef.current + 1;
    commerceRequestIdRef.current = requestId;
    const controller = new AbortController();
    commerceRequestRef.current = { controller, id: requestId };
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/account-commerce/panel", {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as CommercePanelPayload;
      if (!payload.dependency || !payload.panel) {
        throw new Error(payload.error || COMMERCE_PANEL_UNAVAILABLE_MESSAGE);
      }
      if (controller.signal.aborted || commerceRequestIdRef.current !== requestId) {
        return;
      }
      setPanelState({ panel: payload.panel, userId: requestUserId });
      setDependency(payload.dependency);
      setError(null);
    } catch (fetchError) {
      if (controller.signal.aborted || commerceRequestIdRef.current !== requestId) {
        return;
      }
      const normalizedError = fetchError instanceof Error ? fetchError : new Error(COMMERCE_PANEL_UNAVAILABLE_MESSAGE);
      setDependency(
        createDependencyFailureResult({
          error: normalizedError,
          message: COMMERCE_PANEL_UNAVAILABLE_MESSAGE,
          source: "commerce-api",
        }),
      );
      setError(normalizedError.message);
    } finally {
      if (commerceRequestRef.current?.id === requestId) {
        commerceRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    setPanelState(null);
    setDependency(null);
    setError(null);
    setLoading(false);
    setPendingTransactionState(null);
    setConfirmSubmitting(false);
    setListingComposerOpen(false);
    setSelectedListingItemId(null);
    setListingPriceInput("");
  }, [userId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void refreshPanel({ silent: panel !== null });
    const intervalId = window.setInterval(() => {
      if (commerceRequestRef.current) {
        return;
      }
      void refreshPanel({ silent: true });
    }, COMMERCE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      commerceRequestRef.current?.controller.abort();
      commerceRequestRef.current = null;
      commerceRequestIdRef.current += 1;
    };
  }, [enabled, open, userId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    return acquireBodyOverlayLock();
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (wasOpenRef.current) {
      triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (pendingTransaction) {
          setPendingTransaction(null);
          setConfirmSubmitting(false);
          return;
        }
        router.push("/dashboard");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, pendingTransaction, router]);

  useEffect(() => {
    if (!pendingTransaction) {
      return;
    }
    confirmCancelButtonRef.current?.focus();
  }, [pendingTransaction]);

  useEffect(() => {
    if (!open) {
      consumedStatusRef.current = null;
      return;
    }

    const status = searchParams.get("status");
    const message = searchParams.get("message");
    if (!status || !message) {
      consumedStatusRef.current = null;
      return;
    }

    const key = `${status}:${message}`;
    if (consumedStatusRef.current === key) {
      return;
    }
    consumedStatusRef.current = key;

    pushToast({
      tone: status === "success" ? "success" : "error",
      title: routeMode === "marketplace" ? MODE_LABELS.marketplace : MODE_LABELS.official,
      message,
    });
    setPendingTransaction(null);
    setConfirmSubmitting(false);
    router.replace(pathname || (routeMode === "marketplace" ? "/marketplace" : "/products"));
    void refreshPanel({ silent: true });
  }, [open, pathname, pushToast, routeMode, router, searchParams]);

  useEffect(() => {
    if (routeMode !== "marketplace") {
      setListingComposerOpen(false);
      setSelectedListingItemId(null);
      setListingPriceInput("");
      setListingCurrency("obsidian");
    }
  }, [routeMode]);

  const rawProducts = useMemo(
    () =>
      (panel?.products ?? [])
        .filter((product) => product.active && product.moduleEnabled)
        .sort((left, right) => left.price - right.price),
    [panel?.products],
  );
  const products = useMemo(() => rawProducts.map((product) => decorateCommerceProduct(product)), [rawProducts]);
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const items = useMemo(() => panel?.items ?? [], [panel?.items]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const productsByTitle = useMemo(
    () => new Map(products.map((product) => [normalizeToken(product.title), product])),
    [products],
  );
  const orders = useMemo(() => panel?.orders ?? [], [panel?.orders]);
  const purchasedCountByProductId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of orders) {
      if (order.status === "rolled_back") {
        continue;
      }
      counts.set(order.productId, (counts.get(order.productId) ?? 0) + 1);
    }
    return counts;
  }, [orders]);
  const listings = useMemo(
    () =>
      (panel?.listings ?? [])
        .filter((listing) => listing.status === "active")
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [panel?.listings],
  );

  const categoryTabs = useMemo(
    () => (routeMode ? buildCategoryTabs({ currency: selectedCurrency }) : []),
    [routeMode, selectedCurrency],
  );

  useEffect(() => {
    setSelectedCategory((current) =>
      categoryTabs.some((section) => section.key === current) ? current : categoryTabs[0]?.key ?? "artificial_intelligence",
    );
  }, [categoryTabs]);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.officialVisible !== false &&
          product.currency === selectedCurrency &&
          getCommerceCategoryKey(product.category) === selectedCategory,
      ),
    [products, selectedCategory, selectedCurrency],
  );

  const filteredListings = useMemo(
    () =>
      listings.filter(
        (listing) =>
          listing.currency === selectedCurrency &&
          getListingCategoryKey(listing, itemsById, productsById, productsByTitle) === selectedCategory,
      ),
    [itemsById, listings, productsById, productsByTitle, selectedCategory, selectedCurrency],
  );

  const transferableItems = useMemo(() => items.filter((item) => item.transferable && item.status === "active"), [items]);
  const listableItems = useMemo(
    () => [...transferableItems].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [transferableItems],
  );
  const selectedListingItem = useMemo(
    () => listableItems.find((item) => item.id === selectedListingItemId) ?? null,
    [listableItems, selectedListingItemId],
  );
  const selectedListingProduct = useMemo(
    () => (selectedListingItem ? (getItemProduct(selectedListingItem, productsById, productsByTitle) as CommerceProductExtras | null) : null),
    [productsById, productsByTitle, selectedListingItem],
  );
  const failedSources = new Set(dependency?.failures.map((failure) => failure.source) ?? []);
  const currentUserUnavailable = failedSources.has("account-user");
  const itemsUnavailable = failedSources.has("core-items");
  const listingsUnavailable = failedSources.has("core-marketplace");
  const ordersUnavailable = failedSources.has("core-orders");
  const productsUnavailable = failedSources.has("core-products");
  const obsidianBalance = currentUserUnavailable
    ? null
    : panel?.currentUser?.snapshot?.wallet?.balances.obsidian.available ?? null;
  const miraBalance = currentUserUnavailable
    ? null
    : panel?.currentUser?.snapshot?.wallet?.balances.mira.available ?? null;

  useEffect(() => {
    if (!listingComposerOpen) {
      return;
    }
    setSelectedListingItemId((current) => (listableItems.some((item) => item.id === current) ? current : listableItems[0]?.id ?? null));
  }, [listableItems, listingComposerOpen]);

  useEffect(() => {
    if (!listingComposerOpen || !selectedListingItem) {
      return;
    }
    setListingPriceInput((current) => {
      if (current.trim().length > 0) {
        return current;
      }
      const fallbackPrice = selectedListingProduct?.price ?? 0;
      return fallbackPrice > 0 ? String(fallbackPrice) : "";
    });
  }, [listingComposerOpen, selectedListingItem, selectedListingProduct]);

  function openListingComposer() {
    setListingComposerOpen(true);
    setPendingTransaction(null);
    setConfirmSubmitting(false);
    setListingCurrency(selectedCurrency);
  }

  function toggleListingComposer() {
    if (listingComposerOpen) {
      setListingComposerOpen(false);
      return;
    }
    openListingComposer();
  }

  function handleSelectListingItem(item: ItemView) {
    const resolvedProduct = getItemProduct(item, productsById, productsByTitle) as CommerceProductExtras | null;
    setSelectedListingItemId(item.id);
    setListingPriceInput(resolvedProduct?.price && resolvedProduct.price > 0 ? String(resolvedProduct.price) : "");
  }

  function handleRequestListing() {
    if (!selectedListingItem) {
      pushToast({
        tone: "error",
        title: MODE_LABELS.marketplace,
        message: "请先从左侧选择一个可流转资产。",
      });
      return;
    }

    const price = Math.floor(Number(listingPriceInput));
    if (!Number.isFinite(price) || price <= 0) {
      pushToast({
        tone: "error",
        title: MODE_LABELS.marketplace,
        message: "请输入有效的上架价格。",
      });
      return;
    }

    const currency = listingCurrency;
    const currencyLabel = currency === "mira" ? "米拉" : "耀晶";
    const title = selectedListingProduct?.title ?? selectedListingItem.productTitle;

    setPendingTransaction({
      actionKind: "listing",
      actionLabel: "上架",
      confirmTitle: "确认上架",
      currency,
      itemId: selectedListingItem.id,
      price,
      redirectTo: "/marketplace",
      subtitle: `是否以 ${formatNumber(price)} ${currencyLabel}上架商品 ${title}？`,
      title,
    });
    setConfirmSubmitting(false);
  }

  const content = (() => {
    if (dependency?.state === "unavailable" || dependency?.state === "unauthorized") {
      return <DependencyState label="商城数据" result={dependency} />;
    }

    if (loading && !panel) {
      return <CommerceEmptyState message="商城正在同步货架，请稍后…" />;
    }

    if (error && !panel) {
      return <CommerceEmptyState actionHref="/dashboard" actionLabel="返回控制台" message={error} />;
    }

    if (routeMode === "marketplace") {
      if (!marketplaceEnabled) {
        return <CommerceEmptyState actionHref="/products" actionLabel="切到大商场" message="当前只保留大商场入口。" />;
      }

          if (listingComposerOpen) {
            if (itemsUnavailable) {
              return dependency ? <DependencyState label="可流转资产" result={dependency} /> : null;
            }
            return (
          <CommerceListingComposer
            listableItems={listableItems}
            listingCurrency={listingCurrency}
            listingPriceInput={listingPriceInput}
            onChangeListingPriceInput={setListingPriceInput}
            onRequestListing={handleRequestListing}
            onSelectItem={handleSelectListingItem}
            onSelectListingCurrency={setListingCurrency}
            productsById={productsById}
            productsByTitle={productsByTitle}
            selectedListingItem={selectedListingItem}
            selectedListingProduct={selectedListingProduct}
            resolveItemProduct={(item, byId, byTitle) => getItemProduct(item, byId, byTitle) as CommerceProductExtras | null}
          />
        );
          }

          if (listingsUnavailable) {
            return dependency ? <DependencyState label="市场挂单" result={dependency} /> : null;
          }

          if (filteredListings.length === 0) {
        return <CommerceEmptyState message="暂无商品" />;
      }

      return (
        <div className="app-commerce-grid">
          {filteredListings.map((listing) => {
            const resolvedProduct = getListingProduct(listing, itemsById, productsById, productsByTitle) as CommerceProductExtras | null;
            return (
              <MarketplaceListingCard
                currentUserId={userId}
                key={listing.id}
                listing={listing}
                onRequestPurchase={(transaction) => {
                  setPendingTransaction(transaction);
                  setConfirmSubmitting(false);
                }}
                product={resolvedProduct}
                    purchasedCount={
                      ordersUnavailable
                        ? null
                        : resolvedProduct
                          ? (purchasedCountByProductId.get(resolvedProduct.id) ?? 0)
                          : 0
                    }
              />
            );
          })}
        </div>
      );
    }

        if (!productEnabled) {
      return <CommerceEmptyState actionHref="/marketplace" actionLabel="切到小巴扎" message="当前只保留小巴扎入口。" />;
        }

        if (productsUnavailable) {
          return dependency ? <DependencyState label="商品目录" result={dependency} /> : null;
        }

        if (filteredProducts.length === 0) {
      return <CommerceEmptyState message="暂无商品" />;
    }

    return (
      <div className="app-commerce-grid">
        {filteredProducts.map((product) => (
          <OfficialProductCard
            key={product.id}
            onRequestPurchase={(transaction) => {
              setPendingTransaction(transaction);
              setConfirmSubmitting(false);
            }}
            product={product}
                purchasedCount={ordersUnavailable ? null : (purchasedCountByProductId.get(product.id) ?? 0)}
          />
        ))}
      </div>
    );
  })();

  if (!enabled) {
    return null;
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="app-benefit-trigger"
        onClick={() => router.push(defaultRoute)}
        ref={triggerButtonRef}
        type="button"
      >
        <span className="app-benefit-trigger__copy">
          <CommerceIcon className="app-benefit-trigger__icon" />
          <span>{triggerLabel}</span>
        </span>
      </button>

      {open ? (
        <div aria-labelledby={titleId} aria-modal="true" className="app-commerce-overlay" role="dialog">
          <button aria-label="关闭商城面板" className="app-commerce-backdrop" onClick={() => router.push("/dashboard")} type="button" />

          <section className="app-commerce-center">
            <CommerceRail
              marketplaceEnabled={marketplaceEnabled}
              onSelectCurrency={setSelectedCurrency}
              onShowMarketplace={() => router.push("/marketplace")}
              onShowOfficial={() => router.push("/products")}
              productEnabled={productEnabled}
              routeMode={routeMode}
              selectedCurrency={selectedCurrency}
              titleId={titleId}
            />

            <div className="app-commerce-center__main">
              <button
                aria-label="关闭商城面板"
                className="app-commerce-close"
                onClick={() => router.push("/dashboard")}
                ref={closeButtonRef}
                type="button"
              >
                <CloseIcon />
              </button>

              <CommerceHeader
                categoryTabs={categoryTabs}
                listingComposerOpen={listingComposerOpen}
                miraBalance={miraBalance}
                obsidianBalance={obsidianBalance}
                onSelectCategory={setSelectedCategory}
                onToggleListingComposer={toggleListingComposer}
                routeMode={routeMode}
                selectedCategory={selectedCategory}
              />

              <div className="app-commerce-board">
                <div className="app-commerce-board__scroll">
                  {dependency?.state === "partial" ? (
                    <div style={{ marginBottom: 16 }}>
                      <DependencyState label="商城数据" result={dependency} />
                    </div>
                  ) : null}
                  {content}
                </div>
              </div>
            </div>
          </section>

          {pendingTransaction ? (
            <CommerceConfirmDialog
              confirmCancelButtonRef={confirmCancelButtonRef}
              confirmSubmitting={confirmSubmitting}
              onCancel={() => {
                setPendingTransaction(null);
                setConfirmSubmitting(false);
              }}
              onSubmitStart={() => setConfirmSubmitting(true)}
              pendingTransaction={pendingTransaction}
              titleId={titleId}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
