import type {
  InternalUserContext,
  GatewayAccessCatalogView,
  GatewayAccessCandidatePreviewView,
  GatewayRouteDecisionPreviewView,
  GatewayAccessStickyAffinityView,
} from "@neuro/contracts";

import { gatewayRequest } from "@/lib/gateway-request";

export async function getGatewayAccessCatalog(userContext: InternalUserContext) {
  const response = await gatewayRequest<GatewayAccessCatalogView>(`/v1/internal/gateway/access/catalog`, {
    userContext,
  });
  return response;
}

export async function previewGatewayAccessCandidates(
  userContext: InternalUserContext,
  input: {
    accessKeyId: string;
    model: string;
    endpointKind: string;
    estimatedTokens?: number | null;
    explicitSessionKey?: string | null;
  },
) {
  const params = new URLSearchParams({
    accessKeyId: input.accessKeyId,
    model: input.model,
    endpointKind: input.endpointKind,
  });
  if (typeof input.estimatedTokens === "number") {
    params.set("estimatedTokens", String(input.estimatedTokens));
  }
  if (input.explicitSessionKey) {
    params.set("explicitSessionKey", input.explicitSessionKey);
  }
  return gatewayRequest<GatewayAccessCandidatePreviewView[]>(
    `/v1/internal/gateway/access/preview/candidates?${params.toString()}`,
    { userContext },
  );
}

export async function previewGatewayAccessRouteDecision(
  userContext: InternalUserContext,
  input: {
    accessKeyId: string;
    model: string;
    endpointKind: string;
    estimatedTokens?: number | null;
    explicitSessionKey?: string | null;
  },
) {
  const params = new URLSearchParams({
    accessKeyId: input.accessKeyId,
    model: input.model,
    endpointKind: input.endpointKind,
  });
  if (typeof input.estimatedTokens === "number") {
    params.set("estimatedTokens", String(input.estimatedTokens));
  }
  if (input.explicitSessionKey) {
    params.set("explicitSessionKey", input.explicitSessionKey);
  }
  return gatewayRequest<GatewayRouteDecisionPreviewView>(
    `/v1/internal/gateway/access/preview/route-decision?${params.toString()}`,
    { userContext },
  );
}

export async function inspectGatewayAccessAffinity(
  userContext: InternalUserContext,
  input: {
    accessKeyId: string;
    model: string;
    explicitSessionKey?: string | null;
  },
) {
  const params = new URLSearchParams({
    accessKeyId: input.accessKeyId,
    model: input.model,
  });
  if (input.explicitSessionKey) {
    params.set("explicitSessionKey", input.explicitSessionKey);
  }
  const response = await gatewayRequest<{ affinity: GatewayAccessStickyAffinityView | null }>(
    `/v1/internal/gateway/access/affinity?${params.toString()}`,
    { userContext },
  );
  return response.affinity;
}
