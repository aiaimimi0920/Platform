import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PLATFORM_CONTAINER_IMAGES = [
  "core",
  "account-api",
  "account-worker",
  "worker",
  "executor",
  "web",
];

export const ENTRY_SCHEMA_VERSION = "neuro-platform-image-lock-entry/v1";
export const LOCK_SCHEMA_VERSION = "neuro-platform-image-lock/v1";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REVISION_PATTERN = /^[0-9a-f]{40}$/;
const RUN_NUMBER_PATTERN = /^[1-9]\d*$/;
const REF_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/;

function requireValue(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}

function requirePattern(value, pattern, label) {
  const normalized = requireValue(value, label).toLowerCase();
  if (!pattern.test(normalized)) throw new TypeError(`${label} is invalid`);
  return normalized;
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireExactKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(requireObject(value, label)).sort();
  const normalizedExpectedKeys = [...expectedKeys].sort();
  if (actualKeys.join("\n") !== normalizedExpectedKeys.join("\n")) {
    throw new TypeError(`${label} fields are invalid`);
  }
}

function requireRefName(value) {
  const refName = requireValue(value, "refName");
  if (
    !REF_NAME_PATTERN.test(refName)
    || refName.includes("..")
    || refName.includes("@{")
    || refName.endsWith("/")
    || refName.endsWith(".")
  ) {
    throw new TypeError("refName is invalid");
  }
  return refName;
}

export function createContainerImageLockEntry(input) {
  const image = requireValue(input.image, "image");
  if (!PLATFORM_CONTAINER_IMAGES.includes(image)) {
    throw new TypeError(`Unknown Platform image: ${image}`);
  }

  const reference = requireValue(input.reference, "reference").toLowerCase();
  const expectedReferenceSuffix = `/neuro-platform-${image}`;
  if (!/^ghcr\.io\/[a-z0-9._-]+\/neuro-platform-[a-z0-9._-]+$/.test(reference) || !reference.endsWith(expectedReferenceSuffix)) {
    throw new TypeError(`reference does not match Platform image ${image}`);
  }

  const digest = requirePattern(input.digest, DIGEST_PATTERN, "digest");
  const revision = requirePattern(input.revision, REVISION_PATTERN, "revision");
  const repository = requireValue(input.repository, "repository");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new TypeError("repository is invalid");
  }
  const refName = requireRefName(input.refName);
  const runId = requirePattern(input.runId, RUN_NUMBER_PATTERN, "runId");
  const runAttempt = requirePattern(input.runAttempt, RUN_NUMBER_PATTERN, "runAttempt");
  const platform = requireValue(input.platform ?? "linux/amd64", "platform");
  if (platform !== "linux/amd64") throw new TypeError("platform must be linux/amd64");

  return {
    schemaVersion: ENTRY_SCHEMA_VERSION,
    image,
    reference,
    digest,
    immutableReference: `${reference}@${digest}`,
    platform,
    source: {
      repository,
      revision,
      refName,
    },
    workflow: {
      runId,
      runAttempt,
    },
  };
}

export function aggregateContainerImageLockEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError("entries must be an array");
  if (entries.length !== PLATFORM_CONTAINER_IMAGES.length) {
    throw new Error(`Expected ${PLATFORM_CONTAINER_IMAGES.length} image lock entries, received ${entries.length}`);
  }

  const entryMap = new Map();
  for (const entry of entries) {
    if (entry?.schemaVersion !== ENTRY_SCHEMA_VERSION) throw new Error("Image lock entry schema is invalid");
    const normalized = createContainerImageLockEntry({
      ...entry,
      repository: entry.source?.repository,
      revision: entry.source?.revision,
      refName: entry.source?.refName,
      runId: entry.workflow?.runId,
      runAttempt: entry.workflow?.runAttempt,
    });
    if (entryMap.has(normalized.image)) throw new Error(`Duplicate image lock entry: ${normalized.image}`);
    entryMap.set(normalized.image, normalized);
  }

  const missingImages = PLATFORM_CONTAINER_IMAGES.filter((image) => !entryMap.has(image));
  if (missingImages.length > 0) throw new Error(`Missing image lock entries: ${missingImages.join(", ")}`);

  const orderedEntries = PLATFORM_CONTAINER_IMAGES.map((image) => entryMap.get(image));
  const baseline = orderedEntries[0];
  for (const entry of orderedEntries.slice(1)) {
    for (const field of ["repository", "revision", "refName"]) {
      if (entry.source[field] !== baseline.source[field]) {
        throw new Error(`Image lock source ${field} does not match across images`);
      }
    }
    for (const field of ["runId", "runAttempt"]) {
      if (entry.workflow[field] !== baseline.workflow[field]) {
        throw new Error(`Image lock workflow ${field} does not match across images`);
      }
    }
    if (entry.platform !== baseline.platform) throw new Error("Image lock platform does not match across images");
  }

  return {
    schemaVersion: LOCK_SCHEMA_VERSION,
    source: baseline.source,
    workflow: baseline.workflow,
    platform: baseline.platform,
    images: orderedEntries.map(({ image, reference, digest, immutableReference }) => ({
      image,
      reference,
      digest,
      immutableReference,
    })),
  };
}

export function validateContainerImageLock(lock, expectations = {}) {
  requireExactKeys(lock, ["schemaVersion", "source", "workflow", "platform", "images"], "image lock");
  if (lock.schemaVersion !== LOCK_SCHEMA_VERSION) throw new Error("Image lock schema is invalid");
  requireExactKeys(lock.source, ["repository", "revision", "refName"], "image lock source");
  requireExactKeys(lock.workflow, ["runId", "runAttempt"], "image lock workflow");
  if (!Array.isArray(lock.images)) throw new TypeError("image lock images must be an array");

  const entries = lock.images.map((imageEntry, index) => {
    requireExactKeys(imageEntry, ["image", "reference", "digest", "immutableReference"], `image lock image ${index}`);
    const expectedImage = PLATFORM_CONTAINER_IMAGES[index];
    if (imageEntry.image !== expectedImage) {
      throw new Error(`Image lock images must use canonical order; expected ${expectedImage ?? "no additional image"} at index ${index}`);
    }
    const normalized = createContainerImageLockEntry({
      ...imageEntry,
      platform: lock.platform,
      repository: lock.source.repository,
      revision: lock.source.revision,
      refName: lock.source.refName,
      runId: lock.workflow.runId,
      runAttempt: lock.workflow.runAttempt,
    });
    if (imageEntry.reference !== normalized.reference
      || imageEntry.digest !== normalized.digest
      || imageEntry.immutableReference !== normalized.immutableReference) {
      throw new Error(`Image lock image ${imageEntry.image} is not canonical`);
    }
    return normalized;
  });

  const normalizedLock = aggregateContainerImageLockEntries(entries);
  for (const field of ["repository", "revision", "refName"]) {
    if (lock.source[field] !== normalizedLock.source[field]) throw new Error(`Image lock source ${field} is not canonical`);
  }
  for (const field of ["runId", "runAttempt"]) {
    if (lock.workflow[field] !== normalizedLock.workflow[field]) throw new Error(`Image lock workflow ${field} is not canonical`);
  }
  if (lock.platform !== normalizedLock.platform) throw new Error("Image lock platform is not canonical");

  const expectedValues = {
    repository: normalizedLock.source.repository,
    revision: normalizedLock.source.revision,
    refName: normalizedLock.source.refName,
    runId: normalizedLock.workflow.runId,
    runAttempt: normalizedLock.workflow.runAttempt,
    platform: normalizedLock.platform,
  };
  for (const [field, actualValue] of Object.entries(expectedValues)) {
    if (expectations[field] !== undefined && String(expectations[field]) !== actualValue) {
      throw new Error(`Image lock ${field} does not match the release`);
    }
  }
  return normalizedLock;
}

export function validateContainerImageLockEntryFileNames(fileNames) {
  if (!Array.isArray(fileNames)) throw new TypeError("fileNames must be an array");
  const actual = [...fileNames].sort();
  const expected = PLATFORM_CONTAINER_IMAGES.map((image) => `image-lock-${image}.json`).sort();
  if (actual.join("\n") !== expected.join("\n")) {
    throw new Error(`Image lock entry files must be exactly: ${expected.join(", ")}`);
  }
  return expected;
}

export function selectContainerImageLockWorkflowRun(runs, expectations) {
  if (!Array.isArray(runs)) throw new TypeError("workflow runs must be an array");
  const revision = requirePattern(expectations?.revision, REVISION_PATTERN, "revision");
  const refName = requireRefName(expectations?.refName);
  const expectedWorkflowPath = `.github/workflows/container-images.yml@${refName}`;
  const matchingRuns = runs.filter((run) =>
    run?.event === "push"
    && String(run.head_sha ?? "").toLowerCase() === revision
    && run.path === expectedWorkflowPath,
  );
  const matchingRunIds = new Set(matchingRuns.map((run) => String(run.id ?? "")));
  if (matchingRunIds.size > 1) {
    throw new Error(`Multiple Container Images workflow runs match ${refName} at ${revision}`);
  }
  if (matchingRuns.length === 0) return null;

  const run = matchingRuns[0];
  const runId = requirePattern(run.id, RUN_NUMBER_PATTERN, "workflow run id");
  if (run.status !== "completed") return null;
  if (run.conclusion !== "success") {
    throw new Error(`Container Images workflow run ${runId} completed with ${run.conclusion ?? "an unknown conclusion"}`);
  }
  const runAttempt = requirePattern(run.run_attempt, RUN_NUMBER_PATTERN, "workflow run attempt");
  return {
    runId,
    runAttempt,
    artifactName: `platform-container-image-lock-${runId}-${runAttempt}`,
  };
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new TypeError(`Invalid argument: ${name ?? ""}`);
    options[name.slice(2)] = value;
  }
  return options;
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(outputPath, value) {
  const absolutePath = resolve(outputPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  const serialized = serializeJson(value);
  await writeFile(absolutePath, serialized, "utf8");
  return { absolutePath, serialized };
}

async function writeChecksum(checksumPath, artifactPath, serialized) {
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  const absolutePath = resolve(checksumPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${digest}  ${basename(artifactPath)}\n`, "utf8");
}

function parsePositiveInteger(value, label, defaultValue) {
  if (value === undefined) return defaultValue;
  const normalized = requirePattern(value, RUN_NUMBER_PATTERN, label);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) throw new TypeError(`${label} is invalid`);
  return parsed;
}

async function resolveContainerImageLockWorkflowRun(options) {
  const repository = requireValue(options.repository, "repository");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new TypeError("repository is invalid");
  const revision = requirePattern(options.revision, REVISION_PATTERN, "revision");
  const refName = requireRefName(options.refName);
  const outputPath = resolve(requireValue(options.output, "output"));
  const token = requireValue(process.env.GITHUB_TOKEN, "GITHUB_TOKEN");
  const apiUrl = requireValue(process.env.GITHUB_API_URL ?? "https://api.github.com", "GITHUB_API_URL").replace(/\/$/, "");
  const timeoutSeconds = parsePositiveInteger(options.timeoutSeconds, "timeoutSeconds", 1800);
  const pollSeconds = parsePositiveInteger(options.pollSeconds, "pollSeconds", 15);
  const deadline = Date.now() + timeoutSeconds * 1000;
  const endpoint = `${apiUrl}/repos/${repository}/actions/workflows/container-images.yml/runs?event=push&per_page=100`;

  while (true) {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "neuro-platform-release",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (!response.ok) throw new Error(`GitHub Actions API returned HTTP ${response.status}`);
    const payload = await response.json();
    const selectedRun = selectContainerImageLockWorkflowRun(payload?.workflow_runs, { revision, refName });
    if (selectedRun) {
      await mkdir(dirname(outputPath), { recursive: true });
      await appendFile(
        outputPath,
        `runId=${selectedRun.runId}\nrunAttempt=${selectedRun.runAttempt}\nartifactName=${selectedRun.artifactName}\n`,
        "utf8",
      );
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for Container Images workflow for ${refName} at ${revision}`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, pollSeconds * 1000));
  }
}

async function runCli() {
  const [command, ...rawOptions] = process.argv.slice(2);
  const options = parseOptions(rawOptions);
  if (command === "entry") {
    const entry = createContainerImageLockEntry(options);
    await writeJson(requireValue(options.output, "output"), entry);
    return;
  }
  if (command === "aggregate") {
    const inputDirectory = resolve(requireValue(options.input, "input"));
    const fileNames = (await readdir(inputDirectory)).filter((fileName) => fileName.endsWith(".json")).sort();
    validateContainerImageLockEntryFileNames(fileNames);
    const entries = await Promise.all(
      fileNames.map(async (fileName) => {
        const entry = JSON.parse(await readFile(resolve(inputDirectory, fileName), "utf8"));
        const expectedImage = fileName.slice("image-lock-".length, -".json".length);
        if (entry?.image !== expectedImage) throw new Error(`Image lock entry file ${fileName} contains ${entry?.image ?? "no image"}`);
        return entry;
      }),
    );
    await writeJson(requireValue(options.output, "output"), aggregateContainerImageLockEntries(entries));
    return;
  }
  if (command === "validate") {
    const inputPath = resolve(requireValue(options.input, "input"));
    const lock = JSON.parse(await readFile(inputPath, "utf8"));
    const validatedLock = validateContainerImageLock(lock, {
      repository: options.repository,
      revision: options.revision,
      refName: options.refName,
      runId: options.runId,
      runAttempt: options.runAttempt,
      platform: options.platform,
    });
    const outputPath = requireValue(options.output, "output");
    const { serialized } = await writeJson(outputPath, validatedLock);
    if (options.checksumOutput !== undefined) {
      await writeChecksum(requireValue(options.checksumOutput, "checksumOutput"), outputPath, serialized);
    }
    return;
  }
  if (command === "resolve-run") {
    await resolveContainerImageLockWorkflowRun(options);
    return;
  }
  throw new TypeError("Command must be entry, aggregate, validate, or resolve-run");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
