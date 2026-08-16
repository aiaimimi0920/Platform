import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { groupArbitrationCasesByTaskId } from "./server";

const source = readFileSync(new URL("./server.ts", import.meta.url), "utf8");

test("task market uses one capability catalog and bounded proposal fan-out", () => {
  assert.match(source, /listAgentCapabilityCatalog\(userContext\)/);
  assert.match(source, /const TASK_PROPOSAL_FETCH_CONCURRENCY = 6/);
  assert.match(
    source,
    /mapWithConcurrency\(\s*tasks,\s*TASK_PROPOSAL_FETCH_CONCURRENCY,/,
  );
  assert.doesNotMatch(source, /Promise\.all\(\s*tasks\.map/);
});

test("task arbitration grouping keeps stable empty buckets in one pass", () => {
  const taskCase = { id: "case-task", entityType: "task", entityId: "task-a" } as const;
  const unrelatedCase = { id: "case-other", entityType: "order", entityId: "task-a" } as const;

  const grouped = groupArbitrationCasesByTaskId(
    ["task-a", "task-b"],
    [taskCase, unrelatedCase],
  );

  assert.deepEqual(grouped.get("task-a"), [taskCase]);
  assert.deepEqual(grouped.get("task-b"), []);
  assert.equal(grouped.size, 2);
});
