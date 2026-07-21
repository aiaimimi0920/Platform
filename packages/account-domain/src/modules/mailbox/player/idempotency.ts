export type MailboxIdempotentAttachmentPayload = {
  kind: string;
  title: string | null;
  currency: string | null;
  amount: number | null;
  productId: string | null;
  sortOrder: number;
};

export type MailboxIdempotentPayload = {
  folder: string;
  title: string;
  body: string;
  type: string;
  summary: string | null;
  sourceLabel: string | null;
  expiresAt: Date | null;
  attachments: MailboxIdempotentAttachmentPayload[];
};

export function normalizeMailboxIdempotencyKey(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  if (!normalized) throw new Error("Mailbox idempotency key is required when provided");
  if (normalized.length > 500) throw new Error("Mailbox idempotency key exceeds 500 characters");
  return normalized;
}

function sameDate(left: Date | null, right: Date | null) {
  if (left === null || right === null) return left === right;
  return left.getTime() === right.getTime();
}

function sameAttachments(
  left: MailboxIdempotentAttachmentPayload[],
  right: MailboxIdempotentAttachmentPayload[],
) {
  return left.length === right.length && left.every((attachment, index) => {
    const candidate = right[index];
    return Boolean(
      candidate
      && attachment.kind === candidate.kind
      && attachment.title === candidate.title
      && attachment.currency === candidate.currency
      && attachment.amount === candidate.amount
      && attachment.productId === candidate.productId
      && attachment.sortOrder === candidate.sortOrder,
    );
  });
}

export function mailboxIdempotentPayloadMatches(
  left: MailboxIdempotentPayload,
  right: MailboxIdempotentPayload,
) {
  return (
    left.folder === right.folder &&
    left.title === right.title &&
    left.body === right.body &&
    left.type === right.type &&
    left.summary === right.summary &&
    left.sourceLabel === right.sourceLabel &&
    sameDate(left.expiresAt, right.expiresAt) &&
    sameAttachments(left.attachments, right.attachments)
  );
}
