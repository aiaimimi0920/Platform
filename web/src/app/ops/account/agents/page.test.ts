import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("P3-02: agent operations exposes aggregate dependency failures", () => {
  assert.match(pageSource, /const opsDependency = combineDependencyResults/);
  assert.match(pageSource, /opsDependency\.state === "unavailable"/);
  assert.match(pageSource, /opsDependency\.state === "unauthorized"/);
  assert.match(pageSource, /opsDependency\.state === "partial"/);
  assert.match(pageSource, /<DependencyState[\s\S]*diagnostics[\s\S]*result=\{opsDependency\}/);
});

test("P3-02: agent operations no longer silently replaces failed formal sources", () => {
  assert.doesNotMatch(pageSource, /\.catch\(\(\) => \[\]/);
  assert.doesNotMatch(pageSource, /\.catch\(\(\) => null/);
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
  assert.match(pageSource, /label="智能体能力目录"/);
  assert.match(pageSource, /label="智能体执行目录"/);
  assert.match(pageSource, /label="回调健康摘要"/);
});
