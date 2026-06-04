import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

import {
  normalizeMailgunInboundPayload,
  verifyMailgunWebhookSignature,
} from "./model";

test("verifyMailgunWebhookSignature accepts valid HMAC signatures", () => {
  const signingKey = "mailgun-signing-secret";
  const timestamp = "1712832000";
  const token = "abc123token";
  const signature = createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest("hex");

  assert.deepEqual(
    verifyMailgunWebhookSignature({
      signingKey,
      timestamp,
      token,
      signature,
      maxAgeSeconds: 900,
      nowMs: 1712832000 * 1000,
    }),
    { ok: true },
  );
});

test("verifyMailgunWebhookSignature rejects stale or mismatched signatures", () => {
  assert.equal(
    verifyMailgunWebhookSignature({
      signingKey: "secret",
      timestamp: "1712832000",
      token: "token",
      signature: "bad",
      maxAgeSeconds: 900,
      nowMs: 1712832000 * 1000,
    }).ok,
    false,
  );

  assert.deepEqual(
    verifyMailgunWebhookSignature({
      signingKey: "secret",
      timestamp: "1712832000",
      token: "token",
      signature: createHmac("sha256", "secret").update("1712832000token").digest("hex"),
      maxAgeSeconds: 60,
      nowMs: 1712833000 * 1000,
    }),
    { ok: false, reason: "timestamp_out_of_range" },
  );
});

test("normalizeMailgunInboundPayload extracts canonical fields and attachment metadata", () => {
  const payload = normalizeMailgunInboundPayload({
    fields: {
      recipient: "agent+demo@mail.neuro.local",
      sender: "User@Example.com",
      subject: "请帮我整理素材",
      "body-plain": "title: 整理素材\n\n把附件整理一下。",
      "body-html": "<p>ignored</p>",
      "message-headers": JSON.stringify([
        ["Message-Id", "<message-123@example.com>"],
      ]),
    },
    attachments: [
      {
        fieldName: "attachment-1",
        filename: "brief.txt",
        contentType: "text/plain",
        sizeBytes: 123,
      },
    ],
    receivedAt: "2026-04-11T10:00:00.000Z",
  });

  assert.equal(payload.providerMessageId, "<message-123@example.com>");
  assert.equal(payload.normalizedFromEmail, "user@example.com");
  assert.equal(payload.normalizedToEmail, "agent+demo@mail.neuro.local");
  assert.equal(payload.attachmentCount, 1);
  assert.match(payload.idempotencyKey, /^mailgun:/);
  assert.equal(payload.receivedAt, "2026-04-11T10:00:00.000Z");
});
