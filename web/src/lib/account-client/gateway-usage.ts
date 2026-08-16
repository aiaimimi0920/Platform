import type {
  InternalUserContext,
  GatewayProviderCredentialModelStateView,
  GatewayUsageAggregateBucketView,
  GatewayUsageAggregateSummaryView,
  GatewayModelAliasView,
  GatewayModelAssociationMatrixView,
  GatewayCostOverviewView,
  UpsertGatewayModelAliasInput,
} from "@neuro/contracts";

import { gatewayRequest } from "@/lib/gateway-request";

type GatewayProviderCredentialModelStateFilterInput = {
  providerAccountId?: string | null;
  providerCredentialId?: string | null;
  providerCredentialRef?: string | null;
  protocolProfile?: string | null;
  model?: string | null;
  status?: string | null;
  limit?: number | null;
};

export async function listOperatorGatewayProviderCredentialModelStates(
  userContext: InternalUserContext,
  filters?: GatewayProviderCredentialModelStateFilterInput,
) {
  const params = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }
    if (typeof filters.limit === "number" && Number.isFinite(filters.limit)) {
      params.set("limit", String(Math.max(1, Math.floor(filters.limit))));
    }
  }
  const pathname = params.size
    ? `/v1/internal/gateway/provider-credential-model-states?${params.toString()}`
    : "/v1/internal/gateway/provider-credential-model-states";
  const response = await gatewayRequest<{ states: GatewayProviderCredentialModelStateView[] }>(
    pathname,
    { userContext },
  );
  return response.states;
}

type GatewayUsageAggregateFilterInput = {
  projectId?: string | null;
  userId?: string | null;
  provider?: string | null;
  providerCredentialRef?: string | null;
  model?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number | null;
};

export async function listOperatorGatewayUsageAggregates(
  userContext: InternalUserContext,
  filters?: GatewayUsageAggregateFilterInput,
) {
  const params = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }
    if (typeof filters.limit === "number" && Number.isFinite(filters.limit)) {
      params.set("limit", String(Math.max(1, Math.floor(filters.limit))));
    }
  }
  const pathname = params.size
    ? `/v1/internal/gateway/usage-aggregates?${params.toString()}`
    : "/v1/internal/gateway/usage-aggregates";
  const response = await gatewayRequest<{ buckets: GatewayUsageAggregateBucketView[] }>(pathname, {
    userContext,
  });
  return response.buckets;
}

export async function flushOperatorGatewayUsageAggregates(
  userContext: InternalUserContext,
  input?: { batchSize?: number | null; bucketSeconds?: number | null },
) {
  const response = await gatewayRequest<{
    dequeued: number;
    bucketCount: number;
    buckets: unknown[];
  }>("/v1/internal/gateway/usage-aggregates/flush", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
  return response;
}

export async function summarizeOperatorGatewayUsageAggregates(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ summary: GatewayUsageAggregateSummaryView }>(
    "/v1/internal/gateway/usage-aggregates/summary",
    { userContext },
  );
  return response.summary;
}

export async function getOperatorGatewayModelAssociations(userContext: InternalUserContext) {
  const response = await gatewayRequest<{ matrix: GatewayModelAssociationMatrixView }>(
    "/v1/internal/gateway/model-associations",
    {
      userContext,
    },
  );
  return response.matrix;
}

export async function listOperatorGatewayModelAliases(userContext: InternalUserContext, input?: { projectId?: string | null }) {
  const params = new URLSearchParams();
  if (typeof input?.projectId === "string" && input.projectId.trim()) {
    params.set("projectId", input.projectId.trim());
  }
  const pathname = params.size
    ? `/v1/internal/gateway/model-aliases?${params.toString()}`
    : "/v1/internal/gateway/model-aliases";
  const response = await gatewayRequest<{ modelAliases: GatewayModelAliasView[] }>(pathname, {
    userContext,
  });
  return response.modelAliases;
}

export async function createOperatorGatewayModelAlias(
  userContext: InternalUserContext,
  input: UpsertGatewayModelAliasInput,
) {
  const response = await gatewayRequest<{ modelAlias: GatewayModelAliasView }>(
    "/v1/internal/gateway/model-aliases",
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.modelAlias;
}

export async function updateOperatorGatewayModelAlias(
  userContext: InternalUserContext,
  aliasId: string,
  input: UpsertGatewayModelAliasInput,
) {
  const response = await gatewayRequest<{ modelAlias: GatewayModelAliasView }>(
    `/v1/internal/gateway/model-aliases/${encodeURIComponent(aliasId)}`,
    {
      method: "POST",
      userContext,
      body: input,
    },
  );
  return response.modelAlias;
}

export async function deleteOperatorGatewayModelAlias(
  userContext: InternalUserContext,
  aliasId: string,
) {
  const response = await gatewayRequest<{ deleted: true; modelAlias: GatewayModelAliasView }>(
    `/v1/internal/gateway/model-aliases/${encodeURIComponent(aliasId)}`,
    {
      method: "DELETE",
      userContext,
    },
  );
  return response.modelAlias;
}

export async function getOperatorGatewayCosts(userContext: InternalUserContext) {
  const response = await gatewayRequest<{ overview: GatewayCostOverviewView }>("/v1/internal/gateway/costs", {
    userContext,
  });
  return response.overview;
}
