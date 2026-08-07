type GatewayEnv = {
  databaseUrl: string;
  redisUrl: string;
  sharedDatabaseUrl: string;
  sharedRedisUrl: string;
  apiKeySecret: string | null;
  publicBaseUrl: string | null;
  compatibilityBaseUrl: string | null;
  objectStorageDriver: "local" | "s3-compatible";
  objectStorageLocalDir: string;
  objectStorageBucket: string | null;
  objectStorageRegion: string;
  objectStorageEndpoint: string | null;
  objectStorageAccessKeyId: string | null;
  objectStorageSecretAccessKey: string | null;
  objectStorageForcePathStyle: boolean;
  modelsCacheTtlSeconds: number;
  providerFetchTimeoutMs: number;
  usesDedicatedDatabase: boolean;
  usesDedicatedRedis: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveOptionalOverrideChain(primaryNames: string[], fallbackName: string) {
  const fallback = requireEnv(fallbackName);
  for (const primaryName of primaryNames) {
    const override = process.env[primaryName]?.trim();
    if (override) {
      return {
        value: override,
        usesDedicated: primaryName !== "ACCOUNT_DATABASE_URL" && primaryName !== "ACCOUNT_REDIS_URL",
        fallback,
      };
    }
  }
  return {
    value: fallback,
    usesDedicated: false,
    fallback,
  };
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}

const database = resolveOptionalOverrideChain(["AI_GATEWAY_DATABASE_URL", "ACCOUNT_DATABASE_URL"], "DATABASE_URL");
const redis = resolveOptionalOverrideChain(["AI_GATEWAY_REDIS_URL", "ACCOUNT_REDIS_URL"], "REDIS_URL");

export const env: GatewayEnv = {
  databaseUrl: database.value,
  redisUrl: redis.value,
  sharedDatabaseUrl: database.fallback,
  sharedRedisUrl: redis.fallback,
  apiKeySecret:
    process.env.AI_GATEWAY_API_KEY_SECRET?.trim() ||
    process.env.BENEFIT_SERVICE_API_KEY_SECRET?.trim() ||
    process.env.INTERNAL_API_TOKEN?.trim() ||
    null,
  publicBaseUrl:
    process.env.AI_GATEWAY_PUBLIC_BASE_URL?.trim() ||
    process.env.BENEFIT_SERVICE_API_PUBLIC_BASE_URL?.trim() ||
    null,
  compatibilityBaseUrl:
    process.env.AI_GATEWAY_COMPATIBILITY_BASE_URL?.trim() ||
    process.env.AI_GATEWAY_COMPAT_BASE_URL?.trim() ||
    null,
  objectStorageDriver:
    process.env.AI_GATEWAY_OBJECT_STORAGE_DRIVER?.trim() === "s3-compatible" ||
    process.env.OBJECT_STORAGE_DRIVER?.trim() === "s3-compatible"
      ? "s3-compatible"
      : "local",
  objectStorageLocalDir:
    process.env.AI_GATEWAY_OBJECT_STORAGE_LOCAL_DIR?.trim() ||
    process.env.CREDENTIAL_OBJECT_STORAGE_LOCAL_DIR?.trim() ||
    process.env.OBJECT_STORAGE_LOCAL_DIR?.trim() ||
    ".runtime/ai-gateway-objects",
  objectStorageBucket:
    process.env.AI_GATEWAY_OBJECT_STORAGE_BUCKET?.trim() || process.env.OBJECT_STORAGE_BUCKET?.trim() || null,
  objectStorageRegion:
    process.env.AI_GATEWAY_OBJECT_STORAGE_REGION?.trim() || process.env.OBJECT_STORAGE_REGION?.trim() || "auto",
  objectStorageEndpoint:
    process.env.AI_GATEWAY_OBJECT_STORAGE_ENDPOINT?.trim() || process.env.OBJECT_STORAGE_ENDPOINT?.trim() || null,
  objectStorageAccessKeyId:
    process.env.AI_GATEWAY_OBJECT_STORAGE_ACCESS_KEY_ID?.trim() ||
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim() ||
    null,
  objectStorageSecretAccessKey:
    process.env.AI_GATEWAY_OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim() ||
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim() ||
    null,
  objectStorageForcePathStyle: parseBooleanEnv(
    process.env.AI_GATEWAY_OBJECT_STORAGE_FORCE_PATH_STYLE || process.env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    false,
  ),
  modelsCacheTtlSeconds: parsePositiveInt(process.env.AI_GATEWAY_MODELS_CACHE_TTL_SECONDS, 60),
  providerFetchTimeoutMs: parsePositiveInt(process.env.AI_GATEWAY_PROVIDER_FETCH_TIMEOUT_MS, 10_000),
  usesDedicatedDatabase: database.usesDedicated,
  usesDedicatedRedis: redis.usesDedicated,
};
