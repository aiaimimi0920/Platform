import assert from "node:assert/strict";
import test from "node:test";

import type { AgentCapabilityView } from "@neuro/contracts";

import { groupAgentCapabilitiesByAgentId } from "./agent-capability-catalog";

test("capability catalog grouping preserves owner agent order and ignores foreign rows", () => {
  const capabilities = [
    { id: "capability-b", agentId: "agent-b" },
    { id: "capability-a", agentId: "agent-a" },
    { id: "foreign-capability", agentId: "agent-c" },
  ] as AgentCapabilityView[];

  const grouped = groupAgentCapabilitiesByAgentId(["agent-a", "agent-b"], capabilities);

  assert.deepEqual([...grouped.keys()], ["agent-a", "agent-b"]);
  assert.deepEqual(grouped.get("agent-a")?.map((entry) => entry.id), ["capability-a"]);
  assert.deepEqual(grouped.get("agent-b")?.map((entry) => entry.id), ["capability-b"]);
  assert.equal(grouped.has("agent-c"), false);
});
