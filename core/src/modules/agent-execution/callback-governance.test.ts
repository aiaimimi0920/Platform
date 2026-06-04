import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStoredExternalCallbackReplayEnvelope,
  buildExternalCallbackSignatureMessage,
  getRejectionCategoriesForRetryability,
  normalizeStoredExternalCallbackReplayEnvelope,
  resolveStoredExternalCallbackReplayEnvelope,
  resolveExternalCallbackMatch,
  stableStringify,
  summarizeExternalCallbackPayload,
} from "./callback-governance";

describe("agent execution callback governance", () => {
  it("canonicalizes payloads independently of key order", () => {
    const left = {
      type: "status",
      payload: {
        b: 2,
        a: 1,
      },
      list: [{ z: 3, y: 2 }],
    };
    const right = {
      list: [{ y: 2, z: 3 }],
      payload: {
        a: 1,
        b: 2,
      },
      type: "status",
    };

    assert.equal(stableStringify(left), stableStringify(right));
  });

  it("builds the signed callback message from canonical payload content", () => {
    const message = buildExternalCallbackSignatureMessage({
      executionId: "exec_1",
      callbackId: "cb_1",
      timestamp: 1_710_000_000,
      payload: {
        artifact: {
          title: "Result",
          kind: "note",
        },
        type: "artifact",
      },
    });

    assert.equal(
      message,
      'exec_1.cb_1.1710000000.{"artifact":{"kind":"note","title":"Result"},"type":"artifact"}',
    );
  });

  it("summarizes callback payloads for audit trails", () => {
    assert.equal(summarizeExternalCallbackPayload({ type: "heartbeat", statusNote: "ok" }), "heartbeat");
    assert.equal(
      summarizeExternalCallbackPayload({
        type: "artifact",
        artifact: { kind: "note", title: "Draft" },
      }),
      "artifact:note:Draft",
    );
    assert.equal(summarizeExternalCallbackPayload({ status: "completed" }), "status:completed");
  });

  it("accepts current callback protocol and secret versions", () => {
    const matched = resolveExternalCallbackMatch(
      {
        externalCallbackProtocolVersion: 3,
        externalCallbackPreviousProtocolVersion: 2,
        externalCallbackProtocolGraceUntil: new Date("2026-03-23T00:00:00.000Z"),
        externalCallbackSecretVersion: 5,
        externalCallbackPreviousSecretVersion: 4,
        externalCallbackSecretGraceUntil: new Date("2026-03-23T00:00:00.000Z"),
        externalCallbackSecret: "current-secret",
        externalCallbackPreviousSecret: "previous-secret",
      },
      {
        callbackSecret: "current-secret",
        callbackVersion: 3,
        now: new Date("2026-03-22T00:00:00.000Z"),
      },
    );

    assert.deepEqual(matched, {
      matchedProtocolVersion: 3,
      matchedSecretVersion: 5,
      usedPreviousProtocol: false,
      usedPreviousSecret: false,
    });
  });

  it("accepts previous protocol and secret only within the grace window", () => {
    const withinGrace = resolveExternalCallbackMatch(
      {
        externalCallbackProtocolVersion: 3,
        externalCallbackPreviousProtocolVersion: 2,
        externalCallbackProtocolGraceUntil: new Date("2026-03-23T00:00:00.000Z"),
        externalCallbackSecretVersion: 5,
        externalCallbackPreviousSecretVersion: 4,
        externalCallbackSecretGraceUntil: new Date("2026-03-23T00:00:00.000Z"),
        externalCallbackSecret: "current-secret",
        externalCallbackPreviousSecret: "previous-secret",
      },
      {
        callbackSecret: "previous-secret",
        callbackVersion: 2,
        now: new Date("2026-03-22T12:00:00.000Z"),
      },
    );

    const afterGrace = resolveExternalCallbackMatch(
      {
        externalCallbackProtocolVersion: 3,
        externalCallbackPreviousProtocolVersion: 2,
        externalCallbackProtocolGraceUntil: new Date("2026-03-23T00:00:00.000Z"),
        externalCallbackSecretVersion: 5,
        externalCallbackPreviousSecretVersion: 4,
        externalCallbackSecretGraceUntil: new Date("2026-03-23T00:00:00.000Z"),
        externalCallbackSecret: "current-secret",
        externalCallbackPreviousSecret: "previous-secret",
      },
      {
        callbackSecret: "previous-secret",
        callbackVersion: 2,
        now: new Date("2026-03-24T00:00:00.000Z"),
      },
    );

    assert.deepEqual(withinGrace, {
      matchedProtocolVersion: 2,
      matchedSecretVersion: 4,
      usedPreviousProtocol: true,
      usedPreviousSecret: true,
    });
    assert.equal(afterGrace, null);
  });

  it("maps retryability to the expected rejection categories", () => {
    assert.deepEqual(getRejectionCategoriesForRetryability("retryable"), [
      "invalid_timestamp",
      "processing_conflict",
    ]);
    assert.deepEqual(getRejectionCategoriesForRetryability("not_retryable"), [
      "invalid_payload",
      "unsupported_target",
    ]);
  });

  it("stores a replay-safe callback envelope without extra fields", () => {
    assert.deepEqual(
      buildStoredExternalCallbackReplayEnvelope({
        type: "artifact",
        artifact: {
          kind: "note",
          title: " Draft Result ",
          url: " https://example.com/result ",
          summary: " done ",
        },
      }),
      {
        type: "artifact",
        artifact: {
          kind: "note",
          title: "Draft Result",
          url: "https://example.com/result",
          summary: "done",
        },
      },
    );
  });

  it("normalizes persisted replay envelopes back into the supported shape", () => {
    assert.deepEqual(
      normalizeStoredExternalCallbackReplayEnvelope({
        type: "status",
        status: "completed",
        statusNote: " ok ",
        resultSummary: " done ",
        ignored: true,
      }),
      {
        type: "status",
        status: "completed",
        statusNote: "ok",
        resultSummary: "done",
      },
    );
    assert.equal(normalizeStoredExternalCallbackReplayEnvelope({ type: "artifact", artifact: { kind: "bad" } }), null);
  });

  it("resolves current replay envelopes with schema metadata", () => {
    assert.deepEqual(
      resolveStoredExternalCallbackReplayEnvelope({
        type: "artifact",
        artifact: {
          kind: "note",
          title: "Current Result",
          url: "https://example.com/result",
        },
      }),
      {
        envelope: {
          type: "artifact",
          artifact: {
            kind: "note",
            title: "Current Result",
            url: "https://example.com/result",
            summary: null,
          },
        },
        stored: true,
        replayable: true,
        compatibility: "current",
        schemaVersion: 1,
      },
    );
  });

  it("resolves legacy replay payloads into normalized envelopes", () => {
    assert.deepEqual(
      resolveStoredExternalCallbackReplayEnvelope({
        kind: "note",
        title: " Legacy Result ",
        url: " https://example.com/legacy ",
      }),
      {
        envelope: {
          type: "artifact",
          artifact: {
            kind: "note",
            title: "Legacy Result",
            url: "https://example.com/legacy",
            summary: null,
          },
        },
        stored: true,
        replayable: true,
        compatibility: "legacy_normalized",
        schemaVersion: 0,
      },
    );
  });

  it("marks malformed stored payloads as invalid", () => {
    assert.deepEqual(
      resolveStoredExternalCallbackReplayEnvelope({
        type: "artifact",
        artifact: {
          kind: "bad",
          title: "Broken",
        },
      }),
      {
        envelope: null,
        stored: true,
        replayable: false,
        compatibility: "invalid",
        schemaVersion: null,
      },
    );
  });
});
