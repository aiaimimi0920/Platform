import { Pool } from "pg";

import { env } from "@/env";

export const pgPool = new Pool({
  connectionString: env.databaseUrl,
  connectionTimeoutMillis: env.databaseConnectionTimeoutMs,
  query_timeout: env.databaseQueryTimeoutMs,
});
