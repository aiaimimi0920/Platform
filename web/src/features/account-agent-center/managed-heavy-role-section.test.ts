import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./managed-heavy-role-section.tsx", import.meta.url), "utf8");

test("P3-04 RED: managed-heavy slot summary is derived from live custom slot data instead of a hard-coded label", () => {
  assert.doesNotMatch(source, /const currentHeavySlotSummary = [`"\']1\s*\/\s*2[`"\']/);
  assert.match(source, /agents\.length\s*\+\s*1/);
  assert.match(source, /MANAGED_HEAVY_TOTAL_SLOT_LIMIT/);
});

test("P3-04 RED: managed-heavy overview wires real create and batch controls", () => {
  assert.match(source, /saveManagedHeavyAgentAction/);
  assert.match(source, /applyManagedHeavyAgentBatchAction/);
  assert.match(source, /name="batchAction"/);
  assert.match(source, /name="agentIds"/);
  assert.match(source, /panel === "create" \|\| Boolean\(editingAgent\)/);
});

test("P3-04 RED: default Mimi remains protected while custom slots stay operable", () => {
  assert.match(source, /MimiExtensionsEditor/);
  assert.match(source, /selectionModeActive/);
  assert.match(source, /购买槽位/);
  assert.match(source, /当前仅允许 1 个自创建重度槽位|更多槽位请先购买|slot limit/i);
});
