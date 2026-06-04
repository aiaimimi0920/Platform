import type { MailboxAttachmentView, MailboxMessageView } from "@neuro/contracts";

export function getMessageTypeLabel(type: MailboxMessageView["type"]) {
  if (type === "reward") {
    return "奖励";
  }
  if (type === "compensation") {
    return "补偿";
  }
  return "系统";
}

export function getMessageTypeTone(type: MailboxMessageView["type"]) {
  if (type === "reward") {
    return "reward";
  }
  if (type === "compensation") {
    return "compensation";
  }
  return "system";
}

export function formatMailboxTimestamp(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMailboxExpiry(expiresAt: string | null) {
  if (!expiresAt) {
    return "长期保留";
  }

  const diffMs = Date.parse(expiresAt) - Date.now();
  if (diffMs <= 0) {
    return "已过期";
  }

  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return `${days}天${hours}小时后过期`;
  }

  return `${Math.max(1, totalHours)}小时后过期`;
}

export function isMessageExpired(message: MailboxMessageView) {
  return Boolean(message.expiresAt && Date.parse(message.expiresAt) <= Date.now());
}

export function getAttachmentTitle(attachment: MailboxAttachmentView) {
  if (attachment.title) {
    return attachment.title;
  }
  if (attachment.kind === "currency" && attachment.currency) {
    return attachment.currency;
  }
  return attachment.itemId || attachment.productId || "邮件附件";
}

export function getAttachmentQuantityLabel(attachment: MailboxAttachmentView) {
  if (attachment.kind === "currency" && attachment.amount !== null) {
    return String(attachment.amount);
  }
  return "1";
}

export function getAttachmentStateLabel(attachment: MailboxAttachmentView) {
  return attachment.claimedAt ? "已领取" : "待领取";
}

export function sortMailboxMessages(messages: MailboxMessageView[]) {
  return [...messages].sort((left, right) => {
    const leftFavorited = left.favoritedAt ? 1 : 0;
    const rightFavorited = right.favoritedAt ? 1 : 0;
    if (leftFavorited !== rightFavorited) {
      return rightFavorited - leftFavorited;
    }

    if (left.favoritedAt && right.favoritedAt) {
      const favoritedAtDelta = Date.parse(right.favoritedAt) - Date.parse(left.favoritedAt);
      if (favoritedAtDelta !== 0) {
        return favoritedAtDelta;
      }
    }

    const leftUnread = left.readAt ? 0 : 1;
    const rightUnread = right.readAt ? 0 : 1;
    if (leftUnread !== rightUnread) {
      return rightUnread - leftUnread;
    }

    if (left.pendingAttachmentCount !== right.pendingAttachmentCount) {
      return right.pendingAttachmentCount - left.pendingAttachmentCount;
    }

    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export function getFirstAttachment(message: MailboxMessageView) {
  return message.attachments[0] ?? null;
}

export function getMailboxSenderMonogram(message: MailboxMessageView) {
  const normalized = message.sourceLabel.replace(/\s+/g, "").trim();
  if (normalized.length > 0) {
    return Array.from(normalized).slice(0, 2).join("");
  }

  if (message.type === "reward") {
    return "奖";
  }

  if (message.type === "compensation") {
    return "补";
  }

  return "邮";
}
