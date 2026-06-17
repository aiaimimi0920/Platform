import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("account worker ops page renders stale outbox recovery health fields", () => {
  const page = readFileSync(join(process.cwd(), "src", "app", "ops", "account-worker", "page.tsx"), "utf8");

  assert.match(page, /lastOutboxRecoveryStatus/);
  assert.match(page, /lastOutboxRecoveryRequeuedCount/);
  assert.match(page, /lastOutboxRecoveryDeadLetterCount/);
  assert.match(page, /totalOutboxRecoveryRequeuedCount/);
  assert.match(page, /totalOutboxRecoveryDeadLetterCount/);
  assert.match(page, /lastOutboxRecoveryErrorMessage/);
});
