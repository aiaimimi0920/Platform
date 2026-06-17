import type { GatewayProviderAccountPayload } from "@neuro/contracts";

export type ProviderPayloadStorageMode = "inline" | "r2";

const INLINE_JSONB_THRESHOLD_BYTES = 4096;
const LARGE_ARRAY_THRESHOLD = 50;

/**
 * Chooses storage mode based on payload size and structure.
 *
 * Keep this helper dependency-free: both the operator service and credential
 * manager use it, and tests should exercise the real storage contract without
 * loading database or Redis clients.
 */
export function chooseProviderPayloadStorageMode(
  payload: GatewayProviderAccountPayload,
): ProviderPayloadStorageMode {
  const serialized = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(serialized, "utf8");

  if (sizeBytes > INLINE_JSONB_THRESHOLD_BYTES) {
    return "r2";
  }

  const hasLargeTopLevelArray = Object.values(payload).some(
    (value) => Array.isArray(value) && value.length > LARGE_ARRAY_THRESHOLD,
  );
  if (hasLargeTopLevelArray) {
    return "r2";
  }

  return "inline";
}
