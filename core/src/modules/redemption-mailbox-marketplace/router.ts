import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  cancelMarketplaceListingForUser,
  createMarketplaceListingForUser,
  ensureSeedRedemptionCodes,
  generateRedemptionCodeBatch,
  listMarketplace,
  listRedemptionCodes,
  listRedemptionCodeUsages,
  purchaseMarketplaceListingForUser,
  redeemCodeForUser,
  upsertRedemptionCode,
} from "@/modules/redemption-mailbox-marketplace/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, assertPlatformOperatorUser, withInternalRequest } from "@/platform/internal-auth";

const redeemCodeSchema = z.object({
  code: z.string().min(3),
});

const createListingSchema = z.object({
  itemId: z.string().min(1),
  price: z.number().int().positive(),
  currency: z.enum(["obsidian", "mira"]).optional(),
});

const purchaseListingSchema = z.object({
  listingId: z.string().min(1),
});

const redemptionRewardEntrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("walletGrant"), currency: z.string().min(1), amount: z.number().int().positive() }),
  z.object({ kind: z.literal("itemGrant"), productId: z.string().min(1) }),
]);

const redemptionEligibilitySchema = z.object({
  minTrustLevel: z.number().int().min(0).nullable().optional(),
  userGroup: z.string().nullable().optional(),
  userIds: z.array(z.string().min(1)).nullable().optional(),
}).nullable().optional();

const upsertRedemptionCodeSchema = z.object({
  code: z.string().min(3).max(64),
  active: z.boolean(),
  exclusionGroup: z.string().max(64).nullable().optional(),
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  eligibility: redemptionEligibilitySchema,
  rewards: z.array(redemptionRewardEntrySchema).min(1),
  maxUses: z.number().int().min(1),
  mailTitle: z.string().max(200).nullable().optional(),
  mailBody: z.string().max(2000).nullable().optional(),
  batchLabel: z.string().max(64).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

const generateBatchSchema = z.object({
  count: z.number().int().min(1).max(500),
  codePrefix: z.string().min(2).max(32),
  template: upsertRedemptionCodeSchema.omit({ code: true }),
});

export const redemptionMailboxMarketplaceRouter: FastifyPluginAsync = async (app) => {
  // Seed default codes on startup
  app.addHook("onReady", async () => {
    try {
      await ensureSeedRedemptionCodes();
    } catch {
      // Non-fatal: seed codes may already exist
    }
  });

  // ─── Operator routes: /v1/internal/redemption-codes ───

  app.get("/v1/internal/redemption-codes", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("redemption");
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperatorUser(userId, providerUserId);
    return { codes: await listRedemptionCodes() };
  });

  app.post<{ Body: z.infer<typeof upsertRedemptionCodeSchema> }>(
    "/v1/internal/redemption-codes",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("redemption");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      const payload = upsertRedemptionCodeSchema.parse(request.body);
      return { code: await upsertRedemptionCode(payload) };
    },
  );

  app.post<{ Params: { codeId: string }; Body: z.infer<typeof upsertRedemptionCodeSchema> }>(
    "/v1/internal/redemption-codes/:codeId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("redemption");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      const payload = upsertRedemptionCodeSchema.parse(request.body);
      return { code: await upsertRedemptionCode({ ...payload, id: request.params.codeId }) };
    },
  );

  app.get<{ Params: { codeId: string } }>(
    "/v1/internal/redemption-codes/:codeId/usages",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("redemption");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      return { usages: await listRedemptionCodeUsages(request.params.codeId) };
    },
  );

  app.post<{ Body: z.infer<typeof generateBatchSchema> }>(
    "/v1/internal/redemption-codes/batch",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("redemption");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      const payload = generateBatchSchema.parse(request.body);
      return { codes: await generateRedemptionCodeBatch(payload) };
    },
  );

  // ─── User routes: /v1/redemptions ───

  app.post<{ Body: z.infer<typeof redeemCodeSchema> }>(
    "/v1/redemptions/redeem",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("redemption");
      const { userId } = assertUserContext(request);
      const payload = redeemCodeSchema.parse(request.body);
      return { result: await redeemCodeForUser(userId, payload.code) };
    },
  );

  // ─── Marketplace routes ───

  app.get("/v1/marketplace/listings", { preHandler: withInternalRequest }, async () => {
    await requireModuleEnabled("marketplace");
    return { listings: await listMarketplace() };
  });

  app.post<{ Body: z.infer<typeof createListingSchema> }>(
    "/v1/marketplace/listings",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("marketplace");
      await requireModuleEnabled("item");
      const { userId } = assertUserContext(request);
      const payload = createListingSchema.parse(request.body);
      return { listing: await createMarketplaceListingForUser(userId, payload.itemId, payload.price, payload.currency) };
    },
  );

  app.post<{ Body: z.infer<typeof purchaseListingSchema> }>(
    "/v1/marketplace/purchase",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("marketplace");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      const payload = purchaseListingSchema.parse(request.body);
      return { listing: await purchaseMarketplaceListingForUser(userId, payload.listingId) };
    },
  );

  app.post<{ Params: { listingId: string } }>(
    "/v1/marketplace/listings/:listingId/cancel",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("marketplace");
      const { userId } = assertUserContext(request);
      return { listing: await cancelMarketplaceListingForUser(userId, request.params.listingId) };
    },
  );
};
