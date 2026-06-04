import type { MutableRefObject } from "react";

import { createListingAction, purchaseListingAction, submitOrderAction } from "@/lib/platform-actions";

import type { PendingCommerceTransaction } from "../model";
import { formatNumber } from "../utils";
import { CommerceCurrencyImage, ConfirmIcon } from "./primitives";

export function CommerceConfirmDialog({
  confirmCancelButtonRef,
  confirmSubmitting,
  pendingTransaction,
  titleId,
  onCancel,
  onSubmitStart,
}: {
  confirmCancelButtonRef: MutableRefObject<HTMLButtonElement | null>;
  confirmSubmitting: boolean;
  pendingTransaction: PendingCommerceTransaction;
  titleId: string;
  onCancel: () => void;
  onSubmitStart: () => void;
}) {
  return (
    <div className="app-commerce-confirm" role="presentation">
      <button aria-label="关闭交易确认" className="app-commerce-confirm__backdrop" onClick={onCancel} type="button" />

      <section aria-labelledby={`${titleId}-confirm`} aria-modal="true" className="app-commerce-confirm__dialog" role="dialog">
        <div className="app-commerce-confirm__title">
          <span className="app-commerce-confirm__title-mark" aria-hidden="true">
            <ConfirmIcon />
          </span>
          <div className="app-commerce-confirm__title-copy">
            <strong id={`${titleId}-confirm`}>{pendingTransaction.confirmTitle}</strong>
            <span>{pendingTransaction.subtitle}</span>
          </div>
        </div>

        <div className="app-commerce-confirm__summary">
          <div className="app-commerce-confirm__summary-row">
            <span>商品</span>
            <strong>{pendingTransaction.title}</strong>
          </div>
          <div className="app-commerce-confirm__summary-row">
            <span>{pendingTransaction.actionKind === "listing" ? "售价" : "支付"}</span>
            <strong className="app-commerce-confirm__price">
              <CommerceCurrencyImage className="app-commerce-confirm__price-icon" currency={pendingTransaction.currency} />
              <span>{formatNumber(pendingTransaction.price)}</span>
            </strong>
          </div>
        </div>

        <form
          className="app-commerce-confirm__form"
          action={
            pendingTransaction.actionKind === "official"
              ? submitOrderAction
              : pendingTransaction.actionKind === "marketplace"
                ? purchaseListingAction
                : createListingAction
          }
          onSubmit={onSubmitStart}
        >
          {pendingTransaction.actionKind === "official" ? (
            <input name="productId" type="hidden" value={pendingTransaction.productId} />
          ) : pendingTransaction.actionKind === "marketplace" ? (
            <input name="listingId" type="hidden" value={pendingTransaction.listingId} />
          ) : (
            <>
              <input name="itemId" type="hidden" value={pendingTransaction.itemId} />
              <input name="price" type="hidden" value={String(pendingTransaction.price)} />
              <input name="currency" type="hidden" value={pendingTransaction.currency} />
            </>
          )}
          <input name="redirectTo" type="hidden" value={pendingTransaction.redirectTo} />

          {pendingTransaction.actionKind === "official" && pendingTransaction.allowDiscountCodes && (
            <div className="app-commerce-confirm__code-row">
              <input
                autoComplete="off"
                className="app-commerce-confirm__code-input"
                disabled={confirmSubmitting}
                name="discountCode"
                placeholder="输入优惠码（可选）"
                type="text"
              />
            </div>
          )}

          <div className="app-commerce-confirm__actions">
            <button className="mg-btn mg-btn--secondary" onClick={onCancel} ref={confirmCancelButtonRef} type="button">
              取消
            </button>
            <button className="mg-btn mg-btn--primary" disabled={confirmSubmitting} type="submit">
              {confirmSubmitting ? "处理中…" : pendingTransaction.actionLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
