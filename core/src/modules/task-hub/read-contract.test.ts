import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.resolve(process.cwd(), "src/modules/task-hub/repository.ts"), "utf8");
const globalListSource = source.slice(
  source.indexOf("export async function listTasksWithCounts()"),
  source.indexOf("export async function listTasksWithCountsByUser"),
);
const ownerListSource = source.slice(
  source.indexOf("export async function listTasksWithCountsByUser"),
  source.indexOf("export async function getTaskById"),
);

test("global task count reads stay scoped to visible tasks", () => {
  assert.match(
    globalListSource,
    /from\(taskApplications\)[\s\S]*?innerJoin\(tasks, eq\(taskApplications\.taskId, tasks\.id\)\)[\s\S]*?where\(ne\(tasks\.status, "draft"\)\)/,
  );
  assert.match(
    globalListSource,
    /from\(arbitrationCases\)[\s\S]*?innerJoin\(tasks, eq\(arbitrationCases\.entityId, tasks\.id\)\)[\s\S]*?ne\(tasks\.status, "draft"\)/,
  );
});

test("task list ordering is deterministic for equal timestamps", () => {
  const stableOrder = /orderBy\(desc\(tasks\.createdAt\), desc\(tasks\.id\)\)/;
  assert.match(globalListSource, stableOrder);
  assert.match(ownerListSource, stableOrder);
});
