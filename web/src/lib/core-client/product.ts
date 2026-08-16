import {
  type InternalUserContext,
  type DiscountCodeOperatorMutationResult,
  type DiscountCodeBatchMutationResult,
  type DiscountCodeOperatorView,
  type ListOperatorProductsInput,
  type ProductOperatorMutationResult,
  type ProductOperatorPage,
  type UpsertDiscountCodeInput,
  type ApplyDiscountCodeBatchInput,
  type ListOperatorDiscountCodesInput,
  type UpsertProductInput,
} from "@neuro/contracts";

import type {
  ProductListItem,
} from "./types";

import { coreRequest } from "./request";

export async function listProducts(userContext: InternalUserContext) {
  const response = await coreRequest<{ products: ProductListItem[] }>("/v1/products", {
    userContext,
  });
  return response.products;
}

export async function listOperatorProductPage(
  userContext: InternalUserContext,
  input?: ListOperatorProductsInput,
) {
  const params = new URLSearchParams();
  if (input?.cursor) params.set("cursor", input.cursor);
  if (typeof input?.limit === "number") params.set("limit", String(input.limit));
  const path = params.size > 0 ? `/v1/internal/products?${params.toString()}` : "/v1/internal/products";
  return coreRequest<ProductOperatorPage>(path, {
    userContext,
  });
}

export async function listOperatorProducts(userContext: InternalUserContext) {
  const response = await listOperatorProductPage(userContext, { limit: 100 });
  return response.products;
}

export async function listOperatorDiscountCodes(
  userContext: InternalUserContext,
  filters?: ListOperatorDiscountCodesInput,
) {
  const params = new URLSearchParams();
  if (filters?.productId) params.set("productId", filters.productId);
  if (filters?.state && filters.state !== "all") params.set("state", filters.state);
  if (filters?.scope && filters.scope !== "all") params.set("scope", filters.scope);
  if (filters?.audienceScope && filters.audienceScope !== "all") params.set("audienceScope", filters.audienceScope);
  if (filters?.namespace) params.set("namespace", filters.namespace);
  if (filters?.batchLabel) params.set("batchLabel", filters.batchLabel);
  if (typeof filters?.windowDays === "number") params.set("windowDays", String(filters.windowDays));
  const path = params.size > 0 ? `/v1/internal/discount-codes?${params.toString()}` : "/v1/internal/discount-codes";
  const response = await coreRequest<{ discountCodes: DiscountCodeOperatorView[] }>(path, {
    userContext,
  });
  return response.discountCodes;
}

export async function upsertOperatorProduct(
  userContext: InternalUserContext,
  productId: string,
  input: UpsertProductInput,
) {
  const response = await coreRequest<{ result: ProductOperatorMutationResult }>(
    `/v1/internal/products/${encodeURIComponent(productId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function deleteOperatorProduct(userContext: InternalUserContext, productId: string) {
  const response = await coreRequest<{ result: { productId: string; title: string } }>(
    `/v1/internal/products/${encodeURIComponent(productId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.result;
}

export async function upsertOperatorDiscountCode(
  userContext: InternalUserContext,
  discountCodeId: string,
  input: UpsertDiscountCodeInput,
) {
  const response = await coreRequest<{ result: DiscountCodeOperatorMutationResult }>(
    `/v1/internal/discount-codes/${encodeURIComponent(discountCodeId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function applyOperatorDiscountCodeBatch(
  userContext: InternalUserContext,
  input: ApplyDiscountCodeBatchInput,
) {
  const response = await coreRequest<{ result: DiscountCodeBatchMutationResult }>("/v1/internal/discount-codes/batch", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.result;
}
