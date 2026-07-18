import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("required acceptance mode fails instead of silently skipping a gated suite", () => {
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/run-gated-tests.mjs"), "MISSING_FLAG", "", "--", process.execPath, "-e", "process.exit(0)"],
    {
      cwd: process.cwd(),
      env: { ...process.env, PLATFORM_ACCEPTANCE_MODE: "required" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}\n${result.stderr}`, /skip/i);
});
