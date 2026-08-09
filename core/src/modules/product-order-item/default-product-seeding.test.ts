import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.resolve(process.cwd(), "src/modules/product-order-item/service.ts"), "utf8");

test("default product seeding is safe across concurrent callers and replicas", () => {
  assert.match(source, /_defaultProductsEnsurePromise/);
  assert.match(source, /onConflictDoNothing\(\{ target: products\.id \}\)/);
  assert.match(source, /Product conflict did not resolve to a persisted row/);
});
