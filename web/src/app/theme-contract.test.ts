import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const canonicalTokens = readFileSync(new URL("./neuro-tokens.css", import.meta.url), "utf8");
const themeCss = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
const globalsCss = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function selectorBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = themeCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `missing theme selector: ${selector}`);
  return match[1];
}

test("Platform owns the exact canonical Neuro color tokens", () => {
  const expectedTokens = new Map([
    ["--neuro-signal-yellow", "#d9ff38"],
    ["--neuro-signal-green", "#22c55e"],
    ["--neuro-info-blue", "#06b6d4"],
    ["--neuro-danger-red", "#f43f5e"],
    ["--neuro-bg", "#06080d"],
    ["--neuro-surface", "#090c11"],
    ["--neuro-panel", "#0e1218"],
    ["--neuro-rail", "#070a0f"],
    ["--neuro-control", "#111720"],
    ["--neuro-control-hover", "#18222c"],
    ["--neuro-text", "#f7f8ef"],
    ["--neuro-text-muted", "#929a9f"],
    ["--neuro-focus-surface", "#f3f5f1"],
    ["--neuro-focus-ink", "#20252b"],
    ["--neuro-focus-muted", "#656b72"],
  ]);

  for (const [name, value] of expectedTokens) {
    assert.match(canonicalTokens, new RegExp(`${name}:\\s*${value};`, "i"), `${name} must stay canonical`);
  }
  assert.match(canonicalTokens, /--neuro-line:\s*rgba\(255,\s*255,\s*255,\s*0\.12\);/);
  for (const derivedToken of [
    "--neuro-yellow-hover",
    "--neuro-yellow-pressed",
    "--neuro-yellow-soft",
    "--neuro-green-soft",
    "--neuro-info-soft",
    "--neuro-danger-soft",
  ]) {
    assert.match(canonicalTokens, new RegExp(`${derivedToken}:\\s*color-mix\\(`));
  }
});

test("legacy Platform theme variables are compatibility aliases, not a competing palette", () => {
  assert.match(themeCss, /^@import\s+"\.\/neuro-tokens\.css";/);
  const expectedAliases = new Map([
    ["--mg-bg", "--neuro-bg"],
    ["--mg-panel", "--neuro-panel"],
    ["--mg-border", "--neuro-line"],
    ["--mg-text", "--neuro-text"],
    ["--mg-text-muted", "--neuro-text-muted"],
    ["--mg-signal", "--neuro-signal-yellow"],
    ["--mg-success", "--neuro-signal-green"],
    ["--mg-warning", "--neuro-signal-yellow"],
    ["--mg-danger", "--neuro-danger-red"],
    ["--mg-cyan", "--neuro-info-blue"],
  ]);

  for (const [alias, semanticToken] of expectedAliases) {
    assert.match(themeCss, new RegExp(`${alias}:\\s*var\\(${semanticToken}\\);`));
  }
  assert.doesNotMatch(themeCss, /#8b5cf6|#d946ef|#ec4899|#f59e0b/i);
  assert.doesNotMatch(themeCss, /rgba\((?:139,\s*92,\s*246|217,\s*70,\s*239|236,\s*72,\s*153|245,\s*158,\s*11),/i);
});

test("derived color computation stays inside the guarded token layer", () => {
  assert.match(canonicalTokens, /@supports\s*\(color:\s*color-mix\(in srgb, black, white\)\)/);
  assert.doesNotMatch(themeCss, /color-mix\(/);
  assert.doesNotMatch(globalsCss, /color-mix\(/);
  for (const token of [
    "--neuro-line-strong",
    "--neuro-text-soft",
    "--neuro-placeholder",
    "--neuro-info-hover",
    "--neuro-overlay",
    "--neuro-grid-line",
    "--neuro-hint-text",
  ]) {
    assert.match(canonicalTokens, new RegExp(`${token}:\\s*(?!color-mix\\()[^;]+;`));
  }
});

test("shared surfaces and controls consume semantic roles", () => {
  assert.match(themeCss, /(?:^|\n)body\s*\{[\s\S]*?background:\s*var\(--neuro-bg\);/);
  assert.match(selectorBlock(".nt-panel,\n.nt-card"), /border-radius:\s*var\(--nt-radius-card\);/);
  assert.match(selectorBlock(".nt-panel,\n.nt-card"), /background:\s*var\(--neuro-panel\);/);
  assert.match(selectorBlock(".nt-btn--primary"), /background:\s*var\(--neuro-signal-yellow\);/);
  assert.match(selectorBlock(".nt-btn--primary"), /color:\s*var\(--neuro-on-yellow\);/);
  assert.match(selectorBlock(".nt-btn--secondary"), /--neuro-info-(?:blue|line|soft|text)/);
  assert.match(selectorBlock(".nt-input,\n.nt-textarea,\n.nt-select"), /background:\s*var\(--neuro-control\);/);
  assert.match(selectorBlock(".nt-chip--success"), /--neuro-(?:signal-green|green-(?:line|soft|text))/);
  assert.match(selectorBlock(".nt-chip--warning"), /--neuro-(?:signal-yellow|yellow-(?:line|soft))/);
  assert.match(selectorBlock(".nt-chip--danger"), /--neuro-danger-(?:red|line|soft|text)/);
  assert.match(selectorBlock(".nt-chip--cyan"), /--neuro-info-(?:blue|line|soft|text)/);
});

test("global theme removes purple-pink glow decoration", () => {
  assert.doesNotMatch(selectorBlock("body"), /radial-gradient/);
  assert.match(selectorBlock(".mg-orb"), /display:\s*none;/);
  assert.doesNotMatch(themeCss, /\.mg-theme::before|\.mg-theme::after/);
  assert.doesNotMatch(
    globalsCss,
    /#(?:8b5cf6|d946ef|ec4899)|rgba\((?:139,\s*92,\s*246|217,\s*70,\s*239|236,\s*72,\s*153|147,\s*51,\s*234|99,\s*102,\s*241|106,\s*32,\s*158),/i,
  );
});

test("shared application chrome uses the same semantic token roles", () => {
  assert.match(globalsCss, /--app-account-modal-radius:\s*var\(--nt-radius-card\);/);
  assert.match(globalsCss, /\.app-nav\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--neuro-line\);[\s\S]*?background:\s*var\(--neuro-rail\);/);
  assert.match(globalsCss, /\.app-nav__mark\s*\{[\s\S]*?background:\s*var\(--neuro-green-soft\);/);
  assert.match(globalsCss, /\.app-redeem\s*\{[\s\S]*?border-radius:\s*var\(--nt-radius-card\);[\s\S]*?background:\s*var\(--neuro-panel\);/);
  assert.match(globalsCss, /\.app-redeem__compact-input\s*\{[\s\S]*?background:\s*var\(--neuro-control\);/);
  assert.match(globalsCss, /\.app-redeem__compact-submit\s*\{[\s\S]*?background:\s*var\(--neuro-signal-yellow\);[\s\S]*?color:\s*var\(--neuro-on-yellow\);/);
});

test("landing authentication and mobile operator access remain legible and unobstructed", () => {
  assert.match(globalsCss, /\.app-entry\s*\{[\s\S]*?background:\s*var\(--neuro-bg\);/);
  assert.match(globalsCss, /\.app-entry__panel\s*\{[\s\S]*?background:\s*var\(--neuro-panel\);[\s\S]*?color:\s*var\(--neuro-text\);/);
  assert.match(globalsCss, /\.app-entry__login-button\s*\{[\s\S]*?background:\s*var\(--neuro-signal-yellow\);[\s\S]*?color:\s*var\(--neuro-on-yellow\);/);
  assert.match(globalsCss, /\.app-entry__login-button--secondary\s*\{[\s\S]*?background:\s*var\(--neuro-info-soft\);[\s\S]*?color:\s*var\(--neuro-info-text\);/);
  assert.match(
    globalsCss,
    /@media \(max-width: 720px\)\s*\{\s*\.nt-dashboard-ops-fab-wrap\s*\{[\s\S]*?position:\s*static;/,
  );
});
