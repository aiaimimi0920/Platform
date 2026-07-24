import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer, Socket } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Client } from "pg";

const defaultPlatformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultFixtureRoot = path.join(defaultPlatformRoot, ".runtime", "acceptance", "integration-fixture");
const defaultS3Bucket = "platform-integration";

function nextRunId() {
  return `platform-integration-${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}`;
}

function isInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function npmInvocation(args) {
  if (process.platform !== "win32") {
    return { command: "npm", args };
  }

  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  const npmCliPath = candidates.find(
    (candidate) => typeof candidate === "string" && /npm-cli\.js$/i.test(candidate) && existsSync(candidate),
  );
  if (!npmCliPath) {
    throw new Error("Unable to locate npm-cli.js for shell-free Windows integration execution");
  }
  return { command: process.execPath, args: [npmCliPath, ...args] };
}

async function reservePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : null;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Failed to reserve an integration fixture port");
  }
  return port;
}

async function loadCreateCoreIntegrationContext(platformRoot = defaultPlatformRoot) {
  const moduleUrl = pathToFileURL(path.join(platformRoot, "core", "src", "testing", "integration-postgres.ts")).href;
  const module = await import(moduleUrl);
  return module.createCoreIntegrationContext;
}

function collectRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.once("end", () => resolve(Buffer.concat(chunks)));
    request.once("error", reject);
  });
}

async function startFakeS3Server({ ownerRoot, bucket = defaultS3Bucket } = {}) {
  const port = await reservePort();
  await mkdir(path.join(ownerRoot, "s3"), { recursive: true });
  const objects = new Map();

  const server = createHttpServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const pathname = requestUrl.pathname.replace(/^\/+/, "");
    const method = (request.method ?? "GET").toUpperCase();

    if (pathname.length === 0) {
      response.statusCode = 200;
      response.end();
      return;
    }

    if (requestUrl.searchParams.has("list-type")) {
      response.statusCode = 200;
      response.setHeader("content-type", "application/xml");
      response.end(`<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${bucket}</Name></ListBucketResult>`);
      return;
    }

    if (method === "PUT") {
      const body = await collectRequestBody(request);
      objects.set(pathname, body);
      response.statusCode = 200;
      response.setHeader("etag", `"${body.length}"`);
      response.end();
      return;
    }

    if (method === "HEAD") {
      response.statusCode = objects.has(pathname) || pathname === bucket ? 200 : 404;
      response.end();
      return;
    }

    if (method === "GET") {
      if (!objects.has(pathname)) {
        response.statusCode = pathname === bucket ? 200 : 404;
        response.end(pathname === bucket ? "" : "Not Found");
        return;
      }
      const body = objects.get(pathname);
      response.statusCode = 200;
      response.setHeader("content-length", String(body.length));
      response.end(body);
      return;
    }

    if (method === "DELETE") {
      objects.delete(pathname);
      response.statusCode = 204;
      response.end();
      return;
    }

    response.statusCode = 405;
    response.end("Method Not Allowed");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    bucket,
    endpoint: `http://127.0.0.1:${port}`,
    publicBaseUrl: `http://127.0.0.1:${port}/${bucket}/`,
    async stop() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))).catch(() =>
        undefined,
      );
    },
  };
}

async function probePostgresReady(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  client.on("error", () => undefined);
  await client.connect();
  try {
    await client.query("select 1");
    return true;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function probeValkeyReady(redisUrl) {
  const parsed = new URL(redisUrl);
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn(value);
    };

    socket.setTimeout(5_000, () => finish(reject, new Error("Valkey readiness probe timed out")));
    socket.once("error", (error) => finish(reject, error));
    socket.connect(Number(parsed.port || 6379), parsed.hostname, () => {
      socket.write("*1\r\n$4\r\nPING\r\n");
    });
    socket.on("data", (chunk) => {
      const payload = chunk.toString("utf8");
      if (payload.startsWith("+PONG") || payload.startsWith("+OK")) {
        finish(resolve, true);
      }
    });
  });
}

async function probeS3Ready(endpoint) {
  const response = await fetch(endpoint, { method: "HEAD" });
  return response.ok;
}

function buildFixtureEnvironment(context, s3) {
  const restoreEnvironment = context.setProcessEnv({
    PLATFORM_ACCEPTANCE_MODE: "required",
    OBJECT_STORAGE_DRIVER: "s3-compatible",
    OBJECT_STORAGE_BUCKET: s3.bucket,
    OBJECT_STORAGE_REGION: "us-east-1",
    OBJECT_STORAGE_ENDPOINT: s3.endpoint,
    OBJECT_STORAGE_ACCESS_KEY_ID: "fixture-access-key",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "fixture-secret-key",
    OBJECT_STORAGE_PUBLIC_BASE_URL: s3.publicBaseUrl,
    S3_PUBLIC_BASE_URL: s3.publicBaseUrl,
    CREDENTIAL_OBJECT_STORAGE_PUBLIC_BASE_URL: s3.publicBaseUrl,
    AI_GATEWAY_OBJECT_STORAGE_DRIVER: "s3-compatible",
    AI_GATEWAY_OBJECT_STORAGE_BUCKET: s3.bucket,
    AI_GATEWAY_OBJECT_STORAGE_REGION: "us-east-1",
    AI_GATEWAY_OBJECT_STORAGE_ENDPOINT: s3.endpoint,
    AI_GATEWAY_OBJECT_STORAGE_ACCESS_KEY_ID: "fixture-access-key",
    AI_GATEWAY_OBJECT_STORAGE_SECRET_ACCESS_KEY: "fixture-secret-key",
  });
  const env = { ...process.env };
  restoreEnvironment();
  return env;
}

export function assertRequiredIntegrationFixtureEnvironment(env) {
  const missing = [
    "DATABASE_URL",
    "ACCOUNT_DATABASE_URL",
    "REDIS_URL",
    "ACCOUNT_REDIS_URL",
    "OBJECT_STORAGE_DRIVER",
    "OBJECT_STORAGE_BUCKET",
    "OBJECT_STORAGE_REGION",
    "OBJECT_STORAGE_ENDPOINT",
    "OBJECT_STORAGE_ACCESS_KEY_ID",
    "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    "S3_PUBLIC_BASE_URL",
  ].filter((key) => typeof env?.[key] !== "string" || env[key].trim().length === 0);
  if (missing.length > 0) {
    throw new Error(`Required integration fixture environment missing: ${missing.join(", ")}`);
  }
  if (env.OBJECT_STORAGE_DRIVER.trim() !== "s3-compatible") {
    throw new Error(`OBJECT_STORAGE_DRIVER must be s3-compatible for required integration fixture: ${env.OBJECT_STORAGE_DRIVER}`);
  }
  return true;
}

export function assertOwnedFixturePath(ownerRoot, targetPath) {
  if (!isInside(ownerRoot, targetPath)) {
    throw new Error(
      `Refusing to clean up path outside the owned integration fixture root: ${targetPath} (owner=${ownerRoot})`,
    );
  }
  return true;
}

export async function removeOwnedFixturePath(ownerRoot, targetPath) {
  assertOwnedFixturePath(ownerRoot, targetPath);
  await rm(targetPath, { recursive: true, force: true });
}

export function discoverRequiredIntegrationWorkspaces({ platformRoot = defaultPlatformRoot } = {}) {
  const rootPackage = readJson(path.join(platformRoot, "package.json"));
  const workspaces = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : [];
  return workspaces.map((relativePath) => {
    const packagePath = path.join(platformRoot, relativePath, "package.json");
    const workspacePackage = readJson(packagePath);
    const script = workspacePackage?.scripts?.["test:integration:required"];
    if (typeof script !== "string" || script.trim().length === 0) {
      throw new Error(`Workspace ${workspacePackage?.name ?? relativePath} is missing test:integration:required`);
    }
    if (script.includes("--if-present")) {
      throw new Error(`Workspace ${workspacePackage?.name ?? relativePath} must not use --if-present in test:integration:required`);
    }
    return {
      name: workspacePackage.name || relativePath,
      directory: path.join(platformRoot, relativePath),
      packagePath,
      script: script.trim(),
    };
  });
}

export async function prepareDefaultIntegrationFixture({
  platformRoot = defaultPlatformRoot,
  runId = nextRunId(),
  fixtureRoot = defaultFixtureRoot,
} = {}) {
  const ownedPath = path.join(fixtureRoot, runId);
  await mkdir(ownedPath, { recursive: true });
  await writeFile(
    path.join(ownedPath, "owner.json"),
    `${JSON.stringify({ createdAt: new Date().toISOString(), ownedPath, runId })}\n`,
    "utf8",
  );

  const createCoreIntegrationContext = await loadCreateCoreIntegrationContext(platformRoot);
  const context = await createCoreIntegrationContext(`acceptance_${runId}`);
  const s3 = await startFakeS3Server({ ownerRoot: ownedPath, bucket: defaultS3Bucket });
  const env = buildFixtureEnvironment(context, s3);
  assertRequiredIntegrationFixtureEnvironment(env);

  const readiness = {
    postgres: await probePostgresReady(env.DATABASE_URL),
    valkey: await probeValkeyReady(env.REDIS_URL),
    s3: await probeS3Ready(env.OBJECT_STORAGE_ENDPOINT),
  };

  return {
    context,
    env,
    ownedPath,
    readiness,
    runId,
    s3,
  };
}

export async function cleanupDefaultIntegrationFixture(fixture) {
  await fixture?.s3?.stop?.();
  await fixture?.context?.stop?.();
  if (fixture?.ownedPath) {
    await removeOwnedFixturePath(path.dirname(fixture.ownedPath), fixture.ownedPath);
  }
}

export async function runWorkspaceIntegrationCommand({
  workspace,
  platformRoot = defaultPlatformRoot,
  fixture,
} = {}) {
  const invocation = npmInvocation(["run", "test:integration:required", "--workspace", workspace.name]);
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: platformRoot,
      env: fixture?.env ?? process.env,
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) {
        reject(new Error(`Integration workspace ${workspace.name} exited via signal ${signal}`));
        return;
      }
      resolve({
        workspaceName: workspace.name,
        exitCode: code ?? 1,
      });
    });
  });
}

export async function runRequiredIntegrationFixture({
  platformRoot = defaultPlatformRoot,
  runId = process.env.PLATFORM_ACCEPTANCE_RUN_ID || nextRunId(),
  fixtureRoot = defaultFixtureRoot,
  discoverWorkspaces = () => discoverRequiredIntegrationWorkspaces({ platformRoot }),
  prepareFixture = () => prepareDefaultIntegrationFixture({ fixtureRoot, platformRoot, runId }),
  runWorkspaceCommand = runWorkspaceIntegrationCommand,
  cleanupFixture = cleanupDefaultIntegrationFixture,
} = {}) {
  const workspaces = discoverWorkspaces();
  const fixture = await prepareFixture({ fixtureRoot, platformRoot, runId });
  const results = [];

  try {
    if (fixture?.env) {
      assertRequiredIntegrationFixtureEnvironment(fixture.env);
    }

    const readiness = fixture?.readiness ?? { postgres: false, s3: false, valkey: false };
    if (!readiness.postgres || !readiness.valkey || !readiness.s3) {
      throw new Error(`Required integration fixture readiness failed: ${JSON.stringify(readiness)}`);
    }

    for (const workspace of workspaces) {
      try {
        const result = await runWorkspaceCommand({ fixture, platformRoot, workspace });
        const status =
          result?.status === "skipped"
            ? "skipped"
            : Number.isInteger(result?.exitCode) && result.exitCode === 0
              ? "passed"
              : "failed";
        results.push({
          workspaceName: workspace.name,
          exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : 1,
          status,
        });
      } catch (error) {
        results.push({
          workspaceName: workspace.name,
          exitCode: 1,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const skipped = results.filter((result) => result.status === "skipped").length;
    const failed = results.filter((result) => result.status === "failed").length;
    const passed = results.filter((result) => result.status === "passed").length;
    return {
      runId,
      readiness,
      discovered: workspaces.length,
      executed: results.length,
      failed,
      passed,
      skipped,
      exitCode: failed > 0 || skipped > 0 || results.length !== workspaces.length ? 1 : 0,
      results,
    };
  } finally {
    await cleanupFixture(fixture);
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  let runId = process.env.PLATFORM_ACCEPTANCE_RUN_ID || nextRunId();
  let fixtureRoot = defaultFixtureRoot;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run-id") {
      runId = argv[++index];
      continue;
    }
    if (argument === "--fixture-root") {
      fixtureRoot = path.resolve(argv[++index]);
      continue;
    }
    throw new Error(`Unknown integration fixture argument: ${argument}`);
  }
  return { fixtureRoot, runId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs();
    const summary = await runRequiredIntegrationFixture(options);
    console.log(JSON.stringify(summary));
    process.exitCode = summary.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
