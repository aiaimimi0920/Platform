import {
  type CreateMarketplaceListingInput,
  type CreateOrderInput,
  type InternalUserContext,
  type MarketplaceListingView,
  type OrderView,
  type RedeemCodeInput,
  type RedeemResult,
  type RedemptionCodeView,
  type RedemptionCodeUsageView,
  type UpsertRedemptionCodeInput,
  type GenerateRedemptionCodeBatchInput,
  type RollbackOrderInput,
  type RollbackOrderResult,
} from "@neuro/contracts";

import type {
  ItemView,
} from "./types";

import { coreRequest } from "./request";

export async function createOrder(
  userContext: InternalUserContext,
  input: CreateOrderInput,
) {
  return coreRequest<{ order: OrderView; item: ItemView }>("/v1/orders", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function rollbackOrder(
  userContext: InternalUserContext,
  orderId: string,
  input: RollbackOrderInput = {},
) {
  const response = await coreRequest<{ result: RollbackOrderResult }>(
    `/v1/internal/orders/${encodeURIComponent(orderId)}/rollback`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function listOrders(userContext: InternalUserContext) {
  const response = await coreRequest<{ orders: OrderView[] }>("/v1/orders", {
    userContext,
  });
  return response.orders;
}

export async function listMarketplace(userContext: InternalUserContext) {
  const response = await coreRequest<{ listings: MarketplaceListingView[] }>("/v1/marketplace/listings", {
    userContext,
  });
  return response.listings;
}

export async function createMarketplaceListing(userContext: InternalUserContext, input: CreateMarketplaceListingInput) {
  return coreRequest("/v1/marketplace/listings", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function purchaseMarketplaceListing(userContext: InternalUserContext, listingId: string) {
  return coreRequest("/v1/marketplace/purchase", {
    method: "POST",
    body: { listingId },
    userContext,
  });
}

export async function redeemCode(userContext: InternalUserContext, input: RedeemCodeInput) {
  return coreRequest<{ result: RedeemResult }>("/v1/redemptions/redeem", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function listOperatorRedemptionCodes(userContext: InternalUserContext) {
  return coreRequest<{ codes: RedemptionCodeView[] }>("/v1/internal/redemption-codes", {
    userContext,
  });
}

export async function upsertOperatorRedemptionCode(
  userContext: InternalUserContext,
  input: UpsertRedemptionCodeInput,
  codeId?: string,
) {
  const path = codeId
    ? `/v1/internal/redemption-codes/${encodeURIComponent(codeId)}`
    : "/v1/internal/redemption-codes";
  return coreRequest<{ code: RedemptionCodeView }>(path, {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function listOperatorRedemptionCodeUsages(userContext: InternalUserContext, codeId: string) {
  return coreRequest<{ usages: RedemptionCodeUsageView[] }>(
    `/v1/internal/redemption-codes/${encodeURIComponent(codeId)}/usages`,
    { userContext },
  );
}

export async function generateOperatorRedemptionCodeBatch(
  userContext: InternalUserContext,
  input: GenerateRedemptionCodeBatchInput,
) {
  return coreRequest<{ codes: RedemptionCodeView[] }>("/v1/internal/redemption-codes/batch", {
    method: "POST",
    body: input,
    userContext,
  });
}
