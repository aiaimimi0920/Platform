import assert from "node:assert/strict";
import { it } from "node:test";

process.env.CORE_INTERNAL_URL ??= "http://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN ??= "test-internal-token";

it("registers only executor tasks backed by a Core route", async () => {
  const { listExecutorTasks } = await import("./tasks");
  const tasks = listExecutorTasks();

  const taskNames: readonly string[] = tasks;
  assert.equal(taskNames.includes("discount-code-history-archive"), false);
  assert.equal(taskNames.includes("discount-code-history-archive-cleanup"), false);
});
