import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

const executorRoot = path.resolve(__dirname, "..");
const cliEntry = path.resolve(__dirname, "cli.ts");

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cliEntry, ...args], {
    cwd: executorRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CORE_INTERNAL_URL: "http://127.0.0.1:1",
      INTERNAL_API_TOKEN: "test-internal-token",
    },
  });
}

describe("executor CLI", () => {
  it("fails fast when no task key is provided and prints the supported surface", () => {
    const result = runCli([]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing executor task key\. Supported tasks:/);
    assert.match(result.stderr, /platform-executor/);
    assert.match(result.stderr, /fulfillment-anomalies-escalate/);
  });

  it("rejects unsupported task keys before attempting a request", () => {
    const result = runCli(["discount-code-history-archive"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsupported executor task "discount-code-history-archive"/);
    assert.match(result.stderr, /Supported tasks:/);
  });
});
