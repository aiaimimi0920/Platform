import Link from "next/link";
import type { ProductCurrency } from "@neuro/contracts";

import { cn } from "@/lib/cn";

export function CommerceIcon({ className = "app-commerce-trigger__icon" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      <path
        d="M7 7h1.5l1.2 6.1a1.2 1.2 0 0 0 1.18.97h5.6a1.2 1.2 0 0 0 1.16-.88L19 9.2H10.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="10.5" cy="18" r="1.2" fill="currentColor" />
      <circle cx="17" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function OfficialStoreIcon() {
  return (
    <svg aria-hidden="true" className="app-commerce-shelf-card__glyph-icon" viewBox="0 0 44 44">
      <path d="M14 17.4 22 11l8 6.4v11.2H14z" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M18.8 23h6.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

export function MarketplaceIcon() {
  return (
    <svg aria-hidden="true" className="app-commerce-shelf-card__glyph-icon" viewBox="0 0 44 44">
      <path d="M14 17.4 22 11l8 6.4v11.2H14z" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M18.8 23h6.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

export function ConfirmIcon() {
  return (
    <svg aria-hidden="true" className="app-commerce-confirm__title-icon" viewBox="0 0 24 24">
      <path d="m7 12 3.2 3.2L17.8 8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function CommerceCurrencyImage({
  className,
  currency,
}: {
  className?: string;
  currency: ProductCurrency;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      src={currency === "mira" ? "/assets/currency/commerce-mira.png" : "/assets/currency/commerce-obsidian.png"}
    />
  );
}

export function ClockIcon() {
  return (
    <svg aria-hidden="true" className="app-commerce-shelf-card__badge-icon" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="6.8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 6.2v4.1l2.8 1.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function CurrencyIcon({ currency }: { currency: ProductCurrency }) {
  return (
    <span aria-hidden="true" className={cn("app-commerce-header__currency-mark", currency === "mira" && "app-commerce-header__currency-mark--mira")}>
      <CommerceCurrencyImage className="app-commerce-header__currency-icon" currency={currency} />
    </span>
  );
}

export function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-commerce-close__icon" viewBox="0 0 24 24">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CommerceEmptyState({
  actionHref,
  actionLabel,
  message,
}: {
  actionHref?: string;
  actionLabel?: string;
  message: string;
}) {
  return (
    <div className="app-commerce-empty">
      <p>{message}</p>
      {actionHref && actionLabel ? (
        <Link className="mg-btn mg-btn--primary" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
