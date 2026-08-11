import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./announcement-center-container.tsx", import.meta.url), "utf8");

test("announcement polling is abortable and rejects stale responses", () => {
  assert.match(source, /announcementRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /announcementRequestIdRef\.current !== requestId/);
  assert.match(source, /announcementRequestRef\.current\?\.id !== requestId/);
});

test("announcement polling skips overlap and cleans up active work", () => {
  assert.match(source, /if \(cancelled \|\| announcementRequestRef\.current\) \{\s*return;\s*\}/);
  assert.match(
    source,
    /window\.clearInterval\(intervalId\);\s*announcementRequestRef\.current\?\.controller\.abort\(\);/,
  );
  assert.match(source, /announcementRequestRef\.current = null;\s*announcementRequestIdRef\.current \+= 1;/);
});

test("announcement interaction state is isolated across account changes", () => {
  assert.match(source, /const \[stateUserId, setStateUserId\] = useState<string \| null>\(userId\);/);
  assert.match(source, /const identityReady = stateUserId === userId;/);
  assert.match(source, /const visibleOpen = identityReady && open;/);
  assert.match(source, /setStateUserId\(userId\);\s*setOpen\(false\);\s*wasOpenRef\.current = false;/);
  assert.match(source, /if \(!identityReady\) \{\s*return;\s*\}/);
  assert.match(source, /identityReady &&\s*userId/);
});
