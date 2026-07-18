import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DEFAULT_COMMAND_TIMEOUT_MS, runAcceptanceCommand } from "../run-command.mjs";

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function assertPortAvailable(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
}

test("runAcceptanceCommand captures a passing command and redacts output", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-"));
  const evidencePath = path.join(evidenceDir, "command.json");
  const result = await runAcceptanceCommand({
    id: "command-pass",
    layer: "required",
    command: process.execPath,
    args: ["-e", "console.log('token=hidden-value')"],
    cwd: process.cwd(),
    evidencePath,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.exitCode, 0);
  assert.equal(Number.isFinite(result.durationMs), true);
  assert.equal(result.durationMs >= 0, true);
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  assert.equal(evidence.id, "command-pass");
  assert.equal(evidence.durationMs, result.durationMs);
  assert.equal(evidence.stdout.includes("hidden-value"), false);
  assert.equal(evidence.stdoutPath.endsWith("command.json.stdout.log"), true);
  assert.equal(evidence.stderrPath.endsWith("command.json.stderr.log"), true);
  assert.equal((await readFile(evidence.stdoutPath, "utf8")).includes("hidden-value"), false);
});

test("runAcceptanceCommand redacts cookie fields and raw bearer tokens from persisted evidence", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-redaction-"));
  const evidencePath = path.join(evidenceDir, "command.json");
  const result = await runAcceptanceCommand({
    id: "command-redaction",
    layer: "required",
    command: process.execPath,
    args: [
      "-e",
      "console.log('request cookie = sid=persisted-cookie-sid; csrf=persisted-cookie-csrf; theme=persisted-cookie-theme'); console.log('Authorization: Basic persisted-basic-secret'); console.error('Bearer persisted-bearer-token'); console.error('postgres://persisted-db-user:persisted-url-secret@db.internal/platform password=persisted-password-secret credential=persisted-credential-secret'); console.error('credentials={\\\"username\\\":\\\"public\\\",\\\"secretAccessKey\\\":\\\"persisted-credential-object-secret\\\"}')",
    ],
    cwd: process.cwd(),
    evidencePath,
  });

  const persisted = [
    await readFile(evidencePath, "utf8"),
    await readFile(result.stdoutPath, "utf8"),
    await readFile(result.stderrPath, "utf8"),
  ].join("\n");
  for (const canary of [
    "persisted-cookie-sid",
    "persisted-cookie-csrf",
    "persisted-cookie-theme",
    "persisted-bearer-token",
    "persisted-basic-secret",
    "persisted-db-user",
    "persisted-url-secret",
    "persisted-password-secret",
    "persisted-credential-secret",
    "persisted-credential-object-secret",
  ]) {
    assert.equal(persisted.includes(canary), false, `${canary} leaked into persisted evidence`);
  }
});

test("runAcceptanceCommand reports a nonzero command as failed", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-"));
  const result = await runAcceptanceCommand({
    id: "command-fail",
    layer: "externalBoundary",
    command: process.execPath,
    args: ["-e", "process.exit(7)"],
    cwd: process.cwd(),
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 7);
});

test("runAcceptanceCommand classifies gated skip output as skipped", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-skip-"));
  const result = await runAcceptanceCommand({
    id: "command-skip",
    layer: "required",
    command: process.execPath,
    args: ["-e", "console.log('Skipping gated tests: set FLAG=1 to run this integration layer.')"],
    cwd: process.cwd(),
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.exitCode, 0);
  assert.match(result.skipReason, /Skipping gated tests/i);
});

test("runAcceptanceCommand classifies native Node TAP and Vitest skips", async (t) => {
  for (const fixture of [
    {
      name: "Node TAP directive",
      output: "ok 1 - optional integration # SKIP fixture unavailable",
    },
    {
      name: "Node TAP summary",
      output: "# tests 4\n# pass 2\n# skipped 2",
    },
    {
      name: "Vitest summary",
      output: "\u001b[33m Test Files  1 skipped (1)\u001b[39m\n Tests  2 skipped (2)",
    },
  ]) {
    await t.test(fixture.name, async () => {
      const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-native-skip-"));
      const result = await runAcceptanceCommand({
        id: `native-skip-${fixture.name}`,
        layer: "required",
        command: process.execPath,
        args: ["-e", `console.log(${JSON.stringify(fixture.output)})`],
        cwd: process.cwd(),
        evidencePath: path.join(evidenceDir, "command.json"),
      });

      assert.equal(result.status, "skipped");
      assert.equal(result.exitCode, 0);
      assert.equal(result.skipReason.length > 0, true);
    });
  }
});

test("runAcceptanceCommand classifies real Node and Vitest runner skips", async (t) => {
  for (const fixture of [
    {
      name: "Node test runner",
      args: ["--test", path.resolve("scripts/acceptance/tests/fixtures/native-node-skip.test.mjs")],
    },
    {
      name: "Vitest runner",
      args: [
        path.resolve("node_modules/vitest/vitest.mjs"),
        "run",
        path.resolve("scripts/acceptance/tests/fixtures/native-vitest-skip.test.mjs"),
        "--reporter=default",
        "--color=false",
      ],
    },
  ]) {
    await t.test(fixture.name, async () => {
      const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-real-skip-"));
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      const result = await runAcceptanceCommand({
        id: `real-skip-${fixture.name}`,
        layer: "required",
        command: process.execPath,
        args: fixture.args,
        cwd: process.cwd(),
        env,
        evidencePath: path.join(evidenceDir, "command.json"),
      });

      assert.equal(result.exitCode, 0);
      assert.equal(
        result.status,
        "skipped",
        await readFile(result.stdoutPath, "utf8"),
      );
      assert.equal(result.skipReason.length > 0, true);
    });
  }
});

test("runAcceptanceCommand does not classify zero skipped tests as skipped", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-zero-skip-"));
  const result = await runAcceptanceCommand({
    id: "zero-skip",
    layer: "required",
    command: process.execPath,
    args: [
      "-e",
      "console.log('ordinary log mentioning # SKIP is not a TAP directive\\n# tests 4\\n# pass 4\\n# skipped 0')",
    ],
    cwd: process.cwd(),
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "passed");
  assert.equal(result.skipReason, null);
});

test("runAcceptanceCommand detects a late native skip after bounded evidence is truncated", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-late-skip-"));
  const result = await runAcceptanceCommand({
    id: "late-native-skip",
    layer: "required",
    command: process.execPath,
    args: [
      "-e",
      "process.stdout.write('x'.repeat(4096) + '\\nok 1 - optional integration # SKIP late fixture\\n# skipped 1\\n')",
    ],
    cwd: process.cwd(),
    maxOutputBytes: 64,
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.outputTruncated, true);
  assert.equal(result.status, "skipped");
  assert.match(result.skipReason, /SKIP|skipped 1/i);
});

test("runAcceptanceCommand retains a middle skip followed by a large trailing log", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-middle-skip-"));
  const result = await runAcceptanceCommand({
    id: "middle-native-skip",
    layer: "required",
    command: process.execPath,
    args: [
      "-e",
      "process.stdout.write('x'.repeat(4096) + '\\nok 1 - optional integration # SKIP middle fixture\\n' + 'y'.repeat(20000))",
    ],
    cwd: process.cwd(),
    maxOutputBytes: 64,
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.outputTruncated, true);
  assert.equal(result.status, "skipped");
  assert.match(result.skipReason, /SKIP middle fixture/i);
});

test("runAcceptanceCommand keeps required-mode skip enforcement as failed", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-skip-failed-"));
  const result = await runAcceptanceCommand({
    id: "command-skip-failed",
    layer: "required",
    command: process.execPath,
    args: ["-e", "console.log('Skipping gated tests is forbidden in required acceptance mode'); process.exit(1)"],
    cwd: process.cwd(),
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
});

test("runAcceptanceCommand enforces a finite timeout and terminates the descendant process tree", async () => {
  assert.equal(Number.isFinite(DEFAULT_COMMAND_TIMEOUT_MS), true);
  assert.equal(DEFAULT_COMMAND_TIMEOUT_MS > 0, true);

  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-timeout-"));
  for (const timeoutMs of [0, -1, 1.5, Number.POSITIVE_INFINITY, 2_147_483_648]) {
    await assert.rejects(
      runAcceptanceCommand({
        id: "invalid-timeout",
        layer: "required",
        command: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: process.cwd(),
        timeoutMs,
        evidencePath: path.join(evidenceDir, "invalid-timeout.json"),
      }),
      /timeout/i,
    );
  }

  const port = await getAvailablePort();
  const grandchildScript = [
    "const { createServer } = require('node:net');",
    `const server = createServer().listen(${port}, '127.0.0.1', () => console.log('GRANDCHILD_READY'));`,
    "setTimeout(() => process.exit(0), 5000);",
  ].join("");
  const parentScript = [
    "const { spawn } = require('node:child_process');",
    `const child = spawn(process.execPath, ['-e', ${JSON.stringify(grandchildScript)}], { stdio: ['ignore', 'pipe', 'inherit'] });`,
    "child.stdout.pipe(process.stdout);",
    "setTimeout(() => process.exit(0), 5000);",
  ].join("");
  const startedAt = Date.now();
  const result = await runAcceptanceCommand({
    id: "command-timeout",
    layer: "required",
    command: process.execPath,
    args: ["-e", parentScript],
    cwd: process.cwd(),
    timeoutMs: 1500,
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 124);
  assert.equal(result.timedOut, true);
  assert.equal(Date.now() - startedAt < 5000, true);
  assert.match(await readFile(result.stdoutPath, "utf8"), /GRANDCHILD_READY/);
  assert.equal(JSON.parse(await readFile(result.evidencePath, "utf8")).timedOut, true);
  await assertPortAvailable(port);
});

test("runAcceptanceCommand bounds captured output", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-limit-"));
  const result = await runAcceptanceCommand({
    id: "command-limit",
    layer: "required",
    command: process.execPath,
    args: ["-e", "process.stdout.write('x'.repeat(200))"],
    cwd: process.cwd(),
    maxOutputBytes: 32,
    evidencePath: path.join(evidenceDir, "command.json"),
  });

  assert.equal(result.status, "passed");
  assert.equal(result.outputTruncated, true);
  const evidence = JSON.parse(await readFile(path.join(evidenceDir, "command.json"), "utf8"));
  assert.equal((await readFile(evidence.stdoutPath, "utf8")).length <= 32, true);
});

test("runAcceptanceCommand redacts URL userinfo when truncation cuts off the delimiter", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-truncated-secret-"));
  const evidencePath = path.join(evidenceDir, "command.json");
  const result = await runAcceptanceCommand({
    id: "truncated-userinfo",
    layer: "required",
    command: process.execPath,
    args: [
      "-e",
      "process.stdout.write('x'.repeat(40) + 'postgres://user:leak1234-more-secret@db.internal/platform')",
    ],
    cwd: process.cwd(),
    maxOutputBytes: 64,
    evidencePath,
  });

  const persisted = `${await readFile(result.stdoutPath, "utf8")}\n${await readFile(evidencePath, "utf8")}`;
  assert.equal(result.outputTruncated, true);
  assert.equal(persisted.includes("leak1234"), false);
  assert.equal(Buffer.byteLength(await readFile(result.stdoutPath, "utf8"), "utf8") <= 64, true);
});

test("runAcceptanceCommand rejects invalid output bounds", async () => {
  const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "platform-command-invalid-limit-"));
  for (const maxOutputBytes of [0, -1, 1.5, Number.POSITIVE_INFINITY, 16 * 1024 * 1024 + 1]) {
    await assert.rejects(
      runAcceptanceCommand({
        id: "invalid-output-limit",
        layer: "required",
        command: process.execPath,
        args: ["-e", "process.exit(0)"],
        cwd: process.cwd(),
        maxOutputBytes,
        evidencePath: path.join(evidenceDir, "command.json"),
      }),
      /maxOutputBytes|output/i,
    );
  }
});
