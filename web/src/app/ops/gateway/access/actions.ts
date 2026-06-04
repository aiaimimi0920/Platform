"use server";

import { buildBundleDefaultKeyPrefix } from "./bundle-key-prefix";
import { gatewayRequest } from "@/lib/gateway-request";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

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

function buildStatusRedirect(redirectTo: string, status: "success" | "error", message: string) {
  const [pathnameWithQuery, hashFragment] = redirectTo.split("#", 2);
  const params = new URLSearchParams({ status, message });
  const nextLocation = `${pathnameWithQuery}${pathnameWithQuery.includes("?") ? "&" : "?"}${params.toString()}`;
  return hashFragment ? `${nextLocation}#${hashFragment}` : nextLocation;
}

function parseRequiredText(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    throw new Error(`${label}不能为空。`);
  }
  return raw;
}

function parseOptionalText(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function parseGatewayBundleBillingMode(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "time_pass" || raw === "token_prepaid" || raw === "message_prepaid") {
    return raw;
  }
  throw new Error(`${label}不合法。`);
}

function parseOptionalTimestamp(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} 不是合法时间。`);
  }
  return date.toISOString();
}

function parseOptionalInt(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${label}必须是整数。`);
  }
  return parsed;
}

function parseBooleanCheckbox(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function parseJsonObject(value: FormDataEntryValue | null, label: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} 必须是合法 JSON。`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 对象。`);
  }
  return parsed as Record<string, unknown>;
}

function parseIdList(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value : "";
  const seen = new Set<string>();
  return raw
    .split(/\r?\n|,|;/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
}

function buildBundleSlug(displayName: string) {
  const normalized = displayName
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Date.now().toString(36);
  return normalized ? `${normalized}-${suffix}` : `bundle-${suffix}`;
}

function parseIdListFromFormData(formData: FormData, fieldName: string) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of formData.getAll(fieldName)) {
    const raw = typeof entry === "string" ? entry : "";
    for (const value of raw.split(/\r?\n|,|;/)) {
      const normalized = value.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function parseAggregateMemberships(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value : "";
  const memberships: Array<{ memberAccessKeyId: string; priority: number }> = [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const [memberAccessKeyId, priorityRaw] = trimmed.split(",").map((item) => item.trim());
    if (!memberAccessKeyId) {
      throw new Error("聚合成员格式必须是 memberAccessKeyId,priority。");
    }
    if (seen.has(memberAccessKeyId)) {
      continue;
    }
    seen.add(memberAccessKeyId);
    const priority = priorityRaw ? Number(priorityRaw) : 100;
    if (!Number.isFinite(priority) || !Number.isInteger(priority)) {
      throw new Error(`聚合成员 ${memberAccessKeyId} 的优先级必须是整数。`);
    }
    memberships.push({ memberAccessKeyId, priority });
  }
  return memberships;
}

export async function saveGatewayProviderCapabilityAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessId = parseOptionalText(formData.get("accessId"));
  const body = {
    providerAccountId: parseRequiredText(formData.get("providerAccountId"), "服务商账户"),
    modelCode: parseRequiredText(formData.get("modelCode"), "模型代码"),
    endpointKind: parseRequiredText(formData.get("endpointKind"), "Endpoint Kind"),
    upstreamModel: parseOptionalText(formData.get("upstreamModel")),
    enabled: parseBooleanCheckbox(formData.get("enabled")),
  };

  try {
    await gatewayRequest(
      accessId
        ? `/v1/internal/gateway/access/provider-capabilities/${encodeURIComponent(accessId)}`
        : "/v1/internal/gateway/access/provider-capabilities",
      {
        method: "POST",
        userContext,
        body,
      },
    );
    redirect(buildStatusRedirect(redirectTo, "success", accessId ? "服务商能力已更新。" : "服务商能力已创建。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存服务商能力失败。")));
  }
}

export async function saveGatewayPlatformAccessAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessId = parseOptionalText(formData.get("accessId"));
  const body = {
    providerCapabilityId: parseRequiredText(formData.get("providerCapabilityId"), "服务商能力 ID"),
    modelCode: parseRequiredText(formData.get("modelCode"), "模型代码"),
    endpointKind: parseRequiredText(formData.get("endpointKind"), "Endpoint Kind"),
    upstreamModel: parseOptionalText(formData.get("upstreamModel")),
    platformTier: parseRequiredText(formData.get("platformTier"), "平台档位"),
    status: parseRequiredText(formData.get("status"), "状态"),
    operatorWeight: parseOptionalInt(formData.get("operatorWeight"), "排序权重") ?? 100,
    routingPriority: parseOptionalInt(formData.get("routingPriority"), "路由优先级") ?? 100,
    enabledForSale: parseBooleanCheckbox(formData.get("enabledForSale")),
    notes: parseOptionalText(formData.get("notes")),
  };

  try {
    await gatewayRequest(
      accessId
        ? `/v1/internal/gateway/access/platform-access/${encodeURIComponent(accessId)}`
        : "/v1/internal/gateway/access/platform-access",
      {
        method: "POST",
        userContext,
        body,
      },
    );
    redirect(buildStatusRedirect(redirectTo, "success", accessId ? "平台访问行已更新。" : "平台访问行已创建。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存平台访问行失败。")));
  }
}

export async function saveGatewayAccessBundleAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const bundleId = parseOptionalText(formData.get("bundleId"));
  const body = {
    projectId: parseOptionalText(formData.get("projectId")),
    slug: parseRequiredText(formData.get("slug"), "Bundle Slug"),
    displayName: parseRequiredText(formData.get("displayName"), "Bundle 名称"),
    billingMode: parseRequiredText(formData.get("billingMode"), "计费模式"),
    status: parseRequiredText(formData.get("status"), "状态"),
    description: parseOptionalText(formData.get("description")),
    metadata: parseJsonObject(formData.get("metadata"), "Bundle Metadata"),
  };

  try {
    await gatewayRequest(
      bundleId
        ? `/v1/internal/gateway/access/bundles/${encodeURIComponent(bundleId)}`
        : "/v1/internal/gateway/access/bundles",
      {
        method: "POST",
        userContext,
        body,
      },
    );
    redirect(buildStatusRedirect(redirectTo, "success", bundleId ? "Bundle 已更新。" : "Bundle 已创建。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存 Bundle 失败。")));
  }
}

export async function createGatewayAccessBundleMatrixAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const platformAccessIds = parseIdListFromFormData(formData, "platformAccessIds");
  if (platformAccessIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请至少勾选一个服务商 / 模型组合。"));
  }

  const displayName = parseRequiredText(formData.get("displayName"), "Bundle 名称");
  const body = {
    projectId: parseOptionalText(formData.get("projectId")),
    slug: buildBundleSlug(displayName),
    displayName,
    billingMode: parseRequiredText(formData.get("billingMode"), "计费模式"),
    status: "active",
    description: null,
    metadata: null,
  };

  try {
    const bundle = await gatewayRequest<{ id: string; displayName: string }>("/v1/internal/gateway/access/bundles", {
      method: "POST",
      userContext,
      body,
    });
    await gatewayRequest(`/v1/internal/gateway/access/bundles/${encodeURIComponent(bundle.id)}/items/replace`, {
      method: "POST",
      userContext,
      body: { platformAccessIds },
    });
    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `${bundle.displayName} 已创建，并写入 ${platformAccessIds.length} 条访问行。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "创建 Bundle 失败。")));
  }
}

export async function deleteGatewayAccessBundleAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const bundleId = parseRequiredText(formData.get("bundleId"), "Bundle");
  const displayName = parseOptionalText(formData.get("displayName")) ?? "Bundle";

  try {
    await gatewayRequest(`/v1/internal/gateway/access/bundles/${encodeURIComponent(bundleId)}`, {
      method: "DELETE",
      userContext,
    });
    redirect(buildStatusRedirect(redirectTo, "success", `${displayName} 已删除。`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "删除 Bundle 失败。")));
  }
}

export async function createGatewayBundlePromoAccessKeyAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const bundleId = parseRequiredText(formData.get("bundleId"), "Bundle");
  const resolvedProjectId = parseRequiredText(formData.get("resolvedProjectId"), "Project ID");
  const resolvedTenantId = parseRequiredText(formData.get("resolvedTenantId"), "Tenant ID");
  const displayName = parseRequiredText(formData.get("displayName"), "活动 Key 名称");
  const expiresAt = parseOptionalTimestamp(formData.get("expiresAt"), "过期时间");
  const billingMode = parseRequiredText(formData.get("billingMode"), "计费模式");
  const totalTokens = parseOptionalInt(formData.get("totalTokens"), "总 Token");
  const totalMessages = parseOptionalInt(formData.get("totalMessages"), "总请求数");
  const publicKeyPrefix = buildBundleDefaultKeyPrefix(bundleId, billingMode);

  if (billingMode === "time_pass" && !expiresAt) {
    redirect(buildStatusRedirect(redirectTo, "error", "按天数计费的活动 Key 必须填写过期时间。"));
  }
  if (billingMode === "token_prepaid" && (!totalTokens || totalTokens <= 0)) {
    redirect(buildStatusRedirect(redirectTo, "error", "按 Token 计费的活动 Key 必须填写正整数 Token 数。"));
  }
  if (billingMode === "message_prepaid" && (!totalMessages || totalMessages <= 0)) {
    redirect(buildStatusRedirect(redirectTo, "error", "按请求数计费的活动 Key 必须填写正整数请求数。"));
  }

  try {
    const accessKey = await gatewayRequest<{ id: string; displayName: string }>(
      "/v1/internal/gateway/access/keys",
      {
        method: "POST",
        userContext,
        body: {
          ownerType: "platform",
          ownerId: "bundle-promo",
          resolvedProjectId,
          resolvedTenantId,
          keyKind: "normal",
          publicKeyPrefix,
          displayName,
          expiresAt,
          metadata: {
            promo: true,
            source: "operator_bundle_promo",
            bundleId,
            keyPrefix: publicKeyPrefix,
          },
          bundleIds: [bundleId],
        },
      },
    );

    await gatewayRequest(`/v1/internal/gateway/access/keys/${encodeURIComponent(accessKey.id)}/balances/adjust`, {
      method: "POST",
      userContext,
      body:
        billingMode === "time_pass"
          ? {
              balanceMode: billingMode,
              status: "active",
              unlimitedUntil: expiresAt,
              periodStartsAt: new Date().toISOString(),
              periodEndsAt: expiresAt,
            }
          : billingMode === "message_prepaid"
            ? {
                balanceMode: billingMode,
                status: "active",
                totalMessages,
              }
            : {
                balanceMode: billingMode,
                status: "active",
                totalTokens,
              },
    });

    redirect(buildStatusRedirect(redirectTo, "success", `${displayName} 已创建为活动 Key。`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "创建活动 Key 失败。")));
  }
}

export async function saveGatewayBundlePlatformKeyAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessKeyId = parseOptionalText(formData.get("accessKeyId"));
  const bundleId = parseRequiredText(formData.get("bundleId"), "Bundle");
  const resolvedProjectId = parseRequiredText(formData.get("resolvedProjectId"), "Project ID");
  const resolvedTenantId = parseRequiredText(formData.get("resolvedTenantId"), "Tenant ID");
  const displayName = parseRequiredText(formData.get("displayName"), "平台密钥名称");
  const billingMode = parseGatewayBundleBillingMode(formData.get("billingMode"), "Bundle 计费模式");
  const expiresAt = formData.has("expiresAt")
    ? parseOptionalTimestamp(formData.get("expiresAt"), "密钥过期时间")
    : undefined;
  const timePassUntil = formData.has("timePassUntil")
    ? parseOptionalTimestamp(formData.get("timePassUntil"), "有效到期")
    : undefined;
  const balanceStatus = parseOptionalText(formData.get("balanceStatus")) ?? "active";
  const initialTotalTokens = parseOptionalInt(formData.get("initialTotalTokens"), "初始 Token");
  const initialTotalMessages = parseOptionalInt(formData.get("initialTotalMessages"), "初始请求数");
  const tokenDelta = parseOptionalInt(formData.get("tokenDelta"), "补充 Token");
  const messageDelta = parseOptionalInt(formData.get("messageDelta"), "补充请求数");
  const note = parseOptionalText(formData.get("note"));
  const publicKeyPrefix = buildBundleDefaultKeyPrefix(bundleId, billingMode);
  const effectiveExpiresAt =
    typeof expiresAt !== "undefined"
      ? expiresAt
      : !accessKeyId && billingMode === "time_pass"
        ? (timePassUntil ?? null)
        : undefined;

  if (!accessKeyId) {
    if (billingMode === "time_pass" && !timePassUntil) {
      redirect(buildStatusRedirect(redirectTo, "error", "按天数计费的平台密钥必须填写有效到期。"));
    }
    if (billingMode === "token_prepaid" && (!initialTotalTokens || initialTotalTokens <= 0)) {
      redirect(buildStatusRedirect(redirectTo, "error", "按 Token 计费的平台密钥必须填写正整数初始 Token。"));
    }
    if (billingMode === "message_prepaid" && (!initialTotalMessages || initialTotalMessages <= 0)) {
      redirect(buildStatusRedirect(redirectTo, "error", "按请求数计费的平台密钥必须填写正整数初始请求数。"));
    }
  }

  try {
    const accessKey = await gatewayRequest<{ id: string; displayName: string }>(
      accessKeyId
        ? `/v1/internal/gateway/access/keys/${encodeURIComponent(accessKeyId)}`
        : "/v1/internal/gateway/access/keys",
      {
        method: "POST",
        userContext,
        body: {
          ownerType: "platform",
          ownerId: "bundle-platform-key",
          resolvedProjectId,
          resolvedTenantId,
          keyKind: "normal",
          publicKeyPrefix,
          displayName,
          expiresAt: effectiveExpiresAt,
          metadata: {
            platformKey: true,
            source: "operator_bundle_platform_key",
            bundleId,
            keyPrefix: publicKeyPrefix,
            note,
          },
          bundleIds: [bundleId],
        },
      },
    );

    const balanceBody: Record<string, unknown> = {
      balanceMode: billingMode,
      status: balanceStatus,
    };
    if (billingMode === "time_pass") {
      if (timePassUntil) {
        balanceBody.unlimitedUntil = timePassUntil;
        balanceBody.periodEndsAt = timePassUntil;
      }
      if (!accessKeyId) {
        balanceBody.periodStartsAt = new Date().toISOString();
      }
    } else if (billingMode === "message_prepaid") {
      if (!accessKeyId && initialTotalMessages) {
        balanceBody.totalMessages = initialTotalMessages;
      }
      if (typeof messageDelta === "number") {
        balanceBody.messageDelta = messageDelta;
      }
    } else {
      if (!accessKeyId && initialTotalTokens) {
        balanceBody.totalTokens = initialTotalTokens;
      }
      if (typeof tokenDelta === "number") {
        balanceBody.tokenDelta = tokenDelta;
      }
    }

    await gatewayRequest(`/v1/internal/gateway/access/keys/${encodeURIComponent(accessKey.id)}/balances/adjust`, {
      method: "POST",
      userContext,
      body: balanceBody,
    });

    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        accessKeyId ? `${displayName} 已更新。` : `${displayName} 已创建为平台密钥。`,
      ),
    );
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存平台密钥失败。")));
  }
}

export async function deleteGatewayBundlePlatformKeyAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessKeyId = parseRequiredText(formData.get("accessKeyId"), "平台密钥");
  const displayName = parseOptionalText(formData.get("displayName")) ?? "平台密钥";

  try {
    await gatewayRequest(`/v1/internal/gateway/access/keys/${encodeURIComponent(accessKeyId)}`, {
      method: "DELETE",
      userContext,
    });
    redirect(buildStatusRedirect(redirectTo, "success", `${displayName} 已删除。`));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "删除平台密钥失败。")));
  }
}

export async function replaceGatewayAccessBundleItemsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const bundleId = parseRequiredText(formData.get("bundleId"), "Bundle");
  const platformAccessIds = parseIdList(formData.get("platformAccessIds"));

  try {
    await gatewayRequest(`/v1/internal/gateway/access/bundles/${encodeURIComponent(bundleId)}/items/replace`, {
      method: "POST",
      userContext,
      body: { platformAccessIds },
    });
    redirect(buildStatusRedirect(redirectTo, "success", "Bundle 勾选表已替换。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "替换 Bundle 勾选表失败。")));
  }
}

export async function saveGatewayAccessKeyAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessKeyId = parseOptionalText(formData.get("accessKeyId"));
  const body = {
    ownerType: parseRequiredText(formData.get("ownerType"), "Owner Type"),
    ownerId: parseRequiredText(formData.get("ownerId"), "Owner ID"),
    resolvedProjectId: parseRequiredText(formData.get("resolvedProjectId"), "Project ID"),
    resolvedTenantId: parseRequiredText(formData.get("resolvedTenantId"), "Tenant ID"),
    keyKind: parseRequiredText(formData.get("keyKind"), "Key Kind"),
    publicKeyPrefix: parseRequiredText(formData.get("publicKeyPrefix"), "公开前缀"),
    displayName: parseRequiredText(formData.get("displayName"), "Key 名称"),
    expiresAt: parseOptionalTimestamp(formData.get("expiresAt"), "过期时间"),
    metadata: parseJsonObject(formData.get("metadata"), "Key Metadata"),
    bundleIds: parseIdList(formData.get("bundleIds")),
  };

  try {
    await gatewayRequest(
      accessKeyId
        ? `/v1/internal/gateway/access/keys/${encodeURIComponent(accessKeyId)}`
        : "/v1/internal/gateway/access/keys",
      {
        method: "POST",
        userContext,
        body,
      },
    );
    redirect(buildStatusRedirect(redirectTo, "success", accessKeyId ? "Access Key 已更新。" : "Access Key 已创建。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "保存 Access Key 失败。")));
  }
}

export async function rotateGatewayAccessKeyAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessKeyId = parseRequiredText(formData.get("accessKeyId"), "Access Key");

  try {
    await gatewayRequest(`/v1/internal/gateway/access/keys/${encodeURIComponent(accessKeyId)}/rotate`, {
      method: "POST",
      userContext,
    });
    redirect(buildStatusRedirect(redirectTo, "success", "Access Key 已轮换。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "轮换 Access Key 失败。")));
  }
}

export async function revokeGatewayAccessKeyAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessKeyId = parseRequiredText(formData.get("accessKeyId"), "Access Key");

  try {
    await gatewayRequest(`/v1/internal/gateway/access/keys/${encodeURIComponent(accessKeyId)}/revoke`, {
      method: "POST",
      userContext,
      body: {
        reason: parseOptionalText(formData.get("reason")),
      },
    });
    redirect(buildStatusRedirect(redirectTo, "success", "Access Key 已撤销。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "撤销 Access Key 失败。")));
  }
}

export async function adjustGatewayAccessKeyBalanceAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessKeyId = parseRequiredText(formData.get("accessKeyId"), "Access Key");

  try {
    await gatewayRequest(`/v1/internal/gateway/access/keys/${encodeURIComponent(accessKeyId)}/balances/adjust`, {
      method: "POST",
      userContext,
      body: {
        balanceMode: parseOptionalText(formData.get("balanceMode")),
        status: parseOptionalText(formData.get("status")),
        unlimitedUntil: parseOptionalTimestamp(formData.get("unlimitedUntil"), "无限额度截止"),
        periodStartsAt: parseOptionalTimestamp(formData.get("periodStartsAt"), "周期开始"),
        periodEndsAt: parseOptionalTimestamp(formData.get("periodEndsAt"), "周期结束"),
        tokenDelta: parseOptionalInt(formData.get("tokenDelta"), "Token Delta"),
        messageDelta: parseOptionalInt(formData.get("messageDelta"), "Message Delta"),
        totalTokens: parseOptionalInt(formData.get("totalTokens"), "总 Token"),
        totalMessages: parseOptionalInt(formData.get("totalMessages"), "总消息数"),
      },
    });
    redirect(buildStatusRedirect(redirectTo, "success", "Access Key 余额已调整。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "调整 Access Key 余额失败。")));
  }
}

export async function replaceGatewayAccessAggregateMembershipsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const accessKeyId = parseRequiredText(formData.get("accessKeyId"), "Auto-route Key");
  const memberships = parseAggregateMemberships(formData.get("memberships"));

  try {
    await gatewayRequest(
      `/v1/internal/gateway/access/keys/${encodeURIComponent(accessKeyId)}/aggregate-memberships/replace`,
      {
        method: "POST",
        userContext,
        body: { memberships },
      },
    );
    redirect(buildStatusRedirect(redirectTo, "success", "自动路由聚合成员已替换。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "替换自动路由聚合成员失败。")));
  }
}

export async function resetGatewayAccessAffinityAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/gateway/access");
  const body = {
    accessKeyId: parseRequiredText(formData.get("accessKeyId"), "Access Key"),
    model: parseRequiredText(formData.get("model"), "模型"),
    explicitSessionKey: parseOptionalText(formData.get("explicitSessionKey")),
  };

  try {
    await gatewayRequest("/v1/internal/gateway/access/affinity", {
      method: "POST",
      userContext,
      body,
    });
    redirect(buildStatusRedirect(redirectTo, "success", "Sticky affinity 已重置。"));
  } catch (error) {
    redirect(buildStatusRedirect(redirectTo, "error", toMessage(error, "重置 Sticky affinity 失败。")));
  }
}
