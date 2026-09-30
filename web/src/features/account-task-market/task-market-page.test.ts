import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./task-market-page.tsx", import.meta.url), "utf8");

test("task market renders guidance instead of a blank task grid", () => {
  assert.match(source, /filteredTaskBoard\.length === 0/);
  assert.match(source, /暂无匹配任务/);
  assert.match(source, /发布任务.*创建第一条需求/);
});
