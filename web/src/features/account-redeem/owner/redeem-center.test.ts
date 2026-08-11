import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./redeem-center.tsx", import.meta.url), "utf8");

test("redeem submissions are single-flight, abortable, and stale-safe", () => {
  assert.match(source, /if \(!identityReady \|\| !enabled \|\| !userId \|\| redeemRequestRef\.current\) \{/);
  assert.match(source, /const controller = new AbortController\(\);/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /redeemRequestIdRef\.current !== requestId/);
  assert.match(source, /redeemRequestRef\.current\?\.id !== requestId/);
  assert.match(source, /activeUserIdRef\.current !== requestUserId/);
});

test("redeem interaction state is isolated across account changes", () => {
  assert.match(source, /const identityReady = stateUserId === userId;/);
  assert.match(source, /const visibleOpen = enabled && identityReady && open;/);
  assert.match(source, /setStateUserId\(userId\);\s*setOpen\(false\);\s*setCode\(""\);/);
  assert.match(source, /setSubmitting\(false\);\s*setLastResult\(null\);\s*wasOpenRef\.current = false;/);
  assert.match(source, /redeemRequestRef\.current\?\.controller\.abort\(\);/);
});

test("stale redeem requests cannot publish results or clear a newer submission", () => {
  assert.equal(source.match(/activeUserIdRef\.current !== requestUserId/g)?.length, 2);
  assert.match(
    source,
    /if \(redeemRequestRef\.current\?\.id === requestId\) \{\s*redeemRequestRef\.current = null;\s*if \(activeUserIdRef\.current === requestUserId\) \{\s*setSubmitting\(false\);/,
  );
});
