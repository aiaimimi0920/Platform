import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));

function runCli(scenario) {
  const script = [
    'import { createRequire } from "node:module";',
    'import { runIntegrationCli } from "./scripts/acceptance/integration-fixture.mjs";',
    'await import("embedded-postgres");',
    "const require = createRequire(import.meta.url);",
    'const dependencyRequire = createRequire(require.resolve("embedded-postgres"));',
    'const exitHook = dependencyRequire("async-exit-hook");',
    'exitHook((done) => setTimeout(() => { console.log("async-cleanup-finished"); done(); }, 10));',
    "const scenario = " + JSON.stringify(scenario) + ";",
    "await runIntegrationCli(() => ({",
    '    discoverWorkspaces: () => [{ name: "synthetic" }],',
    "    prepareFixture: async () => {",
    '      if (scenario === "prepare-error") throw new Error("synthetic setup error");',
    "      return { readiness: { postgres: true, valkey: true, s3: true } };",
    "    },",
    '    runWorkspaceCommand: async () => ({ exitCode: scenario === "success" ? 0 : 1 }),',
    '    cleanupFixture: async () => { console.log("fixture-cleanup-finished"); },',
    "}));",
  ].join("\n");
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root, encoding: "utf8", timeout: 5000,
  });
}

for (const scenario of ["success", "workspace-failure", "prepare-error"]) {
  test("integration CLI preserves " + scenario + " through embedded PostgreSQL async cleanup", () => {
    const result = runCli(scenario);
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, scenario === "success" ? 0 : 1, result.stderr);
    assert.match(result.stdout, /async-cleanup-finished/);
    if (scenario !== "prepare-error") assert.match(result.stdout, /fixture-cleanup-finished/);
  });
}

test("CLI exit guard does not overwrite another nonzero exit status", () => {
  const script = [
    'import { installCliExitCodeGuard } from "./scripts/acceptance/cli-exit-code.mjs";',
    "const setExitCode = installCliExitCodeGuard();",
    "setExitCode(1);",
    "process.exit(9);",
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root, encoding: "utf8", timeout: 5000,
  });
  assert.equal(result.status, 9);
});
