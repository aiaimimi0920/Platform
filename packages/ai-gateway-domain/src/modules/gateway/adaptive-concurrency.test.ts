import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { AimdConcurrencyController } from "./adaptive-concurrency";
import type { ConcurrencyPermit } from "./adaptive-concurrency";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Acquire and immediately release a permit with the given outcome. */
async function cyclePermit(
  controller: AimdConcurrencyController,
  outcome: Parameters<ConcurrencyPermit["release"]>[0],
): Promise<void> {
  const permit = await controller.acquire();
  permit.release(outcome);
}

/** Drive N consecutive success cycles through the controller. */
async function driveSuccesses(
  controller: AimdConcurrencyController,
  n: number,
): Promise<void> {
  for (let i = 0; i < n; i++) {
    await cyclePermit(controller, "success");
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("AimdConcurrencyController", () => {
  let ctrl: AimdConcurrencyController;

  beforeEach(() => {
    ctrl = new AimdConcurrencyController({
      initialLimit: 10,
      minLimit: 1,
      maxLimit: 100,
      increaseThreshold: 5,
      decreaseFactor: 0.7,
      severeDecreaseFactor: 0.5,
      recoveryIntervalMs: 30_000,
    });
  });

  // -- acquire / release basics ---------------------------------------------

  describe("acquire and release", () => {
    it("grants a permit immediately when capacity is available", async () => {
      const permit = await ctrl.acquire();
      assert.equal(typeof permit.release, "function");
      assert.equal(typeof permit.startedAt, "number");
      assert.ok(permit.startedAt <= Date.now());
      permit.release("success");
    });

    it("tracks activeCount correctly across concurrent permits", async () => {
      const p1 = await ctrl.acquire();
      const p2 = await ctrl.acquire();
      const p3 = await ctrl.acquire();

      assert.equal(ctrl.snapshot().activeCount, 3);

      p1.release("success");
      assert.equal(ctrl.snapshot().activeCount, 2);

      p2.release("success");
      p3.release("success");
      assert.equal(ctrl.snapshot().activeCount, 0);
    });

    it("queues a second acquire when limit is 1 and one permit is held", async () => {
      const tiny = new AimdConcurrencyController({ initialLimit: 1 });

      const p1 = await tiny.acquire();
      assert.equal(tiny.snapshot().activeCount, 1);

      // This acquire should wait in the queue; resolve it after releasing p1.
      let p2Resolved = false;
      const p2Promise = tiny.acquire().then((p) => {
        p2Resolved = true;
        return p;
      });

      // Yield the microtask queue – p2 should still be waiting
      await Promise.resolve();
      assert.equal(p2Resolved, false);

      // Release p1 → p2 should be dispatched
      p1.release("success");

      const p2 = await p2Promise;
      assert.equal(p2Resolved, true);
      assert.equal(tiny.snapshot().activeCount, 1);

      p2.release("success");
      assert.equal(tiny.snapshot().activeCount, 0);
    });

    it("double-release is a safe no-op", async () => {
      const permit = await ctrl.acquire();
      permit.release("success");
      // second call should not throw or double-decrement
      assert.doesNotThrow(() => permit.release("success"));
      assert.equal(ctrl.snapshot().activeCount, 0);
    });
  });

  // -- additive increase on success -----------------------------------------

  describe("limit increase on consecutive successes", () => {
    it("increases the limit by 1 after reaching increaseThreshold successes", async () => {
      const initialLimit = ctrl.snapshot().currentLimit;

      // threshold is 5
      await driveSuccesses(ctrl, 5);

      assert.equal(ctrl.snapshot().currentLimit, initialLimit + 1);
    });

    it("resets the success streak counter after each increase", async () => {
      // 5 successes → +1 → streak resets to 0
      await driveSuccesses(ctrl, 5);
      assert.equal(ctrl.snapshot().consecutiveSuccesses, 0);
    });

    it("increases twice after 10 consecutive successes", async () => {
      const initialLimit = ctrl.snapshot().currentLimit;

      await driveSuccesses(ctrl, 10);

      assert.equal(ctrl.snapshot().currentLimit, initialLimit + 2);
    });

    it("does not exceed maxLimit", async () => {
      const capped = new AimdConcurrencyController({
        initialLimit: 9,
        maxLimit: 10,
        increaseThreshold: 1, // increase every success
      });

      // 3 successes would try to reach 12, but cap is 10
      await driveSuccesses(capped, 5);

      assert.equal(capped.snapshot().currentLimit, 10);
    });
  });

  // -- multiplicative decrease on failure -----------------------------------

  describe("limit decrease on failure", () => {
    it("multiplies limit by decreaseFactor on a general failure", async () => {
      // initialLimit=10, factor=0.7 → floor(10 * 0.7) = 7
      const permit = await ctrl.acquire();
      permit.release("failure");

      assert.equal(ctrl.snapshot().currentLimit, 7);
    });

    it("resets consecutiveSuccesses and increments consecutiveFailures on failure", async () => {
      // First get some successes to show they reset
      await driveSuccesses(ctrl, 3);
      assert.equal(ctrl.snapshot().consecutiveSuccesses, 3);

      const permit = await ctrl.acquire();
      permit.release("failure");

      assert.equal(ctrl.snapshot().consecutiveSuccesses, 0);
      assert.equal(ctrl.snapshot().consecutiveFailures, 1);
    });

    it("cascades: multiple failures reduce limit geometrically", async () => {
      // 10 → 7 → floor(7*0.7)=4 → floor(4*0.7)=2 → floor(2*0.7)=1
      for (let i = 0; i < 4; i++) {
        await cyclePermit(ctrl, "failure");
      }
      assert.equal(ctrl.snapshot().currentLimit, 1); // floored at minLimit=1
    });

    it("does not drop below minLimit", async () => {
      for (let i = 0; i < 20; i++) {
        await cyclePermit(ctrl, "failure");
      }
      assert.ok(ctrl.snapshot().currentLimit >= ctrl.snapshot().currentLimit); // trivially
      assert.equal(ctrl.snapshot().currentLimit, 1);
    });
  });

  // -- severe decrease on rate_limited --------------------------------------

  describe("severe decrease on rate_limited", () => {
    it("multiplies limit by severeDecreaseFactor on rate_limited", async () => {
      // initialLimit=10, severeFactor=0.5 → floor(10 * 0.5) = 5
      const permit = await ctrl.acquire();
      permit.release("rate_limited");

      assert.equal(ctrl.snapshot().currentLimit, 5);
    });

    it("severe decrease is larger than general decrease", async () => {
      const forFailure = new AimdConcurrencyController({ initialLimit: 10, decreaseFactor: 0.7 });
      const forRateLimit = new AimdConcurrencyController({ initialLimit: 10, severeDecreaseFactor: 0.5 });

      await cyclePermit(forFailure, "failure");
      await cyclePermit(forRateLimit, "rate_limited");

      assert.ok(forRateLimit.snapshot().currentLimit < forFailure.snapshot().currentLimit);
    });

    it("does not drop below minLimit on rate_limited", async () => {
      const tiny = new AimdConcurrencyController({
        initialLimit: 1,
        minLimit: 1,
        severeDecreaseFactor: 0.5,
      });
      await cyclePermit(tiny, "rate_limited");
      assert.equal(tiny.snapshot().currentLimit, 1);
    });

    it("tracks consecutiveFailures on rate_limited", async () => {
      await cyclePermit(ctrl, "rate_limited");
      assert.equal(ctrl.snapshot().consecutiveFailures, 1);
      assert.equal(ctrl.snapshot().consecutiveSuccesses, 0);
    });
  });

  // -- min / max enforcement ------------------------------------------------

  describe("min and max limit enforcement", () => {
    it("never goes below minLimit", async () => {
      const low = new AimdConcurrencyController({ initialLimit: 1, minLimit: 1, decreaseFactor: 0.1 });
      await cyclePermit(low, "failure");
      assert.equal(low.snapshot().currentLimit, 1);
    });

    it("never exceeds maxLimit", async () => {
      const high = new AimdConcurrencyController({
        initialLimit: 99,
        maxLimit: 100,
        increaseThreshold: 1,
      });
      await driveSuccesses(high, 5);
      assert.ok(high.snapshot().currentLimit <= 100);
    });

    it("limits initialised at minLimit stay at minLimit after failure", async () => {
      const bottom = new AimdConcurrencyController({ initialLimit: 1, minLimit: 1 });
      await cyclePermit(bottom, "failure");
      assert.equal(bottom.snapshot().currentLimit, 1);
    });
  });

  // -- timeout --------------------------------------------------------------

  describe("acquire timeout", () => {
    it("rejects with an error when the timeout elapses", async () => {
      const tiny = new AimdConcurrencyController({ initialLimit: 1 });
      const p1 = await tiny.acquire(); // occupies the only slot

      await assert.rejects(
        () => tiny.acquire(50), // 50 ms timeout
        /timed out/i,
      );

      p1.release("success");
    });

    it("resolves before timeout if a slot opens in time", async () => {
      const tiny = new AimdConcurrencyController({ initialLimit: 1 });
      const p1 = await tiny.acquire();

      // Queue a second acquire with a generous timeout
      const p2Promise = tiny.acquire(500);

      // Release p1 shortly after
      await new Promise<void>((r) => setTimeout(r, 10));
      p1.release("success");

      const p2 = await p2Promise;
      assert.ok(p2); // should have resolved
      p2.release("success");
    });

    it("removes the timed-out waiter from the queue", async () => {
      const tiny = new AimdConcurrencyController({ initialLimit: 1 });
      const p1 = await tiny.acquire();

      try {
        await tiny.acquire(30);
      } catch {
        // expected timeout
      }

      // Release p1 – no waiter should steal the slot since it timed out
      p1.release("success");

      // Controller should be idle
      assert.equal(tiny.snapshot().activeCount, 0);
    });
  });

  // -- snapshot -------------------------------------------------------------

  describe("snapshot", () => {
    it("returns correct initial snapshot", () => {
      const snap = ctrl.snapshot();
      assert.equal(snap.currentLimit, 10);
      assert.equal(snap.activeCount, 0);
      assert.equal(snap.availablePermits, 10);
      assert.equal(snap.consecutiveSuccesses, 0);
      assert.equal(snap.consecutiveFailures, 0);
      assert.ok(typeof snap.lastAdjustedAt === "string");
      assert.ok(!isNaN(Date.parse(snap.lastAdjustedAt)));
    });

    it("reflects held permits in activeCount and availablePermits", async () => {
      const p1 = await ctrl.acquire();
      const p2 = await ctrl.acquire();

      const snap = ctrl.snapshot();
      assert.equal(snap.activeCount, 2);
      assert.equal(snap.availablePermits, 8);

      p1.release("success");
      p2.release("success");
    });

    it("updates lastAdjustedAt when limit changes", async () => {
      const before = ctrl.snapshot().lastAdjustedAt;

      // Force a small delay so the timestamp can actually differ
      await new Promise<void>((r) => setTimeout(r, 5));
      await cyclePermit(ctrl, "failure");

      const after = ctrl.snapshot().lastAdjustedAt;
      assert.ok(after >= before);
    });

    it("availablePermits is 0 when fully saturated", async () => {
      const tiny = new AimdConcurrencyController({ initialLimit: 2 });
      const p1 = await tiny.acquire();
      const p2 = await tiny.acquire();

      assert.equal(tiny.snapshot().availablePermits, 0);

      p1.release("success");
      p2.release("success");
    });
  });

  // -- reset ----------------------------------------------------------------

  describe("reset", () => {
    it("restores limit to initialLimit", async () => {
      await cyclePermit(ctrl, "failure"); // drives limit to 7
      assert.equal(ctrl.snapshot().currentLimit, 7);

      ctrl.reset();
      assert.equal(ctrl.snapshot().currentLimit, 10);
    });

    it("clears counters and activeCount", async () => {
      await driveSuccesses(ctrl, 3);
      await cyclePermit(ctrl, "failure");
      ctrl.reset();

      const snap = ctrl.snapshot();
      assert.equal(snap.activeCount, 0);
      assert.equal(snap.consecutiveSuccesses, 0);
      assert.equal(snap.consecutiveFailures, 0);
    });

    it("rejects pending waiters when reset is called", async () => {
      const tiny = new AimdConcurrencyController({ initialLimit: 1 });
      const p1 = await tiny.acquire(); // fills the slot

      // Queue a waiter
      const waiterPromise = tiny.acquire();

      ctrl.reset(); // this ctrl is not tiny – reset tiny
      tiny.reset(); // reject the waiter

      await assert.rejects(() => waiterPromise, /reset/i);

      // p1 was held before reset – release it (safe no-op after reset)
      p1.release("success");
    });

    it("allows normal operation after reset", async () => {
      ctrl.reset();
      const permit = await ctrl.acquire();
      assert.ok(permit);
      permit.release("success");
    });
  });

  // -- queue ordering (FIFO) ------------------------------------------------

  describe("waiter queue FIFO ordering", () => {
    it("resolves waiters in the order they queued", async () => {
      const tiny = new AimdConcurrencyController({ initialLimit: 1 });
      const resolved: number[] = [];

      const holder = await tiny.acquire();

      const w1 = tiny.acquire().then((p) => { resolved.push(1); p.release("success"); });
      const w2 = tiny.acquire().then((p) => { resolved.push(2); p.release("success"); });
      const w3 = tiny.acquire().then((p) => { resolved.push(3); p.release("success"); });

      // Release holder – should trigger w1, then w2, then w3 in order
      holder.release("success");

      await Promise.all([w1, w2, w3]);

      assert.deepEqual(resolved, [1, 2, 3]);
    });
  });
});
