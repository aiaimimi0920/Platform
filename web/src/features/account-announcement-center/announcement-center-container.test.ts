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
