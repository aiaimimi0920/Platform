import { env } from "@/env";
import { createRedisClient } from "@neuro/backend-foundation/db/factories";

export const redis = createRedisClient(env.redisUrl);
