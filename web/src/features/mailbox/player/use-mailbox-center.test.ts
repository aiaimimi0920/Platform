import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./use-mailbox-center.ts", import.meta.url), "utf8");

test("mailbox favorite and delete mutations update the latest state snapshot", () => {
  assert.match(source, /const targetMessageId = selectedMessage\.id/);
  assert.match(source, /encodeURIComponent\(targetMessageId\).*favorite/);
  assert.match(source, /updateMessagesForUser\(requestUserId, \(current\) =>\s*current\.map\(/);
  assert.match(
    source,
    /updateMessagesForUser\(requestUserId, \(current\) =>\s*current\.filter\(\(message\) => message\.id !== targetMessageId\)/,
  );
  assert.match(source, /setSelectedMessageId\(\(current\) => \(current === targetMessageId \? null : current\)\)/);
});

test("mailbox favorite and delete mutations request a canonical refresh", () => {
  const refreshCalls = source.match(/refreshMailbox\(\);/g) ?? [];
  assert.ok(refreshCalls.length >= 5, "claim, archive, favorite, and delete paths should refresh canonical mailbox state");
});

test("mailbox binds message content and asynchronous writes to the active identity", () => {
  assert.match(source, /messagesState\?\.userId === userId \? messagesState\.messages : EMPTY_MAILBOX_MESSAGES/);
  assert.match(source, /setMessagesState\(\{ messages: nextMessages, userId: stateUserId \}\)/);
  assert.match(source, /activeUserIdRef\.current !== requestUserId/);
  assert.match(source, /syncMailboxState\(payload\.messages, requestUserId\)/);
});

test("mailbox clears identity-owned messages, selections, and pending actions", () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*setMessagesState\(null\);[\s\S]*?setSelectedMessageId\(null\);[\s\S]*?setDeleteConfirmPending\(false\);[\s\S]*?\}, \[userId\]\)/,
  );
  assert.match(source, /const requestUserId = userId;\s*const targetMessageId = selectedMessage\.id;/);
  assert.match(
    source,
    /if \(activeUserIdRef\.current === requestUserId\) \{\s*pendingReadIdsRef\.current\.delete\(targetMessageId\);/,
  );
});
