import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./benefit-center-container.tsx", import.meta.url), "utf8");

test("benefit center panel refreshes are abortable and reject stale responses", () => {
  assert.match(source, /panelRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.equal(source.match(/panelRequestIdRef\.current !== requestId/g)?.length, 2);
  assert.match(source, /activeUserIdRef\.current !== requestUserId/);
  assert.match(source, /if \(panelRequestRef\.current\?\.id === requestId\) \{/);
});

test("benefit center polling skips overlap and aborts active work on cleanup", () => {
  assert.match(source, /if \(cancelled \|\| panelRequestRef\.current\) \{\s*return;\s*\}/);
  assert.match(source, /window\.clearInterval\(intervalId\);\s*panelRequestRef\.current\?\.controller\.abort\(\);/);
  assert.match(source, /panelRequestRef\.current = null;\s*panelRequestIdRef\.current \+= 1;/);
});

test("benefit center binds panel and credential detail state to the active identity", () => {
  assert.match(source, /panelState\?\.userId === userId \? panelState\.families : EMPTY_BENEFIT_FAMILIES/);
  assert.match(source, /serviceDetailState\?\.userId === userId \? serviceDetailState\.summary : null/);
  assert.match(
    source,
    /setPanelState\(\{ families: normalized, summary: payload\.panel\.summary, userId: requestUserId \}\)/,
  );
  assert.match(source, /userId: requestUserId/);
});

test("benefit credential detail requests are single-flight, abortable, and selection-safe", () => {
  assert.match(source, /serviceDetailRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(source, /serviceDetailRequestIdRef\.current !== requestId/);
  assert.match(source, /selectedServiceIdRef\.current !== requestServiceId/);
  assert.ok((source.match(/signal: controller\.signal/g) ?? []).length >= 5);
  assert.match(source, /if \(serviceDetailRequestRef\.current\?\.id === requestId\)/);
});

test("benefit center clears account-owned panels and credential details on identity changes", () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*setPanelState\(null\);[\s\S]*?setSelectedFamilyKey\(null\);[\s\S]*?clearServiceDetailState\(\);[\s\S]*?\}, \[userId\]\)/,
  );
});
