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

test("mission center primes its badge once and only polls while its panel is open", () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*if \(!enabled \|\| !userId\)[\s\S]*?void refreshPanel\(\);[\s\S]*?\}, \[enabled, userId\]\);/,
  );
  assert.match(source, /if \(!enabled \|\| !userId \|\| !open\) \{/);
  assert.match(source, /window\.setInterval\(\(\) => \{[\s\S]*?syncPanel\(\);[\s\S]*?\}, MISSION_POLL_INTERVAL_MS\)/);
  assert.match(source, /\}, \[enabled, open, userId\]\);/);
});

test("mission center binds panel and mutation results to the active identity", () => {
  assert.match(source, /panelState\?\.userId === userId \? panelState\.panel : null/);
  assert.match(source, /const requestUserId = userId/);
  assert.match(source, /activeUserIdRef\.current !== requestUserId/);
  assert.match(source, /setPanelState\(\{ panel: payload\.panel, userId: requestUserId \}\)/);
  assert.match(source, /refreshPanel\(selectedTabRef\.current\)/);
});

test("mission center clears identity-owned state when the account changes", () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*setPanelState\(null\);[\s\S]*?setPendingMissionId\(null\);[\s\S]*?setPendingWagerMissionId\(null\);[\s\S]*?\}, \[userId\]\)/,
  );
});
