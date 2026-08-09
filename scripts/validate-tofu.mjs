import { mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tofuBin = process.env.TOFU_BIN?.trim() || "tofu";
const runtimeRoot = join(rootDir, ".runtime", "tofu");
const pluginCacheDir = join(runtimeRoot, "plugin-cache");
const environments = ["staging", "production"];

mkdirSync(pluginCacheDir, { recursive: true });

function runTofu(args, options = {}) {
  const cwd = options.cwd ?? rootDir;
  const result = spawnSync(tofuBin, args, {
    cwd,
    env: {
      ...process.env,
      CHECKPOINT_DISABLE: "1",
      TF_IN_AUTOMATION: "1",
      TF_PLUGIN_CACHE_DIR: pluginCacheDir,
      ...options.env,
    },
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`Unable to execute OpenTofu at ${tofuBin}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `OpenTofu command failed with exit code ${result.status}: tofu ${args.join(" ")} (cwd: ${relative(rootDir, cwd) || "."})`,
    );
  }
}

runTofu(["fmt", "-check", "-recursive", "infra/tofu"]);

for (const environment of environments) {
  const environmentDir = join(rootDir, "infra", "tofu", "environments", environment);
  const dataDir = join(runtimeRoot, environment, ".terraform");
  mkdirSync(dataDir, { recursive: true });

  const env = { TF_DATA_DIR: dataDir };
  runTofu(["init", "-backend=false", "-input=false", "-no-color", "-lockfile=readonly"], {
    cwd: environmentDir,
    env,
  });
  runTofu(["validate", "-no-color"], { cwd: environmentDir, env });
}

console.log(`OpenTofu format and provider-schema validation passed for: ${environments.join(", ")}.`);
