"use server";

import { redirect } from "next/navigation";

import {
  invokeAgentMarketplaceListing,
  runAgentMarketplaceAutoProposalSweep,
  updateAgentMarketplaceListingStatus,
  upsertAgentMarketplaceListing,
} from "@/lib/platform-client";
import {
  buildStatusRedirect,
  parseOptionalJsonRecord,
  resolveRedirectPath,
  setRedirectTargetQueryParams,
  toMessage,
} from "@/lib/platform-action-utils";
import { requirePlatformUserContext } from "@/lib/platform-session";

type AgentRuntimeProfileKey = "baseline" | "iterative" | "deep_runtime";

function parseRuntimeProfileKey(formData: FormData) {
  const raw = String(formData.get("runtimeProfileKey") || "").trim();
  return raw ? (raw as AgentRuntimeProfileKey) : null;
}

function parseMeterQuantity(formData: FormData) {
  const raw = Number(formData.get("meterQuantity") || 1);
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1;
}

export async function upsertAgentMarketplaceListingAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  try {
    const listing = await upsertAgentMarketplaceListing(userContext, {
      capabilityId: String(formData.get("capabilityId") || "").trim(),
      publicTitle: String(formData.get("publicTitle") || "").trim(),
      publicDescription: String(formData.get("publicDescription") || "").trim() || null,
      billingMode: (String(formData.get("billingMode") || "flat_task") as
        | "flat_task"
        | "token_metered"
        | "property_metered"),
      billingUnit: String(formData.get("billingUnit") || "").trim() || null,
      meterKey: String(formData.get("meterKey") || "").trim() || null,
      priceCurrency: String(formData.get("priceCurrency") || "obsidian").trim() as "obsidian" | "mira",
      priceAmount: Math.max(1, Number(formData.get("priceAmount") || 0) || 0),
      status: String(formData.get("status") || "draft").trim() as "draft" | "published" | "paused",
      externalInvocationEnabled: String(formData.get("externalInvocationEnabled") || "false") === "true",
      autoTakeEnabled: String(formData.get("autoTakeEnabled") || "false") === "true",
      autoTakeStatementTemplate: String(formData.get("autoTakeStatementTemplate") || "").trim() || null,
    });
    redirect(
      buildStatusRedirect(
        setRedirectTargetQueryParams(redirectTo, { listingId: listing.id }),
        "success",
        "Agent 供给已保存。",
      ),
    );
  } catch (error) {
    const message = toMessage(error, "Agent 供给保存失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function updateAgentMarketplaceListingStatusAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const listingId = String(formData.get("listingId") || "").trim();
  const status = String(formData.get("status") || "").trim() as "draft" | "published" | "paused";
  if (!listingId || !["draft", "published", "paused"].includes(status)) {
    redirect(buildStatusRedirect(redirectTo, "error", "Agent 供给状态参数无效。"));
  }

  try {
    await updateAgentMarketplaceListingStatus(userContext, listingId, { status });
    redirect(buildStatusRedirect(redirectTo, "success", "Agent 供给状态已更新。"));
  } catch (error) {
    const message = toMessage(error, "Agent 供给状态更新失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function runAgentMarketplaceAutoProposalSweepAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const rawLimit = Number(formData.get("limit") || 20);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20, 100));
  try {
    const result = await runAgentMarketplaceAutoProposalSweep(userContext, limit);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `自动提案扫描完成：扫描 ${result.scannedListingCount} 个供给，创建 ${result.createdProposalCount} 条提案。`,
      ),
    );
  } catch (error) {
    const message = toMessage(error, "自动提案扫描失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function invokeAgentMarketplaceListingAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const listingId = String(formData.get("listingId") || "").trim();
  if (!listingId) {
    redirect(buildStatusRedirect(redirectTo, "error", "供给参数无效。"));
  }

  try {
    const result = await invokeAgentMarketplaceListing(userContext, listingId, {
      title: String(formData.get("title") || "").trim(),
      objective: String(formData.get("objective") || "").trim(),
      inputResourcePayload: parseOptionalJsonRecord(formData.get("inputResourcePayload"), "输入资源"),
      meterQuantity: parseMeterQuantity(formData),
      runtimeProfileKey: parseRuntimeProfileKey(formData),
    });
    redirect(
      buildStatusRedirect(
        setRedirectTargetQueryParams(redirectTo, { executionId: result.execution.id }),
        "success",
        result.dispatchMessage
          ? `Agent 已受理：${result.dispatchMessage}`
          : `Agent 已受理，执行单 ${result.execution.title} 已创建。`,
      ),
    );
  } catch (error) {
    const message = toMessage(error, "Agent 直接调用失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function invokeAgentMarketplaceListingBatchAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agents");
  const successRedirectTo = resolveRedirectPath(formData.get("successRedirectTo"), redirectTo);
  const listingIds = Array.from(
    new Set(
      formData
        .getAll("listingIds")
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);
  const objective = String(formData.get("objective") || "").trim();
  const batchTitle = String(formData.get("title") || "").trim() || "多 Agent 批次调用";
  const meterQuantity = parseMeterQuantity(formData);
  const runtimeProfileKey = parseRuntimeProfileKey(formData);

  if (!objective) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先填写批次调用目标。"));
  }
  if (listingIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请至少选择一条可直调供给。"));
  }

  const createdExecutionIds: string[] = [];
  const failures: string[] = [];

  for (const [index, listingId] of listingIds.entries()) {
    try {
      const result = await invokeAgentMarketplaceListing(userContext, listingId, {
        title: `${batchTitle} · ${index + 1}`,
        objective,
        inputResourcePayload: parseOptionalJsonRecord(formData.get("inputResourcePayload"), "输入资源"),
        meterQuantity,
        runtimeProfileKey,
      });
      createdExecutionIds.push(result.execution.id);
    } catch (error) {
      failures.push(`${listingId}: ${toMessage(error, "调用失败")}`);
    }
  }

  if (createdExecutionIds.length === 0) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        failures.length > 0 ? `批次调用失败：${failures[0]}` : "批次调用失败，请稍后重试。",
      ),
    );
  }

  const executionRedirectTarget = setRedirectTargetQueryParams(successRedirectTo, {
    executionId: createdExecutionIds[0] ?? null,
    executionIds: createdExecutionIds.join(","),
  });
  const failureSuffix = failures.length > 0 ? `；另有 ${failures.length} 条供给未成功转发。` : "";
  redirect(
    buildStatusRedirect(
      executionRedirectTarget,
      "success",
      `批次调用已创建 ${createdExecutionIds.length} 条 execution${failureSuffix}`,
    ),
  );
}
