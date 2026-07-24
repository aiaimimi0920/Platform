type AccountEnv = {
  databaseUrl: string;
  redisUrl: string;
  sharedDatabaseUrl: string;
  sharedRedisUrl: string;
  platformInternalUrl: string;
  internalApiToken: string | null;
  aiGatewayInternalUrl: string | null;
  aiGatewayManagementToken: string | null;
  obsidianToMiraRate: number;
  emailDeliveryMode: "console" | "smtp";
  emailConsoleExposeVerificationCode: boolean;
  emailIngressDomain: string;
  mailgunIngressSigningKey: string | null;
  emailIngressSignatureMaxAgeSeconds: number;
  emailVerificationSecret: string | null;
  emailVerificationTtlMinutes: number;
  emailTaskDefaultRewardCurrency: "obsidian" | "mira";
  emailTaskDefaultRewardAmount: number;
  emailTaskDefaultBondAmount: number;
  emailTaskDefaultPricingMode: "flat_task" | "token_metered" | "property_metered";
  emailTaskDefaultOperationMode: "manual" | "automatic";
  credentialPoolSuperToken: string | null;
  benefitServiceApiKeySecret: string | null;
  benefitServiceApiPublicBaseUrl: string | null;
  credentialObjectStorageDriver: "local" | "s3-compatible";
  credentialObjectStorageLocalDir: string;
  credentialObjectStorageBucket: string | null;
  credentialObjectStorageRegion: string;
  credentialObjectStorageEndpoint: string | null;
  credentialObjectStorageAccessKeyId: string | null;
  credentialObjectStorageSecretAccessKey: string | null;
  credentialObjectStoragePublicBaseUrl: string | null;
  credentialObjectStorageForcePathStyle: boolean;
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

function resolveOptionalOverride(primaryName: string, fallbackName: string) {
  const fallback = requireEnv(fallbackName);
  const override = process.env[primaryName]?.trim();
  if (override && override !== fallback) {
    return {
      value: override,
      usesDedicated: true,
      fallback,
    };
  }
  return {
    value: fallback,
    usesDedicated: false,
    fallback,
  };
}

function resolveRate() {
  const rawRate = Number(process.env.OBSIDIAN_TO_MIRA_RATE ?? "10");
  if (Number.isFinite(rawRate) && rawRate > 0) {
    return rawRate;
  }
  return 10;
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

function resolveEmailDeliveryMode(value: string | undefined): "console" | "smtp" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "smtp" ? "smtp" : "console";
}

function resolvePlatformInternalUrl() {
  const raw =
    process.env.PLATFORM_INTERNAL_URL?.trim() ||
    process.env.CORE_INTERNAL_URL?.trim() ||
    "http://127.0.0.1:4000";
  return raw.replace(/\/+$/, "");
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function resolveEmailTaskDefaultRewardCurrency(
  value: string | undefined,
): "obsidian" | "mira" {
  return value?.trim() === "obsidian" ? "obsidian" : "mira";
}

function resolveEmailTaskDefaultPricingMode(
  value: string | undefined,
): "flat_task" | "token_metered" | "property_metered" {
  const normalized = value?.trim();
  if (normalized === "token_metered" || normalized === "property_metered") {
    return normalized;
  }
  return "flat_task";
}

function resolveEmailTaskDefaultOperationMode(value: string | undefined): "manual" | "automatic" {
  return value?.trim() === "automatic" ? "automatic" : "manual";
}

const database = resolveOptionalOverride("ACCOUNT_DATABASE_URL", "DATABASE_URL");
const redis = resolveOptionalOverride("ACCOUNT_REDIS_URL", "REDIS_URL");

export const env: AccountEnv = {
  databaseUrl: database.value,
  redisUrl: redis.value,
  sharedDatabaseUrl: database.fallback,
  sharedRedisUrl: redis.fallback,
  platformInternalUrl: resolvePlatformInternalUrl(),
  internalApiToken: process.env.INTERNAL_API_TOKEN?.trim() || null,
  aiGatewayInternalUrl:
    process.env.AI_GATEWAY_INTERNAL_URL?.trim() ||
    process.env.GATEWAY_INTERNAL_URL?.trim() ||
    null,
  aiGatewayManagementToken:
    process.env.AI_GATEWAY_MANAGEMENT_TOKEN?.trim() ||
    process.env.GATEWAY_MANAGEMENT_TOKEN?.trim() ||
    process.env.INTERNAL_API_TOKEN?.trim() ||
    null,
  obsidianToMiraRate: resolveRate(),
  emailDeliveryMode: resolveEmailDeliveryMode(process.env.ACCOUNT_EMAIL_DELIVERY_MODE),
  emailConsoleExposeVerificationCode: parseBooleanEnv(
    process.env.ACCOUNT_EMAIL_CONSOLE_EXPOSE_VERIFICATION_CODE,
    true,
  ),
  emailIngressDomain: process.env.EMAIL_NATIVE_INGRESS_DOMAIN?.trim() || "mail.neuro.local",
  mailgunIngressSigningKey: process.env.ACCOUNT_EMAIL_MAILGUN_SIGNING_KEY?.trim() || null,
  emailIngressSignatureMaxAgeSeconds: parsePositiveInt(
    process.env.ACCOUNT_EMAIL_INGRESS_SIGNATURE_MAX_AGE_SECONDS,
    900,
  ),
  emailVerificationSecret:
    process.env.ACCOUNT_EMAIL_VERIFICATION_SECRET?.trim() ||
    process.env.INTERNAL_API_TOKEN?.trim() ||
    null,
  emailVerificationTtlMinutes: parsePositiveInt(process.env.ACCOUNT_EMAIL_VERIFICATION_TTL_MINUTES, 15),
  emailTaskDefaultRewardCurrency: resolveEmailTaskDefaultRewardCurrency(
    process.env.EMAIL_NATIVE_TASK_DEFAULT_REWARD_CURRENCY,
  ),
  emailTaskDefaultRewardAmount: parsePositiveInt(
    process.env.EMAIL_NATIVE_TASK_DEFAULT_REWARD_AMOUNT,
    100,
  ),
  emailTaskDefaultBondAmount: Math.max(
    0,
    parsePositiveInt(process.env.EMAIL_NATIVE_TASK_DEFAULT_BOND_AMOUNT, 0),
  ),
  emailTaskDefaultPricingMode: resolveEmailTaskDefaultPricingMode(
    process.env.EMAIL_NATIVE_TASK_DEFAULT_PRICING_MODE,
  ),
  emailTaskDefaultOperationMode: resolveEmailTaskDefaultOperationMode(
    process.env.EMAIL_NATIVE_TASK_DEFAULT_OPERATION_MODE,
  ),
  credentialPoolSuperToken: process.env.CREDENTIAL_POOL_SUPER_TOKEN?.trim() || null,
  benefitServiceApiKeySecret:
    process.env.BENEFIT_SERVICE_API_KEY_SECRET?.trim() || process.env.INTERNAL_API_TOKEN?.trim() || null,
  benefitServiceApiPublicBaseUrl: process.env.BENEFIT_SERVICE_API_PUBLIC_BASE_URL?.trim() || null,
  credentialObjectStorageDriver:
    process.env.OBJECT_STORAGE_DRIVER?.trim() === "s3-compatible" ? "s3-compatible" : "local",
  credentialObjectStorageLocalDir:
    process.env.CREDENTIAL_OBJECT_STORAGE_LOCAL_DIR?.trim() ||
    process.env.OBJECT_STORAGE_LOCAL_DIR?.trim() ||
    ".runtime/account-credential-payloads",
  credentialObjectStorageBucket: process.env.OBJECT_STORAGE_BUCKET?.trim() || null,
  credentialObjectStorageRegion: process.env.OBJECT_STORAGE_REGION?.trim() || "auto",
  credentialObjectStorageEndpoint: process.env.OBJECT_STORAGE_ENDPOINT?.trim() || null,
  credentialObjectStorageAccessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim() || null,
  credentialObjectStorageSecretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim() || null,
  credentialObjectStoragePublicBaseUrl:
    process.env.CREDENTIAL_OBJECT_STORAGE_PUBLIC_BASE_URL?.trim() ||
    process.env.OBJECT_STORAGE_PUBLIC_BASE_URL?.trim() ||
    process.env.S3_PUBLIC_BASE_URL?.trim() ||
    null,
  credentialObjectStorageForcePathStyle: parseBooleanEnv(process.env.OBJECT_STORAGE_FORCE_PATH_STYLE, false),
  usesDedicatedDatabase: database.usesDedicated,
  usesDedicatedRedis: redis.usesDedicated,
};
