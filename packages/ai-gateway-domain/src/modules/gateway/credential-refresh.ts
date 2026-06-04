// ---------------------------------------------------------------------------
// Credential Refresh — unified interface for auto-refreshing provider credentials
// ---------------------------------------------------------------------------

/**
 * Credential refresh result
 */
export type CredentialRefreshResult =
  | {
      success: true;
      accessToken: string;
      expiresAt: Date;
      refreshToken?: string; // New refresh token if rotated
    }
  | {
      success: false;
      error: string;
      isPermanentFailure: boolean; // true if refresh token is invalid/revoked
    };

/**
 * Credential expiration check result
 */
export type CredentialExpirationStatus = {
  isExpired: boolean; // Already expired (within 5 minutes)
  isExpiringSoon: boolean; // Expiring within 10 minutes
  expiresAt: Date | null;
  minutesUntilExpiration: number | null;
};

/**
 * Base interface for credential refreshers
 *
 * Each provider type (Kiro, OpenAI, Custom, etc.) implements this interface
 * to provide auto-refresh logic specific to their authentication mechanism.
 */
export interface ICredentialRefresher {
  /**
   * Provider type identifier (e.g., "kiro", "openai", "custom")
   */
  readonly providerType: string;

  /**
   * Check if a credential is expired or expiring soon
   */
  checkExpiration(credential: unknown): CredentialExpirationStatus;

  /**
   * Refresh an expired or expiring credential
   *
   * @param credential - The credential to refresh (provider-specific format)
   * @param config - Optional provider-specific configuration
   * @returns Refresh result with new tokens or error
   */
  refresh(credential: unknown, config?: unknown): Promise<CredentialRefreshResult>;

  /**
   * Validate the basic structure of a credential
   *
   * @param credential - The credential to validate
   * @returns Validation result with error message if invalid
   */
  validate(credential: unknown): { valid: boolean; error?: string };
}

/**
 * Abstract base class for credential refreshers
 *
 * Provides common utilities for expiration checking and validation.
 */
export abstract class BaseCredentialRefresher implements ICredentialRefresher {
  abstract readonly providerType: string;

  /**
   * Check if a credential expires within the specified minutes
   */
  protected isExpiringWithin(expiresAt: Date | string | null, minutes: number): boolean {
    if (!expiresAt) {
      return true; // No expiration time = treat as expired
    }

    const expirationDate = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const threshold = new Date(now.getTime() + minutes * 60 * 1000);

    return expirationDate <= threshold;
  }

  /**
   * Calculate minutes until expiration
   */
  protected minutesUntilExpiration(expiresAt: Date | string | null): number | null {
    if (!expiresAt) {
      return null;
    }

    const expirationDate = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const diffMs = expirationDate.getTime() - now.getTime();

    return Math.floor(diffMs / (60 * 1000));
  }

  abstract checkExpiration(credential: unknown): CredentialExpirationStatus;
  abstract refresh(credential: unknown, config?: unknown): Promise<CredentialRefreshResult>;
  abstract validate(credential: unknown): { valid: boolean; error?: string };
}

/**
 * Registry for credential refreshers
 *
 * Allows registering and retrieving refreshers by provider type.
 */
export class CredentialRefresherRegistry {
  private refreshers = new Map<string, ICredentialRefresher>();

  /**
   * Register a credential refresher for a provider type
   */
  register(refresher: ICredentialRefresher): void {
    this.refreshers.set(refresher.providerType, refresher);
  }

  /**
   * Get a credential refresher by provider type
   */
  get(providerType: string): ICredentialRefresher | null {
    return this.refreshers.get(providerType) ?? null;
  }

  /**
   * Check if a refresher is registered for a provider type
   */
  has(providerType: string): boolean {
    return this.refreshers.has(providerType);
  }

  /**
   * List all registered provider types
   */
  listProviderTypes(): string[] {
    return Array.from(this.refreshers.keys());
  }
}

/**
 * Global credential refresher registry
 */
export const credentialRefresherRegistry = new CredentialRefresherRegistry();

/**
 * Helper function to check if a credential needs refresh
 *
 * @param providerType - Provider type identifier
 * @param credential - The credential to check
 * @returns Expiration status or null if no refresher found
 */
export function checkCredentialExpiration(
  providerType: string,
  credential: unknown,
): CredentialExpirationStatus | null {
  const refresher = credentialRefresherRegistry.get(providerType);
  if (!refresher) {
    return null;
  }

  return refresher.checkExpiration(credential);
}

/**
 * Helper function to refresh a credential
 *
 * @param providerType - Provider type identifier
 * @param credential - The credential to refresh
 * @param config - Optional provider-specific configuration
 * @returns Refresh result or error if no refresher found
 */
export async function refreshCredential(
  providerType: string,
  credential: unknown,
  config?: unknown,
): Promise<CredentialRefreshResult> {
  const refresher = credentialRefresherRegistry.get(providerType);
  if (!refresher) {
    return {
      success: false,
      error: `No credential refresher registered for provider type: ${providerType}`,
      isPermanentFailure: false,
    };
  }

  // Validate credential before attempting refresh
  const validation = refresher.validate(credential);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error ?? "Invalid credential format",
      isPermanentFailure: true,
    };
  }

  return refresher.refresh(credential, config);
}
