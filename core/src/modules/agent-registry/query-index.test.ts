import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const schemaSource = readFileSync(path.resolve(process.cwd(), "src/modules/agent-registry/schema.ts"), "utf8");
const migrationSource = readFileSync(path.resolve(process.cwd(), "migrations/0141_agent_owner_created_order.sql"), "utf8");

test("agent owner listing has a composite ordering index", () => {
  assert.match(schemaSource, /ownerCreatedIdIdx: index\("agents_owner_created_id_idx"\)/);
  assert.match(schemaSource, /\.on\(table\.ownerUserId, table\.createdAt, table\.id\)/);
  assert.match(migrationSource, /create index if not exists agents_owner_created_id_idx/i);
  assert.match(migrationSource, /on agents \(owner_user_id, created_at, id\)/i);
});
