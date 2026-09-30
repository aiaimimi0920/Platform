import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const gatewayOpsDir = fileURLToPath(new URL(".", import.meta.url));
const appDir = fileURLToPath(new URL("../../", import.meta.url));

function listGatewayComponents(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listGatewayComponents(path);
    }
    if (!entry.isFile() || !entry.name.endsWith(".tsx") || entry.name.includes(".test.")) {
      return [];
    }
    return [path];
  });
}

const gatewayComponents = [
  ...listGatewayComponents(gatewayOpsDir),
  // Rendered by six gateway pages and nothing else, so it belongs to this contract even
  // though it lives under components/ for reuse across those pages.
  fileURLToPath(new URL("../../../components/gateway-dependency-unavailable-card.tsx", import.meta.url)),
].map((path) => ({
  name: path.replace(gatewayOpsDir, "").replace(/\\/g, "/"),
  source: readFileSync(path, "utf8"),
}));

test("gateway ops components carry no hardcoded colors", () => {
  // The gateway pages used to run a stale blue-grey palette that ignored the NeuroTerminal
  // token layer. Colors belong in neuro-tokens.css, reached through var(--neuro-*).
  const colorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
  const offenders = gatewayComponents
    .map((file) => ({ name: file.name, colors: file.source.match(colorPattern) ?? [] }))
    .filter((file) => file.colors.length > 0)
    .map((file) => `${file.name}: ${[...new Set(file.colors)].join(", ")}`);

  assert.deepEqual(offenders, []);
});

test("gateway ops components build no style objects inside JSX", () => {
  // An inline style={{…}} allocates a fresh object on every render, which also defeats memo
  // on any child receiving it. Hoist to a module-scope const, or use an nt- utility class.
  const offenders = gatewayComponents
    .filter((file) => file.source.includes("style={{"))
    .map((file) => file.name);

  assert.deepEqual(offenders, []);
});

test("gateway ops components share the cached date formatter", () => {
  // Constructing Intl.DateTimeFormat per call is expensive and throws RangeError on
  // unparseable input, which crashes a server component. lib/platform-date-time.ts caches
  // one formatter at module scope and returns the empty label instead of throwing.
  const offenders = gatewayComponents
    .filter((file) => file.source.includes("Intl.DateTimeFormat"))
    .map((file) => file.name);

  assert.deepEqual(offenders, []);
});

test("every nt- class the gateway uses has a rule in the theme layer", () => {
  // A class with no rule renders as nothing, which is worse than the inline style it
  // replaced: nt-table, nt-table__cell, nt-btn--ghost and nt-card--outlined were all
  // referenced by gateway pages for a while with no definition anywhere.
  const styleSheet = ["neuro-tokens.css", "theme.css", "globals.css"]
    .map((file) => readFileSync(join(appDir, file), "utf8"))
    .join("\n");
  const defined = new Set(
    [...styleSheet.matchAll(/\.((?:nt|app|mg)-[a-zA-Z0-9_-]+)/g)].map((match) => match[1]),
  );

  const offenders = new Set<string>();
  for (const file of gatewayComponents) {
    for (const match of file.source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = (match[1] ?? match[2] ?? "").split(/[\s${}]+/).filter(Boolean);
      for (const className of classes) {
        if (/^(?:nt|app|mg)-/.test(className) && !defined.has(className)) {
          offenders.add(`${file.name}: ${className}`);
        }
      }
    }
  }

  assert.deepEqual([...offenders], []);
});

test("text tone utilities outrank the component classes they override", () => {
  // Tone utilities and .nt-btn--ghost / .nt-table__cell all set `color` with a single class,
  // so the cascade falls back to source order. Tones must come last to win.
  const globalStyles = readFileSync(join(appDir, "globals.css"), "utf8");
  const tonePosition = globalStyles.indexOf(".nt-text-danger");

  assert.ok(tonePosition > 0, "expected .nt-text-danger in globals.css");
  assert.ok(tonePosition > globalStyles.indexOf(".nt-btn--ghost"));
  assert.ok(tonePosition > globalStyles.indexOf(".nt-table__cell"));
});
