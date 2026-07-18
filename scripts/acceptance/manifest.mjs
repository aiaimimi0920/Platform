import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const SUITE_LAYERS = ["required", "externalBoundary", "conditionalLive"];

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

export function redactText(value) {
  if (typeof value !== "string" || value.length === 0) return value ?? "";
  return value
    .replace(/\b(Set-Cookie|Cookie)\b\s*[:=]\s*[^\r\n]*/gi, (_match, header) => `${header}: [REDACTED]`)
    .replace(/\bAuthorization\b\s*[:=]\s*Bearer\s+[^\s,;]+/gi, "Authorization: Bearer [REDACTED]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /(["']?)(access[-_]?token|refresh[-_]?token|id[-_]?token|session[-_]?token|client[-_]?secret|token|cookie|api[-_]?key|authorization|secret|key|code)\1\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      (_match, _quote, key) => `${key}=[REDACTED]`,
    );
}

const CREDENTIAL_ARGUMENT_PATTERN = /^--?(?:access[-_]?token|refresh[-_]?token|id[-_]?token|session[-_]?token|client[-_]?secret|token|cookie|api[-_]?key|authorization|secret|key|code)$/i;

export function redactArgs(args) {
  const redacted = [];
  let redactNext = false;
  for (const item of args) {
    const value = String(item);
    if (redactNext) {
      redacted.push("[REDACTED]");
      redactNext = false;
    } else if (CREDENTIAL_ARGUMENT_PATTERN.test(value)) {
      redacted.push(value);
      redactNext = true;
    } else {
      redacted.push(redactText(value));
    }
  }
  return redacted;
}

export function createAcceptanceManifest({ runId, evidenceDir, git = null, startedAt = new Date().toISOString() }) {
  if (!runId || !String(runId).trim()) {
    throw new TypeError("Acceptance runId is required");
  }
  if (!evidenceDir || !String(evidenceDir).trim()) {
    throw new TypeError("Acceptance evidenceDir is required");
  }

  return {
    schemaVersion: 1,
    runId: String(runId),
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
  const layer = normalizeLayer(result.layer);
  const counters = manifest.suites[layer];
  const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : null;
  const mustFail =
    result.status === "passed"
      ? exitCode !== 0
      : exitCode !== null && exitCode !== 0 && result.status !== "external-blocked";
  const status = mustFail ? "failed" : result.status;
  counters.discovered += 1;

  if (status === "passed" || status === "failed" || status === "external-blocked") {
    counters.executed += 1;
  }
  if (status === "passed") counters.passed += 1;
  else if (status === "failed") counters.failed += 1;
  else if (status === "skipped" || status === "not-run") counters.skipped += 1;
  else if (status === "external-blocked") counters.externalBlocked += 1;
  else if (status === "not-applicable") counters.notApplicable += 1;
  else throw new TypeError(`Unknown acceptance result status: ${status}`);

  const normalized = {
    id: String(result.id),
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
  };
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
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  const temporaryPath = `${resolvedPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(temporaryPath, resolvedPath);
  return resolvedPath;
}
