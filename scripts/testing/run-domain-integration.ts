import path from "node:path";
import { spawn } from "node:child_process";

import { createCoreIntegrationContext } from "../../core/src/testing/integration-postgres";

type ParsedArgs = {
  extraMigrations: string[];
  testFile: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const extraMigrations: string[] = [];
  let testFile: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--extra-migration") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--extra-migration requires a file path");
      }
      extraMigrations.push(path.resolve(process.cwd(), value));
      index += 1;
      continue;
    }

    if (token === "--test-file") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--test-file requires a file path");
      }
      testFile = value;
      index += 1;
      continue;
    }

    if (!testFile) {
      testFile = token;
      continue;
    }

    throw new Error(`Unexpected argument: ${token}`);
  }

  if (!testFile) {
    throw new Error("A test file is required");
  }

  return {
    extraMigrations,
    testFile,
  };
}

async function runTestFile(testFile: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--test", "--import", "tsx", testFile],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) {
        reject(new Error(`Integration test process exited via signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const { extraMigrations, testFile } = parseArgs(process.argv.slice(2));
  const context = await createCoreIntegrationContext(path.basename(testFile, path.extname(testFile)), {
    extraMigrationFiles: extraMigrations,
  });
  const restoreEnvironment = context.setProcessEnv();

  let exitCode = 1;
  try {
    exitCode = await runTestFile(testFile);
  } finally {
    restoreEnvironment();
    await context.stop();
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
