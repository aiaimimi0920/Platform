import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
    /missing.*(?:test:vitest|test:debt|test:integration|typecheck|build)/i,
  );
  assert.throws(
    () => validateRequiredInventory(createRequiredInventory(), { platformRoot: temporaryRoot }),
    /missing.*(?:test:vitest|test:debt|test:integration|typecheck|build)/i,
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
