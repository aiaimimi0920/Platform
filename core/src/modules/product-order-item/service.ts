// Facade for the product-order-item service layer.
// The implementation was split into cohesive submodules under ./service/;
// this file re-exports the original public API so importers stay unchanged.

export {
  deleteProductDefinitionAsOperator,
  ensureDefaultProducts,
  getProductDetail,
  listProducts,
  listProductsForOperator,
  upsertProductDefinitionAsOperator,
} from "./service/product-catalog";

export {
  applyDiscountCodeBatchAsOperator,
  ensureDefaultDiscountCodes,
  getDiscountCodeDetail,
  listDiscountCodesForOperator,
  upsertDiscountCodeAsOperator,
} from "./service/discount-codes";

export {
  createOrder,
  getUserItems,
  getUserOrders,
  grantItemDirect,
  rollbackOrderAsOperator,
} from "./service/order-lifecycle";

export {
  reconcileDueItems,
  reconcileItemFulfillment,
  reportItemUnitIssue,
} from "./service/fulfillment";

export {
  assignBalancedItemManualReview,
  assignItemManualReview,
  autoAssignSlaItemManualReviews,
  autoRebalanceItemManualReviews,
  claimItemManualReview,
  claimNextItemManualReview,
  getManualReviewSlaSummary,
  getManualReviewWorkload,
  getOpenItemManualReviewSummary,
  listManualReviewSlaPolicies,
  listOpenItemManualReviews,
  rebalanceItemManualReviews,
  releaseItemManualReview,
  releaseStaleItemManualReviews,
  resolveItemManualReview,
} from "./service/manual-review";

export {
  escalateFulfillmentAnomalies,
  getFulfillmentOpsSummary,
  listFulfillmentAnomalyPolicies,
  listOpenFulfillmentAnomalies,
  syncManualReviewSlaAnomalies,
} from "./service/fulfillment-anomalies";

export {
  markItemListed,
  releaseListedItem,
  transferMarketplaceItem,
} from "./service/marketplace";
