import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAgentCallbackCompatibilitySummary,
  getCallbackCompatibilityWindowState,
} from "./callback-compatibility-analysis";

describe("agent callback compatibility analysis", () => {
  const referenceTime = new Date("2026-03-22T12:00:00.000Z");

  it("classifies grace window states from previous version and deadline", () => {
    assert.equal(
      getCallbackCompatibilityWindowState({
        previousVersion: null,
        graceUntil: null,
        referenceTime,
      }),
      "none",
    );
    assert.equal(
      getCallbackCompatibilityWindowState({
        previousVersion: 2,
        graceUntil: "2026-03-22T16:00:00.000Z",
        referenceTime,
      }),
      "active",
    );
    assert.equal(
      getCallbackCompatibilityWindowState({
        previousVersion: 2,
        graceUntil: "2026-03-22T08:00:00.000Z",
        referenceTime,
      }),
      "expired",
    );
  });

  it("builds summary counts for active, expiring, and expired windows", () => {
    const summary = buildAgentCallbackCompatibilitySummary(
      [
        {
          externalCallbackPreviousProtocolVersion: 1,
          externalCallbackProtocolGraceUntil: "2026-03-22T20:00:00.000Z",
          externalCallbackPreviousSecretVersion: 4,
          externalCallbackSecretGraceUntil: "2026-03-22T18:00:00.000Z",
        },
        {
          externalCallbackPreviousProtocolVersion: 2,
          externalCallbackProtocolGraceUntil: "2026-03-20T20:00:00.000Z",
          externalCallbackPreviousSecretVersion: null,
          externalCallbackSecretGraceUntil: null,
        },
        {
          externalCallbackPreviousProtocolVersion: null,
          externalCallbackProtocolGraceUntil: null,
          externalCallbackPreviousSecretVersion: 5,
          externalCallbackSecretGraceUntil: "2026-03-21T20:00:00.000Z",
        },
      ],
      referenceTime,
    );

    assert.equal(summary.totalExternalAgents, 3);
    assert.equal(summary.activeProtocolWindowCount, 1);
    assert.equal(summary.expiredProtocolWindowCount, 1);
    assert.equal(summary.expiringProtocolWindowCount, 1);
    assert.equal(summary.activeSecretWindowCount, 1);
    assert.equal(summary.expiredSecretWindowCount, 1);
    assert.equal(summary.expiringSecretWindowCount, 1);
    assert.equal(summary.latestActiveGraceUntil, "2026-03-22T20:00:00.000Z");
    assert.equal(summary.latestExpiredAt, "2026-03-21T20:00:00.000Z");
  });
});
