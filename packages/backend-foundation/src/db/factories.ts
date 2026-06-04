import Redis from "ioredis";
import { Pool } from "pg";

export function createPgPool(connectionString: string) {
  return new Pool({
    connectionString,
    ssl: false,
    // Increase connection timeout to handle slow connections
    connectionTimeoutMillis: 10000,
  });
}

export function createRedisClient(connectionString: string) {
  return new Redis(connectionString, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
  });
}
