import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

test("Figma capture helper uses a native script tag instead of next/script", () => {
  assert.doesNotMatch(layoutSource, /from\s+["']next\/script["']/);
  assert.match(layoutSource, /<script\s+src="https:\/\/mcp\.figma\.com\/mcp\/html-to-design\/capture\.js"/);
  assert.match(layoutSource, /\sasync\s*\/>/);
});
