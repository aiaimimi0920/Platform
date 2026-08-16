import type {
  AgentMarketplaceBillingMode,
  AgentMarketplaceInvocationSnapshotView,
  BenefitServiceApiAccessView,
  ProductCurrency,
} from "@neuro/contracts";

import { env } from "@/env";
import { ConflictError } from "@/platform/errors";
import { requestInternalJson } from "@/platform/internal-json-request";
import { safeJsonStringify } from "@/platform/json";

import {
  StoredMarketplaceInvocationSnapshot,
  accountInternalUrl,
  managedApiDispatchTimeoutMs,
} from "./shared";

export function normalizeMarketplaceMeterQuantity(raw: number | null | undefined) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

export function toStoredMarketplaceInvocationSnapshot(
  snapshot: AgentMarketplaceInvocationSnapshotView | StoredMarketplaceInvocationSnapshot | unknown,
): StoredMarketplaceInvocationSnapshot | null {
  if (!snapshot) return null;
  const normalized =
    toMarketplaceInvocationSnapshotView(snapshot) ??
    (snapshot as AgentMarketplaceInvocationSnapshotView | StoredMarketplaceInvocationSnapshot);
  return {
    listingId: normalized.listingId,
    supplierUserId: normalized.supplierUserId,
    capabilityId: normalized.capabilityId,
    capabilityCode: normalized.capabilityCode,
    capabilityTitle: normalized.capabilityTitle,
    publicTitle: normalized.publicTitle,
    billingMode: normalized.billingMode,
    billingUnit: normalized.billingUnit ?? null,
    meterKey: normalized.meterKey ?? null,
    meterQuantity: normalizeMarketplaceMeterQuantity(normalized.meterQuantity),
    priceCurrency: normalized.priceCurrency,
    unitPriceAmount: Math.max(1, Math.floor(normalized.unitPriceAmount)),
    quotedAmount: Math.max(1, Math.floor(normalized.quotedAmount)),
    invokedAt: normalized.invokedAt,
  };
}

export function toMarketplaceInvocationSnapshotView(
  value: unknown,
): AgentMarketplaceInvocationSnapshotView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StoredMarketplaceInvocationSnapshot>;
  if (
    !row.listingId ||
    !row.supplierUserId ||
    !row.capabilityId ||
    !row.capabilityCode ||
    !row.capabilityTitle ||
    !row.publicTitle ||
    !row.billingMode ||
    !row.priceCurrency ||
    !row.invokedAt
  ) {
    return null;
  }
  return {
    listingId: row.listingId,
    supplierUserId: row.supplierUserId,
    capabilityId: row.capabilityId,
    capabilityCode: row.capabilityCode,
    capabilityTitle: row.capabilityTitle,
    publicTitle: row.publicTitle,
    billingMode: row.billingMode,
    billingUnit: row.billingUnit ?? null,
    meterKey: row.meterKey ?? null,
    meterQuantity: normalizeMarketplaceMeterQuantity(row.meterQuantity ?? 1),
    priceCurrency: row.priceCurrency,
    unitPriceAmount: Math.max(1, Math.floor(Number(row.unitPriceAmount ?? 1))),
    quotedAmount: Math.max(1, Math.floor(Number(row.quotedAmount ?? 1))),
    invokedAt: row.invokedAt,
  };
}

export function buildRuntimeAuthHeaders(
  authMode: "none" | "apiKey" | "bearer",
  token: string | null | undefined,
): Record<string, string> {
  if (!token?.trim() || authMode === "none") {
    return {};
  }
  if (authMode === "bearer") {
    return {
      authorization: `Bearer ${token.trim()}`,
    };
  }
  return {
    "x-api-key": token.trim(),
  };
}

export function resolveManagedApiEndpoint(baseUrl: string | null | undefined) {
  const normalizedBaseUrl = baseUrl?.trim();
  if (!normalizedBaseUrl) {
    throw new ConflictError("Managed API base URL is missing");
  }
  if (normalizedBaseUrl.endsWith("/chat/completions") || normalizedBaseUrl.endsWith("/responses")) {
    return normalizedBaseUrl;
  }
  return `${normalizedBaseUrl.replace(/\/+$/, "")}/chat/completions`;
}

export function renderManagedPromptTemplate(
  template: string,
  args: {
    executionTitle: string;
    objective: string;
    publicTitle: string | null;
    capabilityCode: string | null;
    capabilityTitle: string | null;
    quotedAmount: number | null;
    priceCurrency: ProductCurrency | null;
    billingMode: AgentMarketplaceBillingMode | null;
    billingUnit: string | null;
    meterQuantity: number | null;
    managedTaskCategory?: string | null;
    managedCapabilitySummary?: string | null;
    routingSummary?: string | null;
    routingTags?: string[] | null;
    inputSchema?: Record<string, unknown> | null;
    outputSchema?: Record<string, unknown> | null;
    inputResourcePayload?: Record<string, unknown> | null;
    normalizedResourcePayload?: Record<string, unknown> | null;
  },
) {
  const replacements = new Map<string, string>([
    ["title", args.executionTitle],
    ["objective", args.objective],
    ["publicTitle", args.publicTitle ?? ""],
    ["capabilityCode", args.capabilityCode ?? ""],
    ["capabilityTitle", args.capabilityTitle ?? ""],
    ["quotedAmount", args.quotedAmount ? String(args.quotedAmount) : ""],
    ["priceCurrency", args.priceCurrency ?? ""],
    ["billingMode", args.billingMode ?? ""],
    ["billingUnit", args.billingUnit ?? ""],
    ["meterQuantity", args.meterQuantity ? String(args.meterQuantity) : ""],
    ["taskCategory", args.managedTaskCategory ?? ""],
    ["capabilitySummary", args.managedCapabilitySummary ?? ""],
    ["routingSummary", args.routingSummary ?? ""],
    ["routingTags", (args.routingTags ?? []).join(", ")],
    ["routing_tags", safeJsonStringify(args.routingTags ?? [])],
    ["input_schema_json", safeJsonStringify(args.inputSchema)],
    ["output_schema_json", safeJsonStringify(args.outputSchema)],
    ["resource_json", safeJsonStringify(args.inputResourcePayload)],
    ["input_resource_json", safeJsonStringify(args.inputResourcePayload)],
    ["normalized_resource_json", safeJsonStringify(args.normalizedResourcePayload)],
  ]);

  addPromptPayloadReplacements(replacements, "input", args.inputResourcePayload);
  addPromptPayloadReplacements(replacements, "normalized", args.normalizedResourcePayload);

  let rendered = template;
  for (const [key, value] of replacements.entries()) {
    rendered = rendered
      .replaceAll(`{${key}}`, value)
      .replaceAll(`{{${key}}}`, value);
  }
  rendered = applySchemaMarkerReplacements(
    rendered,
    args.inputSchema,
    args.normalizedResourcePayload ?? args.inputResourcePayload ?? null,
  );
  return rendered.trim();
}

export function addPromptPayloadReplacements(
  replacements: Map<string, string>,
  prefix: "input" | "normalized",
  payload: Record<string, unknown> | null | undefined,
  path: string = prefix,
) {
  if (!payload) {
    return;
  }
  for (const [key, rawValue] of Object.entries(payload)) {
    const nextPath = `${path}.${key}`;
    if (rawValue == null) {
      replacements.set(nextPath, "");
      continue;
    }
    if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      replacements.set(nextPath, String(rawValue));
      continue;
    }
    if (Array.isArray(rawValue)) {
      replacements.set(nextPath, safeJsonStringify(rawValue));
      continue;
    }
    if (typeof rawValue === "object") {
      replacements.set(nextPath, safeJsonStringify(rawValue));
      addPromptPayloadReplacements(replacements, prefix, rawValue as Record<string, unknown>, nextPath);
    }
  }
}

export function stringifyPromptTemplateValue(value: unknown) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return safeJsonStringify(value);
}

export function getSchemaDefaultResourceValue(schemaValue: Record<string, unknown>) {
  const defaultResource = schemaValue["x-openagent-default-resource"];
  if (!defaultResource || typeof defaultResource !== "object" || Array.isArray(defaultResource)) {
    return "";
  }
  const kind = typeof (defaultResource as Record<string, unknown>).kind === "string"
    ? String((defaultResource as Record<string, unknown>).kind)
    : "";
  if (kind === "text") {
    return stringifyPromptTemplateValue((defaultResource as Record<string, unknown>).value);
  }
  if (kind === "file") {
    const dataUrl = typeof (defaultResource as Record<string, unknown>).dataUrl === "string"
      ? String((defaultResource as Record<string, unknown>).dataUrl)
      : "";
    if (dataUrl) {
      return dataUrl;
    }
    const fileName = typeof (defaultResource as Record<string, unknown>).fileName === "string"
      ? String((defaultResource as Record<string, unknown>).fileName)
      : "";
    return fileName;
  }
  return "";
}

export function getSchemaProperties(schema: Record<string, unknown> | null | undefined) {
  const properties = schema?.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return null;
  }
  return properties as Record<string, unknown>;
}

export function applySchemaMarkerReplacements(
  template: string,
  schema: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown> | null | undefined,
) {
  if (!payload) {
    return template;
  }
  const properties = getSchemaProperties(schema);
  if (!properties) {
    return template;
  }
  let rendered = template;
  for (const [propertyKey, schemaValue] of Object.entries(properties)) {
    if (!schemaValue || typeof schemaValue !== "object" || Array.isArray(schemaValue)) {
      continue;
    }
    const marker = typeof (schemaValue as Record<string, unknown>)["x-openagent-marker"] === "string"
      ? String((schemaValue as Record<string, unknown>)["x-openagent-marker"]).trim()
      : "";
    if (!marker) {
      continue;
    }
    const nextValue =
      payload[propertyKey] == null
        ? getSchemaDefaultResourceValue(schemaValue as Record<string, unknown>)
        : stringifyPromptTemplateValue(payload[propertyKey]);
    rendered = rendered
      .replaceAll(`#$${marker}$#`, nextValue)
      .replaceAll(marker, nextValue);
  }
  return rendered;
}

export function toRecordPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function extractJsonObjectFromText(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const direct = tryParseJsonObject(trimmed);
  if (direct) {
    return direct;
  }

  const firstBraceIndex = trimmed.indexOf("{");
  const lastBraceIndex = trimmed.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return tryParseJsonObject(trimmed.slice(firstBraceIndex, lastBraceIndex + 1));
  }
  return null;
}

export function tryParseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return toRecordPayload(parsed);
  } catch {
    return null;
  }
}

export async function resolveManagedLightServiceAccess(args: {
  ownerUserId: string;
  serviceId: string;
}): Promise<BenefitServiceApiAccessView> {
  if (!accountInternalUrl) {
    throw new ConflictError("ACCOUNT_INTERNAL_URL is not configured for managed light service access");
  }
  const { response, payload } = await requestInternalJson(
    `${accountInternalUrl}/v1/benefits/services/${encodeURIComponent(args.serviceId)}/api-access`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-api-token": env.internalApiToken,
        "x-neuro-user-id": args.ownerUserId,
      },
      body: JSON.stringify({}),
    },
    {
      timeoutMs: managedApiDispatchTimeoutMs,
      timeoutMessage: "Managed light service access request timed out",
    },
  );
  const accessPayload = payload as
    | { access?: BenefitServiceApiAccessView; error?: { message?: string } | string }
    | null;
  if (!response.ok || !accessPayload?.access) {
    const message =
      (typeof accessPayload?.error === "string" ? accessPayload.error : accessPayload?.error?.message) ||
      "Failed to resolve managed light AI service access";
    throw new ConflictError(message);
  }
  return accessPayload.access;
}

export function extractManagedApiText(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
    if (Array.isArray(content)) {
      const text = content
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const textValue = (item as { text?: unknown }).text;
          return typeof textValue === "string" ? textValue : "";
        })
        .join("")
        .trim();
      if (text) return text;
    }
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const combined = output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) return [];
      return content
        .map((contentItem) => {
          if (!contentItem || typeof contentItem !== "object") return "";
          const textValue = (contentItem as { text?: unknown }).text;
          return typeof textValue === "string" ? textValue : "";
        })
        .filter(Boolean);
    })
    .join("")
    .trim();
  return combined || null;
}

export function extractManagedApiUsageTotals(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const usage = payload.usage;
  if (!usage || typeof usage !== "object") return null;
  const promptTokens = Number((usage as { prompt_tokens?: unknown }).prompt_tokens ?? 0);
  const completionTokens = Number((usage as { completion_tokens?: unknown }).completion_tokens ?? 0);
  const totalTokens = Number(
    (usage as { total_tokens?: unknown }).total_tokens ??
      (Number.isFinite(promptTokens) ? promptTokens : 0) + (Number.isFinite(completionTokens) ? completionTokens : 0),
  );
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
    return null;
  }
  return {
    promptTokens: Number.isFinite(promptTokens) ? Math.max(0, Math.floor(promptTokens)) : 0,
    completionTokens: Number.isFinite(completionTokens) ? Math.max(0, Math.floor(completionTokens)) : 0,
    totalTokens: Math.max(1, Math.floor(totalTokens)),
  };
}

export function mergeManagedApiUsageTotals(
  ...usages: Array<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>
) {
  const aggregated = usages.reduce<{ promptTokens: number; completionTokens: number; totalTokens: number }>(
    (sum, usage) => {
      if (!usage) {
        return sum;
      }
      return {
        promptTokens: sum.promptTokens + Math.max(0, usage.promptTokens),
        completionTokens: sum.completionTokens + Math.max(0, usage.completionTokens),
        totalTokens: sum.totalTokens + Math.max(0, usage.totalTokens),
      };
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );
  if (aggregated.totalTokens <= 0) {
    return null;
  }
  return aggregated;
}

export async function invokeManagedLightModel(args: {
  endpoint: string;
  apiKey: string | null | undefined;
  model: string;
  systemPrompt?: string | null;
  userPrompt: string;
}) {
  const requestBody = args.endpoint.endsWith("/responses")
    ? {
        model: args.model,
        input: [
          ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
          { role: "user", content: args.userPrompt },
        ],
      }
    : {
        model: args.model,
        messages: [
          ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
          { role: "user", content: args.userPrompt },
        ],
      };

  const { response, payload } = await requestInternalJson(
    args.endpoint,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...buildRuntimeAuthHeaders("bearer", args.apiKey),
      },
      body: JSON.stringify(requestBody),
    },
    {
      timeoutMs: managedApiDispatchTimeoutMs,
      timeoutMessage: "Managed light model request timed out",
    },
  );
  const text = extractManagedApiText(payload);
  const usageTotals = extractManagedApiUsageTotals(payload);

  return {
    response,
    payload,
    text,
    usageTotals,
  };
}

export function resolveTokenMeterQuantity(totalTokens: number, billingUnit: string | null | undefined) {
  const normalizedUnit = billingUnit?.trim().toLowerCase() ?? "";
  if (!normalizedUnit || normalizedUnit === "token" || normalizedUnit === "tokens") {
    return Math.max(1, totalTokens);
  }

  const matchedUnit = normalizedUnit.match(/^(\d+)\s*_?tokens?$/);
  if (matchedUnit) {
    const divisor = Math.max(1, Number(matchedUnit[1]));
    return Math.max(1, Math.ceil(totalTokens / divisor));
  }

  const matchedKUnit = normalizedUnit.match(/^(\d+)k\s*_?tokens?$/);
  if (matchedKUnit) {
    const divisor = Math.max(1, Number(matchedKUnit[1]) * 1000);
    return Math.max(1, Math.ceil(totalTokens / divisor));
  }

  if (normalizedUnit === "1k_tokens" || normalizedUnit === "k_tokens") {
    return Math.max(1, Math.ceil(totalTokens / 1000));
  }

  return Math.max(1, totalTokens);
}
