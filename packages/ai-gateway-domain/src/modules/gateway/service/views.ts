import type { GatewayApiKeyView, GatewayEndpointExecutionModeMap, GatewayModelAliasView, GatewayModelAliasScopeType, GatewayProjectView, GatewayProtocolFamily, GatewayProviderAccountPayload, GatewayProviderAccountView, GatewayRequestAuditView, GatewayRequestStatus, GatewayRoutePolicyConfig, GatewayRoutePolicyView, GatewaySessionView, GatewayTenantView } from "@neuro/contracts";
import { getCachedProviderPayload, setCachedProviderPayload } from "@/modules/gateway/provider-credential-sync";
import { maskGatewayProviderPayload } from "@/modules/gateway/provider-payload-mask";
import { readGatewayObject } from "@/modules/gateway/object-storage";
import { gatewayModelAliases, gatewayRequestAudits } from "@/modules/gateway/schema";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

import type { GatewayApiKeyRow, GatewayProjectRow, GatewayProviderAccountRow, GatewayRoutePolicyRow, GatewaySessionRow, GatewayTenantRow } from "./shared";
import { normalizeEndpointExecutionModes, normalizeGatewayExecutionMode, resolveGatewayProviderSourceProfileForView } from "./provider-source-profile";

export function defaultRoutePolicyConfig(): GatewayRoutePolicyConfig {
  return {
    stickySessions: true,
    preStreamFallbackEnabled: true,
    selectionStrategy: "weighted_random",
    providerLoadAwareRoutingEnabled: true,
    maxConcurrentRequests: 4,
    providerMaxConcurrentRequests: null,
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 30,
    apiKeyRateLimit: null,
    modelRateLimits: null,
    endpointRateLimits: null,
    circuitBreakerThreshold: 3,
    circuitBreakerCooldownSeconds: 60,
    allowedProviderAccountIds: null,
    allowedProtocolFamilies: null,
    allowedModelIds: null,
    blockedModelIds: null,
    maxRequestBodyBytes: null,
    streamIdleTimeoutSeconds: null,
    totalRequestTimeoutSeconds: null,
    maxStreamHeartbeatGapSeconds: null,
    routingAnomalyAutoRemediation: null,
    rateLimitHotspotAutoRemediation: null,
    fallbackHttpStatuses: [408, 425, 429, 500, 502, 503, 504],
    fallbackErrorCodes: [
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_BODY_TIMEOUT",
    ],
  };
}

export function toGatewayTenantView(row: GatewayTenantRow): GatewayTenantView {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    status: row.status as GatewayTenantView["status"],
    ownerUserId: row.ownerUserId,
    sourceKind: row.sourceKind as GatewayTenantView["sourceKind"],
    sourceKey: row.sourceKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toGatewayProjectView(row: GatewayProjectRow): GatewayProjectView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    displayName: row.displayName,
    status: row.status as GatewayProjectView["status"],
    sourceKind: row.sourceKind as GatewayProjectView["sourceKind"],
    sourceKey: row.sourceKey,
    defaultRoutePolicyId: row.defaultRoutePolicyId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toGatewayApiKeyView(row: GatewayApiKeyRow): GatewayApiKeyView {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    status: row.status as GatewayApiKeyView["status"],
    issuedAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    rotatedFromApiKeyId: row.rotatedFromApiKeyId,
  };
}

export async function readProviderAccountPayload(row: GatewayProviderAccountRow) {
  // Fast path: check Redis cache first
  const cached = await getCachedProviderPayload(row.id).catch(() => null);
  if (cached) {
    return cached;
  }

  // Cache miss: read from DB inline or object storage
  let payload: GatewayProviderAccountPayload;
  if (row.payloadInline && typeof row.payloadInline === "object") {
    payload = row.payloadInline as GatewayProviderAccountPayload;
  } else if (row.payloadObjectKey) {
    const buffer = await readGatewayObject(row.payloadObjectKey);
    payload = JSON.parse(buffer.toString("utf8")) as GatewayProviderAccountPayload;
  } else {
    throw new ConflictError("Provider account payload 缺失。");
  }

  // Populate cache for next time (fire-and-forget)
  setCachedProviderPayload(row.id, payload).catch(() => undefined);

  return payload;
}

export async function toGatewayProviderAccountView(
  row: GatewayProviderAccountRow,
  options?: { maskSecrets?: boolean },
): Promise<GatewayProviderAccountView> {
  const payload = await readProviderAccountPayload(row);
  const executionMode = normalizeGatewayExecutionMode(row.adapter, row.executionMode);
  const endpointExecutionModes = normalizeEndpointExecutionModes(
    row.adapter,
    (row.endpointExecutionModes as GatewayEndpointExecutionModeMap | null | undefined) ?? null,
  );
  return {
    id: row.id,
    label: row.label,
    serviceProviderKey: row.serviceProviderKey,
    serviceProviderLabel: row.serviceProviderLabel,
    adapter: row.adapter as GatewayProviderAccountView["adapter"],
    status: row.status as GatewayProviderAccountView["status"],
    protocolFamily: row.protocolFamily as GatewayProviderAccountView["protocolFamily"],
    protocolProfile: row.protocolProfile as GatewayProviderAccountView["protocolProfile"],
    sourceProfile: resolveGatewayProviderSourceProfileForView({
      row,
      payload,
      executionMode,
      endpointExecutionModes,
    }),
    executionMode,
    endpointExecutionModes,
    payload: options?.maskSecrets ? maskGatewayProviderPayload(payload) : payload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cooldownUntil: row.cooldownUntil ? row.cooldownUntil.toISOString() : null,
    lastError: row.lastError,
    failureCount: row.failureCount,
  };
}

export function toGatewayModelAliasView(row: typeof gatewayModelAliases.$inferSelect): GatewayModelAliasView {
  return {
    id: row.id,
    projectId: row.projectId,
    scopeType: normalizeGatewayModelAliasScopeType(row.scopeType),
    alias: row.alias,
    providerAccountId: row.providerAccountId,
    upstreamModel: row.upstreamModel,
    priority: row.priority,
    weight: row.weight,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeGatewayModelAliasScopeType(
  value: string | null | undefined,
): GatewayModelAliasScopeType {
  return value === "provider_special" ? "provider_special" : "global";
}

export function toGatewayRoutePolicyView(row: GatewayRoutePolicyRow): GatewayRoutePolicyView {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    isDefault: row.isDefault,
    enabled: row.enabled,
    config: row.config,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toGatewaySessionView(row: GatewaySessionRow): GatewaySessionView {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionKey: row.sessionKey,
    protocolFamily: row.protocolFamily as GatewayProtocolFamily,
    providerAccountId: row.providerAccountId,
    latestResponseId: row.latestResponseId,
    upstreamSessionId: row.upstreamSessionId,
    runtimeStateObjectKey: row.runtimeStateObjectKey,
    activeRequestAuditId: row.activeRequestAuditId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

export function toGatewayRequestAuditView(row: typeof gatewayRequestAudits.$inferSelect): GatewayRequestAuditView {
  return {
    id: row.id,
    projectId: row.projectId,
    accessKeyId: row.accessKeyId,
    sourceAccessKeyId: row.sourceAccessKeyId,
    apiKeyId: row.apiKeyId,
    userCredentialId: row.userCredentialId,
    sessionId: row.sessionId,
    routePolicyId: row.routePolicyId,
    providerAccountId: row.providerAccountId,
    protocolFamily: row.protocolFamily as GatewayProtocolFamily,
    endpointKind: row.endpointKind,
    requestedModel: row.requestedModel,
    resolvedModel: row.resolvedModel,
    modelAlias: row.modelAlias,
    stream: row.stream,
    status: row.status as GatewayRequestStatus,
    upstreamStatus: row.upstreamStatus,
    durationMs: row.durationMs,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    cacheCreationInputTokens: row.cacheCreationInputTokens,
    cacheReadInputTokens: row.cacheReadInputTokens,
    clientHasCacheControl: row.clientHasCacheControl,
    autoCacheApplied: row.autoCacheApplied,
    errorSummary: row.errorSummary,
    routeTrace: row.routeTrace ?? null,
    analysisProfile: row.analysisProfile ?? null,
    requestArtifactObjectKey: row.requestArtifactObjectKey,
    responseArtifactObjectKey: row.responseArtifactObjectKey,
    responseId: row.responseId,
    previousResponseId: row.previousResponseId,
    clientDisconnectedAt: row.clientDisconnectedAt ? row.clientDisconnectedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
