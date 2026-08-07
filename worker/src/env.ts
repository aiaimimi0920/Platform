type WorkerEnv = {
  databaseUrl: string;
  redisUrl: string;
  pollIntervalMs: number;
  processingLeaseTimeoutMs: number;
  healthPort: number;
  platformOperatorUserIds: string[];
  coreInternalUrl: string | null;
  internalApiToken: string | null;
  coreInternalFetchTimeoutMs: number;
  databaseConnectionTimeoutMs: number;
  databaseQueryTimeoutMs: number;
  agentExecutionDispatchIntervalMs: number;
  agentExecutionDispatchLimit: number;
  agentExecutionSettlementIntervalMs: number;
  agentExecutionSettlementLimit: number;
  agentMarketplaceSweepIntervalMs: number;
  agentMarketplaceSweepOwnerLimit: number;
  agentMarketplaceSweepPerOwnerLimit: number;
  platformExecutorIntervalMs: number;
  platformExecutorLimit: number;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumber(value: string | undefined, fallback: number, minimum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.floor(parsed);
}

function parseCsvList(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const DEFAULT_POLL_INTERVAL_MS = 4000;
const DEFAULT_PROCESSING_LEASE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_HEALTH_PORT = 7301;
const DEFAULT_CORE_INTERNAL_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_DATABASE_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_DATABASE_QUERY_TIMEOUT_MS = 30_000;

export const env: WorkerEnv = {
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: requireEnv("REDIS_URL"),
  pollIntervalMs: parseNumber(process.env.WORKER_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS, 250),
  processingLeaseTimeoutMs: parseNumber(
    process.env.WORKER_PROCESSING_LEASE_TIMEOUT_MS,
    DEFAULT_PROCESSING_LEASE_TIMEOUT_MS,
    5_000,
  ),
  healthPort: parseNumber(process.env.WORKER_HEALTH_PORT, DEFAULT_HEALTH_PORT, 1),
  platformOperatorUserIds: parseCsvList(process.env.PLATFORM_OPERATOR_USER_IDS),
  coreInternalUrl: process.env.CORE_INTERNAL_URL?.trim() || null,
  internalApiToken: process.env.INTERNAL_API_TOKEN?.trim() || null,
  coreInternalFetchTimeoutMs: parseNumber(
    process.env.CORE_INTERNAL_FETCH_TIMEOUT_MS,
    DEFAULT_CORE_INTERNAL_FETCH_TIMEOUT_MS,
    250,
  ),
  databaseConnectionTimeoutMs: parseNumber(
    process.env.DATABASE_CONNECTION_TIMEOUT_MS,
    DEFAULT_DATABASE_CONNECTION_TIMEOUT_MS,
    250,
  ),
  databaseQueryTimeoutMs: parseNumber(
    process.env.DATABASE_QUERY_TIMEOUT_MS,
    DEFAULT_DATABASE_QUERY_TIMEOUT_MS,
    250,
  ),
  agentExecutionDispatchIntervalMs: parseNumber(
    process.env.AGENT_EXECUTION_DISPATCH_INTERVAL_MS,
    5_000,
    1_000,
  ),
  agentExecutionDispatchLimit: parseNumber(process.env.AGENT_EXECUTION_DISPATCH_LIMIT, 10, 1),
  agentExecutionSettlementIntervalMs: parseNumber(
    process.env.AGENT_EXECUTION_SETTLEMENT_INTERVAL_MS,
    15_000,
    1_000,
  ),
  agentExecutionSettlementLimit: parseNumber(process.env.AGENT_EXECUTION_SETTLEMENT_LIMIT, 20, 1),
  agentMarketplaceSweepIntervalMs: parseNumber(
    process.env.AGENT_MARKETPLACE_SWEEP_INTERVAL_MS,
    20_000,
    1_000,
  ),
  agentMarketplaceSweepOwnerLimit: parseNumber(process.env.AGENT_MARKETPLACE_SWEEP_OWNER_LIMIT, 20, 1),
  agentMarketplaceSweepPerOwnerLimit: parseNumber(process.env.AGENT_MARKETPLACE_SWEEP_PER_OWNER_LIMIT, 10, 1),
  platformExecutorIntervalMs: parseNumber(process.env.PLATFORM_EXECUTOR_INTERVAL_MS, 8_000, 1_000),
  platformExecutorLimit: parseNumber(process.env.PLATFORM_EXECUTOR_LIMIT, 4, 1),
};
