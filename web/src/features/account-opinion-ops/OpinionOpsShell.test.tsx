import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shellSource = readFileSync(new URL("./OpinionOpsShell.tsx", import.meta.url), "utf8");

test("opinion ops shell exposes the page title as an h1", () => {
  assert.match(shellSource, /<h1\b[^>]*>议题运维骨架<\/h1>/);
});
