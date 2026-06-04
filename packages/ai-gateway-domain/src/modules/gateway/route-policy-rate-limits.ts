import type { GatewayRateLimitDefinition } from "@neuro/contracts";
import { ConflictError } from "@neuro/backend-foundation/platform/errors";

export type GatewayRateLimitDefinitionInput = {
  windowSeconds?: number | null;
  maxRequests?: number | null;
};

function normalizePositiveIntField(label: string, value: number | null | undefined, fallback: number | null, maxValue: number) {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new ConflictError(`${label} 必须是正整数。`);
  }
  if (value > maxValue) {
    throw new ConflictError(`${label} 不能超过 ${maxValue}。`);
  }
  return value;
}

export function normalizeRoutePolicyRateLimitDefinition(
  label: string,
  value: GatewayRateLimitDefinitionInput | null | undefined,
  fallback: GatewayRateLimitDefinition | null,
) {
  if (value == null) {
    return fallback;
  }
  const windowSeconds = normalizePositiveIntField(`${label}.windowSeconds`, value.windowSeconds ?? null, null, 86_400);
  const maxRequests = normalizePositiveIntField(`${label}.maxRequests`, value.maxRequests ?? null, null, 1_000_000);
  if (windowSeconds == null && maxRequests == null) {
    return fallback;
  }
  if (windowSeconds == null || maxRequests == null) {
    throw new ConflictError(`${label} 需要同时指定 windowSeconds 和 maxRequests。`);
  }
  return {
    windowSeconds,
    maxRequests,
  } satisfies GatewayRateLimitDefinition;
}

export function normalizeRoutePolicyRateLimitMap(
  label: string,
  values: Record<string, GatewayRateLimitDefinitionInput> | null | undefined,
  fallback: Record<string, GatewayRateLimitDefinition> | null,
  options?: { normalizeKey?: (key: string) => string | null },
) {
  if (!values || Object.keys(values).length === 0) {
    return fallback;
  }
  const normalized: Record<string, GatewayRateLimitDefinition> = {};
  for (const [rawKey, definition] of Object.entries(values)) {
    const normalizedSource = rawKey?.trim() ?? "";
    if (!normalizedSource) {
      throw new ConflictError(`${label} 条目的 key 不能为空。`);
    }
    const normalizedKey = options?.normalizeKey?.(normalizedSource) ?? normalizedSource;
    if (!normalizedKey) {
      throw new ConflictError(`${label} 条目的 key 不能为空。`);
    }
    const entry = normalizeRoutePolicyRateLimitDefinition(`${label}.${normalizedKey}`, definition, null);
    if (!entry) {
      continue;
    }
    normalized[normalizedKey] = entry;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}
