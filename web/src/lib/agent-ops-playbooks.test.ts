import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  AgentCallbackHealthSummaryView,
  AgentExecutionRuntimeCatalogView,
  AgentExecutionRuntimeSessionSummaryView,
} from "@neuro/contracts";

import {
  buildCallbackHealthRecommendations,
  buildHealthPosture,
  buildOperatorPlaybook,
  buildRuntimePressurePlaybook,
  callbackRecommendationToneLabel,
} from "./agent-ops-playbooks";

function buildSummary(
  overrides: Partial<AgentCallbackHealthSummaryView>,
): AgentCallbackHealthSummaryView {
  return {
    agentId: "agent-1",
    windowHours: 24,
    totalCallbacks: 10,
    acceptedCallbacks: 8,
    duplicateCallbacks: 0,
    rejectedCallbacks: 0,
    currentProtocolHits: 10,
    previousProtocolHits: 0,
    currentSecretHits: 10,
    previousSecretHits: 0,
    lastReceivedAt: "2026-03-26T00:00:00.000Z",
    byCallbackType: [],
    ...overrides,
  };
}

function buildRuntimeSummary(
  overrides: Partial<AgentExecutionRuntimeSessionSummaryView>,
): AgentExecutionRuntimeSessionSummaryView {
  return {
    openCount: 0,
    staleOpenCount: 0,
    terminalExecutionOpenCount: 0,
    ...overrides,
  } as AgentExecutionRuntimeSessionSummaryView;
}

type PressureEntry = AgentExecutionRuntimeCatalogView["utilization"][number];

function buildPressure(overrides: Partial<PressureEntry>): PressureEntry {
  return {
    key: "default",
    pressureLevel: "healthy",
    schedulingDecisionClass: "within_capacity",
    pressureDetail: "pressure detail",
    ...overrides,
  } as PressureEntry;
}

describe("callback recommendation tone labels", () => {
  it("maps each tone variant", () => {
    assert.equal(callbackRecommendationToneLabel("danger"), "attention");
    assert.equal(callbackRecommendationToneLabel("warning"), "watch");
    assert.equal(callbackRecommendationToneLabel("cyan"), "normal");
  });
});

describe("buildCallbackHealthRecommendations", () => {
  it("returns nothing without observed callbacks", () => {
    assert.deepEqual(buildCallbackHealthRecommendations("agent-1", null), []);
    assert.deepEqual(
      buildCallbackHealthRecommendations(
        "agent-1",
        buildSummary({ totalCallbacks: 0 }),
      ),
      [],
    );
  });

  it("escalates previous-protocol hits to danger at three or more", () => {
    const warning = buildCallbackHealthRecommendations(
      "agent-1",
      buildSummary({ previousProtocolHits: 2 }),
    );
    assert.equal(warning[0]?.title, "旧协议仍在命中");
    assert.equal(warning[0]?.variant, "warning");

    const danger = buildCallbackHealthRecommendations(
      "agent-1",
      buildSummary({ previousProtocolHits: 3 }),
    );
    assert.equal(danger[0]?.variant, "danger");
    assert.match(danger[0]?.href ?? "", /protocolMatch=previous/);
  });

  it("flags duplicate backlog as danger by rate or absolute count", () => {
    const byRate = buildCallbackHealthRecommendations(
      "agent-1",
      buildSummary({ duplicateCallbacks: 4, totalCallbacks: 10 }),
    );
    assert.equal(byRate[0]?.title, "重复回调偏高");
    assert.equal(byRate[0]?.variant, "danger");

    const mild = buildCallbackHealthRecommendations(
      "agent-1",
      buildSummary({ duplicateCallbacks: 1, totalCallbacks: 10 }),
    );
    assert.equal(mild[0]?.variant, "warning");
  });

  it("falls back to a healthy recommendation", () => {
    const healthy = buildCallbackHealthRecommendations(
      "agent-1",
      buildSummary({}),
    );
    assert.equal(healthy.length, 1);
    assert.equal(healthy[0]?.title, "回调健康正常");
    assert.equal(healthy[0]?.variant, "cyan");
  });
});

describe("buildHealthPosture", () => {
  it("treats platform agents as internally governed", () => {
    const posture = buildHealthPosture({ sourceType: "platform" }, null);
    assert.equal(posture.label, "平台内控");
    assert.equal(posture.variant, "violet");
  });

  it("walks external agents through observe, watch and danger states", () => {
    assert.equal(
      buildHealthPosture({ sourceType: "external" }, null).label,
      "待观测",
    );
    assert.equal(
      buildHealthPosture(
        { sourceType: "external" },
        buildSummary({ rejectedCallbacks: 3 }),
      ).label,
      "高风险",
    );
    assert.equal(
      buildHealthPosture(
        { sourceType: "external" },
        buildSummary({ previousProtocolHits: 2, previousSecretHits: 1 }),
      ).label,
      "高风险",
    );
    assert.equal(
      buildHealthPosture(
        { sourceType: "external" },
        buildSummary({ duplicateCallbacks: 1 }),
      ).label,
      "观察中",
    );
    assert.equal(
      buildHealthPosture({ sourceType: "external" }, buildSummary({})).label,
      "健康",
    );
  });
});

describe("buildOperatorPlaybook", () => {
  it("keeps platform agents on the execution loop", () => {
    const playbook = buildOperatorPlaybook({
      agent: { id: "agent-1", sourceType: "platform" },
      currentOpsHref: "/ops/account/agents?agentId=agent-1",
      executionCount: 2,
      health: null,
    });
    assert.equal(playbook.title, "平台智能体维护建议");
    assert.match(playbook.actions[0]?.href ?? "", /agentId=agent-1/);
  });

  it("asks external agents without callbacks for a first real run", () => {
    const playbook = buildOperatorPlaybook({
      agent: { id: "agent-1", sourceType: "external" },
      currentOpsHref: "/ops/account/agents?agentId=agent-1",
      executionCount: 0,
      health: buildSummary({ totalCallbacks: 0 }),
    });
    assert.equal(playbook.title, "先打出首条回调");
  });

  it("prioritizes the compatibility window under rejection pressure", () => {
    const playbook = buildOperatorPlaybook({
      agent: { id: "agent-1", sourceType: "external" },
      currentOpsHref: "/ops/account/agents?agentId=agent-1",
      executionCount: 1,
      health: buildSummary({ rejectedCallbacks: 3 }),
    });
    assert.equal(playbook.title, "优先处理兼容窗口");
    assert.match(playbook.actions[0]?.href ?? "", /status=rejected/);
  });

  it("splits the healthy branch by execution presence", () => {
    const withExecutions = buildOperatorPlaybook({
      agent: { id: "agent-1", sourceType: "external" },
      currentOpsHref: "/ops/account/agents?agentId=agent-1",
      executionCount: 4,
      health: buildSummary({}),
    });
    assert.equal(withExecutions.title, "维持日常巡检");

    const withoutExecutions = buildOperatorPlaybook({
      agent: { id: "agent-1", sourceType: "external" },
      currentOpsHref: "/ops/account/agents?agentId=agent-1",
      executionCount: 0,
      health: buildSummary({}),
    });
    assert.equal(withoutExecutions.title, "补第一条执行记录");
    assert.equal(withoutExecutions.actions[0]?.href, "/agents?mode=tasks");
  });
});

describe("buildRuntimePressurePlaybook", () => {
  it("returns null without a runtime summary", () => {
    assert.equal(
      buildRuntimePressurePlaybook({
        agent: { sourceType: "platform" },
        pressure: null,
        runtimeSummary: null,
        queuedCount: 0,
        runningCount: 0,
        failedCount: 0,
      }),
      null,
    );
  });

  it("recovers then runs for critical platform slices", () => {
    const playbook = buildRuntimePressurePlaybook({
      agent: { sourceType: "platform" },
      pressure: buildPressure({ pressureLevel: "critical" }),
      runtimeSummary: buildRuntimeSummary({ openCount: 3, staleOpenCount: 2 }),
      queuedCount: 4,
      runningCount: 1,
      failedCount: 0,
    });
    assert.ok(playbook);
    assert.equal(playbook.title, "优先稳定该归属切片");
    assert.equal(playbook.shouldRecoverThenRun, true);
    assert.equal(playbook.shouldRecoverStale, true);
    assert.equal(playbook.shouldRunExecutor, true);
    assert.equal(playbook.staleSeconds, 600);
  });

  it("prefers stale recovery, then queue pushing, on platform slices", () => {
    const stale = buildRuntimePressurePlaybook({
      agent: { sourceType: "platform" },
      pressure: null,
      runtimeSummary: buildRuntimeSummary({ openCount: 2, staleOpenCount: 1 }),
      queuedCount: 0,
      runningCount: 0,
      failedCount: 0,
    });
    assert.equal(stale?.title, "优先恢复过期执行");
    assert.equal(stale?.tone, "warning");

    const queued = buildRuntimePressurePlaybook({
      agent: { sourceType: "platform" },
      pressure: null,
      runtimeSummary: buildRuntimeSummary({}),
      queuedCount: 2,
      runningCount: 0,
      failedCount: 0,
    });
    assert.equal(queued?.title, "推进排队积压");
    assert.equal(queued?.shouldRunExecutor, true);

    const calm = buildRuntimePressurePlaybook({
      agent: { sourceType: "platform" },
      pressure: null,
      runtimeSummary: buildRuntimeSummary({}),
      queuedCount: 0,
      runningCount: 0,
      failedCount: 0,
    });
    assert.equal(calm?.title, "运行状态平稳");
  });

  it("sweeps residue for external agents and stays calm otherwise", () => {
    const residue = buildRuntimePressurePlaybook({
      agent: { sourceType: "external" },
      pressure: null,
      runtimeSummary: buildRuntimeSummary({
        staleOpenCount: 3,
        terminalExecutionOpenCount: 1,
      }),
      queuedCount: 0,
      runningCount: 0,
      failedCount: 0,
    });
    assert.equal(residue?.title, "清理外部运行残留");
    assert.equal(residue?.tone, "danger");
    assert.equal(residue?.shouldSweepSessions, true);

    const calm = buildRuntimePressurePlaybook({
      agent: { sourceType: "external" },
      pressure: null,
      runtimeSummary: buildRuntimeSummary({}),
      queuedCount: 0,
      runningCount: 0,
      failedCount: 0,
    });
    assert.equal(calm?.title, "运行信号平稳");
  });

  it("clamps recovery, executor and sweep limits", () => {
    const playbook = buildRuntimePressurePlaybook({
      agent: { sourceType: "platform" },
      pressure: buildPressure({ pressureLevel: "critical" }),
      runtimeSummary: buildRuntimeSummary({
        openCount: 80,
        staleOpenCount: 70,
        terminalExecutionOpenCount: 10,
      }),
      queuedCount: 40,
      runningCount: 0,
      failedCount: 0,
    });
    assert.equal(playbook?.recoveryLimit, 25);
    assert.equal(playbook?.executorLimit, 12);
    assert.equal(playbook?.sweepLimit, 50);
  });
});
