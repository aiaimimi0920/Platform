import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("product operations renders typed, retryable Gateway dependency evidence without raw errors", () => {
  assert.match(source, /DependencyState/);
  assert.match(source, /createDependencyFailureResult/);
  assert.match(source, /diagnostics/);
  assert.match(source, /result=\{bundleCatalogResult\.dependency\}/);
  assert.match(source, /重试 Gateway bundle 目录/);
  assert.doesNotMatch(source, /buildGatewayCatalogUnavailableNotice/);
  assert.doesNotMatch(source, /notice\.detail/);
});
