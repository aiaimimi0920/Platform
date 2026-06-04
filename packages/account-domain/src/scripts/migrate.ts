import { promises as fs } from "node:fs";
import path from "node:path";

import { pgPool } from "../db/client";

async function ensureMigrationsDir(migrationsDir: string) {
  try {
    const stat = await fs.stat(migrationsDir);
    if (!stat.isDirectory()) {
      throw new Error(`Account migrations path is not a directory: ${migrationsDir}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Account migrations directory not found: ${migrationsDir}`);
    }
    throw error;
  }
}

async function run() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  await ensureMigrationsDir(migrationsDir);
  const entries = await fs.readdir(migrationsDir);
  const files = entries.filter((entry) => entry.endsWith(".sql")).sort();

  const client = await pgPool.connect();
  try {
    await client.query(`
      create table if not exists account_schema_migrations (
        file_name text primary key,
        applied_at timestamptz not null
      )
    `);

    for (const fileName of files) {
      const alreadyApplied = await client.query(
        "select 1 from account_schema_migrations where file_name = $1",
        [fileName],
      );
      if (alreadyApplied.rowCount) continue;

      const sql = await fs.readFile(path.join(migrationsDir, fileName), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into account_schema_migrations (file_name, applied_at) values ($1, now())",
          [fileName],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    client.release();
    await pgPool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
