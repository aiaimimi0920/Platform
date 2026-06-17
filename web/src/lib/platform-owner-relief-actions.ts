"use server";

import { redirect } from "next/navigation";

import {
  clearOperatorAgentExecutionOwnerReliefHandoffDefault,
  finalizeOperatorAgentExecutionOwnerReliefRun,
  openOperatorAgentExecutionOwnerReliefRunHandoff,
  reopenOperatorAgentExecutionOwnerReliefRun,
  resolveOperatorAgentExecutionOwnerReliefRunHandoff,
  saveOperatorAgentExecutionOwnerReliefHandoffDefault,
} from "@/lib/account-client";
import {
  buildAgentCallbackOpsRedirect,
  parseOwnerReliefRunHandoffFocusSection,
  parseOwnerReliefRunHandoffFollowUpProfile,
  parseOwnerReliefRunHandoffTargetType,
  parseOwnerReliefRunResultStatus,
  readAgentCallbackOpsFollowUp,
  readOwnerReliefAction,
  readOwnerReliefRunId,
} from "@/lib/platform-agent-callback-ops-action-utils";
import { buildStatusRedirect, resolveRedirectPath, toMessage } from "@/lib/platform-action-utils";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";

export async function saveAgentExecutionOwnerReliefHandoffDefaultAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const handoffTargetType = parseOwnerReliefRunHandoffTargetType(formData.get("handoffTargetType"));
  const handoffTarget = String(formData.get("handoffTarget") || "").trim();
  const noteTemplate = String(formData.get("noteTemplate") || "").trim() || null;
  const followUpFocusSection = parseOwnerReliefRunHandoffFocusSection(formData.get("followUpFocusSection"));
  const followUpProfile = parseOwnerReliefRunHandoffFollowUpProfile(formData.get("followUpProfile"));

  if (!handoffTargetType || !handoffTarget) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少 owner relief handoff default 的目标类型或默认目标。"));
  }

  try {
    const profile = await saveOperatorAgentExecutionOwnerReliefHandoffDefault(userContext, {
      handoffTargetType,
      handoffTarget,
      noteTemplate,
      followUpFocusSection,
      followUpProfile,
    });
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `已保存 ${profile.handoffTargetType} 的 owner relief handoff default。`,
      ),
    );
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "保存 owner relief handoff default 失败，请稍后重试。"),
      ),
    );
  }
}

export async function clearAgentExecutionOwnerReliefHandoffDefaultAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const handoffTargetType = parseOwnerReliefRunHandoffTargetType(formData.get("handoffTargetType"));

  if (!handoffTargetType) {
    redirect(buildStatusRedirect(redirectTo, "error", "缺少待清除的 owner relief handoff default 类型。"));
  }

  try {
    await clearOperatorAgentExecutionOwnerReliefHandoffDefault(userContext, handoffTargetType);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `已清除 ${handoffTargetType} 的 owner relief handoff default。`,
      ),
    );
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "清除 owner relief handoff default 失败，请稍后重试。"),
      ),
    );
  }
}

export async function openAgentExecutionOwnerReliefRunHandoffAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  const ownerReliefRunId = readOwnerReliefRunId(formData);
  const fallbackRedirect = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUpHref = resolveRedirectPath(formData.get("handoffFollowUpHref"), fallbackRedirect);

  if (!ownerReliefRunId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 owner relief run，无法打开 handoff follow-up。",
        ...followUp,
        ownerReliefAction,
      }),
    );
  }

  try {
    const handoff = await openOperatorAgentExecutionOwnerReliefRunHandoff(userContext, ownerReliefRunId, {
      followUpHref,
    });
    redirect(
      buildStatusRedirect(
        followUpHref,
        "success",
        `已打开 owner relief handoff：${handoff.handoffTargetType}${handoff.handoffTarget ? ` / ${handoff.handoffTarget}` : ""}。`,
      ),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "打开 owner relief handoff follow-up 失败，请稍后重试。"),
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
}

export async function resolveAgentExecutionOwnerReliefHandoffAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  const ownerReliefRunId = readOwnerReliefRunId(formData);
  const note = String(formData.get("ownerReliefHandoffResultNote") || "").trim() || null;

  if (!ownerReliefRunId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 owner relief run，无法结案 handoff follow-up。",
        ...followUp,
        ownerReliefAction,
      }),
    );
  }

  try {
    const handoff = await resolveOperatorAgentExecutionOwnerReliefRunHandoff(userContext, ownerReliefRunId, {
      note,
    });
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message:
          `已将 owner relief handoff 标记为 resolved：${handoff.handoffTargetType}` +
          `${handoff.resultNote ? ` / ${handoff.resultNote}` : ""}。`,
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "结案 owner relief handoff 失败，请稍后重试。"),
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
}

export async function finalizeAgentExecutionOwnerReliefRunAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  const ownerReliefRunId = readOwnerReliefRunId(formData);
  const resultStatus = parseOwnerReliefRunResultStatus(formData.get("ownerReliefRunResultStatus"));
  const note = String(formData.get("ownerReliefRunResultNote") || "").trim() || null;
  const handoffTargetType = parseOwnerReliefRunHandoffTargetType(
    formData.get("ownerReliefRunHandoffTargetType"),
  );
  const handoffTarget = String(formData.get("ownerReliefRunHandoffTarget") || "").trim() || null;

  if (!ownerReliefRunId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "当前没有可结案的 owner relief run。",
        ...followUp,
        ownerReliefAction,
      }),
    );
  }
  if (!resultStatus) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "请选择有效的 owner relief closeout 结果。",
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
  if (resultStatus === "handed_off" && !handoffTargetType) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "结案为 handed off 时必须选择 handoff target type。",
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
  try {
    const run = await finalizeOperatorAgentExecutionOwnerReliefRun(userContext, ownerReliefRunId, {
      resultStatus,
      note,
      handoffTargetType,
      handoffTarget,
    });
    const resultLabel =
      resultStatus === "handed_off"
        ? `handed off (${handoffTargetType}${handoffTarget ? ` / ${handoffTarget}` : ""})`
        : resultStatus;
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `Owner relief run 已结案为 ${resultLabel}。最近结果：recovered ${run.latestSummary.recoveredCount} / processed ${run.latestSummary.processedCount} / failed ${run.latestSummary.failedCount}。`,
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId: run.id,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "结案 owner relief run 失败，请稍后重试。"),
        ...followUp,
        ownerReliefAction,
        ownerReliefRunId,
      }),
    );
  }
}

export async function reopenAgentExecutionOwnerReliefRunAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const ownerReliefRunId = readOwnerReliefRunId(formData);

  if (!ownerReliefRunId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "当前没有可复开的 owner relief run。",
        ...followUp,
      }),
    );
  }

  try {
    const run = await reopenOperatorAgentExecutionOwnerReliefRun(userContext, ownerReliefRunId);
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已复开 owner relief run ${run.id}${run.reopenedFromRunId ? `，来源 ${run.reopenedFromRunId}` : ""}。`,
        ...followUp,
        ownerReliefRunId: run.id,
        fragment: "runtime-session-watch",
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "复开 owner relief run 失败，请稍后重试。"),
        ...followUp,
        ownerReliefRunId,
        fragment: "runtime-session-watch",
      }),
    );
  }
}
