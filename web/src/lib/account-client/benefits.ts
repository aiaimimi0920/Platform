import type {
  BenefitCatalogView,
  BenefitPanelView,
  BenefitProductBindingView,
  BenefitServiceApiAccessView,
  BenefitServicePromptCacheSummaryView,
  BenefitServicePromptCacheTrendReportView,
  BenefitServiceView,
  BenefitUserSearchResult,
  CreateBenefitGrantInput,
  ImportBenefitCredentialPoolInput,
  InternalUserContext,
  UpsertBenefitFamilyInput,
  UpsertBenefitProductLineInput,
  BenefitProductLineView,
  UpsertBenefitServiceInput,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function getBenefitPanel(userContext: InternalUserContext) {
  const response = await accountRequest<{ panel: BenefitPanelView }>("/v1/me/benefits/panel", {
    userContext,
  });
  return response.panel;
}

export async function listOperatorBenefitCatalog(userContext: InternalUserContext) {
  const response = await accountRequest<{ catalog: BenefitCatalogView }>("/v1/internal/benefits/catalog", {
    userContext,
  });
  return response.catalog;
}

export async function updateOperatorBenefitFamily(
  userContext: InternalUserContext,
  familyKey: string,
  input: UpsertBenefitFamilyInput,
) {
  const response = await accountRequest<{ family: BenefitCatalogView["families"][number] }>(
    `/v1/internal/benefits/families/${encodeURIComponent(familyKey)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.family;
}

export async function createOperatorBenefitProductLine(
  userContext: InternalUserContext,
  input: UpsertBenefitProductLineInput,
) {
  return accountRequest<{ productLine: BenefitProductLineView }>("/v1/internal/benefits/product-lines", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function updateOperatorBenefitProductLine(
  userContext: InternalUserContext,
  productLineId: string,
  input: Partial<UpsertBenefitProductLineInput>,
) {
  return accountRequest<{ productLine: BenefitProductLineView }>(
    `/v1/internal/benefits/product-lines/${encodeURIComponent(productLineId)}`,
    { method: "POST", body: input, userContext },
  );
}

export async function deleteOperatorBenefitProductLine(
  userContext: InternalUserContext,
  productLineId: string,
) {
  return accountRequest<{ ok: boolean }>(
    `/v1/internal/benefits/product-lines/${encodeURIComponent(productLineId)}/delete`,
    { method: "POST", userContext },
  );
}

export async function createOperatorBenefitService(
  userContext: InternalUserContext,
  input: UpsertBenefitServiceInput,
) {
  const response = await accountRequest<{ service: BenefitServiceView }>("/v1/internal/benefits/services", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.service;
}

export async function updateOperatorBenefitService(
  userContext: InternalUserContext,
  serviceId: string,
  input: UpsertBenefitServiceInput,
) {
  const response = await accountRequest<{ service: BenefitServiceView }>(
    `/v1/internal/benefits/services/${encodeURIComponent(serviceId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.service;
}

export async function archiveOperatorBenefitService(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ service: BenefitServiceView }>(
    `/v1/internal/benefits/services/${encodeURIComponent(serviceId)}/archive`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.service;
}

export async function deleteOperatorBenefitService(userContext: InternalUserContext, serviceId: string) {
  await accountRequest<{ ok: true }>(`/v1/internal/benefits/services/${encodeURIComponent(serviceId)}/delete`, {
    method: "POST",
    userContext,
  });
}

export async function createOperatorBenefitProductBinding(
  userContext: InternalUserContext,
  input: { serviceId: string; productId: string },
) {
  const response = await accountRequest<{ productBinding: BenefitProductBindingView }>(
    "/v1/internal/benefits/product-bindings",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.productBinding;
}

export async function deleteOperatorBenefitProductBinding(userContext: InternalUserContext, bindingId: string) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/benefits/product-bindings/${encodeURIComponent(bindingId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function createOperatorBenefitGrant(
  userContext: InternalUserContext,
  input: CreateBenefitGrantInput,
) {
  await accountRequest<{ ok: true }>("/v1/internal/benefits/grants", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function revokeOperatorBenefitGrant(userContext: InternalUserContext, grantId: string) {
  await accountRequest<{ ok: true }>(`/v1/internal/benefits/grants/${encodeURIComponent(grantId)}/revoke`, {
    method: "POST",
    userContext,
  });
}

export async function importOperatorBenefitCredentialPool(
  userContext: InternalUserContext,
  input: ImportBenefitCredentialPoolInput,
) {
  await accountRequest<{ ok: true }>("/v1/internal/benefits/credential-pools/import", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function rotateOperatorBenefitAssignment(
  userContext: InternalUserContext,
  serviceId: string,
  userId: string,
) {
  await accountRequest<{ ok: true }>(
    `/v1/internal/benefits/assignments/${encodeURIComponent(serviceId)}/${encodeURIComponent(userId)}/rotate`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function searchOperatorBenefitUsers(userContext: InternalUserContext, query: string) {
  const params = new URLSearchParams({ q: query });
  const response = await accountRequest<{ users: BenefitUserSearchResult[] }>(
    `/v1/internal/benefits/users/search?${params.toString()}`,
    {
      userContext,
    },
  );
  return response.users;
}

export async function resolveBenefitServiceApiAccess(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ access: BenefitServiceApiAccessView }>(
    `/v1/me/benefits/services/${encodeURIComponent(serviceId)}/api-access`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.access;
}

export async function rotateBenefitServiceApiAccess(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ access: BenefitServiceApiAccessView }>(
    `/v1/me/benefits/services/${encodeURIComponent(serviceId)}/api-access/rotate`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.access;
}

export async function getBenefitServicePromptCacheSummary(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ summary: BenefitServicePromptCacheSummaryView }>(
    `/v1/me/benefits/services/${encodeURIComponent(serviceId)}/prompt-cache-summary`,
    {
      userContext,
    },
  );
  return response.summary;
}

export async function getBenefitServicePromptCacheTrendReport(userContext: InternalUserContext, serviceId: string) {
  const response = await accountRequest<{ report: BenefitServicePromptCacheTrendReportView }>(
    `/v1/me/benefits/services/${encodeURIComponent(serviceId)}/prompt-cache-trend-report`,
    {
      userContext,
    },
  );
  return response.report;
}

function buildBenefitServiceModelsUrl(apiUrl: string) {
  const internalBaseUrl = process.env.AI_GATEWAY_INTERNAL_URL?.trim() || "";
  const normalizedBaseUrl = (internalBaseUrl || apiUrl).trim().replace(/\/+$/, "");
  if (normalizedBaseUrl.endsWith("/v1") || normalizedBaseUrl.endsWith("/v1/new-api")) {
    return `${normalizedBaseUrl}/models`;
  }
  return `${normalizedBaseUrl}/v1/models`;
}

export async function listBenefitServiceModels(userContext: InternalUserContext, serviceId: string) {
  const access = await resolveBenefitServiceApiAccess(userContext, serviceId);
  const response = await fetch(buildBenefitServiceModelsUrl(access.apiUrl), {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${access.apiKey}`,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        data?: Array<{
          id?: string | null;
        }>;
        error?: {
          message?: string;
        };
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Benefit service models unavailable");
  }

  const seen = new Set<string>();
  return (payload?.data ?? [])
    .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}
