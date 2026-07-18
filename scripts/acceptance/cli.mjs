import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAcceptanceManifest,
  finalizeAcceptanceManifest,
  validateAcceptanceRunId,
  writeManifestAtomic,
} from "./manifest.mjs";

const acceptanceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.runtime/acceptance");
const acceptanceClaimRoot = path.join(acceptanceRoot, ".claims");
const evidenceOwnerFileName = ".acceptance-owner.json";

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

export async function runAcceptanceCli(argv = process.argv.slice(2)) {
  const options = parseAcceptanceArgs(argv);
  const manifestPath = path.join(options.evidenceDir, "acceptance-manifest.json");
  await claimAcceptanceRun({ ...options, manifestPath });
  const manifest = createAcceptanceManifest({
    runId: options.runId,
    evidenceDir: options.evidenceDir,
    git: {
      commit: process.env.PLATFORM_ACCEPTANCE_GIT_COMMIT || null,
      dirty: process.env.PLATFORM_ACCEPTANCE_GIT_DIRTY === "true",
    },
  });
  const finalized = finalizeAcceptanceManifest(manifest, {
    requiredLayers: options.mode === "ci" ? ["required", "externalBoundary"] : ["conditionalLive"],
  });
  await writeManifestAtomic(manifestPath, finalized.manifest);
  await writeManifestAtomic(path.join(acceptanceRoot, "latest.json"), {
    runId: options.runId,
    mode: options.mode,
    manifestPath,
    status: finalized.manifest.status,
  });
  return { ...finalized, manifestPath, options };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runAcceptanceCli();
    console.log(JSON.stringify({ manifestPath: result.manifestPath, status: result.manifest.status }));
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
