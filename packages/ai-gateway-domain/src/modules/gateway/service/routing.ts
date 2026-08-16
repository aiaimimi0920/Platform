import type { GatewayEndpointExecutionModeMap, GatewayExecutionMode, GatewayProjectView, GatewayProviderAccountView, GatewayRoutePolicyConfig, GatewayRoutePolicyView, GatewayRelayEndpointKind } from "@neuro/contracts";
import { and, asc, desc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db/client";
import { routePolicyAllowsModels, routePolicyHasModelRestrictions } from "@/modules/gateway/route-policy-models";
import { gatewayModelAliases, gatewayProjects, gatewayProviderAccounts, gatewayRoutePolicies } from "@/modules/gateway/schema";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";
import { discoverGatewayProviderModelIds } from "@/modules/gateway/provider-model-discovery";

import { normalizeStringList, now } from "./shared";
import type { GatewayProviderAccountRow } from "./shared";
import { resolveProviderExecutionMode } from "./provider-source-profile";
import { readProviderAccountPayload, toGatewayProjectView, toGatewayProviderAccountView, toGatewayRoutePolicyView } from "./views";
import { discoverProviderModels, reactivateExpiredCoolingProviderAccounts } from "./provider-health";

export type GatewayRouteCandidate = {
  aliasId: string | null;
  modelAlias: string | null;
  providerAccount: GatewayProviderAccountView;
  upstreamModel: string | null;
  resolvedExecutionMode: GatewayExecutionMode;
  priority: number;
  weight: number;
};

export type GatewayResolvedRouteContext = {
  project: GatewayProjectView;
  routePolicy: GatewayRoutePolicyView;
  candidates: GatewayRouteCandidate[];
};

export type GatewayResolvedProviderNamespaceContext = {
  project: GatewayProjectView;
  routePolicy: GatewayRoutePolicyView;
  providerName: string;
  providerAccounts: GatewayProviderAccountView[];
};

export async function getGatewayProjectById(projectId: string) {
  const [row] = await db.select().from(gatewayProjects).where(eq(gatewayProjects.id, projectId)).limit(1);
  return row ?? null;
}

export async function getDefaultRoutePolicyForProject(projectId: string) {
  const [row] = await db
    .select()
    .from(gatewayRoutePolicies)
    .where(
      and(
        eq(gatewayRoutePolicies.projectId, projectId),
        eq(gatewayRoutePolicies.isDefault, true),
        eq(gatewayRoutePolicies.enabled, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function providerAllowedByRoutePolicy(
  providerAccount: GatewayProviderAccountRow,
  routePolicy: GatewayRoutePolicyConfig | null | undefined,
) {
  const allowedProviderIds = normalizeStringList(routePolicy?.allowedProviderAccountIds ?? null);
  if (allowedProviderIds && !allowedProviderIds.includes(providerAccount.id)) {
    return false;
  }

  const allowedProtocolFamilies = normalizeStringList(routePolicy?.allowedProtocolFamilies ?? null);
  if (allowedProtocolFamilies && !allowedProtocolFamilies.includes(providerAccount.protocolFamily)) {
    return false;
  }

  return true;
}

export async function listGatewayModelsForProject(projectId: string) {
  await reactivateExpiredCoolingProviderAccounts();
  const project = await getGatewayProjectById(projectId);
  const routePolicy =
    (project?.defaultRoutePolicyId
      ? await db
          .select()
          .from(gatewayRoutePolicies)
          .where(eq(gatewayRoutePolicies.id, project.defaultRoutePolicyId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null) ?? (project ? await getDefaultRoutePolicyForProject(project.id) : null);
  const aliasRows = await db
    .select()
    .from(gatewayModelAliases)
    .where(or(eq(gatewayModelAliases.projectId, projectId), isNull(gatewayModelAliases.projectId)))
    .orderBy(asc(gatewayModelAliases.alias), asc(gatewayModelAliases.priority), desc(gatewayModelAliases.weight));

  const modelIds = new Set<string>();
  for (const row of aliasRows) {
    if (row.enabled && routePolicyAllowsModels(routePolicy?.config ?? null, [row.alias, row.upstreamModel])) {
      modelIds.add(row.alias);
    }
  }

  if (modelIds.size === 0) {
    const providerRows = await db
      .select()
      .from(gatewayProviderAccounts)
      .where(eq(gatewayProviderAccounts.status, "active"))
      .orderBy(asc(gatewayProviderAccounts.label));
    const allowedProviderRows = providerRows.filter((row) =>
      providerAllowedByRoutePolicy(row, routePolicy?.config ?? null),
    );
    const providerModelIds = await discoverGatewayProviderModelIds({
      providers: allowedProviderRows,
      discover: discoverProviderModels,
      async fallback(row) {
        const payload = await readProviderAccountPayload(row);
        const defaultModel =
          "defaultModel" in payload && typeof payload.defaultModel === "string" ? payload.defaultModel.trim() : "";
        return defaultModel ? [defaultModel] : [];
      },
    });
    for (const discoveredModelIds of providerModelIds) {
      for (const modelId of discoveredModelIds) {
        if (routePolicyAllowsModels(routePolicy?.config ?? null, [modelId])) {
          modelIds.add(modelId);
        }
      }
    }
  }

  return Array.from(modelIds.values()).sort((left, right) => left.localeCompare(right));
}

export async function resolveGatewayRouteContext(
  projectId: string,
  requestedModel: string | null,
  endpointKind: GatewayRelayEndpointKind | string,
) {
  await reactivateExpiredCoolingProviderAccounts();
  const project = await getGatewayProjectById(projectId);
  if (!project || project.status !== "active") {
    throw new NotFoundError("AI gateway project 不存在。");
  }

  const routePolicy =
    (project.defaultRoutePolicyId
      ? await db
          .select()
          .from(gatewayRoutePolicies)
          .where(eq(gatewayRoutePolicies.id, project.defaultRoutePolicyId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null) ?? (await getDefaultRoutePolicyForProject(project.id));

  if (!routePolicy || !routePolicy.enabled) {
    throw new ConflictError("当前 project 尚未配置可用的 AI gateway route policy。");
  }

  const aliasRows = await db
    .select()
    .from(gatewayModelAliases)
    .where(
      requestedModel
        ? and(
            eq(gatewayModelAliases.alias, requestedModel),
            eq(gatewayModelAliases.enabled, true),
            or(eq(gatewayModelAliases.projectId, project.id), isNull(gatewayModelAliases.projectId)),
          )
        : and(
            eq(gatewayModelAliases.enabled, true),
            or(eq(gatewayModelAliases.projectId, project.id), isNull(gatewayModelAliases.projectId)),
          ),
    )
    .orderBy(asc(gatewayModelAliases.priority), desc(gatewayModelAliases.weight), asc(gatewayModelAliases.createdAt));

  const activeProviderRows = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(
      and(
        eq(gatewayProviderAccounts.status, "active"),
        or(isNull(gatewayProviderAccounts.cooldownUntil), lte(gatewayProviderAccounts.cooldownUntil, now())),
      ),
    )
    .orderBy(asc(gatewayProviderAccounts.createdAt));

  const providerById = new Map(activeProviderRows.map((row) => [row.id, row] as const));
  const candidates: GatewayRouteCandidate[] = [];
  for (const aliasRow of aliasRows) {
    const providerRow = providerById.get(aliasRow.providerAccountId);
    if (!providerRow) {
      continue;
    }
    if (!providerAllowedByRoutePolicy(providerRow, routePolicy.config)) {
      continue;
    }
    if (!routePolicyAllowsModels(routePolicy.config, [aliasRow.alias, aliasRow.upstreamModel])) {
      continue;
    }
    candidates.push({
      aliasId: aliasRow.id,
      modelAlias: aliasRow.alias,
      providerAccount: await toGatewayProviderAccountView(providerRow),
      upstreamModel: aliasRow.upstreamModel,
      resolvedExecutionMode: resolveProviderExecutionMode(
        providerRow.executionMode,
        (providerRow.endpointExecutionModes as GatewayEndpointExecutionModeMap | null | undefined) ?? null,
        endpointKind,
      ),
      priority: aliasRow.priority,
      weight: aliasRow.weight,
    });
  }

  if (candidates.length === 0) {
    for (const providerRow of activeProviderRows) {
      if (!providerAllowedByRoutePolicy(providerRow, routePolicy.config)) {
        continue;
      }
      const providerAccount = await toGatewayProviderAccountView(providerRow);
      const payload = providerAccount.payload;
      const defaultModel =
        "defaultModel" in payload && typeof payload.defaultModel === "string" && payload.defaultModel.trim()
          ? payload.defaultModel.trim()
          : requestedModel;
      if (!routePolicyAllowsModels(routePolicy.config, [requestedModel, defaultModel])) {
        continue;
      }
      candidates.push({
        aliasId: null,
        modelAlias: requestedModel,
        providerAccount,
        upstreamModel: defaultModel ?? null,
        resolvedExecutionMode: resolveProviderExecutionMode(
          providerRow.executionMode,
          (providerRow.endpointExecutionModes as GatewayEndpointExecutionModeMap | null | undefined) ?? null,
          endpointKind,
        ),
        priority: 100,
        weight: 1,
      });
    }
  }

  if (candidates.length === 0) {
    if (requestedModel && routePolicyHasModelRestrictions(routePolicy.config)) {
      throw new ConflictError(`当前 route policy 不允许模型 ${requestedModel}。`);
    }
    throw new ConflictError("当前网关没有可用的 provider account。");
  }

  return {
    project: toGatewayProjectView(project),
    routePolicy: toGatewayRoutePolicyView(routePolicy),
    candidates,
  } satisfies GatewayResolvedRouteContext;
}

export async function resolveGatewayProviderNamespaceContext(projectId: string, providerName: string) {
  await reactivateExpiredCoolingProviderAccounts();
  const normalizedProviderName = providerName.trim().toLowerCase();
  if (!normalizedProviderName) {
    throw new ConflictError("Provider namespace 不能为空。");
  }

  const routeContext = await resolveGatewayRouteContext(projectId, null, "provider_namespace");
  const seenProviderIds = new Set<string>();
  const providerAccounts = routeContext.candidates
    .map((candidate) => candidate.providerAccount)
    .filter((providerAccount) => {
      if (seenProviderIds.has(providerAccount.id)) {
        return false;
      }
      seenProviderIds.add(providerAccount.id);
      return true;
    })
    .filter((providerAccount) => {
      const payload = providerAccount.payload;
      if (payload.adapter === "provider_passthrough") {
        return payload.provider.trim().toLowerCase() === normalizedProviderName;
      }
      if (payload.adapter === "custom_http") {
        const configuredProvider = payload.provider?.trim().toLowerCase() ?? "";
        const fallbackProvider = providerAccount.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        return configuredProvider === normalizedProviderName || fallbackProvider === normalizedProviderName;
      }
      return false;
    });

  if (providerAccounts.length === 0) {
    throw new NotFoundError(`当前 project 未配置 provider namespace: ${providerName}`);
  }

  return {
    project: routeContext.project,
    routePolicy: routeContext.routePolicy,
    providerName: normalizedProviderName,
    providerAccounts,
  } satisfies GatewayResolvedProviderNamespaceContext;
}
