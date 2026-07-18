import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateAcceptanceRunId } from "./manifest.mjs";

export const HOST_PORT_VARIABLES = [
  "POSTGRES_HOST_PORT",
  "VALKEY_HOST_PORT",
  "MINIO_API_HOST_PORT",
  "MINIO_CONSOLE_HOST_PORT",
  "CORE_HOST_PORT",
  "ACCOUNT_API_HOST_PORT",
  "GATEWAY_HOST_PORT",
  "LOOM_HOST_PORT",
  "TEA_HOST_PORT",
  "WEB_HOST_PORT",
];

const VOLUME_ENVIRONMENT_VARIABLES = {
  POSTGRES_VOLUME_NAME: "postgres",
  VALKEY_VOLUME_NAME: "valkey",
  MINIO_VOLUME_NAME: "minio",
  TEA_VOLUME_NAME: "tea",
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultPlatformRoot = path.resolve(moduleDir, "../..");

function assertInside(parentPath, childPath, label) {
  const relative = path.relative(parentPath, childPath);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} must be inside ${parentPath}`);
  }
}

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function pathsEqual(left, right) {
  return comparablePath(left) === comparablePath(right);
}

function secretHex() {
  return randomBytes(32).toString("hex");
}

async function writeAtomic(outputPath, contents) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, outputPath);
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function allocateLoopbackPorts(count) {
  if (!Number.isInteger(count) || count < 1) {
    throw new TypeError("Port allocation count must be a positive integer");
  }

  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = net.createServer();
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      servers.push(server);
    }

    return servers.map((server) => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Unable to resolve allocated loopback port");
      }
      return address.port;
    });
  } finally {
    await Promise.all(servers.map((server) => closeServer(server)));
  }
}

function validatePorts(values) {
  if (!Array.isArray(values) || values.length !== HOST_PORT_VARIABLES.length) {
    throw new Error(`Acceptance port allocator must return ${HOST_PORT_VARIABLES.length} ports`);
  }
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      throw new Error(`Invalid acceptance host port: ${value}`);
    }
  }
  if (new Set(values).size !== values.length) {
    throw new Error("Acceptance host ports must be unique");
  }
  return Object.fromEntries(HOST_PORT_VARIABLES.map((name, index) => [name, values[index]]));
}

function createVolumeNames(runId) {
  return {
    postgres: `${runId}-postgres-data`,
    valkey: `${runId}-valkey-data`,
    minio: `${runId}-minio-data`,
    tea: `${runId}-tea-data`,
  };
}

function buildEnvironmentValues({ runId, projectName, paths, ports, volumeNames }) {
  const internalApiToken = secretHex();
  const postgresPassword = secretHex();
  const minioRootPassword = secretHex();
  return {
    PLATFORM_ACCEPTANCE_RUN_ID: runId,
    COMPOSE_PROJECT_NAME: projectName,
    ACCEPTANCE_NETWORK_NAME: `${runId}-network`,
    ACCEPTANCE_CREDENTIAL_ROOT: paths.credentialsRoot.replaceAll("\\", "/"),
    POSTGRES_DB: "neuroloom",
    POSTGRES_USER: "neuroloom",
    POSTGRES_PASSWORD: postgresPassword,
    DATABASE_URL: `postgres://neuroloom:${postgresPassword}@postgres:5432/neuroloom`,
    REDIS_URL: "redis://valkey:6379",
    MINIO_ROOT_USER: "neuroloom-acceptance",
    MINIO_ROOT_PASSWORD: minioRootPassword,
    OBJECT_STORAGE_BUCKET: "neuroloom-acceptance",
    INTERNAL_API_TOKEN: internalApiToken,
    GATEWAY_MANAGEMENT_TOKEN: secretHex(),
    GATEWAY_PROJECT_TOKEN: secretHex(),
    NEXTAUTH_SECRET: secretHex(),
    OAUTH_CLIENT_ID: `acceptance-${runId}`,
    OAUTH_CLIENT_SECRET: secretHex(),
    BENEFIT_SERVICE_API_KEY_SECRET: secretHex(),
    TEA_AUTH_TOKEN: secretHex(),
    LOOM_AUTH_TOKEN: secretHex(),
    POSTGRES_VOLUME_NAME: volumeNames.postgres,
    VALKEY_VOLUME_NAME: volumeNames.valkey,
    MINIO_VOLUME_NAME: volumeNames.minio,
    TEA_VOLUME_NAME: volumeNames.tea,
    ...ports,
  };
}

function serializeEnvironment(values) {
  return `${Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n")}\n`;
}

function parseEnvironment(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("Invalid acceptance environment file");
    const name = line.slice(0, separator);
    if (Object.hasOwn(values, name)) throw new Error(`Duplicate acceptance environment variable: ${name}`);
    values[name] = line.slice(separator + 1);
  }
  return values;
}

export async function createAcceptanceEnvironment({
  runId,
  evidenceDir,
  platformRoot = defaultPlatformRoot,
  // Tests may inject an isolated runtime root; production callers use the Platform-local default.
  runtimeRoot,
  allocatePorts = allocateLoopbackPorts,
} = {}) {
  const safeRunId = validateAcceptanceRunId(runId);
  if (typeof evidenceDir !== "string" || !evidenceDir.trim()) {
    throw new TypeError("Acceptance evidenceDir is required");
  }

  const resolvedPlatformRoot = path.resolve(platformRoot);
  const resolvedEvidenceDir = path.resolve(evidenceDir);
  const resolvedRuntimeRoot = path.resolve(
    runtimeRoot || path.join(resolvedPlatformRoot, ".runtime", "acceptance"),
  );
  const composeFile = path.join(resolvedPlatformRoot, "deploy", "acceptance", "docker-compose.acceptance.yml");
  assertInside(resolvedPlatformRoot, composeFile, "Acceptance Compose file");

  const resourcesDir = path.join(resolvedRuntimeRoot, safeRunId, "resources");
  const credentialsRoot = path.join(resourcesDir, "credentials");
  const paths = {
    platformRoot: resolvedPlatformRoot,
    evidenceDir: resolvedEvidenceDir,
    resourcesDir,
    credentialsRoot,
    envFile: path.join(resourcesDir, "acceptance.env"),
    ownerFile: path.join(resourcesDir, "owner.json"),
    composeFile,
  };
  assertInside(resolvedRuntimeRoot, resourcesDir, "Acceptance resources directory");
  const projectName = safeRunId;
  const volumeNames = createVolumeNames(safeRunId);

  await mkdir(resolvedEvidenceDir, { recursive: true });
  await mkdir(path.dirname(resourcesDir), { recursive: true });
  await mkdir(resourcesDir);
  try {
    await Promise.all(
      ["gateway", "loom", "tea"].map((name) => mkdir(path.join(credentialsRoot, name), { recursive: true })),
    );
    const ports = validatePorts(await allocatePorts(HOST_PORT_VARIABLES.length));
    const environmentValues = buildEnvironmentValues({
      runId: safeRunId,
      projectName,
      paths,
      ports,
      volumeNames,
    });
    const owner = {
      schemaVersion: 1,
      runId: safeRunId,
      projectName,
      platformRoot: resolvedPlatformRoot,
      composeFile,
      evidenceDir: resolvedEvidenceDir,
      runtimeRoot: resolvedRuntimeRoot,
      resourcesDir,
      envFile: paths.envFile,
      credentialsRoot,
      networkName: environmentValues.ACCEPTANCE_NETWORK_NAME,
      volumeNames,
      ports,
      createdAt: new Date().toISOString(),
    };

    await Promise.all([
      writeAtomic(paths.envFile, serializeEnvironment(environmentValues)),
      writeAtomic(paths.ownerFile, `${JSON.stringify(owner, null, 2)}\n`),
    ]);

    return {
      runId: safeRunId,
      projectName,
      paths,
      ports,
      volumeNames,
    };
  } catch (error) {
    await rm(resourcesDir, { force: true, recursive: true });
    throw error;
  }
}

export async function runAcceptanceComposeCommand({
  command,
  args,
  cwd,
  env,
  timeoutMs = 120_000,
}) {
  const startedAt = Date.now();
  const result = await new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let stderr = "";
    let stdout = "";
    let child;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve({ ...value, timedOut, stdout, stderr: stderr.trim() || null });
    };

    try {
      child = spawn(command, args, {
        cwd,
        env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      settle({ exitCode: 1, error: error instanceof Error ? error.message : String(error) });
      return;
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (stdout.length < 16_384) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 16_384) stderr += chunk;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } finally {
        settle({ exitCode: 1, error: `Acceptance command timed out after ${timeoutMs}ms` });
      }
    }, Math.max(1, timeoutMs));

    child.once("error", (error) => {
      clearTimeout(timer);
      settle({ exitCode: 1, error: error instanceof Error ? error.message : String(error) });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      settle({ exitCode: code ?? 1, error: stderr.trim() || null });
    });
  });
  return { ...result, durationMs: Date.now() - startedAt };
}

function assertOwnerValue(owner, name, expected, pathValue = false) {
  const actual = owner?.[name];
  const matches = pathValue
    ? typeof actual === "string" && pathsEqual(actual, expected)
    : actual === expected;
  if (!matches) {
    throw new Error(`Foreign acceptance owner: ${name} does not match the requested cleanup project`);
  }
}

function assertOwnerRecord(owner, name, expected) {
  const actual = owner?.[name];
  const expectedEntries = Object.entries(expected);
  const matches =
    actual &&
    typeof actual === "object" &&
    !Array.isArray(actual) &&
    Object.keys(actual).length === expectedEntries.length &&
    expectedEntries.every(([key, value]) => actual[key] === value);
  if (!matches) {
    throw new Error(`Foreign acceptance owner: ${name} does not match the requested cleanup project`);
  }
}

function assertEnvironmentValue(environment, name, expected, pathValue = false) {
  const actual = environment[name];
  const matches = pathValue
    ? typeof actual === "string" && pathsEqual(actual, expected)
    : actual === expected;
  if (!matches) {
    throw new Error(`Foreign acceptance environment: ${name} does not match its owner`);
  }
}

export async function cleanupAcceptanceProject({
  runId,
  evidenceDir,
  projectName = runId,
  platformRoot = defaultPlatformRoot,
  runtimeRoot,
  executeCommand = runAcceptanceComposeCommand,
  commandTimeoutMs = 120_000,
} = {}) {
  const safeRunId = validateAcceptanceRunId(runId);
  validateAcceptanceRunId(projectName);
  if (typeof evidenceDir !== "string" || !evidenceDir.trim()) {
    throw new TypeError("Acceptance evidenceDir is required");
  }

  const resolvedPlatformRoot = path.resolve(platformRoot);
  const resolvedEvidenceDir = path.resolve(evidenceDir);
  const resolvedRuntimeRoot = path.resolve(
    runtimeRoot || path.join(resolvedPlatformRoot, ".runtime", "acceptance"),
  );
  const resourcesDir = path.join(resolvedRuntimeRoot, safeRunId, "resources");
  const credentialsRoot = path.join(resourcesDir, "credentials");
  const envFile = path.join(resourcesDir, "acceptance.env");
  const ownerFile = path.join(resourcesDir, "owner.json");
  const composeFile = path.join(resolvedPlatformRoot, "deploy", "acceptance", "docker-compose.acceptance.yml");
  assertInside(resolvedRuntimeRoot, resourcesDir, "Acceptance resources directory");
  assertInside(resolvedPlatformRoot, composeFile, "Acceptance Compose file");

  const [ownerContents, environmentContents] = await Promise.all([
    readFile(ownerFile, "utf8"),
    readFile(envFile, "utf8"),
  ]);
  const owner = JSON.parse(ownerContents);
  assertOwnerValue(owner, "runId", safeRunId);
  assertOwnerValue(owner, "projectName", projectName);
  assertOwnerValue(owner, "platformRoot", resolvedPlatformRoot, true);
  assertOwnerValue(owner, "composeFile", composeFile, true);
  assertOwnerValue(owner, "evidenceDir", resolvedEvidenceDir, true);
  assertOwnerValue(owner, "runtimeRoot", resolvedRuntimeRoot, true);
  assertOwnerValue(owner, "resourcesDir", resourcesDir, true);
  assertOwnerValue(owner, "envFile", envFile, true);
  assertOwnerValue(owner, "credentialsRoot", credentialsRoot, true);
  assertOwnerValue(owner, "networkName", `${safeRunId}-network`);
  const volumeNames = createVolumeNames(safeRunId);
  assertOwnerRecord(owner, "volumeNames", volumeNames);
  let ports;
  try {
    ports = validatePorts(HOST_PORT_VARIABLES.map((name) => owner?.ports?.[name]));
  } catch {
    throw new Error("Foreign acceptance owner: ports do not match the requested cleanup project");
  }
  assertOwnerRecord(owner, "ports", ports);

  const environment = parseEnvironment(environmentContents);
  assertEnvironmentValue(environment, "PLATFORM_ACCEPTANCE_RUN_ID", safeRunId);
  assertEnvironmentValue(environment, "COMPOSE_PROJECT_NAME", projectName);
  assertEnvironmentValue(environment, "ACCEPTANCE_CREDENTIAL_ROOT", credentialsRoot, true);
  assertEnvironmentValue(environment, "ACCEPTANCE_NETWORK_NAME", owner.networkName);
  for (const [variable, volumeName] of Object.entries(VOLUME_ENVIRONMENT_VARIABLES)) {
    assertEnvironmentValue(environment, variable, volumeNames[volumeName]);
  }
  for (const variable of HOST_PORT_VARIABLES) {
    assertEnvironmentValue(environment, variable, String(ports[variable]));
  }

  const args = [
    "compose",
    "-p",
    projectName,
    "--env-file",
    envFile,
    "-f",
    composeFile,
    "down",
    "--volumes",
    "--remove-orphans",
  ];
  const commandResult = await executeCommand({
    command: "docker",
    args,
    cwd: resolvedPlatformRoot,
    env: { ...process.env, ...environment },
    timeoutMs: commandTimeoutMs,
  });
  if (!commandResult || commandResult.exitCode !== 0) {
    throw new Error(
      `Acceptance Compose cleanup failed with exit code ${commandResult?.exitCode ?? "unknown"}${
        commandResult?.error ? `: ${commandResult.error}` : ""
      }`,
    );
  }

  await rm(resourcesDir, { recursive: true });
  const receiptPath = path.join(resolvedEvidenceDir, "compose-cleanup.json");
  await writeAtomic(
    receiptPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        runId: safeRunId,
        projectName,
        cleaned: true,
        finishedAt: new Date().toISOString(),
        durationMs: commandResult.durationMs ?? null,
      },
      null,
      2,
    )}\n`,
  );

  return {
    cleaned: true,
    runId: safeRunId,
    projectName,
    receiptPath,
  };
}
