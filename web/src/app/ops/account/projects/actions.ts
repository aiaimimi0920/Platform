"use server";
import {
  archiveOperatorHonorProject,
  createOperatorHonorProject,
  deleteOperatorHonorProject,
  deleteOperatorHonorProjectInvestment,
  upsertOperatorHonorProjectInvestment,
  updateOperatorHonorProject,
  type UpsertHonorProjectInput,
  type UpsertHonorProjectInvestmentInput,
} from "@/lib/account-client";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

const BASE_REDIRECT_PATH = "/ops/account/projects";

function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function resolveRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

function buildStatusRedirect(
  redirectTo: string,
  status: "success" | "error",
  message: string,
  options?: { editingId?: string },
) {
  const params = new URLSearchParams({ status, message });
  if (options?.editingId) {
    params.set("editingId", options.editingId);
  }
  return `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${params.toString()}`;
}

function parseRequiredText(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error(`${label}不能为空。`);
  }
  return raw;
}

function parseNullableText(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function parseNonNegativeInt(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label}必须是非负整数。`);
  }
  return parsed;
}

function parsePercent(value: FormDataEntryValue | null, label: string) {
  const parsed = parseNonNegativeInt(value, label);
  if (parsed > 100) {
    throw new Error(`${label}必须在 0 到 100 之间。`);
  }
  return parsed;
}

function parseBoolean(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${label}必须是布尔值。`);
}

function parseProjectStatus(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "active" || raw === "archived") {
    return raw;
  }
  throw new Error("请选择有效的项目状态。");
}

function parseProjectPayload(formData: FormData): UpsertHonorProjectInput {
  return {
    name: parseRequiredText(formData.get("name"), "项目名称"),
    summary: parseRequiredText(formData.get("summary"), "项目摘要"),
    publicHref: parseNullableText(formData.get("publicHref")),
    ownerHandle: parseRequiredText(formData.get("ownerHandle"), "负责人标识"),
    ownerLabel: parseRequiredText(formData.get("ownerLabel"), "负责人名称"),
    categoryLabel: parseRequiredText(formData.get("categoryLabel"), "项目分类"),
    stageLabel: parseRequiredText(formData.get("stageLabel"), "项目阶段"),
    progressPercent: parsePercent(formData.get("progressPercent"), "项目进度"),
    progressLabel: parseRequiredText(formData.get("progressLabel"), "进度说明"),
    rewardShareLabel: parseRequiredText(formData.get("rewardShareLabel"), "分润承诺"),
    sponsorOpen: parseBoolean(formData.get("sponsorOpen"), "赞助状态"),
    sponsorStatusLabel: parseRequiredText(formData.get("sponsorStatusLabel"), "赞助状态文案"),
    joinOpen: parseBoolean(formData.get("joinOpen"), "加入状态"),
    joinStatusLabel: parseRequiredText(formData.get("joinStatusLabel"), "加入状态文案"),
    collaborationLabel: parseRequiredText(formData.get("collaborationLabel"), "协作方式"),
    fundingTargetAmount: parseNonNegativeInt(formData.get("fundingTargetAmount"), "目标规模"),
    workspaceHref: parseRequiredText(formData.get("workspaceHref"), "工作目录链接"),
    workspaceLabel: parseRequiredText(formData.get("workspaceLabel"), "工作目录标签"),
    detailBody: parseRequiredText(formData.get("detailBody"), "项目详情"),
    sponsorCount: parseNonNegativeInt(formData.get("sponsorCount"), "资助人数"),
    sponsoredAmount: parseNonNegativeInt(formData.get("sponsoredAmount"), "资助金额"),
    sponsoredCurrencyLabel: parseRequiredText(formData.get("sponsoredCurrencyLabel"), "资助货币"),
    sortOrder: parseNonNegativeInt(formData.get("sortOrder"), "排序值"),
    status: parseProjectStatus(formData.get("status")),
  };
}

function parseInvestmentPayload(formData: FormData): UpsertHonorProjectInvestmentInput {
  return {
    projectId: parseRequiredText(formData.get("investmentProjectId"), "项目"),
    userId: parseRequiredText(formData.get("userId"), "用户"),
    investedAmount: parseNonNegativeInt(formData.get("investedAmount"), "投资额"),
    currencyLabel: parseRequiredText(formData.get("currencyLabel"), "投资货币"),
  };
}

export async function saveHonorProjectAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), BASE_REDIRECT_PATH);
  const editingId = parseNullableText(formData.get("projectId"));

  try {
    const payload = parseProjectPayload(formData);
    const project = editingId
      ? await updateOperatorHonorProject(userContext, editingId, payload)
      : await createOperatorHonorProject(userContext, payload);
    redirect(
      buildStatusRedirect(redirectTo, "success", `项目 ${project.name} 已保存。`, {
        editingId: project.id,
      }),
    );
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "保存项目失败。"),
        { editingId: editingId || "new" },
      ),
    );
  }
}

export async function archiveHonorProjectAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), BASE_REDIRECT_PATH);
  const projectId = parseRequiredText(formData.get("projectId"), "项目");
  try {
    const project = await archiveOperatorHonorProject(userContext, projectId);
    redirect(
      buildStatusRedirect(redirectTo, "success", `项目 ${project.name} 已归档。`, {
        editingId: project.id,
      }),
    );
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "归档项目失败。"),
        { editingId: projectId },
      ),
    );
  }
}

export async function deleteHonorProjectAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), BASE_REDIRECT_PATH);
  const projectId = parseRequiredText(formData.get("projectId"), "项目");
  try {
    await deleteOperatorHonorProject(userContext, projectId);
    redirect(buildStatusRedirect(redirectTo, "success", "项目已删除。", { editingId: "new" }));
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "删除项目失败。"),
        { editingId: "new" },
      ),
    );
  }
}

export async function saveHonorProjectInvestmentAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), BASE_REDIRECT_PATH);
  const editingProjectId = parseNullableText(formData.get("editingProjectId")) || "new";
  try {
    const investment = await upsertOperatorHonorProjectInvestment(userContext, parseInvestmentPayload(formData));
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `用户 ${investment.username} 的投资已更新。`,
        { editingId: editingProjectId },
      ),
    );
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "保存投资记录失败。"),
        { editingId: editingProjectId },
      ),
    );
  }
}

export async function deleteHonorProjectInvestmentAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), BASE_REDIRECT_PATH);
  const investmentId = parseRequiredText(formData.get("investmentId"), "投资记录");
  const editingProjectId = parseNullableText(formData.get("editingProjectId")) || "new";
  try {
    await deleteOperatorHonorProjectInvestment(userContext, investmentId);
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        "投资记录已删除。",
        { editingId: editingProjectId },
      ),
    );
  } catch (error) {
    redirect(
      buildStatusRedirect(
        redirectTo,
        "error",
        toMessage(error, "删除投资记录失败。"),
        { editingId: editingProjectId },
      ),
    );
  }
}
