import { promises as fs } from "node:fs";
import path from "node:path";

import { pgPool } from "../db/client";

const MIGRATION_ADVISORY_LOCK_NAME = "neuro-core-schema-migrations";

async function run() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const entries = await fs.readdir(migrationsDir);
  const files = entries.filter((entry) => entry.endsWith(".sql")).sort();

  const client = await pgPool.connect();
  let advisoryLockAcquired = false;
  try {
    await client.query(
      "select pg_advisory_lock(hashtextextended(current_database() || ':' || $1::text, 0))",
      [MIGRATION_ADVISORY_LOCK_NAME],
    );
    advisoryLockAcquired = true;

    await client.query(`
      create table if not exists schema_migrations (
        file_name text primary key,
        applied_at timestamptz not null
      )
    `);

    for (const fileName of files) {
      const alreadyApplied = await client.query("select 1 from schema_migrations where file_name = $1", [fileName]);
      if (alreadyApplied.rowCount) continue;

      const sql = await fs.readFile(path.join(migrationsDir, fileName), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (file_name, applied_at) values ($1, now())", [fileName]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    if (advisoryLockAcquired) {
      await client
        .query(
          "select pg_advisory_unlock(hashtextextended(current_database() || ':' || $1::text, 0))",
          [MIGRATION_ADVISORY_LOCK_NAME],
        )
        .catch((error) => console.error("Failed to release the Core migration advisory lock", error));
    }
    client.release();
    await pgPool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
