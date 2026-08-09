import { promises as fs } from "node:fs";
import path from "node:path";

export const POSTGRES_MIGRATION_LOCK_SQL =
  "select pg_advisory_lock(hashtextextended(current_database() || ':' || $1::text, 0))";
export const POSTGRES_MIGRATION_UNLOCK_SQL =
  "select pg_advisory_unlock(hashtextextended(current_database() || ':' || $1::text, 0))";

export interface PostgresMigrationQueryResult {
  rowCount: number | null;
}

export interface PostgresMigrationClient {
  query(queryText: string, values?: unknown[]): Promise<PostgresMigrationQueryResult>;
  release(): void;
}

export interface PostgresMigrationPool {
  connect(): Promise<PostgresMigrationClient>;
  end(): Promise<void>;
}

export interface PostgresMigrationLogger {
  error(message: string, error: unknown): void;
}

export interface RunPostgresMigrationsOptions {
  advisoryLockName: string;
  migrationTableName: string;
  migrationsDirectory: string;
  migrationsLabel: string;
  pool: PostgresMigrationPool;
  logger?: PostgresMigrationLogger;
}

function requireIdentifier(value: string, label: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new TypeError(`${label} must be a lowercase PostgreSQL identifier`);
  }
  return value;
}

async function listMigrationFiles(directory: string, label: string) {
  try {
    const stat = await fs.stat(directory);
    if (!stat.isDirectory()) throw new Error(`${label} migrations path is not a directory: ${directory}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${label} migrations directory not found: ${directory}`);
    }
    throw error;
  }
  return (await fs.readdir(directory)).filter((entry) => entry.endsWith(".sql")).sort();
}

async function rollbackPreservingPrimaryError(
  client: PostgresMigrationClient,
  logger: PostgresMigrationLogger,
  primaryError: unknown,
) {
  try {
    await client.query("rollback");
  } catch (rollbackError) {
    logger.error("Failed to roll back a PostgreSQL schema migration", rollbackError);
  }
  throw primaryError;
}

export async function runPostgresMigrations(options: RunPostgresMigrationsOptions) {
  const {
    advisoryLockName,
    migrationsDirectory,
    migrationsLabel,
    pool,
    logger = console,
  } = options;
  let migrationTableName = "";
  let normalizedAdvisoryLockName = "";
  let client: PostgresMigrationClient | undefined;
  let advisoryLockAcquired = false;
  let operationFailed = false;
  try {
    migrationTableName = requireIdentifier(options.migrationTableName, "migrationTableName");
    normalizedAdvisoryLockName = advisoryLockName.trim();
    if (!normalizedAdvisoryLockName) throw new TypeError("advisoryLockName is required");
    const files = await listMigrationFiles(migrationsDirectory, migrationsLabel);
    client = await pool.connect();
    await client.query(POSTGRES_MIGRATION_LOCK_SQL, [normalizedAdvisoryLockName]);
    advisoryLockAcquired = true;

    await client.query(`
      create table if not exists ${migrationTableName} (
        file_name text primary key,
        applied_at timestamptz not null
      )
    `);

    for (const fileName of files) {
      const alreadyApplied = await client.query(
        `select 1 from ${migrationTableName} where file_name = $1`,
        [fileName],
      );
      if (alreadyApplied.rowCount) continue;

      const sql = await fs.readFile(path.join(migrationsDirectory, fileName), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          `insert into ${migrationTableName} (file_name, applied_at) values ($1, now())`,
          [fileName],
        );
        await client.query("commit");
      } catch (error) {
        await rollbackPreservingPrimaryError(client, logger, error);
      }
    }
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    const cleanupErrors: Array<{ message: string; error: unknown }> = [];
    if (client && advisoryLockAcquired) {
      try {
        await client.query(POSTGRES_MIGRATION_UNLOCK_SQL, [normalizedAdvisoryLockName]);
      } catch (error) {
        cleanupErrors.push({ message: `Failed to release the ${migrationsLabel} migration advisory lock`, error });
      }
    }
    if (client) {
      try {
        client.release();
      } catch (error) {
        cleanupErrors.push({ message: `Failed to release the ${migrationsLabel} migration database client`, error });
      }
    }
    try {
      await pool.end();
    } catch (error) {
      cleanupErrors.push({ message: `Failed to close the ${migrationsLabel} migration database pool`, error });
    }

    if (cleanupErrors.length > 0) {
      if (operationFailed) {
        for (const cleanupError of cleanupErrors) logger.error(cleanupError.message, cleanupError.error);
      } else {
        throw new AggregateError(cleanupErrors.map(({ error }) => error), cleanupErrors.map(({ message }) => message).join("; "));
      }
    }
  }
}
