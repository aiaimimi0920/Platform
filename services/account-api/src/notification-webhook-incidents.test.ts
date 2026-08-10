import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(process.cwd(), "src", "notification-webhook-incidents.ts"), "utf8");

test("notification webhook incident reads use bounded ordered concurrency", () => {
  assert.match(
    source,
    /import \{ mapWithConcurrency \} from "@neuro\/backend-foundation\/async\/map-with-concurrency";/,
  );
  assert.match(source, /const notificationWebhookIncidentReadConcurrency = 8;/);
  assert.match(
    source,
    /mapWithConcurrency\(\s*candidateKeys,\s*notificationWebhookIncidentReadConcurrency,\s*async \(key\) =>/,
  );
  assert.doesNotMatch(source, /Promise\.all\(\s*candidateKeys\.map/);
});
