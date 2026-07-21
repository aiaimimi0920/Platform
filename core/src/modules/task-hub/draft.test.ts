import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import {
  buildTaskDraftRecord,
  normalizeTaskDraftInput,
  taskDraftPayloadMatches,
} from "./draft";
import { tasks } from "./schema";

test("P2-05 RED: task draft helper produces a zero-economy owner draft", () => {
  const input = normalizeTaskDraftInput({
    title: "Launch checklist",
    description: "Prepare the Platform release checklist.",
    preferredCapabilityCodes: ["release", "release"],
    idempotencyKey: "heavy-chat-action-1",
  });
  const record = buildTaskDraftRecord({
    id: "task-draft-1",
    ownerUserId: "owner-a",
    input,
    createdAt: new Date("2026-07-20T08:00:00.000Z"),
  });

  assert.equal(record.status, "draft");
  assert.equal(record.rewardAmount, 0);
  assert.equal(record.requiredBondAmount, 0);
  assert.equal(record.operationMode, "manual");
  assert.deepEqual(record.preferredCapabilityCodes, ["release"]);
  assert.equal(taskDraftPayloadMatches(record, input), true);
});

test("P2-05: task draft schema and migration enforce owner idempotency and zero-economy invariants", async () => {
  const config = getTableConfig(tasks);
  assert.ok(config.indexes.some((index) => index.config.name === "tasks_creator_idempotency_idx"));

  const migration = await readFile(
    path.resolve(__dirname, "../../../migrations/0139_task_draft_idempotency.sql"),
    "utf8",
  );
  assert.match(migration, /unique index if not exists tasks_creator_idempotency_idx\s+on tasks\(creator_user_id, idempotency_key\)/i);
  assert.match(migration, /status <> 'draft'/i);
  assert.match(migration, /idempotency_key is not null/i);
  assert.match(migration, /assigned_user_id is null/i);
  assert.match(migration, /reward_amount = 0/i);
  assert.match(migration, /required_bond_amount = 0/i);
  assert.match(migration, /operation_mode = 'manual'/i);
  assert.match(migration, /conrelid\s*=\s*'tasks'::regclass/i);
});
