// ---------------------------------------------------------------------------
// Region Resolver — multi-level region configuration with fallback logic
// ---------------------------------------------------------------------------

/**
 * Region configuration for a credential or global settings
 */
export type RegionConfig = {
  /**
   * Default region (used as fallback for both auth and API)
   */
  region?: string;

  /**
   * Auth region (used for token refresh/authentication)
   * Falls back to region if not specified
   */
  authRegion?: string;

  /**
   * API region (used for API requests)
   * Falls back to region if not specified
   */
  apiRegion?: string;
};

/**
 * Resolved region configuration with all fields populated
 */
export type ResolvedRegionConfig = {
  authRegion: string;
  apiRegion: string;
  defaultRegion: string;
};

/**
 * Default region values
 */
export const DEFAULT_REGION = "us-east-1";
export const DEFAULT_AUTH_REGION = DEFAULT_REGION;
export const DEFAULT_API_REGION = DEFAULT_REGION;

/**
 * Resolve auth region with multi-level fallback
 *
 * Priority: credential.authRegion > credential.region > global.authRegion > global.region > default
 *
 * @param credentialConfig - Credential-level region configuration
 * @param globalConfig - Global region configuration
 * @returns Resolved auth region
 */
export function resolveAuthRegion(
  credentialConfig: RegionConfig | null | undefined,
  globalConfig: RegionConfig | null | undefined,
): string {
  // Credential-level authRegion
  if (credentialConfig?.authRegion) {
    return credentialConfig.authRegion;
  }

  // Credential-level region (fallback)
  if (credentialConfig?.region) {
    return credentialConfig.region;
  }

  // Global authRegion
  if (globalConfig?.authRegion) {
    return globalConfig.authRegion;
  }

  // Global region (fallback)
  if (globalConfig?.region) {
    return globalConfig.region;
  }

  // Default
  return DEFAULT_AUTH_REGION;
}

/**
 * Resolve API region with multi-level fallback
 *
 * Priority: credential.apiRegion > global.apiRegion > global.region > default
 *
 * Note: credential.region is NOT used as fallback for API region
 * (only for auth region). This allows credentials to have different
 * auth and API regions.
 *
 * @param credentialConfig - Credential-level region configuration
 * @param globalConfig - Global region configuration
 * @returns Resolved API region
 */
export function resolveApiRegion(
  credentialConfig: RegionConfig | null | undefined,
  globalConfig: RegionConfig | null | undefined,
): string {
  // Credential-level apiRegion
  if (credentialConfig?.apiRegion) {
    return credentialConfig.apiRegion;
  }

  // Global apiRegion
  if (globalConfig?.apiRegion) {
    return globalConfig.apiRegion;
  }

  // Global region (fallback)
  if (globalConfig?.region) {
    return globalConfig.region;
  }

  // Default
  return DEFAULT_API_REGION;
}

/**
 * Resolve all regions with multi-level fallback
 *
 * @param credentialConfig - Credential-level region configuration
 * @param globalConfig - Global region configuration
 * @returns Fully resolved region configuration
 */
export function resolveRegionConfig(
  credentialConfig: RegionConfig | null | undefined,
  globalConfig: RegionConfig | null | undefined,
): ResolvedRegionConfig {
  const authRegion = resolveAuthRegion(credentialConfig, globalConfig);
  const apiRegion = resolveApiRegion(credentialConfig, globalConfig);

  // Default region is the most specific region value available
  const defaultRegion =
    credentialConfig?.region ||
    globalConfig?.region ||
    DEFAULT_REGION;

  return {
    authRegion,
    apiRegion,
    defaultRegion,
  };
}

/**
 * Build auth endpoint URL for a region
 *
 * @param region - AWS region
 * @param service - Service name (default: "codewhisperer")
 * @returns Auth endpoint URL
 */
export function buildAuthEndpoint(region: string, service: string = "codewhisperer"): string {
  return `https://${service}.${region}.amazonaws.com`;
}

/**
 * Build API endpoint URL for a region
 *
 * @param region - AWS region
 * @param service - Service name (default: "q")
 * @returns API endpoint URL
 */
export function buildApiEndpoint(region: string, service: string = "q"): string {
  return `https://${service}.${region}.amazonaws.com`;
}

/**
 * Parse region from an endpoint URL
 *
 * @param url - Endpoint URL
 * @returns Extracted region or null if not found
 */
export function parseRegionFromEndpoint(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Match pattern: service.region.amazonaws.com
    const match = hostname.match(/^[^.]+\.([^.]+)\.amazonaws\.com$/);
    if (match) {
      return match[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate region format
 *
 * @param region - Region string to validate
 * @returns True if region format is valid
 */
export function isValidRegion(region: string): boolean {
  // AWS region format: lowercase letters, numbers, and hyphens
  // Examples: us-east-1, eu-west-2, ap-southeast-1
  return /^[a-z0-9-]+$/.test(region);
}

/**
 * Common AWS regions
 */
export const COMMON_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-northeast-2",
] as const;

export type CommonRegion = (typeof COMMON_REGIONS)[number];
