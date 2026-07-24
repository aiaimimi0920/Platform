export {
  defaultPlatformAllowedOrigins,
  getPlatformCorsObservabilitySnapshot,
  isAllowedPlatformOrigin,
  platformCorsOrigin,
  redactPlatformText,
  registerPlatformRequestObservability,
  resolvePlatformRequestContext,
  resolvePlatformRequestObservability,
  resetPlatformCorsObservabilityForTests,
  resolvePlatformAllowedOrigins,
  serializePlatformLogError,
  serializePlatformError,
} from "@neuro/backend-foundation/platform/http-server";
export type {
  PlatformCorsObservabilitySnapshot,
  PlatformErrorCategory,
  PlatformErrorDiagnostics,
  PlatformErrorResponseBody,
  PlatformLogErrorEntry,
  PlatformRequestObservability,
  PlatformRequestObservabilityContext,
  SerializedPlatformError,
} from "@neuro/backend-foundation/platform/http-server";
