import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  recordSuiteResult,
  redactText,
  writeManifestAtomic,
} from "./manifest.mjs";
import { runAcceptanceCommand } from "./run-command.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultPlatformRoot = path.resolve(moduleDir, "../..");

export const REQUIRED_SUITE_IDS = [
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
];

export const REQUIRED_ROOT_SCRIPTS = Object.freeze({
  unit: "test",
  vitest: "test:vitest",
  debt: "test:debt",
  "integration-required": "test:integration",
  typecheck: "typecheck",
  build: "build",
});

export function validateRootAcceptanceScripts(platformRoot = defaultPlatformRoot) {
  const packagePath = path.join(platformRoot, "package.json");
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to read Platform root package.json for required acceptance scripts: ${packagePath}`,
      { cause: error },
    );
  }

  const scripts = packageJson?.scripts;
  const missing = Object.values(REQUIRED_ROOT_SCRIPTS).filter(
    (scriptName) => typeof scripts?.[scriptName] !== "string" || !scripts[scriptName].trim(),
  );
  if (missing.length > 0) {
    throw new Error(`Required acceptance root scripts missing: ${missing.join(", ")}`);
  }
  return true;
}

function npmInvocation(args) {
  if (process.platform !== "win32") {
    return { command: "npm", args };
  }

  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  const npmCliPath = candidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      /npm-cli\.js$/i.test(candidate) &&
      existsSync(candidate),
  );
  if (!npmCliPath) {
    throw new Error("Unable to locate npm-cli.js for shell-free Windows acceptance execution");
  }
  return { command: process.execPath, args: [npmCliPath, ...args] };
}

function missingSuiteCommand(message) {
  return {
    command: process.execPath,
    args: ["-e", `console.error(${JSON.stringify(message)}); process.exit(1)`],
  };
}

export function createRequiredInventory({
  platformRoot = defaultPlatformRoot,
  evidenceDir = path.join(platformRoot, ".runtime", "acceptance", "inventory-preview"),
  runId = "platform-inventory-preview",
} = {}) {
  validateRootAcceptanceScripts(platformRoot);
  const requiredEnvironment = {
    ...process.env,
    PLATFORM_ACCEPTANCE_MODE: "required",
  };
  const npmSuite = (id, args, timeoutMs) => {
    const invocation = npmInvocation(args);
    return {
      id,
      layer: "required",
      command: invocation.command,
      args: invocation.args,
      cwd: platformRoot,
      env: requiredEnvironment,
      timeoutMs,
    };
  };
  const missingBrowser = (id, journey) => ({
    id,
    layer: "required",
    cwd: platformRoot,
    ...missingSuiteCommand(`Required browser suite is not implemented yet: ${journey}`),
  });

  return [
    npmSuite("unit", ["run", "test"], 30 * 60 * 1000),
    npmSuite("vitest", ["run", "test:vitest"], 15 * 60 * 1000),
    npmSuite("debt", ["run", "test:debt"], 15 * 60 * 1000),
    npmSuite(
      "debt-vitest",
      ["run", "test:vitest:debt", "--workspace", "@neuro/ai-gateway-domain"],
      10 * 60 * 1000,
    ),
    npmSuite(
      "debt-node-mock",
      ["run", "test:node-mock:debt", "--workspace", "@neuro/ai-gateway-domain"],
      10 * 60 * 1000,
    ),
    npmSuite("integration-required", ["run", "test:integration"], 30 * 60 * 1000),
    npmSuite("typecheck", ["run", "typecheck"], 30 * 60 * 1000),
    npmSuite("build", ["run", "build"], 30 * 60 * 1000),
    {
      id: "compose-render",
      layer: "required",
      command: process.execPath,
      args: [
        path.join(platformRoot, "scripts", "acceptance", "compose-run.mjs"),
        "--stage",
        "render",
        "--run-id",
        runId,
        "--evidence-dir",
        evidenceDir,
      ],
      cwd: platformRoot,
      timeoutMs: 5 * 60 * 1000,
    },
    {
      id: "compose-startup",
      layer: "required",
      command: process.execPath,
      args: [
        path.join(platformRoot, "scripts", "acceptance", "compose-run.mjs"),
        "--stage",
        "startup",
        "--run-id",
        runId,
        "--evidence-dir",
        evidenceDir,
      ],
      cwd: platformRoot,
      timeoutMs: 50 * 60 * 1000,
    },
    missingBrowser("browser-owner", "Owner"),
    missingBrowser("browser-visitor", "Visitor"),
    missingBrowser("browser-operator", "Operator"),
    missingBrowser("browser-errors", "dependency error"),
    {
      id: "external-gateway",
      layer: "externalBoundary",
      command: process.execPath,
      args: [path.join(platformRoot, "scripts", "acceptance", "external-probe.mjs"), "--target", "gateway"],
      cwd: platformRoot,
      timeoutMs: 5 * 60 * 1000,
    },
    {
      id: "external-loom",
      layer: "externalBoundary",
      command: process.execPath,
      args: [path.join(platformRoot, "scripts", "acceptance", "external-probe.mjs"), "--target", "loom"],
      cwd: platformRoot,
      timeoutMs: 5 * 60 * 1000,
    },
    {
      id: "external-tea",
      layer: "externalBoundary",
      command: process.execPath,
      args: [path.join(platformRoot, "scripts", "acceptance", "external-probe.mjs"), "--target", "tea"],
      cwd: platformRoot,
      timeoutMs: 5 * 60 * 1000,
    },
    {
      id: "external-hook-inventory",
      layer: "externalBoundary",
      command: process.execPath,
      args: [path.join(platformRoot, "scripts", "acceptance", "hook-inventory.mjs")],
      cwd: platformRoot,
    },
  ];
}

export function validateRequiredInventory(inventory, { platformRoot = defaultPlatformRoot } = {}) {
  validateRootAcceptanceScripts(platformRoot);
  if (!Array.isArray(inventory)) throw new TypeError("Required acceptance inventory must be an array");
  const ids = inventory.map((item) => item?.id);
  const expected = new Set(REQUIRED_SUITE_IDS);
  const actual = new Set(ids);
  if (ids.length !== actual.size) throw new Error("Required acceptance inventory contains duplicate suite ids");
  const unknown = ids.filter((id) => !expected.has(id));
  const missing = REQUIRED_SUITE_IDS.filter((id) => !actual.has(id));
  if (unknown.length || missing.length) {
    throw new Error(
      `Required acceptance inventory mismatch: missing=${missing.join(",") || "none"}; unknown=${unknown.join(",") || "none"}`,
    );
  }
  return true;
}

function normalizeSuiteSpec(spec, { evidenceDir, platformRoot }) {
  return {
    ...spec,
    args: Array.isArray(spec.args) ? spec.args : [],
    cwd: spec.cwd || platformRoot,
    evidencePath:
      spec.evidencePath || path.join(evidenceDir, "suites", `${spec.id}.json`),
  };
}

async function recordRunnerFailure(manifest, spec, error) {
  const message = error instanceof Error ? error.message : String(error);
  const result = {
    id: spec.id,
    layer: spec.layer,
    status: "failed",
    command: spec.command,
    args: spec.args,
    exitCode: 1,
    evidencePath: spec.evidencePath,
    skipReason: redactText(message),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };
  await writeManifestAtomic(spec.evidencePath, {
    ...result,
    error: redactText(message),
  });
  return recordSuiteResult(manifest, result);
}

function parseHookInventoryOutput(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || parsed.target !== "Hook") return null;
    if (![
      "not-applicable",
      "found-runtime-call-point",
    ].includes(parsed.status)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function classifyHookInventoryResult(spec, result) {
  if (spec.id !== "external-hook-inventory") return result;

  let evidenceDocument = null;
  let inventory = parseHookInventoryOutput(result.stdout);
  if (!inventory && result.evidencePath) {
    try {
      evidenceDocument = JSON.parse(await readFile(result.evidencePath, "utf8"));
      inventory = parseHookInventoryOutput(evidenceDocument.stdout);
    } catch {
      // A missing or malformed evidence file is handled as a failed inventory below.
    }
  }
  if (!inventory && result.stdoutPath) {
    try {
      inventory = parseHookInventoryOutput(await readFile(result.stdoutPath, "utf8"));
    } catch {
      // The command result remains failed when no parseable inventory is available.
    }
  }

  const commandExitCode = Number.isInteger(result.exitCode) ? result.exitCode : 1;
  const isNotApplicable = inventory?.status === "not-applicable" && commandExitCode === 0;
  const classified = {
    ...result,
    status: isNotApplicable ? "not-applicable" : "failed",
    exitCode: isNotApplicable ? 0 : commandExitCode === 0 ? 1 : commandExitCode,
    skipReason: isNotApplicable
      ? "Source/dependency inventory found no Platform-owned Hook runtime call point"
      : inventory?.status === "found-runtime-call-point"
        ? "Hook runtime call point found; required boundary inventory is not-applicable"
        : "Hook inventory evidence is missing or malformed",
  };

  if (classified.evidencePath && (evidenceDocument || inventory)) {
    await writeManifestAtomic(classified.evidencePath, {
      ...(evidenceDocument || {}),
      ...classified,
      inventory: inventory || null,
    });
  }
  return classified;
}

export async function runRequiredAcceptance({
  manifest,
  evidenceDir,
  platformRoot = defaultPlatformRoot,
  inventory,
  runCommand = runAcceptanceCommand,
  validateInventory = true,
} = {}) {
  if (!manifest || !evidenceDir) {
    throw new TypeError("manifest and evidenceDir are required");
  }
  const resolvedInventory =
    inventory ?? createRequiredInventory({ platformRoot, evidenceDir, runId: manifest.runId });
  if (validateInventory) validateRequiredInventory(resolvedInventory, { platformRoot });

  const manifestPath = path.join(evidenceDir, "acceptance-manifest.json");
  await writeManifestAtomic(manifestPath, manifest);

  const results = [];
  for (const rawSpec of resolvedInventory) {
    const spec = normalizeSuiteSpec(rawSpec, { evidenceDir, platformRoot });
    try {
      const result = await runCommand(spec);
      const classified = await classifyHookInventoryResult(spec, result);
      results.push(recordSuiteResult(manifest, classified));
    } catch (error) {
      results.push(await recordRunnerFailure(manifest, spec, error));
    }
    await writeManifestAtomic(manifestPath, manifest);
  }

  return { manifest, results };
}
