import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultUserWallet, normalizeUserWallet } from "./economy";

describe("normalizeUserWallet", () => {
  it("returns the frozen default shape for empty inputs", () => {
    assert.deepEqual(normalizeUserWallet(undefined), defaultUserWallet);
    assert.deepEqual(normalizeUserWallet(null), defaultUserWallet);
  });

  it("floors positive numbers and drops invalid values", () => {
    assert.deepEqual(
      normalizeUserWallet({
        obsidian: 12.9,
        mira: -4,
        opinionTickets: Number.NaN,
      }),
      {
        obsidian: 12,
        mira: 0,
        opinionTickets: 0,
      },
    );
  });
});
