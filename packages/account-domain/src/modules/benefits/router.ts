import {
  benefitApiDeliveryModes,
  credentialAssignmentModes,
  credentialProviderKeys,
  benefitFamilyKeys,
  benefitFamilyTones,
  benefitRefillDeliveryModes,
  benefitServiceKinds,
  benefitServiceStatuses,
} from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  archiveBenefitServiceForOperator,
  createBenefitGrantForOperator,
  createBenefitProductBindingForOperator,
  createBenefitProductLineForOperator,
  createBenefitServiceForOperator,
  deleteBenefitProductBindingForOperator,
  deleteBenefitProductLineForOperator,
  deleteBenefitServiceForOperator,
  ensureBenefitCatalogSeeded,
  getBenefitPanel,
  importBenefitCredentialPoolForOperator,
  listOperatorBenefitAssignments,
  listOperatorBenefitCatalog,
  listOperatorBenefitCredentialPools,
  listOperatorBenefitGrants,
  listOperatorBenefitProductBindings,
  resolveBenefitServiceApiAccessForUser,
  resolveBenefitServicePromptCacheSummaryForUser,
  resolveBenefitServicePromptCacheTrendReportForUser,
  revokeBenefitGrantForOperator,
  rotateBenefitServiceApiAccessForUser,
  rotateBenefitAssignmentForOperator,
  searchBenefitUsersForOperator,
  updateBenefitFamilyForOperator,
  updateBenefitProductLineForOperator,
  updateBenefitServiceForOperator,
} from "@/modules/benefits/service";
import { readBenefitCredentialConfig } from "@/modules/credential-pools/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const benefitFamilyUpsertSchema = z.object({
  title: z.string().trim().min(1).max(80),
  tone: z.enum(benefitFamilyTones),
  description: z.string().trim().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0),
});

const benefitServiceConfigSchema = z.object({
  title: z.string().trim().min(1).max(80),
  providerKey: z.enum(credentialProviderKeys).optional(),
  assignmentMode: z.enum(credentialAssignmentModes).optional(),
  payloadSchemaVersion: z.string().trim().min(1).max(80).optional(),
  refillDeliveryMode: z.enum(benefitRefillDeliveryModes).optional(),
  refillModeText: z.string().trim().min(1).max(80),
  availabilityLabel: z.string().trim().min(1).max(80),
  availabilityText: z.string().trim().min(1).max(80),
  apiDeliveryMode: z.enum(benefitApiDeliveryModes).optional(),
  apiModeText: z.string().trim().min(1).max(80),
  apiUrl: z.string().trim().min(1).max(500),
  downloadEnabled: z.boolean(),
  downloadUrl: z.string().trim().max(1000).nullable().optional(),
});

const benefitServiceUpsertSchema = z.object({
  familyKey: z.enum(benefitFamilyKeys),
  productLineId: z.string().nullable().optional(),
  serviceKind: z.enum(benefitServiceKinds),
  status: z.enum(benefitServiceStatuses),
  title: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0),
  config: benefitServiceConfigSchema,
});

const benefitFamilyParamsSchema = z.object({
  familyKey: z.enum(benefitFamilyKeys),
});

const benefitServiceParamsSchema = z.object({
  serviceId: z.string().trim().min(1),
});

const benefitBindingParamsSchema = z.object({
  bindingId: z.string().trim().min(1),
});

const benefitGrantParamsSchema = z.object({
  grantId: z.string().trim().min(1),
});

const benefitAssignmentParamsSchema = z.object({
  serviceId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

const createBenefitBindingSchema = z.object({
  serviceId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
});

const createBenefitGrantSchema = z.object({
  serviceId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

const importBenefitCredentialEntrySchema = z.object({
  entryLabel: z.string().trim().max(120).nullable().optional(),
  refillCode: z.string().trim().max(2000).nullable().optional(),
  apiKey: z.string().trim().max(2000).nullable().optional(),
  apiUrl: z.string().trim().max(2000).nullable().optional(),
});

const importBenefitCredentialPoolSchema = z.object({
  serviceId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
  importNote: z.string().trim().max(2000).nullable().optional(),
  entries: z.array(importBenefitCredentialEntrySchema).min(1).max(500),
});

const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export const benefitsRouter: FastifyPluginAsync = async (app) => {
  // Seed benefit catalog on startup (not per-request)
  app.addHook("onReady", async () => {
    try {
      await ensureBenefitCatalogSeeded();
    } catch {
      // Non-fatal: catalog may already be seeded
    }
  });

  app.get("/v1/me/benefits/panel", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("benefits");
    const { userId } = assertUserContext(request);
    return {
      panel: await getBenefitPanel(userId),
    };
  });

  app.post<{ Params: z.infer<typeof benefitServiceParamsSchema> }>(
    "/v1/me/benefits/services/:serviceId/api-access",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId } = assertUserContext(request);
      const { serviceId } = benefitServiceParamsSchema.parse(request.params);
      return {
        access: await resolveBenefitServiceApiAccessForUser(serviceId, userId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof benefitServiceParamsSchema> }>(
    "/v1/me/benefits/services/:serviceId/api-access/rotate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId } = assertUserContext(request);
      const { serviceId } = benefitServiceParamsSchema.parse(request.params);
      return {
        access: await rotateBenefitServiceApiAccessForUser(serviceId, userId),
      };
    },
  );

  app.get<{ Params: z.infer<typeof benefitServiceParamsSchema> }>(
    "/v1/me/benefits/services/:serviceId/prompt-cache-summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId } = assertUserContext(request);
      const { serviceId } = benefitServiceParamsSchema.parse(request.params);
      return {
        summary: await resolveBenefitServicePromptCacheSummaryForUser(serviceId, userId),
      };
    },
  );

  app.get<{ Params: z.infer<typeof benefitServiceParamsSchema> }>(
    "/v1/me/benefits/services/:serviceId/prompt-cache-trend-report",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId } = assertUserContext(request);
      const { serviceId } = benefitServiceParamsSchema.parse(request.params);
      return {
        report: await resolveBenefitServicePromptCacheTrendReportForUser(serviceId, userId),
      };
    },
  );

  app.get("/v1/internal/benefits/catalog", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("benefits");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      catalog: await listOperatorBenefitCatalog(userId, providerUserId),
    };
  });

  app.post<{ Params: z.infer<typeof benefitFamilyParamsSchema>; Body: z.infer<typeof benefitFamilyUpsertSchema> }>(
    "/v1/internal/benefits/families/:familyKey",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { familyKey } = benefitFamilyParamsSchema.parse(request.params);
      const payload = benefitFamilyUpsertSchema.parse(request.body ?? {});
      return {
        family: await updateBenefitFamilyForOperator(userId, providerUserId, familyKey, {
          title: payload.title,
          tone: payload.tone,
          description: payload.description ?? null,
          sortOrder: payload.sortOrder,
        }),
      };
    },
  );

  // Product line CRUD
  app.post(
    "/v1/internal/benefits/product-lines",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const body = request.body as { familyKey: string; name: string; displayName: string; description?: string | null; sortOrder?: number; status?: string };
      return { productLine: await createBenefitProductLineForOperator(userId, providerUserId, {
        familyKey: body.familyKey,
        name: body.name,
        displayName: body.displayName,
        description: body.description ?? null,
        sortOrder: body.sortOrder ?? 100,
        status: body.status ?? "active",
      }) };
    },
  );

  app.post<{ Params: { productLineId: string } }>(
    "/v1/internal/benefits/product-lines/:productLineId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const body = request.body as { name?: string; displayName?: string; description?: string | null; sortOrder?: number; status?: string };
      return { productLine: await updateBenefitProductLineForOperator(userId, providerUserId, request.params.productLineId, body) };
    },
  );

  app.post<{ Params: { productLineId: string } }>(
    "/v1/internal/benefits/product-lines/:productLineId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      await deleteBenefitProductLineForOperator(userId, providerUserId, request.params.productLineId);
      return { ok: true };
    },
  );

  app.post<{ Body: z.infer<typeof benefitServiceUpsertSchema> }>(
    "/v1/internal/benefits/services",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = benefitServiceUpsertSchema.parse(request.body ?? {});
      const config = readBenefitCredentialConfig(payload.config);
      return {
        service: await createBenefitServiceForOperator(userId, providerUserId, {
          familyKey: payload.familyKey,
          serviceKind: payload.serviceKind,
          status: payload.status,
          title: payload.title,
          sortOrder: payload.sortOrder,
          config,
        }),
      };
    },
  );

  app.post<{ Params: z.infer<typeof benefitServiceParamsSchema>; Body: z.infer<typeof benefitServiceUpsertSchema> }>(
    "/v1/internal/benefits/services/:serviceId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { serviceId } = benefitServiceParamsSchema.parse(request.params);
      const payload = benefitServiceUpsertSchema.parse(request.body ?? {});
      const config = readBenefitCredentialConfig(payload.config);
      return {
        service: await updateBenefitServiceForOperator(userId, providerUserId, serviceId, {
          familyKey: payload.familyKey,
          serviceKind: payload.serviceKind,
          status: payload.status,
          title: payload.title,
          sortOrder: payload.sortOrder,
          config,
        }),
      };
    },
  );

  app.post<{ Params: z.infer<typeof benefitServiceParamsSchema> }>(
    "/v1/internal/benefits/services/:serviceId/archive",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { serviceId } = benefitServiceParamsSchema.parse(request.params);
      return {
        service: await archiveBenefitServiceForOperator(userId, providerUserId, serviceId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof benefitServiceParamsSchema> }>(
    "/v1/internal/benefits/services/:serviceId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { serviceId } = benefitServiceParamsSchema.parse(request.params);
      await deleteBenefitServiceForOperator(userId, providerUserId, serviceId);
      return { ok: true as const };
    },
  );

  app.get("/v1/internal/benefits/product-bindings", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("benefits");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      productBindings: await listOperatorBenefitProductBindings(userId, providerUserId),
    };
  });

  app.post<{ Body: z.infer<typeof createBenefitBindingSchema> }>(
    "/v1/internal/benefits/product-bindings",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = createBenefitBindingSchema.parse(request.body ?? {});
      return {
        productBinding: await createBenefitProductBindingForOperator(userId, providerUserId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof benefitBindingParamsSchema> }>(
    "/v1/internal/benefits/product-bindings/:bindingId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { bindingId } = benefitBindingParamsSchema.parse(request.params);
      await deleteBenefitProductBindingForOperator(userId, providerUserId, bindingId);
      return { ok: true as const };
    },
  );

  app.get("/v1/internal/benefits/grants", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("benefits");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      grants: await listOperatorBenefitGrants(userId, providerUserId),
    };
  });

  app.post<{ Body: z.infer<typeof createBenefitGrantSchema> }>(
    "/v1/internal/benefits/grants",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = createBenefitGrantSchema.parse(request.body ?? {});
      await createBenefitGrantForOperator(userId, providerUserId, payload);
      return { ok: true as const };
    },
  );

  app.post<{ Params: z.infer<typeof benefitGrantParamsSchema> }>(
    "/v1/internal/benefits/grants/:grantId/revoke",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const { grantId } = benefitGrantParamsSchema.parse(request.params);
      await revokeBenefitGrantForOperator(userId, providerUserId, grantId);
      return { ok: true as const };
    },
  );

  app.get("/v1/internal/benefits/credential-pools", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("benefits");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      credentialPools: await listOperatorBenefitCredentialPools(userId, providerUserId),
    };
  });

  app.post<{ Body: z.infer<typeof importBenefitCredentialPoolSchema> }>(
    "/v1/internal/benefits/credential-pools/import",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const payload = importBenefitCredentialPoolSchema.parse(request.body ?? {});
      await importBenefitCredentialPoolForOperator(userId, providerUserId, {
        serviceId: payload.serviceId,
        label: payload.label,
        importNote: payload.importNote ?? null,
        entries: payload.entries.map((entry) => ({
          entryLabel: entry.entryLabel ?? null,
          refillCode: entry.refillCode ?? null,
          apiKey: entry.apiKey ?? null,
          apiUrl: entry.apiUrl ?? null,
        })),
      });
      return { ok: true as const };
    },
  );

  app.get("/v1/internal/benefits/assignments", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("benefits");
    const { userId, providerUserId } = assertUserContext(request);
    return {
      assignments: await listOperatorBenefitAssignments(userId, providerUserId),
    };
  });

  app.post<{ Params: z.infer<typeof benefitAssignmentParamsSchema> }>(
    "/v1/internal/benefits/assignments/:serviceId/:userId/rotate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId: operatorUserId, providerUserId } = assertUserContext(request);
      const { serviceId, userId } = benefitAssignmentParamsSchema.parse(request.params);
      await rotateBenefitAssignmentForOperator(operatorUserId, providerUserId, serviceId, userId);
      return { ok: true as const };
    },
  );

  app.get<{ Querystring: z.infer<typeof userSearchQuerySchema> }>(
    "/v1/internal/benefits/users/search",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("benefits");
      const { userId, providerUserId } = assertUserContext(request);
      const query = userSearchQuerySchema.parse(request.query ?? {});
      return {
        users: await searchBenefitUsersForOperator(userId, providerUserId, query.q),
      };
    },
  );
};
