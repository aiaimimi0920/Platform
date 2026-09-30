import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providerSource = readFileSync(new URL("./providers/provider-inventory-ui.tsx", import.meta.url), "utf8");
const traceSource = readFileSync(new URL("./traces/page.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../../globals.css", import.meta.url), "utf8");

test("gateway long labels use wrapping classes instead of overflowing fixed controls", () => {
  assert.match(providerSource, /nt-provider-surface-chip/);
  assert.match(providerSource, /nt-provider-detail-link/);
  assert.match(providerSource, /nt-provider-badge-row/);
  assert.match(traceSource, /className="nt-gateway-request-grid"/);
  assert.match(globalStyles, /\.nt-provider-surface-chip[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(globalStyles, /\.nt-provider-detail-link[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(globalStyles, /\.nt-provider-badge-row[\s\S]*?align-items: flex-start;[\s\S]*?align-self: start;[\s\S]*?height: fit-content;/);
  assert.match(globalStyles, /\.nt-gateway-request-grid > \*[\s\S]*?min-width: 0;/);
});
