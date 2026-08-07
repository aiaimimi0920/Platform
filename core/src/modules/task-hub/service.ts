import type {
  AgentMarketplaceListingView,
  CreateTaskDraftInput,
  CreateTaskDraftResult,
  CreateTaskAgentProposalInput,
  CreateTaskInput,
  DispatchDecisionView,
  ProductCurrency,
  TaskAgentProposalView,
  TaskApplicationView,
  TaskLifecycleAction,
  TaskView,
} from "@neuro/contracts";
import { mapWithConcurrency } from "@neuro/backend-foundation/async/map-with-concurrency";
import { and, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  freezeBalance,
  transferBalance,
  unfreezeBalance,
} from "../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";
import {
  getDispatchReputationProfilesInTx,
  refreshReputationUsersInTx,
} from "../../../../packages/account-domain/dist/modules/reputation/service.js";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { createOwnedAgentExecutionInTx } from "@/modules/agent-execution/service";
import {
  agentMarketplaceListings,
  agents,
} from "@/modules/agent-registry/schema";
import {
  getEnabledAgentIdSetInTx,
  getEnabledCapabilityCodeMap,
  getEnabledCapabilityCodeMapInTx,
  listOwnedAgentMarketplaceListings,
  listPublicAgentMarketplaceListings,
  recordOwnedAgentMarketplaceSweepResult,
} from "@/modules/agent-registry/service";
import { users } from "@/modules/identity/schema";
import { buildTaskLifecycleReputationUpdatedPayload } from "@/modules/reputation/events";
import {
  getDispatchDecision as getDispatchDecisionFromRepo,
  getOwnedAgentById,
  getTaskAgentProposalById,
  getTaskById,
  getTaskByOwnerAndId,
  listTaskAgentProposalsByTask,
  listTaskApplicationsByTask,
  listTasksWithCountsByUser,
  listTasksWithCounts,
} from "@/modules/task-hub/repository";
import {
  bondHolds,
  taskAgentProposals,
  taskApplications,
  taskDispatchDecisions,
  taskRewardHolds,
  tasks,
} from "@/modules/task-hub/schema";
import {
  buildTaskDraftRecord,
  normalizeTaskDraftInput,
  taskDraftPayloadMatches,
} from "@/modules/task-hub/draft";
import { ledgerEntries } from "@/modules/wallet-ledger/schema";
import { BadRequestError, ConflictError, NotFoundError } from "@/platform/errors";
import { getSingleFeatureModule } from "@/platform/feature-modules/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

const TASK_REWARD_ESCROW_USER_ID = "platform:task_reward_escrow";
const DEFAULT_TOKEN_BILLING_UNIT = "1k_tokens";
const DEFAULT_TOKEN_METER_KEY = "llm_tokens";
const DEFAULT_PROPERTY_BILLING_UNIT = "task_property";
const DEFAULT_PROPERTY_METER_KEY = "task_units";
const semanticRouterTimeoutMs = 20_000;

type SemanticListingSelection = {
  selectedListingIds: Set<string>;
  matchedKeywordsByListingId: Map<string, string[]>;
  reasonByListingId: Map<string, string>;
};

function now() {
  return new Date();
}

function normalizeCapabilityCodes(input: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  return (input ?? [])
    .map((code) => code.trim())
    .filter((code) => code.length > 0)
    .filter((code) => {
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    });
}

function normalizeRouteKeyword(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}

function truncateTaskHubText(value: string | null | undefined, maximum = 4000) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maximum ? trimmed : `${trimmed.slice(0, Math.max(0, maximum - 1))}…`;
}

function safeJsonStringify(value: unknown) {
  if (value == null) {
    return "{}";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function parseJsonSafely(response: Response) {
  const rawText = await response.text();
  if (!rawText.trim()) {
    return null;
  }
  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return {
      rawText,
    };
  }
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

async function selectListingsBySemanticRouter(
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
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      semanticRouterTimeoutMs,
    );
    const payload = await parseJsonSafely(response);
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

function renderAutoTakeStatement(
  template: string | null,
  args: {
    taskTitle: string;
    capabilityCode: string;
    capabilityTitle: string;
    taskLabel: string;
    priceAmount: number;
    priceCurrency: ProductCurrency;
  },
) {
  const fallback = `自动提案：${args.capabilityTitle} ${args.taskLabel}已匹配当前任务，将按 ${args.priceAmount} ${args.priceCurrency} 提供交付。`;
  if (!template) {
    return fallback;
  }

  return template
    .replaceAll("{taskTitle}", args.taskTitle)
    .replaceAll("{capabilityCode}", args.capabilityCode)
    .replaceAll("{capabilityTitle}", args.capabilityTitle)
    .replaceAll("{priceAmount}", String(args.priceAmount))
    .replaceAll("{priceCurrency}", args.priceCurrency)
    .trim() || fallback;
}

function normalizeTaskPricingMode(
  input: CreateTaskInput["pricingMode"] | null | undefined,
): "flat_task" | "token_metered" | "property_metered" {
  if (input === "token_metered") return "token_metered";
  if (input === "property_metered") return "property_metered";
  return "flat_task";
}

function normalizeTaskOperationMode(
  input: CreateTaskInput["operationMode"] | null | undefined,
): "manual" | "automatic" {
  return input === "automatic" ? "automatic" : "manual";
}

function normalizeTaskBillingUnit(
  pricingMode: "flat_task" | "token_metered" | "property_metered",
  input: CreateTaskInput["billingUnit"] | null | undefined,
) {
  const trimmed = input?.trim() || null;
  if (pricingMode === "token_metered") {
    return trimmed ?? DEFAULT_TOKEN_BILLING_UNIT;
  }
  if (pricingMode === "property_metered") {
    return trimmed ?? DEFAULT_PROPERTY_BILLING_UNIT;
  }
  return trimmed;
}

function normalizeTaskMeterKey(
  pricingMode: "flat_task" | "token_metered" | "property_metered",
  input: CreateTaskInput["meterKey"] | null | undefined,
) {
  const trimmed = input?.trim() || null;
  if (pricingMode === "token_metered") {
    return trimmed ?? DEFAULT_TOKEN_METER_KEY;
  }
  if (pricingMode === "property_metered") {
    return trimmed ?? DEFAULT_PROPERTY_METER_KEY;
  }
  return trimmed;
}

function normalizeTaskMeterQuantity(
  pricingMode: "flat_task" | "token_metered" | "property_metered",
  input: CreateTaskInput["meterQuantity"] | null | undefined,
) {
  if (pricingMode === "flat_task") {
    return null;
  }
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return 1;
  }
  return Math.max(1, Math.floor(input));
}

function toTaskView(task: typeof tasks.$inferSelect, applicationCount: number, arbitrationCaseCount = 0): TaskView {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    preferredCapabilityCodes: normalizeCapabilityCodes(task.preferredCapabilityCodes),
    pricingMode: task.pricingMode as TaskView["pricingMode"],
    billingUnit: task.billingUnit,
    meterKey: task.meterKey,
    meterQuantity: task.meterQuantity,
    operationMode: task.operationMode as TaskView["operationMode"],
    rewardCurrency: task.rewardCurrency as ProductCurrency,
    rewardAmount: task.rewardAmount,
    requiredBondAmount: task.requiredBondAmount,
    status: task.status as TaskView["status"],
    creatorUserId: task.creatorUserId,
    assignedUserId: task.assignedUserId,
    arbitrationCaseCount,
    applicationCount,
    createdAt: task.createdAt.toISOString(),
  };
}

function toTaskApplicationView(application: typeof taskApplications.$inferSelect): TaskApplicationView {
  return {
    id: application.id,
    taskId: application.taskId,
    applicantUserId: application.applicantUserId,
    statement: application.statement,
    proposedEtaHours: application.proposedEtaHours,
    status: application.status as TaskApplicationView["status"],
    createdAt: application.createdAt.toISOString(),
  };
}

function toTaskAgentProposalView(
  proposal: typeof taskAgentProposals.$inferSelect,
  task: typeof tasks.$inferSelect,
  viewerUserId: string,
  matchedCapabilityCodes: string[] = [],
): TaskAgentProposalView {
  return {
    id: proposal.id,
    taskId: proposal.taskId,
    proposerUserId: proposal.proposerUserId,
    agentId: proposal.agentId,
    statement: proposal.statement,
    proposedEtaHours: proposal.proposedEtaHours,
    proposedCostNote: proposal.proposedCostNote,
    status: proposal.status as TaskAgentProposalView["status"],
    executionId: proposal.executionId,
    matchedCapabilityCodes,
    matchedCapabilityCount: matchedCapabilityCodes.length,
    canAccept:
      proposal.status === "pending" &&
      task.creatorUserId === viewerUserId &&
      ["open", "applying"].includes(task.status),
    canReject:
      proposal.status === "pending" &&
      task.creatorUserId === viewerUserId &&
      ["open", "applying"].includes(task.status),
    createdAt: proposal.createdAt.toISOString(),
  };
}

function getTaskMeterQuantity(task: typeof tasks.$inferSelect) {
  if (task.pricingMode === "token_metered" || task.pricingMode === "property_metered") {
    return Math.max(1, Number(task.meterQuantity ?? 1));
  }
  return null;
}

function taskAcceptsListingCapability(
  task: Pick<typeof tasks.$inferSelect, "title" | "description" | "preferredCapabilityCodes">,
  listing: Pick<
    AgentMarketplaceListingView,
    "capabilityCode" | "capabilityTitle" | "publicTitle" | "publicDescription" | "routingSummary" | "routingTags"
  >,
) {
  return getTaskListingRouteMatch(task, listing).accepted;
}

function canListingAutoProposeForTask(
  task: typeof tasks.$inferSelect,
  listing: {
    billingMode: string;
    billingUnit: string | null;
    meterKey: string | null;
    priceCurrency: string;
    priceAmount: number;
  },
) {
  if (task.rewardCurrency !== listing.priceCurrency) {
    return { match: false, quotedAmount: null as number | null };
  }

  if (task.pricingMode === "flat_task") {
    if (listing.billingMode !== "flat_task") {
      return { match: false, quotedAmount: null as number | null };
    }
    return {
      match: task.rewardAmount >= listing.priceAmount,
      quotedAmount: listing.priceAmount,
    };
  }

  if (task.pricingMode === "token_metered") {
    if (listing.billingMode !== "token_metered") {
      return { match: false, quotedAmount: null as number | null };
    }
    const normalizedTaskUnit = task.billingUnit?.trim().toLowerCase() || DEFAULT_TOKEN_BILLING_UNIT;
    const normalizedListingUnit = listing.billingUnit?.trim().toLowerCase() || DEFAULT_TOKEN_BILLING_UNIT;
    if (normalizedTaskUnit !== normalizedListingUnit) {
      return { match: false, quotedAmount: null as number | null };
    }
    const meterQuantity = getTaskMeterQuantity(task) ?? 1;
    const quotedAmount = Math.max(1, meterQuantity * listing.priceAmount);
    return {
      match: task.rewardAmount >= quotedAmount,
      quotedAmount,
    };
  }

  if (task.pricingMode === "property_metered") {
    if (listing.billingMode !== "property_metered") {
      return { match: false, quotedAmount: null as number | null };
    }
    const normalizedTaskMeterKey = task.meterKey?.trim().toLowerCase() || DEFAULT_PROPERTY_METER_KEY;
    const normalizedListingMeterKey = listing.meterKey?.trim().toLowerCase() || DEFAULT_PROPERTY_METER_KEY;
    if (normalizedTaskMeterKey !== normalizedListingMeterKey) {
      return { match: false, quotedAmount: null as number | null };
    }
    const normalizedTaskUnit = task.billingUnit?.trim().toLowerCase() || DEFAULT_PROPERTY_BILLING_UNIT;
    const normalizedListingUnit = listing.billingUnit?.trim().toLowerCase() || DEFAULT_PROPERTY_BILLING_UNIT;
    if (normalizedTaskUnit !== normalizedListingUnit) {
      return { match: false, quotedAmount: null as number | null };
    }
    const meterQuantity = getTaskMeterQuantity(task) ?? 1;
    const quotedAmount = Math.max(1, meterQuantity * listing.priceAmount);
    return {
      match: task.rewardAmount >= quotedAmount,
      quotedAmount,
    };
  }

  return { match: false, quotedAmount: null as number | null };
}

async function getProposalMatchedCapabilityMap(
  task: typeof tasks.$inferSelect,
  proposals: typeof taskAgentProposals.$inferSelect[],
) {
  const preferredCodes = normalizeCapabilityCodes(task.preferredCapabilityCodes);
  if (proposals.length === 0 || preferredCodes.length === 0) {
    return new Map<string, string[]>();
  }

  const capabilityMap = await getEnabledCapabilityCodeMap(proposals.map((proposal) => proposal.agentId));
  return new Map(
    proposals.map((proposal) => [
      proposal.id,
      preferredCodes.filter((code) => (capabilityMap.get(proposal.agentId) ?? []).includes(code)),
    ]),
  );
}

async function getApplicantStatsInTx(tx: NodePgDatabase<typeof schema>, userId: string) {
  const [completed] = await tx
    .select({ count: count(tasks.id) })
    .from(tasks)
    .where(and(eq(tasks.assignedUserId, userId), eq(tasks.status, "accepted")));
  const [defaulted] = await tx
    .select({ count: count(tasks.id) })
    .from(tasks)
    .where(and(eq(tasks.assignedUserId, userId), eq(tasks.status, "defaulted")));

  const completedCount = completed?.count ? Number(completed.count) : 0;
  const defaultCount = defaulted?.count ? Number(defaulted.count) : 0;
  const totalHandled = completedCount + defaultCount;
  const completionRate = totalHandled === 0 ? 0 : completedCount / totalHandled;

  return {
    completedCount,
    defaultCount,
    completionRate,
  };
}

type DispatchScoredApplication = {
  application: typeof taskApplications.$inferSelect;
  matchedCapabilityCodes: string[];
  matchedCapabilityCount: number;
  trustLevel: number;
  completionRate: number;
  defaultCount: number;
  defaultRate: number;
  reputationScore: number;
};

type DispatchScoredProposal = {
  proposal: typeof taskAgentProposals.$inferSelect;
  matchedCapabilityCodes: string[];
  matchedCapabilityCount: number;
  trustLevel: number;
  completionRate: number;
  defaultCount: number;
  defaultRate: number;
  reputationScore: number;
};

type DispatchCandidate =
  | ({ kind: "application" } & DispatchScoredApplication)
  | ({ kind: "proposal" } & DispatchScoredProposal);

const DISPATCH_SCORING_CONCURRENCY = 12;

async function buildLegacyScoredApplications(
  tx: NodePgDatabase<typeof schema>,
  pendingApplications: typeof taskApplications.$inferSelect[],
  applicantIds: string[],
): Promise<DispatchScoredApplication[]> {
  const applicantRows = await tx.select().from(users).where(inArray(users.id, applicantIds));
  const userMap = new Map(applicantRows.map((user) => [user.id, user]));

  return mapWithConcurrency(
    pendingApplications,
    DISPATCH_SCORING_CONCURRENCY,
    async (application) => {
      const user = userMap.get(application.applicantUserId);
      const stats = await getApplicantStatsInTx(tx, application.applicantUserId);
      const totalHandled = stats.completedCount + stats.defaultCount;
      const defaultRate = totalHandled <= 0 ? 0 : stats.defaultCount / totalHandled;
      return {
        application,
        matchedCapabilityCodes: [],
        matchedCapabilityCount: 0,
        trustLevel: user?.trustLevel ?? 0,
        completionRate: stats.completionRate,
        defaultCount: stats.defaultCount,
        defaultRate,
        reputationScore: 0,
      };
    },
  );
}

async function buildReputationScoredApplications(
  tx: NodePgDatabase<typeof schema>,
  pendingApplications: typeof taskApplications.$inferSelect[],
  applicantIds: string[],
): Promise<DispatchScoredApplication[]> {
  const profiles = await getDispatchReputationProfilesInTx(tx, applicantIds);
  const legacyFallback = await buildLegacyScoredApplications(tx, pendingApplications, applicantIds);
  const legacyByUserId = new Map(legacyFallback.map((row) => [row.application.applicantUserId, row]));

  return pendingApplications.map((application) => {
    const profile = profiles.get(application.applicantUserId);
    const fallback = legacyByUserId.get(application.applicantUserId);
    return {
      application,
      matchedCapabilityCodes: [],
      matchedCapabilityCount: 0,
      trustLevel: profile?.trustLevel ?? fallback?.trustLevel ?? 0,
      completionRate: profile?.completionRate ?? fallback?.completionRate ?? 0,
      defaultCount: fallback?.defaultCount ?? 0,
      defaultRate: profile?.defaultRate ?? fallback?.defaultRate ?? 1,
      reputationScore: profile?.reputationScore ?? 0,
    };
  });
}

async function buildLegacyScoredProposals(
  tx: NodePgDatabase<typeof schema>,
  task: typeof tasks.$inferSelect,
  pendingProposals: typeof taskAgentProposals.$inferSelect[],
  proposerIds: string[],
): Promise<DispatchScoredProposal[]> {
  const proposerRows = await tx.select().from(users).where(inArray(users.id, proposerIds));
  const userMap = new Map(proposerRows.map((user) => [user.id, user]));
  const capabilityMap = await getEnabledCapabilityCodeMapInTx(tx, pendingProposals.map((proposal) => proposal.agentId));
  const preferredCodes = normalizeCapabilityCodes(task.preferredCapabilityCodes);

  return mapWithConcurrency(
    pendingProposals,
    DISPATCH_SCORING_CONCURRENCY,
    async (proposal) => {
      const user = userMap.get(proposal.proposerUserId);
      const stats = await getApplicantStatsInTx(tx, proposal.proposerUserId);
      const totalHandled = stats.completedCount + stats.defaultCount;
      const defaultRate = totalHandled <= 0 ? 0 : stats.defaultCount / totalHandled;
      const matchedCapabilityCodes = preferredCodes.filter((code) =>
        (capabilityMap.get(proposal.agentId) ?? []).includes(code),
      );
      return {
        proposal,
        matchedCapabilityCodes,
        matchedCapabilityCount: matchedCapabilityCodes.length,
        trustLevel: user?.trustLevel ?? 0,
        completionRate: stats.completionRate,
        defaultCount: stats.defaultCount,
        defaultRate,
        reputationScore: 0,
      };
    },
  );
}

async function buildReputationScoredProposals(
  tx: NodePgDatabase<typeof schema>,
  task: typeof tasks.$inferSelect,
  pendingProposals: typeof taskAgentProposals.$inferSelect[],
  proposerIds: string[],
): Promise<DispatchScoredProposal[]> {
  const profiles = await getDispatchReputationProfilesInTx(tx, proposerIds);
  const legacyFallback = await buildLegacyScoredProposals(tx, task, pendingProposals, proposerIds);
  const legacyByUserId = new Map(legacyFallback.map((row) => [row.proposal.proposerUserId, row]));

  return pendingProposals.map((proposal) => {
    const profile = profiles.get(proposal.proposerUserId);
    const fallback = legacyByUserId.get(proposal.proposerUserId);
    return {
      proposal,
      matchedCapabilityCodes: fallback?.matchedCapabilityCodes ?? [],
      matchedCapabilityCount: fallback?.matchedCapabilityCount ?? 0,
      trustLevel: profile?.trustLevel ?? fallback?.trustLevel ?? 0,
      completionRate: profile?.completionRate ?? fallback?.completionRate ?? 0,
      defaultCount: fallback?.defaultCount ?? 0,
      defaultRate: profile?.defaultRate ?? fallback?.defaultRate ?? 1,
      reputationScore: profile?.reputationScore ?? 0,
    };
  });
}

async function getTaskWithCountInTx(tx: NodePgDatabase<typeof schema>, taskId: string) {
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return null;
  const [applicationCountRows, arbitrationCountRows] = await Promise.all([
    tx
      .select({ count: count(taskApplications.id) })
      .from(taskApplications)
      .where(eq(taskApplications.taskId, taskId)),
    tx
      .select({ count: count(schema.arbitrationCases.id) })
      .from(schema.arbitrationCases)
      .where(and(eq(schema.arbitrationCases.entityType, "task"), eq(schema.arbitrationCases.entityId, taskId))),
  ]);
  const applicationCountRow = applicationCountRows[0];
  const arbitrationCountRow = arbitrationCountRows[0];
  return {
    task,
    applicationCount: Number(applicationCountRow?.count ?? 0),
    arbitrationCaseCount: Number(arbitrationCountRow?.count ?? 0),
  };
}

async function findEscrowTransferInTx(tx: NodePgDatabase<typeof schema>, task: typeof tasks.$inferSelect) {
  const [entry] = await tx
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.userId, TASK_REWARD_ESCROW_USER_ID),
        eq(ledgerEntries.referenceType, "taskRewardEscrow"),
        eq(ledgerEntries.referenceId, task.id),
        eq(ledgerEntries.entryType, "grant"),
        eq(ledgerEntries.currency, task.rewardCurrency),
        eq(ledgerEntries.amount, task.rewardAmount),
      ),
    );

  return entry ?? null;
}

async function ensureTaskRewardEscrowHoldInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  task: typeof tasks.$inferSelect;
  assignedUserId: string | null;
  allowChargeIfMissing: boolean;
  timestamp?: Date;
}) {
  const [existingHold] = await args.tx
    .select()
    .from(taskRewardHolds)
    .where(eq(taskRewardHolds.taskId, args.task.id));

  if (existingHold) {
    if (args.assignedUserId && existingHold.assigneeUserId !== args.assignedUserId) {
      const [updatedHold] = await args.tx
        .update(taskRewardHolds)
        .set({ assigneeUserId: args.assignedUserId })
        .where(eq(taskRewardHolds.id, existingHold.id))
        .returning();
      return updatedHold;
    }

    return existingHold;
  }

  let escrowTransfer = await findEscrowTransferInTx(args.tx, args.task);
  if (!escrowTransfer && args.allowChargeIfMissing && args.task.rewardAmount > 0) {
    await transferBalance({
      fromUserId: args.task.creatorUserId,
      toUserId: TASK_REWARD_ESCROW_USER_ID,
      currency: args.task.rewardCurrency as ProductCurrency,
      amount: args.task.rewardAmount,
      note: `任务奖励托管补建：${args.task.title}`,
      referenceType: "taskRewardEscrow",
      referenceId: args.task.id,
      tx: args.tx,
    });
    escrowTransfer = await findEscrowTransferInTx(args.tx, args.task);
  }

  if (!escrowTransfer) {
    return null;
  }

  const [createdHold] = await args.tx
    .insert(taskRewardHolds)
    .values({
      id: crypto.randomUUID(),
      taskId: args.task.id,
      creatorUserId: args.task.creatorUserId,
      assigneeUserId: args.assignedUserId,
      rewardCurrency: args.task.rewardCurrency,
      rewardAmount: args.task.rewardAmount,
      status: "escrowed",
      createdAt: args.timestamp ?? now(),
      settledAt: null,
    })
    .returning();

  return createdHold;
}

async function releaseRejectedBonds(
  tx: NodePgDatabase<typeof schema>,
  taskTitle: string,
  rejectedApplicationIds: string[],
  releasedAt: Date,
) {
  if (rejectedApplicationIds.length === 0) return;

  await tx
    .update(taskApplications)
    .set({ status: "rejected" })
    .where(inArray(taskApplications.id, rejectedApplicationIds));

  const rejectedBondRows = await tx
    .select()
    .from(bondHolds)
    .where(inArray(bondHolds.applicationId, rejectedApplicationIds));

  for (const hold of rejectedBondRows) {
    if (hold.status === "active" && hold.amount > 0) {
      await unfreezeBalance(
        hold.userId,
        hold.currency as "obsidian",
        hold.amount,
        `任务未中标退回保证金：${taskTitle}`,
        "bondHold",
        hold.id,
        tx,
      );
      await tx
        .update(bondHolds)
        .set({ status: "released", releasedAt })
        .where(eq(bondHolds.id, hold.id));
    }
  }
}

async function rejectPendingTaskAgentProposalsInTx(
  tx: NodePgDatabase<typeof schema>,
  taskId: string,
  exceptProposalId?: string,
) {
  await tx
    .update(taskAgentProposals)
    .set({ status: "rejected" })
    .where(
      exceptProposalId
        ? and(eq(taskAgentProposals.taskId, taskId), ne(taskAgentProposals.id, exceptProposalId), eq(taskAgentProposals.status, "pending"))
        : and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.status, "pending")),
    );
}

async function assignTaskToAgentProposalInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  task: typeof tasks.$inferSelect;
  proposal: typeof taskAgentProposals.$inferSelect;
  decidedAt: Date;
}) {
  const ownedAgent = await getOwnedAgentById(args.proposal.proposerUserId, args.proposal.agentId);
  if (!ownedAgent || !ownedAgent.enabled) {
    throw new ConflictError("Agent proposal cannot be assigned because the agent is unavailable");
  }

  const execution = await createOwnedAgentExecutionInTx(args.tx, args.proposal.proposerUserId, {
    agentId: args.proposal.agentId,
    taskId: args.task.id,
    title: `任务执行：${args.task.title}`,
    objective: args.task.description,
  });

  const [updatedProposal] = await args.tx
    .update(taskAgentProposals)
    .set({
      status: "accepted",
      executionId: execution.id,
    })
    .where(eq(taskAgentProposals.id, args.proposal.id))
    .returning();

  await rejectPendingTaskAgentProposalsInTx(args.tx, args.task.id, args.proposal.id);

  await args.tx
    .update(tasks)
    .set({
      assignedUserId: args.proposal.proposerUserId,
      status: "assigned",
    })
    .where(eq(tasks.id, args.task.id));

  const [decision] = await args.tx
    .insert(taskDispatchDecisions)
    .values({
      id: crypto.randomUUID(),
      taskId: args.task.id,
      assignedApplicationId: null,
      assignedProposalId: args.proposal.id,
      assignedUserId: args.proposal.proposerUserId,
      decidedAt: args.decidedAt,
    })
    .returning();

  await ensureTaskRewardEscrowHoldInTx({
    tx: args.tx,
    task: args.task,
    assignedUserId: args.proposal.proposerUserId,
    allowChargeIfMissing: true,
    timestamp: args.decidedAt,
  });

  await enqueueOutboxEvent(
    "task.assigned",
    {
      taskId: args.task.id,
      assignedUserId: args.proposal.proposerUserId,
      assignedApplicationId: null,
      proposalId: args.proposal.id,
      executionId: execution.id,
      assignmentMode: "agentProposal",
    },
    args.tx,
  );

  return {
    decision,
    updatedProposal,
    execution,
  };
}

async function releaseAllActiveTaskBonds(args: {
  tx: NodePgDatabase<typeof schema>;
  taskId: string;
  taskTitle: string;
  releasedAt: Date;
  releaseReason: string;
}) {
  const activeHolds = await args.tx
    .select()
    .from(bondHolds)
    .where(and(eq(bondHolds.taskId, args.taskId), eq(bondHolds.status, "active")));

  for (const hold of activeHolds) {
    if (hold.amount > 0) {
      await unfreezeBalance(
        hold.userId,
        hold.currency as "obsidian",
        hold.amount,
        args.releaseReason,
        "bondHold",
        hold.id,
        args.tx,
      );
    }

    await args.tx
      .update(bondHolds)
      .set({ status: "released", releasedAt: args.releasedAt })
      .where(eq(bondHolds.id, hold.id));
  }
}

async function dispatchTaskInTx(
  tx: NodePgDatabase<typeof schema>,
  taskId: string,
  preferReputationRanking: boolean,
  allowAgentProposals: boolean,
): Promise<DispatchDecisionView | null> {
  await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return null;

  const [existingDecision] = await tx
    .select()
    .from(taskDispatchDecisions)
    .where(eq(taskDispatchDecisions.taskId, taskId));
  if (existingDecision) {
    await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: existingDecision.assignedUserId,
      allowChargeIfMissing: true,
      timestamp: existingDecision.decidedAt,
    });
    return {
      taskId: existingDecision.taskId,
      assignedApplicationId: existingDecision.assignedApplicationId,
      assignedProposalId: existingDecision.assignedProposalId,
      assignedUserId: existingDecision.assignedUserId,
      assignmentMode: existingDecision.assignedProposalId ? "agentProposal" : "application",
      decidedAt: existingDecision.decidedAt.toISOString(),
    };
  }

  if (!["open", "applying"].includes(task.status)) return null;

  const pendingApplications = (
    await tx.select().from(taskApplications).where(eq(taskApplications.taskId, taskId))
  ).filter((application) => application.status === "pending");
  const rawPendingProposals = allowAgentProposals
    ? (await tx.select().from(taskAgentProposals).where(eq(taskAgentProposals.taskId, taskId))).filter(
        (proposal) => proposal.status === "pending",
      )
    : [];
  const enabledAgentIds = allowAgentProposals
    ? await getEnabledAgentIdSetInTx(tx, rawPendingProposals.map((proposal) => proposal.agentId))
    : new Set<string>();
  const disabledProposalIds = rawPendingProposals
    .filter((proposal) => !enabledAgentIds.has(proposal.agentId))
    .map((proposal) => proposal.id);
  if (disabledProposalIds.length > 0) {
    await tx
      .update(taskAgentProposals)
      .set({ status: "rejected" })
      .where(inArray(taskAgentProposals.id, disabledProposalIds));
  }
  const pendingProposals = rawPendingProposals.filter((proposal) => enabledAgentIds.has(proposal.agentId));
  if (pendingApplications.length === 0 && pendingProposals.length === 0) return null;

  const applicantIds = pendingApplications.map((application) => application.applicantUserId);
  const proposerIds = pendingProposals.map((proposal) => proposal.proposerUserId);
  const scoredApplications = preferReputationRanking
    ? await buildReputationScoredApplications(tx, pendingApplications, applicantIds)
    : await buildLegacyScoredApplications(tx, pendingApplications, applicantIds);
  const scoredProposals = allowAgentProposals
    ? preferReputationRanking
      ? await buildReputationScoredProposals(tx, task, pendingProposals, proposerIds)
      : await buildLegacyScoredProposals(tx, task, pendingProposals, proposerIds)
    : [];
  const scored: DispatchCandidate[] = [
    ...scoredApplications.map((entry) => ({ kind: "application" as const, ...entry })),
    ...scoredProposals.map((entry) => ({ kind: "proposal" as const, ...entry })),
  ];

  scored.sort((left, right) => {
    const leftEta = left.kind === "application" ? left.application.proposedEtaHours : left.proposal.proposedEtaHours;
    const rightEta = right.kind === "application" ? right.application.proposedEtaHours : right.proposal.proposedEtaHours;
    const leftCreatedAt = left.kind === "application" ? left.application.createdAt : left.proposal.createdAt;
    const rightCreatedAt = right.kind === "application" ? right.application.createdAt : right.proposal.createdAt;
    if (preferReputationRanking) {
      if (right.reputationScore !== left.reputationScore) return right.reputationScore - left.reputationScore;
      if (right.completionRate !== left.completionRate) return right.completionRate - left.completionRate;
      if (left.defaultRate !== right.defaultRate) return left.defaultRate - right.defaultRate;
      if (right.trustLevel !== left.trustLevel) return right.trustLevel - left.trustLevel;
      if (right.matchedCapabilityCount !== left.matchedCapabilityCount) {
        return right.matchedCapabilityCount - left.matchedCapabilityCount;
      }
      if (leftEta !== rightEta) {
        return leftEta - rightEta;
      }
      return leftCreatedAt.getTime() - rightCreatedAt.getTime();
    }

    if (right.trustLevel !== left.trustLevel) return right.trustLevel - left.trustLevel;
    if (right.completionRate !== left.completionRate) return right.completionRate - left.completionRate;
    if (left.defaultCount !== right.defaultCount) return left.defaultCount - right.defaultCount;
    if (right.matchedCapabilityCount !== left.matchedCapabilityCount) {
      return right.matchedCapabilityCount - left.matchedCapabilityCount;
    }
    if (leftEta !== rightEta) {
      return leftEta - rightEta;
    }
    return leftCreatedAt.getTime() - rightCreatedAt.getTime();
  });
  const winner = scored[0];
  const decidedAt = now();

  if (winner.kind === "application") {
    await tx
      .update(taskApplications)
      .set({ status: "accepted" })
      .where(eq(taskApplications.id, winner.application.id));

    const rejectedIds = pendingApplications
      .filter((entry) => entry.id !== winner.application.id)
      .map((entry) => entry.id);
    await releaseRejectedBonds(tx, task.title, rejectedIds, decidedAt);
    await rejectPendingTaskAgentProposalsInTx(tx, task.id);

    await tx
      .update(tasks)
      .set({
        assignedUserId: winner.application.applicantUserId,
        status: "assigned",
      })
      .where(eq(tasks.id, taskId));

    const [decision] = await tx
      .insert(taskDispatchDecisions)
      .values({
        id: crypto.randomUUID(),
        taskId,
        assignedApplicationId: winner.application.id,
        assignedProposalId: null,
        assignedUserId: winner.application.applicantUserId,
        decidedAt,
      })
      .returning();

    await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: winner.application.applicantUserId,
      allowChargeIfMissing: true,
      timestamp: decidedAt,
    });

    await enqueueOutboxEvent(
      "task.assigned",
      {
        taskId,
        assignedUserId: winner.application.applicantUserId,
        assignedApplicationId: winner.application.id,
        assignmentMode: "application",
      },
      tx,
    );

    return {
      taskId,
      assignedApplicationId: decision.assignedApplicationId,
      assignedProposalId: null,
      assignedUserId: decision.assignedUserId,
      assignmentMode: "application",
      decidedAt: decision.decidedAt.toISOString(),
    };
  }

  const rejectedIds = pendingApplications.map((entry) => entry.id);
  await releaseRejectedBonds(tx, task.title, rejectedIds, decidedAt);
  const assignment = await assignTaskToAgentProposalInTx({
    tx,
    task,
    proposal: winner.proposal,
    decidedAt,
  });

  return {
    taskId,
    assignedApplicationId: null,
    assignedProposalId: assignment.decision.assignedProposalId,
    assignedUserId: assignment.decision.assignedUserId,
    assignmentMode: "agentProposal",
    decidedAt: assignment.decision.decidedAt.toISOString(),
  };
}

export async function listTasks(): Promise<TaskView[]> {
  const rows = await listTasksWithCounts();
  return rows.map(({ task, applicationCount, arbitrationCaseCount }) =>
    toTaskView(task, applicationCount, arbitrationCaseCount),
  );
}

export async function listMyTasks(userId: string): Promise<TaskView[]> {
  const rows = await listTasksWithCountsByUser(userId);
  return rows.map(({ task, applicationCount, arbitrationCaseCount }) =>
    toTaskView(task, applicationCount, arbitrationCaseCount),
  );
}

export async function createTaskDraft(
  userId: string,
  input: CreateTaskDraftInput,
): Promise<CreateTaskDraftResult> {
  const ownerUserId = userId.trim();
  if (!ownerUserId) throw new BadRequestError("Task draft owner is required");
  let normalized;
  try {
    normalized = normalizeTaskDraftInput(input);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid task draft");
  }

  return db.transaction(async (tx) => {
    const findExisting = async () => {
      const [existing] = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.creatorUserId, ownerUserId),
            eq(tasks.idempotencyKey, normalized.idempotencyKey),
          ),
        )
        .limit(1);
      return existing ?? null;
    };
    const existing = await findExisting();
    if (existing) {
      if (!taskDraftPayloadMatches(existing, normalized)) {
        throw new ConflictError("Task draft idempotency key is already used for another payload");
      }
      return { task: toTaskView(existing, 0), created: false };
    }

    const record = buildTaskDraftRecord({
      id: crypto.randomUUID(),
      ownerUserId,
      input: normalized,
      createdAt: now(),
    });
    const [inserted] = await tx
      .insert(tasks)
      .values(record)
      .onConflictDoNothing({ target: [tasks.creatorUserId, tasks.idempotencyKey] })
      .returning();
    if (inserted) {
      return { task: toTaskView(inserted, 0), created: true };
    }

    const raced = await findExisting();
    if (!raced) throw new ConflictError("Task draft could not be recovered after an idempotency conflict");
    if (!taskDraftPayloadMatches(raced, normalized)) {
      throw new ConflictError("Task draft idempotency key is already used for another payload");
    }
    return { task: toTaskView(raced, 0), created: false };
  });
}

export async function getOwnedTaskSummary(ownerUserId: string, taskId: string) {
  const task = await getTaskByOwnerAndId(ownerUserId, taskId);
  if (!task) return null;
  const [applicationCountRow] = await db
    .select({ count: count(taskApplications.id) })
    .from(taskApplications)
    .where(eq(taskApplications.taskId, task.id));
  const [arbitrationCountRow] = await db
    .select({ count: count() })
    .from(schema.arbitrationCases)
    .where(and(eq(schema.arbitrationCases.entityType, "task"), eq(schema.arbitrationCases.entityId, task.id)));
  return toTaskView(
    task,
    Number(applicationCountRow?.count ?? 0),
    Number(arbitrationCountRow?.count ?? 0),
  );
}

export async function createTask(userId: string, input: CreateTaskInput): Promise<TaskView> {
  const pricingMode = normalizeTaskPricingMode(input.pricingMode);
  const operationMode = normalizeTaskOperationMode(input.operationMode);
  const billingUnit = normalizeTaskBillingUnit(pricingMode, input.billingUnit);
  const meterKey = normalizeTaskMeterKey(pricingMode, input.meterKey);
  const meterQuantity = normalizeTaskMeterQuantity(pricingMode, input.meterQuantity);

  const createdTask = await db.transaction(async (tx) => {
    const createdAt = now();
    const taskId = crypto.randomUUID();

    await transferBalance({
      fromUserId: userId,
      toUserId: TASK_REWARD_ESCROW_USER_ID,
      currency: input.rewardCurrency,
      amount: input.rewardAmount,
      note: `任务奖励托管：${input.title}`,
      referenceType: "taskRewardEscrow",
      referenceId: taskId,
      tx,
    });

      const [task] = await tx
        .insert(tasks)
        .values({
          id: taskId,
          creatorUserId: userId,
          assignedUserId: null,
          title: input.title,
          description: input.description,
          preferredCapabilityCodes: normalizeCapabilityCodes(input.preferredCapabilityCodes),
          pricingMode,
          billingUnit,
          meterKey,
          meterQuantity,
          operationMode,
          rewardCurrency: input.rewardCurrency,
          rewardAmount: input.rewardAmount,
          requiredBondAmount: input.requiredBondAmount,
          status: "open",
        createdAt,
      })
      .returning();

    await tx.insert(taskRewardHolds).values({
      id: crypto.randomUUID(),
      taskId,
      creatorUserId: userId,
      assigneeUserId: null,
      rewardCurrency: input.rewardCurrency,
      rewardAmount: input.rewardAmount,
      status: "escrowed",
      createdAt,
      settledAt: null,
    });

    await enqueueOutboxEvent("task.created", { taskId: task.id, creatorUserId: userId }, tx);
    return toTaskView(task, 0);
  });

  if (operationMode === "automatic") {
    await runAutomaticMarketplaceMatching(createdTask.id);
  }

  return (await getTaskSummary(createdTask.id)) ?? createdTask;
}

export async function listApplications(taskId: string): Promise<TaskApplicationView[]> {
  const rows = await listTaskApplicationsByTask(taskId);
  return rows.map(toTaskApplicationView);
}

export async function listAgentProposals(taskId: string): Promise<TaskAgentProposalView[]> {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  const rows = await listTaskAgentProposalsByTask(taskId);
  const matchedCapabilityMap = await getProposalMatchedCapabilityMap(task, rows);
  return rows.map((proposal) =>
    toTaskAgentProposalView(proposal, task, task.creatorUserId, matchedCapabilityMap.get(proposal.id) ?? []),
  );
}

export async function listVisibleAgentProposals(
  userId: string,
  taskId: string,
): Promise<TaskAgentProposalView[]> {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task not found");
  }

  const rows = await listTaskAgentProposalsByTask(taskId);
  const matchedCapabilityMap = await getProposalMatchedCapabilityMap(task, rows);
  if (task.creatorUserId === userId || task.assignedUserId === userId) {
    return rows.map((proposal) =>
      toTaskAgentProposalView(proposal, task, userId, matchedCapabilityMap.get(proposal.id) ?? []),
    );
  }

  return rows
    .filter((proposal) => proposal.proposerUserId === userId)
    .map((proposal) => toTaskAgentProposalView(proposal, task, userId, matchedCapabilityMap.get(proposal.id) ?? []));
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

export async function createAgentProposal(
  userId: string,
  taskId: string,
  input: CreateTaskAgentProposalInput,
): Promise<TaskAgentProposalView> {
  const reputationFeature = await getSingleFeatureModule("reputation");
  const agentRegistryFeature = await getSingleFeatureModule("agentRegistry");
  const agentExecutionFeature = await getSingleFeatureModule("agentExecution");
  const preferReputationRanking = Boolean(reputationFeature?.enabled);
  const allowAgentProposals = Boolean(agentRegistryFeature?.enabled && agentExecutionFeature?.enabled);

  const ownedAgent = await getOwnedAgentById(userId, input.agentId);
  if (!ownedAgent) {
    throw new NotFoundError("Agent not found or not owned by current user");
  }
  if (!ownedAgent.enabled) {
    throw new ConflictError("Agent is disabled");
  }

  try {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select id from tasks where id = ${taskId} for update`);

      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
      if (!task) {
        throw new NotFoundError("Task not found");
      }
      if (task.creatorUserId === userId) {
        throw new BadRequestError("Task creator cannot submit agent proposal");
      }
      if (!["open", "applying"].includes(task.status)) {
        throw new ConflictError("Task is not accepting proposals");
      }

      const [existing] = await tx
        .select()
        .from(taskAgentProposals)
        .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.agentId, input.agentId)));
      if (existing) {
        throw new ConflictError("This agent has already submitted a proposal for the task");
      }

      const [created] = await tx
        .insert(taskAgentProposals)
        .values({
          id: crypto.randomUUID(),
          taskId,
          proposerUserId: userId,
          agentId: input.agentId,
          statement: input.statement,
          proposedEtaHours: input.proposedEtaHours,
          proposedCostNote: input.proposedCostNote ?? null,
          executionId: null,
          status: "pending",
          createdAt: now(),
        })
        .returning();

      const pendingApplications = await tx
        .select({ count: count(taskApplications.id) })
        .from(taskApplications)
        .where(and(eq(taskApplications.taskId, taskId), eq(taskApplications.status, "pending")));
      const pendingProposals = await tx
        .select({ count: count(taskAgentProposals.id) })
        .from(taskAgentProposals)
        .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.status, "pending")));

      const totalPendingCandidates =
        Number(pendingApplications[0]?.count ?? 0) + Number(pendingProposals[0]?.count ?? 0);

      if (allowAgentProposals && totalPendingCandidates >= 2) {
        await dispatchTaskInTx(tx, taskId, preferReputationRanking, allowAgentProposals);
      }

      const [currentProposal] = await tx
        .select()
        .from(taskAgentProposals)
        .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.id, created.id)));
      if (!currentProposal) {
        throw new NotFoundError("Task agent proposal not found after creation");
      }

      const [currentTask] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
      if (!currentTask) {
        throw new NotFoundError("Task not found after proposal creation");
      }

      const matchedCapabilityMap = await getProposalMatchedCapabilityMap(currentTask, [currentProposal]);
      return toTaskAgentProposalView(
        currentProposal,
        currentTask,
        userId,
        matchedCapabilityMap.get(currentProposal.id) ?? [],
      );
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("This agent has already submitted a proposal for the task");
    }
    throw error;
  }
}

export async function runOwnedAgentMarketplaceAutoProposalSweep(
  ownerUserId: string,
  limit = 20,
): Promise<{
  scannedListingCount: number;
  matchedTaskCount: number;
  createdProposalCount: number;
  skippedTaskCount: number;
  proposalTaskIds: string[];
  skippedTaskIds: string[];
}> {
  const taskHubFeature = await getSingleFeatureModule("taskHub");
  if (!taskHubFeature?.enabled) {
    throw new ConflictError("Task hub is disabled");
  }

  const listings = (await listOwnedAgentMarketplaceListings(ownerUserId)).filter(
    (listing) => listing.status === "published" && listing.autoTakeEnabled,
  );

  if (listings.length === 0) {
    return {
      scannedListingCount: 0,
      matchedTaskCount: 0,
      createdProposalCount: 0,
      skippedTaskCount: 0,
      proposalTaskIds: [],
      skippedTaskIds: [],
    };
  }

  const openTasks = await db
    .select()
    .from(tasks)
    .where(and(ne(tasks.creatorUserId, ownerUserId), or(eq(tasks.status, "open"), eq(tasks.status, "applying"))))
    .orderBy(desc(tasks.createdAt))
    .limit(Math.max(5, Math.min(limit * 4, 120)));

  const matchedTaskIds = new Set<string>();
  const proposalTaskIds = new Set<string>();
  const skippedTaskIds = new Set<string>();
  let scannedListingCount = 0;
  const semanticSelectionByTaskId = new Map<string, SemanticListingSelection | null>();
  for (const task of openTasks) {
    if (task.preferredCapabilityCodes.length > 0) {
      semanticSelectionByTaskId.set(task.id, null);
      continue;
    }
    semanticSelectionByTaskId.set(
      task.id,
      await selectListingsBySemanticRouter(task, listings).catch(() => null),
    );
  }

  for (const listing of listings) {
    scannedListingCount += 1;
    let createdForListing = 0;

    for (const task of openTasks) {
      if (proposalTaskIds.size >= limit) {
        break;
      }

      const taskSemanticSelection = semanticSelectionByTaskId.get(task.id) ?? null;
      const routeAccepted = taskSemanticSelection
        ? taskSemanticSelection.selectedListingIds.has(listing.id)
        : taskAcceptsListingCapability(task, listing);
      if (!routeAccepted) {
        continue;
      }
      const pricingMatch = canListingAutoProposeForTask(task, listing);
      if (!pricingMatch.match) {
        continue;
      }

      matchedTaskIds.add(task.id);

      try {
        const matchedKeywords = taskSemanticSelection?.matchedKeywordsByListingId.get(listing.id) ?? [];
        const semanticReason = taskSemanticSelection?.reasonByListingId.get(listing.id) ?? null;
        await createAgentProposal(ownerUserId, task.id, {
          agentId: listing.agentId,
          statement: [
            renderAutoTakeStatement(listing.autoTakeStatementTemplate, {
              taskTitle: task.title,
              capabilityCode: listing.capabilityCode,
              capabilityTitle: listing.capabilityTitle,
              taskLabel: listing.agentHostingMode === "managed_light" ? "任务" : "能力",
              priceAmount: pricingMatch.quotedAmount ?? listing.priceAmount,
              priceCurrency: listing.priceCurrency,
            }),
            matchedKeywords.length > 0 ? `中央调度命中：${matchedKeywords.join(" / ")}` : null,
            semanticReason ? `调度说明：${semanticReason}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          proposedEtaHours: 24,
          proposedCostNote: `${pricingMatch.quotedAmount ?? listing.priceAmount} ${listing.priceCurrency} / ${listing.billingUnit || "task"}${getTaskMeterQuantity(task) ? ` x ${getTaskMeterQuantity(task)}` : ""}`,
        });
        proposalTaskIds.add(task.id);
        createdForListing += 1;
      } catch (error) {
        if (error instanceof ConflictError || error instanceof BadRequestError || error instanceof NotFoundError) {
          skippedTaskIds.add(task.id);
          continue;
        }
        throw error;
      }
    }

    await recordOwnedAgentMarketplaceSweepResult(ownerUserId, listing.id, createdForListing);
  }

  return {
    scannedListingCount,
    matchedTaskCount: matchedTaskIds.size,
    createdProposalCount: proposalTaskIds.size,
    skippedTaskCount: skippedTaskIds.size,
    proposalTaskIds: [...proposalTaskIds],
    skippedTaskIds: [...skippedTaskIds],
  };
}

async function runAutomaticMarketplaceMatching(taskId: string) {
  const taskHubFeature = await getSingleFeatureModule("taskHub");
  const agentRegistryFeature = await getSingleFeatureModule("agentRegistry");
  const agentExecutionFeature = await getSingleFeatureModule("agentExecution");

  if (!taskHubFeature?.enabled || !agentRegistryFeature?.enabled || !agentExecutionFeature?.enabled) {
    return {
      scannedListingCount: 0,
      createdProposalCount: 0,
      dispatched: false,
    };
  }

  const task = await getTaskById(taskId);
  if (!task || task.operationMode !== "automatic") {
    return {
      scannedListingCount: 0,
      createdProposalCount: 0,
      dispatched: false,
    };
  }

  const listings = (await listPublicAgentMarketplaceListings(60)).filter((listing) => listing.autoTakeEnabled);
  const semanticSelection =
    task.preferredCapabilityCodes.length === 0
      ? await selectListingsBySemanticRouter(task, listings).catch(() => null)
      : null;

  let createdProposalCount = 0;

  for (const listing of listings) {
    const routeAccepted = semanticSelection
      ? semanticSelection.selectedListingIds.has(listing.id)
      : taskAcceptsListingCapability(task, listing);
    if (!routeAccepted) {
      continue;
    }
    const pricingMatch = canListingAutoProposeForTask(task, listing);
    if (!pricingMatch.match) {
      continue;
    }

    try {
      const matchedKeywords = semanticSelection?.matchedKeywordsByListingId.get(listing.id) ?? [];
      const semanticReason = semanticSelection?.reasonByListingId.get(listing.id) ?? null;
      await createAgentProposal(listing.ownerUserId, task.id, {
        agentId: listing.agentId,
        statement: [
          renderAutoTakeStatement(listing.autoTakeStatementTemplate, {
            taskTitle: task.title,
            capabilityCode: listing.capabilityCode,
            capabilityTitle: listing.capabilityTitle,
            taskLabel: listing.agentHostingMode === "managed_light" ? "任务" : "能力",
            priceAmount: pricingMatch.quotedAmount ?? listing.priceAmount,
            priceCurrency: listing.priceCurrency,
          }),
          matchedKeywords.length > 0 ? `中央调度命中：${matchedKeywords.join(" / ")}` : null,
          semanticReason ? `调度说明：${semanticReason}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        proposedEtaHours: 24,
        proposedCostNote: `${pricingMatch.quotedAmount ?? listing.priceAmount} ${listing.priceCurrency} / ${listing.billingUnit || "task"}${getTaskMeterQuantity(task) ? ` x ${getTaskMeterQuantity(task)}` : ""}`,
      });
      createdProposalCount += 1;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof BadRequestError || error instanceof NotFoundError) {
        continue;
      }
      throw error;
    }
  }

  if (createdProposalCount > 0) {
    try {
      await dispatchTask(task.id);
      return {
        scannedListingCount: listings.length,
        createdProposalCount,
        dispatched: true,
      };
    } catch (error) {
      if (error instanceof ConflictError || error instanceof BadRequestError || error instanceof NotFoundError) {
        return {
          scannedListingCount: listings.length,
          createdProposalCount,
          dispatched: false,
        };
      }
      throw error;
    }
  }

  return {
    scannedListingCount: listings.length,
    createdProposalCount,
    dispatched: false,
  };
}

export async function runGlobalAgentMarketplaceAutoProposalSweep(args?: {
  ownerLimit?: number;
  perOwnerLimit?: number;
}) {
  const ownerLimit = Math.max(1, Math.min(args?.ownerLimit ?? 20, 100));
  const perOwnerLimit = Math.max(1, Math.min(args?.perOwnerLimit ?? 10, 50));

  const ownerRows = await db
    .selectDistinct({ ownerUserId: agents.ownerUserId })
    .from(agentMarketplaceListings)
    .innerJoin(agents, eq(agentMarketplaceListings.agentId, agents.id))
    .where(
      and(
        eq(agentMarketplaceListings.status, "published"),
        eq(agentMarketplaceListings.autoTakeEnabled, true),
        eq(agents.enabled, true),
      ),
    )
    .limit(ownerLimit);

  let scannedOwnerCount = 0;
  let scannedListingCount = 0;
  let matchedTaskCount = 0;
  let createdProposalCount = 0;
  let skippedTaskCount = 0;
  const proposalTaskIds = new Set<string>();
  const skippedTaskIds = new Set<string>();

  for (const row of ownerRows) {
    if (!row.ownerUserId) continue;
    scannedOwnerCount += 1;
    const result = await runOwnedAgentMarketplaceAutoProposalSweep(row.ownerUserId, perOwnerLimit);
    scannedListingCount += result.scannedListingCount;
    matchedTaskCount += result.matchedTaskCount;
    createdProposalCount += result.createdProposalCount;
    skippedTaskCount += result.skippedTaskCount;
    for (const taskId of result.proposalTaskIds) {
      proposalTaskIds.add(taskId);
    }
    for (const taskId of result.skippedTaskIds) {
      skippedTaskIds.add(taskId);
    }
  }

  return {
    scannedOwnerCount,
    scannedListingCount,
    matchedTaskCount,
    createdProposalCount,
    skippedTaskCount,
    proposalTaskIds: [...proposalTaskIds],
    skippedTaskIds: [...skippedTaskIds],
  };
}

export async function acceptAgentProposal(
  actorUserId: string,
  taskId: string,
  proposalId: string,
): Promise<{ task: TaskView; proposal: TaskAgentProposalView; executionId: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
    await tx.execute(sql`select id from task_agent_proposals where id = ${proposalId} for update`);

    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) throw new NotFoundError("Task not found");
    if (task.creatorUserId !== actorUserId) {
      throw new ConflictError("Only task creator can accept agent proposals");
    }
    if (!["open", "applying"].includes(task.status)) {
      throw new ConflictError("Task is not accepting agent proposals");
    }
    if (task.assignedUserId) {
      throw new ConflictError("Task already has an assignee");
    }

    const proposal = await getTaskAgentProposalById(taskId, proposalId);
    if (!proposal) {
      throw new NotFoundError("Task agent proposal not found");
    }
    if (proposal.status !== "pending") {
      throw new ConflictError("Task agent proposal is no longer pending");
    }

    const ownedAgent = await getOwnedAgentById(proposal.proposerUserId, proposal.agentId);
    if (!ownedAgent || !ownedAgent.enabled) {
      throw new ConflictError("Agent proposal cannot be accepted because the agent is unavailable");
    }

    const pendingApplications = (
      await tx.select().from(taskApplications).where(eq(taskApplications.taskId, taskId))
    ).filter((application) => application.status === "pending");

    if (pendingApplications.length > 0) {
      await releaseRejectedBonds(
        tx,
        task.title,
        pendingApplications.map((application) => application.id),
        now(),
      );
    }

    await tx
      .update(taskAgentProposals)
      .set({ status: "rejected" })
      .where(and(eq(taskAgentProposals.taskId, taskId), ne(taskAgentProposals.id, proposalId), eq(taskAgentProposals.status, "pending")));

    const assignment = await assignTaskToAgentProposalInTx({
      tx,
      task,
      proposal,
      decidedAt: now(),
    });

    const taskWithCount = await getTaskWithCountInTx(tx, taskId);
    if (!taskWithCount) {
      throw new NotFoundError("Task not found after accepting agent proposal");
    }
    const matchedCapabilityMap = await getProposalMatchedCapabilityMap(taskWithCount.task, [assignment.updatedProposal]);

    return {
      task: toTaskView(taskWithCount.task, taskWithCount.applicationCount, taskWithCount.arbitrationCaseCount),
      proposal: toTaskAgentProposalView(
        assignment.updatedProposal,
        taskWithCount.task,
        actorUserId,
        matchedCapabilityMap.get(assignment.updatedProposal.id) ?? [],
      ),
      executionId: assignment.execution.id,
    };
    });
  }

export async function rejectAgentProposal(
  actorUserId: string,
  taskId: string,
  proposalId: string,
): Promise<TaskAgentProposalView> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
    await tx.execute(sql`select id from task_agent_proposals where id = ${proposalId} for update`);

    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) throw new NotFoundError("Task not found");
    if (task.creatorUserId !== actorUserId) {
      throw new ConflictError("Only task creator can reject agent proposals");
    }
    if (!["open", "applying"].includes(task.status)) {
      throw new ConflictError("Task is not accepting agent proposals");
    }

    const proposal = await getTaskAgentProposalById(taskId, proposalId);
    if (!proposal) {
      throw new NotFoundError("Task agent proposal not found");
    }
    if (proposal.status !== "pending") {
      throw new ConflictError("Task agent proposal is no longer pending");
    }

    const [updated] = await tx
      .update(taskAgentProposals)
      .set({ status: "rejected" })
      .where(eq(taskAgentProposals.id, proposal.id))
      .returning();

      const matchedCapabilityMap = await getProposalMatchedCapabilityMap(task, [updated]);
      return toTaskAgentProposalView(updated, task, actorUserId, matchedCapabilityMap.get(updated.id) ?? []);
    });
  }

export async function applyToTask(
  userId: string,
  taskId: string,
  statement: string,
  proposedEtaHours: number,
): Promise<{ application: TaskApplicationView; dispatch: DispatchDecisionView | null }> {
  const applicationId = crypto.randomUUID();
  const reputationFeature = await getSingleFeatureModule("reputation");
  const agentRegistryFeature = await getSingleFeatureModule("agentRegistry");
  const agentExecutionFeature = await getSingleFeatureModule("agentExecution");
  const preferReputationRanking = Boolean(reputationFeature?.enabled);
  const allowAgentProposals = Boolean(agentRegistryFeature?.enabled && agentExecutionFeature?.enabled);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) throw new Error("Task not found");
    if (task.creatorUserId === userId) throw new Error("Task creator cannot apply to their own task");
    if (!["open", "applying"].includes(task.status)) throw new Error("Task is not accepting applications");

    if (task.requiredBondAmount > 0) {
      await freezeBalance(
        userId,
        "obsidian",
        task.requiredBondAmount,
        `任务保证金：${task.title}`,
        "taskApplication",
        applicationId,
        tx,
      );
    }

    const [created] = await tx
      .insert(taskApplications)
      .values({
        id: applicationId,
        taskId,
        applicantUserId: userId,
        statement,
        proposedEtaHours,
        status: "pending",
        createdAt: now(),
      })
      .returning();

    if (task.requiredBondAmount > 0) {
      await tx.insert(bondHolds).values({
        id: crypto.randomUUID(),
        taskId,
        applicationId,
        userId,
        currency: "obsidian",
        amount: task.requiredBondAmount,
        status: "active",
        createdAt: now(),
        releasedAt: null,
      });
    }

    if (task.status === "open") {
      await tx.update(tasks).set({ status: "applying" }).where(eq(tasks.id, taskId));
    }

    await enqueueOutboxEvent(
      "task.applied",
      {
        taskId,
        applicationId,
        applicantUserId: userId,
      },
      tx,
    );

    const pendingApplications = await tx
      .select({ count: count(taskApplications.id) })
      .from(taskApplications)
      .where(and(eq(taskApplications.taskId, taskId), eq(taskApplications.status, "pending")));
    const pendingProposals = allowAgentProposals
      ? await tx
          .select({ count: count(taskAgentProposals.id) })
          .from(taskAgentProposals)
          .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.status, "pending")))
      : [{ count: 0 }];

    const totalPendingCandidates =
      Number(pendingApplications[0]?.count ?? 0) + Number(pendingProposals[0]?.count ?? 0);

    const dispatch = totalPendingCandidates >= 2
      ? await dispatchTaskInTx(tx, taskId, preferReputationRanking, allowAgentProposals)
      : null;

    return {
      application: toTaskApplicationView(created),
      dispatch,
    };
  });
}

export async function dispatchTask(taskId: string): Promise<DispatchDecisionView | null> {
  const reputationFeature = await getSingleFeatureModule("reputation");
  const agentRegistryFeature = await getSingleFeatureModule("agentRegistry");
  const agentExecutionFeature = await getSingleFeatureModule("agentExecution");
  const preferReputationRanking = Boolean(reputationFeature?.enabled);
  const allowAgentProposals = Boolean(agentRegistryFeature?.enabled && agentExecutionFeature?.enabled);
  return db.transaction(async (tx) => dispatchTaskInTx(tx, taskId, preferReputationRanking, allowAgentProposals));
}

export async function getDispatchDecision(taskId: string): Promise<DispatchDecisionView | null> {
  const decision = await getDispatchDecisionFromRepo(taskId);
  if (!decision) return null;
  return {
    taskId: decision.taskId,
    assignedApplicationId: decision.assignedApplicationId,
    assignedProposalId: decision.assignedProposalId,
    assignedUserId: decision.assignedUserId,
    assignmentMode: decision.assignedProposalId ? "agentProposal" : "application",
    decidedAt: decision.decidedAt.toISOString(),
  };
}

export async function getTaskSummary(taskId: string) {
  const task = await getTaskById(taskId);
  if (!task) return null;
  const [applicationCountRow] = await db
    .select({ count: count(taskApplications.id) })
    .from(taskApplications)
    .where(eq(taskApplications.taskId, taskId));
  const [arbitrationCountRow] = await db
    .select({ count: count() })
    .from(schema.arbitrationCases)
    .where(and(eq(schema.arbitrationCases.entityType, "task"), eq(schema.arbitrationCases.entityId, taskId)));

  return toTaskView(task, Number(applicationCountRow?.count ?? 0), Number(arbitrationCountRow?.count ?? 0));
}

async function advanceTaskLifecycleInTx(
  tx: NodePgDatabase<typeof schema>,
  actorUserId: string,
  taskId: string,
  action: TaskLifecycleAction,
  options?: {
    allowSettlementOverride?: boolean;
  },
): Promise<TaskView> {
  await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error("Task not found");

  const allowSettlementOverride = options?.allowSettlementOverride === true;

  if (action === "start") {
    if (!task.assignedUserId) throw new Error("Task has no assignee");
    if (actorUserId !== task.assignedUserId) throw new Error("Only assigned user can start task");
    if (task.status !== "assigned") throw new Error("Task is not in assigned status");
    await tx.update(tasks).set({ status: "in_progress" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.started", { taskId, actorUserId }, tx);
  }

  if (action === "submit") {
    if (!task.assignedUserId) throw new Error("Task has no assignee");
    if (actorUserId !== task.assignedUserId) throw new Error("Only assigned user can submit task");
    if (task.status !== "in_progress") throw new Error("Task is not in progress");
    await tx.update(tasks).set({ status: "submitted" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.submitted", { taskId, actorUserId }, tx);
  }

  if (action === "accept") {
    if (!task.assignedUserId) throw new Error("Task has no assignee");
    if (!allowSettlementOverride && actorUserId !== task.creatorUserId) {
      throw new Error("Only task creator can accept submission");
    }
    if (allowSettlementOverride && task.status === "accepted") {
      const current = await getTaskWithCountInTx(tx, taskId);
      if (!current) throw new Error("Task not found after lifecycle update");
      return toTaskView(current.task, current.applicationCount, current.arbitrationCaseCount);
    }
    if (task.status !== "submitted") throw new Error("Task is not submitted");

    const [decision] = await tx
      .select()
      .from(taskDispatchDecisions)
      .where(eq(taskDispatchDecisions.taskId, taskId));

    const winningBondHold = decision?.assignedApplicationId
      ? await tx
          .select()
          .from(bondHolds)
          .where(
            and(
              eq(bondHolds.taskId, taskId),
              eq(bondHolds.applicationId, decision.assignedApplicationId),
              eq(bondHolds.status, "active"),
            ),
          )
          .then((rows) => rows[0] ?? null)
      : null;
    if (winningBondHold && winningBondHold.amount > 0) {
      await unfreezeBalance(
        winningBondHold.userId,
        winningBondHold.currency as "obsidian",
        winningBondHold.amount,
        `任务验收通过，退回保证金：${task.title}`,
        "bondHold",
        winningBondHold.id,
        tx,
      );
      await tx
        .update(bondHolds)
        .set({ status: "released", releasedAt: now() })
        .where(eq(bondHolds.id, winningBondHold.id));
    }

    const [rewardHold] = await tx
      .select()
      .from(taskRewardHolds)
      .where(eq(taskRewardHolds.taskId, taskId));
    if (!rewardHold) {
      const reconciledHold = await ensureTaskRewardEscrowHoldInTx({
        tx,
        task,
        assignedUserId: task.assignedUserId,
        allowChargeIfMissing: true,
      });
      if (!reconciledHold) {
        throw new ConflictError("Task reward escrow is missing");
      }
    }

    const activeRewardHold = await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: task.assignedUserId,
      allowChargeIfMissing: true,
    });
    if (!activeRewardHold) {
      throw new ConflictError("Task reward escrow is missing");
    }
    if (activeRewardHold.status !== "escrowed") {
      throw new ConflictError(`Task reward escrow is not payable in status ${activeRewardHold.status}`);
    }
    if (!activeRewardHold.assigneeUserId) {
      throw new ConflictError("Task reward escrow is missing assigned user");
    }

    if (activeRewardHold.rewardAmount > 0) {
      await transferBalance({
        fromUserId: TASK_REWARD_ESCROW_USER_ID,
        toUserId: activeRewardHold.assigneeUserId,
        currency: activeRewardHold.rewardCurrency as ProductCurrency,
        amount: activeRewardHold.rewardAmount,
        note: `任务托管奖励结算：${task.title}`,
        referenceType: "task",
        referenceId: task.id,
        tx,
      });
    }

    await tx
      .update(taskRewardHolds)
      .set({ status: "paid", settledAt: now() })
      .where(eq(taskRewardHolds.id, activeRewardHold.id));

    await tx.update(tasks).set({ status: "accepted" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.accepted", { taskId, actorUserId }, tx);
  }

  if (action === "default") {
    if (!task.assignedUserId) throw new Error("Task has no assignee");
    if (!allowSettlementOverride && actorUserId !== task.creatorUserId) {
      throw new Error("Only task creator can default task");
    }
    if (allowSettlementOverride && task.status === "defaulted") {
      const current = await getTaskWithCountInTx(tx, taskId);
      if (!current) throw new Error("Task not found after lifecycle update");
      return toTaskView(current.task, current.applicationCount, current.arbitrationCaseCount);
    }
    if (!["assigned", "in_progress", "submitted"].includes(task.status)) {
      throw new Error("Task status does not support default");
    }

    const [decision] = await tx
      .select()
      .from(taskDispatchDecisions)
      .where(eq(taskDispatchDecisions.taskId, taskId));

    const winningBondHold = decision?.assignedApplicationId
      ? await tx
          .select()
          .from(bondHolds)
          .where(
            and(
              eq(bondHolds.taskId, taskId),
              eq(bondHolds.applicationId, decision.assignedApplicationId),
              eq(bondHolds.status, "active"),
            ),
          )
          .then((rows) => rows[0] ?? null)
      : null;
    if (winningBondHold && winningBondHold.amount > 0) {
      await unfreezeBalance(
        winningBondHold.userId,
        winningBondHold.currency as "obsidian",
        winningBondHold.amount,
        `任务违约，执行保证金扣罚：${task.title}`,
        "bondHold",
        winningBondHold.id,
        tx,
      );
      await transferBalance({
        fromUserId: winningBondHold.userId,
        toUserId: task.creatorUserId,
        currency: winningBondHold.currency as ProductCurrency,
        amount: winningBondHold.amount,
        note: `任务违约赔付：${task.title}`,
        referenceType: "task",
        referenceId: task.id,
        tx,
      });
      await tx
        .update(bondHolds)
        .set({ status: "forfeited", releasedAt: now() })
        .where(eq(bondHolds.id, winningBondHold.id));
    }

    const rewardHold = await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: task.assignedUserId,
      allowChargeIfMissing: false,
    });
    if (task.rewardAmount > 0 && !rewardHold) {
      throw new ConflictError("Task reward escrow is missing for refund");
    }
    if (rewardHold) {
      if (rewardHold.status !== "escrowed") {
        throw new ConflictError(`Task reward escrow is not refundable in status ${rewardHold.status}`);
      }

      if (rewardHold.rewardAmount > 0) {
        await transferBalance({
          fromUserId: TASK_REWARD_ESCROW_USER_ID,
          toUserId: rewardHold.creatorUserId,
          currency: rewardHold.rewardCurrency as ProductCurrency,
          amount: rewardHold.rewardAmount,
          note: `任务托管奖励退回：${task.title}`,
          referenceType: "task",
          referenceId: task.id,
          tx,
        });
      }
      await tx
        .update(taskRewardHolds)
        .set({ status: "refunded", settledAt: now() })
        .where(eq(taskRewardHolds.id, rewardHold.id));
    }

    await tx.update(tasks).set({ status: "defaulted" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.defaulted", { taskId, actorUserId }, tx);
  }

  if (action === "cancel") {
    if (!allowSettlementOverride && actorUserId !== task.creatorUserId) {
      throw new Error("Only task creator can cancel task");
    }
    if (allowSettlementOverride && task.status === "cancelled") {
      const current = await getTaskWithCountInTx(tx, taskId);
      if (!current) throw new Error("Task not found after lifecycle update");
      return toTaskView(current.task, current.applicationCount, current.arbitrationCaseCount);
    }
    if (!["open", "applying", "assigned"].includes(task.status)) {
      throw new Error("Task status does not support cancel");
    }

    const cancelledAt = now();

    await releaseAllActiveTaskBonds({
      tx,
      taskId,
      taskTitle: task.title,
      releasedAt: cancelledAt,
      releaseReason: `任务取消，退回保证金：${task.title}`,
    });

    await tx
      .update(taskApplications)
      .set({ status: "rejected" })
      .where(and(eq(taskApplications.taskId, taskId), sql`${taskApplications.status} <> 'rejected'`));

    const rewardHold = await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: task.assignedUserId,
      allowChargeIfMissing: false,
    });

    if (task.rewardAmount > 0 && !rewardHold) {
      throw new ConflictError("Task reward escrow is missing for cancel");
    }

    if (rewardHold) {
      if (rewardHold.status !== "escrowed") {
        throw new ConflictError(`Task reward escrow is not cancellable in status ${rewardHold.status}`);
      }

      if (rewardHold.rewardAmount > 0) {
        await transferBalance({
          fromUserId: TASK_REWARD_ESCROW_USER_ID,
          toUserId: rewardHold.creatorUserId,
          currency: rewardHold.rewardCurrency as ProductCurrency,
          amount: rewardHold.rewardAmount,
          note: `任务取消，退回托管奖励：${task.title}`,
          referenceType: "task",
          referenceId: task.id,
          tx,
        });
      }

      await tx
        .update(taskRewardHolds)
        .set({ status: "refunded", settledAt: cancelledAt })
        .where(eq(taskRewardHolds.id, rewardHold.id));
    }

    await tx.update(tasks).set({ status: "cancelled" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.cancelled", { taskId, actorUserId }, tx);
  }

  if ((action === "accept" || action === "default" || action === "cancel") && task.assignedUserId) {
    await refreshReputationUsersInTx(tx, [task.creatorUserId, task.assignedUserId]);
    await enqueueOutboxEvent(
      "reputation.updated",
      buildTaskLifecycleReputationUpdatedPayload({
        action,
        taskId,
        actorUserId,
        creatorUserId: task.creatorUserId,
        assignedUserId: task.assignedUserId,
      }),
      tx,
    );
  }

  const taskWithCount = await getTaskWithCountInTx(tx, taskId);
  if (!taskWithCount) throw new Error("Task not found after lifecycle update");
  return toTaskView(taskWithCount.task, taskWithCount.applicationCount, taskWithCount.arbitrationCaseCount);
}

export async function settleTaskLifecycleByOperatorInTx(
  tx: NodePgDatabase<typeof schema>,
  operatorUserId: string,
  taskId: string,
  action: Extract<TaskLifecycleAction, "accept" | "default" | "cancel">,
) {
  return advanceTaskLifecycleInTx(tx, operatorUserId, taskId, action, {
    allowSettlementOverride: true,
  });
}

export async function advanceTaskLifecycle(
  actorUserId: string,
  taskId: string,
  action: TaskLifecycleAction,
): Promise<TaskView> {
  return db.transaction((tx) => advanceTaskLifecycleInTx(tx, actorUserId, taskId, action));
}
