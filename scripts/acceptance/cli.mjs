import { spawnSync } from "node:child_process";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAcceptanceManifest,
  finalizeAcceptanceManifest,
  redactText,
  validateAcceptanceRunId,
  writeManifestAtomic,
} from "./manifest.mjs";
import { runRequiredAcceptance } from "./run-required.mjs";
import { runLiveAcceptance } from "./run-live.mjs";

const defaultPlatformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const acceptanceRoot = path.join(defaultPlatformRoot, ".runtime", "acceptance");
const acceptanceClaimRoot = path.join(acceptanceRoot, ".claims");
const evidenceOwnerFileName = ".acceptance-owner.json";

function probeGitValue(platformRoot, args) {
  try {
    const result = spawnSync("git", ["-C", platformRoot, ...args], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error || result.status !== 0) return null;
    return result.stdout.trim();
  } catch {
    return null;
  }
}

export function resolveAcceptanceGitMetadata({
  env = process.env,
  platformRoot = defaultPlatformRoot,
} = {}) {
  const commitOverride = typeof env.PLATFORM_ACCEPTANCE_GIT_COMMIT === "string"
    ? env.PLATFORM_ACCEPTANCE_GIT_COMMIT.trim()
    : "";
  const dirtyOverride = typeof env.PLATFORM_ACCEPTANCE_GIT_DIRTY === "string"
    ? env.PLATFORM_ACCEPTANCE_GIT_DIRTY.trim().toLowerCase()
    : null;
  const probedCommit = commitOverride || probeGitValue(platformRoot, ["rev-parse", "HEAD"]);
  const probedDirty = probeGitValue(platformRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=normal",
    "--",
    ".",
  ]);
  const detectedDirty = probedDirty === null ? null : probedDirty.length > 0;
  const dirty =
    dirtyOverride === "true"
      ? true
      : dirtyOverride === "false"
        ? false
        : detectedDirty;
  return {
    commit: probedCommit || null,
    dirty,
  };
}

function isInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function nextRunId() {
  const suffix = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2, 10)}`;
  return `platform-${suffix}`;
}

export function parseAcceptanceArgs(argv = process.argv.slice(2)) {
  let mode = "ci";
  let runId = process.env.PLATFORM_ACCEPTANCE_RUN_ID || nextRunId();
  let evidenceDir = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--mode") mode = argv[++index];
    else if (argument === "--run-id") runId = argv[++index];
    else if (argument === "--evidence-dir") evidenceDir = path.resolve(argv[++index]);
    else throw new Error(`Unknown acceptance argument: ${argument}`);
  }
  if (!["ci", "live"].includes(mode)) throw new Error(`Unknown acceptance mode: ${mode}`);
  return {
    mode,
    runId: validateAcceptanceRunId(runId),
    evidenceDir: evidenceDir || path.join(acceptanceRoot, runId),
  };
}

async function manifestExists(manifestPath) {
  let manifest;
  try {
    manifest = await open(manifestPath, "r");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
  try {
    return true;
  } finally {
    await manifest.close();
  }
}

async function writeExclusiveClaim(claimPath, payload, duplicateMessage) {
  let claim;
  try {
    claim = await open(claimPath, "wx");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      throw new Error(duplicateMessage);
    }
    throw error;
  }
  try {
    await claim.writeFile(`${JSON.stringify(payload)}\n`, "utf8");
  } catch (error) {
    await claim.close().catch(() => {});
    await rm(claimPath, { force: true }).catch(() => {});
    throw error;
  }
  await claim.close();
}

async function claimAcceptanceRun({ evidenceDir, manifestPath, runId }) {
  await Promise.all([
    mkdir(acceptanceClaimRoot, { recursive: true }),
    mkdir(evidenceDir, { recursive: true }),
  ]);
  if (await manifestExists(manifestPath)) {
    throw new Error(`Acceptance run manifest already exists: ${manifestPath}`);
  }

  const claimPayload = { evidenceDir, manifestPath, runId };
  const claimPath = path.join(acceptanceClaimRoot, `${runId}.json`);
  await writeExclusiveClaim(
    claimPath,
    claimPayload,
    `Acceptance run is already claimed: ${runId}`,
  );

  const ownerPath = path.join(evidenceDir, evidenceOwnerFileName);
  try {
    await writeExclusiveClaim(
      ownerPath,
      claimPayload,
      `Acceptance evidence directory is already claimed: ${evidenceDir}`,
    );
  } catch (error) {
    await rm(claimPath, { force: true }).catch(() => {});
    throw error;
  }

  if (await manifestExists(manifestPath)) {
    await Promise.all([
      rm(ownerPath, { force: true }).catch(() => {}),
      rm(claimPath, { force: true }).catch(() => {}),
    ]);
    throw new Error(`Acceptance run manifest already exists: ${manifestPath}`);
  }
}

export async function runAcceptanceCli(
  argv = process.argv.slice(2),
  {
    runRequired = runRequiredAcceptance,
    runLive = runLiveAcceptance,
    execute = true,
  } = {},
) {
  const options = parseAcceptanceArgs(argv);
  const manifestPath = path.join(options.evidenceDir, "acceptance-manifest.json");
  await claimAcceptanceRun({ ...options, manifestPath });
  const platformRoot = defaultPlatformRoot;
  const manifest = createAcceptanceManifest({
    runId: options.runId,
    evidenceDir: options.evidenceDir,
    git: resolveAcceptanceGitMetadata({ platformRoot }),
  });
  await writeManifestAtomic(manifestPath, manifest);
  if (execute) {
    try {
      if (options.mode === "ci") {
        await runRequired({
          manifest,
          evidenceDir: options.evidenceDir,
          platformRoot,
        });
      } else {
        await runLive({
          manifest,
          evidenceDir: options.evidenceDir,
          platformRoot,
        });
      }
    } catch (error) {
      const finalized = finalizeAcceptanceManifest(manifest, {
        requiredLayers: options.mode === "ci" ? ["required", "externalBoundary"] : ["conditionalLive"],
      });
      const message = redactText(error instanceof Error ? error.message : String(error));
      finalized.manifest.failureReasons.push(
        `${options.mode} acceptance orchestrator failed: ${message}`,
      );
      finalized.manifest.status = "failed";
      await writeManifestAtomic(manifestPath, finalized.manifest);
      if (isInside(acceptanceRoot, options.evidenceDir)) {
        await writeManifestAtomic(path.join(acceptanceRoot, "latest.json"), {
          runId: options.runId,
          mode: options.mode,
          manifestPath,
          status: finalized.manifest.status,
        });
      }
      throw error;
    }
  }
  const finalized = finalizeAcceptanceManifest(manifest, {
    requiredLayers: options.mode === "ci" ? ["required", "externalBoundary"] : ["conditionalLive"],
  });
  await writeManifestAtomic(manifestPath, finalized.manifest);
  if (isInside(acceptanceRoot, options.evidenceDir)) {
    await writeManifestAtomic(path.join(acceptanceRoot, "latest.json"), {
      runId: options.runId,
      mode: options.mode,
      manifestPath,
      status: finalized.manifest.status,
    });
  }
  return { ...finalized, manifestPath, options };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runAcceptanceCli();
    console.log(JSON.stringify({ manifestPath: result.manifestPath, status: result.manifest.status }));
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(redactText(error instanceof Error ? error.message : String(error)));
    process.exitCode = 2;
  }
}
