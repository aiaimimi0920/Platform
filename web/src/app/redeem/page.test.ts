import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const redeemPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("redeem page renders a visible route entry when the module is enabled", () => {
  assert.match(redeemPageSource, /<h1\b[^>]*>兑换码<\/h1>/);
  assert.match(redeemPageSource, /兑换面板会自动打开/);
  assert.doesNotMatch(redeemPageSource, /return <main className="app-page" \/>;/);
  assert.doesNotMatch(redeemPageSource, /<RedeemCenter\b/);
});
