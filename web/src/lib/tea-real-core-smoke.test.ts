import assert from "node:assert/strict";
import test from "node:test";

if (process.env.TEA_WEB_REAL_SMOKE === "1") {
  const { registerTeaWebRealSmokeTest } = require("./tea-real-core-smoke.live");
  registerTeaWebRealSmokeTest();
} else {
  test("keeps the real Tea smoke outside the default Web test suite", () => {
    assert.notEqual(process.env.TEA_WEB_REAL_SMOKE, "1");
  });
}
