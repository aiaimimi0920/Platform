import { spawn } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { redactArgs, redactText } from "./manifest.mjs";

async function writeEvidenceAtomic(evidencePath, evidence) {
  const resolvedPath = path.resolve(evidencePath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  const temporaryPath = `${resolvedPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await rename(temporaryPath, resolvedPath);
}

async function writeTextAtomic(outputPath, contents) {
  const resolvedPath = path.resolve(outputPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  const temporaryPath = `${resolvedPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, contents, "utf8");
  await rename(temporaryPath, resolvedPath);
}

export async function runAcceptanceCommand({
  id,
  layer,
  command,
  args = [],
  cwd,
  env = process.env,
  maxOutputBytes = 64 * 1024,
  evidencePath,
}) {
  if (!id || !layer || !command || !evidencePath) {
    throw new TypeError("id, layer, command, and evidencePath are required");
  }

  const startedAt = new Date();
  let stdout = "";
  let stderr = "";
  let outputTruncated = false;
  const appendOutput = (current, chunk) => {
    const next = `${current}${chunk}`;
    const bytes = Buffer.byteLength(next, "utf8");
    if (bytes <= maxOutputBytes) return next;
    outputTruncated = true;
    return Buffer.from(next, "utf8").subarray(0, maxOutputBytes).toString("utf8");
  };
  const exitCode = await new Promise((resolve) => {
    let settled = false;
    const settle = (code) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout = appendOutput(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendOutput(stderr, chunk);
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      settle(1);
    });
    child.on("close", (code) => settle(code ?? 1));
  });
  const finishedAt = new Date();
  const combinedOutput = `${stdout}\n${stderr}`;
  const skipMatch = exitCode === 0 ? combinedOutput.match(/Skipping gated tests(?::[^\r\n]*)?/i) : null;
  const status = skipMatch ? "skipped" : exitCode === 0 ? "passed" : "failed";
  const resolvedEvidencePath = path.resolve(evidencePath);
  const stdoutPath = `${resolvedEvidencePath}.stdout.log`;
  const stderrPath = `${resolvedEvidencePath}.stderr.log`;
  const redactedStdout = redactText(stdout);
  const redactedStderr = redactText(stderr);
  const result = {
    id: String(id),
    layer,
    status,
    command: redactText(String(command)),
    args: redactArgs(args),
    exitCode,
    evidencePath: resolvedEvidencePath,
    stdoutPath,
    stderrPath,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    outputTruncated,
    skipReason: skipMatch ? redactText(skipMatch[0]) : null,
  };
  await Promise.all([
    writeTextAtomic(stdoutPath, redactedStdout),
    writeTextAtomic(stderrPath, redactedStderr),
  ]);
  await writeEvidenceAtomic(evidencePath, {
    ...result,
    stdout: redactedStdout,
    stderr: redactedStderr,
  });
  return result;
}
