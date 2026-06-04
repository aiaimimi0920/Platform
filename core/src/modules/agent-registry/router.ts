import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { agentCallbackRemediationPolicyKeys, agentHostingModes } from "@neuro/contracts";
import {
  invokeAgentMarketplaceListing,
  listSuppliedAgentMarketplaceExecutions,
} from "@/modules/agent-execution/service";
import {
  addCapabilityToOwnedAgent,
  cleanupExpiredAgentCallbackCompatibility,
  createOwnedAgent,
  deleteOwnedAgent,
  getAgentCallbackCompatibilitySummaryForOperator,
  listAgentCallbackRemediationPolicies,
  listOwnedAgentMarketplaceListings,
  listOwnedAgentCallbackHistory,
  listOwnedAgentCallbackHealthSummaries,
  listOwnedAgentRecentCallbacks,
  listOwnedAgentCapabilities,
  listOperatorAgentCallbackHistory,
  listOwnedAgents,
  listPublicAgentMarketplaceListings,
  rotateOwnedAgentCallbackSecret,
  updateOwnedAgent,
  updateOwnedAgentCapability,
  updateOwnedAgentMarketplaceListingStatus,
  updateOwnedAgentCallbackRemediationPolicy,
  updateOwnedAgentCallbackProtocolVersion,
  upsertOwnedAgentMarketplaceListing,
} from "@/modules/agent-registry/service";
import { runGlobalAgentMarketplaceAutoProposalSweep, runOwnedAgentMarketplaceAutoProposalSweep } from "@/modules/task-hub/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";

const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(2000).nullable().optional(),
  sourceType: z.enum(["platform", "external"]),
  hostingMode: z.enum(agentHostingModes).optional(),
  runtimeEndpoint: z.string().url().nullable().optional(),
  authMode: z.enum(["none", "apiKey", "bearer"]).optional(),
  runtimeAuthToken: z.string().max(4000).nullable().optional(),
  managedServiceId: z.string().max(200).nullable().optional(),
  managedProviderLabel: z.string().max(120).nullable().optional(),
  managedApiBaseUrl: z.string().url().nullable().optional(),
  managedModel: z.string().max(120).nullable().optional(),
  managedApiKey: z.string().max(4000).nullable().optional(),
  managedSystemPrompt: z.string().max(12000).nullable().optional(),
  managedPromptTemplate: z.string().max(12000).nullable().optional(),
  managedTaskCategory: z.string().max(120).nullable().optional(),
  managedCapabilitySummary: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(2000).nullable().optional(),
  runtimeEndpoint: z.string().url().nullable().optional(),
  authMode: z.enum(["none", "apiKey", "bearer"]).optional(),
  runtimeAuthToken: z.string().max(4000).nullable().optional(),
  managedServiceId: z.string().max(200).nullable().optional(),
  managedProviderLabel: z.string().max(120).nullable().optional(),
  managedApiBaseUrl: z.string().url().nullable().optional(),
  managedModel: z.string().max(120).nullable().optional(),
  managedApiKey: z.string().max(4000).nullable().optional(),
  managedSystemPrompt: z.string().max(12000).nullable().optional(),
  managedPromptTemplate: z.string().max(12000).nullable().optional(),
  managedTaskCategory: z.string().max(120).nullable().optional(),
  managedCapabilitySummary: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().optional(),
});

const addCapabilitySchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().max(2000).nullable().optional(),
  routingSummary: z.string().max(2000).nullable().optional(),
  routingTags: z.array(z.string().min(1).max(80)).max(24).nullable().optional(),
  inputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  outputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  resourceNormalizationPrompt: z.string().max(12000).nullable().optional(),
  pricingNote: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().optional(),
});

const updateCapabilitySchema = z.object({
  title: z.string().min(1),
  description: z.string().max(2000).nullable().optional(),
  routingSummary: z.string().max(2000).nullable().optional(),
  routingTags: z.array(z.string().min(1).max(80)).max(24).nullable().optional(),
  inputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  outputSchema: z.record(z.string(), z.unknown()).nullable().optional(),
  resourceNormalizationPrompt: z.string().max(12000).nullable().optional(),
  pricingNote: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().optional(),
});

const updateCallbackProtocolSchema = z.object({
  protocolVersion: z.number().int().min(1).max(10),
});

const updateCallbackRemediationPolicySchema = z.object({
  policyKey: z.enum(agentCallbackRemediationPolicyKeys),
});

const callbackHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const callbackHealthQuerySchema = z.object({
  windowHours: z.coerce.number().int().min(1).max(24 * 30).optional(),
});

const compatibilityCleanupSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const marketplaceListingQuerySchema = z.object({
  scope: z.enum(["owner", "public"]).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
});

const publicMarketplaceListingShowcaseQuerySchema = z.object({
  agentIds: z.string().optional(),
  perAgentLimit: z.coerce.number().int().min(1).max(6).optional(),
});

const upsertMarketplaceListingSchema = z.object({
  capabilityId: z.string().min(1),
  publicTitle: z.string().min(1).max(160),
  publicDescription: z.string().max(4000).nullable().optional(),
  billingMode: z.enum(["flat_task", "token_metered", "property_metered"]).optional(),
  billingUnit: z.string().max(80).nullable().optional(),
  meterKey: z.string().max(80).nullable().optional(),
  priceCurrency: z.enum(["obsidian", "mira"]),
  priceAmount: z.number().int().min(1),
  status: z.enum(["draft", "published", "paused"]).optional(),
  externalInvocationEnabled: z.boolean().optional(),
  autoTakeEnabled: z.boolean().optional(),
  autoTakeStatementTemplate: z.string().max(4000).nullable().optional(),
});

const updateMarketplaceListingStatusSchema = z.object({
  status: z.enum(["draft", "published", "paused"]),
});

const autoProposalSweepSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const supplierExecutionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const invokeMarketplaceListingSchema = z.object({
  title: z.string().min(3).max(200),
  objective: z.string().min(10).max(12000),
  inputResourcePayload: z.record(z.string(), z.unknown()).nullable().optional(),
  meterQuantity: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
  runtimeProfileKey: z.enum(["baseline", "iterative", "deep_runtime"]).nullable().optional(),
});

const globalAutoProposalSweepSchema = z.object({
  ownerLimit: z.coerce.number().int().min(1).max(100).optional(),
  perOwnerLimit: z.coerce.number().int().min(1).max(50).optional(),
});

function parseCommaSeparatedAgentIds(raw: string | undefined) {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, 24);
}

export const agentRegistryRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/agents", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("agentRegistry");
    const { userId } = assertUserContext(request);
    return {
      agents: await listOwnedAgents(userId),
    };
  });

  app.get<{ Querystring: z.infer<typeof marketplaceListingQuerySchema> }>(
    "/v1/agents/marketplace/listings",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      const query = marketplaceListingQuerySchema.parse(request.query);
      return {
        listings:
          query.scope === "public"
            ? await listPublicAgentMarketplaceListings({ limit: query.limit })
            : await listOwnedAgentMarketplaceListings(userId),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof publicMarketplaceListingShowcaseQuerySchema> }>(
    "/v1/public/agents/marketplace/listings",
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const query = publicMarketplaceListingShowcaseQuerySchema.parse(request.query);
      const agentIds = parseCommaSeparatedAgentIds(query.agentIds);
      return {
        listings:
          agentIds.length > 0
            ? await listPublicAgentMarketplaceListings({
                agentIds,
                perAgentLimit: query.perAgentLimit,
              })
            : [],
      };
    },
  );

  app.post<{ Body: z.infer<typeof upsertMarketplaceListingSchema> }>(
    "/v1/agents/marketplace/listings",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        listing: await upsertOwnedAgentMarketplaceListing(userId, upsertMarketplaceListingSchema.parse(request.body)),
      };
    },
  );

  app.post<{ Params: { listingId: string }; Body: z.infer<typeof updateMarketplaceListingStatusSchema> }>(
    "/v1/agents/marketplace/listings/:listingId/status",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        listing: await updateOwnedAgentMarketplaceListingStatus(
          userId,
          request.params.listingId,
          updateMarketplaceListingStatusSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Body: z.infer<typeof autoProposalSweepSchema> }>(
    "/v1/agents/marketplace/auto-proposals/sweep",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("taskHub");
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        result: await runOwnedAgentMarketplaceAutoProposalSweep(
          userId,
          autoProposalSweepSchema.parse(request.body ?? {}).limit,
        ),
      };
    },
  );

  app.post<{ Body: z.infer<typeof globalAutoProposalSweepSchema> }>(
    "/v1/internal/agents/marketplace/auto-proposals/sweep-all",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("taskHub");
      await requireModuleEnabled("agentExecution");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        assertPlatformOperator(headerUserId.trim());
      }
      return {
        result: await runGlobalAgentMarketplaceAutoProposalSweep(globalAutoProposalSweepSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Params: { listingId: string }; Body: z.infer<typeof invokeMarketplaceListingSchema> }>(
    "/v1/agents/marketplace/listings/:listingId/invoke",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        result: await invokeAgentMarketplaceListing(
          userId,
          request.params.listingId,
          invokeMarketplaceListingSchema.parse(request.body),
        ),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof supplierExecutionQuerySchema> }>(
    "/v1/agents/marketplace/supplier-executions",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const query = supplierExecutionQuerySchema.parse(request.query);
      return {
        executions: await listSuppliedAgentMarketplaceExecutions(userId, query.limit),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof callbackHealthQuerySchema> }>(
    "/v1/agents/callback-health",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      const query = callbackHealthQuerySchema.parse(request.query);
      return {
        summaries: await listOwnedAgentCallbackHealthSummaries(userId, query.windowHours),
      };
    },
  );

  app.get(
    "/v1/internal/agents/callback-compatibility/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        summary: await getAgentCallbackCompatibilitySummaryForOperator(userId),
      };
    },
  );

  app.get(
    "/v1/agents/callback-remediation-policies",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        policies: await listAgentCallbackRemediationPolicies(userId),
      };
    },
  );

  app.get(
    "/v1/internal/agents/callback-remediation-policies",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        policies: await listAgentCallbackRemediationPolicies(userId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof createAgentSchema> }>(
    "/v1/agents",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      const payload = createAgentSchema.parse(request.body);
      return {
        agent: await createOwnedAgent(userId, payload),
      };
    },
  );

  app.post<{ Params: { agentId: string }; Body: z.infer<typeof updateAgentSchema> }>(
    "/v1/agents/:agentId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        agent: await updateOwnedAgent(userId, request.params.agentId, updateAgentSchema.parse(request.body)),
      };
    },
  );

  app.delete<{ Params: { agentId: string } }>(
    "/v1/agents/:agentId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return deleteOwnedAgent(userId, request.params.agentId);
    },
  );

  app.post<{ Params: { agentId: string } }>(
    "/v1/agents/:agentId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return deleteOwnedAgent(userId, request.params.agentId);
    },
  );

  app.get<{ Params: { agentId: string } }>(
    "/v1/agents/:agentId/callback-history",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      const query = callbackHistoryQuerySchema.parse(request.query);
      return {
        history: await listOwnedAgentCallbackHistory(userId, request.params.agentId, query.limit),
      };
    },
  );

  app.get<{ Params: { agentId: string } }>(
    "/v1/internal/agents/:agentId/callback-history",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      const query = callbackHistoryQuerySchema.parse(request.query);
      return {
        history: await listOperatorAgentCallbackHistory(userId, request.params.agentId, query.limit),
      };
    },
  );

  app.get<{ Params: { agentId: string } }>(
    "/v1/agents/:agentId/recent-callbacks",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      const query = callbackHistoryQuerySchema.parse(request.query);
      return {
        callbacks: await listOwnedAgentRecentCallbacks(userId, request.params.agentId, query.limit),
      };
    },
  );

  app.get<{ Params: { agentId: string } }>(
    "/v1/agents/:agentId/capabilities",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        capabilities: await listOwnedAgentCapabilities(userId, request.params.agentId),
      };
    },
  );

  app.post<{ Params: { agentId: string }; Body: z.infer<typeof addCapabilitySchema> }>(
    "/v1/agents/:agentId/capabilities",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      const payload = addCapabilitySchema.parse(request.body);
      return {
        capability: await addCapabilityToOwnedAgent(userId, request.params.agentId, payload),
      };
    },
  );

  app.post<{ Params: { agentId: string; capabilityId: string }; Body: z.infer<typeof updateCapabilitySchema> }>(
    "/v1/agents/:agentId/capabilities/:capabilityId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      const capability = await updateOwnedAgentCapability(
        userId,
        request.params.agentId,
        request.params.capabilityId,
        updateCapabilitySchema.parse(request.body),
      );
      return { capability };
    },
  );

  app.post<{ Params: { agentId: string } }>(
    "/v1/agents/:agentId/rotate-callback-secret",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return rotateOwnedAgentCallbackSecret(userId, request.params.agentId);
    },
  );

  app.post<{ Body: z.infer<typeof compatibilityCleanupSchema> }>(
    "/v1/internal/agents/callback-compatibility/cleanup-expired",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const query = compatibilityCleanupSchema.parse(request.body ?? {});
      const headerUserId = request.headers["x-neuro-user-id"];
      const actorUserId =
        typeof headerUserId === "string" && headerUserId.trim().length > 0 ? headerUserId.trim() : null;
      if (actorUserId) {
        assertPlatformOperator(actorUserId);
      }
      return {
        result: await cleanupExpiredAgentCallbackCompatibility({
          limit: query.limit,
          actorUserId,
        }),
      };
    },
  );

  app.post<{ Params: { agentId: string }; Body: z.infer<typeof updateCallbackProtocolSchema> }>(
    "/v1/agents/:agentId/callback-protocol",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        agent: await updateOwnedAgentCallbackProtocolVersion(
          userId,
          request.params.agentId,
          updateCallbackProtocolSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { agentId: string }; Body: z.infer<typeof updateCallbackRemediationPolicySchema> }>(
    "/v1/agents/:agentId/callback-remediation-policy",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentRegistry");
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        agent: await updateOwnedAgentCallbackRemediationPolicy(
          userId,
          request.params.agentId,
          updateCallbackRemediationPolicySchema.parse(request.body),
        ),
      };
    },
  );
};
