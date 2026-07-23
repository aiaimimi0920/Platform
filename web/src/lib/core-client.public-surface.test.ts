import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clientSource = readFileSync(new URL("./core-client.ts", import.meta.url), "utf8");

test("P3-02: core client exposes a strict public surface reader for formal pages", () => {
  assert.match(clientSource, /export async function getPublicSurfaceSnapshotStrict/);
  assert.match(clientSource, /return await getPublicSurfaceSnapshotStrict\(\)/);
});
