"use client";

import type { RefObject } from "react";

import { cn } from "@/lib/cn";

import { MailboxIcon } from "./icons";

type MailboxTriggerProps = {
  onOpen: () => void;
  open: boolean;
  totalPendingAttachmentCount: number;
  totalUnreadCount: number;
  triggerButtonRef: RefObject<HTMLButtonElement | null>;
};

export function MailboxTrigger({
  onOpen,
  open,
  totalPendingAttachmentCount,
  totalUnreadCount,
  triggerButtonRef,
}: MailboxTriggerProps) {
  return (
    <button
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(
        "app-mailbox-trigger",
        totalPendingAttachmentCount > 0 && "app-mailbox-trigger--ready",
        totalUnreadCount > 0 && "app-mailbox-trigger--unread",
      )}
      onClick={onOpen}
      ref={triggerButtonRef}
      type="button"
    >
      <span className="app-mailbox-trigger__copy">
        <MailboxIcon />
        <span>邮箱</span>
      </span>
      {totalUnreadCount > 0 || totalPendingAttachmentCount > 0 ? (
        <span className="app-mailbox-trigger__badge">
          {Math.min(99, Math.max(totalUnreadCount, totalPendingAttachmentCount))}
        </span>
      ) : null}
    </button>
  );
}
