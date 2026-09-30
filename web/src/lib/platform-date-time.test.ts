import assert from "node:assert/strict";
import test from "node:test";

import { formatPlatformDateTime } from "./platform-date-time";

test("platform date time is deterministic in the product time zone", () => {
  assert.equal(formatPlatformDateTime("2026-01-01T00:05:00.000Z"), "2026/01/01 08:05");
});

test("platform date time returns the requested empty label for missing or invalid input", () => {
  assert.equal(formatPlatformDateTime(null), "未记录");
  assert.equal(formatPlatformDateTime(undefined, "暂无"), "暂无");
  assert.equal(formatPlatformDateTime("not-a-date", "暂无"), "暂无");
});
