"use client";

import styles from "./mailbox-center.module.css";
import { MailboxDetail } from "./mailbox-detail";
import { MailboxList } from "./mailbox-list";
import { MailboxTrigger } from "./mailbox-trigger";
import { useMailboxCenter } from "./use-mailbox-center";

type MailboxCenterProps = {
  enabled: boolean;
  routeOpen?: boolean;
  userId: string | null;
};

export function MailboxCenter({ enabled, routeOpen = false, userId }: MailboxCenterProps) {
  const mailbox = useMailboxCenter({
    enabled,
    routeOpen,
    userId,
  });

  if (!enabled || !userId) {
    return null;
  }

  return (
    <div className={styles.mailboxScope}>
      <MailboxTrigger
        onOpen={mailbox.handleOpen}
        open={mailbox.open}
        totalPendingAttachmentCount={mailbox.totalPendingAttachmentCount}
        totalUnreadCount={mailbox.totalUnreadCount}
        triggerButtonRef={mailbox.triggerButtonRef}
      />

      {mailbox.open ? (
        <div aria-labelledby={mailbox.titleId} aria-modal="true" className="app-mailbox-overlay" role="dialog">
          <button
            aria-label="关闭邮箱面板"
            className="app-mailbox-backdrop"
            onClick={mailbox.handleClose}
            type="button"
          />

          <section className="app-mailbox">
            <MailboxList
              archivingRead={mailbox.archivingRead}
              claimingAll={mailbox.claimingAll}
              currentInboxCount={mailbox.currentInboxCount}
              inboxMessages={mailbox.inboxMessages}
              loading={mailbox.loading}
              onArchiveRead={mailbox.handleArchiveRead}
              onClaimAll={mailbox.handleClaimAll}
              onSelectMessage={mailbox.setSelectedMessageId}
              readAndClearableCount={mailbox.readAndClearableCount}
              selectedMessageId={mailbox.selectedMessageId}
              titleId={mailbox.titleId}
              totalPendingAttachmentCount={mailbox.totalPendingAttachmentCount}
            />
            <MailboxDetail
              canClaimSelected={mailbox.canClaimSelected}
              canDeleteSelected={mailbox.canDeleteSelected}
              canToggleFavoriteSelected={mailbox.canToggleFavoriteSelected}
              claimingSelected={mailbox.claimingSelected}
              closeButtonRef={mailbox.closeButtonRef}
              deleteConfirmMessage={mailbox.deleteConfirmMessage}
              deleteConfirmPending={mailbox.deleteConfirmPending}
              deletingSelected={mailbox.deletingSelected}
              onCancelDeleteSelectedMessage={mailbox.handleCancelDeleteSelectedMessage}
              onClaimSelectedMessage={mailbox.handleClaimSelectedMessage}
              onClose={mailbox.handleClose}
              onConfirmDeleteSelectedMessage={mailbox.handleConfirmDeleteSelectedMessage}
              onDeleteSelectedMessage={mailbox.handleDeleteSelectedMessage}
              onToggleSelectedFavorite={mailbox.handleToggleSelectedFavorite}
              selectedMessage={mailbox.selectedMessage}
              selectedMessageHasAttachments={mailbox.selectedMessageHasAttachments}
              togglingFavorite={mailbox.togglingFavorite}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
