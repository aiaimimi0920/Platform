import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./resource-contract-editor.tsx", import.meta.url), "utf8");

test("resource contract file reads are versioned, cancellable, and unmount-safe", () => {
  assert.match(source, /fileReadVersionRef = useRef\(new Map/);
  assert.match(source, /fileReadersRef = useRef\(new Map/);
  assert.match(source, /reader\.abort\(\)/);
  assert.match(source, /reader\.onabort = \(\) => reject/);
  assert.match(source, /fileReadVersionRef\.current\.get\(slot\) !== readVersion/);
  assert.match(source, /!mountedRef\.current/);
});

test("resource contract copy indicators do not let an older timer clear a newer copy", () => {
  assert.match(source, /copyTimeoutsRef = useRef\(new Map/);
  assert.match(source, /copyTimeoutsRef\.current\.get\(slot\) !== timeoutId/);
  assert.match(source, /copyTimeoutsRef\.current\.delete\(slot\);/);
  assert.match(source, /window\.clearTimeout\(previousTimeoutId\)/);
});
