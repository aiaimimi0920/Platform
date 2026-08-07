import Redis from "ioredis";
import { Pool } from "pg";

export function createPgPool(
  connectionString: string,
  options?: { connectionTimeoutMs?: number; queryTimeoutMs?: number },
) {
  return new Pool({
    connectionString,
    ssl: false,
    connectionTimeoutMillis: options?.connectionTimeoutMs ?? 10_000,
    query_timeout: options?.queryTimeoutMs ?? 30_000,
  });
}

export function createRedisClient(connectionString: string) {
  return new Redis(connectionString, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
  });
}
