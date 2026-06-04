import { createHash, createHmac } from "node:crypto";

import { normalizeEmailAddress } from "../email-native/model";

export type EmailIngressAttachmentMetadata = {
  fieldName: string;
  filename: string | null;
  contentType: string | null;
  sizeBytes: number;
};

export type MailgunInboundFieldMap = Record<string, string>;

export type VerifiedMailgunSignatureResult =
  | { ok: true }
  | { ok: false; reason: "missing_signature_fields" | "timestamp_out_of_range" | "signature_mismatch" };

export type NormalizedMailgunInboundPayload = {
  providerEventId: string | null;
  providerMessageId: string | null;
  fromEmail: string;
  normalizedFromEmail: string;
  toEmail: string;
  normalizedToEmail: string;
  subject: string | null;
  textBody: string;
  htmlBody: string | null;
  attachmentCount: number;
  attachmentsJson: string | null;
  providerPayloadJson: string;
  receivedAt: string;
  idempotencyKey: string;
};

function parseUnixTimestampSeconds(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
}

function normalizeTextBody(value: string | undefined) {
  return value?.replace(/\r\n/g, "\n").trim() || "";
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function extractHeaderValueFromMessageHeaders(headersRaw: string | undefined, headerName: string) {
  if (!headersRaw?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(headersRaw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const match = parsed.find((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) {
        return false;
      }
      const [name] = entry;
      return typeof name === "string" && name.trim().toLowerCase() === headerName.trim().toLowerCase();
    });

    if (!Array.isArray(match) || match.length < 2) {
      return null;
    }
    const [, value] = match;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

export function verifyMailgunWebhookSignature(args: {
  signingKey: string;
  timestamp: string | undefined;
  token: string | undefined;
  signature: string | undefined;
  maxAgeSeconds: number;
  nowMs?: number;
}): VerifiedMailgunSignatureResult {
  const timestamp = args.timestamp?.trim() || "";
  const token = args.token?.trim() || "";
  const signature = args.signature?.trim() || "";
  if (!timestamp || !token || !signature) {
    return {
      ok: false,
      reason: "missing_signature_fields",
    };
  }

  const parsedTimestamp = parseUnixTimestampSeconds(timestamp);
  if (parsedTimestamp === null) {
    return {
      ok: false,
      reason: "timestamp_out_of_range",
    };
  }

  const nowMs = args.nowMs ?? Date.now();
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsedTimestamp);
  if (ageSeconds > args.maxAgeSeconds) {
    return {
      ok: false,
      reason: "timestamp_out_of_range",
    };
  }

  const expected = createHmac("sha256", args.signingKey).update(`${timestamp}${token}`).digest("hex");
  if (expected !== signature) {
    return {
      ok: false,
      reason: "signature_mismatch",
    };
  }

  return { ok: true };
}

export function normalizeMailgunInboundPayload(args: {
  fields: MailgunInboundFieldMap;
  attachments: EmailIngressAttachmentMetadata[];
  receivedAt?: string | null;
}): NormalizedMailgunInboundPayload {
  const providerMessageId =
    normalizeOptionalText(args.fields["Message-Id"]) ||
    normalizeOptionalText(args.fields["message-id"]) ||
    extractHeaderValueFromMessageHeaders(args.fields["message-headers"], "Message-Id");
  const toEmail =
    normalizeOptionalText(args.fields.recipient) ||
    normalizeOptionalText(args.fields.To) ||
    normalizeOptionalText(args.fields.to);
  const fromEmail =
    normalizeOptionalText(args.fields.sender) ||
    normalizeOptionalText(args.fields.From) ||
    normalizeOptionalText(args.fields.from);
  const textBody =
    normalizeTextBody(args.fields["body-plain"]) ||
    normalizeTextBody(args.fields["stripped-text"]) ||
    normalizeTextBody(args.fields["body-plain"]);

  if (!toEmail || !fromEmail || !textBody) {
    throw new Error("Mailgun inbound payload is missing recipient, sender, or text body");
  }

  const normalizedToEmail = normalizeEmailAddress(toEmail);
  const normalizedFromEmail = normalizeEmailAddress(fromEmail);
  const subject = normalizeOptionalText(args.fields.subject) || normalizeOptionalText(args.fields.Subject);
  const htmlBody =
    normalizeOptionalText(args.fields["body-html"]) ||
    normalizeOptionalText(args.fields["stripped-html"]) ||
    null;
  const normalizedReceivedAt =
    args.receivedAt && !Number.isNaN(Date.parse(args.receivedAt))
      ? new Date(args.receivedAt).toISOString()
      : new Date().toISOString();

  const attachmentCountRaw = Number(args.fields["attachment-count"] || args.attachments.length);
  const attachmentCount =
    Number.isFinite(attachmentCountRaw) && attachmentCountRaw >= 0
      ? Math.max(args.attachments.length, Math.floor(attachmentCountRaw))
      : args.attachments.length;

  const providerEventId =
    providerMessageId ||
    extractHeaderValueFromMessageHeaders(args.fields["message-headers"], "X-Mailgun-Sid") ||
    null;

  const providerPayloadJson = JSON.stringify({
    provider: "mailgun",
    fields: args.fields,
    attachments: args.attachments,
  });

  const idempotencyKey = providerMessageId
    ? `mailgun:${normalizeEmailAddress(providerMessageId)}`
    : createHash("sha256")
        .update(
          JSON.stringify({
            provider: "mailgun",
            fromEmail: normalizedFromEmail,
            toEmail: normalizedToEmail,
            subject: subject || "",
            textBody,
          }),
        )
        .digest("hex");

  return {
    providerEventId,
    providerMessageId,
    fromEmail,
    normalizedFromEmail,
    toEmail,
    normalizedToEmail,
    subject,
    textBody,
    htmlBody,
    attachmentCount,
    attachmentsJson: args.attachments.length > 0 ? JSON.stringify(args.attachments) : null,
    providerPayloadJson,
    receivedAt: normalizedReceivedAt,
    idempotencyKey,
  };
}
