"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildDiscountCodeImportPreview,
  parseDiscountCodesCsv,
} from "@/lib/discount-code-ops";
import {
  applyOperatorDiscountCodeBatch,
  deleteOperatorProduct,
  listOperatorDiscountCodes,
  upsertOperatorDiscountCode,
  upsertOperatorProduct,
} from "@/lib/core-client";
import {
  createMarketplaceListing,
  createOrder,
  purchaseMarketplaceListing,
} from "@/lib/platform-client";
import { requirePlatformOperatorUserContext, requirePlatformUserContext } from "@/lib/platform-session";
import {
  createDiscountCodeImportPreviewFlash,
  DISCOUNT_CODE_IMPORT_PREVIEW_FLASH_COOKIE,
} from "@/lib/server-flash";
import {
  appendQueryParams,
  buildStatusRedirect,
  parseBooleanFormValue,
  parseNullableIsoDateTimeFormValue,
  parseNullablePositiveIntFormValue,
  parseNullableQuotaValue,
  parsePositiveIntFormValue,
  resolveRedirectPath,
  toMessage,
} from "@/lib/platform-action-utils";

function buildOperatorProductIdFromSlug(slug: string) {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized ? `product_${normalized}` : "";
}
export async function submitOrderAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/products");
  const productId = String(formData.get("productId") || "");
  const discountCode = String(formData.get("discountCode") || "").trim();
  if (!productId) return;
  try {
    const result = await createOrder(userContext, { productId, discountCode: discountCode || undefined });
    const message =
      result.order.discountSource === "code"
        ? `购买成功，已使用${result.order.discountLabel || "优惠码"}，实付 ${result.order.finalAmount} ${result.order.currency}。`
        : result.order.finalAmount > 0
          ? `购买成功，实付 ${result.order.finalAmount} ${result.order.currency}。`
          : "购买成功，已创建订单并发放 item。";
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "购买失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function upsertOperatorProductAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/products");
  const slug = String(formData.get("slug") || "").trim();
  const productId = String(formData.get("productId") || "").trim() || buildOperatorProductIdFromSlug(slug);
  const gatewayAccessBundleId = String(formData.get("gatewayAccessBundleId") || "").trim() || null;
  const gatewayAccessGrantMode =
    (String(formData.get("gatewayAccessGrantMode") || "").trim() as "time_pass" | "token_prepaid" | "message_prepaid") ||
    null;
  const gatewayAccessGrantQuantity = parseNullablePositiveIntFormValue(formData.get("gatewayAccessGrantQuantity"));
  const hasBundleBinding =
    gatewayAccessBundleId !== null &&
    gatewayAccessGrantMode !== null &&
    gatewayAccessGrantQuantity !== null;

  if (!productId) {
    redirect(buildStatusRedirect(redirectTo, "error", "商品参数无效。"));
  }

  try {
    const result = await upsertOperatorProduct(userContext, productId, {
      slug,
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      kind: String(formData.get("kind") || "").trim() as "limitedTime" | "limitedPurchase" | "unlimited",
      currency: String(formData.get("currency") || "").trim() as "obsidian" | "mira",
      price: Math.max(0, Math.floor(Number(formData.get("price") || 0))),
      fulfillmentMode:
        (hasBundleBinding
          ? "one_time_delivery"
          : String(formData.get("fulfillmentMode") || "").trim() || "one_time_delivery") as
          | "one_time_delivery"
          | "duration_pass"
          | "maintained_pool"
          | "warranty_delivery",
      transferable: hasBundleBinding ? false : parseBooleanFormValue(formData.get("transferable"), false),
      active: parseBooleanFormValue(formData.get("active"), true),
      allowDiscountCodes: parseBooleanFormValue(formData.get("allowDiscountCodes"), true),
      limitScope: String(formData.get("limitScope") || "").trim() as "global" | "targeted",
      targetedAudienceGroupKey:
        (String(formData.get("targetedAudienceGroupKey") || "").trim() as "trusted_users" | "new_users") || null,
      durationDays: hasBundleBinding ? null : parseNullablePositiveIntFormValue(formData.get("durationDays")),
      unitCount: hasBundleBinding ? null : parseNullablePositiveIntFormValue(formData.get("unitCount")),
      warrantyDays: parseBooleanFormValue(formData.get("enableWarranty"))
        ? parseNullablePositiveIntFormValue(formData.get("warrantyDays"))
        : null,
      stockLabel: String(formData.get("stockLabel") || "").trim() || "持续开放",
      tags: (() => {
        const raw = formData.get("tags");
        if (!raw || typeof raw !== "string") return [];
        try { return JSON.parse(raw) as string[]; } catch { return []; }
      })(),
      gatewayAccessBundleId,
      gatewayAccessGrantMode,
      gatewayAccessGrantQuantity,
    });

    const message = result.created
      ? `商品 ${result.product.id} 已创建。`
      : result.eventName === "product.deactivated"
        ? `商品 ${result.product.id} 已更新并停用。`
        : result.changedFields.length > 0
          ? `商品 ${result.product.id} 已更新：${result.changedFields.join("、")}。`
          : `商品 ${result.product.id} 未发生变更。`;

    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "商品更新失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function deleteOperatorProductAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/products");
  const productId = String(formData.get("productId") || "").trim();

  if (!productId) {
    redirect(buildStatusRedirect(redirectTo, "error", "商品参数无效。"));
  }

  try {
    const result = await deleteOperatorProduct(userContext, productId);
    redirect(buildStatusRedirect(redirectTo, "success", `商品 ${result.title} 已删除。`));
  } catch (error) {
    const message = toMessage(error, "商品删除失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function upsertOperatorDiscountCodeAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/products");
  const discountCodeId = String(formData.get("discountCodeId") || "").trim();

  if (!discountCodeId) {
    redirect(buildStatusRedirect(redirectTo, "error", "优惠码参数无效。"));
  }

  try {
    const result = await upsertOperatorDiscountCode(userContext, discountCodeId, {
      code: String(formData.get("code") || "").trim(),
      namespace: String(formData.get("namespace") || "").trim() || null,
      batchLabel: String(formData.get("batchLabel") || "").trim() || null,
      enabled: parseBooleanFormValue(formData.get("enabled"), true),
      scope: String(formData.get("scope") || "").trim() as "allProducts" | "productCategory" | "specificProduct",
      targetProductCategory: String(formData.get("targetProductCategory") || "").trim() || null,
      targetProductId: String(formData.get("targetProductId") || "").trim() || null,
      audienceScope: String(formData.get("audienceScope") || "").trim() as "allUsers" | "userGroup" | "specificUser",
      audienceGroupKey: String(formData.get("audienceGroupKey") || "").trim() || null,
      audienceUserId: String(formData.get("audienceUserId") || "").trim() || null,
      valueKind: String(formData.get("valueKind") || "").trim() as "fixedAmount" | "percentage",
      valueAmount: parsePositiveIntFormValue(formData.get("valueAmount"), "优惠力度"),
      totalMaxUses: parseNullablePositiveIntFormValue(formData.get("totalMaxUses")),
      perUserLimit: parseNullablePositiveIntFormValue(formData.get("perUserLimit")),
      startsAt: parseNullableIsoDateTimeFormValue(formData.get("startsAt")),
      expiresAt: parseNullableIsoDateTimeFormValue(formData.get("expiresAt")),
    });

    const message = result.created
      ? `优惠码 ${result.discountCode.code} 已创建。`
      : result.changedFields.length > 0
        ? `优惠码 ${result.discountCode.code} 已更新：${result.changedFields.join("、")}。`
        : `优惠码 ${result.discountCode.code} 未发生变更。`;

    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "优惠码更新失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function applyOperatorDiscountCodeBatchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/products");
  const discountCodeIds = formData
    .getAll("discountCodeIds")
    .map((discountCodeId) => String(discountCodeId || "").trim())
    .filter((discountCodeId) => discountCodeId.length > 0);

  if (discountCodeIds.length === 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请先选择至少一个优惠码。"));
  }

  try {
    const allDiscountCodes = await listOperatorDiscountCodes(userContext);
    const selectedDiscountCodes = allDiscountCodes.filter((discountCode) => discountCodeIds.includes(discountCode.id));
    const action = String(formData.get("batchAction") || "").trim() as
      | "enable"
      | "disable"
      | "extendExpiry"
      | "disableExpired"
      | "setQuota";
    const result = await applyOperatorDiscountCodeBatch(userContext, {
      discountCodeIds,
      action,
      extendDays:
        action === "extendExpiry"
          ? parsePositiveIntFormValue(formData.get("extendDays"), "延期天数")
          : null,
      totalMaxUses:
        action === "setQuota"
          ? parseNullableQuotaValue(formData, "totalMaxUsesMode", "totalMaxUses")
          : undefined,
      perUserLimit:
        action === "setQuota"
          ? parseNullableQuotaValue(formData, "perUserLimitMode", "perUserLimit")
          : undefined,
    });
    const actionLabel =
      action === "enable"
        ? "批量启用"
        : action === "disable"
          ? "批量停用"
          : action === "extendExpiry"
            ? "批量延期"
            : action === "setQuota"
              ? "批量配额调整"
              : "过期清理";

    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `${actionLabel}完成：影响 ${result.affectedCount} 条，跳过 ${result.skippedCount} 条。`,
      ),
    );
  } catch (error) {
    const message = toMessage(error, "批量处理优惠码失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function importOperatorDiscountCodesCsvAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/products");
  const csvFile = formData.get("csvFile");

  if (!(csvFile instanceof File) || csvFile.size <= 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请上传有效的 CSV 文件。"));
  }

  try {
    const rows = parseDiscountCodesCsv(await csvFile.text());
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const row of rows) {
      const result = await upsertOperatorDiscountCode(userContext, row.discountCodeId, row.input);
      if (result.created) {
        createdCount += 1;
      } else if (result.changedFields.length > 0) {
        updatedCount += 1;
      } else {
        unchangedCount += 1;
      }
    }

    redirect(
      buildStatusRedirect(
        redirectTo,
        "success",
        `CSV 导入完成：创建 ${createdCount} 条，更新 ${updatedCount} 条，未变更 ${unchangedCount} 条，共处理 ${rows.length} 条。`,
      ),
    );
  } catch (error) {
    const message = toMessage(error, "CSV 导入失败，请检查格式后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function previewOperatorDiscountCodesCsvAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/products");
  const csvFile = formData.get("csvFile");

  if (!(csvFile instanceof File) || csvFile.size <= 0) {
    redirect(buildStatusRedirect(redirectTo, "error", "请上传有效的 CSV 文件。"));
  }

  try {
    const rows = parseDiscountCodesCsv(await csvFile.text());
    const existingDiscountCodes = await listOperatorDiscountCodes(userContext);
    const preview = buildDiscountCodeImportPreview({
      rows,
      existingDiscountCodes,
    });

    const flashToken = await createDiscountCodeImportPreviewFlash(preview);
    const cookieStore = await cookies();
    cookieStore.set(DISCOUNT_CODE_IMPORT_PREVIEW_FLASH_COOKIE, flashToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 180,
    });

    redirect(
      appendQueryParams(
        buildStatusRedirect(redirectTo, "success", "CSV 预览已生成，当前尚未写入任何优惠码。"),
        { csvPreview: "1" },
      ),
    );
  } catch (error) {
    const message = toMessage(error, "CSV 预览失败，请检查格式后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function createListingAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/marketplace");
  const itemId = String(formData.get("itemId") || "");
  const price = Number(formData.get("price") || 0);
  const currencyValue = String(formData.get("currency") || "").trim();
  const currency = currencyValue === "mira" || currencyValue === "obsidian" ? currencyValue : undefined;
  if (!itemId || !price) return;
  try {
    await createMarketplaceListing(userContext, { itemId, price, currency });
    redirect(buildStatusRedirect(redirectTo, "success", "资产已挂牌到市场。"));
  } catch (error) {
    const message = toMessage(error, "挂牌失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function purchaseListingAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/marketplace");
  const listingId = String(formData.get("listingId") || "");
  if (!listingId) return;
  try {
    await purchaseMarketplaceListing(userContext, listingId);
    redirect(buildStatusRedirect(redirectTo, "success", "资产购买成功。"));
  } catch (error) {
    const message = toMessage(error, "购买挂牌资产失败，请稍后重试。");
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}
