"use server";

import {
  currencyKeys,
  type CurrencyKey,
  type UpsertMailboxOpsCampaignInput,
  type UpsertMailboxOpsRecipientBatchInput,
  type UpsertMailboxOpsTemplateInput,
} from "@neuro/contracts";
import {
  cancelOperatorMailboxOpsCampaign,
  createOperatorMailboxOpsCampaign,
  deleteOperatorMailboxOpsRecipientBatch,
  deleteOperatorMailboxOpsTemplate,
  dispatchOperatorMailboxOpsCampaign,
  duplicateOperatorMailboxOpsCampaign,
  saveOperatorMailboxOpsRecipientBatch,
  saveOperatorMailboxOpsTemplate,
  updateOperatorMailboxOpsCampaign,
} from "@/features/mailbox/ops-adapter";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

const ATTACHMENT_SLOT_COUNT = 6;

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

function parseOptionalText(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function parseNullableIsoDateTimeFormValue(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("请输入有效的时间。");
  }
  return parsed.toISOString();
}

function parsePositiveInt(value: FormDataEntryValue | null, fieldLabel: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel}必须是正整数。`);
  }
  return parsed;
}

function parseCurrency(value: FormDataEntryValue | null): CurrencyKey {
  const raw = typeof value === "string" ? value.trim() : "";
  if (currencyKeys.includes(raw as CurrencyKey)) {
    return raw as CurrencyKey;
  }
  throw new Error("请选择有效的货币附件类型。");
}

function buildStatusRedirect(
  redirectTo: string,
  status: "success" | "error",
  message: string,
  extras?: {
    editingId?: string | null;
    templateId?: string | null;
    recipientBatchId?: string | null;
  },
) {
  const params = new URLSearchParams({ status, message });
  if (extras?.editingId) {
    params.set("editingId", extras.editingId);
  }
  if (extras?.templateId) {
    params.set("templateId", extras.templateId);
  }
  if (extras?.recipientBatchId) {
    params.set("recipientBatchId", extras.recipientBatchId);
  }
  return `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${params.toString()}`;
}

function resolveEditorState(formData: FormData) {
  return {
    redirectTo: resolveRedirectPath(formData.get("redirectTo"), "/ops/account/mailbox"),
    campaignId: String(formData.get("campaignId") || "").trim(),
    editingId: String(formData.get("editingId") || "").trim() || null,
    templateId: String(formData.get("templateId") || "").trim() || null,
    recipientBatchId: String(formData.get("recipientBatchId") || "").trim() || null,
  };
}

function parseAttachments(formData: FormData): UpsertMailboxOpsCampaignInput["attachments"] {
  const attachments: NonNullable<UpsertMailboxOpsCampaignInput["attachments"]> = [];

  for (let index = 0; index < ATTACHMENT_SLOT_COUNT; index += 1) {
    const kind = String(formData.get(`attachmentKind_${index}`) || "").trim();
    if (!kind) {
      continue;
    }

    if (kind === "currency") {
      attachments.push({
        kind: "currency",
        currency: parseCurrency(formData.get(`attachmentCurrency_${index}`)),
        amount: parsePositiveInt(formData.get(`attachmentAmount_${index}`), "货币附件数量"),
        title: parseOptionalText(formData.get(`attachmentTitle_${index}`)),
      });
      continue;
    }

    if (kind === "item") {
      const productId = String(formData.get(`attachmentProductId_${index}`) || "").trim();
      if (!productId) {
        throw new Error("Item 附件必须填写 productId。");
      }
      attachments.push({
        kind: "item",
        productId,
        title: parseOptionalText(formData.get(`attachmentTitle_${index}`)),
      });
      continue;
    }

    throw new Error("存在无效的附件类型。");
  }

  return attachments;
}

function parseCampaignPayload(
  formData: FormData,
  status: Extract<NonNullable<UpsertMailboxOpsCampaignInput["status"]>, "draft" | "scheduled">,
): UpsertMailboxOpsCampaignInput {
  return {
    operatorLabel: String(formData.get("operatorLabel") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    summary: parseOptionalText(formData.get("summary")),
    body: String(formData.get("body") || "").trim(),
    type: String(formData.get("type") || "").trim() as UpsertMailboxOpsCampaignInput["type"],
    sourceLabel: parseOptionalText(formData.get("sourceLabel")),
    recipientMode: String(formData.get("recipientMode") || "").trim() as UpsertMailboxOpsCampaignInput["recipientMode"],
    recipientInput: parseOptionalText(formData.get("recipientInput")),
    attachments: parseAttachments(formData),
    expiresAt: parseNullableIsoDateTimeFormValue(formData.get("expiresAt")),
    scheduledAt: parseNullableIsoDateTimeFormValue(formData.get("scheduledAt")),
    status,
  };
}

function parseTemplatePayload(formData: FormData): UpsertMailboxOpsTemplateInput {
  return {
    name: String(formData.get("templateName") || "").trim(),
    description: parseOptionalText(formData.get("templateDescription")),
    operatorLabel: String(formData.get("operatorLabel") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    summary: parseOptionalText(formData.get("summary")),
    body: String(formData.get("body") || "").trim(),
    type: String(formData.get("type") || "").trim() as UpsertMailboxOpsTemplateInput["type"],
    sourceLabel: parseOptionalText(formData.get("sourceLabel")),
    attachments: parseAttachments(formData),
    expiresAt: parseNullableIsoDateTimeFormValue(formData.get("expiresAt")),
  };
}

function parseRecipientBatchPayload(formData: FormData): UpsertMailboxOpsRecipientBatchInput {
  return {
    name: String(formData.get("recipientBatchName") || "").trim(),
    description: parseOptionalText(formData.get("recipientBatchDescription")),
    recipientMode: String(formData.get("recipientMode") || "").trim() as UpsertMailboxOpsRecipientBatchInput["recipientMode"],
    recipientInput: parseOptionalText(formData.get("recipientInput")),
  };
}

function buildPreviewMessage(
  campaign: {
    operatorLabel: string;
    previewRecipientCount: number;
    previewUnresolvedCount: number;
  },
  mode: "draft" | "scheduled",
) {
  const base =
    mode === "scheduled"
      ? `活动 ${campaign.operatorLabel} 已保存为定时发送。`
      : `活动 ${campaign.operatorLabel} 已保存为草稿。`;
  const preview = `当前匹配 ${campaign.previewRecipientCount} 人`;
  const unresolved =
    campaign.previewUnresolvedCount > 0 ? `，未匹配 ${campaign.previewUnresolvedCount} 个标识。` : "。";
  return `${base} ${preview}${unresolved}`;
}

function buildDispatchMessage(result: {
  campaign: { operatorLabel: string };
  dispatchedCount: number;
  failedCount: number;
  unresolvedCount: number;
}) {
  const parts = [`活动 ${result.campaign.operatorLabel} 已发送，成功投递 ${result.dispatchedCount} 人`];
  if (result.unresolvedCount > 0) {
    parts.push(`未匹配 ${result.unresolvedCount} 个标识`);
  }
  if (result.failedCount > result.unresolvedCount) {
    parts.push(`另有 ${result.failedCount - result.unresolvedCount} 个收件人投递失败`);
  }
  return `${parts.join("，")}。`;
}

export async function saveMailboxOpsCampaignAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const state = resolveEditorState(formData);
  const intent = String(formData.get("intent") || "save-draft").trim();

  try {
    if (intent === "save-template") {
      const template = await saveOperatorMailboxOpsTemplate(userContext, parseTemplatePayload(formData));
      redirect(
        buildStatusRedirect(state.redirectTo, "success", `模板 ${template.name} 已保存。`, {
          editingId: state.campaignId || state.editingId,
          templateId: template.id,
          recipientBatchId: state.recipientBatchId,
        }),
      );
    }

    if (intent === "save-recipient-batch") {
      const batch = await saveOperatorMailboxOpsRecipientBatch(userContext, parseRecipientBatchPayload(formData));
      redirect(
        buildStatusRedirect(state.redirectTo, "success", `收件批次 ${batch.name} 已保存。`, {
          editingId: state.campaignId || state.editingId,
          templateId: state.templateId,
          recipientBatchId: batch.id,
        }),
      );
    }

    const status = intent === "save-scheduled" ? "scheduled" : "draft";
    const payload = parseCampaignPayload(formData, status);
    const campaign = state.campaignId
      ? await updateOperatorMailboxOpsCampaign(userContext, state.campaignId, payload)
      : await createOperatorMailboxOpsCampaign(userContext, payload);

    if (intent === "send-now") {
      const result = await dispatchOperatorMailboxOpsCampaign(userContext, campaign.id);
      const resultStatus = result.failedCount > 0 ? "error" : "success";
      redirect(
        buildStatusRedirect(state.redirectTo, resultStatus, buildDispatchMessage(result), {
          editingId: result.campaign.id,
        }),
      );
    }

    redirect(
      buildStatusRedirect(state.redirectTo, "success", buildPreviewMessage(campaign, status), {
        editingId: campaign.id,
      }),
    );
  } catch (error) {
    const message = toMessage(
      error,
      state.campaignId ? "保存邮件活动失败，请稍后重试。" : "创建邮件活动失败，请稍后重试。",
    );
    redirect(
      buildStatusRedirect(state.redirectTo, "error", message, {
        editingId: state.campaignId || state.editingId,
        templateId: state.templateId,
        recipientBatchId: state.recipientBatchId,
      }),
    );
  }
}

export async function dispatchMailboxOpsCampaignAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const state = resolveEditorState(formData);

  if (!state.campaignId) {
    redirect(buildStatusRedirect(state.redirectTo, "error", "缺少待发送的邮件活动。"));
  }

  try {
    const result = await dispatchOperatorMailboxOpsCampaign(userContext, state.campaignId);
    const resultStatus = result.failedCount > 0 ? "error" : "success";
    redirect(
      buildStatusRedirect(state.redirectTo, resultStatus, buildDispatchMessage(result), {
        editingId: result.campaign.id,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "发送邮件活动失败，请稍后重试。");
    redirect(
      buildStatusRedirect(state.redirectTo, "error", message, {
        editingId: state.campaignId,
      }),
    );
  }
}

export async function cancelMailboxOpsCampaignAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const state = resolveEditorState(formData);

  if (!state.campaignId) {
    redirect(buildStatusRedirect(state.redirectTo, "error", "缺少待取消的邮件活动。"));
  }

  try {
    const campaign = await cancelOperatorMailboxOpsCampaign(userContext, state.campaignId);
    redirect(
      buildStatusRedirect(state.redirectTo, "success", `活动 ${campaign.operatorLabel} 已取消。`, {
        editingId: campaign.id,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "取消邮件活动失败，请稍后重试。");
    redirect(
      buildStatusRedirect(state.redirectTo, "error", message, {
        editingId: state.campaignId,
      }),
    );
  }
}

export async function duplicateMailboxOpsCampaignAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const state = resolveEditorState(formData);

  if (!state.campaignId) {
    redirect(buildStatusRedirect(state.redirectTo, "error", "缺少待复制的邮件活动。"));
  }

  try {
    const campaign = await duplicateOperatorMailboxOpsCampaign(userContext, state.campaignId);
    redirect(
      buildStatusRedirect(state.redirectTo, "success", `已复制为新草稿：${campaign.operatorLabel}。`, {
        editingId: campaign.id,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "复制草稿失败，请稍后重试。");
    redirect(
      buildStatusRedirect(state.redirectTo, "error", message, {
        editingId: state.campaignId,
      }),
    );
  }
}

export async function deleteMailboxOpsTemplateAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const state = resolveEditorState(formData);
  const templateId = String(formData.get("targetTemplateId") || "").trim();

  if (!templateId) {
    redirect(buildStatusRedirect(state.redirectTo, "error", "缺少待删除的模板。", {
      editingId: state.editingId,
      templateId: state.templateId,
      recipientBatchId: state.recipientBatchId,
    }));
  }

  try {
    await deleteOperatorMailboxOpsTemplate(userContext, templateId);
    redirect(
      buildStatusRedirect(state.redirectTo, "success", "模板已删除。", {
        editingId: state.editingId,
        recipientBatchId: state.recipientBatchId,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "删除模板失败，请稍后重试。");
    redirect(
      buildStatusRedirect(state.redirectTo, "error", message, {
        editingId: state.editingId,
        templateId: state.templateId,
        recipientBatchId: state.recipientBatchId,
      }),
    );
  }
}

export async function deleteMailboxOpsRecipientBatchAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const state = resolveEditorState(formData);
  const batchId = String(formData.get("targetRecipientBatchId") || "").trim();

  if (!batchId) {
    redirect(buildStatusRedirect(state.redirectTo, "error", "缺少待删除的收件批次。", {
      editingId: state.editingId,
      templateId: state.templateId,
      recipientBatchId: state.recipientBatchId,
    }));
  }

  try {
    await deleteOperatorMailboxOpsRecipientBatch(userContext, batchId);
    redirect(
      buildStatusRedirect(state.redirectTo, "success", "收件批次已删除。", {
        editingId: state.editingId,
        templateId: state.templateId,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "删除收件批次失败，请稍后重试。");
    redirect(
      buildStatusRedirect(state.redirectTo, "error", message, {
        editingId: state.editingId,
        templateId: state.templateId,
        recipientBatchId: state.recipientBatchId,
      }),
    );
  }
}
