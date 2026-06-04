import { ConflictError } from "@neuro/backend-foundation/platform/errors";
import type { GatewayRoutePolicyConfig } from "@neuro/contracts";

const MAX_REQUEST_BODY_BYTES = 1_000_000_000; // ~1 GB
const MAX_TIMEOUT_SECONDS = 300; // 5 minutes
const MAX_HEARTBEAT_GAP_SECONDS = 60; // 1 minute

function normalizePositiveInt(
  label: string,
  value: number | null | undefined,
  fallback: number | null,
  maxValue: number,
) {
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

export type RoutePolicyGuardrailSet = Pick<
  GatewayRoutePolicyConfig,
  | "maxRequestBodyBytes"
  | "streamIdleTimeoutSeconds"
  | "totalRequestTimeoutSeconds"
  | "maxStreamHeartbeatGapSeconds"
>;

export type RoutePolicyGuardrailInput = {
  maxRequestBodyBytes?: number | null;
  streamIdleTimeoutSeconds?: number | null;
  totalRequestTimeoutSeconds?: number | null;
  maxStreamHeartbeatGapSeconds?: number | null;
};

export function normalizeRoutePolicyGuardrails(
  config: RoutePolicyGuardrailInput,
): RoutePolicyGuardrailSet {
  return {
    maxRequestBodyBytes: normalizePositiveInt(
      "maxRequestBodyBytes",
      config.maxRequestBodyBytes ?? null,
      null,
      MAX_REQUEST_BODY_BYTES,
    ),
    streamIdleTimeoutSeconds: normalizePositiveInt(
      "streamIdleTimeoutSeconds",
      config.streamIdleTimeoutSeconds ?? null,
      null,
      MAX_TIMEOUT_SECONDS,
    ),
    totalRequestTimeoutSeconds: normalizePositiveInt(
      "totalRequestTimeoutSeconds",
      config.totalRequestTimeoutSeconds ?? null,
      null,
      MAX_TIMEOUT_SECONDS,
    ),
    maxStreamHeartbeatGapSeconds: normalizePositiveInt(
      "maxStreamHeartbeatGapSeconds",
      config.maxStreamHeartbeatGapSeconds ?? null,
      null,
      MAX_HEARTBEAT_GAP_SECONDS,
    ),
  };
}
