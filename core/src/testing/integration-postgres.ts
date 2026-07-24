import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

import { Client } from "pg";

const POSTGRES_USER = "postgres";
const POSTGRES_PASSWORD = "postgres";
const DEFAULT_REDIS_URL = "redis://127.0.0.1:1";
const DEFAULT_INTERNAL_API_TOKEN = "integration-token";
const DEFAULT_PLATFORM_OPERATORS = "operator-1,operator-2";

const runtimeRoot = path.resolve(__dirname, "../../../.runtime/integration-postgres");
const migrationRoot = path.resolve(__dirname, "../../migrations");

type EmbeddedPostgresInstance = {
  initialise: () => Promise<void>;
  start: () => Promise<void>;
  createDatabase: (name: string) => Promise<void>;
};

type EmbeddedPostgresConstructor = new (options: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
}) => EmbeddedPostgresInstance;

type PgCtlPackageModule = {
  pg_ctl: string;
};

const EMBEDDED_POSTGRES_STOP_TIMEOUT_MS = 15_000;

function dynamicImport<T>(specifier: string): Promise<T> {
  return Function("moduleSpecifier", "return import(moduleSpecifier);")(specifier) as Promise<T>;
}

async function loadEmbeddedPostgres() {
  const module = await dynamicImport<{ default: EmbeddedPostgresConstructor }>("embedded-postgres");
  return module.default;
}

function sanitizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "integration";
}

async function reservePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  const port =
    typeof address === "object" && address !== null && typeof address.port === "number"
      ? address.port
      : null;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (!port) {
    throw new Error("Failed to reserve an integration PostgreSQL port");
  }

  return port;
}

function buildDatabaseUrl(port: number, databaseName: string) {
  return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${port}/${databaseName}`;
}

async function applyCoreMigrations(databaseUrl: string) {
  await applySqlMigrations(databaseUrl, (await readdir(migrationRoot))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => path.join(migrationRoot, name)));
}

async function applySqlMigrations(databaseUrl: string, migrationFiles: string[]) {
  const client = new Client({
    connectionString: databaseUrl,
  });
  client.on("error", () => undefined);

  await client.connect();
  try {
    for (const migrationFile of migrationFiles) {
      const sql = await readFile(migrationFile, "utf8");
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

async function waitForDatabaseConnectionsToDrain(args: {
  databaseName: string;
  port: number;
  timeoutMs?: number;
}) {
  const client = new Client({
    connectionString: buildDatabaseUrl(args.port, "postgres"),
  });
  client.on("error", () => undefined);

  await client.connect();
  try {
    const deadline = Date.now() + (args.timeoutMs ?? 5_000);
    while (Date.now() < deadline) {
      const result = await client.query<{ count: string }>(
        `select count(*)::text as count
           from pg_stat_activity
          where datname = $1
            and pid <> pg_backend_pid()`,
        [args.databaseName],
      );
      if (Number(result.rows[0]?.count ?? 0) === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await client.query(
      `select pg_terminate_backend(pid)
         from pg_stat_activity
        where datname = $1
          and pid <> pg_backend_pid()`,
      [args.databaseName],
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function startFakeRedisServer() {
  const port = await reservePort();
  const store = new Map<string, string>();

  function parseInlineCommand(buffer: string) {
    const boundary = buffer.indexOf("\r\n");
    if (boundary < 0) {
      return null;
    }
    const tokens = buffer
      .slice(0, boundary)
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 0);
    return {
      tokens,
      consumed: boundary + 2,
    };
  }

  function parseRespCommand(buffer: string) {
    if (!buffer.startsWith("*")) {
      return parseInlineCommand(buffer);
    }

    const headerBoundary = buffer.indexOf("\r\n");
    if (headerBoundary < 0) {
      return null;
    }

    const argumentCount = Number(buffer.slice(1, headerBoundary));
    if (!Number.isInteger(argumentCount) || argumentCount < 0) {
      throw new Error(`Invalid RESP array header: ${buffer.slice(0, headerBoundary)}`);
    }

    let offset = headerBoundary + 2;
    const tokens: string[] = [];

    for (let index = 0; index < argumentCount; index += 1) {
      const lengthBoundary = buffer.indexOf("\r\n", offset);
      if (lengthBoundary < 0) {
        return null;
      }

      const lengthHeader = buffer.slice(offset, lengthBoundary);
      if (!lengthHeader.startsWith("$")) {
        throw new Error(`Invalid RESP bulk-string header: ${lengthHeader}`);
      }

      const valueLength = Number(lengthHeader.slice(1));
      if (!Number.isInteger(valueLength) || valueLength < 0) {
        throw new Error(`Invalid RESP bulk-string length: ${lengthHeader}`);
      }

      const valueStart = lengthBoundary + 2;
      const valueEnd = valueStart + valueLength;
      if (buffer.length < valueEnd + 2) {
        return null;
      }

      tokens.push(buffer.slice(valueStart, valueEnd));
      offset = valueEnd + 2;
    }

    return {
      tokens,
      consumed: offset,
    };
  }

  function executeRedisCommand(socket: NodeJS.WritableStream, tokens: string[]) {
    const command = tokens[0]?.toUpperCase() ?? "";

    if (command === "PING") {
      socket.write("+PONG\r\n");
      return;
    }
    if (command === "INFO") {
      const payload = "# Server\r\nredis_version:7.2.0\r\n\r\n";
      socket.write(`$${Buffer.byteLength(payload)}\r\n${payload}`);
      return;
    }
    if (command === "GET") {
      const key = tokens[1] ?? "";
      const value = store.get(key);
      if (value === undefined) {
        socket.write("$-1\r\n");
        return;
      }
      socket.write(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
      return;
    }
    if (command === "SET") {
      const key = tokens[1] ?? "";
      const value = tokens[2] ?? "";
      store.set(key, value);
      socket.write("+OK\r\n");
      return;
    }
    if (command === "DEL") {
      let deleted = 0;
      for (const key of tokens.slice(1)) {
        if (store.delete(key)) {
          deleted += 1;
        }
      }
      socket.write(`:${deleted}\r\n`);
      return;
    }
    if (command === "QUIT") {
      socket.write("+OK\r\n");
      if ("end" in socket && typeof socket.end === "function") {
        socket.end();
      }
      return;
    }

    socket.write("+OK\r\n");
  }

  const server = createServer((socket) => {
    let pendingBuffer = "";
    socket.on("data", (chunk) => {
      pendingBuffer += chunk.toString("utf8");

      while (pendingBuffer.length > 0) {
        const parsed = parseRespCommand(pendingBuffer);
        if (!parsed) {
          break;
        }

        pendingBuffer = pendingBuffer.slice(parsed.consumed);
        executeRedisCommand(socket, parsed.tokens);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    url: `redis://127.0.0.1:${port}`,
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }).catch(() => undefined);
    },
  };
}

async function resolvePgCtlBinary() {
  if (process.platform === "win32" && process.arch === "x64") {
    const packageExports = await dynamicImport<PgCtlPackageModule>("@embedded-postgres/windows-x64");
    return packageExports.pg_ctl;
  }

  if (process.platform === "linux" && process.arch === "x64") {
    const packageExports = await dynamicImport<PgCtlPackageModule>("@embedded-postgres/linux-x64");
    return packageExports.pg_ctl;
  }

  if (process.platform === "darwin" && process.arch === "arm64") {
    const packageExports = await dynamicImport<PgCtlPackageModule>("@embedded-postgres/darwin-arm64");
    return packageExports.pg_ctl;
  }

  if (process.platform === "darwin" && process.arch === "x64") {
    const packageExports = await dynamicImport<PgCtlPackageModule>("@embedded-postgres/darwin-x64");
    return packageExports.pg_ctl;
  }

  throw new Error(`Unsupported embedded PostgreSQL platform: ${process.platform}/${process.arch}`);
}

async function readPostmasterPid(databaseDir: string) {
  try {
    const pidFile = await readFile(path.join(databaseDir, "postmaster.pid"), "utf8");
    const pid = Number(pidFile.split(/\r?\n/, 1)[0]?.trim() ?? "");
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function forceTerminatePostmasterProcess(pid: number) {
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const child = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      child.once("error", () => resolve());
      child.once("close", () => resolve());
    });
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
  try {
    process.kill(pid, 0);
  } catch {
    return;
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // ignore
  }
}

async function stopEmbeddedPostgresCluster(databaseDir: string) {
  const pgCtl = await resolvePgCtlBinary();
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(pgCtl, ["-D", databaseDir, "-m", "fast", "-w", "stop"], {
        stdio: ["ignore", "ignore", "pipe"],
      });

      let stderr = "";
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        fn();
      };
      const timeoutHandle = setTimeout(() => {
        settle(() => {
          child.kill();
          reject(
            new Error(`pg_ctl stop timed out after ${EMBEDDED_POSTGRES_STOP_TIMEOUT_MS}ms: ${stderr.trim()}`),
          );
        });
      }, EMBEDDED_POSTGRES_STOP_TIMEOUT_MS);

      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
      child.once("error", (error) => settle(() => reject(error)));
      child.once("close", (code) => {
        settle(() => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(`pg_ctl stop failed with exit code ${code ?? "null"}: ${stderr.trim()}`));
        });
      });
    });
  } catch {
    const postmasterPid = await readPostmasterPid(databaseDir);
    if (postmasterPid) {
      await forceTerminatePostmasterProcess(postmasterPid).catch(() => undefined);
    }
  }
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T | undefined>((resolve) => {
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(undefined);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        resolve(value);
      })
      .catch(() => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutHandle);
        resolve(undefined);
      });
  });
}

type IntegrationEnvironmentOverrides = Record<string, string>;

export type CoreIntegrationContext = {
  databaseName: string;
  databaseUrl: string;
  runId: string;
  setProcessEnv: (overrides?: IntegrationEnvironmentOverrides) => () => void;
  stop: () => Promise<void>;
};

export async function createCoreIntegrationContext(
  name: string,
  options?: {
    extraMigrationFiles?: string[];
  },
): Promise<CoreIntegrationContext> {
  const runId = `${sanitizeName(name)}_${randomUUID().replaceAll("-", "")}`;
  const runDir = path.join(runtimeRoot, runId);
  const databaseDir = path.join(runDir, "cluster");
  const databaseName = `platform_${sanitizeName(name)}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const port = await reservePort();
  const EmbeddedPostgres = await loadEmbeddedPostgres();

  await mkdir(runDir, { recursive: true });

  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    port,
    persistent: false,
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(databaseName);

  const databaseUrl = buildDatabaseUrl(port, databaseName);
  await applyCoreMigrations(databaseUrl);
  if (options?.extraMigrationFiles?.length) {
    await applySqlMigrations(databaseUrl, options.extraMigrationFiles);
  }
  const redis = await startFakeRedisServer();

  return {
    runId,
    databaseName,
    databaseUrl,
    setProcessEnv(overrides = {}) {
      const nextEnvironment: IntegrationEnvironmentOverrides = {
        DATABASE_URL: databaseUrl,
        ACCOUNT_DATABASE_URL: databaseUrl,
        HEAVY_CHAT_INTEGRATION_DATABASE_URL: databaseUrl,
        REDIS_URL: redis.url || DEFAULT_REDIS_URL,
        ACCOUNT_REDIS_URL: redis.url || DEFAULT_REDIS_URL,
        INTERNAL_API_TOKEN: DEFAULT_INTERNAL_API_TOKEN,
        PLATFORM_OPERATOR_USER_IDS: DEFAULT_PLATFORM_OPERATORS,
        ...overrides,
      };

      const previousEnvironment = new Map<string, string | undefined>();
      for (const [key, value] of Object.entries(nextEnvironment)) {
        previousEnvironment.set(key, process.env[key]);
        process.env[key] = value;
      }

      return () => {
        for (const [key, value] of previousEnvironment.entries()) {
          if (value === undefined) {
            delete process.env[key];
            continue;
          }
          process.env[key] = value;
        }
      };
    },
    async stop() {
      await runWithTimeout(
        waitForDatabaseConnectionsToDrain({
          databaseName,
          port,
        }),
        5_000,
      );
      await runWithTimeout(redis.stop(), 2_000);
      await runWithTimeout(stopEmbeddedPostgresCluster(databaseDir), EMBEDDED_POSTGRES_STOP_TIMEOUT_MS + 5_000);
      await runWithTimeout(rm(runDir, { recursive: true, force: true }), 2_000);
    },
  };
}
