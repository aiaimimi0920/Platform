"use server";

import { redirect } from "next/navigation";

import type { SponsorHonorProjectInput } from "@neuro/contracts";

import { sponsorHonorProject } from "@/lib/account-client";
import { requirePlatformUserContext } from "@/lib/platform-session";

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

export async function sponsorProjectAction(formData: FormData) {
  const context = await requirePlatformUserContext();
  const projectId = formData.get("projectId");
  const scope = formData.get("scope");
  const ownerHandle = formData.get("ownerHandle");
  const currency = formData.get("currency");
  const amount = Number(formData.get("amount"));

  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    redirect(buildRedirectUrl("error", "项目 ID 缺失。", null, null, null));
  }

  const payload: SponsorHonorProjectInput = {
    amount,
    currency: currency === "obsidian" ? "obsidian" : "mira",
  };

  try {
    const result = await sponsorHonorProject(context, projectId, payload);
    redirect(
      buildRedirectUrl(
        "success",
        `已为 ${result.projectName} 追加 ${result.amount} ${result.currencyLabel} 赞助。`,
        typeof scope === "string" ? scope : null,
        projectId,
        typeof ownerHandle === "string" ? ownerHandle : null,
      ),
    );
  } catch (error) {
    redirect(
      buildRedirectUrl(
        "error",
        error instanceof Error ? error.message : "赞助项目失败。",
        typeof scope === "string" ? scope : null,
        projectId,
        typeof ownerHandle === "string" ? ownerHandle : null,
      ),
    );
  }
}
