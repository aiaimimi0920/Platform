import type { MailboxOpsAttachmentInput } from "@neuro/contracts";
import type {
  MailboxOpsCampaignDeliveryView,
  MailboxOpsCampaignView,
  MailboxOpsRecipientBatchView,
  MailboxOpsTemplateView,
} from "@neuro/contracts";
import {
  listOperatorMailboxOpsCampaignDeliveries,
  listOperatorMailboxOpsCampaigns,
  listOperatorMailboxOpsRecipientBatches,
  listOperatorMailboxOpsTemplates,
} from "@/features/mailbox/ops-adapter";
import { auth } from "@/auth";
import { CurrencyIcon } from "@/components/currency-icon";
import { cn } from "@/lib/cn";
import { getCurrencyLabel, rewardCurrencyOptions } from "@/lib/currency-display";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  cancelMailboxOpsCampaignAction,
  deleteMailboxOpsRecipientBatchAction,
  deleteMailboxOpsTemplateAction,
  dispatchMailboxOpsCampaignAction,
  duplicateMailboxOpsCampaignAction,
  saveMailboxOpsCampaignAction,
} from "./actions";

type MailboxOpsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    editingId?: string;
    templateId?: string;
    recipientBatchId?: string;
  }>;
};

type AttachmentSlot = {
  kind: "" | MailboxOpsAttachmentInput["kind"];
  currency: "mira" | "obsidian" | "opinionTickets";
  amount: string;
  productId: string;
  title: string;
};

const ATTACHMENT_SLOT_COUNT = 6;

const STATUS_OPTIONS = [
  { value: "draft" as const, label: "草稿" },
  { value: "scheduled" as const, label: "定时发送" },
  { value: "sending" as const, label: "发送中" },
  { value: "sent" as const, label: "已发出" },
  { value: "partial" as const, label: "部分失败" },
  { value: "failed" as const, label: "发送失败" },
  { value: "canceled" as const, label: "已取消" },
];

const TYPE_OPTIONS = [
  { value: "system" as const, label: "系统信" },
  { value: "reward" as const, label: "奖励信" },
  { value: "compensation" as const, label: "补偿信" },
];

const RECIPIENT_MODE_OPTIONS = [
  {
    value: "allUsers" as const,
    label: "全量用户",
    hint: "向当前全部账户用户发信，适合系统公告、全服补偿和活动结算。",
    placeholder: "全量用户模式不需要填写收件人标识。",
  },
  {
    value: "userIds" as const,
    label: "按本地用户 ID",
    hint: "适合从内部系统拿到精确 userId 后定向发信。",
    placeholder: "每行一个 userId，或使用逗号/分号分隔。",
  },
  {
    value: "usernames" as const,
    label: "按用户名",
    hint: "适合按平台用户名点对点触达，后台会做精确匹配。",
    placeholder: "每行一个用户名，或使用逗号/分号分隔。",
  },
  {
    value: "providerUserIds" as const,
    label: "按 Linux.do ID",
    hint: "适合按外部身份定向发信，后台会匹配绑定到本地账户的 provider user id。",
    placeholder: "每行一个 provider user id，或使用逗号/分号分隔。",
  },
];

function formatShanghaiDateTime(value: string | null) {
  if (!value) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const partValue = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${partValue("year")}-${partValue("month")}-${partValue("day")}T${partValue("hour")}:${partValue("minute")}`;
}

function getStatusLabel(status: MailboxOpsCampaignView["status"]) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function statusDotClass(status: MailboxOpsCampaignView["status"]) {
  if (status === "sent") return "ops-status-dot--active";
  if (status === "scheduled" || status === "sending") return "ops-status-dot--scheduled";
  if (status === "partial" || status === "failed") return "ops-status-dot--inactive";
  return "ops-status-dot--scheduled";
}

function getTypeLabel(type: MailboxOpsCampaignView["type"] | MailboxOpsTemplateView["type"]) {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function typeDotClass(
  type: MailboxOpsCampaignView["type"] | MailboxOpsTemplateView["type"],
): string {
  if (type === "reward") return "ops-status-dot--scheduled";
  if (type === "compensation") return "ops-status-dot--active";
  return "ops-status-dot--inactive";
}

function getRecipientModeLabel(
  mode: MailboxOpsCampaignView["recipientMode"] | MailboxOpsRecipientBatchView["recipientMode"],
) {
  return RECIPIENT_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function getRecipientModeHint(mode: MailboxOpsCampaignView["recipientMode"]) {
  return RECIPIENT_MODE_OPTIONS.find((option) => option.value === mode)?.hint ?? "";
}

function getRecipientModePlaceholder(mode: MailboxOpsCampaignView["recipientMode"]) {
  return RECIPIENT_MODE_OPTIONS.find((option) => option.value === mode)?.placeholder ?? "每行一个标识。";
}

function buildBlankDraft(): MailboxOpsCampaignView {
  const timestamp = new Date().toISOString();
  return {
    id: "",
    operatorLabel: "",
    title: "",
    summary: null,
    body: "",
    type: "system",
    sourceLabel: null,
    recipientMode: "allUsers",
    recipientInput: null,
    attachments: [],
    attachmentCount: 0,
    previewRecipientCount: 0,
    previewUnresolvedCount: 0,
    previewUnresolvedTargets: [],
    targetCount: 0,
    sentCount: 0,
    failedCount: 0,
    status: "draft",
    expiresAt: null,
    scheduledAt: null,
    lastDispatchedAt: null,
    completedAt: null,
    lastError: null,
    createdByUserId: "",
    updatedByUserId: "",
    dispatchedByUserId: null,
    canceledByUserId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildComposedDraft(args: {
  template: MailboxOpsTemplateView | null;
  recipientBatch: MailboxOpsRecipientBatchView | null;
}): MailboxOpsCampaignView {
  const draft = buildBlankDraft();

  if (args.template) {
    draft.operatorLabel = args.template.operatorLabel;
    draft.title = args.template.title;
    draft.summary = args.template.summary;
    draft.body = args.template.body;
    draft.type = args.template.type;
    draft.sourceLabel = args.template.sourceLabel;
    draft.attachments = args.template.attachments;
    draft.attachmentCount = args.template.attachmentCount;
    draft.expiresAt = args.template.expiresAt;
  }

  if (args.recipientBatch) {
    draft.recipientMode = args.recipientBatch.recipientMode;
    draft.recipientInput = args.recipientBatch.recipientInput;
    draft.previewRecipientCount = args.recipientBatch.previewRecipientCount;
    draft.previewUnresolvedCount = args.recipientBatch.previewUnresolvedCount;
    draft.previewUnresolvedTargets = args.recipientBatch.previewUnresolvedTargets;
  }

  return draft;
}

function canEditCampaign(status: MailboxOpsCampaignView["status"]) {
  return status === "draft" || status === "scheduled";
}

function canDispatchCampaign(status: MailboxOpsCampaignView["status"]) {
  return status === "draft" || status === "scheduled" || status === "partial" || status === "failed";
}

function buildAttachmentSlots(attachments: MailboxOpsAttachmentInput[]): AttachmentSlot[] {
  const slots: AttachmentSlot[] = Array.from({ length: ATTACHMENT_SLOT_COUNT }, () => ({
    kind: "",
    currency: "mira",
    amount: "",
    productId: "",
    title: "",
  }));

  attachments.slice(0, ATTACHMENT_SLOT_COUNT).forEach((attachment, index) => {
    if (attachment.kind === "currency") {
      slots[index] = {
        kind: "currency",
        currency: attachment.currency,
        amount: String(attachment.amount),
        productId: "",
        title: attachment.title ?? "",
      };
      return;
    }

    slots[index] = {
      kind: "item",
      currency: "mira",
      amount: "",
      productId: attachment.productId,
      title: attachment.title ?? "",
    };
  });

  return slots;
}

function renderAttachmentSummary(attachment: MailboxOpsAttachmentInput, index: number) {
  if (attachment.kind === "currency") {
    return (
      <div className="app-mailbox-ops__attachment-preview" key={`currency-${index}-${attachment.currency}-${attachment.amount}`}>
        <CurrencyIcon className="app-mailbox-ops__attachment-preview-icon" currency={attachment.currency} />
        <div className="app-mailbox-ops__attachment-preview-copy">
          <strong>
            {getCurrencyLabel(attachment.currency)} x {attachment.amount}
          </strong>
          <span>{attachment.title || "货币附件"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-mailbox-ops__attachment-preview" key={`item-${index}-${attachment.productId}`}>
      <span className="app-mailbox-ops__attachment-preview-item">Item</span>
      <div className="app-mailbox-ops__attachment-preview-copy">
        <strong>{attachment.title || "商品附件"}</strong>
        <span>{attachment.productId}</span>
      </div>
    </div>
  );
}

function buildMailboxOpsHref(args: {
  editingId?: string | null;
  templateId?: string | null;
  recipientBatchId?: string | null;
}) {
  const params = new URLSearchParams();
  if (args.editingId) params.set("editingId", args.editingId);
  if (args.templateId) params.set("templateId", args.templateId);
  if (args.recipientBatchId) params.set("recipientBatchId", args.recipientBatchId);
  const query = params.toString();
  return query ? `/ops/account/mailbox?${query}` : "/ops/account/mailbox";
}

function CampaignListItem(props: {
  campaign: MailboxOpsCampaignView;
  active: boolean;
}) {
  return (
    <Link
      className={cn("ops-batch-item", props.active && "ops-batch-item__head--active")}
      href={buildMailboxOpsHref({ editingId: props.campaign.id })}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div className="ops-batch-item__head">
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className={cn("ops-status-dot", statusDotClass(props.campaign.status))}>
            {getStatusLabel(props.campaign.status)}
          </span>
          <span className={cn("ops-status-dot", typeDotClass(props.campaign.type))}>
            {getTypeLabel(props.campaign.type)}
          </span>
          <strong>{props.campaign.title}</strong>
        </span>
      </div>
      <div style={{ padding: "6px 16px 12px", fontSize: "0.82rem", color: "var(--mg-text-muted)" }}>
        <span>{props.campaign.operatorLabel}</span>
        <span style={{ marginLeft: 12 }}>
          {getRecipientModeLabel(props.campaign.recipientMode)} · 预览 {props.campaign.previewRecipientCount}
        </span>
        <span style={{ marginLeft: 12 }}>附件 {props.campaign.attachmentCount}</span>
        <span style={{ marginLeft: 12 }}>
          已发 {props.campaign.sentCount} / 失败 {props.campaign.failedCount}
        </span>
        <span style={{ marginLeft: 12 }}>
          {props.campaign.scheduledAt
            ? `定时：${formatShanghaiDateTime(props.campaign.scheduledAt)}`
            : `更新：${formatShanghaiDateTime(props.campaign.updatedAt)}`}
        </span>
      </div>
    </Link>
  );
}

function LibraryItemShell(props: {
  active: boolean;
  badge: ReactNode;
  title: string;
  description: string | null;
  meta: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className={cn("app-mailbox-ops__library-item", props.active && "app-mailbox-ops__library-item--active")}>
      <div className="app-mailbox-ops__library-item-head">
        {props.badge}
        <strong>{props.title}</strong>
      </div>
      {props.description ? <p className="app-mailbox-ops__library-item-description">{props.description}</p> : null}
      <div className="app-mailbox-ops__library-item-meta">{props.meta}</div>
      <div className="app-mailbox-ops__library-item-actions">{props.actions}</div>
    </div>
  );
}

function TemplateLibrarySection(props: {
  templates: MailboxOpsTemplateView[];
  activeTemplateId: string | null;
  currentRecipientBatchId: string | null;
}) {
  return (
    <section className="app-mailbox-ops__sidebar-section">
      <div className="app-mailbox-ops__sidebar-section-head">
        <div>
          <strong>模板库</strong>
          <p>沉淀正文、附件和来源标签。模板不承载收件范围，范围单独交给收件批次。</p>
        </div>
        <span className="ops-status-dot ops-status-dot--active">{props.templates.length}</span>
      </div>

      {props.templates.length > 0 ? (
        <div className="app-mailbox-ops__library-list">
          {props.templates.map((template) => (
            <LibraryItemShell
              active={template.id === props.activeTemplateId}
              actions={
                <>
                  <Link
                    className="ops-inline-action"
                    href={buildMailboxOpsHref({
                      editingId: "new",
                      templateId: template.id,
                      recipientBatchId: props.currentRecipientBatchId,
                    })}
                  >
                    {template.id === props.activeTemplateId ? "已载入" : "从模板新建"}
                  </Link>
                  <form action={deleteMailboxOpsTemplateAction}>
                    <input name="redirectTo" type="hidden" value="/ops/account/mailbox" />
                    <input name="editingId" type="hidden" value="new" />
                    <input name="templateId" type="hidden" value={props.activeTemplateId ?? ""} />
                    <input name="recipientBatchId" type="hidden" value={props.currentRecipientBatchId ?? ""} />
                    <input name="targetTemplateId" type="hidden" value={template.id} />
                    <button className="ops-inline-action" style={{ color: "var(--mg-danger, #ef4444)" }} type="submit">
                      删除
                    </button>
                  </form>
                </>
              }
              badge={
                <span className={cn("ops-status-dot", typeDotClass(template.type))}>
                  {getTypeLabel(template.type)}
                </span>
              }
              description={template.description}
              key={template.id}
              meta={
                <>
                  <span>{template.operatorLabel}</span>
                  <span>附件 {template.attachmentCount}</span>
                  <span>{template.expiresAt ? `过期 ${formatShanghaiDateTime(template.expiresAt)}` : "不过期"}</span>
                </>
              }
              title={template.name}
            />
          ))}
        </div>
      ) : (
        <div className="app-mailbox-ops__empty">
          <strong>还没有模板</strong>
          <span>先在右侧填写正文和附件，再把常用发信内容存成模板。</span>
        </div>
      )}
    </section>
  );
}

function RecipientBatchSection(props: {
  batches: MailboxOpsRecipientBatchView[];
  activeTemplateId: string | null;
  activeRecipientBatchId: string | null;
}) {
  return (
    <section className="app-mailbox-ops__sidebar-section">
      <div className="app-mailbox-ops__sidebar-section-head">
        <div>
          <strong>收件批次</strong>
          <p>沉淀收件范围与名单，适合多次复用同一批用户，无需每轮重新粘贴标识。</p>
        </div>
        <span className="ops-status-dot ops-status-dot--scheduled">{props.batches.length}</span>
      </div>

      {props.batches.length > 0 ? (
        <div className="app-mailbox-ops__library-list">
          {props.batches.map((batch) => (
            <LibraryItemShell
              active={batch.id === props.activeRecipientBatchId}
              actions={
                <>
                  <Link
                    className="ops-inline-action"
                    href={buildMailboxOpsHref({
                      editingId: "new",
                      templateId: props.activeTemplateId,
                      recipientBatchId: batch.id,
                    })}
                  >
                    {batch.id === props.activeRecipientBatchId ? "已载入" : "从批次新建"}
                  </Link>
                  <form action={deleteMailboxOpsRecipientBatchAction}>
                    <input name="redirectTo" type="hidden" value="/ops/account/mailbox" />
                    <input name="editingId" type="hidden" value="new" />
                    <input name="templateId" type="hidden" value={props.activeTemplateId ?? ""} />
                    <input name="recipientBatchId" type="hidden" value={props.activeRecipientBatchId ?? ""} />
                    <input name="targetRecipientBatchId" type="hidden" value={batch.id} />
                    <button className="ops-inline-action" style={{ color: "var(--mg-danger, #ef4444)" }} type="submit">
                      删除
                    </button>
                  </form>
                </>
              }
              badge={
                <span className="ops-status-dot ops-status-dot--scheduled">
                  {getRecipientModeLabel(batch.recipientMode)}
                </span>
              }
              description={batch.description}
              key={batch.id}
              meta={
                <>
                  <span>匹配 {batch.previewRecipientCount}</span>
                  <span>未匹配 {batch.previewUnresolvedCount}</span>
                  <span>更新 {formatShanghaiDateTime(batch.updatedAt)}</span>
                </>
              }
              title={batch.name}
            />
          ))}
        </div>
      ) : (
        <div className="app-mailbox-ops__empty">
          <strong>还没有收件批次</strong>
          <span>先在右侧配置收件范围，再把当前名单保存成可复用批次。</span>
        </div>
      )}
    </section>
  );
}

function DeliveryAuditPanel(props: {
  campaign: MailboxOpsCampaignView;
  deliveries: MailboxOpsCampaignDeliveryView[];
}) {
  return (
    <div className="ops-card" style={{ gap: 16 }}>
      <div className="app-mailbox-ops__audit-head">
        <div>
          <strong>投递审计</strong>
          <p>这里回看最近的投递结果、失败原因和 messageId，便于确认发到了谁、哪里失败了。</p>
        </div>
        <div className="app-mailbox-ops__audit-stats">
          <span className="ops-status-dot ops-status-dot--active">已发 {props.campaign.sentCount}</span>
          <span className={cn("ops-status-dot", statusDotClass(props.campaign.status))}>
            失败 {props.campaign.failedCount}
          </span>
        </div>
      </div>

      {props.deliveries.length > 0 ? (
        <div className="app-mailbox-ops__delivery-list">
          {props.deliveries.map((delivery) => (
            <div className="app-mailbox-ops__delivery-item" key={delivery.id}>
              <div className="app-mailbox-ops__delivery-copy">
                <div className="app-mailbox-ops__delivery-head">
                  <strong>{delivery.usernameSnapshot || delivery.providerUserIdSnapshot || delivery.userId}</strong>
                  <span
                    className={cn(
                      "ops-status-dot",
                      delivery.status === "sent" ? "ops-status-dot--active" : "ops-status-dot--inactive",
                    )}
                  >
                    {delivery.status === "sent" ? "已投递" : "失败"}
                  </span>
                </div>
                <div className="app-mailbox-ops__delivery-meta">
                  <span>用户 ID：{delivery.userId}</span>
                  {delivery.providerUserIdSnapshot ? <span>Linux.do：{delivery.providerUserIdSnapshot}</span> : null}
                  {delivery.messageId ? <span>messageId：{delivery.messageId}</span> : null}
                  <span>{delivery.sentAt ? `发送于 ${formatShanghaiDateTime(delivery.sentAt)}` : "尚未完成投递"}</span>
                </div>
                {delivery.errorMessage ? (
                  <p className="app-mailbox-ops__delivery-error">{delivery.errorMessage}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="app-mailbox-ops__empty">
          <strong>暂无投递记录</strong>
          <span>草稿或新建活动在真正发送前不会产生 delivery 审计。</span>
        </div>
      )}
    </div>
  );
}

function EditorCard(props: {
  campaign: MailboxOpsCampaignView;
  deliveries: MailboxOpsCampaignDeliveryView[];
  isNew: boolean;
  redirectTo: string;
  editingId: string;
  selectedTemplate: MailboxOpsTemplateView | null;
  selectedRecipientBatch: MailboxOpsRecipientBatchView | null;
}) {
  const editable = props.isNew || canEditCampaign(props.campaign.status);
  const dispatchable = !props.isNew && canDispatchCampaign(props.campaign.status);
  const attachmentSlots = buildAttachmentSlots(props.campaign.attachments);

  return (
    <>
      <div className="ops-card">
        <h2 className="ops-card__title">邮箱运营中心</h2>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className="ops-status-dot ops-status-dot--scheduled">{props.isNew ? "新建活动" : "邮件活动"}</span>
          {!props.isNew ? (
            <span className={cn("ops-status-dot", statusDotClass(props.campaign.status))}>
              {getStatusLabel(props.campaign.status)}
            </span>
          ) : null}
          <span className={cn("ops-status-dot", typeDotClass(props.campaign.type))}>
            {getTypeLabel(props.campaign.type)}
          </span>
        </div>

        <p style={{ margin: 0, maxWidth: "72ch", color: "var(--mg-text-muted)", lineHeight: 1.65 }}>
          正式控制发给谁、何时发、附带什么奖励附件。模板库沉淀正文和奖励配置，收件批次沉淀名单，定时活动继续由{" "}
          <code>account-worker</code> 自动派发。
        </p>

        <div className="app-mailbox-ops__summary">
          <div className="app-mailbox-ops__summary-chip">
            <span className="app-mailbox-ops__summary-label">匹配收件人</span>
            <strong className="app-mailbox-ops__summary-value">{props.campaign.previewRecipientCount}</strong>
          </div>
          <div className="app-mailbox-ops__summary-chip">
            <span className="app-mailbox-ops__summary-label">未匹配标识</span>
            <strong className="app-mailbox-ops__summary-value">{props.campaign.previewUnresolvedCount}</strong>
          </div>
          <div className="app-mailbox-ops__summary-chip">
            <span className="app-mailbox-ops__summary-label">已投递 / 失败</span>
            <strong className="app-mailbox-ops__summary-value">
              {props.campaign.sentCount} / {props.campaign.failedCount}
            </strong>
          </div>
          <div className="app-mailbox-ops__summary-chip">
            <span className="app-mailbox-ops__summary-label">来源组合</span>
            <strong className="app-mailbox-ops__summary-value">
              {props.selectedTemplate ? props.selectedTemplate.name : "无模板"} /{" "}
              {props.selectedRecipientBatch ? props.selectedRecipientBatch.name : "无批次"}
            </strong>
          </div>
        </div>

        {!editable && !props.isNew ? (
          <div className="app-mailbox-ops__mode-note">
            <strong>当前活动已进入只读态。</strong>
            <span>已发送或已取消的活动不能再改字段；如需再次调整内容，请复制为新草稿或重新从模板新建。</span>
          </div>
        ) : null}

        <form action={saveMailboxOpsCampaignAction} className="ops-form">
          <input name="redirectTo" type="hidden" value={props.redirectTo} />
          <input name="campaignId" type="hidden" value={props.isNew ? "" : props.campaign.id} />
          <input name="editingId" type="hidden" value={props.editingId} />
          <input name="templateId" type="hidden" value={props.selectedTemplate?.id ?? ""} />
          <input name="recipientBatchId" type="hidden" value={props.selectedRecipientBatch?.id ?? ""} />

          {/* ── 模板与收件批次 ── */}
          <section className="app-mailbox-ops__section">
            <div className="app-mailbox-ops__section-head">
              <div>
                <strong>模板与收件批次</strong>
                <p>模板只保存正文、附件和来源标签；收件批次只保存名单与范围。两者可组合成新活动草稿。</p>
              </div>
            </div>

            <div className="app-mailbox-ops__compose-pills">
              {props.selectedTemplate ? (
                <span className="app-mailbox-ops__compose-pill">
                  模板：{props.selectedTemplate.name}
                  <Link
                    href={buildMailboxOpsHref({
                      editingId: "new",
                      recipientBatchId: props.selectedRecipientBatch?.id ?? null,
                    })}
                  >
                    清除
                  </Link>
                </span>
              ) : null}
              {props.selectedRecipientBatch ? (
                <span className="app-mailbox-ops__compose-pill">
                  收件批次：{props.selectedRecipientBatch.name}
                  <Link
                    href={buildMailboxOpsHref({
                      editingId: "new",
                      templateId: props.selectedTemplate?.id ?? null,
                    })}
                  >
                    清除
                  </Link>
                </span>
              ) : null}
              {!props.selectedTemplate && !props.selectedRecipientBatch ? (
                <span className="app-mailbox-ops__compose-pill app-mailbox-ops__compose-pill--muted">
                  当前从空白草稿开始
                </span>
              ) : null}
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                模板名称
                <input
                  className="ops-form__input"
                  defaultValue={props.selectedTemplate?.name ?? ""}
                  disabled={!editable}
                  name="templateName"
                  placeholder="例如：活动补偿模板 / 周期奖励模板"
                />
              </label>

              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                模板说明
                <input
                  className="ops-form__input"
                  defaultValue={props.selectedTemplate?.description ?? ""}
                  disabled={!editable}
                  name="templateDescription"
                  placeholder="说明这个模板的用途，例如：用于版本补偿、周活跃奖励。"
                />
              </label>

              <label className="ops-form__label">
                收件批次名称
                <input
                  className="ops-form__input"
                  defaultValue={props.selectedRecipientBatch?.name ?? ""}
                  disabled={!editable}
                  name="recipientBatchName"
                  placeholder="例如：周活跃白名单 / 第一期补偿名单"
                />
              </label>

              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                收件批次说明
                <input
                  className="ops-form__input"
                  defaultValue={props.selectedRecipientBatch?.description ?? ""}
                  disabled={!editable}
                  name="recipientBatchDescription"
                  placeholder="说明这个收件批次的来源和使用场景。"
                />
              </label>
            </div>

            {editable ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button className="ops-inline-action" name="intent" type="submit" value="save-template">
                  保存当前内容为模板
                </button>
                <button className="ops-inline-action" name="intent" type="submit" value="save-recipient-batch">
                  保存当前收件范围为批次
                </button>
              </div>
            ) : null}
          </section>

          {/* ── 基本信息 ── */}
          <section className="app-mailbox-ops__section">
            <div className="app-mailbox-ops__section-head">
              <div>
                <strong>基本信息</strong>
                <p>定义这封邮件的运营标签、信件类型和用户实际看到的标题。</p>
              </div>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                运营标签
                <input
                  className="ops-form__input"
                  defaultValue={props.campaign.operatorLabel}
                  disabled={!editable}
                  name="operatorLabel"
                  placeholder="例如：三月活动补偿批次 A"
                />
              </label>

              <label className="ops-form__label">
                邮件类型
                <select className="ops-form__select" defaultValue={props.campaign.type} disabled={!editable} name="type">
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                邮件标题
                <input
                  className="ops-form__input"
                  defaultValue={props.campaign.title}
                  disabled={!editable}
                  name="title"
                  placeholder="例如：参与奖励已发放，请前往邮箱领取"
                />
              </label>

              <label className="ops-form__label">
                来源标签
                <input
                  className="ops-form__input"
                  defaultValue={props.campaign.sourceLabel ?? ""}
                  disabled={!editable}
                  name="sourceLabel"
                  placeholder="例如：运营组 / 项目组"
                />
              </label>

              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                摘要
                <textarea
                  className="ops-form__input"
                  defaultValue={props.campaign.summary ?? ""}
                  disabled={!editable}
                  name="summary"
                  placeholder="摘要会显示在用户侧邮箱列表里。"
                  rows={3}
                  style={{ minHeight: "80px" }}
                />
              </label>
            </div>
          </section>

          {/* ── 发送范围 ── */}
          <section className="app-mailbox-ops__section">
            <div className="app-mailbox-ops__section-head">
              <div>
                <strong>发送范围</strong>
                <p>支持全量、按 userId、按用户名、按 Linux.do ID 四种模式；后台会预解析并显示未匹配标识。</p>
              </div>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                收件人模式
                <select className="ops-form__select" defaultValue={props.campaign.recipientMode} disabled={!editable} name="recipientMode">
                  {RECIPIENT_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>
                  {getRecipientModeHint(props.campaign.recipientMode)}
                </span>
              </label>

              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                收件人标识
                <textarea
                  className="ops-form__input"
                  defaultValue={props.campaign.recipientInput ?? ""}
                  disabled={!editable}
                  name="recipientInput"
                  placeholder={getRecipientModePlaceholder(props.campaign.recipientMode)}
                  rows={6}
                  style={{ minHeight: "80px" }}
                />
                <span style={{ fontSize: "0.78rem", color: "var(--mg-text-muted)" }}>
                  全量用户模式留空即可；其余模式支持换行、逗号、分号混合输入。
                </span>
              </label>
            </div>

            <div className="app-mailbox-ops__recipient-preview">
              <div className="app-mailbox-ops__recipient-preview-copy">
                <strong>预览解析结果</strong>
                <p>
                  当前模式：{getRecipientModeLabel(props.campaign.recipientMode)}。解析后将投递给{" "}
                  <strong>{props.campaign.previewRecipientCount}</strong> 人。
                </p>
              </div>

              {props.campaign.previewUnresolvedCount > 0 ? (
                <div className="app-mailbox-ops__recipient-preview-list">
                  {props.campaign.previewUnresolvedTargets.map((target) => (
                    <span className="app-mailbox-ops__recipient-preview-item" key={target}>
                      {target}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="app-mailbox-ops__recipient-preview-ok">当前没有未匹配标识</span>
              )}
            </div>
          </section>

          {/* ── 正文与时序 ── */}
          <section className="app-mailbox-ops__section">
            <div className="app-mailbox-ops__section-head">
              <div>
                <strong>正文与时序</strong>
                <p>同一条活动可先存草稿、定时发送，或立即发送；过期时间用于控制用户侧邮件失效。</p>
              </div>
            </div>

            <div className="ops-form__row">
              <label className="ops-form__label">
                定时发送时间
                <input
                  className="ops-form__input"
                  defaultValue={toDateTimeLocalValue(props.campaign.scheduledAt)}
                  disabled={!editable}
                  name="scheduledAt"
                  type="datetime-local"
                />
              </label>

              <label className="ops-form__label">
                过期时间
                <input
                  className="ops-form__input"
                  defaultValue={toDateTimeLocalValue(props.campaign.expiresAt)}
                  disabled={!editable}
                  name="expiresAt"
                  type="datetime-local"
                />
              </label>

              <label className="ops-form__label" style={{ gridColumn: "1 / -1" }}>
                正文
                <textarea
                  className="ops-form__input"
                  defaultValue={props.campaign.body}
                  disabled={!editable}
                  name="body"
                  placeholder="请输入正式邮件正文。"
                  rows={12}
                  style={{ minHeight: "80px" }}
                />
              </label>
            </div>
          </section>

          {/* ── 奖励附件 ── */}
          <section className="app-mailbox-ops__section">
            <div className="app-mailbox-ops__section-head">
              <div>
                <strong>奖励附件</strong>
                <p>正式附件支持多货币和 item。货币模式读取币种与数量，item 模式读取 productId。</p>
              </div>
            </div>

            <div className="app-mailbox-ops__attachment-summary-list">
              {props.campaign.attachments.length > 0 ? (
                props.campaign.attachments.map((attachment, index) => renderAttachmentSummary(attachment, index))
              ) : (
                <div className="app-mailbox-ops__empty">
                  <strong>当前没有附件</strong>
                  <span>没有附件时，这封运营邮件会作为纯消息投递。</span>
                </div>
              )}
            </div>

            <div className="app-mailbox-ops__attachments-grid">
              {attachmentSlots.map((slot, index) => (
                <div className="app-mailbox-ops__attachment-card" key={`slot-${index}`}>
                  <div className="app-mailbox-ops__attachment-card-head">
                    <strong>附件槽 {index + 1}</strong>
                    {slot.kind ? (
                      <span className="ops-status-dot ops-status-dot--active">{slot.kind}</span>
                    ) : null}
                  </div>

                  <label className="ops-form__label">
                    附件类型
                    <select className="ops-form__select" defaultValue={slot.kind} disabled={!editable} name={`attachmentKind_${index}`}>
                      <option value="">不使用</option>
                      <option value="currency">货币</option>
                      <option value="item">Item</option>
                    </select>
                  </label>

                  <label className="ops-form__label">
                    货币类型
                    <select className="ops-form__select" defaultValue={slot.currency} disabled={!editable} name={`attachmentCurrency_${index}`}>
                      {rewardCurrencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="ops-form__label">
                    货币数量
                    <input
                      className="ops-form__input"
                      defaultValue={slot.amount}
                      disabled={!editable}
                      min="1"
                      name={`attachmentAmount_${index}`}
                      placeholder="例如：100"
                      type="number"
                    />
                  </label>

                  <label className="ops-form__label">
                    Item productId
                    <input
                      className="ops-form__input"
                      defaultValue={slot.productId}
                      disabled={!editable}
                      name={`attachmentProductId_${index}`}
                      placeholder="例如：prod_xxx"
                    />
                  </label>

                  <label className="ops-form__label">
                    附件标题
                    <input
                      className="ops-form__input"
                      defaultValue={slot.title}
                      disabled={!editable}
                      name={`attachmentTitle_${index}`}
                      placeholder="用户侧显示标题，可选"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          {editable ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="ops-inline-action" name="intent" type="submit" value="save-draft">
                保存草稿
              </button>
              <button className="ops-inline-action" name="intent" type="submit" value="save-scheduled">
                保存为定时发送
              </button>
              <button className="ops-form__submit" name="intent" type="submit" value="send-now">
                立即发送
              </button>
              <Link className="ops-inline-action" href={buildMailboxOpsHref({ editingId: "new" })}>
                空白新建
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="ops-form__submit" href={buildMailboxOpsHref({ editingId: "new" })} style={{ display: "inline-block", textDecoration: "none" }}>
                新建活动
              </Link>
            </div>
          )}
        </form>

        {!props.isNew ? (
          <div style={{ display: "grid", gap: 12, justifyItems: "start", paddingTop: 16, borderTop: "1px solid rgba(226,232,240,0.08)" }}>
            {dispatchable ? (
              <form action={dispatchMailboxOpsCampaignAction}>
                <input name="redirectTo" type="hidden" value={props.redirectTo} />
                <input name="campaignId" type="hidden" value={props.campaign.id} />
                <button className="ops-form__submit" type="submit">
                  {props.campaign.status === "partial" || props.campaign.status === "failed" ? "重试发送" : "立即执行发送"}
                </button>
              </form>
            ) : null}

            <form action={duplicateMailboxOpsCampaignAction}>
              <input name="redirectTo" type="hidden" value={props.redirectTo} />
              <input name="campaignId" type="hidden" value={props.campaign.id} />
              <button className="ops-inline-action" type="submit">
                复制为新草稿
              </button>
            </form>

            {editable && !props.isNew ? (
              <form action={cancelMailboxOpsCampaignAction}>
                <input name="redirectTo" type="hidden" value={props.redirectTo} />
                <input name="campaignId" type="hidden" value={props.campaign.id} />
                <button className="ops-inline-action" style={{ color: "var(--mg-danger, #ef4444)" }} type="submit">
                  取消活动
                </button>
              </form>
            ) : null}

            <p style={{ margin: 0, color: "var(--mg-text-muted)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              当前活动状态：{getStatusLabel(props.campaign.status)}。定时活动会在到点后由 worker 自动派发；已发出活动默认只读，只允许查看投递审计、复制草稿或新建下一批。
            </p>
          </div>
        ) : null}
      </div>

      {!props.isNew ? <DeliveryAuditPanel campaign={props.campaign} deliveries={props.deliveries} /> : null}
    </>
  );
}

export default async function MailboxOpsPage({ searchParams }: MailboxOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问邮箱运营中心。")}`);
  }

  const params = searchParams ? await searchParams : undefined;
  const userContext = await requirePlatformOperatorUserContext();
  const [campaigns, templates, recipientBatches] = await Promise.all([
    listOperatorMailboxOpsCampaigns(userContext, { limit: 60, status: "all" }),
    listOperatorMailboxOpsTemplates(userContext, { limit: 24 }),
    listOperatorMailboxOpsRecipientBatches(userContext, { limit: 24 }),
  ]);

  const selectedTemplate = templates.find((template) => template.id === params?.templateId?.trim()) ?? null;
  const selectedRecipientBatch =
    recipientBatches.find((batch) => batch.id === params?.recipientBatchId?.trim()) ?? null;

  const editingId =
    params?.editingId?.trim() ||
    (selectedTemplate || selectedRecipientBatch ? "new" : campaigns[0]?.id || "new");
  const editingCampaign =
    editingId === "new"
      ? buildComposedDraft({
          template: selectedTemplate,
          recipientBatch: selectedRecipientBatch,
        })
      : campaigns.find((campaign) => campaign.id === editingId) ?? buildBlankDraft();
  const deliveries =
    editingCampaign.id && editingId !== "new"
      ? await listOperatorMailboxOpsCampaignDeliveries(userContext, editingCampaign.id, { limit: 32 })
      : [];
  const redirectTo = "/ops/account/mailbox";
  const sentCount = campaigns.filter((campaign) => campaign.status === "sent").length;
  const scheduledCount = campaigns.filter((campaign) => campaign.status === "scheduled").length;
  const failedCount = campaigns.filter((campaign) => campaign.status === "failed" || campaign.status === "partial").length;

  return (
    <main className="ops-main">
      <div className="ops-page-stack">
        {/* ── Header ── */}
        <div className="ops-page-header">
          <h1 className="ops-page-title">邮箱运营中心</h1>
          <p className="ops-page-subtitle">
            正式管理站内邮箱群发、定向补偿、奖励发放和定时投递。左侧负责活动目录、模板库和收件批次，右侧负责编辑与审计。
          </p>
        </div>

        {params?.status && params?.message ? (
          <p className={`ops-alert ops-alert--${params.status}`}>{params.message}</p>
        ) : null}

        {/* ── Inventory ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">邮件活动库存</h2>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>总数</th>
                  <th>待投递</th>
                  <th>已发送</th>
                  <th>失败</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{campaigns.length}</td>
                  <td><span className="ops-status-dot ops-status-dot--scheduled">{scheduledCount}</span></td>
                  <td><span className="ops-status-dot ops-status-dot--active">{sentCount}</span></td>
                  <td><span className="ops-status-dot ops-status-dot--inactive">{failedCount}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Sidebar: Campaign list + Template library + Recipient batches ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">活动目录</h2>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <Link className="ops-form__submit" href={buildMailboxOpsHref({ editingId: "new" })} style={{ display: "inline-block", textDecoration: "none" }}>
              空白新建
            </Link>
            {(selectedTemplate || selectedRecipientBatch) && editingId === "new" ? (
              <Link className="ops-inline-action" href={buildMailboxOpsHref({ editingId: "new" })}>
                清空组合
              </Link>
            ) : null}
          </div>

          {campaigns.length === 0 ? (
            <p className="ops-empty">还没有邮件活动。先新建一条活动，选择发送范围和附件后再保存或发送。</p>
          ) : (
            <div className="ops-batch-list">
              {campaigns.map((campaign) => (
                <CampaignListItem active={campaign.id === editingId} campaign={campaign} key={campaign.id} />
              ))}
            </div>
          )}
        </div>

        {/* ── Template Library ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">模板库</h2>
          <TemplateLibrarySection
            activeTemplateId={selectedTemplate?.id ?? null}
            currentRecipientBatchId={selectedRecipientBatch?.id ?? null}
            templates={templates}
          />
        </div>

        {/* ── Recipient Batches ── */}
        <div className="ops-card">
          <h2 className="ops-card__title">收件批次</h2>
          <RecipientBatchSection
            activeRecipientBatchId={selectedRecipientBatch?.id ?? null}
            activeTemplateId={selectedTemplate?.id ?? null}
            batches={recipientBatches}
          />
        </div>

        {/* ── Editor ── */}
        <EditorCard
          campaign={editingCampaign}
          deliveries={deliveries}
          editingId={editingId}
          isNew={editingId === "new" || !editingCampaign.id}
          redirectTo={redirectTo}
          selectedRecipientBatch={editingId === "new" ? selectedRecipientBatch : null}
          selectedTemplate={editingId === "new" ? selectedTemplate : null}
        />
      </div>
    </main>
  );
}
