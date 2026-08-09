import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PLATFORM_CONTAINER_IMAGES } from "../container-image-lock.mjs";
import { allocateLoopbackPorts, runAcceptanceComposeCommand } from "./compose.mjs";
import { validateAcceptanceRunId } from "./manifest.mjs";
import { validateOciImageLayouts } from "./release-build.mjs";

const RELEASE_SCHEMA_VERSION = "neuro-platform-release/v1";
const IMAGE_INVENTORY_SCHEMA_VERSION = "neuro-platform-release-images/v1";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CHECKSUM_PATTERN = /^([0-9a-f]{64})  ([^\r\n]+)$/;
const PLATFORM_SERVICE_IMAGES = new Map([
  ["core-migrate", "core"],
  ["gateway-domain-migrate", "account-api"],
  ["account-domain-migrate", "account-api"],
  ["core", "core"],
  ["account-api", "account-api"],
  ["account-worker", "account-worker"],
  ["worker", "worker"],
  ["executor", "executor"],
  ["web", "web"],
]);

const FIXTURE_IMAGES = {
  postgres: "postgres:16-bookworm@sha256:92620daddcd947f8d5ab5ba66e848702fe443d87fed30c4cea8e389fd78dfc55",
  valkey: "valkey/valkey:8.1-alpine@sha256:94365b275456ae14621001c03556c732b1d93a0cdeacc317d1bdd52eba680885",
  minio: "minio/minio:RELEASE.2025-07-23T15-54-02Z@sha256:d249d1fb6966de4d8ad26c04754b545205ff15a62e4fd19ebd0f26fa5baacbc0",
  minioClient: "minio/mc:RELEASE.2025-07-21T05-28-08Z@sha256:fb8f773eac8ef9d6da0486d5dec2f42f219358bcb8de579d1623d518c9ebd4cc",
  node: "node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436",
};

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isContainedPath(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function normalizeReleasePath(value, label) {
  if (typeof value !== "string" || !value || value.includes("\\")) {
    throw new Error(`${label} must be a non-empty portable relative path`);
  }
  const normalized = path.posix.normalize(value);
  if (
    normalized !== value
    || normalized === "."
    || normalized.startsWith("../")
    || path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`${label} must stay inside the release package`);
  }
  return normalized;
}

async function writeAtomic(outputPath, contents, mode = 0o600) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", mode });
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label} at ${filePath}: ${error.message}`, { cause: error });
  }
}

async function listPackageFiles(root) {
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Release package may not contain symlinks: ${absolutePath}`);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile()) files.push(absolutePath);
      else throw new Error(`Release package contains unsupported filesystem content: ${absolutePath}`);
    }
  }
  await visit(root);
  return files;
}

export async function verifyReleaseChecksums(packageDir, checksumRelativePath = "checksums.sha256") {
  const resolvedPackageDir = path.resolve(packageDir);
  const safeChecksumPath = normalizeReleasePath(checksumRelativePath, "Release checksum path");
  const checksumPath = path.join(resolvedPackageDir, ...safeChecksumPath.split("/"));
  const lines = (await readFile(checksumPath, "ascii")).split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error("Release checksum inventory is empty");

  const expected = new Map();
  for (const line of lines) {
    const match = CHECKSUM_PATTERN.exec(line);
    if (!match) throw new Error(`Invalid release checksum entry: ${line}`);
    const relativePath = normalizeReleasePath(match[2], "Release checksum entry path");
    if (relativePath === safeChecksumPath) {
      throw new Error("Release checksum inventory may not checksum itself");
    }
    if (expected.has(relativePath)) throw new Error(`Duplicate release checksum entry: ${relativePath}`);
    expected.set(relativePath, match[1]);
  }

  const actualFiles = (await listPackageFiles(resolvedPackageDir))
    .map((filePath) => path.relative(resolvedPackageDir, filePath).replaceAll("\\", "/"))
    .filter((relativePath) => relativePath !== safeChecksumPath)
    .sort((left, right) => left.localeCompare(right, "en"));
  const expectedFiles = [...expected.keys()].sort((left, right) => left.localeCompare(right, "en"));
  if (actualFiles.join("\n") !== expectedFiles.join("\n")) {
    throw new Error("Release checksum inventory does not exactly cover the package files");
  }

  for (const [relativePath, expectedDigest] of expected) {
    const absolutePath = path.join(resolvedPackageDir, ...relativePath.split("/"));
    if (!isContainedPath(resolvedPackageDir, absolutePath)) {
      throw new Error(`Release checksum entry escapes the package: ${relativePath}`);
    }
    const actualDigest = createHash("sha256").update(await readFile(absolutePath)).digest("hex");
    if (actualDigest !== expectedDigest) {
      throw new Error(`Release checksum mismatch: ${relativePath}`);
    }
  }
  return { checksumPath, fileCount: expected.size };
}

function extractServiceBlocks(composeText) {
  const lines = composeText.split(/\r?\n/);
  const services = new Map();
  let inServices = false;
  let current = null;
  for (const line of lines) {
    if (/^services:\s*(?:#.*)?$/.test(line)) {
      inServices = true;
      current = null;
      continue;
    }
    if (inServices && /^\S/.test(line) && line.trim()) break;
    if (!inServices) continue;
    const serviceMatch = /^  ([a-zA-Z0-9_.-]+):\s*(?:#.*)?$/.exec(line);
    if (serviceMatch) {
      current = serviceMatch[1];
      services.set(current, []);
      continue;
    }
    if (current) services.get(current).push(line);
  }
  return services;
}

function unquoteYamlScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return JSON.parse(trimmed);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replaceAll("''", "'");
  return trimmed.replace(/\s+#.*$/, "").trim();
}

export function validateArtifactOnlyCompose(composeText, imageInventory) {
  if (typeof composeText !== "string" || !composeText.trim()) {
    throw new TypeError("Release Compose content is required");
  }
  for (const pattern of [
    /^\s*build\s*:/m,
    /^\s*context\s*:/m,
    /^\s*dockerfile\s*:/m,
    /^\s*type\s*:\s*bind\b/im,
    /^\s*develop\s*:/m,
    /^\s*extends\s*:/m,
    /^include\s*:/m,
  ]) {
    if (pattern.test(composeText)) {
      throw new Error("Release Compose may not contain source builds, bind mounts, or develop watches");
    }
  }

  const inventory = requireObject(imageInventory, "Release image inventory");
  if (inventory.schemaVersion !== IMAGE_INVENTORY_SCHEMA_VERSION) {
    throw new Error("Release image inventory schema is unsupported");
  }
  if (!['fixed-digest', 'oci-layout'].includes(inventory.mode)) {
    throw new Error("Release image inventory mode is unsupported");
  }
  if (inventory.platform !== "linux/amd64") {
    throw new Error("Release image inventory must target linux/amd64");
  }
  if (!Array.isArray(inventory.images) || inventory.images.length !== PLATFORM_CONTAINER_IMAGES.length) {
    throw new Error("Release image inventory must contain all six Platform images");
  }
  const images = new Map();
  for (const image of inventory.images) {
    requireObject(image, "Release image entry");
    if (!PLATFORM_CONTAINER_IMAGES.includes(image.image) || images.has(image.image)) {
      throw new Error(`Unknown or duplicate Platform image: ${image.image ?? ""}`);
    }
    if (!DIGEST_PATTERN.test(String(image.digest ?? ""))) {
      throw new Error(`Platform image ${image.image} does not have an immutable digest`);
    }
    if (image.immutableReference !== `${image.reference}@${image.digest}`) {
      throw new Error(`Platform image ${image.image} immutable reference is inconsistent`);
    }
    images.set(image.image, image);
  }
  if (PLATFORM_CONTAINER_IMAGES.some((image) => !images.has(image))) {
    throw new Error("Release image inventory is incomplete");
  }

  const services = extractServiceBlocks(composeText);
  const expectedServices = [...PLATFORM_SERVICE_IMAGES.keys()].sort();
  const actualServices = [...services.keys()].sort();
  if (actualServices.join("\n") !== expectedServices.join("\n")) {
    throw new Error("Release Compose must contain exactly the artifact-only Platform services");
  }
  for (const [service, block] of services) {
    if (block.some((line) => /^    volumes\s*:/.test(line))) {
      throw new Error(`Release Compose service ${service} may not mount release or source files`);
    }
  }
  for (const [service, imageName] of PLATFORM_SERVICE_IMAGES) {
    const block = services.get(service);
    if (!block) throw new Error(`Release Compose is missing Platform service ${service}`);
    const imageLines = block.filter((line) => /^    image\s*:/.test(line));
    if (imageLines.length !== 1) throw new Error(`Release Compose service ${service} must declare exactly one image`);
    const imageReference = unquoteYamlScalar(imageLines[0].replace(/^    image\s*:\s*/, ""));
    if (imageReference !== images.get(imageName).immutableReference) {
      throw new Error(`Release Compose service ${service} does not use its declared immutable image`);
    }
  }
  return { mode: inventory.mode, images, services };
}

export async function inspectCompleteRelease(packageDir) {
  if (typeof packageDir !== "string" || !packageDir.trim()) {
    throw new TypeError("packageDir is required");
  }
  const resolvedPackageDir = path.resolve(packageDir);
  const packageStat = await lstat(resolvedPackageDir);
  if (!packageStat.isDirectory() || packageStat.isSymbolicLink()) {
    throw new Error("Release package must be a real directory, not a symlink");
  }

  const manifestPath = path.join(resolvedPackageDir, "release-manifest.json");
  const manifest = requireObject(await readJson(manifestPath, "release manifest"), "Release manifest");
  if (manifest.schemaVersion !== RELEASE_SCHEMA_VERSION || manifest.product !== "Platform") {
    throw new Error("Release manifest schema or product is unsupported");
  }
  if (typeof manifest.versionId !== "string" || !manifest.versionId) {
    throw new Error("Release manifest versionId is required");
  }
  if (manifest.source?.dirty !== false || !/^[0-9a-f]{40}$/i.test(String(manifest.source?.revision ?? ""))) {
    throw new Error("Release manifest requires clean Git provenance");
  }

  const checksum = await verifyReleaseChecksums(resolvedPackageDir, manifest.checksums);
  const inventoryRelativePath = normalizeReleasePath(manifest.images?.inventory, "Image inventory path");
  const composeRelativePath = normalizeReleasePath(manifest.deployment?.compose, "Release Compose path");
  const inventoryPath = path.join(resolvedPackageDir, ...inventoryRelativePath.split("/"));
  const composePath = path.join(resolvedPackageDir, ...composeRelativePath.split("/"));
  const imageInventory = await readJson(inventoryPath, "release image inventory");
  const composeText = await readFile(composePath, "utf8");
  const composeContract = validateArtifactOnlyCompose(composeText, imageInventory);
  if (
    manifest.images.mode !== imageInventory.mode
    || manifest.images.count !== imageInventory.images.length
    || manifest.images.platform !== imageInventory.platform
  ) {
    throw new Error("Release manifest image summary does not match its inventory");
  }
  if (imageInventory.mode === "oci-layout") {
    const layouts = await validateOciImageLayouts(path.join(resolvedPackageDir, "oci"));
    for (const layout of layouts) {
      const inventoryImage = composeContract.images.get(layout.image);
      if (layout.digest !== inventoryImage.digest) {
        throw new Error(`Packaged OCI layout digest does not match inventory: ${layout.image}`);
      }
    }
  }
  return {
    packageDir: resolvedPackageDir,
    manifestPath,
    manifest,
    checksum,
    composePath,
    composeText,
    imageInventory,
  };
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function temporaryImageReference(runKey, image) {
  return `neuro-platform-release-smoke-${runKey}/${image}:artifact`;
}

export function createReleaseRuntimeOverride({ runId, runKey, imageInventory }) {
  const labels = [
    "    labels:",
    `      com.neuro.platform.release-smoke.run-id: ${yamlString(runId)}`,
    "      com.neuro.platform.release-smoke.owner: platform",
  ];
  const healthcheck = (port) => [
    "    healthcheck:",
    `      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:${port}/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]`,
    "      interval: 2s",
    "      timeout: 5s",
    "      retries: 60",
    "      start_period: 10s",
  ];
  const inventoryImages = new Map(imageInventory.images.map((image) => [image.image, image]));
  const runtimeImage = (image) => imageInventory.mode === "oci-layout"
    ? temporaryImageReference(runKey, image)
    : inventoryImages.get(image).immutableReference;
  const platformService = (service, image, port = null) => [
    `  ${service}:`,
    `    image: ${yamlString(runtimeImage(image))}`,
    ...(imageInventory.mode === "oci-layout" ? ["    pull_policy: never"] : []),
    ...labels,
    ...(port ? healthcheck(port) : []),
  ];
  const gatewayProgram = [
    "const http=require('node:http');",
    "const server=http.createServer((req,res)=>{",
    "res.setHeader('content-type','application/json');",
    "if(req.url==='/ready'||req.url==='/healthz'){res.end(JSON.stringify({ok:true,ready:true,service:'gateway-fixture'}));return;}",
    "if(req.url==='/v1/models'){res.end(JSON.stringify({object:'list',data:[]}));return;}",
    "res.statusCode=404;res.end(JSON.stringify({error:{message:'fixture route not found'}}));",
    "});server.listen(4200,'0.0.0.0');",
  ].join("");

  return `${[
    "services:",
    "  postgres:",
    `    image: ${yamlString(FIXTURE_IMAGES.postgres)}`,
    ...labels,
    "    environment:",
    "      POSTGRES_DB: neuroloom",
    "      POSTGRES_USER: neuroloom",
    "      POSTGRES_PASSWORD: ${RELEASE_POSTGRES_PASSWORD:?RELEASE_POSTGRES_PASSWORD is required}",
    "    volumes:",
    "      - release-postgres:/var/lib/postgresql/data",
    "    healthcheck:",
    "      test: [\"CMD-SHELL\", \"pg_isready -U neuroloom -d neuroloom\"]",
    "      interval: 2s",
    "      timeout: 5s",
    "      retries: 30",
    "  valkey:",
    `    image: ${yamlString(FIXTURE_IMAGES.valkey)}`,
    ...labels,
    "    command: [\"valkey-server\", \"--save\", \"\", \"--appendonly\", \"no\"]",
    "    volumes:",
    "      - release-valkey:/data",
    "    healthcheck:",
    "      test: [\"CMD\", \"valkey-cli\", \"ping\"]",
    "      interval: 2s",
    "      timeout: 5s",
    "      retries: 30",
    "  minio:",
    `    image: ${yamlString(FIXTURE_IMAGES.minio)}`,
    ...labels,
    "    command: [\"server\", \"/data\"]",
    "    environment:",
    "      MINIO_ROOT_USER: neuroloom-release",
    "      MINIO_ROOT_PASSWORD: ${RELEASE_MINIO_PASSWORD:?RELEASE_MINIO_PASSWORD is required}",
    "    volumes:",
    "      - release-minio:/data",
    "    healthcheck:",
    "      test: [\"CMD\", \"curl\", \"-f\", \"http://127.0.0.1:9000/minio/health/live\"]",
    "      interval: 2s",
    "      timeout: 5s",
    "      retries: 30",
    "  minio-init:",
    `    image: ${yamlString(FIXTURE_IMAGES.minioClient)}`,
    ...labels,
    "    depends_on:",
    "      minio:",
    "        condition: service_healthy",
    "    environment:",
    "      MINIO_ROOT_USER: neuroloom-release",
    "      MINIO_ROOT_PASSWORD: ${RELEASE_MINIO_PASSWORD:?RELEASE_MINIO_PASSWORD is required}",
    "    entrypoint: [\"/bin/sh\", \"-c\"]",
    "    command: [\"mc alias set local http://minio:9000 \\\"$$MINIO_ROOT_USER\\\" \\\"$$MINIO_ROOT_PASSWORD\\\" && mc mb --ignore-existing local/neuroloom-release\"]",
    "  gateway:",
    `    image: ${yamlString(FIXTURE_IMAGES.node)}`,
    ...labels,
    `    command: ["node", "-e", ${yamlString(gatewayProgram)}]`,
    ...healthcheck(4200),
    ...platformService("core-migrate", "core"),
    "    depends_on:",
    "      postgres:",
    "        condition: service_healthy",
    "      valkey:",
    "        condition: service_healthy",
    "      minio-init:",
    "        condition: service_completed_successfully",
    ...platformService("gateway-domain-migrate", "account-api"),
    "    depends_on:",
    "      core-migrate:",
    "        condition: service_completed_successfully",
    "      postgres:",
    "        condition: service_healthy",
    ...platformService("account-domain-migrate", "account-api"),
    "    depends_on:",
    "      gateway-domain-migrate:",
    "        condition: service_completed_successfully",
    ...platformService("core", "core", 4000),
    ...platformService("account-api", "account-api", 4000),
    ...platformService("account-worker", "account-worker", 7303),
    ...platformService("worker", "worker", 7301),
    ...platformService("executor", "executor", 7302),
    ...platformService("web", "web", 3000),
    "volumes:",
    "  release-postgres:",
    "    name: ${RELEASE_POSTGRES_VOLUME_NAME:?RELEASE_POSTGRES_VOLUME_NAME is required}",
    "  release-valkey:",
    "    name: ${RELEASE_VALKEY_VOLUME_NAME:?RELEASE_VALKEY_VOLUME_NAME is required}",
    "  release-minio:",
    "    name: ${RELEASE_MINIO_VOLUME_NAME:?RELEASE_MINIO_VOLUME_NAME is required}",
    "",
  ].join("\n")}`;
}

function secretHex() {
  return randomBytes(32).toString("hex");
}

function serializeEnvironment(values) {
  return `${Object.entries(values).map(([name, value]) => `${name}=${value}`).join("\n")}\n`;
}

function createRuntimeEnvironment({ projectName, runtimeEnvPath, ports, volumeNames }) {
  const databasePassword = secretHex();
  const minioPassword = secretHex();
  const webUrl = `http://127.0.0.1:${ports.web}`;
  return {
    PLATFORM_RUNTIME_ENV_FILE: runtimeEnvPath.replaceAll("\\", "/"),
    CORE_HOST_PORT: ports.core,
    ACCOUNT_API_HOST_PORT: ports.accountApi,
    WEB_HOST_PORT: ports.web,
    RELEASE_POSTGRES_PASSWORD: databasePassword,
    RELEASE_MINIO_PASSWORD: minioPassword,
    RELEASE_POSTGRES_VOLUME_NAME: volumeNames.postgres,
    RELEASE_VALKEY_VOLUME_NAME: volumeNames.valkey,
    RELEASE_MINIO_VOLUME_NAME: volumeNames.minio,
    DATABASE_URL: `postgres://neuroloom:${databasePassword}@postgres:5432/neuroloom`,
    ACCOUNT_DATABASE_URL: `postgres://neuroloom:${databasePassword}@postgres:5432/neuroloom`,
    REDIS_URL: "redis://valkey:6379",
    ACCOUNT_REDIS_URL: "redis://valkey:6379",
    CORE_PUBLIC_BASE_URL: `http://127.0.0.1:${ports.core}`,
    CORE_INTERNAL_URL: "http://core:4000",
    PLATFORM_INTERNAL_URL: "http://core:4000",
    ACCOUNT_INTERNAL_URL: "http://account-api:4000",
    ACCOUNT_WORKER_INTERNAL_URL: "http://account-worker:7303",
    AI_GATEWAY_INTERNAL_URL: "http://gateway:4200",
    AI_GATEWAY_PUBLIC_BASE_URL: "http://gateway:4200",
    AI_GATEWAY_COMPATIBILITY_BASE_URL: "http://gateway:4200/v1/new-api",
    BENEFIT_SERVICE_API_PUBLIC_BASE_URL: "http://gateway:4200/v1",
    TEA_SERVER_URL: "http://gateway:4200",
    INTERNAL_API_TOKEN: secretHex(),
    AI_GATEWAY_MANAGEMENT_TOKEN: secretHex(),
    AI_GATEWAY_API_KEY_SECRET: secretHex(),
    BENEFIT_SERVICE_API_KEY_SECRET: secretHex(),
    TEA_AUTH_TOKEN: secretHex(),
    OAUTH_CLIENT_ID: `release-smoke-${projectName}`,
    OAUTH_CLIENT_SECRET: secretHex(),
    NEXTAUTH_SECRET: secretHex(),
    NEXTAUTH_URL: webUrl,
    NEXT_PUBLIC_APP_URL: webUrl,
    PLATFORM_ALLOWED_ORIGINS: webUrl,
    PLATFORM_OPERATOR_USER_IDS: "release-smoke-operator",
    OBJECT_STORAGE_DRIVER: "s3-compatible",
    OBJECT_STORAGE_BUCKET: "neuroloom-release",
    OBJECT_STORAGE_REGION: "us-east-1",
    OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
    OBJECT_STORAGE_ACCESS_KEY_ID: "neuroloom-release",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: minioPassword,
    OBJECT_STORAGE_FORCE_PATH_STYLE: "true",
    S3_PUBLIC_BASE_URL: "http://minio:9000/neuroloom-release",
    ARBITRATION_EVIDENCE_REMOTE_UPLOAD_STRATEGY: "prepared_remote_put",
    ACCOUNT_EMAIL_DELIVERY_MODE: "console",
    ACCOUNT_EMAIL_CONSOLE_EXPOSE_VERIFICATION_CODE: "false",
    HEAVY_CHAT_GATEWAY_MODEL: "release-smoke",
    DEV_AUTH_BYPASS_ENABLED: "false",
    COMPOSE_PROJECT_NAME: projectName,
  };
}

function ociLayoutUri(layoutPath, digest) {
  let normalized = path.resolve(layoutPath).replaceAll("\\", "/");
  if (/^[A-Za-z]:\//.test(normalized)) normalized = `/${normalized}`;
  return `oci-layout://${normalized}@${digest}`;
}

async function waitForProbe({ fetchImpl, url, validate, timeoutMs = 180_000 }) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(5_000) });
      const text = await response.text();
      if (response.ok && validate(response, text)) {
        return { url, status: response.status, durationMs: Date.now() - startedAt };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Release runtime probe failed for ${url}: ${lastError ?? "timeout"}`);
}

function commandSummary(result) {
  return {
    exitCode: result?.exitCode ?? null,
    durationMs: result?.durationMs ?? null,
    timedOut: result?.timedOut ?? false,
    error: result?.error ? "command reported an error" : null,
  };
}

async function requireCommand(executeCommand, input, label) {
  const result = await executeCommand(input);
  if (!result || result.exitCode !== 0) {
    throw new Error(`${label} failed (${result?.exitCode ?? "unknown"})`);
  }
  return result;
}

async function removeOwnedResources(resourcesDir, evidencePath) {
  const evidenceDirectory = path.dirname(path.resolve(evidencePath));
  if (!isContainedPath(evidenceDirectory, resourcesDir) || comparablePath(resourcesDir) === comparablePath(evidenceDirectory)) {
    throw new Error("Release smoke resources directory is outside its evidence boundary");
  }
  const resourcesStat = await lstat(resourcesDir);
  if (!resourcesStat.isDirectory() || resourcesStat.isSymbolicLink()) {
    throw new Error("Release smoke resources directory is no longer an owned real directory");
  }
  await rm(resourcesDir, { recursive: true });
}

export async function runArtifactOnlyReleaseSmoke(options, dependencies = {}) {
  const safeRunId = validateAcceptanceRunId(options?.runId);
  const evidencePath = path.resolve(options.evidencePath);
  if (path.extname(evidencePath).toLowerCase() !== ".json") {
    throw new Error("Release smoke evidencePath must be a JSON file");
  }
  const release = await inspectCompleteRelease(options.packageDir);
  if (isContainedPath(release.packageDir, evidencePath)) {
    throw new Error("Release smoke evidence must be written outside the immutable package");
  }

  const runKey = createHash("sha256")
    .update(`${safeRunId}\0${comparablePath(release.packageDir)}`)
    .digest("hex")
    .slice(0, 16);
  const projectName = `platform-release-${runKey}`;
  const resourcesDir = path.join(path.dirname(evidencePath), `${safeRunId}-release-resources`);
  const runtimeEnvPath = path.join(resourcesDir, "runtime.env");
  const overridePath = path.join(resourcesDir, "docker-compose.override.yml");
  const ownerPath = path.join(resourcesDir, "owner.json");
  const importContext = path.join(resourcesDir, "oci-import");
  const allocatePorts = dependencies.allocatePorts ?? allocateLoopbackPorts;
  const executeCommand = dependencies.executeCommand ?? runAcceptanceComposeCommand;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const [corePort, accountApiPort, webPort] = await allocatePorts(3);
  const ports = { core: corePort, accountApi: accountApiPort, web: webPort };
  const volumeNames = {
    postgres: `${projectName}-postgres`,
    valkey: `${projectName}-valkey`,
    minio: `${projectName}-minio`,
  };
  const environment = createRuntimeEnvironment({ projectName, runtimeEnvPath, ports, volumeNames });
  const override = createReleaseRuntimeOverride({
    runId: safeRunId,
    runKey,
    imageInventory: release.imageInventory,
  });
  const owner = {
    schemaVersion: 1,
    runId: safeRunId,
    projectName,
    packageDir: release.packageDir,
    composeFile: release.composePath,
    overrideFile: overridePath,
    runtimeEnvFile: runtimeEnvPath,
    resourcesDir,
    volumeNames,
    ports,
    createdAt: new Date().toISOString(),
  };
  const importedImages = release.imageInventory.mode === "oci-layout"
    ? PLATFORM_CONTAINER_IMAGES.map((image) => temporaryImageReference(runKey, image))
    : [];
  const baseArgs = [
    "compose",
    "-p",
    projectName,
    "--env-file",
    runtimeEnvPath,
    "-f",
    release.composePath,
    "-f",
    overridePath,
  ];
  const evidence = {
    schemaVersion: "neuro-platform-release-smoke/v1",
    runId: safeRunId,
    projectName,
    package: {
      versionId: release.manifest.versionId,
      revision: release.manifest.source.revision,
      imageMode: release.imageInventory.mode,
      checksumFileCount: release.checksum.fileCount,
    },
    ports,
    status: "failed",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    commands: { imports: [], up: null, ps: null, down: null, imageCleanup: [] },
    probes: [],
    cleanup: { completed: false },
    failure: null,
  };
  let primaryError = null;

  await mkdir(path.dirname(resourcesDir), { recursive: true });
  await mkdir(resourcesDir, { recursive: false });
  try {
    await Promise.all([
      writeAtomic(runtimeEnvPath, serializeEnvironment(environment)),
      writeAtomic(overridePath, override),
      writeAtomic(ownerPath, `${JSON.stringify(owner, null, 2)}\n`),
    ]);
    if (release.imageInventory.mode === "oci-layout") {
      await mkdir(importContext, { recursive: true });
      const dockerfilePath = path.join(importContext, "Dockerfile");
      await writeFile(dockerfilePath, "FROM artifact\n", "ascii");
      for (const image of release.imageInventory.images) {
        const result = await requireCommand(executeCommand, {
          command: "docker",
          args: [
            "buildx",
            "build",
            "--build-context",
            `artifact=${ociLayoutUri(path.join(release.packageDir, image.layoutPath), image.digest)}`,
            "--file",
            dockerfilePath,
            "--load",
            "--tag",
            temporaryImageReference(runKey, image.image),
            importContext,
          ],
          cwd: resourcesDir,
          env: process.env,
          timeoutMs: 15 * 60 * 1000,
        }, `OCI import for ${image.image}`);
        evidence.commands.imports.push({ image: image.image, ...commandSummary(result) });
      }
    }

    const upResult = await requireCommand(executeCommand, {
      command: "docker",
      args: [...baseArgs, "up", "--detach", "--wait", "--wait-timeout", "900"],
      cwd: resourcesDir,
      env: { ...process.env, ...environment },
      timeoutMs: 20 * 60 * 1000,
    }, "Artifact-only release startup");
    evidence.commands.up = commandSummary(upResult);

    const probes = [
      [`http://127.0.0.1:${ports.core}/ready`, (_response, text) => {
        const value = JSON.parse(text);
        return value?.ok === true && value?.ready === true && value?.service === "core";
      }],
      [`http://127.0.0.1:${ports.accountApi}/ready`, (_response, text) => {
        const value = JSON.parse(text);
        return value?.ok === true && value?.ready === true && value?.service === "account-api";
      }],
      [`http://127.0.0.1:${ports.web}/ready`, (_response, text) => {
        const value = JSON.parse(text);
        return value?.ok === true && value?.ready === true && value?.service === "web";
      }],
      [`http://127.0.0.1:${ports.web}/`, (_response, text) => text.includes("Linux.do")],
    ];
    for (const [url, validate] of probes) {
      evidence.probes.push(await waitForProbe({ fetchImpl, url, validate }));
    }

    const psResult = await requireCommand(executeCommand, {
      command: "docker",
      args: [...baseArgs, "ps", "--format", "json"],
      cwd: resourcesDir,
      env: { ...process.env, ...environment },
      timeoutMs: 2 * 60 * 1000,
    }, "Artifact-only release process inventory");
    evidence.commands.ps = commandSummary(psResult);
    evidence.status = "passed";
  } catch (error) {
    primaryError = error;
    evidence.failure = error instanceof Error ? error.message : String(error);
  } finally {
    try {
      const downResult = await requireCommand(executeCommand, {
        command: "docker",
        args: [...baseArgs, "down", "--volumes", "--remove-orphans"],
        cwd: resourcesDir,
        env: { ...process.env, ...environment },
        timeoutMs: 5 * 60 * 1000,
      }, "Artifact-only release cleanup");
      evidence.commands.down = commandSummary(downResult);
      for (const image of importedImages) {
        const result = await requireCommand(executeCommand, {
          command: "docker",
          args: ["image", "rm", image],
          cwd: resourcesDir,
          env: process.env,
          timeoutMs: 2 * 60 * 1000,
        }, `Temporary OCI image cleanup for ${image}`);
        evidence.commands.imageCleanup.push({ image, ...commandSummary(result) });
      }
      evidence.cleanup.completed = true;
      await removeOwnedResources(resourcesDir, evidencePath);
    } catch (error) {
      if (!primaryError) primaryError = error;
      evidence.status = "failed";
      evidence.failure ??= error instanceof Error ? error.message : String(error);
    }
    evidence.finishedAt = new Date().toISOString();
    await writeAtomic(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  }

  if (primaryError) throw primaryError;
  return { evidencePath, evidence };
}

function parseCliOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new TypeError(`Invalid release smoke argument: ${name ?? ""}`);
    }
    if (options[name.slice(2)] !== undefined) throw new TypeError(`Duplicate release smoke argument: ${name}`);
    options[name.slice(2)] = value;
  }
  return options;
}

async function runCli() {
  const cli = parseCliOptions(process.argv.slice(2));
  const result = await runArtifactOnlyReleaseSmoke({
    packageDir: cli["package-dir"],
    runId: cli["run-id"],
    evidencePath: cli["evidence-path"],
  });
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "neuro-platform-release-smoke/v1",
    mode: "smoke",
    runId: result.evidence.runId,
    status: result.evidence.status,
    evidencePath: result.evidencePath,
  }, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
