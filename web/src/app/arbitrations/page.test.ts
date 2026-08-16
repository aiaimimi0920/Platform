import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const opsPageSource = readFileSync(
  new URL("../ops/account/arbitrations/page.tsx", import.meta.url),
  "utf8",
);

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

test("operator arbitration workspace rejects non-operators before loading dependencies", () => {
  assert.match(pageSource, /const isOperator = !ownerOnly && isPlatformOperatorUserId/);
  assert.match(pageSource, /if \(!ownerOnly && !isOperator\) \{[\s\S]*?redirect\(/);

  const guardIndex = pageSource.indexOf("if (!ownerOnly && !isOperator)");
  const firstDependencyReadIndex = pageSource.indexOf("getPublicSurfaceSnapshotStrict()");
  assert.ok(guardIndex >= 0, "operator guard must exist");
  assert.ok(firstDependencyReadIndex >= 0, "public-surface dependency read must exist");
  assert.ok(guardIndex < firstDependencyReadIndex, "operator guard must run before dependency reads");
});

test("ops arbitration route continues to use the guarded workspace", () => {
  assert.match(opsPageSource, /export \{ default \} from "@\/app\/arbitrations\/page"/);
});
