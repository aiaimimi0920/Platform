import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

test("redemption-code actions encode localized status messages through the shared redirect builder", () => {
  assert.match(source, /buildStatusRedirect/);
  assert.match(source, /toMessage/);
  assert.doesNotMatch(source, /\?status=(?:success|error)&message=[^`"']*[\u3400-\u9fff]/u);
  assert.doesNotMatch(source, /error\.message === "NEXT_REDIRECT"/);
});
