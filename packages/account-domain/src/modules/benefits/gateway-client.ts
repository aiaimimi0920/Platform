import type {
  GatewayBenefitProjectEnsureView,
  GatewayProjectApiAccessView,
  GatewayPromptCacheSummaryView,
  GatewayPromptCacheTrendReportView,
} from "@neuro/contracts";

import { env } from "@/env";
import { ConflictError } from "@/platform/errors";

type GatewayPromptCacheProjectFilters = {
  createdFrom?: string;
  createdTo?: string;
  inputPricePerMillion?: number;
  bucketSize?: string;
  limit?: number;
};

function resolveGatewayInternalBaseUrl() {
  const value = env.aiGatewayInternalUrl?.trim();
  if (!value) {
    throw new ConflictError("当前环境尚未配置 AI_GATEWAY_INTERNAL_URL。");
  }
  return value.replace(/\/+$/, "");
}

function resolveGatewayManagementToken() {
  const value = env.aiGatewayManagementToken?.trim();
  if (!value) {
    throw new ConflictError("当前环境尚未配置 AI gateway 管理令牌。");
  }
  return value;
}

async function parseGatewayError(response: Response) {
  const raw = await response.text();
  if (!raw) {
    return `Gateway request failed with ${response.status}`;
  }
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || `Gateway request failed with ${response.status}`;
  } catch {
    return raw;
  }
}

async function gatewayManagementRequest<T>(
  pathname: string,
  init?: {
    method?: "GET" | "POST";
    body?: unknown;
    searchParams?: URLSearchParams;
  },
): Promise<T> {
  const baseUrl = resolveGatewayInternalBaseUrl();
  const managementToken = resolveGatewayManagementToken();
  const search = init?.searchParams?.toString();
  const url = search ? `${baseUrl}${pathname}?${search}` : `${baseUrl}${pathname}`;
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": managementToken,
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!response.ok) {
    throw new Error(await parseGatewayError(response));
  }

  return (await response.json()) as T;
}

export async function ensureGatewayBenefitProjectViaRust(args: {
  serviceId: string;
  userId: string;
  serviceTitle?: string | null;
}) {
  return gatewayManagementRequest<GatewayBenefitProjectEnsureView>(
    "/v1/internal/gateway/benefit-projects/ensure",
    {
      method: "POST",
      body: args,
    },
  );
}

export async function resolveGatewayApiAccessForProjectViaRust(projectId: string, _name = "benefit-project-key") {
  return gatewayManagementRequest<GatewayProjectApiAccessView>(
    `/v1/internal/gateway/projects/${encodeURIComponent(projectId)}/api-access`,
    {
      method: "GET",
    },
  );
}

export async function rotateGatewayApiAccessForProjectViaRust(
  projectId: string,
  actorUserId: string | null,
  name = "benefit-project-key",
) {
  return gatewayManagementRequest<GatewayProjectApiAccessView>(
    `/v1/internal/gateway/projects/${encodeURIComponent(projectId)}/api-access/rotate`,
    {
      method: "POST",
      body: {
        actorUserId,
        name,
      },
    },
  );
}

export async function getGatewayPromptCacheSummaryForProjectViaRust(
  projectId: string,
  filters: GatewayPromptCacheProjectFilters = {},
) {
  const searchParams = new URLSearchParams();
  if (filters.createdFrom) {
    searchParams.set("createdFrom", filters.createdFrom);
  }
  if (filters.createdTo) {
    searchParams.set("createdTo", filters.createdTo);
  }
  if (typeof filters.inputPricePerMillion === "number") {
    searchParams.set("inputPricePerMillion", String(filters.inputPricePerMillion));
  }
  if (typeof filters.limit === "number") {
    searchParams.set("limit", String(filters.limit));
  }

  const payload = await gatewayManagementRequest<{ summary: GatewayPromptCacheSummaryView }>(
    `/v1/internal/gateway/projects/${encodeURIComponent(projectId)}/prompt-cache/summary`,
    {
      method: "GET",
      searchParams,
    },
  );
  return payload.summary;
}

export async function getGatewayPromptCacheTrendReportForProjectViaRust(
  projectId: string,
  filters: GatewayPromptCacheProjectFilters = {},
) {
  const searchParams = new URLSearchParams();
  if (filters.createdFrom) {
    searchParams.set("createdFrom", filters.createdFrom);
  }
  if (filters.createdTo) {
    searchParams.set("createdTo", filters.createdTo);
  }
  if (typeof filters.inputPricePerMillion === "number") {
    searchParams.set("inputPricePerMillion", String(filters.inputPricePerMillion));
  }
  if (filters.bucketSize) {
    searchParams.set("bucketSize", filters.bucketSize);
  }
  if (typeof filters.limit === "number") {
    searchParams.set("limit", String(filters.limit));
  }

  const payload = await gatewayManagementRequest<{ report: GatewayPromptCacheTrendReportView }>(
    `/v1/internal/gateway/projects/${encodeURIComponent(projectId)}/prompt-cache/trend-report`,
    {
      method: "GET",
      searchParams,
    },
  );
  return payload.report;
}
