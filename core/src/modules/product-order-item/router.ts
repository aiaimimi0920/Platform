import type { UpsertDiscountCodeInput } from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  autoAssignSlaItemManualReviews,
  autoRebalanceItemManualReviews,
  assignBalancedItemManualReview,
  assignItemManualReview,
  applyDiscountCodeBatchAsOperator,
  claimItemManualReview,
  claimNextItemManualReview,
  createOrder,
  deleteProductDefinitionAsOperator,
  getFulfillmentOpsSummary,
  listFulfillmentAnomalyPolicies,
  listDiscountCodesForOperator,
  listManualReviewSlaPolicies,
  getManualReviewSlaSummary,
  getManualReviewWorkload,
  getProductDetail,
  getOpenItemManualReviewSummary,
  getUserItems,
  getUserOrders,
  listOpenFulfillmentAnomalies,
  listOpenItemManualReviews,
  listProductsForOperator,
  listProducts,
  rebalanceItemManualReviews,
  releaseItemManualReview,
  releaseStaleItemManualReviews,
  rollbackOrderAsOperator,
  reconcileDueItems,
  reconcileItemFulfillment,
  resolveItemManualReview,
  reportItemUnitIssue,
  escalateFulfillmentAnomalies,
  syncManualReviewSlaAnomalies,
  upsertDiscountCodeAsOperator,
  upsertProductDefinitionAsOperator,
} from "@/modules/product-order-item/service";
import { syncProductGatewayAccessGrantByItem } from "@/modules/product-order-item/gateway-access-grants";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";

const createOrderSchema = z.object({
  productId: z.string().min(1),
  discountCode: z.string().trim().min(1).optional(),
});

const rollbackOrderSchema = z.object({
  reason: z.string().trim().min(1).max(240).optional(),
  note: z.string().trim().min(1).max(4000).optional(),
});

const reportItemUnitIssueSchema = z.object({
  reason: z.enum(["invalidated", "expired", "quota_exhausted", "normal_exhaustion"]),
});

const reconcileDueItemsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

const resolveManualReviewSchema = z.object({
  action: z.enum(["approve_replacement", "reject_report"]),
  resolutionNote: z.string().max(4000).optional(),
});

const listManualReviewsQuerySchema = z.object({
  status: z.enum(["open", "approved", "rejected", "all"]).optional(),
  reason: z.enum(["invalidated", "expired", "quota_exhausted", "normal_exhaustion"]).optional(),
  routingCode: z.string().trim().min(1).optional(),
  suggestedAction: z.string().trim().min(1).optional(),
  rejectionCategory: z.enum(["manual_review", "warranty_window", "policy_restriction", "usage_exhaustion"]).optional(),
  appealable: z.enum(["true", "false"]).optional(),
  priority: z.enum(["normal", "high", "urgent"]).optional(),
  slaBucket: z.enum(["on_track", "due_soon", "breached"]).optional(),
  assignee: z.string().trim().min(1).optional(),
  claimedAt: z.enum(["claimed", "unclaimed"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const releaseStaleManualReviewsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const syncManualReviewSlaAnomaliesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const escalateFulfillmentAnomaliesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const listFulfillmentAnomaliesQuerySchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
    kind: z
      .enum([
        "manual_review_routed",
        "reconcile_failure",
        "stale_manual_review",
        "sla_due_soon_unclaimed",
        "sla_breach_unclaimed",
      ])
      .optional(),
  severity: z.enum(["warning", "critical"]).optional(),
  alertLevel: z.coerce.number().int().min(0).max(10).optional(),
  policyKey: z.string().trim().min(1).optional(),
  autoActionStatus: z.enum(["applied", "noop", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const assignBalancedManualReviewSchema = z.object({
  reviewId: z.string().trim().min(1).optional(),
  assigneePool: z.array(z.string().trim().min(1)).max(50).optional(),
});

const claimNextManualReviewSchema = z.object({
  templateKey: z.string().trim().min(1).optional(),
});

const manualReviewSlaSummaryQuerySchema = z.object({
  assignee: z.string().trim().min(1).optional(),
  priority: z.enum(["normal", "high", "urgent"]).optional(),
});

const rebalanceManualReviewsSchema = z.object({
  strategy: z.enum(["least_loaded", "priority_first"]).optional(),
  maxAssignments: z.coerce.number().int().min(1).max(100).optional(),
  assigneePool: z.array(z.string().trim().min(1)).max(50).optional(),
  templateKey: z.string().trim().min(1).optional(),
});

const assignManualReviewSchema = z.object({
  assigneeUserId: z.string().trim().min(1),
});

const productIdParamsSchema = z.object({
  productId: z.string().trim().min(1),
});

const itemIdParamsSchema = z.object({
  itemId: z.string().trim().min(1),
});

const discountCodeIdParamsSchema = z.object({
  discountCodeId: z.string().trim().min(1),
});

const nullablePositiveIntSchema = z.number().int().positive().nullable();
const nullableDateTimeSchema = z.string().datetime({ offset: true }).nullable();

const upsertProductSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
  category: z.string().trim().min(1).max(80),
  kind: z.enum(["limitedTime", "limitedPurchase", "unlimited"]),
  currency: z.enum(["obsidian", "mira"]),
  price: z.number().int().min(0).max(1_000_000_000),
  fulfillmentMode: z.enum(["one_time_delivery", "duration_pass", "maintained_pool", "warranty_delivery"]),
  transferable: z.boolean(),
  active: z.boolean(),
  allowDiscountCodes: z.boolean(),
  limitScope: z.enum(["global", "targeted"]),
  targetedAudienceGroupKey: z.enum(["trusted_users", "new_users"]).nullable(),
  durationDays: nullablePositiveIntSchema,
  unitCount: nullablePositiveIntSchema,
  warrantyDays: nullablePositiveIntSchema,
  stockLabel: z.string().trim().min(1).max(120),
  tags: z.array(z.string().trim().min(1).max(80)).default([]),
  gatewayAccessBundleId: z.string().trim().min(1).max(160).nullable(),
  gatewayAccessGrantMode: z.enum(["time_pass", "token_prepaid", "message_prepaid"]).nullable(),
  gatewayAccessGrantQuantity: nullablePositiveIntSchema,
});

const upsertDiscountCodeSchema = z.object({
  code: z.string().trim().min(1).max(80),
  namespace: z.string().trim().min(1).max(120).nullable(),
  batchLabel: z.string().trim().min(1).max(120).nullable(),
  enabled: z.boolean(),
  scope: z.enum(["allProducts", "productCategory", "specificProduct"]),
  targetProductCategory: z.string().trim().min(1).max(80).nullable(),
  targetProductId: z.string().trim().min(1).max(120).nullable(),
  audienceScope: z.enum(["allUsers", "userGroup", "specificUser"]),
  audienceGroupKey: z.string().trim().min(1).max(120).nullable(),
  audienceUserId: z.string().trim().min(1).max(120).nullable(),
  valueKind: z.enum(["fixedAmount", "percentage"]),
  valueAmount: z.number().int().positive().max(1_000_000_000),
  totalMaxUses: nullablePositiveIntSchema,
  perUserLimit: nullablePositiveIntSchema,
  startsAt: nullableDateTimeSchema,
  expiresAt: nullableDateTimeSchema,
});

const listOperatorDiscountCodesQuerySchema = z.object({
  productId: z.string().trim().min(1).optional(),
  state: z.enum(["all", "enabled", "disabled", "expired", "expiring", "activeWindow", "scheduled"]).optional(),
  scope: z.enum(["all", "allProducts", "productCategory", "specificProduct"]).optional(),
  audienceScope: z.enum(["all", "allUsers", "userGroup", "specificUser"]).optional(),
  namespace: z.string().trim().min(1).max(120).optional(),
  batchLabel: z.string().trim().min(1).max(120).optional(),
  windowDays: z.coerce.number().int().min(1).max(365).optional(),
});

const applyDiscountCodeBatchSchema = z.object({
  discountCodeIds: z.array(z.string().trim().min(1)).min(1).max(200),
  action: z.enum(["enable", "disable", "extendExpiry", "disableExpired", "setQuota"]),
  extendDays: z.number().int().min(1).max(365).nullable().optional(),
  totalMaxUses: nullablePositiveIntSchema.optional(),
  perUserLimit: nullablePositiveIntSchema.optional(),
});

export const productOrderItemRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/products", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("product");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      products: await listProducts(userId),
    };
  });

  app.get<{ Params: { productId: string } }>(
    "/v1/products/:productId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("product");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        product: await getProductDetail(userId, request.params.productId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof createOrderSchema> }>(
    "/v1/orders",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("product");
      await requireModuleEnabled("item");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = createOrderSchema.parse(request.body);
      if (payload.discountCode) {
        await requireModuleEnabled("discountCode");
      }
      return createOrder(userId, payload.productId, payload.discountCode);
    },
  );

  app.get("/v1/orders", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("product");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      orders: await getUserOrders(userId),
    };
  });

  app.get("/v1/items", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("item");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      items: await getUserItems(userId),
    };
  });

  app.post<{ Params: { itemId: string; unitId: string }; Body: z.infer<typeof reportItemUnitIssueSchema> }>(
    "/v1/items/:itemId/units/:unitId/report-issue",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        item: await reportItemUnitIssue(
          userId,
          request.params.itemId,
          request.params.unitId,
          reportItemUnitIssueSchema.parse(request.body).reason,
        ),
      };
    },
  );

  app.post<{ Params: { itemId: string } }>(
    "/v1/items/:itemId/reconcile",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        item: await reconcileItemFulfillment(userId, request.params.itemId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof reconcileDueItemsSchema> }>(
    "/v1/internal/items/reconcile-due",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      return reconcileDueItems(reconcileDueItemsSchema.parse(request.body ?? {}).limit);
    },
  );

  app.post<{ Params: z.infer<typeof itemIdParamsSchema> }>(
    "/v1/internal/items/:itemId/gateway-access-grants/sync",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("product");
      const { itemId } = itemIdParamsSchema.parse(request.params);
      return {
        result: await syncProductGatewayAccessGrantByItem(itemId),
      };
    },
  );

  app.post<{ Params: { orderId: string }; Body: z.infer<typeof rollbackOrderSchema> }>(
    "/v1/internal/orders/:orderId/rollback",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("product");
      await requireModuleEnabled("item");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      return {
        result: await rollbackOrderAsOperator(userId, request.params.orderId, rollbackOrderSchema.parse(request.body ?? {})),
      };
    },
  );

  app.get("/v1/internal/products", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("product");
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperator(userId, providerUserId);
    return {
      products: await listProductsForOperator(),
    };
  });

  app.post<{
    Params: z.infer<typeof productIdParamsSchema>;
    Body: z.infer<typeof upsertProductSchema>;
  }>("/v1/internal/products/:productId", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("product");
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperator(userId, providerUserId);
    const { productId } = productIdParamsSchema.parse(request.params);
    const payload = upsertProductSchema.parse(request.body);
    return {
      result: await upsertProductDefinitionAsOperator(userId, productId, payload),
    };
  });

  app.post<{ Params: z.infer<typeof productIdParamsSchema> }>(
    "/v1/internal/products/:productId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("product");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      const { productId } = productIdParamsSchema.parse(request.params);
      return {
        result: await deleteProductDefinitionAsOperator(userId, productId),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listOperatorDiscountCodesQuerySchema> }>(
    "/v1/internal/discount-codes",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("discountCode");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      const query = listOperatorDiscountCodesQuerySchema.parse(request.query);
      return {
        discountCodes: await listDiscountCodesForOperator(query),
      };
    },
  );

  app.post<{
    Params: z.infer<typeof discountCodeIdParamsSchema>;
    Body: z.infer<typeof upsertDiscountCodeSchema>;
  }>("/v1/internal/discount-codes/:discountCodeId", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("discountCode");
    await requireModuleEnabled("product");
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperator(userId, providerUserId);
    const { discountCodeId } = discountCodeIdParamsSchema.parse(request.params);
    const payload = upsertDiscountCodeSchema.parse(request.body);
    return {
      result: await upsertDiscountCodeAsOperator(userId, discountCodeId, payload as UpsertDiscountCodeInput),
    };
  });

  app.post<{ Body: z.infer<typeof applyDiscountCodeBatchSchema> }>(
    "/v1/internal/discount-codes/batch",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("discountCode");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      const payload = applyDiscountCodeBatchSchema.parse(request.body);
      return {
        result: await applyDiscountCodeBatchAsOperator(userId, {
          discountCodeIds: payload.discountCodeIds,
          action: payload.action,
          extendDays: payload.extendDays ?? null,
          totalMaxUses: payload.totalMaxUses,
          perUserLimit: payload.perUserLimit,
        }),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listManualReviewsQuerySchema> }>(
    "/v1/internal/items/manual-reviews",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      const query = listManualReviewsQuerySchema.parse(request.query);
      return {
        reviews: await listOpenItemManualReviews(userId, query),
      };
    },
  );

  app.get("/v1/internal/items/manual-reviews/summary", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("item");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      summary: await getOpenItemManualReviewSummary(userId),
    };
  });

  app.get<{ Querystring: z.infer<typeof manualReviewSlaSummaryQuerySchema> }>(
    "/v1/internal/items/manual-reviews/sla-summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      const query = manualReviewSlaSummaryQuerySchema.parse(request.query);
      return {
        summary: await getManualReviewSlaSummary(userId, query),
      };
    },
  );

  app.get("/v1/internal/items/manual-reviews/workload", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("item");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      workload: await getManualReviewWorkload(userId),
    };
  });

  app.get("/v1/internal/items/ops-summary", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("item");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      summary: await getFulfillmentOpsSummary(userId),
    };
  });

  app.get("/v1/internal/items/anomaly-policies", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("item");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      policies: await listFulfillmentAnomalyPolicies(userId),
    };
  });

  app.get("/v1/internal/items/manual-review-sla-policies", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("item");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      policies: await listManualReviewSlaPolicies(userId),
    };
  });

  app.get<{ Querystring: z.infer<typeof listFulfillmentAnomaliesQuerySchema> }>(
    "/v1/internal/items/anomalies",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        anomalies: await listOpenFulfillmentAnomalies(
          userId,
          listFulfillmentAnomaliesQuerySchema.parse(request.query),
        ),
      };
    },
  );

  app.post<{ Params: { reviewId: string }; Body: z.infer<typeof resolveManualReviewSchema> }>(
    "/v1/internal/items/manual-reviews/:reviewId/resolve",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = resolveManualReviewSchema.parse(request.body);
      return {
        item: await resolveItemManualReview(userId, request.params.reviewId, payload.action, payload.resolutionNote),
      };
    },
  );

  app.post<{ Params: { reviewId: string } }>(
    "/v1/internal/items/manual-reviews/:reviewId/claim",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        review: await claimItemManualReview(userId, request.params.reviewId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof claimNextManualReviewSchema> }>(
    "/v1/internal/items/manual-reviews/claim-next",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        review: await claimNextItemManualReview(userId, claimNextManualReviewSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof assignBalancedManualReviewSchema> }>(
    "/v1/internal/items/manual-reviews/assign-balanced",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        review: await assignBalancedItemManualReview(userId, assignBalancedManualReviewSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof rebalanceManualReviewsSchema> }>(
    "/v1/internal/items/manual-reviews/rebalance",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        result: await rebalanceItemManualReviews(userId, rebalanceManualReviewsSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof rebalanceManualReviewsSchema> }>(
    "/v1/internal/items/manual-reviews/rebalance-auto",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        const { userId, providerUserId } = assertUserContext(request);
        assertPlatformOperator(userId, providerUserId);
      }
      return {
        result: await autoRebalanceItemManualReviews(rebalanceManualReviewsSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof rebalanceManualReviewsSchema> }>(
    "/v1/internal/items/manual-reviews/auto-assign-sla",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        assertPlatformOperator(headerUserId.trim());
      }
      return {
        result: await autoAssignSlaItemManualReviews(rebalanceManualReviewsSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Params: { reviewId: string }; Body: z.infer<typeof assignManualReviewSchema> }>(
    "/v1/internal/items/manual-reviews/:reviewId/assign",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = assignManualReviewSchema.parse(request.body ?? {});
      return {
        review: await assignItemManualReview(userId, request.params.reviewId, payload.assigneeUserId),
      };
    },
  );

  app.post<{ Params: { reviewId: string } }>(
    "/v1/internal/items/manual-reviews/:reviewId/release",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const { userId, providerUserId } = assertUserContext(request);
      return {
        review: await releaseItemManualReview(userId, request.params.reviewId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof releaseStaleManualReviewsSchema> }>(
    "/v1/internal/items/manual-reviews/release-stale",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        const { userId, providerUserId } = assertUserContext(request);
        assertPlatformOperator(userId, providerUserId);
      }
      return releaseStaleItemManualReviews(releaseStaleManualReviewsSchema.parse(request.body ?? {}));
    },
  );

  app.post<{ Body: z.infer<typeof syncManualReviewSlaAnomaliesSchema> }>(
    "/v1/internal/items/manual-reviews/sync-sla-anomalies",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        assertPlatformOperator(headerUserId.trim());
      }
      return {
        result: await syncManualReviewSlaAnomalies(syncManualReviewSlaAnomaliesSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof escalateFulfillmentAnomaliesSchema> }>(
    "/v1/internal/items/anomalies/escalate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("item");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        assertPlatformOperator(headerUserId.trim());
      }
      return {
        result: await escalateFulfillmentAnomalies(escalateFulfillmentAnomaliesSchema.parse(request.body ?? {})),
      };
    },
  );
};
