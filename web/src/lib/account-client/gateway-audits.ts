import type {
  InternalUserContext,
  GatewayRequestAuditView,
  GatewayRequestArtifactsView,
  GatewayRequestAuditSummaryView,
  GatewayConversationArchiveView,
  GatewayConversationArchiveArtifactsView,
  GatewayConversationArchiveExportView,
  GatewayConversationDatasetExportView,
} from "@neuro/contracts";

import { gatewayRequest } from "@/lib/gateway-request";

type GatewayRequestAuditFilterInput = {
  projectId?: string | null;
  routePolicyId?: string | null;
  providerAccountId?: string | null;
  sessionId?: string | null;
  apiKeyId?: string | null;
  responseId?: string | null;
  protocolFamily?: string | null;
  status?: string | null;
  endpointKind?: string | null;
  errorCode?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  fallbackEligible?: boolean | null;
  limit?: number | null;
};

export function normalizeGatewayRequestAuditView(
  request: GatewayRequestAuditView,
): GatewayRequestAuditView {
  if (!request.routeTrace || Array.isArray(request.routeTrace.candidateQueue)) {
    return request;
  }

  return {
    ...request,
    routeTrace: {
      ...request.routeTrace,
      candidateQueue: [],
    },
  };
}

function buildGatewayRequestAuditFilterParams(input?: GatewayRequestAuditFilterInput) {
  const params = new URLSearchParams();
  if (!input) {
    return params;
  }
  const stringEntries = [
    ["projectId", input.projectId],
    ["routePolicyId", input.routePolicyId],
    ["providerAccountId", input.providerAccountId],
    ["sessionId", input.sessionId],
    ["apiKeyId", input.apiKeyId],
    ["responseId", input.responseId],
    ["protocolFamily", input.protocolFamily],
    ["status", input.status],
    ["endpointKind", input.endpointKind],
    ["errorCode", input.errorCode],
    ["createdFrom", input.createdFrom],
    ["createdTo", input.createdTo],
  ] as const;
  for (const [key, value] of stringEntries) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }
  if (typeof input.fallbackEligible === "boolean") {
    params.set("fallbackEligible", input.fallbackEligible ? "true" : "false");
  }
  if (typeof input.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  return params;
}

export async function listOperatorGatewayRequestAudits(
  userContext: InternalUserContext,
  filters?: GatewayRequestAuditFilterInput,
) {
  const params = buildGatewayRequestAuditFilterParams(filters);
  const pathname = params.size ? `/v1/internal/gateway/requests?${params.toString()}` : "/v1/internal/gateway/requests";
  const response = await gatewayRequest<{ requests: GatewayRequestAuditView[] }>(pathname, {
    userContext,
  });
  return response.requests.map(normalizeGatewayRequestAuditView);
}

export async function getOperatorGatewayRequestAuditSummary(
  userContext: InternalUserContext,
  filters?: GatewayRequestAuditFilterInput,
) {
  const params = buildGatewayRequestAuditFilterParams(filters);
  const pathname = params.size
    ? `/v1/internal/gateway/requests/summary?${params.toString()}`
    : "/v1/internal/gateway/requests/summary";
  const response = await gatewayRequest<{ summary: GatewayRequestAuditSummaryView }>(pathname, {
    userContext,
  });
  return response.summary;
}

export async function getOperatorGatewayRequestAudit(
  userContext: InternalUserContext,
  requestAuditId: string,
) {
  const response = await gatewayRequest<{ requestAudit: GatewayRequestAuditView }>(
    `/v1/internal/gateway/requests/${encodeURIComponent(requestAuditId)}`,
    {
      userContext,
    },
  );
  return normalizeGatewayRequestAuditView(response.requestAudit);
}

export async function getOperatorGatewayRequestArtifacts(
  userContext: InternalUserContext,
  requestAuditId: string,
) {
  const response = await gatewayRequest<{ artifacts: GatewayRequestArtifactsView }>(
    `/v1/internal/gateway/requests/${encodeURIComponent(requestAuditId)}/artifacts`,
    {
      userContext,
    },
  );
  return response.artifacts;
}

type GatewayConversationArchiveFilterInput = {
  projectId?: string | null;
  userId?: string | null;
  providerAccountId?: string | null;
  providerCredentialRef?: string | null;
  protocolFamily?: string | null;
  protocolProfile?: string | null;
  endpointKind?: string | null;
  requestedModel?: string | null;
  resolvedModel?: string | null;
  status?: string | null;
  failureClass?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  limit?: number | null;
};

function buildGatewayConversationArchiveFilterParams(input?: GatewayConversationArchiveFilterInput) {
  const params = new URLSearchParams();
  if (!input) {
    return params;
  }
  const stringEntries = [
    ["projectId", input.projectId],
    ["userId", input.userId],
    ["providerAccountId", input.providerAccountId],
    ["providerCredentialRef", input.providerCredentialRef],
    ["protocolFamily", input.protocolFamily],
    ["protocolProfile", input.protocolProfile],
    ["endpointKind", input.endpointKind],
    ["requestedModel", input.requestedModel],
    ["resolvedModel", input.resolvedModel],
    ["status", input.status],
    ["failureClass", input.failureClass],
    ["createdFrom", input.createdFrom],
    ["createdTo", input.createdTo],
  ] as const;
  for (const [key, value] of stringEntries) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value.trim());
    }
  }
  if (typeof input.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  return params;
}

export async function listOperatorGatewayConversationArchives(
  userContext: InternalUserContext,
  filters?: GatewayConversationArchiveFilterInput,
) {
  const params = buildGatewayConversationArchiveFilterParams(filters);
  const pathname = params.size
    ? `/v1/internal/gateway/conversation-archives?${params.toString()}`
    : "/v1/internal/gateway/conversation-archives";
  const response = await gatewayRequest<{ archives: GatewayConversationArchiveView[] }>(pathname, {
    userContext,
  });
  return response.archives;
}

export async function getOperatorGatewayConversationArchive(
  userContext: InternalUserContext,
  archiveId: string,
) {
  const response = await gatewayRequest<{ archive: GatewayConversationArchiveView }>(
    `/v1/internal/gateway/conversation-archives/${encodeURIComponent(archiveId)}`,
    {
      userContext,
    },
  );
  return response.archive;
}

export async function getOperatorGatewayConversationArchiveArtifacts(
  userContext: InternalUserContext,
  archiveId: string,
) {
  const response = await gatewayRequest<GatewayConversationArchiveArtifactsView>(
    `/v1/internal/gateway/conversation-archives/${encodeURIComponent(archiveId)}/artifacts`,
    {
      userContext,
    },
  );
  return response;
}

export async function exportOperatorGatewayConversationArchives(
  userContext: InternalUserContext,
  filters?: GatewayConversationArchiveFilterInput,
) {
  const response = await gatewayRequest<{ export: GatewayConversationArchiveExportView }>(
    "/v1/internal/gateway/conversation-archives/export",
    {
      method: "POST",
      body: filters ?? {},
      userContext,
    },
  );
  return response.export;
}

export async function createOperatorGatewayConversationDatasetExport(
  userContext: InternalUserContext,
  input: GatewayConversationArchiveFilterInput & {
    sampleSize?: number | null;
    createdBy?: string | null;
  },
) {
  const response = await gatewayRequest<{ dataset: GatewayConversationDatasetExportView }>(
    "/v1/internal/gateway/conversation-archives/datasets",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.dataset;
}

export async function listOperatorGatewayConversationDatasetExports(
  userContext: InternalUserContext,
) {
  const response = await gatewayRequest<{ datasets: GatewayConversationDatasetExportView[] }>(
    "/v1/internal/gateway/conversation-archives/datasets",
    {
      userContext,
    },
  );
  return response.datasets;
}

export async function reviewOperatorGatewayConversationDatasetExport(
  userContext: InternalUserContext,
  datasetId: string,
  input: { action: "approve" | "reject"; reviewerId?: string | null; note?: string | null },
) {
  const response = await gatewayRequest<{ dataset: GatewayConversationDatasetExportView }>(
    `/v1/internal/gateway/conversation-archives/datasets/${encodeURIComponent(datasetId)}/review`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.dataset;
}

export async function publishOperatorGatewayConversationDatasetExport(
  userContext: InternalUserContext,
  datasetId: string,
) {
  const response = await gatewayRequest<{ dataset: GatewayConversationDatasetExportView }>(
    `/v1/internal/gateway/conversation-archives/datasets/${encodeURIComponent(datasetId)}/publish`,
    {
      method: "POST",
      body: {},
      userContext,
    },
  );
  return response.dataset;
}
