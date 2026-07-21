import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MailboxMessageView } from "@neuro/contracts";

import { resolveSelectedMailboxMessageId, selectMailboxMessages } from "./utils";

function message(id: string, folder: MailboxMessageView["folder"]): MailboxMessageView {
  return {
    id,
    folder,
    title: id,
    summary: id,
    body: id,
    sourceLabel: "Heavy Chat",
    type: "system",
    readAt: null,
    favoritedAt: null,
    expiresAt: null,
    createdAt: "2026-07-20T08:00:00.000Z",
    attachments: [],
    pendingAttachmentCount: 0,
    claimedAttachmentCount: 0,
  };
}

test("P2-05: mailbox deep link includes a targeted stash message without exposing all stash rows", () => {
  const messages = [message("inbox-1", "inbox"), message("stash-1", "stash"), message("stash-2", "stash")];
  assert.deepEqual(selectMailboxMessages(messages).map((item) => item.id), ["inbox-1"]);
  assert.deepEqual(selectMailboxMessages(messages, "stash-1").map((item) => item.id).sort(), ["inbox-1", "stash-1"]);
});

test("P2-05: first mailbox hydration selects a targeted stash while preserving an existing user selection", () => {
  const messages = [message("inbox-1", "inbox"), message("inbox-2", "inbox"), message("stash-1", "stash")];
  const visible = selectMailboxMessages(messages, "stash-1");

  assert.equal(resolveSelectedMailboxMessageId(visible, null, "stash-1"), "stash-1");
  assert.equal(resolveSelectedMailboxMessageId(visible, "inbox-2", "stash-1"), "inbox-2");
  assert.equal(resolveSelectedMailboxMessageId(selectMailboxMessages(messages), null, "stash-1"), "inbox-1");
});

test("P2-05 RED: mailbox polling resolves selection from the latest React state", () => {
  const hookSource = readFileSync(new URL("./use-mailbox-center.ts", import.meta.url), "utf8");
  const syncFunction = hookSource.match(
    /function syncMailboxState\(nextMessages: MailboxMessageView\[\]\) \{([\s\S]*?)\n  \}/,
  )?.[1] ?? "";

  assert.match(syncFunction, /setSelectedMessageId\(\(current\) =>/);
  assert.doesNotMatch(syncFunction, /resolveSelectedMailboxMessageId\([^)]*selectedMessageId/);
});

test("P2-05: long mailbox titles wrap before the expiry column", () => {
  const styles = readFileSync(new URL("./mailbox-center.module.css", import.meta.url), "utf8");

  assert.match(
    styles,
    /\.mailboxScope\s+:global\(\.app-mailbox__hero-copy strong\)\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*\}/s,
  );
  assert.match(
    styles,
    /\.mailboxScope\s+:global\(\.app-mailbox__hero-side\)\s*\{[^}]*min-width:\s*0;[^}]*\}/s,
  );
});
