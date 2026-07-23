import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentSource = readFileSync(new URL("./commerce-center.tsx", import.meta.url), "utf8");

test("P3-02: commerce UI renders typed dependency states and keeps true empty shelves distinct", () => {
  assert.match(componentSource, /DependencyState/);
  assert.match(componentSource, /dependency\?\.state === "partial"/);
  assert.match(componentSource, /dependency\?\.state === "unavailable"/);
  assert.match(componentSource, /dependency\?\.state === "unauthorized"/);
  assert.match(componentSource, /暂无商品/);
});

test("P3-02: commerce UI does not render source failures as zero balances or empty shelves", () => {
  assert.match(componentSource, /const productsUnavailable =/);
  assert.match(componentSource, /const listingsUnavailable =/);
  assert.match(componentSource, /const itemsUnavailable =/);
  assert.match(componentSource, /const ordersUnavailable =/);
  assert.match(componentSource, /currentUserUnavailable/);
  assert.match(componentSource, /productsUnavailable[\s\S]*<DependencyState/);
  assert.match(componentSource, /listingsUnavailable[\s\S]*<DependencyState/);
  assert.match(componentSource, /itemsUnavailable[\s\S]*<DependencyState/);
  assert.match(componentSource, /purchasedCount=\{ordersUnavailable \? null/);
  assert.doesNotMatch(componentSource, /const obsidianBalance = .*\?\? 0/);
});
