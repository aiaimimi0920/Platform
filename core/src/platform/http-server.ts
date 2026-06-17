export {
  defaultPlatformAllowedOrigins,
  getPlatformCorsObservabilitySnapshot,
  isAllowedPlatformOrigin,
  platformCorsOrigin,
  resetPlatformCorsObservabilityForTests,
  resolvePlatformAllowedOrigins,
  serializePlatformError,
} from "@neuro/backend-foundation/platform/http-server";
export type {
  PlatformCorsObservabilitySnapshot,
  PlatformErrorResponseBody,
  SerializedPlatformError,
} from "@neuro/backend-foundation/platform/http-server";
