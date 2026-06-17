"use server";

import { redirect } from "next/navigation";

import {
  addAgentCapability,
  createAgent,
  deleteAgent,
  listAgents,
  listAgentCapabilities,
  listAgentMarketplaceListings,
  updateAgent,
  updateAgentCapability,
  upsertAgentMarketplaceListing,
} from "@/lib/platform-client";
import {
  buildStatusRedirect,
  resolveRedirectPath,
  setRedirectTargetQueryParams,
  toMessage,
} from "@/lib/platform-action-utils";
import { requirePlatformUserContext } from "@/lib/platform-session";

export async function createAgentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const agentLayer = String(formData.get("agentLayer") || "").trim();
  const resolvedHostingMode =
    agentLayer === "managed_light" || agentLayer === "managed_heavy" || agentLayer === "open_protocol"
      ? agentLayer
      : String(formData.get("hostingMode") || "").trim() || null;
  const resolvedSourceType =
    agentLayer === "open_protocol"
      ? "external"
      : agentLayer === "managed_light" || agentLayer === "managed_heavy"
        ? "platform"
        : (String(formData.get("sourceType") || "platform") as "platform" | "external");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const managedServiceId = String(formData.get("managedServiceId") || "").trim() || null;
  const managedProviderLabel = String(formData.get("managedProviderLabel") || "").trim() || null;
  const managedApiBaseUrl = String(formData.get("managedApiBaseUrl") || "").trim() || null;
  const managedModel = String(formData.get("managedModel") || "").trim() || null;
  const managedApiKey =
    resolvedHostingMode === "managed_api"
      ? String(formData.get("managedApiKey") || "").trim() || null
      : null;
  const managedSystemPrompt = String(formData.get("managedSystemPrompt") || "").trim() || null;
  const managedPromptTemplate = String(formData.get("managedPromptTemplate") || "").trim() || null;
  const managedTaskCategory = String(formData.get("managedTaskCategory") || "").trim() || null;
  const managedCapabilitySummary = String(formData.get("managedCapabilitySummary") || "").trim() || null;
  const listingPriceAmountRaw = Number(formData.get("listingPriceAmount") || 0);
  const listingPriceAmount = Number.isFinite(listingPriceAmountRaw) ? Math.max(1, Math.floor(listingPriceAmountRaw)) : 300;
  const listingBillingModeRaw = String(formData.get("listingBillingMode") || "flat_task").trim();
  const listingBillingMode =
    listingBillingModeRaw === "token_metered" || listingBillingModeRaw === "property_metered"
      ? listingBillingModeRaw
      : "flat_task";
  const listingPriceCurrencyRaw = String(formData.get("listingPriceCurrency") || "obsidian").trim();
  const listingPriceCurrency = listingPriceCurrencyRaw === "mira" ? "mira" : "obsidian";
  const listingAutoTakeEnabled = formData
    .getAll("listingAutoTakeEnabled")
    .some((value) => String(value).trim() === "true");
  const listingBillingUnit = normalizeManagedLightListingBillingUnit(
    listingBillingMode,
    String(formData.get("listingBillingUnit") || "").trim() || null,
  );
  const listingMeterKey = normalizeManagedLightListingMeterKey(
    listingBillingMode,
    String(formData.get("listingMeterKey") || "").trim() || null,
  );
  const lightInputSchema =
    resolvedHostingMode === "managed_light"
      ? parseStructuredResourceSchema(formData, "input", "输入资源")
      : null;
  const lightOutputSchema =
    resolvedHostingMode === "managed_light"
      ? parseStructuredResourceSchema(formData, "output", "输出资源")
      : null;
  try {
    const agent = await createAgent(userContext, {
      name,
      description,
      sourceType: resolvedSourceType,
      hostingMode: resolvedHostingMode
        ? (resolvedHostingMode as
            | "managed_light"
            | "managed_heavy"
            | "open_protocol"
            | "registry_only"
            | "external_runtime"
            | "managed_api")
        : undefined,
      runtimeEndpoint: String(formData.get("runtimeEndpoint") || "").trim() || null,
      authMode: String(formData.get("authMode") || "none") as "none" | "apiKey" | "bearer",
      runtimeAuthToken: String(formData.get("runtimeAuthToken") || "").trim() || null,
      managedServiceId,
      managedProviderLabel,
      managedApiBaseUrl,
      managedModel,
      managedApiKey,
      managedSystemPrompt,
      managedPromptTemplate,
      managedTaskCategory,
      managedCapabilitySummary,
      enabled: String(formData.get("enabled") || "true") !== "false",
    });
    if (resolvedHostingMode === "managed_light") {
      const capability = await addAgentCapability(userContext, agent.id, {
        code: buildManagedLightCapabilityCode(agent.name, managedTaskCategory),
        title: agent.name,
        description: managedCapabilitySummary,
        routingSummary: managedCapabilitySummary,
        routingTags: buildManagedLightRoutingTags(managedTaskCategory),
        inputSchema: lightInputSchema,
        outputSchema: lightOutputSchema,
        resourceNormalizationPrompt: null,
        pricingNote: null,
        enabled: true,
      });
      await upsertAgentMarketplaceListing(userContext, {
        capabilityId: capability.id,
        publicTitle: agent.name,
        publicDescription: managedCapabilitySummary,
        billingMode: listingBillingMode,
        billingUnit: listingBillingUnit,
        meterKey: listingMeterKey,
        priceCurrency: listingPriceCurrency,
        priceAmount: listingPriceAmount,
        status: "published",
        externalInvocationEnabled: true,
        autoTakeEnabled: listingAutoTakeEnabled,
        autoTakeStatementTemplate: null,
      });
    }
    redirect(buildStatusRedirect(setRedirectTargetQueryParams(redirectTo, { agentId: agent.id }), "success", "Agent 创建成功。"));
  } catch (error) {
    const message = toMessage(error, "Agent 创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function saveManagedLightAgentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), redirectTo);
  const agentId = String(formData.get("agentId") || "").trim();
  const capabilityId = String(formData.get("capabilityId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const managedServiceId = String(formData.get("managedServiceId") || "").trim() || null;
  const managedModel = String(formData.get("managedModel") || "").trim() || null;
  const managedTaskCategory = String(formData.get("managedTaskCategory") || "").trim() || null;
  const managedCapabilitySummary = String(formData.get("managedCapabilitySummary") || "").trim() || null;
  const managedSystemPrompt = String(formData.get("managedSystemPrompt") || "").trim() || null;
  const managedPromptTemplate = String(formData.get("managedPromptTemplate") || "").trim() || null;
  const listingPriceAmountRaw = Number(formData.get("listingPriceAmount") || 0);
  const listingPriceAmount = Number.isFinite(listingPriceAmountRaw) ? Math.max(1, Math.floor(listingPriceAmountRaw)) : 300;
  const listingBillingModeRaw = String(formData.get("listingBillingMode") || "flat_task").trim();
  const listingBillingMode =
    listingBillingModeRaw === "token_metered" || listingBillingModeRaw === "property_metered"
      ? listingBillingModeRaw
      : "flat_task";
  const listingPriceCurrencyRaw = String(formData.get("listingPriceCurrency") || "obsidian").trim();
  const listingPriceCurrency = listingPriceCurrencyRaw === "mira" ? "mira" : "obsidian";
  const listingAutoTakeEnabled = formData
    .getAll("listingAutoTakeEnabled")
    .some((value) => String(value).trim() === "true");
  const lightInputSchema = parseStructuredResourceSchema(formData, "input", "输入资源");
  const lightOutputSchema = parseStructuredResourceSchema(formData, "output", "输出资源");

  try {
    let savedAgent = null as Awaited<ReturnType<typeof createAgent>> | null;
    let resolvedCapabilityId = capabilityId;
    let existingCapability = null as Awaited<ReturnType<typeof listAgentCapabilities>>[number] | null;
    let existingListing = null as Awaited<ReturnType<typeof listAgentMarketplaceListings>>[number] | null;

    if (agentId) {
      const [capabilities, listings] = await Promise.all([
        listAgentCapabilities(userContext, agentId),
        listAgentMarketplaceListings(userContext, "owner"),
      ]);
      existingCapability = capabilityId ? capabilities.find((capability) => capability.id === capabilityId) ?? null : capabilities[0] ?? null;
      if (existingCapability) {
        const existingCapabilityId = existingCapability.id;
        existingListing = listings.find((listing) => listing.capabilityId === existingCapabilityId) ?? null;
      }
      savedAgent = await updateAgent(userContext, agentId, {
        name,
        description: null,
        runtimeEndpoint: null,
        authMode: "none",
        runtimeAuthToken: null,
        managedServiceId,
        managedProviderLabel: null,
        managedApiBaseUrl: null,
        managedModel,
        managedApiKey: null,
        managedSystemPrompt,
        managedPromptTemplate,
        managedTaskCategory,
        managedCapabilitySummary,
      });

      if (existingCapability) {
        const updatedCapability = await updateAgentCapability(userContext, agentId, existingCapability.id, {
          title: savedAgent.name,
          description: managedCapabilitySummary,
          routingSummary: managedCapabilitySummary,
          routingTags: buildManagedLightRoutingTags(managedTaskCategory),
          inputSchema: lightInputSchema,
          outputSchema: lightOutputSchema,
          resourceNormalizationPrompt: existingCapability.resourceNormalizationPrompt,
          pricingNote: existingCapability.pricingNote,
          enabled: existingCapability.enabled,
        });
        resolvedCapabilityId = updatedCapability.id;
      }
    }

    if (!savedAgent) {
      savedAgent = await createAgent(userContext, {
        name,
        description: null,
        sourceType: "platform",
        hostingMode: "managed_light",
        runtimeEndpoint: null,
        authMode: "none",
        runtimeAuthToken: null,
        managedServiceId,
        managedProviderLabel: null,
        managedApiBaseUrl: null,
        managedModel,
        managedApiKey: null,
        managedSystemPrompt,
        managedPromptTemplate,
        managedTaskCategory,
        managedCapabilitySummary,
        enabled: true,
      });
    }

    if (!resolvedCapabilityId) {
      const capability = await addAgentCapability(userContext, savedAgent.id, {
        code: buildManagedLightCapabilityCode(savedAgent.name, managedTaskCategory),
        title: savedAgent.name,
        description: managedCapabilitySummary,
        routingSummary: managedCapabilitySummary,
        routingTags: buildManagedLightRoutingTags(managedTaskCategory),
        inputSchema: lightInputSchema,
        outputSchema: lightOutputSchema,
        resourceNormalizationPrompt: null,
        pricingNote: null,
        enabled: true,
      });
      resolvedCapabilityId = capability.id;
    }

    await upsertAgentMarketplaceListing(userContext, {
      capabilityId: resolvedCapabilityId,
      publicTitle: savedAgent.name,
      publicDescription: managedCapabilitySummary,
      billingMode: listingBillingMode,
      billingUnit: normalizeManagedLightListingBillingUnit(listingBillingMode, null),
      meterKey: normalizeManagedLightListingMeterKey(listingBillingMode, null),
      priceCurrency: listingPriceCurrency,
      priceAmount: listingPriceAmount,
      status: existingListing?.status ?? "published",
      externalInvocationEnabled: existingListing?.externalInvocationEnabled ?? true,
      autoTakeEnabled: listingAutoTakeEnabled,
      autoTakeStatementTemplate: existingListing?.autoTakeStatementTemplate ?? null,
    });

    redirect(buildStatusRedirect(successRedirectTo, "success", agentId ? "羽量 Agent 已更新。" : "羽量 Agent 已创建。"));
  } catch (error) {
    const message = toMessage(error, agentId ? "羽量 Agent 更新失败，请稍后重试。" : "羽量 Agent 创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function saveManagedCloudAgentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents?role=cloud");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents?role=cloud");
  const agentId = String(formData.get("agentId") || "").trim();
  const capabilityId = String(formData.get("capabilityId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const runtimeEndpoint = String(formData.get("runtimeEndpoint") || "").trim() || null;
  const authModeRaw = String(formData.get("authMode") || "none").trim();
  const authMode = authModeRaw === "apiKey" || authModeRaw === "bearer" ? authModeRaw : "none";
  const runtimeAuthTokenRaw = String(formData.get("runtimeAuthToken") || "").trim();
  const listingPriceAmountRaw = Number(formData.get("listingPriceAmount") || 0);
  const listingPriceAmount = Number.isFinite(listingPriceAmountRaw) ? Math.max(1, Math.floor(listingPriceAmountRaw)) : 300;
  const listingPriceCurrencyRaw = String(formData.get("listingPriceCurrency") || "obsidian").trim();
  const listingPriceCurrency = listingPriceCurrencyRaw === "mira" ? "mira" : "obsidian";
  const listingAutoTakeEnabled = formData
    .getAll("listingAutoTakeEnabled")
    .some((value) => String(value).trim() === "true");

  try {
    let savedAgent = null as Awaited<ReturnType<typeof createAgent>> | null;
    let resolvedCapabilityId = capabilityId;
    let existingCapability = null as Awaited<ReturnType<typeof listAgentCapabilities>>[number] | null;
    let existingListing = null as Awaited<ReturnType<typeof listAgentMarketplaceListings>>[number] | null;

    if (agentId) {
      const [ownedAgents, capabilities, listings] = await Promise.all([
        listAgents(userContext),
        listAgentCapabilities(userContext, agentId),
        listAgentMarketplaceListings(userContext, "owner"),
      ]);
      const existingAgent =
        ownedAgents.find(
          (agent) =>
            agent.id === agentId && (agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime"),
        ) ?? null;

      if (!existingAgent) {
        redirect(buildStatusRedirect(redirectTo, "error", "未找到可编辑的云端 Agent。"));
      }

      existingCapability = capabilityId ? capabilities.find((capability) => capability.id === capabilityId) ?? null : capabilities[0] ?? null;
      if (existingCapability) {
        const existingCapabilityId = existingCapability.id;
        existingListing = listings.find((listing) => listing.capabilityId === existingCapabilityId) ?? null;
      }

      const updateInput: {
        name: string;
        description?: string | null;
        runtimeEndpoint?: string | null;
        authMode?: "none" | "apiKey" | "bearer";
        runtimeAuthToken?: string | null;
        managedServiceId?: string | null;
        managedProviderLabel?: string | null;
        managedApiBaseUrl?: string | null;
        managedModel?: string | null;
        managedApiKey?: string | null;
        managedSystemPrompt?: string | null;
        managedPromptTemplate?: string | null;
        managedTaskCategory?: string | null;
        managedCapabilitySummary?: string | null;
        enabled?: boolean;
      } = {
        name,
        description,
        runtimeEndpoint,
        authMode,
        managedServiceId: null,
        managedProviderLabel: null,
        managedApiBaseUrl: null,
        managedModel: null,
        managedApiKey: null,
        managedSystemPrompt: null,
        managedPromptTemplate: null,
        managedTaskCategory: null,
        managedCapabilitySummary: null,
        enabled: existingAgent.enabled,
      };

      if (authMode === "none") {
        updateInput.runtimeAuthToken = null;
      } else if (runtimeAuthTokenRaw.length > 0) {
        updateInput.runtimeAuthToken = runtimeAuthTokenRaw;
      }

      savedAgent = await updateAgent(userContext, agentId, updateInput);

      if (existingCapability) {
        const updatedCapability = await updateAgentCapability(userContext, agentId, existingCapability.id, {
          title: savedAgent.name,
          description,
          routingSummary: description,
          routingTags: buildManagedCloudRoutingTags(),
          inputSchema: null,
          outputSchema: null,
          resourceNormalizationPrompt: null,
          pricingNote: null,
          enabled: existingCapability.enabled,
        });
        resolvedCapabilityId = updatedCapability.id;
      }
    }

    if (!savedAgent) {
      savedAgent = await createAgent(userContext, {
        name,
        description,
        sourceType: "external",
        hostingMode: "open_protocol",
        runtimeEndpoint,
        authMode,
        runtimeAuthToken: authMode === "none" ? null : runtimeAuthTokenRaw || null,
        managedServiceId: null,
        managedProviderLabel: null,
        managedApiBaseUrl: null,
        managedModel: null,
        managedApiKey: null,
        managedSystemPrompt: null,
        managedPromptTemplate: null,
        managedTaskCategory: null,
        managedCapabilitySummary: null,
        enabled: true,
      });
    }

    if (!resolvedCapabilityId) {
      const capability = await addAgentCapability(userContext, savedAgent.id, {
        code: buildManagedCloudCapabilityCode(savedAgent.name),
        title: savedAgent.name,
        description,
        routingSummary: description,
        routingTags: buildManagedCloudRoutingTags(),
        inputSchema: null,
        outputSchema: null,
        resourceNormalizationPrompt: null,
        pricingNote: null,
        enabled: true,
      });
      resolvedCapabilityId = capability.id;
    }

    await upsertAgentMarketplaceListing(userContext, {
      capabilityId: resolvedCapabilityId,
      publicTitle: savedAgent.name,
      publicDescription: description,
      billingMode: "flat_task",
      billingUnit: normalizeManagedLightListingBillingUnit("flat_task", null),
      meterKey: null,
      priceCurrency: listingPriceCurrency,
      priceAmount: listingPriceAmount,
      status: existingListing?.status ?? "published",
      externalInvocationEnabled: existingListing?.externalInvocationEnabled ?? true,
      autoTakeEnabled: listingAutoTakeEnabled,
      autoTakeStatementTemplate: existingListing?.autoTakeStatementTemplate ?? null,
    });

    redirect(buildStatusRedirect(successRedirectTo, "success", agentId ? "云端 Agent 已更新。" : "云端 Agent 已创建。"));
  } catch (error) {
    const message = toMessage(error, agentId ? "云端 Agent 更新失败，请稍后重试。" : "云端 Agent 创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function saveManagedHeavyAgentAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents?role=heavy");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents?role=heavy");
  const agentId = String(formData.get("agentId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const enabled = formData.getAll("enabled").some((value) => String(value).trim() === "true");

  try {
    const ownedAgents = await listAgents(userContext);
    const existingHeavyAgents = ownedAgents.filter(
      (agent) => agent.hostingMode === "managed_heavy" || agent.hostingMode === "registry_only",
    );

    if (agentId) {
      const existingAgent = existingHeavyAgents.find((agent) => agent.id === agentId) ?? null;
      if (!existingAgent) {
        redirect(buildStatusRedirect(redirectTo, "error", "未找到可编辑的重度智能体。"));
      }

      await updateAgent(userContext, agentId, {
        name,
        description,
        runtimeEndpoint: existingAgent.runtimeEndpoint,
        authMode: existingAgent.authMode,
        runtimeAuthToken: null,
        managedServiceId: existingAgent.managedServiceId,
        managedProviderLabel: existingAgent.managedProviderLabel,
        managedApiBaseUrl: existingAgent.managedApiBaseUrl,
        managedModel: existingAgent.managedModel,
        managedApiKey: null,
        managedSystemPrompt: existingAgent.managedSystemPrompt,
        managedPromptTemplate: existingAgent.managedPromptTemplate,
        managedTaskCategory: existingAgent.managedTaskCategory,
        managedCapabilitySummary: existingAgent.managedCapabilitySummary,
        enabled,
      });

      redirect(buildStatusRedirect(successRedirectTo, "success", "重度智能体已更新。"));
    }

    if (existingHeavyAgents.length >= 1) {
      redirect(buildStatusRedirect(redirectTo, "error", "当前仅允许 1 个自创建重度槽位，更多槽位请先购买。"));
    }

    await createAgent(userContext, {
      name,
      description,
      sourceType: "platform",
      hostingMode: "managed_heavy",
      runtimeEndpoint: null,
      authMode: "none",
      runtimeAuthToken: null,
      managedServiceId: null,
      managedProviderLabel: null,
      managedApiBaseUrl: null,
      managedModel: null,
      managedApiKey: null,
      managedSystemPrompt: null,
      managedPromptTemplate: null,
      managedTaskCategory: null,
      managedCapabilitySummary: null,
      enabled,
    });

    redirect(buildStatusRedirect(successRedirectTo, "success", "重度智能体已创建。"));
  } catch (error) {
    const message = toMessage(error, agentId ? "重度智能体更新失败，请稍后重试。" : "重度智能体创建失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

type ManagedLightBatchAction = "delete" | "enable" | "disable";

function buildUpdateAgentInputFromView(agent: Awaited<ReturnType<typeof listAgents>>[number], enabled: boolean) {
  return {
    name: agent.name,
    description: agent.description,
    runtimeEndpoint: agent.runtimeEndpoint,
    authMode: agent.authMode,
    runtimeAuthToken: null,
    managedServiceId: agent.managedServiceId,
    managedProviderLabel: agent.managedProviderLabel,
    managedApiBaseUrl: agent.managedApiBaseUrl,
    managedModel: agent.managedModel,
    managedApiKey: null,
    managedSystemPrompt: agent.managedSystemPrompt,
    managedPromptTemplate: agent.managedPromptTemplate,
    managedTaskCategory: agent.managedTaskCategory,
    managedCapabilitySummary: agent.managedCapabilitySummary,
    enabled,
  };
}

export async function applyManagedLightAgentBatchAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents");
  const batchAction = String(formData.get("batchAction") || "").trim() as ManagedLightBatchAction;
  const selectedAgentIds = [...new Set(formData.getAll("agentIds").map((value) => String(value || "").trim()).filter(Boolean))];

  if (batchAction !== "delete" && batchAction !== "enable" && batchAction !== "disable") {
    redirect(buildStatusRedirect(redirectTo, "error", "未识别的羽量批量操作。"));
  }

  if (selectedAgentIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先勾选至少一个羽量 Agent。"));
  }

  try {
    const ownedAgents = await listAgents(userContext);
    const ownedAgentMap = new Map(ownedAgents.map((agent) => [agent.id, agent] as const));
    const selectedAgents = selectedAgentIds
      .map((agentId) => ownedAgentMap.get(agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
      .filter((agent) => agent.hostingMode === "managed_light");

    if (selectedAgents.length === 0) {
      redirect(buildStatusRedirect(redirectTo, "error", "未找到可操作的羽量 Agent。"));
    }

    if (batchAction === "delete") {
      for (const agent of selectedAgents) {
        await deleteAgent(userContext, agent.id);
      }
      redirect(buildStatusRedirect(successRedirectTo, "success", `已删除 ${selectedAgents.length} 个羽量 Agent。`));
    }

    const nextEnabled = batchAction === "enable";
    for (const agent of selectedAgents) {
      await updateAgent(userContext, agent.id, buildUpdateAgentInputFromView(agent, nextEnabled));
    }

    redirect(
      buildStatusRedirect(
        successRedirectTo,
        "success",
        batchAction === "enable"
          ? `已启用 ${selectedAgents.length} 个羽量 Agent。`
          : `已停用 ${selectedAgents.length} 个羽量 Agent。`,
      ),
    );
  } catch (error) {
    const message =
      batchAction === "delete"
        ? toMessage(error, "批量删除羽量 Agent 失败，请稍后重试。")
        : batchAction === "enable"
          ? toMessage(error, "批量启用羽量 Agent 失败，请稍后重试。")
          : toMessage(error, "批量停用羽量 Agent 失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function applyManagedCloudAgentBatchAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents?role=cloud");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents?role=cloud");
  const batchAction = String(formData.get("batchAction") || "").trim() as ManagedLightBatchAction;
  const selectedAgentIds = [...new Set(formData.getAll("agentIds").map((value) => String(value || "").trim()).filter(Boolean))];

  if (batchAction !== "delete" && batchAction !== "enable" && batchAction !== "disable") {
    redirect(buildStatusRedirect(redirectTo, "error", "未识别的云端批量操作。"));
  }

  if (selectedAgentIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先勾选至少一个云端 Agent。"));
  }

  try {
    const ownedAgents = await listAgents(userContext);
    const ownedAgentMap = new Map(ownedAgents.map((agent) => [agent.id, agent] as const));
    const selectedAgents = selectedAgentIds
      .map((agentId) => ownedAgentMap.get(agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
      .filter((agent) => agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime");

    if (selectedAgents.length === 0) {
      redirect(buildStatusRedirect(redirectTo, "error", "未找到可操作的云端 Agent。"));
    }

    if (batchAction === "delete") {
      for (const agent of selectedAgents) {
        await deleteAgent(userContext, agent.id);
      }
      redirect(buildStatusRedirect(successRedirectTo, "success", `已删除 ${selectedAgents.length} 个云端 Agent。`));
    }

    const nextEnabled = batchAction === "enable";
    for (const agent of selectedAgents) {
      await updateAgent(userContext, agent.id, buildUpdateAgentInputFromView(agent, nextEnabled));
    }

    redirect(
      buildStatusRedirect(
        successRedirectTo,
        "success",
        batchAction === "enable"
          ? `已启用 ${selectedAgents.length} 个云端 Agent。`
          : `已停用 ${selectedAgents.length} 个云端 Agent。`,
      ),
    );
  } catch (error) {
    const message =
      batchAction === "delete"
        ? toMessage(error, "批量删除云端 Agent 失败，请稍后重试。")
        : batchAction === "enable"
          ? toMessage(error, "批量启用云端 Agent 失败，请稍后重试。")
          : toMessage(error, "批量停用云端 Agent 失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function applyManagedHeavyAgentBatchAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents?role=heavy");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), "/agents?role=heavy");
  const batchAction = String(formData.get("batchAction") || "").trim() as ManagedLightBatchAction;
  const selectedAgentIds = [...new Set(formData.getAll("agentIds").map((value) => String(value || "").trim()).filter(Boolean))];

  if (batchAction !== "delete" && batchAction !== "enable" && batchAction !== "disable") {
    redirect(buildStatusRedirect(redirectTo, "error", "未识别的重度批量操作。"));
  }

  if (selectedAgentIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先勾选至少一个重度智能体。"));
  }

  try {
    const ownedAgents = await listAgents(userContext);
    const ownedAgentMap = new Map(ownedAgents.map((agent) => [agent.id, agent] as const));
    const selectedAgents = selectedAgentIds
      .map((agentId) => ownedAgentMap.get(agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
      .filter((agent) => agent.hostingMode === "managed_heavy" || agent.hostingMode === "registry_only");

    if (selectedAgents.length === 0) {
      redirect(buildStatusRedirect(redirectTo, "error", "未找到可操作的重度智能体。"));
    }

    if (batchAction === "delete") {
      for (const agent of selectedAgents) {
        await deleteAgent(userContext, agent.id);
      }
      redirect(buildStatusRedirect(successRedirectTo, "success", `已删除 ${selectedAgents.length} 个重度智能体。`));
    }

    const nextEnabled = batchAction === "enable";
    for (const agent of selectedAgents) {
      await updateAgent(userContext, agent.id, buildUpdateAgentInputFromView(agent, nextEnabled));
    }

    redirect(
      buildStatusRedirect(
        successRedirectTo,
        "success",
        batchAction === "enable"
          ? `已启用 ${selectedAgents.length} 个重度智能体。`
          : `已停用 ${selectedAgents.length} 个重度智能体。`,
      ),
    );
  } catch (error) {
    const message =
      batchAction === "delete"
        ? toMessage(error, "批量删除重度智能体失败，请稍后重试。")
        : batchAction === "enable"
          ? toMessage(error, "批量启用重度智能体失败，请稍后重试。")
          : toMessage(error, "批量停用重度智能体失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

type BulkAgentImportListing = {
  publicTitle: string;
  publicDescription?: string | null;
  billingMode?: "flat_task" | "token_metered" | "property_metered";
  billingUnit?: string | null;
  meterKey?: string | null;
  priceCurrency?: "obsidian" | "mira";
  priceAmount: number;
  status?: "draft" | "published" | "paused";
  externalInvocationEnabled?: boolean;
  autoTakeEnabled?: boolean;
  autoTakeStatementTemplate?: string | null;
};

type BulkAgentImportCapability = {
  code: string;
  title: string;
  description?: string | null;
  routingSummary?: string | null;
  routingTags?: string[] | null;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  resourceNormalizationPrompt?: string | null;
  pricingNote?: string | null;
  enabled?: boolean;
  listing?: BulkAgentImportListing | null;
};

type BulkAgentImportEntry = {
  agentLayer?: "managed_light" | "managed_heavy" | "open_protocol";
  name: string;
  description?: string | null;
  sourceType?: "platform" | "external";
  hostingMode?:
    | "managed_light"
    | "managed_heavy"
    | "open_protocol"
    | "registry_only"
    | "external_runtime"
    | "managed_api";
  authMode?: "none" | "apiKey" | "bearer";
  runtimeEndpoint?: string | null;
  runtimeAuthToken?: string | null;
  managedServiceId?: string | null;
  managedProviderLabel?: string | null;
  managedApiBaseUrl?: string | null;
  managedModel?: string | null;
  managedApiKey?: string | null;
  managedSystemPrompt?: string | null;
  managedPromptTemplate?: string | null;
  managedTaskCategory?: string | null;
  managedCapabilitySummary?: string | null;
  enabled?: boolean;
  capabilities?: BulkAgentImportCapability[];
};

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseOptionalJsonRecord(value: FormDataEntryValue | null, fieldLabel: string) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel} 不是合法 JSON。`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} 需要是 JSON 对象。`);
  }
  return parsed as Record<string, unknown>;
}

function buildStructuredResourcePropertySchema(
  type: string,
  description: string | null,
  marker: string | null,
  defaultResource:
    | {
        kind: "text";
        value: string;
      }
    | {
        kind: "file";
        fileName: string;
        contentType: string | null;
        dataUrl: string;
      }
    | null,
): Record<string, unknown> {
  const normalizedDescription = description?.trim() || undefined;
  const normalizedMarker = marker?.trim() || undefined;
  const markerExtension = normalizedMarker ? { "x-openagent-marker": normalizedMarker } : {};
  const defaultResourceExtension = defaultResource ? { "x-openagent-default-resource": defaultResource } : {};
  if (type === "number" || type === "integer" || type === "boolean" || type === "object" || type === "array") {
    return {
      type,
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "image") {
    return {
      type: "string",
      contentMediaType: "image/*",
      "x-openagent-resource-kind": "image",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "audio") {
    return {
      type: "string",
      contentMediaType: "audio/*",
      "x-openagent-resource-kind": "audio",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "video") {
    return {
      type: "string",
      contentMediaType: "video/*",
      "x-openagent-resource-kind": "video",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "archive") {
    return {
      type: "string",
      contentMediaType: "application/zip",
      "x-openagent-resource-kind": "archive",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "file") {
    return {
      type: "string",
      contentMediaType: "application/octet-stream",
      "x-openagent-resource-kind": "file",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  if (type === "url") {
    return {
      type: "string",
      format: "uri",
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...markerExtension,
      ...defaultResourceExtension,
    };
  }
  return {
    type: "string",
    ...(normalizedDescription ? { description: normalizedDescription } : {}),
    ...markerExtension,
    ...defaultResourceExtension,
  };
}

function parseStructuredResourceSchema(
  formData: FormData,
  prefix: "input" | "output",
  fieldLabel: string,
) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const name = String(formData.get(`${prefix}FieldName${index}`) || "").trim();
    if (!name) {
      continue;
    }
    const type = String(formData.get(`${prefix}FieldType${index}`) || "string").trim();
    const description = null;
    const marker = String(formData.get(`${prefix}FieldMarker${index}`) || "").trim() || null;
    const defaultText = String(formData.get(`${prefix}FieldDefaultText${index}`) || "").trim();
    const defaultFileName = String(formData.get(`${prefix}FieldDefaultFileName${index}`) || "").trim();
    const defaultFileType = String(formData.get(`${prefix}FieldDefaultFileType${index}`) || "").trim() || null;
    const defaultFileData = String(formData.get(`${prefix}FieldDefaultFileData${index}`) || "").trim();
    const defaultResource = defaultFileData
      ? {
          kind: "file" as const,
          fileName: defaultFileName || `${name}.bin`,
          contentType: defaultFileType,
          dataUrl: defaultFileData,
        }
      : defaultText
        ? {
            kind: "text" as const,
            value: defaultText,
          }
        : null;
    properties[name] = buildStructuredResourcePropertySchema(type, description, marker, defaultResource);
    if (String(formData.get(`${prefix}FieldRequired${index}`) || "").trim() === "true") {
      required.push(name);
    }
  }
  if (Object.keys(properties).length === 0) {
    return parseOptionalJsonRecord(formData.get(prefix === "input" ? "inputSchema" : "outputSchema"), fieldLabel);
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length > 0 ? { required } : {}),
  } satisfies Record<string, unknown>;
}

const managedLightTaskCategoryLabels = new Map<string, string>([
  ["image_processing", "图像处理"],
  ["video_processing", "视频处理"],
  ["audio_processing", "音频处理"],
  ["text_generation", "文本生成"],
  ["translation", "翻译改写"],
  ["coding", "代码处理"],
  ["data_analysis", "数据分析"],
]);

function formatManagedLightTaskCategoryLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return managedLightTaskCategoryLabels.get(value) ?? value;
}

function buildManagedLightCapabilityCode(name: string, category: string | null) {
  const slugSource = (category?.trim() || name.trim() || "primary-task").toLowerCase();
  const slug = slugSource.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug ? `primary-${slug}` : "primary-task";
}

function buildManagedCloudCapabilityCode(name: string) {
  const slugSource = (name.trim() || "cloud-agent").toLowerCase();
  const slug = slugSource.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug ? `cloud-${slug}` : "cloud-agent";
}

function buildManagedLightRoutingTags(category: string | null) {
  const tags = new Set<string>();
  const normalizedCategory = category?.trim() || "";
  const categoryLabel = formatManagedLightTaskCategoryLabel(normalizedCategory);
  if (categoryLabel) {
    tags.add(categoryLabel);
  }
  if (normalizedCategory && normalizedCategory !== categoryLabel) {
    tags.add(normalizedCategory);
  }
  return tags.size > 0 ? Array.from(tags) : null;
}

function buildManagedCloudRoutingTags() {
  return ["云端智能体", "高智能", "OpenAgent"];
}

function normalizeManagedLightListingBillingUnit(
  billingMode: "flat_task" | "token_metered" | "property_metered",
  value: string | null,
) {
  const normalized = value?.trim();
  if (normalized) {
    return normalized;
  }
  if (billingMode === "token_metered") {
    return "1k_tokens";
  }
  if (billingMode === "property_metered") {
    return "task_property";
  }
  return "task";
}

function normalizeManagedLightListingMeterKey(
  billingMode: "flat_task" | "token_metered" | "property_metered",
  value: string | null,
) {
  const normalized = value?.trim();
  if (billingMode !== "property_metered") {
    return null;
  }
  return normalized || "task_units";
}

function parseOptionalStringList(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const seen = new Set<string>();
  return raw
    .split(/[\r\n,，;；]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const normalized = item.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readOptionalRecord(value: unknown, fieldLabel: string) {
  if (value == null) {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldLabel} 需要是 JSON 对象。`);
  }
  return value as Record<string, unknown>;
}

function parseBulkAgentImportPayload(raw: string): BulkAgentImportEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("批量导入内容不是合法 JSON。");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("批量导入需要传入非空 JSON 数组。");
  }
  if (parsed.length > 20) {
    throw new Error("单次最多导入 20 个 agents。");
  }
  return parsed as BulkAgentImportEntry[];
}

export async function bulkImportAgentsAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const payload = String(formData.get("payload") || "").trim();
  if (!payload) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先填写批量导入 JSON。"));
  }

  try {
    const entries = parseBulkAgentImportPayload(payload);
    let createdAgentCount = 0;
    let createdCapabilityCount = 0;
    let createdListingCount = 0;
    let lastAgentId: string | null = null;

    for (const [entryIndex, entry] of entries.entries()) {
      const name = readOptionalString(entry?.name);
      if (!name) {
        throw new Error(`第 ${entryIndex + 1} 个 agent 缺少 name。`);
      }

      const inferredHostingMode =
        entry.agentLayer ||
        entry.hostingMode ||
        (readOptionalString(entry.runtimeEndpoint)
          ? "open_protocol"
          : readOptionalString(entry.managedServiceId) || readOptionalString(entry.managedApiBaseUrl)
            ? "managed_light"
            : readOptionalString(entry.managedApiKey)
              ? "managed_api"
            : "registry_only");
      const sourceType =
        entry.sourceType ||
        (inferredHostingMode === "open_protocol" || inferredHostingMode === "external_runtime" ? "external" : "platform");

      const agent = await createAgent(userContext, {
        name,
        description: readOptionalString(entry.description),
        sourceType,
        hostingMode: inferredHostingMode,
        authMode: entry.authMode || "none",
        runtimeEndpoint: readOptionalString(entry.runtimeEndpoint),
        runtimeAuthToken: readOptionalString(entry.runtimeAuthToken),
        managedServiceId: readOptionalString(entry.managedServiceId),
        managedProviderLabel: readOptionalString(entry.managedProviderLabel),
        managedApiBaseUrl: readOptionalString(entry.managedApiBaseUrl),
        managedModel: readOptionalString(entry.managedModel),
        managedApiKey: readOptionalString(entry.managedApiKey),
        managedSystemPrompt: readOptionalString(entry.managedSystemPrompt),
        managedPromptTemplate: readOptionalString(entry.managedPromptTemplate),
        managedTaskCategory: readOptionalString(entry.managedTaskCategory),
        managedCapabilitySummary: readOptionalString(entry.managedCapabilitySummary),
        enabled: readBoolean(entry.enabled, true),
      });
      createdAgentCount += 1;
      lastAgentId = agent.id;

      const capabilities = Array.isArray(entry.capabilities) ? entry.capabilities : [];
      for (const [capabilityIndex, capabilityEntry] of capabilities.entries()) {
        const code = readOptionalString(capabilityEntry?.code);
        const title = readOptionalString(capabilityEntry?.title);
        if (!code || !title) {
          throw new Error(`第 ${entryIndex + 1} 个 agent 的第 ${capabilityIndex + 1} 个 capability 缺少 code 或 title。`);
        }

        const capability = await addAgentCapability(userContext, agent.id, {
          code,
          title,
          description: readOptionalString(capabilityEntry.description),
          routingSummary: readOptionalString(capabilityEntry.routingSummary),
          routingTags: Array.isArray(capabilityEntry.routingTags)
            ? capabilityEntry.routingTags.filter((tag): tag is string => typeof tag === "string")
            : null,
          inputSchema: readOptionalRecord(capabilityEntry.inputSchema, "输入资源"),
          outputSchema: readOptionalRecord(capabilityEntry.outputSchema, "输出资源"),
          resourceNormalizationPrompt: readOptionalString(capabilityEntry.resourceNormalizationPrompt),
          pricingNote: readOptionalString(capabilityEntry.pricingNote),
          enabled: readBoolean(capabilityEntry.enabled, true),
        });
        createdCapabilityCount += 1;

        if (capabilityEntry.listing && typeof capabilityEntry.listing === "object") {
          const listing = capabilityEntry.listing;
          const publicTitle = readOptionalString(listing.publicTitle);
          const rawPriceAmount = Number(listing.priceAmount || 0);
          if (!publicTitle || !Number.isFinite(rawPriceAmount) || rawPriceAmount <= 0) {
            throw new Error(
              `第 ${entryIndex + 1} 个 agent 的 capability ${code} listing 缺少 publicTitle 或 priceAmount。`,
            );
          }
          await upsertAgentMarketplaceListing(userContext, {
            capabilityId: capability.id,
            publicTitle,
            publicDescription: readOptionalString(listing.publicDescription),
            billingMode: listing.billingMode || "flat_task",
            billingUnit: readOptionalString(listing.billingUnit),
            meterKey: readOptionalString(listing.meterKey),
            priceCurrency: listing.priceCurrency || "obsidian",
            priceAmount: Math.max(1, Math.floor(rawPriceAmount)),
            status: listing.status || "draft",
            externalInvocationEnabled: readBoolean(listing.externalInvocationEnabled, false),
            autoTakeEnabled: readBoolean(listing.autoTakeEnabled, false),
            autoTakeStatementTemplate: readOptionalString(listing.autoTakeStatementTemplate),
          });
          createdListingCount += 1;
        }
      }
    }

    redirect(
      buildStatusRedirect(
        setRedirectTargetQueryParams(redirectTo, { agentId: lastAgentId }),
        "success",
        `批量导入完成：${createdAgentCount} 个 agents，${createdCapabilityCount} 个 capabilities，${createdListingCount} 条供给。`,
      ),
    );
  } catch (error) {
    const message = toMessage(error, "批量导入失败，请检查 JSON 配置。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function addAgentCapabilityAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const agentId = String(formData.get("agentId") || "");
  const nextRedirectTarget = setRedirectTargetQueryParams(redirectTo, { agentId });
  if (!agentId) {
    redirect(buildStatusRedirect(nextRedirectTarget, "error", "Agent 参数无效。"));
  }

  try {
    await addAgentCapability(userContext, agentId, {
      code: String(formData.get("code") || "").trim(),
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim() || null,
      routingSummary: String(formData.get("routingSummary") || "").trim() || null,
      routingTags: parseOptionalStringList(formData.get("routingTags")),
      pricingNote: String(formData.get("pricingNote") || "").trim() || null,
      inputSchema: parseStructuredResourceSchema(formData, "input", "输入资源"),
      outputSchema: parseStructuredResourceSchema(formData, "output", "输出资源"),
      resourceNormalizationPrompt: String(formData.get("resourceNormalizationPrompt") || "").trim() || null,
      enabled: String(formData.get("enabled") || "true") !== "false",
    });
    redirect(buildStatusRedirect(nextRedirectTarget, "success", "任务能力已添加。"));
  } catch (error) {
    const message = toMessage(error, "任务能力添加失败，请稍后重试。");
    redirect(buildStatusRedirect(nextRedirectTarget, "error", message));
  }
}
