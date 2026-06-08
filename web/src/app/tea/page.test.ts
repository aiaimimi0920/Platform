import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const teaPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("Tea queue page exposes canonical decompose action and BrainProvider status", () => {
  assert.match(teaPageSource, /"decompose"/);
  assert.match(teaPageSource, /拆解工单/);
  assert.match(teaPageSource, /brainProviderMode/);
  assert.match(teaPageSource, /brainProviderCapability/);
  assert.match(teaPageSource, /tea\.ticket\.decompose\.v1/);
});
