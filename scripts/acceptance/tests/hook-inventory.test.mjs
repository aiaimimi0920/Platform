import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectHookInventory } from "../hook-inventory.mjs";

test("Hook inventory finds references in root package and deploy/config files", async () => {
  const platformRoot = await mkdtemp(path.join(os.tmpdir(), "platform-hook-inventory-fixture-"));
  await mkdir(path.join(platformRoot, "deploy"), { recursive: true });
  await writeFile(
    path.join(platformRoot, "package.json"),
    JSON.stringify({ dependencies: { "@neuro/hook-client": "1.0.0" } }),
    "utf8",
  );
  await writeFile(
    path.join(platformRoot, "deploy", "docker-compose.yml"),
    "services:\n  platform:\n    environment:\n      HOOK_BASE_URL: https://hook.example.test\n",
    "utf8",
  );

  const result = await inspectHookInventory({ platformRoot });
  assert.equal(result.status, "found-runtime-call-point");
  assert.equal(result.matches.some((match) => match.file === "package.json"), true);
  assert.equal(result.matches.some((match) => match.file === path.join("deploy", "docker-compose.yml")), true);
});

test("Hook inventory scans runtime scripts, Dockerfiles, and infrastructure definitions", async () => {
  const platformRoot = await mkdtemp(path.join(os.tmpdir(), "platform-hook-runtime-fixture-"));
  await mkdir(path.join(platformRoot, "ops"), { recursive: true });
  await mkdir(path.join(platformRoot, "bin"), { recursive: true });
  await mkdir(path.join(platformRoot, "infra"), { recursive: true });
  await writeFile(
    path.join(platformRoot, "ops", "configure-hook.ps1"),
    "$env:HOOK_BASE_URL = 'https://hook.example.test'\n",
    "utf8",
  );
  await writeFile(
    path.join(platformRoot, "bin", "start-hook.sh"),
    "curl \"${HOOK_URL}/health\"\n",
    "utf8",
  );
  await writeFile(
    path.join(platformRoot, "Dockerfile"),
    "ENV HOOK_URL=http://hook:8080\n",
    "utf8",
  );
  await writeFile(
    path.join(platformRoot, "infra", "hook.tf"),
    "variable \"hook_base_url\" { default = \"https://hook.example.test\" }\n",
    "utf8",
  );

  const result = await inspectHookInventory({ platformRoot });
  assert.equal(result.status, "found-runtime-call-point");
  for (const file of [
    path.join("ops", "configure-hook.ps1"),
    path.join("bin", "start-hook.sh"),
    "Dockerfile",
    path.join("infra", "hook.tf"),
  ]) {
    assert.equal(result.matches.some((match) => match.file === file), true, `${file} was not scanned`);
  }
});

test("Hook inventory fails explicitly instead of treating binary runtime files as clean", async () => {
  const platformRoot = await mkdtemp(path.join(os.tmpdir(), "platform-hook-binary-fixture-"));
  await writeFile(path.join(platformRoot, "runtime.ps1"), Buffer.from([0x00, 0x01, 0x02, 0x03]));

  await assert.rejects(inspectHookInventory({ platformRoot }), /binary|UTF-8|inspect/i);
});

test("Hook inventory fails explicitly instead of treating invalid UTF-8 runtime files as clean", async () => {
  const platformRoot = await mkdtemp(path.join(os.tmpdir(), "platform-hook-invalid-utf8-fixture-"));
  await writeFile(path.join(platformRoot, "runtime.sh"), Buffer.from([0xc3, 0x28]));

  await assert.rejects(inspectHookInventory({ platformRoot }), /valid UTF-8|inspect/i);
});

test("current Platform Hook inventory is not-applicable with source evidence", async () => {
  const platformRoot = path.resolve(".");
  const result = await inspectHookInventory({ platformRoot });
  assert.equal(result.status, "not-applicable");
  assert.deepEqual(result.matches, []);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.target, "Hook");
});
