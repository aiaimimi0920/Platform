// ---------------------------------------------------------------------------
// Credential Failover — multi-credential management with retry and failover
// ---------------------------------------------------------------------------

/**
 * Credential entry with priority and health tracking
 */
export type CredentialEntry<T = unknown> = {
  id: string;
  credential: T;
  priority: number; // Lower number = higher priority
  disabled: boolean;
  failureCount: number;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
};

/**
 * Load balancing mode
 */
export type LoadBalancingMode = "priority" | "balanced";

/**
 * Credential failover configuration
 */
export type CredentialFailoverConfig = {
  maxRetriesPerCredential: number; // Max retries for a single credential (default: 3)
  maxTotalRetries: number; // Max total retries across all credentials (default: 9)
  loadBalancingMode: LoadBalancingMode; // "priority" or "balanced" (default: "priority")
  retryDelayMs: number; // Delay between retries in milliseconds (default: 500)
  backoffMultiplier: number; // Backoff multiplier for retry delay (default: 2)
  maxRetryDelayMs: number; // Max retry delay in milliseconds (default: 5000)
};

/**
 * Credential selection result
 */
export type CredentialSelectionResult<T> = {
  credential: T;
  credentialId: string;
  attempt: number; // 0-indexed attempt number
  totalAttempts: number;
};

/**
 * Credential execution result
 */
export type CredentialExecutionResult<T> =
  | {
      success: true;
      result: T;
      credentialId: string;
      totalAttempts: number;
    }
  | {
      success: false;
      error: string;
      credentialId: string | null;
      totalAttempts: number;
      allErrors: Array<{ credentialId: string; error: string }>;
    };

/**
 * Default failover configuration
 */
export const DEFAULT_FAILOVER_CONFIG: CredentialFailoverConfig = {
  maxRetriesPerCredential: 3,
  maxTotalRetries: 9,
  loadBalancingMode: "priority",
  retryDelayMs: 500,
  backoffMultiplier: 2,
  maxRetryDelayMs: 5000,
};

/**
 * Multi-credential manager with failover and retry logic
 */
export class CredentialFailoverManager<T = unknown> {
  private credentials: Map<string, CredentialEntry<T>> = new Map();
  private config: CredentialFailoverConfig;
  private roundRobinIndex = 0;

  constructor(config: Partial<CredentialFailoverConfig> = {}) {
    this.config = { ...DEFAULT_FAILOVER_CONFIG, ...config };
  }

  /**
   * Add a credential to the manager
   */
  addCredential(entry: CredentialEntry<T>): void {
    this.credentials.set(entry.id, entry);
  }

  /**
   * Remove a credential from the manager
   */
  removeCredential(credentialId: string): boolean {
    return this.credentials.delete(credentialId);
  }

  /**
   * Get a credential by ID
   */
  getCredential(credentialId: string): CredentialEntry<T> | null {
    return this.credentials.get(credentialId) ?? null;
  }

  /**
   * Update credential status after success
   */
  recordSuccess(credentialId: string): void {
    const entry = this.credentials.get(credentialId);
    if (entry) {
      entry.failureCount = 0;
      entry.lastSuccessAt = new Date();
    }
  }

  /**
   * Update credential status after failure
   */
  recordFailure(credentialId: string): void {
    const entry = this.credentials.get(credentialId);
    if (entry) {
      entry.failureCount += 1;
      entry.lastFailureAt = new Date();
    }
  }

  /**
   * Disable a credential
   */
  disableCredential(credentialId: string): void {
    const entry = this.credentials.get(credentialId);
    if (entry) {
      entry.disabled = true;
    }
  }

  /**
   * Enable a credential
   */
  enableCredential(credentialId: string): void {
    const entry = this.credentials.get(credentialId);
    if (entry) {
      entry.disabled = false;
    }
  }

  /**
   * Reset failure count for a credential
   */
  resetFailureCount(credentialId: string): void {
    const entry = this.credentials.get(credentialId);
    if (entry) {
      entry.failureCount = 0;
    }
  }

  /**
   * Get all available (enabled, non-failed) credentials sorted by priority
   */
  private getAvailableCredentials(): CredentialEntry<T>[] {
    return Array.from(this.credentials.values())
      .filter((entry) => !entry.disabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Select next credential based on load balancing mode
   */
  private selectNextCredential(
    availableCredentials: CredentialEntry<T>[],
  ): CredentialEntry<T> | null {
    if (availableCredentials.length === 0) {
      return null;
    }

    if (this.config.loadBalancingMode === "priority") {
      // Priority mode: always use highest priority (lowest number)
      return availableCredentials[0];
    } else {
      // Balanced mode: round-robin across all available credentials
      const index = this.roundRobinIndex % availableCredentials.length;
      this.roundRobinIndex += 1;
      return availableCredentials[index];
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
    return Math.min(delay, this.config.maxRetryDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute an operation with automatic failover and retry
   *
   * @param operation - Async function that takes a credential and returns a result
   * @param isRetryable - Function to determine if an error is retryable (default: all errors are retryable)
   * @returns Execution result with success/failure status
   */
  async executeWithFailover<R>(
    operation: (credential: T, credentialId: string) => Promise<R>,
    isRetryable: (error: unknown) => boolean = () => true,
  ): Promise<CredentialExecutionResult<R>> {
    const availableCredentials = this.getAvailableCredentials();

    if (availableCredentials.length === 0) {
      return {
        success: false,
        error: "No available credentials",
        credentialId: null,
        totalAttempts: 0,
        allErrors: [],
      };
    }

    let totalAttempts = 0;
    const allErrors: Array<{ credentialId: string; error: string }> = [];
    const credentialAttempts = new Map<string, number>();
    const maxAttemptsPerCredential =
      this.config.loadBalancingMode === "balanced"
        ? this.config.maxRetriesPerCredential + 1
        : this.config.maxRetriesPerCredential;

    while (totalAttempts < this.config.maxTotalRetries) {
      const eligibleCredentials = availableCredentials.filter(
        (entry) => (credentialAttempts.get(entry.id) ?? 0) < maxAttemptsPerCredential,
      );
      const entry = this.selectNextCredential(eligibleCredentials);
      if (!entry) {
        break;
      }

      const credentialId = entry.id;
      const credentialAttemptCount = credentialAttempts.get(credentialId) ?? 0;

      totalAttempts += 1;
      credentialAttempts.set(credentialId, credentialAttemptCount + 1);

      try {
        // Execute operation with selected credential
        const result = await operation(entry.credential, credentialId);

        // Success - record and return
        this.recordSuccess(credentialId);
        return {
          success: true,
          result,
          credentialId,
          totalAttempts,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        allErrors.push({ credentialId, error: errorMessage });

        // Record failure
        this.recordFailure(credentialId);

        // Check if error is retryable
        if (!isRetryable(error)) {
          // Non-retryable error - fail immediately
          return {
            success: false,
            error: errorMessage,
            credentialId,
            totalAttempts,
            allErrors,
          };
        }

        // Calculate retry delay
        const delay = this.calculateRetryDelay(credentialAttemptCount);

        // Sleep before next retry (except for last attempt)
        if (totalAttempts < this.config.maxTotalRetries) {
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: `All credentials exhausted after ${totalAttempts} attempts`,
      credentialId: null,
      totalAttempts,
      allErrors,
    };
  }

  /**
   * Get statistics about credential health
   */
  getStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
    healthy: number;
    unhealthy: number;
  } {
    const credentials = Array.from(this.credentials.values());

    return {
      total: credentials.length,
      enabled: credentials.filter((c) => !c.disabled).length,
      disabled: credentials.filter((c) => c.disabled).length,
      healthy: credentials.filter((c) => !c.disabled && c.failureCount === 0).length,
      unhealthy: credentials.filter((c) => !c.disabled && c.failureCount > 0).length,
    };
  }

  /**
   * List all credentials with their status
   */
  listCredentials(): CredentialEntry<T>[] {
    return Array.from(this.credentials.values()).sort((a, b) => a.priority - b.priority);
  }
}
