"use server";

import type {
  BenefitCredentialImportEntryInput,
  CreateBenefitGrantInput,
  UpsertBenefitFamilyInput,
  UpsertBenefitServiceInput,
} from "@/lib/account-client";
import {
  archiveOperatorBenefitService,
  createOperatorBenefitGrant,
  createOperatorBenefitProductBinding,
  createOperatorBenefitService,
  deleteOperatorBenefitProductBinding,
  deleteOperatorBenefitService,
  importOperatorBenefitCredentialPool,
  revokeOperatorBenefitGrant,
  rotateOperatorBenefitAssignment,
  updateOperatorBenefitFamily,
  updateOperatorBenefitService,
} from "@/lib/account-client";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

const DEFAULT_PROVIDER_KEY = "platform_a";
const DEFAULT_ASSIGNMENT_MODE = "sticky";
const DEFAULT_PAYLOAD_SCHEMA_VERSION = "credential-v1";
const DEFAULT_REFILL_DELIVERY_MODE = "direct_credential";
const DEFAULT_API_DELIVERY_MODE = "service_proxy";

function toMessage(error: unknown, fallback: string) {
  if (isRedirectError(error)) {
    throw error;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function resolveRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

function buildStatusRedirect(redirectTo: string, status: "success" | "error", message: string) {
  const params = new URLSearchParams({ status, message });
  return `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${params.toString()}`;
}

function parseNullableText(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function parseRequiredText(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error(`${label}不能为空。`);
  }
  return raw;
}

function parseRequiredInt(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label}必须是非负整数。`);
  }
  return parsed;
}

function parseDeliveryMode(
  value: FormDataEntryValue | null,
  allowed: readonly string[],
  fallback: string,
) {
  const raw = typeof value === "string" ? value.trim() : "";
  return allowed.includes(raw) ? raw : fallback;
}

function parseJsonEntries(value: FormDataEntryValue | null): BenefitCredentialImportEntryInput[] {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error("请填写凭据导入 JSON。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("凭据导入 JSON 格式无效。");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("凭据导入 JSON 至少需要一条记录。");
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`第 ${index + 1} 条凭据不是有效对象。`);
    }
    const record = entry as Record<string, unknown>;
    return {
      entryLabel: typeof record.entryLabel === "string" ? record.entryLabel.trim() || null : null,
      refillCode: typeof record.refillCode === "string" ? record.refillCode.trim() || null : null,
      apiKey: typeof record.apiKey === "string" ? record.apiKey.trim() || null : null,
      apiUrl: typeof record.apiUrl === "string" ? record.apiUrl.trim() || null : null,
    };
  });
}

function parseBenefitFamilyPayload(formData: FormData): UpsertBenefitFamilyInput {
  return {
    title: parseRequiredText(formData.get("title"), "权益族标题"),
    tone: parseRequiredText(formData.get("tone"), "权益族视觉语气") as UpsertBenefitFamilyInput["tone"],
    description: parseNullableText(formData.get("description")),
    sortOrder: parseRequiredInt(formData.get("sortOrder"), "排序值"),
  };
}

function parseBenefitServicePayload(formData: FormData): UpsertBenefitServiceInput {
  const serviceRole = formData.get("serviceRole")?.toString() || "refill";
  const title = parseRequiredText(formData.get("title"), "服务标题");
  const isApiProxy = serviceRole === "api_proxy";

  const productLineId = formData.get("productLineId")?.toString().trim() || null;

  return {
    familyKey: parseRequiredText(formData.get("familyKey"), "权益族") as UpsertBenefitServiceInput["familyKey"],
    productLineId,
    serviceKind: "credential_service_v1",
    status: parseRequiredText(formData.get("status"), "服务状态") as UpsertBenefitServiceInput["status"],
    title,
    sortOrder: parseRequiredInt(formData.get("sortOrder"), "排序值"),
    config: {
      title: formData.get("configTitle")?.toString().trim() || title,
      providerKey: DEFAULT_PROVIDER_KEY,
      assignmentMode: DEFAULT_ASSIGNMENT_MODE,
      payloadSchemaVersion: DEFAULT_PAYLOAD_SCHEMA_VERSION,
      refillDeliveryMode: "direct_credential" as UpsertBenefitServiceInput["config"]["refillDeliveryMode"],
      refillModeText: isApiProxy ? "—" : "无限续杯",
      availabilityLabel: isApiProxy ? "—" : "可用账号数",
      availabilityText: isApiProxy ? "—" : "30/30",
      apiDeliveryMode: (isApiProxy ? "service_proxy" : "direct_credential") as UpsertBenefitServiceInput["config"]["apiDeliveryMode"],
      apiModeText: isApiProxy ? "无限调用" : "—",
      apiUrl: formData.get("apiUrl")?.toString().trim() || "",
      downloadEnabled: formData.get("downloadEnabled") === "on",
      downloadUrl: parseNullableText(formData.get("downloadUrl")),
      autoGenerateKey: formData.get("autoGenerateKey") === "true",
    } as UpsertBenefitServiceInput["config"],
  };
}

export async function saveBenefitFamilyAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");
  const familyKey = parseRequiredText(formData.get("familyKey"), "权益族");

  try {
    const payload = parseBenefitFamilyPayload(formData);
    const family = await updateOperatorBenefitFamily(userContext, familyKey, payload);
    redirect(buildStatusRedirect(redirectTo, "success", `权益族 ${family.title} 已更新。`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "更新权益族失败。")));
  }
}

export async function saveBenefitServiceAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");
  const serviceId = parseNullableText(formData.get("serviceId"));

  try {
    const payload = parseBenefitServicePayload(formData);
    if (serviceId) {
      const service = await updateOperatorBenefitService(userContext, serviceId, payload);
      redirect(buildStatusRedirect(redirectTo, "success", `服务 ${service.title} 已更新。`));
    }

    const service = await createOperatorBenefitService(userContext, payload);
    redirect(buildStatusRedirect(redirectTo, "success", `服务 ${service.title} 已创建。`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存服务失败。")));
  }
}

export async function archiveBenefitServiceAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");
  const serviceId = parseRequiredText(formData.get("serviceId"), "服务");

  try {
    const service = await archiveOperatorBenefitService(userContext, serviceId);
    redirect(buildStatusRedirect(redirectTo, "success", `服务 ${service.title} 已归档。`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "归档服务失败。")));
  }
}

export async function deleteBenefitServiceAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");
  const serviceId = parseRequiredText(formData.get("serviceId"), "服务");

  try {
    await deleteOperatorBenefitService(userContext, serviceId);
    redirect(buildStatusRedirect(redirectTo, "success", "服务已删除。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "删除服务失败。")));
  }
}

export async function addBenefitProductBindingAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");

  try {
    await createOperatorBenefitProductBinding(userContext, {
      serviceId: parseRequiredText(formData.get("serviceId"), "服务"),
      productId: parseRequiredText(formData.get("productId"), "商品"),
    });
    redirect(buildStatusRedirect(redirectTo, "success", "商品映射已保存。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存商品映射失败。")));
  }
}

export async function deleteBenefitProductBindingAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");
  const bindingId = parseRequiredText(formData.get("bindingId"), "商品映射");

  try {
    await deleteOperatorBenefitProductBinding(userContext, bindingId);
    redirect(buildStatusRedirect(redirectTo, "success", "商品映射已删除。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "删除商品映射失败。")));
  }
}

export async function createBenefitGrantAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");

  try {
    const durationDaysRaw = formData.get("durationDays")?.toString().trim();
    const input: CreateBenefitGrantInput = {
      serviceId: parseRequiredText(formData.get("serviceId"), "服务"),
      userId: parseRequiredText(formData.get("userId"), "用户"),
      durationDays: durationDaysRaw ? Number(durationDaysRaw) : null,
    };
    await createOperatorBenefitGrant(userContext, input);
    redirect(buildStatusRedirect(redirectTo, "success", "用户授权已创建。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "创建用户授权失败。")));
  }
}

export async function revokeBenefitGrantAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");
  const grantId = parseRequiredText(formData.get("grantId"), "授权");

  try {
    await revokeOperatorBenefitGrant(userContext, grantId);
    redirect(buildStatusRedirect(redirectTo, "success", "用户授权已回收。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "回收用户授权失败。")));
  }
}

export async function importBenefitCredentialPoolAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");

  try {
    await importOperatorBenefitCredentialPool(userContext, {
      serviceId: parseRequiredText(formData.get("serviceId"), "服务"),
      label: parseRequiredText(formData.get("label"), "导入批次标题"),
      importNote: parseNullableText(formData.get("importNote")),
      entries: parseJsonEntries(formData.get("entriesJson")),
    });
    redirect(buildStatusRedirect(redirectTo, "success", "凭据池导入完成。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "导入凭据池失败。")));
  }
}

export async function rotateBenefitAssignmentAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/account/benefits");

  try {
    await rotateOperatorBenefitAssignment(
      userContext,
      parseRequiredText(formData.get("serviceId"), "服务"),
      parseRequiredText(formData.get("userId"), "用户"),
    );
    redirect(buildStatusRedirect(redirectTo, "success", "用户凭据已轮换。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "轮换用户凭据失败。")));
  }
}
