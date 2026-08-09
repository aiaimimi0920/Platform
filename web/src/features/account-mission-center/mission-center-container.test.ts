import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./mission-center-container.tsx", import.meta.url), "utf8");

test("mission center trigger keeps an accessible name when mobile CSS hides its visible copy", () => {
  const triggerStart = source.indexOf("<button", source.indexOf("return ("));
  const triggerTagEnd = source.indexOf(">", triggerStart);

  assert.notEqual(triggerStart, -1);
  assert.notEqual(triggerTagEnd, -1);
  assert.match(source.slice(triggerStart, triggerTagEnd), /aria-label="福利中心"/);
});
