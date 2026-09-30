import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./announcement-center-container.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("announcement polling is abortable and rejects stale responses", () => {
  assert.match(source, /announcementRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /announcementRequestIdRef\.current !== requestId/);
  assert.match(source, /announcementRequestRef\.current\?\.id !== requestId/);
});

test("announcement polling skips overlap and cleans up active work", () => {
  assert.match(source, /if \(cancelled \|\| announcementRequestRef\.current\) \{\s*return;\s*\}/);
  assert.match(
    source,
    /window\.clearInterval\(intervalId\);\s*announcementRequestRef\.current\?\.controller\.abort\(\);/,
  );
  assert.match(source, /announcementRequestRef\.current = null;\s*announcementRequestIdRef\.current \+= 1;/);
});

test("announcement interaction state is isolated across account changes", () => {
  assert.match(source, /const \[stateUserId, setStateUserId\] = useState<string \| null>\(userId\);/);
  assert.match(source, /const identityReady = stateUserId === userId;/);
  assert.match(source, /const visibleOpen = identityReady && open;/);
  assert.match(source, /setStateUserId\(userId\);\s*setOpen\(false\);\s*wasOpenRef\.current = false;/);
  assert.match(source, /if \(!identityReady\) \{\s*return;\s*\}/);
  assert.match(source, /identityReady &&\s*userId/);
});

test("announcement hero keeps multiline titles and timestamps in normal flow", () => {
  const titleRule = styles.match(/\.app-announcement__hero-copy strong\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const timestampRule = styles.match(/\.app-announcement__hero-copy span:last-child\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(titleRule, /line-height:\s*1\.05/);
  assert.doesNotMatch(titleRule, /transform:/);
  assert.doesNotMatch(titleRule, /min-block-size:\s*1\.8em/);
  assert.match(timestampRule, /position:\s*static/);
});

test("mobile announcement layout puts the selected article before the archive rail", () => {
  assert.match(
    styles,
    /@media \(max-width: 980px\)[\s\S]*?\.app-announcement__content\s*\{\s*order:\s*-1;\s*\}/,
  );
});

test("desktop announcement modal stays compact enough to keep the account shell visible", () => {
  const modalRule = styles.match(/\.app-announcement\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const itemRule = styles.match(/\.app-announcement__item\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(modalRule, /width:\s*min\(1180px,\s*calc\(100vw - 72px\)\)/);
  assert.match(modalRule, /height:\s*min\(720px,\s*calc\(100vh - 144px\)\)/);
  assert.match(modalRule, /grid-template-columns:\s*minmax\(260px,\s*300px\)/);
  assert.match(itemRule, /min-height:\s*92px/);
});
