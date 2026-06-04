import type { ItemView, MarketplaceListingView } from "@neuro/contracts";

import { cn } from "@/lib/cn";

import type { CommerceProductExtras, PendingCommerceTransaction } from "../model";
import {
  buildShelfTags,
  cardAccentStyle,
  formatNumber,
  getItemProduct,
  getListingAccent,
  getProductAccent,
  getProductCardLabel,
  getProductServiceTermLabel,
  getProductSupportLabel,
  maskUserId,
} from "../utils";
import { ClockIcon, CommerceCurrencyImage, MarketplaceIcon, OfficialStoreIcon } from "./primitives";

export function OfficialProductCard({
  onRequestPurchase,
  product,
  purchasedCount,
}: {
  onRequestPurchase: (transaction: PendingCommerceTransaction) => void;
  product: CommerceProductExtras;
  purchasedCount: number;
}) {
  const accent = getProductAccent(product);
  const topTags = buildShelfTags(product, purchasedCount);
  const serviceTermLabel = getProductServiceTermLabel(product);

  return (
    <article className="app-commerce-shelf-card" style={cardAccentStyle(accent)}>
      <div className={cn("app-commerce-shelf-card__top", topTags.length === 0 && "app-commerce-shelf-card__top--empty")}>
        {topTags.map((tag) => (
          <span
            className={cn(
              "app-commerce-shelf-card__badge",
              tag.tone === "time" && "app-commerce-shelf-card__badge--time",
              tag.tone === "accent" && "app-commerce-shelf-card__badge--accent",
              tag.tone === "limitPersonal" && "app-commerce-shelf-card__badge--limit-personal",
              tag.tone === "limitGlobal" && "app-commerce-shelf-card__badge--limit-global",
            )}
            key={tag.key}
            title={tag.title}
          >
            {tag.tone === "time" ? (
              <>
                <ClockIcon />
                <span>{tag.label}</span>
              </>
            ) : (
              tag.label
            )}
          </span>
        ))}
      </div>

      <div className="app-commerce-shelf-card__media">
        {serviceTermLabel ? <span className="app-commerce-shelf-card__service-chip app-commerce-shelf-card__service-chip--media">{serviceTermLabel}</span> : null}
        <div className="app-commerce-shelf-card__glyph">
          <OfficialStoreIcon />
        </div>
        {getProductSupportLabel(product) ? (
          <span className="app-commerce-shelf-card__quantity-chip">{getProductSupportLabel(product)}</span>
        ) : null}
      </div>

      <div className="app-commerce-shelf-card__titlebar">
        <div className="app-commerce-shelf-card__titleline">
          <strong>{product.title}</strong>
          <span className="app-commerce-shelf-card__meta-chip app-commerce-shelf-card__meta-chip--title">{getProductCardLabel(product)}</span>
        </div>
      </div>

      <div className="app-commerce-shelf-card__footer">
        <div className="app-commerce-shelf-card__footer-price">
          <CommerceCurrencyImage className="app-commerce-shelf-card__price-icon" currency={product.currency} />
          <strong>{formatNumber(product.price)}</strong>
        </div>
        <button
          className="mg-btn mg-btn--primary app-commerce-shelf-card__action"
          disabled={!product.active || !product.moduleEnabled || !product.eligibleToPurchase}
          onClick={() =>
            onRequestPurchase({
              actionKind: "official",
              actionLabel: "购买",
              confirmTitle: "确认购买",
              allowDiscountCodes: product.allowDiscountCodes,
              currency: product.currency,
              price: product.price,
              productId: product.id,
              redirectTo: "/products",
              subtitle: "确认后将立即扣除钱包余额并发放对应资产。",
              title: product.title,
            })
          }
          type="button"
        >
          {!product.active || !product.moduleEnabled ? "已下架" : product.eligibleToPurchase ? "购买" : "暂不可购"}
        </button>
      </div>
    </article>
  );
}

export function MarketplaceListingCard({
  currentUserId,
  listing,
  onRequestPurchase,
  product,
  purchasedCount,
}: {
  currentUserId: string | null;
  listing: MarketplaceListingView;
  onRequestPurchase: (transaction: PendingCommerceTransaction) => void;
  product: CommerceProductExtras | null;
  purchasedCount: number;
}) {
  const mine = Boolean(currentUserId && listing.sellerUserId === currentUserId);
  const accent = getListingAccent(listing, product);
  const topTags = buildShelfTags(product, purchasedCount);
  const serviceTermLabel = getProductServiceTermLabel(product);

  return (
    <article className="app-commerce-shelf-card" style={cardAccentStyle(accent)}>
      <div className={cn("app-commerce-shelf-card__top", topTags.length === 0 && "app-commerce-shelf-card__top--empty")}>
        {topTags.map((tag) => (
          <span
            className={cn(
              "app-commerce-shelf-card__badge",
              tag.tone === "time" && "app-commerce-shelf-card__badge--time",
              tag.tone === "accent" && "app-commerce-shelf-card__badge--accent",
              tag.tone === "limitPersonal" && "app-commerce-shelf-card__badge--limit-personal",
              tag.tone === "limitGlobal" && "app-commerce-shelf-card__badge--limit-global",
            )}
            key={tag.key}
            title={tag.title}
          >
            {tag.tone === "time" ? (
              <>
                <ClockIcon />
                <span>{tag.label}</span>
              </>
            ) : (
              tag.label
            )}
          </span>
        ))}
      </div>

      <div className="app-commerce-shelf-card__media">
        {serviceTermLabel ? <span className="app-commerce-shelf-card__service-chip app-commerce-shelf-card__service-chip--media">{serviceTermLabel}</span> : null}
        <div className="app-commerce-shelf-card__glyph">
          <MarketplaceIcon />
        </div>
        <span className="app-commerce-shelf-card__quantity-chip">{mine ? "我的挂牌" : maskUserId(listing.sellerUserId)}</span>
      </div>

      <div className="app-commerce-shelf-card__titlebar">
        <div className="app-commerce-shelf-card__titleline">
          <strong>{product?.title ?? listing.productTitle}</strong>
          <span className="app-commerce-shelf-card__meta-chip app-commerce-shelf-card__meta-chip--title">{getProductCardLabel(product)}</span>
        </div>
      </div>

      <div className="app-commerce-shelf-card__footer">
        <div className="app-commerce-shelf-card__footer-price">
          <CommerceCurrencyImage className="app-commerce-shelf-card__price-icon" currency={listing.currency} />
          <strong>{formatNumber(listing.price)}</strong>
        </div>
        <button
          className="mg-btn mg-btn--primary app-commerce-shelf-card__action"
          disabled={mine}
          onClick={() =>
            onRequestPurchase({
              actionKind: "marketplace",
              actionLabel: "接手",
              confirmTitle: "确认接手",
              currency: listing.currency,
              listingId: listing.id,
              price: listing.price,
              redirectTo: "/marketplace",
              subtitle: "确认后将立即扣除钱包余额，并接手这份在售资产。",
              title: product?.title ?? listing.productTitle,
            })
          }
          type="button"
        >
          {mine ? "我的挂牌" : "接手"}
        </button>
      </div>
    </article>
  );
}

export function TransferableAssetCard({
  active,
  item,
  onSelect,
  product,
}: {
  active: boolean;
  item: ItemView;
  onSelect: () => void;
  product: CommerceProductExtras | null;
}) {
  const accent = product ? getProductAccent(product) : "#d9ff38";
  const supportLabel = product ? getProductSupportLabel(product) : null;
  const serviceTermLabel = getProductServiceTermLabel(product);

  return (
    <button
      className={cn("app-commerce-listing-asset", active && "app-commerce-listing-asset--active")}
      onClick={onSelect}
      style={cardAccentStyle(accent)}
      type="button"
    >
      <div className="app-commerce-listing-asset__media">
        {serviceTermLabel ? <span className="app-commerce-listing-asset__service-chip">{serviceTermLabel}</span> : null}
        <span className="app-commerce-listing-asset__glyph" aria-hidden="true">
          <OfficialStoreIcon />
        </span>
        {supportLabel ? <span className="app-commerce-listing-asset__quantity-chip">{supportLabel}</span> : null}
      </div>

      <div className="app-commerce-listing-asset__body">
        <strong>{product?.title ?? item.productTitle}</strong>
        <div className="app-commerce-listing-asset__meta">
          <span className="app-commerce-listing-asset__meta-chip">{getProductCardLabel(product)}</span>
          <span className="app-commerce-listing-asset__meta-copy">可流转资产</span>
        </div>
      </div>
    </button>
  );
}

export function getResolvedItemProduct(
  item: ItemView,
  productsById: Map<string, CommerceProductExtras>,
  productsByTitle: Map<string, CommerceProductExtras>,
) {
  return getItemProduct(item, productsById, productsByTitle) as CommerceProductExtras | null;
}
