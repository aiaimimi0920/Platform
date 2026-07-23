import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("P3-02: commerce uses strict public surface visibility", () => {
  assert.match(routeSource, /getPublicSurfaceSnapshotStrict/);
});

test("P3-02: commerce route preserves per-source dependency states instead of swallowing failures", () => {
  assert.doesNotMatch(routeSource, /withFallback/);
  assert.match(routeSource, /Promise\.allSettled/);
  assert.match(routeSource, /combineCommercePanelDependencies/);
  assert.match(routeSource, /createDependencyFailureResult/);
  assert.match(routeSource, /core-products/);
  assert.match(routeSource, /core-marketplace/);
});

test("P3-02: commerce route keeps a typed empty panel on outer dependency failure", () => {
  assert.match(
    routeSource,
    /\{\s*dependency,\s*panel:\s*EMPTY_COMMERCE_PANEL,\s*error:\s*publicMessage\s*\}/,
  );
});
