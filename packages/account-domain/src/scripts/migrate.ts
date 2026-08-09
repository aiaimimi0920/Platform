import path from "node:path";

import { runPostgresMigrations } from "@neuro/backend-foundation";

import { pgPool } from "../db/client";

const MIGRATION_ADVISORY_LOCK_NAME = "neuro-account-schema-migrations";

async function run() {
  await runPostgresMigrations({
    advisoryLockName: MIGRATION_ADVISORY_LOCK_NAME,
    migrationTableName: "account_schema_migrations",
    migrationsDirectory: path.join(process.cwd(), "migrations"),
    migrationsLabel: "Account",
    pool: pgPool,
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
