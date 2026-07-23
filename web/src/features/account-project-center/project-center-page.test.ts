import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./project-center-page.tsx", import.meta.url), "utf8");

test("P3-02: project visibility exposes unavailable state instead of enabling the surface", () => {
  assert.match(pageSource, /getPublicSurfaceSnapshotStrict/);
  assert.match(pageSource, /label="公开入口配置"/);
});
