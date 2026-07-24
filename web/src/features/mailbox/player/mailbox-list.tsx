"use client";

import type { MailboxAttachmentView, MailboxMessageView } from "@neuro/contracts";

import { CurrencyIcon } from "@/components/currency-icon";
import { cn } from "@/lib/cn";

import { MAILBOX_STORAGE_LIMIT } from "./constants";
import { ItemAttachmentIcon, StarIcon } from "./icons";
import {
  formatMailboxExpiry,
  getFirstAttachment,
  getMailboxSenderMonogram,
  getMessageTypeTone,
} from "./utils";

function MailboxSenderPreview({ message }: { message: MailboxMessageView }) {
  return (
    <span
      aria-hidden="true"
      className={cn("app-mailbox__item-sender", `app-mailbox__item-sender--${getMessageTypeTone(message.type)}`)}
      title={message.sourceLabel}
    >
      <span className="app-mailbox__item-sender-mark">{getMailboxSenderMonogram(message)}</span>
    </span>
  );
}

function MailboxAttachmentPreview({ attachment }: { attachment: MailboxAttachmentView | null }) {
  if (!attachment) {
    return <span className="app-mailbox__item-preview-empty">无附件</span>;
  }

  if (attachment.kind === "currency" && attachment.currency) {
    return (
      <span className="app-mailbox__item-preview-card">
        <CurrencyIcon className="app-mailbox__item-preview-icon" currency={attachment.currency} />
        <strong>{attachment.amount ?? 0}</strong>
      </span>
    );
  }

  return (
    <span className="app-mailbox__item-preview-card app-mailbox__item-preview-card--item">
      <ItemAttachmentIcon />
      <strong>1</strong>
    </span>
  );
}

type MailboxListProps = {
  archivingRead: boolean;
  claimingAll: boolean;
  currentInboxCount: number;
  errorMessage?: string | null;
  inboxMessages: MailboxMessageView[];
  loading: boolean;
  onArchiveRead: () => void;
  onClaimAll: () => void;
  onSelectMessage: (messageId: string) => void;
  readAndClearableCount: number;
  selectedMessageId: string | null;
  titleId: string;
  totalPendingAttachmentCount: number;
};

export function MailboxList({
  archivingRead,
  claimingAll,
  currentInboxCount,
  errorMessage,
  inboxMessages,
  loading,
  onArchiveRead,
  onClaimAll,
  onSelectMessage,
  readAndClearableCount,
  selectedMessageId,
  titleId,
  totalPendingAttachmentCount,
}: MailboxListProps) {
  return (
    <aside className="app-mailbox__rail">
      <div className="app-mailbox__rail-head">
        <h2 className="app-mailbox__rail-title" id={titleId}>
          收件箱
        </h2>
        <strong className="app-mailbox__rail-count">
          {currentInboxCount}/{MAILBOX_STORAGE_LIMIT}
        </strong>
      </div>

      <div className="app-mailbox__list">
        {loading && inboxMessages.length === 0 ? <p className="app-mailbox__empty-note">邮箱加载中…</p> : null}

        {!loading && errorMessage ? <p className="app-mailbox__empty-note">{errorMessage}</p> : null}
        {!loading && !errorMessage && inboxMessages.length === 0 ? <p className="app-mailbox__empty-note">当前收件箱暂无邮件。</p> : null}

        {inboxMessages.map((message) => {
          const previewAttachment = getFirstAttachment(message);
          return (
            <button
              className={cn(
                "app-mailbox__item",
                selectedMessageId === message.id && "app-mailbox__item--active",
                message.favoritedAt && "app-mailbox__item--favorited",
                !message.readAt && "app-mailbox__item--unread",
              )}
              key={message.id}
              onClick={() => onSelectMessage(message.id)}
              type="button"
            >
              {!message.readAt ? <span aria-hidden="true" className="app-mailbox__item-dot" /> : null}
              <div className="app-mailbox__item-sender-wrap">
                <MailboxSenderPreview message={message} />
              </div>
              <div className="app-mailbox__item-copy">
                <div className="app-mailbox__item-head">
                  <strong>{message.title}</strong>
                  <div className="app-mailbox__item-flags">
                    {message.favoritedAt ? (
                      <span className="app-mailbox__item-badge app-mailbox__item-badge--favorite" title="已收藏">
                        <StarIcon filled />
                      </span>
                    ) : null}
                    {!message.readAt ? <span className="app-mailbox__item-badge">NEW</span> : null}
                  </div>
                </div>
                <p>{message.summary}</p>
                <div className="app-mailbox__item-meta">
                  <span>{formatMailboxExpiry(message.expiresAt)}</span>
                  {message.pendingAttachmentCount > 0 ? <span>{message.pendingAttachmentCount} 个附件待领</span> : null}
                </div>
              </div>

              <div className="app-mailbox__item-preview">
                <MailboxAttachmentPreview attachment={previewAttachment} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="app-mailbox__rail-actions">
        <button
          className="app-mailbox__rail-action"
          disabled={claimingAll || totalPendingAttachmentCount <= 0}
          onClick={onClaimAll}
          type="button"
        >
          {claimingAll ? "收取中..." : "全部收取"}
        </button>
        <button
          className="app-mailbox__rail-action app-mailbox__rail-action--muted"
          disabled={archivingRead || readAndClearableCount <= 0}
          onClick={onArchiveRead}
          type="button"
        >
          {archivingRead ? "处理中..." : "删除已读"}
        </button>
      </div>
    </aside>
  );
}
