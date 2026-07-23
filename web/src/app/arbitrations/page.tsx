import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import type {
  ArbitrationCaseView,
  ArbitrationCaseSummaryView,
  ArbitrationRemoteAttachmentCleanupQueueView,
  ArbitrationEvidenceKind,
  ArbitrationStatus,
  ArbitrationTaskResolutionAction,
  ArbitrationWorkloadView,
  CreateArbitrationEvidenceInput,
  InternalUserContext,
  TaskView,
  UpdateArbitrationCaseStatusInput,
} from "@neuro/contracts";
import { auth } from "@/auth";
import { PreparedAttachmentUpload } from "@/components/arbitration/prepared-attachment-upload";
import { DependencyState } from "@/components/dependency-state";
import { Badge } from "@/components/ui/badge";
import { Card, Panel } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  combineDependencyResults,
  createDependencyFailureResult,
  createDependencyResult,
  type DependencyResult,
} from "@/lib/dependency-result";
import * as coreClient from "@/lib/core-client";
import {
  claimNextArbitrationCase,
  getArbitrationCaseWorkload,
  getArbitrationRemoteAttachmentCleanupQueue,
  getFeatureSnapshot,
  getPublicSurfaceSnapshotStrict,
  isFeatureSnapshotUnavailable,
  listTasks,
} from "@/lib/core-client";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext, requirePlatformUserContext } from "@/lib/platform-session";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

type ArbitrationsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    caseStatus?: string;
    taskResolutionAction?: string;
    impact?: string;
    evidenceKind?: string;
    hasEvidence?: string;
    assignment?: string;
  }>;
};

type ArbitrationCoreClient = {
  listArbitrationCases?: (userContext: InternalUserContext) => Promise<ArbitrationCaseView[]>;
  createArbitrationCase?: (
    userContext: InternalUserContext,
    input: {
      entityType: "task";
      entityId: string;
      reason: string;
      evidenceSummary?: string | null;
    },
  ) => Promise<ArbitrationCaseView>;
  updateArbitrationCaseStatus?: (
    userContext: InternalUserContext,
    caseId: string,
    input: UpdateArbitrationCaseStatusInput,
  ) => Promise<ArbitrationCaseView>;
  addArbitrationEvidence?: (
    userContext: InternalUserContext,
    caseId: string,
    input: CreateArbitrationEvidenceInput,
  ) => Promise<ArbitrationCaseView>;
  claimArbitrationCase?: (userContext: InternalUserContext, caseId: string) => Promise<ArbitrationCaseView>;
  releaseArbitrationCase?: (userContext: InternalUserContext, caseId: string) => Promise<ArbitrationCaseView>;
  assignArbitrationCase?: (
    userContext: InternalUserContext,
    caseId: string,
    input: { assigneeUserId: string },
  ) => Promise<ArbitrationCaseView>;
  advanceArbitrationReviewRound?: (
    userContext: InternalUserContext,
    caseId: string,
    input: { summary?: string | null; assignToOperatorUserId?: string | null },
  ) => Promise<ArbitrationCaseView>;
  getArbitrationCaseSummary?: (userContext: InternalUserContext) => Promise<ArbitrationCaseSummaryView>;
  getArbitrationCaseWorkload?: (userContext: InternalUserContext) => Promise<ArbitrationWorkloadView>;
  getArbitrationRemoteAttachmentCleanupQueue?: (
    userContext: InternalUserContext,
    args?: { limit?: number },
  ) => Promise<ArbitrationRemoteAttachmentCleanupQueueView>;
  claimNextArbitrationCase?: (userContext: InternalUserContext) => Promise<ArbitrationCaseView | null>;
  archiveArbitrationEvidenceAttachment?: (
    userContext: InternalUserContext,
    attachmentId: string,
  ) => Promise<ArbitrationCaseView>;
  requestArbitrationEvidenceAttachmentCleanup?: (
    userContext: InternalUserContext,
    attachmentId: string,
  ) => Promise<ArbitrationCaseView>;
  releaseStaleArbitrationCases?: (
    userContext: InternalUserContext,
    input?: { limit?: number },
  ) => Promise<{ result: { scannedCount: number; releasedCount: number; caseIds: string[] } }>;
  cleanupResolvedRemoteArbitrationAttachments?: (
    userContext: InternalUserContext,
    input?: { limit?: number },
  ) => Promise<{
    result: {
      scannedCount: number;
      archivedCount: number;
      failedCount: number;
      failures: Array<{ attachmentId: string; message: string }>;
    };
  }>;
};

const arbitrationClient = coreClient as unknown as ArbitrationCoreClient;
const arbitrationStatuses: Exclude<ArbitrationStatus, "open">[] = ["under_review", "resolved", "rejected"];
const arbitrationStatusOptions: ArbitrationStatus[] = ["open", ...arbitrationStatuses];
const taskResolutionOptions: { value: ArbitrationTaskResolutionAction; label: string }[] = [
  { value: "none", label: "仅结案，不改任务状态" },
  { value: "accept", label: "裁定验收通过并放款" },
  { value: "default", label: "裁定违约并退款/扣罚" },
  { value: "cancel", label: "裁定取消并退回托管" },
];

function toLocaleDateTime(value: string | null | undefined) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString("zh-CN");
}

const statusLabel: Record<ArbitrationStatus, string> = {
  open: "待受理",
  under_review: "审理中",
  resolved: "已裁决",
  rejected: "已驳回",
};

const statusVariant: Record<ArbitrationStatus, "warning" | "cyan" | "success" | "danger"> = {
  open: "warning",
  under_review: "cyan",
  resolved: "success",
  rejected: "danger",
};

type ArbitrationImpact = "favorable" | "unfavorable" | "neutral";
const reputationImpactLabel: Record<ArbitrationImpact, string> = {
  favorable: "信誉友好",
  unfavorable: "信誉不利",
  neutral: "信誉中立",
};
const reputationImpactVariant: Record<ArbitrationImpact, "success" | "danger" | "warning"> = {
  favorable: "success",
  unfavorable: "danger",
  neutral: "warning",
};
type ArbitrationCaseWithImpact = ArbitrationCaseView & {
  reputationImpactForViewer?: ArbitrationImpact;
};

const evidenceKindLabel: Record<ArbitrationEvidenceKind, string> = {
  text_note: "文字说明",
  external_link: "外部链接",
  log_excerpt: "日志摘录",
  screenshot_ref: "截图引用",
};

function formatTaskResolutionAction(value: string) {
  return taskResolutionOptions.find((option) => option.value === value)?.label ?? "自定义裁定动作";
}

function formatReputationImpact(value: string) {
  return value in reputationImpactLabel ? reputationImpactLabel[value as ArbitrationImpact] : "自定义信誉影响";
}

function formatEvidenceKind(value: string) {
  return value in evidenceKindLabel ? evidenceKindLabel[value as ArbitrationEvidenceKind] : "自定义证据类型";
}

function formatArbitrationEntityType(value: string) {
  switch (value) {
    case "task":
      return "任务";
    default:
      return "自定义对象";
  }
}

function formatArbitrationStatus(value: string) {
  return value in statusLabel ? statusLabel[value as ArbitrationStatus] : "自定义状态";
}

function formatReviewRoundStatus(value: string) {
  switch (value) {
    case "open":
      return "审理中";
    case "completed":
      return "已完成";
    default:
      return "自定义轮次状态";
  }
}

function formatStorageMode(value: string) {
  switch (value) {
    case "local":
      return "本地保存";
    case "remote":
      return "远程保存";
    default:
      return "自定义存储";
  }
}

function formatRemoteUploadStrategy(value: string) {
  switch (value) {
    case "local_filesystem":
      return "本地文件系统";
    case "server_proxy_put":
      return "服务端代理上传";
    case "prepared_remote_put":
      return "预签名直传";
    default:
      return "自定义上传方式";
  }
}

function formatUploadState(value: string) {
  switch (value) {
    case "prepared":
      return "待上传";
    case "uploaded":
      return "已上传";
    case "archived":
      return "已归档";
    default:
      return "自定义上传状态";
  }
}

function formatRemoteConfigState(enabled: boolean, enabledLabel: string, disabledLabel: string) {
  return enabled ? enabledLabel : disabledLabel;
}

function formatCleanupRequestState(cleanupRequestedAt: string | null | undefined) {
  return cleanupRequestedAt ? "已请求清理" : "继续保留";
}

function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatBucketList(buckets: Array<{ key: string; count: number }>, formatKey: (key: string) => string = (key) => key) {
  if (buckets.length === 0) return "暂无";
  return buckets.map((bucket) => `${formatKey(bucket.key)} (${bucket.count})`).join(" / ");
}

function renderArbitrationFollowUpFields(args: {
  caseStatus?: string | null;
  taskResolutionAction?: string | null;
  impact?: string | null;
  evidenceKind?: string | null;
  hasEvidence?: string | null;
  assignment?: string | null;
}) {
  return (
    <>
      {args.caseStatus ? <input type="hidden" name="followUpCaseStatus" value={args.caseStatus} /> : null}
      {args.taskResolutionAction ? (
        <input type="hidden" name="followUpTaskResolutionAction" value={args.taskResolutionAction} />
      ) : null}
      {args.impact ? <input type="hidden" name="followUpImpact" value={args.impact} /> : null}
      {args.evidenceKind ? <input type="hidden" name="followUpEvidenceKind" value={args.evidenceKind} /> : null}
      {args.hasEvidence ? <input type="hidden" name="followUpHasEvidence" value={args.hasEvidence} /> : null}
      {args.assignment ? <input type="hidden" name="followUpAssignment" value={args.assignment} /> : null}
    </>
  );
}

function buildArbitrationsRedirect(args: {
  status: "success" | "error";
  message: string;
  caseStatus?: string | null;
  taskResolutionAction?: string | null;
  impact?: string | null;
  evidenceKind?: string | null;
  hasEvidence?: string | null;
  assignment?: string | null;
}) {
  const params = new URLSearchParams({
    status: args.status,
    message: args.message,
  });
  if (args.caseStatus) params.set("caseStatus", args.caseStatus);
  if (args.taskResolutionAction) params.set("taskResolutionAction", args.taskResolutionAction);
  if (args.impact) params.set("impact", args.impact);
  if (args.evidenceKind) params.set("evidenceKind", args.evidenceKind);
  if (args.hasEvidence) params.set("hasEvidence", args.hasEvidence);
  if (args.assignment) params.set("assignment", args.assignment);
  return `/ops/account/arbitrations?${params.toString()}`;
}

function redirectArbitrationActionUnavailable(args: {
  message: string;
  followUp?: ReturnType<typeof readArbitrationsFollowUp>;
}): never {
  redirect(
    buildArbitrationsRedirect({
      status: "error",
      message: args.message,
      ...(args.followUp ?? {}),
    }),
  );
}

function readArbitrationsFollowUp(formData: FormData) {
  return {
    caseStatus: String(formData.get("followUpCaseStatus") || "").trim() || null,
    taskResolutionAction: String(formData.get("followUpTaskResolutionAction") || "").trim() || null,
    impact: String(formData.get("followUpImpact") || "").trim() || null,
    evidenceKind: String(formData.get("followUpEvidenceKind") || "").trim() || null,
    hasEvidence: String(formData.get("followUpHasEvidence") || "").trim() || null,
    assignment: String(formData.get("followUpAssignment") || "").trim() || null,
  };
}

export async function createArbitrationCaseAction(formData: FormData) {
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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
  "use server";

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

export default async function ArbitrationsPage({ searchParams }: ArbitrationsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [publicSurfaceResponse] = await Promise.allSettled([getPublicSurfaceSnapshotStrict()]);
  if (publicSurfaceResponse.status === "rejected") {
    return (
      <main className="app-page">
        <div className="nt-shell" style={{ paddingBlock: 32 }}>
          <DependencyState
            label="公开入口配置"
            result={createDependencyFailureResult({
              error: publicSurfaceResponse.reason,
              message: "公开入口配置暂不可用。",
              source: "public-surfaces",
              unauthorizedMessage: "当前账户无权读取公开入口配置。",
            })}
          />
        </div>
      </main>
    );
  }
  const publicSurfaces = publicSurfaceResponse.value;
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "arbitrations", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;
  const caseStatusFilter = params?.caseStatus?.trim() || "";
  const taskResolutionActionFilter = params?.taskResolutionAction?.trim() || "";
  const impactFilter = params?.impact?.trim() || "";
  const evidenceKindFilter = params?.evidenceKind?.trim() || "";
  const hasEvidenceFilter = params?.hasEvidence?.trim() || "";
  const assignmentFilter = params?.assignment?.trim() || "";

  const userContext = {
    userId: session.user.id,
    username: session.user.username,
  };
  const isOperator = isPlatformOperatorUserId(session.user.id, session.user.providerUserId);

  const features = await getFeatureSnapshot();
  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <DependencyState
            label="仲裁模块"
            result={createDependencyFailureResult({
              error: new Error("Feature snapshot unavailable"),
              message: "当前无法读取仲裁模块状态，请稍后再试。",
              source: "core-features",
            })}
          />
        </div>
      </main>
    );
  }

  if (!features.arbitration.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell app-stack">
          <Card className="app-stack">
            <h1 className="mg-title">仲裁模块已关闭</h1>
            <p className="mg-copy">当前仲裁入口处于关闭状态。开启 `feature.arbitration` 后可提交案件与执行状态流转。</p>
          </Card>
        </div>
      </main>
    );
  }

  const listArbitrationCases = arbitrationClient.listArbitrationCases;
  const arbitrationApiReady = Boolean(
    listArbitrationCases &&
      arbitrationClient.createArbitrationCase &&
      arbitrationClient.updateArbitrationCaseStatus &&
      arbitrationClient.addArbitrationEvidence,
  );

  const dependencyResults: Array<DependencyResult<unknown>> = [];
  const dependencyResultsBySource = new Map<string, DependencyResult<unknown>>();
  function loadDependency<T>(
    promise: Promise<T>,
    args: {
      fallback: T;
      message: string;
      source: string;
      unauthorizedMessage: string;
    },
  ) {
    return promise.then(
      (value) => {
        const result = createDependencyResult({ state: "ready", data: value });
        dependencyResults.push(result);
        dependencyResultsBySource.set(args.source, result);
        return value;
      },
      (error: unknown) => {
        const result = createDependencyFailureResult<T>({
          error,
          message: args.message,
          source: args.source,
          unauthorizedMessage: args.unauthorizedMessage,
        });
        dependencyResults.push(result);
        dependencyResultsBySource.set(args.source, result);
        return args.fallback;
      },
    );
  }

  const tasksPromise = loadDependency(listTasks(userContext), {
    fallback: [] as TaskView[],
    message: "可申诉任务暂不可用。",
    source: "core-tasks",
    unauthorizedMessage: "当前账户无权读取可申诉任务。",
  });
  const arbitrationCasesPromise = listArbitrationCases
    ? loadDependency(listArbitrationCases(userContext), {
        fallback: [] as ArbitrationCaseView[],
        message: "仲裁案件暂不可用。",
        source: "arbitration-cases",
        unauthorizedMessage: "当前账户无权读取仲裁案件。",
      })
    : Promise.resolve([] as ArbitrationCaseView[]);
  const arbitrationSummaryPromise = arbitrationClient.getArbitrationCaseSummary
    ? loadDependency<ArbitrationCaseSummaryView | null>(arbitrationClient.getArbitrationCaseSummary(userContext), {
        fallback: null,
        message: "仲裁摘要暂不可用。",
        source: "arbitration-summary",
        unauthorizedMessage: "当前账户无权读取仲裁摘要。",
      })
    : Promise.resolve(null as ArbitrationCaseSummaryView | null);
  const arbitrationWorkloadPromise =
    isOperator && arbitrationClient.getArbitrationCaseWorkload
      ? loadDependency<ArbitrationWorkloadView | null>(arbitrationClient.getArbitrationCaseWorkload(userContext), {
          fallback: null,
          message: "仲裁工作负载暂不可用。",
          source: "arbitration-workload",
          unauthorizedMessage: "当前账户无权读取仲裁工作负载。",
        })
      : Promise.resolve(null as ArbitrationWorkloadView | null);
  const cleanupQueuePromise =
    isOperator && arbitrationClient.getArbitrationRemoteAttachmentCleanupQueue
      ? loadDependency<ArbitrationRemoteAttachmentCleanupQueueView | null>(
          arbitrationClient.getArbitrationRemoteAttachmentCleanupQueue(userContext, { limit: 20 }),
          {
            fallback: null,
            message: "远程附件清理队列暂不可用。",
            source: "arbitration-cleanup-queue",
            unauthorizedMessage: "当前账户无权读取远程附件清理队列。",
          },
        )
      : Promise.resolve(null as ArbitrationRemoteAttachmentCleanupQueueView | null);

  const [tasks, arbitrationCases, arbitrationSummary, arbitrationWorkload, cleanupQueue] = await Promise.all([
    tasksPromise,
    arbitrationCasesPromise,
    arbitrationSummaryPromise,
    arbitrationWorkloadPromise,
    cleanupQueuePromise,
  ]);
  const filteredCases = arbitrationCases.filter((arbitrationCase) => {
    if (caseStatusFilter && arbitrationCase.status !== caseStatusFilter) return false;
    if (
      taskResolutionActionFilter &&
      (arbitrationCase.taskResolutionAction ?? "none") !== taskResolutionActionFilter
    ) {
      return false;
    }
    if (impactFilter && arbitrationCase.reputationImpactForViewer !== impactFilter) return false;
    if (evidenceKindFilter && !arbitrationCase.evidences.some((evidence) => evidence.kind === evidenceKindFilter)) {
      return false;
    }
    if (hasEvidenceFilter === "with" && arbitrationCase.evidences.length === 0) return false;
    if (hasEvidenceFilter === "without" && arbitrationCase.evidences.length > 0) return false;
    if (assignmentFilter === "claimed" && !arbitrationCase.assignedOperatorUserId) return false;
    if (assignmentFilter === "unclaimed" && arbitrationCase.assignedOperatorUserId) return false;
    if (assignmentFilter === "mine" && arbitrationCase.assignedOperatorUserId !== session.user.id) return false;
    return true;
  });
  const arbitrationDependency = combineDependencyResults({
    data: null,
    empty:
      tasks.length === 0 &&
      arbitrationCases.length === 0 &&
      arbitrationSummary === null &&
      (!isOperator || arbitrationWorkload === null) &&
      (!isOperator || cleanupQueue === null),
    results: dependencyResults,
  });
  const tasksDependency = dependencyResultsBySource.get("core-tasks");
  const casesDependency = dependencyResultsBySource.get("arbitration-cases");
  const tasksUnavailable = tasksDependency?.state === "unavailable" || tasksDependency?.state === "unauthorized";
  const casesUnavailable = casesDependency?.state === "unavailable" || casesDependency?.state === "unauthorized";

  if (arbitrationDependency.state === "unavailable" || arbitrationDependency.state === "unauthorized") {
    return (
      <main className="app-page">
        <div className="mg-shell" style={{ paddingBlock: 32 }}>
          <DependencyState label="仲裁数据" result={arbitrationDependency} />
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <Panel className="app-stack">
          <span className="mg-badge mg-badge--cyan">Arbitration</span>
          <h1 className="mg-title">仲裁案件中心</h1>
          <p className="mg-copy">
            该模块用于处理任务纠纷。当前页面已经接入建案、结构化证据、浏览器直传附件、认领派单、轮次推进与裁决动作。
          </p>
        </Panel>

        {status && message ? (
          <Card className="app-stack">
            <p className={status === "success" ? "app-banner app-banner--success" : "app-banner app-banner--error"}>
              {message}
            </p>
          </Card>
        ) : null}

        {arbitrationDependency.state === "partial" ? (
          <DependencyState label="仲裁数据" result={arbitrationDependency} />
        ) : null}

        {!arbitrationApiReady ? (
          <Card className="app-stack">
            <p className="app-banner app-banner--error">
              当前环境未启用仲裁操作能力，页面先以只读模式展示案件与状态概览。
            </p>
          </Card>
        ) : null}

        <div className="app-shell-grid">
          <Card className="app-stack">
            <p className="mg-subtitle">发起案件</p>
            <h2 className="app-card-title">发起仲裁案件</h2>
            <form action={createArbitrationCaseAction} className="app-form-grid">
              {renderArbitrationFollowUpFields({
                caseStatus: caseStatusFilter,
                taskResolutionAction: taskResolutionActionFilter,
                impact: impactFilter,
                evidenceKind: evidenceKindFilter,
                hasEvidence: hasEvidenceFilter,
                assignment: assignmentFilter,
              })}
              <Select defaultValue="" name="taskId" required>
                <option disabled value="">选择任务</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.id})
                  </option>
                ))}
              </Select>
              <Textarea name="reason" placeholder="填写仲裁理由，例如争议点、预期处理方式。" required rows={4} />
              <Textarea name="evidenceSummary" placeholder="证据摘要（可选）：提交聊天记录、日志、截图说明。" rows={3} />
              <button className="mg-btn mg-btn--primary" disabled={!arbitrationApiReady || tasks.length === 0} type="submit">
                {tasksUnavailable
                  ? "任务数据暂不可用"
                  : tasks.length === 0
                    ? "暂无任务可选"
                    : arbitrationApiReady
                      ? "提交仲裁"
                      : "当前环境未启用提交"}
              </button>
            </form>
          </Card>

          <Card className="app-stack">
            <p className="mg-subtitle">案件规则</p>
            <h2 className="app-card-title">当前案件范围</h2>
            <div className="app-detail-list">
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">实体类型</span>
                <span className="app-detail-list__value">任务</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">状态流转</span>
                <span className="app-detail-list__value">待受理 → 审理中 → 已裁决 / 已驳回</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">状态更新权限</span>
                <span className="app-detail-list__value">仅具备状态更新权限的案件可操作</span>
              </div>
            </div>
            <p className="app-note">
              当前围绕任务纠纷已经形成可操作闭环；更重的运维动作仍保留在当前仲裁台，而不是分散到账户首页摘要。
            </p>
          </Card>
        </div>

        {arbitrationSummary ? (
          <div className="app-wallet-grid">
            <Card className="app-currency-card">
              <p className="mg-subtitle">案件</p>
              <h2 className="app-card-title">总案件数</h2>
              <div className="app-currency-card__value">{arbitrationSummary.totalCount}</div>
              <p className="app-note">待处理人处理：{arbitrationSummary.awaitingOperatorCount}</p>
            </Card>
            <Card className="app-currency-card">
              <p className="mg-subtitle">按状态</p>
              <h2 className="app-card-title">状态分布</h2>
              <p className="app-note">{formatBucketList(arbitrationSummary.byStatus, formatArbitrationStatus)}</p>
            </Card>
            <Card className="app-currency-card">
              <p className="mg-subtitle">裁定</p>
              <h2 className="app-card-title">任务裁定动作</h2>
              <p className="app-note">{formatBucketList(arbitrationSummary.byTaskResolutionAction, formatTaskResolutionAction)}</p>
            </Card>
            <Card className="app-currency-card">
              <p className="mg-subtitle">影响</p>
              <h2 className="app-card-title">信誉影响</h2>
              <p className="app-note">{formatBucketList(arbitrationSummary.byReputationImpact, formatReputationImpact)}</p>
              <p className="app-note">已应用效果：{arbitrationSummary.resolvedWithEffectsCount}</p>
            </Card>
            <Card className="app-currency-card">
              <p className="mg-subtitle">证据</p>
              <h2 className="app-card-title">证据覆盖</h2>
              <p className="app-note">
                有证据案件：{arbitrationSummary.casesWithEvidenceCount} / 无证据案件：{arbitrationSummary.casesWithoutEvidenceCount}
              </p>
              <p className="app-note">证据总条数：{arbitrationSummary.evidenceCount}</p>
              <p className="app-note">
                远程附件：{arbitrationSummary.remoteAttachmentCount} / 请求清理 {arbitrationSummary.cleanupRequestedRemoteAttachmentCount} / 已归档 {arbitrationSummary.archivedRemoteAttachmentCount}
              </p>
              <p className="app-note">{formatBucketList(arbitrationSummary.byEvidenceKind, formatEvidenceKind)}</p>
            </Card>
            <Card className="app-currency-card">
              <p className="mg-subtitle">认领</p>
              <h2 className="app-card-title">认领状态</h2>
              <p className="app-note">已认领：{arbitrationSummary.claimedCount}</p>
              <p className="app-note">未认领：{arbitrationSummary.unclaimedCount}</p>
            </Card>
            {arbitrationWorkload ? (
              <Card className="app-currency-card">
                <p className="mg-subtitle">处理负载</p>
                <h2 className="app-card-title">工作负载</h2>
                <p className="app-note">我认领的案件：{arbitrationWorkload.mineCount}</p>
                <p className="app-note">逾期认领：{arbitrationWorkload.staleClaimedCount}</p>
                <p className="app-note">
                  逾期轮次：{arbitrationWorkload.staleRoundCount}
                  {arbitrationWorkload.oldestStaleRoundAgeHours !== null
                    ? ` / 最早超期 ${arbitrationWorkload.oldestStaleRoundAgeHours} 小时`
                    : ""}
                </p>
                <p className="app-note">
                  推荐处理人：{arbitrationWorkload.recommendedAssigneeUserId || "暂无"}
                </p>
                <p className="app-note">
                  自动释放：{arbitrationWorkload.autoReleaseEnabled ? "启用" : "未启用"}
                  {arbitrationWorkload.autoReleaseIntervalMinutes
                    ? ` / ${arbitrationWorkload.autoReleaseIntervalMinutes} 分钟`
                    : ""}
                </p>
                <p className="app-note">
                  下一条候选：
                  {arbitrationWorkload.nextClaimCandidate
                    ? `${arbitrationWorkload.nextClaimCandidate.caseId} / 第 ${arbitrationWorkload.nextClaimCandidate.currentReviewRoundNumber} 轮`
                    : "暂无"}
                </p>
              </Card>
            ) : null}
          </div>
        ) : null}

        {arbitrationWorkload ? (
          <Card className="app-stack">
            <div className="app-task-card__header">
              <div>
                <p className="mg-subtitle">处理负载</p>
                <h2 className="app-card-title">认领队列与工作负载</h2>
              </div>
              <div className="app-inline-actions">
                <form action={claimNextArbitrationCaseAction}>
                  {renderArbitrationFollowUpFields({
                    caseStatus: caseStatusFilter,
                    taskResolutionAction: taskResolutionActionFilter,
                    impact: impactFilter,
                    evidenceKind: evidenceKindFilter,
                    hasEvidence: hasEvidenceFilter,
                    assignment: assignmentFilter,
                  })}
                  <button className="mg-btn mg-btn--secondary" type="submit">
                    认领下一条案件
                  </button>
                </form>
                <form action={releaseStaleArbitrationCasesAction}>
                  {renderArbitrationFollowUpFields({
                    caseStatus: caseStatusFilter,
                    taskResolutionAction: taskResolutionActionFilter,
                    impact: impactFilter,
                    evidenceKind: evidenceKindFilter,
                    hasEvidence: hasEvidenceFilter,
                    assignment: assignmentFilter,
                  })}
                  <input name="limit" type="hidden" value="20" />
                  <button className="mg-btn mg-btn--glass" type="submit">
                    释放逾期认领
                  </button>
                </form>
                <form action={cleanupRemoteArbitrationAttachmentsAction}>
                  {renderArbitrationFollowUpFields({
                    caseStatus: caseStatusFilter,
                    taskResolutionAction: taskResolutionActionFilter,
                    impact: impactFilter,
                    evidenceKind: evidenceKindFilter,
                    hasEvidence: hasEvidenceFilter,
                    assignment: assignmentFilter,
                  })}
                  <input name="limit" type="hidden" value="20" />
                  <button className="mg-btn mg-btn--outline" type="submit">
                    清理远程附件
                  </button>
                </form>
              </div>
            </div>
            <div className="app-detail-list">
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">已认领 / 未认领 / 逾期</span>
                <span className="app-detail-list__value">
                  {arbitrationWorkload.claimedCount} / {arbitrationWorkload.unclaimedCount} / {arbitrationWorkload.staleClaimedCount}
                </span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">当前处理人</span>
                <span className="app-detail-list__value">我认领的案件：{arbitrationWorkload.mineCount}</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">逾期轮次</span>
                <span className="app-detail-list__value">
                  {arbitrationWorkload.staleRoundCount}
                  {arbitrationWorkload.oldestStaleRoundAgeHours !== null
                    ? ` / 最早超期 ${arbitrationWorkload.oldestStaleRoundAgeHours} 小时`
                    : ""}
                </span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">推荐分派</span>
                <span className="app-detail-list__value">{arbitrationWorkload.recommendedAssigneeUserId || "暂无"}</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">自动释放策略</span>
                <span className="app-detail-list__value">
                  {arbitrationWorkload.autoReleaseEnabled ? "启用" : "未启用"}
                  {arbitrationWorkload.autoReleaseIntervalMinutes
                    ? ` / ${arbitrationWorkload.autoReleaseIntervalMinutes} 分钟`
                    : ""}
                </span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">按状态</span>
                <span className="app-detail-list__value">{formatBucketList(arbitrationWorkload.byStatus, formatArbitrationStatus)}</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">按轮次状态</span>
                <span className="app-detail-list__value">{formatBucketList(arbitrationWorkload.byReviewRoundStatus, formatReviewRoundStatus)}</span>
              </div>
            </div>
            <div className="app-task-list">
              {arbitrationWorkload.byAssignee.map((bucket) => (
                <div className="app-task-card app-task-card--runtime-managed" key={bucket.key}>
                  <div className="app-task-card__header">
                    <div>
                      <p className="mg-subtitle">处理人</p>
                      <h3 className="app-card-title">{bucket.key}</h3>
                    </div>
                    <Badge variant={bucket.staleClaimCount > 0 ? "warning" : "cyan"}>
                      逾期 {bucket.staleClaimCount}
                    </Badge>
                  </div>
                  <div className="app-detail-list">
                    <div className="app-detail-list__row">
                      <span className="app-detail-list__label">已认领</span>
                      <span className="app-detail-list__value">{bucket.claimedCount}</span>
                    </div>
                    <div className="app-detail-list__row">
                      <span className="app-detail-list__label">进行中轮次</span>
                      <span className="app-detail-list__value">{bucket.openRoundCount}</span>
                    </div>
                    <div className="app-detail-list__row">
                      <span className="app-detail-list__label">平均认领时长</span>
                      <span className="app-detail-list__value">
                        {bucket.avgClaimAgeHours !== null ? `${bucket.avgClaimAgeHours} 小时` : "暂无"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {cleanupQueue ? (
          <Card className="app-stack">
            <div className="app-task-card__header">
              <div>
                <p className="mg-subtitle">清理队列</p>
                <h2 className="app-card-title">远程附件保留与清理</h2>
              </div>
            </div>
            <div className="app-detail-list">
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">存储策略</span>
                <span className="app-detail-list__value">
                  {formatStorageMode(cleanupQueue.policy.storageMode)} / {formatRemoteUploadStrategy(cleanupQueue.policy.remoteUploadStrategy)}
                  {cleanupQueue.policy.remoteProviderKey ? ` / ${cleanupQueue.policy.remoteProviderKey}` : ""}
                </span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">待清理 / 当前到期</span>
                <span className="app-detail-list__value">
                  {cleanupQueue.pendingCount} / {cleanupQueue.dueNowCount}
                </span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">已请求清理</span>
                <span className="app-detail-list__value">{cleanupQueue.cleanupRequestedCount}</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">清理失败 / 最大尝试</span>
                <span className="app-detail-list__value">
                  {cleanupQueue.failedCount} / {cleanupQueue.policy.cleanupMaxAttempts}
                </span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">最早保留到期</span>
                <span className="app-detail-list__value">{toLocaleDateTime(cleanupQueue.oldestRetentionExpiresAt)}</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">按案件状态</span>
                <span className="app-detail-list__value">{formatBucketList(cleanupQueue.byCaseStatus, formatArbitrationStatus)}</span>
              </div>
              <div className="app-detail-list__row">
                <span className="app-detail-list__label">远程配置</span>
                <span className="app-detail-list__value">
                  {formatRemoteConfigState(cleanupQueue.policy.remoteBaseUrlConfigured, "读取地址已配置", "读取地址未配置")} /{" "}
                  {formatRemoteConfigState(cleanupQueue.policy.remoteUploadBaseUrlConfigured, "上传地址已配置", "上传地址未配置")} /{" "}
                  {formatRemoteConfigState(cleanupQueue.policy.remoteAuthConfigured, "鉴权已配置", "鉴权未配置")}
                </span>
              </div>
            </div>
            {cleanupQueue.candidates.length > 0 ? (
              <div className="app-task-list">
                {cleanupQueue.candidates.slice(0, 6).map((candidate) => (
                  <div className="app-task-card" key={candidate.attachmentId}>
                    <div className="app-task-card__header">
                      <div>
                        <p className="mg-subtitle">{statusLabel[candidate.caseStatus]}</p>
                        <h3 className="app-card-title">{candidate.fileName}</h3>
                      </div>
                      <div className="app-inline-actions">
                        <Badge variant={candidate.cleanupRequestedAt ? "warning" : "cyan"}>
                          {formatCleanupRequestState(candidate.cleanupRequestedAt)}
                        </Badge>
                        {candidate.hoursPastRetention !== null && candidate.hoursPastRetention > 0 ? (
                          <Badge variant="danger">{candidate.hoursPastRetention} 小时超期</Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="app-note">
                      案件 {candidate.caseId} / 证据 {candidate.evidenceId}
                    </p>
                    <p className="app-note">
                      保留到期 {toLocaleDateTime(candidate.retentionExpiresAt)} / 清理请求{" "}
                      {toLocaleDateTime(candidate.cleanupRequestedAt)}
                    </p>
                    <p className="app-note">
                      清理尝试 {candidate.cleanupAttemptCount} 次 / 最近尝试{" "}
                      {toLocaleDateTime(candidate.lastCleanupAttemptAt)}
                    </p>
                    {candidate.lastCleanupError ? (
                      <p className="app-note">最近清理错误：{candidate.lastCleanupError}</p>
                    ) : null}
                    <div className="app-link-row">
                      {!candidate.cleanupRequestedAt ? (
                        <form action={requestArbitrationAttachmentCleanupAction}>
                          <input name="attachmentId" type="hidden" value={candidate.attachmentId} />
                          {renderArbitrationFollowUpFields({
                            caseStatus: caseStatusFilter,
                            taskResolutionAction: taskResolutionActionFilter,
                            impact: impactFilter,
                            evidenceKind: evidenceKindFilter,
                            hasEvidence: hasEvidenceFilter,
                            assignment: assignmentFilter,
                          })}
                          <button className="mg-btn mg-btn--outline" type="submit">
                            请求清理
                          </button>
                        </form>
                      ) : null}
                      <form action={archiveArbitrationAttachmentAction}>
                        <input name="attachmentId" type="hidden" value={candidate.attachmentId} />
                        {renderArbitrationFollowUpFields({
                          caseStatus: caseStatusFilter,
                          taskResolutionAction: taskResolutionActionFilter,
                          impact: impactFilter,
                          evidenceKind: evidenceKindFilter,
                          hasEvidence: hasEvidenceFilter,
                          assignment: assignmentFilter,
                        })}
                        <button className="mg-btn mg-btn--glass" type="submit">
                          立即归档
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mg-copy">当前没有待观察的远程附件保留队列。</p>
            )}
          </Card>
        ) : null}

        <Card className="app-stack">
          <div className="app-task-card__header">
            <div>
              <p className="mg-subtitle">处理筛选</p>
              <h2 className="app-card-title">筛选仲裁案件</h2>
            </div>
          </div>
          <form action="/ops/account/arbitrations" className="app-form-grid" method="get">
            <select className="mg-select" name="caseStatus" defaultValue={caseStatusFilter}>
              <option value="">全部状态</option>
              {arbitrationStatusOptions.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusLabel[statusOption]}
                </option>
              ))}
            </select>
            <select className="mg-select" name="taskResolutionAction" defaultValue={taskResolutionActionFilter}>
              <option value="">全部任务裁定动作</option>
              {taskResolutionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className="mg-select" name="impact" defaultValue={impactFilter}>
              <option value="">全部信誉影响</option>
              {Object.entries(reputationImpactLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select className="mg-select" name="hasEvidence" defaultValue={hasEvidenceFilter}>
              <option value="">全部证据覆盖</option>
              <option value="with">仅看有证据</option>
              <option value="without">仅看无证据</option>
            </select>
            <select className="mg-select" name="evidenceKind" defaultValue={evidenceKindFilter}>
              <option value="">全部证据类型</option>
              {Object.entries(evidenceKindLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select className="mg-select" name="assignment" defaultValue={assignmentFilter}>
              <option value="">全部认领状态</option>
              <option value="claimed">仅看已认领</option>
              <option value="unclaimed">仅看未认领</option>
              {isOperator ? <option value="mine">仅看我认领的案件</option> : null}
            </select>
            <button className="mg-btn mg-btn--secondary" type="submit">
              应用筛选
            </button>
          </form>
        </Card>

        <Card className="app-stack">
          <p className="mg-subtitle">案件</p>
          <h2 className="app-card-title">仲裁案件列表</h2>
          {filteredCases.length === 0 ? (
            casesUnavailable && casesDependency ? (
              <DependencyState label="仲裁案件" result={casesDependency} />
            ) : (
              <p className="mg-copy">当前没有仲裁案件。</p>
            )
          ) : (
            <div className="app-task-list">
              {filteredCases.map((arbitrationCase) => {
                const arbitrationCaseWithImpact = arbitrationCase as ArbitrationCaseWithImpact;
                const impact = arbitrationCaseWithImpact.reputationImpactForViewer;
                return (
                  <div className="app-task-card" key={arbitrationCase.id}>
                    <div className="app-task-card__header">
                      <div>
                        <p className="mg-subtitle">{formatArbitrationEntityType(arbitrationCase.entityType)}</p>
                        <h3 className="app-card-title">案件 {arbitrationCase.id}</h3>
                      </div>
                      <Badge variant={statusVariant[arbitrationCase.status]}>{statusLabel[arbitrationCase.status]}</Badge>
                    </div>
                    <p className="mg-copy">{arbitrationCase.reason}</p>
                    <p className="app-note">{arbitrationCase.evidenceSummary || "未填写证据摘要。"}</p>
                    <div className="app-stack">
                      <div className="app-task-card__header">
                        <div>
                          <p className="mg-subtitle">证据对象</p>
                          <h4 className="app-card-title">结构化证据</h4>
                        </div>
                        <Badge variant="cyan">{arbitrationCase.evidences.length} 条</Badge>
                      </div>
                      {arbitrationCase.evidences.length === 0 ? (
                        <p className="app-note">当前还没有结构化证据对象，仍可先参考上方证据摘要。</p>
                      ) : (
                        <div className="app-task-list">
                          {arbitrationCase.evidences.map((evidence) => (
                            <div className="app-task-card" key={evidence.id}>
                              <div className="app-task-card__header">
                                <div>
                                  <p className="mg-subtitle">{evidenceKindLabel[evidence.kind]}</p>
                                  <h5 className="app-card-title">{evidence.title}</h5>
                                </div>
                                <div className="app-inline-actions">
                                  <Badge variant="cyan">{new Date(evidence.createdAt).toLocaleString("zh-CN")}</Badge>
                                  <Badge variant="violet">{evidence.attachments.length} 个附件</Badge>
                                </div>
                              </div>
                              {evidence.content ? <p className="mg-copy">{evidence.content}</p> : null}
                              {evidence.url ? (
                                <p className="app-note">
                                  <a href={evidence.url} rel="noreferrer" target="_blank">
                                    {evidence.url}
                                  </a>
                                </p>
                              ) : null}
                              {evidence.attachments.length > 0 ? (
                                <div className="app-stack">
                                  <p className="mg-subtitle">附件库</p>
                                  <div className="app-task-list">
                                    {evidence.attachments.map((attachment) => (
                                      <div className="app-task-card" key={attachment.id}>
                                        <div className="app-task-card__header">
                                          <div>
                                            <p className="mg-subtitle">{attachment.contentType}</p>
                                            <h6 className="app-card-title">{attachment.fileName}</h6>
                                          </div>
                                          <div className="app-inline-actions">
                                            <Badge variant="cyan">{Math.max(1, Math.ceil(attachment.sizeBytes / 1024))} KB</Badge>
                                            <Badge variant={attachment.storageMode === "remote" ? "violet" : "cyan"}>
                                              {formatStorageMode(attachment.storageMode)}
                                            </Badge>
                                            <Badge variant={attachment.uploadState === "uploaded" ? "success" : attachment.uploadState === "prepared" ? "warning" : "danger"}>
                                              {formatUploadState(attachment.uploadState)}
                                            </Badge>
                                            {attachment.archivedAt ? <Badge variant="warning">已归档</Badge> : null}
                                          </div>
                                        </div>
                                        <p className="app-note">上传人：{attachment.uploaderUserId}</p>
                                        <p className="app-note">上传时间：{new Date(attachment.createdAt).toLocaleString("zh-CN")}</p>
                                        <p className="app-note">
                                          准备时间 {toLocaleDateTime(attachment.uploadPreparedAt)} / 完成时间 {toLocaleDateTime(attachment.uploadCompletedAt)}
                                        </p>
                                        <p className="app-note">
                                          保留到期 {toLocaleDateTime(attachment.retentionExpiresAt)} / 清理请求 {toLocaleDateTime(attachment.cleanupRequestedAt)}
                                        </p>
                                        {attachment.remoteUrl ? <p className="app-note">远程地址：{attachment.remoteUrl}</p> : null}
                                        {attachment.archivedAt ? (
                                          <p className="app-note">
                                            已归档：{new Date(attachment.archivedAt).toLocaleString("zh-CN")} / {attachment.archiveReason || "无"}
                                          </p>
                                        ) : null}
                                        <div className="app-link-row">
                                          {!attachment.archivedAt ? (
                                            <a
                                              className="mg-btn mg-btn--outline"
                                              href={`/api/arbitration-attachments/${attachment.id}`}
                                              rel="noreferrer"
                                              target="_blank"
                                            >
                                              打开附件
                                            </a>
                                          ) : null}
                                          {isOperator && attachment.storageMode === "remote" && !attachment.archivedAt ? (
                                            <form action={archiveArbitrationAttachmentAction}>
                                              <input name="attachmentId" type="hidden" value={attachment.id} />
                                              {renderArbitrationFollowUpFields({
                                                caseStatus: caseStatusFilter,
                                                taskResolutionAction: taskResolutionActionFilter,
                                                impact: impactFilter,
                                                evidenceKind: evidenceKindFilter,
                                                hasEvidence: hasEvidenceFilter,
                                                assignment: assignmentFilter,
                                              })}
                                              <button className="mg-btn mg-btn--glass" type="submit">
                                                归档远程附件
                                              </button>
                                            </form>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              <p className="app-note">提交人：{evidence.creatorUserId}</p>
                              {arbitrationCase.canAddEvidence ? (
                                <PreparedAttachmentUpload
                                  accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
                                  evidenceId={evidence.id}
                                  successMessage="证据附件已通过浏览器直传。"
                                />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                      {arbitrationCase.canAddEvidence ? (
                        <form action={addArbitrationEvidenceAction} className="app-form-grid">
                          <input name="caseId" type="hidden" value={arbitrationCase.id} />
                          {renderArbitrationFollowUpFields({
                            caseStatus: caseStatusFilter,
                            taskResolutionAction: taskResolutionActionFilter,
                            impact: impactFilter,
                            evidenceKind: evidenceKindFilter,
                            hasEvidence: hasEvidenceFilter,
                            assignment: assignmentFilter,
                          })}
                          <Select defaultValue="text_note" name="kind">
                            {Object.entries(evidenceKindLabel).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                          <Input name="title" placeholder="证据标题，例如：执行日志、截图说明、外链证据" required />
                          <Textarea name="content" placeholder="证据内容或补充说明（文字/日志类必填）" rows={3} />
                          <Input name="url" placeholder="https://example.com/evidence（链接/截图引用类必填）" type="url" />
                          <button className="mg-btn mg-btn--outline" disabled={!arbitrationApiReady} type="submit">
                            添加证据
                          </button>
                        </form>
                      ) : (
                        <p className="app-note">案件已结案或当前用户无权继续补充证据。</p>
                      )}
                    </div>
                    <div className="app-detail-list">
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">关联任务</span>
                        <span className="app-detail-list__value">{arbitrationCase.entityId}</span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">申请人</span>
                        <span className="app-detail-list__value">{arbitrationCase.requesterUserId}</span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">被申请人</span>
                        <span className="app-detail-list__value">{arbitrationCase.respondentUserId}</span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">创建时间</span>
                        <span className="app-detail-list__value">{new Date(arbitrationCase.createdAt).toLocaleString("zh-CN")}</span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">裁决摘要</span>
                        <span className="app-detail-list__value">{arbitrationCase.resolutionSummary || "尚无裁决摘要"}</span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">任务裁定动作</span>
                        <span className="app-detail-list__value">
                          {arbitrationCase.taskResolutionAction ? formatTaskResolutionAction(arbitrationCase.taskResolutionAction) : "未设置"}
                        </span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">信誉影响</span>
                        <span className="app-detail-list__value">
                          {impact ? (
                            <Badge variant={reputationImpactVariant[impact]}>{reputationImpactLabel[impact]}</Badge>
                          ) : (
                            "未评估"
                          )}
                        </span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">效果应用时间</span>
                        <span className="app-detail-list__value">
                          {arbitrationCase.effectsAppliedAt
                            ? new Date(arbitrationCase.effectsAppliedAt).toLocaleString("zh-CN")
                            : "未应用"}
                        </span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">当前认领</span>
                        <span className="app-detail-list__value">
                          {arbitrationCase.assignedOperatorUserId || "未认领"}
                          {arbitrationCase.claimedAt
                            ? ` · ${new Date(arbitrationCase.claimedAt).toLocaleString("zh-CN")}`
                            : ""}
                        </span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">认领时长</span>
                        <span className="app-detail-list__value">
                          {arbitrationCase.claimAgeHours !== null ? `${arbitrationCase.claimAgeHours} 小时` : "未认领"}
                          {arbitrationCase.isStaleClaim ? " · 逾期认领" : ""}
                        </span>
                      </div>
                      <div className="app-detail-list__row">
                        <span className="app-detail-list__label">当前审理轮次</span>
                        <span className="app-detail-list__value">第 {arbitrationCase.currentReviewRoundNumber} 轮</span>
                      </div>
                    </div>

                    {arbitrationCase.reviewRounds?.length ? (
                      <div className="app-stack">
                        <h4 className="app-card-title">审理轮次</h4>
                        <div className="app-task-list">
                          {arbitrationCase.reviewRounds.map((round) => (
                            <div className="app-task-card" key={round.id}>
                              <div className="app-task-card__header">
                                <div>
                                  <p className="mg-subtitle">第 {round.roundNumber} 轮</p>
                                  <h5 className="app-card-title">{round.summary || "暂无轮次摘要"}</h5>
                                </div>
                                <div className="app-inline-actions">
                                  <Badge variant={round.status === "completed" ? "success" : "cyan"}>
                                    {formatReviewRoundStatus(round.status)}
                                  </Badge>
                                  {round.isRoundStale ? <Badge variant="danger">轮次逾期</Badge> : null}
                                </div>
                              </div>
                              <div className="app-detail-list">
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">指派处理人</span>
                                  <span className="app-detail-list__value">{round.assignedOperatorUserId || "未指定"}</span>
                                </div>
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">开始</span>
                                  <span className="app-detail-list__value">{new Date(round.startedAt).toLocaleString("zh-CN")}</span>
                                </div>
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">结束</span>
                                  <span className="app-detail-list__value">
                                    {round.endedAt ? new Date(round.endedAt).toLocaleString("zh-CN") : "进行中"}
                                  </span>
                                </div>
                                <div className="app-detail-list__row">
                                  <span className="app-detail-list__label">轮次时长</span>
                                  <span className="app-detail-list__value">
                                    {round.roundAgeHours !== null ? `${round.roundAgeHours} 小时` : "暂无"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {isOperator ? (
                      <div className="app-task-card__footer">
                        {arbitrationCase.canClaim ? (
                          <form action={claimArbitrationCaseAction}>
                            <input name="caseId" type="hidden" value={arbitrationCase.id} />
                            {renderArbitrationFollowUpFields({
                              caseStatus: caseStatusFilter,
                              taskResolutionAction: taskResolutionActionFilter,
                              impact: impactFilter,
                              evidenceKind: evidenceKindFilter,
                              hasEvidence: hasEvidenceFilter,
                              assignment: assignmentFilter,
                            })}
                            <button className="mg-btn mg-btn--glass" type="submit">
                              认领案件
                            </button>
                          </form>
                        ) : null}
                        {arbitrationCase.canRelease ? (
                          <form action={releaseArbitrationCaseAction}>
                            <input name="caseId" type="hidden" value={arbitrationCase.id} />
                            {renderArbitrationFollowUpFields({
                              caseStatus: caseStatusFilter,
                              taskResolutionAction: taskResolutionActionFilter,
                              impact: impactFilter,
                              evidenceKind: evidenceKindFilter,
                              hasEvidence: hasEvidenceFilter,
                              assignment: assignmentFilter,
                            })}
                            <button className="mg-btn mg-btn--outline" type="submit">
                              释放案件
                            </button>
                          </form>
                        ) : null}
                        {arbitrationWorkload ? (
                          <form action={assignArbitrationCaseAction} className="app-inline-actions">
                            <input name="caseId" type="hidden" value={arbitrationCase.id} />
                            {renderArbitrationFollowUpFields({
                              caseStatus: caseStatusFilter,
                              taskResolutionAction: taskResolutionActionFilter,
                              impact: impactFilter,
                              evidenceKind: evidenceKindFilter,
                              hasEvidence: hasEvidenceFilter,
                              assignment: assignmentFilter,
                            })}
                            <select className="mg-select" defaultValue={arbitrationWorkload.recommendedAssigneeUserId || ""} name="assigneeUserId">
                              <option value="">选择处理人</option>
                              {arbitrationWorkload.byAssignee.map((bucket) => (
                                <option key={bucket.key} value={bucket.key}>
                                  {bucket.key} · 已认领 {bucket.claimedCount} · 逾期 {bucket.staleClaimCount}
                                </option>
                              ))}
                            </select>
                            <button className="mg-btn mg-btn--secondary" type="submit">
                              派单
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}

                    {arbitrationCase.canAdvanceReviewRound ? (
                      <Card className="app-stack">
                        <h4 className="app-card-title">推进到下一轮审理</h4>
                        <form action={advanceArbitrationReviewRoundAction} className="app-form-grid">
                          <input name="caseId" type="hidden" value={arbitrationCase.id} />
                          {renderArbitrationFollowUpFields({
                            caseStatus: caseStatusFilter,
                            taskResolutionAction: taskResolutionActionFilter,
                            impact: impactFilter,
                            evidenceKind: evidenceKindFilter,
                            hasEvidence: hasEvidenceFilter,
                            assignment: assignmentFilter,
                          })}
                          <Textarea name="summary" placeholder="本轮审理结论 / 交接说明" rows={3} />
                          <Input name="assignToOperatorUserId" placeholder="下一轮运维用户 ID（可选）" />
                          <button className="mg-btn mg-btn--secondary" type="submit">
                            创建下一轮审理
                          </button>
                        </form>
                      </Card>
                    ) : null}

                    <div className="app-stack">
                      <h4 className="app-card-title">案件时间线</h4>
                      <div className="app-task-list">
                        {arbitrationCase.timeline.map((entry) => (
                          <div className="app-task-card" key={`${arbitrationCase.id}-${entry.kind}-${entry.occurredAt}`}>
                            <div className="app-task-card__header">
                              <div>
                                <p className="mg-subtitle">{entry.kind}</p>
                                <h5 className="app-card-title">{entry.title}</h5>
                              </div>
                              <Badge variant="cyan">{new Date(entry.occurredAt).toLocaleString("zh-CN")}</Badge>
                            </div>
                            <p className="app-note">{entry.detail || "当前无补充说明。"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {arbitrationCase.canUpdateStatus ? (
                      <div className="app-stack">
                        {arbitrationStatuses.map((targetStatus) => (
                          <form
                            action={updateArbitrationCaseStatusAction}
                            className="app-form-grid"
                            key={`${arbitrationCase.id}-${targetStatus}`}
                          >
                          <input name="caseId" type="hidden" value={arbitrationCase.id} />
                          <input name="status" type="hidden" value={targetStatus} />
                          {renderArbitrationFollowUpFields({
                            caseStatus: caseStatusFilter,
                            taskResolutionAction: taskResolutionActionFilter,
                            impact: impactFilter,
                            evidenceKind: evidenceKindFilter,
                            hasEvidence: hasEvidenceFilter,
                            assignment: assignmentFilter,
                          })}
                          <Textarea
                            name="resolutionSummary"
                            placeholder={
                              targetStatus === "under_review"
                                ? "补充审理说明（可选）"
                                : "填写裁决摘要，说明本次仲裁的结论与依据"
                            }
                            rows={targetStatus === "under_review" ? 2 : 3}
                          />
                          {targetStatus === "resolved" ? (
                            <Select defaultValue="none" name="taskResolutionAction">
                              {taskResolutionOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          ) : null}
                          <button
                            className="mg-btn mg-btn--outline"
                            disabled={!arbitrationApiReady || arbitrationCase.status === targetStatus}
                            type="submit"
                          >
                            设为 {statusLabel[targetStatus]}
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <p className="app-note">当前用户无权更新该案件状态。</p>
                  )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
