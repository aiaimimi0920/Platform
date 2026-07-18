#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const separatorIndex = process.argv.indexOf("--");

if (process.argv.length < 5 || separatorIndex < 0) {
  console.error(
    "Usage: node scripts/run-gated-tests.mjs <FLAG_ENV> <REQUIRED_ENV_CSV> -- <command> [args...]",
  );
  process.exit(2);
}

const [, , flagEnv, requiredEnvCsv] = process.argv;
const command = process.argv[separatorIndex + 1];
const commandArgs = process.argv.slice(separatorIndex + 2);

if (!command) {
  console.error("No command provided after --.");
  process.exit(2);
}

if (process.env[flagEnv] !== "1") {
  if (process.env.PLATFORM_ACCEPTANCE_MODE === "required") {
    console.error(
      `Skipping gated tests is forbidden in required acceptance mode; set ${flagEnv}=1.`,
    );
    process.exit(1);
  }
  console.log(
    `Skipping gated tests: set ${flagEnv}=1 to run this integration layer.`,
  );
  process.exit(0);
}

const missingEnv = requiredEnvCsv
  .split(",")
  .map((name) => name.trim())
  .filter((name) => name.length > 0 && !process.env[name]);

if (missingEnv.length > 0) {
  console.error(
    `Cannot run gated tests with ${flagEnv}=1; missing required env: ${missingEnv.join(", ")}`,
  );
  process.exit(1);
}

const result = spawnSync(command, commandArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
