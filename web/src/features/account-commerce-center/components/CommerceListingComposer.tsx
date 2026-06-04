import type { ItemView, ProductCurrency } from "@neuro/contracts";
import { cn } from "@/lib/cn";

import type { CommerceProductExtras } from "../model";
import { getProductCardLabel, getProductServiceTermLabel, getProductSupportLabel } from "../utils";
import { TransferableAssetCard } from "./cards";
import { CommerceCurrencyImage } from "./primitives";

export function CommerceListingComposer({
  listableItems,
  listingCurrency,
  listingPriceInput,
  onChangeListingPriceInput,
  onRequestListing,
  onSelectItem,
  onSelectListingCurrency,
  productsById,
  productsByTitle,
  selectedListingItem,
  selectedListingProduct,
  resolveItemProduct,
}: {
  listableItems: ItemView[];
  listingCurrency: ProductCurrency;
  listingPriceInput: string;
  onChangeListingPriceInput: (value: string) => void;
  onRequestListing: () => void;
  onSelectItem: (item: ItemView) => void;
  onSelectListingCurrency: (currency: ProductCurrency) => void;
  productsById: Map<string, CommerceProductExtras>;
  productsByTitle: Map<string, CommerceProductExtras>;
  selectedListingItem: ItemView | null;
  selectedListingProduct: CommerceProductExtras | null;
  resolveItemProduct: (item: ItemView, productsById: Map<string, CommerceProductExtras>, productsByTitle: Map<string, CommerceProductExtras>) => CommerceProductExtras | null;
}) {
  return (
    <div className="app-commerce-listing-composer">
      <section className="app-commerce-listing-composer__panel">
        <div className="app-commerce-listing-composer__panel-head">
          <strong>可流转资产</strong>
          <span>选择一件准备上架到小巴扎的虚拟资产。</span>
        </div>

        {listableItems.length === 0 ? (
          <div className="app-commerce-listing-composer__empty">当前筛选下暂无可上架资产。</div>
        ) : (
          <div className="app-commerce-listing-composer__asset-grid">
            {listableItems.map((item) => (
              <TransferableAssetCard
                active={selectedListingItem?.id === item.id}
                item={item}
                key={item.id}
                onSelect={() => onSelectItem(item)}
                product={resolveItemProduct(item, productsById, productsByTitle)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="app-commerce-listing-composer__panel app-commerce-listing-composer__panel--form">
        <div className="app-commerce-listing-composer__panel-head">
          <strong>上架信息</strong>
          <span>填写价格并确认后，资产会直接从你的仓库流转到小巴扎。</span>
        </div>

        {selectedListingItem ? (
          <div className="app-commerce-listing-form">
            {(() => {
              const selectedListingSupportLabel = selectedListingProduct ? getProductSupportLabel(selectedListingProduct) : null;
              const selectedListingServiceTermLabel = getProductServiceTermLabel(selectedListingProduct);

              return (
                <>
                  <div className="app-commerce-listing-form__summary">
                    <div className="app-commerce-listing-form__summary-row">
                      <span>商品</span>
                      <strong>{selectedListingProduct?.title ?? selectedListingItem.productTitle}</strong>
                    </div>
                    <div className="app-commerce-listing-form__summary-row">
                      <span>分类</span>
                      <strong>{getProductCardLabel(selectedListingProduct)}</strong>
                    </div>
                    <div className="app-commerce-listing-form__summary-row">
                      <span>市场</span>
                      <strong>{listingCurrency === "mira" ? "米拉市场" : "耀晶市场"}</strong>
                    </div>
                  </div>

                  <div className="app-commerce-listing-form__field">
                    <span>上架市场</span>
                    <div className="app-commerce-listing-form__market-toggle" role="group" aria-label="选择上架货币">
                      <button
                        className={cn(
                          "app-commerce-listing-form__market-option",
                          listingCurrency === "obsidian" && "app-commerce-listing-form__market-option--active",
                        )}
                        onClick={() => onSelectListingCurrency("obsidian")}
                        type="button"
                      >
                        <CommerceCurrencyImage className="app-commerce-listing-form__market-icon" currency="obsidian" />
                        <span>耀晶</span>
                      </button>
                      <button
                        className={cn(
                          "app-commerce-listing-form__market-option",
                          listingCurrency === "mira" && "app-commerce-listing-form__market-option--active",
                        )}
                        onClick={() => onSelectListingCurrency("mira")}
                        type="button"
                      >
                        <CommerceCurrencyImage className="app-commerce-listing-form__market-icon" currency="mira" />
                        <span>米拉</span>
                      </button>
                    </div>
                  </div>

                  <label className="app-commerce-listing-form__field">
                    <span>上架价格</span>
                    <div className="app-commerce-listing-form__input-wrap">
                      <CommerceCurrencyImage className="app-commerce-listing-form__input-icon" currency={listingCurrency} />
                      <input
                        inputMode="numeric"
                        min={1}
                        onChange={(event) => onChangeListingPriceInput(event.target.value)}
                        placeholder="输入价格"
                        type="number"
                        value={listingPriceInput}
                      />
                    </div>
                  </label>

                  <div className="app-commerce-listing-form__hint-row">
                    {selectedListingSupportLabel ? (
                      <span className="app-commerce-listing-form__hint-chip">{selectedListingSupportLabel}</span>
                    ) : null}
                    {selectedListingServiceTermLabel ? (
                      <span className="app-commerce-listing-form__hint-chip">{selectedListingServiceTermLabel}</span>
                    ) : null}
                  </div>

                  <div className="app-commerce-listing-form__actions">
                    <button className="mg-btn mg-btn--primary" onClick={onRequestListing} type="button">
                      上架
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="app-commerce-listing-composer__empty">请先从左侧选择一个可流转资产。</div>
        )}
      </section>
    </div>
  );
}
