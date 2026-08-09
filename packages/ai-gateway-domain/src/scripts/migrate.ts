import path from "node:path";

import { runPostgresMigrations } from "@neuro/backend-foundation/db/postgres-migrations";

import { pgPool } from "../db/client";

const MIGRATION_ADVISORY_LOCK_NAME = "neuro-gateway-schema-migrations";

async function run() {
  await runPostgresMigrations({
    advisoryLockName: MIGRATION_ADVISORY_LOCK_NAME,
    migrationTableName: "gateway_schema_migrations",
    migrationsDirectory: path.join(process.cwd(), "migrations"),
    migrationsLabel: "Gateway",
    pool: pgPool,
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
