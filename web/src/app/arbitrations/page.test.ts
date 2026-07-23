import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("P3-02: arbitration visibility does not default to enabled when the surface source fails", () => {
  assert.match(pageSource, /getPublicSurfaceSnapshotStrict/);
  assert.match(pageSource, /label="公开入口配置"/);
});

test("P3-02: arbitration page preserves dependency failures instead of rendering silent empty data", () => {
  assert.match(pageSource, /DependencyState/);
  assert.match(pageSource, /combineDependencyResults/);
  assert.match(pageSource, /createDependencyFailureResult/);
  assert.match(pageSource, /loadDependency/);
  assert.match(pageSource, /arbitration-cases/);
  assert.match(pageSource, /arbitration-summary/);
  assert.match(pageSource, /arbitration-workload/);
  assert.match(pageSource, /arbitration-cleanup-queue/);
  assert.match(pageSource, /state === "partial"/);
  assert.match(pageSource, /state === "unavailable"/);
  assert.match(pageSource, /state === "unauthorized"/);

  assert.doesNotMatch(pageSource, /listTasks\(userContext\)\.catch/);
  assert.doesNotMatch(pageSource, /listArbitrationCases\(userContext\)\.catch/);
  assert.doesNotMatch(pageSource, /getArbitrationCaseSummary\(userContext\)\.catch/);
  assert.doesNotMatch(pageSource, /getArbitrationCaseWorkload\(userContext\)\.catch/);
  assert.doesNotMatch(pageSource, /getArbitrationRemoteAttachmentCleanupQueue\(userContext, \{ limit: 20 \}\)\.catch/);
});
