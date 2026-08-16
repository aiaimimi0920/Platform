import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const opsFeatureDir = new URL(
  "../../../../features/account-agent-center/ops/",
  import.meta.url,
);
const sectionSources = [
  "agents-ops-overview-section.tsx",
  "agents-ops-sidebar.tsx",
  "selected-agent-panel.tsx",
  "selected-agent-runtime-section.tsx",
  "selected-agent-governance-section.tsx",
  "selected-agent-activity-section.tsx",
].map((fileName) => readFileSync(new URL(fileName, opsFeatureDir), "utf8"));
const combinedSource = [pageSource, ...sectionSources].join("\n");

test("P3-02: agent operations exposes aggregate dependency failures", () => {
  assert.match(pageSource, /const opsDependency = combineDependencyResults/);
  assert.match(pageSource, /opsDependency\.state === "unavailable"/);
  assert.match(pageSource, /opsDependency\.state === "unauthorized"/);
  assert.match(pageSource, /opsDependency\.state === "partial"/);
  assert.match(pageSource, /<DependencyState[\s\S]*diagnostics[\s\S]*result=\{opsDependency\}/);
});

test("P3-02: agent operations no longer silently replaces failed formal sources", () => {
  assert.doesNotMatch(combinedSource, /\.catch\(\(\) => \[\]/);
  assert.doesNotMatch(combinedSource, /\.catch\(\(\) => null/);
  assert.match(pageSource, /source: "agent-registry"/);
  assert.match(pageSource, /source: "agent-executions"/);
  assert.match(pageSource, /source: "agent-runtime-catalog"/);
  assert.match(pageSource, /const agentRegistryUnavailable = sourceFailed\("agent-registry"\)/);
  assert.match(pageSource, /if \(agentRegistryUnavailable && agentRegistryDependency\)/);
  assert.match(pageSource, /label="智能体目录"/);
  assert.match(pageSource, /agentExecutionsUnavailable/);
  assert.match(pageSource, /callbackHealthUnavailable/);
  assert.match(pageSource, /runtimeCatalogUnavailable/);
  assert.match(pageSource, /selectedCapabilityUnavailable/);
  assert.match(pageSource, /operatorActionsUnavailable/);
  assert.match(combinedSource, /label="智能体能力目录"/);
  assert.match(combinedSource, /label="智能体执行目录"/);
  assert.match(combinedSource, /label="回调健康摘要"/);
});
