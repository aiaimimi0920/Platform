"use server";

import { redirect } from "next/navigation";

import { joinHonorProject } from "@/lib/account-client";
import { requirePlatformUserContext } from "@/lib/platform-session";
import type { JoinHonorProjectInput } from "@neuro/contracts";

const BASE_PROJECTS_PATH = "/projects";

function buildRedirectUrl(
  status: "success" | "error",
  message: string,
  scope: string | null,
  projectId: string | null,
  ownerHandle: string | null,
) {
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("message", message);
  if (scope) params.set("scope", scope);
  if (projectId) params.set("project", projectId);
  if (ownerHandle) params.set("owner", ownerHandle);
  return `${BASE_PROJECTS_PATH}?${params.toString()}`;
}

export async function joinProjectAction(formData: FormData) {
  const context = await requirePlatformUserContext();
  const projectId = formData.get("projectId");
  const scope = formData.get("scope");
  const ownerHandle = formData.get("ownerHandle");

  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    redirect(buildRedirectUrl("error", "项目 ID 缺失。", null, null, null));
  }

  const payload: JoinHonorProjectInput = {
    roleLabel: (formData.get("roleLabel") as string | null)?.trim() ?? "",
    note: (formData.get("note") as string | null)?.trim() ?? null,
  };

  try {
    await joinHonorProject(context, projectId, payload);
    redirect(
      buildRedirectUrl(
        "success",
        "加入申请已提交，项目方会尽快处理。",
        typeof scope === "string" ? scope : null,
        projectId,
        typeof ownerHandle === "string" ? ownerHandle : null,
      ),
    );
  } catch (error) {
    redirect(
      buildRedirectUrl(
        "error",
        error instanceof Error ? error.message : "加入项目失败。",
        typeof scope === "string" ? scope : null,
        projectId,
        typeof ownerHandle === "string" ? ownerHandle : null,
      ),
    );
  }
}
