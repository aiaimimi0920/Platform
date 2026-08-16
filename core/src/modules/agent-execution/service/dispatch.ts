import type {
  AgentHostingMode,
  AgentMarketplaceBillingMode,
  AgentMarketplaceInvocationSnapshotView,
  AgentExecutionStatus,
  AgentSourceType,
  BenefitServiceApiAccessView,
  InvokeAgentMarketplaceListingInput,
  InvokeAgentMarketplaceListingResult,
  ProductCurrency,
} from "@neuro/contracts";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { getMarketplaceListingDetailById } from "@/modules/agent-registry/repository";
import { agentCapabilities, agents } from "@/modules/agent-registry/schema";
import { ConflictError, NotFoundError } from "@/platform/errors";
import { requestInternalJson } from "@/platform/internal-json-request";
import { safeJsonStringify } from "@/platform/json";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import {
  addOwnedAgentExecutionArtifact,
  createOwnedAgentExecutionInTx,
  updateOwnedAgentExecutionStatus,
} from "./executions";
import {
  buildRuntimeAuthHeaders,
  extractJsonObjectFromText,
  invokeManagedLightModel,
  mergeManagedApiUsageTotals,
  normalizeMarketplaceMeterQuantity,
  renderManagedPromptTemplate,
  resolveManagedApiEndpoint,
  resolveManagedLightServiceAccess,
  resolveTokenMeterQuantity,
  toMarketplaceInvocationSnapshotView,
  toRecordPayload,
  toStoredMarketplaceInvocationSnapshot,
} from "./managed-light";
import {
  buildExecutionOutputEnvelope,
  isManagedLightExecutionHostingMode,
  resolveManagedLightCapabilityRow,
} from "./pricing";
import { recordExecutionStepInTx } from "./runs";
import {
  RuntimeDispatchResult,
  externalRuntimeDispatchTimeoutMs,
  now,
  terminalExecutionStatuses,
} from "./shared";
import {
  getAgentExecutionEventName,
  getAgentExecutionViewById,
  toStoredExecutionOutputEnvelope,
} from "./views";

export function truncateDispatchText(value: string | null | undefined, maximum = 4000) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maximum ? trimmed : `${trimmed.slice(0, Math.max(0, maximum - 1))}…`;
}

export async function getDispatchableExecutionRow(executionId: string, connection: NodePgDatabase<typeof schema> = db) {
  const [row] = await connection
    .select({
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutions)
    .innerJoin(agents, eq(agentExecutions.agentId, agents.id))
    .where(eq(agentExecutions.id, executionId));
  return row ?? null;
}

export async function markExecutionDispatchRunning(args: {
  tx: NodePgDatabase<typeof schema>;
  execution: typeof agentExecutions.$inferSelect;
  note: string;
}) {
  const timestamp = now();
  const output = buildExecutionOutputEnvelope({
    kind: "status_report",
    title: "Execution dispatch in progress",
    summary: args.note,
    generatedAt: timestamp,
    payload: {
      phase: null,
      dispatchState: "running",
      marketplaceInvocation: toStoredMarketplaceInvocationSnapshot(args.execution.marketplaceInvocation),
    },
  });

  const [updated] = await args.tx
    .update(agentExecutions)
    .set({
      status: "running",
      statusNote: args.note,
      resultSummary: null,
      ...toStoredExecutionOutputEnvelope(output),
      executorPhase: null,
      progressPercent: null,
      updatedAt: timestamp,
      startedAt: args.execution.startedAt ?? timestamp,
    })
    .where(and(eq(agentExecutions.id, args.execution.id), eq(agentExecutions.status, "queued")))
    .returning();

  if (!updated) {
    return {
      execution: args.execution,
      claimed: false,
    };
  }

  await recordExecutionStepInTx(args.tx, {
    executionId: args.execution.id,
    kind: "status",
    phase: null,
    title: "Execution dispatched",
    detail: args.note,
    status: "info",
    progressPercent: null,
  });

  await enqueueOutboxEvent(
    getAgentExecutionEventName("running"),
    {
      executionId: args.execution.id,
      ownerUserId: args.execution.ownerUserId,
      agentId: args.execution.agentId,
      status: "running",
    },
    args.tx,
  );

  return {
    execution: updated,
    claimed: true,
  };
}

export async function dispatchManagedApiExecution(
  execution: typeof agentExecutions.$inferSelect,
  agent: typeof agents.$inferSelect,
): Promise<RuntimeDispatchResult> {
  const marketplaceInvocation = toMarketplaceInvocationSnapshotView(execution.marketplaceInvocation);
  const dispatchNote = marketplaceInvocation
    ? `Managed API dispatcher is invoking ${marketplaceInvocation.publicTitle} for ${marketplaceInvocation.quotedAmount} ${marketplaceInvocation.priceCurrency}.`
    : "Managed API dispatcher is invoking the hosted agent runtime.";

  const claimResult = await db.transaction(async (tx) =>
    markExecutionDispatchRunning({
      tx,
      execution,
      note: dispatchNote,
    }),
  );

  if (!claimResult.claimed) {
    return {
      state: "running",
      message: "Managed API execution was already claimed by another dispatcher.",
      executionId: execution.id,
    };
  }

  let resolvedServiceAccess: BenefitServiceApiAccessView | null = null;
  let endpoint: string;
  let capability: typeof agentCapabilities.$inferSelect | null = null;
  try {
    capability = await resolveManagedLightCapabilityRow({
      agentId: agent.id,
      capabilityId: execution.capabilityId ?? null,
    });
    if (agent.managedServiceId?.trim()) {
      resolvedServiceAccess = await resolveManagedLightServiceAccess({
        ownerUserId: execution.ownerUserId,
        serviceId: agent.managedServiceId.trim(),
      });
    }
    endpoint = resolveManagedApiEndpoint(resolvedServiceAccess?.apiUrl || agent.managedApiBaseUrl);
  } catch (error) {
    const failureMessage = truncateDispatchText(
      error instanceof Error ? error.message : "Managed light service access is unavailable.",
      4000,
    );
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: failureMessage ?? undefined,
      resultSummary: failureMessage ?? undefined,
    });
    return {
      state: "failed",
      message: failureMessage ?? "Managed light service access is unavailable.",
      executionId: execution.id,
    };
  }
  const userPromptTemplate = agent.managedPromptTemplate?.trim();
  if (!userPromptTemplate) {
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: "Managed API prompt template is missing.",
      resultSummary: "Managed API prompt template is missing.",
    });
    return {
      state: "failed",
      message: "Managed API prompt template is missing.",
      executionId: execution.id,
    };
  }
  if (!capability) {
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: "Managed light capability is missing.",
      resultSummary: "Managed light capability is missing.",
    });
    return {
      state: "failed",
      message: "Managed light capability is missing.",
      executionId: execution.id,
    };
  }

  const rawInputResourcePayload: Record<string, unknown> = {
    ...(toRecordPayload(execution.inputResourcePayload) ?? {}),
    requestObjective: execution.objective,
  };
  const templateArgs = {
    executionTitle: execution.title,
    objective: execution.objective,
    publicTitle: marketplaceInvocation?.publicTitle ?? null,
    capabilityCode: marketplaceInvocation?.capabilityCode ?? null,
    capabilityTitle: marketplaceInvocation?.capabilityTitle ?? null,
    quotedAmount: marketplaceInvocation?.quotedAmount ?? null,
    priceCurrency: marketplaceInvocation?.priceCurrency ?? null,
    billingMode: marketplaceInvocation?.billingMode ?? null,
    billingUnit: marketplaceInvocation?.billingUnit ?? null,
    meterQuantity: marketplaceInvocation?.meterQuantity ?? null,
    managedTaskCategory: agent.managedTaskCategory ?? null,
    managedCapabilitySummary: agent.managedCapabilitySummary ?? null,
    routingSummary: capability.routingSummary ?? null,
    routingTags: (capability.routingTags as string[] | null) ?? [],
    inputSchema: (capability.inputSchema as Record<string, unknown> | null) ?? null,
    outputSchema: (capability.outputSchema as Record<string, unknown> | null) ?? null,
    inputResourcePayload: rawInputResourcePayload,
    normalizedResourcePayload: null as Record<string, unknown> | null,
  };
  const model = agent.managedModel?.trim() || "gpt-4.1-mini";

  try {
    let normalizedResourcePayload = templateArgs.inputResourcePayload;
    let normalizationUsageTotals: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

    if (capability.resourceNormalizationPrompt?.trim()) {
      const normalizationResult = await invokeManagedLightModel({
        endpoint,
        apiKey: resolvedServiceAccess?.apiKey || agent.managedApiKey,
        model,
        systemPrompt: capability.resourceNormalizationPrompt.trim(),
        userPrompt: [
          "请将原始输入资源整理成适合当前单任务 Agent 使用的 JSON 对象，只返回 JSON，不要输出解释。",
          `任务标题: ${capability.title}`,
          agent.managedTaskCategory?.trim() ? `任务类别: ${agent.managedTaskCategory.trim()}` : null,
          agent.managedCapabilitySummary?.trim() ? `能力短语: ${agent.managedCapabilitySummary.trim()}` : null,
          capability.routingSummary?.trim() ? `路由描述: ${capability.routingSummary.trim()}` : null,
          Array.isArray(capability.routingTags) && capability.routingTags.length > 0
            ? `路由标签: ${(capability.routingTags as string[]).join(", ")}`
            : null,
          `执行目标: ${execution.objective}`,
          `输入资源契约(JSON Schema):\n${safeJsonStringify(capability.inputSchema)}`,
          `输出资源契约(JSON Schema):\n${safeJsonStringify(capability.outputSchema)}`,
          `原始输入资源(JSON):\n${safeJsonStringify(templateArgs.inputResourcePayload)}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
      normalizationUsageTotals = normalizationResult.usageTotals;
      const normalizationSummary =
        truncateDispatchText(normalizationResult.text, 4000) ??
        truncateDispatchText(typeof normalizationResult.payload?.rawText === "string" ? normalizationResult.payload.rawText : null, 4000);
      if (!normalizationResult.response.ok) {
        const failureMessage = truncateDispatchText(
          `羽量 Agent 资源整理失败，状态 ${normalizationResult.response.status}.${normalizationSummary ? ` ${normalizationSummary}` : ""}`,
          4000,
        );
        await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
          status: "failed",
          statusNote: failureMessage ?? undefined,
          resultSummary: normalizationSummary ?? failureMessage ?? undefined,
        });
        return {
          state: "failed",
          message: failureMessage ?? "羽量 Agent 资源整理失败。",
          executionId: execution.id,
        };
      }
      normalizedResourcePayload =
        extractJsonObjectFromText(normalizationResult.text) ??
        toRecordPayload(normalizationResult.payload) ??
        {
          normalizedText: normalizationResult.text ?? normalizationSummary ?? "",
        };
    }

    const templateArgsWithNormalized = {
      ...templateArgs,
      normalizedResourcePayload,
    };
    const systemPrompt = agent.managedSystemPrompt?.trim()
      ? renderManagedPromptTemplate(agent.managedSystemPrompt.trim(), templateArgsWithNormalized)
      : null;
    const userPrompt = renderManagedPromptTemplate(userPromptTemplate, templateArgsWithNormalized);

    const completionResult = await invokeManagedLightModel({
      endpoint,
      apiKey: resolvedServiceAccess?.apiKey || agent.managedApiKey,
      model,
      systemPrompt,
      userPrompt,
    });

    const response = completionResult.response;
    const payload = completionResult.payload;
    const managedText = completionResult.text;
    const usageTotals = mergeManagedApiUsageTotals(normalizationUsageTotals, completionResult.usageTotals);
    const responseSummary =
      truncateDispatchText(managedText, 4000) ??
      truncateDispatchText(typeof payload?.rawText === "string" ? payload.rawText : null, 4000);

    if (!response.ok) {
      const failureMessage = truncateDispatchText(
        `Managed API invocation failed with status ${response.status}.${responseSummary ? ` ${responseSummary}` : ""}`,
        4000,
      );
      await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
        status: "failed",
        statusNote: failureMessage ?? `Managed API invocation failed with status ${response.status}.`,
        resultSummary: responseSummary ?? failureMessage ?? undefined,
      });
      return {
        state: "failed",
        message: failureMessage ?? `Managed API invocation failed with status ${response.status}.`,
        executionId: execution.id,
      };
    }

    if (marketplaceInvocation?.billingMode === "token_metered" && usageTotals) {
      const meterQuantity = resolveTokenMeterQuantity(usageTotals.totalTokens, marketplaceInvocation.billingUnit);
      const quotedAmount = Math.max(1, meterQuantity * marketplaceInvocation.unitPriceAmount);
      marketplaceInvocation.meterQuantity = meterQuantity;
      marketplaceInvocation.quotedAmount = quotedAmount;
    }

    const outputResourcePayload =
      extractJsonObjectFromText(managedText) ??
      {
        text: managedText ?? null,
        usage: usageTotals,
        rawResponse: payload ?? null,
      };
    await db
      .update(agentExecutions)
      .set({
        normalizedResourcePayload,
        outputResourcePayload,
        marketplaceInvocation: marketplaceInvocation ? toStoredMarketplaceInvocationSnapshot(marketplaceInvocation) : execution.marketplaceInvocation,
        updatedAt: now(),
      })
      .where(eq(agentExecutions.id, execution.id));

    const artifactSummary = managedText ?? JSON.stringify(payload ?? {}, null, 2);
    await addOwnedAgentExecutionArtifact(execution.ownerUserId, execution.id, {
      kind: "note",
      title: marketplaceInvocation?.publicTitle
        ? `${marketplaceInvocation.publicTitle} 输出`
        : `${agent.name} 托管输出`,
      summary:
        usageTotals && marketplaceInvocation?.billingMode === "token_metered"
          ? `${artifactSummary}\n\nusage: prompt=${usageTotals.promptTokens}, completion=${usageTotals.completionTokens}, total=${usageTotals.totalTokens}, billed_units=${marketplaceInvocation.meterQuantity}, quoted_amount=${marketplaceInvocation.quotedAmount}`
          : artifactSummary,
    });
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "completed",
      statusNote: "Managed API invocation completed successfully.",
      resultSummary: responseSummary ?? "Managed API invocation completed successfully.",
    });
    return {
      state: "completed",
      message: "Managed API invocation completed successfully.",
      executionId: execution.id,
    };
  } catch (error) {
    const failureMessage =
      error instanceof Error && error.name === "AbortError"
        ? "Managed API invocation timed out."
        : truncateDispatchText(error instanceof Error ? error.message : "Managed API invocation failed.") ??
          "Managed API invocation failed.";
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: failureMessage,
      resultSummary: failureMessage ?? undefined,
    });
    return {
      state: "failed",
      message: failureMessage,
      executionId: execution.id,
    };
  }
}

export function buildExternalRuntimeDispatchPayload(args: {
  execution: typeof agentExecutions.$inferSelect;
  agent: typeof agents.$inferSelect;
  capability?: typeof agentCapabilities.$inferSelect | null;
}) {
  if (!env.corePublicBaseUrl) {
    throw new ConflictError("CORE_PUBLIC_BASE_URL is required to dispatch external runtime executions");
  }
  const callbackBase = `${env.corePublicBaseUrl.replace(/\/+$/, "")}/external/agent-executions/${encodeURIComponent(args.execution.id)}`;
  return {
    dispatchVersion: 1,
    execution: {
      id: args.execution.id,
      ownerUserId: args.execution.ownerUserId,
      agentId: args.execution.agentId,
      capabilityId: args.execution.capabilityId,
      taskId: args.execution.taskId,
      title: args.execution.title,
      objective: args.execution.objective,
      inputResourcePayload: toRecordPayload(args.execution.inputResourcePayload),
      normalizedResourcePayload: toRecordPayload(args.execution.normalizedResourcePayload),
      marketplaceInvocation: toMarketplaceInvocationSnapshotView(args.execution.marketplaceInvocation),
    },
    capability: args.capability
      ? {
          id: args.capability.id,
          code: args.capability.code,
          title: args.capability.title,
          description: args.capability.description ?? null,
          routingSummary: args.capability.routingSummary ?? null,
          routingTags: (args.capability.routingTags as string[] | null) ?? [],
          inputSchema: (args.capability.inputSchema as Record<string, unknown> | null) ?? null,
          outputSchema: (args.capability.outputSchema as Record<string, unknown> | null) ?? null,
        }
      : null,
    agent: {
      id: args.agent.id,
      ownerUserId: args.agent.ownerUserId,
      name: args.agent.name,
      sourceType: args.agent.sourceType,
      hostingMode: args.agent.hostingMode,
      runtimeEndpoint: args.agent.runtimeEndpoint,
    },
    callback: {
      statusUrl: `${callbackBase}/status`,
      heartbeatUrl: `${callbackBase}/heartbeat`,
      artifactUrl: `${callbackBase}/artifacts`,
      eventUrl: callbackBase,
      secret: args.agent.externalCallbackSecret,
      version: args.agent.externalCallbackProtocolVersion,
      signatureAlgorithm: "hmac-sha256",
      headers: {
        secret: "x-external-agent-secret",
        callbackId: "x-external-callback-id",
        callbackTimestamp: "x-external-callback-timestamp",
        callbackVersion: "x-external-callback-version",
        callbackSignature: "x-external-callback-signature",
      },
    },
  };
}

export async function dispatchExternalRuntimeExecution(
  execution: typeof agentExecutions.$inferSelect,
  agent: typeof agents.$inferSelect,
): Promise<RuntimeDispatchResult> {
  const runtimeEndpoint = agent.runtimeEndpoint?.trim();
  if (!runtimeEndpoint) {
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: "External runtime endpoint is missing.",
      resultSummary: "External runtime endpoint is missing.",
    });
    return {
      state: "failed",
      message: "External runtime endpoint is missing.",
      executionId: execution.id,
    };
  }

  const claimResult = await db.transaction(async (tx) =>
    markExecutionDispatchRunning({
      tx,
      execution,
      note: "External runtime dispatcher forwarded the execution and is waiting for callback updates.",
    }),
  );

  if (!claimResult.claimed) {
    return {
      state: "running",
      message: "External runtime execution was already claimed by another dispatcher.",
      executionId: execution.id,
    };
  }

  const capability =
    execution.capabilityId != null
      ? (
          await db
            .select()
            .from(agentCapabilities)
            .where(eq(agentCapabilities.id, execution.capabilityId))
            .limit(1)
        )[0] ?? null
      : null;

  try {
    const { response, payload } = await requestInternalJson(
      runtimeEndpoint,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildRuntimeAuthHeaders(agent.authMode as "none" | "apiKey" | "bearer", agent.runtimeAuthToken),
        },
        body: JSON.stringify(
          buildExternalRuntimeDispatchPayload({
            execution,
            agent,
            capability,
          }),
        ),
      },
      {
        timeoutMs: externalRuntimeDispatchTimeoutMs,
        timeoutMessage: "External runtime dispatch timed out",
      },
    );
    if (!response.ok) {
      const failureMessage = truncateDispatchText(
        `External runtime dispatch failed with status ${response.status}.${typeof payload?.rawText === "string" ? ` ${payload.rawText}` : ""}`,
        4000,
      );
      await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
        status: "failed",
        statusNote: failureMessage ?? `External runtime dispatch failed with status ${response.status}.`,
        resultSummary: failureMessage ?? undefined,
      });
      return {
        state: "failed",
        message: failureMessage ?? `External runtime dispatch failed with status ${response.status}.`,
        executionId: execution.id,
      };
    }

    const artifacts = Array.isArray(payload?.artifacts) ? payload.artifacts : [];
    for (const artifact of artifacts) {
      if (!artifact || typeof artifact !== "object") continue;
      const title = typeof (artifact as { title?: unknown }).title === "string" ? (artifact as { title: string }).title : "";
      if (!title.trim()) continue;
      const kind = (artifact as { kind?: unknown }).kind === "link" ? "link" : "note";
      const urlValue = typeof (artifact as { url?: unknown }).url === "string" ? (artifact as { url: string }).url : null;
      const summaryValue =
        typeof (artifact as { summary?: unknown }).summary === "string"
          ? (artifact as { summary: string }).summary
          : null;
      await addOwnedAgentExecutionArtifact(execution.ownerUserId, execution.id, {
        kind,
        title,
        url: kind === "link" ? urlValue : null,
        summary: summaryValue,
      });
    }

    const runtimeStatus =
      typeof payload?.status === "string" &&
      ["running", "submitted", "completed", "failed", "cancelled"].includes(payload.status)
        ? (payload.status as AgentExecutionStatus)
        : "running";
    const resultSummary =
      typeof payload?.resultSummary === "string"
        ? truncateDispatchText(payload.resultSummary, 4000)
        : typeof payload?.summary === "string"
          ? truncateDispatchText(payload.summary, 4000)
          : null;
    const statusNote =
      typeof payload?.statusNote === "string"
        ? truncateDispatchText(payload.statusNote, 2000)
        : "External runtime accepted dispatch and should continue via callback updates.";

    if (runtimeStatus === "running") {
      return {
        state: "running",
        message: statusNote,
        executionId: execution.id,
      };
    }

    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: runtimeStatus,
      statusNote: statusNote ?? undefined,
      resultSummary: resultSummary ?? undefined,
    });
    return {
      state: runtimeStatus === "submitted" ? "running" : runtimeStatus,
      message: statusNote,
      executionId: execution.id,
    };
  } catch (error) {
    const failureMessage =
      error instanceof Error && error.name === "AbortError"
        ? "External runtime dispatch timed out."
        : truncateDispatchText(error instanceof Error ? error.message : "External runtime dispatch failed.") ??
          "External runtime dispatch failed.";
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "failed",
      statusNote: failureMessage,
      resultSummary: failureMessage ?? undefined,
    });
    return {
      state: "failed",
      message: failureMessage,
      executionId: execution.id,
    };
  }
}

export async function dispatchPendingExecutionById(executionId: string): Promise<RuntimeDispatchResult> {
  const row = await getDispatchableExecutionRow(executionId);
  if (!row) {
    throw new NotFoundError("Agent execution not found");
  }
  if (terminalExecutionStatuses.has(row.execution.status as AgentExecutionStatus)) {
    return {
      state: row.execution.status as RuntimeDispatchResult["state"],
      message: row.execution.statusNote,
      executionId,
    };
  }
  if (row.execution.status !== "queued") {
    return {
      state: row.execution.status === "submitted" ? "running" : (row.execution.status as RuntimeDispatchResult["state"]),
      message: row.execution.statusNote,
      executionId,
    };
  }
  if (!row.agent.enabled) {
    await updateOwnedAgentExecutionStatus(row.execution.ownerUserId, executionId, {
      status: "failed",
      statusNote: "Linked agent is disabled and cannot accept dispatch.",
      resultSummary: "Linked agent is disabled and cannot accept dispatch.",
    });
    return {
      state: "failed",
      message: "Linked agent is disabled and cannot accept dispatch.",
      executionId,
    };
  }

  if (isManagedLightExecutionHostingMode(row.agent.hostingMode as AgentHostingMode | null)) {
    return dispatchManagedApiExecution(row.execution, row.agent);
  }
  if ((row.agent.sourceType as AgentSourceType) === "external") {
    return dispatchExternalRuntimeExecution(row.execution, row.agent);
  }

  return {
    state: "queued",
    message: "Execution is handled by the platform runtime executor.",
    executionId,
  };
}

export async function runPendingDispatchableAgentExecutions(args?: {
  limit?: number;
  executionId?: string;
}) {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 50));
  const executionIds = args?.executionId
    ? [args.executionId]
    : (
        await db.execute(sql`
          select ae.id as execution_id
          from agent_executions ae
          inner join agents a on a.id = ae.agent_id
          where ae.status = 'queued'
            and a.enabled = true
            and (
              a.source_type = 'external'
              or coalesce(a.hosting_mode, 'registry_only') in ('managed_api', 'managed_light')
            )
          order by ae.created_at asc
          limit ${limit}
        `)
      ).rows.map((row) => String((row as { execution_id: string }).execution_id));

  const results: RuntimeDispatchResult[] = [];
  for (const executionId of executionIds) {
    results.push(await dispatchPendingExecutionById(executionId));
  }

  return {
    attemptedCount: executionIds.length,
    processedCount: results.filter((result) => result.state !== "queued").length,
    failedCount: results.filter((result) => result.state === "failed").length,
    results,
  };
}

export async function invokeAgentMarketplaceListing(
  consumerUserId: string,
  listingId: string,
  input: InvokeAgentMarketplaceListingInput,
): Promise<InvokeAgentMarketplaceListingResult> {
  const listingDetail = await getMarketplaceListingDetailById(listingId);
  if (!listingDetail) {
    throw new NotFoundError("Marketplace listing not found");
  }
  if (listingDetail.listing.status !== "published") {
    throw new ConflictError("Only published marketplace listings can be invoked");
  }
  if (!listingDetail.listing.externalInvocationEnabled) {
    throw new ConflictError("This marketplace listing does not allow direct invocation");
  }
  if (!listingDetail.agent.enabled || !listingDetail.capability.enabled) {
    throw new ConflictError("Linked agent or capability is unavailable");
  }

  const meterQuantity = normalizeMarketplaceMeterQuantity(input.meterQuantity ?? 1);
  const quotedAmount =
    listingDetail.listing.billingMode === "flat_task"
      ? listingDetail.listing.priceAmount
      : listingDetail.listing.priceAmount * meterQuantity;
  const invocationSnapshot: AgentMarketplaceInvocationSnapshotView = {
    listingId: listingDetail.listing.id,
    supplierUserId: listingDetail.agent.ownerUserId,
    capabilityId: listingDetail.capability.id,
    capabilityCode: listingDetail.capability.code,
    capabilityTitle: listingDetail.capability.title,
    publicTitle: listingDetail.listing.publicTitle,
    billingMode: listingDetail.listing.billingMode as AgentMarketplaceBillingMode,
    billingUnit: listingDetail.listing.billingUnit ?? null,
    meterKey: listingDetail.listing.meterKey ?? null,
    meterQuantity,
    priceCurrency: listingDetail.listing.priceCurrency as ProductCurrency,
    unitPriceAmount: listingDetail.listing.priceAmount,
    quotedAmount,
    invokedAt: now().toISOString(),
  };

  const createdExecution = await db.transaction((tx) =>
    createOwnedAgentExecutionInTx(tx, consumerUserId, {
      agentId: listingDetail.agent.id,
      capabilityId: listingDetail.capability.id,
      title: input.title.trim(),
      objective: input.objective.trim(),
      inputResourcePayload: input.inputResourcePayload ?? null,
      runtimeProfileKey: input.runtimeProfileKey ?? null,
      marketplaceInvocation: invocationSnapshot,
    }),
  );

  const dispatchResult = await dispatchPendingExecutionById(createdExecution.id);
  return {
    execution: await getAgentExecutionViewById(createdExecution.id),
    dispatchState: dispatchResult.state,
    dispatchMessage: dispatchResult.message,
  };
}
