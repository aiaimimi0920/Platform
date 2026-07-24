"use client";

import type { MailboxAttachmentView, MailboxMessageView } from "@neuro/contracts";
import type { RefObject } from "react";

import { CurrencyIcon } from "@/components/currency-icon";
import { cn } from "@/lib/cn";

import { CloseIcon, ItemAttachmentIcon, StarIcon, TrashIcon } from "./icons";
import {
  formatMailboxExpiry,
  formatMailboxTimestamp,
  getAttachmentQuantityLabel,
  getAttachmentStateLabel,
  getAttachmentTitle,
  getMessageTypeLabel,
  getMessageTypeTone,
} from "./utils";

type MailboxDetailProps = {
  canClaimSelected: boolean;
  canDeleteSelected: boolean;
  canToggleFavoriteSelected: boolean;
  claimingSelected: boolean;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  deleteConfirmMessage: string;
  deleteConfirmPending: boolean;
  deletingSelected: boolean;
  onCancelDeleteSelectedMessage: () => void;
  onClaimSelectedMessage: () => void;
  onClose: () => void;
  onConfirmDeleteSelectedMessage: () => void;
  onDeleteSelectedMessage: () => void;
  onToggleSelectedFavorite: () => void;
  selectedMessage: MailboxMessageView | null;
  selectedMessageHasAttachments: boolean;
  togglingFavorite: boolean;
  showClose?: boolean;
};

function MailboxAttachmentCard({ attachment }: { attachment: MailboxAttachmentView }) {
  return (
    <article
      className={cn("app-mailbox__attachment", attachment.claimedAt && "app-mailbox__attachment--claimed")}
      key={attachment.id}
    >
      <div className="app-mailbox__attachment-visual">
        <span
          className={cn(
            "app-mailbox__item-preview-card",
            "app-mailbox__attachment-preview-card",
            attachment.kind !== "currency" && "app-mailbox__item-preview-card--item",
          )}
        >
          {attachment.kind === "currency" && attachment.currency ? (
            <CurrencyIcon className="app-mailbox__attachment-icon" currency={attachment.currency} />
          ) : (
            <ItemAttachmentIcon />
          )}
          <strong>{getAttachmentQuantityLabel(attachment)}</strong>
        </span>
      </div>
      <div className="app-mailbox__attachment-copy">
        <strong>{getAttachmentTitle(attachment)}</strong>
        <span>{getAttachmentStateLabel(attachment)}</span>
      </div>
    </article>
  );
}

export function MailboxDetail({
  canClaimSelected,
  canDeleteSelected,
  canToggleFavoriteSelected,
  claimingSelected,
  closeButtonRef,
  deleteConfirmMessage,
  deleteConfirmPending,
  deletingSelected,
  onCancelDeleteSelectedMessage,
  onClaimSelectedMessage,
  onClose,
  onConfirmDeleteSelectedMessage,
  onDeleteSelectedMessage,
  onToggleSelectedFavorite,
  selectedMessage,
  selectedMessageHasAttachments,
  togglingFavorite,
  showClose = true,
}: MailboxDetailProps) {
  return (
    <article className="app-mailbox__content">
      {showClose ? <button
        aria-label="关闭邮箱面板"
        className="app-mailbox-close"
        onClick={onClose}
        ref={closeButtonRef}
        type="button"
      >
        <CloseIcon />
      </button> : null}

      {selectedMessage ? (
        <>
          <header className={cn("app-mailbox__hero", `app-mailbox__hero--${getMessageTypeTone(selectedMessage.type)}`)}>
            <div className="app-mailbox__hero-copy">
              <strong>
                【{getMessageTypeLabel(selectedMessage.type)}】 {selectedMessage.title}
              </strong>
              <span>{selectedMessage.sourceLabel}</span>
              <small>{formatMailboxTimestamp(selectedMessage.createdAt)}</small>
            </div>
            <div className="app-mailbox__hero-side">
              <div className="app-mailbox__hero-expiry">{formatMailboxExpiry(selectedMessage.expiresAt)}</div>
              <div className="app-mailbox__hero-actions">
                <button
                  className={cn(
                    "app-mailbox__hero-action",
                    selectedMessage.favoritedAt && "app-mailbox__hero-action--active",
                  )}
                  disabled={!canToggleFavoriteSelected}
                  onClick={onToggleSelectedFavorite}
                  type="button"
                >
                  <StarIcon filled={Boolean(selectedMessage.favoritedAt)} />
                  <span>
                    {togglingFavorite
                      ? "处理中..."
                      : selectedMessage.favoritedAt
                        ? "取消收藏"
                        : "收藏"}
                  </span>
                </button>
                <button
                  className="app-mailbox__hero-action app-mailbox__hero-action--danger"
                  disabled={!canDeleteSelected}
                  onClick={onDeleteSelectedMessage}
                  type="button"
                >
                  <TrashIcon />
                  <span>{deletingSelected ? "删除中..." : "删除"}</span>
                </button>
              </div>
            </div>
          </header>

          <div className="app-mailbox__body">
            <div className="app-mailbox__article">
              {selectedMessage.body.split(/\n{2,}/).map((paragraph, index) => (
                <p key={`${selectedMessage.id}-paragraph-${index}`}>{paragraph}</p>
              ))}
            </div>

            {selectedMessageHasAttachments ? (
              <section className="app-mailbox__attachments">
                <div className="app-mailbox__attachments-head">
                  <strong>邮件附件</strong>
                  <span>
                    {selectedMessage.pendingAttachmentCount > 0
                      ? `${selectedMessage.pendingAttachmentCount} 待领取`
                      : "已全部领取"}
                  </span>
                </div>

                <div className="app-mailbox__attachment-grid">
                  {selectedMessage.attachments.map((attachment) => (
                    <MailboxAttachmentCard attachment={attachment} key={attachment.id} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {selectedMessageHasAttachments ? (
            <footer className="app-mailbox__footer">
              <button
                className={cn("app-mailbox__claim-btn", !canClaimSelected && "app-mailbox__claim-btn--disabled")}
                disabled={!canClaimSelected}
                onClick={onClaimSelectedMessage}
                type="button"
              >
                {claimingSelected
                  ? "领取中..."
                  : selectedMessage.pendingAttachmentCount > 0
                    ? "领取附件"
                    : "附件已领取"}
              </button>
            </footer>
          ) : null}
        </>
      ) : (
        <div className="app-mailbox__empty">
          <strong>当前没有可展示的邮件</strong>
          <p>切换分区后若仍为空，说明这一栏位暂时还没有新的系统通知或奖励投递。</p>
        </div>
      )}

      {deleteConfirmPending ? (
        <div className="app-mailbox__confirm-overlay">
          <div className="app-mailbox__confirm-dialog">
            <strong>确认删除</strong>
            <p>{deleteConfirmMessage}</p>
            <div className="app-mailbox__confirm-actions">
              <button className="app-mailbox__confirm-btn app-mailbox__confirm-btn--cancel" onClick={onCancelDeleteSelectedMessage} type="button">
                取消
              </button>
              <button className="app-mailbox__confirm-btn app-mailbox__confirm-btn--danger" onClick={onConfirmDeleteSelectedMessage} type="button">
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
