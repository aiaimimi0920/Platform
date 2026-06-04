import Redis from "ioredis";

import { env } from "@/env";

let redisClient: Redis | null = null;

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }
  return redisClient;
}
