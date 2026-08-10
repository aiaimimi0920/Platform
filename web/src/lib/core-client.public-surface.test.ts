import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clientSource = readFileSync(new URL("./core-client.ts", import.meta.url), "utf8");

test("public surface reads stay strict instead of failing open to an all-enabled snapshot", () => {
  assert.match(clientSource, /export async function getPublicSurfaceSnapshotStrict/);
  assert.doesNotMatch(clientSource, /function availablePublicSurfaceSnapshot/);
  assert.doesNotMatch(clientSource, /export async function getPublicSurfaceSnapshot\(\)/);
});
