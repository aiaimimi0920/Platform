import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { redactArgs, redactText } from "./manifest.mjs";

export const DEFAULT_COMMAND_TIMEOUT_MS = 15 * 60 * 1000;

const ANSI_ESCAPE_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const MAX_COMMAND_TIMEOUT_MS = 2_147_483_647;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const POST_KILL_CLOSE_TIMEOUT_MS = 3_000;
const REDACTION_LOOKAHEAD_BYTES = 8 * 1024;
const SKIP_PROBE_MAX_BYTES = 16 * 1024;
const TASKKILL_TIMEOUT_MS = 3_000;
const atomicWriteQueues = new Map();
const TRANSIENT_RENAME_ERROR_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);

async function renameWithRetry(sourcePath, destinationPath) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(sourcePath, destinationPath);
      return;
    } catch (error) {
      if (
        attempt >= 7 ||
        !error ||
        typeof error !== "object" ||
        !TRANSIENT_RENAME_ERROR_CODES.has(error.code)
      ) {
        throw error;
      }
      await wait(10 * 2 ** attempt);
    }
  }
}

function enqueueAtomicWrite(outputPath, operation) {
  const previous = atomicWriteQueues.get(outputPath) ?? Promise.resolve();
  const queued = previous.catch(() => {}).then(operation);
  atomicWriteQueues.set(outputPath, queued);
  return queued.finally(() => {
    if (atomicWriteQueues.get(outputPath) === queued) atomicWriteQueues.delete(outputPath);
  });
}

function detectSkipReason(output) {
  const normalized = output.replace(ANSI_ESCAPE_PATTERN, "");
  for (const pattern of [
    /Skipping gated tests(?::[^\r\n]*)?/i,
    /^\s*ok\s+\d+\b[^\r\n]*#\s*SKIP\b[^\r\n]*$/im,
    /^\s*#\s*skipped\s+[1-9]\d*\b.*$/im,
    /^\s*(?:Test Files|Tests)\s+[^\r\n]*\b[1-9]\d*\s+skipped\b[^\r\n]*\(\d+\)\s*$/im,
  ]) {
    const match = normalized.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function appendOutputTail(current, chunk, maxBytes = SKIP_PROBE_MAX_BYTES) {
  const next = Buffer.from(`${current}${chunk}`, "utf8");
  if (next.length <= maxBytes) return next.toString("utf8");
  return next.subarray(next.length - maxBytes).toString("utf8");
}

function redactAndBoundText(value, maxBytes) {
  const partialUserinfoRedacted = redactText(value).replace(
    /((?:\b[a-z][a-z0-9+.-]*:)?\/\/)[^/\s@]*:[^@\s/?#]*$/gi,
    "$1[REDACTED]",
  );
  const bytes = Buffer.from(partialUserinfoRedacted, "utf8");
  if (bytes.length <= maxBytes) {
    return { text: partialUserinfoRedacted, truncated: false };
  }
  let text = bytes.subarray(0, maxBytes).toString("utf8");
  while (Buffer.byteLength(text, "utf8") > maxBytes) text = text.slice(0, -1);
  return { text, truncated: true };
}

async function terminateWindowsProcessTree(child) {
  if (!child.pid) return;
  await new Promise((resolve) => {
    let settled = false;
    let timeoutHandle = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve();
    };
    const killer = spawn(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      { shell: false, windowsHide: true, stdio: "ignore" },
    );
    killer.once("error", () => {
      try {
        child.kill("SIGKILL");
      } catch {
        // The process may already have exited.
      }
      finish();
    });
    killer.once("close", finish);
    timeoutHandle = setTimeout(() => {
      try {
        killer.kill("SIGKILL");
      } catch {
        // The helper may already have exited.
      }
      try {
        child.kill("SIGKILL");
      } catch {
        // The target may already have exited.
      }
      finish();
    }, TASKKILL_TIMEOUT_MS);
  });
}

async function terminateUnixProcessTree(child) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      return;
    }
  }
  await wait(150);
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // The process tree exited after SIGTERM.
    }
  }
}

async function terminateProcessTree(child) {
  if (process.platform === "win32") {
    await terminateWindowsProcessTree(child);
  } else {
    await terminateUnixProcessTree(child);
  }
}

async function writeEvidenceAtomic(evidencePath, evidence) {
  const resolvedPath = path.resolve(evidencePath);
  return enqueueAtomicWrite(resolvedPath, async () => {
    await mkdir(path.dirname(resolvedPath), { recursive: true });
    const temporaryPath = `${resolvedPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
      await renameWithRetry(temporaryPath, resolvedPath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => {});
    }
  });
}

async function writeTextAtomic(outputPath, contents) {
  const resolvedPath = path.resolve(outputPath);
  return enqueueAtomicWrite(resolvedPath, async () => {
    await mkdir(path.dirname(resolvedPath), { recursive: true });
    const temporaryPath = `${resolvedPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, contents, "utf8");
      await renameWithRetry(temporaryPath, resolvedPath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => {});
    }
  });
}

export async function runAcceptanceCommand({
  id,
  layer,
  command,
  args = [],
  cwd,
  env = process.env,
  maxOutputBytes = 64 * 1024,
  timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  evidencePath,
}) {
  if (!id || !layer || !command || !evidencePath) {
    throw new TypeError("id, layer, command, and evidencePath are required");
  }
  if (
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes <= 0 ||
    maxOutputBytes > MAX_OUTPUT_BYTES
  ) {
    throw new TypeError(`maxOutputBytes must be a positive safe integer no greater than ${MAX_OUTPUT_BYTES}`);
  }
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > MAX_COMMAND_TIMEOUT_MS
  ) {
    throw new TypeError(`timeoutMs must be a positive safe integer no greater than ${MAX_COMMAND_TIMEOUT_MS}`);
  }

  const startedAt = new Date();
  let stdout = "";
  let stderr = "";
  let stdoutSkipTail = "";
  let stderrSkipTail = "";
  let detectedSkipReason = null;
  let outputTruncated = false;
  let timedOut = false;
  const appendOutput = (current, chunk) => {
    const next = `${current}${chunk}`;
    const bytes = Buffer.byteLength(next, "utf8");
    if (bytes <= maxOutputBytes) return next;
    outputTruncated = true;
    const captureLimit = maxOutputBytes + REDACTION_LOOKAHEAD_BYTES;
    if (bytes <= captureLimit) return next;
    return Buffer.from(next, "utf8").subarray(0, captureLimit).toString("utf8");
  };
  const exitCode = await new Promise((resolve) => {
    let settled = false;
    let timeoutHandle = null;
    const settle = (code) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve(code);
    };
    const child = spawn(command, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let resolveChildClosed;
    const childClosed = new Promise((resolveClosed) => {
      resolveChildClosed = resolveClosed;
    });
    child.stdout.on("data", (chunk) => {
      stdout = appendOutput(stdout, chunk);
      if (!detectedSkipReason) {
        detectedSkipReason = detectSkipReason(`${stdoutSkipTail}${chunk}`);
      }
      stdoutSkipTail = appendOutputTail(stdoutSkipTail, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendOutput(stderr, chunk);
      if (!detectedSkipReason) {
        detectedSkipReason = detectSkipReason(`${stderrSkipTail}${chunk}`);
      }
      stderrSkipTail = appendOutputTail(stderrSkipTail, chunk);
    });
    child.on("error", (error) => {
      if (timedOut) return;
      stderr = appendOutput(stderr, `${error.message}\n`);
      settle(1);
    });
    child.once("close", (code) => {
      resolveChildClosed();
      if (!timedOut) settle(code ?? 1);
    });
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      stderr = appendOutput(stderr, `Acceptance command timed out after ${timeoutMs}ms.\n`);
      void (async () => {
        try {
          await terminateProcessTree(child);
          await Promise.race([childClosed, wait(POST_KILL_CLOSE_TIMEOUT_MS)]);
        } catch (error) {
          stderr = appendOutput(
            stderr,
            `Process tree termination failed: ${error instanceof Error ? error.message : String(error)}\n`,
          );
        } finally {
          settle(124);
        }
      })();
    }, timeoutMs);
  });
  const finishedAt = new Date();
  const combinedOutput = `${stdout}\n${stderr}`;
  const classificationOutput = `${combinedOutput}\n${stdoutSkipTail}\n${stderrSkipTail}`;
  const skipReason =
    exitCode === 0 ? detectedSkipReason ?? detectSkipReason(classificationOutput) : null;
  const status = skipReason ? "skipped" : exitCode === 0 ? "passed" : "failed";
  const resolvedEvidencePath = path.resolve(evidencePath);
  const stdoutPath = `${resolvedEvidencePath}.stdout.log`;
  const stderrPath = `${resolvedEvidencePath}.stderr.log`;
  const stdoutEvidence = redactAndBoundText(stdout, maxOutputBytes);
  const stderrEvidence = redactAndBoundText(stderr, maxOutputBytes);
  const redactedStdout = stdoutEvidence.text;
  const redactedStderr = stderrEvidence.text;
  outputTruncated ||= stdoutEvidence.truncated || stderrEvidence.truncated;
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
    timedOut,
    timeoutMs,
    skipReason: skipReason ? redactText(skipReason) : null,
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
