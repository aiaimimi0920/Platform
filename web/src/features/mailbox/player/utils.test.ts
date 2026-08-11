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
    /function syncMailboxState\(nextMessages: MailboxMessageView\[\], stateUserId: string\) \{([\s\S]*?)\n  \}/,
  )?.[1] ?? "";

  assert.match(syncFunction, /setSelectedMessageId\(\(current\) =>/);
  assert.doesNotMatch(syncFunction, /resolveSelectedMailboxMessageId\([^)]*selectedMessageId/);
});

test("P3-03: mailbox polling follows the latest deep-link target after the query changes", async () => {
  const utils = await import("./utils");
  const resolveSyncSelection = (utils as unknown as {
    resolveMailboxSyncSelection?: (
      messages: MailboxMessageView[],
      currentSelectedMessageId: string | null,
      targetedMessageId: string | null,
      targetChanged?: boolean,
    ) => string | null;
  }).resolveMailboxSyncSelection;

  assert.equal(typeof resolveSyncSelection, "function");
  if (!resolveSyncSelection) return;

  const messages = [message("inbox-1", "inbox"), message("stash-1", "stash"), message("stash-2", "stash")];
  const firstSelection = resolveSyncSelection(messages, null, "stash-1");
  assert.equal(firstSelection, "stash-1");
  assert.equal(resolveSyncSelection(messages, firstSelection, "stash-2"), "stash-2");
  assert.equal(resolveSyncSelection(messages, "inbox-1", "stash-2", true), "stash-2");
  assert.equal(resolveSyncSelection(messages, "inbox-1", "stash-2", false), "inbox-1");

  const hookSource = readFileSync(new URL("./use-mailbox-center.ts", import.meta.url), "utf8");
  assert.match(hookSource, /targetedMessageIdRef\.current/);
  assert.match(
    hookSource,
    /resolveMailboxSyncSelection\(messages, current, targetedMessageId, true\)/,
  );
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
  const genericMailboxRule = styles.lastIndexOf(".mailboxScope :global(.app-mailbox) {");
  const workspaceMailboxRule = styles.lastIndexOf(".mailboxScope :global(.app-mailbox.app-mailbox--workspace) {");
  assert.ok(workspaceMailboxRule > genericMailboxRule);
  assert.match(styles, /\.mailboxScope\s+:global\(\.app-mailbox\.app-mailbox--workspace\)[\s\S]*margin:\s*0;/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.app-mailbox\.app-mailbox--workspace[\s\S]*margin:\s*0;/);
});
