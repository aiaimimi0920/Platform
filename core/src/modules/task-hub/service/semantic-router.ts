// Semantic marketplace listing selection: keyword routing, managed-API JSON
// extraction, and optional central router HTTP matching. Moved verbatim from service.ts.

import type { AgentMarketplaceListingView } from "@neuro/contracts";

import { env } from "@/env";
import {
  tasks,
} from "@/modules/task-hub/schema";
import { requestInternalJson } from "@/platform/internal-json-request";
import { safeJsonStringify } from "@/platform/json";

import { normalizeCapabilityCodes } from "./shared";

const semanticRouterTimeoutMs = 20_000;

export type SemanticListingSelection = {
  selectedListingIds: Set<string>;
  matchedKeywordsByListingId: Map<string, string[]>;
  reasonByListingId: Map<string, string>;
};

function normalizeRouteKeyword(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}

function truncateTaskHubText(value: string | null | undefined, maximum = 4000) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maximum ? trimmed : `${trimmed.slice(0, Math.max(0, maximum - 1))}…`;
}

function extractManagedApiText(payload: Record<string, unknown> | null) {
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
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    if (typeof (item as { content?: unknown }).content === "string" && (item as { content: string }).content.trim()) {
      return (item as { content: string }).content.trim();
    }
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? ((item as { content: unknown[] }).content as unknown[])
      : [];
    const text = content
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        if (typeof (entry as { text?: unknown }).text === "string") {
          return (entry as { text: string }).text;
        }
        if (typeof (entry as { content?: unknown }).content === "string") {
          return (entry as { content: string }).content;
        }
        return "";
      })
      .join("")
      .trim();
    if (text) return text;
  }

  return typeof payload.rawText === "string" ? payload.rawText.trim() : null;
}

function tryParseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractJsonObjectFromText(value: string | null | undefined) {
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

function resolveSemanticRouterEndpoint(baseUrl: string | null | undefined) {
  const normalizedBaseUrl = baseUrl?.trim();
  if (!normalizedBaseUrl) {
    return null;
  }
  if (normalizedBaseUrl.endsWith("/chat/completions") || normalizedBaseUrl.endsWith("/responses")) {
    return normalizedBaseUrl;
  }
  return `${normalizedBaseUrl.replace(/\/+$/, "")}/responses`;
}

function splitRoutePhrases(value: string | null | undefined) {
  return (value ?? "")
    .split(/[\r\n,，\/|;；]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function normalizeRouteKeywords(values: string[] | null | undefined) {
  const seen = new Set<string>();
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length >= 2)
    .filter((value) => {
      const normalized = normalizeRouteKeyword(value);
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
}

function buildTaskRouteHaystack(task: Pick<typeof tasks.$inferSelect, "title" | "description" | "preferredCapabilityCodes">) {
  return normalizeRouteKeyword(
    [task.title, task.description, ...normalizeCapabilityCodes(task.preferredCapabilityCodes)].filter(Boolean).join(" "),
  );
}

function buildListingRouteKeywords(
  listing: Pick<
    AgentMarketplaceListingView,
    "capabilityCode" | "capabilityTitle" | "publicTitle" | "publicDescription" | "routingSummary" | "routingTags"
  >,
) {
  return normalizeRouteKeywords([
    listing.capabilityCode,
    listing.capabilityTitle,
    listing.publicTitle,
    ...(listing.routingTags ?? []),
    ...splitRoutePhrases(listing.routingSummary),
    ...splitRoutePhrases(listing.publicDescription),
  ]);
}

function getTaskListingRouteMatch(
  task: Pick<typeof tasks.$inferSelect, "title" | "description" | "preferredCapabilityCodes">,
  listing: Pick<
    AgentMarketplaceListingView,
    "capabilityCode" | "capabilityTitle" | "publicTitle" | "publicDescription" | "routingSummary" | "routingTags"
  >,
) {
  const preferredCapabilityCodes = normalizeCapabilityCodes(task.preferredCapabilityCodes);
  if (preferredCapabilityCodes.length > 0) {
    const preferredMatch = preferredCapabilityCodes.includes(listing.capabilityCode);
    return {
      accepted: preferredMatch,
      score: preferredMatch ? 100 : 0,
      matchedKeywords: preferredMatch ? [listing.capabilityCode] : [],
      reason: preferredMatch ? "preferred_capability" : "preferred_capability_miss",
    } as const;
  }

  const haystack = buildTaskRouteHaystack(task);
  const keywords = buildListingRouteKeywords(listing);
  if (!haystack || keywords.length === 0) {
    return {
      accepted: false,
      score: 0,
      matchedKeywords: [],
      reason: "route_missing",
    } as const;
  }

  const matchedKeywords = keywords.filter((keyword) => haystack.includes(normalizeRouteKeyword(keyword)));
  return {
    accepted: matchedKeywords.length > 0,
    score: matchedKeywords.length,
    matchedKeywords,
    reason: matchedKeywords.length > 0 ? "route_match" : "route_miss",
  } as const;
}

export async function selectListingsBySemanticRouter(
  task: Pick<
    typeof tasks.$inferSelect,
    | "id"
    | "title"
    | "description"
    | "preferredCapabilityCodes"
    | "pricingMode"
    | "billingUnit"
    | "meterKey"
    | "meterQuantity"
    | "rewardCurrency"
    | "rewardAmount"
  >,
  listings: AgentMarketplaceListingView[],
): Promise<SemanticListingSelection | null> {
  const endpoint = resolveSemanticRouterEndpoint(env.agentMarketplaceRouterApiBaseUrl);
  const apiKey = env.agentMarketplaceRouterApiKey;
  const model = env.agentMarketplaceRouterModel?.trim() || "gpt-4.1-mini";
  if (!endpoint || !apiKey || listings.length === 0) {
    return null;
  }

  const listingIndex = new Map(listings.map((listing) => [listing.id, listing]));
  const candidatePayload = listings.map((listing) => ({
    listingId: listing.id,
    capabilityCode: listing.capabilityCode,
    capabilityTitle: listing.capabilityTitle,
    publicTitle: listing.publicTitle,
    publicDescription: listing.publicDescription,
    routingSummary: listing.routingSummary,
    routingTags: listing.routingTags,
    inputSchema: listing.inputSchema,
    outputSchema: listing.outputSchema,
    billingMode: listing.billingMode,
    billingUnit: listing.billingUnit,
    meterKey: listing.meterKey,
    priceCurrency: listing.priceCurrency,
    priceAmount: listing.priceAmount,
  }));

  const requestBody = endpoint.endsWith("/responses")
    ? {
        model,
        input: [
          {
            role: "system",
            content:
              "你是 NeuroLoom 的中央调度 AI。你的任务是在多个羽量或 OpenAgent 供给中，判断哪些供给与当前任务最匹配。只返回 JSON 对象，不要输出解释。",
          },
          {
            role: "user",
            content: [
              "请从候选供给里筛出真正适合当前任务的 listing。",
              "判断重点：任务目标、风格、资源契约、输出形态、路由标签、报价与计量语义。",
              "如果没有合适供给，返回空数组。",
              '输出 JSON 结构必须是 {"selectedListingIds":["..."],"matches":[{"listingId":"...","reason":"...","matchedKeywords":["..."]}]}。',
              `任务(JSON):\n${safeJsonStringify({
                taskId: task.id,
                title: task.title,
                description: task.description,
                preferredCapabilityCodes: normalizeCapabilityCodes(task.preferredCapabilityCodes),
                pricingMode: task.pricingMode,
                billingUnit: task.billingUnit,
                meterKey: task.meterKey,
                meterQuantity: task.meterQuantity,
                rewardCurrency: task.rewardCurrency,
                rewardAmount: task.rewardAmount,
              })}`,
              `候选供给(JSON):\n${safeJsonStringify(candidatePayload)}`,
            ].join("\n\n"),
          },
        ],
      }
    : {
        model,
        messages: [
          {
            role: "system",
            content:
              "你是 NeuroLoom 的中央调度 AI。你的任务是在多个羽量或 OpenAgent 供给中，判断哪些供给与当前任务最匹配。只返回 JSON 对象，不要输出解释。",
          },
          {
            role: "user",
            content: [
              "请从候选供给里筛出真正适合当前任务的 listing。",
              "判断重点：任务目标、风格、资源契约、输出形态、路由标签、报价与计量语义。",
              "如果没有合适供给，返回空数组。",
              '输出 JSON 结构必须是 {"selectedListingIds":["..."],"matches":[{"listingId":"...","reason":"...","matchedKeywords":["..."]}]}。',
              `任务(JSON):\n${safeJsonStringify({
                taskId: task.id,
                title: task.title,
                description: task.description,
                preferredCapabilityCodes: normalizeCapabilityCodes(task.preferredCapabilityCodes),
                pricingMode: task.pricingMode,
                billingUnit: task.billingUnit,
                meterKey: task.meterKey,
                meterQuantity: task.meterQuantity,
                rewardCurrency: task.rewardCurrency,
                rewardAmount: task.rewardAmount,
              })}`,
              `候选供给(JSON):\n${safeJsonStringify(candidatePayload)}`,
            ].join("\n\n"),
          },
        ],
      };

  try {
    const { response, payload } = await requestInternalJson(
      endpoint,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      {
        timeoutMs: semanticRouterTimeoutMs,
        timeoutMessage: "Task semantic router request timed out",
      },
    );
    const text = extractManagedApiText(payload);
    const parsed =
      extractJsonObjectFromText(text) ??
      (payload && !Array.isArray(payload) ? payload : null);
    if (!response.ok || !parsed) {
      return null;
    }

    const selectedListingIds = new Set<string>();
    const matchedKeywordsByListingId = new Map<string, string[]>();
    const reasonByListingId = new Map<string, string>();
    const rawSelectedIds = Array.isArray(parsed.selectedListingIds) ? parsed.selectedListingIds : [];
    for (const value of rawSelectedIds) {
      if (typeof value !== "string" || !listingIndex.has(value)) {
        continue;
      }
      selectedListingIds.add(value);
    }
    const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
    for (const entry of matches) {
      if (!entry || typeof entry !== "object") continue;
      const listingId = typeof (entry as { listingId?: unknown }).listingId === "string"
        ? ((entry as { listingId: string }).listingId)
        : null;
      if (!listingId || !listingIndex.has(listingId)) {
        continue;
      }
      selectedListingIds.add(listingId);
      const matchedKeywords = Array.isArray((entry as { matchedKeywords?: unknown }).matchedKeywords)
        ? normalizeRouteKeywords(
            ((entry as { matchedKeywords: unknown[] }).matchedKeywords).filter(
              (value): value is string => typeof value === "string",
            ),
          )
        : [];
      if (matchedKeywords.length > 0) {
        matchedKeywordsByListingId.set(listingId, matchedKeywords);
      }
      const reason = truncateTaskHubText(
        typeof (entry as { reason?: unknown }).reason === "string"
          ? ((entry as { reason: string }).reason)
          : null,
        240,
      );
      if (reason) {
        reasonByListingId.set(listingId, reason);
      }
    }
    return {
      selectedListingIds,
      matchedKeywordsByListingId,
      reasonByListingId,
    };
  } catch {
    return null;
  }
}

export function taskAcceptsListingCapability(
  task: Pick<typeof tasks.$inferSelect, "title" | "description" | "preferredCapabilityCodes">,
  listing: Pick<
    AgentMarketplaceListingView,
    "capabilityCode" | "capabilityTitle" | "publicTitle" | "publicDescription" | "routingSummary" | "routingTags"
  >,
) {
  return getTaskListingRouteMatch(task, listing).accepted;
}
