import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  new URL("./agent-center-page.tsx", import.meta.url),
  "utf8",
);

test("P3-02: agent center preserves usable sections when a dependency is partial", () => {
  assert.match(pageSource, /const agentDependency = combineDependencyResults/);
  assert.match(pageSource, /agentDependency\.state === "partial"/);
  assert.match(pageSource, /agentDependency\.state === "unavailable"/);
  assert.match(pageSource, /agentDependency\.state === "unauthorized"/);
  assert.match(pageSource, /<DependencyState[\s\S]*label="智能体数据"/);
  assert.match(pageSource, /dependencyResultsBySource/);
  assert.match(pageSource, /getPublicSurfaceSnapshotStrict/);
  assert.match(pageSource, /sourceFailed\("agent-marketplace-public"\)/);
  assert.match(pageSource, /sourceFailed\("task-hub"\)/);
});

test("P3-02: agent center does not turn formal source failures into normal empty data", () => {
  assert.doesNotMatch(pageSource, /\.catch\(\(\) => \[\]/);
  assert.doesNotMatch(pageSource, /\.catch\(\(\) => null/);
  assert.match(pageSource, /source: "agent-marketplace-owner"/);
  assert.match(pageSource, /source: "agent-marketplace-executions"/);
  assert.match(pageSource, /source: "task-hub"/);
  assert.match(pageSource, /const agentRegistryUnavailable = sourceFailed\("agent-registry"\)/);
  assert.match(pageSource, /if \(agentRegistryUnavailable && agentRegistryDependency\)/);
  assert.match(pageSource, /label="智能体目录"/);
  assert.match(pageSource, /agent-marketplace-owner/);
  assert.match(pageSource, /agentCapabilityDependencyFailure/);
  assert.match(pageSource, /label="智能体能力目录"/);
  assert.match(pageSource, /benefitDependencyUnavailable/);
  assert.match(pageSource, /benefitModelDependencyUnavailable/);
});

test("agent capability discovery uses bounded ordered concurrency", () => {
  assert.match(pageSource, /const AGENT_CAPABILITY_FETCH_CONCURRENCY = 6/);
  assert.match(
    pageSource,
    /mapWithConcurrency\(\s*agents,\s*AGENT_CAPABILITY_FETCH_CONCURRENCY,/,
  );
  assert.doesNotMatch(pageSource, /Promise\.all\(\s*agents\.map/);
});
