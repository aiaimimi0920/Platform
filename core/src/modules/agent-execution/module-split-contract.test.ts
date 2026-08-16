import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routerSource = readFileSync(path.resolve(__dirname, "router.ts"), "utf8");
const routerDir = path.resolve(__dirname, "router");
const subrouterSource = readdirSync(routerDir)
  .filter((fileName) => fileName.endsWith(".ts"))
  .sort()
  .map((fileName) => readFileSync(path.resolve(routerDir, fileName), "utf8"))
  .join("\n");

test("agent execution facade mounts every split router exactly once", () => {
  const registrations = Array.from(
    routerSource.matchAll(/\b(register[A-Za-z]+Routes)\(app\);/g),
    (match) => match[1],
  );
  assert.deepEqual(registrations, [
    "registerOwnedExecutionRoutes",
    "registerLaunchPresetRoutes",
    "registerRuntimeCatalogRoutes",
    "registerCallbackAuditRoutes",
    "registerRunRoutes",
    "registerRuntimeSessionRoutes",
    "registerDispatchRoutes",
    "registerSettlementRoutes",
    "registerExternalRuntimeRoutes",
  ]);
  assert.equal(new Set(registrations).size, registrations.length);
});

test("agent execution split preserves the 41-route HTTP surface", () => {
  const routeRegistrations = subrouterSource.match(/\bapp\.(?:get|post|put|delete|patch)\b/g) ?? [];
  assert.equal(routeRegistrations.length, 41);
});
