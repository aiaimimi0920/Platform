import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./benefit-center-container.tsx", import.meta.url), "utf8");

test("benefit center panel refreshes are abortable and reject stale responses", () => {
  const staleResponseGuard =
    /if \(controller\.signal\.aborted \|\| panelRequestIdRef\.current !== requestId\) \{\s*return;\s*\}/g;

  assert.match(source, /panelRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.equal(source.match(staleResponseGuard)?.length, 2);
  assert.match(source, /if \(panelRequestRef\.current\?\.id === requestId\) \{/);
});

test("benefit center polling skips overlap and aborts active work on cleanup", () => {
  assert.match(source, /if \(cancelled \|\| panelRequestRef\.current\) \{\s*return;\s*\}/);
  assert.match(source, /window\.clearInterval\(intervalId\);\s*panelRequestRef\.current\?\.controller\.abort\(\);/);
  assert.match(source, /panelRequestRef\.current = null;\s*panelRequestIdRef\.current \+= 1;/);
});
