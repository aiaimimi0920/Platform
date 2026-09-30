import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("legacy callback operations route redirects to the callback-aware agent console", () => {
  assert.match(source, /redirect\(`\/ops\/account\/agents\$\{suffix\}`\)/);
});

test("legacy callback operations route preserves scalar and repeated query values", () => {
  assert.match(source, /const values = Array\.isArray\(value\) \? value : \[value\]/);
  assert.match(source, /query\.append\(key, entry\)/);
});
