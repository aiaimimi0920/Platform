import type { RailSection } from "../model";
import { cn } from "@/lib/cn";

import { cardAccentStyle, formatNumber } from "../utils";
import { CurrencyIcon } from "./primitives";

export function CommerceHeader({
  categoryTabs,
  listingComposerOpen,
  miraBalance,
  obsidianBalance,
  onSelectCategory,
  onToggleListingComposer,
  routeMode,
  selectedCategory,
}: {
  categoryTabs: RailSection[];
  listingComposerOpen: boolean;
  miraBalance: number | null;
  obsidianBalance: number | null;
  onSelectCategory: (key: string) => void;
  onToggleListingComposer: () => void;
  routeMode: "official" | "marketplace" | null;
  selectedCategory: string;
}) {
  return (
    <header className="app-commerce-header">
      <div className="app-commerce-header__top">
        {routeMode === "marketplace" && listingComposerOpen ? (
          <div className="app-commerce-header__mode-indicator" aria-live="polite">
            <span className="app-commerce-header__mode-indicator-chip">上架资产</span>
          </div>
        ) : (
          <div className="app-commerce-header__categories" role="tablist" aria-label="商品种类切换">
            {categoryTabs.map((section) => (
              <button
                aria-selected={selectedCategory === section.key}
                className={cn(
                  "app-commerce-header__category-tab",
                  selectedCategory === section.key && "app-commerce-header__category-tab--active",
                )}
                key={section.key}
                onClick={() => onSelectCategory(section.key)}
                style={cardAccentStyle(section.accent)}
                type="button"
              >
                {section.label}
              </button>
            ))}
          </div>
        )}

        <div className="app-commerce-header__tools">
          {routeMode === "marketplace" ? (
            <button
              className={cn("app-commerce-header__utility-button", listingComposerOpen && "app-commerce-header__utility-button--active")}
              onClick={onToggleListingComposer}
              type="button"
            >
              上架资产
            </button>
          ) : null}

          <div className="app-commerce-header__wallet">
            <div className="app-commerce-header__currency-chip">
              <CurrencyIcon currency="obsidian" />
              <span>{obsidianBalance === null ? "—" : formatNumber(obsidianBalance)}</span>
            </div>
            <div className="app-commerce-header__currency-chip app-commerce-header__currency-chip--mira">
              <CurrencyIcon currency="mira" />
              <span>{miraBalance === null ? "—" : formatNumber(miraBalance)}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
