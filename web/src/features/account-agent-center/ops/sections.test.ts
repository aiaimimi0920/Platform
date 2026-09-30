import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./sections.tsx", import.meta.url), "utf8");

test("callback audit card keeps both legacy and current deep-link anchors", () => {
  assert.match(source, /id="callback-audits"/);
  assert.match(source, /id="recent-callback-audits"/);
});
