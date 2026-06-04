import type {
  JoinHonorProjectInput,
  SponsorHonorProjectInput,
  UpsertHonorProjectInput,
  UpsertHonorProjectInvestmentInput,
} from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  archiveOperatorHonorProject,
  createOperatorHonorProject,
  deleteOperatorHonorProject,
  deleteOperatorHonorProjectInvestment,
  getHonorProjectPanel,
  joinHonorProjectForUser,
  listOperatorHonorProjectCatalog,
  sponsorHonorProjectForUser,
  updateOperatorHonorProject,
  upsertOperatorHonorProjectInvestment,
} from "@/modules/honor-projects/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const honorProjectUpsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(2_000),
  publicHref: z.string().trim().max(500).nullable().optional(),
  ownerHandle: z.string().trim().min(1).max(80),
  ownerLabel: z.string().trim().min(1).max(120),
  categoryLabel: z.string().trim().min(1).max(80),
  stageLabel: z.string().trim().min(1).max(80),
  progressPercent: z.number().int().min(0).max(100),
  progressLabel: z.string().trim().min(1).max(600),
  rewardShareLabel: z.string().trim().min(1).max(200),
  sponsorOpen: z.boolean(),
  sponsorStatusLabel: z.string().trim().min(1).max(80),
  joinOpen: z.boolean(),
  joinStatusLabel: z.string().trim().min(1).max(80),
  collaborationLabel: z.string().trim().min(1).max(200),
  fundingTargetAmount: z.number().int().min(0).max(10_000_000_000),
  workspaceHref: z.string().trim().min(1).max(500),
  workspaceLabel: z.string().trim().min(1).max(80),
  detailBody: z.string().trim().min(1).max(4_000),
  sponsorCount: z.number().int().min(0).max(1_000_000),
  sponsoredAmount: z.number().int().min(0).max(10_000_000_000),
  sponsoredCurrencyLabel: z.string().trim().min(1).max(20),
  sortOrder: z.number().int().min(0).max(10_000),
  status: z.enum(["active", "archived"]),
});

const honorProjectInvestmentUpsertSchema = z.object({
  projectId: z.string().trim().min(1).max(120),
  userId: z.string().trim().min(1).max(120),
  investedAmount: z.number().int().min(0).max(10_000_000_000),
  currencyLabel: z.string().trim().min(1).max(20),
});

const projectParamsSchema = z.object({
  projectId: z.string().trim().min(1),
});

const investmentParamsSchema = z.object({
  investmentId: z.string().trim().min(1),
});

const userSponsorProjectSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.enum(["obsidian", "mira"]),
});

const userJoinProjectSchema = z.object({
  roleLabel: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).nullable().optional(),
});

const honorProjectCatalogQuerySchema = z.object({
  investmentUserId: z.string().trim().min(1).optional(),
  query: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

function toProjectUpsertInput(input: z.infer<typeof honorProjectUpsertSchema>): UpsertHonorProjectInput {
  return {
    ...input,
    publicHref: input.publicHref ?? null,
  };
}

function toProjectInvestmentUpsertInput(
  input: z.infer<typeof honorProjectInvestmentUpsertSchema>,
): UpsertHonorProjectInvestmentInput {
  return {
    ...input,
  };
}

function toProjectSponsorInput(input: z.infer<typeof userSponsorProjectSchema>): SponsorHonorProjectInput {
  return {
    amount: input.amount,
    currency: input.currency,
  };
}

function toProjectJoinInput(input: z.infer<typeof userJoinProjectSchema>): JoinHonorProjectInput {
  return {
    roleLabel: input.roleLabel,
    note: input.note ?? null,
  };
}

export const honorProjectsRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/internal/honor-projects/panel", { preHandler: withInternalRequest }, async (request) => {
    const { userId } = assertUserContext(request);
    return {
      panel: await getHonorProjectPanel(userId),
    };
  });

  app.get("/v1/internal/honor-projects/catalog", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = honorProjectCatalogQuerySchema.parse(request.query ?? {});
    return {
      catalog: await listOperatorHonorProjectCatalog(userId, providerUserId, query),
    };
  });

  app.post<{ Body: z.infer<typeof honorProjectUpsertSchema> }>(
    "/v1/internal/honor-projects/projects",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const payload = honorProjectUpsertSchema.parse(request.body ?? {});
      return {
        project: await createOperatorHonorProject(userId, providerUserId, toProjectUpsertInput(payload)),
      };
    },
  );

  app.post<{ Params: z.infer<typeof projectParamsSchema>; Body: z.infer<typeof honorProjectUpsertSchema> }>(
    "/v1/internal/honor-projects/projects/:projectId",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const { projectId } = projectParamsSchema.parse(request.params);
      const payload = honorProjectUpsertSchema.parse(request.body ?? {});
      return {
        project: await updateOperatorHonorProject(userId, providerUserId, projectId, toProjectUpsertInput(payload)),
      };
    },
  );

  app.post<{ Params: z.infer<typeof projectParamsSchema> }>(
    "/v1/internal/honor-projects/projects/:projectId/archive",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const { projectId } = projectParamsSchema.parse(request.params);
      return {
        project: await archiveOperatorHonorProject(userId, providerUserId, projectId),
      };
    },
  );

  app.post<{ Params: z.infer<typeof projectParamsSchema> }>(
    "/v1/internal/honor-projects/projects/:projectId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const { projectId } = projectParamsSchema.parse(request.params);
      await deleteOperatorHonorProject(userId, providerUserId, projectId);
      return { ok: true as const };
    },
  );

  app.post<{ Body: z.infer<typeof honorProjectInvestmentUpsertSchema> }>(
    "/v1/internal/honor-projects/investments",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const payload = honorProjectInvestmentUpsertSchema.parse(request.body ?? {});
      return {
        investment: await upsertOperatorHonorProjectInvestment(
          userId,
          providerUserId,
          toProjectInvestmentUpsertInput(payload),
        ),
      };
    },
  );

  app.post<{ Params: z.infer<typeof investmentParamsSchema> }>(
    "/v1/internal/honor-projects/investments/:investmentId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const { investmentId } = investmentParamsSchema.parse(request.params);
      await deleteOperatorHonorProjectInvestment(userId, providerUserId, investmentId);
      return { ok: true as const };
    },
  );

  app.post<{ Params: z.infer<typeof projectParamsSchema>; Body: z.infer<typeof userSponsorProjectSchema> }>(
    "/v1/internal/honor-projects/projects/:projectId/sponsor",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId } = assertUserContext(request);
      const { projectId } = projectParamsSchema.parse(request.params);
      const payload = userSponsorProjectSchema.parse(request.body ?? {});
      return {
        sponsorship: await sponsorHonorProjectForUser(userId, {
          projectId,
          ...toProjectSponsorInput(payload),
        }),
      };
    },
  );

  app.post<{ Params: z.infer<typeof projectParamsSchema>; Body: z.infer<typeof userJoinProjectSchema> }>(
    "/v1/internal/honor-projects/projects/:projectId/join",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId } = assertUserContext(request);
      const { projectId } = projectParamsSchema.parse(request.params);
      const payload = userJoinProjectSchema.parse(request.body ?? {});
      return {
        membership: await joinHonorProjectForUser(userId, {
          projectId,
          ...toProjectJoinInput(payload),
        }),
      };
    },
  );
};
