import assert from "node:assert/strict";
import test from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import { buildPublishedTaskCreatorFilter } from "./task-scope";

test("P2-05: account integration excludes task drafts from creator progression metrics", () => {
  const filter = buildPublishedTaskCreatorFilter("owner-a");
  const query = new PgDialect().sqlToQuery(filter);

  assert.match(query.sql, /creator_user_id/);
  assert.match(query.sql, /status.*<>/);
  assert.deepEqual(query.params, ["owner-a", "draft"]);
});
