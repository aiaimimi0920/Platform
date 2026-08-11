import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./use-mailbox-center.ts", import.meta.url), "utf8");

test("mailbox favorite and delete mutations update the latest state snapshot", () => {
  assert.match(source, /const targetMessageId = selectedMessage\.id/);
  assert.match(source, /encodeURIComponent\(targetMessageId\).*favorite/);
  assert.match(source, /setMessages\(\(current\) =>\s*current\.map\(/);
  assert.match(source, /setMessages\(\(current\) => current\.filter\(\(message\) => message\.id !== targetMessageId\)\)/);
  assert.match(source, /setSelectedMessageId\(\(current\) => \(current === targetMessageId \? null : current\)\)/);
});

test("mailbox favorite and delete mutations request a canonical refresh", () => {
  const refreshCalls = source.match(/refreshMailbox\(\);/g) ?? [];
  assert.ok(refreshCalls.length >= 5, "claim, archive, favorite, and delete paths should refresh canonical mailbox state");
});
