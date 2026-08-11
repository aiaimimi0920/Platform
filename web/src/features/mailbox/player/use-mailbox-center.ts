"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { MailboxMessageView } from "@neuro/contracts";

import { useAppToast } from "@/components/app-toast-center";
import { acquireBodyOverlayLock } from "@/lib/overlay-lock";

import { MAILBOX_POLL_INTERVAL_MS } from "./constants";
import { buildMailboxRouteHref } from "../routes";
import {
  isMessageExpired,
  resolveMailboxSyncSelection,
  selectMailboxMessages,
  sortMailboxMessages,
} from "./utils";

type UseMailboxCenterOptions = {
  enabled: boolean;
  routeOpen: boolean;
  workspace?: boolean;
  userId: string | null;
};

type MailboxMessagesState = {
  messages: MailboxMessageView[];
  userId: string;
};

const EMPTY_MAILBOX_MESSAGES: MailboxMessageView[] = [];

export function useMailboxCenter({ enabled, routeOpen, workspace = false, userId }: UseMailboxCenterOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useAppToast();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const panelErrorToastRef = useRef<string | null>(null);
  const pendingReadIdsRef = useRef(new Set<string>());
  const appliedTargetedMessageIdRef = useRef<string | null>(null);
  const targetedMessageIdRef = useRef<string | null>(null);
  const mailboxRequestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const mailboxRequestIdRef = useRef(0);
  const activeUserIdRef = useRef(userId);
  const titleId = useId();

  const [messagesState, setMessagesState] = useState<MailboxMessagesState | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(workspace);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [claimingSelected, setClaimingSelected] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);
  const [archivingRead, setArchivingRead] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const messages = messagesState?.userId === userId ? messagesState.messages : EMPTY_MAILBOX_MESSAGES;
  activeUserIdRef.current = userId;

  const targetedMessageId = searchParams?.get("messageId")?.trim() || null;
  targetedMessageIdRef.current = targetedMessageId;
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

  function syncMailboxState(nextMessages: MailboxMessageView[], stateUserId: string) {
    if (activeUserIdRef.current !== stateUserId) {
      return;
    }
    setMessagesState({ messages: nextMessages, userId: stateUserId });
    setSelectedMessageId((current) =>
      resolveMailboxSyncSelection(nextMessages, current, targetedMessageIdRef.current),
    );
  }

  function updateMessagesForUser(
    stateUserId: string,
    update: (current: MailboxMessageView[]) => MailboxMessageView[],
  ) {
    if (activeUserIdRef.current !== stateUserId) {
      return;
    }
    setMessagesState((current) =>
      current?.userId === stateUserId
        ? { messages: update(current.messages), userId: stateUserId }
        : current,
    );
  }

  async function refreshMailbox() {
    if (!enabled || !userId) {
      return;
    }

    const requestUserId = userId;
    mailboxRequestRef.current?.controller.abort();
    const requestId = mailboxRequestIdRef.current + 1;
    mailboxRequestIdRef.current = requestId;
    const controller = new AbortController();
    mailboxRequestRef.current = { controller, id: requestId };
    setLoading(true);
    try {
      const response = await fetch("/api/account-mailbox/messages", {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        error?: string;
        messages?: MailboxMessageView[];
      };

      if (!response.ok || !payload.messages) {
        throw new Error(payload.error || "邮箱暂时不可用。");
      }

      if (
        controller.signal.aborted ||
        mailboxRequestIdRef.current !== requestId ||
        activeUserIdRef.current !== requestUserId
      ) {
        return;
      }
      syncMailboxState(payload.messages, requestUserId);
      setError(null);
      panelErrorToastRef.current = null;
    } catch (error) {
      if (
        controller.signal.aborted ||
        mailboxRequestIdRef.current !== requestId ||
        activeUserIdRef.current !== requestUserId
      ) {
        return;
      }
      const message = error instanceof Error ? error.message : "邮箱暂时不可用。";
      setError(message);
      if (panelErrorToastRef.current !== message) {
        pushToast({
          tone: "error",
          title: "邮箱",
          message,
        });
        panelErrorToastRef.current = message;
      }
    } finally {
      if (mailboxRequestRef.current?.id === requestId) {
        mailboxRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function handleClose() {
    if (workspace) {
      return;
    }
    if (routeOpen) {
      router.push("/dashboard");
      return;
    }
    setOpen(false);
  }

  async function handleClaimSelectedMessage() {
    if (!selectedMessage || !canClaimSelected || !userId) {
      return;
    }

    const requestUserId = userId;
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
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }

      pushToast({
        tone: "success",
        title: "邮箱",
        message: `已领取 ${payload.result.claimedCount} 个附件。`,
      });
      await refreshMailbox();
    } catch (error) {
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "附件领取失败。",
      });
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setClaimingSelected(false);
      }
    }
  }

  async function handleClaimAll() {
    if (claimingAll || totalPendingAttachmentCount <= 0 || !userId) {
      return;
    }

    const requestUserId = userId;
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
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }

      pushToast({
        tone: "success",
        title: "邮箱",
        message: `已全部收取 ${payload.result.claimedCount} 个附件。`,
      });
      await refreshMailbox();
    } catch (error) {
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "全部收取失败。",
      });
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setClaimingAll(false);
      }
    }
  }

  async function handleArchiveRead() {
    if (archivingRead || readAndClearableCount <= 0 || !userId) {
      return;
    }

    const requestUserId = userId;
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
      if (activeUserIdRef.current !== requestUserId) {
        return;
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
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "删除已读失败。",
      });
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setArchivingRead(false);
      }
    }
  }

  async function handleToggleSelectedFavorite() {
    if (!selectedMessage || togglingFavorite || deletingSelected || !userId) {
      return;
    }

    const requestUserId = userId;
    const targetMessageId = selectedMessage.id;
    const nextFavorited = !selectedMessage.favoritedAt;
    setTogglingFavorite(true);
    try {
      const response = await fetch(`/api/account-mailbox/messages/${encodeURIComponent(targetMessageId)}/favorite`, {
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
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }

      updateMessagesForUser(requestUserId, (current) =>
        current.map((message) =>
          message.id === targetMessageId
            ? {
                ...message,
                favoritedAt: payload.result?.favoritedAt ?? null,
              }
            : message,
        ),
      );
      void refreshMailbox();
      pushToast({
        tone: "success",
        title: "邮箱",
        message: nextFavorited ? "已收藏邮件，列表会置顶且自动清理会跳过它。" : "已取消收藏邮件。",
      });
    } catch (error) {
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "收藏状态更新失败。",
      });
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setTogglingFavorite(false);
      }
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
    if (!selectedMessage || deletingSelected || !userId) {
      return;
    }
    const requestUserId = userId;
    const targetMessageId = selectedMessage.id;
    setDeleteConfirmPending(false);
    setDeletingSelected(true);
    try {
      const response = await fetch(`/api/account-mailbox/messages/${encodeURIComponent(targetMessageId)}/delete`, {
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
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }

      updateMessagesForUser(requestUserId, (current) =>
        current.filter((message) => message.id !== targetMessageId),
      );
      setSelectedMessageId((current) => (current === targetMessageId ? null : current));
      void refreshMailbox();
      pushToast({
        tone: "info",
        title: "邮箱",
        message: "已删除当前邮件。",
      });
    } catch (error) {
      if (activeUserIdRef.current !== requestUserId) {
        return;
      }
      pushToast({
        tone: "error",
        title: "邮箱",
        message: error instanceof Error ? error.message : "邮件删除失败。",
      });
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setDeletingSelected(false);
      }
    }
  }

  function handleOpen() {
    setOpen(true);
    void refreshMailbox();
  }

  useEffect(() => {
    setMessagesState(null);
    setLoading(false);
    setError(null);
    setSelectedMessageId(null);
    setClaimingSelected(false);
    setClaimingAll(false);
    setArchivingRead(false);
    setTogglingFavorite(false);
    setDeletingSelected(false);
    setDeleteConfirmPending(false);
    pendingReadIdsRef.current.clear();
    appliedTargetedMessageIdRef.current = null;
    panelErrorToastRef.current = null;
  }, [userId]);

  useEffect(() => {
    if (appliedTargetedMessageIdRef.current === targetedMessageId) {
      return;
    }

    appliedTargetedMessageIdRef.current = targetedMessageId;
    setSelectedMessageId((current) =>
      resolveMailboxSyncSelection(messages, current, targetedMessageId, true),
    );
  }, [messages, targetedMessageId]);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    let cancelled = false;

    async function syncMailbox() {
      if (cancelled || mailboxRequestRef.current) {
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
      mailboxRequestRef.current?.controller.abort();
      mailboxRequestRef.current = null;
      mailboxRequestIdRef.current += 1;
    };
  }, [enabled, userId]);

  useEffect(() => {
    if ((!routeOpen && !workspace) || !enabled || !userId) {
      return;
    }

    setOpen(true);
  }, [enabled, routeOpen, userId, workspace]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (workspace) {
      return;
    }
    return acquireBodyOverlayLock();
  }, [open, workspace]);

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
    if (!open || workspace) {
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
  }, [open, routeOpen, workspace]);

  useEffect(() => {
    if (
      !open ||
      !userId ||
      !selectedMessage ||
      selectedMessage.readAt ||
      pendingReadIdsRef.current.has(selectedMessage.id)
    ) {
      return;
    }

    const requestUserId = userId;
    const targetMessageId = selectedMessage.id;
    pendingReadIdsRef.current.add(targetMessageId);

    void fetch(`/api/account-mailbox/messages/${encodeURIComponent(targetMessageId)}/read`, {
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
        if (activeUserIdRef.current !== requestUserId) {
          return;
        }

        updateMessagesForUser(requestUserId, (current) =>
          current.map((message) =>
            message.id === targetMessageId
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
        if (activeUserIdRef.current === requestUserId) {
          pendingReadIdsRef.current.delete(targetMessageId);
        }
      });
  }, [open, selectedMessage, userId]);

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
    error,
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
    setSelectedMessageId: (messageId: string) => {
      setSelectedMessageId(messageId);
      if (workspace) {
        router.replace(buildMailboxRouteHref(searchParams, messageId), { scroll: false });
      }
    },
    titleId,
    togglingFavorite,
    totalPendingAttachmentCount,
    totalUnreadCount,
    triggerButtonRef,
  };
}
