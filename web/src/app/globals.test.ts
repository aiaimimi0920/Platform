import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalsCss = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

test("mobile landing entry keeps status away from the bottom-anchored login panel", () => {
  assert.match(
    globalsCss,
    /@media \(max-width: 1100px\)[\s\S]*?\.app-entry__signal-bar\s*\{[\s\S]*?width:\s*var\(--entry-bar-width,\s*28px\);/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width: 1100px\)[\s\S]*?\.app-entry__status\s*\{[\s\S]*?top:\s*24px;[\s\S]*?bottom:\s*auto;/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width: 760px\)[\s\S]*?\.app-entry__status\s*\{[\s\S]*?top:\s*18px;[\s\S]*?bottom:\s*auto;/,
  );
});

test("mobile ops shell uses a single-column layout instead of pinning the rail beside content", () => {
  assert.match(
    globalsCss,
    /@media \(max-width: 760px\)[\s\S]*?\.ops-layout\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width: 760px\)[\s\S]*?\.ops-rail\s*\{[\s\S]*?position:\s*static;/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width: 760px\)[\s\S]*?\.ops-main\s*\{[\s\S]*?padding:\s*18px 14px 28px;/,
  );
});

test("mobile gateway split panes collapse instead of forcing horizontal scroll", () => {
  assert.match(
    globalsCss,
    /\.nt-gateway-split-pane\s*\{[\s\S]*?grid-template-columns:\s*minmax\(320px,\s*0\.9fr\)\s*minmax\(360px,\s*1\.1fr\);/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width: 760px\)[\s\S]*?\.nt-gateway-split-pane\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width: 760px\)[\s\S]*?\.nt-gateway-sticky-panel\s*\{[\s\S]*?position:\s*static\s*!important;/,
  );
});

test("dashboard terminal keeps the hero title visible in the first viewport", () => {
  assert.match(
    globalsCss,
    /\.app-page--dashboard \.mg-terminal-hero\s*\{[\s\S]*?align-items:\s*start;/,
  );
  assert.match(
    globalsCss,
    /\.app-page--dashboard \.mg-terminal-hero__body\s*\{[\s\S]*?align-content:\s*start;/,
  );
  assert.match(
    globalsCss,
    /\.app-page--dashboard \.mg-terminal-stage__media\s*\{[\s\S]*?min-height:\s*300px;/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width: 1100px\)\s*\{\s*\.app-page--dashboard \.mg-terminal-hero\s*\{[\s\S]*?order:\s*-1;[\s\S]*?\}\s*\.app-page--dashboard \.mg-terminal-hero__body\s*\{[\s\S]*?order:\s*-1;/,
  );
});

test("dashboard ops shortcut stays below navigation-owned modal overlays", () => {
  const navigationZIndex = Number(globalsCss.match(/\.app-nav\s*\{[^}]*z-index:\s*(\d+);/)?.[1]);
  const opsShortcutZIndex = Number(globalsCss.match(/\.nt-dashboard-ops-fab-wrap\s*\{[^}]*z-index:\s*(\d+);/)?.[1]);

  assert.ok(Number.isInteger(navigationZIndex), "app navigation must declare an integer z-index");
  assert.ok(Number.isInteger(opsShortcutZIndex), "dashboard ops shortcut must declare an integer z-index");
  assert.ok(
    opsShortcutZIndex < navigationZIndex,
    `dashboard ops shortcut z-index ${opsShortcutZIndex} must stay below navigation z-index ${navigationZIndex}`,
  );
});
