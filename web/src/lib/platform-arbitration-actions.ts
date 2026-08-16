"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import type { ArbitrationEvidenceKind, ArbitrationStatus, ArbitrationTaskResolutionAction } from "@neuro/contracts";
import { claimNextArbitrationCase } from "@/lib/core-client";
import { arbitrationClient } from "@/lib/arbitration-core-client";
import {
  arbitrationStatuses,
  buildArbitrationsRedirect,
  readArbitrationsFollowUp,
  statusLabel,
  taskResolutionOptions,
  type ArbitrationsFollowUp,
} from "@/lib/arbitration-presentation";
import { requirePlatformOperatorUserContext, requirePlatformUserContext } from "@/lib/platform-session";

function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function redirectArbitrationActionUnavailable(args: {
  message: string;
  followUp?: ArbitrationsFollowUp;
}): never {
  redirect(
    buildArbitrationsRedirect({
      status: "error",
      message: args.message,
      ...(args.followUp ?? {}),
    }),
  );
}

export async function createArbitrationCaseAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const createArbitrationCase = arbitrationClient.createArbitrationCase;
  if (!createArbitrationCase) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用创建仲裁操作。",
      followUp,
    });
  }

  const entityId = String(formData.get("taskId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const evidenceSummary = String(formData.get("evidenceSummary") || "").trim();

  if (!entityId || !reason) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: "仲裁参数无效，请选择任务并填写理由。",
        ...followUp,
      }),
    );
  }

  try {
    await createArbitrationCase(userContext, {
      entityType: "task",
      entityId,
      reason,
      evidenceSummary: evidenceSummary || undefined,
    });
    redirect(
      buildArbitrationsRedirect({
        status: "success",
        message: "仲裁案件已创建。",
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "仲裁案件创建失败，请稍后重试。");
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function updateArbitrationCaseStatusAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const updateArbitrationCaseStatus = arbitrationClient.updateArbitrationCaseStatus;
  if (!updateArbitrationCaseStatus) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用仲裁状态更新。",
      followUp,
    });
  }

  const caseId = String(formData.get("caseId") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const resolutionSummary = String(formData.get("resolutionSummary") || "").trim();
  const taskResolutionAction = String(formData.get("taskResolutionAction") || "none").trim();
  if (!caseId || !arbitrationStatuses.includes(status as Exclude<ArbitrationStatus, "open">)) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: "仲裁状态参数无效。",
        ...followUp,
      }),
    );
  }

  try {
    await updateArbitrationCaseStatus(userContext, caseId, {
      status: status as Exclude<ArbitrationStatus, "open">,
      resolutionSummary: resolutionSummary || undefined,
      taskResolutionAction:
        status === "resolved" && taskResolutionOptions.some((option) => option.value === taskResolutionAction)
          ? (taskResolutionAction as ArbitrationTaskResolutionAction)
          : undefined,
    });
    redirect(
      buildArbitrationsRedirect({
        status: "success",
        message: `案件状态已更新为 ${statusLabel[status as ArbitrationStatus]}。`,
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "仲裁状态更新失败，请稍后重试。");
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function addArbitrationEvidenceAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const addArbitrationEvidence = arbitrationClient.addArbitrationEvidence;
  if (!addArbitrationEvidence) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用仲裁证据提交。",
      followUp,
    });
  }

  const caseId = String(formData.get("caseId") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const url = String(formData.get("url") || "").trim();

  if (!caseId || !title || !kind) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: "证据参数无效，请填写证据类型和标题。",
        ...followUp,
      }),
    );
  }

  try {
    await addArbitrationEvidence(userContext, caseId, {
      kind: kind as ArbitrationEvidenceKind,
      title,
      content: content || undefined,
      url: url || undefined,
    });
    redirect(
      buildArbitrationsRedirect({
        status: "success",
        message: "仲裁证据已补充。",
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "仲裁证据提交失败，请稍后重试。");
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function claimArbitrationCaseAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const claimArbitrationCase = arbitrationClient.claimArbitrationCase;
  if (!claimArbitrationCase) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用仲裁认领操作。",
      followUp,
    });
  }

  const caseId = String(formData.get("caseId") || "").trim();
  if (!caseId) {
    redirect(buildArbitrationsRedirect({ status: "error", message: "案件参数无效。", ...followUp }));
  }

  try {
    await claimArbitrationCase(userContext, caseId);
    redirect(buildArbitrationsRedirect({ status: "success", message: "案件已认领。", ...followUp }));
  } catch (error) {
    redirect(buildArbitrationsRedirect({ status: "error", message: toMessage(error, "案件认领失败。"), ...followUp }));
  }
}

export async function claimNextArbitrationCaseAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);

  try {
    const claimed = await claimNextArbitrationCase(userContext);
    redirect(
      buildArbitrationsRedirect({
        status: "success",
        message: claimed ? `已认领下一条案件：${claimed.id}` : "当前没有可认领的案件。",
        ...followUp,
      }),
    );
  } catch (error) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: toMessage(error, "认领下一条案件失败。"),
        ...followUp,
      }),
    );
  }
}

export async function releaseArbitrationCaseAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const releaseArbitrationCase = arbitrationClient.releaseArbitrationCase;
  if (!releaseArbitrationCase) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用仲裁释放操作。",
      followUp,
    });
  }

  const caseId = String(formData.get("caseId") || "").trim();
  if (!caseId) {
    redirect(buildArbitrationsRedirect({ status: "error", message: "案件参数无效。", ...followUp }));
  }

  try {
    await releaseArbitrationCase(userContext, caseId);
    redirect(buildArbitrationsRedirect({ status: "success", message: "案件已释放。", ...followUp }));
  } catch (error) {
    redirect(buildArbitrationsRedirect({ status: "error", message: toMessage(error, "案件释放失败。"), ...followUp }));
  }
}

export async function assignArbitrationCaseAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const assignArbitrationCase = arbitrationClient.assignArbitrationCase;
  if (!assignArbitrationCase) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用仲裁派单操作。",
      followUp,
    });
  }

  const caseId = String(formData.get("caseId") || "").trim();
  const assigneeUserId = String(formData.get("assigneeUserId") || "").trim();
  if (!caseId || !assigneeUserId) {
    redirect(buildArbitrationsRedirect({ status: "error", message: "案件派单参数无效。", ...followUp }));
  }

  try {
    await assignArbitrationCase(userContext, caseId, { assigneeUserId });
    redirect(
      buildArbitrationsRedirect({
        status: "success",
        message: `案件已派给 ${assigneeUserId}。`,
        ...followUp,
      }),
    );
  } catch (error) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: toMessage(error, "案件派单失败。"),
        ...followUp,
      }),
    );
  }
}

export async function releaseStaleArbitrationCasesAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const releaseStaleArbitrationCases = arbitrationClient.releaseStaleArbitrationCases;
  if (!releaseStaleArbitrationCases) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用仲裁超时释放。",
      followUp,
    });
  }

  const limit = Number(formData.get("limit") || 20);

  try {
    const response = await releaseStaleArbitrationCases(userContext, {
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20,
    });
    redirect(
      buildArbitrationsRedirect({
        status: "success",
        message: `已释放 ${response.result.releasedCount} 条 stale 案件。`,
        ...followUp,
      }),
    );
  } catch (error) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: toMessage(error, "释放 stale 仲裁案件失败。"),
        ...followUp,
      }),
    );
  }
}

export async function cleanupRemoteArbitrationAttachmentsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const cleanupResolvedRemoteArbitrationAttachments = arbitrationClient.cleanupResolvedRemoteArbitrationAttachments;
  if (!cleanupResolvedRemoteArbitrationAttachments) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用远程附件清理。",
      followUp,
    });
  }

  const limit = Number(formData.get("limit") || 20);

  try {
    const response = await cleanupResolvedRemoteArbitrationAttachments(userContext, {
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20,
    });
    redirect(
      buildArbitrationsRedirect({
        status: "success",
        message: `远程附件清理完成：${response.result.archivedCount}/${response.result.scannedCount} 已归档。`,
        ...followUp,
      }),
    );
  } catch (error) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: toMessage(error, "远程仲裁附件清理失败。"),
        ...followUp,
      }),
    );
  }
}

export async function archiveArbitrationAttachmentAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const archiveArbitrationEvidenceAttachment = arbitrationClient.archiveArbitrationEvidenceAttachment;
  if (!archiveArbitrationEvidenceAttachment) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用远程附件归档。",
      followUp,
    });
  }

  const attachmentId = String(formData.get("attachmentId") || "").trim();
  if (!attachmentId) {
    redirect(buildArbitrationsRedirect({ status: "error", message: "附件参数无效。", ...followUp }));
  }

  try {
    await archiveArbitrationEvidenceAttachment(userContext, attachmentId);
    redirect(buildArbitrationsRedirect({ status: "success", message: "远程附件已归档。", ...followUp }));
  } catch (error) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: toMessage(error, "远程附件归档失败。"),
        ...followUp,
      }),
    );
  }
}

export async function requestArbitrationAttachmentCleanupAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const requestCleanup = arbitrationClient.requestArbitrationEvidenceAttachmentCleanup;
  if (!requestCleanup) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用远程附件清理请求。",
      followUp,
    });
  }

  const attachmentId = String(formData.get("attachmentId") || "").trim();
  if (!attachmentId) {
    redirect(buildArbitrationsRedirect({ status: "error", message: "附件参数无效。", ...followUp }));
  }

  try {
    await requestCleanup(userContext, attachmentId);
    redirect(buildArbitrationsRedirect({ status: "success", message: "远程附件已加入清理队列。", ...followUp }));
  } catch (error) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: toMessage(error, "远程附件清理请求失败。"),
        ...followUp,
      }),
    );
  }
}

export async function advanceArbitrationReviewRoundAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readArbitrationsFollowUp(formData);
  const advanceReviewRound = arbitrationClient.advanceArbitrationReviewRound;
  if (!advanceReviewRound) {
    redirectArbitrationActionUnavailable({
      message: "当前环境未启用仲裁轮次推进。",
      followUp,
    });
  }

  const caseId = String(formData.get("caseId") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const assignToOperatorUserId = String(formData.get("assignToOperatorUserId") || "").trim();
  if (!caseId) {
    redirect(buildArbitrationsRedirect({ status: "error", message: "案件参数无效。", ...followUp }));
  }

  try {
    await advanceReviewRound(userContext, caseId, {
      summary: summary || undefined,
      assignToOperatorUserId: assignToOperatorUserId || undefined,
    });
    redirect(buildArbitrationsRedirect({ status: "success", message: "已推进到下一轮审理。", ...followUp }));
  } catch (error) {
    redirect(
      buildArbitrationsRedirect({
        status: "error",
        message: toMessage(error, "推进下一轮审理失败。"),
        ...followUp,
      }),
    );
  }
}
