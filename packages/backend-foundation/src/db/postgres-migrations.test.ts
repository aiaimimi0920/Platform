import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  POSTGRES_MIGRATION_LOCK_SQL,
  POSTGRES_MIGRATION_UNLOCK_SQL,
  type PostgresMigrationClient,
  type PostgresMigrationPool,
  runPostgresMigrations,
} from "./postgres-migrations";

interface QueryCall {
  queryText: string;
  values?: unknown[];
}

async function withMigrations(
  files: Record<string, string>,
  run: (directory: string) => Promise<void>,
) {
  const directory = await mkdtemp(path.join(tmpdir(), "platform-migrations-"));
  try {
    await Promise.all(Object.entries(files).map(([fileName, sql]) => writeFile(path.join(directory, fileName), sql, "utf8")));
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function createFakeDatabase(
  query: (call: QueryCall) => Promise<{ rowCount: number | null }> = async () => ({ rowCount: 0 }),
) {
  const calls: QueryCall[] = [];
  let released = false;
  let ended = false;
  const client: PostgresMigrationClient = {
    async query(queryText, values) {
      const call = { queryText, values };
      calls.push(call);
      return query(call);
    },
    release() {
      released = true;
    },
  };
  const pool: PostgresMigrationPool = {
    async connect() {
      return client;
    },
    async end() {
      ended = true;
    },
  };
  return {
    calls,
    client,
    pool,
    get ended() { return ended; },
    get released() { return released; },
  };
}

test("PostgreSQL migrations hold one session lock and apply pending files in lexical order", async () => {
  const database = createFakeDatabase(async ({ queryText, values }) => {
    if (queryText.startsWith("select 1 from") && values?.[0] === "001_applied.sql") return { rowCount: 1 };
    return { rowCount: 0 };
  });

  await withMigrations({
    "002_pending.sql": "select 2;",
    "001_applied.sql": "select 1;",
    "ignored.txt": "not sql",
  }, async (migrationsDirectory) => runPostgresMigrations({
    advisoryLockName: "neuro-test-schema-migrations",
    migrationTableName: "test_schema_migrations",
    migrationsDirectory,
    migrationsLabel: "Test",
    pool: database.pool,
  }));

  assert.deepEqual(database.calls.map(({ queryText }) => queryText.trim()), [
    POSTGRES_MIGRATION_LOCK_SQL,
    "create table if not exists test_schema_migrations (\n        file_name text primary key,\n        applied_at timestamptz not null\n      )",
    "select 1 from test_schema_migrations where file_name = $1",
    "select 1 from test_schema_migrations where file_name = $1",
    "begin",
    "select 2;",
    "insert into test_schema_migrations (file_name, applied_at) values ($1, now())",
    "commit",
    POSTGRES_MIGRATION_UNLOCK_SQL,
  ]);
  assert.deepEqual(database.calls[0].values, ["neuro-test-schema-migrations"]);
  assert.deepEqual(database.calls.at(-1)?.values, ["neuro-test-schema-migrations"]);
  assert.equal(database.released, true);
  assert.equal(database.ended, true);
});

test("PostgreSQL migrations preserve the SQL error when rollback and cleanup succeed", async () => {
  const migrationError = new Error("migration failed");
  const database = createFakeDatabase(async ({ queryText }) => {
    if (queryText === "select fail;") throw migrationError;
    return { rowCount: 0 };
  });

  await withMigrations({ "001_failure.sql": "select fail;" }, async (migrationsDirectory) => {
    await assert.rejects(runPostgresMigrations({
      advisoryLockName: "neuro-test-schema-migrations",
      migrationTableName: "test_schema_migrations",
      migrationsDirectory,
      migrationsLabel: "Test",
      pool: database.pool,
    }), (error) => error === migrationError);
  });

  assert.deepEqual(database.calls.slice(-2).map(({ queryText }) => queryText), [
    "rollback",
    POSTGRES_MIGRATION_UNLOCK_SQL,
  ]);
  assert.equal(database.released, true);
  assert.equal(database.ended, true);
});

test("PostgreSQL migrations do not unlock an advisory lock that was never acquired", async () => {
  const lockError = new Error("lock unavailable");
  const database = createFakeDatabase(async ({ queryText }) => {
    if (queryText === POSTGRES_MIGRATION_LOCK_SQL) throw lockError;
    return { rowCount: 0 };
  });

  await withMigrations({}, async (migrationsDirectory) => {
    await assert.rejects(runPostgresMigrations({
      advisoryLockName: "neuro-test-schema-migrations",
      migrationTableName: "test_schema_migrations",
      migrationsDirectory,
      migrationsLabel: "Test",
      pool: database.pool,
    }), (error) => error === lockError);
  });

  assert.deepEqual(database.calls.map(({ queryText }) => queryText), [POSTGRES_MIGRATION_LOCK_SQL]);
  assert.equal(database.released, true);
  assert.equal(database.ended, true);
});

test("PostgreSQL migrations close the pool when connection establishment fails", async () => {
  const connectError = new Error("connect failed");
  let ended = false;
  const pool: PostgresMigrationPool = {
    async connect() {
      throw connectError;
    },
    async end() {
      ended = true;
    },
  };

  await withMigrations({}, async (migrationsDirectory) => {
    await assert.rejects(runPostgresMigrations({
      advisoryLockName: "neuro-test-schema-migrations",
      migrationTableName: "test_schema_migrations",
      migrationsDirectory,
      migrationsLabel: "Test",
      pool,
    }), (error) => error === connectError);
  });
  assert.equal(ended, true);
});

test("PostgreSQL migrations close the pool when runner configuration is invalid", async () => {
  let connected = false;
  let ended = false;
  const pool: PostgresMigrationPool = {
    async connect() {
      connected = true;
      throw new Error("must not connect");
    },
    async end() {
      ended = true;
    },
  };

  await assert.rejects(runPostgresMigrations({
    advisoryLockName: "neuro-test-schema-migrations",
    migrationTableName: "unsafe;drop_table",
    migrationsDirectory: "unused",
    migrationsLabel: "Test",
    pool,
  }), /lowercase PostgreSQL identifier/);
  assert.equal(connected, false);
  assert.equal(ended, true);
});

test("PostgreSQL migrations keep the primary error when rollback and unlock also fail", async () => {
  const migrationError = new Error("migration failed");
  const rollbackError = new Error("rollback failed");
  const unlockError = new Error("unlock failed");
  const loggedErrors: unknown[] = [];
  const database = createFakeDatabase(async ({ queryText }) => {
    if (queryText === "select fail;") throw migrationError;
    if (queryText === "rollback") throw rollbackError;
    if (queryText === POSTGRES_MIGRATION_UNLOCK_SQL) throw unlockError;
    return { rowCount: 0 };
  });

  await withMigrations({ "001_failure.sql": "select fail;" }, async (migrationsDirectory) => {
    await assert.rejects(runPostgresMigrations({
      advisoryLockName: "neuro-test-schema-migrations",
      migrationTableName: "test_schema_migrations",
      migrationsDirectory,
      migrationsLabel: "Test",
      pool: database.pool,
      logger: {
        error(_message, error) {
          loggedErrors.push(error);
        },
      },
    }), (error) => error === migrationError);
  });

  assert.deepEqual(loggedErrors, [rollbackError, unlockError]);
  assert.equal(database.released, true);
  assert.equal(database.ended, true);
});
