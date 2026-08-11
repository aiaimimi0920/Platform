import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./account-honor-entry.tsx", import.meta.url), "utf8");

test("account honor panel loading is single-flight, abortable, and stale-safe", () => {
  assert.match(source, /if \(!userId \|\| panelRequestRef\.current\) \{\s*return;\s*\}/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /panelRequestIdRef\.current !== requestId/);
  assert.match(source, /panelRequestRef\.current\?\.id !== requestId/);
  assert.match(source, /panelRequestRef\.current\?\.controller\.abort\(\)/);
});

test("account honor binds cached panel data to its identity before rendering", () => {
  assert.match(source, /const panel = panelState\?\.userId === userId \? panelState\.panel : null/);
  assert.match(source, /const requestUserId = userId/);
  assert.match(source, /setPanelState\(\{ panel: payload\.panel, userId: requestUserId \}\)/);
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*setPanelState\(null\);\s*setLoading\(false\);\s*hasPrefetchedRef\.current = false;/,
  );
  assert.match(source, /panelRequestRef\.current = null;\s*panelRequestIdRef\.current \+= 1;/);
  assert.match(source, /await loadPanel\(\{ openWhenLoaded: true \}\)/);
});
