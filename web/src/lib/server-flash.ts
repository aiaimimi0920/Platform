import crypto from "node:crypto";

import type {
  DiscountCodeImportPreviewSummary,
} from "@/lib/discount-code-ops";

type AgentCallbackSecretFlashPayload = {
  agentId: string;
  callbackSecret: string;
};

type DiscountCodeImportPreviewFlashPayload = DiscountCodeImportPreviewSummary;

type EncodedFlashEnvelope = {
  v: 1;
  exp: number;
  kind: "agentCallbackSecret" | "discountCodeImportPreview";
  payload:
    | AgentCallbackSecretFlashPayload
    | DiscountCodeImportPreviewFlashPayload;
};

const agentCallbackSecretFlashTtlSeconds = 90;
const discountCodeImportPreviewFlashTtlSeconds = 180;

export const DISCOUNT_CODE_IMPORT_PREVIEW_FLASH_COOKIE = "np_discount_code_import_preview_flash";

function getFlashSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.OAUTH_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET or OAUTH_CLIENT_SECRET for server flash tokens");
  }
  return secret;
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac("sha256", getFlashSecret()).update(encodedPayload).digest("base64url");
}

export async function createAgentCallbackSecretFlash(payload: AgentCallbackSecretFlashPayload) {
  const envelope: EncodedFlashEnvelope = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + agentCallbackSecretFlashTtlSeconds,
    kind: "agentCallbackSecret",
    payload,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(envelope));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function consumeAgentCallbackSecretFlash(token: string) {
  const [encodedPayload, providedSignature] = token.split(".", 2);
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const envelope = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<EncodedFlashEnvelope>;
    if (
      envelope.v !== 1 ||
      typeof envelope.exp !== "number" ||
      envelope.kind !== "agentCallbackSecret" ||
      !envelope.payload
    ) {
      return null;
    }

    if (envelope.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    const payload = envelope.payload as Partial<AgentCallbackSecretFlashPayload>;
    if (typeof payload.agentId !== "string" || typeof payload.callbackSecret !== "string") {
      return null;
    }

    return {
      agentId: payload.agentId,
      callbackSecret: payload.callbackSecret,
    };
  } catch {
    return null;
  }
}

export async function createDiscountCodeImportPreviewFlash(payload: DiscountCodeImportPreviewFlashPayload) {
  const envelope: EncodedFlashEnvelope = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + discountCodeImportPreviewFlashTtlSeconds,
    kind: "discountCodeImportPreview",
    payload,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(envelope));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function consumeDiscountCodeImportPreviewFlash(token: string) {
  const [encodedPayload, providedSignature] = token.split(".", 2);
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const envelope = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<EncodedFlashEnvelope>;
    if (
      envelope.v !== 1 ||
      typeof envelope.exp !== "number" ||
      envelope.kind !== "discountCodeImportPreview" ||
      !envelope.payload
    ) {
      return null;
    }

    if (envelope.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    const payload = envelope.payload as Partial<DiscountCodeImportPreviewFlashPayload>;
    if (
      typeof payload.totalRows !== "number" ||
      typeof payload.createCount !== "number" ||
      typeof payload.updateCount !== "number" ||
      typeof payload.unchangedCount !== "number" ||
      !Array.isArray(payload.previewItems)
    ) {
      return null;
    }

    const previewItems = payload.previewItems
      .filter(
        (item): item is DiscountCodeImportPreviewFlashPayload["previewItems"][number] =>
          Boolean(
            item &&
              typeof item === "object" &&
              typeof item.discountCodeId === "string" &&
              typeof item.code === "string" &&
              (item.status === "create" || item.status === "update" || item.status === "unchanged") &&
              Array.isArray(item.changedFields) &&
              Array.isArray(item.fieldDiffs),
          ),
      )
      .slice(0, 16)
      .map((item) => ({
        discountCodeId: item.discountCodeId,
        code: item.code,
        status: item.status,
        changedFields: item.changedFields.filter((field): field is string => typeof field === "string").slice(0, 16),
        fieldDiffs: item.fieldDiffs
          .filter(
            (fieldDiff): fieldDiff is DiscountCodeImportPreviewFlashPayload["previewItems"][number]["fieldDiffs"][number] =>
              Boolean(
                fieldDiff &&
                  typeof fieldDiff === "object" &&
                  typeof fieldDiff.field === "string" &&
                  (fieldDiff.before === null || typeof fieldDiff.before === "string") &&
                  (fieldDiff.after === null || typeof fieldDiff.after === "string"),
              ),
          )
          .slice(0, 48)
          .map((fieldDiff) => ({
            field: fieldDiff.field,
            before: fieldDiff.before ?? null,
            after: fieldDiff.after ?? null,
          })),
      }));

    return {
      totalRows: payload.totalRows,
      createCount: payload.createCount,
      updateCount: payload.updateCount,
      unchangedCount: payload.unchangedCount,
      previewItems,
    } satisfies DiscountCodeImportPreviewFlashPayload;
  } catch {
    return null;
  }
}
