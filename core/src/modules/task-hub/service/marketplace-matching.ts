// Automatic marketplace matching and owner/global auto-proposal sweeps.
// Moved verbatim from service.ts.

import type { ProductCurrency } from "@neuro/contracts";
import { and, desc, eq, ne, or } from "drizzle-orm";

import { db } from "@/db/client";
import {
  agentMarketplaceListings,
  agents,
} from "@/modules/agent-registry/schema";
import {
  listOwnedAgentMarketplaceListings,
  listPublicAgentMarketplaceListings,
  recordOwnedAgentMarketplaceSweepResult,
} from "@/modules/agent-registry/service";
import {
  getTaskById,
} from "@/modules/task-hub/repository";
import {
  tasks,
} from "@/modules/task-hub/schema";
import { BadRequestError, ConflictError, NotFoundError } from "@/platform/errors";
import { getSingleFeatureModule } from "@/platform/feature-modules/service";

import { dispatchTask } from "./dispatch";
import { createAgentProposal } from "./proposals";
import {
  selectListingsBySemanticRouter,
  taskAcceptsListingCapability,
  type SemanticListingSelection,
} from "./semantic-router";
import {
  DEFAULT_PROPERTY_BILLING_UNIT,
  DEFAULT_PROPERTY_METER_KEY,
  DEFAULT_TOKEN_BILLING_UNIT,
  getTaskMeterQuantity,
} from "./shared";

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

export async function runAutomaticMarketplaceMatching(taskId: string) {
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
