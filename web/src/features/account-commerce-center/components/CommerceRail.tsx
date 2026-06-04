import { cn } from "@/lib/cn";

import { CURRENCY_SECTIONS, MODE_LABELS, type CommerceRouteMode } from "../model";
import { cardAccentStyle } from "../utils";
import { CommerceIcon } from "./primitives";

export function CommerceRail({
  marketplaceEnabled,
  onSelectCurrency,
  onShowMarketplace,
  onShowOfficial,
  productEnabled,
  routeMode,
  selectedCurrency,
  titleId,
}: {
  marketplaceEnabled: boolean;
  onSelectCurrency: (currency: "obsidian" | "mira") => void;
  onShowMarketplace: () => void;
  onShowOfficial: () => void;
  productEnabled: boolean;
  routeMode: CommerceRouteMode | null;
  selectedCurrency: "obsidian" | "mira";
  titleId: string;
}) {
  return (
    <aside className="app-commerce-center__rail">
      <div className="app-commerce-center__rail-head">
        <span className="app-commerce-center__rail-mark" aria-hidden="true">
          <CommerceIcon className="app-commerce-center__rail-mark-icon" />
        </span>
        <h2 className="app-commerce-center__rail-title" id={titleId}>
          商城
        </h2>
      </div>

      <div className="app-commerce-center__rail-mode-tabs">
        <button
          className={cn("app-commerce-center__rail-mode", routeMode === "official" && "app-commerce-center__rail-mode--active")}
          disabled={!productEnabled}
          onClick={onShowOfficial}
          type="button"
        >
          {MODE_LABELS.official}
        </button>
        <button
          className={cn("app-commerce-center__rail-mode", routeMode === "marketplace" && "app-commerce-center__rail-mode--active")}
          disabled={!marketplaceEnabled}
          onClick={onShowMarketplace}
          type="button"
        >
          {MODE_LABELS.marketplace}
        </button>
      </div>

      <div className="app-commerce-center__rail-list">
        {CURRENCY_SECTIONS.map((section) => {
          const active = section.currency === selectedCurrency;
          return (
            <button
              className={cn("app-commerce-center__rail-item", active && "app-commerce-center__rail-item--active")}
              key={section.key}
              onClick={() => onSelectCurrency(section.currency)}
              style={cardAccentStyle(section.accent)}
              type="button"
            >
              <strong>{section.label}</strong>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
