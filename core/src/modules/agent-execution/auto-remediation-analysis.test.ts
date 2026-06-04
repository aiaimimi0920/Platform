import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAutoRemediationReasonBuckets,
  classifyAutoRemediationReasonCategory,
  getAutoRemediationReasonDisposition,
} from "./auto-remediation-analysis";

test("agent execution auto remediation analysis", async (t) => {
  await t.test("classifies skipped and failed remediation reasons", () => {
    assert.equal(
      classifyAutoRemediationReasonCategory("Automatic remediation is disabled by agent policy 'default'."),
      "policy_disabled",
    );
    assert.equal(
      classifyAutoRemediationReasonCategory(
        "Automatic remediation skipped because stored payload replay is unavailable and fallback retry requests are disabled for this callback.",
      ),
      "missing_payload",
    );
    assert.equal(
      classifyAutoRemediationReasonCategory(
        "Automatic remediation skipped because stored payload replay is incompatible with the current replay envelope.",
      ),
      "incompatible_payload",
    );
    assert.equal(
      classifyAutoRemediationReasonCategory("A callback payload replay was already recorded recently for this audit"),
      "duplicate_cooldown",
    );
    assert.equal(
      classifyAutoRemediationReasonCategory("External agent callback secret is unavailable for payload replay"),
      "target_unavailable",
    );
    assert.equal(
      classifyAutoRemediationReasonCategory("Socket timeout while replaying callback payload"),
      "attempt_failed",
    );
    assert.equal(classifyAutoRemediationReasonCategory(null), null);
  });

  await t.test("maps categories to skipped or failed dispositions", () => {
    assert.equal(getAutoRemediationReasonDisposition("policy_budget_exhausted"), "skipped");
    assert.equal(getAutoRemediationReasonDisposition("attempt_failed"), "failed");
    assert.equal(getAutoRemediationReasonDisposition(null), null);
  });

  await t.test("builds separate skip and failure buckets", () => {
    const rows = [
      { key: "Automatic remediation is disabled by agent policy 'default'.", count: 2 },
      {
        key: "Automatic remediation skipped because stored payload replay is unavailable and fallback retry requests are disabled for this callback.",
        count: 3,
      },
      {
        key: "Automatic remediation skipped because stored payload replay is incompatible with the current replay envelope.",
        count: 6,
      },
      { key: "A callback retry request was already recorded recently for this audit", count: 4 },
      { key: "Socket timeout while replaying callback payload", count: 5 },
      { key: "none", count: 8 },
    ];

    assert.deepEqual(buildAutoRemediationReasonBuckets(rows, "skipped"), [
      { key: "incompatible_payload", count: 6 },
      { key: "duplicate_cooldown", count: 4 },
      { key: "missing_payload", count: 3 },
      { key: "policy_disabled", count: 2 },
    ]);
    assert.deepEqual(buildAutoRemediationReasonBuckets(rows, "failed"), [{ key: "attempt_failed", count: 5 }]);
  });
});
