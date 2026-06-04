// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeyEntry = {
  id: string;
  key: string;
  enabled: boolean;
  failureCount: number;
  lastFailureAt: string | null;
  disabledUntil: string | null;
};

export type KeySelectionStrategy = "round-robin" | "random";

export type KeyRotationConfig = {
  strategy: KeySelectionStrategy;
  maxFailuresBeforeDisable: number;
  disableCooldownMs: number;
  autoReenableAfterCooldown: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: KeyRotationConfig = {
  strategy: "round-robin",
  maxFailuresBeforeDisable: 3,
  disableCooldownMs: 60_000,
  autoReenableAfterCooldown: true,
};

// ---------------------------------------------------------------------------
// MultiKeyRotator
// ---------------------------------------------------------------------------

export class MultiKeyRotator {
  private readonly entries: KeyEntry[];
  private readonly config: KeyRotationConfig;
  private rrIndex: number;

  constructor(
    keys: Array<{ id: string; key: string }>,
    config?: Partial<KeyRotationConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rrIndex = 0;
    this.entries = keys.map((k) => ({
      id: k.id,
      key: k.key,
      enabled: true,
      failureCount: 0,
      lastFailureAt: null,
      disabledUntil: null,
    }));
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private tryReenableEntry(entry: KeyEntry): void {
    if (
      !this.config.autoReenableAfterCooldown ||
      entry.enabled ||
      entry.disabledUntil === null
    ) {
      return;
    }
    const now = Date.now();
    const until = new Date(entry.disabledUntil).getTime();
    if (now >= until) {
      entry.enabled = true;
      entry.failureCount = 0;
      entry.disabledUntil = null;
    }
  }

  private findEntry(keyId: string): KeyEntry | undefined {
    return this.entries.find((e) => e.id === keyId);
  }

  // -------------------------------------------------------------------------
  // Key selection
  // -------------------------------------------------------------------------

  selectKey(): KeyEntry | null {
    // Auto-re-enable keys whose cooldown has expired before attempting selection.
    for (const entry of this.entries) {
      this.tryReenableEntry(entry);
    }

    const available = this.entries.filter((e) => e.enabled);
    if (available.length === 0) {
      return null;
    }

    if (this.config.strategy === "random") {
      const index = Math.floor(Math.random() * available.length);
      return available[index];
    }

    // Round-robin: advance the global index until we land on an enabled key.
    const total = this.entries.length;
    for (let attempt = 0; attempt < total; attempt++) {
      const entry = this.entries[this.rrIndex % total];
      this.rrIndex = (this.rrIndex + 1) % total;
      if (entry.enabled) {
        return entry;
      }
    }

    // All disabled (should be guarded by the check above, but be safe).
    return null;
  }

  // -------------------------------------------------------------------------
  // Result reporting
  // -------------------------------------------------------------------------

  reportSuccess(keyId: string): void {
    const entry = this.findEntry(keyId);
    if (!entry) {
      return;
    }
    entry.failureCount = 0;
    entry.lastFailureAt = null;
    entry.disabledUntil = null;
    entry.enabled = true;
  }

  reportFailure(keyId: string): void {
    const entry = this.findEntry(keyId);
    if (!entry) {
      return;
    }
    entry.failureCount += 1;
    entry.lastFailureAt = new Date().toISOString();

    if (entry.failureCount >= this.config.maxFailuresBeforeDisable) {
      entry.enabled = false;
      entry.disabledUntil = new Date(
        Date.now() + this.config.disableCooldownMs,
      ).toISOString();
    }
  }

  // -------------------------------------------------------------------------
  // Manual control
  // -------------------------------------------------------------------------

  disableKey(keyId: string): void {
    const entry = this.findEntry(keyId);
    if (!entry) {
      return;
    }
    entry.enabled = false;
    entry.disabledUntil = new Date(
      Date.now() + this.config.disableCooldownMs,
    ).toISOString();
  }

  enableKey(keyId: string): void {
    const entry = this.findEntry(keyId);
    if (!entry) {
      return;
    }
    entry.enabled = true;
    entry.failureCount = 0;
    entry.disabledUntil = null;
  }

  // -------------------------------------------------------------------------
  // Introspection
  // -------------------------------------------------------------------------

  getStatus(): KeyEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  availableKeyCount(): number {
    const now = Date.now();
    return this.entries.filter((e) => {
      if (e.enabled) {
        return true;
      }
      if (
        this.config.autoReenableAfterCooldown &&
        e.disabledUntil !== null &&
        now >= new Date(e.disabledUntil).getTime()
      ) {
        return true;
      }
      return false;
    }).length;
  }
}
