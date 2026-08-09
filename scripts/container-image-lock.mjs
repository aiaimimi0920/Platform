import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PLATFORM_CONTAINER_IMAGES = [
  "core",
  "account-api",
  "account-worker",
  "worker",
  "executor",
  "web",
];

const ENTRY_SCHEMA_VERSION = "neuro-platform-image-lock-entry/v1";
const LOCK_SCHEMA_VERSION = "neuro-platform-image-lock/v1";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REVISION_PATTERN = /^[0-9a-f]{40}$/;
const RUN_NUMBER_PATTERN = /^\d+$/;

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
  const refName = requireValue(input.refName, "refName");
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

async function writeJson(outputPath, value) {
  const absolutePath = resolve(outputPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    const entries = await Promise.all(
      fileNames.map(async (fileName) => JSON.parse(await readFile(resolve(inputDirectory, fileName), "utf8"))),
    );
    await writeJson(requireValue(options.output, "output"), aggregateContainerImageLockEntries(entries));
    return;
  }
  throw new TypeError("Command must be entry or aggregate");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
