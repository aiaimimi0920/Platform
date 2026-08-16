import type {
  InternalUserContext,
  HonorProjectCatalogView,
  HonorProjectInvestmentView,
  HonorProjectPanelView,
  HonorProjectView,
  JoinHonorProjectInput,
  SponsorHonorProjectInput,
  UpsertHonorProjectInput,
  UpsertHonorProjectInvestmentInput,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function getHonorProjectPanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: HonorProjectPanelView }>("/v1/internal/honor-projects/panel", {
    userContext,
  });
  return response.panel;
}

export async function sponsorHonorProject(userContext: InternalUserContext, projectId: string, input: SponsorHonorProjectInput) {
  const response = await accountRequest<{
    sponsorship: {
      amount: number;
      currencyLabel: string;
      projectId: string;
      projectName: string;
    };
  }>(`/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}/sponsor`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response.sponsorship;
}

export async function joinHonorProject(userContext: InternalUserContext, projectId: string, input: JoinHonorProjectInput) {
  const response = await accountRequest<{
    membership: {
      projectId: string;
      projectName: string;
      roleLabel: string;
      status: "pending";
      username: string;
    };
  }>(`/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}/join`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response.membership;
}

export async function listOperatorHonorProjectCatalog(
  userContext: InternalUserContext,
  input?: {
    investmentUserId?: string | null;
    query?: string | null;
    limit?: number;
  },
) {
  const params = new URLSearchParams();
  if (input?.investmentUserId?.trim()) {
    params.set("investmentUserId", input.investmentUserId.trim());
  }
  if (input?.query?.trim()) {
    params.set("query", input.query.trim());
  }
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await accountRequest<{ catalog: HonorProjectCatalogView }>(
    `/v1/internal/honor-projects/catalog${suffix}`,
    {
      userContext,
    },
  );
  return response.catalog;
}

export async function createOperatorHonorProject(
  userContext: InternalUserContext,
  input: UpsertHonorProjectInput,
) {
  const response = await accountRequest<{ project: HonorProjectView }>(
    "/v1/internal/honor-projects/projects",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.project;
}

export async function updateOperatorHonorProject(
  userContext: InternalUserContext,
  projectId: string,
  input: UpsertHonorProjectInput,
) {
  const response = await accountRequest<{ project: HonorProjectView }>(
    `/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.project;
}

export async function archiveOperatorHonorProject(userContext: InternalUserContext, projectId: string) {
  const response = await accountRequest<{ project: HonorProjectView }>(
    `/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}/archive`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.project;
}

export async function deleteOperatorHonorProject(userContext: InternalUserContext, projectId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/honor-projects/projects/${encodeURIComponent(projectId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function upsertOperatorHonorProjectInvestment(
  userContext: InternalUserContext,
  input: UpsertHonorProjectInvestmentInput,
) {
  const response = await accountRequest<{ investment: HonorProjectInvestmentView }>(
    "/v1/internal/honor-projects/investments",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.investment;
}

export async function deleteOperatorHonorProjectInvestment(
  userContext: InternalUserContext,
  investmentId: string,
) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/honor-projects/investments/${encodeURIComponent(investmentId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}
