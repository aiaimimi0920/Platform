import type {
  ArbitrationCaseView,
  ArbitrationEvidenceKind,
  ArbitrationStatus,
  ArbitrationTaskResolutionAction,
} from "@neuro/contracts";

export const arbitrationStatuses: Exclude<ArbitrationStatus, "open">[] = ["under_review", "resolved", "rejected"];
export const arbitrationStatusOptions: ArbitrationStatus[] = ["open", ...arbitrationStatuses];
export const taskResolutionOptions: { value: ArbitrationTaskResolutionAction; label: string }[] = [
  { value: "none", label: "仅结案，不改任务状态" },
  { value: "accept", label: "裁定验收通过并放款" },
  { value: "default", label: "裁定违约并退款/扣罚" },
  { value: "cancel", label: "裁定取消并退回托管" },
];

export function toLocaleDateTime(value: string | null | undefined) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString("zh-CN");
}

export const statusLabel: Record<ArbitrationStatus, string> = {
  open: "待受理",
  under_review: "审理中",
  resolved: "已裁决",
  rejected: "已驳回",
};

export const statusVariant: Record<ArbitrationStatus, "warning" | "cyan" | "success" | "danger"> = {
  open: "warning",
  under_review: "cyan",
  resolved: "success",
  rejected: "danger",
};

export type ArbitrationImpact = "favorable" | "unfavorable" | "neutral";
export const reputationImpactLabel: Record<ArbitrationImpact, string> = {
  favorable: "信誉友好",
  unfavorable: "信誉不利",
  neutral: "信誉中立",
};
export const reputationImpactVariant: Record<ArbitrationImpact, "success" | "danger" | "warning"> = {
  favorable: "success",
  unfavorable: "danger",
  neutral: "warning",
};
export type ArbitrationCaseWithImpact = ArbitrationCaseView & {
  reputationImpactForViewer?: ArbitrationImpact;
};

export const evidenceKindLabel: Record<ArbitrationEvidenceKind, string> = {
  text_note: "文字说明",
  external_link: "外部链接",
  log_excerpt: "日志摘录",
  screenshot_ref: "截图引用",
};

export function formatTaskResolutionAction(value: string) {
  return taskResolutionOptions.find((option) => option.value === value)?.label ?? "自定义裁定动作";
}

export function formatReputationImpact(value: string) {
  return value in reputationImpactLabel ? reputationImpactLabel[value as ArbitrationImpact] : "自定义信誉影响";
}

export function formatEvidenceKind(value: string) {
  return value in evidenceKindLabel ? evidenceKindLabel[value as ArbitrationEvidenceKind] : "自定义证据类型";
}

export function formatArbitrationEntityType(value: string) {
  switch (value) {
    case "task":
      return "任务";
    default:
      return "自定义对象";
  }
}

export function formatArbitrationStatus(value: string) {
  return value in statusLabel ? statusLabel[value as ArbitrationStatus] : "自定义状态";
}

export function formatReviewRoundStatus(value: string) {
  switch (value) {
    case "open":
      return "审理中";
    case "completed":
      return "已完成";
    default:
      return "自定义轮次状态";
  }
}

export function formatStorageMode(value: string) {
  switch (value) {
    case "local":
      return "本地保存";
    case "remote":
      return "远程保存";
    default:
      return "自定义存储";
  }
}

export function formatRemoteUploadStrategy(value: string) {
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

export function formatUploadState(value: string) {
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

export function formatRemoteConfigState(enabled: boolean, enabledLabel: string, disabledLabel: string) {
  return enabled ? enabledLabel : disabledLabel;
}

export function formatCleanupRequestState(cleanupRequestedAt: string | null | undefined) {
  return cleanupRequestedAt ? "已请求清理" : "继续保留";
}

export function formatBucketList(buckets: Array<{ key: string; count: number }>, formatKey: (key: string) => string = (key) => key) {
  if (buckets.length === 0) return "暂无";
  return buckets.map((bucket) => `${formatKey(bucket.key)} (${bucket.count})`).join(" / ");
}

export function buildArbitrationsRedirect(args: {
  status: "success" | "error";
  message: string;
  caseId?: string | null;
  caseStatus?: string | null;
  taskResolutionAction?: string | null;
  impact?: string | null;
  evidenceKind?: string | null;
  hasEvidence?: string | null;
  assignment?: string | null;
  routePath?: string | null;
}) {
  const params = new URLSearchParams({
    status: args.status,
    message: args.message,
  });
  if (args.caseId) params.set("caseId", args.caseId);
  if (args.caseStatus) params.set("caseStatus", args.caseStatus);
  if (args.taskResolutionAction) params.set("taskResolutionAction", args.taskResolutionAction);
  if (args.impact) params.set("impact", args.impact);
  if (args.evidenceKind) params.set("evidenceKind", args.evidenceKind);
  if (args.hasEvidence) params.set("hasEvidence", args.hasEvidence);
  if (args.assignment) params.set("assignment", args.assignment);
  const routePath = args.routePath === "/my-arbitrations" ? "/my-arbitrations" : "/ops/account/arbitrations";
  return `${routePath}?${params.toString()}`;
}

export function readArbitrationsFollowUp(formData: FormData) {
  return {
    caseId: String(formData.get("followUpCaseId") || formData.get("caseId") || "").trim() || null,
    caseStatus: String(formData.get("followUpCaseStatus") || "").trim() || null,
    taskResolutionAction: String(formData.get("followUpTaskResolutionAction") || "").trim() || null,
    impact: String(formData.get("followUpImpact") || "").trim() || null,
    evidenceKind: String(formData.get("followUpEvidenceKind") || "").trim() || null,
    hasEvidence: String(formData.get("followUpHasEvidence") || "").trim() || null,
    assignment: String(formData.get("followUpAssignment") || "").trim() || null,
    routePath: String(formData.get("followUpRoutePath") || "").trim() || null,
  };
}

export type ArbitrationsFollowUp = ReturnType<typeof readArbitrationsFollowUp>;
