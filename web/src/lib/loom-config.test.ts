import test from "node:test";
import assert from "node:assert/strict";

import { displayConfigurationSource, safeLocalLoomUrl } from "./loom-config";

test("safeLocalLoomUrl allows loopback http settings pages", () => {
  assert.equal(
    safeLocalLoomUrl("http://127.0.0.1:8765/settings/tea"),
    "http://127.0.0.1:8765/settings/tea",
  );
});

test("safeLocalLoomUrl rejects remote URLs", () => {
  assert.equal(safeLocalLoomUrl("https://example.com/settings/tea"), null);
});

test("safeLocalLoomUrl rejects loopback non-settings URLs", () => {
  assert.equal(safeLocalLoomUrl("http://127.0.0.1:8765/admin"), null);
});

test("displayConfigurationSource labels Loom managed values clearly", () => {
  assert.equal(displayConfigurationSource("loom-managed"), "Loom 托管");
  assert.equal(displayConfigurationSource("fallback"), "保底快照");
  assert.equal(displayConfigurationSource("local"), "本地配置");
  assert.equal(displayConfigurationSource("missing"), "未声明");
});
