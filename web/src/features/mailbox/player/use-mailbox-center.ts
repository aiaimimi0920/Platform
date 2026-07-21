"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { MailboxMessageView } from "@neuro/contracts";

import { useAppToast } from "@/components/app-toast-center";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import { MAILBOX_POLL_INTERVAL_MS } from "./constants";
import {
  isMessageExpired,
  resolveSelectedMailboxMessageId,
  selectMailboxMessages,
  sortMailboxMessages,
} from "./utils";

type UseMailboxCenterOptions = {
  enabled: boolean;
  routeOpen: boolean;
  userId: string | null;
};

export function useMailboxCenter({ enabled, routeOpen, userId }: UseMailboxCenterOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useAppToast();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const panelErrorToastRef = useRef<string | null>(null);
  const pendingReadIdsRef = useRef(new Set<string>());
  const appliedTargetedMessageIdRef = useRef<string | null>(null);
  const titleId = useId();

  const [messages, setMessages] = useState<MailboxMessageView[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [claimingSelected, setClaimingSelected] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);
  const [archivingRead, setArchivingRead] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const targetedMessageId = searchParams?.get("messageId")?.trim() || null;
  const inboxMessages = selectMailboxMessages(messages, targetedMessageId);
  const actualInboxMessages = sortMailboxMessages(messages.filter((message) => message.folder === "inbox"));
  const selectedMessage =
    inboxMessages.find((message) => message.id === selectedMessageId) ??
    inboxMessages[0] ??
    null;
  const selectedMessageHasAttachments = Boolean(selectedMessage && selectedMessage.attachments.length > 0);
  const totalUnreadCount = actualInboxMessages.filter((message) => !message.readAt).length;
  const totalPendingAttachmentCount = actualInboxMessages.reduce((sum, message) => sum + message.pendingAttachmentCount, 0);
  const currentInboxCount = actualInboxMessages.length;
  const readAndClearableCount = messages.filter(
    (message) =>
      message.folder === "inbox" &&
      message.readAt &&
      !message.favoritedAt &&
      message.pendingAttachmentCount === 0,
  ).length;
  const canClaimSelected = Boolean(
    selectedMessage &&
      selectedMessage.pendingAttachmentCount > 0 &&
      !isMessageExpired(selectedMessage) &&
      !claimingSelected,
  );
  const canToggleFavoriteSelected = Boolean(selectedMessage && !togglingFavorite && !deletingSelected);
  const canDeleteSelected = Boolean(selectedMessage && !deletingSelected && !togglingFavorite);

  function syncMailboxState(nextMessages: MailboxMessageView[]) {
    setMessages(nextMessages);
    const nextInboxMessages = selectMailboxMessages(nextMessages, targetedMessageId);
    setSelectedMessageId((current) =>
      resolveSelectedMailboxMessageId(nextInboxMessages, current, targetedMessageId),
    );
  }

  async function refreshMailbox() {
    if (!enabled || !userId) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/account-mailbox/messages", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        messages?: MailboxMessageView[];
      };

      if (!response.ok || !payload.messages) {
        throw new Error(payload.error || "邮箱暂时不可用。");
      }

      syncMailboxState(payload.messages);
      panelErrorToastRef.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "邮箱暂时不可用。";
      if (panelErrorToastRef.current !== message) {
        pushToast({
          tone: "error",
          title: "邮箱",
          message,
        });
        panelErrorToastRef.current = message;
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (routeOpen) {
      router.push("/dashboard");
      return;
    }
    setOpen(false);
  }

  async function handleClaimSelectedMessage() {
    if (!selectedMessage || !canClaimSelected) {
      return;
    }

    setClaimingSelected(true);
    try {
      const response = await fetch(`/api/account-mailbox/messages/${encodeURIComponent(selectedMessage.id)}/claim-all`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: {
          claimedCount: number;
        };
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "附件领取失败。");
      }

      pushToast({
        tone: "success",
        title: "邮箱",
        message: `已领取 ${payload.result.claimedCount} 个附件。`,
      });
      await refreshMailbox();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "附件领取失败。",
      });
    } finally {
      setClaimingSelected(false);
    }
  }

  async function handleClaimAll() {
    if (claimingAll || totalPendingAttachmentCount <= 0) {
      return;
    }

    setClaimingAll(true);
    try {
      const response = await fetch("/api/account-mailbox/claim-all", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: {
          claimedCount: number;
        };
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "全部收取失败。");
      }

      pushToast({
        tone: "success",
        title: "邮箱",
        message: `已全部收取 ${payload.result.claimedCount} 个附件。`,
      });
      await refreshMailbox();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "全部收取失败。",
      });
    } finally {
      setClaimingAll(false);
    }
  }

  async function handleArchiveRead() {
    if (archivingRead || readAndClearableCount <= 0) {
      return;
    }

    setArchivingRead(true);
    try {
      const response = await fetch("/api/account-mailbox/archive-read", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: {
          archivedCount: number;
        };
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "删除已读失败。");
      }

      pushToast({
        tone: "info",
        title: "邮箱",
        message:
          payload.result.archivedCount > 0
            ? `已清理 ${payload.result.archivedCount} 封已读邮件。`
            : "当前没有可清理的已读邮件。",
      });
      await refreshMailbox();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "删除已读失败。",
      });
    } finally {
      setArchivingRead(false);
    }
  }

  async function handleToggleSelectedFavorite() {
    if (!selectedMessage || togglingFavorite || deletingSelected) {
      return;
    }

    const nextFavorited = !selectedMessage.favoritedAt;
    setTogglingFavorite(true);
    try {
      const response = await fetch(`/api/account-mailbox/messages/${encodeURIComponent(selectedMessage.id)}/favorite`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          favorited: nextFavorited,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: {
          favoritedAt: string | null;
        };
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "收藏状态更新失败。");
      }

      const nextMessages = messages.map((message) =>
        message.id === selectedMessage.id
          ? {
              ...message,
              favoritedAt: payload.result?.favoritedAt ?? null,
            }
          : message,
      );
      syncMailboxState(nextMessages);
      pushToast({
        tone: "success",
        title: "邮箱",
        message: nextFavorited ? "已收藏邮件，列表会置顶且自动清理会跳过它。" : "已取消收藏邮件。",
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "收藏状态更新失败。",
      });
    } finally {
      setTogglingFavorite(false);
    }
  }

  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);

  function requestDeleteSelectedMessage() {
    if (!selectedMessage || deletingSelected || togglingFavorite) {
      return;
    }
    setDeleteConfirmPending(true);
  }

  function cancelDeleteSelectedMessage() {
    setDeleteConfirmPending(false);
  }

  async function confirmDeleteSelectedMessage() {
    if (!selectedMessage || deletingSelected) {
      return;
    }
    setDeleteConfirmPending(false);
    setDeletingSelected(true);
    try {
      const response = await fetch(`/api/account-mailbox/messages/${encodeURIComponent(selectedMessage.id)}/delete`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: {
          deleted: boolean;
        };
      };

      if (!response.ok || !payload.result?.deleted) {
        throw new Error(payload.error || "邮件删除失败。");
      }

      const nextMessages = messages.filter((message) => message.id !== selectedMessage.id);
      syncMailboxState(nextMessages);
      pushToast({
        tone: "info",
        title: "邮箱",
        message: "已删除当前邮件。",
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "邮件删除失败。",
      });
    } finally {
      setDeletingSelected(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    void refreshMailbox();
  }

  useEffect(() => {
    if (appliedTargetedMessageIdRef.current === targetedMessageId) {
      return;
    }

    appliedTargetedMessageIdRef.current = targetedMessageId;
    const visibleMessages = selectMailboxMessages(messages, targetedMessageId);
    setSelectedMessageId((current) =>
      resolveSelectedMailboxMessageId(visibleMessages, current, targetedMessageId),
    );
  }, [messages, targetedMessageId]);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    let cancelled = false;

    async function syncMailbox() {
      if (cancelled) {
        return;
      }
      await refreshMailbox();
    }

    void syncMailbox();
    const intervalId = window.setInterval(() => {
      void syncMailbox();
    }, MAILBOX_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, userId]);

  useEffect(() => {
    if (!routeOpen || !enabled || !userId) {
      return;
    }

    setOpen(true);
    void refreshMailbox();
  }, [enabled, routeOpen, userId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    return acquireBodyOverlayLock();
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (wasOpenRef.current) {
      triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, routeOpen]);

  useEffect(() => {
    if (!open || !selectedMessage || selectedMessage.readAt || pendingReadIdsRef.current.has(selectedMessage.id)) {
      return;
    }

    pendingReadIdsRef.current.add(selectedMessage.id);

    void fetch(`/api/account-mailbox/messages/${encodeURIComponent(selectedMessage.id)}/read`, {
      method: "POST",
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          message?: {
            readAt: string;
          };
        };

        if (!response.ok || !payload.message?.readAt) {
          throw new Error();
        }

        setMessages((current) =>
          current.map((message) =>
            message.id === selectedMessage.id
              ? {
                  ...message,
                  readAt: payload.message?.readAt ?? message.readAt,
                }
              : message,
          ),
        );
      })
      .catch(() => {
        // Keep the panel usable even if read receipt write-back fails.
      })
      .finally(() => {
        pendingReadIdsRef.current.delete(selectedMessage.id);
      });
  }, [open, selectedMessage]);

  return {
    archivingRead,
    canClaimSelected,
    canDeleteSelected,
    canToggleFavoriteSelected,
    claimingAll,
    claimingSelected,
    closeButtonRef,
    currentInboxCount,
    deleteConfirmPending,
    deleteConfirmMessage: selectedMessage
      ? selectedMessage.pendingAttachmentCount > 0
        ? "删除后这封邮件和未领取附件都会被移除，是否继续？"
        : "确认删除这封邮件？"
      : "",
    deletingSelected,
    handleArchiveRead,
    handleClaimAll,
    handleClaimSelectedMessage,
    handleClose,
    handleDeleteSelectedMessage: requestDeleteSelectedMessage,
    handleConfirmDeleteSelectedMessage: confirmDeleteSelectedMessage,
    handleCancelDeleteSelectedMessage: cancelDeleteSelectedMessage,
    handleOpen,
    handleToggleSelectedFavorite,
    inboxMessages,
    loading,
    messages,
    open,
    readAndClearableCount,
    selectedMessage,
    selectedMessageHasAttachments,
    selectedMessageId,
    setSelectedMessageId,
    titleId,
    togglingFavorite,
    totalPendingAttachmentCount,
    totalUnreadCount,
    triggerButtonRef,
  };
}
