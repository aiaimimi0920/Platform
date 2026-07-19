import path from "node:path";
import { fileURLToPath } from "node:url";

import { recordSuiteResult, writeManifestAtomic } from "./manifest.mjs";
import { inspectHookInventory } from "./hook-inventory.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultPlatformRoot = path.resolve(moduleDir, "../..");

export const LIVE_SUITE_IDS = [
  "live-linuxdo-oauth",
  "live-gateway",
  "live-loom",
  "live-tea",
  "live-hook",
];

const LIVE_ENVIRONMENT_REQUIREMENTS = {
  "live-linuxdo-oauth": ["OAUTH_CLIENT_ID", "OAUTH_CLIENT_SECRET"],
  "live-gateway": ["AI_GATEWAY_LIVE_URL", "AI_GATEWAY_LIVE_TOKEN"],
  "live-loom": ["LOOM_LIVE_URL", "LOOM_LIVE_TOKEN"],
  "live-tea": ["TEA_LIVE_URL", "TEA_LIVE_TOKEN"],
};

async function recordClassification(manifest, evidenceDir, result) {
  const evidencePath = path.join(evidenceDir, "suites", `${result.id}.json`);
  const normalized = {
    ...result,
    layer: "conditionalLive",
    command: result.command || "environment-contract",
    args: result.args || [],
    exitCode: result.exitCode ?? null,
    evidencePath,
    startedAt: result.startedAt || new Date().toISOString(),
    finishedAt: result.finishedAt || new Date().toISOString(),
  };
  await writeManifestAtomic(evidencePath, normalized);
  return recordSuiteResult(manifest, normalized);
}

export async function runLiveAcceptance({
  manifest,
  evidenceDir,
  env = process.env,
  platformRoot = defaultPlatformRoot,
} = {}) {
  if (!manifest || !evidenceDir) {
    throw new TypeError("manifest and evidenceDir are required");
  }

  const results = [];
  for (const id of LIVE_SUITE_IDS) {
    if (id === "live-hook") {
      const inventory = await inspectHookInventory({ platformRoot });
      const notApplicable = inventory.status === "not-applicable";
      results.push(
        await recordClassification(manifest, evidenceDir, {
          id,
          status: notApplicable ? "not-applicable" : "not-run",
          command: "source-dependency-inventory",
          exitCode: 0,
          skipReason: notApplicable
            ? "No Platform-owned Hook runtime call point is present in the source and dependency inventory"
            : "Platform-owned Hook references exist, but the conditional-live probe is not implemented",
          inventory,
        }),
      );
      await writeManifestAtomic(path.join(evidenceDir, "acceptance-manifest.json"), manifest);
      continue;
    }

    const requirements = LIVE_ENVIRONMENT_REQUIREMENTS[id];
    const configured = requirements.filter(
      (name) => typeof env[name] === "string" && env[name].trim().length > 0,
    );
    const missing = requirements.filter((name) => !configured.includes(name));
    const checkedAt = new Date().toISOString();
    results.push(
      await recordClassification(manifest, evidenceDir, {
        id,
        status: missing.length > 0 ? "external-blocked" : "not-run",
        command: "environment-preflight",
        exitCode: 0,
        skipReason:
          missing.length > 0
            ? `Live preflight blocked by missing environment: ${missing.join(", ")}`
            : "Live probe implementation is pending; configured environment alone is not blocker evidence",
        preflight: {
          executed: true,
          checkedAt,
          requiredEnvironment: [...requirements],
          configuredEnvironment: configured,
          missingEnvironment: missing,
        },
      }),
    );
    await writeManifestAtomic(path.join(evidenceDir, "acceptance-manifest.json"), manifest);
  }

  return { manifest, results };
}
