import type { CurrencyKey } from "@neuro/contracts";

import { cn } from "@/lib/cn";

type CurrencyIconProps = {
  className?: string;
  currency: CurrencyKey;
  title?: string;
};

const CURRENCY_ICON_SOURCES: Record<CurrencyKey, string> = {
  mira: "/assets/currency/mira.png",
  obsidian: "/assets/currency/obsidian.png",
  opinionTickets: "/assets/currency/opinion-tickets.png",
};

export function CurrencyIcon({ className, currency, title }: CurrencyIconProps) {
  return (
    <img
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      className={cn("app-currency-icon", className)}
      decoding="async"
      draggable={false}
      height={64}
      loading="lazy"
      role={title ? "img" : undefined}
      src={CURRENCY_ICON_SOURCES[currency]}
      width={64}
    />
  );
}
