import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const serviceDir = new URL("./service/", import.meta.url);
const routerSource = readFileSync(new URL("./router.ts", import.meta.url), "utf8");
const routerDir = new URL("./router/", import.meta.url);
const subrouterSource = readdirSync(routerDir)
  .filter((fileName) => fileName.endsWith(".ts"))
  .sort()
  .map((fileName) => readFileSync(new URL(fileName, routerDir), "utf8"))
  .join("\n");
const alertSource = readFileSync(new URL("anomaly-alerts.ts", serviceDir), "utf8");
const incidentSource = readFileSync(new URL("anomaly-incidents.ts", serviceDir), "utf8");
const policySource = readFileSync(new URL("anomaly-policies.ts", serviceDir), "utf8");
const providerHealthSource = readFileSync(new URL("provider-health.ts", serviceDir), "utf8");

test("anomaly normalizers do not create an alerts-incidents static cycle", () => {
  assert.match(alertSource, /from "\.\/anomaly-normalizers"/);
  assert.match(incidentSource, /from "\.\/anomaly-normalizers"/);
  assert.doesNotMatch(incidentSource, /from "\.\/anomaly-alerts"/);
});

test("anomaly policy triggers sync without a policies-sync static cycle", () => {
  assert.doesNotMatch(policySource, /from "\.\/anomaly-sync"/);
  assert.match(policySource, /await import\("\.\/anomaly-sync"\)/);
});

test("gateway facade mounts every split router and preserves its 87 routes", () => {
  const registrations = Array.from(
    routerSource.matchAll(/\b(register[A-Za-z]+Routes)\(app\);/g),
    (match) => match[1],
  );
  assert.deepEqual(registrations, [
    "registerOperatorCatalogRoutes",
    "registerOperatorAuditsRoutes",
    "registerAnalysisSummaryRoutes",
    "registerPromptCacheRoutes",
    "registerRateLimitHotspotRoutes",
    "registerAnomalyPolicyRoutes",
    "registerAnalysisExportRoutes",
    "registerAnomalyIncidentRoutes",
    "registerAnomalyRemediationRoutes",
    "registerRemediationEffectivenessRoutes",
    "registerProviderAdminRoutes",
  ]);
  assert.equal(new Set(registrations).size, registrations.length);
  const routeRegistrations = subrouterSource.match(/\bapp\.(?:get|post|put|delete|patch)\b/g) ?? [];
  assert.equal(routeRegistrations.length, 87);
});

test("provider probe lock renews and releases only for the owning token", () => {
  assert.match(providerHealthSource, /env\.providerFetchTimeoutMs \* 2 \+ 10_000/);
  assert.match(providerHealthSource, /redis\.call\("pexpire", KEYS\[1\], ARGV\[2\]\)/);
  assert.match(providerHealthSource, /redis\.call\("del", KEYS\[1\]\)/);
  assert.doesNotMatch(providerHealthSource, /const current = await redis\.get\(lockKey\)/);
});
