import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createAcceptanceManifest, finalizeAcceptanceManifest } from "../manifest.mjs";
import { runAcceptanceCommand } from "../run-command.mjs";
import {
  createRequiredInventory,
  runRequiredAcceptance,
  validateRequiredInventory,
} from "../run-required.mjs";

test("required orchestration executes every inventory item after failures and records each result", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-required-orchestration-"));
  const manifest = createAcceptanceManifest({
    runId: "required-orchestration-test",
    evidenceDir,
  });
  const executed = [];
  const inventory = [
    { id: "required-pass", layer: "required", command: "fixture-pass", args: [] },
    { id: "required-fail", layer: "required", command: "fixture-fail", args: [] },
    { id: "required-skip", layer: "required", command: "fixture-skip", args: [] },
  ];

  const result = await runRequiredAcceptance({
    manifest,
    evidenceDir,
    inventory,
    validateInventory: false,
    runCommand: async (spec) => {
      executed.push(spec.id);
      if (spec.id === "required-fail") {
        return {
          id: spec.id,
          layer: spec.layer,
          status: "failed",
          command: spec.command,
          args: spec.args,
          exitCode: 7,
          evidencePath: path.join(evidenceDir, `${spec.id}.json`),
        };
      }
      if (spec.id === "required-skip") {
        return {
          id: spec.id,
          layer: spec.layer,
          status: "skipped",
          command: spec.command,
          args: spec.args,
          exitCode: 0,
          evidencePath: path.join(evidenceDir, `${spec.id}.json`),
          skipReason: "fixture unavailable",
        };
      }
      return {
        id: spec.id,
        layer: spec.layer,
        status: "passed",
        command: spec.command,
        args: spec.args,
        exitCode: 0,
        evidencePath: path.join(evidenceDir, `${spec.id}.json`),
      };
    },
  });

  assert.deepEqual(executed, ["required-pass", "required-fail", "required-skip"]);
  assert.equal(result.results.length, inventory.length);
  assert.equal(result.manifest.suites.required.discovered, inventory.length);
  assert.equal(result.manifest.suites.required.executed, 2);
  assert.equal(result.manifest.suites.required.passed, 1);
  assert.equal(result.manifest.suites.required.failed, 1);
  assert.equal(result.manifest.suites.required.skipped, 1);
  const persisted = JSON.parse(
    await readFile(path.join(evidenceDir, "acceptance-manifest.json"), "utf8"),
  );
  assert.equal(persisted.results.length, inventory.length);
});

test("required orchestration records a failed result when a command runner throws and continues", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-required-throw-"));
  const manifest = createAcceptanceManifest({
    runId: "required-orchestration-throw",
    evidenceDir,
  });
  const inventory = [
    { id: "throws", layer: "required", command: "fixture-throws", args: [] },
    { id: "after-throw", layer: "required", command: "fixture-after", args: [] },
  ];
  const result = await runRequiredAcceptance({
    manifest,
    evidenceDir,
    inventory,
    validateInventory: false,
    runCommand: async (spec) => {
      if (spec.id === "throws") throw new Error("spawn failed");
      return {
        id: spec.id,
        layer: spec.layer,
        status: "passed",
        command: spec.command,
        args: spec.args,
        exitCode: 0,
        evidencePath: path.join(evidenceDir, `${spec.id}.json`),
      };
    },
  });

  assert.deepEqual(result.manifest.results.map((item) => item.id), ["throws", "after-throw"]);
  assert.equal(result.manifest.results[0].status, "failed");
  assert.match(result.manifest.results[0].skipReason ?? "", /spawn failed/i);
  assert.equal(result.manifest.results[1].status, "passed");
  await readFile(result.manifest.results[0].evidencePath, "utf8");
});

test("required orchestration records Hook source inventory as not-applicable instead of passed", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-required-hook-inventory-"));
  const manifest = createAcceptanceManifest({
    runId: "required-hook-inventory-test",
    evidenceDir,
  });
  const inventory = [
    {
      id: "external-hook-inventory",
      layer: "externalBoundary",
      command: process.execPath,
      args: ["hook-inventory.mjs"],
    },
  ];

  const result = await runRequiredAcceptance({
    manifest,
    evidenceDir,
    inventory,
    validateInventory: false,
    runCommand: async (spec) => {
      await mkdir(path.dirname(spec.evidencePath), { recursive: true });
      const evidence = {
        id: spec.id,
        status: "passed",
        stdout: JSON.stringify({
          schemaVersion: 1,
          target: "Hook",
          status: "not-applicable",
          inspectedFileCount: 12,
          matches: [],
        }),
        stderr: "",
      };
      await writeFile(spec.evidencePath, `${JSON.stringify(evidence)}\n`, "utf8");
      return {
        id: spec.id,
        layer: spec.layer,
        status: "passed",
        command: spec.command,
        args: spec.args,
        exitCode: 0,
        evidencePath: spec.evidencePath,
      };
    },
  });

  assert.equal(result.results[0].status, "not-applicable");
  assert.equal(manifest.suites.externalBoundary.executed, 1);
  assert.equal(manifest.suites.externalBoundary.notApplicable, 1);
  assert.equal(manifest.suites.externalBoundary.passed, 0);
  assert.equal(
    finalizeAcceptanceManifest(manifest, { requiredLayers: ["externalBoundary"] }).exitCode,
    0,
  );
  const evidence = JSON.parse(await readFile(result.results[0].evidencePath, "utf8"));
  assert.equal(evidence.status, "not-applicable");
  assert.equal(evidence.inventory.status, "not-applicable");
});

test("required orchestration keeps a discovered Hook runtime call point failed", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-required-hook-found-"));
  const manifest = createAcceptanceManifest({
    runId: "required-hook-found-test",
    evidenceDir,
  });

  const result = await runRequiredAcceptance({
    manifest,
    evidenceDir,
    inventory: [
      {
        id: "external-hook-inventory",
        layer: "externalBoundary",
        command: process.execPath,
        args: ["hook-inventory.mjs"],
      },
    ],
    validateInventory: false,
    runCommand: async (spec) => {
      await mkdir(path.dirname(spec.evidencePath), { recursive: true });
      const evidence = {
        id: spec.id,
        status: "failed",
        stdout: JSON.stringify({
          schemaVersion: 1,
          target: "Hook",
          status: "found-runtime-call-point",
          inspectedFileCount: 12,
          matches: [{ file: "package.json", line: 4, kind: "dependency" }],
        }),
        stderr: "",
      };
      await writeFile(spec.evidencePath, `${JSON.stringify(evidence)}\n`, "utf8");
      return {
        id: spec.id,
        layer: spec.layer,
        status: "failed",
        command: spec.command,
        args: spec.args,
        exitCode: 1,
        evidencePath: spec.evidencePath,
      };
    },
  });

  assert.equal(result.results[0].status, "failed");
  assert.equal(result.results[0].exitCode, 1);
  assert.equal(manifest.suites.externalBoundary.failed, 1);
});

test("required inventory exposes stable required and external-boundary ids", async () => {
  const { REQUIRED_SUITE_IDS, createRequiredInventory, validateRequiredInventory } = await import(
    "../run-required.mjs"
  );
  assert.deepEqual(REQUIRED_SUITE_IDS, [
    "unit",
    "vitest",
    "debt",
    "debt-vitest",
    "debt-node-mock",
    "integration-required",
    "typecheck",
    "build",
    "compose-render",
    "compose-startup",
    "browser-owner",
    "browser-visitor",
    "browser-operator",
    "browser-errors",
    "external-gateway",
    "external-loom",
    "external-tea",
    "external-hook-inventory",
  ]);
  assert.equal(validateRequiredInventory(createRequiredInventory()), true);
  assert.throws(
    () => validateRequiredInventory(createRequiredInventory().slice(1)),
    /inventory mismatch|missing/i,
  );
  const inventory = createRequiredInventory();
  for (const target of ["gateway", "loom", "tea"]) {
    const suite = inventory.find((item) => item.id === `external-${target}`);
    assert.match(suite.args[0], /external-probe\.mjs$/);
    assert.deepEqual(suite.args.slice(-2), ["--target", target]);
  }
  for (const journey of ["owner", "visitor", "operator", "errors"]) {
    const suite = inventory.find((item) => item.id === `browser-${journey}`);
    assert.ok(suite);
    assert.match(suite.args[0], /browser-evidence\.mjs$/);
    assert.deepEqual(suite.args.slice(1, 3), ["--journey", journey]);
    assert.deepEqual(suite.args.slice(3, 5), [
      "--report",
      path.resolve(".runtime/acceptance/inventory-preview/compose/startup/browser-results.json"),
    ]);
    assert.doesNotMatch(suite.args.join(" "), /not implemented/i);
  }
});

test("required inventory rejects missing root acceptance scripts", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "platform-required-missing-scripts-"));
  await writeFile(
    path.join(temporaryRoot, "package.json"),
    JSON.stringify({ scripts: { test: "node --version" } }),
    "utf8",
  );

  assert.throws(
    () => createRequiredInventory({ platformRoot: temporaryRoot }),
    /missing.*(?:test:vitest|test:debt|test:integration:required|typecheck|build)/i,
  );
  assert.throws(
    () => validateRequiredInventory(createRequiredInventory(), { platformRoot: temporaryRoot }),
    /missing.*(?:test:vitest|test:debt|test:integration:required|typecheck|build)/i,
  );
});

test("required npm inventory invokes root scripts without silent if-present flags", async () => {
  const { createRequiredInventory } = await import("../run-required.mjs");
  const inventory = createRequiredInventory();
  for (const id of ["integration-required", "typecheck", "unit", "debt", "build"]) {
    const suite = inventory.find((item) => item.id === id);
    assert.ok(suite);
    assert.equal(suite.args.includes("--if-present"), false, `${id} must not silently skip a root script`);
  }
  const integrationSuite = inventory.find((item) => item.id === "integration-required");
  assert.equal(integrationSuite.args.at(-2), "run");
  assert.equal(integrationSuite.args.at(-1), "test:integration:required");
});

test("required npm suites use a shell-free Windows invocation that can spawn", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-required-npm-spawn-"));
  const { createRequiredInventory } = await import("../run-required.mjs");
  const unit = createRequiredInventory({ evidenceDir }).find((item) => item.id === "unit");
  assert.ok(unit);

  const versionArgs = process.platform === "win32" ? [unit.args[0], "--version"] : ["--version"];
  if (process.platform === "win32") {
    assert.equal(unit.command, process.execPath);
    assert.match(unit.args[0], /npm-cli\.js$/i);
  }

  const result = await runAcceptanceCommand({
    ...unit,
    id: "npm-spawn-probe",
    args: versionArgs,
    evidencePath: path.join(evidenceDir, "npm-spawn-probe.json"),
  });
  assert.equal(result.status, "passed");
  assert.equal(result.exitCode, 0);
});

test("root smoke is the strict CI bridge and smoke:quick remains the lightweight command", async () => {
  const rootPackage = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
  assert.equal(rootPackage.scripts.smoke, "npm run acceptance:ci");
  assert.equal(rootPackage.scripts["smoke:quick"], "npm run test && node --test scripts/smoke.mjs");
});

test("Compose acceptance stage always cleans its owned environment and records the command result", async () => {
  const { runComposeStage } = await import("../compose-run.mjs");
  const calls = [];
  const environment = {
    runId: "compose-stage-child",
    projectName: "compose-stage-child",
    paths: {
      evidenceDir: "C:/evidence/compose",
      envFile: "C:/evidence/compose/resources/acceptance.env",
    },
  };
  const result = await runComposeStage({
    stage: "render",
    runId: "compose-stage-parent",
    evidenceDir: "C:/evidence",
    platformRoot: "C:/platform",
    createEnvironment: async (input) => {
      calls.push(["create", input]);
      return environment;
    },
    executeCommand: async (input) => {
      calls.push(["execute", input]);
      return { exitCode: 0, durationMs: 12, stdout: "", stderr: null };
    },
    cleanupProject: async (input) => {
      calls.push(["cleanup", input]);
      return { cleaned: true };
    },
    readEnvironment: async () => ({ POSTGRES_VOLUME_NAME: "owned-volume" }),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls.map(([kind]) => kind), ["create", "execute", "cleanup"]);
  assert.deepEqual(calls[1][1].args.slice(-2), ["config", "--quiet"]);
  assert.equal(calls[1][1].env.POSTGRES_VOLUME_NAME, "owned-volume");
});

test("Compose startup runs the desktop/mobile browser matrix before owned cleanup", async () => {
  const { runComposeStage } = await import("../compose-run.mjs");
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-compose-browser-"));
  const calls = [];
  const environment = {
    runId: "platform-startup-browser-child",
    projectName: "platform-startup-browser-child",
    paths: {
      evidenceDir: path.join(evidenceDir, "owned"),
      envFile: path.join(evidenceDir, "resources", "acceptance.env"),
    },
  };

  const result = await runComposeStage({
    stage: "startup",
    runId: "platform-startup-browser-parent",
    evidenceDir,
    platformRoot: "C:/platform",
    createEnvironment: async () => environment,
    readEnvironment: async () => ({ WEB_HOST_PORT: "45678" }),
    executeCommand: async (input) => {
      calls.push(["execute", input]);
      if (input.args.includes("ps")) {
        return { exitCode: 0, durationMs: 1, stdout: "[]", stderr: null };
      }
      return { exitCode: 0, durationMs: 1, stdout: "", stderr: null };
    },
    cleanupProject: async (input) => {
      calls.push(["cleanup", input]);
      return { cleaned: true };
    },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls.map(([kind]) => kind), ["execute", "execute", "execute", "execute", "cleanup"]);
  assert.deepEqual(calls[0][1].args.slice(1, 3), ["--parallel", "2"]);
  const browserCall = calls[2][1];
  assert.equal(browserCall.command, process.execPath);
  assert.match(browserCall.args[0], /node_modules[\\/]@playwright[\\/]test[\\/]cli\.js$/);
  assert.deepEqual(browserCall.args.slice(1), [
    "test",
    "--config",
    path.resolve("C:/platform/playwright.config.ts"),
  ]);
  assert.equal(browserCall.env.PLATFORM_ACCEPTANCE_WEB_URL, "http://127.0.0.1:45678");
  assert.equal(
    browserCall.env.PLAYWRIGHT_JSON_OUTPUT_FILE,
    path.join(path.resolve(evidenceDir), "compose", "startup", "browser-results.json"),
  );
  assert.equal(result.browserResult.exitCode, 0);
  assert.equal(result.postBrowserPsResult.exitCode, 0);
  const startupEvidence = JSON.parse(
    await readFile(path.join(path.resolve(evidenceDir), "compose", "startup", "compose-startup.json"), "utf8"),
  );
  assert.equal(startupEvidence.postBrowserPsExitCode, 0);
  assert.equal(startupEvidence.postBrowserPs, "[]");
});

test("Compose startup fails but still cleans its project when the browser matrix fails", async () => {
  const { runComposeStage } = await import("../compose-run.mjs");
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-compose-browser-fail-"));
  let executeCount = 0;
  let cleanupCount = 0;
  const result = await runComposeStage({
    stage: "startup",
    runId: "platform-startup-browser-failure",
    evidenceDir,
    platformRoot: "C:/platform",
    createEnvironment: async () => ({
      runId: "platform-startup-browser-failure-child",
      projectName: "platform-startup-browser-failure-child",
      paths: {
        evidenceDir: path.join(evidenceDir, "owned"),
        envFile: path.join(evidenceDir, "resources", "acceptance.env"),
      },
    }),
    readEnvironment: async () => ({ WEB_HOST_PORT: "45679" }),
    executeCommand: async (input) => {
      executeCount += 1;
      if (input.args.includes("ps")) return { exitCode: 0, stdout: "[]", stderr: null };
      if (input.args.includes("--config")) return { exitCode: 1, stdout: "failed", stderr: null };
      return { exitCode: 0, stdout: "", stderr: null };
    },
    cleanupProject: async () => {
      cleanupCount += 1;
      return { cleaned: true };
    },
  });

  assert.equal(executeCount, 9);
  assert.equal(cleanupCount, 1);
  assert.equal(result.browserResult.exitCode, 1);
  assert.equal(result.exitCode, 1);
  await access(result.startupDiagnosticsPath);
});

test("Compose startup captures redacted diagnostics before cleanup when up fails", async () => {
  const { runComposeStage } = await import("../compose-run.mjs");
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-compose-startup-diagnostics-"));
  const calls = [];
  const secret = "startup-diagnostics-secret-canary";
  const databaseUrl = "postgres://diagnostic-user:diagnostic-password@postgres:5432/neuroloom";

  const result = await runComposeStage({
    stage: "startup",
    runId: "platform-startup-diagnostics-parent",
    evidenceDir,
    platformRoot: "C:/platform",
    createEnvironment: async () => ({
      runId: "platform-startup-diagnostics-child",
      projectName: "platform-startup-diagnostics-child",
      paths: {
        evidenceDir: path.join(evidenceDir, "owned"),
        envFile: path.join(evidenceDir, "resources", "acceptance.env"),
      },
    }),
    readEnvironment: async () => ({
      WEB_HOST_PORT: "45680",
      NEXTAUTH_SECRET: secret,
      DATABASE_URL: databaseUrl,
    }),
    executeCommand: async (input) => {
      calls.push(["execute", input]);
      if (input.args.includes("up")) {
        return { exitCode: 1, stdout: "", stderr: `startup failed token=${secret}` };
      }
      if (input.args.includes("ps")) {
        return { exitCode: 0, stdout: '[{"Service":"web","Health":"unhealthy"}]', stderr: null };
      }
      if (input.args.includes("logs")) {
        return { exitCode: 0, stdout: `web crashed DATABASE_URL=${databaseUrl}`, stderr: null };
      }
      throw new Error("unexpected diagnostic command");
    },
    cleanupProject: async (input) => {
      calls.push(["cleanup", input]);
      return { cleaned: true };
    },
  });

  assert.equal(result.exitCode, 1);
  assert.deepEqual(calls.map(([kind]) => kind), [
    "execute",
    "execute",
    "execute",
    "execute",
    "execute",
    "execute",
    "cleanup",
  ]);
  assert.ok(calls[1][1].args.includes("--all"));
  assert.ok(calls[2][1].args.includes("logs"));
  const diagnosticPath = path.join(
    path.resolve(evidenceDir),
    "compose",
    "startup",
    "compose-startup-diagnostics.json",
  );
  const diagnosticText = await readFile(diagnosticPath, "utf8");
  assert.equal(diagnosticText.includes(secret), false);
  assert.equal(diagnosticText.includes(databaseUrl), false);
  assert.match(diagnosticText, /\[REDACTED\]/);
  assert.match(diagnosticText, /web crashed/);
});

test("Compose acceptance stage cleans an owned environment when reading its env file fails", async () => {
  const { runComposeStage } = await import("../compose-run.mjs");
  const calls = [];
  const environment = {
    runId: "compose-stage-child-read-failure",
    projectName: "compose-stage-child-read-failure",
    paths: {
      evidenceDir: "C:/evidence/compose-read-failure",
      envFile: "C:/evidence/compose-read-failure/resources/acceptance.env",
    },
  };

  await assert.rejects(
    runComposeStage({
      stage: "render",
      runId: "compose-stage-parent-read-failure",
      evidenceDir: "C:/evidence",
      platformRoot: "C:/platform",
      createEnvironment: async () => environment,
      executeCommand: async () => {
        calls.push("execute");
        return { exitCode: 0, durationMs: 1, stdout: "", stderr: null };
      },
      cleanupProject: async (input) => {
        calls.push(["cleanup", input]);
        return { cleaned: true };
      },
      readEnvironment: async () => {
        throw new Error("acceptance env read failed");
      },
    }),
    /acceptance env read failed/,
  );

  assert.deepEqual(calls.map((entry) => (Array.isArray(entry) ? entry[0] : entry)), ["cleanup"]);
  assert.equal(calls[0][1].projectName, environment.projectName);
});

test("Compose acceptance stage preserves a primary error when cleanup also fails", async () => {
  const { runComposeStage } = await import("../compose-run.mjs");
  const primaryError = new Error("compose command failed");
  const cleanupError = new Error("compose cleanup failed");

  await assert.rejects(
    runComposeStage({
      stage: "render",
      runId: "compose-stage-primary-error",
      evidenceDir: "C:/evidence",
      platformRoot: "C:/platform",
      createEnvironment: async () => ({
        runId: "compose-stage-primary-error-child",
        projectName: "compose-stage-primary-error-child",
        paths: {
          evidenceDir: "C:/evidence/compose-primary-error",
          envFile: "C:/evidence/compose-primary-error/resources/acceptance.env",
        },
      }),
      readEnvironment: async () => ({}),
      executeCommand: async () => {
        throw primaryError;
      },
      cleanupProject: async () => {
        throw cleanupError;
      },
    }),
    (error) => error === primaryError,
  );
});

test("Compose acceptance stage propagates cleanup failure when no primary error exists", async () => {
  const { runComposeStage } = await import("../compose-run.mjs");
  const cleanupError = new Error("compose cleanup failed");

  await assert.rejects(
    runComposeStage({
      stage: "render",
      runId: "compose-stage-cleanup-error",
      evidenceDir: "C:/evidence",
      platformRoot: "C:/platform",
      createEnvironment: async () => ({
        runId: "compose-stage-cleanup-error-child",
        projectName: "compose-stage-cleanup-error-child",
        paths: {
          evidenceDir: "C:/evidence/compose-cleanup-error",
          envFile: "C:/evidence/compose-cleanup-error/resources/acceptance.env",
        },
      }),
      readEnvironment: async () => ({}),
      executeCommand: async () => ({ exitCode: 0, stdout: "", stderr: null }),
      cleanupProject: async () => {
        throw cleanupError;
      },
    }),
    (error) => error === cleanupError,
  );
});
