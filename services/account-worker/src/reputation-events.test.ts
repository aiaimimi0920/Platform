import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeReputationUpdatedUserIds } from "./reputation-events";

describe("reputation updated payload normalization", () => {
  it("deduplicates and trims user ids from the canonical userIds array", () => {
    const userIds = normalizeReputationUpdatedUserIds({
      userIds: [" user-a ", "user-b", "user-a", "", 7],
    });

    assert.deepEqual(userIds, ["user-a", "user-b"]);
  });

  it("supports a legacy single userId fallback", () => {
    const userIds = normalizeReputationUpdatedUserIds({
      userId: " user-a ",
    });

    assert.deepEqual(userIds, ["user-a"]);
  });
});
