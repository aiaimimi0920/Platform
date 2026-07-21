import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import {
  mailboxIdempotentPayloadMatches,
  normalizeMailboxIdempotencyKey,
} from "./idempotency";
import { mailboxMessages } from "../schema/player";

test("P2-05 RED: mailbox idempotency rejects blank keys and detects payload conflicts", () => {
  assert.equal(normalizeMailboxIdempotencyKey(undefined), null);
  assert.equal(normalizeMailboxIdempotencyKey(" key-1 "), "key-1");
  assert.throws(() => normalizeMailboxIdempotencyKey("   "), /idempotency key/i);

  const persisted = {
    folder: "stash",
    title: "Launch checklist",
    body: "Prepare the release.",
    type: "system",
    summary: "Prepare the release.",
    sourceLabel: "Heavy Chat",
    expiresAt: null,
    attachments: [
      {
        kind: "currency",
        title: "obsidian x 10",
        currency: "obsidian",
        amount: 10,
        productId: null,
        sortOrder: 0,
      },
    ],
  };
  assert.equal(mailboxIdempotentPayloadMatches(persisted, persisted), true);
  assert.equal(
    mailboxIdempotentPayloadMatches(persisted, { ...persisted, body: "Different payload" }),
    false,
  );
  assert.equal(
    mailboxIdempotentPayloadMatches(persisted, {
      ...persisted,
      attachments: [{ ...persisted.attachments[0], amount: 20 }],
    }),
    false,
  );
});

test("P2-05: mailbox schema and migration enforce owner-scoped message idempotency", async () => {
  const config = getTableConfig(mailboxMessages);
  assert.ok(config.indexes.some((index) => index.config.name === "mailbox_messages_user_idempotency_idx"));

  const migration = await readFile(
    path.resolve(__dirname, "../../../../migrations/20260720_00_mailbox_message_idempotency.sql"),
    "utf8",
  );
  assert.match(migration, /add column if not exists idempotency_key text/i);
  assert.match(
    migration,
    /unique index if not exists mailbox_messages_user_idempotency_idx\s+on mailbox_messages\(user_id, idempotency_key\)/i,
  );
});
