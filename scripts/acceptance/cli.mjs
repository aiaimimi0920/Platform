import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAcceptanceManifest,
  finalizeAcceptanceManifest,
  writeManifestAtomic,
} from "./manifest.mjs";

const acceptanceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.runtime/acceptance");

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
  if (!['ci', 'live'].includes(mode)) throw new Error(`Unknown acceptance mode: ${mode}`);
  return {
    mode,
    runId,
    evidenceDir: evidenceDir || path.join(acceptanceRoot, runId),
  };
}

export async function runAcceptanceCli(argv = process.argv.slice(2)) {
  const options = parseAcceptanceArgs(argv);
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
  const manifestPath = path.join(options.evidenceDir, "acceptance-manifest.json");
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
