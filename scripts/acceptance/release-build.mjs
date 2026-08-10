import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PLATFORM_CONTAINER_IMAGES,
  validateContainerImageLock,
} from "../container-image-lock.mjs";
import { redactText } from "./manifest.mjs";

const RELEASE_SCHEMA_VERSION = "neuro-platform-release/v1";
const VERSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DIGEST_PATTERN = /^sha256:([0-9a-f]{64})$/;
const TEXT_EVIDENCE_EXTENSIONS = new Set([".json", ".log", ".txt", ".xml", ".html"]);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLATFORM_IMAGE_REFERENCE_PREFIX = "ghcr.io/aiaimimi0920/neuro-platform-";

const MIGRATION_DOMAINS = [
  {
    id: "core",
    source: "core/migrations",
    destination: "migrations/core",
    workspace: "@neuro/core",
    command: "npm run db:migrate --workspace @neuro/core",
    migrationTableName: "schema_migrations",
    advisoryLockName: "neuro-core-schema-migrations",
  },
  {
    id: "ai-gateway-domain",
    source: "packages/ai-gateway-domain/migrations",
    destination: "migrations/ai-gateway-domain",
    workspace: "@neuro/ai-gateway-domain",
    command: "npm run db:migrate --workspace @neuro/ai-gateway-domain",
    migrationTableName: "gateway_schema_migrations",
    advisoryLockName: "neuro-gateway-schema-migrations",
  },
  {
    id: "account-domain",
    source: "packages/account-domain/migrations",
    destination: "migrations/account-domain",
    workspace: "@neuro/account-domain",
    command: "npm run db:migrate --workspace @neuro/account-domain",
    migrationTableName: "account_schema_migrations",
    advisoryLockName: "neuro-account-schema-migrations",
  },
];

function normalizePathForComparison(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isContainedPath(root, candidate) {
  const normalizedRoot = normalizePathForComparison(root);
  const normalizedCandidate = normalizePathForComparison(candidate);
  const relative = path.relative(normalizedRoot, normalizedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function requireContainedPath(root, candidate, label) {
  if (!isContainedPath(root, candidate)) {
    throw new Error(`${label} must stay inside the acceptance evidence directory`);
  }
  return path.resolve(candidate);
}

async function requireContainedRegularFile(root, candidate, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = requireContainedPath(resolvedRoot, candidate, label);
  const rootStat = await lstat(resolvedRoot);
  if (rootStat.isSymbolicLink()) {
    throw new Error("Acceptance evidence directory may not be a symbolic link");
  }
  if (!rootStat.isDirectory()) {
    throw new Error("Acceptance evidence directory must be a directory");
  }

  const relative = path.relative(resolvedRoot, resolvedCandidate);
  const segments = relative ? relative.split(path.sep) : [];
  if (segments.length === 0) {
    throw new Error(`${label} must be a regular file inside the acceptance evidence directory`);
  }
  let currentPath = resolvedRoot;
  let fileStat = null;
  for (const [index, segment] of segments.entries()) {
    currentPath = path.join(currentPath, segment);
    const currentStat = await lstat(currentPath);
    if (currentStat.isSymbolicLink()) {
      throw new Error(`${label} may not traverse a symbolic link: ${currentPath}`);
    }
    const isFinalSegment = index === segments.length - 1;
    if (!isFinalSegment && !currentStat.isDirectory()) {
      throw new Error(`${label} parent must be a directory: ${currentPath}`);
    }
    if (isFinalSegment && !currentStat.isFile()) {
      throw new Error(`${label} must be a regular file: ${currentPath}`);
    }
    if (isFinalSegment) {
      if (currentStat.nlink !== 1) {
        throw new Error(`${label} may not be a hard-linked file: ${currentPath}`);
      }
      fileStat = currentStat;
    }
  }

  const [resolvedRealRoot, resolvedRealCandidate] = await Promise.all([
    realpath(resolvedRoot),
    realpath(resolvedCandidate),
  ]);
  if (!isContainedPath(resolvedRealRoot, resolvedRealCandidate)) {
    throw new Error(`${label} resolves outside the acceptance evidence directory`);
  }
  return { path: resolvedCandidate, stat: fileStat };
}

function isSameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

async function readContainedEvidenceText(root, candidate, label) {
  const verified = await requireContainedRegularFile(root, candidate, label);
  const handle = await open(verified.path, "r");
  try {
    const openedStat = await handle.stat();
    if (openedStat.nlink !== 1 || !isSameFile(verified.stat, openedStat)) {
      throw new Error(`${label} changed while it was being opened: ${verified.path}`);
    }
    const contents = await handle.readFile("utf8");
    const currentStat = await lstat(verified.path);
    if (
      currentStat.isSymbolicLink()
      || currentStat.nlink !== 1
      || !isSameFile(openedStat, currentStat)
    ) {
      throw new Error(`${label} changed while it was being read: ${verified.path}`);
    }
    return contents;
  } finally {
    await handle.close();
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireNonnegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value;
}

function validateLayerCounters(layer, counters, { allowNotApplicable }) {
  requireObject(counters, `acceptance ${layer} counters`);
  for (const field of [
    "discovered",
    "executed",
    "passed",
    "failed",
    "skipped",
    "externalBlocked",
    "notApplicable",
  ]) {
    requireNonnegativeInteger(counters[field], `acceptance ${layer}.${field}`);
  }
  if (counters.discovered === 0) throw new Error(`Acceptance ${layer} suites were not discovered`);
  if (counters.executed !== counters.discovered) {
    throw new Error(`Acceptance ${layer} suites were not all executed`);
  }
  if (counters.failed || counters.skipped || counters.externalBlocked) {
    throw new Error(`Acceptance ${layer} contains failed, skipped, or externally blocked suites`);
  }
  const classified = counters.passed + counters.notApplicable;
  if (classified !== counters.discovered) {
    throw new Error(`Acceptance ${layer} counters are inconsistent`);
  }
  if (!allowNotApplicable && counters.notApplicable !== 0) {
    throw new Error(`Acceptance ${layer} may not be classified as not-applicable`);
  }
}

export async function assertCanonicalReleaseRoot(outputRoot, repoRoot = REPO_ROOT) {
  const canonicalRoot = path.resolve(repoRoot, "..", "release", "Platform");
  const requestedRoot = path.resolve(outputRoot);
  if (normalizePathForComparison(requestedRoot) !== normalizePathForComparison(canonicalRoot)) {
    throw new Error(`Release output must use the canonical Platform root: ${canonicalRoot}`);
  }

  await mkdir(requestedRoot, { recursive: true });
  for (const candidate of [path.dirname(requestedRoot), requestedRoot]) {
    const candidateStat = await lstat(candidate);
    if (candidateStat.isSymbolicLink()) {
      throw new Error("Canonical Platform release root and its release parent may not be symlinks");
    }
  }
  const [resolvedOutput, resolvedCanonical] = await Promise.all([
    realpath(requestedRoot),
    realpath(canonicalRoot),
  ]);
  if (normalizePathForComparison(resolvedOutput) !== normalizePathForComparison(resolvedCanonical)) {
    throw new Error("Canonical Platform release root resolves outside its declared path");
  }
  return requestedRoot;
}

export function validateAcceptanceForRelease(manifest, { manifestPath, currentGit }) {
  requireObject(manifest, "acceptance manifest");
  if (manifest.schemaVersion !== 1) throw new Error("Acceptance manifest schema is unsupported");
  if (manifest.status !== "passed") throw new Error("Acceptance manifest must have passed");
  if (!manifest.runId || typeof manifest.runId !== "string") {
    throw new Error("Acceptance manifest runId is required");
  }

  const evidenceDir = path.resolve(String(manifest.evidenceDir ?? ""));
  if (!manifest.evidenceDir || !isContainedPath(evidenceDir, manifestPath)) {
    throw new Error("Acceptance manifest must be stored in its evidence directory");
  }
  const manifestGit = requireObject(manifest.git, "acceptance git metadata");
  if (manifestGit.dirty !== false) throw new Error("Acceptance evidence must come from a clean Git tree");
  if (currentGit?.dirty !== false) throw new Error("Release build requires a clean current Git tree");
  if (typeof manifestGit.commit !== "string" || manifestGit.commit !== currentGit?.commit) {
    throw new Error("Acceptance Git commit does not match the current release commit");
  }

  const suites = requireObject(manifest.suites, "acceptance suites");
  validateLayerCounters("required", suites.required, { allowNotApplicable: false });
  validateLayerCounters("externalBoundary", suites.externalBoundary, { allowNotApplicable: true });
  if (!Array.isArray(manifest.results)) throw new TypeError("Acceptance results must be an array");
  for (const result of manifest.results) {
    requireObject(result, "acceptance result");
    for (const field of ["evidencePath", "stdoutPath", "stderrPath"]) {
      if (result[field] !== null && result[field] !== undefined) {
        requireContainedPath(evidenceDir, result[field], `Acceptance ${field}`);
      }
    }
  }
  for (const layer of ["required", "externalBoundary"]) {
    const layerResults = manifest.results.filter((result) => result.layer === layer);
    const counters = suites[layer];
    const derived = {
      discovered: layerResults.length,
      executed: layerResults.filter((result) => ["passed", "failed", "external-blocked", "not-applicable"].includes(result.status)).length,
      passed: layerResults.filter((result) => result.status === "passed").length,
      failed: layerResults.filter((result) => result.status === "failed").length,
      skipped: layerResults.filter((result) => ["skipped", "not-run"].includes(result.status)).length,
      externalBlocked: layerResults.filter((result) => result.status === "external-blocked").length,
      notApplicable: layerResults.filter((result) => result.status === "not-applicable").length,
    };
    for (const field of Object.keys(derived)) {
      if (derived[field] !== counters[field]) {
        throw new Error(`Acceptance ${layer} ${field} counter does not match its results`);
      }
    }
  }
  return { manifest, evidenceDir, manifestPath: path.resolve(manifestPath), runId: manifest.runId };
}

async function validateAcceptanceEvidenceFiles(validatedAcceptance) {
  const sourcePaths = new Set([validatedAcceptance.manifestPath]);
  for (const result of validatedAcceptance.manifest.results) {
    for (const field of ["evidencePath", "stdoutPath", "stderrPath"]) {
      if (result[field]) sourcePaths.add(path.resolve(result[field]));
    }
  }
  for (const sourcePath of [...sourcePaths].sort()) {
    await requireContainedRegularFile(
      validatedAcceptance.evidenceDir,
      sourcePath,
      "Acceptance evidence",
    );
  }
  return validatedAcceptance;
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label} at ${filePath}: ${error.message}`, { cause: error });
  }
}

async function validateOciLayout(imageRoot, image) {
  const layout = await readJson(path.join(imageRoot, "oci-layout"), `${image} OCI layout marker`);
  if (layout.imageLayoutVersion !== "1.0.0") {
    throw new Error(`${image} OCI layout must use imageLayoutVersion 1.0.0`);
  }
  const index = await readJson(path.join(imageRoot, "index.json"), `${image} OCI index`);
  if (index.schemaVersion !== 2 || !Array.isArray(index.manifests)) {
    throw new Error(`${image} OCI index is invalid`);
  }
  const candidates = index.manifests.filter(
    (descriptor) => descriptor?.platform?.os === "linux" && descriptor?.platform?.architecture === "amd64",
  );
  if (candidates.length !== 1) {
    throw new Error(`${image} OCI index must contain exactly one linux/amd64 manifest`);
  }
  const descriptor = candidates[0];
  const digestMatch = DIGEST_PATTERN.exec(String(descriptor.digest ?? ""));
  if (!digestMatch) throw new Error(`${image} OCI manifest digest is invalid`);
  const blobPath = path.join(imageRoot, "blobs", "sha256", digestMatch[1]);
  const blob = await readFile(blobPath);
  const actualDigest = createHash("sha256").update(blob).digest("hex");
  if (actualDigest !== digestMatch[1]) throw new Error(`${image} OCI manifest blob digest does not match`);
  if (descriptor.size !== blob.length) throw new Error(`${image} OCI manifest blob size does not match`);
  return {
    image,
    reference: `${PLATFORM_IMAGE_REFERENCE_PREFIX}${image}`,
    digest: descriptor.digest,
    immutableReference: `${PLATFORM_IMAGE_REFERENCE_PREFIX}${image}@${descriptor.digest}`,
    platform: "linux/amd64",
    layoutPath: `oci/${image}`,
  };
}

export async function validateOciImageLayouts(ociRoot) {
  const resolvedRoot = path.resolve(ociRoot);
  const entries = await readdir(resolvedRoot, { withFileTypes: true });
  const visibleDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expectedDirectories = [...PLATFORM_CONTAINER_IMAGES].sort();
  if (visibleDirectories.join("\n") !== expectedDirectories.join("\n")) {
    throw new Error(`OCI root must contain exactly: ${expectedDirectories.join(", ")}`);
  }
  return Promise.all(
    PLATFORM_CONTAINER_IMAGES.map((image) => validateOciLayout(path.join(resolvedRoot, image), image)),
  );
}

export async function createMigrationInventory(repoRoot = REPO_ROOT) {
  const domains = [];
  let totalFiles = 0;
  for (const domain of MIGRATION_DOMAINS) {
    const sourceDirectory = path.join(repoRoot, domain.source);
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name)
      .sort();
    if (files.length === 0) throw new Error(`Migration domain ${domain.id} contains no SQL files`);
    totalFiles += files.length;
    domains.push({
      id: domain.id,
      workspace: domain.workspace,
      command: domain.command,
      migrationTableName: domain.migrationTableName,
      advisoryLockName: domain.advisoryLockName,
      sourcePath: domain.source.replaceAll("\\", "/"),
      releasePath: domain.destination.replaceAll("\\", "/"),
      files,
    });
  }
  return {
    schemaVersion: "neuro-platform-migration-order/v1",
    ordering: "domains execute in listed order; files execute in ordinal lexical filename order",
    domains,
    totalFiles,
  };
}

async function copyTreeSafe(source, destination, filter = () => true) {
  const sourceStat = await lstat(source);
  if (sourceStat.isSymbolicLink()) throw new Error(`Release input may not be a symlink: ${source}`);
  if (!filter(source)) return;
  if (sourceStat.isDirectory()) {
    await mkdir(destination, { recursive: true });
    const entries = (await readdir(source)).sort();
    for (const entry of entries) {
      await copyTreeSafe(path.join(source, entry), path.join(destination, entry), filter);
    }
    return;
  }
  if (!sourceStat.isFile()) throw new Error(`Unsupported release input type: ${source}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { force: false });
}

function deploymentCopyFilter(source) {
  const normalized = source.replaceAll("\\", "/");
  return !(
    normalized.includes("/.terraform/")
    || normalized.endsWith("/.terraform")
    || normalized.endsWith("/backend.hcl")
    || /\.tfstate(?:\.|$)/.test(normalized)
  );
}

async function copyDeploymentBundle(repoRoot, stagingRoot, images) {
  const deploymentRoot = path.join(stagingRoot, "deployment");
  await copyTreeSafe(
    path.join(repoRoot, "infra", "k8s"),
    path.join(deploymentRoot, "k8s"),
    deploymentCopyFilter,
  );
  await copyTreeSafe(
    path.join(repoRoot, "infra", "tofu"),
    path.join(deploymentRoot, "tofu"),
    deploymentCopyFilter,
  );

  const composeTemplatePath = path.join(repoRoot, "deploy", "docker-compose.release.yml");
  let compose = await readFile(composeTemplatePath, "utf8");
  for (const image of images) {
    compose = compose.replaceAll(`@@${image.image.toUpperCase().replaceAll("-", "_")}_IMAGE@@`, image.immutableReference);
  }
  if (/@@[A-Z_]+_IMAGE@@/.test(compose) || /^\s*build\s*:/m.test(compose)) {
    throw new Error("Release Compose template contains unresolved image tokens or source build contexts");
  }
  await writeFile(path.join(deploymentRoot, "docker-compose.yml"), compose, "utf8");

  for (const environment of ["staging", "production"]) {
    const kustomizationPath = path.join(
      deploymentRoot,
      "k8s",
      "overlays",
      environment,
      "kustomization.yaml",
    );
    let kustomization = await readFile(kustomizationPath, "utf8");
    for (const image of images) {
      const escapedReference = image.reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const imageBlock = new RegExp(
        `(  - name: ${escapedReference}\\r?\\n    digest: )sha256:[0-9a-f]{64}`,
      );
      if (!imageBlock.test(kustomization)) {
        throw new Error(`${environment} Kustomize overlay is missing ${image.reference}`);
      }
      kustomization = kustomization.replace(imageBlock, `$1${image.digest}`);
    }
    await writeFile(kustomizationPath, kustomization, "utf8");
  }
  return {
    compose: "deployment/docker-compose.yml",
    kubernetes: "deployment/k8s",
    openTofu: "deployment/tofu",
    externalImages: [
      "ghcr.io/aiaimimi0920/neuroloom-platform-gateway",
      "docker.io/library/traefik",
    ],
  };
}

async function copyEnvironmentContracts(repoRoot, stagingRoot, images) {
  const sourceRoot = path.join(repoRoot, "deploy", "env");
  const destinationRoot = path.join(stagingRoot, "environment");
  await copyTreeSafe(sourceRoot, destinationRoot);
  const imageLines = [
    "# Generated immutable Platform image contract. External dependencies remain operator supplied.",
    ...images.map((image) => `PLATFORM_${image.image.toUpperCase().replaceAll("-", "_")}_IMAGE=${image.immutableReference}`),
    "PLATFORM_GATEWAY_IMAGE=replace-with-immutable-external-gateway-reference",
    "PLATFORM_RUNTIME_ENV_FILE=./platform.env",
    "",
  ];
  await writeFile(path.join(destinationRoot, "release-images.env.example"), imageLines.join("\n"), "utf8");
  return {
    directory: "environment",
    imageContract: "environment/release-images.env.example",
  };
}

function sanitizeEvidenceManifest(manifest, evidenceDir) {
  const sanitized = structuredClone(manifest);
  sanitized.evidenceDir = ".";
  for (const result of sanitized.results) {
    for (const field of ["evidencePath", "stdoutPath", "stderrPath"]) {
      if (result[field]) {
        result[field] = path.relative(evidenceDir, result[field]).replaceAll("\\", "/");
      }
    }
  }
  return sanitized;
}

async function copyRedactedAcceptanceEvidence(validatedAcceptance, stagingRoot, secretCanaries) {
  const destinationRoot = path.join(stagingRoot, "evidence");
  await mkdir(destinationRoot, { recursive: true });
  const sourcePaths = new Set([validatedAcceptance.manifestPath]);
  for (const result of validatedAcceptance.manifest.results) {
    for (const field of ["evidencePath", "stdoutPath", "stderrPath"]) {
      if (result[field]) sourcePaths.add(path.resolve(result[field]));
    }
  }

  const copied = [];
  for (const sourcePath of [...sourcePaths].sort()) {
    await requireContainedRegularFile(
      validatedAcceptance.evidenceDir,
      sourcePath,
      "Acceptance evidence",
    );
    const extension = path.extname(sourcePath).toLowerCase();
    if (!TEXT_EVIDENCE_EXTENSIONS.has(extension)) {
      throw new Error(`Acceptance evidence must be a text artifact: ${sourcePath}`);
    }
    const relative = sourcePath === validatedAcceptance.manifestPath
      ? "acceptance-manifest.json"
      : path.relative(validatedAcceptance.evidenceDir, sourcePath).replaceAll("\\", "/");
    if (relative.startsWith("../") || path.isAbsolute(relative)) {
      throw new Error(`Acceptance evidence path escapes its directory: ${sourcePath}`);
    }
    const destinationPath = path.join(destinationRoot, relative);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    if (sourcePath === validatedAcceptance.manifestPath) {
      const sanitizedManifest = sanitizeEvidenceManifest(
        validatedAcceptance.manifest,
        validatedAcceptance.evidenceDir,
      );
      await writeFile(destinationPath, `${JSON.stringify(sanitizedManifest, null, 2)}\n`, "utf8");
    } else {
      const sourceText = await readContainedEvidenceText(
        validatedAcceptance.evidenceDir,
        sourcePath,
        "Acceptance evidence",
      );
      if (sourceText.includes("\0")) throw new Error(`Acceptance evidence is not UTF-8 text: ${sourcePath}`);
      await writeFile(destinationPath, redactText(sourceText, secretCanaries), "utf8");
    }
    copied.push(`evidence/${relative}`);
  }
  return { manifest: "evidence/acceptance-manifest.json", files: copied };
}

async function createDependencyInventory(repoRoot) {
  const lock = await readJson(path.join(repoRoot, "package-lock.json"), "npm dependency lock");
  if (lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== "object") {
    throw new Error("npm package-lock must use lockfileVersion 3 with package inventory");
  }
  const packages = Object.entries(lock.packages)
    .filter(([packagePath, metadata]) => packagePath.startsWith("node_modules/") && metadata?.version)
    .map(([packagePath, metadata]) => ({
      name: metadata.name ?? packagePath.slice("node_modules/".length),
      version: metadata.version,
      scope: metadata.dev === true ? "development" : "production",
      license: metadata.license ?? null,
      resolved: metadata.resolved ?? null,
      integrity: metadata.integrity ?? null,
    }))
    .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`, "en"));
  return {
    schemaVersion: "neuro-platform-dependency-inventory/v1",
    source: "package-lock.json",
    lockfileVersion: lock.lockfileVersion,
    packageCount: packages.length,
    productionPackageCount: packages.filter(({ scope }) => scope === "production").length,
    packages,
  };
}

async function listFiles(root) {
  const output = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Release output may not contain symlinks: ${absolutePath}`);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile()) output.push(absolutePath);
      else throw new Error(`Release output contains an unsupported file: ${absolutePath}`);
    }
  }
  await visit(root);
  return output;
}

async function scanReleaseSecrets(stagingRoot, secretCanaries) {
  const sensitivePatterns = [
    /github_pat_[A-Za-z0-9_]{20,}/,
    /ghp_[A-Za-z0-9]{20,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bBearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/=-]{12,}/i,
  ];
  const normalizedCanaries = secretCanaries.filter((value) => typeof value === "string" && value.length > 0);
  const sensitiveAssignment = /(?:^|[\s"'])(?:access[-_]?token|refresh[-_]?token|id[-_]?token|session[-_]?token|client[-_]?secret|secret[-_]?access[-_]?key|access[-_]?key|private[-_]?key|api[-_]?key|authorization|password|passwd|pwd|credentials?|secret|token)\s*[:=]\s*([^\s,;}]+)/gim;
  for (const filePath of await listFiles(stagingRoot)) {
    const extension = path.extname(filePath).toLowerCase();
    if (!TEXT_EVIDENCE_EXTENSIONS.has(extension) && ![".yml", ".yaml", ".env", ".sha256"].includes(extension)) {
      continue;
    }
    const contents = await readFile(filePath, "utf8");
    for (const canary of normalizedCanaries) {
      if (contents.includes(canary)) throw new Error(`Release secret canary found in ${filePath}`);
    }
    if (sensitivePatterns.some((pattern) => pattern.test(contents))) {
      throw new Error(`Potential unredacted secret found in ${filePath}`);
    }
    for (const match of contents.matchAll(sensitiveAssignment)) {
      const value = match[1].replace(/^['"]|['"]$/g, "");
      if (
        value
        && !/^\[REDACTED\]$/i.test(value)
        && !/^(?:replace-me|change-me|example|<[^>]+>|\$\{[^}]+\})$/i.test(value)
      ) {
        throw new Error(`Potential unredacted credential assignment found in ${filePath}`);
      }
    }
  }
}

async function writeChecksums(stagingRoot) {
  const checksumPath = path.join(stagingRoot, "checksums.sha256");
  await rm(checksumPath, { force: true });
  const lines = [];
  for (const filePath of await listFiles(stagingRoot)) {
    const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
    const relative = path.relative(stagingRoot, filePath).replaceAll("\\", "/");
    lines.push(`${digest}  ${relative}`);
  }
  await writeFile(checksumPath, `${lines.join("\n")}\n`, "ascii");
  return "checksums.sha256";
}

async function resolveGitMetadata(repoRoot) {
  const commit = (await runCommand("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).stdout.trim();
  const statusOutput = (await runCommand("git", ["status", "--porcelain"], { cwd: repoRoot })).stdout;
  const origin = (await runCommand("git", ["remote", "get-url", "origin"], { cwd: repoRoot })).stdout.trim();
  const repositoryMatch = /github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/i.exec(origin);
  const repository = repositoryMatch?.[1] ?? null;
  const sourceDateEpoch = Number(
    (await runCommand("git", ["show", "-s", "--format=%ct", "HEAD"], { cwd: repoRoot })).stdout.trim(),
  );
  return { commit, dirty: statusOutput.trim().length > 0, repository, sourceDateEpoch };
}

function runCommand(executable, args, { cwd, env = process.env } = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectCommand);
    child.on("close", (exitCode) => {
      if (exitCode === 0) resolveCommand({ stdout, stderr });
      else rejectCommand(new Error(`${executable} ${args.join(" ")} failed (${exitCode}): ${stderr || stdout}`));
    });
  });
}

async function buildWebPackage({ repoRoot, stagingRoot, outputRoot, versionId, sourceDateEpoch }) {
  const executable = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const scriptPath = path.join(repoRoot, "scripts", "build-platform-web-release.ps1");
  await runCommand(executable, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-VersionId",
    versionId,
    "-SourceDateEpoch",
    String(sourceDateEpoch),
    "-PlatformReleaseRoot",
    outputRoot,
    "-DestinationPath",
    stagingRoot,
    "-Force",
  ], { cwd: repoRoot });
}

async function resolveImages({ imageLockPath, ociLayoutRoot, currentGit }) {
  if (Boolean(imageLockPath) === Boolean(ociLayoutRoot)) {
    throw new Error("Provide exactly one of imageLockPath or ociLayoutRoot");
  }
  if (imageLockPath) {
    const lock = validateContainerImageLock(
      await readJson(path.resolve(imageLockPath), "container image lock"),
      { revision: currentGit.commit, repository: currentGit.repository ?? undefined, platform: "linux/amd64" },
    );
    return {
      mode: "fixed-digest",
      source: lock.source,
      workflow: lock.workflow,
      platform: lock.platform,
      images: lock.images.map((image) => ({ ...image, platform: lock.platform })),
    };
  }
  return {
    mode: "oci-layout",
    source: { revision: currentGit.commit },
    platform: "linux/amd64",
    images: await validateOciImageLayouts(path.resolve(ociLayoutRoot)),
    ociLayoutRoot: path.resolve(ociLayoutRoot),
  };
}

async function assembleRelease({
  repoRoot,
  stagingRoot,
  versionId,
  sourceDateEpoch,
  currentGit,
  acceptance,
  imageInventory,
  secretCanaries,
}) {
  if (!(await stat(path.join(stagingRoot, "manifest.json"))).isFile()) {
    throw new Error("Platform Web release manifest is missing from staging");
  }
  const webManifest = await readJson(path.join(stagingRoot, "manifest.json"), "Platform Web release manifest");
  if (webManifest.gitHead !== currentGit.commit || webManifest.gitDirty !== false) {
    throw new Error("Platform Web package Git provenance does not match the complete release");
  }

  if (imageInventory.mode === "oci-layout") {
    for (const image of imageInventory.images) {
      await copyTreeSafe(
        path.join(imageInventory.ociLayoutRoot, image.image),
        path.join(stagingRoot, "oci", image.image),
      );
    }
  }
  await mkdir(path.join(stagingRoot, "images"), { recursive: true });
  const publicImageInventory = {
    schemaVersion: "neuro-platform-release-images/v1",
    mode: imageInventory.mode,
    source: imageInventory.source,
    workflow: imageInventory.workflow ?? null,
    platform: imageInventory.platform,
    images: imageInventory.images,
  };
  await writeFile(
    path.join(stagingRoot, "images", "inventory.json"),
    `${JSON.stringify(publicImageInventory, null, 2)}\n`,
    "utf8",
  );

  const migrationInventory = await createMigrationInventory(repoRoot);
  for (const domain of MIGRATION_DOMAINS) {
    await copyTreeSafe(path.join(repoRoot, domain.source), path.join(stagingRoot, domain.destination));
  }
  await writeFile(
    path.join(stagingRoot, "migrations", "migration-order.json"),
    `${JSON.stringify(migrationInventory, null, 2)}\n`,
    "utf8",
  );
  const deployment = await copyDeploymentBundle(repoRoot, stagingRoot, imageInventory.images);
  const environment = await copyEnvironmentContracts(repoRoot, stagingRoot, imageInventory.images);
  const evidence = await copyRedactedAcceptanceEvidence(acceptance, stagingRoot, secretCanaries);
  const dependencyInventory = await createDependencyInventory(repoRoot);
  await mkdir(path.join(stagingRoot, "sbom"), { recursive: true });
  await writeFile(
    path.join(stagingRoot, "sbom", "dependency-inventory.json"),
    `${JSON.stringify(dependencyInventory, null, 2)}\n`,
    "utf8",
  );

  const releaseManifest = {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    product: "Platform",
    versionId,
    builtAt: new Date(sourceDateEpoch * 1000).toISOString(),
    sourceDateEpoch,
    source: {
      repository: currentGit.repository,
      revision: currentGit.commit,
      dirty: false,
    },
    webPackage: {
      manifest: "manifest.json",
      zip: `packages/Platform-${versionId}-web-next.zip`,
      zipChecksum: `packages/Platform-${versionId}-web-next.zip.sha256`,
    },
    images: {
      inventory: "images/inventory.json",
      mode: imageInventory.mode,
      count: imageInventory.images.length,
      platform: imageInventory.platform,
    },
    migrations: {
      inventory: "migrations/migration-order.json",
      domainCount: migrationInventory.domains.length,
      fileCount: migrationInventory.totalFiles,
    },
    deployment,
    environment,
    dependencyInventory: "sbom/dependency-inventory.json",
    acceptance: {
      runId: acceptance.runId,
      manifest: evidence.manifest,
      evidenceFiles: evidence.files,
      required: acceptance.manifest.suites.required,
      externalBoundary: acceptance.manifest.suites.externalBoundary,
    },
    checksums: "checksums.sha256",
  };
  await writeFile(
    path.join(stagingRoot, "release-manifest.json"),
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
    "utf8",
  );
  await scanReleaseSecrets(stagingRoot, secretCanaries);
  await writeChecksums(stagingRoot);
  return releaseManifest;
}

export async function buildCompletePlatformRelease(options, dependencies = {}) {
  const repoRoot = path.resolve(options.repoRoot ?? REPO_ROOT);
  const versionId = String(options.versionId ?? "");
  if (!VERSION_ID_PATTERN.test(versionId)) {
    throw new TypeError("versionId must be a safe release path segment");
  }
  const outputRoot = await assertCanonicalReleaseRoot(
    options.outputRoot ?? path.resolve(repoRoot, "..", "release", "Platform"),
    repoRoot,
  );
  const finalRoot = path.join(outputRoot, versionId);
  try {
    await lstat(finalRoot);
    throw new Error(`Release destination already exists: ${finalRoot}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const currentGit = options.currentGit ?? await resolveGitMetadata(repoRoot);
  const acceptanceManifestPath = path.resolve(options.acceptanceManifestPath);
  const acceptanceManifest = await readJson(acceptanceManifestPath, "acceptance manifest");
  const acceptance = await validateAcceptanceEvidenceFiles(
    validateAcceptanceForRelease(acceptanceManifest, {
      manifestPath: acceptanceManifestPath,
      currentGit,
    }),
  );
  const imageInventory = await resolveImages({
    imageLockPath: options.imageLockPath,
    ociLayoutRoot: options.ociLayoutRoot,
    currentGit,
  });
  const sourceDateEpoch = Number(options.sourceDateEpoch ?? currentGit.sourceDateEpoch);
  if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch < 0) {
    throw new TypeError("sourceDateEpoch must be a non-negative integer");
  }
  const secretCanaries = Array.isArray(options.secretCanaries) ? options.secretCanaries : [];
  const stagingRoot = path.join(outputRoot, `.${versionId}.staging-${randomUUID()}`);
  await mkdir(stagingRoot, { recursive: false });
  try {
    const webBuilder = dependencies.buildWebPackage ?? buildWebPackage;
    await webBuilder({ repoRoot, stagingRoot, outputRoot, versionId, sourceDateEpoch });
    const releaseManifest = await assembleRelease({
      repoRoot,
      stagingRoot,
      versionId,
      sourceDateEpoch,
      currentGit,
      acceptance,
      imageInventory,
      secretCanaries,
    });
    const postBuildGit = options.currentGit ?? await resolveGitMetadata(repoRoot);
    if (postBuildGit.commit !== currentGit.commit || postBuildGit.dirty !== false) {
      throw new Error("Git source changed while the release was being assembled");
    }
    await rename(stagingRoot, finalRoot);
    return { destination: finalRoot, manifest: releaseManifest };
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

function parseCliOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new TypeError(`Invalid release build argument: ${name ?? ""}`);
    }
    if (options[name.slice(2)] !== undefined) throw new TypeError(`Duplicate release build argument: ${name}`);
    options[name.slice(2)] = value;
  }
  return options;
}

async function runCli() {
  const cli = parseCliOptions(process.argv.slice(2));
  const result = await buildCompletePlatformRelease({
    versionId: cli["version-id"],
    outputRoot: cli["output-root"],
    acceptanceManifestPath: cli["acceptance-manifest"],
    imageLockPath: cli["image-lock"],
    ociLayoutRoot: cli["oci-layout-root"],
    sourceDateEpoch: cli["source-date-epoch"],
    secretCanaries: process.env.PLATFORM_RELEASE_SECRET_CANARIES?.split("\n").filter(Boolean) ?? [],
  });
  process.stdout.write(`${JSON.stringify({
    schemaVersion: RELEASE_SCHEMA_VERSION,
    mode: "build",
    versionId: result.manifest.versionId,
    destination: result.destination,
  }, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
