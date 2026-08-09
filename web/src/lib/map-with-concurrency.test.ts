import assert from "node:assert/strict";
import test from "node:test";

import { mapWithConcurrency } from "./map-with-concurrency";

test("mapWithConcurrency preserves input order while bounding active work", async () => {
  let active = 0;
  let peak = 0;
  const inputs = [30, 5, 20, 10];

  const results = await mapWithConcurrency(inputs, 2, async (delayMs) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    active -= 1;
    return `result-${delayMs}`;
  });

  assert.equal(peak, 2);
  assert.deepEqual(results, inputs.map((delayMs) => `result-${delayMs}`));
});

test("mapWithConcurrency validates its worker limit", async () => {
  await assert.rejects(() => mapWithConcurrency([1], 0, async (value) => value), TypeError);
  await assert.rejects(() => mapWithConcurrency([1], 1.5, async (value) => value), TypeError);
});

test("mapWithConcurrency stops scheduling new items after a mapper failure", async () => {
  const started: number[] = [];

  await assert.rejects(
    () =>
      mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
        started.push(value);
        if (value === 2) throw new Error("failed");
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value;
      }),
    /failed/,
  );
  assert.deepEqual(started, [1, 2]);
});
