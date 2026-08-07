import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "@/env";
import { createPgPool } from "@neuro/backend-foundation/db/factories";
import * as schema from "@/db/schema";

export const pgPool = createPgPool(env.databaseUrl, {
  connectionTimeoutMs: env.databaseConnectionTimeoutMs,
  queryTimeoutMs: env.databaseQueryTimeoutMs,
});
export const db = drizzle(pgPool, { schema });
