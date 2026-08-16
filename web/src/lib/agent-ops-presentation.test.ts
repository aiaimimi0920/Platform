import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  agentRailPriorityScore,
  buildAgentCallbackOpsHref,
  buildAgentsOpsHref,
  buildPathWithParams,
  callbackWindowStateLabel,
  formatAgentLayerLabel,
  formatDependencyCount,
  formatDurationSeconds,
  formatRate,
  formatShanghaiDateTime,
  runtimePressureSortScore,
  sliceToneLabel,
} from "./agent-ops-presentation";

describe("agent ops presentation formatters", () => {
  it("formats durations across seconds, minutes and hours", () => {
    assert.equal(formatDurationSeconds(null), "未记录");
    assert.equal(formatDurationSeconds(Number.NaN), "未记录");
    assert.equal(formatDurationSeconds(45), "45s");
    assert.equal(formatDurationSeconds(60), "1m");
    assert.equal(formatDurationSeconds(90), "1m 30s");
    assert.equal(formatDurationSeconds(3600), "1h");
    assert.equal(formatDurationSeconds(3720), "1h 2m");
  });

  it("formats rates with a zero-denominator guard", () => {
    assert.equal(formatRate(1, 0), "0%");
    assert.equal(formatRate(1, 3), "33%");
    assert.equal(formatRate(2, 3), "67%");
  });

  it("formats dependency counts with an unavailable placeholder", () => {
    assert.equal(formatDependencyCount(null), "—");
    assert.equal(formatDependencyCount(12), "12");
  });

  it("formats Shanghai timestamps and missing values", () => {
    assert.equal(formatShanghaiDateTime(null), "未记录");
    assert.equal(formatShanghaiDateTime(undefined), "未记录");
    const formatted = formatShanghaiDateTime("2026-01-01T00:00:00.000Z");
    assert.match(formatted, /2026\/01\/01/);
    assert.match(formatted, /08:00/);
  });

  it("labels agent layers from hosting mode and source type", () => {
    assert.equal(
      formatAgentLayerLabel({ hostingMode: "managed_heavy", sourceType: "platform" }),
      "平台重型",
    );
    assert.equal(
      formatAgentLayerLabel({ hostingMode: "open_protocol", sourceType: "platform" }),
      "OpenAgent",
    );
    assert.equal(
      formatAgentLayerLabel({ hostingMode: "managed_light", sourceType: "external" }),
      "OpenAgent",
    );
    assert.equal(
      formatAgentLayerLabel({ hostingMode: "managed_light", sourceType: "platform" }),
      "平台轻量",
    );
  });

  it("labels callback windows and slice tones", () => {
    assert.equal(callbackWindowStateLabel("active"), "兼容中");
    assert.equal(callbackWindowStateLabel("expired"), "已过期");
    assert.equal(callbackWindowStateLabel("none"), "无窗口");
    assert.equal(sliceToneLabel("danger"), "attention");
    assert.equal(sliceToneLabel("violet"), "bridge");
  });
});

describe("agent ops presentation scores", () => {
  it("ranks runtime pressure by level then scheduling class", () => {
    const critical = runtimePressureSortScore({
      pressureLevel: "critical",
      schedulingDecisionClass: "within_capacity",
    });
    const watchSaturated = runtimePressureSortScore({
      pressureLevel: "watch",
      schedulingDecisionClass: "profile_and_owner_saturated",
    });
    const healthyBacklog = runtimePressureSortScore({
      pressureLevel: "healthy",
      schedulingDecisionClass: "queue_backlog",
    });
    assert.ok(critical > watchSaturated);
    assert.ok(watchSaturated > healthyBacklog);
  });

  it("weights rail priority with pressure dominating single signals", () => {
    const base = {
      rejectedCount: 0,
      duplicateCount: 0,
      previousProtocolCount: 0,
      previousSecretCount: 0,
      queuedCount: 0,
      runningCount: 0,
      failedCount: 0,
    };
    assert.equal(agentRailPriorityScore(base), 0);
    assert.equal(
      agentRailPriorityScore({ ...base, pressureLevel: "critical" }),
      400,
    );
    assert.equal(
      agentRailPriorityScore({
        ...base,
        rejectedCount: 1,
        failedCount: 1,
        queuedCount: 1,
        runningCount: 1,
        previousProtocolCount: 1,
        previousSecretCount: 1,
        duplicateCount: 1,
        pressureLevel: "watch",
      }),
      180 + 40 + 28 + 16 + 10 + 16 + 5,
    );
  });
});

describe("agent ops href builders", () => {
  it("skips empty params and encodes fragments", () => {
    assert.equal(buildPathWithParams("/ops/x", {}), "/ops/x");
    assert.equal(
      buildPathWithParams("/ops/x", { a: "1", b: null, c: undefined, d: "" }),
      "/ops/x?a=1",
    );
    assert.equal(
      buildPathWithParams("/ops/x", { a: "1" }, "run watch"),
      "/ops/x?a=1#run%20watch",
    );
  });

  it("builds callback ops hrefs scoped to an agent", () => {
    assert.equal(
      buildAgentCallbackOpsHref("agent-1", { status: "rejected" }, "callback-audits"),
      "/ops/agent-callbacks?agentId=agent-1&status=rejected#callback-audits",
    );
  });

  it("omits catch-all filters from agents ops hrefs", () => {
    assert.equal(buildAgentsOpsHref({}), "/ops/account/agents");
    assert.equal(
      buildAgentsOpsHref({
        agentId: "agent-1",
        executionStatus: "all",
        policyKey: "all",
        sourceType: "all",
        q: "",
      }),
      "/ops/account/agents?agentId=agent-1",
    );
    assert.equal(
      buildAgentsOpsHref({
        agentId: "agent-1",
        executionStatus: "running",
        policyKey: "balanced",
        sourceType: "external",
        q: "demo",
      }),
      "/ops/account/agents?agentId=agent-1&q=demo&sourceType=external&policyKey=balanced&executionStatus=running",
    );
  });
});
