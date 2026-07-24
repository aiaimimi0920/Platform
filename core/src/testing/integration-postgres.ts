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
  const server = createServer((socket) => {
    socket.on("data", (chunk) => {
      const message = chunk.toString("utf8").toUpperCase();
      if (message.includes("PING")) {
        socket.write("+PONG\r\n");
        return;
      }
      if (message.includes("INFO")) {
        socket.write("$31\r\n# Server\r\nredis_version:7.2.0\r\n\r\n");
        return;
      }
      if (message.includes("QUIT")) {
        socket.write("+OK\r\n");
        socket.end();
        return;
      }
      socket.write("+OK\r\n");
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

async function stopEmbeddedPostgresCluster(databaseDir: string) {
  const pgCtl = await resolvePgCtlBinary();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pgCtl, ["-D", databaseDir, "-m", "fast", "-w", "stop"], {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pg_ctl stop failed with exit code ${code ?? "null"}: ${stderr.trim()}`));
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
      await waitForDatabaseConnectionsToDrain({
        databaseName,
        port,
      }).catch(() => undefined);
      await redis.stop();
      await stopEmbeddedPostgresCluster(databaseDir).catch(() => undefined);
      await rm(runDir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}
