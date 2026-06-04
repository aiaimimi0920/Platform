import { env } from "@/env";
import { createRedisClient } from "@/db/factories";

export const redis = createRedisClient(env.redisUrl);
