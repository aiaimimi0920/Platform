import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { MultiKeyRotator } from "./multi-key-rotation";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeKeys(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `key-${i + 1}`,
    key: `sk-test-${i + 1}`,
  }));
}

// ---------------------------------------------------------------------------
// Round-robin selection
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – round-robin", () => {
  it("cycles through all keys in order", () => {
    const rotator = new MultiKeyRotator(makeKeys(3), { strategy: "round-robin" });

    const ids = [
      rotator.selectKey()?.id,
      rotator.selectKey()?.id,
      rotator.selectKey()?.id,
    ];
    assert.deepEqual(ids, ["key-1", "key-2", "key-3"]);
  });

  it("wraps around after the last key", () => {
    const rotator = new MultiKeyRotator(makeKeys(2), { strategy: "round-robin" });

    rotator.selectKey(); // key-1
    rotator.selectKey(); // key-2
    const third = rotator.selectKey(); // key-1 again
    assert.equal(third?.id, "key-1");
  });

  it("skips disabled keys and continues in order", () => {
    const rotator = new MultiKeyRotator(makeKeys(3), { strategy: "round-robin" });
    rotator.disableKey("key-2");

    const ids = [rotator.selectKey()?.id, rotator.selectKey()?.id];
    // With key-2 disabled the sequence should skip it
    for (const id of ids) {
      assert.notEqual(id, "key-2");
    }
  });

  it("returns the key entry with all expected fields", () => {
    const rotator = new MultiKeyRotator([{ id: "k1", key: "sk-abc" }]);
    const entry = rotator.selectKey();
    assert.ok(entry);
    assert.equal(entry.id, "k1");
    assert.equal(entry.key, "sk-abc");
    assert.equal(entry.enabled, true);
    assert.equal(entry.failureCount, 0);
    assert.equal(entry.lastFailureAt, null);
    assert.equal(entry.disabledUntil, null);
  });
});

// ---------------------------------------------------------------------------
// Random selection
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – random", () => {
  it("always returns an enabled key", () => {
    const rotator = new MultiKeyRotator(makeKeys(5), { strategy: "random" });
    rotator.disableKey("key-2");
    rotator.disableKey("key-4");

    for (let i = 0; i < 20; i++) {
      const key = rotator.selectKey();
      assert.ok(key, "should never return null when some keys are enabled");
      assert.notEqual(key.id, "key-2");
      assert.notEqual(key.id, "key-4");
    }
  });

  it("returns null when all keys are disabled", () => {
    const rotator = new MultiKeyRotator(makeKeys(2), {
      strategy: "random",
      autoReenableAfterCooldown: false,
    });
    rotator.disableKey("key-1");
    rotator.disableKey("key-2");

    assert.equal(rotator.selectKey(), null);
  });
});

// ---------------------------------------------------------------------------
// Failure tracking and auto-disable
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – failure tracking", () => {
  it("increments failureCount on reportFailure", () => {
    const rotator = new MultiKeyRotator(makeKeys(1));
    rotator.reportFailure("key-1");
    rotator.reportFailure("key-1");

    const [status] = rotator.getStatus();
    assert.equal(status.failureCount, 2);
  });

  it("disables a key when failures reach maxFailuresBeforeDisable", () => {
    const rotator = new MultiKeyRotator(makeKeys(1), {
      maxFailuresBeforeDisable: 3,
      autoReenableAfterCooldown: false,
    });
    rotator.reportFailure("key-1");
    rotator.reportFailure("key-1");
    rotator.reportFailure("key-1");

    const [status] = rotator.getStatus();
    assert.equal(status.enabled, false);
    assert.ok(status.disabledUntil, "disabledUntil should be set");
    assert.ok(status.lastFailureAt, "lastFailureAt should be set");
  });

  it("sets lastFailureAt on each failure", () => {
    const before = new Date().toISOString();
    const rotator = new MultiKeyRotator(makeKeys(1));
    rotator.reportFailure("key-1");
    const after = new Date().toISOString();

    const [status] = rotator.getStatus();
    assert.ok(status.lastFailureAt);
    assert.ok(status.lastFailureAt >= before);
    assert.ok(status.lastFailureAt <= after);
  });

  it("is a no-op when keyId is not found", () => {
    const rotator = new MultiKeyRotator(makeKeys(1));
    // Should not throw
    rotator.reportFailure("non-existent");
    rotator.reportSuccess("non-existent");
  });
});

// ---------------------------------------------------------------------------
// reportSuccess – reset
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – reportSuccess", () => {
  it("resets failureCount and re-enables the key", () => {
    const rotator = new MultiKeyRotator(makeKeys(1), {
      maxFailuresBeforeDisable: 2,
      autoReenableAfterCooldown: false,
    });
    rotator.reportFailure("key-1");
    rotator.reportFailure("key-1");

    const [afterDisable] = rotator.getStatus();
    assert.equal(afterDisable.enabled, false);

    rotator.reportSuccess("key-1");
    const [afterSuccess] = rotator.getStatus();
    assert.equal(afterSuccess.enabled, true);
    assert.equal(afterSuccess.failureCount, 0);
    assert.equal(afterSuccess.disabledUntil, null);
  });
});

// ---------------------------------------------------------------------------
// Manual disable / enable
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – manual disable/enable", () => {
  it("disableKey prevents the key from being selected", () => {
    const rotator = new MultiKeyRotator(makeKeys(2), {
      strategy: "round-robin",
      autoReenableAfterCooldown: false,
    });
    rotator.disableKey("key-1");

    // key-1 is at index 0 but should be skipped every time
    const selected = rotator.selectKey();
    assert.equal(selected?.id, "key-2");
  });

  it("enableKey makes a previously disabled key selectable again", () => {
    const rotator = new MultiKeyRotator(makeKeys(1), {
      autoReenableAfterCooldown: false,
    });
    rotator.disableKey("key-1");
    assert.equal(rotator.selectKey(), null);

    rotator.enableKey("key-1");
    const selected = rotator.selectKey();
    assert.equal(selected?.id, "key-1");
  });

  it("enableKey resets failureCount and disabledUntil", () => {
    const rotator = new MultiKeyRotator(makeKeys(1), { maxFailuresBeforeDisable: 1 });
    rotator.reportFailure("key-1");
    rotator.enableKey("key-1");

    const [status] = rotator.getStatus();
    assert.equal(status.failureCount, 0);
    assert.equal(status.disabledUntil, null);
    assert.equal(status.enabled, true);
  });
});

// ---------------------------------------------------------------------------
// Cooldown auto-re-enable
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – cooldown auto-re-enable", () => {
  it("auto-re-enables a key after cooldown expires on next selectKey call", () => {
    const rotator = new MultiKeyRotator(makeKeys(1), {
      maxFailuresBeforeDisable: 1,
      disableCooldownMs: 0, // expire immediately
      autoReenableAfterCooldown: true,
    });
    rotator.reportFailure("key-1");

    const [afterDisable] = rotator.getStatus();
    assert.equal(afterDisable.enabled, false);

    // selectKey should re-enable it because cooldown is already past
    const selected = rotator.selectKey();
    assert.equal(selected?.id, "key-1");

    const [afterSelect] = rotator.getStatus();
    assert.equal(afterSelect.enabled, true);
    assert.equal(afterSelect.failureCount, 0);
  });

  it("does not auto-re-enable when autoReenableAfterCooldown is false", () => {
    const rotator = new MultiKeyRotator(makeKeys(1), {
      maxFailuresBeforeDisable: 1,
      disableCooldownMs: 0,
      autoReenableAfterCooldown: false,
    });
    rotator.reportFailure("key-1");
    assert.equal(rotator.selectKey(), null);
  });
});

// ---------------------------------------------------------------------------
// All disabled
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – all disabled", () => {
  it("returns null from selectKey when all keys are disabled", () => {
    const rotator = new MultiKeyRotator(makeKeys(3), {
      autoReenableAfterCooldown: false,
    });
    rotator.disableKey("key-1");
    rotator.disableKey("key-2");
    rotator.disableKey("key-3");

    assert.equal(rotator.selectKey(), null);
  });

  it("returns 0 from availableKeyCount when all keys are permanently disabled", () => {
    const rotator = new MultiKeyRotator(makeKeys(2), {
      autoReenableAfterCooldown: false,
    });
    rotator.disableKey("key-1");
    rotator.disableKey("key-2");

    assert.equal(rotator.availableKeyCount(), 0);
  });
});

// ---------------------------------------------------------------------------
// getStatus / availableKeyCount
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – introspection", () => {
  it("getStatus returns a snapshot copy of all key entries", () => {
    const rotator = new MultiKeyRotator(makeKeys(2));
    const status = rotator.getStatus();
    assert.equal(status.length, 2);
    // Mutating the returned snapshot should not affect internal state
    status[0].failureCount = 99;
    const freshStatus = rotator.getStatus();
    assert.equal(freshStatus[0].failureCount, 0);
  });

  it("availableKeyCount reflects currently available keys", () => {
    const rotator = new MultiKeyRotator(makeKeys(4), { autoReenableAfterCooldown: false });
    assert.equal(rotator.availableKeyCount(), 4);
    rotator.disableKey("key-2");
    rotator.disableKey("key-4");
    assert.equal(rotator.availableKeyCount(), 2);
  });

  it("availableKeyCount counts cooldown-expired disabled keys as available", () => {
    const rotator = new MultiKeyRotator(makeKeys(1), {
      maxFailuresBeforeDisable: 1,
      disableCooldownMs: 0,
      autoReenableAfterCooldown: true,
    });
    rotator.reportFailure("key-1");
    // Even though enabled=false, cooldown is 0 so it should count as available
    assert.equal(rotator.availableKeyCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

describe("MultiKeyRotator – default config", () => {
  it("uses round-robin strategy by default", () => {
    const rotator = new MultiKeyRotator(makeKeys(3));
    const first = rotator.selectKey();
    const second = rotator.selectKey();
    const third = rotator.selectKey();
    assert.equal(first?.id, "key-1");
    assert.equal(second?.id, "key-2");
    assert.equal(third?.id, "key-3");
  });

  it("disables after 3 failures by default", () => {
    const rotator = new MultiKeyRotator(makeKeys(1), { autoReenableAfterCooldown: false });
    rotator.reportFailure("key-1");
    rotator.reportFailure("key-1");
    assert.equal(rotator.getStatus()[0].enabled, true);
    rotator.reportFailure("key-1");
    assert.equal(rotator.getStatus()[0].enabled, false);
  });
});
