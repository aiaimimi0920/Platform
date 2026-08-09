import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  cleanupAcceptanceProject,
  createAcceptanceEnvironment,
  runAcceptanceComposeCommand,
} from "./compose.mjs";
import { redactText, validateAcceptanceRunId } from "./manifest.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultPlatformRoot = path.resolve(moduleDir, "../..");

function childRunId(runId, stage) {
  const digest = createHash("sha256").update(`${runId}:${stage}`).digest("hex").slice(0, 16);
  return `platform-${stage}-${digest}`;
}

function sensitiveEnvironmentValues(environment) {
  return Object.entries(environment)
    .filter(([name, value]) =>
      /(?:PASSWORD|TOKEN|SECRET|API_KEY|DATABASE_URL|AUTHORIZATION|CREDENTIAL)/i.test(name)
      && typeof value === "string"
      && value.length > 0)
    .map(([, value]) => value);
}

function sanitizeDiagnosticResult(result, sensitiveValues) {
  return {
    exitCode: result?.exitCode ?? null,
    timedOut: result?.timedOut === true,
    durationMs: Number.isFinite(result?.durationMs) ? result.durationMs : null,
    stdout: result?.stdout ? redactText(result.stdout, sensitiveValues) : null,
    stderr: result?.stderr ? redactText(result.stderr, sensitiveValues) : null,
    error: result?.error ? redactText(result.error, sensitiveValues) : null,
  };
}

export async function readAcceptanceEnvironment(envFile) {
  const contents = await readFile(envFile, "utf8");
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("Invalid acceptance environment file");
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

export async function runComposeStage({
  stage,
  runId,
  evidenceDir,
  platformRoot = defaultPlatformRoot,
  createEnvironment = createAcceptanceEnvironment,
  executeCommand = runAcceptanceComposeCommand,
  cleanupProject = cleanupAcceptanceProject,
  readEnvironment = readAcceptanceEnvironment,
} = {}) {
  if (!['render', 'startup'].includes(stage)) throw new TypeError(`Unknown Compose stage: ${stage}`);
  const safeRunId = validateAcceptanceRunId(runId);
  if (typeof evidenceDir !== "string" || !evidenceDir.trim()) {
    throw new TypeError("evidenceDir is required");
  }

  const resolvedPlatformRoot = path.resolve(platformRoot);
  const resolvedEvidenceDir = path.resolve(evidenceDir);
  const stageEvidenceDir = path.join(resolvedEvidenceDir, "compose", stage);
  const composeFile = path.join(
    resolvedPlatformRoot,
    "deploy",
    "acceptance",
    "docker-compose.acceptance.yml",
  );
  let environment = null;
  let childEnvironment = null;
  let commandResult = null;
  let psResult = null;
  let browserResult = null;
  let postBrowserPsResult = null;
  let startupDiagnosticsPath = null;
  let cleanupResult = null;
  let primaryError = null;

  try {
    environment = await createEnvironment({
      runId: childRunId(safeRunId, stage),
      evidenceDir: stageEvidenceDir,
      platformRoot: resolvedPlatformRoot,
    });
    const environmentValues = await readEnvironment(environment.paths.envFile);
    childEnvironment = { ...process.env, ...environmentValues };
    const args = [
      "compose",
      ...(stage === "startup" ? ["--parallel", "2"] : []),
      "-p",
      environment.projectName,
      "--env-file",
      environment.paths.envFile,
      "-f",
      composeFile,
    ];
    if (stage === "render") {
      args.push("config", "--quiet");
    } else {
      args.push("up", "--build", "--detach", "--wait", "--wait-timeout", "900");
    }
    commandResult = await executeCommand({
      command: "docker",
      args,
      cwd: resolvedPlatformRoot,
      env: childEnvironment,
      timeoutMs: stage === "startup" ? 45 * 60 * 1000 : 2 * 60 * 1000,
    });

    if (stage === "startup") {
      await mkdir(stageEvidenceDir, { recursive: true });
      const composeArgs = [
        "compose",
        "-p",
        environment.projectName,
        "--env-file",
        environment.paths.envFile,
        "-f",
        composeFile,
      ];
      if (commandResult?.exitCode === 0) {
        psResult = await executeCommand({
          command: "docker",
          args: [...composeArgs, "ps", "--format", "json"],
          cwd: resolvedPlatformRoot,
          env: childEnvironment,
          timeoutMs: 2 * 60 * 1000,
        });
        if (psResult?.exitCode === 0) {
          const browserReportPath = path.join(stageEvidenceDir, "browser-results.json");
          const browserArtifactDir = path.join(stageEvidenceDir, "browser-artifacts");
          browserResult = await executeCommand({
            command: process.execPath,
            args: [
              path.join(resolvedPlatformRoot, "node_modules", "@playwright", "test", "cli.js"),
              "test",
              "--config",
              path.join(resolvedPlatformRoot, "playwright.config.ts"),
            ],
            cwd: resolvedPlatformRoot,
            env: {
              ...childEnvironment,
              PLATFORM_ACCEPTANCE_WEB_URL: `http://127.0.0.1:${environmentValues.WEB_HOST_PORT}`,
              PLATFORM_ACCEPTANCE_BROWSER_ARTIFACT_DIR: browserArtifactDir,
              PLAYWRIGHT_JSON_OUTPUT_FILE: browserReportPath,
            },
            timeoutMs: 20 * 60 * 1000,
          });
          postBrowserPsResult = await executeCommand({
            command: "docker",
            args: [...composeArgs, "ps", "--all", "--format", "json"],
            cwd: resolvedPlatformRoot,
            env: childEnvironment,
            timeoutMs: 2 * 60 * 1000,
          });
        }
      } else {
        const diagnosticPsResult = await executeCommand({
          command: "docker",
          args: [...composeArgs, "ps", "--all", "--format", "json"],
          cwd: resolvedPlatformRoot,
          env: childEnvironment,
          timeoutMs: 2 * 60 * 1000,
        });
        const diagnosticLogsResult = await executeCommand({
          command: "docker",
          args: [...composeArgs, "logs", "--no-color", "--timestamps", "--tail", "80"],
          cwd: resolvedPlatformRoot,
          env: childEnvironment,
          timeoutMs: 2 * 60 * 1000,
        });
        const sensitiveValues = sensitiveEnvironmentValues(environmentValues);
        startupDiagnosticsPath = path.join(stageEvidenceDir, "compose-startup-diagnostics.json");
        await writeFile(
          startupDiagnosticsPath,
          `${JSON.stringify(
            {
              schemaVersion: 1,
              runId: safeRunId,
              composeRunId: environment.runId,
              projectName: environment.projectName,
              recordedAt: new Date().toISOString(),
              up: sanitizeDiagnosticResult(commandResult, sensitiveValues),
              ps: sanitizeDiagnosticResult(diagnosticPsResult, sensitiveValues),
              logs: sanitizeDiagnosticResult(diagnosticLogsResult, sensitiveValues),
            },
            null,
            2,
          )}\n`,
          "utf8",
        );
      }
      await writeFile(
        path.join(stageEvidenceDir, "compose-startup.json"),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            runId: safeRunId,
            composeRunId: environment.runId,
            projectName: environment.projectName,
            recordedAt: new Date().toISOString(),
            upExitCode: commandResult.exitCode,
            psExitCode: psResult?.exitCode ?? null,
            browserExitCode: browserResult?.exitCode ?? null,
            postBrowserPsExitCode: postBrowserPsResult?.exitCode ?? null,
            startupDiagnosticsPath,
            ps: psResult?.stdout ?? null,
            postBrowserPs: postBrowserPsResult?.stdout ?? null,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    }
  } catch (error) {
    primaryError = error;
  } finally {
    if (environment) {
      try {
        cleanupResult = await cleanupProject({
          runId: environment.runId,
          evidenceDir: environment.paths.evidenceDir,
          projectName: environment.projectName,
          platformRoot: resolvedPlatformRoot,
          executeCommand,
          commandTimeoutMs: 5 * 60 * 1000,
        });
      } catch (error) {
        if (!primaryError) primaryError = error;
      }
    }
  }

  if (primaryError) throw primaryError;
  const exitCode =
    commandResult?.exitCode === 0 &&
    (stage !== "startup" || (
      psResult?.exitCode === 0
      && browserResult?.exitCode === 0
      && postBrowserPsResult?.exitCode === 0
    ))
      ? 0
      : 1;
  return {
    stage,
    runId: safeRunId,
    composeRunId: environment.runId,
    projectName: environment.projectName,
    exitCode,
    commandResult,
    psResult,
    browserResult,
    postBrowserPsResult,
    startupDiagnosticsPath,
    cleanupResult,
  };
}

function parseArgs(argv) {
  const options = { stage: null, runId: null, evidenceDir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--stage") options.stage = argv[++index];
    else if (argument === "--run-id") options.runId = argv[++index];
    else if (argument === "--evidence-dir") options.evidenceDir = argv[++index];
    else throw new Error(`Unknown Compose acceptance argument: ${argument}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runComposeStage(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
