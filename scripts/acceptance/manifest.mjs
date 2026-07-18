import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SUITE_LAYERS = ["required", "externalBoundary", "conditionalLive"];
const RESULT_STATUSES = [
  "passed",
  "failed",
  "skipped",
  "not-run",
  "external-blocked",
  "not-applicable",
];
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const WINDOWS_RESERVED_PATH_SEGMENT_PATTERN = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const atomicWriteQueues = new Map();
const TRANSIENT_RENAME_ERROR_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

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

function createCounters() {
  return {
    discovered: 0,
    executed: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    externalBlocked: 0,
    notApplicable: 0,
  };
}

function normalizeLayer(layer) {
  if (!SUITE_LAYERS.includes(layer)) {
    throw new TypeError(`Unknown acceptance layer: ${layer}`);
  }
  return layer;
}

export function validateAcceptanceRunId(runId) {
  if (
    typeof runId !== "string" ||
    !RUN_ID_PATTERN.test(runId) ||
    WINDOWS_RESERVED_PATH_SEGMENT_PATTERN.test(runId)
  ) {
    throw new TypeError(
      "Acceptance runId must be a 1-63 character lowercase Compose-compatible path segment",
    );
  }
  return runId;
}

function normalizeResultId(manifest, id) {
  if (typeof id !== "string" || !id.trim()) {
    throw new TypeError("Acceptance suite id must be a nonempty string");
  }
  const normalizedId = id.trim();
  if (manifest.results.some((result) => result.id === normalizedId)) {
    throw new TypeError(`Duplicate acceptance suite id: ${normalizedId}`);
  }
  return normalizedId;
}

function normalizeResultStatus(status) {
  if (!RESULT_STATUSES.includes(status)) {
    throw new TypeError(`Unknown acceptance result status: ${status}`);
  }
  return status;
}

export function redactText(value) {
  if (typeof value !== "string" || value.length === 0) return value ?? "";
  return value
    .replace(/\b(Set-Cookie|Cookie)\b\s*[:=]\s*[^\r\n]*/gi, (_match, header) => `${header}: [REDACTED]`)
    .replace(
      /(["']Authorization["']\s*:\s*)(?:"[^"]*"|'[^']*')/gi,
      (_match, prefix) => `${prefix}"[REDACTED]"`,
    )
    .replace(/\bAuthorization\b\s*[:=]\s*[^\r\n]*/gi, "Authorization: [REDACTED]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /(["']credentials?["']\s*:\s*)[^\r\n]*/gi,
      (_match, prefix) => `${prefix}"[REDACTED]"`,
    )
    .replace(/\b(credentials?)\b\s*[:=]\s*[^\r\n]*/gi, (_match, key) => `${key}=[REDACTED]`)
    .replace(
      /(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi,
      "$1[REDACTED]@",
    )
    .replace(
      /(["']?)(access[-_]?token|refresh[-_]?token|id[-_]?token|session[-_]?token|client[-_]?secret|secret[-_]?access[-_]?key|access[-_]?key|private[-_]?key|token|cookie|api[-_]?key|authorization|password|passwd|pwd|credentials?|secret|key|code)\1\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      (_match, _quote, key) => `${key}=[REDACTED]`,
    );
}

const SENSITIVE_ARGUMENT_COMPONENTS = new Set([
  "authorization",
  "code",
  "cookie",
  "credential",
  "credentials",
  "key",
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
]);

function parseCredentialArgument(value) {
  const match = /^(--?)([^=]+)(?:=(.*))?$/.exec(value);
  if (!match) return null;
  const sensitive = match[2]
    .split(/[-_.]+/)
    .some((component) => SENSITIVE_ARGUMENT_COMPONENTS.has(component.toLowerCase()));
  if (!sensitive) return null;
  return {
    inline: value.includes("="),
    prefix: `${match[1]}${match[2]}`,
  };
}

export function redactArgs(args) {
  const redacted = [];
  let redactNext = false;
  for (const item of args) {
    const value = String(item);
    const credentialArgument = parseCredentialArgument(value);
    if (redactNext) {
      redacted.push("[REDACTED]");
      redactNext = false;
    } else if (credentialArgument) {
      redacted.push(
        credentialArgument.inline ? `${credentialArgument.prefix}=[REDACTED]` : value,
      );
      redactNext = !credentialArgument.inline;
    } else {
      redacted.push(redactText(value));
    }
  }
  return redacted;
}

export function createAcceptanceManifest({ runId, evidenceDir, git = null, startedAt = new Date().toISOString() }) {
  const normalizedRunId = validateAcceptanceRunId(runId);
  if (!evidenceDir || !String(evidenceDir).trim()) {
    throw new TypeError("Acceptance evidenceDir is required");
  }

  return {
    schemaVersion: 1,
    runId: normalizedRunId,
    evidenceDir: path.resolve(String(evidenceDir)),
    startedAt,
    finishedAt: null,
    status: "running",
    git,
    suites: {
      required: createCounters(),
      externalBoundary: createCounters(),
      conditionalLive: createCounters(),
    },
    results: [],
    failureReasons: [],
  };
}

export function recordSuiteResult(manifest, result) {
  const id = normalizeResultId(manifest, result.id);
  const layer = normalizeLayer(result.layer);
  const reportedStatus = normalizeResultStatus(result.status);
  const counters = manifest.suites[layer];
  const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : null;
  const mustFail =
    reportedStatus === "passed"
      ? exitCode !== 0
      : exitCode !== null && exitCode !== 0 && reportedStatus !== "external-blocked";
  const status = mustFail ? "failed" : reportedStatus;
  const normalized = {
    id,
    layer,
    status,
    command: redactText(String(result.command ?? "")),
    args: Array.isArray(result.args) ? redactArgs(result.args) : [],
    exitCode,
    evidencePath: result.evidencePath ? path.resolve(String(result.evidencePath)) : null,
    stdoutPath: result.stdoutPath ? path.resolve(String(result.stdoutPath)) : null,
    stderrPath: result.stderrPath ? path.resolve(String(result.stderrPath)) : null,
    correlationId: result.correlationId ? String(result.correlationId) : null,
    skipReason: result.skipReason ? redactText(String(result.skipReason)) : null,
    startedAt: result.startedAt ?? null,
    finishedAt: result.finishedAt ?? null,
    durationMs: Number.isFinite(result.durationMs) ? result.durationMs : null,
    timedOut: result.timedOut === true,
    timeoutMs: Number.isFinite(result.timeoutMs) ? result.timeoutMs : null,
  };

  counters.discovered += 1;
  if (status === "passed" || status === "failed" || status === "external-blocked") {
    counters.executed += 1;
  }
  if (status === "passed") counters.passed += 1;
  else if (status === "failed") counters.failed += 1;
  else if (status === "skipped" || status === "not-run") counters.skipped += 1;
  else if (status === "external-blocked") counters.externalBlocked += 1;
  else if (status === "not-applicable") counters.notApplicable += 1;

  manifest.results.push(normalized);
  return normalized;
}

function collectLayerFailures(layerName, counters) {
  const reasons = [];
  if (counters.failed > 0) reasons.push(`${layerName} has ${counters.failed} failed suite(s)`);
  if (counters.skipped > 0) reasons.push(`${layerName} has ${counters.skipped} skipped suite(s)`);
  if (counters.externalBlocked > 0) {
    reasons.push(`${layerName} has ${counters.externalBlocked} externalBlocked suite(s)`);
  }
  if (counters.executed < counters.discovered) {
    reasons.push(`${layerName} executed ${counters.executed} of ${counters.discovered} discovered suite(s)`);
  }
  return reasons;
}

export function finalizeAcceptanceManifest(
  manifest,
  { finishedAt = new Date().toISOString(), requiredLayers = [] } = {},
) {
  const failureReasons = [
    ...collectLayerFailures("required", manifest.suites.required),
    ...collectLayerFailures("externalBoundary", manifest.suites.externalBoundary),
  ];

  for (const layer of requiredLayers) {
    normalizeLayer(layer);
    if (manifest.suites[layer].discovered === 0) {
      failureReasons.push(`no ${layer} suites were registered`);
    }
  }

  if (manifest.suites.conditionalLive.failed > 0) {
    failureReasons.push(`conditionalLive has ${manifest.suites.conditionalLive.failed} unclassified failure(s)`);
  }
  if (manifest.suites.conditionalLive.skipped > 0) {
    failureReasons.push(`conditionalLive has ${manifest.suites.conditionalLive.skipped} not-run suite(s)`);
  }

  manifest.finishedAt = finishedAt;
  manifest.failureReasons = failureReasons;
  manifest.status = failureReasons.length === 0 ? "passed" : "failed";
  return { manifest, exitCode: failureReasons.length === 0 ? 0 : 1 };
}

export async function writeManifestAtomic(outputPath, manifest) {
  const resolvedPath = path.resolve(outputPath);
  return enqueueAtomicWrite(resolvedPath, async () => {
    await mkdir(path.dirname(resolvedPath), { recursive: true });
    const temporaryPath = `${resolvedPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      await renameWithRetry(temporaryPath, resolvedPath);
      return resolvedPath;
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => {});
    }
  });
}
